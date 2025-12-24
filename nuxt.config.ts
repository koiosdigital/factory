// https://nuxt.com/docs/api/configuration/nuxt-config
import tailwindcss from "@tailwindcss/vite";

const getAuthBaseURL = () => {
  if (process.env.NODE_ENV === 'production') {
    return 'https://factory.koiosdigital.net';
  }
  return 'http://localhost:3000';
}

export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  devtools: { enabled: true },
  runtimeConfig: {
    public: {
      firmwareApiBase: process.env.NUXT_PUBLIC_FIRMWARE_API_BASE || 'https://firmware.api.koiosdigital.net',
      provisioningApiBase: process.env.NUXT_PUBLIC_PROVISIONING_API_BASE || 'https://provisioning.api.koiosdigital.net',
    },
  },
  modules: [
    '@nuxt/eslint',
    '@nuxt/icon',
    '@nuxt/ui-pro',
    'nuxt-oidc-auth',
    '@pinia/nuxt'
  ],
  css: ['~/assets/css/main.css'],
  oidc: {
    providers: {
      keycloak: {
        audience: 'account',
        baseUrl: 'https://sso.koiosdigital.net/realms/kd-prod',
        clientId: 'factory',
        clientSecret: '',
        exposeAccessToken: true,
        scope: ['openid', 'profile', 'email', 'roles'],
        redirectUri: `${getAuthBaseURL()}/auth/keycloak/callback`,
        userNameClaim: 'preferred_username',
        logoutRedirectUri: `${getAuthBaseURL()}`,
        pkce: true,

      }
    },
    session: { cookie: { sameSite: 'lax' } }
  },
  vite: {
    plugins: [
      tailwindcss()
    ]
  }
})