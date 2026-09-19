import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { localAiGateway } from '../api/vite-plugin.mjs';

export default defineConfig({
  plugins: [react(), localAiGateway()],
  server: {
    port: 5173,
    host: true,
  }
});
