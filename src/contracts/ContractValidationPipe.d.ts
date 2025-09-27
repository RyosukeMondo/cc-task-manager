import { PipeTransform, ArgumentMetadata } from '@nestjs/common';
import { ContractRegistry } from './ContractRegistry';
export type ValidationLocation = 'body' | 'query' | 'params';
export interface ContractValidationOptions {
    contractName: string;
    version?: string;
    location?: ValidationLocation;
}
export interface ContractValidationErrorDetails {
    error: 'ContractValidationError';
    contract: {
        name: string;
        version: string;
    };
    location: ValidationLocation;
    issues?: string[];
    message: string;
}
export declare class ContractValidationPipe implements PipeTransform<any> {
    private readonly registry;
    private readonly options;
    private readonly logger;
    constructor(registry: ContractRegistry, options: ContractValidationOptions);
    transform(value: any, metadata: ArgumentMetadata): any;
    private inferLocation;
    private getLatestVersionOrThrow;
}
