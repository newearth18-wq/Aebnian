export const IMPORT_LIMIT = 100;
export const FILE_LIMIT = 10 * 1024 * 1024;
const clean = value => String(value ?? '').replace(/^\uFEFF/, '').trim();
const digits = value => String(value).replace(/[๐-๙]/g, c => String('๐๑๒๓๔๕๖๗๘๙'.indexOf(c)));
const header = value => clean(value).toLowerCase().replace(/[\s_.():\-]/g, '');
const ALIASES = [
  ['คำถาม','โจทย์','question','prompt','questiontext'],
  ['a','ก','ตัวเลือกa','ตัวเลือกก','choicea','optiona','ตัวเลือก1','choice1'],
  ['b','ข','ตัวเลือกb','ตัวเลือกข','choiceb','optionb','ตัวเลือก2','choice2'],
  ['c','ค','ตัวเลือกc','ตัวเลือกค','choicec','optionc','ตัวเลือก3','choice3'],
  ['d','ง','ตัวเลือกd','ตัวเลือกง','choiced','optiond','ตัวเลือก4','choice4'],
  ['เฉลย','คำตอบ','คำตอบที่ถูก','คำตอบที่ถูกต้อง','answer','correct','correctanswer','correctoption'],
  ['คำอธิบาย','คำอธิบายเฉลย','เหตุผล','explanation','reason']
];

export function answerIndex(value, options, zeroBased = false) {
  const answer = digits(clean(value)).replace(/^(?:เฉลย|คำตอบ(?:ที่ถูก(?:ต้อง)?)?|answer)\s*[:：]?\s*/i, '').trim();
  const letter = answer.match(/^([A-Dกขคง])[.)]?$/i);
  if (letter) return 'ABCD'.indexOf(letter[1].toUpperCase()) >= 0
    ? 'ABCD'.indexOf(letter[1].toUpperCase()) : 'กขคง'.indexOf(letter[1]);
  if (/^[0-4]$/.test(answer)) {
    const index = Number(answer) - (zeroBased ? 0 : 1);
    if (index >= 0 && index < 4) return index;
  }
  const matches = options.map((option,i) => clean(option).toLowerCase() === answer.toLowerCase() ? i : -1).filter(i=>i>=0);
  return answer && matches.length === 1 ? matches[0] : null;
}

export function questionErrors(question) {
  const errors = [];
  if (!clean(question.prompt)) errors.push('ยังไม่มีคำถาม');
  if (clean(question.prompt).length > 1000) errors.push('คำถามยาวเกิน 1,000 ตัวอักษร');
  if (question.options.length !== 4 || question.options.some(o=>!clean(o))) errors.push('กรอกตัวเลือกให้ครบ A–D');
  if (!Number.isInteger(question.correct_option) || question.correct_option < 0 || question.correct_option > 3) errors.push('เลือกเฉลยที่ถูกต้อง');
  return errors;
}

export function parseCsv(text) {
  const sample = text.replace(/^\uFEFF/,'').split(/\r?\n/)[0];
  const delimiter = ['\t',';',','].sort((a,b)=>sample.split(b).length-sample.split(a).length)[0];
  const rows=[];let row=[],cell='',quoted=false;
  for(let i=0;i<text.length;i++) {
    const c=text[i];
    if(c==='"') {
      if(quoted && text[i+1]==='"'){cell+='"';i++;}
      else if(!quoted && cell.trim()) cell+=c;
      else quoted=!quoted;
    } else if(c===delimiter && !quoted){row.push(cell);cell='';}
    else if((c==='\n'||c==='\r')&&!quoted){
      if(c==='\r'&&text[i+1]==='\n')i++;
      row.push(cell);rows.push(row);row=[];cell='';
    } else cell+=c;
  }
  if(quoted) throw new Error('CSV มีเครื่องหมายคำพูดที่ยังไม่ปิด กรุณาตรวจไฟล์');
  row.push(cell);rows.push(row);
  return rows;
}

export function parseQuestionRows(rows) {
  let start=-1,columns;
  for(let i=0;i<Math.min(rows.length,20);i++) {
    const cells=rows[i].map(header);
    const found=ALIASES.map(names=>cells.findIndex(value=>names.includes(value)));
    if(found.slice(0,5).every(index=>index>=0)){start=i;columns=found;break;}
  }
  if(start<0) throw new Error('ไม่พบหัวคอลัมน์คำถามและตัวเลือก A–D กรุณาใช้ไฟล์ตัวอย่าง หรือใช้ชื่อคอลัมน์ คำถาม, A, B, C, D, เฉลย, คำอธิบาย');
  const zeroBased = columns[5]>=0 && header(rows[start][columns[5]])==='correctoption';
  const questions=[];
  rows.slice(start+1).forEach((row,index)=>{
    if(!row.some(cell=>clean(cell)))return;
    const options=columns.slice(1,5).map(col=>clean(row[col]));
    questions.push({prompt:clean(row[columns[0]]),options,
      correct_option:answerIndex(row[columns[5]],options,zeroBased),
      explanation:clean(row[columns[6]]),source:`แถว ${start+index+2}`});
  });
  if(!questions.length)throw new Error('ไฟล์นี้มีหัวตาราง แต่ยังไม่มีคำถาม');
  if(questions.length>IMPORT_LIMIT)throw new Error(`นำเข้าได้ครั้งละไม่เกิน ${IMPORT_LIMIT} ข้อ กรุณาแบ่งไฟล์`);
  return questions;
}

export function parseQuestionText(text) {
  text=digits(text).replace(/\r\n?/g,'\n').replace(/\u00a0/g,' ');
  if(text.length>200000)throw new Error('เอกสารมีข้อความมากเกินไป กรุณาแบ่งเป็นไฟล์สั้นลง');
  const lines=text.replace(/\s+([A-Dกขคง])[.)]\s+/g,'\n$1. ').split('\n').map(clean).filter(Boolean);
  const questions=[];const keys=new Map();let current=null,last=null,keyMode=false;
  for(const line of lines) {
    if(/^(?:หน้า\s*\d+\s*(?:\/|จาก)|page\s*\d+\s*(?:\/|of)|แอบเนียน\s*\|)/i.test(line))continue;
    if(/^(?:เฉลย|answer\s*key)\s*[:：]?\s*$/i.test(line)){keyMode=true;continue;}
    if(keyMode) {
      for(const match of line.matchAll(/(\d+)\s*[.)\-:=]?\s*([A-Dกขคง]|[1-4])/gi)) keys.set(match[1],match[2]);
      continue;
    }
    const q=line.match(/^(?:ข้อ(?:ที่)?\s*(\d+)\s*[.):]?\s*|(\d+)[.)]\s*)(.+)$/);
    if(q) {
      current={prompt:q[3],options:['','','',''],correct_option:null,explanation:'',source:`ข้อ ${q[1]||q[2]}`,number:q[1]||q[2]};
      questions.push(current);last='prompt';continue;
    }
    if(!current)continue;
    const choice=line.match(/^([A-Dกขคง])[.)]\s*(.*)$/i);
    const answer=line.match(/^(?:เฉลย|คำตอบ(?:ที่ถูก(?:ต้อง)?)?|answer)\s*[:：]\s*(.+)$/i);
    const explanation=line.match(/^(?:คำอธิบาย(?:เฉลย)?|เหตุผล|explanation)\s*[:：]\s*(.*)$/i);
    if(choice){const index=answerIndex(choice[1],[]);current.options[index]=choice[2];last=index;}
    else if(answer){current.answer=answer[1];last=null;}
    else if(explanation){current.explanation=explanation[1];last='explanation';}
    else if(last!==null){if(typeof last==='number')current.options[last]+=` ${line}`;else current[last]+=` ${line}`;}
  }
  for(const q of questions)q.correct_option=answerIndex(q.answer||keys.get(q.number),q.options);
  if(!questions.length)throw new Error('ยังแยกข้อสอบไม่ได้ กรุณาใช้รูปแบบ 1. คำถาม ตามด้วย A. ถึง D. และ เฉลย: A หรือลองไฟล์ตัวอย่าง');
  if(questions.length>IMPORT_LIMIT)throw new Error(`เอกสารมีเกิน ${IMPORT_LIMIT} ข้อ กรุณาแบ่งไฟล์`);
  return questions;
}

const scriptPromises=new Map();
function loadScript(src) {
  if(!scriptPromises.has(src))scriptPromises.set(src,new Promise((resolve,reject)=>{
    const script=document.createElement('script');script.src=src;
    script.onload=resolve;script.onerror=()=>{scriptPromises.delete(src);script.remove();reject(new Error('โหลดตัวอ่านไฟล์ไม่สำเร็จ กรุณาลองใหม่'));};
    document.head.appendChild(script);
  }));
  return scriptPromises.get(src);
}

export function pdfTextLines(items) {
  const rows=[];
  for(const item of items) {
    if(!('str' in item)||!item.str.trim())continue;
    const y=item.transform[5],x=item.transform[4];
    let row=rows.find(row=>Math.abs(row.y-y)<Math.max(2,(item.height||10)*.25));
    if(!row){row={y,items:[]};rows.push(row);}
    row.items.push({x,text:item.str});
  }
  return rows.sort((a,b)=>b.y-a.y).map(row=>row.items.sort((a,b)=>a.x-b.x).map(item=>item.text).join(' ')).join('\n');
}

export async function readImportFile(file) {
  if(!file||file.size>FILE_LIMIT)throw new Error('เลือกไฟล์ขนาดไม่เกิน 10 MB');
  const extension=file.name.split('.').pop().toLowerCase();
  if(['csv','tsv','txt'].includes(extension)) {
    let text=await file.text();
    if(text.includes('\uFFFD'))text=new TextDecoder('windows-874').decode(await file.arrayBuffer());
    return extension==='txt'?{text}:{sheets:[{name:file.name,rows:parseCsv(text)}]};
  }
  if(['xlsx','xls'].includes(extension)) {
    await loadScript('/vendor/import/xlsx-0.20.3.min.js');
    const book=window.XLSX.read(await file.arrayBuffer(),{type:'array',cellFormula:false,sheetRows:1000});
    if(book.SheetNames.some(name=>book.Sheets[name]['!fullref'] && window.XLSX.utils.decode_range(book.Sheets[name]['!fullref']).e.r>=1000))
      throw new Error('ตารางมีเกิน 1,000 แถว กรุณาคัดลอกเฉพาะข้อสอบไม่เกิน 100 ข้อลงไฟล์ใหม่');
    return {sheets:book.SheetNames.map(name=>({name,rows:window.XLSX.utils.sheet_to_json(book.Sheets[name],{header:1,defval:'',raw:false})}))};
  }
  if(extension==='docx') {
    await loadScript('/vendor/import/mammoth-1.13.0.min.js');
    const arrayBuffer=await file.arrayBuffer();
    const html=await window.mammoth.convertToHtml({arrayBuffer},{externalFileAccess:false,
      convertImage:window.mammoth.images.imgElement(async()=>({src:''}))});
    const doc=new DOMParser().parseFromString(html.value,'text/html');
    const sheets=Array.from(doc.querySelectorAll('table')).map((table,i)=>({name:`ตาราง ${i+1}`,rows:Array.from(table.rows).map(row=>Array.from(row.cells).map(cell=>cell.textContent))}));
    const tables=sheets.filter(sheet=>{try{parseQuestionRows(sheet.rows);return true;}catch{return false;}});
    if(tables.length)return {sheets:tables};
    return {text:(await window.mammoth.extractRawText({arrayBuffer})).value};
  }
  if(extension==='pdf') {
    const pdfjs=await import('./vendor/import/pdf-5.6.205.mjs');
    pdfjs.GlobalWorkerOptions.workerSrc='/vendor/import/pdf.worker-5.6.205.mjs';
    const task=pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer()),isEvalSupported:false,useSystemFonts:true});
    let pdf;
    try {
      pdf=await task.promise;
      if(pdf.numPages>50)throw new Error('รองรับ PDF ครั้งละไม่เกิน 50 หน้า กรุณาแบ่งไฟล์');
      let text='';
      for(let n=1;n<=pdf.numPages;n++) {
        const page=await pdf.getPage(n);text+=pdfTextLines((await page.getTextContent()).items)+'\n';page.cleanup();
        if(text.length>200000)throw new Error('PDF มีข้อความมากเกินไป กรุณาแบ่งไฟล์');
      }
      if(text.trim().length<15)throw new Error('PDF นี้ไม่มีข้อความที่อ่านได้ อาจเป็นไฟล์สแกน กรุณาใช้ PDF ที่เลือกคัดลอกข้อความได้ หรือใช้ Excel / Word');
      return {text};
    } catch(error) {
      if(error.name==='PasswordException')throw new Error('PDF มีรหัสผ่าน กรุณาใช้ไฟล์ที่ปลดล็อกแล้ว');
      throw error;
    } finally {await task.destroy();}
  }
  throw new Error('รองรับ Excel (.xlsx/.xls), CSV, Word (.docx), PDF และข้อความ .txt');
}
