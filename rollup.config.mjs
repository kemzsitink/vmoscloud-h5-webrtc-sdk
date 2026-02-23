import typescript from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';

export default {
  input: 'src/index.ts',
  output: [
    {
      file: 'dist/index.cjs.js',
      format: 'cjs',
      sourcemap: true
    },
    {
      file: 'dist/index.es.js',
      format: 'es',
      sourcemap: true
    },
    {
      file: 'dist/index.global.js',
      format: 'iife',
      name: 'ArmcloudRtc',
      sourcemap: true,
      globals: {
        'webrtc-adapter': 'adapter',
        'axios': 'axios',
        'crypto-js': 'CryptoJS',
        '@volcengine/rtc': 'VERTC'
      }
    }
  ],
  plugins: [
    resolve({
      browser: true
    }),
    commonjs(),
    typescript({
      tsconfig: './tsconfig.json'
    })
  ],
  external: ['webrtc-adapter', 'axios', 'crypto-js', '@volcengine/rtc']
};
