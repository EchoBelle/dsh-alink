import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { include: ['tests-ts/unit/**/*.test.ts'], testTimeout: 15000 } });
