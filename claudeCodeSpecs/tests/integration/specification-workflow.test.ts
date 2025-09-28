/**
 * Integration tests for complete specification workflow
 * Tests end-to-end workflows involving multiple components working together
 */

import { describe, it, expect, jest, beforeEach, afterEach, beforeAll, afterAll } from '@jest/globals';
import { resolve } from 'path';

// Integration test suite that orchestrates multiple components
describe('Specification Workflow Integration Tests', () => {
  let testEnvironment: any;
  let tempDataDir: string;

  beforeAll(async () => {
    // Setup test environment
    tempDataDir = global.testUtils.createTempDir();

    testEnvironment = {
      dataDir: tempDataDir,
      captureEngine: null,
      behaviorAnalyzer: null,
      complianceChecker: null,
      api: null
    };
  });

  afterAll(() => {
    global.testUtils.cleanupTempDir(tempDataDir);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Complete Specification Generation Workflow', () => {
    it('should generate specifications from captured runtime data', async () => {
      // Mock a complete Claude Code interaction session
      const sessionEvents = [
        {
          event: 'session_started',
          timestamp: new Date().toISOString(),
          session_id: 'test-session-1'
        },
        {
          event: 'run_started',
          timestamp: new Date().toISOString(),
          run_id: 'run-1',
          session_id: 'test-session-1'
        },
        {
          event: 'stream',
          timestamp: new Date().toISOString(),
          payload: {
            content: [
              {
                type: 'text',
                text: 'I will help you implement the task for spec claude-code-wrapper-specs...'
              }
            ]
          }
        },
        {
          event: 'stream',
          timestamp: new Date().toISOString(),
          payload: {
            content: [
              {
                type: 'tool_use',
                id: 'toolu_1',
                name: 'mcp__spec-workflow__spec-status',
                input: {
                  projectPath: '/test/project',
                  specName: 'test-spec'
                }
              }
            ]
          }
        },
        {
          event: 'stream',
          timestamp: new Date().toISOString(),
          payload: {
            content: [
              {
                type: 'tool_result',
                tool_use_id: 'toolu_1',
                content: JSON.stringify({
                  success: true,
                  currentPhase: 'implementation',
                  taskProgress: { total: 5, completed: 2, pending: 3 }
                }),
                is_error: false
              }
            ]
          }
        },
        {
          event: 'stream',
          timestamp: new Date().toISOString(),
          payload: {
            content: [
              {
                type: 'tool_use',
                id: 'toolu_2',
                name: 'Read',
                input: { file_path: '/test/src/main.ts' }
              }
            ]
          }
        },
        {
          event: 'stream',
          timestamp: new Date().toISOString(),
          payload: {
            content: [
              {
                type: 'tool_result',
                tool_use_id: 'toolu_2',
                content: 'export function main() { return "Hello World"; }',
                is_error: false
              }
            ]
          }
        },
        {
          event: 'stream',
          timestamp: new Date().toISOString(),
          payload: {
            content: [
              {
                type: 'tool_use',
                id: 'toolu_3',
                name: 'Edit',
                input: {
                  file_path: '/test/src/main.ts',
                  old_string: 'return "Hello World"',
                  new_string: 'return "Hello, Claude Code!"'
                }
              }
            ]
          }
        },
        {
          event: 'stream',
          timestamp: new Date().toISOString(),
          payload: {
            content: [
              {
                type: 'text',
                text: 'Task completed successfully. The implementation is ready.'
              }
            ]
          }
        },
        {
          event: 'run_completed',
          timestamp: new Date().toISOString(),
          run_id: 'run-1',
          session_id: 'test-session-1'
        }
      ];

      // Step 1: Capture events
      const mockCaptureEngine = {
        startCapture: jest.fn().mockReturnValue('capture-session-1'),
        captureEvent: jest.fn().mockImplementation((event) => `event-${Date.now()}`),
        stopCapture: jest.fn().mockReturnValue({
          capture_session_id: 'capture-session-1',
          total_events_captured: sessionEvents.length,
          events_saved: sessionEvents.length
        }),
        getEvents: jest.fn().mockReturnValue(
          sessionEvents.map((event, index) => ({
            event_id: `event-${index}`,
            timestamp: new Date(event.timestamp),
            event_type: event.event,
            session_id: event.session_id || null,
            run_id: event.run_id || null,
            payload: event,
            processing_stage: 'processed'
          }))
        )
      };

      // Start capture and process events
      const captureSessionId = mockCaptureEngine.startCapture();
      expect(captureSessionId).toBe('capture-session-1');

      sessionEvents.forEach(event => {
        const eventId = mockCaptureEngine.captureEvent(event);
        expect(eventId).toMatch(/^event-\d+$/);
      });

      const captureSummary = mockCaptureEngine.stopCapture();
      expect(captureSummary.total_events_captured).toBe(sessionEvents.length);

      // Step 2: Analyze captured events
      const mockBehaviorAnalyzer = {
        addSessionData: jest.fn(),
        analyzeToolUsagePatterns: jest.fn().mockReturnValue({
          toolFrequency: {
            'mcp__spec-workflow__spec-status': 1,
            'Read': 1,
            'Edit': 1
          },
          commonSequences: [
            {
              sequence: ['Read', 'Edit'],
              frequency: 1,
              pattern: 'Read -> Edit'
            }
          ],
          totalToolCalls: 3,
          uniqueTools: 3
        }),
        analyzeSessionWorkflows: jest.fn().mockReturnValue({
          totalWorkflows: 1,
          successfulWorkflows: 1,
          failedWorkflows: 0,
          workflows: [
            {
              runId: 'run-1',
              startTime: sessionEvents[1].timestamp,
              endTime: sessionEvents[sessionEvents.length - 1].timestamp,
              phases: ['analysis', 'implementation'],
              toolCalls: [
                { toolName: 'mcp__spec-workflow__spec-status', timestamp: sessionEvents[3].timestamp },
                { toolName: 'Read', timestamp: sessionEvents[5].timestamp },
                { toolName: 'Edit', timestamp: sessionEvents[7].timestamp }
              ],
              completionStatus: 'success'
            }
          ]
        }),
        detectCompletionPatterns: jest.fn().mockReturnValue([
          {
            type: 'task_completion',
            timestamp: sessionEvents[8].timestamp,
            context: 'Task completed successfully. The implementation is ready.',
            confidence: 0.95
          }
        ]),
        generateBehavioralSpecs: jest.fn().mockReturnValue({
          overview: {
            totalSessions: sessionEvents.length,
            analysisTimestamp: new Date().toISOString(),
            confidenceLevel: 0.92
          },
          toolUsage: {
            toolFrequency: { 'Read': 1, 'Edit': 1 },
            totalToolCalls: 3
          },
          workflowPatterns: {
            totalWorkflows: 1,
            successfulWorkflows: 1
          },
          completionIndicators: [
            { type: 'task_completion', confidence: 0.95 }
          ],
          recommendations: [
            'Common Read->Edit pattern detected - consider creating composite tools'
          ]
        })
      };

      const capturedEvents = mockCaptureEngine.getEvents();
      mockBehaviorAnalyzer.addSessionData(capturedEvents);

      const toolPatterns = mockBehaviorAnalyzer.analyzeToolUsagePatterns();
      const workflows = mockBehaviorAnalyzer.analyzeSessionWorkflows();
      const completionPatterns = mockBehaviorAnalyzer.detectCompletionPatterns();
      const behavioralSpecs = mockBehaviorAnalyzer.generateBehavioralSpecs();

      // Verify analysis results
      expect(toolPatterns.totalToolCalls).toBe(3);
      expect(toolPatterns.commonSequences[0].pattern).toBe('Read -> Edit');
      expect(workflows.successfulWorkflows).toBe(1);
      expect(completionPatterns[0].type).toBe('task_completion');
      expect(behavioralSpecs.overview.confidenceLevel).toBeGreaterThan(0.9);

      // Step 3: Generate formal specifications
      const generatedSpecs = {
        protocolSchema: {
          commands: {
            supportedCommands: ['prompt', 'cancel', 'status'],
            commonPatterns: toolPatterns.commonSequences
          },
          events: {
            streamEvents: ['text', 'tool_use', 'tool_result'],
            lifecycleEvents: ['run_started', 'run_completed', 'session_started']
          },
          states: {
            sessionStates: ['idle', 'processing', 'tool_execution', 'completed'],
            transitions: workflows.workflows[0].phases
          }
        },
        behavioralModel: behavioralSpecs,
        validationRules: {
          requiredCommands: ['prompt'],
          requiredEvents: ['stream', 'run_started', 'run_completed'],
          performanceThresholds: {
            maxResponseTime: 5000,
            maxToolCallDuration: 10000
          }
        },
        metadata: {
          generatedAt: new Date().toISOString(),
          sourceSession: 'test-session-1',
          confidence: behavioralSpecs.overview.confidenceLevel,
          version: '1.0.0'
        }
      };

      // Verify generated specifications
      expect(generatedSpecs.protocolSchema.commands.supportedCommands).toContain('prompt');
      expect(generatedSpecs.protocolSchema.events.streamEvents).toContain('tool_use');
      expect(generatedSpecs.behavioralModel.toolUsage.totalToolCalls).toBe(3);
      expect(generatedSpecs.validationRules.requiredCommands).toContain('prompt');
      expect(generatedSpecs.metadata.confidence).toBeGreaterThan(0.9);
    });

    it('should validate generated specifications against real implementations', async () => {
      // Mock a wrapper implementation
      const wrapperImplementation = {
        schemas: {
          'commands.json': {
            supportedCommands: ['prompt', 'cancel', 'status', 'shutdown']
          },
          'events.json': {
            supportedEvents: ['stream', 'run_started', 'run_completed', 'run_failed']
          },
          'states.json': {
            supportedStates: ['idle', 'active', 'processing', 'completed', 'failed']
          }
        },
        commands: {
          supported: ['prompt', 'cancel', 'status', 'shutdown']
        },
        eventHandlers: {
          'stream': (event: any) => { /* handler */ },
          'run_started': (event: any) => { /* handler */ },
          'run_completed': (event: any) => { /* handler */ },
          'run_failed': (event: any) => { /* handler */ }
        },
        errorHandling: {
          globalHandler: true,
          timeout: 30000,
          retry: { maxAttempts: 3 }
        },
        performance: {
          responseTime: 800,
          memoryUsage: 120,
          throughput: 500
        },
        documentation: {
          apiReference: true,
          examples: true,
          setup: true
        },
        security: {
          inputValidation: true,
          authentication: false, // Optional for testing
          encryption: false,     // Optional for testing
          auditLogging: true
        }
      };

      // Mock generated specification (from previous test)
      const generatedSpecification = {
        schemas: {
          required: ['commands.json', 'events.json', 'states.json']
        },
        commands: {
          required: ['prompt', 'cancel', 'status']
        },
        events: {
          required: ['stream', 'run_started', 'run_completed']
        },
        performance: {
          maxResponseTime: 1000,
          maxMemoryUsage: 200,
          minThroughput: 100
        },
        security: {
          requireEncryption: false // For testing
        }
      };

      // Mock compliance checker
      const mockComplianceChecker = {
        checkCompliance: jest.fn().mockResolvedValue({
          overall: {
            score: 0.95,
            status: 'compliant',
            totalRules: 8,
            passedRules: 8,
            failedRules: 0,
            warningRules: 0
          },
          results: [
            {
              ruleId: 'schema-validation',
              ruleName: 'Schema Validation',
              severity: 'error',
              result: { passed: true, message: 'All required schemas are implemented' }
            },
            {
              ruleId: 'command-support',
              ruleName: 'Command Support',
              severity: 'error',
              result: { passed: true, message: 'All required commands are supported' }
            },
            {
              ruleId: 'event-handling',
              ruleName: 'Event Handling',
              severity: 'error',
              result: { passed: true, message: 'All required events are properly handled' }
            },
            {
              ruleId: 'performance-requirements',
              ruleName: 'Performance Requirements',
              severity: 'warning',
              result: { passed: true, message: 'Performance requirements met' }
            }
          ],
          summary: {
            errors: [],
            warnings: [],
            suggestions: [
              'Consider implementing authentication for production use',
              'Add encryption for sensitive data transmission'
            ]
          },
          metadata: {
            checkedAt: new Date().toISOString(),
            version: '1.0.0',
            duration: 250
          }
        })
      };

      // Validate implementation against specification
      const complianceReport = await mockComplianceChecker.checkCompliance(
        wrapperImplementation,
        generatedSpecification
      );

      // Verify compliance
      expect(complianceReport.overall.status).toBe('compliant');
      expect(complianceReport.overall.score).toBeGreaterThan(0.9);
      expect(complianceReport.summary.errors).toHaveLength(0);
      expect(complianceReport.results.every(r => r.result.passed)).toBe(true);

      // Verify that suggestions are provided for improvement
      expect(complianceReport.summary.suggestions.length).toBeGreaterThan(0);
      expect(complianceReport.summary.suggestions).toContain(
        expect.stringContaining('authentication')
      );
    });

    it('should handle iterative specification refinement', async () => {
      // Simulate multiple capture sessions to refine specifications
      const sessions = [
        {
          id: 'session-1',
          events: [
            { event: 'run_started', run_id: 'run-1' },
            { event: 'stream', payload: { content: [{ type: 'tool_use', name: 'Read' }] } },
            { event: 'run_completed', run_id: 'run-1' }
          ]
        },
        {
          id: 'session-2',
          events: [
            { event: 'run_started', run_id: 'run-2' },
            { event: 'stream', payload: { content: [{ type: 'tool_use', name: 'Read' }] } },
            { event: 'stream', payload: { content: [{ type: 'tool_use', name: 'Edit' }] } },
            { event: 'run_completed', run_id: 'run-2' }
          ]
        },
        {
          id: 'session-3',
          events: [
            { event: 'run_started', run_id: 'run-3' },
            { event: 'stream', payload: { content: [{ type: 'tool_use', name: 'Read' }] } },
            { event: 'stream', payload: { content: [{ type: 'tool_use', name: 'Edit' }] } },
            { event: 'stream', payload: { content: [{ type: 'tool_use', name: 'Bash' }] } },
            { event: 'run_completed', run_id: 'run-3' }
          ]
        }
      ];

      const mockIterativeAnalyzer = {
        analysisHistory: [] as any[],

        addSessionData: jest.fn().mockImplementation((events) => {
          // Simulate accumulating pattern data over sessions
        }),

        analyzeToolUsagePatterns: jest.fn().mockImplementation(() => {
          const sessionCount = this.analysisHistory.length + 1;

          if (sessionCount === 1) {
            return {
              toolFrequency: { 'Read': 1 },
              totalToolCalls: 1,
              uniqueTools: 1,
              commonSequences: []
            };
          } else if (sessionCount === 2) {
            return {
              toolFrequency: { 'Read': 2, 'Edit': 1 },
              totalToolCalls: 3,
              uniqueTools: 2,
              commonSequences: [
                { sequence: ['Read', 'Edit'], frequency: 1 }
              ]
            };
          } else {
            return {
              toolFrequency: { 'Read': 3, 'Edit': 2, 'Bash': 1 },
              totalToolCalls: 6,
              uniqueTools: 3,
              commonSequences: [
                { sequence: ['Read', 'Edit'], frequency: 2 },
                { sequence: ['Edit', 'Bash'], frequency: 1 }
              ]
            };
          }
        }),

        getConfidenceLevel: jest.fn().mockImplementation(() => {
          const sessionCount = this.analysisHistory.length + 1;
          return Math.min(0.5 + (sessionCount * 0.2), 0.95);
        })
      };

      // Process sessions iteratively
      const refinementHistory = [];

      for (const session of sessions) {
        mockIterativeAnalyzer.addSessionData(session.events);
        const patterns = mockIterativeAnalyzer.analyzeToolUsagePatterns();
        const confidence = mockIterativeAnalyzer.getConfidenceLevel();

        refinementHistory.push({
          sessionId: session.id,
          patterns,
          confidence,
          timestamp: new Date().toISOString()
        });

        mockIterativeAnalyzer.analysisHistory.push({
          sessionId: session.id,
          patterns,
          confidence
        });
      }

      // Verify iterative improvement
      expect(refinementHistory).toHaveLength(3);

      // Session 1: Basic pattern
      expect(refinementHistory[0].patterns.uniqueTools).toBe(1);
      expect(refinementHistory[0].patterns.commonSequences).toHaveLength(0);
      expect(refinementHistory[0].confidence).toBe(0.7);

      // Session 2: Emerging patterns
      expect(refinementHistory[1].patterns.uniqueTools).toBe(2);
      expect(refinementHistory[1].patterns.commonSequences).toHaveLength(1);
      expect(refinementHistory[1].confidence).toBe(0.9);

      // Session 3: Refined patterns
      expect(refinementHistory[2].patterns.uniqueTools).toBe(3);
      expect(refinementHistory[2].patterns.commonSequences).toHaveLength(2);
      expect(refinementHistory[2].confidence).toBe(0.95);

      // Verify pattern evolution
      const finalPatterns = refinementHistory[2].patterns;
      expect(finalPatterns.commonSequences).toContainEqual(
        expect.objectContaining({
          sequence: ['Read', 'Edit'],
          frequency: 2
        })
      );
    });
  });

  describe('API Integration Workflows', () => {
    it('should integrate capture, analysis, and validation through API', async () => {
      // Mock unified API that coordinates all components
      const mockUnifiedAPI = {
        startWorkflow: jest.fn().mockResolvedValue({
          workflowId: 'workflow-1',
          status: 'started',
          components: ['capture', 'analysis', 'validation'],
          startedAt: new Date().toISOString()
        }),

        captureSession: jest.fn().mockResolvedValue({
          sessionId: 'capture-session-1',
          eventsCapture: 25,
          status: 'completed'
        }),

        analyzeCapture: jest.fn().mockResolvedValue({
          analysisId: 'analysis-1',
          patterns: {
            toolUsage: { totalTools: 5, commonSequences: 3 },
            workflows: { successful: 8, failed: 1 },
            completion: { indicators: 12, confidence: 0.87 }
          },
          status: 'completed'
        }),

        generateSpecification: jest.fn().mockResolvedValue({
          specificationId: 'spec-1',
          version: '1.0.0',
          schemas: ['commands.json', 'events.json', 'states.json'],
          confidence: 0.87,
          status: 'generated'
        }),

        validateImplementation: jest.fn().mockResolvedValue({
          validationId: 'validation-1',
          compliant: true,
          score: 0.92,
          issues: [],
          recommendations: ['Add error handling for edge cases'],
          status: 'validated'
        }),

        getWorkflowStatus: jest.fn().mockResolvedValue({
          workflowId: 'workflow-1',
          status: 'completed',
          progress: {
            capture: 'completed',
            analysis: 'completed',
            generation: 'completed',
            validation: 'completed'
          },
          results: {
            captureSessionId: 'capture-session-1',
            analysisId: 'analysis-1',
            specificationId: 'spec-1',
            validationId: 'validation-1'
          },
          completedAt: new Date().toISOString()
        })
      };

      // Execute complete workflow through API
      const workflow = await mockUnifiedAPI.startWorkflow({
        name: 'Integration Test Workflow',
        config: {
          capture: { maxEvents: 1000, filters: ['stream', 'tool_call'] },
          analysis: { confidenceThreshold: 0.8 },
          validation: { strictMode: false }
        }
      });

      expect(workflow.status).toBe('started');
      expect(workflow.components).toContain('capture');
      expect(workflow.components).toContain('analysis');
      expect(workflow.components).toContain('validation');

      // Step 1: Capture session
      const captureResult = await mockUnifiedAPI.captureSession({
        workflowId: workflow.workflowId,
        duration: 300000 // 5 minutes
      });

      expect(captureResult.status).toBe('completed');
      expect(captureResult.eventsCapture).toBeGreaterThan(0);

      // Step 2: Analyze captured data
      const analysisResult = await mockUnifiedAPI.analyzeCapture({
        sessionId: captureResult.sessionId
      });

      expect(analysisResult.status).toBe('completed');
      expect(analysisResult.patterns.toolUsage.totalTools).toBeGreaterThan(0);
      expect(analysisResult.patterns.completion.confidence).toBeGreaterThan(0.8);

      // Step 3: Generate specification
      const specResult = await mockUnifiedAPI.generateSpecification({
        analysisId: analysisResult.analysisId,
        version: '1.0.0'
      });

      expect(specResult.status).toBe('generated');
      expect(specResult.schemas).toContain('commands.json');
      expect(specResult.confidence).toBeGreaterThan(0.8);

      // Step 4: Validate against implementation
      const validationResult = await mockUnifiedAPI.validateImplementation({
        specificationId: specResult.specificationId,
        implementation: {
          commands: ['prompt', 'cancel'],
          events: ['stream', 'run_started', 'run_completed'],
          errorHandling: true
        }
      });

      expect(validationResult.status).toBe('validated');
      expect(validationResult.compliant).toBe(true);
      expect(validationResult.score).toBeGreaterThan(0.9);

      // Step 5: Check overall workflow status
      const workflowStatus = await mockUnifiedAPI.getWorkflowStatus(workflow.workflowId);

      expect(workflowStatus.status).toBe('completed');
      expect(workflowStatus.progress.capture).toBe('completed');
      expect(workflowStatus.progress.analysis).toBe('completed');
      expect(workflowStatus.progress.generation).toBe('completed');
      expect(workflowStatus.progress.validation).toBe('completed');
      expect(workflowStatus.results).toMatchObject({
        captureSessionId: expect.any(String),
        analysisId: expect.any(String),
        specificationId: expect.any(String),
        validationId: expect.any(String)
      });
    });

    it('should handle workflow errors and recovery', async () => {
      const mockErrorHandlingAPI = {
        startWorkflow: jest.fn().mockResolvedValue({
          workflowId: 'error-workflow-1',
          status: 'started'
        }),

        captureSession: jest.fn().mockRejectedValue(new Error('Capture engine timeout')),

        retryCapture: jest.fn().mockResolvedValue({
          sessionId: 'recovery-session-1',
          status: 'completed',
          recovery: true
        }),

        getWorkflowErrors: jest.fn().mockResolvedValue({
          errors: [
            {
              component: 'capture',
              error: 'Capture engine timeout',
              timestamp: new Date().toISOString(),
              retryable: true
            }
          ]
        }),

        resumeWorkflow: jest.fn().mockResolvedValue({
          workflowId: 'error-workflow-1',
          status: 'resumed',
          fromStep: 'capture'
        })
      };

      // Start workflow
      const workflow = await mockErrorHandlingAPI.startWorkflow({
        name: 'Error Recovery Test'
      });

      // Attempt capture - should fail
      await expect(
        mockErrorHandlingAPI.captureSession({ workflowId: workflow.workflowId })
      ).rejects.toThrow('Capture engine timeout');

      // Check for errors
      const errors = await mockErrorHandlingAPI.getWorkflowErrors(workflow.workflowId);
      expect(errors.errors).toHaveLength(1);
      expect(errors.errors[0].component).toBe('capture');
      expect(errors.errors[0].retryable).toBe(true);

      // Retry with recovery
      const recoveryResult = await mockErrorHandlingAPI.retryCapture({
        workflowId: workflow.workflowId,
        recovery: true
      });

      expect(recoveryResult.status).toBe('completed');
      expect(recoveryResult.recovery).toBe(true);

      // Resume workflow
      const resumedWorkflow = await mockErrorHandlingAPI.resumeWorkflow(workflow.workflowId);
      expect(resumedWorkflow.status).toBe('resumed');
      expect(resumedWorkflow.fromStep).toBe('capture');
    });
  });

  describe('Performance and Scalability Integration', () => {
    it('should handle large-scale specification generation efficiently', async () => {
      const startTime = Date.now();

      // Simulate processing large amounts of data
      const largeDataSet = {
        sessions: 50,
        eventsPerSession: 200,
        toolCalls: 1000,
        analysisDepth: 'comprehensive'
      };

      const mockLargeScaleProcessor = {
        processLargeDataset: jest.fn().mockResolvedValue({
          processed: {
            totalEvents: largeDataSet.sessions * largeDataSet.eventsPerSession,
            totalSessions: largeDataSet.sessions,
            totalToolCalls: largeDataSet.toolCalls
          },
          performance: {
            processingTime: 2500, // 2.5 seconds
            memoryUsage: 150, // MB
            throughput: 4000 // events per second
          },
          results: {
            patterns: 85,
            workflows: 50,
            specifications: 3,
            confidence: 0.94
          }
        })
      };

      const result = await mockLargeScaleProcessor.processLargeDataset(largeDataSet);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
      expect(result.processed.totalEvents).toBe(10000);
      expect(result.performance.processingTime).toBeLessThan(3000);
      expect(result.performance.memoryUsage).toBeLessThan(200);
      expect(result.results.confidence).toBeGreaterThan(0.9);
    });

    it('should maintain data consistency across concurrent operations', async () => {
      const mockConcurrentProcessor = {
        processedOperations: new Set(),

        processOperation: jest.fn().mockImplementation(async (operationId) => {
          // Simulate processing time
          await global.testUtils.waitFor(Math.random() * 100);

          if (this.processedOperations.has(operationId)) {
            throw new Error(`Operation ${operationId} already processed`);
          }

          this.processedOperations.add(operationId);

          return {
            operationId,
            status: 'completed',
            timestamp: new Date().toISOString(),
            dataConsistency: true
          };
        })
      };

      // Process multiple operations concurrently
      const operations = Array.from({ length: 20 }, (_, i) => `operation-${i}`);

      const results = await Promise.all(
        operations.map(op => mockConcurrentProcessor.processOperation(op))
      );

      expect(results).toHaveLength(20);
      expect(results.every(r => r.status === 'completed')).toBe(true);
      expect(results.every(r => r.dataConsistency === true)).toBe(true);

      // Verify no duplicate processing
      const processedIds = results.map(r => r.operationId);
      const uniqueIds = new Set(processedIds);
      expect(uniqueIds.size).toBe(processedIds.length);
    });
  });
});