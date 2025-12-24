const matchedVendorIds = [
    0x303a, // Espressif
];

export type SerialPortFilter = {
    usbVendorId?: number;
    usbProductId?: number;
};

export const getMatchedVendorIds = () => matchedVendorIds.slice();

export const buildVendorFilters = (): SerialPortFilter[] =>
    matchedVendorIds.map((usbVendorId) => ({ usbVendorId }));

export const findFirstAuthorizedMatchingPort = async (): Promise<SerialPort | null> => {
    if (!import.meta.client) return null;

    const ports = await navigator.serial.getPorts();
    for (const port of ports) {
        const info = port.getInfo();
        if (info.usbVendorId && matchedVendorIds.includes(info.usbVendorId)) {
            return port;
        }
    }
    return null;
};

export const requestMatchingPort = async (): Promise<SerialPort> => {
    if (!import.meta.client) {
        throw new Error("Serial is only available in the browser");
    }

    return navigator.serial.requestPort({
        filters: buildVendorFilters(),
    });
};
