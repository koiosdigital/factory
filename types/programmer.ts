export enum SerialState {
    DISCONNECTED,
    CONNECTING,
    CONNECTED,
    KD_CONSOLE_READY,
}

export enum FirmwareFlashState {
    DETERMINING,
    NOT_FLASHED,
    FLASHING,
    FLASHED,
}

export enum CryptoState {
    UNINITIALIZED,
    KEY_GENERATED,
    VALID_CSR,
    VALID_CERT,
    BAD_DS
}

export enum AutoConnectResult {
    FAILED,
    NO_AUTHORIZED_PORTS,
    SUCCESS
}