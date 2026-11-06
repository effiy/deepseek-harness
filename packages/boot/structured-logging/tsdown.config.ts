import { defineConfig } from 'tsdown'

/**
 * Node-only boot half: attaches one Cordis logger file exporter.
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
