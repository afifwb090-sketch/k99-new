import { googleSheetsService } from './googleSheetsService';
import { type SyncState, normalizeSyncState } from './syncMerge';

const META_KEY = 'k99_cloud_sync_meta_v1';

export interface SyncMeta {
  /** Versi data di server saat terakhir kali perangkat ini sinkron */
  version: number;
  /** Sidik jari (hash) state lokal saat sinkron terakhir; beda = ada perubahan belum terkirim */
  hash: string;
  lastSyncedAt: string | null;
}

export function loadSyncMeta(): SyncMeta {
  try {
    const raw = localStorage.getItem(META_KEY);
    if (raw) {
      const m = JSON.parse(raw);
      return {
        version: Number(m.version) || 0,
        hash: typeof m.hash === 'string' ? m.hash : '',
        lastSyncedAt: m.lastSyncedAt || null,
      };
    }
  } catch {
    /* abaikan */
  }
  return { version: 0, hash: '', lastSyncedAt: null };
}

export function saveSyncMeta(meta: SyncMeta): void {
  try {
    localStorage.setItem(META_KEY, JSON.stringify(meta));
  } catch {
    /* abaikan */
  }
}

export type PullResult =
  | { ok: true; version: number; unchanged: boolean; state: SyncState | null }
  | { ok: false; message: string };

export type PushResult =
  | { ok: true; version: number }
  | { ok: false; conflict: true; version: number; state: SyncState | null }
  | { ok: false; conflict?: false; message: string };

const OLD_SCRIPT_HINT =
  'Kode Apps Script di Google Sheet belum diperbarui. Salin kode terbaru dari menu Google Sheets, tempel di Apps Script, lalu Deploy > Kelola penerapan > Edit > Versi baru.';

async function post(body: unknown): Promise<Record<string, unknown>> {
  const url = googleSheetsService.getConfig().webAppUrl;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 30000);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body),
      redirect: 'follow',
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      throw new Error('Balasan server bukan JSON. Pastikan URL Web App berakhiran /exec dan akses diset "Anyone".');
    }
  } finally {
    clearTimeout(timer);
  }
}

function errText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export async function pullState(sinceVersion: number): Promise<PullResult> {
  try {
    const json = await post({ action: 'get_state', sinceVersion });
    if (json.status !== 'success') {
      const msg = String(json.message || '');
      return { ok: false, message: /tidak dikenal/i.test(msg) ? OLD_SCRIPT_HINT : msg || 'Gagal membaca data server.' };
    }
    const version = Number(json.version) || 0;
    if (json.unchanged) return { ok: true, version, unchanged: true, state: null };
    return { ok: true, version, unchanged: false, state: json.state ? normalizeSyncState(json.state) : null };
  } catch (err) {
    return { ok: false, message: errText(err) };
  }
}

export async function pushState(baseVersion: number, state: SyncState): Promise<PushResult> {
  try {
    const json = await post({ action: 'save_state', baseVersion, state });
    if (json.status === 'success') return { ok: true, version: Number(json.version) || 0 };
    if (json.status === 'conflict') {
      return {
        ok: false,
        conflict: true,
        version: Number(json.version) || 0,
        state: json.state ? normalizeSyncState(json.state) : null,
      };
    }
    const msg = String(json.message || '');
    return { ok: false, message: /tidak dikenal/i.test(msg) ? OLD_SCRIPT_HINT : msg || 'Gagal menyimpan ke server.' };
  } catch (err) {
    return { ok: false, message: errText(err) };
  }
}
