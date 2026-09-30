import type { PullResult, PushResult, SyncMeta } from './cloudSyncService';
import { type SyncState, emptySyncState, isStateEmpty, mergeStates, stateHash } from './syncMerge';

/**
 * Satu siklus sinkronisasi (tarik -> gabung bila perlu -> kirim).
 * Dipisah dari React agar logikanya bisa dites terpisah.
 */
export interface SyncDeps {
  getMeta: () => SyncMeta;
  /** Snapshot data lokal TERKINI (dipanggil setelah pull, tanpa jeda async sampai apply) */
  getLocal: () => SyncState;
  pull: (sinceVersion: number) => Promise<PullResult>;
  push: (baseVersion: number, state: SyncState) => Promise<PushResult>;
  /** Terapkan state ke data aplikasi */
  apply: (state: SyncState) => void;
  /** Catat bahwa `state` sudah selaras dengan server versi `version` */
  commit: (version: number, state: SyncState) => void;
}

/** State yang benar-benar terbentuk setelah apply (pengaturan/shift lokal dipertahankan bila server kosong) */
function effectiveOf(st: SyncState, fallback: SyncState): SyncState {
  return {
    ...st,
    storeSettings: st.storeSettings ?? fallback.storeSettings,
    currentShift: st.currentShift ?? fallback.currentShift,
  };
}

export async function runSyncCycle(deps: SyncDeps, maxAttempts = 3): Promise<void> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const meta = deps.getMeta();
    const pulled = await deps.pull(meta.version);
    if (!pulled.ok) throw new Error(pulled.message);

    const local = deps.getLocal();
    const neverSynced = meta.version === 0;
    const dirty = neverSynced ? !isStateEmpty(local) : stateHash(local) !== meta.hash;
    const serverChanged = pulled.version !== meta.version;
    const remote = pulled.state ?? emptySyncState();

    if (!serverChanged) {
      if (!dirty) {
        deps.commit(meta.version, local);
        return;
      }
      const pushed = await deps.push(meta.version, local);
      if (pushed.ok) {
        deps.commit(pushed.version, local);
        return;
      }
      if ('conflict' in pushed && pushed.conflict) continue;
      throw new Error('message' in pushed ? pushed.message : 'Gagal menyimpan ke server.');
    }

    if (!dirty) {
      // Fast-forward: cukup ikuti server
      deps.apply(remote);
      deps.commit(pulled.version, effectiveOf(remote, local));
      return;
    }

    // Kedua sisi berubah -> gabung (lokal diutamakan), terapkan, lalu kirim
    const merged = mergeStates(local, remote);
    deps.apply(merged);
    const pushed = await deps.push(pulled.version, merged);
    if (pushed.ok) {
      deps.commit(pushed.version, effectiveOf(merged, local));
      return;
    }
    if ('conflict' in pushed && pushed.conflict) continue;
    throw new Error('message' in pushed ? pushed.message : 'Gagal menyimpan ke server.');
  }
  throw new Error('Data sedang berubah di perangkat lain. Coba lagi sebentar.');
}
