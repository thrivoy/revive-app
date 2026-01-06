import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // ⬇️ FORCE VITE TO USE THE STABLE COMMONJS BUILDS ⬇️
      'react-window': 'react-window/dist/index.cjs.js',
      'react-virtualized-auto-sizer': 'react-virtualized-auto-sizer/dist/index.cjs.js',
    },
  },
})