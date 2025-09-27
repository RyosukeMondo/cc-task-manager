import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { ThemeProvider } from '@/lib/theme/context'
import { AuthProvider } from '@/lib/auth/context'
import { WebSocketProvider } from '@/lib/websocket/context'
import { ReactQueryProvider } from '@/lib/api/providers'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'CC Task Manager',
  description: 'Contract-driven task management system with real-time updates',
  viewport: 'width=device-width, initial-scale=1',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider>
          <ReactQueryProvider>
            <AuthProvider>
              <WebSocketProvider>
                {children}
              </WebSocketProvider>
            </AuthProvider>
          </ReactQueryProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}