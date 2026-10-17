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
    const feedback = await questions.answerFeedback(req.params.id, req.body.userAnswer);
    if (feedback === null) return res.status(404).json({ error: 'Question not found' });
    res.set('Cache-Control', 'no-store').json(feedback);
  } catch (error) { fail(res, error); }
});

module.exports = router;
