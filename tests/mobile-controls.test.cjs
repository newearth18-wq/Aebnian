const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function events(extra = {}) {
  const handlers = new Map();
  return {
    ...extra,
    addEventListener(type, fn) { if (!handlers.has(type)) handlers.set(type, []); handlers.get(type).push(fn); },
    fire(type, event = {}) { for (const fn of handlers.get(type) || []) fn(event); }
  };
}
function controls() {
  const elements = new Map();
  const get = id => {
    if (!elements.has(id)) elements.set(id, events({
      style: {}, classList: { add() {} }, offsetWidth: id === 'joystickKnob' ? 54 : 132,
      setPointerCapture() {},
      getBoundingClientRect: () => id === 'mobileControls'
        ? { left: 0, top: 0, right: 844, bottom: 390, width: 844, height: 390 }
        : id === 'joyZone'
          ? { left: 0, top: 136, right: 380, bottom: 390, width: 380, height: 254 }
          : { left: 24, top: 184, right: 156, bottom: 316, width: 132, height: 132 }
    }));
    return elements.get(id);
  };
  const document = events({ hidden: false, getElementById: get });
  const window = events({ ontouchstart: null });
  const game = { lobbyMode: true, setMoveInput(x, z) { this.input = { x, z }; } };
  const source = fs.readFileSync(path.join(__dirname, '../client/main.js'), 'utf8');
  // Run the shipped setup function against controllable DOM/input boundaries.
  const start = source.indexOf('let mobileWired = false;');
  const end = source.indexOf('// Read the game duration', start);
  vm.runInNewContext(source.slice(start, end) + '\nsetupMobileControls();', {
    window, document, navigator: { maxTouchPoints: 2 }, gameEngine: game,
    currentGame: { role: 'hider' }, setInterval, clearInterval
  });
  const pointer = (id, x, y) => ({ pointerId: id, pointerType: 'touch', clientX: x, clientY: y,
    preventDefault() {}, stopPropagation() {} });
  return { get, game, window, document, pointer };
}

test('tapping a stick direction moves immediately, and the look finger cannot steer or release it', () => {
  const { get, game, window, pointer } = controls();
  get('joystick').fire('pointerdown', pointer(1, 123, 250));
  assert.ok(game.input.x > .99);
  window.fire('pointermove', pointer(2, 500, 200));
  window.fire('pointerup', pointer(2, 500, 200));
  assert.ok(game.input.x > .99);
  window.fire('pointermove', pointer(1, 90, 217));
  assert.ok(game.input.z < -.99);
  window.fire('pointerup', pointer(1, 90, 217));
  assert.deepEqual(game.input, { x: 0, z: 0 });
});

test('stick offers a dead zone and slow precision walking before full extension', () => {
  const { get, game, window, pointer } = controls();
  get('joystick').fire('pointerdown', pointer(1, 92, 250));
  assert.equal(game.input.x, 0);
  window.fire('pointermove', pointer(1, 106, 250));
  assert.ok(game.input.x > .1 && game.input.x < .5);
  window.fire('pointermove', pointer(1, 200, 250));
  assert.ok(game.input.x > .99);
});

test('floating stick uses its displayed centre when summoned at an edge', () => {
  const { get, game, window, pointer } = controls();
  get('joyZone').fire('pointerdown', pointer(1, 5, 385));
  // Base is clamped to a centre of (74, 304), inside the left zone.
  assert.equal(get('joystick').style.left, '8px');
  assert.equal(get('joystick').style.top, '238px');
  window.fire('pointermove', pointer(1, 74, 304));
  assert.deepEqual(game.input, { x: 0, z: 0 });
});

test('pointer cancellation, lost capture and switching apps always release the stick', () => {
  for (const cancellation of ['pointercancel', 'lostpointercapture', 'visibilitychange', 'blur']) {
    const { get, game, window, document, pointer } = controls();
    get('joystick').fire('pointerdown', pointer(1, 123, 250));
    if (cancellation === 'visibilitychange') { document.hidden = true; document.fire(cancellation); }
    else if (cancellation === 'lostpointercapture') get('joystick').fire(cancellation, pointer(1, 123, 250));
    else window.fire(cancellation, pointer(1, 123, 250));
    assert.deepEqual(game.input, { x: 0, z: 0 }, cancellation);
    assert.equal(get('joystickKnob').style.transform, 'translate(0,0)');
  }
});
