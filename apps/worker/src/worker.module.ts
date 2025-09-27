import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { workerConfig } from '@cc-task-manager/schemas';
import { ProcessManagerService } from './process-manager.service';
import { StateMonitorService } from './state-monitor.service';
import { ClaudeCodeClientService } from './claude-code-client.service';
import { WorkerService } from './worker.service';
import { ClaudeCodeProcessor } from './claude-code.processor';
import { ContractRegistry } from '../../../src/contracts/ContractRegistry';

@Module({
  imports: [
    // Configuration module to load worker config
    ConfigModule.forFeature(workerConfig),
    
    // Event emitter for cross-service coordination
    EventEmitterModule.forRoot(),
    
    // BullMQ configuration for queue processing
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const config = configService.get('worker');
        return {
          connection: {
            host: config?.redisHost || 'localhost',
            port: config?.redisPort || 6379,
            password: config?.redisPassword,
          },
          defaultJobOptions: {
            removeOnComplete: 50, // Keep last 50 completed jobs for monitoring
            removeOnFail: 100,    // Keep last 100 failed jobs for debugging
            attempts: 3,          // Retry failed jobs up to 3 times
            backoff: {
              type: 'exponential',
              delay: 5000,        // Start with 5 second delay
            },
          },
        };
      },
      inject: [ConfigService],
    }),
    
    // Register the claude-code-queue queue
    BullModule.registerQueue({
      name: 'claude-code-queue',
    }),
  ],
  providers: [
    // Core worker services
    ProcessManagerService,
    StateMonitorService,
    ClaudeCodeClientService,
    WorkerService,
    
    // BullMQ processor
    ClaudeCodeProcessor,
    
    // Contract validation
    ContractRegistry,
  ],
  exports: [
    // Export services that might be used by other modules
    WorkerService,
    ProcessManagerService,
    StateMonitorService,
    ClaudeCodeClientService,
    ClaudeCodeProcessor,
    
    // Export BullModule for potential use in other modules
    BullModule,
  ],
})
export class WorkerModule {}