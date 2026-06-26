/* ─────────────────────────────────────────────────────────────────
   Chapter Command — app.js
   Plain JavaScript + Supabase JS SDK (loaded from CDN in index.html)
   No build step. No framework. Drop on Vercel and it works.
───────────────────────────────────────────────────────────────── */

// ── CONFIG — paste your Supabase credentials here ──────────────
const SUPABASE_URL  = 'https://eiiybwmmxfayuutjcinn.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVpaXlid21teGZheXV1dGpjaW5uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1MDcyNzEsImV4cCI6MjA5NjA4MzI3MX0.TfYFylax6MQE6igsmxwQUKiWvClaCkxbnFq1nU56RQU';

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
  financial: 'Financial', leadership: 'Leadership', events: 'Events',
  reports: 'Reports', documents: 'Documents'
};

function showPanel(name) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
  document.getElementById('panel-' + name).classList.add('active');
  document.querySelector(`.nav-link[data-panel="${name}"]`).classList.add('active');
  document.getElementById('header-label').textContent = PANEL_LABELS[name] ?? name;
  document.getElementById('sidebar').classList.remove('open');

  const loaders = {
    overview:   loadOverview,
    members:    loadMembers,
    compliance: loadCompliance,
    financial:  loadFinancial,
    leadership: loadLeadership,
    events:     loadEvents,
    documents:  loadDocuments,
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
async function loadLeadership() {
  const { data } = await sb.from('v_leadership_roster').select('*');
  const rows     = data ?? [];
  const exec     = rows.filter(r => r.is_exec_board);
  const comm     = rows.filter(r => !r.is_exec_board);

  document.getElementById('leadership-stats').innerHTML =
    statCard('Exec Board Seats',  exec.length,             'Currently filled',   'good') +
    statCard('Committee Chairs',  comm.length,             'Active committees') +
    statCard('Total Roles',       rows.length,             'Current term') +
    statCard('Board Vacancies',   Math.max(0,12-exec.length), 'Open positions', exec.length < 12 ? 'warn' : 'good');

  document.getElementById('exec-tbody').innerHTML = !exec.length ? emptyRow(4,'No exec board assignments found.') : exec.map(r => `<tr>
    <td>${badge(r.role_name,'gold')}</td>
    <td>${r.brother_name}</td>
    <td style="color:var(--muted);font-size:12px">${r.email_primary}</td>
    <td>${r.term_year ?? '—'}</td>
  </tr>`).join('');

  document.getElementById('committee-tbody').innerHTML = !comm.length ? emptyRow(4,'No committee assignments found.') : comm.map(r => `<tr>
    <td>${r.committee_name ?? r.role_name}</td>
    <td>${r.brother_name}</td>
    <td style="color:var(--muted);font-size:12px">${r.email_primary}</td>
    <td>${r.term_year ?? '—'}</td>
  </tr>`).join('');
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

  switchDrawerTab('profile');
  loadDrawerFinancial();
  loadDrawerCerts();
  loadDrawerBGC();

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
    const tabs = ['profile','financial','certs','bgc'];
    b.classList.toggle('active', tabs[i] === tab);
  });
  document.querySelectorAll('.drawer-tab-content').forEach(c => c.classList.remove('active'));
  document.getElementById('dtab-' + tab).classList.add('active');
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

async function saveDues() {
  if (!drawerMember) return;
  const owed = parseFloat(document.getElementById('fin-amount_owed').value) || 0;
  const paid = parseFloat(document.getElementById('fin-amount_paid').value) || 0;
  const data = {
    member_id:      drawerMember.id,
    fiscal_year:    document.getElementById('fin-fiscal_year').value.trim() || '2024-25',
    term:           document.getElementById('fin-term').value,
    amount_owed:    owed,
    amount_paid:    paid,
    paid_date:      document.getElementById('fin-paid_date').value || null,
    payment_method: document.getElementById('fin-payment_method').value || null,
    payment_status: paid >= owed && owed > 0 ? 'paid' : paid > 0 ? 'partial' : 'outstanding',
  };
  const { error } = await sb.from('dues_payments').insert(data);
  if (!error) { showSaved(); loadDrawerFinancial(); loadFinancial(); }
  else alert('Error: ' + error.message);
}

async function saveGrandTax() {
  if (!drawerMember) return;
  const owed = parseFloat(document.getElementById('tax-amount_owed').value) || 0;
  const paid = parseFloat(document.getElementById('tax-amount_paid').value) || 0;
  const year = document.getElementById('tax-fiscal_year').value.trim() || '2024-25';
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
  if (!error) { showSaved(); loadDrawerFinancial(); loadFinancial(); }
  else alert('Error: ' + error.message);
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
