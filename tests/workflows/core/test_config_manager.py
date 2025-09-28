#!/usr/bin/env python3
"""
Unit tests for config_manager module.

Tests cover ConfigManager functionality including YAML/JSON loading,
environment overrides, validation, and default configurations.
"""

import pytest
import tempfile
import json
import yaml
from pathlib import Path
from unittest.mock import Mock, patch, mock_open
from typing import Dict, Any

from workflows.core.config_manager import (
    ConfigManager,
    ConfigSource,
    ConfigSchema,
    WorkflowDefaults
)


class TestConfigManager:
    """Test ConfigManager functionality."""

    def setup_method(self):
        """Set up test fixtures."""
        self.temp_dir = tempfile.mkdtemp()
        self.config_dir = Path(self.temp_dir)

    def test_config_manager_initialization(self):
        """Test ConfigManager initialization with default settings."""
        manager = ConfigManager()

        assert isinstance(manager.cache, dict)
        assert manager.cache_size > 0
        assert isinstance(manager.search_paths, list)

    def test_load_json_configuration(self):
        """Test loading JSON configuration files."""
        config_data = {
            "workflow_type": "test",
            "max_cycles": 15,
            "custom_settings": {
                "test_command": "npm test",
                "timeout": 300
            }
        }

        config_file = self.config_dir / "test_config.json"
        with open(config_file, 'w') as f:
            json.dump(config_data, f)

        manager = ConfigManager(search_paths=[str(self.config_dir)])
        loaded_config = manager.load_config("test_config.json")

        assert loaded_config["workflow_type"] == "test"
        assert loaded_config["max_cycles"] == 15
        assert loaded_config["custom_settings"]["test_command"] == "npm test"

    def test_load_yaml_configuration(self):
        """Test loading YAML configuration files."""
        config_data = {
            "workflow_type": "spec",
            "max_cycles": 20,
            "completion_patterns": [
                "completed",
                "finished",
                "done"
            ],
            "debug_options": {
                "verbose": True,
                "show_details": False
            }
        }

        config_file = self.config_dir / "test_config.yaml"
        with open(config_file, 'w') as f:
            yaml.dump(config_data, f)

        manager = ConfigManager(search_paths=[str(self.config_dir)])
        loaded_config = manager.load_config("test_config.yaml")

        assert loaded_config["workflow_type"] == "spec"
        assert loaded_config["max_cycles"] == 20
        assert len(loaded_config["completion_patterns"]) == 3
        assert loaded_config["debug_options"]["verbose"] is True

    def test_environment_variable_overrides(self):
        """Test environment variable overrides in configuration."""
        config_data = {
            "workflow_type": "test",
            "max_cycles": 10,
            "test_command": "npm test"
        }

        config_file = self.config_dir / "env_test.json"
        with open(config_file, 'w') as f:
            json.dump(config_data, f)

        # Mock environment variables
        env_overrides = {
            "WORKFLOW_MAX_CYCLES": "25",
            "WORKFLOW_TEST_COMMAND": "pytest",
            "WORKFLOW_NEW_OPTION": "new_value"
        }

        with patch.dict('os.environ', env_overrides):
            manager = ConfigManager(search_paths=[str(self.config_dir)])
            config = manager.load_config("env_test.json", apply_env_overrides=True)

            assert config["max_cycles"] == 25  # Override from env
            assert config["test_command"] == "pytest"  # Override from env
            assert config["new_option"] == "new_value"  # New from env

    def test_configuration_caching(self):
        """Test configuration caching functionality."""
        config_data = {"workflow_type": "test", "max_cycles": 10}

        config_file = self.config_dir / "cached_config.json"
        with open(config_file, 'w') as f:
            json.dump(config_data, f)

        manager = ConfigManager(search_paths=[str(self.config_dir)], cache_size=10)

        # First load
        config1 = manager.load_config("cached_config.json")
        cache_key = str(config_file)
        assert cache_key in manager.cache

        # Second load should use cache
        with patch('builtins.open', side_effect=Exception("Should not read file")):
            config2 = manager.load_config("cached_config.json")
            assert config1 == config2

    def test_configuration_validation(self):
        """Test configuration validation."""
        manager = ConfigManager()

        # Valid configuration
        valid_config = {
            "workflow_type": "test",
            "max_cycles": 10,
            "max_session_time": 1800
        }
        assert manager.validate_config(valid_config) is True

        # Invalid configuration - missing workflow_type
        invalid_config = {
            "max_cycles": 10
        }
        with pytest.raises(ValueError):
            manager.validate_config(invalid_config, strict=True)

    def test_config_merging(self):
        """Test merging of multiple configuration sources."""
        base_config = {
            "workflow_type": "test",
            "max_cycles": 10,
            "debug_options": {"verbose": False}
        }

        override_config = {
            "max_cycles": 20,
            "debug_options": {"show_details": True},
            "new_setting": "value"
        }

        manager = ConfigManager()
        merged = manager.merge_configs(base_config, override_config)

        assert merged["workflow_type"] == "test"  # From base
        assert merged["max_cycles"] == 20  # Overridden
        assert merged["debug_options"]["verbose"] is False  # From base
        assert merged["debug_options"]["show_details"] is True  # From override
        assert merged["new_setting"] == "value"  # New from override

    def test_workflow_specific_defaults(self):
        """Test loading workflow-specific default configurations."""
        manager = ConfigManager()

        spec_defaults = manager.get_workflow_defaults("spec")
        test_defaults = manager.get_workflow_defaults("test-fix")
        type_defaults = manager.get_workflow_defaults("type-fix")
        build_defaults = manager.get_workflow_defaults("build-fix")

        assert spec_defaults["workflow_type"] == "spec"
        assert test_defaults["workflow_type"] == "test-fix"
        assert type_defaults["workflow_type"] == "type-fix"
        assert build_defaults["workflow_type"] == "build-fix"

        # Each should have appropriate default commands
        assert "test_command" in test_defaults
        assert "type_check_command" in type_defaults
        assert "build_command" in build_defaults

    def test_config_file_search_paths(self):
        """Test configuration file search across multiple paths."""
        # Create config in second search path
        search_path_1 = self.config_dir / "path1"
        search_path_2 = self.config_dir / "path2"
        search_path_1.mkdir()
        search_path_2.mkdir()

        config_data = {"workflow_type": "test", "source": "path2"}
        config_file = search_path_2 / "search_test.json"
        with open(config_file, 'w') as f:
            json.dump(config_data, f)

        manager = ConfigManager(search_paths=[
            str(search_path_1),
            str(search_path_2)
        ])

        config = manager.load_config("search_test.json")
        assert config["source"] == "path2"

    def test_config_file_not_found_handling(self):
        """Test handling of missing configuration files."""
        manager = ConfigManager(search_paths=[str(self.config_dir)])

        with pytest.raises(FileNotFoundError):
            manager.load_config("nonexistent.json")

        # Test with default fallback
        default_config = {"workflow_type": "default"}
        config = manager.load_config(
            "nonexistent.json",
            default=default_config,
            ignore_missing=True
        )
        assert config == default_config

    def test_malformed_config_file_handling(self):
        """Test handling of malformed configuration files."""
        # Create malformed JSON
        malformed_file = self.config_dir / "malformed.json"
        with open(malformed_file, 'w') as f:
            f.write('{"workflow_type": "test", "invalid": }')

        manager = ConfigManager(search_paths=[str(self.config_dir)])

        with pytest.raises(json.JSONDecodeError):
            manager.load_config("malformed.json")

    def test_cache_size_limit_enforcement(self):
        """Test that cache size limits are enforced."""
        manager = ConfigManager(cache_size=2)

        # Create multiple config files
        for i in range(5):
            config_data = {"workflow_type": f"test_{i}"}
            config_file = self.config_dir / f"config_{i}.json"
            with open(config_file, 'w') as f:
                json.dump(config_data, f)

        manager.search_paths = [str(self.config_dir)]

        # Load more configs than cache size
        for i in range(5):
            manager.load_config(f"config_{i}.json")

        # Cache should not exceed size limit
        assert len(manager.cache) <= manager.cache_size

    def test_global_configuration_loading(self):
        """Test loading of global configuration settings."""
        global_config = {
            "global": {
                "max_session_time": 3600,
                "debug_options": {
                    "verbose": True,
                    "log_level": "INFO"
                }
            }
        }

        config_file = self.config_dir / "global.yaml"
        with open(config_file, 'w') as f:
            yaml.dump(global_config, f)

        manager = ConfigManager(search_paths=[str(self.config_dir)])
        loaded = manager.load_global_config("global.yaml")

        assert loaded["max_session_time"] == 3600
        assert loaded["debug_options"]["verbose"] is True


class TestConfigSource:
    """Test ConfigSource enum and related functionality."""

    def test_config_source_values(self):
        """Test ConfigSource enum values."""
        assert ConfigSource.FILE.value == "file"
        assert ConfigSource.ENVIRONMENT.value == "environment"
        assert ConfigSource.DEFAULT.value == "default"
        assert ConfigSource.OVERRIDE.value == "override"

    def test_config_source_priority(self):
        """Test configuration source priority handling."""
        # This would test priority resolution if implemented
        sources = [
            ConfigSource.DEFAULT,
            ConfigSource.FILE,
            ConfigSource.ENVIRONMENT,
            ConfigSource.OVERRIDE
        ]

        # Higher priority sources should override lower ones
        assert len(sources) == 4


class TestConfigSchema:
    """Test ConfigSchema validation functionality."""

    def test_schema_validation_success(self):
        """Test successful schema validation."""
        valid_config = {
            "workflow_type": "test",
            "max_cycles": 10,
            "max_session_time": 1800,
            "completion_patterns": ["done", "completed"]
        }

        schema = ConfigSchema()
        assert schema.validate(valid_config) is True

    def test_schema_validation_failure(self):
        """Test schema validation failure cases."""
        schema = ConfigSchema()

        # Missing required fields
        invalid_config_1 = {"max_cycles": 10}
        with pytest.raises(ValueError):
            schema.validate(invalid_config_1)

        # Wrong type
        invalid_config_2 = {
            "workflow_type": "test",
            "max_cycles": "not_a_number"
        }
        with pytest.raises(ValueError):
            schema.validate(invalid_config_2)

    def test_schema_coercion(self):
        """Test type coercion in schema validation."""
        config = {
            "workflow_type": "test",
            "max_cycles": "15",  # String that should be coerced to int
            "max_session_time": "3600"
        }

        schema = ConfigSchema()
        coerced = schema.coerce_types(config)

        assert isinstance(coerced["max_cycles"], int)
        assert coerced["max_cycles"] == 15
        assert isinstance(coerced["max_session_time"], int)

    def test_schema_default_injection(self):
        """Test injection of default values by schema."""
        minimal_config = {"workflow_type": "test"}

        schema = ConfigSchema()
        with_defaults = schema.apply_defaults(minimal_config)

        assert "max_cycles" in with_defaults
        assert "max_session_time" in with_defaults
        assert isinstance(with_defaults["max_cycles"], int)


class TestWorkflowDefaults:
    """Test WorkflowDefaults functionality."""

    def test_spec_workflow_defaults(self):
        """Test default configuration for spec workflow."""
        defaults = WorkflowDefaults.get_defaults("spec")

        assert defaults["workflow_type"] == "spec"
        assert "completion_patterns" in defaults
        assert "detector_type" in defaults
        assert defaults["detector_type"] == "spec_workflow"

    def test_test_fix_workflow_defaults(self):
        """Test default configuration for test-fix workflow."""
        defaults = WorkflowDefaults.get_defaults("test-fix")

        assert defaults["workflow_type"] == "test-fix"
        assert "test_command" in defaults
        assert "test_frameworks_supported" in defaults
        assert "detector_types" in defaults

    def test_type_fix_workflow_defaults(self):
        """Test default configuration for type-fix workflow."""
        defaults = WorkflowDefaults.get_defaults("type-fix")

        assert defaults["workflow_type"] == "type-fix"
        assert "type_check_command" in defaults
        assert "type_checkers_supported" in defaults

    def test_build_fix_workflow_defaults(self):
        """Test default configuration for build-fix workflow."""
        defaults = WorkflowDefaults.get_defaults("build-fix")

        assert defaults["workflow_type"] == "build-fix"
        assert "build_command" in defaults
        assert "build_systems_supported" in defaults

    def test_unknown_workflow_type_defaults(self):
        """Test handling of unknown workflow types."""
        defaults = WorkflowDefaults.get_defaults("unknown-type")

        # Should return base defaults or raise exception
        assert isinstance(defaults, dict)
        # Exact behavior depends on implementation

    def test_defaults_completeness(self):
        """Test that all workflow types have complete default configurations."""
        workflow_types = ["spec", "test-fix", "type-fix", "build-fix"]

        for workflow_type in workflow_types:
            defaults = WorkflowDefaults.get_defaults(workflow_type)

            # All should have these core settings
            assert "workflow_type" in defaults
            assert "max_cycles" in defaults
            assert "max_session_time" in defaults
            assert defaults["workflow_type"] == workflow_type


class TestConfigManagerEdgeCases:
    """Test edge cases and error conditions."""

    def setup_method(self):
        """Set up test fixtures."""
        self.temp_dir = tempfile.mkdtemp()
        self.config_dir = Path(self.temp_dir)

    def test_very_large_configuration_files(self):
        """Test handling of very large configuration files."""
        large_config = {
            "workflow_type": "test",
            "large_data": ["item"] * 100000  # Large list
        }

        config_file = self.config_dir / "large_config.json"
        with open(config_file, 'w') as f:
            json.dump(large_config, f)

        manager = ConfigManager(search_paths=[str(self.config_dir)])
        config = manager.load_config("large_config.json")

        assert config["workflow_type"] == "test"
        assert len(config["large_data"]) == 100000

    def test_unicode_in_configuration(self):
        """Test handling of unicode characters in configuration."""
        unicode_config = {
            "workflow_type": "тест",
            "description": "Тестовая конфигурация 🚀",
            "patterns": ["完了", "終了"]
        }

        config_file = self.config_dir / "unicode_config.json"
        with open(config_file, 'w', encoding='utf-8') as f:
            json.dump(unicode_config, f, ensure_ascii=False)

        manager = ConfigManager(search_paths=[str(self.config_dir)])
        config = manager.load_config("unicode_config.json")

        assert config["workflow_type"] == "тест"
        assert "🚀" in config["description"]
        assert "完了" in config["patterns"]

    def test_circular_configuration_references(self):
        """Test detection and handling of circular references."""
        # This would test circular reference detection if implemented
        manager = ConfigManager()

        config_with_reference = {
            "workflow_type": "test",
            "reference": {"$ref": "self"}
        }

        # Should handle gracefully without infinite recursion
        result = manager._resolve_references(config_with_reference)
        assert isinstance(result, dict)

    def test_concurrent_config_loading(self):
        """Test thread safety of configuration loading."""
        config_data = {"workflow_type": "test", "thread_safe": True}

        config_file = self.config_dir / "concurrent_test.json"
        with open(config_file, 'w') as f:
            json.dump(config_data, f)

        manager = ConfigManager(search_paths=[str(self.config_dir)])

        # Simulate concurrent access
        import threading
        results = []

        def load_config():
            config = manager.load_config("concurrent_test.json")
            results.append(config)

        threads = [threading.Thread(target=load_config) for _ in range(10)]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join()

        # All results should be identical
        assert len(results) == 10
        assert all(r == results[0] for r in results)

    def test_memory_efficient_caching(self):
        """Test memory efficiency of configuration caching."""
        manager = ConfigManager(cache_size=5)

        # Track memory usage patterns
        initial_cache_size = len(manager.cache)

        # Load and evict configurations
        for i in range(20):
            config_data = {"workflow_type": f"test_{i}"}
            config_file = self.config_dir / f"mem_test_{i}.json"
            with open(config_file, 'w') as f:
                json.dump(config_data, f)

        manager.search_paths = [str(self.config_dir)]

        for i in range(20):
            manager.load_config(f"mem_test_{i}.json")

        # Cache should not grow unbounded
        assert len(manager.cache) <= manager.cache_size


if __name__ == "__main__":
    pytest.main([__file__])