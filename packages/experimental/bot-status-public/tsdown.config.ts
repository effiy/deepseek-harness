import { defineConfig } from 'tsdown'

const SKIP_WORKSPACE = { entry: '' }

/**
 * Host-only package with no client bundle. Uses a face-aware config because
 * the workspace-mode default entry pattern (lib/types/{index,startup}.js)
 * expects startup.js, which this package does not export.
 */
export default defineConfig(({ env }) => {
  if (env?.DSH_BUILD_FACE === 'client') return [SKIP_WORKSPACE]
  return [{
    entry: ['lib/types/index.js'],
    outDir: 'lib',
    format: ['esm'],
    platform: 'node',
    target: 'es2024',
    fixedExtension: false,
    dts: false,
    clean: false,
  }]
})