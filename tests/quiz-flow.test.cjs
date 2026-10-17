const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
function harness(fetchImpl=async()=>({ok:true,json:async()=>({isCorrect:false,correctAnswer:'B',explanation:'because B'})})) {
 class Element {
  constructor(){this.style={display:'none'};this.children=[];this.attrs={};this.disabled=false;this.value='';this.textContent='';}
  set innerHTML(v){this.children=[];} get innerHTML(){return '';}
  appendChild(el){this.children.push(el);el.parent=this;return el;}
  setAttribute(k,v){this.attrs[k]=v;}
  addEventListener(k,fn){this[k]=fn;}
  scrollIntoView(){}
  querySelectorAll(sel){return this.children.flatMap(c=>[...((sel==='input, select' && ['radio','text'].includes(c.type))?[c]:[]),...c.querySelectorAll(sel)]);}
  querySelector(){return this.children.find(c=>c.className?.startsWith('answer-feedback'));}
  remove(){this.parent.children=this.parent.children.filter(c=>c!==this);}
 }
 const elements={}; const get=id=>elements[id]||=new Element();
 const timers=new Map(); let tid=0;
 const ctx=vm.createContext({document:{getElementById:get,createElement:()=>new Element(),createTextNode:text=>Object.assign(new Element(),{textContent:text})},fetch:fetchImpl,alert(){},console:{error(){}},setTimeout:(fn,ms)=>{timers.set(++tid,{fn,ms});return tid;},clearTimeout:id=>timers.delete(id),Math:Object.create(Math)});
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../client/questions.js'),'utf8')+'\nthis.qm=questionManager;',ctx);
 const q={id:'demo-1',question_text:'Question?',type:'multiple_choice',options:[{id:'demo-1:0',option_text:'A'},{id:'demo-1:1',option_text:'B'}]};
 ctx.Math.random=()=>0;
 return {qm:ctx.qm,q,timers,get,ctx};
}
test('feedback holds for 2000ms, locks duplicate submissions, then repeats a randomly selected question',async()=>{
 let requests=0;const h=harness(async()=>{requests++;return {ok:true,json:async()=>({isCorrect:false,correctAnswer:'B',explanation:'because B'})};});
 const {qm,q,timers,get}=h;
 qm.displayRandomQuestion([q]);qm.selectedAnswer='demo-1:0';
 const pending=qm.validateAnswer();assert.equal(await qm.validateAnswer(),null);
 const result=await pending;assert.equal(requests,1);assert.equal(get('submitAnswerBtn').disabled,true);
 let next=0;qm.showFeedback(result,()=>{next++;qm.displayRandomQuestion([q]);});
 assert.equal(await qm.validateAnswer(),null);assert.equal(next,0);
 assert.equal(get('questionContent').querySelector('.answer-feedback').children[1].textContent,'เฉลย: B');
 const timer=[...timers.values()][0];assert.equal(timer.ms,2000);timer.fn();
 assert.equal(next,1);assert.equal(qm.currentQuestion.id,q.id);assert.equal(qm.selectedAnswer,null);assert.equal(get('submitAnswerBtn').disabled,false);
 qm.selectedAnswer='demo-1:1';assert.equal((await qm.validateAnswer()).isCorrect,false);assert.equal(requests,2);
});
test('closing feedback cancels automatic next question; closing an in-flight request ignores its result',async()=>{
 let resolve;const {qm,q,timers,get}=harness(()=>new Promise(r=>{resolve=r;}));
 qm.displayRandomQuestion([q]);qm.selectedAnswer='demo-1:0';const pending=qm.validateAnswer();
 qm.clear();resolve({ok:true,json:async()=>({isCorrect:true,correctAnswer:'B'})});
 assert.equal(await pending,null);assert.equal(qm.currentQuestion,null);
 qm.displayRandomQuestion([q]);qm.showFeedback({isCorrect:true,correctAnswer:'B'},()=>assert.fail('reopened after close'));
 assert.equal(timers.size,1);get('closeQuestionBtn').click();assert.equal(timers.size,0);assert.equal(get('questionModal').style.display,'none');
});
test('failed HTTP validation keeps selected answer, allows retry, and never shows a false result',async()=>{
 const {qm,q,get}=harness(async()=>({ok:false,json:async()=>({error:'temporarily unavailable'})}));
 qm.displayRandomQuestion([q]);qm.selectedAnswer='demo-1:1';assert.equal(await qm.validateAnswer(),null);
 assert.equal(qm.selectedAnswer,'demo-1:1');assert.equal(get('submitAnswerBtn').disabled,false);
 assert.match(get('questionContent').querySelector('.answer-feedback').textContent,/ลองส่งอีกครั้ง/);
});
function scoring(validate) {
 const ctx={require:()=>({validateAnswer:validate}),module:{exports:{}},console};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../server/websocket.js'),'utf8')+'\nmodule.exports.score=handleQuestionAnswered;',ctx);
 const messages=[];const player={score:0,ws:{readyState:1,send:m=>messages.push(JSON.parse(m))}};
 const rooms=new Map([['room',{settings:{questionSetId:'pack'},players:new Map([['player',player]])}]]);
 return {send:data=>ctx.module.exports.score({questionId:'question',userAnswer:'choice',...data},'player','room',rooms),player,messages};
}
test('same question scores on each new attempt, but duplicate delivery and concurrent clicks do not score twice',async()=>{
 let calls=0,finish;const h=scoring(async(...args)=>{calls++;assert.equal(args[2],'pack');if(calls===1)return new Promise(r=>{finish=r;});return calls!==3;});
 const first=h.send({attemptId:'one'});await h.send({attemptId:'one'});await h.send({attemptId:'two'});assert.equal(calls,1);
 finish(true);await first;await h.send({attemptId:'one'});assert.equal(h.player.score,10);
 await h.send({attemptId:'two'});assert.equal(h.player.score,20);
 await h.send({attemptId:'three'});assert.equal(h.player.score,15);assert.equal(h.messages.length,3);
});
test('failed score validation can retry and invalid questions never receive points',async()=>{
 let calls=0;const h=scoring(async()=>{if(++calls===1)throw new Error('network');return calls===2?null:true;});
 await assert.rejects(h.send({attemptId:'one'}));await h.send({attemptId:'one'});assert.equal(h.player.score,0);
 await h.send({attemptId:'one'});assert.equal(h.player.score,10);
});
test('demo answers supply feedback only for a submitted valid choice',()=>{
 const sample=require('../server/sample-questions');
 assert.equal(sample.feedback('demo-1','demo-1:0').correctAnswer,'แสงอาทิตย์');
 assert.equal(sample.feedback('demo-1','demo-1:2').isCorrect,true);
 assert.equal(sample.feedback('demo-1','demo-1:99'),null);
 assert.equal(sample.feedback('demo-0','demo-0:0'),null);
 assert.ok(sample.getQuestions().every(q=>!('correctAnswer'in q)));
});
const mainSource=fs.readFileSync(path.join(__dirname,'../client/main.js'),'utf8');
test('game submission retains question bank, rewards repeat answers, and schedules automatic next question',async()=>{
 const question={id:'demo-1',difficulty:'medium'};const sent=[];let next;let displayed=0;let uid=0;
 const game={score:0,gameState:'playing'};
 const ctx={gameEngine:game,questionManager:{currentQuestion:question,getSelectedAnswer:()=> 'demo-1:2',validateAnswer:async()=>({isCorrect:true,correctAnswer:'แสงอาทิตย์'}),showFeedback:(result,callback)=>{next=callback;},displayRandomQuestion:qs=>{assert.equal(qs.length,1);displayed++;},clear(){}},loadedQuestions:[question],ENERGY_BY_DIFFICULTY:{medium:2},abilityState:{energy:0},paintState:{unlockedCount:3},ALL_COLORS:Array(10),renderColorPalette(){},updatePowersDisplay(){},showMessage(){},scoreDisplay:{},wsClient:{send:data=>sent.push(data)},currentGame:{roomId:'room'},crypto:{randomUUID:()=>String(++uid)}};
 const start=mainSource.indexOf('async function handleSubmitAnswer()');
 const end=mainSource.indexOf('\nfunction handleLeaveRoom()',start);
 vm.createContext(ctx);vm.runInContext(mainSource.slice(start,end),ctx);
 await ctx.handleSubmitAnswer();assert.equal(game.score,10);assert.equal(displayed,0);next();assert.equal(displayed,1);
 await ctx.handleSubmitAnswer();assert.equal(game.score,20);assert.equal(ctx.abilityState.energy,4);assert.equal(ctx.loadedQuestions.length,1);
 assert.equal(sent.length,2);assert.notEqual(sent[0].attemptId,sent[1].attemptId);
 game.gameState='finished';next();assert.equal(displayed,1,'must not reopen after game ends');
});
