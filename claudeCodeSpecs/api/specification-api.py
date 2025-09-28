#!/usr/bin/env python3
"""
Specification API - Unified REST API for Claude Code Specification System

This module provides the main REST API endpoints for accessing all specification
system components. It serves as the primary interface for specification management,
schema access, and specification lifecycle operations.

Requirements satisfied: 4.1, 4.2, 4.3, 4.4 - Unified programmatic access
"""

import asyncio
import json
import logging
import os
import sys
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, asdict

# Add parent directory to path for imports
sys.path.append(str(Path(__file__).parent.parent))

from analysis.behavior_analyzer import BehaviorAnalyzer, BehavioralSpecification
from runtime_monitoring.capture_engine import EventCapture, CapturedEvent
from validation.schema_validator import SchemaValidator, ValidationResult, SchemaType

logger = logging.getLogger(__name__)


@dataclass
class APIResponse:
    """Standardized API response format"""
    success: bool
    data: Optional[Any] = None
    error: Optional[str] = None
    timestamp: str = None
    version: str = "1.0.0"

    def __post_init__(self):
        if self.timestamp is None:
            self.timestamp = datetime.utcnow().isoformat()

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


class SpecificationAPI:
    """
    Main specification API providing unified access to all specification system components.
    Implements REST-like interface for specification management and validation.
    """

    def __init__(self, base_dir: str = "claudeCodeSpecs"):
        self.base_dir = Path(base_dir)
        self.schemas_dir = self.base_dir / "schemas"
        self.generated_dir = self.base_dir / "generated"
        self.specs_dir = self.base_dir / "specs"

        # Initialize component instances
        self.behavior_analyzer = BehaviorAnalyzer(str(self.generated_dir))
        self.event_capture = EventCapture()
        self.schema_validator = SchemaValidator(str(self.schemas_dir))

        # Ensure directories exist
        for directory in [self.schemas_dir, self.generated_dir, self.specs_dir]:
            directory.mkdir(parents=True, exist_ok=True)

    # Specification Management Endpoints

    async def list_specifications(self) -> APIResponse:
        """List all available specifications"""
        try:
            specifications = []

            # List generated specifications
            if self.generated_dir.exists():
                for spec_file in self.generated_dir.glob("*.json"):
                    try:
                        with open(spec_file, 'r') as f:
                            spec_data = json.load(f)
                            specifications.append({
                                "name": spec_file.stem,
                                "type": "generated",
                                "path": str(spec_file),
                                "version": spec_data.get("version", "unknown"),
                                "generated_at": spec_data.get("generated_at"),
                                "size": spec_file.stat().st_size
                            })
                    except Exception as e:
                        logger.warning(f"Failed to read specification {spec_file}: {e}")

            # List schema files
            if self.schemas_dir.exists():
                for schema_file in self.schemas_dir.glob("*.json"):
                    specifications.append({
                        "name": schema_file.stem,
                        "type": "schema",
                        "path": str(schema_file),
                        "size": schema_file.stat().st_size
                    })

            return APIResponse(success=True, data={
                "specifications": specifications,
                "count": len(specifications)
            })

        except Exception as e:
            logger.error(f"Failed to list specifications: {e}")
            return APIResponse(success=False, error=str(e))

    async def get_specification(self, spec_name: str) -> APIResponse:
        """Get a specific specification by name"""
        try:
            # Try generated specifications first
            generated_path = self.generated_dir / f"{spec_name}.json"
            if generated_path.exists():
                with open(generated_path, 'r') as f:
                    spec_data = json.load(f)
                return APIResponse(success=True, data=spec_data)

            # Try schema files
            schema_path = self.schemas_dir / f"{spec_name}.json"
            if schema_path.exists():
                with open(schema_path, 'r') as f:
                    schema_data = json.load(f)
                return APIResponse(success=True, data=schema_data)

            return APIResponse(success=False, error=f"Specification '{spec_name}' not found")

        except Exception as e:
            logger.error(f"Failed to get specification {spec_name}: {e}")
            return APIResponse(success=False, error=str(e))

    async def create_specification(self, spec_name: str, spec_data: Dict[str, Any]) -> APIResponse:
        """Create a new specification"""
        try:
            # Validate the specification data
            if not isinstance(spec_data, dict):
                return APIResponse(success=False, error="Specification data must be a dictionary")

            # Add metadata
            spec_data.update({
                "name": spec_name,
                "created_at": datetime.utcnow().isoformat(),
                "version": spec_data.get("version", "1.0.0")
            })

            # Save to generated specifications
            output_path = self.generated_dir / f"{spec_name}.json"
            with open(output_path, 'w') as f:
                json.dump(spec_data, f, indent=2)

            return APIResponse(success=True, data={
                "name": spec_name,
                "path": str(output_path),
                "created_at": spec_data["created_at"]
            })

        except Exception as e:
            logger.error(f"Failed to create specification {spec_name}: {e}")
            return APIResponse(success=False, error=str(e))

    async def update_specification(self, spec_name: str, spec_data: Dict[str, Any]) -> APIResponse:
        """Update an existing specification"""
        try:
            spec_path = self.generated_dir / f"{spec_name}.json"

            if not spec_path.exists():
                return APIResponse(success=False, error=f"Specification '{spec_name}' not found")

            # Load existing specification
            with open(spec_path, 'r') as f:
                existing_spec = json.load(f)

            # Update with new data
            existing_spec.update(spec_data)
            existing_spec["updated_at"] = datetime.utcnow().isoformat()

            # Save updated specification
            with open(spec_path, 'w') as f:
                json.dump(existing_spec, f, indent=2)

            return APIResponse(success=True, data={
                "name": spec_name,
                "updated_at": existing_spec["updated_at"]
            })

        except Exception as e:
            logger.error(f"Failed to update specification {spec_name}: {e}")
            return APIResponse(success=False, error=str(e))

    async def delete_specification(self, spec_name: str) -> APIResponse:
        """Delete a specification"""
        try:
            spec_path = self.generated_dir / f"{spec_name}.json"

            if not spec_path.exists():
                return APIResponse(success=False, error=f"Specification '{spec_name}' not found")

            spec_path.unlink()

            return APIResponse(success=True, data={
                "name": spec_name,
                "deleted_at": datetime.utcnow().isoformat()
            })

        except Exception as e:
            logger.error(f"Failed to delete specification {spec_name}: {e}")
            return APIResponse(success=False, error=str(e))

    # Schema Management Endpoints

    async def list_schemas(self) -> APIResponse:
        """List all available schemas"""
        try:
            schemas = []

            if self.schemas_dir.exists():
                for schema_file in self.schemas_dir.glob("*.json"):
                    try:
                        with open(schema_file, 'r') as f:
                            schema_data = json.load(f)
                            schemas.append({
                                "name": schema_file.stem,
                                "path": str(schema_file),
                                "title": schema_data.get("title", schema_file.stem),
                                "description": schema_data.get("description", ""),
                                "version": schema_data.get("version", "unknown"),
                                "size": schema_file.stat().st_size
                            })
                    except Exception as e:
                        logger.warning(f"Failed to read schema {schema_file}: {e}")

            return APIResponse(success=True, data={
                "schemas": schemas,
                "count": len(schemas)
            })

        except Exception as e:
            logger.error(f"Failed to list schemas: {e}")
            return APIResponse(success=False, error=str(e))

    async def get_schema(self, schema_name: str) -> APIResponse:
        """Get a specific schema by name"""
        try:
            schema_path = self.schemas_dir / f"{schema_name}.json"

            if not schema_path.exists():
                return APIResponse(success=False, error=f"Schema '{schema_name}' not found")

            with open(schema_path, 'r') as f:
                schema_data = json.load(f)

            return APIResponse(success=True, data=schema_data)

        except Exception as e:
            logger.error(f"Failed to get schema {schema_name}: {e}")
            return APIResponse(success=False, error=str(e))

    # Analysis and Generation Endpoints

    async def generate_specification_from_data(self, runtime_data: List[Dict[str, Any]],
                                             spec_name: str = None) -> APIResponse:
        """Generate a behavioral specification from runtime data"""
        try:
            if not runtime_data:
                return APIResponse(success=False, error="No runtime data provided")

            # Generate specification using behavior analyzer
            specification = await self._generate_behavioral_spec(runtime_data, spec_name)

            # Save generated specification
            if spec_name:
                output_path = self.generated_dir / f"{spec_name}.json"
                with open(output_path, 'w') as f:
                    json.dump(asdict(specification), f, indent=2, default=str)

            return APIResponse(success=True, data={
                "specification": asdict(specification),
                "generated_at": specification.generated_at,
                "name": specification.name
            })

        except Exception as e:
            logger.error(f"Failed to generate specification: {e}")
            return APIResponse(success=False, error=str(e))

    async def analyze_runtime_behavior(self, session_data: List[Dict[str, Any]]) -> APIResponse:
        """Analyze runtime behavior patterns"""
        try:
            # Convert to captured events
            events = []
            for data in session_data:
                event = CapturedEvent(
                    event_id=data.get("event_id", "unknown"),
                    timestamp=datetime.fromisoformat(data.get("timestamp", datetime.utcnow().isoformat())),
                    event_type=data.get("event_type", "unknown"),
                    session_id=data.get("session_id"),
                    run_id=data.get("run_id"),
                    payload=data.get("payload", {}),
                    processing_stage=data.get("processing_stage", "unknown")
                )
                events.append(event)

            # Perform analysis
            analysis_result = await self.behavior_analyzer.analyze_runtime_data(events)

            return APIResponse(success=True, data=analysis_result)

        except Exception as e:
            logger.error(f"Failed to analyze runtime behavior: {e}")
            return APIResponse(success=False, error=str(e))

    # System Status and Health Endpoints

    async def get_system_status(self) -> APIResponse:
        """Get system status and health information"""
        try:
            status = {
                "system": "Claude Code Specification API",
                "version": "1.0.0",
                "status": "healthy",
                "timestamp": datetime.utcnow().isoformat(),
                "components": {
                    "behavior_analyzer": "initialized",
                    "event_capture": "initialized",
                    "schema_validator": "initialized"
                },
                "directories": {
                    "schemas": str(self.schemas_dir),
                    "generated": str(self.generated_dir),
                    "specs": str(self.specs_dir)
                },
                "statistics": {
                    "schema_count": len(list(self.schemas_dir.glob("*.json"))) if self.schemas_dir.exists() else 0,
                    "specification_count": len(list(self.generated_dir.glob("*.json"))) if self.generated_dir.exists() else 0
                }
            }

            return APIResponse(success=True, data=status)

        except Exception as e:
            logger.error(f"Failed to get system status: {e}")
            return APIResponse(success=False, error=str(e))

    # Private helper methods

    async def _generate_behavioral_spec(self, runtime_data: List[Dict[str, Any]],
                                       spec_name: str = None) -> BehavioralSpecification:
        """Generate a behavioral specification from runtime data"""
        # This would integrate with the behavior analyzer
        # For now, create a basic specification structure

        spec_name = spec_name or f"spec_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}"

        return BehavioralSpecification(
            name=spec_name,
            version="1.0.0",
            generated_at=datetime.utcnow().isoformat(),
            state_machine={
                "states": ["idle", "processing", "complete"],
                "transitions": [],
                "initial_state": "idle"
            },
            behavioral_patterns=[],
            session_analyses=[],
            compliance_rules=[],
            validation_criteria=[],
            performance_benchmarks={},
            documentation={
                "overview": "Generated behavioral specification",
                "usage": "Use this specification to validate Claude Code wrapper implementations"
            },
            metadata={
                "source": "runtime_data",
                "event_count": len(runtime_data),
                "generated_by": "SpecificationAPI"
            }
        )


# CLI interface for testing
if __name__ == "__main__":
    import asyncio

    async def main():
        api = SpecificationAPI()

        # Test basic functionality
        print("Testing Specification API...")

        # Get system status
        status = await api.get_system_status()
        print(f"System Status: {status.success}")
        if status.success:
            print(f"  Schemas: {status.data['statistics']['schema_count']}")
            print(f"  Specifications: {status.data['statistics']['specification_count']}")

        # List specifications
        specs = await api.list_specifications()
        print(f"List Specifications: {specs.success}")
        if specs.success:
            print(f"  Found {specs.data['count']} specifications")

        # List schemas
        schemas = await api.list_schemas()
        print(f"List Schemas: {schemas.success}")
        if schemas.success:
            print(f"  Found {schemas.data['count']} schemas")

    asyncio.run(main())