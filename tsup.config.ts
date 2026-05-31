import { defineConfig } from 'tsup';

export default defineConfig([
  // CLI build configuration
  {
    entry: ['bin/cli.ts'],
    format: ['esm'],
    outDir: 'dist',
    clean: true,
    splitting: false,
    shims: true,
    dts: true,
    minify: false,
    banner: {
      js: '#!/usr/bin/env node',
    },
  },
  // Library build configuration
  {
    entry: ['src/index.ts'],
    format: ['esm', 'cjs'],
    outDir: 'dist',
    clean: false,
    splitting: false,
    shims: true,
    dts: true,
    minify: false,
    treeshake: true,
  },
]);
