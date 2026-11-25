import Database from 'better-sqlite3';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import {
  ACHIEVEMENTS,
  ArenaId,
  BOSSES,
  FIGHTERS,
  getBossByIndex,
  getFighterById,
  MISSIONS,
  PlayerProfile,
  PlayerStatsSnapshot,
  xpForLevel,
} from '../shared/gameData.ts';

const defaultDbPath = path.resolve(process.cwd(), 'data', 'wild_arena.db');
const dbPath = process.env.DB_PATH ? path.resolve(process.env.DB_PATH) : defaultDbPath;

fs.mkdirSync(path.dirname(dbPath), { recursive: true });

export const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player_code TEXT NOT NULL UNIQUE,
    username TEXT NOT NULL UNIQUE,
    username_lower TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    selected_fighter_id TEXT NOT NULL DEFAULT 'kael_strider',
    unlocked_fighters TEXT NOT NULL DEFAULT '["kael_strider","lyra_vale","torin_oak"]',
    level INTEGER NOT NULL DEFAULT 1,
    xp INTEGER NOT NULL DEFAULT 0,
    ap INTEGER NOT NULL DEFAULT 0,
    wins INTEGER NOT NULL DEFAULT 0,
    losses INTEGER NOT NULL DEFAULT 0,
    online_wins INTEGER NOT NULL DEFAULT 0,
    online_losses INTEGER NOT NULL DEFAULT 0,
    ranked_wins INTEGER NOT NULL DEFAULT 0,
    ranked_rating INTEGER NOT NULL DEFAULT 1000,
    highest_boss_cleared INTEGER NOT NULL DEFAULT 0,
    boss_kills_total INTEGER NOT NULL DEFAULT 0,
    forest_warriors_defeated INTEGER NOT NULL DEFAULT 0,
    elite_defeated INTEGER NOT NULL DEFAULT 0,
    flawless_rounds INTEGER NOT NULL DEFAULT 0,
    combos_landed INTEGER NOT NULL DEFAULT 0,
    objects_destroyed INTEGER NOT NULL DEFAULT 0,
    specials_hit INTEGER NOT NULL DEFAULT 0,
    parries_landed INTEGER NOT NULL DEFAULT 0,
    claimed_missions TEXT NOT NULL DEFAULT '[]',
    claimed_achievements TEXT NOT NULL DEFAULT '[]',
    daily_reset_date TEXT NOT NULL DEFAULT '',
    daily_wins INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS friends (
    user_id INTEGER NOT NULL,
    friend_id INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, friend_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (friend_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS friend_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    from_user_id INTEGER NOT NULL,
    to_user_id INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(from_user_id, to_user_id),
    FOREIGN KEY (from_user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (to_user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS match_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    mode TEXT NOT NULL,
    opponent_name TEXT NOT NULL,
    arena_id TEXT NOT NULL,
    fighter_id TEXT NOT NULL,
    result TEXT NOT NULL,
    ap_earned INTEGER NOT NULL DEFAULT 0,
    xp_earned INTEGER NOT NULL DEFAULT 0,
    rounds_won INTEGER NOT NULL DEFAULT 0,
    rounds_lost INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS anti_farm_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pair_key TEXT NOT NULL,
    winner_id INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS solo_sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    mode TEXT NOT NULL,
    boss_index INTEGER NOT NULL DEFAULT 0,
    arena_id TEXT NOT NULL,
    fighter_id TEXT NOT NULL,
    opponent_rarity TEXT NOT NULL DEFAULT 'Common',
    started_at INTEGER NOT NULL,
    used INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`);

export interface UserRow {
  id: number;
  player_code: string;
  username: string;
  username_lower: string;
  password_hash: string;
  selected_fighter_id: string;
  unlocked_fighters: string;
  level: number;
  xp: number;
  ap: number;
  wins: number;
  losses: number;
  online_wins: number;
  online_losses: number;
  ranked_wins: number;
  ranked_rating: number;
  highest_boss_cleared: number;
  boss_kills_total: number;
  forest_warriors_defeated: number;
  elite_defeated: number;
  flawless_rounds: number;
  combos_landed: number;
  objects_destroyed: number;
  specials_hit: number;
  parries_landed: number;
  claimed_missions: string;
  claimed_achievements: string;
  daily_reset_date: string;
  daily_wins: number;
  created_at: string;
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export function generatePlayerCode(): string {
  for (let i = 0; i < 10; i++) {
    const num = crypto.randomInt(100000, 999999);
    const code = `WA-${num}`;
    const existing = db.prepare('SELECT id FROM users WHERE player_code = ?').get(code);
    if (!existing) return code;
  }
  return `WA-${Date.now().toString().slice(-6)}`;
}

export function getUserRowById(userId: number): UserRow | undefined {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as UserRow | undefined;
}

export function getUserRowByUsername(username: string): UserRow | undefined {
  return db
    .prepare('SELECT * FROM users WHERE username_lower = ?')
    .get(username.trim().toLowerCase()) as UserRow | undefined;
}

export function getUserRowByCodeOrUsername(query: string): UserRow | undefined {
  const clean = query.trim();
  return db
    .prepare('SELECT * FROM users WHERE UPPER(player_code) = UPPER(?) OR username_lower = ?')
    .get(clean, clean.toLowerCase()) as UserRow | undefined;
}

export function ensureDailyReset(userId: number): void {
  const row = getUserRowById(userId);
  if (!row) return;
  const today = todayKey();
  if (row.daily_reset_date !== today) {
    const claimed = JSON.parse(row.claimed_missions) as string[];
    const filtered = claimed.filter((id) => !id.startsWith('m_daily_'));
    db.prepare(
      'UPDATE users SET daily_reset_date = ?, daily_wins = 0, claimed_missions = ? WHERE id = ?',
    ).run(today, JSON.stringify(filtered), userId);
  }
}

export function buildMissionProgress(row: UserRow): Record<string, number> {
  return {
    forest_warriors_defeated: row.forest_warriors_defeated,
    total_wins: row.wins,
    elite_defeated: row.elite_defeated,
    bosses_defeated: row.boss_kills_total,
    online_wins: row.online_wins,
    flawless_rounds: row.flawless_rounds,
    combos_landed: row.combos_landed,
    objects_destroyed: row.objects_destroyed,
    ranked_wins: row.ranked_wins,
    specials_hit: row.specials_hit,
    parries_landed: row.parries_landed,
    daily_wins: row.daily_wins,
  };
}

export function toPlayerProfile(row: UserRow): PlayerProfile {
  const rankRow = db
    .prepare('SELECT COUNT(*) + 1 as rank FROM users WHERE ranked_rating > ?')
    .get(row.ranked_rating) as { rank: number };

  const stats: PlayerStatsSnapshot = {
    level: row.level,
    xp: row.xp,
    ap: row.ap,
    wins: row.wins,
    losses: row.losses,
    onlineWins: row.online_wins,
    onlineLosses: row.online_losses,
    rankedWins: row.ranked_wins,
    rankedRating: row.ranked_rating,
    highestBossCleared: row.highest_boss_cleared,
    bossKillsTotal: row.boss_kills_total,
    forestWarriorsDefeated: row.forest_warriors_defeated,
    eliteDefeated: row.elite_defeated,
    flawlessRounds: row.flawless_rounds,
    combosLanded: row.combos_landed,
    objectsDestroyed: row.objects_destroyed,
    specialsHit: row.specials_hit,
    parriesLanded: row.parries_landed,
  };

  return {
    id: row.id,
    playerCode: row.player_code,
    username: row.username,
    selectedFighterId: row.selected_fighter_id,
    unlockedFighters: JSON.parse(row.unlocked_fighters) as string[],
    claimedMissions: JSON.parse(row.claimed_missions) as string[],
    claimedAchievements: JSON.parse(row.claimed_achievements) as string[],
    stats,
    missionProgress: buildMissionProgress(row),
    rankPosition: rankRow?.rank ?? 1,
  };
}

export function addXpAndLevelUp(userId: number, xpToAdd: number, apToAdd: number): { level: number; xp: number; ap: number; leveledUp: boolean } {
  const row = getUserRowById(userId);
  if (!row) throw new Error('User not found');

  let level = row.level;
  let xp = row.xp + Math.max(0, Math.floor(xpToAdd));
  const ap = row.ap + Math.max(0, Math.floor(apToAdd));
  let leveledUp = false;

  while (xp >= xpForLevel(level)) {
    xp -= xpForLevel(level);
    level += 1;
    leveledUp = true;
  }

  db.prepare('UPDATE users SET level = ?, xp = ?, ap = ? WHERE id = ?').run(level, xp, ap, userId);
  return { level, xp, ap, leveledUp };
}

export function unlockFighterForUser(userId: number, fighterId: string): { ok: boolean; error?: string; profile?: PlayerProfile } {
  const row = getUserRowById(userId);
  if (!row) return { ok: false, error: 'Account not found' };

  const fighter = FIGHTERS.find((f) => f.id === fighterId);
  if (!fighter) return { ok: false, error: 'Fighter not found' };

  const unlocked = JSON.parse(row.unlocked_fighters) as string[];
  if (unlocked.includes(fighter.id)) {
    return { ok: false, error: 'Fighter already unlocked' };
  }
  if (row.level < fighter.minLevel) {
    return { ok: false, error: `Requires Level ${fighter.minLevel}` };
  }
  if (row.highest_boss_cleared < fighter.requiredBossIndex) {
    const boss = getBossByIndex(fighter.requiredBossIndex);
    return { ok: false, error: `Defeat Boss ${fighter.requiredBossIndex} (${boss.name}) first` };
  }
  if (row.ap < fighter.apCost) {
    return { ok: false, error: `Requires ${fighter.apCost} Arena Points` };
  }

  const nextAp = row.ap - fighter.apCost;
  unlocked.push(fighter.id);
  db.prepare('UPDATE users SET ap = ?, unlocked_fighters = ?, selected_fighter_id = ? WHERE id = ?').run(
    nextAp,
    JSON.stringify(unlocked),
    fighter.id,
    userId,
  );

  return { ok: true, profile: toPlayerProfile(getUserRowById(userId)!) };
}

export function claimMissionForUser(userId: number, missionId: string): { ok: boolean; error?: string; profile?: PlayerProfile } {
  ensureDailyReset(userId);
  const row = getUserRowById(userId);
  if (!row) return { ok: false, error: 'Account not found' };

  const mission = MISSIONS.find((m) => m.id === missionId);
  if (!mission) return { ok: false, error: 'Mission not found' };

  const claimed = JSON.parse(row.claimed_missions) as string[];
  if (claimed.includes(missionId)) return { ok: false, error: 'Mission reward already claimed' };
  if (row.level < mission.minLevel) return { ok: false, error: `Unlocks at Level ${mission.minLevel}` };

  const progressMap = buildMissionProgress(row);
  const current = mission.isDaily ? row.daily_wins : (progressMap[mission.metric] ?? 0);
  if (current < mission.target) {
    return { ok: false, error: `Progress ${current}/${mission.target} incomplete` };
  }

  claimed.push(missionId);
  db.prepare('UPDATE users SET claimed_missions = ? WHERE id = ?').run(JSON.stringify(claimed), userId);
  addXpAndLevelUp(userId, mission.xpReward, mission.apReward);

  return { ok: true, profile: toPlayerProfile(getUserRowById(userId)!) };
}

export function claimAchievementForUser(userId: number, achievementId: string): { ok: boolean; error?: string; profile?: PlayerProfile } {
  const row = getUserRowById(userId);
  if (!row) return { ok: false, error: 'Account not found' };

  const ach = ACHIEVEMENTS.find((a) => a.id === achievementId);
  if (!ach) return { ok: false, error: 'Achievement not found' };

  const claimed = JSON.parse(row.claimed_achievements) as string[];
  if (claimed.includes(achievementId)) return { ok: false, error: 'Already claimed' };

  const profile = toPlayerProfile(row);
  const val = Number(profile.stats[ach.metric] ?? 0);
  if (val < ach.target) return { ok: false, error: `Progress ${val}/${ach.target} incomplete` };

  claimed.push(achievementId);
  db.prepare('UPDATE users SET claimed_achievements = ?, ap = ap + ? WHERE id = ?').run(
    JSON.stringify(claimed),
    ach.apBonus,
    userId,
  );
  return { ok: true, profile: toPlayerProfile(getUserRowById(userId)!) };
}

export function createSoloSession(
  userId: number,
  mode: 'boss' | 'skirmish',
  bossIndex: number,
  arenaId: ArenaId,
  fighterId: string,
  opponentRarity: string,
): { ok: boolean; token?: string; error?: string } {
  const row = getUserRowById(userId);
  if (!row) return { ok: false, error: 'Account not found' };
  const unlocked = JSON.parse(row.unlocked_fighters) as string[];
  if (!unlocked.includes(fighterId)) return { ok: false, error: 'Selected fighter is locked' };

  if (mode === 'boss') {
    const boss = BOSSES.find((b) => b.index === bossIndex);
    if (!boss) return { ok: false, error: 'Boss not found' };
    if (bossIndex > row.highest_boss_cleared + 1) {
      return { ok: false, error: `Defeat Boss ${bossIndex - 1} first to unlock ${boss.name}` };
    }
  }

  const token = crypto.randomBytes(24).toString('hex');
  db.prepare(
    `INSERT INTO solo_sessions (token, user_id, mode, boss_index, arena_id, fighter_id, opponent_rarity, started_at, used)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
  ).run(token, userId, mode, bossIndex, arenaId, fighterId, opponentRarity, Date.now());

  return { ok: true, token };
}

export function completeSoloSession(
  userId: number,
  token: string,
  won: boolean,
  roundsWon: number,
  roundsLost: number,
  combosLanded: number,
  objectsDestroyed: number,
  specialsHit: number,
  parriesLanded: number,
): { ok: boolean; error?: string; apEarned?: number; xpEarned?: number; profile?: PlayerProfile } {
  ensureDailyReset(userId);
  const session = db
    .prepare('SELECT * FROM solo_sessions WHERE token = ? AND user_id = ?')
    .get(token, userId) as
    | {
        token: string;
        user_id: number;
        mode: string;
        boss_index: number;
        arena_id: string;
        fighter_id: string;
        opponent_rarity: string;
        started_at: number;
        used: number;
      }
    | undefined;

  if (!session) return { ok: false, error: 'Invalid combat session token' };
  if (session.used) return { ok: false, error: 'Combat session already finalized' };

  // Minimum realistic combat duration check (prevents instant automated farming)
  const elapsedMs = Date.now() - session.started_at;
  if (won && elapsedMs < 3500) {
    return { ok: false, error: 'Match completed too rapidly to validate' };
  }

  db.prepare('UPDATE solo_sessions SET used = 1 WHERE token = ?').run(token);

  const row = getUserRowById(userId)!;
  const safeCombos = Math.min(80, Math.max(0, Math.floor(combosLanded)));
  const safeObjects = Math.min(30, Math.max(0, Math.floor(objectsDestroyed)));
  const safeSpecials = Math.min(40, Math.max(0, Math.floor(specialsHit)));
  const safeParries = Math.min(30, Math.max(0, Math.floor(parriesLanded)));

  let apEarned = 0;
  let xpEarned = 25;
  let opponentName = 'Wild Warrior';
  let newHighestBoss = row.highest_boss_cleared;
  let bossKillsInc = 0;
  let forestInc = 0;
  let eliteInc = 0;
  const flawlessInc = won && roundsLost === 0 ? 1 : 0;

  if (session.mode === 'boss') {
    const boss = getBossByIndex(session.boss_index);
    opponentName = `Boss ${boss.index}: ${boss.name}`;
    if (won) {
      const isFirstClear = session.boss_index > row.highest_boss_cleared;
      apEarned = boss.apReward + (isFirstClear ? boss.firstClearBonusAp : 0);
      xpEarned = boss.xpReward;
      newHighestBoss = Math.max(row.highest_boss_cleared, session.boss_index);
      bossKillsInc = 1;
      if (session.boss_index >= 4) eliteInc = 1;
    } else {
      xpEarned = Math.round(boss.xpReward * 0.25);
    }
  } else {
    const fighter = getFighterById(session.fighter_id);
    opponentName = `${session.opponent_rarity} Warrior`;
    if (won) {
      apEarned = session.opponent_rarity === 'Legendary' || session.opponent_rarity === 'Epic' ? 75 : 45;
      xpEarned = session.opponent_rarity === 'Legendary' || session.opponent_rarity === 'Epic' ? 95 : 65;
      if (session.arena_id === 'lost_forest' || session.arena_id === 'jungle_falls' || session.arena_id === 'bamboo_forest') {
        forestInc = 1;
      }
      if (['Epic', 'Legendary', 'Mythic', 'Divine', 'Secret'].includes(session.opponent_rarity)) {
        eliteInc = 1;
      }
    } else {
      xpEarned = 20;
    }
    void fighter;
  }

  db.prepare(
    `UPDATE users SET
      wins = wins + ?,
      losses = losses + ?,
      daily_wins = daily_wins + ?,
      highest_boss_cleared = ?,
      boss_kills_total = boss_kills_total + ?,
      forest_warriors_defeated = forest_warriors_defeated + ?,
      elite_defeated = elite_defeated + ?,
      flawless_rounds = flawless_rounds + ?,
      combos_landed = combos_landed + ?,
      objects_destroyed = objects_destroyed + ?,
      specials_hit = specials_hit + ?,
      parries_landed = parries_landed + ?
    WHERE id = ?`,
  ).run(
    won ? 1 : 0,
    won ? 0 : 1,
    won ? 1 : 0,
    newHighestBoss,
    bossKillsInc,
    forestInc,
    eliteInc,
    flawlessInc,
    safeCombos,
    safeObjects,
    safeSpecials,
    safeParries,
    userId,
  );

  addXpAndLevelUp(userId, xpEarned, apEarned);

  db.prepare(
    `INSERT INTO match_history (user_id, mode, opponent_name, arena_id, fighter_id, result, ap_earned, xp_earned, rounds_won, rounds_lost)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    userId,
    session.mode === 'boss' ? 'Boss Campaign' : 'Arena Skirmish',
    opponentName,
    session.arena_id,
    session.fighter_id,
    won ? 'WIN' : 'LOSS',
    apEarned,
    xpEarned,
    roundsWon,
    roundsLost,
  );

  return {
    ok: true,
    apEarned,
    xpEarned,
    profile: toPlayerProfile(getUserRowById(userId)!),
  };
}

/**
 * Anti-farming protection for online PvP:
 * Limits full AP rewards between the same two accounts to max 2 wins per 15-minute window.
 */
export function checkAndRecordPvpAntiFarm(winnerId: number, opponentIds: number[]): boolean {
  const now = Date.now();
  const windowMs = 15 * 60 * 1000;
  for (const oppId of opponentIds) {
    if (oppId === winnerId) continue;
    const minId = Math.min(winnerId, oppId);
    const maxId = Math.max(winnerId, oppId);
    const pairKey = `${minId}:${maxId}`;
    const countRow = db
      .prepare('SELECT COUNT(*) as cnt FROM anti_farm_logs WHERE pair_key = ? AND winner_id = ? AND created_at > ?')
      .get(pairKey, winnerId, now - windowMs) as { cnt: number };

    if ((countRow?.cnt ?? 0) >= 2) {
      return false; // Anti-farming triggered
    }
  }

  for (const oppId of opponentIds) {
    if (oppId === winnerId) continue;
    const minId = Math.min(winnerId, oppId);
    const maxId = Math.max(winnerId, oppId);
    const pairKey = `${minId}:${maxId}`;
    db.prepare('INSERT INTO anti_farm_logs (pair_key, winner_id, created_at) VALUES (?, ?, ?)').run(
      pairKey,
      winnerId,
      now,
    );
  }
  return true;
}

export function recordOnlineMatchResult(params: {
  userId: number;
  mode: string;
  opponentName: string;
  arenaId: string;
  fighterId: string;
  won: boolean;
  isRanked: boolean;
  apEarned: number;
  xpEarned: number;
  ratingDelta: number;
  roundsWon: number;
  roundsLost: number;
  flawless: boolean;
  combosLanded: number;
  objectsDestroyed: number;
  specialsHit: number;
  parriesLanded: number;
}): void {
  ensureDailyReset(params.userId);
  db.prepare(
    `UPDATE users SET
      wins = wins + ?,
      losses = losses + ?,
      online_wins = online_wins + ?,
      online_losses = online_losses + ?,
      ranked_wins = ranked_wins + ?,
      ranked_rating = MAX(100, ranked_rating + ?),
      daily_wins = daily_wins + ?,
      flawless_rounds = flawless_rounds + ?,
      combos_landed = combos_landed + ?,
      objects_destroyed = objects_destroyed + ?,
      specials_hit = specials_hit + ?,
      parries_landed = parries_landed + ?
    WHERE id = ?`,
  ).run(
    params.won ? 1 : 0,
    params.won ? 0 : 1,
    params.won ? 1 : 0,
    params.won ? 0 : 1,
    params.won && params.isRanked ? 1 : 0,
    params.ratingDelta,
    params.won ? 1 : 0,
    params.won && params.flawless ? 1 : 0,
    params.combosLanded,
    params.objectsDestroyed,
    params.specialsHit,
    params.parriesLanded,
    params.userId,
  );

  addXpAndLevelUp(params.userId, params.xpEarned, params.apEarned);

  db.prepare(
    `INSERT INTO match_history (user_id, mode, opponent_name, arena_id, fighter_id, result, ap_earned, xp_earned, rounds_won, rounds_lost)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    params.userId,
    params.mode,
    params.opponentName,
    params.arenaId,
    params.fighterId,
    params.won ? 'WIN' : 'LOSS',
    params.apEarned,
    params.xpEarned,
    params.roundsWon,
    params.roundsLost,
  );
}
