export type Project = {
    slug: string;
    name: string;
    supports_variants: boolean;
    repository_slug: string;
    variants: ProjectVariant[] | null;
}

export type ProjectVariant = {
    name: string;
    url: string;
}

export type FlashItem = {
    offset: string;
    file: string;
};

export type FirmwareManifest = FlashItem[];