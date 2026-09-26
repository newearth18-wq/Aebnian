const sample = [
  ['ข้อใดเป็นแหล่งพลังงานหมุนเวียน?', ['ถ่านหิน', 'น้ำมันดิบ', 'แสงอาทิตย์', 'ก๊าซธรรมชาติ'], 2],
  ['น้ำมีสูตรเคมีข้อใด?', ['CO₂', 'O₂', 'H₂O', 'NaCl'], 2],
  ['ประเทศไทยมีเมืองหลวงชื่ออะไร?', ['เชียงใหม่', 'กรุงเทพมหานคร', 'ภูเก็ต', 'ขอนแก่น'], 1],
  ['พืชใช้ส่วนใดรับแสงเพื่อสังเคราะห์ด้วยแสงเป็นหลัก?', ['ราก', 'ใบ', 'เมล็ด', 'ลำต้น'], 1]
];

function getQuestions() {
  return sample.map(([questionText, choices], index) => ({
    id: `demo-${index + 1}`,
    question_set_id: 'demo',
    question_text: questionText,
    type: 'multiple_choice',
    difficulty: 'medium',
    options: choices.map((text, choiceIndex) => ({
      id: `demo-${index + 1}:${choiceIndex}`,
      option_text: text,
      order_index: choiceIndex
    }))
  }));
}

function validate(questionId, answer) {
  const index = Number(String(questionId).replace('demo-', '')) - 1;
  if (!/^demo-[1-4]$/.test(String(questionId)) || !sample[index]) return null;
  return String(answer) === `${questionId}:${sample[index][2]}`;
}

module.exports = { getQuestions, validate };
