import type { MapDefinition, MapId } from "./types";

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
};
