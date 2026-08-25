import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// No /api proxy here: `vercel dev` (run from the repo root) serves the client
// and the api/ function together on one origin, exactly as production does.
// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
})
