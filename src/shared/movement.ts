import type { MapDefinition, MoveInput, PlayerPose } from "./types";

const SPEED = 6;
const PLAYER_RADIUS = 0.55;

export function applyMovement(position: PlayerPose, input: MoveInput, dtSeconds: number, map: MapDefinition): PlayerPose {
  const rawX = Number.isFinite(input.moveX) ? input.moveX : 0;
  const rawZ = Number.isFinite(input.moveZ) ? input.moveZ : 0;
  const magnitude = Math.hypot(rawX, rawZ);
  const scale = magnitude > 1 ? 1 / magnitude : 1;
  const dt = Math.max(0, Math.min(Number.isFinite(dtSeconds) ? dtSeconds : 0, 0.1));
  const rawYaw = Number.isFinite(input.yaw) ? input.yaw : position.yaw;
  const yaw = Math.atan2(Math.sin(rawYaw), Math.cos(rawYaw));
  const nextX = position.x + rawX * scale * SPEED * dt;
  const nextZ = position.z + rawZ * scale * SPEED * dt;
  const x = Math.max(map.bounds.minX + PLAYER_RADIUS, Math.min(map.bounds.maxX - PLAYER_RADIUS, nextX));
  const z = Math.max(map.bounds.minZ + PLAYER_RADIUS, Math.min(map.bounds.maxZ - PLAYER_RADIUS, nextZ));
  const blocked = map.obstacles.some((o) => x + PLAYER_RADIUS > o.minX && x - PLAYER_RADIUS < o.maxX && z + PLAYER_RADIUS > o.minZ && z - PLAYER_RADIUS < o.maxZ);
  return blocked ? { ...position, yaw } : { x, z, yaw };
}
