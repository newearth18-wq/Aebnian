// UI Elements
const welcomeScreen = document.getElementById('welcomeScreen');
const roomSetupScreen = document.getElementById('roomSetupScreen');
const gameScreen = document.getElementById('gameScreen');
const gameOverScreen = document.getElementById('gameOverScreen');

const usernameInput = document.getElementById('usernameInput');
const durationSelect = document.getElementById('durationSelect');
const customDurationRow = document.getElementById('customDurationRow');
const customDuration = document.getElementById('customDuration');
// Question-set picker window
const questionSetBtn = document.getElementById('questionSetBtn');
const questionSetModal = document.getElementById('questionSetModal');
const questionSetList = document.getElementById('questionSetList');
const questionSetSearch = document.getElementById('questionSetSearch');
// Selected set: { id: '' (all), name }
let selectedQuestionSet = { id: '', name: '📚 ทุกชุด (ทั้งหมด)' };
let questionSets = []; // cached list from the API
const manageQuestionsBtn = document.getElementById('manageQuestionsBtn');
const createRoomBtn = document.getElementById('createRoomBtn');
const joinRoomBtn = document.getElementById('joinRoomBtn');
const roomCodeInput = document.getElementById('roomCodeInput');
const copyRoomCodeBtn = document.getElementById('copyRoomCodeBtn');
const playersList = document.getElementById('playersList');
const roleHiderBtn = document.getElementById('roleHiderBtn');
const roleSeekerBtn = document.getElementById('roleSeekerBtn');
const roleSelectorContainer = document.getElementById('roleSelectorContainer');
const mapSelectorContainer = document.getElementById('mapSelectorContainer');
const mapSelect = document.getElementById('mapSelect');
const startGameBtn = document.getElementById('startGameBtn');
const leaveRoomBtn = document.getElementById('leaveRoomBtn');
const timerDisplay = document.getElementById('timerDisplay');
const scoreDisplay = document.getElementById('scoreDisplay');
const submitAnswerBtn = document.getElementById('submitAnswerBtn');
const adminPanelBtn = document.getElementById('adminPanelBtn');
const playAgainBtn = document.getElementById('playAgainBtn');
const backToMenuBtn = document.getElementById('backToMenuBtn');
const joinBanner = document.getElementById('joinBanner');
const roomQrCode = document.getElementById('roomQrCode');
const paintToolbar = document.getElementById('paintToolbar');
const colorPalette = document.getElementById('colorPalette');
const colorPicker = document.getElementById('colorPicker');
const brushSizeInput = document.getElementById('brushSize');
const clearPaintBtn = document.getElementById('clearPaintBtn');
const eyedropperBtn = document.getElementById('eyedropperBtn');
const paintAllBtn = document.getElementById('paintAllBtn');
const askQuestionBtn = document.getElementById('askQuestionBtn');
const poseWheel = document.getElementById('poseWheel');
const powersList = document.getElementById('powersList');
const roleInfo = document.getElementById('roleInfo');
const hideStatus = document.getElementById('hideStatus');
const remainingNumber = document.getElementById('remainingNumber');

// Room code pending from QR link / URL param
let pendingRoomCode = null;

// Hiders already caught this round (avoid double-counting)
const foundPlayers = new Set();

// A hider was caught — eliminate them, announce it, update the count, end if all caught
function handlePlayerFound(targetId) {
  if (!targetId || foundPlayers.has(targetId)) return;
  const target = currentGame.players.get(targetId);
  // Only hiders can be eliminated — a stray shot on a seeker is not a catch
  if (target && target.role !== 'hider') return;
  foundPlayers.add(targetId);
  const name = target ? target.username : 'ผู้เล่น';

  if (gameEngine) gameEngine.markCaught(targetId);

  // Infection: the caught player switches to the seeker team. Their record has
  // to change too, or the next position update would hand the engine their old
  // 'hider' role and undo the switch.
  if (target) target.role = 'seeker';

  if (targetId === currentGame.playerId) {
    // I was caught — I join the hunt instead of sitting out
    if (gameEngine) gameEngine.convertToSeeker();
    currentGame.role = 'seeker';
    paintToolbar.style.display = 'none';
    showCaughtOverlay();
    if (typeof soundFX !== 'undefined') soundFX.caught();
    renderAbilityBar();     // seeker powers from here on
    setupMobileControls();  // the action button becomes "ยิง"
  } else {
    showMessage(`🚨 จับ ${name} ได้แล้ว — เข้าทีมผู้หา!`, 'success');
  }

  // Remaining hiders. Caught players are now seekers, so counting live hiders
  // directly is what's left — the old "all hiders minus caught" list emptied
  // itself as people switched sides and the win check could never fire.
  const remaining = [...currentGame.players.values()]
    .filter(p => p.role === 'hider' && !p.spectator && !foundPlayers.has(p.id)).length;
  remainingNumber.textContent = remaining;

  // Last hider caught → the seeker pack wins
  if (remaining === 0) {
    showMessage('🏁 จับผู้ซ่อนครบทุกคน — ผู้ตามชนะ!', 'success');
    setTimeout(() => { if (gameEngine && gameEngine.gameState === 'playing') endGame(); }, 1500);
  }
}

// Standings between rounds: this round's points plus the running total
function showRoundScoreboard(roundScores) {
  let el = document.getElementById('roundBoard');
  if (!el) {
    el = document.createElement('div');
    el.id = 'roundBoard';
    document.querySelector('.game-container').appendChild(el);
  }
  const gained = {};
  (roundScores || []).forEach(s => { gained[s.id] = s.points; });
  const rows = [...currentGame.players.values()]
    .map(p => ({
      name: p.username,
      me: p.id === currentGame.playerId,
      total: (p.score || 0) + (gained[p.id] || 0),
      gain: gained[p.id] || 0
    }))
    .sort((a, b) => b.total - a.total);

  const round = currentGame.round || 1;
  const total = currentGame.totalRounds || DEFAULT_ROUNDS;
  el.innerHTML =
    `<div class="round-box">` +
      `<h3>🏁 จบรอบที่ ${round} / ${total}</h3>` +
      `<div class="round-rows">` +
        rows.map((r, i) =>
          `<div class="round-row${r.me ? ' me' : ''}">` +
            `<span class="rk">${i + 1}</span>` +
            `<span class="nm">${r.name}</span>` +
            `<span class="gn">+${r.gain}</span>` +
            `<span class="tt">${r.total}</span>` +
          `</div>`).join('') +
      `</div>` +
      `<div class="round-note">${round < total ? '🔄 สลับบทบาท แล้วเริ่มรอบต่อไป...' : 'กำลังสรุปผล...'}</div>` +
    `</div>`;
  el.style.display = 'flex';
}

function hideRoundScoreboard() {
  const el = document.getElementById('roundBoard');
  if (el) el.style.display = 'none';
}

// Full-screen banner for the caught hider — they now join the hunt, so it
// clears itself instead of hanging around over a spectator's view
function showCaughtOverlay() {
  let el = document.getElementById('caughtOverlay');
  if (!el) {
    el = document.createElement('div');
    el.id = 'caughtOverlay';
    document.querySelector('.game-container').appendChild(el);
  }
  el.innerHTML = '<div class="caught-box">🚨 คุณโดนจับแล้ว!<br>' +
                 '<span>🔫 ตอนนี้คุณเป็นผู้หา — ไปช่วยล่าคนอื่นต่อ!</span></div>';
  el.style.opacity = '1';
  el.style.display = 'flex';
  setTimeout(() => { if (el) el.style.display = 'none'; }, 2600);
}

// Paint / power state — correct answers unlock more colors
const ALL_COLORS = [
  '#e74c3c', '#3498db', '#2ecc71', '#f1c40f', '#e67e22',
  '#9b59b6', '#1abc9c', '#e91e63', '#795548', '#34495e'
];
let paintState = {
  color: ALL_COLORS[0],
  brushSize: 15,
  unlockedCount: 3, // start with 3 colors, unlock more by answering
  sampledColor: null // last color sucked from the world with the eyedropper
};
let isPainting = false;
// Questions loaded for this game (shown on-demand when player clicks the button)
let loadedQuestions = [];

// ===== Special abilities =====
// Answering a question correctly earns energy (harder question → more energy),
// which is spent here. Hiders get evasion powers, seekers get detection powers,
// so neither side can simply out-answer the other into an unbeatable lead.
const ABILITIES = [
  { id: 'camo',      icon: '🦎', name: 'พรางตัว',   cost: 2, role: 'hider',  desc: 'ทาสีตัวให้กลืนกับของรอบตัวทันที' },
  { id: 'decoy',     icon: '🎭', name: 'หุ่นล่อ',    cost: 3, role: 'hider',  desc: 'วางร่างจำลอง ผู้หายิงโดน = ไซเรนดัง' },
  { id: 'radar',     icon: '📡', name: 'เรดาร์',     cost: 3, role: 'hider',  desc: 'บอกทิศ/ระยะผู้หาที่ใกล้ที่สุด 30 วิ' },
  { id: 'invisible', icon: '👻', name: 'ล่องหน',     cost: 5, role: 'hider',  desc: 'ตัวจางเกือบมองไม่เห็น 6 วิ' },
  { id: 'disguise',  icon: '📦', name: 'แปลงร่าง',   cost: 5, role: 'hider',  desc: 'กลายเป็นถัง/แจกัน/ลัง 20 วิ' },
  { id: 'speed',     icon: '💨', name: 'วิ่งเร็ว',   cost: 2, role: 'both',   desc: 'เร็วขึ้น 1.6 เท่า 10 วิ' },
  { id: 'jump',      icon: '🦘', name: 'กระโดดสูง',  cost: 2, role: 'both',   desc: 'กระโดดสูง/ปีนไวขึ้น 15 วิ' },
  { id: 'scan',      icon: '🔍', name: 'สแกน',      cost: 4, role: 'seeker', desc: 'เผยตำแหน่งผู้ซ่อนในรัศมี 6 วิ' },
  { id: 'xray',      icon: '👁️', name: 'มองทะลุ',    cost: 4, role: 'seeker', desc: 'วัตถุโปร่งใส 6 วิ' },
  { id: 'drone',     icon: '🚁', name: 'โดรน',      cost: 3, role: 'seeker', desc: 'มองจากมุมสูง 8 วิ' },
  { id: 'time',      icon: '⏱️', name: 'ต่อเวลา',    cost: 3, role: 'seeker', desc: 'เพิ่มเวลาล่า 30 วิ (ใช้ตอนล่าเท่านั้น)' }
];
const ENERGY_BY_DIFFICULTY = { easy: 1, medium: 2, hard: 3 };
let abilityState = { energy: 0 };

// ===== Rounds =====
// Several short rounds beat one long one: roles rotate so everyone gets to
// hunt, and points carry across so there's a race worth following.
const DEFAULT_ROUNDS = 3;
// Catches made this round, by shooter id — feeds the round scoring
let roundCatches = {};

// Game state
let currentGame = {
  roomId: null,
  username: null,
  playerId: null,
  role: null,
  isCreator: false,
  players: new Map()
};

// ===== Session persistence (survive an iOS Safari tab reload) =====
// iPhones reload the tab under WebGL memory pressure, which dumped players on
// the name screen. Remembering the room + name lets a reload drop them straight
// back in — with a guard so a genuinely crashing device doesn't auto-reload
// forever.
const SESSION_KEY = 'aebnian_session';
const RELOADS_KEY = 'aebnian_reloads';

function saveSession() {
  try {
    if (currentGame.roomId && currentGame.username) {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({
        roomId: currentGame.roomId,
        username: currentGame.username,
        role: currentGame.role || 'hider',
        ts: Date.now()
      }));
    }
  } catch (e) { /* private mode / storage disabled — just skip */ }
}

function clearSession() {
  try { sessionStorage.removeItem(SESSION_KEY); sessionStorage.removeItem(RELOADS_KEY); } catch (e) {}
}

function loadSession() {
  try {
    const s = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null');
    if (s && s.roomId && s.username && Date.now() - s.ts < 10 * 60 * 1000) return s;
  } catch (e) {}
  return null;
}

// After joining, an in-game stretch means the session is healthy — forget the
// recent-reload count so a much-later single reload isn't treated as a loop.
function markSessionHealthy() {
  setTimeout(() => { try { sessionStorage.removeItem(RELOADS_KEY); } catch (e) {} }, 15000);
}

// On load, if we have a recent session, rejoin it instead of showing the name
// form. Returns true if an auto-rejoin was kicked off.
function tryAutoRejoin() {
  const sess = loadSession();
  if (!sess) return false;

  // Loop guard: if the tab has reloaded 3+ times in 20s, stop auto-rejoining
  const now = Date.now();
  let reloads = [];
  try { reloads = JSON.parse(sessionStorage.getItem(RELOADS_KEY) || '[]'); } catch (e) {}
  reloads = reloads.filter(t => now - t < 20000);
  reloads.push(now);
  try { sessionStorage.setItem(RELOADS_KEY, JSON.stringify(reloads)); } catch (e) {}
  if (reloads.length >= 3) {
    clearSession();
    showMessage('การเชื่อมต่อ/กราฟิกไม่เสถียรบนเครื่องนี้ — กรอกชื่อเพื่อเข้าห้องอีกครั้ง', 'error');
    return false;
  }

  currentGame.username = sess.username;
  currentGame.role = sess.role;
  if (usernameInput) usernameInput.value = sess.username;
  showMessage('🔌 กำลังกลับเข้าห้องเดิม...', 'success');
  wsClient.joinRoom(sess.roomId, sess.username, sess.role);   // server restores our slot
  return true;
}

// Initialize
async function init() {
  try {
    // Touch devices get the compact HUD (collapsed toolbars) regardless of
    // viewport width — landscape phones/tablets can be wider than 820px
    if (('ontouchstart' in window) || navigator.maxTouchPoints > 0) {
      document.body.classList.add('touch-device');
    }
    await wsClient.connect();
    setupEventListeners();
    setupWebSocketListeners();
    setupPaintEvents();
    setupFullscreen();
    setupMobileHudToggles();
    setupDurationPicker();
    populateQuestionSets();
    // A remembered session (after a reload) wins over a QR link
    if (!tryAutoRejoin()) checkUrlForRoom();
  } catch (error) {
    console.error('Failed to initialize:', error);
  }
}

// If opened via QR link (?room=CODE), prefill and prompt to join
function checkUrlForRoom() {
  const params = new URLSearchParams(window.location.search);
  const roomParam = params.get('room');
  if (roomParam) {
    pendingRoomCode = roomParam;
    joinBanner.style.display = 'block';
    joinBanner.textContent = `กำลังเข้าห้อง: ${roomParam} — ใส่ชื่อแล้วกด "Join Room"`;
    joinRoomBtn.textContent = 'Join Room ✓';
    usernameInput.focus();
  }
}

function setupEventListeners() {
  createRoomBtn.addEventListener('click', handleCreateRoom);
  joinRoomBtn.addEventListener('click', handleJoinRoom);
  copyRoomCodeBtn.addEventListener('click', copyRoomCode);
  roleHiderBtn.addEventListener('click', () => setRole('hider'));
  roleSeekerBtn.addEventListener('click', () => setRole('seeker'));
  mapSelect.addEventListener('change', () => { currentGame.mapId = mapSelect.value; });

  // Host-only monitor mode: step out of the match, watch the whole class from
  // above with a live dashboard, and drop the cluttered player HUD entirely
  const ovBtn = document.getElementById('overviewBtn');
  if (ovBtn) {
    ovBtn.addEventListener('click', () => {
      if (!gameEngine || !gameEngine.setMonitor) return;
      applyMonitor(!currentGame.monitoring, true);
    });
  }

  // Host-only: pop the room code + QR up mid-match so a student who turns up
  // late can be let in without the teacher having to remember the code
  const rcBtn = document.getElementById('roomCodeBtn');
  if (rcBtn) {
    rcBtn.addEventListener('click', () => {
      const panel = document.getElementById('roomCodePanel');
      showRoomCodePanel(!panel || panel.style.display === 'none');
    });
  }
  const rcClose = document.getElementById('roomCodeClose');
  if (rcClose) rcClose.addEventListener('click', () => showRoomCodePanel(false));
  manageQuestionsBtn.addEventListener('click', () => window.location.href = '/admin');
  startGameBtn.addEventListener('click', handleStartGame);
  const lobbyStart = document.getElementById('lobbyStartBtn');
  if (lobbyStart) lobbyStart.addEventListener('click', handleStartGame);
  leaveRoomBtn.addEventListener('click', handleLeaveRoom);
  submitAnswerBtn.addEventListener('click', handleSubmitAnswer);
  adminPanelBtn.addEventListener('click', () => window.location.href = '/admin');

  // Sound on/off toggle
  const soundToggleBtn = document.getElementById('soundToggleBtn');
  soundToggleBtn.addEventListener('click', () => {
    const on = soundFX.toggle();
    soundToggleBtn.textContent = on ? '🔊' : '🔇';
  });

  // Browsers require a user gesture before audio can play — wake it on first click
  document.addEventListener('pointerdown', () => {
    if (typeof soundFX !== 'undefined') soundFX._ensure();
  }, { once: true });
  playAgainBtn.addEventListener('click', resetGame);
  backToMenuBtn.addEventListener('click', () => {
    leaveRoom();
    showScreen('welcome');
  });

  // Allow Enter key to submit username
  usernameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      handleCreateRoom();
    }
  });
}

// Apply the creator's room settings (duration / question set / map) onto the
// local game state. Shared by every path that learns the settings: a normal
// game start, a rejoin, and a latecomer dropping into a match in progress.
function applyRoomSettings(settings) {
  if (!settings) return;
  if (settings.duration) currentGame.duration = settings.duration;
  if (settings.questionSetId !== undefined) currentGame.questionSetId = settings.questionSetId;
  if (settings.mapId) currentGame.mapId = settings.mapId;
}

function setupWebSocketListeners() {
  wsClient.on('room_created', (data) => {
    currentGame.roomId = data.roomId;
    currentGame.playerId = data.playerId;
    currentGame.isCreator = true;
    currentGame.players = new Map();

    data.room.players.forEach(p => {
      currentGame.players.set(p.id, p);
    });
    saveSession();   // remember the room so a reload can rejoin

    roomCodeInput.value = data.roomId;
    // Default role + map for the host; can still be tweaked from the lobby HUD
    currentGame.role = 'hider';
    currentGame.mapId = currentGame.mapId || 'meadow';
    startLobbyRoom();       // full-screen 3D lobby (host sees Start button + QR)
    updateRoleSelectorUI();
  });

  wsClient.on('room_joined', (data) => {
    currentGame.roomId = data.roomId;
    currentGame.playerId = data.playerId;
    // A rejoining host keeps their controls; a normal joiner never is host
    currentGame.isCreator = !!data.isHost;
    currentGame._rejoinPending = false;
    currentGame.players = new Map();
    saveSession();          // remember the room so a reload can rejoin
    markSessionHealthy();   // a real session clears the reload-loop counter

    data.players.forEach(p => {
      currentGame.players.set(p.id, p);
    });

    // The server may reassign the role (seekers are capped at 3 per room)
    if (data.role) {
      const wasReassigned = currentGame.role === 'seeker' && data.role === 'hider';
      currentGame.role = data.role;
      if (wasReassigned) {
        showMessage('ผู้หาเต็มแล้ว (สูงสุด 3 คน) — คุณได้เป็นผู้ซ่อนแทน 🎨', 'success');
      }
    }
    // Coming back after dropping out — rejoin the match already in progress
    // instead of sitting in a lobby that nobody else is in
    if (data.rejoined) {
      applyRoomSettings(data.settings);
      currentGame.round = data.round || 1;
      if (data.gameState === 'playing' && data.startTime) {
        currentGame.mapId = currentGame.mapId || 'meadow';
        _bootGame();
        // Pick the round up where it actually is, not from zero
        if (gameEngine) gameEngine.startTime = data.startTime;
        showMessage('🔌 กลับเข้าเกมแล้ว!', 'success');
        return;
      }
      startLobbyRoom();
      showMessage('🔌 กลับเข้าห้องแล้ว!', 'success');
      return;
    }

    // Latecomer dropping into a match already in progress — boot straight into
    // the running game (as a hider) instead of a lobby that nobody else is in.
    if (data.midGame && data.gameState === 'playing' && data.startTime) {
      applyRoomSettings(data.settings);
      currentGame.round = data.round || 1;
      currentGame.mapId = currentGame.mapId || 'meadow';
      _bootGame();
      // Join the round already in progress, not a fresh timer
      if (gameEngine) gameEngine.startTime = data.startTime;
      showMessage('⏱️ เข้าเกมที่กำลังเล่นอยู่ — คุณเป็นผู้ซ่อน 🎨', 'success');
      return;
    }

    // Joiners don't have a map picked yet — the host sends it when they start.
    // Use meadow as the lobby backdrop until the real match begins.
    currentGame.mapId = currentGame.mapId || 'meadow';
    startLobbyRoom();       // joiners just get the 3D room with "waiting" note
  });

  // Someone dropped — hold their slot and grey them out rather than deleting
  wsClient.on('player_disconnected', (data) => {
    const p = currentGame.players.get(data.playerId);
    if (p) p.away = true;
    if (gameEngine) gameEngine.setRemoteAway(data.playerId, true);
    updatePlayersList();
    renderLobbyList();
  });

  wsClient.on('player_rejoined', (data) => {
    if (typeof soundFX !== 'undefined') soundFX.pop();
    const p = currentGame.players.get(data.playerId);
    if (p) p.away = false;
    if (gameEngine) gameEngine.setRemoteAway(data.playerId, false);
    updatePlayersList();
    renderLobbyList();
    showMessage(`🔌 ${data.username} กลับเข้าเกมแล้ว`, 'success');
  });

  wsClient.on('player_joined', (data) => {
    if (typeof soundFX !== 'undefined') soundFX.pop();
    currentGame.players.set(data.playerId, {
      id: data.playerId,
      username: data.username,
      role: data.role
    });
    updatePlayersList();
    renderLobbyList();
    // Spawn the newcomer's character in the lobby scene
    if (gameEngine && data.playerId !== currentGame.playerId) {
      gameEngine.addRemotePlayer(data.playerId, data.username, data.role);
    }
  });

  wsClient.on('player_left', (data) => {
    if (typeof soundFX !== 'undefined') soundFX.leave();
    currentGame.players.delete(data.playerId);
    if (gameEngine) gameEngine.removeRemotePlayer(data.playerId);
    updatePlayersList();
    renderLobbyList();
  });

  wsClient.on('game_state_changed', (data) => {
    if (data.gameState === 'playing') {
      // Apply the creator's room settings before starting (joiners sync here)
      applyRoomSettings(data.settings);
      transitionLobbyToMatch();
    }
  });

  // Server rotated the roles and started the next round
  wsClient.on('round_start', (data) => {
    hideRoundScoreboard();
    currentGame.round = data.round;
    currentGame.totalRounds = data.totalRounds;
    (data.players || []).forEach(p => {
      const rec = currentGame.players.get(p.id);
      if (rec) { rec.role = p.role; rec.score = p.score; }
      if (p.id === currentGame.playerId) currentGame.role = p.role;
    });
    // Fresh slate for the new round (energy carries over — it rewards the
    // players who kept answering questions)
    foundPlayers.clear();
    roundCatches = {};
    const el = document.getElementById('caughtOverlay');
    if (el) el.style.display = 'none';
    saveSession();   // role changed this round — keep the saved copy current
    showMessage(`🔄 รอบที่ ${data.round}: คุณเป็น${currentGame.role === 'seeker' ? 'ผู้หา 🔫' : 'ผู้ซ่อน 🫥'}`, 'success');
    _bootGame();
  });

  // Last round finished — show the final standings
  wsClient.on('match_over', (data) => {
    hideRoundScoreboard();
    clearSession();   // match's over — no room to rejoin
    (data.players || []).forEach(p => {
      const rec = currentGame.players.get(p.id);
      if (rec) rec.score = p.score;
    });
    if (gameEngine) gameEngine.endGame();
    showScreen('gameOver');
    displayResults();
    if (typeof soundFX !== 'undefined') { soundFX.stopMusic(); soundFX.victory(); }
  });

  wsClient.on('answer_result', (data) => {
    if (data.playerId === currentGame.playerId) {
      if (gameEngine) gameEngine.score = data.newScore;
      scoreDisplay.textContent = data.newScore;
    }
  });

  // Batched high-frequency updates: many players' moves + paint strokes,
  // combined by the server into one message per tick (scales to 40 players)
  wsClient.on('room_batch', (data) => {
    if (!gameEngine) return;
    if (data.moves) {
      for (const pid in data.moves) {
        if (pid === currentGame.playerId) continue; // my own echo
        const sender = currentGame.players.get(pid);
        gameEngine.updateRemotePlayer(
          pid, data.moves[pid],
          sender && sender.username, sender && sender.role
        );
      }
    }
    if (data.paints) {
      data.paints.forEach(s => {
        if (s.p === currentGame.playerId) return;
        gameEngine.paintRemote(s.p, s);
      });
    }
  });

  // Actions relayed from other players: movement, paint strokes, "found!"
  wsClient.on('player_action', (data) => {
    if (!gameEngine) return;
    const sender = currentGame.players.get(data.playerId);
    if (data.action === 'move') {
      gameEngine.updateRemotePlayer(
        data.playerId, data.data,
        sender && sender.username, sender && sender.role
      );
    } else if (data.action === 'paint') {
      gameEngine.paintRemote(data.playerId, data.data);
    } else if (data.action === 'shoot') {
      gameEngine.showRemoteLaser(data.data);
    } else if (data.action === 'ability') {
      gameEngine.applyRemoteAbility(data.playerId, data.data);
    } else if (data.action === 'spectator') {
      const p = currentGame.players.get(data.playerId);
      if (p) p.spectator = !!(data.data && data.data.on);
      gameEngine.setRemoteSpectator(data.playerId, !!(data.data && data.data.on));
    } else if (data.action === 'found' && data.data) {
      // Note: a previously-caught player is now a seeker, so their catches
      // count — the old "eliminated players can't catch" guard would have
      // silently thrown away every catch made by the infected pack.
      // Only credit the shot that ACTUALLY caught them: if three seekers all
      // shoot the same hider at once, the second and third arrive after the
      // dedup and shouldn't score. Check before incrementing catches so the
      // catch scoreboard reflects who tagged them, not who spammed fire.
      const already = foundPlayers.has(data.data.targetId);
      if (typeof soundFX !== 'undefined') soundFX.siren(3);
      if (!already) roundCatches[data.playerId] = (roundCatches[data.playerId] || 0) + 1;
      handlePlayerFound(data.data.targetId);
    }
  });

  wsClient.on('error', (error) => {
    console.error('WebSocket error:', error);
    // A rejected auto-rejoin must clear the flag, or the retry never fires again
    const wasRejoin = currentGame._rejoinPending;
    currentGame._rejoinPending = false;
    // Server-sent rejections (room full, room not found, ...) arrive as a
    // parsed {type:'error', message} payload; raw connection failures don't
    // have a .message. Show the server's own wording for the former.
    if (error && error.type === 'error' && error.message) {
      // A failed auto-rejoin shouldn't throw a blocking modal over the game
      if (wasRejoin) showMessage(error.message, 'error');
      else alert(error.message);
    } else if (!wasRejoin) {
      alert('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาลองใหม่');
    }
  });

  wsClient.on('disconnected', () => {
    // Non-blocking — a modal here would freeze the game behind it. The socket
    // auto-reconnects; the 'connected' handler below re-announces us.
    if (currentGame.roomId) showMessage('📡 หลุดการเชื่อมต่อ กำลังต่อใหม่...', 'error');
  });

  // Socket came back after a drop. The reconnected socket is idle until we say
  // who we are, so the server never runs its rejoin logic on its own — resend
  // join_room and it restores our slot (same id, role, score). This is the fix
  // for "dropped players can't get back in": the socket reconnected but nobody
  // ever told the server to put them back.
  wsClient.on('connected', () => {
    if (currentGame.roomId && currentGame.username && !currentGame._rejoinPending) {
      currentGame._rejoinPending = true;
      wsClient.joinRoom(currentGame.roomId, currentGame.username, currentGame.role || 'hider');
    }
  });

  wsClient.on('reconnect_failed', () => {
    if (currentGame.roomId) {
      showMessage('❌ ต่อเซิร์ฟเวอร์ไม่ได้ — ลองรีเฟรชแล้วเข้าห้องเดิมด้วยชื่อเดิม', 'error');
    }
  });
}

function handleCreateRoom() {
  const username = usernameInput.value.trim();

  if (!username) {
    alert('Please enter a username');
    return;
  }

  currentGame.username = username;
  currentGame.duration = readDurationSeconds();
  currentGame.questionSetId = selectedQuestionSet.id || null;
  const roomId = generateRoomCode();
  wsClient.createRoom(roomId, username);
}

function handleJoinRoom() {
  const username = usernameInput.value.trim();

  if (!username) {
    alert('Please enter a username');
    return;
  }

  // Use pending code (from QR/URL) if available, otherwise ask
  const roomId = pendingRoomCode || prompt('Enter room code:');

  if (!roomId) {
    alert('Please enter a room code');
    return;
  }

  currentGame.username = username;
  currentGame.duration = readDurationSeconds();
  currentGame.questionSetId = selectedQuestionSet.id || null;
  currentGame.role = 'seeker'; // requested role; server may reassign if seekers are full
  wsClient.joinRoom(roomId, username, 'seeker');

  // Joiners' games start remotely (no tap available then) — grab fullscreen
  // now while we still have this button-tap gesture
  const isTouchJoin = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
  if (isTouchJoin && !isFullscreenActive()) enterFullscreen();
}

function setRole(role) {
  currentGame.role = role;
  updateRoleSelectorUI();

  if (currentGame.isCreator) {
    startGameBtn.disabled = false;
  }
}

function updateRoleSelectorUI() {
  roleHiderBtn.classList.toggle('active', currentGame.role === 'hider');
  roleSeekerBtn.classList.toggle('active', currentGame.role === 'seeker');
}

function handleStartGame() {
  if (!currentGame.isCreator) return;      // safety: only host can start
  if (currentGame.players.size < 1) {
    alert('No players in room');
    return;
  }

  // On phones, go fullscreen while we still have the button-tap gesture
  const isTouchStart = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
  if (isTouchStart && !isFullscreenActive()) enterFullscreen();

  // Creator's settings travel with the start signal so every player syncs
  wsClient.startGame(currentGame.roomId, 'playing', {
    duration: currentGame.duration || 300,
    questionSetId: currentGame.questionSetId || null,
    mapId: currentGame.mapId || 'meadow'
  });
}

// Fully tear down the previous GameEngine + swap in a fresh <canvas> so the
// new engine can grab its own WebGL context. Reusing the same canvas after
// forceContextLoss() often left the map painted black with red streaks.
function disposePreviousEngine() {
  if (gameEngine && gameEngine.dispose) {
    try { gameEngine.dispose(); } catch (e) { console.warn(e); }
  }
  gameEngine = null;
  const old = document.getElementById('gameCanvas');
  if (old && old.parentNode) {
    const fresh = document.createElement('canvas');
    fresh.id = 'gameCanvas';
    old.parentNode.replaceChild(fresh, old);
  }
}

// ================= Full-screen 3D lobby =================
// After room create/join, we drop the player straight into the game screen
// but with the engine in lobbyMode. Everyone can walk + paint while the host
// sees a Start button, QR code + room code in the corner. When the host
// starts, all clients play the dimension-jump cutscene then run beginMatch()
// so the same engine transitions into the real hide/hunt phases.

function startLobbyRoom() {
  showScreen('game');
  if (isFullscreenActive()) lockLandscape();
  disposePreviousEngine();
  gameEngine = new GameEngine('gameCanvas');
  gameEngine.startLobby();
  if (currentGame.duration) gameEngine.duration = currentGame.duration;
  gameEngine.initialize(currentGame.players, currentGame.playerId,
    currentGame.role === 'hider', currentGame.mapId || 'meadow');
  // Ensure the flag survives initialize() which resets gameState
  gameEngine.lobbyMode = true;
  if (typeof soundFX !== 'undefined') soundFX.startMusic(currentGame.mapId || 'meadow');

  wireLocalGameEngine();
  updatePlayersList();
  showLobbyHud(true);
}

// Show/hide the lobby HUD panels (player list, map picker, QR, start button)
function showLobbyHud(on) {
  const hud = document.getElementById('lobbyHud');
  if (!hud) return;
  if (!on) { hud.style.display = 'none'; stopLobbyTips(); return; }
  hud.style.display = 'block';
  startLobbyTips();   // teach the game while everyone waits
  // Only the host gets the whole-stage view
  const ovBtn = document.getElementById('overviewBtn');
  if (ovBtn) ovBtn.style.display = currentGame.isCreator ? '' : 'none';
  // The lobby panel already shows the QR + code, so the header button would be
  // a duplicate here — it comes back when the match starts (see _bootGame)
  const rcBtn = document.getElementById('roomCodeBtn');
  if (rcBtn) rcBtn.style.display = 'none';
  showRoomCodePanel(false);
  const isHost = currentGame.isCreator;
  document.getElementById('lobbyStartBtn').style.display = isHost ? '' : 'none';
  document.getElementById('lobbyWaiting').style.display = isHost ? 'none' : '';
  const qrBox = document.getElementById('lobbyQrBox');
  qrBox.style.display = isHost ? '' : 'none';
  const mapBox = document.getElementById('lobbyMapPickerBox');
  mapBox.style.display = isHost ? '' : 'none';
  if (isHost) {
    document.getElementById('lobbyRoomCode').textContent = currentGame.roomId || '';
    // Render the QR into the HUD (fresh — clear first)
    const qrTarget = document.getElementById('lobbyQr');
    qrTarget.innerHTML = '';
    if (typeof QRCode !== 'undefined' && currentGame.roomId) {
      const url = `${location.origin}${location.pathname}?room=${encodeURIComponent(currentGame.roomId)}`;
      new QRCode(qrTarget, { text: url, width: 140, height: 140,
        colorDark: '#000000', colorLight: '#ffffff' });
    }
    // Populate the map picker + wire change → hot-swap the lobby backdrop
    populateLobbyMapSelect();
  }
  renderLobbyList();
}

// ===== Host room code + QR (during the match) =====
// The lobby's QR disappears once the match starts, which used to leave the
// teacher with no way to read the code out to a latecomer. This panel puts it
// back on demand — host only, collapsed by default so it costs no screen space.
function showRoomCodePanel(on) {
  const panel = document.getElementById('roomCodePanel');
  const btn = document.getElementById('roomCodeBtn');
  if (!panel) return;
  // Never open it for a non-host, or before there's a room to show
  if (on && (!currentGame.isCreator || !currentGame.roomId)) return;
  panel.style.display = on ? 'block' : 'none';
  if (btn) btn.classList.toggle('active', !!on);
  if (!on) return;

  document.getElementById('roomCodeBig').textContent = currentGame.roomId;
  // Re-render the QR each time it opens: the room can change between matches,
  // and the library appends rather than replaces
  const target = document.getElementById('roomCodeQr');
  target.innerHTML = '';
  if (typeof QRCode !== 'undefined') {
    const url = `${location.origin}${location.pathname}?room=${encodeURIComponent(currentGame.roomId)}`;
    new QRCode(target, { text: url, width: 150, height: 150,
      colorDark: '#000000', colorLight: '#ffffff' });
  }
}

// Show/hide the host's 🔑 button and drop the panel when it no longer applies
function updateRoomCodeBtn() {
  const btn = document.getElementById('roomCodeBtn');
  if (!btn) return;
  const show = !!(currentGame.isCreator && currentGame.roomId);
  btn.style.display = show ? '' : 'none';
  const txt = document.getElementById('roomCodeBtnText');
  if (txt) txt.textContent = currentGame.roomId || '';
  if (!show) showRoomCodePanel(false);
}

// ===== Host monitor dashboard =====
let monitorTimer = null;

// The single source of truth for monitor mode. Called by the button and again
// after every engine rebuild (rounds rebuild the engine), so the host stays in
// the monitor across rounds instead of being dropped back into play with the
// controls still hidden.
function applyMonitor(on, announce) {
  if (!gameEngine || !gameEngine.setMonitor) return;
  currentGame.monitoring = !!on;
  gameEngine.setMonitor(!!on);
  const btn = document.getElementById('overviewBtn');
  if (btn) btn.classList.toggle('active', !!on);
  document.body.classList.toggle('monitor-mode', !!on);
  const panel = document.getElementById('monitorPanel');
  if (panel) panel.style.display = on ? 'block' : 'none';
  if (on) {
    renderMonitor();
    if (monitorTimer) clearInterval(monitorTimer);
    monitorTimer = setInterval(renderMonitor, 500);
    if (announce) showMessage('🖥️ โหมดมอนิเตอร์: ดูภาพรวมทั้งห้อง (คุณไม่ได้ร่วมเล่น)', 'success');
  } else {
    if (monitorTimer) { clearInterval(monitorTimer); monitorTimer = null; }
    if (announce) showMessage('🎮 กลับสู่มุมมองผู้เล่น', 'success');
  }
}

// Live snapshot of the class: counts, clock, and every player's role/status.
// Fed by the state the host already receives — player list, foundPlayers, the
// engine's phase — so no extra network traffic.
function renderMonitor() {
  if (!gameEngine || !gameEngine.spectator) return;
  const players = [...currentGame.players.values()].filter(p => p.id !== currentGame.playerId);

  let hiders = 0, seekers = 0, caught = 0;
  players.forEach(p => {
    if (foundPlayers.has(p.id)) caught++;
    else if (p.role === 'seeker') seekers++;
    else hiders++;
  });
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('monHiders', hiders);
  set('monSeekers', seekers);
  set('monCaught', caught);

  const phase = gameEngine.getPhase ? gameEngine.getPhase() : { phase: '', seconds: 0 };
  const s = Math.max(0, phase.seconds || 0);
  const clock = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  const phaseLabel = phase.phase === 'hide' ? '🙈 ซ่อน' : phase.phase === 'hunt' ? '🔎 ล่า' : '';
  set('monTime', clock);
  set('monRound', `รอบ ${currentGame.round || 1}/${currentGame.totalRounds || 3} · ${phaseLabel}`);

  const list = document.getElementById('monList');
  if (list) {
    list.innerHTML = '';
    players
      .slice()
      .sort((a, b) => (b.score || 0) - (a.score || 0))
      .forEach(p => {
        const isCaught = foundPlayers.has(p.id);
        const away = p.away;
        const icon = away ? '📴' : isCaught ? '🚨' : (p.role === 'seeker' ? '🔫' : '🫥');
        const row = document.createElement('div');
        row.className = 'mon-row' + (isCaught ? ' caught' : '') + (away ? ' away' : '');
        row.innerHTML = `<span class="m-ic">${icon}</span>` +
                        `<span class="m-nm">${p.username || 'ผู้เล่น'}</span>` +
                        `<span class="m-sc">${p.score || 0}</span>`;
        list.appendChild(row);
      });
    if (!players.length) {
      list.innerHTML = '<div class="mon-row"><span class="m-ic">👥</span>' +
                       '<span class="m-nm">ยังไม่มีผู้เล่นคนอื่น</span><span class="m-sc"></span></div>';
    }
  }
}

// Leaving the game screen entirely (not just between rounds) — fully exit
function stopMonitor() {
  currentGame.monitoring = false;
  if (monitorTimer) { clearInterval(monitorTimer); monitorTimer = null; }
  document.body.classList.remove('monitor-mode');
  const panel = document.getElementById('monitorPanel');
  if (panel) panel.style.display = 'none';
  const btn = document.getElementById('overviewBtn');
  if (btn) btn.classList.remove('active');
  if (gameEngine && gameEngine.spectator) gameEngine.setMonitor(false);
}

// ===== How-to-play cards, shown in the lobby while waiting to start =====
// The lobby is dead time and the game has a lot of depth nobody was told
// about, so this is where it gets taught — and players can try each one on
// the spot, since walking, painting and posing all work in here.
const HOW_TO_PLAY = [
  { icon: '🎨', title: 'ทาสีตัวเองให้กลืนกับฉาก',
    text: 'ลากเมาส์ (หรือนิ้ว) บนตัวละครเพื่อระบายสี — นี่คือหัวใจของเกม ยิ่งสีตรงกับของรอบตัว ผู้หายิ่งเล็งโดนยาก' },
  { icon: '💉', title: 'ดูดสีจากฉากมาใช้',
    text: 'กด F หรือปุ่ม "ดูดสี" แล้วคลิกที่พื้น กำแพง หรือสิ่งของ เพื่อดูดสีนั้นมาทาตัว — วิธีพรางที่เนียนที่สุด' },
  { icon: '🦎', title: 'ดูมาตรวัดความเนียน',
    text: 'ตอนเล่นจะมีแถบ 🦎 บอกว่าตอนนี้คุณกลืนกับที่ซ่อนแค่ไหน แดง = โดดเด่นมาก เขียว = เนียนแล้ว' },
  { icon: '🧍', title: 'เลือกท่าโพส + แปะผนัง',
    text: 'คลิกขวา (หรือปุ่มท่าโพส) เพื่อเปลี่ยนท่า ท่าแนบผนังจะทำให้ดูเหมือนเป็นส่วนหนึ่งของฉาก' },
  { icon: '⚡', title: 'ตอบคำถาม = ได้พลังพิเศษ',
    text: 'ตอบถูกจะได้พลังงาน ⚡ เอาไปแลกความสามารถ เช่น พรางอัตโนมัติ หุ่นล่อ ล่องหน แปลงร่างเป็นถัง' },
  { icon: '🧟', title: 'โดนจับแล้วไม่ตกรอบ',
    text: 'ถ้าโดนจับ คุณจะกลายเป็นผู้หาทันที ได้ปืนไปช่วยล่าคนอื่นต่อ ไม่ต้องนั่งดูเฉยๆ' },
  { icon: '🏆', title: 'เล่นหลายรอบ สลับบทบาท',
    text: 'แต่ละแมตช์มีหลายรอบ ทุกคนได้เป็นทั้งผู้ซ่อนและผู้หา คะแนนสะสมข้ามรอบ ลุ้นกันจนจบ' }
];
let tipIndex = 0;
let tipTimer = null;

function renderTip() {
  const body = document.getElementById('tipBody');
  const dots = document.getElementById('tipDots');
  const count = document.getElementById('tipCount');
  if (!body) return;
  const t = HOW_TO_PLAY[tipIndex];
  body.innerHTML = `<div class="tip-icon">${t.icon}</div>` +
                   `<div><div class="tip-title">${t.title}</div>` +
                   `<div class="tip-text">${t.text}</div></div>`;
  if (count) count.textContent = `${tipIndex + 1}/${HOW_TO_PLAY.length}`;
  if (dots) {
    dots.innerHTML = '';
    HOW_TO_PLAY.forEach((_, i) => {
      const d = document.createElement('span');
      d.className = 'tip-dot' + (i === tipIndex ? ' on' : '');
      dots.appendChild(d);
    });
  }
}

function stepTip(delta) {
  tipIndex = (tipIndex + delta + HOW_TO_PLAY.length) % HOW_TO_PLAY.length;
  renderTip();
}

// Set once the player closes the card. Rounds and map changes rebuild the
// lobby HUD, and without this the tips would pop back up every time — on a
// phone the card covers the room QR and the player list, so having it return
// uninvited is worse than not being able to close it at all.
let tipsDismissed = false;

function startLobbyTips() {
  const box = document.getElementById('lobbyTips');
  if (!box) return;
  if (tipsDismissed) { box.style.display = 'none'; return; }
  box.style.display = 'block';
  renderTip();
  if (!box.dataset.wired) {
    box.dataset.wired = '1';
    const prev = document.getElementById('tipPrev');
    const next = document.getElementById('tipNext');
    // Manual paging restarts the auto-advance so it doesn't yank the card away
    const manual = (d) => { stepTip(d); restartTipTimer(); };
    if (prev) prev.addEventListener('click', () => manual(-1));
    if (next) next.addEventListener('click', () => manual(1));
    const close = document.getElementById('tipClose');
    if (close) close.addEventListener('click', () => { tipsDismissed = true; stopLobbyTips(); });
  }
  restartTipTimer();
}

function restartTipTimer() {
  if (tipTimer) clearInterval(tipTimer);
  tipTimer = setInterval(() => stepTip(1), 7000);
}

function stopLobbyTips() {
  if (tipTimer) { clearInterval(tipTimer); tipTimer = null; }
  const box = document.getElementById('lobbyTips');
  if (box) box.style.display = 'none';
}

// Fill the lobby map dropdown from the engine's map registry and wire it up.
// Changing it hot-swaps the 3D lobby scene so the host can preview each map.
function populateLobbyMapSelect() {
  const sel = document.getElementById('lobbyMapSelect');
  if (!sel || typeof GAME_MAPS === 'undefined') return;
  if (!sel.options.length) {
    Object.keys(GAME_MAPS).forEach(id => {
      const opt = document.createElement('option');
      opt.value = id;
      opt.textContent = GAME_MAPS[id].name;
      sel.appendChild(opt);
    });
    sel.addEventListener('change', () => {
      currentGame.mapId = sel.value;
      // Rebuild the lobby scene on the picked map without disposing the room
      if (gameEngine && gameEngine.lobbyMode) startLobbyRoom();
    });
  }
  sel.value = currentGame.mapId || 'meadow';
}

function renderLobbyList() {
  const list = document.getElementById('lobbyPlayerList');
  if (!list) return;
  list.innerHTML = '';
  currentGame.players.forEach(p => {
    const li = document.createElement('li');
    const icon = p.role === 'seeker' ? '🔫' : '🎨';
    const me = p.id === currentGame.playerId ? ' 👑' : '';
    li.textContent = `${icon} ${p.username}${me}`;
    if (p.id === currentGame.playerId) li.classList.add('me');
    list.appendChild(li);
  });
  document.getElementById('lobbyCount').textContent = currentGame.players.size;
  // Mirror the count on the compact header pill (mobile-only)
  const pill = document.getElementById('lobbyToggleCount');
  if (pill) pill.textContent = currentGame.players.size;
}

// Compact-HUD toggles for phones: the paint toolbar and lobby panel are
// collapsed by default (see CSS) — these header buttons expand them.
function setupMobileHudToggles() {
  if (setupMobileHudToggles._done) return;
  setupMobileHudToggles._done = true;
  const paintBtn = document.getElementById('paintToggleBtn');
  const lobbyBtn = document.getElementById('lobbyToggleBtn');
  const closeBothIfOutside = (target) => {
    if (!target.closest('.paint-toolbar, #paintToggleBtn')) {
      document.getElementById('paintToolbar').classList.remove('open');
    }
    if (!target.closest('#lobbyPanel, #lobbyToggleBtn')) {
      document.getElementById('lobbyPanel').classList.remove('open');
    }
  };
  if (paintBtn) paintBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    document.getElementById('paintToolbar').classList.toggle('open');
    document.getElementById('lobbyPanel').classList.remove('open');
  });
  if (lobbyBtn) lobbyBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    document.getElementById('lobbyPanel').classList.toggle('open');
    document.getElementById('paintToolbar').classList.remove('open');
  });
  // Tap anywhere on the game canvas closes both panels
  document.addEventListener('touchstart', (e) => closeBothIfOutside(e.target), { passive: true });
  document.addEventListener('click', (e) => closeBothIfOutside(e.target));
}

// After 5 seconds fade out the bottom role tip so it doesn't cover the play
// area forever (mobile only — desktop keeps the hint since space is plenty)
function scheduleRoleInfoFade() {
  if (!('ontouchstart' in window) && navigator.maxTouchPoints === 0) return;
  clearTimeout(scheduleRoleInfoFade._t);
  roleInfo.classList.remove('role-fade');
  scheduleRoleInfoFade._t = setTimeout(() => roleInfo.classList.add('role-fade'), 5000);
}

// Called on both host + joiners when game_state_changed('playing') fires
function transitionLobbyToMatch() {
  showLobbyHud(false);
  playDimensionJump(() => {
    // Rebuild the engine on the real map with a fresh startTime so the
    // hide-phase countdown begins now. Cleanest way to switch maps without
    // fiddling with dispose/reinit inside the running scene.
    _bootGame();
  });
}

function startGameScreen() {
  // Legacy entry (kept in case an old code path still calls it): play the
  // cutscene then boot the game
  playDimensionJump(() => _bootGame());
}

// Show the cutscene overlay, sync layered audio, call cb when done
function playDimensionJump(cb) {
  const overlay = document.getElementById('dimensionJump');
  if (!overlay) { cb(); return; }
  // Restart the CSS animations by re-attaching the node
  const fresh = overlay.cloneNode(true);
  overlay.parentNode.replaceChild(fresh, overlay);
  fresh.style.display = 'flex';
  const durSec = (typeof soundFX !== 'undefined' && soundFX.dimensionJump) ? soundFX.dimensionJump() : 2.4;
  // Hide the overlay a hair after the CSS peak so the game reveal is snappy
  setTimeout(() => { fresh.style.display = 'none'; cb(); }, durSec * 1000);
}

function _bootGame() {
  // Show the game screen so the canvas container has real dimensions
  showScreen('game');
  showLobbyHud(false);

  // Phones went fullscreen at the join/start tap but stayed portrait for the
  // lobby — flip to landscape now that the match is actually starting
  if (isFullscreenActive()) lockLandscape();

  // Dispose the lobby engine before swapping in the match engine on the same
  // canvas — otherwise the old WebGL context / RAF loop paints over ours
  disposePreviousEngine();
  gameEngine = new GameEngine('gameCanvas');
  if (currentGame.duration) gameEngine.duration = currentGame.duration;
  gameEngine.initialize(currentGame.players, currentGame.playerId, currentGame.role === 'hider', currentGame.mapId);

  // Kick off the generative background music for this map
  if (typeof soundFX !== 'undefined') soundFX.startMusic(currentGame.mapId || 'meadow');

  wireLocalGameEngine();
}

// Everything the game engine needs wired to the UI + WebSocket. Called from
// both the lobby (engine in lobbyMode) and the real match boot.
function wireLocalGameEngine() {
  paintToolbar.style.display = 'flex';
  gameEngine.setPaintColor(paintState.color);
  gameEngine.setBrushSize(parseInt(brushSizeInput.value, 10));

  // The host keeps the monitor button through the whole session (lobby + match)
  const monBtn = document.getElementById('overviewBtn');
  if (monBtn) monBtn.style.display = currentGame.isCreator ? '' : 'none';
  // ...and the room-code button, so a latecomer can always be let in. Rounds
  // rebuild the engine, so this re-runs and the button survives them.
  updateRoomCodeBtn();
  // Rounds rebuild the engine — re-apply monitor mode onto the new one so the
  // host isn't dropped back into play with the HUD still hidden. Only the host
  // can monitor, so nobody else touches this.
  if (currentGame.isCreator && currentGame.monitoring) applyMonitor(true, false);

  // Eyedropper callbacks: sucked color becomes a usable swatch
  gameEngine.onColorSucked = (hex) => {
    paintState.sampledColor = hex;
    paintState.color = hex;
    if (colorPicker) colorPicker.value = hex;
    renderColorPalette();
    updateEyedropperUI(false);
    showMessage(`ดูดสีสำเร็จ! ${hex} — ลากทาตัวหรือกด "ทาทั้งตัว" ได้เลย`, 'success');
  };
  gameEngine.onEyedropperToggle = (on) => updateEyedropperUI(on);
  renderColorPalette();
  updatePowersDisplay();

  if (currentGame.role === 'hider') {
    roleInfo.textContent = '🎨 Hider — WASD เดิน · ลากบนตัววาดลาย · คลิกขวาเลือกท่าโพส · Space กระโดด';
  } else {
    roleInfo.textContent = '👁️ Seeker — ช่วงรอ: ทาสีตัวเองได้! · หลังเริ่มล่า: คลิกยิงเลเซอร์ 🌈';
    // Swap the HUD hints for the seeker role
    const hints = document.getElementById('controlHints');
    if (hints) {
      hints.innerHTML = `
        <div><span class="hud-key">WASD</span> เดิน (กล้องตามเอง)</div>
        <div><span class="hud-key">Space</span> กระโดด</div>
        <div><span class="hud-key">Q / E</span> หมุนกล้อง</div>
        <div><span class="hud-key">ลูกกลิ้ง</span> ซูม</div>
        <div><span class="hud-key">คลิก</span> ยิงเลเซอร์ 🌈</div>`;
    }
  }
  // On phones the role tip fades after a few seconds so it doesn't crowd HUD
  scheduleRoleInfoFade();

  // HUD: status + remaining hiders
  hideStatus.textContent = currentGame.role === 'hider' ? '🫥 ซ่อนตัวต่อไป!' : '🔍 ตามหา Hider!';
  const hiderCount = [...currentGame.players.values()].filter(p => p.role === 'hider').length;
  remainingNumber.textContent = hiderCount || currentGame.players.size;
  foundPlayers.clear();
  const co = document.getElementById('caughtOverlay');
  if (co) { co.style.display = 'none'; co.style.opacity = '1'; }

  // ===== Multiplayer presence =====
  // Spawn every other player's character in this world
  currentGame.players.forEach((p, id) => {
    if (id !== currentGame.playerId) gameEngine.addRemotePlayer(id, p.username, p.role);
  });

  // Relay my paint strokes so others see my camouflage
  gameEngine.onPaintStroke = (stroke) => {
    wsClient.broadcastAction(currentGame.roomId, currentGame.playerId, 'paint', stroke);
  };

  // My laser found a hider → tell everyone. Only credit myself if my shot is
  // actually the one that catches them: if another seeker's found broadcast
  // arrived first this frame, the hider is already in foundPlayers and my
  // shot is redundant — should not add a catch to my score.
  gameEngine.onPlayerFound = (targetId) => {
    const already = foundPlayers.has(targetId);
    wsClient.broadcastAction(currentGame.roomId, currentGame.playerId, 'found', { targetId });
    if (!already) roundCatches[currentGame.playerId] = (roundCatches[currentGame.playerId] || 0) + 1;
    handlePlayerFound(targetId);
  };

  // My laser beam → everyone sees the shot
  gameEngine.onLaserShot = (beam) => {
    wsClient.broadcastAction(currentGame.roomId, currentGame.playerId, 'shoot', beam);
  };

  // Abilities that change how I look (ล่องหน / แปลงร่าง / หุ่นล่อ) only work if
  // the other players' screens show them too
  gameEngine.onAbility = (payload) => {
    wsClient.broadcastAction(currentGame.roomId, currentGame.playerId, 'ability', payload);
  };

  // Host went into/out of monitor mode → others take the teacher off the stage
  gameEngine.onSpectator = (on) => {
    wsClient.broadcastAction(currentGame.roomId, currentGame.playerId, 'spectator', { on: !!on });
  };

  // Lost the GPU context (seen on iPads): rebuild the scene rather than leave
  // the player staring at a black screen with a working HUD. The round clock
  // is carried over so recovery doesn't hand them a fresh timer.
  gameEngine.onContextLost = () => {
    if (currentGame._recovering) return;
    // Safety net: if rebooting doesn't stick, stop trying rather than flashing
    // the same warning forever
    currentGame._recoverTries = (currentGame._recoverTries || 0) + 1;
    if (currentGame._recoverTries > 2) {
      showMessage('⚠️ กราฟิกมีปัญหา ลองรีเฟรชหน้าเว็บดูครับ', 'error');
      return;
    }
    currentGame._recovering = true;
    const keepStart = gameEngine.startTime;
    const wasLobby = !!gameEngine.lobbyMode;
    showMessage('⚠️ ภาพหลุด กำลังกู้คืน...', 'error');
    setTimeout(() => {
      // Rebuild whichever scene we were in — booting a match out of the lobby
      // would drop the host straight past the waiting room
      if (wasLobby) startLobbyRoom();
      else {
        _bootGame();
        if (gameEngine && keepStart) gameEngine.startTime = keepStart;
      }
      currentGame._recovering = false;
    }, 400);
  };

  // Broadcast my position ~6.7x/sec, but skip sends when nothing meaningful
  // changed (e.g. standing still during the hide phase). With 15-20 players
  // in a room, a naive fixed-rate broadcast fans out O(n^2) messages/sec and
  // is the main thing that made large rooms freeze/disconnect — most of
  // those messages were idle players re-sending the same position. A
  // heartbeat still fires periodically so late state never goes stale.
  let lastSentMove = null;
  let ticksSinceMoveSend = 0;
  if (currentGame.moveInterval) clearInterval(currentGame.moveInterval);
  currentGame.moveInterval = setInterval(() => {
    if (!gameEngine || gameEngine.gameState !== 'playing') return;
    const cur = {
      x: +gameEngine.character.position.x.toFixed(2),
      z: +gameEngine.character.position.z.toFixed(2),
      ry: +gameEngine.character.rotation.y.toFixed(2),
      pose: gameEngine.currentPose || 'stand',
      jumpY: +(gameEngine.jumpY || 0).toFixed(2)
    };
    ticksSinceMoveSend++;
    const changed = !lastSentMove
      || Math.abs(cur.x - lastSentMove.x) > 0.03
      || Math.abs(cur.z - lastSentMove.z) > 0.03
      || Math.abs(cur.ry - lastSentMove.ry) > 0.03
      || Math.abs(cur.jumpY - lastSentMove.jumpY) > 0.03
      || cur.pose !== lastSentMove.pose;
    // Force a heartbeat every ~1.5s even when idle, in case a packet was lost
    const heartbeatDue = ticksSinceMoveSend >= 10;
    if (!changed && !heartbeatDue) return;

    lastSentMove = cur;
    ticksSinceMoveSend = 0;
    wsClient.broadcastAction(currentGame.roomId, currentGame.playerId, 'move', cur);
  }, 150);

  // Load questions once; player triggers them manually via the button
  loadGameQuestions();

  // Round bookkeeping (round 1 unless the server has moved us on)
  currentGame.round = currentGame.round || 1;
  currentGame.totalRounds = currentGame.totalRounds || DEFAULT_ROUNDS;
  roundCatches = roundCatches || {};

  // Fresh match — abilities start unpowered; answer questions to earn energy
  if (currentGame.round === 1) abilityState.energy = 0;
  renderAbilityBar();
  if (currentGame.abilityInterval) clearInterval(currentGame.abilityInterval);
  currentGame.abilityInterval = setInterval(updateAbilityHud, 250);

  // Show/refresh the mobile touch controls
  setupMobileControls();

  // Two-phase timer: 2-min hide countdown, then the hunt countdown
  let lastPhase = null;
  const timerInterval = setInterval(() => {
    if (!gameEngine) return;
    const { phase, seconds } = gameEngine.getPhase();
    const m = Math.floor(seconds / 60);
    const s = (seconds % 60).toString().padStart(2, '0');
    timerDisplay.textContent = `${m}:${s}`;

    if (phase === 'lobby') {
      // Pre-match lobby: no countdown, just chill
      timerDisplay.textContent = '⏳';
      timerDisplay.style.color = '#9fd0ff';
      hideStatus.textContent = currentGame.isCreator
        ? '👑 กดเริ่มเกมเมื่อพร้อม'
        : '⏳ รอเจ้าของห้องกดเริ่มเกม...';
    } else if (phase === 'hide') {
      timerDisplay.style.color = '#ffd54f';
      hideStatus.textContent = currentGame.role === 'hider'
        ? `🏃 รีบซ่อน! ผู้ตามเริ่มค้นใน ${m}:${s}`
        : `⏳ รอผู้ซ่อน... เริ่มค้นใน ${m}:${s}`;
    } else {
      timerDisplay.style.color = '';
      if (lastPhase === 'hide') {
        // Hunt just started
        showMessage(currentGame.role === 'hider' ? '🚨 ผู้ตามเริ่มค้นแล้ว!' : '🔫 เริ่มล่าได้!', 'error');
        hideStatus.textContent = currentGame.role === 'hider' ? '🫥 ซ่อนตัวต่อไป!' : '🔍 ตามหา Hider!';
        if (typeof soundFX !== 'undefined') soundFX.huntStart();
      }
      // Countdown ticks in the last 10s
      if (seconds > 0 && seconds <= 10 && typeof soundFX !== 'undefined') soundFX.tick();
      if (seconds === 0) {
        clearInterval(timerInterval);
        endGame();
      }
    }
    lastPhase = phase;
  }, 100);

  // Store interval for cleanup
  currentGame.timerInterval = timerInterval;
}

// ===== Fullscreen mode (mainly for phones) =====
function isFullscreenActive() {
  return !!(document.fullscreenElement || document.webkitFullscreenElement);
}

function enterFullscreen() {
  const el = document.documentElement;
  const req = el.requestFullscreen || el.webkitRequestFullscreen;
  if (!req) return;
  try {
    const p = req.call(el);
    if (p && p.catch) p.catch(() => {});
  } catch (e) { /* unsupported — ignore */ }
}

// Landscape suits the joystick + button layout, but only once the match is
// actually on screen — the lobby stays portrait (Android; iOS ignores lock)
function lockLandscape() {
  if (screen.orientation && screen.orientation.lock) {
    screen.orientation.lock('landscape').catch(() => {});
  }
}

function exitFullscreen() {
  const exit = document.exitFullscreen || document.webkitExitFullscreen;
  if (exit) { try { exit.call(document); } catch (e) {} }
}

function setupFullscreen() {
  const btn = document.getElementById('fullscreenBtn');
  const supported = document.fullscreenEnabled ||
    !!document.documentElement.webkitRequestFullscreen;
  if (!supported) { btn.style.display = 'none'; return; } // e.g. iPhone Safari
  btn.addEventListener('click', () => {
    if (isFullscreenActive()) exitFullscreen(); else enterFullscreen();
  });
  const onFsChange = () => {
    btn.textContent = isFullscreenActive() ? '🡼' : '⛶';
    // Flip to landscape only if the match is already on screen (lobby = portrait)
    const inGame = document.getElementById('gameScreen').classList.contains('active');
    if (isFullscreenActive() && inGame) lockLandscape();
    // Canvas must re-measure its container after the viewport jump
    if (gameEngine && gameEngine._onResize) setTimeout(() => gameEngine._onResize(), 150);
  };
  document.addEventListener('fullscreenchange', onFsChange);
  document.addEventListener('webkitfullscreenchange', onFsChange);
}

// ===== Mobile touch controls (joystick + buttons) =====
let mobileWired = false;
function setupMobileControls() {
  const mc = document.getElementById('mobileControls');
  const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
  if (!isTouch) { mc.style.display = 'none'; return; }
  mc.style.display = 'block';

  // Declutter for touch: keyboard hints are useless, and the player counter
  // must not sit under the action buttons
  const hints = document.getElementById('controlHints');
  if (hints) hints.style.display = 'none';
  // Positioned via CSS (see .remaining-touch) rather than inline styles, so the
  // tablet media query can move it clear of the taller ability strip
  const rc = document.getElementById('remainingCount');
  if (rc) rc.classList.add('remaining-touch');

  // Action button label depends on role
  const actionBtn = document.getElementById('mobAction');
  if (currentGame.role === 'hider') actionBtn.innerHTML = '🧍<span>ท่าโพส</span>';
  else actionBtn.innerHTML = '🔫<span>ยิง</span>';

  // Paint mode only makes sense for whoever may paint right now (hiders, and
  // everyone during the lobby / hide phase)
  const paintBtn = document.getElementById('mobPaint');
  if (paintBtn) {
    const canPaint = !gameEngine || gameEngine.lobbyMode || currentGame.role === 'hider';
    paintBtn.style.display = canPaint ? 'flex' : 'none';
  }

  if (mobileWired) return; // wire the listeners only once
  mobileWired = true;

  // --- Ability strip: tap the pill to slide the abilities out / fold them back ---
  const abHead = document.getElementById('abilityHead');
  if (abHead) {
    abHead.addEventListener('click', () => {
      const panel = document.querySelector('.ability-panel');
      if (panel) panel.classList.toggle('expanded');
    });
  }

  // --- Virtual joystick ---
  // Touch anywhere in the lower-left zone and the stick appears under your
  // thumb (no need to hit the small circle). A dead zone + fast ramp means
  // full speed without shoving the knob all the way to the rim.
  const base = document.getElementById('joystick');
  const knob = document.getElementById('joystickKnob');
  const zone = document.getElementById('joyZone');
  // Travel radius follows the rendered size — tablets render a bigger stick
  // (see the min-width:760px rules), and a fixed 58px would leave the knob
  // stranded near the middle of it.
  const radius = () => Math.max(40, base.offsetWidth / 2 - 14);
  let touchId = null;
  const setKnob = (dx, dy) => {
    const R = radius();
    const dist = Math.min(R, Math.hypot(dx, dy));
    const ang = Math.atan2(dy, dx);
    const kx = Math.cos(ang) * dist, ky = Math.sin(ang) * dist;
    knob.style.transform = `translate(${kx}px, ${ky}px)`;
    // 10% dead zone, full speed from 75% extension
    const norm = Math.min(1, Math.max(0, (dist / R - 0.1) / 0.65));
    if (gameEngine) gameEngine.setMoveInput(Math.cos(ang) * norm, Math.sin(ang) * norm);
  };
  const resetJoy = () => {
    knob.style.transform = 'translate(0,0)';
    if (gameEngine) gameEngine.setMoveInput(0, 0);
    touchId = null;
  };
  const joyAt = (t) => {
    const r = base.getBoundingClientRect();
    setKnob(t.clientX - (r.left + r.width / 2), t.clientY - (r.top + r.height / 2));
  };
  // Reposition the stick under the first touch inside the zone
  const summonJoy = (e) => {
    const t = e.changedTouches[0];
    touchId = t.identifier;
    const pr = mc.getBoundingClientRect();
    const half = base.offsetWidth / 2;
    base.style.left = (t.clientX - pr.left - half) + 'px';
    base.style.top = (t.clientY - pr.top - half) + 'px';
    base.style.bottom = 'auto';
    setKnob(0, 0);
    e.preventDefault();
  };
  zone.addEventListener('touchstart', summonJoy, { passive: false });
  base.addEventListener('touchstart', (e) => { touchId = e.changedTouches[0].identifier; joyAt(e.changedTouches[0]); e.preventDefault(); }, { passive: false });
  window.addEventListener('touchmove', (e) => {
    if (touchId === null) return;
    for (const t of e.changedTouches) if (t.identifier === touchId) { joyAt(t); e.preventDefault(); }
  }, { passive: false });
  window.addEventListener('touchend', (e) => {
    for (const t of e.changedTouches) if (t.identifier === touchId) resetJoy();
  });
  window.addEventListener('touchcancel', resetJoy);

  // --- Jump / climb (hold to keep climbing a wall) ---
  const jumpBtn = document.getElementById('mobJump');
  jumpBtn.addEventListener('touchstart', (e) => {
    e.preventDefault(); if (gameEngine) { gameEngine.requestJump(); gameEngine.setJumpHeld(true); }
  }, { passive: false });
  const jumpRelease = () => { if (gameEngine) gameEngine.setJumpHeld(false); };
  jumpBtn.addEventListener('touchend', jumpRelease);
  jumpBtn.addEventListener('touchcancel', jumpRelease);

  // --- Action (shoot for seeker in-match / pose wheel otherwise) ---
  actionBtn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (!gameEngine) return;
    // In the lobby anyone can pose; in-match hiders pose, seekers shoot
    if (gameEngine.lobbyMode || gameEngine.isHider) {
      togglePoseWheel();
    } else {
      gameEngine.shootCenter();
    }
  }, { passive: false });

  // --- Question button (both roles, always on screen) ---
  const quizBtn = document.getElementById('mobQuestion');
  if (quizBtn) {
    quizBtn.addEventListener('touchstart', (e) => { e.preventDefault(); askQuestion(); }, { passive: false });
  }

  // --- Paint mode toggle: while on, dragging your body paints; while off,
  // dragging anywhere turns the camera (the default, so looking around is easy)
  if (paintBtn) {
    paintBtn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      if (!gameEngine) return;
      gameEngine.paintMode = !gameEngine.paintMode;
      paintBtn.classList.toggle('on', gameEngine.paintMode);
      showMessage(gameEngine.paintMode
        ? '🖌️ โหมดทาสี: ลากบนตัวเองเพื่อระบายสี'
        : '🎥 โหมดกล้อง: ลากเพื่อหมุนกล้อง', 'success');
    }, { passive: false });
  }

  // --- Hold-to-rotate camera ---
  const holdRotate = (id, dir) => {
    const btn = document.getElementById(id);
    let iv = null;
    // Ramps up while held: a gentle nudge for fine aiming, then a fast sweep
    // when you're turning to look somewhere else
    const start = (e) => {
      e.preventDefault();
      if (iv) return;
      let held = 0;
      iv = setInterval(() => {
        if (!gameEngine) return;
        held++;
        const speed = Math.min(0.09, 0.028 + held * 0.0016);
        gameEngine._camDragging = true;
        gameEngine.rotateCamera(dir * speed);
      }, 16);
    };
    const stop = () => { if (iv) clearInterval(iv); iv = null; if (gameEngine) gameEngine._camDragging = false; };
    btn.addEventListener('touchstart', start, { passive: false });
    btn.addEventListener('touchend', stop);
    btn.addEventListener('touchcancel', stop);
  };
  holdRotate('mobRotL', 1);
  holdRotate('mobRotR', -1);

  // --- Hold-to-zoom (pinch on the canvas also works) ---
  const holdZoom = (id, dir) => {
    const btn = document.getElementById(id);
    let iv = null;
    const start = (e) => { e.preventDefault(); if (iv) return; iv = setInterval(() => { if (gameEngine) gameEngine.zoomCamera(dir * 0.3); }, 16); };
    const stop = () => { if (iv) clearInterval(iv); iv = null; };
    btn.addEventListener('touchstart', start, { passive: false });
    btn.addEventListener('touchend', stop);
    btn.addEventListener('touchcancel', stop);
  };
  holdZoom('mobZoomIn', -1);
  holdZoom('mobZoomOut', 1);
}

// Read the game duration in seconds, honouring the custom option
function readDurationSeconds() {
  if (durationSelect.value === 'custom') {
    const mins = Math.max(1, Math.min(180, parseInt(customDuration.value, 10) || 7));
    return mins * 60;
  }
  return parseInt(durationSelect.value, 10) || 300;
}

// Show/hide the custom-minutes input when "กำหนดเอง" is picked
function setupDurationPicker() {
  durationSelect.addEventListener('change', () => {
    customDurationRow.style.display = durationSelect.value === 'custom' ? 'flex' : 'none';
  });
}

// Load question sets from the API and wire up the picker window
async function populateQuestionSets() {
  questionSetBtn.addEventListener('click', openQuestionSetModal);
  document.getElementById('closeQuestionSetModal').addEventListener('click', closeQuestionSetModal);
  questionSetModal.addEventListener('click', (e) => { if (e.target === questionSetModal) closeQuestionSetModal(); });
  questionSetSearch.addEventListener('input', renderQuestionSetList);

  try {
    const [setsRes, allQuestions] = await Promise.all([
      fetch('/api/questions/sets').then(r => r.json()),
      questionManager.loadQuestions().catch(() => [])
    ]);
    // Count questions per set so the picker shows how big each set is
    const counts = {};
    (allQuestions || []).forEach(q => {
      const k = String(q.question_set_id);
      counts[k] = (counts[k] || 0) + 1;
    });
    questionSets = (setsRes || []).map(s => ({ ...s, count: counts[String(s.id)] || 0 }));
  } catch (error) {
    console.error('Failed to load question sets:', error);
    questionSets = [];
  }
  renderQuestionSetList();
}

function openQuestionSetModal() {
  questionSetSearch.value = '';
  renderQuestionSetList();
  questionSetModal.style.display = 'flex';
}
function closeQuestionSetModal() { questionSetModal.style.display = 'none'; }

// Render the searchable list of sets as clickable cards
function renderQuestionSetList() {
  const q = (questionSetSearch.value || '').trim().toLowerCase();
  const totalQuestions = questionSets.reduce((a, s) => a + s.count, 0);
  const items = [{ id: '', name: '📚 ทุกชุด (ทั้งหมด)', description: 'รวมข้อสอบจากทุกชุด', count: totalQuestions, subject: '' }]
    .concat(questionSets);
  const filtered = q
    ? items.filter(s => (s.name + ' ' + (s.subject || '') + ' ' + (s.description || '')).toLowerCase().includes(q))
    : items;

  questionSetList.innerHTML = '';
  if (!filtered.length) {
    questionSetList.innerHTML = '<div class="picker-empty">ไม่พบชุดข้อสอบที่ค้นหา</div>';
    return;
  }
  filtered.forEach(s => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'picker-card' + (String(s.id) === String(selectedQuestionSet.id) ? ' selected' : '');
    const meta = [s.subject, `${s.count} ข้อ`].filter(Boolean).join(' · ');
    card.innerHTML = `
      <div class="picker-card-main">
        <span class="picker-card-name">${escapeHtml(s.name)}</span>
        <span class="picker-card-meta">${escapeHtml(meta)}</span>
      </div>
      ${s.description ? `<div class="picker-card-desc">${escapeHtml(s.description)}</div>` : ''}
      ${String(s.id) === String(selectedQuestionSet.id) ? '<span class="picker-check">✓</span>' : ''}
    `;
    card.addEventListener('click', () => {
      selectedQuestionSet = { id: s.id, name: s.name };
      questionSetBtn.textContent = s.name;
      closeQuestionSetModal();
    });
    questionSetList.appendChild(card);
  });
}

function escapeHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Load questions once and keep them; the player triggers each one manually.
// Filters to the chosen question set if one was selected.
async function loadGameQuestions() {
  try {
    const all = await questionManager.loadQuestions();
    loadedQuestions = currentGame.questionSetId
      ? all.filter(q => String(q.question_set_id) === String(currentGame.questionSetId))
      : all;
  } catch (error) {
    console.error('Error loading questions:', error);
    loadedQuestions = [];
  }
}

// Show a random question when the player asks for one
function askQuestion() {
  if (loadedQuestions && loadedQuestions.length > 0) {
    questionManager.displayRandomQuestion(loadedQuestions);
  } else {
    showMessage('ยังไม่มีคำถามในระบบ — ครูเพิ่มได้ที่หน้า Admin', 'error');
  }
}

async function handleSubmitAnswer() {
  const isCorrect = await questionManager.validateAnswer();
  if (isCorrect === null) return;
  const answeredQuestion = questionManager.currentQuestion;
  const userAnswer = questionManager.getSelectedAnswer();
  loadedQuestions = loadedQuestions.filter(question => question.id !== answeredQuestion.id);

  if (isCorrect) {
    gameEngine.score += 10;
    if (typeof soundFX !== 'undefined') soundFX.correct();

    // Reward: energy to spend on special abilities (harder question → more),
    // plus a new paint colour while any are still locked
    const diff = (questionManager.currentQuestion || {}).difficulty;
    const gained = ENERGY_BY_DIFFICULTY[diff] || 1;
    abilityState.energy += gained;

    let rewardMsg = `✓ ถูกต้อง! +10 คะแนน · ได้พลังงาน ⚡${gained}`;
    if (paintState.unlockedCount < ALL_COLORS.length) {
      paintState.unlockedCount++;
      rewardMsg += ` — ปลดล็อกสีใหม่! 🎨`;
    }

    renderColorPalette();
    updatePowersDisplay();
    showMessage(rewardMsg, 'success');
  } else {
    gameEngine.score = Math.max(0, gameEngine.score - 5);
    if (typeof soundFX !== 'undefined') soundFX.wrong();
    showMessage('✗ ยังไม่ถูก ลองใหม่นะ', 'error');
  }

  scoreDisplay.textContent = gameEngine.score;
  questionManager.hideModal();

  wsClient.send({
    type: 'question_answered',
    roomId: currentGame.roomId,
    questionId: answeredQuestion.id,
    userAnswer
  });
}

function handleLeaveRoom() {
  leaveRoom();
  showScreen('welcome');
}

function leaveRoom() {
  clearSession();   // an intentional leave shouldn't auto-rejoin on next load
  if (typeof soundFX !== 'undefined') soundFX.stopMusic();
  if (currentGame.timerInterval) {
    clearInterval(currentGame.timerInterval);
  }
  if (currentGame.moveInterval) {
    clearInterval(currentGame.moveInterval);
  }
  if (currentGame.abilityInterval) {
    clearInterval(currentGame.abilityInterval);
  }
  const radar = document.getElementById('radarHud');
  if (radar) radar.style.display = 'none';
  const meter = document.getElementById('blendMeter');
  if (meter) meter.style.display = 'none';
  const vig = document.getElementById('dangerVignette');
  if (vig) vig.style.opacity = 0;
  stopMonitor();
  if (gameEngine) {
    gameEngine.stop();
  }
  currentGame = {
    roomId: null,
    username: null,
    playerId: null,
    role: null,
    isCreator: false,
    players: new Map()
  };
  updateRoomCodeBtn();   // no room, no host → drop the 🔑 button and its panel
}

// Points for the round just played. Everyone is paid for catches (the infected
// pack included); surviving to the end is worth the most; a caught hider still
// takes something home for the time they lasted.
function computeRoundScores() {
  const out = [];
  currentGame.players.forEach(p => {
    let pts = 40 * (roundCatches[p.id] || 0);
    if (foundPlayers.has(p.id)) pts += 30;
    else if (p.role === 'hider') pts += 100;
    out.push({ id: p.id, points: pts, round: pts });
  });
  return out;
}

// Between rounds: show the standings, then the host asks the server to rotate
// roles and kick off the next one.
function endRound() {
  if (currentGame.timerInterval) clearInterval(currentGame.timerInterval);
  if (typeof soundFX !== 'undefined') soundFX.stopMusic();
  const scores = computeRoundScores();
  showRoundScoreboard(scores);
  if (currentGame.isCreator) {
    setTimeout(() => {
      wsClient.send({
        type: 'next_round',
        roomId: currentGame.roomId,
        totalRounds: currentGame.totalRounds || DEFAULT_ROUNDS,
        scores
      });
    }, 4500);
  }
}

function endGame() {
  gameEngine.endGame();
  // More rounds to play? Roll into the scoreboard instead of ending the match
  if ((currentGame.round || 1) < (currentGame.totalRounds || DEFAULT_ROUNDS)) {
    endRound();
    return;
  }
  showScreen('gameOver');
  displayResults();
  // Stop the music and play a jingle: seekers who caught someone (or hiders
  // who survived the timer) get victory, everyone else gets defeat
  if (typeof soundFX !== 'undefined') {
    soundFX.stopMusic();
    const iAmHider = currentGame.role === 'hider';
    const iSurvived = iAmHider && !foundPlayers.has(currentGame.playerId);
    if (iSurvived || !iAmHider) soundFX.victory(); else soundFX.defeat();
  }
}

function displayResults() {
  const resultsList = document.getElementById('resultsList');
  resultsList.innerHTML = '';

  // Use each player's synced score (match_over and round_start write it onto
  // currentGame.players). Forcing every remote player to 0 turned the final
  // leaderboard into "you: N, everyone else: 0" — useless for ranking a class.
  // The local player still reads the live engine score, which is the most
  // current for them.
  const results = Array.from(currentGame.players.values())
    .map(p => ({ ...p, score: p.id === currentGame.playerId ? gameEngine.score : (p.score || 0) }))
    .sort((a, b) => b.score - a.score);

  results.forEach((player, index) => {
    const item = document.createElement('div');
    item.className = 'result-item' + (index === 0 ? ' winner' : '');
    item.innerHTML = `
      <strong>${index + 1}. ${player.username}</strong>
      <span>${player.score} points</span>
    `;
    resultsList.appendChild(item);
  });
}

function resetGame() {
  leaveRoom();
  usernameInput.value = '';
  showScreen('welcome');
}

function updatePlayersList() {
  playersList.innerHTML = '';
  currentGame.players.forEach((player, playerId) => {
    const li = document.createElement('li');
    const roleDisplay = player.role === 'hider' ? '🎨 Hider' : '👁️ Seeker';
    li.textContent = `${player.username} - ${roleDisplay}`;
    playersList.appendChild(li);
  });
  const countEl = document.getElementById('playersCount');
  if (countEl) countEl.textContent = currentGame.players.size;
  // Keep the mini 3D preview in sync (joins/leaves/role changes)
  if (lobbyPreview) lobbyPreview.sync(currentGame.players, currentGame.playerId);
}

// ================= Mini 3D lobby preview =================
// A tiny THREE scene rendered into #lobbyCanvas showing every player in the
// room as a chunky bouncing character. Runs while the room-setup screen is
// visible, disposes when we leave the room.
class LobbyPreview {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.scene = new THREE.Scene();
    this.scene.background = null;
    this.camera = new THREE.PerspectiveCamera(45, 2, 0.1, 100);
    this.camera.position.set(0, 6, 12);
    this.camera.lookAt(0, 1.2, 0);
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const sun = new THREE.DirectionalLight(0xffffff, 0.7);
    sun.position.set(5, 10, 4);
    this.scene.add(sun);
    // A grassy stage disc so characters have something to bounce on
    const stage = new THREE.Mesh(
      new THREE.CircleGeometry(9, 32),
      new THREE.MeshStandardMaterial({ color: 0x8fc46d })
    );
    stage.rotation.x = -Math.PI / 2;
    this.scene.add(stage);
    this.players = new Map(); // id -> { group, tag, phase, angle, radius, speed, role }
    this._time = 0;
    this._resize();
    window.addEventListener('resize', () => this._resize());
    this._raf = requestAnimationFrame(() => this._tick());
  }

  _resize() {
    const r = this.canvas.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(r.width, r.height, false);
    this.camera.aspect = Math.max(0.1, r.width / Math.max(1, r.height));
    this.camera.updateProjectionMatrix();
  }

  // Build a colourful low-poly character: capsule body + sphere head + arms/legs.
  // Seekers are red-ish, hiders are teal, "you" gets a golden crown.
  _makeCharacter(role, isMe) {
    const g = new THREE.Group();
    const bodyColor = role === 'seeker' ? 0xd85a4a : 0x4fbfa8;
    const mat = new THREE.MeshStandardMaterial({ color: bodyColor });
    const skin = new THREE.MeshStandardMaterial({ color: 0xf1c68a });
    const dark = new THREE.MeshStandardMaterial({ color: 0x333340 });
    const torso = new THREE.Mesh(new THREE.SphereGeometry(0.5, 14, 12), mat);
    torso.scale.set(0.9, 1.2, 0.7);
    torso.position.y = 0.6;
    g.add(torso);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.36, 14, 12), skin);
    head.position.y = 1.4;
    g.add(head);
    // Arms + legs stashed on the group for the run animation to swing
    const armL = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.55, 8), mat);
    armL.position.set(-0.5, 0.6, 0);
    g.add(armL);
    const armR = armL.clone(); armR.position.x = 0.5; g.add(armR);
    const legL = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.55, 8), dark);
    legL.position.set(-0.18, 0.05, 0);
    g.add(legL);
    const legR = legL.clone(); legR.position.x = 0.18; g.add(legR);
    if (isMe) {
      // Golden crown so I can spot myself in the crowd
      const crown = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.28, 6),
        new THREE.MeshStandardMaterial({ color: 0xffd54a, emissive: 0xffb020, emissiveIntensity: 0.5 }));
      crown.position.y = 1.85;
      g.add(crown);
    }
    return { group: g, armL, armR, legL, legR };
  }

  // Floating username sprite over each character
  _makeTag(name) {
    const cv = document.createElement('canvas');
    cv.width = 256; cv.height = 64;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.roundRect ? ctx.roundRect(20, 6, 216, 52, 12) : ctx.fillRect(20, 6, 216, 52);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 26px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(name).slice(0, 14), 128, 34);
    const tex = new THREE.CanvasTexture(cv);
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
    spr.scale.set(2.4, 0.6, 1);
    spr.position.y = 2.3;
    return spr;
  }

  sync(players, meId) {
    const seen = new Set();
    let i = 0;
    const total = players.size;
    players.forEach((p, id) => {
      seen.add(id);
      let entry = this.players.get(id);
      if (!entry) {
        const parts = this._makeCharacter(p.role, id === meId);
        const tag = this._makeTag(p.username);
        parts.group.add(tag);
        this.scene.add(parts.group);
        entry = {
          ...parts, tag, role: p.role,
          angle: Math.random() * Math.PI * 2,
          radius: 2.2 + Math.random() * 3.8,
          speed: 0.5 + Math.random() * 0.6,
          phase: Math.random() * Math.PI * 2
        };
        this.players.set(id, entry);
      } else if (entry.role !== p.role) {
        // Role changed — rebuild for correct colour
        this.scene.remove(entry.group);
        const parts = this._makeCharacter(p.role, id === meId);
        const tag = this._makeTag(p.username);
        parts.group.add(tag);
        this.scene.add(parts.group);
        Object.assign(entry, parts, { tag, role: p.role });
      }
      i++;
    });
    for (const [id, entry] of this.players) {
      if (!seen.has(id)) { this.scene.remove(entry.group); this.players.delete(id); }
    }
  }

  _tick() {
    const now = performance.now() * 0.001;
    const dt = Math.min(0.05, now - (this._lastT || now));
    this._lastT = now;
    this._time += dt;
    this.players.forEach(p => {
      p.angle += p.speed * dt * 0.5;
      const x = Math.cos(p.angle) * p.radius;
      const z = Math.sin(p.angle) * p.radius;
      const bounce = Math.abs(Math.sin(this._time * 6 + p.phase)) * 0.18;
      p.group.position.set(x, bounce, z);
      p.group.rotation.y = -p.angle + Math.PI / 2; // face the direction of travel
      // Arm/leg swing tied to the bounce so the run reads clearly
      const swing = Math.sin(this._time * 6 + p.phase) * 0.7;
      p.armL.rotation.x = swing;
      p.armR.rotation.x = -swing;
      p.legL.rotation.x = -swing;
      p.legR.rotation.x = swing;
    });
    this.renderer.render(this.scene, this.camera);
    this._raf = requestAnimationFrame(() => this._tick());
  }

  dispose() {
    cancelAnimationFrame(this._raf);
    this.players.forEach(p => this.scene.remove(p.group));
    this.players.clear();
    try { this.renderer.dispose(); } catch (e) {}
  }
}

let lobbyPreview = null;

function copyRoomCode() {
  const code = roomCodeInput.value;
  navigator.clipboard.writeText(code).then(() => {
    showMessage('Room code copied!', 'success');
  });
}

// Fill the map dropdown from the available game maps
function populateMapSelect() {
  mapSelect.innerHTML = '';
  Object.keys(GAME_MAPS).forEach(id => {
    const opt = document.createElement('option');
    opt.value = id;
    opt.textContent = GAME_MAPS[id].name;
    mapSelect.appendChild(opt);
  });
  currentGame.mapId = mapSelect.value; // default to first map
}

// ===== Paint System =====

// Render the color palette; locked colors show a padlock
function renderColorPalette() {
  colorPalette.innerHTML = '';

  // The last eyedropper-sucked color appears as a special first swatch
  if (paintState.sampledColor) {
    const s = document.createElement('div');
    s.className = 'swatch';
    s.title = 'สีที่ดูดมาจากฉาก';
    s.style.background = paintState.sampledColor;
    s.style.borderStyle = 'dashed';
    if (paintState.color === paintState.sampledColor) s.classList.add('selected');
    s.addEventListener('click', () => {
      paintState.color = paintState.sampledColor;
      if (gameEngine) gameEngine.setPaintColor(paintState.sampledColor);
      if (colorPicker) colorPicker.value = paintState.sampledColor;
      renderColorPalette();
    });
    colorPalette.appendChild(s);
  }

  ALL_COLORS.forEach((color, i) => {
    const swatch = document.createElement('div');
    swatch.className = 'swatch';
    swatch.style.background = color;

    const unlocked = i < paintState.unlockedCount;
    if (!unlocked) {
      swatch.classList.add('locked');
      swatch.textContent = '🔒';
    } else {
      if (color === paintState.color) swatch.classList.add('selected');
      swatch.addEventListener('click', () => {
        paintState.color = color;
        if (gameEngine) gameEngine.setPaintColor(color);
        if (colorPicker) colorPicker.value = color;
        renderColorPalette();
        updateBrushPreview(parseInt(brushSizeInput.value, 10));
      });
    }
    colorPalette.appendChild(swatch);
  });
}

// Update the powers/abilities display
function updatePowersDisplay() {
  powersList.innerHTML = '';
  const badges = [
    `🎨 ${paintState.unlockedCount}/${ALL_COLORS.length} สี`
  ];
  badges.forEach(text => {
    const span = document.createElement('span');
    span.className = 'power-badge';
    span.textContent = text;
    powersList.appendChild(span);
  });
  renderAbilityBar();
}

// ===== Ability bar =====

// Which abilities this player can use (their role's + the shared ones)
function myAbilities() {
  const role = currentGame.role === 'seeker' ? 'seeker' : 'hider';
  return ABILITIES.filter(a => a.role === 'both' || a.role === role);
}

function renderAbilityBar() {
  const bar = document.getElementById('abilityBar');
  const energyEl = document.getElementById('energyCount');
  if (!bar) return;
  if (energyEl) energyEl.textContent = `⚡ ${abilityState.energy}`;

  bar.innerHTML = '';
  myAbilities().forEach(ab => {
    const left = gameEngine ? gameEngine.abilityTimeLeft(ab.id) : 0;
    const affordable = abilityState.energy >= ab.cost;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ability-btn' + (left ? ' active' : affordable ? ' affordable' : '');
    btn.disabled = !affordable && !left;
    btn.title = `${ab.name} — ${ab.desc} (⚡${ab.cost})`;
    btn.innerHTML =
      `<span class="ab-icon">${ab.icon}</span>` +
      `<span class="ab-name">${ab.name}</span>` +
      `<span class="ab-cost">⚡${ab.cost}</span>` +
      (left ? `<span class="ab-timer">${left}s</span>` : '');
    btn.addEventListener('click', () => useAbility(ab.id));
    bar.appendChild(btn);
  });
  // Glow the collapsed pill when there's something you can actually cast, so
  // players notice they have a move to make without keeping the strip open
  const panel = document.querySelector('.ability-panel');
  if (panel) {
    const canCast = myAbilities().some(a =>
      abilityState.energy >= a.cost && !(gameEngine && gameEngine.abilityTimeLeft(a.id)));
    panel.classList.toggle('has-affordable', canCast);
  }
}

// Collapse the ability strip (touch) — used after casting and when leaving
function collapseAbilityBar() {
  const panel = document.querySelector('.ability-panel');
  if (panel) panel.classList.remove('expanded');
}

// Spend energy on an ability. The engine decides whether it can actually fire
// (e.g. no surface to camouflage against), and we only charge on success.
function useAbility(id) {
  const ab = ABILITIES.find(a => a.id === id);
  if (!ab || !gameEngine) return;
  if (abilityState.energy < ab.cost) {
    showMessage('⚡ พลังงานไม่พอ — ตอบคำถามเพิ่มอีก', 'error');
    return;
  }
  if (gameEngine.abilityTimeLeft(ab.id)) {
    showMessage(`${ab.icon} ${ab.name} กำลังทำงานอยู่`, 'info');
    return;
  }
  if (!gameEngine.activateAbility(id)) {
    showMessage(`${ab.icon} ใช้ไม่ได้ตอนนี้ — ${ab.desc}`, 'error');
    return;
  }
  abilityState.energy -= ab.cost;
  if (typeof soundFX !== 'undefined') soundFX.unlock();
  showMessage(`${ab.icon} ${ab.name}!`, 'success');
  collapseAbilityBar();   // fold the strip back so it stops covering the game
  renderAbilityBar();
}

// Camouflage meter + danger vignette. This is what makes painting matter:
// the meter tells you whether you actually blend where you're standing, and
// the vignette warns you a seeker is closing in.
function updateTensionHud() {
  if (!gameEngine || gameEngine.gameState !== 'playing') return;
  const meter = document.getElementById('blendMeter');
  const vig = document.getElementById('dangerVignette');
  const isHider = gameEngine.isHider && !gameEngine.selfCaught;

  if (meter) {
    if (isHider) {
      const b = gameEngine.getSelfBlend();
      meter.style.display = 'flex';
      const fill = document.getElementById('blendFill');
      const text = document.getElementById('blendText');
      if (fill) fill.style.width = Math.round(b * 100) + '%';
      if (text) text.textContent = Math.round(b * 100) + '%';
      meter.classList.toggle('good', b >= 0.45 && b < 0.75);
      meter.classList.toggle('great', b >= 0.75);
    } else {
      meter.style.display = 'none';
    }
  }

  if (vig) vig.style.opacity = isHider ? (gameEngine.dangerLevel() * 0.85).toFixed(2) : 0;
}

// Radar overlay + live ability timers, ticked a few times a second
function updateAbilityHud() {
  updateTensionHud();
  const hud = document.getElementById('radarHud');
  if (!gameEngine || !hud) return;

  if (gameEngine.radarOn) {
    const near = gameEngine.nearestOpponent();
    if (near) {
      hud.style.display = 'flex';
      const arrow = document.getElementById('radarArrow');
      const dist = document.getElementById('radarDist');
      // Arrow points at the opponent relative to where the camera faces
      if (arrow) arrow.style.transform = `rotate(${near.angle * 180 / Math.PI}deg)`;
      if (dist) dist.textContent = `${Math.round(near.dist)} ม.`;
      hud.classList.toggle('danger', near.dist < 18);
    } else {
      hud.style.display = 'flex';
      const dist = document.getElementById('radarDist');
      if (dist) dist.textContent = 'ปลอดภัย';
      hud.classList.remove('danger');
    }
  } else {
    hud.style.display = 'none';
  }

  // Keep the countdown badges honest while abilities run
  if (myAbilities().some(a => gameEngine.abilityTimeLeft(a.id))) renderAbilityBar();
}

// Wire the paint toolbar. Actual painting (clicking a 3D body part) is handled
// inside the 3D GameEngine; here we only manage the toolbar controls.
function setupPaintEvents() {
  // Free colour picker — choose any colour (like the real game)
  colorPicker.addEventListener('input', () => {
    paintState.color = colorPicker.value;
    if (gameEngine) gameEngine.setPaintColor(colorPicker.value);
    colorPalette.querySelectorAll('.swatch').forEach(s => s.classList.remove('selected'));
    updateBrushPreview(parseInt(brushSizeInput.value, 10));
  });

  brushSizeInput.addEventListener('input', () => {
    const sz = parseInt(brushSizeInput.value, 10);
    if (gameEngine) gameEngine.setBrushSize(sz);
    updateBrushPreview(sz);
  });
  updateBrushPreview(parseInt(brushSizeInput.value, 10));
  setupBrushCursor();

  clearPaintBtn.addEventListener('click', () => {
    if (gameEngine) gameEngine.clearPaint();
  });

  // Eyedropper: toggle suck-color mode, then click any surface in the world
  eyedropperBtn.addEventListener('click', () => {
    if (!gameEngine) return;
    const on = gameEngine.toggleEyedropper();
    updateEyedropperUI(on);
  });

  // Base-coat the whole body with the current color
  paintAllBtn.addEventListener('click', () => {
    if (gameEngine) {
      gameEngine.paintAll(paintState.color);
      showMessage('ทาทั้งตัวด้วยสีที่เลือกแล้ว 🪣', 'success');
    }
  });

  askQuestionBtn.addEventListener('click', askQuestion);

  setupPoseWheel();
}

// Highlight the eyedropper button + crosshair cursor while active
function updateEyedropperUI(on) {
  eyedropperBtn.style.background = on ? '#4ac8d6' : '';
  eyedropperBtn.style.color = on ? '#fff' : '';
  document.getElementById('gameCanvas').style.cursor = on ? 'copy' : 'crosshair';
  if (on) showMessage('โหมดดูดสี: คลิกที่สิ่งของ/พื้น/กำแพงเพื่อดูดสี 💉', 'success');
}

// ===== Brush size preview + on-canvas brush cursor =====
// The paint brush radius is measured in texture pixels (4–40). On screen it
// roughly maps to ~1.5x that in device px when close to the body — this factor
// gives a live, size-accurate ring so you know how big you're painting.
const BRUSH_SCREEN_FACTOR = 1.6;

function updateBrushPreview(sz) {
  const num = document.getElementById('brushSizeNum');
  if (num) num.textContent = sz;
  const dot = document.getElementById('brushDot');
  if (dot) {
    const d = Math.round(sz * 0.9 + 4); // clamp into the 46px swatch
    dot.style.width = Math.min(40, d) + 'px';
    dot.style.height = Math.min(40, d) + 'px';
    dot.style.background = paintState.color;
  }
}

// Follow the pointer with a ring sized to the brush, visible only while a
// hider (or a seeker in the hide phase) can actually paint.
function setupBrushCursor() {
  if (setupBrushCursor._done) return;
  setupBrushCursor._done = true;
  const cursor = document.getElementById('brushCursor');
  // Bind to the stable container, not the canvas (which gets swapped out)
  const canvas = document.querySelector('.game-container');
  if (!cursor || !canvas) return;

  const place = (clientX, clientY) => {
    if (!gameEngine || !gameEngine._canPaint || !gameEngine._canPaint()) {
      cursor.style.display = 'none';
      return;
    }
    const sz = parseInt(brushSizeInput.value, 10) || 14;
    const d = sz * 2 * BRUSH_SCREEN_FACTOR;
    cursor.style.width = d + 'px';
    cursor.style.height = d + 'px';
    cursor.style.left = clientX + 'px';
    cursor.style.top = clientY + 'px';
    cursor.style.background = hexToRgba(paintState.color, 0.28);
    cursor.style.display = 'block';
    // Brighten the ring when it's actually over the body (paintable)
    const onBody = gameEngine._hitCharacter && gameEngine._hitCharacter(clientX, clientY);
    cursor.classList.toggle('on-body', !!onBody);
  };

  canvas.addEventListener('mousemove', (e) => place(e.clientX, e.clientY));
  canvas.addEventListener('mouseleave', () => { cursor.style.display = 'none'; });
  canvas.addEventListener('touchmove', (e) => {
    const t = e.touches[0]; if (t) place(t.clientX, t.clientY);
  }, { passive: true });
  canvas.addEventListener('touchend', () => { cursor.style.display = 'none'; });
}

function hexToRgba(hex, a) {
  const h = (hex || '#e74c3c').replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

// ===== Radial pose wheel (right-click to open, Hider only) =====
const POSE_WHEEL_ITEMS = [
  { pose: 'stand', label: '🧍 ยืน' },
  { pose: 'spread', label: '🙆 กางแขน' },
  { pose: 'armsUp', label: '🙌 ยกแขน' },
  { pose: 'wave', label: '👋 โบกมือ' },
  { pose: 'handsHead', label: '🙇 กุมหัว' },
  { pose: 'crouch', label: '🧎 ย่อตัว' },
  { pose: 'sit', label: '🪑 นั่ง' },
  { pose: 'ball', label: '⚪ ม้วนตัว' },
  { pose: 'fold', label: '🤸 ก้มแตะเท้า' },
  { pose: 'star', label: '⭐ กระโดดดาว' },
  { pose: 'lie', label: '🛌 นอนราบ' },
  { pose: 'warrior', label: '🏹 ท่านักรบ' },
  { pose: 'flat', label: '🧗 แปะผนัง' },
  { pose: 'lean', label: '🕴️ เอียงตัว' }
];

// Open/close helpers — freeze walking while the wheel is up so a stray
// joystick touch doesn't drag the character around behind the menu
function openPoseWheel() {
  poseWheel.style.display = 'block';
  document.getElementById('poseBackdrop').style.display = 'block';
  const mc = document.getElementById('mobileControls');
  mc.classList.add('posing'); // CSS disables the joystick zone
  if (gameEngine) {
    gameEngine.setMoveInput(0, 0);
    const knob = document.getElementById('joystickKnob');
    if (knob) knob.style.transform = 'translate(0,0)';
  }
}
function closePoseWheel() {
  poseWheel.style.display = 'none';
  document.getElementById('poseBackdrop').style.display = 'none';
  document.getElementById('mobileControls').classList.remove('posing');
}
function togglePoseWheel() {
  if (poseWheel.style.display === 'none' || !poseWheel.style.display) openPoseWheel();
  else closePoseWheel();
}

function setupPoseWheel() {
  // Full-screen backdrop that sits just under the wheel and closes it on tap
  const backdrop = document.createElement('div');
  backdrop.id = 'poseBackdrop';
  backdrop.style.display = 'none';
  poseWheel.parentElement.insertBefore(backdrop, poseWheel);
  backdrop.addEventListener('click', closePoseWheel);
  backdrop.addEventListener('touchstart', (e) => { e.preventDefault(); closePoseWheel(); }, { passive: false });

  // Build the wheel buttons in a circle
  const R = 130;
  POSE_WHEEL_ITEMS.forEach((item, i) => {
    const ang = (i / POSE_WHEEL_ITEMS.length) * Math.PI * 2 - Math.PI / 2;
    const btn = document.createElement('button');
    btn.className = 'pose-wheel-btn';
    btn.textContent = item.label;
    btn.style.left = `calc(50% + ${Math.round(Math.cos(ang) * R)}px)`;
    btn.style.top = `calc(50% + ${Math.round(Math.sin(ang) * R)}px)`;
    const pick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (gameEngine) gameEngine.setPose(item.pose);
      closePoseWheel();
      showMessage(`ท่า: ${item.label}`, 'success');
    };
    // touchend for phones (fires immediately, no 300ms click delay), click for desktop
    btn.addEventListener('touchend', pick, { passive: false });
    btn.addEventListener('click', pick);
    poseWheel.appendChild(btn);
  });

  // Right-click toggles the wheel. Bind to the game-container (a stable
  // parent) instead of the canvas — the canvas element is swapped out every
  // time we (re)build the engine, which would orphan a canvas-bound listener.
  const container = document.querySelector('.game-container');
  if (container) container.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    if (!gameEngine || gameEngine.gameState !== 'playing') return;
    // Anyone can strike a pose in the lobby; in-match it's a hider tool
    if (!gameEngine.lobbyMode && !gameEngine.isHider) return;
    togglePoseWheel();
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closePoseWheel();
    // P key is a quick keyboard shortcut to open the pose wheel
    if ((e.key === 'p' || e.key === 'P') && gameEngine && gameEngine.gameState === 'playing'
        && (gameEngine.lobbyMode || gameEngine.isHider)) {
      togglePoseWheel();
    }
  });
}

// Generate a QR code that encodes the join link for this room
function generateRoomQr(roomId) {
  if (!roomQrCode || typeof QRCode === 'undefined') return;
  roomQrCode.innerHTML = '';
  const joinUrl = `${window.location.origin}/?room=${encodeURIComponent(roomId)}`;
  new QRCode(roomQrCode, {
    text: joinUrl,
    width: 180,
    height: 180,
    correctLevel: QRCode.CorrectLevel.M
  });
}


function showScreen(screenName) {
  document.querySelectorAll('.screen').forEach(screen => {
    screen.classList.remove('active');
  });

  let screenElement;
  switch (screenName) {
    case 'welcome':
      screenElement = welcomeScreen;
      break;
    case 'roomSetup':
      screenElement = roomSetupScreen;
      break;
    case 'game':
      screenElement = gameScreen;
      break;
    case 'gameOver':
      screenElement = gameOverScreen;
      break;
    default:
      return;
  }

  if (screenElement) {
    screenElement.classList.add('active');
  }

  // Boot / tear down the mini 3D lobby preview when its screen appears
  if (screenName === 'roomSetup') {
    if (!lobbyPreview) {
      const canvas = document.getElementById('lobbyCanvas');
      if (canvas && typeof THREE !== 'undefined') {
        try { lobbyPreview = new LobbyPreview(canvas); } catch (e) { console.error(e); }
      }
    }
    if (lobbyPreview) {
      // Resize once the canvas has real dimensions
      setTimeout(() => lobbyPreview._resize(), 60);
      lobbyPreview.sync(currentGame.players, currentGame.playerId);
    }
  } else if (lobbyPreview) {
    lobbyPreview.dispose();
    lobbyPreview = null;
  }
}

function showMessage(message, type = 'info') {
  const div = document.createElement('div');
  div.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 15px 20px;
    background: ${type === 'success' ? '#4caf50' : '#f44336'};
    color: white;
    border-radius: 8px;
    z-index: 2000;
    animation: slideIn 0.3s ease-out;
  `;
  div.textContent = message;
  document.body.appendChild(div);

  setTimeout(() => div.remove(), 3000);
}

function generateRoomCode() {
  return 'ROOM_' + Math.random().toString(36).substr(2, 8).toUpperCase();
}

// Add CSS for animations
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }

  .option-label {
    display: block;
    padding: 10px;
    margin: 10px 0;
    background: #f5f5f5;
    border-radius: 4px;
    cursor: pointer;
    transition: background 0.2s;
  }

  .option-label:hover {
    background: #e0e0e0;
  }

  .option-label input {
    margin-right: 10px;
  }

  .modal {
    z-index: 1000 !important;
  }
`;
document.head.appendChild(style);

// Start application
init();
