// Opretter en ny familie: familien, et login til hver person og startopgaverne.
// Kører på serveren, fordi kun serveren må oprette logins til andre (fx børnene).
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

type Member = { id: string; name: string; role: 'parent' | 'kid'; pin: string };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Kun POST' }, 405);

  let body: { fid: string; members: Member[]; seed: { family: Record<string, unknown>; tasks: Record<string, unknown>[] } };
  try { body = await req.json(); } catch { return json({ error: 'Ugyldig forespørgsel' }, 400); }
  const { fid, members, seed } = body;

  // Kontrol af input
  const ok = typeof fid === 'string' && /^[a-z0-9]{3,30}$/.test(fid)
    && Array.isArray(members) && members.length >= 1 && members.length <= 10
    && members[0].role === 'parent'
    && members.every((m) => /^[a-z0-9]{1,30}$/.test(m.id) && typeof m.name === 'string' && m.name.length <= 40
      && (m.role === 'parent' || m.role === 'kid') && /^\d{4}$/.test(m.pin))
    && new Set(members.map((m) => m.id)).size === members.length
    && seed && Array.isArray(seed.tasks) && seed.tasks.length <= 300;
  if (!ok) return json({ error: 'Ugyldige oplysninger' }, 400);

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Familien oprettes først, så familiekoden er "taget"
  const fam = seed.family as { name?: string; rooms?: unknown; settings?: unknown };
  const { error: famErr } = await db.from('families').insert({
    id: fid,
    name: fam.name ?? 'Familien',
    members: members.map(({ id, name, role }) => ({ id, name, role })),
    rooms: fam.rooms ?? [],
    settings: fam.settings ?? {},
  });
  if (famErr) return famErr.code === '23505' ? json({ error: 'taken' }, 409) : json({ error: famErr.message }, 400);

  const created: string[] = [];
  try {
    for (const m of members) {
      const { data, error } = await db.auth.admin.createUser({
        email: `${fid}.${m.id}@conny.invalid`,
        password: `conny-${m.pin}`,
        email_confirm: true,
      });
      if (error) throw error;
      created.push(data.user.id);
      const { error: mErr } = await db.from('members').insert({ user_id: data.user.id, family_id: fid, member_id: m.id, role: m.role });
      if (mErr) throw mErr;
    }
    const rows = seed.tasks.map((t) => ({
      family_id: fid, id: t.id, name: t.name, room: t.room, icon: t.icon, min: t.min, every: t.every,
      assignee: t.assignee, active: t.active !== false, last_done: t.lastDone ?? null,
    }));
    const { error: tErr } = await db.from('tasks').insert(rows);
    if (tErr) throw tErr;
  } catch (err) {
    // Ryd op, så familiekoden kan bruges igen
    for (const id of created) await db.auth.admin.deleteUser(id);
    await db.from('families').delete().eq('id', fid);
    return json({ error: (err as Error).message ?? String(err) }, 500);
  }

  return json({ ok: true });
});
