import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { User } from 'oidc-client-ts'

import { getOidcUserManager } from '@/lib/auth/oidcClient'

export const useAuthStore = defineStore('auth', () => {
    const manager = getOidcUserManager()
    const currentUser = ref<User | null>(null)
    const initializing = ref(false)
    let bootstrapPromise: Promise<void> | null = null

    const syncUser = (user: User | null) => {
        currentUser.value = user
    }

    if (manager) {
        manager.events.addUserLoaded((user) => {
            syncUser(user)
        })
        manager.events.addAccessTokenExpired(async () => {
            try {
                const refreshed = await manager.signinSilent()
                syncUser(refreshed ?? null)
            } catch {
                syncUser(null)
            }
        })
        manager.events.addUserUnloaded(() => syncUser(null))
        manager.events.addUserSignedOut(() => syncUser(null))
    }

    const isAuthenticated = computed(
        () => Boolean(currentUser.value && !currentUser.value.expired)
    )
    const accessToken = computed(() => currentUser.value?.access_token ?? null)
    const profile = computed(() => currentUser.value?.profile ?? null)

    const bootstrap = async () => {
        if (bootstrapPromise) return bootstrapPromise
        if (!manager) return

        bootstrapPromise = (async () => {
            initializing.value = true
            try {
                const user = await manager.getUser()
                if (user && !user.expired) {
                    syncUser(user)
                    return
                }

                if (user && user.expired) {
                    try {
                        const refreshed = await manager.signinSilent()
                        syncUser(refreshed ?? null)
                    } catch {
                        syncUser(null)
                    }
                    return
                }

                syncUser(user)
            } finally {
                initializing.value = false
            }
        })()

        return bootstrapPromise
    }

    const ensureManager = () => {
        if (!manager) {
            throw new Error('OIDC manager is not available in this environment')
        }
        return manager
    }

    const login = async (redirectPath?: string) => {
        const oidcManager = ensureManager()
        const target = redirectPath ?? window.location.pathname + window.location.search
        await oidcManager.signinRedirect({
            state: target
        })
    }

    const finishLogin = async (currentUrl: string) => {
        const oidcManager = ensureManager()
        const user = await oidcManager.signinCallback(currentUrl)
        if (!user) {
            throw new Error('Authentication failed: no user returned from callback')
        }
        syncUser(user)
        return (user.state as string | undefined) ?? '/'
    }

    const logout = async () => {
        const oidcManager = ensureManager()
        const previousUser = currentUser.value
        syncUser(null)
        await oidcManager.removeUser().catch(() => undefined)
        await oidcManager.signoutRedirect({
            id_token_hint: previousUser?.id_token
        })
    }

    const getAccessToken = () => accessToken.value

    return {
        initializing,
        isAuthenticated,
        accessToken,
        user: profile,
        bootstrap,
        login,
        finishLogin,
        logout,
        getAccessToken
    }
})
