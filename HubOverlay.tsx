import React, { useState } from 'react';
import {
  Swords,
  Shield,
  Crown,
  Users,
  Trophy,
  Target,
  ChevronDown,
  ChevronUp,
  Lock,
  Check,
  UserPlus,
  Eye,
  Volume2,
  VolumeX,
  LogOut,
  Zap,
  Sparkles,
  Copy,
  Maximize2,
} from 'lucide-react';
import { enterLandscapeFullscreen } from './LandscapeGuard.tsx';
import { PWAInstallButton } from './PWAInstallButton.tsx';
import {
  ACHIEVEMENTS,
  ARENAS,
  ArenaId,
  BOSSES,
  FIGHTERS,
  FriendEntry,
  FriendRequestEntry,
  getArenaById,
  getBossByIndex,
  getFighterById,
  GraphicsQuality,
  MatchHistoryEntry,
  MISSIONS,
  PlayerProfile,
  RARITY_COLORS,
  Rarity,
  xpForLevel,
} from '../shared/gameData.ts';

export type HubTab = 'none' | 'play' | 'fighters' | 'missions' | 'multiplayer' | 'profile';

export interface LiveRoomLobby {
  code: string;
  hostUserId: number;
  mode: '1v1' | '2v2';
  isRanked: boolean;
  isPublic: boolean;
  arenaId: ArenaId;
  status: 'lobby' | 'playing';
  spectatorCount: number;
  members: Array<{
    userId: number;
    username: string;
    playerCode: string;
    fighterId: string;
    team: 1 | 2;
    ready: boolean;
  }>;
}

export interface LiveSpectateMatch {
  code: string;
  mode: '1v1' | '2v2';
  isRanked: boolean;
  arenaId: ArenaId;
  round: number;
  team1Rounds: number;
  team2Rounds: number;
  spectatorCount: number;
  players: Array<{ username: string; fighterId: string; team: 1 | 2 }>;
}

interface HubOverlayProps {
  profile: PlayerProfile;
  matchHistory: MatchHistoryEntry[];
  leaderboard: Array<{
    username: string;
    playerCode: string;
    level: number;
    rankedRating: number;
    onlineWins: number;
    rankedWins: number;
    highestBossCleared: number;
  }>;
  friends: FriendEntry[];
  incomingRequests: FriendRequestEntry[];
  activeTab: HubTab;
  dockCollapsed: boolean;
  quality: GraphicsQuality;
  muted: boolean;
  socketConnected: boolean;
  queueCounts: { '1v1_normal': number; '1v1_ranked': number; '2v2_normal': number };
  activeQueue: '1v1_normal' | '1v1_ranked' | '2v2_normal' | null;
  currentRoom: LiveRoomLobby | null;
  liveMatches: LiveSpectateMatch[];
  pendingInvite: { code: string; fromUsername: string; mode: string; arenaId: ArenaId } | null;
  bannerMsg: { type: 'ok' | 'err'; text: string } | null;
  onSelectTab: (tab: HubTab) => void;
  onToggleDock: () => void;
  onChangeQuality: (q: GraphicsQuality) => void;
  onToggleMute: () => void;
  onLogout: () => void;
  onPreviewFighter: (fighterId: string) => void;
  onSelectFighter: (fighterId: string) => void;
  onUnlockFighter: (fighterId: string) => void;
  onStartBoss: (bossIndex: number) => void;
  onStartSkirmish: (arenaId: ArenaId, opponentFighterId: string, opponentRarity: Rarity) => void;
  onClaimMission: (missionId: string) => void;
  onClaimAchievement: (achId: string) => void;
  onSendFriendRequest: (query: string) => void;
  onRespondFriendRequest: (requestId: number, accept: boolean) => void;
  onCreateRoom: (mode: '1v1' | '2v2', isRanked: boolean, arenaId: ArenaId) => void;
  onJoinRoom: (code: string) => void;
  onLeaveRoom: () => void;
  onRoomConfig: (cfg: { arenaId?: ArenaId; mode?: '1v1' | '2v2'; isRanked?: boolean }) => void;
  onRoomReady: (data: { ready?: boolean; team?: 1 | 2 }) => void;
  onRoomInvite: (friendId: number) => void;
  onRoomStart: () => void;
  onJoinQueue: (q: '1v1_normal' | '1v1_ranked' | '2v2_normal') => void;
  onLeaveQueue: () => void;
  onSpectateMatch: (code: string) => void;
  onDismissInvite: () => void;
}

export const HubOverlay: React.FC<HubOverlayProps> = ({
  profile,
  matchHistory,
  leaderboard,
  friends,
  incomingRequests,
  activeTab,
  dockCollapsed,
  quality,
  muted,
  socketConnected,
  queueCounts,
  activeQueue,
  currentRoom,
  liveMatches,
  pendingInvite,
  bannerMsg,
  onSelectTab,
  onToggleDock,
  onChangeQuality,
  onToggleMute,
  onLogout,
  onPreviewFighter,
  onSelectFighter,
  onUnlockFighter,
  onStartBoss,
  onStartSkirmish,
  onClaimMission,
  onClaimAchievement,
  onSendFriendRequest,
  onRespondFriendRequest,
  onCreateRoom,
  onJoinRoom,
  onLeaveRoom,
  onRoomConfig,
  onRoomReady,
  onRoomInvite,
  onRoomStart,
  onJoinQueue,
  onLeaveQueue,
  onSpectateMatch,
  onDismissInvite,
}) => {
  const [playSubTab, setPlaySubTab] = useState<'bosses' | 'skirmish'>('bosses');
  const [skirmishArena, setSkirmishArena] = useState<ArenaId>('jungle_falls');
  const [skirmishRarity, setSkirmishRarity] = useState<Rarity>('Common');
  const [skirmishOpponent, setSkirmishOpponent] = useState<string>('lyra_vale');
  const [inspectedFighterId, setInspectedFighterId] = useState<string>(profile.selectedFighterId);
  const [rarityFilter, setRarityFilter] = useState<'All' | Rarity>('All');
  const [friendQuery, setFriendQuery] = useState('');
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [roomArena, setRoomArena] = useState<ArenaId>('ancient_temple');
  const [roomMode, setRoomMode] = useState<'1v1' | '2v2'>('1v1');
  const [roomRanked, setRoomRanked] = useState(false);

  const activeFighter = getFighterById(profile.selectedFighterId);
  const inspectedFighter = getFighterById(inspectedFighterId);
  const neededXp = xpForLevel(profile.stats.level);
  const xpPct = Math.min(100, Math.round((profile.stats.xp / neededXp) * 100));

  const filteredFighters =
    rarityFilter === 'All' ? FIGHTERS : FIGHTERS.filter((f) => f.rarity === rarityFilter);

  const skirmishCandidates = FIGHTERS.filter((f) => f.rarity === skirmishRarity);

  return (
    <div className="pointer-events-none fixed inset-0 z-20 flex flex-col justify-between p-3 sm:p-5">
      {/* TOP PERIMETER BAR */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="pointer-events-auto flex items-center gap-3 rounded-xl border border-[#d4a84b]/50 bg-[#0b1310]/95 px-3.5 py-2">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-display text-sm font-black tracking-wide text-white sm:text-base">
                {profile.username}
              </span>
              <span className="rounded bg-[#1a2922] px-1.5 py-0.5 text-[10px] font-bold text-[#d4a84b]">
                {profile.playerCode}
              </span>
            </div>
            <div className="mt-1 flex items-center gap-2">
              <span className="text-[11px] font-bold text-emerald-300">Lv.{profile.stats.level}</span>
              <div className="h-1.5 w-24 overflow-hidden rounded-full bg-[#1a2922]">
                <div className="h-full bg-emerald-400" style={{ width: `${xpPct}%` }} />
              </div>
              <span className="text-[10px] tabular-nums text-stone-400">
                {profile.stats.xp}/{neededXp} XP
              </span>
            </div>
          </div>

          <div className="h-8 w-px bg-white/10" />

          <div className="text-right">
            <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-amber-300">
              <Zap className="h-3 w-3" /> Arena Points
            </div>
            <div className="font-display text-lg font-black leading-tight tabular-nums text-amber-200">
              {profile.stats.ap.toLocaleString()} AP
            </div>
          </div>
        </div>

        {/* Right Controls: Active Fighter, Quality, Audio, Logout */}
        <div className="pointer-events-auto flex items-center gap-2">
          <div className="hidden items-center gap-2 rounded-xl border border-white/15 bg-[#0b1310]/95 px-3 py-1.5 sm:flex">
            <span className="text-[11px] text-stone-400">Fighter:</span>
            <span className="text-xs font-bold" style={{ color: RARITY_COLORS[activeFighter.rarity].text }}>
              {activeFighter.name}
            </span>
          </div>

          <div className="flex items-center gap-1 rounded-xl border border-white/15 bg-[#0b1310]/95 px-2 py-1">
            {(['low', 'medium', 'high', 'ultra'] as GraphicsQuality[]).map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => onChangeQuality(q)}
                className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                  quality === q ? 'bg-[#d4a84b] text-[#0c120f]' : 'text-stone-400 hover:text-white'
                }`}
              >
                {q}
              </button>
            ))}
          </div>

          <PWAInstallButton compact />

          <button
            type="button"
            onClick={() => void enterLandscapeFullscreen()}
            className="rounded-xl border border-white/15 bg-[#0b1310]/95 p-2 text-stone-200 hover:border-[#d4a84b]"
            title="Landscape Fullscreen"
          >
            <Maximize2 className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={onToggleMute}
            className="rounded-xl border border-white/15 bg-[#0b1310]/95 p-2 text-stone-200 hover:border-[#d4a84b]"
            title="Toggle Audio"
          >
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>

          <button
            type="button"
            onClick={onLogout}
            className="rounded-xl border border-white/15 bg-[#0b1310]/95 p-2 text-stone-300 hover:border-rose-400 hover:text-rose-300"
            title="Sign Out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* TOAST / FRIEND INVITE BANNER */}
      <div className="pointer-events-none flex flex-col items-center gap-2">
        {bannerMsg && (
          <div
            className={`pointer-events-auto rounded-lg border px-4 py-2 text-xs font-bold ${
              bannerMsg.type === 'ok'
                ? 'border-emerald-400/60 bg-[#0d2419]/95 text-emerald-200'
                : 'border-rose-400/60 bg-[#2b1015]/95 text-rose-200'
            }`}
          >
            {bannerMsg.text}
          </div>
        )}

        {pendingInvite && (
          <div className="pointer-events-auto flex items-center gap-3 rounded-xl border border-[#d4a84b] bg-[#141e18]/95 px-4 py-2.5">
            <div className="text-xs">
              <span className="font-bold text-amber-300">{pendingInvite.fromUsername}</span> invited you to{' '}
              <span className="font-semibold text-white">
                {pendingInvite.mode} · {getArenaById(pendingInvite.arenaId).name}
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                onJoinRoom(pendingInvite.code);
                onDismissInvite();
                onSelectTab('multiplayer');
              }}
              className="rounded bg-emerald-500 px-3 py-1 text-xs font-extrabold text-[#08120d]"
            >
              Join
            </button>
            <button
              type="button"
              onClick={onDismissInvite}
              className="rounded bg-white/10 px-2 py-1 text-xs text-stone-300"
            >
              Dismiss
            </button>
          </div>
        )}
      </div>

      {/* ACTIVE TAB DRAWER PANEL (Sits cleanly above bottom dock without covering full center when closed) */}
      {activeTab !== 'none' && !dockCollapsed && (
        <div className="pointer-events-auto mx-auto mb-2 w-full max-w-5xl overflow-hidden rounded-2xl border border-[#d4a84b]/45 bg-[#0c1411]/95 shadow-2xl">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
            <div className="font-display text-sm font-black uppercase tracking-widest text-[#d4a84b]">
              {activeTab === 'play' && 'Campaign & Solo Arenas'}
              {activeTab === 'fighters' && 'Wild Arena Roster · 22 Fighters'}
              {activeTab === 'missions' && 'Missions & Daily Challenges'}
              {activeTab === 'multiplayer' && 'Online Multiplayer & Friends'}
              {activeTab === 'profile' && 'Profile, Achievements & Ranked Leaderboard'}
            </div>
            <button
              type="button"
              onClick={() => onSelectTab('none')}
              className="rounded border border-white/15 px-2.5 py-0.5 text-xs font-semibold text-stone-300 hover:border-[#d4a84b] hover:text-white"
            >
              Close
            </button>
          </div>

          <div className="max-h-[58vh] overflow-y-auto p-4">
            {/* TAB 1: BOSS CAMPAIGN & SKIRMISH */}
            {activeTab === 'play' && (
              <div>
                <div className="mb-4 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPlaySubTab('bosses')}
                    className={`rounded-lg px-4 py-2 text-xs font-extrabold uppercase tracking-wider ${
                      playSubTab === 'bosses'
                        ? 'bg-[#d4a84b] text-[#0c120f]'
                        : 'border border-white/15 bg-[#131e19] text-stone-300'
                    }`}
                  >
                    Boss Campaign (16 Bosses)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPlaySubTab('skirmish')}
                    className={`rounded-lg px-4 py-2 text-xs font-extrabold uppercase tracking-wider ${
                      playSubTab === 'skirmish'
                        ? 'bg-[#d4a84b] text-[#0c120f]'
                        : 'border border-white/15 bg-[#131e19] text-stone-300'
                    }`}
                  >
                    Arena Skirmish (8 Arenas)
                  </button>
                </div>

                {playSubTab === 'bosses' && (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {BOSSES.map((boss) => {
                      const unlocked = boss.index <= profile.stats.highestBossCleared + 1;
                      const cleared = boss.index <= profile.stats.highestBossCleared;
                      const arena = getArenaById(boss.arenaId);
                      return (
                        <div
                          key={boss.id}
                          className={`flex flex-col justify-between rounded-xl border p-3.5 ${
                            boss.isSecret
                              ? 'border-teal-400/50 bg-[#0d1f1d]'
                              : unlocked
                                ? 'border-[#d4a84b]/40 bg-[#131d18]'
                                : 'border-white/10 bg-[#0e1411] opacity-75'
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider">
                              <span className={boss.isSecret ? 'text-teal-300' : 'text-amber-300'}>
                                Boss {boss.index} · {boss.difficultyLabel}
                              </span>
                              {cleared ? (
                                <span className="flex items-center gap-1 text-emerald-400">
                                  <Check className="h-3 w-3" /> Cleared
                                </span>
                              ) : !unlocked ? (
                                <span className="flex items-center gap-1 text-stone-400">
                                  <Lock className="h-3 w-3" /> Locked
                                </span>
                              ) : null}
                            </div>
                            <h3 className="font-display mt-1 text-base font-black text-white">{boss.name}</h3>
                            <div className="mt-0.5 text-[11px] text-stone-400">
                              Arena: <span className="text-stone-200">{arena.name}</span> · HP {boss.maxHp}
                            </div>
                            <div className="mt-1 text-[11px] text-stone-400">{boss.fightingStyle}</div>
                          </div>

                          <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-2.5">
                            <div className="text-[11px] font-bold text-amber-300">
                              +{boss.apReward} AP · +{boss.xpReward} XP
                            </div>
                            <button
                              type="button"
                              disabled={!unlocked}
                              onClick={() => onStartBoss(boss.index)}
                              className={`rounded-lg px-3 py-1.5 text-xs font-extrabold uppercase ${
                                unlocked
                                  ? 'bg-[#d4a84b] text-[#0b110e] hover:bg-[#ebbf63]'
                                  : 'cursor-not-allowed bg-white/10 text-stone-500'
                              }`}
                            >
                              {unlocked ? 'Challenge' : `Clear #${boss.index - 1}`}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {playSubTab === 'skirmish' && (
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="rounded-xl border border-white/10 bg-[#121c17] p-4">
                      <div className="mb-2 text-xs font-bold uppercase tracking-wider text-[#d4a84b]">
                        1. Choose Natural 3D Arena
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {ARENAS.map((a) => (
                          <button
                            key={a.id}
                            type="button"
                            onClick={() => setSkirmishArena(a.id)}
                            className={`rounded-lg border p-2.5 text-left ${
                              skirmishArena === a.id
                                ? 'border-[#d4a84b] bg-[#212b1f]'
                                : 'border-white/10 bg-[#0d1411] hover:border-white/30'
                            }`}
                          >
                            <div className="text-xs font-bold text-white">{a.name}</div>
                            <div className="mt-0.5 text-[10px] text-stone-400 capitalize">
                              Weather: {a.weather}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-col justify-between rounded-xl border border-white/10 bg-[#121c17] p-4">
                      <div>
                        <div className="mb-2 text-xs font-bold uppercase tracking-wider text-[#d4a84b]">
                          2. Opponent Tier & Fighter
                        </div>
                        <div className="mb-3 flex flex-wrap gap-1.5">
                          {(['Common', 'Rare', 'Epic', 'Legendary'] as Rarity[]).map((r) => (
                            <button
                              key={r}
                              type="button"
                              onClick={() => {
                                setSkirmishRarity(r);
                                const first = FIGHTERS.find((f) => f.rarity === r);
                                if (first) setSkirmishOpponent(first.id);
                              }}
                              className={`rounded px-2.5 py-1 text-xs font-bold ${
                                skirmishRarity === r
                                  ? 'bg-[#d4a84b] text-[#0c120f]'
                                  : 'border border-white/15 bg-[#0d1411] text-stone-300'
                              }`}
                            >
                              {r}
                            </button>
                          ))}
                        </div>

                        <div className="grid grid-cols-1 gap-1.5">
                          {skirmishCandidates.map((cand) => (
                            <button
                              key={cand.id}
                              type="button"
                              onClick={() => setSkirmishOpponent(cand.id)}
                              className={`flex items-center justify-between rounded-lg border px-3 py-2 text-left text-xs ${
                                skirmishOpponent === cand.id
                                  ? 'border-[#d4a84b] bg-[#1e2a23]'
                                  : 'border-white/10 bg-[#0d1411]'
                              }`}
                            >
                              <span className="font-bold text-white">{cand.name}</span>
                              <span className="text-[11px] text-stone-400">{cand.fightingStyle}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => onStartSkirmish(skirmishArena, skirmishOpponent, skirmishRarity)}
                        className="mt-4 w-full rounded-xl bg-[#d4a84b] py-3 text-sm font-black uppercase tracking-wider text-[#0c120f] hover:bg-[#ebbf63]"
                      >
                        Enter Skirmish ({getArenaById(skirmishArena).name})
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: 22 FIGHTERS & UNLOCK SYSTEM */}
            {activeTab === 'fighters' && (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                <div className="lg:col-span-2">
                  <div className="mb-3 flex flex-wrap gap-1.5">
                    {(['All', 'Common', 'Rare', 'Epic', 'Legendary', 'Mythic', 'Divine', 'Secret'] as const).map(
                      (r) => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => setRarityFilter(r)}
                          className={`rounded px-2.5 py-1 text-[11px] font-bold ${
                            rarityFilter === r
                              ? 'bg-[#d4a84b] text-[#0c120f]'
                              : 'border border-white/15 bg-[#121c17] text-stone-300'
                          }`}
                        >
                          {r}
                        </button>
                      ),
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {filteredFighters.map((f) => {
                      const isUnlocked = profile.unlockedFighters.includes(f.id);
                      const isEquipped = profile.selectedFighterId === f.id;
                      const isInspected = inspectedFighterId === f.id;
                      const rc = RARITY_COLORS[f.rarity];
                      return (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => {
                            setInspectedFighterId(f.id);
                            onPreviewFighter(f.id);
                          }}
                          className={`flex flex-col justify-between rounded-xl border p-2.5 text-left transition ${
                            isInspected
                              ? 'border-[#d4a84b] bg-[#1d2b24]'
                              : 'border-white/10 bg-[#111915] hover:border-white/30'
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-extrabold uppercase" style={{ color: rc.text }}>
                                {f.rarity}
                              </span>
                              {isEquipped ? (
                                <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-bold text-emerald-300">
                                  EQUIPPED
                                </span>
                              ) : !isUnlocked ? (
                                <Lock className="h-3 w-3 text-stone-400" />
                              ) : null}
                            </div>
                            <div className="mt-1 truncate text-xs font-extrabold text-white">{f.name}</div>
                            <div className="truncate text-[10px] text-stone-400">{f.title}</div>
                          </div>
                          {!isUnlocked && (
                            <div className="mt-2 text-[10px] font-bold text-amber-300">{f.apCost} AP</div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Selected Fighter Inspector */}
                <div className="flex flex-col justify-between rounded-xl border border-[#d4a84b]/40 bg-[#121c17] p-4">
                  <div>
                    <div
                      className="text-[11px] font-extrabold uppercase tracking-wider"
                      style={{ color: RARITY_COLORS[inspectedFighter.rarity].text }}
                    >
                      {inspectedFighter.rarity} Fighter
                    </div>
                    <h3 className="font-display mt-0.5 text-xl font-black text-white">{inspectedFighter.name}</h3>
                    <div className="text-xs text-stone-400">{inspectedFighter.fightingStyle}</div>

                    <div className="mt-3 space-y-2">
                      {[
                        { label: 'Strength', val: inspectedFighter.stats.strength, col: 'bg-rose-500' },
                        { label: 'Speed', val: inspectedFighter.stats.speed, col: 'bg-sky-400' },
                        { label: 'Defense', val: inspectedFighter.stats.defense, col: 'bg-emerald-400' },
                      ].map((s) => (
                        <div key={s.label}>
                          <div className="flex justify-between text-[11px] font-semibold">
                            <span className="text-stone-300">{s.label}</span>
                            <span className="tabular-nums text-white">{s.val}</span>
                          </div>
                          <div className="mt-0.5 h-1.5 w-full overflow-hidden rounded bg-[#0c120f]">
                            <div className={`h-full ${s.col}`} style={{ width: `${s.val}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-3 rounded-lg border border-white/10 bg-[#0d1411] p-2.5">
                      <div className="text-[10px] font-bold uppercase text-amber-300">
                        Special: {inspectedFighter.specialName}
                      </div>
                      <div className="mt-0.5 text-[11px] text-stone-300">{inspectedFighter.specialDesc}</div>
                      <div className="mt-1.5 text-[10px] text-stone-400">
                        Combos: {inspectedFighter.comboNames.join(' → ')}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4">
                    {profile.unlockedFighters.includes(inspectedFighter.id) ? (
                      <button
                        type="button"
                        disabled={profile.selectedFighterId === inspectedFighter.id}
                        onClick={() => onSelectFighter(inspectedFighter.id)}
                        className={`w-full rounded-xl py-2.5 text-xs font-extrabold uppercase tracking-wider ${
                          profile.selectedFighterId === inspectedFighter.id
                            ? 'bg-emerald-900/50 text-emerald-300'
                            : 'bg-[#d4a84b] text-[#0c120f] hover:bg-[#ebbf63]'
                        }`}
                      >
                        {profile.selectedFighterId === inspectedFighter.id ? 'Equipped' : 'Select Fighter'}
                      </button>
                    ) : (
                      <div className="space-y-2">
                        <div className="rounded bg-[#0d1411] px-2.5 py-1.5 text-[11px] text-stone-300">
                          Requires: <span className="font-bold text-white">Lv.{inspectedFighter.minLevel}</span>
                          {inspectedFighter.requiredBossIndex > 0 && (
                            <>
                              {' '}
                              · Clear Boss {inspectedFighter.requiredBossIndex} (
                              {getBossByIndex(inspectedFighter.requiredBossIndex).name})
                            </>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => onUnlockFighter(inspectedFighter.id)}
                          className="w-full rounded-xl bg-amber-500 py-2.5 text-xs font-black uppercase tracking-wider text-[#0c120f] hover:bg-amber-400"
                        >
                          Unlock for {inspectedFighter.apCost} AP
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: MISSIONS */}
            {activeTab === 'missions' && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {MISSIONS.map((m) => {
                  const claimed = profile.claimedMissions.includes(m.id);
                  const unlocked = profile.stats.level >= m.minLevel;
                  const progress = m.isDaily
                    ? profile.missionProgress.daily_wins ?? 0
                    : profile.missionProgress[m.metric] ?? 0;
                  const pct = Math.min(100, Math.round((progress / m.target) * 100));
                  const canClaim = unlocked && !claimed && progress >= m.target;
                  return (
                    <div
                      key={m.id}
                      className={`flex flex-col justify-between rounded-xl border p-3.5 ${
                        m.isDaily ? 'border-amber-400/50 bg-[#1d180e]' : 'border-white/10 bg-[#121c17]'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider">
                          <span
                            className={
                              m.difficulty === 'Legendary'
                                ? 'text-amber-300'
                                : m.difficulty === 'Hard'
                                  ? 'text-rose-300'
                                  : m.difficulty === 'Medium'
                                    ? 'text-sky-300'
                                    : 'text-emerald-300'
                            }
                          >
                            {m.isDaily ? 'Daily Challenge' : `${m.difficulty} Mission`} · Lv.{m.minLevel}+
                          </span>
                          <span className="tabular-nums text-stone-300">
                            {Math.min(progress, m.target)} / {m.target}
                          </span>
                        </div>
                        <h4 className="mt-1 text-sm font-extrabold text-white">{m.title}</h4>
                        <p className="mt-0.5 text-xs text-stone-400">{m.description}</p>
                        <div className="mt-2 h-1.5 w-full overflow-hidden rounded bg-[#0a100d]">
                          <div className="h-full bg-[#d4a84b]" style={{ width: `${pct}%` }} />
                        </div>
                      </div>

                      <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-2">
                        <span className="text-[11px] font-bold text-amber-300">
                          +{m.apReward} AP · +{m.xpReward} XP
                        </span>
                        {claimed ? (
                          <span className="text-xs font-bold text-emerald-400">Claimed</span>
                        ) : (
                          <button
                            type="button"
                            disabled={!canClaim}
                            onClick={() => onClaimMission(m.id)}
                            className={`rounded-lg px-3 py-1 text-xs font-extrabold uppercase ${
                              canClaim
                                ? 'bg-emerald-500 text-[#07120c] hover:bg-emerald-400'
                                : 'cursor-not-allowed bg-white/10 text-stone-500'
                            }`}
                          >
                            {!unlocked ? `Lv.${m.minLevel}` : canClaim ? 'Claim' : 'In Progress'}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* TAB 4: ONLINE MULTIPLAYER & FRIENDS */}
            {activeTab === 'multiplayer' && (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                {/* Left 2 Columns: Matchmaking, Private Rooms, Spectator */}
                <div className="space-y-4 lg:col-span-2">
                  <div className="flex items-center justify-between rounded-lg border border-white/10 bg-[#121c17] px-3 py-2 text-xs">
                    <span className="font-semibold text-stone-300">
                      Real-Time Server Status:{' '}
                      <span className={socketConnected ? 'font-bold text-emerald-400' : 'font-bold text-rose-400'}>
                        {socketConnected ? 'Connected (Authoritative PvP)' : 'Reconnecting...'}
                      </span>
                    </span>
                    <span className="text-[11px] text-stone-400">Real Players Only · Zero Bots</span>
                  </div>

                  {/* Active Private Room Lobby */}
                  {currentRoom ? (
                    <div className="rounded-xl border border-[#d4a84b]/60 bg-[#131f19] p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <div className="text-[11px] font-bold uppercase tracking-wider text-[#d4a84b]">
                            Private Room Lobby · {currentRoom.mode.toUpperCase()} {currentRoom.isRanked ? 'RANKED' : ''}
                          </div>
                          <div className="mt-0.5 flex items-center gap-2">
                            <span className="font-display text-2xl font-black tracking-widest text-white">
                              {currentRoom.code}
                            </span>
                            <button
                              type="button"
                              onClick={() => navigator.clipboard?.writeText(currentRoom.code)}
                              className="rounded border border-white/15 bg-[#0c1411] p-1 text-stone-300 hover:text-white"
                              title="Copy Room Code"
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={onLeaveRoom}
                          className="rounded-lg border border-rose-500/50 bg-[#2b1216] px-3 py-1.5 text-xs font-bold text-rose-200"
                        >
                          Leave Room
                        </button>
                      </div>

                      {currentRoom.hostUserId === profile.id && (
                        <div className="mt-3 flex flex-wrap items-center gap-2 border-y border-white/10 py-2.5 text-xs">
                          <span className="text-stone-400">Arena:</span>
                          <select
                            value={currentRoom.arenaId}
                            onChange={(e) => onRoomConfig({ arenaId: e.target.value as ArenaId })}
                            className="rounded border border-white/15 bg-[#0c1411] px-2 py-1 text-xs text-white"
                          >
                            {ARENAS.map((a) => (
                              <option key={a.id} value={a.id}>
                                {a.name}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => onRoomConfig({ mode: currentRoom.mode === '1v1' ? '2v2' : '1v1' })}
                            className="rounded border border-white/15 bg-[#0c1411] px-2.5 py-1 font-bold text-stone-200"
                          >
                            Mode: {currentRoom.mode}
                          </button>
                        </div>
                      )}

                      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {currentRoom.members.map((m) => (
                          <div
                            key={m.userId}
                            className="flex items-center justify-between rounded-lg border border-white/10 bg-[#0d1512] px-3 py-2 text-xs"
                          >
                            <div>
                              <span className="font-bold text-white">{m.username}</span>{' '}
                              <span className={m.team === 1 ? 'text-emerald-400' : 'text-rose-400'}>
                                (Team {m.team})
                              </span>
                              <div className="text-[10px] text-stone-400">{getFighterById(m.fighterId).name}</div>
                            </div>
                            <span className={m.ready ? 'font-bold text-emerald-400' : 'text-amber-300'}>
                              {m.ready ? 'READY' : 'WAITING'}
                            </span>
                          </div>
                        ))}
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const me = currentRoom.members.find((m) => m.userId === profile.id);
                            onRoomReady({ team: me?.team === 1 ? 2 : 1 });
                          }}
                          className="rounded-lg border border-white/20 bg-[#0d1512] px-3 py-2 text-xs font-bold text-stone-200"
                        >
                          Switch Team
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const me = currentRoom.members.find((m) => m.userId === profile.id);
                            onRoomReady({ ready: !me?.ready });
                          }}
                          className="rounded-lg bg-sky-500 px-4 py-2 text-xs font-extrabold text-[#06131c]"
                        >
                          Toggle Ready
                        </button>
                        {currentRoom.hostUserId === profile.id && (
                          <button
                            type="button"
                            onClick={onRoomStart}
                            className="ml-auto rounded-lg bg-[#d4a84b] px-5 py-2 text-xs font-black uppercase text-[#0c120f]"
                          >
                            Start Online Battle
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Public Matchmaking */}
                      <div className="rounded-xl border border-white/10 bg-[#121c17] p-4">
                        <div className="mb-2.5 text-xs font-bold uppercase tracking-wider text-[#d4a84b]">
                          Public Matchmaking Queues
                        </div>
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                          {(
                            [
                              { id: '1v1_normal', label: '1v1 Online Duel', reward: '100 AP' },
                              { id: '1v1_ranked', label: '1v1 Ranked Match', reward: '150 AP' },
                              { id: '2v2_normal', label: '2v2 Team Battle', reward: '125 AP' },
                            ] as const
                          ).map((q) => {
                            const queued = activeQueue === q.id;
                            return (
                              <div key={q.id} className="rounded-lg border border-white/10 bg-[#0d1411] p-3">
                                <div className="text-xs font-extrabold text-white">{q.label}</div>
                                <div className="mt-0.5 text-[10px] text-amber-300">Win Reward: {q.reward}</div>
                                <div className="mt-1 text-[10px] text-stone-400">
                                  In Queue: <span className="font-bold text-white">{queueCounts[q.id]}</span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => (queued ? onLeaveQueue() : onJoinQueue(q.id))}
                                  className={`mt-2.5 w-full rounded py-1.5 text-xs font-extrabold uppercase ${
                                    queued
                                      ? 'bg-rose-600 text-white'
                                      : 'bg-[#d4a84b] text-[#0c120f] hover:bg-[#ebbf63]'
                                  }`}
                                >
                                  {queued ? 'Cancel Queue' : 'Find Match'}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Private Room Create / Join */}
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className="rounded-xl border border-white/10 bg-[#121c17] p-4">
                          <div className="mb-2 text-xs font-bold uppercase tracking-wider text-[#d4a84b]">
                            Create Private Room
                          </div>
                          <div className="flex flex-wrap gap-2 text-xs">
                            <select
                              value={roomArena}
                              onChange={(e) => setRoomArena(e.target.value as ArenaId)}
                              className="w-full rounded border border-white/15 bg-[#0d1411] px-2.5 py-1.5 text-white"
                            >
                              {ARENAS.map((a) => (
                                <option key={a.id} value={a.id}>
                                  {a.name}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              onClick={() => setRoomMode(roomMode === '1v1' ? '2v2' : '1v1')}
                              className="rounded border border-white/15 bg-[#0d1411] px-3 py-1.5 font-bold text-stone-200"
                            >
                              {roomMode.toUpperCase()}
                            </button>
                            <button
                              type="button"
                              onClick={() => setRoomRanked(!roomRanked)}
                              className={`rounded border px-3 py-1.5 font-bold ${
                                roomRanked
                                  ? 'border-amber-400 bg-amber-500/20 text-amber-200'
                                  : 'border-white/15 bg-[#0d1411] text-stone-400'
                              }`}
                            >
                              {roomRanked ? 'Ranked' : 'Casual'}
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={() => onCreateRoom(roomMode, roomRanked, roomArena)}
                            className="mt-3 w-full rounded-lg bg-emerald-500 py-2 text-xs font-extrabold uppercase text-[#07120c]"
                          >
                            Create Room
                          </button>
                        </div>

                        <div className="flex flex-col justify-between rounded-xl border border-white/10 bg-[#121c17] p-4">
                          <div>
                            <div className="mb-2 text-xs font-bold uppercase tracking-wider text-[#d4a84b]">
                              Join by Room Code
                            </div>
                            <input
                              type="text"
                              value={joinCodeInput}
                              onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                              placeholder="Enter 6-char code"
                              maxLength={8}
                              className="w-full rounded border border-white/15 bg-[#0d1411] px-3 py-2 text-sm font-bold uppercase tracking-widest text-white placeholder:text-stone-500"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => onJoinRoom(joinCodeInput)}
                            className="mt-3 w-full rounded-lg bg-[#d4a84b] py-2 text-xs font-extrabold uppercase text-[#0c120f]"
                          >
                            Join Private Room
                          </button>
                        </div>
                      </div>
                    </>
                  )}

                  {/* Spectator Mode */}
                  <div className="rounded-xl border border-white/10 bg-[#121c17] p-4">
                    <div className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-sky-300">
                      <Eye className="h-3.5 w-3.5" /> Live Online Matches (Spectator Mode)
                    </div>
                    {liveMatches.length === 0 ? (
                      <div className="text-xs text-stone-400">
                        No live online battles in progress right now. Create a room or queue up with another player!
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {liveMatches.map((lm) => (
                          <div
                            key={lm.code}
                            className="flex items-center justify-between rounded-lg border border-white/10 bg-[#0d1411] px-3 py-2 text-xs"
                          >
                            <div>
                              <span className="font-bold text-white">
                                {lm.players.map((p) => p.username).join(' vs ')}
                              </span>
                              <div className="text-[10px] text-stone-400">
                                {getArenaById(lm.arenaId).name} · Round {lm.round} ({lm.team1Rounds}–{lm.team2Rounds})
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => onSpectateMatch(lm.code)}
                              className="rounded bg-sky-500 px-3 py-1 text-xs font-extrabold text-[#06131c]"
                            >
                              Spectate
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Column: Friends & Requests */}
                <div className="flex flex-col gap-3 rounded-xl border border-white/10 bg-[#121c17] p-4">
                  <div className="text-xs font-bold uppercase tracking-wider text-[#d4a84b]">
                    Friends ({friends.length})
                  </div>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (friendQuery.trim()) {
                        onSendFriendRequest(friendQuery.trim());
                        setFriendQuery('');
                      }
                    }}
                    className="flex gap-1.5"
                  >
                    <input
                      type="text"
                      value={friendQuery}
                      onChange={(e) => setFriendQuery(e.target.value)}
                      placeholder="Username or WA-ID"
                      className="min-w-0 flex-1 rounded border border-white/15 bg-[#0d1411] px-2.5 py-1.5 text-xs text-white placeholder:text-stone-500"
                    />
                    <button
                      type="submit"
                      className="rounded bg-[#d4a84b] px-2.5 py-1.5 text-[#0c120f]"
                      title="Add Friend"
                    >
                      <UserPlus className="h-4 w-4" />
                    </button>
                  </form>

                  {incomingRequests.length > 0 && (
                    <div className="space-y-1.5 border-t border-white/10 pt-2">
                      <div className="text-[10px] font-bold uppercase text-amber-300">Friend Requests</div>
                      {incomingRequests.map((req) => (
                        <div
                          key={req.id}
                          className="flex items-center justify-between rounded bg-[#0d1411] px-2.5 py-1.5 text-xs"
                        >
                          <span className="truncate font-semibold text-white">{req.fromUsername}</span>
                          <div className="flex gap-1">
                            <button
                              type="button"
                              onClick={() => onRespondFriendRequest(req.id, true)}
                              className="rounded bg-emerald-500 px-2 py-0.5 text-[10px] font-bold text-[#07120c]"
                            >
                              Accept
                            </button>
                            <button
                              type="button"
                              onClick={() => onRespondFriendRequest(req.id, false)}
                              className="rounded bg-white/10 px-2 py-0.5 text-[10px] text-stone-300"
                            >
                              Decline
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="space-y-1.5 border-t border-white/10 pt-2">
                    {friends.length === 0 ? (
                      <div className="text-xs text-stone-400">
                        Share your Player ID <span className="font-bold text-white">{profile.playerCode}</span> to add friends.
                      </div>
                    ) : (
                      friends.map((fr) => (
                        <div
                          key={fr.id}
                          className="flex items-center justify-between rounded-lg border border-white/10 bg-[#0d1411] px-2.5 py-2 text-xs"
                        >
                          <div>
                            <div className="font-bold text-white">{fr.username}</div>
                            <div className="text-[10px] text-stone-400">
                              Lv.{fr.level} ·{' '}
                              <span className={fr.online ? 'text-emerald-400' : 'text-stone-500'}>
                                {fr.inMatch ? 'In Match' : fr.online ? 'Online' : 'Offline'}
                              </span>
                            </div>
                          </div>
                          {currentRoom && fr.online && !fr.inMatch && (
                            <button
                              type="button"
                              onClick={() => onRoomInvite(fr.id)}
                              className="rounded bg-[#d4a84b] px-2.5 py-1 text-[10px] font-extrabold text-[#0c120f]"
                            >
                              Invite
                            </button>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 5: PROFILE, ACHIEVEMENTS & LEADERBOARD */}
            {activeTab === 'profile' && (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-2 rounded-xl border border-white/10 bg-[#121c17] p-3 text-center">
                    <div>
                      <div className="text-[10px] uppercase text-stone-400">W / L Record</div>
                      <div className="text-base font-black tabular-nums text-white">
                        {profile.stats.wins} – {profile.stats.losses}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase text-stone-400">Online W / L</div>
                      <div className="text-base font-black tabular-nums text-emerald-300">
                        {profile.stats.onlineWins} – {profile.stats.onlineLosses}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase text-stone-400">Ranked Pos</div>
                      <div className="text-base font-black tabular-nums text-amber-300">
                        #{profile.rankPosition ?? 1} ({profile.stats.rankedRating})
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase text-stone-400">Fighters</div>
                      <div className="text-sm font-bold text-white">
                        {profile.unlockedFighters.length} / {FIGHTERS.length}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase text-stone-400">Bosses Cleared</div>
                      <div className="text-sm font-bold text-white">
                        {profile.stats.highestBossCleared} / {BOSSES.length}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase text-stone-400">Combos</div>
                      <div className="text-sm font-bold text-white">{profile.stats.combosLanded}</div>
                    </div>
                  </div>

                  {/* Achievements */}
                  <div className="rounded-xl border border-white/10 bg-[#121c17] p-3.5">
                    <div className="mb-2 text-xs font-bold uppercase tracking-wider text-[#d4a84b]">
                      Achievements
                    </div>
                    <div className="space-y-2">
                      {ACHIEVEMENTS.map((ach) => {
                        const claimed = profile.claimedAchievements.includes(ach.id);
                        const val = Number(profile.stats[ach.metric] ?? 0);
                        const ready = !claimed && val >= ach.target;
                        return (
                          <div
                            key={ach.id}
                            className="flex items-center justify-between rounded-lg border border-white/10 bg-[#0d1411] px-3 py-2 text-xs"
                          >
                            <div>
                              <div className="font-bold text-white">{ach.name}</div>
                              <div className="text-[10px] text-stone-400">
                                {ach.description} ({Math.min(val, ach.target)}/{ach.target})
                              </div>
                            </div>
                            {claimed ? (
                              <span className="font-bold text-emerald-400">Unlocked</span>
                            ) : (
                              <button
                                type="button"
                                disabled={!ready}
                                onClick={() => onClaimAchievement(ach.id)}
                                className={`rounded px-2.5 py-1 text-[10px] font-extrabold uppercase ${
                                  ready ? 'bg-amber-400 text-[#0c120f]' : 'bg-white/10 text-stone-500'
                                }`}
                              >
                                +{ach.apBonus} AP
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Right: Match History & Leaderboard */}
                <div className="space-y-4">
                  <div className="rounded-xl border border-white/10 bg-[#121c17] p-3.5">
                    <div className="mb-2 text-xs font-bold uppercase tracking-wider text-[#d4a84b]">
                      Recent Match History
                    </div>
                    {matchHistory.length === 0 ? (
                      <div className="text-xs text-stone-400">No matches recorded yet.</div>
                    ) : (
                      <div className="max-h-44 space-y-1.5 overflow-y-auto">
                        {matchHistory.map((mh) => (
                          <div
                            key={mh.id}
                            className="flex items-center justify-between rounded bg-[#0d1411] px-2.5 py-1.5 text-xs"
                          >
                            <div>
                              <span className={mh.result === 'WIN' ? 'font-bold text-emerald-400' : 'font-bold text-rose-400'}>
                                {mh.result}
                              </span>{' '}
                              <span className="text-white">vs {mh.opponentName}</span>
                              <div className="text-[10px] text-stone-400">
                                {mh.mode} · {getArenaById(mh.arenaId).name}
                              </div>
                            </div>
                            <span className="font-bold text-amber-300">+{mh.apEarned} AP</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="rounded-xl border border-white/10 bg-[#121c17] p-3.5">
                    <div className="mb-2 text-xs font-bold uppercase tracking-wider text-amber-300">
                      Global Ranked Leaderboard
                    </div>
                    <div className="space-y-1">
                      {leaderboard.map((row, idx) => (
                        <div
                          key={row.playerCode}
                          className="flex items-center justify-between rounded bg-[#0d1411] px-2.5 py-1.5 text-xs"
                        >
                          <div>
                            <span className="mr-2 font-black text-[#d4a84b]">#{idx + 1}</span>
                            <span className="font-bold text-white">{row.username}</span>{' '}
                            <span className="text-[10px] text-stone-400">Lv.{row.level}</span>
                          </div>
                          <span className="font-bold tabular-nums text-emerald-300">{row.rankedRating} ELO</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* UNIFIED BOTTOM CONTROL DOCK */}
      <div className="pointer-events-auto mx-auto flex flex-col items-center">
        <button
          type="button"
          onClick={onToggleDock}
          className="mb-1 flex items-center gap-1.5 rounded-t-lg border border-b-0 border-[#d4a84b]/40 bg-[#0b1310]/95 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-[#d4a84b]"
        >
          {dockCollapsed ? (
            <>
              <ChevronUp className="h-3.5 w-3.5" /> Show Arena Dock
            </>
          ) : (
            <>
              <ChevronDown className="h-3.5 w-3.5" /> Hide Dock
            </>
          )}
        </button>

        {!dockCollapsed && (
          <div className="flex flex-wrap items-center justify-center gap-1.5 rounded-2xl border border-[#d4a84b]/50 bg-[#0b1310]/95 p-1.5 shadow-xl sm:gap-2 sm:px-3">
            {[
              { id: 'play' as HubTab, label: 'Bosses & Arenas', icon: Swords },
              { id: 'fighters' as HubTab, label: 'Fighters (22)', icon: Sparkles },
              { id: 'missions' as HubTab, label: 'Missions', icon: Target },
              { id: 'multiplayer' as HubTab, label: 'Online & Friends', icon: Users },
              { id: 'profile' as HubTab, label: 'Profile & Ranks', icon: Trophy },
            ].map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectTab(active ? 'none' : item.id)}
                  className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-extrabold uppercase tracking-wide transition ${
                    active
                      ? 'bg-[#d4a84b] text-[#0b110e]'
                      : 'bg-[#131e19] text-stone-200 hover:bg-[#1b2b24] hover:text-white'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </button>
              );
            })}

            <button
              type="button"
              onClick={() => onStartBoss(Math.min(BOSSES.length, profile.stats.highestBossCleared + 1))}
              className="flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-black uppercase tracking-wider text-[#06120b] hover:bg-emerald-400"
            >
              <Crown className="h-4 w-4" />
              <span>Quick Fight Boss #{Math.min(BOSSES.length, profile.stats.highestBossCleared + 1)}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
