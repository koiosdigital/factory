import createClient from 'openapi-fetch'

import type { paths as LicensingPaths } from '@/types/licensing-api'
import { getRuntimeConfig } from '@/lib/runtime/config'

const licensingClient = createClient<LicensingPaths>({
  baseUrl: getRuntimeConfig().licensingApiBase,
})

export const useLicensingApi = () => licensingClient
