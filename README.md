# CivOS

**Kris Ledel**

CivOS är en arbetsyta för att undersöka frågor, jämföra perspektiv, granska underlag, fatta redovisade beslut och följa upp vad som händer. Arbetsreglerna kan också granskas och ändras. Webbversionen omsätter alla fem lager i den ursprungliga arkitekturen till sammanhängande arbetsflöden.

En organisation kan exempelvis registrera observationer från två grupper, beskriva vad gruppernas begrepp betyder, behålla deras skilda bedömningar, välja ett handlingsalternativ och mäta utfallet. Om underlaget eller reglerna behöver ändras sparas en ny version. Äldre beslut behåller hänvisningarna till det underlag som användes då.

Gränssnittet har dokumentträd, snabböppning med Ctrl+K, en beständig läspanel med bakåtlänkar och en klickbar sambandsgraf. Grafen visar högst 80 dokument åt gången och kan avgränsas till ett ärende eller en sökning.

## Börja här

Använd webbversionen i `web/` för det fullständiga arbetsflödet. Den har kontobaserad åtkomst, arbetsytor, formulär, bilagor, granskning, beslutsvillkor, uppföljning och signerat datautbyte.

Python-programmet i `civos/` är den tidigare prototypen, **CivOS 0.2**. Det kör en lokal SQLite-logg och skapar en HTML-rapport. Det har fem posttyper och ett eget JSON-format. Rapporten är en läsvy. Den nya webbversionen har en annan datamodell och importerar inte 0.2-exporter automatiskt.

| Del | Webbversion | CivOS 0.2 |
| --- | --- | --- |
| Användning | Redigering och samarbete i webbläsaren | Python-kommandon och HTML-rapport |
| Data | Arbetsytor i D1, bilagor i R2 | Lokal SQLite-databas |
| Identitet | Registrerande konto och arbetsyteroll | Självangivet författarnamn |
| Arkitektur | Alla fem lager, 16 posttyper | Påstående, underlag, bedömning, beslut, utfall |
| Överföring | Signerat paket, isolerad import och lokal fortsättning | JSON-export och återställning till tom databas |

## De fem lagren

1. **Observation och sammanhang.** Registrera källor, metoder, tid, plats och osäkerhet. Skilj observationer från tolkningar, prognoser och värderingar. Ange gemensamt ursprung så att kopierade uppgifter inte framställs som oberoende belägg.
2. **Perspektiv och begrepp.** Beskriv antaganden, giltighetsområde och begränsningar. Relatera begrepp mellan perspektiv och ange vad som går förlorat i översättningen. Oenighet kan förbli synlig.
3. **Förtroende och granskning.** Koppla bedömningar till konkreta uppgifter, begreppsrelationer, alternativ eller utfall. Dokumentera granskningsmetod, reservationer och intressen. Håll kontots registrering skild från den deltagare som anges i innehållet.
4. **Beslut och konsekvenser.** Jämför alternativ och argument. Registrera ansvarig, mandat, accepterad osäkerhet, kvarstående invändningar, mål och stoppvillkor. Följ åtgärder och mät utfall i samma enhet som beslutets mål.
5. **Samordningens granskning.** Visa saknad granskning, öppna invändningar, utebliven representation, reviderat underlag och missad uppföljning. Låt erfarenheter leda till dokumenterade ändringsförslag och nya arbetsregler.

## Posttyper

Den körbara specifikationen finns i [`web/lib/model.ts`](web/lib/model.ts).

| Typ | Innehåll |
| --- | --- |
| `case` — ärende | Fråga, sakområde, plats, berörda grupper och tidshorisont. |
| `actor` — deltagare | Angivet namn, uppdrag, företrädda grupper, kunskapsområden och intressen. |
| `source` — källa | Adress, insamlingsmetod, datum, gemensamt ursprung, begränsningar och eventuell bilagereferens. |
| `observation` — observation | Uppgift, kategori, underlag, perspektiv, tid, plats, osäkerhet och uppgifter som den motsäger eller begränsar. |
| `frame` — perspektiv | Beskrivning, metod, antaganden, omfattning, begränsningar och företrädda grupper. |
| `concept` — begrepp | Betydelse och avgränsningar inom ett bestämt perspektiv. |
| `mapping` — begreppsrelation | Två begrepp, relation, tillämpningsområde, översättningsförlust och motivering. |
| `assessment` — bedömning | Granskat objekt, angiven granskare, perspektiv, slutsats, metod, oberoende, intressen och underlag. |
| `option` — alternativ | Föreslagen handling, kunskapsgrund, nytta, kostnader och möjlighet att avbryta. |
| `argument` — argument | Ställning för, emot eller med villkor; deltagare, perspektiv, skäl och hänvisningar. |
| `decision` — beslut | Valt alternativ, ansvarig, mandat, motivering, invändningar, datum, mätbart mål, stoppvillkor och regelversion. |
| `task` — åtgärd | Beslut, ansvarig, tidsfrist, status och genomförande. |
| `outcome` — utfall | Beslut, mättidpunkt, värde, enhet, metod, underlag, begränsningar och nästa steg. |
| `policy` — arbetsregel | Regeltext, minsta antal granskarkonton, obligatoriska grupper och högsta uppföljningstid. |
| `rule_change` — ändringsförslag | Problem, föreslagen regel, ändrade villkor och de poster som motiverar förslaget. |
| `rule_resolution` — regelbeslut | Antagande eller avslag av ett ändringsförslag, med motivering. |

Ärenden, deltagare och arbetsregler med tillhörande ändringsförslag gäller arbetsytan. Övriga poster hör till ett ärende. Hänvisningar måste peka på befintliga poster av rätt typ.

## Konton och roller

Arbetsytor är åtkomstskyddade. Inloggningen identifierar kontot som registrerar en post. Ett deltagarnamn i ett formulär ger ingen behörighet och är ingen verifiering av personens uppdrag.

| Roll | Befogenheter |
| --- | --- |
| Ägare (`owner`) | Hanterar arbetsytans innehåll, inbjudningar, åtkomst, nodtillit och arbetsregler. Kan revidera andras poster med historiken bevarad. |
| Redaktör (`editor`) | Registrerar innehåll och ändringsförslag samt reviderar egna poster. Kan inte anta regler eller hantera åtkomst. |
| Granskare (`reviewer`) | Registrerar bedömningar, argument och utfall samt reviderar egna tillåtna poster. |
| Läsare (`viewer`) | Läser och exporterar tillgängligt innehåll. Kan inte ändra den ursprungliga arbetsytan. |

Ägaren kan bjuda in de andra rollerna med en kod som kan användas en gång och gäller i 24 timmar. En separat lokal fortsättning får en egen ägare; den ändrar inte källarbetsytans behörigheter.

Ett beslut kräver den gällande regelversionen, ett framtida uppföljningsdatum, tillräckligt många separat registrerande granskarkonton för varje observation i alternativets kunskapsgrund och argument från regelns obligatoriska grupper. Antalet konton är en procedurkontroll. Det bevisar inte oberoende sakkunskap eller verklig representation. En invändning kan finnas kvar när ett beslut registreras.

## Revisioner och återkoppling

En revision skapar en ny post med `supersedes` som hänvisar till den senaste versionen av samma posttyp och ärende. Den gamla posten finns kvar. Tidigare hänvisningar flyttas inte. Systemet visar därför när ett beslut eller en bedömning hänvisar till underlag som senare har reviderats.

När ägaren antar ett ändringsförslag registreras både regelbeslutet och en ny version av arbetsregeln. Tidigare beslut fortsätter visa den regel de fattades under. Nya beslut måste använda den aktuella versionen.

Mål jämförs numeriskt med `minst`, `högst` eller `exakt`. Ett missat mål syns som avvikelse. En registrerad mätning kan vara ofullständig eller ha andra möjliga förklaringar; jämförelsen fastställer inte kausalitet. Varje beslut har ett uttryckligt framtida uppföljningsdatum inom arbetsregelns högsta tidsfrist.

## Signerat datautbyte

Exporten är ett kanoniskt JSON-paket i formatet `civos.bundle.v1`. Det innehåller arbetsytans posthistorik, nod- och arbetsyteidentifierare, exporttid, hashkedjans slutvärde, publik nyckel, fingeravtryck och en Ed25519-signatur. Nodens privata nyckel ligger på servern och lämnar inte med exporten.

Importen kontrollerar paketformat, fingeravtryck, signatur, hashkedja och posternas struktur. Ändra inte JSON-filens formatering före import. Ett giltigt paket skapar en separat, skrivskyddad gren. Det slås inte automatiskt ihop med en befintlig arbetsyta.

Skapa en lokal fortsättning för att arbeta vidare. Originalhistoriken bevaras, medan den nya grenen får egen åtkomst och en lokal arbetsregel. Granska importerade uppgifter lokalt innan de används som grund för nya beslut. Importerade deltagarnamn, konton och bedömningar ger ingen lokal behörighet eller automatisk rätt att räknas som lokal granskning.

Ägaren kan föra ett lokalt register över erkända eller återkallade nyckelfingeravtryck, med sakområde och motivering. Jämför ett fingeravtryck med avsändaren genom en separat känd kanal när dess identitet spelar roll. Signaturkontrollen visar att paketet signerats av motsvarande nyckel; den avgör inte om avsändaren är trovärdig inom ett ämne.

Exporten omfattar posterna. Bilagornas innehåll, medlemsbehörigheter och registret över nodtillit ingår inte. Bilagereferenser och kontrollsummor kan följa med posterna, men en importerad referens innebär inte att filen finns hos mottagaren. Överför nödvändiga bilagor separat och kontrollera deras hashvärden.

Detta är manuell överföring mellan separata arbetsytor. Någon automatisk synkronisering, sammanslagning av konflikter eller decentraliserad konsensus ingår inte.

## Kör webbversionen lokalt

Node.js 22.13 eller senare krävs. Kör från repots rot:

```sh
cd web
npm ci
```

Webbservern använder databasbindningen `DB`, objektlagringen `ATTACHMENTS` och hemligheten `CIVOS_SIGNING_KEY`. Lokalt ligger signeringsnyckeln i den ignorerade filen `.dev.vars` i `web/`. Nyckeln ska vara en privat Ed25519-nyckel i JWK-format. Den ska aldrig läggas i klientkod, versionshantering eller ett exportpaket.

Skapa en lokal signeringsnyckel, kör databasens migrationer och starta utvecklingsservern:

```sh
npm run setup:key
npm run db:migrate
npm run dev
```

Öppna den adress som servern skriver ut och använd sidans inloggning. Utvecklingsmiljön tilldelar en lokal testidentitet. Den privata publiceringen använder värdplattformens inloggning. Ett vanligt namn i en förfrågan är inte en säker ersättning.

Kontrollera typningen och produktionsbygget:

```sh
npm run typecheck
npm run build
```

Se den fullständiga [installationsguiden](articles/civos-installationsguide.md) för migrationer, nyckelgenerering och kontroll av installationen.

## Kontrollera ett helt arbetsflöde

Skapa ett syntetiskt ärende om ett enstaka öppettillfälle i en föreningslokal. Låt medlemsbehov och bemanning vara två perspektiv. Registrera underlagen, relationen mellan deras begrepp, två skilda bedömningar och argument från båda grupperna. Välj alternativ först när regelns granskningskrav är uppfyllda.

Registrera ett mål om minst tolv besökare och ett utfall på åtta. Kontrollera att målet markeras som missat. Föreslå därefter en ändrad arbetsregel som skiljer enkätsvar från bekräftade anmälningar. Anta den och kontrollera att nästa beslut kräver den nya regelversionen. Exportera ärendet, importera det som en isolerad gren och fortsätt med lokal granskning.

Detta provar funktionerna. En verklig pilot behöver dessutom jämföra nyttan med befintliga arbetssätt: hur snabbt en annan person kan återfinna skäl, invändningar, ansvar, senaste rättelse och utfall, och hur mycket arbete registreringen kräver. Inga uppmätta organisationsvinster eller genomförda samhällspiloter hävdas här.

## Begränsningar

CivOS skapar inte saklig sanning, ett legitimt mandat, verklig representation eller konsensus genom att registrera information. Signering ersätter inte källkritik. Flera konton ersätter inte oberoende granskare. Ett dokumenterat beslut utför inte handlingen och bevisar inte att den är berättigad.

Hashkedjan gör historiken kontrollerbar. Den som kontrollerar både databas och nodens privata nyckel kan skriva om och signera en ny historia. Oberoende bevarade exporter och tidigare kända fingeravtryck ger mottagare underlag för jämförelse.

Historiken bevarar tidigare versioner. En revision raderar inte personuppgifter ur redan delade kopior. Börja med material som deltagarna har rätt att registrera och dela.

## Kod och texter

- [`web/`](web/) — webbversionen.
- [`civos/`](civos/) och [`tests/`](tests/) — Python-prototypen 0.2 och dess tester.
- [`articles/civos-instruction-set.md`](articles/civos-instruction-set.md) — arkitektur och tekniska avgränsningar.
- [`articles/civos-installationsguide.md`](articles/civos-installationsguide.md) — installation och sammanhängande provkörning.
- [`docs/pilot-protocol.md`](docs/pilot-protocol.md) — förslag till jämförande utvärdering; versionsspecifika uppgifter om 0.2 måste läsas som sådana.

Kod licensieras enligt MIT. Texter och koncept licensieras enligt CC BY-SA 4.0. Se [`LICENSE`](LICENSE).


Driftgränser: högst 1 900 poster och 1,5 MB kanonisk posthistorik per arbetsyta, 2 MB per överföringsfil och 5 MB per bilaga. Ärenden har beständiga ID:n och kan inte revideras. Vidareexport av en skrivskyddad import bevarar originalkuvert och signatur. En lokal fortsättning exporterar signerade ursprungsuppgifter: basens slutvärde och sekvens, ursprungsnod, nyckelfingeravtryck och originalkuvertets hash. Originalkvittot bevaras lokalt.
