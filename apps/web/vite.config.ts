import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const webMode = process.env['HV_WEB_MODE'] ?? 'demo';
if (webMode !== 'demo' && webMode !== 'http') {
  throw new Error(`Unknown HV_WEB_MODE: ${webMode}`);
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: { __HV_WEB_MODE__: JSON.stringify(webMode) },
  server: {
    port: 5173,
    strictPort: true,
    ...(webMode === 'http' ? {
      proxy: {
        '/v1': process.env['HV_API_ORIGIN'] ?? 'http://localhost:3000',
        '/auth': process.env['HV_API_ORIGIN'] ?? 'http://localhost:3000',
      },
    } : {}),
  },
  preview: { port: 4173, strictPort: true },
  // Takt-059 (BF-25): the demo is public and static, so its build ships no source maps; the HTTP mode keeps them as before
  // (nginx refuses `.map` there).
  build: { sourcemap: webMode === 'http' },
});
