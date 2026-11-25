// Påmindelser til familiens telefoner.
// Kaldes hver hele time af databasens tidsplan (se paamindelser-tidsplan.sql) og sender:
//  - morgenhilsen på det klokkeslæt, der er valgt i appen
//  - "husk skraldet" aftenen før en afhentningsdag
// Hver påmindelse sendes højst én gang pr. dag (tabellen reminders_sent).
import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const TZ = 'Europe/Copenhagen';

function nowInDenmark() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date());
  const p = Object.fromEntries(parts.map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour) };
}
const dn = (k: string) => { const [y, m, d] = k.split('-').map(Number); return Date.UTC(y, m - 1, d) / 864e5; };
const addDays = (k: string, n: number) => new Date((dn(k) + n) * 864e5).toISOString().slice(0, 10);
const wd = (k: string) => new Date(dn(k) * 864e5).getUTCDay();

type Trash = { weekly?: number[]; biweekly?: { anchor?: string } | null; notify?: string[] };
function isTrashDay(k: string, trash: Trash = {}) {
  if ((trash.weekly || []).includes(wd(k))) return true;
  const a = trash.biweekly?.anchor;
  return !!a && (((dn(k) - dn(a)) % 14) + 14) % 14 === 0;
}

Deno.serve(async () => {
  const pub = Deno.env.get('VAPID_PUBLIC_KEY');
  const priv = Deno.env.get('VAPID_PRIVATE_KEY');
  const appUrl = Deno.env.get('APP_URL') ?? 'https://github.com';
  if (!pub || !priv) return new Response('VAPID-nøglerne mangler under Edge Functions → Secrets', { status: 500 });
  webpush.setVapidDetails(appUrl, pub, priv);

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { date, hour } = nowInDenmark();
  const { data: families, error } = await db.from('families').select('id, members, settings');
  if (error) return new Response(error.message, { status: 500 });

  let sent = 0;
  for (const f of families ?? []) {
    const s = f.settings ?? {};
    const kinds: string[] = [];
    if (hour === (s.morningHour ?? 7)) kinds.push('morgen');
    if (hour === (s.trashHour ?? 19) && isTrashDay(addDays(date, 1), s.trash)) kinds.push('skrald');
    if (!kinds.length) continue;

    const { data: subs } = await db.from('push_subscriptions').select('endpoint, member, subscription').eq('family_id', f.id);
    if (!subs?.length) continue;
    const names: Record<string, string> = Object.fromEntries((f.members ?? []).map((m: { id: string; name: string }) => [m.id, m.name]));
    const notify: string[] = s.trash?.notify ?? [];

    for (const kind of kinds) {
      // Allerede sendt i dag? Så springer vi over.
      const { error: dup } = await db.from('reminders_sent').insert({ family_id: f.id, kind, date });
      if (dup) continue;

      for (const sub of subs) {
        if (kind === 'skrald' && !notify.includes(sub.member)) continue;
        const msg = kind === 'morgen'
          ? { title: `Godmorgen ${names[sub.member] ?? ''} ☀️`, body: 'Dagens små opgaver er klar. Conny hepper på dig! 🧽' }
          : { title: 'Husk skraldet 🗑️', body: 'Skraldet bliver hentet i morgen. Stil spanden ud i aften.' };
        try {
          await webpush.sendNotification(sub.subscription, JSON.stringify({ ...msg, url: appUrl }));
          sent++;
        } catch (e) {
          const code = (e as { statusCode?: number }).statusCode;
          if (code === 404 || code === 410) await db.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
          else console.error('Kunne ikke sende', code, e);
        }
      }
    }
  }
  return Response.json({ date, hour, sent });
});
