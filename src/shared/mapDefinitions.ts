import type { MapDecoration, MapDefinition, MapId } from "./types";

function makeSpawns(bounds: MapDefinition["bounds"], obstacles: MapDefinition["obstacles"]) {
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerZ = (bounds.minZ + bounds.maxZ) / 2;
  const radiusX = (bounds.maxX - bounds.minX) / 2 - 1.2;
  const radiusZ = (bounds.maxZ - bounds.minZ) / 2 - 1.2;
  const points = Array.from({ length: 128 }, (_, index) => {
    const angle = (index / 128) * Math.PI * 2;
    return { x: centerX + Math.cos(angle) * radiusX, z: centerZ + Math.sin(angle) * radiusZ, yaw: angle + Math.PI };
  });
  return points.filter((point) => !obstacles.some((o) => point.x > o.minX - 0.8 && point.x < o.maxX + 0.8 && point.z > o.minZ - 0.8 && point.z < o.maxZ + 0.8));
}

const houseBounds = { minX: -24, maxX: 24, minZ: -18, maxZ: 18 };
const houseDecorations: MapDecoration[] = [
  { kind: "wall", x: -23.75, z: 0, width: 0.5, depth: 36, height: 3.2, color: "#e4cba9", blocksMovement: true },
  { kind: "wall", x: 23.75, z: 0, width: 0.5, depth: 36, height: 3.2, color: "#e4cba9", blocksMovement: true },
  { kind: "wall", x: 0, z: -17.75, width: 48, depth: 0.5, height: 3.2, color: "#e4cba9", blocksMovement: true },
  { kind: "wall", x: 0, z: 17.75, width: 48, depth: 0.5, height: 3.2, color: "#e4cba9", blocksMovement: true },
  // A long, open hallway with doors into four distinct side rooms.
  ...[
    { x: -21, z: -4, width: 6, depth: 0.45 }, { x: -12.5, z: -4, width: 7, depth: 0.45 },
    { x: -3, z: -4, width: 8, depth: 0.45 }, { x: 9, z: -4, width: 8, depth: 0.45 }, { x: 20, z: -4, width: 8, depth: 0.45 },
    { x: -20.5, z: 4, width: 7, depth: 0.45 }, { x: -9.5, z: 4, width: 8, depth: 0.45 },
    { x: 3, z: 4, width: 10, depth: 0.45 }, { x: 17.5, z: 4, width: 13, depth: 0.45 },
  ].map((wall) => ({ kind: "wall" as const, ...wall, height: 2.8, color: "#527044", blocksMovement: true })),
  // Short room dividers leave door-sized openings into neighboring rooms.
  { kind: "wall", x: 0, z: -15.5, width: 0.45, depth: 5, height: 2.8, color: "#527044", blocksMovement: true },
  { kind: "wall", x: 0, z: -8.5, width: 0.45, depth: 5, height: 2.8, color: "#527044", blocksMovement: true },
  { kind: "wall", x: 0, z: 15.5, width: 0.45, depth: 5, height: 2.8, color: "#527044", blocksMovement: true },
  { kind: "wall", x: 0, z: 8.5, width: 0.45, depth: 5, height: 2.8, color: "#527044", blocksMovement: true },

  ...[
    { x: -17, z: -4, width: 2, depth: 0.55 }, { x: -8, z: -4, width: 2, depth: 0.55 },
    { x: 3, z: -4, width: 3.2, depth: 0.55 }, { x: 14.5, z: -4, width: 2.5, depth: 0.55 },
    { x: -15.5, z: 4, width: 2.5, depth: 0.55 }, { x: -3.5, z: 4, width: 2.5, depth: 0.55 }, { x: 9.5, z: 4, width: 2.5, depth: 0.55 },
    { x: 0, z: -12.5, width: 0.55, depth: 2 }, { x: 0, z: 12.5, width: 0.55, depth: 2 },
  ].map((frame) => ({ kind: "doorframe" as const, ...frame, height: 2.8, color: "#70482e", blocksMovement: false })),
  { kind: "sconce", x: -11.5, z: -3.72, width: 0.55, depth: 0.25, height: 2.1, color: "#f4d28f", rotation: 0 },
  { kind: "sconce", x: -3, z: -3.72, width: 0.55, depth: 0.25, height: 2.1, color: "#f4d28f", rotation: 0 },
  { kind: "sconce", x: 8.5, z: -3.72, width: 0.55, depth: 0.25, height: 2.1, color: "#f4d28f", rotation: 0 },
  { kind: "sconce", x: -9, z: 3.72, width: 0.55, depth: 0.25, height: 2.1, color: "#f4d28f", rotation: Math.PI },
  { kind: "sconce", x: 2, z: 3.72, width: 0.55, depth: 0.25, height: 2.1, color: "#f4d28f", rotation: Math.PI },
  { kind: "sconce", x: 17, z: 3.72, width: 0.55, depth: 0.25, height: 2.1, color: "#f4d28f", rotation: Math.PI },

  // The hallway is deliberately cluttered like a vintage mansion corridor.
  { kind: "bench", x: -15, z: -2.5, width: 4, depth: 0.9, height: 1.25, color: "#76523a", blocksMovement: true },
  { kind: "bench", x: 5, z: 2.55, width: 3.7, depth: 0.9, height: 1.25, color: "#76523a", blocksMovement: true },
  { kind: "vase", x: -9, z: 2.45, width: 1.15, depth: 1.15, height: 1.65, color: "#e7dfc5", blocksMovement: true },
  { kind: "vase", x: 13, z: -2.55, width: 1.15, depth: 1.15, height: 1.65, color: "#e7dfc5", blocksMovement: true },
  { kind: "banner", x: -5, z: 0, width: 15, depth: 5.5, height: 3.25, color: "#f0d98f" },
  { kind: "banner", x: 13, z: 0, width: 14, depth: 5.5, height: 3.25, color: "#e8a990" },
  { kind: "picture", x: -20, z: -3.72, width: 1.35, depth: 0.12, height: 1.5, color: "#bd9a5f", rotation: 0 },
  { kind: "picture", x: 7, z: -3.72, width: 1.35, depth: 0.12, height: 1.5, color: "#bd9a5f", rotation: 0 },
  { kind: "picture", x: -13, z: 3.72, width: 1.35, depth: 0.12, height: 1.5, color: "#bd9a5f", rotation: Math.PI },
  { kind: "picture", x: 20, z: 3.72, width: 1.35, depth: 0.12, height: 1.5, color: "#bd9a5f", rotation: Math.PI },

  // Furnished rooms off the hall give players routes and hiding places.
  { kind: "sofa", x: -16, z: -11, width: 6.5, depth: 3, height: 1.35, color: "#a66f51", blocksMovement: true },
  { kind: "table", x: -7, z: -12.5, width: 3.5, depth: 2.5, height: 0.85, color: "#80563a", blocksMovement: true },
  { kind: "vase", x: -21, z: -7, width: 1.35, depth: 1.35, height: 1.8, color: "#d7cba9", blocksMovement: true },
  { kind: "bookshelf", x: 16, z: -12.5, width: 3, depth: 8, height: 2.45, color: "#69482f", blocksMovement: true },
  { kind: "wardrobe", x: 7, z: -15.5, width: 4, depth: 2.3, height: 2.5, color: "#704a31", blocksMovement: true },
  { kind: "plant", x: 21, z: -7, width: 1.8, depth: 1.8, height: 1.6, color: "#71824d", blocksMovement: true },
  { kind: "bench", x: -15, z: 11.5, width: 4, depth: 1.1, height: 1.25, color: "#76523a", blocksMovement: true },
  { kind: "counter", x: -7, z: 13.5, width: 5, depth: 2.4, height: 1.25, color: "#8a6446", blocksMovement: true },
  { kind: "vase", x: -21, z: 7, width: 1.35, depth: 1.35, height: 1.8, color: "#d7cba9", blocksMovement: true },
  { kind: "bed", x: 15, z: 12.5, width: 7, depth: 5.5, height: 1.15, color: "#718b85", blocksMovement: true },
  { kind: "table", x: 7, z: 15, width: 3.2, depth: 2, height: 0.85, color: "#80563a", blocksMovement: true },
];
const houseObstacles: MapDefinition["obstacles"] = houseDecorations
  .filter((decoration) => decoration.blocksMovement)
  .map(({ x, z, width, depth }) => ({ minX: x - width / 2, maxX: x + width / 2, minZ: z - depth / 2, maxZ: z + depth / 2 }));
const hallwaySpawnCandidates: MapDefinition["spawnPoints"] = [];
for (let x = -21; x <= 21; x += 1.5) for (const z of [-2.25, 0, 2.25]) {
  if (!houseObstacles.some((obstacle) => x > obstacle.minX - 0.85 && x < obstacle.maxX + 0.85 && z > obstacle.minZ - 0.85 && z < obstacle.maxZ + 0.85)) {
    hallwaySpawnCandidates.push({ x, z, yaw: x < 0 ? Math.PI / 2 : -Math.PI / 2 });
  }
}
const houseSpawns = Array.from({ length: Math.min(50, hallwaySpawnCandidates.length) }, (_, index) => hallwaySpawnCandidates[Math.floor(index * hallwaySpawnCandidates.length / 50)]);

export const MAPS: Record<MapId, MapDefinition> = {
  lab: {
    id: "lab", label: "ห้องทดลองวิทย์", description: "หลบหลังโต๊ะทดลองและเครื่องมือ",
    bounds: { minX: -20, maxX: 20, minZ: -16, maxZ: 16 },
    obstacles: [
      { minX: -12, maxX: -7, minZ: -5, maxZ: 4 }, { minX: -2, maxX: 3, minZ: -7, maxZ: 1 },
      { minX: 8, maxX: 13, minZ: 4, maxZ: 11 }, { minX: -4, maxX: 1, minZ: 8, maxZ: 12 },
    ], spawnPoints: makeSpawns({ minX: -20, maxX: 20, minZ: -16, maxZ: 16 }, [
      { minX: -12, maxX: -7, minZ: -5, maxZ: 4 }, { minX: -2, maxX: 3, minZ: -7, maxZ: 1 },
      { minX: 8, maxX: 13, minZ: 4, maxZ: 11 }, { minX: -4, maxX: 1, minZ: 8, maxZ: 12 },
    ]),
  },
  library: {
    id: "library", label: "ห้องสมุด", description: "ชั้นหนังสือซ่อนตัวได้หลายมุม",
    bounds: { minX: -20, maxX: 20, minZ: -16, maxZ: 16 },
    obstacles: [
      { minX: -14, maxX: -11, minZ: -11, maxZ: 11 }, { minX: -5, maxX: -2, minZ: -9, maxZ: 8 },
      { minX: 4, maxX: 7, minZ: -11, maxZ: 11 }, { minX: 12, maxX: 15, minZ: -8, maxZ: 9 },
    ], spawnPoints: makeSpawns({ minX: -20, maxX: 20, minZ: -16, maxZ: 16 }, [
      { minX: -14, maxX: -11, minZ: -11, maxZ: 11 }, { minX: -5, maxX: -2, minZ: -9, maxZ: 8 },
      { minX: 4, maxX: 7, minZ: -11, maxZ: 11 }, { minX: 12, maxX: 15, minZ: -8, maxZ: 9 },
    ]),
  },
  garden: {
    id: "garden", label: "สวนโรงเรียน", description: "พุ่มไม้และแปลงดอกไม้กลางแจ้ง",
    bounds: { minX: -22, maxX: 22, minZ: -18, maxZ: 18 },
    obstacles: [
      { minX: -15, maxX: -9, minZ: -10, maxZ: -5 }, { minX: -4, maxX: 2, minZ: -14, maxZ: -9 },
      { minX: 8, maxX: 15, minZ: -8, maxZ: -2 }, { minX: -10, maxX: -4, minZ: 6, maxZ: 12 },
      { minX: 7, maxX: 13, minZ: 8, maxZ: 13 },
    ], spawnPoints: makeSpawns({ minX: -22, maxX: 22, minZ: -18, maxZ: 18 }, [
      { minX: -15, maxX: -9, minZ: -10, maxZ: -5 }, { minX: -4, maxX: 2, minZ: -14, maxZ: -9 },
      { minX: 8, maxX: 15, minZ: -8, maxZ: -2 }, { minX: -10, maxX: -4, minZ: 6, maxZ: 12 },
      { minX: 7, maxX: 13, minZ: 8, maxZ: 13 },
    ]),
  },
  house: {
    id: "house", label: "บ้านหลบซ่อน", description: "วิ่งผ่านห้องนั่งเล่น ครัว และห้องอ่านหนังสือ",
    bounds: houseBounds,
    obstacles: houseObstacles,
    spawnPoints: houseSpawns,
    decorations: houseDecorations,
  },
};
