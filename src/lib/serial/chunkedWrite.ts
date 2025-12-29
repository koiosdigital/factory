import type { Transport } from 'esptool-js'

/**
 * Write data to serial in chunks with delays between each chunk.
 * Use this if the device has buffer overflow issues with large writes.
 */
export const writeChunked = async (
  transport: Transport,
  data: string,
  chunkSize = 128,
  delayMs = 25
): Promise<void> => {
  for (let i = 0; i < data.length; i += chunkSize) {
    const chunk = data.slice(i, i + chunkSize)
    await transport.write(new TextEncoder().encode(chunk))
    await new Promise((r) => setTimeout(r, delayMs))
  }
}

/**
 * Simple write - sends all data at once.
 * This is the default approach; use writeChunked if buffer issues occur.
 */
export const writeSimple = async (transport: Transport, data: string): Promise<void> => {
  await transport.write(new TextEncoder().encode(data))
}
