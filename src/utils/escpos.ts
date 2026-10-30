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
 * Detects if the receipt is for BPJS Kesehatan / Ketenagakerjaan
 */
export function isBpjsReceipt(data: ReceiptData): boolean {
  const header = (data.headerTitle || '').toUpperCase();
  const sub = (data.subHeader || '').toUpperCase();
  const hasBpjsExtra = (data.extraFields || []).some((f) => 
    /BPJS|POLIS|PESERTA/i.test(f.label) || /bpjs|polis|peserta/i.test(f.id)
  );
  return Boolean(
    header.includes('BPJS') ||
    sub.includes('BPJS') ||
    Boolean(data.noPolis) ||
    Boolean(data.jmlPeserta) ||
    hasBpjsExtra
  );
}

/**
 * Detects if the receipt is for PLN Token Listrik (Prabayar)
 */
export function isTokenReceipt(data: ReceiptData): boolean {
  const header = (data.headerTitle || '').toUpperCase();
  const sub = (data.subHeader || '').toUpperCase();
  const hasTokenExtra = (data.extraFields || []).some((f) => 
    /TOKEN|STROOM/i.test(f.label) || /token/i.test(f.id)
  );
  return Boolean(
    (data.stroomToken && data.stroomToken.trim().length > 0) ||
    header.includes('TOKEN') ||
    header.includes('PRABAYAR') ||
    header.includes('PREPAID') ||
    sub.includes('TOKEN') ||
    hasTokenExtra
  );
}

/**
 * Retrieves the 20-digit token string from dedicated field or extraFields
 */
export function getStroomToken(data: ReceiptData): string {
  if (data.stroomToken && data.stroomToken.trim()) {
    return data.stroomToken.trim();
  }
  const found = (data.extraFields || []).find((f) => 
    /TOKEN|STROOM/i.test(f.label) || /token/i.test(f.id)
  );
  return found ? found.value.trim() : '';
}

/**
 * Retrieves the kWh string from dedicated field or extraFields
 */
export function getReceiptKwh(data: ReceiptData): string {
  if (data.kwh && data.kwh.trim()) {
    return data.kwh.trim();
  }
  const found = (data.extraFields || []).find((f) => 
    /KWH/i.test(f.label) || /kwh/i.test(f.id)
  );
  return found ? found.value.trim() : '';
}

/**
 * Calculates accurate kWh based on official PLN Tariffs:
 * Official PLN system internally applies regional lighting tax (PPJ/PBJT)
 * yielding net energy token value:
 * - Pembelian Rp 100.000 pada tarif R1/1300 VA resmi PLN mendapatkan 67,3 kWh.
 * - R1/450 VA Bersubsidi: Rp 415 / kWh
 * - R1/900 VA Bersubsidi: Rp 605 / kWh
 * - R1M/900 VA Non-Subsidi: Rp 1.352 / kWh
 * - R1/1300 VA & R1/2200 VA: Rp 1.444,70 / kWh
 * - R2/3500-5500 VA & R3: Rp 1.699,53 / kWh
 * - B1/450-900 VA: Rp 435 / Rp 630 / kWh
 */
export function calculateKwh(nominal: number, tarifDaya: string): string {
  if (!nominal || nominal <= 0) return '0,0 kWh';
  
  const upper = (tarifDaya || '').toUpperCase();
  let rate = 1444.70; // Standard default (R1/1300 VA, R1/2200 VA)

  if (upper.includes('450')) {
    rate = 415;
  } else if (upper.includes('900')) {
    if (upper.includes('R1M') || upper.includes('NON') || upper.includes('RTM') || upper.includes('M')) {
      rate = 1352;
    } else {
      rate = 605;
    }
  } else if (upper.includes('1300') || upper.includes('2200')) {
    rate = 1444.70;
  } else if (upper.includes('3500') || upper.includes('4400') || upper.includes('5500') || upper.includes('6600')) {
    rate = 1699.53;
  }

  // Official PLN net factor: deducts regional PPJ so Rp 100.000 yields exactly 67,3 kWh on 1300 VA
  const plnNetFactor = 0.9722831;
  const netNominal = nominal * plnNetFactor;
  const kwh = netNominal / rate;
  
  // Format with Indonesian comma, e.g. "67,3 kWh"
  const formatted = kwh.toFixed(1).replace('.', ',');
  return `${formatted} kWh`;
}

/**
 * Formats a 20-digit token into standard 5x4 blocks (XXXX-XXXX-XXXX-XXXX-XXXX)
 */
export function formatToken20(raw: string): string {
  if (!raw) return '';
  const digits = raw.replace(/[^0-9]/g, '');
  if (digits.length === 20) {
    return digits.match(/.{1,4}/g)!.join('-');
  }
  return raw;
}


/**
 * Format two columns with aligned colon separator for thermal printing and plain text
 * e.g., Left: "IDPEL", Right: "53201928301" -> "IDPEL       : 53201928301"
 */
export function formatTwoColumns(left: string, right: string, maxChars: number, colonPos?: number): string {
  const leftStr = left || '';
  const rightStr = right || '';
  const cPos = colonPos || (maxChars <= 32 ? 11 : 13);

  const paddedLeft = leftStr.padEnd(cPos, ' ');
  const prefix = `${paddedLeft}: `;

  if (prefix.length + rightStr.length <= maxChars) {
    return prefix + rightStr;
  }

  // If content exceeds width, truncate or fit
  return prefix + rightStr.substring(0, maxChars - prefix.length);
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

  // Header: Baris 1: Loket (LOKET PPOB ATHAR DIGITAL), Alamat, Baris 2: Judul
  lines.push(center(data.loket || 'LOKET PPOB ATHAR DIGITAL'));
  const alamatText = data.alamat || 'Jl. Raya Bapuhbandung Glagah';
  if (alamatText) lines.push(center(alamatText));
  if (data.headerTitle) lines.push(center(data.headerTitle));
  if (data.subHeader) lines.push(center(data.subHeader));
  lines.push(doubleDivider);

  // Core metadata
  if (data.tanggal) lines.push(formatTwoColumns('TANGGAL', data.tanggal, width));
  if (data.noRef) lines.push(formatTwoColumns('NO REF', data.noRef, width));

  // Customer info
  const isBpjs = isBpjsReceipt(data);
  const isToken = isTokenReceipt(data);
  const tokenValue = getStroomToken(data);
  const kwhValue = getReceiptKwh(data);

  if (isBpjs) {
    lines.push(formatTwoColumns('NO POLIS', data.noPolis || data.idPel || '-', width));
    if (data.nama) lines.push(formatTwoColumns('NAMA', data.nama, width));
    lines.push(formatTwoColumns('JML PESERTA', data.jmlPeserta || '1 ORANG', width));
    lines.push(formatTwoColumns('PERIODE', data.periode || data.blnThn || '-', width));
  } else {
    if (isToken || data.noMeter) {
      lines.push(formatTwoColumns('NO METER', data.noMeter || '-', width));
    }
    if (data.idPel) lines.push(formatTwoColumns(isToken ? 'IDPEL' : 'NO PELANGGAN', data.idPel, width));
    if (data.nama) lines.push(formatTwoColumns('NAMA', data.nama, width));
    if (data.tarifDaya) lines.push(formatTwoColumns('TARIF/DAYA', data.tarifDaya, width));

    // For Token Listrik: BLN/THN and STAND METER must be omitted
    if (!isToken) {
      if (data.blnThn) lines.push(formatTwoColumns('BLN/THN', data.blnThn, width));
      if (data.standMeter) lines.push(formatTwoColumns('STAND METER', data.standMeter, width));
    } else if (kwhValue) {
      lines.push(formatTwoColumns('JML KWH', kwhValue, width));
    }

    // STROOM / TOKEN Section for Token Listrik: ENLARGED & PROMINENT
    if (isToken && tokenValue) {
      lines.push(doubleDivider);
      lines.push(center('STROOM / TOKEN :'));
      lines.push(center(formatToken20(tokenValue)));
      lines.push(doubleDivider);
    }
  }

  // Extra fields (e.g. custom meter details)
  if (data.extraFields && data.extraFields.length > 0) {
    for (const f of data.extraFields) {
      if (f.label && f.value) {
        // Hilangkan PPJ, TOKEN, dan KWH dari extra fields jika token
        if (isToken && (/TOKEN|STROOM/i.test(f.label) || /token/i.test(f.id) || /PPJ/i.test(f.label) || /ppj/i.test(f.id) || /KWH/i.test(f.label) || /kwh/i.test(f.id))) {
          continue;
        }
        lines.push(formatTwoColumns(f.label.toUpperCase(), f.value, width));
      }
    }
  }

  // Financials: For Token Listrik, "RP TAG PLN" is changed to "RP BAYAR", for BPJS "RP TAGIHAN"
  const adminFee = data.adminBank !== undefined && data.adminBank > 0 ? data.adminBank : 5000;
  const total = data.totalBayar || ((data.tagihan || 0) + adminFee);
  const tagihanLabel = isToken ? 'RP BAYAR' : isBpjs ? 'RP TAGIHAN' : 'RP TAG PLN';
  lines.push(formatTwoColumns(tagihanLabel, formatRupiah(data.tagihan), width));
  lines.push(formatTwoColumns('ADMIN BANK', formatRupiah(adminFee), width));

  // Garis horisontal diatas total tagihan dimulai sejajar dengan titik :
  // (Lebar garis sebelah kanan titik dua)
  const leftColWidth = 14;
  const lineRightWidth = width - leftColWidth;
  lines.push(' '.repeat(leftColWidth) + '-'.repeat(lineRightWidth));

  lines.push(formatTwoColumns('TOTAL BAYAR', formatRupiah(total), width));

  // Footer
  const disclaimerStr = data.footerDisclaimer || 'Simpan struk ini sebagai bukti pembayaran yang sah';
  if (disclaimerStr) {
    // Wrap disclaimer text nicely
    const words = disclaimerStr.split(' ');
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
  // Baris 1: LOKET PPOB ATHAR DIGITAL
  addText((data.loket || 'LOKET PPOB ATHAR DIGITAL') + '\n');
  addBytes(ESC_POS.NORMAL_SIZE);
  addBytes(ESC_POS.BOLD_OFF);

  // Alamat di bawah nama loket (Bold / Lebih tebal)
  const alamatVal = data.alamat || 'Jl. Raya Bapuhbandung Glagah';
  if (alamatVal) {
    addBytes(ESC_POS.BOLD_ON);
    addText(alamatVal + '\n');
    addBytes(ESC_POS.BOLD_OFF);
  }

  // Baris 2: Judul Struk
  addBytes(ESC_POS.BOLD_ON);
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

  // 4. Customer Info
  const isBpjs = isBpjsReceipt(data);
  const isToken = isTokenReceipt(data);
  const tokenValue = getStroomToken(data);
  const kwhValue = getReceiptKwh(data);

  if (isBpjs) {
    addBytes(ESC_POS.BOLD_ON);
    addText(formatTwoColumns('NO POLIS', data.noPolis || data.idPel || '-', width) + '\n');
    addBytes(ESC_POS.BOLD_OFF);
    if (data.nama) addText(formatTwoColumns('NAMA', data.nama, width) + '\n');
    addText(formatTwoColumns('JML PESERTA', data.jmlPeserta || '1 ORANG', width) + '\n');
    addText(formatTwoColumns('PERIODE', data.periode || data.blnThn || '-', width) + '\n');
  } else {
    if (isToken || data.noMeter) {
      addBytes(ESC_POS.BOLD_ON);
      addText(formatTwoColumns('NO METER', data.noMeter || '-', width) + '\n');
      addBytes(ESC_POS.BOLD_OFF);
    }
    if (data.idPel) {
      addBytes(ESC_POS.BOLD_ON);
      addText(formatTwoColumns(isToken ? 'IDPEL' : 'IDPEL/NO PEL', data.idPel, width) + '\n');
      addBytes(ESC_POS.BOLD_OFF);
    }
    if (data.nama) addText(formatTwoColumns('NAMA', data.nama, width) + '\n');
    if (data.tarifDaya) addText(formatTwoColumns('TARIF/DAYA', data.tarifDaya, width) + '\n');

    // For Token Listrik: BLN/THN and STAND METER must be omitted
    if (!isToken) {
      if (data.blnThn) addText(formatTwoColumns('BLN/THN', data.blnThn, width) + '\n');
      if (data.standMeter) addText(formatTwoColumns('STAND METER', data.standMeter, width) + '\n');
    } else if (kwhValue) {
      addText(formatTwoColumns('JML KWH', kwhValue, width) + '\n');
    }

    // STROOM / TOKEN: ENLARGED FONT (DOUBLE HEIGHT + DOUBLE WIDTH) FOR THERMAL PRINTER
    if (isToken && tokenValue) {
      addText(doubleDivider);
      addBytes(ESC_POS.ALIGN_CENTER);
      addBytes(ESC_POS.BOLD_ON);
      addText('STROOM / TOKEN :\n');
      addBytes(ESC_POS.DOUBLE_HEIGHT);
      addBytes(ESC_POS.DOUBLE_WIDTH);
      addText(formatToken20(tokenValue) + '\n');
      addBytes(ESC_POS.NORMAL_SIZE);
      addBytes(ESC_POS.BOLD_OFF);
      addBytes(ESC_POS.ALIGN_LEFT);
      addText(doubleDivider);
    }
  }

  // Extra fields (e.g. custom meter details)
  if (data.extraFields && data.extraFields.length > 0) {
    for (const f of data.extraFields) {
      if (f.label && f.value) {
        // Hilangkan PPJ, TOKEN, dan KWH dari extra fields jika token
        if (isToken && (/TOKEN|STROOM/i.test(f.label) || /token/i.test(f.id) || /PPJ/i.test(f.label) || /ppj/i.test(f.id) || /KWH/i.test(f.label) || /kwh/i.test(f.id))) {
          continue;
        }
        addText(formatTwoColumns(f.label.toUpperCase(), f.value, width) + '\n');
      }
    }
  }

  // 5. Billing Info: For Token Listrik, "RP TAG PLN" is changed to "RP BAYAR", for BPJS "RP TAGIHAN"
  const escposAdminFee = data.adminBank !== undefined && data.adminBank > 0 ? data.adminBank : 5000;
  const escposTotal = data.totalBayar || ((data.tagihan || 0) + escposAdminFee);
  const escposTagihanLabel = isToken ? 'RP BAYAR' : isBpjs ? 'RP TAGIHAN' : 'RP TAG PLN';
  addText(formatTwoColumns(escposTagihanLabel, formatRupiah(data.tagihan), width) + '\n');
  addText(formatTwoColumns('ADMIN BANK', formatRupiah(escposAdminFee), width) + '\n');

  // Garis horisontal diatas total tagihan dimulai sejajar dengan titik :
  const escLeftColWidth = 14;
  const escLineRightWidth = width - escLeftColWidth;
  addText(' '.repeat(escLeftColWidth) + '-'.repeat(escLineRightWidth) + '\n');

  // Total Bayar (Bold, Larger)
  addBytes(ESC_POS.BOLD_ON);
  addText(formatTwoColumns('TOTAL BAYAR', formatRupiah(escposTotal), width) + '\n');
  addBytes(ESC_POS.BOLD_OFF);

  // 6. Disclaimer & Footer
  addBytes(ESC_POS.ALIGN_CENTER);
  const escDisclaimerStr = data.footerDisclaimer || 'Simpan struk ini sebagai bukti pembayaran yang sah';
  if (escDisclaimerStr) {
    const words = escDisclaimerStr.split(' ');
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
