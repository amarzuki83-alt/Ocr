export interface ExtraReceiptField {
  id: string;
  label: string;
  value: string;
}

export interface ReceiptData {
  headerTitle: string;
  subHeader: string;
  loket: string;
  idPel: string;
  noMeter: string;
  nama: string;
  tarifDaya: string;
  standMeter: string;
  blnThn: string;
  tagihan: number;
  adminBank: number;
  totalBayar: number;
  tanggal: string;
  noRef: string;
  footerDisclaimer: string;
  footerGreeting: string;
  extraFields: ExtraReceiptField[];
  customNote?: string;
}

export type PaperSize = '58mm' | '80mm';

export interface BluetoothPrinterState {
  device: BluetoothDevice | null;
  server: BluetoothRemoteGATTServer | null;
  characteristic: BluetoothRemoteGATTCharacteristic | null;
  deviceName: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  statusMessage: string;
}

export interface OcrProgressState {
  isProcessing: boolean;
  progress: number; // 0 to 100
  status: string; // e.g., 'Mengunggah gambar...', 'Memproses OCR...', 'Menganalisis teks...'
}
