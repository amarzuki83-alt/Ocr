import { ReceiptData } from '../types';

/**
 * Pre-processes image on an HTML5 canvas to boost Tesseract OCR accuracy:
 * - Grayscale conversion
 * - High contrast stretch & binarization thresholding
 */
export async function preprocessImageForOcr(imageFile: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(img.src);
          return;
        }

        // Cap maximum width/height to 2000px for speed and clarity
        let width = img.width;
        let height = img.height;
        const maxDim = 1800;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;

        // Draw original
        ctx.drawImage(img, 0, 0, width, height);

        // Get pixel data for contrast & grayscale processing
        const imgData = ctx.getImageData(0, 0, width, height);
        const data = imgData.data;

        // Convert to grayscale and apply contrast curve
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          // Luminance weights
          let gray = 0.299 * r + 0.587 * g + 0.114 * b;

          // Simple dynamic thresholding / contrast enhancement
          // Darken text, whiten background
          if (gray < 130) {
            gray = Math.max(0, gray * 0.7);
          } else {
            gray = Math.min(255, gray * 1.25);
          }

          data[i] = gray;
          data[i + 1] = gray;
          data[i + 2] = gray;
        }

        ctx.putImageData(imgData, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(imageFile);
  });
}

/**
 * Clean OCR numbers by removing dots, commas, and currency symbols
 */
export function parseCleanNumber(text: string): number {
  if (!text) return 0;
  // Handle Indonesian currency like 250.000 or 250,000 or Rp 250.000,00
  const clean = text
    .replace(/[^\d.,]/g, '')
    .replace(/(\.00|,00)$/, '') // Remove trailing cents
    .replace(/[,.]/g, ''); // Remove thousand separators
  const val = parseInt(clean, 10);
  return isNaN(val) ? 0 : val;
}

/**
 * Specialized Indonesian PLN & PPOB receipt regex parser
 */
export function parseReceiptFromOcr(ocrText: string): Partial<ReceiptData> {
  const text = ocrText || '';
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

  const parsed: Partial<ReceiptData> = {
    headerTitle: 'PEMBAYARAN TAGIHAN LISTRIK',
    footerDisclaimer: 'PLN menyatakan struk ini sbg bukti pembayaran yg sah. Info hub 123',
    footerGreeting: 'Terima Kasih Atas Pembayaran Anda',
  };

  // Header detection
  const hasPlnHeader = /PEMBAYARAN\s*TAGIHAN\s*LISTRIK|STRUK\s*PEMBAYARAN\s*PLN|PLN\s*POSTPAID/i.test(text);
  if (hasPlnHeader) {
    parsed.headerTitle = 'PEMBAYARAN TAGIHAN LISTRIK';
  } else if (/TOKEN\s*LISTRIK|PRABAYAR|PREPAID/i.test(text)) {
    parsed.headerTitle = 'STRUK PEMBELIAN TOKEN LISTRIK';
  } else if (/PDAM|AIR\s*MINUM/i.test(text)) {
    parsed.headerTitle = 'STRUK PEMBAYARAN TAGIHAN AIR PDAM';
  } else if (/BPJS/i.test(text)) {
    parsed.headerTitle = 'STRUK PEMBAYARAN IURAN BPJS';
  }

  // 1. Loket / Agen
  const loketMatch = text.match(/(?:LOKET|KASIR|AGEN|MERCHANT|MITRA)\s*[:.]?\s*([A-Za-z0-9\s\-_\.]+)/i);
  if (loketMatch && loketMatch[1]) {
    parsed.loket = loketMatch[1].trim().split('\n')[0].substring(0, 30);
  } else if (lines.length > 0 && /LOKET|KASIR|PAYMENT|PPOB/i.test(lines[0])) {
    parsed.loket = lines[0].substring(0, 30);
  }

  // 2. ID Pelanggan / IDPEL
  const idPelMatch = text.match(/(?:IDPEL|ID\s*PEL|NO\s*PEL|ID\s*PELANGGAN|NO\s*PELANGGAN|KONTRAK)\s*[:.]?\s*([0-9]{8,14})/i) ||
                     text.match(/\b(5\d{10,11})\b/); // Standard PLN postpaid 11-12 digits starting with 5
  if (idPelMatch && idPelMatch[1]) {
    parsed.idPel = idPelMatch[1].trim();
  }

  // 3. No Meter
  const noMeterMatch = text.match(/(?:NO\s*METER|NOMOR\s*METER|NO\.?\s*MTR|MTR)\s*[:.]?\s*([0-9]{8,14})/i);
  if (noMeterMatch && noMeterMatch[1]) {
    parsed.noMeter = noMeterMatch[1].trim();
  }

  // 4. Nama Pelanggan
  const namaMatch = text.match(/(?:NAMA|NAME|NAMA\s*PELANGGAN)\s*[:.]?\s*([A-Za-z\s\.\,\'\-]+)/i);
  if (namaMatch && namaMatch[1]) {
    const rawNama = namaMatch[1].trim().split('\n')[0];
    parsed.nama = rawNama.replace(/^(BAPAK|IBU|SDR|SDRI)\s+/i, '').substring(0, 28).trim();
  }

  // 5. Tarif / Daya
  const tarifDayaMatch = text.match(/(?:TARIF[\s/]*DAYA|TARIF|DAYA)\s*[:.]?\s*([A-Za-z0-9\s/]+(?:VA|WATT|VOLT)?)/i) ||
                         text.match(/\b([RBITM]\d{1,2}[\s/]*\d{3,5}\s*VA)\b/i);
  if (tarifDayaMatch && tarifDayaMatch[1]) {
    parsed.tarifDaya = tarifDayaMatch[1].trim().split('\n')[0].substring(0, 20);
  }

  // 6. Bln / Thn
  const blnThnMatch = text.match(/(?:BLN[\s/]*THN|BULAN[\s/]*TAHUN|PERIODE)\s*[:.]?\s*([A-Za-z0-9\s\/\-]+)/i);
  if (blnThnMatch && blnThnMatch[1]) {
    parsed.blnThn = blnThnMatch[1].trim().split('\n')[0].substring(0, 15);
  }

  // 7. Stand Meter
  const standMatch = text.match(/(?:STAND\s*METER|STAND|METER)\s*[:.]?\s*([0-9\s\-–]+)/i);
  if (standMatch && standMatch[1]) {
    parsed.standMeter = standMatch[1].trim().split('\n')[0].substring(0, 24);
  }

  // 8. Rp Tag PLN
  const tagihanMatch = text.match(/(?:RP\s*TAG\s*PLN|RP\s*TAGIHAN|TAGIHAN\s*PLN|JUMLAH\s*TAGIHAN|TAGIHAN)\s*[:.]?\s*RP?\.?\s*([\d\.,]+)/i);
  if (tagihanMatch && tagihanMatch[1]) {
    parsed.tagihan = parseCleanNumber(tagihanMatch[1]);
  }

  // 9. Admin Bank
  const adminMatch = text.match(/(?:ADMIN\s*BANK|BIAYA\s*ADMIN|BIAYA\s*BANK|ADMIN)\s*[:.]?\s*RP?\.?\s*([\d\.,]+)/i);
  if (adminMatch && adminMatch[1]) {
    parsed.adminBank = parseCleanNumber(adminMatch[1]);
  } else {
    parsed.adminBank = 3000; // standard default PPOB admin fee
  }

  // 10. Total Bayar
  const totalMatch = text.match(/(?:TOTAL\s*BAYAR|TOTAL\s*TAGIHAN|TOTAL)\s*[:.]?\s*RP?\.?\s*([\d\.,]+)/i);
  if (totalMatch && totalMatch[1]) {
    parsed.totalBayar = parseCleanNumber(totalMatch[1]);
  } else if (parsed.tagihan) {
    parsed.totalBayar = parsed.tagihan + (parsed.adminBank || 0);
  }

  // 11. Tanggal
  const tanggalMatch = text.match(/(?:TGL|TANGGAL|WAKTU|DATE)\s*[:.]?\s*([0-9]{1,2}[\/\-\.][0-9]{1,2}[\/\-\.][0-9]{2,4}(?:\s+[0-9]{1,2}:[0-9]{1,2}(?::[0-9]{1,2})?)?)/i) ||
                       text.match(/\b([0-9]{1,2}[\/\-][0-9]{1,2}[\/\-][0-9]{2,4}\s+[0-9]{1,2}:[0-9]{1,2}(?::[0-9]{1,2})?)\b/);
  if (tanggalMatch && tanggalMatch[1]) {
    parsed.tanggal = tanggalMatch[1].trim();
  } else {
    const now = new Date();
    const d = String(now.getDate()).padStart(2, '0');
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const y = now.getFullYear();
    const hr = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    parsed.tanggal = `${d}/${m}/${y} ${hr}:${min} WIB`;
  }

  // 12. No Referensi
  const refMatch = text.match(/(?:NO\s*REF|REF|STRUK|NO\s*STRUK|TRX\s*ID)\s*[:.]?\s*([A-Za-z0-9\-]+)/i);
  if (refMatch && refMatch[1]) {
    parsed.noRef = refMatch[1].trim().substring(0, 24);
  } else {
    parsed.noRef = 'PLN' + Date.now().toString().slice(-10);
  }

  return parsed;
}

/**
 * Ready-to-use presets so users can test live thermal preview and print instantly
 */
export const SAMPLE_PRESETS: Record<string, ReceiptData> = {
  plnPostpaid: {
    headerTitle: 'PEMBAYARAN TAGIHAN LISTRIK',
    subHeader: 'PLN DISTRIBUSI JAWA BARAT',
    loket: 'LOKET KASIR AMANAH JAYA',
    idPel: '537210984521',
    noMeter: '32019482019',
    nama: 'BAPAK SUTRISNO',
    tarifDaya: 'R1 / 900 VA',
    standMeter: '014280 - 014520 (240 kWh)',
    blnThn: 'OKT 2026',
    tagihan: 324500,
    adminBank: 3000,
    totalBayar: 327500,
    tanggal: '26/10/2026 18:45:10 WIB',
    noRef: 'PLN2610269874561230',
    footerDisclaimer: 'PLN menyatakan struk ini sbg bukti pembayaran yg sah. Info hub 123',
    footerGreeting: 'Terima Kasih Atas Pembayaran Anda',
    extraFields: [],
  },
  plnPrepaid: {
    headerTitle: 'STRUK PEMBELIAN TOKEN LISTRIK',
    subHeader: 'PLN PRABAYAR (PREPAID)',
    loket: 'LOKET KASIR AMANAH JAYA',
    idPel: '14238910452',
    noMeter: '32098716253',
    nama: 'HENDRA WIJAYA',
    tarifDaya: 'R1M / 1300 VA',
    standMeter: 'ANGSURAN: RP 0',
    blnThn: 'TOKEN 100 RIBU',
    tagihan: 100000,
    adminBank: 2500,
    totalBayar: 102500,
    tanggal: '26/10/2026 19:12:04 WIB',
    noRef: 'TOKEN261026884192',
    footerDisclaimer: 'PLN menyatakan struk ini sbg bukti pembayaran yg sah. Info hub 123',
    footerGreeting: 'Simpan Struk Ini Sebagai Bukti Sah',
    extraFields: [
      { id: 'token', label: 'STROOM/TOKEN', value: '3829-1928-4402-9182-3819' },
      { id: 'kwh', label: 'JML KWH', value: '68.2 kWh' },
      { id: 'ppj', label: 'PPJ 3%', value: 'Rp 2.912' },
    ],
  },
  pdam: {
    headerTitle: 'STRUK PEMBAYARAN AIR PDAM',
    subHeader: 'PERUMDA AIR MINUM TIRTA',
    loket: 'LOKET KASIR AMANAH JAYA',
    idPel: '0812948192',
    noMeter: 'MTR-88419',
    nama: 'HJ. SITI FATIMAH',
    tarifDaya: 'R2 / RUMAH TANGGA B',
    standMeter: '00321 - 00346 (25 m³)',
    blnThn: 'OKT 2026',
    tagihan: 145000,
    adminBank: 2500,
    totalBayar: 147500,
    tanggal: '26/10/2026 17:30:22 WIB',
    noRef: 'PDAM261026771029',
    footerDisclaimer: 'Struk ini adalah bukti pembayaran PDAM yang sah.',
    footerGreeting: 'Hemat Air Demi Kelestarian Lingkungan',
    extraFields: [
      { id: 'denda', label: 'DENDA', value: 'Rp 0' },
      { id: 'retribusi', label: 'RETRIBUSI SAMPAH', value: 'Rp 5.000' },
    ],
  },
};
