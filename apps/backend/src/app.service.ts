import { Injectable, Logger } from '@nestjs/common';
import { ContractRegistry } from '@contracts/ContractRegistry';

/**
 * Application service demonstrating existing contract infrastructure integration
 * 
 * Follows SOLID principles:
 * - Single Responsibility: Manage application-level operations
 * - Dependency Inversion: Depends on ContractRegistry abstraction
 * - Interface Segregation: Focused service interface
 * - Open/Closed: Extensible for new functionality
 */
@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);

  constructor(private readonly contractRegistry: ContractRegistry) {}

  /**
   * Get application health status with contract integration information
   * Demonstrates integration with existing contract infrastructure
   */
  getHealth(): {
    status: string;
    message: string;
    contractsAvailable: number;
    timestamp: string;
  } {
    const contractNames = this.contractRegistry.getContractNames();
    
    this.logger.debug(`Health check: ${contractNames.length} contracts available`);
    
    return {
      status: 'ok',
      message: 'Backend application running with existing contract infrastructure',
      contractsAvailable: contractNames.length,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get contracts information demonstrating SSOT principle
   * Shows how backend leverages existing contract registry
   */
  getContractsInfo(): {
    contracts: Array<{ name: string; versions: string[] }>;
    total: number;
  } {
    const contractNames = this.contractRegistry.getContractNames();
    
    const contracts = contractNames.map(name => {
      const versions = this.contractRegistry.getContractVersions(name)
        .map(registration => registration.metadata.version);
      
      return {
        name,
        versions,
      };
    });

    this.logger.debug(`Retrieved contract information for ${contracts.length} contracts`);
    
    return {
      contracts,
      total: contracts.length,
    };
  }

  /**
   * Initialize backend-specific functionality
   * Demonstrates how to extend existing contract system
   */
  async initializeBackendContracts(): Promise<void> {
    try {
      // This method would register backend-specific contracts
      // Currently demonstrates integration without duplicating existing infrastructure
      
      const existingContracts = this.contractRegistry.getContractNames();
      this.logger.log(`Backend service initialized with ${existingContracts.length} existing contracts`);
      
      // Future: Register backend-specific schemas here
      // await this.contractRegistry.registerContract('UserManagement', '1.0.0', UserSchema);
      // await this.contractRegistry.registerContract('Authentication', '1.0.0', AuthSchema);
      
    } catch (error) {
      this.logger.error('Failed to initialize backend contracts:', error);
      throw error;
    }
  }
}