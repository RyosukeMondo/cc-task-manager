"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SortDirection = exports.TaskPriority = exports.ResultStatus = exports.MetricType = exports.LogSource = exports.LogLevel = exports.BackoffType = exports.AttemptStatus = exports.QueueJobStatus = exports.ExecutionStatus = exports.ClaudeTaskStatus = void 0;
var ClaudeTaskStatus;
(function (ClaudeTaskStatus) {
    ClaudeTaskStatus["PENDING"] = "PENDING";
    ClaudeTaskStatus["QUEUED"] = "QUEUED";
    ClaudeTaskStatus["RUNNING"] = "RUNNING";
    ClaudeTaskStatus["COMPLETED"] = "COMPLETED";
    ClaudeTaskStatus["FAILED"] = "FAILED";
    ClaudeTaskStatus["CANCELLED"] = "CANCELLED";
    ClaudeTaskStatus["PAUSED"] = "PAUSED";
})(ClaudeTaskStatus || (exports.ClaudeTaskStatus = ClaudeTaskStatus = {}));
var ExecutionStatus;
(function (ExecutionStatus) {
    ExecutionStatus["INITIALIZING"] = "INITIALIZING";
    ExecutionStatus["STARTING"] = "STARTING";
    ExecutionStatus["RUNNING"] = "RUNNING";
    ExecutionStatus["PAUSED"] = "PAUSED";
    ExecutionStatus["COMPLETED"] = "COMPLETED";
    ExecutionStatus["FAILED"] = "FAILED";
    ExecutionStatus["CANCELLED"] = "CANCELLED";
    ExecutionStatus["TIMEOUT"] = "TIMEOUT";
})(ExecutionStatus || (exports.ExecutionStatus = ExecutionStatus = {}));
var QueueJobStatus;
(function (QueueJobStatus) {
    QueueJobStatus["WAITING"] = "WAITING";
    QueueJobStatus["ACTIVE"] = "ACTIVE";
    QueueJobStatus["COMPLETED"] = "COMPLETED";
    QueueJobStatus["FAILED"] = "FAILED";
    QueueJobStatus["DELAYED"] = "DELAYED";
    QueueJobStatus["PAUSED"] = "PAUSED";
    QueueJobStatus["STUCK"] = "STUCK";
})(QueueJobStatus || (exports.QueueJobStatus = QueueJobStatus = {}));
var AttemptStatus;
(function (AttemptStatus) {
    AttemptStatus["PROCESSING"] = "PROCESSING";
    AttemptStatus["COMPLETED"] = "COMPLETED";
    AttemptStatus["FAILED"] = "FAILED";
    AttemptStatus["CANCELLED"] = "CANCELLED";
})(AttemptStatus || (exports.AttemptStatus = AttemptStatus = {}));
var BackoffType;
(function (BackoffType) {
    BackoffType["FIXED"] = "FIXED";
    BackoffType["EXPONENTIAL"] = "EXPONENTIAL";
    BackoffType["LINEAR"] = "LINEAR";
})(BackoffType || (exports.BackoffType = BackoffType = {}));
var LogLevel;
(function (LogLevel) {
    LogLevel["TRACE"] = "TRACE";
    LogLevel["DEBUG"] = "DEBUG";
    LogLevel["INFO"] = "INFO";
    LogLevel["WARN"] = "WARN";
    LogLevel["ERROR"] = "ERROR";
    LogLevel["FATAL"] = "FATAL";
})(LogLevel || (exports.LogLevel = LogLevel = {}));
var LogSource;
(function (LogSource) {
    LogSource["SYSTEM"] = "SYSTEM";
    LogSource["CLAUDE"] = "CLAUDE";
    LogSource["USER"] = "USER";
    LogSource["QUEUE"] = "QUEUE";
    LogSource["WORKER"] = "WORKER";
    LogSource["DATABASE"] = "DATABASE";
})(LogSource || (exports.LogSource = LogSource = {}));
var MetricType;
(function (MetricType) {
    MetricType["COUNTER"] = "COUNTER";
    MetricType["GAUGE"] = "GAUGE";
    MetricType["HISTOGRAM"] = "HISTOGRAM";
    MetricType["SUMMARY"] = "SUMMARY";
    MetricType["TIMER"] = "TIMER";
})(MetricType || (exports.MetricType = MetricType = {}));
var ResultStatus;
(function (ResultStatus) {
    ResultStatus["SUCCESS"] = "SUCCESS";
    ResultStatus["PARTIAL_SUCCESS"] = "PARTIAL_SUCCESS";
    ResultStatus["FAILURE"] = "FAILURE";
    ResultStatus["ERROR"] = "ERROR";
    ResultStatus["TIMEOUT"] = "TIMEOUT";
})(ResultStatus || (exports.ResultStatus = ResultStatus = {}));
var TaskPriority;
(function (TaskPriority) {
    TaskPriority["LOW"] = "LOW";
    TaskPriority["MEDIUM"] = "MEDIUM";
    TaskPriority["HIGH"] = "HIGH";
    TaskPriority["URGENT"] = "URGENT";
})(TaskPriority || (exports.TaskPriority = TaskPriority = {}));
var SortDirection;
(function (SortDirection) {
    SortDirection["ASC"] = "asc";
    SortDirection["DESC"] = "desc";
})(SortDirection || (exports.SortDirection = SortDirection = {}));
//# sourceMappingURL=claude-entities.js.map