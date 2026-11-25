# Conny the Cleaner 🧽

En dansk familie-app, der deler rengøringen op i små daglige opgaver, så weekenden er fri.

- **Voksne** får en fælles plan på ca. 20 minutter om dagen. Opgaverne vælges ud fra, hvad der er mest "for sent".
- **Børn** ser kun deres egne opgaver. Mor eller far godkender dem, og pointene bliver til lommepenge.
- **Påmindelser** sendes hver morgen og aftenen før, skraldet bliver hentet.
- **Conny**, en sød svamp, hepper og får kasket, solbriller og krone, når familien samler point.

## Teknik

| Del | Værktøj |
|---|---|
| App (frontend) | HTML, CSS og JavaScript uden build-trin, installerbar på iPhone (PWA) |
| Hosting | Vercel, forbundet til GitHub-repoet. Udgiver mappen `public` ved hvert push til `main` |
| Login og database | Supabase Auth og Postgres med Row Level Security (`supabase/opsaetning.sql`) |
| Live-opdatering | Supabase Realtime |
| Påmindelser | Supabase Edge Function + pg_cron + Web Push (`supabase/functions/paamindelser`) |

## Mapper

- `public/`: selve appen (`app.js` er brugerfladen, `backend.js` taler med Supabase, `data.js` indeholder startopgaverne)
- `supabase/`: databasens tabeller og regler, serverfunktioner og tidsplan
- `OPSAETNING.md`: trin for trin-opsætning

Live: https://conny-the-cleaner.vercel.app/

Uden `public/config.js` udfyldt kører appen i **demo-tilstand**, hvor alt kun gemmes i browseren.
