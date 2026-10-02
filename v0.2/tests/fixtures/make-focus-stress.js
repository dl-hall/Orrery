// Generates the focus-mode spacing fixtures. The centre process (always processes[0]) has long-named, long-described
// flow partners: 5 that feed it, 5 it feeds and 10 both ways, plus 6 roles. "-refs" adds 2 meetings and 2 documents;
// "fed-by-three" is just three feeders, each with a description.
const fs = require('fs');
const path = require('path');
const LOREM = 'Lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua ut enim ad minim veniam quis nostrud exercitation ullamco laboris.';
const NAMES = ['Quarterly supplier performance review', 'Regional demand forecasting and planning', 'Customer onboarding and account set-up',
  'Annual budget consolidation and sign-off', 'Product safety incident investigation', 'Warehouse capacity and logistics planning',
  'Marketing campaign approval and launch', 'Contract renewal and vendor negotiation', 'Field service scheduling and dispatch',
  'Engineering change request evaluation', 'Regulatory compliance audit preparation', 'Talent acquisition and interview panels',
  'Data platform access request handling', 'Pricing strategy review and approval', 'Customer complaint escalation handling',
  'Inventory reconciliation and write-offs', 'Brand guideline governance and review', 'Capital expenditure request assessment',
  'Partner channel enablement programme', 'Release readiness and go-live decision'];
const departments = [
  { id: 'dep-ops', name: 'Operations', colour: '#2F5D8A' }, { id: 'dep-fin', name: 'Finance', colour: '#86397A' }, { id: 'dep-eng', name: 'Engineering', colour: '#3B7447' },
];
const roles = ['Head of operations excellence', 'Senior procurement analyst', 'Finance business partner', 'Management accountant',
  'Principal systems engineer', 'Quality assurance lead'].map((name, i) => ({ id: `rol-${i}`, name, department: departments[Math.floor(i / 2)].id }));
const proc = (id, name, extra = {}) => ({ id, name, description: LOREM, roles: [], meetings: [], documents: [], ...extra });

function build({ ins, outs, both, refs, roles: withRoles = true }) {
  const centre = proc('pro-centre', 'Integrated business planning and review cycle', { roles: withRoles ? roles.map(r => ({ role: r.id, raci: ['R'], note: '' })) : [] });
  const partners = [], flows = [];
  let n = 0;
  const add = (count, dirs) => { for (let i = 0; i < count; i++, n++) {
    const p = proc(`pro-${n}`, NAMES[n % NAMES.length]);
    partners.push(p);
    for (const [from, to] of dirs(p.id)) flows.push({ id: `flo-${from}-${to}`, from, to, description: '' });
  } };
  add(ins, id => [[id, centre.id]]);
  add(outs, id => [[centre.id, id]]);
  add(both, id => [[id, centre.id], [centre.id, id]]);
  const meetings = refs ? [
    { id: 'mtg-0', name: 'Monthly operations and finance steering committee', cadence: 'monthly', roles: roles.map(r => ({ role: r.id })) },
    { id: 'mtg-1', name: 'Weekly planning stand-up', cadence: 'weekly', roles: roles.slice(0, 3).map(r => ({ role: r.id })) },
  ] : [];
  const documents = refs ? [
    { id: 'doc-0', name: 'Integrated business plan and assumptions register', owners: [roles[0].id], reviewers: [] },
    { id: 'doc-1', name: 'Planning calendar', owners: [roles[2].id], reviewers: [] },
  ] : [];
  if (refs) { centre.meetings = meetings.map(m => m.id); centre.documents = documents.map(d => d.id); }
  return { orrery: '0.2', title: 'Focus spacing stress test', departments, roles: withRoles ? roles : [], processes: [centre, ...partners], meetings, documents, flows };
}

const write = (name, d) => { fs.writeFileSync(path.join(__dirname, name), JSON.stringify(d, null, 2) + '\n'); console.log('wrote', name); };
write('focus-stress.json', build({ ins: 5, outs: 5, both: 10, refs: false }));
write('focus-stress-refs.json', build({ ins: 5, outs: 5, both: 10, refs: true }));
write('focus-fed-by-three.json', build({ ins: 3, outs: 0, both: 0, refs: false }));
