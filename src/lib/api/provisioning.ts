import createClient from 'openapi-fetch'

import type { paths as ProvisioningPaths } from '@/types/provisioning-api'
import { getRuntimeConfig } from '@/lib/runtime/config'

const provisioningClient = createClient<ProvisioningPaths>({
    baseUrl: getRuntimeConfig().provisioningApiBase
})

export const useProvisioningApi = () => provisioningClient
