const questionStore = require('./supabase');

function handleMessage(data, playerId, ws, gameRooms, playerConnections) {
  const { type, roomId, username, role } = data;

  switch (type) {
    case 'create_room':
      handleCreateRoom(roomId, playerId, username, ws, gameRooms, playerConnections);
      break;

    case 'join_room':
      handleJoinRoom(roomId, playerId, username, role, ws, gameRooms, playerConnections);
      break;

    case 'game_state_update':
      handleGameStateUpdate(data, roomId, gameRooms, playerConnections);
      break;

    case 'hider_painting_update':
      handleHiderPaintingUpdate(data, roomId, gameRooms, playerConnections);
      break;

    case 'question_answered':
      handleQuestionAnswered(data, playerId, roomId, gameRooms).catch(error =>
        console.error('Question scoring failed:', error));
      break;

    case 'game_action':
      handleGameAction(data, roomId, gameRooms, playerConnections);
      break;

    case 'next_round':
      handleNextRound(data, roomId, gameRooms);
      break;

    default:
      console.log('Unknown message type:', type);
  }
}

function handleCreateRoom(roomId, playerId, username, ws, gameRooms, playerConnections) {
  if (!gameRooms.has(roomId)) {
    gameRooms.set(roomId, {
      id: roomId,
      players: new Map(),
      gameState: 'waiting',
      startTime: null,
      duration: 300 // 5 minutes default
    });
  }

  const room = gameRooms.get(roomId);
  // Remember the host so their controls survive a drop + rejoin (the teacher
  // is usually the host — losing it would hand the class no way to run rounds)
  if (!room.hostId) room.hostId = playerId;
  room.players.set(playerId, {
    id: playerId,
    username: username,
    role: 'hider', // Creator is hider by default
    ws: ws,
    score: 0,
    powers: [],
    connected: true
  });

  // Notify player that room was created
  ws.send(JSON.stringify({
    type: 'room_created',
    roomId: roomId,
    playerId: playerId,
    room: {
      id: room.id,
      players: Array.from(room.players.values()).map(p => ({
        id: p.id,
        username: p.username,
        role: p.role
      }))
    }
  }));

  console.log(`Room ${roomId} created by ${username}`);
}

function handleJoinRoom(roomId, playerId, username, role, ws, gameRooms, playerConnections) {
  const room = gameRooms.get(roomId);

  if (!room) {
    ws.send(JSON.stringify({
      type: 'error',
      message: 'Room not found'
    }));
    return;
  }

  // Rejoin: a player who dropped out keeps their slot for a while, so a locked
  // phone or a wifi hiccup doesn't end their match. They reclaim their original
  // id (other clients still have a rig and paint under it) along with their
  // role and score.
  const away = Array.from(room.players.values()).find(
    p => !p.connected && p.username === username
  );
  if (away) {
    away.ws = ws;
    away.connected = true;
    away.disconnectedAt = null;
    if (away.dropTimer) { clearTimeout(away.dropTimer); away.dropTimer = null; }
    playerConnections.set(away.id, ws);

    const list = Array.from(room.players.values()).map(p => ({
      id: p.id, username: p.username, role: p.role, score: p.score || 0
    }));
    ws.send(JSON.stringify({
      type: 'room_joined',
      roomId, playerId: away.id, role: away.role, players: list,
      rejoined: true,
      isHost: away.id === room.hostId,   // the host keeps their controls on return
      gameState: room.gameState,
      startTime: room.startTime,
      settings: room.settings || null,
      round: room.round || 1
    }));
    const back = JSON.stringify({ type: 'player_rejoined', playerId: away.id, username, players: list });
    room.players.forEach(p => { if (p.connected && p.ws.readyState === 1) p.ws.send(back); });
    console.log(`Player ${username} rejoined room ${roomId}`);
    return;
  }

  // A latecomer can drop into a match already in progress instead of being
  // turned away until the next one — a student who joins after the teacher hit
  // start still gets to play. They always come in as a hider (fair, and seekers
  // are capped anyway) and are handed the running game's context further down so
  // their client boots straight into the match rather than into an empty lobby.
  const midGame = room.gameState === 'playing';

  // Cap total room size. High-frequency actions (moves/paints) are batched
  // per tick instead of relayed per message (see handleGameAction), which is
  // what makes rooms this large viable without freezing.
  const MAX_PLAYERS_PER_ROOM = 40;
  if (room.players.size >= MAX_PLAYERS_PER_ROOM) {
    ws.send(JSON.stringify({
      type: 'error',
      message: `ห้องเต็มแล้ว (สูงสุด ${MAX_PLAYERS_PER_ROOM} คน)`
    }));
    return;
  }

  // Cap seekers at 3 per room — extra joiners become hiders automatically.
  // Latecomers joining mid-match always hide (dropping into an active hunt as a
  // seeker would be unfair to the hiders already out on the map).
  const MAX_SEEKERS = 3;
  let assignedRole = midGame ? 'hider' : (role || 'seeker');
  if (!midGame && assignedRole === 'seeker') {
    const seekerCount = Array.from(room.players.values())
      .filter(p => p.role === 'seeker').length;
    if (seekerCount >= MAX_SEEKERS) assignedRole = 'hider';
  }

  room.players.set(playerId, {
    id: playerId,
    username: username,
    role: assignedRole,
    ws: ws,
    score: 0,
    powers: [],
    connected: true
  });

  // Notify all players in room
  const playerList = Array.from(room.players.values()).map(p => ({
    id: p.id,
    username: p.username,
    role: p.role
  }));

  const joinMsg = JSON.stringify({
    type: 'player_joined',
    playerId: playerId,
    username: username,
    role: assignedRole,
    players: playerList
  });
  // Dropped players linger in the room awaiting a rejoin, so every broadcast
  // has to skip their closed sockets
  room.players.forEach(player => { if (player.ws.readyState === 1) player.ws.send(joinMsg); });

  // Send room info to joining player (their role may have been reassigned).
  // For a mid-match latecomer, include the running game's context so their
  // client boots straight into play (see the midGame branch in main.js).
  ws.send(JSON.stringify({
    type: 'room_joined',
    roomId: roomId,
    playerId: playerId,
    role: assignedRole,
    players: playerList,
    midGame,
    gameState: room.gameState,
    startTime: room.startTime,
    settings: room.settings || null,
    round: room.round || 1
  }));

  console.log(`Player ${username} joined room ${roomId}`);
}

function handleGameStateUpdate(data, roomId, gameRooms, playerConnections) {
  const room = gameRooms.get(roomId);

  if (!room) return;

  room.gameState = data.gameState;
  room.startTime = data.startTime;
  // Store room settings (duration, questionSetId, mapId) from the creator
  if (data.settings) {
    room.settings = data.settings;
    if (data.settings.duration) room.duration = data.settings.duration;
  }

  // Broadcast to all players in room (settings included so joiners sync)
  const msg = JSON.stringify({
    type: 'game_state_changed',
    gameState: data.gameState,
    startTime: data.startTime,
    settings: room.settings || null
  });
  room.players.forEach(player => { if (player.ws.readyState === 1) player.ws.send(msg); });
}

function handleHiderPaintingUpdate(data, roomId, gameRooms, playerConnections) {
  const room = gameRooms.get(roomId);

  if (!room) return;

  // Broadcast painting update to all seekers
  const msg = JSON.stringify({
    type: 'hider_painting_update',
    hiderId: data.hiderId,
    paintData: data.paintData
  });
  room.players.forEach(player => {
    if (player.role === 'seeker' && player.ws.readyState === 1) player.ws.send(msg);
  });
}

async function handleQuestionAnswered(data, playerId, roomId, gameRooms) {
  const room = gameRooms.get(roomId);
  if (!room) return;
  const player = room.players.get(playerId);
  if (!player) return;
  if (typeof data.questionId !== 'string' || !data.questionId) return;
  player.answeredQuestions ||= new Set();
  if (player.answeredQuestions.has(data.questionId)) return;
  player.answeredQuestions.add(data.questionId);
  let isCorrect;
  try {
    isCorrect = await questionStore.validateAnswer(
      data.questionId, data.userAnswer, room.settings?.questionSetId || null);
  } catch (error) {
    player.answeredQuestions.delete(data.questionId);
    throw error;
  }
  if (isCorrect === null) {
    player.answeredQuestions.delete(data.questionId);
    return;
  }
  player.score = Math.max(0, (player.score || 0) + (isCorrect ? 10 : -5));
  const msg = JSON.stringify({
    type: 'answer_result',
    playerId,
    isCorrect,
    newScore: player.score,
    newPowers: player.powers || []
  });
  room.players.forEach(p => { if (p.ws.readyState === 1) p.ws.send(msg); });
}

// Batch flush rate for high-frequency actions (moves + paint strokes).
// At 40 players, relaying each message immediately costs
// senders x recipients (= tens of thousands of msgs/sec); batching costs a
// flat tickRate x recipients (~270 msgs/sec) no matter how busy the room is.
const BATCH_INTERVAL_MS = 150;
const MAX_PAINTS_PER_TICK = 600; // safety valve against paint spam

function ensureBatchTimer(room) {
  if (room._batchTimer) return;
  room._batchMoves = {};
  room._batchPaints = [];
  room._batchTimer = setInterval(() => {
    const hasMoves = Object.keys(room._batchMoves).length > 0;
    const hasPaints = room._batchPaints.length > 0;
    if (!hasMoves && !hasPaints) return;

    const msg = JSON.stringify({
      type: 'room_batch',
      moves: hasMoves ? room._batchMoves : null,
      paints: hasPaints ? room._batchPaints : null
    });
    room._batchMoves = {};
    room._batchPaints = [];

    room.players.forEach(player => {
      // readyState 1 = OPEN; skip sockets that are closing to avoid buffering
      if (player.ws.readyState === 1) player.ws.send(msg);
    });
  }, BATCH_INTERVAL_MS);
}

function handleGameAction(data, roomId, gameRooms, playerConnections) {
  const room = gameRooms.get(roomId);

  if (!room) return;

  // High-frequency actions go into the per-room batch instead of instant relay
  if (data.action === 'move') {
    ensureBatchTimer(room);
    room._batchMoves[data.playerId] = data.actionData; // latest position wins
    return;
  }
  if (data.action === 'paint') {
    ensureBatchTimer(room);
    if (room._batchPaints.length < MAX_PAINTS_PER_TICK) {
      room._batchPaints.push({ p: data.playerId, ...data.actionData });
    }
    return;
  }

  // Rare, latency-sensitive actions (shoot, found) still relay immediately
  const msg = JSON.stringify({
    type: 'player_action',
    playerId: data.playerId,
    action: data.action,
    data: data.actionData
  });
  room.players.forEach(player => {
    if (player.id !== data.playerId && player.ws.readyState === 1) player.ws.send(msg);
  });
}

// End of a round: bank the points that were just earned, rotate who hunts, and
// start the next round — or finish the match. Role assignment happens here so
// every client agrees on who is seeking; clients only report the scoring.
function handleNextRound(data, roomId, gameRooms) {
  const room = gameRooms.get(roomId);
  if (!room) return;

  if (Array.isArray(data.scores)) {
    data.scores.forEach(s => {
      const p = room.players.get(s.id);
      if (p) p.score = (p.score || 0) + (Number(s.points) || 0);
    });
  }

  const roster = () => Array.from(room.players.values()).map(p => ({
    id: p.id, username: p.username, role: p.role, score: p.score || 0
  }));
  const sendAll = (payload) => {
    const msg = JSON.stringify(payload);
    room.players.forEach(p => { if (p.ws.readyState === 1) p.ws.send(msg); });
  };

  const totalRounds = Math.max(1, Number(data.totalRounds) || 3);
  const ids = Array.from(room.players.keys());
  room.round = (room.round || 1) + 1;

  if (room.round > totalRounds || ids.length === 0) {
    room.gameState = 'finished';
    sendAll({ type: 'match_over', players: roster() });
    return;
  }

  // Rotate the seeker slots along the roster so everyone gets a turn hunting
  const seekerCount = Math.max(1, Math.min(3, Math.ceil(ids.length / 5)));
  const offset = ((room.round - 1) * seekerCount) % ids.length;
  const seekers = new Set();
  for (let i = 0; i < seekerCount; i++) seekers.add(ids[(offset + i) % ids.length]);
  room.players.forEach((p, id) => { p.role = seekers.has(id) ? 'seeker' : 'hider'; });

  room.gameState = 'playing';
  room.startTime = Date.now();
  sendAll({
    type: 'round_start',
    round: room.round,
    totalRounds,
    startTime: room.startTime,
    players: roster()
  });
}

module.exports = {
  handleMessage
};
