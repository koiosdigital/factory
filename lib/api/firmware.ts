import createClient from "openapi-fetch";
import type { paths as FirmwarePaths } from "~/types/firmware-api";

export const useFirmwareApi = () => {
    const config = useRuntimeConfig();
    return createClient<FirmwarePaths>({
        baseUrl: config.public.firmwareApiBase,
    });
};
