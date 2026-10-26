import React, { useState } from 'react';
import { Terminal, Github, Globe, Check, Copy, X, Smartphone, ExternalLink } from 'lucide-react';

interface DeploymentGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DeploymentGuideModal: React.FC<DeploymentGuideModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'github' | 'vercel' | 'pwa'>('github');
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  if (!isOpen) return null;

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const githubCommands = [
    {
      title: '1. Inisialisasi Git & Tambahkan Semua File',
      cmd: `git init\ngit add .\ngit commit -m "feat: initial commit web aplikasi OCR Struk PLN & Thermal Bluetooth PWA"`,
    },
    {
      title: '2. Buat Repo Baru di GitHub lalu Push',
      cmd: `git branch -M main\ngit remote add origin https://github.com/USERNAME_ANDA/ocr-struk-pln-thermal.git\ngit push -u origin main`,
    },
  ];

  const vercelSteps = [
    {
      title: 'Opsi A: Deploy Langsung via Vercel CLI (Paling Cepat)',
      cmd: `npm i -g vercel\nvercel login\nvercel --prod`,
    },
    {
      title: 'Opsi B: Hubungkan dari Dashboard Vercel (Auto Deploy)',
      cmd: `1. Buka https://vercel.com/new\n2. Import repositori GitHub Anda ('ocr-struk-pln-thermal')\n3. Pilih Framework Preset: Vite\n4. Klik 'Deploy' (vercel.json sudah terkonfigurasi otomatis!)`,
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-2xl rounded-2xl shadow-2xl p-5 sm:p-6 text-white space-y-4 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-purple-500/10 text-purple-400 rounded-xl border border-purple-500/20">
              <Terminal className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base sm:text-lg">Panduan Push GitHub & Deploy Vercel</h3>
              <p className="text-xs text-slate-400">Instruksi langkah demi langkah siap pakai</p>
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

        {/* Tab Selector */}
        <div className="flex bg-slate-800/80 p-1 rounded-xl border border-slate-700/60">
          <button
            type="button"
            onClick={() => setActiveTab('github')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg transition ${
              activeTab === 'github' ? 'bg-purple-600 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Github className="w-4 h-4" />
            <span>1. Push ke GitHub</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('vercel')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg transition ${
              activeTab === 'vercel' ? 'bg-purple-600 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Globe className="w-4 h-4" />
            <span>2. Deploy ke Vercel</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('pwa')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg transition ${
              activeTab === 'pwa' ? 'bg-purple-600 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Smartphone className="w-4 h-4" />
            <span>3. Instal di Android</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
          {activeTab === 'github' && (
            <div className="space-y-3">
              <p className="text-xs text-slate-300">
                Jalankan perintah berikut di terminal komputer Anda untuk mempublikasikan proyek ini ke GitHub:
              </p>

              {githubCommands.map((item, idx) => (
                <div key={idx} className="bg-slate-950 rounded-xl p-3 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
                    <span>{item.title}</span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(item.cmd, idx)}
                      className="flex items-center gap-1 text-[11px] text-purple-400 hover:text-purple-300"
                    >
                      {copiedIndex === idx ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedIndex === idx ? 'Tersalin' : 'Salin Perintah'}</span>
                    </button>
                  </div>
                  <pre className="text-xs font-mono text-purple-300 bg-slate-900/90 p-2.5 rounded-lg overflow-x-auto whitespace-pre">
                    {item.cmd}
                  </pre>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'vercel' && (
            <div className="space-y-3">
              <p className="text-xs text-slate-300">
                File <code className="text-purple-400 font-mono">vercel.json</code> sudah tersedia di root proyek dengan konfigurasi routing SPA dan cache service worker otomatis.
              </p>

              {vercelSteps.map((item, idx) => (
                <div key={idx} className="bg-slate-950 rounded-xl p-3 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
                    <span>{item.title}</span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(item.cmd, idx + 10)}
                      className="flex items-center gap-1 text-[11px] text-purple-400 hover:text-purple-300"
                    >
                      {copiedIndex === idx + 10 ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedIndex === idx + 10 ? 'Tersalin' : 'Salin'}</span>
                    </button>
                  </div>
                  <pre className="text-xs font-mono text-purple-300 bg-slate-900/90 p-2.5 rounded-lg overflow-x-auto whitespace-pre">
                    {item.cmd}
                  </pre>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'pwa' && (
            <div className="space-y-3 text-xs text-slate-300">
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                <h4 className="font-bold text-white text-sm">Cara Menginstal Aplikasi di HP Android:</h4>
                <ol className="list-decimal list-inside space-y-2 text-slate-400">
                  <li>Buka URL Vercel aplikasi Anda (yang sudah HTTPS) di aplikasi <strong>Google Chrome Android</strong>.</li>
                  <li>Tunggu beberapa detik hingga tombol <strong>"Instal Aplikasi HP"</strong> muncul di bagian atas layar aplikasi, lalu ketuk tombol tersebut.</li>
                  <li>Atau ketuk menu titik tiga (⋮) di pojok kanan atas Chrome, lalu pilih <strong>"Instal aplikasi" (Install app)</strong> atau <strong>"Tambahkan ke Layar Utama"</strong>.</li>
                  <li>Ikon aplikasi <strong>StrukKilat</strong> akan langsung terpasang di layar utama HP seperti aplikasi Android bawaan (native apk)!</li>
                  <li>Aplikasi dapat dibuka secara standalone tanpa browser bar, serta mendukung cetak langsung via Bluetooth thermal.</li>
                </ol>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-800 pt-3 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold transition"
          >
            Tutup Panduan
          </button>
        </div>
      </div>
    </div>
  );
};
