import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],

  // เว็บจริงอยู่ที่ https://student.crru.ac.th/huyyuakpaso/
  base: '/huyyuakpaso/',

  // ใช้เฉพาะตอน npm run dev
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
});