/**
 * Unit tests for Behavioral Analysis Engine
 * Tests pattern detection, state machine generation, and behavioral analysis
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

// Mock behavior analyzer functionality
class MockBehaviorAnalyzer {
  private patterns: Map<string, any[]> = new Map();
  private stateMachines: Map<string, any> = new Map();
  private sessionData: any[] = [];

  constructor(private config: any = {}) {}

  addSessionData(events: any[]): void {
    this.sessionData.push(...events);
  }

  detectPatterns(eventType?: string): any[] {
    const allPatterns: any[] = [];

    if (eventType) {
      return this.patterns.get(eventType) || [];
    }

    // Return all patterns if no specific type requested
    for (const [type, patterns] of this.patterns.entries()) {
      allPatterns.push(...patterns.map(p => ({ ...p, type })));
    }

    return allPatterns;
  }

  generateStateMachine(sessionId: string): any {
    const existing = this.stateMachines.get(sessionId);
    if (existing) return existing;

    // Mock state machine generation
    const stateMachine = {
      sessionId,
      states: ['idle', 'processing', 'tool_execution', 'response_generation', 'completed'],
      transitions: [
        { from: 'idle', to: 'processing', trigger: 'prompt_received' },
        { from: 'processing', to: 'tool_execution', trigger: 'tool_call_initiated' },
        { from: 'tool_execution', to: 'processing', trigger: 'tool_result_received' },
        { from: 'processing', to: 'response_generation', trigger: 'analysis_complete' },
        { from: 'response_generation', to: 'completed', trigger: 'response_sent' },
        { from: 'completed', to: 'idle', trigger: 'session_reset' }
      ],
      currentState: 'idle',
      metadata: {
        createdAt: new Date().toISOString(),
        totalTransitions: 0,
        sessionDuration: 0
      }
    };

    this.stateMachines.set(sessionId, stateMachine);
    return stateMachine;
  }

  analyzeToolUsagePatterns(): any {
    const toolUsage = new Map<string, number>();
    const toolSequences: string[][] = [];
    let currentSequence: string[] = [];

    // Analyze session data for tool usage
    this.sessionData.forEach(event => {
      if (event.event_type === 'stream' && event.payload?.content) {
        const content = event.payload.content;
        if (Array.isArray(content)) {
          content.forEach((item: any) => {
            if (item.type === 'tool_use') {
              const toolName = item.name;
              toolUsage.set(toolName, (toolUsage.get(toolName) || 0) + 1);
              currentSequence.push(toolName);
            } else if (item.type === 'text' && currentSequence.length > 0) {
              // End of tool sequence
              toolSequences.push([...currentSequence]);
              currentSequence = [];
            }
          });
        }
      }
    });

    return {
      toolFrequency: Object.fromEntries(toolUsage),
      commonSequences: this.findCommonSequences(toolSequences),
      totalToolCalls: Array.from(toolUsage.values()).reduce((a, b) => a + b, 0),
      uniqueTools: toolUsage.size
    };
  }

  analyzeSessionWorkflows(): any {
    const workflows: any[] = [];
    let currentWorkflow: any = null;

    this.sessionData.forEach((event, index) => {
      if (event.event_type === 'run_started') {
        currentWorkflow = {
          runId: event.run_id,
          startTime: event.timestamp,
          phases: [],
          toolCalls: [],
          completionStatus: 'pending'
        };
      } else if (event.event_type === 'run_completed' || event.event_type === 'run_failed') {
        if (currentWorkflow) {
          currentWorkflow.endTime = event.timestamp;
          currentWorkflow.completionStatus = event.event_type === 'run_completed' ? 'success' : 'failed';
          currentWorkflow.duration = new Date(event.timestamp).getTime() - new Date(currentWorkflow.startTime).getTime();
          workflows.push(currentWorkflow);
          currentWorkflow = null;
        }
      } else if (currentWorkflow && event.event_type === 'stream') {
        this.analyzeStreamForWorkflow(event, currentWorkflow);
      }
    });

    return {
      totalWorkflows: workflows.length,
      successfulWorkflows: workflows.filter(w => w.completionStatus === 'success').length,
      failedWorkflows: workflows.filter(w => w.completionStatus === 'failed').length,
      averageDuration: workflows.length > 0 ?
        workflows.reduce((sum, w) => sum + (w.duration || 0), 0) / workflows.length : 0,
      workflows
    };
  }

  private analyzeStreamForWorkflow(event: any, workflow: any): void {
    const content = event.payload?.content || [];

    content.forEach((item: any) => {
      if (item.type === 'tool_use') {
        workflow.toolCalls.push({
          toolName: item.name,
          timestamp: event.timestamp,
          input: item.input
        });
      } else if (item.type === 'text') {
        // Detect workflow phases based on text content
        const text = item.text.toLowerCase();
        if (text.includes('analyzing') || text.includes('examining')) {
          this.addPhaseIfNew(workflow, 'analysis');
        } else if (text.includes('implementing') || text.includes('creating')) {
          this.addPhaseIfNew(workflow, 'implementation');
        } else if (text.includes('testing') || text.includes('validating')) {
          this.addPhaseIfNew(workflow, 'testing');
        } else if (text.includes('completed') || text.includes('finished')) {
          this.addPhaseIfNew(workflow, 'completion');
        }
      }
    });
  }

  private addPhaseIfNew(workflow: any, phase: string): void {
    if (!workflow.phases.includes(phase)) {
      workflow.phases.push(phase);
    }
  }

  private findCommonSequences(sequences: string[][]): any[] {
    const sequenceCounts = new Map<string, number>();

    // Count all subsequences of length 2 or more
    sequences.forEach(sequence => {
      for (let length = 2; length <= sequence.length; length++) {
        for (let start = 0; start <= sequence.length - length; start++) {
          const subseq = sequence.slice(start, start + length);
          const key = subseq.join(' -> ');
          sequenceCounts.set(key, (sequenceCounts.get(key) || 0) + 1);
        }
      }
    });

    // Return sequences that appear more than once, sorted by frequency
    return Array.from(sequenceCounts.entries())
      .filter(([_, count]) => count > 1)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10) // Top 10 most common
      .map(([sequence, count]) => ({
        sequence: sequence.split(' -> '),
        frequency: count,
        pattern: sequence
      }));
  }

  detectCompletionPatterns(): any {
    const completionPatterns: any[] = [];

    this.sessionData.forEach((event, index) => {
      if (event.event_type === 'stream' && event.payload?.content) {
        const text = this.extractTextContent(event.payload.content);

        // Check for various completion indicators
        const patterns = [
          { pattern: /task.*completed/i, type: 'task_completion' },
          { pattern: /implementation.*finished/i, type: 'implementation_completion' },
          { pattern: /all.*tests.*pass/i, type: 'testing_completion' },
          { pattern: /ready for review/i, type: 'review_ready' },
          { pattern: /specification.*complete/i, type: 'specification_completion' },
          { pattern: /no.*errors?.*found/i, type: 'validation_success' }
        ];

        patterns.forEach(({ pattern, type }) => {
          if (pattern.test(text)) {
            completionPatterns.push({
              type,
              timestamp: event.timestamp,
              context: text.substring(0, 200), // First 200 chars for context
              confidence: this.calculatePatternConfidence(text, pattern)
            });
          }
        });
      }
    });

    return completionPatterns;
  }

  private extractTextContent(content: any[]): string {
    return content
      .filter(item => item.type === 'text')
      .map(item => item.text)
      .join(' ');
  }

  private calculatePatternConfidence(text: string, pattern: RegExp): number {
    // Simple confidence calculation based on context
    const match = text.match(pattern);
    if (!match) return 0;

    let confidence = 0.5; // Base confidence

    // Increase confidence for certain contextual clues
    if (text.includes('successfully')) confidence += 0.2;
    if (text.includes('all')) confidence += 0.1;
    if (text.includes('done') || text.includes('finished')) confidence += 0.1;
    if (text.includes('error') || text.includes('failed')) confidence -= 0.2;

    return Math.min(Math.max(confidence, 0), 1);
  }

  generateBehavioralSpecs(): any {
    const toolPatterns = this.analyzeToolUsagePatterns();
    const workflows = this.analyzeSessionWorkflows();
    const completionPatterns = this.detectCompletionPatterns();

    return {
      overview: {
        totalSessions: this.sessionData.length,
        analysisTimestamp: new Date().toISOString(),
        confidenceLevel: this.calculateOverallConfidence()
      },
      toolUsage: toolPatterns,
      workflowPatterns: workflows,
      completionIndicators: completionPatterns,
      stateTransitions: Array.from(this.stateMachines.values()),
      recommendations: this.generateRecommendations(toolPatterns, workflows)
    };
  }

  private calculateOverallConfidence(): number {
    const dataPoints = this.sessionData.length;
    if (dataPoints === 0) return 0;

    // Confidence increases with more data points, up to a maximum
    const baseConfidence = Math.min(dataPoints / 100, 0.8);

    // Adjust based on data quality
    const hasToolData = this.sessionData.some(e =>
      e.event_type === 'stream' &&
      e.payload?.content?.some((c: any) => c.type === 'tool_use')
    );
    const hasWorkflowData = this.sessionData.some(e =>
      e.event_type === 'run_started' || e.event_type === 'run_completed'
    );

    if (hasToolData) baseConfidence += 0.1;
    if (hasWorkflowData) baseConfidence += 0.1;

    return Math.min(baseConfidence, 1);
  }

  private generateRecommendations(toolPatterns: any, workflows: any): string[] {
    const recommendations: string[] = [];

    // Tool usage recommendations
    if (toolPatterns.totalToolCalls > 50) {
      recommendations.push('High tool usage detected - consider caching frequently accessed data');
    }

    if (toolPatterns.commonSequences.length > 0) {
      recommendations.push(`Common tool sequence detected: ${toolPatterns.commonSequences[0].pattern} - consider creating composite tools`);
    }

    // Workflow recommendations
    if (workflows.failedWorkflows > workflows.successfulWorkflows * 0.2) {
      recommendations.push('High failure rate detected - implement better error handling and validation');
    }

    if (workflows.averageDuration > 60000) { // More than 1 minute
      recommendations.push('Long average workflow duration - consider breaking down complex tasks');
    }

    return recommendations;
  }
}

describe('Behavior Analyzer Unit Tests', () => {
  let analyzer: MockBehaviorAnalyzer;

  beforeEach(() => {
    analyzer = new MockBehaviorAnalyzer({
      minPatternFrequency: 2,
      maxPatterns: 100,
      confidenceThreshold: 0.7
    });
  });

  describe('Pattern Detection', () => {
    it('should detect tool usage patterns', () => {
      const mockEvents = [
        global.testUtils.createMockCapturedEvent('stream'),
        {
          ...global.testUtils.createMockCapturedEvent('stream'),
          payload: {
            content: [
              { type: 'tool_use', name: 'Read', input: { file_path: '/test.ts' } },
              { type: 'tool_result', tool_use_id: 'toolu_1', content: 'file content' }
            ]
          }
        },
        {
          ...global.testUtils.createMockCapturedEvent('stream'),
          payload: {
            content: [
              { type: 'tool_use', name: 'Edit', input: { file_path: '/test.ts' } },
              { type: 'text', text: 'File updated successfully' }
            ]
          }
        }
      ];

      analyzer.addSessionData(mockEvents);
      const patterns = analyzer.analyzeToolUsagePatterns();

      expect(patterns).toMatchObject({
        toolFrequency: {
          'Read': 1,
          'Edit': 1
        },
        totalToolCalls: 2,
        uniqueTools: 2
      });
    });

    it('should identify common tool sequences', () => {
      const mockEvents = Array.from({ length: 5 }, (_, i) => ({
        ...global.testUtils.createMockCapturedEvent('stream'),
        payload: {
          content: [
            { type: 'tool_use', name: 'Read', input: { file_path: `/test${i}.ts` } },
            { type: 'tool_use', name: 'Edit', input: { file_path: `/test${i}.ts` } },
            { type: 'text', text: 'Files processed' }
          ]
        }
      }));

      analyzer.addSessionData(mockEvents);
      const patterns = analyzer.analyzeToolUsagePatterns();

      expect(patterns.commonSequences).toContainEqual(
        expect.objectContaining({
          sequence: ['Read', 'Edit'],
          frequency: 5
        })
      );
    });

    it('should detect completion patterns', () => {
      const completionEvents = [
        {
          ...global.testUtils.createMockCapturedEvent('stream'),
          payload: {
            content: [
              { type: 'text', text: 'Task completed successfully. All tests pass.' }
            ]
          }
        },
        {
          ...global.testUtils.createMockCapturedEvent('stream'),
          payload: {
            content: [
              { type: 'text', text: 'Implementation finished and ready for review.' }
            ]
          }
        }
      ];

      analyzer.addSessionData(completionEvents);
      const patterns = analyzer.detectCompletionPatterns();

      expect(patterns).toHaveLength(3); // task_completion, testing_completion, review_ready
      expect(patterns).toContainEqual(
        expect.objectContaining({
          type: 'task_completion',
          confidence: expect.any(Number)
        })
      );
    });
  });

  describe('State Machine Generation', () => {
    it('should generate basic state machine', () => {
      const sessionId = 'test-session-123';
      const stateMachine = analyzer.generateStateMachine(sessionId);

      expect(stateMachine).toMatchObject({
        sessionId,
        states: expect.arrayContaining(['idle', 'processing', 'completed']),
        transitions: expect.arrayContaining([
          expect.objectContaining({
            from: expect.any(String),
            to: expect.any(String),
            trigger: expect.any(String)
          })
        ]),
        currentState: 'idle'
      });
    });

    it('should reuse existing state machines', () => {
      const sessionId = 'test-session-456';
      const stateMachine1 = analyzer.generateStateMachine(sessionId);
      const stateMachine2 = analyzer.generateStateMachine(sessionId);

      expect(stateMachine1).toBe(stateMachine2);
    });

    it('should create unique state machines per session', () => {
      const session1 = analyzer.generateStateMachine('session-1');
      const session2 = analyzer.generateStateMachine('session-2');

      expect(session1.sessionId).not.toBe(session2.sessionId);
      expect(session1).not.toBe(session2);
    });
  });

  describe('Workflow Analysis', () => {
    it('should analyze complete workflow sessions', () => {
      const workflowEvents = [
        { ...global.testUtils.createMockCapturedEvent('run_started'), run_id: 'run_1', timestamp: new Date('2023-01-01T10:00:00Z') },
        {
          ...global.testUtils.createMockCapturedEvent('stream'),
          payload: {
            content: [
              { type: 'text', text: 'Analyzing the requirements for this task...' }
            ]
          }
        },
        {
          ...global.testUtils.createMockCapturedEvent('stream'),
          payload: {
            content: [
              { type: 'tool_use', name: 'Read', input: { file_path: '/spec.md' } }
            ]
          }
        },
        {
          ...global.testUtils.createMockCapturedEvent('stream'),
          payload: {
            content: [
              { type: 'text', text: 'Implementing the solution...' }
            ]
          }
        },
        { ...global.testUtils.createMockCapturedEvent('run_completed'), run_id: 'run_1', timestamp: new Date('2023-01-01T10:05:00Z') }
      ];

      analyzer.addSessionData(workflowEvents);
      const workflows = analyzer.analyzeSessionWorkflows();

      expect(workflows).toMatchObject({
        totalWorkflows: 1,
        successfulWorkflows: 1,
        failedWorkflows: 0,
        workflows: [
          expect.objectContaining({
            runId: 'run_1',
            completionStatus: 'success',
            phases: expect.arrayContaining(['analysis', 'implementation']),
            toolCalls: expect.arrayContaining([
              expect.objectContaining({ toolName: 'Read' })
            ])
          })
        ]
      });
    });

    it('should handle failed workflows', () => {
      const failedWorkflowEvents = [
        { ...global.testUtils.createMockCapturedEvent('run_started'), run_id: 'run_failed' },
        { ...global.testUtils.createMockCapturedEvent('run_failed'), run_id: 'run_failed', error: 'Timeout error' }
      ];

      analyzer.addSessionData(failedWorkflowEvents);
      const workflows = analyzer.analyzeSessionWorkflows();

      expect(workflows.failedWorkflows).toBe(1);
      expect(workflows.successfulWorkflows).toBe(0);
    });

    it('should calculate workflow metrics', () => {
      const multipleWorkflows = [
        // Workflow 1 - Success (5 minutes)
        { ...global.testUtils.createMockCapturedEvent('run_started'), run_id: 'run_1', timestamp: new Date('2023-01-01T10:00:00Z') },
        { ...global.testUtils.createMockCapturedEvent('run_completed'), run_id: 'run_1', timestamp: new Date('2023-01-01T10:05:00Z') },

        // Workflow 2 - Success (3 minutes)
        { ...global.testUtils.createMockCapturedEvent('run_started'), run_id: 'run_2', timestamp: new Date('2023-01-01T11:00:00Z') },
        { ...global.testUtils.createMockCapturedEvent('run_completed'), run_id: 'run_2', timestamp: new Date('2023-01-01T11:03:00Z') },

        // Workflow 3 - Failed (2 minutes)
        { ...global.testUtils.createMockCapturedEvent('run_started'), run_id: 'run_3', timestamp: new Date('2023-01-01T12:00:00Z') },
        { ...global.testUtils.createMockCapturedEvent('run_failed'), run_id: 'run_3', timestamp: new Date('2023-01-01T12:02:00Z') }
      ];

      analyzer.addSessionData(multipleWorkflows);
      const workflows = analyzer.analyzeSessionWorkflows();

      expect(workflows.totalWorkflows).toBe(3);
      expect(workflows.successfulWorkflows).toBe(2);
      expect(workflows.failedWorkflows).toBe(1);
      expect(workflows.averageDuration).toBeCloseTo((5 * 60 * 1000 + 3 * 60 * 1000 + 2 * 60 * 1000) / 3, -2); // Average in milliseconds
    });
  });

  describe('Behavioral Specification Generation', () => {
    it('should generate comprehensive behavioral specs', () => {
      // Add diverse test data
      const comprehensiveEvents = [
        { ...global.testUtils.createMockCapturedEvent('run_started'), run_id: 'comprehensive_run' },
        {
          ...global.testUtils.createMockCapturedEvent('stream'),
          payload: {
            content: [
              { type: 'tool_use', name: 'Read', input: { file_path: '/src/main.ts' } },
              { type: 'tool_use', name: 'Edit', input: { file_path: '/src/main.ts' } },
              { type: 'text', text: 'Task completed successfully. All tests pass.' }
            ]
          }
        },
        { ...global.testUtils.createMockCapturedEvent('run_completed'), run_id: 'comprehensive_run' }
      ];

      analyzer.addSessionData(comprehensiveEvents);
      const specs = analyzer.generateBehavioralSpecs();

      expect(specs).toMatchObject({
        overview: expect.objectContaining({
          totalSessions: expect.any(Number),
          analysisTimestamp: expect.any(String),
          confidenceLevel: expect.any(Number)
        }),
        toolUsage: expect.objectContaining({
          toolFrequency: expect.any(Object),
          totalToolCalls: expect.any(Number)
        }),
        workflowPatterns: expect.objectContaining({
          totalWorkflows: expect.any(Number),
          successfulWorkflows: expect.any(Number)
        }),
        completionIndicators: expect.any(Array),
        stateTransitions: expect.any(Array),
        recommendations: expect.any(Array)
      });
    });

    it('should provide meaningful recommendations', () => {
      // Create data that should trigger recommendations
      const highVolumeEvents = Array.from({ length: 60 }, (_, i) => ({
        ...global.testUtils.createMockCapturedEvent('stream'),
        payload: {
          content: [
            { type: 'tool_use', name: 'Read', input: { file_path: `/file${i}.ts` } }
          ]
        }
      }));

      analyzer.addSessionData(highVolumeEvents);
      const specs = analyzer.generateBehavioralSpecs();

      expect(specs.recommendations).toContain(
        expect.stringContaining('High tool usage detected')
      );
    });

    it('should calculate confidence levels appropriately', () => {
      // Test with minimal data
      const minimalEvents = [global.testUtils.createMockCapturedEvent('stream')];
      analyzer.addSessionData(minimalEvents);
      let specs = analyzer.generateBehavioralSpecs();
      expect(specs.overview.confidenceLevel).toBeLessThan(0.5);

      // Test with rich data
      const richEvents = Array.from({ length: 100 }, () =>
        global.testUtils.createMockCapturedEvent('stream')
      );
      richEvents.push({ ...global.testUtils.createMockCapturedEvent('run_started'), run_id: 'test' });
      richEvents.push({
        ...global.testUtils.createMockCapturedEvent('stream'),
        payload: { content: [{ type: 'tool_use', name: 'Test', input: {} }] }
      });

      const richAnalyzer = new MockBehaviorAnalyzer();
      richAnalyzer.addSessionData(richEvents);
      specs = richAnalyzer.generateBehavioralSpecs();
      expect(specs.overview.confidenceLevel).toBeGreaterThan(0.8);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle empty session data', () => {
      const patterns = analyzer.analyzeToolUsagePatterns();
      const workflows = analyzer.analyzeSessionWorkflows();
      const completions = analyzer.detectCompletionPatterns();

      expect(patterns.totalToolCalls).toBe(0);
      expect(workflows.totalWorkflows).toBe(0);
      expect(completions).toHaveLength(0);
    });

    it('should handle malformed event data', () => {
      const malformedEvents = [
        null,
        undefined,
        { event_type: 'stream' }, // Missing payload
        { event_type: 'stream', payload: null },
        { event_type: 'stream', payload: { content: null } },
        { event_type: 'stream', payload: { content: 'not_an_array' } }
      ];

      expect(() => {
        analyzer.addSessionData(malformedEvents);
        analyzer.analyzeToolUsagePatterns();
        analyzer.analyzeSessionWorkflows();
        analyzer.detectCompletionPatterns();
      }).not.toThrow();
    });

    it('should handle large datasets efficiently', () => {
      const largeDataset = Array.from({ length: 10000 }, (_, i) =>
        global.testUtils.createMockCapturedEvent('stream')
      );

      const startTime = Date.now();
      analyzer.addSessionData(largeDataset);
      const specs = analyzer.generateBehavioralSpecs();
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
      expect(specs.overview.totalSessions).toBe(10000);
    });

    it('should maintain consistency across multiple analyses', () => {
      const testEvents = [
        global.testUtils.createMockCapturedEvent('run_started'),
        global.testUtils.createMockCapturedEvent('stream'),
        global.testUtils.createMockCapturedEvent('run_completed')
      ];

      analyzer.addSessionData(testEvents);

      const analysis1 = analyzer.generateBehavioralSpecs();
      const analysis2 = analyzer.generateBehavioralSpecs();

      expect(analysis1.overview.totalSessions).toBe(analysis2.overview.totalSessions);
      expect(analysis1.workflowPatterns.totalWorkflows).toBe(analysis2.workflowPatterns.totalWorkflows);
    });
  });
});