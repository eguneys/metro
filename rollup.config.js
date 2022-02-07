import { nodeResolve } from '@rollup/plugin-node-resolve'
const htmlTemplate = require('rollup-plugin-generate-html-template')
const typescript = require('@rollup/plugin-typescript')

const image = require('@rollup/plugin-image')

const serve = require('rollup-plugin-serve')
const livereload = require('rollup-plugin-livereload')

export default {
  input: 'src/main.ts',
  output: [
    { format: 'iife', name: 'Space', dir: 'dist', sourcemap: true }
  ],
  watch: {
    clearScreen: false
  },
  plugins: [
    nodeResolve(),
    typescript(),
    htmlTemplate({
      template: 'src/index.html',
      target: 'index.html'
    }),
    image(),
    serve({ contentBase: 'dist', port: 3000 }),
    livereload({ watch: 'dist', port: 8080 })
  ]
}


