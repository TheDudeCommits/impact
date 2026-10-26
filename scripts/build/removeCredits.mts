import fs from 'node:fs';
import { parseAst } from 'rolldown/parseAst';

const TARGETS: readonly { file: string; key: string }[] = [
  { file: 'src/game/stages.ts', key: 'credit' },
  { file: 'src/survival/enemies.ts', key: 'credit' },
  { file: 'src/game/objectives/siegeEnemies.ts', key: 'credit' },
  { file: 'src/game/economy/outfits.ts', key: 'source' },
];
const RECORD = 'docs/provenance/game-data-credits.json';
const check = process.argv.includes('--check');

interface Node { type: string; start: number; end: number; [key: string]: unknown }
type Found = { start: number; end: number; owner: string; text?: string };
const keyName = (node: Node | undefined) => !node ? '' : node.type === 'Identifier' ? node.name as string : node.type === 'Literal' ? String(node.value) : '';
const isNode = (value: unknown): value is Node => !!value && typeof value === 'object' && typeof (value as Node).type === 'string';

function ownerOf(object: Node, parents: Map<Node, Node>, text: string): string {
  for (const prop of object.properties as Node[]) if (prop.type === 'Property' && keyName(prop.key as Node) === 'id' && isNode(prop.value) && typeof prop.value.value === 'string') return prop.value.value;
  for (let node: Node | undefined = object; node; node = parents.get(node)) {
    const parent = parents.get(node);
    if (parent?.type === 'Property' && parent.value === node) return keyName(parent.key as Node);
  }
  return `line ${text.slice(0, object.start).split('\n').length}`;
}

function cut(text: string, start: number, end: number): [number, number] {
  let s = start, e = end;
  let after = e; while (after < text.length && (text[after] === ' ' || text[after] === '\t')) after++;
  if (text[after] === ',' || text[after] === ';') e = after + 1;
  else { let before = s - 1; while (before >= 0 && /\s/.test(text[before])) before--; if (text[before] === ',') s = before; }
  const lineStart = text.lastIndexOf('\n', s - 1) + 1, lineEnd = text.indexOf('\n', e);
  if (!text.slice(lineStart, s).trim() && !text.slice(e, lineEnd < 0 ? text.length : lineEnd).trim()) return [lineStart, lineEnd < 0 ? text.length : lineEnd + 1];
  while (text[e] === ' ' && (text[s - 1] === ' ' || text[s - 1] === '{' || text[s - 1] === ',')) e++;
  return [s, e];
}

function find(text: string, key: string): Found[] {
  const ast = parseAst(text, { lang: 'ts' }) as unknown as Node, parents = new Map<Node, Node>(), found: Found[] = [];
  const walk = (node: Node) => {
    for (const value of Object.values(node)) for (const child of Array.isArray(value) ? value : [value]) if (isNode(child)) { parents.set(child, node); walk(child); }
  };
  walk(ast);
  for (const [node, parent] of parents) {
    if (node.type === 'Property' && parent.type === 'ObjectExpression' && keyName(node.key as Node) === key)
      found.push({ start: node.start, end: node.end, owner: ownerOf(parent, parents, text), text: text.slice((node.value as Node).start, (node.value as Node).end) });
    else if (node.type === 'TSPropertySignature' && keyName(node.key as Node) === key) {
      let start = node.start;
      const before = text.slice(0, start).trimEnd();
      if (before.endsWith('*/')) start = before.lastIndexOf('/*');
      found.push({ start, end: node.end, owner: '(type)' });
    }
  }
  return found;
}

const record: Record<string, Record<string, string>> = fs.existsSync(RECORD) ? JSON.parse(fs.readFileSync(RECORD, 'utf8')).files ?? {} : {};
let left = 0;
for (const { file, key } of TARGETS) {
  const text = fs.readFileSync(file, 'utf8');
  const found = find(text, key);
  left += found.length;
  if (check) { for (const f of found) console.log(`${file}: ${key} of ${f.owner}`); continue; }
  if (!found.length) continue;
  const kept = (record[file] ??= {});
  for (const f of found) if (f.text !== undefined) kept[f.owner] = f.text;
  let out = text;
  for (const f of [...found].sort((a, b) => b.start - a.start)) { const [s, e] = cut(out, f.start, f.end); out = out.slice(0, s) + out.slice(e); }
  fs.writeFileSync(file, out);
  console.log(`${file}: ${found.length} ${key} removed`);
}
if (check) { console.log(left ? `${left} left` : 'none left'); process.exit(left ? 1 : 0); }
fs.mkdirSync('docs/provenance', { recursive: true });
fs.writeFileSync(RECORD, `${JSON.stringify({ note: 'Who made each stage, enemy and outfit model, and under what terms: taken out of the game code on 11 October 2026 (the owner: "Remove the credits page/details entirely") by scripts/build/removeCredits.mts. Kept here for the record; never published.', files: record }, null, 1)}\n`);
console.log(`recorded in ${RECORD}`);
