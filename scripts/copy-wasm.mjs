#!/usr/bin/env node
// Copiado automaticamente antes do build para garantir modo offline
import { copyFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const src = resolve(root, 'node_modules/sql.js/dist/sql-wasm.wasm');
const dest = resolve(root, 'public/sql-wasm.wasm');

if (!existsSync(src)) {
  console.error('❌ sql-wasm.wasm não encontrado em node_modules/sql.js/dist/');
  console.error('   Execute: npm install');
  process.exit(1);
}

copyFileSync(src, dest);
console.log('✅ sql-wasm.wasm copiado para public/sql-wasm.wasm');
