import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { ThemeProvider } from '@/lib/theme/context'
import { AuthProvider } from '@/lib/auth/context'
import { WebSocketProvider } from '@/lib/websocket/context'
import { ReactQueryProvider } from '@/lib/api/providers'
import { PerformanceMonitor } from '@/lib/accessibility/components'
import { PWAProvider } from '@/lib/pwa'
import { SkipNavPatterns } from '@/components/ui/skip-nav'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'CC Task Manager',
  description: 'Contract-driven task management system with real-time updates',
  viewport: 'width=device-width, initial-scale=1',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'CC Tasks',
  },
  other: {
    'color-scheme': 'light dark',
    'mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-status-bar-style': 'default',
    'apple-mobile-web-app-title': 'CC Tasks',
    'application-name': 'CC Task Manager',
    'msapplication-TileColor': '#3b82f6',
    'msapplication-config': '/browserconfig.xml',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#000000" media="(prefers-color-scheme: dark)" />
      </head>
      <body className={inter.className}>
        <SkipNavPatterns.Complete />
        <PWAProvider>
          <ThemeProvider>
            <ReactQueryProvider>
              <AuthProvider>
                <WebSocketProvider>
                  <PerformanceMonitor>
                    {children}
                  </PerformanceMonitor>
                </WebSocketProvider>
              </AuthProvider>
            </ReactQueryProvider>
          </ThemeProvider>
        </PWAProvider>
      </body>
    </html>
  )
}