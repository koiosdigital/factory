const defaultOrigin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173'

export interface RuntimeConfig {
    firmwareApiBase: string
    provisioningApiBase: string
    oidc: {
        issuer: string
        clientId: string
        redirectUri: string
        logoutRedirectUri: string
        silentRedirectUri: string
        scope: string
    }
}

const runtimeConfig: RuntimeConfig = {
    firmwareApiBase:
        import.meta.env.VITE_FIRMWARE_API_BASE ?? 'https://firmware.api.koiosdigital.net',
    provisioningApiBase:
        import.meta.env.VITE_PROVISIONING_API_BASE ?? 'https://provisioning.api.koiosdigital.net',
    oidc: {
        issuer: import.meta.env.VITE_OIDC_ISSUER ?? 'https://sso.koiosdigital.net/realms/kd-prod',
        clientId: import.meta.env.VITE_OIDC_CLIENT_ID ?? 'factory',
        redirectUri:
            import.meta.env.VITE_OIDC_REDIRECT_URI ?? `${defaultOrigin}/auth/callback`,
        logoutRedirectUri:
            import.meta.env.VITE_OIDC_LOGOUT_REDIRECT_URI ?? `${defaultOrigin}/`,
        silentRedirectUri:
            import.meta.env.VITE_OIDC_SILENT_REDIRECT_URI ?? `${defaultOrigin}/auth/silent`,
        scope: 'openid profile email roles'
    }
}

export const getRuntimeConfig = (): RuntimeConfig => runtimeConfig
