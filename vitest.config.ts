import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    exclude: ['tests/e2e/**', 'node_modules/**'],
    hookTimeout: 30000, // integration tests create DB fixtures; 10s is too short
    testTimeout: 20000,
    env: {
      // Required so session.ts module-level guard doesn't throw during tests
      BETTER_AUTH_SECRET: 'test-secret-for-vitest-must-be-32-chars-min',
      // Required so `new Resend(...)` in email.ts doesn't throw at import
      // time for any test that transitively imports a worker module
      RESEND_API_KEY: 're_test_key_for_vitest',
      NODE_ENV: 'test',
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
