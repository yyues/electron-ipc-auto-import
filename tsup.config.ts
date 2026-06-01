import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    vite: 'src/vite.ts',
    webpack: 'src/webpack.ts',
    rspack: 'src/rspack.ts',
    esbuild: 'src/esbuild.ts',
    rollup: 'src/rollup.ts',
    types: 'src/types.ts',
    'runtime/main': 'src/runtime/main.ts',
    'runtime/preload': 'src/runtime/preload.ts',
  },
  format: ['esm', 'cjs'],
  // dts is emitted by a separate `tsc --emitDeclarationOnly` step in the
  // build script. tsup's bundled dts pipelines (rollup-plugin-dts and
  // experimentalDts via api-extractor) both fail to follow the unplugin /
  // @rspack/core re-export shapes.
  clean: true,
  splitting: false,
  sourcemap: true,
  // Keep bundlers and electron as externals; the runtime/* entries must not
  // pull in any build-time dependency (unplugin / ts-morph / tinyglobby).
  external: [
    'electron',
    'vite',
    'webpack',
    'rollup',
    'esbuild',
    '@rspack/core',
    'unplugin',
    'ts-morph',
    'tinyglobby',
    '@rollup/pluginutils',
  ],
})
