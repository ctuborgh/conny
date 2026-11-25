// To "motorer" bag appen med præcis de samme funktioner:
//  - Supabase (rigtig drift: login, delt database mellem telefoner, påmindelser)
//  - Demo (ingen opsætning: alt gemmes kun i denne browser)
// Appen bruger Supabase automatisk, når config.js er udfyldt.

const cfg = self.CONNY_CONFIG || {};
export const isDemo = !cfg.supabaseUrl || !cfg.supabaseKey;

export const slug = (s) => String(s).toLowerCase()
  .replace(/æ/g, 'ae').replace(/ø/g, 'o').replace(/å/g, 'aa')
  .replace(/[^a-z0-9]/g, '');

// Hver person logger ind med familiekode + navn + PIN.
// Bag kulisserne bliver det til et Supabase-login med en "falsk" e-mail.
const emailFor = (fid, memberId) => `${fid}.${memberId}@conny.invalid`;
const pw = (pin) => `conny-${pin}`;

// Databasen bruger snake_case (last_done), appen camelCase (lastDone)
const toCamel = (o) => o && Object.fromEntries(Object.entries(o)
  .filter(([k]) => k !== 'family_id')
  .map(([k, v]) => [k.replace(/_([a-z])/g, (_, c) => c.toUpperCase()), v]));
const toSnake = (o) => Object.fromEntries(Object.entries(o)
  .map(([k, v]) => [k.replace(/[A-Z]/g, (c) => '_' + c.toLowerCase()), v]));
const clone = (x) => (x == null ? null : JSON.parse(JSON.stringify(x)));

function b64ToBytes(b64) {
  const s = atob((b64 + '='.repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
}

export function createBackend() {
  return isDemo ? demoBackend() : supabaseBackend();
}

// ---------------------------------------------------------------------------
async function supabaseBackend() {
  const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm');
  const sb = createClient(cfg.supabaseUrl, cfg.supabaseKey);
  const must = ({ error }) => { if (error) throw error; };
  let reload = {};

  return {
    mode: 'supabase',

    onUser(cb) {
      let last;
      sb.auth.onAuthStateChange((_event, session) => {
        const uid = session?.user?.id ?? null;
        if (uid === last) return;
        last = uid;
        // Supabase anbefaler ikke at kalde databasen direkte inde i denne callback
        setTimeout(async () => {
          if (!uid) return cb(null);
          const { data } = await sb.from('members').select('family_id, member_id, role').eq('user_id', uid).maybeSingle();
          cb(data ? { familyId: data.family_id, memberId: data.member_id, role: data.role } : null);
        }, 0);
      });
    },
    async login(fid, name, pin) {
      const { error } = await sb.auth.signInWithPassword({ email: emailFor(fid, slug(name)), password: pw(pin) });
      if (error) throw error;
    },
    logout: () => sb.auth.signOut(),
    async createFamily(fid, members, seed) {
      const { error } = await sb.functions.invoke('opret-familie', { body: { fid, members, seed } });
      if (error) {
        let msg = error.message;
        try { msg = (await error.context.json()).error; } catch {}
        throw Object.assign(new Error(msg), { code: msg === 'taken' ? 'taken' : 'create' });
      }
      await this.login(fid, members[0].name, members[0].pin);
    },

    subscribe(fid, { since, date }, h) {
      reload = {
        families: async () => {
          const { data } = await sb.from('families').select('name, members, rooms, settings').eq('id', fid).maybeSingle();
          h.family(data);
        },
        tasks: async () => {
          const { data } = await sb.from('tasks').select('*').eq('family_id', fid);
          h.tasks((data || []).map(toCamel));
        },
        log: async () => {
          const { data } = await sb.from('log').select('*').eq('family_id', fid).gte('date', since);
          h.log((data || []).map(toCamel));
        },
        days: async () => {
          const { data } = await sb.from('days').select('adults, extra, skipped').eq('family_id', fid).eq('date', date).maybeSingle();
          h.day(data);
        },
      };
      const mine = reload;
      Object.values(mine).forEach((f) => f());
      // Live-opdatering: når en anden i familien ændrer noget, henter vi tabellen igen
      const timers = {};
      const later = (t) => { clearTimeout(timers[t]); timers[t] = setTimeout(() => mine[t](), 150); };
      const ch = sb.channel(`familie-${fid}-${Date.now()}`);
      for (const t of Object.keys(mine)) {
        ch.on('postgres_changes', { event: '*', schema: 'public', table: t, filter: t === 'families' ? `id=eq.${fid}` : `family_id=eq.${fid}` }, () => later(t));
      }
      ch.subscribe();
      return () => { sb.removeChannel(ch); if (reload === mine) reload = {}; };
    },

    async saveSettings(fid, settings) { must(await sb.from('families').update({ settings }).eq('id', fid)); reload.families?.(); },
    async insertTask(fid, t) { must(await sb.from('tasks').insert({ family_id: fid, ...toSnake(t) })); reload.tasks?.(); },
    async updateTask(fid, id, patch) { must(await sb.from('tasks').update(toSnake(patch)).eq('family_id', fid).eq('id', id)); reload.tasks?.(); },
    async deleteTask(fid, id) { must(await sb.from('tasks').delete().eq('family_id', fid).eq('id', id)); reload.tasks?.(); },
    async addLog(fid, e) { must(await sb.from('log').insert({ family_id: fid, ...toSnake(e) })); reload.log?.(); },
    async updateLog(fid, id, patch) { must(await sb.from('log').update(toSnake(patch)).eq('id', id)); reload.log?.(); },
    async deleteLog(fid, id) { must(await sb.from('log').delete().eq('id', id)); reload.log?.(); },
    async ensureDay(fid, date, make) {
      must(await sb.from('days').upsert({ family_id: fid, date, ...make() }, { onConflict: 'family_id,date', ignoreDuplicates: true }));
      reload.days?.();
    },
    async updateDay(fid, date, patch) { must(await sb.from('days').update(patch).eq('family_id', fid).eq('date', date)); reload.days?.(); },

    async enablePush(fid, member) {
      if (!('serviceWorker' in navigator) || !('PushManager' in window) || !cfg.vapidPublicKey) throw new Error('unsupported');
      const perm = await Notification.requestPermission(); // skal ske direkte efter et tryk
      if (perm !== 'granted') throw new Error('denied');
      const reg = await navigator.serviceWorker.register('sw.js');
      await navigator.serviceWorker.ready;
      const sub = (await reg.pushManager.getSubscription())
        || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(cfg.vapidPublicKey) }));
      const json = sub.toJSON();
      must(await sb.from('push_subscriptions').upsert({ endpoint: json.endpoint, family_id: fid, member, subscription: json }));
    },
  };
}

// ---------------------------------------------------------------------------
function demoBackend() {
  const KEY = 'conny-demo-v2';
  let db = null;
  try { db = JSON.parse(localStorage.getItem(KEY)); } catch {}
  let me = null;
  try { me = JSON.parse(localStorage.getItem(KEY + '-me')); } catch {}
  const subs = new Set();
  let userCb = () => {};
  const save = () => {
    try { localStorage.setItem(KEY, JSON.stringify(db)); } catch {}
    for (const s of subs) s();
  };
  const setMe = (u) => {
    me = u;
    try { localStorage.setItem(KEY + '-me', JSON.stringify(u)); } catch {}
    userCb(u);
  };

  return {
    mode: 'demo',
    onUser(cb) { userCb = cb; cb(me && db ? me : null); },
    switchTo(memberId, role) { setMe({ familyId: 'demo', memberId, role }); },
    async login() {},
    async logout() { setMe(null); },
    async createFamily(_fid, members, seed) {
      db = { family: clone(seed.family), tasks: Object.fromEntries(seed.tasks.map((t) => [t.id, clone(t)])), log: {}, days: {} };
      save();
      setMe({ familyId: 'demo', memberId: members[0].id, role: 'parent' });
    },
    subscribe(_fid, { since, date }, h) {
      const f = () => {
        h.family(clone(db?.family));
        h.tasks(Object.values(db?.tasks || {}).map(clone));
        h.log(Object.entries(db?.log || {}).map(([id, e]) => ({ id, ...clone(e) })).filter((e) => e.date >= since));
        h.day(clone(db?.days?.[date] ?? null));
      };
      subs.add(f); f();
      return () => subs.delete(f);
    },
    async saveSettings(_f, s) { db.family.settings = clone(s); save(); },
    async insertTask(_f, t) { db.tasks[t.id] = clone(t); save(); },
    async updateTask(_f, id, p) { Object.assign(db.tasks[id], clone(p)); save(); },
    async deleteTask(_f, id) { delete db.tasks[id]; save(); },
    async addLog(_f, e) { db.log[Date.now().toString(36) + Math.random().toString(36).slice(2, 6)] = clone(e); save(); },
    async updateLog(_f, id, p) { Object.assign(db.log[id], clone(p)); save(); },
    async deleteLog(_f, id) { delete db.log[id]; save(); },
    async ensureDay(_f, date, make) { if (!db.days[date]) { db.days[date] = clone(make()); save(); } },
    async updateDay(_f, date, p) { Object.assign(db.days[date], clone(p)); save(); },
    async enablePush() { throw new Error('demo'); },
  };
}
