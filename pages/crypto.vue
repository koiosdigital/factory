<template>
  <UContainer>
    <UPageHeader title="Crypto" />
    <UPageCard>
      <div class="flex items-center justify-start gap-4">
        <UButton
          :disabled="state !== SerialState.DISCONNECTED"
          @click="connect"
        >
          Connect
        </UButton>
      </div>

      <div v-if="state === SerialState.DISCONNECTED">
        <UAlert
          color="neutral"
          title="Waiting"
          icon="lucide:info"
          description="Please connect a device."
        />
      </div>

      <div v-else-if="state === SerialState.CONNECTING">
        <UAlert
          color="neutral"
          title="Connecting"
          icon="lucide:info"
          description="Please wait for the connection to be established."
        />
      </div>

      <div
        v-else-if="state === SerialState.CONNECTED"
        class="flex flex-col gap-4"
      >
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

            <UBadge
              :color="
                cryptoStatus >= CryptoState.VALID_CSR ? 'success' : 'error'
              "
              size="sm"
            >
              Has CSR:
              {{ cryptoStatus >= CryptoState.VALID_CSR ? "Yes" : "No" }}
            </UBadge>

            <UBadge
              :color="
                cryptoStatus >= CryptoState.VALID_CERT ? 'success' : 'error'
              "
              size="sm"
            >
              Has Device Certificate:
              {{ cryptoStatus >= CryptoState.VALID_CERT ? "Yes" : "No" }}
            </UBadge>

            <UBadge :color="kdConsoleReady ? 'success' : 'warning'" size="sm">
              KD Console: {{ kdConsoleReady ? "Ready" : "Not Ready" }}
            </UBadge>
          </div>

          <div class="flex items-center gap-4">
            <UButton
              :disabled="state !== SerialState.CONNECTED"
              color="warning"
              @click="reset"
            >
              Reset
            </UButton>
            <UButton
              :disabled="state !== SerialState.CONNECTED"
              color="error"
              @click="disconnect"
            >
              Disconnect
            </UButton>
          </div>
        </div>

        <USeparator />

        <div v-if="cryptoStatus === CryptoState.KEY_GENERATED">
          <p class="text-gray-300">
            Please wait for the key generation to finish. This may take a few
            minutes.
          </p>
        </div>

        <div v-if="cryptoStatus === CryptoState.VALID_CSR">
          <UButton :disabled="signingCSR" @click="signCSR">
            Generate Certificate
          </UButton>
          <p v-if="signingCSR" class="text-gray-300">
            Please wait for the CSR to be signed. This may take a few seconds.
          </p>
        </div>

        <div v-if="cryptoStatus === CryptoState.VALID_CERT">
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
import { SerialState, CryptoState } from "~/types/programmer";
import { useCryptoStore } from "~/stores/crypto";

const crypto = useCryptoStore();

const port = computed(() => crypto.port);
const state = computed(() => crypto.serialConnectionState);
const kdConsoleReady = computed(() => crypto.kdConsoleReady);
const signingCSR = computed(() => crypto.signingCSR);
const cryptoStatus = computed(() => crypto.cryptoState);

const connect = () => crypto.connect();
const disconnect = () => crypto.disconnect();
const reset = () => crypto.resetChip();
const signCSR = () => crypto.generateCertificate();

onBeforeUnmount(() => {
  void crypto.disconnect();
});
</script>
