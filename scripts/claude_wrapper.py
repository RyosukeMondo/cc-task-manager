#!/usr/bin/env python3
"""
Claude Code SDK Wrapper Script

This script provides a bridge between Node.js worker processes and the Claude Code Python SDK.
It processes stdin prompts, invokes Claude Code SDK, and outputs structured JSON to stdout.
"""

import sys
import json
import signal
import asyncio
import logging
from typing import Dict, Any, Optional
from datetime import datetime
import subprocess
import os

# Configure logging to stderr only (never stdout to avoid JSON pollution)
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler(sys.stderr)]
)

logger = logging.getLogger(__name__)

class ClaudeCodeWrapper:
    """Wrapper class for Claude Code SDK integration."""
    
    def __init__(self):
        self.shutdown_requested = False
        self.current_process: Optional[subprocess.Popen] = None
        self.setup_signal_handlers()
    
    def setup_signal_handlers(self):
        """Setup signal handlers for graceful shutdown."""
        signal.signal(signal.SIGTERM, self.signal_handler)
        signal.signal(signal.SIGINT, self.signal_handler)
    
    def signal_handler(self, signum: int, frame):
        """Handle shutdown signals gracefully."""
        logger.info(f"Received signal {signum}, initiating graceful shutdown...")
        self.shutdown_requested = True
        
        if self.current_process and self.current_process.poll() is None:
            logger.info("Terminating current Claude Code process...")
            self.current_process.terminate()
            
            # Give process time to terminate gracefully
            try:
                self.current_process.wait(timeout=5)
                logger.info("Claude Code process terminated gracefully")
            except subprocess.TimeoutExpired:
                logger.warning("Process did not terminate gracefully, force killing...")
                self.current_process.kill()
                self.current_process.wait()
        
        self.output_json({
            "status": "shutdown",
            "timestamp": datetime.utcnow().isoformat(),
            "message": "Wrapper script shutdown initiated"
        })
        sys.exit(0)
    
    def output_json(self, data: Dict[str, Any]):
        """Output structured JSON to stdout."""
        try:
            json_output = json.dumps(data, ensure_ascii=False)
            print(json_output, flush=True)
        except Exception as e:
            logger.error(f"Failed to output JSON: {e}")
    
    def validate_input(self, input_data: Dict[str, Any]) -> bool:
        """Validate input data structure."""
        required_fields = ['command', 'working_directory']
        
        for field in required_fields:
            if field not in input_data:
                self.output_json({
                    "status": "error",
                    "timestamp": datetime.utcnow().isoformat(),
                    "error": f"Missing required field: {field}"
                })
                return False
        
        return True
    
    def execute_claude_code(self, command: str, working_directory: str, timeout: int = 300) -> Dict[str, Any]:
        """Execute Claude Code command and return structured result."""
        if self.shutdown_requested:
            return {
                "status": "error",
                "timestamp": datetime.utcnow().isoformat(),
                "error": "Shutdown requested, cannot execute command"
            }
        
        try:
            # Report start of execution
            self.output_json({
                "status": "started",
                "timestamp": datetime.utcnow().isoformat(),
                "message": "Claude Code execution started"
            })
            
            # Prepare environment
            env = os.environ.copy()
            
            # Execute Claude command
            # Always use 'claude --print' for non-interactive execution with the command as prompt
            # Use --dangerously-skip-permissions to bypass permission checks for automated execution
            cmd_args = ['claude', '--print', '--dangerously-skip-permissions', command]

            self.current_process = subprocess.Popen(
                cmd_args,
                cwd=working_directory,
                env=env,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                bufsize=1,
                universal_newlines=True
            )
            
            # Report process started
            self.output_json({
                "status": "running",
                "timestamp": datetime.utcnow().isoformat(),
                "pid": self.current_process.pid,
                "message": "Claude Code process started"
            })
            
            # Wait for completion with timeout
            try:
                stdout, stderr = self.current_process.communicate(timeout=timeout)
                return_code = self.current_process.returncode
                
                self.current_process = None
                
                # Determine status based on return code
                status = "completed" if return_code == 0 else "failed"
                
                result = {
                    "status": status,
                    "timestamp": datetime.utcnow().isoformat(),
                    "return_code": return_code,
                    "stdout_length": len(stdout) if stdout else 0,
                    "stderr_length": len(stderr) if stderr else 0,
                    "message": f"Claude Code execution {status}"
                }
                
                # Include stderr if there was an error (but not stdout to avoid logging sensitive data)
                if return_code != 0 and stderr:
                    result["error_output"] = stderr[:1000]  # Limit error output size
                
                return result
                
            except subprocess.TimeoutExpired:
                logger.warning(f"Claude Code process timed out after {timeout} seconds")
                self.current_process.kill()
                self.current_process.wait()
                self.current_process = None
                
                return {
                    "status": "timeout",
                    "timestamp": datetime.utcnow().isoformat(),
                    "error": f"Process timed out after {timeout} seconds"
                }
                
        except FileNotFoundError:
            return {
                "status": "error",
                "timestamp": datetime.utcnow().isoformat(),
                "error": "Claude CLI not found in PATH"
            }
        except Exception as e:
            logger.error(f"Unexpected error executing Claude Code: {e}")
            return {
                "status": "error",
                "timestamp": datetime.utcnow().isoformat(),
                "error": f"Unexpected error: {str(e)}"
            }
    
    def process_input(self, input_line: str) -> Optional[Dict[str, Any]]:
        """Process a single input line and return response."""
        try:
            input_data = json.loads(input_line.strip())
        except json.JSONDecodeError as e:
            return {
                "status": "error",
                "timestamp": datetime.utcnow().isoformat(),
                "error": f"Invalid JSON input: {e}"
            }
        
        if not self.validate_input(input_data):
            return None
        
        # Extract parameters
        command = input_data['command']
        working_directory = input_data.get('working_directory', '.')
        timeout = input_data.get('timeout', 300)
        
        # Log request (without sensitive prompt data)
        logger.info(f"Processing Claude Code request in directory: {working_directory}")
        
        # Execute Claude Code
        result = self.execute_claude_code(command, working_directory, timeout)
        
        return result
    
    def run(self):
        """Main execution loop."""
        logger.info("Claude Code wrapper started, waiting for input...")
        
        self.output_json({
            "status": "ready",
            "timestamp": datetime.utcnow().isoformat(),
            "message": "Claude Code wrapper ready for commands"
        })
        
        try:
            while not self.shutdown_requested:
                try:
                    # Read input from stdin
                    line = sys.stdin.readline()
                    
                    if not line:  # EOF
                        logger.info("EOF received, shutting down...")
                        break
                    
                    if line.strip() == "":
                        continue
                    
                    # Process input and output result
                    result = self.process_input(line)
                    if result:
                        self.output_json(result)
                        
                except KeyboardInterrupt:
                    logger.info("KeyboardInterrupt received")
                    break
                except Exception as e:
                    logger.error(f"Error processing input: {e}")
                    self.output_json({
                        "status": "error",
                        "timestamp": datetime.utcnow().isoformat(),
                        "error": f"Input processing error: {str(e)}"
                    })
        
        finally:
            self.output_json({
                "status": "shutdown",
                "timestamp": datetime.utcnow().isoformat(),
                "message": "Claude Code wrapper shutting down"
            })
            logger.info("Claude Code wrapper shutdown complete")

def main():
    """Main entry point."""
    try:
        wrapper = ClaudeCodeWrapper()
        wrapper.run()
        # Explicitly exit with success code
        sys.exit(0)
    except Exception as e:
        logger.error(f"Fatal error in wrapper: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()