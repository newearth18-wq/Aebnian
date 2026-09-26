(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const scene = $('sceneCanvas'), ctx = scene.getContext('2d');
  const paint = $('paintCanvas'), pctx = paint.getContext('2d', {willReadFrequently:true});
  const base = document.createElement('canvas'); base.width = scene.width; base.height = scene.height;
  const bctx = base.getContext('2d', {willReadFrequently:true});
  const W = scene.width, H = scene.height;
  const swatchColors = ['#faf3dd','#b27c60','#754740','#375b66','#527c6b','#c49343','#cc6a65','#465282','#8b6d9b','#1f3543','#d6b99a','#6f8d70'];
  let color = '#9c7159', brush = 16, eyedropper = false, painting = false, lastPaintPoint = null;
  let phase = 'intro', preHelpPhase = 'intro', remaining = 45, detection = 0, camo = 0;
  let player = {x:500,y:384}, seeker = {x:80,y:430,dir:1}, keys = new Set();
  let last = performance.now(), elapsed = 0, moveHeat = 0, toastTimer = 0, lastScoreUpdate = 0;
  let best = Number(localStorage.getItem('chromaHideBest') || 0);
  $('bestScore').textContent = best.toFixed(1);

  const clamp = (n,a,b) => Math.max(a,Math.min(b,n));
  const lerp = (a,b,t) => a+(b-a)*t;
  const rgb = hex => { const n=parseInt(hex.slice(1),16); return [(n>>16)&255,(n>>8)&255,n&255]; };
  const hex = (r,g,b) => '#'+[r,g,b].map(v=>clamp(Math.round(v),0,255).toString(16).padStart(2,'0')).join('');
  const fmt = n => '00:'+Math.ceil(Math.max(0,n)).toString().padStart(2,'0');

  function roundRect(c,x,y,w,h,r,fill,stroke) {
    c.beginPath(); c.roundRect(x,y,w,h,r); if(fill){c.fillStyle=fill;c.fill();} if(stroke){c.strokeStyle=stroke;c.stroke();}
  }
  function blobPath(c) {
    c.beginPath();
    c.moveTo(87,24); c.bezierCurveTo(55,23,47,51,51,80); c.bezierCurveTo(56,101,43,112,33,128);
    c.bezierCurveTo(18,148,26,164,41,170); c.bezierCurveTo(50,174,58,164,64,155);
    c.lineTo(65,190); c.bezierCurveTo(66,206,81,209,88,196); c.lineTo(91,179);
    c.lineTo(95,197); c.bezierCurveTo(100,211,115,206,117,191); c.lineTo(120,153);
    c.bezierCurveTo(129,164,135,175,146,169); c.bezierCurveTo(160,161,156,144,144,126);
    c.bezierCurveTo(133,112,127,99,130,78); c.bezierCurveTo(135,50,119,24,87,24); c.closePath();
  }
  function drawOutline() { pctx.save(); blobPath(pctx); pctx.lineWidth=3;pctx.strokeStyle='#23313c';pctx.stroke();pctx.restore(); }
  function resetPaint() {
    pctx.clearRect(0,0,180,220); blobPath(pctx); pctx.fillStyle='#f6f7ef';pctx.fill();drawOutline();updateCamo();
  }
  function paintAt(x,y) {
    pctx.save();blobPath(pctx);pctx.clip();pctx.strokeStyle=color;pctx.fillStyle=color;
    pctx.lineWidth=brush;pctx.lineCap='round';pctx.lineJoin='round';
    if(lastPaintPoint){pctx.beginPath();pctx.moveTo(lastPaintPoint.x,lastPaintPoint.y);pctx.lineTo(x,y);pctx.stroke();}
    else {pctx.beginPath();pctx.arc(x,y,brush/2,0,Math.PI*2);pctx.fill();}
    pctx.restore();lastPaintPoint={x,y};drawOutline();updateCamo();
  }
  function paintPos(e) { const r=paint.getBoundingClientRect();return {x:(e.clientX-r.left)*180/r.width,y:(e.clientY-r.top)*220/r.height}; }
  paint.addEventListener('pointerdown',e=>{painting=true;lastPaintPoint=null;paint.setPointerCapture(e.pointerId);const q=paintPos(e);paintAt(q.x,q.y);});
  paint.addEventListener('pointermove',e=>{if(!painting)return;const q=paintPos(e);paintAt(q.x,q.y);});
  paint.addEventListener('pointerup',()=>{painting=false;lastPaintPoint=null;});paint.addEventListener('pointercancel',()=>{painting=false;lastPaintPoint=null;});

  function setColor(c) {
    color=c;$('colorPicker').value=c;
    document.querySelectorAll('.swatch').forEach(el=>el.classList.toggle('active',el.dataset.color.toLowerCase()===c.toLowerCase()));
  }
  swatchColors.forEach(c=>{const b=document.createElement('button');b.type='button';b.className='swatch';b.style.background=c;b.dataset.color=c;b.title=c;b.setAttribute('aria-label',`เลือกสี ${c}`);b.onclick=()=>setColor(c);$('swatches').appendChild(b);});
  $('colorPicker').addEventListener('input',e=>setColor(e.target.value));
  $('brushSize').addEventListener('input',e=>{brush=Number(e.target.value);$('brushValue').textContent=brush;});
  $('resetPaintBtn').onclick=()=>{resetPaint();toast('ล้างสีแล้ว');};
  $('eyedropperBtn').onclick=()=>{eyedropper=!eyedropper;$('eyedropperBtn').classList.toggle('active',eyedropper);$('eyedropperBadge').hidden=!eyedropper;};

  function drawBackground(c) {
    const wall=c.createLinearGradient(0,0,W,330);wall.addColorStop(0,'#855c52');wall.addColorStop(.52,'#6e4d55');wall.addColorStop(1,'#4c4857');c.fillStyle=wall;c.fillRect(0,0,W,340);
    for(let row=0;row<3;row++)for(let col=0;col<7;col++){
      const x=col*142-10,y=row*105-10;
      roundRect(c,x,y,138,99,4,'#251d2866','#c18a6a66');
      roundRect(c,x+8,y+8,122,82,3,row%2?'#ffffff08':'#00000010','#e5b79422');
      c.fillStyle='#f6d8a91c';c.fillRect(x+12,y+12,113,3);
    }
    c.fillStyle='#2a2730';c.fillRect(0,309,W,23);c.fillStyle='#ba8668';c.fillRect(0,308,W,5);
    const floor=c.createLinearGradient(0,332,0,H);floor.addColorStop(0,'#aa866e');floor.addColorStop(1,'#725f5d');c.fillStyle=floor;c.fillRect(0,332,W,H-332);
    c.strokeStyle='#3b334055';c.lineWidth=3;
    for(let y=341;y<660;y+=72){c.beginPath();c.moveTo(0,y);c.lineTo(W,y);c.stroke();}
    for(let x=-150;x<1150;x+=160){c.beginPath();c.moveTo(x,332);c.lineTo(x+160,600);c.stroke();}
    // Framed poster
    roundRect(c,350,56,169,160,5,'#332a36','#d5ac71');roundRect(c,362,68,145,135,2,'#263c4b');
    c.fillStyle='#f4c881';c.beginPath();c.arc(433,111,22,0,Math.PI*2);c.fill();
    c.fillStyle='#66857a';c.beginPath();c.moveTo(366,193);c.lineTo(418,125);c.lineTo(456,183);c.lineTo(474,147);c.lineTo(503,193);c.fill();
    // Party bunting
    c.strokeStyle='#f1c882';c.lineWidth=3;c.beginPath();c.moveTo(0,46);c.quadraticCurveTo(480,138,960,44);c.stroke();
    const colors=['#dc7168','#edc071','#8cb48a','#88a8c3','#b48bc4'];
    for(let i=0;i<16;i++){let x=i*64+7,y=48+Math.sin(i/15*Math.PI)*40;c.fillStyle=colors[i%5];c.beginPath();c.moveTo(x,y);c.lineTo(x+20,y+31);c.lineTo(x+42,y);c.fill();}
    // Shelf and books
    roundRect(c,39,135,210,232,4,'#43333b','#d4a478');
    for(let j=0;j<3;j++){c.fillStyle='#b78764';c.fillRect(51,195+j*64,186,10);for(let i=0;i<13;i++){let bh=25+(i*13+j*7)%27;let bx=57+i*13;c.fillStyle=colors[(i+j)%5];c.fillRect(bx,195+j*64-bh,9,bh);}}
    // Sofa and rug
    c.fillStyle='#4c3d4b';c.beginPath();c.ellipse(485,490,244,69,0,0,Math.PI*2);c.fill();
    roundRect(c,565,295,267,106,26,'#385b65','#82a1a0');
    roundRect(c,549,357,305,96,24,'#456b70','#789793');
    roundRect(c,569,423,25,58,8,'#2b3e44');roundRect(c,809,423,25,58,8,'#2b3e44');
    for(let i=0;i<4;i++)roundRect(c,582+i*58,373,54,49,10,i%2?'#527880':'#5b8286','#ffffff22');
    // Plant
    roundRect(c,876,396,52,69,9,'#bb875e','#e0ad7f');
    for(let i=0;i<9;i++){let a=i*Math.PI*2/9;c.save();c.translate(901,379);c.rotate(a);c.fillStyle=i%2?'#426c56':'#648a62';c.beginPath();c.ellipse(0,-36,13,47,.25,0,Math.PI*2);c.fill();c.restore();}
    // Party balloons
    for(let i=0;i<11;i++){let x=270+(i%6)*32+(i%2)*11,y=293+Math.floor(i/6)*32;c.strokeStyle='#a79779';c.lineWidth=1;c.beginPath();c.moveTo(x,y+28);c.lineTo(x+4,436);c.stroke();c.fillStyle=['#db766b','#e9b95f','#7499c0','#7ca875'][i%4];c.beginPath();c.ellipse(x,y,19,24,0,0,Math.PI*2);c.fill();c.fillStyle='#ffffff44';c.beginPath();c.ellipse(x-6,y-7,4,8,-.5,0,Math.PI*2);c.fill();}
    // Dark corner behind furniture for a hiding choice
    c.fillStyle='#3e3940a0';c.fillRect(0,371,169,60);
    roundRect(c,37,424,120,72,5,'#635247','#d1a57b');c.fillStyle='#8d6c57';c.fillRect(48,438,98,5);
    for(let i=0;i<5;i++){c.fillStyle=colors[i];c.beginPath();c.arc(63+i*18,423-(i%2)*8,12,0,Math.PI*2);c.fill();}
  }

  const coverZones=[{x:55,y:369,w:190,h:112},{x:548,y:358,w:312,h:121},{x:857,y:354,w:83,h:120}];
  function coverBonus(){return coverZones.some(z=>player.x>z.x&&player.x<z.x+z.w&&player.y>z.y&&player.y<z.y+z.h)?18:0;}
  function colorDistance(a,b){return Math.sqrt((a[0]-b[0])**2+(a[1]-b[1])**2+(a[2]-b[2])**2)/441.7;}
  function updateCamo(){
    if(!bctx)return;
    const bg=bctx.getImageData(clamp(Math.round(player.x),0,959),clamp(Math.round(player.y-20),0,599),1,1).data;
    const px=pctx.getImageData(0,0,180,220).data;
    const pts=[[88,54],[77,80],[102,84],[85,112],[103,135],[69,139],[126,139],[78,178],[104,178]];
    let d=0;for(const [x,y] of pts){const k=(y*180+x)*4;d+=colorDistance([px[k],px[k+1],px[k+2]],bg);}
    camo=clamp(Math.round(95-(d/pts.length)*125+coverBonus()),3,98);
    $('camoValue').textContent=camo+'%';$('camoBar').style.width=camo+'%';
    $('camoHint').textContent=camo>70?'เนียนมาก! จุดนี้เหมาะกับสีที่เลือก':camo>40?'พอใช้ได้ ลองปรับสีหรือย้ายจุด':'เด่นเกินไป ลองดูดสีจากฉาก';
  }
  function setPlayerFromPointer(e){
    const r=scene.getBoundingClientRect();let x=(e.clientX-r.left)*W/r.width,y=(e.clientY-r.top)*H/r.height;
    if(eyedropper){const d=bctx.getImageData(clamp(Math.round(x),0,959),clamp(Math.round(y),0,599),1,1).data;setColor(hex(d[0],d[1],d[2]));eyedropper=false;$('eyedropperBtn').classList.remove('active');$('eyedropperBadge').hidden=true;toast('ดูดสีแล้ว ระบายตัวละครได้เลย');return;}
    if(phase==='prep'){player.x=clamp(x,32,928);player.y=clamp(y,150,548);updateCamo();toast('ย้ายที่ซ่อนแล้ว');}
  }
  scene.addEventListener('pointerdown',setPlayerFromPointer);
  window.addEventListener('keydown',e=>{if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key))e.preventDefault();keys.add(e.key.toLowerCase());});
  window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));

  function toast(s){$('sceneToast').textContent=s;$('sceneToast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('sceneToast').classList.remove('show'),2300);}
  function setStatus(title,body){$('statusTitle').textContent=title;$('statusText').textContent=body;}
  function showOverlay(title,text,button){$('overlayTitle').innerHTML=title;$('overlayText').textContent=text;$('overlayBtn').textContent=button;$('overlay').classList.remove('hidden');}
  function start(){phase='prep';remaining=45;detection=0;elapsed=0;moveHeat=0;player={x:500,y:384};seeker={x:80,y:430,dir:1};resetPaint();$('overlay').classList.add('hidden');$('phaseTag').textContent='เตรียมซ่อน';$('phaseInstruction').textContent='คลิกในฉากเพื่อย้ายตัวละคร';$('timerLabel').textContent='เตรียมตัว';$('huntBtn').disabled=false;$('detectBar').style.width='0%';$('detectValue').textContent='0%';setStatus('กำลังเตรียมซ่อน','ลองดูดสีจากฉาก แล้วระบายตัวละครให้กลืนกับจุดที่เลือก');toast('ระบายสี แล้วกดเริ่มค้นหา');}
  function startHunt(){if(phase!=='prep')return;phase='hunt';$('phaseTag').textContent='ผู้ค้นหามาแล้ว';$('phaseInstruction').textContent='หลบแสงไฟฉายให้อยู่รอด 45 วินาที';$('huntBtn').disabled=true;setStatus('ซ่อนให้ดี','เดินได้ แต่การเคลื่อนไหวจะทำให้ถูกสังเกตง่ายขึ้น');toast('ผู้ค้นหากำลังมา!');}
  function end(won){phase=won?'won':'lost';const score=won?45:elapsed;if(score>best){best=score;localStorage.setItem('chromaHideBest',best.toFixed(1));$('bestScore').textContent=best.toFixed(1);} $('phaseTag').textContent=won?'ชนะแล้ว':'ถูกพบแล้ว';setStatus(won?'เอาตัวรอดสำเร็จ':'ถูกจับได้',won?'สีของคุณกลืนกับฉากได้ดี':'ลองเปลี่ยนที่ซ่อนและระบายสีให้ใกล้ฉากมากขึ้น');showOverlay(won?'พรางตัว<em>สำเร็จ!</em>':'ถูกผู้ค้นหา<em>พบแล้ว</em>',won?`คุณรอดครบ 45 วินาที ความกลมกลืน ${camo}%`:`คุณรอด ${score.toFixed(1)} วินาที · ความกลมกลืน ${camo}%`,'เล่นอีกครั้ง →');}
  $('overlayBtn').onclick=()=>{if(phase==='help'){phase=preHelpPhase;$('overlay').classList.add('hidden');return;}start();};
  $('huntBtn').onclick=startHunt;
  $('helpBtn').onclick=()=>{if(phase==='help')return;preHelpPhase=phase;phase='help';showOverlay('วิธี<em>เล่น</em>','เลือกจุดในฉาก ใช้ชุดสีหรือปุ่มดูดสี แล้วลากเพื่อระบายตัวละคร เมื่อพร้อม กดเริ่มค้นหา อยู่ให้ครบ 45 วินาทีโดยระวังแสงไฟฉายและอย่าเดินบ่อย','กลับไปเล่น →');};

  if(document.modelContext?.registerTool){
    const register=tool=>Promise.resolve(document.modelContext.registerTool(tool)).catch(()=>{});
    register({name:'read_game_state',title:'Read game state',description:'Read the visible Chroma Hide phase, timer, camouflage score, and detection score.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true},execute:()=>({phase,remaining:Math.max(0,Math.ceil(remaining)),camouflage:camo,detection:Math.round(detection)})});
    register({name:'start_game',title:'Start game',description:'Begin a new preparation round in Chroma Hide.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:false},execute:()=>{start();return {phase,camouflage:camo};}});
    register({name:'prepare_camouflage',title:'Prepare camouflage',description:'Choose a hiding position and paint the whole character one color during the preparation phase.',inputSchema:{type:'object',properties:{x:{type:'number',minimum:32,maximum:928},y:{type:'number',minimum:150,maximum:548},color:{type:'string',pattern:'^#[0-9a-fA-F]{6}$'}},required:['x','y','color'],additionalProperties:false},annotations:{readOnlyHint:false},execute:input=>{if(phase!=='prep'||!input||typeof input.x!=='number'||typeof input.y!=='number'||input.x<32||input.x>928||input.y<150||input.y>548||typeof input.color!=='string'||!/^#[0-9a-fA-F]{6}$/.test(input.color))throw new Error('Invalid camouflage input or preparation phase is not active');player={x:input.x,y:input.y};setColor(input.color);pctx.clearRect(0,0,180,220);blobPath(pctx);pctx.fillStyle=input.color;pctx.fill();drawOutline();updateCamo();return {phase,camouflage:camo,position:{x:player.x,y:player.y}};}});
    register({name:'start_search',title:'Start search',description:'End preparation and start the seeker round.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:false},execute:()=>{if(phase!=='prep')throw new Error('The preparation phase is not active');startHunt();return {phase,remaining:Math.ceil(remaining)};}});
  }

  function drawPlayer(c,t){
    const size=phase==='prep'? .43:.39;const bob=phase==='hunt'?Math.sin(t*2)*1.3:Math.sin(t*3)*2;
    c.save();c.translate(player.x,player.y+bob);c.fillStyle='#16172088';c.beginPath();c.ellipse(0,8,35,10,0,0,Math.PI*2);c.fill();c.drawImage(paint,-90*size,-198*size,180*size,220*size);
    c.fillStyle='#182231';c.beginPath();c.arc(-8,-56,2.7,0,Math.PI*2);c.arc(8,-56,2.7,0,Math.PI*2);c.fill();c.restore();
    if(phase==='prep'){c.strokeStyle='#c6f77d';c.lineWidth=2;c.setLineDash([5,5]);c.beginPath();c.ellipse(player.x,player.y+7,33,12,0,0,Math.PI*2);c.stroke();c.setLineDash([]);}
  }
  function seekerTarget(t){const cycle=t%29;if(cycle<8)return {x:835,y:424};if(cycle<15)return {x:210,y:483};if(cycle<22)return {x:760,y:335};return {x:95,y:382};}
  function drawSeeker(c,t){
    const s=seeker;
    c.save();c.translate(s.x,s.y);c.fillStyle='#17191d88';c.beginPath();c.ellipse(0,7,23,8,0,0,Math.PI*2);c.fill();
    c.fillStyle='#222d37';roundRect(c,-14,-49,28,51,7,'#2c3441');c.fillStyle='#e7b8a2';c.beginPath();c.arc(0,-60,14,0,Math.PI*2);c.fill();
    c.fillStyle='#35485c';roundRect(c,-18,-76,36,9,4,'#35485c');c.fillRect(-12,-81,24,7);
    c.fillStyle='#e8e4cb';c.fillRect(s.dir>0?11:-16,-37,7,9);c.restore();
  }
  function render(t){
    ctx.clearRect(0,0,W,H);ctx.drawImage(base,0,0);
    if(phase==='hunt'||phase==='won'||phase==='lost'){
      const sx=seeker.x+(seeker.dir>0?18:-18),sy=seeker.y-32,reach=335;
      const grad=ctx.createRadialGradient(sx,sy,10,sx+seeker.dir*reach*.65,sy,reach);
      grad.addColorStop(0,'#fff2b844');grad.addColorStop(1,'#fff2b800');ctx.fillStyle=grad;ctx.beginPath();ctx.moveTo(sx,sy);ctx.lineTo(sx+seeker.dir*reach,sy-120);ctx.lineTo(sx+seeker.dir*reach,sy+140);ctx.closePath();ctx.fill();
      drawSeeker(ctx,t);
    }
    drawPlayer(ctx,t);
    if(phase==='prep'){ctx.fillStyle='#e8f6d3';ctx.font='600 16px Kanit, sans-serif';ctx.textAlign='center';ctx.fillText('คุณอยู่ตรงนี้',player.x,player.y-100);}
    if(phase==='hunt'&&detection>20){ctx.fillStyle=`rgba(255,85,83,${Math.min(.18,detection/600)})`;ctx.fillRect(0,0,W,H);}
  }
  function tick(now){
    const dt=clamp((now-last)/1000,0,.05);last=now;
    if(phase==='prep'||phase==='hunt'){
      let dx=Number(keys.has('d')||keys.has('arrowright'))-Number(keys.has('a')||keys.has('arrowleft'));
      let dy=Number(keys.has('s')||keys.has('arrowdown'))-Number(keys.has('w')||keys.has('arrowup'));
      if(dx||dy){const len=Math.hypot(dx,dy);player.x=clamp(player.x+dx/len*145*dt,32,928);player.y=clamp(player.y+dy/len*145*dt,150,548);moveHeat=1;updateCamo();}else moveHeat=Math.max(0,moveHeat-dt*1.5);
    }
    if(phase==='hunt'&&!($('overlay').classList.contains('hidden')===false)){
      elapsed+=dt;remaining=45-elapsed;$('timerLabel').textContent=fmt(remaining);
      const target=seekerTarget(elapsed);const vx=target.x-seeker.x,vy=target.y-seeker.y,dist=Math.hypot(vx,vy);
      if(dist>4){const v=Math.min(dist,90*dt);seeker.x+=vx/dist*v;seeker.y+=vy/dist*v;seeker.dir=vx>=0?1:-1;}
      const px=player.x-seeker.x,py=player.y-30-seeker.y+32;
      const inCone=px*seeker.dir>10&&Math.abs(px)<335&&Math.abs(py)<105+Math.abs(px)*.2;
      if(inCone){const proximity=1-clamp(Math.abs(px)/380,0,.85);detection+=dt*(7+(100-camo)*.5+moveHeat*32)*proximity;}
      else detection-=dt*20;
      detection=clamp(detection,0,100);
      $('detectValue').textContent=Math.round(detection)+'%';$('detectBar').style.width=detection+'%';
      if(detection>=100)end(false);else if(remaining<=0)end(true);
      if(now-lastScoreUpdate>1000){updateCamo();lastScoreUpdate=now;}
    }
    render(now/1000);requestAnimationFrame(tick);
  }
  drawBackground(bctx);resetPaint();$('timerLabel').textContent='เตรียมตัว';requestAnimationFrame(tick);
})();

