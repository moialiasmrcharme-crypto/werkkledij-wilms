{
  "name": "werkkledij-wilms",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.49.8",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "xlsx": "^0.18.5"
  },
  "devDependencies": {
    "vite": "^5.4.10"
  }
}
Admin-only update voor Werkkledij Wilms.

import { defineConfig } from 'vite'
export default defineConfig({ server: { host: true } })

<!doctype html><html lang="nl"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><title>Werkkledij Wilms</title></head><body><div id="root"></div><script type="module" src="/src/main.jsx"></script></body></html>
