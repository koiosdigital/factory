export type Project = {
    slug: string;
    name: string;
    supports_variants: boolean;
    repository_slug: string;
}

export type ProjectVariant = {
    name: string;
    url: string;
}