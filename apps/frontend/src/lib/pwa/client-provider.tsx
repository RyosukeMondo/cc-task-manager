'use client';

import dynamic from 'next/dynamic';
import { ReactNode } from 'react';

// Dynamically import PWA provider with no SSR
const PWAProviderDynamic = dynamic(
  () => import('./pwa-provider').then((mod) => mod.PWAProvider),
  {
    ssr: false,
    loading: () => null,
  }
);

export function PWAClientProvider({ children }: { children: ReactNode }) {
  return <PWAProviderDynamic>{children}</PWAProviderDynamic>;
}