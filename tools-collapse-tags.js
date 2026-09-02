const fs = require('fs');
const p = 'C:/Users/小样儿/Desktop/products/_repos/rcj-lab/logs/experiments.json';
const raw = fs.readFileSync(p, 'utf8');
const hasBom = raw.charCodeAt(0) === 0xFEFF;
const body = hasBom ? raw.slice(1) : raw;
const j = JSON.parse(body);
const out = JSON.stringify(j, null, 2);
// collapse multi-line tags arrays into inline form:
//   "tags": [\n    "a",\n    "b"\n  ]
// -> "tags": ["a", "b"]
const collapsed = out.replace(/("tags": \[\n)((?:      "[^"]*",?\n)+)(\s*\])/g, (m, pre, items, close) => {
  const arr = items.split('\n').map(s => s.trim().replace(/,$/, '')).filter(s => s);
  return '  ' + arr.join(', ') + '\n  ' + close.trim();
});
// remove the now-extra blank/indent artifacts caused by replacing 3 lines with 1
const result = (hasBom ? '\uFEFF' : '') + collapsed + '\n';
fs.writeFileSync(p, result, 'utf8');

// verify
const raw2 = fs.readFileSync(p, 'utf8');
const body2 = raw2.charCodeAt(0) === 0xFEFF ? raw2.slice(1) : raw2;
const v = JSON.parse(body2);
console.log('valid, entries:', v.experiments.length);
console.log('sample tags:', JSON.stringify(v.experiments[0].tags), '|', JSON.stringify(v.experiments[2].tags));
