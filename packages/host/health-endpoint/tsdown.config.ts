import { defineConfig } from 'tsdown'

/**
 * Node-only host half: registers one unauthenticated webServer route.
 * Single entry, no subpath exports besides `.`.
 */
export default defineConfig([
  {
    entry: ['lib/types/index.js'],
    outDir: 'lib',
    format: ['esm'],
    platform: 'node',
    target: 'es2024',
    fixedExtension: false,
    dts: false,
    clean: false,
  },
])