import {IMPORT_LIMIT,parseCsv,parseQuestionRows,parseQuestionText,questionErrors,readImportFile} from './quiz-import.mjs';

export function setupQuizImporter({getExistingCount,getAccessToken,onApply}) {
  const $=id=>document.getElementById(id);
  let questions=[],sheets=[],busy=false,generation=0;
  const status=text=>{$('importStatus').textContent=text;};
  function controls() {
    $('importFile').disabled=busy;$('loadSheet').disabled=busy;$('readImportText').disabled=busy;
    $('importSheetSelect').disabled=busy;
    const selected=questions.filter(q=>q.include);
    const invalid=selected.filter(q=>questionErrors(q).length);
    const total=($('importMode').value==='append'?getExistingCount():0)+selected.length;
    $('applyImport').disabled=busy||!selected.length||invalid.length>0||total>IMPORT_LIMIT;
    $('applyImport').textContent=selected.length?`เพิ่ม ${selected.length} ข้อเข้าฟอร์ม`:'เพิ่มคำถามเข้าฟอร์ม';
    if(questions.length)status(`อ่านได้ ${questions.length} ข้อ · เลือก ${selected.length} ข้อ${invalid.length?` · ต้องแก้ ${invalid.length} ข้อ`:''}${total>IMPORT_LIMIT?' · รวมเกิน 100 ข้อ เลือกให้น้อยลงหรือใช้แทนที่':''}`);
  }
  function render() {
    $('importPreview').replaceChildren();
    questions.forEach((question,i)=>{
      const row=document.createElement('section');row.className='importQuestion';
      const head=document.createElement('div');head.className='questionHead';
      const label=document.createElement('label');label.className='check';
      const include=document.createElement('input');include.type='checkbox';include.checked=true;
      include.setAttribute('aria-label',`นำเข้าข้อที่ ${i+1}`);
      const title=document.createElement('strong');title.textContent=`ข้อ ${i+1} · ${question.source||'นำเข้า'}`;
      label.append(include,title);head.append(label);row.append(head);
      const field=(name,value,onInput,multiline=false)=>{
        const label=document.createElement('label');label.textContent=name;
        const input=document.createElement(multiline?'textarea':'input');input.value=value;
        if(multiline)input.rows=2;
        input.setAttribute('aria-label',`ข้อ ${i+1} ${name}`);
        input.addEventListener('input',()=>{onInput(input.value);refresh();});label.append(input);return label;
      };
      row.append(field('คำถาม',question.prompt,value=>question.prompt=value,true));
      const options=document.createElement('div');options.className='choices';
      question.options.forEach((option,j)=>options.append(field(`ตัวเลือก ${'ABCD'[j]}`,option,value=>question.options[j]=value)));
      row.append(options);
      const correctLabel=document.createElement('label');correctLabel.textContent='เฉลย';
      const correct=document.createElement('select');correct.setAttribute('aria-label',`ข้อ ${i+1} เฉลย`);
      [['','เลือกเฉลย'],...Array.from('ABCD',(letter,j)=>[String(j),letter])].forEach(([value,text])=>{
        const option=document.createElement('option');option.value=value;option.textContent=text;correct.append(option);
      });
      correct.value=Number.isInteger(question.correct_option)?String(question.correct_option):'';
      correct.addEventListener('change',()=>{question.correct_option=correct.value===''?null:Number(correct.value);refresh();});
      correctLabel.append(correct);row.append(correctLabel,field('คำอธิบาย',question.explanation,value=>question.explanation=value));
      const error=document.createElement('p');error.className='importRowError';row.append(error);
      const refresh=()=>{error.textContent=question.include?questionErrors(question).join(' · '):'';row.classList.toggle('excluded',!question.include);controls();};
      include.addEventListener('change',()=>{question.include=include.checked;refresh();});
      $('importPreview').append(row);refresh();
    });
    controls();
  }
  function preview(next) {
    questions=next.map(q=>({...q,options:[...q.options],include:true}));render();
  }
  function chooseSheet() {
    try{preview(parseQuestionRows(sheets[Number($('importSheetSelect').value)].rows));}
    catch(error){questions=[];$('importPreview').replaceChildren();controls();status(error.message);}
  }
  function loaded(result) {
    sheets=result.sheets||[];$('importSheetChoice').classList.toggle('hidden',sheets.length<2);
    if(sheets.length) {
      $('importSheetSelect').replaceChildren();
      sheets.forEach((sheet,i)=>{const option=document.createElement('option');option.value=String(i);option.textContent=sheet.name;$('importSheetSelect').append(option);});
      let index=sheets.findIndex(sheet=>{try{parseQuestionRows(sheet.rows);return true;}catch{return false;}});
      $('importSheetSelect').value=String(Math.max(0,index));chooseSheet();
    } else {
      $('importText').value=result.text||'';$('importTextDetails').open=true;
      preview(parseQuestionText(result.text||''));
    }
  }
  async function read(action) {
    if(busy)return;
    const version=++generation;busy=true;questions=[];$('importPreview').replaceChildren();controls();status('กำลังอ่านข้อสอบ…');
    try {const result=await action();if(version!==generation)return;loaded(result);}
    catch(error){if(version===generation)status(error.message||'อ่านไฟล์ไม่สำเร็จ กรุณาลองไฟล์ตัวอย่าง');}
    finally{if(version===generation){busy=false;controls();}}
  }
  function clear() {
    generation++;busy=false;questions=[];sheets=[];
    $('importPreview').replaceChildren();$('importFile').value='';$('importText').value='';$('importSheetUrl').value='';
    $('importSheetChoice').classList.add('hidden');$('importTextDetails').open=false;status('');controls();
  }
  function close(){ $('importDialog').close();clear(); }
  $('openImport').onclick=()=>{clear();$('importDialog').showModal();};
  $('closeImport').onclick=close;$('importDialog').addEventListener('cancel',clear);
  $('importDialog').addEventListener('click',event=>{if(event.target===$('importDialog'))close();});
  $('importFile').onchange=()=>{const file=$('importFile').files[0];if(file)read(()=>readImportFile(file));};
  $('readImportText').onclick=()=>read(async()=>({text:$('importText').value}));
  $('importSheetSelect').onchange=chooseSheet;$('importMode').onchange=controls;
  $('loadSheet').onclick=()=>read(async()=>{
    const token=await getAccessToken();
    if(!token)throw new Error('กรุณาเข้าสู่ระบบครูอีกครั้ง');
    const response=await fetch('/api/import/google-sheet',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},
      body:JSON.stringify({url:$('importSheetUrl').value.trim()})});
    const result=await response.json();if(!response.ok)throw new Error(result.error||'อ่านชีตไม่สำเร็จ');
    return {sheets:[{name:'Google Sheets',rows:parseCsv(result.csv)}]};
  });
  $('applyImport').onclick=()=>{
    const selected=questions.filter(q=>q.include);
    const replace=$('importMode').value==='replace';
    if(busy||!selected.length||selected.some(q=>questionErrors(q).length))return;
    if((replace?0:getExistingCount())+selected.length>IMPORT_LIMIT)return status('รวมได้ไม่เกิน 100 ข้อต่อชุด');
    onApply(selected.map(q=>({prompt:q.prompt.trim(),options:q.options.map(o=>o.trim()),correct_option:q.correct_option,explanation:q.explanation.trim()})),replace);
    close();
  };
  return {close,clear};
}
