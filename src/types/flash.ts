export type FlashState = 'idle' | 'downloading' | 'flashing' | 'complete' | 'error'

export interface FileToFlash {
  data: string // Binary string
  address: number // Flash offset
}
