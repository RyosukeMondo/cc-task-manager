import { ArgumentMetadata, Injectable, PipeTransform } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';

/**
 * Zod Validation Pipe for WebSocket events
 * Ensures type safety and validation for incoming WebSocket messages
 */
@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private validatorFn: (data: unknown) => any) {}

  transform(value: any, metadata: ArgumentMetadata) {
    try {
      return this.validatorFn(value);
    } catch (error) {
      throw new WsException(`Validation failed: ${error.message}`);
    }
  }
}