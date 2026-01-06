import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // FIX: Point to the actual file (index.js, not index.cjs.js)
      'react-window': 'react-window/dist/index.js',
      'react-virtualized-auto-sizer': 'react-virtualized-auto-sizer/dist/index.js',
    },
  },
})