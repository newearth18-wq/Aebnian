const express = require('express');
const path = require('path');
const cors = require('cors');
const bodyParser = require('body-parser');
const WebSocket = require('ws');
const http = require('http');
const questionRoutes = require('./questions');
const websocketHandler = require('./websocket');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve static files from client directory
app.use(express.static(path.join(__dirname, '../client')));

// Routes
app.use('/api/questions', questionRoutes);

// Serve main game page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/index.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/admin.html'));
});

// Create HTTP server
const server = http.createServer(app);

// WebSocket server
const wss = new WebSocket.Server({ server });

// Store game rooms and players
const gameRooms = new Map();
const playerConnections = new Map();

wss.on('connection', (ws) => {
  console.log('New WebSocket connection');

  const playerId = Date.now().toString();
  playerConnections.set(playerId, ws);

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      websocketHandler.handleMessage(data, playerId, ws, gameRooms, playerConnections);
    } catch (error) {
      console.error('Error handling message:', error);
    }
  });

  // A dropped player keeps their slot for a grace period so a locked screen,
  // an app switch or a wifi hiccup doesn't end their match — they rejoin with
  // the same name and get their id, role and score back. Only after the grace
  // period do they actually leave.
  const REJOIN_GRACE_MS = 3 * 60 * 1000;

  ws.on('close', () => {
    console.log('Player disconnected:', playerId);
    playerConnections.delete(playerId);

    for (const [roomId, room] of gameRooms.entries()) {
      const player = room.players.get(playerId);
      if (!player) continue;

      player.connected = false;
      player.disconnectedAt = Date.now();

      const notify = (msg) => {
        const payload = JSON.stringify(msg);
        room.players.forEach(p => {
          if (p.connected && p.ws.readyState === 1) p.ws.send(payload);
        });
      };
      // Others grey them out but keep the slot
      notify({ type: 'player_disconnected', playerId });

      player.dropTimer = setTimeout(() => {
        // Still away when the grace ran out — now they're really gone
        const current = room.players.get(playerId);
        if (!current || current.connected) return;
        room.players.delete(playerId);
        notify({ type: 'player_left', playerId });

        const anyoneLeft = Array.from(room.players.values()).some(p => p.connected);
        if (room.players.size === 0 || !anyoneLeft) {
          room.players.forEach(p => { if (p.dropTimer) clearTimeout(p.dropTimer); });
          if (room._batchTimer) clearInterval(room._batchTimer);
          gameRooms.delete(roomId);
          console.log(`Room ${roomId} closed (empty)`);
        }
      }, REJOIN_GRACE_MS);
    }
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

// Initialize database and start server
server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
