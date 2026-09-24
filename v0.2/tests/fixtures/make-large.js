// Generates fixtures/large.json: 150 roles, 40 processes, 8 departments (deterministic).
const fs = require('fs');
const path = require('path');
let seed = 42;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const depNames = ['Research', 'Design', 'Marketing', 'Operations', 'Finance', 'Quality', 'Sales', 'People'];
const departments = depNames.map((name, i) => ({ id: `dep-${i}`, name }));
const titles = ['Manager', 'Lead', 'Engineer', 'Analyst', 'Specialist', 'Coordinator', 'Director', 'Officer'];
const roles = Array.from({ length: 150 }, (_, i) => {
  const dep = departments[i % departments.length];
  return { id: `rol-${i}`, name: `${dep.name} ${titles[i % titles.length]} ${Math.floor(i / 8) + 1}`, description: '', department: i % 23 === 0 ? null : dep.id };
});
const meetings = Array.from({ length: 20 }, (_, i) => ({ id: `mtg-${i}`, name: `Meeting ${i + 1}`, cadence: pick(['weekly', 'monthly', 'quarterly', null]), roles: [] }));
const documents = Array.from({ length: 30 }, (_, i) => ({ id: `doc-${i}`, name: `Document ${i + 1}`, owners: [], reviewers: [] }));
const processes = Array.from({ length: 40 }, (_, i) => {
  const n = 3 + Math.floor(rnd() * 6);
  const rs = new Set();
  while (rs.size < n) rs.add(pick(roles).id);
  return {
    id: `pro-${i}`, name: `Process ${i + 1} ${pick(['planning', 'review', 'delivery', 'approval', 'reporting'])}`,
    roles: [...rs].map(role => ({ role, raci: [pick(['R', 'A', 'C', 'I'])], note: '' })),
    meetings: rnd() < 0.4 ? [pick(meetings).id] : [],
    documents: rnd() < 0.5 ? [pick(documents).id] : [],
  };
});
for (const m of meetings) { const s = new Set(); while (s.size < 4) s.add(pick(roles).id); m.roles = [...s].map((role, i) => ({ role, chair: i === 0, mandatory: i < 2 })); }
for (const d of documents) { d.owners = [pick(roles).id]; }
fs.writeFileSync(path.join(__dirname, 'large.json'), JSON.stringify({ orrery: '0.1', title: 'Large organisation', departments, roles, processes, meetings, documents }, null, 2));
console.log('wrote large.json');
