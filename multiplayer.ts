import crypto from 'crypto';
import type { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import {
  AP_REWARDS,
  ARENAS,
  ArenaId,
  getEffectiveStats,
  getFighterById,
} from '../shared/gameData.ts';
import { verifyAuthToken } from './auth.ts';
import {
  checkAndRecordPvpAntiFarm,
  db,
  getUserRowById,
  recordOnlineMatchResult,
  toPlayerProfile,
} from './db.ts';

export type RoomMode = '1v1' | '2v2';

export interface RoomMember {
  userId: number;
  username: string;
  playerCode: string;
  fighterId: string;
  team: 1 | 2;
  ready: boolean;
  socketId: string;
}

export interface CombatFighterState {
  userId: number;
  username: string;
  fighterId: string;
  team: 1 | 2;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  yaw: number;
  hp: number;
  maxHp: number;
  stamina: number;
  maxStamina: number;
  action: 'idle' | 'move' | 'light' | 'heavy' | 'special' | 'block' | 'dodge' | 'hit' | 'ko' | 'victory';
  actionTimer: number;
  comboStep: number;
  comboCount: number;
  comboResetTimer: number;
  parryWindow: number;
  invulnTimer: number;
  hitDidConnect: boolean;
  moveX: number;
  moveZ: number;
  aimYaw: number;
  blocking: boolean;
  combosLanded: number;
  objectsDestroyed: number;
  specialsHit: number;
  parriesLanded: number;
}

export interface DestructibleState {
  id: number;
  x: number;
  z: number;
  hp: number;
  destroyed: boolean;
}

export interface ActiveMatchState {
  round: number;
  team1Rounds: number;
  team2Rounds: number;
  phase: 'intro' | 'fighting' | 'round_over' | 'match_over';
  phaseTimer: number;
  roundTimeLeft: number;
  fighters: Record<number, CombatFighterState>;
  destructibles: DestructibleState[];
}

export interface GameRoom {
  code: string;
  hostUserId: number;
  mode: RoomMode;
  isRanked: boolean;
  isPublic: boolean;
  arenaId: ArenaId;
  members: RoomMember[];
  spectators: Set<string>;
  status: 'lobby' | 'playing';
  match?: ActiveMatchState;
}

interface AuthedSocket extends Socket {
  userId?: number;
  username?: string;
  playerCode?: string;
}

const userSockets = new Map<number, Set<string>>();
const userInRoom = new Map<number, string>(); // userId -> roomCode
const rooms = new Map<string, GameRoom>();

// Real player matchmaking queues (no bots!)
const queues: Record<'1v1_normal' | '1v1_ranked' | '2v2_normal', Array<{ userId: number; socketId: string; fighterId: string }>> = {
  '1v1_normal': [],
  '1v1_ranked': [],
  '2v2_normal': [],
};

let ioRef: SocketIOServer | null = null;

export function isUserOnline(userId: number): boolean {
  const set = userSockets.get(userId);
  return Boolean(set && set.size > 0);
}

export function isUserInMatch(userId: number): boolean {
  const code = userInRoom.get(userId);
  if (!code) return false;
  const r = rooms.get(code);
  return r?.status === 'playing';
}

export function emitToUser(userId: number, event: string, payload: unknown): void {
  if (!ioRef) return;
  const set = userSockets.get(userId);
  if (!set) return;
  for (const sid of set) {
    ioRef.to(sid).emit(event, payload);
  }
}

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for (let attempt = 0; attempt < 20; attempt++) {
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars[crypto.randomInt(0, chars.length)];
    }
    if (!rooms.has(code)) return code;
  }
  return `W${Date.now().toString(36).toUpperCase().slice(-5)}`;
}

function sanitizeRoomForClient(room: GameRoom) {
  return {
    code: room.code,
    hostUserId: room.hostUserId,
    mode: room.mode,
    isRanked: room.isRanked,
    isPublic: room.isPublic,
    arenaId: room.arenaId,
    status: room.status,
    spectatorCount: room.spectators.size,
    members: room.members.map((m) => ({
      userId: m.userId,
      username: m.username,
      playerCode: m.playerCode,
      fighterId: m.fighterId,
      team: m.team,
      ready: m.ready,
    })),
  };
}

function broadcastRoomUpdate(room: GameRoom): void {
  if (!ioRef) return;
  ioRef.to(`room:${room.code}`).emit('room:update', sanitizeRoomForClient(room));
  broadcastLiveMatchesList();
}

function broadcastQueueStatus(): void {
  if (!ioRef) return;
  ioRef.emit('queue:counts', {
    '1v1_normal': queues['1v1_normal'].length,
    '1v1_ranked': queues['1v1_ranked'].length,
    '2v2_normal': queues['2v2_normal'].length,
  });
}

function broadcastLiveMatchesList(): void {
  if (!ioRef) return;
  const live = Array.from(rooms.values())
    .filter((r) => r.status === 'playing' && r.match)
    .map((r) => ({
      code: r.code,
      mode: r.mode,
      isRanked: r.isRanked,
      arenaId: r.arenaId,
      round: r.match!.round,
      team1Rounds: r.match!.team1Rounds,
      team2Rounds: r.match!.team2Rounds,
      spectatorCount: r.spectators.size,
      players: r.members.map((m) => ({
        username: m.username,
        fighterId: m.fighterId,
        team: m.team,
      })),
    }));
  ioRef.emit('spectate:list', live);
}

function createInitialDestructibles(): DestructibleState[] {
  const props: DestructibleState[] = [];
  const count = 8;
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + 0.35;
    const dist = 10 + (i % 2) * 4.5;
    props.push({
      id: i + 1,
      x: Math.cos(angle) * dist,
      z: Math.sin(angle) * dist,
      hp: 30,
      destroyed: false,
    });
  }
  return props;
}

function spawnFighterPositions(members: RoomMember[], isRanked: boolean): Record<number, CombatFighterState> {
  const fighters: Record<number, CombatFighterState> = {};
  const team1 = members.filter((m) => m.team === 1);
  const team2 = members.filter((m) => m.team === 2);

  const place = (m: RoomMember, idx: number, total: number, side: -1 | 1) => {
    const def = getFighterById(m.fighterId);
    const stats = getEffectiveStats(def, isRanked);
    const maxHp = Math.round(180 + stats.defense * 1.35);
    const zOffset = total > 1 ? (idx === 0 ? -3.2 : 3.2) : 0;
    const x = side * 7.5;
    fighters[m.userId] = {
      userId: m.userId,
      username: m.username,
      fighterId: m.fighterId,
      team: m.team,
      x,
      y: 0,
      z: zOffset,
      vx: 0,
      vy: 0,
      vz: 0,
      yaw: side === -1 ? Math.PI / 2 : -Math.PI / 2,
      hp: maxHp,
      maxHp,
      stamina: 100,
      maxStamina: 100,
      action: 'idle',
      actionTimer: 0,
      comboStep: 0,
      comboCount: 0,
      comboResetTimer: 0,
      parryWindow: 0,
      invulnTimer: 0,
      hitDidConnect: false,
      moveX: 0,
      moveZ: 0,
      aimYaw: side === -1 ? Math.PI / 2 : -Math.PI / 2,
      blocking: false,
      combosLanded: 0,
      objectsDestroyed: 0,
      specialsHit: 0,
      parriesLanded: 0,
    };
  };

  team1.forEach((m, i) => place(m, i, team1.length, -1));
  team2.forEach((m, i) => place(m, i, team2.length, 1));
  return fighters;
}

function startRoomCombat(room: GameRoom): void {
  room.status = 'playing';
  room.match = {
    round: 1,
    team1Rounds: 0,
    team2Rounds: 0,
    phase: 'intro',
    phaseTimer: 1.6,
    roundTimeLeft: 90,
    fighters: spawnFighterPositions(room.members, room.isRanked),
    destructibles: createInitialDestructibles(),
  };
  broadcastRoomUpdate(room);
  if (ioRef) {
    ioRef.to(`room:${room.code}`).emit('match:start', {
      room: sanitizeRoomForClient(room),
      state: room.match,
    });
  }
}

function removeSocketFromQueues(socketId: string): void {
  let changed = false;
  (Object.keys(queues) as Array<keyof typeof queues>).forEach((key) => {
    const before = queues[key].length;
    queues[key] = queues[key].filter((q) => q.socketId !== socketId);
    if (queues[key].length !== before) changed = true;
  });
  if (changed) broadcastQueueStatus();
}

function tryMatchmaking(): void {
  if (!ioRef) return;

  // 1v1 Normal & Ranked
  (['1v1_normal', '1v1_ranked'] as const).forEach((qKey) => {
    const q = queues[qKey];
    while (q.length >= 2) {
      const p1 = q.shift()!;
      const p2 = q.shift()!;
      if (p1.userId === p2.userId) {
        q.unshift(p1);
        break;
      }
      const u1 = getUserRowById(p1.userId);
      const u2 = getUserRowById(p2.userId);
      if (!u1 || !u2) continue;

      const code = generateRoomCode();
      const randomArena = ARENAS[crypto.randomInt(0, ARENAS.length)].id;
      const room: GameRoom = {
        code,
        hostUserId: u1.id,
        mode: '1v1',
        isRanked: qKey === '1v1_ranked',
        isPublic: true,
        arenaId: randomArena,
        status: 'lobby',
        spectators: new Set(),
        members: [
          {
            userId: u1.id,
            username: u1.username,
            playerCode: u1.player_code,
            fighterId: p1.fighterId,
            team: 1,
            ready: true,
            socketId: p1.socketId,
          },
          {
            userId: u2.id,
            username: u2.username,
            playerCode: u2.player_code,
            fighterId: p2.fighterId,
            team: 2,
            ready: true,
            socketId: p2.socketId,
          },
        ],
      };
      rooms.set(code, room);
      userInRoom.set(u1.id, code);
      userInRoom.set(u2.id, code);

      ioRef?.sockets.sockets.get(p1.socketId)?.join(`room:${code}`);
      ioRef?.sockets.sockets.get(p2.socketId)?.join(`room:${code}`);
      startRoomCombat(room);
      broadcastQueueStatus();
    }
  });

  // 2v2 Normal
  const q2 = queues['2v2_normal'];
  while (q2.length >= 4) {
    const batch = q2.splice(0, 4);
    const uniqueIds = new Set(batch.map((b) => b.userId));
    if (uniqueIds.size < 4) {
      q2.unshift(...batch);
      break;
    }
    const users = batch.map((b) => getUserRowById(b.userId)).filter(Boolean);
    if (users.length < 4) continue;

    const code = generateRoomCode();
    const randomArena = ARENAS[crypto.randomInt(0, ARENAS.length)].id;
    const room: GameRoom = {
      code,
      hostUserId: users[0]!.id,
      mode: '2v2',
      isRanked: false,
      isPublic: true,
      arenaId: randomArena,
      status: 'lobby',
      spectators: new Set(),
      members: batch.map((b, idx) => {
        const u = users[idx]!;
        return {
          userId: u.id,
          username: u.username,
          playerCode: u.player_code,
          fighterId: b.fighterId,
          team: idx < 2 ? 1 : 2,
          ready: true,
          socketId: b.socketId,
        };
      }),
    };
    rooms.set(code, room);
    batch.forEach((b) => {
      userInRoom.set(b.userId, code);
      ioRef?.sockets.sockets.get(b.socketId)?.join(`room:${code}`);
    });
    startRoomCombat(room);
    broadcastQueueStatus();
  }
}

function leaveUserFromRoom(userId: number, socket?: AuthedSocket): void {
  const code = userInRoom.get(userId);
  if (!code) return;
  userInRoom.delete(userId);
  const room = rooms.get(code);
  if (!room) return;

  if (socket) {
    socket.leave(`room:${code}`);
  }

  // If match was playing and someone leaves, forfeit their team
  if (room.status === 'playing' && room.match && room.match.phase !== 'match_over') {
    const leaver = room.members.find((m) => m.userId === userId);
    if (leaver) {
      const winnerTeam: 1 | 2 = leaver.team === 1 ? 2 : 1;
      finalizeOnlineMatch(room, winnerTeam, `${leaver.username} disconnected`);
    }
  }

  room.members = room.members.filter((m) => m.userId !== userId);
  if (room.members.length === 0) {
    rooms.delete(code);
    broadcastLiveMatchesList();
  } else {
    if (room.hostUserId === userId) {
      room.hostUserId = room.members[0].userId;
    }
    broadcastRoomUpdate(room);
  }
}

function finalizeOnlineMatch(room: GameRoom, winningTeam: 1 | 2, reason: string): void {
  if (!room.match || room.match.phase === 'match_over') return;
  room.match.phase = 'match_over';
  room.match.phaseTimer = 4.0;

  const team1Members = room.members.filter((m) => m.team === 1);
  const team2Members = room.members.filter((m) => m.team === 2);
  const winners = winningTeam === 1 ? team1Members : team2Members;
  const losers = winningTeam === 1 ? team2Members : team1Members;

  const baseAp = room.isRanked
    ? AP_REWARDS.RANKED_WIN
    : room.mode === '2v2'
      ? AP_REWARDS.TEAM_2V2_WIN
      : AP_REWARDS.ONLINE_WIN;
  const baseXp = room.isRanked ? 180 : 120;

  const perUserRewards: Record<number, { apEarned: number; xpEarned: number; ratingDelta: number; antiFarmBlocked: boolean }> = {};

  winners.forEach((w) => {
    const oppIds = losers.map((l) => l.userId);
    const allowedAp = checkAndRecordPvpAntiFarm(w.userId, oppIds);
    const apEarned = allowedAp ? baseAp : 0;
    const xpEarned = allowedAp ? baseXp : 20;
    const ratingDelta = room.isRanked ? 24 : 0;
    const fState = room.match!.fighters[w.userId];
    const rWon = winningTeam === 1 ? room.match!.team1Rounds : room.match!.team2Rounds;
    const rLost = winningTeam === 1 ? room.match!.team2Rounds : room.match!.team1Rounds;

    recordOnlineMatchResult({
      userId: w.userId,
      mode: room.isRanked ? 'Ranked Online' : room.mode === '2v2' ? 'Online 2v2' : 'Online 1v1',
      opponentName: losers.map((l) => l.username).join(', ') || 'Challenger',
      arenaId: room.arenaId,
      fighterId: w.fighterId,
      won: true,
      isRanked: room.isRanked,
      apEarned,
      xpEarned,
      ratingDelta,
      roundsWon: rWon,
      roundsLost: rLost,
      flawless: rLost === 0,
      combosLanded: fState?.combosLanded ?? 0,
      objectsDestroyed: fState?.objectsDestroyed ?? 0,
      specialsHit: fState?.specialsHit ?? 0,
      parriesLanded: fState?.parriesLanded ?? 0,
    });

    perUserRewards[w.userId] = {
      apEarned,
      xpEarned,
      ratingDelta,
      antiFarmBlocked: !allowedAp,
    };
  });

  losers.forEach((l) => {
    const fState = room.match!.fighters[l.userId];
    const rWon = l.team === 1 ? room.match!.team1Rounds : room.match!.team2Rounds;
    const rLost = l.team === 1 ? room.match!.team2Rounds : room.match!.team1Rounds;
    const ratingDelta = room.isRanked ? -16 : 0;
    const xpEarned = 35;

    recordOnlineMatchResult({
      userId: l.userId,
      mode: room.isRanked ? 'Ranked Online' : room.mode === '2v2' ? 'Online 2v2' : 'Online 1v1',
      opponentName: winners.map((w) => w.username).join(', ') || 'Challenger',
      arenaId: room.arenaId,
      fighterId: l.fighterId,
      won: false,
      isRanked: room.isRanked,
      apEarned: 0,
      xpEarned,
      ratingDelta,
      roundsWon: rWon,
      roundsLost: rLost,
      flawless: false,
      combosLanded: fState?.combosLanded ?? 0,
      objectsDestroyed: fState?.objectsDestroyed ?? 0,
      specialsHit: fState?.specialsHit ?? 0,
      parriesLanded: fState?.parriesLanded ?? 0,
    });

    perUserRewards[l.userId] = {
      apEarned: 0,
      xpEarned,
      ratingDelta,
      antiFarmBlocked: false,
    };
  });

  if (ioRef) {
    ioRef.to(`room:${room.code}`).emit('match:finished', {
      winningTeam,
      reason,
      team1Rounds: room.match.team1Rounds,
      team2Rounds: room.match.team2Rounds,
      rewards: perUserRewards,
    });

    // Push refreshed profile to each participant
    room.members.forEach((m) => {
      const row = getUserRowById(m.userId);
      if (row) emitToUser(m.userId, 'profile:updated', toPlayerProfile(row));
    });
  }

  // Return room to lobby state after short delay if private, or keep ready for rematch
  setTimeout(() => {
    const liveRoom = rooms.get(room.code);
    if (!liveRoom) return;
    liveRoom.status = 'lobby';
    liveRoom.match = undefined;
    liveRoom.members.forEach((m) => {
      m.ready = m.userId === liveRoom.hostUserId;
    });
    broadcastRoomUpdate(liveRoom);
  }, 4500);
}

function stepOnlineMatch(room: GameRoom, dt: number): void {
  const m = room.match;
  if (!m || !ioRef) return;

  if (m.phase === 'intro') {
    m.phaseTimer -= dt;
    if (m.phaseTimer <= 0) {
      m.phase = 'fighting';
      ioRef.to(`room:${room.code}`).emit('match:event', { type: 'round_start', round: m.round });
    }
    return;
  }

  if (m.phase === 'round_over') {
    m.phaseTimer -= dt;
    if (m.phaseTimer <= 0) {
      if (m.team1Rounds >= 2 || m.team2Rounds >= 2) {
        finalizeOnlineMatch(room, m.team1Rounds >= 2 ? 1 : 2, 'Knockout Victory');
      } else {
        m.round += 1;
        m.roundTimeLeft = 90;
        m.phase = 'intro';
        m.phaseTimer = 1.4;
        const fresh = spawnFighterPositions(room.members, room.isRanked);
        // Preserve cumulative stats across rounds
        Object.keys(fresh).forEach((uidStr) => {
          const uid = Number(uidStr);
          const prev = m.fighters[uid];
          if (prev) {
            fresh[uid].combosLanded = prev.combosLanded;
            fresh[uid].objectsDestroyed = prev.objectsDestroyed;
            fresh[uid].specialsHit = prev.specialsHit;
            fresh[uid].parriesLanded = prev.parriesLanded;
          }
        });
        m.fighters = fresh;
        ioRef.to(`room:${room.code}`).emit('match:event', { type: 'next_round', round: m.round });
      }
    }
    return;
  }

  if (m.phase === 'match_over') return;

  // Fighting phase
  m.roundTimeLeft = Math.max(0, m.roundTimeLeft - dt);
  const arena = ARENAS.find((a) => a.id === room.arenaId) ?? ARENAS[0];
  const fighterList = Object.values(m.fighters);

  for (const f of fighterList) {
    if (f.hp <= 0) {
      f.action = 'ko';
      continue;
    }

    const def = getFighterById(f.fighterId);
    const stats = getEffectiveStats(def, room.isRanked);
    const moveSpeed = 5.4 + (stats.speed / 100) * 3.8;

    if (f.invulnTimer > 0) f.invulnTimer = Math.max(0, f.invulnTimer - dt);
    if (f.parryWindow > 0) f.parryWindow = Math.max(0, f.parryWindow - dt);
    if (f.comboResetTimer > 0) {
      f.comboResetTimer -= dt;
      if (f.comboResetTimer <= 0) {
        f.comboStep = 0;
        f.comboCount = 0;
      }
    }

    // Stamina regen
    if (f.action === 'idle' || f.action === 'move') {
      f.stamina = Math.min(f.maxStamina, f.stamina + 20 * dt);
    } else if (f.blocking) {
      f.stamina = Math.max(0, f.stamina - 8 * dt);
      if (f.stamina <= 0) {
        f.blocking = false;
        f.action = 'idle';
      }
    }

    // Gravity / Jump
    if (f.y > 0 || f.vy !== 0) {
      f.vy -= 26 * dt;
      f.y += f.vy * dt;
      if (f.y <= 0) {
        f.y = 0;
        f.vy = 0;
      }
    }

    // Action state progression
    if (f.action === 'light' || f.action === 'heavy' || f.action === 'special' || f.action === 'dodge' || f.action === 'hit') {
      f.actionTimer -= dt;

      // Hit detection window mid-swing
      if ((f.action === 'light' || f.action === 'heavy' || f.action === 'special') && !f.hitDidConnect) {
        const triggerThreshold = f.action === 'light' ? 0.16 : f.action === 'heavy' ? 0.24 : 0.28;
        if (f.actionTimer <= triggerThreshold) {
          f.hitDidConnect = true;
          const reach = f.action === 'special' ? 4.4 : f.action === 'heavy' ? 3.1 : 2.6;
          const fwdX = Math.sin(f.yaw);
          const fwdZ = Math.cos(f.yaw);

          // Check destructibles
          for (const prop of m.destructibles) {
            if (prop.destroyed) continue;
            const dx = prop.x - f.x;
            const dz = prop.z - f.z;
            const dist = Math.hypot(dx, dz);
            if (dist <= reach + 0.8) {
              prop.hp -= f.action === 'light' ? 16 : 34;
              if (prop.hp <= 0) {
                prop.destroyed = true;
                f.objectsDestroyed += 1;
                f.stamina = Math.min(f.maxStamina, f.stamina + 16);
                f.hp = Math.min(f.maxHp, f.hp + 10);
                ioRef.to(`room:${room.code}`).emit('match:event', {
                  type: 'prop_destroyed',
                  propId: prop.id,
                  byUserId: f.userId,
                });
              }
            }
          }

          // Check enemy fighters
          for (const target of fighterList) {
            if (target.team === f.team || target.hp <= 0 || target.invulnTimer > 0) continue;
            const dx = target.x - f.x;
            const dz = target.z - f.z;
            const dist = Math.hypot(dx, dz);
            if (dist > reach) continue;
            const dot = dist > 0.01 ? (dx / dist) * fwdX + (dz / dist) * fwdZ : 1;
            if (f.action !== 'special' && dot < 0.25) continue;

            // Check timed parry!
            if (target.blocking && target.parryWindow > 0 && f.action !== 'special') {
              target.parriesLanded += 1;
              f.action = 'hit';
              f.actionTimer = 0.55;
              f.vx = -fwdX * 5;
              f.vz = -fwdZ * 5;
              ioRef.to(`room:${room.code}`).emit('match:event', {
                type: 'parry',
                defenderId: target.userId,
                attackerId: f.userId,
                x: target.x,
                z: target.z,
              });
              continue;
            }

            const tDef = getFighterById(target.fighterId);
            const tStats = getEffectiveStats(tDef, room.isRanked);
            const baseDmg = f.action === 'special' ? 28 : f.action === 'heavy' ? 20 : 11 + f.comboStep * 2;
            const strMult = 0.78 + (stats.strength / 100) * 0.52;
            const defMult = 1 - (tStats.defense / 100) * 0.34;
            let dmg = Math.round(baseDmg * strMult * defMult);

            const wasBlocked = target.blocking && f.action !== 'heavy';
            if (wasBlocked) {
              dmg = Math.max(2, Math.round(dmg * 0.24));
              target.stamina = Math.max(0, target.stamina - 14);
            } else {
              target.action = 'hit';
              target.actionTimer = f.action === 'heavy' || f.action === 'special' ? 0.36 : 0.22;
              const knock = f.action === 'special' ? 8.5 : f.action === 'heavy' ? 6.5 : 3.2;
              target.vx = fwdX * knock;
              target.vz = fwdZ * knock;
            }

            target.hp = Math.max(0, target.hp - dmg);
            f.comboCount += 1;
            f.comboResetTimer = 2.1;
            if (f.comboCount === 3) f.combosLanded += 1;
            if (f.action === 'special') f.specialsHit += 1;

            ioRef.to(`room:${room.code}`).emit('match:event', {
              type: 'hit',
              attackerId: f.userId,
              targetId: target.userId,
              damage: dmg,
              blocked: wasBlocked,
              attackType: f.action,
              comboCount: f.comboCount,
              x: target.x,
              y: target.y + 1.2,
              z: target.z,
            });
          }
        }
      }

      if (f.actionTimer <= 0) {
        f.action = f.blocking ? 'block' : 'idle';
      }
    }

    // Apply movement / knockback
    if (f.action === 'dodge' || f.action === 'hit') {
      f.x += f.vx * dt;
      f.z += f.vz * dt;
      f.vx *= Math.pow(0.08, dt);
      f.vz *= Math.pow(0.08, dt);
    } else if (f.action === 'idle' || f.action === 'move') {
      const mag = Math.hypot(f.moveX, f.moveZ);
      if (mag > 0.05) {
        const nx = f.moveX / Math.max(1, mag);
        const nz = f.moveZ / Math.max(1, mag);
        f.x += nx * moveSpeed * dt;
        f.z += nz * moveSpeed * dt;
        f.yaw = Math.atan2(nx, nz);
        f.action = 'move';
      } else {
        f.action = 'idle';
      }
    } else if (f.action === 'block') {
      f.yaw = f.aimYaw;
    }

    // Keep inside natural arena radius
    const distFromCenter = Math.hypot(f.x, f.z);
    const maxR = arena.radius - 1.4;
    if (distFromCenter > maxR) {
      f.x = (f.x / distFromCenter) * maxR;
      f.z = (f.z / distFromCenter) * maxR;
    }
  }

  // Check round end conditions
  const t1Alive = fighterList.some((f) => f.team === 1 && f.hp > 0);
  const t2Alive = fighterList.some((f) => f.team === 2 && f.hp > 0);

  if (!t1Alive || !t2Alive || m.roundTimeLeft <= 0) {
    let roundWinner: 1 | 2 = 1;
    if (!t1Alive && t2Alive) roundWinner = 2;
    else if (!t2Alive && t1Alive) roundWinner = 1;
    else {
      const t1Hp = fighterList.filter((f) => f.team === 1).reduce((s, f) => s + f.hp, 0);
      const t2Hp = fighterList.filter((f) => f.team === 2).reduce((s, f) => s + f.hp, 0);
      roundWinner = t1Hp >= t2Hp ? 1 : 2;
    }

    if (roundWinner === 1) m.team1Rounds += 1;
    else m.team2Rounds += 1;

    fighterList.forEach((f) => {
      if (f.team === roundWinner && f.hp > 0) f.action = 'victory';
    });

    m.phase = 'round_over';
    m.phaseTimer = 2.4;
    ioRef.to(`room:${room.code}`).emit('match:event', {
      type: 'round_over',
      winningTeam: roundWinner,
      team1Rounds: m.team1Rounds,
      team2Rounds: m.team2Rounds,
    });
  }
}

export function initMultiplayer(httpServer: HttpServer): SocketIOServer {
  const io = new SocketIOServer(httpServer, {
    cors: { origin: false },
    transports: ['websocket', 'polling'],
  });
  ioRef = io;

  io.use((socket: AuthedSocket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    const payload = verifyAuthToken(token);
    if (!payload) {
      next(new Error('Authentication required'));
      return;
    }
    const row = getUserRowById(payload.userId);
    if (!row) {
      next(new Error('Account not found'));
      return;
    }
    socket.userId = row.id;
    socket.username = row.username;
    socket.playerCode = row.player_code;
    next();
  });

  io.on('connection', (socket: AuthedSocket) => {
    const userId = socket.userId!;
    if (!userSockets.has(userId)) userSockets.set(userId, new Set());
    userSockets.get(userId)!.add(socket.id);

    broadcastQueueStatus();
    broadcastLiveMatchesList();

    socket.on('room:create', (data: { mode?: RoomMode; isRanked?: boolean; arenaId?: ArenaId }) => {
      const row = getUserRowById(userId);
      if (!row) return;
      leaveUserFromRoom(userId, socket);
      removeSocketFromQueues(socket.id);

      const code = generateRoomCode();
      const mode: RoomMode = data?.mode === '2v2' ? '2v2' : '1v1';
      const arenaId: ArenaId = ARENAS.some((a) => a.id === data?.arenaId) ? data.arenaId! : 'jungle_falls';
      const room: GameRoom = {
        code,
        hostUserId: userId,
        mode,
        isRanked: Boolean(data?.isRanked) && mode === '1v1',
        isPublic: false,
        arenaId,
        status: 'lobby',
        spectators: new Set(),
        members: [
          {
            userId: row.id,
            username: row.username,
            playerCode: row.player_code,
            fighterId: row.selected_fighter_id,
            team: 1,
            ready: true,
            socketId: socket.id,
          },
        ],
      };
      rooms.set(code, room);
      userInRoom.set(userId, code);
      socket.join(`room:${code}`);
      socket.emit('room:joined', sanitizeRoomForClient(room));
      broadcastRoomUpdate(room);
    });

    socket.on('room:join', (data: { code: string }) => {
      const code = (data?.code || '').trim().toUpperCase();
      const room = rooms.get(code);
      if (!room) {
        socket.emit('room:error', { error: 'Room not found' });
        return;
      }
      if (room.status === 'playing') {
        socket.emit('room:error', { error: 'Match already in progress — join as Spectator instead' });
        return;
      }
      const maxPlayers = room.mode === '2v2' ? 4 : 2;
      if (room.members.length >= maxPlayers && !room.members.some((m) => m.userId === userId)) {
        socket.emit('room:error', { error: 'Room is full' });
        return;
      }

      const row = getUserRowById(userId);
      if (!row) return;
      leaveUserFromRoom(userId, socket);
      removeSocketFromQueues(socket.id);

      const t1Count = room.members.filter((m) => m.team === 1).length;
      const t2Count = room.members.filter((m) => m.team === 2).length;
      const team: 1 | 2 = t1Count <= t2Count ? 1 : 2;

      room.members.push({
        userId: row.id,
        username: row.username,
        playerCode: row.player_code,
        fighterId: row.selected_fighter_id,
        team,
        ready: false,
        socketId: socket.id,
      });
      userInRoom.set(userId, code);
      socket.join(`room:${code}`);
      socket.emit('room:joined', sanitizeRoomForClient(room));
      broadcastRoomUpdate(room);
    });

    socket.on('room:leave', () => {
      leaveUserFromRoom(userId, socket);
      socket.emit('room:left');
    });

    socket.on('room:config', (data: { arenaId?: ArenaId; mode?: RoomMode; isRanked?: boolean }) => {
      const code = userInRoom.get(userId);
      const room = code ? rooms.get(code) : undefined;
      if (!room || room.hostUserId !== userId || room.status !== 'lobby') return;
      if (data.arenaId && ARENAS.some((a) => a.id === data.arenaId)) room.arenaId = data.arenaId;
      if (data.mode === '1v1' || data.mode === '2v2') room.mode = data.mode;
      if (typeof data.isRanked === 'boolean') room.isRanked = data.isRanked && room.mode === '1v1';
      broadcastRoomUpdate(room);
    });

    socket.on('room:fighter', (data: { fighterId: string }) => {
      const code = userInRoom.get(userId);
      const room = code ? rooms.get(code) : undefined;
      if (!room || room.status !== 'lobby') return;
      const row = getUserRowById(userId);
      if (!row) return;
      const unlocked = JSON.parse(row.unlocked_fighters) as string[];
      if (!unlocked.includes(data?.fighterId)) return;
      const member = room.members.find((m) => m.userId === userId);
      if (member) {
        member.fighterId = data.fighterId;
        db.prepare('UPDATE users SET selected_fighter_id = ? WHERE id = ?').run(data.fighterId, userId);
        broadcastRoomUpdate(room);
      }
    });

    socket.on('room:ready', (data: { ready?: boolean; team?: 1 | 2 }) => {
      const code = userInRoom.get(userId);
      const room = code ? rooms.get(code) : undefined;
      if (!room || room.status !== 'lobby') return;
      const member = room.members.find((m) => m.userId === userId);
      if (!member) return;
      if (typeof data?.ready === 'boolean') member.ready = data.ready;
      if (data?.team === 1 || data?.team === 2) member.team = data.team;
      broadcastRoomUpdate(room);
    });

    socket.on('room:invite', (data: { friendId: number }) => {
      const code = userInRoom.get(userId);
      const room = code ? rooms.get(code) : undefined;
      if (!room) return;
      // Verify friendship
      const isFriend = db
        .prepare('SELECT 1 FROM friends WHERE user_id = ? AND friend_id = ?')
        .get(userId, data?.friendId);
      if (!isFriend) return;
      emitToUser(data.friendId, 'room:invited', {
        code: room.code,
        fromUsername: socket.username,
        mode: room.mode,
        arenaId: room.arenaId,
      });
    });

    socket.on('room:start', () => {
      const code = userInRoom.get(userId);
      const room = code ? rooms.get(code) : undefined;
      if (!room || room.hostUserId !== userId || room.status !== 'lobby') return;
      const t1 = room.members.filter((m) => m.team === 1);
      const t2 = room.members.filter((m) => m.team === 2);
      if (t1.length === 0 || t2.length === 0) {
        socket.emit('room:error', { error: 'Need at least one real player on each team' });
        return;
      }
      if (!room.members.every((m) => m.ready || m.userId === room.hostUserId)) {
        socket.emit('room:error', { error: 'All players must be ready' });
        return;
      }
      startRoomCombat(room);
    });

    socket.on('queue:join', (data: { queueType: '1v1_normal' | '1v1_ranked' | '2v2_normal' }) => {
      const qType = data?.queueType;
      if (!qType || !queues[qType]) return;
      const row = getUserRowById(userId);
      if (!row) return;

      leaveUserFromRoom(userId, socket);
      removeSocketFromQueues(socket.id);

      if (!queues[qType].some((q) => q.userId === userId)) {
        queues[qType].push({
          userId,
          socketId: socket.id,
          fighterId: row.selected_fighter_id,
        });
      }
      broadcastQueueStatus();
      tryMatchmaking();
    });

    socket.on('queue:leave', () => {
      removeSocketFromQueues(socket.id);
    });

    socket.on('spectate:join', (data: { code: string }) => {
      const code = (data?.code || '').trim().toUpperCase();
      const room = rooms.get(code);
      if (!room || room.status !== 'playing' || !room.match) {
        socket.emit('room:error', { error: 'Live match not found' });
        return;
      }
      room.spectators.add(socket.id);
      socket.join(`room:${code}`);
      socket.emit('spectate:joined', {
        room: sanitizeRoomForClient(room),
        state: room.match,
      });
      broadcastLiveMatchesList();
    });

    socket.on('spectate:leave', (data: { code: string }) => {
      const code = (data?.code || '').trim().toUpperCase();
      const room = rooms.get(code);
      if (room) {
        room.spectators.delete(socket.id);
        socket.leave(`room:${code}`);
        broadcastLiveMatchesList();
      }
    });

    socket.on(
      'combat:input',
      (data: {
        moveX: number;
        moveZ: number;
        aimYaw: number;
        blocking?: boolean;
        action?: 'light' | 'heavy' | 'special' | 'jump' | 'dodge';
      }) => {
        const code = userInRoom.get(userId);
        const room = code ? rooms.get(code) : undefined;
        if (!room || room.status !== 'playing' || !room.match || room.match.phase !== 'fighting') return;

        const f = room.match.fighters[userId];
        if (!f || f.hp <= 0) return;

        f.moveX = Math.max(-1, Math.min(1, Number(data.moveX) || 0));
        f.moveZ = Math.max(-1, Math.min(1, Number(data.moveZ) || 0));
        f.aimYaw = Number(data.aimYaw) || f.yaw;

        const wantBlock = Boolean(data.blocking) && (f.action === 'idle' || f.action === 'move' || f.action === 'block');
        if (wantBlock && !f.blocking && f.stamina >= 10) {
          f.blocking = true;
          f.parryWindow = 0.24;
          f.action = 'block';
        } else if (!wantBlock && f.blocking) {
          f.blocking = false;
          if (f.action === 'block') f.action = 'idle';
        }

        if (!data.action) return;
        const canAct = f.action === 'idle' || f.action === 'move' || f.action === 'block';
        if (!canAct) return;

        if (data.action === 'jump' && f.y <= 0.02 && f.stamina >= 10) {
          f.vy = 10.5;
          f.stamina -= 10;
        } else if (data.action === 'dodge' && f.stamina >= 22) {
          f.stamina -= 22;
          f.blocking = false;
          f.action = 'dodge';
          f.actionTimer = 0.34;
          f.invulnTimer = 0.3;
          const dirX = Math.abs(f.moveX) + Math.abs(f.moveZ) > 0.1 ? f.moveX : Math.sin(f.yaw);
          const dirZ = Math.abs(f.moveX) + Math.abs(f.moveZ) > 0.1 ? f.moveZ : Math.cos(f.yaw);
          const len = Math.max(0.01, Math.hypot(dirX, dirZ));
          f.vx = (dirX / len) * 14;
          f.vz = (dirZ / len) * 14;
        } else if (data.action === 'light' && f.stamina >= 8) {
          f.stamina -= 8;
          f.blocking = false;
          f.yaw = f.aimYaw;
          f.action = 'light';
          f.actionTimer = 0.3;
          f.hitDidConnect = false;
          f.comboStep = (f.comboStep + 1) % 3;
        } else if (data.action === 'heavy' && f.stamina >= 20) {
          f.stamina -= 20;
          f.blocking = false;
          f.yaw = f.aimYaw;
          f.action = 'heavy';
          f.actionTimer = 0.46;
          f.hitDidConnect = false;
        } else if (data.action === 'special' && f.stamina >= 40) {
          f.stamina -= 40;
          f.blocking = false;
          f.yaw = f.aimYaw;
          f.action = 'special';
          f.actionTimer = 0.56;
          f.hitDidConnect = false;
          io.to(`room:${room.code}`).emit('match:event', {
            type: 'special_cast',
            userId: f.userId,
            fighterId: f.fighterId,
            x: f.x,
            y: f.y,
            z: f.z,
            yaw: f.yaw,
          });
        }
      },
    );

    socket.on('disconnect', () => {
      removeSocketFromQueues(socket.id);
      rooms.forEach((r) => {
        if (r.spectators.has(socket.id)) {
          r.spectators.delete(socket.id);
        }
      });
      const set = userSockets.get(userId);
      if (set) {
        set.delete(socket.id);
        if (set.size === 0) {
          userSockets.delete(userId);
          leaveUserFromRoom(userId, socket);
        }
      }
    });
  });

  // 30Hz Authoritative Combat Simulation Loop
  let lastTick = Date.now();
  setInterval(() => {
    const now = Date.now();
    const dt = Math.min(0.05, (now - lastTick) / 1000);
    lastTick = now;

    rooms.forEach((room) => {
      if (room.status === 'playing' && room.match) {
        stepOnlineMatch(room, dt);
        io.to(`room:${room.code}`).emit('match:state', room.match);
      }
    });
  }, 33);

  return io;
}
