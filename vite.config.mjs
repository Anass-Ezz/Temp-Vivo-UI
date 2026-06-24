import { fileURLToPath, URL } from 'node:url';

import { PrimeVueResolver } from '@primevue/auto-import-resolver';
import vue from '@vitejs/plugin-vue';
import Components from 'unplugin-vue-components/vite';
import { defineConfig } from 'vitest/config';

// https://vitejs.dev/config/
export default defineConfig({
    optimizeDeps: {
        noDiscovery: true
    },
    plugins: [
        vue(),
        Components({
            resolvers: [PrimeVueResolver()]
        })
    ],
    resolve: {
        alias: {
            '@': fileURLToPath(new URL('./src', import.meta.url))
        }
    },
    server: {
        proxy: {
            '/api': 'http://localhost:5000',
            '/websocket': {
                target: 'ws://localhost:8082',
                ws: true,
                rewrite: (path) => path.replace(/^\/websocket/, '')
            }
        }
    },
    test: {
        environment: 'node',
        include: ['src/**/*.test.js', 'src/**/*.test.ts']
    }
});
