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
var TypeScriptGenerator_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateAllTypes = exports.generateTypesFromContract = exports.TypeScriptGenerator = void 0;
const zod_1 = require("zod");
const common_1 = require("@nestjs/common");
const ContractRegistry_1 = require("./ContractRegistry");
let TypeScriptGenerator = TypeScriptGenerator_1 = class TypeScriptGenerator {
    constructor(contractRegistry) {
        this.contractRegistry = contractRegistry;
        this.logger = new common_1.Logger(TypeScriptGenerator_1.name);
        this.typeCache = new Map();
        this.dependencyTracker = new Map();
    }
    generateContractTypes(contractName, contractVersion, options = {}) {
        try {
            this.logger.log(`Generating TypeScript types for ${contractName}@${contractVersion}`);
            const contract = this.contractRegistry.getContract(contractName, contractVersion);
            if (!contract) {
                this.logger.warn(`Contract not found: ${contractName}@${contractVersion}`);
                return null;
            }
            const cacheKey = `${contractName}:${contractVersion}:${JSON.stringify(options)}`;
            if (this.typeCache.has(cacheKey)) {
                this.logger.debug(`Using cached types for ${contractName}@${contractVersion}`);
            }
            const typeName = this.sanitizeTypeName(contractName);
            const typeDefinition = this.zodToTypeScript(contract.schema, typeName, options);
            const dependencies = this.trackDependencies(contract.schema);
            this.dependencyTracker.set(cacheKey, dependencies);
            const imports = this.generateImports(dependencies, options);
            const exports = this.generateExports(typeName, options);
            let clientCode;
            if (options.clientApiGeneration) {
                clientCode = this.generateClientCode(contractName, typeName, options);
            }
            const result = {
                types: typeDefinition,
                imports,
                exports,
                clientCode,
                metadata: {
                    contractName,
                    contractVersion,
                    generatedAt: new Date(),
                    dependsOn: Array.from(dependencies),
                },
            };
            this.typeCache.set(cacheKey, JSON.stringify(result));
            this.logger.log(`Generated TypeScript types for ${contractName}@${contractVersion}`);
            return result;
        }
        catch (error) {
            this.logger.error(`Failed to generate TypeScript types for ${contractName}@${contractVersion}:`, error);
            return null;
        }
    }
    generateAllContractTypes(options = {}) {
        const results = new Map();
        const contractNames = this.contractRegistry.getContractNames();
        for (const contractName of contractNames) {
            const versions = this.contractRegistry.getContractVersions(contractName);
            if (versions.length > 0) {
                const latestContract = this.contractRegistry.getLatestContract(contractName);
                if (latestContract) {
                    const generated = this.generateContractTypes(contractName, latestContract.metadata.version, options);
                    if (generated) {
                        results.set(contractName, generated);
                    }
                }
            }
        }
        this.logger.log(`Generated TypeScript types for ${results.size} contracts`);
        return results;
    }
    generateTypeScriptModule(contractName, contractVersion, options = {}) {
        const generated = this.generateContractTypes(contractName, contractVersion, {
            ...options,
            includeImports: true,
            includeComments: true,
        });
        if (!generated) {
            return null;
        }
        const moduleHeader = this.generateModuleHeader(generated.metadata);
        const importsSection = generated.imports.length > 0 ? generated.imports.join('\n') + '\n\n' : '';
        const typesSection = generated.types;
        const exportsSection = generated.exports.length > 0 ? '\n\n' + generated.exports.join('\n') : '';
        const clientSection = generated.clientCode ? '\n\n' + generated.clientCode : '';
        return `${moduleHeader}${importsSection}${typesSection}${exportsSection}${clientSection}`;
    }
    generateClientApi(contractName, methods, options = {}) {
        const className = `${this.sanitizeTypeName(contractName)}Client`;
        const baseUrl = options.baseUrl || 'http://localhost:3000';
        let clientCode = `/**
 * Generated API client for ${contractName}
 * Base URL: ${baseUrl}
 */
export class ${className} {
  private readonly baseUrl: string;

  constructor(baseUrl: string = '${baseUrl}') {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    method: string,
    path: string,
    data?: any
  ): Promise<T> {
    const url = \`\${this.baseUrl}\${path}\`;
    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (data) {
      options.body = JSON.stringify(data);
    }

    const response = await fetch(url, options);
    if (!response.ok) {
      throw new Error(\`HTTP \${response.status}: \${response.statusText}\`);
    }

    return response.json();
  }

`;
        for (const method of methods) {
            const methodName = this.camelCase(method.name);
            const hasRequest = method.requestType && method.httpMethod !== 'GET';
            const requestParam = hasRequest ? `request: ${method.requestType}` : '';
            const responseType = method.responseType || 'any';
            clientCode += `  /**
   * ${method.description || `${method.httpMethod} ${method.path}`}
   */
  async ${methodName}(${requestParam}): Promise<${responseType}> {
    return this.request<${responseType}>(
      '${method.httpMethod}',
      '${method.path}'${hasRequest ? ', request' : ''}
    );
  }

`;
        }
        clientCode += '}';
        return clientCode;
    }
    clearCache() {
        this.typeCache.clear();
        this.dependencyTracker.clear();
        this.logger.log('TypeScript generation cache cleared');
    }
    zodToTypeScript(zodSchema, typeName, options) {
        const zodDef = zodSchema._def;
        const typeDefinition = this.convertZodToTypeScript(zodSchema);
        const comment = options.includeComments
            ? `/**\n * Generated from ${typeName} contract\n */\n`
            : '';
        const exportKeyword = options.exportType === 'default' ? 'export default' : 'export';
        if (options.outputFormat === 'interface' && this.isObjectSchema(zodSchema)) {
            return `${comment}${exportKeyword} interface ${typeName} ${typeDefinition}`;
        }
        else if (options.outputFormat === 'namespace') {
            return `${comment}${exportKeyword} namespace ${typeName} {\n  export type Type = ${typeDefinition};\n}`;
        }
        else {
            return `${comment}${exportKeyword} type ${typeName} = ${typeDefinition};`;
        }
    }
    convertZodToTypeScript(zodSchema) {
        const zodDef = zodSchema._def;
        switch (zodDef.typeName) {
            case zod_1.z.ZodFirstPartyTypeKind.ZodString:
                return this.handleStringType(zodDef);
            case zod_1.z.ZodFirstPartyTypeKind.ZodNumber:
                return 'number';
            case zod_1.z.ZodFirstPartyTypeKind.ZodBoolean:
                return 'boolean';
            case zod_1.z.ZodFirstPartyTypeKind.ZodDate:
                return 'Date';
            case zod_1.z.ZodFirstPartyTypeKind.ZodObject:
                return this.handleObjectType(zodDef);
            case zod_1.z.ZodFirstPartyTypeKind.ZodArray:
                const itemType = this.convertZodToTypeScript(zodDef.type);
                return `${itemType}[]`;
            case zod_1.z.ZodFirstPartyTypeKind.ZodEnum:
                return zodDef.values.map((v) => `'${v}'`).join(' | ');
            case zod_1.z.ZodFirstPartyTypeKind.ZodNativeEnum:
                const enumValues = Object.values(zodDef.values);
                return enumValues.map(v => typeof v === 'string' ? `'${v}'` : v).join(' | ');
            case zod_1.z.ZodFirstPartyTypeKind.ZodUnion:
                const unionTypes = zodDef.options.map((option) => this.convertZodToTypeScript(option));
                return `(${unionTypes.join(' | ')})`;
            case zod_1.z.ZodFirstPartyTypeKind.ZodIntersection:
                const leftType = this.convertZodToTypeScript(zodDef.left);
                const rightType = this.convertZodToTypeScript(zodDef.right);
                return `${leftType} & ${rightType}`;
            case zod_1.z.ZodFirstPartyTypeKind.ZodOptional:
                return this.convertZodToTypeScript(zodDef.innerType);
            case zod_1.z.ZodFirstPartyTypeKind.ZodNullable:
                const innerType = this.convertZodToTypeScript(zodDef.innerType);
                return `${innerType} | null`;
            case zod_1.z.ZodFirstPartyTypeKind.ZodDefault:
                return this.convertZodToTypeScript(zodDef.innerType);
            case zod_1.z.ZodFirstPartyTypeKind.ZodLiteral:
                return typeof zodDef.value === 'string' ? `'${zodDef.value}'` : String(zodDef.value);
            case zod_1.z.ZodFirstPartyTypeKind.ZodRecord:
                const valueType = zodDef.valueType ?
                    this.convertZodToTypeScript(zodDef.valueType) :
                    'any';
                return `Record<string, ${valueType}>`;
            case zod_1.z.ZodFirstPartyTypeKind.ZodAny:
                return 'any';
            case zod_1.z.ZodFirstPartyTypeKind.ZodUnknown:
                return 'unknown';
            default:
                this.logger.warn(`Unsupported Zod type: ${zodDef.typeName}`);
                return 'unknown';
        }
    }
    handleStringType(zodDef) {
        if (zodDef.checks) {
            for (const check of zodDef.checks) {
                switch (check.kind) {
                    case 'email':
                        return 'string';
                    case 'url':
                        return 'string';
                    case 'uuid':
                        return 'string';
                }
            }
        }
        return 'string';
    }
    handleObjectType(zodDef) {
        const properties = [];
        const shape = zodDef.shape();
        for (const [key, value] of Object.entries(shape)) {
            const valueSchema = value;
            const typeString = this.convertZodToTypeScript(valueSchema);
            const isOptional = valueSchema._def.typeName === zod_1.z.ZodFirstPartyTypeKind.ZodOptional;
            const propertyName = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key) ? key : `'${key}'`;
            properties.push(`  ${propertyName}${isOptional ? '?' : ''}: ${typeString};`);
        }
        return `{\n${properties.join('\n')}\n}`;
    }
    isObjectSchema(zodSchema) {
        return zodSchema._def.typeName === zod_1.z.ZodFirstPartyTypeKind.ZodObject;
    }
    trackDependencies(zodSchema) {
        const dependencies = new Set();
        return dependencies;
    }
    generateImports(dependencies, options) {
        const imports = [];
        if (options.includeImports) {
            if (dependencies.has('Date')) {
            }
            for (const dep of dependencies) {
                if (dep !== 'Date') {
                    imports.push(`import { ${dep} } from './${dep}';`);
                }
            }
        }
        return imports;
    }
    generateExports(typeName, options) {
        const exports = [];
        if (options.exportType !== 'default') {
        }
        return exports;
    }
    generateClientCode(contractName, typeName, options) {
        return `/**
 * Auto-generated client for ${contractName}
 */
export class ${typeName}Client {
  constructor(private baseUrl: string = '${options.baseUrl || 'http://localhost:3000'}') {}

  // Client methods would be generated based on contract operations
}`;
    }
    generateModuleHeader(metadata) {
        return `/**
 * Auto-generated TypeScript types for ${metadata.contractName}@${metadata.contractVersion}
 * Generated at: ${metadata.generatedAt.toISOString()}
 * 
 * DO NOT EDIT - This file is automatically generated from contracts
 */

`;
    }
    sanitizeTypeName(name) {
        return name
            .split(/[-_\s]+/)
            .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
            .join('');
    }
    camelCase(str) {
        return str
            .split(/[-_\s]+/)
            .map((part, index) => index === 0
            ? part.toLowerCase()
            : part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
            .join('');
    }
};
exports.TypeScriptGenerator = TypeScriptGenerator;
exports.TypeScriptGenerator = TypeScriptGenerator = TypeScriptGenerator_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [ContractRegistry_1.ContractRegistry])
], TypeScriptGenerator);
const generateTypesFromContract = (contractRegistry, contractName, contractVersion, options) => {
    const generator = new TypeScriptGenerator(contractRegistry);
    return generator.generateContractTypes(contractName, contractVersion, options);
};
exports.generateTypesFromContract = generateTypesFromContract;
const generateAllTypes = (contractRegistry, options) => {
    const generator = new TypeScriptGenerator(contractRegistry);
    return generator.generateAllContractTypes(options);
};
exports.generateAllTypes = generateAllTypes;
//# sourceMappingURL=TypeScriptGenerator.js.map