# CivOS: installationsguide från påstående till uppföljning

**Kris Ledel · September 2026**

CivOS ska göra det möjligt att följa ett beslut hela vägen: från påståendet det bygger på, via underlag och bedömningar, till ansvarig person och dokumenterat utfall. Första steget går att köra lokalt. Du behöver Python, en kopia av repot och ett avgränsat exempel.

Det som installeras är en prototyp för en beslutslogg. Den använder SQLite och Pythons standardbibliotek. Den kopplar ihop poster, kontrollerar deras struktur och skapar en läsbar rapport. Människor granskar underlagen, fattar besluten och genomför eventuella åtgärder. Inget i programmet ger någon mandat att agera.

Den större forskningsfrågan är om bättre spårbarhet kan göra institutioner bättre på att upptäcka och rätta sina misstag. Den frågan avgörs genom jämförelser i praktiken. En lyckad installation besvarar den inte.

## 1. Börja med rätt förväntningar

Prototypen har fem typer av poster: `claim`, `evidence`, `assessment`, `decision` och `outcome`. De motsvarar påstående, underlag, bedömning, beslut och utfall. Varje typ har en bestämd roll. Ett underlag beskriver en källa och dess begränsningar. En bedömning förklarar hur underlaget påverkar ett påstående. Ett beslut anger vad någon valt att göra och varför.

Programmet erbjuder ingen inloggning, behörighetsmodell, distribuerad drift eller automatisk faktakontroll. Det har ingen funktion för att radera en enskild känslig uppgift ur hela historiken. Börja därför med det syntetiska exemplet. Använd inte identifierande vittnesmål, privata handlingar eller material som deltagarna inte har rätt att dela.

Namnen och datumen i en post är registrerade uppgifter. Programmet kan inte bevisa vem som skrev dem eller när en verklig händelse inträffade. Att en post accepteras betyder att den klarar programmets kontroller, inte att innehållet är sant.

## 2. Hämta och kontrollera miljön

Du behöver Python 3.10 eller senare med stöd för SQLite. Om Git finns installerat kan du hämta källkoden så här:

```sh
git clone https://github.com/krisledel/civos.git
cd civos
python --version
```

Det går också att ladda ned repot som ZIP från [GitHub](https://github.com/krisledel/civos), packa upp det och öppna en terminal i den uppackade katalogen. Kör resten av kommandona därifrån.

På vissa system heter kommandot `python3`. På Windows kan `py -3` fungera om Python-startaren är installerad. Kontrollera versionen och använd samma kommando genom hela guiden. Någon installation med `pip` behövs inte; prototypen har inga externa Python-beroenden.

Kör testerna innan du börjar:

```sh
python -m unittest discover -s tests -v
```

Om ett test misslyckas, spara felmeddelandet tillsammans med Python-version och operativsystem. Gå tillbaka till grundfelet innan du tolkar programmets rapport som tillförlitlig. Testerna kontrollerar programbeteende. De visar inte att metoden förbättrar beslut i en organisation.

## 3. Kör det fiktiva fallet

Skapa demodatabasen och kontrollera dess historik. Demot kräver en tom databas; välj en ny sökväg efter `--db` om du redan har kört det:

```sh
python -m civos --db work/demo.sqlite3 demo
python -m civos --db work/demo.sqlite3 verify
```

Demot bygger på filen `examples/water-review.json`. Alla aktörer, observationer och resultat är påhittade. Fallet gäller en planerad inspektion av en vägtrumma och en tillfällig passage för närboende. Det är varken en verklig översvämningsprognos eller ett besked om någon anläggnings säkerhet.

Ett ritningsunderlag stöder påståendet att trumman har tillräcklig kapacitet under givna antaganden. Ett boendeunderlag beskriver vatten som dämts upp och skräp vid inloppet. Bedömningarna skiljer sig åt. Inspektionsbeslutet behåller invändningen om att ritningen inte visar det aktuella tillståndet.

Ett separat påstående gäller möjligheten att hålla en passage öppen. En genomgång av sträckan är inte tillräcklig för att fastställa att lösningen fungerar för alla berörda. Beslutet kräver därför återkoppling från de boende före tidsbokningen.

Det dokumenterade inspektionsutfallet är ofullständigt: inloppet var delvis blockerat, men kapaciteten kunde inte fastställas. Återkopplingen om passagen saknar utfall trots passerat granskningsdatum. Dessa luckor är avsiktliga. Prototypen ska kunna visa att något återstår.

## 4. Läs rapporten som en granskare

Skapa rapporten med en bestämd tidpunkt för bedömning av granskningsdatumen:

```sh
python -m civos --db work/demo.sqlite3 report --as-of 2026-09-08T12:00:00Z --output work/report.html
```

Öppna `work/report.html` i en webbläsare. Rapport- och exportkommandona skriver inte över befintliga filer; välj ett nytt utfilnamn när du kör dem igen. Rapporten är en lokal fil; kommandot publicerar ingen webbplats. Den angivna tidpunkten gör datumkontrollen reproducerbar. Den är inte ett bevis på när en observation gjordes och innebär inte att du har återskapat hela databasens historiska tillstånd vid den tidpunkten.

Försök besvara följande utan att läsa programkoden:

- Vilket påstående bygger inspektionsbeslutet på?
- Vilket underlag talar emot det, och vilken begränsning gäller ritningen?
- Vem ansvarar för nästa steg?
- Vad visade inspektionen, och vad kunde den inte avgöra?
- Vilken återkoppling saknas trots att granskningsdatumet passerat?

Om rapporten gör någon av dessa frågor onödigt svår har du hittat ett konkret förbättringsbehov. Ett snyggt dokument är inte tillräckligt. En granskare måste kunna hitta den invändning som faktiskt påverkar beslutet.

Läs också skillnaden mellan ett registrerat utfall och ett uppnått mål. Att det finns en uppföljningspost betyder att någon har återkommit med information. Informationen kan fortfarande vara osäker, negativ eller otillräcklig. Att inget utfall finns ska inte tolkas som att allt gick enligt plan.

## 5. Exportera och kontrollera en kopia

Exporten gör historiken möjlig att flytta och granska utanför den ursprungliga databasen:

```sh
python -m civos --db work/demo.sqlite3 export --output work/ledger.json
python -m civos --db work/copy.sqlite3 restore work/ledger.json
python -m civos --db work/copy.sqlite3 verify
```

Använd en ny databas för återställningen. Behåll originalet medan du kontrollerar kopian. En export innehåller loggens uppgifter; att dela den kan därför avslöja allt du tidigare har matat in. Det finns ingen automatisk bedömning av vad en mottagare bör få se.

Varje lagrad post ingår i en kedja av SHA-256-hashar. En ändring som gör kedjan inkonsekvent kan upptäckas av verifieringen. För att kontrollera att kopian motsvarar en tidigare känd historik behöver du dessutom spara kedjans slutvärde, dess `head`, på en oberoende plats. Vid verifiering kan du ange `--expected-head` följt av det sparade värdet.

Den jämförelsen gäller det förväntade slutvärdet för samma historik. Nya, legitima poster ger ett nytt slutvärde. En avvikelse är därför något att undersöka, inte automatiskt bevis på manipulation.

Den som kontrollerar databasen kan skriva om hela historiken och räkna om hashkedjan. Utan en oberoende kontrollpunkt kan en sådan omskrivning klara den interna verifieringen. En kontrollpunkt på samma dator har dessutom flera av databasens sårbarheter. Hashkedjan bevisar varken sanningshalt, identitet eller legitim beslutsrätt.

## 6. Skapa ett eget avgränsat exempel

Utgå från demofilens struktur och den [tekniska beskrivningen i repot](https://github.com/krisledel/civos/blob/main/technical-overview.md). Kopiera exemplet till en egen JSON-fil i `work/` och byt till ett annat fiktivt fall. Behåll sambanden mellan posternas identifierare. Håll isär observation, tolkning och beslut även om samma person skriver alla tre.

För att lägga in repots oförändrade exempelfil direkt i en ny databas kan du använda:

```sh
python -m civos --db work/manual.sqlite3 append examples/water-review.json
```

Byt sökvägen till din egen fil när den är klar. Använd en ny databas när du vill pröva ett separat exempel. För att rätta en redan accepterad post lägger du till en ny post med `supersedes`, enligt dokumentationen. Den gamla posten finns kvar. Historiska hänvisningar ska fortfarande visa vilket underlag ett tidigare beslut faktiskt använde.

Formulera ett beslut som går att följa upp. Ange ansvarig person, alternativ, kvarstående invändning, granskningsdatum, framgångskriterium och stoppvillkor. Beskriv också det faktiska mandatet i beslutsmotiveringen. Den uppgiften måste kontrolleras utanför programmet.

## 7. Pröva nyttan mot det ni redan använder

En pilot behöver en jämförelse. Välj ett frivilligt, reversibelt ärende med små konsekvenser. Börja med konstruerade fall och jämför CivOS med era nuvarande anteckningar eller kalkylblad. Låt deltagarna använda båda metoderna på jämförbara fall och variera ordningen så att övningseffekten blir synlig.

Bestäm i förväg vilken förbättring som skulle motivera extra arbete och vad som ska avbryta försöket. Mät hur lång tid en utomstående granskare behöver för att återfinna beslutsunderlaget, hur många svar som blir rätt och om invändningen och den senaste rättelsen upptäcks. Räkna också tiden för registrering, kontroll och korrigering. Redovisa saknade utfall och fel med tydliga nämnare.

Be deltagarna bedöma om deras bidrag återges rätt och om de faktiskt kan invända. Dokumentera vilka som inte deltog och varför, när den uppgiften kan samlas in utan att utsätta någon. En välfylld logg säger inget i sig om vem som fick inflytande.

Om vanliga anteckningar fungerar lika bra till lägre kostnad har CivOS inte visat nytta i den miljön. Om formatet döljer väsentliga invändningar eller försvårar rättelser måste arbetsformen ändras eller försöket avslutas. Det finns ännu inga uppmätta pilotvinster att hänvisa till.

Nästa bidrag bör därför vara ett reproducerbart fel, en bättre granskningsfråga eller ett redovisat jämförelseresultat. [Källkoden och bidragsguiden finns på GitHub](https://github.com/krisledel/civos). Börja där beslutets skäl går förlorade, och kontrollera om de faktiskt blir lättare att återfinna.
