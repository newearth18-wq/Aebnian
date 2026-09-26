import * as THREE from './vendor/three.module.js';

const $ = id => document.getElementById(id);
const scene = new THREE.Scene();
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.55;
$('game').appendChild(renderer.domElement);
const camera = new THREE.PerspectiveCamera(68, innerWidth / innerHeight, .07, 90);
scene.add(camera);
const weapon=new THREE.Group();camera.add(weapon);weapon.position.set(.53,-.48,-.9);
const gunMat=new THREE.MeshStandardMaterial({color:'#2a3035',roughness:.42,metalness:.5});
const gunBody=new THREE.Mesh(new THREE.BoxGeometry(.26,.23,.7),gunMat);gunBody.position.set(0,0,-.12);weapon.add(gunBody);
const gunBarrel=new THREE.Mesh(new THREE.CylinderGeometry(.065,.08,.55,12),gunMat);gunBarrel.rotation.x=Math.PI/2;gunBarrel.position.set(0,.05,-.62);weapon.add(gunBarrel);
const gunGrip=new THREE.Mesh(new THREE.BoxGeometry(.17,.38,.18),gunMat);gunGrip.position.set(0,-.23,.12);gunGrip.rotation.x=-.22;weapon.add(gunGrip);weapon.visible=false;
const hemi = new THREE.HemisphereLight(0xffffff, 0x80858a, 2.25); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 2.3); sun.position.set(-7, 18, 5); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.camera.left = -25; sun.shadow.camera.right = 25; sun.shadow.camera.top = 25; sun.shadow.camera.bottom = -25; scene.add(sun);
const clock3d = new THREE.Clock();
const raycaster = new THREE.Raycaster();
const obstacles = [], solids = [], props = [], bots = [], hunters = [];
const keys = new Set();
const state = { active:false, finished:false, role:'hider', map:'backrooms', phase:'prep', time:30, yaw:0.5, pitch:.12, drag:false, part:'all', paintColor:'#e9e9e5', eyedropper:false, pose:0, tauntCooldown:0, lastShot:0, misses:0, targetNoise:0, mobileX:0, mobileY:0, sprint:false };
let mapGroup = new THREE.Group(), player, playerParts, previewSpin = 0, toastTimer;
scene.add(mapGroup);
const MAT = c => new THREE.MeshStandardMaterial({color:c, roughness:.83, metalness:0});
const colorOf = m => m?.color ? '#' + m.color.getHexString() : '#ededed';
function box(parent, x,y,z,w,h,d,color, solid=false, material=null) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), material || MAT(color));
  mesh.position.set(x,y,z); mesh.castShadow = h > .35; mesh.receiveShadow = true; parent.add(mesh);
  if (solid) { obstacles.push({x1:x-w/2,x2:x+w/2,z1:z-d/2,z2:z+d/2}); solids.push(mesh); }
  props.push(mesh); return mesh;
}
function cyl(parent,x,y,z,r1,r2,h,color,solid=false,segments=14){
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r1,r2,h,segments),MAT(color));m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);props.push(m);
  if(solid){obstacles.push({x1:x-r1,x2:x+r1,z1:z-r1,z2:z+r1});solids.push(m)}return m;
}
function sphere(parent,x,y,z,r,color){const m=new THREE.Mesh(new THREE.SphereGeometry(r,18,12),MAT(color));m.position.set(x,y,z);m.castShadow=true;parent.add(m);props.push(m);return m}
function plane(parent,x,y,z,w,d,color){const m=new THREE.Mesh(new THREE.PlaneGeometry(w,d),MAT(color));m.rotation.x=-Math.PI/2;m.position.set(x,y,z);m.receiveShadow=true;parent.add(m);props.push(m);return m}
function light(x,y,z,color=0xfff2d0,intensity=3,range=11){const l=new THREE.PointLight(color,intensity,range,1.8);l.position.set(x,y,z);mapGroup.add(l)}
function clearMap(){scene.remove(mapGroup);mapGroup.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material && !Array.isArray(o.material))o.material.dispose()});mapGroup=new THREE.Group();scene.add(mapGroup);obstacles.length=0;solids.length=0;props.length=0;bots.length=0;hunters.length=0}
function bounds(){box(mapGroup,0,2.1,-19,38,4.2,.4,'#cabd91',true);box(mapGroup,0,2.1,19,38,4.2,.4,'#cabd91',true);box(mapGroup,-19,2.1,0,.4,4.2,38,'#cabd91',true);box(mapGroup,19,2.1,0,.4,4.2,38,'#cabd91',true)}
function wall(x,z,w,d,color='#e4d69f'){box(mapGroup,x,2.05,z,w,4.1,d,color,true);box(mapGroup,x,3.88,z,w,.08,d,'#d7cca8')}
function makeBackrooms(){
  scene.background=new THREE.Color('#9e9781');scene.fog=new THREE.Fog('#bdb79e',17,54);sun.intensity=.35;hemi.intensity=2.3;
  plane(mapGroup,0,0,0,38,38,'#bbb59c');bounds();
  const tile=MAT('#c7c2aa');for(let x=-18;x<19;x+=2)for(let z=-18;z<19;z+=2){const p=plane(mapGroup,x,0.012,z,1.97,1.97,'#c4bda2');p.material=tile}
  wall(-11,-6,16,.5);wall(-2,-6,3,.5);wall(8,-6,12,.5);wall(-13,6,12,.5);wall(1,6,12,.5);wall(15,6,8,.5);
  wall(-6,-13,.5,11);wall(-6,0,.5,8);wall(7,-13,.5,11);wall(7,0,.5,8);wall(-6,13,.5,11);wall(7,13,.5,11);
  for(let x=-15;x<=15;x+=10)for(let z=-15;z<=15;z+=10){box(mapGroup,x,4.15,z,6,.08,2.8,'#e9eadf');light(x,3.92,z,0xfff0bf,2.8,11)}
  for(let x=-18;x<19;x+=3)for(let z=-18;z<19;z+=3){box(mapGroup,x,4.22,z,2.95,.03,.03,'#a7a18b');box(mapGroup,x,4.22,z,.03,.03,2.95,'#a7a18b')}
  // The abandoned furniture and black bags provide hiding cover.
  for(const [x,z,a] of [[-13,-12,0],[13,-12,.4],[-13,12,-.5],[13,12,.2],[-1,14,.1]]){
    const g=new THREE.Group();g.position.set(x,0,z);g.rotation.y=a;mapGroup.add(g);
    box(g,0,.42,0,2,.8,.85,'#735844');box(g,0,.9,.35,2,1,.25,'#694f3e');box(g,-.82,.8,-.15,.28,.7,.7,'#644b3a');box(g,.82,.8,-.15,.28,.7,.7,'#644b3a');
    obstacles.push({x1:x-1.2,x2:x+1.2,z1:z-.7,z2:z+.7});
  }
  for(const [x,z] of [[-3,-14],[15,-3],[-15,2],[2,14]]){box(mapGroup,x,.16,z,1.8,.3,1.1,'#a1855a',true);sphere(mapGroup,x+.65,.48,z,.35,'#202325')}
  for(const [x,z] of [[-9,0],[11,0],[-13,-16]]){box(mapGroup,x,.55,z,1.8,1.1,1.3,'#866f51',true);box(mapGroup,x,1.12,z,1.84,.06,1.34,'#ac9575')}
  box(mapGroup,-17,2.2,-7,.1,1.3,1.1,'#a47f62');box(mapGroup,17,2.2,7,.1,1.3,1.1,'#a47f62');
}
function makePlayroom(){
  scene.background=new THREE.Color('#abc8dd');scene.fog=new THREE.Fog('#b3c9d3',26,62);sun.intensity=3.2;hemi.intensity=2.1;
  plane(mapGroup,0,0,0,38,38,'#75a458');bounds();
  for(let x=-18;x<19;x+=2)for(let z=-18;z<19;z+=2)plane(mapGroup,x,.012,z,1.92,1.92,(x+z)%4===0?'#8db871':'#7ca85f');
  // Toy barn and play-house walls.
  wall(-10,-10,16,.6,'#986d4d');wall(-18,-2,.5,16,'#9c714e');wall(9,-13,17,.5,'#c3e0dd');wall(12,2,.5,15,'#bdd8d3');
  box(mapGroup,-10,3.8,-10,17,.32,2,'#76553d');box(mapGroup,-10,1,-2,12,2,.35,'#b07d55');
  for(let x=-17;x<=17;x+=5)box(mapGroup,x,2,-18.75,.07,4,.08,'#6e533a');
  for(const [x,z,c] of [[-13,4,'#e05947'],[-7,11,'#f0ce3d'],[1,12,'#379ac2'],[13,11,'#dd5d83'],[7,-3,'#e7843d']]){
    box(mapGroup,x,.48,z,2.4,.96,2.4,c,true);box(mapGroup,x,1,z,2.47,.12,2.47,'#f6eed1');
    sphere(mapGroup,x+.6,1.95,z,.34,c);box(mapGroup,x+.6,1.48,z,.03,.7,.03,'#e1ddd1');
  }
  for(const [x,z] of [[-2,-9],[16,-7],[-15,14]]){box(mapGroup,x,1.2,z,3.6,2.4,1,'#67839b',true);for(let i=0;i<3;i++)box(mapGroup,x, .3+i*.75,z+.54,3.7,.09,.16,'#dae4d8')}
  for(const [x,z,c] of [[4,4,'#f4db36'],[9,8,'#dd4c46'],[-3,5,'#3c91ca']]){cyl(mapGroup,x,.55,z,.7,.75,1.1,c,true);sphere(mapGroup,x,1.26,z,.38,'#fbf4e7')}
  for(let x=-13;x<=13;x+=13)for(let z=-13;z<=13;z+=13)light(x,4,z,0xffffff,2,13);
}
function makePool(){
  scene.background=new THREE.Color('#90c6e5');scene.fog=new THREE.Fog('#b3d9e8',32,70);sun.intensity=4.2;hemi.intensity=2.7;
  plane(mapGroup,0,0,0,38,38,'#e9ece7');bounds();
  const tile=MAT('#f0f3ed');for(let x=-18;x<19;x+=2)for(let z=-18;z<19;z+=2){const p=plane(mapGroup,x,.013,z,1.96,1.96,'#f0f3ed');p.material=tile}
  wall(-17,-4,.6,28,'#f4f6f5');wall(16,-10,.6,16,'#f4f6f5');
  box(mapGroup,0,.04,0,13,.07,10,'#219cc3');box(mapGroup,0,.05,0,12.4,.08,9.4,'#30bbd8');
  for(let x=-6;x<=6;x+=2)box(mapGroup,x,.09,-5,.06,.04,10,'#f5f7f5');
  for(const [x,z] of [[-8,-8],[8,-8],[-8,8],[8,8]]){box(mapGroup,x,.55,z,2.4,1.1,1.1,'#e7e1d0',true);box(mapGroup,x,1.15,z,2.5,.12,1.2,'#f8f8f3')}
  // Rainbow slides and poolside rings.
  for(let i=0;i<4;i++){const c=['#e64e4a','#f4c839','#51bb8c','#469bd1'][i];const g=new THREE.Group();g.position.set(-12+i*1.5,0,-13);mapGroup.add(g);const slide=box(g,0,1.65,2.5,1.2,.13,6,c);slide.rotation.x=-.35;box(g,-.5,1.7,2.5,.12,.45,6,c).rotation.x=-.35;box(g,.5,1.7,2.5,.12,.45,6,c).rotation.x=-.35}
  for(const [x,z,c] of [[12,11,'#f6a548'],[-12,10,'#e85f7a'],[14,-4,'#68cbd1']]){const ring=new THREE.Mesh(new THREE.TorusGeometry(.68,.25,10,22),MAT(c));ring.rotation.x=-Math.PI/2;ring.position.set(x,.3,z);ring.castShadow=true;mapGroup.add(ring);props.push(ring)}
  for(const x of [-14,14])for(const z of [-14,14]){cyl(mapGroup,x,2,z,.16,.16,4,'#c2cdd0');sphere(mapGroup,x,4,z,.5,'#fdf7de');light(x,3.9,z,0xffffff,2,15)}
}
function loadMap(which){clearMap();if(which==='playroom')makePlayroom();else if(which==='pool')makePool();else makeBackrooms()}

function makePerson(x,z,color='#ededeb',hunter=false){
  const root=new THREE.Group();root.position.set(x,0,z);scene.add(root);
  const model=new THREE.Group();root.add(model);
  const parts={head:[],body:[],arms:[],legs:[]};
  const add=(geo,px,py,pz,part)=>{const mesh=new THREE.Mesh(geo,MAT(color));mesh.position.set(px,py,pz);mesh.castShadow=true;mesh.receiveShadow=true;model.add(mesh);parts[part].push(mesh);return mesh};
  add(new THREE.SphereGeometry(.36,24,16),0,1.67,0,'head');
  const torso=add(new THREE.CapsuleGeometry(.31,.62,5,10),0,1.04,0,'body');torso.scale.z=.79;
  const l=add(new THREE.CapsuleGeometry(.115,.55,4,9),-.43,1.05,0,'arms');l.rotation.z=-.16;
  const r=add(new THREE.CapsuleGeometry(.115,.55,4,9),.43,1.05,0,'arms');r.rotation.z=.16;
  add(new THREE.CapsuleGeometry(.145,.48,4,9),-.19,.42,0,'legs');add(new THREE.CapsuleGeometry(.145,.48,4,9),.19,.42,0,'legs');
  const eyeMat=MAT('#343941');for(const ex of [-.115,.115]){const eye=new THREE.Mesh(new THREE.SphereGeometry(.035,8,8),eyeMat);eye.position.set(ex,1.69,-.33);model.add(eye)}
  if(hunter){const band=new THREE.Mesh(new THREE.TorusGeometry(.35,.055,6,20),MAT('#ea645e'));band.position.set(0,1.72,0);band.rotation.x=Math.PI/2;model.add(band);const gun=box(model,.5,1.02,-.18,.55,.16,.18,'#29323a');gun.castShadow=true}
  root.userData={parts,hunter,alive:true,pose:0,alert:0,waypoint:new THREE.Vector3(x,0,z),brain:0,phase:Math.random()*6};return root;
}
function tint(root,part,color){if(!root)return;const parts=root.userData.parts;const groups=part==='all'?Object.values(parts):[parts[part]];for(const meshes of groups)for(const m of meshes)m.material.color.set(color)}
function posePerson(root,pose){root.userData.pose=pose;const model=root.children[0];model.scale.set(1,[1,.7,.4][pose],1);model.position.y=0;if(pose===2)model.rotation.x=-.95;else model.rotation.x=0}
function removePeople(){for(const o of [...bots,...hunters,player].filter(Boolean))scene.remove(o);bots.length=0;hunters.length=0;player=null}
function free(x,z,r=.34){if(x<-18.3||x>18.3||z<-18.3||z>18.3)return false;return !obstacles.some(o=>x+r>o.x1&&x-r<o.x2&&z+r>o.z1&&z-r<o.z2)}
function move(root,dx,dz){const p=root.position;if(free(p.x+dx,p.z))p.x+=dx;if(free(p.x,p.z+dz))p.z+=dz}
function randomPlace(){for(let i=0;i<100;i++){const x=(Math.random()-.5)*32,z=(Math.random()-.5)*32;if(free(x,z,1))return [x,z]}return [0,0]}
function botPlace(){for(let i=0;i<100;i++){const [x,z]=randomPlace();if(distance({x,z},player.position)>7)return [x,z]}return randomPlace()}
function colorBot(bot,index){const schemes=[['#d9d0ab','#ded5b1','#a89e83'],['#728d68','#7d9b70','#6b8265'],['#b0bdc1','#d0dedf','#95a9b0'],['#9b775d','#ad8a68','#7f644f'],['#d4d1c6','#e6e3d8','#c1beb4']];const colors=schemes[index%schemes.length];tint(bot,'head',colors[0]);tint(bot,'body',colors[1]);tint(bot,'arms',colors[1]);tint(bot,'legs',colors[2]);if(index%3===1)posePerson(bot,1)}
function nextNavStep(from,to){
  const clamp=n=>Math.max(-18,Math.min(18,Math.round(n)));
  const sx=clamp(from.x),sz=clamp(from.z),tx=clamp(to.x),tz=clamp(to.z),key=(x,z)=>`${x},${z}`;
  const queue=[[sx,sz]],seen=new Set([key(sx,sz)]),prev=new Map();let best=[sx,sz],bestScore=Math.abs(sx-tx)+Math.abs(sz-tz);
  for(let qi=0;qi<queue.length&&qi<1600;qi++){
    const [x,z]=queue[qi],score=Math.abs(x-tx)+Math.abs(z-tz);if(score<bestScore){best=[x,z];bestScore=score}if(score===0)break;
    for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,nz=z+dz,k=key(nx,nz);if(seen.has(k)||!free(nx,nz,.43))continue;seen.add(k);prev.set(k,key(x,z));queue.push([nx,nz])}
  }
  let k=key(best[0],best[1]),first=k,start=key(sx,sz);while(prev.has(k)&&prev.get(k)!==start){k=prev.get(k);first=k}
  if(prev.get(k)===start)first=k;const [x,z]=first.split(',').map(Number);return new THREE.Vector3(x,0,z)
}
function lineClear(a,b){const dir=new THREE.Vector3(b.x-a.x,0,b.z-a.z);const len=dir.length();if(len<.1)return true;dir.normalize();const pos=new THREE.Vector3(a.x,1.1,a.z);raycaster.set(pos,dir);raycaster.far=len-.3;return raycaster.intersectObjects(solids,false).length===0}
function distance(a,b){return Math.hypot(a.x-b.x,a.z-b.z)}
function resetRound(){
  removePeople();state.active=true;state.finished=false;state.phase='prep';state.time=state.role==='hider'?30:15;state.misses=0;state.pose=0;state.tauntCooldown=0;state.targetNoise=0;state.yaw=state.role==='seeker'?0:.5;state.pitch=state.role==='seeker'?-.07:.12;
  const p=state.role==='hider'?[-2,1]:[0,15];player=makePerson(p[0],p[1],'#ecece8',state.role==='seeker');playerParts=player.userData.parts;
  if(state.role==='hider'){
    const hunter=makePerson(-15,-15,'#e8e8e5',true);hunter.userData.waypoint.set(-15,0,-15);hunters.push(hunter);
    for(let i=0;i<3;i++){const [x,z]=botPlace();const b=makePerson(x,z,'#ebeae6');colorBot(b,i);bots.push(b)}
  }else{
    for(let i=0;i<5;i++){const [x,z]=botPlace();const b=makePerson(x,z,'#ecece7');colorBot(b,i);bots.push(b)}
  }
  $('menu').classList.add('hidden');$('end').classList.add('hidden');$('hud').classList.remove('hidden');$('paintPanel').classList.add('hidden');
  $('roleIcon').textContent=state.role==='hider'?'◉':'🔎';$('roleLabel').textContent=state.role==='hider'?'ผู้ซ่อน':'ผู้หา';
  $('actions').classList.toggle('hidden',state.role==='seeker');$('crosshair').classList.toggle('hidden',state.role!=='seeker');
  weapon.visible=state.role==='seeker';
  $('status').textContent=state.role==='hider'?'WASD เดิน · เมาส์หมุนกล้อง · Shift วิ่ง':'WASD เดิน · ลากเมาส์เล็ง · คลิกยิงผู้ซ่อน';
  $('hint').textContent=state.role==='hider'?'ซ่อน ระบายสี แล้วอยู่ให้รอดจนหมดเวลา':'ยิงตัวละครที่พรางสีให้ครบ ยิงพลาดได้ไม่เกิน 4 ครั้ง';
  $('mobile').classList.toggle('hidden',!matchMedia('(pointer:coarse)').matches);
  $('mobileAct').textContent=state.role==='seeker'?'ยิง':'สี';
  toast(state.role==='hider'?'คุณเป็นผู้ซ่อน! มีเวลา 30 วินาทีเตรียมตัว':'คุณเป็นผู้หา! รอผู้ซ่อนเตรียมตัว 15 วินาที');updateHUD();
}

function toast(message){const el=$('toast');el.textContent=message;el.classList.remove('hidden');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.add('hidden'),3000)}
function updateHUD(){
  $('phaseLabel').textContent=state.phase==='prep'?'เตรียมซ่อน':'กำลังค้นหา';
  const seconds=Math.max(0,Math.ceil(state.time));$('clock').textContent=`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;
  $('hunterCount').textContent=hunters.length+(state.role==='seeker'?1:0);
  $('hiderCount').textContent=bots.filter(b=>b.userData.alive).length+(state.role==='hider'?1:0);
}
function finish(win,reason){if(state.finished)return;state.finished=true;state.active=false;document.exitPointerLock?.();$('end').classList.remove('hidden');$('endEyebrow').textContent=win?'ชนะแล้ว':'จบรอบ';$('endTitle').textContent=win?'คุณชนะ!':'คุณแพ้';$('endText').textContent=reason;}
function infectPlayer(){
  if(state.role!=='hider'||state.finished)return;
  state.role='seeker';state.misses=0;state.yaw=player.rotation.y;state.pitch=-.07;state.pose=0;posePerson(player,0);
  $('roleIcon').textContent='🔎';$('roleLabel').textContent='ผู้หา';$('actions').classList.add('hidden');$('paintPanel').classList.add('hidden');$('crosshair').classList.remove('hidden');weapon.visible=true;
  $('status').textContent='WASD เดิน · ลากเมาส์เล็ง · คลิกยิงผู้ซ่อน';$('hint').textContent='คุณติดเชื้อแล้ว ตามหาผู้ซ่อนที่เหลือ';$('mobileAct').textContent='ยิง';
  toast('ถูกจับแล้ว! เปลี่ยนเป็นผู้หา ตามหาคนที่เหลือ');updateHUD();
}
function updateMovement(dt){
  if(!player)return;
  const axisX=(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0)+state.mobileX;
  const axisZ=(keys.has('KeyW')||keys.has('ArrowUp')?1:0)-(keys.has('KeyS')||keys.has('ArrowDown')?1:0)+state.mobileY;
  const length=Math.hypot(axisX,axisZ);if(length<.05)return;
  const nx=axisX/Math.max(1,length), nz=axisZ/Math.max(1,length);
  const fast=keys.has('ShiftLeft')||keys.has('ShiftRight')||state.sprint;
  const speed=(fast?6.4:3.8)*(state.pose===0?1:.65);
  const dx=(Math.cos(state.yaw)*nx+Math.sin(state.yaw)*nz)*speed*dt;
  const dz=(Math.sin(state.yaw)*nx-Math.cos(state.yaw)*nz)*speed*dt;
  move(player,dx,dz);
  if(state.role==='hider')player.rotation.y=Math.atan2(dx,-dz);
  if(fast&&state.phase==='search'&&state.role==='hider')state.targetNoise=Math.max(state.targetNoise,1.2);
}
function wander(bot,dt,speed=1.7){
  const data=bot.userData;data.brain-=dt;
  if(data.brain<=0||distance(bot.position,data.waypoint)<.8){const [x,z]=randomPlace();data.waypoint.set(x,0,z);data.brain=2+Math.random()*4}
  const dir=new THREE.Vector3().subVectors(data.waypoint,bot.position);dir.y=0;dir.normalize();
  move(bot,dir.x*speed*dt,dir.z*speed*dt);bot.rotation.y=Math.atan2(dir.x,-dir.z);
}
function nearestHider(hunter){let best=null,score=-1;const possible=[player,...bots].filter(o=>o&&o.userData.alive&&!(o===player&&state.role==='seeker'));
  for(const h of possible){const dist=distance(hunter.position,h.position);if(dist>12||!lineClear(hunter.position,h.position))continue;
    const visual=h.userData.parts;const colors=[...visual.head,...visual.body,...visual.arms,...visual.legs].map(m=>m.material.color);
    const brightness=colors.reduce((s,c)=>s+c.r+c.g+c.b,0)/(colors.length*3);
    const visibility=(h.userData.pose===0?1:h.userData.pose===1?.72:.46)*(brightness>.77?1:.78);
    const range=(h===player&&state.targetNoise>0?14:8.7)*visibility;
    const s=range-dist;if(s>score){score=s;best=h}
  }
  return score>0?best:null;
}
function updateAI(dt){
  if(state.phase==='prep'){
    for(const b of bots){if(b.userData.brain>0)wander(b,dt,2.0);else if(Math.random()<.02){b.userData.brain=4+Math.random()*3}}
    return;
  }
  for(const b of bots){if(!b.userData.alive)continue;
    const threat=hunters.find(h=>distance(h.position,b.position)<3.2&&lineClear(h.position,b.position));
    if(threat){const away=new THREE.Vector3().subVectors(b.position,threat.position).normalize();move(b,away.x*dt*3.6,away.z*dt*3.6);b.rotation.y=Math.atan2(away.x,-away.z);continue}
    if(state.role==='seeker'){
      if(distance(b.position,player.position)<5&&Math.random()<dt*.8){b.userData.brain=2;wander(b,dt,3.4)}
      else if(Math.random()<dt*.16)wander(b,dt,1.2);
    }else if(Math.random()<dt*.07)wander(b,dt,1.4)}
  for(const hunter of hunters){hunter.userData.spawnGrace=Math.max(0,(hunter.userData.spawnGrace||0)-dt);const target=hunter.userData.spawnGrace>0?null:nearestHider(hunter);if(target){hunter.userData.waypoint.copy(target.position);hunter.userData.brain=1.7}else hunter.userData.brain-=dt;
    if(hunter.userData.brain<=0){const [x,z]=randomPlace();hunter.userData.waypoint.set(x,0,z);hunter.userData.brain=3+Math.random()*2}
    hunter.userData.navTick=(hunter.userData.navTick||0)-dt;
    if(hunter.userData.navTick<=0||!hunter.userData.navStep||distance(hunter.position,hunter.userData.navStep)<.6){hunter.userData.navStep=nextNavStep(hunter.position,hunter.userData.waypoint);hunter.userData.navTick=.65}
    const dir=new THREE.Vector3().subVectors(hunter.userData.navStep,hunter.position);dir.y=0;const d=dir.length();if(d>.1){dir.normalize();move(hunter,dir.x*dt*(target?2.7:1.9),dir.z*dt*(target?2.7:1.9));hunter.rotation.y=Math.atan2(dir.x,-dir.z)}
    if(target&&distance(hunter.position,target.position)<.95){if(target===player){infectPlayer()}else{target.userData.alive=false;scene.remove(target);const infected=makePerson(target.position.x,target.position.z,'#eeeeeb',true);infected.userData.spawnGrace=9;hunters.push(infected);toast('ผู้ซ่อนถูกจับและกลายเป็นผู้หา!');updateHUD()}}
  }
  if(state.role==='seeker'&&bots.every(b=>!b.userData.alive))finish(true,'ทีมผู้หาจับผู้ซ่อนครบทุกคนแล้ว');
}
function setCamera(dt){
  if(!player){camera.position.set(Math.sin(previewSpin)*11,7,Math.cos(previewSpin)*11);camera.lookAt(0,1,0);return}
  if(state.role==='seeker'){
    player.visible=false;camera.position.set(player.position.x,1.65,player.position.z);
    camera.rotation.order='YXZ';camera.rotation.y=state.yaw;camera.rotation.x=state.pitch;
  }else{
    player.visible=true;const p=player.position;const cdist=4.5,alt=2.25;
    const desired=new THREE.Vector3(p.x+Math.sin(state.yaw)*cdist,alt+state.pitch*3.2,p.z+Math.cos(state.yaw)*cdist);
    // Pull the camera forward when a wall blocks the view of the player.
    const origin=new THREE.Vector3(p.x,1.15,p.z);const direction=desired.clone().sub(origin);const len=direction.length();raycaster.set(origin,direction.normalize());raycaster.far=len;
    const hit=raycaster.intersectObjects(solids,false)[0];if(hit)desired.copy(origin).add(direction.multiplyScalar(Math.max(.45,hit.distance-.28)));
    camera.position.lerp(desired,Math.min(1,dt*12));camera.lookAt(p.x,1.08+state.pitch,p.z);
  }
}
function shoot(){
  if(!state.active||state.role!=='seeker'||state.phase!=='search')return;
  const now=performance.now();if(now-state.lastShot<420)return;state.lastShot=now;
  weapon.position.z=-.75;setTimeout(()=>weapon.position.z=-.9,110);
  const center=new THREE.Vector2(0,0);raycaster.setFromCamera(center,camera);raycaster.far=24;
  const candidates=bots.filter(b=>b.userData.alive).flatMap(b=>b.children[0].children.filter(o=>o.isMesh));
  const hits=raycaster.intersectObjects([...candidates,...solids],false);
  const first=hits[0];let victim=null;if(first)victim=bots.find(b=>b.userData.alive&&b.children[0].children.includes(first.object));
  if(victim){victim.userData.alive=false;scene.remove(victim);toast('เจอผู้ซ่อนแล้ว!');updateHUD();if(bots.every(b=>!b.userData.alive))finish(true,'คุณหาผู้ซ่อนครบทุกคนก่อนหมดเวลา')}
  else{state.misses++;$('hitflash').style.opacity='1';setTimeout(()=>$('hitflash').style.opacity='0',130);toast(`ยิงพลาด ${state.misses}/5`);if(state.misses>=5)finish(false,'กระสุนพลาดครบ 5 ครั้งแล้ว')}
}
function choosePart(part){state.part=part;document.querySelectorAll('[data-part]').forEach(b=>b.classList.toggle('active',b.dataset.part===part))}
function applyPaint(color){state.paintColor=color;tint(player,state.part,color);$('color').value=color;toast('ทาสีแล้ว! คลิกตัวละครเพื่อแต้มเฉพาะชิ้น')}
function togglePaint(){if(state.role!=='hider'||!state.active)return;state.eyedropper=false;$('eyeBtn').classList.remove('active');$('paintPanel').classList.toggle('hidden');$('paintBtn').classList.toggle('active',!$('paintPanel').classList.contains('hidden'));document.exitPointerLock?.()}
function taunt(){if(!state.active||state.role!=='hider')return;if(state.tauntCooldown>0){toast('รออีกสักครู่ก่อนส่งเสียง');return}state.tauntCooldown=8;state.targetNoise=5;toast('♪ วิ้ว! ผู้หาได้ยินเสียงคุณแล้ว');const ctx=new AudioContext(),osc=ctx.createOscillator(),gain=ctx.createGain();osc.type='sine';osc.frequency.setValueAtTime(850,ctx.currentTime);osc.frequency.exponentialRampToValueAtTime(1500,ctx.currentTime+.2);gain.gain.setValueAtTime(.12,ctx.currentTime);gain.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+.36);osc.connect(gain).connect(ctx.destination);osc.start();osc.stop(ctx.currentTime+.36)}
function cyclePose(){if(!state.active||state.role!=='hider')return;state.pose=(state.pose+1)%3;posePerson(player,state.pose);toast(['ยืน','หมอบ','นอนราบ'][state.pose])}
function pickColor(event){if(!state.eyedropper||!state.active)return;const rect=renderer.domElement.getBoundingClientRect();const uv=new THREE.Vector2((event.clientX-rect.left)/rect.width*2-1,-((event.clientY-rect.top)/rect.height)*2+1);raycaster.setFromCamera(uv,camera);const hit=raycaster.intersectObjects(props,false)[0];if(hit){const color=colorOf(hit.object.material);applyPaint(color)}else toast('เล็งวัตถุในฉากแล้วคลิกอีกครั้ง');state.eyedropper=false;$('eyeBtn').classList.remove('active')}
function dabPaint(event){if(!state.active||state.role!=='hider'||$('paintPanel').classList.contains('hidden'))return false;const rect=renderer.domElement.getBoundingClientRect();const uv=new THREE.Vector2((event.clientX-rect.left)/rect.width*2-1,-((event.clientY-rect.top)/rect.height)*2+1);raycaster.setFromCamera(uv,camera);const meshes=Object.values(playerParts).flat();const hit=raycaster.intersectObjects(meshes,false)[0];if(!hit)return false;hit.object.material.color.set(state.paintColor);toast('แต้มสีลงบนตัวละครแล้ว');return true}
function onResize(){camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)}
addEventListener('resize',onResize);
addEventListener('keydown',event=>{if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(event.code))event.preventDefault();keys.add(event.code);if(event.repeat)return;if(event.code==='KeyE')togglePaint();if(event.code==='KeyT')taunt();if(event.code==='KeyR')cyclePose();if(event.code==='Escape'&&state.eyedropper){state.eyedropper=false;toast('ยกเลิกดูดสี')}});
addEventListener('keyup',event=>keys.delete(event.code));
renderer.domElement.addEventListener('pointerdown',event=>{if(state.eyedropper){pickColor(event);return}if(dabPaint(event))return;state.drag=true;if(state.role==='seeker'&&state.active)shoot()});
addEventListener('pointerup',()=>state.drag=false);
addEventListener('pointermove',event=>{if(!state.active||!state.drag||state.eyedropper)return;state.yaw-=event.movementX*.004;state.pitch=THREE.MathUtils.clamp(state.pitch-event.movementY*.0035,-.42,.52)});
$('start').onclick=()=>{state.map=$('map').value;state.role=$('role').value;loadMap(state.map);resetRound()};
$('again').onclick=resetRound;
$('back').onclick=()=>{state.active=false;$('end').classList.add('hidden');$('hud').classList.add('hidden');$('menu').classList.remove('hidden');removePeople()};
$('paintBtn').onclick=togglePaint;$('closePaint').onclick=togglePaint;$('tauntBtn').onclick=taunt;$('poseBtn').onclick=cyclePose;
$('eyeBtn').onclick=()=>{state.eyedropper=true;$('eyeBtn').classList.add('active');toast('คลิกสีของผนังหรือวัตถุในฉาก')};
$('clearBtn').onclick=()=>applyPaint('#ecece8');$('color').oninput=e=>applyPaint(e.target.value);
document.querySelectorAll('[data-part]').forEach(b=>b.onclick=()=>choosePart(b.dataset.part));choosePart('all');
const palette=['#e9e8dc','#d7cfaa','#b7b196','#806c55','#5a4939','#2d2d2f','#9d6c4e','#d64843','#e7b84c','#7eac66','#367a94','#c5dde0','#e7c2ba','#f2f1ea','#8c94a4','#393e43'];
for(const color of palette){const b=document.createElement('button');b.style.background=color;b.title=color;b.setAttribute('aria-label',`ใช้สี ${color}`);b.onclick=()=>applyPaint(color);$('swatches').appendChild(b)}
// Touch movement uses a virtual joystick; dragging elsewhere rotates the camera.
const joy=$('joy'),nub=$('nub');function moveJoy(e){const rect=joy.getBoundingClientRect(),x=e.clientX-rect.left-rect.width/2,y=e.clientY-rect.top-rect.height/2,len=Math.hypot(x,y)||1,scale=Math.min(1,38/len);const xx=x*scale,yy=y*scale;nub.style.transform=`translate(${xx}px,${yy}px)`;state.mobileX=xx/38;state.mobileY=-yy/38}
joy.addEventListener('pointerdown',e=>{joy.setPointerCapture(e.pointerId);moveJoy(e)});joy.addEventListener('pointermove',e=>{if(joy.hasPointerCapture(e.pointerId))moveJoy(e)});joy.addEventListener('pointerup',()=>{state.mobileX=state.mobileY=0;nub.style.transform='' });
$('mobileRun').onpointerdown=()=>state.sprint=true;$('mobileRun').onpointerup=()=>state.sprint=false;$('mobileAct').onclick=()=>state.role==='seeker'?shoot():togglePaint();
function frame(){requestAnimationFrame(frame);const dt=Math.min(.045,clock3d.getDelta());previewSpin+=dt*.11;
  if(state.active&&!state.finished){state.time-=dt;state.tauntCooldown=Math.max(0,state.tauntCooldown-dt);state.targetNoise=Math.max(0,state.targetNoise-dt);if(state.time<=0){if(state.phase==='prep'){state.phase='search';state.time=state.role==='hider'?140:170;toast('เริ่มค้นหาแล้ว!')}else finish(state.role==='hider',state.role==='hider'?'คุณซ่อนรอดจนหมดเวลา':'หมดเวลา ยังหาผู้ซ่อนไม่ครบ')}
    updateMovement(dt);updateAI(dt);updateHUD()}
  setCamera(dt);renderer.render(scene,camera)
}
loadMap('backrooms');player=makePerson(-2,1,'#eeeeeb');setCamera(1);frame();
