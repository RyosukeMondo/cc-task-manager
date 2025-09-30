'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// Sidebar icons
const ChevronLeftIcon = () => (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
  </svg>
);

const ChevronRightIcon = () => (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
  </svg>
);

const DashboardIcon = () => (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M8 5a2 2 0 012-2h4a2 2 0 012 2v0a2 2 0 01-2 2H10a2 2 0 01-2-2v0z" />
  </svg>
);

const TaskIcon = () => (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const ListIcon = () => (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 17.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
  </svg>
);

const ChartIcon = () => (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
  </svg>
);

const SettingsIcon = () => (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

// Sidebar navigation structure
// TODO: Uncomment routes as pages are implemented
const sidebarSections = [
  {
    title: 'Main',
    items: [
      {
        href: '/dashboard',
        label: 'Dashboard',
        icon: DashboardIcon,
        description: 'Overview and statistics'
      }
    ]
  },
  {
    title: 'Tasks',
    items: [
      {
        href: '/tasks',
        label: 'All Tasks',
        icon: TaskIcon,
        description: 'View and manage all tasks'
      },
      {
        href: '/tasks/active',
        label: 'Active Tasks',
        icon: ListIcon,
        description: 'Currently running tasks'
      },
      {
        href: '/tasks/completed',
        label: 'Completed',
        icon: ListIcon,
        description: 'Finished tasks'
      }
    ]
  },
  // {
  //   title: 'Analytics',
  //   items: [
  //     {
  //       href: '/analytics/performance',
  //       label: 'Performance',
  //       icon: ChartIcon,
  //       description: 'Task performance metrics'
  //     },
  //     {
  //       href: '/analytics/trends',
  //       label: 'Trends',
  //       icon: ChartIcon,
  //       description: 'Task completion trends'
  //     }
  //   ]
  // },
  // {
  //   title: 'System',
  //   items: [
  //     {
  //       href: '/settings',
  //       label: 'Settings',
  //       icon: SettingsIcon,
  //       description: 'Application settings'
  //       }
  //   ]
  // }
];

interface SidebarProps {
  isCollapsed?: boolean;
  onCollapse?: (collapsed: boolean) => void;
  className?: string;
  isMobile?: boolean;
  isOpen?: boolean;
  onClose?: () => void;
}

/**
 * Sidebar navigation component with collapsible functionality
 * Supports both desktop sidebar and mobile overlay modes
 */
export function Sidebar({
  isCollapsed = false,
  onCollapse,
  className,
  isMobile = false,
  isOpen = true,
  onClose
}: SidebarProps) {
  const pathname = usePathname();

  const handleCollapseToggle = () => {
    onCollapse?.(!isCollapsed);
  };

  const handleItemClick = () => {
    if (isMobile) {
      onClose?.();
    }
  };

  // Mobile overlay sidebar
  if (isMobile) {
    return (
      <>
        {/* Backdrop */}
        {isOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/50 transition-opacity md:hidden"
            onClick={onClose}
            aria-hidden="true"
          />
        )}

        {/* Mobile sidebar */}
        <div
          className={cn(
            "fixed inset-y-0 left-0 z-50 w-64 transform bg-background border-r theme-border-subtle transition-transform duration-300 ease-in-out md:hidden",
            isOpen ? "translate-x-0" : "-translate-x-full",
            className
          )}
          role="dialog"
          aria-modal="true"
          aria-labelledby="mobile-sidebar-title"
        >
          <div className="flex h-full flex-col">
            {/* Mobile sidebar header */}
            <div className="flex h-16 items-center justify-between px-4 border-b theme-border-subtle">
              <h2 id="mobile-sidebar-title" className="text-lg font-semibold theme-text-primary">
                Navigation
              </h2>
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                aria-label="Close sidebar"
                className="btn-accessible"
              >
                <ChevronLeftIcon />
              </Button>
            </div>

            {/* Mobile sidebar content */}
            <nav className="flex-1 overflow-y-auto px-4 py-4" aria-label="Sidebar navigation">
              {sidebarSections.map((section) => (
                <div key={section.title} className="mb-6">
                  <h3 className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider theme-text-muted">
                    {section.title}
                  </h3>
                  <div className="space-y-1">
                    {section.items.map((item) => {
                      const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
                      const Icon = item.icon;

                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={handleItemClick}
                          className={cn(
                            "flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                            "hover:bg-accent hover:text-accent-foreground",
                            "btn-accessible",
                            isActive
                              ? "bg-accent text-accent-foreground"
                              : "text-muted-foreground hover:text-foreground"
                          )}
                          aria-current={isActive ? 'page' : undefined}
                          title={item.description}
                        >
                          <Icon />
                          <span className="ml-3">{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </nav>
          </div>
        </div>
      </>
    );
  }

  // Desktop sidebar
  return (
    <div
      className={cn(
        "flex h-full flex-col bg-background border-r theme-border-subtle transition-all duration-300",
        isCollapsed ? "w-16" : "w-64",
        className
      )}
      role="navigation"
      aria-label="Main navigation sidebar"
    >
      {/* Desktop sidebar header */}
      <div className="flex h-16 items-center justify-between px-4 border-b theme-border-subtle">
        {!isCollapsed && (
          <h2 className="text-lg font-semibold theme-text-primary">
            Navigation
          </h2>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={handleCollapseToggle}
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="btn-accessible"
          aria-expanded={!isCollapsed}
        >
          {isCollapsed ? <ChevronRightIcon /> : <ChevronLeftIcon />}
        </Button>
      </div>

      {/* Desktop sidebar content */}
      <nav className="flex-1 overflow-y-auto px-4 py-4" aria-label="Sidebar navigation">
        {sidebarSections.map((section) => (
          <div key={section.title} className="mb-6">
            {!isCollapsed && (
              <h3 className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider theme-text-muted">
                {section.title}
              </h3>
            )}
            <div className="space-y-1">
              {section.items.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
                const Icon = item.icon;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                      "hover:bg-accent hover:text-accent-foreground",
                      "btn-accessible",
                      isCollapsed ? "justify-center" : "",
                      isActive
                        ? "bg-accent text-accent-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                    aria-current={isActive ? 'page' : undefined}
                    title={isCollapsed ? `${item.label} - ${item.description}` : item.description}
                  >
                    <Icon />
                    {!isCollapsed && <span className="ml-3">{item.label}</span>}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </div>
  );
}

export default Sidebar;