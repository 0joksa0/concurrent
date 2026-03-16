import React, { useEffect, useMemo, useRef, useState } from 'react';
import cytoscape from 'cytoscape';
import '../features/theory/theory.css';

const GROUP_COLORS = {
  osnove: '#0ea5e9',
  opasnosti: '#ef4444',
  sinhronizacija: '#10b981',
  obrasci: '#f59e0b',
  rasporedjivanje: '#8b5cf6',
  arhitektura: '#14b8a6',
  sistemi: '#06b6d4',
  default: '#64748b'
};

const EDGE_COLORS = {
  moze_dovesti_do: '#ef4444',
  sprecava: '#16a34a',
  zahteva: '#2563eb',
  omogucava: '#0d9488',
  primena_u_kontekstu: '#334155',
  kompromis_izmedju: '#ca8a04',
  razlikuje_se_od: '#7c3aed',
  pripada_kategoriji: '#0284c7',
  prosiruje_kontekst: '#0f766e',
  utice_na: '#b45309',
  nastavak_teme: '#0f172a',
  default: '#64748b'
};

const NODE_TEMPLATES = [
  { key: 'osnove', label: 'Osnovni pojam', group: 'osnove' },
  { key: 'opasnosti', label: 'Opasnost', group: 'opasnosti' },
  { key: 'sinhronizacija', label: 'Sinhronizacija', group: 'sinhronizacija' },
  { key: 'obrasci', label: 'Obrazac', group: 'obrasci' }
];

const EMPTY_NODE_DRAFT = {
  id: '',
  label: '',
  group: 'osnove',
  summary: '',
  explanation: '',
  pitfalls: '',
  scenarios: '',
  drilldown_map: '',
  drilldown_label: ''
};

const EMPTY_EDGE_DRAFT = {
  source: '',
  target: '',
  relation: 'primena_u_kontekstu',
  relation_label: '',
  explanation: ''
};

function nextNodeId() {
  return `n_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

export function TheoryPage() {
  const mapWrapRef = useRef(null);
  const cyContainerRef = useRef(null);
  const cyRef = useRef(null);
  const lastTapRef = useRef({ ts: 0, nodeId: '' });
  const importInputRef = useRef(null);

  const [maps, setMaps] = useState([]);
  const [selectedKey, setSelectedKey] = useState('');
  const [statusText, setStatusText] = useState('Učitavanje mapa...');
  const [details, setDetails] = useState({ type: 'text', message: 'Klikni čvor da vidiš detalje pojma.' });
  const [editorTab, setEditorTab] = useState('node');
  const [nodeDraft, setNodeDraft] = useState(EMPTY_NODE_DRAFT);
  const [edgeDraft, setEdgeDraft] = useState(EMPTY_EDGE_DRAFT);
  const [connectorHandle, setConnectorHandle] = useState({ nodeId: '', x: 0, y: 0, visible: false });
  const [connectDrag, setConnectDrag] = useState({ active: false, sourceId: '', x1: 0, y1: 0, x2: 0, y2: 0 });
  const connectorHandleRef = useRef({ nodeId: '', x: 0, y: 0, visible: false });
  const connectDragRef = useRef({ active: false, sourceId: '', x1: 0, y1: 0, x2: 0, y2: 0 });
  const relationRef = useRef('primena_u_kontekstu');

  const selectedMap = useMemo(() => maps.find((m) => m.key === selectedKey) || null, [maps, selectedKey]);

  useEffect(() => {
    connectorHandleRef.current = connectorHandle;
  }, [connectorHandle]);

  useEffect(() => {
    connectDragRef.current = connectDrag;
  }, [connectDrag]);

  useEffect(() => {
    relationRef.current = String(edgeDraft.relation || 'primena_u_kontekstu').trim() || 'primena_u_kontekstu';
  }, [edgeDraft.relation]);

  useEffect(() => {
    let alive = true;

    async function loadMaps() {
      try {
        const manifestRes = await fetch(withBase('theory/index.json'));
        if (!manifestRes.ok) {
          throw new Error('Nije moguće učitati theory/index.json');
        }

        const manifest = await manifestRes.json();
        const list = Array.isArray(manifest) ? [...manifest] : [];
        list.sort((a, b) => Number(a.order || 0) - Number(b.order || 0));

        const loaded = [];
        for (const item of list) {
          const key = String(item?.key || '').trim();
          const name = String(item?.name || '').trim();
          const path = String(item?.path || '').trim();
          if (!key || !name || !path) {
            continue;
          }

          const res = await fetch(withBase(path));
          if (!res.ok) {
            continue;
          }
          const payload = await res.json();
          loaded.push({ key, name, ...payload });
        }

        if (!alive) {
          return;
        }

        setMaps(loaded);
        if (loaded.length > 0) {
          setSelectedKey(loaded[0].key);
          setStatusText('Mapa učitana.');
        } else {
          setStatusText('Nema validnih mapa u manifestu.');
        }
      } catch (error) {
        if (!alive) {
          return;
        }
        setStatusText(error.message || 'Neuspešno učitavanje mapa.');
      }
    }

    loadMaps();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const map = selectedMap;
    if (!cyContainerRef.current || !map) {
      return;
    }

    if (cyRef.current) {
      cyRef.current.destroy();
      cyRef.current = null;
    }

    const elements = buildElements(map.nodes || [], map.edges || []);
    const mapNodes = map.nodes || [];
    const positionsById = new Map();
    for (const node of mapNodes) {
      if (node?.position && Number.isFinite(node.position.x) && Number.isFinite(node.position.y)) {
        positionsById.set(node.id, { x: Number(node.position.x), y: Number(node.position.y) });
      }
    }
    const allHavePositions = mapNodes.length > 0 && mapNodes.every((node) => positionsById.has(node.id));

    const cy = cytoscape({
      container: cyContainerRef.current,
      elements,
      layout: allHavePositions ? {
        name: 'preset',
        fit: true,
        padding: 24,
        positions: (node) => positionsById.get(node.id())
      } : {
        name: 'cose',
        animate: true,
        idealEdgeLength: 132,
        nodeRepulsion: 9500,
        gravity: 0.24,
        randomize: false,
        padding: 24
      },
      style: [
        {
          selector: 'node',
          style: {
            shape: 'round-rectangle',
            width: 188,
            height: 64,
            'background-color': (ele) => colorForGroup(ele.data('group')),
            'border-color': '#0f172a',
            'border-width': 1.4,
            label: 'data(label)',
            'font-size': 10,
            color: '#0f172a',
            'text-wrap': 'wrap',
            'text-max-width': 170,
            'text-valign': 'center',
            'text-halign': 'center',
            'overlay-opacity': 0
          }
        },
        {
          selector: 'edge',
          style: {
            width: 2,
            'line-color': (ele) => colorForEdge(ele.data('relation')),
            'target-arrow-color': (ele) => colorForEdge(ele.data('relation')),
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            label: 'data(relationLabel)',
            'font-size': 8,
            color: '#334155',
            'text-background-opacity': 1,
            'text-background-color': '#ffffff',
            'text-background-padding': 1
          }
        },
        {
          selector: 'node:selected',
          style: {
            'border-width': 4,
            'border-color': '#111827',
            'overlay-color': '#334155',
            'overlay-opacity': 0.12
          }
        }
      ]
    });

    function updateConnectorForNode(nodeId) {
      if (!nodeId) {
        setConnectorHandle({ nodeId: '', x: 0, y: 0, visible: false });
        return;
      }
      const node = cy.getElementById(nodeId);
      if (!node || node.empty()) {
        setConnectorHandle({ nodeId: '', x: 0, y: 0, visible: false });
        return;
      }
      if (!cyContainerRef.current) {
        setConnectorHandle({ nodeId: '', x: 0, y: 0, visible: false });
        return;
      }
      const p = node.renderedPosition();
      const halfW = node.renderedOuterWidth() / 2;
      const x = p.x + halfW + 10;
      const y = p.y;
      setConnectorHandle({ nodeId, x, y, visible: true });
    }

    function findNodeAtRenderedPoint(renderedX, renderedY) {
      const nodes = cy.nodes();
      for (let i = 0; i < nodes.length; i += 1) {
        const n = nodes[i];
        const bb = n.renderedBoundingBox();
        if (renderedX >= bb.x1 && renderedX <= bb.x2 && renderedY >= bb.y1 && renderedY <= bb.y2) {
          return n;
        }
      }
      return null;
    }

    cy.on('tap', 'node', (event) => {
      const data = event.target.data();
      const now = Date.now();
      const isDouble = data.id === lastTapRef.current.nodeId && (now - lastTapRef.current.ts) <= 320;

      setDetails({ type: 'node', node: data });
      setEditorTab('node');
      updateConnectorForNode(data.id);

      const realNode = (map.nodes || []).find((n) => n.id === data.id);
      if (realNode) {
        setNodeDraft(nodeToDraft(realNode));
      }

      if (isDouble && data.drilldownMap) {
        const target = maps.find((m) => m.key === data.drilldownMap);
        if (target) {
          setSelectedKey(target.key);
          return;
        }
      }

      lastTapRef.current = { ts: now, nodeId: data.id };
    });

    cy.on('tap', 'edge', (event) => {
      const edgeData = event.target.data();
      setDetails({
        type: 'edge',
        edge: edgeData,
        sourceLabel: cy.getElementById(edgeData.source)?.data('label') || edgeData.source,
        targetLabel: cy.getElementById(edgeData.target)?.data('label') || edgeData.target
      });
      setEditorTab('edge');
      setEdgeDraft({
        source: edgeData.source || '',
        target: edgeData.target || '',
        relation: edgeData.relation || 'primena_u_kontekstu',
        relation_label: edgeData.relationLabel || '',
        explanation: edgeData.explanation || ''
      });
      setConnectorHandle({ nodeId: '', x: 0, y: 0, visible: false });
    });

    cy.on('dragfree', 'node', (event) => {
      const node = event.target;
      const pos = node.position();
      const id = node.id();
      updateSelectedMap((nextMap) => {
        const idx = nextMap.nodes.findIndex((n) => n.id === id);
        if (idx >= 0) {
          nextMap.nodes[idx] = {
            ...nextMap.nodes[idx],
            position: {
              x: Number(pos.x.toFixed(2)),
              y: Number(pos.y.toFixed(2))
            }
          };
        }
        return nextMap;
      });
      if (connectorHandleRef.current.nodeId === id) {
        updateConnectorForNode(id);
      }
    });

    // Keep connector visually attached while node is being dragged.
    cy.on('position', 'node', (event) => {
      const id = event.target.id();
      if (connectorHandleRef.current.nodeId === id) {
        updateConnectorForNode(id);
      }
    });

    cy.on('pan zoom', () => {
      if (connectorHandleRef.current.nodeId) {
        updateConnectorForNode(connectorHandleRef.current.nodeId);
      }
    });

    function onGlobalMouseMove(ev) {
      if (!connectDragRef.current.active || !cyContainerRef.current) {
        return;
      }
      const rect = cyContainerRef.current.getBoundingClientRect();
      const x = ev.clientX - rect.left;
      const y = ev.clientY - rect.top;
      connectDragRef.current = {
        ...connectDragRef.current,
        x2: x,
        y2: y
      };
      setConnectDrag((curr) => ({
        ...curr,
        x2: x,
        y2: y
      }));
    }

    function onGlobalMouseUp(ev) {
      if (!connectDragRef.current.active || !cyContainerRef.current) {
        return;
      }
      const cyRect = cyContainerRef.current.getBoundingClientRect();
      const renderedX = ev.clientX - cyRect.left;
      const renderedY = ev.clientY - cyRect.top;
      const sourceId = connectDragRef.current.sourceId;
      const targetNode = findNodeAtRenderedPoint(renderedX, renderedY);
      const relation = relationRef.current;

      if (targetNode && sourceId && targetNode.id() !== sourceId) {
        updateSelectedMap((nextMap) => {
          const exists = nextMap.edges.some((e) => e.source === sourceId && e.target === targetNode.id() && String(e.relation || '') === relation);
          if (!exists) {
            nextMap.edges.push({
              source: sourceId,
              target: targetNode.id(),
              relation,
              relation_label: '',
              explanation: ''
            });
          }
          return nextMap;
        });

        setEdgeDraft({
          source: sourceId,
          target: targetNode.id(),
          relation,
          relation_label: '',
          explanation: ''
        });
        setEditorTab('edge');
        setStatusText(`Veza dodata prevlačenjem: ${sourceId} -> ${targetNode.id()}`);
      }

      connectDragRef.current = { active: false, sourceId: '', x1: 0, y1: 0, x2: 0, y2: 0 };
      setConnectDrag({ active: false, sourceId: '', x1: 0, y1: 0, x2: 0, y2: 0 });
    }

    window.addEventListener('mousemove', onGlobalMouseMove);
    window.addEventListener('mouseup', onGlobalMouseUp);

    cyRef.current = cy;

    const first = (map.nodes || [])[0];
    if (first) {
      setDetails({ type: 'node', node: first });
      const firstNode = cy.getElementById(first.id);
      if (!firstNode.empty()) {
        firstNode.select();
      }
    }

    return () => {
      window.removeEventListener('mousemove', onGlobalMouseMove);
      window.removeEventListener('mouseup', onGlobalMouseUp);
      cy.destroy();
      cyRef.current = null;
    };
  }, [selectedMap, maps]);

  const groupLegend = useMemo(() => {
    const set = new Set();
    for (const n of selectedMap?.nodes || []) {
      set.add(n.group || 'default');
    }
    return [...set];
  }, [selectedMap]);

  function updateSelectedMap(updater) {
    if (!selectedKey) {
      return;
    }

    setMaps((curr) => curr.map((map) => {
      if (map.key !== selectedKey) {
        return map;
      }
      const safeMap = {
        ...map,
        nodes: Array.isArray(map.nodes) ? [...map.nodes] : [],
        edges: Array.isArray(map.edges) ? [...map.edges] : []
      };
      return updater(safeMap);
    }));
  }

  function createNewMap() {
    const now = Date.now();
    const key = `custom_${now}`;
    const map = {
      key,
      name: `Nova mapa ${maps.length + 1}`,
      nodes: [],
      edges: []
    };

    setMaps((curr) => [...curr, map]);
    setSelectedKey(key);
    setNodeDraft(EMPTY_NODE_DRAFT);
    setEdgeDraft(EMPTY_EDGE_DRAFT);
    setConnectorHandle({ nodeId: '', x: 0, y: 0, visible: false });
    setStatusText('Kreirana nova prazna mapa.');
  }

  function addNodeFromTemplate(template, position) {
    const id = nextNodeId();
    const node = {
      id,
      label: template.label || id,
      group: template.group || 'osnove',
      summary: '',
      explanation: '',
      pitfalls: [],
      scenarios: [],
      drilldown_map: '',
      drilldown_label: '',
      position: {
        x: Number(position.x),
        y: Number(position.y)
      }
    };

    updateSelectedMap((map) => {
      map.nodes.push(node);
      return map;
    });

    setNodeDraft(nodeToDraft(node));
    setEditorTab('node');
    setStatusText(`Dodat čvor iz palete: ${node.id}`);
  }

  function handlePaletteDragStart(ev, template) {
    ev.dataTransfer.setData('application/x-theory-node-template', JSON.stringify(template));
    ev.dataTransfer.effectAllowed = 'copy';
  }

  function handleMapDragOver(ev) {
    if (ev.dataTransfer.types.includes('application/x-theory-node-template')) {
      ev.preventDefault();
      ev.dataTransfer.dropEffect = 'copy';
    }
  }

  function handleMapDrop(ev) {
    const raw = ev.dataTransfer.getData('application/x-theory-node-template');
    if (!raw) {
      return;
    }
    ev.preventDefault();
    if (!cyContainerRef.current) {
      return;
    }

    let template;
    try {
      template = JSON.parse(raw);
    } catch {
      return;
    }

    const rect = cyContainerRef.current.getBoundingClientRect();
    const x = ev.clientX - rect.left;
    const y = ev.clientY - rect.top;
    addNodeFromTemplate(template, { x, y });
  }

  function startConnectorDrag(ev) {
    if (!connectorHandle.visible || !connectorHandle.nodeId) {
      return;
    }
    if (!cyContainerRef.current) {
      return;
    }
    ev.preventDefault();
    ev.stopPropagation();
    const rect = cyContainerRef.current.getBoundingClientRect();
    const x = connectorHandle.x;
    const y = connectorHandle.y;
    const mx = ev.clientX - rect.left;
    const my = ev.clientY - rect.top;
    connectDragRef.current = {
      active: true,
      sourceId: connectorHandle.nodeId,
      x1: x,
      y1: y,
      x2: mx,
      y2: my
    };
    setConnectDrag({
      active: true,
      sourceId: connectorHandle.nodeId,
      x1: x,
      y1: y,
      x2: mx,
      y2: my
    });
  }

  const isCustomMap = Boolean(selectedMap?.key && String(selectedMap.key).startsWith('custom_'));

  function applyNodeDraft() {
    const id = String(nodeDraft.id || '').trim();
    const label = String(nodeDraft.label || '').trim();

    if (!id || !label) {
      setStatusText('Za čvor su obavezni ID i Label.');
      return;
    }

    const payload = {
      id,
      label,
      group: String(nodeDraft.group || 'default').trim() || 'default',
      summary: String(nodeDraft.summary || '').trim(),
      explanation: String(nodeDraft.explanation || '').trim(),
      pitfalls: splitCsv(nodeDraft.pitfalls),
      scenarios: splitCsv(nodeDraft.scenarios),
      drilldown_map: String(nodeDraft.drilldown_map || '').trim(),
      drilldown_label: String(nodeDraft.drilldown_label || '').trim()
    };

    updateSelectedMap((map) => {
      const idx = map.nodes.findIndex((n) => n.id === payload.id);
      if (idx >= 0) {
        map.nodes[idx] = {
          ...map.nodes[idx],
          ...payload
        };
      } else {
        map.nodes.push(payload);
      }
      return map;
    });

    setStatusText(`Čvor "${payload.id}" je sačuvan.`);
  }

  function deleteNodeByDraft() {
    const id = String(nodeDraft.id || '').trim();
    if (!id) {
      setStatusText('Unesi ID čvora za brisanje.');
      return;
    }

    updateSelectedMap((map) => {
      map.nodes = map.nodes.filter((n) => n.id !== id);
      map.edges = map.edges.filter((e) => e.source !== id && e.target !== id);
      return map;
    });

    setStatusText(`Čvor "${id}" i povezane veze su obrisani.`);
  }

  function applyEdgeDraft() {
    const source = String(edgeDraft.source || '').trim();
    const target = String(edgeDraft.target || '').trim();
    const relation = String(edgeDraft.relation || '').trim() || 'primena_u_kontekstu';

    if (!source || !target) {
      setStatusText('Za vezu su obavezni source i target.');
      return;
    }

    if (!selectedMap) {
      return;
    }

    const nodeIds = new Set((selectedMap.nodes || []).map((n) => n.id));
    if (!nodeIds.has(source) || !nodeIds.has(target)) {
      setStatusText('Source/target moraju biti postojeći ID čvorova.');
      return;
    }

    const payload = {
      source,
      target,
      relation,
      relation_label: String(edgeDraft.relation_label || '').trim(),
      explanation: String(edgeDraft.explanation || '').trim()
    };

    updateSelectedMap((map) => {
      const idx = map.edges.findIndex((e) => e.source === source && e.target === target && String(e.relation || '') === relation);
      if (idx >= 0) {
        map.edges[idx] = payload;
      } else {
        map.edges.push(payload);
      }
      return map;
    });

    setStatusText(`Veza ${source} -> ${target} je sačuvana.`);
  }

  function deleteEdgeByDraft() {
    const source = String(edgeDraft.source || '').trim();
    const target = String(edgeDraft.target || '').trim();
    const relation = String(edgeDraft.relation || '').trim() || 'primena_u_kontekstu';

    if (!source || !target) {
      setStatusText('Unesi source i target veze za brisanje.');
      return;
    }

    updateSelectedMap((map) => {
      map.edges = map.edges.filter((e) => !(e.source === source && e.target === target && String(e.relation || '') === relation));
      return map;
    });

    setStatusText(`Veza ${source} -> ${target} je obrisana.`);
  }

  function handleMapNameChange(nextName) {
    updateSelectedMap((map) => ({
      ...map,
      name: nextName
    }));
  }

  function exportPng() {
    if (!cyRef.current || !selectedMap) {
      return;
    }
    const dataUrl = cyRef.current.png({ full: true, scale: 2, bg: '#ffffff' });
    const safeName = selectedMap.key.replace(/[^a-zA-Z0-9._-]/g, '_');
    download(dataUrl, `${safeName}.png`);
  }

  function exportJson() {
    if (!selectedMap) {
      return;
    }
    const blob = new Blob([`${JSON.stringify(selectedMap, null, 2)}\n`], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const safeName = selectedMap.key.replace(/[^a-zA-Z0-9._-]/g, '_');
    download(url, `${safeName}.json`, true);
  }

  function triggerImportJson() {
    importInputRef.current?.click();
  }

  async function importJsonMap(file) {
    if (!file) {
      return;
    }

    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      const nodes = Array.isArray(payload?.nodes) ? payload.nodes : [];
      const edges = Array.isArray(payload?.edges) ? payload.edges : [];

      const key = String(payload?.key || `import_${Date.now()}`).trim() || `import_${Date.now()}`;
      const name = String(payload?.name || file.name.replace(/\.json$/i, '') || key).trim() || key;

      const importedMap = {
        key,
        name,
        nodes,
        edges
      };

      setMaps((curr) => {
        const exists = curr.some((m) => m.key === key);
        if (!exists) {
          return [...curr, importedMap];
        }
        return curr.map((m) => (m.key === key ? importedMap : m));
      });

      setSelectedKey(key);
      setStatusText(`Mapa "${name}" je uvezena (${nodes.length} čvorova, ${edges.length} veza).`);
    } catch (error) {
      setStatusText(error.message || 'Neuspešan import JSON mape.');
    }
  }

  return (
    <div id="theory-app">
      <header className="theory-topbar">
        <div>
          <h1>Mind Mape Teorije Konkurentnosti</h1>
          <p className="subtitle">Pojmovi, odnosi, tipične greške i veze sa scenarijima</p>
        </div>
        <div className="topbar-actions">
          <label htmlFor="mapSelect">Mapa</label>
          <select id="mapSelect" value={selectedKey} onChange={(e) => setSelectedKey(e.target.value)}>
            {maps.map((map) => (
              <option key={map.key} value={map.key}>{map.name}</option>
            ))}
          </select>
          <button type="button" onClick={createNewMap}>Nova mapa</button>
          <button type="button" onClick={triggerImportJson}>Import JSON</button>
          <button type="button" onClick={exportPng}>Export PNG</button>
          <button type="button" onClick={exportJson}>Export JSON</button>
          <input
            ref={importInputRef}
            className="hidden-input"
            type="file"
            accept=".json,application/json"
            onChange={(e) => importJsonMap(e.target.files?.[0] || null)}
          />
        </div>
      </header>

      <main className="theory-layout">
        <section
          className="map-wrap"
          ref={mapWrapRef}
          onDragOver={handleMapDragOver}
          onDrop={handleMapDrop}
        >
          {selectedMap && isCustomMap ? (
            <div className="node-palette">
              <h3>Paleta čvorova</h3>
              <p>Prevuci blok na platno.</p>
              {NODE_TEMPLATES.map((tpl) => (
                <div
                  key={tpl.key}
                  className="palette-item"
                  draggable
                  onDragStart={(e) => handlePaletteDragStart(e, tpl)}
                >
                  <span className="swatch" style={{ background: colorForGroup(tpl.group) }}></span>
                  <span>{tpl.label}</span>
                </div>
              ))}
            </div>
          ) : null}
          <div id="theory-cy" ref={cyContainerRef}></div>
          <div className="cy-overlay">
            {connectorHandle.visible ? (
              <button
                type="button"
                className="node-connect-handle"
                style={{ left: `${connectorHandle.x}px`, top: `${connectorHandle.y}px` }}
                onMouseDown={startConnectorDrag}
                title="Prevuci na drugi čvor za kreiranje veze"
              >
                ↗
              </button>
            ) : null}
            {connectDrag.active ? (
              <svg className="connect-line-layer">
                <line
                  x1={connectDrag.x1}
                  y1={connectDrag.y1}
                  x2={connectDrag.x2}
                  y2={connectDrag.y2}
                />
              </svg>
            ) : null}
          </div>
        </section>

        <aside className="details-panel">
          <section className="card">
            <h2>Detalji</h2>
            <div className="concept-details">
              {details.type === 'node' ? <NodeDetails node={details.node} /> : null}
              {details.type === 'edge' ? <EdgeDetails {...details} /> : null}
              {details.type === 'text' ? <div className="muted">{statusText}</div> : null}
            </div>
          </section>

          <section className="card editor-card">
            <h2>Editor Mape</h2>
            <div className="editor-tabs">
              <button type="button" className={editorTab === 'node' ? 'tab-btn active' : 'tab-btn'} onClick={() => setEditorTab('node')}>Čvor</button>
              <button type="button" className={editorTab === 'edge' ? 'tab-btn active' : 'tab-btn'} onClick={() => setEditorTab('edge')}>Veza</button>
            </div>

            {selectedMap ? (
              <div className="editor-block">
                <label>
                  Naziv mape
                  <input value={selectedMap.name || ''} onChange={(e) => handleMapNameChange(e.target.value)} />
                </label>
                <div className="map-key">Key: {selectedMap.key}</div>
              </div>
            ) : null}

            {editorTab === 'node' ? (
              <div className="editor-block">
                <label>
                  ID čvora
                  <input value={nodeDraft.id} onChange={(e) => setNodeDraft((curr) => ({ ...curr, id: e.target.value }))} />
                </label>
                <label>
                  Label
                  <input value={nodeDraft.label} onChange={(e) => setNodeDraft((curr) => ({ ...curr, label: e.target.value }))} />
                </label>
                <label>
                  Group
                  <input value={nodeDraft.group} onChange={(e) => setNodeDraft((curr) => ({ ...curr, group: e.target.value }))} />
                </label>
                <label>
                  Summary
                  <textarea rows="2" value={nodeDraft.summary} onChange={(e) => setNodeDraft((curr) => ({ ...curr, summary: e.target.value }))} />
                </label>
                <label>
                  Explanation
                  <textarea rows="3" value={nodeDraft.explanation} onChange={(e) => setNodeDraft((curr) => ({ ...curr, explanation: e.target.value }))} />
                </label>
                <label>
                  Pitfalls (comma-separated)
                  <input value={nodeDraft.pitfalls} onChange={(e) => setNodeDraft((curr) => ({ ...curr, pitfalls: e.target.value }))} />
                </label>
                <label>
                  Scenarios (comma-separated)
                  <input value={nodeDraft.scenarios} onChange={(e) => setNodeDraft((curr) => ({ ...curr, scenarios: e.target.value }))} />
                </label>
                <label>
                  Drilldown map key
                  <input value={nodeDraft.drilldown_map} onChange={(e) => setNodeDraft((curr) => ({ ...curr, drilldown_map: e.target.value }))} />
                </label>
                <label>
                  Drilldown label
                  <input value={nodeDraft.drilldown_label} onChange={(e) => setNodeDraft((curr) => ({ ...curr, drilldown_label: e.target.value }))} />
                </label>

                <div className="editor-actions">
                  <button type="button" onClick={applyNodeDraft}>Sačuvaj čvor</button>
                  <button type="button" onClick={() => setNodeDraft(EMPTY_NODE_DRAFT)}>Novi čvor</button>
                  <button type="button" className="danger" onClick={deleteNodeByDraft}>Obriši čvor</button>
                </div>
              </div>
            ) : null}

            {editorTab === 'edge' ? (
              <div className="editor-block">
                <label>
                  Source node id
                  <input value={edgeDraft.source} onChange={(e) => setEdgeDraft((curr) => ({ ...curr, source: e.target.value }))} />
                </label>
                <label>
                  Target node id
                  <input value={edgeDraft.target} onChange={(e) => setEdgeDraft((curr) => ({ ...curr, target: e.target.value }))} />
                </label>
                <label>
                  Relation key
                  <input value={edgeDraft.relation} onChange={(e) => setEdgeDraft((curr) => ({ ...curr, relation: e.target.value }))} />
                </label>
                <label>
                  Relation label
                  <input value={edgeDraft.relation_label} onChange={(e) => setEdgeDraft((curr) => ({ ...curr, relation_label: e.target.value }))} />
                </label>
                <label>
                  Explanation
                  <textarea rows="3" value={edgeDraft.explanation} onChange={(e) => setEdgeDraft((curr) => ({ ...curr, explanation: e.target.value }))} />
                </label>

                <div className="editor-actions">
                  <button type="button" onClick={applyEdgeDraft}>Sačuvaj vezu</button>
                  <button type="button" onClick={() => setEdgeDraft(EMPTY_EDGE_DRAFT)}>Nova veza</button>
                  <button type="button" className="danger" onClick={deleteEdgeByDraft}>Obriši vezu</button>
                </div>
              </div>
            ) : null}

            <div className="muted">{statusText}</div>
          </section>

          <section className="card">
            <h2>Legenda</h2>
            <ul className="legend-list">
              {groupLegend.map((group) => (
                <li key={group}>
                  <span className="swatch" style={{ background: colorForGroup(group) }}></span>
                  <span>{group}</span>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </main>
    </div>
  );
}

function NodeDetails({ node }) {
  if (!node) {
    return <div className="muted">Nema izabranog čvora.</div>;
  }

  const rows = [
    ['Pojam', node.label || ''],
    ['Grupa', node.group || ''],
    ['Sažetak', node.summary || ''],
    ['Detaljno objašnjenje', node.explanation || ''],
    ['Tipične greške', node.pitfalls || 'nema unetih grešaka']
  ];

  if (node.scenarios) {
    rows.push(['Povezani scenariji', node.scenarios]);
  }
  if (node.drilldownMap) {
    rows.push(['Detaljnija mapa', `${node.drilldownLabel || node.drilldownMap} (dupli klik na čvor)`]);
  }

  return rows.map(([k, v]) => (
    <div className="detail-row" key={k}>
      <div className="detail-key">{k}</div>
      <div className="detail-value">{String(v || '')}</div>
    </div>
  ));
}

function EdgeDetails({ edge, sourceLabel, targetLabel }) {
  if (!edge) {
    return null;
  }

  const relationText = edge.relationLabel || prettyRelationLabel(edge.relation);
  const explanation = edge.explanation || `Veza znači: "${sourceLabel}" -> "${targetLabel}" (${relationText}).`;

  const rows = [
    ['Veza', `${sourceLabel} -> ${targetLabel}`],
    ['Tip veze', relationText],
    ['Objašnjenje veze', explanation]
  ];

  return rows.map(([k, v]) => (
    <div className="detail-row" key={k}>
      <div className="detail-key">{k}</div>
      <div className="detail-value">{String(v || '')}</div>
    </div>
  ));
}

function buildElements(nodes, edges) {
  const items = [];

  for (const node of nodes || []) {
    items.push({
      data: {
        id: node.id,
        label: node.label,
        group: node.group,
        summary: node.summary || '',
        explanation: node.explanation || '',
        pitfalls: (node.pitfalls || []).join(', '),
        scenarios: (node.scenarios || []).join(', '),
        drilldownMap: node.drilldown_map || '',
        drilldownLabel: node.drilldown_label || ''
      }
    });
  }

  for (let i = 0; i < (edges || []).length; i += 1) {
    const edge = edges[i];
    const relation = edge.relation || 'primena_u_kontekstu';
    items.push({
      data: {
        id: `e:${i}:${edge.source}:${edge.target}`,
        source: edge.source,
        target: edge.target,
        relation,
        relationLabel: edge.relation_label || prettyRelationLabel(relation),
        explanation: edge.explanation || ''
      }
    });
  }

  return items;
}

function splitCsv(text) {
  return String(text || '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

function nodeToDraft(node) {
  return {
    id: String(node.id || ''),
    label: String(node.label || ''),
    group: String(node.group || 'default'),
    summary: String(node.summary || ''),
    explanation: String(node.explanation || ''),
    pitfalls: (node.pitfalls || []).join(', '),
    scenarios: (node.scenarios || []).join(', '),
    drilldown_map: String(node.drilldown_map || ''),
    drilldown_label: String(node.drilldown_label || '')
  };
}

function colorForGroup(group) {
  return GROUP_COLORS[group] || GROUP_COLORS.default;
}

function colorForEdge(relation) {
  return EDGE_COLORS[relation] || EDGE_COLORS.default;
}

function prettyRelationLabel(relation) {
  return String(relation || 'primena_u_kontekstu').replaceAll('_', ' ');
}

function withBase(path) {
  const base = String(import.meta.env.BASE_URL || '/');
  const cleanBase = base.endsWith('/') ? base : `${base}/`;
  const cleanPath = String(path || '').replace(/^\/+/, '');
  return `${cleanBase}${cleanPath}`;
}

function download(url, fileName, revokeObjectUrl = false) {
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  if (revokeObjectUrl) {
    URL.revokeObjectURL(url);
  }
}
