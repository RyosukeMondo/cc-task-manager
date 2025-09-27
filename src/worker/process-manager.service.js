"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var ProcessManagerService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProcessManagerService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const child_process_1 = require("child_process");
const crypto_1 = require("crypto");
const worker_config_1 = require("../config/worker.config");
let ProcessManagerService = ProcessManagerService_1 = class ProcessManagerService {
    constructor(configService) {
        this.configService = configService;
        this.logger = new common_1.Logger(ProcessManagerService_1.name);
        this.activeProcesses = new Map();
        this.processMetadata = new Map();
        this.workerConfig = this.configService.get('worker');
    }
    async spawnClaudeProcess(config) {
        const correlationId = (0, crypto_1.randomUUID)();
        try {
            const validatedConfig = (0, worker_config_1.validateProcessConfig)(config);
            this.logger.log('Spawning Claude Code process', {
                correlationId,
                jobId: validatedConfig.jobId,
                sessionName: validatedConfig.sessionName,
                workingDirectory: validatedConfig.workingDirectory,
            });
            const spawnArgs = [
                validatedConfig.wrapperScriptPath,
                '--job-id', validatedConfig.jobId,
                '--session-name', validatedConfig.sessionName,
                '--working-dir', validatedConfig.workingDirectory,
            ];
            const spawnOptions = {
                cwd: validatedConfig.workingDirectory,
                stdio: ['pipe', 'pipe', 'pipe'],
                detached: false,
                windowsHide: true,
                env: {
                    ...process.env,
                    PYTHONUNBUFFERED: validatedConfig.unbuffered ? '1' : '0',
                    PYTHONIOENCODING: 'utf-8',
                },
            };
            const childProcess = (0, child_process_1.spawn)(validatedConfig.pythonExecutable || this.workerConfig.pythonExecutable, spawnArgs, spawnOptions);
            childProcess.on('error', (error) => {
                this.logger.error('Process spawn error', {
                    correlationId,
                    jobId: validatedConfig.jobId,
                    error: error.message,
                    code: error.name,
                });
                throw error;
            });
            if (!childProcess.pid) {
                const error = new Error('Process spawn failed - no PID assigned');
                this.logger.error('Process spawn validation failed', {
                    correlationId,
                    jobId: validatedConfig.jobId,
                    error: error.message,
                });
                throw error;
            }
            this.activeProcesses.set(childProcess.pid, childProcess);
            this.processMetadata.set(childProcess.pid, {
                jobId: validatedConfig.jobId,
                sessionName: validatedConfig.sessionName,
                startTime: new Date(),
                correlationId,
            });
            this.setupProcessEventHandlers(childProcess, correlationId);
            this.logger.log('Claude Code process spawned successfully', {
                correlationId,
                jobId: validatedConfig.jobId,
                pid: childProcess.pid,
                sessionName: validatedConfig.sessionName,
            });
            return childProcess;
        }
        catch (error) {
            this.logger.error('Failed to spawn Claude Code process', {
                correlationId,
                jobId: config.jobId,
                error: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined,
            });
            throw error;
        }
    }
    async terminateProcess(pid) {
        const metadata = this.processMetadata.get(pid);
        const correlationId = metadata?.correlationId || (0, crypto_1.randomUUID)();
        this.logger.log('Initiating process termination', {
            correlationId,
            pid,
            jobId: metadata?.jobId,
        });
        const process = this.activeProcesses.get(pid);
        if (!process) {
            this.logger.warn('Attempted to terminate non-existent process', {
                correlationId,
                pid,
            });
            return;
        }
        try {
            this.logger.log('Sending SIGTERM for graceful shutdown', {
                correlationId,
                pid,
                jobId: metadata?.jobId,
            });
            process.kill('SIGTERM');
            const gracefulShutdownPromise = new Promise((resolve) => {
                const exitHandler = () => {
                    this.logger.log('Process terminated gracefully', {
                        correlationId,
                        pid,
                        jobId: metadata?.jobId,
                    });
                    resolve();
                };
                process.once('exit', exitHandler);
            });
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => {
                    reject(new Error('Graceful shutdown timeout'));
                }, this.workerConfig.gracefulShutdownMs);
            });
            try {
                await Promise.race([gracefulShutdownPromise, timeoutPromise]);
            }
            catch (timeoutError) {
                this.logger.warn('Graceful shutdown timeout, forcing termination with SIGKILL', {
                    correlationId,
                    pid,
                    jobId: metadata?.jobId,
                    timeoutMs: this.workerConfig.gracefulShutdownMs,
                });
                if (this.isProcessAlive(pid)) {
                    process.kill('SIGKILL');
                    this.logger.log('Process force terminated with SIGKILL', {
                        correlationId,
                        pid,
                        jobId: metadata?.jobId,
                    });
                }
            }
        }
        catch (error) {
            this.logger.error('Error during process termination', {
                correlationId,
                pid,
                jobId: metadata?.jobId,
                error: error instanceof Error ? error.message : String(error),
            });
            throw error;
        }
        finally {
            this.activeProcesses.delete(pid);
            this.processMetadata.delete(pid);
        }
    }
    isProcessAlive(pid) {
        try {
            process.kill(pid, 0);
            return true;
        }
        catch (error) {
            return false;
        }
    }
    getProcessHealth(pid) {
        const isAlive = this.isProcessAlive(pid);
        const metadata = this.processMetadata.get(pid);
        if (!metadata) {
            return { isAlive };
        }
        return {
            isAlive,
            metadata: {
                ...metadata,
                uptime: Date.now() - metadata.startTime.getTime(),
            },
        };
    }
    getActiveProcesses() {
        return Array.from(this.activeProcesses.keys());
    }
    async cleanupOrphanedProcesses() {
        const orphanedPids = [];
        for (const pid of this.activeProcesses.keys()) {
            if (!this.isProcessAlive(pid)) {
                orphanedPids.push(pid);
            }
        }
        if (orphanedPids.length > 0) {
            this.logger.log('Cleaning up orphaned processes', {
                orphanedPids,
                count: orphanedPids.length,
            });
            for (const pid of orphanedPids) {
                const metadata = this.processMetadata.get(pid);
                this.logger.warn('Removing orphaned process from tracking', {
                    pid,
                    jobId: metadata?.jobId,
                    correlationId: metadata?.correlationId,
                });
                this.activeProcesses.delete(pid);
                this.processMetadata.delete(pid);
            }
        }
    }
    setupProcessEventHandlers(process, correlationId) {
        const metadata = this.processMetadata.get(process.pid);
        process.on('exit', (code, signal) => {
            this.logger.log('Process exited', {
                correlationId,
                pid: process.pid,
                jobId: metadata?.jobId,
                exitCode: code,
                signal,
                uptime: metadata ? Date.now() - metadata.startTime.getTime() : undefined,
            });
        });
        process.on('error', (error) => {
            this.logger.error('Process error event', {
                correlationId,
                pid: process.pid,
                jobId: metadata?.jobId,
                error: error.message,
                code: error.name,
            });
        });
        process.stdout?.on('data', () => {
            this.logger.debug('Process stdout activity', {
                correlationId,
                pid: process.pid,
                jobId: metadata?.jobId,
            });
        });
        process.stderr?.on('data', (data) => {
            const errorOutput = data.toString().trim();
            if (errorOutput) {
                this.logger.warn('Process stderr output', {
                    correlationId,
                    pid: process.pid,
                    jobId: metadata?.jobId,
                    stderr: errorOutput,
                });
            }
        });
        process.on('disconnect', () => {
            this.logger.log('Process disconnected', {
                correlationId,
                pid: process.pid,
                jobId: metadata?.jobId,
            });
        });
    }
};
exports.ProcessManagerService = ProcessManagerService;
exports.ProcessManagerService = ProcessManagerService = ProcessManagerService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], ProcessManagerService);
//# sourceMappingURL=process-manager.service.js.map