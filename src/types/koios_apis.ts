export type Project = {
  slug: string
  supports_variants: boolean
  repository_slug: string
  name: string
}

export type ProjectVariantsResponse = {
  name: string
  repo: string
  variants: string[]
}

export type FlashItem = {
  offset: string
  file: string
}

export type FirmwareManifest = FlashItem[]
