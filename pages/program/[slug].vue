<template>
  <UContainer>
    <UPageHeader :title="`Program ${project?.name || ''}`" />
    <UPageCard>
      <UFormField v-if="variantOptions.length > 0" label="Select Variant">
        <USelect
          v-model="selectedVariant"
          :items="variantOptions"
          class="w-64"
        />
      </UFormField>
      <div class="flex items-center justify-start gap-4">
        <UButton
          v-if="serialState === SerialState.DISCONNECTED"
          @click="connect"
        >
          Connect
        </UButton>
      </div>
      <div v-if="serialState === SerialState.DISCONNECTED">
        <UAlert
          color="neutral"
          title="Waiting"
          icon="lucide:info"
          description="Please connect a device."
        />
      </div>
      <div v-else-if="serialState === SerialState.CONNECTING">
        <UAlert
          color="neutral"
          title="Connecting"
          icon="lucide:info"
          description="Please wait for the connection to be established."
        />
      </div>
      <div
        v-else-if="serialState >= SerialState.CONNECTED"
        class="flex flex-col gap-4"
      >
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-4">
            <UBadge color="success" size="sm">
              USB ID: 0x{{ port?.getInfo().usbVendorId?.toString(16) }} : 0x{{
                port?.getInfo().usbProductId?.toString(16)
              }}
            </UBadge>
            <UBadge :color="cryptoStatus >= 2 ? 'success' : 'error'" size="sm">
              Has CSR: {{ cryptoStatus >= 2 ? "Yes" : "No" }}
            </UBadge>
            <UBadge :color="cryptoStatus >= 3 ? 'success' : 'error'" size="sm">
              Has Device Certificate: {{ cryptoStatus >= 3 ? "Yes" : "No" }}
            </UBadge>
            <UBadge
              :color="
                serialState === SerialState.KD_CONSOLE_READY
                  ? 'success'
                  : 'warning'
              "
              size="sm"
            >
              KD Console:
              {{
                serialState === SerialState.KD_CONSOLE_READY
                  ? "Ready"
                  : "Not Ready"
              }}
            </UBadge>
          </div>
          <div class="flex items-center gap-4">
            <UButton
              :disabled="serialState < SerialState.CONNECTED"
              color="warning"
              @click="reset"
            >
              Reset
            </UButton>
            <UButton
              :disabled="serialState < SerialState.CONNECTED"
              color="error"
              @click="disconnect"
            >
              Disconnect
            </UButton>
          </div>
        </div>
        <USeparator />
        <div v-if="flashingState === FlashingState.FLASHED">
          <div v-if="cryptoStatus === 1">
            <p class="text-gray-300">
              Please wait for the key generation to finish. This may take a few
              minutes.
            </p>
          </div>
          <div v-if="cryptoStatus === 2">
            <UButton :disabled="signingCSR" @click="signCSR"
              >Generate Certificate</UButton
            >
            <p v-if="signingCSR" class="text-gray-300">
              Please wait for the CSR to be signed. This may take a few seconds.
            </p>
          </div>
          <div v-if="cryptoStatus === 3">
            <p class="text-gray-300">
              Device certificate is valid. Please disconnect and re-connect to
              program the device.
            </p>
          </div>
        </div>
        <div v-else class="flex flex-col gap-4">
          <div class="flex items-center gap-4 justify-center w-full">
            <UButton
              :loading="flashingState === FlashingState.FLASHING"
              :disabled="selectedVariant === ''"
              color="primary"
              @click="doFlash"
              >FLASH</UButton
            >
            <UProgress
              v-if="flashingState === FlashingState.FLASHING"
              v-model="flashingProgress"
              status
            />
            <p v-else class="text-gray-300">
              Device is not flashed. Please flash the device first.
            </p>
          </div>
          <div id="terminal" />
        </div>
      </div>
    </UPageCard>
  </UContainer>
</template>

<script setup lang="ts">
import { ESPLoader, Transport, type FlashOptions } from "esptool-js";
import type { Project } from "~/types/koios_apis";
import { Terminal } from "@xterm/xterm";

import "@xterm/xterm/css/xterm.css";

const { user } = useOidcAuth();

const slug = useRoute().params.slug as string;
const { data: project } = useFetch<Project>(
  "https://firmware.api.koiosdigital.net/projects/" + slug
);

const variantOptions = computed(() => {
  if (project.value && project.value.variants) {
    return project.value.variants.map((variant) => ({
      label: variant.name,
      value: variant.url,
    }));
  }
  return [];
});

enum SerialState {
  DISCONNECTED,
  CONNECTING,
  CONNECTED,
  KD_CONSOLE_READY,
}

enum FlashingState {
  NOT_FLASHED,
  FLASHING,
  FLASHED,
}

let port: SerialPort | undefined = undefined;
let transport: Transport | undefined = undefined;
let loader: ESPLoader | undefined = undefined;
let consoleInterval: ReturnType<typeof setInterval> | undefined = undefined;
let reader: AsyncGenerator<Uint8Array> | undefined = undefined;
let buffer = new Uint8Array(0);
let terminal: Terminal | undefined = undefined;

const serialState = ref<SerialState>(SerialState.DISCONNECTED);
const flashingState = ref<FlashingState>(FlashingState.NOT_FLASHED);
const flashingProgress = ref(0);
const selectedVariant = ref<string>("");

const signingCSR = ref(false);
const cryptoStatus = ref(0);

const handleLine = async (line: string) => {
  console.log(line);
  if (
    line.includes("kd>") &&
    serialState.value !== SerialState.KD_CONSOLE_READY
  ) {
    serialState.value = SerialState.KD_CONSOLE_READY;
  }
  if (
    line.includes("kd>") &&
    serialState.value === SerialState.KD_CONSOLE_READY
  ) {
    return;
  }
  try {
    if (JSON.parse(line)) {
      const data = JSON.parse(line);
      if (data.status) {
        cryptoStatus.value = data.status;
      } else if (data.csr) {
        const csr = data.csr;
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
              Authorization: `Bearer ${user.value!.accessToken}`,
            },
          }
        );

        //response will be a file, extract text and encode as base64
        const blob = await response.blob();
        const reader = new FileReader();
        reader.readAsText(blob);
        reader.onload = async () => {
          const text = reader.result as string;
          const base64 = btoa(text);

          const commandChunks = [];
          const chunkSize = 128;
          const command = `set_device_cert ${base64}\n`;

          for (let i = 0; i < command.length; i += chunkSize) {
            commandChunks.push(command.slice(i, i + chunkSize));
          }

          for (const chunk of commandChunks) {
            const commandBuffer = new TextEncoder().encode(chunk);
            await transport?.write(commandBuffer);
            await new Promise((resolve) => setTimeout(resolve, 50));
          }
        };

        signingCSR.value = false;
        cryptoStatus.value = 0;
      }
    }
  } catch {
    //ignore
  }
};

const signCSR = async () => {
  if (transport) {
    signingCSR.value = true;
    const command = "get_csr\n";
    const commandBuffer = new TextEncoder().encode(command);
    await transport.write(commandBuffer);
  }
};

let i = 0;
const consoleLoop = async () => {
  if (transport && reader) {
    const result = await reader.next();
    if (result.value) {
      buffer = new Uint8Array([...buffer, ...result.value]);
    }

    //split buffer into lines
    for (let i = 0; i < buffer.length; i++) {
      if (buffer[i] === 0x0a) {
        const line = buffer.slice(0, i);
        buffer = buffer.slice(i + 1);
        const str = new TextDecoder().decode(line);
        handleLine(str);
      }
    }

    //if kdconsole is ready, send a command
    if (
      serialState.value === SerialState.KD_CONSOLE_READY &&
      cryptoStatus.value < 3
    ) {
      if (i > 10) {
        i = 0;
        const command = "crypto_status\n";
        const commandBuffer = new TextEncoder().encode(command);
        await transport.write(commandBuffer);
      }
      i++;
    }
  }
};

const connect = async () => {
  if (!port) {
    port = await navigator.serial.requestPort({
      filters: [{ usbVendorId: 0x303a }],
    });
  }

  //destroy loader
  if (loader) {
    loader = undefined;
  }

  //if transport is already connected, disconnect it
  if (transport) {
    await transport.waitForUnlock(1000);
    await transport.disconnect();
    transport = undefined;
  }

  //close the port if it is already open
  if (port && port.readable) {
    //unlock
    await port.readable.cancel();
    await port.writable?.close();
    await port.close();
  }

  serialState.value = SerialState.CONNECTING;

  transport = new Transport(port, false);

  const espTerminal = {
    clean() {
      // noop
    },
    write(data: string) {
      if (terminal) {
        terminal.write(data);
      }
    },
    writeLine(data: string) {
      if (terminal) {
        terminal.writeln(data);
      }
    },
  };

  loader = new ESPLoader({
    transport,
    baudrate: 921600,
    romBaudrate: 921600,
    terminal: espTerminal,
  });
  await loader.main();

  serialState.value = SerialState.CONNECTED;

  setTimeout(() => {
    terminal = new Terminal();
    terminal.open(document.getElementById("terminal") as HTMLElement);
  }, 100);
};

const connectKDConsole = async () => {
  if (transport) {
    consoleInterval = setInterval(() => {
      consoleLoop();
    }, 100);
    reader = transport.rawRead();
  }
};

const doFlash = async () => {
  if (flashingState.value === FlashingState.FLASHING) {
    return;
  }
  flashingState.value = FlashingState.FLASHING;
  // read contents of firmware into memory
  const url = `https://firmware.api.koiosdigital.net/mirror/${encodeURIComponent(
    selectedVariant.value
  )}`;
  const res = await fetch(url);

  // get binary string from response body
  const firmware = await res.blob();
  const reader = new FileReader();

  reader.onload = async function (evt) {
    //get file data
    const fileData = evt.target!.result;
    if (!fileData || !loader) {
      return;
    }
    const fileString = fileData as ArrayBuffer;
    const str = new Uint8Array(fileString).toString();

    const flashOptions = {
      fileArray: [{ address: 0, data: str }],
      flashSize: "keep",
      eraseAll: false,
      compress: true,
      reportProgress: (file, written, total) => {
        flashingProgress.value = (written / total) * 100;
      },
    } as FlashOptions;

    await loader.writeFlash(flashOptions);
    await loader.after();
    connectKDConsole();

    flashingState.value = FlashingState.FLASHED;
  };

  reader.readAsArrayBuffer(firmware);
};

const disconnect = async () => {
  await transport?.disconnect();
  transport = undefined;

  if (port) {
    try {
      await port.close();
    } catch {
      //ignore
    }
    port = undefined;
  }

  if (consoleInterval) {
    clearInterval(consoleInterval);
    consoleInterval = undefined;
  }

  serialState.value = SerialState.DISCONNECTED;
  flashingState.value = FlashingState.NOT_FLASHED;
  flashingProgress.value = 0;
  cryptoStatus.value = 0;
  signingCSR.value = false;
  buffer = new Uint8Array(0);
  reader = undefined;
};

const reset = async () => {
  if (transport) {
    cryptoStatus.value = 0;
    flashingState.value = FlashingState.NOT_FLASHED;
    signingCSR.value = false;
    buffer = new Uint8Array(0);
    await transport.setRTS(true);
    await new Promise((resolve) => setTimeout(resolve, 100));
    await transport.setRTS(false);
  }
};

let searchLoop: ReturnType<typeof setInterval> | undefined = undefined;

const startSearch = () => {
  if (searchLoop) {
    clearInterval(searchLoop);
  }
  searchLoop = setInterval(async () => {
    const ports = await navigator.serial.getPorts();
    for (const p of ports) {
      if (p.getInfo().usbVendorId === 0x303a) {
        port = p;
        clearInterval(searchLoop);
        await connect();
        break;
      }
    }
  }, 1000);
};

onMounted(async () => {
  if (import.meta.client) {
    startSearch();

    navigator.serial.ondisconnect = () => {
      disconnect();
    };
  }
});
</script>
