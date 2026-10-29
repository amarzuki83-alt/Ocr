import React, { useRef, useState } from 'react';
import { ReceiptData, PaperSize } from '../types';
import { formatRupiah, isTokenReceipt, isBpjsReceipt, getStroomToken, formatToken20, getReceiptKwh } from '../utils/escpos';
import { generateReceiptCanvas, shareReceiptToWhatsApp } from '../utils/receiptCanvas';
import { 
  Copy, 
  Download, 
  Printer, 
  Check, 
  Sparkles, 
  Share2, 
  Send, 
  X,
  Phone
} from 'lucide-react';

interface ThermalReceiptProps {
  data: ReceiptData;
  paperSize: PaperSize;
  onPaperSizeChange: (size: PaperSize) => void;
  onBrowserPrint: () => void;
  onCopyText: () => void;
  isCopied: boolean;
  onToast?: (msg: string) => void;
}

export const ThermalReceipt: React.FC<ThermalReceiptProps> = ({
  data,
  paperSize,
  onPaperSizeChange,
  onBrowserPrint,
  onCopyText,
  isCopied,
  onToast,
}) => {
  const receiptRef = useRef<HTMLDivElement>(null);
  const [isSharingWa, setIsSharingWa] = useState(false);
  const [showWaModal, setShowWaModal] = useState(false);
  const [customerPhone, setCustomerPhone] = useState('');

  // Download thermal receipt as high-res PNG
  const handleDownloadImage = () => {
    try {
      const canvas = generateReceiptCanvas(data, paperSize);
      const link = document.createElement('a');
      link.download = `struk-${data.idPel || 'pln'}-${Date.now()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      if (onToast) onToast('Gambar struk PNG berhasil diunduh!');
    } catch (e: any) {
      console.error('Error downloading receipt PNG:', e);
    }
  };

  // Direct Share to WhatsApp with PNG format
  const handleShareToWhatsApp = async (phone?: string) => {
    setIsSharingWa(true);
    try {
      const res = await shareReceiptToWhatsApp(data, paperSize, phone);
      if (onToast && res.message) {
        onToast(res.message);
      }
      setShowWaModal(false);
    } catch (err: any) {
      console.error('Failed to share to WA:', err);
      if (onToast) onToast('Gagal membagikan ke WhatsApp: ' + (err.message || 'Error'));
    } finally {
      setIsSharingWa(false);
    }
  };

  const is58 = paperSize === '58mm';
  const isToken = isTokenReceipt(data);
  const isBpjs = isBpjsReceipt(data);
  const tokenValue = getStroomToken(data);
  const kwhValue = getReceiptKwh(data);

  return (
    <div className="flex flex-col items-center w-full">
      {/* Paper Size & Action Controls */}
      <div className="w-full flex items-center justify-between gap-2 mb-3 bg-slate-800/80 p-2.5 rounded-xl border border-slate-700/60 shadow-sm backdrop-blur flex-wrap">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider pl-1">Lebar Kertas:</span>
          <div className="flex bg-slate-900/90 rounded-lg p-0.5 border border-slate-700">
            <button
              type="button"
              onClick={() => onPaperSizeChange('58mm')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition ${
                is58 ? 'bg-cyan-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              58 mm
            </button>
            <button
              type="button"
              onClick={() => onPaperSizeChange('80mm')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition ${
                !is58 ? 'bg-cyan-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              80 mm
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* WhatsApp Share PNG Button */}
          <button
            type="button"
            onClick={() => setShowWaModal(true)}
            disabled={isSharingWa}
            title="Bagikan Struk PNG ke WhatsApp"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition active:scale-95 disabled:opacity-50"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Kirim WA (PNG)</span>
          </button>

          <button
            type="button"
            onClick={onCopyText}
            title="Salin Teks Struk"
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-slate-700/80 hover:bg-slate-700 text-slate-200 transition active:scale-95"
          >
            {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-cyan-400" />}
            <span className="hidden sm:inline">{isCopied ? 'Tersalin' : 'Salin Teks'}</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadImage}
            title="Unduh Gambar Struk PNG"
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-slate-700/80 hover:bg-slate-700 text-slate-200 transition active:scale-95"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">Unduh PNG</span>
          </button>

          <button
            type="button"
            onClick={onBrowserPrint}
            title="Cetak Browser / PDF"
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-slate-700/80 hover:bg-slate-700 text-slate-200 transition active:scale-95"
          >
            <Printer className="w-3.5 h-3.5 text-blue-400" />
            <span className="hidden sm:inline">PDF</span>
          </button>
        </div>
      </div>

      {/* Printable Receipt Paper Container */}
      <div id="printable-receipt-wrapper" className="w-full flex justify-center py-2 overflow-x-auto">
        <div
          id="printable-receipt"
          ref={receiptRef}
          className={`bg-white text-slate-950 shadow-2xl relative transition-all duration-300 font-receipt select-text rounded-xl border border-slate-200 ${
            is58 ? 'w-[295px] max-w-[295px] text-xs' : 'receipt-80mm w-[390px] max-w-[390px] text-sm'
          } p-4 sm:p-5`}
          style={{ letterSpacing: '-0.02em', lineHeight: '1.4' }}
        >
          {/* Header Section:
              Baris 1: LOKET PPOB ATHAR DIGITAL (Paling Atas)
              Baris 2: STRUK PEMBAYARAN TAGIHAN LISTRIK (Di bawahnya)
          */}
          <div className="text-center pb-2">
            <h2 className="text-sm sm:text-base font-extrabold tracking-tight text-slate-950 uppercase">
              {data.loket || 'LOKET PPOB ATHAR DIGITAL'}
            </h2>
            <h3 className="text-[11px] sm:text-xs font-bold text-slate-800 uppercase mt-0.5 tracking-wide">
              {data.headerTitle || 'STRUK PEMBAYARAN TAGIHAN LISTRIK'}
            </h3>
            {data.subHeader && (
              <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-wide mt-0.5">
                {data.subHeader}
              </p>
            )}
          </div>

          <div className="border-b-2 border-dashed border-slate-800 my-2" />

          {/* Transaction Metadata: Format dua kolom dengan pemisah titik dua */}
          <div className="space-y-1 text-[11px] sm:text-xs">
            {data.tanggal && (
              <div className={`grid ${is58 ? 'grid-cols-[92px_12px_1fr]' : 'grid-cols-[120px_14px_1fr]'} items-baseline`}>
                <span className="text-slate-600 font-medium">TANGGAL</span>
                <span className="text-slate-900 font-bold text-center">:</span>
                <span className="font-semibold text-slate-900 text-left">{data.tanggal}</span>
              </div>
            )}
            {data.noRef && (
              <div className={`grid ${is58 ? 'grid-cols-[92px_12px_1fr]' : 'grid-cols-[120px_14px_1fr]'} items-baseline`}>
                <span className="text-slate-600 font-medium">NO REF</span>
                <span className="text-slate-900 font-bold text-center">:</span>
                <span className="font-semibold text-slate-900 text-left">{data.noRef}</span>
              </div>
            )}
          </div>

          <div className="border-b border-dashed border-slate-300 my-2" />

          {/* Customer & Bill Details: Format dua kolom dengan pemisah titik dua */}
          <div className="space-y-1 text-[11px] sm:text-xs">
            {isBpjs ? (
              <>
                <div className={`grid ${is58 ? 'grid-cols-[92px_12px_1fr]' : 'grid-cols-[120px_14px_1fr]'} items-baseline`}>
                  <span className="text-slate-700 font-semibold">NO POLIS</span>
                  <span className="text-slate-900 font-bold text-center">:</span>
                  <span className="text-slate-950 font-bold tracking-wider text-left">{data.noPolis || data.idPel || '-'}</span>
                </div>

                {data.nama && (
                  <div className={`grid ${is58 ? 'grid-cols-[92px_12px_1fr]' : 'grid-cols-[120px_14px_1fr]'} items-baseline`}>
                    <span className="text-slate-700 font-semibold">NAMA</span>
                    <span className="text-slate-900 font-bold text-center">:</span>
                    <span className="text-slate-950 font-bold uppercase text-left truncate">{data.nama}</span>
                  </div>
                )}

                <div className={`grid ${is58 ? 'grid-cols-[92px_12px_1fr]' : 'grid-cols-[120px_14px_1fr]'} items-baseline`}>
                  <span className="text-slate-600 font-medium">JML PESERTA</span>
                  <span className="text-slate-900 font-bold text-center">:</span>
                  <span className="text-slate-900 font-semibold text-left">{data.jmlPeserta || '1 ORANG'}</span>
                </div>

                <div className={`grid ${is58 ? 'grid-cols-[92px_12px_1fr]' : 'grid-cols-[120px_14px_1fr]'} items-baseline`}>
                  <span className="text-slate-600 font-medium">PERIODE</span>
                  <span className="text-slate-900 font-bold text-center">:</span>
                  <span className="text-slate-900 text-left">{data.periode || data.blnThn || '-'}</span>
                </div>
              </>
            ) : (
              <>
                {/* Kolom NO METER (Wajib untuk Token Listrik / bila tersedia) */}
                {(isToken || data.noMeter) && (
                  <div className={`grid ${is58 ? 'grid-cols-[92px_12px_1fr]' : 'grid-cols-[120px_14px_1fr]'} items-baseline`}>
                    <span className="text-slate-700 font-semibold">NO METER</span>
                    <span className="text-slate-900 font-bold text-center">:</span>
                    <span className="text-slate-950 font-bold tracking-wider text-left">{data.noMeter || '-'}</span>
                  </div>
                )}

                {data.idPel && (
                  <div className={`grid ${is58 ? 'grid-cols-[92px_12px_1fr]' : 'grid-cols-[120px_14px_1fr]'} items-baseline`}>
                    <span className="text-slate-700 font-semibold">{isToken ? 'IDPEL' : 'NO PELANGGAN'}</span>
                    <span className="text-slate-900 font-bold text-center">:</span>
                    <span className="text-slate-950 font-bold tracking-wider text-left">{data.idPel}</span>
                  </div>
                )}

                {data.nama && (
                  <div className={`grid ${is58 ? 'grid-cols-[92px_12px_1fr]' : 'grid-cols-[120px_14px_1fr]'} items-baseline`}>
                    <span className="text-slate-700 font-semibold">NAMA</span>
                    <span className="text-slate-900 font-bold text-center">:</span>
                    <span className="text-slate-950 font-bold uppercase text-left truncate">{data.nama}</span>
                  </div>
                )}
                {data.tarifDaya && (
                  <div className={`grid ${is58 ? 'grid-cols-[92px_12px_1fr]' : 'grid-cols-[120px_14px_1fr]'} items-baseline`}>
                    <span className="text-slate-600 font-medium">TARIF / DAYA</span>
                    <span className="text-slate-900 font-bold text-center">:</span>
                    <span className="text-slate-900 font-semibold text-left">{data.tarifDaya}</span>
                  </div>
                )}
                {/* For Token Listrik: BLN/THN and STAND METER must be omitted */}
                {!isToken && data.blnThn && (
                  <div className={`grid ${is58 ? 'grid-cols-[92px_12px_1fr]' : 'grid-cols-[120px_14px_1fr]'} items-baseline`}>
                    <span className="text-slate-600 font-medium">BLN / THN</span>
                    <span className="text-slate-900 font-bold text-center">:</span>
                    <span className="text-slate-900 text-left">{data.blnThn}</span>
                  </div>
                )}
                {!isToken && data.standMeter && (
                  <div className={`grid ${is58 ? 'grid-cols-[92px_12px_1fr]' : 'grid-cols-[120px_14px_1fr]'} items-baseline`}>
                    <span className="text-slate-600 font-medium">STAND METER</span>
                    <span className="text-slate-900 font-bold text-center">:</span>
                    <span className="text-slate-900 text-left">{data.standMeter}</span>
                  </div>
                )}

                {/* JML KWH for Token Listrik */}
                {isToken && kwhValue && (
                  <div className={`grid ${is58 ? 'grid-cols-[92px_12px_1fr]' : 'grid-cols-[120px_14px_1fr]'} items-baseline`}>
                    <span className="text-slate-600 font-medium">JML KWH</span>
                    <span className="text-slate-900 font-bold text-center">:</span>
                    <span className="text-slate-950 font-bold text-left">{kwhValue}</span>
                  </div>
                )}

                {/* STROOM / TOKEN Section: 20-Digit Token Enlarged & Prominent */}
                {isToken && tokenValue && (
                  <div className="my-2 p-2 bg-slate-50 border-2 border-dashed border-slate-900 rounded-lg text-center shadow-xs">
                    <div className={`grid ${is58 ? 'grid-cols-[92px_12px_1fr]' : 'grid-cols-[120px_14px_1fr]'} items-center mb-1 text-left`}>
                      <span className="text-slate-900 font-extrabold uppercase text-[10px] sm:text-xs tracking-wider">STROOM / TOKEN</span>
                      <span className="text-slate-900 font-extrabold text-center">:</span>
                      <span className="text-slate-500 text-[9px] italic">20 Digit Token PLN</span>
                    </div>
                    <div className="text-sm sm:text-lg font-black font-mono tracking-wider text-slate-950 py-1 px-1.5 bg-white border border-slate-300 rounded shadow-inner select-all">
                      {formatToken20(tokenValue)}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Extra Custom Fields (e.g. Catatan Khusus) */}
            {data.extraFields && data.extraFields.map((field) => {
              if (isToken && (/TOKEN|STROOM/i.test(field.label) || /token/i.test(field.id) || /PPJ/i.test(field.label) || /ppj/i.test(field.id) || /KWH/i.test(field.label) || /kwh/i.test(field.id))) {
                return null;
              }
              return (
                <div key={field.id} className={`grid ${is58 ? 'grid-cols-[92px_12px_1fr]' : 'grid-cols-[120px_14px_1fr]'} items-baseline bg-slate-50 px-1 py-0.5 rounded`}>
                  <span className="text-slate-700 font-semibold uppercase">{field.label}</span>
                  <span className="text-slate-900 font-bold text-center">:</span>
                  <span className="text-slate-950 font-bold text-left">{field.value}</span>
                </div>
              );
            })}
          </div>

          <div className="border-b border-dashed border-slate-300 my-2" />

          {/* Financial Calculation Section: For Token Listrik, "RP TAG PLN" is changed to "RP BAYAR", for BPJS "RP TAGIHAN" */}
          <div className="space-y-1 text-[11px] sm:text-xs">
            <div className={`grid ${is58 ? 'grid-cols-[92px_12px_1fr]' : 'grid-cols-[120px_14px_1fr]'} items-baseline`}>
              <span className="text-slate-600 font-medium">{isToken ? 'RP BAYAR' : isBpjs ? 'RP TAGIHAN' : 'RP TAG PLN'}</span>
              <span className="text-slate-900 font-bold text-center">:</span>
              <span className="text-slate-900 font-semibold text-left">{formatRupiah(data.tagihan)}</span>
            </div>
            <div className={`grid ${is58 ? 'grid-cols-[92px_12px_1fr]' : 'grid-cols-[120px_14px_1fr]'} items-baseline`}>
              <span className="text-slate-600 font-medium">ADMIN BANK</span>
              <span className="text-slate-900 font-bold text-center">:</span>
              <span className="text-slate-900 font-semibold text-left">{formatRupiah(data.adminBank !== undefined && data.adminBank > 0 ? data.adminBank : 5000)}</span>
            </div>

            <div className="border-b-2 border-dashed border-slate-800 my-1.5" />

            {/* Total Bayar Highlight */}
            <div className={`grid ${is58 ? 'grid-cols-[92px_12px_1fr]' : 'grid-cols-[120px_14px_1fr]'} items-baseline pt-0.5 font-bold text-xs sm:text-sm`}>
              <span className="text-slate-950 font-extrabold uppercase">TOTAL BAYAR</span>
              <span className="text-slate-950 font-extrabold text-center">:</span>
              <span className="text-slate-950 text-sm sm:text-base font-extrabold tracking-tight text-left">
                {formatRupiah(data.totalBayar || ((data.tagihan || 0) + (data.adminBank !== undefined && data.adminBank > 0 ? data.adminBank : 5000)))}
              </span>
            </div>

            <div className="border-b-2 border-dashed border-slate-800 my-1.5" />
          </div>

          {/* Disclaimer / Footer Notes */}
          <div className="pt-2 text-center space-y-1">
            {data.footerDisclaimer && (
              <p className="text-[10px] leading-tight text-slate-700 font-medium italic">
                {data.footerDisclaimer}
              </p>
            )}

            {data.footerGreeting && (
              <p className="text-[10px] font-bold text-slate-900 tracking-wider uppercase pt-1">
                {data.footerGreeting}
              </p>
            )}
          </div>

          {/* Simulated Thermal Barcode / QR Section */}
          <div className="mt-4 pt-2 border-t border-dashed border-slate-300 flex flex-col items-center">
            {/* Barcode Lines Graphic */}
            <div className="flex items-center justify-center gap-[2px] h-9 w-full max-w-[240px] px-2 opacity-85">
              <span className="w-1.5 h-full bg-slate-950" />
              <span className="w-0.5 h-full bg-slate-950" />
              <span className="w-2 h-full bg-slate-950" />
              <span className="w-1 h-full bg-slate-950" />
              <span className="w-0.5 h-full bg-slate-950" />
              <span className="w-2.5 h-full bg-slate-950" />
              <span className="w-1 h-full bg-slate-950" />
              <span className="w-1.5 h-full bg-slate-950" />
              <span className="w-0.5 h-full bg-slate-950" />
              <span className="w-2 h-full bg-slate-950" />
              <span className="w-1.5 h-full bg-slate-950" />
              <span className="w-0.5 h-full bg-slate-950" />
              <span className="w-1 h-full bg-slate-950" />
              <span className="w-2 h-full bg-slate-950" />
              <span className="w-0.5 h-full bg-slate-950" />
              <span className="w-1.5 h-full bg-slate-950" />
              <span className="w-2 h-full bg-slate-950" />
              <span className="w-1 h-full bg-slate-950" />
              <span className="w-2.5 h-full bg-slate-950" />
              <span className="w-0.5 h-full bg-slate-950" />
              <span className="w-1 h-full bg-slate-950" />
              <span className="w-2 h-full bg-slate-950" />
            </div>
            <span className="text-[9px] tracking-widest text-slate-600 mt-1 font-mono">
              {data.idPel || '537210984521'}
            </span>
          </div>

          <div className="mt-3 text-center">
            <span className="inline-flex items-center gap-1 text-[9px] text-slate-500 uppercase tracking-widest">
              <Sparkles className="w-2.5 h-2.5" /> Struk Valid & Dicetak via StrukKilat
            </span>
          </div>
        </div>
      </div>

      {/* WhatsApp Sharing Dialog Modal */}
      {showWaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-sm rounded-2xl shadow-2xl p-5 text-white space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <Share2 className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-sm">Bagikan Struk ke WhatsApp</h4>
                  <p className="text-[11px] text-slate-400">Format Gambar PNG Resolusi Tinggi</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowWaModal(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Nomor WhatsApp Pelanggan (Opsional):
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs text-slate-400 flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5" />
                  </span>
                  <input
                    type="tel"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="Contoh: 081234567890"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  Kosongkan jika ingin memilih kontak langsung di aplikasi WhatsApp.
                </p>
              </div>

              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-[11px] text-slate-300 space-y-1">
                <span className="font-semibold text-emerald-400 block">Isi Pesan Struk:</span>
                <p>• {data.loket || 'PPOB ATHAR DIGITAL'}</p>
                <p>• IDPEL: {data.idPel || '-'}</p>
                <p>• Nama: {data.nama || '-'}</p>
                <p>• Total Bayar: {formatRupiah(data.totalBayar)}</p>
                <p className="text-slate-400 italic mt-1">
                  File gambar PNG struk thermal otomatis disertakan.
                </p>
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowWaModal(false)}
                className="flex-1 py-2 rounded-xl text-xs font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700 transition"
              >
                Batal
              </button>

              <button
                type="button"
                onClick={() => handleShareToWhatsApp(customerPhone)}
                disabled={isSharingWa}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg transition active:scale-95 disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isSharingWa ? 'Memproses...' : 'Kirim Sekarang'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
