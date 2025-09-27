/**
 * Form Components Library
 *
 * Reusable form components using existing contract validation infrastructure
 * Follows SOLID principles with Liskov Substitution for field components
 */

// Base form component for composition
export { BaseForm } from './BaseForm';
export type { BaseFormConfig, BaseFormProps } from './BaseForm';

// Field components implementing Liskov Substitution Principle
export {
  TextField,
  NumberField,
  TextareaField,
  SelectField
} from './FormField';
export type {
  BaseFieldProps,
  TextFieldProps,
  NumberFieldProps,
  TextareaFieldProps,
  SelectFieldProps,
  SelectOption
} from './FormField';

// Pre-built forms using existing contract validation
export {
  ProcessConfigForm,
  TaskExecutionRequestForm,
  ClaudeCodeOptionsForm,
  WorkerConfigForm
} from './ContractForms';

// Form hooks for reusability and state management
export {
  useFormSubmission,
  useProcessConfigForm,
  useTaskExecutionRequestForm,
  useWorkerConfigForm,
  useClaudeCodeOptionsForm,
  useFormPersistence,
  useRealtimeValidation,
  useProcessConfigValidation,
  useTaskExecutionRequestValidation,
  useWorkerConfigValidation,
  useClaudeCodeOptionsValidation,
  useTaskStatusValidation
} from './hooks';