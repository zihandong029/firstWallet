import { defineConfig } from 'plasmo'

export default defineConfig({
  // 添加Node.js polyfill配置
  define: {
    global: 'globalThis',
  },
  resolve: {
    alias: {
      crypto: 'crypto-browserify',
      stream: 'stream-browserify',
      assert: 'assert',
      util: 'util',
      buffer: 'buffer',
    },
  },
  build: {
    rollupOptions: {
      external: [],
      output: {
        globals: {
          'crypto': 'crypto',
          'assert': 'assert',
          'util': 'util',
          'stream': 'stream',
          'buffer': 'Buffer'
        }
      }
    }
  }
}) 