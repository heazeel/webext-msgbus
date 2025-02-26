import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';
import dts from 'rollup-plugin-dts';
import terser from '@rollup/plugin-terser';

const inputFiles = {
  background: 'src/context/background.ts',
  contentScript: 'src/context/contentScript.ts',
  popup: 'src/context/popup.ts',
  options: 'src/context/options.ts',
  devtools: 'src/context/devtools.ts',
  injectScript: 'src/context/injectScript.ts',
  sidePanel: 'src/context/sidePanel.ts',
};

export default [
  {
    input: inputFiles,
    output: [
      {
        dir: 'dist/esm',
        format: 'esm',
        preserveModules: true,
        entryFileNames: '[name].js',
      },
      {
        dir: 'dist/cjs',
        format: 'cjs',
        preserveModules: true,
        entryFileNames: '[name].cjs',
      },
    ],
    plugins: [resolve(), commonjs(), typescript({ tsconfig: './tsconfig.json' }), terser()],
    external: ['serialize-error', 'tiny-uid'],
  },
  {
    input: inputFiles,
    output: {
      dir: 'dist/types',
      format: 'esm',
      preserveModules: true,
      entryFileNames: '[name].d.ts',
    },
    plugins: [dts()],
  },
];
