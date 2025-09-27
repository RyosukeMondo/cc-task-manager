import { NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { ContractRegistry } from './ContractRegistry';
export interface DevValidationConfig {
    enabled: boolean;
    watchPaths: string[];
    contractPaths: string[];
    hotReload: boolean;
    immediateValidation: boolean;
}
export interface ValidationResult {
    valid: boolean;
    errors: string[];
    warnings: string[];
    contractName?: string;
    contractVersion?: string;
}
export declare class DevValidationMiddleware implements NestMiddleware {
    private readonly contractRegistry;
    private readonly logger;
    private fileWatcher?;
    private config;
    private contractCache;
    private lastValidationResults;
    constructor(contractRegistry: ContractRegistry);
    use(req: Request, res: Response, next: NextFunction): void;
    private isDevelopmentMode;
    private shouldSkipValidation;
    private performDevTimeValidation;
    private inferContractFromRoute;
    private validateRequest;
    private handleValidationError;
    private initializeFileWatcher;
    private handleFileChange;
    private handleFileRemoval;
    private clearCacheForFile;
    private getDefaultConfig;
    configure(config: Partial<DevValidationConfig>): void;
    getValidationStats(): {
        enabled: boolean;
        isDevelopmentMode: boolean;
        watcherActive: boolean;
        cachedResults: number;
        lastValidations: {
            path: string;
            valid: boolean;
            contract: string;
            timestamp: string;
        }[];
    };
    onApplicationShutdown(): void;
}
declare global {
    namespace Express {
        interface Request {
            contractValidation?: {
                contractName: string;
                contractVersion: string;
                validated: boolean;
                result?: ValidationResult;
            };
        }
    }
}
