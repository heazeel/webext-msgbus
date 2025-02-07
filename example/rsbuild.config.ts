import { defineConfig } from '@rsbuild/core';
import { pluginReact } from '@rsbuild/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [pluginReact()],
  source: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
    entry: {
      background: {
        import: './src/background/index.ts',
        html: false,
      },
      content: {
        import: './src/contentScript/index.ts',
        html: false,
      },
      inject: {
        import: './src/injectScript/index.ts',
        html: false,
      },
      devtools: './src/devtools/index.tsx',
      panel: './src/devtools/panel/index.tsx',
      popup: './src/popup/index.tsx',
      options: './src/options/index.tsx',
    },
  },
  output: {
    minify: false,
    copy: [
      { from: './src/manifest.json', to: 'manifest.json' },
      {
        from: './src/manifest.json',
        to: 'manifest.edge.json',
      },
    ],
    distPath: {
      root: 'extension',
      js: '[name]',
      jsAsync: '[name]',
      css: '[name]',
      svg: 'static/svg',
      image: 'static/image',
    },
    filename: {
      html: '[name].html',
      js: '[name].js',
      css: '[name].css',
      svg: '[name].svg',
      font: '[name][ext]',
      image: '[name][ext]',
    },
    cleanDistPath: true,
    filenameHash: false,
    legalComments: 'none',
  },
  performance: {
    // chunkSplit: {
    //   strategy: "all-in-one",
    // },
  },
  tools: {
    htmlPlugin(config) {
      if (config.filename === 'popup.html') {
        config.filename = `popup/popup.html`;
      }
      if (config.filename === 'devtools.html') {
        config.filename = `devtools/devtools.html`;
      }
      if (config.filename === 'panel.html') {
        config.filename = `panel/panel.html`;
      }
      if (config.filename === 'options.html') {
        config.filename = `options/options.html`;
      }
    },
  },
});
