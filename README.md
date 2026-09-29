# K99 Coffee POS - ERP Kedai Kopi & Aplikasi Desktop

Sistem POS & ERP terintegrasi untuk kedai kopi:
- Point of Sale (POS) Kasir Cepat (Dine In & Take Away)
- Manajemen Bahan Baku & Pengurangan Stok Otomatis berbasis Resep BOM (Bill of Materials)
- Laporan Keuangan, Laba Rugi Otomatis & Visualisasi Tren Penjualan Recharts
- Loyalty Program & Poin Pelanggan
- Shift Kasir & Rekapitulasi Kas Laci
- Mode Desktop Standalone (PWA) & Wrapper Electron (.exe / .dmg)

---

## 🚀 Cara Menjalankan di Komputer Lokal

### 1. Prasyarat
- Pastikan telah terinstall **Node.js (versi 18+)**
- Download di https://nodejs.org

### 2. Instalasi Dependensi
Buka terminal / Command Prompt di folder proyek ini:
```bash
npm install --legacy-peer-deps
```
*(Atau cukup `npm install` karena berkas `.npmrc` sudah disediakan di dalam arsip).*

### 3. Menjalankan di Browser (Development Mode)
```bash
npm run dev
```
Buka browser pada: `http://localhost:3000`

### 4. Menjalankan Sebagai Aplikasi Desktop Native (Electron)
```bash
# Install electron (jika belum)
npm install -D electron

# Jalankan jendela desktop:
npm run desktop
```

### 5. Membangun File Installer (.EXE / .DMG)
```bash
npm install -D electron-builder
npx electron-builder
```
File installer Windows (.exe) atau macOS (.dmg) akan berada di folder `dist/`.

---
Dibuat untuk operasional kedai kopi modern K99 Coffee.
