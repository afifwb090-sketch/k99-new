import { Transaction, Expense, RawMaterial, MenuItem, Shift } from '../types';

export interface GoogleSheetsConfig {
  webAppUrl: string;
  autoSyncOnCheckout: boolean;
  autoSyncOnExpense: boolean;
  lastSyncTime: string | null;
  lastStatus: 'idle' | 'connected' | 'error' | 'syncing';
  lastErrorMessage: string | null;
}

// URL bawaan (opsional) lewat variabel build VITE_GAS_URL, mis. di Cloudflare Pages > Settings > Variables.
// Dipakai otomatis di perangkat yang belum pernah mengisi URL sendiri.
const DEFAULT_WEB_APP_URL: string = (import.meta.env?.VITE_GAS_URL as string | undefined)?.trim() || '';

const GAS_URL_PREFIX = 'https://script.google.com/macros/s/';

const STORAGE_KEY_CONFIG = 'k99_sheets_config_v1';
const STORAGE_KEY_QUEUE = 'k99_sheets_queue_v1';

export interface QueuedSyncItem {
  id: string;
  action: 'create_transaction' | 'create_expense' | 'record_shift';
  data: unknown;
  queuedAt: string;
  retries: number;
}

export class GoogleSheetsService {
  private static instance: GoogleSheetsService;

  private constructor() {
    // Automatically attempt to drain queue when window comes back online
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.processQueue();
      });
      // Coba kirim antrean saat aplikasi dibuka & berkala (tidak bergantung navigator.onLine)
      setTimeout(() => this.processQueue(), 3000);
      setInterval(() => this.processQueue(), 60000);
    }
  }

  public static getInstance(): GoogleSheetsService {
    if (!GoogleSheetsService.instance) {
      GoogleSheetsService.instance = new GoogleSheetsService();
    }
    return GoogleSheetsService.instance;
  }

  public getConfig(): GoogleSheetsConfig {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_CONFIG);
      if (saved) {
        const parsed = JSON.parse(saved) as GoogleSheetsConfig;
        if (!parsed.webAppUrl && DEFAULT_WEB_APP_URL) parsed.webAppUrl = DEFAULT_WEB_APP_URL;
        return parsed;
      }
    } catch (e) {
      console.warn('Failed to load Google Sheets config:', e);
    }

    return {
      webAppUrl: DEFAULT_WEB_APP_URL,
      autoSyncOnCheckout: true,
      autoSyncOnExpense: true,
      lastSyncTime: null,
      lastStatus: 'idle',
      lastErrorMessage: null,
    };
  }

  /**
   * Link satu-klik untuk menyiapkan perangkat lain (HP): membuka link ini otomatis
   * menyimpan URL Apps Script di perangkat tersebut.
   */
  public buildSetupLink(): string {
    const url = this.getConfig().webAppUrl;
    if (!url || typeof window === 'undefined') return '';
    return `${window.location.origin}/?gas=${encodeURIComponent(url)}`;
  }

  /**
   * Dipanggil sekali saat aplikasi dibuka: jika ada ?gas=<url> di alamat, simpan lalu bersihkan alamat.
   */
  public importSetupFromLocation(): boolean {
    if (typeof window === 'undefined') return false;
    try {
      const params = new URLSearchParams(window.location.search);
      const gas = params.get('gas');
      if (!gas) return false;
      params.delete('gas');
      const qs = params.toString();
      window.history.replaceState({}, '', window.location.pathname + (qs ? `?${qs}` : '') + window.location.hash);
      const clean = gas.trim();
      if (!clean.startsWith(GAS_URL_PREFIX)) return false;
      this.saveConfig({ webAppUrl: clean });
      return true;
    } catch {
      return false;
    }
  }

  public saveConfig(updates: Partial<GoogleSheetsConfig>): GoogleSheetsConfig {
    const current = this.getConfig();
    const merged = { ...current, ...updates };
    try {
      localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(merged));
    } catch (e) {
      console.error('Failed to save Google Sheets config:', e);
    }
    return merged;
  }

  /**
   * Menguji koneksi ke Google Apps Script Web App
   */
  public async testConnection(url: string): Promise<{ success: boolean; message: string }> {
    const cleanUrl = url.trim();
    if (!cleanUrl) {
      return { success: false, message: 'URL Google Apps Script tidak boleh kosong.' };
    }

    if (!cleanUrl.startsWith('https://script.google.com/macros/s/')) {
      return {
        success: false,
        message: 'URL harus berawalan "https://script.google.com/macros/s/..." dan berakhiran "/exec".',
      };
    }

    try {
      // Test via POST with action ping (text/plain avoids CORS preflight)
      const res = await fetch(cleanUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify({ action: 'ping' }),
        redirect: 'follow',
      });

      if (!res.ok) {
        return {
          success: false,
          message: `Server merespon dengan status ${res.status}: ${res.statusText}`,
        };
      }

      const text = await res.text();
      let json: { status?: string; message?: string } = {};
      try {
        json = JSON.parse(text);
      } catch {
        // Fallback: If returned HTML or text, Google Apps Script executed
        return {
          success: true,
          message: 'Terhubung ke Google Apps Script (Response OK).',
        };
      }

      if (json.status === 'success' || json.message) {
        this.saveConfig({
          webAppUrl: cleanUrl,
          lastStatus: 'connected',
          lastErrorMessage: null,
          lastSyncTime: new Date().toISOString(),
        });
        return {
          success: true,
          message: json.message || 'Berhasil terhubung ke Google Sheets!',
        };
      }

      return {
        success: false,
        message: json.message || 'Koneksi gagal mendapatkan balasan sukses.',
      };
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      this.saveConfig({
        lastStatus: 'error',
        lastErrorMessage: errMsg,
      });
      return {
        success: false,
        message: `Gagal terhubung: ${errMsg}. Pastikan "Who has access" diatur ke "Anyone" saat deploy.`,
      };
    }
  }

  /**
   * Mengirim transaksi baru ke Google Sheets
   */
  public async syncTransaction(tx: Transaction): Promise<boolean> {
    const config = this.getConfig();
    if (!config.webAppUrl || !config.autoSyncOnCheckout) {
      return false;
    }


    try {
      const res = await fetch(config.webAppUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify({
          action: 'create_transaction',
          data: tx,
        }),
        redirect: 'follow',
      });

      if (res.ok) {
        this.saveConfig({
          lastStatus: 'connected',
          lastSyncTime: new Date().toISOString(),
          lastErrorMessage: null,
        });
        return true;
      } else {
        throw new Error(`HTTP ${res.status}`);
      }
    } catch (err: unknown) {
      console.warn('Gagal sync transaksi ke Google Sheets, dimasukkan ke antrean offline:', err);
      this.enqueueItem('create_transaction', tx);
      return false;
    }
  }

  /**
   * Mengirim beban operasional baru ke Google Sheets
   */
  public async syncExpense(expense: Expense): Promise<boolean> {
    const config = this.getConfig();
    if (!config.webAppUrl || !config.autoSyncOnExpense) {
      return false;
    }


    try {
      const res = await fetch(config.webAppUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify({
          action: 'create_expense',
          data: expense,
        }),
        redirect: 'follow',
      });

      if (res.ok) {
        this.saveConfig({
          lastStatus: 'connected',
          lastSyncTime: new Date().toISOString(),
          lastErrorMessage: null,
        });
        return true;
      }
      throw new Error(`HTTP ${res.status}`);
    } catch (err) {
      console.warn('Gagal sync beban ke Google Sheets, dimasukkan ke antrean:', err);
      this.enqueueItem('create_expense', expense);
      return false;
    }
  }

  /**
   * Mengirim rekap shift kasir ke Google Sheets
   */
  public async syncShift(shift: Shift): Promise<boolean> {
    const config = this.getConfig();
    if (!config.webAppUrl) return false;


    try {
      const res = await fetch(config.webAppUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify({
          action: 'record_shift',
          data: shift,
        }),
        redirect: 'follow',
      });

      return res.ok;
    } catch (err) {
      console.warn('Gagal sync shift ke Google Sheets:', err);
      this.enqueueItem('record_shift', shift);
      return false;
    }
  }

  /**
   * Sinkronisasi Massal (Bulk Sync) Bahan Baku & Menu ke Google Sheets
   */
  public async syncAllMasterData(data: {
    rawMaterials: RawMaterial[];
    menuItems: MenuItem[];
  }): Promise<{ success: boolean; message: string }> {
    const config = this.getConfig();
    if (!config.webAppUrl) {
      return { success: false, message: 'URL Google Apps Script belum diisi.' };
    }

    try {
      this.saveConfig({ lastStatus: 'syncing' });

      const res = await fetch(config.webAppUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify({
          action: 'sync_all',
          data,
        }),
        redirect: 'follow',
      });

      if (!res.ok) {
        throw new Error(`Status ${res.status}`);
      }

      this.saveConfig({
        lastStatus: 'connected',
        lastSyncTime: new Date().toISOString(),
        lastErrorMessage: null,
      });

      return {
        success: true,
        message: 'Seluruh master data berhasil disinkronkan ke Google Sheets!',
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.saveConfig({
        lastStatus: 'error',
        lastErrorMessage: msg,
      });
      return {
        success: false,
        message: `Gagal sinkronisasi massal: ${msg}`,
      };
    }
  }

  // --- ANTRIAN OFFLINE (OFFLINE SYNC QUEUE) ---

  public getQueue(): QueuedSyncItem[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_QUEUE);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  public clearQueue(): void {
    try {
      localStorage.removeItem(STORAGE_KEY_QUEUE);
    } catch {
      /* abaikan */
    }
  }

  private saveQueue(items: QueuedSyncItem[]): void {
    try {
      localStorage.setItem(STORAGE_KEY_QUEUE, JSON.stringify(items));
    } catch (e) {
      console.error('Failed to save sync queue:', e);
    }
  }

  private enqueueItem(action: QueuedSyncItem['action'], data: unknown): void {
    const queue = this.getQueue();
    queue.push({
      id: 'Q-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      action,
      data,
      queuedAt: new Date().toISOString(),
      retries: 0,
    });
    this.saveQueue(queue);
  }

  private isProcessing = false;

  public async processQueue(): Promise<number> {
    const config = this.getConfig();
    if (!config.webAppUrl || this.isProcessing) return 0;

    const queue = this.getQueue();
    if (queue.length === 0) return 0;

    this.isProcessing = true;
    const remaining: QueuedSyncItem[] = [];
    let syncedCount = 0;

    for (const item of queue) {
      try {
        const res = await fetch(config.webAppUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({
            action: item.action,
            data: item.data,
          }),
          redirect: 'follow',
        });

        if (res.ok) {
          syncedCount++;
        } else {
          item.retries++;
          if (item.retries < 5) remaining.push(item);
        }
      } catch {
        item.retries++;
        if (item.retries < 5) remaining.push(item);
      }
    }

    this.saveQueue(remaining);
    this.isProcessing = false;

    if (syncedCount > 0) {
      this.saveConfig({
        lastSyncTime: new Date().toISOString(),
        lastStatus: 'connected',
      });
    }

    return syncedCount;
  }
}

export const googleSheetsService = GoogleSheetsService.getInstance();
