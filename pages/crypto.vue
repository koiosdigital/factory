<template>
  <UContainer>
    <UPageHeader title="Crypto" />
    <UPageCard>
      <div class="flex items-center justify-start gap-4">
        <UButton @click="connect" :disabled="state !== State.DISCONNECTED">
          Connect
        </UButton>
      </div>
      <div v-if="state === State.DISCONNECTED">
        <UAlert
          color="neutral"
          title="Waiting"
          icon="lucide:info"
          description="Please connect a device."
        />
      </div>
      <div v-else-if="state === State.CONNECTING">
        <UAlert
          color="neutral"
          title="Connecting"
          icon="lucide:info"
          description="Please wait for the connection to be established."
        />
      </div>
      <div v-else-if="state === State.CONNECTED" class="flex flex-col gap-4">
        <UAlert
          color="success"
          title="Connected"
          icon="lucide:check"
          description="You are connected to the device."
        />
        <USeparator />
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
            <UBadge :color="kdConsoleReady ? 'success' : 'warning'" size="sm">
              KD Console: {{ kdConsoleReady ? "Ready" : "Not Ready" }}
            </UBadge>
          </div>
          <div class="flex items-center gap-4">
            <UButton
              @click="reset"
              :disabled="state !== State.CONNECTED"
              color="warning"
            >
              Reset
            </UButton>
            <UButton
              @click="disconnect"
              :disabled="state !== State.CONNECTED"
              color="error"
            >
              Disconnect
            </UButton>
          </div>
        </div>
        <USeparator />
        <div v-if="cryptoStatus === 1">
          <p class="text-gray-300">
            Please wait for the key generation to finish. This may take a few
            minutes.
          </p>
        </div>
        <div v-if="cryptoStatus === 2">
          <UButton @click="signCSR" :disabled="signingCSR"
            >Generate Certificate</UButton
          >
          <p class="text-gray-300" v-if="signingCSR">
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
    </UPageCard>
  </UContainer>
</template>

<script setup lang="ts">
import { Transport } from "esptool-js";

const { user } = useOidcAuth();

enum State {
  DISCONNECTED,
  CONNECTING,
  CONNECTED,
}

const port = ref<SerialPort | undefined>(undefined);
const transport = ref<Transport | undefined>(undefined);
const state = ref<State>(State.DISCONNECTED);
const consoleInterval = ref<ReturnType<typeof setInterval> | undefined>(
  undefined
);
const signingCSR = ref(false);
const kdConsoleReady = ref(false);
const cryptoStatus = ref(0);
const cryptoStatusStr = computed(() => {
  switch (cryptoStatus.value) {
    case 0:
      return "Not Initialized";
    case 1:
      return "Key Generated";
    case 2:
      return "Valid CSR";
    case 3:
      return "Valid Device Certificate";
    default:
      return "Error (bad DS?)";
  }
});

let reader: AsyncGenerator<Uint8Array> | undefined = undefined;
let buffer = new Uint8Array(0);

const handleLine = async (line: string) => {
  console.log(line);
  if (line.includes("tty>") && !kdConsoleReady.value) {
    kdConsoleReady.value = true;
  }
  if (line.includes("tty>") && kdConsoleReady.value) {
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

          console.log("Device certificate:", base64);

          const commandChunks = [];
          const chunkSize = 64;
          const command = `set_device_cert ${base64}\n`;

          for (let i = 0; i < command.length; i += chunkSize) {
            commandChunks.push(command.slice(i, i + chunkSize));
          }

          console.log("Sending command chunks:", commandChunks);

          for (const chunk of commandChunks) {
            const commandBuffer = new TextEncoder().encode(chunk);
            await transport.value?.write(commandBuffer);
            await new Promise((resolve) => setTimeout(resolve, 100));
          }
        };

        signingCSR.value = false;
        cryptoStatus.value = 0;
      }
    }
  } catch {
    console.error("Failed to parse line:", line);
  }
};

const signCSR = async () => {
  if (transport.value) {
    signingCSR.value = true;
    const command = "get_csr\n";
    const commandBuffer = new TextEncoder().encode(command);
    await transport.value.write(commandBuffer);
  }
};

const consoleLoop = async () => {
  if (transport.value && reader) {
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
    if (kdConsoleReady.value && cryptoStatus.value < 2) {
      const command = "crypto_status\n";
      const commandBuffer = new TextEncoder().encode(command);
      await transport.value.write(commandBuffer);
    }
  }
};

const connect = async () => {
  port.value = await navigator.serial.requestPort({
    filters: [{ usbVendorId: 0x303a }],
  });
  state.value = State.CONNECTING;

  transport.value = new Transport(port.value, false);
  await transport.value.connect();
  await transport.value.setRTS(true);
  await new Promise((resolve) => setTimeout(resolve, 100));
  await transport.value.setRTS(false);

  consoleInterval.value = setInterval(() => {
    consoleLoop();
  }, 100);
  reader = transport.value.rawRead();

  state.value = State.CONNECTED;
};

const disconnect = async () => {
  if (port.value) {
    await transport.value?.disconnect();
    transport.value = undefined;
    port.value = undefined;
  }

  if (consoleInterval.value) {
    clearInterval(consoleInterval.value);
    consoleInterval.value = undefined;
  }
  state.value = State.DISCONNECTED;
  kdConsoleReady.value = false;
  cryptoStatus.value = 0;
  signingCSR.value = false;
  buffer = new Uint8Array(0);
  reader = undefined;
};

const reset = async () => {
  if (transport.value) {
    kdConsoleReady.value = false;
    cryptoStatus.value = 0;
    signingCSR.value = false;
    buffer = new Uint8Array(0);
    await transport.value.setRTS(true);
    await new Promise((resolve) => setTimeout(resolve, 100));
    await transport.value.setRTS(false);
  }
};
</script>
