"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var ClaudeCodeClientService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClaudeCodeClientService = exports.ErrorCode = exports.ClaudeCodeEventSchema = exports.ClaudeCodePromptPayloadSchema = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const event_emitter_1 = require("@nestjs/event-emitter");
const crypto_1 = require("crypto");
const zod_1 = require("zod");
const worker_config_1 = require("../config/worker.config");
const PromptOptionsSchema = zod_1.z
    .object({
    cwd: zod_1.z.string().optional(),
    permission_mode: zod_1.z
        .enum(['bypassPermissions', 'default', 'plan', 'acceptEdits'])
        .optional(),
    timeout: zod_1.z.number().positive().optional(),
})
    .catchall(zod_1.z.unknown());
exports.ClaudeCodePromptPayloadSchema = zod_1.z.object({
    action: zod_1.z.literal('prompt'),
    prompt: zod_1.z.string().min(1, 'Prompt is required'),
    options: PromptOptionsSchema.optional(),
    run_id: zod_1.z.string().optional(),
});
exports.ClaudeCodeEventSchema = zod_1.z
    .object({
    event: zod_1.z.string(),
    timestamp: zod_1.z.string().optional(),
    run_id: zod_1.z.string().optional(),
    state: zod_1.z.string().optional(),
    status: zod_1.z.string().optional(),
    message: zod_1.z.string().optional(),
    reason: zod_1.z.string().optional(),
    outcome: zod_1.z.string().optional(),
    tags: zod_1.z.array(zod_1.z.string()).optional(),
    version: zod_1.z.number().optional(),
    error: zod_1.z.string().optional(),
    error_output: zod_1.z.string().optional(),
    payload: zod_1.z.unknown().optional(),
    return_code: zod_1.z.number().optional(),
    returnCode: zod_1.z.number().optional(),
    pid: zod_1.z.number().optional(),
    stdout_length: zod_1.z.number().optional(),
    stderr_length: zod_1.z.number().optional(),
    details: zod_1.z.unknown().optional(),
})
    .catchall(zod_1.z.unknown());
const LEGACY_STATUS_VALUES = [
    'ready',
    'started',
    'running',
    'completed',
    'failed',
    'timeout',
    'error',
    'shutdown',
];
const EVENT_STATUS_MAP = {
    ready: { status: 'ready' },
    run_started: { status: 'started' },
    stream: { status: 'running' },
    run_completed: { status: 'completed', returnCode: 0 },
    run_failed: { status: 'failed', returnCode: 1 },
    run_cancelled: { status: 'failed', returnCode: 1 },
    run_terminated: { status: 'error' },
    cancel_requested: { status: 'running' },
    cancel_ignored: { status: 'error' },
    signal: { status: 'error' },
    error: { status: 'error' },
    fatal: { status: 'error', returnCode: 1 },
    timeout: { status: 'timeout', returnCode: 1 },
    run_timeout: { status: 'timeout', returnCode: 1 },
    state: { status: 'running' },
    shutdown: { status: 'shutdown' },
};
const isLegacyStatus = (value) => typeof value === 'string' && LEGACY_STATUS_VALUES.includes(value);
class OutcomeStatusStrategy {
    derive(data) {
        const outcome = data.outcome;
        if (typeof outcome !== 'string') {
            return null;
        }
        const normalizedOutcome = outcome.toLowerCase();
        switch (normalizedOutcome) {
            case 'completed':
                return { status: 'completed', returnCode: 0 };
            case 'failed':
                return { status: 'failed', returnCode: 1 };
            case 'timeout':
                return { status: 'timeout', returnCode: 1 };
            case 'shutdown':
                return { status: 'shutdown' };
            case 'terminated':
                return { status: 'error' };
            case 'running':
                return { status: 'running' };
            default:
                return null;
        }
    }
}
class EventStatusStrategy {
    derive(data, event) {
        if (!event) {
            return null;
        }
        const mapping = EVENT_STATUS_MAP[event];
        if (!mapping) {
            return null;
        }
        if (mapping.status === 'failed' && data.reason === 'timeout') {
            return { status: 'timeout', returnCode: mapping.returnCode ?? 1 };
        }
        return mapping;
    }
}
class StateStatusStrategy {
    derive(data) {
        if (typeof data.state !== 'string') {
            return null;
        }
        const normalizedState = data.state.trim().toLowerCase();
        switch (normalizedState) {
            case 'idle':
                return { status: 'running' };
            case 'completed':
                return { status: 'completed', returnCode: 0 };
            case 'failed':
                return { status: 'failed', returnCode: 1 };
            case 'timeout':
                return { status: 'timeout', returnCode: 1 };
            case 'shutdown':
                return { status: 'shutdown' };
            default:
                return { status: 'running' };
        }
    }
}
class LegacyStatusStrategy {
    derive(data) {
        if (isLegacyStatus(data.status)) {
            return {
                status: data.status,
                returnCode: this.inferReturnCode(data.status)
            };
        }
        if (data.payload && typeof data.payload === 'object') {
            const payloadRecord = data.payload;
            const payloadStatus = payloadRecord.status;
            if (isLegacyStatus(payloadStatus)) {
                return {
                    status: payloadStatus,
                    returnCode: this.inferReturnCode(payloadStatus)
                };
            }
        }
        return null;
    }
    inferReturnCode(status) {
        switch (status) {
            case 'completed':
                return 0;
            case 'failed':
            case 'timeout':
            case 'error':
                return 1;
            default:
                return undefined;
        }
    }
}
class ReasonStatusStrategy {
    derive(data) {
        if (data.reason === 'timeout') {
            return { status: 'timeout', returnCode: 1 };
        }
        return null;
    }
}
class StatusDerivationOrchestrator {
    constructor() {
        this.strategies = [
            new OutcomeStatusStrategy(),
            new EventStatusStrategy(),
            new StateStatusStrategy(),
            new LegacyStatusStrategy(),
            new ReasonStatusStrategy()
        ];
    }
    derive(event, data) {
        for (const strategy of this.strategies) {
            const result = strategy.derive(data, event);
            if (result !== null) {
                return result;
            }
        }
        return { status: null };
    }
}
const statusDerivationOrchestrator = new StatusDerivationOrchestrator();
const deriveStatus = (event, data) => {
    return statusDerivationOrchestrator.derive(event, data);
};
var ErrorCode;
(function (ErrorCode) {
    ErrorCode["VALIDATION_SCHEMA_FAILED"] = "VALIDATION_SCHEMA_FAILED";
    ErrorCode["VALIDATION_REQUIRED_FIELD"] = "VALIDATION_REQUIRED_FIELD";
    ErrorCode["VALIDATION_INVALID_FORMAT"] = "VALIDATION_INVALID_FORMAT";
    ErrorCode["PROCESS_SPAWN_FAILED"] = "PROCESS_SPAWN_FAILED";
    ErrorCode["PROCESS_COMMUNICATION_FAILED"] = "PROCESS_COMMUNICATION_FAILED";
    ErrorCode["PROCESS_TERMINATED_UNEXPECTEDLY"] = "PROCESS_TERMINATED_UNEXPECTEDLY";
    ErrorCode["PROCESS_PERMISSION_DENIED"] = "PROCESS_PERMISSION_DENIED";
    ErrorCode["TIMEOUT_EXECUTION"] = "TIMEOUT_EXECUTION";
    ErrorCode["TIMEOUT_GRACEFUL_SHUTDOWN"] = "TIMEOUT_GRACEFUL_SHUTDOWN";
    ErrorCode["TIMEOUT_INACTIVITY"] = "TIMEOUT_INACTIVITY";
    ErrorCode["SDK_CONFIGURATION_INVALID"] = "SDK_CONFIGURATION_INVALID";
    ErrorCode["SDK_RESPONSE_PARSE_FAILED"] = "SDK_RESPONSE_PARSE_FAILED";
    ErrorCode["SDK_CONNECTION_FAILED"] = "SDK_CONNECTION_FAILED";
    ErrorCode["UNKNOWN_ERROR"] = "UNKNOWN_ERROR";
    ErrorCode["INTERNAL_ERROR"] = "INTERNAL_ERROR";
})(ErrorCode || (exports.ErrorCode = ErrorCode = {}));
let ClaudeCodeClientService = ClaudeCodeClientService_1 = class ClaudeCodeClientService {
    constructor(configService, eventEmitter) {
        this.configService = configService;
        this.eventEmitter = eventEmitter;
        this.logger = new common_1.Logger(ClaudeCodeClientService_1.name);
        this.workerConfig = this.configService.get('worker');
    }
    async sendPrompt(process, prompt, options, correlationId = (0, crypto_1.randomUUID)(), workingDirectory, runId) {
        try {
            if (!process.stdin || !process.stdin.writable) {
                throw new Error('Process stdin is not available or writable');
            }
            const optionsPayload = {
                ...(options || {}),
                timeout: options?.timeout ?? Math.floor(this.workerConfig.processTimeoutMs / 1000) ?? 300,
                cwd: workingDirectory ??
                    this.workerConfig.wrapperWorkingDir ??
                    globalThis.process.cwd(),
                permission_mode: options?.permission_mode ?? 'bypassPermissions',
            };
            const payload = exports.ClaudeCodePromptPayloadSchema.parse({
                action: 'prompt',
                prompt,
                options: optionsPayload,
                run_id: runId,
            });
            this.logger.log('Sending prompt to Claude Code process', {
                correlationId,
                pid: process.pid,
                runId: payload.run_id,
                promptLength: payload.prompt.length,
                workingDirectory: optionsPayload.cwd,
                permissionMode: optionsPayload.permission_mode,
                timeout: optionsPayload.timeout,
            });
            const jsonInput = JSON.stringify(payload);
            process.stdin.write(jsonInput + '\n');
            this.eventEmitter.emit('claude.prompt.sent', {
                correlationId,
                pid: process.pid,
                runId: payload.run_id,
                timestamp: new Date(),
            });
        }
        catch (error) {
            const structuredError = this.handleError({
                type: 'process',
                code: ErrorCode.PROCESS_COMMUNICATION_FAILED,
                message: error instanceof Error ? error.message : 'Unknown error sending prompt',
                details: error,
                correlationId,
                timestamp: new Date(),
                recoverable: true,
                retryAfter: 5000,
            });
            this.logger.error('Failed to send prompt to Claude Code process', {
                correlationId,
                pid: process.pid,
                error: structuredError.message,
            });
            throw structuredError;
        }
    }
    parseResponse(jsonOutput, correlationId = (0, crypto_1.randomUUID)()) {
        try {
            if (!jsonOutput || jsonOutput.trim() === '') {
                return {
                    success: false,
                    event: null,
                    error: 'Empty response received',
                    correlationId,
                    runId: null,
                    status: 'error',
                    returnCode: null,
                };
            }
            const rawData = JSON.parse(jsonOutput.trim());
            if (typeof rawData.event !== 'string') {
                throw new Error('Missing event field in response');
            }
            const validatedData = exports.ClaudeCodeEventSchema.parse(rawData);
            const { status: derivedStatus, returnCode: derivedReturnCode } = deriveStatus(validatedData.event, validatedData);
            const normalizedStatus = derivedStatus ?? (isLegacyStatus(validatedData.status) ? validatedData.status : null);
            const normalizedReturnCode = derivedReturnCode ??
                (typeof validatedData.return_code === 'number'
                    ? validatedData.return_code
                    : typeof validatedData.returnCode === 'number'
                        ? validatedData.returnCode
                        : undefined);
            const { status: rawStatus, ...restData } = validatedData;
            const enrichedData = {
                ...restData,
            };
            if (normalizedStatus) {
                enrichedData.status = normalizedStatus;
            }
            else if (isLegacyStatus(rawStatus)) {
                enrichedData.status = rawStatus;
            }
            if (normalizedReturnCode !== undefined) {
                enrichedData.return_code = normalizedReturnCode;
            }
            if (typeof validatedData.outcome === 'string') {
                enrichedData.outcome = validatedData.outcome;
            }
            if (typeof validatedData.reason === 'string') {
                enrichedData.reason = validatedData.reason;
            }
            if (Array.isArray(validatedData.tags)) {
                enrichedData.tags = validatedData.tags;
            }
            if (typeof validatedData.version === 'number') {
                enrichedData.version = validatedData.version;
            }
            this.logger.debug('Parsed Claude Code response', {
                correlationId,
                event: validatedData.event,
                runId: validatedData.run_id,
                status: normalizedStatus,
            });
            this.eventEmitter.emit('claude.response.received', {
                correlationId,
                event: validatedData.event,
                runId: validatedData.run_id,
                status: normalizedStatus ?? null,
                timestamp: new Date(),
            });
            return {
                success: true,
                event: validatedData.event,
                data: enrichedData,
                correlationId,
                runId: validatedData.run_id ?? null,
                status: normalizedStatus ?? null,
                returnCode: normalizedReturnCode ?? null,
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown parsing error';
            this.logger.warn('Failed to parse Claude Code response', {
                correlationId,
                error: errorMessage,
                jsonLength: jsonOutput.length,
            });
            return {
                success: false,
                event: null,
                error: `JSON parsing failed: ${errorMessage}`,
                correlationId,
                runId: null,
                status: 'error',
                returnCode: null,
            };
        }
    }
    toNormalizedEvent(response) {
        if (!response.success || !response.data) {
            return null;
        }
        const d = response.data;
        return {
            event: response.event || d.event || 'unknown',
            runId: d.run_id ?? null,
            timestamp: d.timestamp ?? undefined,
            outcome: typeof d.outcome === 'string' ? d.outcome : null,
            reason: typeof d.reason === 'string' ? d.reason : null,
            tags: Array.isArray(d.tags) ? d.tags : undefined,
            message: d.message ?? undefined,
            status: response.status ?? d.status ?? null,
            returnCode: response.returnCode ?? (typeof d.return_code === 'number' ? d.return_code : undefined),
        };
    }
    handleError(errorData) {
        const correlationId = errorData.correlationId || (0, crypto_1.randomUUID)();
        const { type: errorType, code: errorCode } = this.categorizeError(errorData.type, errorData.code, errorData.message, errorData.details);
        const structuredError = {
            type: errorType,
            code: errorCode,
            message: errorData.message,
            details: errorData.details,
            correlationId,
            timestamp: errorData.timestamp || new Date(),
            recoverable: errorData.recoverable ?? this.isRecoverableError(errorCode),
            retryAfter: errorData.retryAfter,
        };
        this.logger.error('Claude Code client error', {
            correlationId,
            type: structuredError.type,
            code: structuredError.code,
            message: structuredError.message,
            recoverable: structuredError.recoverable,
            timestamp: structuredError.timestamp,
        });
        this.eventEmitter.emit('claude.client.error', {
            correlationId,
            type: structuredError.type,
            message: structuredError.message,
            timestamp: structuredError.timestamp,
        });
        return structuredError;
    }
    categorizeError(type, code, message, details) {
        if (code) {
            return {
                type: this.getTypeFromCode(code),
                code
            };
        }
        if (type && ['validation', 'process', 'timeout', 'sdk'].includes(type)) {
            return {
                type: type,
                code: this.detectCodeFromMessage(type, message || '', details)
            };
        }
        const detectedType = this.detectTypeFromMessage(message || '');
        const detectedCode = this.detectCodeFromMessage(detectedType, message || '', details);
        return { type: detectedType, code: detectedCode };
    }
    getTypeFromCode(code) {
        if (code.startsWith('VALIDATION_'))
            return 'validation';
        if (code.startsWith('PROCESS_'))
            return 'process';
        if (code.startsWith('TIMEOUT_'))
            return 'timeout';
        if (code.startsWith('SDK_'))
            return 'sdk';
        return 'unknown';
    }
    detectTypeFromMessage(message) {
        const lowerMessage = message.toLowerCase();
        if (lowerMessage.includes('validation') || lowerMessage.includes('schema') || lowerMessage.includes('invalid')) {
            return 'validation';
        }
        if (lowerMessage.includes('timeout') || lowerMessage.includes('timed out')) {
            return 'timeout';
        }
        if (lowerMessage.includes('process') || lowerMessage.includes('spawn') || lowerMessage.includes('child')) {
            return 'process';
        }
        if (lowerMessage.includes('claude') || lowerMessage.includes('sdk')) {
            return 'sdk';
        }
        return 'unknown';
    }
    detectCodeFromMessage(type, message, details) {
        const lowerMessage = message.toLowerCase();
        switch (type) {
            case 'validation':
                if (lowerMessage.includes('schema'))
                    return ErrorCode.VALIDATION_SCHEMA_FAILED;
                if (lowerMessage.includes('required'))
                    return ErrorCode.VALIDATION_REQUIRED_FIELD;
                if (lowerMessage.includes('format') || lowerMessage.includes('invalid'))
                    return ErrorCode.VALIDATION_INVALID_FORMAT;
                return ErrorCode.VALIDATION_SCHEMA_FAILED;
            case 'process':
                if (lowerMessage.includes('spawn') || lowerMessage.includes('failed to start'))
                    return ErrorCode.PROCESS_SPAWN_FAILED;
                if (lowerMessage.includes('communication') || lowerMessage.includes('stdin') || lowerMessage.includes('stdout'))
                    return ErrorCode.PROCESS_COMMUNICATION_FAILED;
                if (lowerMessage.includes('terminated') || lowerMessage.includes('killed'))
                    return ErrorCode.PROCESS_TERMINATED_UNEXPECTEDLY;
                if (lowerMessage.includes('permission') || lowerMessage.includes('eacces'))
                    return ErrorCode.PROCESS_PERMISSION_DENIED;
                return ErrorCode.PROCESS_SPAWN_FAILED;
            case 'timeout':
                if (lowerMessage.includes('execution'))
                    return ErrorCode.TIMEOUT_EXECUTION;
                if (lowerMessage.includes('graceful') || lowerMessage.includes('shutdown'))
                    return ErrorCode.TIMEOUT_GRACEFUL_SHUTDOWN;
                if (lowerMessage.includes('inactivity') || lowerMessage.includes('idle'))
                    return ErrorCode.TIMEOUT_INACTIVITY;
                return ErrorCode.TIMEOUT_EXECUTION;
            case 'sdk':
                if (lowerMessage.includes('configuration') || lowerMessage.includes('config'))
                    return ErrorCode.SDK_CONFIGURATION_INVALID;
                if (lowerMessage.includes('parse') || lowerMessage.includes('json'))
                    return ErrorCode.SDK_RESPONSE_PARSE_FAILED;
                if (lowerMessage.includes('connection') || lowerMessage.includes('connect'))
                    return ErrorCode.SDK_CONNECTION_FAILED;
                return ErrorCode.SDK_CONFIGURATION_INVALID;
            default:
                return ErrorCode.UNKNOWN_ERROR;
        }
    }
    isRecoverableError(code) {
        const recoverableCodes = new Set([
            ErrorCode.TIMEOUT_EXECUTION,
            ErrorCode.TIMEOUT_INACTIVITY,
            ErrorCode.PROCESS_COMMUNICATION_FAILED,
            ErrorCode.SDK_CONNECTION_FAILED,
            ErrorCode.PROCESS_TERMINATED_UNEXPECTEDLY
        ]);
        return recoverableCodes.has(code);
    }
    validateConfiguration(options, correlationId = (0, crypto_1.randomUUID)()) {
        try {
            worker_config_1.ClaudeCodeOptionsSchema.parse(options);
            this.logger.debug('Claude Code configuration validation passed', {
                correlationId,
                model: options.model,
                hasTimeout: !!options.timeout,
                hasMaxTokens: !!options.maxTokens,
            });
            return { valid: true };
        }
        catch (error) {
            const errors = error instanceof zod_1.z.ZodError
                ? error.errors.map((e) => `${e.path.join('.')}: ${e.message}`)
                : ['Unknown validation error'];
            this.logger.warn('Claude Code configuration validation failed', {
                correlationId,
                errors,
            });
            return {
                valid: false,
                errors,
            };
        }
    }
    isSuccessResponse(response) {
        if (!response.success) {
            return false;
        }
        const outcome = response.data?.outcome;
        if (typeof outcome === 'string') {
            return outcome === 'completed' || outcome === 'shutdown';
        }
        if ((response.status ?? response.data?.status) !== 'completed') {
            return false;
        }
        const returnCode = response.returnCode ??
            response.data?.return_code ??
            (typeof response.data?.returnCode === 'number' ? response.data.returnCode : undefined);
        return returnCode === undefined || returnCode === 0;
    }
    isFailureResponse(response) {
        if (!response.success) {
            return true;
        }
        const outcome = response.data?.outcome;
        if (typeof outcome === 'string') {
            return ['failed', 'timeout', 'terminated'].includes(outcome);
        }
        const status = response.status ?? response.data?.status ?? null;
        if (!status) {
            return false;
        }
        if (['failed', 'error', 'timeout'].includes(status)) {
            return true;
        }
        const returnCode = response.returnCode ??
            response.data?.return_code ??
            (typeof response.data?.returnCode === 'number'
                ? response.data.returnCode
                : undefined);
        return returnCode !== undefined && returnCode !== 0;
    }
    extractErrorMessage(response) {
        if (!response.success) {
            return response.error;
        }
        const data = response.data;
        if (!data) {
            return undefined;
        }
        const directError = [data.error, data.error_output, data.message, data.reason].find((value) => typeof value === 'string' && value.trim().length > 0);
        if (directError) {
            return directError;
        }
        if (data.payload && typeof data.payload === 'object') {
            const payloadRecord = data.payload;
            const payloadErrorCandidates = [
                payloadRecord.error,
                payloadRecord.message,
                payloadRecord.description,
            ];
            const payloadError = payloadErrorCandidates.find((value) => typeof value === 'string' && value.trim().length > 0);
            if (payloadError && typeof payloadError === 'string') {
                return payloadError;
            }
            const payloadContent = payloadRecord.content;
            if (Array.isArray(payloadContent)) {
                const text = payloadContent
                    .map((item) => {
                    if (!item || typeof item !== 'object') {
                        return '';
                    }
                    const entry = item;
                    const textValue = entry.text;
                    return typeof textValue === 'string' ? textValue : '';
                })
                    .join('')
                    .trim();
                if (text) {
                    return text;
                }
            }
        }
        return undefined;
    }
};
exports.ClaudeCodeClientService = ClaudeCodeClientService;
exports.ClaudeCodeClientService = ClaudeCodeClientService = ClaudeCodeClientService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService,
        event_emitter_1.EventEmitter2])
], ClaudeCodeClientService);
//# sourceMappingURL=claude-code-client.service.js.map