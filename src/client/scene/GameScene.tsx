import { useEffect, useRef } from "react";
import * as THREE from "three";
import type { MapDecoration, MapId, MoveInput } from "../../shared/types";
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
    const map = MAPS[mapId];
    const mansion = mapId === "house";
    const clearColor = mansion ? "#28271e" : "#19231c";
    renderer.setClearColor(clearColor);
    const scene = new THREE.Scene(); scene.fog = new THREE.Fog(clearColor, mansion ? 58 : 34, mansion ? 105 : 74);
    const camera = new THREE.PerspectiveCamera(mansion ? 72 : 42, 1, 0.1, 120);
    camera.position.set(mansion ? -18 : 0, mansion ? 1.58 : 31, mansion ? 0 : 34); camera.lookAt(mansion ? -4 : 0, mansion ? 1.58 : 0, 0);
    scene.add(new THREE.HemisphereLight(mansion ? "#f0dfbd" : "#d9edcf", mansion ? "#302b20" : "#202c23", mansion ? 1.65 : 2.1));
    const sun = new THREE.DirectionalLight(mansion ? "#ffe0a4" : "#fff5d8", mansion ? 1.9 : 3); sun.position.set(-14, 24, 15); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); scene.add(sun);
    const sceneTextures: THREE.Texture[] = [];
    const checkerboard = mansion ? createCheckerboardTexture(map.bounds.maxX - map.bounds.minX, map.bounds.maxZ - map.bounds.minZ) : undefined;
    if (checkerboard) sceneTextures.push(checkerboard);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(map.bounds.maxX - map.bounds.minX, map.bounds.maxZ - map.bounds.minZ), new THREE.MeshStandardMaterial({ color: mansion ? "#ffffff" : floorColor(mapId), map: checkerboard, roughness: 0.92 })); floor.rotation.x = -Math.PI / 2; floor.position.set((map.bounds.minX + map.bounds.maxX) / 2, -0.08, (map.bounds.minZ + map.bounds.maxZ) / 2); floor.receiveShadow = true; scene.add(floor);
    let mansionCeiling: THREE.Group | undefined;
    if (mansion && map.decorations) {
      mansionCeiling = addHouseDecorations(scene, map.decorations, sceneTextures);
    } else {
      const grid = new THREE.GridHelper(Math.max(map.bounds.maxX - map.bounds.minX, map.bounds.maxZ - map.bounds.minZ), 32, "#758c70", "#344337"); grid.position.y = -0.04; scene.add(grid);
      const boundary = new THREE.Mesh(new THREE.BoxGeometry(map.bounds.maxX - map.bounds.minX, 0.2, map.bounds.maxZ - map.bounds.minZ), new THREE.MeshBasicMaterial({ color: "#a9c392", wireframe: true, transparent: true, opacity: 0.18 })); boundary.position.set((map.bounds.minX + map.bounds.maxX) / 2, 0.02, (map.bounds.minZ + map.bounds.maxZ) / 2); scene.add(boundary);
      map.obstacles.forEach((obstacle, index) => {
        const width = obstacle.maxX - obstacle.minX; const depth = obstacle.maxZ - obstacle.minZ;
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, 2.2 + (index % 2) * 0.5, depth), new THREE.MeshStandardMaterial({ color: propColor(mapId, index), roughness: 0.8 }));
        mesh.position.set((obstacle.minX + obstacle.maxX) / 2, mesh.geometry.parameters.height / 2 - 0.05, (obstacle.minZ + obstacle.maxZ) / 2); mesh.castShadow = true; mesh.receiveShadow = true; scene.add(mesh);
        const top = new THREE.Mesh(new THREE.BoxGeometry(width * 0.92, 0.12, depth * 0.92), new THREE.MeshStandardMaterial({ color: mapId === "library" ? "#be986c" : mapId === "garden" ? "#b0a96f" : "#799b98", roughness: 0.72 })); top.position.set(mesh.position.x, mesh.position.y + 1.1 + (index % 2) * 0.25, mesh.position.z); scene.add(top);
      });
      addLandmarks(scene, mapId);
    }

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
      if (mansionCeiling) mansionCeiling.visible = current.phase === "active";
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
        const body = group.children[0] as THREE.Mesh; (body.material as THREE.MeshStandardMaterial).color.set(player.role === "seeker" ? "#ff765d" : player.camouflageHex || "#a8c98b"); group.visible = (player.connected || player.id === current.myId) && !(mansion && current.phase === "active" && player.id === current.myId); group.position.x = THREE.MathUtils.damp(group.position.x, player.x, 13, dt); group.position.z = THREE.MathUtils.damp(group.position.z, player.z, 13, dt); group.rotation.y = player.yaw;
      }
      for (const [id, group] of avatars) if (!current.players.some((player) => player.id === id)) { scene.remove(group); avatars.delete(id); }
      const me = current.players.find((player) => player.id === current.myId);
      if (me && current.phase === "active") {
        const mx = (keyState.has("d") || keyState.has("arrowright") ? 1 : 0) - (keyState.has("a") || keyState.has("arrowleft") ? 1 : 0);
        const mz = (keyState.has("s") || keyState.has("arrowdown") ? 1 : 0) - (keyState.has("w") || keyState.has("arrowup") ? 1 : 0);
        const inputX = mx || joystick.x; const inputZ = mz || joystick.z;
        let moveX = inputX; let moveZ = inputZ;
        const yaw = mouseYaw ?? (inputX || inputZ ? Math.atan2(inputX, -inputZ) : me.yaw);
        if (mansion) {
          const facingSin = Math.sin(yaw); const facingCos = Math.cos(yaw);
          moveX = inputX * facingCos - inputZ * facingSin;
          moveZ = inputX * facingSin + inputZ * facingCos;
        }
        if (performance.now() - lastMoveSent > 45) { current.onMove({ moveX, moveZ, yaw: mansion ? yaw : mouseYaw ?? (moveX || moveZ ? Math.atan2(moveX, -moveZ) : me.yaw) }); lastMoveSent = performance.now(); }
        if (mansion) {
          camera.position.x = THREE.MathUtils.damp(camera.position.x, me.x, 16, dt);
          camera.position.y = THREE.MathUtils.damp(camera.position.y, 1.58, 16, dt);
          camera.position.z = THREE.MathUtils.damp(camera.position.z, me.z, 16, dt);
          camera.lookAt(me.x + Math.sin(yaw) * 14, 1.58, me.z - Math.cos(yaw) * 14);
        } else {
          const target = new THREE.Vector3(me.x, 0, me.z); camera.position.x = THREE.MathUtils.damp(camera.position.x, me.x, 1.5, dt); camera.position.z = THREE.MathUtils.damp(camera.position.z, me.z + 34, 1.5, dt); camera.lookAt(target);
        }
      }
      renderer.render(scene, camera); animationFrame = requestAnimationFrame(frame);
    };
    const resize = () => { const width = canvas.clientWidth || 1; const height = canvas.clientHeight || 1; renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix(); };
    resize(); window.addEventListener("resize", resize); frame();
    return () => { cancelAnimationFrame(animationFrame); window.removeEventListener("resize", resize); window.removeEventListener("keydown", keyDown); window.removeEventListener("keyup", keyUp); canvas.removeEventListener("pointermove", onMouseMove); renderer.dispose(); scene.traverse((object) => { if (object instanceof THREE.Mesh) { object.geometry.dispose(); const material = object.material; if (Array.isArray(material)) material.forEach((item) => item.dispose()); else material.dispose(); } }); sceneTextures.forEach((texture) => texture.dispose()); };
  }, [mapId]);

  return <div className="scene-stage"><canvas className="game-canvas" ref={canvasRef}/><div className="webgl-message"><b>อุปกรณ์นี้ยังไม่รองรับ WebGL 2</b><span>เปิดเกมบน Chrome, Edge หรือ Safari รุ่นล่าสุดเพื่อเล่นฉาก 3D</span></div><div className="touch-stick" aria-label="จอยควบคุมการเดิน"><span/></div><div className="scene-help">WASD / ลูกศรเดิน · เมาส์หันทิศ</div></div>;
}

function floorColor(mapId: MapId) { return mapId === "house" ? "#c5a77f" : mapId === "garden" ? "#344a32" : mapId === "library" ? "#3e342b" : "#263d3b"; }
function propColor(mapId: MapId, index: number) { const colors = mapId === "garden" ? ["#456340", "#5c7546", "#807c50"] : mapId === "library" ? ["#65462f", "#785638", "#5b493c"] : ["#456462", "#536f76", "#647874"]; return colors[index % colors.length]; }

function createCheckerboardTexture(width: number, depth: number) {
  const canvas = document.createElement("canvas"); canvas.width = canvas.height = 128;
  const context = canvas.getContext("2d");
  if (!context) return undefined;
  const colors = ["#d5d0bd", "#41443a"];
  for (let row = 0; row < 4; row++) for (let column = 0; column < 4; column++) {
    context.fillStyle = colors[(row + column) % 2]; context.fillRect(column * 32, row * 32, 32, 32);
    context.strokeStyle = "#262820"; context.lineWidth = 1; context.strokeRect(column * 32 + 0.5, row * 32 + 0.5, 31, 31);
  }
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(width / 4, depth / 4); texture.anisotropy = 8;
  return texture;
}

function createWallpaperTexture(length: number, height: number) {
  const canvas = document.createElement("canvas"); canvas.width = canvas.height = 256;
  const context = canvas.getContext("2d");
  if (!context) return undefined;
  context.fillStyle = "#536945"; context.fillRect(0, 0, 256, 256);
  context.fillStyle = "#5f7748";
  for (let x = 0; x < 256; x += 64) context.fillRect(x, 0, 5, 256);
  for (let row = 0; row < 4; row++) for (let column = 0; column < 4; column++) {
    const x = column * 64 + 32; const y = row * 64 + 32;
    context.strokeStyle = "#a4a76c"; context.lineWidth = 1.5;
    context.beginPath(); context.moveTo(x, y - 27); context.quadraticCurveTo(x + 23, y, x, y + 27); context.quadraticCurveTo(x - 23, y, x, y - 27); context.stroke();
    context.strokeStyle = "#b4b477"; context.lineWidth = 2; context.beginPath(); context.moveTo(x, y - 21); context.bezierCurveTo(x + 5, y - 5, x - 4, y + 8, x, y + 22); context.stroke();
    for (const side of [-1, 1]) for (let leaf = 0; leaf < 3; leaf++) {
      const leafY = y - 13 + leaf * 13; const leafX = x + side * (8 + (leaf % 2) * 3);
      context.fillStyle = leaf % 2 ? "#879d56" : "#a1a66b";
      context.beginPath(); context.moveTo(x, leafY); context.quadraticCurveTo(leafX + side * 11, leafY - 10, leafX + side * 10, leafY - 2); context.quadraticCurveTo(leafX + side * 3, leafY + 5, x, leafY); context.fill();
    }
    context.fillStyle = "#dbbd79"; context.beginPath(); context.arc(x, y, 2.3, 0, Math.PI * 2); context.fill();
  }
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(Math.max(1, length / 2), Math.max(1, height / 1.4)); texture.anisotropy = 8;
  return texture;
}

function createPortraitTexture() {
  const canvas = document.createElement("canvas"); canvas.width = 96; canvas.height = 128;
  const context = canvas.getContext("2d");
  if (!context) return undefined;
  context.fillStyle = "#b58d57"; context.fillRect(0, 0, 96, 128);
  context.fillStyle = "#27392c"; context.fillRect(8, 8, 80, 112);
  context.fillStyle = "#ddc596"; context.fillRect(14, 14, 68, 100);
  context.fillStyle = "#506447"; context.fillRect(20, 20, 56, 42);
  context.fillStyle = "#d0a579"; context.beginPath(); context.arc(48, 59, 15, 0, Math.PI * 2); context.fill();
  context.fillStyle = "#344334"; context.beginPath(); context.moveTo(20, 108); context.quadraticCurveTo(23, 69, 48, 72); context.quadraticCurveTo(73, 72, 76, 108); context.fill();
  context.fillStyle = "#c4a36b"; context.fillRect(29, 25, 38, 3);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 4;
  return texture;
}

function addHouseDecorations(scene: THREE.Scene, decorations: MapDecoration[], sceneTextures: THREE.Texture[]) {
  const addBox = (x: number, y: number, z: number, width: number, height: number, depth: number, color: string, roughness = 0.82) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), new THREE.MeshStandardMaterial({ color, roughness }));
    mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; scene.add(mesh); return mesh;
  };
  const addPart = (item: MapDecoration, dx: number, y: number, dz: number, width: number, height: number, depth: number, color: string) => addBox(item.x + dx, y, item.z + dz, width, height, depth, color);
  const addBanner = (item: MapDecoration) => {
    const colors = ["#e0a374", "#e9d88e", "#8eb8a0", "#c48771", "#f0e6c9"];
    for (const side of [-1, 1]) {
      const z = item.z + side * item.depth * 0.28;
      const points = Array.from({ length: 9 }, (_, index) => new THREE.Vector3(item.x - item.width / 2 + item.width * index / 8, item.height - 0.12 - Math.sin(index / 8 * Math.PI) * 0.24, z));
      const string = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color: "#604c37" })); scene.add(string);
      for (let x = -item.width / 2; x <= item.width / 2; x += 1.2) {
        const flag = new THREE.Shape(); flag.moveTo(-0.46, 0); flag.lineTo(0.46, 0); flag.lineTo(0, -0.62); flag.closePath();
        const mesh = new THREE.Mesh(new THREE.ShapeGeometry(flag), new THREE.MeshStandardMaterial({ color: colors[Math.abs(Math.round(x * 10)) % colors.length], side: THREE.DoubleSide, roughness: 0.8 }));
        mesh.position.set(item.x + x, item.height - 0.24 - Math.sin((x + item.width / 2) / item.width * Math.PI) * 0.24, z); mesh.castShadow = true; scene.add(mesh);
      }
    }
  };

  for (let x = -23; x <= 23; x += 1.5) addBox(x, -0.03, 0, 0.035, 0.018, 35, x % 3 === 0 ? "#87724f" : "#a08b65");
  for (const item of decorations) {
    const color = item.color ?? "#9e805d";
    switch (item.kind) {
      case "wall": {
        const alongX = item.width >= item.depth; const length = alongX ? item.width : item.depth; const thickness = alongX ? item.depth : item.width;
        addBox(item.x, item.height / 2, item.z, item.width, item.height, item.depth, "#394a36", 0.96);
        const wallpaperHeight = item.height - 1.12;
        const wallpaper = createWallpaperTexture(length, wallpaperHeight);
        if (wallpaper) sceneTextures.push(wallpaper);
        for (const side of [-1, 1]) {
          const offset = thickness / 2 + 0.025;
          const plane = new THREE.Mesh(new THREE.PlaneGeometry(length, wallpaperHeight), new THREE.MeshStandardMaterial({ color: "#ffffff", map: wallpaper, side: THREE.DoubleSide, roughness: 0.96 }));
          plane.position.y = 1.04 + wallpaperHeight / 2;
          if (alongX) { plane.position.x = item.x; plane.position.z = item.z + side * offset; plane.rotation.y = side > 0 ? 0 : Math.PI; }
          else { plane.position.x = item.x + side * offset; plane.position.z = item.z; plane.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2; }
          scene.add(plane);
          if (alongX) {
            addBox(item.x, 0.48, item.z + side * (thickness / 2 + 0.05), length, 0.96, 0.1, "#493b2c");
            addBox(item.x, 1, item.z + side * (thickness / 2 + 0.08), length + 0.04, 0.1, 0.16, "#a57b4d");
            for (let slat = -length / 2 + 0.35; slat < length / 2; slat += 0.8) addBox(item.x + slat, 0.5, item.z + side * (thickness / 2 + 0.11), 0.055, 0.82, 0.08, "#705239");
          } else {
            addBox(item.x + side * (thickness / 2 + 0.05), 0.48, item.z, 0.1, 0.96, length, "#493b2c");
            addBox(item.x + side * (thickness / 2 + 0.08), 1, item.z, 0.16, 0.1, length + 0.04, "#a57b4d");
            for (let slat = -length / 2 + 0.35; slat < length / 2; slat += 0.8) addBox(item.x + side * (thickness / 2 + 0.11), 0.5, item.z + slat, 0.08, 0.82, 0.055, "#705239");
          }
        }
        if (alongX) addBox(item.x, item.height - 0.08, item.z, length + 0.15, 0.16, thickness + 0.15, "#845f3c");
        else addBox(item.x, item.height - 0.08, item.z, thickness + 0.15, 0.16, length + 0.15, "#845f3c");
        break;
      }
      case "doorframe": {
        const alongX = item.width >= item.depth; const span = alongX ? item.width : item.depth; const post = 0.22;
        for (const side of [-1, 1]) {
          if (alongX) addBox(item.x + side * (span / 2 - post / 2), item.height / 2, item.z, post, item.height, item.depth + 0.12, color);
          else addBox(item.x, item.height / 2, item.z + side * (span / 2 - post / 2), item.width + 0.12, item.height, post, color);
        }
        if (alongX) addBox(item.x, item.height - 0.12, item.z, span + 0.16, 0.24, item.depth + 0.16, "#8c6743");
        else addBox(item.x, item.height - 0.12, item.z, item.width + 0.16, 0.24, span + 0.16, "#8c6743");
        break;
      }
      case "sconce": {
        const rotation = item.rotation ?? 0; const normalX = Math.sin(rotation); const normalZ = Math.cos(rotation);
        addBox(item.x - normalX * 0.08, item.height * 0.58, item.z - normalZ * 0.08, 0.28, 0.48, 0.12, "#493829");
        const glow = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.1, roughness: 0.35 }));
        glow.position.set(item.x + normalX * 0.2, item.height * 0.72, item.z + normalZ * 0.2); scene.add(glow);
        const light = new THREE.PointLight("#ffd99b", 1.15, 10, 2); light.position.copy(glow.position); scene.add(light);
        break;
      }
      case "picture": {
        const rotation = item.rotation ?? 0; const direction = rotation === 0 ? 1 : -1;
        addBox(item.x, 1.92, item.z, item.width, item.height, item.depth, color);
        const portrait = createPortraitTexture(); if (portrait) sceneTextures.push(portrait);
        const art = new THREE.Mesh(new THREE.PlaneGeometry(item.width - 0.2, item.height - 0.2), new THREE.MeshBasicMaterial({ map: portrait, side: THREE.DoubleSide }));
        art.position.set(item.x, 1.92, item.z + direction * (item.depth / 2 + 0.01)); art.rotation.y = rotation; scene.add(art);
        break;
      }
      case "banner": addBanner(item); break;
      case "bench": {
        addPart(item, 0, 0.58, 0, item.width, 0.22, item.depth, color);
        addPart(item, 0, 1.02, -item.depth * 0.34, item.width, 0.82, 0.18, "#4b3628");
        for (const dx of [-0.42, 0.42]) for (const dz of [-0.28, 0.28]) addPart(item, item.width * dx, 0.28, item.depth * dz, 0.18, 0.56, 0.18, "#493323");
        addPart(item, 0, 0.98, -item.depth * 0.34, item.width * 0.88, 0.06, 0.2, "#b28a58");
        break;
      }
      case "vase": {
        const profile = [new THREE.Vector2(0, 0), new THREE.Vector2(0.2, 0.02), new THREE.Vector2(0.36, 0.16), new THREE.Vector2(0.43, 0.37), new THREE.Vector2(0.35, 0.58), new THREE.Vector2(0.2, 0.76), new THREE.Vector2(0.18, 0.91), new THREE.Vector2(0.26, 0.94), new THREE.Vector2(0.25, 1), new THREE.Vector2(0.14, 1)];
        const vase = new THREE.Mesh(new THREE.LatheGeometry(profile, 10), new THREE.MeshStandardMaterial({ color, roughness: 0.26, metalness: 0.04 }));
        vase.scale.set(item.width, item.height, item.depth); vase.position.set(item.x, 0, item.z); vase.castShadow = true; scene.add(vase);
        break;
      }
      case "rug": {
        addBox(item.x, 0.005 + item.height / 2, item.z, item.width, item.height, item.depth, color);
        addBox(item.x, 0.018 + item.height, item.z - item.depth / 2 + 0.12, item.width - 0.3, 0.025, 0.08, "#e9d2ac");
        addBox(item.x, 0.018 + item.height, item.z + item.depth / 2 - 0.12, item.width - 0.3, 0.025, 0.08, "#e9d2ac");
        break;
      }
      case "sofa": {
        addPart(item, 0, 0.35, 0.08, item.width * 0.88, 0.62, item.depth * 0.78, color);
        addPart(item, 0, 0.83, -item.depth * 0.32, item.width * 0.82, 0.92, item.depth * 0.24, color);
        addPart(item, -item.width * 0.43, 0.56, 0.02, item.width * 0.14, 0.78, item.depth * 0.95, "#6b4837");
        addPart(item, item.width * 0.43, 0.56, 0.02, item.width * 0.14, 0.78, item.depth * 0.95, "#6b4837");
        for (let index = 0; index < 3; index++) addPart(item, (index - 1) * item.width * 0.25, 0.69, 0.16, item.width * 0.22, 0.12, item.depth * 0.46, "#c39876");
        break;
      }
      case "table": {
        const topY = item.height - 0.1;
        addBox(item.x, topY, item.z, item.width, 0.2, item.depth, color);
        for (const dx of [-0.42, 0.42]) for (const dz of [-0.38, 0.38]) addBox(item.x + item.width * dx, topY / 2, item.z + item.depth * dz, 0.16, topY, 0.16, "#493323");
        break;
      }
      case "bed": {
        addPart(item, 0, 0.25, 0, item.width, 0.45, item.depth, "#76523a");
        addPart(item, 0, 0.53, 0, item.width * 0.96, 0.28, item.depth * 0.94, "#e6d5b8");
        addPart(item, 0, 0.7, item.depth * 0.19, item.width * 0.9, 0.14, item.depth * 0.48, color);
        addPart(item, -item.width * 0.22, 0.83, -item.depth * 0.3, item.width * 0.3, 0.12, item.depth * 0.18, "#f4ead7");
        addPart(item, item.width * 0.22, 0.83, -item.depth * 0.3, item.width * 0.3, 0.12, item.depth * 0.18, "#f4ead7");
        addPart(item, 0, 0.72, -item.depth * 0.49, item.width * 1.03, item.height, 0.18, "#805d41");
        break;
      }
      case "bookshelf": {
        addBox(item.x, item.height / 2, item.z, item.width * 0.92, item.height, item.depth * 0.92, "#684b37");
        for (let level = 1; level < 5; level++) addPart(item, 0, item.height * level / 5, 0, item.width, 0.12, item.depth, "#b28a5d");
        for (let index = 0; index < 8; index++) {
          const bookColors = ["#bc6e58", "#e4bd72", "#6a9da0", "#d2d5b5"];
          const z = item.z - item.depth * 0.38 + index * item.depth * 0.1;
          addPart(item, 0, 0.35 + (index % 4) * 0.45, z, item.width * (index % 2 ? 0.35 : 0.48), 0.42, 0.35, bookColors[index % bookColors.length]);
        }
        break;
      }
      case "wardrobe": {
        addBox(item.x, item.height / 2, item.z, item.width, item.height, item.depth, color);
        addBox(item.x, item.height / 2, item.z + item.depth / 2 + 0.025, item.width * 0.46, item.height * 0.88, 0.07, "#b18a61");
        addBox(item.x + item.width * 0.27, item.height / 2, item.z + item.depth / 2 + 0.07, 0.08, 0.08, 0.08, "#ecd39c");
        break;
      }
      case "counter": {
        addBox(item.x, item.height * 0.42, item.z, item.width * 0.92, item.height * 0.82, item.depth * 0.9, color);
        addBox(item.x, item.height - 0.08, item.z, item.width + 0.14, 0.16, item.depth + 0.14, "#e5d2ad");
        for (let index = 0; index < Math.max(2, Math.floor(item.width / 2)); index++) {
          const doorX = item.x - item.width * 0.38 + index * item.width * 0.76 / (Math.max(2, Math.floor(item.width / 2)) - 1);
          addBox(doorX, item.height * 0.4, item.z + item.depth * 0.46, item.width * 0.16, item.height * 0.48, 0.06, "#bd9569");
        }
        break;
      }
      case "chair": {
        const seatY = item.height * 0.48;
        addBox(item.x, seatY, item.z, item.width * 0.85, 0.18, item.depth * 0.82, color);
        addBox(item.x, item.height * 0.78, item.z - item.depth * 0.36, item.width * 0.84, item.height * 0.38, 0.16, "#557e82");
        for (const dx of [-0.34, 0.34]) for (const dz of [-0.3, 0.3]) addBox(item.x + item.width * dx, seatY / 2, item.z + item.depth * dz, 0.12, seatY, 0.12, "#755337");
        break;
      }
      case "plant": {
        const pot = new THREE.Mesh(new THREE.CylinderGeometry(item.width * 0.32, item.width * 0.23, 0.55, 12), new THREE.MeshStandardMaterial({ color: "#b8755c", roughness: 0.9 }));
        pot.position.set(item.x, 0.28, item.z); pot.castShadow = true; scene.add(pot);
        const leaves = new THREE.Mesh(new THREE.IcosahedronGeometry(item.width * 0.42, 1), new THREE.MeshStandardMaterial({ color, roughness: 0.88 }));
        leaves.position.set(item.x, item.height * 0.72, item.z); leaves.castShadow = true; scene.add(leaves);
        for (let index = 0; index < 3; index++) {
          const leaf = new THREE.Mesh(new THREE.ConeGeometry(item.width * 0.15, item.height * 0.55, 6), new THREE.MeshStandardMaterial({ color: index % 2 ? "#628655" : color, roughness: 0.85 }));
          leaf.position.set(item.x + (index - 1) * item.width * 0.22, item.height * 0.7, item.z + (1 - index) * item.depth * 0.12); leaf.castShadow = true; scene.add(leaf);
        }
        break;
      }
    }
  }
  const ceiling = new THREE.Group();
  const ceilingPanel = new THREE.Mesh(new THREE.PlaneGeometry(48, 7.75), new THREE.MeshStandardMaterial({ color: "#30281f", roughness: 0.9, side: THREE.DoubleSide }));
  ceilingPanel.rotation.x = -Math.PI / 2; ceilingPanel.position.y = 3.42; ceiling.add(ceilingPanel);
  for (let x = -21; x <= 21; x += 6) {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.2, 7.8), new THREE.MeshStandardMaterial({ color: "#493526", roughness: 0.86 }));
    beam.position.set(x, 3.28, 0); beam.castShadow = true; ceiling.add(beam);
  }
  scene.add(ceiling);
  ceiling.visible = false;
  return ceiling;
}

function addLandmarks(scene: THREE.Scene, mapId: MapId) {
  const geometry = new THREE.CylinderGeometry(1.5, 1.5, 0.18, 20); const material = new THREE.MeshStandardMaterial({ color: mapId === "garden" ? "#c6a963" : mapId === "library" ? "#a48662" : "#77a5a1", roughness: 0.72 });
  const landmark = new THREE.Mesh(geometry, material); landmark.position.set(0, 0.02, 0); landmark.receiveShadow = true; scene.add(landmark);
  for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; const orb = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), new THREE.MeshStandardMaterial({ color: ["#9ed894", "#e0bc72", "#cf9476"][i % 3], emissive: "#243024", roughness: 0.5 })); orb.position.set(Math.cos(a) * 2.2, 0.5, Math.sin(a) * 2.2); scene.add(orb); }
}
