import { loadSampleData, loadDataFromFiles, loadPrebuiltScenarios } from './loaders.js';
import {
  buildGraph,
  setActiveEvent,
  clearActive,
  getTypeColor,
  resetThreadMarkers,
  syncThreadMarkers
} from './graph.js';
import { ReplayController } from './replay.js';
import { buildExecutionModel } from './model.js';

const PALETTE = [
  '#ef4444', '#22c55e', '#3b82f6', '#f59e0b', '#a855f7',
  '#14b8a6', '#ec4899', '#84cc16', '#f97316', '#06b6d4'
];

export function initApp() {
  const ui = getUi();
  let cy = null;
  let replay = new ReplayController([], onReplayEvent);
  let model = buildExecutionModel([], []);
  let rawNodes = [];
  let rawTrace = [];
  let folderScenarios = [];
  const threadColors = new Map();
  const snippetCache = new Map();
  const threadLastCodeKey = new Map();
  let lastReplayIndex = -1;
  let panelToken = 0;

  bindUi();
  loadDefaultScenarios();

  function bindUi() {
    ui.loadFilesBtn.addEventListener('click', () => loadFromFiles());
    ui.scenarioSelect.addEventListener('change', () => {
      if (!ui.scenarioSelect.value) {
        return;
      }
      loadSelectedScenario(ui.scenarioSelect.value);
    });

    ui.playBtn.addEventListener('click', () => replay.play());
    ui.pauseBtn.addEventListener('click', () => replay.pause());
    ui.nextBtn.addEventListener('click', () => replay.next());
    ui.prevBtn.addEventListener('click', () => replay.prev());
    ui.restartBtn.addEventListener('click', () => replay.restart());
    ui.speedSelect.addEventListener('change', (event) => {
      replay.setSpeed(event.target.value);
    });
    ui.viewMode.addEventListener('change', () => {
      if (rawTrace.length > 0) {
        bootData(rawNodes, rawTrace);
      }
    });
    ui.autoThreadJump.addEventListener('change', (event) => {
      replay.setAutoThreadJump(event.target.checked);
    });
    ui.showResourcesSimple.addEventListener('change', () => {
      if (rawTrace.length > 0) {
        bootData(rawNodes, rawTrace);
      }
    });
    ui.timelineRange.addEventListener('input', (event) => {
      const value = Number(event.target.value);
      replay.setIndex(value - 1);
    });
  }

  async function loadDefaultScenarios() {
    try {
      folderScenarios = await loadPrebuiltScenarios();
      renderScenarioSelect(folderScenarios);
      if (folderScenarios.length > 0) {
        ui.scenarioSelect.value = folderScenarios[0].key;
        loadSelectedScenario(folderScenarios[0].key);
      }
    } catch (error) {
      // fallback for old setup where only /sample exists
      try {
        const data = await loadSampleData();
        bootData(data.nodes, data.trace);
      } catch (fallbackError) {
        setMessage(fallbackError.message || error.message);
      }
    }
  }

  async function loadFromFiles() {
    try {
      const data = await loadDataFromFiles(ui.nodesFile.files[0], ui.traceFile.files[0]);
      bootData(data.nodes, data.trace);
    } catch (error) {
      setMessage(error.message);
    }
  }

  function renderScenarioSelect(scenarios) {
    ui.scenarioSelect.innerHTML = '';
    for (const scenario of scenarios) {
      const option = document.createElement('option');
      option.value = scenario.key;
      option.textContent = scenario.name;
      ui.scenarioSelect.appendChild(option);
    }
  }

  function loadSelectedScenario(key) {
    const selected = folderScenarios.find((s) => s.key === key);
    if (!selected) {
      setMessage(`Scenario not found: ${key}`);
      return;
    }
    bootData(selected.nodes, selected.trace);
  }

  function bootData(nodes, trace) {
    rawNodes = nodes || [];
    rawTrace = trace || [];
    model = buildExecutionModel(rawNodes, rawTrace, {
      simpleMode: ui.viewMode.value === 'simple'
    });

    if (cy) {
      cy.destroy();
    }

    cy = buildGraph(ui.cy, model, {
      showResourcesInSimpleMode: ui.showResourcesSimple.checked
    });

    threadColors.clear();
    threadLastCodeKey.clear();
    lastReplayIndex = -1;
    replay.pause();
    replay = new ReplayController(model.events, onReplayEvent);
    replay.setSpeed(ui.speedSelect.value);
    replay.setAutoThreadJump(ui.autoThreadJump.checked);
    ui.timelineRange.min = '0';
    ui.timelineRange.max = String(model.events.length);
    ui.timelineRange.value = '0';
    ui.timelineLabel.textContent = `0 / ${model.events.length}`;

    renderTypeLegend(model.codeNodes);
    renderThreadLegend(model.availableThreads);

    replay.restart();
    setMessage(
      `Loaded ${model.events.length} trace events. Showing ${model.codeNodes.length} trace-relevant code nodes ` +
      `(from ${model.traceNodesCount} node ids, ${model.nodeDefsCount} annotated nodes total).`
    );
  }

  function renderTypeLegend(codeNodes) {
    ui.typeLegend.innerHTML = '';
    const types = new Set(codeNodes.map((n) => n.type || 'default'));

    for (const type of types) {
      const li = document.createElement('li');
      const color = getTypeColor(type);
      li.innerHTML = `<span class="swatch" style="background:${color}"></span><span>${type}</span>`;
      ui.typeLegend.appendChild(li);
    }
  }

  function renderThreadLegend(threads) {
    ui.threadLegend.innerHTML = '';

    for (const thread of threads) {
      const color = colorForThread(thread.threadName);
      const li = document.createElement('li');
      li.innerHTML = `<span class="swatch" style="background:${color}"></span><span>${thread.threadName}</span>`;
      ui.threadLegend.appendChild(li);
    }
  }

  function colorForThread(threadName) {
    const key = threadName || 'unregistered';
    if (!threadColors.has(key)) {
      threadColors.set(key, PALETTE[threadColors.size % PALETTE.length]);
    }
    return threadColors.get(key);
  }

  async function onReplayEvent(event, index, total) {
    if (!cy) {
      return;
    }

    panelToken += 1;
    const token = panelToken;

    if (!event) {
      clearActive(cy);
      threadLastCodeKey.clear();
      lastReplayIndex = -1;
      resetThreadMarkers(cy);
      ui.timelineRange.value = '0';
      ui.timelineLabel.textContent = `0 / ${total}`;
      ui.eventInfo.innerHTML = total > 0
        ? `<div class="muted">Ready: ${total} events loaded. Use Play/Next to start replay.</div>`
        : '<div class="muted">No events loaded.</div>';
      return;
    }

    const thread = event.thread_name || 'unregistered';
    const color = colorForThread(thread);
    const prevEvent = index > 0 ? model.events[index - 1] : null;
    setActiveEvent(cy, event, prevEvent, color);

    if (index <= lastReplayIndex) {
      threadLastCodeKey.clear();
      for (let i = 0; i <= index; i += 1) {
        const e = model.events[i];
        if (e?.actualThreadKey && e?.codeKey) {
          threadLastCodeKey.set(e.actualThreadKey, e.codeKey);
        }
      }
    } else if (event.actualThreadKey && event.codeKey) {
      threadLastCodeKey.set(event.actualThreadKey, event.codeKey);
    }
    lastReplayIndex = index;
    syncThreadMarkers(cy, threadLastCodeKey, colorForThread);

    ui.timelineRange.value = String(index + 1);
    ui.timelineLabel.textContent = `${index + 1} / ${total}`;

    const codeMeta = model.codeNodes.find((n) => n.id === event.codeKey);
    const resources = (event.resourceKeys || []).map((k) => k.replace(/^res:/, '')).join(', ') || 'none';
    const snippet = await resolveSnippet(codeMeta, event);
    if (token !== panelToken) {
      return;
    }

    ui.eventInfo.innerHTML = renderEventInfo({
      index: `${index + 1}/${total}`,
      timestamp: event.timestamp_us ?? '',
      thread,
      fn: event.function ?? '',
      node: event.node_id ?? '',
      label: codeMeta?.label || event.node_id || '',
      type: codeMeta?.type || '',
      location: `${event.file ?? ''}:${event.line ?? ''}`,
      resources,
      snippet
    });
  }

  async function resolveSnippet(codeMeta, event) {
    const fallback = codeMeta?.snippet || codeMeta?.label || event.node_id || 'snippet unavailable';
    const file = event.file || codeMeta?.file;
    const line = Number(event.line || codeMeta?.line || 0);

    if (!file || !line) {
      return fallback;
    }

    const key = `${file}:${line}`;
    if (snippetCache.has(key)) {
      return snippetCache.get(key);
    }

    const sourceLine = await fetchSourceLine(file, line);
    const snippet = sourceLine || fallback;
    snippetCache.set(key, snippet);
    return snippet;
  }

  function setMessage(message) {
    ui.eventInfo.innerHTML = `<div class="muted">${escapeHtml(message)}</div>`;
  }
}

async function fetchSourceLine(file, line) {
  const lineNumber = Number(line);
  if (!file || !lineNumber || lineNumber < 1) {
    return null;
  }

  const normalized = String(file).replace(/\\/g, '/');
  const urls = [];

  if (normalized.startsWith('/')) {
    urls.push(`/@fs${normalized}`);
  }
  urls.push(`/${normalized.replace(/^\/+/, '')}`);

  for (const url of urls) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        continue;
      }
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('text/html')) {
        continue;
      }
      const text = await response.text();
      if (looksLikeHtml(text)) {
        continue;
      }
      const rows = text.split(/\r?\n/);
      const picked = rows[lineNumber - 1]?.trim();
      if (picked) {
        if (/^<[/a-zA-Z!][^>]*>$/.test(picked)) {
          continue;
        }
        return picked.length > 120 ? `${picked.slice(0, 117)}...` : picked;
      }
    } catch {
      // ignore source lookup failures in MVP mode
    }
  }

  return null;
}

function looksLikeHtml(text) {
  const head = String(text).slice(0, 240).toLowerCase();
  return head.includes('<!doctype html') || head.includes('<html') || head.includes('<body');
}

function getUi() {
  return {
    cy: document.getElementById('cy'),
    nodesFile: document.getElementById('nodesFile'),
    traceFile: document.getElementById('traceFile'),
    loadFilesBtn: document.getElementById('loadFilesBtn'),
    scenarioSelect: document.getElementById('scenarioSelect'),
    restartBtn: document.getElementById('restartBtn'),
    prevBtn: document.getElementById('prevBtn'),
    playBtn: document.getElementById('playBtn'),
    pauseBtn: document.getElementById('pauseBtn'),
    nextBtn: document.getElementById('nextBtn'),
    speedSelect: document.getElementById('speedSelect'),
    viewMode: document.getElementById('viewMode'),
    autoThreadJump: document.getElementById('autoThreadJump'),
    showResourcesSimple: document.getElementById('showResourcesSimple'),
    timelineRange: document.getElementById('timelineRange'),
    timelineLabel: document.getElementById('timelineLabel'),
    eventInfo: document.getElementById('eventInfo'),
    typeLegend: document.getElementById('typeLegend'),
    threadLegend: document.getElementById('threadLegend')
  };
}

function renderEventInfo(data) {
  const rows = [
    ['index', data.index],
    ['timestamp_us', data.timestamp],
    ['current_thread', data.thread],
    ['current_function', data.fn],
    ['current_node', data.node],
    ['node_label', data.label],
    ['type', data.type],
    ['location', data.location],
    ['related_resources', data.resources]
  ];

  const htmlRows = rows
    .map(([k, v]) => `<div class="event-row"><div class="event-key">${escapeHtml(k)}</div><div>${escapeHtml(String(v || ''))}</div></div>`)
    .join('');

  return `${htmlRows}<pre class="event-code"><code>${highlightC(data.snippet || 'snippet unavailable')}</code></pre>`;
}

function highlightC(text) {
  let out = escapeHtml(text);
  out = out.replace(/\b(static|void|int|char|long|short|unsigned|return|if|else|for|while|struct|typedef)\b/g, '<span class="tok-keyword">$1</span>');
  out = out.replace(/\b([a-zA-Z_][a-zA-Z0-9_]*)\s*(?=\()/g, '<span class="tok-fn">$1</span>');
  out = out.replace(/([{}(),])/g, '<span class="tok-sym">$1</span>');
  return out;
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
