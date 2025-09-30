import '@testing-library/jest-dom'
import 'jest-canvas-mock'
import React from 'react'

// Set NODE_ENV to test to ensure React runs in development mode
process.env.NODE_ENV = 'test'

// Global test setup
global.ResizeObserver = global.ResizeObserver || class ResizeObserver {
  constructor(cb: any) {}
  observe() {}
  unobserve() {}
  disconnect() {}
}

// Mock Chart.js
jest.mock('chart.js', () => ({
  Chart: {
    register: jest.fn(),
  },
  CategoryScale: jest.fn(),
  LinearScale: jest.fn(),
  PointElement: jest.fn(),
  LineElement: jest.fn(),
  BarElement: jest.fn(),
  Title: jest.fn(),
  Tooltip: jest.fn(),
  Legend: jest.fn(),
}))

// Mock react-chartjs-2
jest.mock('react-chartjs-2', () => ({
  Line: ({ data, options }: any) => React.createElement('div', {
    'data-testid': 'line-chart',
    'data-chart-data': JSON.stringify(data)
  }),
  Bar: ({ data, options }: any) => React.createElement('div', {
    'data-testid': 'bar-chart',
    'data-chart-data': JSON.stringify(data)
  }),
  Doughnut: ({ data, options }: any) => React.createElement('div', {
    'data-testid': 'doughnut-chart',
    'data-chart-data': JSON.stringify(data)
  }),
}))

// Mock Next.js router
jest.mock('next/router', () => ({
  useRouter: () => ({
    route: '/',
    pathname: '/',
    query: {},
    asPath: '/',
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    prefetch: jest.fn(),
  }),
}))

// Mock Next.js navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}))

// Mock localStorage
Object.defineProperty(window, 'localStorage', {
  value: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn(),
  },
  writable: true,
})

// Mock sessionStorage
Object.defineProperty(window, 'sessionStorage', {
  value: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn(),
  },
  writable: true,
})

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
})

// Silence console warnings in tests
const originalError = console.error
beforeAll(() => {
  console.error = (...args) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes('Warning: ReactDOM.render is no longer supported')
    ) {
      return
    }
    originalError.call(console, ...args)
  }
})

afterAll(() => {
  console.error = originalError
})

// Mock lucide-react icons
jest.mock('lucide-react', () => ({
  ArrowUpDown: (props: any) => React.createElement('div', { 'data-testid': 'arrow-up-down', ...props }),
  ArrowUp: (props: any) => React.createElement('div', { 'data-testid': 'arrow-up', ...props }),
  ArrowDown: (props: any) => React.createElement('div', { 'data-testid': 'arrow-down', ...props }),
}))