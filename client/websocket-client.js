class WebSocketClient {
  // Use wss:// on HTTPS pages (online/tunnel), ws:// on plain HTTP (local)
  constructor(url = `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}`) {
    this.url = url;
    this.ws = null;
    this.connected = false;
    this.listeners = {};
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
  }

  connect() {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
          console.log('WebSocket connected');
          this.connected = true;
          this.reconnectAttempts = 0;
          this.emit('connected');
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            this.emit('message', data);
            this.emit(data.type, data);
          } catch (error) {
            console.error('Error parsing WebSocket message:', error);
          }
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          this.emit('error', error);
          reject(error);
        };

        this.ws.onclose = () => {
          console.log('WebSocket disconnected');
          this.connected = false;
          this.emit('disconnected');
          this.attemptReconnect();
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = this.reconnectDelay * this.reconnectAttempts;
      console.log(`Attempting to reconnect in ${delay}ms...`);

      setTimeout(() => {
        this.connect().catch(error => {
          console.error('Reconnection failed:', error);
        });
      }, delay);
    } else {
      console.error('Max reconnection attempts reached');
      this.emit('reconnect_failed');
    }
  }

  send(data) {
    if (this.connected && this.ws && this.ws.readyState === 1) {
      this.ws.send(JSON.stringify(data));
    }
    // While dropped, outgoing messages (position/paint broadcasts) are simply
    // discarded — the socket auto-reconnects and the client re-announces
    // itself, so there's nothing useful to send in the meantime and no need
    // to spam the console for every frame we're offline.
  }

  on(eventType, callback) {
    if (!this.listeners[eventType]) {
      this.listeners[eventType] = [];
    }
    this.listeners[eventType].push(callback);
  }

  off(eventType, callback) {
    if (this.listeners[eventType]) {
      this.listeners[eventType] = this.listeners[eventType].filter(cb => cb !== callback);
    }
  }

  emit(eventType, data) {
    if (this.listeners[eventType]) {
      this.listeners[eventType].forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in event listener for ${eventType}:`, error);
        }
      });
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
    }
  }

  // Game-specific methods
  createRoom(roomId, username) {
    this.send({
      type: 'create_room',
      roomId: roomId,
      username: username
    });
  }

  joinRoom(roomId, username, role) {
    this.send({
      type: 'join_room',
      roomId: roomId,
      username: username,
      role: role
    });
  }

  startGame(roomId, gameState, settings) {
    this.send({
      type: 'game_state_update',
      roomId: roomId,
      gameState: gameState,
      startTime: Date.now(),
      settings: settings || null // { duration, questionSetId, mapId }
    });
  }

  updateHiderPainting(roomId, hiderId, paintData) {
    this.send({
      type: 'hider_painting_update',
      roomId: roomId,
      hiderId: hiderId,
      paintData: paintData
    });
  }

  submitAnswer(roomId, questionId, answer) {
    this.send({
      type: 'question_answered',
      roomId: roomId,
      questionId: questionId,
      answer: answer
    });
  }

  broadcastAction(roomId, playerId, action, actionData) {
    this.send({
      type: 'game_action',
      roomId: roomId,
      playerId: playerId,
      action: action,
      actionData: actionData
    });
  }
}

// Global WebSocket client instance
const wsClient = new WebSocketClient();
