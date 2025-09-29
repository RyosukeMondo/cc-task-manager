import { z } from 'zod';
export declare enum TaskPriority {
    LOW = "LOW",
    MEDIUM = "MEDIUM",
    HIGH = "HIGH",
    URGENT = "URGENT"
}
export declare enum TaskStatus {
    PENDING = "PENDING",
    RUNNING = "RUNNING",
    COMPLETED = "COMPLETED",
    FAILED = "FAILED",
    CANCELLED = "CANCELLED"
}
export declare const TaskConfigSchema: z.ZodObject<{
    timeout: z.ZodOptional<z.ZodNumber>;
    retryAttempts: z.ZodOptional<z.ZodNumber>;
    priority: z.ZodOptional<z.ZodNativeEnum<typeof TaskPriority>>;
}, "strict", z.ZodTypeAny, {
    priority?: TaskPriority;
    timeout?: number;
    retryAttempts?: number;
}, {
    priority?: TaskPriority;
    timeout?: number;
    retryAttempts?: number;
}>;
export declare const TaskUserSchema: z.ZodObject<{
    id: z.ZodString;
    username: z.ZodString;
    email: z.ZodString;
}, "strict", z.ZodTypeAny, {
    email?: string;
    id?: string;
    username?: string;
}, {
    email?: string;
    id?: string;
    username?: string;
}>;
export declare const TaskProjectSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
}, "strict", z.ZodTypeAny, {
    name?: string;
    id?: string;
}, {
    name?: string;
    id?: string;
}>;
export declare const CreateTaskSchema: z.ZodObject<{
    title: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    prompt: z.ZodString;
    config: z.ZodOptional<z.ZodObject<{
        timeout: z.ZodOptional<z.ZodNumber>;
        retryAttempts: z.ZodOptional<z.ZodNumber>;
        priority: z.ZodOptional<z.ZodNativeEnum<typeof TaskPriority>>;
    }, "strict", z.ZodTypeAny, {
        priority?: TaskPriority;
        timeout?: number;
        retryAttempts?: number;
    }, {
        priority?: TaskPriority;
        timeout?: number;
        retryAttempts?: number;
    }>>;
    projectId: z.ZodOptional<z.ZodString>;
    tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    scheduledAt: z.ZodOptional<z.ZodString>;
}, "strict", z.ZodTypeAny, {
    description?: string;
    tags?: string[];
    title?: string;
    projectId?: string;
    prompt?: string;
    config?: {
        priority?: TaskPriority;
        timeout?: number;
        retryAttempts?: number;
    };
    scheduledAt?: string;
}, {
    description?: string;
    tags?: string[];
    title?: string;
    projectId?: string;
    prompt?: string;
    config?: {
        priority?: TaskPriority;
        timeout?: number;
        retryAttempts?: number;
    };
    scheduledAt?: string;
}>;
export declare const UpdateTaskSchema: z.ZodObject<{
    title: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
    config: z.ZodOptional<z.ZodObject<{
        timeout: z.ZodOptional<z.ZodNumber>;
        retryAttempts: z.ZodOptional<z.ZodNumber>;
        priority: z.ZodOptional<z.ZodNativeEnum<typeof TaskPriority>>;
    }, "strict", z.ZodTypeAny, {
        priority?: TaskPriority;
        timeout?: number;
        retryAttempts?: number;
    }, {
        priority?: TaskPriority;
        timeout?: number;
        retryAttempts?: number;
    }>>;
    tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    scheduledAt: z.ZodOptional<z.ZodString>;
}, "strict", z.ZodTypeAny, {
    description?: string;
    tags?: string[];
    title?: string;
    config?: {
        priority?: TaskPriority;
        timeout?: number;
        retryAttempts?: number;
    };
    scheduledAt?: string;
}, {
    description?: string;
    tags?: string[];
    title?: string;
    config?: {
        priority?: TaskPriority;
        timeout?: number;
        retryAttempts?: number;
    };
    scheduledAt?: string;
}>;
export declare const TaskQuerySchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodNumber>;
    limit: z.ZodDefault<z.ZodNumber>;
    status: z.ZodOptional<z.ZodArray<z.ZodNativeEnum<typeof TaskStatus>, "many">>;
    priority: z.ZodOptional<z.ZodArray<z.ZodNativeEnum<typeof TaskPriority>, "many">>;
    projectId: z.ZodOptional<z.ZodString>;
    createdAfter: z.ZodOptional<z.ZodString>;
    createdBefore: z.ZodOptional<z.ZodString>;
    search: z.ZodOptional<z.ZodString>;
    sortBy: z.ZodDefault<z.ZodEnum<["createdAt", "updatedAt", "priority", "status", "title"]>>;
    sortOrder: z.ZodDefault<z.ZodEnum<["asc", "desc"]>>;
}, "strict", z.ZodTypeAny, {
    status?: TaskStatus[];
    priority?: TaskPriority[];
    projectId?: string;
    search?: string;
    page?: number;
    limit?: number;
    sortBy?: "status" | "title" | "createdAt" | "updatedAt" | "priority";
    sortOrder?: "asc" | "desc";
    createdAfter?: string;
    createdBefore?: string;
}, {
    status?: TaskStatus[];
    priority?: TaskPriority[];
    projectId?: string;
    search?: string;
    page?: number;
    limit?: number;
    sortBy?: "status" | "title" | "createdAt" | "updatedAt" | "priority";
    sortOrder?: "asc" | "desc";
    createdAfter?: string;
    createdBefore?: string;
}>;
export declare const TaskResponseSchema: z.ZodObject<{
    id: z.ZodString;
    title: z.ZodString;
    description: z.ZodNullable<z.ZodString>;
    prompt: z.ZodString;
    status: z.ZodNativeEnum<typeof TaskStatus>;
    priority: z.ZodNativeEnum<typeof TaskPriority>;
    progress: z.ZodNullable<z.ZodNumber>;
    config: z.ZodNullable<z.ZodObject<{
        timeout: z.ZodOptional<z.ZodNumber>;
        retryAttempts: z.ZodOptional<z.ZodNumber>;
        priority: z.ZodOptional<z.ZodNativeEnum<typeof TaskPriority>>;
    }, "strict", z.ZodTypeAny, {
        priority?: TaskPriority;
        timeout?: number;
        retryAttempts?: number;
    }, {
        priority?: TaskPriority;
        timeout?: number;
        retryAttempts?: number;
    }>>;
    createdBy: z.ZodObject<{
        id: z.ZodString;
        username: z.ZodString;
        email: z.ZodString;
    }, "strict", z.ZodTypeAny, {
        email?: string;
        id?: string;
        username?: string;
    }, {
        email?: string;
        id?: string;
        username?: string;
    }>;
    project: z.ZodNullable<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
    }, "strict", z.ZodTypeAny, {
        name?: string;
        id?: string;
    }, {
        name?: string;
        id?: string;
    }>>;
    tags: z.ZodArray<z.ZodString, "many">;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
    scheduledAt: z.ZodNullable<z.ZodString>;
    startedAt: z.ZodNullable<z.ZodString>;
    completedAt: z.ZodNullable<z.ZodString>;
    estimatedDuration: z.ZodNullable<z.ZodNumber>;
    actualDuration: z.ZodNullable<z.ZodNumber>;
    errorMessage: z.ZodNullable<z.ZodString>;
    retryCount: z.ZodDefault<z.ZodNumber>;
}, "strict", z.ZodTypeAny, {
    description?: string;
    status?: TaskStatus;
    tags?: string[];
    title?: string;
    id?: string;
    createdAt?: string;
    updatedAt?: string;
    priority?: TaskPriority;
    completedAt?: string;
    createdBy?: {
        email?: string;
        id?: string;
        username?: string;
    };
    project?: {
        name?: string;
        id?: string;
    };
    startedAt?: string;
    retryCount?: number;
    progress?: number;
    errorMessage?: string;
    prompt?: string;
    config?: {
        priority?: TaskPriority;
        timeout?: number;
        retryAttempts?: number;
    };
    scheduledAt?: string;
    estimatedDuration?: number;
    actualDuration?: number;
}, {
    description?: string;
    status?: TaskStatus;
    tags?: string[];
    title?: string;
    id?: string;
    createdAt?: string;
    updatedAt?: string;
    priority?: TaskPriority;
    completedAt?: string;
    createdBy?: {
        email?: string;
        id?: string;
        username?: string;
    };
    project?: {
        name?: string;
        id?: string;
    };
    startedAt?: string;
    retryCount?: number;
    progress?: number;
    errorMessage?: string;
    prompt?: string;
    config?: {
        priority?: TaskPriority;
        timeout?: number;
        retryAttempts?: number;
    };
    scheduledAt?: string;
    estimatedDuration?: number;
    actualDuration?: number;
}>;
export declare const PaginatedTaskResponseSchema: z.ZodObject<{
    data: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        title: z.ZodString;
        description: z.ZodNullable<z.ZodString>;
        prompt: z.ZodString;
        status: z.ZodNativeEnum<typeof TaskStatus>;
        priority: z.ZodNativeEnum<typeof TaskPriority>;
        progress: z.ZodNullable<z.ZodNumber>;
        config: z.ZodNullable<z.ZodObject<{
            timeout: z.ZodOptional<z.ZodNumber>;
            retryAttempts: z.ZodOptional<z.ZodNumber>;
            priority: z.ZodOptional<z.ZodNativeEnum<typeof TaskPriority>>;
        }, "strict", z.ZodTypeAny, {
            priority?: TaskPriority;
            timeout?: number;
            retryAttempts?: number;
        }, {
            priority?: TaskPriority;
            timeout?: number;
            retryAttempts?: number;
        }>>;
        createdBy: z.ZodObject<{
            id: z.ZodString;
            username: z.ZodString;
            email: z.ZodString;
        }, "strict", z.ZodTypeAny, {
            email?: string;
            id?: string;
            username?: string;
        }, {
            email?: string;
            id?: string;
            username?: string;
        }>;
        project: z.ZodNullable<z.ZodObject<{
            id: z.ZodString;
            name: z.ZodString;
        }, "strict", z.ZodTypeAny, {
            name?: string;
            id?: string;
        }, {
            name?: string;
            id?: string;
        }>>;
        tags: z.ZodArray<z.ZodString, "many">;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
        scheduledAt: z.ZodNullable<z.ZodString>;
        startedAt: z.ZodNullable<z.ZodString>;
        completedAt: z.ZodNullable<z.ZodString>;
        estimatedDuration: z.ZodNullable<z.ZodNumber>;
        actualDuration: z.ZodNullable<z.ZodNumber>;
        errorMessage: z.ZodNullable<z.ZodString>;
        retryCount: z.ZodDefault<z.ZodNumber>;
    }, "strict", z.ZodTypeAny, {
        description?: string;
        status?: TaskStatus;
        tags?: string[];
        title?: string;
        id?: string;
        createdAt?: string;
        updatedAt?: string;
        priority?: TaskPriority;
        completedAt?: string;
        createdBy?: {
            email?: string;
            id?: string;
            username?: string;
        };
        project?: {
            name?: string;
            id?: string;
        };
        startedAt?: string;
        retryCount?: number;
        progress?: number;
        errorMessage?: string;
        prompt?: string;
        config?: {
            priority?: TaskPriority;
            timeout?: number;
            retryAttempts?: number;
        };
        scheduledAt?: string;
        estimatedDuration?: number;
        actualDuration?: number;
    }, {
        description?: string;
        status?: TaskStatus;
        tags?: string[];
        title?: string;
        id?: string;
        createdAt?: string;
        updatedAt?: string;
        priority?: TaskPriority;
        completedAt?: string;
        createdBy?: {
            email?: string;
            id?: string;
            username?: string;
        };
        project?: {
            name?: string;
            id?: string;
        };
        startedAt?: string;
        retryCount?: number;
        progress?: number;
        errorMessage?: string;
        prompt?: string;
        config?: {
            priority?: TaskPriority;
            timeout?: number;
            retryAttempts?: number;
        };
        scheduledAt?: string;
        estimatedDuration?: number;
        actualDuration?: number;
    }>, "many">;
    pagination: z.ZodObject<{
        page: z.ZodNumber;
        limit: z.ZodNumber;
        total: z.ZodNumber;
        totalPages: z.ZodNumber;
        hasNext: z.ZodBoolean;
        hasPrev: z.ZodBoolean;
    }, "strict", z.ZodTypeAny, {
        total?: number;
        page?: number;
        limit?: number;
        totalPages?: number;
        hasNext?: boolean;
        hasPrev?: boolean;
    }, {
        total?: number;
        page?: number;
        limit?: number;
        totalPages?: number;
        hasNext?: boolean;
        hasPrev?: boolean;
    }>;
}, "strict", z.ZodTypeAny, {
    data?: {
        description?: string;
        status?: TaskStatus;
        tags?: string[];
        title?: string;
        id?: string;
        createdAt?: string;
        updatedAt?: string;
        priority?: TaskPriority;
        completedAt?: string;
        createdBy?: {
            email?: string;
            id?: string;
            username?: string;
        };
        project?: {
            name?: string;
            id?: string;
        };
        startedAt?: string;
        retryCount?: number;
        progress?: number;
        errorMessage?: string;
        prompt?: string;
        config?: {
            priority?: TaskPriority;
            timeout?: number;
            retryAttempts?: number;
        };
        scheduledAt?: string;
        estimatedDuration?: number;
        actualDuration?: number;
    }[];
    pagination?: {
        total?: number;
        page?: number;
        limit?: number;
        totalPages?: number;
        hasNext?: boolean;
        hasPrev?: boolean;
    };
}, {
    data?: {
        description?: string;
        status?: TaskStatus;
        tags?: string[];
        title?: string;
        id?: string;
        createdAt?: string;
        updatedAt?: string;
        priority?: TaskPriority;
        completedAt?: string;
        createdBy?: {
            email?: string;
            id?: string;
            username?: string;
        };
        project?: {
            name?: string;
            id?: string;
        };
        startedAt?: string;
        retryCount?: number;
        progress?: number;
        errorMessage?: string;
        prompt?: string;
        config?: {
            priority?: TaskPriority;
            timeout?: number;
            retryAttempts?: number;
        };
        scheduledAt?: string;
        estimatedDuration?: number;
        actualDuration?: number;
    }[];
    pagination?: {
        total?: number;
        page?: number;
        limit?: number;
        totalPages?: number;
        hasNext?: boolean;
        hasPrev?: boolean;
    };
}>;
export declare const TaskStatusUpdateSchema: z.ZodObject<{
    status: z.ZodNativeEnum<typeof TaskStatus>;
    progress: z.ZodOptional<z.ZodNumber>;
    errorMessage: z.ZodOptional<z.ZodString>;
}, "strict", z.ZodTypeAny, {
    status?: TaskStatus;
    progress?: number;
    errorMessage?: string;
}, {
    status?: TaskStatus;
    progress?: number;
    errorMessage?: string;
}>;
export declare const BulkTaskOperationSchema: z.ZodObject<{
    taskIds: z.ZodArray<z.ZodString, "many">;
    operation: z.ZodEnum<["delete", "cancel", "retry"]>;
    config: z.ZodOptional<z.ZodObject<{
        force: z.ZodDefault<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        force?: boolean;
    }, {
        force?: boolean;
    }>>;
}, "strict", z.ZodTypeAny, {
    taskIds?: string[];
    operation?: "delete" | "retry" | "cancel";
    config?: {
        force?: boolean;
    };
}, {
    taskIds?: string[];
    operation?: "delete" | "retry" | "cancel";
    config?: {
        force?: boolean;
    };
}>;
export declare const TaskMetricsSchema: z.ZodObject<{
    totalTasks: z.ZodNumber;
    completedTasks: z.ZodNumber;
    failedTasks: z.ZodNumber;
    averageDuration: z.ZodNullable<z.ZodNumber>;
    successRate: z.ZodNumber;
}, "strict", z.ZodTypeAny, {
    totalTasks?: number;
    completedTasks?: number;
    failedTasks?: number;
    successRate?: number;
    averageDuration?: number;
}, {
    totalTasks?: number;
    completedTasks?: number;
    failedTasks?: number;
    successRate?: number;
    averageDuration?: number;
}>;
export type CreateTaskDto = z.infer<typeof CreateTaskSchema>;
export type UpdateTaskDto = z.infer<typeof UpdateTaskSchema>;
export type TaskQueryDto = z.infer<typeof TaskQuerySchema>;
export type TaskResponseDto = z.infer<typeof TaskResponseSchema>;
export type PaginatedTaskResponseDto = z.infer<typeof PaginatedTaskResponseSchema>;
export type TaskStatusUpdateDto = z.infer<typeof TaskStatusUpdateSchema>;
export type BulkTaskOperationDto = z.infer<typeof BulkTaskOperationSchema>;
export type TaskMetricsDto = z.infer<typeof TaskMetricsSchema>;
export declare const validateCreateTask: (data: unknown) => {
    description?: string;
    tags?: string[];
    title?: string;
    projectId?: string;
    prompt?: string;
    config?: {
        priority?: TaskPriority;
        timeout?: number;
        retryAttempts?: number;
    };
    scheduledAt?: string;
};
export declare const validateUpdateTask: (data: unknown) => {
    description?: string;
    tags?: string[];
    title?: string;
    config?: {
        priority?: TaskPriority;
        timeout?: number;
        retryAttempts?: number;
    };
    scheduledAt?: string;
};
export declare const validateTaskQuery: (data: unknown) => {
    status?: TaskStatus[];
    priority?: TaskPriority[];
    projectId?: string;
    search?: string;
    page?: number;
    limit?: number;
    sortBy?: "status" | "title" | "createdAt" | "updatedAt" | "priority";
    sortOrder?: "asc" | "desc";
    createdAfter?: string;
    createdBefore?: string;
};
export declare const validateTaskResponse: (data: unknown) => {
    description?: string;
    status?: TaskStatus;
    tags?: string[];
    title?: string;
    id?: string;
    createdAt?: string;
    updatedAt?: string;
    priority?: TaskPriority;
    completedAt?: string;
    createdBy?: {
        email?: string;
        id?: string;
        username?: string;
    };
    project?: {
        name?: string;
        id?: string;
    };
    startedAt?: string;
    retryCount?: number;
    progress?: number;
    errorMessage?: string;
    prompt?: string;
    config?: {
        priority?: TaskPriority;
        timeout?: number;
        retryAttempts?: number;
    };
    scheduledAt?: string;
    estimatedDuration?: number;
    actualDuration?: number;
};
export declare const validateTaskStatusUpdate: (data: unknown) => {
    status?: TaskStatus;
    progress?: number;
    errorMessage?: string;
};
export declare const validateBulkTaskOperation: (data: unknown) => {
    taskIds?: string[];
    operation?: "delete" | "retry" | "cancel";
    config?: {
        force?: boolean;
    };
};
export declare const safeParseCreateTask: (data: unknown) => z.SafeParseReturnType<{
    description?: string;
    tags?: string[];
    title?: string;
    projectId?: string;
    prompt?: string;
    config?: {
        priority?: TaskPriority;
        timeout?: number;
        retryAttempts?: number;
    };
    scheduledAt?: string;
}, {
    description?: string;
    tags?: string[];
    title?: string;
    projectId?: string;
    prompt?: string;
    config?: {
        priority?: TaskPriority;
        timeout?: number;
        retryAttempts?: number;
    };
    scheduledAt?: string;
}>;
export declare const safeParseUpdateTask: (data: unknown) => z.SafeParseReturnType<{
    description?: string;
    tags?: string[];
    title?: string;
    config?: {
        priority?: TaskPriority;
        timeout?: number;
        retryAttempts?: number;
    };
    scheduledAt?: string;
}, {
    description?: string;
    tags?: string[];
    title?: string;
    config?: {
        priority?: TaskPriority;
        timeout?: number;
        retryAttempts?: number;
    };
    scheduledAt?: string;
}>;
export declare const safeParseTaskQuery: (data: unknown) => z.SafeParseReturnType<{
    status?: TaskStatus[];
    priority?: TaskPriority[];
    projectId?: string;
    search?: string;
    page?: number;
    limit?: number;
    sortBy?: "status" | "title" | "createdAt" | "updatedAt" | "priority";
    sortOrder?: "asc" | "desc";
    createdAfter?: string;
    createdBefore?: string;
}, {
    status?: TaskStatus[];
    priority?: TaskPriority[];
    projectId?: string;
    search?: string;
    page?: number;
    limit?: number;
    sortBy?: "status" | "title" | "createdAt" | "updatedAt" | "priority";
    sortOrder?: "asc" | "desc";
    createdAfter?: string;
    createdBefore?: string;
}>;
export declare const CreateTaskSchemaWithBusinessRules: z.ZodEffects<z.ZodObject<{
    title: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    prompt: z.ZodString;
    config: z.ZodOptional<z.ZodObject<{
        timeout: z.ZodOptional<z.ZodNumber>;
        retryAttempts: z.ZodOptional<z.ZodNumber>;
        priority: z.ZodOptional<z.ZodNativeEnum<typeof TaskPriority>>;
    }, "strict", z.ZodTypeAny, {
        priority?: TaskPriority;
        timeout?: number;
        retryAttempts?: number;
    }, {
        priority?: TaskPriority;
        timeout?: number;
        retryAttempts?: number;
    }>>;
    projectId: z.ZodOptional<z.ZodString>;
    tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    scheduledAt: z.ZodOptional<z.ZodString>;
}, "strict", z.ZodTypeAny, {
    description?: string;
    tags?: string[];
    title?: string;
    projectId?: string;
    prompt?: string;
    config?: {
        priority?: TaskPriority;
        timeout?: number;
        retryAttempts?: number;
    };
    scheduledAt?: string;
}, {
    description?: string;
    tags?: string[];
    title?: string;
    projectId?: string;
    prompt?: string;
    config?: {
        priority?: TaskPriority;
        timeout?: number;
        retryAttempts?: number;
    };
    scheduledAt?: string;
}>, {
    description?: string;
    tags?: string[];
    title?: string;
    projectId?: string;
    prompt?: string;
    config?: {
        priority?: TaskPriority;
        timeout?: number;
        retryAttempts?: number;
    };
    scheduledAt?: string;
}, {
    description?: string;
    tags?: string[];
    title?: string;
    projectId?: string;
    prompt?: string;
    config?: {
        priority?: TaskPriority;
        timeout?: number;
        retryAttempts?: number;
    };
    scheduledAt?: string;
}>;
export declare const UpdateTaskSchemaWithBusinessRules: z.ZodEffects<z.ZodObject<{
    title: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
    config: z.ZodOptional<z.ZodObject<{
        timeout: z.ZodOptional<z.ZodNumber>;
        retryAttempts: z.ZodOptional<z.ZodNumber>;
        priority: z.ZodOptional<z.ZodNativeEnum<typeof TaskPriority>>;
    }, "strict", z.ZodTypeAny, {
        priority?: TaskPriority;
        timeout?: number;
        retryAttempts?: number;
    }, {
        priority?: TaskPriority;
        timeout?: number;
        retryAttempts?: number;
    }>>;
    tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    scheduledAt: z.ZodOptional<z.ZodString>;
}, "strict", z.ZodTypeAny, {
    description?: string;
    tags?: string[];
    title?: string;
    config?: {
        priority?: TaskPriority;
        timeout?: number;
        retryAttempts?: number;
    };
    scheduledAt?: string;
}, {
    description?: string;
    tags?: string[];
    title?: string;
    config?: {
        priority?: TaskPriority;
        timeout?: number;
        retryAttempts?: number;
    };
    scheduledAt?: string;
}>, {
    description?: string;
    tags?: string[];
    title?: string;
    config?: {
        priority?: TaskPriority;
        timeout?: number;
        retryAttempts?: number;
    };
    scheduledAt?: string;
}, {
    description?: string;
    tags?: string[];
    title?: string;
    config?: {
        priority?: TaskPriority;
        timeout?: number;
        retryAttempts?: number;
    };
    scheduledAt?: string;
}>;
