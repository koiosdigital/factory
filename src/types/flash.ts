export type FlashState = 'idle' | 'downloading' | 'flashing' | 'complete' | 'error'

export interface FileToFlash {
  data: Uint8Array // Raw firmware bytes
  address: number // Flash offset
}
