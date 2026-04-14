import { useState, useEffect, useCallback } from 'react';

interface PinPadProps {
  playerName: string;
  onSubmit: (pin: string) => Promise<boolean>;
  onBack: () => void;
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'back', '0', ''];

export function PinPad({ playerName, onSubmit, onBack }: PinPadProps) {
  const [digits, setDigits] = useState<string[]>([]);
  const [error, setError] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleKey = useCallback(
    (key: string) => {
      if (submitting) return;
      if (key === 'back') {
        setDigits((d) => d.slice(0, -1));
        return;
      }
      if (key === '' || digits.length >= 4) return;
      const next = [...digits, key];
      setDigits(next);
    },
    [digits, submitting]
  );

  // Keyboard support
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') handleKey(e.key);
      if (e.key === 'Backspace') handleKey('back');
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleKey]);

  // Auto-submit when 4 digits entered
  useEffect(() => {
    if (digits.length !== 4 || submitting) return;
    const run = async () => {
      setSubmitting(true);
      const ok = await onSubmit(digits.join(''));
      if (!ok) {
        setError(true);
        setTimeout(() => {
          setError(false);
          setDigits([]);
          setSubmitting(false);
        }, 600);
      }
    };
    void run();
  }, [digits, submitting, onSubmit]);

  return (
    <div className="flex flex-col items-center gap-8">
      {/* Back + name */}
      <div className="text-center">
        <button
          onClick={onBack}
          className="text-gray-500 hover:text-gray-300 text-xs uppercase tracking-widest mb-4 transition-colors"
        >
          ← Back
        </button>
        <p className="text-gray-400 text-xs uppercase tracking-widest mb-1">Authenticating</p>
        <h2 className="text-2xl font-bold text-gray-100">{playerName}</h2>
      </div>

      {/* PIN dots */}
      <div className={`flex gap-4 ${error ? 'animate-pin-shake' : ''}`}>
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={[
              'w-4 h-4 rounded-full border-2 transition-all duration-150',
              digits.length > i
                ? error
                  ? 'bg-red-500 border-red-500 shadow-[0_0_10px_rgba(239,68,68,0.7)]'
                  : 'bg-nexus-400 border-nexus-400 shadow-[0_0_10px_rgba(68,101,248,0.7)]'
                : 'bg-transparent border-gray-600',
            ].join(' ')}
          />
        ))}
      </div>

      {/* Number pad */}
      <div className="grid grid-cols-3 gap-3">
        {KEYS.map((key, i) => {
          if (key === '') return <div key={i} />;

          return (
            <button
              key={i}
              onClick={() => handleKey(key)}
              disabled={submitting}
              className={[
                'w-16 h-16 rounded-xl text-lg font-semibold transition-all duration-100',
                'focus:outline-none focus:ring-2 focus:ring-nexus-500',
                key === 'back'
                  ? 'bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-gray-200 text-sm'
                  : 'bg-gray-800 hover:bg-gray-700 active:bg-gray-600 text-gray-100',
                submitting ? 'opacity-50 cursor-not-allowed' : '',
              ].join(' ')}
            >
              {key === 'back' ? '⌫' : key}
            </button>
          );
        })}
      </div>

      {error && (
        <p className="text-red-400 text-sm animate-fade-in">Incorrect PIN. Try again.</p>
      )}
    </div>
  );
}
