function normalizeText(value) {
  return String(value || '').trim();
}

function shortFile(path) {
  const text = normalizeText(path);
  if (!text) {
    return '';
  }

  const parts = text.split('/');
  return parts.slice(-2).join('/');
}

function toSnippet(seed) {
  const text = normalizeText(seed);
  if (!text) {
    return 'snippet unavailable';
  }
  return text.length > 72 ? `${text.slice(0, 69)}...` : text;
}

function inferCodeLine(event, nodeDef) {
  const combined = [
    event.node_id,
    nodeDef?.label,
    nodeDef?.id
  ].filter(Boolean).join(' ').toLowerCase();

  const semMatch = combined.match(/\b(sem[a-z0-9_]*)\b/i);
  const semName = semMatch?.[1] || 'sem';

  if (combined.includes('create') && combined.includes('threada')) {
    return 'pthread_create(&tA, NULL, threadA, &data);';
  }
  if (combined.includes('create') && combined.includes('threadb')) {
    return 'pthread_create(&tB, NULL, threadB, &data);';
  }
  if (combined.includes('join')) {
    return 'pthread_join(tA, NULL); pthread_join(tB, NULL);';
  }
  if (combined.includes('wait')) {
    return `sem_wait(&${semName});`;
  }
  if (combined.includes('post')) {
    return `sem_post(&${semName});`;
  }
  if (combined.includes('lock') && combined.includes('mutex')) {
    return 'pthread_mutex_lock(&mutex);';
  }
  if ((combined.includes('unlock') || combined.includes('release')) && combined.includes('mutex')) {
    return 'pthread_mutex_unlock(&mutex);';
  }

  return toSnippet(nodeDef?.label || nodeDef?.id || event.node_id);
}

function inferResourceAccess(event, nodeDef) {
  const combined = [
    event.node_id,
    nodeDef?.label,
    nodeDef?.id,
    event.function,
    event.file
  ].filter(Boolean).join(' ').toLowerCase();

  const accesses = [];

  const semMatch = combined.match(/\b(sem[a-z0-9_]*)\b/i);
  const mutexMatch = combined.match(/\bmutex\b/i);
  const counterMatch = combined.match(/\bcount(?:er)?\b/i);
  const bufferMatch = combined.match(/\bbuffer\b/i);
  const flagMatch = combined.match(/\bflag[s]?\b/i);

  if (/\bwait/.test(combined)) {
    accesses.push({ kind: 'waits_on', resource: semMatch?.[1] || (mutexMatch ? 'mutex' : 'semaphore') });
  }
  if (/\bpost/.test(combined)) {
    accesses.push({ kind: 'posts', resource: semMatch?.[1] || 'semaphore' });
  }
  if (/\block/.test(combined)) {
    accesses.push({ kind: 'locks', resource: mutexMatch ? 'mutex' : 'lock' });
  }
  if (/\bunlock|release/.test(combined)) {
    accesses.push({ kind: 'unlocks', resource: mutexMatch ? 'mutex' : (semMatch?.[1] || 'lock') });
  }
  if (/\bread/.test(combined)) {
    accesses.push({ kind: 'reads', resource: counterMatch ? 'counter' : (bufferMatch ? 'buffer' : 'shared_state') });
  }
  if (/\bwrite|update|set|increment|decrement/.test(combined)) {
    accesses.push({ kind: 'writes', resource: counterMatch ? 'counter' : (bufferMatch ? 'buffer' : (flagMatch ? 'flags' : 'shared_state')) });
  }

  if (accesses.length === 0) {
    if (semMatch) {
      accesses.push({ kind: 'state_access', resource: semMatch[1] });
    } else if (mutexMatch) {
      accesses.push({ kind: 'state_access', resource: 'mutex' });
    } else if (bufferMatch) {
      accesses.push({ kind: 'state_access', resource: 'buffer' });
    }
  }

  return accesses;
}

function edgeLabel(kind) {
  switch (kind) {
    case 'waits_on': return 'waits on';
    case 'posts': return 'posts';
    case 'locks': return 'locks';
    case 'unlocks': return 'unlocks';
    case 'reads': return 'reads';
    case 'writes': return 'writes';
    default: return 'access';
  }
}

export function buildExecutionModel(nodesInput, traceInput, options = {}) {
  const simpleMode = Boolean(options.simpleMode);
  const nodeDefs = new Map();
  for (const node of nodesInput || []) {
    if (node?.id && !nodeDefs.has(node.id)) {
      nodeDefs.set(node.id, node);
    }
  }

  const trace = [...(traceInput || [])].sort(
    (a, b) => Number(a.timestamp_us || 0) - Number(b.timestamp_us || 0)
  );

  const codeNodes = new Map();
  const threadGroups = new Map();
  const functionGroups = new Map();
  const resources = new Map();
  const events = [];
  const allThreads = new Map();

  for (let i = 0; i < trace.length; i += 1) {
    const raw = trace[i];
    const nodeId = normalizeText(raw.node_id);
    if (!nodeId) {
      continue;
    }

    const nodeDef = nodeDefs.get(nodeId) || { id: nodeId, label: nodeId, type: 'checkpoint' };
    const threadName = normalizeText(raw.thread_name) || 'unregistered';
    const functionName = normalizeText(raw.function) || 'unknown_function';
    const actualThreadKey = `thread:${threadName}`;

    if (!allThreads.has(actualThreadKey)) {
      allThreads.set(actualThreadKey, { id: actualThreadKey, threadName, firstSeen: i });
    }

    const threadKey = simpleMode ? 'thread:all' : actualThreadKey;
    const functionKey = simpleMode ? `func:${functionName}` : `func:${threadName}:${functionName}`;
    const codeKey = simpleMode ? `code:${functionName}:${nodeId}` : `code:${threadName}:${functionName}:${nodeId}`;

    if (!threadGroups.has(threadKey)) {
      threadGroups.set(threadKey, {
        id: threadKey,
        threadName: simpleMode ? 'all-threads' : threadName,
        firstSeen: i
      });
    }

    if (!functionGroups.has(functionKey)) {
      functionGroups.set(functionKey, {
        id: functionKey,
        threadKey,
        functionName,
        firstSeen: i,
        codeOrder: []
      });
    }

    if (!codeNodes.has(codeKey)) {
      codeNodes.set(codeKey, {
        id: codeKey,
        nodeId,
        threadName: simpleMode ? 'all-threads' : threadName,
        functionName,
        threadKey,
        functionKey,
        type: nodeDef.type || 'checkpoint',
        label: normalizeText(nodeDef.label) || nodeId,
        file: normalizeText(raw.file) || normalizeText(nodeDef.file),
        line: Number(raw.line || nodeDef.line || 0),
        snippet: inferCodeLine(raw, nodeDef),
        firstSeen: i,
        participants: new Set([threadName]),
        rawNode: nodeDef
      });
      functionGroups.get(functionKey).codeOrder.push(codeKey);
    } else {
      codeNodes.get(codeKey).participants.add(threadName);
    }

    const accesses = inferResourceAccess(raw, nodeDef);
    const resourceKeys = [];
    for (const access of accesses) {
      const resourceName = normalizeText(access.resource);
      if (!resourceName) {
        continue;
      }
      const resourceKey = `res:${resourceName}`;
      resourceKeys.push(resourceKey);
      if (!resources.has(resourceKey)) {
        resources.set(resourceKey, {
          id: resourceKey,
          label: resourceName,
          firstSeen: i,
          inferredFrom: access.kind
        });
      }
    }

    events.push({
      ...raw,
      node_id: nodeId,
      thread_name: threadName,
      function: functionName,
      codeKey,
      functionKey,
      threadKey,
      actualThreadKey,
      resourceKeys,
      resourceKinds: accesses.map((a) => a.kind)
    });
  }

  const threadList = [...threadGroups.values()].sort((a, b) => a.firstSeen - b.firstSeen);
  const availableThreads = [...allThreads.values()].sort((a, b) => a.firstSeen - b.firstSeen);
  const functionList = [...functionGroups.values()].sort((a, b) => a.firstSeen - b.firstSeen);
  const codeList = [...codeNodes.values()]
    .sort((a, b) => a.firstSeen - b.firstSeen)
    .map((n) => ({ ...n, participants: [...n.participants] }));
  const resourceList = [...resources.values()].sort((a, b) => a.firstSeen - b.firstSeen);

  const edges = [];
  for (const fn of functionList) {
    const keys = fn.codeOrder;
    for (let i = 1; i < keys.length; i += 1) {
      edges.push({
        id: `cf:${fn.id}:${i - 1}:${i}`,
        source: keys[i - 1],
        target: keys[i],
        kind: 'control_flow',
        label: 'flow'
      });
    }
  }

  const transitionsByThread = new Map();
  for (const event of events) {
    const key = event.actualThreadKey;
    if (!transitionsByThread.has(key)) {
      transitionsByThread.set(key, []);
    }
    transitionsByThread.get(key).push(event);
  }

  for (const [threadKey, threadEvents] of transitionsByThread.entries()) {
    let prevFunctionKey = null;
    let prevEvent = null;
    const seenTransitions = new Set();

    for (const event of threadEvents) {
      if (prevFunctionKey !== null && prevFunctionKey !== event.functionKey) {
        const key = `${prevEvent?.codeKey || ''}->${event.codeKey}`;
        if (!seenTransitions.has(key)) {
          seenTransitions.add(key);
          const source = prevEvent?.codeKey;
          const target = event.codeKey;
          if (source && target) {
            edges.push({
              id: `ff:${threadKey}:${source}:${target}`,
              source,
              target,
              kind: 'function_flow',
              label: 'call flow'
            });
          }
        }
      }
      prevFunctionKey = event.functionKey;
      prevEvent = event;
    }
  }

  const firstEventByThread = new Map();
  for (const event of events) {
    if (!firstEventByThread.has(event.actualThreadKey)) {
      firstEventByThread.set(event.actualThreadKey, event);
    }
  }

  const seenStateEdges = new Set();
  for (const event of events) {
    for (let i = 0; i < event.resourceKeys.length; i += 1) {
      const target = event.resourceKeys[i];
      const kind = event.resourceKinds[i] || 'state_access';
      const dedup = `${event.codeKey}|${target}|${kind}`;
      if (simpleMode && seenStateEdges.has(dedup)) {
        continue;
      }
      seenStateEdges.add(dedup);
      edges.push({
        id: `sa:${event.codeKey}:${target}:${event.timestamp_us || 0}:${i}`,
        source: event.codeKey,
        target,
        kind,
        label: edgeLabel(kind)
      });
    }
  }

  const seenSpawnEdges = new Set();
  for (const event of events) {
    const text = `${event.node_id || ''} ${event.function || ''}`.toLowerCase();
    if (!text.includes('create') || !text.includes('thread')) {
      continue;
    }

    const tokenMatch = text.match(/thread([a-z0-9_]+)/);
    if (!tokenMatch) {
      continue;
    }
    const token = tokenMatch[1];

    let targetThread = availableThreads.find(
      (t) => t.id !== event.actualThreadKey && t.threadName.toLowerCase().includes(`-${token}`)
    );
    if (!targetThread) {
      targetThread = availableThreads.find(
        (t) => t.id !== event.actualThreadKey && t.threadName.toLowerCase().includes(token)
      );
    }
    if (!targetThread) {
      continue;
    }

    event.spawnThreadKey = targetThread.id;
    const targetEvent = firstEventByThread.get(targetThread.id);
    const targetKey = simpleMode ? targetEvent?.codeKey : targetThread.id;
    if (!targetKey || targetKey === event.codeKey) {
      continue;
    }

    const dedupKey = `${event.codeKey}->${targetKey}`;
    if (seenSpawnEdges.has(dedupKey)) {
      continue;
    }
    seenSpawnEdges.add(dedupKey);

    edges.push({
      id: `spawn:${event.codeKey}:${targetKey}:${event.timestamp_us || 0}`,
      source: event.codeKey,
      target: targetKey,
      kind: 'thread_spawn',
      label: simpleMode ? `spawn ${targetThread.threadName}` : 'spawns'
    });
  }

  return {
    mode: simpleMode ? 'simple' : 'detailed',
    threads: threadList,
    availableThreads,
    functions: functionList,
    codeNodes: codeList,
    resources: resourceList,
    edges,
    events,
    shortFile,
    nodeDefsCount: nodeDefs.size,
    traceNodesCount: new Set(events.map((e) => e.node_id)).size
  };
}
