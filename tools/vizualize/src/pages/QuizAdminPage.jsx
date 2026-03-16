import React, { useMemo, useState } from 'react';
import {
  buildMoodleXml,
  createEmptyQuestion,
  parseMoodleXml
} from '../features/quiz/moodleXml.js';
import '../features/quiz/quiz-admin.css';

const TYPE_OPTIONS = [
  { value: 'multichoice', label: 'Multiple Choice' },
  { value: 'truefalse', label: 'True / False' },
  { value: 'shortanswer', label: 'Short Answer' }
];

export function QuizAdminPage() {
  const [categoryPath, setCategoryPath] = useState('$course$/top/Programiranje');
  const [quizTitle, setQuizTitle] = useState('Novi kviz');
  const [questions, setQuestions] = useState([createEmptyQuestion('multichoice')]);
  const [statusText, setStatusText] = useState('Spremno za kreiranje pitanja.');

  const xmlPreview = useMemo(() => {
    return buildMoodleXml({ categoryPath, questions });
  }, [categoryPath, questions]);

  function updateQuestion(questionId, patch) {
    setQuestions((curr) => curr.map((q) => (q.id === questionId ? { ...q, ...patch } : q)));
  }

  function updateAnswer(questionId, answerId, patch) {
    setQuestions((curr) => curr.map((q) => {
      if (q.id !== questionId || !Array.isArray(q.answers)) {
        return q;
      }
      return {
        ...q,
        answers: q.answers.map((a) => (a.id === answerId ? { ...a, ...patch } : a))
      };
    }));
  }

  function switchQuestionType(questionId, nextType) {
    setQuestions((curr) => curr.map((q) => {
      if (q.id !== questionId) {
        return q;
      }
      const fresh = createEmptyQuestion(nextType);
      return {
        ...fresh,
        id: q.id,
        name: q.name,
        questiontext: q.questiontext,
        generalfeedback: q.generalfeedback,
        defaultgrade: q.defaultgrade,
        penalty: q.penalty,
        hidden: q.hidden
      };
    }));
  }

  function addAnswer(questionId) {
    setQuestions((curr) => curr.map((q) => {
      if (q.id !== questionId || !Array.isArray(q.answers)) {
        return q;
      }
      return {
        ...q,
        answers: [
          ...q.answers,
          { id: `${Date.now()}_${Math.random()}`, text: '', fraction: 0, feedback: '', isCorrect: false }
        ]
      };
    }));
  }

  function setSingleCorrect(questionId, answerId) {
    setQuestions((curr) => curr.map((q) => {
      if (q.id !== questionId || !Array.isArray(q.answers)) {
        return q;
      }
      return {
        ...q,
        answers: q.answers.map((a) => ({ ...a, isCorrect: a.id === answerId }))
      };
    }));
  }

  function removeAnswer(questionId, answerId) {
    setQuestions((curr) => curr.map((q) => {
      if (q.id !== questionId || !Array.isArray(q.answers)) {
        return q;
      }
      if (q.answers.length <= 1) {
        return q;
      }
      return {
        ...q,
        answers: q.answers.filter((a) => a.id !== answerId)
      };
    }));
  }

  function addQuestion(type) {
    setQuestions((curr) => [...curr, createEmptyQuestion(type)]);
    setStatusText(`Dodato pitanje tipa: ${type}`);
  }

  function duplicateQuestion(questionId) {
    setQuestions((curr) => {
      const target = curr.find((q) => q.id === questionId);
      if (!target) {
        return curr;
      }
      const clone = JSON.parse(JSON.stringify(target));
      clone.id = `${target.id}_copy_${Date.now()}`;
      clone.name = `${target.name} (kopija)`;
      if (Array.isArray(clone.answers)) {
        clone.answers = clone.answers.map((a) => ({ ...a, id: `${a.id}_copy_${Math.random()}` }));
      }
      return [...curr, clone];
    });
  }

  function removeQuestion(questionId) {
    setQuestions((curr) => curr.filter((q) => q.id !== questionId));
  }

  function moveQuestion(questionId, direction) {
    setQuestions((curr) => {
      const idx = curr.findIndex((q) => q.id === questionId);
      if (idx < 0) {
        return curr;
      }
      const nextIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (nextIdx < 0 || nextIdx >= curr.length) {
        return curr;
      }
      const next = [...curr];
      const tmp = next[idx];
      next[idx] = next[nextIdx];
      next[nextIdx] = tmp;
      return next;
    });
  }

  function downloadXml() {
    const fileNameBase = String(quizTitle || 'quiz').trim().replace(/[^a-zA-Z0-9._-]+/g, '_') || 'quiz';
    const blob = new Blob([xmlPreview], { type: 'application/xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fileNameBase}.xml`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setStatusText('XML eksportovan.');
  }

  function clearAll() {
    setQuestions([createEmptyQuestion('multichoice')]);
    setStatusText('Resetovan editor.');
  }

  async function importXml(file) {
    if (!file) {
      return;
    }
    try {
      const text = await file.text();
      const parsed = parseMoodleXml(text);
      setCategoryPath(parsed.categoryPath || '$course$/top/Programiranje');
      setQuestions(parsed.questions.length > 0 ? parsed.questions : [createEmptyQuestion('multichoice')]);
      if (parsed.unsupportedTypes.length > 0) {
        setStatusText(`Uvezeno uz preskakanje tipova: ${parsed.unsupportedTypes.join(', ')}`);
      } else {
        setStatusText(`Uvezeno ${parsed.questions.length} pitanja.`);
      }
    } catch (error) {
      setStatusText(error.message || 'Greška pri importu XML-a.');
    }
  }

  return (
    <div id="quiz-admin-app">
      <header className="qa-topbar">
        <div>
          <h1>Quiz Admin</h1>
          <p className="qa-subtitle">Brže kreiranje pitanja i export u Moodle XML</p>
        </div>
        <div className="qa-actions">
          <input
            type="file"
            accept=".xml,.txt,.html,.xhtml"
            onChange={(e) => importXml(e.target.files?.[0] || null)}
          />
          <button type="button" onClick={downloadXml}>Export Moodle XML</button>
        </div>
      </header>

      <main className="qa-layout">
        <section className="qa-editor">
          <div className="qa-meta-card">
            <h2>Quiz Metadata</h2>
            <label>
              Quiz title
              <input value={quizTitle} onChange={(e) => setQuizTitle(e.target.value)} />
            </label>
            <label>
              Moodle category path
              <input value={categoryPath} onChange={(e) => setCategoryPath(e.target.value)} />
            </label>
            <div className="qa-type-actions">
              {TYPE_OPTIONS.map((option) => (
                <button key={option.value} type="button" onClick={() => addQuestion(option.value)}>
                  + {option.label}
                </button>
              ))}
              <button type="button" className="ghost" onClick={clearAll}>Reset</button>
            </div>
            <p className="qa-status">{statusText}</p>
          </div>

          {questions.map((question, idx) => (
            <article key={question.id} className="qa-question-card">
              <div className="qa-question-head">
                <h3>{idx + 1}. {question.name || 'Novo pitanje'}</h3>
                <div className="qa-row-actions">
                  <button type="button" onClick={() => moveQuestion(question.id, 'up')}>Up</button>
                  <button type="button" onClick={() => moveQuestion(question.id, 'down')}>Down</button>
                  <button type="button" onClick={() => duplicateQuestion(question.id)}>Duplicate</button>
                  <button type="button" className="danger" onClick={() => removeQuestion(question.id)}>Delete</button>
                </div>
              </div>

              <div className="qa-grid-2">
                <label>
                  Type
                  <select
                    value={question.type}
                    onChange={(e) => switchQuestionType(question.id, e.target.value)}
                  >
                    {TYPE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Name
                  <input value={question.name} onChange={(e) => updateQuestion(question.id, { name: e.target.value })} />
                </label>
              </div>

              <label>
                Question text
                <textarea
                  rows="3"
                  value={question.questiontext}
                  onChange={(e) => updateQuestion(question.id, { questiontext: e.target.value })}
                />
              </label>

              <label>
                General feedback
                <textarea
                  rows="2"
                  value={question.generalfeedback || ''}
                  onChange={(e) => updateQuestion(question.id, { generalfeedback: e.target.value })}
                />
              </label>

              <div className="qa-grid-3">
                <label>
                  Grade
                  <input
                    type="number"
                    step="0.1"
                    value={question.defaultgrade}
                    onChange={(e) => updateQuestion(question.id, { defaultgrade: Number(e.target.value || 1) })}
                  />
                </label>
                <label>
                  Penalty
                  <input
                    type="number"
                    step="0.0001"
                    value={question.penalty}
                    onChange={(e) => updateQuestion(question.id, { penalty: Number(e.target.value || 0) })}
                  />
                </label>
                <label>
                  Hidden
                  <select
                    value={String(question.hidden)}
                    onChange={(e) => updateQuestion(question.id, { hidden: Number(e.target.value || 0) })}
                  >
                    <option value="0">0</option>
                    <option value="1">1</option>
                  </select>
                </label>
              </div>

              {question.type === 'multichoice' ? (
                <>
                  <div className="qa-grid-3">
                    <label>
                      Single answer
                      <select
                        value={question.single ? '1' : '0'}
                        onChange={(e) => {
                          const single = e.target.value === '1';
                          updateQuestion(question.id, { single });
                          if (single) {
                            const winner = (question.answers || []).find((a) => a.isCorrect) || question.answers?.[0];
                            if (winner) {
                              setSingleCorrect(question.id, winner.id);
                            }
                          }
                        }}
                      >
                        <option value="1">true</option>
                        <option value="0">false</option>
                      </select>
                    </label>
                    <label>
                      Auto score fractions
                      <select
                        value={question.autoScore ? '1' : '0'}
                        onChange={(e) => updateQuestion(question.id, { autoScore: e.target.value === '1' })}
                      >
                        <option value="1">on</option>
                        <option value="0">manual</option>
                      </select>
                    </label>
                    <label>
                      Shuffle answers
                      <select
                        value={question.shuffleanswers ? '1' : '0'}
                        onChange={(e) => updateQuestion(question.id, { shuffleanswers: e.target.value === '1' })}
                      >
                        <option value="1">1</option>
                        <option value="0">0</option>
                      </select>
                    </label>
                    <label>
                      Numbering
                      <select
                        value={question.answernumbering}
                        onChange={(e) => updateQuestion(question.id, { answernumbering: e.target.value })}
                      >
                        <option value="abc">abc</option>
                        <option value="ABCD">ABCD</option>
                        <option value="123">123</option>
                        <option value="none">none</option>
                      </select>
                    </label>
                  </div>

                  <AnswerEditor
                    question={question}
                    onAnswerChange={updateAnswer}
                    onAddAnswer={addAnswer}
                    onRemoveAnswer={removeAnswer}
                    onSingleCorrect={setSingleCorrect}
                  />
                </>
              ) : null}

              {question.type === 'shortanswer' ? (
                <>
                  <div className="qa-grid-2">
                    <label>
                      Case sensitive (usecase)
                      <select
                        value={String(question.usecase || 0)}
                        onChange={(e) => updateQuestion(question.id, { usecase: Number(e.target.value || 0) })}
                      >
                        <option value="0">No</option>
                        <option value="1">Yes</option>
                      </select>
                    </label>
                  </div>
                  <AnswerEditor
                    question={question}
                    onAnswerChange={updateAnswer}
                    onAddAnswer={addAnswer}
                    onRemoveAnswer={removeAnswer}
                    onSingleCorrect={setSingleCorrect}
                  />
                </>
              ) : null}

              {question.type === 'truefalse' ? (
                <div className="qa-grid-2">
                  <label>
                    Correct answer
                    <select
                      value={question.correctTrue ? 'true' : 'false'}
                      onChange={(e) => updateQuestion(question.id, { correctTrue: e.target.value === 'true' })}
                    >
                      <option value="true">True</option>
                      <option value="false">False</option>
                    </select>
                  </label>
                  <div></div>
                  <label>
                    True feedback
                    <input
                      value={question.trueFeedback || ''}
                      onChange={(e) => updateQuestion(question.id, { trueFeedback: e.target.value })}
                    />
                  </label>
                  <label>
                    False feedback
                    <input
                      value={question.falseFeedback || ''}
                      onChange={(e) => updateQuestion(question.id, { falseFeedback: e.target.value })}
                    />
                  </label>
                </div>
              ) : null}
            </article>
          ))}
        </section>

        <aside className="qa-preview">
          <section className="qa-preview-card">
            <h2>Moodle XML Preview</h2>
            <pre><code>{xmlPreview}</code></pre>
          </section>

          <section className="qa-preview-card">
            <h2>Podržano</h2>
            <ul>
              <li>Import/export: multichoice, truefalse, shortanswer</li>
              <li>Auto-score za multichoice: tačni dele +100, netačni dele -100 (select-all = 0)</li>
              <li>Category pitanje se čuva kao `type="category"`</li>
              <li>Ako ubaciš XHTML export iz Moodla, editor javlja grešku</li>
            </ul>
          </section>
        </aside>
      </main>
    </div>
  );
}

function AnswerEditor({ question, onAnswerChange, onAddAnswer, onRemoveAnswer, onSingleCorrect }) {
  const isMultichoice = question.type === 'multichoice';
  const isShortAnswer = question.type === 'shortanswer';

  return (
    <section className="qa-answer-section">
      <div className="qa-answer-head">
        <h4>Answers</h4>
        <button type="button" onClick={() => onAddAnswer(question.id)}>+ Add answer</button>
      </div>
      {(question.answers || []).map((answer, idx) => (
        <div className={`qa-answer-row${isMultichoice ? ' qa-answer-row-mc' : ''}`} key={answer.id}>
          {isMultichoice ? (
            <label>
              Correct
              {question.single ? (
                <input
                  type="radio"
                  name={`single_correct_${question.id}`}
                  checked={Boolean(answer.isCorrect)}
                  onChange={() => onSingleCorrect(question.id, answer.id)}
                />
              ) : (
                <input
                  type="checkbox"
                  checked={Boolean(answer.isCorrect)}
                  onChange={(e) => onAnswerChange(question.id, answer.id, { isCorrect: e.target.checked })}
                />
              )}
            </label>
          ) : null}
          <label>
            #{idx + 1} text
            <input
              value={answer.text}
              onChange={(e) => onAnswerChange(question.id, answer.id, { text: e.target.value })}
            />
          </label>
          {isShortAnswer || !question.autoScore ? (
            <label>
              Fraction
              <input
                type="number"
                step="1"
                value={Number(answer.fraction || 0)}
                onChange={(e) => onAnswerChange(question.id, answer.id, { fraction: Number(e.target.value || 0) })}
              />
            </label>
          ) : (
            <label>
              Fraction (auto)
              <input type="text" value="auto" readOnly />
            </label>
          )}
          <label>
            Feedback
            <input
              value={answer.feedback || ''}
              onChange={(e) => onAnswerChange(question.id, answer.id, { feedback: e.target.value })}
            />
          </label>
          <button type="button" className="danger" onClick={() => onRemoveAnswer(question.id, answer.id)}>Remove</button>
        </div>
      ))}
    </section>
  );
}
