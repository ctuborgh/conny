-- =====================================================================
-- Conny: database til Supabase
-- Kør hele filen én gang i Supabase: SQL Editor → New query → indsæt → Run
-- =====================================================================

-- ---------- Tabeller ----------

-- En familie. Medlemmer, rum og indstillinger ligger som JSON.
create table public.families (
  id        text primary key,               -- familiekoden
  name      text not null default 'Familien',
  members   jsonb not null default '[]',    -- [{id, name, role}]
  rooms     jsonb not null default '[]',    -- [{id, name, icon}]
  settings  jsonb not null default '{}',
  created   date not null default current_date
);

-- Kobler et login (auth.users) til en person i en familie.
create table public.members (
  user_id   uuid primary key references auth.users on delete cascade,
  family_id text not null references public.families on delete cascade,
  member_id text not null,
  role      text not null check (role in ('parent', 'kid')),
  unique (family_id, member_id)
);

-- Familiens opgaver.
create table public.tasks (
  family_id text not null references public.families on delete cascade,
  id        text not null,
  name      text not null,
  room      text not null,
  icon      text not null default '⭐',
  min       int  not null default 5 check (min between 1 and 240),
  every     int  not null default 7 check (every between 1 and 365),
  assignee  text not null default 'adults',  -- 'adults', 'rotate' eller et member_id
  active    boolean not null default true,
  last_done date,
  last_by   text,
  prev_done date,
  primary key (family_id, id)
);

-- Hver gang nogen klarer en opgave (giver point).
create table public.log (
  id        uuid primary key default gen_random_uuid(),
  family_id text not null references public.families on delete cascade,
  task_id   text not null,
  name      text not null,
  icon      text,
  member    text not null,
  date      date not null,
  points    int  not null default 0,
  approved  boolean not null default false,
  prev_done date,
  ts        bigint not null default (extract(epoch from now()) * 1000)::bigint
);
create index log_family_date on public.log (family_id, date);

-- Dagens plan for de voksne + ekstra opgaver sendt til nogen i dag.
create table public.days (
  family_id text not null references public.families on delete cascade,
  date      date not null,
  adults    jsonb not null default '[]',
  extra     jsonb not null default '{}',
  skipped   jsonb not null default '[]',
  primary key (family_id, date)
);

-- Telefoner, der skal have påmindelser.
create table public.push_subscriptions (
  endpoint     text primary key,
  family_id    text not null references public.families on delete cascade,
  member       text not null,
  subscription jsonb not null,
  created      timestamptz not null default now()
);

-- Husker hvilke påmindelser der er sendt, så ingen får den samme to gange.
create table public.reminders_sent (
  family_id text not null references public.families on delete cascade,
  kind      text not null,
  date      date not null,
  primary key (family_id, kind, date)
);

-- ---------- Hjælpefunktioner: hvem er jeg? ----------

create function public.my_family() returns text
language sql stable security definer set search_path = public as $$
  select family_id from members where user_id = auth.uid()
$$;

create function public.my_member() returns text
language sql stable security definer set search_path = public as $$
  select member_id from members where user_id = auth.uid()
$$;

create function public.i_am_parent() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'parent' from members where user_id = auth.uid()), false)
$$;

-- ---------- Adgangsregler (Row Level Security) ----------
-- Kun familiens egne medlemmer kan se familiens data.
-- Kun voksne kan ændre opgaver og indstillinger og godkende point.

alter table public.families           enable row level security;
alter table public.members            enable row level security;
alter table public.tasks              enable row level security;
alter table public.log                enable row level security;
alter table public.days               enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.reminders_sent     enable row level security; -- kun serveren

create policy "se egen familie"     on public.families for select to authenticated using (id = my_family());
create policy "voksne retter"       on public.families for update to authenticated using (id = my_family() and i_am_parent());

create policy "se familiens medlemmer" on public.members for select to authenticated using (family_id = my_family());

create policy "se opgaver"          on public.tasks for select to authenticated using (family_id = my_family());
create policy "voksne opretter"     on public.tasks for insert to authenticated with check (family_id = my_family() and i_am_parent());
create policy "voksne sletter"      on public.tasks for delete to authenticated using (family_id = my_family() and i_am_parent());
create policy "alle sætter flueben" on public.tasks for update to authenticated
  using (family_id = my_family()) with check (family_id = my_family());

create policy "se point"            on public.log for select to authenticated using (family_id = my_family());
create policy "log egne point"      on public.log for insert to authenticated with check (
  family_id = my_family() and (i_am_parent() or (member = my_member() and approved = false)));
create policy "voksne godkender"    on public.log for update to authenticated using (family_id = my_family() and i_am_parent());
create policy "fortryd egne"        on public.log for delete to authenticated using (
  family_id = my_family() and (i_am_parent() or (member = my_member() and approved = false)));

create policy "dagens plan"         on public.days for all to authenticated
  using (family_id = my_family()) with check (family_id = my_family());

create policy "se telefoner"        on public.push_subscriptions for select to authenticated using (family_id = my_family());
create policy "tilmeld egen telefon" on public.push_subscriptions for insert to authenticated
  with check (family_id = my_family() and member = my_member());
create policy "opdatér egen telefon" on public.push_subscriptions for update to authenticated
  using (family_id = my_family()) with check (family_id = my_family() and member = my_member());

-- Børn må kun ændre "klaret"-felterne på en opgave, ikke navn, hyppighed osv.
create function public.tasks_guard() returns trigger
language plpgsql set search_path = public as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' and not i_am_parent() then
    if (new.family_id, new.id, new.name, new.room, new.icon, new.min, new.every, new.assignee, new.active)
       is distinct from
       (old.family_id, old.id, old.name, old.room, old.icon, old.min, old.every, old.assignee, old.active) then
      raise exception 'Kun voksne kan ændre opgaver';
    end if;
  end if;
  return new;
end $$;
create trigger tasks_guard before update on public.tasks for each row execute function public.tasks_guard();

-- ---------- Rettigheder ----------
-- Skrives eksplicit, så det virker, uanset om Supabase giver adgang automatisk
-- ("Grant API access to new tables automatically") eller ej.
grant usage on schema public to service_role, authenticated;
grant all on all tables in schema public to service_role;      -- serverfunktionerne
grant all on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;
revoke all on all tables in schema public from anon;
grant select, insert, update, delete on
  public.families, public.members, public.tasks, public.log, public.days, public.push_subscriptions
  to authenticated;
grant execute on function public.my_family(), public.my_member(), public.i_am_parent() to authenticated;

-- ---------- Live-opdatering mellem telefonerne ----------
alter publication supabase_realtime add table public.families, public.tasks, public.log, public.days;
