import React from 'react';
import { ReceiptData, ExtraReceiptField } from '../types';
import { isTokenReceipt, getStroomToken, formatToken20, getReceiptKwh, calculateKwh } from '../utils/escpos';
import { cleanTarifDaya } from '../utils/ocrParser';
import { 
  Building2, 
  User, 
  Zap, 
  CreditCard, 
  Calendar, 
  Hash, 
  Plus, 
  Trash2, 
  RefreshCw, 
  Calculator, 
  Clock, 
  ShieldCheck,
  FileText,
  Radio,
  Sparkles,
  Info,
  Gauge
} from 'lucide-react';

interface ReceiptEditorProps {
  data: ReceiptData;
  onChange: (updated: ReceiptData) => void;
  autoCalculate: boolean;
  onToggleAutoCalculate: (enabled: boolean) => void;
  onReset: () => void;
}

export const ReceiptEditor: React.FC<ReceiptEditorProps> = ({
  data,
  onChange,
  autoCalculate,
  onToggleAutoCalculate,
  onReset,
}) => {
  const isToken = isTokenReceipt(data);
  const currentToken = getStroomToken(data);
  const currentKwh = getReceiptKwh(data);

  // Switch to Token Listrik (Prabayar)
  const handleSelectTokenType = () => {
    const defaultTokenAdmin = 5000; // Requirement: Admin bank token listrik jadikan di Rp 5000
    const currentTagihan = data.tagihan || 100000;
    const initialKwh = data.kwh || calculateKwh(currentTagihan, data.tarifDaya || 'R1M / 1300 VA');
    onChange({
      ...data,
      headerTitle: 'STRUK PEMBELIAN TOKEN LISTRIK',
      adminBank: defaultTokenAdmin,
      blnThn: '', // Requirement: Hilangkan BLN/THN
      standMeter: '', // Requirement: Hilangkan stand meter
      kwh: initialKwh,
      stroomToken: data.stroomToken || '3829-1928-4402-9182-3819',
      tagihan: currentTagihan,
      totalBayar: autoCalculate ? currentTagihan + defaultTokenAdmin : (data.totalBayar || currentTagihan + defaultTokenAdmin),
      // Requirement: Hilangkan PPJ 3%, dan bersihkan token/kwh dari extraFields karena sudah punya kontrol dedicated
      extraFields: (data.extraFields || []).filter(
        (f) => !/TOKEN|STROOM/i.test(f.label) && !/token/i.test(f.id) && !/PPJ/i.test(f.label) && !/ppj/i.test(f.id) && !/KWH/i.test(f.label) && !/kwh/i.test(f.id)
      ),
    });
  };

  // Switch to Tagihan Listrik (Pascabayar)
  const handleSelectPostpaidType = () => {
    const defaultPostpaidAdmin = 3000;
    const currentTagihan = data.tagihan || 324500;
    onChange({
      ...data,
      headerTitle: 'STRUK PEMBAYARAN TAGIHAN LISTRIK',
      adminBank: defaultPostpaidAdmin,
      blnThn: data.blnThn || 'OKT 2026',
      standMeter: data.standMeter || '014280 - 014520 (240 kWh)',
      stroomToken: '',
      tagihan: currentTagihan,
      totalBayar: autoCalculate ? currentTagihan + defaultPostpaidAdmin : (data.totalBayar || currentTagihan + defaultPostpaidAdmin),
    });
  };

  // Generate random 20-digit token
  const handleGenerateRandomToken = () => {
    const blocks: string[] = [];
    for (let i = 0; i < 5; i++) {
      blocks.push(Math.floor(1000 + Math.random() * 9000).toString());
    }
    const newToken = blocks.join('-');
    handleFieldChange('stroomToken', newToken);
  };

  // Format 20-digit token on input
  const handleTokenChange = (val: string) => {
    const digits = val.replace(/[^0-9]/g, '').slice(0, 20);
    let formatted = digits;
    if (digits.length > 4) {
      formatted = digits.match(/.{1,4}/g)?.join('-') || digits;
    }
    handleFieldChange('stroomToken', formatted);
  };

  const handleRecalculateKwh = (customTagihan?: number, customTarif?: string) => {
    const nominal = customTagihan !== undefined ? customTagihan : data.tagihan || 100000;
    const tarif = customTarif !== undefined ? customTarif : data.tarifDaya || 'R1M / 1300 VA';
    const computed = calculateKwh(nominal, tarif);
    handleFieldChange('kwh', computed);
  };

  const handleSelectTariffPreset = (tarif: string) => {
    const nominal = data.tagihan || 100000;
    const newKwh = calculateKwh(nominal, tarif);
    onChange({
      ...data,
      tarifDaya: tarif,
      kwh: newKwh,
    });
  };

  const handleFieldChange = (field: keyof ReceiptData, value: any) => {
    const updated = { ...data, [field]: value };

    // Auto calculate total if enabled and tagihan/admin changed
    if (autoCalculate && (field === 'tagihan' || field === 'adminBank')) {
      const tag = field === 'tagihan' ? Number(value) || 0 : data.tagihan || 0;
      const adm = field === 'adminBank' ? Number(value) || 0 : data.adminBank || 0;
      updated.totalBayar = tag + adm;
      // Auto re-estimate kWh when nominal tagihan changes in token mode
      if (isToken && field === 'tagihan') {
        updated.kwh = calculateKwh(tag, updated.tarifDaya || 'R1M / 1300 VA');
      }
    }

    onChange(updated);
  };

  const handleAdminPreset = (adminFee: number) => {
    handleFieldChange('adminBank', adminFee);
  };

  const setTimestampNow = () => {
    const now = new Date();
    const d = String(now.getDate()).padStart(2, '0');
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const y = now.getFullYear();
    const hr = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    const sec = String(now.getSeconds()).padStart(2, '0');
    handleFieldChange('tanggal', `${d}/${m}/${y} ${hr}:${min}:${sec} WIB`);
  };

  const generateRandomRef = () => {
    const ref = 'PLN' + Math.floor(1000000000 + Math.random() * 9000000000);
    handleFieldChange('noRef', ref);
  };

  const addExtraField = () => {
    const newField: ExtraReceiptField = {
      id: 'field_' + Date.now(),
      label: 'ITEM BARU',
      value: '',
    };
    onChange({
      ...data,
      extraFields: [...(data.extraFields || []), newField],
    });
  };

  const updateExtraField = (id: string, key: 'label' | 'value', val: string) => {
    const updated = (data.extraFields || []).map((f) => (f.id === id ? { ...f, [key]: val } : f));
    onChange({ ...data, extraFields: updated });
  };

  const removeExtraField = (id: string) => {
    const updated = (data.extraFields || []).filter((f) => f.id !== id);
    onChange({ ...data, extraFields: updated });
  };

  return (
    <div className="bg-slate-800/90 rounded-2xl border border-slate-700/80 p-4 sm:p-6 shadow-xl space-y-6">
      {/* Editor Header */}
      <div className="flex items-center justify-between border-b border-slate-700/70 pb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-cyan-500/10 text-cyan-400 rounded-lg border border-cyan-500/20">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-white text-base">Editor Data Struk & Nota</h3>
            <p className="text-xs text-slate-400">Edit nilai field di bawah, struk visual langsung terupdate</p>
          </div>
        </div>

        <button
          type="button"
          onClick={onReset}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-300 hover:text-rose-200 bg-rose-500/10 hover:bg-rose-500/20 rounded-lg border border-rose-500/20 transition active:scale-95"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Reset Form</span>
        </button>
      </div>

      {/* Mode / Quick Type Selector */}
      <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-700/80 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
          <span>Pilih Format Struk:</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleSelectPostpaidType}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 active:scale-95 ${
              !isToken
                ? 'bg-cyan-600 text-white shadow-md'
                : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700'
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-cyan-300" />
            <span>Tagihan Listrik (Pascabayar)</span>
          </button>
          <button
            type="button"
            onClick={handleSelectTokenType}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 active:scale-95 ${
              isToken
                ? 'bg-amber-600 text-white shadow-md'
                : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>Token Listrik (Prabayar)</span>
          </button>
        </div>
      </div>

      {/* 1. Header & Identitas Loket */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-xs font-bold text-cyan-400 uppercase tracking-wider">
          <Building2 className="w-3.5 h-3.5" />
          <span>Header & Identitas Loket</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-cyan-300 mb-1">
              Nama Loket / Agen (Header Baris 1 - Paling Atas)
            </label>
            <input
              type="text"
              value={data.loket}
              onChange={(e) => handleFieldChange('loket', e.target.value)}
              placeholder="Contoh: LOKET PPOB ATHAR DIGITAL"
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm font-bold text-white focus:outline-none focus:border-cyan-500 transition"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Judul Struk (Header Baris 2)
            </label>
            <input
              type="text"
              value={data.headerTitle}
              onChange={(e) => handleFieldChange('headerTitle', e.target.value)}
              placeholder="STRUK PEMBAYARAN TAGIHAN LISTRIK"
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500 transition"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">
            Catatan Tambahan Header (Opsional - Kosongkan jika tidak perlu)
          </label>
          <input
            type="text"
            value={data.subHeader}
            onChange={(e) => handleFieldChange('subHeader', e.target.value)}
            placeholder="Kosong (atau isi bila ada unit/rayon)"
            className="w-full bg-slate-900/60 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-cyan-500 transition"
          />
        </div>
      </div>

      {/* 2. Informasi Pelanggan & Daya */}
      <div className="space-y-3 pt-2 border-t border-slate-700/60">
        <div className="flex items-center gap-2 text-xs font-bold text-amber-400 uppercase tracking-wider">
          <User className="w-3.5 h-3.5" />
          <span>Informasi Pelanggan & Stand Meter</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              No Pelanggan (IDPEL) <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              value={data.idPel}
              onChange={(e) => handleFieldChange('idPel', e.target.value)}
              placeholder="Contoh: 537210984521"
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm font-mono text-cyan-300 focus:outline-none focus:border-cyan-500 transition"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Nama Pelanggan <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              value={data.nama}
              onChange={(e) => handleFieldChange('nama', e.target.value)}
              placeholder="Contoh: BAPAK SUTRISNO"
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm font-bold text-white focus:outline-none focus:border-cyan-500 transition"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Tarif / Daya
            </label>
            <input
              type="text"
              value={data.tarifDaya}
              onChange={(e) => handleFieldChange('tarifDaya', e.target.value)}
              onBlur={() => {
                if (data.tarifDaya) {
                  const cleaned = cleanTarifDaya(data.tarifDaya);
                  if (cleaned && cleaned !== data.tarifDaya) {
                    handleFieldChange('tarifDaya', cleaned);
                  }
                }
              }}
              placeholder="Contoh: R1 / 900 VA atau R1M / 1300 VA"
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500 transition"
            />
            {/* Quick Tariff Selector */}
            <div className="flex items-center gap-1 text-[10px] flex-wrap mt-1.5">
              <span className="text-slate-400">Pilih Cepat:</span>
              <button
                type="button"
                onClick={() => handleSelectTariffPreset('R1 / 450 VA')}
                className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
              >
                450 VA
              </button>
              <button
                type="button"
                onClick={() => handleSelectTariffPreset('R1 / 900 VA')}
                className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
              >
                900 VA (R1)
              </button>
              <button
                type="button"
                onClick={() => handleSelectTariffPreset('R1M / 900 VA')}
                className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
              >
                900 VA (R1M)
              </button>
              <button
                type="button"
                onClick={() => handleSelectTariffPreset(isToken ? 'R1M / 1300 VA' : 'R1 / 1300 VA')}
                className="px-1.5 py-0.5 rounded bg-amber-600/30 text-amber-300 border border-amber-500/40 font-semibold"
              >
                1300 VA
              </button>
              <button
                type="button"
                onClick={() => handleSelectTariffPreset('R1 / 2200 VA')}
                className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
              >
                2200 VA
              </button>
              {isToken && (
                <button
                  type="button"
                  onClick={() => handleSelectTariffPreset('R1T / 1300 VA')}
                  className="px-1.5 py-0.5 rounded bg-amber-600/20 text-amber-200 border border-amber-500/30"
                >
                  R1T/1300
                </button>
              )}
            </div>
          </div>

          {/* Dedicated Jumlah kWh input for Token Listrik */}
          {isToken && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-amber-300">
                  Jumlah kWh (Kilowatt-Hour)
                </label>
                <button
                  type="button"
                  onClick={() => handleRecalculateKwh()}
                  title="Hitung ulang kWh berdasarkan Rp Bayar & Tarif PLN"
                  className="flex items-center gap-1 text-[11px] text-cyan-400 hover:text-cyan-300 font-semibold active:scale-95 transition"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Hitung Otomatis</span>
                </button>
              </div>
              <div className="relative">
                <input
                  type="text"
                  value={data.kwh || currentKwh || ''}
                  onChange={(e) => handleFieldChange('kwh', e.target.value)}
                  placeholder="Contoh: 67,3 kWh"
                  className="w-full bg-slate-900 border border-amber-500/60 rounded-lg px-3 py-2 text-sm font-bold text-amber-300 focus:outline-none focus:ring-1 focus:ring-amber-400 transition"
                />
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                Ketik langsung sesuai angka kWh di struk resmi, atau klik tombol Hitung Otomatis.
              </p>
            </div>
          )}

          {/* Dedicated 20-Digit STROOM / TOKEN for Prepaid Token Listrik */}
          {isToken && (
            <div className="sm:col-span-2 bg-slate-900/90 border-2 border-amber-500/50 rounded-xl p-3.5 space-y-2 shadow-lg">
              <div className="flex items-center justify-between">
                <label className="text-xs font-extrabold text-amber-300 uppercase tracking-wide flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span>Kolom Stroom / Token Listrik (20 Digit)</span>
                </label>
                <button
                  type="button"
                  onClick={handleGenerateRandomToken}
                  className="flex items-center gap-1 text-[11px] font-semibold text-cyan-400 hover:text-cyan-300 bg-cyan-500/10 hover:bg-cyan-500/20 px-2 py-0.5 rounded border border-cyan-500/30 transition active:scale-95"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Acak 20 Digit</span>
                </button>
              </div>

              <div className="relative">
                <input
                  type="text"
                  value={data.stroomToken || currentToken || ''}
                  onChange={(e) => handleTokenChange(e.target.value)}
                  placeholder="3829-1928-4402-9182-3819"
                  maxLength={24}
                  className="w-full bg-slate-950 border border-amber-500/60 rounded-lg px-3 py-2.5 text-base sm:text-lg font-black font-mono tracking-widest text-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-500 text-center"
                />
              </div>

              <div className="flex items-start gap-1.5 text-[11px] text-slate-400 bg-slate-950/60 p-2 rounded-lg border border-slate-800">
                <Info className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                <span>
                  Kolom <strong>PPJ 3%</strong> telah dihilangkan. 
                  Field <strong>BLN/THN</strong> dan <strong>Stand Meter</strong> ditiadakan. 
                  Nomor token 20 digit diperbesar, dan label tagihan menjadi <strong>RP BAYAR</strong>.
                </span>
              </div>
            </div>
          )}

          {/* BLN/THN & Stand Meter: Only displayed for Non-Token Receipts */}
          {!isToken && (
            <>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Bulan / Tahun (Periode)
                </label>
                <input
                  type="text"
                  value={data.blnThn}
                  onChange={(e) => handleFieldChange('blnThn', e.target.value)}
                  placeholder="Contoh: OKT 2026"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Stand Meter (Awal - Akhir)
                </label>
                <input
                  type="text"
                  value={data.standMeter}
                  onChange={(e) => handleFieldChange('standMeter', e.target.value)}
                  placeholder="Contoh: 014280 - 014520 (240 kWh)"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500 transition"
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* 3. Keuangan & Tagihan */}
      <div className="space-y-3 pt-2 border-t border-slate-700/60">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 uppercase tracking-wider">
            <CreditCard className="w-3.5 h-3.5" />
            <span>Rincian Tagihan & Admin Bank</span>
          </div>

          {/* Auto Calculate Toggle */}
          <button
            type="button"
            onClick={() => onToggleAutoCalculate(!autoCalculate)}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-full border transition ${
              autoCalculate
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                : 'bg-slate-700/50 text-slate-400 border-slate-600'
            }`}
          >
            <Calculator className="w-3 h-3" />
            <span>Auto Hitung Total: {autoCalculate ? 'Aktif' : 'Manual'}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-medium text-slate-300">
                {isToken ? 'RP BAYAR (Nominal Token)' : 'RP TAG PLN (Tagihan Murni)'}
              </label>
              {isToken && (
                <div className="flex gap-1 text-[10px]">
                  <button
                    type="button"
                    onClick={() => handleFieldChange('tagihan', 20000)}
                    className="px-1.5 py-0.5 rounded bg-slate-700 hover:bg-slate-600 text-slate-200"
                  >
                    20k
                  </button>
                  <button
                    type="button"
                    onClick={() => handleFieldChange('tagihan', 50000)}
                    className="px-1.5 py-0.5 rounded bg-slate-700 hover:bg-slate-600 text-slate-200"
                  >
                    50k
                  </button>
                  <button
                    type="button"
                    onClick={() => handleFieldChange('tagihan', 100000)}
                    className={`px-1.5 py-0.5 rounded font-bold ${
                      data.tagihan === 100000 ? 'bg-amber-600 text-white ring-1 ring-amber-400' : 'bg-slate-700 hover:bg-slate-600 text-slate-200'
                    }`}
                  >
                    100k
                  </button>
                  <button
                    type="button"
                    onClick={() => handleFieldChange('tagihan', 200000)}
                    className="px-1.5 py-0.5 rounded bg-slate-700 hover:bg-slate-600 text-slate-200"
                  >
                    200k
                  </button>
                </div>
              )}
            </div>
            <div className="relative">
              <span className="absolute left-3 top-2 text-xs font-bold text-slate-400">Rp</span>
              <input
                type="number"
                value={data.tagihan || ''}
                onChange={(e) => handleFieldChange('tagihan', Number(e.target.value))}
                placeholder={isToken ? "100000" : "324500"}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm font-semibold text-white focus:outline-none focus:border-emerald-500 transition"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-medium text-slate-300">
                Admin Bank {isToken && <span className="text-amber-400 font-bold">(Default Token: 5k)</span>}
              </label>
              <div className="flex gap-1 text-[10px]">
                <button
                  type="button"
                  onClick={() => handleAdminPreset(2500)}
                  className="px-1.5 py-0.5 rounded bg-slate-700 hover:bg-slate-600 text-slate-200"
                >
                  2.5k
                </button>
                <button
                  type="button"
                  onClick={() => handleAdminPreset(3000)}
                  className="px-1.5 py-0.5 rounded bg-slate-700 hover:bg-slate-600 text-slate-200"
                >
                  3k
                </button>
                <button
                  type="button"
                  onClick={() => handleAdminPreset(5000)}
                  className={`px-1.5 py-0.5 rounded font-bold transition ${
                    isToken
                      ? 'bg-amber-600 text-white shadow-sm ring-1 ring-amber-400'
                      : 'bg-slate-700 hover:bg-slate-600 text-slate-200'
                  }`}
                >
                  5k
                </button>
              </div>
            </div>
            <div className="relative">
              <span className="absolute left-3 top-2 text-xs font-bold text-slate-400">Rp</span>
              <input
                type="number"
                value={data.adminBank || ''}
                onChange={(e) => handleFieldChange('adminBank', Number(e.target.value))}
                placeholder={isToken ? "5000" : "3000"}
                className={`w-full bg-slate-900 border rounded-lg pl-9 pr-3 py-2 text-sm font-semibold text-white focus:outline-none transition ${
                  isToken ? 'border-amber-500/70 focus:border-amber-400' : 'border-slate-700 focus:border-emerald-500'
                }`}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Total Bayar
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-xs font-bold text-slate-400">Rp</span>
              <input
                type="number"
                value={data.totalBayar || ''}
                onChange={(e) => handleFieldChange('totalBayar', Number(e.target.value))}
                readOnly={autoCalculate}
                placeholder="327500"
                className={`w-full border rounded-lg pl-9 pr-3 py-2 text-sm font-extrabold focus:outline-none transition ${
                  autoCalculate
                    ? 'bg-slate-900/60 border-emerald-500/50 text-emerald-400 cursor-not-allowed'
                    : 'bg-slate-900 border-slate-700 text-white focus:border-emerald-500'
                }`}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 4. Transaksi Metadata (Tanggal & No Ref) */}
      <div className="space-y-3 pt-2 border-t border-slate-700/60">
        <div className="flex items-center gap-2 text-xs font-bold text-blue-400 uppercase tracking-wider">
          <Calendar className="w-3.5 h-3.5" />
          <span>Waktu & Nomor Referensi</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-medium text-slate-300">
                Tanggal & Jam Transaksi
              </label>
              <button
                type="button"
                onClick={setTimestampNow}
                className="flex items-center gap-1 text-[11px] text-cyan-400 hover:text-cyan-300 font-medium"
              >
                <Clock className="w-3 h-3" />
                <span>Waktu Sekarang</span>
              </button>
            </div>
            <input
              type="text"
              value={data.tanggal}
              onChange={(e) => handleFieldChange('tanggal', e.target.value)}
              placeholder="Contoh: 26/10/2026 18:45:10 WIB"
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500 transition"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-medium text-slate-300">
                No Referensi / Struk
              </label>
              <button
                type="button"
                onClick={generateRandomRef}
                className="flex items-center gap-1 text-[11px] text-cyan-400 hover:text-cyan-300 font-medium"
              >
                <Hash className="w-3 h-3" />
                <span>Acak No Ref</span>
              </button>
            </div>
            <input
              type="text"
              value={data.noRef}
              onChange={(e) => handleFieldChange('noRef', e.target.value)}
              placeholder="Contoh: PLN261026987456"
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-cyan-500 transition"
            />
          </div>
        </div>
      </div>

      {/* 5. Item Tambahan Dinamis (Extra Fields) */}
      <div className="space-y-3 pt-2 border-t border-slate-700/60">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold text-purple-400 uppercase tracking-wider">
            <Zap className="w-3.5 h-3.5" />
            <span>Field Tambahan (Token Stroom / Bea / Catatan)</span>
          </div>

          <button
            type="button"
            onClick={addExtraField}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-purple-300 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 rounded-lg transition active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Tambah Baris</span>
          </button>
        </div>

        {(!data.extraFields || data.extraFields.length === 0) ? (
          <p className="text-xs text-slate-500 italic bg-slate-900/40 p-2.5 rounded-lg border border-dashed border-slate-700/60">
            Belum ada field tambahan. Klik "Tambah Baris" untuk menambahkan kolom seperti Token 20 digit, tarif sampah, dll.
          </p>
        ) : (
          <div className="space-y-2">
            {data.extraFields.map((field) => (
              <div key={field.id} className="flex items-center gap-2 bg-slate-900 p-2 rounded-lg border border-slate-700">
                <input
                  type="text"
                  value={field.label}
                  onChange={(e) => updateExtraField(field.id, 'label', e.target.value)}
                  placeholder="Label (contoh: STROOM/TOKEN)"
                  className="w-1/3 bg-slate-800 border border-slate-700 rounded px-2.5 py-1.5 text-xs font-semibold text-slate-200 focus:outline-none focus:border-purple-500"
                />
                <input
                  type="text"
                  value={field.value}
                  onChange={(e) => updateExtraField(field.id, 'value', e.target.value)}
                  placeholder="Nilai (contoh: 3829-1928-4402...)"
                  className="flex-1 bg-slate-800 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500"
                />
                <button
                  type="button"
                  onClick={() => removeExtraField(field.id)}
                  title="Hapus baris"
                  className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded transition"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 6. Footer Disclaimer & Catatan PLN */}
      <div className="space-y-3 pt-2 border-t border-slate-700/60">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase tracking-wider">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>Catatan Sah / Disclaimer Struk</span>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1">
            Disclaimer Resmi
          </label>
          <textarea
            rows={2}
            value={data.footerDisclaimer}
            onChange={(e) => handleFieldChange('footerDisclaimer', e.target.value)}
            placeholder="PLN menyatakan struk ini sbg bukti pembayaran yg sah. Info hub 123"
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 transition resize-none"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1">
            Pesan Penutup / Ucapan
          </label>
          <input
            type="text"
            value={data.footerGreeting}
            onChange={(e) => handleFieldChange('footerGreeting', e.target.value)}
            placeholder="Terima Kasih Atas Pembayaran Anda"
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 transition"
          />
        </div>
      </div>
    </div>
  );
};
