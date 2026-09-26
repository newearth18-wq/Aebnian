const express = require('express');
const questions = require('./supabase');
const router = express.Router();

function fail(res, error) {
  console.error('Question API:', error);
  res.status(503).json({ error: 'Question database is temporarily unavailable' });
}

router.get('/sets', async (_req, res) => {
  try { res.json(await questions.listSets()); }
  catch (error) { fail(res, error); }
});

router.get('/', async (req, res) => {
  try { res.json(await questions.listQuestions(req.query.setId)); }
  catch (error) { fail(res, error); }
});

router.post('/:id/validate', async (req, res) => {
  try {
    const isCorrect = await questions.validateAnswer(req.params.id, req.body.userAnswer);
    if (isCorrect === null) return res.status(404).json({ error: 'Question not found' });
    res.json({ isCorrect });
  } catch (error) { fail(res, error); }
});

module.exports = router;
