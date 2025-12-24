import createClient from 'openapi-fetch'

import type { paths as FirmwarePaths } from '@/types/firmware-api'
import { getRuntimeConfig } from '@/lib/runtime/config'

const firmwareClient = createClient<FirmwarePaths>({
    baseUrl: getRuntimeConfig().firmwareApiBase
})

export const useFirmwareApi = () => firmwareClient
