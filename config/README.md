# BitCroupier — Configurazione JSON

*(Codename repo: RouletteLife.)*

Tutti i bilanciamenti e le regole “da tarare” vivono qui, **fuori dal codice di gioco**.  
Modificare questi file (e ricaricare l’app) deve bastare per ritoccare difficoltà, AI, ruota e input **senza** riscrivere la logica.

**Canone di prodotto:** `../REQUISITI.md` §0.  
**Audio / VFX (coinvolgimento):** `../sound.md` · `../fx.md` (nomi file e effetti; asset da produrre).  

In caso di conflitto tra commenti qui e il canone, **vince REQUISITI** finché non aggiorni entrambi.

---

## Indice file

| File | Ruolo | Chiave di decisione design |
|------|--------|----------------------------|
| [`game-balance.json`](./game-balance.json) | Preset difficoltà, pay timer, LEVEL, energia, bonus rate, custom ranges | B3, B4 |
| [`wheel-spin.json`](./wheel-spin.json) | SpinEngine Opzione A: pocket EU/US, fisica/sim, marcatura | B5 |
| [`npc-ai.json`](./npc-ai.json) | Bankroll, stake, profili, pesi puntate, leave when broke | B6 |
| [`controls.json`](./controls.json) | Close bets / Spin / PAY manuali vs auto; Autoplay AI; tastiera | B7 |
| [`bets-european.json`](./bets-european.json) | Catalogo tecnico **tutte** le puntate EU + multiplier | B1, B2 |
| [`bets-american.json`](./bets-american.json) | Catalogo tecnico **tutte** le puntate US (incl. 00, five-number) | B1, B2 |
| [`_generate-bets.js`](./_generate-bets.js) | Rigenera i due cataloghi bet (dev tool) | — |

---

## Convenzioni comuni

### `schemaVersion`

Intero monotono. A ogni breaking change del formato:

1. Incrementa `schemaVersion`
2. Aggiorna il loader (migrazione o messaggio di errore chiaro)
3. Aggiorna questa README

### Commenti

Campi `"comment"` / `"$schemaComment"` sono **solo documentazione** per umani; il runtime li ignora.

### Validazione (requisito implementativo)

All’avvio il gioco deve:

1. Caricare ogni file
2. Verificare `schemaVersion` supportata
3. Clampare valori fuori range (o rifiutare con errore dev)
4. Non crashare in produzione per un typo: fallback ai default embeddati se possibile + log

### Dove vivono a runtime

Proposta build:

- Sorgente: `config/*.json` (repo)
- Copia in bundle / `public/config/` per fetch o import statico Vite

Non committare segreti: questi file sono **pubblici** nel client.

---

## 1. `game-balance.json`

### Scopo

Definisce **quanto è dura** la sessione e come sale il **LEVEL**, senza toccare le regole della roulette.

### Decisioni collegate

- **B3** — numeri dei preset  
- **B4** — level-up  
- Contabilità PAY (solo vincita, overpay) — flag in `accounting`  
- Rate bonus per preset  

### Sezioni principali

| Sezione | Contenuto |
|---------|-----------|
| `accounting` | `payWinningsOnly`, penalità energia timeout/overpay |
| `payTime` | `minSeconds`, bonus secondi per tap previsto |
| `chipDenominationsAllowed` | Tagli fiche ammessi (es. 5, 10, 25, 50) |
| `levelUpEffects` | Rotazione effetti soft a ogni +1 LEVEL |
| `bonusRoll` | Bonus on/off di default, max uno per PAYOUT |
| `customRanges` | Min/max per Custom difficulty |
| `presets` | `training`, `standard`, `busy`, `rush` |
| `defaultPresetId` | Di solito `"standard"` |
| `tableVariantDefault` | `"european"` |

### Campi tipici di un preset

| Campo | Significato |
|-------|-------------|
| `playerCount` | NPC al tavolo |
| `interSpinSeconds` | Finestra BETTING_OPEN |
| `payTimeBaseSeconds` | Base timer PAY (poi formula con tap) |
| `chipValue` | Units per un click PAY |
| `energyStart` / `energyMax` | Energia dealer |
| `startLevel` / `maxLevel` | LEVEL arcade |
| `roundsPerLevelUp` | Ogni quanti round +1 LEVEL |
| `bonusChance` | Probabilità 0–1 di un bonus a inizio PAYOUT |

### Formula pay time (ufficiale)

```text
payTime = max(payTime.minSeconds,
              payTimeBaseSeconds + tapBonusSecondsPerTap * expectedTaps)
```

### Come modificarlo in sicurezza

1. Cambia un preset alla volta  
2. Playtest 10–20 round  
3. Non scendere sotto `customRanges` / min globali (es. pay time &lt; 4s) senza playtest  

---

## 2. `wheel-spin.json`

### Scopo

**SpinEngine v1 (Opzione A):** condizioni iniziali + simulazione → numero vincente + piano animazione.

### Decisioni collegate

- **B5** — initial_conditions_v1  
- Variant EU/US  
- Marcatura dealer (soft)  

### Sezioni principali

| Sezione | Contenuto |
|---------|-----------|
| `engine` | Deve essere `"initial_conditions_v1"` per il path prodotto |
| `rules` | Vincoli: stesso esito ON/OFF anim, no p=0/1, difficulty non tocca pocket |
| `maxBiasStrength` | Cap marcatura (default 0.2) |
| `variants.european` / `american` | `pockets[]` in ordine ruota, colori |
| `simulation` | Range velocità, decel, noise vs consistency, stili rilascio |
| `animation` | Durata default show, match trajectory |
| `api` | Contratto `spin(dealer, tableVariant, rng)` |

### Pocket ID

Sempre **stringhe**: `"0"`, `"00"`, `"1"` … `"36"`.  
Mai confondere `0` e `00`.

### Dealer → sim

| Input dealer | Uso tipico in sim |
|--------------|-------------------|
| `spinPower` | Velocità iniziale pallina |
| `consistency` | Meno noise su angolo/scatter |
| `releaseStyle` | Offset base da `releaseStyleOffsetRadians.styles` |

### Come tarare la marcatura

1. Alza `consistency` su un dealer di test  
2. Lancia N spin, guarda istogramma settori  
3. Se troppo prevedibile: alza noise / abbassa `maxBiasStrength`  
4. Se indistinguibile da uniforme: riduci noise a consistency alta  

**Non** usare questo file per “far vincere la house” in modo nascosto: la house edge resta nelle **regole di payout**, non nella sim truccata.

---

## 3. `npc-ai.json`

### Scopo

Come gli NPC **scelgono puntate e importi** in BETTING_OPEN.

### Decisioni collegate

- **B6** — AI completa  
- **B1** — catalogo puntate pieno (pesi, non subset)  

### Sezioni principali

| Sezione | Contenuto |
|---------|-----------|
| `leaveWhenBroke` | Se `true`, seat esce a bankroll ≤ 0 |
| `betPlacement` | Max bet/round, pesi 0–3 bet, delay % sul timer |
| `stake` | Multipli del chip tavolo, max % bankroll |
| `bankrollByPreset` | Range bankroll iniziale per preset |
| `profiles` | cautious / normal / aggressive / superstitious + bias famiglie |
| `betFamilyBaseWeights` | Pesi famiglie puntate (outside vs inside vs zero) |
| `levelScaling` | Se usare modificatori stake da level-up |
| `names.pool` | Nomi display opzionali |

### Profili (default)

| Profilo | Peso | Stile |
|---------|------|--------|
| cautious | 25% | stake bassi, outside |
| normal | 50% | mix |
| aggressive | 15% | stake alti, più inside |
| superstitious | 10% | ripete favoriti, più straight |

### Vincoli

- Non scommettere oltre bankroll  
- Non conoscere il risultato dello spin in anticipo  
- Variant: bet solo-american (es. five-number) solo se `tableVariant === american`  

### Come tarare il carico PAY

- Più `insideStraight` / stake alti → `amountDue` medi più alti → più click PAY  
- Coordinare con `chipValue` in `game-balance.json`  

---

## 4. `controls.json`

### Scopo

Chi preme **No more bets**, **Spin**, **PAY** in Dealer vs Autoplay.

### Decisioni collegate

- **B7** — input Dealer  

### Sezioni principali

| Sezione | Contenuto |
|---------|-----------|
| `dealerMode.noMoreBets` | Bottone manuale + auto-close a timer 0 |
| `dealerMode.spin` | Spin **manuale** (MVP); flag auto riservato al futuro |
| `dealerMode.pay` | PAY manuale; Space = primary di fase |
| `hudChrome` | **Save/Exit** sempre in tavolo: Dealer entrambi; Autoplay solo Exit |
| `autoplayMode` | AI close/spin/pay; no game over; badge demo; no Save |
| `keyboard` | Space, Esc, M |

### Comportamento ufficiale Dealer (B7)

```text
BETTING_OPEN  →  [No more bets] OR timer → 0
BETTING_CLOSED → [Spin]  (sempre manuale in MVP)
PAYOUT        → [PAY] × tapsNeeded  (overpay / timeout → −energy)
```

### Autoplay

- Nessun input obbligatorio  
- PAY a tap **visibili** (non salvare tutto in un frame invisibile)  
- `noGameOver: true`  

### Variazioni future

Imposta `dealerMode.spin.autoSpinAfterClose: true` e regola `autoSpinDelaySeconds` **solo** dopo playtest; default resta `false`.

---

## 5. `bets-european.json` / `bets-american.json`

### Scopo

Catalogo **macchina-ready** di ogni puntata standard della variant:

- `id` univoco (es. `straight_17`, `split_14_15`, `red`, `dozen2`)
- `type` (straight, split, street, corner, sixLine, trio, firstFour, fiveNumber, red, …)
- `pockets[]` — ID tasca stringa (`"0"`, `"00"`, `"17"`)
- `multiplier` **M** — vincita netta `amountDue = stake * M` (B2)
- `family` — allineata a `npc-ai.json` (`outsideSimple`, `insideStraight`, …)
- `placement` — hint UI felt (`number`, `edge`, `outside`, `zero`, …)

### Contabilità (ripetuta nel file)

```text
lose  → stake to house
win   → amountDue = stake * multiplier  (solo vincita; stake gestito a parte)
0/00  → outside perdono (outsideLoseOnZero / outsideLoseOnDoubleZero)
```

### Conteggio tipico

| Variant | Contenuto extra | `betCount` (orientativo) |
|---------|-----------------|---------------------------|
| European | 0, first four, trio 0-1-2 / 0-2-3 | ~150+ |
| American | 00, five-number 0-00-1-2-3, split 0-00, … | ~155+ |

### Rigenerare

```bash
node config/_generate-bets.js
```

Non editare a mano centinaia di split se puoi: modifica lo script e rigenera.  
Eccezioni one-off (call bets P1) potranno essere file separati o append.

### Uso runtime

```text
load bets-{variant}.json
resolve betId → pockets + multiplier
if pockets.includes(winningNumber) → win else lose
```

---

## Dipendenze tra file

```text
game-balance.json
  ├── playerCount, interSpin, chipValue, energy, LEVEL curve
  ├── bonusChance (roll a PAYOUT)
  └── tableVariantDefault

bets-european.json / bets-american.json
  └── definizioni puntate + multiplier (scelte da variant)

npc-ai.json
  ├── legge chipValue del tavolo (da sessione/balance)
  ├── sceglie betId dal catalogo variant (pesi family)
  └── genera bet → amountDue = stake * multiplier

wheel-spin.json
  └── solo winningNumber / spinPlan (indipendente da PAY)

controls.json
  └── quando il player o l’AI può close/spin/pay
```

**Ordine mentale:** balance definisce il tavolo → catalogo bet per variant → npc riempie il felt → wheel decide il numero → controls avanza le fasi → pay usa amountDue e chipValue.

---

## Checklist per chi modifica un JSON

- [ ] Ho letto la sezione di questo README per quel file  
- [ ] `schemaVersion` ancora valida (o l’ho incrementata e aggiornato il loader)  
- [ ] Nessun valore fuori dai range documentati senza nota  
- [ ] Playtest minimo (Training + Rush, qualche PAYOUT)  
- [ ] Se cambio una regola di prodotto (non solo un numero), aggiorno `REQUISITI.md` §0  

---

## Storico

| Data | Nota |
|------|------|
| 2026-08-05 | README creata; file balance, wheel-spin, npc-ai, controls documentati; B3–B7 chiusi |
