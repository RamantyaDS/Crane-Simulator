import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages serves the site at /Crane-Simulator/
export default defineConfig({
  base: '/Crane-Simulator/',
  plugins: [react()],
});
