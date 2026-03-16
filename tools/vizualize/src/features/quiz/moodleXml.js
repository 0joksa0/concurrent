function uid(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function createEmptyQuestion(type = 'multichoice') {
  if (type === 'truefalse') {
    return {
      id: uid('q'),
      type,
      name: 'Novo true/false pitanje',
      questiontext: '',
      generalfeedback: '',
      defaultgrade: 1,
      penalty: 0.3333333,
      hidden: 0,
      correctTrue: true,
      trueFeedback: '',
      falseFeedback: ''
    };
  }

  if (type === 'shortanswer') {
    return {
      id: uid('q'),
      type,
      name: 'Novo short answer pitanje',
      questiontext: '',
      generalfeedback: '',
      defaultgrade: 1,
      penalty: 0.3333333,
      hidden: 0,
      usecase: 0,
      answers: [
        { id: uid('a'), text: '', fraction: 100, feedback: '' }
      ]
    };
  }

  return {
    id: uid('q'),
    type: 'multichoice',
    name: 'Novo multichoice pitanje',
    questiontext: '',
    generalfeedback: '',
    defaultgrade: 1,
    penalty: 0.3333333,
    hidden: 0,
    autoScore: true,
    single: true,
    shuffleanswers: true,
    answernumbering: 'abc',
    answers: [
      { id: uid('a'), text: '', isCorrect: true, fraction: 100, feedback: '' },
      { id: uid('a'), text: '', isCorrect: false, fraction: 0, feedback: '' }
    ]
  };
}

function escapeXml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function textNode(tag, value, indent = '    ') {
  return `${indent}<${tag}>${escapeXml(value)}</${tag}>`;
}

function richTextNode(tag, value, indent = '    ') {
  return [
    `${indent}<${tag} format="html">`,
    `${indent}  <text>${escapeXml(value)}</text>`,
    `${indent}</${tag}>`
  ].join('\n');
}

function answerNode(answer, indent = '    ') {
  return [
    `${indent}<answer fraction="${Number(answer.fraction || 0)}" format="html">`,
    `${indent}  <text>${escapeXml(answer.text || '')}</text>`,
    `${indent}  <feedback format="html">`,
    `${indent}    <text>${escapeXml(answer.feedback || '')}</text>`,
    `${indent}  </feedback>`,
    `${indent}</answer>`
  ].join('\n');
}

function normalizeMultichoice(question) {
  const answers = Array.isArray(question?.answers) ? question.answers : [];
  const mapped = answers.map((a) => ({
    ...a,
    isCorrect: Boolean(a?.isCorrect)
  }));

  if (mapped.length === 0) {
    return [];
  }

  if (!question?.autoScore) {
    return mapped.map((a) => ({ ...a, fraction: Number(a?.fraction || 0) }));
  }

  if (question?.single) {
    let winner = mapped.findIndex((a) => a.isCorrect);
    if (winner < 0) {
      winner = 0;
    }
    return mapped.map((a, idx) => ({
      ...a,
      isCorrect: idx === winner,
      fraction: idx === winner ? 100 : 0
    }));
  }

  const correctCount = mapped.filter((a) => a.isCorrect).length;
  const wrongCount = mapped.length - correctCount;

  if (correctCount === 0) {
    return mapped.map((a) => ({ ...a, fraction: 0 }));
  }

  const positive = 100 / correctCount;
  const negative = wrongCount > 0 ? -100 / wrongCount : 0;

  return mapped.map((a) => ({
    ...a,
    fraction: a.isCorrect ? positive : negative
  }));
}

function questionCommonNodes(question) {
  return [
    `    <name><text>${escapeXml(question.name || '')}</text></name>`,
    richTextNode('questiontext', question.questiontext || ''),
    richTextNode('generalfeedback', question.generalfeedback || ''),
    textNode('defaultgrade', Number(question.defaultgrade || 1), '    '),
    textNode('penalty', Number(question.penalty || 0.3333333), '    '),
    textNode('hidden', Number(question.hidden || 0), '    ')
  ];
}

function renderQuestion(question) {
  const common = questionCommonNodes(question);

  if (question.type === 'truefalse') {
    const trueFraction = question.correctTrue ? 100 : 0;
    const falseFraction = question.correctTrue ? 0 : 100;
    return [
      '<question type="truefalse">',
      ...common,
      answerNode({ text: 'true', fraction: trueFraction, feedback: question.trueFeedback || '' }),
      answerNode({ text: 'false', fraction: falseFraction, feedback: question.falseFeedback || '' }),
      '</question>'
    ].join('\n');
  }

  if (question.type === 'shortanswer') {
    return [
      '<question type="shortanswer">',
      ...common,
      textNode('usecase', Number(question.usecase || 0), '    '),
      ...(question.answers || []).map((a) => answerNode(a)),
      '</question>'
    ].join('\n');
  }

  return [
    '<question type="multichoice">',
    ...common,
    textNode('single', question.single ? 'true' : 'false', '    '),
    textNode('shuffleanswers', question.shuffleanswers ? '1' : '0', '    '),
    textNode('answernumbering', question.answernumbering || 'abc', '    '),
    ...normalizeMultichoice(question).map((a) => answerNode(a)),
    '</question>'
  ].join('\n');
}

function categoryNode(path) {
  if (!String(path || '').trim()) {
    return '';
  }
  return [
    '<question type="category">',
    '  <category>',
    `    <text>${escapeXml(path)}</text>`,
    '  </category>',
    '</question>'
  ].join('\n');
}

export function buildMoodleXml(payload) {
  const categoryPath = String(payload?.categoryPath || '').trim();
  const questions = Array.isArray(payload?.questions) ? payload.questions : [];
  const blocks = [];
  const category = categoryNode(categoryPath);
  if (category) {
    blocks.push(category);
  }
  for (const question of questions) {
    blocks.push(renderQuestion(question));
  }

  return ['<?xml version="1.0" encoding="UTF-8"?>', '<quiz>', ...blocks, '</quiz>', ''].join('\n');
}

function childText(parent, tag) {
  if (!parent) {
    return '';
  }
  const node = parent.getElementsByTagName(tag)[0];
  if (!node) {
    return '';
  }
  const textNodeEl = node.getElementsByTagName('text')[0];
  if (textNodeEl) {
    return textNodeEl.textContent || '';
  }
  return node.textContent || '';
}

function parseAnswer(answerEl) {
  const text = childText(answerEl, 'text');
  const fraction = Number(answerEl.getAttribute('fraction') || 0);
  const feedback = childText(answerEl, 'feedback');
  return {
    id: uid('a'),
    text,
    fraction,
    feedback
  };
}

function parseBoolText(value, fallback = false) {
  const text = String(value || '').trim().toLowerCase();
  if (!text) {
    return fallback;
  }
  return text === '1' || text === 'true' || text === 'yes';
}

export function parseMoodleXml(xmlText) {
  const src = String(xmlText || '');
  if (/<html[\s>]/i.test(src) && !/<quiz[\s>]/i.test(src)) {
    throw new Error('Ovaj fajl izgleda kao Moodle XHTML export prikaz, ne Moodle XML quiz import.');
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(src, 'application/xml');
  if (doc.querySelector('parsererror')) {
    throw new Error('Nevalidan XML fajl.');
  }

  const quiz = doc.getElementsByTagName('quiz')[0];
  if (!quiz) {
    throw new Error('Nedostaje <quiz> root element.');
  }

  let categoryPath = '';
  const questions = [];
  const unsupported = new Set();
  const questionNodes = [...quiz.getElementsByTagName('question')];

  for (const qEl of questionNodes) {
    const type = String(qEl.getAttribute('type') || '').trim().toLowerCase();
    if (!type) {
      continue;
    }

    if (type === 'category') {
      categoryPath = childText(qEl, 'category');
      continue;
    }

    if (type === 'truefalse') {
      const answers = [...qEl.getElementsByTagName('answer')].map(parseAnswer);
      const trueAnswer = answers.find((a) => String(a.text).trim().toLowerCase() === 'true');
      const falseAnswer = answers.find((a) => String(a.text).trim().toLowerCase() === 'false');
      questions.push({
        id: uid('q'),
        type,
        name: childText(qEl, 'name'),
        questiontext: childText(qEl, 'questiontext'),
        generalfeedback: childText(qEl, 'generalfeedback'),
        defaultgrade: Number(childText(qEl, 'defaultgrade') || 1),
        penalty: Number(childText(qEl, 'penalty') || 0.3333333),
        hidden: Number(childText(qEl, 'hidden') || 0),
        correctTrue: Number(trueAnswer?.fraction || 0) >= Number(falseAnswer?.fraction || 0),
        trueFeedback: trueAnswer?.feedback || '',
        falseFeedback: falseAnswer?.feedback || ''
      });
      continue;
    }

    if (type === 'multichoice') {
      const parsedAnswers = [...qEl.getElementsByTagName('answer')].map(parseAnswer);
      questions.push({
        id: uid('q'),
        type,
        name: childText(qEl, 'name'),
        questiontext: childText(qEl, 'questiontext'),
        generalfeedback: childText(qEl, 'generalfeedback'),
        defaultgrade: Number(childText(qEl, 'defaultgrade') || 1),
        penalty: Number(childText(qEl, 'penalty') || 0.3333333),
        hidden: Number(childText(qEl, 'hidden') || 0),
        autoScore: true,
        single: parseBoolText(childText(qEl, 'single'), true),
        shuffleanswers: parseBoolText(childText(qEl, 'shuffleanswers'), true),
        answernumbering: childText(qEl, 'answernumbering') || 'abc',
        answers: parsedAnswers.map((a) => ({
          ...a,
          isCorrect: Number(a.fraction || 0) > 0
        }))
      });
      continue;
    }

    if (type === 'shortanswer') {
      questions.push({
        id: uid('q'),
        type,
        name: childText(qEl, 'name'),
        questiontext: childText(qEl, 'questiontext'),
        generalfeedback: childText(qEl, 'generalfeedback'),
        defaultgrade: Number(childText(qEl, 'defaultgrade') || 1),
        penalty: Number(childText(qEl, 'penalty') || 0.3333333),
        hidden: Number(childText(qEl, 'hidden') || 0),
        usecase: Number(childText(qEl, 'usecase') || 0),
        answers: [...qEl.getElementsByTagName('answer')].map(parseAnswer)
      });
      continue;
    }

    unsupported.add(type);
  }

  return {
    categoryPath,
    questions,
    unsupportedTypes: [...unsupported]
  };
}
