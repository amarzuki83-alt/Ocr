/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Receipt, 
  Bluetooth, 
  Printer, 
  HelpCircle, 
  Sparkles, 
  Wifi, 
  WifiOff, 
  Sliders, 
  CheckCircle,
  FileText,
  ScanLine
} from 'lucide-react';
import { ReceiptData, PaperSize, BluetoothPrinterState } from './types';
import { SAMPLE_PRESETS } from './utils/ocrParser';
import { generatePlainTextReceipt } from './utils/escpos';
import { getSharedImageFromIdb } from './utils/sharedImageHandler';
import { ThermalReceipt } from './components/ThermalReceipt';
import { ReceiptEditor } from './components/ReceiptEditor';
import { OcrScanner } from './components/OcrScanner';
import { BluetoothModal } from './components/BluetoothModal';
import { DeploymentGuideModal } from './components/DeploymentGuideModal';
import { PWAInstallButton } from './components/PWAInstallButton';
import { useOnlineStatus } from './hooks/usePWAInstall';

export default function App() {
  // Receipt Data State initialized with PLN Postpaid standard
  const [receiptData, setReceiptData] = useState<ReceiptData>(SAMPLE_PRESETS.plnPostpaid);
  const [paperSize, setPaperSize] = useState<PaperSize>('58mm');
  const [autoCalculate, setAutoCalculate] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'editor' | 'scanner'>('scanner');
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [incomingSharedFile, setIncomingSharedFile] = useState<File | null>(null);

  // Modals
  const [isBluetoothModalOpen, setIsBluetoothModalOpen] = useState<boolean>(false);
  const [isDeployGuideOpen, setIsDeployGuideOpen] = useState<boolean>(false);

  // Bluetooth State
  const [printerState, setPrinterState] = useState<BluetoothPrinterState>({
    device: null,
    server: null,
    characteristic: null,
    deviceName: null,
    isConnected: false,
    isConnecting: false,
    statusMessage: '',
  });

  const isOnline = useOnlineStatus();

  // Show Toast
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Check for shared images from Android/Phone Gallery Share Target
  useEffect(() => {
    async function checkSharedMedia() {
      const sharedFile = await getSharedImageFromIdb();
      if (sharedFile) {
        setIncomingSharedFile(sharedFile);
        setActiveTab('scanner');
        showToast('Foto diterima dari Menu Bagikan Galeri HP! Memulai pemindaian OCR...');
        if (window.location.search.includes('shared=')) {
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      }
    }

    checkSharedMedia();

    // Re-check when window regains visibility (e.g. app resumes after user shared photo)
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        checkSharedMedia();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  // Handle OCR Completion: merge detected fields with existing
  const handleOcrScanComplete = (parsed: Partial<ReceiptData>, rawText: string) => {
    const isTokenScan = (parsed.headerTitle || '').includes('TOKEN') || Boolean(parsed.stroomToken);
    setReceiptData((prev) => {
      const cleanExtra = (parsed.extraFields || prev.extraFields || []).filter((f) => 
        !isTokenScan || (!/PPJ/i.test(f.label) && !/ppj/i.test(f.id) && !/TOKEN|STROOM/i.test(f.label) && !/token/i.test(f.id))
      );
      // Requirement: Admin bank 5000 otomatis untuk struk token maupun pascabayar tanpa perlu klik lagi
      const adminBank = 5000;
      const tagihan = parsed.tagihan !== undefined ? parsed.tagihan : (prev.tagihan || 0);
      const totalBayar = tagihan > 0 ? tagihan + adminBank : (parsed.totalBayar || prev.totalBayar || adminBank);

      return {
        ...prev,
        ...parsed,
        adminBank,
        totalBayar,
        blnThn: isTokenScan ? '' : (parsed.blnThn !== undefined ? parsed.blnThn : prev.blnThn),
        standMeter: isTokenScan ? '' : (parsed.standMeter !== undefined ? parsed.standMeter : prev.standMeter),
        tarifDaya: parsed.tarifDaya || prev.tarifDaya,
        kwh: isTokenScan ? (parsed.kwh !== undefined ? parsed.kwh : (prev.kwh || '')) : (parsed.kwh || prev.kwh || ''),
        // Default to LOKET PPOB ATHAR DIGITAL unless user uploaded a specific custom merchant
        loket: parsed.loket || prev.loket || 'LOKET PPOB ATHAR DIGITAL',
        headerTitle: parsed.headerTitle || (isTokenScan ? 'STRUK PEMBELIAN TOKEN LISTRIK' : 'STRUK PEMBAYARAN TAGIHAN LISTRIK'),
        footerDisclaimer: parsed.footerDisclaimer || 'PLN menyatakan struk ini sbg bukti pembayaran yg sah. Info hub 123',
        extraFields: cleanExtra,
      };
    });
    setActiveTab('editor');
    showToast('Teks struk berhasil dipindai dan dipetakan ke formulir!');
  };

  // Load sample preset
  const handleLoadPreset = (preset: ReceiptData) => {
    setReceiptData({ ...preset });
    showToast(`Preset "${preset.headerTitle}" dimuat!`);
  };

  // Reset Form
  const handleResetForm = () => {
    setReceiptData({
      loket: 'LOKET PPOB ATHAR DIGITAL',
      headerTitle: 'STRUK PEMBAYARAN TAGIHAN LISTRIK',
      subHeader: '',
      idPel: '',
      noMeter: '',
      nama: '',
      tarifDaya: '',
      standMeter: '',
      blnThn: '',
      stroomToken: '',
      kwh: '',
      tagihan: 0,
      adminBank: 5000,
      totalBayar: 5000,
      tanggal: new Date().toLocaleDateString('id-ID') + ' ' + new Date().toLocaleTimeString('id-ID') + ' WIB',
      noRef: 'PLN' + Date.now().toString().slice(-10),
      footerDisclaimer: 'PLN menyatakan struk ini sbg bukti pembayaran yg sah. Info hub 123',
      footerGreeting: 'Terima Kasih Atas Pembayaran Anda',
      extraFields: [],
    });
    showToast('Formulir direset.');
  };

  // Copy plain text receipt to clipboard
  const handleCopyReceiptText = () => {
    const text = generatePlainTextReceipt(receiptData, paperSize);
    navigator.clipboard.writeText(text);
    setIsCopied(true);
    showToast('Teks struk thermal berhasil disalin ke clipboard!');
    setTimeout(() => setIsCopied(false), 2000);
  };

  // Standard Browser / PDF Print
  const handleBrowserPrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-white pb-20 sm:pb-8">
      {/* Top Navbar */}
      <header className="no-print sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          {/* Brand Logo & Name */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-900/30">
              <Receipt className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-extrabold text-base sm:text-lg tracking-tight bg-gradient-to-r from-white via-slate-100 to-cyan-300 bg-clip-text text-transparent">
                  ATHAR DIGITAL
                </h1>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  PWA &amp; OCR
                </span>
              </div>
              <p className="hidden sm:block text-[11px] text-slate-400">
                LOKET PPOB &bull; Cetak Struk Listrik &amp; Token
              </p>
            </div>
          </div>

          {/* Action Center in Header */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Online Status */}
            {!isOnline && (
              <span className="flex items-center gap-1 text-[11px] font-semibold text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20">
                <WifiOff className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Offline</span>
              </span>
            )}

            {/* PWA Install Button */}
            <PWAInstallButton />

            {/* Bluetooth Printer Trigger */}
            <button
              type="button"
              onClick={() => setIsBluetoothModalOpen(true)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition shadow-sm active:scale-95 ${
                printerState.isConnected
                  ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-600/30'
                  : 'bg-cyan-600 hover:bg-cyan-500 text-white'
              }`}
            >
              <Bluetooth className="w-3.5 h-3.5" />
              <span className="hidden xs:inline">
                {printerState.isConnected ? printerState.deviceName || 'Printer OK' : 'Printer Bluetooth'}
              </span>
            </button>

            {/* Deployment & Setup Guide */}
            <button
              type="button"
              onClick={() => setIsDeployGuideOpen(true)}
              title="Panduan GitHub & Vercel"
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition"
            >
              <HelpCircle className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main App Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 w-full flex-1">
        {/* Mobile View Switcher (OCR Scan vs Editor) */}
        <div className="no-print lg:hidden flex bg-slate-900 p-1 rounded-xl border border-slate-800 mb-5">
          <button
            type="button"
            onClick={() => setActiveTab('scanner')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg transition ${
              activeTab === 'scanner' ? 'bg-cyan-600 text-white shadow' : 'text-slate-400'
            }`}
          >
            <ScanLine className="w-4 h-4" />
            <span>1. Scan Gambar OCR</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('editor')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg transition ${
              activeTab === 'editor' ? 'bg-cyan-600 text-white shadow' : 'text-slate-400'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>2. Form Data Struk</span>
          </button>
        </div>

        {/* 2-Column Responsive Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Input, OCR, and Field Editor (7 cols) */}
          <div className="no-print lg:col-span-7 space-y-6">
            {/* OCR Scanner Section */}
            <div className={activeTab === 'scanner' ? 'block' : 'hidden lg:block'}>
              <OcrScanner
                onScanComplete={handleOcrScanComplete}
                onLoadPreset={handleLoadPreset}
                incomingFile={incomingSharedFile}
                onClearIncomingFile={() => setIncomingSharedFile(null)}
              />
            </div>

            {/* Interactive Form Editor Section */}
            <div className={activeTab === 'editor' ? 'block' : 'hidden lg:block'}>
              <ReceiptEditor
                data={receiptData}
                onChange={setReceiptData}
                autoCalculate={autoCalculate}
                onToggleAutoCalculate={setAutoCalculate}
                onReset={handleResetForm}
              />
            </div>
          </div>

          {/* Right Column: Live Visual Thermal Receipt Preview (5 cols) */}
          <div className="lg:col-span-5 sticky top-20 space-y-4">
            <div className="no-print flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-cyan-400" />
                <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider">
                  Live Thermal Preview
                </h2>
              </div>
              <span className="text-[11px] text-slate-400">
                Real-time Rendering
              </span>
            </div>

            {/* Thermal Receipt Visual Paper */}
            <ThermalReceipt
              data={receiptData}
              paperSize={paperSize}
              onPaperSizeChange={setPaperSize}
              onBrowserPrint={handleBrowserPrint}
              onCopyText={handleCopyReceiptText}
              isCopied={isCopied}
              onToast={showToast}
            />

            {/* Quick Actions under Preview */}
            <div className="no-print space-y-2 pt-1">
              <button
                type="button"
                onClick={() => setIsBluetoothModalOpen(true)}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-sm rounded-xl shadow-lg shadow-cyan-950 transition active:scale-95"
              >
                <Bluetooth className="w-4 h-4" />
                <span>Cetak Thermal Bluetooth (ESC/POS)</span>
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleBrowserPrint}
                  title="Cetak via dialog browser / PDF"
                  className="flex items-center justify-center gap-2 py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold text-xs rounded-xl transition active:scale-95"
                >
                  <Printer className="w-3.5 h-3.5 text-blue-400" />
                  <span>Cetak PDF / Roll</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopyReceiptText}
                  title="Salin teks struk format rapi"
                  className="flex items-center justify-center gap-2 py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold text-xs rounded-xl transition active:scale-95"
                >
                  <FileText className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Salin Teks Struk</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="no-print fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-slate-900 border border-cyan-500/50 text-cyan-200 px-4 py-2.5 rounded-full shadow-2xl text-xs font-semibold animate-in fade-in slide-in-from-bottom-4 duration-200">
          <CheckCircle className="w-4 h-4 text-cyan-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Bluetooth Modal */}
      <BluetoothModal
        isOpen={isBluetoothModalOpen}
        onClose={() => setIsBluetoothModalOpen(false)}
        receiptData={receiptData}
        paperSize={paperSize}
        onPaperSizeChange={setPaperSize}
        printerState={printerState}
        setPrinterState={setPrinterState}
      />

      {/* Deployment & Setup Guide Modal */}
      <DeploymentGuideModal
        isOpen={isDeployGuideOpen}
        onClose={() => setIsDeployGuideOpen(false)}
      />
    </div>
  );
}
