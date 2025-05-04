import type { Terminal } from "@xterm/xterm";
import { BlobReader, BlobWriter, ZipReader } from "@zip.js/zip.js";
import { ESPLoader, Transport, type FlashOptions, type IEspLoaderTerminal } from "esptool-js";
import type { FirmwareManifest } from "~/types/koios_apis";
import { AutoConnectResult, CryptoState, FirmwareFlashState, SerialState } from "~/types/programmer";

const matchedVendorIds = [
    0x303A, // Espressif
]

const matchUserCodeStart = "Pro cpu start user code";
const matchNotFlashed = "invalid header: 0x";

export const useProgrammerStore = defineStore('programmer', () => {
    const toast = useToast();
    const user = useOidcAuth();

    const serialConnectionState = ref<SerialState>(SerialState.DISCONNECTED);
    const firmwareFlashState = ref<FirmwareFlashState>(FirmwareFlashState.NOT_FLASHED);
    const cryptoState = ref<CryptoState>(CryptoState.UNINITIALIZED);
    const kdConsoleReady = ref(false);
    const terminalVisible = ref(false);

    const rom = ref<string>("");
    const mac = ref<string>("");

    let port: SerialPort | null = null;
    let transport: Transport | null = null;
    let loader: ESPLoader | null = null;
    let terminal: Terminal | null = null;
    let terminalActive = false;
    let consoleBusy = false;
    let consoleAbortController: AbortController | null = null;
    let uploadedDSParams = false;

    const connectToDevice = async (force: boolean = false) => {
        if (serialConnectionState.value === SerialState.CONNECTED && !force) return;

        if (!port) {
            showError('No port selected');
            return;
        }

        serialConnectionState.value = SerialState.CONNECTING;

        transport = new Transport(port, false);
        setTerminalActive(true);

        const espTerminal: IEspLoaderTerminal = {
            write: (data: string) => {
                if (terminal && terminalActive) {
                    terminal.write(data);
                }
            },
            writeLine: (data: string) => {
                if (terminal && terminalActive) {
                    terminal.writeln(data);
                }
            },
            clean: () => {
                if (terminal && terminalActive) {
                    terminal.clear();
                }
            },
        }

        loader = new ESPLoader({
            transport,
            baudrate: 921600,
            romBaudrate: 115200,
            enableTracing: false,
            debugLogging: false,
            terminal: espTerminal,
        });

        if (!force) {
            firmwareFlashState.value = FirmwareFlashState.DETERMINING;

            await enterROM();
        }

        serialConnectionState.value = SerialState.CONNECTED;

        if (!force) {
            //by default, we do not want to be in the ROM
            await resetChip();
            startConsole();
        }
    }

    const disconnectFromDevice = async (force: boolean = false) => {
        if (serialConnectionState.value !== SerialState.CONNECTED) return;
        consoleAbortController?.abort();

        if (transport) await transport.disconnect();

        transport = null;
        loader = null;

        if (!force) {
            port = null;
        }

        serialConnectionState.value = SerialState.DISCONNECTED;
        firmwareFlashState.value = FirmwareFlashState.NOT_FLASHED;
        cryptoState.value = CryptoState.UNINITIALIZED;
        terminalVisible.value = false;
        terminal?.clear();

        rom.value = "";
        mac.value = "";
        terminalActive = false;
    }

    const attemptDeviceAutoConnect = async (): Promise<AutoConnectResult> => {
        if (serialConnectionState.value === SerialState.CONNECTED) return AutoConnectResult.FAILED;
        if (!import.meta.client) return AutoConnectResult.FAILED;

        const ports = await navigator.serial.getPorts();

        if (ports.length > 0) {
            for (const _port of ports) {
                const info = _port.getInfo();
                if (info.usbVendorId && matchedVendorIds.includes(info.usbVendorId)) {
                    port = _port;
                    connectToDevice();
                    return AutoConnectResult.SUCCESS;
                }
            }
        }

        return AutoConnectResult.NO_AUTHORIZED_PORTS;
    }

    const openPortSelection = async () => {
        if (serialConnectionState.value === SerialState.CONNECTED) return;
        if (!import.meta.client) return;

        const filters = matchedVendorIds.map(vendorId => ({ usbVendorId: vendorId }));

        try {
            const _port = await navigator.serial.requestPort({
                filters
            });
            port = _port;
            connectToDevice();
        } catch {
            showError('No port selected');
        }
    }

    const startConsole = async () => {
        if (!transport) {
            showError('No transport available');
            return;
        }

        const reader = transport.rawRead();
        consoleAbortController = new AbortController();

        try {
            let buffer = new Uint8Array(0);
            for await (const value of reader) {
                if (consoleAbortController.signal.aborted) {
                    break;
                }

                terminal?.write(new TextDecoder().decode(value));
                buffer = new Uint8Array([...buffer, ...value]);

                for (let i = 0; i < buffer.length; i++) {
                    if (buffer[i] === 0x0a) {
                        const _line = buffer.slice(0, i);
                        buffer = buffer.slice(i + 1);
                        const line = new TextDecoder().decode(_line);
                        handleConsoleLine(line);
                    }
                }
            }
        } catch {
            //ignore
        }
    }

    let cryptoStatusInterval: NodeJS.Timeout | null = null;
    const cryptoStatusCheckLoop = async () => {
        if (!transport) {
            clearInterval(cryptoStatusInterval!);
            return;
        }

        if (consoleBusy) {
            return;
        }

        const command = "crypto_status\n";
        const commandBuffer = new TextEncoder().encode(command);
        await transport.write(commandBuffer);
    }

    const handleConsoleLine = async (line: string) => {
        if (line.includes(matchUserCodeStart)) {
            firmwareFlashState.value = FirmwareFlashState.FLASHED;
        }

        if (line.includes(matchNotFlashed)) {
            firmwareFlashState.value = FirmwareFlashState.NOT_FLASHED;
            consoleAbortController?.abort();
            consoleAbortController = null;
        }

        if (line.includes("kd>") && kdConsoleReady.value === false) {
            kdConsoleReady.value = true;
            cryptoStatusInterval = setInterval(cryptoStatusCheckLoop, 1000);
        }

        console.log(line);

        try {
            const json = JSON.parse(line)
            if (json && !consoleBusy) {
                console.log(json);
                if (json.status) {
                    cryptoState.value = json.status;

                    if (cryptoState.value === CryptoState.VALID_CSR) {
                        const command = "get_csr\n";
                        const commandBuffer = new TextEncoder().encode(command);
                        await transport?.write(commandBuffer);
                    } else if (cryptoState.value === CryptoState.VALID_CERT) {
                        toast.add({
                            title: 'Success',
                            description: 'Device is provisioned',
                            color: 'success',
                        })
                        disconnectFromDevice();
                    }
                } else if (json.csr) {
                    signCSR(json.csr);
                }
            }
        } catch {
            //ignore
        }
    }

    const signCSR = async (csr: string) => {
        consoleBusy = true;
        const csrText = atob(csr);

        //create formdata
        const formData = new FormData();
        formData.append("csr", new Blob([csrText]), "csr.pem");

        const response = await fetch(
            "https://provisioning.api.koiosdigital.net/v1/factory/provision",
            {
                method: "POST",
                body: formData,
                headers: {
                    Authorization: `Bearer ${user.user.value!.accessToken}`,
                },
            }
        );

        if (!response.ok) {
            showError("Failed to sign CSR");
            consoleBusy = false;
            return;
        }

        //response will be a file, extract text and encode as base64
        const blob = await response.blob();
        const reader = new FileReader();
        reader.readAsText(blob);
        reader.onload = async () => {
            const text = reader.result as string;
            const base64 = btoa(text);

            const commandChunks = [];
            const chunkSize = 64;
            const command = `set_device_cert ${base64}\n`;

            for (let i = 0; i < command.length; i += chunkSize) {
                commandChunks.push(command.slice(i, i + chunkSize));
            }

            for (const chunk of commandChunks) {
                const commandBuffer = new TextEncoder().encode(chunk);
                await transport?.write(commandBuffer);
                await new Promise((resolve) => setTimeout(resolve, 50));
            }

            consoleBusy = false;
        };
    }

    const resetChip = async () => {
        if (!transport) {
            showError('No transport available');
            return;
        }

        await transport!.setRTS(true);
        await new Promise((resolve) => setTimeout(resolve, 100));
        await transport!.setRTS(false);
    }

    const enterROM = async () => {
        if (!transport) {
            showError('No transport available');
            return;
        };

        if (!loader) {
            showError('No loader available');
            return;
        }

        if (consoleAbortController) {
            consoleAbortController.abort();
            consoleAbortController = null;
        }

        if (rom.value !== "") {
            await disconnectFromDevice(true);
            await connectToDevice(true);
        }

        setTerminalActive(true);

        rom.value = await loader.main();
        mac.value = await loader.chip.readMac(loader);
    }

    const showError = (message: string) => {
        toast.add({
            title: 'Error',
            description: message,
            color: 'error',
        });
    }

    const setTerminal = (term: Terminal) => {
        if (loader) {
            console.warn('Loader already exists, cannot set terminal');
            return;
        }

        terminal = term;
    }

    const setTerminalActive = (active: boolean) => {
        terminalActive = active;
        terminalVisible.value = active;

        if (terminal) {
            if (!active) {
                terminal.clear();
            }
        }
    }

    const flashFirmware = async (manifest_url: string) => {
        await enterROM();

        if (!loader) {
            showError('No loader available');
            return;
        }

        firmwareFlashState.value = FirmwareFlashState.FLASHING;

        // read contents of firmware into memory
        const url = `https://firmware.api.koiosdigital.net/mirror/${encodeURIComponent(
            manifest_url
        )}`;
        const res = await fetch(url);

        // get binary string from response body
        const firmwareZip = await res.blob();

        const reader = new ZipReader(new BlobReader(firmwareZip));
        const entries = await reader.getEntries();

        const manifestEntry = entries.find(
            (entry) => entry.filename === "flash_files.json"
        );
        if (!manifestEntry) {
            toast.add({
                title: "Error",
                description: "No manifest found in firmware zip",
                color: "error",
            });
            return;
        }

        const manifest: FirmwareManifest = JSON.parse(
            await (await manifestEntry.getData!(new BlobWriter())).text()
        );

        const flashItems: {
            address: number;
            data: string;
        }[] = [];

        for (const flashItem of manifest) {
            const address = parseInt(flashItem.offset, 16);

            const binaryEntry = entries.find(
                (entry) => entry.filename === flashItem.file
            );

            if (!binaryEntry) {
                showError(`No binary entry found for ${flashItem.file} in firmware zip`)
                return;
            }

            const data = await binaryEntry.getData!(new BlobWriter());
            const dataArray = new Uint8Array(await data.arrayBuffer());
            let dataString = "";

            for (let i = 0; i < dataArray.length; i++) {
                dataString += String.fromCharCode(dataArray[i]);
            }

            flashItems.push({
                address,
                data: dataString,
            });
        }

        if (!loader) {
            return;
        }

        const flashOptions = {
            fileArray: flashItems,
            flashSize: "keep",
            eraseAll: false,
            compress: true,
        } as FlashOptions;

        await loader.writeFlash(flashOptions);
        await loader.after();
        await resetChip();
        firmwareFlashState.value = FirmwareFlashState.FLASHED;
        startConsole();
    }

    return {
        serialConnectionState,
        firmwareFlashState,
        kdConsoleReady,
        cryptoState,
        rom,
        mac,
        terminalVisible,

        openPortSelection,
        attemptDeviceAutoConnect,
        disconnectFromDevice,
        setTerminal,
        setTerminalActive,

        resetChip,
        enterROM,
        flashFirmware,
    };
});