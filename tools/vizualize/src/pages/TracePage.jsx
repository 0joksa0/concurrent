import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  loadSampleData,
  loadDataFromFiles,
  loadPrebuiltScenarios
} from '../features/trace/loaders.js';
import {
  buildGraph,
  clearActive,
  getTypeColor,
  resetThreadMarkers,
  setActiveEvent,
  syncThreadMarkers
} from '../features/trace/graph.js';
import { buildExecutionModel } from '../features/trace/model.js';
import '../features/trace/styles.css';

const PALETTE = [
  '#ef4444', '#22c55e', '#3b82f6', '#f59e0b', '#a855f7',
  '#14b8a6', '#ec4899', '#84cc16', '#f97316', '#06b6d4'
];

export function TracePage() {
  const cyContainerRef = useRef(null);
  const cyRef = useRef(null);
  const threadColorsRef = useRef(new Map());
  const snippetCacheRef = useRef(new Map());
  const panelTokenRef = useRef(0);

  const [scenarioOptions, setScenarioOptions] = useState([]);
  const [selectedScenario, setSelectedScenario] = useState('');
  const [nodesFile, setNodesFile] = useState(null);
  const [traceFile, setTraceFile] = useState(null);

  const [rawNodes, setRawNodes] = useState([]);
  const [rawTrace, setRawTrace] = useState([]);

  const [viewMode, setViewMode] = useState('simple');
  const [showResourcesSimple, setShowResourcesSimple] = useState(false);
  const [autoThreadJump, setAutoThreadJump] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [index, setIndex] = useState(-1);

  const [statusText, setStatusText] = useState('Učitavanje scenarija...');
  const [eventInfo, setEventInfo] = useState(null);

  const model = useMemo(() => buildExecutionModel(rawNodes, rawTrace, {
    simpleMode: viewMode === 'simple'
  }), [rawNodes, rawTrace, viewMode]);

  const total = model.events.length;
  const activeEvent = (index >= 0 && index < total) ? model.events[index] : null;

  useEffect(() => {
    let alive = true;

    async function boot() {
      try {
        const scenarios = await loadPrebuiltScenarios();
        if (!alive) {
          return;
        }
        setScenarioOptions(scenarios);
        if (scenarios.length > 0) {
          setSelectedScenario(scenarios[0].key);
          setRawNodes(scenarios[0].nodes || []);
          setRawTrace(scenarios[0].trace || []);
        }
      } catch (error) {
        try {
          const sample = await loadSampleData();
          if (!alive) {
            return;
          }
          setRawNodes(sample.nodes || []);
          setRawTrace(sample.trace || []);
        } catch (fallbackError) {
          if (!alive) {
            return;
          }
          setStatusText(fallbackError.message || error.message || 'Neuspešno učitavanje podataka.');
        }
      }
    }

    boot();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    setIsPlaying(false);
    setIndex(-1);
    threadColorsRef.current.clear();
    if (total > 0) {
      setStatusText(
        `Loaded ${total} trace events. Showing ${model.codeNodes.length} trace-relevant code nodes ` +
        `(from ${model.traceNodesCount} node ids, ${model.nodeDefsCount} annotated nodes total).`
      );
    }
  }, [model, total]);

  useEffect(() => {
    if (!cyContainerRef.current) {
      return;
    }

    if (cyRef.current) {
      cyRef.current.destroy();
      cyRef.current = null;
    }

    cyRef.current = buildGraph(cyContainerRef.current, model, {
      showResourcesInSimpleMode: showResourcesSimple
    });

    return () => {
      if (cyRef.current) {
        cyRef.current.destroy();
        cyRef.current = null;
      }
    };
  }, [model, showResourcesSimple]);

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) {
      return;
    }

    if (!activeEvent) {
      clearActive(cy);
      resetThreadMarkers(cy);
      setEventInfo(null);
      return;
    }

    const prevEvent = index > 0 ? model.events[index - 1] : null;
    const color = colorForThread(activeEvent.thread_name || 'unregistered', threadColorsRef.current);
    setActiveEvent(cy, activeEvent, prevEvent, color);

    const threadLastCodeKey = new Map();
    for (let i = 0; i <= index; i += 1) {
      const e = model.events[i];
      if (e?.actualThreadKey && e?.codeKey) {
        threadLastCodeKey.set(e.actualThreadKey, e.codeKey);
      }
    }
    syncThreadMarkers(cy, threadLastCodeKey, (threadName) => colorForThread(threadName, threadColorsRef.current));

    let alive = true;
    panelTokenRef.current += 1;
    const token = panelTokenRef.current;

    (async () => {
      const codeMeta = model.codeNodes.find((n) => n.id === activeEvent.codeKey);
      const resources = (activeEvent.resourceKeys || []).map((k) => k.replace(/^res:/, '')).join(', ') || 'none';
      const snippet = await resolveSnippet(codeMeta, activeEvent, snippetCacheRef.current);
      if (!alive || token !== panelTokenRef.current) {
        return;
      }
      setEventInfo({
        index: `${index + 1}/${total}`,
        timestamp: activeEvent.timestamp_us ?? '',
        thread: activeEvent.thread_name || 'unregistered',
        fn: activeEvent.function ?? '',
        node: activeEvent.node_id ?? '',
        label: codeMeta?.label || activeEvent.node_id || '',
        type: codeMeta?.type || '',
        location: `${activeEvent.file ?? ''}:${activeEvent.line ?? ''}`,
        resources,
        snippet
      });
    })();

    return () => {
      alive = false;
    };
  }, [activeEvent, index, model, total]);

  useEffect(() => {
    if (!isPlaying) {
      return;
    }
    if (total === 0 || index >= total - 1) {
      setIsPlaying(false);
      return;
    }

    const timer = window.setTimeout(() => {
      handleNext();
    }, Math.max(40, 500 / Number(speed || 1)));

    return () => window.clearTimeout(timer);
  }, [isPlaying, index, total, speed, autoThreadJump]);

  const typeLegend = useMemo(() => {
    return [...new Set(model.codeNodes.map((n) => n.type || 'default'))];
  }, [model.codeNodes]);

  const threadLegend = useMemo(() => {
    return model.availableThreads.map((t) => ({
      name: t.threadName,
      color: colorForThread(t.threadName, threadColorsRef.current)
    }));
  }, [model.availableThreads]);

  function loadSelectedScenario(key) {
    setSelectedScenario(key);
    const selected = scenarioOptions.find((s) => s.key === key);
    if (!selected) {
      setStatusText(`Scenario not found: ${key}`);
      return;
    }
    setRawNodes(selected.nodes || []);
    setRawTrace(selected.trace || []);
  }

  async function onLoadFiles() {
    try {
      const data = await loadDataFromFiles(nodesFile, traceFile);
      setRawNodes(data.nodes || []);
      setRawTrace(data.trace || []);
      setStatusText('Učitani lokalni fajlovi.');
    } catch (error) {
      setStatusText(error.message || 'Neuspešno učitavanje fajlova.');
    }
  }

  function boundedIndex(target) {
    if (total === 0) {
      return -1;
    }
    return Math.max(-1, Math.min(target, total - 1));
  }

  function findNextIndex(curr) {
    if (total === 0) {
      return -1;
    }
    if (curr >= total - 1) {
      return total - 1;
    }
    if (autoThreadJump && curr >= 0) {
      const thread = model.events[curr]?.thread_name || 'unregistered';
      let i = curr + 1;
      while (i < total && (model.events[i].thread_name || 'unregistered') !== thread) {
        i += 1;
      }
      return i < total ? i : total - 1;
    }
    return curr + 1;
  }

  function handleRestart() {
    setIsPlaying(false);
    setIndex(-1);
  }

  function handlePrev() {
    setIsPlaying(false);
    if (total === 0) {
      setIndex(-1);
      return;
    }
    setIndex((curr) => (curr > 0 ? curr - 1 : -1));
  }

  function handleNext() {
    if (total === 0) {
      setIndex(-1);
      return;
    }
    setIndex((curr) => findNextIndex(curr));
  }

  function handlePlay() {
    if (total === 0) {
      return;
    }
    setIsPlaying(true);
  }

  function handlePause() {
    setIsPlaying(false);
  }

  const timelineValue = index + 1;

  return (
    <div id="app">
      <header className="topbar">
        <h1>Concurrent Trace Viewer</h1>
        <div className="file-loaders">
          <label htmlFor="scenarioSelect">Scenario</label>
          <select
            id="scenarioSelect"
            value={selectedScenario}
            onChange={(e) => loadSelectedScenario(e.target.value)}
          >
            {scenarioOptions.length === 0 ? <option value="">Loading...</option> : null}
            {scenarioOptions.map((s) => (
              <option key={s.key} value={s.key}>{s.name}</option>
            ))}
          </select>
          <label>
            nodes.json{' '}
            <input type="file" accept=".json,application/json" onChange={(e) => setNodesFile(e.target.files?.[0] || null)} />
          </label>
          <label>
            trace.jsonl{' '}
            <input type="file" accept=".jsonl,.txt,application/json" onChange={(e) => setTraceFile(e.target.files?.[0] || null)} />
          </label>
          <button onClick={onLoadFiles}>Load Files</button>
        </div>
      </header>

      <main className="layout">
        <section className="graph-wrap">
          <div id="cy" ref={cyContainerRef}></div>
        </section>

        <aside className="sidepanel">
          <section className="controls">
            <h2>Replay</h2>
            <div className="buttons">
              <button onClick={handleRestart}>Restart</button>
              <button onClick={handlePrev}>Prev</button>
              <button onClick={handlePlay}>Play</button>
              <button onClick={handlePause}>Pause</button>
              <button onClick={handleNext}>Next</button>
            </div>

            <label htmlFor="speedSelect">Speed</label>
            <select id="speedSelect" value={String(speed)} onChange={(e) => setSpeed(Number(e.target.value) || 1)}>
              <option value="0.5">0.5x</option>
              <option value="1">1x</option>
              <option value="2">2x</option>
              <option value="4">4x</option>
            </select>

            <label htmlFor="viewMode">View mode</label>
            <select id="viewMode" value={viewMode} onChange={(e) => setViewMode(e.target.value)}>
              <option value="simple">Simple (Compressed)</option>
              <option value="detailed">Detailed</option>
            </select>

            <label className="checkline">
              <input type="checkbox" checked={autoThreadJump} onChange={(e) => setAutoThreadJump(e.target.checked)} />
              Auto next same thread
            </label>

            <label className="checkline">
              <input type="checkbox" checked={showResourcesSimple} onChange={(e) => setShowResourcesSimple(e.target.checked)} />
              Show resources in simple mode
            </label>

            <label htmlFor="timelineRange">Timeline</label>
            <input
              id="timelineRange"
              type="range"
              min="0"
              max={String(total)}
              value={String(timelineValue)}
              step="1"
              onChange={(e) => {
                setIsPlaying(false);
                setIndex(boundedIndex(Number(e.target.value) - 1));
              }}
            />
            <div id="timelineLabel" className="muted">{timelineValue} / {total}</div>
          </section>

          <section className="event-panel">
            <h2>Current Event</h2>
            <div className="event-info">
              {eventInfo ? <EventInfoPanel data={eventInfo} /> : <div className="muted">{statusText}</div>}
            </div>
          </section>

          <section className="legend-panel">
            <h2>Node Type Legend</h2>
            <ul>
              {typeLegend.map((type) => (
                <li key={type}>
                  <span className="swatch" style={{ background: getTypeColor(type) }}></span>
                  <span>{type}</span>
                </li>
              ))}
            </ul>
            <h2>Thread Colors</h2>
            <ul>
              {threadLegend.map((thread) => (
                <li key={thread.name}>
                  <span className="swatch" style={{ background: thread.color }}></span>
                  <span>{thread.name}</span>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </main>
    </div>
  );
}

function EventInfoPanel({ data }) {
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

  return (
    <>
      {rows.map(([k, v]) => (
        <div className="event-row" key={k}>
          <div className="event-key">{k}</div>
          <div>{String(v || '')}</div>
        </div>
      ))}
      <pre className="event-code"><code dangerouslySetInnerHTML={{ __html: highlightC(data.snippet || 'snippet unavailable') }} /></pre>
    </>
  );
}

function colorForThread(threadName, colorMap) {
  const key = threadName || 'unregistered';
  if (!colorMap.has(key)) {
    colorMap.set(key, PALETTE[colorMap.size % PALETTE.length]);
  }
  return colorMap.get(key);
}

async function resolveSnippet(codeMeta, event, cache) {
  const fallback = codeMeta?.snippet || codeMeta?.label || event.node_id || 'snippet unavailable';
  const file = event.file || codeMeta?.file;
  const line = Number(event.line || codeMeta?.line || 0);

  if (!file || !line) {
    return fallback;
  }

  const key = `${file}:${line}`;
  if (cache.has(key)) {
    return cache.get(key);
  }

  const sourceLine = await fetchSourceLine(file, line);
  const snippet = sourceLine || fallback;
  cache.set(key, snippet);
  return snippet;
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
      // ignore
    }
  }

  return null;
}

function looksLikeHtml(text) {
  const head = String(text).slice(0, 240).toLowerCase();
  return head.includes('<!doctype html') || head.includes('<html') || head.includes('<body');
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
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
