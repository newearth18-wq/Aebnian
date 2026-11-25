const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {pathToFileURL}=require('node:url');
const load=()=>import(pathToFileURL(path.join(__dirname,'../client/quiz-import.mjs')).href);
const headers=['คำถาม','A','B','C','D','เฉลย','คำอธิบาย'];
test('CSV preserves Thai, quoted commas, escaped quotes and multiline cells',async()=>{
 const {parseCsv,parseQuestionRows}=await load();
 const text='\uFEFFคำถาม,A,B,C,D,เฉลย,คำอธิบาย\r\n"คำถาม, ที่มี "+""คำพูด""\nบรรทัดสอง",หนึ่ง,สอง,สาม,สี่,ข,"อธิบาย, ได้"'.replace('"+','');
 const q=parseQuestionRows(parseCsv(text))[0];
 assert.match(q.prompt,/คำพูด/);assert.match(q.prompt,/บรรทัดสอง/);assert.equal(q.correct_option,1);assert.equal(q.explanation,'อธิบาย, ได้');
 assert.throws(()=>parseCsv('A,B\n"unclosed'),/คำพูด/);
});
test('column aliases, extra columns and row numbers work without inventing a missing answer',async()=>{
 const {parseQuestionRows,questionErrors}=await load();
 const q=parseQuestionRows([['วิชา'],['ลำดับ','Question','Option A','Option B','Option C','Option D','Answer'],[1,'Q','a','b','c','d',''],[2,'Q2','e','f','g','h','ง']]);
 assert.equal(q[0].correct_option,null);assert.match(questionErrors(q[0]).join(),/เลือกเฉลย/);
 assert.equal(q[1].correct_option,3);assert.equal(q[1].source,'แถว 4');
 assert.equal(parseQuestionRows([['prompt','A','B','C','D','correct_option'],['Q','a','b','c','d',0]])[0].correct_option,0);
});
test('text importer handles Thai numbers, wrapped lines, letters and a separate answer key',async()=>{
 const {parseQuestionText}=await load();
 const q=parseQuestionText('ชื่อข้อสอบ\nข้อ ๑. คำถามแรก\nบรรทัดต่อ\nก. กก\nข. ขข\nค. คค\nง. งง\n๒) คำถามสอง\nA. one  B. two\nC. three\nD. four\nเฉลย\n1. ข 2. D\nหน้า 1 / 1');
 assert.equal(q.length,2);assert.equal(q[0].prompt,'คำถามแรก บรรทัดต่อ');assert.equal(q[0].correct_option,1);assert.equal(q[1].correct_option,3);assert.equal(q[1].options[1],'two');
});
test('unknown answers remain unselected and question limits never silently truncate',async()=>{
 const {answerIndex,parseQuestionRows,parseQuestionText,questionErrors}=await load();
 assert.equal(answerIndex('???',['a','b','c','d']),null);
 assert.equal(answerIndex('๓',['a','b','c','d']),2);
 assert.equal(answerIndex('text',['x','text','z','w']),1);
 assert.equal(answerIndex('x',['x','x','z','w']),null);
 assert.throws(()=>parseQuestionRows([headers,...Array.from({length:101},()=>['Q','a','b','c','d','A'])]),/100/);
 assert.throws(()=>parseQuestionText('This is not an exam'),/แยกข้อสอบ/);
 assert.ok(questionErrors({prompt:'x'.repeat(1001),options:['','','',''],correct_option:null}).length>=3);
});
test('PDF lines are ordered top-to-bottom and left-to-right before detecting choices',async()=>{
 const {pdfTextLines}=await load();
 const result=pdfTextLines([{str:'second',transform:[0,0,0,0,20,80],height:10},{str:'B.',transform:[0,0,0,0,0,80],height:10},{str:'first',transform:[0,0,0,0,20,100],height:10},{str:'A.',transform:[0,0,0,0,0,100],height:10}]);
 assert.equal(result,'A. first\nB. second');
});
test('downloadable CSV and Excel templates import the same three questions and answer keys',async()=>{
 const {parseCsv,parseQuestionRows}=await load();
 const root=path.join(__dirname,'../client');
 const csv=parseQuestionRows(parseCsv(fs.readFileSync(path.join(root,'templates/aebnian-quiz.csv'),'utf8')));
 const XLSX=require('../client/vendor/import/xlsx-0.20.3.min.js');
 const book=XLSX.read(fs.readFileSync(path.join(root,'templates/aebnian-quiz.xlsx')));
 const xlsx=parseQuestionRows(XLSX.utils.sheet_to_json(book.Sheets[book.SheetNames[0]],{header:1,defval:'',raw:false}));
 assert.equal(csv.length,3);assert.deepEqual(xlsx,csv);assert.deepEqual(csv.map(q=>q.correct_option),[1,2,2]);
});
test('downloadable Word template is readable by the shipped Word parser and matches the spreadsheet',async()=>{
 const {parseQuestionText}=await load();
 const mammoth=require('../client/vendor/import/mammoth-1.13.0.min.js');
 const file=fs.readFileSync(path.join(__dirname,'../client/templates/aebnian-quiz.docx'));
 const text=(await mammoth.extractRawText({arrayBuffer:file.buffer.slice(file.byteOffset,file.byteOffset+file.byteLength)})).value;
 const q=parseQuestionText(text);assert.equal(q.length,3);assert.deepEqual(q.map(q=>q.correct_option),[1,2,2]);
 assert.match(q[0].prompt,/ประเทศไทย/);
});

function server(){
 let handler;const router={post(path,fn){handler=fn;}};
 const ctx={require:name=>name==='express'?{Router:()=>router}:{verifyTeacher:async token=>token==='allowed'},module:{exports:{}},URL,URLSearchParams,AbortSignal,Buffer,fetch};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../server/quiz-import.js'),'utf8'),ctx);
 return {...ctx.module.exports,handler};
}
test('sheet imports build fixed Google CSV URLs and reject non-Google hosts and invalid tabs',()=>{
 const {googleSheetExport}=server();
 assert.equal(googleSheetExport('https://docs.google.com/spreadsheets/d/abc_123/edit#gid=42'),'https://docs.google.com/spreadsheets/d/abc_123/export?format=csv&gid=42');
 assert.equal(googleSheetExport('https://docs.google.com/spreadsheets/d/e/pub123/pubhtml?gid=5'),'https://docs.google.com/spreadsheets/d/e/pub123/pub?output=csv&gid=5');
 for(const url of ['http://127.0.0.1/','https://docs.google.com.evil.test/spreadsheets/d/abc/edit','https://evil@docs.google.com/spreadsheets/d/abc/edit','https://docs.google.com/spreadsheets/d/abc/edit#gid=bad'])assert.throws(()=>googleSheetExport(url));
});
test('sheet downloads never forward teacher credentials and reject redirects to private/internal destinations',async()=>{
 const {fetchSheetCsv}=server();const calls=[];
 const csv=await fetchSheetCsv('https://docs.google.com/spreadsheets/d/demo/edit',async(url,options)=>{calls.push({url,options});return new Response('คำถาม,A,B,C,D,เฉลย\nQ,a,b,c,d,A',{headers:{'content-type':'text/csv'}});});
 assert.match(csv,/คำถาม/);assert.equal(calls[0].options.redirect,'manual');assert.equal(calls[0].options.headers,undefined);
 await assert.rejects(fetchSheetCsv('https://docs.google.com/spreadsheets/d/demo/edit',async()=>new Response(null,{status:302,headers:{location:'http://169.254.169.254/'}})),/เปิดอ่านชีต/);
 await assert.rejects(fetchSheetCsv('https://docs.google.com/spreadsheets/d/demo/edit',async()=>new Response('<html>Login',{headers:{'content-type':'text/html'}})),/เปิดให้อ่าน/);
 await assert.rejects(fetchSheetCsv('https://docs.google.com/spreadsheets/d/demo/edit',async()=>new Response('abc',{headers:{'content-length':String(11*1024*1024)}})),/10 MB/);
});
test('sheet endpoint requires a valid teacher session before reading a document',async()=>{
 const {handler}=server();const response={set(){return this;},status(code){this.code=code;return this;},json(value){this.value=value;return this;}};
 await handler({headers:{},body:{url:'https://docs.google.com/spreadsheets/d/demo/edit'}},response);
 assert.equal(response.code,401);assert.match(response.value.error,/เข้าสู่ระบบ/);
});
