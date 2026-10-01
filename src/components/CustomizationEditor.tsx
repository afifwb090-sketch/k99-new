import React, { useMemo, useState } from 'react';
import { Plus, Trash2, ArrowUp, RotateCcw, Check, ChevronDown, ChevronRight } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { CustomChoice, CustomGroupKey, CustomizationConfig } from '../types';
import {
  GROUP_KEYS,
  buildDefaultCustomization,
  mkChoice,
  normalizeCustomization,
} from '../utils/customization';
import { formatIDR } from '../utils/formatters';

const GROUP_META: Record<CustomGroupKey, { title: string; hint: string; newLabel: string }> = {
  temperature: { title: 'Suhu (Hot / Ice)', hint: 'Pilihan pertama = bawaan.', newLabel: 'Suhu baru' },
  size: { title: 'Ukuran (Size)', hint: 'Pilihan pertama = bawaan. Isi "Takaran resep +%" bila ukuran lebih besar memakai lebih banyak bahan.', newLabel: 'Size baru' },
  sugar: { title: 'Tingkat Gula (Sugar Level)', hint: 'Pilihan pertama = bawaan.', newLabel: 'Level gula baru' },
  milk: { title: 'Pilihan Susu', hint: 'Pilihan pertama = bawaan. Isi tambahan harga untuk susu premium.', newLabel: 'Susu baru' },
  addons: { title: 'Tambahan (Add-on)', hint: 'Bisa dipilih lebih dari satu. Hubungkan ke bahan baku agar stok ikut terpotong.', newLabel: 'Add-on baru' },
};

const inputCls =
  'w-full bg-neutral-950 border border-neutral-700 rounded-md px-2 py-1.5 text-white focus:outline-none focus:border-amber-500';

export const CustomizationEditor: React.FC = () => {
  const { customization, updateCustomization, rawMaterials } = useApp();
  const [draft, setDraft] = useState<CustomizationConfig>(() => normalizeCustomization(customization));
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(normalizeCustomization(customization)), [draft, customization]);

  const patch = (key: CustomGroupKey, id: string, change: Partial<CustomChoice>) => {
    setSaved(false);
    setDraft((d) => ({ ...d, [key]: d[key].map((c) => (c.id === id ? { ...c, ...change } : c)) }));
  };
  const add = (key: CustomGroupKey) => {
    setSaved(false);
    setDraft((d) => ({ ...d, [key]: [...d[key], mkChoice(GROUP_META[key].newLabel)] }));
  };
  const remove = (key: CustomGroupKey, id: string) => {
    setSaved(false);
    setDraft((d) => ({ ...d, [key]: d[key].filter((c) => c.id !== id) }));
  };
  const makeDefault = (key: CustomGroupKey, id: string) => {
    setSaved(false);
    setDraft((d) => {
      const target = d[key].find((c) => c.id === id);
      if (!target) return d;
      return { ...d, [key]: [target, ...d[key].filter((c) => c.id !== id)] };
    });
  };

  const handleSave = () => {
    // Validasi: label tidak boleh kosong / kembar dalam satu grup
    for (const key of GROUP_KEYS) {
      const labels = draft[key].map((c) => c.label.trim());
      if (labels.some((l) => !l)) {
        setError(`Ada pilihan tanpa nama di grup "${GROUP_META[key].title}".`);
        return;
      }
      if (new Set(labels.map((l) => l.toLowerCase())).size !== labels.length) {
        setError(`Ada nama pilihan yang kembar di grup "${GROUP_META[key].title}".`);
        return;
      }
      if (key !== 'addons' && labels.length === 0) {
        setError(`Grup "${GROUP_META[key].title}" minimal punya 1 pilihan.`);
        return;
      }
    }
    setError(null);
    const cleaned = {} as CustomizationConfig;
    for (const key of GROUP_KEYS) cleaned[key] = draft[key].map((c) => ({ ...c, label: c.label.trim() }));
    updateCustomization(cleaned);
    setDraft(cleaned);
    setSaved(true);
    setTimeout(() => setSaved(false), 3500);
  };

  const handleReset = () => {
    if (!window.confirm('Kembalikan semua pilihan kustomisasi ke bawaan (Ice/Hot, Regular/Large, dst)?')) return;
    setDraft(buildDefaultCustomization());
    setSaved(false);
  };

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 space-y-4 text-xs">
      <div className="flex items-start justify-between gap-3 pb-3 border-b border-neutral-800">
        <div>
          <h3 className="font-bold text-white text-sm">Kustomisasi Kasir</h3>
          <p className="text-neutral-400 mt-1 leading-relaxed">
            Ubah nama pilihan, tambahan harga, dan bahan yang ikut terpotong. Pilihan ini muncul di kasir untuk menu yang
            mengaktifkan opsi terkait. Kotak centang per menu (Hot/Ice, Size, dst) ada di bagian Daftar Menu.
          </p>
        </div>
        <button
          type="button"
          onClick={handleReset}
          className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-neutral-300 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded-lg"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Bawaan</span>
        </button>
      </div>

      {GROUP_KEYS.map((key) => {
        const meta = GROUP_META[key];
        const list = draft[key];
        return (
          <div key={key} className="space-y-2">
            <div>
              <span className="font-semibold text-neutral-200">{meta.title}</span>
              <span className="text-neutral-500 ml-2">{meta.hint}</span>
            </div>

            {list.length === 0 && <div className="text-neutral-500 italic">Belum ada pilihan.</div>}

            {list.map((c, idx) => {
              const adv = !!open[c.id];
              const hasAdv = !!(c.extraPercent || c.cost || c.materialId);
              return (
                <div key={c.id} className="bg-neutral-950 border border-neutral-800 rounded-lg p-2.5 space-y-2">
                  <div className="grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-12 sm:col-span-5">
                      <input
                        type="text"
                        value={c.label}
                        onChange={(e) => patch(key, c.id, { label: e.target.value })}
                        placeholder="Nama pilihan"
                        className={inputCls}
                      />
                    </div>
                    <div className="col-span-7 sm:col-span-4">
                      <div className="flex items-center gap-1">
                        <span className="text-neutral-500 shrink-0">+Rp</span>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          inputMode="decimal"
                          value={c.price || ''}
                          onChange={(e) => patch(key, c.id, { price: Math.max(0, Number(e.target.value) || 0) })}
                          placeholder="0"
                          className={`${inputCls} font-mono`}
                        />
                      </div>
                    </div>
                    <div className="col-span-5 sm:col-span-3 flex items-center justify-end gap-1">
                      {idx === 0 && key !== 'addons' ? (
                        <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/70 border border-emerald-800 px-1.5 py-0.5 rounded">
                          Bawaan
                        </span>
                      ) : (
                        key !== 'addons' && (
                          <button
                            type="button"
                            onClick={() => makeDefault(key, c.id)}
                            title="Jadikan pilihan bawaan"
                            className="p-1.5 text-neutral-400 hover:text-white bg-neutral-800 hover:bg-neutral-700 rounded-md border border-neutral-700"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                        )
                      )}
                      <button
                        type="button"
                        onClick={() => remove(key, c.id)}
                        disabled={key !== 'addons' && list.length <= 1}
                        title={key !== 'addons' && list.length <= 1 ? 'Minimal 1 pilihan' : 'Hapus pilihan'}
                        className="p-1.5 text-red-400 hover:text-white bg-red-950/40 hover:bg-red-700 rounded-md border border-red-900/60 disabled:opacity-30 disabled:hover:bg-red-950/40 disabled:hover:text-red-400"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setOpen((o) => ({ ...o, [c.id]: !adv }))}
                    className="flex items-center gap-1 text-[11px] text-neutral-400 hover:text-amber-300"
                  >
                    {adv ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                    <span>Takaran & bahan{hasAdv ? ' (aktif)' : ''}</span>
                  </button>

                  {adv && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                      <div>
                        <label className="block text-neutral-400 mb-1">Takaran resep +%</label>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={c.extraPercent || ''}
                          onChange={(e) => patch(key, c.id, { extraPercent: Number(e.target.value) || undefined })}
                          placeholder="mis. 25"
                          className={`${inputCls} font-mono`}
                        />
                      </div>
                      <div>
                        <label className="block text-neutral-400 mb-1">Tambah HPP (Rp)</label>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={c.cost || ''}
                          onChange={(e) => patch(key, c.id, { cost: Math.max(0, Number(e.target.value) || 0) })}
                          placeholder="0"
                          className={`${inputCls} font-mono`}
                        />
                      </div>
                      <div>
                        <label className="block text-neutral-400 mb-1">Potong bahan baku</label>
                        <select
                          value={c.materialId || ''}
                          onChange={(e) =>
                            patch(key, c.id, {
                              materialId: e.target.value || undefined,
                              materialQty: e.target.value ? c.materialQty || 1 : undefined,
                            })
                          }
                          className={inputCls}
                        >
                          <option value="">— tidak ada —</option>
                          {rawMaterials.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.name} ({m.unit})
                            </option>
                          ))}
                        </select>
                        {c.materialId && (
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={c.materialQty || ''}
                            onChange={(e) => patch(key, c.id, { materialQty: Number(e.target.value) || undefined })}
                            placeholder="jumlah per porsi"
                            className={`${inputCls} font-mono mt-1`}
                          />
                        )}
                      </div>
                      <p className="sm:col-span-3 text-[10px] text-neutral-500">
                        Harga jual +{formatIDR(c.price || 0)}. HPP otomatis ikut naik sesuai takaran, bahan, dan biaya tambahan.
                      </p>
                    </div>
                  )}
                </div>
              );
            })}

            <button
              type="button"
              onClick={() => add(key)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-lg"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Tambah pilihan</span>
            </button>
          </div>
        );
      })}

      {error && <div className="p-2.5 bg-red-950/60 border border-red-500/30 text-red-300 rounded-lg">{error}</div>}
      {saved && (
        <div className="p-2.5 bg-emerald-950/60 border border-emerald-500/30 text-emerald-300 rounded-lg flex items-center gap-2">
          <Check className="w-4 h-4" />
          <span>Kustomisasi tersimpan. Item yang sudah ada di keranjang tidak berubah; gunakan ikon pensil untuk menyesuaikannya.</span>
        </div>
      )}

      <div className="pt-3 border-t border-neutral-800 flex items-center justify-end gap-2">
        {dirty && <span className="text-amber-400">Ada perubahan belum disimpan</span>}
        <button
          type="button"
          onClick={handleSave}
          disabled={!dirty}
          className="px-5 py-2 font-bold text-white bg-amber-600 hover:bg-amber-500 rounded-lg shadow-sm disabled:opacity-40 disabled:hover:bg-amber-600"
        >
          Simpan Kustomisasi
        </button>
      </div>
    </div>
  );
};
