# StrukKilat — Web Aplikasi OCR Struk & Printer Thermal Bluetooth (PWA)

Aplikasi web modern berbasis **React.js + Vite + Tailwind CSS + Lucide Icons** untuk memindai (OCR) struk pembayaran PPOB / Tagihan Listrik PLN, mengedit rincian data secara interaktif, melihat visual struk thermal secara real-time, serta mencetak langsung ke **Printer Thermal Bluetooth (ESC/POS)** menggunakan Web Bluetooth API dan siap diinstal di HP Android sebagai **Progressive Web App (PWA)**.

---

## Fitur Utama

1. **OCR Pemrosesan di Sisi Klien (Browser Only):**
   - Menggunakan `tesseract.js` tanpa ketergantungan server backend tambahan.
   - Prapemrosesan gambar pada canvas HTML5 (grayscale, high contrast binarization) untuk mengenali teks struk yang buram, kusut, atau miring.
   - Algoritma pencocokan regex cerdas untuk memetakan: IDPEL / No Pelanggan, Nama Pelanggan, Tarif/Daya, Stand Meter, Bulan/Tahun, RP TAG PLN, Biaya Admin Bank, Total Bayar, Tanggal Transaksi, dan No Referensi.

2. **Editor Data Struk Interaktif:**
   - Semua field dapat diedit dan langsung merubah tampilan struk seketika (*live reactive update*).
   - Teks header default: `"PEMBAYARAN TAGIHAN LISTRIK"`.
   - Disclaimer footer default resmi: `"PLN menyatakan struk ini sbg bukti pembayaran yg sah. Info hub 123"`.
   - Dukungan penambahan baris ekstra secara dinamis (misalnya Token Stroom 20 digit, Bea Meterai, dll.).
   - Tombol cepat untuk Admin Bank (Rp 2.500, Rp 3.000, Rp 5.000) dan kalkulasi total otomatis.

3. **Live Thermal Receipt Preview:**
   - Desain otentik kertas thermal kasir dengan efek sobekan bergerigi atas-bawah (*serrated tear edge*), tekstur kertas, font monospace kasir, serta barcode/QR code representatif.
   - Toggle ukuran kertas: **58 mm** (32 karakter/baris) dan **80 mm** (42-48 karakter/baris).
   - Ekspor struk ke format PNG resolusi tinggi serta tombol salin teks monospaced.

4. **Integrasi Hardware Printer Thermal Bluetooth (ESC/POS):**
   - Menggunakan **Web Bluetooth API** bawaan Google Chrome.
   - Menghasilkan biner perintah ESC/POS (`0x1B`, `0x1D`) dengan format alignment, font bold, double height, pemisah garis, dan perintah pemotong kertas (*paper cut*).
   - Pengiriman buffer bertahap (*chunked writing* 64 byte) untuk mencegah overflow memori buffer printer BLE.
   - Tombol **Test Print** untuk memverifikasi kesiapan komunikasi printer.
   - Fallback cetak standar: **Cetak Browser / Simpan PDF** dengan stylesheet `@media print` presisi 58mm/80mm.

5. **PWA Siap Instal di Android:**
   - Dilengkapi `manifest.json`, icon maskable, serta `sw.js` (Service Worker).
   - Memenuhi syarat kelayakan PWA Google Chrome sehingga tombol **"Instal Aplikasi"** dapat langsung muncul di HP.

---

## Struktur File Proyek

```
├── public/
│   ├── icon.svg             # Vektor icon struk & printer
│   ├── icon-192.png         # Icon PWA resolusi 192x192
│   ├── icon-512.png         # Icon PWA resolusi 512x512
│   ├── icon-512-maskable.png# Icon PWA maskable safe-zone
│   ├── manifest.json        # Konfigurasi Web App Manifest PWA
│   └── sw.js                # Service Worker PWA (caching & offline)
├── src/
│   ├── components/
│   │   ├── BluetoothModal.tsx       # Modal pairing & kontrol cetak Bluetooth ESC/POS
│   │   ├── DeploymentGuideModal.tsx # Modal panduan terminal GitHub & Vercel
│   │   ├── OcrScanner.tsx           # Pemindai OCR Tesseract.js & kamera/upload
│   │   ├── PWAInstallButton.tsx     # Tombol dan panduan instalasi PWA
│   │   ├── ReceiptEditor.tsx        # Formulir editor interaktif data struk
│   │   └── ThermalReceipt.tsx       # Live visual preview kertas thermal
│   ├── hooks/
│   │   └── usePWAInstall.ts         # Hook penangkap beforeinstallprompt & online status
│   ├── utils/
│   │   ├── escpos.ts                # Driver biner ESC/POS & Web Bluetooth GATT
│   │   └── ocrParser.ts             # Regex parser PPOB/PLN & filter gambar canvas
│   ├── App.tsx                      # Komponen utama aplikasi
│   ├── index.css                    # Tailwind CSS + styling khusus thermal & print
│   ├── main.tsx                     # Entry point React & registrasi service worker
│   └── types.ts                     # Definisi tipe TypeScript
├── index.html               # File HTML utama dengan tag PWA
├── package.json             # Dependensi & script build
├── vercel.json              # Konfigurasi routing rewrite SPA & header Vercel
└── vite.config.ts           # Konfigurasi Vite bundler
```

---

## Panduan Perintah Terminal

### 1. Menjalankan di Komputer Lokal

```bash
# Instal dependensi
npm install

# Jalankan server pengembangan lokal (port 3000)
npm run dev

# Uji build produksi
npm run build
```

---

### 2. Push ke GitHub

Buka terminal pada direktori root proyek, lalu jalankan:

```bash
# Inisialisasi repositori git lokal
git init

# Tambahkan seluruh file ke staging area
git add .

# Buat commit perdana
git commit -m "feat: initial commit web aplikasi OCR Struk PLN & Thermal Bluetooth PWA"

# Ubah nama branch utama menjadi main
git branch -M main

# Hubungkan dengan repositori GitHub Anda (ganti USERNAME_ANDA dengan username GitHub Anda)
git remote add origin https://github.com/USERNAME_ANDA/ocr-struk-pln-thermal.git

# Push kode ke GitHub
git push -u origin main
```

---

### 3. Deploy ke Vercel

Proyek ini telah dilengkapi file `vercel.json` sehingga langsung dikenali oleh sistem Vercel.

#### Opsi A: Deploy Menggunakan Vercel CLI

```bash
# Instal Vercel CLI secara global (jika belum ada)
npm i -g vercel

# Login ke akun Vercel Anda
vercel login

# Deploy ke environment produksi
vercel --prod
```

#### Opsi B: Deploy via Dashboard Vercel (Otomatis Sync dengan GitHub)

1. Buka [https://vercel.com/new](https://vercel.com/new).
2. Hubungkan akun GitHub Anda dan pilih repositori `ocr-struk-pln-thermal`.
3. Vercel akan otomatis mendeteksi Framework Preset sebagai **Vite**.
4. Klik tombol **Deploy**.
5. Dalam kurun waktu 1–2 menit, web aplikasi Anda sudah live dengan URL HTTPS gratis (misal: `https://ocr-struk-pln-thermal.vercel.app`).

---

### 4. Cara Instal Aplikasi di HP Android (PWA)

1. Buka URL hasil deploy Vercel Anda di aplikasi **Google Chrome** pada HP Android.
2. Pastikan web dibuka melalui protokol **HTTPS** (standar Vercel sudah otomatis HTTPS).
3. Ketuk tombol **"Instal Aplikasi HP"** yang muncul di bagian atas aplikasi, atau buka menu titik tiga (⋮) pada Chrome dan pilih **"Instal aplikasi"** / **"Tambahkan ke Layar Utama"**.
4. Aplikasi akan terinstal di launcher HP Anda layaknya aplikasi Android asli tanpa bilah alamat browser, dan siap digunakan saat transaksi di loket kasir!

---

### 5. Cara Menghubungkan Printer Thermal Bluetooth

1. **Nyalakan Printer Thermal:** Pastikan printer thermal Bluetooth (ukuran 58mm atau 80mm) menyala dan kertas roll thermal terpasang dengan benar.
2. **Pairing Pertama Kali di Android:** Buka menu **Pengaturan Bluetooth** di HP Android Anda, scan perangkat sekitar, dan hubungkan printer Anda (biasanya bernama *RPP02N*, *POS-58*, *PT-210*, atau *MPT-II*). Masukkan PIN default jika diminta (biasanya `0000` atau `1234`).
3. **Pastikan GPS / Lokasi Aktif:** Sistem operasi Android mewajibkan akses Lokasi/GPS aktif saat browser Chrome memindai perangkat Bluetooth.
4. **Koneksi di Aplikasi:** Buka aplikasi StrukKilat, ketuk tombol **"Printer Bluetooth"** atau **"Cetak Thermal Bluetooth"**, lalu pilih printer Anda dari daftar pop-up Google Chrome.
5. Setelah status menampilkan **"Terhubung"**, Anda dapat menekan **"Test Print Kertas"** untuk menguji printer, atau langsung menekan **"Cetak Struk Ini"**.
