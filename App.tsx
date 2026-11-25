import { useCallback, useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { CombatHud } from './components/CombatHud.tsx';
import { HubOverlay, HubTab, LiveRoomLobby, LiveSpectateMatch } from './components/HubOverlay.tsx';
import { enterLandscapeFullscreen, LandscapeAndOfflineOverlay } from './components/LandscapeGuard.tsx';
import { TitleScreen } from './components/TitleScreen.tsx';
import { ArenaEngine, HudSnapshot, OnlineMatchSnapshot } from './game/ArenaEngine.ts';
import { soundEngine } from './game/sound.ts';
import {
  ArenaId,
  FriendEntry,
  FriendRequestEntry,
  getBossByIndex,
  GraphicsQuality,
  MatchHistoryEntry,
  PlayerProfile,
  Rarity,
} from './shared/gameData.ts';

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<ArenaEngine | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const soloSessionTokenRef = useRef<string | null>(null);
  const soloCompletedRef = useRef<boolean>(false);

  const [authToken, setAuthToken] = useState<string | null>(null);
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [matchHistory, setMatchHistory] = useState<MatchHistoryEntry[]>([]);
  const [leaderboard, setLeaderboard] = useState<
    Array<{
      username: string;
      playerCode: string;
      level: number;
      rankedRating: number;
      onlineWins: number;
      rankedWins: number;
      highestBossCleared: number;
    }>
  >([]);
  const [friends, setFriends] = useState<FriendEntry[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<FriendRequestEntry[]>([]);

  const [screen, setScreen] = useState<'title' | 'hub' | 'combat'>('title');
  const [activeTab, setActiveTab] = useState<HubTab>('play');
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [quality, setQuality] = useState<GraphicsQuality>('high');
  const [muted, setMuted] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [showTouchControls, setShowTouchControls] = useState<boolean>(() =>
    typeof window !== 'undefined' ? 'ontouchstart' in window || navigator.maxTouchPoints > 0 : false,
  );

  const [hud, setHud] = useState<HudSnapshot | null>(null);
  const [soloRewardInfo, setSoloRewardInfo] = useState<{ apEarned: number; xpEarned: number } | null>(null);
  const [onlineFinishInfo, setOnlineFinishInfo] = useState<{
    winningTeam: 1 | 2;
    reason: string;
    apEarned: number;
    xpEarned: number;
    ratingDelta: number;
    antiFarmBlocked: boolean;
    localWon: boolean;
  } | null>(null);

  const [socketConnected, setSocketConnected] = useState(false);
  const [queueCounts, setQueueCounts] = useState({ '1v1_normal': 0, '1v1_ranked': 0, '2v2_normal': 0 });
  const [activeQueue, setActiveQueue] = useState<'1v1_normal' | '1v1_ranked' | '2v2_normal' | null>(null);
  const [currentRoom, setCurrentRoom] = useState<LiveRoomLobby | null>(null);
  const [liveMatches, setLiveMatches] = useState<LiveSpectateMatch[]>([]);
  const [spectatingCode, setSpectatingCode] = useState<string | null>(null);
  const [pendingInvite, setPendingInvite] = useState<{
    code: string;
    fromUsername: string;
    mode: string;
    arenaId: ArenaId;
  } | null>(null);
  const [bannerMsg, setBannerMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const profileRef = useRef<PlayerProfile | null>(null);
  profileRef.current = profile;

  const authTokenRef = useRef<string | null>(null);
  authTokenRef.current = authToken;

  const currentRoomRef = useRef<LiveRoomLobby | null>(null);
  currentRoomRef.current = currentRoom;

  const showBanner = useCallback((type: 'ok' | 'err', text: string) => {
    setBannerMsg({ type, text });
    window.setTimeout(() => {
      setBannerMsg((prev) => (prev?.text === text ? null : prev));
    }, 4000);
  }, []);

  const refreshProfileAndSocial = useCallback(async (token: string) => {
    try {
      const [profRes, frRes, lbRes] = await Promise.all([
        fetch('/api/profile', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/friends', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/leaderboard'),
      ]);
      if (profRes.ok) {
        const pData = await profRes.json();
        setProfile(pData.profile);
        setMatchHistory(pData.matchHistory || []);
      }
      if (frRes.ok) {
        const fData = await frRes.json();
        setFriends(fData.friends || []);
        setIncomingRequests(fData.incomingRequests || []);
      }
      if (lbRes.ok) {
        const lData = await lbRes.json();
        setLeaderboard(lData.leaderboard || []);
      }
    } catch {
      // Ignore transient network errors
    }
  }, []);

  const finalizeSoloMatchOnServer = useCallback(
    async (snap: HudSnapshot) => {
      const token = authTokenRef.current;
      const sessionToken = soloSessionTokenRef.current;
      if (!token || !sessionToken || !snap.soloResult || soloCompletedRef.current) return;
      soloCompletedRef.current = true;
      try {
        const res = await fetch('/api/solo/complete', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            sessionToken,
            won: snap.soloResult.won,
            roundsWon: snap.soloResult.roundsWon,
            roundsLost: snap.soloResult.roundsLost,
            combosLanded: snap.soloResult.combosLanded,
            objectsDestroyed: snap.soloResult.objectsDestroyed,
            specialsHit: snap.soloResult.specialsHit,
            parriesLanded: snap.soloResult.parriesLanded,
          }),
        });
        const data = await res.json();
        if (res.ok) {
          setSoloRewardInfo({ apEarned: data.apEarned, xpEarned: data.xpEarned });
          setProfile(data.profile);
          void refreshProfileAndSocial(token);
        }
      } catch {
        // Fallback display if offline
      }
    },
    [refreshProfileAndSocial],
  );

  // Mount Three.js ArenaEngine ONCE in isolated ref container
  useEffect(() => {
    const el = canvasMountRef.current;
    if (!el) return;

    const engine = new ArenaEngine(el, {
      onHudUpdate: (snapshot) => {
        setHud(snapshot);
        if (snapshot.mode === 'solo' && snapshot.soloResult) {
          void finalizeSoloMatchOnServer(snapshot);
        }
      },
      onOnlineInput: (input) => {
        socketRef.current?.emit('combat:input', input);
      },
    });
    engineRef.current = engine;

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, [finalizeSoloMatchOnServer]);

  // Global keyboard shortcuts (Escape pause, H hide hub dock)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.code === 'Escape' && screen === 'combat') {
        setIsPaused((p) => !p);
      } else if (e.code === 'KeyH' && screen === 'hub') {
        setDockCollapsed((c) => !c);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [screen]);

  // Socket.IO connection bound to authenticated Bearer token
  useEffect(() => {
    if (!authToken) {
      socketRef.current?.disconnect();
      socketRef.current = null;
      setSocketConnected(false);
      return;
    }

    const socket = io({
      auth: { token: authToken },
      transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;

    socket.on('connect', () => setSocketConnected(true));
    socket.on('disconnect', () => setSocketConnected(false));

    socket.on('queue:counts', (counts) => setQueueCounts(counts));
    socket.on('spectate:list', (list) => setLiveMatches(list));

    socket.on('room:joined', (room: LiveRoomLobby) => {
      setCurrentRoom(room);
      setActiveQueue(null);
    });
    socket.on('room:update', (room: LiveRoomLobby) => {
      setCurrentRoom(room);
    });
    socket.on('room:left', () => setCurrentRoom(null));
    socket.on('room:error', (data: { error: string }) => {
      showBanner('err', data.error);
    });
    socket.on('room:invited', (inv) => {
      setPendingInvite(inv);
    });

    socket.on('friends:updated', () => {
      if (authTokenRef.current) void refreshProfileAndSocial(authTokenRef.current);
    });
    socket.on('profile:updated', (nextProfile: PlayerProfile) => {
      setProfile(nextProfile);
      if (authTokenRef.current) void refreshProfileAndSocial(authTokenRef.current);
    });

    socket.on('match:start', (payload: { room: LiveRoomLobby; state: OnlineMatchSnapshot }) => {
      const uid = profileRef.current?.id ?? 0;
      setActiveQueue(null);
      setCurrentRoom(payload.room);
      setOnlineFinishInfo(null);
      setSoloRewardInfo(null);
      setIsPaused(false);
      setScreen('combat');
      engineRef.current?.startOnlineView(payload.room.arenaId, uid, false);
      engineRef.current?.applyOnlineState(payload.state);
    });

    socket.on('spectate:joined', (payload: { room: LiveRoomLobby; state: OnlineMatchSnapshot }) => {
      setSpectatingCode(payload.room.code);
      setOnlineFinishInfo(null);
      setIsPaused(false);
      setScreen('combat');
      engineRef.current?.startOnlineView(payload.room.arenaId, 0, true);
      engineRef.current?.applyOnlineState(payload.state);
    });

    socket.on('match:state', (state: OnlineMatchSnapshot) => {
      engineRef.current?.applyOnlineState(state);
    });

    socket.on('match:event', (evt) => {
      engineRef.current?.handleOnlineEvent(evt);
    });

    socket.on(
      'match:finished',
      (data: {
        winningTeam: 1 | 2;
        reason: string;
        rewards: Record<number, { apEarned: number; xpEarned: number; ratingDelta: number; antiFarmBlocked: boolean }>;
      }) => {
        const uid = profileRef.current?.id ?? 0;
        const myRoom = currentRoomRef.current;
        const myMember = myRoom?.members.find((m) => m.userId === uid);
        const myReward = data.rewards[uid] || { apEarned: 0, xpEarned: 0, ratingDelta: 0, antiFarmBlocked: false };
        setOnlineFinishInfo({
          winningTeam: data.winningTeam,
          reason: data.reason,
          apEarned: myReward.apEarned,
          xpEarned: myReward.xpEarned,
          ratingDelta: myReward.ratingDelta,
          antiFarmBlocked: myReward.antiFarmBlocked,
          localWon: myMember ? myMember.team === data.winningTeam : false,
        });
      },
    );

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [authToken, refreshProfileAndSocial, showBanner]);

  const handleAuthSuccess = (token: string, nextProfile: PlayerProfile) => {
    soundEngine.unlock();
    setAuthToken(token);
    setProfile(nextProfile);
    setScreen('hub');
    setActiveTab('play');
    engineRef.current?.showShowcaseFighter(nextProfile.selectedFighterId, 'ancient_temple');
    void refreshProfileAndSocial(token);
  };

  const handleLogout = () => {
    setAuthToken(null);
    setProfile(null);
    setCurrentRoom(null);
    setActiveQueue(null);
    setScreen('title');
    engineRef.current?.loadTitleScene('jungle_falls');
  };

  const handleSelectFighter = async (fighterId: string) => {
    if (!authToken) return;
    const res = await fetch('/api/profile/select-fighter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({ fighterId }),
    });
    const data = await res.json();
    if (res.ok) {
      setProfile(data.profile);
      engineRef.current?.showShowcaseFighter(fighterId);
      socketRef.current?.emit('room:fighter', { fighterId });
      showBanner('ok', 'Active fighter equipped!');
    } else {
      showBanner('err', data.error || 'Could not select fighter');
    }
  };

  const handleUnlockFighter = async (fighterId: string) => {
    if (!authToken) return;
    const res = await fetch('/api/fighters/unlock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({ fighterId }),
    });
    const data = await res.json();
    if (res.ok) {
      setProfile(data.profile);
      engineRef.current?.showShowcaseFighter(fighterId);
      soundEngine.playVictory();
      showBanner('ok', 'Fighter unlocked and equipped!');
    } else {
      showBanner('err', data.error || 'Unlock requirements not met');
    }
  };

  const handleStartBoss = async (bossIndex: number) => {
    if (!authToken || !profile) return;
    const boss = getBossByIndex(bossIndex);
    const res = await fetch('/api/solo/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({
        mode: 'boss',
        bossIndex,
        arenaId: boss.arenaId,
        fighterId: profile.selectedFighterId,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      showBanner('err', data.error || 'Boss locked');
      return;
    }
    soloSessionTokenRef.current = data.sessionToken;
    soloCompletedRef.current = false;
    setSoloRewardInfo(null);
    setOnlineFinishInfo(null);
    setIsPaused(false);
    setScreen('combat');
    if (showTouchControls) void enterLandscapeFullscreen();
    engineRef.current?.startSoloMatch({
      fighterId: profile.selectedFighterId,
      arenaId: boss.arenaId,
      bossIndex,
    });
  };

  const handleStartSkirmish = async (arenaId: ArenaId, opponentFighterId: string, opponentRarity: Rarity) => {
    if (!authToken || !profile) return;
    const res = await fetch('/api/solo/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({
        mode: 'skirmish',
        bossIndex: 0,
        arenaId,
        fighterId: profile.selectedFighterId,
        opponentRarity,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      showBanner('err', data.error || 'Failed to start skirmish');
      return;
    }
    soloSessionTokenRef.current = data.sessionToken;
    soloCompletedRef.current = false;
    setSoloRewardInfo(null);
    setOnlineFinishInfo(null);
    setIsPaused(false);
    setScreen('combat');
    if (showTouchControls) void enterLandscapeFullscreen();
    engineRef.current?.startSoloMatch({
      fighterId: profile.selectedFighterId,
      arenaId,
      opponentFighterId,
      opponentRarity,
    });
  };

  const handleClaimMission = async (missionId: string) => {
    if (!authToken) return;
    const res = await fetch('/api/missions/claim', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({ missionId }),
    });
    const data = await res.json();
    if (res.ok) {
      setProfile(data.profile);
      soundEngine.playVictory();
      showBanner('ok', 'Mission reward claimed!');
    } else {
      showBanner('err', data.error || 'Unable to claim mission');
    }
  };

  const handleClaimAchievement = async (achievementId: string) => {
    if (!authToken) return;
    const res = await fetch('/api/achievements/claim', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({ achievementId }),
    });
    const data = await res.json();
    if (res.ok) {
      setProfile(data.profile);
      soundEngine.playVictory();
      showBanner('ok', 'Achievement AP bonus claimed!');
    } else {
      showBanner('err', data.error || 'Unable to claim achievement');
    }
  };

  const handleSendFriendRequest = async (query: string) => {
    if (!authToken) return;
    const res = await fetch('/api/friends/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({ query }),
    });
    const data = await res.json();
    if (res.ok) {
      showBanner('ok', data.message || 'Friend request sent!');
      void refreshProfileAndSocial(authToken);
    } else {
      showBanner('err', data.error || 'Could not send request');
    }
  };

  const handleRespondFriendRequest = async (requestId: number, accept: boolean) => {
    if (!authToken) return;
    const res = await fetch('/api/friends/respond', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({ requestId, accept }),
    });
    if (res.ok) {
      void refreshProfileAndSocial(authToken);
      showBanner('ok', accept ? 'Friend added!' : 'Request declined');
    }
  };

  const handleExitMatch = () => {
    if (spectatingCode) {
      socketRef.current?.emit('spectate:leave', { code: spectatingCode });
      setSpectatingCode(null);
    } else if (hud?.mode === 'online' && !onlineFinishInfo) {
      socketRef.current?.emit('room:leave');
    }
    setIsPaused(false);
    setOnlineFinishInfo(null);
    setSoloRewardInfo(null);
    setHud(null);
    setScreen('hub');
    if (profile) {
      engineRef.current?.showShowcaseFighter(profile.selectedFighterId, 'ancient_temple');
      if (authToken) void refreshProfileAndSocial(authToken);
    }
  };

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#090d0b]">
      {/* Isolated WebGL Canvas Container */}
      <div ref={canvasMountRef} className="fixed inset-0 z-0 h-full w-full" />

      <LandscapeAndOfflineOverlay />

      {screen === 'title' && <TitleScreen onAuthSuccess={handleAuthSuccess} />}

      {screen === 'hub' && profile && (
        <HubOverlay
          profile={profile}
          matchHistory={matchHistory}
          leaderboard={leaderboard}
          friends={friends}
          incomingRequests={incomingRequests}
          activeTab={activeTab}
          dockCollapsed={dockCollapsed}
          quality={quality}
          muted={muted}
          socketConnected={socketConnected}
          queueCounts={queueCounts}
          activeQueue={activeQueue}
          currentRoom={currentRoom}
          liveMatches={liveMatches}
          pendingInvite={pendingInvite}
          bannerMsg={bannerMsg}
          onSelectTab={(tab) => {
            setActiveTab(tab);
            if (tab === 'profile' || tab === 'multiplayer') {
              if (authToken) void refreshProfileAndSocial(authToken);
            }
          }}
          onToggleDock={() => setDockCollapsed((c) => !c)}
          onChangeQuality={(q) => {
            setQuality(q);
            engineRef.current?.setQuality(q);
          }}
          onToggleMute={() => {
            const next = !muted;
            soundEngine.muted = next;
            setMuted(next);
          }}
          onLogout={handleLogout}
          onPreviewFighter={(fid) => engineRef.current?.showShowcaseFighter(fid)}
          onSelectFighter={handleSelectFighter}
          onUnlockFighter={handleUnlockFighter}
          onStartBoss={handleStartBoss}
          onStartSkirmish={handleStartSkirmish}
          onClaimMission={handleClaimMission}
          onClaimAchievement={handleClaimAchievement}
          onSendFriendRequest={handleSendFriendRequest}
          onRespondFriendRequest={handleRespondFriendRequest}
          onCreateRoom={(mode, isRanked, arenaId) => socketRef.current?.emit('room:create', { mode, isRanked, arenaId })}
          onJoinRoom={(code) => socketRef.current?.emit('room:join', { code })}
          onLeaveRoom={() => socketRef.current?.emit('room:leave')}
          onRoomConfig={(cfg) => socketRef.current?.emit('room:config', cfg)}
          onRoomReady={(d) => socketRef.current?.emit('room:ready', d)}
          onRoomInvite={(friendId) => {
            socketRef.current?.emit('room:invite', { friendId });
            showBanner('ok', 'Room invitation sent!');
          }}
          onRoomStart={() => socketRef.current?.emit('room:start')}
          onJoinQueue={(queueType) => {
            setActiveQueue(queueType);
            socketRef.current?.emit('queue:join', { queueType });
          }}
          onLeaveQueue={() => {
            setActiveQueue(null);
            socketRef.current?.emit('queue:leave');
          }}
          onSpectateMatch={(code) => socketRef.current?.emit('spectate:join', { code })}
          onDismissInvite={() => setPendingInvite(null)}
        />
      )}

      {screen === 'combat' && hud && (
        <CombatHud
          hud={hud}
          isPaused={isPaused}
          muted={muted}
          quality={quality}
          showTouchControls={showTouchControls}
          onlineFinishInfo={onlineFinishInfo}
          soloRewardInfo={soloRewardInfo}
          onTogglePause={() => setIsPaused((p) => !p)}
          onToggleMute={() => {
            const next = !muted;
            soundEngine.muted = next;
            setMuted(next);
          }}
          onChangeQuality={(q) => {
            setQuality(q);
            engineRef.current?.setQuality(q);
          }}
          onToggleTouchControls={() => setShowTouchControls((s) => !s)}
          onExitMatch={handleExitMatch}
          onMobileMove={(x, y) => engineRef.current?.setMobileMove(x, y)}
          onMobileAction={(a) => engineRef.current?.triggerAction(a)}
        />
      )}
    </div>
  );
}
