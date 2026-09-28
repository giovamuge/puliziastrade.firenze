# Strade Pulite · Firenze

Web app per sapere **con un tocco** se oggi, stanotte o nei prossimi giorni passa la pulizia strade (spazzamento) nella via in cui ti trovi a Firenze. Include mappa, ricerca full-text con autocompletamento, calendari iCal con promemoria e verifiche dei cittadini.

> Progetto indipendente e non ufficiale. Dati: [Comune di Firenze – Pulizia Strade](https://opendata.comune.fi.it/page_dataset_show?id=pulizia-strade) (Alia S.p.A.), licenza **CC BY-NC-SA 4.0** (uso non commerciale).
>
> Logo: il giglio è la sagoma, ridotta a un solo colore, di [Firenze giglio gotico antico](https://commons.wikimedia.org/wiki/File:Firenze_giglio_gotico_antico.svg) di Horemhat, licenza [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). Il logo (`static/favicon.svg`, le icone in `static/` e `BrandMark.svelte`) è quindi distribuito con licenza CC BY-SA 4.0; il resto del codice resta MIT.

## Stack

| Livello | Scelta | Licenza | Perché |
| --- | --- | --- | --- |
| Framework | SvelteKit 2 + Svelte 5 (runes) | MIT | Bundle minimo (~50 KB gzip iniziali), SSR/prerender, adapter Vercel ufficiale |
| Linguaggio | TypeScript strict (`noUncheckedIndexedAccess`) | Apache-2.0 (dev) | Contratti API tipizzati condivisi client/server |
| Validazione | Valibot | MIT | Validazione runtime tipizzata di upstream e input utente, ~1 KB per schema |
| Stile | Tailwind CSS 4 con token CSS | MIT | Nessun runtime CSS, tema chiaro/scuro con token |
| Mappa | MapLibre GL JS + tile vettoriali OpenFreeMap (OSM) | **BSD-3-Clause** | WebGL fluido con 5.500 tratti, nessuna chiave API, caricata in lazy |
| Ricerca | MiniSearch (lato server) | MIT | Prefisso + fuzzy, abbreviazioni italiane (`v.`, `p.za`, `vle`, `b.go`…) |
| Storage | Upstash Redis (Vercel Marketplace, piano free) | MIT (client) | Snapshot dei dati e verifiche |
| Bottom sheet | pure-web-bottom-sheet | MIT | Web component su CSS scroll-snap + `<dialog>` nativo: swipe per chiudere, tocco fuori/Esc, ~14 KB |

MapLibre è l'unica dipendenza di runtime non MIT: BSD-3 è una licenza permissiva compatibile con MIT. Le alternative MIT (es. deck.gl) richiederebbero comunque una basemap e sono più pesanti. Non ho usato shadcn: è pensato per React; qui i componenti sono scritti a mano seguendo i pattern WAI-ARIA, con lo stesso approccio a token.

## Architettura

```
src/lib/domain/     logica pura e isomorfa (nessuna I/O)
  civil-date.ts       aritmetica di calendario su interi (zero allocazioni)
  schedule.ts         regole di ricorrenza (Strategy per tipo di settimana)
  city-dataset.ts     indice in memoria su typed array (CSR)
  spatial-index.ts    griglia spaziale per "strade vicino a me" (zero allocazioni per query)
  urgency.ts          colori della mappa ricalcolati senza allocare
src/lib/server/     solo server
  opendata/           client CKAN + GeoJSON (Adapter) con schemi Valibot
  dataset/            DatasetService: cache memoria → Redis → open data
  search/             indice full-text
  reviews/            ReviewService + ReviewStore (porta/adapter: Redis o memoria)
  ics.ts, calendar.ts generatore iCalendar RFC 5545 (Builder)
  presenters.ts       mapping dominio → DTO
src/lib/api/contracts.ts  tipi condivisi client/server
src/lib/client/     facade API tipizzata, stato applicativo (runes), formattazione
src/lib/components/ componenti UI
```

### Dati lato server e aggiornamento giornaliero

I dati grezzi (2,5 MB) non arrivano mai al browser. Il server:

1. alla **prima richiesta del giorno** (fuso Europe/Rome) risponde subito con i dati in cache e avvia in background un controllo upstream con **GET condizionale** (`If-None-Match`/`If-Modified-Since`): se il file non è cambiato riceve un 304 e non riscarica nulla;
2. se è cambiato lo valida, lo normalizza in uno snapshot compatto e lo salva su Redis (condiviso tra istanze, con lock per evitare download concorrenti);
3. un **Vercel Cron** giornaliero (`/api/cron/refresh`, 03:30 UTC, consentito sul piano Hobby) fa da rete di sicurezza;
4. le risposte API sono in cache sulla CDN Vercel (`CDN-Cache-Control` + `stale-while-revalidate`).

Senza Redis tutto funziona comunque, con la sola cache in memoria per istanza.

Il client riceve solo: risultati di ricerca, strade vicine, dettaglio della via e un layer mappa compatto (coordinate intere delta-encoded, ~150 KB gzip, con ETag).

### Vie con più tratti e omonimie

Il nome della via non basta: nei dati attuali **172 vie** hanno orari diversi a seconda del tratto (es. Via del Saletto: due archi il 4° giovedì 07–12, uno il 4° mercoledì 13–18) e **86 nomi** compaiono in pezzi di strada non collegati (fino a 2 km di distanza). `src/lib/domain/street-topology.ts` scompone ogni via in:

- **parti**: componenti connesse degli archi (estremi entro 15 m);
- **gruppi di orario**: tratti contigui con regole identiche.

Ogni parte/gruppo è descritto dalle vie che incrociano i suoi due estremi più lontani ("tra Via Luca Signorelli e Via di Santa Maria a Cintoia"), trovate con l'indice spaziale. La UI mostra lo stato del *tuo* tratto (da GPS o tocco sulla mappa), l'elenco dei gruppi con i loro orari, i passaggi già avvenuti oggi/ieri e il calendario può essere limitato al solo gruppo (`?tratto=<cod_arco>`).

### Interfaccia

- Mappa a tutto schermo; in basso al centro la ricerca indirizzo e il pulsante posizione (solo icona), in alto filtri, legenda e impostazioni.
- Il dettaglio della via usa `Sheet.svelte`, che si adatta allo schermo (breakpoint 768 px, `src/lib/client/media.ts`):
  - **telefono**: bottom sheet modale, che si chiude con swipe verso il basso, tocco fuori, Esc o il pulsante ×;
  - **tablet/desktop**: sidebar a sinistra non modale (la mappa resta cliccabile). Promemoria e Segnala scorrono sopra la sidebar come pannelli in primo piano; Esc chiude quello attivo e riporta il focus dove era.
  Il cambio avviene anche ridimensionando la finestra con il pannello aperto, e la mappa si ricentra. Nell'intestazione restano sempre il nome della via e le due azioni **Promemoria** e **Segnala**, che aprono fogli separati sovrapposti.
- Il corpo mostra una panoramica (verifica del passaggio di oggi/ieri in evidenza, foglietto di calendario con la prossima pulizia e avanzamento se in corso, striscia dei prossimi 14 giorni) e voci di navigazione verso le viste di dettaglio (orari e tratti, prossimi passaggi, strade vicine, dati tecnici).
- Scroll fade sui contenuti scorrevoli (`scroll-fade.ts`): sfumatura solo sul lato dove c'è altro contenuto.

### Mappa: tratti e orari distinti

- Stato **«Già pulita oggi»**: un passaggio concluso oggi prevale su «domani»/«più avanti», così nel pomeriggio si vede ancora che la via è stata pulita al mattino.
- La via selezionata è disegnata **per gruppo di orario**, con colori distinti (gli stessi dei pallini nel pannello) ed etichette lungo la strada (es. «4° gio 7–12», «4° mer 13–18»). Il tooltip mostra giorno e orario del tratto sotto il puntatore.

### Strade senza dati

Il dataset non copre tutte le strade. Un confronto con OpenStreetMap nel centro storico (riquadro 43.764–43.780 N, 11.244–11.266 E, 24/09/2026) ha dato: 440 vie con nome, 217 coperte e 223 senza dati. Di queste, 166 sono pedonali o vicoli; 56 sono carrabili (es. Via Porta Rossa, Via del Proconsolo, Via dei Cerretani). Toccando sulla mappa una strada senza tratti:
- se nei dati esiste una via con lo stesso nome entro 600 m, se ne apre la scheda con una nota («il punto toccato non è tra i tratti mappati»);
- se esiste ma lontano (omonimia), un messaggio indica la distanza e permette di aprirla;
- altrimenti un messaggio dice che il tratto non è presente nei dati del Comune.

### Segnalazioni, avvertenze, privacy

- Le segnalazioni restano **nell'app** (Upstash Redis): anonime, pubbliche, aggregate sulla mappa. Non vengono inoltrate al Comune o ad Alia; il foglio «Segnala» indica i canali ufficiali (`src/lib/site.ts`, verificati il 24/09/2026). Chi segnala può indicare l'orario letto sul cartello se diverso dai dati: il conteggio viene mostrato nella scheda della via.
- Avviso alla prima visita, riga «Fonte» nella scheda della via e sezione «Avvertenze» in `/info`.
- `/privacy`: informativa privacy e cookie. Solo memorie tecniche (tema, lingua, avviso chiuso, cache offline) e un cookie tecnico `locale`: nessun banner di consenso necessario. Il titolare si configura con `PUBLIC_OWNER_NAME` e `PUBLIC_OWNER_EMAIL`.
- La ricerca per posizione usa `POST`, così le coordinate non compaiono negli URL né nei log.

### Lingue e tema

- Italiano, inglese, spagnolo, francese e tedesco (`src/lib/i18n`). L'italiano è la fonte; le altre lingue sono tipizzate con `satisfies Messages`, quindi una chiave mancante è un errore di compilazione. Lingua di default: quella del sistema (`navigator.languages`), sovrascrivibile dalle impostazioni. Date, giorni e liste usano `Intl`. Anche calendari ICS (`?lang=`) ed errori API (codici tradotti dal client) sono localizzati.
- Tema sistema/chiaro/scuro. Uno script inline in `app.html` applica la scelta prima del primo paint; il suo hash SHA-256 viene calcolato in `svelte.config.js` e aggiunto alla CSP.

### Interpretazione delle regole

- **prima…quinta settimana**: n-esimo giorno indicato del mese (1–7, 8–14, …, 29–31).
- **settimane dispari/pari**: il giorno indicato quando cade in una data dispari/pari del mese (come da cartelli Alia).
- Tutti i campi del GeoJSON sono conservati: id delle feature, `cod_arco`, nome, giorno, settimana, orari, geometria, oltre ai metadati del dataset (licenza, temi, tag, date di modifica, CRS).

## API

| Endpoint | Cache | Descrizione |
| --- | --- | --- |
| `GET /api/search?q=` | CDN 5 min | Autocompletamento vie |
| `POST /api/nearby` `{lat, lon}` | mai | Strade entro 150 m (POST: coordinate fuori da URL e log, mai salvate) |
| `GET /api/streets/:slug` | CDN 10 min | Regole, prossimi passaggi, tratti |
| `GET /api/map` | CDN 1 h + ETag | Layer mappa compatto |
| `GET /api/meta` | CDN 1 h | Metadati e statistiche |
| `GET /api/calendar/:slug.ics[?tratto=&avviso=&lang=]` | CDN 6 h | Calendario iCal; `avviso` = `auto` (sera prima per le notturne, altrimenti 2 h), `evening`, `120`, `60`, `none` |
| `GET/POST /api/reviews` | — | Verifiche dei cittadini |
| `GET /api/reviews/summary` | CDN 5 min | Aggregati per la vista "Verifiche" |

## Sviluppo

```sh
npm install
npm run dev          # http://localhost:5173
npm run check        # svelte-check (TypeScript)
npm test             # unit test
DATA_FILE=alia_spazzamenti.json npx vitest run pipeline   # test d'integrazione su un export reale
```

In sviluppo le verifiche usano uno store in memoria.

## Deploy su Vercel (piano free)

1. Importa il repository su Vercel (preset SvelteKit rilevato automaticamente).
2. *Storage → Marketplace → Upstash for Redis* (piano free) e collegalo al progetto: le variabili `KV_REST_API_URL` e `KV_REST_API_TOKEN` vengono aggiunte da sole.
3. Aggiungi le variabili `PUBLIC_SITE_URL` (se usi un dominio personalizzato), `RATE_LIMIT_SALT` (stringa casuale lunga), `CRON_SECRET`, `PUBLIC_OWNER_NAME` e `PUBLIC_OWNER_EMAIL` (titolare del trattamento per l'informativa privacy). Crea il database Upstash nella regione UE (Francoforte).
4. Deploy. Il cron in `vercel.json` viene registrato automaticamente.

Senza Redis l'app funziona lo stesso, ma le verifiche restano disattivate.

## SEO

- **Una pagina indicizzabile per via**: `/strade/:slug` (≈1.500 pagine), renderizzata sul server in italiano e in cache sulla CDN fino a mezzanotte. Contiene orari per tratto, i prossimi 12 passaggi con date assolute, le strade vicine (link interni), link alla mappa e al calendario. Il client cambia lingua dopo l'idratazione, come nel resto dell'app.
- **Elenco A–Z** `/strade`, ordinato ignorando tipo e articoli («Via dei Servi» sotto S), linkato dal menu impostazioni.
- `/sitemap.xml` e `/robots.txt` dinamici con URL assoluti; i deploy di anteprima Vercel rispondono `Disallow: /` e `X-Robots-Tag: noindex`.
- Ogni pagina usa `Seo.svelte`: title, description (≤160 caratteri), canonical, Open Graph/Twitter con `static/og-image.png` (1200×630), JSON-LD (`WebSite`, `WebApplication`, `BreadcrumbList`, `WebPage`+`Place`, `Dataset`). Con una via aperta sulla mappa (`/?strada=`) il canonical punta alla sua pagina.
- `<html lang>` corretto anche per `/info` e `/privacy` renderizzate in altre lingue (`hooks.server.ts`); icone PNG 192/512, maskable e apple-touch-icon.
- Dominio: `PUBLIC_SITE_URL`, altrimenti il dominio di produzione Vercel (`VERCEL_PROJECT_PRODUCTION_URL`).

## Accessibilità

WCAG 2.2 AA: skip link, landmark, combobox APG, focus visibile, contrasti verificati nei due temi, annunci `aria-live`, legenda che usa colore **e** spessore, `prefers-reduced-motion`, ogni informazione della mappa disponibile anche come testo.

## Prossimi passi proposti

- ~~Multilingua, tema manuale, gestione dei tratti~~ ✔
- **Notifiche push (PWA)**: Web Push con VAPID implementato in proprio con Web Crypto (la libreria `web-push` è MPL-2.0), iscrizioni salvate su Redis, invio dal cron serale. Sul piano Hobby il cron gira una volta al giorno: basta per un avviso "domani/stanotte" alle 18:00.
- **Canale Telegram/bot** per via: zero app da installare, API gratuita.
- **Foto nelle verifiche** con Vercel Blob e moderazione.
- **Report pubblico** sulla qualità del servizio per quartiere, basato sulle verifiche.
