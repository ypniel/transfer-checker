// Transfer Student Checker
// Rules: Migration Amendment (Student Visa Reform) Regulations 2026 (commenced 2 Oct 2026)
//        National Code of Practice 2018, Standard 7 (6-month transfer restriction)

const COMMENCEMENT = '2026-10-02';
const NUM_COES = 5;

const LEVELS = [
  { v: '', label: '— Select —', rank: null },
  { v: 'school', label: 'School', rank: 0 },
  { v: 'elicos', label: 'ELICOS', rank: 0 },
  { v: 'foundation', label: 'Foundation / Non-award', rank: 0 },
  { v: 'cert', label: 'Certificate I–IV (AQF 1–4)', rank: 4 },
  { v: 'diploma', label: 'Diploma (AQF 5)', rank: 5 },
  { v: 'advdip', label: 'Advanced Diploma / Assoc. Degree (AQF 6)', rank: 6 },
  { v: 'bachelor', label: 'Bachelor (AQF 7)', rank: 7 },
  { v: 'gradcert', label: 'Graduate Cert / Diploma (AQF 8)', rank: 8 },
  { v: 'masters', label: 'Masters (AQF 9)', rank: 9 },
  { v: 'doctoral', label: 'Doctoral (AQF 10)', rank: 10 },
];
const levelOf = v => LEVELS.find(l => l.v === v) || LEVELS[0];

// ---------- date helpers (date-only, UTC-safe) ----------
const parse = s => (s ? new Date(s + 'T00:00:00Z') : null);
const iso = d => d.toISOString().slice(0, 10);
const fmt = s => { if (!s) return '—'; const [y, m, d] = s.split('-'); return `${d}/${m}/${y}`; };
const addDays = (s, n) => { const d = parse(s); d.setUTCDate(d.getUTCDate() + n); return iso(d); };
const addMonths = (s, n) => {
  const d = parse(s); const day = d.getUTCDate();
  d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + n);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return iso(d);
};
const today = () => {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
};
const norm = s => (s || '').trim().toLowerCase().replace(/\s+/g, ' ');

// ---------- build form ----------
const $ = id => document.getElementById(id);
function fillLevels(sel) {
  sel.innerHTML = LEVELS.map(l => `<option value="${l.v}">${l.label}</option>`).join('');
}
function buildCoes() {
  const host = $('coes'); const tpl = $('coeTpl');
  for (let i = 1; i <= NUM_COES; i++) {
    const node = tpl.content.cloneNode(true);
    node.querySelector('.n').textContent = i;
    node.querySelector('fieldset').dataset.i = i;
    fillLevels(node.querySelector('select.level'));
    host.appendChild(node);
  }
}
fillLevels($('newLevel'));
buildCoes();
$('asOf').value = today();

const toggleArt = () => $('artBlock').classList.toggle('hidden', $('visaType').value !== 'noSubstantive');
$('visaType').addEventListener('change', toggleArt);
toggleArt();

$('clearBtn').addEventListener('click', () => {
  $('form').reset(); $('asOf').value = today(); $('newProvider').value = 'Holmes Institute'; toggleArt();
  $('results').innerHTML = '<h2>Results</h2><p class="empty">Fill in the form and press Check.</p>';
});

// ---------- read inputs ----------
function readInput() {
  const coes = [...document.querySelectorAll('fieldset.coe')].map(fs => {
    const get = f => fs.querySelector(`[data-f="${f}"]`).value;
    return { n: Number(fs.dataset.i), provider: get('provider').trim(), level: get('level'), start: get('start'), end: get('end') };
  }).filter(c => c.provider || c.start || c.end || c.level);

  return {
    student: $('student').value.trim(),
    asOf: $('asOf').value || today(),
    visaGrant: $('visaGrant').value,
    visaEnd: $('visaEnd').value,
    visaType: $('visaType').value,
    exempt: $('exempt').value,
    artSetAside: $('artSetAside').checked,
    artDate: $('artDate').value,
    priorNoSubGrant: $('priorNoSubGrant').checked,
    releaseBasis: $('releaseBasis').value,
    under18: $('under18').checked,
    semesters: $('semesters').value === '' ? null : Number($('semesters').value),
    lodgeDate: $('lodgeDate').value,
    coes,
    newProvider: $('newProvider').value.trim(),
    newLevel: $('newLevel').value,
    newStart: $('newStart').value,
    newEnd: $('newEnd').value,
  };
}

// ---------- rules ----------
function assess(x) {
  const flags = [];
  const refs = new Set();

  // Data checks
  if (x.visaEnd && x.visaEnd < x.asOf) flags.push({ t: 'bad', m: `Visa end date (${fmt(x.visaEnd)}) is before the assessment date. The student may no longer hold a substantive visa.` });
  if (x.visaGrant && x.visaEnd && x.visaGrant > x.visaEnd) flags.push({ t: 'bad', m: 'Visa grant date is after the visa end date — check the dates.' });
  x.coes.forEach(c => {
    if (c.start && c.end && c.start > c.end) flags.push({ t: 'bad', m: `COE ${c.n}: start date is after end date.` });
    if (c.end && x.visaEnd && c.end > x.visaEnd) flags.push({ t: 'warn', m: `COE ${c.n} ends (${fmt(c.end)}) after the visa end date (${fmt(x.visaEnd)}).` });
  });

  // ----- 1. Release (National Code Standard 7) -----
  let release = { answer: 'Unable to assess', cls: 'warn', why: 'Add at least one COE with a start date.' };
  const dated = x.coes.filter(c => c.start);
  if (dated.length) {
    // Principal course = last course of the package (latest start; tie → latest end)
    const principal = [...dated].sort((a, b) => (a.start === b.start ? (a.end || '').localeCompare(b.end || '') : a.start.localeCompare(b.start))).at(-1);
    // From 2 Oct 2026 (interim, until 30 Jun 2027): non-school students must complete 12 months of the
    // principal course before transferring; school students stay at 6 months.
    const isSchool = principal.level === 'school';
    // Reverts to 6 months for all students from 1 July 2027 (Standard 7 factsheet, updated 2 Oct 2026).
    const months = isSchool || x.asOf >= '2027-07-01' ? 6 : 12;
    const sixMonths = addMonths(principal.start, months);
    const sameProvider = principal.provider && x.newProvider && norm(principal.provider) === norm(x.newProvider);
    refs.add('National Code 2018, Standard 7.1');

    if (sameProvider) {
      release = { answer: 'No', cls: 'good', why: `The principal course (COE ${principal.n}) is already with ${principal.provider}. This is an internal course change, not a provider transfer.`, principal, sixMonths };
    } else if (x.asOf < principal.start) {
      release = { answer: 'Yes', cls: 'bad', why: `The principal course (COE ${principal.n}, ${principal.provider || 'provider not entered'}) has not started yet (starts ${fmt(principal.start)}). The student is within the first ${months} months of their principal course.`, principal, sixMonths };
    } else if (x.asOf < sixMonths) {
      release = { answer: 'Yes', cls: 'bad', why: `The student has not completed ${months} months of the principal course (COE ${principal.n}, started ${fmt(principal.start)}). The restriction lifts on ${fmt(sixMonths)}.`, principal, sixMonths };
    } else {
      release = { answer: 'No', cls: 'good', why: `The student passed ${months} months of the principal course (COE ${principal.n}) on ${fmt(sixMonths)}.`, principal, sixMonths };
    }
  }

  // Ways a student inside the restriction period can still transfer (Standard 7 factsheet).
  const BASIS = {
    released: ['No (release obtained)', 'The current provider has released the student. The outcome must be recorded in PRISMS; a hard-copy letter is not required (an email is enough).'],
    ceased: ['No (provider/course ceased)', 'The releasing provider, or the course the student is enrolled in, has ceased to be registered. Keep evidence on file.'],
    sanction: ['No (ESOS sanction)', 'The releasing provider has a sanction imposed by the ESOS agency that prevents the student continuing. Keep evidence on file.'],
    govSponsor: ['No (sponsor support)', 'A government sponsor considers the change to be in the student\'s best interests and has given written support. Keep the written support on file.'],
  };
  if (x.releaseBasis !== 'none' && BASIS[x.releaseBasis] && release.answer === 'Yes') {
    const [ans, why] = BASIS[x.releaseBasis];
    release = { ...release, answer: ans, cls: 'warn', why: why + ' Original finding: ' + release.why };
  }
  if (release.answer === 'Yes' && release.sixMonths && x.newStart && x.newStart >= release.sixMonths) {
    flags.push({ t: 'warn', m: `The restriction lifts on ${fmt(release.sixMonths)}, before the proposed Holmes start (${fmt(x.newStart)}). Holmes must not enrol the student before then without a release; confirm timing with compliance.` });
  }
  // Cross-check: semesters studied vs the calendar-month rule (the dates decide; semesters never override).
  if (x.semesters !== null && x.semesters !== undefined && release.principal) {
    const base = release.answer.startsWith('No') ? 'No' : release.answer;
    if (base === 'Yes' && x.semesters >= 2) {
      flags.push({ t: 'warn', m: `${x.semesters} semesters recorded, but 12 calendar months have not passed since the principal course started (${fmt(release.principal.start)}). The date rule still applies, so a release is still required. Check the term length: trimesters are about 4 months each.` });
    } else if (base === 'No' && x.semesters <= 1 && release.answer === 'No') {
      flags.push({ t: 'warn', m: `The dates show the restriction has passed, but only ${x.semesters} semester(s) are recorded. Check for a deferral, intermission or suspension, and confirm the principal course start date.` });
    }
  }
  if (x.under18) {
    flags.push({ t: 'warn', m: 'Student is under 18: written confirmation from a parent or legal guardian supporting the transfer is required. If no parent or guardian is in Australia, Holmes must also confirm it accepts accommodation and welfare responsibility under Standard 5.' });
  }
  if (x.coes.some(c => c.start && c.start > x.asOf && release.principal && c !== release.principal && c.n !== release.principal.n)) {
    flags.push({ t: 'warn', m: 'The transfer may change the start dates of later courses on the visa. The student must be released from those courses, or the later providers must agree to delay the start.' });
  }
  if (x.newStart && x.newStart >= '2027-07-01') {
    flags.push({ t: 'warn', m: 'From 1 July 2027 onshore provider changes go through the new Student visa transfer stream, and the new visa must be granted before study starts. The 12-month rule here is the interim measure to 30 June 2027.' });
  }

  // ----- 2. New visa needed? -----
  let needVisa = null; // true / false / null (unknown)
  if (x.newEnd && x.visaEnd) needVisa = x.newEnd > x.visaEnd;
  if (x.visaType !== 'primary500' && x.visaType !== 'offshore') needVisa = true; // not on a primary 500 → needs own 500

  // ----- 3. Where to apply -----
  let where = { answer: 'Unable to assess', cls: 'warn', why: 'Enter the visa end date and the proposed course end date.' };
  const lodge = x.lodgeDate || x.asOf;

  if (needVisa === false) {
    where = { answer: 'No new visa needed', cls: 'good', why: `The current visa (ends ${fmt(x.visaEnd)}) covers the proposed course (ends ${fmt(x.newEnd)}). The student can transfer on the current visa.` };
  } else if (needVisa === true) {
    if (lodge < COMMENCEMENT) {
      where = { answer: 'Onshore (old rules)', cls: 'warn', why: `The application is lodged before ${fmt(COMMENCEMENT)}, so the amendments do not apply (Sch 13, Part 166, cl. 16601). Confirm the lodgement date with the agent.` };
      refs.add('Migration Regulations 1994, Sch 13 cl. 16601');
    } else if (x.visaType === 'offshore') {
      where = { answer: 'Offshore', cls: 'good', why: 'The student is outside Australia and applies from there as usual.' };
    } else if (x.visaType === 'primary500') {
      if (x.exempt !== 'none') {
        where = { answer: 'Onshore', cls: 'good', why: 'The student is in an exempt class, so the offshore requirement does not apply. Keep evidence of the exemption on file.' };
        refs.add('Sch 1 item 1222(3)(aa)(iii) and 1222(3A)');
      } else {
        where = { answer: 'Offshore', cls: 'bad', why: 'The student holds a Subclass 500 visa as the primary applicant and needs a new one. They must be outside Australia when they lodge, and when the visa is granted.' };
        refs.add('Sch 1 item 1222(3)(aa)'); refs.add('Sch 2 cl. 500.411(1)');
      }
    } else if (x.visaType === 'secondary500' || x.visaType === 'otherSubstantive') {
      where = { answer: 'Onshore (confirm)', cls: 'warn', why: 'The student holds a substantive visa, so onshore lodgement may be open if they meet 1222(4A) and are not in a class excluded by instrument under 1222(5)(e). A migration agent should confirm.' };
      refs.add('Sch 1 item 1222(4), (4A)'); refs.add('Sch 1 item 1222(5)(e)');
    } else if (x.visaType === 'noSubstantive') {
      refs.add('Sch 1 item 1222(4B)');
      if (x.artSetAside && x.artDate && !x.priorNoSubGrant) {
        const deadline = addDays(x.artDate, 28);
        if (lodge <= deadline) {
          where = { answer: 'Onshore by ' + fmt(deadline), cls: 'warn', why: `ART set-aside pathway: the student can lodge onshore within 28 days of being notified (${fmt(x.artDate)}). The deadline is ${fmt(deadline)}. This pathway can be used once only.` };
        } else {
          where = { answer: 'Offshore', cls: 'bad', why: `The 28-day window after the ART decision closed on ${fmt(deadline)}. No onshore pathway applies.` };
          refs.add('Sch 2 cl. 500.411(1)');
        }
      } else {
        where = { answer: 'Offshore', cls: 'bad', why: x.priorNoSubGrant
          ? 'The student has already been granted a visa on an application made without a substantive visa, so the ART pathway is not available.'
          : 'The student holds no substantive visa and the ART set-aside pathway does not apply. They must lodge from outside Australia.' };
        refs.add('Sch 2 cl. 500.411(1)');
      }
    }
  }

  // Level change flag
  const principalLevel = release.principal ? levelOf(release.principal.level) : null;
  const newLevel = levelOf(x.newLevel);
  if (principalLevel && principalLevel.rank != null && newLevel.rank != null && newLevel.rank < principalLevel.rank) {
    flags.push({ t: 'bad', m: `Moving from ${principalLevel.label} to a lower level (${newLevel.label}). The 2026 reforms only allow transfers at the same AQF level or higher; a student moving to a lower level needs a new Student visa.` });
    if (principalLevel.rank >= 7 && newLevel.rank >= 4 && newLevel.rank <= 6) {
      flags.push({ t: 'bad', m: 'Higher Education to VET: students can no longer come to Australia for Higher Education and transfer onshore to VET.' });
    }
  }
  if (x.exempt !== 'none' && x.visaType !== 'primary500') {
    flags.push({ t: 'warn', m: 'An exempt class is selected but the student is not a primary 500 holder — the 1222(3A) exemption only affects primary 500 holders.' });
  }

  return { release, where, needVisa, flags, refs: [...refs] };
}

// ---------- summary ----------
function summary(x, r) {
  const L = [];
  const visaLabel = $('visaType').selectedOptions[0].text;
  const exemptLabel = $('exempt').selectedOptions[0].text;
  L.push(`TRANSFER ASSESSMENT${x.student ? ' — ' + x.student : ''}`);
  L.push(`Assessed: ${fmt(x.asOf)}`);
  L.push('');
  L.push('Visa');
  L.push(`- Type: ${visaLabel}`);
  L.push(`- Grant date: ${fmt(x.visaGrant)}  |  End date: ${fmt(x.visaEnd)}`);
  if (x.exempt !== 'none') L.push(`- Exempt class: ${exemptLabel}`);
  L.push('');
  L.push('COEs provided');
  if (!x.coes.length) L.push('- None entered');
  x.coes.forEach(c => L.push(`- COE ${c.n}: ${c.provider || '—'} | ${levelOf(c.level).rank === null ? '—' : levelOf(c.level).label} | ${fmt(c.start)} to ${fmt(c.end)}`));
  if (x.semesters !== null && x.semesters !== undefined) L.push(`Semesters/terms completed at principal provider: ${x.semesters}`);
  L.push(`Proposed: ${x.newProvider || '—'} | ${levelOf(x.newLevel).rank === null ? '—' : levelOf(x.newLevel).label} | ${fmt(x.newStart)} to ${fmt(x.newEnd)}`);
  L.push('');
  L.push(`RELEASE REQUIRED: ${r.release.answer}`);
  L.push(r.release.why);
  L.push('');
  L.push(`MUST APPLY FROM: ${r.where.answer}`);
  L.push(r.where.why);
  if (r.flags.length) {
    L.push('');
    L.push('Flags');
    r.flags.forEach(f => L.push(`- ${f.m}`));
  }
  L.push('');
  L.push('Legislative basis');
  L.push('- Migration Amendment (Student Visa Reform) Regulations 2026, commenced 2 October 2026; applies to visa applications made on or after that date.');
  r.refs.forEach(ref => L.push(`- ${ref}`));
  L.push('');
  L.push('Operational assessment only — not migration advice. Visa strategy to be confirmed by a registered migration agent.');
  return L.join('\n');
}

// ---------- render ----------
const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function render(x, r) {
  const card = (q, o) => `<div class="result ${o.cls}"><div class="q">${q}</div><div class="a">${esc(o.answer)}</div><p>${esc(o.why)}</p></div>`;
  const flags = r.flags.length ? `<ul class="flags">${r.flags.map(f => `<li>${esc(f.m)}</li>`).join('')}</ul>` : '';
  $('results').innerHTML = `
    <h2>Results</h2>
    ${card('Release required?', r.release)}
    ${card('Must apply from?', r.where)}
    ${flags}
    <div class="summary-head"><h3>Summary</h3><button type="button" class="small" id="copy">Copy</button></div>
    <textarea id="summary" readonly>${esc(summary(x, r))}</textarea>`;
  $('copy').addEventListener('click', async () => {
    const t = $('summary');
    try { await navigator.clipboard.writeText(t.value); } catch { t.select(); document.execCommand('copy'); }
    $('copy').textContent = 'Copied';
    setTimeout(() => { const b = $('copy'); if (b) b.textContent = 'Copy'; }, 1500);
  });
}

$('form').addEventListener('submit', e => {
  e.preventDefault();
  const x = readInput();
  render(x, assess(x));
  if (window.innerWidth < 900) $('results').scrollIntoView({ behavior: 'smooth' });
});

// Expose for tests
if (typeof window !== 'undefined') window.__checker = { assess, addMonths, addDays };
