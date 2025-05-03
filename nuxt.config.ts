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
  modules: [
    '@nuxt/eslint',
    '@nuxt/icon',
    '@nuxt/ui-pro',
    'nuxt-oidc-auth'
  ],
  css: ['~/assets/css/main.css'],
  oidc: {
    providers: {
      keycloak: {
        audience: 'account',
        baseUrl: 'https://auth.koiosdigital.net/realms/kd-prod',
        clientId: 'factory',
        clientSecret: '',
        exposeAccessToken: true,
        scope: ['openid', 'profile', 'email', 'roles'],
        redirectUri: `${getAuthBaseURL()}/auth/keycloak/callback`,
        userNameClaim: 'preferred_username',
        logoutRedirectUri: `${getAuthBaseURL()}`,
      }
    },
  },
  vite: {
    plugins: [
      tailwindcss()
    ]
  }
})