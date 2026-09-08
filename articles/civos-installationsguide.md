# CivOS: installera och pröva hela arbetsflödet

**Kris Ledel · September 2026**

Webbversionen av CivOS håller ihop underlag, perspektiv, granskning, överläggning, beslut, genomförande, utfall och ändringar av arbetsregler. Du arbetar i formulär i webbläsaren. Uppgifterna sparas på servern och kan granskas från andra konton med tilldelad åtkomst.

Den här guiden gäller webbversionen i katalogen `web/`. Python-programmet i `civos/` är den tidigare prototypen 0.2. Dess kommandon skapar en lokal beslutslogg och en HTML-rapport. De startar inte webbversionen, och dess JSON-export kan inte importeras direkt här.

## 1. Installera beroenden, nyckel och databas

Du behöver Node.js 22.13 eller senare. Hämta den version av [repot](https://github.com/krisledel/civos) som innehåller `web/`, eller packa upp leveranspaketet. Öppna en terminal i repots rot och kör:

```sh
node --version
cd web
npm ci
npm run setup:key
npm run db:migrate
npm run dev
```

`npm ci` installerar versionerna i låsfilen. `setup:key` skapar en privat Ed25519-nyckel i JWK-format som värde för `CIVOS_SIGNING_KEY` i `web/.dev.vars`. Nyckeln används av servern när den signerar exportpaket. Den privata nyckeln ska stanna där; exporten innehåller den publika nyckeln.

`.dev.vars` är en lokal, ignorerad fil. Lägg den inte i versionshantering, klientkod eller ett delat paket. Behåll samma nyckel när du vill att en lokal installation ska ha samma fingeravtryck över tid. Ett avsiktligt nyckelbyte ger ett nytt fingeravtryck som mottagare behöver kontrollera.

`db:migrate` kör migrationerna mot den lokala D1-databasen genom `wrangler.local.json` och bindningen `DB`. Kommandot använder lokal drift. Bilagor lagras genom bindningen `ATTACHMENTS`. Lokal databas och objektlagring är utvecklingsmiljöns data, inte en kopia av en publicerad installation.

Öppna adressen som `dev` skriver ut och använd sidans inloggning. Utvecklingsmiljön ger en lokal testidentitet. En privat publicering använder värdplattformens inloggning. Exponera inte utvecklingsservern som en publik tjänst; den lokala testidentiteten är inte en produktionsinloggning.

Kontrollera även typningen och produktionsbygget från `web/`:

```sh
npm run typecheck
npm run build
```

En installation utan `CIVOS_SIGNING_KEY` kan inte skapa signerade exporter. Ett fel om saknade tabeller betyder att den lokala databasen behöver rätt migrationer. Spara felmeddelandet och åtgärda grundfelet innan du fortsätter provkörningen.

## 2. Skapa arbetsytan och förstå åtkomsten

Skapa en arbetsyta med ett tydligt syfte, exempelvis ”Pröva en extra öppenkväll i föreningsverkstaden”. Kontot som skapar arbetsytan blir ägare. En första arbetsregel skapas med krav på ett granskarkonto, inga obligatoriska grupper och 30 dagar som högsta uppföljningstid.

Det finns fyra kontoroller:

| Roll | Vad kontot kan göra |
| --- | --- |
| Ägare | Hantera innehåll, regler, inbjudningar, åtkomst och nodtillit. Revidera egna och andras poster med historiken bevarad. |
| Redaktör | Registrera innehåll och regelförslag samt revidera egna poster. |
| Granskare | Registrera bedömningar, argument och utfall samt revidera egna sådana poster. |
| Läsare | Läsa och exportera innehållet utan att ändra den ursprungliga arbetsytan. |

Ägaren kan skapa en inbjudningskod till en av de tre andra rollerna. Koden gäller i 24 timmar och kan användas en gång. Ge koden till den avsedda deltagaren genom en kanal ni redan använder.

En deltagarpost är något annat än ett konto. Den beskriver namn, roll, grupper, kunskapsområden och intressen. Namnet i posten ger ingen behörighet. När en bedömning registreras sparas också vilket inloggat konto som skrev den. Det är de registrerande kontona som räknas i beslutsregelns granskningskrav.

## 3. Registrera ett syntetiskt ärende genom alla lager

Använd följande konstruerade fall. Det gör ingen utsaga om en verklig förening:

> Fjorton av tjugo svarande medlemmar vill ha öppet på tisdag 18–20. Två volontärer kan bemanna ett provtillfälle. Gruppen överväger att prova en kväll, med målet minst tolv faktiska besökare.

Skapa ärendet och ange ”Medlemmar” och ”Volontärer” som berörda grupper. Lägg till en deltagarpost för vardera gruppen. Ange att personerna och uppgifterna är testdata.

Skapa två perspektiv. Det första beskriver medlemmarnas tillgång till lokalen och använder enkätsvar. Det andra beskriver möjlig bemanning och använder volontärernas schema. Ange för båda vad metoden kan visa och vad den inte fångar.

Lägg till begreppen ”önskad öppettid” och ”bemanningsbar öppettid” i respektive perspektiv. Skapa en överlappande relation mellan dem, begränsad till försöksveckan. Skriv uttryckligen att önskemål inte är bindande anmälningar och att bemanning inte garanterar besök.

Skapa sedan två källor: en syntetisk enkät och ett syntetiskt bemanningsschema. Adresserna kan vara `urn:civos:test:verkstad:enkat` och `urn:civos:test:verkstad:bemanning`. Ge dem olika gemensamt ursprung eftersom de beskriver olika testunderlag. Om du lägger till flera kopior av samma enkät ska kopiorna ha samma ursprung.

Registrera observationerna med rätt källa och perspektiv. Ange tid, plats och osäkerhet. En mätuppgift, en tolkning, en prognos och en värdering har olika kategorier. Använd den kategori som motsvarar vad ni faktiskt påstår.

## 4. Låt granskningsregeln prövas

Registrera alternativet ”Genomför ett provtillfälle”. Koppla det till båda observationerna. Ange nyttan med att mäta verklig närvaro, kostnaden om fyra volontärtimmar och att försöket upphör efter den enda kvällen.

Försök registrera ett beslut innan observationerna har granskats. Det ska avvisas. Granska sedan varje observation och ange metod, slutsats, underlag, intressen och reservationer. En granskare kan stödja att enkäten återges korrekt och samtidigt vara osäker på vad den säger om faktisk närvaro.

Om ni prövar en regel med två granskarkonton måste två separata konton registrera en bedömning av varje observation i alternativets kunskapsgrund. Två olika deltagarnamn inmatade från samma konto räcker inte. Två konton bevisar i sin tur inte att granskarna är oberoende personer eller sakkunniga; detta behöver bedömas i arbetsformen.

Lägg in ett argument från medlemmarna för försöket och ett villkor från volontärerna: inget automatiskt återkommande öppethållande. Om arbetsregeln kräver dessa grupper ska beslutet avvisas tills argument från båda har registrerats. Representationskontrollen använder den grupp som den angivna deltagaren uppges företräda. Programmet kontrollerar inte personens mandat från gruppen.

En bedömning med ”invänder” eller ”osäkert” försvinner inte när ett beslut registreras. Kravet gäller dokumenterad granskning. Det innebär inte att alla måste ha samma slutsats.

## 5. Fatta beslutet och registrera utfallet

Välj provtillfället som alternativ och ange en ansvarig deltagare. Beskriv vilket mandat som påstås ge arbetsgruppen rätt att ordna försöket. Motivera beslutet med den kvarstående osäkerheten synlig.

Ange ett framtida uppföljningsdatum, exempelvis om sju dagar. Sätt indikatorn till ”Antal unika besökare”, målvillkoret till ”minst”, målvärdet till `12` och enheten till `personer`. Skriv ett stoppvillkor: försöket ställs in om färre än två volontärer kan bemanna det. Välj den aktuella arbetsregeln.

Skapa en åtgärd med ansvarig, sista datum och status. I ett syntetiskt test kan du därefter registrera ett konstruerat utfall på `8` personer med en egen källa. Mättidpunkten måste ligga efter det registrerade beslutet. Enheten ska vara exakt `personer` även här.

Kontrollera att översikten visar att målet inte är uppnått. Revidera åtgärdens status till klar och ange var uppföljningen finns. Att åtgärden är genomförd gör inte målet uppnått. Att utfallet ligger under målet bevisar inte varför det gjorde det.

## 6. Ändra regeln med erfarenheten som underlag

Skapa ett ändringsförslag kopplat till beslutet och utfallet. Beskriv problemet: uttryckt intresse användes för att bedöma faktisk närvaro. Föreslå att framtida ärenden redovisar enkätsvar och bekräftade anmälningar separat. Ange önskat antal granskarkonton, obligatoriska grupper och högsta uppföljningstid.

Ägaren kan anta eller avslå förslaget med en motivering. Ett antagande skapar både regelbeslutet och en ny version av arbetsregeln. Kontrollera att ett nytt beslut kräver den nya versionen. Det första beslutet ska fortfarande visa regeln som gällde när det registrerades.

Rättelser görs genom revision. En ny post hänvisar till föregångaren med `supersedes`. Den gamla posten finns kvar, och tidigare hänvisningar ändras inte. När en observation revideras ska den som granskar ett äldre beslut kunna se att dess underlag har förändrats.

## 7. Exportera, importera och fortsätt lokalt

Exportera arbetsytan till en signerad JSON-fil. Paketet innehåller posthistoriken och uppgifter om nod, arbetsyta, exporttid, hashkedjans slutvärde, publik nyckel och signatur. Nodens privata nyckel följer inte med. Signaturen avser nodens exportkuvert, inte personliga signaturer från deltagarna.

Importera filen utan att ändra innehåll eller formatering. Mottagaren kontrollerar format, publik nyckel, fingeravtryck, Ed25519-signatur, posternas hashkedja och hänvisningar. En godkänd import skapar en separat skrivskyddad gren med den mottagna historiken.

Jämför nyckelns fingeravtryck med avsändaren genom en separat känd kanal om du behöver fastställa vem avsändaren är. En giltig signatur säger att motsvarande nyckel har signerat paketet. Den säger inte att innehållet är sant, att organisationen har mandat eller att granskningen varit oberoende. Arbetsytans ägare kan dokumentera erkända och återkallade nycklar med sakområde och motivering.

Skapa en lokal fortsättning av importen när du vill arbeta vidare. Den får egen åtkomst och en lokal arbetsregel. Importerade behörigheter följer inte med. Registrera lokala bedömningar före nya beslut; tidigare importerade bedömningar uppfyller inte automatiskt den nya grenens lokala granskningskrav. Försök fatta ett beslut innan lokal granskning finns och kontrollera att det avvisas.

Exporter innehåller poster, inte bilagefiler, medlemsbehörigheter eller nodtillitsregister. En importerad källa kan därför visa en bilagereferens utan att filen finns på den nya noden. Dela nödvändiga filer separat, jämför deras SHA-256-värden och registrera den lokala tillgången till dem. Exporten är inte en fullständig driftbackup.

Grenarna förblir separata. CivOS synkroniserar dem inte automatiskt och avgör inte vilken gren som har rätt. Nya uppgifter, konflikter och fortsatt samarbete kräver lokal granskning och nya överföringar.

## Posttyperna i installationen

| Post | Användning |
| --- | --- |
| `case` | Avgränsa frågan, sammanhanget och berörda grupper. |
| `actor` | Beskriva deltagare, uppdrag, grupper och intressen. |
| `source` | Registrera källa, metod, ursprung, begränsningar och bilagereferens. |
| `observation` | Skriva uppgiften med kategori, underlag, perspektiv och osäkerhet. |
| `frame` | Beskriva ett perspektivs metod, antaganden och begränsningar. |
| `concept` | Definiera ett begrepp inom ett perspektiv. |
| `mapping` | Relatera två begrepp med omfattning, förlust och motivering. |
| `assessment` | Granska en observation, begreppsrelation, ett alternativ eller utfall. |
| `option` | Beskriva handlingsalternativets grund, nytta, kostnader och reversibilitet. |
| `argument` | Dokumentera stöd, motstånd eller villkor för ett alternativ. |
| `decision` | Registrera val, ansvar, mandat, osäkerhet, mål och regelversion. |
| `task` | Följa genomförande, ansvarig, tidsfrist och status. |
| `outcome` | Registrera mätvärde, underlag, begränsningar och nästa steg. |
| `policy` | Ange arbetsregeln och dess procedurkrav. |
| `rule_change` | Föreslå en regeländring utifrån konkreta erfarenheter. |
| `rule_resolution` | Anta eller avslå ändringsförslaget med motivering. |

Fält och validering definieras i `web/lib/model.ts`. Lagring, kontroller av behörighet och lokala grenar finns i `web/lib/store.ts`; paketets signering och verifiering finns i `web/lib/bundles.ts`.

## Vad provkörningen visar

Provkörningen visar om hela flödet går att genomföra och om avsedda begränsningar fungerar. Den visar inte att CivOS förbättrar besluten i en verklig organisation. För det behövs en jämförelse med det arbetssätt ni redan använder.

Låt någon som inte skrev besluten återfinna underlag, invändning, ansvarig, senaste revision, mål och utfall. Mät både träffsäkerhet och tid. Räkna även kostnaden för registrering och granskning. Dokumentera om deltagare kunde invända och om någon berörd grupp saknades.

Ett legitimt mandat, faktasanning och decentraliserad konsensus uppstår inte automatiskt i en databas. CivOS gör det möjligt att dokumentera och pröva sådana anspråk. Människorna och organisationerna som använder systemet ansvarar för vad de betyder i praktiken.


Driftgränser: högst 1 900 poster och 1,5 MB kanonisk posthistorik per arbetsyta, 2 MB per överföringsfil och 5 MB per bilaga. Ärenden har beständiga ID:n och kan inte revideras. Vidareexport av en skrivskyddad import bevarar originalkuvert och signatur. En lokal fortsättning exporterar signerade ursprungsuppgifter: basens slutvärde och sekvens, ursprungsnod, nyckelfingeravtryck och originalkuvertets hash. Originalkvittot bevaras lokalt.
