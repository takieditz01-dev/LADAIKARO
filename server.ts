import 'dotenv/config';
import express from 'express';
import http from 'http';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { ArenaId, ARENAS } from './src/shared/gameData.ts';
import { AuthenticatedRequest, hashPassword, requireAuth, signAuthToken, verifyPassword } from './src/server/auth.ts';
import {
  claimAchievementForUser,
  claimMissionForUser,
  completeSoloSession,
  createSoloSession,
  db,
  ensureDailyReset,
  generatePlayerCode,
  getUserRowByCodeOrUsername,
  getUserRowById,
  getUserRowByUsername,
  toPlayerProfile,
  unlockFighterForUser,
} from './src/server/db.ts';
import { emitToUser, initMultiplayer, isUserInMatch, isUserOnline } from './src/server/multiplayer.ts';

const PORT = Number(process.env.PORT) || 3000;

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '256kb' }));

  // --- AUTH ROUTES ---
  app.post('/api/auth/register', (req, res) => {
    const rawUser = typeof req.body?.username === 'string' ? req.body.username.trim() : '';
    const rawPass = typeof req.body?.password === 'string' ? req.body.password : '';

    if (rawUser.length < 3 || rawUser.length > 20 || !/^[a-zA-Z0-9_]+$/.test(rawUser)) {
      res.status(400).json({ error: 'Username must be 3–20 characters (letters, numbers, underscore).' });
      return;
    }
    if (rawPass.length < 4 || rawPass.length > 72) {
      res.status(400).json({ error: 'Password must be between 4 and 72 characters.' });
      return;
    }

    const existing = getUserRowByUsername(rawUser);
    if (existing) {
      res.status(409).json({ error: 'Username is already taken.' });
      return;
    }

    const code = generatePlayerCode();
    const passHash = hashPassword(rawPass);
    const today = new Date().toISOString().slice(0, 10);

    const info = db
      .prepare(
        `INSERT INTO users (player_code, username, username_lower, password_hash, daily_reset_date)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(code, rawUser, rawUser.toLowerCase(), passHash, today);

    const userId = Number(info.lastInsertRowid);
    const row = getUserRowById(userId)!;
    const token = signAuthToken(userId, row.username);
    res.status(201).json({ token, profile: toPlayerProfile(row) });
  });

  app.post('/api/auth/login', (req, res) => {
    const rawUser = typeof req.body?.username === 'string' ? req.body.username.trim() : '';
    const rawPass = typeof req.body?.password === 'string' ? req.body.password : '';
    if (!rawUser || !rawPass) {
      res.status(400).json({ error: 'Username and password are required.' });
      return;
    }
    const row = getUserRowByUsername(rawUser);
    if (!row || !verifyPassword(rawPass, row.password_hash)) {
      res.status(401).json({ error: 'Invalid username or password.' });
      return;
    }
    ensureDailyReset(row.id);
    const freshRow = getUserRowById(row.id)!;
    const token = signAuthToken(freshRow.id, freshRow.username);
    res.json({ token, profile: toPlayerProfile(freshRow) });
  });

  // --- PROFILE & PROGRESSION ROUTES ---
  app.get('/api/profile', requireAuth, (req: AuthenticatedRequest, res) => {
    const userId = req.auth!.userId;
    ensureDailyReset(userId);
    const row = getUserRowById(userId);
    if (!row) {
      res.status(404).json({ error: 'Account not found' });
      return;
    }
    const history = db
      .prepare(
        `SELECT id, mode, opponent_name as opponentName, arena_id as arenaId, fighter_id as fighterId,
                result, ap_earned as apEarned, xp_earned as xpEarned, rounds_won as roundsWon,
                rounds_lost as roundsLost, created_at as createdAt
         FROM match_history WHERE user_id = ? ORDER BY id DESC LIMIT 20`,
      )
      .all(userId);

    res.json({ profile: toPlayerProfile(row), matchHistory: history });
  });

  app.post('/api/profile/select-fighter', requireAuth, (req: AuthenticatedRequest, res) => {
    const userId = req.auth!.userId;
    const fighterId = typeof req.body?.fighterId === 'string' ? req.body.fighterId : '';
    const row = getUserRowById(userId);
    if (!row) {
      res.status(404).json({ error: 'Account not found' });
      return;
    }
    const unlocked = JSON.parse(row.unlocked_fighters) as string[];
    if (!unlocked.includes(fighterId)) {
      res.status(403).json({ error: 'Fighter not unlocked yet' });
      return;
    }
    db.prepare('UPDATE users SET selected_fighter_id = ? WHERE id = ?').run(fighterId, userId);
    res.json({ profile: toPlayerProfile(getUserRowById(userId)!) });
  });

  app.post('/api/fighters/unlock', requireAuth, (req: AuthenticatedRequest, res) => {
    const fighterId = typeof req.body?.fighterId === 'string' ? req.body.fighterId : '';
    const result = unlockFighterForUser(req.auth!.userId, fighterId);
    if (!result.ok) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json({ profile: result.profile });
  });

  app.post('/api/missions/claim', requireAuth, (req: AuthenticatedRequest, res) => {
    const missionId = typeof req.body?.missionId === 'string' ? req.body.missionId : '';
    const result = claimMissionForUser(req.auth!.userId, missionId);
    if (!result.ok) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json({ profile: result.profile });
  });

  app.post('/api/achievements/claim', requireAuth, (req: AuthenticatedRequest, res) => {
    const achievementId = typeof req.body?.achievementId === 'string' ? req.body.achievementId : '';
    const result = claimAchievementForUser(req.auth!.userId, achievementId);
    if (!result.ok) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json({ profile: result.profile });
  });

  // --- SOLO & BOSS CAMPAIGN SECURE REWARD ROUTES ---
  app.post('/api/solo/start', requireAuth, (req: AuthenticatedRequest, res) => {
    const mode = req.body?.mode === 'boss' ? 'boss' : 'skirmish';
    const bossIndex = Number(req.body?.bossIndex) || 0;
    const arenaId: ArenaId = ARENAS.some((a) => a.id === req.body?.arenaId) ? req.body.arenaId : 'jungle_falls';
    const fighterId = typeof req.body?.fighterId === 'string' ? req.body.fighterId : 'kael_strider';
    const opponentRarity = typeof req.body?.opponentRarity === 'string' ? req.body.opponentRarity : 'Common';

    const result = createSoloSession(req.auth!.userId, mode, bossIndex, arenaId, fighterId, opponentRarity);
    if (!result.ok) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json({ sessionToken: result.token });
  });

  app.post('/api/solo/complete', requireAuth, (req: AuthenticatedRequest, res) => {
    const sessionToken = typeof req.body?.sessionToken === 'string' ? req.body.sessionToken : '';
    const won = Boolean(req.body?.won);
    const roundsWon = Math.min(3, Math.max(0, Number(req.body?.roundsWon) || 0));
    const roundsLost = Math.min(3, Math.max(0, Number(req.body?.roundsLost) || 0));
    const combosLanded = Number(req.body?.combosLanded) || 0;
    const objectsDestroyed = Number(req.body?.objectsDestroyed) || 0;
    const specialsHit = Number(req.body?.specialsHit) || 0;
    const parriesLanded = Number(req.body?.parriesLanded) || 0;

    const result = completeSoloSession(
      req.auth!.userId,
      sessionToken,
      won,
      roundsWon,
      roundsLost,
      combosLanded,
      objectsDestroyed,
      specialsHit,
      parriesLanded,
    );
    if (!result.ok) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json({
      apEarned: result.apEarned,
      xpEarned: result.xpEarned,
      profile: result.profile,
    });
  });

  // --- FRIENDS & SOCIAL ROUTES ---
  app.get('/api/friends', requireAuth, (req: AuthenticatedRequest, res) => {
    const userId = req.auth!.userId;
    const friendRows = db
      .prepare(
        `SELECT u.id, u.player_code as playerCode, u.username, u.level, u.ranked_rating as rankedRating
         FROM friends f JOIN users u ON u.id = f.friend_id
         WHERE f.user_id = ? ORDER BY u.username ASC`,
      )
      .all(userId) as Array<{ id: number; playerCode: string; username: string; level: number; rankedRating: number }>;

    const friends = friendRows.map((f) => ({
      ...f,
      online: isUserOnline(f.id),
      inMatch: isUserInMatch(f.id),
    }));

    const incomingRequests = db
      .prepare(
        `SELECT fr.id, fr.from_user_id as fromUserId, u.username as fromUsername,
                u.player_code as fromPlayerCode, u.level as fromLevel, fr.created_at as createdAt
         FROM friend_requests fr JOIN users u ON u.id = fr.from_user_id
         WHERE fr.to_user_id = ? AND fr.status = 'pending' ORDER BY fr.id DESC`,
      )
      .all(userId);

    res.json({ friends, incomingRequests });
  });

  app.post('/api/friends/request', requireAuth, (req: AuthenticatedRequest, res) => {
    const userId = req.auth!.userId;
    const query = typeof req.body?.query === 'string' ? req.body.query.trim() : '';
    if (!query) {
      res.status(400).json({ error: 'Enter a username or Player ID (e.g. WA-123456).' });
      return;
    }

    const target = getUserRowByCodeOrUsername(query);
    if (!target) {
      res.status(404).json({ error: 'Player not found.' });
      return;
    }
    if (target.id === userId) {
      res.status(400).json({ error: 'You cannot add yourself as a friend.' });
      return;
    }

    const alreadyFriend = db
      .prepare('SELECT 1 FROM friends WHERE user_id = ? AND friend_id = ?')
      .get(userId, target.id);
    if (alreadyFriend) {
      res.status(409).json({ error: `${target.username} is already your friend.` });
      return;
    }

    // If they already sent us a request, auto-accept both!
    const reverseReq = db
      .prepare(`SELECT id FROM friend_requests WHERE from_user_id = ? AND to_user_id = ? AND status = 'pending'`)
      .get(target.id, userId) as { id: number } | undefined;

    if (reverseReq) {
      db.prepare(`UPDATE friend_requests SET status = 'accepted' WHERE id = ?`).run(reverseReq.id);
      db.prepare('INSERT OR IGNORE INTO friends (user_id, friend_id) VALUES (?, ?)').run(userId, target.id);
      db.prepare('INSERT OR IGNORE INTO friends (user_id, friend_id) VALUES (?, ?)').run(target.id, userId);
      emitToUser(target.id, 'friends:updated', {});
      res.json({ message: `You and ${target.username} are now friends!` });
      return;
    }

    const existingReq = db
      .prepare(`SELECT id, status FROM friend_requests WHERE from_user_id = ? AND to_user_id = ?`)
      .get(userId, target.id) as { id: number; status: string } | undefined;

    if (existingReq && existingReq.status === 'pending') {
      res.status(409).json({ error: 'Friend request already pending.' });
      return;
    }

    if (existingReq) {
      db.prepare(`UPDATE friend_requests SET status = 'pending' WHERE id = ?`).run(existingReq.id);
    } else {
      db.prepare(`INSERT INTO friend_requests (from_user_id, to_user_id, status) VALUES (?, ?, 'pending')`).run(
        userId,
        target.id,
      );
    }

    emitToUser(target.id, 'friends:updated', {});
    res.json({ message: `Friend request sent to ${target.username} (${target.player_code}).` });
  });

  app.post('/api/friends/respond', requireAuth, (req: AuthenticatedRequest, res) => {
    const userId = req.auth!.userId;
    const requestId = Number(req.body?.requestId);
    const accept = Boolean(req.body?.accept);

    const row = db
      .prepare(`SELECT * FROM friend_requests WHERE id = ? AND to_user_id = ? AND status = 'pending'`)
      .get(requestId, userId) as { id: number; from_user_id: number; to_user_id: number } | undefined;

    if (!row) {
      res.status(404).json({ error: 'Friend request not found' });
      return;
    }

    if (accept) {
      db.prepare(`UPDATE friend_requests SET status = 'accepted' WHERE id = ?`).run(row.id);
      db.prepare('INSERT OR IGNORE INTO friends (user_id, friend_id) VALUES (?, ?)').run(userId, row.from_user_id);
      db.prepare('INSERT OR IGNORE INTO friends (user_id, friend_id) VALUES (?, ?)').run(row.from_user_id, userId);
      emitToUser(row.from_user_id, 'friends:updated', {});
    } else {
      db.prepare(`UPDATE friend_requests SET status = 'declined' WHERE id = ?`).run(row.id);
    }

    res.json({ ok: true });
  });

  app.get('/api/leaderboard', (_req, res) => {
    const rows = db
      .prepare(
        `SELECT username, player_code as playerCode, level, ranked_rating as rankedRating,
                online_wins as onlineWins, ranked_wins as rankedWins, highest_boss_cleared as highestBossCleared
         FROM users ORDER BY ranked_rating DESC, online_wins DESC LIMIT 20`,
      )
      .all();
    res.json({ leaderboard: rows });
  });

  const httpServer = http.createServer(app);
  initMultiplayer(httpServer);

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: process.env.DISABLE_HMR !== 'true' },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`WILD ARENA server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start WILD ARENA server:', err);
  process.exit(1);
});
