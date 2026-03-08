import cytoscape from 'cytoscape';

const TYPE_COLORS = {
  sync: '#0f766e',
  action: '#2563eb',
  critical: '#dc2626',
  buffer: '#ca8a04',
  thread: '#7c3aed',
  checkpoint: '#0f766e',
  default: '#334155'
};

const EDGE_COLORS = {
  control_flow: '#64748b',
  function_flow: '#0f172a',
  thread_spawn: '#dc2626',
  waits_on: '#0284c7',
  posts: '#16a34a',
  locks: '#7c3aed',
  unlocks: '#a855f7',
  reads: '#0ea5e9',
  writes: '#f97316',
  state_access: '#14b8a6'
};

export function getTypeColor(type) {
  return TYPE_COLORS[type] || TYPE_COLORS.default;
}

function buildCardLabel(codeNode, shortFile, mode) {
  if (mode === 'simple') {
    return codeNode.label || codeNode.nodeId;
  }

  const fileLine = codeNode.file ? `${shortFile(codeNode.file)}:${codeNode.line || 0}` : 'unknown:0';
  const participants = codeNode.participants || [];
  const tokenLine = `threads: ${participants.slice(0, 3).join(', ')}${participants.length > 3 ? ` +${participants.length - 3}` : ''}`;

  return [
    codeNode.label || codeNode.nodeId,
    `fn: ${codeNode.functionName}`,
    tokenLine,
    codeNode.snippet || 'snippet unavailable',
    fileLine,
    `[${codeNode.type || 'checkpoint'}]`
  ].join('\n');
}

function computePositions(model) {
  const positions = {};
  const isSimple = model.mode === 'simple';
  const laneWidth = isSimple ? 560 : 420;
  const laneBaseX = 220;
  const laneTopY = 120;
  const functionGapY = isSimple ? 72 : 190;
  const codeGapY = isSimple ? 60 : 132;

  const functionsByThread = new Map();
  for (const thread of model.threads) {
    functionsByThread.set(thread.id, []);
  }
  for (const fn of model.functions) {
    if (!functionsByThread.has(fn.threadKey)) {
      functionsByThread.set(fn.threadKey, []);
    }
    functionsByThread.get(fn.threadKey).push(fn);
  }

  model.threads.forEach((thread, threadIndex) => {
    const laneX = laneBaseX + threadIndex * laneWidth;
    let cursorY = laneTopY;
    const functions = functionsByThread.get(thread.id) || [];

    for (const fn of functions) {
      const nodes = model.codeNodes.filter((n) => n.functionKey === fn.id);
      const fnHeight = isSimple
        ? Math.max(120, 70 + nodes.length * codeGapY)
        : Math.max(180, 100 + nodes.length * codeGapY);
      const fnCenterY = cursorY + fnHeight / 2;

      positions[fn.id] = { x: laneX, y: fnCenterY };

      nodes.forEach((node, idx) => {
        positions[node.id] = { x: laneX, y: cursorY + 86 + idx * codeGapY };
      });

      cursorY += fnHeight + functionGapY;
    }

    positions[thread.id] = { x: laneX, y: Math.max(300, cursorY / 2) };
  });

  const resourceX = laneBaseX + Math.max(1, model.threads.length) * laneWidth + 260;
  model.resources.forEach((res, idx) => {
    positions[res.id] = { x: resourceX, y: 140 + idx * (isSimple ? 92 : 110) };
  });

  return positions;
}

function animateOnLoad(cy, mode) {
  const all = cy.elements();
  const initialFocus = mode === 'simple'
    ? cy.elements('node[kind != "resource"], edge[kind = "control_flow"], edge[kind = "function_flow"], edge[kind = "thread_spawn"]')
    : cy.elements();
  const fitTarget = initialFocus.empty() ? cy.elements() : initialFocus;
  all.style('opacity', 0);
  all.style('text-opacity', 0);

  cy.animate({
    fit: {
      eles: fitTarget
    },
    duration: 300,
    easing: 'ease-out-cubic'
  });

  setTimeout(() => {
    all.animate({
      style: {
        opacity: 1,
        'text-opacity': 1
      },
      duration: 280,
      easing: 'ease-in-out-cubic'
    });
  }, 70);
}

export function buildGraph(cyContainer, model, options = {}) {
  const elements = [];
  const positions = computePositions(model);
  const isSimple = model.mode === 'simple';
  const showResources = !(isSimple && options.showResourcesInSimpleMode === false);

  for (const thread of model.threads) {
    elements.push({
      data: {
        id: thread.id,
        label: `Thread: ${thread.threadName}`,
        kind: 'thread'
      }
    });
  }

  for (const fn of model.functions) {
    elements.push({
      data: {
        id: fn.id,
        parent: fn.threadKey,
        label: `Function: ${fn.functionName}`,
        kind: 'function'
      }
    });
  }

  for (const codeNode of model.codeNodes) {
    elements.push({
      data: {
        id: codeNode.id,
        parent: codeNode.functionKey,
        kind: 'code',
        type: codeNode.type || 'checkpoint',
        thread: codeNode.threadName,
        functionName: codeNode.functionName,
        nodeId: codeNode.nodeId,
        cardLabel: buildCardLabel(codeNode, model.shortFile, model.mode)
      }
    });
  }

  if (showResources) {
    for (const res of model.resources) {
      elements.push({
        data: {
          id: res.id,
          kind: 'resource',
          label: res.label
        }
      });
    }
  }

  model.availableThreads.forEach((thread, idx) => {
    const markerId = `marker:${thread.id}`;
    const threadPos = positions[thread.id] || { x: 80, y: 80 };
    positions[markerId] = {
      x: threadPos.x + 18 + ((idx % 4) * 8),
      y: threadPos.y - 14
    };
    elements.push({
      data: {
        id: markerId,
        kind: 'thread-marker',
        threadKey: thread.id,
        threadName: thread.threadName,
        markerColor: '#64748b',
        offsetIndex: idx
      }
    });
  });

  for (const edge of model.edges) {
    if (!showResources && String(edge.target || '').startsWith('res:')) {
      continue;
    }
    elements.push({
      data: {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        kind: edge.kind,
        label: edge.label
      },
      classes: edge.kind
    });
  }

  const cy = cytoscape({
    container: cyContainer,
    elements,
    style: [
      {
        selector: 'node[kind="thread"]',
        style: {
          shape: 'round-rectangle',
          'background-color': '#e2e8f0',
          'border-color': '#94a3b8',
          'border-width': 2,
          label: 'data(label)',
          color: '#0f172a',
          'font-size': 13,
          'text-valign': 'top',
          'text-halign': 'center',
          'text-margin-y': -12,
          'padding-top': 34,
          'padding-bottom': 24,
          'padding-left': 24,
          'padding-right': 24
        }
      },
      {
        selector: 'node[kind="function"]',
        style: {
          shape: 'round-rectangle',
          'background-color': '#f8fafc',
          'border-color': '#94a3b8',
          'border-style': 'dashed',
          'border-width': 1,
          label: 'data(label)',
          color: '#1e293b',
          'font-size': 11,
          'text-valign': 'top',
          'text-halign': 'center',
          'text-margin-x': 0,
          'text-margin-y': -12,
          'padding-top': 26,
          'padding-bottom': 16,
          'padding-left': 14,
          'padding-right': 14
        }
      },
      {
        selector: 'node[kind="code"]',
        style: {
          shape: 'round-rectangle',
          width: isSimple ? 224 : 240,
          height: isSimple ? 56 : 126,
          'background-color': '#ffffff',
          'border-width': 2,
          'border-color': (ele) => getTypeColor(ele.data('type')),
          label: 'data(cardLabel)',
          'font-size': isSimple ? 10 : 8.5,
          color: '#0f172a',
          'text-wrap': 'wrap',
          'text-max-width': isSimple ? 196 : 216,
          'text-valign': 'center',
          'text-halign': 'center',
          'text-justification': isSimple ? 'center' : 'left'
        }
      },
      {
        selector: 'node[kind="resource"]',
        style: {
          shape: 'hexagon',
          width: 92,
          height: 72,
          'background-color': '#fde68a',
          'border-width': 2,
          'border-color': '#b45309',
          label: 'data(label)',
          'font-size': 11,
          color: '#78350f',
          'text-wrap': 'wrap',
          'text-max-width': 80
        }
      },
      {
        selector: 'node[kind="code"][type="critical"]',
        style: {
          'background-color': '#fee2e2',
          'border-width': 2,
          'border-color': '#334155'
        }
      },
      {
        selector: 'node[kind="thread-marker"]',
        style: {
          shape: 'ellipse',
          width: 12,
          height: 12,
          'background-color': 'data(markerColor)',
          'border-width': 1.5,
          'border-color': '#0f172a',
          opacity: 0,
          events: 'no',
          'z-compound-depth': 'top'
        }
      },
      {
        selector: 'edge',
        style: {
          width: 2,
          'line-color': '#94a3b8',
          'target-arrow-color': '#94a3b8',
          'target-arrow-shape': 'triangle',
          'curve-style': 'bezier',
          label: 'data(label)',
          'font-size': isSimple ? 7 : 8,
          color: '#334155',
          'text-background-opacity': 1,
          'text-background-color': '#ffffff',
          'text-background-padding': 1
        }
      },
      {
        selector: 'edge[kind="control_flow"]',
        style: {
          'line-style': 'solid',
          'line-color': EDGE_COLORS.control_flow,
          'target-arrow-color': EDGE_COLORS.control_flow
        }
      },
      {
        selector: 'edge[kind="function_flow"]',
        style: {
          'line-style': 'solid',
          width: 3,
          'line-color': EDGE_COLORS.function_flow,
          'target-arrow-color': EDGE_COLORS.function_flow,
          'curve-style': 'unbundled-bezier',
          'control-point-distances': 80,
          'control-point-weights': 0.5
        }
      },
      {
        selector: 'edge[kind="thread_spawn"]',
        style: {
          'line-style': 'dotted',
          width: 3,
          'line-color': EDGE_COLORS.thread_spawn,
          'target-arrow-color': EDGE_COLORS.thread_spawn,
          'curve-style': 'bezier'
        }
      },
      ...Object.keys(EDGE_COLORS)
        .filter((k) => k !== 'control_flow' && k !== 'function_flow' && k !== 'thread_spawn')
        .map((k) => ({
          selector: `edge[kind="${k}"]`,
          style: {
            'line-style': 'dashed',
            'line-color': EDGE_COLORS[k],
            'target-arrow-color': EDGE_COLORS[k]
          }
        })),
      {
        selector: 'node.active-code',
        style: {
          'border-width': 5,
          'border-color': 'data(activeColor)',
          'overlay-opacity': 0.18,
          'overlay-color': 'data(activeColor)'
        }
      },
      {
        selector: 'node.active-thread',
        style: {
          'border-color': 'data(activeColor)',
          'border-width': 4,
          'background-color': '#dbeafe'
        }
      },
      {
        selector: 'node.active-resource',
        style: {
          'border-color': 'data(activeColor)',
          'border-width': 4,
          'overlay-opacity': 0.15,
          'overlay-color': 'data(activeColor)'
        }
      },
      {
        selector: 'edge.active-step',
        style: {
          width: 4,
          'line-color': 'data(activeColor)',
          'target-arrow-color': 'data(activeColor)'
        }
      }
    ],
    layout: {
      name: 'preset',
      positions,
      fit: true,
      padding: 40
    }
  });

  animateOnLoad(cy, model.mode);
  return cy;
}

export function resetThreadMarkers(cy) {
  const markers = cy.nodes('[kind = "thread-marker"]');
  markers.style('opacity', 0);
}

export function syncThreadMarkers(cy, threadLastCodeKey, colorForThread) {
  const markers = cy.nodes('[kind = "thread-marker"]');
  markers.forEach((marker) => {
    const threadKey = marker.data('threadKey');
    const codeKey = threadLastCodeKey.get(threadKey);
    if (!codeKey) {
      marker.style('opacity', 0);
      return;
    }

    const codeNode = cy.getElementById(codeKey);
    if (codeNode.empty()) {
      marker.style('opacity', 0);
      return;
    }

    const pos = codeNode.position();
    const halfW = codeNode.outerWidth() / 2;
    const halfH = codeNode.outerHeight() / 2;
    const idx = Number(marker.data('offsetIndex') || 0);
    const col = idx % 3;
    const row = Math.floor(idx / 3);

    marker.position({
      // Keep marker in the top-right corner region of the node.
      x: pos.x + halfW - 7 - (col * 10),
      y: pos.y - halfH + 7 + (row * 10)
    });
    marker.data('markerColor', colorForThread(marker.data('threadName')));
    marker.style('opacity', 0.92);
  });
}

export function clearActive(cy) {
  cy.nodes().removeClass('active-code active-thread active-resource');
  cy.edges().removeClass('active-step');
}

export function setActiveEvent(cy, event, previousEvent, color) {
  clearActive(cy);
  if (!event) {
    return;
  }

  const codeNode = cy.getElementById(event.codeKey);
  if (!codeNode.empty()) {
    codeNode.data('activeColor', color);
    codeNode.addClass('active-code');
  }

  const threadNode = cy.getElementById(event.threadKey);
  if (!threadNode.empty()) {
    threadNode.data('activeColor', color);
    threadNode.addClass('active-thread');
  }

  if (event.spawnThreadKey) {
    const spawnedThread = cy.getElementById(event.spawnThreadKey);
    if (!spawnedThread.empty()) {
      spawnedThread.data('activeColor', color);
      spawnedThread.addClass('active-thread');
    }
  }

  for (const resourceKey of event.resourceKeys || []) {
    const resourceNode = cy.getElementById(resourceKey);
    if (!resourceNode.empty()) {
      resourceNode.data('activeColor', color);
      resourceNode.addClass('active-resource');
    }
  }

  if (previousEvent && previousEvent.codeKey !== event.codeKey) {
    const edge = cy.edges().filter((e) => e.data('source') === previousEvent.codeKey && e.data('target') === event.codeKey);
    if (!edge.empty()) {
      edge.data('activeColor', color);
      edge.addClass('active-step');
    }
  }

  // Intentionally no auto-pan/center on active node to avoid replay jitter.
}
