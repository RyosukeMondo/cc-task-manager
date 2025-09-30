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
var DevValidationMiddleware_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.DevValidationMiddleware = void 0;
const common_1 = require("@nestjs/common");
const ContractRegistry_1 = require("./ContractRegistry");
const chokidar = require("chokidar");
const path = require("path");
let DevValidationMiddleware = DevValidationMiddleware_1 = class DevValidationMiddleware {
    constructor(contractRegistry) {
        this.contractRegistry = contractRegistry;
        this.logger = new common_1.Logger(DevValidationMiddleware_1.name);
        this.contractCache = new Map();
        this.lastValidationResults = new Map();
        this.config = this.getDefaultConfig();
        this.initializeFileWatcher();
    }
    use(req, res, next) {
        if (!this.isDevelopmentMode() || !this.config.enabled) {
            return next();
        }
        if (this.shouldSkipValidation(req)) {
            return next();
        }
        this.performDevTimeValidation(req, res, next);
    }
    isDevelopmentMode() {
        return process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test';
    }
    shouldSkipValidation(req) {
        const skipPaths = [
            '/health',
            '/metrics',
            '/favicon.ico',
            '/static',
            '/assets'
        ];
        return skipPaths.some(path => req.path.startsWith(path));
    }
    performDevTimeValidation(req, res, next) {
        try {
            const contractInfo = this.inferContractFromRoute(req);
            if (!contractInfo) {
                return next();
            }
            if (this.config.immediateValidation) {
                const validationResult = this.validateRequest(req, contractInfo);
                if (!validationResult.valid) {
                    return this.handleValidationError(req, res, validationResult);
                }
                this.lastValidationResults.set(req.path, validationResult);
            }
            req['contractValidation'] = {
                contractName: contractInfo.name,
                contractVersion: contractInfo.version,
                validated: true,
                result: this.lastValidationResults.get(req.path)
            };
            next();
        }
        catch (error) {
            this.logger.error(`Dev validation error for ${req.method} ${req.path}:`, error);
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
    inferContractFromRoute(req) {
        const pathSegments = req.path.split('/').filter(segment => segment.length > 0);
        if (pathSegments.length === 0) {
            return null;
        }
        const contractSegment = pathSegments[0] === 'api' ? pathSegments[1] : pathSegments[0];
        if (!contractSegment) {
            return null;
        }
        const contractNames = this.contractRegistry.getContractNames();
        const matchingContractName = contractNames.find(name => name.toLowerCase() === contractSegment.toLowerCase() ||
            name.toLowerCase().includes(contractSegment.toLowerCase()));
        if (matchingContractName) {
            const latestContract = this.contractRegistry.getLatestContract(matchingContractName);
            return {
                name: matchingContractName,
                version: latestContract?.metadata.version
            };
        }
        return null;
    }
    validateRequest(req, contractInfo) {
        try {
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
            let bodyValidation = { success: true };
            if (req.body && Object.keys(req.body).length > 0) {
                bodyValidation = this.contractRegistry.validateAgainstContract(contractInfo.name, contractInfo.version || 'latest', req.body);
            }
            let queryValidation = { success: true };
            if (req.query && Object.keys(req.query).length > 0) {
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
        }
        catch (error) {
            return {
                valid: false,
                errors: [`Validation error: ${error.message}`],
                warnings: [],
                contractName: contractInfo.name,
                contractVersion: contractInfo.version
            };
        }
    }
    handleValidationError(req, res, validationResult) {
        const errorResponse = {
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
        this.logger.warn(`Contract validation failed for ${req.method} ${req.path}:`);
        this.logger.warn(`Contract: ${validationResult.contractName}@${validationResult.contractVersion}`);
        validationResult.errors.forEach(error => this.logger.warn(`  - ${error}`));
        return res.status(400).json(errorResponse);
    }
    initializeFileWatcher() {
        if (!this.isDevelopmentMode() || !this.config.hotReload) {
            return;
        }
        const watchPaths = [
            ...this.config.watchPaths,
            './src/contracts/**/*.ts',
            './src/config/**/*.ts'
        ];
        try {
            this.fileWatcher = chokidar.watch(watchPaths, {
                ignored: /(^|[\/\\])\../,
                persistent: true,
                ignoreInitial: true
            });
            if (this.fileWatcher && typeof this.fileWatcher.on === 'function') {
                this.fileWatcher
                    .on('change', (filePath) => this.handleFileChange(filePath))
                    .on('add', (filePath) => this.handleFileChange(filePath))
                    .on('unlink', (filePath) => this.handleFileRemoval(filePath))
                    .on('error', (error) => this.logger.error('File watcher error:', error));
            }
            else {
                this.logger.warn('File watcher created but does not have event methods');
                this.fileWatcher = undefined;
            }
        }
        catch (error) {
            this.logger.warn('Failed to initialize file watcher:', error);
            this.fileWatcher = undefined;
        }
        this.logger.log('Contract file watcher initialized for development');
        this.logger.log(`Watching paths: ${watchPaths.join(', ')}`);
    }
    handleFileChange(filePath) {
        this.logger.log(`Contract file changed: ${filePath}`);
        this.clearCacheForFile(filePath);
        if (filePath.includes('/contracts/')) {
            this.logger.log('Refreshing contract registry due to file change');
        }
    }
    handleFileRemoval(filePath) {
        this.logger.log(`Contract file removed: ${filePath}`);
        this.clearCacheForFile(filePath);
    }
    clearCacheForFile(filePath) {
        this.lastValidationResults.clear();
        const normalizedPath = path.normalize(filePath);
        for (const [key, value] of this.contractCache.entries()) {
            if (key.includes(normalizedPath) || normalizedPath.includes(key)) {
                this.contractCache.delete(key);
            }
        }
    }
    getDefaultConfig() {
        return {
            enabled: this.isDevelopmentMode(),
            watchPaths: ['./src/contracts', './src/config'],
            contractPaths: ['./src/contracts'],
            hotReload: true,
            immediateValidation: true
        };
    }
    configure(config) {
        this.config = { ...this.config, ...config };
        if (config.watchPaths && this.fileWatcher) {
            this.fileWatcher.close();
            this.initializeFileWatcher();
        }
    }
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
    onApplicationShutdown() {
        if (this.fileWatcher) {
            this.fileWatcher.close();
            this.logger.log('File watcher closed');
        }
    }
};
exports.DevValidationMiddleware = DevValidationMiddleware;
exports.DevValidationMiddleware = DevValidationMiddleware = DevValidationMiddleware_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [ContractRegistry_1.ContractRegistry])
], DevValidationMiddleware);
//# sourceMappingURL=DevValidationMiddleware.js.map