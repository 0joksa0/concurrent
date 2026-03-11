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

export function TheoryPage() {
  const cyContainerRef = useRef(null);
  const cyRef = useRef(null);
  const lastTapRef = useRef({ ts: 0, nodeId: '' });

  const [maps, setMaps] = useState([]);
  const [selectedKey, setSelectedKey] = useState('');
  const [statusText, setStatusText] = useState('Učitavanje mapa...');
  const [details, setDetails] = useState({ type: 'text', message: 'Klikni čvor da vidiš detalje pojma.' });

  const selectedMap = useMemo(() => maps.find((m) => m.key === selectedKey) || null, [maps, selectedKey]);

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

    const cy = cytoscape({
      container: cyContainerRef.current,
      elements,
      layout: {
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

    cy.on('tap', 'node', (event) => {
      const data = event.target.data();
      const now = Date.now();
      const isDouble = data.id === lastTapRef.current.nodeId && (now - lastTapRef.current.ts) <= 320;

      setDetails({ type: 'node', node: data });

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
      setDetails({
        type: 'edge',
        edge: event.target.data(),
        sourceLabel: cy.getElementById(event.target.data('source'))?.data('label') || event.target.data('source'),
        targetLabel: cy.getElementById(event.target.data('target'))?.data('label') || event.target.data('target')
      });
    });

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
          <button type="button" onClick={exportPng}>Export PNG</button>
          <button type="button" onClick={exportJson}>Export JSON</button>
        </div>
      </header>

      <main className="theory-layout">
        <section className="map-wrap">
          <div id="theory-cy" ref={cyContainerRef}></div>
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
