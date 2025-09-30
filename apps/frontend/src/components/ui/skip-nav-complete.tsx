'use client';

/**
 * Complete Skip Navigation Component
 * Pre-configured skip navigation for typical application layout
 */

import { SkipNav, SkipNavContainer } from './skip-nav';

export function SkipNavComplete() {
  return (
    <SkipNavContainer>
      <SkipNav href="#main-content">Skip to main content</SkipNav>
      <SkipNav href="#navigation">Skip to navigation</SkipNav>
      <SkipNav href="#search">Skip to search</SkipNav>
      <SkipNav href="#footer">Skip to footer</SkipNav>
    </SkipNavContainer>
  );
}