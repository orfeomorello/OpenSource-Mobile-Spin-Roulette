# BitCroupier — Checkpoint (unico ingresso)

**Product name:** **BitCroupier**  
**Tagline:** *Roulette from both sides of the table*  
**Codename / cartella repo:** `RouletteLife` (legacy path; brand = BitCroupier)  
**Ultimo aggiornamento:** 2026-08-06 (note distribuzione da approfondire)  
**Canone design:** `REQUISITI.md` v0.30  

---

## ISTRUZIONI OBBLIGATORIE PER LLM / AGENTE

Se l’utente ti dice solo di **leggere `checkpoint.md`** (o “leggi il checkpoint”), **non fermarti a questo file**.

Devi **autonomamente** caricare e assimilare il contesto necessario, nell’ordine sotto, **senza chiedere all’utente cosa leggere dopo** e senza fargli ripetere l’ordine.

### Protocollo di bootstrap (esegui tu)

1. Finisci di leggere **questo** `checkpoint.md`.  
2. Leggi **`REQUISITI.md`** — almeno **§0 (canone)** per intero; poi le sezioni che servono al task (se il task non è chiaro: leggi anche §5 PAY/energia/LEVEL, §6 Autoplay, **§6bis Player/wallet**, §11–§13 A1, §16).  
3. Leggi **`config/README.md`** per intero.  
4. Leggi **`UI_USE_CASES.md`** — almeno sezioni Game Table, fasi, Save/Exit, Autoplay (e use case correlati).  
5. Leggi **`devLaw.md`** (vincoli privacy: non negoziabili).  
6. Se il task tocca audio/FX: leggi **`sound.md`** e/o **`fx.md`**.  
7. Apri i **JSON** rilevanti sotto `config/` (non solo la README):  
   - bilanciamento → `game-balance.json`  
   - ruota/spin → `wheel-spin.json`  
   - NPC → `npc-ai.json`  
   - input/HUD → `controls.json`  
   - puntate → `bets-european.json` e/o `bets-american.json` (struttura + sample; non serve memorizzare ogni riga)  
8. Solo se serve background: `8bitFramework.md`, `croupier simulator.md`.

**Conflitti:** vince sempre **`REQUISITI.md` §0**. Testo più vecchio nel corpo dei doc può essere superato.

**Dopo il bootstrap:** rispondi già allineato al canone, oppure esegui il task dell’utente. Non chiedere “vuoi che legga anche X?” se X è nella lista sopra e serve al contesto.

**Aggiornamento:** se completi un pezzo grosso di progetto, aggiorna § Stato e § Prossimi passi di **questo** file.

---

## Cos’è BitCroupier

Web game **8-bit**, browser, **local-first** (no backend, no tracking).  
**Both sides of the table:** un turno da **croupier**, poi (col wallet) da **cliente**.

| Mode | MVP | Note |
|------|-----|------|
| **Dealer** | Giocabile — sei il croupier | Guadagni units verso **wallet** a fine run |
| **Autoplay** | Giocabile — demo automatica | **Non** farma wallet |
| **Player** | Locked — “Coming soon” | Design **§6bis**: roulette classica; fiches = wallet da Dealer (**v0.3**) |

- Economia: solo **units**. SCORE = house (sessione Dealer); **wallet meta** = progressione che finanzia Player. Mai simboli moneta.  
- **Loop autoalimentato:** lavora Dealer → wallet → gioca Player → se broke, di nuovo Dealer.  
- Skill Dealer: **PAY** a fiches = solo **vincita** (`stake × M`); overpay o timeout → **−1 ENERGY**; 0 → Game Over (solo Dealer).  
- **LEVEL** numerico arcade (sale in run). Preset difficoltà = curva.  
- Spin: simulazione condizioni iniziali (`wheel-spin.json`).  
- Tutte le puntate standard EU/US (`bets-*.json`).  
- Dealer HUD: **Save + Exit** sempre. Autoplay: **solo Exit**.  

Dettaglio: `REQUISITI.md` §0 · Player: **§6bis**.

---

## Stato progetto

| Area | Stato |
|------|--------|
| Design / requisiti / UI use case | **Completi per partire** |
| Config JSON + `config/README.md` | **Presenti** |
| `sound.md` / `fx.md` | **Specifiche sì, asset no** |
| Codice app (Vite/TS/engine) | **v0.2.1 giocabile** - payout scelto dal dealer, NPC 8-bit profilati, ruota Canvas fisica, build verificata |
| Grafica / audio reali | **FX CSS e SFX 8-bit sintetizzati presenti; asset audio finali non prodotti** |

**Fase:** vertical slice giocabile → **prossimo lavoro = playtest e taratura**.

**Bloccanti design B1–B7:** tutti **chiusi** (vedi canone e config).  
**Architettura A1:** **chiusa** — dominio TS puro; presenter/framework 8-bit intercambiabile (`REQUISITI.md` §0, §13.1).  
**Player P1 (design):** **chiuso** — classico EU/US + wallet da Dealer; implementazione **v0.3**, non day-one (`REQUISITI.md` §6bis).  
**Brand:** **BitCroupier** + tagline *Roulette from both sides of the table* (ex RouletteLife). Dominio: verificare e registrare al più presto se libero.

---

## Mappa file (riferimento rapido)

| File | Perché leggerlo |
|------|-----------------|
| `checkpoint.md` | Ingresso + protocollo + stato + next + **note distribuzione** |
| `REQUISITI.md` | Canone e requisiti (autorità) |
| `UI_USE_CASES.md` | Flusso e UI |
| `devLaw.md` | Privacy |
| `config/README.md` | Come usare i JSON |
| `config/*.json` | Valori e cataloghi |
| `sound.md` / `fx.md` | Audio e VFX |
| `8bitFramework.md` | Opzioni engine (background) |
| `croupier simulator.md` | Ricerca (background) |

---

## Prossimi passi (implementazione)

1. Scaffold TypeScript + Vite, core + spin puri, config JSON - **completato v0.1**  
2. Vertical slice Dealer: fasi, NPC bets, spin, resolve, PAY, energy, LEVEL, bonus - **completato v0.1**  
3. Game Table responsive + wheel presenter CSS + Save/Exit + Autoplay - **completato v0.1**  
4. **Playtest Training/Rush** e taratura di PAY timer, frequenza win e carico NPC - smoke test Dealer completato, taratura estesa ancora aperta
5. Felt reale, chip per cliente, ruota EU/US animata e feedback PAY - **completato v0.2**  
5bis. Selezione manuale vincitore, personaggi NPC profilati e traiettoria Canvas con caduta/rimbalzo - **completato v0.2.1**
6. Aggiungere import/continue sessione e schermata Game Over completa  
7. Completare PWA installabile con icone e QA offline multi-browser  
8. Stub audio/FX con ID da sound.md / fx.md, poi asset P0  

Poi: roster dealer, Gym, i18n, asset P0.  
**Più tardi (v0.3):** Player giocabile + earn wallet da fine run Dealer + buy-in/cash-out (§6bis). In MVP-late si può già persistere il campo `wallet` a 0.

---

## Consigli operativi (design freezato → build)

Il design è **abbastanza chiuso** per smettere di documentare e **iniziare a costruire**. Non serve un altro giro di vision doc prima dello scaffold.

### Cosa fare

1. **Vertical slice prima di tutto** — non “tutto il menu completo”.  
   Un tavolo Dealer giocabile: bet NPC → close → spin → PAY → energy.  
   Poi Autoplay, hub, polish.

2. **Asset dopo il loop** — placeholder + ID di `sound.md` / `fx.md` bastano all’inizio.  
   Juice e chiptune veri quando il gameplay regge.

3. **Bilanciamento solo via JSON** — ritocchi a `config/*.json`, non hardcode sparso.  
   Se cambia una regola di prodotto: aggiorna `REQUISITI.md` §0 e una riga di **stato/next** in questo checkpoint.

4. **A1 — core senza framework** — regole, SpinEngine, PAY, NPC, session in TS puro; UI/wheel solo presenter.  
   `ui`/`wheel` possono importare `core`; **mai** il contrario. Dettaglio: `REQUISITI.md` §13.1.

5. **Git** — se non c’è ancora, un commit tipo “design freeze B1–B7 + config + checkpoint” come punto zero chiaro.

6. **Playtest presto** — Training vs Rush dopo il primo slice; i numeri in `game-balance.json` sono ipotesi da tarare in 20+ minuti di gioco reale.

### Cosa non fare ora

- Altri documenti di vision / rifare i requisiti da capo  
- **Implementare** Player mode ora (design già in §6bis; codice = **v0.3**)  
- Call bets francesi / varianti esotiche  
- Audio e sprite “finali” prima del loop giocabile  
- Over-engineering multiplayer/account (vietati dal canone)  
- Logica di gioco dentro il framework 8-bit (Scene/tween/update) o “god engine” astratto inutile — viola **A1**

### Messaggio all’agente

Se l’utente non chiede altro design: **proponi o esegui implementazione** dai prossimi passi, non inventare nuovi pilastri di prodotto.

---

## Distribuzione (appunti — da approfondire post-demo)

**Non** aprire un doc di strategia marketing a parte. Queste note bastano fino alla prima build giocabile; si approfondiscono al deploy.

### Principi

- Stack = **web statico + PWA** → hosting statico, non backend.  
- Rispettare **`devLaw.md`**: no analytics/tracking iniettati dal canale se evitabili.  
- Copy release: **Entertainment only · No real money · Data stays on your device**.  
- Brand: **BitCroupier** — *Roulette from both sides of the table*.  
- Dominio: registrare se libero (es. `bitcroupier.*`); non contare su `roulettelife.com`.

### Canali gratis allineati al prodotto (priorità)

| Priorità | Canale | Uso |
|----------|--------|-----|
| **P0 host** | Cloudflare Pages **o** GitHub Pages (Netlify/Vercel ok) | URL stabile, CI da Git, PWA |
| **P0 vetrina** | **[itch.io](https://itch.io/docs/creators/html5)** HTML5 | ZIP + `index.html`; gratis / PWYW; tag pixel/sim/browser |
| **P1 promo** | Reddit (es. r/WebGames), X/Bluesky, devlog itch, jam 8-bit/sim | Traffico organico; no spam |
| **P2** | Newgrounds (valutare tono) | Opzionale |

### Rimandare (non day-one)

- Steam (fee, store page, fit debole per PWA locale)  
- Google Play / App Store (policy “roulette”, packaging)  
- Portali ad-heavy (Poki, CrazyGames, ecc.) se confliggono con no-tracking  

### Fasi (bozza)

```text
Ora          → zero marketing; vertical slice
Prima demo   → Pages + pagina itch “BitCroupier (demo)”
MVP          → stesso canale; GIF loop PAY; disclaimer
v0.3         → trailer “both sides” (Player)
Opz.         → dominio custom → Pages
```

### Checklist quando si pubblica (da fare allora)

- [ ] Build `dist/` con config JSON inclusi  
- [ ] itch: screenshot, GIF, tag, “no real money”  
- [ ] Host: HTTPS, offline/PWA se pronta  
- [ ] Nessun SDK analytics di terze parti  
- [ ] Export/import dati ancora locali  

### Cosa non fare

- Documento “go-to-market” lungo prima del loop giocabile  
- Farm wallet / Autoplay come “demo store” confusa col prodotto Dealer  

---

## Prompt utente sufficienti

L’utente può dire solo:

```text
Leggi checkpoint.md
```

oppure:

```text
Leggi checkpoint.md e continua dai prossimi passi
```

oppure:

```text
Leggi checkpoint.md e implementa lo scaffold
```

Tu esegui il **protocollo di bootstrap**, poi agisci. Non richiedere un elenco di file da leggere.

---

*Fine checkpoint.*
