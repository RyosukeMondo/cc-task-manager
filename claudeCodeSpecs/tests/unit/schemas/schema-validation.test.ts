/**
 * Unit tests for JSON Schema validation
 * Tests the schema validation functionality for Claude Code command structures
 */

import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('Schema Validation Tests', () => {
  let ajv: Ajv;
  let commandsSchema: any;
  let eventsSchema: any;
  let statesSchema: any;

  beforeAll(() => {
    // Initialize AJV with proper configuration
    ajv = new Ajv({
      allErrors: true,
      verbose: true,
      strict: true
    });
    addFormats(ajv);

    // Load schema files
    const schemasPath = resolve(__dirname, '../../../schemas');
    commandsSchema = JSON.parse(readFileSync(resolve(schemasPath, 'commands.json'), 'utf8'));
    eventsSchema = JSON.parse(readFileSync(resolve(schemasPath, 'events.json'), 'utf8'));
    statesSchema = JSON.parse(readFileSync(resolve(schemasPath, 'states.json'), 'utf8'));
  });

  describe('Commands Schema', () => {
    let validateCommands: any;

    beforeAll(() => {
      validateCommands = ajv.compile(commandsSchema);
    });

    describe('PromptCommand validation', () => {
      it('should validate valid prompt command', () => {
        const validCommand = {
          action: 'prompt',
          prompt: 'Write a test for this function',
        };

        const isValid = validateCommands(validCommand);
        expect(isValid).toBe(true);
        expect(validateCommands.errors).toBeNull();
      });

      it('should validate prompt command with options', () => {
        const commandWithOptions = {
          action: 'prompt',
          prompt: 'Implement a new feature',
          options: {
            model: 'claude-3-opus',
            maxTokens: 4096,
            temperature: 0.7,
            timeout: 300000,
            permission_mode: 'bypassPermissions',
            cwd: '/workspace',
            auto_shutdown: false
          }
        };

        const isValid = validateCommands(commandWithOptions);
        expect(isValid).toBe(true);
        expect(validateCommands.errors).toBeNull();
      });

      it('should reject prompt command without required action field', () => {
        const invalidCommand = {
          prompt: 'Test prompt'
        };

        const isValid = validateCommands(invalidCommand);
        expect(isValid).toBe(false);
        expect(validateCommands.errors).toContainEqual(
          expect.objectContaining({
            instancePath: '',
            schemaPath: '#/required',
            keyword: 'required',
            params: { missingProperty: 'action' }
          })
        );
      });

      it('should reject prompt command with empty prompt', () => {
        const invalidCommand = {
          action: 'prompt',
          prompt: ''
        };

        const isValid = validateCommands(invalidCommand);
        expect(isValid).toBe(false);
        expect(validateCommands.errors).toContainEqual(
          expect.objectContaining({
            instancePath: '/prompt',
            schemaPath: '#/$defs/PromptCommand/properties/prompt/minLength',
            keyword: 'minLength'
          })
        );
      });

      it('should reject prompt command with invalid options', () => {
        const invalidCommand = {
          action: 'prompt',
          prompt: 'Valid prompt',
          options: {
            temperature: 3.0, // Invalid: max is 2.0
            maxTokens: -100,  // Invalid: minimum is 1
            permission_mode: 'invalidMode' // Invalid enum value
          }
        };

        const isValid = validateCommands(invalidCommand);
        expect(isValid).toBe(false);

        const errors = validateCommands.errors || [];
        expect(errors.some(e => e.keyword === 'maximum')).toBe(true); // temperature
        expect(errors.some(e => e.keyword === 'minimum')).toBe(true); // maxTokens
        expect(errors.some(e => e.keyword === 'enum')).toBe(true); // permission_mode
      });
    });

    describe('CancelCommand validation', () => {
      it('should validate valid cancel command', () => {
        const validCommand = {
          action: 'cancel'
        };

        const isValid = validateCommands(validCommand);
        expect(isValid).toBe(true);
        expect(validateCommands.errors).toBeNull();
      });

      it('should reject cancel command with additional properties', () => {
        const invalidCommand = {
          action: 'cancel',
          extraField: 'not allowed'
        };

        const isValid = validateCommands(invalidCommand);
        expect(isValid).toBe(false);
        expect(validateCommands.errors).toContainEqual(
          expect.objectContaining({
            keyword: 'additionalProperties'
          })
        );
      });
    });

    describe('StatusCommand validation', () => {
      it('should validate valid status command', () => {
        const validCommand = {
          action: 'status'
        };

        const isValid = validateCommands(validCommand);
        expect(isValid).toBe(true);
        expect(validateCommands.errors).toBeNull();
      });
    });

    describe('ShutdownCommand validation', () => {
      it('should validate valid shutdown command', () => {
        const validCommand = {
          action: 'shutdown'
        };

        const isValid = validateCommands(validCommand);
        expect(isValid).toBe(true);
        expect(validateCommands.errors).toBeNull();
      });
    });

    describe('LegacyCommand validation', () => {
      it('should validate valid legacy command', () => {
        const validCommand = {
          command: 'Write tests for this module',
          working_directory: '/workspace/project'
        };

        const isValid = validateCommands(validCommand);
        expect(isValid).toBe(true);
        expect(validateCommands.errors).toBeNull();
      });

      it('should validate legacy command with options', () => {
        const validCommand = {
          command: 'Implement authentication',
          options: {
            model: 'claude-3-sonnet',
            timeout: 600000
          }
        };

        const isValid = validateCommands(validCommand);
        expect(isValid).toBe(true);
        expect(validateCommands.errors).toBeNull();
      });

      it('should reject legacy command without command field', () => {
        const invalidCommand = {
          working_directory: '/workspace'
        };

        const isValid = validateCommands(invalidCommand);
        expect(isValid).toBe(false);
        expect(validateCommands.errors).toContainEqual(
          expect.objectContaining({
            keyword: 'required',
            params: { missingProperty: 'command' }
          })
        );
      });
    });

    describe('ClaudeCodeOptions validation', () => {
      it('should validate all permission modes', () => {
        const permissionModes = ['bypassPermissions', 'default', 'plan', 'acceptEdits'];

        permissionModes.forEach(mode => {
          const command = {
            action: 'prompt',
            prompt: 'Test',
            options: {
              permission_mode: mode
            }
          };

          const isValid = validateCommands(command);
          expect(isValid).toBe(true);
        });
      });

      it('should validate timeout default value', () => {
        const command = {
          action: 'prompt',
          prompt: 'Test',
          options: {
            // timeout not specified, should use default
          }
        };

        const isValid = validateCommands(command);
        expect(isValid).toBe(true);
      });
    });
  });

  describe('Events Schema', () => {
    let validateEvents: any;

    beforeAll(() => {
      validateEvents = ajv.compile(eventsSchema);
    });

    it('should validate stream events', () => {
      const streamEvent = {
        event: 'stream',
        timestamp: new Date().toISOString(),
        payload: {
          type: 'assistant_message',
          content: [
            {
              type: 'text',
              text: 'Processing your request...'
            }
          ]
        }
      };

      const isValid = validateEvents(streamEvent);
      expect(isValid).toBe(true);
      expect(validateEvents.errors).toBeNull();
    });

    it('should validate tool use events', () => {
      const toolEvent = {
        event: 'stream',
        payload: {
          content: [
            {
              type: 'tool_use',
              id: 'toolu_123',
              name: 'Read',
              input: {
                file_path: '/path/to/file'
              }
            }
          ]
        }
      };

      const isValid = validateEvents(toolEvent);
      expect(isValid).toBe(true);
    });

    it('should validate run lifecycle events', () => {
      const runEvents = [
        { event: 'run_started', run_id: 'run_123' },
        { event: 'run_completed', run_id: 'run_123' },
        { event: 'run_failed', run_id: 'run_123', error: 'Test error' }
      ];

      runEvents.forEach(event => {
        const isValid = validateEvents(event);
        expect(isValid).toBe(true);
      });
    });
  });

  describe('States Schema', () => {
    let validateStates: any;

    beforeAll(() => {
      validateStates = ajv.compile(statesSchema);
    });

    it('should validate Claude Code session states', () => {
      const sessionState = {
        session_id: 'session_123',
        state: 'active',
        created_at: new Date().toISOString(),
        last_activity: new Date().toISOString(),
        current_run: {
          run_id: 'run_456',
          status: 'running',
          started_at: new Date().toISOString()
        }
      };

      const isValid = validateStates(sessionState);
      expect(isValid).toBe(true);
      expect(validateStates.errors).toBeNull();
    });

    it('should validate different session states', () => {
      const states = ['idle', 'active', 'processing', 'completed', 'failed'];

      states.forEach(state => {
        const sessionState = {
          session_id: 'session_test',
          state: state,
          created_at: new Date().toISOString()
        };

        const isValid = validateStates(sessionState);
        expect(isValid).toBe(true);
      });
    });
  });

  describe('Cross-schema compatibility', () => {
    it('should handle command-to-event flow', () => {
      // Validate that a command structure is compatible with expected events
      const command = {
        action: 'prompt',
        prompt: 'Generate tests',
        options: {
          model: 'claude-3-opus'
        }
      };

      const expectedEvent = {
        event: 'stream',
        payload: {
          content: [
            {
              type: 'text',
              text: 'I\'ll help you generate tests...'
            }
          ]
        }
      };

      expect(validateCommands(command)).toBe(true);
      expect(validateEvents(expectedEvent)).toBe(true);
    });

    it('should validate complete workflow state transitions', () => {
      const states = [
        { session_id: 'test', state: 'idle' },
        { session_id: 'test', state: 'active' },
        { session_id: 'test', state: 'processing' },
        { session_id: 'test', state: 'completed' }
      ];

      states.forEach(state => {
        expect(validateStates(state)).toBe(true);
      });
    });
  });

  describe('Error handling and edge cases', () => {
    it('should handle malformed JSON gracefully', () => {
      const malformedData = {
        action: 'prompt'
        // Missing required 'prompt' field
      };

      const isValid = validateCommands(malformedData);
      expect(isValid).toBe(false);
      expect(validateCommands.errors).not.toBeNull();
    });

    it('should validate against all schema constraints', () => {
      // Test various constraint violations
      const constraintTests = [
        {
          data: { action: 'prompt', prompt: 'a'.repeat(10000) }, // Very long prompt
          shouldPass: true
        },
        {
          data: { action: 'prompt', prompt: 'test', options: { maxTokens: 0 } }, // Invalid maxTokens
          shouldPass: false
        },
        {
          data: { action: 'invalid_action', prompt: 'test' }, // Invalid action
          shouldPass: false
        }
      ];

      constraintTests.forEach(({ data, shouldPass }) => {
        const isValid = validateCommands(data);
        expect(isValid).toBe(shouldPass);
      });
    });
  });
});