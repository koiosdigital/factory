/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_FIRMWARE_API_BASE?: string
    readonly VITE_LICENSING_API_BASE?: string
    readonly VITE_OIDC_ISSUER?: string
    readonly VITE_OIDC_CLIENT_ID?: string
    readonly VITE_OIDC_REDIRECT_URI?: string
    readonly VITE_OIDC_LOGOUT_REDIRECT_URI?: string
    readonly VITE_OIDC_SILENT_REDIRECT_URI?: string
}

interface ImportMeta {
    readonly env: ImportMetaEnv
}
