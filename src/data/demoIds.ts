import {
  initialRawMaterials,
  initialMenuItems,
  initialCustomers,
  initialTransactions,
  initialExpenses,
  initialStockMovements,
  initialShift,
} from './initialData';

/**
 * Daftar ID data contoh (dummy) bawaan aplikasi. ID ini dianggap "sudah dihapus" selamanya:
 * tidak boleh muncul lagi dari penyimpanan lokal, perangkat lain, maupun server.
 * (ID data asli buatan aplikasi selalu berformat lain, mis. MAT-261002-1234AB.)
 */
export const DEMO_IDS: ReadonlySet<string> = new Set<string>(
  [
    ...initialRawMaterials,
    ...initialMenuItems,
    ...initialCustomers,
    ...initialTransactions,
    ...initialExpenses,
    ...initialStockMovements,
  ].map((x) => x.id)
);

export const DEMO_SHIFT_ID: string = initialShift.id;

export const withoutDemo = <T extends { id: string }>(list: T[]): T[] =>
  Array.isArray(list) ? list.filter((x) => x && !DEMO_IDS.has(x.id)) : [];
