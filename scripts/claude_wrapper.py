#!/usr/bin/env python3
"""
Claude Code orchestration wrapper.

This script exposes a thin control plane for Anthropic's Claude Code agent via STDIN/STDOUT.
It is designed to be driven by external worker processes (e.g. a Node.js orchestrator) and
supports streaming message forwarding, state tracking, task cancellation, and session-aware
execution using the official `claude_code_sdk` asynchronous API.
"""

from __future__ import annotations

import dataclasses
import inspect
import json
import logging
import signal
import sys
import traceback
import uuid
from datetime import datetime
from typing import Any, Dict, Optional

import anyio

try:
    from claude_code_sdk import ProcessError, ClaudeCodeOptions, query
except ImportError as import_error:  # pragma: no cover - handled at runtime
    ProcessError = None  # type: ignore[assignment]
    ClaudeCodeOptions = None  # type: ignore[assignment]
    query = None  # type: ignore[assignment]
    CLAUDE_IMPORT_ERROR = import_error
else:
    CLAUDE_IMPORT_ERROR = None


# Configure logging to stderr only (never stdout to avoid JSON pollution)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
    handlers=[logging.StreamHandler(sys.stderr)],
)

logger = logging.getLogger(__name__)


class ClaudeCodeWrapper:
    """High-level orchestrator around the Claude Code Python SDK."""

    def __init__(self) -> None:
        if CLAUDE_IMPORT_ERROR:
            raise RuntimeError(
                "claude_code_sdk is not available: " f"{CLAUDE_IMPORT_ERROR}"
            )

        self.shutdown_requested = False
        self.state = "idle"
        self.current_run: Optional[Dict[str, Any]] = None
        self.current_run_done_event: Optional[anyio.Event] = None
        self.task_group: Optional[anyio.abc.TaskGroup] = None
        self._options_signature = inspect.signature(ClaudeCodeOptions)  # type: ignore[arg-type]
        self.last_session_id: Optional[str] = None
        self.setup_signal_handlers()

    # ---------------------------------------------------------------------
    # Signal handling
    # ---------------------------------------------------------------------
    def setup_signal_handlers(self) -> None:
        signal.signal(signal.SIGTERM, self.signal_handler)
        signal.signal(signal.SIGINT, self.signal_handler)

    def signal_handler(self, signum: int, frame) -> None:  # pragma: no cover
        logger.info("Received signal %s, requesting shutdown", signum)
        self.shutdown_requested = True
        if self.current_run and self.current_run.get("cancel_scope") is not None:
            self.current_run["cancel_scope"].cancel()
        self.output_json(
            {
                "event": "signal",
                "state": "terminating",
                "signal": signum,
                "timestamp": datetime.utcnow().isoformat(),
            }
        )

    # ---------------------------------------------------------------------
    # JSON helpers
    # ---------------------------------------------------------------------
    def output_json(self, data: Dict[str, Any]) -> None:
        try:
            json_output = json.dumps(data, ensure_ascii=False, default=self._json_default)
            print(json_output, flush=True)
        except Exception:  # pragma: no cover - logging best effort
            logger.error("Failed to serialise JSON", exc_info=True)

    @staticmethod
    def _json_default(obj: Any) -> Any:
        if isinstance(obj, datetime):
            return obj.isoformat()
        if dataclasses.is_dataclass(obj):
            return dataclasses.asdict(obj)
        if isinstance(obj, (set, frozenset, tuple)):
            return list(obj)
        if hasattr(obj, "model_dump"):
            return obj.model_dump()  # type: ignore[misc]
        if hasattr(obj, "__dict__"):
            return {
                key: value
                for key, value in vars(obj).items()
                if not key.startswith("_")
            }
        return str(obj)

    # ---------------------------------------------------------------------
    # Option parsing
    # ---------------------------------------------------------------------
    def build_options(self, raw_options: Optional[Dict[str, Any]]) -> ClaudeCodeOptions:
        raw_options = raw_options or {}

        allowed_params = set(self._options_signature.parameters.keys()) - {"self"}
        filtered = {k: raw_options[k] for k in raw_options if k in allowed_params}

        # Support backward compatibility for "working_directory" alias
        if "cwd" not in filtered and "working_directory" in raw_options:
            filtered["cwd"] = raw_options["working_directory"]

        # Backwards compatibility for legacy permission modes
        legacy_permission_mode = filtered.get("permission_mode")
        if legacy_permission_mode == "acceptAll":
            logger.warning(
                "permission_mode 'acceptAll' is deprecated; using 'bypassPermissions'"
            )
            filtered["permission_mode"] = "bypassPermissions"

        # Persist session reuse when requested via "resume_session"
        if raw_options.get("resume_last_session") and self.last_session_id:
            filtered.setdefault("session_id", self.last_session_id)

        options = ClaudeCodeOptions(**filtered)  # type: ignore[call-arg]
        return options

    # ---------------------------------------------------------------------
    # Command handling
    # ---------------------------------------------------------------------
    async def handle_command(self, payload: Dict[str, Any]) -> None:
        action = payload.get("action")

        # Backwards compatibility with legacy schema
        if action is None and "command" in payload:
            action = "prompt"
            payload.setdefault("prompt", payload.get("command"))
            options = payload.setdefault("options", {})
            if "working_directory" in payload and "cwd" not in (options or {}):
                options["cwd"] = payload["working_directory"]

        if action == "prompt":
            await self.handle_prompt(payload)
        elif action == "cancel":
            await self.handle_cancel(payload)
        elif action == "status":
            self.output_status()
        elif action == "shutdown":
            logger.info("Shutdown command received")
            self.shutdown_requested = True
            if self.current_run and self.current_run.get("cancel_scope") is not None:
                self.current_run["cancel_scope"].cancel()
        else:
            self.output_json(
                {
                    "event": "error",
                    "timestamp": datetime.utcnow().isoformat(),
                    "error": "Unknown action",
                    "payload": action,
                }
            )

    async def handle_prompt(self, payload: Dict[str, Any]) -> None:
        if self.current_run is not None:
            self.output_json(
                {
                    "event": "error",
                    "timestamp": datetime.utcnow().isoformat(),
                    "error": "Agent is busy",
                    "state": self.state,
                    "active_run_id": self.current_run.get("id") if self.current_run else None,
                }
            )
            return

        prompt = payload.get("prompt")
        if not prompt:
            self.output_json(
                {
                    "event": "error",
                    "timestamp": datetime.utcnow().isoformat(),
                    "error": "Missing prompt",
                }
            )
            return

        run_id = payload.get("run_id") or str(uuid.uuid4())
        options_dict = payload.get("options") or {}

        try:
            options = self.build_options(options_dict)
        except Exception as exc:
            logger.exception("Failed to construct ClaudeCodeOptions")
            self.output_json(
                {
                    "event": "error",
                    "timestamp": datetime.utcnow().isoformat(),
                    "error": "Invalid ClaudeCodeOptions",
                    "details": str(exc),
                }
            )
            return

        run_context: Dict[str, Any] = {
            "id": run_id,
            "prompt_digest": prompt[:120],
            "options": options_dict,
            "started_at": datetime.utcnow().isoformat(),
            "state": "executing",
        }

        self.current_run_done_event = anyio.Event()
        self.current_run = run_context
        self.state = "executing"

        self.output_json(
            {
                "event": "run_started",
                "run_id": run_id,
                "timestamp": datetime.utcnow().isoformat(),
                "options": options_dict,
                "state": self.state,
            }
        )

        assert self.task_group is not None, "Task group not initialised"
        self.task_group.start_soon(self._run_query, run_context, prompt, options)

    async def handle_cancel(self, payload: Dict[str, Any]) -> None:
        requested_run_id = payload.get("run_id")
        if not self.current_run:
            self.output_json(
                {
                    "event": "cancel_ignored",
                    "reason": "no_active_run",
                    "timestamp": datetime.utcnow().isoformat(),
                    "requested_run_id": requested_run_id,
                }
            )
            return

        if requested_run_id and requested_run_id != self.current_run.get("id"):
            self.output_json(
                {
                    "event": "cancel_ignored",
                    "reason": "run_id_mismatch",
                    "timestamp": datetime.utcnow().isoformat(),
                    "requested_run_id": requested_run_id,
                    "active_run_id": self.current_run.get("id"),
                }
            )
            return

        cancel_scope = self.current_run.get("cancel_scope")
        if cancel_scope is None:
            self.output_json(
                {
                    "event": "cancel_ignored",
                    "reason": "not_cancellable",
                    "timestamp": datetime.utcnow().isoformat(),
                }
            )
            return

        cancel_scope.cancel()
        self.output_json(
            {
                "event": "cancel_requested",
                "timestamp": datetime.utcnow().isoformat(),
                "run_id": self.current_run.get("id"),
            }
        )

    def output_status(self) -> None:
        status_payload: Dict[str, Any] = {
            "event": "status",
            "timestamp": datetime.utcnow().isoformat(),
            "state": self.state,
            "last_session_id": self.last_session_id,
        }
        if self.current_run:
            status_payload["active_run"] = {
                key: value
                for key, value in self.current_run.items()
                if key not in {"cancel_scope"}
            }
        self.output_json(status_payload)

    # ---------------------------------------------------------------------
    # Claude Code execution
    # ---------------------------------------------------------------------
    async def _run_query(
        self,
        run_context: Dict[str, Any],
        prompt: str,
        options: ClaudeCodeOptions,
    ) -> None:
        cancel_scope: Optional[anyio.CancelScope] = None

        try:
            with anyio.CancelScope() as scope:
                cancel_scope = scope
                run_context["cancel_scope"] = scope

                async for message in query(prompt=prompt, options=options):  # type: ignore[misc]
                    serialised = self.serialise_message(message)
                    self.output_json(
                        {
                            "event": "stream",
                            "timestamp": datetime.utcnow().isoformat(),
                            "run_id": run_context["id"],
                            "payload": serialised,
                        }
                    )

                    # Capture session id when available
                    session_id = self._extract_session_id(serialised)
                    if session_id:
                        self.last_session_id = session_id
                        run_context["session_id"] = session_id

        except anyio.get_cancelled_exc_class():
            self.output_json(
                {
                    "event": "run_cancelled",
                    "timestamp": datetime.utcnow().isoformat(),
                    "run_id": run_context["id"],
                }
            )
        except ProcessError as exc:  # type: ignore[has-type]
            text = str(exc)
            if "EPIPE" in text or "Broken pipe" in text:
                logger.debug("Suppressing expected EPIPE from Claude CLI: %s", exc)
                self.output_json(
                    {
                        "event": "run_terminated",
                        "timestamp": datetime.utcnow().isoformat(),
                        "run_id": run_context["id"],
                        "reason": "broken_pipe",
                    }
                )
            else:
                logger.error("Claude Code process failed: %s", exc)
                self.output_json(
                    {
                        "event": "run_failed",
                        "timestamp": datetime.utcnow().isoformat(),
                        "run_id": run_context["id"],
                        "error": text,
                        "traceback": getattr(exc, "traceback", None),
                    }
                )
        except Exception as exc:  # pragma: no cover - defensive
            logger.error("Unexpected Claude Code failure", exc_info=True)
            self.output_json(
                {
                    "event": "run_failed",
                    "timestamp": datetime.utcnow().isoformat(),
                    "run_id": run_context["id"],
                    "error": str(exc),
                    "traceback": traceback.format_exc(limit=20),
                }
            )
        else:
            self.output_json(
                {
                    "event": "run_completed",
                    "timestamp": datetime.utcnow().isoformat(),
                    "run_id": run_context["id"],
                }
            )
        finally:
            if cancel_scope is not None:
                cancel_scope.cancel()  # ensure scope exits cleanly if still active

            if self.current_run is run_context:
                self.current_run = None
                self.state = "idle"

            if self.current_run_done_event is not None:
                self.current_run_done_event.set()

            self.output_json(
                {
                    "event": "state",
                    "timestamp": datetime.utcnow().isoformat(),
                    "state": self.state,
                    "last_session_id": self.last_session_id,
                }
            )

    def serialise_message(self, message: Any) -> Dict[str, Any]:
        if isinstance(message, dict):
            result = dict(message)
        elif dataclasses.is_dataclass(message):
            result = dataclasses.asdict(message)
        elif hasattr(message, "model_dump"):
            result = message.model_dump()  # type: ignore[misc]
        else:
            public_attrs = {
                key: getattr(message, key)
                for key in dir(message)
                if not key.startswith("_") and not callable(getattr(message, key))
            }
            result = public_attrs or {"repr": repr(message)}

        result.setdefault("message_type", getattr(message, "type", message.__class__.__name__))
        return result

    @staticmethod
    def _extract_session_id(serialised_message: Dict[str, Any]) -> Optional[str]:
        session_id = serialised_message.get("session_id")
        if isinstance(session_id, str):
            return session_id

        metadata = serialised_message.get("metadata")
        if isinstance(metadata, dict) and isinstance(metadata.get("session_id"), str):
            return metadata["session_id"]

        return None

    # ---------------------------------------------------------------------
    # Main loop
    # ---------------------------------------------------------------------
    async def run(self) -> None:
        logger.info("Claude Code wrapper started (SDK mode)")
        self.output_json(
            {
                "event": "ready",
                "timestamp": datetime.utcnow().isoformat(),
                "state": self.state,
            }
        )

        async with anyio.create_task_group() as task_group:
            self.task_group = task_group
            await self._command_loop()

        await self._await_run_completion()

        self.output_json(
            {
                "event": "shutdown",
                "timestamp": datetime.utcnow().isoformat(),
                "state": self.state,
                "last_session_id": self.last_session_id,
            }
        )
        logger.info("Claude Code wrapper shutdown complete")

    async def _command_loop(self) -> None:
        while not self.shutdown_requested:
            try:
                line = await anyio.to_thread.run_sync(sys.stdin.readline)
            except (OSError, RuntimeError):  # pragma: no cover - defensive
                logger.error("Failed to read from stdin", exc_info=True)
                break

            if line == "":
                logger.info("EOF detected on stdin")
                self.shutdown_requested = True
                break

            line = line.strip()
            if not line:
                continue

            try:
                payload = json.loads(line)
            except json.JSONDecodeError as exc:
                self.output_json(
                    {
                        "event": "error",
                        "timestamp": datetime.utcnow().isoformat(),
                        "error": "Invalid JSON payload",
                        "details": str(exc),
                        "raw": line,
                    }
                )
                continue

            await self.handle_command(payload)

        # Shut down gracefully when loop exits
        if self.current_run and self.current_run.get("cancel_scope") is not None:
            self.current_run["cancel_scope"].cancel()

    async def _await_run_completion(self) -> None:
        if self.current_run_done_event is not None:
            with anyio.move_on_after(5):
                await self.current_run_done_event.wait()

        # Give the underlying CLI process a brief moment to flush and exit.
        await anyio.sleep(0.2)


def main() -> None:
    if CLAUDE_IMPORT_ERROR:
        logger.error("claude_code_sdk import failed: %s", CLAUDE_IMPORT_ERROR)
        error_payload = {
            "event": "fatal",
            "timestamp": datetime.utcnow().isoformat(),
            "error": "claude_code_sdk import failed",
            "details": str(CLAUDE_IMPORT_ERROR),
        }
        print(json.dumps(error_payload, ensure_ascii=False), flush=True)
        sys.exit(1)

    try:
        wrapper = ClaudeCodeWrapper()
        anyio.run(wrapper.run)
    except Exception as exc:  # pragma: no cover - defensive
        logger.error("Fatal error in Claude wrapper", exc_info=True)
        error_payload = {
            "event": "fatal",
            "timestamp": datetime.utcnow().isoformat(),
            "error": str(exc),
            "traceback": traceback.format_exc(limit=20),
        }
        print(json.dumps(error_payload, ensure_ascii=False), flush=True)
        sys.exit(1)


if __name__ == "__main__":
    main()