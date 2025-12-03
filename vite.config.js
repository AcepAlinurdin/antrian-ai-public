import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
// import tailwindcss from '@tailwindcss/vite'


// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Vite otomatis mendeteksi postcss.config.js, jadi tidak perlu setting tambahan untuk Tailwind disini
})