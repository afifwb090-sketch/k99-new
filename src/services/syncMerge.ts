/**
 * Logika penggabungan data antar perangkat (murni, tanpa dependensi supaya mudah dites).
 *
 * Aturan:
 * - Koleksi berisi objek ber-`id` digabung per id (union).
 * - Jika id sama di kedua sisi, sisi "preferred" (biasanya perangkat ini) yang dipakai.
 * - Item yang id-nya ada di `tombstones` (sudah dihapus) dibuang dari hasil.
 */

export interface SyncState {
  rawMaterials: Array<{ id: string }>;
  menuItems: Array<{ id: string }>;
  customers: Array<{ id: string }>;
  transactions: Array<{ id: string }>;
  expenses: Array<{ id: string }>;
  stockMovements: Array<{ id: string }>;
  storeSettings: unknown;
  currentShift: unknown;
  tombstones: string[];
}

const LIST_KEYS = [
  'rawMaterials',
  'menuItems',
  'customers',
  'transactions',
  'expenses',
  'stockMovements',
] as const;

export function emptySyncState(): SyncState {
  return {
    rawMaterials: [],
    menuItems: [],
    customers: [],
    transactions: [],
    expenses: [],
    stockMovements: [],
    storeSettings: null,
    currentShift: null,
    tombstones: [],
  };
}

/** Pastikan state dari server punya semua field (server bisa kosong / versi lama). */
export function normalizeSyncState(raw: unknown): SyncState {
  const base = emptySyncState();
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Record<string, unknown>;
  for (const k of LIST_KEYS) {
    if (Array.isArray(r[k])) (base as unknown as Record<string, unknown>)[k] = r[k];
  }
  if (r.storeSettings) base.storeSettings = r.storeSettings;
  if (r.currentShift) base.currentShift = r.currentShift;
  if (Array.isArray(r.tombstones)) base.tombstones = r.tombstones.filter((x) => typeof x === 'string');
  return base;
}

export function isStateEmpty(s: SyncState): boolean {
  return LIST_KEYS.every((k) => s[k].length === 0);
}

function unionById<T extends { id: string }>(
  preferred: T[],
  other: T[],
  dead: Set<string>
): T[] {
  const map = new Map<string, T>();
  // urutan: item "other" dulu, lalu preferred menimpa
  for (const item of other) if (item && !dead.has(item.id)) map.set(item.id, item);
  for (const item of preferred) if (item && !dead.has(item.id)) map.set(item.id, item);
  return Array.from(map.values());
}

/**
 * Gabungkan dua state. `preferred` menang untuk id yang sama dan untuk
 * pengaturan toko / shift.
 */
export function mergeStates(preferred: SyncState, other: SyncState): SyncState {
  const dead = new Set<string>([...preferred.tombstones, ...other.tombstones]);
  const out = emptySyncState();
  for (const k of LIST_KEYS) {
    (out as unknown as Record<string, unknown>)[k] = unionById(
      preferred[k] as Array<{ id: string }>,
      other[k] as Array<{ id: string }>,
      dead
    );
  }
  out.storeSettings = preferred.storeSettings ?? other.storeSettings;
  out.currentShift = preferred.currentShift ?? other.currentShift;
  out.tombstones = Array.from(dead).slice(-5000); // batasi pertumbuhan
  return out;
}

/** Hash ringkas (cyrb53) supaya sidik jari state bisa disimpan kecil di localStorage. */
export function stateHash(s: SyncState): string {
  const str = JSON.stringify(s);
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36) + ':' + str.length;
}
