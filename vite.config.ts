import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
    resolve: {
        alias: {
            '@model': path.resolve(__dirname, 'src/game/model'),
            '@view': path.resolve(__dirname, 'src/game/view'),
            '@scenes': path.resolve(__dirname, 'src/game/scenes'),
            '@input': path.resolve(__dirname, 'src/game/input'),
            '@config': path.resolve(__dirname, 'src/game/config'),
            '@events': path.resolve(__dirname, 'src/game/events'),
        },
    },
    server: {
        port: 8080,
        open: true,
    },
    build: {
        outDir: 'dist',
        sourcemap: true,
    },
});
