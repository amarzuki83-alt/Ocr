import React, { useState } from 'react';
import { 
  Bluetooth, 
  Printer, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  RefreshCw, 
  HelpCircle, 
  X, 
  Power,
  Zap,
  Sliders
} from 'lucide-react';
import { 
  BLUETOOTH_PRINTER_SERVICES, 
  buildEscPosBuffer, 
  buildTestPrintBuffer, 
  sendBufferToCharacteristic 
} from '../utils/escpos';
import { ReceiptData, PaperSize, BluetoothPrinterState } from '../types';

interface BluetoothModalProps {
  isOpen: boolean;
  onClose: () => void;
  receiptData: ReceiptData;
  paperSize: PaperSize;
  onPaperSizeChange: (size: PaperSize) => void;
  printerState: BluetoothPrinterState;
  setPrinterState: React.Dispatch<React.SetStateAction<BluetoothPrinterState>>;
}

export const BluetoothModal: React.FC<BluetoothModalProps> = ({
  isOpen,
  onClose,
  receiptData,
  paperSize,
  onPaperSizeChange,
  printerState,
  setPrinterState,
}) => {
  const [printStatus, setPrintStatus] = useState<string | null>(null);
  const [printProgress, setPrintProgress] = useState<number>(0);
  const [isPrinting, setIsPrinting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showGuide, setShowGuide] = useState<boolean>(false);

  if (!isOpen) return null;

  const isBluetoothSupported = typeof navigator !== 'undefined' && 'bluetooth' in navigator;

  // Connect to Bluetooth Thermal Printer
  const handleConnect = async () => {
    if (!isBluetoothSupported) {
      setErrorMsg('Browser Anda tidak mendukung Web Bluetooth API. Silakan gunakan Google Chrome di Android atau PC dengan koneksi HTTPS.');
      return;
    }

    setErrorMsg(null);
    setPrinterState((prev) => ({
      ...prev,
      isConnecting: true,
      statusMessage: 'Mencari perangkat Bluetooth di sekitar...',
    }));

    try {
      // Standard Web Bluetooth device request with printer services or acceptAllDevices
      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: BLUETOOTH_PRINTER_SERVICES,
      });

      setPrinterState((prev) => ({
        ...prev,
        device,
        deviceName: device.name || 'Printer Thermal (Unknown)',
        statusMessage: 'Menghubungkan ke GATT Server printer...',
      }));

      // Listen for disconnection
      device.addEventListener('gattserverdisconnected', () => {
        setPrinterState({
          device: null,
          server: null,
          characteristic: null,
          deviceName: null,
          isConnected: false,
          isConnecting: false,
          statusMessage: 'Koneksi printer terputus.',
        });
      });

      if (!device.gatt) {
        throw new Error('GATT Server tidak ditemukan pada perangkat.');
      }

      const server = await device.gatt.connect();

      // Find the primary service and characteristic for writing ESC/POS
      let targetCharacteristic: BluetoothRemoteGATTCharacteristic | null = null;

      // Try discovering known printer services
      for (const serviceUuid of BLUETOOTH_PRINTER_SERVICES) {
        try {
          const service = await server.getPrimaryService(serviceUuid);
          const characteristics = await service.getCharacteristics();
          // Find writable characteristic
          for (const char of characteristics) {
            if (char.properties.write || char.properties.writeWithoutResponse) {
              targetCharacteristic = char;
              break;
            }
          }
          if (targetCharacteristic) break;
        } catch (e) {
          // Continue searching other services
        }
      }

      // If specific UUID not matched, discover any primary services
      if (!targetCharacteristic) {
        const services = await server.getPrimaryServices();
        for (const service of services) {
          const chars = await service.getCharacteristics();
          for (const char of chars) {
            if (char.properties.write || char.properties.writeWithoutResponse) {
              targetCharacteristic = char;
              break;
            }
          }
          if (targetCharacteristic) break;
        }
      }

      if (!targetCharacteristic) {
        throw new Error('Tidak dapat menemukan characteristic data write ESC/POS pada printer ini.');
      }

      setPrinterState({
        device,
        server,
        characteristic: targetCharacteristic,
        deviceName: device.name || 'Printer Thermal Bluetooth',
        isConnected: true,
        isConnecting: false,
        statusMessage: 'Terhubung ke ' + (device.name || 'Printer'),
      });
    } catch (err: any) {
      console.error('Bluetooth connection error:', err);
      if (err.name !== 'NotFoundError') {
        setErrorMsg(err.message || 'Gagal menyambungkan ke printer Bluetooth.');
      }
      setPrinterState((prev) => ({
        ...prev,
        isConnecting: false,
        statusMessage: 'Gagal terhubung atau dibatalkan pengguna.',
      }));
    }
  };

  // Disconnect printer
  const handleDisconnect = () => {
    if (printerState.device && printerState.device.gatt?.connected) {
      printerState.device.gatt.disconnect();
    }
    setPrinterState({
      device: null,
      server: null,
      characteristic: null,
      deviceName: null,
      isConnected: false,
      isConnecting: false,
      statusMessage: 'Printer terputus.',
    });
  };

  // Print Test Page
  const handleTestPrint = async () => {
    if (!printerState.characteristic) {
      setErrorMsg('Sambungkan printer Bluetooth terlebih dahulu.');
      return;
    }

    try {
      setIsPrinting(true);
      setPrintStatus('Mengirim perintah test print...');
      const buffer = buildTestPrintBuffer();
      await sendBufferToCharacteristic(printerState.characteristic, buffer, setPrintProgress);
      setPrintStatus('Test print berhasil terkirim!');
      setTimeout(() => {
        setIsPrinting(false);
        setPrintStatus(null);
      }, 2000);
    } catch (err: any) {
      console.error('Print error:', err);
      setErrorMsg('Gagal mencetak: ' + (err.message || 'Printer tidak merespon'));
      setIsPrinting(false);
      setPrintStatus(null);
    }
  };

  // Print Receipt
  const handlePrintReceipt = async () => {
    if (!printerState.characteristic) {
      setErrorMsg('Sambungkan printer Bluetooth terlebih dahulu.');
      return;
    }

    try {
      setIsPrinting(true);
      setPrintStatus('Mengirim data struk ke printer thermal...');
      const buffer = buildEscPosBuffer(receiptData, paperSize);
      await sendBufferToCharacteristic(printerState.characteristic, buffer, setPrintProgress);
      setPrintStatus('Struk berhasil dicetak!');
      setTimeout(() => {
        setIsPrinting(false);
        setPrintStatus(null);
      }, 2500);
    } catch (err: any) {
      console.error('Print receipt error:', err);
      setErrorMsg('Gagal mencetak struk: ' + (err.message || 'Koneksi printer terputus'));
      setIsPrinting(false);
      setPrintStatus(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-lg rounded-2xl shadow-2xl p-5 sm:p-6 text-white space-y-5 animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-cyan-500/10 text-cyan-400 rounded-xl border border-cyan-500/20">
              <Bluetooth className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base sm:text-lg">Koneksi Printer Bluetooth Thermal</h3>
              <p className="text-xs text-slate-400">Protokol ESC/POS (58mm & 80mm)</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Compatibility Check */}
        {!isBluetoothSupported && (
          <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300 text-xs flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block">Web Bluetooth Tidak Didukung</span>
              <span>
                Fitur ini memerlukan browser dengan Web Bluetooth API (Google Chrome di Android atau Desktop).
                Jika menggunakan iPhone atau browser lain, Anda tetap dapat mencetak via tombol <strong>Print / PDF</strong> biasa.
              </span>
            </div>
          </div>
        )}

        {/* Device Status Box */}
        <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Status Printer</span>
            {printerState.isConnected ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold bg-emerald-500/20 text-emerald-300 rounded-full border border-emerald-500/30">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                Terhubung
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold bg-slate-700/80 text-slate-300 rounded-full">
                <XCircle className="w-3.5 h-3.5 text-slate-400" />
                Belum Terhubung
              </span>
            )}
          </div>

          <div className="flex items-center justify-between text-sm pt-1">
            <span className="text-slate-400 text-xs">Perangkat:</span>
            <span className="font-semibold text-white">
              {printerState.deviceName || 'Belum ada printer dipilih'}
            </span>
          </div>

          {printerState.statusMessage && (
            <p className="text-xs text-cyan-400 font-mono">
              {printerState.statusMessage}
            </p>
          )}

          {/* Connect / Disconnect Buttons */}
          <div className="pt-2 flex gap-2">
            {!printerState.isConnected ? (
              <button
                type="button"
                onClick={handleConnect}
                disabled={printerState.isConnecting || !isBluetoothSupported}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs sm:text-sm rounded-xl shadow-lg transition disabled:opacity-50 active:scale-95"
              >
                {printerState.isConnecting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Mencari Printer...</span>
                  </>
                ) : (
                  <>
                    <Bluetooth className="w-4 h-4" />
                    <span>Cari & Sambungkan Printer</span>
                  </>
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleDisconnect}
                className="flex-1 flex items-center justify-center gap-2 py-2 px-4 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 font-semibold text-xs sm:text-sm rounded-xl transition active:scale-95"
              >
                <Power className="w-4 h-4" />
                <span>Putus Koneksi</span>
              </button>
            )}
          </div>
        </div>

        {/* Paper Size Setting */}
        <div className="flex items-center justify-between bg-slate-800/60 p-3 rounded-xl border border-slate-700/60 text-xs">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-cyan-400" />
            <span className="font-medium text-slate-300">Ukuran Kertas Thermal:</span>
          </div>
          <div className="flex bg-slate-900 rounded-lg p-0.5 border border-slate-700">
            <button
              type="button"
              onClick={() => onPaperSizeChange('58mm')}
              className={`px-3 py-1 font-semibold rounded-md transition ${
                paperSize === '58mm' ? 'bg-cyan-600 text-white' : 'text-slate-400'
              }`}
            >
              58 mm
            </button>
            <button
              type="button"
              onClick={() => onPaperSizeChange('80mm')}
              className={`px-3 py-1 font-semibold rounded-md transition ${
                paperSize === '80mm' ? 'bg-cyan-600 text-white' : 'text-slate-400'
              }`}
            >
              80 mm
            </button>
          </div>
        </div>

        {/* Error notification */}
        {errorMsg && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Print Progress bar */}
        {isPrinting && (
          <div className="space-y-1.5 p-3 bg-cyan-950/40 border border-cyan-800/40 rounded-xl">
            <div className="flex justify-between text-xs text-cyan-300">
              <span>{printStatus}</span>
              <span className="font-bold">{printProgress}%</span>
            </div>
            <div className="w-full bg-slate-700 rounded-full h-2 overflow-hidden">
              <div
                className="bg-cyan-400 h-2 rounded-full transition-all duration-150"
                style={{ width: `${printProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Print Action Buttons */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          <button
            type="button"
            onClick={handleTestPrint}
            disabled={!printerState.isConnected || isPrinting}
            className="flex items-center justify-center gap-1.5 py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-medium text-xs sm:text-sm rounded-xl transition disabled:opacity-40 active:scale-95"
          >
            <Zap className="w-4 h-4 text-amber-400" />
            <span>Test Print Kertas</span>
          </button>

          <button
            type="button"
            onClick={handlePrintReceipt}
            disabled={!printerState.isConnected || isPrinting}
            className="flex items-center justify-center gap-1.5 py-2.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm rounded-xl shadow-lg shadow-emerald-900/30 transition disabled:opacity-40 active:scale-95"
          >
            <Printer className="w-4 h-4" />
            <span>Cetak Struk Ini</span>
          </button>
        </div>

        {/* Bluetooth Pairing Guide Toggle */}
        <div className="border-t border-slate-800 pt-3">
          <button
            type="button"
            onClick={() => setShowGuide(!showGuide)}
            className="flex items-center justify-between w-full text-xs text-slate-400 hover:text-cyan-400 transition"
          >
            <span className="flex items-center gap-1.5">
              <HelpCircle className="w-3.5 h-3.5" />
              <span>Petunjuk & Panduan Pairing Printer Bluetooth Android</span>
            </span>
            <span className="font-bold">{showGuide ? '▲ Tutup' : '▼ Lihat'}</span>
          </button>

          {showGuide && (
            <div className="mt-3 bg-slate-950 p-3.5 rounded-xl border border-slate-800 text-xs text-slate-300 space-y-2">
              <p className="font-semibold text-white">Langkah Menghubungkan di HP Android:</p>
              <ol className="list-decimal list-inside space-y-1 text-slate-400">
                <li>Nyalakan Printer Thermal Bluetooth dan pastikan kertas roll sudah terpasang.</li>
                <li>Buka <strong>Pengaturan Bluetooth</strong> di Android Anda, cari perangkat (biasanya bernama RPP02N, POS-58, PT-210, atau MPT-II).</li>
                <li>Lakukan pairing dengan PIN default (biasanya <strong>0000</strong> atau <strong>1234</strong>).</li>
                <li>Pastikan <strong>Lokasi (GPS)</strong> aktif di HP Android (kebijakan keamanan Android untuk scan Bluetooth).</li>
                <li>Kembali ke aplikasi ini dan klik tombol <strong>"Cari & Sambungkan Printer"</strong>, pilih printer Anda dari daftar pop-up Chrome.</li>
              </ol>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
