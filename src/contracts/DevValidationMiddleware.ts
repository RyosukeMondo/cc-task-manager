import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { ContractRegistry } from './ContractRegistry';
import { ContractValidationErrorDetails } from './ContractValidationPipe';
import * as chokidar from 'chokidar';
import * as path from 'path';

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

/**
 * Development-time contract validation middleware
 * 
 * Provides real-time contract validation during development with:
 * - Hot-reload support for contract files
 * - Immediate error feedback on validation failures  
 * - File watching for contract changes
 * - Development-only operation (disabled in production)
 */
@Injectable()
export class DevValidationMiddleware implements NestMiddleware {
  private readonly logger = new Logger(DevValidationMiddleware.name);
  private fileWatcher?: chokidar.FSWatcher;
  private config: DevValidationConfig;
  private contractCache = new Map<string, any>();
  private lastValidationResults = new Map<string, ValidationResult>();

  constructor(private readonly contractRegistry: ContractRegistry) {
    this.config = this.getDefaultConfig();
    this.initializeFileWatcher();
  }

  use(req: Request, res: Response, next: NextFunction) {
    // Only run in development mode
    if (!this.isDevelopmentMode() || !this.config.enabled) {
      return next();
    }

    // Skip validation for non-API routes (health checks, static files, etc.)
    if (this.shouldSkipValidation(req)) {
      return next();
    }

    this.performDevTimeValidation(req, res, next);
  }

  private isDevelopmentMode(): boolean {
    return process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test';
  }

  private shouldSkipValidation(req: Request): boolean {
    const skipPaths = [
      '/health',
      '/metrics', 
      '/favicon.ico',
      '/static',
      '/assets'
    ];
    
    return skipPaths.some(path => req.path.startsWith(path));
  }

  private performDevTimeValidation(req: Request, res: Response, next: NextFunction) {
    try {
      // Attempt to infer contract from route
      const contractInfo = this.inferContractFromRoute(req);
      
      if (!contractInfo) {
        // No contract found for this route, continue normally
        return next();
      }

      // Validate request against contract if immediate validation is enabled
      if (this.config.immediateValidation) {
        const validationResult = this.validateRequest(req, contractInfo);
        
        if (!validationResult.valid) {
          return this.handleValidationError(req, res, validationResult);
        }

        // Store successful validation result
        this.lastValidationResults.set(req.path, validationResult);
      }

      // Add validation metadata to request for downstream use
      req['contractValidation'] = {
        contractName: contractInfo.name,
        contractVersion: contractInfo.version,
        validated: true,
        result: this.lastValidationResults.get(req.path)
      };

      next();
    } catch (error) {
      this.logger.error(`Dev validation error for ${req.method} ${req.path}:`, error);
      
      // In development, show detailed errors
      return res.status(500).json({
        error: 'DevValidationError',
        message: 'Development-time contract validation failed',
        details: error.message,
        path: req.path,
        method: req.method,
        timestamp: new Date().toISOString()
      });
    }
  }

  private inferContractFromRoute(req: Request): { name: string; version?: string } | null {
    // Extract potential contract name from route
    // Convention: /api/{contractName}/* or /{contractName}/*
    const pathSegments = req.path.split('/').filter(segment => segment.length > 0);
    
    if (pathSegments.length === 0) {
      return null;
    }

    // Skip 'api' prefix if present
    const contractSegment = pathSegments[0] === 'api' ? pathSegments[1] : pathSegments[0];
    
    if (!contractSegment) {
      return null;
    }

    // Try to find registered contract by name
    const contractNames = this.contractRegistry.getContractNames();
    const matchingContractName = contractNames.find(name => 
      name.toLowerCase() === contractSegment.toLowerCase() ||
      name.toLowerCase().includes(contractSegment.toLowerCase())
    );

    if (matchingContractName) {
      // Get the latest contract for this name
      const latestContract = this.contractRegistry.getLatestContract(matchingContractName);
      return {
        name: matchingContractName,
        version: latestContract?.metadata.version
      };
    }

    return null;
  }

  private validateRequest(req: Request, contractInfo: { name: string; version?: string }): ValidationResult {
    try {
      // Get contract from registry
      const contract = this.contractRegistry.getContract(contractInfo.name, contractInfo.version);
      
      if (!contract) {
        return {
          valid: false,
          errors: [`Contract '${contractInfo.name}' not found in registry`],
          warnings: [],
          contractName: contractInfo.name,
          contractVersion: contractInfo.version
        };
      }

      // Validate request body if present
      let bodyValidation: { success: boolean; error?: string; data?: any } = { success: true };
      if (req.body && Object.keys(req.body).length > 0) {
        bodyValidation = this.contractRegistry.validateAgainstContract(
          contractInfo.name, 
          contractInfo.version || 'latest', 
          req.body
        );
      }

      // Validate query parameters if present
      let queryValidation: { success: boolean; error?: string; data?: any } = { success: true };
      if (req.query && Object.keys(req.query).length > 0) {
        // For now, skip query validation as it's not part of the basic contract model
        // In a real implementation, you could extend the contract registry to support 
        // query schemas or use separate validation for query parameters
        this.logger.debug('Query parameter validation not implemented yet');
      }

      const errors = [];
      const warnings = [];

      if (!bodyValidation.success) {
        errors.push(`Body validation failed: ${bodyValidation.error}`);
      }

      if (!queryValidation.success) {
        errors.push(`Query validation failed: ${queryValidation.error}`);
      }

      return {
        valid: errors.length === 0,
        errors,
        warnings,
        contractName: contractInfo.name,
        contractVersion: contractInfo.version
      };

    } catch (error) {
      return {
        valid: false,
        errors: [`Validation error: ${error.message}`],
        warnings: [],
        contractName: contractInfo.name,
        contractVersion: contractInfo.version
      };
    }
  }

  private handleValidationError(req: Request, res: Response, validationResult: ValidationResult) {
    const errorResponse: ContractValidationErrorDetails & {
      timestamp: string;
      path: string;
      method: string;
      devHints: string[];
    } = {
      error: 'ContractValidationError',
      contract: {
        name: validationResult.contractName || 'unknown',
        version: validationResult.contractVersion || 'latest'
      },
      location: 'body',
      message: 'Development-time contract validation failed',
      issues: validationResult.errors,
      timestamp: new Date().toISOString(),
      path: req.path,
      method: req.method,
      devHints: [
        'This error only appears in development mode',
        'Check your request payload against the contract schema',
        'Contract files are being watched for changes',
        `Contract: ${validationResult.contractName}@${validationResult.contractVersion}`
      ]
    };

    // Log detailed error for developer
    this.logger.warn(`Contract validation failed for ${req.method} ${req.path}:`);
    this.logger.warn(`Contract: ${validationResult.contractName}@${validationResult.contractVersion}`);
    validationResult.errors.forEach(error => this.logger.warn(`  - ${error}`));

    return res.status(400).json(errorResponse);
  }

  private initializeFileWatcher() {
    if (!this.isDevelopmentMode() || !this.config.hotReload) {
      return;
    }

    // Watch contract files for changes
    const watchPaths = [
      ...this.config.watchPaths,
      './src/contracts/**/*.ts',
      './src/config/**/*.ts'
    ];

    try {
      this.fileWatcher = chokidar.watch(watchPaths, {
        ignored: /(^|[\/\\])\../, // ignore dotfiles
        persistent: true,
        ignoreInitial: true
      });

      if (this.fileWatcher) {
        this.fileWatcher
          .on('change', (filePath) => this.handleFileChange(filePath))
          .on('add', (filePath) => this.handleFileChange(filePath))
          .on('unlink', (filePath) => this.handleFileRemoval(filePath))
          .on('error', (error) => this.logger.error('File watcher error:', error));
      }
    } catch (error) {
      this.logger.warn('Failed to initialize file watcher:', error);
      this.fileWatcher = undefined;
    }

    this.logger.log('Contract file watcher initialized for development');
    this.logger.log(`Watching paths: ${watchPaths.join(', ')}`);
  }

  private handleFileChange(filePath: string) {
    this.logger.log(`Contract file changed: ${filePath}`);
    
    // Clear relevant caches
    this.clearCacheForFile(filePath);
    
    // Trigger contract registry refresh if needed
    if (filePath.includes('/contracts/')) {
      this.logger.log('Refreshing contract registry due to file change');
      // Note: In a real implementation, you might want to 
      // trigger a registry refresh or reload specific contracts
    }
  }

  private handleFileRemoval(filePath: string) {
    this.logger.log(`Contract file removed: ${filePath}`);
    this.clearCacheForFile(filePath);
  }

  private clearCacheForFile(filePath: string) {
    // Clear validation results cache
    this.lastValidationResults.clear();
    
    // Clear contract cache entries related to this file
    const normalizedPath = path.normalize(filePath);
    for (const [key, value] of this.contractCache.entries()) {
      if (key.includes(normalizedPath) || normalizedPath.includes(key)) {
        this.contractCache.delete(key);
      }
    }
  }

  private getDefaultConfig(): DevValidationConfig {
    return {
      enabled: this.isDevelopmentMode(),
      watchPaths: ['./src/contracts', './src/config'],
      contractPaths: ['./src/contracts'],
      hotReload: true,
      immediateValidation: true
    };
  }

  /**
   * Configure the middleware for specific development needs
   */
  configure(config: Partial<DevValidationConfig>) {
    this.config = { ...this.config, ...config };
    
    if (config.watchPaths && this.fileWatcher) {
      // Restart file watcher with new paths
      this.fileWatcher.close();
      this.initializeFileWatcher();
    }
  }

  /**
   * Get current validation statistics for debugging
   */
  getValidationStats() {
    return {
      enabled: this.config.enabled,
      isDevelopmentMode: this.isDevelopmentMode(),
      watcherActive: !!this.fileWatcher,
      cachedResults: this.lastValidationResults.size,
      lastValidations: Array.from(this.lastValidationResults.entries()).map(([path, result]) => ({
        path,
        valid: result.valid,
        contract: result.contractName,
        timestamp: new Date().toISOString()
      }))
    };
  }

  /**
   * Cleanup resources when the application shuts down
   */
  onApplicationShutdown() {
    if (this.fileWatcher) {
      this.fileWatcher.close();
      this.logger.log('File watcher closed');
    }
  }
}

/**
 * Augment Express Request type to include contract validation metadata
 */
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