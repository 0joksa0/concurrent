export async function loadSampleData() {
  const [nodesRes, traceRes] = await Promise.all([
    fetch('/sample/nodes.json'),
    fetch('/sample/trace.jsonl')
  ]);

  if (!nodesRes.ok || !traceRes.ok) {
    throw new Error('Failed to load sample files from /public/sample');
  }

  const nodes = await nodesRes.json();
  const traceText = await traceRes.text();
  const trace = parseJsonLines(traceText);
  return { nodes, trace };
}

export async function loadPrebuiltScenarios() {
  const indexRes = await fetch('/scenarios/index.json');
  if (!indexRes.ok) {
    throw new Error('Failed to load /scenarios/index.json');
  }

  let indexItems = [];
  try {
    indexItems = await indexRes.json();
  } catch {
    throw new Error('Invalid scenarios index JSON');
  }

  const scenarios = [];
  for (const item of indexItems || []) {
    const name = String(item?.name || '').trim();
    const tracePath = String(item?.trace || '').trim();
    const nodesPath = String(item?.nodes || '').trim();
    if (!name || !tracePath || !nodesPath) {
      continue;
    }

    const [nodesRes, traceRes] = await Promise.all([
      fetch(`/scenarios/${nodesPath}`),
      fetch(`/scenarios/${tracePath}`)
    ]);
    if (!nodesRes.ok || !traceRes.ok) {
      continue;
    }

    const [nodesText, traceText] = await Promise.all([
      nodesRes.text(),
      traceRes.text()
    ]);

    try {
      scenarios.push({
        key: name,
        name: name.replace(/[_-]+/g, ' '),
        nodes: JSON.parse(nodesText),
        trace: parseJsonLines(traceText)
      });
    } catch {
      // skip invalid scenario payloads
    }
  }

  if (scenarios.length === 0) {
    throw new Error('No valid scenarios found in /scenarios.');
  }
  return scenarios;
}

export async function loadDataFromFiles(nodesFile, traceFile) {
  if (!nodesFile || !traceFile) {
    throw new Error('Both nodes.json and trace.jsonl must be selected.');
  }

  const [nodesText, traceText] = await Promise.all([
    readAsText(nodesFile),
    readAsText(traceFile)
  ]);

  let nodes;
  try {
    nodes = JSON.parse(nodesText);
  } catch (error) {
    throw new Error('Invalid nodes.json');
  }

  const trace = parseJsonLines(traceText);
  return { nodes, trace };
}

export async function loadScenariosFromFolder(fileList) {
  const files = [...(fileList || [])];
  if (files.length === 0) {
    throw new Error('Select a folder containing scenario subfolders with nodes.json and trace.jsonl.');
  }

  const grouped = new Map();
  for (const file of files) {
    const rel = String(file.webkitRelativePath || file.name || '');
    const parts = rel.split('/').filter(Boolean);
    const base = parts[parts.length - 1] || '';
    const dir = parts.length > 1 ? parts.slice(0, -1).join('/') : '.';

    if (base !== 'nodes.json' && base !== 'trace.jsonl') {
      continue;
    }

    if (!grouped.has(dir)) {
      grouped.set(dir, { dir, nodesFile: null, traceFile: null });
    }
    const bucket = grouped.get(dir);
    if (base === 'nodes.json') {
      bucket.nodesFile = file;
    } else {
      bucket.traceFile = file;
    }
  }

  const scenarios = [];
  for (const bucket of grouped.values()) {
    if (!bucket.nodesFile || !bucket.traceFile) {
      continue;
    }

    const [nodesText, traceText] = await Promise.all([
      readAsText(bucket.nodesFile),
      readAsText(bucket.traceFile)
    ]);

    let nodes;
    try {
      nodes = JSON.parse(nodesText);
    } catch {
      continue;
    }

    scenarios.push({
      key: bucket.dir,
      name: scenarioNameFromDir(bucket.dir),
      nodes,
      trace: parseJsonLines(traceText)
    });
  }

  scenarios.sort((a, b) => a.name.localeCompare(b.name));
  if (scenarios.length === 0) {
    throw new Error('No valid scenario folders found (each must have nodes.json and trace.jsonl).');
  }
  return scenarios;
}

function scenarioNameFromDir(dir) {
  const text = String(dir || '.');
  const leaf = text.split('/').filter(Boolean).pop() || 'root';
  return leaf.replace(/[_-]+/g, ' ');
}

function readAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

export function parseJsonLines(text) {
  const events = [];
  const lines = text.split(/\r?\n/);

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      continue;
    }
    try {
      events.push(JSON.parse(line));
    } catch {
      // Skip malformed lines in MVP mode.
    }
  }

  events.sort((a, b) => Number(a.timestamp_us || 0) - Number(b.timestamp_us || 0));
  return events;
}
