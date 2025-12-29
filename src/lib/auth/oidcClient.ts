import { UserManager, WebStorageStateStore } from 'oidc-client-ts'

import { getRuntimeConfig } from '@/lib/runtime/config'

let userManager: UserManager | null = null

const createStorage = () => {
  if (typeof window === 'undefined') {
    return undefined
  }
  return new WebStorageStateStore({ store: window.sessionStorage })
}

const createUserManager = () => {
  if (typeof window === 'undefined') {
    return null
  }

  const { oidc } = getRuntimeConfig()
  const storage = createStorage()

  const manager = new UserManager({
    authority: oidc.issuer,
    client_id: oidc.clientId,
    redirect_uri: oidc.redirectUri,
    post_logout_redirect_uri: oidc.logoutRedirectUri,
    silent_redirect_uri: oidc.silentRedirectUri,
    response_type: 'code',
    scope: oidc.scope,
    loadUserInfo: true,
    monitorSession: true,
    automaticSilentRenew: true,
    includeIdTokenInSilentRenew: true,
    filterProtocolClaims: true,
    ...(storage ? { userStore: storage, stateStore: storage } : {}),
  })

  try {
    manager.startSilentRenew()
  } catch {
    // ignore – silent renew is optional
  }

  return manager
}

export const getOidcUserManager = (): UserManager | null => {
  if (!userManager) {
    userManager = createUserManager()
  }
  return userManager
}
