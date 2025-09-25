import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { randomUUID } from 'crypto';
import { ChildProcess } from 'child_process';
import { z } from 'zod';
import { 
  WorkerConfig, 
  ClaudeCodeOptionsSchema, 
  TaskExecutionRequestSchema 
} from '../config/worker.config';

// Zod schemas for Claude Code response validation

export const ClaudeCodeResponseSchema = z.object({
  status: z.enum(['ready', 'started', 'running', 'completed', 'failed', 'timeout', 'error', 'shutdown']),
  timestamp: z.string(),
  message: z.string().optional(),
  pid: z.number().optional(),
  return_code: z.number().optional(),
  stdout_length: z.number().optional(),
  stderr_length: z.number().optional(),
  error_output: z.string().optional(),
  error: z.string().optional(),
});

export const ClaudeCodeInputSchema = z.object({
  command: z.string().min(1, 'Command is required'),
  working_directory: z.string().min(1, 'Working directory is required'),
  timeout: z.number().positive().optional().default(300),
});

// Type definitions
export type ClaudeCodeResponse = z.infer<typeof ClaudeCodeResponseSchema>;
export type ClaudeCodeInput = z.infer<typeof ClaudeCodeInputSchema>;
export type ClaudeCodeOptions = z.infer<typeof ClaudeCodeOptionsSchema>;

export interface ParsedResponse {
  success: boolean;
  status: ClaudeCodeResponse['status'];
  data?: ClaudeCodeResponse;
  error?: string;
  correlationId: string;
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

  /**
   * Send prompt to Claude Code via Python wrapper process
   * @param process The spawned Python wrapper process
   * @param prompt The prompt to send to Claude Code
   * @param options Claude Code execution options
   * @param correlationId Correlation ID for request tracking
   */
  async sendPrompt(
    process: ChildProcess,
    prompt: string,
    options: ClaudeCodeOptions,
    correlationId: string = randomUUID()
  ): Promise<void> {
    try {
      if (!process.stdin || !process.stdin.writable) {
        throw new Error('Process stdin is not available or writable');
      }

      // Build Claude Code command based on options
      let command = 'claude code';
      
      if (options.model) {
        command += ` --model ${options.model}`;
      }
      
      // Create input data for Python wrapper
      const inputData: ClaudeCodeInput = {
        command: `${command} "${prompt.replace(/"/g, '\\"')}"`,
        working_directory: globalThis.process.cwd(),
        timeout: options.timeout || 300,
      };

      // Validate input before sending
      const validatedInput = ClaudeCodeInputSchema.parse(inputData);

      this.logger.log('Sending prompt to Claude Code process', {
        correlationId,
        pid: process.pid,
        commandLength: validatedInput.command.length,
        workingDirectory: validatedInput.working_directory,
        timeout: validatedInput.timeout,
        // Never log the actual prompt content for security
      });

      // Send JSON input to Python wrapper
      const jsonInput = JSON.stringify(validatedInput);
      process.stdin.write(jsonInput + '\n');

      this.eventEmitter.emit('claude.prompt.sent', {
        correlationId,
        pid: process.pid,
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

  /**
   * Parse JSON response from Claude Code Python wrapper
   * @param jsonOutput Raw JSON string from Python wrapper stdout
   * @param correlationId Correlation ID for request tracking
   * @returns Parsed and validated response
   */
  parseResponse(jsonOutput: string, correlationId: string = randomUUID()): ParsedResponse {
    try {
      if (!jsonOutput || jsonOutput.trim() === '') {
        return {
          success: false,
          status: 'error',
          error: 'Empty response received',
          correlationId,
        };
      }

      // Parse JSON
      const rawData = JSON.parse(jsonOutput.trim());
      
      // Validate against schema
      const validatedData = ClaudeCodeResponseSchema.parse(rawData);

      this.logger.debug('Parsed Claude Code response', {
        correlationId,
        status: validatedData.status,
        pid: validatedData.pid,
        hasError: !!validatedData.error,
        hasErrorOutput: !!validatedData.error_output,
      });

      // Emit status change event
      this.eventEmitter.emit('claude.response.received', {
        correlationId,
        status: validatedData.status,
        pid: validatedData.pid,
        timestamp: new Date(),
      });

      return {
        success: true,
        status: validatedData.status,
        data: validatedData,
        correlationId,
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown parsing error';
      
      this.logger.warn('Failed to parse Claude Code response', {
        correlationId,
        error: errorMessage,
        jsonLength: jsonOutput.length,
        // Don't log the actual JSON content to avoid sensitive data exposure
      });

      return {
        success: false,
        status: 'error',
        error: `JSON parsing failed: ${errorMessage}`,
        correlationId,
      };
    }
  }

  /**
   * Handle and structure errors from Claude Code operations
   * @param errorData Raw error information
   * @returns Structured error object
   */
  handleError(errorData: {
    type?: string;
    message: string;
    details?: any;
    correlationId?: string;
    timestamp?: Date;
  }): StructuredError {
    const correlationId = errorData.correlationId || randomUUID();
    
    // Categorize error type
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
      // Try to infer error type from message
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

    // Log structured error (without sensitive details)
    this.logger.error('Claude Code client error', {
      correlationId,
      type: structuredError.type,
      message: structuredError.message,
      timestamp: structuredError.timestamp,
      // Don't log details to avoid exposing sensitive information
    });

    // Emit error event for monitoring
    this.eventEmitter.emit('claude.client.error', {
      correlationId,
      type: structuredError.type,
      message: structuredError.message,
      timestamp: structuredError.timestamp,
    });

    return structuredError;
  }

  /**
   * Validate Claude Code configuration before execution
   * @param options Claude Code options to validate
   * @param correlationId Correlation ID for request tracking
   * @returns Validation result
   */
  validateConfiguration(options: ClaudeCodeOptions, correlationId: string = randomUUID()): {
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
      const errors = error instanceof z.ZodError 
        ? error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
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

  /**
   * Check if Claude Code response indicates success
   * @param response Parsed Claude Code response
   * @returns True if response indicates successful completion
   */
  isSuccessResponse(response: ParsedResponse): boolean {
    if (!response.success || !response.data) {
      return false;
    }

    return response.data.status === 'completed' && 
           (response.data.return_code === undefined || response.data.return_code === 0);
  }

  /**
   * Check if Claude Code response indicates failure
   * @param response Parsed Claude Code response
   * @returns True if response indicates failure
   */
  isFailureResponse(response: ParsedResponse): boolean {
    if (!response.success) {
      return true;
    }

    if (!response.data) {
      return false;
    }

    return response.data.status === 'failed' || 
           response.data.status === 'error' || 
           response.data.status === 'timeout' ||
           (response.data.return_code !== undefined && response.data.return_code !== 0);
  }

  /**
   * Extract error message from Claude Code response
   * @param response Parsed Claude Code response
   * @returns Error message if available
   */
  extractErrorMessage(response: ParsedResponse): string | undefined {
    if (!response.success) {
      return response.error;
    }

    if (response.data?.error) {
      return response.data.error;
    }

    if (response.data?.error_output) {
      return response.data.error_output;
    }

    if (response.data?.status === 'failed' && response.data.message) {
      return response.data.message;
    }

    return undefined;
  }
}