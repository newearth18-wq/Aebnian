const config = require('../supabase-public.json');
const sample = require('./sample-questions');

const baseUrl = process.env.SUPABASE_URL || config.supabaseUrl;
const key = process.env.SUPABASE_PUBLISHABLE_KEY || config.supabaseKey;

async function select(table, params) {
  const url = new URL(`/rest/v1/${table}`, baseUrl);
  for (const [name, value] of Object.entries(params)) url.searchParams.set(name, value);
  const response = await fetch(url, { headers: { apikey: key } });
  if (!response.ok) throw new Error(`Question database returned ${response.status}`);
  return response.json();
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value));
}

async function listSets() {
  const rows = await select('quiz_packs', {
    select: 'id,title,description', is_published: 'eq.true', order: 'title.asc'
  });
  return [{ id: 'demo', name: 'ตัวอย่าง · ความรู้รอบตัว', description: 'ชุดตัวอย่างสำหรับทดลองเล่น', subject: 'ทั่วไป' }, ...rows.map(row => ({
    id: row.id, name: row.title, description: row.description || '', subject: ''
  }))];
}

async function listQuestions(setId) {
  if (setId === 'demo') return sample.getQuestions();
  if (setId && !isUuid(setId)) return [];
  const params = {
    select: 'id,pack_id,prompt,options,position',
    order: 'position.asc'
  };
  if (setId) params.pack_id = `eq.${setId}`;
  const rows = await select('quiz_questions', params);
  const questions = rows.map(row => ({
    id: row.id,
    question_set_id: row.pack_id,
    question_text: row.prompt,
    type: 'multiple_choice',
    difficulty: 'medium',
    options: row.options.map((option, index) => ({
      id: `${row.id}:${index}`, option_text: option, order_index: index
    }))
  }));
  return setId ? questions : [...sample.getQuestions(), ...questions];
}

async function validateAnswer(questionId, answer, setId = null) {
  if (String(questionId).startsWith('demo-'))
    return setId && setId !== 'demo' ? null : sample.validate(questionId, answer);
  if (!isUuid(questionId)) return null;
  if (setId && !isUuid(setId)) return null;
  const response = await fetch(new URL('/rest/v1/rpc/validate_published_quiz_answer', baseUrl), {
    method: 'POST',
    headers: { apikey: key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_question_id: questionId, p_choice: String(answer), p_set_id: setId })
  });
  if (!response.ok) throw new Error(`Question database returned ${response.status}`);
  return response.json();
}

module.exports = { listSets, listQuestions, validateAnswer };
