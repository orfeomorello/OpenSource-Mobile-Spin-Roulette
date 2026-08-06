# BitCroupier — Sound design (musica ed effetti)

**Versione:** 0.1  
**Data:** 2026-08-05  
**Stato:** specifica asset (file da produrre in seguito; **non** inclusi nel repo finché non esistono)  
**Stile:** 8-bit / chiptune / arcade casinò stilizzato — mai real-money “cash register” aggressivo  

Musica ed SFX sono **parte del gameplay emotivo**: ritmo del tavolo, urgenza del PAY, trionfo del perfect, tensione del timer, speranza del bonus.  
Devono coinvolgere quanto (o più di) lo score numerico.

**Riferimenti:** `REQUISITI.md` · `UI_USE_CASES.md` · `config/controls.json` · `fx.md` (sync visivo-audio)

---

## 1. Principi

| Principio | Applicazione |
|-----------|----------------|
| **8-bit first** | Square/noise/triangle, loop corti, niente orchestra filmica |
| **Leggibilità** | Ogni fase ha un “colore” sonoro riconoscibile in 1 secondo |
| **Priorità funzionale** | SFX di PAY / timer / overpay / energy non devono perdersi sotto la musica |
| **Mute globale** | Settings + tasto `M`; rispetta preferenza utente |
| **Volumi separati** | `master`, `music`, `sfx` (0–1) in settings locali |
| **No moneta reale** | Evitare suoni “monete d’oro / jackpot slot” da social casino; chip astratti ok |
| **Sync con FX** | Ogni SFX critico ha un counterpart in `fx.md` |
| **File naming** | Solo lowercase, snake_case, prefissi per categoria (vedi §3) |
| **Formato target** | `.ogg` preferito (web), `.wav` sorgente; opzionale `.mp3` fallback |
| **Cartella prevista** | `public/audio/` o `assets/audio/` (da creare in implementazione) |

---

## 2. Categorie

| Prefisso | Categoria | Esempi |
|----------|-----------|--------|
| `mus_` | Musica di sottofondo / stinger | menu, tavolo, payout rush |
| `sfx_` | Effetto one-shot | click, chip, spin tick |
| `ui_` | Interfaccia menu | navigate, confirm, error |
| `vox_` | “Call” stile croupier (opzionale 8-bit blip-speech) | no_more_bets, number call |

---

## 3. Convenzione nomi file

```text
{prefisso}{contesto}_{dettaglio}[_{variante}].{ext}

Esempi:
  mus_table_loop.ogg
  sfx_pay_chip.ogg
  sfx_pay_overpay.ogg
  ui_menu_confirm.ogg
```

| Regola | Esempio |
|--------|---------|
| Loop musicali | suffisso `_loop` |
| Stinger one-shot | suffisso `_sting` |
| Varianti alternate | `_a`, `_b` o `_01`, `_02` |
| Layer da mixare | `_layer_drums`, `_layer_bass` |

**Inventario sotto = nomi canonici.** Non rinominare senza aggiornare questo doc e il codice loader.

---

## 4. Musica per fase / schermata

### 4.1 Tabella musica

| ID file (senza ext) | Quando | Loop | BPM tipico | Mood | Note |
|---------------------|--------|------|------------|------|------|
| `mus_boot_sting` | Splash / logo | No | — | Brillante, corto | 1–2 s |
| `mus_menu_loop` | Language, Main, Mode, Dealer Hub, Setup, Session | Sì | 90–110 | Calmo, neon lounge 8-bit | Crossfade soft tra menu |
| `mus_table_idle_loop` | Game Table in PREPARE / BETTING_OPEN (timer comodo) | Sì | 100–120 | Tappeto da sala, leggero | Volume medio-basso |
| `mus_table_tension_loop` | BETTING_OPEN ultimi ~5 s **oppure** PAYOUT con pay timer basso | Sì | 130–150 | Urgenza, hi-hat, pulse | Crossfade da idle |
| `mus_spin_loop` | SPINNING (animation ON) | Sì | sync feel | Rotazione, arpeggio salita/discesa | Può essere layer + SFX ball |
| `mus_result_sting` | RESULT (numero uscito) | No | — | Accento “reveal” | Molto corto |
| `mus_payout_loop` | PAYOUT (skill PAY) | Sì | 120–140 | Ritmico, da mash button | Si spegne a fine coda |
| `mus_perfect_sting` | Perfect pay (tutti i click giusti in tempo) | No | — | Fanfara 8-bit | + FX confetti |
| `mus_bonus_sting` | Comparsa bonus casuale | No | — | Power-up magico | Pitch up |
| `mus_levelup_sting` | LEVEL +1 | No | — | Arcade level-up classico | |
| `mus_gameover_sting` | Game Over (energia 0) | No | — | Minor, ma non punitivo-crudele | |
| `mus_autoplay_loop` | Autoplay (opzionale: stesso table idle con pad più soft) | Sì | ~100 | Didattico, meno aggressivo | Alternativa: riusa `mus_table_idle_loop` a vol −10% |

### 4.2 Transizioni musicali

| Da | A | Comportamento |
|----|---|----------------|
| Menu → Table | Fade out menu 300–500 ms, fade in table | |
| Idle → Tension | Crossfade 200–400 ms quando timer &lt; soglia | |
| Closed → Spin | Tension/idle out; spin loop in | |
| Spin → Result | Spin out; result sting | |
| Result → Payout | Payout loop in | |
| Payout → Prepare | Payout out; idle in | |
| Pause | Duck music −40% o pause loop; SFX UI ok | |
| Mute music | Solo SFX restano se sfx &gt; 0 | |

### 4.3 Ducking (priorità)

Quando parte un SFX critico, abbassa la musica di ~6–12 dB per 100–300 ms:

- `sfx_pay_overpay`
- `sfx_energy_lose`
- `sfx_timer_urgent`
- `mus_bonus_sting` / `mus_levelup_sting`
- `mus_gameover_sting`

---

## 5. Effetti sonori (SFX) per azione

### 5.1 UI / menu

| ID file | Trigger | Descrizione sonora |
|---------|---------|-------------------|
| `ui_menu_navigate` | Move focus / freccia hub | Blip soft |
| `ui_menu_confirm` | Continue, Select, Save | Click positivo |
| `ui_menu_back` | Back | Click più grave |
| `ui_menu_error` | Validazione fallita (gym, points) | Buzz corto |
| `ui_menu_locked` | Click Player locked | Thud “locked” |
| `ui_toggle_on` | Animation ON, etc. | Switch up |
| `ui_toggle_off` | Animation OFF | Switch down |
| `ui_pause_open` | Pause | Soft whoosh down |
| `ui_pause_close` | Resume | Soft whoosh up |
| `ui_save` | Press Save (Dealer HUD) | Confirm soft |
| `ui_exit` | Press Exit | Soft back / door |

### 5.2 Tavolo — betting

| ID file | Trigger | Descrizione |
|---------|---------|-------------|
| `sfx_bet_place` | NPC piazza una bet (ogni chip) | Chip drop felt |
| `sfx_bet_place_alt` | Variante random per varietà | Chip drop 2 |
| `sfx_betting_open` | Entra BETTING_OPEN | Campanella soft “place your bets” |
| `sfx_no_more_bets` | Close manuale o timer 0 | Gong basso 8-bit / “rien ne va plus” blip |
| `sfx_timer_tick` | Opzionale ogni secondo &lt; 5s | Tick leggero |
| `sfx_timer_urgent` | Pay o bet timer critical | Pulse allarme soft |

### 5.3 Spin / ruota

| ID file | Trigger | Descrizione |
|---------|---------|-------------|
| `sfx_spin_start` | Press Spin / AI spin | Whoosh + avvio rotazione |
| `sfx_spin_loop` | Durante SPINNING | Loop rotella / ball track (se non solo musica) |
| `sfx_spin_ball_tick` | Tick periodici mentre gira | Click tasche (rate scende col slowdown) |
| `sfx_spin_slowdown` | Fase rallentamento | Pitch down del tick |
| `sfx_spin_drop` | Pallina lascia il track | Hit corto |
| `sfx_spin_settle` | Entra in pocket | Thud + ring |
| `sfx_result_number` | RESULT mostrato | Accento sync con `mus_result_sting` |

Con **animation OFF**: `sfx_spin_start` molto corto + `sfx_result_number` (niente loop lungo).

### 5.4 PAYOUT (core skill)

| ID file | Trigger | Descrizione |
|---------|---------|-------------|
| `sfx_pay_enter` | Entra fase PAYOUT | “Cash desk” 8-bit soft |
| `sfx_pay_chip` | Ogni PAY **corretto** | Chip push / stack |
| `sfx_pay_chip_last` | Ultimo click che completa un seat | Chip + sparkle |
| `sfx_pay_seat_complete` | Seat fully paid | Ding positivo |
| `sfx_pay_all_complete` | Coda finita in tempo | Fanfara mini (può layerare `mus_perfect_sting` se perfect) |
| `sfx_pay_overpay` | Click di troppo | Buzz error + impact |
| `sfx_pay_timeout` | Timer PAY a 0 con unpaid | Fail horn soft |
| `sfx_pay_empty_click` | (se distinto da overpay) | Click vuoto — MVP può riusare overpay |

### 5.5 Energia, score, level, bonus

| ID file | Trigger | Descrizione |
|---------|---------|-------------|
| `sfx_energy_lose` | −1 ENERGY | Heart break 8-bit / energy drain |
| `sfx_energy_gain` | Bonus +1 ENERGY | Heal / power restore |
| `sfx_shield_gain` | Bonus SHIELD | Bubble / protect |
| `sfx_shield_block` | Fail assorbito da shield | Block clang soft |
| `sfx_score_up` | House score + (opz. tick) | Coin-ish astratto (non $) |
| `sfx_score_down` | House score − su big pay | Soft descend |
| `sfx_bonus_appear` | Banner bonus | Power-up (con `mus_bonus_sting`) |
| `sfx_bonus_pay_auto` | QUICK/DOUBLE PAY auto-settle | Multi chip cascade |
| `sfx_levelup` | LEVEL +1 | Classic arcade level up |
| `sfx_gameover` | Energy 0 | Con `mus_gameover_sting` |

### 5.6 Seat / NPC

| ID file | Trigger | Descrizione |
|---------|---------|-------------|
| `sfx_npc_react_win` | Seat vince (piccolo) | Cheer blip |
| `sfx_npc_react_lose` | Seat perde | Sigh blip |
| `sfx_npc_leave` | Bankroll 0, leave | Footstep / door soft |

### 5.7 Call “voce” 8-bit (opzionale P1)

| ID file | Trigger | Testo evocato (non speech real) |
|---------|---------|----------------------------------|
| `vox_no_more_bets` | Close | “No more bets” in blips |
| `vox_number_generic` | Result | Pattern per numero (o un solo ding) |
| `vox_perfect_pay` | Perfect | “Perfect!” chiptune |

MVP può omettere `vox_*` e basarsi su SFX + musica.

---

## 6. Mappa fase → audio (quick ref)

| Fase / stato | Musica | SFX chiave |
|--------------|--------|------------|
| Menu / setup | `mus_menu_loop` | ui_* |
| PREPARE | `mus_table_idle_loop` | — |
| BETTING_OPEN | idle → tension se timer basso | bet_place, timer_* |
| BETTING_CLOSED | breve hold / tension | no_more_bets |
| SPINNING | `mus_spin_loop` | spin_* |
| RESULT | `mus_result_sting` | result_number |
| PAYOUT | `mus_payout_loop` | pay_* |
| Perfect | + `mus_perfect_sting` | pay_all_complete |
| Bonus | + `mus_bonus_sting` | bonus_* |
| Level up | + `mus_levelup_sting` | levelup |
| Game Over | `mus_gameover_sting` | gameover |
| Autoplay | idle o `mus_autoplay_loop` | stessi SFX, volume UI didattico ok |
| Pause | duck/pause music | pause_open/close |

---

## 7. Inventario completo (checklist produzione)

Copiare in tracker asset. Estensione: `.ogg` (target).

### Musica
- [ ] `mus_boot_sting`
- [ ] `mus_menu_loop`
- [ ] `mus_table_idle_loop`
- [ ] `mus_table_tension_loop`
- [ ] `mus_spin_loop`
- [ ] `mus_result_sting`
- [ ] `mus_payout_loop`
- [ ] `mus_perfect_sting`
- [ ] `mus_bonus_sting`
- [ ] `mus_levelup_sting`
- [ ] `mus_gameover_sting`
- [ ] `mus_autoplay_loop` *(opz.)*

### UI
- [ ] `ui_menu_navigate`
- [ ] `ui_menu_confirm`
- [ ] `ui_menu_back`
- [ ] `ui_menu_error`
- [ ] `ui_menu_locked`
- [ ] `ui_toggle_on`
- [ ] `ui_toggle_off`
- [ ] `ui_pause_open`
- [ ] `ui_pause_close`

### SFX tavolo / spin / pay
- [ ] `sfx_bet_place`
- [ ] `sfx_bet_place_alt`
- [ ] `sfx_betting_open`
- [ ] `sfx_no_more_bets`
- [ ] `sfx_timer_tick`
- [ ] `sfx_timer_urgent`
- [ ] `sfx_spin_start`
- [ ] `sfx_spin_loop`
- [ ] `sfx_spin_ball_tick`
- [ ] `sfx_spin_slowdown`
- [ ] `sfx_spin_drop`
- [ ] `sfx_spin_settle`
- [ ] `sfx_result_number`
- [ ] `sfx_pay_enter`
- [ ] `sfx_pay_chip`
- [ ] `sfx_pay_chip_last`
- [ ] `sfx_pay_seat_complete`
- [ ] `sfx_pay_all_complete`
- [ ] `sfx_pay_overpay`
- [ ] `sfx_pay_timeout`
- [ ] `sfx_energy_lose`
- [ ] `sfx_energy_gain`
- [ ] `sfx_shield_gain`
- [ ] `sfx_shield_block`
- [ ] `sfx_score_up`
- [ ] `sfx_score_down`
- [ ] `sfx_bonus_appear`
- [ ] `sfx_bonus_pay_auto`
- [ ] `sfx_levelup`
- [ ] `sfx_gameover`
- [ ] `sfx_npc_react_win`
- [ ] `sfx_npc_react_lose`
- [ ] `sfx_npc_leave`

### Vox (P1)
- [ ] `vox_no_more_bets`
- [ ] `vox_number_generic`
- [ ] `vox_perfect_pay`

---

## 8. Implementazione (nota per dev)

| Voce | Proposta |
|------|----------|
| Loader | Mappa `id → url` da manifest JSON futuro `config/audio-manifest.json` (opz.) |
| Fallback | Se file manca: silenzio + log dev, **non** crash |
| Web Audio / Howler / native Audio | Scelta stack libera; ducking più facile con Web Audio |
| Preload | Menu + SFX critici PAY/overpay/energy; spin loop on demand |
| Settings | `masterVolume`, `musicVolume`, `sfxVolume`, `muted` in local settings |

---

## 9. Priorità produzione audio

| Priorità | Set |
|----------|-----|
| **P0** | menu_loop, table_idle, payout_loop, pay_chip, pay_overpay, no_more_bets, spin_start, spin_settle, result_number, energy_lose, timer_urgent, bonus_appear, levelup, gameover |
| **P1** | tension_loop, spin full set, perfect/bonus stings, npc react, score ticks |
| **P2** | vox_*, autoplay_loop dedicato, layer musicali multipli |

---

## Cronologia

| Ver | Data | Note |
|-----|------|------|
| 0.1 | 2026-08-05 | Prima specifica musica/SFX e nomi file canonici |
