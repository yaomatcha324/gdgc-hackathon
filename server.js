const express = require('express');
const fs = require('fs');
const path = require('path');
const { nanoid } = require('nanoid');
const QRCode = require('qrcode');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, 'data', 'db.json');
const QR_TTL_MS = 5 * 60 * 1000;
const TAG_ALIASES = {
  老师: 'Teacher',
  工程师: 'Engineer',
  医生: 'Doctor',
  Nothing: 'Nothing'
};
const ALLOWED_TAGS = ['Teacher', 'Engineer', 'Doctor', 'Nothing'];

app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(
  '/vendor',
  express.static(path.join(__dirname, 'node_modules', 'html5-qrcode'))
);

function normalizeDb(db) {
  db.users = db.users || {};
  db.qrTokens = db.qrTokens || {};
  db.usernames = db.usernames || {};

  Object.values(db.users).forEach((user) => {
    if (user.username && !db.usernames[user.username]) {
      db.usernames[user.username] = user.id;
    }
  });
  return db;
}

function loadDb() {
  try {
    const raw = fs.readFileSync(DB_PATH, 'utf8');
    return normalizeDb(JSON.parse(raw));
  } catch (error) {
    return normalizeDb({ users: {}, qrTokens: {}, usernames: {} });
  }
}

function saveDb(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

function cleanupExpiredTokens(db) {
  const now = Date.now();
  let changed = false;
  Object.entries(db.qrTokens).forEach(([token, info]) => {
    if (info.expiresAt <= now) {
      delete db.qrTokens[token];
      changed = true;
    }
  });
  if (changed) {
    saveDb(db);
  }
}

function getValidToken(db, token) {
  const info = db.qrTokens[token];
  if (!info) {
    return { error: 'not_found' };
  }
  if (Date.now() > info.expiresAt) {
    delete db.qrTokens[token];
    saveDb(db);
    return { error: 'expired' };
  }
  return { info };
}

function normalizeTags(tags) {
  const normalized = tags.map((tag) => TAG_ALIASES[tag] || tag);
  return Array.from(new Set(normalized.filter((tag) => ALLOWED_TAGS.includes(tag))));
}

app.get('/api/tags', (req, res) => {
  res.json({ tags: ALLOWED_TAGS });
});

app.post('/api/signup', (req, res) => {
  const { name, photoUrl, username, password } = req.body || {};
  if (!name || !photoUrl || !username || !password) {
    return res
      .status(400)
      .json({ message: 'name, photoUrl, username, password are required' });
  }

  const db = loadDb();
  if (db.usernames[username]) {
    return res.status(409).json({ message: 'username already exists' });
  }

  const id = nanoid(8);
  db.users[id] = { id, name, photoUrl, username, password, tags: [] };
  db.usernames[username] = id;
  saveDb(db);

  return res.status(201).json(db.users[id]);
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ message: 'username and password are required' });
  }

  const db = loadDb();
  const userId = db.usernames[username];
  if (!userId || !db.users[userId]) {
    return res.status(401).json({ message: 'invalid credentials' });
  }
  const user = db.users[userId];
  if (user.password !== password) {
    return res.status(401).json({ message: 'invalid credentials' });
  }
  return res.json(user);
});

app.get('/api/profile/:id', (req, res) => {
  const db = loadDb();
  cleanupExpiredTokens(db);
  const user = db.users[req.params.id];
  if (!user) {
    return res.status(404).json({ message: 'profile not found' });
  }
  return res.json(user);
});

app.post('/api/profile/:id/qr', async (req, res) => {
  const db = loadDb();
  cleanupExpiredTokens(db);
  const user = db.users[req.params.id];
  if (!user) {
    return res.status(404).json({ message: 'profile not found' });
  }

  const token = nanoid(12);
  const expiresAt = Date.now() + QR_TTL_MS;
  db.qrTokens[token] = { userId: user.id, expiresAt };
  saveDb(db);

  const baseUrl = `${req.protocol}://${req.get('host')}`;
  const url = `${baseUrl}/?mode=scan&token=${token}`;
  const qrDataUrl = await QRCode.toDataURL(url, { width: 320, margin: 2 });

  return res.json({ token, url, qrDataUrl, expiresAt });
});

app.get('/api/qr/:token', (req, res) => {
  const db = loadDb();
  cleanupExpiredTokens(db);
  const { error, info } = getValidToken(db, req.params.token);
  if (error === 'expired') {
    return res.status(410).json({ message: 'qr token expired' });
  }
  if (error) {
    return res.status(404).json({ message: 'qr token not found' });
  }
  const user = db.users[info.userId];
  if (!user) {
    return res.status(404).json({ message: 'profile not found' });
  }
  return res.json({ profile: user, expiresAt: info.expiresAt });
});

app.post('/api/qr/:token/tags', (req, res) => {
  const db = loadDb();
  cleanupExpiredTokens(db);
  const { error, info } = getValidToken(db, req.params.token);
  if (error === 'expired') {
    return res.status(410).json({ message: 'qr token expired' });
  }
  if (error) {
    return res.status(404).json({ message: 'qr token not found' });
  }

  const user = db.users[info.userId];
  if (!user) {
    return res.status(404).json({ message: 'profile not found' });
  }

  const { tags = [] } = req.body || {};
  const normalized = normalizeTags(tags);
  user.tags = Array.from(new Set([...user.tags, ...normalized]));
  saveDb(db);

  return res.json({ profile: user });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

module.exports = app;
