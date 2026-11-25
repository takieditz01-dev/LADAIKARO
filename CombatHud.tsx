import React from 'react';
import { Pause, Volume2, VolumeX, Shield, Zap, LogOut } from 'lucide-react';
import { HudSnapshot } from '../game/ArenaEngine.ts';
import { GraphicsQuality } from '../shared/gameData.ts';
import { MobileControls } from './MobileControls.tsx';

interface CombatHudProps {
  hud: HudSnapshot;
  isPaused: boolean;
  muted: boolean;
  quality: GraphicsQuality;
  showTouchControls: boolean;
  onlineFinishInfo: {
    winningTeam: 1 | 2;
    reason: string;
    apEarned: number;
    xpEarned: number;
    ratingDelta: number;
    antiFarmBlocked: boolean;
    localWon: boolean;
  } | null;
  soloRewardInfo: { apEarned: number; xpEarned: number } | null;
  onTogglePause: () => void;
  onToggleMute: () => void;
  onChangeQuality: (q: GraphicsQuality) => void;
  onToggleTouchControls: () => void;
  onExitMatch: () => void;
  onMobileMove: (x: number, y: number) => void;
  onMobileAction: (action: 'light' | 'heavy' | 'special' | 'jump' | 'dodge' | 'block_start' | 'block_end') => void;
}

export const CombatHud: React.FC<CombatHudProps> = ({
  hud,
  isPaused,
  muted,
  quality,
  showTouchControls,
  onlineFinishInfo,
  soloRewardInfo,
  onTogglePause,
  onToggleMute,
  onChangeQuality,
  onToggleTouchControls,
  onExitMatch,
  onMobileMove,
  onMobileAction,
}) => {
  const team1 = hud.fighters.filter((f) => f.team === 1);
  const team2 = hud.fighters.filter((f) => f.team === 2);

  return (
    <div className="pointer-events-none fixed inset-0 z-20 flex flex-col justify-between p-3 sm:p-5">
      {/* TOP PERIMETER STATUS CLUSTER */}
      <div className="flex items-start justify-between gap-3">
        {/* Team 1 Bars */}
        <div className="flex w-[38%] max-w-md flex-col gap-2">
          {team1.map((f) => {
            const hpPct = Math.max(0, Math.min(100, (f.hp / Math.max(1, f.maxHp)) * 100));
            const stPct = Math.max(0, Math.min(100, (f.stamina / Math.max(1, f.maxStamina)) * 100));
            return (
              <div key={f.id} className="rounded-lg border border-[#d4a84b]/40 bg-[#0c1411]/90 px-3 py-2">
                <div className="mb-1 flex items-center justify-between text-xs font-bold tracking-wide">
                  <span className="truncate text-[#f3f5f0]">
                    {f.name} {f.isLocal ? '(YOU)' : ''}
                  </span>
                  <span className="tabular-nums text-emerald-300">
                    {Math.ceil(f.hp)} / {f.maxHp}
                  </span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-sm bg-[#1b2923]">
                  <div
                    className="h-full bg-emerald-500 transition-all duration-100"
                    style={{ width: `${hpPct}%` }}
                  />
                </div>
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-sm bg-[#16202b]">
                  <div
                    className="h-full bg-sky-400 transition-all duration-75"
                    style={{ width: `${stPct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Center Round & Timer */}
        <div className="flex flex-col items-center">
          <div className="flex items-center gap-3 rounded-lg border border-[#d4a84b]/60 bg-[#0d1411]/95 px-4 py-1.5">
            <div className="flex gap-1">
              {[0, 1].map((idx) => (
                <span
                  key={idx}
                  className={`h-2.5 w-2.5 rounded-full border border-emerald-400 ${
                    idx < hud.team1Rounds ? 'bg-emerald-400' : 'bg-transparent'
                  }`}
                />
              ))}
            </div>
            <div className="text-center">
              <div className="text-[10px] font-bold uppercase tracking-widest text-[#d4a84b]">
                Round {hud.round}
              </div>
              <div className="font-display text-xl font-black leading-none tabular-nums text-white">
                {hud.roundTimeLeft}
              </div>
            </div>
            <div className="flex gap-1">
              {[0, 1].map((idx) => (
                <span
                  key={idx}
                  className={`h-2.5 w-2.5 rounded-full border border-rose-400 ${
                    idx < hud.team2Rounds ? 'bg-rose-400' : 'bg-transparent'
                  }`}
                />
              ))}
            </div>
          </div>

          {hud.bossName && (
            <div className="mt-1.5 rounded border border-amber-500/50 bg-[#1f120b]/95 px-3 py-0.5 text-center">
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-300">
                {hud.bossSubtitle} · Phase {hud.bossPhase || 1}
              </span>
            </div>
          )}
        </div>

        {/* Team 2 Bars & Utility Buttons */}
        <div className="flex w-[38%] max-w-md flex-col items-end gap-2">
          <div className="flex w-full flex-col gap-2">
            {team2.map((f) => {
              const hpPct = Math.max(0, Math.min(100, (f.hp / Math.max(1, f.maxHp)) * 100));
              const stPct = Math.max(0, Math.min(100, (f.stamina / Math.max(1, f.maxStamina)) * 100));
              return (
                <div key={f.id} className="rounded-lg border border-rose-500/40 bg-[#140d0f]/90 px-3 py-2">
                  <div className="mb-1 flex items-center justify-between text-xs font-bold tracking-wide">
                    <span className="tabular-nums text-rose-300">
                      {Math.ceil(f.hp)} / {f.maxHp}
                    </span>
                    <span className="truncate text-[#f3f5f0]">{f.name}</span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-sm bg-[#2b181b]">
                    <div
                      className="ml-auto h-full bg-rose-500 transition-all duration-100"
                      style={{ width: `${hpPct}%` }}
                    />
                  </div>
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-sm bg-[#211924]">
                    <div
                      className="ml-auto h-full bg-amber-400 transition-all duration-75"
                      style={{ width: `${stPct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pointer-events-auto flex items-center gap-1.5">
            <button
              type="button"
              onClick={onToggleTouchControls}
              className="rounded border border-white/20 bg-[#0d1411]/90 px-2 py-1 text-[11px] font-semibold text-stone-200 hover:border-[#d4a84b]"
            >
              {showTouchControls ? 'Hide Pad' : 'Touch Pad'}
            </button>
            <button
              type="button"
              onClick={onToggleMute}
              className="rounded border border-white/20 bg-[#0d1411]/90 p-1.5 text-stone-200 hover:border-[#d4a84b]"
              aria-label="Toggle Sound"
            >
              {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={onTogglePause}
              className="rounded border border-white/20 bg-[#0d1411]/90 p-1.5 text-stone-200 hover:border-[#d4a84b]"
              aria-label="Pause Menu"
            >
              {hud.mode === 'spectate' ? <LogOut className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* CENTER TELEGRAPH / BOSS INTRO / COMBO CALLOUT */}
      <div className="flex flex-col items-center justify-center gap-2">
        {hud.phase === 'intro' && hud.bossName && (
          <div className="rounded-xl border border-amber-400/70 bg-[#120c09]/95 px-6 py-4 text-center">
            <div className="text-xs font-bold uppercase tracking-[0.25em] text-amber-400">
              {hud.bossSubtitle}
            </div>
            <div className="font-display mt-1 text-3xl font-black tracking-wide text-white sm:text-4xl">
              {hud.bossName}
            </div>
            {hud.bossIntroLine && (
              <div className="mt-1.5 text-sm italic text-stone-300">“{hud.bossIntroLine}”</div>
            )}
          </div>
        )}

        {hud.telegraphWarning && (
          <div className="rounded-lg border border-rose-500 bg-[#360b10]/95 px-4 py-1.5 text-xs font-extrabold uppercase tracking-wider text-rose-200">
            {hud.telegraphWarning}
          </div>
        )}

        {hud.comboCount >= 2 && hud.phase === 'fighting' && (
          <div className="self-start rounded-lg border border-amber-400/70 bg-[#1a1308]/90 px-3.5 py-1.5">
            <div className="font-display text-2xl font-black tabular-nums text-amber-300">
              {hud.comboCount} HIT
            </div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-amber-100">
              {hud.comboLabel}
            </div>
          </div>
        )}
      </div>

      {/* BOTTOM CONTROL HINT (PC) OR SPECTATOR BANNER */}
      {!showTouchControls && hud.mode !== 'spectate' && (
        <div className="mx-auto rounded-md border border-white/10 bg-[#0b120f]/85 px-4 py-1 text-[11px] font-medium tracking-wide text-stone-300">
          WASD Move · Mouse Drag Camera · LMB Light · RMB Heavy · E Special · F Block/Parry · Shift Dodge · Space Jump · Esc Pause
        </div>
      )}
      {hud.mode === 'spectate' && (
        <div className="mx-auto flex items-center gap-3 rounded-md border border-sky-400/40 bg-[#0c1824]/90 px-4 py-1.5 text-xs font-semibold text-sky-200">
          <span>Spectating Live Match · Drag Mouse to Orbit Camera</span>
        </div>
      )}

      {showTouchControls && hud.mode !== 'spectate' && hud.phase === 'fighting' && (
        <MobileControls onMove={onMobileMove} onAction={onMobileAction} />
      )}

      {/* PAUSE MODAL */}
      {isPaused && (
        <div className="pointer-events-auto fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-sm rounded-xl border border-[#d4a84b]/60 bg-[#0e1612] p-6 text-center">
            <h2 className="font-display text-2xl font-black tracking-wider text-[#f3f5f0]">
              {hud.mode === 'spectate' ? 'SPECTATOR VIEW' : 'COMBAT PAUSED'}
            </h2>
            <p className="mt-1 text-xs text-stone-400">Adjust graphics quality or return to the Wild Arena Hub.</p>

            <div className="mt-4">
              <div className="mb-1.5 text-left text-[11px] font-bold uppercase tracking-wider text-stone-400">
                Graphics Quality
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {(['low', 'medium', 'high', 'ultra'] as GraphicsQuality[]).map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => onChangeQuality(q)}
                    className={`rounded py-1.5 text-xs font-bold uppercase ${
                      quality === q
                        ? 'bg-[#d4a84b] text-[#0b110e]'
                        : 'border border-white/15 bg-[#16221c] text-stone-300'
                    }`}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-2">
              <button
                type="button"
                onClick={onTogglePause}
                className="w-full rounded-lg bg-[#d4a84b] py-2.5 text-sm font-extrabold uppercase tracking-wider text-[#0c120f] hover:bg-[#e8be62]"
              >
                Resume
              </button>
              <button
                type="button"
                onClick={onExitMatch}
                className="w-full rounded-lg border border-rose-500/60 bg-[#2a1216] py-2.5 text-sm font-bold uppercase tracking-wider text-rose-200 hover:bg-[#3d181e]"
              >
                Leave Arena
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SOLO RESULT MODAL */}
      {hud.soloResult && (
        <div className="pointer-events-auto fixed inset-0 z-40 flex items-center justify-center bg-black/75 p-4">
          <div className="w-full max-w-md rounded-xl border border-[#d4a84b]/70 bg-[#0e1612] p-6 text-center">
            <div className="text-xs font-bold uppercase tracking-[0.25em] text-[#d4a84b]">
              {hud.bossName ? 'Boss Campaign Result' : 'Arena Skirmish Result'}
            </div>
            <h2
              className={`font-display mt-1 text-3xl font-black tracking-wide ${
                hud.soloResult.won ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {hud.soloResult.won ? 'VICTORY' : 'DEFEATED'}
            </h2>
            <p className="mt-1 text-sm text-stone-300">
              Rounds: {hud.soloResult.roundsWon} – {hud.soloResult.roundsLost} · Combos: {hud.soloResult.combosLanded} · Objects Smashed: {hud.soloResult.objectsDestroyed}
            </p>

            <div className="mt-4 grid grid-cols-2 gap-3 rounded-lg border border-white/10 bg-[#14201a] p-4">
              <div>
                <div className="flex items-center justify-center gap-1 text-xs font-semibold text-amber-300">
                  <Zap className="h-3.5 w-3.5" /> Arena Points
                </div>
                <div className="mt-0.5 text-2xl font-black tabular-nums text-white">
                  +{soloRewardInfo ? soloRewardInfo.apEarned : '...'} AP
                </div>
              </div>
              <div>
                <div className="flex items-center justify-center gap-1 text-xs font-semibold text-sky-300">
                  <Shield className="h-3.5 w-3.5" /> Experience
                </div>
                <div className="mt-0.5 text-2xl font-black tabular-nums text-white">
                  +{soloRewardInfo ? soloRewardInfo.xpEarned : '...'} XP
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onExitMatch}
              className="mt-5 w-full rounded-lg bg-[#d4a84b] py-3 text-sm font-extrabold uppercase tracking-wider text-[#0c120f] hover:bg-[#ebbf63]"
            >
              Return to Arena Hub
            </button>
          </div>
        </div>
      )}

      {/* ONLINE RESULT MODAL */}
      {onlineFinishInfo && (
        <div className="pointer-events-auto fixed inset-0 z-40 flex items-center justify-center bg-black/75 p-4">
          <div className="w-full max-w-md rounded-xl border border-[#d4a84b]/70 bg-[#0e1612] p-6 text-center">
            <div className="text-xs font-bold uppercase tracking-[0.25em] text-[#d4a84b]">
              Online Match Complete
            </div>
            <h2
              className={`font-display mt-1 text-3xl font-black tracking-wide ${
                onlineFinishInfo.localWon ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {onlineFinishInfo.localWon ? 'ONLINE VICTORY' : 'MATCH DEFEAT'}
            </h2>
            <p className="mt-1 text-xs text-stone-300">{onlineFinishInfo.reason}</p>

            {onlineFinishInfo.antiFarmBlocked && (
              <div className="mt-3 rounded border border-amber-500/50 bg-[#2b1d0a] px-3 py-2 text-xs text-amber-200">
                Anti-farming safeguard active: AP reward capped for repeated matches against the same opponent within 15 minutes.
              </div>
            )}

            <div className="mt-4 grid grid-cols-3 gap-2 rounded-lg border border-white/10 bg-[#14201a] p-3">
              <div>
                <div className="text-[11px] text-amber-300">AP Earned</div>
                <div className="text-lg font-black tabular-nums text-white">+{onlineFinishInfo.apEarned}</div>
              </div>
              <div>
                <div className="text-[11px] text-sky-300">XP Earned</div>
                <div className="text-lg font-black tabular-nums text-white">+{onlineFinishInfo.xpEarned}</div>
              </div>
              <div>
                <div className="text-[11px] text-emerald-300">Rank Rating</div>
                <div className="text-lg font-black tabular-nums text-white">
                  {onlineFinishInfo.ratingDelta >= 0 ? `+${onlineFinishInfo.ratingDelta}` : onlineFinishInfo.ratingDelta}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onExitMatch}
              className="mt-5 w-full rounded-lg bg-[#d4a84b] py-3 text-sm font-extrabold uppercase tracking-wider text-[#0c120f] hover:bg-[#ebbf63]"
            >
              Continue
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
