// Static QA for the writing skills: each skills/<dir>/SKILL.md needs a
// frontmatter block that parses as YAML with a `name` (matching the directory)
// and a non-empty `description`. A malformed frontmatter makes the skill
// silently invisible at runtime — no error, it just never loads.
//
// Usage: node check-skills.mjs [skills-root]

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';

const profileDir = 'C:\\Users\\August\\.dsh\\profiles\\desktop\\';
const require = createRequire('file:///' + profileDir.replace(/\\/g, '/'));
const yaml = require('js-yaml');

const skillsRoot = process.argv[2] ?? 'D:\\AI_Workspace\\writing\\skills';

const problems = [];
const skills = [];

for (const entry of readdirSync(skillsRoot)) {
  const dir = join(skillsRoot, entry);
  if (!statSync(dir).isDirectory()) continue;

  const file = join(dir, 'SKILL.md');
  let buf;
  try {
    buf = readFileSync(file);
  } catch {
    problems.push(entry + ': SKILL.md missing');
    continue;
  }

  const hasBom = buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf;
  if (hasBom) problems.push(entry + ': starts with a UTF-8 BOM (breaks frontmatter detection)');

  const text = buf.toString('utf8').replace(/^\uFEFF/, '');
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(text);
  if (!match) {
    problems.push(entry + ': no frontmatter block delimited by ---');
    continue;
  }

  let meta;
  try {
    meta = yaml.load(match[1], { schema: yaml.DEFAULT_SCHEMA });
  } catch (error) {
    problems.push(entry + ': frontmatter YAML parse error -> ' + error.message);
    continue;
  }

  if (!meta || typeof meta !== 'object') {
    problems.push(entry + ': frontmatter is not a mapping');
    continue;
  }
  if (typeof meta.name !== 'string' || !meta.name.trim()) problems.push(entry + ': missing "name"');
  if (typeof meta.description !== 'string' || !meta.description.trim()) problems.push(entry + ': missing "description"');
  if (meta.name && meta.name !== entry) {
    problems.push(entry + ': directory name and frontmatter name differ (' + meta.name + ')');
  }

  skills.push({
    dir: entry,
    name: meta.name ?? null,
    descriptionChars: typeof meta.description === 'string' ? meta.description.length : 0,
    bodyChars: text.length - match[0].length,
    extraKeys: Object.keys(meta).filter((k) => k !== 'name' && k !== 'description'),
  });
}

const report = { skillsRoot, count: skills.length, skills, problems, verdict: problems.length === 0 ? 'pass' : 'fail' };
console.log(JSON.stringify(report, null, 2));
process.exit(problems.length === 0 ? 0 : 1);
