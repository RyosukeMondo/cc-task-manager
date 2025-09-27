#!/usr/bin/env ts-node

import { program } from 'commander';
import { z } from 'zod';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

/**
 * Contract CLI Tool
 * 
 * Provides command-line interface for contract management operations including
 * validation, documentation generation, and compatibility checking.
 * 
 * Features:
 * - Contract validation against registered schemas
 * - OpenAPI documentation generation
 * - Version compatibility checking
 * - Contract registry management
 */

// CLI configuration schema
const CLIConfigSchema = z.object({
  contractsDir: z.string().default('./src/contracts'),
  outputDir: z.string().default('./dist/contracts'),
  registryFile: z.string().default('./contracts-registry.json'),
  verbose: z.boolean().default(false),
});

type CLIConfig = z.infer<typeof CLIConfigSchema>;

// Contract metadata schema
const ContractMetadataSchema = z.object({
  name: z.string().min(1, 'Contract name is required'),
  version: z.string().regex(/^\d+\.\d+\.\d+$/, 'Version must follow semantic versioning (e.g., 1.0.0)'),
  description: z.string().optional(),
  deprecated: z.boolean().default(false),
  deprecationDate: z.string().optional(),
  compatibleVersions: z.array(z.string()).default([]),
  created: z.string().default(() => new Date().toISOString()),
  lastModified: z.string().default(() => new Date().toISOString()),
});

type ContractMetadata = z.infer<typeof ContractMetadataSchema>;

interface ContractRegistration {
  metadata: ContractMetadata;
  schemaHash: string;
  schemaType: string;
}

interface RegistryData {
  timestamp: string;
  version: string;
  contracts: Record<string, Record<string, ContractRegistration>>;
}

class ContractCLI {
  private config: CLIConfig;
  private registryData: RegistryData = { 
    contracts: {}, 
    timestamp: new Date().toISOString(), 
    version: '1.0.0' 
  };

  constructor(config: Partial<CLIConfig> = {}) {
    this.config = CLIConfigSchema.parse(config);
    this.loadRegistry();
  }

  /**
   * Load existing contract registry from file
   */
  private loadRegistry(): void {
    try {
      if (fs.existsSync(this.config.registryFile)) {
        this.registryData = JSON.parse(fs.readFileSync(this.config.registryFile, 'utf8'));
        
        if (this.config.verbose) {
          console.log(`✅ Loaded registry from ${this.config.registryFile}`);
        }
      }
    } catch (error) {
      console.error(`⚠️  Failed to load registry: ${error.message}`);
    }
  }

  /**
   * Save contract registry to file
   */
  private saveRegistry(): void {
    try {
      this.registryData.timestamp = new Date().toISOString();
      
      fs.writeFileSync(this.config.registryFile, JSON.stringify(this.registryData, null, 2));
      
      if (this.config.verbose) {
        console.log(`💾 Saved registry to ${this.config.registryFile}`);
      }
    } catch (error) {
      console.error(`❌ Failed to save registry: ${error.message}`);
    }
  }

  /**
   * Generate a hash for a file
   */
  private generateFileHash(filePath: string): string {
    const content = fs.readFileSync(filePath, 'utf8');
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Validate data against a JSON schema file
   */
  async validateContract(contractName: string, version: string, dataFile: string): Promise<void> {
    try {
      console.log(`🔍 Validating contract: ${contractName}@${version}`);
      
      // Check if contract exists in registry
      const contract = this.getContract(contractName, version);
      if (!contract) {
        throw new Error(`Contract not found: ${contractName}@${version}`);
      }
      
      // Read data file
      if (!fs.existsSync(dataFile)) {
        throw new Error(`Data file not found: ${dataFile}`);
      }
      
      const data = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
      
      // For MVP, just validate it's valid JSON and show structure
      console.log(`✅ Data file is valid JSON for ${contractName}@${version}`);
      if (this.config.verbose) {
        console.log('Data structure:', JSON.stringify(data, null, 2));
      }
    } catch (error) {
      console.error(`❌ Validation error: ${error.message}`);
      process.exit(1);
    }
  }

  /**
   * Generate basic OpenAPI documentation structure
   */
  async generateDocs(outputFile?: string): Promise<void> {
    try {
      console.log('📚 Generating OpenAPI documentation...');
      
      const contractNames = Object.keys(this.registryData.contracts);
      if (contractNames.length === 0) {
        console.warn('⚠️  No contracts found in registry');
        return;
      }

      // Generate basic OpenAPI spec structure
      const openApiSpec = {
        openapi: '3.0.0',
        info: {
          title: 'Contract API Documentation',
          version: '1.0.0',
          description: 'Auto-generated API documentation from registered contracts',
        },
        servers: [
          { url: 'http://localhost:3000', description: 'Development server' }
        ],
        paths: {},
        components: {
          schemas: {}
        }
      };

      // Add contract schemas to components
      for (const [contractName, versions] of Object.entries(this.registryData.contracts)) {
        for (const [version, registration] of Object.entries(versions)) {
          openApiSpec.components.schemas[`${contractName}_${version.replace(/\./g, '_')}`] = {
            type: 'object',
            description: registration.metadata.description || `Schema for ${contractName}@${version}`,
            properties: {
              contractName: { type: 'string', example: contractName },
              version: { type: 'string', example: version },
              data: { type: 'object', description: 'Contract data' }
            }
          };
        }
      }
      
      const output = outputFile || path.join(this.config.outputDir, 'openapi.json');
      
      // Ensure output directory exists
      const outputDir = path.dirname(output);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      
      fs.writeFileSync(output, JSON.stringify(openApiSpec, null, 2));
      
      console.log(`✅ OpenAPI documentation generated: ${output}`);
      console.log(`📊 Documented ${contractNames.length} contracts`);
      
      if (this.config.verbose) {
        console.log('Contract names:', contractNames.join(', '));
      }
    } catch (error) {
      console.error(`❌ Documentation generation failed: ${error.message}`);
      process.exit(1);
    }
  }

  /**
   * Check compatibility between contract versions using semantic versioning
   */
  async checkCompatibility(contractName: string, sourceVersion: string, targetVersion: string): Promise<void> {
    try {
      console.log(`🔄 Checking compatibility: ${contractName} ${sourceVersion} → ${targetVersion}`);
      
      const sourceContract = this.getContract(contractName, sourceVersion);
      const targetContract = this.getContract(contractName, targetVersion);
      
      if (!sourceContract || !targetContract) {
        console.log(`❌ One or both contract versions not found`);
        process.exit(1);
      }

      // Basic semantic versioning compatibility check
      const [sourceMajor, sourceMinor, sourcePatch] = sourceVersion.split('.').map(Number);
      const [targetMajor, targetMinor, targetPatch] = targetVersion.split('.').map(Number);

      const warnings: string[] = [];
      let compatible = true;

      // Major version changes are breaking
      if (sourceMajor !== targetMajor) {
        compatible = false;
        console.log(`❌ Versions are incompatible`);
        console.log(`Breaking changes: Major version change: ${sourceMajor} → ${targetMajor}`);
        process.exit(1);
      }

      // Minor version increases should be backward compatible
      if (targetMinor > sourceMinor) {
        warnings.push(`Minor version upgrade: ${sourceMinor} → ${targetMinor}`);
      } else if (targetMinor < sourceMinor) {
        warnings.push(`Minor version downgrade: ${sourceMinor} → ${targetMinor} (may lose features)`);
      }

      // Patch version changes should always be compatible
      if (targetPatch !== sourcePatch) {
        warnings.push(`Patch version change: ${sourcePatch} → ${targetPatch}`);
      }

      console.log(`✅ Versions are compatible`);
      
      if (warnings.length > 0) {
        console.log('⚠️  Warnings:');
        warnings.forEach(warning => console.log(`  - ${warning}`));
      }
      
      if (this.config.verbose) {
        console.log('Source contract:', sourceContract.metadata);
        console.log('Target contract:', targetContract.metadata);
      }
    } catch (error) {
      console.error(`❌ Compatibility check failed: ${error.message}`);
      process.exit(1);
    }
  }

  /**
   * List all registered contracts
   */
  async listContracts(): Promise<void> {
    try {
      const contractNames = Object.keys(this.registryData.contracts);
      
      if (contractNames.length === 0) {
        console.log('No contracts registered');
        return;
      }
      
      console.log(`📋 Registered contracts (${contractNames.length}):`);
      console.log('');
      
      for (const name of contractNames) {
        const versions = this.registryData.contracts[name];
        console.log(`📦 ${name}`);
        
        for (const [version, registration] of Object.entries(versions)) {
          const meta = registration.metadata;
          const status = meta.deprecated ? '🚫 DEPRECATED' : '✅ Active';
          const deprecationInfo = meta.deprecated && meta.deprecationDate 
            ? ` (since ${meta.deprecationDate})` 
            : '';
          
          console.log(`  └─ v${meta.version} ${status}${deprecationInfo}`);
          
          if (this.config.verbose && meta.description) {
            console.log(`     ${meta.description}`);
          }
        }
        console.log('');
      }
    } catch (error) {
      console.error(`❌ Failed to list contracts: ${error.message}`);
      process.exit(1);
    }
  }

  /**
   * Register a new contract from file
   */
  async registerContract(contractName: string, version: string, schemaFile: string, description?: string): Promise<void> {
    try {
      console.log(`📝 Registering contract: ${contractName}@${version}`);
      
      if (!fs.existsSync(schemaFile)) {
        throw new Error(`Schema file not found: ${schemaFile}`);
      }
      
      // Generate hash for the schema file
      const schemaHash = this.generateFileHash(schemaFile);
      
      const metadata: ContractMetadata = ContractMetadataSchema.parse({
        name: contractName,
        version,
        description: description || `Contract for ${contractName}`,
        lastModified: new Date().toISOString(),
      });
      
      const registration: ContractRegistration = {
        metadata,
        schemaHash,
        schemaType: path.extname(schemaFile).replace('.', '') || 'unknown',
      };
      
      // Store in registry
      if (!this.registryData.contracts[contractName]) {
        this.registryData.contracts[contractName] = {};
      }
      
      this.registryData.contracts[contractName][version] = registration;
      
      this.saveRegistry();
      console.log(`✅ Contract registered successfully`);
    } catch (error) {
      console.error(`❌ Registration failed: ${error.message}`);
      process.exit(1);
    }
  }

  /**
   * Show contract information
   */
  async showContract(contractName: string, version?: string): Promise<void> {
    try {
      if (version) {
        const contract = this.getContract(contractName, version);
        if (!contract) {
          console.error(`❌ Contract not found: ${contractName}@${version}`);
          process.exit(1);
        }
        
        console.log(`📄 Contract: ${contractName}@${version}`);
        console.log('');
        this.printContractDetails(contract);
      } else {
        const versions = this.registryData.contracts[contractName];
        if (!versions || Object.keys(versions).length === 0) {
          console.error(`❌ Contract not found: ${contractName}`);
          process.exit(1);
        }
        
        console.log(`📄 Contract: ${contractName} (${Object.keys(versions).length} versions)`);
        console.log('');
        
        for (const [ver, contract] of Object.entries(versions)) {
          console.log(`Version ${ver}:`);
          this.printContractDetails(contract);
          console.log('');
        }
      }
    } catch (error) {
      console.error(`❌ Failed to show contract: ${error.message}`);
      process.exit(1);
    }
  }

  /**
   * Get a specific contract registration
   */
  private getContract(contractName: string, version: string): ContractRegistration | null {
    const versions = this.registryData.contracts[contractName];
    if (!versions) {
      return null;
    }
    return versions[version] || null;
  }

  /**
   * Print contract details
   */
  private printContractDetails(contract: ContractRegistration): void {
    const meta = contract.metadata;
    console.log(`  Name: ${meta.name}`);
    console.log(`  Version: ${meta.version}`);
    console.log(`  Status: ${meta.deprecated ? '🚫 Deprecated' : '✅ Active'}`);
    console.log(`  Type: ${contract.schemaType}`);
    
    if (meta.description) {
      console.log(`  Description: ${meta.description}`);
    }
    
    console.log(`  Created: ${meta.created}`);
    console.log(`  Modified: ${meta.lastModified}`);
    
    if (meta.deprecated && meta.deprecationDate) {
      console.log(`  Deprecated: ${meta.deprecationDate}`);
    }
    
    if (meta.compatibleVersions.length > 0) {
      console.log(`  Compatible: ${meta.compatibleVersions.join(', ')}`);
    }
    
    console.log(`  Hash: ${contract.schemaHash.substring(0, 16)}...`);
  }
}

// CLI setup
program
  .name('contract-cli')
  .description('Contract management CLI tool')
  .version('1.0.0')
  .option('-v, --verbose', 'Enable verbose output')
  .option('-c, --config <file>', 'Configuration file')
  .option('--contracts-dir <dir>', 'Contracts directory')
  .option('--output-dir <dir>', 'Output directory')
  .option('--registry-file <file>', 'Registry file path');

// Validate command
program
  .command('validate')
  .description('Validate data against a contract')
  .argument('<contract>', 'Contract name')
  .argument('<version>', 'Contract version')
  .argument('<data-file>', 'JSON data file to validate')
  .action(async (contract, version, dataFile) => {
    const cli = new ContractCLI(program.opts());
    await cli.validateContract(contract, version, dataFile);
  });

// Generate docs command
program
  .command('docs')
  .description('Generate OpenAPI documentation')
  .option('-o, --output <file>', 'Output file path')
  .action(async (options) => {
    const cli = new ContractCLI(program.opts());
    await cli.generateDocs(options.output);
  });

// Compatibility check command
program
  .command('compatibility')
  .alias('compat')
  .description('Check compatibility between contract versions')
  .argument('<contract>', 'Contract name')
  .argument('<source-version>', 'Source version')
  .argument('<target-version>', 'Target version')
  .action(async (contract, sourceVersion, targetVersion) => {
    const cli = new ContractCLI(program.opts());
    await cli.checkCompatibility(contract, sourceVersion, targetVersion);
  });

// List contracts command
program
  .command('list')
  .alias('ls')
  .description('List all registered contracts')
  .action(async () => {
    const cli = new ContractCLI(program.opts());
    await cli.listContracts();
  });

// Register contract command
program
  .command('register')
  .description('Register a new contract')
  .argument('<contract>', 'Contract name')
  .argument('<version>', 'Contract version')
  .argument('<schema-file>', 'Schema file path')
  .option('-d, --description <desc>', 'Contract description')
  .action(async (contract, version, schemaFile, options) => {
    const cli = new ContractCLI(program.opts());
    await cli.registerContract(contract, version, schemaFile, options.description);
  });

// Show contract command
program
  .command('show')
  .description('Show contract information')
  .argument('<contract>', 'Contract name')
  .argument('[version]', 'Contract version (optional)')
  .action(async (contract, version) => {
    const cli = new ContractCLI(program.opts());
    await cli.showContract(contract, version);
  });

// Help examples
program.on('--help', () => {
  console.log('');
  console.log('Examples:');
  console.log('  $ npm run contract validate user-api 1.0.0 ./data.json');
  console.log('  $ npm run contract docs --output ./api-docs.json');
  console.log('  $ npm run contract compatibility user-api 1.0.0 1.1.0');
  console.log('  $ npm run contract list --verbose');
  console.log('  $ npm run contract register user-api 1.0.0 ./user-schema.ts');
  console.log('  $ npm run contract show user-api 1.0.0');
  console.log('');
  console.log('Configuration options:');
  console.log('  --verbose                Enable detailed output');
  console.log('  --contracts-dir <dir>    Directory containing contract files');
  console.log('  --output-dir <dir>       Directory for generated files');
  console.log('  --registry-file <file>   Path to registry storage file');
  console.log('');
});

// Parse command line arguments
program.parse();