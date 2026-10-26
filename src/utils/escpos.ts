/**
 * ESC/POS Command Generator & Web Bluetooth Thermal Printer Integration
 * Specially designed for 58mm (32 chars/line) and 80mm (42-48 chars/line) thermal printers.
 */
import { ReceiptData, PaperSize } from '../types';

// Known Bluetooth Thermal Printer Service & Characteristic UUIDs
export const BLUETOOTH_PRINTER_SERVICES = [
  '000018f0-0000-1000-8000-00805f9b34fb', // Standard Printer Service
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2', // Popular Chinese Mini Thermal (PT-210, Goojprt, Panda)
  '49535343-fe7d-4ae5-8fa9-9fafd205e455', // ISSC / Microchip Transparent UART
  '0000ff00-0000-1000-8000-00805f9b34fb', // Generic POS service
  '0000ffe0-0000-1000-8000-00805f9b34fb', // HM-10 / CC2541 BLE UART
  '0000ae00-0000-1000-8000-00805f9b34fb', // Iware / Bella POS
  '0000fee7-0000-1000-8000-00805f9b34fb', // Tencent / WeChat POS
];

export const BLUETOOTH_PRINTER_CHARACTERISTICS = [
  '00002af1-0000-1000-8000-00805f9b34fb',
  'bef8d6c9-9c21-4c9e-b632-bd58c1009f9f',
  '49535343-8841-43f4-a8d4-ecbe34729bb3',
  '49535343-1e4d-4bd9-ba61-23c647249616',
  '0000ff01-0000-1000-8000-00805f9b34fb',
  '0000ff02-0000-1000-8000-00805f9b34fb',
  '0000ffe1-0000-1000-8000-00805f9b34fb',
  '0000ae01-0000-1000-8000-00805f9b34fb',
  '0000fee8-0000-1000-8000-00805f9b34fb',
];

export const ESC_POS = {
  INIT: [0x1B, 0x40], // ESC @ - Initialize
  ALIGN_LEFT: [0x1B, 0x61, 0x00],
  ALIGN_CENTER: [0x1B, 0x61, 0x01],
  ALIGN_RIGHT: [0x1B, 0x61, 0x02],
  BOLD_ON: [0x1B, 0x45, 0x01],
  BOLD_OFF: [0x1B, 0x45, 0x00],
  DOUBLE_HEIGHT: [0x1B, 0x21, 0x10],
  DOUBLE_WIDTH: [0x1B, 0x21, 0x20],
  DOUBLE_SIZE: [0x1D, 0x21, 0x11],
  NORMAL_SIZE: [0x1D, 0x21, 0x00],
  LINE_FEED: [0x0A],
  PAPER_CUT: [0x1D, 0x56, 0x41, 0x00], // GS V A 0 (cut)
};

export function formatRupiah(amount: number | string): string {
  const num = typeof amount === 'number' ? amount : parseInt(String(amount).replace(/[^0-9]/g, ''), 10) || 0;
  return 'Rp ' + num.toLocaleString('id-ID');
}

/**
 * Format two columns with exact width padding for thermal printing
 * e.g., Left: "NO PELANGGAN" Right: "53201928301" -> padded to width
 */
export function formatTwoColumns(left: string, right: string, maxChars: number): string {
  const leftStr = left || '';
  const rightStr = right || '';

  if (leftStr.length + rightStr.length >= maxChars) {
    const space = maxChars - rightStr.length;
    if (space > 3) {
      return leftStr.substring(0, space - 1) + ' ' + rightStr;
    }
    return leftStr + '\n' + rightStr.padStart(maxChars);
  }

  const spacesNeeded = maxChars - leftStr.length - rightStr.length;
  return leftStr + ' '.repeat(spacesNeeded) + rightStr;
}

/**
 * Creates plain text receipt suitable for copying or terminal preview
 */
export function generatePlainTextReceipt(data: ReceiptData, paperSize: PaperSize = '58mm'): string {
  const width = paperSize === '58mm' ? 32 : 42;
  const divider = '-'.repeat(width);
  const doubleDivider = '='.repeat(width);

  const lines: string[] = [];

  // Center helper
  const center = (text: string) => {
    const trimmed = text.trim();
    if (trimmed.length >= width) return trimmed;
    const pad = Math.floor((width - trimmed.length) / 2);
    return ' '.repeat(pad) + trimmed;
  };

  // Header: Baris 1: Loket (PPOB ATHAR DIGITAL), Baris 2: Judul (PEMBAYARAN TAGIHAN LISTRIK)
  if (data.loket) lines.push(center(data.loket));
  if (data.headerTitle) lines.push(center(data.headerTitle));
  if (data.subHeader) lines.push(center(data.subHeader));
  lines.push(doubleDivider);

  // Core metadata
  if (data.tanggal) lines.push(formatTwoColumns('TANGGAL', data.tanggal, width));
  if (data.noRef) lines.push(formatTwoColumns('NO REF', data.noRef, width));
  lines.push(divider);

  // Customer info
  if (data.idPel) lines.push(formatTwoColumns('NO PELANGGAN', data.idPel, width));
  if (data.noMeter) lines.push(formatTwoColumns('NO METER', data.noMeter, width));
  if (data.nama) lines.push(formatTwoColumns('NAMA', data.nama, width));
  if (data.tarifDaya) lines.push(formatTwoColumns('TARIF/DAYA', data.tarifDaya, width));
  if (data.blnThn) lines.push(formatTwoColumns('BLN/THN', data.blnThn, width));
  if (data.standMeter) lines.push(formatTwoColumns('STAND METER', data.standMeter, width));

  // Extra fields (e.g. Stroom token, custom meter details)
  if (data.extraFields && data.extraFields.length > 0) {
    for (const f of data.extraFields) {
      if (f.label && f.value) {
        lines.push(formatTwoColumns(f.label.toUpperCase(), f.value, width));
      }
    }
  }

  lines.push(divider);

  // Financials
  lines.push(formatTwoColumns('RP TAG PLN', formatRupiah(data.tagihan), width));
  lines.push(formatTwoColumns('ADMIN BANK', formatRupiah(data.adminBank), width));
  lines.push(doubleDivider);
  lines.push(formatTwoColumns('TOTAL BAYAR', formatRupiah(data.totalBayar), width));
  lines.push(doubleDivider);

  // Footer
  if (data.footerDisclaimer) {
    // Wrap disclaimer text nicely
    const words = data.footerDisclaimer.split(' ');
    let currentLine = '';
    for (const word of words) {
      if ((currentLine + ' ' + word).trim().length <= width) {
        currentLine = (currentLine + ' ' + word).trim();
      } else {
        lines.push(center(currentLine));
        currentLine = word;
      }
    }
    if (currentLine) lines.push(center(currentLine));
  }

  if (data.footerGreeting) {
    lines.push('');
    lines.push(center(data.footerGreeting));
  }

  return lines.join('\n');
}

/**
 * Builds binary ESC/POS buffer for sending to Bluetooth Thermal Printer
 */
export function buildEscPosBuffer(data: ReceiptData, paperSize: PaperSize = '58mm'): Uint8Array {
  const width = paperSize === '58mm' ? 32 : 42;
  const divider = '-'.repeat(width) + '\n';
  const doubleDivider = '='.repeat(width) + '\n';

  const encoder = new TextEncoder();
  const chunks: number[] = [];

  const addBytes = (bytes: number[]) => {
    for (let i = 0; i < bytes.length; i++) {
      chunks.push(bytes[i]);
    }
  };

  const addText = (text: string) => {
    const encoded = encoder.encode(text);
    for (let i = 0; i < encoded.length; i++) {
      chunks.push(encoded[i]);
    }
  };

  const centerText = (text: string) => {
    const trimmed = text.trim();
    if (trimmed.length >= width) return trimmed + '\n';
    const pad = Math.floor((width - trimmed.length) / 2);
    return ' '.repeat(pad) + trimmed + '\n';
  };

  // 1. Initialize Printer
  addBytes(ESC_POS.INIT);

  // 2. Header (Bold, Centered)
  addBytes(ESC_POS.ALIGN_CENTER);
  addBytes(ESC_POS.BOLD_ON);
  addBytes(ESC_POS.DOUBLE_HEIGHT);
  // Baris 1: PPOB ATHAR DIGITAL
  addText((data.loket || 'PPOB ATHAR DIGITAL') + '\n');
  addBytes(ESC_POS.NORMAL_SIZE);

  // Baris 2: PEMBAYARAN TAGIHAN LISTRIK
  if (data.headerTitle) {
    addText(data.headerTitle + '\n');
  }
  if (data.subHeader) {
    addText(data.subHeader + '\n');
  }
  addBytes(ESC_POS.BOLD_OFF);
  addText(doubleDivider);

  // 3. Metadata (Left Aligned)
  addBytes(ESC_POS.ALIGN_LEFT);
  if (data.tanggal) addText(formatTwoColumns('TANGGAL', data.tanggal, width) + '\n');
  if (data.noRef) addText(formatTwoColumns('NO REF', data.noRef, width) + '\n');
  addText(divider);

  // 4. Customer Info
  if (data.idPel) {
    addBytes(ESC_POS.BOLD_ON);
    addText(formatTwoColumns('IDPEL/NO PEL', data.idPel, width) + '\n');
    addBytes(ESC_POS.BOLD_OFF);
  }
  if (data.noMeter) addText(formatTwoColumns('NO METER', data.noMeter, width) + '\n');
  if (data.nama) addText(formatTwoColumns('NAMA', data.nama, width) + '\n');
  if (data.tarifDaya) addText(formatTwoColumns('TARIF/DAYA', data.tarifDaya, width) + '\n');
  if (data.blnThn) addText(formatTwoColumns('BLN/THN', data.blnThn, width) + '\n');
  if (data.standMeter) addText(formatTwoColumns('STAND METER', data.standMeter, width) + '\n');

  // Extra fields
  if (data.extraFields && data.extraFields.length > 0) {
    for (const f of data.extraFields) {
      if (f.label && f.value) {
        addText(formatTwoColumns(f.label.toUpperCase(), f.value, width) + '\n');
      }
    }
  }

  addText(divider);

  // 5. Billing Info
  addText(formatTwoColumns('RP TAG PLN', formatRupiah(data.tagihan), width) + '\n');
  addText(formatTwoColumns('ADMIN BANK', formatRupiah(data.adminBank), width) + '\n');
  addText(doubleDivider);

  // Total Bayar (Bold, Larger)
  addBytes(ESC_POS.BOLD_ON);
  addText(formatTwoColumns('TOTAL BAYAR', formatRupiah(data.totalBayar), width) + '\n');
  addBytes(ESC_POS.BOLD_OFF);
  addText(doubleDivider);

  // 6. Disclaimer & Footer
  addBytes(ESC_POS.ALIGN_CENTER);
  if (data.footerDisclaimer) {
    const words = data.footerDisclaimer.split(' ');
    let currentLine = '';
    for (const word of words) {
      if ((currentLine + ' ' + word).trim().length <= width) {
        currentLine = (currentLine + ' ' + word).trim();
      } else {
        addText(centerText(currentLine));
        currentLine = word;
      }
    }
    if (currentLine) addText(centerText(currentLine));
  }

  if (data.footerGreeting) {
    addText('\n' + centerText(data.footerGreeting));
  }

  // 7. Extra feeds and paper tear clearance
  addText('\n\n\n\n');
  addBytes(ESC_POS.PAPER_CUT);

  return new Uint8Array(chunks);
}

/**
 * Builds a simple test print receipt to verify thermal printer communication
 */
export function buildTestPrintBuffer(): Uint8Array {
  const encoder = new TextEncoder();
  const chunks: number[] = [];

  const addBytes = (bytes: number[]) => {
    for (let i = 0; i < bytes.length; i++) chunks.push(bytes[i]);
  };
  const addText = (text: string) => {
    const encoded = encoder.encode(text);
    for (let i = 0; i < encoded.length; i++) chunks.push(encoded[i]);
  };

  addBytes(ESC_POS.INIT);
  addBytes(ESC_POS.ALIGN_CENTER);
  addBytes(ESC_POS.BOLD_ON);
  addBytes(ESC_POS.DOUBLE_HEIGHT);
  addText('TEST CETAK BERHASIL\n');
  addBytes(ESC_POS.NORMAL_SIZE);
  addBytes(ESC_POS.BOLD_OFF);
  addText('================================\n');
  addText('Printer Thermal Bluetooth OK!\n');
  addText('StrukKilat PWA Online & Ready\n');
  addText('Waktu: ' + new Date().toLocaleTimeString('id-ID') + '\n');
  addText('================================\n');
  addText('Terima Kasih!\n\n\n\n');
  addBytes(ESC_POS.PAPER_CUT);

  return new Uint8Array(chunks);
}

/**
 * Sends ESC/POS byte buffer to Bluetooth GATT Characteristic in chunks
 * to avoid MTU buffer overflows on Android & Chrome.
 */
export async function sendBufferToCharacteristic(
  characteristic: BluetoothRemoteGATTCharacteristic,
  buffer: Uint8Array,
  onProgress?: (percent: number) => void
): Promise<void> {
  const CHUNK_SIZE = 64; // Safe chunk size for Bluetooth LE / SPP buffers
  const totalChunks = Math.ceil(buffer.length / CHUNK_SIZE);

  for (let i = 0; i < totalChunks; i++) {
    const start = i * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, buffer.length);
    const chunk = buffer.subarray(start, end);
    const chunkData = new Uint8Array(chunk).buffer as ArrayBuffer;

    // Try writeValueWithResponse, or fallback to writeValue
    if (characteristic.writeValueWithResponse) {
      await characteristic.writeValueWithResponse(chunkData);
    } else {
      await characteristic.writeValue(chunkData);
    }

    if (onProgress) {
      onProgress(Math.round(((i + 1) / totalChunks) * 100));
    }

    // Small delay between chunks to let printer buffer process
    await new Promise((resolve) => setTimeout(resolve, 35));
  }
}
