#!/usr/bin/env python3
"""
Unified API - Combined REST API for Claude Code Specification System

This module provides a single unified API that combines specification management,
runtime monitoring, and validation services into one cohesive interface.

Requirements satisfied: 4.1, 4.2, 4.3, 4.4 - Complete unified programmatic access
"""

import asyncio
import logging
from datetime import datetime
from typing import Dict, List, Any, Optional, Union
from dataclasses import dataclass, asdict

from .specification_api import SpecificationAPI, APIResponse
from .monitoring_api import MonitoringAPI, MonitoringAPIResponse
from .validation_api import ValidationAPI, ValidationAPIResponse

logger = logging.getLogger(__name__)


@dataclass
class UnifiedAPIResponse:
    """Unified API response format"""
    success: bool
    service: str  # Which service handled the request
    data: Optional[Any] = None
    error: Optional[str] = None
    timestamp: str = None
    metadata: Optional[Dict[str, Any]] = None

    def __post_init__(self):
        if self.timestamp is None:
            self.timestamp = datetime.utcnow().isoformat()

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


class UnifiedAPI:
    """
    Unified API that provides a single interface to all specification system components.
    Combines specification management, runtime monitoring, and validation services.
    """

    def __init__(self, base_dir: str = "claudeCodeSpecs"):
        self.base_dir = base_dir

        # Initialize all component APIs
        self.specification_api = SpecificationAPI(base_dir)
        self.monitoring_api = MonitoringAPI(f"{base_dir}/runtime-data")
        self.validation_api = ValidationAPI(f"{base_dir}/schemas", f"{base_dir}/validation")

        logger.info("Unified API initialized with all components")

    # System-wide endpoints

    async def get_system_health(self) -> UnifiedAPIResponse:
        """Get overall system health status"""
        try:
            # Get status from all components
            spec_status = await self.specification_api.get_system_status()
            monitoring_status = await self.monitoring_api.get_monitoring_status()
            validation_status = await self.validation_api.get_validation_system_status()

            health_data = {
                "overall_status": "healthy",
                "timestamp": datetime.utcnow().isoformat(),
                "components": {
                    "specification_api": {
                        "status": "healthy" if spec_status.success else "unhealthy",
                        "data": spec_status.data if spec_status.success else None,
                        "error": spec_status.error if not spec_status.success else None
                    },
                    "monitoring_api": {
                        "status": "healthy" if monitoring_status.success else "unhealthy",
                        "data": monitoring_status.data if monitoring_status.success else None,
                        "error": monitoring_status.error if not monitoring_status.success else None
                    },
                    "validation_api": {
                        "status": "healthy" if validation_status.success else "unhealthy",
                        "data": validation_status.data if validation_status.success else None,
                        "error": validation_status.error if not validation_status.success else None
                    }
                }
            }

            # Determine overall health
            unhealthy_components = [
                name for name, comp in health_data["components"].items()
                if comp["status"] == "unhealthy"
            ]

            if unhealthy_components:
                health_data["overall_status"] = "degraded"
                health_data["unhealthy_components"] = unhealthy_components

            return UnifiedAPIResponse(
                success=True,
                service="unified",
                data=health_data
            )

        except Exception as e:
            logger.error(f"Failed to get system health: {e}")
            return UnifiedAPIResponse(
                success=False,
                service="unified",
                error=str(e)
            )

    async def get_system_overview(self) -> UnifiedAPIResponse:
        """Get comprehensive system overview"""
        try:
            # Gather data from all components
            specs = await self.specification_api.list_specifications()
            sessions = await self.monitoring_api.list_active_sessions()
            schemas = await self.validation_api.get_validation_schemas()
            val_stats = await self.validation_api.get_validation_statistics()

            overview = {
                "system": "Claude Code Specification System",
                "version": "1.0.0",
                "timestamp": datetime.utcnow().isoformat(),
                "specifications": {
                    "count": specs.data["count"] if specs.success else 0,
                    "available": specs.success
                },
                "monitoring": {
                    "active_sessions": sessions.data["count"] if sessions.success else 0,
                    "available": sessions.success
                },
                "validation": {
                    "schema_count": schemas.data["count"] if schemas.success else 0,
                    "recent_validations": val_stats.data["total_validations"] if val_stats.success else 0,
                    "available": schemas.success
                },
                "capabilities": [
                    "Specification lifecycle management",
                    "Runtime behavior monitoring",
                    "Schema validation and compliance testing",
                    "Automated behavioral analysis",
                    "Protocol specification generation"
                ]
            }

            return UnifiedAPIResponse(
                success=True,
                service="unified",
                data=overview
            )

        except Exception as e:
            logger.error(f"Failed to get system overview: {e}")
            return UnifiedAPIResponse(
                success=False,
                service="unified",
                error=str(e)
            )

    # Specification Management (delegated to SpecificationAPI)

    async def list_specifications(self) -> UnifiedAPIResponse:
        """List all specifications"""
        result = await self.specification_api.list_specifications()
        return self._convert_response(result, "specification")

    async def get_specification(self, spec_name: str) -> UnifiedAPIResponse:
        """Get a specific specification"""
        result = await self.specification_api.get_specification(spec_name)
        return self._convert_response(result, "specification")

    async def create_specification(self, spec_name: str, spec_data: Dict[str, Any]) -> UnifiedAPIResponse:
        """Create a new specification"""
        result = await self.specification_api.create_specification(spec_name, spec_data)
        return self._convert_response(result, "specification")

    async def update_specification(self, spec_name: str, spec_data: Dict[str, Any]) -> UnifiedAPIResponse:
        """Update an existing specification"""
        result = await self.specification_api.update_specification(spec_name, spec_data)
        return self._convert_response(result, "specification")

    async def delete_specification(self, spec_name: str) -> UnifiedAPIResponse:
        """Delete a specification"""
        result = await self.specification_api.delete_specification(spec_name)
        return self._convert_response(result, "specification")

    # Runtime Monitoring (delegated to MonitoringAPI)

    async def start_monitoring_session(self, config: Dict[str, Any] = None) -> UnifiedAPIResponse:
        """Start a monitoring session"""
        result = await self.monitoring_api.start_monitoring_session(config)
        return self._convert_monitoring_response(result, "monitoring")

    async def stop_monitoring_session(self, session_id: str) -> UnifiedAPIResponse:
        """Stop a monitoring session"""
        result = await self.monitoring_api.stop_monitoring_session(session_id)
        return self._convert_monitoring_response(result, "monitoring")

    async def list_active_sessions(self) -> UnifiedAPIResponse:
        """List active monitoring sessions"""
        result = await self.monitoring_api.list_active_sessions()
        return self._convert_monitoring_response(result, "monitoring")

    async def capture_event(self, event_data: Dict[str, Any], session_id: str = None) -> UnifiedAPIResponse:
        """Capture an event"""
        result = await self.monitoring_api.capture_event(event_data, session_id)
        return self._convert_monitoring_response(result, "monitoring")

    async def get_events(self, session_id: str = None, event_type: str = None,
                        limit: int = 100, offset: int = 0) -> UnifiedAPIResponse:
        """Get captured events"""
        result = await self.monitoring_api.get_events(session_id, event_type, limit, offset)
        return self._convert_monitoring_response(result, "monitoring")

    # Validation Services (delegated to ValidationAPI)

    async def validate_data(self, data: Dict[str, Any], schema_type: str) -> UnifiedAPIResponse:
        """Validate data against schema"""
        result = await self.validation_api.validate_data(data, schema_type)
        return self._convert_validation_response(result, "validation")

    async def validate_batch(self, batch_data: List[Dict[str, Any]]) -> UnifiedAPIResponse:
        """Validate multiple data items"""
        result = await self.validation_api.validate_batch(batch_data)
        return self._convert_validation_response(result, "validation")

    async def check_compliance(self, wrapper_implementation: Dict[str, Any],
                              specification: Dict[str, Any]) -> UnifiedAPIResponse:
        """Check compliance against specification"""
        result = await self.validation_api.check_compliance(wrapper_implementation, specification)
        return self._convert_validation_response(result, "validation")

    async def run_validation_tests(self, test_suite: str = "default") -> UnifiedAPIResponse:
        """Run validation test suite"""
        result = await self.validation_api.run_validation_tests(test_suite)
        return self._convert_validation_response(result, "validation")

    # Integrated Workflows

    async def full_specification_workflow(self, runtime_data: List[Dict[str, Any]],
                                        spec_name: str) -> UnifiedAPIResponse:
        """Execute complete specification generation workflow"""
        try:
            workflow_results = {}

            # Step 1: Start monitoring session
            session_result = await self.monitoring_api.start_monitoring_session({
                "type": "specification_generation",
                "spec_name": spec_name
            })

            if not session_result.success:
                return UnifiedAPIResponse(
                    success=False,
                    service="unified_workflow",
                    error=f"Failed to start monitoring session: {session_result.error}"
                )

            session_id = session_result.data["session_id"]
            workflow_results["monitoring_session"] = session_id

            # Step 2: Capture runtime events
            for event_data in runtime_data:
                await self.monitoring_api.capture_event(event_data, session_id)

            workflow_results["captured_events"] = len(runtime_data)

            # Step 3: Generate specification from runtime data
            spec_result = await self.specification_api.generate_specification_from_data(
                runtime_data, spec_name
            )

            if not spec_result.success:
                return UnifiedAPIResponse(
                    success=False,
                    service="unified_workflow",
                    error=f"Failed to generate specification: {spec_result.error}"
                )

            workflow_results["specification"] = spec_result.data

            # Step 4: Validate generated specification
            spec_data = spec_result.data["specification"]
            validation_result = await self.validation_api.validate_data(spec_data, "states")

            workflow_results["validation"] = {
                "is_valid": validation_result.data["is_valid"] if validation_result.success else False,
                "errors": validation_result.data["errors"] if validation_result.success else []
            }

            # Step 5: Stop monitoring session
            await self.monitoring_api.stop_monitoring_session(session_id)

            return UnifiedAPIResponse(
                success=True,
                service="unified_workflow",
                data={
                    "workflow": "full_specification_generation",
                    "spec_name": spec_name,
                    "results": workflow_results,
                    "completed_at": datetime.utcnow().isoformat()
                },
                metadata={
                    "steps_completed": 5,
                    "validation_passed": workflow_results["validation"]["is_valid"]
                }
            )

        except Exception as e:
            logger.error(f"Failed to execute full specification workflow: {e}")
            return UnifiedAPIResponse(
                success=False,
                service="unified_workflow",
                error=str(e)
            )

    async def validate_and_monitor_wrapper(self, wrapper_implementation: Dict[str, Any],
                                         specification: Dict[str, Any]) -> UnifiedAPIResponse:
        """Validate wrapper implementation and start monitoring"""
        try:
            workflow_results = {}

            # Step 1: Validate wrapper against specification
            compliance_result = await self.validation_api.check_compliance(
                wrapper_implementation, specification
            )

            workflow_results["compliance"] = {
                "is_compliant": compliance_result.data["is_compliant"] if compliance_result.success else False,
                "violations": compliance_result.data["violations"] if compliance_result.success else []
            }

            # Step 2: Run validation tests
            test_result = await self.validation_api.run_validation_tests()
            workflow_results["tests"] = {
                "passed": test_result.data["passed"] if test_result.success else False,
                "test_count": test_result.data["total_tests"] if test_result.success else 0
            }

            # Step 3: Start monitoring session for wrapper
            session_result = await self.monitoring_api.start_monitoring_session({
                "type": "wrapper_monitoring",
                "wrapper_name": wrapper_implementation.get("name", "unknown"),
                "specification": specification.get("name", "unknown")
            })

            if session_result.success:
                workflow_results["monitoring_session"] = session_result.data["session_id"]

            return UnifiedAPIResponse(
                success=True,
                service="unified_workflow",
                data={
                    "workflow": "validate_and_monitor_wrapper",
                    "results": workflow_results,
                    "overall_status": "compliant" if workflow_results["compliance"]["is_compliant"] else "non_compliant"
                }
            )

        except Exception as e:
            logger.error(f"Failed to validate and monitor wrapper: {e}")
            return UnifiedAPIResponse(
                success=False,
                service="unified_workflow",
                error=str(e)
            )

    # Helper methods

    def _convert_response(self, api_response: APIResponse, service: str) -> UnifiedAPIResponse:
        """Convert APIResponse to UnifiedAPIResponse"""
        return UnifiedAPIResponse(
            success=api_response.success,
            service=service,
            data=api_response.data,
            error=api_response.error,
            timestamp=api_response.timestamp
        )

    def _convert_monitoring_response(self, api_response: MonitoringAPIResponse, service: str) -> UnifiedAPIResponse:
        """Convert MonitoringAPIResponse to UnifiedAPIResponse"""
        return UnifiedAPIResponse(
            success=api_response.success,
            service=service,
            data=api_response.data,
            error=api_response.error,
            timestamp=api_response.timestamp,
            metadata={"session_id": api_response.session_id} if api_response.session_id else None
        )

    def _convert_validation_response(self, api_response: ValidationAPIResponse, service: str) -> UnifiedAPIResponse:
        """Convert ValidationAPIResponse to UnifiedAPIResponse"""
        return UnifiedAPIResponse(
            success=api_response.success,
            service=service,
            data=api_response.data,
            error=api_response.error,
            timestamp=api_response.timestamp,
            metadata={"validation_id": api_response.validation_id} if api_response.validation_id else None
        )


# CLI interface for testing
if __name__ == "__main__":
    import asyncio

    async def main():
        api = UnifiedAPI()

        print("Testing Unified API...")

        # Get system health
        health = await api.get_system_health()
        print(f"System Health: {health.success}")
        if health.success:
            print(f"  Overall Status: {health.data['overall_status']}")
            print(f"  Components: {list(health.data['components'].keys())}")

        # Get system overview
        overview = await api.get_system_overview()
        print(f"System Overview: {overview.success}")
        if overview.success:
            print(f"  Specifications: {overview.data['specifications']['count']}")
            print(f"  Active Sessions: {overview.data['monitoring']['active_sessions']}")
            print(f"  Schema Count: {overview.data['validation']['schema_count']}")

        # Test integrated workflow
        sample_runtime_data = [
            {
                "event_type": "command_start",
                "payload": {"command": "test"},
                "timestamp": datetime.utcnow().isoformat()
            }
        ]

        workflow = await api.full_specification_workflow(sample_runtime_data, "test_spec")
        print(f"Workflow Test: {workflow.success}")
        if workflow.success:
            print(f"  Steps Completed: {workflow.metadata['steps_completed']}")

    asyncio.run(main())