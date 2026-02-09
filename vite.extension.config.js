import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
export default defineConfig({
    plugins: [react()],
    root: 'nexus-connect-extension',
    publicDir: 'public',
    build: {
        outDir: '../dist-extension',
        emptyOutDir: true,
        rollupOptions: {
            input: {
                main: path.resolve(__dirname, 'nexus-connect-extension/index.html'),
                background: path.resolve(__dirname, 'nexus-connect-extension/src/background.ts'),
                content: path.resolve(__dirname, 'nexus-connect-extension/src/content.ts'),
            },
            output: {
                entryFileNames: '[name].js',
            }
        }
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
});
