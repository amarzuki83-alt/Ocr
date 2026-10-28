import React, { useState, useRef } from 'react';
import { createWorker, PSM } from 'tesseract.js';
import { 
  Camera, 
  Upload, 
  FileSearch, 
  CheckCircle2, 
  AlertCircle, 
  Layers, 
  Sparkles, 
  Image as ImageIcon,
  RotateCw
} from 'lucide-react';
import { preprocessImageForOcr, parseReceiptFromOcr, SAMPLE_PRESETS } from '../utils/ocrParser';
import { ReceiptData, OcrProgressState } from '../types';
import { Share2, Info, X } from 'lucide-react';

interface OcrScannerProps {
  onScanComplete: (parsedData: Partial<ReceiptData>, rawText: string) => void;
  onLoadPreset: (preset: ReceiptData) => void;
  incomingFile?: File | null;
  onClearIncomingFile?: () => void;
}

export const OcrScanner: React.FC<OcrScannerProps> = ({
  onScanComplete,
  onLoadPreset,
  incomingFile,
  onClearIncomingFile,
}) => {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [progressState, setProgressState] = useState<OcrProgressState>({
    isProcessing: false,
    progress: 0,
    status: '',
  });
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [rawOcrText, setRawOcrText] = useState<string>('');
  const [showRawText, setShowRawText] = useState(false);
  const [showShareGuide, setShowShareGuide] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Auto-process incoming file shared from mobile phone gallery
  React.useEffect(() => {
    if (incomingFile) {
      handleProcessImage(incomingFile);
      onClearIncomingFile?.();
    }
  }, [incomingFile]);

  const handleProcessImage = async (file: File) => {
    if (!file) return;

    setErrorMsg(null);
    setRawOcrText('');
    setProgressState({
      isProcessing: true,
      progress: 5,
      status: 'Mempersiapkan gambar & filter kontras...',
    });

    try {
      // 1. Preprocess image in canvas for high OCR contrast
      const processedDataUrl = await preprocessImageForOcr(file);
      setImagePreview(processedDataUrl);

      setProgressState({
        isProcessing: true,
        progress: 20,
        status: 'Memuat OCR Engine Tesseract.js...',
      });

      // 2. Initialize Tesseract worker
      const worker = await createWorker('eng', 1, {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            const pct = Math.round(20 + (m.progress || 0) * 75);
            setProgressState({
              isProcessing: true,
              progress: pct,
              status: `Mengenali teks struk (Presisi Tinggi)... ${Math.round((m.progress || 0) * 100)}%`,
            });
          }
        },
      });

      // Set PSM 6 (Uniform Block) and whitelist to prevent misrecognition on thermal receipts
      await worker.setParameters({
        tessedit_pageseg_mode: PSM.SINGLE_BLOCK, // PSM 6: Assume a single uniform block of text
        tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz .,:/()-+=%#',
      });

      // 3. Recognize text
      const result = await worker.recognize(processedDataUrl);
      const extractedText = result.data.text || '';
      setRawOcrText(extractedText);

      // 4. Terminate worker to free memory
      await worker.terminate();

      setProgressState({
        isProcessing: true,
        progress: 98,
        status: 'Memetakan data ke field struk...',
      });

      // 5. Smart regex parser
      const parsed = parseReceiptFromOcr(extractedText);

      setProgressState({
        isProcessing: false,
        progress: 100,
        status: 'Selesai!',
      });

      onScanComplete(parsed, extractedText);
    } catch (err: any) {
      console.error('OCR Error:', err);
      setErrorMsg('Gagal memproses OCR: ' + (err.message || 'Format gambar tidak didukung'));
      setProgressState({
        isProcessing: false,
        progress: 0,
        status: '',
      });
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleProcessImage(file);
    }
  };

  return (
    <div className="bg-slate-800/90 rounded-2xl border border-slate-700/80 p-4 sm:p-6 shadow-xl space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-700/70 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-blue-500/10 text-blue-400 rounded-lg border border-blue-500/20">
            <Camera className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-white text-base">Pemindai OCR Struk & Nota</h3>
            <p className="text-xs text-slate-400">Upload screenshot atau foto struk PPOB / Tagihan Listrik PLN</p>
          </div>
        </div>

        {/* Preset Sample Buttons */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Contoh:</span>
          <button
            type="button"
            onClick={() => onLoadPreset(SAMPLE_PRESETS.plnPostpaid)}
            className="px-2.5 py-1 text-xs font-medium rounded-lg bg-slate-700 hover:bg-slate-600 text-cyan-300 border border-slate-600 transition active:scale-95"
          >
            PLN Pascabayar
          </button>
          <button
            type="button"
            onClick={() => onLoadPreset(SAMPLE_PRESETS.plnPrepaid)}
            className="px-2.5 py-1 text-xs font-medium rounded-lg bg-slate-700 hover:bg-slate-600 text-amber-300 border border-slate-600 transition active:scale-95"
          >
            Token Listrik
          </button>
          <button
            type="button"
            onClick={() => onLoadPreset(SAMPLE_PRESETS.pdam)}
            className="px-2.5 py-1 text-xs font-medium rounded-lg bg-slate-700 hover:bg-slate-600 text-emerald-300 border border-slate-600 transition active:scale-95"
          >
            PDAM
          </button>
        </div>
      </div>

      {/* Upload Zone */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Upload Trigger Area */}
        <div className="flex flex-col justify-center items-center border-2 border-dashed border-slate-700 hover:border-cyan-500/60 rounded-xl p-6 bg-slate-900/50 hover:bg-slate-900/80 transition-all text-center group">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/*"
            className="hidden"
          />
          <input
            type="file"
            ref={cameraInputRef}
            onChange={handleFileChange}
            accept="image/*"
            capture="environment"
            className="hidden"
          />

          <div className="w-14 h-14 rounded-full bg-cyan-500/10 text-cyan-400 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
            <Upload className="w-7 h-7" />
          </div>

          <p className="text-sm font-semibold text-slate-200 mb-1">
            Unggah Gambar atau Foto Struk
          </p>
          <p className="text-xs text-slate-400 mb-4 max-w-xs">
            Format JPG, PNG, WEBP. Teks akan diproses otomatis oleh OCR Tesseract.js di browser.
          </p>

          <div className="flex gap-2 w-full max-w-xs">
            <button
              type="button"
              disabled={progressState.isProcessing}
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-medium text-xs shadow-md transition disabled:opacity-50 active:scale-95"
            >
              <ImageIcon className="w-3.5 h-3.5" />
              <span>Pilih Gambar</span>
            </button>

            <button
              type="button"
              disabled={progressState.isProcessing}
              onClick={() => cameraInputRef.current?.click()}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-medium text-xs border border-slate-600 transition disabled:opacity-50 active:scale-95"
            >
              <Camera className="w-3.5 h-3.5 text-cyan-400" />
              <span>Foto Kamera</span>
            </button>
          </div>
        </div>

        {/* Scan Status / Image Preview Area */}
        <div className="bg-slate-900/70 rounded-xl p-4 border border-slate-700/60 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-300">Pratinjau Gambar Struk</span>
              {imagePreview && (
                <button
                  type="button"
                  onClick={() => setShowRawText(!showRawText)}
                  className="text-[11px] text-cyan-400 hover:underline flex items-center gap-1"
                >
                  <Layers className="w-3 h-3" />
                  <span>{showRawText ? 'Lihat Gambar' : 'Lihat Raw Teks'}</span>
                </button>
              )}
            </div>

            {/* Processing Indicator */}
            {progressState.isProcessing && (
              <div className="space-y-2 py-4">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-cyan-400 font-medium animate-pulse">{progressState.status}</span>
                  <span className="font-bold text-white">{progressState.progress}%</span>
                </div>
                <div className="w-full bg-slate-700 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-cyan-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${progressState.progress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Error Message */}
            {errorMsg && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-300 text-xs flex items-center gap-2 mb-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Preview Box */}
            {showRawText && rawOcrText ? (
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 font-mono text-[11px] text-slate-300 max-h-48 overflow-y-auto whitespace-pre-wrap">
                {rawOcrText}
              </div>
            ) : imagePreview ? (
              <div className="relative rounded-lg overflow-hidden border border-slate-800 bg-slate-950 flex justify-center max-h-48">
                <img
                  src={imagePreview}
                  alt="Struk preview"
                  className="object-contain h-48 w-full"
                />
              </div>
            ) : (
              <div className="h-44 border border-dashed border-slate-800 rounded-lg flex flex-col items-center justify-center text-slate-500 text-xs">
                <FileSearch className="w-8 h-8 mb-2 opacity-40" />
                <span>Gambar struk akan muncul di sini saat diunggah</span>
              </div>
            )}
          </div>

          {rawOcrText && !progressState.isProcessing && (
            <div className="mt-3 pt-2 border-t border-slate-800 flex items-center justify-between text-[11px] text-emerald-400">
              <span className="flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                OCR Selesai & Berhasil Dipetakan
              </span>
              <span className="text-slate-400">Siap dicetak atau diedit</span>
            </div>
          )}
        </div>
      </div>

      {/* Share Target Mobile Gallery Helper Banner */}
      <div className="p-3 bg-gradient-to-r from-blue-950/60 to-slate-900/80 rounded-xl border border-blue-500/30 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-cyan-400 flex items-center justify-center shrink-0 border border-blue-500/30">
            <Share2 className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-white">Bisa Bagikan Langsung dari Galeri HP</span>
              <span className="text-[10px] bg-cyan-500/20 text-cyan-300 font-bold px-1.5 py-0.2 rounded border border-cyan-500/30">
                PWA Share Target
              </span>
            </div>
            <p className="text-[11px] text-slate-300">
              Buka Galeri HP &gt; Pilih foto struk &gt; Tekan <strong>Bagikan (Share)</strong> &gt; Pilih <strong>ATHAR DIGITAL</strong>.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowShareGuide(true)}
          className="text-xs font-semibold text-cyan-400 hover:text-cyan-300 bg-cyan-500/10 hover:bg-cyan-500/20 px-3 py-1.5 rounded-lg border border-cyan-500/30 transition flex items-center gap-1 shrink-0"
        >
          <Info className="w-3.5 h-3.5" />
          <span>Cara Mengaktifkan</span>
        </button>
      </div>

      {/* Share Target Instruction Modal */}
      {showShareGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl p-5 shadow-2xl text-white space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <div className="flex items-center gap-2">
                <Share2 className="w-5 h-5 text-cyan-400" />
                <h3 className="text-sm sm:text-base font-bold text-white">
                  Cara Membagikan Foto dari Galeri HP
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowShareGuide(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-300 leading-relaxed">
              <div className="flex gap-2.5 items-start bg-slate-800/60 p-2.5 rounded-lg border border-slate-700/60">
                <span className="w-5 h-5 rounded-full bg-cyan-600 text-white font-bold flex items-center justify-center shrink-0 text-[10px]">1</span>
                <div>
                  <strong className="text-white block mb-0.5">Instal Aplikasi ke Layar Utama HP</strong>
                  Klik tombol <strong>"Instal Aplikasi HP"</strong> di menu atas (atau menu Chrome titik 3 &gt; <em>Tambahkan ke Layar Utama / Install App</em>).
                </div>
              </div>

              <div className="flex gap-2.5 items-start bg-slate-800/60 p-2.5 rounded-lg border border-slate-700/60">
                <span className="w-5 h-5 rounded-full bg-cyan-600 text-white font-bold flex items-center justify-center shrink-0 text-[10px]">2</span>
                <div>
                  <strong className="text-white block mb-0.5">Buka Galeri Foto di HP Anda</strong>
                  Buka aplikasi Galeri, File Manager, atau Google Photos di HP Anda, lalu buka foto struk / nota listrik.
                </div>
              </div>

              <div className="flex gap-2.5 items-start bg-slate-800/60 p-2.5 rounded-lg border border-slate-700/60">
                <span className="w-5 h-5 rounded-full bg-cyan-600 text-white font-bold flex items-center justify-center shrink-0 text-[10px]">3</span>
                <div>
                  <strong className="text-white block mb-0.5">Tekan Tombol Bagikan (Share)</strong>
                  Pilih <strong>AtharDigital / LOKET PPOB ATHAR DIGITAL</strong> di daftar aplikasi. Foto struk akan otomatis terbuka dan langsung dipindai tanpa perlu upload manual!
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowShareGuide(false)}
              className="w-full py-2 px-4 rounded-xl bg-cyan-600 hover:bg-cyan-500 font-bold text-xs text-white transition active:scale-95 shadow-md"
            >
              Mengerti &amp; Tutup
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
