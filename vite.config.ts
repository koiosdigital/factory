import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import ui from '@nuxt/ui/vite'

export default defineConfig({
    plugins: [
        vue({
            template: {
                compilerOptions: {
                    isCustomElement: (tag) => tag === 'esp-web-install-button'
                }
            }
        }),
        tailwindcss(),
        ui({
            ui: {
                colors: {
                    primary: 'pink',
                    neutral: 'zinc'
                }
            }
        })
    ],
    resolve: {
        alias: {
            '@': fileURLToPath(new URL('./src', import.meta.url))
        }
    },
    build: {
        sourcemap: true
    }
})
