#!/usr/bin/env python3
"""
Schema Validator for Claude Code Wrapper Specifications

This module provides comprehensive JSON schema validation for Claude Code
wrapper implementations. It validates commands, events, and state transitions
against the formal specifications defined in claudeCodeSpecs/schemas/.

Requirements satisfied: 5.1, 5.2, 5.3 - Schema validation with detailed error reporting
"""

import json
import os
import sys
from pathlib import Path
from typing import Dict, List, Any, Optional, Union
from dataclasses import dataclass
from enum import Enum

import jsonschema
from jsonschema.validators import Draft202012Validator
from jsonschema.exceptions import ValidationError, SchemaError


class SchemaType(Enum):
    """Enumeration of available schema types for validation"""
    COMMANDS = "commands"
    EVENTS = "events"
    STATES = "states"


@dataclass
class ValidationResult:
    """Result of schema validation with detailed error information"""
    is_valid: bool
    schema_type: SchemaType
    errors: List[str]
    warnings: List[str]
    validated_data: Optional[Dict[str, Any]] = None

    def to_dict(self) -> Dict[str, Any]:
        """Convert validation result to dictionary for JSON serialization"""
        return {
            "is_valid": self.is_valid,
            "schema_type": self.schema_type.value,
            "errors": self.errors,
            "warnings": self.warnings,
            "validated_data": self.validated_data
        }


class SchemaValidator:
    """
    JSON Schema validator for Claude Code wrapper specifications.

    Leverages the formal schemas created in Task 1 to provide comprehensive
    validation of wrapper implementations against protocol specifications.
    """

    def __init__(self, schemas_dir: Optional[Path] = None):
        """
        Initialize validator with schema directory.

        Args:
            schemas_dir: Path to directory containing JSON schemas.
                        Defaults to claudeCodeSpecs/schemas/
        """
        if schemas_dir is None:
            # Default to schemas directory relative to this file
            current_dir = Path(__file__).parent
            schemas_dir = current_dir.parent / "schemas"

        self.schemas_dir = Path(schemas_dir)
        self.schemas: Dict[SchemaType, Dict[str, Any]] = {}
        self.validators: Dict[SchemaType, Draft202012Validator] = {}

        # Load all available schemas on initialization
        self._load_schemas()

    def _load_schemas(self) -> None:
        """Load and validate all JSON schemas from the schemas directory"""
        schema_files = {
            SchemaType.COMMANDS: "commands.json",
            SchemaType.EVENTS: "events.json",
            SchemaType.STATES: "states.json"
        }

        for schema_type, filename in schema_files.items():
            schema_path = self.schemas_dir / filename

            if not schema_path.exists():
                print(f"Warning: Schema file {schema_path} not found, skipping {schema_type.value}")
                continue

            try:
                with open(schema_path, 'r', encoding='utf-8') as f:
                    schema = json.load(f)

                # Validate the schema itself
                Draft202012Validator.check_schema(schema)

                # Store schema and create validator
                self.schemas[schema_type] = schema
                self.validators[schema_type] = Draft202012Validator(schema)

            except (json.JSONDecodeError, SchemaError) as e:
                print(f"Error loading schema {schema_path}: {e}")
                sys.exit(1)

    def validate_command(self, command_data: Union[str, Dict[str, Any]]) -> ValidationResult:
        """
        Validate a Claude Code command against the command schema.

        Args:
            command_data: Command data as JSON string or dictionary

        Returns:
            ValidationResult with validation outcome and detailed errors
        """
        return self._validate_data(command_data, SchemaType.COMMANDS)

    def validate_event(self, event_data: Union[str, Dict[str, Any]]) -> ValidationResult:
        """
        Validate a Claude Code event against the event schema.

        Args:
            event_data: Event data as JSON string or dictionary

        Returns:
            ValidationResult with validation outcome and detailed errors
        """
        return self._validate_data(event_data, SchemaType.EVENTS)

    def validate_state(self, state_data: Union[str, Dict[str, Any]]) -> ValidationResult:
        """
        Validate a Claude Code state against the state schema.

        Args:
            state_data: State data as JSON string or dictionary

        Returns:
            ValidationResult with validation outcome and detailed errors
        """
        return self._validate_data(state_data, SchemaType.STATES)

    def _validate_data(self, data: Union[str, Dict[str, Any]], schema_type: SchemaType) -> ValidationResult:
        """
        Internal method to validate data against specified schema type.

        Args:
            data: Data to validate as JSON string or dictionary
            schema_type: Type of schema to validate against

        Returns:
            ValidationResult with detailed validation information
        """
        errors = []
        warnings = []
        validated_data = None

        # Check if schema is available
        if schema_type not in self.validators:
            errors.append(f"Schema {schema_type.value} not available")
            return ValidationResult(False, schema_type, errors, warnings)

        # Parse JSON if data is string
        try:
            if isinstance(data, str):
                validated_data = json.loads(data)
            else:
                validated_data = data
        except json.JSONDecodeError as e:
            errors.append(f"Invalid JSON: {e}")
            return ValidationResult(False, schema_type, errors, warnings)

        # Validate against schema
        validator = self.validators[schema_type]
        validation_errors = list(validator.iter_errors(validated_data))

        if validation_errors:
            for error in validation_errors:
                # Create detailed error message with path and context
                error_path = " -> ".join(str(p) for p in error.absolute_path) if error.absolute_path else "root"
                error_msg = f"At {error_path}: {error.message}"

                # Add context about failed value if available
                if hasattr(error, 'instance'):
                    error_msg += f" (value: {error.instance})"

                errors.append(error_msg)

        # Check for potential warnings (deprecated fields, etc.)
        self._check_warnings(validated_data, schema_type, warnings)

        is_valid = len(errors) == 0
        return ValidationResult(is_valid, schema_type, errors, warnings, validated_data)

    def _check_warnings(self, data: Dict[str, Any], schema_type: SchemaType, warnings: List[str]) -> None:
        """
        Check for potential warnings like deprecated fields or legacy patterns.

        Args:
            data: Validated data to check for warnings
            schema_type: Type of schema being validated
            warnings: List to append warnings to
        """
        if schema_type == SchemaType.COMMANDS:
            # Check for legacy command format
            if "command" in data and "action" not in data:
                warnings.append("Using legacy command format - consider migrating to 'action' field")

            # Check for deprecated working_directory field
            if "working_directory" in data:
                warnings.append("Field 'working_directory' is deprecated - use 'options.cwd' instead")

        # Add more warning checks for other schema types as needed

    def validate_batch(self, data_list: List[Union[str, Dict[str, Any]]],
                      schema_type: SchemaType) -> List[ValidationResult]:
        """
        Validate multiple data items against the same schema type.

        Args:
            data_list: List of data items to validate
            schema_type: Schema type to validate against

        Returns:
            List of ValidationResult objects, one per input item
        """
        results = []
        for i, data in enumerate(data_list):
            try:
                result = self._validate_data(data, schema_type)
                results.append(result)
            except Exception as e:
                # Handle unexpected errors gracefully
                error_result = ValidationResult(
                    False,
                    schema_type,
                    [f"Unexpected validation error: {e}"],
                    []
                )
                results.append(error_result)

        return results

    def get_available_schemas(self) -> List[str]:
        """
        Get list of available schema types that can be validated.

        Returns:
            List of schema type names that are loaded and available
        """
        return [schema_type.value for schema_type in self.schemas.keys()]

    def get_schema(self, schema_type: SchemaType) -> Optional[Dict[str, Any]]:
        """
        Get the raw JSON schema for a specific schema type.

        Args:
            schema_type: Type of schema to retrieve

        Returns:
            JSON schema dictionary or None if not available
        """
        return self.schemas.get(schema_type)


def main():
    """
    CLI interface for schema validation.

    Usage:
        python schema-validator.py <schema_type> <data_file>
        python schema-validator.py commands command.json
    """
    if len(sys.argv) != 3:
        print("Usage: python schema-validator.py <schema_type> <data_file>")
        print("Schema types: commands, events, states")
        sys.exit(1)

    schema_type_str = sys.argv[1].lower()
    data_file = sys.argv[2]

    # Parse schema type
    try:
        schema_type = SchemaType(schema_type_str)
    except ValueError:
        print(f"Invalid schema type: {schema_type_str}")
        print("Valid types: commands, events, states")
        sys.exit(1)

    # Validate data file exists
    if not os.path.exists(data_file):
        print(f"Data file not found: {data_file}")
        sys.exit(1)

    # Load and validate data
    try:
        with open(data_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except json.JSONDecodeError as e:
        print(f"Invalid JSON in {data_file}: {e}")
        sys.exit(1)

    # Perform validation
    validator = SchemaValidator()

    if schema_type == SchemaType.COMMANDS:
        result = validator.validate_command(data)
    elif schema_type == SchemaType.EVENTS:
        result = validator.validate_event(data)
    elif schema_type == SchemaType.STATES:
        result = validator.validate_state(data)

    # Output results
    print(json.dumps(result.to_dict(), indent=2))

    # Exit with appropriate code
    sys.exit(0 if result.is_valid else 1)


if __name__ == "__main__":
    main()