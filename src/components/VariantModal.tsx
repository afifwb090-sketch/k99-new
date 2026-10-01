import React, { useMemo, useState } from 'react';
import { X, Check, Plus, Save } from 'lucide-react';
import { MenuItem, CartItem, CustomChoice } from '../types';
import { formatIDR } from '../utils/formatters';
import { useApp } from '../context/AppContext';
import { computeLine, withDefaults } from '../utils/customization';

interface VariantModalProps {
  item: MenuItem;
  onClose: () => void;
  onAddToCart: (customization: Partial<CartItem>) => void;
  /** Isi awal pilihan (dipakai saat mengedit item yang sudah ada di keranjang) */
  initial?: Partial<CartItem>;
  /** Teks tombol konfirmasi; bawaan "Masukkan Pesanan" */
  confirmLabel?: string;
}

const chip = (active: boolean) =>
  `flex items-center justify-between gap-2 py-2.5 px-3 rounded-lg border text-xs font-medium transition-colors text-left ${
    active
      ? 'bg-amber-600/20 border-amber-500 text-white'
      : 'bg-neutral-800/60 border-neutral-700 text-neutral-400 hover:text-neutral-200'
  }`;

const priceTag = (c: CustomChoice) =>
  Number(c.price) > 0 ? (
    <span className="text-amber-400 font-semibold tabular-nums shrink-0">+{formatIDR(Number(c.price))}</span>
  ) : null;

export const VariantModal: React.FC<VariantModalProps> = ({ item, onClose, onAddToCart, initial, confirmLabel }) => {
  const { rawMaterials, calculateRecipeCOGS, customization } = useApp();

  const start = useMemo(
    () =>
      withDefaults(
        item,
        {
          temperature: initial?.temperature,
          size: initial?.size,
          sugarLevel: initial?.sugarLevel,
          milkType: initial?.milkType,
          addons: initial?.addons,
          notes: initial?.notes,
        },
        customization
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const [temperature, setTemperature] = useState<string | undefined>(start.temperature);
  const [size, setSize] = useState<string | undefined>(start.size);
  const [sugarLevel, setSugarLevel] = useState<string | undefined>(start.sugarLevel);
  const [milkType, setMilkType] = useState<string | undefined>(start.milkType);
  const [addons, setAddons] = useState<string[]>(start.addons || []);
  const [notes, setNotes] = useState<string>(start.notes || '');

  const toggleAddon = (label: string) =>
    setAddons((prev) => (prev.includes(label) ? prev.filter((a) => a !== label) : [...prev, label]));

  // Harga & HPP langsung, memakai rumus yang sama dengan keranjang
  const live = computeLine(
    item,
    { temperature, size, sugarLevel, milkType, addons },
    customization,
    rawMaterials,
    calculateRecipeCOGS(item.recipe)
  );
  const totalPrice = live.basePrice;
  const liveHPP = live.calculatedCost;
  const margin = totalPrice > 0 ? Math.round(((totalPrice - liveHPP) / totalPrice) * 100) : 0;

  const handleConfirm = () => {
    onAddToCart({
      temperature,
      size,
      sugarLevel,
      milkType,
      addons: addons.length ? addons : undefined,
      notes: notes.trim() || undefined,
    });
    onClose();
  };

  const renderGroup = (
    title: string,
    list: CustomChoice[],
    value: string | undefined,
    onPick: (label: string) => void,
    cols: string
  ) => (
    <div>
      <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-2">{title}</label>
      <div className={`grid ${cols} gap-2`}>
        {list.map((c) => (
          <button key={c.id} type="button" onClick={() => onPick(c.label)} className={chip(value === c.label)}>
            <span>{c.label}</span>
            {priceTag(c)}
          </button>
        ))}
      </div>
    </div>
  );

  const colsFor = (n: number) => (n <= 2 ? 'grid-cols-2' : n === 3 ? 'grid-cols-3' : 'grid-cols-2');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4">
      <div className="w-full max-w-lg bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 bg-neutral-900/50">
          <div>
            <h3 className="text-lg font-bold text-white leading-snug">{item.name}</h3>
            <div className="flex items-center gap-2 text-xs text-neutral-400 mt-0.5">
              <span>{item.category}</span>
              <span>·</span>
              <span className="text-amber-400 font-semibold tabular-nums">{formatIDR(item.price)}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-4 overflow-y-auto space-y-5 text-sm">
          {item.allowsTemperatureChoice &&
            renderGroup('Suhu Penyajian', customization.temperature, temperature, setTemperature, colsFor(customization.temperature.length))}
          {item.allowsSizeChoice &&
            renderGroup('Ukuran Cup (Size)', customization.size, size, setSize, colsFor(customization.size.length))}
          {item.allowsSugarLevel &&
            renderGroup('Tingkat Gula (Sugar Level)', customization.sugar, sugarLevel, setSugarLevel, colsFor(customization.sugar.length))}
          {item.allowsMilkOptions &&
            renderGroup('Pilihan Susu', customization.milk, milkType, setMilkType, 'grid-cols-1')}

          {/* Add-on (boleh pilih lebih dari satu) */}
          {customization.addons.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-2">
                Tambahan (Add-on)
              </label>
              <div className="space-y-1.5">
                {customization.addons.map((a) => {
                  const on = addons.includes(a.label);
                  return (
                    <button key={a.id} type="button" onClick={() => toggleAddon(a.label)} className={`w-full ${chip(on)}`}>
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-4 h-4 rounded flex items-center justify-center ${
                            on ? 'bg-amber-500 text-black' : 'border border-neutral-600'
                          }`}
                        >
                          {on && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                        <span>{a.label}</span>
                      </div>
                      {priceTag(a)}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Catatan */}
          <div>
            <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1.5">
              Catatan Khusus (Optional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Contoh: Pisah es, jangan terlalu manis..."
              className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* Ringkasan HPP */}
          <div className="p-3 bg-neutral-950/70 border border-neutral-800 rounded-lg flex items-center justify-between text-xs">
            <span className="text-neutral-400">Estimasi HPP Bahan Baku:</span>
            <div className="text-right">
              <span className="text-neutral-300 font-mono tabular-nums">{formatIDR(Math.round(liveHPP))}</span>
              <span className="text-[11px] text-emerald-400 ml-2">(Margin ~{margin}%)</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-neutral-800 bg-neutral-900/80 flex items-center justify-between">
          <div>
            <span className="text-xs text-neutral-400 block">Total Harga</span>
            <span className="text-lg font-bold text-amber-400 font-mono tabular-nums">{formatIDR(totalPrice)}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-neutral-400 hover:text-white bg-neutral-800 rounded-lg transition-colors"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className="flex items-center gap-1.5 px-5 py-2 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-500 rounded-lg shadow-sm transition-colors"
            >
              {initial ? <Save className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              <span>{confirmLabel || (initial ? 'Simpan Perubahan' : 'Masukkan Pesanan')}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
