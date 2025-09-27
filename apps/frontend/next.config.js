/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Enable experimental features as needed
  },
  transpilePackages: ['@cc-task-manager/schemas', '@cc-task-manager/types'],
  webpack: (config, { isServer }) => {
    // Handle contract dependencies
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
      };
    }

    // Optimize bundle for contract types
    config.resolve.alias = {
      ...config.resolve.alias,
      '@contracts': path.resolve(__dirname, '../../src/contracts'),
    };

    return config;
  },
  env: {
    // Contract foundation integration
    CONTRACT_REGISTRY_ENABLED: 'true',
    TYPESCRIPT_GENERATOR_ENABLED: 'true',
  },
};

const path = require('path');

module.exports = nextConfig;