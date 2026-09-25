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
  { kind: "wall", x: 0, z: -11, width: 0.45, depth: 14, height: 2.8, color: "#d5b995", blocksMovement: true },
  { kind: "wall", x: 0, z: 11, width: 0.45, depth: 14, height: 2.8, color: "#d5b995", blocksMovement: true },
  { kind: "wall", x: -14.5, z: 0, width: 19, depth: 0.45, height: 2.8, color: "#d5b995", blocksMovement: true },
  { kind: "wall", x: 14.5, z: 0, width: 19, depth: 0.45, height: 2.8, color: "#d5b995", blocksMovement: true },

  { kind: "rug", x: -15, z: -10, width: 11, depth: 7, height: 0.08, color: "#b97862" },
  { kind: "sofa", x: -15.5, z: -7, width: 7, depth: 3.3, height: 1.35, color: "#668f91", blocksMovement: true },
  { kind: "table", x: -9.5, z: -12, width: 3.5, depth: 2.5, height: 0.85, color: "#986d48", blocksMovement: true },
  { kind: "bookshelf", x: -4, z: -13, width: 3, depth: 6, height: 2.35, color: "#806044", blocksMovement: true },
  { kind: "plant", x: -21, z: -14, width: 2, depth: 2, height: 1.6, color: "#72915c", blocksMovement: true },

  { kind: "counter", x: 13, z: -15, width: 13, depth: 2.6, height: 1.65, color: "#9b7656", blocksMovement: true },
  { kind: "counter", x: 8, z: -9.5, width: 5, depth: 2.5, height: 1.45, color: "#c49d6b", blocksMovement: true },
  { kind: "table", x: 17.5, z: -5, width: 5.5, depth: 3.1, height: 0.9, color: "#a47c52", blocksMovement: true },
  { kind: "chair", x: 13.5, z: -5, width: 1.5, depth: 1.5, height: 1.25, color: "#638c91", blocksMovement: true },
  { kind: "chair", x: 21.5, z: -5, width: 1.5, depth: 1.5, height: 1.25, color: "#638c91", blocksMovement: true },
  { kind: "plant", x: 21, z: -13, width: 2, depth: 2, height: 1.7, color: "#82985e", blocksMovement: true },

  { kind: "rug", x: -15, z: 10, width: 10, depth: 8, height: 0.08, color: "#729395" },
  { kind: "bed", x: -15, z: 9, width: 7, depth: 5.5, height: 1.15, color: "#668f91", blocksMovement: true },
  { kind: "table", x: -20, z: 4, width: 2.2, depth: 2, height: 0.75, color: "#986d48", blocksMovement: true },
  { kind: "table", x: -10, z: 4, width: 2.2, depth: 2, height: 0.75, color: "#986d48", blocksMovement: true },
  { kind: "wardrobe", x: -4, z: 13, width: 5, depth: 2.8, height: 2.5, color: "#896848", blocksMovement: true },
  { kind: "plant", x: -21, z: 14, width: 2, depth: 2, height: 1.6, color: "#6f915d", blocksMovement: true },

  { kind: "table", x: 12, z: 7, width: 6.5, depth: 2.5, height: 0.95, color: "#9e764f", blocksMovement: true },
  { kind: "chair", x: 12, z: 4, width: 1.8, depth: 1.8, height: 1.3, color: "#658e91", blocksMovement: true },
  { kind: "bookshelf", x: 20.5, z: 10, width: 3, depth: 10, height: 2.45, color: "#806044", blocksMovement: true },
  { kind: "counter", x: 5, z: 14, width: 4, depth: 2.4, height: 1.2, color: "#b18a61", blocksMovement: true },
  { kind: "rug", x: 0, z: 0, width: 6, depth: 5, height: 0.06, color: "#b8a37d" },
];
const houseObstacles: MapDefinition["obstacles"] = houseDecorations
  .filter((decoration) => decoration.blocksMovement)
  .map(({ x, z, width, depth }) => ({ minX: x - width / 2, maxX: x + width / 2, minZ: z - depth / 2, maxZ: z + depth / 2 }));

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
    spawnPoints: makeSpawns(houseBounds, houseObstacles),
    decorations: houseDecorations,
  },
};
