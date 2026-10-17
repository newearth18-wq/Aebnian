const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
function maps(){
 const ctx=vm.createContext({THREE:{Vector3:class{}},Math,console});
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../client/game.js'),'utf8')+'\nthis.maps=GAME_MAPS;',ctx);
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../client/map-upgrades.js'),'utf8'),ctx);
 return ctx;
}
test('all nineteen maps retain their IDs and have authored cover, readable guidance and clear reserved routes',()=>{
 const ctx=maps();assert.equal(Object.keys(ctx.maps).length,19);
 for(const [id,map] of Object.entries(ctx.maps)){
  assert.ok(map.description&&map.hidingTip,id);
  assert.ok(map.walkways.length>0,id);
  assert.ok(map.objects.some(o=>o.type==='mapfeature'),id);
  for(const path of map.walkways)assert.ok(path.every(Number.isFinite)&&path[4]>=2.4,id);
  for(const o of map.objects.filter(o=>o.type==='mapfeature')){
   assert.ok(Number.isFinite(o.x)&&Number.isFinite(o.z),id);
   assert.ok(Math.abs(o.x)<(map.size||60)/2&&Math.abs(o.z)<(map.size||60)/2,`${id} feature outside stage`);
  }
  const spawn=map.spawn||[0,0,8];
  if(Math.hypot(spawn[0],spawn[2])>0)assert.ok(Math.sin(map.spawnHeading)*-spawn[0]+Math.cos(map.spawnHeading)*-spawn[2]>0,`${id} faces outside`);
 }
});
test('reserved routes cover their full width and end caps, and do not exclude unrelated cover',()=>{
 const ctx=maps();const map={walkways:[[0,0,0,20,4]]};
 assert.equal(ctx.mapWalkwayContains(map,1.9,10),true);
 assert.equal(ctx.mapWalkwayContains(map,0,-1.9),true);
 assert.equal(ctx.mapWalkwayContains(map,2.5,10,1),true);
 assert.equal(ctx.mapWalkwayContains(map,4,10),false);
});
test('authored map layouts are identical between clients and farm central escape routes remain clear',()=>{
 const a=maps(),b=maps();
 assert.equal(JSON.stringify(a.maps),JSON.stringify(b.maps));
 const farm=a.maps.farm;
 assert.equal(farm.scatter.length,0);
 for(const o of farm.objects.filter(o=>o.type==='mapfeature'&&!['mural','sign','barnfront'].includes(o.kind)))assert.equal(a.mapWalkwayContains(farm,o.x,o.z),false,`cover ${o.kind} obstructs lane`);
});
