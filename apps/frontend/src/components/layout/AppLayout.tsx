'use client';

import React, { useState, useEffect } from 'react';
import { Navigation } from './Navigation';
import { Sidebar } from './Sidebar';
import { cn } from '@/lib/utils';

interface AppLayoutProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Main application layout component
 * Combines Navigation and Sidebar with responsive behavior
 * Manages mobile menu and sidebar collapse states
 */
export function AppLayout({ children, className }: AppLayoutProps) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Handle responsive behavior
  useEffect(() => {
    const checkIsMobile = () => {
      const mobile = window.innerWidth < 768; // md breakpoint
      setIsMobile(mobile);

      // Auto-close mobile menu when switching to desktop
      if (!mobile && isMobileMenuOpen) {
        setIsMobileMenuOpen(false);
      }
    };

    // Check on mount
    checkIsMobile();

    // Listen for resize events
    window.addEventListener('resize', checkIsMobile);
    return () => window.removeEventListener('resize', checkIsMobile);
  }, [isMobileMenuOpen]);

  // Close mobile menu when clicking outside or on links
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isMobileMenuOpen) {
        setIsMobileMenuOpen(false);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isMobileMenuOpen]);

  const handleSidebarCollapse = (collapsed: boolean) => {
    setIsSidebarCollapsed(collapsed);
  };

  const handleMobileMenuToggle = (isOpen: boolean) => {
    setIsMobileMenuOpen(isOpen);
  };

  const handleMobileSidebarClose = () => {
    setIsMobileMenuOpen(false);
  };

  return (
    <div className={cn("min-h-screen bg-background", className)}>
      {/* Skip to main content link for accessibility */}
      <a
        href="#main-content"
        className="skip-link focus:top-6"
      >
        Skip to main content
      </a>

      {/* Top Navigation */}
      <Navigation
        onMobileMenuToggle={handleMobileMenuToggle}
        isMobileMenuOpen={isMobileMenuOpen}
      />

      <div className="flex h-[calc(100vh-4rem)]"> {/* Subtract nav height */}
        {/* Desktop Sidebar */}
        {!isMobile && (
          <aside
            className="hidden md:flex"
            aria-label="Main navigation sidebar"
          >
            <Sidebar
              isCollapsed={isSidebarCollapsed}
              onCollapse={handleSidebarCollapse}
            />
          </aside>
        )}

        {/* Mobile Sidebar */}
        {isMobile && (
          <Sidebar
            isMobile={true}
            isOpen={isMobileMenuOpen}
            onClose={handleMobileSidebarClose}
          />
        )}

        {/* Main Content Area */}
        <main
          id="main-content"
          className={cn(
            "flex-1 overflow-auto",
            "focus:outline-none", // For skip link target
            // Add left padding on mobile when sidebar is open to prevent content shifting
            isMobile && isMobileMenuOpen ? "pointer-events-none" : ""
          )}
          tabIndex={-1}
        >
          <div className="container mx-auto p-4 sm:p-6 lg:p-8">
            {children}
          </div>
        </main>
      </div>

      {/* Screen reader announcement for mobile menu state */}
      <div
        role="status"
        aria-live="polite"
        className="sr-only"
      >
        {isMobileMenuOpen ? "Mobile menu opened" : ""}
      </div>
    </div>
  );
}

export default AppLayout;