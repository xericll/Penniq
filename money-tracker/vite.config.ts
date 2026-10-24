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
  };
});
