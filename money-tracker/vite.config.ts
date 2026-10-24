import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(({mode}) => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      // One ~710 kB bundle (React, Motion and the three dictionaries) is fine for this app; it is cached after the
      // first visit. Every window and the receipt reader load separately.
      chunkSizeWarningLimit: 800,
      // The Supabase client changes rarely, so it gets its own cached file. The single-file
      // artifact build has no cloud code at all and must stay one script.
      rollupOptions: mode === 'artifact' ? undefined : {output: {manualChunks: (id: string) => (id.includes('@supabase') ? 'supabase' : undefined)}},
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
