import { useEffect, useState, FormEvent } from 'react';
import { apiFetch } from '../hooks/useApi';
import { useApp } from '../context/AppContext';

interface PlayerEntry {
  id: number;
  name: string;
  role: string;
  active_character_id: number | null;
  created_at: string;
}

export function PlayersManager() {
  const { notify } = useApp();
  const [players, setPlayers] = useState<PlayerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', pin: '', role: 'player' });
  const [pinConfirm, setPinConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [changingPin, setChangingPin] = useState<number | null>(null);
  const [newPin, setNewPin] = useState('');

  const load = async () => {
    setLoading(true);
    const res = await apiFetch<PlayerEntry[]>('/api/players');
    if (res.success && res.data) setPlayers(res.data);
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!/^\d{4}$/.test(form.pin)) {
      notify('error', 'PIN must be exactly 4 digits');
      return;
    }
    if (form.pin !== pinConfirm) {
      notify('error', 'PINs do not match');
      return;
    }
    setSubmitting(true);
    const res = await apiFetch<PlayerEntry>('/api/players', {
      method: 'POST',
      body: JSON.stringify({ name: form.name, pin: form.pin, role: form.role }),
    });
    setSubmitting(false);
    if (res.success) {
      notify('success', `Operator "${form.name}" created`);
      setForm({ name: '', pin: '', role: 'player' });
      setPinConfirm('');
      setShowForm(false);
      void load();
    } else {
      notify('error', res.error ?? 'Failed to create operator');
    }
  };

  const handleChangePin = async (id: number) => {
    if (!/^\d{4}$/.test(newPin)) {
      notify('error', 'PIN must be exactly 4 digits');
      return;
    }
    const res = await apiFetch(`/api/players/${id}/pin`, {
      method: 'PUT',
      body: JSON.stringify({ pin: newPin }),
    });
    if (res.success) {
      notify('success', 'PIN updated');
      setChangingPin(null);
      setNewPin('');
    } else {
      notify('error', 'Failed to update PIN');
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Delete operator "${name}"? This cannot be undone.`)) return;
    const res = await fetch(`/api/players/${id}`, { method: 'DELETE' });
    if (res.status === 204) {
      notify('success', `Operator "${name}" removed`);
      void load();
    } else {
      notify('error', 'Delete failed');
    }
  };

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">Players</h1>
          <p className="text-gray-500 text-sm mt-1">{players.length} operators registered</p>
        </div>
        <button onClick={() => setShowForm((v) => !v)} className="btn-primary">
          {showForm ? '✕ Cancel' : '+ New Operator'}
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <form onSubmit={handleCreate} className="card border-nexus-800 space-y-4">
          <h2 className="text-sm font-semibold text-nexus-300 uppercase tracking-widest">
            New Operator
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Name *</label>
              <input
                className="input"
                placeholder="Captain Vex"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Role</label>
              <select
                className="input"
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
              >
                <option value="player">Player</option>
                <option value="gm">GM</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">4-digit PIN *</label>
              <input
                className="input"
                type="password"
                inputMode="numeric"
                maxLength={4}
                placeholder="••••"
                value={form.pin}
                onChange={(e) => setForm({ ...form, pin: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                required
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Confirm PIN *</label>
              <input
                className="input"
                type="password"
                inputMode="numeric"
                maxLength={4}
                placeholder="••••"
                value={pinConfirm}
                onChange={(e) => setPinConfirm(e.target.value.replace(/\D/g, '').slice(0, 4))}
                required
              />
            </div>
          </div>
          <button type="submit" disabled={submitting} className="btn-primary">
            {submitting ? 'Creating…' : 'Create Operator'}
          </button>
        </form>
      )}

      {/* Player cards */}
      {loading ? (
        <div className="text-center text-gray-700 py-12">Loading…</div>
      ) : players.length === 0 ? (
        <div className="text-center text-gray-700 py-12">No operators yet.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {players.map((p) => (
            <div key={p.id} className="card group space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center font-bold text-gray-300">
                    {p.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-gray-200 font-semibold">{p.name}</p>
                    <span
                      className={`text-xs uppercase tracking-wider ${
                        p.role === 'gm' ? 'text-nexus-400' : 'text-gray-500'
                      }`}
                    >
                      {p.role === 'gm' ? '★ GM' : 'Player'}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => void handleDelete(p.id, p.name)}
                  className="opacity-0 group-hover:opacity-100 text-gray-700 hover:text-red-400 text-xs transition-all"
                >
                  Delete
                </button>
              </div>

              {/* Change PIN */}
              {changingPin === p.id ? (
                <div className="flex gap-2">
                  <input
                    className="input text-sm py-1"
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    placeholder="New PIN"
                    value={newPin}
                    onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    autoFocus
                  />
                  <button
                    onClick={() => void handleChangePin(p.id)}
                    className="btn-primary text-xs px-3 py-1 shrink-0"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => { setChangingPin(null); setNewPin(''); }}
                    className="btn-secondary text-xs px-3 py-1 shrink-0"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setChangingPin(p.id)}
                  className="text-gray-600 hover:text-gray-400 text-xs transition-colors"
                >
                  Change PIN
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
