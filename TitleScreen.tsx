import React, { useState } from 'react';
import { Swords, UserPlus, LogIn, Maximize2 } from 'lucide-react';
import { enterLandscapeFullscreen } from './LandscapeGuard.tsx';
import { PWAInstallButton } from './PWAInstallButton.tsx';

interface TitleScreenProps {
  onAuthSuccess: (token: string, profile: any) => void;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({ onAuthSuccess }) => {
  const [mode, setMode] = useState<'login' | 'register'>('register');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const endpoint = mode === 'register' ? '/api/auth/register' : '/api/auth/login';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Authentication failed');
        setLoading(false);
        return;
      }
      onAuthSuccess(data.token, data.profile);
    } catch {
      setError('Unable to reach Wild Arena server.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pointer-events-none fixed inset-0 z-20 flex flex-col items-center justify-between p-4 sm:p-6">
      <div className="pointer-events-auto flex w-full items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => void enterLandscapeFullscreen()}
          className="flex items-center gap-1.5 rounded-xl border border-white/15 bg-[#0b1310]/90 px-3 py-2 text-xs font-bold text-stone-200 hover:border-[#d4a84b]"
          title="Enter Landscape Fullscreen"
        >
          <Maximize2 className="h-3.5 w-3.5 text-[#d4a84b]" />
          <span>Fullscreen</span>
        </button>
        <PWAInstallButton />
      </div>

      {/* Top negative space with bespoke SVG Title Lockup */}
      <div className="mt-1 flex flex-col items-center text-center">
        <svg
          viewBox="0 0 560 110"
          className="h-20 w-auto drop-shadow-[0_6px_18px_rgba(0,0,0,0.85)] sm:h-28"
          aria-label="WILD ARENA"
        >
          <defs>
            <linearGradient id="wildGold" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#fff3c4" />
              <stop offset="50%" stopColor="#e5b84b" />
              <stop offset="100%" stopColor="#9c6b19" />
            </linearGradient>
          </defs>
          <path
            d="M40 55 L75 35 L75 75 Z M520 55 L485 35 L485 75 Z"
            fill="#d4a84b"
            opacity="0.85"
          />
          <line x1="90" y1="55" x2="135" y2="55" stroke="#d4a84b" strokeWidth="2" opacity="0.7" />
          <line x1="425" y1="55" x2="470" y2="55" stroke="#d4a84b" strokeWidth="2" opacity="0.7" />
          <text
            x="280"
            y="66"
            textAnchor="middle"
            fill="url(#wildGold)"
            fontFamily="Cinzel, Georgia, serif"
            fontWeight="900"
            fontSize="54"
            letterSpacing="6"
          >
            WILD ARENA
          </text>
          <text
            x="280"
            y="95"
            textAnchor="middle"
            fill="#d8e3db"
            fontFamily="Inter, sans-serif"
            fontWeight="700"
            fontSize="13"
            letterSpacing="5"
          >
            ULTIMATE 3D ONLINE FIGHTING RPG
          </text>
        </svg>
      </div>

      {/* Center Auth / Enter Arena Card */}
      <div className="pointer-events-auto w-full max-w-sm rounded-2xl border border-[#d4a84b]/60 bg-[#0b1310]/95 p-6 shadow-2xl">
        <div className="mb-4 grid grid-cols-2 gap-1.5 rounded-xl bg-[#131e19] p-1">
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setError('');
            }}
            className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-extrabold uppercase ${
              mode === 'register' ? 'bg-[#d4a84b] text-[#0c120f]' : 'text-stone-300'
            }`}
          >
            <UserPlus className="h-3.5 w-3.5" /> Create Account
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setError('');
            }}
            className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-extrabold uppercase ${
              mode === 'login' ? 'bg-[#d4a84b] text-[#0c120f]' : 'text-stone-300'
            }`}
          >
            <LogIn className="h-3.5 w-3.5" /> Sign In
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-stone-400">
              Warrior Username
            </label>
            <input
              type="text"
              required
              minLength={3}
              maxLength={20}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. Kael_Blade"
              className="w-full rounded-lg border border-white/15 bg-[#121c17] px-3 py-2.5 text-sm text-white placeholder:text-stone-500 focus:border-[#d4a84b] focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-stone-400">
              Password
            </label>
            <input
              type="password"
              required
              minLength={4}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min 4 characters"
              className="w-full rounded-lg border border-white/15 bg-[#121c17] px-3 py-2.5 text-sm text-white placeholder:text-stone-500 focus:border-[#d4a84b] focus:outline-none"
            />
          </div>

          {error && (
            <div className="rounded-lg border border-rose-500/50 bg-[#2b1015] px-3 py-2 text-xs font-semibold text-rose-200">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#d4a84b] py-3 text-sm font-black uppercase tracking-wider text-[#0c120f] hover:bg-[#ebc063] disabled:opacity-60"
          >
            <Swords className="h-4 w-4" />
            <span>{loading ? 'Entering Arena...' : mode === 'register' ? 'Forge Warrior & Enter' : 'Enter Wild Arena'}</span>
          </button>
        </form>
      </div>

      {/* Single flat control-hint line */}
      <div className="rounded-md border border-white/10 bg-[#0b1310]/85 px-4 py-1.5 text-center text-[11px] font-medium tracking-wide text-stone-300">
        WASD Move · Mouse Look · LMB Light · RMB Heavy · E Special · F Block/Parry · Shift Dodge · Space Jump
      </div>
    </div>
  );
};
