import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { copyFileSync, existsSync } from 'fs';

// Plugin inline que copia o sql-wasm.wasm do node_modules para public/
// Garante que o ficheiro está disponível tanto em dev como em build
const copySqlWasm = () => ({
  name: 'copy-sql-wasm',
  buildStart() {
    const src = path.resolve(__dirname, 'node_modules/sql.js/dist/sql-wasm.wasm');
    const dest = path.resolve(__dirname, 'public/sql-wasm.wasm');
    if (existsSync(src)) {
      copyFileSync(src, dest);
      console.log('✅ sql-wasm.wasm copiado para public/');
    } else {
      console.warn('⚠️  sql-wasm.wasm não encontrado — execute npm install');
    }
  }
});

export default defineConfig({
  // ⚠️ Deve corresponder ao nome EXATO do repositório no GitHub
  // ex: repo github.com/user/Lasa → base: '/Lasa/'
  base: '/Lasa/',

  server: {
    port: 3000,
    host: '0.0.0.0',
  },

  plugins: [
    react(),
    copySqlWasm(),
  ],

  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    }
  },

  // Incluir wasm como asset estático para o Vite não tentar processar
  assetsInclude: ['**/*.wasm'],

  optimizeDeps: {
    exclude: ['sql.js']
  },

  build: {
    rollupOptions: {
      output: {
        manualChunks: undefined
      }
    }
  }
});
