import yamlPlugin from 'esbuild-plugin-yaml';

/** @type {import('esbuild').BuildOptions} */
export default _serverless => ({
  bundle: true,
  minify: false,
  sourcemap: true,
  format: 'esm',
  platform: 'node',
  target: 'node24',
  resolveExtensions: ['.ts', '.mjs', '.js', '.json'],
  inject: ['cjs-shim.ts'],
  external: ['@aws-sdk/*', '@sparticuz/chromium', 'sharp'],
  plugins: [yamlPlugin.yamlPlugin()],
});
