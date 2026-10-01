import type { CartItem, CustomChoice, CustomGroupKey, CustomizationConfig, MenuItem, RawMaterial } from '../types';

let uid = 0;
export const newChoiceId = (): string => `c${Date.now().toString(36)}${(uid++).toString(36)}${Math.random().toString(36).slice(2, 4)}`;

export const mkChoice = (label: string, price = 0, extra: Partial<CustomChoice> = {}): CustomChoice => ({
  id: newChoiceId(),
  label,
  price,
  cost: 0,
  ...extra,
});

/** Pilihan bawaan (sama dengan perilaku sebelumnya). Pilihan pertama di tiap grup = default. */
export const buildDefaultCustomization = (): CustomizationConfig => ({
  temperature: [mkChoice('Ice'), mkChoice('Hot')],
  size: [mkChoice('Regular'), mkChoice('Large', 4000, { extraPercent: 25 })],
  sugar: [mkChoice('Normal'), mkChoice('Less Sugar'), mkChoice('No Sugar')],
  milk: [mkChoice('Fresh Milk'), mkChoice('Oat Milk', 6000), mkChoice('Almond Milk', 6000)],
  addons: [mkChoice('Extra Shot', 5000)],
});

export const GROUP_KEYS: CustomGroupKey[] = ['temperature', 'size', 'sugar', 'milk', 'addons'];

/** Pastikan config dari penyimpanan/server lengkap & aman dipakai. */
export function normalizeCustomization(raw: unknown): CustomizationConfig {
  const def = buildDefaultCustomization();
  if (!raw || typeof raw !== 'object') return def;
  const r = raw as Record<string, unknown>;
  const out = { ...def } as CustomizationConfig;
  for (const k of GROUP_KEYS) {
    const arr = r[k];
    if (Array.isArray(arr)) {
      const cleaned = arr
        .filter((c) => c && typeof c === 'object' && typeof (c as CustomChoice).label === 'string')
        .map((c) => {
          const x = c as CustomChoice;
          return {
            id: typeof x.id === 'string' && x.id ? x.id : newChoiceId(),
            label: x.label,
            price: Number(x.price) || 0,
            cost: Number(x.cost) || 0,
            extraPercent: x.extraPercent ? Number(x.extraPercent) || 0 : undefined,
            materialId: x.materialId || undefined,
            materialQty: x.materialQty ? Number(x.materialQty) || 0 : undefined,
          } as CustomChoice;
        });
      // grup selain add-on tidak boleh kosong
      out[k] = cleaned.length > 0 || k === 'addons' ? cleaned : def[k];
    }
  }
  return out;
}

export interface CustomSelection {
  temperature?: string;
  size?: string;
  sugarLevel?: string;
  milkType?: string;
  addons?: string[];
  notes?: string;
}

const findChoice = (list: CustomChoice[], label?: string): CustomChoice | undefined =>
  label ? list.find((c) => c.label === label) : undefined;

/** Isi pilihan default (pilihan pertama) untuk grup yang diizinkan menu. */
export function withDefaults(item: MenuItem, sel: CustomSelection | undefined, cfg: CustomizationConfig): CustomSelection {
  const s = sel || {};
  return {
    temperature: item.allowsTemperatureChoice ? (findChoice(cfg.temperature, s.temperature) ? s.temperature : cfg.temperature[0]?.label) : undefined,
    size: item.allowsSizeChoice ? (findChoice(cfg.size, s.size) ? s.size : cfg.size[0]?.label) : undefined,
    sugarLevel: item.allowsSugarLevel ? (findChoice(cfg.sugar, s.sugarLevel) ? s.sugarLevel : cfg.sugar[0]?.label) : undefined,
    milkType: item.allowsMilkOptions ? (findChoice(cfg.milk, s.milkType) ? s.milkType : cfg.milk[0]?.label) : undefined,
    addons: (s.addons || []).filter((a) => findChoice(cfg.addons, a)),
    notes: s.notes,
  };
}

export interface LineCalc {
  basePrice: number;
  calculatedCost: number;
  recipeMultiplier: number;
  extraDeductions: { rawMaterialId: string; quantity: number }[];
}

/** Hitung harga, HPP, dan pemotongan stok untuk satu porsi dengan pilihan tertentu. */
export function computeLine(
  item: MenuItem,
  sel: CustomSelection,
  cfg: CustomizationConfig,
  rawMaterials: RawMaterial[],
  recipeCOGS: number
): LineCalc {
  const chosen: CustomChoice[] = [
    findChoice(cfg.temperature, sel.temperature),
    findChoice(cfg.size, sel.size),
    findChoice(cfg.sugar, sel.sugarLevel),
    findChoice(cfg.milk, sel.milkType),
    ...(sel.addons || []).map((a) => findChoice(cfg.addons, a)),
  ].filter(Boolean) as CustomChoice[];

  const price = item.price + chosen.reduce((s, c) => s + (Number(c.price) || 0), 0);
  const percent = chosen.reduce((s, c) => s + (Number(c.extraPercent) || 0), 0);
  const recipeMultiplier = Math.max(0, 1 + percent / 100);

  const extraDeductions: { rawMaterialId: string; quantity: number }[] = [];
  let cost = recipeCOGS * recipeMultiplier;
  for (const c of chosen) {
    cost += Number(c.cost) || 0;
    if (c.materialId && Number(c.materialQty) > 0) {
      const mat = rawMaterials.find((m) => m.id === c.materialId);
      if (mat) {
        extraDeductions.push({ rawMaterialId: mat.id, quantity: Number(c.materialQty) });
        cost += Number(c.materialQty) * mat.costPerUnit;
      }
    }
  }
  return { basePrice: price, calculatedCost: Math.round(cost), recipeMultiplier, extraDeductions };
}

/** Teks ringkas pilihan pada keranjang/struk. Pilihan default (urutan pertama) tidak ditampilkan agar ringkas. */
export function describeCartItem(item: CartItem, cfg: CustomizationConfig): string[] {
  const parts: (string | null)[] = [
    item.temperature || null,
    item.size && item.size !== cfg.size[0]?.label ? item.size : null,
    item.sugarLevel && item.sugarLevel !== cfg.sugar[0]?.label ? item.sugarLevel : null,
    item.milkType && item.milkType !== cfg.milk[0]?.label ? item.milkType : null,
    ...(item.addons || []).map((a) => `+${a}`),
    item.extraShot && !(item.addons || []).length ? '+Extra Shot' : null,
  ];
  return parts.filter(Boolean) as string[];
}
