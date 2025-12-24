import createClient from "openapi-fetch";
import type { paths as ProvisioningPaths } from "~/types/provisioning-api";

export const useProvisioningApi = () => {
    const config = useRuntimeConfig();
    return createClient<ProvisioningPaths>({
        baseUrl: config.public.provisioningApiBase,
    });
};
