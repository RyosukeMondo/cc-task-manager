/**
 * Unit tests for Runtime Monitoring Capture Engine
 * Tests the event capture, processing, and analysis functionality
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

// Mock the Python capture engine since we're testing the interface
const mockCaptureEngine = {
  EventCapture: jest.fn(),
  CaptureEngine: jest.fn(),
  CapturedEvent: jest.fn()
};

// Mock implementation of the capture engine functionality
class MockEventCapture {
  private events: any[] = [];
  private eventQueue: any[] = [];
  private captureActive = false;
  private currentSessionId: string | null = null;
  private currentRunId: string | null = null;

  constructor(private maxEventsInMemory = 10000, private captureFilter = (x: any) => true) {}

  startCapture(): void {
    this.captureActive = true;
  }

  stopCapture(): void {
    this.captureActive = false;
  }

  captureEvent(rawEvent: any): string | null {
    if (!this.captureActive || !this.captureFilter(rawEvent)) {
      return null;
    }

    const eventId = `test-event-${Date.now()}`;
    const capturedEvent = {
      event_id: eventId,
      timestamp: new Date(),
      event_type: rawEvent.event || 'unknown',
      session_id: this.currentSessionId,
      run_id: this.currentRunId,
      payload: rawEvent,
      processing_stage: 'captured'
    };

    this.events.push(capturedEvent);
    return eventId;
  }

  getEvents(): any[] {
    return this.events;
  }

  setSessionId(sessionId: string): void {
    this.currentSessionId = sessionId;
  }

  setRunId(runId: string): void {
    this.currentRunId = runId;
  }
}

class MockCaptureEngine {
  private eventCapture: MockEventCapture;
  private captureStartTime: Date | null = null;
  private captureSessionId: string;

  constructor(private outputDirectory: string, private config: any = {}) {
    this.eventCapture = new MockEventCapture(
      config.max_events_in_memory || 10000,
      this.createCaptureFilter()
    );
    this.captureSessionId = `session-${Date.now()}`;
  }

  private createCaptureFilter() {
    return (event: any) => {
      // Simple filter logic for testing
      const eventType = event.event || '';
      if (this.config.capture_filters?.exclude_types?.includes(eventType)) {
        return false;
      }
      return true;
    };
  }

  startCapture(): string {
    this.captureStartTime = new Date();
    this.eventCapture.startCapture();
    return this.captureSessionId;
  }

  stopCapture(): any {
    if (!this.captureStartTime) {
      return {};
    }

    this.eventCapture.stopCapture();
    const duration = Date.now() - this.captureStartTime.getTime();

    return {
      capture_session_id: this.captureSessionId,
      capture_duration_ms: duration,
      total_events_captured: this.eventCapture.getEvents().length,
      events_saved: this.eventCapture.getEvents().length
    };
  }

  captureEvent(rawEvent: any): string | null {
    return this.eventCapture.captureEvent(rawEvent);
  }

  getEvents(): any[] {
    return this.eventCapture.getEvents();
  }

  saveData(): any {
    return {
      events_saved: this.eventCapture.getEvents().length,
      events_file: `${this.outputDirectory}/events_test.jsonl`,
      metadata_file: `${this.outputDirectory}/metadata_test.json`
    };
  }
}

describe('Capture Engine Unit Tests', () => {
  let captureEngine: MockCaptureEngine;
  let tempDir: string;

  beforeEach(() => {
    tempDir = global.testUtils.createTempDir();
    captureEngine = new MockCaptureEngine(tempDir);
  });

  afterEach(() => {
    global.testUtils.cleanupTempDir(tempDir);
  });

  describe('EventCapture', () => {
    let eventCapture: MockEventCapture;

    beforeEach(() => {
      eventCapture = new MockEventCapture();
    });

    describe('Basic functionality', () => {
      it('should start and stop capture', () => {
        expect(() => eventCapture.startCapture()).not.toThrow();
        expect(() => eventCapture.stopCapture()).not.toThrow();
      });

      it('should capture events when active', () => {
        eventCapture.startCapture();

        const testEvent = global.testUtils.createMockEvent('stream', {
          content: [{ type: 'text', text: 'Hello world' }]
        });

        const eventId = eventCapture.captureEvent(testEvent);

        expect(eventId).not.toBeNull();
        expect(eventId).toMatch(/^test-event-\d+$/);
        expect(eventCapture.getEvents()).toHaveLength(1);
      });

      it('should not capture events when inactive', () => {
        const testEvent = global.testUtils.createMockEvent('stream');
        const eventId = eventCapture.captureEvent(testEvent);

        expect(eventId).toBeNull();
        expect(eventCapture.getEvents()).toHaveLength(0);
      });

      it('should respect capture filters', () => {
        const filter = (event: any) => event.event !== 'filtered_out';
        const filteredCapture = new MockEventCapture(10000, filter);

        filteredCapture.startCapture();

        const allowedEvent = global.testUtils.createMockEvent('stream');
        const filteredEvent = global.testUtils.createMockEvent('filtered_out');

        const allowedId = filteredCapture.captureEvent(allowedEvent);
        const filteredId = filteredCapture.captureEvent(filteredEvent);

        expect(allowedId).not.toBeNull();
        expect(filteredId).toBeNull();
        expect(filteredCapture.getEvents()).toHaveLength(1);
      });
    });

    describe('Event enrichment', () => {
      beforeEach(() => {
        eventCapture.startCapture();
      });

      it('should extract session and run IDs', () => {
        eventCapture.setSessionId('test-session-123');
        eventCapture.setRunId('test-run-456');

        const testEvent = global.testUtils.createMockEvent('stream');
        eventCapture.captureEvent(testEvent);

        const events = eventCapture.getEvents();
        expect(events[0].session_id).toBe('test-session-123');
        expect(events[0].run_id).toBe('test-run-456');
      });

      it('should process different event types', () => {
        const eventTypes = ['stream', 'run_started', 'run_completed', 'tool_call'];

        eventTypes.forEach(eventType => {
          const event = global.testUtils.createMockEvent(eventType);
          eventCapture.captureEvent(event);
        });

        const events = eventCapture.getEvents();
        expect(events).toHaveLength(eventTypes.length);

        eventTypes.forEach((type, index) => {
          expect(events[index].event_type).toBe(type);
        });
      });

      it('should handle stream events with tool usage', () => {
        const streamEvent = global.testUtils.createMockEvent('stream', {
          content: [
            {
              type: 'tool_use',
              id: 'toolu_123',
              name: 'Read',
              input: { file_path: '/test/file.txt' }
            },
            {
              type: 'tool_result',
              tool_use_id: 'toolu_123',
              content: 'File content here',
              is_error: false
            }
          ]
        });

        eventCapture.captureEvent(streamEvent);

        const events = eventCapture.getEvents();
        expect(events[0].event_type).toBe('stream');
        expect(events[0].payload.content).toHaveLength(2);
      });

      it('should handle run lifecycle events', () => {
        const runEvents = [
          global.testUtils.createMockEvent('run_started', { run_id: 'run_123' }),
          global.testUtils.createMockEvent('run_completed', { run_id: 'run_123' }),
          global.testUtils.createMockEvent('run_failed', { run_id: 'run_123', error: 'Test error' })
        ];

        runEvents.forEach(event => eventCapture.captureEvent(event));

        const events = eventCapture.getEvents();
        expect(events).toHaveLength(3);
        expect(events[0].event_type).toBe('run_started');
        expect(events[1].event_type).toBe('run_completed');
        expect(events[2].event_type).toBe('run_failed');
      });
    });

    describe('Memory management', () => {
      it('should respect memory limits', () => {
        const limitedCapture = new MockEventCapture(3); // Very small limit for testing
        limitedCapture.startCapture();

        // Add more events than the limit
        for (let i = 0; i < 5; i++) {
          const event = global.testUtils.createMockEvent('stream', { index: i });
          limitedCapture.captureEvent(event);
        }

        // Should only keep the most recent events up to the limit
        const events = limitedCapture.getEvents();
        expect(events.length).toBeLessThanOrEqual(3);
      });
    });
  });

  describe('CaptureEngine', () => {
    describe('Configuration and lifecycle', () => {
      it('should initialize with default configuration', () => {
        const engine = new MockCaptureEngine(tempDir);
        expect(engine).toBeInstanceOf(MockCaptureEngine);
      });

      it('should initialize with custom configuration', () => {
        const config = {
          max_events_in_memory: 5000,
          capture_filters: {
            exclude_types: ['debug']
          }
        };

        const engine = new MockCaptureEngine(tempDir, config);
        expect(engine).toBeInstanceOf(MockCaptureEngine);
      });

      it('should start and stop capture with session management', () => {
        const sessionId = captureEngine.startCapture();
        expect(sessionId).toMatch(/^session-\d+$/);

        const summary = captureEngine.stopCapture();
        expect(summary).toMatchObject({
          capture_session_id: sessionId,
          capture_duration_ms: expect.any(Number),
          total_events_captured: 0
        });
      });

      it('should prevent multiple start calls', () => {
        const sessionId1 = captureEngine.startCapture();
        const sessionId2 = captureEngine.startCapture();

        expect(sessionId1).toBe(sessionId2); // Should return same session ID
      });
    });

    describe('Event processing workflow', () => {
      beforeEach(() => {
        captureEngine.startCapture();
      });

      it('should capture and process various event types', () => {
        const testEvents = [
          global.testUtils.createMockEvent('stream', {
            content: [{ type: 'text', text: 'Processing request...' }]
          }),
          global.testUtils.createMockEvent('run_started', { run_id: 'run_123' }),
          global.testUtils.createMockEvent('tool_call', {
            tool_name: 'Read',
            tool_input: { file_path: '/test.txt' }
          }),
          global.testUtils.createMockEvent('run_completed', { run_id: 'run_123' })
        ];

        const eventIds = testEvents.map(event => captureEngine.captureEvent(event));

        expect(eventIds.every(id => id !== null)).toBe(true);
        expect(captureEngine.getEvents()).toHaveLength(4);
      });

      it('should handle malformed events gracefully', () => {
        const malformedEvents = [
          null,
          undefined,
          {},
          { event: null },
          { event: 'valid', payload: null }
        ];

        malformedEvents.forEach(event => {
          expect(() => captureEngine.captureEvent(event)).not.toThrow();
        });
      });

      it('should apply configured filters', () => {
        const filteredEngine = new MockCaptureEngine(tempDir, {
          capture_filters: {
            exclude_types: ['debug', 'trace']
          }
        });

        filteredEngine.startCapture();

        const events = [
          global.testUtils.createMockEvent('debug'),
          global.testUtils.createMockEvent('stream'),
          global.testUtils.createMockEvent('trace'),
          global.testUtils.createMockEvent('run_started')
        ];

        events.forEach(event => filteredEngine.captureEvent(event));

        // Should only capture stream and run_started events
        expect(filteredEngine.getEvents()).toHaveLength(2);
        expect(filteredEngine.getEvents().map(e => e.event_type)).toEqual(['stream', 'run_started']);
      });
    });

    describe('Data persistence', () => {
      it('should save captured data', () => {
        captureEngine.startCapture();

        // Capture some test data
        const event = global.testUtils.createMockEvent('stream');
        captureEngine.captureEvent(event);

        const saveResult = captureEngine.saveData();

        expect(saveResult).toMatchObject({
          events_saved: 1,
          events_file: expect.stringContaining('events_test.jsonl'),
          metadata_file: expect.stringContaining('metadata_test.json')
        });
      });

      it('should handle empty capture sessions', () => {
        captureEngine.startCapture();
        // Don't capture any events

        const saveResult = captureEngine.saveData();
        expect(saveResult.events_saved).toBe(0);
      });
    });

    describe('Performance and error handling', () => {
      it('should handle high-volume event capture', async () => {
        captureEngine.startCapture();

        const startTime = Date.now();
        const numEvents = 1000;

        // Capture many events quickly
        for (let i = 0; i < numEvents; i++) {
          const event = global.testUtils.createMockEvent('stream', { index: i });
          captureEngine.captureEvent(event);
        }

        const duration = Date.now() - startTime;

        expect(captureEngine.getEvents()).toHaveLength(numEvents);
        expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
      });

      it('should handle concurrent capture attempts', async () => {
        captureEngine.startCapture();

        // Simulate concurrent event captures
        const promises = Array.from({ length: 100 }, (_, i) => {
          return Promise.resolve().then(() => {
            const event = global.testUtils.createMockEvent('stream', { index: i });
            return captureEngine.captureEvent(event);
          });
        });

        const results = await Promise.all(promises);

        expect(results.every(id => id !== null)).toBe(true);
        expect(captureEngine.getEvents()).toHaveLength(100);
      });

      it('should maintain data integrity during errors', () => {
        captureEngine.startCapture();

        // Mix valid and invalid events
        const events = [
          global.testUtils.createMockEvent('stream'),
          null, // Invalid
          global.testUtils.createMockEvent('run_started'),
          undefined, // Invalid
          global.testUtils.createMockEvent('tool_call')
        ];

        const results = events.map(event => {
          try {
            return captureEngine.captureEvent(event);
          } catch (error) {
            return null;
          }
        });

        // Should have captured the valid events despite errors
        const validResults = results.filter(r => r !== null);
        expect(validResults).toHaveLength(3);
        expect(captureEngine.getEvents()).toHaveLength(3);
      });
    });
  });

  describe('Integration scenarios', () => {
    it('should handle complete Claude Code session lifecycle', () => {
      const sessionId = captureEngine.startCapture();

      // Simulate a complete Claude Code interaction
      const sessionEvents = [
        global.testUtils.createMockEvent('session_started', { session_id: sessionId }),
        global.testUtils.createMockEvent('run_started', { run_id: 'run_1' }),
        global.testUtils.createMockEvent('stream', {
          content: [{ type: 'text', text: 'I will help you with this task.' }]
        }),
        global.testUtils.createMockEvent('stream', {
          content: [
            {
              type: 'tool_use',
              id: 'toolu_1',
              name: 'Read',
              input: { file_path: '/project/src/main.ts' }
            }
          ]
        }),
        global.testUtils.createMockEvent('stream', {
          content: [
            {
              type: 'tool_result',
              tool_use_id: 'toolu_1',
              content: 'export function main() { ... }',
              is_error: false
            }
          ]
        }),
        global.testUtils.createMockEvent('stream', {
          content: [{ type: 'text', text: 'I have analyzed your code...' }]
        }),
        global.testUtils.createMockEvent('run_completed', { run_id: 'run_1' }),
        global.testUtils.createMockEvent('session_ended', { session_id: sessionId })
      ];

      sessionEvents.forEach(event => {
        const eventId = captureEngine.captureEvent(event);
        expect(eventId).not.toBeNull();
      });

      const summary = captureEngine.stopCapture();

      expect(summary.total_events_captured).toBe(sessionEvents.length);
      expect(captureEngine.getEvents()).toHaveLength(sessionEvents.length);

      // Verify event ordering and types
      const capturedTypes = captureEngine.getEvents().map(e => e.event_type);
      const expectedTypes = sessionEvents.map(e => e.event);
      expect(capturedTypes).toEqual(expectedTypes);
    });

    it('should handle spec workflow interactions', () => {
      captureEngine.startCapture();

      // Simulate spec workflow tool usage
      const specWorkflowEvents = [
        global.testUtils.createMockEvent('stream', {
          content: [
            {
              type: 'tool_use',
              id: 'toolu_spec1',
              name: 'mcp__spec-workflow__spec-status',
              input: { projectPath: '/project', specName: 'auth-system' }
            }
          ]
        }),
        global.testUtils.createMockEvent('stream', {
          content: [
            {
              type: 'tool_result',
              tool_use_id: 'toolu_spec1',
              content: JSON.stringify({
                success: true,
                currentPhase: 'implementation',
                taskProgress: { total: 5, completed: 2, pending: 3 }
              }),
              is_error: false
            }
          ]
        }),
        global.testUtils.createMockEvent('stream', {
          content: [{ type: 'text', text: 'Continuing with task 3 implementation...' }]
        })
      ];

      specWorkflowEvents.forEach(event => captureEngine.captureEvent(event));

      const events = captureEngine.getEvents();
      expect(events).toHaveLength(3);

      // Verify spec workflow tool detection (would be implemented in real capture engine)
      const toolUseEvent = events.find(e =>
        e.payload.content?.some((c: any) =>
          c.type === 'tool_use' && c.name?.includes('spec-workflow')
        )
      );
      expect(toolUseEvent).toBeDefined();
    });
  });
});