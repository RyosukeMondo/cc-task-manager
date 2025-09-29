"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateTaskSchemaWithBusinessRules = exports.CreateTaskSchemaWithBusinessRules = exports.safeParseTaskQuery = exports.safeParseUpdateTask = exports.safeParseCreateTask = exports.validateBulkTaskOperation = exports.validateTaskStatusUpdate = exports.validateTaskResponse = exports.validateTaskQuery = exports.validateUpdateTask = exports.validateCreateTask = exports.TaskMetricsSchema = exports.BulkTaskOperationSchema = exports.TaskStatusUpdateSchema = exports.PaginatedTaskResponseSchema = exports.TaskResponseSchema = exports.TaskQuerySchema = exports.UpdateTaskSchema = exports.CreateTaskSchema = exports.TaskProjectSchema = exports.TaskUserSchema = exports.TaskConfigSchema = exports.TaskStatus = exports.TaskPriority = void 0;
const zod_1 = require("zod");
var TaskPriority;
(function (TaskPriority) {
    TaskPriority["LOW"] = "LOW";
    TaskPriority["MEDIUM"] = "MEDIUM";
    TaskPriority["HIGH"] = "HIGH";
    TaskPriority["URGENT"] = "URGENT";
})(TaskPriority || (exports.TaskPriority = TaskPriority = {}));
var TaskStatus;
(function (TaskStatus) {
    TaskStatus["PENDING"] = "PENDING";
    TaskStatus["RUNNING"] = "RUNNING";
    TaskStatus["COMPLETED"] = "COMPLETED";
    TaskStatus["FAILED"] = "FAILED";
    TaskStatus["CANCELLED"] = "CANCELLED";
})(TaskStatus || (exports.TaskStatus = TaskStatus = {}));
exports.TaskConfigSchema = zod_1.z.object({
    timeout: zod_1.z.number().int().min(1).max(3600).optional(),
    retryAttempts: zod_1.z.number().int().min(0).max(5).optional(),
    priority: zod_1.z.nativeEnum(TaskPriority).optional()
}).strict();
exports.TaskUserSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    username: zod_1.z.string(),
    email: zod_1.z.string().email()
}).strict();
exports.TaskProjectSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    name: zod_1.z.string()
}).strict();
exports.CreateTaskSchema = zod_1.z.object({
    title: zod_1.z.string().min(1, 'Title is required').max(200, 'Title must be 200 characters or less'),
    description: zod_1.z.string().max(1000, 'Description must be 1000 characters or less').optional(),
    prompt: zod_1.z.string().min(1, 'Prompt is required').max(10000, 'Prompt must be 10000 characters or less'),
    config: exports.TaskConfigSchema.optional(),
    projectId: zod_1.z.string().uuid('Invalid project ID format').optional(),
    tags: zod_1.z.array(zod_1.z.string().max(50, 'Tag must be 50 characters or less')).max(10, 'Maximum 10 tags allowed').optional(),
    scheduledAt: zod_1.z.string().datetime('Invalid datetime format').optional()
}).strict();
exports.UpdateTaskSchema = zod_1.z.object({
    title: zod_1.z.string().min(1, 'Title cannot be empty').max(200, 'Title must be 200 characters or less').optional(),
    description: zod_1.z.string().max(1000, 'Description must be 1000 characters or less').optional(),
    config: exports.TaskConfigSchema.optional(),
    tags: zod_1.z.array(zod_1.z.string().max(50, 'Tag must be 50 characters or less')).max(10, 'Maximum 10 tags allowed').optional(),
    scheduledAt: zod_1.z.string().datetime('Invalid datetime format').optional()
}).strict();
exports.TaskQuerySchema = zod_1.z.object({
    page: zod_1.z.number().int().min(1, 'Page must be at least 1').default(1),
    limit: zod_1.z.number().int().min(1, 'Limit must be at least 1').max(100, 'Limit cannot exceed 100').default(20),
    status: zod_1.z.array(zod_1.z.nativeEnum(TaskStatus)).optional(),
    priority: zod_1.z.array(zod_1.z.nativeEnum(TaskPriority)).optional(),
    projectId: zod_1.z.string().uuid('Invalid project ID format').optional(),
    createdAfter: zod_1.z.string().datetime('Invalid datetime format').optional(),
    createdBefore: zod_1.z.string().datetime('Invalid datetime format').optional(),
    search: zod_1.z.string().max(100, 'Search term must be 100 characters or less').optional(),
    sortBy: zod_1.z.enum(['createdAt', 'updatedAt', 'priority', 'status', 'title']).default('createdAt'),
    sortOrder: zod_1.z.enum(['asc', 'desc']).default('desc')
}).strict();
exports.TaskResponseSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    title: zod_1.z.string(),
    description: zod_1.z.string().nullable(),
    prompt: zod_1.z.string(),
    status: zod_1.z.nativeEnum(TaskStatus),
    priority: zod_1.z.nativeEnum(TaskPriority),
    progress: zod_1.z.number().min(0).max(1).nullable(),
    config: exports.TaskConfigSchema.nullable(),
    createdBy: exports.TaskUserSchema,
    project: exports.TaskProjectSchema.nullable(),
    tags: zod_1.z.array(zod_1.z.string()),
    createdAt: zod_1.z.string().datetime(),
    updatedAt: zod_1.z.string().datetime(),
    scheduledAt: zod_1.z.string().datetime().nullable(),
    startedAt: zod_1.z.string().datetime().nullable(),
    completedAt: zod_1.z.string().datetime().nullable(),
    estimatedDuration: zod_1.z.number().min(0).nullable(),
    actualDuration: zod_1.z.number().min(0).nullable(),
    errorMessage: zod_1.z.string().nullable(),
    retryCount: zod_1.z.number().int().min(0).default(0)
}).strict();
exports.PaginatedTaskResponseSchema = zod_1.z.object({
    data: zod_1.z.array(exports.TaskResponseSchema),
    pagination: zod_1.z.object({
        page: zod_1.z.number().int(),
        limit: zod_1.z.number().int(),
        total: zod_1.z.number().int(),
        totalPages: zod_1.z.number().int(),
        hasNext: zod_1.z.boolean(),
        hasPrev: zod_1.z.boolean()
    }).strict()
}).strict();
exports.TaskStatusUpdateSchema = zod_1.z.object({
    status: zod_1.z.nativeEnum(TaskStatus),
    progress: zod_1.z.number().min(0).max(1).optional(),
    errorMessage: zod_1.z.string().optional()
}).strict();
exports.BulkTaskOperationSchema = zod_1.z.object({
    taskIds: zod_1.z.array(zod_1.z.string().uuid()).min(1, 'At least one task ID required').max(100, 'Maximum 100 tasks per operation'),
    operation: zod_1.z.enum(['delete', 'cancel', 'retry']),
    config: zod_1.z.object({
        force: zod_1.z.boolean().default(false)
    }).optional()
}).strict();
exports.TaskMetricsSchema = zod_1.z.object({
    totalTasks: zod_1.z.number().int().min(0),
    completedTasks: zod_1.z.number().int().min(0),
    failedTasks: zod_1.z.number().int().min(0),
    averageDuration: zod_1.z.number().min(0).nullable(),
    successRate: zod_1.z.number().min(0).max(1)
}).strict();
const validateCreateTask = (data) => {
    return exports.CreateTaskSchema.parse(data);
};
exports.validateCreateTask = validateCreateTask;
const validateUpdateTask = (data) => {
    return exports.UpdateTaskSchema.parse(data);
};
exports.validateUpdateTask = validateUpdateTask;
const validateTaskQuery = (data) => {
    return exports.TaskQuerySchema.parse(data);
};
exports.validateTaskQuery = validateTaskQuery;
const validateTaskResponse = (data) => {
    return exports.TaskResponseSchema.parse(data);
};
exports.validateTaskResponse = validateTaskResponse;
const validateTaskStatusUpdate = (data) => {
    return exports.TaskStatusUpdateSchema.parse(data);
};
exports.validateTaskStatusUpdate = validateTaskStatusUpdate;
const validateBulkTaskOperation = (data) => {
    return exports.BulkTaskOperationSchema.parse(data);
};
exports.validateBulkTaskOperation = validateBulkTaskOperation;
const safeParseCreateTask = (data) => {
    return exports.CreateTaskSchema.safeParse(data);
};
exports.safeParseCreateTask = safeParseCreateTask;
const safeParseUpdateTask = (data) => {
    return exports.UpdateTaskSchema.safeParse(data);
};
exports.safeParseUpdateTask = safeParseUpdateTask;
const safeParseTaskQuery = (data) => {
    return exports.TaskQuerySchema.safeParse(data);
};
exports.safeParseTaskQuery = safeParseTaskQuery;
exports.CreateTaskSchemaWithBusinessRules = exports.CreateTaskSchema.refine((data) => {
    if (data.scheduledAt) {
        const scheduledDate = new Date(data.scheduledAt);
        return scheduledDate > new Date();
    }
    return true;
}, {
    message: 'Scheduled time must be in the future',
    path: ['scheduledAt']
});
exports.UpdateTaskSchemaWithBusinessRules = exports.UpdateTaskSchema.refine((data) => {
    if (data.scheduledAt) {
        const scheduledDate = new Date(data.scheduledAt);
        return scheduledDate > new Date();
    }
    return true;
}, {
    message: 'Scheduled time must be in the future',
    path: ['scheduledAt']
});
//# sourceMappingURL=task-schemas.js.map