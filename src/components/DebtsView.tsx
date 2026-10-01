import React, { useMemo, useState } from 'react';
import {
  Plus,
  Search,
  X,
  Pencil,
  Trash2,
  ChevronDown,
  ChevronRight,
  HandCoins,
  AlertTriangle,
  CheckCircle2,
  Wallet,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { DebtKind, DebtRecord } from '../types';
import { formatIDR } from '../utils/formatters';

// --- helper tanggal (zona waktu lokal, bukan UTC) ------------------------------------
const todayStr = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const daysBetween = (from: string, to: string): number =>
  Math.round((Date.parse(`${to}T00:00:00`) - Date.parse(`${from}T00:00:00`)) / 86400000);

// Format tanggal lokal dari 'YYYY-MM-DD' (hindari pergeseran hari akibat zona waktu)
const formatDate = (iso: string): string => {
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime())
    ? iso
    : new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }).format(d);
};

const paidOf = (d: DebtRecord): number => d.payments.reduce((s, p) => s + p.amount, 0);
const remainingOf = (d: DebtRecord): number => Math.max(0, d.totalAmount - paidOf(d));

type DebtState = 'LUNAS' | 'TERLAMBAT' | 'SEGERA' | 'BERJALAN';
const stateOf = (d: DebtRecord): { state: DebtState; days: number | null } => {
  if (remainingOf(d) <= 0) return { state: 'LUNAS', days: null };
  if (!d.dueDate) return { state: 'BERJALAN', days: null };
  const days = daysBetween(todayStr(), d.dueDate); // negatif = sudah lewat
  if (days < 0) return { state: 'TERLAMBAT', days };
  if (days <= 7) return { state: 'SEGERA', days };
  return { state: 'BERJALAN', days };
};

const inputCls =
  'w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-amber-500';

const KIND_LABEL: Record<DebtKind, { title: string; party: string; pay: string; paid: string }> = {
  UTANG: { title: 'Utang ke Supplier', party: 'Supplier / Pemasok', pay: 'Bayar', paid: 'Terbayar' },
  PIUTANG: { title: 'Piutang (Tagihan ke Pihak Lain)', party: 'Nama Pelanggan / Pihak', pay: 'Terima Pembayaran', paid: 'Diterima' },
};

// =====================================================================================
export const DebtsView: React.FC = () => {
  const { debts, rawMaterials, deleteDebt, deleteDebtPayment } = useApp();

  const [kind, setKind] = useState<DebtKind>('UTANG');
  const [filter, setFilter] = useState<'open' | 'paid' | 'all'>('open');
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<DebtRecord | null>(null);
  const [paying, setPaying] = useState<DebtRecord | null>(null);

  const stats = useMemo(() => {
    const calc = (k: DebtKind) => {
      const open = debts.filter((d) => d.kind === k && remainingOf(d) > 0);
      const late = open.filter((d) => stateOf(d).state === 'TERLAMBAT');
      const soon = open.filter((d) => stateOf(d).state === 'SEGERA');
      return {
        outstanding: open.reduce((s, d) => s + remainingOf(d), 0),
        openCount: open.length,
        lateCount: late.length,
        lateAmount: late.reduce((s, d) => s + remainingOf(d), 0),
        soonCount: soon.length,
        soonAmount: soon.reduce((s, d) => s + remainingOf(d), 0),
      };
    };
    return { UTANG: calc('UTANG'), PIUTANG: calc('PIUTANG') };
  }, [debts]);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return debts
      .filter((d) => d.kind === kind)
      .filter((d) => (filter === 'open' ? remainingOf(d) > 0 : filter === 'paid' ? remainingOf(d) <= 0 : true))
      .filter((d) => !q || d.party.toLowerCase().includes(q) || d.description.toLowerCase().includes(q))
      .sort((a, b) => {
        // belum lunas dulu, lalu jatuh tempo terdekat, lalu terbaru
        const ra = remainingOf(a) > 0 ? 0 : 1;
        const rb = remainingOf(b) > 0 ? 0 : 1;
        if (ra !== rb) return ra - rb;
        const da = a.dueDate || '9999-12-31';
        const db = b.dueDate || '9999-12-31';
        if (da !== db) return da < db ? -1 : 1;
        return b.timestamp.localeCompare(a.timestamp);
      });
  }, [debts, kind, filter, query]);

  // Ringkasan per pihak (supplier) untuk yang belum lunas
  const byParty = useMemo(() => {
    const map = new Map<string, { total: number; count: number }>();
    debts
      .filter((d) => d.kind === kind && remainingOf(d) > 0)
      .forEach((d) => {
        const key = d.party;
        const cur = map.get(key) || { total: 0, count: 0 };
        map.set(key, { total: cur.total + remainingOf(d), count: cur.count + 1 });
      });
    return Array.from(map.entries()).sort((a, b) => b[1].total - a[1].total);
  }, [debts, kind]);

  const s = stats[kind];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Utang & Piutang</h2>
          <p className="text-xs text-neutral-400 mt-0.5">
            Catat bahan baku yang dipesan tempo, pantau jatuh tempo, dan cicilan pembayarannya.
          </p>
        </div>
        <button
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
          className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-500 rounded-lg shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>Catat {kind === 'UTANG' ? 'Utang' : 'Piutang'}</span>
        </button>
      </div>

      {/* Tab jenis */}
      <div className="inline-flex p-1 bg-neutral-900 border border-neutral-800 rounded-lg text-xs">
        {(['UTANG', 'PIUTANG'] as DebtKind[]).map((k) => (
          <button
            key={k}
            onClick={() => setKind(k)}
            className={`px-4 py-1.5 rounded-md font-semibold transition-colors ${
              kind === k ? 'bg-amber-600 text-white' : 'text-neutral-400 hover:text-white'
            }`}
          >
            {k === 'UTANG' ? `Utang (${stats.UTANG.openCount})` : `Piutang (${stats.PIUTANG.openCount})`}
          </button>
        ))}
      </div>

      {/* Ringkasan */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
          <div className="flex items-center gap-2 text-neutral-400 text-xs">
            <Wallet className="w-4 h-4 text-amber-400" />
            <span>{kind === 'UTANG' ? 'Total utang belum lunas' : 'Total piutang belum lunas'}</span>
          </div>
          <div className="mt-1 text-xl font-bold text-amber-400 font-mono tabular-nums">{formatIDR(s.outstanding)}</div>
          <div className="text-[11px] text-neutral-500">{s.openCount} catatan</div>
        </div>
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
          <div className="flex items-center gap-2 text-neutral-400 text-xs">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            <span>Terlambat (lewat jatuh tempo)</span>
          </div>
          <div className="mt-1 text-xl font-bold text-red-400 font-mono tabular-nums">{formatIDR(s.lateAmount)}</div>
          <div className="text-[11px] text-neutral-500">{s.lateCount} catatan</div>
        </div>
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
          <div className="flex items-center gap-2 text-neutral-400 text-xs">
            <HandCoins className="w-4 h-4 text-sky-400" />
            <span>Jatuh tempo ≤ 7 hari</span>
          </div>
          <div className="mt-1 text-xl font-bold text-sky-300 font-mono tabular-nums">{formatIDR(s.soonAmount)}</div>
          <div className="text-[11px] text-neutral-500">{s.soonCount} catatan</div>
        </div>
      </div>

      {/* Ringkasan per pihak */}
      {byParty.length > 0 && (
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
          <div className="text-xs font-semibold text-neutral-300 mb-2">
            {kind === 'UTANG' ? 'Sisa utang per supplier' : 'Sisa piutang per pihak'}
          </div>
          <div className="flex flex-wrap gap-2">
            {byParty.map(([name, v]) => (
              <button
                key={name}
                onClick={() => setQuery(name)}
                className="px-3 py-1.5 bg-neutral-950 border border-neutral-800 hover:border-amber-500/50 rounded-lg text-xs text-left"
                title="Klik untuk memfilter"
              >
                <span className="text-white font-semibold">{name}</span>
                <span className="text-amber-400 font-mono ml-2 tabular-nums">{formatIDR(v.total)}</span>
                <span className="text-neutral-500 ml-1">· {v.count}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari supplier / keterangan..."
            className={`${inputCls} pl-8`}
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <div className="inline-flex p-1 bg-neutral-900 border border-neutral-800 rounded-lg">
          {([
            ['open', 'Belum lunas'],
            ['paid', 'Lunas'],
            ['all', 'Semua'],
          ] as const).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setFilter(k)}
              className={`px-3 py-1 rounded-md font-medium ${
                filter === k ? 'bg-neutral-700 text-white' : 'text-neutral-400 hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Daftar */}
      {list.length === 0 ? (
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-10 text-center text-neutral-500 text-sm">
          {debts.filter((d) => d.kind === kind).length === 0
            ? kind === 'UTANG'
              ? 'Belum ada utang. Saat restock, centang "Beli tempo" atau klik "Catat Utang" untuk mencatat bahan yang dipesan tempo.'
              : 'Belum ada piutang tercatat.'
            : 'Tidak ada catatan yang cocok dengan filter.'}
        </div>
      ) : (
        <div className="space-y-2.5">
          {list.map((d) => {
            const paid = paidOf(d);
            const remaining = remainingOf(d);
            const pct = d.totalAmount > 0 ? Math.min(100, Math.round((paid / d.totalAmount) * 100)) : 0;
            const st = stateOf(d);
            const isOpen = !!expanded[d.id];
            return (
              <div key={d.id} className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 space-y-3 text-xs">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold text-white">{d.party}</span>
                      {st.state === 'LUNAS' && (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-950/80 border border-emerald-800 px-2 py-0.5 rounded">
                          <CheckCircle2 className="w-3 h-3" /> Lunas
                        </span>
                      )}
                      {st.state === 'TERLAMBAT' && (
                        <span className="text-[10px] font-bold text-red-400 bg-red-950/80 border border-red-800 px-2 py-0.5 rounded">
                          Terlambat {Math.abs(st.days!)} hari
                        </span>
                      )}
                      {st.state === 'SEGERA' && (
                        <span className="text-[10px] font-bold text-amber-400 bg-amber-950/80 border border-amber-800 px-2 py-0.5 rounded">
                          {st.days === 0 ? 'Jatuh tempo hari ini' : `Jatuh tempo ${st.days} hari lagi`}
                        </span>
                      )}
                    </div>
                    <div className="text-neutral-300 mt-0.5">{d.description || '—'}</div>
                    <div className="text-[11px] text-neutral-500 mt-0.5">
                      Dicatat {formatDate(d.date)}
                      {d.dueDate ? ` · Jatuh tempo ${formatDate(d.dueDate)}` : ' · Tanpa jatuh tempo'}
                      {d.notes ? ` · ${d.notes}` : ''}
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-[11px] text-neutral-500">Sisa</div>
                    <div
                      className={`text-lg font-bold font-mono tabular-nums ${
                        remaining > 0 ? 'text-amber-400' : 'text-emerald-400'
                      }`}
                    >
                      {formatIDR(remaining)}
                    </div>
                    <div className="text-[11px] text-neutral-500 font-mono tabular-nums">
                      dari {formatIDR(d.totalAmount)}
                    </div>
                  </div>
                </div>

                {/* Progress */}
                <div>
                  <div className="h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${remaining > 0 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-neutral-500 mt-1">
                    <span>
                      {KIND_LABEL[d.kind].paid} {formatIDR(paid)} ({pct}%)
                    </span>
                    <span>{d.payments.length} pembayaran</span>
                  </div>
                </div>

                {/* Aksi */}
                <div className="flex flex-wrap items-center gap-2">
                  {remaining > 0 && (
                    <button
                      onClick={() => setPaying(d)}
                      className="px-3 py-1.5 font-semibold text-white bg-emerald-700 hover:bg-emerald-600 rounded-lg"
                    >
                      {KIND_LABEL[d.kind].pay}
                    </button>
                  )}
                  <button
                    onClick={() => setExpanded((e) => ({ ...e, [d.id]: !isOpen }))}
                    className="flex items-center gap-1 px-3 py-1.5 text-neutral-300 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded-lg"
                  >
                    {isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                    <span>Riwayat</span>
                  </button>
                  <button
                    onClick={() => {
                      setEditing(d);
                      setFormOpen(true);
                    }}
                    className="p-1.5 text-sky-300 hover:text-white bg-sky-500/10 hover:bg-sky-500/25 rounded-lg border border-sky-500/30"
                    title="Edit"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => {
                      const extra = d.payments.length
                        ? ' Pembayaran yang sudah tercatat (dan pengeluarannya di Laporan Keuangan) ikut dihapus.'
                        : '';
                      if (window.confirm(`Hapus catatan ${d.kind === 'UTANG' ? 'utang' : 'piutang'} "${d.party}"?${extra}`)) {
                        deleteDebt(d.id);
                      }
                    }}
                    className="p-1.5 text-red-400 hover:text-white bg-red-950/40 hover:bg-red-700 rounded-lg border border-red-900/60"
                    title="Hapus"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Riwayat pembayaran */}
                {isOpen && (
                  <div className="border-t border-neutral-800 pt-3">
                    {d.payments.length === 0 ? (
                      <div className="text-neutral-500 italic">Belum ada pembayaran.</div>
                    ) : (
                      <div className="space-y-1.5">
                        {d.payments.map((p) => (
                          <div
                            key={p.id}
                            className="flex items-center justify-between gap-2 bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2"
                          >
                            <div>
                              <span className="text-white font-mono tabular-nums">{formatIDR(p.amount)}</span>
                              <span className="text-neutral-500 ml-2">
                                {formatDate(p.date)} · {p.method}
                                {p.notes ? ` · ${p.notes}` : ''}
                              </span>
                            </div>
                            <button
                              onClick={() => {
                                if (window.confirm('Hapus pembayaran ini?')) deleteDebtPayment(d.id, p.id);
                              }}
                              className="text-neutral-500 hover:text-red-400 p-1"
                              title="Hapus pembayaran"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {formOpen && (
        <DebtFormModal
          kind={kind}
          editing={editing}
          suppliers={Array.from(new Set(rawMaterials.map((m) => m.supplier).filter(Boolean)))}
          onClose={() => {
            setFormOpen(false);
            setEditing(null);
          }}
        />
      )}
      {paying && <PayModal debt={paying} onClose={() => setPaying(null)} />}
    </div>
  );
};

// =====================================================================================
const Backdrop: React.FC<{ title: string; onClose: () => void; children: React.ReactNode }> = ({
  title,
  onClose,
  children,
}) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
    <div className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden shadow-2xl max-h-[92vh] flex flex-col">
      <div className="flex items-center justify-between px-5 py-3 border-b border-neutral-800">
        <h3 className="text-sm font-bold text-white">{title}</h3>
        <button onClick={onClose} className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="overflow-y-auto">{children}</div>
    </div>
  </div>
);

const DebtFormModal: React.FC<{
  kind: DebtKind;
  editing: DebtRecord | null;
  suppliers: string[];
  onClose: () => void;
}> = ({ kind, editing, suppliers, onClose }) => {
  const { addDebt, updateDebt } = useApp();
  const k = editing ? editing.kind : kind;

  const [party, setParty] = useState(editing?.party || '');
  const [description, setDescription] = useState(editing?.description || '');
  const [total, setTotal] = useState<string>(editing ? String(editing.totalAmount) : '');
  const [date, setDate] = useState(editing?.date || todayStr());
  const [dueDate, setDueDate] = useState(editing?.dueDate || '');
  const [notes, setNotes] = useState(editing?.notes || '');
  const [error, setError] = useState<string | null>(null);

  const alreadyPaid = editing ? paidOf(editing) : 0;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(total) || 0;
    if (!party.trim()) return setError('Nama wajib diisi.');
    if (amount <= 0) return setError('Nominal harus lebih dari 0.');
    if (amount < alreadyPaid) return setError(`Nominal tidak boleh kurang dari yang sudah dibayar (${formatIDR(alreadyPaid)}).`);

    if (editing) {
      updateDebt({
        ...editing,
        party: party.trim(),
        description: description.trim(),
        totalAmount: amount,
        date,
        dueDate: dueDate || undefined,
        notes: notes.trim() || undefined,
      });
    } else {
      addDebt({ kind: k, party, description, totalAmount: amount, date, dueDate: dueDate || undefined, notes });
    }
    onClose();
  };

  return (
    <Backdrop title={`${editing ? 'Edit' : 'Catat'} ${KIND_LABEL[k].title}`} onClose={onClose}>
      <form onSubmit={submit} className="p-5 space-y-3 text-xs">
        <div>
          <label className="block text-neutral-300 font-semibold mb-1">{KIND_LABEL[k].party}</label>
          <input
            list="debt-parties"
            value={party}
            onChange={(e) => setParty(e.target.value)}
            placeholder={k === 'UTANG' ? 'Contoh: Toko Kopi Nusantara' : 'Contoh: Pak Budi'}
            className={inputCls}
            autoFocus
          />
          <datalist id="debt-parties">
            {suppliers.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </div>
        <div>
          <label className="block text-neutral-300 font-semibold mb-1">Keterangan / Barang</label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Contoh: Biji kopi Arabika 5 kg, susu 12 liter"
            className={inputCls}
          />
        </div>
        <div>
          <label className="block text-neutral-300 font-semibold mb-1">Total Nominal (Rp)</label>
          <input
            type="number"
            min="0"
            step="any"
            inputMode="decimal"
            value={total}
            onChange={(e) => setTotal(e.target.value)}
            className={`${inputCls} font-mono`}
            placeholder="0"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-neutral-300 font-semibold mb-1">Tanggal</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-neutral-300 font-semibold mb-1">Jatuh Tempo</label>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputCls} />
          </div>
        </div>
        <div>
          <label className="block text-neutral-300 font-semibold mb-1">Catatan (opsional)</label>
          <input value={notes} onChange={(e) => setNotes(e.target.value)} className={inputCls} placeholder="No. faktur, kesepakatan tempo, dll." />
        </div>

        {!editing && k === 'UTANG' && (
          <p className="text-[11px] text-neutral-500 leading-relaxed">
            Mencatat utang di sini tidak menambah stok. Untuk bahan yang sekaligus menambah stok, gunakan{' '}
            <span className="text-neutral-300">Restock → Beli tempo</span> di menu Bahan Baku.
          </p>
        )}
        {error && <div className="p-2 bg-red-950/60 border border-red-500/30 text-red-300 rounded-lg">{error}</div>}

        <div className="pt-3 border-t border-neutral-800 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-neutral-400 hover:text-white bg-neutral-800 rounded-lg">
            Batal
          </button>
          <button type="submit" className="px-5 py-2 font-bold text-white bg-amber-600 hover:bg-amber-500 rounded-lg shadow-sm">
            Simpan
          </button>
        </div>
      </form>
    </Backdrop>
  );
};

const PayModal: React.FC<{ debt: DebtRecord; onClose: () => void }> = ({ debt, onClose }) => {
  const { addDebtPayment } = useApp();
  const remaining = remainingOf(debt);
  const [amount, setAmount] = useState<string>(String(remaining));
  const [date, setDate] = useState(todayStr());
  const [method, setMethod] = useState<'Kas Tunai' | 'Rekening Bank'>('Kas Tunai');
  const [notes, setNotes] = useState('');
  const [asExpense, setAsExpense] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = Number(amount) || 0;
    if (val <= 0) return setError('Nominal pembayaran harus lebih dari 0.');
    if (val > remaining) return setError(`Melebihi sisa (${formatIDR(remaining)}).`);
    addDebtPayment(debt.id, { amount: val, date, method, notes, recordAsExpense: asExpense });
    onClose();
  };

  return (
    <Backdrop title={`${KIND_LABEL[debt.kind].pay} — ${debt.party}`} onClose={onClose}>
      <form onSubmit={submit} className="p-5 space-y-3 text-xs">
        <div className="p-3 bg-neutral-950 border border-neutral-800 rounded-lg flex items-center justify-between">
          <span className="text-neutral-400">Sisa {debt.kind === 'UTANG' ? 'utang' : 'piutang'}</span>
          <span className="text-amber-400 font-bold font-mono tabular-nums">{formatIDR(remaining)}</span>
        </div>

        <div>
          <label className="block text-neutral-300 font-semibold mb-1">Nominal (Rp)</label>
          <div className="flex gap-2">
            <input
              type="number"
              min="0"
              step="any"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className={`${inputCls} font-mono`}
              autoFocus
            />
            <button
              type="button"
              onClick={() => setAmount(String(remaining))}
              className="shrink-0 px-3 text-emerald-300 bg-emerald-950/40 hover:bg-emerald-900/60 border border-emerald-800 rounded-lg font-semibold"
            >
              Lunasi
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-neutral-300 font-semibold mb-1">Tanggal</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-neutral-300 font-semibold mb-1">{debt.kind === 'UTANG' ? 'Sumber dana' : 'Diterima lewat'}</label>
            <select value={method} onChange={(e) => setMethod(e.target.value as 'Kas Tunai' | 'Rekening Bank')} className={inputCls}>
              <option value="Kas Tunai">Kas Tunai</option>
              <option value="Rekening Bank">Rekening Bank</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-neutral-300 font-semibold mb-1">Catatan (opsional)</label>
          <input value={notes} onChange={(e) => setNotes(e.target.value)} className={inputCls} placeholder="Cicilan ke-1, transfer BCA, dll." />
        </div>

        {debt.kind === 'UTANG' && (
          <label className="flex items-start gap-2 cursor-pointer p-3 bg-neutral-950 border border-neutral-800 rounded-lg">
            <input type="checkbox" checked={asExpense} onChange={(e) => setAsExpense(e.target.checked)} className="mt-0.5 rounded text-amber-600" />
            <span className="text-neutral-300 leading-snug">
              Catat sebagai pengeluaran di Laporan Keuangan (arus kas keluar)
              <span className="block text-[11px] text-neutral-500">Matikan bila pembayaran ini sudah kamu catat sebagai beban di tempat lain.</span>
            </span>
          </label>
        )}

        {error && <div className="p-2 bg-red-950/60 border border-red-500/30 text-red-300 rounded-lg">{error}</div>}

        <div className="pt-3 border-t border-neutral-800 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-neutral-400 hover:text-white bg-neutral-800 rounded-lg">
            Batal
          </button>
          <button type="submit" className="px-5 py-2 font-bold text-white bg-emerald-700 hover:bg-emerald-600 rounded-lg shadow-sm">
            Simpan Pembayaran
          </button>
        </div>
      </form>
    </Backdrop>
  );
};
