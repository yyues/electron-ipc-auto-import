import path from 'node:path'
import HtmlWebpackPlugin from 'html-webpack-plugin'
import type { Configuration, RuleSetRule } from 'webpack'
import electronIpc from 'electron-ipc-auto-import/webpack'
import type { Options } from 'electron-ipc-auto-import'

const mode: Configuration['mode'] =
  process.env.NODE_ENV === 'production' ? 'production' : 'development'

const tsRule: RuleSetRule = {
  test: /\.ts$/,
  exclude: /node_modules/,
  use: {
    loader: 'ts-loader',
    options: { transpileOnly: true },
  },
}

const ipcOpts: Options = {
  // Pin the root so every build target resolves dirs/dts identically.
  root: __dirname,
  dirs: ['src/main/ipc'],
  dts: 'src/preload/ipc-auto-import.d.ts',
  bridgeName: 'ipc',
}

const mainConfig: Configuration = {
  mode,
  target: 'electron-main',
  entry: './src/main/index.ts',
  output: {
    path: path.resolve(__dirname, 'out/main'),
    filename: 'index.js',
    clean: true,
  },
  module: { rules: [tsRule] },
  resolve: { extensions: ['.ts', '.js'] },
  externals: { electron: 'commonjs2 electron' },
  // Keep electron's CommonJS __dirname semantics.
  node: { __dirname: false, __filename: false },
  plugins: [electronIpc(ipcOpts)],
  devtool: 'source-map',
}

const preloadConfig: Configuration = {
  mode,
  target: 'electron-preload',
  entry: './src/preload/index.ts',
  output: {
    path: path.resolve(__dirname, 'out/preload'),
    filename: 'index.js',
    clean: true,
  },
  module: { rules: [tsRule] },
  resolve: { extensions: ['.ts', '.js'] },
  externals: { electron: 'commonjs2 electron' },
  plugins: [electronIpc(ipcOpts)],
  devtool: 'source-map',
}

const rendererConfig: Configuration = {
  mode,
  target: 'electron-renderer',
  entry: './src/renderer/main.ts',
  output: {
    path: path.resolve(__dirname, 'out/renderer'),
    filename: 'main.js',
    clean: true,
  },
  module: { rules: [tsRule] },
  resolve: { extensions: ['.ts', '.js'] },
  plugins: [
    electronIpc(ipcOpts),
    new HtmlWebpackPlugin({
      template: path.resolve(__dirname, 'src/renderer/index.html'),
      filename: 'index.html',
      inject: 'body',
    }),
  ],
  devtool: 'source-map',
}

const config: Configuration[] = [mainConfig, preloadConfig, rendererConfig]

export default config
