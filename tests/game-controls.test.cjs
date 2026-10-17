const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

class Vector2 {
  constructor(x = 0, y = 0) { this.set(x, y); }
  set(x, y) { this.x = x; this.y = y; return this; }
}
class Vector3 {
  constructor(x = 0, y = 0, z = 0) { this.set(x, y, z); }
  set(x, y, z) { Object.assign(this, { x, y, z }); return this; }
  copy(v) { return this.set(v.x, v.y, v.z); }
  clone() { return new Vector3(this.x, this.y, this.z); }
  sub(v) { this.x -= v.x; this.y -= v.y; this.z -= v.z; return this; }
  divideScalar(n) { this.x /= n; this.y /= n; this.z /= n; return this; }
  length() { return Math.hypot(this.x, this.y, this.z); }
  distanceTo(v) { return this.clone().sub(v).length(); }
  addScaledVector(v, n) { this.x += v.x * n; this.y += v.y * n; this.z += v.z * n; return this; }
  lerp(v, n) { this.x += (v.x - this.x) * n; this.y += (v.y - this.y) * n; this.z += (v.z - this.z) * n; return this; }
}
function events(extra = {}) {
  const listeners = new Map();
  return {
    ...extra,
    addEventListener(name, callback) {
      if (!listeners.has(name)) listeners.set(name, []);
      listeners.get(name).push(callback);
    },
    fire(name, event = {}) { for (const fn of listeners.get(name) || []) fn(event); }
  };
}

function engine() {
  const canvas = events({ getBoundingClientRect: () => ({ left: 0, top: 0, width: 1000, height: 600 }) });
  const document = events({ hidden: false, getElementById: id => id === 'canvas' ? canvas : null });
  const window = events();
  const context = vm.createContext({
    THREE: { Vector2, Vector3, Raycaster: class {} }, document, window,
    navigator: { maxTouchPoints: 0 }, AbortController
  });
  vm.runInContext(fs.readFileSync(process.env.GAME_SOURCE || path.join(__dirname, '../client/game.js'), 'utf8') +
    '\nthis.Engine = GameEngine; this.controlKey = typeof gameControlKey === "function" ? gameControlKey : event => event.key.toLowerCase();', context);
  const game = new context.Engine('canvas');
  const rotation = () => ({ x: 0, y: 0, z: 0 });
  const limb = () => ({ pivot: { rotation: rotation() }, mid: { rotation: rotation() } });
  game.character = { position: new Vector3(), rotation: rotation(), traverse() {} };
  game.armL = limb(); game.armR = limb(); game.legL = limb(); game.legR = limb();
  game.rig = { waist: { rotation: rotation() }, neck: { rotation: rotation() } };
  game.gameState = 'playing'; game.bound = 1000; game.charHeading = 0;
  game._blocked = () => false; game._wallTopAt = () => 0; game._supportHeight = () => 0;
  game._canPaint = () => false;
  const forward = new Vector3(0, 0, -1);
  game.camera = {
    position: new Vector3(0, 4, 10),
    getWorldDirection: target => target.copy(forward), lookAt() {}
  };
  return { game, forward, window, document, canvas, controlKey: context.controlKey };
}

test('keyboard and joystick match screen forward/right at eight camera bearings', () => {
  for (let i = 0; i < 8; i++) for (const joystick of [false, true]) {
    const angle = i * Math.PI / 4;
    const view = { x: -Math.sin(angle), z: -Math.cos(angle) };
    const right = { x: -view.z, z: view.x };
    for (const [key, x, z, expected] of [
      ['w', 0, -1, view], ['s', 0, 1, { x: -view.x, z: -view.z }],
      ['d', 1, 0, right], ['a', -1, 0, { x: -right.x, z: -right.z }]
    ]) {
      const { game, forward } = engine();
      game.camAngle = angle;
      forward.set(view.x, -.4, view.z);
      if (joystick) game.setMoveInput(x, z); else game.keys[key] = true;
      for (let frame = 0; frame < 30; frame++) game._updateMovement(1 / 60);
      const p = game.character.position;
      const along = p.x * expected.x + p.z * expected.z;
      const sideways = Math.abs(p.x * expected.z - p.z * expected.x);
      assert.ok(along > 3, `${joystick ? 'stick' : 'key'} ${key} at ${i * 45}° moves the wrong way`);
      assert.ok(sideways < 1e-8, 'straight input must stay straight on screen');
    }
  }
});

test('movement follows the visible camera while its orbit target is still turning', () => {
  const { game, forward } = engine();
  game.camAngle = Math.PI / 2;
  forward.set(0, -.2, -1);
  game.keys.w = true;
  game._updateMovement(1 / 30);
  assert.ok(game.character.position.z < 0);
  assert.equal(game.character.position.x, 0);
});

test('diagonals do not run faster, small stick input gives fine movement, releasing stops immediately', () => {
  const speed = (x, z) => {
    const { game } = engine(); game.setMoveInput(x, z);
    for (let i = 0; i < 60; i++) game._updateMovement(1 / 60);
    return { game, speed: Math.hypot(game.moveVel.x, game.moveVel.y) };
  };
  const straight = speed(0, -1), diagonal = speed(1, -1), gentle = speed(0, -.2);
  assert.ok(Math.abs(straight.speed - diagonal.speed) < 1e-8);
  assert.ok(gentle.speed < straight.speed * .25);
  const game = straight.game;
  const before = game.character.position.clone();
  game.setMoveInput(0, 0); game._updateMovement(1 / 60);
  assert.equal(Math.hypot(game.character.position.x - before.x, game.character.position.z - before.z), 0);
  assert.equal(Math.hypot(game.moveVel.x, game.moveVel.y), 0);
});

test('Thai keyboard layout uses physical keys and leaving the page releases walking and looking', () => {
  const { game, window, document, canvas, controlKey } = engine();
  assert.equal(controlKey({ code: 'KeyW', key: 'ไ' }), 'w');
  game._setupInput();
  const event = { code: 'KeyW', key: 'ไ', preventDefault() {} };
  window.fire('keydown', event);
  assert.equal(game.keys.w, true);
  canvas.fire('mousedown', { button: 0, clientX: 10, clientY: 10 });
  assert.equal(game._camDragging, true);
  document.hidden = true; document.fire('visibilitychange');
  assert.equal(Object.keys(game.keys).length, 0);
  assert.equal(game._camDragging, false);
  const angle = game.camAngle;
  window.fire('mousemove', { clientX: 500, clientY: 500 });
  assert.equal(game.camAngle, angle, 'old drag must not resume after switching apps');
});

test('C recentres the view behind the player and camera collision does not lift or flip it', () => {
  const { game, window } = engine();
  game._setupInput(); game.charHeading = 1;
  game.camPitch = .85; game.camDist = 25;
  window.fire('keydown', { code: 'KeyC', key: 'แ', preventDefault() {} });
  assert.equal(game.camAngle, 1 + Math.PI);
  assert.equal(game.camPitch, .28);
  assert.equal(game.camDist, 10);
  game._pushOutOfCones = () => false;
  for (const hit of [.12, 1, 3]) {
    game._cameraBlockDistance = () => hit;
    game._updateCamera(1 / 60);
    const p = game.camera.position;
    assert.ok(p.y < 3, 'nearby props must not fling the camera above the room');
    assert.ok(p.x * Math.sin(game.camAngle) + p.z * Math.cos(game.camAngle) > 0, 'camera stays on the same side of the player');
  }
});
