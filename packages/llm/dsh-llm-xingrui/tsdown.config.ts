import { defineConfig } from 'tsdown'

/** Pure JavaScript package — bundles from src/ without TypeScript compilation. */
export default defineConfig({
  entry: ['src/index.js'],
  outDir: 'lib',
  format: ['esm'],
  platform: 'node',
  target: 'es2024',
  fixedExtension: false,
  dts: false,
  clean: false,
})