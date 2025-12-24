import { defineStore } from 'pinia'
import { Transport } from 'esptool-js'
import { ref, shallowRef } from 'vue'
import { useToast } from '@nuxt/ui/composables'

import { useProvisioningApi } from '@/lib/api/provisioning'
import { isSerialSupported, requestMatchingPort } from '@/lib/serial/ports'
import { useAuthStore } from '@/stores/auth'
import { CryptoState, SerialState } from '@/types/programmer'

const ttyPrompt = "tty>";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null;

export const useCryptoStore = defineStore('crypto', () => {
    const toast = useToast();
    const auth = useAuthStore();
    const provisioningApi = useProvisioningApi();

    const serialConnectionState = ref<SerialState>(SerialState.DISCONNECTED);
    const cryptoState = ref<CryptoState>(CryptoState.UNINITIALIZED);
    const kdConsoleReady = ref(false);
    const signingCSR = ref(false);

    const port = shallowRef<SerialPort | null>(null);
    const transport = shallowRef<Transport | null>(null);

    let epoch = 0;
    let abortController: AbortController | null = null;
    let writeChain: Promise<void> = Promise.resolve();

    const bumpEpoch = () => {
        epoch += 1;
        return epoch;
    };

    const enqueueWrite = async (buffer: Uint8Array, expectedEpoch: number) => {
        writeChain = writeChain
            .then(async () => {
                if (expectedEpoch !== epoch) return;
                if (!transport.value) return;
                await transport.value.write(buffer);
            })
            .catch(() => undefined);

        return writeChain;
    };

    const showError = (message: string) => {
        toast.add({
            title: "Error",
            description: message,
            color: "error",
        });
    };

    const resetState = () => {
        kdConsoleReady.value = false;
        cryptoState.value = CryptoState.UNINITIALIZED;
        signingCSR.value = false;
    };

    const stopConsole = () => {
        abortController?.abort();
        abortController = null;
    };

    const disconnect = async () => {
        if (serialConnectionState.value === SerialState.DISCONNECTED) return;

        bumpEpoch();
        stopConsole();

        try {
            await transport.value?.disconnect();
        } catch {
            // ignore
        }

        transport.value = null;
        port.value = null;

        serialConnectionState.value = SerialState.DISCONNECTED;
        resetState();
    };

    const resetChip = async () => {
        if (!transport.value) {
            showError("No transport available");
            return;
        }

        await transport.value.setRTS(true);
        await delay(100);
        await transport.value.setRTS(false);
    };

    const provisionFromCsr = async (args: {
        csrBase64: string;
        write: (data: Uint8Array) => Promise<void>;
        isStale?: () => boolean;
    }) => {
        const accessToken = auth.getAccessToken();
        if (!accessToken) {
            showError('Not authenticated');
            return;
        }

        const csrText = atob(args.csrBase64);
        const formData = new FormData();
        formData.append("csr", csrText);

        const { data, error, response } = await provisioningApi.POST(
            "/v1/factory/provision",
            {
                body: formData as unknown as { csr: string },
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
                parseAs: "text",
            }
        );

        if (args.isStale?.()) return;

        if (error || !response.ok) {
            showError("Failed to sign CSR");
            return;
        }

        const certText = data ?? "";
        const base64 = btoa(certText);

        const chunkSize = 64;
        const command = `set_device_cert ${base64}\n`;

        for (let i = 0; i < command.length; i += chunkSize) {
            if (args.isStale?.()) return;

            const chunk = command.slice(i, i + chunkSize);
            await args.write(new TextEncoder().encode(chunk));
            await delay(50);
        }
    };

    const handleConsoleLine = async (line: string, expectedEpoch: number) => {
        if (expectedEpoch !== epoch) return;

        if (line.includes(ttyPrompt) && !kdConsoleReady.value) {
            kdConsoleReady.value = true;
            return;
        }

        if (line.includes(ttyPrompt)) {
            return;
        }

        let json: unknown;
        try {
            json = JSON.parse(line);
        } catch {
            return;
        }

        if (!isRecord(json)) return;

        if ("status" in json && typeof json.status !== "undefined") {
            cryptoState.value = json.status as CryptoState;
            return;
        }

        if ("csr" in json && json.csr && signingCSR.value) {
            const csrBase64 = String(json.csr);
            const localEpoch = expectedEpoch;

            await provisionFromCsr({
                csrBase64,
                write: (data) => enqueueWrite(data, localEpoch),
                isStale: () => localEpoch !== epoch,
            });

            if (localEpoch !== epoch) return;

            signingCSR.value = false;
            cryptoState.value = CryptoState.UNINITIALIZED;
        }
    };

    const startConsoleLoop = async (expectedEpoch: number) => {
        if (!transport.value) return;

        abortController = new AbortController();
        const signal = abortController.signal;

        const reader = transport.value.rawRead();
        const decoder = new TextDecoder();
        let buffer = new Uint8Array(0);

        try {
            for await (const value of reader) {
                if (signal.aborted) break;
                if (expectedEpoch !== epoch) break;

                buffer = new Uint8Array([...buffer, ...value]);

                for (let i = 0; i < buffer.length; i++) {
                    if (buffer[i] === 0x0a) {
                        const lineBytes = buffer.slice(0, i);
                        buffer = buffer.slice(i + 1);
                        const line = decoder.decode(lineBytes);
                        await handleConsoleLine(line, expectedEpoch);
                        i = -1;
                    }
                }
            }
        } catch {
            // ignore
        }
    };

    const startStatusPollLoop = async (expectedEpoch: number) => {
        while (expectedEpoch === epoch) {
            if (!transport.value) return;
            if (!kdConsoleReady.value) {
                await delay(250);
                continue;
            }

            if (signingCSR.value) {
                await delay(500);
                continue;
            }

            if (cryptoState.value < CryptoState.VALID_CSR) {
                await enqueueWrite(new TextEncoder().encode("crypto_status\n"), expectedEpoch);
            }

            await delay(1000);
        }
    };

    const connect = async () => {
        if (serialConnectionState.value !== SerialState.DISCONNECTED) return;
        if (!isSerialSupported()) return;

        serialConnectionState.value = SerialState.CONNECTING;

        try {
            port.value = await requestMatchingPort();
        } catch {
            serialConnectionState.value = SerialState.DISCONNECTED;
            showError("No port selected");
            return;
        }

        const expectedEpoch = bumpEpoch();
        resetState();

        transport.value = new Transport(port.value, false);

        try {
            await transport.value.connect();
            await resetChip();

            serialConnectionState.value = SerialState.CONNECTED;

            void startConsoleLoop(expectedEpoch);
            void startStatusPollLoop(expectedEpoch);
        } catch (e) {
            await disconnect();
            showError(e instanceof Error ? e.message : "Failed to connect");
        }
    };

    const generateCertificate = async () => {
        if (serialConnectionState.value !== SerialState.CONNECTED) return;
        if (!transport.value) return;

        signingCSR.value = true;
        const expectedEpoch = epoch;
        await enqueueWrite(new TextEncoder().encode("get_csr\n"), expectedEpoch);
    };

    return {
        port,
        serialConnectionState,
        cryptoState,
        kdConsoleReady,
        signingCSR,

        connect,
        disconnect,
        resetChip,
        generateCertificate,

        provisionFromCsr,
    };
});
