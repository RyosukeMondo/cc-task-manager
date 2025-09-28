#!/usr/bin/env python3
"""
SDK Monitor - Automated web research for Claude Code SDK updates

This module implements automated web research capabilities for monitoring
Claude Code SDK updates, leveraging WebSearch capabilities and handling
rate limits and API failures gracefully.
"""

import asyncio
import json
import logging
import time
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, asdict
from pathlib import Path
import hashlib
import aiohttp
from urllib.parse import urljoin, urlparse

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@dataclass
class SDKUpdate:
    """Represents an SDK update discovery"""
    source: str
    title: str
    url: str
    version: Optional[str]
    description: str
    timestamp: datetime
    content_hash: str
    relevance_score: float
    metadata: Dict[str, Any]

@dataclass
class ResearchConfig:
    """Configuration for SDK monitoring"""
    search_keywords: List[str]
    sources: List[str]
    rate_limit_delay: float
    max_retries: int
    cache_duration_hours: int
    relevance_threshold: float

class SDKMonitor:
    """
    Automated web research system for Claude Code SDK updates

    Features:
    - Rate-limited web searching with retry logic
    - Content deduplication using content hashing
    - Relevance scoring for search results
    - Caching to minimize redundant requests
    - Error handling for API failures
    """

    def __init__(self, config: ResearchConfig):
        self.config = config
        self.cache_file = Path("claudeCodeSpecs/research/sdk_cache.json")
        self.results_file = Path("claudeCodeSpecs/research/sdk_updates.json")
        self.session: Optional[aiohttp.ClientSession] = None
        self._last_request_time = 0.0

    async def __aenter__(self):
        self.session = aiohttp.ClientSession(
            timeout=aiohttp.ClientTimeout(total=30),
            headers={'User-Agent': 'Claude Code Specs Research Bot 1.0'}
        )
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()

    def _enforce_rate_limit(self):
        """Enforce rate limiting between requests"""
        current_time = time.time()
        time_since_last = current_time - self._last_request_time

        if time_since_last < self.config.rate_limit_delay:
            sleep_time = self.config.rate_limit_delay - time_since_last
            logger.debug(f"Rate limiting: sleeping for {sleep_time:.2f}s")
            time.sleep(sleep_time)

        self._last_request_time = time.time()

    def _calculate_relevance_score(self, result: Dict[str, Any]) -> float:
        """Calculate relevance score for search result"""
        score = 0.0
        title = result.get('title', '').lower()
        description = result.get('description', '').lower()
        url = result.get('url', '').lower()

        # Keyword matching in title (highest weight)
        for keyword in self.config.search_keywords:
            if keyword.lower() in title:
                score += 2.0
            if keyword.lower() in description:
                score += 1.0
            if keyword.lower() in url:
                score += 0.5

        # Official sources get higher scores
        official_domains = ['anthropic.com', 'github.com/anthropics', 'docs.claude.com']
        for domain in official_domains:
            if domain in url:
                score += 1.5
                break

        # Recent content indicators
        recent_indicators = ['2024', '2025', 'latest', 'new', 'update']
        for indicator in recent_indicators:
            if indicator in title or indicator in description:
                score += 0.3

        return min(score, 10.0)  # Cap at 10.0

    def _generate_content_hash(self, content: str) -> str:
        """Generate hash for content deduplication"""
        return hashlib.sha256(content.encode('utf-8')).hexdigest()[:16]

    def _load_cache(self) -> Dict[str, Any]:
        """Load cached results"""
        if not self.cache_file.exists():
            return {}

        try:
            with open(self.cache_file, 'r') as f:
                cache = json.load(f)

            # Filter out expired entries
            cutoff_time = datetime.now() - timedelta(hours=self.config.cache_duration_hours)
            valid_cache = {}

            for key, entry in cache.items():
                entry_time = datetime.fromisoformat(entry['timestamp'])
                if entry_time > cutoff_time:
                    valid_cache[key] = entry

            return valid_cache
        except Exception as e:
            logger.error(f"Error loading cache: {e}")
            return {}

    def _save_cache(self, cache: Dict[str, Any]):
        """Save cache to disk"""
        try:
            self.cache_file.parent.mkdir(parents=True, exist_ok=True)
            with open(self.cache_file, 'w') as f:
                json.dump(cache, f, indent=2, default=str)
        except Exception as e:
            logger.error(f"Error saving cache: {e}")

    async def _search_with_retry(self, query: str) -> List[Dict[str, Any]]:
        """
        Perform web search with retry logic

        Note: This is a mock implementation since we don't have direct access
        to WebSearch in this context. In practice, this would integrate with
        the actual WebSearch tool or API.
        """
        results = []

        for attempt in range(self.config.max_retries):
            try:
                self._enforce_rate_limit()

                # Mock search results for demonstration
                # In practice, this would call the actual WebSearch API
                mock_results = [
                    {
                        'title': f'Claude Code SDK {query} Documentation',
                        'url': f'https://docs.claude.com/claude-code/{query.replace(" ", "-")}',
                        'description': f'Official documentation for {query} in Claude Code SDK',
                        'timestamp': datetime.now().isoformat()
                    },
                    {
                        'title': f'Claude Code {query} GitHub Repository',
                        'url': f'https://github.com/anthropics/claude-code/{query.replace(" ", "-")}',
                        'description': f'Source code and examples for {query}',
                        'timestamp': datetime.now().isoformat()
                    }
                ]

                logger.info(f"Search completed for query: {query}")
                return mock_results

            except Exception as e:
                logger.warning(f"Search attempt {attempt + 1} failed for query '{query}': {e}")
                if attempt < self.config.max_retries - 1:
                    await asyncio.sleep(2 ** attempt)  # Exponential backoff
                else:
                    logger.error(f"All search attempts failed for query: {query}")

        return results

    async def research_sdk_updates(self) -> List[SDKUpdate]:
        """
        Research Claude Code SDK updates across multiple sources

        Returns:
            List of discovered SDK updates with relevance scoring
        """
        cache = self._load_cache()
        all_updates = []

        logger.info("Starting SDK update research")

        for keyword in self.config.search_keywords:
            logger.info(f"Researching keyword: {keyword}")

            # Check cache first
            cache_key = f"search_{keyword}"
            if cache_key in cache:
                logger.info(f"Using cached results for: {keyword}")
                cached_results = cache[cache_key]['results']
            else:
                # Perform new search
                search_results = await self._search_with_retry(keyword)
                cached_results = search_results

                # Update cache
                cache[cache_key] = {
                    'timestamp': datetime.now().isoformat(),
                    'results': search_results
                }

            # Process results
            for result in cached_results:
                relevance_score = self._calculate_relevance_score(result)

                if relevance_score >= self.config.relevance_threshold:
                    content = f"{result.get('title', '')} {result.get('description', '')}"
                    content_hash = self._generate_content_hash(content)

                    update = SDKUpdate(
                        source=keyword,
                        title=result.get('title', ''),
                        url=result.get('url', ''),
                        version=self._extract_version(result.get('title', '')),
                        description=result.get('description', ''),
                        timestamp=datetime.now(),
                        content_hash=content_hash,
                        relevance_score=relevance_score,
                        metadata=result
                    )

                    all_updates.append(update)

        # Save updated cache
        self._save_cache(cache)

        # Deduplicate by content hash
        seen_hashes = set()
        unique_updates = []

        for update in all_updates:
            if update.content_hash not in seen_hashes:
                seen_hashes.add(update.content_hash)
                unique_updates.append(update)

        # Sort by relevance score
        unique_updates.sort(key=lambda x: x.relevance_score, reverse=True)

        logger.info(f"Found {len(unique_updates)} unique SDK updates")
        return unique_updates

    def _extract_version(self, text: str) -> Optional[str]:
        """Extract version information from text"""
        import re

        # Look for version patterns like v1.2.3, 1.2.3, etc.
        version_patterns = [
            r'v?(\d+\.\d+\.\d+)',
            r'version\s+(\d+\.\d+\.\d+)',
            r'release\s+(\d+\.\d+\.\d+)'
        ]

        for pattern in version_patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                return match.group(1)

        return None

    def save_updates(self, updates: List[SDKUpdate]):
        """Save SDK updates to file"""
        try:
            self.results_file.parent.mkdir(parents=True, exist_ok=True)

            # Convert to serializable format
            updates_data = {
                'timestamp': datetime.now().isoformat(),
                'total_updates': len(updates),
                'updates': [asdict(update) for update in updates]
            }

            with open(self.results_file, 'w') as f:
                json.dump(updates_data, f, indent=2, default=str)

            logger.info(f"Saved {len(updates)} SDK updates to {self.results_file}")

        except Exception as e:
            logger.error(f"Error saving updates: {e}")

    def load_updates(self) -> List[SDKUpdate]:
        """Load SDK updates from file"""
        if not self.results_file.exists():
            return []

        try:
            with open(self.results_file, 'r') as f:
                data = json.load(f)

            updates = []
            for update_dict in data.get('updates', []):
                # Convert timestamp back to datetime
                update_dict['timestamp'] = datetime.fromisoformat(update_dict['timestamp'])
                updates.append(SDKUpdate(**update_dict))

            return updates

        except Exception as e:
            logger.error(f"Error loading updates: {e}")
            return []


# Default configuration
DEFAULT_CONFIG = ResearchConfig(
    search_keywords=[
        "Claude Code SDK",
        "Claude Code API",
        "Anthropic Claude Code",
        "Claude Code updates",
        "Claude Code release",
        "Claude Code changelog",
        "Claude Code documentation"
    ],
    sources=[
        "docs.claude.com",
        "github.com/anthropics",
        "anthropic.com"
    ],
    rate_limit_delay=1.0,  # 1 second between requests
    max_retries=3,
    cache_duration_hours=24,
    relevance_threshold=1.0
)


async def main():
    """Example usage of SDK Monitor"""
    config = DEFAULT_CONFIG

    async with SDKMonitor(config) as monitor:
        # Research SDK updates
        updates = await monitor.research_sdk_updates()

        # Save results
        monitor.save_updates(updates)

        # Display summary
        print(f"\nSDK Research Summary:")
        print(f"Total updates found: {len(updates)}")

        if updates:
            print(f"\nTop 5 most relevant updates:")
            for i, update in enumerate(updates[:5], 1):
                print(f"{i}. {update.title} (Score: {update.relevance_score:.2f})")
                print(f"   URL: {update.url}")
                print(f"   Version: {update.version or 'N/A'}")
                print()


if __name__ == "__main__":
    asyncio.run(main())