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
var ContractValidationPipe_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContractValidationPipe = void 0;
const common_1 = require("@nestjs/common");
let ContractValidationPipe = ContractValidationPipe_1 = class ContractValidationPipe {
    constructor(registryOrSchema, options) {
        this.registryOrSchema = registryOrSchema;
        this.options = options;
        this.logger = new common_1.Logger(ContractValidationPipe_1.name);
    }
    transform(value, metadata) {
        if (this.registryOrSchema && typeof this.registryOrSchema.parse === 'function') {
            try {
                return this.registryOrSchema.parse(value);
            }
            catch (error) {
                throw new common_1.BadRequestException({
                    error: 'ContractValidationError',
                    contract: { name: 'inline-schema', version: '1.0.0' },
                    location: this.inferLocation(metadata.type),
                    message: error.message || 'Validation failed',
                });
            }
        }
        const registry = this.registryOrSchema;
        const location = this.options?.location || this.inferLocation(metadata.type);
        const name = this.options?.contractName || 'unknown';
        const version = this.options?.version || this.getLatestVersionOrThrow(name);
        const result = registry.validateAgainstContract(name, version, value);
        if (!result.success) {
            const details = {
                error: 'ContractValidationError',
                contract: { name, version },
                location,
                message: result.error || 'Validation failed',
            };
            this.logger.warn(`Contract validation failed for ${name}@${version} at ${location}: ${details.message}`);
            throw new common_1.BadRequestException(details);
        }
        return result.data ?? value;
    }
    inferLocation(type) {
        if (type === 'query')
            return 'query';
        if (type === 'param')
            return 'params';
        return 'body';
    }
    getLatestVersionOrThrow(name) {
        const registry = this.registryOrSchema;
        const latest = registry.getLatestContract(name);
        if (!latest) {
            const msg = `Contract not found: ${name}`;
            this.logger.error(msg);
            throw new common_1.BadRequestException({
                error: 'ContractValidationError',
                contract: { name, version: 'latest' },
                location: 'body',
                message: msg,
            });
        }
        return latest.metadata.version;
    }
};
exports.ContractValidationPipe = ContractValidationPipe;
exports.ContractValidationPipe = ContractValidationPipe = ContractValidationPipe_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [Object, Object])
], ContractValidationPipe);
//# sourceMappingURL=ContractValidationPipe.js.map