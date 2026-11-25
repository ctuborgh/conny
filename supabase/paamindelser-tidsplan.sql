-- =====================================================================
-- Conny: tidsplan for påmindelser
-- Kør denne fil i SQL Editor EFTER at funktionen "paamindelser" er lagt online.
-- Projektets adresse og den offentlige anon-nøgle er udfyldt nedenfor.
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
    url     := 'https://zekkrswklmyskzmmzmpn.supabase.co/functions/v1/paamindelser',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpla2tyc3drbG15c2t6bW16bXBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTU1ODU4MTEsImV4cCI6MjExMTE2MTgxMX0.OqIlfG1Yn4iUVd2W1UKtpOnPhL8zuYSb2LshfSs0g58'),
    body    := '{}'::jsonb
  );
  $$
);
