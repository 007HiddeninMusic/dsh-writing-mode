// Validate the DSH profile patch layer for the writing preset.
//
// The patch layer is id-targeted: `- id: X` only overrides an EXISTING row, and
// a flat row naming a new id is silently dropped. New rows must sit under a
// top-level `insert:` block. This validator therefore looks inside `insert:`.
//
// Usage: node validate-profile.mjs [path-to-cordis.patch.yml]

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const profileDir = 'C:\\Users\\August\\.dsh\\profiles\\desktop\\';
const require = createRequire('file:///' + profileDir.replace(/\\/g, '/'));
const yaml = require('js-yaml');

const file = process.argv[2] ?? profileDir + 'cordis.patch.yml';

let doc;
try {
  const text = readFileSync(file, 'utf8');
  // The Cordis entry-list parser emits `!!js` scalars; accept them as opaque strings.
  const JsType = new yaml.Type('tag:yaml.org,2002:js', {
    kind: 'scalar',
    construct: (data) => String(data),
  });
  doc = yaml.load(text, { schema: yaml.DEFAULT_SCHEMA.extend([JsType]) });
} catch (error) {
  console.error('FAIL: YAML parse error -> ' + error.message);
  process.exit(1);
}

if (!Array.isArray(doc)) {
  console.error('FAIL: top level is not a YAML array');
  process.exit(1);
}

const flatIds = [];
const inserted = [];
for (const entry of doc) {
  if (!entry || typeof entry !== 'object') continue;
  if (typeof entry.id === 'string') flatIds.push(entry.id);
  if (Array.isArray(entry.insert)) {
    for (const row of entry.insert) {
      if (row && typeof row === 'object' && typeof row.id === 'string') inserted.push(row);
    }
  }
}

const preset = inserted.find((row) => row.id === 'preset-writing');
const plugins = preset?.config?.plugins;
const allIds = [...flatIds, ...inserted.map((row) => row.id)];
const duplicateIds = allIds.filter((id, i) => allIds.indexOf(id) !== i);

const report = {
  file,
  flatRowIds: flatIds,
  insertedIds: inserted.map((row) => row.id),
  duplicateIds,
  presetWritingPresent: Boolean(preset),
  presetIdentity: preset?.config?.id ?? null,
  presetDisplayName: preset?.config?.name ?? null,
  pluginCount: Array.isArray(plugins) ? plugins.length : null,
  hasPersonaPrefix: Boolean(plugins?.some((p) => p?.id === 'persona' && p?.config?.prefix)),
  hasSkillDirs: Boolean(plugins?.some((p) => p?.id === 'skill-filesystem' && p?.config?.customSkillDirs)),
  hasShell: Boolean(plugins?.some((p) => p?.id === 'tool-pwsh')),
  hasNoBash: !plugins?.some((p) => p?.id === 'tool-bash'),
};
console.log(JSON.stringify(report, null, 2));

const ok =
  report.presetWritingPresent &&
  report.presetIdentity === 'writing' &&
  report.pluginCount === 12 &&
  report.hasPersonaPrefix &&
  report.hasSkillDirs &&
  report.hasShell &&
  report.hasNoBash &&
  duplicateIds.length === 0;

console.log(ok ? 'OK: writing preset is well-formed under insert:' : 'FAIL: assertions not satisfied');
process.exit(ok ? 0 : 1);
