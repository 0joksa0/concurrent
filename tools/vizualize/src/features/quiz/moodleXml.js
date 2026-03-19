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

function splitAnswerText(line) {
  const idx = line.indexOf('|');
  if (idx < 0) {
    return { text: line.trim(), feedback: '' };
  }
  return {
    text: line.slice(0, idx).trim(),
    feedback: line.slice(idx + 1).trim()
  };
}

function parseTextAnswerLine(rawLine) {
  const line = String(rawLine || '').trim();
  if (!line) {
    return null;
  }

  if (line.startsWith('+') || line.startsWith('-')) {
    const marker = line[0];
    const rest = line.slice(1).trim();
    const parsed = splitAnswerText(rest);
    return {
      text: parsed.text,
      feedback: parsed.feedback,
      isCorrect: marker === '+',
      fraction: marker === '+' ? 100 : 0
    };
  }

  const withFraction = line.match(/^\[([+-]?\d+(?:\.\d+)?)\]\s*(.+)$/);
  if (withFraction) {
    const parsed = splitAnswerText(withFraction[2]);
    const fraction = Number(withFraction[1]);
    return {
      text: parsed.text,
      feedback: parsed.feedback,
      isCorrect: fraction > 0,
      fraction
    };
  }

  throw new Error(`Nevalidna answer linija: "${line}"`);
}

function parseTextQuestionBlock(blockText, blockIndex) {
  const lines = String(blockText || '').split(/\r?\n/);
  const data = {
    type: 'multichoice',
    name: `Pitanje ${blockIndex + 1}`,
    questiontext: '',
    generalfeedback: '',
    defaultgrade: 1,
    penalty: 0.3333333,
    hidden: 0,
    autoScore: true,
    single: true,
    shuffleanswers: true,
    answernumbering: 'abc',
    usecase: 0,
    correctTrue: true,
    trueFeedback: '',
    falseFeedback: '',
    answers: []
  };

  let inAnswers = false;
  let hasManualFractions = false;

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith('//')) {
      continue;
    }

    if (inAnswers) {
      if (trimmed.includes(':') && !trimmed.startsWith('+') && !trimmed.startsWith('-') && !trimmed.startsWith('[')) {
        inAnswers = false;
      } else {
        const parsed = parseTextAnswerLine(trimmed);
        if (!parsed) {
          continue;
        }
        if (trimmed.startsWith('[')) {
          hasManualFractions = true;
        }
        data.answers.push({
          id: uid('a'),
          text: parsed.text,
          feedback: parsed.feedback,
          isCorrect: parsed.isCorrect,
          fraction: parsed.fraction
        });
        continue;
      }
    }

    const separatorIdx = trimmed.indexOf(':');
    if (separatorIdx < 0) {
      throw new Error(`Nevalidna linija u pitanju #${blockIndex + 1}: "${trimmed}"`);
    }

    const key = trimmed.slice(0, separatorIdx).trim().toLowerCase();
    const value = trimmed.slice(separatorIdx + 1).trim();

    if (key === 'answers') {
      inAnswers = true;
      continue;
    }

    if (key === 'type' || key === 'tip') {
      data.type = value.toLowerCase();
      continue;
    }

    if (key === 'name' || key === 'naziv') {
      data.name = value;
      continue;
    }

    if (key === 'question' || key === 'pitanje' || key === 'questiontext') {
      data.questiontext = value;
      continue;
    }

    if (key === 'generalfeedback' || key === 'feedback') {
      data.generalfeedback = value;
      continue;
    }

    if (key === 'grade' || key === 'defaultgrade') {
      data.defaultgrade = Number(value || 1);
      continue;
    }

    if (key === 'penalty') {
      data.penalty = Number(value || 0.3333333);
      continue;
    }

    if (key === 'hidden') {
      data.hidden = Number(value || 0);
      continue;
    }

    if (key === 'single') {
      data.single = parseBoolText(value, true);
      continue;
    }

    if (key === 'shuffle' || key === 'shuffleanswers') {
      data.shuffleanswers = parseBoolText(value, true);
      continue;
    }

    if (key === 'numbering' || key === 'answernumbering') {
      data.answernumbering = value || 'abc';
      continue;
    }

    if (key === 'autoscore' || key === 'auto_score') {
      data.autoScore = parseBoolText(value, true);
      continue;
    }

    if (key === 'usecase') {
      data.usecase = Number(value || 0);
      continue;
    }

    if (key === 'correct' || key === 'correcttrue') {
      data.correctTrue = parseBoolText(value, true);
      continue;
    }

    if (key === 'truefeedback' || key === 'true_feedback') {
      data.trueFeedback = value;
      continue;
    }

    if (key === 'falsefeedback' || key === 'false_feedback') {
      data.falseFeedback = value;
      continue;
    }
  }

  if (!data.questiontext) {
    throw new Error(`Pitanje #${blockIndex + 1} nema "question:" polje.`);
  }

  if (data.type === 'truefalse') {
    return {
      id: uid('q'),
      type: 'truefalse',
      name: data.name,
      questiontext: data.questiontext,
      generalfeedback: data.generalfeedback,
      defaultgrade: data.defaultgrade,
      penalty: data.penalty,
      hidden: data.hidden,
      correctTrue: data.correctTrue,
      trueFeedback: data.trueFeedback,
      falseFeedback: data.falseFeedback
    };
  }

  if (data.type === 'shortanswer') {
    if (data.answers.length === 0) {
      throw new Error(`Shortanswer pitanje #${blockIndex + 1} mora imati "answers:".`);
    }
    return {
      id: uid('q'),
      type: 'shortanswer',
      name: data.name,
      questiontext: data.questiontext,
      generalfeedback: data.generalfeedback,
      defaultgrade: data.defaultgrade,
      penalty: data.penalty,
      hidden: data.hidden,
      usecase: data.usecase,
      answers: data.answers.map((a, idx) => ({
        id: uid('a'),
        text: a.text,
        feedback: a.feedback,
        fraction: Number.isFinite(a.fraction) ? a.fraction : (idx === 0 ? 100 : 0)
      }))
    };
  }

  if (data.type !== 'multichoice') {
    throw new Error(`Nepodržan tip pitanja u tekst fajlu: "${data.type}"`);
  }

  if (data.answers.length === 0) {
    throw new Error(`Multichoice pitanje #${blockIndex + 1} mora imati "answers:".`);
  }

  const single = data.single;
  const autoScore = hasManualFractions ? false : data.autoScore;
  let answers = data.answers.map((a) => ({ ...a }));

  if (single) {
    let winner = answers.findIndex((a) => a.isCorrect);
    if (winner < 0) {
      winner = 0;
    }
    answers = answers.map((a, idx) => ({
      ...a,
      isCorrect: idx === winner
    }));
  }

  if (!autoScore) {
    answers = answers.map((a) => ({
      ...a,
      fraction: Number.isFinite(a.fraction) ? a.fraction : (a.isCorrect ? 100 : 0)
    }));
  }

  return {
    id: uid('q'),
    type: 'multichoice',
    name: data.name,
    questiontext: data.questiontext,
    generalfeedback: data.generalfeedback,
    defaultgrade: data.defaultgrade,
    penalty: data.penalty,
    hidden: data.hidden,
    autoScore,
    single,
    shuffleanswers: data.shuffleanswers,
    answernumbering: data.answernumbering,
    answers
  };
}

export function parseQuizText(text) {
  const src = String(text || '').replace(/^\uFEFF/, '');
  const lines = src.split(/\r?\n/);
  const header = {
    categoryPath: '',
    quizTitle: ''
  };

  const blocks = [];
  let current = [];

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith('//')) {
      continue;
    }

    const headerMatch = trimmed.match(/^@([a-z_]+)\s*:\s*(.+)$/i);
    if (headerMatch && blocks.length === 0 && current.length === 0) {
      const key = headerMatch[1].toLowerCase();
      const value = headerMatch[2].trim();
      if (key === 'category' || key === 'categorypath') {
        header.categoryPath = value;
      } else if (key === 'title' || key === 'quiz' || key === 'quiztitle') {
        header.quizTitle = value;
      }
      continue;
    }

    if (trimmed === '---') {
      if (current.length > 0) {
        blocks.push(current.join('\n'));
        current = [];
      }
      continue;
    }

    current.push(rawLine);
  }

  if (current.length > 0) {
    blocks.push(current.join('\n'));
  }

  if (blocks.length === 0) {
    throw new Error('Tekst fajl nema nijedno pitanje. Razdvajanje pitanja radi se sa linijom "---".');
  }

  const questions = blocks.map((block, idx) => parseTextQuestionBlock(block, idx));
  return {
    categoryPath: header.categoryPath,
    quizTitle: header.quizTitle,
    questions
  };
}
