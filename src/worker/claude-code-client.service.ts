import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { randomUUID } from 'crypto';
import { ChildProcess } from 'child_process';
import { z } from 'zod';
import { WorkerConfig, ClaudeCodeOptionsSchema } from '../config/worker.config';

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

const deriveStatus = (
  event: string,
  data: ClaudeCodeEvent
): { status: LegacyStatus | null; returnCode?: number } => {
  // Prefer SSOT outcome from wrapper if provided
  if (typeof (data as any).outcome === 'string') {
    const outcome = String((data as any).outcome).toLowerCase();
    switch (outcome) {
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
    }

  toNormalizedEvent(response: ParsedResponse): NormalizedEvent | null {
    if (!response.success || !response.data) {
      return null;
    }
    const d = response.data as any;
    const outcome = typeof d.outcome === 'string' ? (d.outcome as string) : null;
    const reason = typeof d.reason === 'string' ? (d.reason as string) : null;
    const tags = Array.isArray(d.tags) ? (d.tags as string[]) : undefined;
    const status = (response.status as LegacyStatus | null) ?? (d.status as LegacyStatus | null) ?? null;
    const returnCode =
      response.returnCode ?? (typeof d.return_code === 'number' ? (d.return_code as number) : undefined);

    return {
      event: (response.event as string) || (d.event as string) || 'unknown',
      runId: (d.run_id as string) ?? null,
      timestamp: (d.timestamp as string) ?? undefined,
      outcome,
      reason,
      tags,
      message: (d.message as string) ?? undefined,
      status,
      returnCode,
    };
  }

  toNormalizedEvent(response: ParsedResponse): NormalizedEvent | null {
    if (!response.success || !response.data) {
      return null;
    }
    const d = response.data as any;
    return {
      event: (response.event as string) || (d.event as string) || 'unknown',
      runId: (d.run_id as string) ?? null,
      timestamp: (d.timestamp as string) ?? undefined,
      outcome: typeof d.outcome === 'string' ? d.outcome : null,
      reason: typeof d.reason === 'string' ? d.reason : null,
      tags: Array.isArray(d.tags) ? (d.tags as string[]) : undefined,
      message: (d.message as string) ?? undefined,
      status: (response.status as LegacyStatus | null) ?? (d.status as LegacyStatus | null) ?? null,
      returnCode:
        response.returnCode ??
        (typeof d.return_code === 'number' ? (d.return_code as number) : undefined),
    };
  }
  }

  // Event mapping fallback
  const mapping = EVENT_STATUS_MAP[event];
  if (mapping) {
    if (mapping.status === 'failed' && data.reason === 'timeout') {
      return { status: 'timeout', returnCode: mapping.returnCode ?? 1 };
    }
    return mapping;
  }

  // State fallback
  if (typeof data.state === 'string') {
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

  // Status / payload fallbacks
  if (isLegacyStatus(data.status)) {
    const inferredReturnCode =
      data.status === 'completed'
        ? 0
        : ['failed', 'timeout', 'error'].includes(data.status)
        ? 1
        : undefined;
    return { status: data.status, returnCode: inferredReturnCode };
  }

  if (data.payload && typeof data.payload === 'object') {
    const payloadRecord = data.payload as Record<string, unknown>;
    const payloadStatus = payloadRecord.status;
    if (isLegacyStatus(payloadStatus)) {
      const inferredReturnCode =
        payloadStatus === 'completed'
          ? 0
          : ['failed', 'timeout', 'error'].includes(payloadStatus)
          ? 1
          : undefined;
      return { status: payloadStatus, returnCode: inferredReturnCode };
    }
  }

  if (data.reason === 'timeout') {
    return { status: 'timeout', returnCode: 1 };
  }

  return { status: null };
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

export interface StructuredError {
  type: 'validation' | 'process' | 'timeout' | 'sdk' | 'unknown';
  message: string;
  details?: any;
  correlationId: string;
  timestamp: Date;
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
        message: error instanceof Error ? error.message : 'Unknown error sending prompt',
        details: error,
        correlationId,
        timestamp: new Date(),
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

  handleError(errorData: {
    type?: string;
    message: string;
    details?: any;
    correlationId?: string;
    timestamp?: Date;
  }): StructuredError {
    const correlationId = errorData.correlationId || randomUUID();

    let errorType: StructuredError['type'] = 'unknown';

    if (errorData.type) {
      switch (errorData.type) {
        case 'validation':
        case 'process':
        case 'timeout':
        case 'sdk':
          errorType = errorData.type as StructuredError['type'];
          break;
        default:
          errorType = 'unknown';
      }
    } else {
      const message = errorData.message.toLowerCase();

      if (message.includes('validation') || message.includes('schema') || message.includes('invalid')) {
        errorType = 'validation';
      } else if (message.includes('timeout') || message.includes('timed out')) {
        errorType = 'timeout';
      } else if (message.includes('process') || message.includes('spawn') || message.includes('child')) {
        errorType = 'process';
      } else if (message.includes('claude') || message.includes('sdk')) {
        errorType = 'sdk';
      }
    }

    const structuredError: StructuredError = {
      type: errorType,
      message: errorData.message,
      details: errorData.details,
      correlationId,
      timestamp: errorData.timestamp || new Date(),
    };

    this.logger.error('Claude Code client error', {
      correlationId,
      type: structuredError.type,
      message: structuredError.message,
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