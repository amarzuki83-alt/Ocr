import React, { useRef } from 'react';
import { ReceiptData, PaperSize } from '../types';
import { formatRupiah } from '../utils/escpos';
import { Copy, Download, Printer, Check, Sparkles } from 'lucide-react';

interface ThermalReceiptProps {
  data: ReceiptData;
  paperSize: PaperSize;
  onPaperSizeChange: (size: PaperSize) => void;
  onBrowserPrint: () => void;
  onCopyText: () => void;
  isCopied: boolean;
}

export const ThermalReceipt: React.FC<ThermalReceiptProps> = ({
  data,
  paperSize,
  onPaperSizeChange,
  onBrowserPrint,
  onCopyText,
  isCopied,
}) => {
  const receiptRef = useRef<HTMLDivElement>(null);

  // Download thermal receipt as PNG using Canvas
  const handleDownloadImage = () => {
    if (!receiptRef.current) return;
    const element = receiptRef.current;

    // Use simple SVG/canvas drawing or html canvas to export
    const canvas = document.createElement('canvas');
    const scale = 2; // high res
    const rect = element.getBoundingClientRect();
    canvas.width = rect.width * scale;
    canvas.height = rect.height * scale;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.scale(scale, scale);
    ctx.fillStyle = '#fafaf7';
    ctx.fillRect(0, 0, rect.width, rect.height);

    // We can trigger browser print or save directly, or draw text representation
    // Let's create an offscreen rasterizer using SVG foreignObject
    const svgData = `
      <svg xmlns="http://www.w3.org/2000/svg" width="${rect.width}" height="${rect.height}">
        <foreignObject width="100%" height="100%">
          <div xmlns="http://www.w3.org/1999/xhtml" style="font-family: monospace; background: #fafaf7; padding: 16px; color: #111;">
            ${element.innerHTML}
          </div>
        </foreignObject>
      </svg>
    `;
    const img = new Image();
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    img.onload = () => {
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      const link = document.createElement('a');
      link.download = `struk-${data.idPel || 'pln'}-${Date.now()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    };
    img.src = url;
  };

  const is58 = paperSize === '58mm';

  return (
    <div className="flex flex-col items-center w-full">
      {/* Paper Size & Action Controls */}
      <div className="w-full flex items-center justify-between gap-2 mb-3 bg-slate-800/80 p-2.5 rounded-xl border border-slate-700/60 shadow-sm backdrop-blur">
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

        <div className="flex items-center gap-1.5">
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
            title="Unduh Gambar Struk"
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-slate-700/80 hover:bg-slate-700 text-slate-200 transition active:scale-95"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">PNG</span>
          </button>

          <button
            type="button"
            onClick={onBrowserPrint}
            title="Cetak Browser / PDF"
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-slate-700/80 hover:bg-slate-700 text-slate-200 transition active:scale-95"
          >
            <Printer className="w-3.5 h-3.5 text-blue-400" />
            <span className="hidden sm:inline">PDF / Browser</span>
          </button>
        </div>
      </div>

      {/* Printable Receipt Paper Container */}
      <div id="printable-receipt-wrapper" className="w-full flex justify-center py-2 overflow-x-auto">
        <div
          id="printable-receipt"
          ref={receiptRef}
          className={`bg-thermal-paper text-slate-900 shadow-2xl relative transition-all duration-300 font-receipt select-text ${
            is58 ? 'w-[320px] max-w-[320px] text-xs' : 'receipt-80mm w-[430px] max-w-[430px] text-sm'
          } p-4 sm:p-5 pt-7 pb-8 receipt-tear-top receipt-tear-bottom border-x border-slate-300/40`}
          style={{ letterSpacing: '-0.02em', lineHeight: '1.4' }}
        >
          {/* Subtle paper roll center fold indicator */}
          <div className="absolute inset-y-0 left-1/2 w-[1px] bg-black/[0.015] pointer-events-none" />

          {/* Header Section */}
          <div className="text-center pb-2">
            <h2 className="text-base sm:text-lg font-bold tracking-tight text-slate-950 uppercase">
              {data.headerTitle || 'PEMBAYARAN TAGIHAN LISTRIK'}
            </h2>
            {data.subHeader && (
              <p className="text-[11px] font-semibold text-slate-700 uppercase tracking-wide">
                {data.subHeader}
              </p>
            )}
            {data.loket && (
              <p className="text-[11px] text-slate-800 font-bold uppercase mt-0.5">
                {data.loket}
              </p>
            )}
          </div>

          <div className="border-b-2 border-dashed border-slate-400 my-2" />

          {/* Transaction Metadata */}
          <div className="space-y-0.5 text-[11px] sm:text-xs">
            {data.tanggal && (
              <div className="flex justify-between">
                <span className="text-slate-600">TANGGAL</span>
                <span className="font-semibold text-slate-900">{data.tanggal}</span>
              </div>
            )}
            {data.noRef && (
              <div className="flex justify-between">
                <span className="text-slate-600">NO REF</span>
                <span className="font-semibold text-slate-900">{data.noRef}</span>
              </div>
            )}
          </div>

          <div className="border-b border-dashed border-slate-400 my-2" />

          {/* Customer & Bill Details */}
          <div className="space-y-1 text-[11px] sm:text-xs">
            {data.idPel && (
              <div className="flex justify-between items-baseline font-bold">
                <span className="text-slate-700">IDPEL / NO PEL</span>
                <span className="text-slate-950 font-bold tracking-wider">{data.idPel}</span>
              </div>
            )}
            {data.noMeter && (
              <div className="flex justify-between">
                <span className="text-slate-600">NO METER</span>
                <span className="text-slate-900">{data.noMeter}</span>
              </div>
            )}
            {data.nama && (
              <div className="flex justify-between font-bold">
                <span className="text-slate-700">NAMA</span>
                <span className="text-slate-950 uppercase text-right max-w-[200px] truncate">{data.nama}</span>
              </div>
            )}
            {data.tarifDaya && (
              <div className="flex justify-between">
                <span className="text-slate-600">TARIF / DAYA</span>
                <span className="text-slate-900 font-semibold">{data.tarifDaya}</span>
              </div>
            )}
            {data.blnThn && (
              <div className="flex justify-between">
                <span className="text-slate-600">BLN / THN</span>
                <span className="text-slate-900">{data.blnThn}</span>
              </div>
            )}
            {data.standMeter && (
              <div className="flex justify-between">
                <span className="text-slate-600">STAND METER</span>
                <span className="text-slate-900 text-right">{data.standMeter}</span>
              </div>
            )}

            {/* Extra Custom Fields (e.g., Token Stroom 20 digit, Admin Loket, dll) */}
            {data.extraFields && data.extraFields.map((field) => (
              <div key={field.id} className="flex justify-between bg-slate-100/60 px-1 py-0.5 rounded">
                <span className="text-slate-700 font-semibold uppercase">{field.label}</span>
                <span className="text-slate-950 font-bold text-right">{field.value}</span>
              </div>
            ))}
          </div>

          <div className="border-b border-dashed border-slate-400 my-2" />

          {/* Financial Calculation Section */}
          <div className="space-y-1 text-[11px] sm:text-xs">
            <div className="flex justify-between">
              <span className="text-slate-600">RP TAG PLN</span>
              <span className="text-slate-900 font-medium">{formatRupiah(data.tagihan)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">ADMIN BANK</span>
              <span className="text-slate-900 font-medium">{formatRupiah(data.adminBank)}</span>
            </div>

            <div className="border-b-2 border-dashed border-slate-800 my-1.5" />

            {/* Total Bayar Highlight */}
            <div className="flex justify-between items-baseline pt-0.5 font-bold text-xs sm:text-sm">
              <span className="text-slate-950">TOTAL BAYAR</span>
              <span className="text-slate-950 text-sm sm:text-base font-extrabold tracking-tight">
                {formatRupiah(data.totalBayar)}
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
    </div>
  );
};
