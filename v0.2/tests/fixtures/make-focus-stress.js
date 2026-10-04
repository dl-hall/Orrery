// Generates the focus-mode spacing fixtures. The centre process (always processes[0]) has long-named, long-described
// flow partners: 5 that feed it, 5 it feeds and 10 both ways, plus 6 roles. "-refs" adds 2 meetings and 2 documents;
// "fed-by-three" is just three feeders, each with a description.
// The legibility cases have 3 feeders, 3 fed and 4 both ways: "target" adds 10 roles, 6 meetings and 4 documents;
// "few-roles" 3 roles, 6 meetings and 4 documents; "role-heavy" 10 roles, 1 meeting and 1 document.
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
const ROLE_NAMES = ['Head of operations excellence', 'Senior procurement analyst', 'Finance business partner', 'Management accountant',
  'Principal systems engineer', 'Quality assurance lead', 'Supply chain planner', 'Data analyst', 'Programme manager', 'Commercial director'];
const allRoles = ROLE_NAMES.map((name, i) => ({ id: `rol-${i}`, name, department: departments[i < 6 ? Math.floor(i / 2) : i % 3].id }));
const MEETINGS = [['Monthly operations and finance steering committee', 'monthly'], ['Weekly planning stand-up', 'weekly'],
  ['Quarterly business review', 'quarterly'], ['S&OP executive meeting', 'monthly'], ['Demand review', 'weekly'], ['Supply review', 'weekly']];
const DOCUMENTS = ['Integrated business plan and assumptions register', 'Planning calendar', 'Demand forecast workbook', 'Capacity model'];
const proc = (id, name, extra = {}) => ({ id, name, description: LOREM, roles: [], meetings: [], documents: [], ...extra });

function build({ ins, outs, both, refs, roles: nRoles = 6, meetings: nMeetings = refs ? 2 : 0, documents: nDocuments = refs ? 2 : 0 }) {
  const roles = allRoles.slice(0, nRoles);
  const centre = proc('pro-centre', 'Integrated business planning and review cycle', { roles: roles.map(r => ({ role: r.id, raci: ['R'], note: '' })) });
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
  // the first meeting takes everyone; the others a growing slice
  const meetings = MEETINGS.slice(0, nMeetings).map(([name, cadence], i) => ({ id: `mtg-${i}`, name, cadence, roles: (i ? roles.slice(0, 1 + i * 2) : roles).map(r => ({ role: r.id })) }));
  const documents = DOCUMENTS.slice(0, nDocuments).map((name, i) => ({ id: `doc-${i}`, name, owners: [roles[(i * 2) % roles.length].id], reviewers: [] }));
  if (meetings.length || documents.length) { centre.meetings = meetings.map(m => m.id); centre.documents = documents.map(d => d.id); }
  return { orrery: '0.2', title: 'Focus spacing stress test', departments, roles, processes: [centre, ...partners], meetings, documents, flows };
}

const write = (name, d) => { fs.writeFileSync(path.join(__dirname, name), JSON.stringify(d, null, 2) + '\n'); console.log('wrote', name); };
write('focus-stress.json', build({ ins: 5, outs: 5, both: 10, refs: false }));
write('focus-stress-refs.json', build({ ins: 5, outs: 5, both: 10, refs: true }));
write('focus-fed-by-three.json', build({ ins: 3, outs: 0, both: 0, refs: false }));
write('focus-target.json', build({ ins: 3, outs: 3, both: 4, roles: 10, meetings: 6, documents: 4 }));
write('focus-few-roles.json', build({ ins: 3, outs: 3, both: 4, roles: 3, meetings: 6, documents: 4 }));
write('focus-role-heavy.json', build({ ins: 3, outs: 3, both: 4, roles: 10, meetings: 1, documents: 1 }));
