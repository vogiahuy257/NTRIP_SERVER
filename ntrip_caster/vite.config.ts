import inertia from '@inertiajs/vite';
import { wayfinder } from '@laravel/vite-plugin-wayfinder';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import laravel from 'laravel-vite-plugin';
import { bunny } from 'laravel-vite-plugin/fonts';
import { defineConfig } from 'vite';

const DEV_HOST = 'ctuav-ntrip.local';
const APP_ORIGIN = 'http://ctuav-ntrip.local:8000';
const VITE_ORIGIN = 'http://ctuav-ntrip.local:5173';

export default defineConfig({
    plugins: [
        laravel({
            input: ['resources/css/app.css', 'resources/js/app.tsx'],
            refresh: true,
            fonts: [
                bunny('Instrument Sans', {
                    weights: [400, 500, 600],
                }),
            ],
        }),
        inertia(),
        react({
            babel: {
                plugins: ['babel-plugin-react-compiler'],
            },
        }),
        tailwindcss(),
        wayfinder({
            formVariants: true,
        }),
    ],
    server: {
        host: '0.0.0.0',
        port: 5173,
        strictPort: true,

        origin: VITE_ORIGIN,

        allowedHosts: [DEV_HOST],

        cors: {
            origin: [APP_ORIGIN],
        },

        ws: {
            protocol: 'ws',
            host: DEV_HOST,
            port: 5173,
            clientPort: 5173,
        },
    },
});
