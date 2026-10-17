// Authored cover and landmarks, informed by the party-house and indoor farm
// in https://www.youtube.com/watch?v=2PiTmMtYNQc. Coordinates are map units;
// the engine scales x/z once. No random placement or borrowed video assets.
function mapWalkwayContains(map, x, z, padding = 0) {
  return (map.walkways || []).some(path => {
    const [ax, az, bx, bz, width] = path;
    const dx = bx - ax, dz = bz - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1)));
    return Math.hypot(x - ax - dx * t, z - az - dz * t) < width / 2 + padding;
  });
}

function applyMapUpgrades(maps) {
  const feature = (kind, x, z, extra = {}) => ({ type: 'mapfeature', kind, x, z, ...extra });
  const stack = (x, z, color, style = 'wood', extra = {}) => feature('coverstack', x, z, { color, style, ...extra });
  const screen = (x, z, color, ry = 0) => feature('screen', x, z, { color, ry });
  const loop = (x, z, half = 12) => [
    [x - half, z - half, x + half, z - half, 3], [x + half, z - half, x + half, z + half, 3],
    [x + half, z + half, x - half, z + half, 3], [x - half, z + half, x - half, z - half, 3]
  ];
  const upgrades = {
    meadow: { detail: 'โขดหินไล่ระดับ · กองท่อนไม้ · ทางเดินวนรอบทุ่ง', tip: 'ดูดสีหินหรือท่อนไม้ แล้วใช้ท่านั่งลดเงาตัวเอง',
      objects: [stack(-6, 4, 0x8c9182, 'stone'), feature('pipebundle', 8, 5, { color: 0x71513a, style: 'wood' }), screen(-10, -10, 0x587841)] },
    desert: { detail: 'ตลาดผ้าใบ · ลังเสบียงไล่ระดับ · ถังเก็บน้ำ', tip: 'สีทรายเหมาะกับโขดหิน ส่วนเสบียงมีมุมอับด้านหลัง',
      objects: [screen(11, -10, 0xb65d3e), stack(-1, 4, 0xc3a474), feature('tank', -15, 9, { color: 0x9ca5a2 }), feature('pipebundle', 13, 9, { color: 0xb8865b })] },
    classroom: { detail: 'มุมวัสดุศิลปะ · ชั้นเก็บงาน · กล่องอุปกรณ์ปีนได้', tip: 'พรางตัวกับฉากสีหรือกองอุปกรณ์ที่ขอบห้อง',
      objects: [screen(-31, 24, 0x4f927a), stack(27, 27, 0x547da4), feature('cargorack', -30, -30, { color: 0x8c6747 })] },
    forest: { detail: 'กองซุง · แคมป์ผ้าใบ · กองหินริมทาง', tip: 'สลับระหว่างแนวต้นไม้กับกองซุงเพื่อหลบสายตา',
      objects: [feature('pipebundle', 9, -4, { style: 'wood', color: 0x68503b }), screen(-8, 8, 0x3b624b), stack(-7, -10, 0x72766a, 'stone')] },
    snow: { detail: 'ก้อนน้ำแข็งไล่ระดับ · คลังเสบียง · กำบังสีน้ำเงิน', tip: 'น้ำแข็งมีสีฟ้าอ่อน ลองดูดสีก่อนเลือกท่านั่งหรือนอน',
      objects: [stack(-8, 8, 0xb9d7df, 'ice'), screen(10, -8, 0x45677c), stack(10, 10, 0x829da8, 'metal')] },
    city: { detail: 'มุมไซต์ก่อสร้าง · กองท่อ · ฉากกั้นริมถนน', tip: 'กองท่อและแผงกั้นช่วยตัดสายตาจากถนนหลัก',
      objects: [feature('pipebundle', -12, 8, { color: 0x717d84 }), screen(12, -10, 0xb1743c), stack(-11, -10, 0x7d8792, 'metal')] },
    ocean: { detail: 'ซากเสบียงใต้น้ำ · แนวท่อเก่า · หินปะการังหลายระดับ', tip: 'สีเขียวคราบทะเลและสีทรายกลืนกับซากได้ดี',
      objects: [feature('pipebundle', 10, -8, { color: 0x3d7c77 }), stack(-9, 7, 0x708e86, 'stone'), stack(10, 10, 0x8f7755)] },
    space: { detail: 'ถังทดลองเรืองแสง · เสบียงสถานี · แผงกั้นสีเข้ม', tip: 'ใช้สีเข้มด้านหลังแผงสถานี ระวังขอบเรืองแสง',
      objects: [feature('tank', -9, -9, { color: 0x377a80, glow: true }), stack(9, 9, 0x435d70, 'metal'), screen(-10, 9, 0x263847)] },
    volcano: { detail: 'กองหินดำ · อุปกรณ์สำรวจ · แนวท่อเหล็ก', tip: 'สีถ่านเหมาะกับกำบังหิน ส่วนโลหะใช้ผิวมันวาวได้',
      objects: [stack(-10, 8, 0x463e3c, 'stone'), feature('pipebundle', 10, 9, { color: 0x6e5750 }), screen(-9, -10, 0x815443)] },
    village: { detail: 'โกดังตลาด · ฉากผ้าใบ · กองลังแบ่งซอย', tip: 'อ้อมหลังแผงตลาดแล้วพรางกับเสบียงและผ้าใบ',
      objects: [feature('cargorack', -14, 10, { color: 0x9c7650 }), screen(12, -10, 0xb75f53), stack(13, 12, 0xa28054)] },
    nighttown: { detail: 'ลังของเก่า · ฉากงานเทศกาล · กองท่อในเงามืด', tip: 'พรางกับเงาด้านข้างแทนการยืนใต้โคมไฟ',
      objects: [stack(-11, 10, 0x59535c), screen(12, 8, 0x6b4162), feature('pipebundle', -12, -10, { color: 0x4c5355 })] },
    shopstreet: { detail: 'ทางส่งของหลังร้าน · ชั้นสินค้า · ฉากผ้าหลากสี', tip: 'แต่ละร้านมีมุมกำบังคนละสี ใช้ทางวนกลับเข้าถนน',
      objects: [feature('cargorack', -14, 12, { color: 0x9c6c4a }), screen(14, -10, 0x8b5c83), stack(15, 15, 0x74806d)] },
    laundry: { detail: 'รถเข็นผ้า · กองผ้าหลายระดับ · ฉากแบ่งช่องซัก', tip: 'สีตะกร้าหรือผ้าช่วยพรางตัว แล้วอ้อมปลายแถวเครื่องซัก',
      objects: [screen(-39, 44, 0x739eac), stack(38, 44, 0xb5c3d5, 'fabric'), feature('cargorack', 39, -44, { color: 0x7895a0 })] },
    school: { detail: 'ห้องศิลปะมีฉากสี · ห้องสมุดมีลังงาน · ทางเดินกลางโล่ง', tip: 'ใช้ประตูห้องเป็นทางวน หยุดโพสกับวัสดุที่สีใกล้กัน',
      objects: [screen(25, 18, 0x9c6ba4), stack(20, 25, 0xc39c59, 'fabric'), feature('cargorack', -10, 14, { color: 0x896b4b })] },
    mall: { detail: 'คลังสินค้าร้านค้า · แผงจัดแสดง · กองลังหลังเคาน์เตอร์', tip: 'แผงจัดแสดงตัดสายตาจากโถงกลาง ลองอ้อมด้านหลัง',
      objects: [screen(-24, -10, 0x6478a2), feature('cargorack', 24, 10, { color: 0x8a6573 }), stack(-23, 23, 0xc49c65)] },
    castle: { detail: 'กล่องสมบัติไล่ระดับ · ฉากผ้าญี่ปุ่น · คลังเสบียงสวน', tip: 'ผ้าสีแดงและลังไม้มีพื้นผิวให้ดูดสีและเลียนแบบ',
      objects: [screen(-17, 10, 0x983f3f), stack(17, 10, 0x9c794b), feature('cargorack', -18, -8, { color: 0x775638 })] }
  };
  Object.entries(upgrades).forEach(([id, upgrade]) => {
    const map = maps[id];
    map.objects.push(...upgrade.objects);
    map.description = upgrade.detail;
    map.hidingTip = upgrade.tip;
    map.walkways = id === 'school'
      ? [[0, -29, 0, 29, 3], ...[-20, 0, 20].map(z => [-23, z, 23, z, 2.4])]
      : id === 'classroom' ? [[0, 31, 0, -29, 3], [-29, 30, 29, 30, 3]]
      : id === 'laundry' ? [[0, 58, 0, -60, 3], [-40, 48, 40, 48, 3], [-40, -60, 40, -60, 3]]
      : [...loop(0, 0, 18), [0, (map.spawn || [0,0,8])[2], 0, 0, 3]];
  });

  // The clip's farm is an indoor agricultural exhibition, rather than an
  // enormous outdoor field. A central loop joins pens, stores and hay stacks.
  Object.assign(maps.farm, {
    name: '🚜 โรงนาฟาร์ม', size: 76, scale: 1, spawn: [0, 0, 29],
    sky: 0x428f99, ground: 0x87a263, groundTint: 0xc1cbaa, groundTexture: 'grass',
    walls: { base: '#40a3aa', pattern: '#38979d' }, ceiling: 0x9c9d80,
    light: .95, ambientColor: 0xb6d3cb, sunColor: 0xfff0cf, clouds: false,
    treeline: null, grassTufts: 0, fog: { color: 0x8daaa0, near: 60, far: 145 },
    description: 'ฟาร์มในอาคาร · คอกวัว · กองฟางปีนได้ · ถังน้ำและกองท่อ',
    hidingTip: 'พรางกับกองฟาง ถังน้ำ หรือท่อ แล้วใช้ทางวนออกทางข้างคอก',
    walkways: [...loop(0, 0, 27), [0, 29, 0, -29, 4], [-27, 0, 27, 0, 4]],
    scatterDensity: 1, scatter: [], grid: [],
    objects: [
      feature('barnfront', -16, -34),
      feature('mural', 0, -37.8, { w: 72, h: 7 }),
      feature('mural', -37.8, 0, { w: 72, h: 7, ry: Math.PI / 2 }),
      feature('pen', -17, -17, { color: 0xf1eee0 }),
      feature('pen', 17, -17, { color: 0xf1eee0 }),
      feature('cow', -18, -18, { ry: .3 }), feature('cow', 17, -19, { ry: -.6 }),
      stack(-17, 15, 0xd1ac57, 'hay'), stack(17, 15, 0xd1ac57, 'hay'),
      feature('hayroll', -23, 18), feature('hayroll', -23, 15),
      feature('hayroll', 22, 19), feature('hayroll', 21, 15, { y: 2.1 }),
      feature('hayroll', 21, 15),
      stack(-8, 8, 0xd1ac57, 'hay'), stack(8, 8, 0xcaa753, 'hay'),
      feature('pipebundle', 8, -7, { color: 0x547c73 }),
      feature('cargorack', -8, -7, { color: 0xa18a57 }),
      feature('harvestbed', -19, 2.8), feature('harvestbed', 19, 2.8),
      feature('hayroll', 17, 15, { y: 3.2 }),
      stack(-31, 33, 0x9b7b4b), stack(31, 33, 0x8b6d45),
      feature('tank', -31, -17, { color: 0x4e8b51 }),
      feature('tank', -31, -11, { color: 0x6a9a65 }),
      feature('tank', 31, 11, { color: 0x64886a }),
      feature('pipebundle', 31, -15, { color: 0x697a75 }),
      feature('cargorack', -31, 10, { color: 0x9c7749 }),
      feature('cargorack', 14, 33, { color: 0xa67c47 }),
      feature('trough', -17, -10), feature('trough', 17, -10),
      ...[-22, -18, 16, 21].map((x, i) => feature('produce', x, 8, { color: i % 2 ? 0xdd8d31 : 0x79a13f })),
      feature('sign', 0, -33, { text: 'FARM EXHIBITION', color: 0xf3e8a8, y: 5.5 }),
      feature('sign', -17, -26, { text: 'DAIRY', color: 0xc7e8dc, y: 4.5 }),
      feature('sign', 17, 26, { text: 'HARVEST', color: 0xf2ddb2, y: 4.5 })
    ],
    models: [
      { url: 'models/duck.glb', x: 20, z: -13, height: 1.1, ry: 1 },
      { url: 'models/horse.glb', x: -12, z: -20, height: 2.2, ry: -.6 },
      { url: 'models/crate.glb', x: -22, z: 31, height: 1.5, ry: .1 }
    ]
  });

  const party = maps.mansion;
  party.name = '🏰 คฤหาสน์ปาร์ตี้ 6 ห้อง';
  party.description = 'ห้องเขียว–น้ำเงิน · ลูกโป่งและสายรุ้ง · มุมเก็บของ · แท่นชมชั้นลอย';
  party.hidingTip = 'ห้องแต่ละสีมีของให้พรางต่างกัน ใช้ประตูห้องและทางเดินกลางอ้อมผู้หา';
  party.checkerColors = ['#e0ded4', '#343b3f'];
  party.walkways = [[0,-29,0,29,3], ...[-20,0,20].map(z => [-24,z,24,z,2.5])];
  party.scatterDensity = .65;
  party.objects.push(
    feature('bunting', 0, -19, { w: 8, y: 7 }), feature('bunting', 0, 1, { w: 8, y: 7 }),
    feature('bunting', -17, -18, { w: 15, y: 7 }), feature('bunting', 17, 18, { w: 15, y: 7 }),
    feature('balloons', -3, -8), feature('balloons', 3, 9),
    feature('balloons', -25, -26), feature('balloons', 25, 25),
    feature('roompanel', 29.25, 20, { w: 22, color: 0x324b7d, ry: -Math.PI/2, style: 'diamond' }),
    feature('roompanel', 4.65, 14, { w: 8, ry: Math.PI/2 }),
    feature('roompanel', 4.65, 26, { w: 8, ry: Math.PI/2 }),
    feature('roompanel', 17, 10.65, { w: 28.4 }),
    feature('roompanel', 17, 29.25, { w: 28.4, ry: Math.PI }),
    feature('roomfloor', 17, 20, { w: 28.4, d: 22.2 }),
    screen(24, 24, 0x588cb5), stack(10, -26, 0x8467a6, 'fabric'),
    feature('cargorack', -26, 24, { color: 0x71543b }),
    feature('loft', 18, 5, { color: 0x735038, ry: Math.PI / 2 }),
    feature('sign', 0, -28, { text: 'CHAMELEON PARTY', y: 6.4, color: 0xf4dea5 })
  );

  Object.assign(maps.hallway, {
    name: '🏛️ โถงบ้านปาร์ตี้', size: 44, scale: 1.2, spawn: [0,0,16], scatterDensity: .65,
    walls: { base: '#477144', pattern: '#6b8951', motif: 'damask' }, wainscot: true,
    checkerColors: ['#e3dfd3','#353c3c'],
    description: 'โถงลายตาราง · ฉากสายรุ้ง · ห้องรับแขก · ทางอ้อมกองลัง',
    hidingTip: 'ฉากผ้าและของเก็บข้างห้องตัดสายตา ทางกลางใช้วิ่งกลับได้',
    walkways: [...loop(0,0,15), [0,16,0,-16,3]],
    interiorWalls: [{x:-8,z:0,w:1,d:12},{x:8,z:0,w:1,d:12}]
  });
  maps.hallway.objects.push(feature('bunting',0,4,{w:13,y:7}),feature('balloons',-7,10),
    feature('balloons',7,-10),screen(-14,-8,0x644c8b),stack(14,10,0x98734e),
    feature('cargorack',-15,15,{color:0x76543d}),feature('roompanel',21.7,0,{w:36,color:0x344e7d,ry:-Math.PI/2,style:'diamond'}));
  maps.mall.spawn = [0,0,24];
  maps.mall.scale = 1.4;
  maps.school.scale = 1.4;
  maps.classroom.scale = 1.1;
  const desks = maps.classroom.grid.find(row => row.type === 'desk');
  Object.assign(desks, { rows:6, cols:6, x0:-17.5, z0:-18 });

  // Keep usable washer aisles and the new storage corners, while removing
  // redundant machine banks that were particularly expensive on phones.
  const laundry = maps.laundry;
  laundry.size = 84; laundry.scale = 1.15;
  const factor = .6;
  laundry.spawn = laundry.spawn.map((v,i) => i===1 ? v : v*factor);
  laundry.objects.forEach(o => {o.x*=factor;o.z*=factor;});
  laundry.models.forEach(o => {o.x*=factor;o.z*=factor;});
  laundry.grid = laundry.grid.filter(row => row.type!=='washer' || ![-46,-44,-6,-4].includes(row.z0));
  laundry.grid.forEach(row => {
    if(row.type==='washer') {row.rows=Math.min(row.rows,8);row.cols=Math.min(row.cols,5);}
    for(const key of ['x0','z0','dx','dz']) row[key]*=factor;
  });
  laundry.walkways = laundry.walkways.map(([ax,az,bx,bz,w])=>[ax*factor,az*factor,bx*factor,bz*factor,w]);
  Object.values(maps).forEach(map => {
    const spawn = map.spawn || [0,0,8];
    map.spawnHeading = Math.abs(spawn[0]) + Math.abs(spawn[2]) > .01
      ? Math.atan2(-spawn[0], -spawn[2]) : Math.PI;
  });
}

// Small reusable procedural props. Explicit per-piece colliders keep the
// spaces under racks, lofts, fences and stairs open, matching visible geometry.
function buildMapFeature(o) {
  const g = new THREE.Group();
  const solids = [];
  const palette = new Map();
  const mat = (color, extra = {}) => {
    const key = `${color}:${extra.side || 0}:${extra.metalness || 0}:${extra.roughness ?? .8}:${extra.map?.uuid || ''}`;
    if (!palette.has(key)) palette.set(key, new THREE.MeshStandardMaterial({color, roughness:.8, ...extra}));
    return palette.get(key);
  };
  const add = (geometry, material, x, y, z, solid = false) => {
    const mesh = new THREE.Mesh(geometry, material);mesh.position.set(x,y,z);g.add(mesh);
    if (solid) solids.push(mesh);
    return mesh;
  };
  const box = (x,y,z,w,h,d,color,solid=true,extra={}) => add(new THREE.BoxGeometry(w,h,d),mat(color,extra),x,y,z,solid);
  const ball = (x,y,z,r,color,solid=false) => add(new THREE.SphereGeometry(r,12,8),mat(color),x,y,z,solid);
  const cylinder = (x,y,z,r,h,color,solid=true) => add(new THREE.CylinderGeometry(r,r,h,16),mat(color),x,y,z,solid);
  const tex = (paint) => {
    const cv=document.createElement('canvas');cv.width=cv.height=256;paint(cv.getContext('2d'));
    const texture=new THREE.CanvasTexture(cv);texture.wrapS=texture.wrapT=THREE.RepeatWrapping;return texture;
  };
  const straw = () => tex(ctx => {
    ctx.fillStyle='#b59a55';ctx.fillRect(0,0,256,256);
    for(let i=0;i<700;i++){const x=(i*73)%256,y=(i*137)%256;ctx.strokeStyle=i%3?'#d2b365':'#89733f';ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+3+(i%11),y+2);ctx.stroke();}
  });
  const color=o.color||0x927451;
  switch(o.kind) {
    case 'coverstack': {
      const material = mat(color, o.style==='metal'?{metalness:.45,roughness:.45}:{});
      if(o.style==='hay') material.map=straw();
      const dimensions=[[0,1.05,0,3.8,2.1,2.8],[3.3,.55,0,2.3,1.1,2.8],[0,2.65,0,2.7,1.1,2.7],[-3.1,.5,0,2.1,1,2.8]];
      dimensions.forEach(([x,y,z,w,h,d])=>{
        add(new THREE.BoxGeometry(w,h,d),material,x,y,z,true);
        if(o.style==='hay') for(const side of [-.9,.9])box(x+side,y,z,w*.015,h+.03,d+.03,0x786442,false);
      });
      break;
    }
    case 'hayroll': {
      const mesh=add(new THREE.CylinderGeometry(1.25,1.25,2.7,20),mat(0xd0b269,{map:straw()}),0,1.25,0,true);mesh.rotation.z=Math.PI/2;
      for(const x of [-1.36,1.36]) {
        const points=[];for(let i=0;i<=100;i++){const a=i*.27,r=.05+i*.0105;points.push(new THREE.Vector3(x,1.25+Math.cos(a)*r,Math.sin(a)*r));}
        g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color:0x8c7744})));
      }
      break;
    }
    case 'tank': {
      box(0,1.65,0,3.6,3.1,3.2,color,true,{roughness:.38});
      box(0,.12,0,4,.24,3.6,0x766b50);
      cylinder(0,3.3,0,.4,.18,0x343b39,false);
      const points=[];
      for(const z of [-1.63,1.63])for(let x=-1.8;x<=1.81;x+=.6)points.push(new THREE.Vector3(x,.25,z),new THREE.Vector3(x,3.2,z));
      for(const x of [-1.83,1.83])for(let z=-1.6;z<=1.61;z+=.64)points.push(new THREE.Vector3(x,.25,z),new THREE.Vector3(x,3.2,z));
      for(const y of [.3,1,1.7,2.4,3.1])for(const z of [-1.63,1.63])points.push(new THREE.Vector3(-1.8,y,z),new THREE.Vector3(1.8,y,z));
      g.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color:o.glow?0x71e5e2:0x505d56})));
      break;
    }
    case 'pipebundle':
      for(const [x,y] of [[-1.3,.75],[0,.75],[1.3,.75],[-.65,1.95],[.65,1.95]]){
        const material=mat(color,{side:THREE.DoubleSide,metalness:o.style==='wood'?0:.45});
        const tube=add(new THREE.CylinderGeometry(.66,.66,4.5,12,1,o.style!=='wood'),material,x,y,0,true);tube.rotation.x=Math.PI/2;
        if(o.style!=='wood')for(const z of [-2.24,2.24])add(new THREE.CircleGeometry(.48,12),mat(0x263b38,{side:THREE.DoubleSide}),x,y,z);
      }
      break;
    case 'screen':
      for(const x of [-2.6,2.6]){box(x,1.8,0,.14,3.6,.14,0x5f625c);box(x,.1,0,.7,.2,1,0x5f625c);}
      box(0,2,0,5.1,3,.12,color);
      for(let i=-2;i<=2;i++)box(i,2,.08,.025,3,.03,0xd7cbbc,false);
      break;
    case 'cargorack':
      for(const x of [-2.8,2.8])for(const z of [-1.1,1.1])box(x,2.5,z,.17,5,.17,0x59676a);
      for(const y of [.18,2.4,4.7])box(0,y,0,5.8,.18,2.6,0x9d8059);
      for(const [x,y] of [[-1.4,.95],[1.5,.8],[-1.5,3.2],[1.2,3.4]])box(x,y,0,1.9,1.35,1.7,color);
      break;
    case 'pen':
      // U-shaped rail, open on both front corners; no enclosing AABB.
      for(const x of [-6,6])for(const z of [-5,0,5])box(x,1,z,.2,2,.2,color);
      for(const y of [.65,1.45]){
        box(0,y,-5,12,.18,.18,color);
        box(-6,y,0,.18,.18,10,color);box(6,y,0,.18,.18,10,color);
        box(0,y,5,6,.18,.18,color);
      }
      break;
    case 'trough':
      box(0,.35,0,4.5,.7,1.6,0x717d78);
      box(0,.72,0,4.1,.06,1.2,0x5695a1,false,{roughness:.2});
      break;
    case 'cow': {
      const hide=tex(ctx=>{ctx.fillStyle='#e9e8db';ctx.fillRect(0,0,256,256);ctx.fillStyle='#272e2c';for(let i=0;i<12;i++){ctx.beginPath();ctx.ellipse(i*71%256,i*47%256,19+i%13,15+i%9,i,0,7);ctx.fill();}});
      const body=add(new THREE.SphereGeometry(1,16,10),mat(0xffffff,{map:hide}),0,2,0,true);body.scale.set(1.15,1.1,2.1);
      for(const x of [-.75,.75])for(const z of [-1.2,1.2]){box(x,.75,z,.3,1.5,.35,0xe7e5d8);box(x,.13,z,.33,.25,.4,0x343b37,false);}
      const head=ball(0,2.6,2, .75,0xe3e1d3,true);head.scale.set(.8,1,1.25);
      const nose=ball(0,2.3,2.65,.45,0xbda99b);nose.scale.set(1,.55,.7);
      for(const x of [-.35,.35]){ball(x,2.85,2.55,.08,0x1d2522);const ear=ball(x*2,3,1.9,.28,0x393e36);ear.scale.set(1.5,.4,.65);}
      break;
    }
    case 'produce':
      box(0,.28,0,2.8,.56,2,0xa08455);
      for(let i=0;i<6;i++){const item=ball(-.8+i%3*.8,.8,Math.floor(i/3)*.7-.35,.45,color);item.scale.y=1.2;}
      break;
    case 'harvestbed':
      box(0,.12,0,7,.24,3.5,0x665440);
      for(let i=0;i<8;i++){
        const x=-2.7+(i%4)*1.8,z=-.75+Math.floor(i/4)*1.5;
        if(i%2){
          const carrot=add(new THREE.ConeGeometry(.46,1.75,10),mat(0xdb8c3d),x,1,z,true);carrot.rotation.z=Math.PI;
          for(const tilt of [-.3,0,.3]){const leaf=box(x,2.02,z,.12,.9,.1,0x668a47,false);leaf.rotation.z=tilt;}
        }else{
          const pumpkin=ball(x,.85,z,.78,0xc9913f,true);pumpkin.scale.y=.85;
          cylinder(x,1.6,z,.08,.35,0x6c7548,false);
        }
      }
      break;
    case 'barnfront':
      for(const x of [-4,4])box(x,3,0,4.8,6,.4,0xa4473d);
      box(0,6.3,0,13,.6,.6,0xe9e5d7);
      for(const x of [-5.8,-1.6,1.6,5.8])box(x,3,.25,.15,6,.12,0xe9e5d7,false);
      for(const x of [-3.7,3.7])for(const sign of [-1,1]){const cross=box(x,3,.28,.16,6.8,.12,0xe9e5d7,false);cross.rotation.z=sign*.55;}
      break;
    case 'bunting': {
      const colors=[0xe7bc4d,0xce5460,0x5c9cbc,0x7fb17c,0xa47db7];
      const w=o.w||10;
      for(let i=0;i<14;i++){
        const x=-w/2+i*w/13,y=-Math.sin(i/13*Math.PI)*.65;
        const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute([-.24,0,0,.24,0,0,0,-.55,0],3));geometry.computeVertexNormals();
        add(geometry,mat(colors[i%5],{side:THREE.DoubleSide}),x,y,0);
      }
      g.userData.noHit=true;break;
    }
    case 'balloons':
      [0xe4ba36,0x568cb5,0x9878ac,0x7aa34d,0xc35454].forEach((c,i)=>{
        const x=Math.sin(i*2.4)*.65,y=2.8+i*.65,z=Math.cos(i*2.4)*.4;
        const b=ball(x,y,z,.57,c);b.scale.y=1.15;
        const points=[new THREE.Vector3(x,y-.6,z),new THREE.Vector3(0,.2,0)];
        g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color:0xcdc6af})));
      });
      g.userData.noHit=true;break;
    case 'loft':
      // Twelve separate steps, each <= the 0.35 step-over tolerance. Players
      // can walk up and off normally, without treating the staircase as a box.
      for(let i=0;i<12;i++)box(0,.15*(i+1),-i*.65,3.2,.3*(i+1),.68,color);
      box(0,3.5,-9.2,6,.2,4.5,color);
      for(const x of [-2.8,2.8]){box(x,1.75,-10,.18,3.5,.18,color);box(x,4.2,-9.2,.1,.12,4.5,0xceb384);}
      box(0,4.2,-11.4,5.7,.12,.1,0xceb384);
      break;
    case 'roomfloor': {
      const pattern=makeCheckerTexture('#d0dcea','#273c5b',2,256);pattern.repeat.set(7,5.5);
      const floor=add(new THREE.PlaneGeometry(o.w,o.d),mat(0xffffff,{map:pattern,side:THREE.DoubleSide}),0,.025,0);
      floor.rotation.x=-Math.PI/2;g.userData.noHit=true;break;
    }
    case 'sign':
    case 'roompanel':
    case 'mural': {
      const w=o.w||(o.kind==='sign'?7:15),h=o.h||(o.kind==='sign'?1.2:o.kind==='roompanel'?9:7);
      const picture=tex(ctx=>{
        if(o.kind==='mural'){
          ctx.fillStyle='#49a7af';ctx.fillRect(0,0,256,256);ctx.fillStyle='#6ca568';ctx.beginPath();ctx.moveTo(0,200);ctx.bezierCurveTo(65,80,165,250,256,145);ctx.lineTo(256,256);ctx.lineTo(0,256);ctx.fill();
          ctx.fillStyle='#e5e6c9';for(let i=0;i<8;i++){let x=i*37%256,y=190+i%3*15;ctx.fillRect(x,y,12,4);ctx.fillRect(x+2,y-3,2,11);ctx.fillRect(x+8,y-3,2,11);}
        }else if(o.kind==='roompanel'){
          ctx.fillStyle='#304b79';ctx.fillRect(0,0,256,256);ctx.strokeStyle='#7384a4';ctx.lineWidth=2;
          for(let y=-64;y<320;y+=64)for(let x=0;x<256;x+=64){ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+32,y+32);ctx.lineTo(x,y+64);ctx.lineTo(x-32,y+32);ctx.closePath();ctx.stroke();}
        }else{ctx.fillStyle='#263b36';ctx.fillRect(0,0,256,256);ctx.strokeStyle='#ddce98';ctx.lineWidth=8;ctx.strokeRect(8,12,240,232);ctx.fillStyle='#f0e9ca';ctx.font='bold 24px sans-serif';ctx.textAlign='center';const words=(o.text||'').split(' ');words.forEach((s,i)=>ctx.fillText(s,128,110+i*34));}
      });
      if(o.kind==='roompanel') picture.repeat.set(w/3,h/3);
      add(new THREE.PlaneGeometry(w,h),mat(o.kind==='sign'?color:0xffffff,{map:picture,side:THREE.DoubleSide}),0,o.kind==='sign'?0:h/2,0);
      g.userData.noHit=true;break;
    }
    default: throw new Error(`Unknown map feature: ${o.kind}`);
  }
  g.position.set(o.x,o.y||0,o.z);g.rotation.y=o.ry||0;
  g.userData.mapFeature=o.kind;
  g.userData.collisionMeshes=solids;
  return g;
}

applyMapUpgrades(GAME_MAPS);
