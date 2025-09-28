import { z } from 'zod';

/**
 * Claude Code Protocol Schemas
 * TypeScript interfaces and validation schemas for Claude Code wrapper communication
 */

// =============================================================================
// Command Schemas
// =============================================================================

export const ClaudeCodeOptionsSchema = z.object({
  model: z.string().optional(),
  maxTokens: z.number().positive().optional(),
  temperature: z.number().min(0).max(2).optional(),
  timeout: z.number().positive().default(300000),
  permission_mode: z.enum(['bypassPermissions', 'default', 'plan', 'acceptEdits']).optional(),
  cwd: z.string().optional(),
  auto_shutdown: z.boolean().optional(),
});

export const PromptCommandSchema = z.object({
  action: z.literal('prompt'),
  prompt: z.string().min(1),
  options: ClaudeCodeOptionsSchema.optional(),
});

export const CancelCommandSchema = z.object({
  action: z.literal('cancel'),
});

export const StatusCommandSchema = z.object({
  action: z.literal('status'),
});

export const ShutdownCommandSchema = z.object({
  action: z.literal('shutdown'),
});

export const LegacyCommandSchema = z.object({
  command: z.string().min(1),
  working_directory: z.string().optional(),
  options: ClaudeCodeOptionsSchema.optional(),
});

export const CommandSchema = z.union([
  PromptCommandSchema,
  CancelCommandSchema,
  StatusCommandSchema,
  ShutdownCommandSchema,
  LegacyCommandSchema,
]);

// =============================================================================
// Event Schemas
// =============================================================================

export const WrapperStateSchema = z.enum(['idle', 'executing', 'terminating']);

export const BaseEventSchema = z.object({
  event: z.string(),
  timestamp: z.string().datetime(),
  state: WrapperStateSchema.optional(),
});

export const ReadyEventSchema = BaseEventSchema.extend({
  event: z.literal('ready'),
  version: z.number(),
  outcome: z.string(),
  reason: z.string(),
  tags: z.array(z.string()),
});

export const ShutdownEventSchema = BaseEventSchema.extend({
  event: z.literal('shutdown'),
  last_session_id: z.string().nullable(),
  version: z.number(),
  outcome: z.string(),
  reason: z.string(),
  tags: z.array(z.string()),
});

export const RunStartedEventSchema = BaseEventSchema.extend({
  event: z.literal('run_started'),
  run_id: z.string(),
  prompt: z.string(),
  session_id: z.string().nullable().optional(),
});

export const RunCompletedEventSchema = BaseEventSchema.extend({
  event: z.literal('run_completed'),
  run_id: z.string(),
  outcome: z.string(),
  reason: z.string(),
  session_id: z.string().nullable().optional(),
  tags: z.array(z.string()),
});

export const RunCancelledEventSchema = BaseEventSchema.extend({
  event: z.literal('run_cancelled'),
  run_id: z.string(),
  outcome: z.string(),
  reason: z.string(),
  session_id: z.string().nullable().optional(),
  tags: z.array(z.string()),
});

export const RunTerminatedEventSchema = BaseEventSchema.extend({
  event: z.literal('run_terminated'),
  run_id: z.string(),
  outcome: z.string(),
  reason: z.string(),
  session_id: z.string().nullable().optional(),
  tags: z.array(z.string()),
});

export const RunFailedEventSchema = BaseEventSchema.extend({
  event: z.literal('run_failed'),
  run_id: z.string(),
  outcome: z.string(),
  reason: z.string(),
  session_id: z.string().nullable().optional(),
  tags: z.array(z.string()),
  error: z.string(),
});

export const StreamEventSchema = BaseEventSchema.extend({
  event: z.literal('stream'),
  run_id: z.string(),
  chunk: z.string(),
  chunk_type: z.string(),
});

export const StatusEventSchema = BaseEventSchema.extend({
  event: z.literal('status'),
  active_run_id: z.string().nullable().optional(),
});

export const ErrorEventSchema = BaseEventSchema.extend({
  event: z.literal('error'),
  error: z.string(),
  payload: z.union([z.string(), z.object({}).passthrough(), z.null()]).optional(),
  active_run_id: z.string().nullable().optional(),
});

export const FatalEventSchema = BaseEventSchema.extend({
  event: z.literal('fatal'),
  error: z.string(),
  traceback: z.string(),
});

export const SignalEventSchema = BaseEventSchema.extend({
  event: z.literal('signal'),
  signal: z.number(),
});

export const StateEventSchema = BaseEventSchema.extend({
  event: z.literal('state'),
});

export const CancelRequestedEventSchema = BaseEventSchema.extend({
  event: z.literal('cancel_requested'),
  run_id: z.string(),
});

export const CancelIgnoredEventSchema = BaseEventSchema.extend({
  event: z.literal('cancel_ignored'),
  reason: z.string(),
});

export const LimitNoticeEventSchema = BaseEventSchema.extend({
  event: z.literal('limit_notice'),
  notice: z.string(),
});

export const AutoShutdownEventSchema = BaseEventSchema.extend({
  event: z.literal('auto_shutdown'),
  reason: z.string(),
});

export const EventSchema = z.union([
  ReadyEventSchema,
  ShutdownEventSchema,
  RunStartedEventSchema,
  RunCompletedEventSchema,
  RunCancelledEventSchema,
  RunTerminatedEventSchema,
  RunFailedEventSchema,
  StreamEventSchema,
  StatusEventSchema,
  ErrorEventSchema,
  FatalEventSchema,
  SignalEventSchema,
  StateEventSchema,
  CancelRequestedEventSchema,
  CancelIgnoredEventSchema,
  LimitNoticeEventSchema,
  AutoShutdownEventSchema,
]);

// =============================================================================
// State Schemas
// =============================================================================

export const SessionStateSchema = z.enum(['none', 'initializing', 'active', 'completing', 'terminated']);
export const RunStateSchema = z.enum(['pending', 'starting', 'running', 'streaming', 'cancelling', 'completed', 'failed', 'cancelled', 'terminated']);

export const TransitionTriggerSchema = z.object({
  type: z.enum(['command', 'event', 'timeout', 'error', 'signal', 'completion']),
  value: z.union([z.string(), z.number(), z.object({}).passthrough()]).optional(),
  source: z.string().optional(),
});

export const TransitionConditionSchema = z.object({
  type: z.enum(['state_check', 'variable_check', 'timeout_check', 'resource_check']),
  field: z.string().optional(),
  operator: z.enum(['equals', 'not_equals', 'greater_than', 'less_than', 'exists', 'not_exists']),
  value: z.union([z.string(), z.number(), z.boolean(), z.null()]).optional(),
});

export const TransitionActionSchema = z.object({
  type: z.enum(['emit_event', 'update_variable', 'start_timer', 'stop_timer', 'cleanup', 'notify']),
  target: z.string().optional(),
  value: z.union([z.string(), z.number(), z.object({}).passthrough(), z.null()]).optional(),
  metadata: z.object({}).passthrough().optional(),
});

export const StateTransitionSchema = z.object({
  type: z.literal('state_transition'),
  transition_id: z.string(),
  from_state: z.string(),
  to_state: z.string(),
  trigger: TransitionTriggerSchema,
  conditions: z.array(TransitionConditionSchema).optional(),
  actions: z.array(TransitionActionSchema).optional(),
  timestamp: z.string().datetime(),
});

export const WrapperStateDefinitionSchema = z.object({
  type: z.literal('wrapper_state'),
  state: WrapperStateSchema,
  timestamp: z.string().datetime(),
  metadata: z.object({
    current_run_id: z.string().nullable().optional(),
    last_session_id: z.string().nullable().optional(),
    shutdown_requested: z.boolean().optional(),
    process_id: z.number().nullable().optional(),
  }).optional(),
});

export const SessionStateDefinitionSchema = z.object({
  type: z.literal('session_state'),
  session_id: z.string().nullable().optional(),
  state: SessionStateSchema,
  timestamp: z.string().datetime(),
  metadata: z.object({
    working_directory: z.string().nullable().optional(),
    model: z.string().nullable().optional(),
    permission_mode: z.string().nullable().optional(),
    auto_shutdown: z.boolean().optional(),
  }).optional(),
});

export const RunStateDefinitionSchema = z.object({
  type: z.literal('run_state'),
  run_id: z.string(),
  state: RunStateSchema,
  timestamp: z.string().datetime(),
  metadata: z.object({
    prompt: z.string().optional(),
    session_id: z.string().nullable().optional(),
    start_time: z.string().datetime().optional(),
    end_time: z.string().datetime().nullable().optional(),
    cancel_scope: z.object({}).passthrough().nullable().optional(),
    outcome: z.string().nullable().optional(),
    reason: z.string().nullable().optional(),
    error: z.string().nullable().optional(),
    tags: z.array(z.string()).optional(),
  }).optional(),
});

export const StateDefinitionSchema = z.union([
  WrapperStateDefinitionSchema,
  SessionStateDefinitionSchema,
  RunStateDefinitionSchema,
  StateTransitionSchema,
]);

// =============================================================================
// TypeScript Type Exports
// =============================================================================

export type ClaudeCodeOptions = z.infer<typeof ClaudeCodeOptionsSchema>;
export type PromptCommand = z.infer<typeof PromptCommandSchema>;
export type CancelCommand = z.infer<typeof CancelCommandSchema>;
export type StatusCommand = z.infer<typeof StatusCommandSchema>;
export type ShutdownCommand = z.infer<typeof ShutdownCommandSchema>;
export type LegacyCommand = z.infer<typeof LegacyCommandSchema>;
export type Command = z.infer<typeof CommandSchema>;

export type WrapperState = z.infer<typeof WrapperStateSchema>;
export type BaseEvent = z.infer<typeof BaseEventSchema>;
export type ReadyEvent = z.infer<typeof ReadyEventSchema>;
export type ShutdownEvent = z.infer<typeof ShutdownEventSchema>;
export type RunStartedEvent = z.infer<typeof RunStartedEventSchema>;
export type RunCompletedEvent = z.infer<typeof RunCompletedEventSchema>;
export type RunCancelledEvent = z.infer<typeof RunCancelledEventSchema>;
export type RunTerminatedEvent = z.infer<typeof RunTerminatedEventSchema>;
export type RunFailedEvent = z.infer<typeof RunFailedEventSchema>;
export type StreamEvent = z.infer<typeof StreamEventSchema>;
export type StatusEvent = z.infer<typeof StatusEventSchema>;
export type ErrorEvent = z.infer<typeof ErrorEventSchema>;
export type FatalEvent = z.infer<typeof FatalEventSchema>;
export type SignalEvent = z.infer<typeof SignalEventSchema>;
export type StateEvent = z.infer<typeof StateEventSchema>;
export type CancelRequestedEvent = z.infer<typeof CancelRequestedEventSchema>;
export type CancelIgnoredEvent = z.infer<typeof CancelIgnoredEventSchema>;
export type LimitNoticeEvent = z.infer<typeof LimitNoticeEventSchema>;
export type AutoShutdownEvent = z.infer<typeof AutoShutdownEventSchema>;
export type Event = z.infer<typeof EventSchema>;

export type SessionState = z.infer<typeof SessionStateSchema>;
export type RunState = z.infer<typeof RunStateSchema>;
export type TransitionTrigger = z.infer<typeof TransitionTriggerSchema>;
export type TransitionCondition = z.infer<typeof TransitionConditionSchema>;
export type TransitionAction = z.infer<typeof TransitionActionSchema>;
export type StateTransition = z.infer<typeof StateTransitionSchema>;
export type WrapperStateDefinition = z.infer<typeof WrapperStateDefinitionSchema>;
export type SessionStateDefinition = z.infer<typeof SessionStateDefinitionSchema>;
export type RunStateDefinition = z.infer<typeof RunStateDefinitionSchema>;
export type StateDefinition = z.infer<typeof StateDefinitionSchema>;

// =============================================================================
// Validation Functions
// =============================================================================

export const validateCommand = (data: unknown): Command => {
  return CommandSchema.parse(data);
};

export const validateEvent = (data: unknown): Event => {
  return EventSchema.parse(data);
};

export const validateStateDefinition = (data: unknown): StateDefinition => {
  return StateDefinitionSchema.parse(data);
};

export const validateClaudeCodeOptions = (data: unknown): ClaudeCodeOptions => {
  return ClaudeCodeOptionsSchema.parse(data);
};

// =============================================================================
// Schema Metadata
// =============================================================================

export const SCHEMA_VERSION = '1.0.0';
export const SCHEMA_LAST_UPDATED = new Date().toISOString();

export const SCHEMA_METADATA = {
  version: SCHEMA_VERSION,
  lastUpdated: SCHEMA_LAST_UPDATED,
  description: 'Claude Code wrapper communication protocol schemas',
  commands: {
    supported: ['prompt', 'cancel', 'status', 'shutdown'],
    legacy: ['command'],
  },
  events: {
    lifecycle: ['ready', 'shutdown'],
    execution: ['run_started', 'run_completed', 'run_cancelled', 'run_terminated', 'run_failed'],
    runtime: ['stream', 'status', 'error', 'fatal', 'signal', 'state'],
    control: ['cancel_requested', 'cancel_ignored', 'limit_notice', 'auto_shutdown'],
  },
  states: {
    wrapper: ['idle', 'executing', 'terminating'],
    session: ['none', 'initializing', 'active', 'completing', 'terminated'],
    run: ['pending', 'starting', 'running', 'streaming', 'cancelling', 'completed', 'failed', 'cancelled', 'terminated'],
  },
} as const;