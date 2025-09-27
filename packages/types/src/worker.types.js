"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TaskState = void 0;
var TaskState;
(function (TaskState) {
    TaskState["PENDING"] = "pending";
    TaskState["RUNNING"] = "running";
    TaskState["ACTIVE"] = "active";
    TaskState["IDLE"] = "idle";
    TaskState["COMPLETED"] = "completed";
    TaskState["FAILED"] = "failed";
    TaskState["CANCELLED"] = "cancelled";
})(TaskState || (exports.TaskState = TaskState = {}));
//# sourceMappingURL=worker.types.js.map