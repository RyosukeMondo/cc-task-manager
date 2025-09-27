import { Injectable, PipeTransform, BadRequestException, ArgumentMetadata, Logger } from '@nestjs/common';
import { ContractRegistry } from './ContractRegistry';

export type ValidationLocation = 'body' | 'query' | 'params';

export interface ContractValidationOptions {
  contractName: string;
  version?: string; // if omitted, latest registered version will be used
  location?: ValidationLocation; // defaults to metadata.type === 'body'
}

export interface ContractValidationErrorDetails {
  error: 'ContractValidationError';
  contract: { name: string; version: string };
  location: ValidationLocation;
  issues?: string[];
  message: string;
}

/**
 * ContractValidationPipe
 *
 * Validates incoming request data against a registered contract in the ContractRegistry.
 * - Uses latest contract version when a version is not specified.
 * - Returns structured error details via BadRequestException on validation failure.
 */
@Injectable()
export class ContractValidationPipe implements PipeTransform<any> {
  private readonly logger = new Logger(ContractValidationPipe.name);

  constructor(
    private readonly registry: ContractRegistry,
    private readonly options: ContractValidationOptions,
  ) {}

  transform(value: any, metadata: ArgumentMetadata) {
    const location: ValidationLocation = this.options.location || this.inferLocation(metadata.type);
    const name = this.options.contractName;

    const version = this.options.version || this.getLatestVersionOrThrow(name);

    const result = this.registry.validateAgainstContract(name, version, value);
    if (!result.success) {
      const details: ContractValidationErrorDetails = {
        error: 'ContractValidationError',
        contract: { name, version },
        location,
        message: result.error || 'Validation failed',
      };

      this.logger.warn(`Contract validation failed for ${name}@${version} at ${location}: ${details.message}`);
      throw new BadRequestException(details);
    }

    // return parsed/validated value for downstream handlers
    return result.data ?? value;
  }

  private inferLocation(type: ArgumentMetadata['type']): ValidationLocation {
    if (type === 'query') return 'query';
    if (type === 'param') return 'params';
    return 'body';
  }

  private getLatestVersionOrThrow(name: string): string {
    const latest = this.registry.getLatestContract(name);
    if (!latest) {
      const msg = `Contract not found: ${name}`;
      this.logger.error(msg);
      throw new BadRequestException({
        error: 'ContractValidationError',
        contract: { name, version: 'latest' },
        location: 'body',
        message: msg,
      } as ContractValidationErrorDetails);
    }
    return latest.metadata.version;
  }
}
