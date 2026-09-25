import { useEffect, useRef } from "react";
import * as THREE from "three";
import type { MapId, MoveInput } from "../../shared/types";
import type { PlayerView } from "../../shared/types";
import { MAPS } from "../../shared/mapDefinitions";

type ScenePlayer = Pick<PlayerView, "id" | "nickname" | "role" | "x" | "z" | "yaw" | "camouflageHex" | "connected">;
export type SceneEffect = { id: string; x: number; z: number; kind: "decoy" | "scan"; expiresAt: number };

export function GameScene({ mapId, players, effects = [], myId, phase, onMove }: { mapId: MapId; players: ScenePlayer[]; effects?: SceneEffect[]; myId: string; phase: string; onMove: (move: MoveInput) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dataRef = useRef({ players, effects, myId, phase, onMove });
  useEffect(() => { dataRef.current = { players, effects, myId, phase, onMove }; }, [players, effects, myId, phase, onMove]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false }); }
    catch { canvas.parentElement?.classList.add("webgl-fallback"); return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6)); renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setClearColor("#19231c");
    const scene = new THREE.Scene(); scene.fog = new THREE.Fog("#19231c", 34, 74);
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 120); camera.position.set(0, 31, 34); camera.lookAt(0, 0, 0);
    scene.add(new THREE.HemisphereLight("#d9edcf", "#202c23", 2.1));
    const sun = new THREE.DirectionalLight("#fff5d8", 3); sun.position.set(-14, 24, 15); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); scene.add(sun);
    const map = MAPS[mapId];
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(map.bounds.maxX - map.bounds.minX, map.bounds.maxZ - map.bounds.minZ), new THREE.MeshStandardMaterial({ color: floorColor(mapId), roughness: 0.92 })); floor.rotation.x = -Math.PI / 2; floor.position.set((map.bounds.minX + map.bounds.maxX) / 2, -0.08, (map.bounds.minZ + map.bounds.maxZ) / 2); floor.receiveShadow = true; scene.add(floor);
    const grid = new THREE.GridHelper(Math.max(map.bounds.maxX - map.bounds.minX, map.bounds.maxZ - map.bounds.minZ), 32, "#758c70", "#344337"); grid.position.y = -0.04; scene.add(grid);
    const boundary = new THREE.Mesh(new THREE.BoxGeometry(map.bounds.maxX - map.bounds.minX, 0.2, map.bounds.maxZ - map.bounds.minZ), new THREE.MeshBasicMaterial({ color: "#a9c392", wireframe: true, transparent: true, opacity: 0.18 })); boundary.position.set((map.bounds.minX + map.bounds.maxX) / 2, 0.02, (map.bounds.minZ + map.bounds.maxZ) / 2); scene.add(boundary);
    const props: THREE.Mesh[] = [];
    map.obstacles.forEach((obstacle, index) => {
      const width = obstacle.maxX - obstacle.minX; const depth = obstacle.maxZ - obstacle.minZ;
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, 2.2 + (index % 2) * 0.5, depth), new THREE.MeshStandardMaterial({ color: propColor(mapId, index), roughness: 0.8 }));
      mesh.position.set((obstacle.minX + obstacle.maxX) / 2, mesh.geometry.parameters.height / 2 - 0.05, (obstacle.minZ + obstacle.maxZ) / 2); mesh.castShadow = true; mesh.receiveShadow = true; scene.add(mesh); props.push(mesh);
      const top = new THREE.Mesh(new THREE.BoxGeometry(width * 0.92, 0.12, depth * 0.92), new THREE.MeshStandardMaterial({ color: mapId === "library" ? "#be986c" : mapId === "garden" ? "#b0a96f" : "#799b98", roughness: 0.72 })); top.position.set(mesh.position.x, mesh.position.y + 1.1 + (index % 2) * 0.25, mesh.position.z); scene.add(top);
    });
    addLandmarks(scene, mapId);

    const avatars = new Map<string, THREE.Group>();
    const effectMeshes = new Map<string, { group: THREE.Group; ring: THREE.Mesh }>();
    const avatarGeometry = new THREE.CapsuleGeometry(0.46, 0.75, 4, 8);
    const headGeometry = new THREE.SphereGeometry(0.29, 12, 10);
    const keyState = new Set<string>();
    const joystick = { x: 0, z: 0 };
    let mouseYaw: number | null = null;
    const keyDown = (event: KeyboardEvent) => { if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(event.key.toLowerCase())) { keyState.add(event.key.toLowerCase()); event.preventDefault(); } };
    const keyUp = (event: KeyboardEvent) => keyState.delete(event.key.toLowerCase());
    const onMouseMove = (event: PointerEvent) => { if (event.pointerType !== "mouse") return; const rect = canvas.getBoundingClientRect(); const x = (event.clientX - rect.left) / rect.width - 0.5; const y = (event.clientY - rect.top) / rect.height - 0.5; if (Math.hypot(x, y) > 0.04) mouseYaw = Math.atan2(x, -y); };
    window.addEventListener("keydown", keyDown); window.addEventListener("keyup", keyUp);
    canvas.addEventListener("pointermove", onMouseMove);
    const joystickPad = canvas.parentElement?.querySelector<HTMLElement>(".touch-stick");
    const onPointer = (event: PointerEvent) => { if (!joystickPad) return; const rect = joystickPad.getBoundingClientRect(); joystick.x = Math.max(-1, Math.min(1, (event.clientX - (rect.left + rect.width / 2)) / (rect.width / 2))); joystick.z = Math.max(-1, Math.min(1, (event.clientY - (rect.top + rect.height / 2)) / (rect.height / 2))); };
    const clearStick = () => { joystick.x = 0; joystick.z = 0; };
    joystickPad?.addEventListener("pointerdown", (event) => { joystickPad.setPointerCapture(event.pointerId); onPointer(event); }); joystickPad?.addEventListener("pointermove", onPointer); joystickPad?.addEventListener("pointerup", clearStick); joystickPad?.addEventListener("pointercancel", clearStick);

    let animationFrame = 0; let lastMoveSent = 0;
    const clock = new THREE.Clock();
    const frame = () => {
      const dt = Math.min(clock.getDelta(), 0.05); const current = dataRef.current;
      for (const effect of current.effects) {
        let visual = effectMeshes.get(effect.id);
        if (!visual) {
          const group = new THREE.Group();
          const ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.09, 8, 40), new THREE.MeshBasicMaterial({ color: effect.kind === "decoy" ? "#d2f06b" : "#72d9ef", transparent: true, opacity: 0.8 })); ring.rotation.x = Math.PI / 2; ring.position.y = 0.16; group.add(ring);
          if (effect.kind === "decoy") { const phantom = new THREE.Mesh(new THREE.CapsuleGeometry(0.46, 0.75, 4, 8), new THREE.MeshBasicMaterial({ color: "#d2f06b", transparent: true, opacity: 0.42 })); phantom.position.y = 0.78; group.add(phantom); }
          scene.add(group); visual = { group, ring }; effectMeshes.set(effect.id, visual);
        }
        const left = Math.max(0, Math.min(1, (effect.expiresAt - Date.now()) / (effect.kind === "decoy" ? 6000 : 3000)));
        const pulse = effect.kind === "decoy" ? 1.1 + (1 - left) * 1.4 : 1.2 + (1 - left) * 4.8;
        visual.group.position.set(effect.x, 0, effect.z); visual.ring.scale.setScalar(pulse); (visual.ring.material as THREE.MeshBasicMaterial).opacity = left * 0.8;
      }
      const effectIds = new Set(current.effects.map((effect) => effect.id));
      for (const [id, visual] of effectMeshes) if (!effectIds.has(id)) { scene.remove(visual.group); visual.group.traverse((object) => { if (object instanceof THREE.Mesh) { object.geometry.dispose(); (object.material as THREE.Material).dispose(); } }); effectMeshes.delete(id); }
      for (const player of current.players) {
        let group = avatars.get(player.id);
        if (!group) { group = new THREE.Group(); const material = new THREE.MeshStandardMaterial({ color: player.role === "seeker" ? "#ff775c" : (player.camouflageHex || "#a8c98b"), roughness: 0.65 }); const body = new THREE.Mesh(avatarGeometry, material); body.position.y = 0.77; body.castShadow = true; group.add(body); const head = new THREE.Mesh(headGeometry, new THREE.MeshStandardMaterial({ color: "#f0c7a2", roughness: 0.7 })); head.position.y = 1.48; head.castShadow = true; group.add(head); const pointer = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.5, 8), new THREE.MeshStandardMaterial({ color: player.role === "seeker" ? "#ffae5b" : "#d5e58b" })); pointer.rotation.x = Math.PI / 2; pointer.position.set(0, 1.15, -0.5); group.add(pointer); scene.add(group); avatars.set(player.id, group); }
        const body = group.children[0] as THREE.Mesh; (body.material as THREE.MeshStandardMaterial).color.set(player.role === "seeker" ? "#ff765d" : player.camouflageHex || "#a8c98b"); group.visible = player.connected || player.id === current.myId; group.position.x = THREE.MathUtils.damp(group.position.x, player.x, 13, dt); group.position.z = THREE.MathUtils.damp(group.position.z, player.z, 13, dt); group.rotation.y = player.yaw;
      }
      for (const [id, group] of avatars) if (!current.players.some((player) => player.id === id)) { scene.remove(group); avatars.delete(id); }
      const me = current.players.find((player) => player.id === current.myId);
      if (me && current.phase === "active") {
        const mx = (keyState.has("d") || keyState.has("arrowright") ? 1 : 0) - (keyState.has("a") || keyState.has("arrowleft") ? 1 : 0);
        const mz = (keyState.has("s") || keyState.has("arrowdown") ? 1 : 0) - (keyState.has("w") || keyState.has("arrowup") ? 1 : 0);
        const moveX = mx || joystick.x; const moveZ = mz || joystick.z;
        if (performance.now() - lastMoveSent > 45) { current.onMove({ moveX, moveZ, yaw: mouseYaw ?? (moveX || moveZ ? Math.atan2(moveX, -moveZ) : me.yaw) }); lastMoveSent = performance.now(); }
        const target = new THREE.Vector3(me.x, 0, me.z); camera.position.x = THREE.MathUtils.damp(camera.position.x, me.x, 1.5, dt); camera.position.z = THREE.MathUtils.damp(camera.position.z, me.z + 34, 1.5, dt); camera.lookAt(target);
      }
      renderer.render(scene, camera); animationFrame = requestAnimationFrame(frame);
    };
    const resize = () => { const width = canvas.clientWidth || 1; const height = canvas.clientHeight || 1; renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix(); };
    resize(); window.addEventListener("resize", resize); frame();
    return () => { cancelAnimationFrame(animationFrame); window.removeEventListener("resize", resize); window.removeEventListener("keydown", keyDown); window.removeEventListener("keyup", keyUp); canvas.removeEventListener("pointermove", onMouseMove); renderer.dispose(); scene.traverse((object) => { if (object instanceof THREE.Mesh) { object.geometry.dispose(); const material = object.material; if (Array.isArray(material)) material.forEach((item) => item.dispose()); else material.dispose(); } }); };
  }, [mapId]);

  return <div className="scene-stage"><canvas className="game-canvas" ref={canvasRef}/><div className="webgl-message"><b>อุปกรณ์นี้ยังไม่รองรับ WebGL 2</b><span>เปิดเกมบน Chrome, Edge หรือ Safari รุ่นล่าสุดเพื่อเล่นฉาก 3D</span></div><div className="touch-stick" aria-label="จอยควบคุมการเดิน"><span/></div><div className="scene-help">WASD / ลูกศรเดิน · เมาส์หันทิศ</div></div>;
}

function floorColor(mapId: MapId) { return mapId === "garden" ? "#344a32" : mapId === "library" ? "#3e342b" : "#263d3b"; }
function propColor(mapId: MapId, index: number) { const colors = mapId === "garden" ? ["#456340", "#5c7546", "#807c50"] : mapId === "library" ? ["#65462f", "#785638", "#5b493c"] : ["#456462", "#536f76", "#647874"]; return colors[index % colors.length]; }
function addLandmarks(scene: THREE.Scene, mapId: MapId) {
  const geometry = new THREE.CylinderGeometry(1.5, 1.5, 0.18, 20); const material = new THREE.MeshStandardMaterial({ color: mapId === "garden" ? "#c6a963" : mapId === "library" ? "#a48662" : "#77a5a1", roughness: 0.72 });
  const landmark = new THREE.Mesh(geometry, material); landmark.position.set(0, 0.02, 0); landmark.receiveShadow = true; scene.add(landmark);
  for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; const orb = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), new THREE.MeshStandardMaterial({ color: ["#9ed894", "#e0bc72", "#cf9476"][i % 3], emissive: "#243024", roughness: 0.5 })); orb.position.set(Math.cos(a) * 2.2, 0.5, Math.sin(a) * 2.2); scene.add(orb); }
}
