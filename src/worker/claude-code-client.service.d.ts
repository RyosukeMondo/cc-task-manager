import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ChildProcess } from 'child_process';
import { z } from 'zod';
import { ClaudeCodeOptionsSchema } from '../config/worker.config';
export declare const ClaudeCodePromptPayloadSchema: z.ZodObject<{
    action: z.ZodLiteral<"prompt">;
    prompt: z.ZodString;
    options: z.ZodOptional<z.ZodObject<{
        cwd: z.ZodOptional<z.ZodString>;
        permission_mode: z.ZodOptional<z.ZodEnum<["bypassPermissions", "default", "plan", "acceptEdits"]>>;
        timeout: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodUnknown, z.objectOutputType<{
        cwd: z.ZodOptional<z.ZodString>;
        permission_mode: z.ZodOptional<z.ZodEnum<["bypassPermissions", "default", "plan", "acceptEdits"]>>;
        timeout: z.ZodOptional<z.ZodNumber>;
    }, z.ZodUnknown, "strip">, z.objectInputType<{
        cwd: z.ZodOptional<z.ZodString>;
        permission_mode: z.ZodOptional<z.ZodEnum<["bypassPermissions", "default", "plan", "acceptEdits"]>>;
        timeout: z.ZodOptional<z.ZodNumber>;
    }, z.ZodUnknown, "strip">>>;
    run_id: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    options?: {
        timeout?: number;
        permission_mode?: "bypassPermissions" | "default" | "plan" | "acceptEdits";
        cwd?: string;
    } & {
        [k: string]: unknown;
    };
    prompt?: string;
    action?: "prompt";
    run_id?: string;
}, {
    options?: {
        timeout?: number;
        permission_mode?: "bypassPermissions" | "default" | "plan" | "acceptEdits";
        cwd?: string;
    } & {
        [k: string]: unknown;
    };
    prompt?: string;
    action?: "prompt";
    run_id?: string;
}>;
export declare const ClaudeCodeEventSchema: z.ZodObject<{
    event: z.ZodString;
    timestamp: z.ZodOptional<z.ZodString>;
    run_id: z.ZodOptional<z.ZodString>;
    state: z.ZodOptional<z.ZodString>;
    status: z.ZodOptional<z.ZodString>;
    message: z.ZodOptional<z.ZodString>;
    reason: z.ZodOptional<z.ZodString>;
    outcome: z.ZodOptional<z.ZodString>;
    tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    version: z.ZodOptional<z.ZodNumber>;
    error: z.ZodOptional<z.ZodString>;
    error_output: z.ZodOptional<z.ZodString>;
    payload: z.ZodOptional<z.ZodUnknown>;
    return_code: z.ZodOptional<z.ZodNumber>;
    returnCode: z.ZodOptional<z.ZodNumber>;
    pid: z.ZodOptional<z.ZodNumber>;
    stdout_length: z.ZodOptional<z.ZodNumber>;
    stderr_length: z.ZodOptional<z.ZodNumber>;
    details: z.ZodOptional<z.ZodUnknown>;
}, "strip", z.ZodUnknown, z.objectOutputType<{
    event: z.ZodString;
    timestamp: z.ZodOptional<z.ZodString>;
    run_id: z.ZodOptional<z.ZodString>;
    state: z.ZodOptional<z.ZodString>;
    status: z.ZodOptional<z.ZodString>;
    message: z.ZodOptional<z.ZodString>;
    reason: z.ZodOptional<z.ZodString>;
    outcome: z.ZodOptional<z.ZodString>;
    tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    version: z.ZodOptional<z.ZodNumber>;
    error: z.ZodOptional<z.ZodString>;
    error_output: z.ZodOptional<z.ZodString>;
    payload: z.ZodOptional<z.ZodUnknown>;
    return_code: z.ZodOptional<z.ZodNumber>;
    returnCode: z.ZodOptional<z.ZodNumber>;
    pid: z.ZodOptional<z.ZodNumber>;
    stdout_length: z.ZodOptional<z.ZodNumber>;
    stderr_length: z.ZodOptional<z.ZodNumber>;
    details: z.ZodOptional<z.ZodUnknown>;
}, z.ZodUnknown, "strip">, z.objectInputType<{
    event: z.ZodString;
    timestamp: z.ZodOptional<z.ZodString>;
    run_id: z.ZodOptional<z.ZodString>;
    state: z.ZodOptional<z.ZodString>;
    status: z.ZodOptional<z.ZodString>;
    message: z.ZodOptional<z.ZodString>;
    reason: z.ZodOptional<z.ZodString>;
    outcome: z.ZodOptional<z.ZodString>;
    tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    version: z.ZodOptional<z.ZodNumber>;
    error: z.ZodOptional<z.ZodString>;
    error_output: z.ZodOptional<z.ZodString>;
    payload: z.ZodOptional<z.ZodUnknown>;
    return_code: z.ZodOptional<z.ZodNumber>;
    returnCode: z.ZodOptional<z.ZodNumber>;
    pid: z.ZodOptional<z.ZodNumber>;
    stdout_length: z.ZodOptional<z.ZodNumber>;
    stderr_length: z.ZodOptional<z.ZodNumber>;
    details: z.ZodOptional<z.ZodUnknown>;
}, z.ZodUnknown, "strip">>;
export type ClaudeCodePromptPayload = z.infer<typeof ClaudeCodePromptPayloadSchema>;
export type ClaudeCodeEvent = z.infer<typeof ClaudeCodeEventSchema>;
export type ClaudeCodeOptions = z.infer<typeof ClaudeCodeOptionsSchema>;
export type LegacyStatus = 'ready' | 'started' | 'running' | 'completed' | 'failed' | 'timeout' | 'error' | 'shutdown';
export interface ParsedResponse {
    success: boolean;
    event: string | null;
    data?: ClaudeCodeEvent & {
        status?: LegacyStatus;
        return_code?: number;
    };
    error?: string;
    correlationId: string;
    runId?: string | null;
    status?: LegacyStatus | null;
    returnCode?: number | null;
}
export interface NormalizedEvent {
    event: string;
    runId: string | null;
    timestamp?: string;
    outcome?: string | null;
    reason?: string | null;
    tags?: string[];
    message?: string;
    status?: LegacyStatus | null;
    returnCode?: number | null;
}
export declare enum ErrorCode {
    VALIDATION_SCHEMA_FAILED = "VALIDATION_SCHEMA_FAILED",
    VALIDATION_REQUIRED_FIELD = "VALIDATION_REQUIRED_FIELD",
    VALIDATION_INVALID_FORMAT = "VALIDATION_INVALID_FORMAT",
    PROCESS_SPAWN_FAILED = "PROCESS_SPAWN_FAILED",
    PROCESS_COMMUNICATION_FAILED = "PROCESS_COMMUNICATION_FAILED",
    PROCESS_TERMINATED_UNEXPECTEDLY = "PROCESS_TERMINATED_UNEXPECTEDLY",
    PROCESS_PERMISSION_DENIED = "PROCESS_PERMISSION_DENIED",
    TIMEOUT_EXECUTION = "TIMEOUT_EXECUTION",
    TIMEOUT_GRACEFUL_SHUTDOWN = "TIMEOUT_GRACEFUL_SHUTDOWN",
    TIMEOUT_INACTIVITY = "TIMEOUT_INACTIVITY",
    SDK_CONFIGURATION_INVALID = "SDK_CONFIGURATION_INVALID",
    SDK_RESPONSE_PARSE_FAILED = "SDK_RESPONSE_PARSE_FAILED",
    SDK_CONNECTION_FAILED = "SDK_CONNECTION_FAILED",
    UNKNOWN_ERROR = "UNKNOWN_ERROR",
    INTERNAL_ERROR = "INTERNAL_ERROR"
}
export interface StructuredError {
    type: 'validation' | 'process' | 'timeout' | 'sdk' | 'unknown';
    code: ErrorCode;
    message: string;
    details?: any;
    correlationId: string;
    timestamp: Date;
    recoverable?: boolean;
    retryAfter?: number;
}
export declare class ClaudeCodeClientService {
    private readonly configService;
    private readonly eventEmitter;
    private readonly logger;
    private readonly workerConfig;
    constructor(configService: ConfigService, eventEmitter: EventEmitter2);
    sendPrompt(process: ChildProcess, prompt: string, options: ClaudeCodeOptions, correlationId?: string, workingDirectory?: string, runId?: string): Promise<void>;
    parseResponse(jsonOutput: string, correlationId?: string): ParsedResponse;
    toNormalizedEvent(response: ParsedResponse): NormalizedEvent | null;
    handleError(errorData: {
        type?: string;
        code?: ErrorCode;
        message: string;
        details?: any;
        correlationId?: string;
        timestamp?: Date;
        recoverable?: boolean;
        retryAfter?: number;
    }): StructuredError;
    private categorizeError;
    private getTypeFromCode;
    private detectTypeFromMessage;
    private detectCodeFromMessage;
    private isRecoverableError;
    validateConfiguration(options: ClaudeCodeOptions, correlationId?: string): {
        valid: boolean;
        errors?: string[];
    };
    isSuccessResponse(response: ParsedResponse): boolean;
    isFailureResponse(response: ParsedResponse): boolean;
    extractErrorMessage(response: ParsedResponse): string | undefined;
}
