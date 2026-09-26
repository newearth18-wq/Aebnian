// 3D Game Engine (Three.js) for MECCHA CHAMELEON
// Controls: WASD/arrows to walk, drag mouse to look, click a body part to paint it.

// Player body scale by role: hiders small (harder to spot), seekers big
const PLAYER_SCALE = { hider: 0.7, seeker: 1.35 };

// Reused straight-down vector for the "what am I standing on?" ray
const DOWN_VEC = new THREE.Vector3(0, -1, 0);

// Default world scale for maps that don't set their own. Every position (walls,
// props, grids, spawn, scatter bounds) is multiplied by the map's scale, so
// this single number sizes the whole stage. Bumped from 2.4 to give every map
// more room; the indoor maps that set an explicit scale (classroom, laundry)
// are bumped in step in their own configs.
const DEFAULT_MAP_SCALE = 2.9;

// Surface finishes, keyed by the exact palette colours the builders use.
// Every material in the game is a MeshStandardMaterial left at Three's defaults
// (roughness 1, metalness 0) — perfectly diffuse, no specular — which is why
// gilding, marble, velvet and glass all read as the same matte plastic. These
// are the constants the builders already share, so this is a lookup rather than
// guesswork about what a surface is meant to be.
const FINISHES = {
  0xc8a030: { metalness: 0.9,  roughness: 0.26 },  // gilding: columns, frames, sconces
  0xd2c8b6: { metalness: 0.0,  roughness: 0.38 },  // polished marble
  0xd4cabb: { metalness: 0.0,  roughness: 0.38 },  // fireplace marble
  0xd8cfbf: { metalness: 0.0,  roughness: 0.85 },  // padded cream upholstery
  0xcac4b8: { metalness: 0.0,  roughness: 0.55 },  // statuary marble
  0x14141a: { metalness: 0.35, roughness: 0.18 },  // piano lacquer
  0x8a2222: { metalness: 0.0,  roughness: 0.95 },  // carpet wool
  0x4a3020: { metalness: 0.0,  roughness: 0.7  },  // dark furniture wood
  0x7a5230: { metalness: 0.0,  roughness: 0.75 },  // bookshelf wood
  0x556070: { metalness: 0.55, roughness: 0.35 },  // lab / appliance steel
  0x4a7ab0: { metalness: 0.45, roughness: 0.4  },  // painted metal lockers
  0xb04a4a: { metalness: 0.45, roughness: 0.4  }
};

// Shared 6-room corridor wall layout (central corridor x -4..4, doorway per room)
const CORRIDOR_WALLS = [
  { x: -17, z: -10, w: 26, d: 1 }, { x: -17, z: 10, w: 26, d: 1 },
  { x: 17, z: -10, w: 26, d: 1 }, { x: 17, z: 10, w: 26, d: 1 },
  { x: -4, z: -26, w: 1, d: 8 }, { x: -4, z: -10, w: 1, d: 16 },
  { x: -4, z: 10, w: 1, d: 16 }, { x: -4, z: 26, w: 1, d: 8 },
  { x: 4, z: -26, w: 1, d: 8 }, { x: 4, z: -10, w: 1, d: 16 },
  { x: 4, z: 10, w: 1, d: 16 }, { x: 4, z: 26, w: 1, d: 8 }
];

// ===== Selectable maps (data-driven stages) =====
// Object types: box {w,h,d}, cylinder {r,h}, cone {r,h}, sphere {r}
const GAME_MAPS = {
  meadow: {
    // Misty mountain meadow: lush tall grass, mossy boulders to climb behind,
    // a dark conifer treeline all around, and soft fog swallowing the distance
    name: '🌳 ทุ่งหญ้า', sky: 0xaac6b2, ground: 0x79a854, groundTexture: 'grass', groundTint: 0x86ab74, light: 0.9, clouds: true, size: 100,
    fog: { color: 0xaac6b2, near: 35, far: 150 },
    grassTufts: 700,
    treeline: { colors: [0x16391f, 0x1d4a28, 0x122f19], hMin: 15, hMax: 26 },
    scatter: [
      { type: 'cone', count: 16, colors: [0x2f6d3a, 0x3a7d44, 0x256b36], r: [1.2, 2.6], h: [4, 8] },
      { type: 'sphere', count: 12, colors: [0x5fae8c, 0x6bbf59, 0x4a9a6a], r: [0.9, 1.9] },
      { type: 'rock', count: 11, colors: [0x8f9189, 0x7c7e76, 0x9c9e95], r: [0.9, 2.2] },
      { type: 'box', count: 6, colors: [0xc0916b, 0xd6c15a], w: [1.5, 3], h: [1.5, 3.5], d: [1.5, 3], texture: 'wood' },
      { type: 'bigtree', count: 5, colors: [0x6b4a2f, 0x5c3f28, 0x7a5a3a], r: [0.7, 1.3], h: [12, 20] }
    ],
    objects: [
      // Big boulder cluster (the photo's climbing rock)
      { type: 'rock', x: 9, z: -4, r: 5.5, sy: 0.85, color: 0x8b8d85 },
      { type: 'rock', x: 12.5, z: -1.5, r: 3.2, sy: 0.7, color: 0x7e807a },
      { type: 'rock', x: 6.5, z: -7.5, r: 2.6, sy: 0.8, color: 0x969890 },
      { type: 'rock', x: -9, z: -6, r: 3.4, sy: 0.9, color: 0x8b8d85 },
      { type: 'rock', x: -14, z: 3, r: 2.8, sy: 0.75, color: 0x84867e },
      { type: 'cone', x: -6, z: 9, r: 2, h: 5, color: 0x3a7d44 },
      { type: 'sphere', x: 11, z: 10, r: 2, color: 0x5fae8c },
      { type: 'cone', x: 0, z: -12, r: 2.2, h: 6, color: 0x2f6d3a },
      { type: 'sphere', x: 14, z: -12, r: 1.6, color: 0x6bbf59 }
    ],
    models: [
      { url: 'models/horse.glb', x: -12, z: 2, height: 3, ry: 0.6 },
      { url: 'models/flamingo.glb', x: 8, z: 6, height: 2.6, ry: -1, y: 2.5 },
      { url: 'models/fox.glb', x: 4, z: -3, height: 1.3, ry: 2 },
      { url: 'models/stork.glb', x: -4, z: 11, height: 2.6, ry: 0.3, y: 3 },
      { url: 'models/parrot.glb', x: 13, z: -6, height: 1.1, ry: -2, y: 2 },
      { url: 'models/duck.glb', x: -8, z: -9, height: 1.4, ry: 1 },
      // A weathered stone monument standing in the field
      { url: 'models/bust.glb', x: -15, z: -12, height: 3, ry: 0.5, noAnim: true },
      { url: 'models/crate.glb', x: 15, z: 12, height: 1.7, ry: 0.4 },
      // A lone wanderer crossing the field (living decoy)
      { url: 'models/cesiumman.glb', x: 6, z: 12, height: 1.9, ry: -0.5 }
    ]
  },
  desert: {
    // Sunset desert: warm dusty haze, a low glowing sun, adobe village
    // streets, saguaro cacti, red-rock mesas and rolling dunes on the horizon
    name: '🏜️ ทะเลทราย', sky: 0xf2b374, ground: 0xe0c068, groundTexture: 'sand', groundTint: 0xd9b47f, light: 0.86, clouds: true, size: 100,
    fog: { color: 0xecad72, near: 40, far: 155 },
    sunGlow: 0xffdca8, sunColor: 0xffc182, ambientColor: 0xffe2c4,
    treeline: { style: 'dunes', colors: [0xdfae67, 0xd4a15c, 0xc99754], hMin: 8, hMax: 18 },
    scatter: [
      { type: 'cactus', count: 9, colors: [0x4f9d5b, 0x3f8a4c, 0x5aad66], r: [0.3, 0.5], h: [2.5, 4.5] },
      { type: 'rock', count: 8, colors: [0xc09068, 0xb08055, 0xa9754d], r: [0.8, 2.0] },
      { type: 'adobe', count: 4, colors: [0xd9bd93, 0xcfb187, 0xe0c49b], w: [3, 5], h: [2.5, 3.5], d: [3, 5] },
      { type: 'box', count: 4, colors: [0xb08a55, 0x9a7648], w: [1.2, 2.2], h: [1.2, 2], d: [1.2, 2.2], texture: 'wood' }
    ],
    objects: [
      // Adobe village street (like the promo art)
      { type: 'adobe', x: -10, z: -6, w: 5, h: 3.2, d: 4.5, color: 0xd9bd93, ry: 0.1 },
      { type: 'adobe', x: -4.5, z: -8.5, w: 4, h: 4.2, d: 4, color: 0xcfb187, ry: -0.2 },
      { type: 'adobe', x: -10.5, z: 0.5, w: 4, h: 2.6, d: 3.5, color: 0xe0c49b, ry: 0.3 },
      { type: 'adobe', x: 3, z: -10, w: 4.5, h: 3, d: 4, color: 0xd5b88e, ry: 1.6 },
      // Red-rock mesas on the skyline
      { type: 'mesa', x: 40, z: -30, r: 10, h: 14, color: 0xb5764a },
      { type: 'mesa', x: -42, z: -18, r: 8, h: 11, color: 0xa66a42 },
      { type: 'mesa', x: 34, z: 34, r: 9, h: 12, color: 0xc08454 },
      { type: 'mesa', x: 6, z: -44, r: 11, h: 15, color: 0xab7047 },
      { type: 'mesa', x: -30, z: 38, r: 7, h: 9, color: 0xb5764a },
      // Saguaro landmarks + sandstone boulders
      { type: 'cactus', x: 9, z: 6, r: 0.5, h: 5.5, color: 0x4f9d5b },
      { type: 'cactus', x: -6, z: 12, r: 0.45, h: 4.5, color: 0x3f8a4c },
      { type: 'rock', x: 12, z: -3, r: 2.8, sy: 0.8, color: 0xb08055 },
      { type: 'rock', x: -14, z: 8, r: 2.2, sy: 0.75, color: 0xc09068 }
    ],
    models: [
      { url: 'models/toycar.glb', x: -7, z: 3, height: 2.4, ry: 0.5 },
      { url: 'models/camera.glb', x: 8, z: -8, height: 2.6, ry: -0.8 },
      { url: 'models/fox.glb', x: 3, z: 8, height: 1.4, ry: 1.5 },
      { url: 'models/horse.glb', x: -12, z: -4, height: 3, ry: 0.8 },
      // A dusty pickup + caravan supply crates in the adobe village
      { url: 'models/milktruck.glb', x: 6, z: 8, height: 3, ry: -0.7 },
      { url: 'models/crate.glb', x: -9, z: 3, height: 1.8, ry: 0.3 },
      { url: 'models/crate.glb', x: -7.7, z: 3.6, height: 1.5, ry: 1.1 }
    ]
  },
  classroom: {
    // Cozy Mini-World-style classroom: green walls, tiled floor, a big
    // chalkboard, rows of desks with blue benches, and bookshelves + school
    // supplies all around. Real room (walls) at scale 1 so it feels enclosed.
    name: '🏫 ห้องเรียน', sky: 0xbfe0cf, ground: 0xe8dcc0, groundTexture: 'tile',
    walls: { base: '#3f8f5a', pattern: '#358050' }, light: 0.95,
    // Was 46 across at scale 1 — a third the width of every other stage and by
    // far the smallest in the game, so a full class had nowhere to hide. Now 78
    // (walls at ±39), which is a big room rather than a field, and the extra
    // floor is filled with real classroom kit instead of left bare.
    // scale spreads every position (walls, props, grids and spawn) together, so
    // the room grows without the furniture layout having to be re-authored.
    // 78 x 1.4 = 109 across, against 78 before and 46 before that.
    size: 78, scale: 1.7, spawn: [0, 0, 30],
    scatter: [
      // Book stacks & supplies dropped around the floor
      { type: 'bookstack', count: 9, colors: [0xcf5b5b, 0x5b7fcf, 0x5bcf7f, 0xf1c40f] },
      // Satchels and stools left between the rows
      { type: 'trashcan', count: 4, colors: [0x5b7fcf, 0x4f9d5b, 0xcf5b5b] },
      { type: 'pottedpalm', count: 8, colors: [0x3f7a45, 0x4a8a50, 0x356b3c] },
      // Extra tables and supply crates so the enlarged floor keeps its cover.
      // Deliberately not bookshelves — each is built from ~45 book meshes, and
      // a scattered dozen of them cost more draw calls than the rest of the
      // room put together (it took the map from 36fps to 17).
      { type: 'table', count: 6, colors: [0x9c6b3f] },
      { type: 'box', count: 8, colors: [0x9c6b3f, 0x8a6a4a], w: [1.2, 2], h: [0.8, 1.6], d: [1.2, 2], texture: 'wood' }
    ],
    // Six rows of six desks, each with its blue bench and notebook
    grid: [
      { type: 'desk', rows: 7, cols: 8, x0: -24.5, z0: -21, dx: 7, dz: 6.2, w: 2.4, ry: 0 },
      // Computer bench down the right-hand wall
      { type: 'computer', rows: 5, cols: 1, x0: 32, z0: -14, dx: 0, dz: 6.5, y: 1.35, ry: -1.5708 },
      // Coat hooks / cubby run along the back wall
      { type: 'box', rows: 1, cols: 7, x0: -21, z0: 37, dx: 7, dz: 0,
        w: 5.4, h: 3.4, d: 1.2, color: 0x8a6a4a }
    ],
    objects: [
      // ===== Front teaching wall (z = -39) =====
      { type: 'blackboard', x: -9, z: -38.4, y: 3.6, w: 17, h: 6, text: '1+1 = ?', ry: 0 },
      { type: 'blackboard', x: 11, z: -38.4, y: 3.6, w: 11, h: 6, text: 'ABC', ry: 0 },
      { type: 'clock', x: 22, z: -38.6, y: 7.6, r: 0.9, ry: 0 },
      { type: 'poster', x: -22, z: -38.6, y: 6, w: 3, h: 3.6, color: 0xfdf3d0, ry: 0 },
      { type: 'poster', x: -27, z: -38.6, y: 6, w: 3, h: 3.6, color: 0xffe0e6, ry: 0 },
      { type: 'poster', x: 27, z: -38.6, y: 6, w: 3, h: 3.6, color: 0xd7ecff, ry: 0 },
      { type: 'flag', x: -33, z: -35, h: 4.2, color: 0xd23b3b, color2: 0x2b4d9c },
      { type: 'flag', x: 33, z: -35, h: 4.2, color: 0x2f7fb5, color2: 0xf1c40f },
      // Teacher's desk: globe, books and a monitor
      { type: 'desk', x: 0, z: -32, w: 5, teacher: true, solid: true, cw: 5, cd: 2, ry: 0 },
      { type: 'globe', x: 1.8, z: -32, y: 1.55, r: 0.6 },
      { type: 'bookstack', x: -1.6, z: -32, y: 1.55, color: 0xcf5b5b },
      { type: 'computer', x: -3.4, z: -32, y: 1.55, s: 0.9, ry: 0.3 },
      // A low display shelf across the front of the room
      { type: 'box', x: -20, z: -33, w: 8, h: 1.4, d: 1.6, color: 0x9c6b3f },
      { type: 'box', x: 20, z: -33, w: 8, h: 1.4, d: 1.6, color: 0x9c6b3f },
      { type: 'globe', x: 20, z: -33, y: 1.4, r: 0.5 },

      // ===== Left wall: reading corner (facing +x) =====
      { type: 'bookshelf', x: -37.8, z: -26, w: 4, h: 5, ry: 1.5708, solid: true, cw: 0.8, cd: 4 },
      { type: 'bookshelf', x: -37.8, z: -19, w: 4, h: 5, ry: 1.5708, solid: true, cw: 0.8, cd: 4 },
      { type: 'bookshelf', x: -37.8, z: -12, w: 4, h: 5, ry: 1.5708, solid: true, cw: 0.8, cd: 4 },
      { type: 'bookshelf', x: -37.8, z: -5, w: 4, h: 5, ry: 1.5708, solid: true, cw: 0.8, cd: 4 },
      { type: 'bookshelf', x: -37.8, z: 9, w: 4, h: 5, ry: 1.5708, solid: true, cw: 0.8, cd: 4 },
      { type: 'bookshelf', x: -37.8, z: 16, w: 4, h: 5, ry: 1.5708, solid: true, cw: 0.8, cd: 4 },
      { type: 'bookshelf', x: -37.8, z: 23, w: 4, h: 5, ry: 1.5708, solid: true, cw: 0.8, cd: 4 },
      // Reading rug with a low table and cushions
      { type: 'box', x: -30, z: 2, w: 11, h: 0.06, d: 10, color: 0xc98f7a },
      { type: 'table', x: -30, z: 2, ry: 0.3 },
      { type: 'bookstack', x: -30, z: 2, y: 1.2, color: 0x5b7fcf },
      { type: 'box', x: -33.5, z: -1, w: 1.6, h: 0.5, d: 1.6, color: 0x5bcf7f },
      { type: 'box', x: -26.5, z: 5, w: 1.6, h: 0.5, d: 1.6, color: 0xf1c40f },
      { type: 'poster', x: -38.6, z: 2, y: 6.4, w: 3, h: 3.6, color: 0xfdf3d0, ry: 1.5708 },

      // ===== Right wall: computer bench + supplies (facing -x) =====
      { type: 'box', x: 33.4, z: -1, w: 2.6, h: 1.3, d: 32, color: 0x9c6b3f },
      { type: 'bookshelf', x: 37.8, z: 14, w: 4, h: 5, ry: -1.5708, solid: true, cw: 0.8, cd: 4 },
      { type: 'bookshelf', x: 37.8, z: 21, w: 4, h: 5, ry: -1.5708, solid: true, cw: 0.8, cd: 4 },
      { type: 'bookshelf', x: 37.8, z: 28, w: 4, h: 5, ry: -1.5708, solid: true, cw: 0.8, cd: 4 },
      { type: 'poster', x: 38.6, z: -20, y: 6.4, w: 3, h: 3.6, color: 0xd7ecff, ry: -1.5708 },
      { type: 'poster', x: 38.6, z: 4, y: 6.4, w: 3, h: 3.6, color: 0xe6ffd7, ry: -1.5708 },
      // Art table with paint pots
      { type: 'box', x: 27, z: 24, w: 7, h: 1.3, d: 3, color: 0x9c6b3f },
      { type: 'cylinder', x: 25, z: 24, r: 0.35, h: 0.6, y: 1.3, color: 0xe74c3c },
      { type: 'cylinder', x: 26.4, z: 24, r: 0.35, h: 0.6, y: 1.3, color: 0x3498db },
      { type: 'cylinder', x: 27.8, z: 24, r: 0.35, h: 0.6, y: 1.3, color: 0xf1c40f },
      { type: 'cylinder', x: 29.2, z: 24, r: 0.35, h: 0.6, y: 1.3, color: 0x5bcf7f },

      // ===== Back wall (z = +39): cubbies, posters, plants =====
      { type: 'poster', x: -30, z: 38.6, y: 6.4, w: 3, h: 3.6, color: 0xffe0e6, ry: 3.14159 },
      { type: 'poster', x: 30, z: 38.6, y: 6.4, w: 3, h: 3.6, color: 0xd7ecff, ry: 3.14159 },
      { type: 'clock', x: 0, z: 38.6, y: 7.6, r: 0.9, ry: 3.14159 },
      { type: 'pottedpalm', x: -35, z: 34, h: 4 },
      { type: 'pottedpalm', x: 35, z: 34, h: 4 },
      { type: 'pottedpalm', x: -35, z: -30, h: 3.6 },
      { type: 'pottedpalm', x: 35, z: -30, h: 3.6 }
    ],
    models: [
      { url: 'models/boombox.glb', x: -30, z: -33, height: 1.5, ry: 0.6, y: 1.4 },
      { url: 'models/bottle.glb', x: 22, z: -33, height: 1.4, ry: 0, y: 1.4 },
      // Stacked supply crates in the back corners for extra hiding cover
      { url: 'models/crate.glb', x: -31, z: 30, height: 1.7, ry: 0.4 },
      { url: 'models/crate.glb', x: -29.6, z: 31, height: 1.4, ry: 1.1 },
      { url: 'models/crate.glb', x: 31, z: 30, height: 1.7, ry: -0.4 },
      // A classmate or two already in the room (living decoys)
      { url: 'models/riggedfig.glb', x: -8, z: 20, height: 1.85, ry: 0.4 },
      { url: 'models/cesiumman.glb', x: 9, z: 25, height: 1.9, ry: -0.6 }
    ]
  },
  forest: {
    // Ancient misty forest: towering mossy trunks with canopies high
    // overhead, hanging vines, mossy boulders and stone ruins, ferns
    // everywhere, all swallowed by a deep teal haze — and full of wildlife
    name: '🌲 ป่าไม้', sky: 0x76a693, ground: 0x3f6e33, groundTexture: 'grass', groundTint: 0x6f9663,
    size: 92,
    fog: { color: 0x76a693, near: 28, far: 130 },
    sunColor: 0xcfe8d8, ambientColor: 0xbcd8c8, light: 0.85,
    grassTufts: 550,
    treeline: { colors: [0x14382a, 0x1a4530, 0x0f2f22], hMin: 16, hMax: 26 },
    scatter: [
      { type: 'bigtree', count: 14, colors: [0x6b4a2f, 0x5c3f28, 0x7a5a3a], r: [0.7, 1.5], h: [16, 26] },
      { type: 'rock', count: 12, colors: [0x7c8579, 0x6e7a6e, 0x8a9284], r: [0.8, 2.0] },
      { type: 'sphere', count: 12, colors: [0x2c5e38, 0x357045, 0x224d2e], r: [0.9, 1.9] },
      { type: 'cone', count: 6, colors: [0xcf5b5b, 0xe0e0d8], r: [0.5, 0.9], h: [0.8, 1.4] },
      { type: 'ruin', count: 5, colors: [0x77816f, 0x6a7565] },
      { type: 'deadtree', count: 4, colors: [0x4a3a2a, 0x3e3226] }
    ],
    objects: [
      // Giant landmark trees
      { type: 'bigtree', x: -9, z: -7, r: 1.6, h: 26, color: 0x6b4a2f },
      { type: 'bigtree', x: 10, z: -4, r: 1.4, h: 24, color: 0x5c3f28 },
      { type: 'bigtree', x: -4, z: 10, r: 1.3, h: 22, color: 0x7a5a3a },
      { type: 'bigtree', x: 13, z: 9, r: 1.5, h: 25, color: 0x6b4a2f },
      // Mossy stone ruins (the photo's ancient steps + wall)
      { type: 'ruin', x: -14, z: 2, big: true, color: 0x77816f },
      { type: 'ruin', x: 12, z: -12, big: true, color: 0x6a7565 },
      // Mossy boulder cluster
      { type: 'rock', x: 3, z: -3, r: 2.4, sy: 0.75, color: 0x7c8579 },
      { type: 'rock', x: 5.5, z: -1, r: 1.5, sy: 0.7, color: 0x8a9284 },
      { type: 'sphere', x: -3, z: 6, r: 1.8, color: 0x2c5e38 }
    ],
    models: [
      // A forest full of wildlife (living decoys — shooting them trips the siren)
      { url: 'models/fox.glb', x: -6, z: 3, height: 1.4, ry: 1 },
      { url: 'models/fox.glb', x: 9, z: 13, height: 1.3, ry: -2.2 },
      { url: 'models/fox.glb', x: -13, z: -10, height: 1.5, ry: 0.4 },
      { url: 'models/horse.glb', x: 4, z: 8, height: 3, ry: -0.5 },
      { url: 'models/horse.glb', x: -11, z: 12, height: 2.8, ry: 1.8 },
      { url: 'models/stork.glb', x: 7, z: 5, height: 2.8, ry: -1.2 },
      { url: 'models/stork.glb', x: -2, z: -12, height: 2.6, ry: 0.9 },
      { url: 'models/parrot.glb', x: -10, z: -3, height: 1.2, ry: 2, y: 2.5 },
      { url: 'models/parrot.glb', x: 6, z: -9, height: 1.1, ry: -0.7, y: 3.5 },
      { url: 'models/duck.glb', x: 1, z: 13, height: 1.3, ry: 0.3 },
      { url: 'models/duck.glb', x: -8, z: 7, height: 1.2, ry: 2.6 },
      { url: 'models/flamingo.glb', x: 12, z: -6, height: 2.6, ry: 1.5, y: 2 },
      // An ancient moss-covered statue lost in the woods + old supply crates
      { url: 'models/bust.glb', x: -15, z: -13, height: 3, ry: 0.7, noAnim: true },
      { url: 'models/crate.glb', x: 15, z: 4, height: 1.7, ry: 0.4 },
      { url: 'models/crate.glb', x: 16.2, z: 5, height: 1.4, ry: 1.1 },
      { url: 'models/fox.glb', x: 14, z: -14, height: 1.4, ry: -1 }
    ]
  },
  snow: {
    // Winter valley (Vikendi-style): towering snow-dusted pines with tall
    // bare trunks, weathered wooden cabins with gabled roofs, snowdrifts,
    // bare twig bushes poking through the snow, and a cold pale haze
    name: '❄️ ลานหิมะ', sky: 0xd9e8f4, ground: 0xf0f5fa, groundTexture: 'snow', clouds: true, size: 100,
    fog: { color: 0xd9e8f4, near: 40, far: 160 },
    sunColor: 0xffeed8, ambientColor: 0xdcebf8,
    treeline: { colors: [0x2a4a3c, 0x203d30, 0x16302a], hMin: 14, hMax: 24 },
    scatter: [
      { type: 'snowpine', count: 15, colors: [0x2a4a3c, 0x1f3d2e, 0x244536], r: [1.2, 2.2], h: [7, 13] },
      { type: 'sphere', count: 13, colors: [0xffffff, 0xeef6fb, 0xe0eef6], r: [0.9, 2.2] },
      { type: 'rock', count: 8, colors: [0x9aa4ac, 0x8a949c, 0xa8b2b8], r: [0.8, 1.8] },
      { type: 'twig', count: 10, colors: [0x6b4a2f, 0x5a3e28] },
      { type: 'cabin', count: 3, colors: [0x8a6a4a, 0x7a5c40, 0x6e5238] }
    ],
    objects: [
      // Weathered wooden cabins (the photo's barn)
      { type: 'cabin', x: 8, z: -10, w: 6, h: 3.2, d: 5, ry: 0.3 },
      { type: 'cabin', x: -13, z: 6, w: 5, h: 2.8, d: 4.5, ry: -1.2 },
      // Giant landmark pines
      { type: 'snowpine', x: -6, z: -6, r: 2, h: 13, color: 0x2a4a3c },
      { type: 'snowpine', x: 4, z: 6, r: 1.8, h: 11, color: 0x1f3d2e },
      { type: 'snowpine', x: 12, z: 2, r: 2.2, h: 14, color: 0x2a4a3c },
      { type: 'rock', x: -3, z: 10, r: 2, sy: 0.7, color: 0x9aa4ac },
      { type: 'sphere', x: 0, z: -13, r: 2.2, color: 0xffffff }
    ],
    models: [
      { url: 'models/fox.glb', x: -6, z: 4, height: 1.4, ry: 0.8 },
      { url: 'models/fox.glb', x: 10, z: 12, height: 1.3, ry: -1.8 },
      { url: 'models/stork.glb', x: 6, z: 6, height: 2.8, ry: -1 },
      { url: 'models/horse.glb', x: 3, z: -6, height: 3, ry: 1 },
      { url: 'models/duck.glb', x: -10, z: -8, height: 1.2, ry: 0.5 },
      // Supply crates stacked by the cabins
      { url: 'models/crate.glb', x: 10, z: -8, height: 1.8, ry: 0.3 },
      { url: 'models/crate.glb', x: 11.4, z: -7.2, height: 1.5, ry: 1.2 },
      { url: 'models/stork.glb', x: -12, z: 10, height: 2.8, ry: 0.5, y: 0.4 }
    ]
  },
  city: {
    // Blocky downtown (Minecraft-style): colorful window-grid towers with
    // rooftop signs, storefront shops with awnings, a central park, parked
    // cars, and litter everywhere — bins, bags, cardboard, traffic cones
    name: '🏙️ เมือง', sky: 0xa9cfe8, ground: 0x777777, groundTexture: 'asphalt', clouds: true, size: 100,
    fog: { color: 0xc2d6e4, near: 55, far: 200 },
    scatter: [
      { type: 'building', count: 10, colors: [0xc8763a, 0xb8524a, 0x9aa7b3, 0xe8e4da, 0x6f7d8c, 0xd0cfc8], w: [4, 6], h: [8, 18], d: [4, 6] },
      { type: 'shop', count: 6, colors: [0xe8ddc8, 0xd8c8b0, 0xc8d8b8, 0xd8bcc8] },
      { type: 'car', count: 8, colors: [0xd04a3a, 0x3a6ad0, 0xe8c83a, 0xf0f0f0, 0x3a3a40, 0x4aa860] },
      // ขยะเยอะๆ: bins, trash bags, cardboard piles, scattered litter
      { type: 'trashcan', count: 8, colors: [0x4a5a4a, 0x5a5a62] },
      { type: 'sphere', count: 14, colors: [0x26262c, 0x30303a, 0x3a3a30], r: [0.4, 0.9] },
      { type: 'box', count: 14, colors: [0xb99668, 0xa8875c, 0xdcd6c8, 0xc8c2b2], w: [0.4, 1.3], h: [0.25, 1.0], d: [0.4, 1.3] },
      { type: 'cone', count: 6, colors: [0xe07020, 0xd8641a], r: [0.28, 0.4], h: [0.7, 0.95] }
    ],
    objects: [
      // Landmark towers with rooftop signs (like the reference's BANK sign)
      { type: 'building', x: 13, z: -10, w: 6, h: 20, d: 6, color: 0xe8e4da, sign: 'BANK', signColor: 0xd63a3a },
      { type: 'building', x: -12, z: -8, w: 5.5, h: 15, d: 5, color: 0xc8763a, sign: 'HOTEL', signColor: 0xe8b83a },
      { type: 'building', x: -3, z: -14, w: 5, h: 12, d: 5, color: 0xb8524a, sign: 'MALL', signColor: 0x4ac8d6 },
      { type: 'building', x: 12, z: 10, w: 5, h: 16, d: 5, color: 0x8592a0 },
      { type: 'building', x: -13, z: 13, w: 4.5, h: 10, d: 4.5, color: 0x6f7d8c },
      // Shop row facing the park
      { type: 'shop', x: -10, z: 5, color: 0xe8ddc8, sign: 'SHOP', ry: 1.5708 },
      { type: 'shop', x: -10, z: 10, color: 0xd8c8b0, sign: 'CAFE', ry: 1.5708 },
      { type: 'shop', x: 5, z: -6, color: 0xc8d8b8, sign: 'ร้านค้า', ry: 0 },
      // Central park: lawn, trees, a bush
      { type: 'box', x: 1, z: 4, w: 10, h: 0.12, d: 8, color: 0x5fae4f },
      { type: 'cone', x: -1, z: 3, r: 1.2, h: 3.4, color: 0x2f7d40 },
      { type: 'cone', x: 4, z: 6, r: 1, h: 2.8, color: 0x3a8a4a },
      { type: 'sphere', x: 2, z: 2, r: 0.9, color: 0x4aa85a },
      // Parked cars
      { type: 'car', x: -5, z: 13, color: 0xd04a3a, ry: 0.1 },
      { type: 'car', x: 0, z: 13.2, color: 0x3a6ad0, ry: -0.08 },
      { type: 'car', x: 8, z: 2, color: 0xe8c83a, ry: 1.6 }
    ],
    models: [
      { url: 'models/truck.glb', x: -12, z: 8, height: 3, ry: 0.4 },
      { url: 'models/truck.glb', x: 20, z: -16, height: 3, ry: -1.8 },
      { url: 'models/toycar.glb', x: -6, z: 4, height: 2.6, ry: 0.5 },
      { url: 'models/toycar.glb', x: 6, z: 6, height: 2.6, ry: 2.5 },
      { url: 'models/boombox.glb', x: 4, z: -3, height: 1.5, ry: -0.5 },
      { url: 'models/camera.glb', x: -10, z: -2, height: 2.6, ry: 1 },
      { url: 'models/robot.glb', x: 14, z: 14, height: 2.4, ry: -0.8 },
      { url: 'models/soldier.glb', x: -3, z: -10, height: 1.9, ry: 0.5 },
      // Delivery vans + a loading dock of crates (extra street cover)
      { url: 'models/milktruck.glb', x: 16, z: 6, height: 3, ry: 1.4 },
      { url: 'models/milktruck.glb', x: -16, z: -14, height: 3, ry: -0.6 },
      { url: 'models/crate.glb', x: 10, z: -4, height: 2, ry: 0.2 },
      { url: 'models/crate.glb', x: 11.6, z: -4.4, height: 1.6, ry: 0.9 },
      { url: 'models/crate.glb', x: 10.4, z: -2.6, height: 1.7, ry: -0.5 },
      // Pedestrians + a street robot (living decoys — shooting them trips the siren)
      { url: 'models/cesiumman.glb', x: -2, z: 8, height: 1.9, ry: 0.3 },
      { url: 'models/cesiumman.glb', x: 2, z: 9, height: 1.9, ry: -0.6 },
      { url: 'models/robotexp.glb', x: 8, z: 8, height: 2.1, ry: 1.4 }
    ]
  },
  ocean: {
    // Deep-sea colony (Aquatico-style): glowing glass-dome habitats on a
    // bluish seabed, colorful coral, tall swaying kelp, rock spires, rising
    // bubbles, patrolling subs, and debris scattered on the sand
    name: '🐠 ใต้ทะเล', sky: 0x0b3f61, ground: 0xdcc98f, groundTexture: 'sand', groundTint: 0x8fa9ad,
    size: 90,
    fog: { color: 0x0e4a6e, near: 26, far: 120 }, light: 0.9,
    sunColor: 0x9fd8ec, ambientColor: 0x6fb0d0, bubbles: 70,
    scatter: [
      { type: 'coral', count: 18, colors: [0xe57373, 0xba68c8, 0x7986cb, 0x4db6ac, 0xf06292, 0xffb74d] },
      { type: 'kelp', count: 20, colors: [0x2f8f5f, 0x3aa06a, 0x267a4e] },
      { type: 'rockspire', count: 7, colors: [0x5a6b6e, 0x4e5f62, 0x66787a] },
      // ขยะ/เศษซากใต้ทะเล: ถังผุ ลัง หินกอง
      { type: 'barrel', count: 9, colors: [0x6a7a5a, 0x5a6a72, 0x7a6a4a] },
      { type: 'box', count: 8, colors: [0x8a7a5a, 0x6a6a62, 0x7a6a4a], w: [0.5, 1.1], h: [0.4, 0.9], d: [0.5, 1.1] },
      { type: 'sub', count: 4, colors: [0xf0c020, 0xe8801a, 0xe0e0e0] }
    ],
    objects: [
      // Central big dome habitat (the Aquatico main dome) + satellite domes
      { type: 'dome', x: 0, z: -3, r: 4, color: 0x3a6a80 },
      { type: 'dome', x: -11, z: 6, r: 2.5, color: 0x35607a },
      { type: 'dome', x: 11, z: 4, r: 2.3, color: 0x3a6a80 },
      { type: 'dome', x: 8, z: -12, r: 2, color: 0x35607a },
      { type: 'dome', x: -9, z: -10, r: 1.8, color: 0x3a6a80 },
      // Rock spires framing the colony
      { type: 'rockspire', x: -15, z: -7, r: 2, h: 13, color: 0x5a6b6e },
      { type: 'rockspire', x: 15, z: 11, r: 2.2, h: 15, color: 0x4e5f62 },
      // Coral gardens + a couple of subs docked near the domes
      { type: 'coral', x: -6, z: 9, color: 0xe57373 },
      { type: 'coral', x: 6, z: 8, color: 0xba68c8 },
      { type: 'sub', x: -4, z: 2, color: 0xf0c020, ry: 0.4 },
      { type: 'sub', x: 6, z: -6, color: 0xe8801a, ry: -1.2 }
    ],
    models: [
      // Sea life everywhere (living decoys — shooting them trips the siren)
      { url: 'models/fish.glb', x: -6, z: 4, height: 1.6, ry: 0.5, y: 2.5 },
      { url: 'models/fish.glb', x: 9, z: -8, height: 2.2, ry: -2, y: 4 },
      { url: 'models/fish.glb', x: 16, z: 12, height: 1.2, ry: 1.2, y: 2 },
      { url: 'models/fish.glb', x: -14, z: -3, height: 1.4, ry: 0.8, y: 5 },
      { url: 'models/fish.glb', x: 3, z: 13, height: 1.8, ry: -0.6, y: 3 },
      { url: 'models/duck.glb', x: -12, z: 10, height: 1.6, ry: 0.5, y: 6 },
      { url: 'models/flamingo.glb', x: 7, z: 5, height: 2.8, ry: -1, y: 3 },
      // Sunken shipping crates half-buried in the sand
      { url: 'models/crate.glb', x: -8, z: -6, height: 2, ry: 0.3 },
      { url: 'models/crate.glb', x: -6.6, z: -5.4, height: 1.6, ry: 1 },
      { url: 'models/crate.glb', x: 12, z: -10, height: 1.8, ry: -0.4 },
      // Odd drifting sea-creatures (living decoys)
      { url: 'models/brainstem.glb', x: -5, z: 6, height: 1.8, ry: 0.4, y: 2 },
      { url: 'models/brainstem.glb', x: 7, z: -4, height: 1.6, ry: 1.6, y: 3 }
    ]
  },
  space: {
    // "Under the stars": a night meadow of teal grass beneath a star-packed
    // sky — giant glowing jellyfish drift overhead, neon comets streak past,
    // fireflies rise from the grass, glowing flowers dot the hills
    name: '🌌 ใต้แสงดาว', sky: 0x070b1e, ground: 0x1b3a34, groundTexture: 'grass', groundTint: 0x2a8a80,
    size: 90,
    light: 0.6, sunColor: 0xb8d0f0, ambientColor: 0x9fb8d8,
    fog: { color: 0x0a1226, near: 45, far: 170 },
    stars: 450, comets: 18, bubbles: 55,
    grassTufts: 620, grassTint: 0x35a093,
    scatter: [
      { type: 'glowflower', count: 14, colors: [0xff4ad8, 0xb04aff, 0x4ad8ff] },
      { type: 'rock', count: 11, colors: [0x3a4a52, 0x2f3d46], r: [0.8, 2.0] },
      { type: 'tent', count: 6, colors: [0x1e1e26, 0x24242e] },
      { type: 'deadtree', count: 5, colors: [0x1a2028, 0x141a22] },
      { type: 'sphere', count: 7, colors: [0x24303a, 0x2c3a44], r: [0.8, 1.6] }
    ],
    objects: [
      // Giant jellyfish floating in the night sky
      { type: 'jellyfish', x: 2, z: -6, y: 13, r: 4.5, color: 0x8a7ab8 },
      { type: 'jellyfish', x: -10, z: 5, y: 11, r: 3, color: 0x7a6ab0 },
      { type: 'jellyfish', x: 12, z: 8, y: 15, r: 3.5, color: 0x9a8ac8 },
      { type: 'jellyfish', x: -6, z: -12, y: 10, r: 2.5, color: 0x8a7ab8 },
      // Campsite tents + glowing flower patches on the hill
      { type: 'tent', x: -8, z: 8, color: 0x1e1e26, ry: 0.4 },
      { type: 'tent', x: 6, z: 10, color: 0x24242e, ry: -0.8 },
      { type: 'glowflower', x: 3, z: 3, color: 0xff4ad8 },
      { type: 'glowflower', x: -4, z: -3, color: 0xb04aff },
      { type: 'rock', x: 10, z: -8, r: 2, sy: 0.7, color: 0x3a4a52 }
    ],
    models: [
      { url: 'models/robotcute.glb', x: 3, z: 8, height: 2.2, ry: -0.6 },
      { url: 'models/fox.glb', x: -7, z: -7, height: 1.4, ry: 1.2 },
      { url: 'models/duck.glb', x: 9, z: 4, height: 1.3, ry: -0.5 },
      // A mysterious monolithic statue + a campsite crate under the stars
      { url: 'models/bust.glb', x: -12, z: 10, height: 3.4, ry: 0.5, noAnim: true },
      { url: 'models/crate.glb', x: 8, z: 11, height: 1.7, ry: 0.6 },
      { url: 'models/robot.glb', x: 13, z: -6, height: 2.4, ry: 2 },
      // Drifting alien wanderers (living decoys — shooting them trips the siren)
      { url: 'models/brainstem.glb', x: -3, z: 5, height: 1.7, ry: 0.4 },
      { url: 'models/brainstem.glb', x: 5, z: -4, height: 1.6, ry: 1.5 },
      { url: 'models/robotexp.glb', x: -8, z: -3, height: 2.1, ry: 2.2 }
    ]
  },
  volcano: {
    // Erupting volcano land: a giant smoking cone with fire at the crater
    // and lava streaking down its slopes, flowing lava rivers + pools,
    // glowing-crack volcanic rocks, dead trees, embers rising through a
    // deep-red haze
    name: '🌋 ภูเขาไฟ', sky: 0x7a1f10, ground: 0x3a2a24, size: 100, light: 0.7,
    fog: { color: 0x6e2414, near: 40, far: 165 },
    sunColor: 0xffb070, ambientColor: 0xd08860,
    bubbles: 45, bubbleColor: 0xffa040, bubbleGlow: 0xff5a10, bubbleOpacity: 0.85,
    lava: [
      // Rivers running from the volcano + standing pools
      { x: -3, z: 2, w: 8, len: 62, ry: 0.25, speed: 0.22 },
      { x: 14, z: -2, w: 6, len: 46, ry: -0.5, speed: 0.16 },
      { x: -14, z: 10, r: 7, speed: 0.08 },
      { x: 9, z: 13, r: 5, speed: 0.08 }
    ],
    scatter: [
      { type: 'lavarock', count: 12, colors: [0x2e2a28], r: [1.0, 2.4] },
      { type: 'rock', count: 12, colors: [0x3a322e, 0x453a34, 0x2c2522], r: [0.9, 2.2] },
      { type: 'deadtree', count: 10, colors: [0x241c18, 0x2e241e] },
      { type: 'sphere', count: 6, colors: [0xd35400, 0xe67e22], r: [0.4, 0.8] },
      { type: 'rockspire', count: 5, colors: [0x2c2522, 0x352c28, 0x3e332c] }
    ],
    objects: [
      // The big erupting volcano + a smaller vent
      { type: 'volcano', x: 0, z: -16, r: 16, h: 22 },
      { type: 'volcano', x: 15, z: 9, r: 8, h: 11 },
      // Glowing-crack boulder field near the flows
      { type: 'lavarock', x: -8, z: -4, r: 2.6, sy: 0.8 },
      { type: 'lavarock', x: 7, z: 3, r: 2, sy: 0.75 },
      { type: 'deadtree', x: -12, z: 4, color: 0x241c18 },
      { type: 'deadtree', x: 5, z: 9, color: 0x2e241e },
      { type: 'rock', x: -5, z: 12, r: 2.2, sy: 0.7, color: 0x3a322e }
    ],
    models: [
      { url: 'models/fox.glb', x: -6, z: 4, height: 1.4, ry: 1 },
      { url: 'models/horse.glb', x: 6, z: 5, height: 3, ry: -1 },
      { url: 'models/stork.glb', x: 3, z: -3, height: 2.8, ry: 2, y: 2.5 },
      { url: 'models/helmet.glb', x: -12, z: -8, height: 1.6, ry: 0.8, y: 0.4 },
      { url: 'models/truck.glb', x: 14, z: 12, height: 3, ry: -2.2 },
      // Expedition supply crates + a survey rover near the flows
      { url: 'models/crate.glb', x: -10, z: 8, height: 1.9, ry: 0.4 },
      { url: 'models/crate.glb', x: -8.6, z: 8.8, height: 1.5, ry: 1.1 },
      { url: 'models/robot.glb', x: 10, z: -10, height: 2.4, ry: 1.5 },
      // A skittering mechanical survey unit picking through the rocks (living decoy)
      { url: 'models/brainstem.glb', x: -4, z: 6, height: 1.7, ry: 0.5 }
    ]
  },
  farm: {
    // Hay-Day-style open farm: a red barn with white cross doors + silo,
    // planted crop plots in neat rows (wheat / carrots / berries), white
    // picket fences, scarecrows, apple trees, barrels, lamps and hay bales
    name: '🚜 โรงนาฟาร์ม', sky: 0x8fd4ea, ground: 0x7bb35a, groundTexture: 'grass', light: 0.9,
    clouds: true, size: 92,
    fog: { color: 0xcfe8dc, near: 60, far: 210 },
    grassTufts: 350,
    treeline: { colors: [0x2f8d46, 0x3aa055, 0x27803d], hMin: 8, hMax: 14 },
    spawn: [0, 0, 8],
    scatter: [
      { type: 'fruittree', count: 7, colors: [0x3aa055, 0x2f8d46] },
      // Hay bale stacks (the classic hiding spot)
      { type: 'box', count: 11, colors: [0xd6b45a, 0xc9a94e, 0xe0c068], w: [1.8, 2.6], h: [1.4, 2.2], d: [1.8, 2.6], texture: 'wood' },
      { type: 'barrel', count: 7, colors: [0x9c6b3f, 0x8a5a34] },
      // Produce crates + pumpkins
      { type: 'box', count: 6, colors: [0xb08a55, 0x9c7a48], w: [1, 1.6], h: [0.8, 1.2], d: [1, 1.6], texture: 'wood' },
      { type: 'sphere', count: 6, colors: [0xe08a2a, 0xd6762a], r: [0.4, 0.7] },
      { type: 'lamp', count: 3, colors: [0x222226] }
    ],
    objects: [
      // Red barn + silo (the Hay Day landmark pair)
      { type: 'barn', x: -10.5, z: -10, w: 10, h: 6, d: 8 },
      { type: 'silo', x: -14.8, z: -8.5, r: 1.9, h: 9.5 },
      // Crop plots in rows
      { type: 'crop', x: 4.5, z: -9, w: 18, d: 9, crop: 'wheat' },
      { type: 'crop', x: 4.5, z: -3, w: 18, d: 9, crop: 'carrot' },
      { type: 'crop', x: -5.5, z: 3, w: 15, d: 9, crop: 'berry' },
      // White picket fence around the carrot plot
      { type: 'fence', x: 4.5, z: -4.9, w: 19.6, ry: 0 },
      { type: 'fence', x: 4.5, z: -1.1, w: 19.6, ry: 0 },
      { type: 'fence', x: 0.58, z: -3, w: 9.6, ry: 1.5708 },
      { type: 'fence', x: 8.42, z: -3, w: 9.6, ry: 1.5708 },
      // Scarecrows guarding the fields
      { type: 'scarecrow', x: 2, z: -9 },
      { type: 'scarecrow', x: 7, z: -3 },
      { type: 'scarecrow', x: -5.5, z: 3.5 },
      // Barrel row beside the barn + garden lamps
      { type: 'barrel', x: -7.5, z: -7.5, upright: true },
      { type: 'barrel', x: -7.5, z: -6.4, upright: true },
      { type: 'barrel', x: -7.5, z: -5.3, upright: true },
      { type: 'barrel', x: -6.4, z: -7.5, upright: true },
      { type: 'lamp', x: 0, z: 6 },
      { type: 'lamp', x: 9, z: -6.5 },
      { type: 'lamp', x: -9, z: 0 },
      // Apple trees dotted around
      { type: 'fruittree', x: 12, z: 8 },
      { type: 'fruittree', x: -12, z: 10 },
      { type: 'fruittree', x: 13, z: -2 },
      // Water trough
      { type: 'box', x: -12, z: 6, w: 2.5, h: 0.8, d: 1.2, color: 0x8a8a90 }
    ],
    models: [
      { url: 'models/horse.glb', x: -10, z: -10, height: 3, ry: 0.8 },
      { url: 'models/horse.glb', x: 12, z: 8, height: 2.8, ry: -1.6 },
      { url: 'models/duck.glb', x: 4, z: 6, height: 1.4, ry: 1 },
      { url: 'models/duck.glb', x: 6, z: 8, height: 1.2, ry: -2 },
      { url: 'models/fox.glb', x: -6, z: 14, height: 1.4, ry: 2 },
      { url: 'models/truck.glb', x: 16, z: 2, height: 3, ry: -0.8 },
      { url: 'models/stork.glb', x: -14, z: 2, height: 2.8, ry: 0.5, y: 2.5 },
      // A delivery van + stacked produce crates by the barn
      { url: 'models/milktruck.glb', x: -3, z: -12, height: 3, ry: 0.6 },
      { url: 'models/crate.glb', x: 2, z: 5, height: 1.8, ry: 0.3 },
      { url: 'models/crate.glb', x: 3.4, z: 5.6, height: 1.5, ry: 1 },
      // A farmhand out in the yard (living decoy)
      { url: 'models/cesiumman.glb', x: 7, z: 4, height: 1.9, ry: 0.6 }
    ]
  },
  village: {
    // Lively market town: a mini-mart with a striped fascia, storefront
    // shops with signs, two lanes of awning market stalls, supermarket
    // produce bins piled with fruit, and hotpot restaurant tables
    name: '🏘️ หมู่บ้านตลาด', sky: 0xa8d8ea, ground: 0x8a7d68, groundTexture: 'cobble', light: 0.95,
    size: 92,
    fog: { color: 0xc8dde8, near: 55, far: 200 },
    spawn: [0, 0, 24],
    scatter: [
      // Timber-framed houses with teal roofs as the backdrop
      { type: 'box', count: 6, colors: [0xe8dcc0, 0xdcd0b4, 0xd4c8ac], w: [4, 6], h: [4, 6], d: [4, 6], texture: 'wood' },
      { type: 'cone', count: 6, colors: [0x3a8a96, 0x2f7d88, 0x46969f], r: [3, 4.5], h: [3, 4.5], y: [4, 6] },
      // Extra market sprawl: stalls, produce bins, hotpot tables
      { type: 'stall', count: 3, colors: [0xd0483a, 0x2f8d5a, 0xe8a02a] },
      { type: 'producebin', count: 4, colors: [0xd83a3a, 0xe8a02a, 0x8ac44a, 0x9b59b6] },
      { type: 'table', count: 2, colors: [0x9c6b3f] },
      // Market crates, sacks and produce
      { type: 'box', count: 10, colors: [0x8a6a4a, 0xb08a5a], w: [0.8, 1.4], h: [0.6, 1.1], d: [0.8, 1.4], texture: 'wood' },
      { type: 'sphere', count: 8, colors: [0xece4d4, 0xe0a52a, 0x8ac44a], r: [0.35, 0.65] },
      // Wood barrels
      { type: 'cylinder', count: 6, colors: [0x7a5a3a, 0x6a4a2f], r: [0.5, 0.7], h: [1, 1.4] }
    ],
    objects: [
      // Mini-mart with the striped fascia + storefront shop row
      { type: 'minimart', x: -9, z: -12, w: 9, h: 3.4, d: 5.5 },
      { type: 'shop', x: 0, z: -12, color: 0xe8ddc8, sign: 'PIZZA', signColor: 0xd0483a, ry: 0 },
      { type: 'shop', x: 4.5, z: -12, color: 0xd8c8b0, sign: 'CAFE', signColor: 0x8a5a34, ry: 0 },
      { type: 'shop', x: 9, z: -12, color: 0xc8d8b8, sign: 'ร้านค้า', signColor: 0x2f8d5a, ry: 0 },
      // Market lane: two rows of awning stalls facing each other
      { type: 'stall', x: -8, z: -4, awning: 0xd0483a, ry: 0 },
      { type: 'stall', x: -4, z: -4, awning: 0x2f8d5a, ry: 0 },
      { type: 'stall', x: 0, z: -4, awning: 0xe8a02a, ry: 0 },
      { type: 'stall', x: 4, z: -4, awning: 0x3a6ad0, ry: 0 },
      { type: 'stall', x: 8, z: -4, awning: 0xd0483a, ry: 0 },
      { type: 'stall', x: -8, z: 2, awning: 0xe8a02a, ry: 3.14159 },
      { type: 'stall', x: -4, z: 2, awning: 0x3a6ad0, ry: 3.14159 },
      { type: 'stall', x: 0, z: 2, awning: 0xd0483a, ry: 3.14159 },
      { type: 'stall', x: 4, z: 2, awning: 0x2f8d5a, ry: 3.14159 },
      { type: 'stall', x: 8, z: 2, awning: 0xe8a02a, ry: 3.14159 },
      // Supermarket produce corner: bins piled with fruit
      { type: 'producebin', x: -12, z: 6, color: 0xd83a3a },
      { type: 'producebin', x: -10, z: 6, color: 0xe8a02a },
      { type: 'producebin', x: -8, z: 6, color: 0x8ac44a },
      { type: 'producebin', x: -12, z: 8, color: 0xe08a2a, squash: true },
      { type: 'producebin', x: -10, z: 8, color: 0x9b59b6 },
      // Hotpot restaurant corner: round tables with stools + pots
      { type: 'table', x: 10, z: 7 },
      { type: 'table', x: 13, z: 7 },
      { type: 'table', x: 11.5, z: 9.5 },
      // Village well stays
      { type: 'cylinder', x: 8, z: 12, r: 1.2, h: 1.2, color: 0x8a8a90, texture: 'brick' },
      { type: 'cone', x: 8, z: 12, r: 1.6, h: 1.4, y: 3, color: 0x6a4a2f }
    ],
    models: [
      { url: 'models/lantern.glb', x: -5, z: -8, height: 3.2, ry: 0.5 },
      { url: 'models/lantern.glb', x: 6, z: 6, height: 3.2, ry: -1 },
      { url: 'models/horse.glb', x: -12, z: 10, height: 2.8, ry: 1.2 },
      { url: 'models/duck.glb', x: 2, z: 8, height: 1.3, ry: -0.5 },
      { url: 'models/fancychair.glb', x: -8, z: -12, height: 2.2, ry: 0.8 },
      { url: 'models/dish.glb', x: 0, z: 0, height: 0.5, ry: 0, y: 1.2 },
      { url: 'models/barnlamp.glb', x: 11.5, z: -8, height: 1.2, ry: 0, y: 2.4 },
      // Market delivery van, a town-square statue, and stacked crates
      { url: 'models/milktruck.glb', x: 13, z: -10, height: 3, ry: -1.2 },
      { url: 'models/bust.glb', x: -6, z: 14, height: 3, ry: 0.4, noAnim: true },
      { url: 'models/crate.glb', x: 6, z: -6, height: 1.7, ry: 0.3 },
      { url: 'models/crate.glb', x: 7.3, z: -5.4, height: 1.4, ry: 1.1 },
      // Market-goers wandering the stalls (living decoys)
      { url: 'models/cesiumman.glb', x: -2, z: 6, height: 1.9, ry: 0.4 },
      { url: 'models/cesiumman.glb', x: 3, z: 7, height: 1.9, ry: -0.5 },
      { url: 'models/riggedfig.glb', x: 6, z: 10, height: 1.9, ry: 1.2 }
    ]
  },
  nighttown: {
    // Haunted Thai night square: pitch dark and swallowed by fog — krasue
    // heads and sheet ghosts drift through the air, ghost kids and
    // spider-legged ghouls lurk in the shadows between dead trees, old
    // cabins and dim lanterns, all under a pale moon
    name: '👻 จัตุรัสผีหลอน', sky: 0x05060e, ground: 0x3a3a42, size: 100, light: 0.52, groundTexture: 'cobble', groundTint: 0x686874,
    fog: { color: 0x080a14, near: 20, far: 105 },
    sunColor: 0x8090c0, ambientColor: 0x7880a8,
    stars: 260, sunGlow: 0xe8ecf8,
    bubbles: 30, bubbleColor: 0xa0ffc0, bubbleGlow: 0x40ff80, bubbleOpacity: 0.5,
    spirits: 8,
    scatter: [
      // Dark abandoned townhouses, a few windows still lit
      { type: 'box', count: 8, colors: [0x2e2836, 0x352c3e, 0x2a2430], w: [4, 7], h: [8, 14], d: [4, 7], texture: 'brick' },
      { type: 'box', count: 10, colors: [0xffd98a], emissive: 0xffb84a, emissiveIntensity: 1.1, w: [0.7, 1.1], h: [0.9, 1.3], d: [0.25, 0.3], y: [2, 8] },
      // Ghosts lurking everywhere
      { type: 'ghostkid', count: 4, colors: [0xded6c8] },
      { type: 'spiderghost', count: 3, colors: [0x16100e] },
      // Dead trees, crumbling ruins, eerie glowing flowers
      { type: 'deadtree', count: 7, colors: [0x241c18, 0x1c1512] },
      { type: 'ruin', count: 3, colors: [0x4a4a44, 0x3f3f3a] },
      { type: 'glowflower', count: 5, colors: [0xb04aff, 0x4a7aff] },
      // Night street clutter: trash bags + cardboard
      { type: 'sphere', count: 6, colors: [0x26262c, 0x1e1e24], r: [0.5, 0.85] },
      { type: 'box', count: 6, colors: [0xb99668, 0xa8875c], w: [0.7, 1.3], h: [0.5, 1], d: [0.7, 1.3] }
    ],
    objects: [
      // Central fountain, now murky in the dark
      { type: 'cylinder', x: 0, z: 0, r: 3, h: 1, color: 0x5a5560 },
      { type: 'cylinder', x: 0, z: 0, r: 1, h: 2.6, color: 0x6a6472 },
      // Giant dark trees looming over the square
      { type: 'bigtree', x: -9, z: -8, r: 1.4, h: 20, color: 0x241c18 },
      { type: 'bigtree', x: 10, z: 7, r: 1.2, h: 18, color: 0x1c1512 },
      // Abandoned wooden cabins (no snow — 'bare')
      { type: 'cabin', x: -12, z: 6, w: 5, h: 2.8, d: 4.5, ry: 0.5, bare: true },
      { type: 'cabin', x: 11, z: -9, w: 5.5, h: 3, d: 4.5, ry: -1.1, bare: true },
      // Ghosts standing right in the lamplight
      { type: 'ghostkid', x: 3, z: -4 },
      { type: 'ghostkid', x: -6, z: 9 },
      { type: 'spiderghost', x: -3, z: -10 },
      // Street lamps: dark poles + dimmer warm globes
      { type: 'cylinder', x: -8, z: -8, r: 0.15, h: 4.5, color: 0x2e2e38 },
      { type: 'sphere', x: -8, z: -8, r: 0.45, y: 4.2, color: 0xffe0a0, emissive: 0xffc860, emissiveIntensity: 1 },
      { type: 'cylinder', x: 8, z: -8, r: 0.15, h: 4.5, color: 0x2e2e38 },
      { type: 'sphere', x: 8, z: -8, r: 0.45, y: 4.2, color: 0xffe0a0, emissive: 0xffc860, emissiveIntensity: 1 },
      { type: 'cylinder', x: -8, z: 8, r: 0.15, h: 4.5, color: 0x2e2e38 },
      { type: 'sphere', x: -8, z: 8, r: 0.45, y: 4.2, color: 0xffe0a0, emissive: 0xffc860, emissiveIntensity: 1 },
      { type: 'cylinder', x: 8, z: 8, r: 0.15, h: 4.5, color: 0x2e2e38 },
      { type: 'sphere', x: 8, z: 8, r: 0.45, y: 4.2, color: 0xffe0a0, emissive: 0xffc860, emissiveIntensity: 1 }
    ],
    models: [
      { url: 'models/lantern.glb', x: -14, z: 4, height: 3.5, ry: 0.5 },
      { url: 'models/lantern.glb', x: 14, z: -6, height: 3.5, ry: -0.8 },
      // Creepy props: an old statue and a stray severed head
      { url: 'models/statue.glb', x: 6, z: 12, height: 2.6, ry: -2.2 },
      { url: 'models/head.glb', x: -10, z: -14, height: 1.2, ry: 1.2 },
      { url: 'models/fox.glb', x: 3, z: -5, height: 1.4, ry: -1 },
      // A weathered ancient bust looming in the fog + abandoned crates
      { url: 'models/bust.glb', x: -13, z: 12, height: 3.2, ry: 0.6, noAnim: true },
      { url: 'models/crate.glb', x: 13, z: 4, height: 1.8, ry: 0.3 },
      { url: 'models/crate.glb', x: 14.2, z: 4.8, height: 1.5, ry: 1.2 },
      // Shambling silhouettes lurking in the fog (living decoys)
      { url: 'models/brainstem.glb', x: -4, z: 4, height: 1.7, ry: 0.6 },
      { url: 'models/brainstem.glb', x: 5, z: -3, height: 1.6, ry: 2.1 },
      { url: 'models/riggedfig.glb', x: 2, z: 8, height: 1.9, ry: -1.2 }
    ]
  },
  shopstreet: {
    name: '🏮 ถนนการค้า', sky: 0x2e2438, ground: 0x6e6a72, size: 90, spawn: [0, 0, 30], light: 0.65, groundTexture: 'cobble',
    scatter: [
      // Hanging round lanterns glowing red/orange along the street
      { type: 'sphere', count: 18, colors: [0xe04a3a, 0xe0663a, 0xd63a4a], emissive: 0xff5030, emissiveIntensity: 1.1, r: [0.3, 0.45], y: [2.8, 4] },
      // Market stalls and crates
      { type: 'box', count: 8, colors: [0x8a6a4a, 0xa03a3a, 0x3a6a8a], w: [1.8, 3], h: [1.4, 2.2], d: [1.5, 2.5] },
      // Vertical shop banners (thin glowing signs)
      { type: 'box', count: 10, colors: [0xd63a4a, 0xe0c060, 0x4ac8d6], emissive: 0x903030, emissiveIntensity: 0.5, w: [0.6, 0.9], h: [3, 4.5], d: [0.15, 0.2], y: [1.5, 3] },
      // Street clutter: traffic cones, cardboard boxes, trash bags
      { type: 'cone', count: 6, colors: [0xe07020, 0xd8641a], r: [0.28, 0.4], h: [0.7, 0.95] },
      { type: 'box', count: 8, colors: [0xb99668, 0xa8875c, 0xc2a077], w: [0.7, 1.3], h: [0.5, 1], d: [0.7, 1.3] },
      { type: 'sphere', count: 8, colors: [0x26262c, 0x1e1e24], r: [0.5, 0.9] }
    ],
    objects: [
      // Two facing rows of shops forming the street (walkway down the middle)
      { type: 'box', x: -12, z: -18, w: 8, h: 9, d: 7, color: 0x9a4a42, texture: 'brick' },
      { type: 'box', x: -12, z: -6, w: 8, h: 7, d: 7, color: 0xb8b0a5, texture: 'wood' },
      { type: 'box', x: -12, z: 6, w: 8, h: 10, d: 7, color: 0x8a4a52, texture: 'brick' },
      { type: 'box', x: -12, z: 18, w: 8, h: 8, d: 7, color: 0xa5a0b8, texture: 'dots' },
      { type: 'box', x: 12, z: -18, w: 8, h: 8, d: 7, color: 0xb0a595, texture: 'wood' },
      { type: 'box', x: 12, z: -6, w: 8, h: 10, d: 7, color: 0x9a4a42, texture: 'brick' },
      { type: 'box', x: 12, z: 6, w: 8, h: 7, d: 7, color: 0x8a5262, texture: 'dots' },
      { type: 'box', x: 12, z: 18, w: 8, h: 9, d: 7, color: 0xb8b0a5, texture: 'brick' },
      // Big glowing shop sign at the street entrance
      { type: 'box', x: 0, z: -28, w: 10, h: 3, d: 0.5, y: 5, color: 0xd63a4a, emissive: 0xff4030, emissiveIntensity: 0.9 },
      // Stacked lit sign columns on building corners (yakitori-alley style)
      { type: 'cylinder', x: -7.5, z: -12, r: 0.12, h: 7, color: 0x3a3a40 },
      { type: 'box', x: -7.5, z: -12, w: 1.4, h: 1.2, d: 0.3, y: 2, color: 0xf2ead6, emissive: 0xffe8b0, emissiveIntensity: 0.9 },
      { type: 'box', x: -7.5, z: -12, w: 1.4, h: 1.2, d: 0.3, y: 3.6, color: 0xd63a4a, emissive: 0xff5040, emissiveIntensity: 0.9 },
      { type: 'box', x: -7.5, z: -12, w: 1.4, h: 1.2, d: 0.3, y: 5.2, color: 0xf2ead6, emissive: 0xffe8b0, emissiveIntensity: 0.9 },
      { type: 'cylinder', x: 7.5, z: 2, r: 0.12, h: 7, color: 0x3a3a40 },
      { type: 'box', x: 7.5, z: 2, w: 1.4, h: 1.2, d: 0.3, y: 2, color: 0xe0c060, emissive: 0xffd860, emissiveIntensity: 0.9 },
      { type: 'box', x: 7.5, z: 2, w: 1.4, h: 1.2, d: 0.3, y: 3.6, color: 0x2a2a30, emissive: 0xfff0c0, emissiveIntensity: 0.5 },
      { type: 'box', x: 7.5, z: 2, w: 1.4, h: 1.2, d: 0.3, y: 5.2, color: 0xd63a4a, emissive: 0xff5040, emissiveIntensity: 0.9 },
      // Giant red mascot ball perched on a shop corner
      { type: 'sphere', x: 12, z: -10, r: 1.6, y: 8.5, color: 0xd63a3a, emissive: 0x7a1a1a, emissiveIntensity: 0.5 },
      // Street lamp clusters
      { type: 'cylinder', x: -4, z: 10, r: 0.1, h: 4.5, color: 0x4a4a50 },
      { type: 'sphere', x: -4, z: 10, r: 0.3, y: 4.4, color: 0xfff2d0, emissive: 0xffe8a0, emissiveIntensity: 1.3 },
      { type: 'cylinder', x: 4, z: -20, r: 0.1, h: 4.5, color: 0x4a4a50 },
      { type: 'sphere', x: 4, z: -20, r: 0.3, y: 4.4, color: 0xfff2d0, emissive: 0xffe8a0, emissiveIntensity: 1.3 }
    ],
    models: [
      { url: 'models/truck.glb', x: 0, z: -14, height: 3, ry: 1.2 },
      { url: 'models/boombox.glb', x: -6, z: 10, height: 1.4, ry: 0.6 },
      { url: 'models/chair.glb', x: 6, z: 0, height: 2.2, ry: -1.2 },
      { url: 'models/bottle.glb', x: -5, z: -4, height: 1.3, ry: 0 },
      { url: 'models/fox.glb', x: 4, z: 14, height: 1.4, ry: 2.4 },
      // A delivery van parked in the lane + stacked market crates
      { url: 'models/milktruck.glb', x: 0, z: 24, height: 3, ry: 3.1 },
      { url: 'models/crate.glb', x: -6, z: 4, height: 1.8, ry: 0.3 },
      { url: 'models/crate.glb', x: -4.7, z: 4.6, height: 1.5, ry: 1.1 },
      // Shoppers strolling the lane (living decoys)
      { url: 'models/cesiumman.glb', x: -1, z: 8, height: 1.9, ry: 0.2 },
      { url: 'models/cesiumman.glb', x: 2, z: -2, height: 1.9, ry: -0.8 }
    ]
  },
  hallway: {
    name: '🏛️ ทางเดินคฤหาสน์', sky: 0x1a1a12, ground: 0x333333, groundTexture: 'checker', light: 0.75,
    walls: { base: '#3f6f3a', pattern: '#2d5230' },
    scatter: [
      // Piles of dark trash bags along the walls
      { type: 'sphere', count: 12, colors: [0x26262c, 0x30303a, 0x1e1e24], r: [0.6, 1.1] },
      // Cardboard boxes and clutter
      { type: 'box', count: 8, colors: [0xb08a5a, 0x9a7a4e], w: [0.9, 1.8], h: [0.7, 1.4], d: [0.9, 1.8] }
    ],
    objects: [
      { type: 'cylinder', x: -10, z: -6, r: 1.1, h: 3.2, color: 0xe8e0c8 }, // vase
      { type: 'cylinder', x: 10, z: 4, r: 1.0, h: 2.8, color: 0xd8cfae },  // vase
      { type: 'box', x: 0, z: -13, w: 2, h: 4, d: 0.4, color: 0x6b4a2f },  // door
      // Sign posts: stop-style red sign + yellow warning sign
      { type: 'cylinder', x: -6, z: -10, r: 0.08, h: 3, color: 0x555555 },
      { type: 'box', x: -6, z: -10, w: 1.2, h: 1.2, d: 0.12, y: 2.6, color: 0xc0392b },
      { type: 'cylinder', x: 7, z: 9, r: 0.08, h: 3, color: 0x555555 },
      { type: 'box', x: 7, z: 9, w: 1.1, h: 1.1, d: 0.12, y: 2.6, color: 0xe0c060 },
      // Leaning ladder pile (like stacked furniture)
      { type: 'box', x: -12, z: 10, w: 0.3, h: 4.5, d: 1.4, color: 0xa8895f },
      { type: 'box', x: -11, z: 10.5, w: 0.3, h: 4, d: 1.2, color: 0x97794e }
    ],
    models: [
      { url: 'models/chair.glb', x: -6, z: 4, height: 2.4, ry: 0.5 },
      { url: 'models/chair.glb', x: 6, z: 4, height: 2.4, ry: -0.5 },
      { url: 'models/lantern.glb', x: 9, z: -4, height: 3.5, ry: 0 },
      { url: 'models/duck.glb', x: 0, z: 6, height: 1.6, ry: -2.4 },
      { url: 'models/sofa.glb', x: -11, z: -2, height: 2.4, ry: 1.4 },
      { url: 'models/camera.glb', x: 11, z: 5, height: 2.4, ry: -1 },
      // A marble bust on a plinth + moving crates cluttering the hall
      { url: 'models/bust.glb', x: 12, z: -10, height: 2.6, ry: -0.6, noAnim: true },
      { url: 'models/crate.glb', x: -11, z: -11, height: 1.8, ry: 0.3 },
      { url: 'models/crate.glb', x: -9.7, z: -10.4, height: 1.5, ry: 1.1 }
    ]
  },
  laundry: {
    // Busy neighbourhood laundromat: washers line every wall AND run down a
    // central island, with folding stations, baskets and detergent shelves
    // filling the floor. Softer daylight so the white tiles don't glare.
    name: '🧺 ร้านซักรีด', sky: 0xbcd0dc, ground: 0xdfe6ec, groundTexture: 'tile',
    groundTint: 0x646e7a, walls: { base: '#aab6c4', pattern: '#8fa0b2' }, light: 0.72,
    // Was 62 across with everything pushed to the walls, so a seeker standing
    // in the middle could see the entire room at once and hiders had nowhere to
    // break line of sight. Now 96 (walls at ±48), and the extra floor goes into
    // four back-to-back washer islands and interior shelving that cut the room
    // into aisles — the cover matters more than the raw size.
    // 130 x 1.35 = 175 across, against 130 before and 62 originally
    size: 130, scale: 1.6, spawn: [0, 0, 58],
    grid: [
      // Washers packed along the left and right walls, doors facing the aisle
      { type: 'washer', rows: 12, cols: 1, x0: -62.5, z0: -55, dx: 0, dz: 10, ry: 1.5708 },
      { type: 'washer', rows: 12, cols: 1, x0: 62.5, z0: -55, dx: 0, dz: 10, ry: -1.5708, dryer: true },
      // Back-wall bank of dryers
      { type: 'washer', rows: 1, cols: 10, x0: -49.5, z0: -62.5, dx: 11, dz: 0, ry: 0, dryer: true },
      // Four back-to-back islands running across the room. These are the sight
      // breakers — each pair makes an aisle you can actually lose someone in.
      // Spaced rather than packed: a solid wall of washers is fewer hiding
      // spots than a broken row, and every unit is a compound prop to draw.
      { type: 'washer', rows: 1, cols: 8, x0: -31.5, z0: -44, dx: 9, dz: 0, ry: 0 },
      { type: 'washer', rows: 1, cols: 8, x0: -31.5, z0: -46, dx: 9, dz: 0, ry: 3.14159, dryer: true },
      { type: 'washer', rows: 1, cols: 8, x0: -31.5, z0: -24, dx: 9, dz: 0, ry: 0 },
      { type: 'washer', rows: 1, cols: 8, x0: -31.5, z0: -26, dx: 9, dz: 0, ry: 3.14159, dryer: true },
      { type: 'washer', rows: 1, cols: 8, x0: -31.5, z0: -4, dx: 9, dz: 0, ry: 0 },
      { type: 'washer', rows: 1, cols: 8, x0: -31.5, z0: -6, dx: 9, dz: 0, ry: 3.14159, dryer: true },
      { type: 'washer', rows: 1, cols: 8, x0: -31.5, z0: 16, dx: 9, dz: 0, ry: 0 },
      { type: 'washer', rows: 1, cols: 8, x0: -31.5, z0: 14, dx: 9, dz: 0, ry: 3.14159, dryer: true },
      { type: 'washer', rows: 1, cols: 6, x0: -22.5, z0: 36, dx: 9, dz: 0, ry: 0 },
      { type: 'washer', rows: 1, cols: 6, x0: -22.5, z0: 34, dx: 9, dz: 0, ry: 3.14159, dryer: true },
      // Sixth island toward the back, so the enlarged floor keeps its aisles
      { type: 'washer', rows: 1, cols: 7, x0: -27, z0: -56, dx: 9, dz: 0, ry: 0 },
      { type: 'washer', rows: 1, cols: 7, x0: -27, z0: -54, dx: 9, dz: 0, ry: 3.14159, dryer: true },
      // Front wall, split around the entrance (centre kept clear for spawn)
      { type: 'washer', rows: 1, cols: 6, x0: -58, z0: 62.5, dx: 7, dz: 0, ry: 3.14159, dryer: true },
      { type: 'washer', rows: 1, cols: 6, x0: 23, z0: 62.5, dx: 7, dz: 0, ry: 3.14159 },
      // Tall detergent shelving standing out in the room, not just in corners —
      // these are what stop the long diagonal sight lines down the aisles
      { type: 'detergentshelf', rows: 5, cols: 2, x0: -48, z0: -35, dx: 96, dz: 20, w: 4, ry: 0 }
    ],
    objects: [
      // Folding stations spread across the floor, set in the aisles between
      // the islands so the walkways aren't clean straight runs
      { type: 'foldtable', x: 0, z: 40, w: 6, d: 1.8, ry: 0 },
      { type: 'foldtable', x: -22, z: 22, w: 6, d: 1.8, ry: 0 },
      { type: 'foldtable', x: 22, z: 22, w: 6, d: 1.8, ry: 0 },
      { type: 'foldtable', x: 0, z: 2, w: 6, d: 1.8, ry: 0 },
      { type: 'foldtable', x: -30, z: 2, w: 4, d: 1.6, ry: 1.5708 },
      { type: 'foldtable', x: 30, z: 2, w: 4, d: 1.6, ry: 1.5708 },
      { type: 'foldtable', x: -20, z: -18, w: 5, d: 1.7, ry: 0 },
      { type: 'foldtable', x: 20, z: -18, w: 5, d: 1.7, ry: 0 },
      { type: 'foldtable', x: 0, z: -38, w: 6, d: 1.8, ry: 0 },
      { type: 'foldtable', x: -34, z: -36, w: 3.5, d: 1.6, ry: 1.5708 },
      { type: 'foldtable', x: 34, z: -36, w: 3.5, d: 1.6, ry: 1.5708 },
      // Detergent shelves in all four corners
      { type: 'detergentshelf', x: -58, z: -61, w: 4, ry: 0 },
      { type: 'detergentshelf', x: 58, z: -61, w: 4, ry: 0 },
      { type: 'detergentshelf', x: -62.5, z: 56, w: 4, ry: 1.5708 },
      { type: 'detergentshelf', x: 62.5, z: 56, w: 4, ry: -1.5708 },
      // Baskets of laundry dotted through the aisles (hiding cover)
      { type: 'laundrybasket', x: -8, z: 36, color: 0xe06a6a },
      { type: 'laundrybasket', x: 8, z: 36, color: 0x6a9ae0 },
      { type: 'laundrybasket', x: -30, z: 20, color: 0x6ac47a },
      { type: 'laundrybasket', x: 30, z: 20, color: 0xe0b84a },
      { type: 'laundrybasket', x: -6, z: 20, color: 0xc48ad0 },
      { type: 'laundrybasket', x: 7, z: 19, color: 0xd0d0d8 },
      { type: 'laundrybasket', x: -16, z: 0, color: 0x6ac47a },
      { type: 'laundrybasket', x: 16, z: 0, color: 0xe06a6a },
      { type: 'laundrybasket', x: -34, z: -14, color: 0x6a9ae0 },
      { type: 'laundrybasket', x: 34, z: -14, color: 0xe0b84a },
      { type: 'laundrybasket', x: -10, z: -20, color: 0xc48ad0 },
      { type: 'laundrybasket', x: 11, z: -21, color: 0x6ac47a },
      { type: 'laundrybasket', x: -24, z: -38, color: 0xe06a6a },
      { type: 'laundrybasket', x: 24, z: -38, color: 0x6a9ae0 },
      // Waiting benches near the entrance
      { type: 'box', x: -55, z: 44, w: 3, h: 0.9, d: 1.1, color: 0x8a6a4a, texture: 'wood' },
      { type: 'box', x: 55, z: 44, w: 3, h: 0.9, d: 1.1, color: 0x8a6a4a, texture: 'wood' },
      { type: 'box', x: -55, z: 24, w: 3, h: 0.9, d: 1.1, color: 0x8a6a4a, texture: 'wood' },
      { type: 'box', x: 55, z: 24, w: 3, h: 0.9, d: 1.1, color: 0x8a6a4a, texture: 'wood' },
      // Front cashier counter (to the side of the entrance)
      { type: 'box', x: -14, z: 57, w: 4, h: 1.1, d: 1.4, color: 0x8a6a4a, texture: 'wood' },
      { type: 'box', x: -14, z: 57, w: 4.3, h: 0.12, d: 1.7, y: 1.1, color: 0x6a4a30 },
      // Rolling laundry carts parked along the aisles — waist-high cover
      { type: 'box', x: -14, z: 30, w: 2.2, h: 1.5, d: 1.6, color: 0xb8c2cc },
      { type: 'box', x: 14, z: 30, w: 2.2, h: 1.5, d: 1.6, color: 0xb8c2cc },
      { type: 'box', x: -26, z: -2, w: 2.2, h: 1.5, d: 1.6, color: 0xb8c2cc },
      { type: 'box', x: 26, z: -2, w: 2.2, h: 1.5, d: 1.6, color: 0xb8c2cc },
      { type: 'box', x: -6, z: -32, w: 2.2, h: 1.5, d: 1.6, color: 0xb8c2cc },
      { type: 'box', x: 6, z: -32, w: 2.2, h: 1.5, d: 1.6, color: 0xb8c2cc }
    ],
    scatter: [
      // Extra baskets + folded-towel piles scattered for cover
      { type: 'laundrybasket', count: 12, colors: [0xe06a6a, 0x6a9ae0, 0x6ac47a, 0xe0b84a, 0xc48ad0] },
      { type: 'box', count: 16, colors: [0xe8e8f0, 0x8fd0e8, 0xf2c0d0, 0xc0e8a8], w: [0.7, 1.1], h: [0.4, 0.9], d: [0.7, 1.1] },
      // A few more shelf units dropped in at random to break remaining sightlines
      { type: 'detergentshelf', count: 4, colors: [0xd8dee6] }
    ],
    models: [
      // A little waiting corner + shop bits
      { url: 'models/sofa.glb', x: 20, z: 16, height: 2.2, ry: -0.7 },
      { url: 'models/chair.glb', x: -20, z: 16, height: 2.2, ry: 0.7 },
      { url: 'models/bottle.glb', x: -8, z: 19, height: 1.1, ry: 0, y: 1.2 },
      { url: 'models/boombox.glb', x: 12, z: 8, height: 1.3, ry: 1, y: 1.3 },
      { url: 'models/crate.glb', x: -23, z: 6, height: 1.6, ry: 0.4 },
      { url: 'models/crate.glb', x: -22, z: 7.4, height: 1.3, ry: 1.1 },
      { url: 'models/duck.glb', x: 0, z: 16, height: 1.3, ry: 2 }
    ]
  },
  mansion: {
    // Neoclassical manor (the reference look): cream panelled walls picked out
    // in gold, a marble floor, gilded Corinthian columns, crystal chandeliers,
    // carved fireplaces, tall drapes, gilt mirrors, velvet sofas, marble
    // statues and console tables of flowers in every room.
    name: '🏰 คฤหาสน์ 6 ห้อง', sky: 0x171310, ground: 0x8c8274, groundTexture: 'checker',
    // Lit like a candle-lit manor at dusk rather than a showroom: the cream
    // plasterwork was blowing out to flat white, which washed the gold detail
    // off the columns and mirrors. Warm, low light + a tinted floor keeps the
    // palette but lets the gilding and the chandeliers actually read.
    groundTint: 0x9a9184,
    // Soft cream/taupe marble squares instead of a hard black-and-white
    // chequerboard, so a wide room isn't half-covered in near-black tiles
    checkerColors: ['#d6cec0', '#9c9284'],
    walls: { base: '#87795f', pattern: '#736750' }, light: 0.5, ceiling: 0x6f6555,
    sunColor: 0xffdcac, ambientColor: 0x8a7863,
    fog: { color: 0x2a231c, near: 60, far: 190 },
    ceilingPanels: false,   // lit by its own chandeliers + sconces instead
    spawn: [0, 0, 0], // central entrance hall
    scatter: [
      // Marble statues and porcelain vases in every room
      { type: 'statue', count: 5, colors: [0xcac4b8] },
      { type: 'vase', count: 5, colors: [0xd2cec2, 0xc6cad2, 0xd2c6b8] },
      // Console tables of flowers against the spare stretches of wall
      { type: 'console', count: 4, colors: [0x2c3038, 0x6b5a3a] },
      // Potted palms softening the corners of every room
      { type: 'pottedpalm', count: 8, colors: [0x3f7a45, 0x356b3c, 0x4a8a50] },
      // Stacks of old books
      { type: 'bookstack', count: 4, colors: [0x8a3a3a, 0x3a5a8a, 0x3a7a4a] },
      // Spare seating pushed against the walls of every room
      { type: 'velvetsofa', count: 4, colors: [0x6b3a4a, 0x3f5a7a, 0x5f7d3a, 0x7a6a4a] }
    ],
    // Lighting is spread to the same density everywhere so no part of the
    // house reads brighter than another. The hall used to carry a sconce every
    // 7 units against a room's every 6.5 over an area three times the size,
    // which made the corridor glare next to its own rooms; it now gets a wider
    // spacing and the rooms carry a chandelier over every quarter instead.
    grid: [
      { type: 'sconce', rows: 5, cols: 1, x0: -3.5, z0: -28, dx: 0, dz: 14, y: 5.4, ry: 1.5708 },
      { type: 'sconce', rows: 5, cols: 1, x0: 3.5, z0: -28, dx: 0, dz: 14, y: 5.4, ry: -1.5708 },
      // Sconces on the outer wall of the three rooms down each side
      { type: 'sconce', rows: 9, cols: 1, x0: -29.2, z0: -26, dx: 0, dz: 6.5, y: 5.4, ry: 1.5708 },
      { type: 'sconce', rows: 9, cols: 1, x0: 29.2, z0: -26, dx: 0, dz: 6.5, y: 5.4, ry: -1.5708 },
      { type: 'column', rows: 9, cols: 1, x0: -28.6, z0: -26, dx: 0, dz: 6.5, h: 8.6, r: 0.42 },
      { type: 'column', rows: 9, cols: 1, x0: 28.6, z0: -26, dx: 0, dz: 6.5, h: 8.6, r: 0.42 },
      // Pilasters flanking the corridor openings of each room
      { type: 'column', rows: 3, cols: 2, x0: -10.6, z0: -20, dx: 21.2, dz: 20, h: 8.6, r: 0.45 },
      // A chandelier over each quarter of every room
      { type: 'chandelier', rows: 6, cols: 2, x0: -22, z0: -25, dx: 10, dz: 10 },
      { type: 'chandelier', rows: 6, cols: 2, x0: 12, z0: -25, dx: 10, dz: 10 }
    ],
    // Central corridor (x -4..4); 3 rooms on each side, doorway per room
    interiorWalls: [
      // Left room dividers (span x -30..-4)
      { x: -17, z: -10, w: 26, d: 1 },
      { x: -17, z: 10, w: 26, d: 1 },
      // Right room dividers (span x 4..30)
      { x: 17, z: -10, w: 26, d: 1 },
      { x: 17, z: 10, w: 26, d: 1 },
      // Left corridor wall x=-4 with 3 doorway gaps (z -20, 0, 20)
      { x: -4, z: -26, w: 1, d: 8 },
      { x: -4, z: -10, w: 1, d: 16 },
      { x: -4, z: 10, w: 1, d: 16 },
      { x: -4, z: 26, w: 1, d: 8 },
      // Right corridor wall x=4 with 3 doorway gaps
      { x: 4, z: -26, w: 1, d: 8 },
      { x: 4, z: -10, w: 1, d: 16 },
      { x: 4, z: 10, w: 1, d: 16 },
      { x: 4, z: 26, w: 1, d: 8 }
    ],
    objects: [
      // ===== Grand entrance hall (the central corridor) =====
      // Red carpet with gold trim running the full length
      { type: 'box', x: 0, z: 0, w: 7, h: 0.08, d: 140, color: 0x8a2222 },
      { type: 'box', x: 0, z: 0, w: 8, h: 0.05, d: 142, color: 0xc8a030 },
      // Gilded Corinthian colonnade down both sides of the hall
      { type: 'column', x: -3.1, z: -22, h: 8.6, r: 0.6 },
      { type: 'column', x: 3.1, z: -22, h: 8.6, r: 0.6 },
      { type: 'column', x: -3.1, z: -6, h: 8.6, r: 0.6 },
      { type: 'column', x: 3.1, z: -6, h: 8.6, r: 0.6 },
      { type: 'column', x: -3.1, z: 6, h: 8.6, r: 0.6 },
      { type: 'column', x: 3.1, z: 6, h: 8.6, r: 0.6 },
      { type: 'column', x: -3.1, z: 22, h: 8.6, r: 0.6 },
      { type: 'column', x: 3.1, z: 22, h: 8.6, r: 0.6 },
      // Chandeliers down the hall
      { type: 'chandelier', x: 0, z: -18 },
      { type: 'chandelier', x: 0, z: 0 },
      { type: 'chandelier', x: 0, z: 18 },
      // Marble statues on the carpet edge + a mirror and console at the ends
      { type: 'statue', x: -2.6, z: -12 },
      { type: 'statue', x: 2.6, z: -12 },
      { type: 'statue', x: -2.6, z: 12 },
      { type: 'statue', x: 2.6, z: 12 },
      { type: 'console', x: 0, z: -29, w: 3, ry: 0 },
      { type: 'mirror', x: 0, z: -29.5, y: 4.6, w: 2.6, h: 3.6, ry: 0 },
      { type: 'console', x: 0, z: 29, w: 3, ry: 3.14159 },
      { type: 'mirror', x: 0, z: 29.5, y: 4.6, w: 2.6, h: 3.6, ry: 3.14159 },
      // Gilt-framed paintings on the corridor walls (just proud of the slab)
      { type: 'painting', x: -3.38, z: -10, ry: 1.5708, style: 0 },
      { type: 'painting', x: 3.38, z: -10, ry: -1.5708, style: 1 },
      { type: 'painting', x: -3.38, z: 10, ry: 1.5708, style: 3 },
      { type: 'painting', x: 3.38, z: 10, ry: -1.5708, style: 2 },

      // ===== Room A (-17,-20) — Grand salon =====
      { type: 'velvetsofa', x: -17, z: -23, w: 4.6, color: 0x5f7d3a, ry: 0 },
      { type: 'box', x: -17, z: -20.6, w: 3.2, h: 0.65, d: 1.6, color: 0x4a3020 },
      { type: 'box', x: -17, z: -21, w: 9, h: 0.06, d: 8, color: 0x9a8a6a },
      { type: 'velvetsofa', x: -22.5, z: -18, w: 3, color: 0xb8b0c4, ry: 1.5708 },
      { type: 'velvetsofa', x: -11.5, z: -18, w: 3, color: 0xb8b0c4, ry: -1.5708 },
      { type: 'column', x: -10, z: -27, h: 8.6, r: 0.5 },
      { type: 'column', x: -24, z: -27, h: 8.6, r: 0.5 },
      { type: 'archshelf', x: -29.2, z: -22, w: 2.4, h: 5, ry: 1.5708 },
      { type: 'archshelf', x: -29.2, z: -17, w: 2.4, h: 5, ry: 1.5708 },
      { type: 'chandelier', x: -17, z: -20 },
      { type: 'curtain', x: -17, z: -29.3, w: 5, h: 7.6, color: 0xd8c9b4, ry: 0 },
      { type: 'console', x: -22, z: -29, w: 2.6, ry: 0 },
      { type: 'painting', x: -29.4, z: -26, ry: 1.5708, style: 1 },
      { type: 'pottedpalm', x: -27, z: -25, h: 3.8 },
      { type: 'pottedpalm', x: -7, z: -25, h: 3.8 },
      { type: 'velvetsofa', x: -17, z: -13, w: 4, color: 0x8a5a6a, ry: 3.14159 },
      { type: 'box', x: -22.5, z: -13, w: 1.5, h: 0.75, d: 1.5, color: 0xc8a030 },
      { type: 'box', x: -11.5, z: -13, w: 1.5, h: 0.75, d: 1.5, color: 0xc8a030 },
      { type: 'mirror', x: -10.2, z: -20, y: 4.4, w: 2.2, h: 3.2, ry: -1.5708 },
      { type: 'vase', x: -25, z: -13 },

      // ===== Room B (-17,0) — Library & study =====
      { type: 'fireplace', x: -29, z: 0, w: 4.4, h: 3.8, ry: 1.5708 },
      { type: 'mirror', x: -29.4, z: 0, y: 5.6, w: 2.4, h: 3, ry: 1.5708 },
      { type: 'bookshelf', x: -28.6, z: -7, w: 3.4, h: 5.2, ry: 1.5708, solid: true, cw: 0.8, cd: 3.4 },
      { type: 'bookshelf', x: -28.6, z: 7, w: 3.4, h: 5.2, ry: 1.5708, solid: true, cw: 0.8, cd: 3.4 },
      { type: 'bookshelf', x: -22, z: -9.3, w: 3.4, h: 5.2, ry: 3.14159, solid: true, cw: 3.4, cd: 0.8 },
      { type: 'bookshelf', x: -12, z: -9.3, w: 3.4, h: 5.2, ry: 3.14159, solid: true, cw: 3.4, cd: 0.8 },
      { type: 'desk', x: -17, z: -3, w: 3.6, teacher: true, ry: 0 },
      { type: 'globe', x: -14, z: 4, r: 0.75 },
      { type: 'velvetsofa', x: -17, z: 5, w: 3.6, color: 0x6b3a4a, ry: 3.14159 },
      { type: 'chandelier', x: -17, z: 0 },
      { type: 'column', x: -10, z: -7, h: 8.6, r: 0.5 },
      { type: 'column', x: -24, z: -7, h: 8.6, r: 0.5 },
      { type: 'console', x: -17, z: 9, w: 2.6, ry: 3.14159 },
      { type: 'box', x: -17, z: 0, w: 12, h: 0.06, d: 11, color: 0x8a6a5a },
      { type: 'velvetsofa', x: -23, z: 1, w: 3.2, color: 0x6b3a4a, ry: 1.5708 },
      { type: 'velvetsofa', x: -11, z: 1, w: 3.2, color: 0x6b3a4a, ry: -1.5708 },
      { type: 'box', x: -17, z: 1.5, w: 2.6, h: 0.6, d: 1.6, color: 0x4a3020 },
      { type: 'pottedpalm', x: -26, z: 7, h: 3.6 },
      { type: 'pottedpalm', x: -8, z: -7, h: 3.6 },
      { type: 'archshelf', x: -10.2, z: 3, w: 2.4, h: 5, ry: -1.5708 },
      { type: 'bookstack', x: -14, z: -3, y: 1.55, color: 0x3a5a8a },

      // ===== Room C (-17,20) — Master bedroom =====
      { type: 'ornatebed', x: -17, z: 17, color: 0xd9d3c4, accent: 0xc23b52, ry: 0 },
      { type: 'mirror', x: -17, z: 12.2, y: 4.8, w: 4.2, h: 4.4, ry: 0 },
      { type: 'console', x: -23, z: 13, w: 2.4, ry: 0 },
      { type: 'console', x: -11, z: 13, w: 2.4, ry: 0 },
      { type: 'velvetsofa', x: -17, z: 25, w: 3.6, color: 0xe0d4c0, ry: 3.14159 },
      { type: 'chandelier', x: -17, z: 20 },
      { type: 'curtain', x: -29.3, z: 22, w: 5, h: 7.6, color: 0xd6cbb8, ry: 1.5708 },
      { type: 'curtain', x: -17, z: 29.3, w: 5, h: 7.6, color: 0xd6cbb8, ry: 3.14159 },
      { type: 'box', x: -17, z: 20, w: 10, h: 0.06, d: 9, color: 0xa89880 },
      { type: 'painting', x: -29.4, z: 15, ry: 1.5708, style: 2 },
      { type: 'pottedpalm', x: -26, z: 14, h: 3.6 },
      { type: 'pottedpalm', x: -8, z: 14, h: 3.6 },
      { type: 'archshelf', x: -29.2, z: 26, w: 2.4, h: 5, ry: 1.5708 },
      { type: 'mirror', x: -10.2, z: 20, y: 4.4, w: 2.2, h: 3.4, ry: -1.5708 },
      { type: 'box', x: -23, z: 25, w: 1.6, h: 0.7, d: 1.6, color: 0xc8a030 },
      { type: 'vase', x: -12, z: 26 },
      { type: 'velvetsofa', x: -25, z: 20, w: 3, color: 0xc4b8a4, ry: 1.5708 },

      // ===== Room D (17,-20) — Music room =====
      { type: 'grandpiano', x: 17, z: -22, ry: 0.4 },
      { type: 'chandelier', x: 17, z: -20 },
      { type: 'column', x: 10, z: -27, h: 8.6, r: 0.5 },
      { type: 'column', x: 24, z: -27, h: 8.6, r: 0.5 },
      { type: 'velvetsofa', x: 24, z: -18, w: 3.4, color: 0x3f5a7a, ry: -1.5708 },
      { type: 'curtain', x: 17, z: -29.3, w: 5, h: 7.6, color: 0xc9bda8, ry: 0 },
      { type: 'mirror', x: 29.4, z: -22, y: 4.4, w: 2.4, h: 3.4, ry: -1.5708 },
      { type: 'console', x: 12, z: -29, w: 2.6, ry: 0 },
      { type: 'painting', x: 29.4, z: -16, ry: -1.5708, style: 3 },
      { type: 'box', x: 17, z: -21, w: 12, h: 0.06, d: 11, color: 0x8a7060 },
      { type: 'velvetsofa', x: 11, z: -15, w: 3.4, color: 0x3f5a7a, ry: 1.5708 },
      { type: 'box', x: 17, z: -14, w: 2.6, h: 0.6, d: 1.6, color: 0x4a3020 },
      { type: 'pottedpalm', x: 27, z: -25, h: 3.8 },
      { type: 'pottedpalm', x: 8, z: -25, h: 3.8 },
      { type: 'archshelf', x: 29.2, z: -27, w: 2.4, h: 5, ry: -1.5708 },
      { type: 'statue', x: 22, z: -27 },
      { type: 'vase', x: 12, z: -21 },

      // ===== Room E (17,0) — Formal dining hall =====
      { type: 'diningset', x: 17, z: -1, ry: 0 },
      { type: 'chandelier', x: 17, z: 0 },
      { type: 'fireplace', x: 29, z: 4, w: 4, h: 3.6, ry: -1.5708 },
      { type: 'column', x: 10, z: -7, h: 8.6, r: 0.5 },
      { type: 'column', x: 24, z: -7, h: 8.6, r: 0.5 },
      { type: 'column', x: 10, z: 7, h: 8.6, r: 0.5 },
      { type: 'column', x: 24, z: 7, h: 8.6, r: 0.5 },
      { type: 'console', x: 17, z: 8.6, w: 3, ry: 3.14159 },
      { type: 'mirror', x: 17, z: 9.2, y: 4.6, w: 2.6, h: 3.4, ry: 3.14159 },
      { type: 'archshelf', x: 29.2, z: -5, w: 2.4, h: 5, ry: -1.5708 },
      { type: 'vase', x: 13, z: 6 },
      { type: 'box', x: 17, z: 0, w: 11, h: 0.06, d: 9, color: 0x8a7a5a },
      { type: 'pottedpalm', x: 11, z: 7, h: 3.6 },
      { type: 'pottedpalm', x: 23, z: 7, h: 3.6 },
      { type: 'console', x: 22, z: -8.6, w: 2.6, ry: 0 },
      { type: 'console', x: 12, z: -8.6, w: 2.6, ry: 0 },
      { type: 'painting', x: 17, z: -9.2, ry: 0, style: 2 },
      { type: 'velvetsofa', x: 27, z: -2, w: 3, color: 0x7a6a4a, ry: -1.5708 },
      { type: 'statue', x: 11, z: -6 },

      // ===== Room F (17,20) — Ballroom / gallery =====
      { type: 'velvetsofa', x: 12, z: 16, w: 4.2, color: 0xe8dcc8, ry: 1.5708 },
      { type: 'velvetsofa', x: 22, z: 16, w: 4.2, color: 0xe8dcc8, ry: -1.5708 },
      { type: 'box', x: 17, z: 16, w: 3.4, h: 0.6, d: 1.8, color: 0xc8a030 },
      { type: 'box', x: 17, z: 17, w: 11, h: 0.06, d: 10, color: 0xb0a48c },
      { type: 'chandelier', x: 17, z: 20 },
      { type: 'balustrade', x: 17, z: 25.5, w: 12, h: 1.6, ry: 0 },
      { type: 'column', x: 10.5, z: 25.5, h: 8.6, r: 0.55 },
      { type: 'column', x: 23.5, z: 25.5, h: 8.6, r: 0.55 },
      { type: 'curtain', x: 17, z: 29.3, w: 6, h: 7.6, color: 0xcfc3ae, ry: 3.14159 },
      { type: 'statue', x: 12, z: 27.5 },
      { type: 'statue', x: 22, z: 27.5 },
      { type: 'console', x: 29, z: 20, w: 2.6, ry: -1.5708 },
      { type: 'painting', x: 29.4, z: 14, ry: -1.5708, style: 0 },
      { type: 'painting', x: 10, z: 29.4, ry: 3.14159, style: 1 },
      { type: 'pottedpalm', x: 11, z: 12, h: 3.8 },
      { type: 'pottedpalm', x: 23, z: 12, h: 3.8 },
      { type: 'grandpiano', x: 25, z: 21, ry: -0.6 },
      { type: 'mirror', x: 10.2, z: 20, y: 4.4, w: 2.2, h: 3.4, ry: 1.5708 },
      { type: 'archshelf', x: 29.2, z: 25, w: 2.4, h: 5, ry: -1.5708 },
      { type: 'vase', x: 13, z: 24 },
      { type: 'bookstack', x: 17, z: 16, y: 0.62, color: 0x8a3a3a },

      // Statues guarding the room doorways
      { type: 'statue', x: -6, z: -18 },
      { type: 'statue', x: 6, z: 22 }
    ],
    models: [
      // Room A (salon): seating + a display piece
      { url: 'models/sofa.glb', x: -22, z: -24, height: 2.4, ry: 0.3 },
      { url: 'models/fancychair.glb', x: -12, z: -24, height: 2.2, ry: -0.4 },
      // Room B (study): the collector's corner
      { url: 'models/bust.glb', x: -20, z: 3, height: 2.6, ry: 0.4, noAnim: true },
      { url: 'models/camera.glb', x: -13, z: -6, height: 2.4, ry: 0.5 },
      { url: 'models/lantern.glb', x: -21, z: -6, height: 3.2, ry: 0 },
      // Room C (bedroom): a chaise and a dressing lamp
      { url: 'models/fancychair.glb', x: -23, z: 22, height: 2.2, ry: 1.4 },
      { url: 'models/lantern.glb', x: -11, z: 22, height: 3, ry: 0 },
      // Room D (music): gramophone-ish pieces
      { url: 'models/boombox.glb', x: 21, z: -25, height: 1.5, ry: -0.5 },
      { url: 'models/bottle.glb', x: 13, z: -17, height: 1.4, ry: 0 },
      // Room E (dining): service pieces
      { url: 'models/dish.glb', x: 20, z: -6, height: 0.5, ry: 0, y: 1.4 },
      { url: 'models/chair.glb', x: 13, z: -3, height: 2.4, ry: 1 },
      // Room F (ballroom): showpiece statue + a guest
      { url: 'models/statue.glb', x: 17, z: 13, height: 2.6, ry: 0, noAnim: true },
      { url: 'models/head.glb', x: 24, z: 13, height: 1.6, ry: 2.6, y: 1.4 },
      // Hall showpieces
      { url: 'models/statue.glb', x: 0, z: -20, height: 2.6, ry: Math.PI, noAnim: true },
      { url: 'models/fancychair.glb', x: 0, z: 20, height: 2.2, ry: 0 },
      { url: 'models/barnlamp.glb', x: 0, z: 5, height: 1.4, ry: 0.5, y: 5.5 },
      // A pair of manor guests strolling the halls (living decoys)
      { url: 'models/riggedfig.glb', x: -2, z: 12, height: 1.9, ry: 0.5 },
      { url: 'models/cesiumman.glb', x: 2, z: -12, height: 1.9, ry: -0.6 }
    ]
  },
  school: {
    // A real multi-room school: a locker-lined corridor opening into six themed
    // rooms — math & language classrooms with desks in rows facing chalkboards,
    // a science room, a book-filled library, a computer lab of monitors, and an
    // art room. Every room is dressed with teaching props (boards with
    // equations, globes, book stacks, posters, clocks, flags, computers).
    name: '🏫 โรงเรียนหลายห้อง', sky: 0xbcd4e6, ground: 0xcaa472, groundTexture: 'checker',
    walls: { base: '#e8dcc0', pattern: '#cbb894' }, light: 0.98,
    spawn: [0, 0, 0],
    interiorWalls: CORRIDOR_WALLS,
    // Book stacks & globes strewn through the rooms for extra clutter/cover
    scatter: [
      { type: 'bookstack', count: 6, colors: [0xcf5b5b, 0x5b7fcf, 0x5bcf7f, 0xf1c40f, 0xe67e22, 0x9b59b6] },
      { type: 'globe', count: 2, colors: [0x2f7fb5] }
    ],
    // Desk rows per classroom (each desk carries a blue bench + a notebook)
    grid: [
      // Room A — Math (front-left), facing the board on the front wall
      { type: 'desk', rows: 3, cols: 3, x0: -25, z0: -24, dx: 7, dz: 5, w: 2.4, ry: 0 },
      // Room B — Science (mid-left), facing the board on the left wall
      { type: 'desk', rows: 3, cols: 3, x0: -24, z0: -6, dx: 6, dz: 6, w: 2.2, ry: 1.5708 },
      // Room D — Language (front-right), facing the front-wall board
      { type: 'desk', rows: 3, cols: 3, x0: 11, z0: -24, dx: 7, dz: 5, w: 2.4, ry: 0 },
      // Room E — Computer lab (mid-right): desks + a monitor on each, facing
      // the projector screen on the right wall
      { type: 'desk', rows: 3, cols: 3, x0: 10, z0: -6, dx: 6, dz: 6, w: 2.2, ry: -1.5708 },
      { type: 'computer', rows: 3, cols: 3, x0: 10, z0: -6, dx: 6, dz: 6, y: 1.25, ry: -1.5708 }
    ],
    objects: [
      // ===== Corridor: lockers, notice boards, exit signs =====
      { type: 'box', x: -3.3, z: -27, w: 1.4, h: 4, d: 1.2, color: 0x4a7ab0 },
      { type: 'box', x: -3.3, z: -25.4, w: 1.4, h: 4, d: 1.2, color: 0x3f6ea0 },
      { type: 'box', x: 3.3, z: -27, w: 1.4, h: 4, d: 1.2, color: 0xb04a4a },
      { type: 'box', x: 3.3, z: -25.4, w: 1.4, h: 4, d: 1.2, color: 0xa04040 },
      { type: 'box', x: -3.3, z: -12, w: 1.4, h: 4, d: 1.2, color: 0x4f9d6a },
      { type: 'box', x: -3.3, z: -8, w: 1.4, h: 4, d: 1.2, color: 0x4a7ab0 },
      { type: 'box', x: 3.3, z: 12, w: 1.4, h: 4, d: 1.2, color: 0xe0b13a },
      { type: 'box', x: 3.3, z: 8, w: 1.4, h: 4, d: 1.2, color: 0xb04a4a },
      { type: 'box', x: -3.3, z: 26, w: 1.4, h: 4, d: 1.2, color: 0x8a5ac0 },
      { type: 'box', x: 3.3, z: 26, w: 1.4, h: 4, d: 1.2, color: 0x4f9d6a },
      // Corridor notice boards + glowing green EXIT signs at both ends
      { type: 'poster', x: -3.35, z: -3, y: 5, w: 2.4, h: 3, color: 0xeef6ff, ry: 1.5708 },
      { type: 'poster', x: 3.35, z: 3, y: 5, w: 2.4, h: 3, color: 0xfff2e0, ry: -1.5708 },
      { type: 'box', x: 0, z: -29.2, w: 2.2, h: 0.8, d: 0.2, y: 6.6, color: 0x2ecc71, emissive: 0x27ae60, emissiveIntensity: 1 },
      { type: 'box', x: 0, z: 29.2, w: 2.2, h: 0.8, d: 0.2, y: 6.6, color: 0x2ecc71, emissive: 0x27ae60, emissiveIntensity: 1 },

      // ===== Room A — Math class (front-left) =====
      { type: 'blackboard', x: -17, z: -29.4, y: 3.4, w: 10, h: 4.8, text: '1 + 1 = ?', ry: 0 },
      { type: 'clock', x: -9, z: -29.4, y: 6.6, r: 0.8, ry: 0 },
      { type: 'poster', x: -25, z: -29.4, y: 5.8, w: 2.6, h: 3.2, color: 0xfdf3d0, ry: 0 },
      { type: 'desk', x: -20, z: -27.5, w: 3.8, teacher: true, ry: 0 },
      { type: 'computer', x: -20.7, z: -27.5, y: 1.55, ry: 0 },
      { type: 'bookstack', x: -18.6, z: -27.5, y: 1.55, color: 0xcf5b5b },
      { type: 'globe', x: -14, z: -28, r: 0.55 },

      // ===== Room B — Science class (mid-left) =====
      { type: 'blackboard', x: -29.4, z: 0, y: 3.4, w: 10, h: 4.8, text: 'E = mc²', ry: 1.5708 },
      { type: 'clock', x: -29.4, z: 7.5, y: 6.6, r: 0.8, ry: 1.5708 },
      { type: 'poster', x: -29.4, z: -7.5, y: 5.8, w: 2.6, h: 3.2, color: 0xd7ecff, ry: 1.5708 },
      { type: 'desk', x: -27.5, z: 4, w: 3.6, teacher: true, ry: 1.5708 },
      { type: 'computer', x: -27.5, z: 4.8, y: 1.55, ry: 1.5708 },
      // A lab bench with glowing beakers along the corridor-side wall
      { type: 'box', x: -8, z: 8, w: 5, h: 1.3, d: 1.4, color: 0x6a7683 },
      { type: 'cylinder', x: -9.4, z: 8, r: 0.26, h: 0.7, y: 1.3, color: 0x66bb99, emissive: 0x2a7a3a, emissiveIntensity: 0.7 },
      { type: 'cylinder', x: -8, z: 8, r: 0.26, h: 0.8, y: 1.3, color: 0xd06fb0, emissive: 0x8a3a6a, emissiveIntensity: 0.6 },
      { type: 'cylinder', x: -6.6, z: 8, r: 0.26, h: 0.6, y: 1.3, color: 0x6fa8d0, emissive: 0x2a5a8a, emissiveIntensity: 0.6 },
      { type: 'globe', x: -24, z: 8.5, r: 0.6 },

      // ===== Room C — Library (back-left) =====
      { type: 'bookshelf', x: -27, z: 29.2, w: 3.4, h: 4.8, ry: 3.14159, solid: true },
      { type: 'bookshelf', x: -21, z: 29.2, w: 3.4, h: 4.8, ry: 3.14159, solid: true },
      { type: 'bookshelf', x: -14, z: 29.2, w: 3.4, h: 4.8, ry: 3.14159, solid: true },
      { type: 'bookshelf', x: -8, z: 29.2, w: 3.4, h: 4.8, ry: 3.14159, solid: true },
      { type: 'bookshelf', x: -29.2, z: 14, w: 3.4, h: 4.6, ry: 1.5708, solid: true },
      { type: 'bookshelf', x: -29.2, z: 20, w: 3.4, h: 4.6, ry: 1.5708, solid: true },
      { type: 'bookshelf', x: -29.2, z: 26, w: 3.4, h: 4.6, ry: 1.5708, solid: true },
      // Reading tables with book stacks + a big globe
      { type: 'desk', x: -18, z: 18, w: 3.6, teacher: true, ry: 0 },
      { type: 'bookstack', x: -18, z: 18, y: 1.55, color: 0x5b7fcf },
      { type: 'desk', x: -12, z: 23, w: 3.6, teacher: true, ry: 1.5708 },
      { type: 'bookstack', x: -12, z: 23, y: 1.55, color: 0x5bcf7f },
      { type: 'globe', x: -22, z: 15, r: 0.7 },
      { type: 'poster', x: -29.2, z: 9.5, y: 5.8, w: 2.6, h: 3.2, color: 0xe8f0d8, ry: 1.5708 },
      { type: 'sphere', x: -12, z: 23, r: 0.28, y: 2, color: 0xffe08a, emissive: 0xffcf5a, emissiveIntensity: 0.9 },

      // ===== Room D — Language class (front-right) =====
      { type: 'blackboard', x: 17, z: -29.4, y: 3.4, w: 10, h: 4.8, text: 'A  B  C', ry: 0 },
      { type: 'clock', x: 25, z: -29.4, y: 6.6, r: 0.8, ry: 0 },
      { type: 'poster', x: 9.4, z: -29.4, y: 5.8, w: 2.6, h: 3.2, color: 0xffe4ec, ry: 0 },
      { type: 'desk', x: 14, z: -27.5, w: 3.8, teacher: true, ry: 0 },
      { type: 'computer', x: 13.3, z: -27.5, y: 1.55, ry: 0 },
      { type: 'globe', x: 20, z: -28, r: 0.55 },
      // Flags of many languages lined along the walls
      { type: 'flag', x: 28, z: -28, h: 3, color: 0xd23b3b, color2: 0xffffff },
      { type: 'flag', x: 28, z: -13, h: 3, color: 0x2a4b9b, color2: 0xffffff },
      { type: 'flag', x: 6, z: -13, h: 3, color: 0x2e8b57, color2: 0xf1c40f },

      // ===== Room E — Computer lab (mid-right) =====
      // Wall-mounted projector screen on the right wall
      { type: 'box', x: 29.5, z: 0, w: 0.2, h: 5, d: 9, y: 1.6, color: 0xf4f7fb },
      { type: 'box', x: 29.7, z: 0, w: 0.15, h: 5.5, d: 9.6, y: 1.4, color: 0x2c3038 },
      { type: 'desk', x: 26, z: 0, w: 3.6, teacher: true, ry: -1.5708 },
      { type: 'computer', x: 26, z: -0.8, y: 1.55, s: 1.2, ry: -1.5708 },
      { type: 'clock', x: 29.4, z: 8, y: 6.6, r: 0.8, ry: -1.5708 },
      { type: 'poster', x: 29.4, z: -8, y: 5.8, w: 2.6, h: 3.2, color: 0xe0f0ff, ry: -1.5708 },
      { type: 'flag', x: 6, z: -8, h: 3, color: 0x4a7ab0, color2: 0xffffff },
      { type: 'flag', x: 6, z: 8, h: 3, color: 0xe0b13a, color2: 0xd23b3b },

      // ===== Room F — Art room (back-right) =====
      { type: 'blackboard', x: 17, z: 29.4, y: 3.4, w: 8, h: 4.4, text: '7 × 8 = ?', ry: 3.14159 },
      // Easels (upright board + a white canvas)
      { type: 'box', x: 21, z: 16, w: 0.4, h: 3.6, d: 1.6, color: 0x8a5a3a },
      { type: 'box', x: 21, z: 16, w: 0.14, h: 1.8, d: 1.5, y: 1.7, color: 0xf7f4ec },
      { type: 'box', x: 13, z: 16, w: 0.4, h: 3.6, d: 1.6, color: 0x8a5a3a },
      { type: 'box', x: 13, z: 16, w: 0.14, h: 1.8, d: 1.5, y: 1.7, color: 0xf7f4ec },
      // Craft table with paint buckets
      { type: 'desk', x: 17, z: 24, w: 4, teacher: true, ry: 0 },
      { type: 'cylinder', x: 15.6, z: 24, r: 0.3, h: 0.55, y: 1.55, color: 0xe74c3c },
      { type: 'cylinder', x: 16.6, z: 24, r: 0.3, h: 0.55, y: 1.55, color: 0x3498db },
      { type: 'cylinder', x: 17.6, z: 24, r: 0.3, h: 0.55, y: 1.55, color: 0xf1c40f },
      { type: 'cylinder', x: 18.6, z: 24, r: 0.3, h: 0.55, y: 1.55, color: 0x2ecc71 },
      { type: 'poster', x: 29.2, z: 20, y: 5.6, w: 2.6, h: 3.2, color: 0xfff0d0, ry: -1.5708 },
      { type: 'poster', x: 24, z: 29.2, y: 5.6, w: 2.6, h: 3.2, color: 0xe0ffe8, ry: 3.14159 }
    ],
    models: [
      // Room A/D supplies + AV gear
      { url: 'models/crate.glb', x: -27, z: -14, height: 1.7, ry: 0.3 },
      { url: 'models/crate.glb', x: -25.7, z: -13.4, height: 1.4, ry: 1.1 },
      { url: 'models/boombox.glb', x: 26, z: -14, height: 1.4, ry: 0.5 },
      // Room B science glassware
      { url: 'models/bottle.glb', x: -6, z: 8, height: 1.3, ry: 0 },
      { url: 'models/camera.glb', x: 24, z: 2, height: 2.1, ry: -1 },
      // Library reading room: a marble bust + a fancy reading chair
      { url: 'models/bust.glb', x: -26, z: 15, height: 2.4, ry: 0.6, noAnim: true },
      { url: 'models/fancychair.glb', x: -12, z: 20, height: 2.2, ry: 3.1 },
      // Art room mascot + supply crate
      { url: 'models/fox.glb', x: 20, z: 20, height: 1.4, ry: 1 },
      { url: 'models/crate.glb', x: 26, z: 26, height: 1.6, ry: -0.4 },
      // Corridor: a welcome statue, a hanging lamp, and students milling about
      { url: 'models/statue.glb', x: 0, z: -22, height: 2.4, ry: Math.PI, noAnim: true },
      { url: 'models/barnlamp.glb', x: 0, z: 0, height: 1.4, ry: 0, y: 5.5 },
      { url: 'models/riggedfig.glb', x: -2, z: 10, height: 1.85, ry: 0.4 },
      { url: 'models/riggedfig.glb', x: 2, z: 11, height: 1.85, ry: -0.5 },
      { url: 'models/cesiumman.glb', x: 0, z: 18, height: 1.9, ry: 3.1 }
    ]
  },
  mall: {
    name: '🏬 ห้างสรรพสินค้า', sky: 0xdfe4ec, ground: 0xd8d8e0, groundTexture: 'checker',
    walls: { base: '#dfe0e6', pattern: '#c6c8d2' },
    spawn: [0, 0, 0],
    // Shop-front partitions around an open central concourse
    interiorWalls: [
      { x: -20, z: -12, w: 20, d: 1 }, { x: -20, z: 12, w: 20, d: 1 },
      { x: 20, z: -12, w: 20, d: 1 }, { x: 20, z: 12, w: 20, d: 1 },
      { x: -28, z: 0, w: 1, d: 24 }, { x: 28, z: 0, w: 1, d: 24 }
    ],
    objects: [
      // Central stalls / kiosks
      { type: 'box', x: -6, z: -6, w: 3, h: 1.6, d: 3, color: 0xe07a7a },
      { type: 'box', x: 6, z: -6, w: 3, h: 1.6, d: 3, color: 0x7ab0e0 },
      { type: 'box', x: -6, z: 6, w: 3, h: 1.6, d: 3, color: 0x7ae0a0 },
      { type: 'box', x: 6, z: 6, w: 3, h: 1.6, d: 3, color: 0xe0c060 },
      { type: 'cylinder', x: 0, z: 0, r: 1.6, h: 3.5, color: 0xbfe0f0 }, // fountain
      // Shop shelves (left)
      { type: 'box', x: -24, z: -20, w: 6, h: 3, d: 1, color: 0xb08a5a },
      { type: 'box', x: -24, z: 20, w: 6, h: 3, d: 1, color: 0xb08a5a },
      { type: 'box', x: -14, z: -22, w: 4, h: 2.4, d: 1, color: 0xa0a0b0 },
      // Shop shelves (right)
      { type: 'box', x: 24, z: -20, w: 6, h: 3, d: 1, color: 0xb08a5a },
      { type: 'box', x: 24, z: 20, w: 6, h: 3, d: 1, color: 0xb08a5a },
      { type: 'box', x: 14, z: 22, w: 4, h: 2.4, d: 1, color: 0xa0a0b0 },
      // Benches in concourse
      { type: 'box', x: -10, z: 0, w: 3, h: 0.8, d: 1, color: 0x8a6a4a },
      { type: 'box', x: 10, z: 0, w: 3, h: 0.8, d: 1, color: 0x8a6a4a }
    ],
    models: [
      { url: 'models/toycar.glb', x: -22, z: -18, height: 2.4, ry: 0.5 },
      { url: 'models/sofa.glb', x: 22, z: 18, height: 2.2, ry: -1 },
      { url: 'models/boombox.glb', x: -22, z: 18, height: 1.6, ry: 1 },
      { url: 'models/camera.glb', x: 22, z: -18, height: 2.4, ry: -0.5 },
      { url: 'models/bottle.glb', x: -14, z: -20, height: 1.6, ry: 0 },
      { url: 'models/chair.glb', x: 14, z: 20, height: 2.2, ry: 2 },
      { url: 'models/duck.glb', x: 0, z: 9, height: 1.5, ry: -1 },
      // Mall mascots: cute robot greeter + display mannequin
      { url: 'models/robotcute.glb', x: 0, z: -6, height: 2.2, ry: 3.1 },
      { url: 'models/xbot.glb', x: -8, z: 8, height: 1.9, ry: 0.8 },
      // An art-display bust + stockroom crates behind the shop fronts
      { url: 'models/bust.glb', x: 8, z: 8, height: 2.4, ry: -0.8, noAnim: true },
      { url: 'models/crate.glb', x: -22, z: -20, height: 1.8, ry: 0.3 },
      { url: 'models/crate.glb', x: -20.6, z: -19.4, height: 1.5, ry: 1.1 },
      { url: 'models/crate.glb', x: 22, z: 20, height: 1.7, ry: -0.5 },
      // Mall shoppers + a greeter bot (living decoys)
      { url: 'models/cesiumman.glb', x: -4, z: 3, height: 1.9, ry: 0.5 },
      { url: 'models/cesiumman.glb', x: 4, z: 2, height: 1.9, ry: -0.6 },
      { url: 'models/robotexp.glb', x: 0, z: 4, height: 2.1, ry: 3.0 }
    ]
  },
  castle: {
    // Open-air Japanese castle town: tiered teal-roofed pagodas, wooden houses,
    // pink sakura in bloom, a red torii gate, stone lanterns, hanging paper
    // lanterns overhead, and lots of glittering treasure to hide among.
    name: '🏯 ปราสาทญี่ปุ่น', sky: 0xbcd8ea, ground: 0x9a9aa2, groundTexture: 'cobble',
    groundTint: 0xa89a7e, light: 0.82, clouds: true, size: 100,
    fog: { color: 0xc4dcea, near: 45, far: 175 },
    sunGlow: 0xffe6d0, sunColor: 0xfff0dc, ambientColor: 0xe6ecf2,
    treeline: { colors: [0x214a2a, 0x2a5a34, 0x18391f], hMin: 14, hMax: 24 },
    grassTufts: 300,
    spawn: [0, 0, 9],
    objects: [
      // ── Landmark: grand five-tier pagoda at the far end ──
      { type: 'pagoda', x: 0, z: -10, tiers: 5, r: 3.6, tierH: 3.1, roof: 0x2f8f7a },
      // Flanking three-tier watchtowers
      { type: 'pagoda', x: -15, z: -13, tiers: 3, r: 2.6, tierH: 2.8, roof: 0x2a8478 },
      { type: 'pagoda', x: 15, z: -13, tiers: 3, r: 2.6, tierH: 2.8, roof: 0x2a8478 },
      // Broad stone stairway climbing to the main pagoda
      { type: 'stairs', x: 0, z: -3.5, steps: 5, w: 10, rise: 0.4, run: 1.0 },
      // ── Red torii gate at the town entrance (walk-through) ──
      { type: 'torii', x: 0, z: 12, w: 6, h: 7 },
      { type: 'torii', x: 0, z: 4, w: 5, h: 6 },
      // ── Traditional houses lining the approach ──
      { type: 'japanhouse', x: -11, z: 4, w: 6, h: 3.2, d: 5, ry: 0.35, color: 0xe8e0d0 },
      { type: 'japanhouse', x: 11, z: 4, w: 6, h: 3.2, d: 5, ry: -0.35, color: 0xe2d8c4 },
      { type: 'japanhouse', x: -13, z: -3, w: 5.5, h: 3, d: 5, ry: 0.6, color: 0xded4c0 },
      { type: 'japanhouse', x: 13, z: -3, w: 5.5, h: 3, d: 5, ry: -0.6, color: 0xe8e0d0 },
      { type: 'japanhouse', x: -8, z: 13, w: 5, h: 2.8, d: 4.5, ry: 0.2, color: 0xe4dccb },
      { type: 'japanhouse', x: 8, z: 13, w: 5, h: 2.8, d: 4.5, ry: -0.2, color: 0xded4c0 },
      // ── Sakura grove framing the courtyard ──
      { type: 'sakura', x: -6, z: -6 }, { type: 'sakura', x: 6, z: -6 },
      { type: 'sakura', x: -9, z: 8 }, { type: 'sakura', x: 9, z: 8 },
      { type: 'sakura', x: -4, z: 16 }, { type: 'sakura', x: 4, z: 16 },
      // ── Treasure & luxury clustered around the pagoda base (hiding spots) ──
      { type: 'sphere', x: -4, z: -7.5, r: 1.3, color: 0xe6c34a },   // gold pile
      { type: 'sphere', x: -2.5, z: -8.5, r: 1.0, color: 0xf0d152 },
      { type: 'sphere', x: 4, z: -7.5, r: 1.3, color: 0xe6c34a },
      { type: 'sphere', x: 2.5, z: -8.5, r: 1.0, color: 0xf0d152 },
      { type: 'box', x: -6, z: -9, w: 2.2, h: 1.4, d: 1.6, color: 0x8a5a2a, texture: 'wood' }, // treasure chest
      { type: 'box', x: 6, z: -9, w: 2.2, h: 1.4, d: 1.6, color: 0x8a5a2a, texture: 'wood' },
      { type: 'vase', x: -3, z: -1, color: 0x2a6ea0 }, { type: 'vase', x: 3, z: -1, color: 0xa02a4a },
      { type: 'chandelier', x: 0, z: -7, color: 0xe6c34a }
    ],
    scatter: [
      // Lush blossom & greenery
      { type: 'sakura', count: 10, colors: [0xf7b8d4] },
      { type: 'cone', count: 8, colors: [0x2f6d3a, 0x256b36, 0x3a7d44], r: [0.8, 1.6], h: [3, 5.5] },
      // Overhead paper lanterns (decorative, float above the streets)
      { type: 'hanglantern', count: 22, colors: [0xd8402a, 0xe07a2a, 0xd8b02a], y: [3.5, 5.5] },
      // Luxury clutter to hide among
      { type: 'vase', count: 12, colors: [0x2a6ea0, 0xa02a4a, 0x2a8a5a, 0xd0a020] },
      { type: 'statue', count: 6, colors: [0xb8b8be] },
      { type: 'sphere', count: 12, colors: [0xe6c34a, 0xf0d152], r: [0.7, 1.5] }, // gold piles
      { type: 'box', count: 10, colors: [0x8a5a2a, 0x7a4a24], w: [1.4, 2.4], h: [1.0, 1.8], d: [1.2, 2.0], texture: 'wood' }, // chests
      { type: 'barrel', count: 8, colors: [0x8a6a3a, 0x9a7a44] },
      { type: 'rock', count: 6, colors: [0x8f9189, 0x7c7e76], r: [0.8, 1.8] } // garden stones
    ],
    models: [
      // Stone & paper lanterns line the path
      { url: 'models/lantern.glb', x: -4, z: 8, height: 3.2, ry: 0 },
      { url: 'models/lantern.glb', x: 4, z: 8, height: 3.2, ry: 0 },
      { url: 'models/lantern.glb', x: -4, z: 0, height: 3.2, ry: 0 },
      { url: 'models/lantern.glb', x: 4, z: 0, height: 3.2, ry: 0 },
      { url: 'models/barnlamp.glb', x: 0, z: 6, height: 1.4, ry: 0, y: 5 },
      // Palace treasures & guardians (luxury hiding decor)
      { url: 'models/statue.glb', x: -7, z: -1, height: 2.8, ry: 0.6, noAnim: true },
      { url: 'models/statue.glb', x: 7, z: -1, height: 2.8, ry: -0.6, noAnim: true },
      { url: 'models/fancychair.glb', x: -2, z: 2, height: 2.4, ry: 0.4 },
      { url: 'models/fancychair.glb', x: 2, z: 2, height: 2.4, ry: -0.4 },
      { url: 'models/sofa.glb', x: 0, z: 15, height: 2.2, ry: 3.1 },
      { url: 'models/dish.glb', x: 0, z: -6, height: 0.6, ry: 0, y: 0.9 },
      { url: 'models/head.glb', x: 0, z: -8.5, height: 1.4, ry: 3.1, y: 1.2 },
      // A little wildlife in the garden
      { url: 'models/stork.glb', x: -10, z: -8, height: 2.6, ry: 0.5, y: 0.5 },
      { url: 'models/parrot.glb', x: 12, z: 9, height: 1.1, ry: -2, y: 2.5 },
      // Castle-town folk wandering the courtyard (living decoys)
      { url: 'models/cesiumman.glb', x: -3, z: 4, height: 1.9, ry: 0.4 },
      { url: 'models/cesiumman.glb', x: 3, z: 5, height: 1.9, ry: -0.5 },
      { url: 'models/riggedfig.glb', x: -6, z: 11, height: 1.9, ry: 1.0 }
    ]
  }
};

// ===== Procedural textures (canvas -> THREE.CanvasTexture) =====
function makeCheckerTexture(c1, c2, squares, size) {
  size = size || 512; squares = squares || 8;
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const ctx = cv.getContext('2d');
  const s = size / squares;
  for (let y = 0; y < squares; y++) {
    for (let x = 0; x < squares; x++) {
      ctx.fillStyle = ((x + y) % 2 === 0) ? c1 : c2;
      ctx.fillRect(x * s, y * s, s, s);
    }
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function makeGrassTexture(size) {
  size = size || 256;
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#7bb35a';
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 900; i++) {
    const g = 140 + Math.floor(Math.random() * 90);
    ctx.fillStyle = `rgb(${Math.floor(g * 0.5)},${g},${Math.floor(g * 0.4)})`;
    ctx.fillRect(Math.random() * size, Math.random() * size, 2, 4);
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

// A tuft of tall grass blades on a transparent background — mapped onto the
// instanced crossed quads scattered across outdoor maps
function makeGrassBladeTexture(size) {
  size = size || 128;
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const ctx = cv.getContext('2d');
  for (let i = 0; i < 26; i++) {
    const bx = 6 + Math.random() * (size - 12);        // blade root x
    const h = size * (0.45 + Math.random() * 0.5);     // blade height
    const lean = (Math.random() - 0.5) * size * 0.25;  // tip lean
    const w = 2.5 + Math.random() * 3;                 // root width
    const g = 120 + Math.floor(Math.random() * 100);
    ctx.fillStyle = `rgb(${Math.floor(g * 0.45)},${g},${Math.floor(g * 0.35)})`;
    ctx.beginPath();
    ctx.moveTo(bx - w / 2, size);
    ctx.quadraticCurveTo(bx - w / 4 + lean / 2, size - h / 2, bx + lean, size - h);
    ctx.quadraticCurveTo(bx + w / 4 + lean / 2, size - h / 2, bx + w / 2, size);
    ctx.closePath();
    ctx.fill();
  }
  return new THREE.CanvasTexture(cv);
}

// Sandy ground: warm speckle + faint wind-ripple arcs
function makeSandTexture(size) {
  size = size || 256;
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#ddb670';
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 650; i++) {
    const c = 175 + Math.floor(Math.random() * 60);
    ctx.fillStyle = `rgb(${c},${Math.floor(c * 0.8)},${Math.floor(c * 0.52)})`;
    ctx.fillRect(Math.random() * size, Math.random() * size, 2, 2);
  }
  ctx.strokeStyle = 'rgba(150,110,60,0.28)';
  ctx.lineWidth = 2;
  for (let y = 10; y < size; y += 18) {
    ctx.beginPath();
    for (let x = 0; x <= size; x += 16) {
      const yy = y + Math.sin(x * 0.15 + y) * 4;
      if (x === 0) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
    }
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

// Adobe plaster for desert houses — sandy render with rough weathering streaks
function makeAdobeTexture(baseHex, size) {
  size = size || 128;
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const ctx = cv.getContext('2d');
  const c = new THREE.Color(baseHex || 0xd9bd93);
  ctx.fillStyle = `rgb(${Math.floor(c.r * 255)},${Math.floor(c.g * 255)},${Math.floor(c.b * 255)})`;
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 240; i++) {
    const a = 0.05 + Math.random() * 0.1;
    ctx.fillStyle = Math.random() < 0.5 ? `rgba(90,60,30,${a})` : `rgba(255,245,220,${a})`;
    ctx.fillRect(Math.random() * size, Math.random() * size, 2 + Math.random() * 5, 1 + Math.random() * 3);
  }
  return new THREE.CanvasTexture(cv);
}

// Cream ceramic floor tiles with grout lines (classroom / indoor)
function makeTileTexture(size) {
  size = size || 256;
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const ctx = cv.getContext('2d');
  const step = size / 2;
  for (let y = 0; y < 2; y++) {
    for (let x = 0; x < 2; x++) {
      const shade = 226 + Math.floor(Math.random() * 16);
      ctx.fillStyle = `rgb(${shade},${shade - 12},${shade - 34})`;
      ctx.fillRect(x * step, y * step, step, step);
      // subtle sheen speckle
      for (let s = 0; s < 20; s++) {
        ctx.fillStyle = `rgba(255,255,255,${0.03 + Math.random() * 0.05})`;
        ctx.fillRect(x * step + Math.random() * step, y * step + Math.random() * step, 3, 3);
      }
    }
  }
  ctx.strokeStyle = '#b9a67e';
  ctx.lineWidth = size / 40;
  for (let i = 0; i <= 2; i++) {
    ctx.beginPath(); ctx.moveTo(i * step, 0); ctx.lineTo(i * step, size); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i * step); ctx.lineTo(size, i * step); ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

// Chalkboard: dark green slate with a chalk message + faint eraser smudges
function makeChalkTexture(text) {
  const w = 512, h = 256;
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#20402c';
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 30; i++) { // eraser smudges
    ctx.fillStyle = `rgba(210,235,215,${0.02 + Math.random() * 0.04})`;
    ctx.beginPath();
    ctx.ellipse(Math.random() * w, Math.random() * h, 30 + Math.random() * 50, 12 + Math.random() * 20, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#f6f7ee';
  ctx.font = 'bold 96px Comic Sans MS, "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text || '1+1 = ?', w / 2, h / 2);
  return new THREE.CanvasTexture(cv);
}

// A single colored book spine texture — pages edge + a title band
function makeBookSpineColor() {
  const palette = [0xcf5b5b, 0x5b7fcf, 0x5bcf7f, 0xf1c40f, 0xe67e22, 0x9b59b6, 0x1abc9c, 0xe91e63];
  return palette[Math.floor(Math.random() * palette.length)];
}

// Fresh snowfield: white base, faint blue shading + sparkle specks
function makeSnowTexture(size) {
  size = size || 256;
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#f2f6fa';
  ctx.fillRect(0, 0, size, size);
  // Soft blue-grey patches (wind-swept drifts)
  for (let i = 0; i < 26; i++) {
    ctx.fillStyle = `rgba(190,208,226,${0.06 + Math.random() * 0.08})`;
    ctx.beginPath();
    ctx.ellipse(Math.random() * size, Math.random() * size,
      18 + Math.random() * 40, 8 + Math.random() * 18, Math.random() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  // Sparkles
  for (let i = 0; i < 90; i++) {
    ctx.fillStyle = `rgba(255,255,255,${0.5 + Math.random() * 0.5})`;
    ctx.fillRect(Math.random() * size, Math.random() * size, 1.5, 1.5);
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

// City block: asphalt streets with dashed lanes framing a sidewalk block.
// Repeated across the ground it reads as a downtown street grid from above.
function makeAsphaltTexture(size) {
  size = size || 256;
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const ctx = cv.getContext('2d');
  // Asphalt base with noise
  ctx.fillStyle = '#54565c';
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 350; i++) {
    const g = 70 + Math.floor(Math.random() * 40);
    ctx.fillStyle = `rgb(${g},${g},${g + 4})`;
    ctx.fillRect(Math.random() * size, Math.random() * size, 2, 2);
  }
  // Sidewalk block in the centre (street ring stays around the edge)
  const road = size * 0.18;
  ctx.fillStyle = '#9a9aa0';
  ctx.fillRect(road, road, size - road * 2, size - road * 2);
  ctx.strokeStyle = '#84848a';
  ctx.lineWidth = 2;
  const pav = (size - road * 2) / 4;
  for (let i = 1; i < 4; i++) {
    ctx.beginPath(); ctx.moveTo(road + pav * i, road); ctx.lineTo(road + pav * i, size - road); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(road, road + pav * i); ctx.lineTo(size - road, road + pav * i); ctx.stroke();
  }
  // Dashed lane markings along the streets
  ctx.fillStyle = '#e8e6d8';
  for (let t = size * 0.05; t < size; t += size * 0.14) {
    ctx.fillRect(t, road * 0.42, size * 0.07, 3);
    ctx.fillRect(road * 0.42, t, 3, size * 0.07);
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

// Office tower facade: colored wall with a grid of windows (some lit warm)
function makeBuildingTexture(baseHex, size) {
  size = size || 256;
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const ctx = cv.getContext('2d');
  const c = new THREE.Color(baseHex || 0x9aa7b3);
  ctx.fillStyle = `rgb(${Math.floor(c.r * 255)},${Math.floor(c.g * 255)},${Math.floor(c.b * 255)})`;
  ctx.fillRect(0, 0, size, size);
  const cols = 5, rows = 7;
  const ww = size / cols, wh = size / rows;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      ctx.fillStyle = Math.random() < 0.25 ? '#f2e3a0' : '#2c3e50';
      ctx.fillRect(x * ww + ww * 0.22, y * wh + wh * 0.2, ww * 0.56, wh * 0.55);
    }
  }
  return new THREE.CanvasTexture(cv);
}

// Store/rooftop sign: bold white text on a colored board
function makeSignTexture(text, bgHex) {
  const w = 256, h = 96;
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d');
  const c = new THREE.Color(bgHex || 0xd63a3a);
  ctx.fillStyle = `rgb(${Math.floor(c.r * 255)},${Math.floor(c.g * 255)},${Math.floor(c.b * 255)})`;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = 5;
  ctx.strokeRect(4, 4, w - 8, h - 8);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 52px "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text || 'SHOP', w / 2, h / 2 + 2);
  return new THREE.CanvasTexture(cv);
}

// Molten lava: deep red-orange base, bright blobs, dark crust patches.
// Scrolled via texture offset to make rivers actually flow.
function makeLavaTexture(size) {
  size = size || 256;
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#b33000';
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 40; i++) { // bright molten blobs
    ctx.fillStyle = Math.random() < 0.5 ? '#ff7a00' : '#ffc23a';
    ctx.beginPath();
    ctx.ellipse(Math.random() * size, Math.random() * size,
      6 + Math.random() * 22, 4 + Math.random() * 12, Math.random() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  for (let i = 0; i < 26; i++) { // cooling crust patches
    ctx.fillStyle = 'rgba(60,18,8,0.8)';
    ctx.beginPath();
    ctx.ellipse(Math.random() * size, Math.random() * size,
      5 + Math.random() * 16, 3 + Math.random() * 9, Math.random() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

// Volcanic rock skin: dark stone plus glowing lava cracks. Returns a color
// map and a matching emissive map (cracks only) so just the cracks glow.
function makeLavaCrackTextures(size) {
  size = size || 128;
  const colorCv = document.createElement('canvas');
  const glowCv = document.createElement('canvas');
  colorCv.width = colorCv.height = glowCv.width = glowCv.height = size;
  const cctx = colorCv.getContext('2d');
  const gctx = glowCv.getContext('2d');
  cctx.fillStyle = '#2e2a28';
  cctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 160; i++) {
    const g = 30 + Math.floor(Math.random() * 30);
    cctx.fillStyle = `rgb(${g + 8},${g},${g - 4})`;
    cctx.fillRect(Math.random() * size, Math.random() * size, 3, 3);
  }
  gctx.fillStyle = '#000000';
  gctx.fillRect(0, 0, size, size);
  // Jagged crack polylines drawn on both canvases
  for (let c = 0; c < 7; c++) {
    let x = Math.random() * size, y = Math.random() * size;
    const pts = [[x, y]];
    for (let s = 0; s < 6; s++) {
      x += (Math.random() - 0.5) * size * 0.4;
      y += (Math.random() - 0.5) * size * 0.4;
      pts.push([x, y]);
    }
    [cctx, gctx].forEach(ctx => {
      ctx.strokeStyle = '#ff8a30';
      ctx.lineWidth = 2 + Math.random() * 2;
      ctx.beginPath();
      pts.forEach(([px, py], i) => i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py));
      ctx.stroke();
    });
  }
  return {
    map: new THREE.CanvasTexture(colorCv),
    emissiveMap: new THREE.CanvasTexture(glowCv)
  };
}

// Painting canvas for gilt frames — a few classical styles:
// 0 portrait, 1 landscape, 2 abstract, 3 staircase
function makePaintingTexture(style) {
  const w = 128, h = 160;
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d');
  const s = style !== undefined ? style : Math.floor(Math.random() * 4);
  if (s === 0) { // portrait: pale figure on a dark ground
    ctx.fillStyle = '#2a241c';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#d8c8a8';
    ctx.beginPath();
    ctx.ellipse(w / 2, h * 0.38, w * 0.18, h * 0.16, 0, 0, Math.PI * 2); // head
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(w / 2, h * 0.78, w * 0.3, h * 0.24, 0, 0, Math.PI * 2); // shoulders
    ctx.fill();
    ctx.fillStyle = '#3a3028';
    ctx.fillRect(0, h * 0.72, w, h * 0.28);
  } else if (s === 1) { // landscape: sky, hills, sun
    ctx.fillStyle = '#9fc4e0';
    ctx.fillRect(0, 0, w, h * 0.55);
    ctx.fillStyle = '#e8d08a';
    ctx.beginPath(); ctx.arc(w * 0.75, h * 0.2, 12, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#5a8a4a';
    ctx.beginPath();
    ctx.ellipse(w * 0.3, h * 0.62, w * 0.5, h * 0.2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#4a7a3e';
    ctx.beginPath();
    ctx.ellipse(w * 0.8, h * 0.7, w * 0.5, h * 0.24, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#3f6a35';
    ctx.fillRect(0, h * 0.75, w, h * 0.25);
  } else if (s === 2) { // abstract blocks
    const cols = ['#c0392b', '#2980b9', '#f1c40f', '#ecf0f1', '#2c3e50'];
    ctx.fillStyle = '#e8e2d4';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 7; i++) {
      ctx.fillStyle = cols[i % cols.length];
      ctx.fillRect(Math.random() * w * 0.7, Math.random() * h * 0.7,
        10 + Math.random() * w * 0.3, 10 + Math.random() * h * 0.3);
    }
  } else { // staircase in a dim hall (the classic in-game painting)
    ctx.fillStyle = '#3a3228';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#8a7a62';
    for (let i = 0; i < 7; i++) {
      ctx.fillRect(w * 0.15 + i * 6, h * 0.75 - i * 14, w * 0.55, 9);
    }
    ctx.fillStyle = '#241f18';
    ctx.fillRect(w * 0.62, h * 0.08, w * 0.28, h * 0.5); // dark doorway
  }
  return new THREE.CanvasTexture(cv);
}

// Cobblestone ground texture (village streets)
function makeCobbleTexture(size) {
  size = size || 256;
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#7d7468';
  ctx.fillRect(0, 0, size, size);
  const step = size / 6;
  for (let y = 0; y < 6; y++) {
    for (let x = 0; x < 6; x++) {
      const g = 120 + Math.floor(Math.random() * 50);
      ctx.fillStyle = `rgb(${g},${g - 8},${g - 18})`;
      const cx = x * step + step / 2 + (y % 2 ? step / 3 : 0);
      const cy = y * step + step / 2;
      ctx.beginPath();
      ctx.ellipse(cx % size, cy, step * 0.42, step * 0.34, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

// Brick wall texture — surfaces hiders can imitate with the brush
function makeBrickTexture(base, mortar, size) {
  size = size || 256;
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = mortar || '#d8cfc4';
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = base || '#a8574a';
  const bh = size / 8, bw = size / 4, gap = 3;
  for (let row = 0; row < 8; row++) {
    const offset = (row % 2) ? bw / 2 : 0;
    for (let col = -1; col < 5; col++) {
      ctx.fillRect(col * bw + offset + gap, row * bh + gap, bw - gap * 2, bh - gap * 2);
    }
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

// Wood plank texture
function makeWoodTexture(base, grain, size) {
  size = size || 256;
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = base || '#9c6b3f';
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = grain || '#7a4f2c';
  ctx.lineWidth = 2;
  const plank = size / 5;
  for (let i = 0; i <= 5; i++) {
    ctx.beginPath(); ctx.moveTo(0, i * plank); ctx.lineTo(size, i * plank); ctx.stroke();
  }
  ctx.lineWidth = 1;
  for (let i = 0; i < 24; i++) {
    const y = Math.random() * size;
    ctx.beginPath();
    ctx.moveTo(Math.random() * size * 0.4, y);
    ctx.lineTo(Math.random() * size * 0.6 + size * 0.4, y + (Math.random() - 0.5) * 8);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

// Polka-dot texture
function makeDotsTexture(base, dot, size) {
  size = size || 256;
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = base || '#e0c060';
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = dot || '#b0903a';
  const step = size / 4;
  for (let y = 0; y < 4; y++) {
    for (let x = 0; x < 4; x++) {
      const cx = x * step + step / 2 + (y % 2 ? step / 2 : 0);
      ctx.beginPath(); ctx.arc(cx % size, y * step + step / 2, step * 0.18, 0, Math.PI * 2); ctx.fill();
    }
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

// Rainbow gradient texture for the seeker's laser beam (runs along the beam)
let _rainbowTex = null;
function makeRainbowTexture() {
  if (_rainbowTex) return _rainbowTex;
  const cv = document.createElement('canvas');
  cv.width = 8; cv.height = 128;
  const ctx = cv.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 128);
  ['#ff3b30', '#ff9500', '#ffe03a', '#34c759', '#32d0e0', '#3b6bff', '#b05bff'].forEach((c, i, arr) => {
    g.addColorStop(i / (arr.length - 1), c);
  });
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 8, 128);
  _rainbowTex = new THREE.CanvasTexture(cv);
  _rainbowTex.wrapS = _rainbowTex.wrapT = THREE.RepeatWrapping;
  return _rainbowTex;
}

// Damask-ish wallpaper: base color with a repeating motif
function makeWallpaperTexture(base, pattern, size) {
  size = size || 256;
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = pattern;
  const step = size / 4;
  for (let y = 0; y < 4; y++) {
    for (let x = 0; x < 4; x++) {
      const cx = x * step + step / 2 + (y % 2 ? step / 2 : 0);
      const cy = y * step + step / 2;
      ctx.beginPath();
      ctx.ellipse(cx, cy, step * 0.22, step * 0.34, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

class GameEngine {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.gameState = 'waiting';
    this.score = 0;
    this.powers = [];

    // ===== Special abilities (bought with energy earned by answering) =====
    // Timed ones live in abilityTimers (id -> seconds left) and are undone by
    // _endAbility when they run out. See activateAbility().
    this.abilityTimers = {};
    this.speedMul = 1;      // 💨 วิ่งเร็ว
    this.jumpMul = 1;       // 🦘 กระโดดสูง / ปีนไว
    this.radarOn = false;   // 📡 เรดาร์เตือนภัย
    this.droneOn = false;   // 🚁 โดรนสำรวจ
    this.decoys = [];       // 🎭 หุ่นล่อ that have been placed
    this.disguise = null;   // 📦 prop mesh worn while disguised
    this._xraySaved = null; // 👁️ material states saved while seeing through props
    this._scanMarks = [];   // 🔍 markers hovering over scanned hiders
    this.duration = 300; // hunt-phase seconds
    this.hidePhase = 120; // seconds hiders get to hide before the hunt starts
    this.startTime = null;
    this.isHider = false;
    this.selfCaught = false;
    this.caughtPlayers = new Set(); // ids of hiders already eliminated
    this.moveInput = null; // {x,z} from an on-screen joystick (mobile)
    this.currentPaintColor = '#e74c3c';
    this.brushSize = 12;
    this.keys = {};
    this.currentPose = 'stand';

    // Liveliness: GLB animation mixers, drifting clouds, swaying trees
    this.mixers = [];
    this.clouds = [];
    this._time = 0;

    // Seeker rainbow lasers (active beams being faded out)
    this.lasers = [];
    this.bound = 28; // movement clamp, set from map size in _buildStage

    // Touch play: paint is an explicit mode (see the canvas drag handler), so
    // swiping to look around doesn't smear paint over your own body
    this.touchDevice = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
    this.paintMode = false;

    // Eyedropper: click a world surface to suck its color for camouflage
    this.eyedropperMode = false;
    this.onColorSucked = null; // callback(hexColor) set by the UI

    // Animated GLB roots (living targets) — laser hits on these trigger the siren
    this.animatedRoots = [];

    // Remote players (multiplayer): playerId -> { rig, role, target, pose, walkPhase }
    this.remotePlayers = new Map();
    this.onPaintStroke = null;  // callback(stroke) → UI broadcasts to other players
    this.onPlayerFound = null;  // callback(playerId) → seeker's laser hit a hider
    this.onLaserShot = null;    // callback(beam data) → other players render the beam
    this.onAbility = null;      // callback(payload) → other players mirror my ability
    this.onSpectator = null;    // callback(on) → tell others the host is monitoring
    this.spectator = false;     // host monitor mode: watching, not playing

    // Camera orbit state
    this.camAngle = Math.PI;
    this.camPitch = 0.35;
    this.camDist = 12;

    this._boundResize = () => this._onResize();
  }

  initialize(players, currentPlayerId, isHider, mapId) {
    this.isHider = isHider;
    this.mapId = mapId && GAME_MAPS[mapId] ? mapId : 'meadow';
    this.startTime = Date.now();
    this.gameState = 'playing';
    // Lobby mode: engine runs so players can walk + paint while waiting, but
    // getPhase() reports 'lobby' so no one gets caught and the timer doesn't
    // count down. beginMatch() drops it and starts the real hide/hunt clock.
    this.lobbyMode = false;
    // Remember how many players are in the room so hiding cover can scale
    // with the crowd (more players → more props to hide behind)
    this._playerCount = players && players.size ? players.size : 1;

    this._initThree();
    this._buildStage();
    this._buildCharacter();
    this._setupInput();
    this._lastT = performance.now();
    this._animate();
  }

  // Enter the pre-match lobby: players can move + paint but nothing counts.
  // Call beginMatch() when the host presses Start to drop into the real game.
  startLobby() { this.lobbyMode = true; }
  beginMatch() { this.lobbyMode = false; this.startTime = Date.now(); }

  _initThree() {
    const w = this.canvas.parentElement.clientWidth || 800;
    const h = this.canvas.parentElement.clientHeight || 600;

    // Phones (esp. iPhone) have a tight WebGL memory budget — antialiasing
    // roughly doubles the framebuffer, and iOS Safari reloads the whole tab
    // when it runs out. Turn it off on phones; the softer edges are a fair
    // trade for not getting kicked back to the menu.
    const isPhone = (('ontouchstart' in window) || navigator.maxTouchPoints > 0) &&
                    Math.max(window.innerWidth, window.innerHeight) < 900;
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: !isPhone });
    this.renderer.setSize(w, h, false);
    this.renderer.setPixelRatio(this._targetPixelRatio());

    // Filmic tone mapping rolls the highlights off instead of clipping them to
    // flat white, which is what made pale maps (the manor's plasterwork, the
    // laundromat) blow out. Exposure stays at 1 — lifting it just trades the
    // glare back for the brightness, and the maps are already tuned by eye.
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1;

    // Shadows ground everything — without them props look like they float above
    // the floor. Phones skip them: the extra depth pass plus a second render
    // target is exactly the memory pressure that reloads the tab on iOS.
    this._shadows = !isPhone;
    if (this._shadows) {
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    }

    // Mobile GPUs — iPads especially — drop the WebGL context under memory
    // pressure or when entering fullscreen. Nothing handled that, so the 3D
    // view went black permanently while the HUD kept ticking. Recover instead.
    this.canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();               // without this the context never comes back
      this._contextLost = true;
      if (this._raf) { cancelAnimationFrame(this._raf); this._raf = null; }
      // Ignore the loss we cause ourselves while tearing the engine down
      if (this._disposing) return;
      if (this.onContextLost) this.onContextLost();
    }, false);
    this.canvas.addEventListener('webglcontextrestored', () => {
      this._contextLost = false;
      if (this.onContextRestored) this.onContextRestored();
    }, false);

    this.scene = new THREE.Scene();
    // Background color is set per-map in _buildStage

    this.camera = new THREE.PerspectiveCamera(60, w / h, 0.1, 500);

    // Per-map light level so night/indoor stages feel moody, not washed out
    const mapCfg = GAME_MAPS[this.mapId] || {};
    const L = mapCfg.light !== undefined ? mapCfg.light : 1;
    // Optional warm/cool light tints per map (sunset, night, indoor...)
    // Fill lights are kept modest so bright maps don't wash out; the sun
    // still gives shape. (Reduced from 0.55/0.5/0.85 — several maps read
    // as over-exposed at the old levels.)
    // The environment probe (see _applyEnvironment) is itself ambient bounce,
    // so the explicit fills are cut back hard — left as they were, the two
    // stack and every stage came out ~40 luminance points brighter than it was
    // tuned at, which is the glare we just spent two rounds removing.
    const ambient = new THREE.AmbientLight(mapCfg.ambientColor || 0xffffff, 0.14 * L);
    this.scene.add(ambient);
    const hemi = new THREE.HemisphereLight(mapCfg.ambientColor || 0xffffff, 0x666680, 0.13 * L);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(mapCfg.sunColor || 0xffffff, 0.78 * L);
    // Push the sun out in proportion to the stage so its shadow frustum can
    // cover the whole map — a fixed close position only shadowed the middle
    const stageSize = (mapCfg.size || 60) * (mapCfg.scale || DEFAULT_MAP_SCALE);
    sun.position.set(stageSize * 0.28, stageSize * 0.5, stageSize * 0.2);
    if (this._shadows) {
      sun.castShadow = true;
      // Keep the shadow frustum small and let it follow the player (see
      // _followSun). Sized to the whole stage it works out to several units per
      // texel, and a player-sized shadow simply vanishes between texels.
      const half = 34;
      const sc = sun.shadow.camera;
      sc.left = -half; sc.right = half; sc.top = half; sc.bottom = -half;
      sc.near = 1; sc.far = 190;
      sun.shadow.mapSize.set(2048, 2048);
      sun.shadow.bias = -0.0015;      // stops the acne on the big flat floor
      sun.shadow.normalBias = 0.02;
      this.scene.add(sun.target);     // target must be in the scene to count
    }
    this.sun = sun;
    this._sunOffset = new THREE.Vector3(42, 75, 30);
    this.scene.add(sun);

    window.addEventListener('resize', this._boundResize);
  }

  _buildStage() {
    const map = GAME_MAPS[this.mapId] || GAME_MAPS.meadow;
    this.wallBoxes = []; // AABBs for collision (interior walls)
    // Meshes the follow-camera must not reverse through (outer + interior
    // walls). Backing into one filled the screen with wallpaper.
    this._camBlockers = [];

    // Stage size, expanded by a global scale so every map feels wide open.
    // All positions (walls, props, models, spawn) are multiplied by S.
    const S = map.scale || DEFAULT_MAP_SCALE;
    this.mapScale = S;
    const size = (map.size || 60) * S;
    this.bound = size / 2 - 2;

    // Sky
    this.scene.background = new THREE.Color(map.sky);

    // Metals need something to reflect: with no environment a metalness>0
    // material resolves to black, so the new gilding would read as dead
    // charcoal. A two-stop sky-over-ground probe is enough to make gold look
    // like gold, and it gives every other surface a little soft ambient bounce.
    this._applyEnvironment(map);

    // Ground — optional procedural texture (repeats scale with size)
    let groundMat;
    if (map.groundTexture === 'checker') {
      // A map can soften the stark black/white squares — the default is a hard
      // chequerboard whose dark tiles read almost black, which makes a big room
      // measure much darker than a narrow corridor of the same lighting.
      const ck = map.checkerColors || ['#e8e8e8', '#2b2b2b'];
      const tex = makeCheckerTexture(ck[0], ck[1], 2, 256);
      tex.repeat.set(size / 4, size / 4);
      // Tint lets a map warm the tiles (the manor's marble) like the other floors
      groundMat = new THREE.MeshStandardMaterial({ map: tex, color: map.groundTint || 0xffffff });
    } else if (map.groundTexture === 'grass') {
      const tex = makeGrassTexture();
      tex.repeat.set(size / 4.5, size / 4.5);
      // Optional tint multiplies the texture — lets maps deepen the green
      groundMat = new THREE.MeshStandardMaterial({ map: tex, color: map.groundTint || 0xffffff });
    } else if (map.groundTexture === 'sand') {
      const tex = makeSandTexture();
      tex.repeat.set(size / 5, size / 5);
      groundMat = new THREE.MeshStandardMaterial({ map: tex, color: map.groundTint || 0xffffff });
    } else if (map.groundTexture === 'tile') {
      const tex = makeTileTexture();
      tex.repeat.set(size / 3, size / 3);
      groundMat = new THREE.MeshStandardMaterial({ map: tex, color: map.groundTint || 0xffffff });
    } else if (map.groundTexture === 'snow') {
      const tex = makeSnowTexture();
      tex.repeat.set(size / 8, size / 8);
      groundMat = new THREE.MeshStandardMaterial({ map: tex, color: map.groundTint || 0xffffff });
    } else if (map.groundTexture === 'asphalt') {
      const tex = makeAsphaltTexture();
      tex.repeat.set(size / 14, size / 14);
      groundMat = new THREE.MeshStandardMaterial({ map: tex, color: map.groundTint || 0xffffff });
    } else if (map.groundTexture === 'cobble') {
      const tex = makeCobbleTexture();
      tex.repeat.set(size / 6, size / 6);
      groundMat = new THREE.MeshStandardMaterial({ map: tex, color: map.groundTint || 0xffffff });
    } else {
      groundMat = new THREE.MeshStandardMaterial({ color: map.ground });
    }
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(size, size), groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = this._shadows;   // the floor is what sells the shadows
    this.scene.add(ground);

    // Walls (indoor maps) with wallpaper texture
    if (map.walls) {
      const wtex = makeWallpaperTexture(map.walls.base, map.walls.pattern);
      wtex.repeat.set(8, 3);
      const wallMat = new THREE.MeshStandardMaterial({ map: wtex, side: THREE.DoubleSide });
      const H = 9, span = size, y = H / 2, edge = size / 2;
      const addWall = (x, z, ry) => {
        const w = new THREE.Mesh(new THREE.PlaneGeometry(span, H), wallMat);
        w.position.set(x, y, z);
        w.rotation.y = ry;
        this.scene.add(w);
        this._camBlockers.push(w);   // so the camera can't back through it
      };
      addWall(0, -edge, 0);
      addWall(0, edge, Math.PI);
      addWall(-edge, 0, Math.PI / 2);
      addWall(edge, 0, -Math.PI / 2);
      // Ceiling — dark by default so open-plan indoor maps read as a void
      // overhead; a map can set a pale ceiling (the manor's plasterwork)
      const ceil = new THREE.Mesh(
        new THREE.PlaneGeometry(span, span),
        new THREE.MeshStandardMaterial({ color: map.ceiling !== undefined ? map.ceiling : 0x3a2a22 })
      );
      ceil.rotation.x = Math.PI / 2;
      ceil.position.y = H;
      this.scene.add(ceil);

      // Grid of glowing ceiling light panels (office-style). A map can turn
      // these off when it lights itself — the manor hangs chandeliers and wall
      // sconces instead, and the panels both washed it out and looked wrong.
      if (map.ceilingPanels !== false) {
        const lightMat = new THREE.MeshStandardMaterial({
          color: 0xffffff, emissive: 0xffffee, emissiveIntensity: 1.1
        });
        const lightGeo = new THREE.BoxGeometry(3, 0.18, 1.4);
        for (let lx = -edge + 10; lx <= edge - 10; lx += 13) {
          for (let lz = -edge + 10; lz <= edge - 10; lz += 13) {
            const panel = new THREE.Mesh(lightGeo, lightMat);
            panel.position.set(lx, H - 0.15, lz);
            this.scene.add(panel);
          }
        }
      }
    }

    // Interior partition walls (solid boxes with collision) — for multi-room maps
    if (map.interiorWalls) {
      const iwTex = map.walls
        ? makeWallpaperTexture(map.walls.base, map.walls.pattern)
        : null;
      if (iwTex) iwTex.repeat.set(4, 2);
      const H = 9;
      map.interiorWalls.forEach(w => {
        // Scale the whole layout so rooms and doorways widen together
        const wx = w.x * S, wz = w.z * S, ww = w.w * S, wd = w.d * S;
        const mat = iwTex
          ? new THREE.MeshStandardMaterial({ map: iwTex })
          : new THREE.MeshStandardMaterial({ color: 0xd8cabb });
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(ww, H, wd), mat);
        mesh.position.set(wx, H / 2, wz);
        this._shade(mesh);
        this.scene.add(mesh);
        this._camBlockers.push(mesh);
        this.wallBoxes.push({
          minX: wx - ww / 2, maxX: wx + ww / 2,
          minZ: wz - wd / 2, maxZ: wz + wd / 2, top: H
        });
      });
    }

    // Objects to hide behind / blend with (positions spread by map scale).
    // Collision AABBs are computed automatically from each object's real
    // bounds after everything is placed (see _buildObstacleBoxes).
    this.obstacles = [];
    const placeObject = (o) => {
      const mesh = this._makeObject({ ...o, x: o.x * S, z: o.z * S });
      this._shade(mesh);
      this.scene.add(mesh);
      this.obstacles.push(mesh);
    };
    map.objects.forEach(placeObject);

    // Repeating grids of an object (classroom desk rows, etc.)
    if (map.grid) {
      map.grid.forEach(g => {
        for (let r = 0; r < g.rows; r++) {
          for (let c = 0; c < g.cols; c++) {
            placeObject({ ...g, x: g.x0 + c * g.dx, z: g.z0 + r * g.dz });
          }
        }
      });
    }

    // Scattered props: randomly place many extra objects across the stage
    if (map.scatter) {
      const rand = (range) => range[0] + Math.random() * (range[1] - range[0]);
      const spawn = map.spawn || [0, 0, 8];
      // More players → more cover so a crowded room still has places to hide.
      // Ramps from ×3 (small games) up to ×5 at ~40 players.
      const crowd = 3 + Math.min(2, Math.max(0, (this._playerCount - 6) / 17));
      // Bigger stages get proportionally more props so an enlarged map never
      // feels bare — scales gently with the play area, capped for performance.
      const areaBoost = Math.max(1, Math.min(1.4, this.bound / 82));
      map.scatter.forEach(s => {
        const count = Math.round(s.count * crowd * areaBoost);
        for (let i = 0; i < count; i++) {
          // Keep clear of the spawn point so players don't start inside a prop
          let x, z, tries = 0;
          do {
            x = -this.bound + 4 + Math.random() * (this.bound * 2 - 8);
            z = -this.bound + 4 + Math.random() * (this.bound * 2 - 8);
            tries++;
          } while (Math.hypot(x - spawn[0], z - spawn[2]) < 9 && tries < 12);

          const o = { type: s.type, color: s.colors[i % s.colors.length], x, z };
          if (s.texture) o.texture = s.texture;
          if (s.emissive) { o.emissive = s.emissive; o.emissiveIntensity = s.emissiveIntensity; }
          if (s.y) o.y = rand(s.y);
          // Compound props (their builders self-size) need no random dims
          const COMPOUND = ['bookstack', 'globe', 'desk', 'bookshelf', 'clock', 'poster', 'computer', 'flag', 'ruin', 'twig',
                            'shop', 'car', 'trashcan', 'coral', 'kelp', 'sub', 'barrel', 'dome', 'rockspire',
                            'glowflower', 'tent', 'jellyfish', 'deadtree', 'fruittree', 'lamp', 'scarecrow', 'fence',
                            'stall', 'producebin', 'table', 'ghostkid', 'spiderghost', 'krasue', 'sheetghost',
                            'statue', 'vase', 'chandelier', 'pagoda', 'japanhouse', 'sakura', 'torii',
                            'column', 'curtain', 'fireplace', 'mirror', 'console', 'velvetsofa',
                            'balustrade', 'grandpiano', 'ornatebed', 'archshelf', 'pottedpalm', 'sconce',
                            'stairs', 'hanglantern', 'cabin',
                            'washer', 'foldtable', 'laundrybasket', 'detergentshelf'];
          if (COMPOUND.includes(s.type)) { /* builder handles sizing */ }
          else if (s.type === 'sphere') { o.r = rand(s.r); }
          else if (s.type === 'rock' || s.type === 'lavarock') { o.r = rand(s.r); o.sy = 0.65 + Math.random() * 0.35; }
          else if (s.type === 'cone' || s.type === 'cylinder' ||
                   s.type === 'cactus' || s.type === 'mesa' ||
                   s.type === 'bigtree' || s.type === 'snowpine') { o.r = rand(s.r); o.h = rand(s.h); }
          // Fall back to a sane size if a scatter entry forgets its ranges —
          // a missing one used to throw out of _buildStage and leave the whole
          // stage unbuilt (a black screen) over one bad line of map config
          else { o.w = rand(s.w || [1, 2]); o.h = rand(s.h || [1, 2]); o.d = rand(s.d || [1, 2]); }

          let mesh;
          try {
            mesh = this._makeObject(o);
          } catch (err) {
            console.warn('Skipped scatter prop', s.type, err);
            continue;                 // one broken prop must not cost the map
          }
          this._shade(mesh);
          this.scene.add(mesh);
          this.obstacles.push(mesh);
        }
      });
    }

    // Auto-compute solid collision boxes from the placed obstacles so the
    // player can't walk through props (and can climb them)
    this._buildObstacleBoxes(map, S);

    // Drifting clouds for open-sky maps
    if (map.clouds) {
      const cloudMat = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 });
      for (let i = 0; i < 6; i++) {
        const cloud = new THREE.Group();
        // Three overlapping puffs per cloud
        for (let p = 0; p < 3; p++) {
          const puff = new THREE.Mesh(new THREE.SphereGeometry(1.4 + Math.random(), 12, 12), cloudMat);
          puff.position.set(p * 1.6 - 1.6, Math.random() * 0.4, Math.random() * 0.8);
          puff.scale.y = 0.55;
          cloud.add(puff);
        }
        const spread = this.bound + 8;
        cloud.position.set(-spread + Math.random() * spread * 2, 14 + Math.random() * 6, -spread + Math.random() * spread * 2);
        cloud.userData.speed = 0.4 + Math.random() * 0.5;
        cloud.userData.wrap = spread;
        this.scene.add(cloud);
        this.clouds.push(cloud);
      }
    }

    // Distance fog — the far side of the stage melts into mist
    this.scene.fog = map.fog
      ? new THREE.Fog(map.fog.color, map.fog.near, map.fog.far)
      : null;

    // Star field: one Points cloud on a high shell around the stage,
    // unaffected by fog so the night sky stays crisp
    if (map.stars) {
      const starGeo = new THREE.BufferGeometry();
      const pos = new Float32Array(map.stars * 3);
      const R = this.bound * 2.2;
      for (let i = 0; i < map.stars; i++) {
        const a = Math.random() * Math.PI * 2;
        const el = 0.06 + Math.random() * Math.PI * 0.46; // elevation above horizon
        pos[i * 3] = Math.cos(a) * Math.cos(el) * R;
        pos[i * 3 + 1] = Math.sin(el) * R * 0.6 + 8;
        pos[i * 3 + 2] = Math.sin(a) * Math.cos(el) * R;
      }
      starGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const starMat = new THREE.PointsMaterial({
        color: 0xffffff, size: 1.5, sizeAttenuation: true,
        transparent: true, opacity: 0.9
      });
      starMat.fog = false;
      this.scene.add(new THREE.Points(starGeo, starMat));
    }

    // Neon comets streaking across the sky — they ride the cloud drift
    // system (move along +x, wrap at the stage edge)
    if (map.comets) {
      const NEON = [0x3aff8a, 0xff4ad8, 0x4ad8ff, 0xffe84a, 0xb04aff, 0xff7a4a];
      const spread = this.bound + 10;
      for (let i = 0; i < map.comets; i++) {
        const c = NEON[i % NEON.length];
        const comet = new THREE.Group();
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 8),
          new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 1 }));
        comet.add(head);
        // Tapering tail trailing behind the direction of travel (-x)
        const tail = new THREE.Mesh(new THREE.ConeGeometry(0.16, 2.4, 6),
          new THREE.MeshStandardMaterial({
            color: c, emissive: c, emissiveIntensity: 0.6,
            transparent: true, opacity: 0.55
          }));
        tail.rotation.z = Math.PI / 2; // cone apex points -x
        tail.position.x = -1.3;
        comet.add(tail);
        comet.position.set(
          -spread + Math.random() * spread * 2,
          8 + Math.random() * 14,
          -spread + Math.random() * spread * 2
        );
        comet.userData.speed = 3 + Math.random() * 5;
        comet.userData.wrap = spread;
        this.clouds.push(comet); // reuse the drift+wrap animation
        this.scene.add(comet);
      }
    }

    // Drifting spirits (krasue heads + sheet ghosts) haunting the air —
    // they also ride the cloud drift+wrap system
    if (map.spirits) {
      const spread = this.bound + 8;
      for (let i = 0; i < map.spirits; i++) {
        const ghost = (i % 2 === 0)
          ? this._makeKrasue({ x: 0, z: 0 })
          : this._makeSheetGhost({ x: 0, z: 0 });
        ghost.position.set(
          -spread + Math.random() * spread * 2,
          2.2 + Math.random() * 3.5,
          -spread + Math.random() * spread * 2);
        ghost.rotation.y = -Math.PI / 2; // face the drift direction
        ghost.userData.speed = 1.2 + Math.random() * 2.2;
        ghost.userData.wrap = spread;
        this.clouds.push(ghost);
        this.scene.add(ghost);
      }
    }

    // Flowing lava rivers ({x,z,w,len,ry}) and pools ({x,z,r}) — their
    // texture offsets scroll every frame in _animate so the lava moves
    this.lavaFlows = [];
    if (map.lava) {
      map.lava.forEach(Lv => {
        const tex = makeLavaTexture();
        const geo = Lv.r
          ? new THREE.CircleGeometry(Lv.r, 20)
          : new THREE.PlaneGeometry(Lv.w, Lv.len);
        if (Lv.r) tex.repeat.set(Lv.r / 3, Lv.r / 3);
        else tex.repeat.set(Lv.w / 5, Lv.len / 5);
        const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
          map: tex, emissive: 0xff5a00, emissiveIntensity: 0.5, emissiveMap: tex
        }));
        mesh.rotation.x = -Math.PI / 2;
        mesh.rotation.z = Lv.ry || 0;
        mesh.position.set(Lv.x * S, 0.06, Lv.z * S);
        this.scene.add(mesh);
        this.lavaFlows.push({ tex, speed: Lv.speed || 0.15 });
      });
    }

    // Rising bubble streams (underwater maps) — animated in _animate
    this.bubbles = null;
    if (map.bubbles) {
      this.bubbles = [];
      // Default: pale bubbles; maps can retint them (e.g. volcano embers)
      const bubbleMat = new THREE.MeshStandardMaterial({
        color: map.bubbleColor || 0xcdeef7, transparent: true,
        opacity: map.bubbleOpacity || 0.4,
        emissive: map.bubbleGlow || 0x8fd8ec,
        emissiveIntensity: map.bubbleGlow ? 0.8 : 0.3, depthWrite: false
      });
      for (let i = 0; i < map.bubbles; i++) {
        const size = 0.07 + Math.random() * 0.22;
        const b = new THREE.Mesh(new THREE.SphereGeometry(size, 8, 8), bubbleMat);
        b.position.set(
          -this.bound + Math.random() * this.bound * 2,
          Math.random() * 14,
          -this.bound + Math.random() * this.bound * 2
        );
        b.userData.speed = 1.4 + Math.random() * 2.6;
        b.userData.base = 0.2;
        b.userData.top = 15 + Math.random() * 10;
        b.userData.phase = Math.random() * Math.PI * 2;
        b.userData.noHit = true; // lasers/eyedropper ignore bubbles
        this.bubbles.push(b);
        this.scene.add(b);
      }
    }

    // Dense tall-grass tufts: two crossed textured quads per tuft, all drawn
    // as ONE InstancedMesh so even ~700 tufts cost a single draw call
    if (map.grassTufts) {
      const gmat = new THREE.MeshStandardMaterial({
        map: makeGrassBladeTexture(), alphaTest: 0.45, side: THREE.DoubleSide,
        color: map.grassTint || 0xffffff // tint shifts the blades (e.g. night teal)
      });
      const ggeo = new THREE.PlaneGeometry(2.4, 1.6);
      ggeo.translate(0, 0.8, 0); // pivot at the blade roots
      const tufts = map.grassTufts;
      const grass = new THREE.InstancedMesh(ggeo, gmat, tufts * 2);
      const m4 = new THREE.Matrix4(), eu = new THREE.Euler(),
            q = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3();
      const spawn = map.spawn || [0, 0, 8];
      let gi = 0;
      for (let i = 0; i < tufts; i++) {
        let x, z, tries = 0;
        do {
          x = -this.bound + 3 + Math.random() * (this.bound * 2 - 6);
          z = -this.bound + 3 + Math.random() * (this.bound * 2 - 6);
          tries++;
        } while (Math.hypot(x - spawn[0], z - spawn[2]) < 6 && tries < 12);
        const yaw = Math.random() * Math.PI;
        const s = 0.9 + Math.random() * 1.0;
        for (let k = 0; k < 2; k++) {
          q.setFromEuler(eu.set(0, yaw + k * Math.PI / 2, 0));
          sc.set(s, s * (0.8 + Math.random() * 0.5), s);
          m4.compose(p.set(x, 0, z), q, sc);
          grass.setMatrixAt(gi++, m4);
        }
      }
      grass.instanceMatrix.needsUpdate = true;
      grass.userData.noHit = true; // lasers + eyedropper pass through grass
      this.scene.add(grass);
    }

    // Dark conifer treeline ringing the stage — a forest wall that melts
    // into the fog. Two instanced meshes (foliage + trunks) = 2 draw calls.
    if (map.treeline) {
      const tl = map.treeline;
      const dunes = tl.style === 'dunes'; // sand domes instead of conifers
      const colors = tl.colors || [0x16391f, 0x1d4a28];
      const hMin = tl.hMin || 12, hMax = tl.hMax || 20;
      const spots = [];
      for (let ring = 0; ring < 2; ring++) {
        const e = this.bound + 5 + ring * (dunes ? 14 : 8);
        const step = (dunes ? 15 : 7) + ring * 2;
        for (let t = -e; t <= e; t += step) {
          const jit = () => (Math.random() - 0.5) * (dunes ? 10 : 5);
          spots.push([t + jit(), -e + jit()], [t + jit(), e + jit()],
                     [-e + jit(), t + jit()], [e + jit(), t + jit()]);
        }
      }
      const foliage = new THREE.InstancedMesh(
        dunes ? new THREE.SphereGeometry(1, 12, 8) : new THREE.ConeGeometry(1, 1, 7),
        new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: !dunes }),
        spots.length);
      const trunks = dunes ? null : new THREE.InstancedMesh(
        new THREE.CylinderGeometry(0.25, 0.35, 1, 5),
        new THREE.MeshStandardMaterial({ color: 0x3a2b1c }),
        spots.length);
      const tm = new THREE.Matrix4(), tq = new THREE.Quaternion(),
            tp = new THREE.Vector3(), ts = new THREE.Vector3();
      const col = new THREE.Color();
      spots.forEach(([x, z], i) => {
        const h = hMin + Math.random() * (hMax - hMin);
        if (dunes) {
          // Wide dome mostly buried in the ground = a rolling dune ridge
          const r = h * (1.6 + Math.random() * 0.9);
          tm.compose(tp.set(x, h * 0.25, z), tq, ts.set(r, h, r));
          foliage.setMatrixAt(i, tm);
        } else {
          const r = h * (0.22 + Math.random() * 0.08);
          tm.compose(tp.set(x, 1.2 + h / 2, z), tq, ts.set(r, h, r));
          foliage.setMatrixAt(i, tm);
          tm.compose(tp.set(x, 1, z), tq, ts.set(1, 2, 1));
          trunks.setMatrixAt(i, tm);
        }
        foliage.setColorAt(i, col.setHex(colors[i % colors.length]));
      });
      foliage.instanceMatrix.needsUpdate = true;
      if (foliage.instanceColor) foliage.instanceColor.needsUpdate = true;
      if (trunks) {
        trunks.instanceMatrix.needsUpdate = true;
        this.scene.add(trunks);
      }
      this.scene.add(foliage);
    }

    // Low sun + halo on the horizon (sunset maps); ignores fog so it glows
    if (map.sunGlow) {
      const mkDisc = (radius, opacity, color) => {
        const disc = new THREE.Mesh(
          new THREE.CircleGeometry(radius, 24),
          new THREE.MeshBasicMaterial({ color: color || map.sunGlow, fog: false, transparent: true, opacity })
        );
        disc.userData.noHit = true; // decorative sky — lasers pass through
        return disc;
      };
      const sunPos = new THREE.Vector3(-this.bound * 0.4, 30, -this.bound - 30);
      const core = mkDisc(13, 1, 0xfff4de);   // bright near-white core
      const disc = mkDisc(22, 0.85);          // warm glowing body
      const halo = mkDisc(48, 0.28);          // soft outer halo
      [halo, disc, core].forEach((m, i) => {
        m.position.copy(sunPos);
        m.position.z -= (2 - i) * 1.5;         // stack halo behind, core in front
        m.lookAt(0, 6, 0);
        this.scene.add(m);
      });
    }

    // Imported 3D models (.glb)
    this._loadModels(map);
  }

  // Load external .glb models, auto-scaled to a target height and placed on the ground
  _loadModels(map) {
    if (!map.models || typeof THREE.GLTFLoader === 'undefined') return;
    const S = this.mapScale || 1;
    const loader = new THREE.GLTFLoader();
    map.models.forEach(m => {
      loader.load(m.url, (gltf) => {
        const obj = gltf.scene;

        // Normalize height so any model fits the scene regardless of native units.
        // Static props (furniture, vehicles, statues) get a bigger boost so
        // they read as real cover; living animals keep the classic 1.5× so
        // they don't dwarf hiders (checked via the built-in animation).
        const box = new THREE.Box3().setFromObject(obj);
        const size = new THREE.Vector3();
        box.getSize(size);
        const isAnimated = !!(gltf.animations && gltf.animations.length && !m.noAnim);
        const heightMult = isAnimated ? 1.5 : 1.9;
        const targetH = (m.height || 2) * heightMult;
        const scale = size.y > 0 ? targetH / size.y : 1;
        obj.scale.setScalar(scale);
        obj.rotation.y = m.ry || 0;

        // Sit the model on the ground (optional extra lift via m.y, e.g. hovering birds)
        const box2 = new THREE.Box3().setFromObject(obj);
        obj.position.set(m.x * S, -box2.min.y + (m.y || 0), m.z * S);

        // Give every mesh a fixed bounding sphere + skip frustum culling.
        // Some animated GLB meshes (morph-target birds, skinned models) otherwise
        // trigger per-frame computeBoundingSphere() that logs NaN warnings.
        obj.traverse(c => {
          if (c.isMesh && c.geometry) {
            c.geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 50);
            c.frustumCulled = false;
          }
        });

        // Play the model's built-in animation if it has one (fox, birds, horse...)
        let animated = false;
        if (gltf.animations && gltf.animations.length && !m.noAnim) {
          const mixer = new THREE.AnimationMixer(obj);
          const action = mixer.clipAction(gltf.animations[0]);
          // Desync loops so identical models don't move in unison
          action.time = Math.random() * gltf.animations[0].duration;
          action.play();
          this.mixers.push(mixer);
          // Living target: laser hits on it trigger the "found!" siren
          this.animatedRoots.push(obj);
          animated = true;
        }

        // Static props (furniture, statues, vehicles) become solid so you
        // can't walk through them; living animals stay pass-through decoys.
        if (!animated && this.obstacleBoxes) {
          this._addCollisionBox(this._groundSliceBox(obj), obj);
        }

        this.scene.add(obj);
        if (this.renderer && this.camera) this.renderer.render(this.scene, this.camera);
      }, undefined, (err) => console.error('Model load failed:', m.url, err));
    });
  }

  // Beef up buildings / trees / boulders so the map feels more substantial.
  // Rocks, trees and buildings get a real growth spurt; huge landmarks
  // (mesas, the volcano cone, the barn/silo/dome) also grow, but modestly.
  _scaleStructure(o) {
    // Per-type multipliers. sx = width/radius, sy = height, sz = depth
    const SCALES = {
      building:  { sx: 1.15, sy: 1.4,  sz: 1.15 },  // city towers taller
      shop:      { sx: 1.15, sy: 1.3,  sz: 1.15 },  // storefronts a bit bigger
      minimart:  { sx: 1.2,  sy: 1.35, sz: 1.2  },
      barn:      { sx: 1.2,  sy: 1.35, sz: 1.2  },
      silo:      { sx: 1.2,  sy: 1.3,  sz: 1.2  },
      cabin:     { sx: 1.25, sy: 1.3,  sz: 1.25 },  // cabins were tiny
      adobe:     { sx: 1.2,  sy: 1.3,  sz: 1.2  },  // desert houses
      dome:      { sx: 1.2,  sy: 1.2,  sz: 1.2  },
      bigtree:   { sx: 1.25, sy: 1.4,  sz: 1.25 },  // canopies taller/wider
      snowpine:  { sx: 1.2,  sy: 1.35, sz: 1.2  },
      fruittree: { sx: 1.25, sy: 1.35, sz: 1.25 },
      cactus:    { sx: 1.2,  sy: 1.3,  sz: 1.2  },
      deadtree:  { sx: 1.2,  sy: 1.35, sz: 1.2  },
      rock:      { sx: 1.35, sy: 1.4,  sz: 1.35 },  // boulders noticeably bigger
      lavarock:  { sx: 1.35, sy: 1.4,  sz: 1.35 },
      rockspire: { sx: 1.25, sy: 1.35, sz: 1.25 },
      volcano:   { sx: 1.15, sy: 1.2,  sz: 1.15 },
      mesa:      { sx: 1.1,  sy: 1.15, sz: 1.1  },
      ruin:      { sx: 1.15, sy: 1.2,  sz: 1.15 }
    };
    const s = SCALES[o.type];
    if (!s) return o;
    const c = { ...o };
    if (c.w !== undefined) c.w *= s.sx;
    if (c.d !== undefined) c.d *= s.sz;
    if (c.h !== undefined) c.h *= s.sy;
    if (c.r !== undefined) {
      // Sphere-ish props: single radius scales all axes together (use sx)
      c.r *= s.sx;
      // Cones/cylinders/trees with a separate height already handled above
    }
    // Compound props with explicit collision widths (bookshelves etc.) also grow
    if (c.cw !== undefined) c.cw *= s.sx;
    if (c.cd !== undefined) c.cd *= s.sz;
    return c;
  }

  // Cheap image-based lighting probe built from the map's own sky and ground
  // colours, so each stage reflects its own surroundings.
  _applyEnvironment(map) {
    if (!this.renderer || typeof THREE.PMREMGenerator !== 'function') return;
    try {
      const cv = document.createElement('canvas');
      cv.width = 16; cv.height = 64;
      const ctx = cv.getContext('2d');
      // Damped well below the literal sky/ground colours. At full strength the
      // probe acts as a second full ambient light and pale stages (the
      // laundromat, the snowfield) climb straight back into glare.
      const sky = new THREE.Color(map.sky !== undefined ? map.sky : 0x88aacc).multiplyScalar(0.42);
      const grd = new THREE.Color(map.ground !== undefined ? map.ground : 0x777777).multiplyScalar(0.42);
      const g = ctx.createLinearGradient(0, 0, 0, 64);
      g.addColorStop(0, '#' + sky.getHexString());
      g.addColorStop(0.55, '#' + sky.clone().lerp(grd, 0.6).getHexString());
      g.addColorStop(1, '#' + grd.getHexString());
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 16, 64);
      const tex = new THREE.CanvasTexture(cv);
      tex.mapping = THREE.EquirectangularReflectionMapping;
      const pmrem = new THREE.PMREMGenerator(this.renderer);
      const rt = pmrem.fromEquirectangular(tex);
      this.scene.environment = rt.texture;
      this._envRT = rt;           // released in dispose(); phones can't leak these
      tex.dispose();
      pmrem.dispose();
    } catch (err) {
      console.warn('Environment probe skipped', err);   // never cost us the map
    }
  }

  // Give a prop (mesh or compound group) its shadow flags and surface finish.
  // Finishes apply even where shadows don't (phones), since they cost nothing.
  _shade(obj) {
    if (!obj) return obj;
    obj.traverse((m) => {
      if (!m.isMesh || !m.material) return;
      const mat = m.material;

      // Surface finish from the palette table. Skip anything a builder already
      // tuned by hand (the mirror glass, the washer drums) — those set
      // metalness deliberately and shouldn't be flattened back.
      if (mat.color && mat.metalness === 0 && mat.roughness === 1) {
        const f = FINISHES[mat.color.getHex()];
        if (f) { mat.metalness = f.metalness; mat.roughness = f.roughness; }
      }

      if (!this._shadows) return;
      // Emissive parts are skipped — a glowing candle or light panel casting a
      // hard shadow of itself reads as a bug rather than a light.
      const glows = mat.emissive &&
        (mat.emissiveIntensity || 0) > 0.5 &&
        (mat.emissive.r + mat.emissive.g + mat.emissive.b) > 0.6;

      // Only sizeable parts cast. Compound props are built from a dozen-plus
      // little meshes — knobs, coin slots, book spines — and every one of them
      // was being drawn again into the shadow map each frame. On a busy stage
      // that ran to thousands of extra draw calls and dropped the laundromat
      // under 2fps; their shadows are far too small to see anyway.
      let big = true;
      if (m.geometry) {
        if (!m.geometry.boundingSphere) {
          try { m.geometry.computeBoundingSphere(); } catch (e) {}
        }
        const bs = m.geometry.boundingSphere;
        if (bs) big = bs.radius * Math.max(m.scale.x, m.scale.y, m.scale.z) > 0.45;
      }
      m.castShadow = !glows && big;
      m.receiveShadow = true;
    });
    return obj;
  }

  // Build a single stage object from a config entry
  _makeObject(o) {
    // Beef up structures the player asked for: taller and wider buildings,
    // trees and boulders so maps feel more substantial. Multiply the
    // relevant dims at the entry point so every downstream builder — and
    // the auto-collision box that follows the mesh's bounds — sees the
    // enlarged size for free.
    o = this._scaleStructure(o);
    // Compound props are built from several meshes
    if (o.type === 'cactus') return this._makeCactus(o);
    if (o.type === 'adobe') return this._makeAdobe(o);
    if (o.type === 'desk') return this._makeDesk(o);
    if (o.type === 'bookshelf') return this._makeBookshelf(o);
    if (o.type === 'blackboard') return this._makeBlackboard(o);
    if (o.type === 'globe') return this._makeGlobe(o);
    if (o.type === 'bookstack') return this._makeBookstack(o);
    if (o.type === 'clock') return this._makeClock(o);
    if (o.type === 'poster') return this._makePoster(o);
    if (o.type === 'computer') return this._makeComputer(o);
    if (o.type === 'flag') return this._makeFlag(o);
    if (o.type === 'bigtree') return this._makeBigTree(o);
    if (o.type === 'ruin') return this._makeRuin(o);
    if (o.type === 'snowpine') return this._makeSnowPine(o);
    if (o.type === 'cabin') return this._makeCabin(o);
    if (o.type === 'twig') return this._makeTwig(o);
    if (o.type === 'building') return this._makeBuilding(o);
    if (o.type === 'shop') return this._makeShop(o);
    if (o.type === 'car') return this._makeCar(o);
    if (o.type === 'trashcan') return this._makeTrashcan(o);
    if (o.type === 'dome') return this._makeDome(o);
    if (o.type === 'coral') return this._makeCoral(o);
    if (o.type === 'kelp') return this._makeKelp(o);
    if (o.type === 'rockspire') return this._makeRockSpire(o);
    if (o.type === 'sub') return this._makeSub(o);
    if (o.type === 'barrel') return this._makeBarrel(o);
    if (o.type === 'jellyfish') return this._makeJellyfish(o);
    if (o.type === 'glowflower') return this._makeGlowFlower(o);
    if (o.type === 'tent') return this._makeTent(o);
    if (o.type === 'volcano') return this._makeVolcano(o);
    if (o.type === 'deadtree') return this._makeDeadTree(o);
    if (o.type === 'barn') return this._makeBarn(o);
    if (o.type === 'silo') return this._makeSilo(o);
    if (o.type === 'crop') return this._makeCrop(o);
    if (o.type === 'fence') return this._makeFence(o);
    if (o.type === 'scarecrow') return this._makeScarecrow(o);
    if (o.type === 'lamp') return this._makeLamp(o);
    if (o.type === 'fruittree') return this._makeFruitTree(o);
    if (o.type === 'stall') return this._makeStall(o);
    if (o.type === 'producebin') return this._makeProduceBin(o);
    if (o.type === 'table') return this._makeTable(o);
    if (o.type === 'minimart') return this._makeMinimart(o);
    if (o.type === 'krasue') return this._makeKrasue(o);
    if (o.type === 'sheetghost') return this._makeSheetGhost(o);
    if (o.type === 'ghostkid') return this._makeGhostKid(o);
    if (o.type === 'spiderghost') return this._makeSpiderGhost(o);
    if (o.type === 'painting') return this._makePainting(o);
    if (o.type === 'statue') return this._makeStatue(o);
    if (o.type === 'chandelier') return this._makeChandelier(o);
    if (o.type === 'vase') return this._makeVase(o);
    if (o.type === 'diningset') return this._makeDiningSet(o);
    if (o.type === 'column') return this._makeColumn(o);
    if (o.type === 'curtain') return this._makeCurtain(o);
    if (o.type === 'fireplace') return this._makeFireplace(o);
    if (o.type === 'mirror') return this._makeMirror(o);
    if (o.type === 'console') return this._makeConsole(o);
    if (o.type === 'velvetsofa') return this._makeVelvetSofa(o);
    if (o.type === 'balustrade') return this._makeBalustrade(o);
    if (o.type === 'grandpiano') return this._makeGrandPiano(o);
    if (o.type === 'ornatebed') return this._makeOrnateBed(o);
    if (o.type === 'archshelf') return this._makeArchShelf(o);
    if (o.type === 'pottedpalm') return this._makePottedPalm(o);
    if (o.type === 'sconce') return this._makeSconce(o);
    if (o.type === 'pagoda') return this._makePagoda(o);
    if (o.type === 'japanhouse') return this._makeJapanHouse(o);
    if (o.type === 'sakura') return this._makeSakura(o);
    if (o.type === 'torii') return this._makeTorii(o);
    if (o.type === 'stairs') return this._makeStairs(o);
    if (o.type === 'hanglantern') return this._makeHangLantern(o);
    if (o.type === 'washer') return this._makeWasher(o);
    if (o.type === 'foldtable') return this._makeFoldTable(o);
    if (o.type === 'laundrybasket') return this._makeLaundryBasket(o);
    if (o.type === 'detergentshelf') return this._makeDetergentShelf(o);
    let geo, baseY;
    switch (o.type) {
      case 'cylinder':
        geo = new THREE.CylinderGeometry(o.r, o.r, o.h, 16);
        baseY = o.h / 2;
        break;
      case 'cone':
        geo = new THREE.ConeGeometry(o.r, o.h, 16);
        baseY = o.h / 2;
        break;
      case 'sphere':
        geo = new THREE.SphereGeometry(o.r, 20, 20);
        baseY = o.r;
        break;
      case 'rock':
      case 'lavarock': {
        // Jittered dodecahedron ≈ natural boulder. The jitter is hashed from
        // the vertex position so duplicated verts move together (no cracks).
        geo = new THREE.DodecahedronGeometry(o.r, 1);
        const pos = geo.attributes.position;
        for (let i = 0; i < pos.count; i++) {
          const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
          const n = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453;
          const j = 1 + ((n - Math.floor(n)) - 0.5) * 0.4;
          pos.setXYZ(i, x * j, y * j, z * j);
        }
        geo.computeVertexNormals();
        // Sit low so boulders look bedded into the ground
        baseY = o.r * (o.sy || 1) * 0.6;
        break;
      }
      case 'mesa': {
        // Flat-topped butte. Radial jitter is hashed from x/z only, so rim
        // verts shift together into vertical canyon-style fluting.
        geo = new THREE.CylinderGeometry(o.r * 0.55, o.r, o.h, 9);
        const pos = geo.attributes.position;
        for (let i = 0; i < pos.count; i++) {
          const x = pos.getX(i), z = pos.getZ(i);
          const n = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453;
          const j = 1 + ((n - Math.floor(n)) - 0.5) * 0.3;
          pos.setX(i, x * j); pos.setZ(i, z * j);
        }
        geo.computeVertexNormals();
        baseY = o.h / 2;
        break;
      }
      case 'box':
      default:
        geo = new THREE.BoxGeometry(o.w, o.h, o.d);
        baseY = o.h / 2;
        break;
    }
    let mat;
    // Patterned surfaces (brick/wood/dots) give hiders details to imitate
    if (o.texture === 'brick') {
      mat = new THREE.MeshStandardMaterial({ map: makeBrickTexture() });
    } else if (o.texture === 'wood') {
      mat = new THREE.MeshStandardMaterial({ map: makeWoodTexture() });
    } else if (o.texture === 'dots') {
      mat = new THREE.MeshStandardMaterial({ map: makeDotsTexture() });
    } else if (o.type === 'lavarock') {
      // Dark volcanic stone shot through with glowing lava cracks
      const skins = makeLavaCrackTextures();
      mat = new THREE.MeshStandardMaterial({
        map: skins.map, emissive: 0xff7a30, emissiveIntensity: 0.9,
        emissiveMap: skins.emissiveMap, flatShading: true, roughness: 0.95
      });
    } else if (o.type === 'rock' || o.type === 'mesa') {
      mat = new THREE.MeshStandardMaterial({ color: o.color, flatShading: true, roughness: 0.95 });
    } else {
      mat = new THREE.MeshStandardMaterial({ color: o.color });
    }
    // Glowing props (lamps, lanterns, lit windows) for night stages
    if (o.emissive) {
      mat.emissive = new THREE.Color(o.emissive);
      mat.emissiveIntensity = o.emissiveIntensity || 0.9;
    }
    const mesh = new THREE.Mesh(geo, mat);
    // Optional o.y lifts the prop off the ground (hanging lanterns, signs)
    mesh.position.set(o.x, baseY + (o.y || 0), o.z);
    // Cones (trees) sway gently in the wind; random phase so they don't sync
    if (o.type === 'cone') {
      mesh.userData.sway = true;
      mesh.userData.swayPhase = Math.random() * Math.PI * 2;
    }
    // Rocks can be squashed for a low, bedded boulder profile
    if ((o.type === 'rock' || o.type === 'lavarock') && o.sy) mesh.scale.y = o.sy;
    return mesh;
  }

  // Saguaro cactus: trunk + raised side arms (each arm = elbow + riser)
  _makeCactus(o) {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: o.color });
    const r = o.r || 0.4, h = o.h || 4;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.15, h, 8), mat);
    trunk.position.y = h / 2;
    g.add(trunk);
    [-1, 1].forEach(side => {
      if (Math.random() < 0.25) return; // some cacti miss an arm
      const ah = h * (0.3 + Math.random() * 0.25);
      const ay = h * (0.35 + Math.random() * 0.25);
      const elbow = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.7, r * 0.7, r * 2.6, 8), mat);
      elbow.rotation.z = Math.PI / 2;
      elbow.position.set(side * r * 1.6, ay, 0);
      g.add(elbow);
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.65, r * 0.7, ah, 8), mat);
      arm.position.set(side * r * 2.7, ay + ah / 2, 0);
      g.add(arm);
    });
    g.position.set(o.x, o.y || 0, o.z);
    g.rotation.y = o.ry !== undefined ? o.ry : Math.random() * Math.PI * 2;
    return g;
  }

  // Flat-roofed adobe house: plastered box, roof parapet, dark doorway + windows
  _makeAdobe(o) {
    const g = new THREE.Group();
    const w = o.w || 4, h = o.h || 3, d = o.d || 4;
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshStandardMaterial({ map: makeAdobeTexture(o.color) })
    );
    body.position.y = h / 2;
    g.add(body);
    const rim = new THREE.Mesh(
      new THREE.BoxGeometry(w + 0.3, 0.35, d + 0.3),
      new THREE.MeshStandardMaterial({ color: 0xb99a6d })
    );
    rim.position.y = h + 0.05;
    g.add(rim);
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x40301f });
    const door = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(1.2, w * 0.3), h * 0.55), darkMat);
    door.position.set(0, h * 0.275, d / 2 + 0.02);
    g.add(door);
    [-1, 1].forEach(side => {
      const win = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.55), darkMat);
      win.position.set(side * w * 0.3, h * 0.62, d / 2 + 0.02);
      g.add(win);
    });
    g.position.set(o.x, o.y || 0, o.z);
    g.rotation.y = o.ry !== undefined ? o.ry : Math.random() * Math.PI * 2;
    return g;
  }

  // Student desk: wooden slanted top on legs + an attached blue bench seat.
  // teacher:true makes a wider desk with a green modesty panel at the front.
  _makeDesk(o) {
    const g = new THREE.Group();
    const w = o.w || 2.4, teacher = o.teacher;
    const wood = new THREE.MeshStandardMaterial({ map: makeWoodTexture() });
    const legMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2f });
    const d = teacher ? 1.6 : 1.3, topY = teacher ? 1.55 : 1.25;
    // Tabletop
    const top = new THREE.Mesh(new THREE.BoxGeometry(w, 0.16, d), wood);
    top.position.y = topY;
    g.add(top);
    // Legs
    const legGeo = new THREE.BoxGeometry(0.16, topY, 0.16);
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
      const leg = new THREE.Mesh(legGeo, legMat);
      leg.position.set(sx * (w / 2 - 0.2), topY / 2, sz * (d / 2 - 0.2));
      g.add(leg);
    });
    if (teacher) {
      // Front panel + a couple of books on top
      const panel = new THREE.Mesh(new THREE.BoxGeometry(w, topY - 0.2, 0.12),
        new THREE.MeshStandardMaterial({ color: 0x2f6e4f }));
      panel.position.set(0, (topY - 0.2) / 2, -d / 2 + 0.1);
      g.add(panel);
    } else {
      // Blue cushioned bench in front of the desk
      const seatMat = new THREE.MeshStandardMaterial({ color: 0x3f7fd0 });
      const seat = new THREE.Mesh(new THREE.BoxGeometry(w * 0.85, 0.18, 0.7), seatMat);
      seat.position.set(0, 0.75, d / 2 + 0.7);
      g.add(seat);
      const back = new THREE.Mesh(new THREE.BoxGeometry(w * 0.85, 0.6, 0.14), seatMat);
      back.position.set(0, 1.05, d / 2 + 1.02);
      g.add(back);
      const benchLeg = new THREE.BoxGeometry(0.12, 0.75, 0.12);
      [[-1], [1]].forEach(([sx]) => {
        const bl = new THREE.Mesh(benchLeg, legMat);
        bl.position.set(sx * (w * 0.4), 0.375, d / 2 + 0.7);
        g.add(bl);
      });
      // A notebook + pencil on the desk
      const book = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.06, 0.5),
        new THREE.MeshStandardMaterial({ color: makeBookSpineColor() }));
      book.position.set(-w * 0.15, topY + 0.11, 0);
      book.rotation.y = 0.2;
      g.add(book);
    }
    g.position.set(o.x, o.y || 0, o.z);
    g.rotation.y = o.ry !== undefined ? o.ry : 0;
    return g;
  }

  // Wall bookshelf packed with colorful book spines across several shelves
  _makeBookshelf(o) {
    const g = new THREE.Group();
    const w = o.w || 3, h = o.h || 4, d = o.d || 0.7;
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x7a5230 });
    const backMat = new THREE.MeshStandardMaterial({ color: 0x5a3c22 });
    // Carcass
    const back = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.1), backMat);
    back.position.set(0, h / 2, -d / 2);
    g.add(back);
    [[-1], [1]].forEach(([s]) => {
      const side = new THREE.Mesh(new THREE.BoxGeometry(0.12, h, d), frameMat);
      side.position.set(s * (w / 2 - 0.06), h / 2, 0);
      g.add(side);
    });
    const shelves = Math.max(2, Math.round(h / 1.1));
    for (let i = 0; i <= shelves; i++) {
      const sy = (h / shelves) * i;
      const board = new THREE.Mesh(new THREE.BoxGeometry(w, 0.1, d), frameMat);
      board.position.set(0, Math.min(sy, h), 0);
      g.add(board);
      // Books standing on this shelf (skip the very top board)
      if (i < shelves) {
        let bx = -w / 2 + 0.25;
        while (bx < w / 2 - 0.25) {
          const bw = 0.12 + Math.random() * 0.16;
          const bh = (h / shelves) * (0.55 + Math.random() * 0.32);
          const book = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, d * 0.7),
            new THREE.MeshStandardMaterial({ color: makeBookSpineColor() }));
          book.position.set(bx + bw / 2, sy + bh / 2 + 0.05, 0);
          g.add(book);
          bx += bw + 0.02;
        }
      }
    }
    g.position.set(o.x, o.y || 0, o.z);
    g.rotation.y = o.ry || 0;
    return g;
  }

  // Framed chalkboard with a message (e.g. "1+1 = ?") + a chalk tray
  _makeBlackboard(o) {
    const g = new THREE.Group();
    const w = o.w || 12, h = o.h || 5;
    const frame = new THREE.Mesh(new THREE.BoxGeometry(w + 0.5, h + 0.5, 0.3),
      new THREE.MeshStandardMaterial({ color: 0x6b4a2f }));
    g.add(frame);
    const board = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
      new THREE.MeshStandardMaterial({ map: makeChalkTexture(o.text) }));
    board.position.z = 0.17;
    g.add(board);
    const tray = new THREE.Mesh(new THREE.BoxGeometry(w + 0.5, 0.2, 0.4),
      new THREE.MeshStandardMaterial({ color: 0x5a3c22 }));
    tray.position.set(0, -h / 2 - 0.35, 0.25);
    g.add(tray);
    g.position.set(o.x, o.y || 3, o.z);
    g.rotation.y = o.ry || 0;
    return g;
  }

  // Classroom globe: tilted blue-green sphere on a little stand
  _makeGlobe(o) {
    const g = new THREE.Group();
    const r = o.r || 0.5;
    const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.12, r * 1.2, 8),
      new THREE.MeshStandardMaterial({ color: 0x333333 }));
    stand.position.y = r * 0.6;
    g.add(stand);
    const globe = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 16),
      new THREE.MeshStandardMaterial({ color: 0x2f7fb5 }));
    globe.position.y = r * 1.5;
    globe.rotation.z = 0.4;
    g.add(globe);
    // A couple of green "continents"
    for (let i = 0; i < 4; i++) {
      const land = new THREE.Mesh(new THREE.SphereGeometry(r * (0.28 + Math.random() * 0.14), 8, 8),
        new THREE.MeshStandardMaterial({ color: 0x4faa5b }));
      const a = Math.random() * Math.PI * 2, b = Math.random() * Math.PI;
      land.position.set(
        Math.sin(b) * Math.cos(a) * r, r * 1.5 + Math.cos(b) * r, Math.sin(b) * Math.sin(a) * r);
      land.scale.z = 0.3;
      g.add(land);
    }
    g.position.set(o.x, o.y || 0, o.z);
    return g;
  }

  // A small stack of colorful books lying flat
  _makeBookstack(o) {
    const g = new THREE.Group();
    const n = 2 + Math.floor(Math.random() * 3);
    let y = 0;
    for (let i = 0; i < n; i++) {
      const bw = 0.8 + Math.random() * 0.4, bd = 0.6 + Math.random() * 0.3, bh = 0.14;
      const book = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd),
        new THREE.MeshStandardMaterial({ color: o.color || makeBookSpineColor() }));
      book.position.set((Math.random() - 0.5) * 0.2, y + bh / 2, (Math.random() - 0.5) * 0.2);
      book.rotation.y = (Math.random() - 0.5) * 0.5;
      g.add(book);
      y += bh;
    }
    g.position.set(o.x, o.y || 0, o.z);
    return g;
  }

  // Round wall clock
  _makeClock(o) {
    const g = new THREE.Group();
    const r = o.r || 0.7;
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.12, 20),
      new THREE.MeshStandardMaterial({ color: 0x222222 }));
    rim.rotation.x = Math.PI / 2;
    g.add(rim);
    const face = new THREE.Mesh(new THREE.CircleGeometry(r * 0.85, 20),
      new THREE.MeshStandardMaterial({ color: 0xffffff }));
    face.position.z = 0.07;
    g.add(face);
    const handMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
    const hh = new THREE.Mesh(new THREE.BoxGeometry(0.06, r * 0.5, 0.02), handMat);
    hh.position.set(0, r * 0.22, 0.09);
    g.add(hh);
    const mh = new THREE.Mesh(new THREE.BoxGeometry(0.04, r * 0.7, 0.02), handMat);
    mh.position.set(r * 0.18, 0, 0.09); mh.rotation.z = Math.PI / 2 + 0.4;
    g.add(mh);
    g.position.set(o.x, o.y || 6, o.z);
    g.rotation.y = o.ry || 0;
    return g;
  }

  // Educational wall poster (colored panel with a few simple "chart" bars)
  _makePoster(o) {
    const g = new THREE.Group();
    const w = o.w || 2, h = o.h || 2.6;
    const paper = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
      new THREE.MeshStandardMaterial({ color: o.color || 0xfdf6e3 }));
    g.add(paper);
    // A few colored rows to suggest text/diagrams
    for (let i = 0; i < 4; i++) {
      const bar = new THREE.Mesh(new THREE.PlaneGeometry(w * (0.4 + Math.random() * 0.4), 0.12),
        new THREE.MeshStandardMaterial({ color: makeBookSpineColor() }));
      bar.position.set(0, h / 2 - 0.4 - i * 0.5, 0.01);
      g.add(bar);
    }
    g.position.set(o.x, o.y || 5, o.z);
    g.rotation.y = o.ry || 0;
    return g;
  }

  // Desktop computer: a glowing monitor on a stand + a keyboard. Screen faces
  // +z, the same side as a desk's bench, so a computer and desk sharing one ry
  // always put the monitor in front of the seated student (the computer lab).
  _makeComputer(o) {
    const g = new THREE.Group();
    const s = o.s || 1;
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x2b2f36 });
    const screenMat = new THREE.MeshStandardMaterial({
      color: 0x9ad3ff, emissive: 0x2e74a8, emissiveIntensity: 0.7
    });
    const bezel = new THREE.Mesh(new THREE.BoxGeometry(0.92 * s, 0.6 * s, 0.06 * s), bodyMat);
    bezel.position.set(0, 0.58 * s, 0);
    g.add(bezel);
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.78 * s, 0.46 * s), screenMat);
    screen.position.set(0, 0.58 * s, 0.035 * s);
    g.add(screen);
    const neck = new THREE.Mesh(new THREE.BoxGeometry(0.08 * s, 0.22 * s, 0.08 * s), bodyMat);
    neck.position.set(0, 0.32 * s, 0);
    g.add(neck);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.42 * s, 0.05 * s, 0.3 * s), bodyMat);
    foot.position.set(0, 0.2 * s, 0);
    g.add(foot);
    const kb = new THREE.Mesh(new THREE.BoxGeometry(0.72 * s, 0.05 * s, 0.26 * s),
      new THREE.MeshStandardMaterial({ color: 0xd8dde3 }));
    kb.position.set(0, 0.2 * s, 0.34 * s);
    g.add(kb);
    g.position.set(o.x, o.y || 0, o.z);
    g.rotation.y = o.ry || 0;
    return g;
  }

  // Small standing flag on a metal pole (the language / computer-lab rooms line
  // their walls with them). Optional color2 adds a lower stripe.
  _makeFlag(o) {
    const g = new THREE.Group();
    const h = o.h || 3;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, h, 8),
      new THREE.MeshStandardMaterial({ color: 0xb8bcc4, metalness: 0.4, roughness: 0.5 }));
    pole.position.y = h / 2;
    g.add(pole);
    const cloth = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.72, 0.04),
      new THREE.MeshStandardMaterial({ color: o.color || 0xd23b3b, side: THREE.DoubleSide }));
    cloth.position.set(0.62, h - 0.5, 0);
    g.add(cloth);
    if (o.color2 !== undefined) {
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.24, 0.05),
        new THREE.MeshStandardMaterial({ color: o.color2 }));
      stripe.position.set(0.62, h - 0.74, 0.002);
      g.add(stripe);
    }
    const finial = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0xf1c40f }));
    finial.position.y = h;
    g.add(finial);
    g.position.set(o.x, o.y || 0, o.z);
    g.rotation.y = o.ry || 0;
    return g;
  }

  // Towering forest tree: tapered mossy trunk, root flare, a broad canopy
  // high overhead, and a few vines dangling from the canopy edge
  _makeBigTree(o) {
    const g = new THREE.Group();
    const r = o.r || 1.2, h = o.h || 22;
    const barkMat = new THREE.MeshStandardMaterial({ color: o.color || 0x6b4a2f });
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.7, r, h, 9), barkMat);
    trunk.position.y = h / 2;
    g.add(trunk);
    // Root flare + a mossy skirt at the base
    const flare = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.05, r * 1.7, h * 0.08, 9), barkMat);
    flare.position.y = h * 0.04;
    g.add(flare);
    const moss = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.02, r * 1.35, h * 0.1, 9),
      new THREE.MeshStandardMaterial({ color: 0x3e6b3a }));
    moss.position.y = h * 0.11;
    g.add(moss);
    // Canopy: overlapping dark-green blobs at the top
    const canopyMat = new THREE.MeshStandardMaterial({ color: 0x1e4d2c });
    const spread = r * 4 + 2;
    for (let i = 0; i < 3; i++) {
      const cr = spread * (0.7 + Math.random() * 0.5);
      const blob = new THREE.Mesh(new THREE.SphereGeometry(cr, 10, 8), canopyMat);
      blob.position.set((Math.random() - 0.5) * spread, h * (0.92 + Math.random() * 0.12), (Math.random() - 0.5) * spread);
      blob.scale.y = 0.55;
      g.add(blob);
    }
    // Hanging vines
    const vineMat = new THREE.MeshStandardMaterial({ color: 0x4a7a42 });
    const vines = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < vines; i++) {
      const vl = 3 + Math.random() * (h * 0.35);
      const vine = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, vl, 5), vineMat);
      const a = Math.random() * Math.PI * 2;
      vine.position.set(Math.cos(a) * spread * 0.7, h * 0.9 - vl / 2, Math.sin(a) * spread * 0.7);
      g.add(vine);
    }
    g.position.set(o.x, o.y || 0, o.z);
    g.rotation.y = o.ry !== undefined ? o.ry : Math.random() * Math.PI * 2;
    return g;
  }

  // Ancient mossy stone ruin: stepped stack of weathered blocks, each capped
  // with a thin moss layer. big:true builds a taller multi-tier ruin.
  _makeRuin(o) {
    const g = new THREE.Group();
    const stoneMat = new THREE.MeshStandardMaterial({ color: o.color || 0x77816f, flatShading: true });
    const mossMat = new THREE.MeshStandardMaterial({ color: 0x3e6b3a });
    const tiers = o.big ? 3 : 1 + Math.floor(Math.random() * 2);
    let y = 0;
    let w = o.big ? 5.5 : 2.4 + Math.random() * 1.4;
    let d = o.big ? 4.5 : 2 + Math.random() * 1.2;
    for (let t = 0; t < tiers; t++) {
      const bh = o.big ? 1.4 : 0.8 + Math.random() * 0.5;
      const block = new THREE.Mesh(new THREE.BoxGeometry(w, bh, d), stoneMat);
      block.position.set((Math.random() - 0.5) * 0.4, y + bh / 2, (Math.random() - 0.5) * 0.4);
      block.rotation.y = (Math.random() - 0.5) * 0.15;
      g.add(block);
      const cap = new THREE.Mesh(new THREE.BoxGeometry(w * 0.92, 0.08, d * 0.92), mossMat);
      cap.position.set(block.position.x, y + bh + 0.04, block.position.z);
      cap.rotation.y = block.rotation.y;
      g.add(cap);
      y += bh;
      w *= 0.72; d *= 0.72;
    }
    g.position.set(o.x, o.y || 0, o.z);
    g.rotation.y = o.ry !== undefined ? o.ry : Math.random() * Math.PI * 2;
    return g;
  }

  // Towering winter pine: tall bare trunk, stacked foliage tiers up high,
  // each tier dusted with a white snow cap
  _makeSnowPine(o) {
    const g = new THREE.Group();
    const r = o.r || 1.6, h = o.h || 10;
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(r * 0.28, r * 0.45, h, 8),
      new THREE.MeshStandardMaterial({ color: 0x4a3527 })
    );
    trunk.position.y = h / 2;
    g.add(trunk);
    const foliageMat = new THREE.MeshStandardMaterial({ color: o.color || 0x2a4a3c });
    const snowMat = new THREE.MeshStandardMaterial({ color: 0xf4f8fc });
    // Three tiers, shrinking toward the top, starting halfway up the trunk
    for (let t = 0; t < 3; t++) {
      const ty = h * (0.45 + t * 0.2);
      const tr = r * (1.6 - t * 0.4);
      const th = h * 0.3;
      const tier = new THREE.Mesh(new THREE.ConeGeometry(tr, th, 9), foliageMat);
      tier.position.y = ty + th / 2;
      g.add(tier);
      const cap = new THREE.Mesh(new THREE.ConeGeometry(tr * 0.75, th * 0.45, 9), snowMat);
      cap.position.y = ty + th * 0.72;
      g.add(cap);
    }
    // Snow mound around the base
    const mound = new THREE.Mesh(new THREE.SphereGeometry(r * 1.1, 8, 6), snowMat);
    mound.position.y = 0.1;
    mound.scale.y = 0.25;
    g.add(mound);
    g.position.set(o.x, o.y || 0, o.z);
    g.rotation.y = o.ry !== undefined ? o.ry : Math.random() * Math.PI * 2;
    return g;
  }

  // Weathered wooden cabin with a steep gabled roof and a snowy ridge
  _makeCabin(o) {
    const g = new THREE.Group();
    const w = o.w || 5, h = o.h || 3, d = o.d || 4.5;
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshStandardMaterial({ map: makeWoodTexture('#9a8a76', '#6e5f4e') })
    );
    body.position.y = h / 2;
    g.add(body);
    // Gabled roof: a 3-sided prism laid along the depth axis.
    // thetaStart=PI puts one prism vertex at the top after the X-rotation,
    // giving an upright gable with a flat bottom resting on the walls.
    const rw = w * 0.72;
    const roof = new THREE.Mesh(
      new THREE.CylinderGeometry(rw, rw, d + 0.7, 3, 1, false, Math.PI),
      new THREE.MeshStandardMaterial({ color: 0x5e5348, flatShading: true })
    );
    roof.rotation.x = Math.PI / 2;
    roof.position.y = h + rw * 0.45;
    g.add(roof);
    // Snow along the ridge (apex sits one radius above the roof centre).
    // bare:true skips the wintry dressing (haunted/abandoned cabins).
    if (!o.bare) {
      const ridge = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 0.22, d + 0.8),
        new THREE.MeshStandardMaterial({ color: 0xf4f8fc })
      );
      ridge.position.y = h + rw * 1.42;
      g.add(ridge);
    }
    // Dark door + window on the front face
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x2e2419 });
    const door = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(1.3, w * 0.28), h * 0.6), darkMat);
    door.position.set(-w * 0.18, h * 0.3, d / 2 + 0.02);
    g.add(door);
    const win = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.8), darkMat);
    win.position.set(w * 0.22, h * 0.6, d / 2 + 0.02);
    g.add(win);
    // Snowdrift piled against one wall
    if (!o.bare) {
      const drift = new THREE.Mesh(new THREE.SphereGeometry(w * 0.45, 8, 6),
        new THREE.MeshStandardMaterial({ color: 0xf4f8fc }));
      drift.position.set(w / 2, 0.1, 0);
      drift.scale.set(0.6, 0.3, 1);
      g.add(drift);
    }
    g.position.set(o.x, o.y || 0, o.z);
    g.rotation.y = o.ry !== undefined ? o.ry : Math.random() * Math.PI * 2;
    return g;
  }

  // Bare twig bush: thin branches fanning out of the snow
  _makeTwig(o) {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: o.color || 0x6b4a2f });
    const n = 5 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      const len = 0.8 + Math.random() * 0.9;
      const twig = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.045, len, 5), mat);
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.5;
      const tilt = 0.25 + Math.random() * 0.5;
      twig.position.set(Math.cos(a) * len * 0.28, len * 0.42, Math.sin(a) * len * 0.28);
      twig.rotation.set(Math.sin(a) * tilt, 0, -Math.cos(a) * tilt);
      g.add(twig);
    }
    g.position.set(o.x, o.y || 0, o.z);
    return g;
  }

  // Downtown tower: window-grid facade, dark roof slab with an AC unit,
  // and an optional rooftop text sign (o.sign / o.signColor)
  _makeBuilding(o) {
    const g = new THREE.Group();
    const w = o.w || 5, h = o.h || 12, d = o.d || 5;
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshStandardMaterial({ map: makeBuildingTexture(o.color) })
    );
    body.position.y = h / 2;
    g.add(body);
    // Roof slab + AC unit
    const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 0.3, 0.3, d + 0.3),
      new THREE.MeshStandardMaterial({ color: 0x3a3a40 }));
    roof.position.y = h + 0.15;
    g.add(roof);
    const ac = new THREE.Mesh(new THREE.BoxGeometry(w * 0.25, 0.7, d * 0.25),
      new THREE.MeshStandardMaterial({ color: 0x8a8a90 }));
    ac.position.set(w * 0.22, h + 0.65, -d * 0.2);
    g.add(ac);
    // Rooftop sign like the reference's big red letters
    if (o.sign) {
      const board = new THREE.Mesh(new THREE.BoxGeometry(w * 0.9, 1.5, 0.25),
        new THREE.MeshStandardMaterial({ color: 0x2c2c30 }));
      board.position.set(0, h + 1.15, d / 2 - 0.3);
      g.add(board);
      const face = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.86, 1.36),
        new THREE.MeshStandardMaterial({
          map: makeSignTexture(o.sign, o.signColor),
          emissive: o.signColor || 0xd63a3a, emissiveIntensity: 0.35
        }));
      face.position.set(0, h + 1.15, d / 2 - 0.16);
      g.add(face);
    }
    g.position.set(o.x, o.y || 0, o.z);
    g.rotation.y = o.ry !== undefined ? o.ry : 0;
    return g;
  }

  // Storefront: low building, big display window, striped awning + sign
  _makeShop(o) {
    const g = new THREE.Group();
    const w = o.w || 4.5, h = o.h || 3, d = o.d || 3.5;
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d),
      new THREE.MeshStandardMaterial({ color: o.color || 0xe8ddc8 }));
    body.position.y = h / 2;
    g.add(body);
    // Display window + door
    const winMat = new THREE.MeshStandardMaterial({ color: 0x2c3e50 });
    const win = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.5, h * 0.42), winMat);
    win.position.set(-w * 0.16, h * 0.42, d / 2 + 0.02);
    g.add(win);
    const door = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.2, h * 0.55), winMat);
    door.position.set(w * 0.3, h * 0.28, d / 2 + 0.02);
    g.add(door);
    // Striped awning tilted over the window
    const aw = document.createElement('canvas');
    aw.width = 64; aw.height = 16;
    const actx = aw.getContext('2d');
    for (let i = 0; i < 8; i++) {
      actx.fillStyle = i % 2 ? '#ffffff' : '#d0483a';
      actx.fillRect(i * 8, 0, 8, 16);
    }
    const awTex = new THREE.CanvasTexture(aw);
    const awning = new THREE.Mesh(new THREE.BoxGeometry(w * 0.7, 0.08, 1.1),
      new THREE.MeshStandardMaterial({ map: awTex }));
    awning.position.set(-w * 0.12, h * 0.72, d / 2 + 0.5);
    awning.rotation.x = 0.35;
    g.add(awning);
    // Sign board above
    const face = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.8, 0.9),
      new THREE.MeshStandardMaterial({
        map: makeSignTexture(o.sign || 'SHOP', o.signColor || 0x3a6ad0),
        emissive: 0x333333, emissiveIntensity: 0.25
      }));
    face.position.set(0, h * 0.93, d / 2 + 0.03);
    g.add(face);
    g.position.set(o.x, o.y || 0, o.z);
    g.rotation.y = o.ry !== undefined ? o.ry : Math.random() * Math.PI * 2;
    return g;
  }

  // Parked car: body + cabin + four wheels, random cheerful paint
  _makeCar(o) {
    const g = new THREE.Group();
    const paint = new THREE.MeshStandardMaterial({ color: o.color || 0xd04a3a });
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.55, 1.2), paint);
    body.position.y = 0.55;
    g.add(body);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.5, 1.05),
      new THREE.MeshStandardMaterial({ color: 0x223244 }));
    cabin.position.set(-0.15, 1.05, 0);
    g.add(cabin);
    const wheelGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.2, 10);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1e });
    [[-0.8, -0.62], [0.8, -0.62], [-0.8, 0.62], [0.8, 0.62]].forEach(([wx, wz]) => {
      const wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.rotation.x = Math.PI / 2;
      wheel.position.set(wx, 0.28, wz);
      g.add(wheel);
    });
    g.position.set(o.x, o.y || 0, o.z);
    g.rotation.y = o.ry !== undefined ? o.ry : Math.random() * Math.PI * 2;
    return g;
  }

  // Street trash: a bin with a lid and garbage bags slumped beside it
  _makeTrashcan(o) {
    const g = new THREE.Group();
    const binMat = new THREE.MeshStandardMaterial({ color: o.color || 0x4a5a4a });
    const bin = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.36, 1, 10), binMat);
    bin.position.y = 0.5;
    g.add(bin);
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.1, 10), binMat);
    lid.position.y = 1.05;
    lid.rotation.z = (Math.random() - 0.5) * 0.35; // askew lid
    g.add(lid);
    // Garbage bags slumped around the bin
    const bagMat = new THREE.MeshStandardMaterial({ color: 0x26262c });
    const bags = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < bags; i++) {
      const br = 0.28 + Math.random() * 0.2;
      const bag = new THREE.Mesh(new THREE.SphereGeometry(br, 8, 6), bagMat);
      const a = Math.random() * Math.PI * 2;
      bag.position.set(Math.cos(a) * 0.75, br * 0.7, Math.sin(a) * 0.75);
      bag.scale.y = 0.75;
      g.add(bag);
    }
    g.position.set(o.x, o.y || 0, o.z);
    return g;
  }

  // Underwater habitat: metal base ring with glowing windows, a translucent
  // glass dome on top and a beacon light — the Aquatico colony building
  _makeDome(o) {
    const g = new THREE.Group();
    const r = o.r || 3;
    const baseH = r * 0.55;
    const base = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.12, baseH, 18),
      new THREE.MeshStandardMaterial({ color: o.color || 0x3a6a80 }));
    base.position.y = baseH / 2;
    g.add(base);
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.04, r * 1.04, baseH * 0.22, 18),
      new THREE.MeshStandardMaterial({ color: 0x1e3742 }));
    rim.position.y = baseH;
    g.add(rim);
    // Glowing windows around the base
    const winMat = new THREE.MeshStandardMaterial({ color: 0x9ff0f8, emissive: 0x4fd0e0, emissiveIntensity: 0.7 });
    const wins = Math.max(6, Math.round(r * 2.5));
    for (let i = 0; i < wins; i++) {
      const a = (i / wins) * Math.PI * 2;
      const win = new THREE.Mesh(new THREE.PlaneGeometry(r * 0.26, baseH * 0.5), winMat);
      win.position.set(Math.cos(a) * r * 1.05, baseH * 0.55, Math.sin(a) * r * 1.05);
      win.rotation.y = Math.PI / 2 - a;
      g.add(win);
    }
    // Translucent glass dome
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(r, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0x5fd6e8, transparent: true, opacity: 0.5,
        emissive: 0x2aa0c0, emissiveIntensity: 0.4, side: THREE.DoubleSide })
    );
    dome.position.y = baseH;
    g.add(dome);
    // Beacon light on top
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(r * 0.13, 10, 10),
      new THREE.MeshStandardMaterial({ color: 0xffe27a, emissive: 0xffca40, emissiveIntensity: 1 }));
    beacon.position.y = baseH + r + 0.15;
    g.add(beacon);
    g.position.set(o.x, o.y || 0, o.z);
    g.rotation.y = o.ry || 0;
    return g;
  }

  // Branching coral in a bright reef color, with glowing polyp tips
  _makeCoral(o) {
    const g = new THREE.Group();
    const col = o.color || 0xe57373;
    const mat = new THREE.MeshStandardMaterial({ color: col });
    const tipMat = new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.35 });
    const n = 4 + Math.floor(Math.random() * 4);
    for (let i = 0; i < n; i++) {
      const h = 1 + Math.random() * 2.2;
      const a = Math.random() * Math.PI * 2;
      const lean = 0.2 + Math.random() * 0.45;
      const branch = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.17, h, 6), mat);
      const px = Math.cos(a) * 0.3, pz = Math.sin(a) * 0.3;
      branch.position.set(px, h / 2, pz);
      branch.rotation.set(Math.sin(a) * lean, 0, -Math.cos(a) * lean);
      g.add(branch);
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 8), tipMat);
      tip.position.set(px + Math.sin(a) * lean * h * 0.4, h, pz);
      g.add(tip);
    }
    // A rounded brain-coral base
    const base = new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 8), mat);
    base.position.y = 0.2; base.scale.y = 0.5;
    g.add(base);
    g.position.set(o.x, o.y || 0, o.z);
    g.rotation.y = o.ry || 0;
    return g;
  }

  // Tall kelp: a few wavy strands with leaf blades; sways from its base
  _makeKelp(o) {
    const g = new THREE.Group();
    const col = o.color || 0x2f8f5f;
    const mat = new THREE.MeshStandardMaterial({ color: col });
    const n = 3 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      const h = 3 + Math.random() * 4;
      const strand = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.11, h, 5), mat);
      const px = (Math.random() - 0.5) * 0.7, pz = (Math.random() - 0.5) * 0.7;
      strand.position.set(px, h / 2, pz);
      g.add(strand);
      // A couple of leaf blades up the strand
      for (let k = 0; k < 3; k++) {
        const leaf = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.9),
          new THREE.MeshStandardMaterial({ color: col, side: THREE.DoubleSide }));
        leaf.position.set(px, h * (0.3 + k * 0.22), pz);
        leaf.rotation.y = Math.random() * Math.PI;
        leaf.rotation.z = 0.5;
        g.add(leaf);
      }
    }
    g.userData.sway = true;
    g.userData.swayPhase = Math.random() * Math.PI * 2;
    g.userData.swayAmp = 0.12; // stronger than trees — kelp drifts in the current
    g.position.set(o.x, o.y || 0, o.z);
    return g;
  }

  // Tall layered rock spire (the reference's seabed rock columns)
  _makeRockSpire(o) {
    const g = new THREE.Group();
    const r = o.r || (1.6 + Math.random() * 0.8);
    const h = o.h || (10 + Math.random() * 6);
    const mat = new THREE.MeshStandardMaterial({ color: o.color || 0x5a6b6e, flatShading: true, roughness: 1 });
    const layers = 4;
    let y = 0;
    for (let i = 0; i < layers; i++) {
      const lr = r * (1 - i * 0.16) * (0.85 + Math.random() * 0.3);
      const lh = h / layers;
      const geo = new THREE.CylinderGeometry(lr * 0.78, lr, lh, 7);
      const pos = geo.attributes.position;
      for (let v = 0; v < pos.count; v++) {
        const x = pos.getX(v), z = pos.getZ(v);
        const nn = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453;
        const j = 1 + ((nn - Math.floor(nn)) - 0.5) * 0.3;
        pos.setX(v, x * j); pos.setZ(v, z * j);
      }
      geo.computeVertexNormals();
      const block = new THREE.Mesh(geo, mat);
      block.position.set((Math.random() - 0.5) * 0.5, y + lh / 2, (Math.random() - 0.5) * 0.5);
      g.add(block);
      y += lh * 0.9;
    }
    g.position.set(o.x, o.y || 0, o.z);
    g.rotation.y = o.ry !== undefined ? o.ry : Math.random() * Math.PI * 2;
    return g;
  }

  // Little submarine: fat hull, conning tower, glowing portholes, tail fins
  _makeSub(o) {
    const g = new THREE.Group();
    const paint = new THREE.MeshStandardMaterial({ color: o.color || 0xf0c020 });
    const hull = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), paint);
    hull.scale.set(2.3, 1, 1);
    hull.position.y = 1.3;
    g.add(hull);
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.42, 0.7, 10), paint);
    tower.position.set(-0.2, 2.05, 0);
    g.add(tower);
    const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.5, 6), paint);
    scope.position.set(-0.2, 2.6, 0);
    g.add(scope);
    // Glowing portholes down each side
    const portMat = new THREE.MeshStandardMaterial({ color: 0x9ff0f8, emissive: 0x4fd0e0, emissiveIntensity: 0.7 });
    for (let i = -1; i <= 1; i++) {
      [1, -1].forEach(side => {
        const port = new THREE.Mesh(new THREE.CircleGeometry(0.17, 12), portMat);
        port.position.set(i * 0.75, 1.35, side * 1.01);
        port.rotation.y = side > 0 ? 0 : Math.PI;
        g.add(port);
      });
    }
    // Tail fins + propeller
    const finMat = new THREE.MeshStandardMaterial({ color: 0xd0a010 });
    const finV = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.1, 0.08), finMat);
    finV.position.set(2.1, 1.3, 0); g.add(finV);
    const finH = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.08, 1.1), finMat);
    finH.position.set(2.1, 1.3, 0); g.add(finH);
    const prop = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.06, 6, 12),
      new THREE.MeshStandardMaterial({ color: 0x333333 }));
    prop.position.set(2.4, 1.3, 0); prop.rotation.y = Math.PI / 2;
    g.add(prop);
    g.position.set(o.x, o.y || 0, o.z);
    g.rotation.y = o.ry !== undefined ? o.ry : Math.random() * Math.PI * 2;
    return g;
  }

  // Rusty barrel of debris resting (or toppled) on the seabed
  _makeBarrel(o) {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: o.color || 0x6a7a5a, roughness: 0.95 });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1.2, 12), mat);
    body.position.y = 0.6;
    g.add(body);
    const ringMat = new THREE.MeshStandardMaterial({ color: 0x3a3a34 });
    [0.28, 0.9].forEach(ry => {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.51, 0.05, 6, 14), ringMat);
      ring.rotation.x = Math.PI / 2; ring.position.y = ry;
      g.add(ring);
    });
    g.position.set(o.x, o.y || 0, o.z);
    // Farm barrels stand in neat rows; sea debris lies toppled
    if (o.upright) g.rotation.y = Math.random() * Math.PI;
    else g.rotation.set((Math.random() - 0.5) * 0.5, Math.random() * Math.PI, (Math.random() - 0.5) * 0.5);
    return g;
  }

  // Giant sky jellyfish: translucent glowing bell with teal tentacle
  // streams trailing below; rocks gently via the sway system
  _makeJellyfish(o) {
    const g = new THREE.Group();
    const r = o.r || 3.5;
    const bell = new THREE.Mesh(
      new THREE.SphereGeometry(r, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55),
      new THREE.MeshStandardMaterial({
        color: o.color || 0x8a7ab8, transparent: true, opacity: 0.75,
        emissive: 0x6a5a98, emissiveIntensity: 0.4, side: THREE.DoubleSide
      })
    );
    g.add(bell);
    // Glowing tentacle streams
    const tentMat = new THREE.MeshStandardMaterial({
      color: 0x3adfc8, emissive: 0x2ac8b0, emissiveIntensity: 0.8,
      transparent: true, opacity: 0.8
    });
    const n = 7 + Math.floor(Math.random() * 5);
    for (let i = 0; i < n; i++) {
      const len = r * (1.2 + Math.random() * 1.1);
      const a = Math.random() * Math.PI * 2;
      const rad = Math.random() * r * 0.65;
      const t = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.12, len, 5), tentMat);
      t.position.set(Math.cos(a) * rad, -len / 2 + 0.3, Math.sin(a) * rad);
      t.rotation.x = (Math.random() - 0.5) * 0.4;
      t.rotation.z = (Math.random() - 0.5) * 0.4;
      g.add(t);
    }
    g.userData.sway = true;
    g.userData.swayPhase = Math.random() * Math.PI * 2;
    g.userData.swayAmp = 0.06;
    g.position.set(o.x, o.y !== undefined ? o.y : 12, o.z);
    g.rotation.y = o.ry !== undefined ? o.ry : Math.random() * Math.PI * 2;
    return g;
  }

  // Patch of bioluminescent flowers: glowing heads on dark stems plus a
  // faint pool of light on the ground
  _makeGlowFlower(o) {
    const g = new THREE.Group();
    const col = o.color || 0xff4ad8;
    const stemMat = new THREE.MeshStandardMaterial({ color: 0x1e3a30 });
    const headMat = new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.9 });
    const n = 3 + Math.floor(Math.random() * 4);
    for (let i = 0; i < n; i++) {
      const h = 0.35 + Math.random() * 0.55;
      const a = Math.random() * Math.PI * 2;
      const px = Math.cos(a) * Math.random() * 0.6, pz = Math.sin(a) * Math.random() * 0.6;
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.04, h, 5), stemMat);
      stem.position.set(px, h / 2, pz);
      g.add(stem);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.1 + Math.random() * 0.07, 8, 8), headMat);
      head.position.set(px, h + 0.06, pz);
      g.add(head);
    }
    // Faint glow pooled on the grass beneath
    const pool = new THREE.Mesh(new THREE.CircleGeometry(0.9, 12),
      new THREE.MeshStandardMaterial({
        color: col, emissive: col, emissiveIntensity: 0.3,
        transparent: true, opacity: 0.25, depthWrite: false
      }));
    pool.rotation.x = -Math.PI / 2;
    pool.position.y = 0.03;
    g.add(pool);
    g.position.set(o.x, o.y || 0, o.z);
    return g;
  }

  // Small dark camping tent: 3-sided prism with a shadowed entrance
  _makeTent(o) {
    const g = new THREE.Group();
    const rw = 1.5, d = 2.6;
    // thetaStart=PI puts the prism apex up after the X-rotation (flat base)
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(rw, rw, d, 3, 1, false, Math.PI),
      new THREE.MeshStandardMaterial({ color: o.color || 0x1e1e26, flatShading: true })
    );
    body.rotation.x = Math.PI / 2;
    body.position.y = rw * 0.5;
    g.add(body);
    // Shadowed entrance triangle on the front
    const door = new THREE.Mesh(new THREE.CircleGeometry(rw * 0.55, 3),
      new THREE.MeshStandardMaterial({ color: 0x0a0a10 }));
    door.position.set(0, rw * 0.42, d / 2 + 0.02);
    door.rotation.z = Math.PI / 2; // point the triangle upward
    g.add(door);
    g.position.set(o.x, o.y || 0, o.z);
    g.rotation.y = o.ry !== undefined ? o.ry : Math.random() * Math.PI * 2;
    return g;
  }

  // Erupting volcano: jittered dark cone, a glowing crater with fire jets,
  // lava streaks running down the slopes, and a smoke plume above
  _makeVolcano(o) {
    const g = new THREE.Group();
    const r = o.r || 14, h = o.h || 20;
    // The cone, roughed up like the rocks
    const geo = new THREE.ConeGeometry(r, h, 12, 3);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      if (Math.abs(x) < 0.01 && Math.abs(z) < 0.01) continue; // keep the apex
      const n = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453;
      const j = 1 + ((n - Math.floor(n)) - 0.5) * 0.22;
      pos.setX(i, x * j); pos.setZ(i, z * j);
    }
    geo.computeVertexNormals();
    const cone = new THREE.Mesh(geo,
      new THREE.MeshStandardMaterial({ color: 0x2e2624, flatShading: true, roughness: 1 }));
    cone.position.y = h / 2;
    g.add(cone);
    // Glowing crater mouth
    const crater = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.2, r * 0.28, h * 0.07, 10),
      new THREE.MeshStandardMaterial({ color: 0xff7a00, emissive: 0xff5a00, emissiveIntensity: 1 }));
    crater.position.y = h * 0.97;
    g.add(crater);
    // Fire jets spraying from the crater
    const fireMat = new THREE.MeshStandardMaterial({
      color: 0xffc23a, emissive: 0xff8a00, emissiveIntensity: 1, transparent: true, opacity: 0.9
    });
    for (let i = 0; i < 4; i++) {
      const fh = h * (0.14 + Math.random() * 0.16);
      const jet = new THREE.Mesh(new THREE.ConeGeometry(r * 0.05, fh, 6), fireMat);
      jet.position.set((Math.random() - 0.5) * r * 0.25, h + fh / 2 - 0.2, (Math.random() - 0.5) * r * 0.25);
      jet.rotation.set((Math.random() - 0.5) * 0.5, 0, (Math.random() - 0.5) * 0.5);
      g.add(jet);
    }
    // Lava streaks running from the crater rim down to the base
    const streakMat = new THREE.MeshStandardMaterial({
      color: 0xff6a10, emissive: 0xff4a00, emissiveIntensity: 0.9
    });
    const up = new THREE.Vector3(0, 1, 0);
    const nStreaks = 5 + Math.floor(Math.random() * 3);
    for (let i = 0; i < nStreaks; i++) {
      const a = (i / nStreaks) * Math.PI * 2 + Math.random() * 0.6;
      const top = new THREE.Vector3(Math.cos(a) * r * 0.24, h * 0.95, Math.sin(a) * r * 0.24);
      const bottom = new THREE.Vector3(Math.cos(a) * r * (0.75 + Math.random() * 0.25), 0.3, Math.sin(a) * r * (0.75 + Math.random() * 0.25));
      const dir = bottom.clone().sub(top);
      const len = dir.length() * (0.6 + Math.random() * 0.35);
      const streak = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.5, len, 6), streakMat);
      streak.position.copy(top).add(dir.clone().multiplyScalar(0.45));
      streak.quaternion.setFromUnitVectors(up, dir.normalize());
      g.add(streak);
    }
    // Smoke plume drifting above the crater
    const smokeMat = new THREE.MeshStandardMaterial({
      color: 0x26242a, transparent: true, opacity: 0.8
    });
    for (let i = 0; i < 4; i++) {
      const sr = r * (0.16 + i * 0.09);
      const puff = new THREE.Mesh(new THREE.SphereGeometry(sr, 10, 8), smokeMat);
      puff.position.set(i * r * 0.06 + (Math.random() - 0.5) * r * 0.08, h + h * 0.12 + i * sr * 1.1, (Math.random() - 0.5) * r * 0.08);
      puff.scale.y = 0.8;
      g.add(puff);
    }
    g.position.set(o.x, o.y || 0, o.z);
    g.rotation.y = o.ry !== undefined ? o.ry : Math.random() * Math.PI * 2;
    return g;
  }

  // Burnt dead tree: leaning charred trunk with a few bare branches
  _makeDeadTree(o) {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: o.color || 0x241c18, roughness: 1 });
    const h = 3.5 + Math.random() * 3;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.3, h, 6), mat);
    trunk.position.y = h / 2;
    trunk.rotation.z = (Math.random() - 0.5) * 0.2;
    g.add(trunk);
    const n = 3 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      const bl = 0.8 + Math.random() * 1.4;
      const branch = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.1, bl, 5), mat);
      const a = Math.random() * Math.PI * 2;
      const by = h * (0.5 + Math.random() * 0.45);
      branch.position.set(Math.cos(a) * bl * 0.32, by, Math.sin(a) * bl * 0.32);
      branch.rotation.set(Math.sin(a) * (0.6 + Math.random() * 0.5), 0, -Math.cos(a) * (0.6 + Math.random() * 0.5));
      g.add(branch);
    }
    g.position.set(o.x, o.y || 0, o.z);
    g.rotation.y = Math.random() * Math.PI * 2;
    return g;
  }

  // Classic red barn: white-trimmed cross doors, dark gabled prism roof
  _makeBarn(o) {
    const g = new THREE.Group();
    const w = o.w || 10, h = o.h || 6, d = o.d || 8;
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d),
      new THREE.MeshStandardMaterial({ color: 0xc03a2e }));
    body.position.y = h / 2;
    g.add(body);
    // Dark gabled roof (3-sided prism, apex up)
    const rw = w * 0.62;
    const roof = new THREE.Mesh(
      new THREE.CylinderGeometry(rw, rw, d + 0.8, 3, 1, false, Math.PI),
      new THREE.MeshStandardMaterial({ color: 0x3a3a40, flatShading: true }));
    roof.rotation.x = Math.PI / 2;
    roof.position.y = h + rw * 0.45;
    g.add(roof);
    // Big front door: white frame, red inset, white X cross
    const white = new THREE.MeshStandardMaterial({ color: 0xf2f2ee });
    const frame = new THREE.Mesh(new THREE.BoxGeometry(w * 0.34, h * 0.64, 0.12), white);
    frame.position.set(0, h * 0.32, d / 2 + 0.06);
    g.add(frame);
    const door = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.28, h * 0.56),
      new THREE.MeshStandardMaterial({ color: 0x8a2a20 }));
    door.position.set(0, h * 0.31, d / 2 + 0.14);
    g.add(door);
    [-1, 1].forEach(s => {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(w * 0.05, h * 0.58, 0.05), white);
      bar.rotation.z = s * Math.atan2(w * 0.28, h * 0.56);
      bar.position.set(0, h * 0.31, d / 2 + 0.16);
      g.add(bar);
    });
    // Loft window up in the gable
    const loft = new THREE.Mesh(new THREE.CircleGeometry(w * 0.07, 12), white);
    loft.position.set(0, h + rw * 0.5, d / 2 + 0.42);
    g.add(loft);
    g.position.set(o.x, o.y || 0, o.z);
    g.rotation.y = o.ry || 0;
    return g;
  }

  // Red grain silo with a dark dome cap
  _makeSilo(o) {
    const g = new THREE.Group();
    const r = o.r || 1.9, h = o.h || 9;
    const body = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 14),
      new THREE.MeshStandardMaterial({ color: 0xc03a2e }));
    body.position.y = h / 2;
    g.add(body);
    // White band + dark dome cap
    const band = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.03, r * 1.03, 0.35, 14),
      new THREE.MeshStandardMaterial({ color: 0xf2f2ee }));
    band.position.y = h * 0.62;
    g.add(band);
    const cap = new THREE.Mesh(
      new THREE.SphereGeometry(r * 1.05, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0x3a3a40 }));
    cap.position.y = h;
    g.add(cap);
    g.position.set(o.x, o.y || 0, o.z);
    return g;
  }

  // Planted crop plot: dark soil slab with neat rows of plants.
  // crop: 'wheat' (golden stalks) | 'carrot' (leaf tufts + orange nubs)
  //     | 'berry' (bushes dotted with red fruit)
  _makeCrop(o) {
    const g = new THREE.Group();
    const w = o.w || 16, d = o.d || 9, crop = o.crop || 'wheat';
    const soil = new THREE.Mesh(new THREE.BoxGeometry(w, 0.25, d),
      new THREE.MeshStandardMaterial({ map: makeWoodTexture('#5a3c28', '#4a3020') }));
    soil.position.y = 0.12;
    g.add(soil);
    const cols = Math.max(3, Math.floor(w / 2.2));
    const rows = Math.max(2, Math.floor(d / 2.2));
    const green = new THREE.MeshStandardMaterial({ color: 0x3aa055 });
    const wheatMat = new THREE.MeshStandardMaterial({ color: 0xe8c84a });
    const headMat = new THREE.MeshStandardMaterial({ color: 0xf0d060 });
    const carrotMat = new THREE.MeshStandardMaterial({ color: 0xe8801a });
    const berryMat = new THREE.MeshStandardMaterial({ color: 0xd83a3a });
    for (let r2 = 0; r2 < rows; r2++) {
      for (let c = 0; c < cols; c++) {
        const px = -w / 2 + (c + 0.5) * (w / cols);
        const pz = -d / 2 + (r2 + 0.5) * (d / rows);
        if (crop === 'wheat') {
          const hh = 1.1 + Math.random() * 0.4;
          const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, hh, 5), wheatMat);
          stalk.position.set(px, hh / 2 + 0.2, pz);
          g.add(stalk);
          const head = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.4, 5), headMat);
          head.position.set(px, hh + 0.35, pz);
          g.add(head);
        } else if (crop === 'carrot') {
          const tuft = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.75, 6), green);
          tuft.position.set(px, 0.6, pz);
          g.add(tuft);
          const nub = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.3, 6), carrotMat);
          nub.rotation.x = Math.PI; // pointy end buried in the soil
          nub.position.set(px, 0.3, pz);
          g.add(nub);
        } else {
          const bush = new THREE.Mesh(new THREE.SphereGeometry(0.42, 8, 6),
            new THREE.MeshStandardMaterial({ color: 0x2f8d46 }));
          bush.position.set(px, 0.55, pz);
          g.add(bush);
          for (let b = 0; b < 3; b++) {
            const berry = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 6), berryMat);
            const a = Math.random() * Math.PI * 2;
            berry.position.set(px + Math.cos(a) * 0.36, 0.55 + (Math.random() - 0.3) * 0.3, pz + Math.sin(a) * 0.36);
            g.add(berry);
          }
        }
      }
    }
    g.position.set(o.x, o.y || 0, o.z);
    g.rotation.y = o.ry || 0;
    return g;
  }

  // White picket fence run: two rails + evenly spaced pickets
  _makeFence(o) {
    const g = new THREE.Group();
    const L = o.w || 8;
    const white = new THREE.MeshStandardMaterial({ color: 0xf2f2ee });
    [0.55, 0.95].forEach(ry => {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(L, 0.09, 0.05), white);
      rail.position.y = ry;
      g.add(rail);
    });
    const n = Math.max(3, Math.round(L / 0.75));
    for (let i = 0; i < n; i++) {
      const picket = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.25, 0.07), white);
      picket.position.set(-L / 2 + (i + 0.5) * (L / n), 0.62, 0);
      g.add(picket);
    }
    g.position.set(o.x, o.y || 0, o.z);
    g.rotation.y = o.ry || 0;
    return g;
  }

  // Scarecrow: pole + crossbar, straw head with a hat, red shirt
  _makeScarecrow(o) {
    const g = new THREE.Group();
    const wood = new THREE.MeshStandardMaterial({ color: 0x8a5a34 });
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 2.3, 6), wood);
    pole.position.y = 1.15;
    g.add(pole);
    const arms = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.09, 0.09), wood);
    arms.position.y = 1.62;
    g.add(arms);
    const shirt = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.7, 0.28),
      new THREE.MeshStandardMaterial({ color: 0xc03a2e }));
    shirt.position.y = 1.4;
    g.add(shirt);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0xe8c88a }));
    head.position.y = 2.02;
    g.add(head);
    const hat = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.4, 8),
      new THREE.MeshStandardMaterial({ color: 0xc9a94e }));
    hat.position.y = 2.32;
    g.add(hat);
    g.position.set(o.x, o.y || 0, o.z);
    g.rotation.y = o.ry !== undefined ? o.ry : Math.random() * Math.PI * 2;
    return g;
  }

  // Market stall: wooden counter, corner posts, striped awning, goods on top
  _makeStall(o) {
    const g = new THREE.Group();
    const w = o.w || 3.4, d = o.d || 2.4;
    const wood = new THREE.MeshStandardMaterial({ map: makeWoodTexture() });
    const counter = new THREE.Mesh(new THREE.BoxGeometry(w, 1.1, d), wood);
    counter.position.y = 0.55;
    g.add(counter);
    const postMat = new THREE.MeshStandardMaterial({ color: 0x5a4030 });
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.7, 0.12), postMat);
      post.position.set(sx * (w / 2 - 0.1), 1.35, sz * (d / 2 - 0.1));
      g.add(post);
    });
    // Striped awning tilted toward the shopper
    const awCv = document.createElement('canvas');
    awCv.width = 64; awCv.height = 16;
    const actx = awCv.getContext('2d');
    const ac = new THREE.Color(o.awning !== undefined ? o.awning : (o.color || 0xd0483a));
    const awHex = `rgb(${Math.floor(ac.r * 255)},${Math.floor(ac.g * 255)},${Math.floor(ac.b * 255)})`;
    for (let i = 0; i < 8; i++) {
      actx.fillStyle = i % 2 ? '#ffffff' : awHex;
      actx.fillRect(i * 8, 0, 8, 16);
    }
    const awning = new THREE.Mesh(new THREE.BoxGeometry(w + 0.5, 0.08, d + 0.8),
      new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(awCv) }));
    awning.position.y = 2.75;
    awning.rotation.x = 0.15;
    g.add(awning);
    // Goods laid out on the counter
    const FRUIT = [0xd83a3a, 0xe8a02a, 0x8ac44a, 0xe8c83a, 0x9b59b6];
    for (let i = 0; i < 4; i++) {
      const fruit = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 8),
        new THREE.MeshStandardMaterial({ color: FRUIT[(Math.random() * FRUIT.length) | 0] }));
      fruit.position.set(-w / 2 + 0.5 + i * (w - 1) / 3, 1.28, (Math.random() - 0.5) * (d * 0.4));
      g.add(fruit);
    }
    const crate = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.4, 0.5), wood);
    crate.position.set(w * 0.28, 1.3, 0);
    g.add(crate);
    g.position.set(o.x, o.y || 0, o.z);
    g.rotation.y = o.ry !== undefined ? o.ry : Math.random() * Math.PI * 2;
    return g;
  }

  // Black garden lamp with a warm glowing head
  _makeLamp(o) {
    const g = new THREE.Group();
    const black = new THREE.MeshStandardMaterial({ color: o.color || 0x222226 });
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 2.6, 6), black);
    pole.position.y = 1.3;
    g.add(pole);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.42, 0.38), black);
    head.position.y = 2.8;
    g.add(head);
    const glow = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0xffd27a, emissive: 0xffc040, emissiveIntensity: 1 }));
    glow.position.y = 2.78;
    g.add(glow);
    g.position.set(o.x, o.y || 0, o.z);
    return g;
  }

  // Low-poly apple tree: blocky canopy studded with red apples
  _makeFruitTree(o) {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.32, 1.9, 7),
      new THREE.MeshStandardMaterial({ color: 0x7a5230 }));
    trunk.position.y = 0.95;
    g.add(trunk);
    const canopyMat = new THREE.MeshStandardMaterial({ color: o.color || 0x3aa055, flatShading: true });
    const blobs = 2 + Math.floor(Math.random() * 2);
    const tops = [];
    for (let i = 0; i < blobs; i++) {
      const cr = 1.1 + Math.random() * 0.6;
      const blob = new THREE.Mesh(new THREE.DodecahedronGeometry(cr, 0), canopyMat);
      blob.position.set((Math.random() - 0.5) * 1.2, 2.4 + Math.random() * 0.8, (Math.random() - 0.5) * 1.2);
      g.add(blob);
      tops.push({ p: blob.position, r: cr });
    }
    const appleMat = new THREE.MeshStandardMaterial({ color: 0xd83a3a });
    for (let i = 0; i < 6; i++) {
      const t = tops[i % tops.length];
      const a = Math.random() * Math.PI * 2, b = Math.random() * Math.PI;
      const apple = new THREE.Mesh(new THREE.SphereGeometry(0.13, 6, 6), appleMat);
      apple.position.set(
        t.p.x + Math.sin(b) * Math.cos(a) * t.r * 0.95,
        t.p.y + Math.cos(b) * t.r * 0.6,
        t.p.z + Math.sin(b) * Math.sin(a) * t.r * 0.95);
      g.add(apple);
    }
    g.position.set(o.x, o.y || 0, o.z);
    g.rotation.y = Math.random() * Math.PI * 2;
    return g;
  }

  // Supermarket produce bin piled with one kind of fruit
  _makeProduceBin(o) {
    const g = new THREE.Group();
    const bin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.85, 1.2),
      new THREE.MeshStandardMaterial({ map: makeWoodTexture() }));
    bin.position.y = 0.42;
    g.add(bin);
    const col = o.color || 0xd83a3a;
    const mat = new THREE.MeshStandardMaterial({ color: col });
    for (let i = 0; i < 9; i++) {
      const r = 0.17 + Math.random() * 0.06;
      const fruit = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 6), mat);
      fruit.position.set(
        (Math.random() - 0.5) * 1.3,
        0.88 + (i > 5 ? 0.22 : 0),
        (Math.random() - 0.5) * 0.85);
      if (o.squash) fruit.scale.y = 0.75; // pumpkins
      g.add(fruit);
    }
    g.position.set(o.x, o.y || 0, o.z);
    g.rotation.y = o.ry !== undefined ? o.ry : Math.random() * Math.PI * 2;
    return g;
  }

  // Round hotpot table: wooden top on a pillar, dark pot in the middle,
  // red stools around — the mookata corner
  _makeTable(o) {
    const g = new THREE.Group();
    const wood = new THREE.MeshStandardMaterial({ map: makeWoodTexture() });
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 1.0, 8),
      new THREE.MeshStandardMaterial({ color: 0x5a4030 }));
    leg.position.y = 0.5;
    g.add(leg);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.15, 0.12, 14), wood);
    top.position.y = 1.05;
    g.add(top);
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.32, 0.3, 10),
      new THREE.MeshStandardMaterial({ color: 0x2f2f35 }));
    pot.position.y = 1.26;
    g.add(pot);
    // Plates of food
    [[-0.6, 0.3], [0.55, -0.35]].forEach(([px, pz]) => {
      const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.05, 10),
        new THREE.MeshStandardMaterial({ color: 0xf0f0ea }));
      plate.position.set(px, 1.14, pz);
      g.add(plate);
      const food = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6),
        new THREE.MeshStandardMaterial({ color: 0xe86a6a }));
      food.position.set(px, 1.22, pz);
      food.scale.y = 0.6;
      g.add(food);
    });
    // Red diner stools
    const stoolMat = new THREE.MeshStandardMaterial({ color: 0xc03a2e });
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + 0.5;
      const stool = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.6, 10), stoolMat);
      stool.position.set(Math.cos(a) * 1.7, 0.3, Math.sin(a) * 1.7);
      g.add(stool);
    }
    g.position.set(o.x, o.y || 0, o.z);
    g.rotation.y = o.ry !== undefined ? o.ry : Math.random() * Math.PI * 2;
    return g;
  }

  // Convenience mini-mart: white box, glass front, door, and the classic
  // striped fascia band wrapping the roofline
  _makeMinimart(o) {
    const g = new THREE.Group();
    const w = o.w || 9, h = o.h || 3.4, d = o.d || 5.5;
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d),
      new THREE.MeshStandardMaterial({ color: 0xf0efe8 }));
    body.position.y = h / 2;
    g.add(body);
    // Glass storefront + door
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.84, h * 0.55),
      new THREE.MeshStandardMaterial({
        color: 0x8fd0e8, transparent: true, opacity: 0.55,
        emissive: 0x3a7a95, emissiveIntensity: 0.25
      }));
    glass.position.set(0, h * 0.42, d / 2 + 0.02);
    g.add(glass);
    const door = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.18, h * 0.6),
      new THREE.MeshStandardMaterial({ color: 0x3a5a6a }));
    door.position.set(w * 0.22, h * 0.31, d / 2 + 0.04);
    g.add(door);
    // Striped fascia band (orange/green/red) wrapping the roofline
    const fb = document.createElement('canvas');
    fb.width = 128; fb.height = 32;
    const fctx = fb.getContext('2d');
    fctx.fillStyle = '#ffffff'; fctx.fillRect(0, 0, 128, 32);
    [['#ff7a1a', 5], ['#2f8d5a', 13], ['#d0342a', 21]].forEach(([c, y]) => {
      fctx.fillStyle = c; fctx.fillRect(0, y, 128, 6);
    });
    const band = new THREE.Mesh(new THREE.BoxGeometry(w + 0.4, 0.75, d + 0.4),
      new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(fb) }));
    band.position.y = h + 0.3;
    g.add(band);
    g.position.set(o.x, o.y || 0, o.z);
    g.rotation.y = o.ry || 0;
    return g;
  }

  // Krasue (กระสือ): a floating pale head with long dark hair and glowing
  // red entrails trailing below — drifts through the night air
  _makeKrasue(o) {
    const g = new THREE.Group();
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.35, 12, 10),
      new THREE.MeshStandardMaterial({ color: 0xe8cdb0, emissive: 0x3a2c20, emissiveIntensity: 0.4 }));
    g.add(head);
    // Long dark hair draped over the top and back
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.38, 12, 10),
      new THREE.MeshStandardMaterial({ color: 0x141014 }));
    hair.position.set(-0.08, 0.1, 0);
    hair.scale.set(1.1, 0.9, 1.05);
    g.add(hair);
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0a });
    [-1, 1].forEach(s => {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.055, 6, 6), eyeMat);
      eye.position.set(0.3, 0.03, s * 0.13);
      g.add(eye);
    });
    // Glowing heart + entrail strands hanging below
    const gutMat = new THREE.MeshStandardMaterial({
      color: 0xc02818, emissive: 0xa01808, emissiveIntensity: 0.8
    });
    const heart = new THREE.Mesh(new THREE.SphereGeometry(0.17, 8, 8), gutMat);
    heart.position.y = -0.5;
    g.add(heart);
    const strands = 5 + Math.floor(Math.random() * 3);
    for (let i = 0; i < strands; i++) {
      const len = 0.8 + Math.random() * 0.9;
      const strand = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.06, len, 5), gutMat);
      const a = Math.random() * Math.PI * 2;
      strand.position.set(Math.cos(a) * 0.12, -0.5 - len / 2, Math.sin(a) * 0.12);
      strand.rotation.x = (Math.random() - 0.5) * 0.3;
      strand.rotation.z = (Math.random() - 0.5) * 0.3;
      g.add(strand);
    }
    g.position.set(o.x, o.y !== undefined ? o.y : 3, o.z);
    return g;
  }

  // Classic sheet ghost: translucent white shroud with hollow black eyes
  _makeSheetGhost(o) {
    const g = new THREE.Group();
    const sheetMat = new THREE.MeshStandardMaterial({
      color: 0xe8e8f0, transparent: true, opacity: 0.85,
      emissive: 0x8888a0, emissiveIntensity: 0.25
    });
    const body = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.7, 9), sheetMat);
    body.position.y = 0.35;
    g.add(body);
    const headBump = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 8), sheetMat);
    headBump.position.y = 1.15;
    g.add(headBump);
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x050505 });
    [-1, 1].forEach(s => {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 6), eyeMat);
      eye.position.set(0.27, 1.2, s * 0.12);
      g.add(eye);
    });
    g.position.set(o.x, o.y !== undefined ? o.y : 1.2, o.z);
    return g;
  }

  // Small ghost kid (กุมาร): a pale child figure with a topknot, standing
  // unnervingly still in the gloom
  _makeGhostKid(o) {
    const g = new THREE.Group();
    const paleMat = new THREE.MeshStandardMaterial({
      color: o.color || 0xded6c8, emissive: 0x3a3830, emissiveIntensity: 0.35
    });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.22, 0.6, 8), paleMat);
    body.position.y = 0.55;
    g.add(body);
    [-1, 1].forEach(s => {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.28, 6), paleMat);
      leg.position.set(0, 0.14, s * 0.09);
      g.add(leg);
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.42, 6), paleMat);
      arm.position.set(0, 0.62, s * 0.24);
      arm.rotation.x = s * 0.1;
      g.add(arm);
    });
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 10, 8), paleMat);
    head.position.y = 1.05;
    g.add(head);
    // Golden topknot (จุก)
    const knot = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 6),
      new THREE.MeshStandardMaterial({ color: 0xc8a030 }));
    knot.position.y = 1.27;
    g.add(knot);
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0a });
    [-1, 1].forEach(s => {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 6), eyeMat);
      eye.position.set(0.18, 1.07, s * 0.08);
      g.add(eye);
    });
    g.position.set(o.x, o.y || 0, o.z);
    g.rotation.y = o.ry !== undefined ? o.ry : Math.random() * Math.PI * 2;
    return g;
  }

  // Spider-legged ghoul: dark tilted body, pale mask face, six long red
  // spindly legs splayed onto the ground
  _makeSpiderGhost(o) {
    const g = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: o.color || 0x16100e });
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.4, 10, 8), bodyMat);
    body.scale.set(1, 1.7, 1);
    body.position.y = 1.1;
    body.rotation.z = 0.5;
    g.add(body);
    // Pale mask face with black eyes
    const mask = new THREE.Mesh(new THREE.CircleGeometry(0.19, 12),
      new THREE.MeshStandardMaterial({ color: 0xe8e4da, side: THREE.DoubleSide }));
    mask.position.set(0.42, 1.5, 0);
    mask.rotation.y = Math.PI / 2;
    mask.rotation.z = 0.5;
    g.add(mask);
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x050505 });
    [-1, 1].forEach(s => {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 6), eyeMat);
      eye.position.set(0.45, 1.52, s * 0.07);
      g.add(eye);
    });
    // Six long spindly legs splayed out to the ground
    const legMat = new THREE.MeshStandardMaterial({
      color: 0x6a1a12, emissive: 0x300a05, emissiveIntensity: 0.5
    });
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.3;
      const len = 1.7 + Math.random() * 0.6;
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, len, 5), legMat);
      leg.position.set(Math.cos(a) * len * 0.4, 0.62, Math.sin(a) * len * 0.4);
      leg.rotation.set(Math.sin(a) * 0.9, 0, -Math.cos(a) * 0.9);
      g.add(leg);
    }
    g.position.set(o.x, o.y || 0, o.z);
    g.rotation.y = o.ry !== undefined ? o.ry : Math.random() * Math.PI * 2;
    return g;
  }

  // Gilt-framed painting hung on a wall (style: 0 portrait, 1 landscape,
  // 2 abstract, 3 staircase — random when omitted)
  _makePainting(o) {
    const g = new THREE.Group();
    const w = o.w || 2.8, h = o.h || 3.4;
    const frame = new THREE.Mesh(new THREE.BoxGeometry(w + 0.3, h + 0.3, 0.12),
      new THREE.MeshStandardMaterial({ color: 0xc8a030 }));
    g.add(frame);
    const inner = new THREE.Mesh(new THREE.BoxGeometry(w + 0.12, h + 0.12, 0.13),
      new THREE.MeshStandardMaterial({ color: 0x8a6a20 }));
    g.add(inner);
    const canvas = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
      new THREE.MeshStandardMaterial({ map: makePaintingTexture(o.style) }));
    canvas.position.z = 0.08;
    g.add(canvas);
    g.position.set(o.x, o.y !== undefined ? o.y : 3.9, o.z);
    g.rotation.y = o.ry || 0;
    return g;
  }

  // Classical marble statue: stone plinth + armless robed figure
  _makeStatue(o) {
    const g = new THREE.Group();
    const marble = new THREE.MeshStandardMaterial({ color: o.color || 0xe8e4dc, roughness: 0.6 });
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(1, 1.1, 1),
      new THREE.MeshStandardMaterial({ color: 0x9a958c }));
    plinth.position.y = 0.55;
    g.add(plinth);
    const robe = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.46, 1.6, 9), marble);
    robe.position.y = 1.9;
    g.add(robe);
    const chest = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 8), marble);
    chest.position.y = 2.72;
    chest.scale.set(1, 0.7, 0.8);
    g.add(chest);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), marble);
    head.position.y = 3.1;
    g.add(head);
    g.position.set(o.x, o.y || 0, o.z);
    g.rotation.y = o.ry !== undefined ? o.ry : Math.random() * Math.PI * 2;
    return g;
  }

  // Golden chandelier hanging from the ceiling: chain, ring, candle glows
  _makeChandelier(o) {
    const g = new THREE.Group();
    const gold = new THREE.MeshStandardMaterial({ color: 0xc8a030 });
    const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.4, 5), gold);
    chain.position.y = 0.7;
    g.add(chain);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.06, 6, 16), gold);
    ring.rotation.x = Math.PI / 2;
    g.add(ring);
    const glowMat = new THREE.MeshStandardMaterial({
      color: 0xffe0a0, emissive: 0xffc860, emissiveIntensity: 1.1
    });
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const candle = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 8), glowMat);
      candle.position.set(Math.cos(a) * 0.75, 0.16, Math.sin(a) * 0.75);
      g.add(candle);
    }
    const centre = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8), glowMat);
    centre.position.y = -0.15;
    g.add(centre);
    g.position.set(o.x, o.y !== undefined ? o.y : 7.4, o.z);
    return g;
  }

  // Porcelain vase on the floor
  _makeVase(o) {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: o.color || 0xf0ede4, roughness: 0.4 });
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.38, 12, 10), mat);
    body.position.y = 0.45;
    body.scale.y = 1.25;
    g.add(body);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.18, 0.35, 10), mat);
    neck.position.y = 1.0;
    g.add(neck);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.045, 6, 12), mat);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 1.18;
    g.add(rim);
    // Blue decorative band
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.385, 0.03, 6, 14),
      new THREE.MeshStandardMaterial({ color: 0x3a5a8a }));
    band.rotation.x = Math.PI / 2;
    band.position.y = 0.55;
    g.add(band);
    g.position.set(o.x, o.y || 0, o.z);
    return g;
  }

  // Long dark-wood dining set: table + high-back chairs down both sides
  _makeDiningSet(o) {
    const g = new THREE.Group();
    const wood = new THREE.MeshStandardMaterial({ color: 0x4a3020 });
    const top = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.16, 1.7), wood);
    top.position.y = 1.35;
    g.add(top);
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.35, 0.16), wood);
      leg.position.set(sx * 2.05, 0.675, sz * 0.65);
      g.add(leg);
    });
    // Candelabrum centrepiece
    const glowMat = new THREE.MeshStandardMaterial({
      color: 0xffe0a0, emissive: 0xffc860, emissiveIntensity: 0.9
    });
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.09, 0.5, 6),
      new THREE.MeshStandardMaterial({ color: 0xc8a030 }));
    stem.position.y = 1.68;
    g.add(stem);
    const flame = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 6), glowMat);
    flame.position.y = 1.98;
    g.add(flame);
    // High-back chairs, three per side
    for (let i = 0; i < 3; i++) {
      [-1, 1].forEach(side => {
        const cx = -1.5 + i * 1.5;
        const seat = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.14, 0.55), wood);
        seat.position.set(cx, 0.8, side * 1.35);
        g.add(seat);
        const back = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.25, 0.12), wood);
        back.position.set(cx, 1.4, side * (1.35 + 0.26));
        g.add(back);
        const base = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.8, 0.45), wood);
        base.position.set(cx, 0.4, side * 1.35);
        g.add(base);
      });
    }
    g.position.set(o.x, o.y || 0, o.z);
    g.rotation.y = o.ry || 0;
    return g;
  }

  // ===== Manor luxury props =====

  // Fluted classical column with a gilded Corinthian capital. The mansion's
  // signature — pairs of these frame the hall and the room openings.
  _makeColumn(o) {
    const g = new THREE.Group();
    const h = o.h || 8, r = o.r || 0.55;
    const stone = new THREE.MeshStandardMaterial({ color: o.color || 0xd2c8b6, roughness: 0.55 });
    const gold = new THREE.MeshStandardMaterial({ color: 0xc8a030, metalness: 0.55, roughness: 0.35 });
    // Stepped base
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(r * 2.7, 0.32, r * 2.7), stone);
    plinth.position.y = 0.16; g.add(plinth);
    const torus = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.25, r * 1.35, 0.26, 14), stone);
    torus.position.y = 0.45; g.add(torus);
    // Shaft + vertical fluting
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.92, r, h - 1.5, 16), stone);
    shaft.position.y = 0.58 + (h - 1.5) / 2; g.add(shaft);
    const fluteGeo = new THREE.BoxGeometry(0.07, h - 2.1, 0.07);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const f = new THREE.Mesh(fluteGeo, gold);
      f.position.set(Math.cos(a) * r * 0.95, 0.58 + (h - 1.5) / 2, Math.sin(a) * r * 0.95);
      g.add(f);
    }
    // Gilded capital: bell + flared abacus + acanthus leaves
    const bell = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.15, r * 0.92, 0.6, 14), gold);
    bell.position.y = h - 0.62; g.add(bell);
    const abacus = new THREE.Mesh(new THREE.BoxGeometry(r * 2.8, 0.28, r * 2.8), gold);
    abacus.position.y = h - 0.18; g.add(abacus);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.19, 7, 6), gold);
      leaf.position.set(Math.cos(a) * r * 1.1, h - 0.78, Math.sin(a) * r * 1.1);
      leaf.scale.set(0.7, 1.3, 0.55);
      g.add(leaf);
    }
    g.position.set(o.x, o.y || 0, o.z);
    g.rotation.y = o.ry || 0;
    return g;
  }

  // Floor-to-ceiling drapes: a pelmet with two heavy panels gathered at the
  // sides. Hangs flat against a wall, so o.ry faces it into the room.
  _makeCurtain(o) {
    const g = new THREE.Group();
    const h = o.h || 7.5, w = o.w || 4.5;
    const cloth = new THREE.MeshStandardMaterial({ color: o.color || 0xd8c9b4, roughness: 0.85 });
    const gold = new THREE.MeshStandardMaterial({ color: 0xc8a030, metalness: 0.5, roughness: 0.4 });
    const pelmet = new THREE.Mesh(new THREE.BoxGeometry(w + 0.5, 0.55, 0.35), gold);
    pelmet.position.y = h; g.add(pelmet);
    // Two gathered panels, each a few rippled slabs
    [-1, 1].forEach(side => {
      for (let i = 0; i < 3; i++) {
        const pw = w * 0.17;
        const panel = new THREE.Mesh(new THREE.BoxGeometry(pw, h - 0.3, 0.22), cloth);
        panel.position.set(side * (w / 2 - pw * (0.5 + i * 0.85)), (h - 0.3) / 2, i * 0.07);
        panel.rotation.z = side * 0.012 * i;
        g.add(panel);
      }
      // Tieback sash
      const sash = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.075, 6, 12), gold);
      sash.position.set(side * (w / 2 - w * 0.16), h * 0.42, 0.1);
      sash.rotation.y = Math.PI / 2;
      g.add(sash);
    });
    g.position.set(o.x, o.y || 0, o.z);
    g.rotation.y = o.ry || 0;
    return g;
  }

  // Carved marble fireplace with a gilt mantel and a live glow in the hearth
  _makeFireplace(o) {
    const g = new THREE.Group();
    const marble = new THREE.MeshStandardMaterial({ color: 0xd4cabb, roughness: 0.5 });
    const gold = new THREE.MeshStandardMaterial({ color: 0xc8a030, metalness: 0.55, roughness: 0.35 });
    const w = o.w || 4.2, h = o.h || 3.6;
    [-1, 1].forEach(s => {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.75, h, 0.95), marble);
      leg.position.set(s * (w / 2 - 0.38), h / 2, 0); g.add(leg);
    });
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(w, 0.85, 0.95), marble);
    lintel.position.y = h - 0.42; g.add(lintel);
    const mantel = new THREE.Mesh(new THREE.BoxGeometry(w + 0.7, 0.24, 1.25), marble);
    mantel.position.y = h + 0.12; g.add(mantel);
    const trim = new THREE.Mesh(new THREE.BoxGeometry(w - 1.1, 0.16, 1), gold);
    trim.position.set(0, h - 0.42, 0.15); g.add(trim);
    // Dark firebox + glowing embers
    const box = new THREE.Mesh(new THREE.BoxGeometry(w - 1.5, h - 0.9, 0.5),
      new THREE.MeshStandardMaterial({ color: 0x241c18 }));
    box.position.set(0, (h - 0.9) / 2, -0.2); g.add(box);
    const fireMat = new THREE.MeshStandardMaterial({
      color: 0xffb45a, emissive: 0xff7a20, emissiveIntensity: 1.2
    });
    for (let i = 0; i < 4; i++) {
      const flame = new THREE.Mesh(new THREE.SphereGeometry(0.2 + Math.random() * 0.12, 7, 6), fireMat);
      flame.position.set(-0.75 + i * 0.5, 0.35 + Math.random() * 0.25, -0.05);
      flame.scale.y = 1.5;
      g.add(flame);
    }
    // A pair of candlesticks on the mantel
    [-1, 1].forEach(s => {
      const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.1, 0.5, 8), gold);
      stick.position.set(s * (w / 2 - 0.6), h + 0.49, 0); g.add(stick);
      const fl = new THREE.Mesh(new THREE.SphereGeometry(0.1, 7, 6),
        new THREE.MeshStandardMaterial({ color: 0xffe0a0, emissive: 0xffc860, emissiveIntensity: 1.1 }));
      fl.position.set(s * (w / 2 - 0.6), h + 0.8, 0); g.add(fl);
    });
    g.position.set(o.x, o.y || 0, o.z);
    g.rotation.y = o.ry || 0;
    return g;
  }

  // Ornate gilt wall mirror — a bright pale panel in a scrolled gold frame
  _makeMirror(o) {
    const g = new THREE.Group();
    const w = o.w || 2.4, h = o.h || 3.4;
    const gold = new THREE.MeshStandardMaterial({ color: 0xc8a030, metalness: 0.6, roughness: 0.3 });
    const frame = new THREE.Mesh(new THREE.BoxGeometry(w + 0.42, h + 0.42, 0.16), gold);
    g.add(frame);
    // The "glass": a pale, softly lit panel (cheap stand-in for a reflection)
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
      new THREE.MeshStandardMaterial({
        color: 0xb9c6cd, emissive: 0x74889a, emissiveIntensity: 0.22,
        metalness: 0.9, roughness: 0.12
      }));
    glass.position.z = 0.1; g.add(glass);
    // Scrolled crest + corner flourishes
    const crest = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.075, 6, 12, Math.PI), gold);
    crest.position.set(0, h / 2 + 0.3, 0.05); g.add(crest);
    [[-1, 1], [1, 1], [-1, -1], [1, -1]].forEach(([sx, sy]) => {
      const c = new THREE.Mesh(new THREE.SphereGeometry(0.13, 7, 6), gold);
      c.position.set(sx * (w / 2 + 0.12), sy * (h / 2 + 0.12), 0.08);
      g.add(c);
    });
    g.position.set(o.x, o.y !== undefined ? o.y : 4, o.z);
    g.rotation.y = o.ry || 0;
    return g;
  }

  // Gilded console table topped with a flower arrangement — the thing that sits
  // against every spare stretch of wall in these houses
  _makeConsole(o) {
    const g = new THREE.Group();
    const gold = new THREE.MeshStandardMaterial({ color: 0xc8a030, metalness: 0.55, roughness: 0.35 });
    const marble = new THREE.MeshStandardMaterial({ color: 0xd2c8b6, roughness: 0.4 });
    const w = o.w || 2.6;
    const top = new THREE.Mesh(new THREE.BoxGeometry(w, 0.16, 0.85), marble);
    top.position.y = 1.35; g.add(top);
    const apron = new THREE.Mesh(new THREE.BoxGeometry(w - 0.3, 0.26, 0.6), gold);
    apron.position.y = 1.15; g.add(apron);
    [-1, 1].forEach(s => {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.11, 1.28, 8), gold);
      leg.position.set(s * (w / 2 - 0.25), 0.64, 0); g.add(leg);
    });
    // Vase of blooms
    const vase = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.24, 0.5, 10),
      new THREE.MeshStandardMaterial({ color: o.vase || 0x2c3038, roughness: 0.3 }));
    vase.position.y = 1.68; g.add(vase);
    const bloom = [0xe4ded4, 0xd9c2cc, 0xe0d4ae, 0xccd4bd];
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      const f = new THREE.Mesh(new THREE.SphereGeometry(0.15, 7, 6),
        new THREE.MeshStandardMaterial({ color: bloom[i % bloom.length] }));
      f.position.set(Math.cos(a) * 0.24, 2.05 + Math.random() * 0.22, Math.sin(a) * 0.24);
      g.add(f);
    }
    const leaves = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 7),
      new THREE.MeshStandardMaterial({ color: 0x3f7a45 }));
    leaves.position.y = 1.98; leaves.scale.y = 0.6; g.add(leaves);
    g.position.set(o.x, o.y || 0, o.z);
    g.rotation.y = o.ry || 0;
    return g;
  }

  // Button-tufted velvet sofa with rolled arms and scatter cushions
  _makeVelvetSofa(o) {
    const g = new THREE.Group();
    const w = o.w || 4.2;
    const velvet = new THREE.MeshStandardMaterial({ color: o.color || 0x5f7d3a, roughness: 0.85 });
    const gold = new THREE.MeshStandardMaterial({ color: 0xc8a030, metalness: 0.5, roughness: 0.4 });
    const seat = new THREE.Mesh(new THREE.BoxGeometry(w, 0.45, 1.7), velvet);
    seat.position.y = 0.82; g.add(seat);
    const back = new THREE.Mesh(new THREE.BoxGeometry(w, 1.35, 0.4), velvet);
    back.position.set(0, 1.6, -0.68); g.add(back);
    // Tufting buttons across the back
    for (let r = 0; r < 2; r++) {
      for (let i = 0; i < Math.round(w / 0.75); i++) {
        const b = new THREE.Mesh(new THREE.SphereGeometry(0.062, 6, 6), gold);
        b.position.set(-w / 2 + 0.42 + i * 0.75, 1.28 + r * 0.5, -0.47);
        g.add(b);
      }
    }
    [-1, 1].forEach(s => {
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 1.7, 10), velvet);
      arm.rotation.x = Math.PI / 2;
      arm.position.set(s * (w / 2 - 0.12), 1.18, 0.05);
      g.add(arm);
    });
    // Turned feet
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
      const f = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.11, 0.6, 8), gold);
      f.position.set(sx * (w / 2 - 0.28), 0.3, sz * 0.62);
      g.add(f);
    });
    // Scatter cushions
    const cushCols = [0xd8bfc8, 0xe8dcc8, 0x8a7a5a];
    for (let i = 0; i < 3; i++) {
      const c = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.62, 0.2),
        new THREE.MeshStandardMaterial({ color: cushCols[i % cushCols.length], roughness: 0.9 }));
      c.position.set(-w / 3 + i * (w / 3), 1.33, -0.4);
      c.rotation.z = (Math.random() - 0.5) * 0.3;
      g.add(c);
    }
    g.position.set(o.x, o.y || 0, o.z);
    g.rotation.y = o.ry || 0;
    return g;
  }

  // Run of turned balusters under a gilt handrail — the upper-gallery look
  _makeBalustrade(o) {
    const g = new THREE.Group();
    const w = o.w || 6, h = o.h || 1.5;
    const stone = new THREE.MeshStandardMaterial({ color: 0xd2c8b6, roughness: 0.55 });
    const gold = new THREE.MeshStandardMaterial({ color: 0xc8a030, metalness: 0.55, roughness: 0.35 });
    const rail = new THREE.Mesh(new THREE.BoxGeometry(w, 0.18, 0.42), gold);
    rail.position.y = h; g.add(rail);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(w, 0.16, 0.42), stone);
    foot.position.y = 0.08; g.add(foot);
    const n = Math.max(3, Math.round(w / 0.62));
    for (let i = 0; i < n; i++) {
      const bx = -w / 2 + 0.31 + i * (w / n);
      const belly = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 7), stone);
      belly.position.set(bx, h * 0.42, 0); belly.scale.y = 1.5; g.add(belly);
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, h - 0.24, 7), stone);
      stem.position.set(bx, h / 2, 0); g.add(stem);
    }
    g.position.set(o.x, o.y || 0, o.z);
    g.rotation.y = o.ry || 0;
    return g;
  }

  // Grand piano: curved body, raised lid on its stick, keyboard and bench
  _makeGrandPiano(o) {
    const g = new THREE.Group();
    const black = new THREE.MeshStandardMaterial({ color: 0x14141a, roughness: 0.2, metalness: 0.3 });
    const gold = new THREE.MeshStandardMaterial({ color: 0xc8a030, metalness: 0.55, roughness: 0.35 });
    // Body: a wide slab plus a rounded tail
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.5, 3.4), black);
    body.position.y = 1.05; g.add(body);
    const tail = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 0.5, 16, 1, false, 0, Math.PI), black);
    tail.position.set(0, 1.05, 1.7); tail.rotation.y = Math.PI; g.add(tail);
    // Raised lid
    const lid = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.1, 3.3), black);
    lid.position.set(-0.5, 1.75, 0); lid.rotation.z = -0.42; g.add(lid);
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.1, 6), gold);
    stick.position.set(0.85, 1.72, -0.9); stick.rotation.z = 0.2; g.add(stick);
    // Keyboard
    const keys = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.12, 0.42),
      new THREE.MeshStandardMaterial({ color: 0xf7f4ec }));
    keys.position.set(0, 1.34, -1.6); g.add(keys);
    for (let i = 0; i < 14; i++) {
      const bk = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.08, 0.26), black);
      bk.position.set(-1.05 + i * 0.16, 1.42, -1.68); g.add(bk);
    }
    // Legs + bench
    [[-1, -1.3], [1, -1.3], [0, 1.5]].forEach(([sx, sz]) => {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 0.8, 8), black);
      leg.position.set(sx * 1.1, 0.4, sz); g.add(leg);
    });
    const bench = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.16, 0.6),
      new THREE.MeshStandardMaterial({ color: 0x6b2030, roughness: 0.8 }));
    bench.position.set(0, 0.78, -2.6); g.add(bench);
    [-1, 1].forEach(s => {
      const bl = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.78, 7), gold);
      bl.position.set(s * 0.6, 0.39, -2.6); g.add(bl);
    });
    g.position.set(o.x, o.y || 0, o.z);
    g.rotation.y = o.ry || 0;
    return g;
  }

  // Four-poster-scale master bed: tall tufted headboard, damask cover, pillows
  // and a silk runner across the foot
  _makeOrnateBed(o) {
    const g = new THREE.Group();
    const gold = new THREE.MeshStandardMaterial({ color: 0xc8a030, metalness: 0.5, roughness: 0.4 });
    const cream = new THREE.MeshStandardMaterial({ color: 0xd8cfbf, roughness: 0.85 });
    const cover = new THREE.MeshStandardMaterial({ color: o.color || 0xd9d3c4, roughness: 0.9 });
    // Headboard: padded panel + gilt crest
    const head = new THREE.Mesh(new THREE.BoxGeometry(4.4, 3.1, 0.3), cream);
    head.position.set(0, 1.85, -2.6); g.add(head);
    const crest = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.11, 6, 14, Math.PI), gold);
    crest.position.set(0, 3.35, -2.6); g.add(crest);
    for (let r = 0; r < 3; r++) {
      for (let i = 0; i < 5; i++) {
        const b = new THREE.Mesh(new THREE.SphereGeometry(0.062, 6, 6), gold);
        b.position.set(-1.6 + i * 0.8, 1.25 + r * 0.62, -2.43); g.add(b);
      }
    }
    // Mattress + cover
    const base = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.55, 4.8), gold);
    base.position.set(0, 0.45, 0); g.add(base);
    const mat = new THREE.Mesh(new THREE.BoxGeometry(4.3, 0.6, 4.7), cover);
    mat.position.set(0, 1.02, 0); g.add(mat);
    // Pillows
    [-1, 1].forEach(s => {
      const p = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.4, 0.85), cream);
      p.position.set(s * 1.05, 1.5, -1.85); p.rotation.x = -0.16; g.add(p);
      const acc = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.34, 0.5),
        new THREE.MeshStandardMaterial({ color: o.accent || 0xc23b52, roughness: 0.75 }));
      acc.position.set(s * 1.05, 1.62, -1.35); g.add(acc);
    });
    // Silk runner across the foot
    const runner = new THREE.Mesh(new THREE.BoxGeometry(4.35, 0.12, 1.5),
      new THREE.MeshStandardMaterial({ color: o.accent || 0xc23b52, roughness: 0.45, metalness: 0.2 }));
    runner.position.set(0, 1.36, 1.5); g.add(runner);
    g.position.set(o.x, o.y || 0, o.z);
    g.rotation.y = o.ry || 0;
    return g;
  }

  // Arched built-in niche with lit shelves and a few ornaments
  _makeArchShelf(o) {
    const g = new THREE.Group();
    const w = o.w || 2.4, h = o.h || 5;
    const cream = new THREE.MeshStandardMaterial({ color: 0xd2c8b6, roughness: 0.6 });
    const inner = new THREE.MeshStandardMaterial({
      color: 0xc2b7a2, emissive: 0x8d8069, emissiveIntensity: 0.2
    });
    const back = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.16), inner);
    back.position.y = h / 2; g.add(back);
    [-1, 1].forEach(s => {
      const side = new THREE.Mesh(new THREE.BoxGeometry(0.22, h, 0.6), cream);
      side.position.set(s * (w / 2 + 0.1), h / 2, 0.22); g.add(side);
    });
    // Arched head
    const arch = new THREE.Mesh(new THREE.TorusGeometry(w / 2, 0.16, 7, 14, Math.PI), cream);
    arch.position.set(0, h - 0.1, 0.22); g.add(arch);
    // Shelves with little objects
    const objCols = [0xc8a030, 0xdfe4e8, 0x8a3a3a, 0x3a5a8a, 0x3f7a45];
    for (let i = 1; i <= 3; i++) {
      const sy = (h - 1.2) * (i / 4) + 0.3;
      const board = new THREE.Mesh(new THREE.BoxGeometry(w, 0.11, 0.55), cream);
      board.position.set(0, sy, 0.2); g.add(board);
      for (let k = 0; k < 2; k++) {
        const ob = new THREE.Mesh(
          k % 2 ? new THREE.SphereGeometry(0.16, 8, 7) : new THREE.CylinderGeometry(0.12, 0.16, 0.42, 8),
          new THREE.MeshStandardMaterial({ color: objCols[(i + k) % objCols.length], roughness: 0.4 }));
        ob.position.set(-w / 4 + k * (w / 2), sy + 0.28, 0.2);
        g.add(ob);
      }
    }
    g.position.set(o.x, o.y || 0, o.z);
    g.rotation.y = o.ry || 0;
    return g;
  }

  // Potted palm in a glazed urn — the greenery these rooms are always dressed with
  _makePottedPalm(o) {
    const g = new THREE.Group();
    const h = o.h || 3.4;
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.38, 0.95, 12),
      new THREE.MeshStandardMaterial({ color: o.pot || 0x2c3038, roughness: 0.35 }));
    pot.position.y = 0.48; g.add(pot);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.53, 0.07, 6, 14),
      new THREE.MeshStandardMaterial({ color: 0xc8a030, metalness: 0.5, roughness: 0.4 }));
    rim.rotation.x = Math.PI / 2; rim.position.y = 0.94; g.add(rim);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, h * 0.5, 7),
      new THREE.MeshStandardMaterial({ color: 0x6b5230 }));
    trunk.position.y = 0.95 + h * 0.25; g.add(trunk);
    // Fronds fanning out from the crown
    const leafMat = new THREE.MeshStandardMaterial({ color: o.color || 0x3f7a45, side: THREE.DoubleSide });
    const crown = 0.95 + h * 0.5;
    // Two tiers of narrow, drooping fronds — wide flat panels read as green
    // slabs from across a room, thin ones still say "palm"
    for (let tier = 0; tier < 2; tier++) {
      const n = tier ? 7 : 9;
      const len = h * (tier ? 0.34 : 0.5);
      const droop = tier ? -1.15 : -0.78;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + tier * 0.4;
        const frond = new THREE.Mesh(new THREE.PlaneGeometry(0.22, len), leafMat);
        frond.position.set(
          Math.cos(a) * h * 0.11, crown + h * (tier ? 0.24 : 0.14), Math.sin(a) * h * 0.11);
        frond.rotation.set(droop, a, 0);
        g.add(frond);
      }
    }
    g.position.set(o.x, o.y || 0, o.z);
    g.rotation.y = o.ry || 0;
    return g;
  }

  // Gilt wall sconce: a bracket with candle flames, mounted proud of the wall
  _makeSconce(o) {
    const g = new THREE.Group();
    const gold = new THREE.MeshStandardMaterial({ color: 0xc8a030, metalness: 0.6, roughness: 0.3 });
    const glow = new THREE.MeshStandardMaterial({
      color: 0xffe0a0, emissive: 0xffc860, emissiveIntensity: 1.2
    });
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.85, 0.12), gold);
    g.add(plate);
    const arm = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.05, 6, 10, Math.PI), gold);
    arm.rotation.y = Math.PI / 2; arm.position.z = 0.2; g.add(arm);
    [-1, 1].forEach(s => {
      const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.06, 0.22, 8), gold);
      cup.position.set(s * 0.3, 0.28, 0.28); g.add(cup);
      const fl = new THREE.Mesh(new THREE.SphereGeometry(0.12, 7, 6), glow);
      fl.position.set(s * 0.3, 0.5, 0.28); fl.scale.y = 1.35; g.add(fl);
    });
    g.position.set(o.x, o.y !== undefined ? o.y : 5.2, o.z);
    g.rotation.y = o.ry || 0;
    return g;
  }

  // ===== Laundromat props =====

  // 🌀 Front-load washer/dryer: a boxy body with a round glass door showing a
  // tumble of colourful clothes, a control panel, and a coin slot. o.dryer
  // tints it warmer; o.color overrides the body.
  _makeWasher(o) {
    const g = new THREE.Group();
    const W = 1.5, H = 2.0, D = 1.4;
    // Soft pastel bodies (teal washer / warm-grey dryer) rather than pure white
    // — closer to the reference machines and far less glare with many on screen.
    const bodyCol = o.color !== undefined ? o.color : (o.dryer ? 0xd7cfc2 : 0xb8ccd4);
    const body = new THREE.Mesh(new THREE.BoxGeometry(W, H, D),
      new THREE.MeshStandardMaterial({ color: bodyCol, metalness: 0.1, roughness: 0.75 }));
    body.position.y = H / 2;
    g.add(body);
    // Rounded door recess + glass with clothes inside
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.52, 0.16, 20),
      new THREE.MeshStandardMaterial({ color: 0xb8bcc4, metalness: 0.5, roughness: 0.4 }));
    ring.rotation.x = Math.PI / 2;
    ring.position.set(0, H * 0.5, D / 2 + 0.02);
    g.add(ring);
    const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.1, 20),
      new THREE.MeshStandardMaterial({ color: 0x2a3a4a, metalness: 0.2, roughness: 0.15,
        transparent: true, opacity: 0.55 }));
    glass.rotation.x = Math.PI / 2;
    glass.position.set(0, H * 0.5, D / 2 + 0.08);
    g.add(glass);
    // A few bright clothes tumbling behind the glass
    const clothCols = [0xe74c3c, 0x3498db, 0x2ecc71, 0xf1c40f, 0xe91e63];
    for (let i = 0; i < 4; i++) {
      const c = new THREE.Mesh(new THREE.SphereGeometry(0.14 + Math.random() * 0.07, 8, 8),
        new THREE.MeshStandardMaterial({ color: clothCols[i % clothCols.length] }));
      c.position.set((Math.random() - 0.5) * 0.5, H * 0.5 + (Math.random() - 0.5) * 0.5, D / 2 + 0.02);
      c.scale.set(1, 0.7, 0.4);
      g.add(c);
    }
    // Control panel strip + two coloured buttons
    const panel = new THREE.Mesh(new THREE.BoxGeometry(W * 0.94, 0.28, 0.04),
      new THREE.MeshStandardMaterial({ color: 0x3a3f4a }));
    panel.position.set(0, H - 0.28, D / 2 + 0.02);
    g.add(panel);
    [[-0.35, 0x2ecc71], [0.35, 0xe74c3c]].forEach(([bx, bc]) => {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.05, 10),
        new THREE.MeshStandardMaterial({ color: bc, emissive: bc, emissiveIntensity: 0.5 }));
      b.rotation.x = Math.PI / 2;
      b.position.set(bx, H - 0.28, D / 2 + 0.05);
      g.add(b);
    });
    g.position.set(o.x, o.y || 0, o.z);
    g.rotation.y = o.ry || 0;
    return g;
  }

  // 🧺 Laundry basket: a woven tub piled with folded colourful clothes
  _makeLaundryBasket(o) {
    const g = new THREE.Group();
    const r = 0.55, h = 0.75;
    const basket = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.8, h, 16),
      new THREE.MeshStandardMaterial({ color: o.color !== undefined ? o.color : 0xdcdce4, roughness: 0.9 }));
    basket.position.y = h / 2;
    g.add(basket);
    // Mound of laundry poking out the top
    const cols = [0xe74c3c, 0x3498db, 0x2ecc71, 0xf1c40f, 0xe67e22, 0x9b59b6];
    for (let i = 0; i < 5; i++) {
      const cloth = new THREE.Mesh(new THREE.SphereGeometry(0.22 + Math.random() * 0.08, 8, 8),
        new THREE.MeshStandardMaterial({ color: cols[Math.floor(Math.random() * cols.length)] }));
      cloth.position.set((Math.random() - 0.5) * 0.5, h + 0.05 + Math.random() * 0.12, (Math.random() - 0.5) * 0.5);
      cloth.scale.set(1, 0.6, 1);
      g.add(cloth);
    }
    g.position.set(o.x, o.y || 0, o.z);
    g.rotation.y = o.ry || 0;
    return g;
  }

  // 🧷 Folding table topped with neat stacks of folded towels in soft colours
  _makeFoldTable(o) {
    const g = new THREE.Group();
    const w = o.w || 3.2, d = o.d || 1.6, topY = 1.15;
    const wood = new THREE.MeshStandardMaterial({ map: makeWoodTexture('#c9a06a', '#a97f4e') });
    const top = new THREE.Mesh(new THREE.BoxGeometry(w, 0.16, d), wood);
    top.position.y = topY;
    g.add(top);
    const legGeo = new THREE.BoxGeometry(0.14, topY, 0.14);
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
      const leg = new THREE.Mesh(legGeo, wood);
      leg.position.set(sx * (w / 2 - 0.2), topY / 2, sz * (d / 2 - 0.2));
      g.add(leg);
    });
    // Stacks of folded towels (each a few thin coloured slabs)
    const towelCols = [0xe8e8f0, 0x8fd0e8, 0xf2c0d0, 0xc0e8a8, 0xf0d890, 0xd8c0f0];
    const stacks = Math.max(1, Math.floor(w / 1.1));
    for (let s = 0; s < stacks; s++) {
      const sx = -w / 2 + 0.8 + s * (w - 1.6) / Math.max(1, stacks - 1);
      const base = towelCols[Math.floor(Math.random() * towelCols.length)];
      const n = 3 + Math.floor(Math.random() * 3);
      for (let k = 0; k < n; k++) {
        const towel = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.12, 0.5),
          new THREE.MeshStandardMaterial({ color: k % 2 ? base : towelCols[Math.floor(Math.random() * towelCols.length)] }));
        towel.position.set(sx, topY + 0.14 + k * 0.13, (Math.random() - 0.5) * 0.3);
        g.add(towel);
      }
    }
    g.position.set(o.x, o.y || 0, o.z);
    g.rotation.y = o.ry || 0;
    return g;
  }

  // 🧴 Wall shelf lined with detergent bottles + jugs in bright colours
  _makeDetergentShelf(o) {
    const g = new THREE.Group();
    const w = o.w || 3, shelves = 3;
    const frame = new THREE.MeshStandardMaterial({ color: 0xcfd4da });
    const back = new THREE.Mesh(new THREE.BoxGeometry(w, 3.2, 0.12), frame);
    back.position.y = 1.6;
    g.add(back);
    const bottleCols = [0xe74c3c, 0x2980b9, 0x27ae60, 0xf39c12, 0x8e44ad, 0x16a085];
    for (let s = 0; s < shelves; s++) {
      const sy = 0.7 + s * 1.05;
      const board = new THREE.Mesh(new THREE.BoxGeometry(w, 0.1, 0.7), frame);
      board.position.set(0, sy, 0.35);
      g.add(board);
      const per = Math.max(2, Math.floor(w / 0.6));
      for (let i = 0; i < per; i++) {
        const bx = -w / 2 + 0.35 + i * (w - 0.7) / Math.max(1, per - 1);
        const col = bottleCols[(s * per + i) % bottleCols.length];
        const bottle = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.55, 0.28),
          new THREE.MeshStandardMaterial({ color: col }));
        bottle.position.set(bx, sy + 0.33, 0.4);
        g.add(bottle);
        const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.12, 8),
          new THREE.MeshStandardMaterial({ color: 0xffffff }));
        cap.position.set(bx, sy + 0.66, 0.4);
        g.add(cap);
      }
    }
    g.position.set(o.x, o.y || 0, o.z);
    g.rotation.y = o.ry || 0;
    return g;
  }

  // A wide upturned Japanese-style eave roof: a thin wide slab + a low 4-sided
  // pyramid, in the classic teal/green tile colour. Returns a group whose
  // origin is the eave line. Used by pagodas and Japanese houses.
  _makeJRoof(halfW, roofCol) {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: roofCol || 0x2f8f7a, flatShading: true });
    const eave = new THREE.Mesh(new THREE.BoxGeometry(halfW * 2.5, 0.25, halfW * 2.5), mat);
    g.add(eave);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(halfW * 1.7, halfW * 1.1, 4), mat);
    cap.rotation.y = Math.PI / 4;
    cap.position.y = halfW * 0.55 + 0.1;
    g.add(cap);
    // Dark ridge trim under the eave
    const trim = new THREE.Mesh(new THREE.BoxGeometry(halfW * 2.55, 0.12, halfW * 2.55),
      new THREE.MeshStandardMaterial({ color: 0x2a2a30 }));
    trim.position.y = -0.14;
    g.add(trim);
    return g;
  }

  // Multi-tier pagoda tower — the map's landmark. Stacked wooden tiers each
  // capped with an upturned teal roof, topped by a golden finial.
  _makePagoda(o) {
    const g = new THREE.Group();
    const tiers = o.tiers || 5;
    const r0 = o.r || 3.2, tierH = o.tierH || 3;
    const wood = new THREE.MeshStandardMaterial({ map: makeWoodTexture('#7a4f2c', '#5c3a1f') });
    const trim = new THREE.MeshStandardMaterial({ color: 0x8a2f2a });
    const roofCol = o.roof || 0x2f8f7a;
    let y = 0;
    for (let i = 0; i < tiers; i++) {
      const tr = r0 * (1 - i * 0.12);
      const body = new THREE.Mesh(new THREE.BoxGeometry(tr * 1.5, tierH, tr * 1.5), wood);
      body.position.y = y + tierH / 2;
      g.add(body);
      // Red railing band
      const rail = new THREE.Mesh(new THREE.BoxGeometry(tr * 1.7, 0.2, tr * 1.7), trim);
      rail.position.y = y + tierH * 0.15;
      g.add(rail);
      const roof = this._makeJRoof(tr, roofCol);
      roof.position.y = y + tierH;
      g.add(roof);
      y += tierH * 0.92;
    }
    // Golden finial spire
    const gold = new THREE.MeshStandardMaterial({ color: 0xe0b83a, metalness: 0.5, roughness: 0.4 });
    const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.18, r0 * 0.9, 8), gold);
    spire.position.y = y + r0 * 0.45;
    g.add(spire);
    for (let k = 0; k < 3; k++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.28 - k * 0.06, 0.05, 6, 12), gold);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = y + 0.3 + k * 0.3;
      g.add(ring);
    }
    g.position.set(o.x, o.y || 0, o.z);
    g.rotation.y = o.ry || 0;
    return g;
  }

  // Traditional Japanese house: plaster/wood body, dark corner posts, a big
  // overhanging teal roof, and a warm paper-lantern glow at the door
  _makeJapanHouse(o) {
    const g = new THREE.Group();
    const w = o.w || 6, h = o.h || 3.2, d = o.d || 5;
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d),
      new THREE.MeshStandardMaterial({ color: o.color || 0xe8e0d0 }));
    body.position.y = h / 2;
    g.add(body);
    // Dark wooden corner posts + a beam
    const post = new THREE.MeshStandardMaterial({ color: 0x3a2a1e });
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.22, h, 0.22), post);
      p.position.set(sx * w / 2, h / 2, sz * d / 2);
      g.add(p);
    });
    // Sliding-door panels on the front
    const paper = new THREE.MeshStandardMaterial({ color: 0xf2ede0, emissive: 0x554a20, emissiveIntensity: 0.25 });
    for (let i = -1; i <= 1; i++) {
      const panel = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.26, h * 0.6), paper);
      panel.position.set(i * w * 0.28, h * 0.35, d / 2 + 0.02);
      g.add(panel);
    }
    // Big overhanging roof
    const roof = this._makeJRoof(Math.max(w, d) * 0.62, o.roof || 0x2f8f7a);
    roof.position.y = h;
    g.add(roof);
    g.position.set(o.x, o.y || 0, o.z);
    g.rotation.y = o.ry || 0;
    return g;
  }

  // Cherry-blossom (sakura) tree: dark trunk + fluffy pink canopy blobs
  _makeSakura(o) {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.42, 3.2, 7),
      new THREE.MeshStandardMaterial({ color: 0x4a3226 }));
    trunk.position.y = 1.6;
    g.add(trunk);
    const pinks = [0xf7b8d4, 0xf4a0c4, 0xffc9de];
    const n = 5 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      const cr = 1.3 + Math.random() * 1.1;
      const blob = new THREE.Mesh(new THREE.DodecahedronGeometry(cr, 0),
        new THREE.MeshStandardMaterial({ color: pinks[i % pinks.length], flatShading: true }));
      blob.position.set((Math.random() - 0.5) * 3, 3.4 + Math.random() * 1.6, (Math.random() - 0.5) * 3);
      g.add(blob);
    }
    g.position.set(o.x, o.y || 0, o.z);
    g.rotation.y = Math.random() * Math.PI * 2;
    return g;
  }

  // Red torii gate — two pillars, a curved top lintel, and a tie beam
  _makeTorii(o) {
    const g = new THREE.Group();
    const red = new THREE.MeshStandardMaterial({ color: 0xc23b2c });
    const black = new THREE.MeshStandardMaterial({ color: 0x2a2020 });
    const w = o.w || 5, h = o.h || 6, pr = 0.32;
    [-1, 1].forEach(s => {
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(pr, pr * 1.2, h, 10), red);
      pillar.position.set(s * w / 2, h / 2, 0);
      g.add(pillar);
    });
    // Top lintel (kasagi) with a slight upward curve via a wider cap
    const top = new THREE.Mesh(new THREE.BoxGeometry(w + 1.8, 0.5, 0.7), black);
    top.position.y = h;
    g.add(top);
    const kasagi = new THREE.Mesh(new THREE.BoxGeometry(w + 2.4, 0.35, 0.9), red);
    kasagi.position.y = h + 0.35;
    g.add(kasagi);
    // Tie beam (nuki) lower down
    const nuki = new THREE.Mesh(new THREE.BoxGeometry(w + 0.6, 0.4, 0.5), red);
    nuki.position.y = h * 0.78;
    g.add(nuki);
    // Central plaque
    const plaque = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.9, 0.15), black);
    plaque.position.y = h * 0.89;
    g.add(plaque);
    // A gate you walk through: a single union AABB would seal the opening, so
    // keep it decorative (shots + movement pass between the pillars)
    g.userData.noHit = true;
    g.position.set(o.x, o.y || 0, o.z);
    g.rotation.y = o.ry || 0;
    return g;
  }

  // A stone staircase: a run of stepped slabs
  _makeStairs(o) {
    const g = new THREE.Group();
    const steps = o.steps || 8, w = o.w || 8, rise = o.rise || 0.45, run = o.run || 0.9;
    const stone = new THREE.MeshStandardMaterial({ map: makeCobbleTexture(), color: 0xb8b8be });
    for (let i = 0; i < steps; i++) {
      const step = new THREE.Mesh(new THREE.BoxGeometry(w, rise, run * (steps - i)), stone);
      step.position.set(0, rise / 2 + i * rise, (run * (steps - i)) / 2 + i * run - (run * steps) / 2);
      g.add(step);
    }
    g.position.set(o.x, o.y || 0, o.z);
    g.rotation.y = o.ry || 0;
    return g;
  }

  // Hanging paper lantern, warm glow — decorative (shots pass through)
  _makeHangLantern(o) {
    const g = new THREE.Group();
    const col = o.color || 0xd8402a;
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.5, 12),
      new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.6 }));
    g.add(body);
    const capMat = new THREE.MeshStandardMaterial({ color: 0x2a2020 });
    [0.28, -0.28].forEach(cy => {
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.08, 10), capMat);
      cap.position.y = cy;
      g.add(cap);
    });
    const str = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.6, 4), capMat);
    str.position.y = 0.55;
    g.add(str);
    g.userData.noHit = true;
    g.position.set(o.x, o.y !== undefined ? o.y : 4, o.z);
    return g;
  }

  // A per-part paintable material backed by its own canvas texture,
  // so the player can paint brush strokes onto the body surface.
  // size defaults to 256 (local player); remote rigs use a smaller texture
  // since UV painting is resolution-independent and rooms may have 15-20+
  // remote rigs on screen at once (each rig has 12 of these).
  _makePaintableMaterial(size) {
    size = size || 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.MeshStandardMaterial({ map: texture });
    return { material, canvas, ctx, texture };
  }

  // Build one paintable character rig — used for the local player AND remote players.
  // paintSize shrinks the per-part textures for remote rigs (see _makePaintableMaterial).
  _buildRig(paintSize) {
    const mk = () => this._makePaintableMaterial(paintSize);
    const root = new THREE.Group();

    // ── Waist joint: the whole torso (body + shoulders + neck + arms) hangs
    // off this so it can bend forward/back/sideways from the hips. Legs stay
    // on the root so they keep their footing when the torso bends.
    const waist = new THREE.Group();
    waist.position.y = 1.1;
    root.add(waist);

    // Body (relative to waist) — a smooth egg-shaped torso instead of a box
    const bodyP = mk();
    const bodyMesh = new THREE.Mesh(new THREE.SphereGeometry(0.55, 18, 16), bodyP.material);
    bodyMesh.userData.paint = bodyP;
    bodyMesh.scale.set(0.95, 1.28, 0.75);
    bodyMesh.position.y = 0.35; // world ~1.45
    waist.add(bodyMesh);

    // Pelvis blob under the torso, bridging into the legs (shares body paint)
    const pelvis = new THREE.Mesh(new THREE.SphereGeometry(0.36, 14, 12), bodyP.material);
    pelvis.userData.paint = bodyP;
    pelvis.scale.set(1.25, 0.8, 1);
    pelvis.position.y = -0.12;
    waist.add(pelvis);

    // Neck connector between torso and head (shares body paint)
    const neckMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.19, 0.4, 10), bodyP.material);
    neckMesh.userData.paint = bodyP;
    neckMesh.position.y = 1.0;
    waist.add(neckMesh);

    // Shoulders — share the body paint.
    // NOTE: no .clone() here — Object3D.clone() JSON-copies userData and would
    // destroy the live canvas context reference in userData.paint.
    const shoulderGeo = new THREE.SphereGeometry(0.22, 12, 12);
    const shoulderL = new THREE.Mesh(shoulderGeo, bodyP.material);
    shoulderL.userData.paint = bodyP;
    shoulderL.position.set(-0.55, 0.85, 0);
    const shoulderR = new THREE.Mesh(shoulderGeo, bodyP.material);
    shoulderR.userData.paint = bodyP;
    shoulderR.position.set(0.55, 0.85, 0);
    waist.add(shoulderL, shoulderR);

    // ── Neck joint + head (head can tilt independently)
    const neck = new THREE.Group();
    neck.position.y = 1.25; // world ~2.35
    const headP = mk();
    const headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.5, 24, 24), headP.material);
    headMesh.userData.paint = headP;
    this._drawFace(headP);
    neck.add(headMesh);
    waist.add(neck);

    // ── Arms with elbows (attached to the waist so they bend with the torso)
    const armL = this._jointedLimb(-0.65, 0.45, mk, 0.25, 0.55, 0.5, 'hand');
    const armR = this._jointedLimb(0.65, 0.45, mk, 0.25, 0.55, 0.5, 'hand');
    waist.add(armL.pivot, armR.pivot);

    // ── Legs with knees (attached to the root — hips stay planted)
    const legL = this._jointedLimb(-0.25, 0.95, mk, 0.3, 0.55, 0.5, 'foot');
    const legR = this._jointedLimb(0.25, 0.95, mk, 0.3, 0.55, 0.5, 'foot');
    root.add(legL.pivot, legR.pivot);

    // Part order matters: paint strokes are relayed by part INDEX between
    // players — the original 16 stay first; new rounded-body parts append
    const parts = [
      headMesh, bodyMesh, shoulderL, shoulderR,
      armL.upper, armL.lower, armR.upper, armR.lower,
      legL.upper, legL.lower, legR.upper, legR.lower,
      armL.cap, armR.cap, legL.cap, legR.cap,
      pelvis, neckMesh,
      armL.jointBall, armR.jointBall, legL.jointBall, legR.jointBall,
      armL.kneeBall, armR.kneeBall, legL.kneeBall, legR.kneeBall
    ].filter(Boolean);

    return { root, waist, neck, headMesh, bodyMesh, armL, armR, legL, legR, parts };
  }

  _buildCharacter() {
    const rig = this._buildRig();
    this._shade(rig.root);   // players drop shadows too, or they float
    this.rig = rig;
    this.character = rig.root;
    this.headMesh = rig.headMesh;
    this.bodyMesh = rig.bodyMesh;
    this.armL = rig.armL; this.armR = rig.armR;
    this.legL = rig.legL; this.legR = rig.legR;
    this.characterParts = rig.parts;

    const map = GAME_MAPS[this.mapId] || GAME_MAPS.meadow;
    const S = this.mapScale || 1;
    const spawn = map.spawn || [0, 0, 8];
    this.character.position.set(spawn[0] * S, spawn[1], spawn[2] * S);
    // Hiders are small (harder to spot); seekers are big and imposing
    this.character.scale.setScalar(this.isHider ? PLAYER_SCALE.hider : PLAYER_SCALE.seeker);
    this.charHeading = 0;
    this.scene.add(this.character);

    // Seekers carry a rainbow laser gun in the right hand
    if (!this.isHider) this._buildGun();
  }

  // Small sci-fi pistol attached to the right arm so it follows the walk swing
  // Build a rainbow laser pistol mesh. Returns { gun, tip }; the tip is the
  // glowing muzzle (also the beam origin for the local player).
  _makeGunMesh() {
    const gun = new THREE.Group();
    const body = new THREE.MeshStandardMaterial({ color: 0x2e2e3e, metalness: 0.6, roughness: 0.4 });

    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.75, 10), body);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.z = 0.35;

    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.3, 0.16), body);
    grip.position.set(0, -0.18, 0);

    const tip = new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 10, 10),
      new THREE.MeshBasicMaterial({ map: makeRainbowTexture() })
    );
    tip.position.z = 0.75;

    gun.add(barrel, grip, tip);
    gun.position.set(0, -0.6, 0.2); // at the hand (end of the forearm)
    return { gun, tip };
  }

  _buildGun() {
    const { gun, tip } = this._makeGunMesh();
    this.gunTip = tip; // the beam's start point
    this.armR.mid.add(gun);
    this.gun = gun;
  }

  // Give a remote rig the seeker's gun so hiders can see who's armed.
  // Idempotent: adds only when the player is a seeker and has none yet.
  _syncRemoteGun(rp) {
    if (rp.role === 'seeker' && !rp.gun && rp.rig.armR && rp.rig.armR.mid) {
      const { gun } = this._makeGunMesh();
      rp.rig.armR.mid.add(gun);
      rp.gun = gun;
    } else if (rp.role !== 'seeker' && rp.gun) {
      rp.rig.armR.mid.remove(rp.gun);
      rp.gun = null;
    }
  }

  // Draw a friendly face (eyes with pupils + smile + cheeks) onto the head texture
  _drawFace(paint) {
    const ctx = paint.ctx;
    // Eye whites
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 3;
    [[104, 96], [152, 96]].forEach(([x, y]) => {
      ctx.beginPath(); ctx.arc(x, y, 14, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    });
    // Pupils
    ctx.fillStyle = '#222';
    [[107, 99], [155, 99]].forEach(([x, y]) => {
      ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fill();
    });
    // Smile
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(128, 108, 22, 0.25 * Math.PI, 0.75 * Math.PI);
    ctx.stroke();
    // Rosy cheeks
    ctx.fillStyle = 'rgba(240, 130, 130, 0.55)';
    [[86, 112], [170, 112]].forEach(([x, y]) => {
      ctx.beginPath(); ctx.arc(x, y, 8, 0, Math.PI * 2); ctx.fill();
    });
    paint.texture.needsUpdate = true;
  }

  // Create a limb as a pivot group so it swings from the top joint.
  // capType: 'hand' (sphere) or 'foot' (forward box) — shares the limb's paint texture.
  _limb(x, jointY, paint, width = 0.25, length = 1.0, capType = null) {
    const pivot = new THREE.Group();
    pivot.position.set(x, jointY, 0);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, length, width), paint.material);
    mesh.userData.paint = paint;
    mesh.position.y = -length / 2; // hang below the joint
    pivot.add(mesh);

    let cap = null;
    if (capType === 'hand') {
      cap = new THREE.Mesh(new THREE.SphereGeometry(width * 0.72, 12, 12), paint.material);
      cap.position.y = -length - width * 0.3;
    } else if (capType === 'foot') {
      cap = new THREE.Mesh(new THREE.BoxGeometry(width * 1.1, width * 0.6, width * 1.8), paint.material);
      cap.position.set(0, -length - width * 0.2, width * 0.35); // toes forward
    }
    if (cap) {
      cap.userData.paint = paint;
      pivot.add(cap);
    }
    return { pivot, mesh, cap };
  }

  // A two-segment limb with a mid joint (elbow / knee).
  //   pivot = shoulder/hip rotation, mid = elbow/knee rotation.
  // mk() returns a fresh paintable material so each segment can be painted.
  _jointedLimb(x, jointY, mk, width, upperLen, lowerLen, capType) {
    const pivot = new THREE.Group();
    pivot.position.set(x, jointY, 0);

    // Rounded limbs: tapered cylinders instead of boxes, plus a ball at each
    // joint so bends stay smooth and connected (no box gaps) — reads human
    const r1 = width * 0.56, r2 = width * 0.5;

    const upperP = mk();
    const upper = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, upperLen, 10), upperP.material);
    upper.userData.paint = upperP;
    upper.position.y = -upperLen / 2;

    // Shoulder/hip ball at the pivot (shares the upper limb's paint)
    const jointBall = new THREE.Mesh(new THREE.SphereGeometry(r1 * 1.06, 10, 10), upperP.material);
    jointBall.userData.paint = upperP;

    const mid = new THREE.Group(); // elbow / knee
    mid.position.y = -upperLen;

    const lowerP = mk();
    const lower = new THREE.Mesh(new THREE.CylinderGeometry(r2, r2 * 0.88, lowerLen, 10), lowerP.material);
    lower.userData.paint = lowerP;
    lower.position.y = -lowerLen / 2;
    mid.add(lower);

    // Elbow/knee ball fills the crease when the joint bends
    const kneeBall = new THREE.Mesh(new THREE.SphereGeometry(r2 * 1.04, 10, 10), lowerP.material);
    kneeBall.userData.paint = lowerP;
    mid.add(kneeBall);

    let cap = null;
    if (capType === 'hand') {
      const capP = mk();
      cap = new THREE.Mesh(new THREE.SphereGeometry(width * 0.68, 12, 12), capP.material);
      cap.userData.paint = capP;
      cap.position.y = -lowerLen - width * 0.18;
      mid.add(cap);
    } else if (capType === 'foot') {
      const capP = mk();
      // Rounded shoe: a squashed, stretched sphere
      cap = new THREE.Mesh(new THREE.SphereGeometry(width * 0.62, 12, 10), capP.material);
      cap.userData.paint = capP;
      cap.scale.set(1, 0.55, 1.55);
      cap.position.set(0, -lowerLen - width * 0.12, width * 0.28);
      mid.add(cap);
    }

    pivot.add(upper, jointBall, mid);
    return { pivot, mid, upper, lower, cap, jointBall, kneeBall };
  }

  _setupInput() {
    this.raycaster = new THREE.Raycaster();

    window.addEventListener('keydown', (e) => {
      this.keys[e.key.toLowerCase()] = true;
      // Stop space/arrows from scrolling the page while playing
      if (this.gameState === 'playing' && (e.key === ' ' || e.key.startsWith('Arrow'))) {
        e.preventDefault();
      }
      // Number keys switch poses (posing to blend against walls)
      const poseKeys = {
        '1': 'stand', '2': 'spread', '3': 'armsUp', '4': 'crouch', '5': 'flat',
        '6': 'sit', '7': 'ball', '8': 'star', '9': 'fold', '0': 'lie'
      };
      if (poseKeys[e.key]) this.setPose(poseKeys[e.key]);
      // F toggles the color eyedropper (Hider only)
      if (e.key.toLowerCase() === 'f' && this._canPaint()) {
        const on = this.toggleEyedropper();
        if (this.onEyedropperToggle) this.onEyedropperToggle(on);
      }
    });
    window.addEventListener('keyup', (e) => { this.keys[e.key.toLowerCase()] = false; });

    const cv = this.canvas;
    let mode = null; // 'paint' | 'camera'
    let lastX = 0, lastY = 0, downX = 0, downY = 0, moved = false;

    const start = (x, y) => {
      // On a phone your own body fills much of the screen, so auto-painting
      // whatever you drag over made looking around nearly impossible. Touch
      // players paint only after switching paint mode on; mouse is unchanged.
      const paintAllowed = this._canPaint() && (!this.touchDevice || this.paintMode);
      if (paintAllowed && this._hitCharacter(x, y)) {
        mode = 'paint';
        this.beginStroke();
        this._paintAt(x, y);
      } else {
        mode = 'camera';
        this._camDragging = true;
      }
      moved = false;
      lastX = downX = x; lastY = downY = y;
    };
    const move = (x, y) => {
      if (!mode) return;
      if (Math.abs(x - downX) + Math.abs(y - downY) > 6) moved = true;
      if (mode === 'paint') {
        this._paintAt(x, y);
      } else {
        // Thumbs travel less than a mouse, so touch gets a higher turn rate
        const s = this.touchDevice ? 1.7 : 1;
        const dx = x - lastX, dy = y - lastY;
        this.camAngle -= dx * 0.01 * s;
        this.camPitch = Math.max(-0.1, Math.min(1.2, this.camPitch + dy * 0.005 * s));
      }
      lastX = x; lastY = y;
    };
    const end = (x, y) => {
      const cx = x !== undefined ? x : lastX;
      const cy = y !== undefined ? y : lastY;
      if (mode === 'camera' && !moved) {
        if (this.eyedropperMode && this._canPaint()) {
          // Eyedropper mode: click a surface to suck its color
          this._suckColor(cx, cy);
        } else if (!this.isHider) {
          // Seeker: a plain click (no drag) fires the rainbow laser
          this._shootLaser(cx, cy);
        }
      }
      mode = null;
      this._camDragging = false;
    };

    cv.addEventListener('mousedown', (e) => start(e.clientX, e.clientY));
    window.addEventListener('mousemove', (e) => move(e.clientX, e.clientY));
    window.addEventListener('mouseup', (e) => end(e.clientX, e.clientY));

    // Touch: track only fingers ON the canvas (targetTouches) so the on-screen
    // joystick (a separate element) can be held at the same time — you can
    // walk with the left thumb AND look around with the right thumb. One
    // canvas finger drags the camera / paints; two canvas fingers pinch-zoom.
    let pinch = null;
    let camTouchId = null;
    const dist2 = (a, b) => Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    cv.addEventListener('touchstart', (e) => {
      const tt = e.targetTouches; // touches on the canvas only
      if (tt.length >= 2) {
        pinch = { d: dist2(tt[0], tt[1]), cam: this.camDist };
        camTouchId = null;
        mode = null; // cancel any drag/paint in progress
        return;
      }
      const t = e.changedTouches[0];
      camTouchId = t.identifier;
      start(t.clientX, t.clientY);
    }, { passive: true });
    cv.addEventListener('touchmove', (e) => {
      const tt = e.targetTouches;
      if (pinch && tt.length >= 2) {
        const d = dist2(tt[0], tt[1]);
        if (d > 10) this.camDist = Math.max(5, Math.min(26, pinch.cam * (pinch.d / d)));
        e.preventDefault();
        return;
      }
      if (camTouchId === null) return;
      for (const t of e.changedTouches) {
        if (t.identifier === camTouchId) { move(t.clientX, t.clientY); e.preventDefault(); break; }
      }
    }, { passive: false });
    cv.addEventListener('touchend', (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === camTouchId) { end(t.clientX, t.clientY); camTouchId = null; }
      }
      if (e.targetTouches.length < 2) pinch = null;
    }, { passive: true });
    cv.addEventListener('touchcancel', (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === camTouchId) { camTouchId = null; mode = null; this._camDragging = false; }
      }
    }, { passive: true });

    // Mouse wheel zooms the camera in/out
    cv.addEventListener('wheel', (e) => {
      this.camDist = Math.max(5, Math.min(26, this.camDist + e.deltaY * 0.012));
      e.preventDefault();
    }, { passive: false });
  }

  // Screen point -> normalized device coords
  _ndc(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    return new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1
    );
  }

  _hitCharacter(clientX, clientY) {
    this.raycaster.setFromCamera(this._ndc(clientX, clientY), this.camera);
    return this.raycaster.intersectObjects(this.characterParts, false).length > 0;
  }

  // Hiders can always paint; seekers only while waiting out the hide phase
  _canPaint() {
    if (this.gameState !== 'playing') return false;
    return this.isHider || this.getPhase().phase === 'hide';
  }

  // Start a fresh brush stroke (called on pointer-down) so the next paint
  // dot doesn't connect a line back to wherever the last stroke ended.
  beginStroke() { this._lastPaintPoint = null; }

  // Paint on the body-part surface at the hit UV. Dragging interpolates a
  // continuous line from the previous point to this one (same part) so fast
  // drags leave a smooth stroke instead of spaced-out dots.
  _paintAt(clientX, clientY) {
    if (!this._canPaint()) return false;
    this.raycaster.setFromCamera(this._ndc(clientX, clientY), this.camera);
    const hits = this.raycaster.intersectObjects(this.characterParts, false);
    if (!hits.length || !hits[0].uv) { this._lastPaintPoint = null; return false; }

    const partIndex = this.characterParts.indexOf(hits[0].object);
    const paint = hits[0].object.userData.paint;
    const uv = hits[0].uv;
    const px = uv.x * paint.canvas.width;
    const py = (1 - uv.y) * paint.canvas.height;

    const ctx = paint.ctx;
    ctx.fillStyle = this.currentPaintColor;
    ctx.strokeStyle = this.currentPaintColor;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = this.brushSize * 2;

    const prev = this._lastPaintPoint;
    let fromUV = null;
    if (prev && prev.part === partIndex) {
      // Continue the stroke: thick round-capped line fills the gap smoothly
      ctx.beginPath();
      ctx.moveTo(prev.px, prev.py);
      ctx.lineTo(px, py);
      ctx.stroke();
      fromUV = { u: prev.u, v: prev.v };
    }
    // Always cap the current end with a dot (also handles single taps)
    ctx.beginPath();
    ctx.arc(px, py, this.brushSize, 0, Math.PI * 2);
    ctx.fill();
    paint.texture.needsUpdate = true;

    this._lastPaintPoint = { part: partIndex, px, py, u: uv.x, v: uv.y };

    // Relay the stroke (throttled) — include the previous UV so onlookers
    // can draw the same connected line instead of a dotted trail.
    const nowPaint = performance.now();
    const throttled = this._lastPaintBroadcast && (nowPaint - this._lastPaintBroadcast < 80);
    if (this.onPaintStroke && !throttled) {
      this._lastPaintBroadcast = nowPaint;
      const s = {
        i: partIndex,
        u: +uv.x.toFixed(3), v: +uv.y.toFixed(3),
        c: this.currentPaintColor, s: this.brushSize
      };
      if (fromUV) { s.pu = +fromUV.u.toFixed(3); s.pv = +fromUV.v.toFixed(3); }
      this.onPaintStroke(s);
    }

    // Brush swish, throttled so dragging doesn't spam
    const now = performance.now();
    if (typeof soundFX !== 'undefined' && (!this._lastPaintSnd || now - this._lastPaintSnd > 130)) {
      this._lastPaintSnd = now;
      soundFX.paint();
    }
    return true;
  }

  // Seeker fires the rainbow laser toward the clicked point
  _shootLaser(clientX, clientY) {
    // Eliminated players and the monitoring host are spectators — no shooting
    if (this.isHider || this.selfCaught || this.spectator || this.gameState !== 'playing' || !this.gunTip) return;

    this.raycaster.setFromCamera(this._ndc(clientX, clientY), this.camera);

    // Anything except our own character, clouds, and old beams is a valid target
    const skip = new Set(this.characterParts);
    const targets = this.scene.children.filter(c =>
      c !== this.character && !this.clouds.includes(c) && !c.userData.noHit &&
      !this.lasers.some(L => L.beam === c || L.flash === c) &&
      (c.isMesh || c.type === 'Group')
    );
    const hits = this.raycaster.intersectObjects(targets, true)
      .filter(h => !skip.has(h.object));

    // Distance to the nearest SOLID thing (wall/prop) — the shot can't pass it
    let obstacleDist = 80;
    for (const h of hits) {
      if (!this._nodeToPlayerId(h.object)) { obstacleDist = h.distance; break; }
    }

    // Aim assist: snap the shot to the nearest catchable player within a cone
    // of the ray, as long as they're not hidden behind a wall. Makes aiming
    // forgiving — you only need to point roughly at someone.
    const assist = this._aimAssistTarget(this.raycaster.ray, obstacleDist);

    let end, foundPlayerId = null, hitAnimal = false, hitDecoy = null;
    if (assist) {
      end = assist.point;
      foundPlayerId = assist.id;
    } else {
      end = hits.length ? hits[0].point.clone() : this.raycaster.ray.at(80, new THREE.Vector3());
      if (hits.length) {
        let node = hits[0].object;
        while (node) {
          const pid = this._nodeToPlayerId(node);
          if (pid) { foundPlayerId = pid; break; }
          if (this.animatedRoots.includes(node)) {
            hitAnimal = true;
            if (node.userData.decoyId) hitDecoy = node; // a placed decoy, not scenery
            break;
          }
          node = node.parent;
        }
      }
    }

    const start = new THREE.Vector3();
    this.gunTip.getWorldPosition(start);

    // A decoy soaks the shot and is destroyed — on every client, so the seeker
    // who fell for it and everyone else see it drop together. Done before the
    // beam is drawn: a point-blank shot makes a degenerate beam and bails out
    // below, and the decoy must die either way.
    if (hitDecoy) {
      const did = hitDecoy.userData.decoyId;
      this._removeDecoy(hitDecoy);
      this._emitAbility({ id: 'decoyHit', decoyId: did });
    }

    if (!this._spawnBeam(start, end)) {
      if (typeof soundFX !== 'undefined') soundFX.laser();
      if (hitAnimal && typeof soundFX !== 'undefined') soundFX.siren(2);
      return;
    }

    // Relay the shot so every player sees the beam
    if (this.onLaserShot) {
      this.onLaserShot({
        sx: +start.x.toFixed(2), sy: +start.y.toFixed(2), sz: +start.z.toFixed(2),
        ex: +end.x.toFixed(2), ey: +end.y.toFixed(2), ez: +end.z.toFixed(2)
      });
    }

    // Sound: pew! — siren for a caught hider or a living decoy animal
    if (typeof soundFX !== 'undefined') soundFX.laser();
    if (hitAnimal && typeof soundFX !== 'undefined') soundFX.siren(2);
    // Only eliminate hiders during the hunt phase, and not already-caught ones
    // (a direct hit on a fellow seeker must not count as a catch)
    const targetRp = foundPlayerId ? this.remotePlayers.get(foundPlayerId) : null;
    if (foundPlayerId && targetRp && targetRp.role === 'hider' &&
        !targetRp.spectator && !targetRp.away &&
        this.canCatch() && !this.caughtPlayers.has(foundPlayerId)) {
      if (typeof soundFX !== 'undefined') soundFX.siren(3);
      if (this.onPlayerFound) this.onPlayerFound(foundPlayerId);
    }

    // Face the shot direction
    this.charHeading = Math.atan2(end.x - this.character.position.x, end.z - this.character.position.z);
    this.character.rotation.y = this.charHeading;
  }

  // Colour the crosshair red while a catchable target is under the aim cone,
  // giving the seeker a clear lock indicator (throttled to ~every 3rd frame).
  _updateAimLock() {
    if (this.isHider || this.spectator || !this.gunTip) return;
    this._aimTick = (this._aimTick || 0) + 1;
    if (this._aimTick % 3 !== 0) return;
    const ch = this._crosshairEl || (this._crosshairEl = document.getElementById('crosshair'));
    if (!ch) return;
    if (this.selfCaught) {
      // Dead seekers can't shoot, so never show the lock indicator
      if (this._aimLocked) { this._aimLocked = false; ch.classList.remove('locked'); }
      return;
    }
    // Aim from screen centre (where mobile fires; a good hint for desktop too)
    const rect = this.canvas.getBoundingClientRect();
    this.raycaster.setFromCamera(
      this._ndc(rect.left + rect.width / 2, rect.top + rect.height * 0.45),
      this.camera
    );
    const assist = this.canCatch() ? this._aimAssistTarget(this.raycaster.ray, 80) : null;
    const locked = !!assist;

    // No ring is drawn over the target. It used to mark exactly which player
    // the next shot would take, which handed seekers a free "there they are" —
    // the whole game is supposed to be spotting a hider yourself. The crosshair
    // still shifts on lock, so aiming stays readable on touch.
    if (locked !== this._aimLocked) {
      this._aimLocked = locked;
      ch.classList.toggle('locked', locked);
      if (locked && typeof soundFX !== 'undefined') soundFX.lock();
    }
  }

  // Walk up from a hit mesh to see if it belongs to a remote player; returns id or null
  _nodeToPlayerId(node) {
    while (node) {
      for (const [pid, rp] of this.remotePlayers) {
        if (rp.rig.root === node) return pid;
      }
      node = node.parent;
    }
    return null;
  }

  // Find the nearest catchable player within an angular cone of a ray, not
  // blocked by a wall closer than them. Returns { id, point } or null.
  _aimAssistTarget(ray, maxDist) {
    // Generous "slop" around the beam line so you only need to point roughly
    // at someone. Grows with distance so far targets stay reachable.
    // Touch players fire down the middle of the screen and steer with a thumb,
    // so they get a wider cone and a gentler camouflage penalty than someone
    // who can click a target outright with a mouse. Camouflage still matters —
    // it just can't make a phone unplayable.
    const ASSIST_RADIUS = this.touchDevice ? 4.8 : 3.2;
    const CAMO_BITE = this.touchDevice ? 0.55 : 0.9;
    let bestId = null, bestPoint = null, bestScore = Infinity;
    const bodyW = new THREE.Vector3();
    const closest = new THREE.Vector3();
    for (const [pid, rp] of this.remotePlayers) {
      // Only hiders are catchable — never snap onto fellow seekers
      // Skip players who dropped out — their slot is held for a rejoin, so
      // catching an absent player would be a free kill
      if (rp.role !== 'hider' || rp.away || this.caughtPlayers.has(pid) || !rp.rig.root.visible) continue;
      rp.rig.bodyMesh.getWorldPosition(bodyW);
      const t = bodyW.clone().sub(ray.origin).dot(ray.direction);
      if (t <= 0 || t > Math.min(maxDist + 0.5, 80)) continue; // behind us / behind a wall
      closest.copy(ray.origin).add(ray.direction.clone().multiplyScalar(t));
      const perp = closest.distanceTo(bodyW);
      // Camouflage pays off here: the better a hider matches what they're
      // standing against, the less the aim assist reaches for them. Blend it
      // perfectly and the seeker has to actually click you.
      const blend = this._blendAt(this._bodyPaintColor(rp.rig.bodyMesh), bodyW);
      const radius = (ASSIST_RADIUS + t * 0.045) * (1 - blend * CAMO_BITE);
      if (perp < radius && perp < bestScore) {
        bestScore = perp; bestId = pid; bestPoint = bodyW.clone();
      }
    }
    return bestId ? { id: bestId, point: bestPoint } : null;
  }

  // Draw a rainbow beam + impact flash between two world points (shared by
  // the local shot and shots relayed from other players). Returns false on
  // degenerate/NaN geometry.
  _spawnBeam(start, end) {
    const dir = end.clone().sub(start);
    const len = dir.length();
    if (!isFinite(len) || len < 0.05) return false;

    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.16, len, 8, 1, true),
      new THREE.MeshBasicMaterial({
        map: makeRainbowTexture(),
        transparent: true,
        opacity: 1,
        depthWrite: false,
        side: THREE.DoubleSide
      })
    );
    beam.position.copy(start).add(end).multiplyScalar(0.5);
    beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());

    const flash = new THREE.Mesh(
      new THREE.SphereGeometry(0.35, 10, 10),
      new THREE.MeshBasicMaterial({
        color: 0xffffff, transparent: true, opacity: 1,
        blending: THREE.AdditiveBlending, depthWrite: false
      })
    );
    flash.position.copy(end);

    this.scene.add(beam, flash);
    this.lasers.push({ beam, flash, ttl: 0.4, max: 0.4 });
    return true;
  }

  // A remote player fired — show their beam here too
  showRemoteLaser(d) {
    if (!d || !this.scene) return;
    this._spawnBeam(
      new THREE.Vector3(d.sx, d.sy, d.sz),
      new THREE.Vector3(d.ex, d.ey, d.ez)
    );
    if (typeof soundFX !== 'undefined') soundFX.laser();
  }

  // ===== Mobile control hooks =====
  setMoveInput(x, z) { this.moveInput = (x || z) ? { x, z } : null; }
  requestJump() { this.jumpRequested = true; }
  // Hold state for the mobile jump/climb button (held = keep climbing)
  setJumpHeld(v) { this._jumpHeld = v; if (v) this.jumpRequested = true; }
  rotateCamera(delta) { this.camAngle += delta; }
  zoomCamera(delta) { this.camDist = Math.max(5, Math.min(26, this.camDist + delta)); }
  // Seeker fires straight ahead (screen centre) — for a mobile shoot button
  shootCenter() {
    const rect = this.canvas.getBoundingClientRect();
    this._shootLaser(rect.left + rect.width / 2, rect.top + rect.height * 0.45);
  }

  setPaintColor(color) {
    this.currentPaintColor = color;
  }

  setBrushSize(size) {
    this.brushSize = size;
  }

  // ===== Eyedropper: suck a color from any world surface =====
  toggleEyedropper(force) {
    this.eyedropperMode = force !== undefined ? force : !this.eyedropperMode;
    return this.eyedropperMode;
  }

  // Click point -> sample the color of the hit surface (texture pixel or material color)
  _suckColor(clientX, clientY) {
    this.raycaster.setFromCamera(this._ndc(clientX, clientY), this.camera);
    const skip = new Set(this.characterParts);
    const targets = this.scene.children.filter(c =>
      c !== this.character && !this.clouds.includes(c) && !c.userData.noHit &&
      (c.isMesh || c.type === 'Group')
    );
    const hits = this.raycaster.intersectObjects(targets, true)
      .filter(h => !skip.has(h.object));
    if (!hits.length) return null;

    const hex = this._sampleHitColor(hits[0]);
    if (hex) {
      this.currentPaintColor = hex;
      this.eyedropperMode = false;
      if (typeof soundFX !== 'undefined') soundFX.suck();
      if (this.onColorSucked) this.onColorSucked(hex);
    }
    return hex;
  }

  // Read the pixel color at the hit UV (works for canvas/image textures), else material color
  _sampleHitColor(hit) {
    const mat = hit.object.material;
    const map = mat && mat.map;
    if (map && map.image && hit.uv) {
      try {
        const img = map.image;
        const w = img.width, h = img.height;
        // Wrap UV into 0..1 (textures repeat across big surfaces)
        const u = ((hit.uv.x % 1) + 1) % 1;
        const v = ((hit.uv.y % 1) + 1) % 1;
        const cv = this._pickCanvas || (this._pickCanvas = document.createElement('canvas'));
        cv.width = 1; cv.height = 1;
        const ctx = cv.getContext('2d');
        ctx.clearRect(0, 0, 1, 1);
        ctx.drawImage(img, Math.min(w - 1, Math.floor(u * w)), Math.min(h - 1, Math.floor((1 - v) * h)), 1, 1, 0, 0, 1, 1);
        const d = ctx.getImageData(0, 0, 1, 1).data;
        if (d[3] > 0) {
          return '#' + [d[0], d[1], d[2]].map(x => x.toString(16).padStart(2, '0')).join('');
        }
      } catch (e) { /* fall through to material color */ }
    }
    if (mat && mat.color) return '#' + mat.color.getHexString();
    return null;
  }

  // Fill the whole body with one color (quick camouflage base coat)
  paintAll(color) {
    const c = color || this.currentPaintColor;
    this.characterParts.forEach(m => {
      const p = m.userData.paint;
      if (!p) return;
      p.ctx.fillStyle = c;
      p.ctx.fillRect(0, 0, p.canvas.width, p.canvas.height);
      if (m === this.headMesh) this._drawFace(p);
      p.texture.needsUpdate = true;
    });
    if (this.onPaintStroke) this.onPaintStroke({ fill: true, c });
  }

  clearPaint() {
    this.characterParts.forEach(m => {
      const p = m.userData.paint;
      p.ctx.fillStyle = '#ffffff';
      p.ctx.fillRect(0, 0, p.canvas.width, p.canvas.height);
      if (m === this.headMesh) this._drawFace(p);
      p.texture.needsUpdate = true;
    });
    if (this.onPaintStroke) this.onPaintStroke({ clear: true });
  }

  // ===== Remote players (multiplayer presence) =====

  // Floating name tag above a remote player's head
  _makeNameTag(name) {
    const cv = document.createElement('canvas');
    cv.width = 256; cv.height = 64;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.fillRect(0, 0, 256, 64);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 30px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(name).slice(0, 14), 128, 34);
    const tex = new THREE.CanvasTexture(cv);
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
    spr.scale.set(2.6, 0.65, 1);
    return spr;
  }

  addRemotePlayer(id, username, role) {
    if (this.remotePlayers.has(id) || !this.scene) return;
    // Smaller paint textures for remote rigs — rooms can have 15-20+ other
    // players on screen at once, and UV painting looks fine at lower res.
    const rig = this._buildRig(96);
    rig.root.visible = false; // shown on the first position update
    // Match the role-based body scale used for the local player
    rig.root.scale.setScalar(role === 'seeker' ? PLAYER_SCALE.seeker : PLAYER_SCALE.hider);
    this._shade(rig.root);
    const tag = this._makeNameTag(username || 'Player');
    tag.position.y = 3.2;
    tag.castShadow = false;          // a floating name shouldn't cast one
    rig.root.add(tag);
    this.scene.add(rig.root);
    const rp = {
      rig, tag, role: role || 'hider', username: username || 'Player',
      target: null, pose: 'stand', walkPhase: 0, gun: null
    };
    this.remotePlayers.set(id, rp);
    this._syncRemoteGun(rp); // seekers carry a visible gun
  }

  // Receive a movement update {x, z, ry, pose, jumpY} for a remote player
  updateRemotePlayer(id, data, username, role) {
    if (!data) return;
    if (!this.remotePlayers.has(id)) this.addRemotePlayer(id, username, role);
    const rp = this.remotePlayers.get(id);
    if (!rp) return;
    if (role && role !== rp.role) { rp.role = role; this._syncRemoteGun(rp); }
    rp.target = data;
    if (!rp.rig.root.visible) {
      rp.rig.root.visible = true;
      rp.rig.root.position.set(data.x || 0, 0, data.z || 0);
    }
    const pose = data.pose || 'stand';
    if (pose !== rp.pose) {
      rp.pose = pose;
      this._applyPose(pose, rp.rig);
    }
  }

  removeRemotePlayer(id) {
    const rp = this.remotePlayers.get(id);
    if (rp) {
      this.scene.remove(rp.rig.root);
      this.remotePlayers.delete(id);
    }
  }

  // ===== Teacher overview =====
  // The host runs the session but only ever saw their own first-person view.
  // This lifts the camera over the whole stage and pins a marker on every
  // player (red = seeker, green = hider, grey = dropped) so they can see who
  // is stuck, who is hiding where, and narrate the round.
  setOverview(on) {
    this.overviewOn = !!on;
    // The overview camera sits far higher than any map's fog reaches, so the
    // whole floor greyed out into the fog. Lift the fog while overviewing and
    // put it back when the host drops into play.
    if (this.scene) {
      if (on) {
        if (this.scene.fog && !this._savedFog) this._savedFog = this.scene.fog;
        this.scene.fog = null;
      } else if (this._savedFog) {
        this.scene.fog = this._savedFog;
        this._savedFog = null;
      }
    }
    if (!on) this._clearOverviewMarkers();
    return this.overviewOn;
  }

  // Host monitor mode: the creator steps out of the match to watch it from
  // above. Their character leaves the stage (here and, via the broadcast, on
  // everyone else's screen), so they can't be shot or counted, and the whole
  // player-facing HUD is dropped in favour of a clean overview + dashboard.
  setMonitor(on) {
    on = !!on;
    const changed = this.spectator !== on;
    this.spectator = on;
    this.setOverview(on);                        // lift the camera + player markers
    if (this.character) this.character.visible = !on;
    this.setMoveInput(0, 0);
    if (on) {
      // Clear any lingering aim UI
      const ch = document.getElementById('crosshair');
      if (ch) ch.classList.remove('locked');
    }
    // Only tell the room when it actually flips, so per-round engine rebuilds
    // don't spam a redundant "still not spectating" to everyone
    if (changed && this.onSpectator) this.onSpectator(on);
    return this.spectator;
  }

  // Another client's host went into (or out of) monitor mode — take their
  // character off our stage so nobody wastes shots on the teacher.
  setRemoteSpectator(id, on) {
    const rp = this.remotePlayers.get(id);
    if (!rp) return;
    rp.spectator = !!on;
    rp.rig.root.visible = !on;
    if (rp.tag) rp.tag.visible = !on;
  }

  _clearOverviewMarkers() {
    (this._ovMarks || []).forEach(m => {
      this.scene && this.scene.remove(m);
      if (m.geometry) m.geometry.dispose();
      if (m.material) m.material.dispose();
    });
    this._ovMarks = [];
  }

  _updateOverviewMarkers() {
    if (!this.scene) return;
    const want = [];
    // The monitoring host isn't a player on the stage, so no marker for them
    if (!this.spectator) {
      want.push({ pos: this.character.position, role: this.isHider ? 'hider' : 'seeker', away: false });
    }
    this.remotePlayers.forEach(rp => {
      if (!rp.rig.root.visible || rp.spectator) return;
      want.push({ pos: rp.rig.root.position, role: rp.role, away: !!rp.away });
    });

    this._ovMarks = this._ovMarks || [];
    // Grow/shrink the marker pool to match the player count
    while (this._ovMarks.length < want.length) {
      const m = new THREE.Mesh(
        new THREE.SphereGeometry(0.9, 10, 10),
        new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false, transparent: true, opacity: 0.95 })
      );
      m.renderOrder = 998;
      m.userData.noHit = true;
      this.scene.add(m);
      this._ovMarks.push(m);
    }
    while (this._ovMarks.length > want.length) {
      const m = this._ovMarks.pop();
      this.scene.remove(m);
      if (m.geometry) m.geometry.dispose();
      if (m.material) m.material.dispose();
    }
    want.forEach((w, i) => {
      const m = this._ovMarks[i];
      m.position.set(w.pos.x, w.pos.y + 5.5, w.pos.z);
      m.material.color.setHex(w.away ? 0x8a8a94 : (w.role === 'seeker' ? 0xff3b30 : 0x2ecc71));
    });
  }

  // A player who dropped out: fade them and stop treating them as a target
  // while their slot is held open for a rejoin.
  setRemoteAway(id, away) {
    const rp = this.remotePlayers.get(id);
    if (!rp) return;
    rp.away = !!away;
    rp.rig.parts.forEach(m => {
      if (!m.material) return;
      m.material.transparent = !!away;
      m.material.opacity = away ? 0.3 : 1;
      m.material.needsUpdate = true;
    });
    if (rp.tag) rp.tag.visible = !away;
  }

  // Mirror another player's ability so it actually works against us:
  // an invisible hider really does fade out on our screen, a disguised one
  // really does look like a barrel, and their decoy really is shootable.
  applyRemoteAbility(id, data) {
    if (!data) return;
    const rp = this.remotePlayers.get(id);

    if (data.id === 'decoy') {
      this._spawnRemoteDecoy(rp, data);
      return;
    }
    // Somebody shot a decoy — drop it here too
    if (data.id === 'decoyHit') {
      const root = this.decoys.find(d => d.userData.decoyId === data.decoyId);
      if (root) {
        this._removeDecoy(root);
        if (typeof soundFX !== 'undefined') soundFX.siren(2);
      }
      return;
    }
    if (!rp) return;

    if (data.id === 'invisible') {
      const o = data.on ? 0.12 : 1;
      rp.rig.parts.forEach(m => {
        if (!m.material) return;
        m.material.transparent = o < 1;
        m.material.opacity = o;
        m.material.needsUpdate = true;
      });
      // The floating name tag would give them away instantly
      if (rp.tag) rp.tag.visible = !data.on;
      rp.invisible = !!data.on;

    } else if (data.id === 'disguise') {
      if (data.on) {
        if (rp.disguise) rp.rig.root.remove(rp.disguise);
        const prop = this._makePropDisguise(data.kind || 'barrel');
        if (!prop) return;
        rp.rig.root.add(prop);
        rp.disguise = prop;
        rp.rig.parts.forEach(m => { m.visible = false; });
        if (rp.tag) rp.tag.visible = false;
      } else {
        if (rp.disguise) { rp.rig.root.remove(rp.disguise); rp.disguise = null; }
        rp.rig.parts.forEach(m => { m.visible = true; });
        if (rp.tag) rp.tag.visible = true;
      }
    }
  }

  // Build another player's decoy locally, wearing whatever camouflage we've
  // seen them paint on, and register it as a shootable living target.
  _spawnRemoteDecoy(rp, data) {
    if (!this.scene) return;
    const rig = this._buildRig(96);
    const root = rig.root;
    root.userData.decoyId = data.decoyId; // matches the owner's, so hits sync
    root.scale.setScalar(rp && rp.role === 'seeker' ? PLAYER_SCALE.seeker : PLAYER_SCALE.hider);
    root.position.set(data.x || 0, data.y || 0, data.z || 0);
    root.rotation.y = data.ry || 0;
    if (rp) {
      rp.rig.parts.forEach((src, i) => {
        const dst = rig.parts[i];
        if (!dst || !src.userData.paint || !dst.userData.paint) return;
        const sp = src.userData.paint, dp = dst.userData.paint;
        try {
          dp.ctx.drawImage(sp.canvas, 0, 0, dp.canvas.width, dp.canvas.height);
          dp.texture.needsUpdate = true;
        } catch (e) { /* leave it plain */ }
      });
    }
    this._applyPose(data.pose || 'stand', rig);
    this.scene.add(root);
    this.decoys.push(root);
    this.animatedRoots.push(root); // shooting it trips the siren, same as ours
  }

  // Apply a relayed paint stroke to a remote player's body
  paintRemote(id, stroke) {
    const rp = this.remotePlayers.get(id);
    if (!rp || !stroke) return;
    const redraw = (m, fn) => {
      const p = m.userData.paint;
      if (!p) return;
      fn(p);
      if (m === rp.rig.headMesh) this._drawFace(p);
      p.texture.needsUpdate = true;
    };
    if (stroke.fill) {
      rp.rig.parts.forEach(m => redraw(m, p => {
        p.ctx.fillStyle = stroke.c;
        p.ctx.fillRect(0, 0, p.canvas.width, p.canvas.height);
      }));
      return;
    }
    if (stroke.clear) {
      rp.rig.parts.forEach(m => redraw(m, p => {
        p.ctx.fillStyle = '#ffffff';
        p.ctx.fillRect(0, 0, p.canvas.width, p.canvas.height);
      }));
      return;
    }
    const mesh = rp.rig.parts[stroke.i];
    if (!mesh || !mesh.userData.paint) return;
    const p = mesh.userData.paint;
    // stroke.s was measured against the sender's 256px canvas — scale the
    // brush radius to whatever size this rig's canvas actually is
    const brushR = stroke.s * (p.canvas.width / 256);
    const cx = stroke.u * p.canvas.width, cy = (1 - stroke.v) * p.canvas.height;
    p.ctx.fillStyle = stroke.c;
    // Connected line from the sender's previous point, if provided, so remote
    // strokes are as smooth as the painter's own
    if (stroke.pu !== undefined && stroke.pv !== undefined) {
      p.ctx.strokeStyle = stroke.c;
      p.ctx.lineCap = 'round';
      p.ctx.lineWidth = brushR * 2;
      p.ctx.beginPath();
      p.ctx.moveTo(stroke.pu * p.canvas.width, (1 - stroke.pv) * p.canvas.height);
      p.ctx.lineTo(cx, cy);
      p.ctx.stroke();
    }
    p.ctx.beginPath();
    p.ctx.arc(cx, cy, brushR, 0, Math.PI * 2);
    p.ctx.fill();
    p.texture.needsUpdate = true;
  }

  // Smoothly move remote players toward their latest reported state.
  // With up to ~39 remote rigs, far-away players get a cheaper update:
  // position still lerps, but limb swing is skipped and the name tag hides.
  _updateRemotePlayers(dt) {
    const POSE_Y = { crouch: -0.5, sit: -0.55, ball: -0.55, lie: 0.35, kneel: -0.55 };
    const me = this.character ? this.character.position : null;
    this.remotePlayers.forEach(rp => {
      if (!rp.target || !rp.rig.root.visible) return;
      const r = rp.rig.root;
      const tx = Number(rp.target.x) || 0, tz = Number(rp.target.z) || 0;
      const dx = tx - r.position.x;
      const dz = tz - r.position.z;
      const dist = Math.hypot(dx, dz);
      const k = Math.min(1, dt * 10);
      r.position.x += dx * k;
      r.position.z += dz * k;
      r.position.y = (POSE_Y[rp.pose] || 0) + (rp.target.jumpY || 0);
      let turn = (rp.target.ry || 0) - r.rotation.y;
      turn = Math.atan2(Math.sin(turn), Math.cos(turn));
      r.rotation.y += turn * k;

      // Distance LOD relative to the local player
      const far = me
        ? (Math.abs(r.position.x - me.x) + Math.abs(r.position.z - me.z)) > 55
        : false;
      if (rp.tag) rp.tag.visible = !far;

      // Walk swing while they're moving (only in the neutral pose, only nearby)
      if (rp.pose === 'stand' && !far) {
        if (dist > 0.2) {
          rp.walkPhase += dt * 9;
          const swing = Math.sin(rp.walkPhase) * 0.6;
          rp.rig.armL.pivot.rotation.x = swing;
          rp.rig.armR.pivot.rotation.x = -swing;
          rp.rig.legL.pivot.rotation.x = -swing;
          rp.rig.legR.pivot.rotation.x = swing;
          // Same elbow/knee flex + hip twist as the local walk
          const flex = Math.max(0, Math.sin(rp.walkPhase)) * 0.5;
          const flexN = Math.max(0, -Math.sin(rp.walkPhase)) * 0.5;
          rp.rig.armL.mid.rotation.x = 0.18 + flex;
          rp.rig.armR.mid.rotation.x = 0.18 + flexN;
          rp.rig.legL.mid.rotation.x = flexN;
          rp.rig.legR.mid.rotation.x = flex;
          rp.rig.waist.rotation.y = Math.sin(rp.walkPhase) * 0.12;
        } else {
          [rp.rig.armL, rp.rig.armR, rp.rig.legL, rp.rig.legR]
            .forEach(l => { l.pivot.rotation.x *= 0.85; l.mid.rotation.x *= 0.85; });
          rp.rig.waist.rotation.y *= 0.85;
        }
      }
    });
  }

  // ===== Posing (blend against walls / objects) =====
  setPose(name) {
    this.currentPose = name;
    this._applyPose(name);
    if (typeof soundFX !== 'undefined') soundFX.whoosh();
  }

  _applyPose(name, rig) {
    const r = rig || this.rig;
    const c = r.root;
    const waist = r.waist, neck = r.neck;
    const aL = r.armL, aR = r.armR; // { pivot: shoulder, mid: elbow }
    const lL = r.legL, lR = r.legR; // { pivot: hip, mid: knee }

    // Reset every joint to a neutral baseline first
    c.rotation.set(0, 0, 0);
    c.position.y = 0;
    waist.rotation.set(0, 0, 0);
    neck.rotation.set(0, 0, 0);
    [aL, aR, lL, lR].forEach(j => { j.pivot.rotation.set(0, 0, 0); j.mid.rotation.set(0, 0, 0); });

    switch (name) {
      case 'spread': // arms straight out to the sides
        aL.pivot.rotation.z = 1.5; aR.pivot.rotation.z = -1.5;
        break;
      case 'armsUp': // arms raised overhead
        aL.pivot.rotation.z = 2.9; aR.pivot.rotation.z = -2.9;
        break;
      case 'crouch': // squat: bend knees + lean torso forward
        c.position.y = -0.5;
        lL.pivot.rotation.x = -0.9; lL.mid.rotation.x = 1.7;
        lR.pivot.rotation.x = -0.9; lR.mid.rotation.x = 1.7;
        waist.rotation.x = 0.35;
        aL.pivot.rotation.x = 0.4; aR.pivot.rotation.x = 0.4;
        break;
      case 'flat': // lean back flush against a wall, arms spread
        waist.rotation.x = -0.45;
        aL.pivot.rotation.z = 1.5; aR.pivot.rotation.z = -1.5;
        break;
      case 'sit': // sit on the ground, knees up, feet planted
        c.position.y = -0.55;
        lL.pivot.rotation.x = -1.5; lL.mid.rotation.x = 1.8;
        lR.pivot.rotation.x = -1.5; lR.mid.rotation.x = 1.8;
        aL.pivot.rotation.x = -0.4; aR.pivot.rotation.x = -0.4;
        break;
      case 'ball': // curl up small — torso folds, knees tuck to chest
        c.position.y = -0.55;
        waist.rotation.x = 0.9;
        neck.rotation.x = 0.5;
        lL.pivot.rotation.x = -1.6; lL.mid.rotation.x = 2.0;
        lR.pivot.rotation.x = -1.6; lR.mid.rotation.x = 2.0;
        aL.pivot.rotation.x = 1.3; aL.mid.rotation.x = 1.3;
        aR.pivot.rotation.x = 1.3; aR.mid.rotation.x = 1.3;
        break;
      case 'lean': // tilt sideways
        c.rotation.z = 0.35;
        aL.pivot.rotation.z = 0.9; aR.pivot.rotation.z = -0.4;
        break;
      case 'wave': // one arm raised, elbow bent in a wave
        aR.pivot.rotation.z = -2.5; aR.mid.rotation.z = -0.7;
        aL.pivot.rotation.z = 0.15;
        break;
      case 'fold': // bow forward at the waist (legs stay planted!)
        waist.rotation.x = 1.35;
        neck.rotation.x = 0.4;
        aL.pivot.rotation.x = 0.35; aR.pivot.rotation.x = 0.35;
        break;
      case 'star': // star jump — arms and legs spread into an X
        aL.pivot.rotation.z = 2.1; aR.pivot.rotation.z = -2.1;
        lL.pivot.rotation.z = -0.5; lR.pivot.rotation.z = 0.5;
        break;
      case 'lie': // lie flat on the ground, stretched out
        c.rotation.x = -Math.PI / 2;
        c.position.y = 0.35;
        break;
      case 'handsHead': // hands on the head (elbows out and bent)
        aL.pivot.rotation.z = 1.6; aL.mid.rotation.x = 2.1;
        aR.pivot.rotation.z = -1.6; aR.mid.rotation.x = 2.1;
        break;
      case 'warrior': // lunge: front knee bent, arms out to the sides
        lL.pivot.rotation.x = -0.7; lL.mid.rotation.x = 1.2;
        lR.pivot.rotation.x = 0.5;
        aL.pivot.rotation.z = 1.5; aR.pivot.rotation.z = -1.5;
        waist.rotation.x = 0.12;
        break;
      case 'kneel': // kneel down, sitting back on the heels
        c.position.y = -0.55;
        lL.pivot.rotation.x = -0.25; lL.mid.rotation.x = 2.5;
        lR.pivot.rotation.x = -0.25; lR.mid.rotation.x = 2.5;
        break;
      case 'stand':
      default:
        break;
    }
  }

  _updateMovement(dt) {
    // The monitoring host doesn't have a character on the stage to move
    if (this.spectator) return;
    let mx = 0, mz = 0;
    if (this.keys['w'] || this.keys['arrowup']) mz -= 1;
    if (this.keys['s'] || this.keys['arrowdown']) mz += 1;
    if (this.keys['a'] || this.keys['arrowleft']) mx -= 1;
    if (this.keys['d'] || this.keys['arrowright']) mx += 1;

    // On-screen joystick (mobile) adds to the movement vector
    if (this.moveInput) { mx += this.moveInput.x; mz += this.moveInput.z; }
    mx = Math.max(-1, Math.min(1, mx));
    mz = Math.max(-1, Math.min(1, mz));

    // Q/E rotate the camera from the keyboard (no dragging needed)
    if (this.keys['q']) this.camAngle += dt * 2.4;
    if (this.keys['e']) this.camAngle -= dt * 2.4;

    // --- Velocity-based movement: quick response, short glide ---
    if (!this.moveVel) this.moveVel = new THREE.Vector2(0, 0);
    const MAX_SPEED = 10 * (this.speedMul || 1), ACCEL = 16;
    let targetX = 0, targetZ = 0;
    if (mx || mz) {
      // Input relative to camera facing
      const ang = this.camAngle;
      const sin = Math.sin(ang), cos = Math.cos(ang);
      const wx = mx * cos - mz * sin;
      const wz = mx * sin + mz * cos;
      const len = Math.hypot(wx, wz) || 1;
      targetX = (wx / len) * MAX_SPEED;
      targetZ = (wz / len) * MAX_SPEED;
    }
    const k = Math.min(1, dt * ACCEL);
    this.moveVel.x += (targetX - this.moveVel.x) * k;
    this.moveVel.y += (targetZ - this.moveVel.y) * k;
    if (Math.hypot(this.moveVel.x, this.moveVel.y) < 0.05) this.moveVel.set(0, 0);

    const stepX = this.moveVel.x * dt;
    const stepZ = this.moveVel.y * dt;
    const isMoving = Math.hypot(this.moveVel.x, this.moveVel.y) > 0.6;

    this.jumpY = this.jumpY || 0;
    this.vy = this.vy || 0;

    // --- Wall stick (แปะผนัง): hold the 'flat' pose while touching a wall to
    // cling to it — gravity is suspended and you freeze in place (even up in
    // the air if you climbed there), back flat against the surface. Great for
    // hiding flush on a wall. Jump (or leaving the flat pose) drops you off.
    const jumpHeld = this.keys[' '] || this.keys['space'] || this.jumpRequested || this._jumpHeld;
    let clingWall = this.currentPose === 'flat'
      ? this._adjacentWall(this.character.position.x, this.character.position.z, this.jumpY)
      : null;
    if (clingWall && jumpHeld) {
      // Detach and hop off the wall. Reset to 'stand' so we don't re-cling
      // on the very next frame while still touching the wall.
      this._wallStuck = false;
      this.currentPose = 'stand';
      this.jumpRequested = false; this._jumpHeld = false;
      this.vy = 5.5;
      clingWall = null;
    } else if (clingWall) {
      this._wallStuck = true;
      this.moveVel.set(0, 0);
      this.vy = 0;                         // suspend gravity — cling in place
      // Face away from the wall so the back is flat against it
      this._clingHeading = Math.atan2(-clingWall.x, -clingWall.z);
      this.charHeading = this._clingHeading;
      if (typeof soundFX !== 'undefined' && !this._wasStuck) soundFX.climb();
    } else {
      this._wallStuck = false;
    }
    this._wasStuck = this._wallStuck;

    // Move with collision (slide along walls). Frozen while clinging.
    let hitWall = false;
    if (!this._wallStuck && (stepX || stepZ)) {
      const px = this.character.position.x;
      const pz = this.character.position.z;
      const fy = this.jumpY;
      if (!this._blocked(px + stepX, pz + stepZ, fy)) {
        this.character.position.x = px + stepX;
        this.character.position.z = pz + stepZ;
      } else if (!this._blocked(px + stepX, pz, fy)) {
        this.character.position.x = px + stepX;
        hitWall = true;
      } else if (!this._blocked(px, pz + stepZ, fy)) {
        this.character.position.z = pz + stepZ;
        hitWall = true;
      } else {
        hitWall = true;
      }
    }

    // Climb + gravity only run when not clinging to a wall
    if (!this._wallStuck) {
    // --- Climb: push into a wall/prop while holding jump to scale it ---
    const px2 = this.character.position.x, pz2 = this.character.position.z;
    // Wall top just ahead in the facing direction (where we're pushing)
    const aheadX = px2 + Math.sin(this.charHeading) * 0.6;
    const aheadZ = pz2 + Math.cos(this.charHeading) * 0.6;
    const wallTop = this._wallTopAt(aheadX, aheadZ, this.jumpY);
    const canClimb = hitWall && isMoving && jumpHeld && wallTop > this.jumpY + 0.05;
    const support = this._supportHeight(px2, pz2, this.jumpY);

    if (canClimb) {
      // Ascend the wall face; nudge forward once we clear the top
      this._climbing = true;
      this.jumpRequested = false;
      this.vy = 0;
      this.jumpY = Math.min(wallTop, this.jumpY + 6 * (this.jumpMul || 1) * dt);
      if (this.jumpY >= wallTop - 0.05) {
        // Over the lip — hop forward onto the surface
        const fx = px2 + Math.sin(this.charHeading) * 0.5;
        const fz = pz2 + Math.cos(this.charHeading) * 0.5;
        if (!this._blocked(fx, fz, this.jumpY + 0.1)) {
          this.character.position.x = fx;
          this.character.position.z = fz;
        }
      }
      // Climb tick every ~0.35s so it feels like grabbing rungs
      if (typeof soundFX !== 'undefined') {
        if (!this._climbSfxT || this._time - this._climbSfxT > 0.35) {
          soundFX.climb();
          this._climbSfxT = this._time;
        }
      }
    } else {
      this._climbing = false;
      this._climbSfx = false;
      // --- Jump (Space) + gravity, landing on box tops or the ground ---
      const grounded = this.jumpY <= support + 0.02 && this.vy <= 0;
      if (jumpHeld && grounded) {
        this.jumpRequested = false;
        this.vy = 8.5 * (this.jumpMul || 1);
        if (typeof soundFX !== 'undefined') soundFX.jump();
      }
      this.vy -= 24 * dt;
      this.jumpY += this.vy * dt;
      if (this.jumpY <= support) {
        if (this._airborne && this.vy < -3 && typeof soundFX !== 'undefined') soundFX.land();
        this.jumpY = support; this.vy = 0; this._airborne = false;
      } else {
        this._airborne = true;
      }
    }
    } // end if (!this._wallStuck)

    let bobY = 0;
    if (isMoving) {
      // Turn smoothly toward the moving direction (no instant snap)
      this.charHeading = Math.atan2(this.moveVel.x, this.moveVel.y);
      let turn = this.charHeading - this.character.rotation.y;
      turn = Math.atan2(Math.sin(turn), Math.cos(turn)); // wrap to [-PI, PI]
      this.character.rotation.y += turn * Math.min(1, dt * 14);

      // Camera gently swings behind the walking direction — but ONLY when
      // moving forward. Pure left/right strafing keeps the camera still so
      // sidestepping stays predictable instead of spiralling.
      const movingForward = mz < -0.2;
      if (movingForward && !this._camDragging && !this.keys['q'] && !this.keys['e']) {
        const targetCam = this.charHeading + Math.PI;
        let camTurn = targetCam - this.camAngle;
        camTurn = Math.atan2(Math.sin(camTurn), Math.cos(camTurn));
        this.camAngle += camTurn * Math.min(1, dt * 1.8);
      }

      // Walking animation: swing scales with actual speed + bounce + lean
      const speedRatio = Math.hypot(this.moveVel.x, this.moveVel.y) / MAX_SPEED;
      this._walkPhase = (this._walkPhase || 0) + dt * 9 * speedRatio;

      // Footstep sound each half stride (only on the ground)
      const stepIdx = Math.floor(this._walkPhase / Math.PI);
      if (stepIdx !== this._lastStepIdx && !this._airborne && !this._climbing) {
        this._lastStepIdx = stepIdx;
        if (typeof soundFX !== 'undefined') soundFX.footstep(stepIdx % 2 === 0);
      }
      const swing = Math.sin(this._walkPhase) * 0.6 * speedRatio;
      this.armL.pivot.rotation.x = swing;
      this.armR.pivot.rotation.x = -swing;
      this.legL.pivot.rotation.x = -swing;
      this.legR.pivot.rotation.x = swing;
      // Elbows/knees flex on the forward swing so the walk reads naturally.
      // Elbows keep a slight base bend — human arms are never ramrod straight.
      const flex = Math.max(0, Math.sin(this._walkPhase)) * 0.5 * speedRatio;
      const flexN = Math.max(0, -Math.sin(this._walkPhase)) * 0.5 * speedRatio;
      this.armL.mid.rotation.x = 0.18 * speedRatio + flex;
      this.armR.mid.rotation.x = 0.18 * speedRatio + flexN;
      this.legL.mid.rotation.x = flexN;
      this.legR.mid.rotation.x = flex;
      if (this.currentPose === 'stand') {
        bobY = Math.abs(Math.sin(this._walkPhase)) * 0.12 * speedRatio;
        this.character.rotation.x = 0.06 * speedRatio;
        // Hips counter-rotate against the stride and the torso sways a touch —
        // the little twist that makes a walk look human instead of robotic
        this.rig.waist.rotation.y = Math.sin(this._walkPhase) * 0.12 * speedRatio;
        this.rig.waist.rotation.z = Math.cos(this._walkPhase) * 0.05 * speedRatio;
        this.rig.neck.rotation.y = -Math.sin(this._walkPhase) * 0.08 * speedRatio;
      }
    } else if (this.currentPose && this.currentPose !== 'stand') {
      // Hold the chosen pose while standing still
      this._applyPose(this.currentPose);
    } else {
      // Idle: ease limbs back to a relaxed stance + gentle breathing.
      // Arms settle into a soft elbow bend rather than hanging dead straight.
      [this.armL, this.armR].forEach(a => {
        a.pivot.rotation.x *= 0.8;
        a.mid.rotation.x += (0.16 - a.mid.rotation.x) * 0.12;
      });
      [this.legL, this.legR].forEach(l => {
        l.pivot.rotation.x *= 0.8;
        l.mid.rotation.x *= 0.8;
      });
      this.rig.waist.rotation.y *= 0.85;
      this.rig.waist.rotation.z *= 0.85;
      this.rig.neck.rotation.y *= 0.85;
      const breathe = Math.sin(this._time * 2.2);
      bobY = breathe * 0.03;
      this.character.rotation.x = 0;
      this.armL.pivot.rotation.z = breathe * 0.05;
      this.armR.pivot.rotation.z = -breathe * 0.05;
      // Chest rises subtly with each breath; head follows a beat behind
      this.rig.waist.rotation.x = breathe * 0.015;
      this.rig.neck.rotation.x = Math.sin(this._time * 2.2 - 0.6) * 0.03;
    }

    // While clinging, keep the back pressed flat to the wall (the flat pose's
    // _applyPose resets rotation, so re-apply the facing here) with no bob
    if (this._wallStuck) {
      this.character.rotation.y = this._clingHeading || this.charHeading;
      bobY = 0;
    }

    // Vertical position = pose offset + walk/idle bob + jump height
    const POSE_Y = { crouch: -0.5, sit: -0.55, ball: -0.55, lie: 0.35, kneel: -0.55 };
    const poseY = (!isMoving && POSE_Y[this.currentPose]) || 0;
    this.character.position.y = poseY + bobY + this.jumpY;
    // Tuck the legs mid-air for a hop; reach upward while climbing
    if (this._climbing) {
      this.legL.pivot.rotation.x = 0.5; this.legR.pivot.rotation.x = 0.5;
      this.armL.pivot.rotation.x = -1.6; this.armR.pivot.rotation.x = -1.6;
    } else if (this._airborne) {
      this.legL.pivot.rotation.x = 0.7;
      this.legR.pivot.rotation.x = 0.7;
    }

    // Keep within the ground
    const b = this.bound;
    this.character.position.x = Math.max(-b, Math.min(b, this.character.position.x));
    this.character.position.z = Math.max(-b, Math.min(b, this.character.position.z));
  }

  // Build solid collision boxes from obstacle bounding boxes. Keeps only
  // real, climbable props: tall enough to be a wall, not flat decals
  // (carpets/lawns/lava), not huge landmarks (mesas/volcano) that would
  // create giant dead zones, and not floating sky decor.
  _buildObstacleBoxes(map, S) {
    this.obstacleBoxes = [];
    // Camera-only blockers: the vast landmarks the player walks through (no
    // collision box) but the camera must not reverse into — the volcano cone,
    // mesas, domes. Modelled as cones whose radius shrinks with height, because
    // they genuinely narrow as they rise: a bounding box the size of the base
    // yanked the camera in whenever you merely stood near one (the base is far
    // wider than the mass at lens height), while a mesh raycast slipped past
    // the narrowing surface and let the camera sink in anyway. The cone gets
    // both right — see _pushOutOfCones.
    this._camCones = [];
    const spawn = map.spawn || [0, 0, 8];
    this._spawnX = spawn[0] * S; this._spawnZ = spawn[2] * S;
    for (const o of this.obstacles) {
      if (o.userData.noHit) continue;               // decorative (bubbles etc.)
      const box = this._groundSliceBox(o);
      const added = this._addCollisionBox(box, o);
      if (!added) this._maybeCameraLandmark(box);
    }
  }

  // A landmark too big to be a collision box (a mesa, the volcano) still has to
  // stop the camera. Store it as an upright cone: full radius at the base,
  // tapering to nothing at the top.
  _maybeCameraLandmark(box) {
    const fw = box.max.x - box.min.x, fd = box.max.z - box.min.z, h = box.max.y - box.min.y;
    if (Math.min(fw, fd) <= 13) return;   // only the vast landmarks the box test rejected
    if (h < 3 || box.min.y > 3.5) return; // must be a real standing mass
    this._camCones.push({
      cx: (box.min.x + box.max.x) / 2,
      cz: (box.min.z + box.max.z) / 2,
      baseY: box.min.y,
      h,
      baseR: Math.max(fw, fd) / 2
    });
  }

  // Slide the camera sideways out of any landmark cone it would sit inside,
  // measured at the camera's own height (so the taper is respected). Sliding
  // out rather than pulling in keeps the shot at full distance — you see the
  // player from beside the cone instead of jammed up against it. Returns true
  // if it moved the camera, so the caller can snap rather than ease.
  _pushOutOfCones(desired, focus) {
    const cones = this._camCones;
    if (!cones || !cones.length) return false;
    let moved = false;
    for (let i = 0; i < cones.length; i++) {
      const c = cones[i];
      const y = desired.y - c.baseY;
      if (y < 0 || y > c.h) continue;                 // camera clears the cone
      const rHere = c.baseR * (1 - y / c.h) + 1.4;    // radius at this height + margin
      let dx = desired.x - c.cx, dz = desired.z - c.cz;
      let hd = Math.hypot(dx, dz);
      if (hd >= rHere) continue;                      // already outside
      if (hd < 0.001) {                               // on the axis: bail toward the player
        dx = focus.x - c.cx; dz = focus.z - c.cz; hd = Math.hypot(dx, dz) || 1;
      }
      desired.x = c.cx + (dx / hd) * rHere;
      desired.z = c.cz + (dz / hd) * rHere;
      moved = true;
    }
    return moved;
  }

  // Collision footprint = the bounding box of only the parts of an object that
  // start near the ground. For a tree this is the (narrow) trunk, not the wide
  // canopy high above — so you bump the trunk instead of walking through it,
  // and the whole tree isn't skipped for being "too wide". The top is still
  // the object's true top so you can climb/stand on it.
  _groundSliceBox(o) {
    const SLICE = 2.6; // geometry whose bottom is below this counts as footprint
    const full = new THREE.Box3().setFromObject(o);
    const foot = new THREE.Box3();
    const mb = new THREE.Box3();
    let any = false;
    o.updateWorldMatrix(true, true);
    o.traverse(c => {
      if (!c.isMesh || !c.geometry) return;
      mb.setFromObject(c);
      if (mb.min.y - full.min.y < SLICE) { foot.union(mb); any = true; }
    });
    if (!any) return full;
    // Keep the true top (canopy/roof) so climbing + standing height is right,
    // but the horizontal footprint comes from the ground-level slice.
    foot.max.y = full.max.y;
    foot.min.y = full.min.y;
    return foot;
  }

  // Turn a world-space AABB into a solid collision box, applying the same
  // "is this a real, blockable prop?" filters used for scatter and models.
  // Returns true if a box was added.
  _addCollisionBox(box, obj) {
    const sx = this._spawnX || 0, sz = this._spawnZ || 0;
    const fw = box.max.x - box.min.x, fd = box.max.z - box.min.z, h = box.max.y - box.min.y;
    const minFoot = Math.min(fw, fd), maxFoot = Math.max(fw, fd);
    // Skip: flat decals (carpets/lawns), floating sky decor, tiny bits, and
    // vast landmarks (mesas/volcano/fields) that would be giant dead zones.
    if (h < 0.55 || box.min.y > 3.5) return false;
    if (maxFoot < 0.45) return false;
    // Skip only things that are vast in BOTH directions — a mesa, the volcano
    // cone, a whole field — which would be giant invisible dead zones. Testing
    // the longest side instead meant anything merely long lost its collision
    // and you walked straight through it: the laundromat's 32-unit computer
    // bench, the classroom's 17-unit chalkboard, long counters and shelf runs.
    if (minFoot > 13) return false;
    // Never trap the player on their spawn tile
    if (sx > box.min.x - 0.5 && sx < box.max.x + 0.5 &&
        sz > box.min.z - 0.5 && sz < box.max.z + 0.5) return false;
    // Inset so you can tuck right up against props — but never past the
    // centre (thin props like fences would otherwise invert to nothing)
    const ix = Math.min(0.2, fw * 0.35), iz = Math.min(0.2, fd * 0.35);
    this.obstacleBoxes.push({
      minX: box.min.x + ix, maxX: box.max.x - ix,
      minZ: box.min.z + iz, maxZ: box.max.z - iz,
      top: box.max.y,
      obj // kept so _supportHeight can ray-test the real surface, not just the top
    });
    return true;
  }

  // All solid boxes: interior walls + auto obstacle boxes
  _solidBoxes() {
    return (this.wallBoxes || []).concat(this.obstacleBoxes || []);
  }

  // Blocked at (x, z) for a body whose feet are at height feetY? A box only
  // blocks if its top is above the feet (with a small step-up tolerance),
  // so once you've climbed above a box you can walk onto its top.
  _blocked(x, z, feetY) {
    const r = 0.4; // player half-width — smaller so you can tuck up close to props
    const fy = feetY || 0;
    for (const b of this._solidBoxes()) {
      if (x > b.minX - r && x < b.maxX + r && z > b.minZ - r && z < b.maxZ + r) {
        if ((b.top || 99) - fy > 0.35) return true; // ledges ≤0.35 are step-overs
      }
    }
    return false;
  }

  // Height of the surface directly under (x, z) the feet can rest on.
  //
  // A prop's collision box is one AABB, so its `top` is the object's highest
  // point — a sofa's backrest, a chair back. Standing at that height leaves you
  // floating above the seat you're actually over. So for props we drop a ray and
  // use the real geometry under the feet; flat-topped interior walls can use
  // their box top directly. Everything stays climbable either way.
  _supportHeight(x, z, feetY) {
    const r = 0.5;
    const ceiling = feetY + 0.35; // highest surface the feet may step up onto
    let best = 0;
    const rayTargets = [];
    for (const b of this._solidBoxes()) {
      if (x > b.minX - r && x < b.maxX + r && z > b.minZ - r && z < b.maxZ + r) {
        if (b.obj) { rayTargets.push(b.obj); continue; } // resolve by ray below
        const top = b.top || 0;
        if (top <= ceiling && top > best) best = top;
      }
    }
    if (rayTargets.length) {
      const ray = this._supportRay || (this._supportRay = new THREE.Raycaster());
      // Start just above the step-up ceiling and look straight down, so the
      // first hit is the highest surface the feet could actually rest on.
      ray.set(new THREE.Vector3(x, ceiling + 0.02, z), DOWN_VEC);
      ray.far = ceiling + 0.02;
      const hits = ray.intersectObjects(rayTargets, true);
      if (hits.length && hits[0].point.y > best) best = hits[0].point.y;
    }
    return best;
  }

  // Tallest box top overlapping (x, z) that rises above the feet — the wall
  // we're pressing against and could climb. 0 if nothing to climb.
  _wallTopAt(x, z, feetY) {
    const r = 0.45;
    let best = 0;
    for (const b of this._solidBoxes()) {
      if (x > b.minX - r && x < b.maxX + r && z > b.minZ - r && z < b.maxZ + r) {
        const top = b.top || 0;
        if (top > feetY + 0.05 && top > best) best = top;
      }
    }
    return best;
  }

  // Is there a solid wall right next to (x, z) at foot height feetY? Returns a
  // unit vector pointing toward the nearest touching wall (into it), else null.
  // Used by the wall-stick (แปะผนัง) ability.
  _adjacentWall(x, z, feetY) {
    const reach = 0.75, fy = feetY || 0;
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (const [dx, dz] of dirs) {
      if (this._blocked(x + dx * reach, z + dz * reach, fy)) {
        return { x: dx, z: dz };
      }
    }
    return null;
  }

  _updateCamera() {
    const t = this.character.position;
    // 👩‍🏫 Teacher overview: pull right back over the whole stage
    if (this.overviewOn) {
      // Frame the WHOLE stage. The old 1.15x height was tuned for the smaller
      // maps and, once every map grew, left the far half of the floor off the
      // top of the screen — the teacher couldn't see players in the back
      // corners. 2.5x height with a 0.68x forward offset fits all four corners
      // with margin across every landscape aspect the game runs at.
      const h = Math.max(60, this.bound * 2.5);
      this.camera.position.lerp(new THREE.Vector3(0, h, this.bound * 0.68), 0.12);
      this.camera.lookAt(0, 0, 0);
      this._updateOverviewMarkers();
      return;
    }
    // 🚁 Scout drone: lift the view high overhead for a bird's-eye sweep
    if (this.droneOn) {
      this.camera.position.lerp(new THREE.Vector3(t.x, t.y + 34, t.z + 0.01), 0.12);
      this.camera.lookAt(t.x, t.y, t.z);
      return;
    }
    const d = this.camDist;
    const cp = Math.cos(this.camPitch);
    const desired = new THREE.Vector3(
      t.x + Math.sin(this.camAngle) * cp * d,
      t.y + 3 + Math.sin(this.camPitch) * d,
      t.z + Math.cos(this.camAngle) * cp * d
    );

    // Don't reverse the camera through a wall. Turning to face the room in any
    // walled map used to bury the camera in the wall behind you and fill the
    // screen with wallpaper — you couldn't see the game at all. Pull the camera
    // in to just short of whatever is in the way instead.
    const focus = new THREE.Vector3(t.x, t.y + 1.8, t.z);
    // First slide out of any landmark cone (volcano, mesa) the camera would sit
    // inside — sideways, keeping the distance — then run the wall/prop pull-in
    // on whatever position that leaves.
    const conePushed = this._pushOutOfCones(desired, focus);
    const blocked = this._cameraBlockDistance(focus, desired);
    if (blocked !== null) {
      const dir = desired.clone().sub(focus);
      const full = dir.length();
      if (full > 0.001) {
        dir.divideScalar(full);
        // Real clearance, not a token gap. Stopping 0.45 short of a tall prop
        // still left it filling the bottom of the frame at that range — the
        // camera was technically in front of the classroom's cubbies and you
        // still saw nothing but cupboard. But the clearance floor must never
        // push the camera PAST what blocked it: standing right against a tall
        // wall-prop (a mansion fireplace) with the camera aimed into it, a flat
        // 2.2 floor landed the lens inside the prop. Cap it just short of the
        // hit so the camera stays in front, however close that has to be.
        const stop = Math.min(blocked - 0.3, Math.max(2.2, blocked - 1.2));
        desired.copy(focus).addScaledVector(dir, stop);
        // ...and climb over whatever it is. The harder we had to pull in, the
        // higher the camera rides, so you end up looking down across the
        // obstruction instead of pressed flat against its face.
        desired.y += (1 - stop / full) * 5.5;
      }
    }

    // Smooth follow: glide toward the target, but snap on big jumps (teleports).
    // Pulling in off a wall snaps too — lerping there lets you see through it
    // for a few frames, which is the artefact we're removing.
    if (this.camera.position.distanceTo(desired) > 12 || blocked !== null || conePushed) {
      this.camera.position.copy(desired);
    } else {
      this.camera.position.lerp(desired, 0.25);
    }
    this.camera.lookAt(t.x, t.y + 1.8, t.z);

    // Backed into a corner the camera ends up almost on top of you, and your
    // own body then blocks the view it was pulled in to preserve. Hide the rig
    // while it's that close — you can still see your paint job any other time.
    if (this.character) {
      const close = this.camera.position.distanceTo(focus) < 3.6;
      if (close !== this._selfHidden) {
        this._selfHidden = close;
        this.character.traverse((m) => {
          if (m.isMesh && !m.userData.isNameTag) m.visible = !close;
        });
      }
    }
  }

  // Distance from `focus` to the first thing between it and `desired`, or null
  // when the view is clear. Walls are raycast as meshes; props are tested
  // against the collision boxes the physics already builds, which is far
  // cheaper than a recursive raycast through a few hundred compound props —
  // and props block the view just as well as walls do (backing into the
  // classroom's cubbies filled the screen with cupboard).
  _cameraBlockDistance(focus, desired) {
    const dir = desired.clone().sub(focus);
    const dist = dir.length();
    if (dist < 0.001) return null;
    dir.divideScalar(dist);
    let nearest = null;

    const blockers = this._camBlockers;
    if (blockers && blockers.length) {
      const rc = this._camRay || (this._camRay = new THREE.Raycaster());
      rc.set(focus, dir);
      rc.far = dist;
      const hits = rc.intersectObjects(blockers, false);
      if (hits.length) nearest = hits[0].distance;
    }

    // Slab test against every solid box. Only boxes tall enough to actually be
    // in front of the lens count — a knee-high basket shouldn't yank the camera.
    const boxes = this.obstacleBoxes;
    if (boxes) {
      for (let i = 0; i < boxes.length; i++) {
        const b = boxes[i];
        if (b.top < 1.6) continue;
        const t = this._rayBox(focus, dir, b, dist);
        if (t !== null && (nearest === null || t < nearest)) nearest = t;
      }
    }

    // Landmark cones (volcano, mesas) are handled separately by _pushOutOfCones,
    // which slides the camera out sideways rather than pulling it in.
    return nearest;
  }

  // Entry distance of a ray into an axis-aligned box (0..top), or null
  _rayBox(o, d, b, maxT) {
    let tmin = 0, tmax = maxT;
    const lo = [b.minX, 0, b.minZ], hi = [b.maxX, b.top, b.maxZ];
    const org = [o.x, o.y, o.z], dir = [d.x, d.y, d.z];
    for (let a = 0; a < 3; a++) {
      if (Math.abs(dir[a]) < 1e-6) {
        if (org[a] < lo[a] || org[a] > hi[a]) return null;
        continue;
      }
      const inv = 1 / dir[a];
      let t1 = (lo[a] - org[a]) * inv, t2 = (hi[a] - org[a]) * inv;
      if (t1 > t2) { const s = t1; t1 = t2; t2 = s; }
      if (t1 > tmin) tmin = t1;
      if (t2 < tmax) tmax = t2;
      if (tmin > tmax) return null;
    }
    return tmin > 0 ? tmin : null;
  }

  _animate() {
    const now = performance.now();
    const dt = Math.min(0.05, (now - this._lastT) / 1000);
    this._lastT = now;
    this._time += dt;

    if (this.gameState === 'playing') {
      this._updateAbilities(dt);
      this._updateAudioCues(dt);
      this._updateMovement(dt);
      this._updateCamera();
      this._updateRemotePlayers(dt);
      this._updateAimLock();
      const ph = this.getPhase();
      if (ph.phase === 'hunt' && ph.seconds <= 0) this.endGame();
    }

    // World liveliness (runs even while paused so the stage feels alive)
    this.mixers.forEach(mx => mx.update(dt));           // GLB animal animations
    this.clouds.forEach(c => {                          // drifting clouds
      c.position.x += c.userData.speed * dt;
      const wrap = c.userData.wrap || 40;
      if (c.position.x > wrap) c.position.x = -wrap;
    });
    // Fade out rainbow laser beams
    for (let i = this.lasers.length - 1; i >= 0; i--) {
      const L = this.lasers[i];
      L.ttl -= dt;
      const k = Math.max(0, L.ttl / L.max);
      L.beam.material.opacity = k;
      if (L.flash) { L.flash.material.opacity = k; L.flash.scale.setScalar(1 + (1 - k) * 2); }
      if (L.ttl <= 0) {
        this.scene.remove(L.beam);
        if (L.flash) this.scene.remove(L.flash);
        this.lasers.splice(i, 1);
      }
    }
    this.obstacles.forEach(o => {                       // swaying trees / kelp
      if (o.userData.sway) {
        o.rotation.z = Math.sin(this._time * 1.3 + o.userData.swayPhase) * (o.userData.swayAmp || 0.03);
      }
    });

    if (this.bubbles) {                                 // rising bubble streams
      this.bubbles.forEach(b => {
        b.position.y += b.userData.speed * dt;
        b.position.x += Math.sin(this._time * 1.5 + b.userData.phase) * dt * 0.4;
        if (b.position.y > b.userData.top) { b.position.y = b.userData.base; }
      });
    }

    if (this.lavaFlows && this.lavaFlows.length) {      // scrolling lava rivers
      this.lavaFlows.forEach(f => { f.tex.offset.y -= f.speed * dt; });
    }

    this._followSun();
    this.renderer.render(this.scene, this.camera);
    this._raf = requestAnimationFrame(() => this._animate());
  }

  // Walk the shadow frustum along with the player. A directional light shadows
  // only what its camera covers, and that camera is deliberately small so the
  // shadows stay sharp — so it has to travel, or you leave your shadow behind.
  _followSun() {
    if (!this._shadows || !this.sun || !this.character) return;
    const p = this.character.position;
    this.sun.position.set(p.x + this._sunOffset.x, this._sunOffset.y, p.z + this._sunOffset.z);
    this.sun.target.position.set(p.x, 0, p.z);
    this.sun.target.updateMatrixWorld();
  }

  // How sharply to render. A tablet at devicePixelRatio 2 would allocate a
  // 4x larger antialiased buffer than it needs — one of the quickest ways to
  // lose the WebGL context on iOS, and the sharpness isn't worth it there.
  _targetPixelRatio() {
    const dpr = window.devicePixelRatio || 1;
    const touch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
    const bigScreen = Math.max(window.innerWidth, window.innerHeight) >= 900;
    // Phones cap hardest: a 3x-DPR iPhone at full ratio allocates a huge
    // framebuffer that tips iOS Safari into reloading the tab. 1.3 keeps it
    // legible while roughly halving the GPU memory vs 2x.
    if (touch) return bigScreen ? Math.min(1.5, dpr) : Math.min(1.3, dpr);
    return Math.min(2, dpr);
  }

  _onResize() {
    if (!this.renderer) return;
    const w = this.canvas.parentElement.clientWidth;
    const h = this.canvas.parentElement.clientHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  getTimeRemaining() {
    const elapsed = (Date.now() - this.startTime) / 1000;
    return Math.max(0, this.duration - elapsed);
  }

  // Three-phase clock: 'lobby' (pre-start, unlimited) → 'hide' countdown → 'hunt'
  getPhase() {
    if (this.lobbyMode) return { phase: 'lobby', seconds: 0 };
    const now = Date.now();
    const huntStart = this.startTime + this.hidePhase * 1000;
    if (now < huntStart) {
      return { phase: 'hide', seconds: Math.max(0, Math.ceil((huntStart - now) / 1000)) };
    }
    const elapsed = (now - huntStart) / 1000;
    return { phase: 'hunt', seconds: Math.max(0, Math.ceil(this.duration - elapsed)) };
  }

  // Seekers can only catch during the hunt phase
  canCatch() {
    return this.getPhase().phase === 'hunt';
  }

  // Mark a hider as caught: gray + translucent, no longer targetable
  // 🧟 Infection: a caught hider switches sides instead of fading out as a
  // spectator, so nobody sits watching for the rest of the round and the hunt
  // escalates as the seeker pack grows.
  markCaught(id) {
    if (this.caughtPlayers.has(id)) return;
    this.caughtPlayers.add(id);
    const rp = this.remotePlayers.get(id);
    if (rp) {
      rp.caught = false;      // still very much in the game
      rp.role = 'seeker';     // aim assist only reaches for hiders, so they're safe now
      rp.rig.root.scale.setScalar(PLAYER_SCALE.seeker);
      rp.rig.parts.forEach(m => {
        m.material.transparent = false;
        m.material.opacity = 1;
      });
      if (rp.disguise) { rp.rig.root.remove(rp.disguise); rp.disguise = null; }
      rp.rig.parts.forEach(m => { m.visible = true; });
      if (rp.tag) rp.tag.visible = true;
      this._syncRemoteGun(rp);  // hand them a laser
    }
  }

  // Turn the local player from hider into seeker after being caught
  convertToSeeker() {
    if (!this.isHider) return false;
    this.isHider = false;
    this.selfCaught = false;    // back in play, just on the other team now
    this.paintMode = false;
    this.eyedropperMode = false;
    // Hider-only powers stop making sense the moment you join the hunt
    ['disguise', 'invisible', 'radar'].forEach(id => {
      if (this.abilityTimers[id]) { delete this.abilityTimers[id]; this._endAbility(id); }
    });
    this.character.scale.setScalar(PLAYER_SCALE.seeker);
    if (!this.gunTip) this._buildGun();
    if (typeof soundFX !== 'undefined') soundFX.huntStart();
    return true;
  }

  // How many hiders are still uncaught (the local player counts too)
  hidersLeft() {
    let n = this.isHider && !this.selfCaught ? 1 : 0;
    this.remotePlayers.forEach(rp => { if (rp.role === 'hider' && !rp.caught) n++; });
    return n;
  }

  addPower(power) {
    if (!this.powers.includes(power)) this.powers.push(power);
  }

  // ===== Special abilities =====
  // Answering questions earns energy, which the UI spends here. Returns true if
  // the ability actually started (the UI only charges energy on a true).

  activateAbility(id) {
    if (this.gameState !== 'playing' || this.selfCaught) return false;
    switch (id) {
      case 'camo':      return this._abilityCamouflage();
      case 'speed':     return this._abilityTimedStat('speed', 10, () => { this.speedMul = 1.6; });
      case 'jump':      return this._abilityTimedStat('jump', 15, () => { this.jumpMul = 1.5; });
      case 'invisible': return this._abilityInvisible();
      case 'decoy':     return this._abilityDecoy();
      case 'radar':     return this._abilityTimedStat('radar', 30, () => { this.radarOn = true; });
      case 'disguise':  return this._abilityDisguise();
      case 'time':      return this._abilityExtraTime();
      case 'scan':      return this._abilityScan();
      case 'xray':      return this._abilityXray();
      case 'drone':     return this._abilityTimedStat('drone', 8, () => { this.droneOn = true; });
    }
    return false;
  }

  // Seconds left on an active ability (0 if it isn't running) — for HUD badges
  abilityTimeLeft(id) {
    return Math.max(0, Math.ceil(this.abilityTimers[id] || 0));
  }

  _abilityTimedStat(id, seconds, apply) {
    if (this.abilityTimers[id]) return false; // already running
    apply();
    this.abilityTimers[id] = seconds;
    return true;
  }

  // Tick every frame: expire timed abilities and keep scan markers on target
  _updateAbilities(dt) {
    for (const id of Object.keys(this.abilityTimers)) {
      this.abilityTimers[id] -= dt;
      if (this.abilityTimers[id] <= 0) {
        delete this.abilityTimers[id];
        this._endAbility(id);
      }
    }
    // Scan pins ride above the hider they marked
    if (this._scanMarks.length) {
      for (const m of this._scanMarks) {
        const rig = m.userData.followRig;
        if (rig) m.position.set(rig.position.x, rig.position.y + 4.2, rig.position.z);
        m.position.y += Math.sin(this._time * 6) * 0.12; // pulse so it catches the eye
      }
    }
  }

  _endAbility(id) {
    if (id === 'speed') this.speedMul = 1;
    else if (id === 'jump') this.jumpMul = 1;
    else if (id === 'radar') this.radarOn = false;
    else if (id === 'drone') this.droneOn = false;
    else if (id === 'invisible') { this._setBodyOpacity(1); this._emitAbility({ id: 'invisible', on: false }); }
    else if (id === 'disguise') { this._endDisguise(); this._emitAbility({ id: 'disguise', on: false }); }
    else if (id === 'xray') this._endXray();
    else if (id === 'scan') this._endScan();
  }

  // 🦎 Auto-camouflage: instantly repaint the whole body in the colour of
  // whatever you're standing next to, so you melt into your hiding spot.
  _abilityCamouflage() {
    const hex = this._nearbySurfaceColor();
    if (!hex) return false;
    this.currentPaintColor = hex;
    this.paintAll(hex);
    if (this.onColorSucked) this.onColorSucked(hex);
    if (typeof soundFX !== 'undefined') soundFX.suck();
    return true;
  }

  // Nearest surface around a point: rays fan out sideways and down, and the
  // closest hit wins — that's the thing a seeker would see you against.
  _nearbySurfaceColor(pos) {
    const p = pos || this.character.position;
    const origin = new THREE.Vector3(p.x, p.y + 1.2, p.z);
    const skip = new Set(this.characterParts);
    // You camouflage against the scenery — not against other players, their
    // decoys, or the name tags floating over them (those are sprites, which
    // also need a camera on the raycaster and would spam warnings).
    const exclude = new Set();
    this.remotePlayers.forEach(rp => exclude.add(rp.rig.root));
    this.decoys.forEach(d => exclude.add(d));
    const targets = this.scene.children.filter(c =>
      c !== this.character && !this.clouds.includes(c) && !c.userData.noHit &&
      !exclude.has(c) && (c.isMesh || c.type === 'Group'));
    const ray = this._camoRay || (this._camoRay = new THREE.Raycaster());
    ray.camera = this.camera; // guard for any sprite that still slips through
    const dirs = [new THREE.Vector3(0, -1, 0)];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      dirs.push(new THREE.Vector3(Math.sin(a), -0.2, Math.cos(a)).normalize());
    }
    let best = null, bestD = 1e9;
    for (const d of dirs) {
      ray.set(origin, d);
      ray.far = 5;
      const hits = ray.intersectObjects(targets, true).filter(h => !skip.has(h.object));
      if (hits.length && hits[0].distance < bestD) { bestD = hits[0].distance; best = hits[0]; }
    }
    return best ? this._sampleHitColor(best) : null;
  }

  // ===== Camouflage quality =====
  // Painting yourself is the signature mechanic, so it has to actually pay off:
  // the closer your body colour is to whatever you're standing against, the
  // less the seeker's aim assist will help them lock onto you.

  // Average colour currently painted on a torso — what a seeker sees at a glance
  _bodyPaintColor(bodyMesh) {
    const p = bodyMesh && bodyMesh.userData.paint;
    if (!p) return null;
    const cv = this._avgCanvas || (this._avgCanvas = document.createElement('canvas'));
    cv.width = cv.height = 1;
    const ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, 1, 1);
    try { ctx.drawImage(p.canvas, 0, 0, 1, 1); } catch (e) { return null; }
    const d = ctx.getImageData(0, 0, 1, 1).data;
    return [d[0], d[1], d[2]];
  }

  // How well does `rgb` melt into the scenery around `pos`? 1 = perfect match.
  _blendAt(rgb, pos) {
    if (!rgb) return 0;
    const hex = this._nearbySurfaceColor(pos);
    if (!hex) return 0;
    const sr = parseInt(hex.slice(1, 3), 16);
    const sg = parseInt(hex.slice(3, 5), 16);
    const sb = parseInt(hex.slice(5, 7), 16);
    const d = Math.hypot(rgb[0] - sr, rgb[1] - sg, rgb[2] - sb);
    // ~180 apart already reads as "obviously a different colour"
    return Math.max(0, Math.min(1, 1 - d / 180));
  }

  // My own camouflage quality, throttled — drives the HUD meter
  getSelfBlend() {
    if (!this.character || !this.bodyMesh) return 0;
    if (this._blendCache && this._time - this._blendCache.t < 0.25) return this._blendCache.v;
    const v = this._blendAt(this._bodyPaintColor(this.bodyMesh), this.character.position);
    this._blendCache = { t: this._time, v };
    return v;
  }

  // 0 = safe, 1 = a seeker is right on top of you. Distance only, no bearing —
  // it builds tension without handing over the direction (that's the radar).
  dangerLevel() {
    if (!this.isHider || this.selfCaught) return 0;
    const near = this.nearestOpponent();
    if (!near) return 0;
    const NEAR = 8, FAR = 30;
    return Math.max(0, Math.min(1, (FAR - near.dist) / (FAR - NEAR)));
  }

  // Audio tension: seekers hear hiders moving nearby, hiders hear their own
  // heartbeat rise as a seeker closes in.
  _updateAudioCues(dt) {
    if (typeof soundFX === 'undefined' || !this.character) return;
    const p = this.character.position;

    if (!this.isHider) {
      this._stepT = (this._stepT || 0) - dt;
      if (this._stepT <= 0) {
        let closest = null;
        this.remotePlayers.forEach(rp => {
          if (rp.role !== 'hider' || rp.caught || !rp.rig.root.visible) return;
          const q = rp.rig.root.position;
          const last = rp._audioPos;
          const moved = last ? Math.hypot(q.x - last.x, q.z - last.z) : 0;
          rp._audioPos = { x: q.x, z: q.z };
          if (moved < 0.04) return;               // standing still gives nothing away
          const d = Math.hypot(q.x - p.x, q.z - p.z);
          if (d < 22 && (closest === null || d < closest)) closest = d;
        });
        if (closest !== null) {
          soundFX.footstep(Math.random() < 0.5, 0.34 * (1 - closest / 22));
          this._stepT = 0.42;
        } else {
          this._stepT = 0.15;
        }
      }
    } else if (!this.selfCaught) {
      const danger = this.dangerLevel();
      this._beatT = (this._beatT || 0) - dt;
      if (danger > 0.05 && this._beatT <= 0) {
        soundFX.heartbeat(danger);
        this._beatT = 1.15 - danger * 0.7;        // faster as they get closer
      }
    }
  }

  // 👻 Invisibility: fade the body almost to nothing for a few seconds
  _abilityInvisible() {
    if (this.abilityTimers.invisible) return false;
    this._setBodyOpacity(0.12);
    this.abilityTimers.invisible = 6;
    this._emitAbility({ id: 'invisible', on: true });
    return true;
  }

  // Tell the other clients to mirror an ability that changes how I look
  _emitAbility(payload) {
    if (this.onAbility) this.onAbility(payload);
  }

  _setBodyOpacity(o) {
    this.characterParts.forEach(m => {
      if (!m.material) return;
      m.material.transparent = o < 1;
      m.material.opacity = o;
      m.material.needsUpdate = true;
    });
  }

  // 🎭 Decoy: leave a painted copy of yourself standing there. It registers as
  // a living target, so a seeker who shoots it sets off the siren and wastes
  // the shot — buying you time to slip away.
  _abilityDecoy() {
    if (this.decoys.length >= 3) return false;
    const rig = this._buildRig(96);
    const root = rig.root;
    // Shared id so a hit can destroy the same decoy on every client
    const decoyId = 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    root.userData.decoyId = decoyId;
    root.scale.copy(this.character.scale);
    root.position.copy(this.character.position);
    root.rotation.y = this.charHeading;
    // Copy your paint across so the decoy wears exactly your camouflage
    this.characterParts.forEach((src, i) => {
      const dst = rig.parts[i];
      if (!dst || !src.userData.paint || !dst.userData.paint) return;
      const sp = src.userData.paint, dp = dst.userData.paint;
      try {
        dp.ctx.drawImage(sp.canvas, 0, 0, dp.canvas.width, dp.canvas.height);
        dp.texture.needsUpdate = true;
      } catch (e) { /* canvas not ready — decoy just stays plain */ }
    });
    this._applyPose(this.currentPose, rig);
    this.scene.add(root);
    this.decoys.push(root);
    this.animatedRoots.push(root); // shooting it trips the "living target" siren
    // Everyone else needs to see it too, or it fools nobody
    this._emitAbility({
      id: 'decoy', decoyId,
      x: +root.position.x.toFixed(2), z: +root.position.z.toFixed(2),
      y: +root.position.y.toFixed(2),
      ry: +root.rotation.y.toFixed(2), pose: this.currentPose
    });
    return true;
  }

  // Take a decoy out of the world: off-screen, no longer shootable, GPU
  // resources released. Its rig owns its geometry/materials, so disposing
  // here can't affect any other character.
  _removeDecoy(root) {
    if (!root) return false;
    const di = this.decoys.indexOf(root);
    if (di >= 0) this.decoys.splice(di, 1);
    const ai = this.animatedRoots.indexOf(root);
    if (ai >= 0) this.animatedRoots.splice(ai, 1);
    if (this.scene) this.scene.remove(root);
    root.traverse(c => {
      if (!c.isMesh) return;
      if (c.geometry) c.geometry.dispose();
      const mats = Array.isArray(c.material) ? c.material : (c.material ? [c.material] : []);
      mats.forEach(m => { if (m.map) m.map.dispose(); m.dispose(); });
    });
    return true;
  }

  // 📦 Prop disguise: become a barrel/vase/crate. You can still walk around,
  // but a seeker sweeping the room just sees scenery.
  _abilityDisguise() {
    if (this.disguise || this.abilityTimers.disguise) return false;
    const kinds = ['barrel', 'vase', 'trashcan', 'bookstack', 'producebin'];
    const kind = kinds[Math.floor(Math.random() * kinds.length)];
    const prop = this._makePropDisguise(kind);
    if (!prop) return false;
    this.character.add(prop);
    this.disguise = prop;
    this.characterParts.forEach(m => { m.visible = false; });
    this.abilityTimers.disguise = 20;
    // Others must see the barrel too, otherwise the disguise fools nobody
    this._emitAbility({ id: 'disguise', on: true, kind });
    return true;
  }

  // Build a prop sized to stand in for a player body. Local units — the rig
  // group carries the role scale and the prop inherits it.
  _makePropDisguise(kind) {
    let prop = null;
    try {
      prop = this._makeObject({ type: kind, x: 0, z: 0, color: 0x9c6b3f });
    } catch (e) { return null; }
    if (!prop) return null;
    prop.position.set(0, 0, 0);
    const box = new THREE.Box3().setFromObject(prop);
    const h = box.max.y - box.min.y;
    if (h > 0.01) prop.scale.setScalar(2.6 / h);
    return prop;
  }

  _endDisguise() {
    if (this.disguise) {
      this.character.remove(this.disguise);
      this.disguise = null;
    }
    this.characterParts.forEach(m => { m.visible = true; });
  }

  // ⏱️ Buy the hunt more time
  _abilityExtraTime() {
    if (this.getPhase().phase !== 'hunt') return false;
    this.duration += 30;
    return true;
  }

  // 🔍 Pulse scan: pin every hider within range for a few seconds
  _abilityScan() {
    if (this.abilityTimers.scan) return false;
    this._endScan();
    const p = this.character.position;
    const RANGE = 45;
    this.remotePlayers.forEach(rp => {
      if (rp.role !== 'hider' || rp.caught || !rp.rig.root.visible) return;
      const q = rp.rig.root.position;
      if (Math.hypot(q.x - p.x, q.z - p.z) > RANGE) return;
      const mark = new THREE.Mesh(
        new THREE.SphereGeometry(0.55, 12, 12),
        new THREE.MeshBasicMaterial({ color: 0xff3b30, transparent: true, opacity: 0.95, depthTest: false })
      );
      mark.position.set(q.x, q.y + 4.2, q.z);
      mark.renderOrder = 999;
      mark.userData.noHit = true;      // not a laser/eyedropper target
      mark.userData.followRig = rp.rig.root;
      this.scene.add(mark);
      this._scanMarks.push(mark);
    });
    this.abilityTimers.scan = 6;
    if (typeof soundFX !== 'undefined') soundFX.unlock();
    return true;
  }

  _endScan() {
    this._scanMarks.forEach(m => {
      this.scene.remove(m);
      if (m.geometry) m.geometry.dispose();
      if (m.material) m.material.dispose();
    });
    this._scanMarks = [];
  }

  // 👁️ X-ray: props turn translucent so hiders tucked behind them show up
  _abilityXray() {
    if (this._xraySaved) return false;
    const saved = [];
    // Props share materials, so record each one's ORIGINAL state exactly once —
    // saving again after we've already faded it would "restore" it to 25%.
    const seen = new Set();
    this.obstacles.forEach(o => o.traverse(c => {
      if (!c.isMesh || !c.material) return;
      const mats = Array.isArray(c.material) ? c.material : [c.material];
      mats.forEach(m => {
        if (seen.has(m)) return;
        seen.add(m);
        saved.push({ m, transparent: m.transparent, opacity: m.opacity });
        m.transparent = true;
        m.opacity = 0.25;
        m.needsUpdate = true;
      });
    }));
    if (!saved.length) return false;
    this._xraySaved = saved;
    this.abilityTimers.xray = 6;
    return true;
  }

  _endXray() {
    if (!this._xraySaved) return;
    this._xraySaved.forEach(s => {
      s.m.transparent = s.transparent;
      s.m.opacity = s.opacity;
      s.m.needsUpdate = true;
    });
    this._xraySaved = null;
  }

  // 📡 Radar read-out for the HUD: where is the nearest opponent? Returns
  // { dist, angle } with the angle relative to the way the camera is facing
  // (0 = dead ahead, positive = to the right), or null if nobody is around.
  nearestOpponent() {
    if (!this.character) return null;
    const want = this.isHider ? 'seeker' : 'hider';
    const p = this.character.position;
    let bx = 0, bz = 0, bestD = 1e9;
    this.remotePlayers.forEach(rp => {
      if (rp.role !== want || rp.caught || !rp.rig.root.visible) return;
      const q = rp.rig.root.position;
      const d = Math.hypot(q.x - p.x, q.z - p.z);
      if (d < bestD) { bestD = d; bx = q.x; bz = q.z; }
    });
    if (bestD === 1e9) return null;
    // Camera looks from camAngle back toward the player, so "ahead on screen"
    // is camAngle + PI in world terms.
    let rel = Math.atan2(bx - p.x, bz - p.z) - (this.camAngle + Math.PI);
    while (rel > Math.PI) rel -= Math.PI * 2;
    while (rel < -Math.PI) rel += Math.PI * 2;
    return { dist: bestD, angle: rel };
  }

  endGame() {
    this.gameState = 'over';
    if (this._raf) cancelAnimationFrame(this._raf);
    window.removeEventListener('resize', this._boundResize);
  }

  stop() {
    this.gameState = 'paused';
    if (this._raf) cancelAnimationFrame(this._raf);
    window.removeEventListener('resize', this._boundResize);
  }

  // Fully tear down: cancel RAF, drop listeners, dispose WebGL resources.
  // Needed when swapping to a fresh GameEngine on the same canvas (e.g.
  // lobby → real match) so the old scene doesn't leak GPU memory / render
  // artefacts through a shared context.
  dispose() {
    this.gameState = 'over';
    // Teardown calls forceContextLoss() below, which fires webglcontextlost.
    // Without this flag the recovery handler treats our own cleanup as a GPU
    // crash and reboots — which disposes again, forever.
    this._disposing = true;
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = null;
    if (this._boundResize) window.removeEventListener('resize', this._boundResize);
    if (this.mixers) this.mixers.length = 0;
    // The environment probe is a render target — the scene walk below only
    // disposes materials and their maps, so it would survive every rebuild
    if (this._envRT) {
      try { this._envRT.dispose(); } catch (e) {}
      this._envRT = null;
      if (this.scene) this.scene.environment = null;
    }
    // Walk the scene and dispose geometries/materials/textures
    if (this.scene) {
      this.scene.traverse(obj => {
        if (obj.geometry) { try { obj.geometry.dispose(); } catch (e) {} }
        if (obj.material) {
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          mats.forEach(m => {
            for (const k of ['map', 'emissiveMap', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap']) {
              if (m[k]) { try { m[k].dispose(); } catch (e) {} }
            }
            try { m.dispose(); } catch (e) {}
          });
        }
      });
      // Detach children so refs can be GC'd
      while (this.scene.children.length) this.scene.remove(this.scene.children[0]);
    }
    if (this.renderer) {
      try { this.renderer.dispose(); } catch (e) {}
      // Force-lose the WebGL context so a new GameEngine gets a clean one
      try { this.renderer.forceContextLoss(); } catch (e) {}
    }
    this.remotePlayers && this.remotePlayers.clear();
    this.obstacles && (this.obstacles.length = 0);
    this.scene = null;
    this.renderer = null;
    this.camera = null;
  }
}

// Global game engine instance
let gameEngine = null;
