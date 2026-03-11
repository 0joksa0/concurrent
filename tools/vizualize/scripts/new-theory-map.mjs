#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const [, , keyArg, ...nameParts] = process.argv;
const nameArg = nameParts.join(' ').trim();

if (!keyArg || !nameArg) {
  console.error('Usage: npm run theory:new -- <key> <Map Name>');
  console.error('Example: npm run theory:new -- 1.10 "Nedelja 1: Uvod u semafore"');
  process.exit(1);
}

const root = process.cwd();
const theoryDir = path.join(root, 'public', 'theory');
const indexPath = path.join(theoryDir, 'index.json');

if (!fs.existsSync(indexPath)) {
  console.error('Missing public/theory/index.json');
  process.exit(1);
}

const slug = nameArg
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '');

const filename = `${keyArg}-${slug || 'nova-mapa'}.json`;
const filePath = path.join(theoryDir, filename);

if (fs.existsSync(filePath)) {
  console.error(`Map file already exists: ${filePath}`);
  process.exit(1);
}

const template = {
  nodes: [
    {
      id: 'n0',
      label: 'Nova tema',
      group: 'osnove',
      summary: 'Kratak sažetak teme.',
      explanation: 'Detaljno objašnjenje pojma i zašto je važan.',
      pitfalls: ['tipična greška'],
      scenarios: []
    }
  ],
  edges: []
};

fs.writeFileSync(filePath, `${JSON.stringify(template, null, 2)}\n`, 'utf-8');

const index = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
const nextOrder = index.reduce((m, it) => Math.max(m, Number(it.order || 0)), 0) + 1;
index.push({
  key: keyArg,
  name: nameArg,
  path: `theory/${filename}`,
  order: nextOrder
});

index.sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
fs.writeFileSync(indexPath, `${JSON.stringify(index, null, 2)}\n`, 'utf-8');

console.log(`Created ${path.relative(root, filePath)}`);
console.log(`Updated ${path.relative(root, indexPath)}`);
