# Sådan kommer Conny på familiens iPhones

Conny bruger to gratis tjenester. Ingen af dem kræver betalingskort.
- **Supabase** står for login, den delte database og påmindelserne.
- **GitHub** gemmer koden og lægger appen online med GitHub Pages.

Du gør selv de trin, der kræver dine konti. Claude klarer resten.

---

## Del 1: Supabase

### 1. Opret projektet
1. Gå til **supabase.com** og log ind. Du kan logge ind med din GitHub-konto.
2. Tryk **New project**.
   - Navn: `conny`
   - Region: **Central EU (Frankfurt)**
   - Database Password: vælg en stærk adgangskode og gem den et sikkert sted. Claude skal ikke bruge den.
3. Tryk **Create new project**, og vent et par minutter, til projektet er klar.

### 2. Opret databasen
1. Vælg **SQL Editor** i venstre menu og tryk **New query**.
2. Åbn filen `supabase/opsaetning.sql` fra Conny-mappen, kopiér hele indholdet, og indsæt det.
3. Tryk **Run**. Der skal stå *Success. No rows returned*.

### 3. Luk for fremmede tilmeldinger
1. Gå til **Authentication → Sign In / Providers**.
2. Slå **Allow new users to sign up** fra, og tryk **Save**.
   Familiens logins bliver oprettet af appen selv, så ingen fremmede kan oprette sig.

### 4. Send to oplysninger til Claude
1. Gå til **Project Settings → Data API** og kopiér **Project URL**.
2. Gå til **Project Settings → API Keys** og kopiér nøglen **anon public**.
3. **Send begge til Claude.** De er offentlige og ikke hemmelige.

### 5. Hemmelige nøgler til påmindelser (du gør det selv)
1. Åbn filen `hemmeligt/vapid-noegler.txt` i Conny-mappen.
2. Gå i Supabase til **Edge Functions → Secrets**, og tilføj:
   - `VAPID_PUBLIC_KEY`: den offentlige nøgle fra filen
   - `VAPID_PRIVATE_KEY`: den private nøgle fra filen
   - `APP_URL`: appens adresse, som du får i trin 9. Den kan du tilføje bagefter.

Mappen `hemmeligt` kommer aldrig på GitHub.

---

## Del 2: Funktionerne online

### 6. Log ind på Supabase fra terminalen (én gang)
Claude giver dig kommandoen `npx supabase login`. Den åbner Supabase i din browser, hvor du godkender.

### 7. Claude lægger funktionerne online og starter tidsplanen
- Claude lægger de to funktioner online: `opret-familie` og `paamindelser`.
- Claude udfylder filen `supabase/paamindelser-tidsplan.sql`.
- Du kører filen i **SQL Editor**, ligesom i trin 2. Derefter tjekker databasen hver hele time, om nogen skal have en påmindelse.

---

## Del 3: GitHub

### 8. Opret et repository
1. Gå til **github.com** og tryk **New repository**.
2. Navn: `conny`. Vælg **Public**, for GitHub Pages er kun gratis for offentlige repositories. Tilføj **ikke** en README.
3. **Send adressen til Claude**, fx `https://github.com/ditbrugernavn/conny`.

Koden er offentlig, men familiens data er det ikke. Navne, opgaver og point ligger kun i Supabase og er beskyttet af adgangsreglerne.

### 9. Slå GitHub Pages til
1. Claude lægger koden op. Første gang kan det være nødvendigt, at du selv kører én kommando, som Claude giver dig.
2. I repository'et går du til **Settings → Pages**. Under **Source** vælger du **GitHub Actions**.
3. Efter et minut ligger appen på `https://ditbrugernavn.github.io/conny/`. Det er den adresse, der skal bruges som `APP_URL` i trin 5.

Hver gang koden ændres og lægges på GitHub, opdateres appen automatisk.

---

## Del 4: På hver iPhone
1. Åbn adressen i **Safari**.
2. Tryk på **Del-knappen** (firkanten med pilen op) og vælg **Føj til hjemmeskærm**.
3. Åbn Conny fra hjemmeskærmen.
4. **Mor:** vælg *Opret familie*. Skriv alles navne, og giv hver person en PIN på 4 cifre.
   **Alle andre:** log ind med familiekoden, dit navn og din PIN.
5. Gå ind under *Indstillinger* eller *Mine point* og tryk **Slå påmindelser til**. Det kræver iOS 16.4 eller nyere.
