import { createRouter, createWebHistory } from 'vue-router'

import CryptoPage from '@/pages/crypto.vue'
import HomePage from '@/pages/index.vue'
import ProgramPage from '@/pages/program/[slug].vue'
import AuthCallbackPage from '@/pages/auth/callback.vue'
import LogoutPage from '@/pages/auth/logout.vue'
import SilentAuthPage from '@/pages/auth/silent.vue'
import { useAuthStore } from '@/stores/auth'

const router = createRouter({
    history: createWebHistory(),
    routes: [
        { path: '/', component: HomePage, meta: { requiresAuth: true } },
        { path: '/crypto', component: CryptoPage, meta: { requiresAuth: true } },
        { path: '/program/:slug', component: ProgramPage, meta: { requiresAuth: true } },
        { path: '/auth/callback', component: AuthCallbackPage },
        { path: '/auth/silent', component: SilentAuthPage },
        { path: '/logout', component: LogoutPage, meta: { requiresAuth: true } }
    ]
})

router.beforeEach(async (to) => {
    const auth = useAuthStore()
    await auth.bootstrap()

    if (to.meta.requiresAuth && !auth.isAuthenticated) {
        await auth.login(to.fullPath)
        return false
    }

    return true
})

export default router
