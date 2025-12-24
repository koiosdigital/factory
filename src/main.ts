import './assets/css/main.css'

import { createHead } from '@unhead/vue/client'
import { createPinia } from 'pinia'
import { createApp } from 'vue'

import ui from '@nuxt/ui/vue-plugin'

import App from './App.vue'
import router from './router'
import Icon from './plugins/Icon'

const app = createApp(App)
const pinia = createPinia()
const head = createHead()

app.use(pinia)
app.use(router)
app.use(ui)
app.use(head)
app.component('Icon', Icon)

app.mount('#app')
