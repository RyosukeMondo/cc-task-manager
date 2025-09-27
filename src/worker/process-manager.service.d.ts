import { ConfigService } from '@nestjs/config';
import { ChildProcess } from 'child_process';
import { ProcessConfig } from '../config/worker.config';
export declare class ProcessManagerService {
    private readonly configService;
    private readonly logger;
    private readonly workerConfig;
    private readonly activeProcesses;
    private readonly processMetadata;
    constructor(configService: ConfigService);
    spawnClaudeProcess(config: ProcessConfig): Promise<ChildProcess>;
    terminateProcess(pid: number): Promise<void>;
    isProcessAlive(pid: number): boolean;
    getProcessHealth(pid: number): {
        isAlive: boolean;
        metadata?: {
            jobId: string;
            sessionName: string;
            startTime: Date;
            uptime: number;
            correlationId: string;
        };
    };
    getActiveProcesses(): number[];
    cleanupOrphanedProcesses(): Promise<void>;
    private setupProcessEventHandlers;
}
