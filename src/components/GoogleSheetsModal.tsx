import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  CheckCircle,
  AlertCircle,
  Copy,
  Check,
  RefreshCw,
  X,
  ExternalLink,
  Cloud,
  Globe,
  Database,
  ArrowRight,
  Shield,
  Layers,
  Sparkles,
} from 'lucide-react';
import { googleSheetsService, GoogleSheetsConfig } from '../services/googleSheetsService';
import { useApp } from '../context/AppContext';
import { APPS_SCRIPT_CODE } from '../data/appsScript';

interface GoogleSheetsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GoogleSheetsModal: React.FC<GoogleSheetsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { rawMaterials, menuItems, cloudSync } = useApp();

  const [activeTab, setActiveTab] = useState<'config' | 'script' | 'cloudflare'>('config');
  const [config, setConfig] = useState<GoogleSheetsConfig>(googleSheetsService.getConfig());
  const [urlInput, setUrlInput] = useState<string>(config.webAppUrl);
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isBulkSyncing, setIsBulkSyncing] = useState<boolean>(false);
  const [bulkSyncResult, setBulkSyncResult] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [queueCount, setQueueCount] = useState<number>(0);
  const [isFlushingQueue, setIsFlushingQueue] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      const cfg = googleSheetsService.getConfig();
      setConfig(cfg);
      setUrlInput(cfg.webAppUrl);
      setQueueCount(googleSheetsService.getQueue().length);
      setTestResult(null);
      setBulkSyncResult(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    const res = await googleSheetsService.testConnection(urlInput);
    setIsTesting(false);
    setTestResult(res);
    setConfig(googleSheetsService.getConfig());
  };

  const handleSaveConfig = () => {
    const updated = googleSheetsService.saveConfig({
      webAppUrl: urlInput.trim(),
      autoSyncOnCheckout: config.autoSyncOnCheckout,
      autoSyncOnExpense: config.autoSyncOnExpense,
    });
    setConfig(updated);
    setTestResult({
      success: true,
      message: 'Pengaturan Google Sheets berhasil disimpan!',
    });
    cloudSync.syncNow(); // langsung tarik/kirim data ke perangkat lain
  };

  const handleCopySetupLink = async () => {
    const link = googleSheetsService.buildSetupLink();
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      window.prompt('Salin link ini lalu buka di HP:', link);
    }
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleBulkSync = async () => {
    setIsBulkSyncing(true);
    setBulkSyncResult(null);
    const res = await googleSheetsService.syncAllMasterData({
      rawMaterials,
      menuItems,
    });
    setIsBulkSyncing(false);
    setBulkSyncResult(res.message);
    setConfig(googleSheetsService.getConfig());
  };

  const handleFlushQueue = async () => {
    setIsFlushingQueue(true);
    const count = await googleSheetsService.processQueue();
    setIsFlushingQueue(false);
    setQueueCount(googleSheetsService.getQueue().length);
    setTestResult({
      success: true,
      message: `${count} transaksi dari antrean offline berhasil terkirim ke Google Sheets!`,
    });
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(APPS_SCRIPT_CODE);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-3xl bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden text-neutral-100 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-neutral-950 border-b border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white">Backend Google Sheets & Cloudflare</h2>
                {config.webAppUrl ? (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" /> Terhubung
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-neutral-800 text-neutral-400 border border-neutral-700">
                    Belum Dikonfigurasi
                  </span>
                )}
              </div>
              <p className="text-xs text-neutral-400">
                Gunakan Google Spreadsheet sebagai database gratis & Cloudflare Pages untuk web hosting instan
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-neutral-800 bg-neutral-950 px-6 gap-2">
          <button
            onClick={() => setActiveTab('config')}
            className={`py-3 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition ${
              activeTab === 'config'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Database className="w-4 h-4" />
            <span>Pengaturan Webhook</span>
          </button>

          <button
            onClick={() => setActiveTab('script')}
            className={`py-3 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition ${
              activeTab === 'script'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Copy className="w-4 h-4" />
            <span>Kode Apps Script (Code.gs)</span>
          </button>

          <button
            onClick={() => setActiveTab('cloudflare')}
            className={`py-3 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition ${
              activeTab === 'cloudflare'
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Cloud className="w-4 h-4" />
            <span>Deploy Cloudflare Pages</span>
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs flex-1">
          {/* TAB 1: CONFIGURATION */}
          {activeTab === 'config' && (
            <div className="space-y-5">
              {/* Web App URL Input Box */}
              <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 space-y-3">
                <label className="block text-xs font-bold text-white">
                  URL Web App Google Apps Script
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="url"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    placeholder="https://script.google.com/macros/s/AKfycbx.../exec"
                    className="flex-1 bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-500 font-mono"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleTestConnection}
                      disabled={isTesting || !urlInput.trim()}
                      className="px-4 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-white font-semibold rounded-lg border border-neutral-700 flex items-center gap-2 transition disabled:opacity-50 shrink-0"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin text-emerald-400' : ''}`} />
                      <span>{isTesting ? 'Menguji...' : 'Uji Koneksi'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveConfig}
                      className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg transition shrink-0"
                    >
                      Simpan
                    </button>
                  </div>
                </div>

                <p className="text-[11px] text-neutral-400 leading-relaxed">
                  Dapatkan URL ini dengan membuat Google Sheet baru, pilih <strong>Ekstensi &gt; Apps Script</strong>, tempel kode di tab kedua, lalu klik <strong>Terapkan &gt; Aplikasi Web</strong>.
                </p>

                {/* Test Feedback */}
                {testResult && (
                  <div
                    className={`p-3 rounded-lg border flex items-start gap-2.5 ${
                      testResult.success
                        ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                        : 'bg-red-950/60 border-red-500/40 text-red-300'
                    }`}
                  >
                    {testResult.success ? (
                      <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <p className="font-semibold">{testResult.message}</p>
                      {testResult.success && config.lastSyncTime && (
                        <p className="text-[10px] text-emerald-400/80 mt-0.5">
                          Terakhir sinkron: {new Date(config.lastSyncTime).toLocaleTimeString('id-ID')}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Sinkronisasi Antar Perangkat */}
              <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="font-bold text-white text-xs">Sinkronisasi Antar Perangkat (Desktop &amp; HP)</h4>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                      cloudSync.status === 'synced'
                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                        : cloudSync.status === 'syncing'
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                        : cloudSync.status === 'error'
                        ? 'bg-red-500/20 text-red-300 border-red-500/30'
                        : 'bg-neutral-800 text-neutral-400 border-neutral-700'
                    }`}
                  >
                    {cloudSync.status === 'synced'
                      ? 'Tersinkron'
                      : cloudSync.status === 'syncing'
                      ? 'Menyinkronkan...'
                      : cloudSync.status === 'error'
                      ? 'Gagal'
                      : cloudSync.status === 'off'
                      ? 'Belum aktif'
                      : 'Siap'}
                  </span>
                </div>

                <p className="text-[11px] text-neutral-400 leading-relaxed">
                  Data bahan baku, menu, transaksi, beban, dan pelanggan otomatis disimpan ke Google Sheets (sheet{' '}
                  <span className="font-mono text-neutral-300">App_Data</span>) dan ditarik ke perangkat lain. Setiap
                  perangkat cukup diisi URL yang sama <strong>sekali</strong> — gunakan tombol di bawah untuk menyiapkan HP.
                </p>

                {cloudSync.status === 'error' && cloudSync.message && (
                  <div className="p-2.5 rounded-lg bg-red-950/60 border border-red-500/40 text-red-300 text-[11px] leading-relaxed">
                    {cloudSync.message}
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => cloudSync.syncNow()}
                    disabled={!config.webAppUrl || cloudSync.status === 'syncing'}
                    className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg flex items-center gap-2 transition disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${cloudSync.status === 'syncing' ? 'animate-spin' : ''}`} />
                    <span>Sinkronkan Sekarang</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleCopySetupLink}
                    disabled={!config.webAppUrl}
                    className="px-3.5 py-2 bg-neutral-800 hover:bg-neutral-700 text-white font-semibold rounded-lg border border-neutral-700 flex items-center gap-2 transition disabled:opacity-50"
                  >
                    {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedLink ? 'Link tersalin!' : 'Salin Link Setup untuk HP'}</span>
                  </button>
                  {cloudSync.lastSyncedAt && (
                    <span className="text-[10px] text-neutral-500">
                      Terakhir: {new Date(cloudSync.lastSyncedAt).toLocaleTimeString('id-ID')}
                    </span>
                  )}
                </div>

                <p className="text-[10px] text-neutral-500 leading-relaxed">
                  Tempel link setup itu di browser HP (kirim lewat WhatsApp ke diri sendiri). URL tersimpan otomatis,
                  lalu data desktop muncul. Kode Apps Script harus versi terbaru (tab &quot;Kode Apps Script&quot;) dan
                  di-deploy sebagai <strong>versi baru</strong>. Siapa pun yang memegang URL bisa membaca/menulis data —
                  jangan dibagikan.
                </p>
              </div>

              {/* Automation Toggles */}
              <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 space-y-3">
                <h4 className="font-bold text-white text-xs">Pengaturan Sinkronisasi Otomatis</h4>
                <div className="space-y-2.5">
                  <label className="flex items-center justify-between p-2.5 rounded-lg bg-neutral-900 border border-neutral-800 cursor-pointer hover:bg-neutral-850">
                    <div>
                      <span className="font-semibold text-white block">Auto-Sync Transaksi Kasir</span>
                      <span className="text-[11px] text-neutral-400 block">
                        Setiap transaksi selesai dibayar, otomatis catat row ke sheet "Transaksi" & kurangi sheet "Bahan_Baku".
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={config.autoSyncOnCheckout}
                      onChange={(e) => {
                        const updated = googleSheetsService.saveConfig({
                          autoSyncOnCheckout: e.target.checked,
                        });
                        setConfig(updated);
                      }}
                      className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
                    />
                  </label>

                  <label className="flex items-center justify-between p-2.5 rounded-lg bg-neutral-900 border border-neutral-800 cursor-pointer hover:bg-neutral-850">
                    <div>
                      <span className="font-semibold text-white block">Auto-Sync Beban Operasional</span>
                      <span className="text-[11px] text-neutral-400 block">
                        Setiap pencatatan biaya operasional kedai otomatis dikirim ke sheet "Beban_Operasional".
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={config.autoSyncOnExpense}
                      onChange={(e) => {
                        const updated = googleSheetsService.saveConfig({
                          autoSyncOnExpense: e.target.checked,
                        });
                        setConfig(updated);
                      }}
                      className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
                    />
                  </label>
                </div>
              </div>

              {/* Offline Queue & Master Bulk Sync */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Offline Queue */}
                <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 space-y-2 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-white">Antrean Offline</span>
                      <span className="px-2 py-0.5 bg-neutral-800 rounded-full font-mono text-[11px] text-amber-400 font-bold">
                        {queueCount} item
                      </span>
                    </div>
                    <p className="text-[11px] text-neutral-400 leading-relaxed">
                      Jika koneksi internet kedai sempat padam, transaksi kasir disimpan di antrean lokal dan dikirim saat online.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleFlushQueue}
                    disabled={isFlushingQueue || queueCount === 0 || !config.webAppUrl}
                    className="w-full mt-2 py-2 px-3 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg font-semibold text-xs transition disabled:opacity-40 flex items-center justify-center gap-1.5"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isFlushingQueue ? 'animate-spin' : ''}`} />
                    <span>{isFlushingQueue ? 'Mengirim...' : 'Kirim Antrean Sekarang'}</span>
                  </button>
                </div>

                {/* Master Bulk Sync */}
                <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 space-y-2 flex flex-col justify-between">
                  <div>
                    <span className="font-bold text-white block mb-1">Sinkronkan Master Data</span>
                    <p className="text-[11px] text-neutral-400 leading-relaxed">
                      Ekspor {rawMaterials.length} bahan baku dan {menuItems.length} menu produk ke Google Sheets agar sinkron dengan kasir.
                    </p>
                  </div>
                  <div>
                    <button
                      type="button"
                      onClick={handleBulkSync}
                      disabled={isBulkSyncing || !config.webAppUrl}
                      className="w-full mt-2 py-2 px-3 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 rounded-lg font-semibold text-xs transition disabled:opacity-40 flex items-center justify-center gap-1.5"
                    >
                      <Database className={`w-3.5 h-3.5 ${isBulkSyncing ? 'animate-spin' : ''}`} />
                      <span>{isBulkSyncing ? 'Menyinkronkan...' : 'Sinkronkan Master Data'}</span>
                    </button>
                    {bulkSyncResult && (
                      <p className="text-[10px] text-emerald-400 text-center mt-1">{bulkSyncResult}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: APPS SCRIPT CODE & TUTORIAL */}
          {activeTab === 'script' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/30 space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-emerald-300 text-sm flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-emerald-400" />
                    Cara Memasang Script di Google Spreadsheet (3 Menit)
                  </h3>
                  <button
                    onClick={handleCopyCode}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold text-xs shadow transition active:scale-95"
                  >
                    {copiedCode ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedCode ? 'Tersalin!' : 'Salin Seluruh Kode'}</span>
                  </button>
                </div>
                <ol className="list-decimal list-inside space-y-1.5 text-neutral-300 text-[11px] leading-relaxed pt-1">
                  <li>Buka <a href="https://sheets.new" target="_blank" rel="noreferrer" className="text-emerald-400 underline font-semibold">sheets.new</a> untuk membuat Google Spreadsheet baru di Google Drive Anda.</li>
                  <li>Beri nama spreadsheet Anda, misalnya <strong>"K99 Coffee Database"</strong>.</li>
                  <li>Di menu atas, klik <strong>Ekstensi (Extensions) &gt; Apps Script</strong>.</li>
                  <li>Hapus kode bawaan yang ada di editor, lalu <strong>Paste</strong> seluruh kode di bawah ini.</li>
                  <li>Tekan <strong>Ctrl + S</strong> untuk menyimpan proyek Apps Script.</li>
                  <li>Klik tombol biru <strong>Terapkan (Deploy) &gt; Penerapan baru (New deployment)</strong> di pojok kanan atas.</li>
                  <li>Pilih jenis <strong>Aplikasi Web (Web app)</strong>.</li>
                  <li>Atur:
                    <ul className="list-disc list-inside pl-4 text-neutral-400 pt-0.5 space-y-0.5">
                      <li>Jalankan sebagai: <strong>Saya (Me)</strong></li>
                      <li>Siapa yang memiliki akses: <strong className="text-amber-400">Siapa saja (Anyone)</strong> *(Sangat penting agar Cloudflare bisa kirim data tanpa login)*</li>
                    </ul>
                  </li>
                  <li>Klik <strong>Terapkan</strong>, izinkan akses akun Google jika diminta, lalu <strong>salin URL Aplikasi Web</strong> (/exec).</li>
                  <li>Buka tab <strong>Pengaturan Webhook</strong> di atas dan tempelkan URL tersebut!</li>
                </ol>
              </div>

              {/* Code Box */}
              <div className="relative rounded-xl border border-neutral-800 bg-neutral-950 overflow-hidden">
                <div className="px-4 py-2.5 bg-neutral-900 border-b border-neutral-800 flex items-center justify-between text-neutral-400 text-[11px]">
                  <span>google-apps-script/Code.gs</span>
                  <button
                    onClick={handleCopyCode}
                    className="hover:text-white flex items-center gap-1"
                  >
                    {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedCode ? 'Tersalin' : 'Salin'}</span>
                  </button>
                </div>
                <pre className="p-4 text-[10px] text-neutral-300 font-mono max-h-72 overflow-y-auto leading-relaxed selection:bg-emerald-600 selection:text-white">
                  {APPS_SCRIPT_CODE}
                </pre>
              </div>
            </div>
          )}

          {/* TAB 3: CLOUDFLARE PAGES DEPLOYMENT GUIDE */}
          {activeTab === 'cloudflare' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-gradient-to-r from-amber-950/40 via-neutral-900 to-neutral-900 border border-amber-500/30 space-y-2">
                <div className="flex items-center gap-2 text-white font-bold text-sm">
                  <Cloud className="w-5 h-5 text-amber-500" />
                  <span>Mengapa Cloudflare Pages Sangat Cocok untuk Web App K99 Coffee?</span>
                </div>
                <p className="text-neutral-300 text-[11px] leading-relaxed">
                  Cloudflare Pages menyediakan hosting web berbasis CDN Global berkecepatan tinggi, sertifikat SSL HTTPS otomatis, bandwidth tanpa batas, dan <strong>100% Gratis</strong> tanpa biaya bulanan server.
                </p>
              </div>

              {/* Step by step deployment */}
              <div className="space-y-3">
                <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 space-y-2">
                  <span className="font-bold text-white text-xs flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-amber-500 text-black flex items-center justify-center font-bold text-[10px]">1</span>
                    Metode A: Terhubung ke GitHub (Rekomendasi Auto-Deploy)
                  </span>
                  <ol className="list-decimal list-inside space-y-1.5 text-neutral-300 text-[11px] pl-2 leading-relaxed">
                    <li>Push repositori source code K99 Coffee POS ini ke akun GitHub Anda.</li>
                    <li>Buka dashboard Cloudflare: <a href="https://dash.cloudflare.com" target="_blank" rel="noreferrer" className="text-amber-400 underline font-semibold">dash.cloudflare.com</a>.</li>
                    <li>Pilih menu <strong>Workers &amp; Pages &gt; Create Application &gt; Pages &gt; Connect to Git</strong>.</li>
                    <li>Pilih repository GitHub K99 Coffee Anda.</li>
                    <li>Isi konfigurasi build berikut:
                      <div className="mt-2 p-3 bg-neutral-900 rounded-lg border border-neutral-800 font-mono text-[11px] space-y-1 text-neutral-200">
                        <div>Framework preset: <strong className="text-amber-400">Vite</strong></div>
                        <div>Build command: <strong className="text-amber-400">npm run build</strong></div>
                        <div>Build output directory: <strong className="text-amber-400">dist</strong></div>
                      </div>
                    </li>
                    <li>Klik <strong>Save and Deploy</strong>. Dalam 1 menit, web app Anda akan aktif di domain <code className="text-amber-300">https://k99-coffee-pos.pages.dev</code>!</li>
                  </ol>
                </div>

                <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 space-y-2">
                  <span className="font-bold text-white text-xs flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold text-[10px]">2</span>
                    Metode B: Direct Upload (Drag &amp; Drop Folder dist Tanpa Git)
                  </span>
                  <p className="text-neutral-400 text-[11px] leading-relaxed pl-2">
                    Jalankan <code className="text-white bg-neutral-800 px-1.5 py-0.5 rounded">npm run build</code> di komputer Anda. Lalu di dashboard Cloudflare Pages, pilih <strong>Direct Upload</strong> dan seret folder <code className="text-white bg-neutral-800 px-1.5 py-0.5 rounded">dist/</code> langsung ke browser.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 space-y-2">
                  <span className="font-bold text-white text-xs flex items-center gap-2">
                    <Shield className="w-4 h-4 text-emerald-400" />
                    Konfigurasi Routing SPA Otomatis (_redirects)
                  </span>
                  <p className="text-neutral-400 text-[11px] leading-relaxed">
                    Berkas <code className="text-emerald-300">public/_redirects</code> telah dibuat secara otomatis berisi <code className="text-neutral-200 bg-neutral-900 px-1 rounded">/*  /index.html  200</code>. Ini memastikan pengguna tidak akan mengalami error 404 saat merefresh halaman web app kasir di Cloudflare Pages.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-neutral-950 border-t border-neutral-800 flex items-center justify-between">
          <span className="text-xs text-neutral-400 flex items-center gap-1.5">
            <Globe className="w-3.5 h-3.5 text-emerald-400" />
            <span>K99 Coffee Web App • Hosting Cloudflare Pages &amp; Database Google Sheets</span>
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-semibold rounded-lg transition"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
