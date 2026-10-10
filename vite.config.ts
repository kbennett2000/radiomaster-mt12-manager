import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import { APP_NAME } from './src/config/app.ts'

// Fills the page title from the one app-name constant, so index.html never hard-codes it.
function appNameInHtml(): Plugin {
  return {
    name: 'app-name-in-html',
    transformIndexHtml: (html) => html.replaceAll('%APP_NAME%', APP_NAME),
  }
}

// https://vite.dev/config/
export default defineConfig({
  // Relative paths, so the static output runs from any folder on any static host.
  base: './',
  plugins: [react(), appNameInHtml()],
})
