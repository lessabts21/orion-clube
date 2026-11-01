import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => ({
  // GitHub Pages publica este projeto em /orion-clube/.
  // Os builds locais e do Capacitor continuam usando a raiz (/).
  base: mode === 'github-pages' ? '/orion-clube/' : '/',
  plugins: [react()],
  server: { host: '0.0.0.0' },
}))
