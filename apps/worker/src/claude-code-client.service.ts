import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { randomUUID } from 'crypto';
import { ChildProcess } from 'child_process';
import { z } from 'zod';
import { WorkerConfig, ClaudeCodeOptionsSchema } from '../../../src/config/worker.config';

const PromptOptionsSchema = z
  .object({
    cwd: z.string().optional(),
    permission_mode: z
      .enum(['bypassPermissions', 'default', 'plan', 'acceptEdits'])
      .optional(),
    timeout: z.number().positive().optional(),
  })
  .catchall(z.unknown());

export const ClaudeCodePromptPayloadSchema = z.object({
  action: z.literal('prompt'),
  prompt: z.string().min(1, 'Prompt is required'),
  options: PromptOptionsSchema.optional(),
  run_id: z.string().optional(),
});

export const ClaudeCodeEventSchema = z
  .object({
    event: z.string(),
    timestamp: z.string().optional(),
    run_id: z.string().optional(),
    state: z.string().optional(),
    status: z.string().optional(),
    message: z.string().optional(),
    reason: z.string().optional(),
    outcome: z.string().optional(),
    tags: z.array(z.string()).optional(),
    version: z.number().optional(),
    error: z.string().optional(),
    error_output: z.string().optional(),
    payload: z.unknown().optional(),
    return_code: z.number().optional(),
    returnCode: z.number().optional(),
    pid: z.number().optional(),
    stdout_length: z.number().optional(),
    stderr_length: z.number().optional(),
    details: z.unknown().optional(),
  })
  .catchall(z.unknown());

export type ClaudeCodePromptPayload = z.infer<typeof ClaudeCodePromptPayloadSchema>;
export type ClaudeCodeEvent = z.infer<typeof ClaudeCodeEventSchema>;
export type ClaudeCodeOptions = z.infer<typeof ClaudeCodeOptionsSchema>;

export type LegacyStatus =
  | 'ready'
  | 'started'
  | 'running'
  | 'completed'
  | 'failed'
  | 'timeout'
  | 'error'
  | 'shutdown';

const LEGACY_STATUS_VALUES: readonly LegacyStatus[] = [
  'ready',
  'started',
  'running',
  'completed',
  'failed',
  'timeout',
  'error',
  'shutdown',
];

const EVENT_STATUS_MAP: Record<string, { status: LegacyStatus; returnCode?: number }> = {
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

const isLegacyStatus = (value: unknown): value is LegacyStatus =>
  typeof value === 'string' && (LEGACY_STATUS_VALUES as readonly string[]).includes(value);

/**
 * Strategy pattern for deriving status from different data sources
 */
interface StatusDerivationStrategy {
  derive(data: ClaudeCodeEvent, event?: string): { status: LegacyStatus | null; returnCode?: number } | null;
}

/**
 * Derives status from SSOT outcome field (highest priority)
 */
class OutcomeStatusStrategy implements StatusDerivationStrategy {
  derive(data: ClaudeCodeEvent): { status: LegacyStatus | null; returnCode?: number } | null {
    const outcome = (data as any).outcome;
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

/**
 * Derives status from event type mapping
 */
class EventStatusStrategy implements StatusDerivationStrategy {
  derive(data: ClaudeCodeEvent, event?: string): { status: LegacyStatus | null; returnCode?: number } | null {
    if (!event) {
      return null;
    }

    const mapping = EVENT_STATUS_MAP[event];
    if (!mapping) {
      return null;
    }

    // Handle timeout override
    if (mapping.status === 'failed' && data.reason === 'timeout') {
      return { status: 'timeout', returnCode: mapping.returnCode ?? 1 };
    }

    return mapping;
  }
}

/**
 * Derives status from state field
 */
class StateStatusStrategy implements StatusDerivationStrategy {
  derive(data: ClaudeCodeEvent): { status: LegacyStatus | null; returnCode?: number } | null {
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

/**
 * Derives status from legacy status field or payload
 */
class LegacyStatusStrategy implements StatusDerivationStrategy {
  derive(data: ClaudeCodeEvent): { status: LegacyStatus | null; returnCode?: number } | null {
    // Try direct status field
    if (isLegacyStatus(data.status)) {
      return {
        status: data.status,
        returnCode: this.inferReturnCode(data.status)
      };
    }

    // Try payload status
    if (data.payload && typeof data.payload === 'object') {
      const payloadRecord = data.payload as Record<string, unknown>;
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

  private inferReturnCode(status: LegacyStatus): number | undefined {
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

/**
 * Derives status from reason field (timeout fallback)
 */
class ReasonStatusStrategy implements StatusDerivationStrategy {
  derive(data: ClaudeCodeEvent): { status: LegacyStatus | null; returnCode?: number } | null {
    if (data.reason === 'timeout') {
      return { status: 'timeout', returnCode: 1 };
    }
    return null;
  }
}

/**
 * Status derivation orchestrator using strategy pattern
 */
class StatusDerivationOrchestrator {
  private strategies: StatusDerivationStrategy[] = [
    new OutcomeStatusStrategy(),
    new EventStatusStrategy(),
    new StateStatusStrategy(),
    new LegacyStatusStrategy(),
    new ReasonStatusStrategy()
  ];

  derive(event: string, data: ClaudeCodeEvent): { status: LegacyStatus | null; returnCode?: number } {
    for (const strategy of this.strategies) {
      const result = strategy.derive(data, event);
      if (result !== null) {
        return result;
      }
    }

    return { status: null };
  }
}

// Create singleton instance
const statusDerivationOrchestrator = new StatusDerivationOrchestrator();

/**
 * Simplified status derivation function using strategy pattern
 */
const deriveStatus = (
  event: string,
  data: ClaudeCodeEvent
): { status: LegacyStatus | null; returnCode?: number } => {
  return statusDerivationOrchestrator.derive(event, data);
};

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

/**
 * Enumeration of specific error codes for better error categorization and handling
 */
export enum ErrorCode {
  // Validation errors
  VALIDATION_SCHEMA_FAILED = 'VALIDATION_SCHEMA_FAILED',
  VALIDATION_REQUIRED_FIELD = 'VALIDATION_REQUIRED_FIELD',
  VALIDATION_INVALID_FORMAT = 'VALIDATION_INVALID_FORMAT',

  // Process errors
  PROCESS_SPAWN_FAILED = 'PROCESS_SPAWN_FAILED',
  PROCESS_COMMUNICATION_FAILED = 'PROCESS_COMMUNICATION_FAILED',
  PROCESS_TERMINATED_UNEXPECTEDLY = 'PROCESS_TERMINATED_UNEXPECTEDLY',
  PROCESS_PERMISSION_DENIED = 'PROCESS_PERMISSION_DENIED',

  // Timeout errors
  TIMEOUT_EXECUTION = 'TIMEOUT_EXECUTION',
  TIMEOUT_GRACEFUL_SHUTDOWN = 'TIMEOUT_GRACEFUL_SHUTDOWN',
  TIMEOUT_INACTIVITY = 'TIMEOUT_INACTIVITY',

  // SDK/Client errors
  SDK_CONFIGURATION_INVALID = 'SDK_CONFIGURATION_INVALID',
  SDK_RESPONSE_PARSE_FAILED = 'SDK_RESPONSE_PARSE_FAILED',
  SDK_CONNECTION_FAILED = 'SDK_CONNECTION_FAILED',

  // Unknown/Generic errors
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
  INTERNAL_ERROR = 'INTERNAL_ERROR'
}

/**
 * Enhanced structured error interface with specific error codes
 */
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

@Injectable()
export class ClaudeCodeClientService {
  private readonly logger = new Logger(ClaudeCodeClientService.name);
  private readonly workerConfig: WorkerConfig;

  constructor(
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2
  ) {
    this.workerConfig = this.configService.get<WorkerConfig>('worker')!;
  }

  async sendPrompt(
    process: ChildProcess,
    prompt: string,
    options: ClaudeCodeOptions,
    correlationId: string = randomUUID(),
    workingDirectory?: string,
    runId?: string
  ): Promise<void> {
    try {
      if (!process.stdin || !process.stdin.writable) {
        throw new Error('Process stdin is not available or writable');
      }

      const optionsPayload = {
        ...(options || {}),
        timeout: options?.timeout ?? Math.floor(this.workerConfig.processTimeoutMs / 1000) ?? 300,
        cwd:
          workingDirectory ??
          this.workerConfig.wrapperWorkingDir ??
          globalThis.process.cwd(),
        permission_mode: options?.permission_mode ?? 'bypassPermissions',
      };

      const payload: ClaudeCodePromptPayload = ClaudeCodePromptPayloadSchema.parse({
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
    } catch (error) {
      const structuredError = this.handleError({
        type: 'process',
        code: ErrorCode.PROCESS_COMMUNICATION_FAILED,
        message: error instanceof Error ? error.message : 'Unknown error sending prompt',
        details: error,
        correlationId,
        timestamp: new Date(),
        recoverable: true,
        retryAfter: 5000, // 5 seconds
      });

      this.logger.error('Failed to send prompt to Claude Code process', {
        correlationId,
        pid: process.pid,
        error: structuredError.message,
      });

      throw structuredError;
    }
  }

  parseResponse(jsonOutput: string, correlationId: string = randomUUID()): ParsedResponse {
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

      const validatedData = ClaudeCodeEventSchema.parse(rawData);

      const { status: derivedStatus, returnCode: derivedReturnCode } = deriveStatus(
        validatedData.event,
        validatedData
      );

      const normalizedStatus =
        derivedStatus ?? (isLegacyStatus(validatedData.status) ? validatedData.status : null);

      const normalizedReturnCode =
        derivedReturnCode ??
        (typeof validatedData.return_code === 'number'
          ? validatedData.return_code
          : typeof validatedData.returnCode === 'number'
          ? validatedData.returnCode
          : undefined);

      const { status: rawStatus, ...restData } = validatedData;

      const enrichedData: Omit<ClaudeCodeEvent, 'status'> & {
        status?: LegacyStatus;
        return_code?: number;
      } = {
        ...restData,
      };

      if (normalizedStatus) {
        enrichedData.status = normalizedStatus;
      } else if (isLegacyStatus(rawStatus)) {
        enrichedData.status = rawStatus;
      }

      if (normalizedReturnCode !== undefined) {
        enrichedData.return_code = normalizedReturnCode;
      }

      // Ensure SSOT fields are present in data for consumers
      if (typeof (validatedData as any).outcome === 'string') {
        (enrichedData as any).outcome = (validatedData as any).outcome;
      }
      if (typeof (validatedData as any).reason === 'string') {
        (enrichedData as any).reason = (validatedData as any).reason;
      }
      if (Array.isArray((validatedData as any).tags)) {
        (enrichedData as any).tags = (validatedData as any).tags as string[];
      }
      if (typeof (validatedData as any).version === 'number') {
        (enrichedData as any).version = (validatedData as any).version as number;
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
    } catch (error) {
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

  // Convert a parsed response into a single, stable SSOT event
  toNormalizedEvent(response: ParsedResponse): NormalizedEvent | null {
    if (!response.success || !response.data) {
      return null;
    }
    const d = response.data as any;
    return {
      event: (response.event as string) || (d.event as string) || 'unknown',
      runId: (d.run_id as string) ?? null,
      timestamp: (d.timestamp as string) ?? undefined,
      outcome: typeof d.outcome === 'string' ? (d.outcome as string) : null,
      reason: typeof d.reason === 'string' ? (d.reason as string) : null,
      tags: Array.isArray(d.tags) ? (d.tags as string[]) : undefined,
      message: (d.message as string) ?? undefined,
      status: (response.status as LegacyStatus | null) ?? (d.status as LegacyStatus | null) ?? null,
      returnCode:
        response.returnCode ?? (typeof d.return_code === 'number' ? (d.return_code as number) : undefined),
    };
  }

  /**
   * Enhanced error handler with automatic error code detection
   * @param errorData Error information
   * @returns Structured error with appropriate code and metadata
   */
  handleError(errorData: {
    type?: string;
    code?: ErrorCode;
    message: string;
    details?: any;
    correlationId?: string;
    timestamp?: Date;
    recoverable?: boolean;
    retryAfter?: number;
  }): StructuredError {
    const correlationId = errorData.correlationId || randomUUID();

    // Auto-detect error type and code if not provided
    const { type: errorType, code: errorCode } = this.categorizeError(
      errorData.type,
      errorData.code,
      errorData.message,
      errorData.details
    );

    const structuredError: StructuredError = {
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

  /**
   * Categorize error based on type, code, message, and details
   */
  private categorizeError(
    type?: string,
    code?: ErrorCode,
    message?: string,
    details?: any
  ): { type: StructuredError['type']; code: ErrorCode } {
    // If code is provided, derive type from code
    if (code) {
      return {
        type: this.getTypeFromCode(code),
        code
      };
    }

    // If type is provided, use it and auto-detect code
    if (type && ['validation', 'process', 'timeout', 'sdk'].includes(type)) {
      return {
        type: type as StructuredError['type'],
        code: this.detectCodeFromMessage(type as StructuredError['type'], message || '', details)
      };
    }

    // Auto-detect both type and code from message
    const detectedType = this.detectTypeFromMessage(message || '');
    const detectedCode = this.detectCodeFromMessage(detectedType, message || '', details);

    return { type: detectedType, code: detectedCode };
  }

  /**
   * Get error type from error code
   */
  private getTypeFromCode(code: ErrorCode): StructuredError['type'] {
    if (code.startsWith('VALIDATION_')) return 'validation';
    if (code.startsWith('PROCESS_')) return 'process';
    if (code.startsWith('TIMEOUT_')) return 'timeout';
    if (code.startsWith('SDK_')) return 'sdk';
    return 'unknown';
  }

  /**
   * Detect error type from message content
   */
  private detectTypeFromMessage(message: string): StructuredError['type'] {
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

  /**
   * Detect specific error code from message and context
   */
  private detectCodeFromMessage(type: StructuredError['type'], message: string, details?: any): ErrorCode {
    const lowerMessage = message.toLowerCase();

    switch (type) {
      case 'validation':
        if (lowerMessage.includes('schema')) return ErrorCode.VALIDATION_SCHEMA_FAILED;
        if (lowerMessage.includes('required')) return ErrorCode.VALIDATION_REQUIRED_FIELD;
        if (lowerMessage.includes('format') || lowerMessage.includes('invalid')) return ErrorCode.VALIDATION_INVALID_FORMAT;
        return ErrorCode.VALIDATION_SCHEMA_FAILED;

      case 'process':
        if (lowerMessage.includes('spawn') || lowerMessage.includes('failed to start')) return ErrorCode.PROCESS_SPAWN_FAILED;
        if (lowerMessage.includes('communication') || lowerMessage.includes('stdin') || lowerMessage.includes('stdout')) return ErrorCode.PROCESS_COMMUNICATION_FAILED;
        if (lowerMessage.includes('terminated') || lowerMessage.includes('killed')) return ErrorCode.PROCESS_TERMINATED_UNEXPECTEDLY;
        if (lowerMessage.includes('permission') || lowerMessage.includes('eacces')) return ErrorCode.PROCESS_PERMISSION_DENIED;
        return ErrorCode.PROCESS_SPAWN_FAILED;

      case 'timeout':
        if (lowerMessage.includes('execution')) return ErrorCode.TIMEOUT_EXECUTION;
        if (lowerMessage.includes('graceful') || lowerMessage.includes('shutdown')) return ErrorCode.TIMEOUT_GRACEFUL_SHUTDOWN;
        if (lowerMessage.includes('inactivity') || lowerMessage.includes('idle')) return ErrorCode.TIMEOUT_INACTIVITY;
        return ErrorCode.TIMEOUT_EXECUTION;

      case 'sdk':
        if (lowerMessage.includes('configuration') || lowerMessage.includes('config')) return ErrorCode.SDK_CONFIGURATION_INVALID;
        if (lowerMessage.includes('parse') || lowerMessage.includes('json')) return ErrorCode.SDK_RESPONSE_PARSE_FAILED;
        if (lowerMessage.includes('connection') || lowerMessage.includes('connect')) return ErrorCode.SDK_CONNECTION_FAILED;
        return ErrorCode.SDK_CONFIGURATION_INVALID;

      default:
        return ErrorCode.UNKNOWN_ERROR;
    }
  }

  /**
   * Determine if an error is recoverable based on its code
   */
  private isRecoverableError(code: ErrorCode): boolean {
    const recoverableCodes = new Set([
      ErrorCode.TIMEOUT_EXECUTION,
      ErrorCode.TIMEOUT_INACTIVITY,
      ErrorCode.PROCESS_COMMUNICATION_FAILED,
      ErrorCode.SDK_CONNECTION_FAILED,
      ErrorCode.PROCESS_TERMINATED_UNEXPECTEDLY
    ]);

    return recoverableCodes.has(code);
  }

  validateConfiguration(
    options: ClaudeCodeOptions,
    correlationId: string = randomUUID()
  ): {
    valid: boolean;
    errors?: string[];
  } {
    try {
      ClaudeCodeOptionsSchema.parse(options);

      this.logger.debug('Claude Code configuration validation passed', {
        correlationId,
        model: options.model,
        hasTimeout: !!options.timeout,
        hasMaxTokens: !!options.maxTokens,
      });

      return { valid: true };
    } catch (error) {
      const errors =
        error instanceof z.ZodError
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

  isSuccessResponse(response: ParsedResponse): boolean {
    if (!response.success) {
      return false;
    }

    // Prefer SSOT outcome
    const outcome = (response.data as any)?.outcome;
    if (typeof outcome === 'string') {
      return outcome === 'completed' || outcome === 'shutdown';
    }

    if ((response.status ?? response.data?.status) !== 'completed') {
      return false;
    }

    const returnCode =
      response.returnCode ??
      response.data?.return_code ??
      (typeof response.data?.returnCode === 'number' ? response.data.returnCode : undefined);

    return returnCode === undefined || returnCode === 0;
  }

  isFailureResponse(response: ParsedResponse): boolean {
    if (!response.success) {
      return true;
    }

    // Prefer SSOT outcome
    const outcome = (response.data as any)?.outcome;
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

    const returnCode =
      response.returnCode ??
      response.data?.return_code ??
      (typeof (response.data as Record<string, unknown> | undefined)?.returnCode === 'number'
        ? ((response.data as Record<string, unknown>).returnCode as number)
        : undefined);

    return returnCode !== undefined && returnCode !== 0;
  }

  extractErrorMessage(response: ParsedResponse): string | undefined {
    if (!response.success) {
      return response.error;
    }

    const data = response.data;
    if (!data) {
      return undefined;
    }

    const directError = [data.error, data.error_output, data.message, data.reason].find(
      (value) => typeof value === 'string' && value.trim().length > 0
    );
    if (directError) {
      return directError;
    }

    if (data.payload && typeof data.payload === 'object') {
      const payloadRecord = data.payload as Record<string, unknown>;

      const payloadErrorCandidates = [
        payloadRecord.error,
        payloadRecord.message,
        payloadRecord.description,
      ];

      const payloadError = payloadErrorCandidates.find(
        (value) => typeof value === 'string' && value.trim().length > 0
      );

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
            const entry = item as Record<string, unknown>;
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
}