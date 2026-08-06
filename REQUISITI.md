# BitCroupier — Documento di requisiti

**Product name:** **BitCroupier**  
**Tagline:** *Roulette from both sides of the table*  
**Codename / repo legacy:** `RouletteLife` (cartella e path storici; il brand utente è BitCroupier)  
**Versione:** 0.30 (bozza allineata)  
**Data:** 2026-08-06  
**Stato:** design + config ready; ingresso `checkpoint.md`  

---

## 0. Decisioni ufficiali (canone v0.17+)

Questa sezione **prevale** su formulazioni più vecchie nello stesso file o in `UI_USE_CASES.md`.

| Tema | Decisione ufficiale MVP |
|------|-------------------------|
| **Nome prodotto** | **BitCroupier** — tagline: *Roulette from both sides of the table*. Codename storico: RouletteLife |
| **Modes** | **Dealer** giocabile · **Autoplay (Demo)** giocabile · **Player** locked in MVP (design §6bis; implementazione **v0.3**) |
| **Economia** | Solo **units** (niente simboli moneta). In **Dealer**: SCORE = house score di sessione. In **meta**: **wallet** persistente che finanzia **Player** |
| **Loop autoalimentato** | Per giocare da **Player** serve aver **lavorato da Dealer**: le fiches Player vengono dal wallet alimentato a fine run Dealer — non da units gratis all’avvio |
| **Variant** | `european` **default** \| `american` |
| **Ruota** | Show 8-bit di qualità; parametro animation **ON/OFF**; stesso SpinEngine |
| **Esito spin** | Stocastico + **marcatura dealer** (non uniforme piatto indipendente) |
| **Core skill** | Fase **PAYOUT** con bottone **PAY**; modello **C** (fiche `chipValue`, N press per saldare un seat) |
| **Lose bets** | Auto-settle a inizio PAYOUT (niente PAY sulle perdite) |
| **Energia** | −1 su **timeout unpaid** o **overpay** (click di troppo); a 0 = **Game Over** (solo Dealer) |
| **LEVEL** | **Numero arcade** (`LEVEL 12`) in HUD accanto a ENERGY; **sale durante la run** |
| **Difficulty preset** | Scelta a inizio (Training…Rush/Custom) = **curva** (start, velocità salita, cap, range parametri) — **non** sostituisce il numero LEVEL in HUD |
| **Heat** | **Non usato in MVP** (assorbito da LEVEL numerico). Eventuale meta futura ≠ Heat parallelo |
| **Bonus** | Casuali a inizio PAYOUT: auto-pay 1+ NPC, +TIME/BIG CHIP, recupero/protezione energia; non toccano il pocket |
| **Autoplay** | Stesso sim; AI fa close/spin/PAY visibili; bonus e LEVEL visibili; **nessun Game Over** |
| **Sfide amici** | Screenshot manuale strip `LEVEL \| ENERGY \| SCORE`; no multiplayer/account |
| **Privacy** | `devLaw.md` vincolante |
| **Progressione anti-impossibile** | Più complicato sì; min/max su payTime, chipValue, players, energy |
| **Puntate (B1)** | **Tutte** le puntate standard della variant attiva (inside + outside) |
| **Contabilità (B2)** | PAY spinge solo la **vincita** `amountDue = S × M` (non la restituzione dello stake) |
| **Overpay** | Premere PAY **oltre** il dovuto del seat (o tap extra) → **penalità −1 ENERGY** (evidente in UI) |
| **Preset / bilanciamento (B3)** | Valori in **`config/game-balance.json`** (editabile) |
| **Level-up (B4)** | `roundsPerLevelUp` + `levelUpEffects` in `game-balance.json` |
| **SpinEngine (B5)** | **Opzione A**: condizioni iniziali + simulazione (`config/wheel-spin.json`) |
| **NPC AI (B6)** | Profili + pesi catalogo pieno + bankroll/stake; `config/npc-ai.json` |
| **Input Dealer (B7)** | No more bets: manuale + auto a timer 0; **Spin sempre manuale**; PAY manuale; vedi `config/controls.json` |
| **HUD in partita** | Sempre visibili: **Save** + **Exit** (Dealer); in **Autoplay solo Exit** (niente Save) |
| **Architettura (A1)** | **Dominio indipendente dal framework 8-bit** — regole, fasi, PAY, SpinEngine, NPC, bilanciamento e session in TypeScript puro; presenter/UI (Canvas, DOM, Phaser, Pixi, …) **solo** rendering, input binding e asset. Cambio framework = riscrivere la shell, non il gioco. Dettaglio §13. |
| **Player (design P1)** | Roulette **classica**: seat umano, puntate standard EU/US, payout auto. **Buy-in dal wallet meta**. AI croupier su close/spin/PAY. Dettaglio **§6bis**. MVP: UI “Coming soon” |

**Ancora aperti (bloccanti day-one, da chiudere uno a uno):** vedi §16. (Player non è bloccante MVP.)

---

## 1. Visione del prodotto

**BitCroupier** (*Roulette from both sides of the table*) è un gioco browser (web app statica) in stile **8-bit / pixel art** in cui il giocatore vive un tavolo di roulette da **entrambe le parti**: mestiere da **croupier** (Dealer) e, col wallet guadagnato, da **cliente** (Player). Il tavolo ha **dealer personaggio** (identità + mestiere) e un **modello di spin stocastico realistico**: i numeri non escono da un semplice “pesca uniforme 0–36”, ma da una simulazione di lancio **influenzata dalle caratteristiche del dealer** (marcatura / signature), restando **casuale a ogni spin**.

| Modalità | Ruolo | MVP | Post-MVP |
|----------|--------|-----|----------|
| **Dealer** | Controlli il tavolo: close, spin, **PAY** sotto timer, energia | Giocabile | — |
| **Player** | Cliente al tavolo: puntate classiche EU/US; fiches = **wallet** guadagnato da Dealer | Locked — Coming soon | **v0.3** giocabile (§6bis) |
| **Autoplay (Demo)** | Stesso tavolo in automatico per imparare | Giocabile | non farma wallet |

Pilastri:

1. Ruota + pallina 8-bit (animazione **ON/OFF**).
2. Variante **European** (default) / **American**.
3. Job arcade da dealer: **PAY a fiches**, **energia**, **LEVEL** numerico, **bonus** casuali.
4. Difficoltà = preset (curva) + LEVEL in run + energia + pay time + chip + players + inter-spin — **non impossibile**.
5. Dealer personaggio (stats + signature sullo spin).
6. Roster: default, custom, random, **Dealer Gym**.
7. **Autoplay** di prima classe; local-first (`devLaw.md`); **units**.
8. **Loop autoalimentato:** lavora da croupier (Dealer) → accumuli units nel **wallet** → giochi da cliente (Player) con quelle fiches.

---

## 2. Principi vincolanti

1. Dati solo dell’utente — nessun server/terze parti.  
2. Storage locale + file JSON utente.  
3. Export completo leggibile.  
4. Import / restore.  
5. No analytics / tracking.  
6. Offline-first (PWA).  
7. Codice semplice, hosting statico.  
8. No chat multiutente / backend contenuti.

**Extra prodotto:**

- Solo **units** — mai simboli moneta reali.
- Spin **sempre stocastico** (rumore / condizioni iniziali non deterministiche al 100% spin-to-spin).
- Le stats dealer **influenzano la distribuzione e la dinamica del lancio** (marcatura), non “scelgono un numero a tavolino”.
- Trasparenza: in UI/help si spiega che il risultato nasce da un **modello di lancio del dealer**, non da un generatore piatto uniforme nascosto.
- Solo intrattenimento — no soldi reali.
- Variante tavolo/ruota esplicita e coerente su **felt, ruota, payout, SpinEngine, Gym**.

---

## 2.1 Variante tavolo e ruota (European / American)

Scelta di gioco e di impostazioni: **quale roulette** si sta simulando.

| Valore | ID | Tasche | Zeri | Ordine ruota | Layout felt | Default |
|--------|-----|--------|------|--------------|-------------|---------|
| **European** | `european` | 37 | singolo `0` | ordine europeo standard | griglia europea | **Sì** |
| **American** | `american` | 38 | `0` e `00` | ordine americano standard | griglia americana | No |

### Regole

| ID | Requisito | Priorità |
|----|-----------|----------|
| F-VAR-01 | Parametro `tableVariant` ∈ { `european`, `american` } | P0 |
| F-VAR-02 | **Default = `european`** (nuove partite e settings iniziali) | P0 |
| F-VAR-03 | Scelta disponibile in **Table Setup** (nuova partita) e in **Settings** (preferenza globale / default prossime partite) | P0 |
| F-VAR-04 | La variante attiva determina: **ruota** (tasche + ordine + grafica 8-bit), **felt/layout puntate**, **insieme esiti legali**, **payout** della variante, **SpinEngine** | P0 |
| F-VAR-05 | Con `american`, il numero `00` è un esito distinto da `0` (stringa o enum `0` / `00` / `1`…`36`) | P0 |
| F-VAR-06 | Session JSON include `tableVariant`; load session ripristina la variante corretta | P0 |
| F-VAR-07 | Cambiare variante a metà sessione: **non silenzioso** — richiede conferma e tipicamente **nuovo round/setup** (bankroll ok, bets attive annullate o blocco fino a fine round). Proposta: modificabile solo fuori da `BETTING_OPEN` con chip attivi, o solo da setup/new game | P0 |
| F-VAR-08 | Preferenza Settings `defaultTableVariant` usata per precompilare Table Setup | P0 |
| F-VAR-09 | Dealer Gym valida i numeri rispetto alla **variante del dealer/sessione target** (EU: 0–36; US: 0, 00, 1–36) | P0 |
| F-VAR-10 | UI etichetta sempre la variante attiva (es. badge `EU` / `US` in top bar Game Table) | P0 |
| F-VAR-11 | Help breve: differenza 0 vs 0/00 e house edge astratto in termini di gioco (i18n) | P1 |
| F-VAR-12 | Varianti future (es. French rules la partage) fuori scope MVP; schema `tableVariant` resti estendibile | P2 |

### Impatto su sottosistemi

| Sottosistema | European | American |
|--------------|----------|----------|
| Wheel presenter | 37 pocket, ordine EU | 38 pocket, ordine US, doppio zero visibile |
| SpinEngine | pocket set 37 | pocket set 38 |
| Felt | 0 singolo, outside bets EU | 0 + 00, outside tipiche US (es. line 0-00 se prevista) |
| Payout table | standard EU | standard US (stessi full-pay tipici; edge diverso per lo 00) |
| Gym input | `0`–`36` | `0`, `00`, `1`–`36` |
| Signature sectors | ring da 37 | ring da 38 |

**Nota design:** le stats dealer restano le stesse; cambia il **mondo fisico-sim** (n° tasche e ordine) su cui si applica la marcatura.

---

## 3. Modello di esito: non “random piatto”, ma spin da dealer

### 3.1 Obiettivo

Rendere **quanto più realistico** il variare dei numeri:

- **Non** un algoritmo del tipo `number = floor(random() * 37)` isolato dalle stats.
- **Sì** un processo in cui **parametri del dealer + stato ruota + rumore** producono l’esito.
- Resta **casuale**: stesso dealer, due spin → numeri diversi; la “personalità” emerge su **molti** spin (marcatura statistica), non come cheat evidente a ogni colpo.

### 3.2 Idea di marcatura (signature)

Nella realtà si parla (in modo più o meno leggendario) di dealer con **gesto ripetibile**: forza di lancio, punto di rilascio, senso di rotazione. In gioco lo modelliamo in modo **soft e stocastico**:

| Concetto | Significato in BitCroupier |
|----------|-----------------------------|
| **Signature** | Tendenza debole del dealer (settori / dinamica), non un numero fisso |
| **Consistency** | Quanto è stretta quella tendenza (alta = marcatura più leggibile nel lungo periodo) |
| **Spin Power** | Energia iniziale pallina / quanti giri prima del drop |
| **Release Style** | Famiglia di rilascio (verso, offset angolare tipico, flair) |
| **Noise** | Componente casuale inevitabile (dito che trema, micro-variazioni) |

**High Consistency + Release Style fisso** → su 100 spin, alcuni settori appaiono un po’ più spesso (marcatura).  
**Low Consistency** → distribuzione più vicina all’uniforme.  
**Mai** un singolo spin “garantito”.

### 3.3 SpinEngine v1 — **B5 CHIUSO: Opzione A**

**Motore ufficiale:** condizioni iniziali + simulazione fino al pocket.  
**Config editabile:** `config/wheel-spin.json` (`engine: "initial_conditions_v1"`).

```
buildInitialConditions(dealer, tableVariant, rng)
  → integrate ball + wheel until drop/settle
  → winningNumber + spinPlan
  → if wheelAnimationEnabled: play(spinPlan)
    else: showInstant(winningNumber)   // STESSO winningNumber
  → RESULT / PAYOUT
```

| Parametro simulato | Influenzato da |
|--------------------|----------------|
| Velocità pallina | `spinPower` + noise (range in config) |
| Offset / stile rilascio | `releaseStyle` + noise |
| Quanto è “stretto” il gesto | `consistency` (meno noise) |
| Decelerazione, drop, scatter | costanti `wheel-spin.json` + noise |

**API fissa:**

```ts
spin(dealer, tableVariant, rng) → {
  winningNumber: string; // "0" | "00" | "1" … "36"
  spinPlan: SpinPlan;
  debug?: object;
}
```

**Regole fisse:** stesso esito ON/OFF animazione; nessun pocket a p=0/1; marcatura soft (`maxBiasStrength` default 0.2); LEVEL/PAY/difficoltà non toccano il numero; pocket order EU/US in config.

### 3.4 Opzione B (pesi) — non path prodotto

Il modello a pesi categorici resta solo eventuale **tool di test / fallback emergenza**.  
Il path ufficiale di gioco è **solo §3.3 Opzione A**.

### 3.5 Requisiti del motore di esito

| ID | Requisito | Priorità |
|----|-----------|----------|
| F-SPIN-01 | Engine **initial_conditions_v1** (Opzione A); config `wheel-spin.json` | P0 |
| F-SPIN-02 | L’esito **è** stocastico: noise su ogni spin | P0 |
| F-SPIN-03 | Stats dealer modulano **condizioni di lancio** della sim | P0 |
| F-SPIN-04 | Stesso pipeline esito con animation ON e OFF | P0 |
| F-SPIN-05 | Animazione e numero **sempre** coerenti (un solo truth: la simulazione) | P0 |
| F-SPIN-06 | `consistency` controlla quanto è marcata la signature (soft bias, non certezza) | P0 |
| F-SPIN-07 | Nessun modo di “scegliere il numero” dal menu; solo profili e noise | P0 |
| F-SPIN-08 | Seed opzionale in session per debug/replay (documentato) | P1 |
| F-SPIN-09 | Tool/dev o schermata stats (locale) “last N results histogram” per vedere la marcatura | P1 |
| F-SPIN-10 | Help in-game: spiega signature vs random piatto (i18n) | P0 |
| F-SPIN-11 | Parametri bias clampati: nessun pocket a probabilità 0 o 1 in condizioni normali | P0 |
| F-SPIN-12 | Livello di difficoltà (players/time) **non** deve sovrascrivere la physics del numero; al massimo stress del dealer (stamina/composure) altera leggermente noise/consistency effettiva | P1 |

### 3.6 Trasparenza e limiti etici di design

- È un **sim di mestiere + spettacolo**, non un trainer per battere casinò reali.
- Disclaimer: “Entertainment only — simulated dealer signature, not real-world advantage play.”
- La marcatura resta **debole**: il giocatore sente lo stile, non ottiene un bot predittivo banale.
- Valori di default bilanciati in playtest (target: scostamento dall’uniforme **lieve** anche con consistency alta).

---

## 4. Ruota, pallina e animazione ON/OFF

### 4.1 Qualità (animation ON)

Show 8-bit multi-fase: launch → speed → slowdown → pocket.  
Il filmato **è la visualizzazione** della simulazione §3, non un decoro dopo un RNG separato.

### 4.2 Parametro `wheelAnimationEnabled`

| Valore | Comportamento |
|--------|----------------|
| `true` (default) | Full show ruota + pallina |
| `false` | Stessa simulazione, reveal immediato del numero |

Salvato nei game params / settings; toggle a caldo dal prossimo spin (P1).

---

## 5. Difficoltà, livelli, parametri tavolo

- Difficoltà operativa: **interSpinSeconds** × **playerCount** (vedi anche §5.4).
- Preset: Training, Standard, Busy, Rush, Custom.
- Params di sessione:
  - `tableVariant`: **`european` (default)** \| `american`
  - `playerCount`, `interSpinSeconds`, `spinDurationSeconds`
  - `wheelAnimationEnabled`
  - `dealerId`
- Settings globali: `defaultTableVariant` (precompila Table Setup; default `european`).

### 5.0 Catalogo puntate — **tutte** quelle della roulette (B1 CHIUSO)

**Decisione:** non si limitano le puntate a un sottoinsieme “facile”.  
Il felt e il motore regole espongono **l’intero set standard** della **variant attiva** (European o American).  
Un sim da croupier che taglia le bet perderebbe realismo e profondità sul PAY (più tipi di win = più casi da saldare).

#### Perché tutte

| Motivo | Dettaglio |
|--------|-----------|
| Fedeltà al tavolo | Il dealer lavora su tutto il layout, non su 4 bottoni |
| Skill PAY | Win su split/corner/dozzine cambiano importi e n° di tap |
| Autoplay / demo | Mostra un tavolo completo |
| Estensione | Nuove bet = solo variant speciale (es. call bets), non “sbloccare il rosso” |

#### Inside bets (entrambe le variant, con differenze note)

| Bet (EN) | Copertura | Payout tipico* | Note |
|----------|-----------|----------------|------|
| **Straight up** | 1 numero | 35:1 | Include `0`; in US anche `00` |
| **Split** | 2 numeri adiacenti | 17:1 | |
| **Street** | 3 numeri (riga) | 11:1 | |
| **Corner** (square) | 4 numeri | 8:1 | |
| **Six line** (double street) | 6 numeri | 5:1 | |
| **Trio** | 3 numeri con zero (es. 0-1-2, 0-2-3) | 11:1 | EU; US analoghi con 0/00 |
| **First four** / basket (EU: 0-1-2-3) | 4 numeri | 8:1 | |
| **Five-number** (US only) | 0-00-1-2-3 | 6:1 | **Solo American** |
| **0-00 split** (US) | 0 e 00 | 17:1 | Solo American |

\*Payout “to one” classici: **M** in `amountDue = S × M` (solo vincita al PAY). Stake gestito a parte (B2).

#### Outside bets

| Bet (EN) | Copertura | Payout tipico* |
|----------|-----------|----------------|
| **Red / Black** | 18 numeri | 1:1 |
| **Even / Odd** | 18 numeri | 1:1 |
| **Low / High** (1–18 / 19–36) | 18 numeri | 1:1 |
| **Dozen** (1st/2nd/3rd) | 12 numeri | 2:1 |
| **Column** | 12 numeri | 2:1 |

Su **0** (e **00** in US): le outside **perdono** (regola standard US/EU “semplice”; non la partage francese salvo future variant French).

#### Call bets / annunci (voisins, tiers, orphelins, neighbors)

| Scope | Decisione |
|-------|----------|
| MVP layout felt | **Inside + outside completi** sul tappeto standard |
| Call / racetrack (francese) | **P1** — stesso motore può aggiungerli come macro di straight/split; non bloccano B1 |
| French special rules (la partage / en prison) | **P2** / variant futura, non American/European “base” |

#### Requisiti

| ID | Requisito | Priorità |
|----|-----------|----------|
| F-BET-01 | Motore e felt supportano **tutte** le inside+outside standard della variant | P0 |
| F-BET-02 | American include `00`, five-number, split 0-00 | P0 |
| F-BET-03 | European senza five-number US; ordine ruota e colori EU | P0 |
| F-BET-04 | Ogni bet ha definizione macchina: set di pocket coperti + moltiplicatore | P0 |
| F-BET-05 | NPC AI può piazzare **qualsiasi** tipo del catalogo (pesi bilanciabili) | P0 |
| F-BET-06 | PAYOUT risolve win/lose per **ogni** bet attiva; coda PAY su seat aggrega tutti i win del seat | P0 |
| F-BET-07 | UI felt: tutte le zone cliccabili/piazzabili in lettura Dealer (chip NPC su ogni tipo) | P0 |
| F-BET-08 | Call bets (voisins…) | P1 |
| F-BET-09 | Tabella payout e edge documentate in help in-game | P1 |

#### Implicazioni (non sono scuse per limitare)

| Area | Impatto |
|------|---------|
| **Felt UI** | Layout completo 8-bit (più asset/zone hitbox) |
| **PAY** | Un seat può avere più bet win → `amountDue` = somma payout di tutte le sue win (modello C: tap sul totale seat) |
| **AI NPC** | Catalogo pieno con **pesi** (più outside comuni, inside rari) — non “solo rosso” |
| **Test** | Suite casi per ogni tipo bet (win/lose su sample pocket) |
| **Implementazione** | Un data-file `bets.european.json` / `bets.american.json` meglio di if sparsi |

### 5.1 Units = punteggio (e moneta di tavolo)

Le **units** sono l’unica moneta astratta del gioco e, in modalità Dealer, fungono anche da **punteggio** (come lo score nei videogiochi classici).

| Concetto | Chi lo ha | Significato |
|----------|-----------|-------------|
| **Seat bankroll** | Ogni NPC | Units che il cliente può ancora scommettere |
| **House score** (punteggio casinò / tuo) | Il “banco” che tu rappresenti come dealer | Units nette guadagnate (o perse) dal tavolo nella sessione |
| **Bet stake** | Su ogni puntata | Units rischiate dall’NPC su quella bet |

**Regola di lettura per il player (Dealer mode):**

- Quando un NPC **perde** una puntata → quelle units vanno al banco → **House score sale**.
- Quando un NPC **vince** → il banco paga il payout in units → **House score scende** (di netto: si restituisce stake+vincita secondo regole).
- L’HUD mostra in evidenza **House score** come il tuo **SCORE** di sessione (label i18n: es. `HOUSE` / `SCORE` + `N units`).

Non è denaro reale; non ci sono simboli moneta. È “punti che salgono e scendono con l’edge del tavolo”.

### 5.2 Come avviene il pagamento (PAYOUT) — skill core

**MVP: pagamento manuale a skill** con un grande pulsante **PAY** / **PAGA**.

Il cuore arcade del job dealer non è solo “lanciare la ruota”, ma **saldare il tavolo il più in fretta possibile** prima che scada la finestra di pagamento e il flusso torni verso il prossimo ciclo (nuova betting / prossima pressione di tavolo).

#### Idea di gameplay (8-bit / skill button)

1. Dopo RESULT, il gioco calcola l’elenco dei **pagamenti dovuti** (una voce per ogni bet/seat da saldare — vedi sotto).
2. In UI compare un **pulsante PAY evidente** (primary, grande, sempre raggiungibile).
3. Ogni pressione di **PAY** completa **un** pagamento della coda (il prossimo in lista).
4. Devi premere PAY **tante volte quanti sono i pagamenti ancora in coda**, il più velocemente possibile.
5. C’è un **timer di pagamento** (leva di difficoltà). Se scade e restano pagamenti non fatti → **penalità** (− energia dealer / score).
6. Solo quando la coda è vuota (o dopo risoluzione penalità) il round può chiudere e tornare verso PREPARE / nuovo BETTING_OPEN.
7. **La ruota non riparte** (nessun nuovo spin) finché la fase PAYOUT non è chiusa secondo le regole.

Questo richiama i giochi 8-bit in cui ripeti un’azione sotto tempo (mash / timing), con **energia del dealer** (le classiche “vite”) come risorsa finita → a zero **Game Over**.

#### Cosa conta come “un pagamento” (coda) — modelli a confronto

Il gesto **PAY** può significare cose diverse. Tre modelli (combinabili con la difficoltà):

| ID | Modello | Esempio | N° pressioni PAY | Feel |
|----|---------|---------|------------------|------|
| **A — Per persona (seat)** | 1× PAY salda **tutto** il dovuto a un seat vincente | Bea vince 50 u → **1** PAY | = n° seat vincenti | Semplice, arcade “pulito” |
| **B — Per bet** | 1× PAY salda una singola bet win | 3 bet win su seat diversi → **3** PAY | = n° bet win | Più carico se tante scommesse |
| **C — A fiches / tagli di units** | Ogni PAY consegna **una fiche di taglio fisso** (es. 10 u) verso il dovuto del seat corrente | Bea deve ricevere **50 u**, fiche da **10** → **5** PAY solo per Bea | = ceil(importo / chipValue) sommato sui seat (o per seat in sequenza) | Più “croupier vero”, skill di stacking |

##### Modello C + solo vincita (B2) + overpay penalizzato

**Cosa si paga con PAY:** solo la **vincita**, non lo stake.

```text
Per ogni bet win del seat:  profit = stake S × multiplier M
amountDue(seat) = somma dei profit di tutte le bet win di quel seat
```

Lo **stake** delle win torna al seat in automatico a inizio settle (o resta “sul felt” e si libera senza mash).  
Il mash PAY spinge solo i **profit units**.

**Esempio rosso 1:1, S=10:** amountDue = 10×1 = **10** → con chip 10 serve **1** PAY.  
**Esempio straight 35:1, S=10:** amountDue = 350 → chip 10 → **35** PAY (o chip più grosso / bonus).

**Fiches e click:**

1. `chipValue` da livello/preset (es. 10).  
2. `tapsNeeded = ceil(amountDue / chipValue)` — **mostrato in UI in modo enorme**.  
3. Ogni PAY corretto (finché `paid < amountDue`):  
   - `piece = min(chipValue, amountDue - paid)`  
   - `paid += piece`  
   - seat += piece; house score −= piece  
4. Quando `paid == amountDue` → seat **COMPLETE** → prossimo seat (o fine PAYOUT).  
5. **Overpay (penalità):**  
   - un PAY mentre il seat corrente è già a `paid == amountDue`, **oppure**  
   - un PAY che cercherebbe di erogare oltre il totale (se non si clampa e si forza chip pieno), **oppure**  
   - PAY a coda globale già vuota  
   → **non** aggiunge units extra al seat (o le marca come errore)  
   → **−1 ENERGY**  
   → feedback forte `OVERPAY!`  
   → (opz.) il round può comunque proseguire / seat già complete  

**Regola ufficiale overpay MVP:**  
il sistema **non regala units oltre amountDue** (clamp sull’importo), ma il **click di troppo conta come errore di mestiere → −1 ENERGY**.  
Così “pagare di più” = **premere PAY più volte del dovuto**, non un bug di bankroll.

**UI obbligatoria (evidenza click):**

```text
PAY → Bea
Win due: 50 units          (solo vincita)
Chip: 10
CLICKS:  3 / 5             ← grande, arcade
Left: 2
[████ PAY ████]
```

Anche: anelli/counter sul seat `×5`, countdown `5…4…3…2…1…OK`.

##### Come incorporarlo in difficoltà e avanzamento

| Leva | Effetto sul modello C (e in generale) |
|------|----------------------------------------|
| **Taglio fiche piccolo** (5 invece di 25) | Più pressioni a parità di dovuto → **più difficile** |
| **Taglio fiche grande** | Meno pressioni → più facile / early game |
| **Importi medi NPC alti** | `amountDue` grande → più PAY se chip piccolo |
| **Più players** | Più seat in coda (+ più dovuto totale) |
| **Pay timer corto** | Stesso carico in meno secondi |
| **Energia bassa** | Meno tolleranza ai fail sotto quel carico |

**Progressione / livelli (proposta):**

| Fase gioco | Payment mode | Chip value tipico | Note |
|------------|--------------|-------------------|------|
| Tutorial / Training | **A** (1 PAY = 1 seat) oppure C con chip **grandi** | 50–100 | Impari il flusso |
| Standard | **C** | 25 o 10 | Core skill |
| Busy / Rush | **C** | 10 o 5 | Mash intenso |
| Unlock avanzato | **C** + scelta taglio (o B+C) | player sblocca chip 5 | “Hard settle” |
| Late progression | Mix: chip piccoli obbligatori su VIP win grandi | 5 | Boss-table feel |

Quindi sì: **il modo di pagare è una leva di difficoltà e di avanzamento**, non solo cosmesi.

##### Decisione di design raccomandata

| Scope | Scelta |
|-------|--------|
| **MVP** | Modello **C (a fiches/units)** con **un solo chipValue** fissato dal livello/preset (es. Standard = 10). Coda = seat vincenti in ordine; per ogni seat fai N PAY finché non è saldato, poi next seat. |
| **MVP semplificato se C troppo lungo da bilanciare** | Modello **A**, con C come v0.2 |
| **P1** | Chip value scelto dal player tra tagli sbloccati (tradeoff: chip grande = meno click ma forse pay timer più severo / meno “accuracy” bonus) |
| **P2** | Multi-denomination stacking (scegli 25+10+5 come un croupier vero) |

**Lose bets:** restano auto-settled all’ingresso PAYOUT (il player non “PAY” le perdite).

**Contatore UI unificato (vale per A/B/C):**

- `Payments: 7 / 22` = pressioni fatte / pressioni totali stimate nel round  
- oppure dual: `Seats 1/3 · Bea 20/50 u`

#### Flusso per ogni round

```
1. BETTING_OPEN: NPC piazzano bet
2. Close → SPIN → RESULT (numero in log)
3. Entra PAYOUT:
     - settle automatico delle LOSE (house += stakes perse; felt lose clear)
     - costruisci coda payments[] dai WIN
     - avvia payTimer (dipende da livello / n° payments / stats Pace)
     - mostra bottone PAY grande + contatore "3/7 paid"
4. Player preme PAY ripetutamente:
     - pop payment dalla coda
     - seat.bankroll += amount; house score −= amount pagato
     - juice 8-bit (chip fly, SFX, seat flash)
5a. Coda vuota prima del timeout → SUCCESS
     - bonus opzionale (tempo rimasto → mini bonus units o solo fanfare)
     - chiudi PAYOUT → PREPARE / BETTING_OPEN
5b. Timeout con coda non vuota → FAIL parziale
     - −1 energia dealer (e/o multa score)
     - pagamenti rimasti: auto-complete CON penalità
     - poi chiudi fase (niente softlock)
6. Autosave
```

**Vincolo:** non si torna a BETTING_OPEN / non si abilita un nuovo Spin finché PAYOUT non è **risolto** (success o fail gestito).

#### Energia del dealer (ex “vite” 8-bit)

Le vite classiche qui sono l’**energia del dealer**: resistenza a fallire i pagamenti sotto stress.  
Insieme al **tempo di pagamento** (e al carico del tavolo) definisce la **difficoltà**.

| Voce | Proposta |
|------|----------|
| Concetto | Energia = quante volte puoi fallire un PAYOUT prima del collasso |
| Nome UI | **ENERGY** / **ENERGIA** (segmenti o barra 8-bit) |
| Codice | `dealerEnergy` |
| Default start | es. **3** (da preset/custom — leva di difficoltà) |
| Quando scende | Timeout PAYOUT con pagamenti ancora dovuti |
| A **0 energia** | **GAME OVER** — dealer esausto → report → retry / menu |
| Recupero | P1: perfect pay streak; MVP può essere solo perdita |

| Penalità su fail | MVP? | Effetto |
|------------------|------|---------|
| **−1 energia** | **Sì** | Core sopravvivenza / difficoltà |
| Multa house score | Soft sì | Units |
| Auto-pay residui | Sì | Chiude il round |
| NPC unsatisfied | P1 | Presence |

#### Dettaglio contabile (invariato nello spirito)

| Esito | Seat | House score |
|-------|------|-------------|
| **Lose** | −S | +S (tipicamente allo settle automatico inizio PAYOUT) |
| **Win** | +payout quando il player preme PAY su quella voce | −importo al momento del PAY |

**House score sessione** = cumulativo (lose raccolte − win pagate).  
Può scendere sotto zero. **Non** è l’energia.

#### Cosa vede il player durante PAYOUT

- **Bottone PAY enorme** (primary arcade).
- Contatore `Paid 2 / 5` o lista seat con checkmark.
- **Pay timer** visibile (barra o countdown) — leva di difficoltà.
- Highlight del **prossimo** seat/bet da pagare.
- **ENERGY** + **LEVEL** sempre in top bar (vedi §5.2c).
- Dopo ogni PAY: +units sul seat, SFX, SCORE house aggiornato.
- Su fail: flash “TOO SLOW”, −1 energia, resolve resto.

### 5.2c LEVEL numerico arcade + ENERGY (HUD sfide)

**Sì: LEVEL come numero** stile cabinato (`LEVEL 12`) è **meglio** del solo nome preset per screenshot e sfide tra amici.  
Il **preset** resta la curva di partenza (velocità di salita, cap, range); il **numero** è ciò che avanzi e mostri.

#### HUD obbligatorio

```text
LEVEL  12          ENERGY  ⚡⚡⚡          SCORE  1240 u
```

| Elemento | Formato | Ruolo |
|----------|---------|--------|
| **LEVEL** | Intero ≥ 1 | Avanzamento arcade + flex screenshot |
| **ENERGY** | Segmenti / barra | Sopravvivenza |
| **SCORE** | Units | Punteggio house |
| Preset | Micro-label opz. `STD` | Contesto scelta iniziale |

#### Come sale LEVEL

| Regola | Proposta |
|--------|----------|
| Start | `level = 1` (o startLevel del preset) |
| +1 level | Ogni **2–3 round** completati (o regola preset) |
| Cap | Per preset (Training basso, Rush alto) — oltre il cap non diventa impossibile |
| Effetto | Soft: più tap / chip step / ritmo, con min/max fair |

#### Requisiti

| ID | Requisito | Priorità |
|----|-----------|----------|
| F-HUD-01 | LEVEL (numero) e ENERGY adiacenti, alto contrasto | P0 |
| F-HUD-02 | Formato cabinato `LEVEL ##` | P0 |
| F-HUD-03 | LEVEL sale in run; non scende (salvo new game) | P0 |
| F-HUD-04 | Preset influenza curva/cap, non sostituisce il numero in HUD | P0 |
| F-HUD-05 | Visibile in gioco, pause, game over | P0 |
| F-HUD-06 | Game Over mostra LEVEL raggiunto + SCORE | P0 |
| F-HUD-07 | Screenshot manuale per sfide; no multiplayer | P0 |
| F-HUD-08 | In **Dealer** Game Table: bottoni **Save** e **Exit** sempre visibili (non solo in pause) | P0 |
| F-HUD-09 | In **Autoplay** Game Table: solo **Exit** sempre visibile; Save assente | P0 |
| F-HUD-10 | Save: autosave locale e/o download session JSON (stesso flusso export sessione) | P0 |
| F-HUD-11 | Exit: conferma se sessione Dealer non salvata di recente; Autoplay conferma opzionale/semplice | P0 |
| F-HUD-12 | Save/Exit non coperti da pannello PAY; tap-target chiari 8-bit | P0 |

### 5.2d Quando diminuisce l’ENERGY?

| Evento | Energia |
|--------|---------|
| **Timeout** con ancora vincite da pagare | **−1** |
| **Overpay** — PAY oltre i click dovuti (`tapsNeeded`) | **−1** + banner `OVERPAY!` |
| PAY corretti fino a complete | invariata |
| Units oltre amountDue al seat | **Non accreditate** (solo penalità click) |

Due errori di mestiere: **troppo lenti** o **click di troppo**.  
I click dovuti devono essere **sempre ovvi** in UI (CLICKS k/N, LEFT).

### 5.2e Bonus casuali sul pagamento (speranza + recupero)

**Opinione di design: sì, è una buona idea.**

I bonus casuali servono a tre cose:

1. **Aiutare il PAY** (meno stress meccanico in un round difficile).  
2. **Restituire un po’ di energia** persa, così una run non muore al primo errore.  
3. Dare **speranza** (“al prossimo payout magari arriva un bonus”) → sessioni più lunghe e meno frustranti, tono arcade classico.

Non devono: risolvere sempre il tavolo, spegnere la skill del mash PAY, o truccàre il numero della ruota.

#### Filosofia

| Principio | Applicazione |
|-----------|--------------|
| Speranza | Rate bassa ma **visibile** (anche “no bonus” deve far desiderare il prossimo) |
| Recupero | Bonus che danno **+1 energy** (clamp a max) — rari ma memorabili |
| Aiuto pagamento | Auto-pay **1 o più NPC**, +TIME, BIG CHIP, ecc. |
| Fairness | Mai influenzare SpinEngine / pocket |
| Anti-impossibile | I bonus **allungano** le run; la difficoltà resta da level/preset |
| Skill resta | Non sostituiscono del tutto il PAY: anche con bonus spesso resta qualcosa da premere |

#### Quando si tira il bonus

- All’**ingresso in PAYOUT** (dopo RESULT): roll `bonusRoll`.  
- Esito: `none` | un tipo dal catalogo.  
- UI immediata: `BONUS! QUICK PAY ×2` + effetto.  
- Proposta rate base: **~18–28%** di avere *un* bonus (il resto dei round “a secco” alimenta la speranza).  
- Opzionale: pity timer soft (dopo K payout senza bonus, rate sale un po’) — P1.

#### Catalogo tipi di bonus (famiglie)

##### A — Pagano NPC per te (core della tua idea)

| ID | Nome | Effetto | Note bilanciamento |
|----|------|---------|-------------------|
| `PAY_ONE` | **QUICK PAY** | Auto-paga **1** seat vincente (tutto il dovuto di quel seat, o N tap equivalenti) | Comune tra gli “aiuti pay” |
| `PAY_TWO` | **DOUBLE PAY** | Auto-paga **2** seat (o i 2 con dovuto più alto) | Media |
| `PAY_ALL_SMALL` | **SWEEP** | Auto-paga tutti i seat con dovuto ≤ soglia (es. ≤ 20 u) | Media-rara |
| `PAY_HALF_TABLE` | **HALF TABLE** | Auto-paga metà dei seat vincenti (ceil) | Rara — non ogni round |

Dopo l’auto-pay, il player mashà i **rimanenti** a mano.  
Se dopo il bonus non resta nulla → Perfect automatico + juice.

##### B — Recuperano energia (allungano la partita)

| ID | Nome | Effetto | Note |
|----|------|---------|------|
| `ENERGY_ONE` | **+1 ENERGY** | `energy = min(energy+1, energyMax)` | Rara; “second wind” |
| `ENERGY_SHIELD` | **SHIELD** | Il **prossimo** fail timeout non consuma energia (1 carica) | Media-rara; non è +energia subito ma salva |
| `ENERGY_SIP` | **SIP** | +1 energy **solo se** energy ≤ 1 | Rara “clutch”; evita farm a full bar |

**Max energia** resta il cap del preset (es. 3 o 5): i bonus non creano infinite vite.

##### C — Facilitano il mash (senza pagare seat interi)

| ID | Nome | Effetto |
|----|------|---------|
| `TIME_PLUS` | **+TIME** | +2–5 s al pay timer |
| `BIG_CHIP` | **BIG CHIP** | chipValue ↑ di uno step per questo PAYOUT |
| `SLOW_CLOCK` | **SLOW CLOCK** | timer scorre al ~70% |
| `TAP_FREE` | **FREE TAPS** | i prossimi 3 PAY non richiedono… no: meglio “3 tap auto” sul seat corrente |

##### D — Combo (rari, spettacolari)

| ID | Nome | Effetto |
|----|------|---------|
| `SECOND_WIND` | **SECOND WIND** | PAY_ONE **+** +1 ENERGY (se non full) |
| `LUCKY_DEALER` | **LUCKY DEALER** | PAY_TWO **+** +TIME |
| `JACKPOT_HELP` | **JACKPOT HELP** | PAY_HALF_TABLE **oppure** +1 ENERGY (scelta random tra i due) — molto raro |

#### Pesi di rarità (proposta)

| Peso | Tipi |
|------|------|
| 55% dei bonus | PAY_ONE, +TIME, BIG_CHIP |
| 30% | PAY_TWO, SHIELD, SLOW_CLOCK, PAY_ALL_SMALL |
| 12% | +1 ENERGY, SIP, SECOND_WIND |
| 3% | PAY_HALF_TABLE, LUCKY_DEALER, JACKPOT_HELP |

(Percentuali *condizionate al fatto che un bonus sia uscito*.)

#### Regole anti-abuso / chiarezza

1. Max **1 bonus** per PAYOUT (MVP).  
2. +ENERGY non supera `energyMax`.  
3. Auto-pay rispetta la contabilità (house score e seat units come un PAY normale, solo automatico).  
4. Log: `BONUS PAY_ONE → Bea +50 u`.  
5. Audio/juice distinti per famiglia (pay help vs energy).  
6. In **Training**, rate bonus un po’ più alta; in **Rush** un po’ più bassa ma i rari restano rari.  
7. Opzione setup **Bonuses: ON/OFF** (default ON) per puristi — P1.

#### Perché funziona con LEVEL e sfide

- LEVEL alto + energia bassa + bonus clutch = storie da screenshot (“LEVEL 30, 1 energy, SECOND WIND”).  
- La speranza del bonus riduce tilt dopo un −1 energy.  
- Non invalida “sono arrivato al livello N”: il skill resta, i bonus sono RNG di **sollievo**, non di punteggio house diretto (salvo contabilità pay normale).

#### Requisiti

| ID | Requisito | Priorità |
|----|-----------|----------|
| F-BONUS-01 | Roll bonus a inizio PAYOUT; può essere none | P0 |
| F-BONUS-02 | Tipi che **auto-pagano 1+ NPC** (almeno PAY_ONE, PAY_TWO) | P0 |
| F-BONUS-03 | Tipi che **restituiscono o proteggono energia** (+1 ENERGY e/o SHIELD) | P0 |
| F-BONUS-04 | Almeno un facilitatore mash (+TIME o BIG_CHIP) | P0 |
| F-BONUS-05 | Banner + log + nessun effetto sul pocket RNG | P0 |
| F-BONUS-06 | energy clamp a max; 1 bonus per payout | P0 |
| F-BONUS-07 | Catalogo esteso (combo rare) | P1 |
| F-BONUS-08 | Pity timer soft | P1 |
| F-BONUS-09 | Toggle bonuses on/off in setup | P1 |

#### Input

| Input | Azione |
|-------|--------|
| Click/tap **PAY** | Paga prossima voce in coda |
| `Space` | Stesso di PAY in fase PAYOUT |
| (P2) | Direzione per scegliere quale seat pagare prima — MVP: coda fissa (es. left-to-right / ordine seat) |

#### Modello di difficoltà (definizione ufficiale)

La difficoltà del gioco **non** è “indovinare la pallina”.  
È definita da quanto è duro **reggere il mestiere di pagamento sotto tempo**, misurato soprattutto da:

| Pilastro difficoltà | Parametro | Effetto |
|---------------------|-----------|---------|
| **Energia del dealer** | `dealerEnergy` | Meno energia = meno margine di errore |
| **Tempo di pagamento** | `payTimer` | Meno tempo = mash più veloce |
| **Taglio fiche (modello C)** | `chipValue` | Chip più piccolo = **più pressioni PAY** a parità di dovuto |
| **Importi / bet size NPC** | AI stake range | Dovuti più alti = più PAY se chip fisso |
| **Carico seat** | `playerCount` | Più vincenti in coda |
| **Ritmo del tavolo** | `interSpinSeconds` | Meno respiro tra round |
| **(P1) Stats dealer** | Pace, Chipcraft, … | Modulano timer/feel, non l’RNG |

**Formula concettuale:**

```
paymentTaps ≈ sum over winners of ceil(amountDue / chipValue)   // modello C
difficultyFeel ≈ (paymentTaps / payTime) × interSpinPressure / remainingEnergy
```

- **Alta difficoltà:** poca energia di partenza, pay timer corto, tanti giocatori, inter-spin basso.  
- **Bassa difficoltà (Training):** tanta (o più) energia, pay timer largo, pochi seat, inter-spin lungo.

I **preset** (Training → Rush) devono esporre chiaramente queste leve, non solo un generico “hard”.

#### B3 CHIUSO — preset numerici (fonte: `config/game-balance.json`)

| | Training | Standard | Busy | Rush |
|--|:---:|:---:|:---:|:---:|
| Players | 2 | 4 | 6 | 8 |
| Inter-spin (s) | 50 | 35 | 25 | 15 |
| Pay time base (s) | 12 | 9 | 7 | 5 |
| Chip value | 25 | 10 | 10 | 5 |
| Energy start/max | 5/5 | 3/3 | 3/3 | 3/3 |
| LEVEL start | 1 | 1 | 1 | 3 |
| LEVEL max | 15 | 40 | 60 | 99 |
| Rounds per +1 LEVEL | 3 | 3 | 2 | 2 |
| Bonus chance | 30% | 22% | 18% | 15% |

**Pay time effettivo:**  
`max(4, payTimeBase + 0.35 × expectedTaps)`  
(config: `payTime.minSeconds`, `payTime.tapBonusSecondsPerTap`).

**Level-up soft (rotazione, clamp):** stake NPC +5% · inter-spin −1s · chip uno step più piccolo se ≥ 5.

**Custom ranges:** players 1–8, inter-spin 10–90, pay base 4–20, chip ∈ {5,10,25,50}, energy 2–6, startLevel 1–20.

**Regola implementativa:** il runtime **carica** `config/game-balance.json` (o copia buildata in `/public` o bundle).  
Aggiornare bilanciamento = edit file, non hardcode sparso. Default preset id: `standard`.

### 5.0b NPC AI — **B6 CHIUSO**

**Fonte:** `config/npc-ai.json` (editabile). Docs: `config/README.md`.

| Voce | Regola ufficiale |
|------|------------------|
| Catalogo | Tutte le bet standard (pesi per famiglia) |
| Profili | cautious 25% · normal 50% · aggressive 15% · superstitious 10% |
| Bet/round | 0–3 (pesi 10/45/30/15%) |
| Stake | `chip × {1,2,3,5}` (pesi 50/30/15/5%), max 25% bankroll |
| Bankroll Standard | 150–500 (altri preset nel file) |
| Timing | delay 10%–90% della finestra betting |
| Broke | `leaveWhenBroke: true` |
| Cheat | Nessuno — non conoscono il risultato dello spin |

### 5.0c Input Dealer — **B7 CHIUSO**

**Fonte:** `config/controls.json`. Docs: `config/README.md`.

| Azione | Dealer mode | Autoplay |
|--------|-------------|----------|
| No more bets | Bottone manuale **+** auto a timer 0 | AI |
| Spin | **Sempre manuale** (MVP); `autoSpinAfterClose` default false | AI |
| PAY | Manuale; Space = primary di fase | AI, tap visibili |
| Game Over energia | Sì | No |

### 5.2b Progressione ufficiale (sostituisce Heat / “solo preset fisso”)

**Principio:** più si avanza, più è **complicato**, non **impossibile**.

#### Due concetti distinti (non confonderli)

| Concetto | Cos’è | Quando si sceglie / cambia |
|----------|--------|----------------------------|
| **Difficulty preset** | Training / Standard / Busy / Rush / Custom | **A inizio sessione** — definisce curva, cap, range, energia max, ecc. |
| **LEVEL (numero)** | Intero arcade in HUD (`LEVEL 12`) | **Sale durante la run** (e in Autoplay); mai confuso col nome del preset |

**Heat** come contatore separato: **abbandonato in MVP** (era una bozza intermedia). Il ruolo di “intensità che sale” è del **LEVEL numerico**.

#### Come funziona in MVP

1. All’avvio scegli un **preset** (o Custom).  
2. Parti da `LEVEL = startLevel` del preset (default spesso **1**; Rush può partire più alto — **numero esatto in scheda bilanciamento, ancora aperta**).  
3. Completati round secondo regola di salita → `LEVEL += 1` (fanfare).  
4. Ogni level-up applica **modifiche soft** entro min/max del preset (chip, pay time, stake NPC, ecc.).  
5. A `maxLevel` del preset: **plateau** (non peggiora oltre).  
6. Fine run: energia 0 (Dealer) / exit / menu. Game Over mostra LEVEL raggiunto.

#### Anti-impossibilità (vincolante)

1. Min/max assoluti su payTime, chipValue, players, energy.  
2. Pay timer **scala** con i tap previsti (`f(paymentTaps)`), non resta fisso crudele.  
3. Un solo parametro “toesto” per level-up, non tutto insieme.  
4. Bonus casuali aiutano recupero (energia / auto-pay), senza annullare lo skill.

#### Glossario

| Termine | Significato |
|---------|-------------|
| **Difficulty preset** | Curva pre-partita |
| **LEVEL** | Numero arcade in run (HUD + screenshot) |
| **Round** | Contatore round; non è il LEVEL |
| **Meta unlock** | Tra sessioni (P2), non confondere con LEVEL |

**Nota storica:** bozze v0.12 dicevano “MVP solo preset fisso senza level-up”. **Superato** da v0.14+ (LEVEL numerico arcade). Questo §5.2b è la regola valida.

### 5.3 Log numeri usciti (session history)

Obbligatorio in UI di partita: **cronologia dei numeri usciti nella sessione corrente**.

| Campo | Descrizione |
|-------|-------------|
| `spinHistory[]` | Lista ordinata (oldest → newest o newest first in UI) |
| Ogni entry | `roundIndex`, `result` (`0`/`00`/`1`…), `color`, `timestamp` opzionale, `houseDeltaUnits` opzionale |

**UI:**

- Strip o pannello **“Results”** / **“Last numbers”** (es. ultimi 12–15 visibili + scroll per tutta la sessione).
- Sempre visibile o a un click (proposta: strip sotto la ruota + expand full log).
- Coerente con variant (mostra `00` se American).
- Salvato in session JSON (export incluso).

Non è il Dealer Gym: il Gym è input **manuale** per allenare signature; questo log è lo **storico automatico della tua partita**.

### 5.4 Dove sta la difficoltà (riepilogo)

Allineato al **modello ufficiale** (§ sopra: energia + pay time + carico + inter-spin).

| Leva | Ruolo |
|------|--------|
| **Energia dealer** | Margine di errore; a 0 = game over |
| **Tempo di pagamento** | Quanto devi essere veloce sul PAY |
| **N° giocatori** | Coda PAY più lunga |
| **Tempo tra lanci** | Ritmo complessivo del shift |
| Stats Pace/Chipcraft (P1) | Modulano timer/feel, non l’RNG |
| Animazione ruota ON/OFF | Comfort, non skill check principale |

**Cosa la difficoltà NON fa:** truccare i numeri in segreto; cambiare payout standard della variant.

**Skill MVP:** pagare in tempo, non bruciare energia, massimizzare SCORE house.

**Fail:** energia 0 → Game Over + report.

### 5.5 Risorse: energia vs score

| Risorsa | Ruolo |
|---------|--------|
| **Energia dealer** | Sopravvivenza e leva di difficoltà |
| **Tempo di pagamento** | Difficoltà skill del core PAY |
| **Players + inter-spin** | Carico e ritmo |
| **SCORE (house units)** | Punteggio del tavolo — **non** è l’energia |

Obiettivi: non esaurire energia · SCORE alto · perfect pay streak.

### 5.6 Requisiti funzionali (score, log, payout skill, energy, difficulty)

| ID | Requisito | Priorità |
|----|-----------|----------|
| F-SCORE-01 | House score in units sempre visibile in Game Table | P0 |
| F-SCORE-02 | House score = cumulativo netto banco sessione | P0 |
| F-SCORE-03 | Delta house del round visibile a fine/during PAYOUT | P0 |
| F-SCORE-04 | Label units / SCORE i18n; no moneta reale | P0 |
| F-LOG-01 | Log numeri usciti sessione in UI | P0 |
| F-LOG-02 | Append a ogni RESULT | P0 |
| F-LOG-03 | Log in session JSON | P0 |
| F-LOG-04 | Ultimi K + full history | P0 |
| F-PAY-01 | Fase PAYOUT con coda derivata dalle win (regole variant) | P0 |
| F-PAY-02 | Pulsante **PAY** evidente; modello pagamento documentato (A/B/C) | P0 |
| F-PAY-02b | Modello C: chip verso **vincita** `amountDue=S×M` aggregata per seat | P0 |
| F-PAY-02c | `chipValue` da preset/level | P0 |
| F-PAY-03 | UI **molto evidente**: units due, chip, **CLICKS k/N**, left; seat highlight | P0 |
| F-PAY-03b | Overpay (PAY oltre tapsNeeded) → −1 ENERGY + feedback OVERPAY; no units extra al seat | P0 |
| F-PAY-03c | Stake win restituito/auto senza contare nei click PAY | P0 |
| F-PAY-04 | **Pay timer**; la ruota/nuovo betting **non** riparte finché PAYOUT non è risolto | P0 |
| F-PAY-05 | Timeout con residui → penalità (−1 energia + resolve automatico residui) | P0 |
| F-PAY-06 | Success: coda vuota in tempo → chiudi PAYOUT pulito (+ feedback perfect) | P0 |
| F-PAY-07 | Lose bets settled senza richiedere PAY (MVP) | P0 |
| F-PAY-08 | Convenzione contabile stake/payout documentata e testata | P0 |
| F-PAY-09 | Space = PAY in fase PAYOUT | P0 |
| F-PAY-10 | Autoplay: AI preme PAY in automatico (demo) o pay istantaneo con overlay didattico | P0 |
| F-EN-01 | **Energia dealer** visibile in HUD (default segmenti es. 3; nome ENERGY/ENERGIA) | P0 |
| F-EN-02 | −1 energia su **timeout unpaid** e su **overpay** (click oltre il dovuto) | P0 |
| F-EN-03 | Energia = 0 → Game Over + report + retry/menu | P0 |
| F-EN-04 | Energia in session JSON + nei preset/custom difficoltà | P0 |
| F-EN-05 | Help: energia = resistenza del dealer, non moneta | P0 |
| F-DIFF-01 | Difficoltà definita da **energia + pay time + carico (players) + inter-spin** | P0 |
| F-DIFF-02 | Preset espongono queste leve in UI (non solo label Hard) | P0 |
| F-DIFF-03 | Custom può regolare energia start e pay time base (range validi) | P0 |
| F-DIFF-04 | No probabilità nascoste extra oltre SpinEngine dichiarato | P0 |
| F-PAY-04 | Pay timer visibile; scala con difficoltà / n° payments (formula bilanciata) | P0 |
| F-SCORE-05 | High score locale | P1 |
| F-EN-06 | Recupero energia su streak perfect | P1 |
| F-PAY-11 | Policy B (PAY per singola bet) come opzione hard | P2 |

---

## 6. Modalità Autoplay (Demo) — obbligatoria MVP

**Autoplay resta una modalità di gioco di prima classe**, selezionabile al boot accanto a Dealer (e Player locked).  
Non va dimenticata mentre si aggiungono PAY skill, energia, LEVEL e bonus: deve **mostrare lo stesso gioco**, ma senza richiedere input di mestiere.

### 6.1 Scopo

| Scopo | Dettaglio |
|-------|-----------|
| **Imparare** | Vedere fasi, ruota, log numeri, SCORE, LEVEL, bonus, come funziona il PAY |
| **Vetrina** | Mostrare la ruota 8-bit e il flusso tavolo |
| **Zero stress** | Nessuna pressione su vite/energia del player-osservatore |
| **Stesso sim** | Stesso SpinEngine, variant EU/US, dealer, NPC, regole units |

### 6.2 Disponibilità e boot

```
Mode Select:
  [ Dealer ]     — giocabile
  [ Player ]     — locked (Coming soon)
  [ Autoplay ]   — giocabile (Demo)
```

Flusso: Language → **Mode = Autoplay** → Dealer (default o scelta / random) → Table Setup (preset, variant, animation…) → Session New → **Game Table DEMO**.

### 6.3 Chi controlla cosa

| Azione | Dealer mode | **Autoplay** |
|--------|-------------|--------------|
| NPC bets | AI | AI (uguale) |
| No more bets | Player o timer | **AI / timer** |
| Spin | Player | **AI** |
| Animazione ruota | ON/OFF da setup | Stesso flag |
| **PAY mash** | Player | **AI** esegue i PAY (visibili, non istantanei “invisibili” se possibile) |
| Bonus roll | Sì | **Sì** (si vedono banner e effetti — didattica) |
| LEVEL sale | Sì | **Sì** (la demo “avanza” come una run) |
| ENERGY −1 su fail | Sì | **No fail player**: AI paga in tempo **oppure** fail solo cosmetico senza game over |
| Game Over energia | Sì | **Disattivato** (o energia infinita / non mostrata come minaccia) |
| Pause / Speed | Pause | Pause + speed 0.5x/1x/1.5x (P1) |
| **Save** (HUD tavolo sempre) | **Sì** | **No** (non mostrare) |
| **Exit** (HUD tavolo sempre) | **Sì** | **Sì** |
| Overlay didattico | Off | **ON** (testi fase) |

**Proposta fail in Autoplay:** l’AI è “competente” (completa sempre i PAY prima del timer, magari con velocità legata al livello). Così non si vede un game over in demo.  
Alternativa P1: a volte l’AI “sbaglia” di proposito per mostrare −ENERGY, ma **senza** arrivare a game over (energia non scende sotto 1 in demo).

### 6.4 Cosa resta visibile in Autoplay (stesso HUD)

Challenge strip e sistemi restano **visibili** per insegnare e per screenshot:

- **LEVEL** (numero arcade)  
- **ENERGY** (opzionale: piena fissa, o nascosta label “DEMO — no game over”)  
- **SCORE** house  
- Results log numeri  
- Bonus banner quando escono  
- Badge **`DEMO` / `AUTOPLAY`** in strip  

### 6.5 PAY in Autoplay (importante)

Il bottone PAY può:

| Stile | Comportamento | Preferenza |
|-------|---------------|------------|
| **A — Simulato** | AI preme PAY a intervalli visibili (chip che volano uno a uno) | **Consigliato** — si impara il mestiere |
| **B — Istantaneo** | Salda tutto in un tween | Più veloce, meno chiaro |

Con bonus `PAY_ONE` / `PAY_TWO`: si applicano e si annunciano come in Dealer mode.

### 6.6 Requisiti Autoplay

| ID | Requisito | Priorità |
|----|-----------|----------|
| F-AUTO-01 | Voce **Autoplay (Demo)** selezionabile in Mode Select (MVP) | P0 |
| F-AUTO-02 | Loop completo senza input obbligatorio (solo pause/exit) | P0 |
| F-AUTO-03 | Stesso tavolo/regole/SpinEngine/variant/dealer della modalità Dealer | P0 |
| F-AUTO-04 | Close bets, Spin, **PAY** eseguiti dall’AI in modo leggibile | P0 |
| F-AUTO-05 | Overlay didattico fasi (i18n) | P0 |
| F-AUTO-06 | Badge DEMO/AUTOPLAY sempre visibile | P0 |
| F-AUTO-07 | **Nessun Game Over** che blocchi la demo; energia non termina la sessione | P0 |
| F-AUTO-08 | Bonus casuali **attivi e visibili** (stesso catalogo) | P0 |
| F-AUTO-09 | LEVEL può salire in demo (mostra progressione) | P0 |
| F-AUTO-10 | Rispetta wheel animation ON/OFF e tableVariant | P0 |
| F-AUTO-11 | Challenge strip LEVEL/ENERGY/SCORE visibile (ENERGY in modalità demo-safe) | P0 |
| F-AUTO-11b | In Autoplay: bottone **Exit** sempre visibile; **nessun** bottone Save | P0 |
| F-AUTO-12 | Suggerimento al primo avvio: “Try Autoplay to learn” | P1 |
| F-AUTO-13 | Velocità demo 0.5x / 1x / 1.5x | P1 |
| F-AUTO-14 | Opzione “Autoplay uses my selected dealer” | P0 |

### 6.7 Cosa Autoplay non è

- Non è multiplayer.  
- Non è un bypass per farm high score “umano” (eventuale flag `mode: autoplay` nei save; high score classifica solo Dealer mode — **proposta P1**).  
- Non è un canale per farmare il **wallet Player** (vedi §6bis.3).  
- Non sostituisce il tutorial testuale, ma lo riduce.

---

## 6bis. Modalità Player — design ufficiale (MVP locked, implementazione v0.3)

**Stato:** design **chiuso abbastanza** da non reinventare dopo; **non** implementare nel vertical slice / MVP day-one.  
In MVP: Mode Select → Player → “Coming soon” (e, se utile, teaser: *“Earn units as Dealer first”*).

### 6bis.1 Visione e loop autoalimentato

Il gioco si **autoalimenta**:

```text
Lavori come DEALER (skill PAY, energia, LEVEL)
  → a fine run: units vanno nel WALLET meta (persistente, locale)
  → sblocchi / finanzi la modalità PLAYER
  → giochi alla roulette CLASSICA da cliente (puntate EU/US)
  → se finisci le fiches → torni a lavorare da dealer
```

| Principio | Decisione |
|-----------|-----------|
| **No units gratis all’avvio Player** | Non esiste un bankroll Player “regalo” che bypassa Dealer |
| **Prima il mestiere** | Wallet vuoto o sotto min buy-in → CTA chiara verso **Dealer** (non un soft-lock punitivo) |
| **Stesso tavolo, altro ruolo** | Stesse regole bet, stesso SpinEngine, stessa variant; cambia chi controlla cosa |
| **Units only** | Stessa moneta astratta; mai moneta reale (`devLaw.md`) |

### 6bis.2 Cos’è il gameplay Player

Modalità **classica** da scommettitore:

| Aspetto | Comportamento |
|---------|----------------|
| **Ruolo** | Un **seat** umano al tavolo |
| **Puntate** | **Tutte** le standard della variant attiva (catalogo `bets-european` / `bets-american`) |
| **Input** | Felt cliccabile: scegli taglio fiche, piazza / rimuovi chip in `BETTING_OPEN` |
| **Close / Spin** | **AI croupier** (o timer) — tu non sei il dealer |
| **PAYOUT** | **Automatico** (win/lose per le tue bet + eventuali NPC companion); **niente** mash PAY / energia / Game Over dealer |
| **SpinEngine** | Stesso motore + marcatura del **dealer personaggio** scelto per il tavolo |
| **Variant** | EU default / US — come Dealer |
| **Animazione** | ON/OFF — stesso esito |

**Non è** Player mode: multiplayer, soldi veri, call bets francesi (P1 globale), bypass del wallet.

### 6bis.3 Economia: tre sacche di units (non confonderle)

| Sacca | Dove vive | Significato |
|-------|-----------|-------------|
| **SCORE (house)** | Sessione **Dealer** | Punteggio banco della run; skill + screenshot; **non** è il chip stack Player live |
| **Wallet meta** | Persistenza globale (localStorage / export JSON) | Units **tue** a lungo termine; uniche che finanziano Player |
| **Seat bankroll** | Sessione **Player** | Units portate al tavolo col **buy-in**; salgono/scendono con win/lose; al cash-out tornano al wallet |

```text
Dealer run end (Exit con save / Game Over / cash-out meta)
  → wallet += earnFromDealerRun(SCORE, LEVEL, rounds, flags…)

Player enter
  → se wallet < minBuyIn → blocca con messaggio + “Play Dealer”
  → buy-in: wallet -= B; seatBankroll = B

Player exit / cash-out
  → wallet += seatBankroll residuo; seat = 0
```

**Regole fisse:**

1. **SCORE di sessione ≠ wallet.** Conversione solo a **fine run Dealer** (o checkpoint esplicito documentato), mai SCORE live copiato nel felt Player.  
2. **Autoplay non farma wallet** (`earned = 0`, o importo cosmetico trascurabile se un giorno serve demo — default **0**).  
3. **Training** (preset): moltiplicatore earn **ridotto** o configurabile; non deve essere la farm primaria.  
4. Formula `earnFromDealerRun` in **config JSON** (editabile; tarare in playtest). Ipotesi iniziale:

```text
earned = max(0, floor(SCORE * kScore) + LEVEL * kLevel + perfectStreakBonus)
// kScore / kLevel in config; SCORE negativo → earned 0 (niente debito wallet da SCORE)
```

5. High score **Dealer** (SCORE/LEVEL) e peak wallet / bankroll Player restano **metriche separate** in UI/export.

### 6bis.4 Loop runtime Player (v0.3)

```text
Mode Player (sbloccato in v0.3)
  → wallet check (minBuyIn)
  → Table Setup: variant, animation, dealer AI, (opz.) table limits
  → Buy-in dal wallet
  → PREPARE
  → BETTING_OPEN: tu (e opz. NPC companion) piazziate chip
  → BETTING_CLOSED: AI/timer
  → SPINNING: AI spin → SpinEngine
  → RESULT → PAYOUT auto (house/seat contabilità standard)
  → … ripeti …
  → Exit / cash-out → wallet aggiornato
```

| | Dealer | Player |
|--|--------|--------|
| Skill core | PAY mash, energia, LEVEL | Gestione bankroll e scelta bet |
| HUD principale | LEVEL \| ENERGY \| SCORE | **Bankroll seat** (+ wallet in pause/setup); badge PLAYER |
| Save/Exit | Save + Exit | Save sessione + Exit (proposta: sì entrambi) |
| Fallimento | ENERGY 0 → Game Over | Seat 0 → out dal tavolo; wallet può restare > 0 se non hai portato tutto |

**NPC companion al tavolo Player:** default **sì** (tavolo vivo, altri seat AI con bankroll proprio **non** prelevato dal wallet utente). Dettaglio taratura = config.

### 6bis.5 Riuso core (A1)

| Condiviso | Solo Player | Solo Dealer |
|-----------|-------------|-------------|
| Fasi, bets, SpinEngine, variant, session schema base | `placeBet` / `clearBets` / `buyIn` / `cashOut` | Coda PAY, energy, LEVEL curve, bonus PAYOUT |
| Cataloghi `bets-*.json` | Felt input umano | Felt sola lettura (chip NPC) |
| Persist export/import | Campo `wallet` nel save globale | SCORE run → hook `earnFromDealerRun` |

Presenter diverso (controlli felt vs bottone PAY); **dominio** resta puro TS.

### 6bis.6 Requisiti (priorità post-MVP)

| ID | Requisito | Priorità |
|----|-----------|----------|
| F-PLY-01 | Mode Player giocabile in v0.3; MVP solo “Coming soon” + teaser wallet/Dealer | P0-v0.3 / P0-MVP teaser |
| F-PLY-02 | Wallet meta persistente; export/import con il resto dei dati utente | P0-v0.3 |
| F-PLY-03 | Earn wallet solo da run **Dealer** (non Autoplay); formula in config | P0-v0.3 |
| F-PLY-04 | Buy-in da wallet; minBuyIn; cash-out restituisce seat → wallet | P0-v0.3 |
| F-PLY-05 | Puntate classiche complete EU/US; settle auto win/lose | P0-v0.3 |
| F-PLY-06 | AI croupier: close, spin; stesso SpinEngine/dealer | P0-v0.3 |
| F-PLY-07 | Wallet insufficiente → CTA Dealer, non soft-lock silenzioso | P0-v0.3 |
| F-PLY-08 | Units only; no moneta reale; local-first | P0 |
| F-PLY-09 | NPC companion opzionali al tavolo | P1 |
| F-PLY-10 | Table limits / max bet per preset | P1 |
| F-PLY-11 | Teaser in Mode Select MVP (“Earn units as Dealer”) | P1-MVP |

### 6bis.7 Fuori scope Player

Multiplayer · account · cash-out verso denaro reale · farm wallet da Autoplay · identificare SCORE live con bankroll Player · Player giocabile prima del vertical slice Dealer.

---

## 7. Dealer: identità, roster, stats, personalizzazione

### 7.1 Identità del personaggio (espandibile)

Il gioco **non** è limitato a umani realistici: è un titolo 8-bit.  
Si parte semplici e si lascia lo schema **aperto**.

| Campo | MVP | Note |
|-------|-----|------|
| `displayName` | Sì | Nome mostrato |
| `gender` | Sì | All’inizio: `male` \| `female`. Schema pronto ad altri valori |
| `kind` / `lineage` | Sì (default `human`) | Es. `human` ora; domani `android`, `foxfolk`, … senza rompere i save |
| `appearance` | P1 | Sprite/portrait key, palette |
| `stats` | Sì | Mestiere + signature |
| `signature` | Sì | Parametri derivati o espliciti di marcatura (offset, preferred sector, …) |
| `isPreset` | Sì | Dealer di default house |
| `isEditableCopy` | Sì | Preset clonati e poi editati dal player |

**Genere (MVP):**

- Valori iniziali: **Male**, **Female**.  
- UI e schema: stringa/enum **estendibile** (es. `non_binary`, `other`, `unspecified` in un secondo momento senza migrazione traumatica).  
- Nessun impatto su forza del RNG “per sessismo”: genere è **identità/cosmetica**, non un buff nascosto. Le differenze tra default nascono dalle **stats del preset**, non dal genere in sé.

**“Razza” / specie:**

- Non usare razze reali come stereotipo.  
- Campo `kind` (specie/lineage di fiction): default `human`; espandibile per personaggi non umani (tono da gioco).  
- Solo cosmetica + eventualmente lore; stats restano esplicite.

### 7.2 Stats di mestiere e di marcatura

Scala 1–10 (o interna 0–100).

| Stat | Ruolo |
|------|--------|
| **Spin Power** | Energia del lancio → giri medi, intensità show, input alla simulazione |
| **Release Style** | Famiglia di rilascio (enum + parametri): verso, offset tipico, flair |
| **Consistency** | Quanto la signature è stabile (marcatura più o meno leggibile) |
| **Table Pace** | Ritmo procedure (fasi, non il pocket) |
| **Chipcraft** | Destrezza fiches / payout (UI e futuro skill) |
| **Accuracy** | Errori di cassa se payout interattivo |
| **Call Clarity** | Chiarezza annunci UX |
| **Composure** | Stress con tavolo pieno / poco tempo; può aumentare noise se bassa |
| **Presence** | NPC, mance in units |
| **Stamina** | Calo effettivo stats su shift lunghi |

**MVP attive sul numero/simulazione:** `spinPower`, `releaseStyle`, `consistency` (+ noise).  
**MVP attive sul job:** `tablePace`, `composure`, `presence` (anche se effetti soft).

Parametri signature (espliciti o derivati da style):

```json
"signature": {
  "releaseFamily": "snap_clockwise",
  "preferredSectorIndex": 4,
  "sectorWidthPockets": 5,
  "biasStrength": 0.15
}
```

`biasStrength` effettiva ∝ `consistency` (clamp).

### 7.3 Cosa fanno / non fanno le stats

| Fanno | Non fanno |
|-------|-----------|
| Modulano dinamica di lancio e marcatura statistica | Fissare il prossimo numero a comando |
| Cambiano feel di dealer diversi | Azzerare probabilità di alcuni pocket |
| Interagiscono con noise e fatica | Superare clamp di fairness del modello |
| Spiegano differenze tra preset | Buff nascosti legati solo a gender/kind |

### 7.4 Flusso di selezione dealer (UI)

```
[ Choose dealer ]
  ├── Default roster (house) → select → optional "Customize" (clone + edit)
  ├── Create custom → gender/kind (MVP: male/female, human) + name + stats
  ├── [ Random ] → genera dealer valido → confirm / play
  └── [ Dealer Gym ] → inserisci sequenza numeri → fit signature → applica al dealer
```

| ID | Requisito | Priorità |
|----|-----------|----------|
| F-DLRCHAR-01 | Sessione referenzia sempre un dealer completo | P0 |
| F-DLRCHAR-02 | Elenco **dealer di default** selezionabili | P0 |
| F-DLRCHAR-03 | Default con stats **prefissate** e signature coerente | P0 |
| F-DLRCHAR-04 | **Customize**: partendo da default o da zero, nome + gender + stats (+ signature derivata) | P0 |
| F-DLRCHAR-05 | Pulsante **Random**: crea dealer casuale (nome da pool i18n, gender MVP random male/female, stats entro budget, signature random soft) e permette Play subito | P0 |
| F-DLRCHAR-06 | Random può essere “reroll” prima di confermare | P0 |
| F-DLRCHAR-07 | Custom, random e risultati Gym salvabili nel roster locale | P0 |
| F-DLRCHAR-08 | Schema `gender` + `kind` estendibile; MVP solo male/female + human | P0 |
| F-DLRCHAR-09 | Portrait/sprite per gender MVP (P1 se asset non pronti: placeholder colore) | P1 |
| F-DLRCHAR-10 | Export roster nel full JSON export | P0 |
| F-DLRCHAR-11 | UI spiega che Spin Power / Style / Consistency influenzano la marcatura del lancio | P0 |
| F-DLRCHAR-12 | Budget punti per custom (bilanciamento) | P0 |
| F-DLRCHAR-13 | Voce **Dealer Gym** nel flusso di personalizzazione/selezione dealer | P0 |

### 7.5 Dealer di default (proposta house roster)

Valori indicativi — da bilanciare in playtest. Genere = identità; le stats sono del personaggio.

| ID | Name | Gender | Archetipo | Spin Power | Consistency | Pace | Composure | Presence | Signature feel |
|----|------|--------|-----------|------------|-------------|------|-----------|----------|----------------|
| `house-riley` | Riley | female | Balanced | 5 | 5 | 5 | 5 | 5 | Soft, quasi neutra |
| `house-marco` | Marco | male | Power spinner | 8 | 6 | 4 | 5 | 4 | Lanci lunghi, settore un po’ più marcato |
| `house-aya` | Aya | female | Precision | 4 | 9 | 5 | 6 | 5 | Marcatura più leggibile, power moderato |
| `house-devon` | Devon | male | Rush specialist | 6 | 4 | 9 | 7 | 5 | Veloce di procedura, signature più “rumorosa” |
| `house-sam` | Sam | female | People person | 5 | 5 | 6 | 5 | 9 | Neutra sulla ruota, forte sui NPC |

Tutti **personalizzabili**: “Customize” crea una **copia** editabile (il preset house resta intatto).

### 7.6 Random dealer

Al click **Random**:

1. `gender` ∈ { male, female } (MVP; poi esteso).  
2. `kind` = `human` (MVP).  
3. `displayName` da liste EN/IT separate per genere o unisex + eventuale suffisso.  
4. Stats estratte in modo valido (rispettano min/max e points budget).  
5. `releaseStyle` / signature center casuali entro range soft.  
6. Mostra scheda → **Reroll** / **Edit** / **Play**.

Obiettivo: chi si annoia arriva in partita in **pochi secondi**.

### 7.7 Allocazione punti custom (proposta)

```
pointsBudget = 30
stats numeriche MVP: spinPower, consistency, tablePace, composure, presence
min 1, max 10, sum <= 30
releaseStyle = enum cosmetico+fisico a costo 0 (scelta elenco)
signature center derivato da style o slider advanced (P1)
```

### 7.8 Dealer Gym (“palestra dealer”)

#### 7.8.1 Idea

**Dealer Gym** è un’opzione di personalizzazione/allenamento del personaggio dealer.

Il giocatore può inserire una **sequenza di numeri usciti** (tipicamente gli **ultimi 12**, lunghezza configurabile) osservati su una **roulette live sul web** (o qualsiasi altra fonte).  
Il gioco **non si collega** a casinò live e **non scarica** risultati da terze parti: l’utente **digita o incolla** i numeri a mano.

A partire da quella sequenza, un modulo locale (**Signature Fitter**) **deduce / stima** i parametri del nostro SpinEngine (marcatura, consistency, indizi su spin power / release family) e li **applica** al dealer in allenamento — così il personaggio “impara” uno stile coerente con quella serie, restando stocastico nei lanci futuri.

#### 7.8.2 Scopo di gioco (cosa è / cosa non è)

| È | Non è |
|---|--------|
| Tool di **roleplay / sim** per dare una marcatura “ispirata” a una serie reale | Un sistema di predizione del prossimo numero live |
| Fit **locale** di parametri del **nostro** modello di gioco | Scraping, API o overlay su siti di casinò |
| Intrattenimento in **units** | Strumento di advantage play o garanzia di vincita |
| Input manuale sotto controllo dell’utente | Trattamento di account o stream di terze parti |

**Disclaimer obbligatorio (i18n)** in schermata Gym:

> Entertainment only. Numbers you enter are used only on your device to train a fictional dealer signature in BitCroupier. This does not predict live casino outcomes and does not connect to any real casino.

Allineato a `devLaw.md`: nessun invio dei numeri a server, nessun tracking.

#### 7.8.3 Flusso UX

```
Dealer select / Customize
  → [ Dealer Gym ]
  → Scegli dealer target (copia se preset house)
  → Inserisci sequenza (default 12 numeri, ordine: oldest→newest o newest→oldest, esplicitato in UI)
  → [ Train / Fit ]
  → Anteprima: stats/signature proposte + “confidence” del fit + mini-istogramma sequenza
  → [ Apply to dealer ] / [ Discard ] / [ Adjust sliders manualmente ]
  → Torna a scheda dealer o Play
```

Input UX:

- 12 campi numerici (0–36 europea) **oppure** un campo testo tipo `17, 0, 32, 15, …` con parse e validazione.
- Pulsante **Clear**, **Paste**, esempi di formato.
- Lunghezza: default **12**; range ammesso es. **8–37** (P1: preset “last 12 / last 24”).
- Variante tavolo: allineata a `tableVariant` del dealer/sessione — **european** (0–36) o **american** (0, 00, 1–36).

#### 7.8.4 Cosa viene dedotto (Signature Fitter)

Obiettivo: mappare la sequenza osservata → parametri **interni al gioco**, non “indovinare il croupier vero”.

| Segnale dalla sequenza (12+ numeri) | Parametro stimato (proposta) |
|-------------------------------------|------------------------------|
| Concentrazione su settori della ruota (ordine europeo, non ordine layout) | `signature.preferredSectorIndex`, `sectorWidthPockets` |
| Quanto è stretta la concentrazione vs sparpagliamento | `consistency` / `biasStrength` |
| Alternanza / salti medi tra pocket consecutivi (distanza sulla ruota) | Indizio su `spinPower` / energia media (euristica soft) |
| Verso dominante dei salti angolari (CW vs CCW sul ring) | `releaseStyle` / famiglia di rilascio |
| Troppa uniformità o caos | Fit “quasi neutro” + **low confidence** |

**Confidence score (0–1 o %):** con soli 12 campioni l’inferenza è **debole** per natura. La UI deve dirlo chiaramente (“Low sample size — signature will be soft”).

Algoritmo (direzione implementativa, non vincolo matematico unico):

1. Mappa ogni numero → indice angolare sull’ordine **ruota europea**.  
2. Stima densità per settore (kernel / bin circolari).  
3. Trova settore di moda + ampiezza.  
4. Misura dispersione → consistency.  
5. Analizza step circolari consecutivi → spinPower e release family euristici.  
6. Applica **clamp** di fairness (stessi limiti del SpinEngine: nessun pocket a p≈0/1).  
7. Opzionale: blend con stats attuali del dealer (`mix = 0.6 fit + 0.4 current`) per non resettare del tutto Presence/Pace se l’utente sta solo “allenando la mano”.

**Policy Apply (proposta MVP):**

- Aggiorna: `signature.*`, `consistency`, `spinPower` (soft), `releaseStyle`.  
- Non tocca (salvo toggle “full retrain”): `presence`, `tablePace`, `gender`, `name`, cosmetici.  
- Sempre su **copia** se si parte da preset house.

#### 7.8.5 Persistenza Gym

| Dato | Dove |
|------|------|
| Ultima sequenza usata (opzionale) | Solo locale, se l’utente abilita “remember last sequence” (default **off** per privacy comfort) |
| Risultato fit applicato | Dentro `dealer.signature` + stats |
| Log allenamento | `dealer.gymHistory[]` opzionale: timestamp, nSamples, confidence, **non** necessariamente i numeri grezzi |

Export JSON: se i numeri grezzi sono salvati, restano **solo nel file locale dell’utente**.

#### 7.8.6 Requisiti Dealer Gym

| ID | Requisito | Priorità |
|----|-----------|----------|
| F-GYM-01 | Voce di menu **Dealer Gym** accessibile da personalizzazione dealer | P0 |
| F-GYM-02 | Input sequenza validata rispetto a `tableVariant` (EU 0–36; US 0/00/1–36), default lunghezza 12 | P0 |
| F-GYM-03 | Nessuna connessione automatica a roulette live / nessun scraping | P0 |
| F-GYM-04 | Fit locale → proposta signature + stats correlate | P0 |
| F-GYM-05 | Anteprima prima di Apply; possibilità di scartare | P0 |
| F-GYM-06 | Disclaimer entertainment + “does not predict live results” | P0 |
| F-GYM-07 | Confidence / avviso sample size basso | P0 |
| F-GYM-08 | Clamp fairness allineati allo SpinEngine | P0 |
| F-GYM-09 | Apply non corrompe preset house (lavora su clone) | P0 |
| F-GYM-10 | i18n completa schermata Gym | P0 |
| F-GYM-11 | Lunghezze sequenza diverse (8–24+) | P1 |
| F-GYM-12 | Mix fit vs stats esistenti (slider “how strongly to train”) | P1 |
| F-GYM-13 | Import sequenza da piccolo JSON/CSV locale scelto dall’utente | P1 |
| F-GYM-14 | Mini-simulazione “100 spins with new signature” histogram post-fit | P1 |
| F-GYM-15 | Supporto sequenze american (`00`) quando variant = american | P0 |
| F-GYM-16 | Gym usabile anche in Autoplay (allena house demo dealer clone) | P1 |

#### 7.8.7 Privacy e devLaw

- Input e fit **solo device**.  
- No analytics sulle sequenze inserite.  
- Default: non ricordare la sequenza dopo Apply.  
- Export esplicito solo se l’utente esporta i propri dati.

#### 7.8.8 Priorità di rilascio

| Priorità | Motivazione |
|----------|-------------|
| **P0 funzionale** se si vuole la feature “firma” del prodotto personalizzazione | Differenzia BitCroupier |
| **P1 accettabile** se l’MVP deve prima chiudere SpinEngine + roster + ruota | Gym dipende dal fitter allineato al modello di spin |

**Proposta roadmap:** scheletro UI + fitter euristico in **MVP o subito dopo** lo SpinEngine (senza Gym il fit non ha senso); non bloccare il primo prototipo ruota se il fitter non è pronto — ma tenere lo slot menu “Dealer Gym”.

---

## 8. Lingua e units

- Default language: **English**; multilingua all’avvio.  
- Economia: **units** only (SCORE house, wallet meta, seat bankroll Player — tre usi, una moneta astratta).  
- **Wallet** e progressione meta: solo storage locale + export/import (`devLaw.md`); vedi §6bis.

---

## 9. Sessioni e persistenza

Oltre a settings / autosave / session file / full export, la session include dealer completo + game params.  
Il **wallet meta** vive nel **full data export** (profilo utente locale), non solo nella singola session run — così sopravvive a Game Over e cambio mode (§6bis.3).

```json
{
  "schemaVersion": 1,
  "type": "session",
  "locale": "en",
  "mode": "dealer",
  "autoplay": false,
  "gameParams": {
    "tableVariant": "european",
    "playerCount": 4,
    "interSpinSeconds": 35,
    "spinDurationSeconds": 8,
    "wheelAnimationEnabled": true
  },
  "dealer": {
    "id": "house-aya",
    "displayName": "Aya",
    "gender": "female",
    "kind": "human",
    "isPreset": true,
    "stats": {
      "spinPower": 4,
      "consistency": 9,
      "tablePace": 5,
      "composure": 6,
      "presence": 5,
      "chipcraft": 5,
      "accuracy": 7,
      "callClarity": 6,
      "stamina": 5
    },
    "releaseStyle": "soft_counter",
    "signature": {
      "preferredSectorIndex": 2,
      "sectorWidthPockets": 4,
      "biasStrength": 0.18
    }
  },
  "spinEngine": {
    "model": "initial_conditions_v1",
    "lastSeed": null
  },
  "table": { "phase": "BETTING_OPEN", "roundIndex": 3 },
  "seats": []
}
```

---

## 10. Domain model

| Entità | Descrizione |
|--------|-------------|
| **DealerCharacter** | Identità + stats + signature |
| **SpinEngine** | Simulazione stocastica condizioni→pocket |
| **WheelPresenter** | Render del piano di spin o instant |
| **GameParams / Level** | Players, time, animation flag |
| **Table / Seat / Bet / Session** | Stato tavolo e save |
| **UserWallet** | Units meta persistenti; earn da Dealer; buy-in Player (§6bis) |

Fasi round: invariate; `SPINNING` usa SpinEngine (+ presenter se ON).  
Ruolo sessione: `mode ∈ { dealer, player, autoplay }` cambia comandi ammessi (PAY mash vs placeBet), non le regole pocket.

---

## 11. Boot flow

```
Language (default EN)
  → Mode: Dealer | Player🔒 (MVP) | Autoplay
  → Dealer Hub: Default | Customize | Random | Dealer Gym
  → Table Setup:
        tableVariant (EU default | US)
        difficulty preset (Training…Rush | Custom)
        → implica: energy max/start, chipValue base, payTime base,
                   players, interSpin, startLevel, maxLevel, bonus rate…
        wheelAnimation ON/OFF
  → Session: New | Continue | Load JSON
  → Game Table
        HUD: LEVEL (n°) | ENERGY | SCORE
        loop: BET → CLOSE → SPIN → RESULT → PAYOUT (+ bonus roll) → …
        fine run Dealer → wallet += earn(...)   // meta; anche se Player locked in MVP

v0.3 Player (dopo Mode Player sbloccato):
  → wallet check → buy-in → Game Table (felt input, AI croupier, settle auto)
  → cash-out → wallet
```

---

## 12. Requisiti P0 (checklist allineata al canone)

### Core tavolo
- [ ] SpinEngine stocastico + marcatura dealer; clamp probabilità  
- [ ] tableVariant EU/US (default EU) su ruota, felt, payout  
- [ ] Wheel animation ON/OFF, stesso esito  
- [ ] Fasi round complete  

### Skill PAY / energia / level / bonus
- [ ] PAY modello **C** (chipValue; min(chip, remaining))  
- [ ] Coda seat vincenti; lose auto-settled  
- [ ] Pay timer; non riparte il loop finché PAYOUT risolto  
- [ ] ENERGY −1 su timeout unpaid **e** overpay; GO a 0 (Dealer only)  
- [ ] LEVEL numerico arcade + salita in run (cap preset)  
- [ ] Challenge strip LEVEL | ENERGY | SCORE  
- [ ] Bonus roll a PAYOUT (almeno PAY_ONE, +TIME o BIG_CHIP, +ENERGY o SHIELD)  

### Modes & meta
- [ ] Dealer giocabile  
- [ ] Autoplay: AI close/spin/PAY visibili; no GO; badge DEMO  
- [ ] Player locked “Coming soon” (+ teaser earn-as-Dealer opzionale)  
- [ ] Units ovunque; no moneta reale  
- [ ] *(v0.3)* Wallet meta + Player giocabile (§6bis) — **non** day-one  

### Dealer & data
- [ ] Roster default + custom + random  
- [ ] Dealer Gym (fit locale) **o** esplicitamente “P0-late” se si slitta dopo SpinEngine — *ancora da chiudere in §16*  
- [ ] Session JSON + export/import; PWA offline; no analytics  
- [ ] i18n EN default  

---

## 13. Stack e architettura (dominio vs presentazione)

### 13.1 Regola A1 — core indipendente dal framework 8-bit (**canone**)

La **maggior parte del codice** deve vivere fuori da qualsiasi game framework / renderer (Phaser, Pixi, LittleJS, Canvas “grezzo”, DOM, ecc.).  
Motivo: il framework è intercambiabile; le regole del tavolo no.

| Layer | Contenuto | Dipendenze ammesse |
|-------|-----------|--------------------|
| **Domain / `core/`** | Fasi round, resolve bet, coda PAY, energy, LEVEL, bonus, SCORE, comandi sessione | TypeScript puro; **zero** import da game framework o DOM |
| **Spin / `spin/`** | `spin(dealer, tableVariant, rng) → { winningNumber, spinPlan, debug? }` | TS + `wheel-spin.json`; **nessun** tween/scene del framework |
| **NPC / bilanciamento** | Scelte AI, preset, `amountDue`; lettura config | TS + JSON config |
| **Persist / `persist/`** | Session schema, export/import JSON, localStorage / IndexedDB | Web Storage API ok; **non** API di un game engine |
| **Config load** | Validazione `schemaVersion`, clamp/fallback | fetch o import statico |
| **Presenter / `ui/` + `wheel/`** | Felt, HUD, menu, animazione ruota da `spinPlan`, juice, audio stub | Qui può vivere Canvas / DOM / Phaser / Pixi / … |
| **Input adapter** | Tasti/click → comandi core (`closeBets`, `spin`, `pay`, …) | Framework; la mappa **fase → azione primaria** resta nel core / `controls.json` |
| **Autoplay driver** | Sequenza close/spin/pay **come comandi sul core** (tap visibili solo in UI) | Logica “quando” può stare in TS; animazioni solo nel presenter |

**Contratto minimo (senza over-engineering):**

```text
GameSession / core
  ← comandi: closeBets | spin | pay | pause | …
  → eventi / stato: phaseChanged | spinResolved | payProgress | energyChanged | gameOver | …

Presenter (framework)
  ascolta stato/eventi → aggiorna schermo
  input utente → invoca comandi sul core
```

**Vietato:**

- Logica PAY, timer di energia, resolve bet o scelta pocket dentro `Scene.update` / tween / collisione del framework  
- Far dipendere SpinEngine da un’animazione (l’animazione **consuma** `spinPlan`; non produce l’esito)  
- Un “IGameEngine” monolitico con decine di metodi al day-one — bastano confini di cartella e dipendenze monodirezionali (`ui` → `core`, mai il contrario)

**Cambio framework in futuro:** si riscrive `ui/` / `wheel/` (e binding input/audio); `core/`, `spin/`, `persist/`, `config/` restano.

### 13.2 Layout cartelle (proposta)

```
TypeScript + Vite
  ├── config/        *.json + README.md (documentazione config)  — puro dato
  ├── core/          rules, bets, phases, payout queue, energy, level curve, bonus  — PURO
  ├── spin/          SpinEngine (signature + noise)  — PURO
  ├── characters/    roster, presets, randomizer  — puro dove possibile
  ├── autoplay/      driver comandi sul core (close, spin, pay)  — pure-ish
  ├── persist/       session + export JSON  — Web Storage, no game lib
  ├── gym/           Signature Fitter  — puro (fit locale)
  ├── ui/            menus, hub, setup, i18n, challenge strip  — PRESENTAZIONE
  └── wheel/         presenter ruota (Canvas o altro)  — PRESENTAZIONE
```

**Config:** leggere i JSON all’avvio; validare `schemaVersion` e range; override Custom solo entro `customRanges`.  
**MVP presenter (I5):** Canvas wheel + DOM UI di default; restano **sostituibili** grazie ad A1.

---

## 14. Criteri di accettazione MVP (canone)

1. Mode Dealer e **Autoplay** giocabili; Player locked.  
2. Loop completo con **PAY** multi-tap a fiches e pay timer.  
3. ENERGY: fail timeout → −1; a 0 Game Over (solo Dealer); Autoplay senza GO.  
4. LEVEL numerico visibile e che sale; strip screenshot con SCORE.  
5. Almeno un bonus casuale osservabile (Dealer e Autoplay).  
6. EU default; US selezionabile; animation ON/OFF coerente.  
7. Units only; session save/load; offline-first; no tracking.  
8. Due dealer con marcatura distinta (smoke test distribuzione).  
9. *(Gym: se in MVP)* fit 12 numeri locale + disclaimer.  

---

## 15. Roadmap

| Fase | Contenuto |
|------|-----------|
| **MVP** | Canone §0: spin, PAY C, energy, LEVEL n°, bonus base, Autoplay, EU/US, dealers, session, PWA; Player **locked** + teaser opzionale |
| **MVP-late / v0.2** | Gym avanzata, bonus catalogo pieno, portrait, bilanciamento fine; hook save `wallet` (anche se Player ancora locked) |
| **v0.3** | **Player mode** giocabile: wallet ← Dealer, buy-in, felt classico EU/US, AI croupier (§6bis) |
| **v1.x** | Meta unlock extra, specie, polish |

---

## 16. Decisioni — chiuse vs ancora da chiudere insieme

### 16.1 Già chiuse (non ridiscutere salvo cambio esplicito)

Vedi **§0 Decisioni ufficiali**.

### 16.2 Bloccanti B1–B7 — **tutti chiusi**

| # | Tema | Stato / file |
|---|------|----------------|
| **B1** | Tutte le puntate standard | CHIUSO — §5.0 |
| **B2** | Solo vincita + overpay −energy | CHIUSO — §0, §5.2 |
| **B3** | Preset numerici | CHIUSO — `config/game-balance.json` |
| **B4** | Level-up | CHIUSO — stesso file |
| **B5** | SpinEngine A | CHIUSO — `config/wheel-spin.json` |
| **B6** | NPC AI | CHIUSO — `config/npc-ai.json` |
| **B7** | Close/Spin/PAY input | CHIUSO — `config/controls.json` |
| **A1** | Core indipendente dal framework 8-bit | CHIUSO — §0, §13.1 |
| **P1** | Player design + loop wallet Dealer→Player | CHIUSO design — §0, **§6bis**; implementazione v0.3 |
| **N1** | Nome prodotto | CHIUSO — **BitCroupier** + tagline *Roulette from both sides of the table* (§0) |

Documentazione config: **`config/README.md`**.

### 16.3 Importanti non bloccanti al day-one

| # | Tema | Default provvisorio |
|---|------|---------------------|
| I1 | Bonus % drop e set esatto | ~20%; PAY_ONE, +TIME, +1 ENERGY |
| I2 | NPC a 0 units | Leave dopo round |
| I3 | High score solo Dealer | Sì (wallet/Player metriche separate) |
| I4 | Cambio variant in-session | Solo New Game |
| I5 | Presenter MVP (Canvas vs Phaser, …) | Canvas wheel + DOM UI; **sostituibile** grazie ad A1 |
| I6 | Gym in primo MVP | Sì UI; fitter minimo |
| I7 | Stats dealer → pay timer | Solo signature+power su spin in MVP; pace su timer = P1 |
| I8 | Seconda lingua | IT strutturata |
| I9 | Coefficienti `earnFromDealerRun` (kScore, kLevel) | Tarare in config a playtest v0.3 |
| I10 | NPC companion al tavolo Player | Sì di default (§6bis.4) |
| I11 | minBuyIn / table limits Player | Config; es. minBuyIn 50 u |

### 16.4 Esplicitamente fuori MVP

**Implementazione** Player mode giocabile · multi-chip choice in Dealer PAY · meta carriera piena oltre wallet · multiplayer · Heat parallelo  

*(Il **design** Player + wallet è in canone §6bis; non si implementa nel day-one.)*

---

## 17. Riferimenti

| Documento | Ruolo |
|-----------|--------|
| `checkpoint.md` | **Ingresso LLM/dev** — ordine lettura, stato, next steps |
| `devLaw.md` | Privacy / local-first |
| `8bitFramework.md` | Opzioni 8-bit |
| `croupier simulator.md` | Contesto croupier |
| `UI_USE_CASES.md` | Flusso di gioco, wireframe UI, use case |
| `config/game-balance.json` | Preset, pay timer, level-up, bonus rate (editabile) |
| `config/wheel-spin.json` | SpinEngine A: pocket order, sim params, maxBias |
| `config/npc-ai.json` | Bankroll, stake, profili, pesi bet, leave when broke |
| `config/controls.json` | Close/Spin/PAY Dealer vs Autoplay; tastiera |
| `config/README.md` | **Documentazione di tutti i JSON di config** |
| `config/bets-european.json` | Catalogo tecnico puntate EU |
| `config/bets-american.json` | Catalogo tecnico puntate US |
| `sound.md` | Musica e SFX per fasi/azioni; nomi file canonici (asset da produrre) |
| `fx.md` | Effetti visivi per azioni; sync con audio; juice 8-bit |
| §6bis (questo file) | **Player mode** + wallet meta + loop autoalimentato Dealer→Player |

---

## 18. Glossario

| Termine | Significato |
|---------|-------------|
| **SpinEngine** | Motore che da dealer+noise calcola pocket e piano di spin |
| **Signature / marcatura** | Tendenza statistica di un dealer sul lungo periodo |
| **Consistency** | Stabilità della marcatura |
| **Initial conditions** | Velocità/angoli di partenza del lancio simulato |
| **Random dealer** | Generazione one-click di un personaggio valido |
| **Dealer Gym** | Palestra: allena la marcatura da una sequenza di numeri inserita dall’utente |
| **Signature Fitter** | Algoritmo locale sequenza → parametri dealer |
| **Kind** | Specie/lineage fiction (default human, espandibile) |
| **tableVariant** | Tipo tavolo/ruota: european (default) o american |
| **European** | 37 tasche, singolo 0 |
| **American** | 38 tasche, 0 e 00 |
| **Dealer energy** | “Vite” del dealer: resistenza ai fail di payout; a 0 = game over |
| **LEVEL (HUD)** | Numero arcade (1, 2, 3…) in run; accanto a ENERGY |
| **Difficulty preset** | Curva pre-partita (non è il numero LEVEL) |
| **Heat** | Bozza ritirata in MVP — non usare |
| **Pay time** | Finestra per completare tutti i PAY del round |
| **Units** | Moneta astratta di gioco / SCORE house |
| **A1 / core puro** | Dominio e SpinEngine senza dipendenze dal framework di rendering; UI = shell intercambiabile |
| **Wallet meta** | Units persistenti guadagnate da run **Dealer**; uniche che finanziano buy-in **Player** |
| **Player mode** | Cliente al tavolo: puntate classiche; richiede wallet da Dealer (§6bis) |
| **Loop autoalimentato** | Dealer → wallet → Player → (broke) → di nuovo Dealer |
| **BitCroupier** | Nome prodotto ufficiale; tagline *both sides of the table* = Dealer + Player |
| **RouletteLife** | Codename / path repo legacy; non è il brand di release |

---

## Cronologia

| Versione | Data | Note |
|----------|------|------|
| 0.1–0.4 | 2026-08-05 | Dual mode, units, ruota, levels, Autoplay, animation flag, dealer stats “no RNG bias” |
| 0.5 | 2026-08-05 | Esito stocastico guidato da dealer; roster; Random; SpinEngine |
| 0.6 | 2026-08-05 | **Dealer Gym**: input ultimi N numeri (default 12), fit locale signature, no live scrape, disclaimer, requisiti F-GYM-* |
| 0.7 | 2026-08-05 | **tableVariant** European (default) / American: ruota, felt, payout, SpinEngine, Gym, settings + setup |
| 0.8 | 2026-08-05 | House score (units=punti), log numeri sessione, payout automatico dettagliato, dove sta la difficoltà |
| 0.9 | 2026-08-05 | PAY mash skill, coda, timer, Lives, Game Over |
| 0.10 | 2026-08-05 | Vite = **energia dealer**; difficoltà = energia + tempo pagamento + carico/players + inter-spin |
| 0.11 | 2026-08-05 | Modelli PAY A/B/C; **C a fiches/units**; legame difficoltà e progressione |
| 0.12 | 2026-08-05 | Avanzamento: preset fisso (MVP) vs Heat in-run (P1); principio “più complicato, non impossibile” |
| 0.13 | 2026-08-05 | HUD LEVEL accanto a ENERGY (screenshot / sfide) |
| 0.14 | 2026-08-05 | LEVEL numerico arcade; energia solo su fail; bonus PAY intro |
| 0.15 | 2026-08-05 | Bonus: auto-pay 1+ NPC, recupero energia, catalogo tipi/rarità, speranza di run più lunghe |
| 0.16 | 2026-08-05 | **Autoplay** riaffermato MVP: stesso sim, AI su PAY/spin, no game over, bonus/LEVEL visibili |
| 0.17 | 2026-08-05 | **Allineamento canone**: §0; LEVEL; checklist; bloccanti B1–B7 |
| 0.18 | 2026-08-05 | **B1 CHIUSO**: tutte le puntate standard inside+outside EU/US; call bets P1 |
| 0.19 | 2026-08-05 | **B2 CHIUSO**: PAY = solo vincita; clicks evidenti; overpay = −1 ENERGY |
| 0.20 | 2026-08-05 | **B3+B4 CHIUSI**: preset/level-up in `config/game-balance.json` |
| 0.21 | 2026-08-05 | **B5 CHIUSO**: SpinEngine initial_conditions_v1 + `config/wheel-spin.json` |
| 0.22 | 2026-08-05 | **B6 CHIUSO**: NPC AI + `config/npc-ai.json` |
| 0.23 | 2026-08-05 | **B7 CHIUSO** + documentazione completa `config/README.md` |
| 0.24 | 2026-08-05 | Aggiunti `sound.md` e `fx.md` (audio + VFX coinvolgimento) |
| 0.25 | 2026-08-05 | HUD in partita: Save+Exit (Dealer); solo Exit (Autoplay) |
| 0.26 | 2026-08-05 | Cataloghi `bets-european.json` + `bets-american.json` |
| 0.27 | 2026-08-05 | Aggiunto `checkpoint.md` per ripresa contesto LLM/dev |
| 0.28 | 2026-08-06 | **A1 CHIUSO**: dominio indipendente dal framework 8-bit; dettaglio §13.1; riga canone §0 |
| 0.29 | 2026-08-06 | **P1 CHIUSO (design)**: Player classico + wallet da Dealer; loop autoalimentato; §6bis |
| 0.30 | 2026-08-06 | **Nome prodotto:** BitCroupier — *Roulette from both sides of the table* (ex codename RouletteLife) |
