/* ─────────────────────────────────────────────────────────────────
   Chapter Command — app.js
   Plain JavaScript + Supabase JS SDK (loaded from CDN in index.html)
   No build step. No framework. Drop on Vercel and it works.
───────────────────────────────────────────────────────────────── */

// ── CONFIG — paste your Supabase credentials here ──────────────
const SUPABASE_URL  = 'https://your-project-ref.supabase.co';
const SUPABASE_ANON = 'your-anon-key-here';

// ── INIT ───────────────────────────────────────────────────────
const { createClient } = supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_ANON);

// ── STATE ──────────────────────────────────────────────────────
let currentUser   = null;
let allMembers    = [];
let allDocs       = [];
let memberFilter  = 'all';
let docFilter     = 'all';
let editingMember = null;
let editingEvent  = null;

// ── BOOT ───────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', async () => {
  const { data: { session } } = await sb.auth.getSession();
  if (session) {
    currentUser = session.user;
    showApp();
  } else {
    showLogin();
  }

  sb.auth.onAuthStateChange((_event, session) => {
    if (session) { currentUser = session.user; showApp(); }
    else          { currentUser = null; showLogin(); }
  });
});

// ── AUTH ───────────────────────────────────────────────────────
let loginMode = 'password';

function switchTab(mode) {
  loginMode = mode;
  document.getElementById('tab-password').classList.toggle('active', mode === 'password');
  document.getElementById('tab-magic').classList.toggle('active',    mode === 'magic');
  document.getElementById('password-field').style.display = mode === 'password' ? '' : 'none';
  document.getElementById('login-btn').textContent = mode === 'password' ? 'Sign In' : 'Send Magic Link';
  document.getElementById('login-error').style.display = 'none';
}

async function handleLogin(e) {
  e.preventDefault();
  const email    = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const btn      = document.getElementById('login-btn');
  const errEl    = document.getElementById('login-error');

  btn.disabled = true;
  btn.textContent = 'Please wait…';
  errEl.style.display = 'none';

  let error;

  if (loginMode === 'password') {
    ({ error } = await sb.auth.signInWithPassword({ email, password }));
  } else {
    ({ error } = await sb.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin }
    }));
    if (!error) {
      document.getElementById('login-form').style.display = 'none';
      document.getElementById('magic-sent').style.display = 'block';
      return;
    }
  }

  if (error) {
    errEl.textContent = error.message;
    errEl.style.display = 'block';
  }

  btn.disabled = false;
  btn.textContent = loginMode === 'password' ? 'Sign In' : 'Send Magic Link';
}

async function signOut() {
  await sb.auth.signOut();
}

// ── SCREENS ────────────────────────────────────────────────────
function showLogin() {
  document.getElementById('login-screen').style.display = '';
  document.getElementById('app-shell').style.display = 'none';
}

function showApp() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app-shell').style.display = 'flex';

  const email   = currentUser?.email ?? '';
  const initials = email.slice(0, 2).toUpperCase();
  document.getElementById('user-email').textContent = email;
  document.getElementById('user-avatar').textContent = initials;

  loadOverview();
}

// ── NAVIGATION ─────────────────────────────────────────────────
const PANEL_LABELS = {
  overview: 'Dashboard', members: 'Members', compliance: 'Compliance',
  financial: 'Financial', leadership: 'Leadership', conferences: 'Conferences',
  events: 'Events', reports: 'Reports', documents: 'Documents'
};

function showPanel(name) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
  document.getElementById('panel-' + name).classList.add('active');
  document.querySelector(`.nav-link[data-panel="${name}"]`).classList.add('active');
  document.getElementById('header-label').textContent = PANEL_LABELS[name] ?? name;
  document.getElementById('sidebar').classList.remove('open');

  const loaders = {
    overview:    loadOverview,
    members:     loadMembers,
    compliance:  loadCompliance,
    financial:   loadFinancial,
    leadership:  loadLeadership,
    conferences: loadConferences,
    events:      loadEvents,
    documents:   loadDocuments,
  };
  if (loaders[name]) loaders[name]();
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
}

// ── HELPERS ────────────────────────────────────────────────────
function badge(text, variant = 'dim') {
  return `<span class="badge badge-${variant}">${text}</span>`;
}

function certBadge(v) {
  if (!v || v === 'not_filed') return badge('Not Filed');
  if (v === 'current')  return badge('Current',  'green');
  if (v === 'pending')  return badge('Pending',  'amber');
  if (v === 'expired')  return badge('Expired',  'red');
  if (v === 'waived')   return badge('Waived',   'blue');
  return badge(v);
}

function bgcBadge(v) {
  if (!v)                  return badge('Not Filed');
  if (v === 'clear')       return badge('Clear',       'green');
  if (v === 'in_progress') return badge('In Progress', 'amber');
  if (v === 'pending')     return badge('Pending',     'amber');
  if (v === 'expired')     return badge('Expired',     'red');
  if (v === 'flagged')     return badge('Flagged',     'red');
  return badge(v);
}

function payBadge(v) {
  if (v === 'paid')        return badge('Paid',        'green');
  if (v === 'partial')     return badge('Partial',     'amber');
  if (v === 'outstanding') return badge('Outstanding', 'red');
  if (v === 'waived')      return badge('Waived',      'blue');
  if (v === 'deferred')    return badge('Deferred');
  return badge(v ?? '—');
}

function approvalBadge(v) {
  if (v === 'approved') return badge('Approved', 'green');
  if (v === 'pending')  return badge('Pending',  'amber');
  if (v === 'denied')   return badge('Denied',   'red');
  if (v === 'draft')    return badge('Draft');
  return badge(v ?? '—');
}

function typeBadge(t) {
  const map = { chapter_meeting:'dim', community_service:'blue', social:'gold', fundraiser:'blue', scholarship:'green', fraternal:'gold', national:'gold', other:'dim' };
  return badge((t ?? '').replace(/_/g,' '), map[t] ?? 'dim');
}

function fmtDate(d) {
  if (!d) return '<span style="color:var(--dim)">—</span>';
  return new Date(d).toLocaleDateString();
}

function fmtMoney(n) {
  return '$' + Number(n ?? 0).toFixed(2);
}

function statCard(label, value, sub, variant = '') {
  return `<div class="stat-card ${variant}">
    <div class="stat-label">${label}</div>
    <div class="stat-value">${value}</div>
    ${sub ? `<div class="stat-sub">${sub}</div>` : ''}
  </div>`;
}

function progBar(label, pct, variant = 'gold') {
  return `<div class="comp-item">
    <div class="comp-label"><span>${label}</span><span class="comp-pct">${Math.round(pct)}%</span></div>
    <div class="bar-bg"><div class="bar-fill bar-${variant}" style="width:${pct}%"></div></div>
  </div>`;
}

function emptyRow(cols, msg = 'No records found.') {
  return `<tr><td colspan="${cols}" style="text-align:center;padding:2.5rem;color:var(--dim);font-family:var(--fd);font-size:11px;letter-spacing:.1em">${msg}</td></tr>`;
}

function today() { return new Date().toISOString().split('T')[0]; }

// ── OVERVIEW ───────────────────────────────────────────────────
async function loadOverview() {
  const [
    { data: members },
    { data: compliance },
    { data: events },
    { data: bounces },
  ] = await Promise.all([
    sb.from('members').select('*').eq('membership_status','active'),
    sb.from('v_compliance_snapshot').select('*'),
    sb.from('events').select('*').gte('event_date', today()).order('event_date').limit(4),
    sb.from('members').select('id,first_name,last_name,email_primary').eq('email_bounced', true),
  ]);

  const total   = members?.length ?? 0;
  const fin     = members?.filter(m => m.financial_standing).length ?? 0;
  const dueRate = total > 0 ? Math.round(fin / total * 100) : 0;
  const rows    = compliance ?? [];
  const bgcOk   = rows.filter(r => r.bgc_result === 'clear' && r.bgc_expires && new Date(r.bgc_expires) > new Date()).length;

  // Stats
  document.getElementById('stat-total').innerHTML   = statCard('Total Members',   total,      `${fin} financial`, 'good');
  document.getElementById('stat-dues').innerHTML     = statCard('Dues Collected',  `${dueRate}%`, `${total - fin} outstanding`, dueRate >= 80 ? 'good' : 'warn');
  document.getElementById('stat-bgc').innerHTML      = statCard('BGC Current',     bgcOk,      `${total - bgcOk} expired/pending`, bgcOk >= total * 0.8 ? 'good' : 'warn');
  document.getElementById('stat-bounces').innerHTML  = statCard('Email Bounces',   bounces?.length ?? 0, 'Need update', (bounces?.length ?? 0) > 0 ? 'danger' : 'good');

  // Compliance bars
  const pct = (fn) => total > 0 ? rows.filter(fn).length / total * 100 : 0;
  const imdp    = pct(r => r.imdp_status === 'current');
  const risk    = pct(r => r.risk_mgmt_status === 'current');
  const ritual  = pct(r => r.ritual_status === 'current');
  const bgcPct  = pct(r => r.bgc_result === 'clear');
  const finPct  = pct(r => r.financial_standing);
  document.getElementById('compliance-bars').innerHTML =
    progBar('IMDP Certified',   imdp,   imdp >= 80 ? 'green' : 'amber') +
    progBar('Risk Management',  risk,   risk >= 80 ? 'green' : 'amber') +
    progBar('Ritual Training',  ritual, ritual >= 80 ? 'green' : 'amber') +
    progBar('Background Check', bgcPct, bgcPct >= 80 ? 'green' : 'amber') +
    progBar('Grand Tax Current',finPct, 'gold');

  // Upcoming events
  const evEl = document.getElementById('upcoming-events');
  if (!events?.length) { evEl.innerHTML = '<p style="color:var(--dim);font-size:13px;text-align:center;padding:1rem">No upcoming events.</p>'; }
  else {
    evEl.innerHTML = events.map(ev => {
      const d = new Date(ev.event_date);
      const mo = d.toLocaleString('default',{month:'short'}).toUpperCase();
      return `<div class="event-item">
        <div class="event-date-box">
          <span class="event-month">${mo}</span>
          <span class="event-day">${d.getDate()}</span>
        </div>
        <div>
          <div class="event-name">${ev.event_name}</div>
          <div class="event-meta">${ev.location ?? 'TBD'} · ${approvalBadge(ev.approval_status)}</div>
        </div>
      </div>`;
    }).join('');
  }

  // Attention items
  const attention = rows.filter(r =>
    r.email_bounced || r.imdp_status === 'not_filed' ||
    r.bgc_result === 'expired' || !r.financial_standing
  ).slice(0, 8);

  const tbody = document.getElementById('attention-tbody');
  if (!attention.length) { tbody.innerHTML = emptyRow(6, 'All brothers are in good standing.'); return; }
  tbody.innerHTML = attention.map(r => {
    const issues = [];
    if (r.email_bounced)              issues.push(badge('Email Bounce','amber'));
    if (r.imdp_status === 'not_filed') issues.push(badge('IMDP Missing','amber'));
    if (r.bgc_result === 'expired')    issues.push(badge('BGC Expired','red'));
    if (!r.financial_standing)         issues.push(badge('Non-Financial','red'));
    return `<tr>
      <td>${r.full_name}</td>
      <td>${issues.join(' ')}</td>
      <td>${certBadge(r.imdp_status)}</td>
      <td>${certBadge(r.risk_mgmt_status)}</td>
      <td>${bgcBadge(r.bgc_result)}</td>
      <td>${badge(r.financial_standing ? 'Financial' : 'Non-Financial', r.financial_standing ? 'green' : 'red')}</td>
    </tr>`;
  }).join('');
}

// ── MEMBERS ────────────────────────────────────────────────────
async function loadMembers() {
  document.getElementById('member-grid').innerHTML = '<p class="loading-msg">Loading…</p>';
  const { data } = await sb.from('members').select('*').order('last_name');
  allMembers = data ?? [];
  renderMembers();
}

function renderMembers() {
  const q   = (document.getElementById('member-search')?.value ?? '').toLowerCase();
  const filtered = allMembers.filter(m => {
    if (memberFilter === 'financial' && !m.financial_standing) return false;
    if (memberFilter === 'bounced'   && !m.email_bounced)      return false;
    if (memberFilter === 'inactive'  && m.membership_status !== 'inactive') return false;
    if (!q) return true;
    return `${m.first_name} ${m.last_name} ${m.email_primary} ${m.city ?? ''} ${m.employer ?? ''}`.toLowerCase().includes(q);
  });

  document.getElementById('members-count').textContent = `${filtered.length} of ${allMembers.length} shown`;

  if (!filtered.length) {
    document.getElementById('member-grid').innerHTML = '<p class="empty-msg">No members match your search.</p>';
    return;
  }

  document.getElementById('member-grid').innerHTML = filtered.map(m => {
    const ini = ((m.first_name?.[0] ?? '') + (m.last_name?.[0] ?? '')).toUpperCase();
    const tags = [
      badge(m.membership_status, m.membership_status === 'active' ? 'green' : 'dim'),
      badge(m.financial_standing ? 'Financial' : 'Non-Financial', m.financial_standing ? 'green' : 'red'),
      m.email_bounced ? badge('Email Bounce','amber') : '',
    ].filter(Boolean).join(' ');
    const meta = [m.city && m.state ? `${m.city}, ${m.state}` : '', m.employer ?? ''].filter(Boolean).join(' · ');
    return `<div class="member-card" onclick='openDrawer(${JSON.stringify(m)})'>
      <div class="member-card-top">
        <div class="member-avatar">${ini}</div>
        <div style="flex:1;min-width:0">
          <div class="member-name">${m.first_name} ${m.last_name}</div>
          <div class="member-email">${m.email_primary}</div>
        </div>
        <span style="color:var(--dim)">›</span>
      </div>
      ${meta ? `<div class="member-meta">${meta}</div>` : ''}
      <div class="member-tags">${tags}</div>
    </div>`;
  }).join('');
}

function filterMembers() { renderMembers(); }

function setMemberFilter(btn, filter) {
  memberFilter = filter;
  document.querySelectorAll('#member-filters .filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderMembers();
}

// ── MEMBER MODAL ───────────────────────────────────────────────
function openMemberModal(member = null) {
  editingMember = member;
  const fields = ['first_name','last_name','email_primary','phone_mobile','city','state','employer','occupation','member_number','chapter_initiated','initiated_date','membership_status'];
  fields.forEach(f => {
    const el = document.getElementById('m-' + f);
    if (el) el.value = member?.[f] ?? (f === 'membership_status' ? 'active' : '');
  });
  document.getElementById('member-modal-title').textContent = member ? 'Edit Member' : 'Add Member';
  document.getElementById('member-save-btn').textContent    = member ? 'Save Changes' : 'Add Member';
  document.getElementById('member-modal-error').style.display = 'none';
  document.getElementById('member-modal').style.display = 'flex';
}

async function saveMember() {
  const btn  = document.getElementById('member-save-btn');
  const errEl = document.getElementById('member-modal-error');
  errEl.style.display = 'none';

  const data = {};
  ['first_name','last_name','email_primary','phone_mobile','city','state','employer','occupation','member_number','chapter_initiated','initiated_date','membership_status'].forEach(f => {
    const v = document.getElementById('m-' + f)?.value?.trim();
    if (v) data[f] = v;
  });

  if (!data.first_name || !data.last_name || !data.email_primary) {
    errEl.textContent = 'First name, last name, and email are required.';
    errEl.style.display = 'block';
    return;
  }

  btn.disabled = true; btn.textContent = 'Saving…';

  let error;
  if (editingMember) {
    ({ error } = await sb.from('members').update(data).eq('id', editingMember.id));
  } else {
    ({ error } = await sb.from('members').insert(data));
  }

  btn.disabled = false;
  btn.textContent = editingMember ? 'Save Changes' : 'Add Member';

  if (error) { errEl.textContent = error.message; errEl.style.display = 'block'; return; }
  closeModal('member-modal');
  loadMembers();
}

// ── COMPLIANCE ─────────────────────────────────────────────────
async function loadCompliance() {
  const { data } = await sb.from('v_compliance_snapshot').select('*');
  const rows = data ?? [];
  const total = rows.length;
  const now   = new Date();

  const full   = rows.filter(r => r.imdp_status === 'current' && r.risk_mgmt_status === 'current' && r.ritual_status === 'current' && r.bgc_result === 'clear' && r.bgc_expires && new Date(r.bgc_expires) > now).length;
  const youth  = rows.filter(r => r.youth_eligible && r.bgc_expires && new Date(r.bgc_expires) > now).length;
  const nonCom = rows.filter(r => [r.imdp_status !== 'current', r.risk_mgmt_status !== 'current', r.ritual_status !== 'current', r.bgc_result !== 'clear'].filter(Boolean).length >= 3).length;

  document.getElementById('compliance-stats').innerHTML =
    statCard('Fully Compliant', full,   'All certs + BGC',  'good') +
    statCard('Partial',         total - full - nonCom, '1–2 items missing', 'warn') +
    statCard('Non-Compliant',   nonCom, '3+ items overdue', 'danger') +
    statCard('Youth Eligible',  youth,  'BGC cleared',      youth > 0 ? 'good' : 'warn');

  document.getElementById('compliance-tbody').innerHTML = !rows.length ? emptyRow(8) : rows.map(r => {
    const exp = r.bgc_expires;
    const expColor = exp && new Date(exp) < now ? 'color:var(--red)' : '';
    const youthOk  = r.youth_eligible && exp && new Date(exp) > now;
    return `<tr>
      <td>${r.full_name}</td>
      <td>${certBadge(r.imdp_status)}</td>
      <td>${certBadge(r.risk_mgmt_status)}</td>
      <td>${certBadge(r.ritual_status)}</td>
      <td>${bgcBadge(r.bgc_result)}</td>
      <td><span style="${expColor}">${exp ? new Date(exp).toLocaleDateString() : '—'}</span></td>
      <td>${badge(youthOk ? 'Yes' : 'No', youthOk ? 'green' : 'red')}</td>
      <td>${badge(r.financial_standing ? 'Financial' : 'Non-Financial', r.financial_standing ? 'green' : 'red')}</td>
    </tr>`;
  }).join('');
}

function exportCompliance() {
  sb.from('v_compliance_snapshot').select('*').then(({ data }) => {
    if (!data) return;
    const headers = ['Name','Email','IMDP','Risk Mgmt','Ritual','BGC','BGC Expires','Youth Eligible','Financial'];
    const rows    = data.map(r => [r.full_name, r.email_primary, r.imdp_status, r.risk_mgmt_status, r.ritual_status, r.bgc_result, r.bgc_expires ?? '', r.youth_eligible ? 'Yes' : 'No', r.financial_standing ? 'Yes' : 'No']);
    downloadCSV('compliance.csv', [headers, ...rows]);
  });
}

// ── FINANCIAL ──────────────────────────────────────────────────
async function loadFinancial() {
  const year = '2024-25';
  const [{ data: dues }, { data: tax }, { data: voters }] = await Promise.all([
    sb.from('dues_payments').select('*, members(first_name,last_name)').eq('fiscal_year', year),
    sb.from('grand_tax').select('*, members(first_name,last_name)').eq('fiscal_year', year),
    sb.from('v_voter_eligible').select('*'),
  ]);

  const totalOwed = (dues ?? []).reduce((s,r) => s + Number(r.amount_owed), 0);
  const totalPaid = (dues ?? []).reduce((s,r) => s + Number(r.amount_paid), 0);
  const outstanding = totalOwed - totalPaid;
  const taxOutstanding = (tax ?? []).filter(r => r.payment_status !== 'paid').reduce((s,r) => s + (Number(r.amount_owed) - Number(r.amount_paid)), 0);
  const rate = totalOwed > 0 ? Math.round(totalPaid / totalOwed * 100) : 0;

  document.getElementById('financial-stats').innerHTML =
    statCard('Voter Eligible',     voters?.length ?? 0, 'Financial + tax current', 'good') +
    statCard('Dues Outstanding',   `$${outstanding.toFixed(0)}`, `${(dues??[]).filter(r=>r.payment_status!=='paid').length} brothers`, 'warn') +
    statCard('Grand Tax Owed',     `$${taxOutstanding.toFixed(0)}`, `${(tax??[]).filter(r=>r.payment_status!=='paid').length} unpaid`, 'warn') +
    statCard('Collection Rate',    `${rate}%`, 'Current fiscal year', rate >= 85 ? 'good' : 'warn');

  document.getElementById('dues-tbody').innerHTML = !(dues?.length) ? emptyRow(7, `No dues records for ${year}.`) : dues.map(r => {
    const m = r.members;
    const bal = Number(r.amount_owed) - Number(r.amount_paid);
    return `<tr>
      <td>${m ? `${m.first_name} ${m.last_name}` : '—'}</td>
      <td>${r.term ?? '—'}</td>
      <td>${fmtMoney(r.amount_owed)}</td>
      <td>${fmtMoney(r.amount_paid)}</td>
      <td style="color:${bal > 0 ? 'var(--red)' : 'var(--green)'}">${fmtMoney(bal)}</td>
      <td>${payBadge(r.payment_status)}</td>
      <td>${fmtDate(r.paid_date)}</td>
    </tr>`;
  }).join('');

  document.getElementById('tax-tbody').innerHTML = !(tax?.length) ? emptyRow(6, `No grand tax records for ${year}.`) : tax.map(r => {
    const m = r.members;
    return `<tr>
      <td>${m ? `${m.first_name} ${m.last_name}` : '—'}</td>
      <td>${fmtMoney(r.amount_owed)}</td>
      <td>${fmtMoney(r.amount_paid)}</td>
      <td>${payBadge(r.payment_status)}</td>
      <td>${fmtDate(r.paid_date)}</td>
      <td>${r.confirmation_number ?? '<span style="color:var(--dim)">—</span>'}</td>
    </tr>`;
  }).join('');
}

function exportFinancial() {
  sb.from('dues_payments').select('*, members(first_name,last_name)').then(({ data }) => {
    if (!data) return;
    const headers = ['Name','Fiscal Year','Term','Owed','Paid','Status','Paid Date'];
    const rows    = data.map(r => {
      const m = r.members;
      return [`${m?.first_name ?? ''} ${m?.last_name ?? ''}`, r.fiscal_year, r.term ?? '', r.amount_owed, r.amount_paid, r.payment_status, r.paid_date ?? ''];
    });
    downloadCSV('financial.csv', [headers, ...rows]);
  });
}

// ── LEADERSHIP ─────────────────────────────────────────────────
let allTermYears   = [];
let activeTerm     = null;

async function loadLeadership() {
  // Load all distinct term years from member_roles
  const { data: termData } = await sb
    .from('member_roles')
    .select('term_year')
    .not('term_year', 'is', null)
    .order('term_year', { ascending: false });

  const terms = [...new Set((termData ?? []).map(r => r.term_year).filter(Boolean))];
  allTermYears = terms;

  // Default to most recent or first available
  if (!activeTerm || !terms.includes(activeTerm)) {
    activeTerm = terms[0] ?? null;
  }

  renderTermTabs();
  await loadBoardForTerm(activeTerm);
}

function renderTermTabs() {
  const row = document.getElementById('term-tab-row');
  if (!row) return;
  if (!allTermYears.length) {
    row.innerHTML = '<span style="font-size:12px;color:var(--dim)">No terms yet — assign a position to create one.</span>';
    return;
  }
  row.innerHTML = allTermYears.map(t =>
    `<button class="term-tab ${t === activeTerm ? 'active' : ''}" onclick="switchTerm('${t}')">${t}</button>`
  ).join('');
}

async function switchTerm(term) {
  activeTerm = term;
  renderTermTabs();
  await loadBoardForTerm(term);
}

async function loadBoardForTerm(term) {
  const isCurrent = term === allTermYears[0]; // most recent = current

  // Fetch all roles for this term
  let query = sb
    .from('member_roles')
    .select('*, members(first_name, last_name, email_primary, phone_mobile), leadership_roles(role_name, role_type, committee_name, is_exec_board)')
    .order('is_current', { ascending: false });

  if (term) {
    query = query.eq('term_year', term);
  } else {
    query = query.eq('is_current', true);
  }

  const { data } = await query;
  const rows = data ?? [];
  const exec = rows.filter(r => r.leadership_roles?.is_exec_board);
  const comm = rows.filter(r => !r.leadership_roles?.is_exec_board);

  // Stats
  document.getElementById('leadership-stats').innerHTML =
    statCard('Exec Board',     exec.length,  term ? `${term} term` : 'Currently filled',  exec.length > 0 ? 'good' : 'warn') +
    statCard('Committee',      comm.length,  'Chairs assigned') +
    statCard('Total Roles',    rows.length,  'This term') +
    statCard('Vacancies',      Math.max(0, 12 - exec.length), 'Board positions open', exec.length < 12 ? 'warn' : 'good');

  // Section titles
  const termLabel = term ? ` — ${term}` : '';
  const el1 = document.getElementById('exec-section-title');
  const el2 = document.getElementById('committee-section-title');
  if (el1) el1.textContent = `Executive Board${termLabel}`;
  if (el2) el2.textContent = `Committee Chairs${termLabel}`;

  // Exec table
  document.getElementById('exec-tbody').innerHTML = !exec.length
    ? emptyRow(8, term ? `No exec board recorded for ${term}.` : 'No current exec board assignments.')
    : exec.map(r => {
        const m  = r.members;
        const lr = r.leadership_roles;
        return `<tr>
          <td>${badge(lr?.role_name ?? '—', 'gold')}</td>
          <td>${badge(lr?.role_type?.replace(/_/g,' ') ?? '—', lr?.is_exec_board ? 'gold' : 'dim')}</td>
          <td>${m ? m.first_name + ' ' + m.last_name : '—'}</td>
          <td style="color:var(--muted);font-size:12px">${m?.email_primary ?? '—'}</td>
          <td style="color:var(--muted);font-size:12px">${m?.phone_mobile ?? '—'}</td>
          <td>${r.term_year ?? '—'}</td>
          <td>${r.start_date ? new Date(r.start_date).toLocaleDateString() : '—'}</td>
          <td>
            <button onclick="removeRoleAssignment('${r.id}')" style="background:none;border:1px solid rgba(201,76,76,0.3);color:var(--red);border-radius:4px;padding:2px 8px;font-size:10px;cursor:pointer">Remove</button>
          </td>
        </tr>`;
      }).join('');

  // Committee groups — grouped by committee_name, showing full roster
  const groupsEl = document.getElementById('committee-groups');
  if (!comm.length) {
    groupsEl.innerHTML = `<div class="empty-msg">${term ? `No committees recorded for ${term}.` : 'No current committee assignments.'}</div>`;
  } else {
    const grouped = {};
    comm.forEach(r => {
      const key = r.leadership_roles?.committee_name ?? r.leadership_roles?.role_name ?? 'Other';
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(r);
    });

    groupsEl.innerHTML = Object.entries(grouped).map(([committeeName, members]) => {
      // Sort chairs first
      members.sort((a,b) => {
        const aChair = a.leadership_roles?.role_type === 'committee_chair' ? 0 : 1;
        const bChair = b.leadership_roles?.role_type === 'committee_chair' ? 0 : 1;
        return aChair - bChair;
      });
      return `<div class="committee-group">
        <div class="committee-group-header">
          <span class="committee-group-name">${committeeName}</span>
          <span class="committee-group-count">${members.length} member${members.length !== 1 ? 's' : ''}</span>
        </div>
        ${members.map(r => {
          const m = r.members;
          const isChair = r.leadership_roles?.role_type === 'committee_chair';
          return `<div class="committee-member-row">
            <div>
              <span class="committee-member-name">${m ? m.first_name + ' ' + m.last_name : '—'}</span>
              <span class="committee-member-role">${isChair ? badge('Chair','gold') : badge('Member','dim')} ${m?.email_primary ? '· ' + m.email_primary : ''}</span>
            </div>
            <button onclick="removeRoleAssignment('${r.id}')" style="background:none;border:1px solid rgba(201,76,76,0.3);color:var(--red);border-radius:4px;padding:2px 8px;font-size:10px;cursor:pointer">Remove</button>
          </div>`;
        }).join('')}
      </div>`;
    }).join('');
  }
}

async function removeRoleAssignment(id) {
  if (!confirm('Remove this position assignment?')) return;
  const { error } = await sb.from('member_roles').delete().eq('id', id);
  if (!error) loadLeadership();
  else alert('Error: ' + error.message);
}

// ── ASSIGN BOARD MODAL ─────────────────────────────────────────
async function openAssignBoardModal() {
  // Populate brothers dropdown
  const { data: members } = await sb.from('members').select('id,first_name,last_name').eq('membership_status','active').order('last_name');
  const mSel = document.getElementById('ab-member_id');
  mSel.innerHTML = '<option value="">Select brother…</option>' +
    (members ?? []).map(m => `<option value="${m.id}">${m.first_name} ${m.last_name}</option>`).join('');

  // Populate roles dropdown
  if (!allRoles.length) await refreshRoles();
  const rSel = document.getElementById('ab-role_id');
  rSel.innerHTML = '<option value="">Select position…</option>' +
    allRoles.map(r => `<option value="${r.id}">${r.role_name}${r.committee_name ? ' — ' + r.committee_name : ''}</option>`).join('');

  // Populate term years dropdown
  const tSel = document.getElementById('ab-term_year');
  const currentYear = new Date().getFullYear();
  const yearOptions = allTermYears.length
    ? allTermYears
    : [`${currentYear}-${String(currentYear+1).slice(-2)}`, `${currentYear-1}-${String(currentYear).slice(-2)}`];

  tSel.innerHTML = '<option value="">Select term…</option>' +
    yearOptions.map(y => `<option value="${y}" ${y === activeTerm ? 'selected' : ''}>${y}</option>`).join('') +
    `<option value="__new__">+ Enter new term year</option>`;

  document.getElementById('assign-board-error').style.display = 'none';
  document.getElementById('assign-board-modal').style.display = 'flex';
}

async function saveAssignBoard() {
  const errEl    = document.getElementById('assign-board-error');
  errEl.style.display = 'none';

  const memberId = document.getElementById('ab-member_id')?.value;
  const roleId   = document.getElementById('ab-role_id')?.value;
  let   termYear = document.getElementById('ab-term_year')?.value;
  const isCurrent = document.getElementById('ab-is_current')?.value === 'true';

  if (!memberId) { errEl.textContent = 'Please select a brother.'; errEl.style.display='block'; return; }
  if (!roleId)   { errEl.textContent = 'Please select a position.'; errEl.style.display='block'; return; }

  if (termYear === '__new__') {
    termYear = prompt('Enter term year (e.g. 2024-25):');
    if (!termYear) return;
    termYear = termYear.trim();
  }

  if (!termYear) { errEl.textContent = 'Please select or enter a term year.'; errEl.style.display='block'; return; }

  // If marking current, unmark others for same role
  if (isCurrent) {
    await sb.from('member_roles').update({ is_current: false }).eq('role_id', roleId).eq('is_current', true);
  }

  const data = {
    member_id:  memberId,
    role_id:    roleId,
    term_year:  termYear,
    start_date: document.getElementById('ab-start_date')?.value || null,
    end_date:   document.getElementById('ab-end_date')?.value   || null,
    is_current: isCurrent,
  };

  const { error } = await sb.from('member_roles').insert(data);
  if (error) { errEl.textContent = error.message; errEl.style.display='block'; return; }

  closeModal('assign-board-modal');
  loadLeadership();
}

// ── TERM YEAR MODAL ────────────────────────────────────────────
function openTermYearModal() {
  document.getElementById('new-term-year').value = '';
  document.getElementById('term-year-modal').style.display = 'flex';
}

function addTermYear() {
  const val = document.getElementById('new-term-year')?.value?.trim();
  if (!val) { alert('Please enter a term year.'); return; }
  if (!allTermYears.includes(val)) {
    allTermYears.unshift(val);
  }
  activeTerm = val;
  renderTermTabs();
  closeModal('term-year-modal');
  loadBoardForTerm(val);
}

// ── EVENTS ─────────────────────────────────────────────────────
async function loadEvents() {
  const { data } = await sb.from('events').select('*').order('event_date');
  const events   = data ?? [];
  const now      = today();
  const upcoming = events.filter(e => e.event_date >= now);
  const past     = events.filter(e => e.event_date <  now);

  document.getElementById('events-stats').innerHTML =
    statCard('Total Events',    events.length,   'On record') +
    statCard('Upcoming',        upcoming.length, 'Scheduled',   'good') +
    statCard('Pending Approval',events.filter(e => ['draft','pending'].includes(e.approval_status)).length, 'Need action', 'warn') +
    statCard('Youth Events',    events.filter(e => e.requires_bgc).length, 'BGC required');

  const upRow = (e) => `<tr>
    <td>${fmtDate(e.event_date)}</td>
    <td>${e.event_name}</td>
    <td>${typeBadge(e.event_type)}</td>
    <td>${e.location ?? '<span style="color:var(--dim)">TBD</span>'}</td>
    <td>${approvalBadge(e.approval_status)}</td>
    <td>${badge(e.insurance_filed ? 'Filed' : e.requires_insurance ? 'Required' : 'N/A', e.insurance_filed ? 'green' : e.requires_insurance ? 'red' : 'dim')}</td>
    <td>${badge(e.requires_bgc ? 'Yes' : 'No', e.requires_bgc ? 'amber' : 'dim')}</td>
    <td><button style="background:none;border:none;color:var(--gold);cursor:pointer;font-size:12px" onclick='openEventModal(${JSON.stringify(e)})'>Edit</button></td>
  </tr>`;

  document.getElementById('events-upcoming-tbody').innerHTML = !upcoming.length ? emptyRow(8,'No upcoming events.') : upcoming.map(upRow).join('');
  document.getElementById('events-past-tbody').innerHTML     = !past.length ? emptyRow(5,'No past events.') : past.slice(0,10).map(e => `<tr>
    <td>${fmtDate(e.event_date)}</td><td>${e.event_name}</td><td>${typeBadge(e.event_type)}</td><td>${e.location ?? '—'}</td><td>${approvalBadge(e.approval_status)}</td>
  </tr>`).join('');
}

function openEventModal(ev = null) {
  editingEvent = ev;
  const fields = ['event_name','event_type','event_date','location','approval_status','description'];
  fields.forEach(f => { const el = document.getElementById('e-' + f); if (el) el.value = ev?.[f] ?? ''; });
  ['requires_approval','requires_insurance','requires_bgc','insurance_filed'].forEach(f => {
    const el = document.getElementById('e-' + f); if (el) el.checked = !!ev?.[f];
  });
  document.getElementById('event-modal-title').textContent = ev ? 'Edit Event' : 'New Event';
  document.getElementById('event-save-btn').textContent    = ev ? 'Save Changes' : 'Create Event';
  document.getElementById('event-modal-error').style.display = 'none';
  document.getElementById('event-modal').style.display = 'flex';
}

async function saveEvent() {
  const btn   = document.getElementById('event-save-btn');
  const errEl = document.getElementById('event-modal-error');
  errEl.style.display = 'none';

  const data = {};
  ['event_name','event_type','event_date','location','approval_status','description'].forEach(f => {
    const v = document.getElementById('e-' + f)?.value?.trim();
    if (v) data[f] = v;
  });
  ['requires_approval','requires_insurance','requires_bgc','insurance_filed'].forEach(f => {
    data[f] = !!document.getElementById('e-' + f)?.checked;
  });

  if (!data.event_name || !data.event_date) {
    errEl.textContent = 'Event name and date are required.';
    errEl.style.display = 'block';
    return;
  }

  btn.disabled = true; btn.textContent = 'Saving…';
  let error;
  if (editingEvent) {
    ({ error } = await sb.from('events').update(data).eq('id', editingEvent.id));
  } else {
    ({ error } = await sb.from('events').insert(data));
  }
  btn.disabled = false;
  btn.textContent = editingEvent ? 'Save Changes' : 'Create Event';

  if (error) { errEl.textContent = error.message; errEl.style.display = 'block'; return; }
  closeModal('event-modal');
  loadEvents();
}

// ── REPORTS ────────────────────────────────────────────────────
async function showReport(type) {
  const out = document.getElementById('report-output');
  out.innerHTML = '<p class="loading-msg">Loading…</p>';

  let html = '';

  if (type === 'voters') {
    const { data } = await sb.from('v_voter_eligible').select('*');
    html = `<div class="section-hdr"><span class="section-title">Voter Eligible Brothers (${data?.length ?? 0})</span></div>
    <div class="table-wrap"><table class="data-table">
      <thead><tr><th>Name</th><th>Email</th><th>City</th><th>State</th><th>Status</th></tr></thead>
      <tbody>${!(data?.length) ? emptyRow(5) : data.map(r => `<tr>
        <td>${r.full_name}</td><td style="color:var(--muted);font-size:12px">${r.email_primary}</td>
        <td>${r.city ?? '—'}</td><td>${r.state ?? '—'}</td><td>${badge('Eligible','green')}</td>
      </tr>`).join('')}</tbody>
    </table></div>`;
  }

  if (type === 'youth') {
    const { data } = await sb.from('v_youth_eligible').select('*');
    html = `<div class="section-hdr"><span class="section-title">Youth Program Eligible (${data?.length ?? 0})</span></div>
    <div class="table-wrap"><table class="data-table">
      <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>BGC Expires</th></tr></thead>
      <tbody>${!(data?.length) ? emptyRow(4) : data.map(r => `<tr>
        <td>${r.full_name}</td><td style="color:var(--muted);font-size:12px">${r.email_primary}</td>
        <td>${r.phone_mobile ?? '—'}</td><td>${fmtDate(r.bgc_expires)}</td>
      </tr>`).join('')}</tbody>
    </table></div>`;
  }

  if (type === 'bounces') {
    const { data } = await sb.from('v_email_bounces').select('*');
    html = `<div class="section-hdr"><span class="section-title">Email Bounces (${data?.length ?? 0})</span></div>
    <div class="table-wrap"><table class="data-table">
      <thead><tr><th>Name</th><th>Primary Email</th><th>Phone</th><th>Bounce Date</th></tr></thead>
      <tbody>${!(data?.length) ? emptyRow(4,'No email bounces — all addresses current.') : data.map(r => `<tr>
        <td>${r.full_name}</td><td>${badge(r.email_primary,'red')}</td>
        <td>${r.phone_mobile ?? '—'}</td><td>${fmtDate(r.email_bounce_date)}</td>
      </tr>`).join('')}</tbody>
    </table></div>`;
  }

  if (type === 'noncompliant') {
    const { data } = await sb.from('v_compliance_snapshot').select('*');
    const nc = (data ?? []).filter(r =>
      [r.imdp_status !== 'current', r.risk_mgmt_status !== 'current', r.ritual_status !== 'current', r.bgc_result !== 'clear'].filter(Boolean).length >= 2
    );
    html = `<div class="section-hdr"><span class="section-title">Non-Compliant Brothers (${nc.length})</span></div>
    <div class="table-wrap"><table class="data-table">
      <thead><tr><th>Name</th><th>IMDP</th><th>Risk Mgmt</th><th>Ritual</th><th>BGC</th></tr></thead>
      <tbody>${!nc.length ? emptyRow(5,'All brothers meet compliance standards.') : nc.map(r => `<tr>
        <td>${r.full_name}</td>
        <td>${certBadge(r.imdp_status)}</td>
        <td>${certBadge(r.risk_mgmt_status)}</td>
        <td>${certBadge(r.ritual_status)}</td>
        <td>${bgcBadge(r.bgc_result)}</td>
      </tr>`).join('')}</tbody>
    </table></div>`;
  }

  out.innerHTML = html;
}

// ── DOCUMENTS ──────────────────────────────────────────────────
async function loadDocuments() {
  const { data } = await sb.from('documents').select('*').order('created_at', { ascending: false });
  allDocs = data ?? [];
  document.getElementById('docs-count').textContent = `${allDocs.length} files on record`;
  renderDocs();
}

function renderDocs() {
  const docs = docFilter === 'all' ? allDocs : allDocs.filter(d => d.doc_category === docFilter);
  const catColors = { constitution_bylaws:'gold', financial_policy:'blue', strategic_plan:'gold', compliance:'blue', historical:'dim', minutes:'dim', calendar:'dim', operational:'green', other:'dim' };

  document.getElementById('docs-tbody').innerHTML = !docs.length ? emptyRow(6) : docs.map(d => {
    const exp    = d.expiration_date;
    const expCol = exp && new Date(exp) < new Date() ? 'color:var(--red)' : '';
    return `<tr>
      <td>${d.title}</td>
      <td>${badge((d.doc_category ?? 'other').replace(/_/g,' '), catColors[d.doc_category] ?? 'dim')}</td>
      <td>${d.version ?? '<span style="color:var(--dim)">—</span>'}</td>
      <td>${fmtDate(d.effective_date)}</td>
      <td><span style="${expCol}">${fmtDate(exp)}</span></td>
      <td>${badge(d.is_current ? 'Current' : 'Archived', d.is_current ? 'green' : 'dim')}</td>
    </tr>`;
  }).join('');
}

function setDocFilter(btn, filter) {
  docFilter = filter;
  document.querySelectorAll('#doc-filters .filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderDocs();
}

function openDocModal() {
  ['title','version','file_name','effective_date','expiration_date','description'].forEach(f => {
    const el = document.getElementById('d-' + f); if (el) el.value = '';
  });
  document.getElementById('d-doc_category').value = 'other';
  document.getElementById('doc-modal-error').style.display = 'none';
  document.getElementById('doc-modal').style.display = 'flex';
}

async function saveDoc() {
  const errEl = document.getElementById('doc-modal-error');
  errEl.style.display = 'none';
  const title = document.getElementById('d-title')?.value?.trim();
  if (!title) { errEl.textContent = 'Title is required.'; errEl.style.display = 'block'; return; }

  const data = { title, is_current: true };
  ['doc_category','version','file_name','effective_date','expiration_date','description'].forEach(f => {
    const v = document.getElementById('d-' + f)?.value?.trim();
    if (v) data[f] = v;
  });

  const { error } = await sb.from('documents').insert(data);
  if (error) { errEl.textContent = error.message; errEl.style.display = 'block'; return; }
  closeModal('doc-modal');
  loadDocuments();
}

// ── MODAL UTILS ────────────────────────────────────────────────
function closeModal(id) {
  document.getElementById(id).style.display = 'none';
}

// ── CSV EXPORT ─────────────────────────────────────────────────
function downloadCSV(filename, rows) {
  const csv  = rows.map(r => r.map(v => `"${String(v ?? '').replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a    = document.createElement('a');
  a.href     = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
}

// ── MEMBER DRAWER ──────────────────────────────────────────────
let drawerMember   = null;
let drawerTab      = 'profile';
let drawerToggles  = { financial_standing: false, voting_eligible: false, email_bounced: false };
let bgcYouth       = false;
let existingCerts  = {};
let existingBGC    = null;

function openDrawer(member) {
  drawerMember = member;
  drawerTab    = 'profile';

  const ini = ((member.first_name?.[0]??'')+(member.last_name?.[0]??'')).toUpperCase();
  document.getElementById('drawer-avatar').textContent = ini;
  document.getElementById('drawer-name').textContent   = `${member.first_name} ${member.last_name}`;
  document.getElementById('drawer-email').textContent  = member.email_primary;

  // Profile fields
  const profileFields = ['first_name','last_name','email_primary','email_secondary','phone_mobile','phone_home','address_line1','address_line2','city','state','zip','employer','occupation','linkedin_url','member_number','chapter_initiated','initiated_date','membership_status','email_bounce_date','email_bounce_reason'];
  profileFields.forEach(f => {
    const el = document.getElementById('dp-' + f);
    if (el) el.value = member[f] ?? '';
  });

  // Toggles
  ['financial_standing','voting_eligible','email_bounced'].forEach(f => {
    drawerToggles[f] = !!member[f];
    setToggle(f, !!member[f]);
  });

  // Photo
  renderProfilePhoto(member.photo_url ?? null);
  document.getElementById('dp-photo_url').value = member.photo_url ?? '';
  document.getElementById('dp-photo-file').value = '';
  document.getElementById('photo-upload-status').textContent = '';

  switchDrawerTab('profile');
  loadDrawerFinancial();
  loadDrawerCerts();
  loadDrawerBGC();
  refreshRoles();

  document.getElementById('drawer-overlay').classList.add('open');
  document.getElementById('member-drawer').classList.add('open');
}

function closeDrawer() {
  document.getElementById('drawer-overlay').classList.remove('open');
  document.getElementById('member-drawer').classList.remove('open');
  drawerMember = null;
}

function switchDrawerTab(tab) {
  drawerTab = tab;
  document.querySelectorAll('.drawer-tab').forEach((b,i) => {
    const tabs = ['profile','financial','certs','leadership','conferences','bgc'];
    b.classList.toggle('active', tabs[i] === tab);
  });
  document.querySelectorAll('.drawer-tab-content').forEach(c => c.classList.remove('active'));
  document.getElementById('dtab-' + tab).classList.add('active');
  if (tab === 'leadership')   loadDrawerLeadership();
  if (tab === 'conferences')  loadDrawerConferences();
}

function setToggle(field, val) {
  const el  = document.getElementById('dp-' + field);
  const lbl = document.getElementById('dp-' + field + '-label');
  if (el)  el.classList.toggle('on', val);
  if (lbl) lbl.textContent = val ? 'Yes' : 'No';
}

function toggleField(field) {
  drawerToggles[field] = !drawerToggles[field];
  setToggle(field, drawerToggles[field]);
}

function toggleBgcYouth() {
  bgcYouth = !bgcYouth;
  const el  = document.getElementById('bgc-youth_eligible');
  const lbl = document.getElementById('bgc-youth_eligible-label');
  if (el)  el.classList.toggle('on', bgcYouth);
  if (lbl) lbl.textContent = bgcYouth ? 'Yes' : 'No';
}

function showSaved() {
  const el = document.getElementById('drawer-save-indicator');
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2000);
}

// ── SAVE PROFILE ───────────────────────────────────────────────
async function saveProfile() {
  if (!drawerMember) return;
  const data = {};
  ['first_name','last_name','email_primary','email_secondary','phone_mobile','phone_home','address_line1','address_line2','city','state','zip','employer','occupation','linkedin_url','member_number','chapter_initiated','initiated_date','membership_status','email_bounce_date','email_bounce_reason'].forEach(f => {
    const v = document.getElementById('dp-' + f)?.value?.trim();
    data[f] = v || null;
  });
  data.financial_standing = drawerToggles.financial_standing;
  data.voting_eligible    = drawerToggles.voting_eligible;
  data.email_bounced      = drawerToggles.email_bounced;

  const { error } = await sb.from('members').update(data).eq('id', drawerMember.id);
  if (!error) { showSaved(); loadMembers(); }
  else alert('Error saving: ' + error.message);
}

// ── FINANCIAL ──────────────────────────────────────────────────
async function loadDrawerFinancial() {
  if (!drawerMember) return;
  const [{ data: dues }, { data: tax }] = await Promise.all([
    sb.from('dues_payments').select('*').eq('member_id', drawerMember.id).order('created_at', { ascending: false }),
    sb.from('grand_tax').select('*').eq('member_id', drawerMember.id).order('created_at', { ascending: false }),
  ]);

  const el = document.getElementById('fin-history');
  if (!el) return;

  const duesRows = (dues ?? []).map(r => `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid rgba(201,168,76,0.07);font-size:12px">
      <span style="color:var(--muted)">${r.fiscal_year} ${r.term ?? ''}</span>
      <span style="color:var(--text)">${fmtMoney(r.amount_paid)} / ${fmtMoney(r.amount_owed)}</span>
      ${payBadge(r.payment_status)}
    </div>`).join('');

  const taxRows = (tax ?? []).map(r => `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid rgba(201,168,76,0.07);font-size:12px">
      <span style="color:var(--muted)">Grand Tax ${r.fiscal_year}</span>
      <span style="color:var(--text)">${fmtMoney(r.amount_paid)} / ${fmtMoney(r.amount_owed)}</span>
      ${payBadge(r.payment_status)}
    </div>`).join('');

  el.innerHTML = (duesRows || taxRows)
    ? `<div style="margin-bottom:8px;font-family:var(--fd);font-size:9px;color:var(--gold-dim);letter-spacing:.1em;text-transform:uppercase">Dues</div>${duesRows || '<p style="color:var(--dim);font-size:12px">None</p>'}
       <div style="margin:12px 0 8px;font-family:var(--fd);font-size:9px;color:var(--gold-dim);letter-spacing:.1em;text-transform:uppercase">Grand Tax</div>${taxRows || '<p style="color:var(--dim);font-size:12px">None</p>'}`
    : '<p style="color:var(--dim);font-size:12px">No payment records yet.</p>';
}

// ── SYNC FINANCIAL STANDING ───────────────────────────────────
// Called after any dues or grand tax save.
// Checks if dues are paid for the current fiscal year and auto-updates
// financial_standing and voting_eligible on the member record.
async function syncFinancialStanding(memberId) {
  const currentYear = getCurrentFiscalYear();

  const [{ data: dues }, { data: tax }] = await Promise.all([
    sb.from('dues_payments')
      .select('payment_status')
      .eq('member_id', memberId)
      .eq('fiscal_year', currentYear)
      .order('created_at', { ascending: false })
      .limit(1),
    sb.from('grand_tax')
      .select('payment_status')
      .eq('member_id', memberId)
      .eq('fiscal_year', currentYear)
      .limit(1),
  ]);

  const duesPaid = dues?.[0]?.payment_status === 'paid';
  const taxPaid  = tax?.[0]?.payment_status  === 'paid';

  // Financial = dues paid. Voting = dues AND grand tax paid.
  // If no grand tax record exists yet, only require dues.
  const hasGrandTax   = (tax ?? []).length > 0;
  const isFinancial   = duesPaid;
  const isVoting      = duesPaid && (!hasGrandTax || taxPaid);

  await sb.from('members').update({
    financial_standing: isFinancial,
    voting_eligible:    isVoting,
  }).eq('id', memberId);

  // Update the toggles in the drawer so they reflect the new state
  if (drawerMember?.id === memberId) {
    drawerToggles.financial_standing = isFinancial;
    drawerToggles.voting_eligible    = isVoting;
    setToggle('financial_standing', isFinancial);
    setToggle('voting_eligible',    isVoting);
  }
}

// Bulk fix — re-syncs all active members based on payment records
async function bulkSyncFinancialStanding() {
  const btn = document.getElementById('bulk-sync-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Syncing…'; }

  const { data: members } = await sb.from('members')
    .select('id')
    .eq('membership_status', 'active');

  let count = 0;
  for (const m of (members ?? [])) {
    await syncFinancialStanding(m.id);
    count++;
  }

  if (btn) { btn.disabled = false; btn.textContent = `✓ Synced ${count} members`; }
  setTimeout(() => { if (btn) btn.textContent = 'Fix Financial Standing'; }, 3000);
  loadOverview();
  loadMembers();
}

function getCurrentFiscalYear() {
  // Fiscal year runs July–June: July 2024 → June 2025 = "2024-25"
  const now   = new Date();
  const month = now.getMonth(); // 0 = Jan
  const year  = now.getFullYear();
  const start = month >= 6 ? year : year - 1; // July = month 6
  return `${start}-${String(start + 1).slice(-2)}`;
}

async function saveDues() {
  if (!drawerMember) return;
  const owed = parseFloat(document.getElementById('fin-amount_owed').value) || 0;
  const paid = parseFloat(document.getElementById('fin-amount_paid').value) || 0;
  const fiscalYear = document.getElementById('fin-fiscal_year').value.trim() || getCurrentFiscalYear();
  const data = {
    member_id:      drawerMember.id,
    fiscal_year:    fiscalYear,
    term:           document.getElementById('fin-term').value,
    amount_owed:    owed,
    amount_paid:    paid,
    paid_date:      document.getElementById('fin-paid_date').value || null,
    payment_method: document.getElementById('fin-payment_method').value || null,
    payment_status: paid >= owed && owed > 0 ? 'paid' : paid > 0 ? 'partial' : 'outstanding',
  };
  const { error } = await sb.from('dues_payments').insert(data);
  if (!error) {
    showSaved();
    await syncFinancialStanding(drawerMember.id);
    loadDrawerFinancial();
    loadFinancial();
    loadOverview();
  } else alert('Error: ' + error.message);
}

async function saveGrandTax() {
  if (!drawerMember) return;
  const owed = parseFloat(document.getElementById('tax-amount_owed').value) || 0;
  const paid = parseFloat(document.getElementById('tax-amount_paid').value) || 0;
  const year = document.getElementById('tax-fiscal_year').value.trim() || getCurrentFiscalYear();
  const data = {
    member_id:           drawerMember.id,
    fiscal_year:         year,
    amount_owed:         owed,
    amount_paid:         paid,
    paid_date:           document.getElementById('tax-paid_date').value || null,
    confirmation_number: document.getElementById('tax-confirmation_number').value.trim() || null,
    payment_status:      paid >= owed && owed > 0 ? 'paid' : paid > 0 ? 'partial' : 'outstanding',
  };
  const { error } = await sb.from('grand_tax').upsert(data, { onConflict: 'member_id,fiscal_year' });
  if (!error) {
    showSaved();
    await syncFinancialStanding(drawerMember.id);
    loadDrawerFinancial();
    loadFinancial();
    loadOverview();
  } else alert('Error: ' + error.message);
}

// ── CERTIFICATIONS ─────────────────────────────────────────────
async function loadDrawerCerts() {
  if (!drawerMember) return;
  const { data } = await sb.from('certifications').select('*').eq('member_id', drawerMember.id);
  existingCerts = {};
  (data ?? []).forEach(c => { existingCerts[c.cert_type] = c; });

  ['imdp','risk_management','ritual_training'].forEach(type => {
    const c = existingCerts[type];
    const fields = ['status','provider','completed_date','expiration_date','certificate_number'];
    fields.forEach(f => {
      const el = document.getElementById(`cert-${type}-${f}`);
      if (el) el.value = c?.[f] ?? (f === 'status' ? 'not_filed' : '');
    });
  });
}

async function saveCert(type) {
  if (!drawerMember) return;
  const fields = ['status','provider','completed_date','expiration_date','certificate_number'];
  const data   = { member_id: drawerMember.id, cert_type: type };
  fields.forEach(f => {
    const v = document.getElementById(`cert-${type}-${f}`)?.value?.trim();
    data[f] = v || null;
  });
  data.status = document.getElementById(`cert-${type}-status`)?.value ?? 'not_filed';

  let error;
  if (existingCerts[type]) {
    ({ error } = await sb.from('certifications').update(data).eq('id', existingCerts[type].id));
  } else {
    ({ error } = await sb.from('certifications').insert(data));
  }
  if (!error) { showSaved(); loadDrawerCerts(); loadCompliance(); }
  else alert('Error: ' + error.message);
}

// ── BACKGROUND CHECK ───────────────────────────────────────────
async function loadDrawerBGC() {
  if (!drawerMember) return;
  const { data } = await sb.from('background_checks').select('*').eq('member_id', drawerMember.id).order('created_at', { ascending: false }).limit(1);
  existingBGC = data?.[0] ?? null;
  const b = existingBGC;
  ['status','result','provider','submitted_date','completed_date','expiration_date','notes'].forEach(f => {
    const el = document.getElementById('bgc-' + f);
    if (el) el.value = b?.[f] ?? '';
  });
  bgcYouth = !!b?.youth_eligible;
  const el  = document.getElementById('bgc-youth_eligible');
  const lbl = document.getElementById('bgc-youth_eligible-label');
  if (el)  el.classList.toggle('on', bgcYouth);
  if (lbl) lbl.textContent = bgcYouth ? 'Yes' : 'No';
}

async function saveBGC() {
  if (!drawerMember) return;
  const data = { member_id: drawerMember.id };
  ['status','result','provider','submitted_date','completed_date','expiration_date','notes'].forEach(f => {
    const v = document.getElementById('bgc-' + f)?.value?.trim();
    data[f] = v || null;
  });
  data.youth_eligible = bgcYouth;
  data.status = document.getElementById('bgc-status')?.value ?? 'not_filed';

  let error;
  if (existingBGC) {
    ({ error } = await sb.from('background_checks').update(data).eq('id', existingBGC.id));
  } else {
    ({ error } = await sb.from('background_checks').insert(data));
  }
  if (!error) { showSaved(); loadDrawerBGC(); loadCompliance(); }
  else alert('Error: ' + error.message);
}

// ── LEADERSHIP TAB ─────────────────────────────────────────────
let allRoles = [];

async function loadDrawerLeadership() {
  if (!drawerMember) return;

  // Load available roles into select
  if (!allRoles.length) await refreshRoles();

  // Load this member's role history
  const { data } = await sb
    .from('member_roles')
    .select('*, leadership_roles(role_name, role_type, committee_name, is_exec_board)')
    .eq('member_id', drawerMember.id)
    .order('term_year', { ascending: false });

  const el = document.getElementById('member-roles-list');
  if (!data?.length) {
    el.innerHTML = '<p style="color:var(--dim);font-size:12px;padding:8px 0">No roles assigned yet.</p>';
    return;
  }

  el.innerHTML = data.map(r => {
    const lr      = r.leadership_roles;
    const current = r.is_current;
    return `<div style="background:var(--surf2);border:1px solid var(--gold-border);border-radius:var(--r);padding:10px 12px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:flex-start;gap:10px">
      <div>
        <div style="font-family:var(--fd);font-size:11px;color:var(--gold);margin-bottom:3px">${lr?.role_name ?? '—'}</div>
        <div style="font-size:11px;color:var(--muted)">${lr?.committee_name ? lr.committee_name + ' · ' : ''}${r.term_year ?? ''}${r.start_date ? ' · ' + new Date(r.start_date).toLocaleDateString() : ''}</div>
      </div>
      <div style="display:flex;gap:6px;align-items:center;flex-shrink:0">
        ${current ? badge('Current','green') : badge('Past','dim')}
        <button onclick="removeRole('${r.id}')" style="background:none;border:1px solid rgba(201,76,76,0.3);color:var(--red);border-radius:4px;padding:2px 8px;font-size:10px;cursor:pointer">Remove</button>
      </div>
    </div>`;
  }).join('');
}

async function refreshRoles() {
  const { data } = await sb.from('leadership_roles').select('*').eq('is_active', true).order('role_name');
  allRoles = data ?? [];
  const sel = document.getElementById('role-role_id');
  if (sel) {
    sel.innerHTML = '<option value="">Select position…</option>' +
      allRoles.map(r => `<option value="${r.id}">${r.role_name}${r.committee_name ? ' — ' + r.committee_name : ''}</option>`).join('');
  }
}

async function saveRole() {
  if (!drawerMember) return;
  const roleId = document.getElementById('role-role_id')?.value;
  if (!roleId) { alert('Please select a position.'); return; }

  const isCurrent = document.getElementById('role-is_current')?.value === 'true';

  // If marking as current, set all previous roles for this member to not current
  if (isCurrent) {
    await sb.from('member_roles').update({ is_current: false }).eq('member_id', drawerMember.id);
  }

  const data = {
    member_id:  drawerMember.id,
    role_id:    roleId,
    term_year:  document.getElementById('role-term_year')?.value?.trim() || null,
    start_date: document.getElementById('role-start_date')?.value || null,
    end_date:   document.getElementById('role-end_date')?.value   || null,
    is_current: isCurrent,
  };

  const { error } = await sb.from('member_roles').insert(data);
  if (!error) {
    showSaved();
    // Clear fields
    ['role-term_year','role-start_date','role-end_date'].forEach(id => {
      const el = document.getElementById(id); if (el) el.value = '';
    });
    document.getElementById('role-role_id').value = '';
    loadDrawerLeadership();
    loadLeadership();
  } else {
    alert('Error: ' + error.message);
  }
}

async function removeRole(id) {
  if (!confirm('Remove this role assignment?')) return;
  const { error } = await sb.from('member_roles').delete().eq('id', id);
  if (!error) { showSaved(); loadDrawerLeadership(); loadLeadership(); }
  else alert('Error: ' + error.message);
}

// ── ROLE MANAGER MODAL ─────────────────────────────────────────
async function openRoleManagerModal() {
  document.getElementById('role-manager-modal').style.display = 'flex';
  loadAllRolesList();
}

async function loadAllRolesList() {
  const { data } = await sb.from('leadership_roles').select('*').order('is_exec_board', { ascending: false }).order('role_name');
  const el = document.getElementById('all-roles-list');
  if (!data?.length) { el.innerHTML = '<p style="color:var(--dim);font-size:12px">No positions defined yet.</p>'; return; }

  // Group: exec board first, then committees
  const exec = data.filter(r => r.is_exec_board);
  const comm = data.filter(r => !r.is_exec_board);

  function renderGroup(title, rows) {
    if (!rows.length) return '';
    return `
      <div style="font-family:var(--fd);font-size:9px;letter-spacing:.14em;color:var(--gold-dim);text-transform:uppercase;margin:12px 0 6px">${title}</div>
      ${rows.map(r => `
        <div id="role-row-${r.id}" style="background:var(--surf2);border:1px solid var(--gold-border);border-radius:var(--r);padding:10px 12px;margin-bottom:6px">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
            <div style="flex:1;min-width:0">
              <div id="role-display-${r.id}" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                <span style="font-size:13px;color:var(--text);font-weight:600">${r.role_name}</span>
                ${r.committee_name ? `<span style="color:var(--muted);font-size:11px">${r.committee_name}</span>` : ''}
                ${badge(r.role_type.replace(/_/g,' '), r.is_exec_board ? 'gold' : 'blue')}
                ${badge(r.is_active ? 'Active' : 'Inactive', r.is_active ? 'green' : 'dim')}
              </div>
              <div id="role-edit-${r.id}" style="display:none;margin-top:8px">
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px 10px">
                  <div class="field"><label class="field-label">Position Name</label>
                    <input class="field-input" id="re-name-${r.id}" value="${r.role_name.replace(/"/g,'&quot;')}" style="font-size:13px" />
                  </div>
                  <div class="field"><label class="field-label">Committee</label>
                    <input class="field-input" id="re-committee-${r.id}" value="${(r.committee_name ?? '').replace(/"/g,'&quot;')}" style="font-size:13px" placeholder="If applicable" />
                  </div>
                  <div class="field"><label class="field-label">Role Type</label>
                    <select class="field-input" id="re-type-${r.id}" style="font-size:12px">
                      <option value="exec_board" ${r.role_type==='exec_board'?'selected':''}>Executive Board</option>
                      <option value="committee_chair" ${r.role_type==='committee_chair'?'selected':''}>Committee Chair</option>
                      <option value="committee_member" ${r.role_type==='committee_member'?'selected':''}>Committee Member</option>
                      <option value="appointed" ${r.role_type==='appointed'?'selected':''}>Appointed</option>
                      <option value="national" ${r.role_type==='national'?'selected':''}>National</option>
                      <option value="regional" ${r.role_type==='regional'?'selected':''}>Regional</option>
                    </select>
                  </div>
                  <div class="field"><label class="field-label">Exec Board?</label>
                    <select class="field-input" id="re-exec-${r.id}" style="font-size:12px">
                      <option value="true"  ${r.is_exec_board?'selected':''}>Yes</option>
                      <option value="false" ${!r.is_exec_board?'selected':''}>No</option>
                    </select>
                  </div>
                </div>
                <div style="display:flex;gap:6px;margin-top:8px">
                  <button onclick="saveRoleEdit('${r.id}')" style="background:var(--gold);color:var(--black);border:none;border-radius:var(--r);padding:5px 12px;font-family:var(--fd);font-size:10px;letter-spacing:.08em;cursor:pointer;text-transform:uppercase">Save</button>
                  <button onclick="cancelRoleEdit('${r.id}')" style="background:none;border:1px solid var(--gold-border);color:var(--muted);border-radius:var(--r);padding:5px 12px;font-family:var(--fd);font-size:10px;cursor:pointer;text-transform:uppercase">Cancel</button>
                </div>
              </div>
            </div>
            <div style="display:flex;gap:5px;flex-shrink:0;margin-top:2px">
              <button onclick="startRoleEdit('${r.id}')" style="background:none;border:1px solid var(--gold-border);color:var(--gold);border-radius:4px;padding:3px 9px;font-size:10px;cursor:pointer">Edit</button>
              <button onclick="toggleRoleActive('${r.id}',${r.is_active})" style="background:none;border:1px solid var(--gold-border);color:var(--muted);border-radius:4px;padding:3px 9px;font-size:10px;cursor:pointer">${r.is_active ? 'Hide' : 'Show'}</button>
            </div>
          </div>
        </div>`).join('')}`;
  }

  el.innerHTML = renderGroup('Executive Board', exec) + renderGroup('Committees & Other', comm);
}

function startRoleEdit(id) {
  document.getElementById(`role-display-${id}`).style.display = 'none';
  document.getElementById(`role-edit-${id}`).style.display    = 'block';
}

function cancelRoleEdit(id) {
  document.getElementById(`role-display-${id}`).style.display = 'flex';
  document.getElementById(`role-edit-${id}`).style.display    = 'none';
}

async function saveRoleEdit(id) {
  const name      = document.getElementById(`re-name-${id}`)?.value?.trim();
  const committee = document.getElementById(`re-committee-${id}`)?.value?.trim();
  const roleType  = document.getElementById(`re-type-${id}`)?.value;
  const isExec    = document.getElementById(`re-exec-${id}`)?.value === 'true';

  if (!name) { alert('Position name cannot be empty.'); return; }

  const { error } = await sb.from('leadership_roles').update({
    role_name:     name,
    committee_name: committee || null,
    role_type:     roleType,
    is_exec_board: isExec,
  }).eq('id', id);

  if (!error) {
    allRoles = [];
    await refreshRoles();
    loadAllRolesList();
  } else alert('Error: ' + error.message);
}

async function saveNewRole() {
  const name = document.getElementById('nr-role_name')?.value?.trim();
  if (!name) { alert('Position name is required.'); return; }
  const data = {
    role_name:      name,
    role_type:      document.getElementById('nr-role_type')?.value ?? 'committee_chair',
    committee_name: document.getElementById('nr-committee_name')?.value?.trim() || null,
    is_exec_board:  document.getElementById('nr-is_exec_board')?.value === 'true',
    description:    document.getElementById('nr-description')?.value?.trim() || null,
    is_active:      true,
  };
  const { error } = await sb.from('leadership_roles').insert(data);
  if (!error) {
    ['nr-role_name','nr-committee_name','nr-description'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    allRoles = [];
    await refreshRoles();
    loadAllRolesList();
  } else alert('Error: ' + error.message);
}

async function toggleRoleActive(id, current) {
  await sb.from('leadership_roles').update({ is_active: !current }).eq('id', id);
  allRoles = [];
  await refreshRoles();
  loadAllRolesList();
}

// ── UPDATED CERT SAVE (with year_valid in notes field) ─────────
async function saveCert(type) {
  if (!drawerMember) return;
  const fields = ['status','provider','completed_date','expiration_date','certificate_number'];
  const data   = { member_id: drawerMember.id, cert_type: type };
  fields.forEach(f => {
    const v = document.getElementById(`cert-${type}-${f}`)?.value?.trim();
    data[f] = v || null;
  });
  data.status = document.getElementById(`cert-${type}-status`)?.value ?? 'not_filed';
  // Store year_valid in notes field (prefixed so it's parseable)
  const yearVal = document.getElementById(`cert-${type}-year_valid`)?.value?.trim();
  if (yearVal) data.notes = `year_valid:${yearVal}`;

  let error;
  if (existingCerts[type]) {
    ({ error } = await sb.from('certifications').update(data).eq('id', existingCerts[type].id));
  } else {
    ({ error } = await sb.from('certifications').insert(data));
  }
  if (!error) { showSaved(); loadDrawerCerts(); loadCompliance(); }
  else alert('Error: ' + error.message);
}

// Update loadDrawerCerts to also load year_valid
async function loadDrawerCerts() {
  if (!drawerMember) return;
  const { data } = await sb.from('certifications').select('*').eq('member_id', drawerMember.id);
  existingCerts = {};
  (data ?? []).forEach(c => { existingCerts[c.cert_type] = c; });

  ['imdp','risk_management','ritual_training'].forEach(type => {
    const c = existingCerts[type];
    ['status','provider','completed_date','expiration_date','certificate_number'].forEach(f => {
      const el = document.getElementById(`cert-${type}-${f}`);
      if (el) el.value = c?.[f] ?? (f === 'status' ? 'not_filed' : '');
    });
    // Parse year_valid from notes
    const yrEl = document.getElementById(`cert-${type}-year_valid`);
    if (yrEl && c?.notes?.startsWith('year_valid:')) {
      yrEl.value = c.notes.replace('year_valid:', '');
    } else if (yrEl) {
      yrEl.value = '';
    }
  });

  // Render extra certs
  const extra = Object.values(existingCerts).filter(c => c.cert_type === 'other');
  const extraEl = document.getElementById('extra-certs-list');
  if (extraEl && extra.length) {
    extraEl.innerHTML = extra.map(c => `
      <div class="cert-card" style="border-color:var(--blue)">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <div class="cert-card-title" style="margin-bottom:0">${c.certificate_number ?? 'Other Cert'}</div>
          <button onclick="deleteCert('${c.id}')" style="background:none;border:1px solid rgba(201,76,76,0.3);color:var(--red);border-radius:4px;padding:2px 8px;font-size:10px;cursor:pointer">Remove</button>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:12px;color:var(--muted)">
          <span>Status: ${badge(c.status ?? 'not_filed', c.status === 'current' ? 'green' : 'dim')}</span>
          <span>Year: ${c.notes?.startsWith('year_valid:') ? c.notes.replace('year_valid:','') : '—'}</span>
          <span>Completed: ${c.completed_date ? new Date(c.completed_date).toLocaleDateString() : '—'}</span>
          <span>Expires: ${c.expiration_date ? new Date(c.expiration_date).toLocaleDateString() : '—'}</span>
        </div>
      </div>`).join('');
  } else if (extraEl) {
    extraEl.innerHTML = '';
  }
}

async function saveNewCert() {
  if (!drawerMember) return;
  const name = document.getElementById('new-cert-name')?.value?.trim();
  if (!name) { alert('Certification name is required.'); return; }
  const yearVal = document.getElementById('new-cert-year_valid')?.value?.trim();
  const data = {
    member_id:        drawerMember.id,
    cert_type:        'other',
    status:           document.getElementById('new-cert-status')?.value ?? 'current',
    provider:         document.getElementById('new-cert-provider')?.value?.trim() || null,
    completed_date:   document.getElementById('new-cert-completed_date')?.value || null,
    expiration_date:  document.getElementById('new-cert-expiration_date')?.value || null,
    certificate_number: name, // store name in certificate_number field
    notes:            yearVal ? `year_valid:${yearVal}` : null,
  };
  const { error } = await sb.from('certifications').insert(data);
  if (!error) {
    showSaved();
    ['new-cert-name','new-cert-year_valid','new-cert-completed_date','new-cert-expiration_date','new-cert-provider'].forEach(id => {
      const el = document.getElementById(id); if (el) el.value = '';
    });
    loadDrawerCerts();
  } else alert('Error: ' + error.message);
}

async function deleteCert(id) {
  if (!confirm('Remove this certification?')) return;
  const { error } = await sb.from('certifications').delete().eq('id', id);
  if (!error) { showSaved(); loadDrawerCerts(); }
  else alert('Error: ' + error.message);
}

// ── CONFERENCES PANEL ──────────────────────────────────────────
let allConferences   = [];
let activeConfYear   = null;

async function loadConferences() {
  const { data } = await sb.from('conferences').select('*').order('year', { ascending: false }).order('name');
  allConferences = data ?? [];

  const years = [...new Set(allConferences.map(c => c.year))];
  if (!activeConfYear || !years.includes(activeConfYear)) {
    activeConfYear = years[0] ?? null;
  }

  renderConfYearTabs(years);
  await renderConferenceList();
}

function renderConfYearTabs(years) {
  const row = document.getElementById('conf-year-tab-row');
  if (!row) return;
  if (!years.length) {
    row.innerHTML = '<span style="font-size:12px;color:var(--dim)">No conferences yet — add one to get started.</span>';
    return;
  }
  row.innerHTML = `<button class="term-tab ${activeConfYear === 'all' ? 'active' : ''}" onclick="switchConfYear('all')">All Years</button>` +
    years.map(y => `<button class="term-tab ${y === activeConfYear ? 'active' : ''}" onclick="switchConfYear(${y})">${y}</button>`).join('');
}

function switchConfYear(year) {
  activeConfYear = year;
  const years = [...new Set(allConferences.map(c => c.year))];
  renderConfYearTabs(years);
  renderConferenceList();
}

async function renderConferenceList() {
  const filtered = activeConfYear === 'all' || !activeConfYear
    ? allConferences
    : allConferences.filter(c => c.year === activeConfYear);

  // Stats
  const { data: allAttendance } = await sb.from('conference_attendance').select('conference_id, member_id');
  const totalAttendanceRecords = (allAttendance ?? []).length;
  const uniqueAttendees = new Set((allAttendance ?? []).map(a => a.member_id)).size;

  document.getElementById('conferences-stats').innerHTML =
    statCard('Total Conferences', allConferences.length, 'On record') +
    statCard('This Selection',    filtered.length, activeConfYear === 'all' ? 'All years' : `Year ${activeConfYear}`) +
    statCard('Attendance Records', totalAttendanceRecords, 'Total check-ins') +
    statCard('Unique Brothers',   uniqueAttendees, 'Have attended');

  const listEl = document.getElementById('conferences-list');
  if (!filtered.length) {
    listEl.innerHTML = '<div class="empty-msg">No conferences recorded yet.</div>';
    return;
  }

  // Fetch attendee counts per conference
  const cards = await Promise.all(filtered.map(async (conf) => {
    const { data: attendees } = await sb
      .from('conference_attendance')
      .select('*, members(first_name,last_name)')
      .eq('conference_id', conf.id);

    const chips = (attendees ?? []).map(a =>
      `<span class="attendee-chip">${a.members?.first_name ?? ''} ${a.members?.last_name ?? ''}${a.role && a.role !== 'attendee' ? ' · ' + a.role : ''}</span>`
    ).join('');

    return `<div class="conference-card">
      <div class="conference-card-top">
        <div>
          <div class="conference-name">${conf.name}</div>
          <div class="conference-meta">${conf.year} ${conf.location ? '· ' + conf.location : ''} ${conf.conference_type ? '· ' + badge(conf.conference_type, 'gold') : ''}</div>
        </div>
        <button class="btn-secondary" style="padding:5px 12px;font-size:9px" onclick="openConferenceAttendanceModal('${conf.id}')">Manage Attendees (${(attendees ?? []).length})</button>
      </div>
      <div class="conference-attendee-chips">
        ${chips || '<span style="color:var(--dim);font-size:12px">No attendees logged yet.</span>'}
      </div>
    </div>`;
  }));

  listEl.innerHTML = cards.join('');
}

function openConferenceModal() {
  ['cf-name','cf-year','cf-location','cf-start_date','cf-end_date'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  document.getElementById('cf-conference_type').value = 'regional';
  document.getElementById('conference-modal-error').style.display = 'none';
  document.getElementById('conference-modal').style.display = 'flex';
}

async function saveConference() {
  const errEl = document.getElementById('conference-modal-error');
  errEl.style.display = 'none';

  const name = document.getElementById('cf-name')?.value?.trim();
  const year = parseInt(document.getElementById('cf-year')?.value);

  if (!name) { errEl.textContent = 'Conference name is required.'; errEl.style.display='block'; return; }
  if (!year) { errEl.textContent = 'Year is required.'; errEl.style.display='block'; return; }

  const data = {
    name,
    year,
    conference_type: document.getElementById('cf-conference_type')?.value,
    location:        document.getElementById('cf-location')?.value?.trim() || null,
    start_date:      document.getElementById('cf-start_date')?.value || null,
    end_date:        document.getElementById('cf-end_date')?.value || null,
  };

  const { error } = await sb.from('conferences').insert(data);
  if (error) { errEl.textContent = error.message; errEl.style.display='block'; return; }

  closeModal('conference-modal');
  loadConferences();
}

// ── CONFERENCE ATTENDANCE MODAL ────────────────────────────────
let activeConferenceId = null;

async function openConferenceAttendanceModal(conferenceId) {
  activeConferenceId = conferenceId;
  const conf = allConferences.find(c => c.id === conferenceId);
  document.getElementById('conf-attendance-title').textContent = conf ? `${conf.name} (${conf.year})` : 'Conference Attendees';

  const { data: members } = await sb.from('members').select('id,first_name,last_name').eq('membership_status','active').order('last_name');
  const sel = document.getElementById('ca-member_id');
  sel.innerHTML = '<option value="">Select brother…</option>' +
    (members ?? []).map(m => `<option value="${m.id}">${m.first_name} ${m.last_name}</option>`).join('');

  await renderConferenceAttendeeList();
  document.getElementById('conf-attendance-modal').style.display = 'flex';
}

async function renderConferenceAttendeeList() {
  const { data } = await sb
    .from('conference_attendance')
    .select('*, members(first_name,last_name,email_primary)')
    .eq('conference_id', activeConferenceId);

  const el = document.getElementById('conf-attendee-list');
  if (!data?.length) { el.innerHTML = '<p style="color:var(--dim);font-size:12px">No attendees yet.</p>'; return; }

  el.innerHTML = data.map(a => `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid rgba(201,168,76,0.07);font-size:13px">
      <div>
        <span style="color:var(--text)">${a.members?.first_name ?? ''} ${a.members?.last_name ?? ''}</span>
        <span style="margin-left:8px">${badge(a.role ?? 'attendee', 'gold')}</span>
      </div>
      <button onclick="removeConferenceAttendee('${a.id}')" style="background:none;border:1px solid rgba(201,76,76,0.3);color:var(--red);border-radius:4px;padding:2px 8px;font-size:10px;cursor:pointer">Remove</button>
    </div>`).join('');
}

async function addConferenceAttendee() {
  const memberId = document.getElementById('ca-member_id')?.value;
  if (!memberId) { alert('Please select a brother.'); return; }

  const data = {
    conference_id: activeConferenceId,
    member_id:     memberId,
    role:          document.getElementById('ca-role')?.value,
    notes:         document.getElementById('ca-notes')?.value?.trim() || null,
  };

  const { error } = await sb.from('conference_attendance').insert(data);
  if (error) { alert('Error: ' + error.message); return; }

  document.getElementById('ca-member_id').value = '';
  document.getElementById('ca-notes').value = '';
  renderConferenceAttendeeList();
  renderConferenceList();
}

async function removeConferenceAttendee(id) {
  if (!confirm('Remove this attendance record?')) return;
  await sb.from('conference_attendance').delete().eq('id', id);
  renderConferenceAttendeeList();
  renderConferenceList();
}

// ── MEMBER DRAWER: CONFERENCE TAB ──────────────────────────────
async function loadDrawerConferences() {
  if (!drawerMember) return;

  // Populate conference dropdown
  if (!allConferences.length) {
    const { data } = await sb.from('conferences').select('*').order('year', { ascending: false });
    allConferences = data ?? [];
  }
  const sel = document.getElementById('mc-conference_id');
  if (sel) {
    sel.innerHTML = '<option value="">Select conference…</option>' +
      allConferences.map(c => `<option value="${c.id}">${c.name} (${c.year})</option>`).join('');
  }

  // Load this member's history
  const { data: history } = await sb
    .from('conference_attendance')
    .select('*, conferences(name, year, location, conference_type)')
    .eq('member_id', drawerMember.id)
    .order('created_at', { ascending: false });

  const el = document.getElementById('member-conferences-list');
  if (!history?.length) {
    el.innerHTML = '<p style="color:var(--dim);font-size:12px;padding:8px 0">No conference attendance recorded yet.</p>';
    return;
  }

  el.innerHTML = history.map(h => {
    const c = h.conferences;
    return `<div style="background:var(--surf2);border:1px solid var(--gold-border);border-radius:var(--r);padding:10px 12px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center">
      <div>
        <div style="font-family:var(--fd);font-size:11px;color:var(--gold)">${c?.name ?? '—'} (${c?.year ?? '—'})</div>
        <div style="font-size:11px;color:var(--muted);margin-top:2px">${c?.location ?? ''} ${badge(h.role ?? 'attendee','gold')}</div>
      </div>
      <button onclick="removeMemberConferenceRecord('${h.id}')" style="background:none;border:1px solid rgba(201,76,76,0.3);color:var(--red);border-radius:4px;padding:2px 8px;font-size:10px;cursor:pointer">Remove</button>
    </div>`;
  }).join('');
}

async function addMemberConferenceRecord() {
  if (!drawerMember) return;
  const confId = document.getElementById('mc-conference_id')?.value;
  if (!confId) { alert('Please select a conference.'); return; }

  const data = {
    member_id:     drawerMember.id,
    conference_id: confId,
    role:          document.getElementById('mc-role')?.value,
    notes:         document.getElementById('mc-notes')?.value?.trim() || null,
  };

  const { error } = await sb.from('conference_attendance').insert(data);
  if (error) { alert('Error: ' + error.message); return; }

  showSaved();
  document.getElementById('mc-notes').value = '';
  loadDrawerConferences();
}

async function removeMemberConferenceRecord(id) {
  if (!confirm('Remove this record?')) return;
  await sb.from('conference_attendance').delete().eq('id', id);
  loadDrawerConferences();
}

// ── PROFILE PHOTO ──────────────────────────────────────────────
function renderProfilePhoto(url) {
  const img  = document.getElementById('profile-photo-img');
  const ph   = document.getElementById('profile-photo-placeholder');
  if (url) {
    img.src = url;
    img.style.display = 'block';
    ph.style.display = 'none';
  } else {
    img.style.display = 'none';
    ph.style.display = 'block';
  }
}

async function handlePhotoFileSelect(event) {
  if (!drawerMember) return;
  const file = event.target.files?.[0];
  if (!file) return;

  const statusEl = document.getElementById('photo-upload-status');
  statusEl.textContent = 'Uploading…';
  statusEl.style.color = 'var(--muted)';

  // Validate file type and size
  if (!file.type.startsWith('image/')) {
    statusEl.textContent = 'Please select an image file.';
    statusEl.style.color = 'var(--red)';
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    statusEl.textContent = 'Image must be under 5MB.';
    statusEl.style.color = 'var(--red)';
    return;
  }

  const ext      = file.name.split('.').pop();
  const filePath = `${drawerMember.id}-${Date.now()}.${ext}`;

  const { error: uploadError } = await sb.storage
    .from('member-photos')
    .upload(filePath, file, { upsert: true });

  if (uploadError) {
    statusEl.textContent = 'Upload failed: ' + uploadError.message;
    statusEl.style.color = 'var(--red)';
    return;
  }

  const { data: urlData } = sb.storage.from('member-photos').getPublicUrl(filePath);
  const publicUrl = urlData.publicUrl;

  // Save to member record immediately
  const { error: updateError } = await sb.from('members').update({ photo_url: publicUrl }).eq('id', drawerMember.id);

  if (updateError) {
    statusEl.textContent = 'Saved upload but failed to link to profile: ' + updateError.message;
    statusEl.style.color = 'var(--red)';
    return;
  }

  drawerMember.photo_url = publicUrl;
  document.getElementById('dp-photo_url').value = publicUrl;
  renderProfilePhoto(publicUrl);
  statusEl.textContent = '✓ Photo uploaded and saved';
  statusEl.style.color = 'var(--green)';
  loadMembers();
}

async function handlePhotoUrlInput() {
  if (!drawerMember) return;
  const url = document.getElementById('dp-photo_url')?.value?.trim();
  if (!url) return;

  const statusEl = document.getElementById('photo-upload-status');

  const { error } = await sb.from('members').update({ photo_url: url }).eq('id', drawerMember.id);
  if (error) {
    statusEl.textContent = 'Failed to save: ' + error.message;
    statusEl.style.color = 'var(--red)';
    return;
  }

  drawerMember.photo_url = url;
  renderProfilePhoto(url);
  statusEl.textContent = '✓ Photo URL saved';
  statusEl.style.color = 'var(--green)';
  loadMembers();
}

async function removePhoto() {
  if (!drawerMember) return;
  if (!confirm('Remove this member\'s photo?')) return;

  const { error } = await sb.from('members').update({ photo_url: null }).eq('id', drawerMember.id);
  if (error) { alert('Error: ' + error.message); return; }

  drawerMember.photo_url = null;
  document.getElementById('dp-photo_url').value = '';
  document.getElementById('dp-photo-file').value = '';
  renderProfilePhoto(null);
  document.getElementById('photo-upload-status').textContent = '✓ Photo removed';
  document.getElementById('photo-upload-status').style.color = 'var(--green)';
  loadMembers();
}
