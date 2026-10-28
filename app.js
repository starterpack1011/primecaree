/* Nursing Patient Records — academic prototype (data stored in browser localStorage) */
const $ = (s, r = document) => r.querySelector(s);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const save = (k, v) => localStorage.setItem(k, JSON.stringify(v));
const uid = () => Math.random().toString(36).slice(2, 9);
const today = () => new Date().toISOString().slice(0, 10);

/* ---------- Roles & permissions ---------- */
const PERMS = {
  Administrator: ['view', 'add', 'edit', 'vitals', 'notes', 'delete', 'audit', 'users', 'modify'],
  Doctor: ['view', 'add', 'edit', 'vitals', 'notes', 'audit'],
  Nurse: ['view', 'add', 'edit', 'vitals', 'notes'],
};
const can = a => !!(state.user && PERMS[state.user.role].includes(a));

/* ---------- Data ---------- */
const seedUsers = [
  { id: 'u1', name: 'Admin', email: 'admin@gmail.com', password: 'admin3211', role: 'Administrator', status: 'Active' },
  { id: 'u2', name: 'Instructor', email: 'instructor@gmail.com', password: 'instructor3212', role: 'Doctor', status: 'Active' },
  { id: 'u3', name: 'Nurse', email: 'nurse@gmail.com', password: 'nurse3213', role: 'Nurse', status: 'Active' }
];
const storedUsers = load('npr_users', null);
const authSeedVersion = load('npr_auth_seed_version', 0);
const users = storedUsers && authSeedVersion >= 1
  ? storedUsers
  : storedUsers
  ? [...seedUsers.map(seed => {
    const stored = storedUsers.find(user => user.id === seed.id);
    return stored ? { ...stored, ...seed, name: stored.name || seed.name, status: stored.status || seed.status } : seed;
  }), ...storedUsers.filter(user => !seedUsers.some(seed => seed.id === user.id))]
  : seedUsers;
if (authSeedVersion < 1) {
  save('npr_users', users);
  save('npr_auth_seed_version', 1);
}
if (authSeedVersion < 2) {
  const admin = users.find(user => user.id === 'u1');
  if (admin && ['Ryzza', 'Administrator'].includes(admin.name)) admin.name = 'Admin';
  save('npr_users', users);
  save('npr_auth_seed_version', 2);
}
const LEGACY_ROLES = { Instructor: 'Doctor' };
const isStudentAccount = user => user.id === 'u4' ||
  String(user.email || '').trim().toLowerCase() === 'student@gmail.com' ||
  String(user.role || '').trim().toLowerCase() === 'student';
const activeUsers = users.filter(user => !isStudentAccount(user));
activeUsers.forEach(user => { user.role = LEGACY_ROLES[user.role] || user.role; });
users.splice(0, users.length, ...activeUsers);
save('npr_users', users);
const blankPatient = () => ({
  id: '', firstName: '', middleName: '', lastName: '', suffix: '', dob: '', age: '', sex: '', civilStatus: '', nationality: '', religion: '',
  address: '', contact: '', email: '', ecName: '', ecRel: '', ecContact: '', ecAddress: '', nurseName: '', hospId: '', philhealth: '', insNo: '',
  createdAt: today(), pastHistory: {}, familyHistory: {}, psychosocial: {},
  discharge: {},
  surgical: [], allergies: [], meds: [], vitals: [], assessments: [], notes: [], labs: [], immun: [], carePlans: []
});
function seedPatients() {
  const mk = (o) => Object.assign(blankPatient(), o);
  const a = mk({ id: 'PT-0001', firstName: 'Juan', lastName: 'Dela Cruz', dob: '1985-03-12', age: 41, sex: 'Male', civilStatus: 'Married', nationality: 'Filipino', religion: 'Catholic', address: 'Quezon City', contact: '09171234567', email: 'juan@example.com', ecName: 'Rosa Dela Cruz', ecRel: 'Spouse', ecContact: '09179876543', hospId: 'H-1001', philhealth: 'PhilHealth', insNo: '12-345678901-2' });
  a.vitals.push({ id: uid(), date: today(), temp: 38.2, bp: '150/95', hr: 96, rr: 20, spo2: 97, pain: 3, o2: 'Room air', weight: 78, height: 172, by: 'Seed' });
  a.labs.push({ id: uid(), test: 'Hemoglobin', date: today(), result: '13.5', range: '13.5-17.5', unit: 'g/dL', remarks: 'Normal', provider: 'Dr. Reyes' });
  const b = mk({ id: 'PT-0002', firstName: 'Maria', lastName: 'Santos', dob: '1992-07-25', age: 34, sex: 'Female', civilStatus: 'Single', nationality: 'Filipino', religion: 'Catholic', address: 'Manila', contact: '09181112222' });
  b.vitals.push({ id: uid(), date: today(), temp: 36.8, bp: '118/76', hr: 78, rr: 16, spo2: 85, pain: 0, o2: 'Nasal cannula', weight: 55, height: 160, by: 'Seed' });
  b.labs.push({ id: uid(), test: 'WBC', date: today(), result: '', range: '4.5-11.0', unit: 'x10^9/L', remarks: 'Awaiting result', provider: 'Dr. Lim' });
  const c = mk({ id: 'PT-0003', firstName: 'Pedro', lastName: 'Reyes', dob: '1970-11-02', age: 55, sex: 'Male', civilStatus: 'Widowed', nationality: 'Filipino', religion: 'Iglesia', address: 'Cebu City', contact: '09223334444' });
  c.notes.push({ id: uid(), date: today(), format: 'SOAP', S: 'Complains of headache', O: 'BP 140/90', A: 'Acute pain', P: 'Give analgesic, monitor BP', by: 'Seed' });
  return [a, b, c];
}
const state = {
  user: load('npr_session', null), view: 'dashboard', pid: null, tab: 'Overview', q: '', denied: null,
  users,
  patients: load('npr_patients', null) || (() => { const p = seedPatients(); save('npr_patients', p); return p; })(),
  audit: load('npr_audit', [])
};
const persist = () => { save('npr_users', state.users); save('npr_patients', state.patients); save('npr_audit', state.audit); };
function log(action, pid, desc) {
  const accountUser = state.user ? `${state.user.name} (${state.user.role})` : 'Anonymous';
  const attendingPhysician = pid ? stripRole(patient(pid)?.nurseName) : '';
  const actor = attendingPhysician || (state.user ? state.user.name : 'Anonymous');
  const description = `${desc}; Performed by: ${actor}`;
  state.audit.unshift({
    time: new Date().toLocaleString(), user: attendingPhysician || accountUser,
    accountUser, attendingPhysician, action, pid: pid || '-', desc: description
  });
  persist();
}
const patient = id => state.patients.find(p => p.id === id);
const fullName = p => [p.firstName, p.middleName, p.lastName, p.suffix].filter(Boolean).join(' ');
const stripRole = v => String(v || '').replace(/\s*\([^()]*\)\s*$/, '');

/* ---------- Field schemas: {k,l,t,o,g,f} ---------- */
const OPT = {
  sex: ['Male', 'Female', 'Other'], civil: ['Single', 'Married', 'Widowed', 'Separated', 'Divorced'],
  loc: ['Alert', 'Verbal', 'Pain', 'Unresponsive'], yn: ['Yes', 'No']
};
const F = {
  patientPersonal: [
    { k: 'id', l: 'Patient ID' }, { k: 'firstName', l: 'First Name', req: 1 }, { k: 'middleName', l: 'Middle Name' }, { k: 'lastName', l: 'Last Name', req: 1 },
    { k: 'suffix', l: 'Suffix' }, { k: 'dob', l: 'Date of Birth', t: 'date', req: 1 }, { k: 'age', l: 'Age', t: 'number' }, { k: 'sex', l: 'Sex', t: 'select', o: OPT.sex },
    { k: 'civilStatus', l: 'Civil Status', t: 'select', o: OPT.civil }, { k: 'nationality', l: 'Nationality' }, { k: 'religion', l: 'Religion' },
    { k: 'address', l: 'Address' }, { k: 'contact', l: 'Contact Number' }, { k: 'email', l: 'Email', t: 'email' }],
  emergency: [{ k: 'ecName', l: 'Contact Name' }, { k: 'ecRel', l: 'Relationship' }, { k: 'ecContact', l: 'Contact Number' }, { k: 'ecAddress', l: 'Address' }],
  nurse: [{ k: 'nurseName', l: 'Attending Physician' }],
  ident: [{ k: 'hospId', l: 'Hospital / Patient ID' }, { k: 'philhealth', l: 'PhilHealth / Insurance' }, { k: 'insNo', l: 'Insurance Number' }],
  pastHistory: [{ k: 'illnesses', l: 'Previous Illnesses', t: 'textarea' }, { k: 'chronic', l: 'Chronic Conditions', t: 'textarea' },
    { k: 'hospitalizations', l: 'Previous Hospitalizations', t: 'textarea' }, { k: 'diagnoses', l: 'Previous Diagnoses', t: 'textarea' }],
  familyHistory: [{ k: 'hypertension', l: 'Hypertension', t: 'select', o: OPT.yn }, { k: 'diabetes', l: 'Diabetes', t: 'select', o: OPT.yn },
    { k: 'heart', l: 'Heart Disease', t: 'select', o: OPT.yn }, { k: 'cancer', l: 'Cancer', t: 'select', o: OPT.yn },
    { k: 'kidney', l: 'Kidney Disease', t: 'select', o: OPT.yn }, { k: 'other', l: 'Other Hereditary Conditions', t: 'textarea' }],
  psychosocial: [{ k: 'mental', l: 'Mental Status' }, { k: 'mood', l: 'Mood' }, { k: 'behavior', l: 'Behavior' }, { k: 'sleep', l: 'Sleep' },
    { k: 'stressors', l: 'Stressors', t: 'textarea' }, { k: 'support', l: 'Social Support', t: 'textarea' }, { k: 'lifestyle', l: 'Lifestyle', t: 'textarea' },
    { k: 'substance', l: 'Substance-Use History', t: 'textarea' }, { k: 'safety', l: 'Safety Assessment', t: 'textarea' }]
};
const LISTS = {
  surgical: { title: 'Surgical History', perm: 'edit', fields: [{ k: 'procedure', l: 'Procedure' }, { k: 'date', l: 'Date', t: 'date' }, { k: 'hospital', l: 'Hospital' }, { k: 'outcome', l: 'Outcome' }] },
  allergies: { title: 'Allergies', perm: 'edit', fields: [{ k: 'type', l: 'Type', t: 'select', o: ['Drug', 'Food', 'Environmental'] }, { k: 'allergen', l: 'Allergen' }, { k: 'reaction', l: 'Reaction' }] },
  meds: { title: 'Medications', perm: 'edit', fields: [{ k: 'name', l: 'Medication Name' }, { k: 'generic', l: 'Generic Name' }, { k: 'dose', l: 'Dose' }, { k: 'route', l: 'Route' }, { k: 'freq', l: 'Frequency' },
    { k: 'administrationTime', l: 'Administration Time' }, { k: 'prescriber', l: 'Prescribing Physician' },
    { k: 'start', l: 'Start Date', t: 'date' }, { k: 'end', l: 'End Date', t: 'date' }, { k: 'indication', l: 'Indication' }, { k: 'status', l: 'Status', t: 'select', o: ['Active', 'Completed', 'Discontinued'] }, { k: 'notes', l: 'Notes', t: 'textarea' }] },
  vitals: { title: 'Vital Signs', perm: 'vitals', fields: [{ k: 'date', l: 'Date', t: 'date' }, { k: 'temp', l: 'Temperature (°C)', t: 'number', step: '0.1' }, { k: 'bp', l: 'Blood Pressure (mmHg)', ph: '120/80' },
    { k: 'hr', l: 'Heart Rate (bpm)', t: 'number' }, { k: 'rr', l: 'Respiratory Rate (/min)', t: 'number' }, { k: 'spo2', l: 'SpO2 (%)', t: 'number' }, { k: 'pain', l: 'Pain Score (0-10)', t: 'number', min: 0, max: 10 },
    { k: 'o2', l: 'Oxygen Support', t: 'select', o: ['Room air', 'Nasal cannula', 'Face mask', 'Non-rebreather', 'Ventilator'] }, { k: 'weight', l: 'Weight (kg)', t: 'number', step: '0.1' }, { k: 'height', l: 'Height (cm)', t: 'number', step: '0.1' },
    { g: 'Chief Complaint', k: 'complaint', l: 'Chief Complaint', t: 'textarea' }] },
  assessments: { title: 'Nursing Assessment', perm: 'notes', cards: 1, fields: [
    { g: 'General', k: 'appearance', l: 'General Appearance' }, { g: 'General', k: 'loc', l: 'Level of Consciousness', t: 'select', o: OPT.loc }, { g: 'General', k: 'mental', l: 'Mental Status' },
    { g: 'General', k: 'mobility', l: 'Mobility' }, { g: 'General', k: 'nutrition', l: 'Nutrition' }, { g: 'General', k: 'hydration', l: 'Hydration' },
    { g: 'Neurological', k: 'nLoc', l: 'LOC' }, { g: 'Neurological', k: 'orientation', l: 'Orientation' }, { g: 'Neurological', k: 'pupils', l: 'Pupils' }, { g: 'Neurological', k: 'motor', l: 'Motor Response' },
    { g: 'Respiratory', k: 'rPattern', l: 'Respiratory Pattern' }, { g: 'Respiratory', k: 'breath', l: 'Breath Sounds' }, { g: 'Respiratory', k: 'rSat', l: 'Oxygen Saturation' }, { g: 'Respiratory', k: 'rO2', l: 'Oxygen Support' },
    { g: 'Cardiovascular', k: 'cHr', l: 'Heart Rate' }, { g: 'Cardiovascular', k: 'rhythm', l: 'Rhythm' }, { g: 'Cardiovascular', k: 'pulses', l: 'Peripheral Pulses' }, { g: 'Cardiovascular', k: 'cap', l: 'Capillary Refill' },
    { g: 'Gastrointestinal', k: 'appetite', l: 'Appetite' }, { g: 'Gastrointestinal', k: 'bowel', l: 'Bowel Sounds' }, { g: 'Gastrointestinal', k: 'nv', l: 'Nausea/Vomiting' }, { g: 'Gastrointestinal', k: 'abdomen', l: 'Abdominal Findings' },
    { g: 'Genitourinary', k: 'urination', l: 'Urination' }, { g: 'Genitourinary', k: 'urine', l: 'Urine Characteristics' },
    { g: 'Musculoskeletal', k: 'rom', l: 'ROM' }, { g: 'Musculoskeletal', k: 'strength', l: 'Strength' }, { g: 'Musculoskeletal', k: 'mMobility', l: 'Mobility' },
    { g: 'Skin', k: 'color', l: 'Color' }, { g: 'Skin', k: 'sTemp', l: 'Temperature' }, { g: 'Skin', k: 'integrity', l: 'Integrity' }, { g: 'Skin', k: 'wounds', l: 'Wounds' }] },
  notes: { title: 'Nursing Notes', perm: 'notes', cards: 1, fields: [{ k: 'date', l: 'Date', t: 'date' }, { k: 'format', l: 'Format', t: 'select', o: ['SOAP', 'DAR'] },
    { f: 'SOAP', k: 'S', l: 'Subjective (patient’s verbal complaints)', t: 'textarea' }, { f: 'SOAP', k: 'O', l: 'Objective (observable/measurable findings)', t: 'textarea' },
    { f: 'SOAP', k: 'A', l: 'Assessment (nursing assessment)', t: 'textarea' }, { f: 'SOAP', k: 'P', l: 'Plan (planned nursing interventions)', t: 'textarea' },
    { f: 'DAR', k: 'D', l: 'Data', t: 'textarea' }, { f: 'DAR', k: 'Ac', l: 'Action', t: 'textarea' }, { f: 'DAR', k: 'R', l: 'Response', t: 'textarea' }] },
  labs: { title: 'Laboratory / Test Results', perm: 'edit', fields: [{ k: 'test', l: 'Test Name' }, { k: 'date', l: 'Date', t: 'date' }, { k: 'result', l: 'Result' }, { k: 'range', l: 'Reference Range' },
    { k: 'unit', l: 'Unit' }, { k: 'remarks', l: 'Remarks' }, { k: 'provider', l: 'Ordering Provider' }] },
  immun: { title: 'Immunization', perm: 'edit', fields: [{ k: 'vaccine', l: 'Vaccine' }, { k: 'dose', l: 'Dose' }, { k: 'date', l: 'Date Administered', t: 'date' }, { k: 'lot', l: 'Lot Number' },
    { k: 'route', l: 'Route' }, { k: 'site', l: 'Site' }, { k: 'next', l: 'Next Dose', t: 'date' }, { k: 'by', l: 'Administered By' }] },
  carePlans: { title: 'Care Plan', perm: 'notes', cards: 1, fields: [{ k: 'date', l: 'Date', t: 'date' }, { k: 'assessment', l: '1. Assessment', t: 'textarea' }, { k: 'diagnosis', l: '2. Nursing Diagnosis', t: 'textarea' },
    { k: 'goals', l: '3. Goals / Expected Outcomes', t: 'textarea' }, { k: 'interventions', l: '4. Nursing Interventions', t: 'textarea' }, { k: 'rationale', l: '5. Rationale', t: 'textarea' }, { k: 'evaluation', l: '6. Evaluation', t: 'textarea' }] }
};
function describeFields(fields, values, onlyKeys) {
  const keys = onlyKeys ? new Set(onlyKeys) : null;
  return fields.filter(field => !keys || keys.has(field.k)).map(field => {
    const value = values[field.k];
    if (value == null || String(value).trim() === '') return keys ? `${field.l}: cleared` : '';
    return `${field.l}: ${String(value).trim()}`;
  }).filter(Boolean).join('; ') || 'No field values';
}
function patientDescription(values, onlyKeys) {
  const fields = [...F.patientPersonal, ...F.emergency, ...F.nurse, ...F.ident];
  return describeFields(fields, values, onlyKeys);
}
function describeRecord(key, record, p, onlyKeys) {
  if (key === 'meds') {
    const medication = [record.name, record.dose, record.freq,
      record.administrationTime && `( ${record.administrationTime} )`, record.route,
      record.prescriber].filter(Boolean).join(' ');
    if (medication) {
      if (onlyKeys) {
        const changes = describeFields(LISTS[key].fields, record, onlyKeys);
        return `Medication: ${medication}; Updated: ${changes}`;
      }
      const additional = describeFields(LISTS[key].fields.filter(field =>
        !['name', 'dose', 'freq', 'administrationTime', 'route', 'prescriber'].includes(field.k)
      ), record);
      return additional === 'No field values' ? medication : `${medication}; ${additional}`;
    }
  }
  const details = describeFields(LISTS[key].fields, record, onlyKeys);
  const physician = key === 'meds' && !record.prescriber && stripRole(p.nurseName);
  return physician ? `${details}; Attending Physician: ${physician}` : details;
}

/* ---------- Form helpers ---------- */
function inputHTML(f, val = '') {
  const attrs = `name="${f.k}" ${f.req ? 'required' : ''} ${f.ph ? `placeholder="${f.ph}"` : ''} ${f.step ? `step="${f.step}"` : ''} ${f.min != null ? `min="${f.min}"` : ''} ${f.max != null ? `max="${f.max}"` : ''}`;
  let el;
  if (f.t === 'select') el = `<select ${attrs}><option value=""></option>${f.o.map(o => `<option ${o === val ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
  else if (f.t === 'textarea') el = `<textarea ${attrs}>${esc(val)}</textarea>`;
  else el = `<input type="${f.t || 'text'}" ${attrs} value="${esc(val)}">`;
  return `<div ${f.f ? `data-f="${f.f}"` : ''}><label>${esc(f.l)}${f.req ? ' *' : ''}</label>${el}</div>`;
}
const fieldsHTML = (fields, vals = {}) => `<div class="grid">${fields.map(f => inputHTML(f, vals[f.k])).join('')}</div>`;
const readForm = form => Object.fromEntries([...new FormData(form)].map(([k, v]) => [k, v.trim()]));
const calcAge = d => { if (!d) return ''; const b = new Date(d), n = new Date(); let a = n.getFullYear() - b.getFullYear(); if (n < new Date(n.getFullYear(), b.getMonth(), b.getDate())) a--; return a; };

function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.remove('hidden'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.add('hidden'), 2500); }
function openModal(html) { const m = $('#modal'); m.innerHTML = `<div class="box">${html}</div>`; m.classList.remove('hidden'); return m; }
const closeModal = () => $('#modal').classList.add('hidden');
function bindPasswordToggle(password, toggle) {
  toggle.onclick = () => {
    const visible = password.type === 'password';
    password.type = visible ? 'text' : 'password';
    toggle.textContent = visible ? 'Hide' : 'Show';
    toggle.setAttribute('aria-label', visible ? 'Hide password' : 'Show password');
    toggle.setAttribute('aria-pressed', String(visible));
  };
}

/* ---------- Auth ---------- */
function loginView() {
  $('#app').innerHTML = `<div class="center"><div class="login">
    <img class="login-logo" src="asset/logo.png" alt="PrimeCare Medical Center">
    <p class="muted">Please sign in to continue</p>
    <form id="login-form" class="login-form">
      <div><label for="login-email">Email</label><input id="login-email" name="email" type="email" autocomplete="username" required></div>
      <div><label for="login-password">Password</label><div class="password-control"><input id="login-password" name="password" type="password" autocomplete="current-password" required><button id="toggle-password" type="button" aria-label="Show password" aria-pressed="false">Show</button></div></div>
      <button type="submit">Sign In</button>
    </form>
  </div></div>`;
  bindPasswordToggle($('#login-password'), $('#toggle-password'));
  $('#login-form').onsubmit = e => {
    e.preventDefault();
    const credentials = readForm(e.target);
    verifyLogin(credentials.email.toLowerCase(), credentials.password);
  };
}
function verifyLogin(email, password) {
  const u = state.users.find(x => x.email.toLowerCase() === email && x.password === password && x.status === 'Active');
  if (!u) {
    state.denied = email; state.user = null;
    state.audit.unshift({ time: new Date().toLocaleString(), user: email, action: 'LOGIN_DENIED', pid: '-', desc: 'Unauthorized or inactive account' }); persist();
    return deniedView();
  }
  state.patients = load('npr_patients', state.patients);
  state.audit = load('npr_audit', state.audit);
  const { password: storedPassword, ...sessionUser } = u;
  state.user = { ...sessionUser, authVersion: 2 }; save('npr_session', state.user); state.view = 'dashboard'; log('LOGIN', null, 'User signed in'); render();
}
function deniedView() {
  $('#app').innerHTML = `<div class="center"><div class="login"><h1 class="denied">Access Denied</h1>
    <p>Email or password is incorrect, or the account is inactive.</p>
    <p class="muted">Contact the Administrator for assistance.</p><button id="back">Back to Login</button></div></div>`;
  $('#back').onclick = () => { state.denied = null; loginView(); };
}
function logout() { log('LOGOUT', null, 'User signed out'); state.user = null; localStorage.removeItem('npr_session'); loginView(); }

/* ---------- Layout ---------- */
function render() {
  if (!state.user) return loginView();
  const nav = [['dashboard', 'Dashboard'], ['patients', 'Patients'], ['add', 'Add Patient']];
  if (can('audit')) nav.push(['audit', 'Audit Log']);
  if (can('users')) nav.push(['users', 'User Management']);
  $('#app').innerHTML = `<div class="layout"><nav class="side"><h2>PrimeCare Medical Center</h2>
    ${nav.map(([v, l]) => `<a data-v="${v}" class="${state.view === v || (state.view === 'profile' && v === 'patients') ? 'act' : ''}">${l}</a>`).join('')}
    <div class="userbox"><b>${esc(state.user.name)}</b><br>${esc(state.user.email)}<br><span class="badge">${state.user.role}</span><button id="lo">Logout</button></div></nav>
    <main class="main"><header class="app-brand"><img src="asset/logo.png" alt=""><h1>PrimeCare Medical Center</h1></header><div id="main"></div></main></div>`;
  document.querySelectorAll('.side a').forEach(a => a.onclick = () => { state.view = a.dataset.v; state.pid = null; if (state.view === 'add') state.editing = null; render(); });
  $('#lo').onclick = logout;
  const views = { dashboard, patients: patientsView, add: patientForm, profile: profileView, audit: auditView, users: usersView };
  const needs = { audit: 'audit', users: 'users' };
  if (needs[state.view] && !can(needs[state.view])) { $('#main').innerHTML = '<div class="card denied"><h2>Access Denied</h2>Your role has no permission for this page.</div>'; return; }
  (views[state.view] || dashboard)($('#main'));
}

/* ---------- Dashboard ---------- */
function isCritical(v) {
  const sys = parseInt(String(v.bp || '').split('/')[0]);
  return (v.spo2 !== '' && v.spo2 < 90) || (v.temp !== '' && (v.temp >= 39 || v.temp < 35)) || (v.hr !== '' && (v.hr > 130 || v.hr < 40)) || (sys && (sys >= 180 || sys < 80));
}
function dashboard(el) {
  const P = state.patients, all = k => P.flatMap(p => p[k].map(x => ({ ...x, pid: p.id })));
  const crit = P.filter(p => p.vitals.length && isCritical(p.vitals[p.vitals.length - 1])).length;
  const pending = all('labs').filter(l => !l.result).length;
  const S = [['Total Patients', P.length, ''], ["Today's Records", P.filter(p => p.createdAt === today()).length, 'grn'], ['Vital-Sign Entries', all('vitals').length, ''],
    ['Clinical Notes', all('notes').length, ''], ['Pending Results', pending, 'org'], ['Critical Alerts', crit, 'red']];
  const recent = [...P].reverse().slice(0, 5);
  el.innerHTML = `<h1>Welcome, ${esc(state.user.name)}</h1><p class="muted">Signed in as ${state.user.role}</p>
    <div class="stats">${S.map(([l, n, c]) => `<div class="stat ${c}"><b>${n}</b><span>${l}</span></div>`).join('')}</div>
    <div class="card"><h3>Recent Patients</h3>${patientTable(recent)}</div>`;
  bindRows(el);
}

/* ---------- Patients list & search ---------- */
function patientTable(list, includeDownloads = false) {
  if (!list.length) return '<p class="muted">No patients found.</p>';
  const fileColumns = includeDownloads ? '<th>Download File</th><th>Patient Discharge</th>' : '';
  return `<div class="tablewrap"><table><tr><th>Patient ID</th><th>Name</th><th>DOB</th><th>Age</th><th>Sex</th><th>Contact</th><th>Attending Physician</th>${fileColumns}</tr>
    ${list.map(p => `<tr class="click" data-id="${esc(p.id)}"><td>${esc(p.id)}</td><td>${esc(fullName(p))}</td><td>${esc(p.dob)}</td><td>${esc(p.age)}</td><td>${esc(p.sex)}</td><td>${esc(p.contact)}</td><td>${esc(stripRole(p.nurseName)) || '<span class="muted">—</span>'}</td>${includeDownloads ? `<td><button class="sm" type="button" data-download="${esc(p.id)}">Download PDF</button></td><td><button class="sm sec" type="button" data-discharge-download="${esc(p.id)}">Patient Discharge</button></td>` : ''}</tr>`).join('')}</table></div>`;
}
function bindRows(el) {
  el.querySelectorAll('tr.click').forEach(r => r.onclick = () => { state.pid = r.dataset.id; state.view = 'profile'; state.tab = 'Overview'; render(); });
  el.querySelectorAll('[data-download], [data-discharge-download]').forEach(button => button.onclick = event => {
    event.stopPropagation();
    const p = patient(button.dataset.download || button.dataset.dischargeDownload);
    if (!p) return;
    if (button.hasAttribute('data-discharge-download')) downloadDischargePdf(p);
    else downloadPatientPdf(p);
  });
}
function pdfSafeText(value) {
  return String(value ?? '').replace(/[—–]/g, '-').replace(/[·•]/g, '-')
    .replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/°/g, ' deg ')
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^\x20-\x7e]/g, '?');
}
function pdfEscape(value) {
  return pdfSafeText(value).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}
function wrapPdfLine(value, width = 88) {
  const words = pdfSafeText(value).split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  words.forEach(word => {
    if (word.length > width) {
      if (line) { lines.push(line); line = ''; }
      while (word.length > width) { lines.push(word.slice(0, width)); word = word.slice(width); }
    }
    if (line && `${line} ${word}`.length > width) { lines.push(line); line = word; }
    else line = line ? `${line} ${word}` : word;
  });
  if (line) lines.push(line);
  return lines.length ? lines : [''];
}
function pdfSection(title, lines) {
  return { title, lines: lines.length ? lines : ['No records recorded.'] };
}
function pdfFields(fields, values) {
  return fields.map(field => `${field.l}: ${values[field.k] == null || String(values[field.k]).trim() === '' ? 'Not provided' : values[field.k]}`);
}
function pdfRecordSections(key, p) {
  const config = LISTS[key], records = p[key] || [];
  if (!records.length) return [pdfSection(config.title, ['No records recorded.'])];
  return records.map((record, index) => {
    const fields = config.fields.filter(field => !field.f || field.f === record.format);
    const lines = [];
    if (record.date) lines.push(`Date: ${record.date}`);
    if (record.format) lines.push(`Format: ${record.format}`);
    if (record.by) lines.push(`Recorded by: ${record.by}`);
    lines.push(...pdfFields(fields, record));
    return pdfSection(`${config.title} - ${index + 1}`, lines);
  });
}
function downloadPdf(title, sections, fileName) {
  const pages = [];
  const pageWidth = 595, margin = 32, tableWidth = pageWidth - margin * 2;
  const labelWidth = 156, valueWidth = tableWidth - labelWidth;
  const ink = [0.12, 0.22, 0.31], blue = [0.02, 0.36, 0.66];
  const darkBlue = [0.02, 0.29, 0.54], paleBlue = [0.87, 0.94, 0.98];
  const border = [0.62, 0.75, 0.83], alternate = [0.96, 0.98, 0.99];
  let page, y;
  const text = (x, top, value, size, color, bold, maxWidth) => {
    let safe = pdfSafeText(value);
    const maxChars = Math.floor(maxWidth / (size * 0.5));
    if (safe.length > maxChars) safe = maxChars > 4 ? `${safe.slice(0, maxChars - 3)}...` : safe.slice(0, maxChars);
    page.push(`BT /${bold ? 'F2' : 'F1'} ${size} Tf ${color.join(' ')} rg ${x} ${842 - top - size} Td (${pdfEscape(safe)}) Tj ET`);
  };
  const rect = (x, top, width, height, fill, stroke = null) => {
    const bottom = 842 - top - height;
    if (fill) page.push(`${fill.join(' ')} rg`);
    if (stroke) page.push(`0.45 w ${stroke.join(' ')} RG`);
    page.push(`${x} ${bottom} ${width} ${height} re ${fill && stroke ? 'B' : fill ? 'f' : 'S'}`);
  };
  const startPage = () => {
    page = ['1 J 1 j'];
    pages.push(page);
    rect(0, 0, pageWidth, 842, [1, 1, 1]);
    text(margin, 28, title, 17, darkBlue, true, tableWidth);
    text(margin, 48, `PrimeCare Medical Center | Generated ${new Date().toLocaleString()}`, 8, ink, false, tableWidth);
    page.push(`1 w ${blue.join(' ')} RG ${margin} 783 m ${pageWidth - margin} 783 l S`);
    y = 72;
  };
  const drawSectionHeading = (heading, continued = false) => {
    rect(margin, y, tableWidth, 18, blue);
    text(margin + 7, y + 4, `${heading}${continued ? ' (continued)' : ''}`, 9, [1, 1, 1], true, tableWidth - 14);
    y += 18;
    rect(margin, y, labelWidth, 16, paleBlue, border);
    rect(margin + labelWidth, y, valueWidth, 16, paleBlue, border);
    text(margin + 6, y + 4, 'FIELD', 7, darkBlue, true, labelWidth - 12);
    text(margin + labelWidth + 6, y + 4, 'RESULT / DETAILS', 7, darkBlue, true, valueWidth - 12);
    y += 16;
  };
  const ensureRowsCanContinue = (heading, continued) => {
    startPage();
    drawSectionHeading(heading, continued);
  };

  startPage();
  sections.forEach(section => {
    if (y + 34 > 785) startPage();
    drawSectionHeading(section.title);
    const rows = section.lines.map(line => {
      const separator = line.indexOf(':');
      return separator < 0
        ? { label: 'Details', value: line }
        : { label: line.slice(0, separator).trim(), value: line.slice(separator + 1).trim() };
    });
    rows.forEach((row, rowIndex) => {
      const labelLines = wrapPdfLine(row.label, 36);
      const valueLines = wrapPdfLine(row.value, 91);
      let lineIndex = 0, firstFragment = true;
      while (lineIndex < valueLines.length) {
        const availableLines = Math.floor((785 - y - 7) / 9.5);
        if (availableLines < 1) ensureRowsCanContinue(section.title, true);
        const count = Math.max(1, Math.min(6, Math.floor((785 - y - 7) / 9.5)));
        const fragment = valueLines.slice(lineIndex, lineIndex + count);
        const rowHeight = Math.max(19, Math.max(fragment.length, firstFragment ? labelLines.length : 1) * 9.5 + 7);
        if (y + rowHeight > 785) {
          ensureRowsCanContinue(section.title, true);
          continue;
        }
        const fill = rowIndex % 2 ? alternate : [1, 1, 1];
        rect(margin, y, labelWidth, rowHeight, paleBlue, border);
        rect(margin + labelWidth, y, valueWidth, rowHeight, fill, border);
        const visibleLabelLines = firstFragment ? labelLines : [`${labelLines[0] || 'Details'} (continued)`];
        visibleLabelLines.forEach((label, index) =>
          text(margin + 6, y + 5 + index * 9.5, label, 7, darkBlue, true, labelWidth - 12));
        fragment.forEach((valueLine, index) =>
          text(margin + labelWidth + 6, y + 5 + index * 9.5, valueLine || ' ', 7, ink, false, valueWidth - 12));
        y += rowHeight;
        lineIndex += fragment.length;
        firstFragment = false;
        if (lineIndex < valueLines.length) ensureRowsCanContinue(section.title, true);
      }
    });
    y += 9;
  });
  pages.forEach((commands, index) => {
    commands.push(`0.45 w ${border.join(' ')} RG ${margin} 31 m ${pageWidth - margin} 31 l S`);
    commands.push(`BT /F1 7 Tf ${ink.join(' ')} rg ${pageWidth - margin - 40} 18 Td (Page ${index + 1} of ${pages.length}) Tj ET`);
  });
  const objects = [];
  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';
  objects[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>';
  const pageRefs = [];
  pages.forEach((commands, index) => {
    const pageId = 5 + index * 2, contentId = pageId + 1;
    pageRefs.push(`${pageId} 0 R`);
    const stream = commands.join('\n');
    objects[pageId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentId} 0 R >>`;
    objects[contentId] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  });
  objects[2] = `<< /Type /Pages /Kids [${pageRefs.join(' ')}] /Count ${pageRefs.length} >>`;
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (let id = 1; id < objects.length; id++) {
    offsets[id] = pdf.length;
    pdf += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }
  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objects.length; id++) pdf += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  const url = URL.createObjectURL(new Blob([pdf], { type: 'application/pdf' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function patientPdfSections(p) {
  const sections = [
    pdfSection('A. Patient Information', [...pdfFields(F.patientPersonal, p), ...pdfFields(F.emergency, p)]),
    pdfSection('Attending Physician', [stripRole(p.nurseName) || 'Not provided']),
    pdfSection('Identification', pdfFields(F.ident, p)),
    pdfSection('Past Medical History', pdfFields(F.pastHistory, p.pastHistory || {})),
    pdfSection('Family History', pdfFields(F.familyHistory, p.familyHistory || {})),
    pdfSection('Psychosocial', pdfFields(F.psychosocial, p.psychosocial || {}))
  ];
  Object.keys(LISTS).forEach(key => sections.push(...pdfRecordSections(key, p)));
  sections.push(...dischargePdfSections(p));
  return sections;
}
function downloadPatientPdf(p) {
  downloadPdf(`Patient Record - ${fullName(p)} (${p.id})`, patientPdfSections(p),
    `patient-${pdfSafeText(p.id)}-record.pdf`);
}
function patientsView(el) {
  el.innerHTML = `<div class="bar"><h1>Patients</h1>${can('add') ? '<button id="np">Add Patient</button>' : ''}</div>
    <div class="card"><input id="q" placeholder="Search by Patient ID, full name, date of birth (YYYY-MM-DD) or contact number" value="${esc(state.q)}"><div id="res" style="margin-top:1rem"></div></div>`;
  const run = () => {
    const q = state.q.toLowerCase().trim();
    const list = state.patients.filter(p => !q || [p.id, fullName(p), `${p.firstName} ${p.lastName}`, p.dob, p.contact].some(v => String(v || '').toLowerCase().includes(q)));
    $('#res').innerHTML = patientTable(list, true); bindRows($('#res'));
  };
  $('#q').oninput = e => { state.q = e.target.value; run(); }; run();
  if ($('#np')) $('#np').onclick = () => { state.view = 'add'; state.editing = null; render(); };
}

/* ---------- Add / Edit patient ---------- */
function patientForm(el) {
  const editing = state.editing ? patient(state.editing) : null;
  if (!editing && !can('add') || editing && !can('edit')) { el.innerHTML = '<div class="card denied">Access denied.</div>'; return; }
  const p = editing || { ...blankPatient(), id: 'PT-' + String(state.patients.reduce((m, x) => Math.max(m, parseInt(x.id.replace(/\D/g, '')) || 0), 0) + 1).padStart(4, '0') };
  el.innerHTML = `<h1>${editing ? 'Edit' : 'Add'} Patient</h1><form id="pf" class="card">
    <fieldset><legend>Personal Information</legend>${fieldsHTML(F.patientPersonal, p)}</fieldset>
    <fieldset><legend>Emergency Contact</legend>${fieldsHTML(F.emergency, p)}</fieldset>
    <fieldset><legend>Attending Physician</legend>${fieldsHTML(F.nurse, { nurseName: stripRole(p.nurseName) || state.user.name })}</fieldset>
    <fieldset><legend>Identification</legend>${fieldsHTML(F.ident, p)}</fieldset>
    <button>Save</button> <button type="button" class="sec" id="cn">Cancel</button></form>`;
  const f = $('#pf');
  if (editing) f.id.readOnly = true;
  f.dob.onchange = () => f.age.value = calcAge(f.dob.value);
  $('#cn').onclick = () => { state.view = editing ? 'profile' : 'patients'; state.pid = editing ? p.id : null; render(); };
  f.onsubmit = e => {
    e.preventDefault(); const d = readForm(f);
    d.nurseName = stripRole(d.nurseName) || state.user.name;
    if (!editing && patient(d.id)) return toast('Patient ID already exists');
    if (editing) {
      const changed = Object.keys(d).filter(k => String(p[k] ?? '') !== d[k]);
      Object.assign(p, d); log('EDIT_PATIENT', p.id, changed.length
        ? `Updated: ${patientDescription(d, changed)}`
        : 'Updated patient: no field changes');
    } else {
      Object.assign(p, d, { createdAt: today() });
      state.patients.push(p);
      log('ADD_PATIENT', p.id, `Registered ${fullName(p)}; ${patientDescription(p)}`);
    }
    persist(); toast('Patient saved'); state.view = 'profile'; state.pid = p.id; state.tab = 'Overview'; render();
  };
}

/* ---------- Patient profile ---------- */
const TABS = ['Overview', 'History', 'Vitals', 'Assessment', 'Medications', 'Labs', 'Notes', 'Care Plan', 'Immunization', 'Psychosocial', 'Discharge'];
const DISCHARGE_MED_FIELDS = [
  { k: 'medicationName', l: 'Medication Name', req: 1 }, { k: 'dosage', l: 'Dosage' }, { k: 'route', l: 'Route' },
  { k: 'frequency', l: 'Frequency' }, { k: 'duration', l: 'Duration' }
];
const DISCHARGE_SECTIONS = [
  { title: 'Facility Details', fields: [{ k: 'hospitalName', l: 'Hospital Name' }, { k: 'hospitalAddress', l: 'Address' }, { k: 'hospitalContact', l: 'Contact Number' }] },
  { title: 'A. Patient Information', fields: [
    { k: 'roomBed', l: 'Room / Bed Number' }, { k: 'attendingPhysician', l: 'Attending Physician' },
    { k: 'admissionDate', l: 'Admission Date', t: 'date' }, { k: 'dischargeDate', l: 'Discharge Date', t: 'date' },
    { k: 'dischargeTime', l: 'Discharge Time', t: 'time' }
  ] },
  { title: 'B. Discharge Information', fields: [
    { k: 'finalDiagnosis', l: 'Final Diagnosis', t: 'textarea' },
    { k: 'typeOfDischarge', l: 'Type of Discharge', t: 'select', o: ['Routine', 'Against Medical Advice', 'Transfer', 'Expired', 'Other'] },
    { k: 'dischargeCondition', l: 'Discharge Condition', t: 'textarea' }, { k: 'disposition', l: 'Disposition / Destination' },
    { k: 'reasonForDischarge', l: 'Reason for Discharge', t: 'textarea' }
  ] },
  { title: 'C. Summary of Hospitalization', fields: [
    { k: 'chiefComplaint', l: 'Chief Complaint', t: 'textarea' }, { k: 'significantFindings', l: 'Significant Findings', t: 'textarea' },
    { k: 'treatmentsProvided', l: 'Treatment and Procedures Provided', t: 'textarea' }, { k: 'responseToTreatment', l: "Patient's Response to Treatment", t: 'textarea' }
  ] },
  { title: 'E. Discharge Instructions', fields: [
    { k: 'dietInstructions', l: 'Diet Instructions', t: 'textarea' }, { k: 'activityRestrictions', l: 'Activity Restrictions', t: 'textarea' },
    { k: 'woundCareInstructions', l: 'Wound Care Instructions', t: 'textarea' }, { k: 'homeCareInstructions', l: 'Home Care Instructions', t: 'textarea' },
    { k: 'followUpAppointment', l: 'Follow-up Appointment', t: 'textarea' }, { k: 'laboratoryTestsNeeded', l: 'Laboratory Tests / Procedures Needed', t: 'textarea' }
  ] },
  { title: 'F. Warning Signs and Precautions', fields: [
    { k: 'warningSigns', l: 'Symptoms Requiring Immediate Medical Attention', t: 'textarea' }
  ] },
  { title: 'G. Discharge Checklist', fields: [
    { k: 'physicianOrderVerified', l: "Physician's discharge order verified", t: 'select', o: OPT.yn },
    { k: 'dischargeSummaryCompleted', l: 'Discharge summary completed', t: 'select', o: OPT.yn },
    { k: 'medicationReconciliation', l: 'Medication reconciliation completed', t: 'select', o: OPT.yn },
    { k: 'dischargeInstructionsExplained', l: 'Discharge instructions explained', t: 'select', o: OPT.yn },
    { k: 'followUpAppointmentDiscussed', l: 'Follow-up appointment discussed', t: 'select', o: OPT.yn },
    { k: 'patientCaregiverUnderstanding', l: 'Patient / caregiver understanding confirmed', t: 'select', o: OPT.yn },
    { k: 'personalBelongingsReturned', l: 'Personal belongings returned', t: 'select', o: OPT.yn },
    { k: 'requiredDocumentsProvided', l: 'Required documents provided', t: 'select', o: OPT.yn },
    { k: 'patientDepartureDocumented', l: 'Patient departure documented', t: 'select', o: OPT.yn }
  ] },
  { title: 'H. Acknowledgment', fields: [
    { k: 'acknowledgmentExplained', l: 'Discharge instructions explained and understood', t: 'select', o: OPT.yn },
    { k: 'patientRepresentativeName', l: 'Patient / Authorized Representative' }, { k: 'patientRepresentativeSignature', l: 'Signature / Name' },
    { k: 'patientAcknowledgmentDate', l: 'Date', t: 'date' }, { k: 'patientAcknowledgmentTime', l: 'Time', t: 'time' }
  ] },
  { title: 'I. Healthcare Professional Details', fields: [
    { k: 'dischargingPhysician', l: 'Discharging Physician' }, { k: 'physicianSignature', l: 'Physician Signature / Name' },
    { k: 'dischargingNurse', l: 'Discharging Nurse' }, { k: 'nurseSignature', l: 'Nurse Signature / Name' },
    { k: 'pharmacist', l: 'Pharmacist' }, { k: 'dischargeNurseDate', l: 'Date / Time of Discharge Completion' }
  ] }
];
const DISCHARGE_FIELDS = DISCHARGE_SECTIONS.flatMap(section => section.fields);
function normalizeDischarge(p) {
  const discharge = { ...(p.discharge || {}) };
  if (!discharge.finalDiagnosis) discharge.finalDiagnosis = discharge.diagnosis || '';
  if (!discharge.dischargeCondition) discharge.dischargeCondition = discharge.condition || '';
  if (!discharge.homeCareInstructions) discharge.homeCareInstructions = discharge.instructions || '';
  if (!discharge.followUpAppointment) discharge.followUpAppointment = discharge.followUp || '';
  if (!discharge.dischargeDate) discharge.dischargeDate = discharge.date || '';
  if (!discharge.attendingPhysician) discharge.attendingPhysician = stripRole(p.nurseName);
  if (!discharge.dischargingPhysician) discharge.dischargingPhysician = stripRole(p.nurseName);
  if (!Array.isArray(discharge.medications)) discharge.medications = [];
  return discharge;
}
function dischargePdfSections(p) {
  const discharge = normalizeDischarge(p);
  const patientInfo = [
    `Patient Record ID: ${p.id || 'Not provided'}`,
    `Full Name: ${fullName(p) || 'Not provided'}`,
    ...pdfFields(F.patientPersonal.filter(field => ['dob', 'age', 'sex'].includes(field.k)), p),
    ...pdfFields(DISCHARGE_SECTIONS[1].fields, discharge)
  ];
  const sections = [
    pdfSection('Facility Details', pdfFields(DISCHARGE_SECTIONS[0].fields, discharge)),
    pdfSection('A. Patient Information', patientInfo),
    ...DISCHARGE_SECTIONS.slice(2, 4).map(section =>
      pdfSection(section.title, pdfFields(section.fields, discharge))),
    pdfSection('D. Medications Upon Discharge', discharge.medications.length
      ? discharge.medications.flatMap((medication, index) => [
        `Medication ${index + 1}`,
        ...pdfFields(DISCHARGE_MED_FIELDS, medication)
      ]) : ['No discharge medications recorded.']),
    ...DISCHARGE_SECTIONS.slice(4).map(section =>
      pdfSection(section.title, pdfFields(section.fields, discharge))),
    pdfSection('J. EHR System Record', [
      `Discharge Record ID: ${discharge.recordId || `DIS-${p.id}`}`,
      `Recorded By (User Email): ${discharge.recordedBy || 'Not provided'}`,
      `Date / Time Created: ${discharge.createdAt || 'Not provided'}`,
      `Last Updated By: ${discharge.lastUpdatedBy || 'Not provided'}`,
      `Date / Time Last Updated: ${discharge.lastUpdatedAt || 'Not provided'}`,
      `Discharge Status: ${discharge.dischargeStatus || 'Draft'}`
    ])
  ];
  return sections;
}
function downloadDischargePdf(p) {
  const discharge = normalizeDischarge(p);
  const blue = [0.02, 0.36, 0.66], paleBlue = [0.87, 0.94, 0.98], darkBlue = [0.02, 0.29, 0.54];
  const teal = [0.05, 0.58, 0.52], ink = [0.12, 0.22, 0.31], lineBlue = [0.20, 0.48, 0.72];
  const commands = [];
  const pdfY = top => 842 - top;
  const rect = (x, top, width, height, fill, stroke = null, lineWidth = 0.6) => {
    const y = 842 - top - height;
    if (fill) commands.push(`${fill.join(' ')} rg`);
    if (stroke) commands.push(`${lineWidth} w ${stroke.join(' ')} RG`);
    commands.push(`${x} ${y} ${width} ${height} re ${fill && stroke ? 'B' : fill ? 'f' : 'S'}`);
  };
  const line = (x1, top1, x2, top2, color = lineBlue, width = 0.45) =>
    commands.push(`${width} w ${color.join(' ')} RG ${x1} ${pdfY(top1)} m ${x2} ${pdfY(top2)} l S`);
  const text = (x, top, value, size = 6.4, color = ink, bold = false, maxWidth = Infinity) => {
    let safe = pdfSafeText(value);
    const maxChars = Math.floor(maxWidth / (size * 0.49));
    if (safe.length > maxChars) safe = maxChars > 4 ? `${safe.slice(0, maxChars - 3)}...` : safe.slice(0, maxChars);
    commands.push(`BT /${bold ? 'F2' : 'F1'} ${size} Tf ${color.join(' ')} rg ${x} ${pdfY(top) - size} Td (${pdfEscape(safe)}) Tj ET`);
  };
  const box = (x, top, width, height, title) => {
    rect(x, top, width, height, [1, 1, 1], lineBlue, 0.65);
    rect(x + 0.5, top + 0.5, width - 1, 12.5, paleBlue);
    text(x + 5, top + 3, title.toUpperCase(), 7.1, darkBlue, true);
  };
  const field = (x, top, width, label, value, options = {}) => {
    const size = options.size || 6.1;
    const labelWidth = label ? Math.min(width * 0.58, Math.max(34, label.length * size * 0.53 + 7)) : 0;
    if (label) {
      text(x, top, label, size, ink, false, labelWidth - 7);
      text(x + labelWidth - 5, top, ':', size, ink);
    }
    const valueX = x + labelWidth + (label ? 1 : 0);
    const valueWidth = width - labelWidth - (label ? 3 : 0);
    const lines = options.lines || 1;
    const content = String(value ?? '').trim();
    const maxChars = Math.max(4, Math.floor(valueWidth / (size * 0.49)));
    const wrapped = content ? wrapTextByLength(content, maxChars) : [];
    for (let index = 0; index < lines; index++) {
      const currentTop = top + index * 7.5;
      if (wrapped[index]) text(valueX, currentTop, wrapped[index], size, ink, false, valueWidth);
      line(valueX, currentTop + 8.6, x + width, currentTop + 8.6, [0.42, 0.64, 0.79], 0.35);
    }
  };
  const twoColumns = (top, leftFields, rightFields, rowStep, rowLines = 1) => {
    leftFields.forEach((item, index) => field(34, top + index * rowStep, 255, item[0], item[1], { lines: rowLines }));
    rightFields.forEach((item, index) => field(306, top + index * rowStep, 252, item[0], item[1], { lines: rowLines }));
  };
  const patientFields = [
    ['Patient Record ID', p.id],
    ['Full Name', fullName(p)],
    ['Date of Birth', p.dob],
    ['Age', p.age],
    ['Sex', p.sex]
  ];
  const patientInfoRight = [
    ['Room / Bed Number', discharge.roomBed],
    ['Attending Physician', discharge.attendingPhysician || stripRole(p.nurseName)],
    ['Admission Date', discharge.admissionDate],
    ['Discharge Date', discharge.dischargeDate],
    ['Discharge Time', discharge.dischargeTime]
  ];

  commands.push('1 J 1 j');
  rect(0, 0, 595, 842, [1, 1, 1]);
  // Compact vector wordmark keeps the downloaded form self-contained.
  rect(28, 21, 25, 8, blue);
  rect(36.5, 12.5, 8, 25, blue);
  commands.push(`2.1 w ${teal.join(' ')} RG 30 807 m 37 798 l 43 804 l 51 794 l S`);
  text(60, 17, 'Prime', 19, darkBlue, true);
  text(106, 17, 'Care', 19, teal, true);
  text(61, 39, 'M E D I C A L   C E N T E R', 7.4, darkBlue, true);
  text(61, 50, 'Excellence in Care, Commitment to Life.', 5.7, teal, false);
  field(392, 19, 170, 'Hospital Name', discharge.hospitalName, { size: 5.7 });
  field(392, 33, 170, 'Address', discharge.hospitalAddress, { size: 5.7 });
  field(392, 47, 170, 'Contact No.', discharge.hospitalContact, { size: 5.7 });
  line(27, 65, 568, 65, teal, 1.1);
  rect(27, 70, 541, 24, blue);
  text(190, 75, 'PATIENT DISCHARGE FORM', 15, [1, 1, 1], true, 220);

  box(27, 99, 541, 84, 'A. Patient Information');
  line(298, 113, 298, 179);
  patientFields.forEach((item, index) => field(34, 116 + index * 12.1, 255, item[0], item[1]));
  patientInfoRight.forEach((item, index) => field(306, 116 + index * 12.1, 252, item[0], item[1]));

  box(27, 187, 541, 62, 'B. Discharge Information');
  line(298, 201, 298, 245);
  twoColumns(204,
    [['Final Diagnosis', discharge.finalDiagnosis], ['Type of Discharge', discharge.typeOfDischarge], ['Discharge Condition', discharge.dischargeCondition]],
    [['Disposition / Destination', discharge.disposition], ['Reason for Discharge', discharge.reasonForDischarge]],
    13.3);

  box(27, 253, 541, 96, 'C. Summary of Hospitalization');
  line(298, 267, 298, 345);
  twoColumns(271,
    [['Chief Complaint', discharge.chiefComplaint], ['Final Diagnosis', discharge.finalDiagnosis], ['Significant Findings', discharge.significantFindings]],
    [['Treatment and Procedures Provided', discharge.treatmentsProvided], ["Patient's Response to Treatment", discharge.responseToTreatment]],
    24, 2);

  box(27, 353, 541, 77, 'D. Medications Upon Discharge');
  const medicationColumns = [
    { key: 'medicationName', label: 'Medication Name', width: 174 },
    { key: 'dosage', label: 'Dosage', width: 91 },
    { key: 'route', label: 'Route', width: 91 },
    { key: 'frequency', label: 'Frequency', width: 103 },
    { key: 'duration', label: 'Duration', width: 74 }
  ];
  let columnX = 31;
  medicationColumns.forEach(column => {
    rect(columnX, 369, column.width, 13, paleBlue, lineBlue, 0.4);
    text(columnX + 3, 372, column.label, 6, darkBlue, true, column.width - 6);
    columnX += column.width;
  });
  for (let row = 0; row < 3; row++) {
    const medication = discharge.medications[row] || {};
    let x = 31;
    medicationColumns.forEach(column => {
      rect(x, 382 + row * 14, column.width, 14, null, lineBlue, 0.35);
      text(x + 3, 385 + row * 14, medication[column.key] || '', 5.9, ink, false, column.width - 6);
      x += column.width;
    });
  }

  box(27, 434, 541, 81, 'E. Discharge Instructions');
  line(298, 448, 298, 512);
  twoColumns(452,
    [['Diet Instructions', discharge.dietInstructions], ['Activity Restrictions', discharge.activityRestrictions], ['Wound Care Instructions', discharge.woundCareInstructions]],
    [['Home Care Instructions', discharge.homeCareInstructions], ['Follow-up Appointment', discharge.followUpAppointment], ['Laboratory Tests / Procedures Needed', discharge.laboratoryTestsNeeded]],
    18, 1);

  box(27, 519, 541, 51, 'F. Warning Signs and Precautions');
  text(34, 536, 'Instructions regarding symptoms requiring immediate medical attention:', 5.7, ink, true);
  field(34, 546, 527, '', discharge.warningSigns, { size: 6, lines: 2 });

  box(27, 574, 262, 141, 'G. Discharge Checklist');
  const checklistLabels = [
    ["Physician's discharge order verified", discharge.physicianOrderVerified],
    ['Discharge summary completed', discharge.dischargeSummaryCompleted],
    ['Medication reconciliation completed', discharge.medicationReconciliation],
    ['Discharge instructions explained', discharge.dischargeInstructionsExplained],
    ['Follow-up appointment discussed', discharge.followUpAppointmentDiscussed],
    ['Patient / caregiver understanding confirmed', discharge.patientCaregiverUnderstanding],
    ['Personal belongings returned', discharge.personalBelongingsReturned],
    ['Required documents provided', discharge.requiredDocumentsProvided],
    ['Patient departure documented', discharge.patientDepartureDocumented]
  ];
  checklistLabels.forEach((item, index) => {
    const y = 590 + index * 12.2;
    rect(35, y + 1, 6.5, 6.5, null, lineBlue, 0.55);
    if (item[1] === 'Yes') {
      line(36.2, y + 4.6, 38, y + 6.2, teal, 1);
      line(38, y + 6.2, 41.5, y + 1.4, teal, 1);
    } else if (item[1] === 'No') {
      text(35.6, y, 'x', 7, teal, true);
    }
    text(46, y, item[0], 5.4, ink, false, 236);
  });

  box(295, 574, 273, 141, 'H. Acknowledgment');
  text(302, 590, 'I acknowledge that the discharge instructions have been explained', 5.1, ink, false, 255);
  text(302, 597, 'to me, including medications, home care, follow-up appointments,', 5.1, ink, false, 255);
  text(302, 604, 'and warning signs.', 5.1, ink, false, 255);
  field(302, 614, 255, 'Patient / Authorized Representative', discharge.patientRepresentativeName, { size: 5.4 });
  field(302, 623, 255, 'Signature / Name', discharge.patientRepresentativeSignature, { size: 5.4 });
  field(302, 632, 125, 'Date', discharge.patientAcknowledgmentDate, { size: 5.4 });
  field(433, 632, 124, 'Time', discharge.patientAcknowledgmentTime, { size: 5.4 });

  rect(295, 644, 273, 71, [1, 1, 1], lineBlue, 0.55);
  rect(295.5, 644.5, 272, 11, paleBlue);
  text(300, 646, 'I. HEALTHCARE PROFESSIONAL DETAILS', 6.2, darkBlue, true);
  field(302, 659, 255, 'Discharging Physician', discharge.dischargingPhysician, { size: 5.3 });
  field(302, 667, 255, 'Physician Signature', discharge.physicianSignature, { size: 5.3 });
  field(302, 675, 255, 'Discharging Nurse', discharge.dischargingNurse, { size: 5.3 });
  field(302, 683, 255, 'Nurse Signature', discharge.nurseSignature, { size: 5.3 });
  field(302, 691, 255, 'Pharmacist', discharge.pharmacist, { size: 5.3 });
  field(302, 699, 255, 'Date / Time of Discharge Completion', discharge.dischargeNurseDate, { size: 5.3 });

  box(27, 719, 541, 75, 'J. EHR System Record');
  field(34, 738, 255, 'Discharge Record ID', discharge.recordId || `DIS-${p.id}`, { size: 5.8 });
  field(34, 753, 255, 'Recorded By (User Email)', discharge.recordedBy, { size: 5.8 });
  field(34, 768, 255, 'Date / Time Created', discharge.createdAt, { size: 5.8 });
  field(306, 738, 252, 'Last Updated By', discharge.lastUpdatedBy, { size: 5.8 });
  field(306, 753, 252, 'Date / Time Last Updated', discharge.lastUpdatedAt, { size: 5.8 });
  field(306, 768, 252, 'Discharge Status', discharge.dischargeStatus || 'Draft', { size: 5.8 });

  commands.push(`2.2 w ${teal.join(' ')} RG 27 ${pdfY(822)} m 100 ${pdfY(830)} 190 ${pdfY(830)} 270 ${pdfY(827)} c 370 ${pdfY(819)} 460 ${pdfY(819)} 568 ${pdfY(823)} c S`);
  const streams = [commands.join('\n')];
  if (discharge.medications.length > 3) {
    const overflow = discharge.medications.slice(3);
    for (let offset = 0; offset < overflow.length; offset += 38) {
      commands.length = 0;
      text(32, 27, 'PATIENT DISCHARGE FORM', 15, darkBlue, true);
      text(32, 49, `${fullName(p)} | Patient ID: ${p.id} | Additional discharge medications`, 8, ink, false);
      rect(27, 68, 541, 16, blue);
      text(34, 72, 'D. MEDICATIONS UPON DISCHARGE - CONTINUED', 8, [1, 1, 1], true);
      const headings = ['Medication Name', 'Dosage', 'Route', 'Frequency', 'Duration'];
      const columnWidths = [174, 91, 91, 103, 74];
      let x = 31;
      headings.forEach((heading, index) => {
        rect(x, 87, columnWidths[index], 15, paleBlue, lineBlue, 0.4);
        text(x + 3, 91, heading, 6, darkBlue, true, columnWidths[index] - 6);
        x += columnWidths[index];
      });
      overflow.slice(offset, offset + 38).forEach((medication, index) => {
        let column = 0, rowX = 31, rowTop = 102 + index * 17;
        medicationColumns.forEach(item => {
          rect(rowX, rowTop, item.width, 17, null, lineBlue, 0.35);
          text(rowX + 3, rowTop + 4, medication[item.key] || '', 6, ink, false, item.width - 6);
          rowX += item.width;
          column++;
        });
      });
      text(32, 810, `Patient discharge record | ${p.id}`, 6, ink, false);
      streams.push(commands.join('\n'));
    }
  }
  const objects = [];
  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';
  objects[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>';
  const pageRefs = [];
  streams.forEach((stream, index) => {
    const pageId = 5 + index * 2, contentId = pageId + 1;
    pageRefs.push(`${pageId} 0 R`);
    objects[pageId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentId} 0 R >>`;
    objects[contentId] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  });
  objects[2] = `<< /Type /Pages /Kids [${pageRefs.join(' ')}] /Count ${pageRefs.length} >>`;
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (let id = 1; id < objects.length; id++) {
    offsets[id] = pdf.length;
    pdf += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }
  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objects.length; id++) pdf += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  const url = URL.createObjectURL(new Blob([pdf], { type: 'application/pdf' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `patient-${pdfSafeText(p.id)}-discharge.pdf`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function wrapTextByLength(value, maxLength) {
  const words = pdfSafeText(value).split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  words.forEach(word => {
    if (line && `${line} ${word}`.length > maxLength) {
      lines.push(line);
      line = word;
    } else line = line ? `${line} ${word}` : word;
  });
  if (line) lines.push(line);
  return lines;
}
function profileView(el) {
  const p = patient(state.pid); if (!p) { state.view = 'patients'; return render(); }
  el.innerHTML = `<div class="bar"><div><h1>${esc(fullName(p))}</h1><span class="badge">${esc(p.id)}</span> <span class="muted">${esc(p.sex)} · ${esc(p.age)} yrs</span></div>
    <div class="actions">${can('edit') ? '<button id="ed">Edit</button>' : ''}${can('delete') ? '<button id="del" class="danger">Delete</button>' : ''}<button class="sec" id="bk">Back</button></div></div>
    <div class="actions" style="margin-bottom:1rem"><button type="button" class="sec" id="download-patient-discharge">Patient Discharge PDF</button></div>
    <div class="tabs">${TABS.map(t => `<button data-t="${t}" class="${t === state.tab ? 'act' : ''}">${t}</button>`).join('')}</div><div id="tab"></div>`;
  $('#bk').onclick = () => { state.view = 'patients'; render(); };
  $('#download-patient-discharge').onclick = () => downloadDischargePdf(p);
  if ($('#ed')) $('#ed').onclick = () => { state.editing = p.id; state.view = 'add'; render(); };
  if ($('#del')) $('#del').onclick = () => deletePatient(p);
  el.querySelectorAll('.tabs button').forEach(b => b.onclick = () => { state.tab = b.dataset.t; profileView(el); });
  const t = $('#tab');
  ({ Overview: overviewTab, History: historyTab, Vitals: () => listSection(t, p, 'vitals'), Assessment: () => listSection(t, p, 'assessments'), Medications: () => listSection(t, p, 'meds'),
    Labs: () => listSection(t, p, 'labs'), Notes: () => listSection(t, p, 'notes'), 'Care Plan': () => listSection(t, p, 'carePlans'), Immunization: () => listSection(t, p, 'immun'),
    Psychosocial: () => singleForm(t, p, 'psychosocial', 'Psychosocial Information', 'edit'), Discharge: () => dischargeTab(t, p) }[state.tab])(t, p);
}
function dischargeTab(t, p) {
  const discharge = normalizeDischarge(p);
  const patientFields = [
    { k: 'id', l: 'Patient Record ID' }, { k: 'fullName', l: 'Full Name' },
    { k: 'dob', l: 'Date of Birth' }, { k: 'age', l: 'Age' }, { k: 'sex', l: 'Sex' }
  ];
  const identity = { ...p, fullName: fullName(p) };
  const fields = DISCHARGE_SECTIONS.map(section =>
    `<fieldset><legend>${esc(section.title)}</legend>${fieldsHTML(section.fields, discharge)}</fieldset>`).join('');
  const medications = discharge.medications.length
    ? `<div class="tablewrap"><table><tr>${DISCHARGE_MED_FIELDS.map(field => `<th>${esc(field.l)}</th>`).join('')}<th></th></tr>
      ${discharge.medications.map((medication, index) => `<tr>${DISCHARGE_MED_FIELDS.map(field => `<td>${esc(medication[field.k])}</td>`).join('')}
        <td>${can('edit') ? `<button type="button" class="sm danger" data-remove-discharge-med="${index}">Remove</button>` : ''}</td></tr>`).join('')}</table></div>`
    : '<p class="muted">No discharge medications recorded.</p>';
  t.innerHTML = `<div class="card"><div class="bar"><h3>Patient Discharge</h3><button type="button" class="sec" id="download-discharge">Download Patient Discharge PDF</button></div>
    <p class="muted">Complete the discharge information and save it before downloading the discharge form.</p>
    <fieldset><legend>A. Patient Information</legend>${kv(patientFields, identity)}</fieldset>
    ${can('edit') ? `<form id="discharge-form">${fields}<p><button>Save Discharge Details</button></p></form>` :
      DISCHARGE_SECTIONS.map(section => `<fieldset><legend>${esc(section.title)}</legend>${kv(section.fields, discharge)}</fieldset>`).join('')}
    <fieldset><legend>D. Medications Upon Discharge</legend>${medications}${can('edit') ? '<button type="button" id="add-discharge-med">Add Medication</button>' : ''}</fieldset>
    <fieldset><legend>J. EHR System Record</legend>${kv([
      { k: 'recordId', l: 'Discharge Record ID' }, { k: 'recordedBy', l: 'Recorded By (User Email)' },
      { k: 'createdAt', l: 'Date / Time Created' }, { k: 'lastUpdatedBy', l: 'Last Updated By' },
      { k: 'lastUpdatedAt', l: 'Date / Time Last Updated' }, { k: 'dischargeStatus', l: 'Discharge Status' }
    ], { ...discharge, recordId: discharge.recordId || `DIS-${p.id}`, dischargeStatus: discharge.dischargeStatus || 'Draft' })}</fieldset>
    </div>`;
  $('#download-discharge', t).onclick = () => downloadDischargePdf(p);
  t.querySelectorAll('[data-remove-discharge-med]').forEach(button => button.onclick = () => {
    const index = Number(button.dataset.removeDischargeMed);
    const medication = discharge.medications[index];
    if (!medication || !confirm(`Remove ${medication.medicationName} from discharge medications?`)) return;
    discharge.medications.splice(index, 1);
    p.discharge = discharge;
    log('REMOVE_DISCHARGE_MEDICATION', p.id, `Removed discharge medication: ${describeFields(DISCHARGE_MED_FIELDS, medication)}`);
    persist();
    dischargeTab(t, p);
  });
  const addMedication = $('#add-discharge-med', t);
  if (addMedication) addMedication.onclick = () => addDischargeMedication(p, () => dischargeTab(t, p));
  const form = $('#discharge-form', t);
  if (!form) return;
  form.onsubmit = event => {
    event.preventDefault();
    const updated = { ...discharge, ...readForm(form) };
    const changed = DISCHARGE_FIELDS.filter(field =>
      String(discharge[field.k] ?? '') !== String(updated[field.k] ?? '')
    ).map(field => field.k);
    const now = new Date().toLocaleString();
    updated.recordId = discharge.recordId || `DIS-${p.id}`;
    updated.recordedBy = discharge.recordedBy || state.user.email;
    updated.createdAt = discharge.createdAt || now;
    updated.lastUpdatedBy = state.user.email;
    updated.lastUpdatedAt = now;
    updated.dischargeStatus = updated.dischargeDate ? 'Completed' : 'Draft';
    p.discharge = updated;
    log('UPDATE_DISCHARGE', p.id, changed.length
      ? `Saved discharge details: ${describeFields(DISCHARGE_FIELDS, updated, changed)}`
      : 'Saved discharge details: no field changes');
    persist();
    toast('Discharge details saved');
    dischargeTab(t, p);
  };
}
function addDischargeMedication(p, done) {
  const m = openModal(`<h2>Add Discharge Medication</h2><form id="discharge-med-form">${fieldsHTML(DISCHARGE_MED_FIELDS)}
    <p><button>Save Medication</button> <button type="button" class="sec" id="cancel-discharge-med">Cancel</button></p></form>`);
  $('#cancel-discharge-med', m).onclick = closeModal;
  $('#discharge-med-form', m).onsubmit = event => {
    event.preventDefault();
    const medication = readForm(event.target);
    const discharge = normalizeDischarge(p);
    discharge.medications.push(medication);
    p.discharge = discharge;
    log('ADD_DISCHARGE_MEDICATION', p.id, `Added discharge medication: ${describeFields(DISCHARGE_MED_FIELDS, medication)}`);
    persist();
    closeModal();
    done();
  };
}
const kv = (fields, o) => `<div class="kv">${fields.map(f => `<div><small>${esc(f.l)}</small>${esc(o[f.k]) || '<span class="muted">—</span>'}</div>`).join('')}</div>`;
function overviewTab(t, p) {
  const v = p.vitals[p.vitals.length - 1];
  t.innerHTML = `<div class="card"><h3>Personal Information</h3>${kv(F.patientPersonal, p)}</div>
    <div class="card"><h3>Emergency Contact</h3>${kv(F.emergency, p)}</div><div class="card"><h3>Attending Physician</h3>${kv(F.nurse, { ...p, nurseName: stripRole(p.nurseName) })}</div><div class="card"><h3>Identification</h3>${kv(F.ident, p)}</div>
    <div class="card"><h3>Latest Vitals ${v && isCritical(v) ? '<span class="badge red">CRITICAL</span>' : ''}</h3>${v ? `${kv(LISTS.vitals.fields.filter(field => field.k !== 'complaint'), v)}${v.complaint ? `<div class="chief-complaint"><b>Chief Complaint</b><p>${esc(v.complaint)}</p></div>` : ''}` : '<p class="muted">No vitals recorded.</p>'}</div>
    <div class="card"><h3>Allergies</h3>${p.allergies.length ? p.allergies.map(a => `<span class="badge red">${esc(a.type)}: ${esc(a.allergen)}</span> `).join('') : '<span class="muted">None recorded</span>'}</div>
    <h2>Patient Records</h2>
    <div class="card"><h3>History</h3>
      ${overviewSubsection('Past Medical History', overviewObject(F.pastHistory, p.pastHistory))}
      ${overviewSubsection('Surgical History', overviewRecords(p, 'surgical'))}
      ${overviewSubsection('Family History', overviewObject(F.familyHistory, p.familyHistory))}
      ${overviewSubsection('Allergies', overviewRecords(p, 'allergies'))}
    </div>
    ${['vitals', 'assessments', 'meds', 'labs', 'notes', 'carePlans', 'immun'].map(key => overviewRecordSection(p, key)).join('')}
    <div class="card"><h3>Psychosocial</h3>${overviewObject(F.psychosocial, p.psychosocial)}</div>`;
}
function overviewSubsection(title, content) {
  return `<div class="overview-subsection"><h4>${esc(title)}</h4>${content}</div>`;
}
function overviewObject(fields, values) {
  const filled = fields.filter(field => values[field.k] != null && String(values[field.k]).trim() !== '');
  return filled.length ? kv(filled, values) : '<p class="muted">No records yet.</p>';
}
function overviewRecordSection(p, key) {
  const c = LISTS[key];
  return `<div class="card"><h3>${esc(c.title)}</h3>${overviewRecords(p, key)}</div>`;
}
function overviewRecords(p, key) {
  const c = LISTS[key], rows = p[key];
  if (!rows.length) return '<p class="muted">No records yet.</p>';
  return rows.map(record => {
    const fields = c.fields.filter(field =>
      field.k !== 'date' && field.k !== 'format' && field.k !== 'complaint' &&
      (!field.f || field.f === record.format) &&
      record[field.k] != null && String(record[field.k]).trim() !== ''
    );
    const groups = [...new Set(fields.map(field => field.g || ''))];
    const details = groups.map(group => {
      const groupedFields = fields.filter(field => (field.g || '') === group);
      return `${group ? `<h5>${esc(group)}</h5>` : ''}${kv(groupedFields, record)}`;
    }).join('');
    const metadata = [record.date, record.format, record.by && `by ${record.by}`].filter(Boolean).map(esc).join(' · ');
    const complaint = key === 'vitals' && record.complaint
      ? `<div class="chief-complaint"><b>Chief Complaint</b><p>${esc(record.complaint)}</p></div>` : '';
    return `<div class="overview-record">${metadata ? `<p class="muted">${metadata}</p>` : ''}${details || '<p class="muted">No details recorded.</p>'}${complaint}</div>`;
  }).join('');
}
function historyTab(t, p) {
  t.innerHTML = '<div id="h1"></div><div id="h2"></div><div id="h3"></div><div id="h4"></div>';
  singleForm($('#h1'), p, 'pastHistory', 'Past Medical History', 'edit');
  listSection($('#h2'), p, 'surgical');
  singleForm($('#h3'), p, 'familyHistory', 'Family History', 'edit');
  listSection($('#h4'), p, 'allergies');
}
function singleForm(t, p, key, title, perm) {
  const hasValues = Object.values(p[key]).some(value => String(value || '').trim());
  // Non-admins may fill an empty section once; only the admin can change or delete saved content.
  const ro = !can(perm) || (hasValues && !can('modify'));
  t.innerHTML = `<form class="card"><h3>${title}</h3>${fieldsHTML(F[key], p[key])}${ro ? '' : `<p><button>Save</button>${hasValues ? ' <button type="button" class="danger" id="clear-section">Delete</button>' : ''}</p>`}</form>`;
  if (ro) t.querySelectorAll('input,select,textarea').forEach(e => e.disabled = true);
  t.querySelector('form').onsubmit = e => {
    e.preventDefault();
    if (ro) return;
    const updated = readForm(e.target);
    const changed = F[key].filter(field => String(p[key][field.k] ?? '') !== String(updated[field.k] ?? ''));
    p[key] = updated;
    log('UPDATE_' + key.toUpperCase(), p.id, changed.length
      ? `${title}: ${describeFields(F[key], updated, changed.map(field => field.k))}`
      : `${title}: no field changes`);
    persist(); toast('Saved');
    if (key === 'psychosocial') profileView($('#main')); else historyTab($('#tab'), p);
  };
  const clear = t.querySelector('#clear-section');
  if (clear) clear.onclick = () => {
    if (!confirm(`Delete all ${title.toLowerCase()} information?`)) return;
    const deleted = describeFields(F[key], p[key]);
    p[key] = Object.fromEntries(F[key].map(field => [field.k, '']));
    log('DELETE_' + key.toUpperCase(), p.id, `Deleted ${title}: ${deleted}`);
    persist();
    toast('Deleted');
    if (key === 'psychosocial') profileView($('#main'));
    else historyTab($('#tab'), p);
  };
}
function listSection(t, p, key) {
  const c = LISTS[key], rows = p[key];
  let body;
  if (!rows.length) body = '<p class="muted">No records yet.</p>';
  else if (c.cards) body = rows.map(r => {
    const groups = {}; c.fields.forEach(f => { if (r[f.k] && (!f.f || f.f === r.format)) (groups[f.g || ''] ||= []).push(f); });
    return `<div class="card" style="background:#fafcfd"><div class="bar"><b>${esc(r.date || '')} ${r.format ? `<span class="badge">${esc(r.format)}</span>` : ''} <small class="muted">by ${esc(r.by || '')}</small></b>${can('modify') ? `<div class="actions"><button class="sm sec" data-edit="${esc(r.id)}">Edit</button><button class="sm danger" data-rm="${esc(r.id)}">Delete</button></div>` : ''}</div>
      ${Object.entries(groups).map(([g, fs]) => `${g ? `<h4 style="margin:.5rem 0 .2rem">${esc(g)}</h4>` : ''}${kv(fs.filter(f => f.k !== 'date' && f.k !== 'format'), r)}`).join('')}</div>`;
  }).join('');
  else {
    const displayFields = c.fields.filter(field => key !== 'vitals' || field.k !== 'complaint');
    body = `<div class="tablewrap"><table><tr>${displayFields.map(f => `<th>${esc(f.l)}</th>`).join('')}<th></th></tr>${rows.map(r =>
      `<tr>${displayFields.map(f => `<td>${esc(r[f.k])}${key === 'vitals' && f.k === 'spo2' && r.spo2 !== '' && r.spo2 < 90 ? ' (Low)' : ''}</td>`).join('')}<td>${can('modify') ? `<div class="actions"><button class="sm sec" data-edit="${esc(r.id)}">Edit</button><button class="sm danger" data-rm="${esc(r.id)}">Delete</button></div>` : ''}</td></tr>`).join('')}</table></div>`;
    if (key === 'vitals') {
      const complaints = rows.filter(record => record.complaint && String(record.complaint).trim());
      body += `<div class="chief-complaint-list"><h4>Chief Complaint</h4>${complaints.length
        ? complaints.map(record => `<div class="chief-complaint"><small class="muted">${esc(record.date || '')}</small><p>${esc(record.complaint)}</p>${can('modify') ? `<div class="actions"><button class="sm sec" data-complaint-edit="${esc(record.id)}">Edit Complaint</button><button class="sm danger" data-complaint-delete="${esc(record.id)}">Delete Complaint</button></div>` : ''}</div>`).join('')
        : '<p class="muted">No chief complaints recorded.</p>'}</div>`;
    }
  }
  t.innerHTML = `<div class="card"><div class="bar"><h3 style="margin:0">${c.title}</h3>${can(c.perm) ? '<button id="addr">Add</button>' : ''}</div>${body}</div>`;
  t.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => {
    if (!can('modify')) return;
    const record = rows.find(r => r.id === b.dataset.edit);
    if (record) editRecord(p, key, record, rerender);
  });
  t.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => {
    if (!can('modify') || !confirm(`Delete this ${c.title.toLowerCase()} record?`)) return;
    const record = rows.find(r => r.id === b.dataset.rm);
    if (!record) return;
    p[key] = p[key].filter(r => r.id !== b.dataset.rm);
    log('REMOVE_' + key.toUpperCase(), p.id, `Deleted from ${c.title}: ${describeRecord(key, record, p)}`); persist(); rerender();
  });
  t.querySelectorAll('[data-complaint-edit]').forEach(b => b.onclick = () => {
    if (!can('modify')) return;
    const record = rows.find(r => r.id === b.dataset.complaintEdit);
    if (record) editChiefComplaint(p, record, rerender);
  });
  t.querySelectorAll('[data-complaint-delete]').forEach(b => b.onclick = () => {
    if (!can('modify') || !confirm('Delete this chief complaint? The vital-sign record will remain.')) return;
    const record = rows.find(r => r.id === b.dataset.complaintDelete);
    if (!record) return;
    const complaint = record.complaint;
    record.complaint = '';
    log('DELETE_VITAL_CHIEF_COMPLAINT', p.id, `Deleted chief complaint from vital-sign record dated ${record.date || 'unknown date'}: ${complaint}`);
    persist(); toast('Chief complaint deleted'); rerender();
  });
  const ar = t.querySelector('#addr'); if (ar) ar.onclick = () => addRecord(p, key, rerender);
  function rerender() { state.tab === 'History' ? historyTab($('#tab'), p) : profileView($('#main')); }
}
function editChiefComplaint(p, record, done) {
  if (!can('modify')) return;
  const m = openModal(`<h2>Edit Chief Complaint</h2><form id="ccf">${fieldsHTML([{ k: 'complaint', l: 'Chief Complaint', t: 'textarea' }], record)}
    <p><button>Save</button> <button type="button" class="sec" id="cx">Cancel</button></p></form>`);
  $('#cx', m).onclick = closeModal;
  $('#ccf', m).onsubmit = e => {
    e.preventDefault();
    if (!can('modify')) return;
    const previous = record.complaint || 'Not recorded';
    record.complaint = readForm(e.target).complaint;
    log('UPDATE_VITAL_CHIEF_COMPLAINT', p.id, `Updated chief complaint dated ${record.date || 'unknown date'}: ${previous} -> ${record.complaint || 'cleared'}`);
    persist(); closeModal(); toast('Chief complaint updated'); done();
  };
}
function editRecord(p, key, record, done) {
  const c = LISTS[key];
  const groups = [...new Set(c.fields.map(field => field.g || ''))];
  const html = groups.map(g => {
    const fields = c.fields.filter(field => (field.g || '') === g);
    const content = fieldsHTML(fields, record);
    return g ? `<fieldset><legend>${esc(g)}</legend>${content}</fieldset>` : content;
  }).join('');
  const m = openModal(`<h2>Edit — ${c.title}</h2><form id="rf">${html}<p><button>Save</button> <button type="button" class="sec" id="cx">Cancel</button></p></form>`);
  const f = $('#rf', m);
  const sync = () => { if (f.format) f.querySelectorAll('[data-f]').forEach(d => d.classList.toggle('hidden', d.dataset.f !== f.format.value)); };
  if (f.format) { f.format.onchange = sync; sync(); }
  $('#cx', m).onclick = closeModal;
  f.onsubmit = e => {
    e.preventDefault(); const d = readForm(f);
    if (d.format) c.fields.forEach(field => { if (field.f && field.f !== d.format) delete d[field.k]; });
    const cleared = c.fields.filter(field => field.f && d.format && field.f !== d.format).map(field => field.k);
    const changed = c.fields.filter(field => {
      const valueChanged = Object.prototype.hasOwnProperty.call(d, field.k) &&
        String(record[field.k] ?? '') !== String(d[field.k] ?? '');
      const valueCleared = cleared.includes(field.k) && !!record[field.k];
      return valueChanged || valueCleared;
    }).map(field => field.k);
    cleared.forEach(key => { record[key] = ''; });
    Object.assign(record, d, { by: state.user.name });
    log('UPDATE_' + key.toUpperCase(), p.id, `Updated ${c.title}: ${describeRecord(key, record, p, changed)}`);
    persist(); closeModal(); toast('Record updated'); done();
  };
}
function addRecord(p, key, done) {
  const c = LISTS[key], groups = [...new Set(c.fields.map(f => f.g || ''))];
  const defaults = { date: today(), format: 'SOAP' };
  const html = groups.map(g => `${g ? `<fieldset><legend>${esc(g)}</legend>` : ''}${fieldsHTML(c.fields.filter(f => (f.g || '') === g), defaults)}${g ? '</fieldset>' : ''}`).join('');
  const m = openModal(`<h2>Add — ${c.title}</h2><form id="rf">${html}<p><button>Save</button> <button type="button" class="sec" id="cx">Cancel</button></p></form>`);
  const f = $('#rf', m);
  const sync = () => { if (f.format) f.querySelectorAll('[data-f]').forEach(d => d.classList.toggle('hidden', d.dataset.f !== f.format.value)); };
  if (f.format) { f.format.onchange = sync; sync(); }
  $('#cx', m).onclick = closeModal;
  f.onsubmit = e => {
    e.preventDefault(); const d = readForm(f);
    if (d.format) c.fields.forEach(x => { if (x.f && x.f !== d.format) delete d[x.k]; });
    if (!Object.entries(d).some(([k, v]) => v && k !== 'date' && k !== 'format')) return toast('Please fill in at least one field');
    p[key].push({ id: uid(), ...d, by: state.user.name });
    log('ADD_' + key.toUpperCase(), p.id, `Added to ${c.title}: ${describeRecord(key, d, p)}`); persist(); closeModal(); toast('Record added'); done();
  };
}

/* ---------- Delete ---------- */
function deletePatient(p) {
  if (!can('delete')) return toast('Only an Administrator can delete patients');
  const m = openModal(`<h2>Delete Patient</h2><p>Are you sure you want to delete this patient?</p><p><b>${esc(fullName(p))}</b> (${esc(p.id)})</p>
    <p class="muted">Administrator authorization required: type the patient ID <b>${esc(p.id)}</b> to confirm. This cannot be undone.</p>
    <form id="df"><input name="c" required autocomplete="off"><p><button class="danger">Delete</button> <button type="button" class="sec" id="cx">Cancel</button></p></form>`);
  $('#cx', m).onclick = closeModal;
  $('#df', m).onsubmit = e => {
    e.preventDefault();
    if (readForm(e.target).c !== p.id) return toast('ID does not match');
    log('DELETE_PATIENT', p.id, `Deleted ${fullName(p)} (authorized by ${state.user.email})`);
    state.patients = state.patients.filter(x => x.id !== p.id); persist(); closeModal(); toast('Patient deleted'); state.view = 'patients'; render();
  };
}

/* ---------- Audit log ---------- */
function auditDescription(entry) {
  let description = String(entry.desc || '');
  const physician = stripRole(entry.attendingPhysician || patient(entry.pid)?.nurseName);
  const actor = physician || String(entry.user || 'Anonymous').replace(/\s*\([^()]*\)\s*$/, '').trim() || 'Anonymous';
  if (/;\s*Performed by:/i.test(description)) {
    description = description.replace(/(;\s*Performed by:)[^;]*$/i, (_, label) => `${label} ${actor}`);
  } else {
    description = `${description}; Performed by: ${actor}`;
  }
  return description;
}
function auditUser(entry) {
  const physician = stripRole(entry.attendingPhysician || patient(entry.pid)?.nurseName);
  return physician || entry.user || 'Anonymous';
}
function auditView(el) {
  el.innerHTML = `<h1>Audit Log</h1><div class="card tablewrap"><table><tr><th>Date/Time</th><th>User</th><th>Action</th><th>Patient ID</th><th>Description</th></tr>
    ${state.audit.map(a => `<tr><td>${esc(a.time)}</td><td>${esc(auditUser(a))}</td><td><span class="badge">${esc(a.action)}</span></td><td>${esc(a.pid)}</td><td>${esc(auditDescription(a))}</td></tr>`).join('') || '<tr><td colspan="5" class="muted">No entries.</td></tr>'}</table></div>`;
}

/* ---------- User management ---------- */
function usersView(el) {
  el.innerHTML = `<div class="bar"><h1>User Management</h1><button id="au">Add User</button></div><div class="card tablewrap"><table><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th></th></tr>
    ${state.users.map(u => `<tr><td>${esc(u.name)}</td><td>${esc(u.email)}</td><td><span class="badge">${u.role}</span></td><td><span class="badge ${u.status === 'Active' ? 'grn' : 'org'}">${u.status}</span></td>
    <td class="actions"><button class="sm sec" data-e="${u.id}">Edit</button>${u.id !== state.user.id ? `<button class="sm danger" data-d="${u.id}">Remove</button>` : ''}</td></tr>`).join('')}</table></div>`;
  const form = u => {
    const m = openModal(`<h2>${u ? 'Edit' : 'Add'} User</h2><form id="uf">${fieldsHTML([{ k: 'name', l: 'Name', req: 1 }, { k: 'email', l: 'Email', t: 'email', req: 1 },
      { k: 'role', l: 'Role', t: 'select', o: ['Administrator', 'Doctor', 'Nurse'], req: 1 }, { k: 'status', l: 'Status', t: 'select', o: ['Active', 'Inactive'] }], u || { status: 'Active' })}
      <div><label for="user-password">Password</label><div class="password-control"><input id="user-password" name="password" type="password" ${u ? '' : 'required'} placeholder="${u ? 'Leave blank to keep current password' : ''}"><button id="toggle-user-password" type="button" aria-label="Show password" aria-pressed="false">Show</button></div></div>
      <p><button>Save</button> <button type="button" class="sec" id="cx">Cancel</button></p></form>`);
    bindPasswordToggle($('#user-password', m), $('#toggle-user-password', m));
    $('#cx', m).onclick = closeModal;
    $('#uf', m).onsubmit = e => {
      e.preventDefault(); const d = readForm(e.target); const password = d.password; delete d.password; d.status ||= 'Active'; d.email = d.email.toLowerCase();
      if (state.users.some(x => x.email.toLowerCase() === d.email && x !== u)) return toast('Email already exists');
      if (u && u.id === state.user.id && (d.role !== u.role || d.status !== 'Active')) return toast('You cannot change your own role/status');
      if (u) {
        const changed = ['name', 'email', 'role', 'status'].filter(key => String(u[key] ?? '') !== String(d[key] ?? ''));
        Object.assign(u, d);
        if (password) u.password = password;
        const userFields = [{ k: 'name', l: 'Name' }, { k: 'email', l: 'Email' }, { k: 'role', l: 'Role' }, { k: 'status', l: 'Status' }];
        log('EDIT_USER', null, changed.length
          ? `Updated user: ${describeFields(userFields, d, changed)}${password ? '; Password: changed' : ''}`
          : `Updated user ${d.email}: no field changes${password ? '; Password: changed' : ''}`);
      } else {
        state.users.push({ id: uid(), ...d, password });
        log('ADD_USER', null, `Added user: ${describeFields([{ k: 'name', l: 'Name' }, { k: 'email', l: 'Email' }, { k: 'role', l: 'Role' }, { k: 'status', l: 'Status' }], d)}`);
      }
      persist(); closeModal(); usersView(el);
    };
  };
  $('#au').onclick = () => form();
  el.querySelectorAll('[data-e]').forEach(b => b.onclick = () => form(state.users.find(u => u.id === b.dataset.e)));
  el.querySelectorAll('[data-d]').forEach(b => b.onclick = () => {
    const u = state.users.find(x => x.id === b.dataset.d); if (!confirm(`Remove ${u.email}?`)) return;
    state.users = state.users.filter(x => x !== u);
    log('REMOVE_USER', null, `Removed user: ${describeFields([{ k: 'name', l: 'Name' }, { k: 'email', l: 'Email' }, { k: 'role', l: 'Role' }, { k: 'status', l: 'Status' }], u)}`);
    persist(); usersView(el);
  });
}

/* ---------- Boot ---------- */
if (state.user?.authVersion === 2 && !isStudentAccount(state.user)) {
  const u = state.users.find(x => x.id === state.user.id && x.status === 'Active');
  if (u) {
    const { password, ...sessionUser } = u;
    state.user = { ...sessionUser, authVersion: 2 };
  } else { state.user = null; localStorage.removeItem('npr_session'); }
} else { state.user = null; localStorage.removeItem('npr_session'); }
render();
