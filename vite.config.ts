import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // 将 Ant Design 单独拆分为一个 chunk
          antd: ['antd'],
          // 将压缩算法库拆分为单独的 chunk
          compressors: ['pako', 'lz-string', 'lz4js', 'snappyjs', 'fflate'],
          // 将工具函数拆分为单独的 chunk
          utils: ['@/utils/computeScores', '@/utils/compress']
        }
      }
    }
  }
})
