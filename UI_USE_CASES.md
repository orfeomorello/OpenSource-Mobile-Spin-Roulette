# BitCroupier — Flusso di gioco, UI e use case

**Product:** **BitCroupier** — *Roulette from both sides of the table*  
**Versione:** 0.17 (bozza allineata)  
**Data:** 2026-08-06  
**Stato:** allineata al canone `REQUISITI.md` v0.30  
**Riferimenti:** `REQUISITI.md` v0.30 §0 · §6bis (Player/wallet) · `config/README.md` · `config/*.json` · `devLaw.md`  

**In caso di conflitto con testo più vecchio in questo file, vince il canone §0 di REQUISITI.**  
**Felt:** tutte le zone di puntata standard della variant (non un sottoinsieme).

Questo documento descrive **come si gioca dal punto di vista dell’utente**: schermate, layout, stati dell’interfaccia e use case.  
Non sostituisce i requisiti di prodotto: li traduce in **esperienza concreta**.

**Lingua UI di default:** English (stringhe sotto in EN; i18n prevista).  
**Moneta di gioco:** units (mai simboli moneta reali).

---

## 1. Principi di interfaccia

| Principio | Applicazione |
|-----------|----------------|
| **Pixel art 8-bit leggibile** | Palette limitata, testi crisp, chip e ruota chiari anche a risoluzione media |
| **Sempre sapere in che fase sei** | Banner fase + colore/stato coerente (`BETTING`, `NO MORE BETS`, `SPINNING`, …) |
| **Pressione leggibile, non confusa** | Timer grande; n° players e level sempre visibili |
| **Units ovunque** | `120 units`, mai `$` / `€` |
| **Un’azione primaria per schermata** | Un CTA principale evidente (Play, Spin, Confirm, …) |
| **Desktop first** | Mouse/tastiera MVP; touch best-effort |
| **Privacy visibile** | Copy tipo “Data stays on your device” in settings/export |
| **Dealer al centro** | Nome + mini portrait/stats del dealer attivo in HUD |

---

## 2. Mappa schermate (screen map)

```
┌─────────────┐
│  Boot/Splash│ (logo breve, opzionale)
└──────┬──────┘
       ▼
┌─────────────┐
│  Language   │
└──────┬──────┘
       ▼
┌─────────────┐
│ Main Menu   │◄────────────────────────────────────────┐
└──────┬──────┘                                         │
       │                                                │
       ├─► Mode Select ─► Dealer Hub ─► Table Setup ─► Session ─► GAME TABLE
       │         │              │                              │
       │         │              ├─ Customize Dealer             │
       │         │              ├─ Random Dealer                │
       │         │              └─ Dealer Gym                   │
       │         │                                              │
       ├─► Continue (se last session) ─────────────────────────┘
       ├─► Load Session File
       ├─► Settings
       └─► Credits / About
```

### Elenco schermate MVP

| ID | Schermata | Obbligatoria MVP |
|----|-----------|------------------|
| S00 | Splash | Opzionale |
| S01 | Language | Sì |
| S02 | Main Menu | Sì |
| S03 | Mode Select | Sì |
| S04 | Dealer Hub | Sì |
| S05 | Dealer Customize | Sì |
| S06 | Dealer Random result | Sì |
| S07 | Dealer Gym | Sì (o P1 se slittata; slot menu sì) |
| S08 | Table Setup (level + params) | Sì |
| S09 | Session Select | Sì |
| S10 | **Game Table** (in-play) | Sì |
| S11 | Pause Overlay | Sì |
| S12 | Round Result Overlay | Sì |
| S13 | Settings | Sì |
| S14 | Export / Import | Sì |
| S15 | Help / How to play | P1 |

---

## 3. Flusso di avvio (pre-game)

### 3.1 Sequence overview

```
S01 Language
  → S02 Main Menu
  → S03 Mode (Dealer | Player🔒 | Autoplay)
  → S04 Dealer Hub (skip parziale se Continue)
  → S08 Table Setup
  → S09 Session (New / Continue / Load)   [ordine alternativo: Session prima di Setup se Continue]
  → S10 Game Table
```

**Varianti:**

| Percorso | Flusso |
|----------|--------|
| **New Dealer run** | Mode → Dealer → Setup → New game → Table |
| **Continue** | Main Menu → Continue → Table (riprende dealer+params+stato) |
| **Load file** | Main Menu o Session → file picker → validate → Table o Hub se incompleto |
| **Autoplay learn** | Mode Autoplay → Dealer (default o scelta) → Setup → Table in auto |
| **Quick Random** | Dealer Hub → Random → Confirm → Setup → Play |

### 3.2 Schermate pre-game — wireframe testuali

#### S01 — Language

```
+------------------------------------------+
|              ROULETTE LIFE               |
|                                          |
|         Select language                  |
|                                          |
|         [ English ]  (default)           |
|         [ Italiano ]                     |
|         [ ... ]                          |
|                                          |
|              [ Continue ]                |
|                                          |
|   Data stays on your device              |
+------------------------------------------+
```

**Azioni:** select language → Continue → salva in settings → S02.

---

#### S02 — Main Menu

```
+------------------------------------------+
|              ROULETTE LIFE               |
|            8-bit table sim               |
|                                          |
|           [  New Game   ]                |
|           [  Continue   ]  (disabled se no save)
|           [ Load Session ]               |
|           [  Settings   ]                |
|           [   About     ]                |
|                                          |
|     units · offline · no real money      |
+------------------------------------------+
```

| Controllo | Comportamento |
|-----------|----------------|
| New Game | → S03 Mode Select |
| Continue | Carica last session → S10 (o S09 se serve conferma) |
| Load Session | File picker JSON → validate → S10 |
| Settings | → S13 |
| About | Crediti + privacy one-liner + disclaimer |

---

#### S03 — Mode Select

```
+------------------------------------------+
|            CHOOSE MODE                   |
|                                          |
|  +----------------+  +----------------+  |
|  |    DEALER      |  |    PLAYER      |  |
|  |  Run the table |  |  Coming soon   |  |
|  |   [ Select ]   |  |   [ locked ]   |  |
|  +----------------+  +----------------+  |
|                                          |
|  Wallet: — u  (earn as Dealer)           |
|  +------------------------------------+  |
|  | AUTOPLAY (DEMO)                    |  |
|  | Watch & learn the table flow       |  |
|  |            [ Select ]              |  |
|  +------------------------------------+  |
|                                          |
|              [ Back ]                    |
+------------------------------------------+
```

**Use case note (MVP):** click Player → toast/modal **“Coming soon”** + teaser *“Earn units working as Dealer — then play the classic game.”* Non naviga.  
**v0.3:** Player sbloccato se `wallet >= minBuyIn`; altrimenti stesso CTA verso Dealer (`REQUISITI.md` §6bis).

---

#### S04 — Dealer Hub

```
+------------------------------------------+
|           YOUR DEALER                    |
|                                          |
|  [<]  [ portrait ]  [>]     roster       |
|       Name: Aya                          |
|       Female · Human                     |
|       Power 4  Cons 9  Pace 5 ...        |
|       Signature: soft sector bias        |
|                                          |
|  [ Select this dealer ]                  |
|  [ Customize ]  [ Random ]  [ Gym ]      |
|  [ Back ]                                |
+------------------------------------------+
```

| Controllo | Destinazione |
|-----------|----------------|
| Select | → S08 Table Setup (dealer fissato) |
| Customize | → S05 (clone se preset) |
| Random | genera → S06 confirm |
| Gym | → S07 su dealer corrente (clone se preset) |

---

#### S05 — Customize Dealer

```
+------------------------------------------+
|         CREATE / EDIT DEALER             |
|                                          |
|  Name: [____________]                    |
|  Gender: ( ) Male  ( ) Female            |
|  Kind:   Human (fixed MVP)               |
|                                          |
|  Spin Power    [====|-----] 6            |
|  Consistency   [======|---] 7            |
|  Table Pace    [===|------] 4            |
|  Composure     [====|-----] 5            |
|  Presence      [=====|----] 6            |
|  Points left: 2 / 30                     |
|                                          |
|  Release Style: [ Snap v ]               |
|                                          |
|  [ Cancel ]              [ Save ]        |
+------------------------------------------+
```

---

#### S06 — Random Dealer

Come scheda Hub ma con badge `RANDOM`, bottoni **Reroll** / **Edit** / **Use dealer**.

---

#### S07 — Dealer Gym

```
+------------------------------------------+
|            DEALER GYM                    |
|  Train signature from a number sequence  |
|  ------------------------------------    |
|  WARNING: Entertainment only. Does not   |
|  predict live casinos. No network.       |
|                                          |
|  Target dealer: Aya (copy)               |
|  Wheel variant: (•) European ( ) American|
|    (must match numbers you enter)        |
|                                          |
|  Enter last 12 results, oldest → newest: |
|  EU: 0-36   |   US: 0, 00, 1-36          |
|  [__][__][__][__][__][__]                |
|  [__][__][__][__][__][__]                |
|  or paste: [ 17,0,32,15,...        ]     |
|                                          |
|  Train strength: [========|-----] 70%    |
|                                          |
|  [ Train ]                               |
|                                          |
|  --- Preview (after train) ---           |
|  Confidence: Low (12 samples)            |
|  Est. sector bias: ...                   |
|  Consistency → 8  Power → 5              |
|  [ Apply ]  [ Discard ]                  |
|  [ Back ]                                |
+------------------------------------------+
```

---

#### S08 — Table Setup

```
+------------------------------------------+
|           TABLE SETUP                    |
|  Dealer: Aya                             |
|                                          |
|  Table / Wheel:                          |
|   (•) European   (single 0, 37 pockets)  |
|   ( ) American   (0 and 00, 38 pockets)  |
|                                          |
|  Preset:                                 |
|   ( ) Training   (•) Standard            |
|   ( ) Busy       ( ) Rush                |
|   ( ) Custom                             |
|                                          |
|  Players at table: [ 4 ]  (1-8)          |
|  Time between spins: [ 35 ] sec          |
|  Pay time budget:   [ 8 ] sec            |
|  Dealer energy:     [ 3 ]                |
|                                          |
|  Wheel animation:  [ ON | OFF ]          |
|                                          |
|  Summary:                                |
|   Variant: European (default)            |
|   Difficulty = energy + pay time         |
|            + players + table pace        |
|                                          |
|  [ Back ]              [ Continue ]      |
+------------------------------------------+
```

| Campo | Note |
|-------|------|
| **Table / Wheel** | `european` **default** · `american` opzionale |
| **Difficulty preset** | Training…Rush / Custom — **curva** (start LEVEL, cap, range) scelta a inizio |
| **LEVEL (in run)** | Numero arcade che **sale**; in HUD con ENERGY |
| **Dealer energy** | Energia; −1 se non paghi tutti in tempo |
| **Pay time / chip value** | Tempo PAY e taglio fiche (modello C) |
| Preset | Imposta energy, pay time, chip, players, inter-spin, start/max LEVEL |
| **Heat** | Non in MVP (sostituito da LEVEL numerico) |
| Default variant | Precompilata da Settings |

Copy UI summary:

> Pick a difficulty preset (how hard the climb is).  
> Your LEVEL number goes up as you play — harder, not impossible.

Cambio variant → preview testuale o mini-icona ruota EU/US (P1).

---

#### S09 — Session Select

```
+------------------------------------------+
|           SESSION                        |
|                                          |
|  [ New Game ]                            |
|     Start fresh with current setup       |
|                                          |
|  [ Continue Last ]  (se compatibile)     |
|                                          |
|  [ Load from file... ]                   |
|                                          |
|  [ Back ]                                |
+------------------------------------------+
```

**New Game:** se esiste autosave non esportato → confirm dialog “Overwrite last session?”.

---

## 4. Game Table — layout in partita (cuore UI)

La schermata **S10 Game Table** è dove si vive il loop. Stesso scheletro per **Dealer** e **Autoplay** (in Autoplay i controlli dealer sono disabilitati o sostituiti da Pause/speed).

### 4.1 Layout generale (desktop, landscape)

```
+------------------------------------------------------------------+
| TOP BAR / CHALLENGE STRIP (alto contrasto, screenshot-friendly)  |
| +--------------------------------------------------------------+ |
| | LEVEL  12            ENERGY  ⚡⚡⚡     SCORE  1240 u        | |
| | Round 12 · EU · STD · Pl 4 · Aya · BONUS +TIME             | |
| | [ Save ]  [ Exit ]                          [ Pause ]      | |
| +--------------------------------------------------------------+ |
| [Phase: PAYOUT]  Pay timer 0:04                                  |

Autoplay (stessa strip, senza Save):

| | LEVEL  5 · ENERGY ⚡⚡⚡ · SCORE 400 u · [AUTOPLAY]          | |
| | [ Exit ]                                    [ Pause ]      | |
+------------------------------------------------------------------+
| LEFT: WHEEL          | CENTER: FELT (bets)                       |
| +----------------+   | +---------------------------------------+ |
| |    WHEEL idle  |   | | wins highlighted · next pay pulse     | |
| +----------------+   | +---------------------------------------+ |
| Last: 17 RED         |                                           |
| RESULTS: 32 15 19…   |   +-----------------------------------+   |
|                      |   |                                   |   |
|                      |   |      [ ████ PAY / PAGA ████ ]     |   |
|                      |   |     BEA — win due 50 units       |   |
|                      |   |     Chip 10 · CLICKS  2 / 5      |   |
|                      |   |     LEFT: 3   (huge digits)      |   |
|                      |   |     ! OVERPAY = -1 ENERGY !      |   |
|                      |   +-----------------------------------+   |
+----------------------+-------------------------------------------+
| SEATS: Alex 480u | Bea 320u ✓ | Chen 910u · | Dee 150u ·        |
+------------------------------------------------------------------+
| LOG: "PAY Bea +20 units"                                         |
+------------------------------------------------------------------+
```

**LEVEL:** **numero arcade** (`LEVEL 12`), sale durante la run; preset = curva/cap (micro-label `STD`). Accanto a ENERGY per screenshot/sfide.  
**ENERGY:** −1 se non paghi tutti in tempo **oppure** se fai **OVERPAY** (click oltre i CLICKS dovuti).  
**PAY:** solo **vincita** (non lo stake); contatore **CLICKS k/N** e LEFT enormi.  
**SCORE:** HOUSE units.  
**Bonus:** casuali a inizio PAYOUT — auto-pay 1+ NPC, +TIME/BIG CHIP, **+ENERGY/SHIELD** (speranza e run più lunghe); banner in strip.  
**Challenge strip:** `LEVEL ## | ENERGY | SCORE` sempre on (anche pause/game over).

**Nota responsive:** su viewport stretta, ruota sopra, felt sotto, seats in strip orizzontale scrollabile.

### 4.2 Zone UI e responsabilità

| Zona | Contenuto | Note |
|------|-----------|------|
| **Challenge strip** | **LEVEL** + **ENERGY** + **SCORE** | Screenshot / sfide; sempre on |
| **Table chrome** | **Save** + **Exit** (Dealer); **solo Exit** (Autoplay); Pause | Sempre visibili in partita, non solo in pause |
| **Top bar rest** | Fase, pay/bet timer, EU/US, players, round #, dealer | Complementare |
| **Wheel panel** | Canvas ruota+pallina; last number | Bloccata / idle durante PAYOUT |
| **Results log** | Strip numeri sessione + full history | Append a RESULT |
| **Felt / layout** | Griglia EU/US **completa** (tutte inside+outside); chip NPC; highlight win / next pay | Sola lettura in Dealer |
| **Seats dock** | Bankroll + check se già pagato in PAYOUT | — |
| **Action bar** | Close bets / Spin / **PAY (huge)** | PAY solo in PAYOUT |
| **Footer log** | Activity bets + “PAY …” | — |

### 4.3 Stati fase → UI (Dealer mode)

| Fase | Top bar | Wheel | Felt | Actions primary | Input player |
|------|---------|-------|------|-----------------|--------------|
| **PREPARE** | “Getting ready” | Idle | Clear transient chips if needed | — o auto | Attendi |
| **BETTING_OPEN** | “Betting open” + **timer countdown** | Idle / last result | Chip NPC compaiono progressivamente | **No more bets** (manuale) | Chiudi prima del timer |
| **BETTING_CLOSED** | “No more bets” | Idle | Chip bloccati (no nuove) | **Spin** | Avvia lancio |
| **SPINNING** | “Spinning” | **Animazione full** (se ON) | Felt dim | nessuna | Guarda |
| **RESULT** | “Result” | Highlight pocket | Highlight win/lose | breve beat → PAYOUT | Log numeri |
| **PAYOUT** | “PAY — hurry!” + **pay timer** | Idle (no new spin) | Next seat pulse; paid checks | **PAY** grande mash | 1 click = 1 payment |
| → PREPARE | … | … | … | se success o fail risolto | SCORE + ENERGY; LEVEL sempre visibile |

**PAYOUT detail:**

- Timer barra rossa quando basso.
- `Paid k / n`.
- Bottone disabilitato solo se coda vuota (poi auto-advance).
- Timeout → “TOO SLOW” → **−1 ENERGY** → auto-pay restanti → continua o Game Over se energia 0.

**Timer a zero in BETTING_OPEN:** auto “No more bets” → sequenza verso Spin (auto-spin opzionale P1; MVP: richiede Spin o auto dopo 1s in Autoplay).

### 4.4 Animation ON vs OFF (in UI)

| | ON | OFF |
|--|----|-----|
| SPINNING | Canvas animato multi-fase | Skip immediato a RESULT |
| RESULT | Numero + flash tasca | **Big number** al centro + colore + suono corto |
| Tempo percepito | 6–10s tipici | <0.5s + lettura risultato |

### 4.5 Autoplay — differenze UI (modalità obbligatoria MVP)

Stesso Game Table (ruota, felt, seats, challenge strip, results log, bonus).  
Badge **`AUTOPLAY` / `DEMO`** sempre visibile.

| Elemento | Dealer mode | **Autoplay (Demo)** |
|----------|-------------|---------------------|
| Close bets / Spin | Player | **AI** |
| **PAY** (modello C / coda) | Player mash | **AI** esegue i PAY in sequenza **visibile** (non skip invisibile) |
| Bonus casuali | Sì | **Sì**, banner uguali (si impara) |
| LEVEL numerico | Sale in run | **Sale** anche in demo |
| ENERGY / Game Over | −1 su fail; 0 = GO | **Nessun game over**; energia demo-safe (piena o non letale) |
| Overlay didattico | Off | **ON** per ogni fase |
| Pause / Exit | Sì | Sì |
| Speed 0.5x/1x/1.5x | P1 | P1 consigliato |
| Input obbligatorio | Sì (PAY, spin…) | **No** — solo osserva |

Esempio strip in Autoplay:

```text
LEVEL  5     ENERGY  ⚡⚡⚡     SCORE  400 u     [AUTOPLAY]
BONUS! QUICK PAY · Phase: Paying winners…
```

### 4.6 Pause overlay (S11)

```
+------------------------------------------+
|                 PAUSED                   |
| LEVEL 12 · ENERGY ⚡⚡ · SCORE 1240 u   |
|                                          |
|           [ Resume ]                     |
|           [ Save session file ]          |
|           [ Settings ]                   |
|           [ Return to main menu ]        |
|                                          |
|  Dealer: Aya · Round 12 · EU · STD       |
+------------------------------------------+
```

Game Over (stesso blocco visibile):

```
+------------------------------------------+
|              GAME OVER                   |
|  LEVEL  27        ENERGY  ───            |
|  SCORE  2 180 units · Rounds 41          |
|  [ Retry ]  [ Main menu ]                |
+------------------------------------------+
```

Return to menu → confirm se unsaved changes rispetto a last export (autosave locale comunque).

### 4.7 Result overlay (S12) — breve

```
+------------------------+
|      17  RED           |
|   Even · High          |
|                        |
|  Winners:              |
|  Bea +20 units         |
|  Chen +0               |
|                        |
|  [ Next ] (o auto 2s)  |
+------------------------+
```

Può essere integrato nella wheel panel senza modal full-screen (preferibile per fluidità).

### 4.8 Controlli tastiera (MVP proposti)

| Tasto | Azione |
|-------|--------|
| `Space` | Primary: No more bets / Spin / **PAY** (in PAYOUT) |
| `Esc` | Pause |
| `M` | Mute toggle |
| `1`… | (P2) chip values in player mode |

---

## 5. Loop di gioco (runtime flow)

### 5.1 Dealer mode — round loop

```
enter table
  → PREPARE (spawn/refresh seats if needed)
  → BETTING_OPEN
        NPCs place bets over time (AI ticks)
        Player may press [No more bets]
        OR timer → auto close
  → BETTING_CLOSED (lock chips, short beat)
  → Player [Spin]  (or auto in rush policy)
  → SPINNING
        SpinEngine(dealer) → number + plan
        present animation OR instant
  → RESULT (append number to results log)
  → PAYOUT (SKILL)
        auto-settle LOSE → house score +=
        build payment queue from WINs
        start payTimer (level / queue length)
        loop: player hits PAY → pay next winner → house −= · seat +=
        if queue empty in time → perfect / success
        if timeout → −1 ENERGY (dealer), auto-resolve rest
        if energy == 0 → GAME OVER
  → autosave
  → PREPARE / next BETTING_OPEN  (only after PAYOUT resolved)
```

**Importante:** la ruota **non** ricomincia finché non hai finito (o fallito) la fase PAY.  
**Difficoltà** = energia + tempo di pagamento + carico (players) + ritmo inter-spin.

### 5.2 Diagramma stati UI

```
                     ┌──────────────┐
                     │   PREPARE    │
                     └──────┬───────┘
                            ▼
                     ┌──────────────┐
              ┌──────│ BETTING_OPEN │◄─────────────┐
              │      └──────┬───────┘              │
         timer│             │ manual close         │
              ▼             ▼                      │
                     ┌──────────────┐              │
                     │BETTING_CLOSED│              │
                     └──────┬───────┘              │
                            │ spin                 │
                            ▼                      │
                     ┌──────────────┐              │
                     │  SPINNING    │              │
                     └──────┬───────┘              │
                            ▼                      │
                     ┌──────────────┐              │
                     │   RESULT     │              │
                     └──────┬───────┘              │
                            ▼                      │
                     ┌──────────────┐              │
                     │   PAYOUT     │──────────────┘
                     └──────────────┘
```

Pause può interrompere qualsiasi fase (freeze timer e AI).

---

## 6. Use case

Formato: **attore**, **precondizioni**, **flusso principale**, **alternativi**, **postcondizioni**.

---

### UC-01 — Prima partita (New Dealer run)

| | |
|--|--|
| **Attore** | Player |
| **Pre** | App caricata (PWA ok) |
| **Main** | Language → Main Menu → New Game → Mode Dealer → Dealer Hub (sceglie preset) → Table Setup (Standard) → New Game → Game Table → completa ≥1 round |
| **Alt** | A1: sceglie Autoplay. A2: Random dealer. A3: Customize. |
| **Post** | Autosave last session; stats round aggiornate in locale |

---

### UC-02 — Continue last session

| | |
|--|--|
| **Attore** | Player |
| **Pre** | Esiste last session valida |
| **Main** | Main Menu → Continue → Game Table nello stato salvato (fase, bankroll, dealer, params) |
| **Alt** | A1: session corrotta → messaggio + New Game. |
| **Post** | Gioco ripreso |

---

### UC-03 — Load session da file JSON

| | |
|--|--|
| **Attore** | Player |
| **Pre** | File export/session sul disco |
| **Main** | Load Session → file picker → validazione schemaVersion → entra in Table o segnala errore |
| **Alt** | Schema troppo vecchio → migrate o reject con messaggio |
| **Post** | Stato da file; diventa anche last session |

---

### UC-04 — Chiudere le puntate prima del timer

| | |
|--|--|
| **Attore** | Player (Dealer mode) |
| **Pre** | Fase BETTING_OPEN |
| **Main** | NPC stanno scommettendo → player preme **No more bets** → fase BETTING_CLOSED → chip bloccati → abilita **Spin** |
| **Alt** | Nessuna puntata piazzata → comunque chiudibile (tavolo “vuoto” gestito) |
| **Post** | Nessuna nuova bet accettata |

---

### UC-05 — Timer scaduto

| | |
|--|--|
| **Attore** | Sistema |
| **Pre** | BETTING_OPEN, timer 0 |
| **Main** | Auto close bets → messaggio footer “Time’s up — no more bets” → BETTING_CLOSED |
| **Post** | Come UC-04 |

---

### UC-06 — Spin con animazione ON

| | |
|--|--|
| **Attore** | Player |
| **Pre** | BETTING_CLOSED, `wheelAnimationEnabled=true` |
| **Main** | Spin → SPINNING (show 8-bit) → RESULT → numero in **results log** → PAYOUT automatico (seat ±units, **house score** ±) |
| **Post** | Bankroll seats e SCORE aggiornati; roundIndex++ |

---

### UC-07 — Spin con animazione OFF

| | |
|--|--|
| **Attore** | Player |
| **Pre** | BETTING_CLOSED, animation OFF |
| **Main** | Spin → SpinEngine → RESULT immediato → stesso payout/score/log di UC-06 |
| **Post** | Stesso modello di esito e contabilità di UC-06 |

---

### UC-24 — Lettura SCORE e results log durante la sessione

| | |
|--|--|
| **Attore** | Player |
| **Pre** | Almeno un round completato |
| **Main** | Vede SCORE house in top bar; vede strip numeri (es. `32 15 19 4 21 2 17`); apre full history se serve |
| **Post** | Comprensione punteggio sessione e sequenza uscite |

---

### UC-25 — PAYOUT skill: mash PAY (modello C a fiches)

| | |
|--|--|
| **Attore** | Player (Dealer) |
| **Pre** | RESULT noto; almeno un seat win; energy ≥ 1; `chipValue` da livello (es. 10) |
| **Main** | Entra PAYOUT → seat corrente Bea dovuto 50 u, chip 10 → preme PAY 5 volte (`10…50/50`) → next seat… → tutti saldati in tempo → PERFECT → SCORE aggiornato → nuovo round |
| **Alt** | A1: nessun win → skip. A2: timeout → UC-26. A3: livello Training con chip 50 → meno pressioni. A4: Rush chip 5 → molte pressioni |
| **Post** | Nessun unpaid residuo (o auto-resolve su fail); ruota può riprendere |

---

### UC-25b — Stesso dovuto, difficoltà diversa via chip

| | |
|--|--|
| **Attore** | Design / bilanciamento |
| **Pre** | Stesso round simulato, dovuto totale 100 u su 2 seat |
| **Main** | Livello Easy chip 25 → ~4 PAY; Hard chip 5 → 20 PAY; stesso pay timer → Hard molto più stressante |
| **Post** | Dimostra che **chipValue è leva di difficoltà** indipendente dal numero di NPC |

---

### UC-26 — Timeout PAY: perde energia

| | |
|--|--|
| **Attore** | Sistema + Player |
| **Pre** | PAYOUT, pay timer = 0, coda non vuota, energy = E ≥ 1 |
| **Main** | “TOO SLOW” → energy = E−1 → residui auto-pagati → se energy > 0 continua; HUD ENERGY aggiornata |
| **Post** | Round chiuso; dealer più “stanco”; no softlock |

---

### UC-27 — Game Over (energia a 0)

| | |
|--|--|
| **Attore** | Sistema |
| **Pre** | Energia dealer scende a 0 (fail PAY) |
| **Main** | GAME OVER → “Dealer exhausted” / report SCORE, rounds, perfect pays → [Retry] [Main menu] |
| **Post** | Sessione terminata; high score opzionale |

---

### UC-28 — Perfect pay streak feedback

| | |
|--|--|
| **Attore** | Player |
| **Pre** | Coda pagata interamente prima del timeout |
| **Main** | Banner “PERFECT PAY!” (8-bit) → opzionale contatore streak in HUD |
| **Post** | Solo juice MVP; bonus energia = P1 |

---

### UC-29 — Screenshot / sfida tra amici (LEVEL numerico + ENERGY)

| | |
|--|--|
| **Attore** | Player (+ amici offline) |
| **Pre** | In partita, pause o game over |
| **Main** | Vede `LEVEL 27` + ENERGY + SCORE → screenshot → condivide (“sono arrivato al 27”) |
| **Post** | Nessun upload automatico; privacy ok |

---

### UC-30 — Energia: timeout vs overpay

| | |
|--|--|
| **Attore** | Player |
| **Pre** | PAYOUT; Bea amountDue=50, chip=10 → CLICKS 0/5 |
| **Main A** | Timer scade a 3/5 → −1 ENERGY → auto-resolve resto |
| **Main B** | Fa 5 PAY corretti (Bea complete) poi **6° PAY** → `OVERPAY!` → −1 ENERGY; Bea non riceve units extra |
| **Post** | Serve contare i click; UI LEFT/CLICKS deve essere ovvia |

---

### UC-30b — Solo vincita (B2)

| | |
|--|--|
| **Attore** | Sistema |
| **Pre** | Bea stake 10 on Red, win 1:1 |
| **Main** | amountDue PAY = **10** (solo profit); stake 10 torna senza mash; con chip 10 → **1** click mostrato |
| **Post** | SCORE/house e bankroll coerenti con win netta +10 su Bea |

---

### UC-31 — Bonus casuale +TIME su PAYOUT

| | |
|--|--|
| **Attore** | Sistema + Player |
| **Pre** | Ingresso PAYOUT; roll bonus success |
| **Main** | Banner `BONUS! +TIME` → pay timer allungato → player completa i PAY più facilmente |
| **Alt** | Nessun bonus questo round |
| **Post** | Pocket RNG invariato; solo aiuto al pagamento |

---

### UC-31b — Bonus QUICK PAY / DOUBLE PAY (paga NPC)

| | |
|--|--|
| **Attore** | Sistema + Player |
| **Pre** | PAYOUT con 3 seat vincenti; esce `PAY_ONE` o `PAY_TWO` |
| **Main** | Banner bonus → 1 o 2 seat si saldano da soli (units/SCORE come PAY normale) → restano gli altri da mashare a mano |
| **Post** | Meno tap; skill resta sui rimanenti |

---

### UC-31c — Bonus +1 ENERGY (recupero)

| | |
|--|--|
| **Attore** | Sistema + Player |
| **Pre** | energy = 1 (dopo un fail precedente); roll `ENERGY_ONE` |
| **Main** | Banner `+1 ENERGY` → energy = 2 (clamp a max) → run può continuare più a lungo |
| **Alt** | Se già a max energy → bonus convertito in +TIME o PAY_ONE (fallback) |
| **Post** | Speranza/recovery senza vite infinite |

---

### UC-32 — Level up arcade

| | |
|--|--|
| **Attore** | Sistema |
| **Pre** | Completati N round (soglia) con energy > 0 |
| **Main** | `LEVEL 12 → 13` fanfare breve → parametri complessità soft up (entro cap) |
| **Post** | HUD mostra nuovo numero; run più complicata ma restano minimi fair |

---

### UC-08 — Cambiare animation mid-session

| | |
|--|--|
| **Attore** | Player |
| **Pre** | In Pause → Settings |
| **Main** | Toggle Wheel animation → Resume → dal **prossimo** spin applica |
| **Post** | gameParams aggiornati + autosave |

---

### UC-09 — Autoplay demo (imparare) — obbligatorio MVP

| | |
|--|--|
| **Attore** | Player (osservatore) |
| **Pre** | Mode Select → **Autoplay** → dealer + table setup |
| **Main** | Badge AUTOPLAY; loop completo automatico: bets → close → spin → result → **AI esegue PAY** (e applica bonus se escono) → LEVEL può salire; overlay fasi; Pause/Exit |
| **Alt** | A1: animation OFF. A2: speed 1.5x (P1). A3: esce bonus +ENERGY (visibile, didattico) |
| **Post** | Sessione osservata senza Game Over; utente ha visto PAY, energia, level, bonus |

---

### UC-09b — Autoplay mostra un PAY multi-tap

| | |
|--|--|
| **Attore** | Sistema (AI dealer) |
| **Pre** | Autoplay, seat con dovuto 50 u, chip 10 |
| **Main** | AI esegue 5 “PAY” distanziati nel tempo con juice; UI contatore come in Dealer |
| **Post** | Osservatore capisce il modello a fiches senza premere |

---

### UC-10 — Selezionare dealer default

| | |
|--|--|
| **Attore** | Player |
| **Pre** | Dealer Hub |
| **Main** | Scorri roster → Select → Table Setup |
| **Post** | `dealerId` in setup session |

---

### UC-11 — Random dealer e play immediato

| | |
|--|--|
| **Attore** | Player |
| **Pre** | Dealer Hub |
| **Main** | Random → Reroll opzionale → Use dealer → Setup → Play |
| **Post** | Dealer custom in roster se “Save” |

---

### UC-12 — Customize dealer

| | |
|--|--|
| **Attore** | Player |
| **Pre** | Hub o clone preset |
| **Main** | Edit name, gender, sliders entro budget → Save → Hub con nuovo dealer |
| **Alt** | Points exceed → blocco Save + highlight |
| **Post** | Roster aggiornato locale |

---

### UC-13 — Dealer Gym (allena da 12 numeri)

| | |
|--|--|
| **Attore** | Player |
| **Pre** | Dealer scelto (clone se house) |
| **Main** | Gym → disclaimer → inserisce 12 numeri validi → Train → vede preview/confidence → Apply → stats/signature aggiornate |
| **Alt** | A1: numero fuori range → errore campo. A2: Discard. A3: sequenza corta → warn o block. |
| **Post** | Dealer allenato salvabile; **nessuna rete** |

---

### UC-14 — Pause, export session, menu

| | |
|--|--|
| **Attore** | Player |
| **Pre** | In table (Dealer) |
| **Main** | Esc/Pause → opzioni; oppure **Save** sempre in HUD → session JSON; **Exit** → conferma → main menu |
| **Post** | File/local save; o uscita pulita |

---

### UC-14b — Save / Exit sempre in HUD

| | |
|--|--|
| **Attore** | Player |
| **Pre** | Game Table Dealer |
| **Main** | Vede [Save] e [Exit] in ogni fase (anche PAYOUT) → Save salva → Exit chiede conferma se unsaved |
| **Alt Autoplay** | Solo [Exit]; nessun Save |
| **Post** | UX chiara senza aprire solo il menu pausa |

---

### UC-15 — Full data export / import (settings)

| | |
|--|--|
| **Attore** | Player |
| **Pre** | Settings |
| **Main** | Export all → JSON; oppure Import all → restore roster+settings+session |
| **Post** | Stato locale allineato al file |

---

### UC-16 — Tentativo Mode Player (locked, MVP)

| | |
|--|--|
| **Attore** | Utente |
| **Pre** | Mode Select |
| **Main** | Click Player → toast/modal “Coming soon — Earn units as Dealer first” → resta su Mode Select |
| **Post** | Nessuna sessione player |

### UC-16b — Loop autoalimentato (design v0.3; non MVP)

| | |
|--|--|
| **Attore** | Utente |
| **Pre** | Ha completato almeno una run **Dealer**; wallet meta persistente |
| **Main** | Fine Dealer → `wallet += earn(SCORE, LEVEL, …)` → Mode Player → buy-in dal wallet → felt classico (puntate EU/US) → AI close/spin → settle auto → cash-out seat → wallet |
| **Alt** | Wallet &lt; minBuyIn → non entra al tavolo; CTA “Play Dealer” |
| **Alt2** | Autoplay finisce una demo → **wallet invariato** (no farm) |
| **Post** | Wallet aggiornato in export JSON; metriche Dealer (SCORE) e Player (bankroll) separate |

### UC-16c — Player out of chips (design v0.3)

| | |
|--|--|
| **Attore** | Utente in sessione Player |
| **Pre** | Seat bankroll a 0 (o sotto min bet) |
| **Main** | Messaggio “No units left at the table” → Exit / return to menu → CTA Dealer per guadagnare di nuovo |
| **Post** | Wallet può essere ancora &gt; 0 se non tutto era in buy-in; nessun Game Over energia |

---

### UC-17 — Tavolo sotto pressione (Rush)

| | |
|--|--|
| **Attore** | Player |
| **Pre** | Setup Rush (molti players, poco tempo) |
| **Main** | BETTING_OPEN corto; tanti chip; timer urgente (colore warning); player chiude e lancia a ritmo alto |
| **Post** | Stress di mestiere; RNG/signature invariati nelle regole di fairness clamp |

---

### UC-18 — NPC bankroll a zero

| | |
|--|--|
| **Attore** | Sistema |
| **Pre** | Seat units = 0 dopo payout |
| **Main** | Seat marked “broke” / leaves (policy: leave after round) → player count effettivo può scendere o restare vuoto |
| **Post** | UI seat disabilitata; log “Dee left the table” |

*(Policy esatta ancora in decisioni aperte requisiti; UI deve supportare leave o sit-out.)*

---

### UC-19 — Cambio lingua da Settings

| | |
|--|--|
| **Attore** | Player |
| **Pre** | Settings |
| **Main** | Seleziona lingua → UI si aggiorna (a caldo o al re-enter menu) |
| **Post** | settings.locale salvato |

---

### UC-21 — Scelta tavolo European / American (nuova partita)

| | |
|--|--|
| **Attore** | Player |
| **Pre** | Table Setup (S08) |
| **Main** | Vede default **European** → opzionalmente seleziona **American** → Continue → session con `tableVariant` corretto → Game Table con ruota e felt coerenti + badge EU/US |
| **Alt** | A1: lascia European. A2: default precompilato da Settings `defaultTableVariant` = american |
| **Post** | SpinEngine, ruota, felt, payout e last-number supportano 0 oppure 0/00 |

---

### UC-22 — Impostare default variant in Settings

| | |
|--|--|
| **Attore** | Player |
| **Pre** | Settings (S13) |
| **Main** | Table / Wheel default: European \| American → Save → nuove partite aprono Table Setup con quella scelta |
| **Post** | `defaultTableVariant` in local settings; **non** altera da sola una session già aperta |

---

### UC-23 — Tentativo cambio variant a partita in corso

| | |
|--|--|
| **Attore** | Player |
| **Pre** | Pause → Settings durante una session |
| **Main** | Cambia Table/Wheel → Confirm: “Changing table variant restarts the betting layout. Active bets will be cleared. Continue?” → se sì, applica dal prossimo PREPARE con felt/ruota nuovi |
| **Alt** | A1: Cancel. A2: policy più rigida = opzione disabilitata in-session, solo New Game (accettabile MVP) |
| **Post** | Coerenza ruota/felt/esiti; nessun mix EU/US nello stesso round |

---

### UC-20 — Help / prima volta Autoplay suggerito

| | |
|--|--|
| **Attore** | Sistema + Player |
| **Pre** | Primo avvio (flag locale `hasSeenTutorial`) |
| **Main** | Main Menu o Mode: banner “New here? Try Autoplay (Demo)” |
| **Post** | Flag dismissed |

---

## 7. Messaggi di fase (copy EN di default)

| Phase | Banner | Footer example |
|-------|--------|----------------|
| PREPARE | Getting ready | “New round…” |
| BETTING_OPEN | Betting open | “Players are placing bets” |
| BETTING_CLOSED | No more bets | “Bets locked” |
| SPINNING | Spinning | “Ball is running” |
| RESULT | Result | “17 Red” |
| PAYOUT | Paying out | “Bea wins 20 units” |

---

## 8. Componenti UI riusabili

| Componente | Uso |
|------------|-----|
| `PhaseBanner` | Top bar fase + colore |
| `TimerRing` o testo timer | Countdown betting |
| `DealerChip` | Nome + portrait + mini stats |
| `SeatCard` | NPC bankroll + state |
| `FeltBoard` | Layout puntate + chip |
| `WheelCanvas` | Spin / idle / highlight |
| `BigResult` | Numero quando anim OFF o fine spin |
| `PrimaryButton` | CTA fase |
| `UnitsLabel` | Formattazione `N units` |
| `ConfirmModal` | Overwrite, exit, destructive |
| `Toast` | Coming soon, errors validation |
| `SequenceInput` | Gym 12 numeri |

---

## 9. Feedback audio/visivo (minimo)

| Evento | Visivo | Audio (8-bit) |
|--------|--------|----------------|
| Bet placed NPC | Chip drop on felt | Soft click |
| No more bets | Banner flash | Low gong |
| Spin | Wheel motion | Loop roll |
| Ball settle | Pocket flash | Hit + chime |
| Win seat | Seat highlight + | Coin-ish (not cash brand) |
| Timer < 5s | Timer rosso pulse | Optional tick |
| Pause | Dim table | Soft mute game SFX |

Mute globale in settings + icona top (P1).

---

## 10. Casi errore UI

| Situazione | UI |
|------------|-----|
| JSON session invalido | Modal errore + codice schema; non crashare |
| Gym numero 99 / `00` su EU | Campo rosso + range in base a variant (EU 0–36; US 0/00/1–36) |
| Continue senza save | Bottone disabled |
| Points budget exceeded | Save disabled |
| Offline asset mancante | Placeholder + log console; gioco comunque se core ok |
| PWA update | (P1) soft prompt reload |

---

## 11. Priorità implementazione UI

| Priorità | Cosa |
|----------|------|
| **P0** | S01–S04, S08–S11, Game Table loop Dealer, phase UI, timer, seats, wheel ON/OFF, pause/save |
| **P0** | Mode Player locked, units labels, EN strings |
| **P0/P1** | S05–S06 Random/Customize |
| **P0/P1** | S07 Gym (se allineata a fitter) |
| **P1** | Autoplay overlay didattico, seat detail, keyboard |
| **P2** | Juice extra, portraits hi-fx, multi-slot saves UI |

---

## 12. Decisioni UI ancora aperte

| # | Domanda | Proposta |
|---|---------|----------|
| 1 | Spin automatico dopo close o sempre bottone Spin? | Bottone Spin in Dealer; auto in Autoplay |
| 2 | Result modal vs inline? | Inline su wheel panel |
| 3 | Quante seat visibili senza scroll? | Fino a 5, poi scroll |
| 4 | Felt cliccabile in Dealer mode? | No (solo lettura) in MVP |
| 5 | Posizione ruota | Sinistra desktop; alto mobile |
| 6 | Confirm overwrite session | Sì, sempre |
| 7 | Tutorial obbligatorio | No; banner Autoplay opzionale |
| 8 | Default table variant | **European** |
| 9 | Cambio variant in-session | Confirm + clear bets, o solo da New Game in MVP |

---

## 13. Tracciabilità requisiti ↔ UI

| Area requisiti | Schermate / UC |
|----------------|----------------|
| Boot lingua/mode/session | S01–S03, S09 · UC-01,02,03 |
| Dealer roster/random/gym | S04–S07 · UC-10–13 |
| Levels + animation + **table variant** | S08, S13 · UC-06–08,17, **21–23** |
| Loop dealer + ruota | S10–S12 · UC-04–07 |
| Autoplay | S10 demo · UC-09 |
| Privacy export | S11, S13–14 · UC-14,15 |
| Player locked | S03 · UC-16 |

---

### S13 — Settings (estratto campi rilevanti)

```
+------------------------------------------+
|              SETTINGS                    |
|                                          |
|  Language:        [ English v ]          |
|  Master volume:   [========|---]         |
|  Wheel animation: [ ON | OFF ]           |
|                                          |
|  Default table / wheel:                  |
|    (•) European (0, 37 pockets)          |
|    ( ) American (0 & 00, 38 pockets)     |
|                                          |
|  [ Export all data ]  [ Import... ]      |
|  [ Reset local data ]                    |
|                                          |
|  [ Back ]                                |
+------------------------------------------+
```

`Default table / wheel` precompila **Table Setup**; la variant **effettiva** della partita resta quella salvata in `session.gameParams.tableVariant`.

---

## Cronologia

| Versione | Data | Note |
|----------|------|------|
| 0.1 | 2026-08-05 | Prima bozza: screen map, wireframe, game table, stati fase, 20 use case, componenti |
| 0.2 | 2026-08-05 | Table/Wheel European (default) vs American in Setup, Settings, HUD, Gym, UC-21–23 |
| 0.3 | 2026-08-05 | SCORE house units, results log sessione, payout, UC-24–25 |
| 0.4 | 2026-08-05 | Bottone PAY mash, pay timer, LIVES, Game Over, UC-25–28 |
| 0.5 | 2026-08-05 | Vite = **energia dealer**; difficoltà = energia + pay time + players + inter-spin |
| 0.6 | 2026-08-05 | PAY modello C a fiches/units; chipValue in difficoltà/progressione; UC-25/25b |
| 0.7 | 2026-08-05 | Difficoltà fissa a inizio (MVP) vs Heat in-run (P1); non impossibile |
| 0.8 | 2026-08-05 | LEVEL accanto a ENERGY (challenge strip) |
| 0.9 | 2026-08-05 | LEVEL numerico arcade; energia solo su fail; bonus PAY; UC-30–32 |
| 0.10 | 2026-08-05 | Bonus: auto-pay NPC, +energy, catalogo tipi; UC-31b/c |
| 0.11 | 2026-08-05 | Autoplay obbligatorio: AI PAY, no GO, bonus/LEVEL, UC-09/09b |
| 0.12 | 2026-08-05 | Allineamento canone v0.17: LEVEL vs preset; no Heat MVP |
| 0.13 | 2026-08-05 | Felt completo: tutte le puntate standard (B1) |
| 0.14 | 2026-08-05 | B2: solo vincita; CLICKS evidenti; overpay −energy |
| 0.15 | 2026-08-05 | B3/B4: bilanciamento in config/game-balance.json |
| 0.16 | 2026-08-06 | Player teaser Mode Select; UC-16b/c wallet Dealer→Player (canone §6bis) |
| 0.17 | 2026-08-06 | Brand BitCroupier + tagline both sides of the table |
