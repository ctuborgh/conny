-- =====================================================================
-- Conny: tidsplan for påmindelser
-- Kør denne fil i SQL Editor EFTER at funktionen "paamindelser" er lagt online.
-- Erstat PROJEKT-REF og ANON-NØGLE nedenfor (Claude kan udfylde dem for dig).
-- Begge dele er offentlige oplysninger og ikke hemmelige.
-- =====================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Hvert hele klokkeslæt kalder databasen funktionen, som selv
-- finder ud af, om nogen skal have en påmindelse lige nu.
select cron.schedule(
  'conny-paamindelser',
  '0 * * * *',
  $$
  select net.http_post(
    url     := 'https://PROJEKT-REF.supabase.co/functions/v1/paamindelser',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ANON-NØGLE'),
    body    := '{}'::jsonb
  );
  $$
);
