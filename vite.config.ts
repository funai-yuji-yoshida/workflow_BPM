import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages のサブパス（/<repo>/）でも動くよう相対パスで出力する
export default defineConfig({
  base: './',
  plugins: [react()],
});
