class QuestionManager {
  constructor() {
    this.currentQuestion = null;
    this.questionModal = document.getElementById('questionModal');
    this.submitBtn = document.getElementById('submitAnswerBtn');
    this.questionContent = document.getElementById('questionContent');
    this.selectedAnswer = null;
  }

  async loadQuestions(setId = null) {
    try {
      const url = setId ? `/api/questions?setId=${setId}` : '/api/questions';
      const response = await fetch(url, { cache: 'no-store' });
      const questions = await response.json();
      return questions;
    } catch (error) {
      console.error('Error loading questions:', error);
      return [];
    }
  }

  displayRandomQuestion(questions) {
    if (questions.length === 0) return null;

    const randomIndex = Math.floor(Math.random() * questions.length);
    this.currentQuestion = questions[randomIndex];
    this.selectedAnswer = null;

    this.renderQuestion(this.currentQuestion);
    this.showModal();

    return this.currentQuestion;
  }

  renderQuestion(question) {
    this.questionContent.innerHTML = '';

    // Question text
    const questionTitle = document.createElement('h4');
    questionTitle.textContent = question.question_text;
    this.questionContent.appendChild(questionTitle);

    // Render based on type
    switch (question.type) {
      case 'multiple_choice':
        this.renderMultipleChoice(question);
        break;
      case 'true_false':
        this.renderTrueFalse(question);
        break;
      case 'fill_in_blank':
        this.renderFillInBlank(question);
        break;
      case 'matching_pairs':
        this.renderMatchingPairs(question);
        break;
    }
  }

  renderMultipleChoice(question) {
    const container = document.createElement('div');
    container.className = 'options-container';

    question.options.forEach(option => {
      const label = document.createElement('label');
      label.className = 'option-label';

      const input = document.createElement('input');
      input.type = 'radio';
      input.name = 'answer';
      input.value = option.id;

      input.addEventListener('change', () => {
        this.selectedAnswer = option.id;
      });

      label.appendChild(input);
      label.appendChild(document.createTextNode(option.option_text));

      container.appendChild(label);
    });

    this.questionContent.appendChild(container);
  }

  renderTrueFalse(question) {
    const container = document.createElement('div');
    container.className = 'options-container';

    ['True', 'False'].forEach(value => {
      const label = document.createElement('label');
      label.className = 'option-label';

      const input = document.createElement('input');
      input.type = 'radio';
      input.name = 'answer';
      input.value = value;

      input.addEventListener('change', () => {
        this.selectedAnswer = value;
      });

      label.appendChild(input);
      label.appendChild(document.createTextNode(value));

      container.appendChild(label);
    });

    this.questionContent.appendChild(container);
  }

  renderFillInBlank(question) {
    const container = document.createElement('div');
    container.className = 'answer-container';

    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Enter your answer...';

    input.addEventListener('change', () => {
      this.selectedAnswer = input.value;
    });

    container.appendChild(input);
    this.questionContent.appendChild(container);
  }

  renderMatchingPairs(question) {
    const container = document.createElement('div');
    container.className = 'matching-container';

    // Simple implementation: treat as select answer
    const select = document.createElement('select');

    question.options.forEach((option, index) => {
      const optGroup = document.createElement('optgroup');
      optGroup.label = `Option ${index + 1}`;

      const opt = document.createElement('option');
      opt.value = option.id;
      opt.textContent = option.option_text;

      optGroup.appendChild(opt);
      select.appendChild(optGroup);
    });

    select.addEventListener('change', () => {
      this.selectedAnswer = select.value;
    });

    container.appendChild(select);
    this.questionContent.appendChild(container);
  }

  async validateAnswer() {
    if (!this.currentQuestion || !this.selectedAnswer) {
      alert('กรุณาเลือกคำตอบ');
      return null;
    }

    try {
      const response = await fetch(`/api/questions/${this.currentQuestion.id}/validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ userAnswer: this.selectedAnswer })
      });

      const result = await response.json();
      return result.isCorrect;
    } catch (error) {
      console.error('Error validating answer:', error);
      return null;
    }
  }

  showModal() {
    if (this.questionModal) {
      this.questionModal.style.display = 'flex';
    }
  }

  hideModal() {
    if (this.questionModal) {
      this.questionModal.style.display = 'none';
    }
  }

  getSelectedAnswer() {
    return this.selectedAnswer;
  }

  clear() {
    this.currentQuestion = null;
    this.selectedAnswer = null;
    this.hideModal();
  }
}

// Global question manager instance
const questionManager = new QuestionManager();
