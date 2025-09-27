/**
 * Backend Exception Filters
 *
 * This module exports all exception filters that extend the existing
 * error handling infrastructure from src/contracts/.
 *
 * These filters work together to provide comprehensive error handling:
 * 1. ContractValidationFilter - Handles contract validation errors specifically
 * 2. HttpExceptionFilter - Handles standard HTTP exceptions
 * 3. AllExceptionsFilter - Catch-all for any unhandled exceptions
 *
 * The filters maintain consistency with the existing SSOT error response
 * patterns while adding backend-specific enhancements like correlation IDs,
 * enhanced logging, and development-time debugging information.
 */

export * from './http-exception.filter';
export * from './contract-validation.filter';
export * from './all-exceptions.filter';