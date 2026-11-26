import { defineConfig } from 'tsdown';

export default defineConfig([
  // CLI build
  {
    entry: ['bin/cli.ts'],
    format: ['esm'],
    platform: 'node',
    outDir: 'dist',
    clean: true,
    dts: true,
    fixedExtension: false,
    banner: '#!/usr/bin/env node',
  },
  // Library build
  {
    entry: ['src/index.ts'],
    format: ['esm', 'cjs'],
    platform: 'node',
    outDir: 'dist',
    clean: false,
    dts: true,
    fixedExtension: false,
  },
]);
