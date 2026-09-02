const fs = require('fs');
const p = 'C:/Users/小样儿/Desktop/products/_repos/rcj-lab/logs/experiments.json';
const raw = fs.readFileSync(p, 'utf8');
const hasBom = raw.charCodeAt(0) === 0xFEFF;
const body = hasBom ? raw.slice(1) : raw;
const j = JSON.parse(body);
let out = JSON.stringify(j, null, 2);
// collapse multi-line tags arrays into inline: "tags": [\n        "a",\n        "b"\n      ]
out = out.replace(/"tags": \[\n((?:        "[^"]*",?\n)+?)\s*\]/g, (m, items) => {
  const arr = items.trim().split('\n').map(s => s.trim().replace(/,$/, '')).filter(Boolean)
    .map(s => s.replace(/^"|"$/g, ''));
  return '"tags": ["' + arr.join('", "') + '"]';
});
fs.writeFileSync(p, (hasBom ? '\uFEFF' : '') + out + '\n', 'utf8');

// verify + count remaining multi-line tags
const raw2 = fs.readFileSync(p, 'utf8');
const body2 = raw2.charCodeAt(0) === 0xFEFF ? raw2.slice(1) : raw2;
JSON.parse(body2);
const multiline = out.split('"tags": [\n').length - 1;
console.log('valid, entries:', j.experiments.length, '| remaining multiline tags:', multiline);
