import type { IEspLoaderTerminal } from 'esptool-js'

export interface TerminalOptions {
  debug?: boolean
  onOutput?: (data: string) => void
}

export const createEspTerminal = (options: TerminalOptions = {}): IEspLoaderTerminal => {
  const { debug = false, onOutput } = options

  return {
    clean() {
      if (debug) console.clear()
    },
    writeLine(data: string) {
      if (debug) console.log('[esptool]', data)
      onOutput?.(data + '\n')
    },
    write(data: string) {
      if (debug) console.log('[esptool]', data)
      onOutput?.(data)
    },
  }
}

export const silentTerminal: IEspLoaderTerminal = {
  clean() {},
  writeLine() {},
  write() {},
}

export const debugTerminal: IEspLoaderTerminal = createEspTerminal({ debug: true })
