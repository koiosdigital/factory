import { createRouter, createWebHistory } from 'vue-router'

import HomePage from '@/pages/index.vue'
import FlashPage from '@/pages/flash/[project].vue'
import ConsolePage from '@/pages/console.vue'
import AuthCallbackPage from '@/pages/auth/callback.vue'
import LogoutPage from '@/pages/auth/logout.vue'
import SilentAuthPage from '@/pages/auth/silent.vue'
import { useAuthStore } from '@/stores/auth'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: HomePage },
    { path: '/flash/:project', component: FlashPage },
    { path: '/console', component: ConsolePage },
    { path: '/auth/callback', component: AuthCallbackPage },
    { path: '/auth/silent', component: SilentAuthPage },
    { path: '/logout', component: LogoutPage },
  ],
})

router.beforeEach(async () => {
  const auth = useAuthStore()
  await auth.bootstrap()
  return true
})

export default router
