#!/usr/bin/env python3
"""
Validation API - Schema Validation and Compliance Testing API

This module provides REST API endpoints for schema validation, compliance testing,
and specification validation services.

Requirements satisfied: 4.1, 4.2 - Validation system programmatic access
"""

import asyncio
import json
import logging
import sys
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any, Optional, Union
from dataclasses import dataclass, asdict

# Add parent directory to path for imports
sys.path.append(str(Path(__file__).parent.parent))

from validation.schema_validator import SchemaValidator, ValidationResult, SchemaType
from validation.compliance_checker import ComplianceChecker, ComplianceResult
from validation.test_runner import TestRunner, TestResult

logger = logging.getLogger(__name__)


@dataclass
class ValidationAPIResponse:
    """Standardized validation API response format"""
    success: bool
    data: Optional[Any] = None
    error: Optional[str] = None
    timestamp: str = None
    validation_id: Optional[str] = None

    def __post_init__(self):
        if self.timestamp is None:
            self.timestamp = datetime.utcnow().isoformat()

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


class ValidationAPI:
    """
    Validation API providing access to schema validation, compliance testing,
    and specification validation capabilities.
    """

    def __init__(self, schemas_dir: str = "claudeCodeSpecs/schemas",
                 validation_dir: str = "claudeCodeSpecs/validation"):
        self.schemas_dir = Path(schemas_dir)
        self.validation_dir = Path(validation_dir)

        # Ensure directories exist
        self.schemas_dir.mkdir(parents=True, exist_ok=True)
        self.validation_dir.mkdir(parents=True, exist_ok=True)

        # Initialize validation components
        self.schema_validator = SchemaValidator(str(self.schemas_dir))
        self.compliance_checker = ComplianceChecker()
        self.test_runner = TestRunner()

        # Validation history
        self.validation_history = []

    # Schema Validation Endpoints

    async def validate_data(self, data: Dict[str, Any], schema_type: str) -> ValidationAPIResponse:
        """Validate data against a specific schema type"""
        try:
            # Convert string to SchemaType enum
            try:
                schema_enum = SchemaType(schema_type.lower())
            except ValueError:
                return ValidationAPIResponse(
                    success=False,
                    error=f"Invalid schema type: {schema_type}. Valid types: {[t.value for t in SchemaType]}"
                )

            # Perform validation
            validation_result = self.schema_validator.validate(data, schema_enum)

            # Generate validation ID
            validation_id = f"val_{datetime.utcnow().timestamp()}"

            # Store in history
            self.validation_history.append({
                "validation_id": validation_id,
                "timestamp": datetime.utcnow().isoformat(),
                "schema_type": schema_type,
                "is_valid": validation_result.is_valid,
                "error_count": len(validation_result.errors),
                "warning_count": len(validation_result.warnings)
            })

            return ValidationAPIResponse(
                success=True,
                validation_id=validation_id,
                data={
                    "validation_id": validation_id,
                    "is_valid": validation_result.is_valid,
                    "schema_type": schema_type,
                    "errors": validation_result.errors,
                    "warnings": validation_result.warnings,
                    "validated_data": validation_result.validated_data
                }
            )

        except Exception as e:
            logger.error(f"Failed to validate data: {e}")
            return ValidationAPIResponse(success=False, error=str(e))

    async def validate_batch(self, batch_data: List[Dict[str, Any]]) -> ValidationAPIResponse:
        """Validate multiple data items in batch"""
        try:
            results = []
            overall_success = True

            for i, item in enumerate(batch_data):
                data = item.get("data", {})
                schema_type = item.get("schema_type", "")

                if not schema_type:
                    results.append({
                        "index": i,
                        "success": False,
                        "error": "No schema_type specified"
                    })
                    overall_success = False
                    continue

                try:
                    schema_enum = SchemaType(schema_type.lower())
                    validation_result = self.schema_validator.validate(data, schema_enum)

                    results.append({
                        "index": i,
                        "success": True,
                        "is_valid": validation_result.is_valid,
                        "schema_type": schema_type,
                        "errors": validation_result.errors,
                        "warnings": validation_result.warnings
                    })

                    if not validation_result.is_valid:
                        overall_success = False

                except ValueError:
                    results.append({
                        "index": i,
                        "success": False,
                        "error": f"Invalid schema type: {schema_type}"
                    })
                    overall_success = False

                except Exception as e:
                    results.append({
                        "index": i,
                        "success": False,
                        "error": str(e)
                    })
                    overall_success = False

            # Generate batch validation ID
            validation_id = f"batch_{datetime.utcnow().timestamp()}"

            return ValidationAPIResponse(
                success=True,
                validation_id=validation_id,
                data={
                    "validation_id": validation_id,
                    "overall_success": overall_success,
                    "total_items": len(batch_data),
                    "valid_items": sum(1 for r in results if r.get("is_valid", False)),
                    "results": results
                }
            )

        except Exception as e:
            logger.error(f"Failed to validate batch: {e}")
            return ValidationAPIResponse(success=False, error=str(e))

    async def get_validation_schemas(self) -> ValidationAPIResponse:
        """Get available validation schemas"""
        try:
            schemas = {}

            for schema_type in SchemaType:
                schema_data = self.schema_validator.get_schema(schema_type)
                if schema_data:
                    schemas[schema_type.value] = {
                        "title": schema_data.get("title", schema_type.value),
                        "description": schema_data.get("description", ""),
                        "version": schema_data.get("version", "unknown"),
                        "properties": list(schema_data.get("properties", {}).keys())
                    }

            return ValidationAPIResponse(
                success=True,
                data={
                    "schemas": schemas,
                    "count": len(schemas),
                    "available_types": [t.value for t in SchemaType]
                }
            )

        except Exception as e:
            logger.error(f"Failed to get validation schemas: {e}")
            return ValidationAPIResponse(success=False, error=str(e))

    async def get_schema_details(self, schema_type: str) -> ValidationAPIResponse:
        """Get detailed information about a specific schema"""
        try:
            try:
                schema_enum = SchemaType(schema_type.lower())
            except ValueError:
                return ValidationAPIResponse(
                    success=False,
                    error=f"Invalid schema type: {schema_type}"
                )

            schema_data = self.schema_validator.get_schema(schema_enum)

            if not schema_data:
                return ValidationAPIResponse(
                    success=False,
                    error=f"Schema not found for type: {schema_type}"
                )

            return ValidationAPIResponse(
                success=True,
                data={
                    "schema_type": schema_type,
                    "schema": schema_data
                }
            )

        except Exception as e:
            logger.error(f"Failed to get schema details for {schema_type}: {e}")
            return ValidationAPIResponse(success=False, error=str(e))

    # Compliance Testing Endpoints

    async def check_compliance(self, wrapper_implementation: Dict[str, Any],
                              specification: Dict[str, Any]) -> ValidationAPIResponse:
        """Check compliance of wrapper implementation against specification"""
        try:
            compliance_result = await self.compliance_checker.check_compliance(
                wrapper_implementation, specification
            )

            validation_id = f"compliance_{datetime.utcnow().timestamp()}"

            # Store in history
            self.validation_history.append({
                "validation_id": validation_id,
                "timestamp": datetime.utcnow().isoformat(),
                "type": "compliance",
                "is_compliant": compliance_result.is_compliant,
                "violation_count": len(compliance_result.violations),
                "recommendation_count": len(compliance_result.recommendations)
            })

            return ValidationAPIResponse(
                success=True,
                validation_id=validation_id,
                data={
                    "validation_id": validation_id,
                    "is_compliant": compliance_result.is_compliant,
                    "compliance_score": compliance_result.compliance_score,
                    "violations": compliance_result.violations,
                    "recommendations": compliance_result.recommendations,
                    "detailed_analysis": compliance_result.detailed_analysis
                }
            )

        except Exception as e:
            logger.error(f"Failed to check compliance: {e}")
            return ValidationAPIResponse(success=False, error=str(e))

    async def generate_compliance_report(self, wrapper_implementation: Dict[str, Any],
                                       specification: Dict[str, Any]) -> ValidationAPIResponse:
        """Generate detailed compliance report"""
        try:
            report = await self.compliance_checker.generate_compliance_report(
                wrapper_implementation, specification
            )

            validation_id = f"report_{datetime.utcnow().timestamp()}"

            return ValidationAPIResponse(
                success=True,
                validation_id=validation_id,
                data={
                    "validation_id": validation_id,
                    "report": report,
                    "generated_at": datetime.utcnow().isoformat()
                }
            )

        except Exception as e:
            logger.error(f"Failed to generate compliance report: {e}")
            return ValidationAPIResponse(success=False, error=str(e))

    # Test Execution Endpoints

    async def run_validation_tests(self, test_suite: str = "default") -> ValidationAPIResponse:
        """Run validation test suite"""
        try:
            test_result = await self.test_runner.run_test_suite(test_suite)

            validation_id = f"test_{datetime.utcnow().timestamp()}"

            # Store in history
            self.validation_history.append({
                "validation_id": validation_id,
                "timestamp": datetime.utcnow().isoformat(),
                "type": "test_suite",
                "test_suite": test_suite,
                "passed": test_result.passed,
                "total_tests": test_result.total_tests,
                "passed_tests": test_result.passed_tests
            })

            return ValidationAPIResponse(
                success=True,
                validation_id=validation_id,
                data={
                    "validation_id": validation_id,
                    "test_suite": test_suite,
                    "passed": test_result.passed,
                    "total_tests": test_result.total_tests,
                    "passed_tests": test_result.passed_tests,
                    "failed_tests": test_result.failed_tests,
                    "test_results": test_result.test_results,
                    "execution_time": test_result.execution_time
                }
            )

        except Exception as e:
            logger.error(f"Failed to run validation tests: {e}")
            return ValidationAPIResponse(success=False, error=str(e))

    async def run_custom_test(self, test_definition: Dict[str, Any]) -> ValidationAPIResponse:
        """Run a custom validation test"""
        try:
            test_result = await self.test_runner.run_custom_test(test_definition)

            validation_id = f"custom_{datetime.utcnow().timestamp()}"

            return ValidationAPIResponse(
                success=True,
                validation_id=validation_id,
                data={
                    "validation_id": validation_id,
                    "test_name": test_definition.get("name", "custom_test"),
                    "passed": test_result.passed,
                    "result": test_result.result,
                    "execution_time": test_result.execution_time,
                    "details": test_result.details
                }
            )

        except Exception as e:
            logger.error(f"Failed to run custom test: {e}")
            return ValidationAPIResponse(success=False, error=str(e))

    # History and Analytics Endpoints

    async def get_validation_history(self, limit: int = 100, offset: int = 0) -> ValidationAPIResponse:
        """Get validation history with pagination"""
        try:
            total_count = len(self.validation_history)
            history_slice = self.validation_history[offset:offset + limit]

            return ValidationAPIResponse(
                success=True,
                data={
                    "history": history_slice,
                    "count": len(history_slice),
                    "total_count": total_count,
                    "offset": offset,
                    "limit": limit
                }
            )

        except Exception as e:
            logger.error(f"Failed to get validation history: {e}")
            return ValidationAPIResponse(success=False, error=str(e))

    async def get_validation_by_id(self, validation_id: str) -> ValidationAPIResponse:
        """Get specific validation result by ID"""
        try:
            validation = next(
                (v for v in self.validation_history if v["validation_id"] == validation_id),
                None
            )

            if not validation:
                return ValidationAPIResponse(
                    success=False,
                    error=f"Validation '{validation_id}' not found"
                )

            return ValidationAPIResponse(
                success=True,
                validation_id=validation_id,
                data=validation
            )

        except Exception as e:
            logger.error(f"Failed to get validation {validation_id}: {e}")
            return ValidationAPIResponse(success=False, error=str(e))

    async def get_validation_statistics(self, time_range_hours: int = 24) -> ValidationAPIResponse:
        """Get validation statistics and analytics"""
        try:
            from datetime import timedelta

            cutoff_time = datetime.utcnow() - timedelta(hours=time_range_hours)

            # Filter recent validations
            recent_validations = [
                v for v in self.validation_history
                if datetime.fromisoformat(v["timestamp"]) > cutoff_time
            ]

            # Calculate statistics
            total_validations = len(recent_validations)
            successful_validations = sum(1 for v in recent_validations
                                       if v.get("is_valid", False) or v.get("is_compliant", False) or v.get("passed", False))

            # Group by type
            validation_types = {}
            schema_types = {}

            for validation in recent_validations:
                # Validation type distribution
                val_type = validation.get("type", "schema")
                validation_types[val_type] = validation_types.get(val_type, 0) + 1

                # Schema type distribution (for schema validations)
                if "schema_type" in validation:
                    schema_type = validation["schema_type"]
                    schema_types[schema_type] = schema_types.get(schema_type, 0) + 1

            statistics = {
                "time_range_hours": time_range_hours,
                "total_validations": total_validations,
                "successful_validations": successful_validations,
                "success_rate": successful_validations / total_validations if total_validations > 0 else 0,
                "validation_types": validation_types,
                "schema_types": schema_types,
                "recent_activity": recent_validations[-10:] if recent_validations else []
            }

            return ValidationAPIResponse(
                success=True,
                data=statistics
            )

        except Exception as e:
            logger.error(f"Failed to get validation statistics: {e}")
            return ValidationAPIResponse(success=False, error=str(e))

    # System Status Endpoints

    async def get_validation_system_status(self) -> ValidationAPIResponse:
        """Get validation system status and health"""
        try:
            status = {
                "system": "Claude Code Validation API",
                "version": "1.0.0",
                "status": "healthy",
                "timestamp": datetime.utcnow().isoformat(),
                "components": {
                    "schema_validator": "initialized",
                    "compliance_checker": "initialized",
                    "test_runner": "initialized"
                },
                "directories": {
                    "schemas": str(self.schemas_dir),
                    "validation": str(self.validation_dir)
                },
                "statistics": {
                    "available_schemas": len(list(SchemaType)),
                    "validation_history_count": len(self.validation_history),
                    "schema_files": len(list(self.schemas_dir.glob("*.json"))) if self.schemas_dir.exists() else 0
                }
            }

            return ValidationAPIResponse(success=True, data=status)

        except Exception as e:
            logger.error(f"Failed to get validation system status: {e}")
            return ValidationAPIResponse(success=False, error=str(e))

    # Utility Endpoints

    async def clear_validation_history(self) -> ValidationAPIResponse:
        """Clear validation history"""
        try:
            cleared_count = len(self.validation_history)
            self.validation_history.clear()

            return ValidationAPIResponse(
                success=True,
                data={
                    "cleared_count": cleared_count,
                    "cleared_at": datetime.utcnow().isoformat()
                }
            )

        except Exception as e:
            logger.error(f"Failed to clear validation history: {e}")
            return ValidationAPIResponse(success=False, error=str(e))

    async def export_validation_data(self, format: str = "json") -> ValidationAPIResponse:
        """Export validation data in specified format"""
        try:
            export_data = {
                "validation_history": self.validation_history,
                "system_info": {
                    "exported_at": datetime.utcnow().isoformat(),
                    "total_validations": len(self.validation_history),
                    "format": format
                }
            }

            if format.lower() == "json":
                return ValidationAPIResponse(
                    success=True,
                    data=export_data
                )
            else:
                return ValidationAPIResponse(
                    success=False,
                    error=f"Unsupported export format: {format}"
                )

        except Exception as e:
            logger.error(f"Failed to export validation data: {e}")
            return ValidationAPIResponse(success=False, error=str(e))


# CLI interface for testing
if __name__ == "__main__":
    import asyncio

    async def main():
        api = ValidationAPI()

        print("Testing Validation API...")

        # Get system status
        status = await api.get_validation_system_status()
        print(f"System Status: {status.success}")
        if status.success:
            print(f"  Available Schemas: {status.data['statistics']['available_schemas']}")
            print(f"  History Count: {status.data['statistics']['validation_history_count']}")

        # Get available schemas
        schemas = await api.get_validation_schemas()
        print(f"Available Schemas: {schemas.success}")
        if schemas.success:
            print(f"  Schema Types: {schemas.data['available_types']}")

        # Test validation with sample data
        sample_data = {
            "command": "test_command",
            "parameters": {"param1": "value1"},
            "timestamp": datetime.utcnow().isoformat()
        }

        validation = await api.validate_data(sample_data, "commands")
        print(f"Sample Validation: {validation.success}")
        if validation.success:
            print(f"  Is Valid: {validation.data['is_valid']}")
            print(f"  Errors: {len(validation.data['errors'])}")

        # Get statistics
        stats = await api.get_validation_statistics()
        print(f"Statistics: {stats.success}")
        if stats.success:
            print(f"  Total Validations: {stats.data['total_validations']}")
            print(f"  Success Rate: {stats.data['success_rate']:.2%}")

    asyncio.run(main())