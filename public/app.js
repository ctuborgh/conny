import { createBackend, isDemo, slug } from './backend.js';
import { DEFAULT_MEMBERS, buildSeed, CHEERS } from './data.js';

// ---------- datoer ----------
const pad = (n) => String(n).padStart(2, '0');
const todayKey = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const dn = (k) => { const [y, m, d] = k.split('-').map(Number); return Date.UTC(y, m - 1, d) / 864e5; };
const daysBetween = (a, b) => dn(b) - dn(a);
const addDays = (k, n) => new Date((dn(k) + n) * 864e5).toISOString().slice(0, 10);
const wd = (k) => new Date(dn(k) * 864e5).getUTCDay();
const weekStart = (k) => addDays(k, -((wd(k) + 6) % 7));
const DAYS = ['Søn', 'Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør'];
const dateShort = (k) => { const [, m, d] = k.split('-'); return `${+d}/${+m}`; };

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const $ = (s) => document.querySelector(s);

// ---------- tilstand ----------
const S = {
  booting: true, user: null, family: null, tasks: {}, tasksLoaded: false, log: [], day: null,
  date: todayKey(), tab: 'today', edit: null, unsubs: [], ensuring: false, dayFailed: false,
  authMode: 'create', busy: false, authError: '', form: {}, setupCount: DEFAULT_MEMBERS.length,
  timer: { id: null, end: 0, iv: null },
};
DEFAULT_MEMBERS.forEach((m, i) => { S.form[`m${i}-name`] = m.name; S.form[`m${i}-role`] = m.role; });
try { S.form.fid = localStorage.getItem('conny-fid') || ''; if (S.form.fid) S.authMode = 'login'; } catch {}
let B;

const fid = () => S.user.familyId;
const me = () => S.user?.memberId;
const isParent = () => S.user?.role === 'parent';
const members = () => S.family?.members || [];
const member = (id) => members().find((m) => m.id === id);
const kids = () => members().filter((m) => m.role === 'kid');
const settings = () => S.family?.settings || {};
const room = (id) => S.family?.rooms?.find((r) => r.id === id) || { name: 'Andet', icon: '📌' };

const everyLabel = (n) => ({ 1: 'hver dag', 7: 'hver uge', 14: 'hver 2. uge', 30: 'hver måned', 60: 'hver 2. måned',
  90: 'hver 3. måned', 180: 'hvert halve år', 365: 'hvert år' }[n] || `hver ${n}. dag`);
const whoLabel = (a) => a === 'adults' ? 'De voksne'
  : a === 'rotate' ? 'Skiftes: ' + (settings().rotate || []).map((id) => member(id)?.name).filter(Boolean).join(' og ')
  : member(a)?.name || '?';

// ---------- planlægning ----------
function ratio(t) { return t.lastDone ? daysBetween(t.lastDone, S.date) / t.every : 1.2; }
const doneToday = (id) => S.tasks[id]?.lastDone === S.date;
function rotateTurn() {
  const r = (settings().rotate || []).filter((id) => member(id));
  return r.length ? r[((dn(S.date) % r.length) + r.length) % r.length] : null;
}
function isMine(t, m) {
  if (t.active === false) return false;
  if (t.assignee === 'rotate') return rotateTurn() === m;
  return t.assignee === m;
}
function personalList(m) {
  const out = Object.values(S.tasks)
    .filter((t) => isMine(t, m) && (t.every === 1 || t.lastDone === S.date || ratio(t) >= 1))
    .sort((a, b) => a.every - b.every || a.name.localeCompare(b.name, 'da'))
    .map((t) => t.id);
  for (const id of S.day?.extra?.[m] || []) if (S.tasks[id] && !out.includes(id)) out.push(id);
  return out;
}
const sharedList = () => (S.day?.adults || []).filter((id) => S.tasks[id]);
function todayList(m) {
  const p = personalList(m);
  return member(m)?.role === 'parent' ? [...p, ...sharedList().filter((id) => !p.includes(id))] : p;
}
function pickPool(budget, exclude, minRatio) {
  const ex = new Set(exclude);
  const cands = Object.values(S.tasks)
    .filter((t) => t.active !== false && t.assignee === 'adults' && t.every > 1 && !ex.has(t.id) && t.lastDone !== S.date)
    .map((t) => ({ t, r: ratio(t) + Math.random() * 0.1 }))
    .filter((c) => c.r >= minRatio)
    .sort((a, b) => b.r - a.r);
  const out = [], rooms = new Set();
  let mins = 0;
  for (const pass of [0, 1]) {
    for (const { t } of cands) {
      if (mins >= budget) break;
      if (out.includes(t.id) || (pass === 0 && rooms.has(t.room))) continue;
      out.push(t.id); rooms.add(t.room); mins += t.min;
    }
  }
  return out;
}
const makePlan = () => ({ adults: pickPool(settings().adultMinutes || 20, [], 0.85), extra: {}, skipped: [] });

function isTrashDay(k) {
  const t = settings().trash || {};
  if ((t.weekly || []).includes(wd(k))) return true;
  const a = t.biweekly?.anchor;
  return !!a && ((daysBetween(a, k) % 14) + 14) % 14 === 0;
}

// ---------- point ----------
const sumPts = (fn) => S.log.filter(fn).reduce((s, e) => s + (e.points || 0), 0);
const monthKey = () => S.date.slice(0, 7);
const monthPts = (m) => sumPts((e) => e.approved && e.member === m && e.date.slice(0, 7) === monthKey());
const pendingPts = (m) => sumPts((e) => !e.approved && e.member === m);
const weekPts = (m) => sumPts((e) => e.approved && e.date >= weekStart(S.date) && (!m || e.member === m));
const famMonthPts = () => sumPts((e) => e.approved && e.date.slice(0, 7) === monthKey());
const kr = (m) => Math.floor(monthPts(m) * (settings().krPer100 ?? 20) / 100);
function streak(m) {
  const days = new Set(S.log.filter((e) => e.member === m).map((e) => e.date));
  let d = S.date, n = 0;
  if (!days.has(d)) d = addDays(d, -1);
  while (days.has(d)) { n++; d = addDays(d, -1); }
  return n;
}
function champion() {
  const scores = members().map((m) => ({ m, p: weekPts(m.id) })).sort((a, b) => b.p - a.p);
  return scores[0]?.p ? scores[0] : null;
}
const LEVELS = [[150, 'en kasket 🧢'], [400, 'solbriller 😎'], [700, 'en krone 👑']];
function freshness(t) { const r = ratio(t); return r <= 1 ? 1 : Math.max(0, 2 - r); }
function sparkle(roomId) {
  const ts = Object.values(S.tasks).filter((t) => t.active !== false && t.every > 1 && (!roomId || t.room === roomId));
  return ts.length ? Math.round(100 * ts.reduce((s, t) => s + freshness(t), 0) / ts.length) : null;
}

// ---------- handlinger ----------
async function toggle(id) {
  const t = S.tasks[id];
  if (!t) return;
  if (t.lastDone !== S.date) return complete(t);
  const e = S.log.find((x) => x.taskId === id && x.date === S.date && x.member === me());
  if (!e) return toast(`${member(t.lastBy)?.name || 'En anden'} har allerede klaret den 🙌`);
  if (e.approved && !isParent()) return toast('Den er allerede godkendt ✔️');
  try {
    await B.deleteLog(fid(), e.id);
    await B.updateTask(fid(), id, { lastDone: e.prevDone ?? null, lastBy: null, prevDone: null });
  } catch (err) { fail(err); }
}
async function complete(t) {
  const list = todayList(me());
  const willBeAll = list.length && list.every((x) => x === t.id || doneToday(x));
  celebrate(willBeAll ? 80 : 30);
  if (S.timer.id === t.id) stopTimer();
  toast(willBeAll ? '🎉 Alt er klaret i dag! Du er fantastisk.'
    : (isParent() ? '' : `+${t.min} point (venter på godkendelse) · `) + CHEERS[Math.floor(Math.random() * CHEERS.length)]);
  try {
    await B.updateTask(fid(), t.id, { lastDone: S.date, lastBy: me(), prevDone: t.lastDone ?? null });
    await B.addLog(fid(), { taskId: t.id, name: t.name, icon: t.icon, member: me(), date: S.date,
      points: t.min, approved: isParent(), prevDone: t.lastDone ?? null, ts: Date.now() });
  } catch (err) { fail(err); }
}
async function swap(id) {
  const d = S.day;
  const [next] = pickPool(1, [...d.adults, ...(d.skipped || [])], 0);
  if (!next) return toast('Der er ikke andre opgaver at bytte med.');
  await B.updateDay(fid(), S.date, { adults: d.adults.map((x) => (x === id ? next : x)), skipped: [...(d.skipped || []), id] });
  toast(`Byttet til “${S.tasks[next].name}”`);
}
async function bonus() {
  const d = S.day;
  const [next] = pickPool(1, [...d.adults, ...(d.skipped || [])], 0);
  if (!next) return toast('Wow, der er intet tilbage. Hjemmet skinner!');
  await B.updateDay(fid(), S.date, { adults: [...d.adults, next] });
  toast('Bonusopgave låst op 💪');
}
async function give(taskId, m) {
  if (!S.day) return;
  const cur = S.day.extra?.[m] || [];
  if (cur.includes(taskId)) return toast('Den har de allerede fået i dag');
  await B.updateDay(fid(), S.date, { extra: { ...(S.day.extra || {}), [m]: [...cur, taskId] } });
  toast(`📨 Sendt til ${member(m)?.name}`);
}
async function approve(lid) { await B.updateLog(fid(), lid, { approved: true }); }
async function reject(lid) {
  const e = S.log.find((x) => x.id === lid);
  if (!e) return;
  await B.deleteLog(fid(), lid);
  const t = S.tasks[e.taskId];
  if (t && t.lastDone === e.date && t.lastBy === e.member)
    await B.updateTask(fid(), t.id, { lastDone: e.prevDone ?? null, lastBy: null, prevDone: null });
  toast('Opgaven er sendt tilbage');
}
function setDeep(obj, path, v) {
  const ks = path.split('.');
  let o = obj;
  for (const k of ks.slice(0, -1)) o = (o[k] && typeof o[k] === 'object') ? o[k] : (o[k] = {});
  o[ks.at(-1)] = v;
}
async function saveSetting(key, v) {
  const s = JSON.parse(JSON.stringify(settings()));
  setDeep(s, key, v);
  await B.saveSettings(fid(), s);
}
async function ensureDay() {
  S.ensuring = true;
  try { await B.ensureDay(fid(), S.date, makePlan); }
  catch (e) { console.error(e); S.dayFailed = true; }
  S.ensuring = false;
}
function fail(err) { console.error(err); toast('Hov, det gik ikke. Prøv igen.'); }

// ---------- timer ----------
function startTimer(id) {
  if (S.timer.id === id) { stopTimer(); return render(); }
  stopTimer();
  S.timer.id = id; S.timer.end = Date.now() + S.tasks[id].min * 60000;
  S.timer.iv = setInterval(tick, 500);
  render();
}
function stopTimer() { clearInterval(S.timer.iv); S.timer.id = null; }
function tick() {
  const el = document.getElementById('timer-' + S.timer.id);
  const left = Math.max(0, S.timer.end - Date.now());
  if (el) el.textContent = `⏱ ${Math.floor(left / 60000)}:${pad(Math.floor(left / 1000) % 60)}`;
  if (left <= 0) { stopTimer(); render(); navigator.vibrate?.([200, 100, 200]); toast('⏰ Tiden er gået! Sæt flueben, hvis du er færdig.'); }
}

// ---------- sjov ----------
function celebrate(n) {
  const colors = ['#3fbf9b', '#ffc94d', '#ff9f80', '#a593e0', '#8fd3f4'];
  for (let i = 0; i < n; i++) {
    const c = document.createElement('div');
    c.className = 'confetti';
    c.style.left = Math.random() * 100 + 'vw';
    c.style.background = colors[i % colors.length];
    c.style.animationDuration = 1.6 + Math.random() * 1.6 + 's';
    c.style.animationDelay = Math.random() * 0.3 + 's';
    document.body.appendChild(c);
    setTimeout(() => c.remove(), 3600);
  }
  const conny = document.querySelector('.conny');
  if (conny) { conny.classList.remove('bounce'); void conny.offsetWidth; conny.classList.add('bounce'); }
}
let toastT;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2800);
}

function connySvg(pts, happy) {
  const lv = LEVELS.filter(([p]) => pts >= p).length;
  const cap = '<path d="M22 33 Q49 4 76 33 Z" fill="#a593e0"/><rect x="62" y="28" width="26" height="6" rx="3" fill="#8b78d0"/><circle cx="49" cy="13" r="3" fill="#ffc94d"/>';
  const crown = '<path d="M28 32 L31 10 L40 21 L49 5 L58 21 L67 10 L70 32 Z" fill="#ffc94d" stroke="#e0a800" stroke-width="1.5" stroke-linejoin="round"/><circle cx="49" cy="24" r="2.5" fill="#ff9f80"/>';
  const glasses = '<rect x="29" y="54" width="17" height="11" rx="4" fill="#2d2a32"/><rect x="52" y="54" width="17" height="11" rx="4" fill="#2d2a32"/><rect x="45" y="57" width="8" height="2.5" fill="#2d2a32"/>';
  const eyes = happy
    ? '<path d="M33 61 Q38 54 43 61" stroke="#2d2a32" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M55 61 Q60 54 65 61" stroke="#2d2a32" stroke-width="3" fill="none" stroke-linecap="round"/>'
    : '<ellipse cx="38" cy="60" rx="4.5" ry="5.5" fill="#2d2a32"/><ellipse cx="60" cy="60" rx="4.5" ry="5.5" fill="#2d2a32"/><circle cx="39.5" cy="58" r="1.6" fill="#fff"/><circle cx="61.5" cy="58" r="1.6" fill="#fff"/>';
  return `<svg class="conny" viewBox="0 0 100 100" aria-label="Conny svampen">
    <circle cx="88" cy="16" r="6" fill="none" stroke="#8fd3f4" stroke-width="2"/>
    <circle cx="94" cy="32" r="3.5" fill="none" stroke="#8fd3f4" stroke-width="2"/>
    <circle cx="9" cy="24" r="4.5" fill="none" stroke="#8fd3f4" stroke-width="2"/>
    <rect x="16" y="30" width="66" height="58" rx="16" fill="#ffd45e"/>
    <path d="M16 46 V40 a10 10 0 0 1 10 -10 H72 a10 10 0 0 1 10 10 V46 Z" fill="#3fbf9b"/>
    <circle cx="27" cy="77" r="3" fill="#f2b93b"/><circle cx="72" cy="79" r="2.5" fill="#f2b93b"/><circle cx="66" cy="50" r="2" fill="#2fa585"/>
    ${lv >= 3 ? crown : lv >= 1 ? cap : ''}
    ${eyes}${lv >= 2 && !happy ? glasses : ''}
    <circle cx="30" cy="70" r="4" fill="#ff9f80" opacity=".6"/><circle cx="68" cy="70" r="4" fill="#ff9f80" opacity=".6"/>
    <path d="${happy ? 'M40 70 Q49 82 58 70 Z' : 'M41 71 Q49 79 57 71'}" stroke="#2d2a32" stroke-width="3" fill="${happy ? '#ff7a6b' : 'none'}" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
}

// ---------- visninger ----------
function connySays(list) {
  const name = member(me())?.name || '';
  const open = list.filter((id) => !doneToday(id));
  const mins = open.reduce((s, id) => s + S.tasks[id].min, 0);
  const h = new Date().getHours();
  const hi = h < 10 ? 'Godmorgen' : h < 18 ? 'Hej' : 'Godaften';
  if (!list.length) return `${hi} ${name}! Ingen opgaver i dag. Nyd det 🌈`;
  if (!open.length) return `Alt er klaret, ${name}! Conny er SÅ stolt af dig 👑`;
  if (open.length === list.length) return `${hi} ${name}! ${open.length} små opgaver i dag, cirka ${mins} minutter. Du kan godt 💪`;
  return `Godt gået! ${open.length} tilbage, cirka ${mins} min. Easy peasy 🫧`;
}

function headerView() {
  const list = todayList(me());
  const happy = list.length > 0 && list.every(doneToday);
  const demo = isDemo ? `<div class="demo"><span>Demo · se appen som</span>${members().map((m) =>
    `<button data-act="demoAs" data-m="${m.id}" class="${m.id === me() ? 'on' : ''}">${esc(m.name)}</button>`).join('')}</div>` : '';
  const date = new Date().toLocaleDateString('da-DK', { weekday: 'long', day: 'numeric', month: 'long' });
  return `${demo}<div class="hero">${connySvg(famMonthPts(), happy)}
    <div class="bubble"><div class="date">${date}</div><div>${esc(connySays(list))}</div></div></div>`;
}

function card(id, { swap = false } = {}) {
  const t = S.tasks[id];
  const done = t.lastDone === S.date;
  const pend = done && S.log.some((e) => e.taskId === id && e.date === S.date && !e.approved);
  const by = done && t.lastBy && t.lastBy !== me() ? member(t.lastBy)?.name : null;
  const r = room(t.room);
  const extra = (S.day?.extra?.[me()] || []).includes(id) && !isMine(t, me());
  return `<div class="task ${done ? 'done' : ''}">
    <button class="check" data-act="toggle" data-id="${id}" aria-label="Marker som klaret">${done ? '✓' : esc(t.icon)}</button>
    <div class="t-body">
      <div class="t-name">${esc(t.name)}</div>
      <div class="t-meta">${r.icon} ${esc(r.name)} · ~${t.min} min · ${t.min} point${extra ? ' · 📨 ekstra' : ''}</div>
      ${pend ? '<div class="t-meta pend">⏳ Venter på godkendelse</div>' : ''}
      ${by ? `<div class="t-meta">✔️ Klaret af ${esc(by)}</div>` : ''}
      ${done ? '' : `<div class="t-actions">
        <button class="chip ${S.timer.id === id ? 'timer-on' : ''}" id="timer-${id}" data-act="timer" data-id="${id}">⏱ Start ${t.min}-min timer</button>
        ${swap ? `<button class="chip" data-act="swap" data-id="${id}">🔄 Ikke i dag</button>` : ''}
      </div>`}
    </div></div>`;
}

function todayView() {
  const m = me();
  const personal = personalList(m);
  const shared = isParent() ? sharedList().filter((id) => !personal.includes(id)) : [];
  const all = [...personal, ...shared];
  const done = all.filter(doneToday).length;
  let h = '';
  if (isTrashDay(addDays(S.date, 1))) h += '<div class="banner">🗑️ Skraldet bliver hentet i morgen. Husk at stille spanden ud i aften.</div>';
  else if (isTrashDay(S.date)) h += '<div class="banner">🗑️ Skraldet bliver hentet i dag.</div>';
  h += `<div class="progress"><div style="width:${all.length ? done / all.length * 100 : 0}%"></div></div>
    <div class="count">${done} af ${all.length} klaret i dag</div>`;
  if (all.length && done === all.length) h += '<div class="alldone"><span class="crown">👑</span>Alt er klaret. Conny er så stolt!</div>';
  if (personal.length) h += `<h2>${isParent() ? 'Mine opgaver' : 'Dine opgaver i dag'}</h2>` + personal.map((id) => card(id)).join('');
  if (isParent()) {
    const mins = shared.reduce((s, id) => s + S.tasks[id].min, 0);
    h += `<h2>Fælles for de voksne <small>ca. ${mins} min</small></h2>`;
    h += shared.length ? shared.map((id) => card(id, { swap: true })).join('') : '<div class="empty">Intet på planen i dag 🎉</div>';
    h += '<button class="big-btn" data-act="bonus">💪 Overskud? Tag en bonusopgave</button>';
  } else if (!personal.length) h += '<div class="empty">Ingen opgaver i dag. Nyd det! 🌈</div>';
  return h;
}

function goalCard() {
  const g = settings().goal || { points: 250, prize: '' };
  const w = weekPts();
  const champ = champion();
  return `<div class="card">
    <div class="row-between"><b>🎯 Familiens ugemål</b><span class="muted">${w} / ${g.points} point</span></div>
    <div class="progress"><div style="width:${Math.min(100, w / g.points * 100)}%"></div></div>
    <div class="muted small">${w >= g.points ? '🎉 Nået! Præmie: ' : 'Præmie: '}${esc(g.prize)}</div>
    ${champ ? `<div class="champ">🏆 Ugens Conny-mester lige nu: <b>${esc(champ.m.name)}</b> med ${champ.p} point</div>` : ''}
  </div>`;
}
function levelCard() {
  const p = famMonthPts();
  const next = LEVELS.find(([n]) => p < n);
  return `<div class="card small">🧽 Familien har samlet <b>${p} point</b> denne måned.
    ${next ? `Ved ${next[0]} point får Conny ${next[1]}.` : 'Conny har fået alt, hvad hun kan bære 👑'}</div>`;
}

function familyView() {
  const pend = S.log.filter((e) => !e.approved).sort((a, b) => b.ts - a.ts);
  let h = '';
  if (pend.length) {
    h += `<h2>Til godkendelse <button class="link" data-act="approveAll">Godkend alle</button></h2><div class="card">`;
    h += pend.map((e) => `<div class="appr">
      <span class="ic">${esc(e.icon)}</span>
      <div class="name"><b>${esc(member(e.member)?.name)}</b>: ${esc(e.name)}<small>${dateShort(e.date)} · ${e.points} point</small></div>
      <button class="mini ok" data-act="approve" data-id="${e.id}">✓</button>
      <button class="mini no" data-act="reject" data-id="${e.id}" aria-label="Send tilbage">✗</button></div>`).join('');
    h += '</div>';
  }
  h += '<h2>Børnene i dag</h2>';
  for (const k of kids()) {
    const list = personalList(k.id);
    const done = list.filter(doneToday).length;
    h += `<div class="card">
      <div class="row-between"><b>${esc(k.name)}</b><span class="muted">${done} af ${list.length} i dag</span></div>
      <div class="progress"><div style="width:${list.length ? done / list.length * 100 : 0}%"></div></div>
      <ul class="mini-list">${list.map((id) => `<li class="${doneToday(id) ? 'ok' : ''}">${doneToday(id) ? '✅' : '⬜️'} ${esc(S.tasks[id].name)}</li>`).join('') || '<li>Ingen opgaver i dag</li>'}</ul>
      <div class="muted small">⭐ ${monthPts(k.id)} point denne måned = <b>${kr(k.id)} kr</b>${pendingPts(k.id) ? ` · ${pendingPts(k.id)} venter` : ''} · 🔥 ${streak(k.id)} dage i træk</div>
    </div>`;
  }
  h += '<h2>Sammen</h2>' + goalCard() + levelCard();
  const sp = sparkle() ?? 0;
  h += `<h2>Hvor skinnende er hjemmet?</h2><div class="card">
    <div class="row-between"><b>${sp >= 85 ? 'Skinnende! ✨' : sp >= 60 ? 'Ret friskt 🌿' : sp >= 35 ? 'Lidt støvet 🫧' : 'Frisk start 🌱'}</b><span class="big">${sp}%</span></div>
    ${(S.family.rooms || []).map((r) => { const v = sparkle(r.id); return v === null ? '' : `<div class="room-row"><span>${r.icon}</span>
      <div><div class="small">${esc(r.name)}</div><div class="progress thin"><div style="width:${v}%"></div></div></div><span class="muted small">${v}%</span></div>`; }).join('')}
  </div>`;
  return h;
}

function pointsView() {
  const m = me();
  return `<div class="stats">
      <div class="stat"><b>${monthPts(m)}</b><span>⭐ point i ${new Date().toLocaleDateString('da-DK', { month: 'long' })}</span></div>
      <div class="stat"><b>${kr(m)} kr</b><span>💰 lommepenge</span></div>
      <div class="stat"><b>${streak(m)}</b><span>🔥 dage i træk</span></div>
    </div>
    ${pendingPts(m) ? `<div class="card small">⏳ ${pendingPts(m)} point venter på, at mor eller far godkender dem.</div>` : ''}
    <div class="card small">Du får ${settings().krPer100 ?? 20} kr for hver 100 point. 1 minuts opgave = 1 point.</div>
    ${goalCard()}${levelCard()}${pushCard()}
    <button class="danger" data-act="logout">Log ud</button>`;
}

function tasksView() {
  let h = '<button class="primary" data-act="new">＋ Ny opgave</button>';
  for (const r of S.family.rooms || []) {
    const ts = Object.values(S.tasks).filter((t) => t.room === r.id).sort((a, b) => a.every - b.every || a.name.localeCompare(b.name, 'da'));
    if (!ts.length) continue;
    h += `<div class="card lib"><h3>${r.icon} ${esc(r.name)}</h3>${ts.map((t) => {
      const ago = t.lastDone ? (t.lastDone === S.date ? 'klaret i dag' : `${daysBetween(t.lastDone, S.date)} dage siden`) : 'ikke lavet endnu';
      return `<div class="lib-item ${t.active === false ? 'off' : ''}">
        <span>${esc(t.icon)}</span>
        <button class="name" data-act="edit" data-id="${t.id}">${esc(t.name)}<small>${everyLabel(t.every)} · ${t.min} min · ${esc(whoLabel(t.assignee))} · ${ago}</small></button>
        <select class="give" data-give="${t.id}" aria-label="Giv opgaven i dag til">
          <option value="">📨</option>${members().map((m) => `<option value="${m.id}">Giv til ${esc(m.name)} i dag</option>`).join('')}
        </select></div>`;
    }).join('')}</div>`;
  }
  return h;
}

function seg(key, values, cur, fmt = (v) => v) {
  return `<div class="seg">${values.map((v) => `<button data-act="seg" data-key="${key}" data-val="${v}" class="${cur === v ? 'on' : ''}">${fmt(v)}</button>`).join('')}</div>`;
}
function chips(key, options, cur) {
  return `<div class="chips">${options.map(([v, label]) => `<button data-act="arr" data-key="${key}" data-val="${v}" class="${(cur || []).includes(v) ? 'on' : ''}">${esc(label)}</button>`).join('')}</div>`;
}
const hourSelect = (key, cur) => `<select data-set="${key}" data-num="1">${Array.from({ length: 24 }, (_, h) =>
  `<option value="${h}" ${h === cur ? 'selected' : ''}>kl. ${pad(h)}:00</option>`).join('')}</select>`;

function pushCard() {
  const ios = /iPhone|iPad/.test(navigator.userAgent);
  const installed = navigator.standalone || matchMedia('(display-mode: standalone)').matches;
  let on = false;
  try { on = localStorage.getItem('conny-push') === '1' && Notification.permission === 'granted'; } catch {}
  return `<div class="card"><b>🔔 Påmindelser på denne telefon</b>
    ${isDemo ? '<div class="muted small">Virker først, når appen er sat op med Supabase.</div>'
      : on ? '<div class="muted small">Slået til ✓</div>'
      : `${ios && !installed ? '<div class="muted small">Føj først appen til hjemmeskærmen: tryk på Del-knappen i Safari og vælg “Føj til hjemmeskærm”. Åbn så appen derfra.</div>' : ''}
         <button class="primary" data-act="push">Slå påmindelser til</button>`}</div>`;
}

function settingsView() {
  const s = settings();
  const t = s.trash || {};
  return `<h2>De voksnes tid om dagen</h2>
    <div class="muted small">Tilsammen. Appen laver en fælles plan, som I deler.</div>
    ${seg('adultMinutes', [10, 15, 20, 30, 40], s.adultMinutes, (v) => v + ' min')}

    <h2>Skiftes til opvaskeren</h2>
    ${chips('rotate', kids().map((k) => [k.id, k.name]), s.rotate)}

    <h2>Skrald</h2>
    <div class="card">
      <label class="field">Hentes hver uge om</label>
      ${chips('trash.weekly', [1, 2, 3, 4, 5, 6, 0].map((d) => [d, DAYS[d]]), t.weekly)}
      <label class="field">Hentes hver anden uge. Næste gang:</label>
      <div class="row-between gap"><input type="date" data-set="trash.biweekly.anchor" value="${t.biweekly?.anchor || ''}">
      <button class="mini" data-act="clearBi">Ingen</button></div>
      <label class="field">Påmindelse aftenen før</label>${hourSelect('trashHour', s.trashHour ?? 19)}
      <label class="field">Hvem får påmindelsen?</label>
      ${chips('trash.notify', members().map((m) => [m.id, m.name]), t.notify)}
    </div>

    <h2>Morgenpåmindelse</h2>
    <div class="card">${hourSelect('morningHour', s.morningHour ?? 7)}</div>
    ${pushCard()}

    <h2>Lommepenge og belønning</h2>
    <div class="card">
      <label class="field">Kroner pr. 100 point</label>
      <input type="number" min="0" data-set="krPer100" data-num="1" value="${s.krPer100 ?? 20}">
      <label class="field">Familiens ugemål (point)</label>
      <input type="number" min="10" data-set="goal.points" data-num="1" value="${s.goal?.points ?? 250}">
      <label class="field">Præmie, når ugemålet er nået</label>
      <input type="text" data-set="goal.prize" value="${esc(s.goal?.prize ?? '')}">
    </div>

    <h2>Login på de andre telefoner</h2>
    <div class="card small">Familiekode: <b>${esc(S.user.familyId)}</b><br>
      Hver person logger ind med familiekoden, sit navn og sin PIN. Navne: ${members().map((m) => esc(m.name)).join(', ')}.</div>
    <button class="danger" data-act="logout">Log ud</button>`;
}

function editSheet() {
  const f = S.form;
  const isNew = S.edit === 'new';
  const opts = (list, cur) => list.map(([v, l]) => `<option value="${esc(v)}" ${String(v) === String(cur) ? 'selected' : ''}>${esc(l)}</option>`).join('');
  const whoOpts = [['adults', 'De voksne (fælles plan)'], ['rotate', 'Børnene skiftes'], ...members().map((m) => [m.id, m.name])];
  return `<div class="sheet-bg" data-act="closeEdit"></div><div class="sheet">
    <h2>${isNew ? 'Ny opgave' : 'Ret opgave'}</h2>
    <label class="field">Hvad skal gøres?</label><input type="text" data-f="e-name" value="${esc(f['e-name'])}" maxlength="60">
    <div class="row2">
      <div><label class="field">Ikon</label><input type="text" data-f="e-icon" value="${esc(f['e-icon'])}" maxlength="4"></div>
      <div><label class="field">Minutter</label><input type="number" data-f="e-min" min="1" max="120" value="${esc(f['e-min'])}"></div>
    </div>
    <label class="field">Rum</label><select data-f="e-room">${opts((S.family.rooms || []).map((r) => [r.id, r.icon + ' ' + r.name]), f['e-room'])}</select>
    <label class="field">Hvor ofte? (hver … dag)</label><input type="number" data-f="e-every" min="1" max="365" value="${esc(f['e-every'])}">
    <label class="field">Hvem?</label><select data-f="e-who">${opts(whoOpts, f['e-who'])}</select>
    <label class="field">Aktiv</label><select data-f="e-active">${opts([['1', 'Ja'], ['0', 'Nej, sæt på pause']], f['e-active'])}</select>
    <button class="primary" data-act="saveEdit">Gem</button>
    ${isNew ? '' : '<button class="danger" data-act="deleteEdit">Slet opgaven</button>'}
    <button class="link center" data-act="closeEdit">Annuller</button>
  </div>`;
}

function authView() {
  const f = S.form;
  const head = `<div class="hero">${connySvg(0, false)}<div class="bubble"><div class="date">Velkommen</div>
    Hej! Jeg er Conny. Jeg hjælper jeres familie med små opgaver hver dag, så weekenden er fri 🧽</div></div>`;
  const err = S.authError ? `<div class="banner err">${esc(S.authError)}</div>` : '';
  if (S.authMode === 'login' && !isDemo) {
    return head + `<div class="card"><h2>Log ind</h2>${err}
      <label class="field">Familiekode</label><input type="text" data-f="fid" value="${esc(f.fid)}" autocapitalize="off" autocomplete="off">
      <label class="field">Dit navn</label><input type="text" data-f="name" value="${esc(f.name)}" autocomplete="off">
      <label class="field">PIN (4 cifre)</label><input type="password" data-f="pin" inputmode="numeric" maxlength="4" value="${esc(f.pin)}">
      <button class="primary" data-act="login" ${S.busy ? 'disabled' : ''}>${S.busy ? 'Logger ind …' : 'Log ind'}</button>
      <button class="link center" data-act="authMode" data-mode="create">Ny familie? Opret den her</button></div>`;
  }
  const rows = Array.from({ length: S.setupCount }, (_, i) => `<div class="mrow">
    <input type="text" data-f="m${i}-name" placeholder="Navn" value="${esc(f[`m${i}-name`])}">
    <select data-f="m${i}-role" ${i === 0 ? 'disabled' : ''}><option value="parent" ${f[`m${i}-role`] === 'parent' ? 'selected' : ''}>Voksen</option><option value="kid" ${f[`m${i}-role`] === 'kid' ? 'selected' : ''}>Barn</option></select>
    ${isDemo ? '' : `<input type="password" data-f="m${i}-pin" placeholder="PIN" inputmode="numeric" maxlength="4" value="${esc(f[`m${i}-pin`])}">`}
  </div>`).join('');
  return head + `<div class="card"><h2>${isDemo ? 'Prøv Conny (demo)' : 'Opret jeres familie'}</h2>${err}
    ${isDemo ? '<div class="muted small">Demo-tilstand: alt gemmes kun i denne browser, og der er ingen PIN. Når Supabase er sat op, kan hele familien logge ind fra hver sin telefon.</div>'
      : `<label class="field">Vælg en familiekode (bruges til at logge ind)</label>
         <input type="text" data-f="fid" value="${esc(f.fid)}" placeholder="fx hjemmetpaavej7" autocapitalize="off" autocomplete="off">`}
    <label class="field">Familien ${isDemo ? '' : '· hver person vælger en PIN på 4 cifre'}<br><span class="muted">Den første person er dig.</span></label>
    ${rows}
    <button class="link" data-act="addMember">＋ Tilføj person</button>
    <button class="primary" data-act="create" ${S.busy ? 'disabled' : ''}>${S.busy ? 'Opretter …' : isDemo ? 'Start demo' : 'Opret familie'}</button>
    ${isDemo ? '' : '<button class="link center" data-act="authMode" data-mode="login">Har I allerede en familie? Log ind</button>'}</div>`;
}

function navView() {
  const pend = S.log.filter((e) => !e.approved).length;
  const tabs = isParent()
    ? [['today', '✨', 'I dag'], ['family', '👨‍👩‍👦‍👦', 'Familien'], ['tasks', '🧺', 'Opgaver'], ['settings', '⚙️', 'Indstillinger']]
    : [['today', '✨', 'I dag'], ['points', '⭐', 'Mine point']];
  return `<nav><div class="inner">${tabs.map(([id, ic, label]) => `<button data-act="tab" data-tab="${id}" class="${S.tab === id ? 'on' : ''}">
    <span class="ic">${ic}${id === 'family' && pend ? `<i class="badge">${pend}</i>` : ''}</span>${label}</button>`).join('')}</div></nav>`;
}

// ---------- tegning ----------
let rq = false;
function render() { if (!rq) { rq = true; queueMicrotask(() => { rq = false; draw(); }); } }
function draw() {
  const a = document.activeElement;
  if (a && a.closest?.('#app') && a.matches('input[type=text],input[type=number],input[type=password],textarea')) { S.pending = true; return; }
  S.pending = false;
  const app = $('#app');
  if (S.booting) { app.innerHTML = '<div class="empty">Conny gør klar … 🧽</div>'; return; }
  if (!S.user) { app.innerHTML = authView(); return; }
  if (!S.family || !S.tasksLoaded) { app.innerHTML = '<div class="empty">Henter familiens opgaver … 🧽</div>'; return; }
  if (S.dayLoaded && !S.day && !S.ensuring && !S.dayFailed) ensureDay();
  const allowed = isParent() ? ['today', 'family', 'tasks', 'settings'] : ['today', 'points'];
  if (!allowed.includes(S.tab)) S.tab = 'today';
  const view = { today: todayView, family: familyView, tasks: tasksView, settings: settingsView, points: pointsView }[S.tab];
  app.innerHTML = `<div class="wrap">${headerView()}${view()}</div>${navView()}${S.edit ? editSheet() : ''}`;
  if (S.timer.id) tick();
}

// reset=false: hent data igen uden at vise "henter …" (fx når appen åbnes igen)
function subscribe(reset = true) {
  S.unsub?.();
  S.unsub = null;
  if (reset) Object.assign(S, { family: null, tasks: {}, tasksLoaded: false, log: [], day: null, dayLoaded: false, dayFailed: false });
  S.date = todayKey();
  if (!S.user) return render();
  S.unsub = B.subscribe(fid(), { since: addDays(S.date, -62), date: S.date }, {
    family: (d) => { S.family = d; render(); },
    tasks: (ds) => { S.tasks = Object.fromEntries(ds.map((d) => [d.id, d])); S.tasksLoaded = true; render(); },
    log: (ds) => { S.log = ds; render(); },
    day: (d) => { S.day = d; S.dayLoaded = true; render(); },
  });
}

// ---------- login / opret ----------
const ERRORS = {
  invalid_credentials: 'Forkert familiekode, navn eller PIN.',
  over_request_rate_limit: 'For mange forsøg. Vent lidt og prøv igen.',
  taken: 'Den familiekode er allerede i brug. Vælg en anden.',
};
const errText = (e) => ERRORS[e?.code]
  || (/Invalid login credentials/i.test(e?.message) ? ERRORS.invalid_credentials : '')
  || (/Failed to fetch|NetworkError/i.test(e?.message) ? 'Ingen internetforbindelse.' : '')
  || 'Noget gik galt: ' + (e?.message || e);

async function doLogin() {
  const fid = slug(S.form.fid || ''), name = (S.form.name || '').trim(), pin = (S.form.pin || '').trim();
  if (!fid || !name || !pin) { S.authError = 'Udfyld alle tre felter.'; return render(); }
  S.busy = true; S.authError = ''; render();
  try { await B.login(fid, name, pin); localStorage.setItem('conny-fid', fid); }
  catch (e) { S.authError = errText(e); }
  S.busy = false; render();
}
async function doCreate() {
  const fid = isDemo ? 'demo' : slug(S.form.fid || '');
  const ms = Array.from({ length: S.setupCount }, (_, i) => ({
    name: (S.form[`m${i}-name`] || '').trim(),
    role: i === 0 ? 'parent' : S.form[`m${i}-role`] || 'kid',
    pin: (S.form[`m${i}-pin`] || '').trim(),
  })).filter((m) => m.name).map((m) => ({ ...m, id: slug(m.name) }));
  const ids = ms.map((m) => m.id);
  const problem = !isDemo && fid.length < 3 ? 'Familiekoden skal være mindst 3 bogstaver eller tal.'
    : !ms.length ? 'Skriv mindst ét navn.'
    : ids.some((id) => !id) ? 'Navne skal indeholde bogstaver.'
    : new Set(ids).size !== ids.length ? 'To personer kan ikke hedde det samme.'
    : !isDemo && ms.some((m) => !/^\d{4}$/.test(m.pin)) ? 'Hver person skal have en PIN på præcis 4 cifre.'
    : '';
  if (problem) { S.authError = problem; return render(); }
  S.busy = true; S.authError = ''; render();
  try {
    await B.createFamily(fid, ms, buildSeed(ms, { today: S.date, addDays, wd }));
    try { localStorage.setItem('conny-fid', fid); } catch {}
    toast('Velkommen til Conny! 🎉'); celebrate(60);
  } catch (e) { console.error(e); S.authError = errText(e); }
  S.busy = false; render();
}

// ---------- opgave-redigering ----------
function openEdit(id) {
  const t = id === 'new' ? { name: '', icon: '⭐', min: 5, every: 7, room: S.family.rooms?.[0]?.id, assignee: 'adults', active: true } : S.tasks[id];
  S.edit = id;
  Object.assign(S.form, { 'e-name': t.name, 'e-icon': t.icon, 'e-min': t.min, 'e-every': t.every, 'e-room': t.room, 'e-who': t.assignee, 'e-active': t.active === false ? '0' : '1' });
  render();
}
async function saveEdit() {
  const f = S.form;
  const name = String(f['e-name'] || '').trim();
  if (!name) return toast('Giv opgaven et navn 🙂');
  const data = {
    name, icon: String(f['e-icon'] || '⭐').trim() || '⭐',
    min: Math.min(120, Math.max(1, Number(f['e-min']) || 5)),
    every: Math.min(365, Math.max(1, Number(f['e-every']) || 7)),
    room: f['e-room'], assignee: f['e-who'], active: f['e-active'] !== '0',
  };
  try {
    if (S.edit === 'new') await B.insertTask(fid(), { id: `${slug(name).slice(0, 20)}-${Date.now().toString(36)}`, ...data, lastDone: null, lastBy: null, prevDone: null });
    else await B.updateTask(fid(), S.edit, data);
    S.edit = null; toast('Gemt ✓'); render();
  } catch (e) { fail(e); }
}

// ---------- hændelser ----------
const getPath = (obj, path) => path.split('.').reduce((o, k) => o?.[k], obj);

document.addEventListener('click', async (e) => {
  const b = e.target.closest('[data-act]');
  if (!b) return;
  const { act, id } = b.dataset;
  if (document.activeElement?.blur && act !== 'closeEdit') document.activeElement.blur();
  try {
    switch (act) {
      case 'tab': S.tab = b.dataset.tab; window.scrollTo(0, 0); render(); break;
      case 'toggle': await toggle(id); break;
      case 'swap': await swap(id); break;
      case 'bonus': await bonus(); break;
      case 'timer': startTimer(id); break;
      case 'approve': await approve(id); break;
      case 'reject': await reject(id); break;
      case 'approveAll': for (const x of S.log.filter((x) => !x.approved)) await approve(x.id); toast('Alle godkendt ✓'); break;
      case 'new': openEdit('new'); break;
      case 'edit': openEdit(id); break;
      case 'closeEdit': S.edit = null; render(); break;
      case 'saveEdit': await saveEdit(); break;
      case 'deleteEdit':
        if (confirm('Slet opgaven for altid?')) { await B.deleteTask(fid(), S.edit); S.edit = null; render(); toast('Slettet'); }
        break;
      case 'seg': await saveSetting(b.dataset.key, Number(b.dataset.val)); break;
      case 'arr': {
        const key = b.dataset.key, cur = getPath(settings(), key) || [];
        const v = /^\d+$/.test(b.dataset.val) && key === 'trash.weekly' ? Number(b.dataset.val) : b.dataset.val;
        await saveSetting(key, cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]);
        break;
      }
      case 'clearBi': await saveSetting('trash.biweekly', null); toast('Ingen afhentning hver anden uge'); break;
      case 'push':
        try {
          await B.enablePush(S.user.familyId, me());
          try { localStorage.setItem('conny-push', '1'); } catch {}
          toast('Påmindelser er slået til 🔔'); render();
        } catch (err) {
          console.error(err);
          toast(err.message === 'denied' ? 'Du sagde nej til notifikationer. Slå dem til under Indstillinger → Conny.'
            : 'Påmindelser virker kun, når appen er føjet til hjemmeskærmen.');
        }
        break;
      case 'logout': stopTimer(); await B.logout(); S.tab = 'today'; break;
      case 'demoAs': B.switchTo(b.dataset.m, member(b.dataset.m).role); break;
      case 'authMode': S.authMode = b.dataset.mode; S.authError = ''; render(); break;
      case 'addMember': S.form[`m${S.setupCount}-role`] = 'kid'; S.setupCount++; render(); break;
      case 'login': await doLogin(); break;
      case 'create': await doCreate(); break;
    }
  } catch (err) { fail(err); }
});

function onField(e) {
  const el = e.target;
  if (el.dataset.f) S.form[el.dataset.f] = el.value;
}
document.addEventListener('input', onField);
document.addEventListener('change', async (e) => {
  onField(e);
  const el = e.target;
  if (el.dataset.give) {
    const m = el.value; el.value = '';
    if (m) await give(el.dataset.give, m).catch(fail);
  } else if (el.dataset.set) {
    const v = el.dataset.num ? Number(el.value) : el.value;
    const key = el.dataset.set;
    try {
      if (key === 'trash.biweekly.anchor') await saveSetting('trash.biweekly', v ? { anchor: v } : null);
      else await saveSetting(key, v);
      toast('Gemt ✓');
    } catch (err) { fail(err); }
  }
});
document.addEventListener('focusout', () => setTimeout(() => { if (S.pending) render(); }, 0));
document.addEventListener('visibilitychange', () => {
  // Når appen åbnes igen: hent det nyeste (og start forfra, hvis det er blevet en ny dag)
  if (!document.hidden && S.user) subscribe(S.date !== todayKey());
});

// ---------- start ----------
(async () => {
  try { B = await createBackend(); }
  catch (e) { $('#app').innerHTML = '<div class="empty">Kunne ikke starte. Tjek internetforbindelsen.</div>'; console.error(e); return; }
  B.onUser((u) => { S.booting = false; S.user = u; subscribe(); });
  if (B.mode === 'supabase') setTimeout(() => { if (S.booting) { S.booting = false; render(); } }, 4000);
})();
