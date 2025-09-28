#!/usr/bin/env python3
"""
Event Processor for Runtime Monitoring

Processes and analyzes captured Claude Code events for pattern detection and behavioral analysis.
Implements real-time event processing with pattern recognition capabilities.
"""

import json
import logging
import re
import statistics
from collections import defaultdict, deque
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional, Tuple, Set
from dataclasses import dataclass, asdict
from pathlib import Path
import asyncio
from enum import Enum

logger = logging.getLogger(__name__)


class EventType(Enum):
    """Enumeration of Claude Code event types."""
    STREAM = "stream"
    RUN_STARTED = "run_started"
    RUN_COMPLETED = "run_completed"
    RUN_FAILED = "run_failed"
    RUN_CANCELLED = "run_cancelled"
    TOOL_CALL = "tool_call"
    TOOL_RESULT = "tool_result"
    STATE_CHANGE = "state"
    ERROR = "error"
    SHUTDOWN = "shutdown"
    READY = "ready"


class ProcessingStage(Enum):
    """Event processing stages."""
    RAW = "raw"
    PARSED = "parsed"
    ANALYZED = "analyzed"
    CLASSIFIED = "classified"
    PATTERN_DETECTED = "pattern_detected"
    COMPLETED = "completed"
    ERROR = "error"


@dataclass
class ProcessedEvent:
    """Represents a processed event with extracted patterns and metadata."""

    original_event_id: str
    processing_id: str
    processing_timestamp: datetime
    event_type: EventType
    stage: ProcessingStage

    # Core data
    session_context: Dict[str, Any]
    content_analysis: Dict[str, Any]
    tool_analysis: Dict[str, Any]
    behavioral_patterns: List[str]

    # Pattern detection results
    completion_indicators: List[str]
    task_progression_signals: List[str]
    error_patterns: List[str]
    performance_metrics: Dict[str, Any]

    # Classification
    event_classification: str
    confidence_score: float
    processing_duration_ms: float


@dataclass
class PatternRule:
    """Defines a pattern detection rule."""

    name: str
    pattern_type: str  # regex, keyword, structural, temporal
    rule_definition: Dict[str, Any]
    confidence_weight: float
    required_context: List[str]
    description: str


class ContentAnalyzer:
    """Analyzes content structure and extracts meaningful patterns."""

    def __init__(self):
        self.completion_patterns = [
            r"all\s+\d+\s+tasks\s+are\s+completed",
            r"specification\s+is\s+fully\s+implemented",
            r"all\s+tasks\s+are\s+marked\s+as\s+completed",
            r"\d+\s+completed.*0\s+pending",
            r"specification\s+completed",
            r"implementation\s+complete",
            r"overall\s+status:\s+completed"
        ]

        self.task_patterns = [
            r"task\s+\d+.*(?:started|in\s+progress|completed)",
            r"implementing.*task",
            r"working\s+on\s+task",
            r"marking\s+task.*as\s+(?:completed|in.progress)"
        ]

        self.error_patterns = [
            r"error:.*",
            r"failed\s+to.*",
            r"exception.*",
            r"traceback.*",
            r"syntax\s+error"
        ]

        self.performance_patterns = [
            r"(?:took|duration|time):\s*(\d+(?:\.\d+)?)\s*(ms|seconds?|minutes?)",
            r"memory\s+usage:\s*(\d+(?:\.\d+)?)\s*(mb|gb|kb)",
            r"processed\s+(\d+)\s+(?:events|items|files)"
        ]

    def analyze_text_content(self, text: str) -> Dict[str, Any]:
        """Analyze text content for patterns and structure."""
        if not text or not isinstance(text, str):
            return {"text_length": 0, "patterns": {}}

        analysis = {
            "text_length": len(text),
            "word_count": len(text.split()),
            "line_count": len(text.split('\n')),
            "patterns": {
                "completion": self._find_patterns(text, self.completion_patterns),
                "task_progression": self._find_patterns(text, self.task_patterns),
                "errors": self._find_patterns(text, self.error_patterns),
                "performance": self._extract_performance_metrics(text)
            },
            "keywords": self._extract_keywords(text),
            "sentiment": self._analyze_sentiment(text),
            "technical_indicators": self._extract_technical_indicators(text)
        }

        return analysis

    def _find_patterns(self, text: str, patterns: List[str]) -> List[Dict[str, Any]]:
        """Find pattern matches in text."""
        matches = []
        text_lower = text.lower()

        for pattern in patterns:
            for match in re.finditer(pattern, text_lower, re.IGNORECASE | re.MULTILINE):
                matches.append({
                    "pattern": pattern,
                    "match": match.group(),
                    "position": match.span(),
                    "confidence": 0.8  # Base confidence for regex matches
                })

        return matches

    def _extract_performance_metrics(self, text: str) -> Dict[str, Any]:
        """Extract performance metrics from text."""
        metrics = {}

        for match in re.finditer(r"(?:took|duration|time):\s*(\d+(?:\.\d+)?)\s*(ms|seconds?|minutes?)",
                                text, re.IGNORECASE):
            value, unit = match.groups()
            metrics["execution_time"] = {
                "value": float(value),
                "unit": unit,
                "raw_match": match.group()
            }

        for match in re.finditer(r"memory\s+usage:\s*(\d+(?:\.\d+)?)\s*(mb|gb|kb)",
                                text, re.IGNORECASE):
            value, unit = match.groups()
            metrics["memory_usage"] = {
                "value": float(value),
                "unit": unit,
                "raw_match": match.group()
            }

        return metrics

    def _extract_keywords(self, text: str) -> List[str]:
        """Extract technical keywords and concepts."""
        # Common Claude Code and development keywords
        keywords_to_find = [
            "specification", "task", "implementation", "completed", "pending",
            "tool", "mcp", "workflow", "validation", "error", "success",
            "schema", "api", "endpoint", "database", "authentication",
            "testing", "deployment", "monitoring", "performance"
        ]

        found_keywords = []
        text_lower = text.lower()

        for keyword in keywords_to_find:
            if keyword in text_lower:
                # Count occurrences
                count = text_lower.count(keyword)
                found_keywords.append({
                    "keyword": keyword,
                    "count": count,
                    "relevance": min(count / 10.0, 1.0)  # Normalize relevance
                })

        return found_keywords

    def _analyze_sentiment(self, text: str) -> Dict[str, Any]:
        """Basic sentiment analysis for development context."""
        positive_indicators = ["completed", "success", "working", "implemented", "fixed", "resolved"]
        negative_indicators = ["failed", "error", "broken", "issue", "problem", "exception"]

        text_lower = text.lower()
        positive_count = sum(1 for word in positive_indicators if word in text_lower)
        negative_count = sum(1 for word in negative_indicators if word in text_lower)

        total_indicators = positive_count + negative_count
        if total_indicators == 0:
            sentiment = "neutral"
            confidence = 0.5
        else:
            sentiment_score = (positive_count - negative_count) / total_indicators
            if sentiment_score > 0.2:
                sentiment = "positive"
            elif sentiment_score < -0.2:
                sentiment = "negative"
            else:
                sentiment = "neutral"
            confidence = min(abs(sentiment_score) + 0.3, 1.0)

        return {
            "sentiment": sentiment,
            "confidence": confidence,
            "positive_indicators": positive_count,
            "negative_indicators": negative_count
        }

    def _extract_technical_indicators(self, text: str) -> Dict[str, Any]:
        """Extract technical indicators and stack information."""
        indicators = {}

        # Programming languages
        languages = ["python", "javascript", "typescript", "json", "yaml", "sql", "html", "css"]
        found_languages = [lang for lang in languages if lang in text.lower()]
        if found_languages:
            indicators["languages"] = found_languages

        # Frameworks and tools
        frameworks = ["react", "vue", "angular", "express", "fastapi", "django", "flask", "next.js"]
        found_frameworks = [fw for fw in frameworks if fw in text.lower()]
        if found_frameworks:
            indicators["frameworks"] = found_frameworks

        # File operations
        file_operations = []
        if re.search(r"read\s+file|reading\s+.*\.py|\.js|\.json", text, re.IGNORECASE):
            file_operations.append("file_read")
        if re.search(r"write\s+file|writing\s+to|creating\s+.*\.py|\.js|\.json", text, re.IGNORECASE):
            file_operations.append("file_write")
        if re.search(r"edit\s+file|editing|modifying", text, re.IGNORECASE):
            file_operations.append("file_edit")

        if file_operations:
            indicators["file_operations"] = file_operations

        return indicators


class ToolAnalyzer:
    """Analyzes tool usage patterns and behavior."""

    def __init__(self):
        self.mcp_tools = set()
        self.tool_usage_stats = defaultdict(int)
        self.tool_performance = defaultdict(list)

    def analyze_tool_usage(self, content: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Analyze tool usage from content array."""
        tool_analysis = {
            "tools_called": [],
            "tool_results": [],
            "mcp_tools_used": [],
            "tool_patterns": {},
            "performance_indicators": {}
        }

        for item in content:
            if not isinstance(item, dict):
                continue

            if item.get("type") == "tool_use":
                tool_info = self._analyze_tool_call(item)
                tool_analysis["tools_called"].append(tool_info)

                # Track MCP tools
                if tool_info["is_mcp_tool"]:
                    tool_analysis["mcp_tools_used"].append(tool_info["name"])
                    self.mcp_tools.add(tool_info["name"])

                # Update usage stats
                self.tool_usage_stats[tool_info["name"]] += 1

            elif item.get("type") == "tool_result":
                result_info = self._analyze_tool_result(item)
                tool_analysis["tool_results"].append(result_info)

        # Analyze patterns
        tool_analysis["tool_patterns"] = self._detect_tool_patterns(tool_analysis)

        return tool_analysis

    def _analyze_tool_call(self, tool_item: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze individual tool call."""
        tool_name = tool_item.get("name", "unknown")
        tool_input = tool_item.get("input", {})

        analysis = {
            "name": tool_name,
            "id": tool_item.get("id"),
            "is_mcp_tool": tool_name.startswith("mcp__"),
            "input_complexity": len(str(tool_input)),
            "input_keys": list(tool_input.keys()) if isinstance(tool_input, dict) else [],
            "tool_category": self._categorize_tool(tool_name),
            "estimated_performance_impact": self._estimate_performance_impact(tool_name, tool_input)
        }

        return analysis

    def _analyze_tool_result(self, result_item: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze tool result."""
        content = result_item.get("content", "")
        is_error = result_item.get("is_error", False)

        analysis = {
            "tool_use_id": result_item.get("tool_use_id"),
            "is_error": is_error,
            "content_type": type(content).__name__,
            "content_size": len(str(content)),
            "has_structured_data": self._has_structured_data(content),
            "success_indicators": self._extract_success_indicators(content) if not is_error else []
        }

        # Try to parse as JSON for structured analysis
        if isinstance(content, str) and content.strip().startswith('{'):
            try:
                parsed_content = json.loads(content)
                analysis["structured_content"] = self._analyze_structured_content(parsed_content)
            except json.JSONDecodeError:
                pass

        return analysis

    def _categorize_tool(self, tool_name: str) -> str:
        """Categorize tool by function."""
        if tool_name.startswith("mcp__"):
            if "spec-workflow" in tool_name:
                return "spec_workflow"
            elif "serena" in tool_name:
                return "code_analysis"
            elif "playwright" in tool_name:
                return "browser_automation"
            elif "context7" in tool_name:
                return "documentation"
            else:
                return "mcp_tool"

        # Built-in tools
        tool_categories = {
            "Read": "file_operation",
            "Write": "file_operation",
            "Edit": "file_operation",
            "MultiEdit": "file_operation",
            "Bash": "system_command",
            "Grep": "search",
            "Glob": "search",
            "TodoWrite": "task_management",
            "WebSearch": "information_retrieval",
            "WebFetch": "information_retrieval"
        }

        return tool_categories.get(tool_name, "unknown")

    def _estimate_performance_impact(self, tool_name: str, tool_input: Dict[str, Any]) -> str:
        """Estimate performance impact of tool call."""
        # High impact tools
        high_impact_tools = ["Bash", "WebSearch", "WebFetch"]
        if tool_name in high_impact_tools:
            return "high"

        # Medium impact for file operations with large content
        if tool_name in ["Write", "Edit", "MultiEdit"]:
            content_size = len(str(tool_input.get("content", "")))
            if content_size > 10000:  # Large content
                return "medium"

        # MCP tools generally have medium impact
        if tool_name.startswith("mcp__"):
            return "medium"

        return "low"

    def _has_structured_data(self, content: Any) -> bool:
        """Check if content contains structured data."""
        if isinstance(content, (dict, list)):
            return True

        if isinstance(content, str):
            content = content.strip()
            return (content.startswith('{') and content.endswith('}')) or \
                   (content.startswith('[') and content.endswith(']'))

        return False

    def _extract_success_indicators(self, content: Any) -> List[str]:
        """Extract success indicators from tool result."""
        indicators = []
        content_str = str(content).lower()

        success_patterns = [
            "success": True,
            "completed successfully",
            "operation completed",
            "file created successfully",
            "file updated",
            "command executed",
            "no errors"
        ]

        for pattern in success_patterns:
            if pattern in content_str:
                indicators.append(pattern)

        return indicators

    def _analyze_structured_content(self, content: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze structured JSON content."""
        analysis = {
            "keys": list(content.keys()) if isinstance(content, dict) else [],
            "has_success_field": "success" in content if isinstance(content, dict) else False,
            "has_data_field": "data" in content if isinstance(content, dict) else False,
            "has_error_field": "error" in content if isinstance(content, dict) else False,
            "nested_levels": self._count_nesting_levels(content)
        }

        # Check for spec-workflow specific structure
        if isinstance(content, dict):
            if "taskProgress" in str(content):
                analysis["is_spec_workflow_result"] = True
                analysis["task_progress_data"] = self._extract_task_progress(content)

            if content.get("success") and "data" in content:
                analysis["is_successful_api_response"] = True

        return analysis

    def _count_nesting_levels(self, obj: Any, current_level: int = 0) -> int:
        """Count maximum nesting levels in structured data."""
        if not isinstance(obj, (dict, list)):
            return current_level

        max_level = current_level

        if isinstance(obj, dict):
            for value in obj.values():
                level = self._count_nesting_levels(value, current_level + 1)
                max_level = max(max_level, level)
        elif isinstance(obj, list):
            for item in obj:
                level = self._count_nesting_levels(item, current_level + 1)
                max_level = max(max_level, level)

        return max_level

    def _extract_task_progress(self, content: Dict[str, Any]) -> Dict[str, Any]:
        """Extract task progress information from spec-workflow results."""
        task_data = {}

        # Navigate through nested structure to find task progress
        def search_for_task_progress(obj, path=""):
            if isinstance(obj, dict):
                if "taskProgress" in obj:
                    return obj["taskProgress"]
                for key, value in obj.items():
                    result = search_for_task_progress(value, f"{path}.{key}")
                    if result:
                        return result
            return None

        task_progress = search_for_task_progress(content)
        if task_progress:
            task_data = {
                "total": task_progress.get("total", 0),
                "completed": task_progress.get("completed", 0),
                "pending": task_progress.get("pending", 0),
                "completion_percentage": (task_progress.get("completed", 0) /
                                        max(task_progress.get("total", 1), 1)) * 100
            }

        return task_data

    def _detect_tool_patterns(self, tool_analysis: Dict[str, Any]) -> Dict[str, Any]:
        """Detect patterns in tool usage."""
        patterns = {}

        # Sequential tool usage patterns
        tool_sequence = [tool["name"] for tool in tool_analysis["tools_called"]]
        if len(tool_sequence) > 1:
            patterns["tool_sequence"] = tool_sequence
            patterns["sequence_length"] = len(tool_sequence)

            # Common sequences
            if "TodoWrite" in tool_sequence:
                patterns["uses_task_management"] = True
            if any("mcp__" in tool for tool in tool_sequence):
                patterns["uses_mcp_tools"] = True
            if "Bash" in tool_sequence:
                patterns["uses_system_commands"] = True

        # Tool success rate
        total_results = len(tool_analysis["tool_results"])
        error_results = sum(1 for result in tool_analysis["tool_results"] if result["is_error"])
        if total_results > 0:
            patterns["success_rate"] = (total_results - error_results) / total_results

        return patterns


class EventProcessor:
    """Main event processor with pattern detection and analysis."""

    def __init__(self, config: Optional[Dict[str, Any]] = None):
        self.config = config or {
            "max_processing_time_ms": 100,
            "enable_real_time_analysis": True,
            "pattern_detection_threshold": 0.7,
            "buffer_size": 1000
        }

        self.content_analyzer = ContentAnalyzer()
        self.tool_analyzer = ToolAnalyzer()

        # Processing state
        self.processed_events: deque = deque(maxlen=self.config.get("buffer_size", 1000))
        self.processing_stats = defaultdict(int)
        self.session_context = {}
        self.pattern_rules = self._load_pattern_rules()

    def _load_pattern_rules(self) -> List[PatternRule]:
        """Load pattern detection rules."""
        rules = [
            PatternRule(
                name="task_completion",
                pattern_type="regex",
                rule_definition={
                    "patterns": [
                        r"all\s+\d+\s+tasks\s+are\s+completed",
                        r"specification\s+is\s+fully\s+implemented"
                    ]
                },
                confidence_weight=0.9,
                required_context=["spec_workflow"],
                description="Detects task or specification completion"
            ),
            PatternRule(
                name="error_occurrence",
                pattern_type="keyword",
                rule_definition={
                    "keywords": ["error", "failed", "exception", "traceback"]
                },
                confidence_weight=0.8,
                required_context=[],
                description="Detects error conditions"
            ),
            PatternRule(
                name="tool_usage_burst",
                pattern_type="temporal",
                rule_definition={
                    "min_tools_per_second": 3,
                    "time_window_seconds": 10
                },
                confidence_weight=0.7,
                required_context=["tool_sequence"],
                description="Detects intensive tool usage periods"
            )
        ]
        return rules

    def process_event(self, raw_event: Dict[str, Any]) -> ProcessedEvent:
        """Process a single event and extract patterns."""
        start_time = datetime.utcnow()
        processing_id = f"proc_{int(start_time.timestamp() * 1000)}"

        try:
            # Determine event type
            event_type = self._classify_event_type(raw_event)

            # Extract session context
            session_context = self._extract_session_context(raw_event)

            # Analyze content
            content_analysis = self._analyze_event_content(raw_event)

            # Analyze tools
            tool_analysis = self._analyze_event_tools(raw_event)

            # Detect behavioral patterns
            behavioral_patterns = self._detect_behavioral_patterns(raw_event, content_analysis)

            # Extract specific indicators
            completion_indicators = self._extract_completion_indicators(content_analysis)
            task_progression = self._extract_task_progression_signals(content_analysis)
            error_patterns = self._extract_error_patterns(content_analysis)

            # Calculate performance metrics
            performance_metrics = self._calculate_performance_metrics(raw_event, tool_analysis)

            # Classify and score
            classification, confidence = self._classify_event(raw_event, content_analysis, tool_analysis)

            # Calculate processing duration
            processing_duration = (datetime.utcnow() - start_time).total_seconds() * 1000

            processed_event = ProcessedEvent(
                original_event_id=raw_event.get("event_id", "unknown"),
                processing_id=processing_id,
                processing_timestamp=start_time,
                event_type=event_type,
                stage=ProcessingStage.COMPLETED,
                session_context=session_context,
                content_analysis=content_analysis,
                tool_analysis=tool_analysis,
                behavioral_patterns=behavioral_patterns,
                completion_indicators=completion_indicators,
                task_progression_signals=task_progression,
                error_patterns=error_patterns,
                performance_metrics=performance_metrics,
                event_classification=classification,
                confidence_score=confidence,
                processing_duration_ms=processing_duration
            )

            # Store in buffer
            self.processed_events.append(processed_event)
            self.processing_stats["events_processed"] += 1

            logger.debug(f"Processed event {processing_id} in {processing_duration:.2f}ms")

            return processed_event

        except Exception as e:
            logger.error(f"Error processing event: {e}")

            # Return error event
            processing_duration = (datetime.utcnow() - start_time).total_seconds() * 1000

            return ProcessedEvent(
                original_event_id=raw_event.get("event_id", "unknown"),
                processing_id=processing_id,
                processing_timestamp=start_time,
                event_type=EventType.ERROR,
                stage=ProcessingStage.ERROR,
                session_context={},
                content_analysis={"error": str(e)},
                tool_analysis={},
                behavioral_patterns=[],
                completion_indicators=[],
                task_progression_signals=[],
                error_patterns=[f"processing_error: {str(e)}"],
                performance_metrics={},
                event_classification="processing_error",
                confidence_score=1.0,
                processing_duration_ms=processing_duration
            )

    def _classify_event_type(self, raw_event: Dict[str, Any]) -> EventType:
        """Classify the event type."""
        event_name = raw_event.get("event", "unknown")

        event_type_mapping = {
            "stream": EventType.STREAM,
            "run_started": EventType.RUN_STARTED,
            "run_completed": EventType.RUN_COMPLETED,
            "run_failed": EventType.RUN_FAILED,
            "run_cancelled": EventType.RUN_CANCELLED,
            "tool_call": EventType.TOOL_CALL,
            "tool_result": EventType.TOOL_RESULT,
            "state": EventType.STATE_CHANGE,
            "error": EventType.ERROR,
            "shutdown": EventType.SHUTDOWN,
            "ready": EventType.READY
        }

        return event_type_mapping.get(event_name, EventType.STREAM)

    def _extract_session_context(self, raw_event: Dict[str, Any]) -> Dict[str, Any]:
        """Extract session context from event."""
        return {
            "session_id": raw_event.get("session_id"),
            "run_id": raw_event.get("run_id"),
            "timestamp": raw_event.get("timestamp", datetime.utcnow().isoformat()),
            "event_source": "claude_code"
        }

    def _analyze_event_content(self, raw_event: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze event content structure."""
        if raw_event.get("event") != "stream":
            return {"content_type": "non_stream", "analysis": {}}

        payload = raw_event.get("payload", {})
        content = payload.get("content", [])

        if not isinstance(content, list):
            return {"content_type": "invalid", "analysis": {}}

        # Extract text content for analysis
        text_content = []
        for item in content:
            if isinstance(item, dict) and item.get("type") == "text":
                text_content.append(item.get("text", ""))

        combined_text = " ".join(text_content)

        # Analyze the text
        text_analysis = self.content_analyzer.analyze_text_content(combined_text)

        return {
            "content_type": "stream",
            "content_items": len(content),
            "text_analysis": text_analysis,
            "raw_content_structure": [
                {
                    "type": item.get("type", "unknown") if isinstance(item, dict) else type(item).__name__,
                    "size": len(str(item))
                }
                for item in content
            ]
        }

    def _analyze_event_tools(self, raw_event: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze tool usage in event."""
        if raw_event.get("event") != "stream":
            return {"has_tools": False}

        payload = raw_event.get("payload", {})
        content = payload.get("content", [])

        if not isinstance(content, list):
            return {"has_tools": False}

        return self.tool_analyzer.analyze_tool_usage(content)

    def _detect_behavioral_patterns(self, raw_event: Dict[str, Any],
                                  content_analysis: Dict[str, Any]) -> List[str]:
        """Detect behavioral patterns in the event."""
        patterns = []

        # Check against pattern rules
        for rule in self.pattern_rules:
            if self._matches_pattern_rule(raw_event, content_analysis, rule):
                patterns.append(rule.name)

        return patterns

    def _matches_pattern_rule(self, raw_event: Dict[str, Any],
                            content_analysis: Dict[str, Any],
                            rule: PatternRule) -> bool:
        """Check if event matches a specific pattern rule."""
        # Check required context
        for context_req in rule.required_context:
            if not self._has_required_context(raw_event, content_analysis, context_req):
                return False

        # Apply rule based on type
        if rule.pattern_type == "regex":
            return self._check_regex_rule(content_analysis, rule)
        elif rule.pattern_type == "keyword":
            return self._check_keyword_rule(content_analysis, rule)
        elif rule.pattern_type == "temporal":
            return self._check_temporal_rule(raw_event, rule)
        elif rule.pattern_type == "structural":
            return self._check_structural_rule(raw_event, rule)

        return False

    def _has_required_context(self, raw_event: Dict[str, Any],
                            content_analysis: Dict[str, Any],
                            context_req: str) -> bool:
        """Check if required context is present."""
        context_checks = {
            "spec_workflow": lambda: "spec-workflow" in str(raw_event).lower(),
            "tool_sequence": lambda: content_analysis.get("has_tools", False),
            "error_context": lambda: "error" in str(raw_event).lower()
        }

        check_func = context_checks.get(context_req)
        return check_func() if check_func else True

    def _check_regex_rule(self, content_analysis: Dict[str, Any], rule: PatternRule) -> bool:
        """Check regex pattern rule."""
        patterns = rule.rule_definition.get("patterns", [])
        text_analysis = content_analysis.get("text_analysis", {})
        found_patterns = text_analysis.get("patterns", {})

        # Check if any completion patterns were found
        completion_patterns = found_patterns.get("completion", [])
        return len(completion_patterns) > 0

    def _check_keyword_rule(self, content_analysis: Dict[str, Any], rule: PatternRule) -> bool:
        """Check keyword pattern rule."""
        keywords = rule.rule_definition.get("keywords", [])
        text_analysis = content_analysis.get("text_analysis", {})
        found_keywords = [kw["keyword"] for kw in text_analysis.get("keywords", [])]

        return any(keyword in found_keywords for keyword in keywords)

    def _check_temporal_rule(self, raw_event: Dict[str, Any], rule: PatternRule) -> bool:
        """Check temporal pattern rule."""
        # This would require maintaining time-series data
        # For now, return False as it needs more complex state tracking
        return False

    def _check_structural_rule(self, raw_event: Dict[str, Any], rule: PatternRule) -> bool:
        """Check structural pattern rule."""
        # Check event structure against rule
        required_fields = rule.rule_definition.get("required_fields", [])
        return all(field in raw_event for field in required_fields)

    def _extract_completion_indicators(self, content_analysis: Dict[str, Any]) -> List[str]:
        """Extract completion indicators from analysis."""
        indicators = []

        text_analysis = content_analysis.get("text_analysis", {})
        patterns = text_analysis.get("patterns", {})
        completion_patterns = patterns.get("completion", [])

        for pattern in completion_patterns:
            indicators.append(pattern.get("match", ""))

        return indicators

    def _extract_task_progression_signals(self, content_analysis: Dict[str, Any]) -> List[str]:
        """Extract task progression signals."""
        signals = []

        text_analysis = content_analysis.get("text_analysis", {})
        patterns = text_analysis.get("patterns", {})
        task_patterns = patterns.get("task_progression", [])

        for pattern in task_patterns:
            signals.append(pattern.get("match", ""))

        return signals

    def _extract_error_patterns(self, content_analysis: Dict[str, Any]) -> List[str]:
        """Extract error patterns."""
        patterns = []

        text_analysis = content_analysis.get("text_analysis", {})
        error_patterns = text_analysis.get("patterns", {}).get("errors", [])

        for pattern in error_patterns:
            patterns.append(pattern.get("match", ""))

        return patterns

    def _calculate_performance_metrics(self, raw_event: Dict[str, Any],
                                     tool_analysis: Dict[str, Any]) -> Dict[str, Any]:
        """Calculate performance metrics for the event."""
        metrics = {}

        # Tool performance
        if tool_analysis.get("tools_called"):
            metrics["tools_used_count"] = len(tool_analysis["tools_called"])

            # Estimate processing complexity
            complexity_score = 0
            for tool in tool_analysis["tools_called"]:
                if tool["estimated_performance_impact"] == "high":
                    complexity_score += 3
                elif tool["estimated_performance_impact"] == "medium":
                    complexity_score += 2
                else:
                    complexity_score += 1

            metrics["complexity_score"] = complexity_score

        # Content size metrics
        payload = raw_event.get("payload", {})
        content_size = len(str(payload))
        metrics["content_size_bytes"] = content_size

        if content_size > 10000:
            metrics["size_category"] = "large"
        elif content_size > 1000:
            metrics["size_category"] = "medium"
        else:
            metrics["size_category"] = "small"

        return metrics

    def _classify_event(self, raw_event: Dict[str, Any],
                       content_analysis: Dict[str, Any],
                       tool_analysis: Dict[str, Any]) -> Tuple[str, float]:
        """Classify the event and provide confidence score."""

        # Primary classification based on event type
        event_type = raw_event.get("event", "unknown")

        # Specific classifications
        if event_type == "stream":
            # Check for completion indicators
            completion_indicators = content_analysis.get("text_analysis", {}).get("patterns", {}).get("completion", [])
            if completion_indicators:
                return "completion_event", 0.9

            # Check for tool usage
            if tool_analysis.get("tools_called"):
                tool_count = len(tool_analysis["tools_called"])
                if tool_count >= 3:
                    return "intensive_tool_usage", 0.8
                else:
                    return "tool_usage", 0.7

            # Check for errors
            error_patterns = content_analysis.get("text_analysis", {}).get("patterns", {}).get("errors", [])
            if error_patterns:
                return "error_event", 0.8

            # Default stream classification
            text_length = content_analysis.get("text_analysis", {}).get("text_length", 0)
            if text_length > 500:
                return "substantial_output", 0.6
            else:
                return "routine_output", 0.5

        elif event_type.startswith("run_"):
            return f"lifecycle_{event_type}", 0.9

        else:
            return f"system_{event_type}", 0.7

    def get_processing_summary(self) -> Dict[str, Any]:
        """Get summary of processing statistics."""
        return {
            "total_events_processed": self.processing_stats["events_processed"],
            "events_in_buffer": len(self.processed_events),
            "buffer_capacity": self.processed_events.maxlen,
            "tool_usage_stats": dict(self.tool_analyzer.tool_usage_stats),
            "mcp_tools_discovered": list(self.tool_analyzer.mcp_tools),
            "config": self.config
        }

    def export_processed_events(self, output_file: Path) -> int:
        """Export processed events to file."""
        events_exported = 0

        with open(output_file, 'w') as f:
            for event in self.processed_events:
                try:
                    json.dump(asdict(event), f, default=str)
                    f.write('\n')
                    events_exported += 1
                except Exception as e:
                    logger.error(f"Failed to export event {event.processing_id}: {e}")

        logger.info(f"Exported {events_exported} processed events to {output_file}")
        return events_exported


# Factory function
def create_event_processor(config: Optional[Dict[str, Any]] = None) -> EventProcessor:
    """Create a configured event processor."""
    return EventProcessor(config)


if __name__ == "__main__":
    # Example usage
    import sys

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(levelname)s - %(message)s"
    )

    # Create processor
    processor = create_event_processor()

    # Example event processing
    sample_event = {
        "event": "stream",
        "event_id": "test-123",
        "timestamp": datetime.utcnow().isoformat(),
        "payload": {
            "content": [
                {
                    "type": "text",
                    "text": "All 10 tasks are completed and the specification is fully implemented."
                },
                {
                    "type": "tool_use",
                    "id": "tool-1",
                    "name": "mcp__spec-workflow__spec-status",
                    "input": {"projectPath": "/test"}
                }
            ]
        }
    }

    processed = processor.process_event(sample_event)
    print(f"Processed event classification: {processed.event_classification}")
    print(f"Completion indicators: {processed.completion_indicators}")
    print(f"Confidence: {processed.confidence_score}")

    # Get summary
    summary = processor.get_processing_summary()
    print(f"Processing summary: {summary}")