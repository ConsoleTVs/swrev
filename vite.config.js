import { resolve } from 'path'
import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/swrev.ts'),
      name: 'swrev',
      fileName: 'swrev',
    },
    rollupOptions: {
      external: [],
      output: {
        globals: {},
      },
    },
  },
})
