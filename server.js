const path = require('path');
const express = require('express');
const http = require('http');
const sqlite3 = require('sqlite3').verbose();
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const dbPath = path.join(__dirname, 'data', 'cycleconnect.db');
const db = new sqlite3.Database(dbPath);

const rooms = new Map();

function initDb() {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      color TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

initDb();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/login', (req, res) => {
  const name = String(req.body.name || '').trim();
  const color = String(req.body.color || '').trim();

  if (!name || !color) {
    res.status(400).json({ error: 'Name and color are required.' });
    return;
  }

  db.get('SELECT id, name, color FROM users WHERE name = ?', [name], (selectErr, existingUser) => {
    if (selectErr) {
      res.status(500).json({ error: 'Database read failed.' });
      return;
    }

    if (existingUser) {
      res.json({ user: existingUser, persistedColor: true });
      return;
    }

    db.run('INSERT INTO users (name, color) VALUES (?, ?)', [name, color], function insertUser(insertErr) {
      if (insertErr) {
        res.status(500).json({ error: 'Could not save user.' });
        return;
      }

      res.json({ user: { id: this.lastID, name, color }, persistedColor: false });
    });
  });
});

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

function roomSnapshot(roomName) {
  const users = rooms.get(roomName);
  return users ? Array.from(users.values()) : [];
}

io.on('connection', (socket) => {
  socket.on('join-room', ({ roomName, user }) => {
    if (!roomName || !user?.id) {
      return;
    }

    socket.join(roomName);
    socket.data.roomName = roomName;
    socket.data.user = user;

    if (!rooms.has(roomName)) {
      rooms.set(roomName, new Map());
    }

    rooms.get(roomName).set(socket.id, {
      socketId: socket.id,
      id: user.id,
      name: user.name,
      color: user.color,
      lat: null,
      lng: null,
      speed: 0,
      updatedAt: Date.now()
    });

    io.to(roomName).emit('room-users', roomSnapshot(roomName));
  });

  socket.on('location-update', ({ lat, lng, speed }) => {
    const roomName = socket.data.roomName;
    if (!roomName || !rooms.has(roomName)) {
      return;
    }

    const roomUsers = rooms.get(roomName);
    const current = roomUsers.get(socket.id);

    if (!current) {
      return;
    }

    current.lat = lat;
    current.lng = lng;
    current.speed = speed || 0;
    current.updatedAt = Date.now();

    io.to(roomName).emit('locations', roomSnapshot(roomName));
  });

  socket.on('chat-message', ({ text }) => {
    const roomName = socket.data.roomName;
    const user = socket.data.user;

    if (!roomName || !user || !text) {
      return;
    }

    io.to(roomName).emit('chat-message', {
      userId: user.id,
      userName: user.name,
      color: user.color,
      text: String(text).trim().slice(0, 300),
      time: new Date().toISOString()
    });
  });

  socket.on('disconnect', () => {
    const roomName = socket.data.roomName;

    if (!roomName || !rooms.has(roomName)) {
      return;
    }

    const roomUsers = rooms.get(roomName);
    roomUsers.delete(socket.id);

    if (roomUsers.size === 0) {
      rooms.delete(roomName);
      return;
    }

    io.to(roomName).emit('room-users', roomSnapshot(roomName));
    io.to(roomName).emit('locations', roomSnapshot(roomName));
  });
});

server.listen(PORT, () => {
  console.log(`CycleConnect server running on http://localhost:${PORT}`);
});
