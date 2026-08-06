# BitCroupier — Visual FX (effetti di gioco)

**Versione:** 0.1  
**Data:** 2026-08-05  
**Stato:** specifica effetti (da implementare in engine/CSS/Canvas; **non** richiede asset video ora)  
**Stile:** 8-bit / pixel juice — scosse, flash, particelle a pixel, non motion-blur realistico  

Gli FX visivi, insieme a `sound.md`, devono far **sentire** ogni azione: piazzare chip, chiudere le puntate, lo spin, ogni PAY, overpay, bonus, level-up, game over.

**Riferimenti:** `REQUISITI.md` · `UI_USE_CASES.md` · `sound.md` (sync audio) · `config/controls.json`

---

## 1. Principi

| Principio | Applicazione |
|-----------|----------------|
| **Juice con leggibilità** | Feedback forte ma non coprire timer, CLICKS, ENERGY, LEVEL |
| **Pixel-perfect** | Snap a griglia; palette limitata; niente blur “AAA” |
| **Un FX = un significato** | Overpay e timeout devono essere *diversi* a colpo d’occhio |
| **Budget performance** | 60 fps target; particelle con cap; spegni extra su low-end (settings) |
| **Sync audio** | Ogni FX P0 ha SFX in `sound.md` |
| **Naming** | ID effetto `fx_*` usati in codice e in questa lista |
| **Accessibilità** | Opzione `reduceMotion`: accorcia/elimina shake e flash intensi |

---

## 2. Layer di rendering (proposta)

```text
[0] Felt / seats / wheel canvas
[1] Chip and bet markers
[2] Phase banners / pay panel
[3] Particles & flashes (FX)
[4] HUD challenge strip (sempre leggibile sopra FX leggeri)
[5] Fullscreen flashes / vignette (max opacity bassa)
[6] Modals (pause, game over)
```

HUD **LEVEL | ENERGY | SCORE** non deve essere oscurato: FX fullscreen solo vignette/edge, non white-out.

---

## 3. Catalogo effetti per azione

### 3.1 UI / menu

| ID FX | Trigger | Descrizione visiva | Durata tipica | Audio |
|-------|---------|-------------------|---------------|-------|
| `fx_ui_focus_pulse` | Focus bottone | Bordo pixel pulse | loop soft | navigate |
| `fx_ui_confirm_flash` | Confirm | Flash verde 1 frame palette | 80–120 ms | confirm |
| `fx_ui_error_shake` | Errore validazione | Shake UI panel 2–3 px | 200 ms | error |
| `fx_ui_locked_deny` | Player locked | X rosso + shake leggero | 250 ms | locked |
| `fx_ui_page_transition` | Cambio schermata | Wipe pixel o fade a blocchi | 200–400 ms | — |
| `fx_ui_save_flash` | Save ok | Flash soft su bottone Save / strip | 200 ms | ui_save |
| `fx_ui_exit_confirm` | Exit dialog | Modal 8-bit | — | ui_exit |

### 3.2 Betting

| ID FX | Trigger | Descrizione | Durata | Audio |
|-------|---------|-------------|--------|-------|
| `fx_bet_chip_drop` | NPC piazza bet | Chip scala 0.5→1, shadow, settle | 150–250 ms | bet_place |
| `fx_bet_chip_stack` | Più chip stesso spot | Stack offset pixel | 150 ms | bet_place |
| `fx_betting_open_banner` | Inizio betting | Banner “BETTING OPEN” slide | 400 ms | betting_open |
| `fx_no_more_bets_flash` | Close | Felt flash ambrato + banner | 350 ms | no_more_bets |
| `fx_timer_pulse` | Timer &lt; 5s | Colore timer rosso + scale pulse | finché critical | timer_urgent |
| `fx_bets_lock` | Betting closed | Chip “freeze” outline grigia | 200 ms | — |

### 3.3 Spin / ruota

| ID FX | Trigger | Descrizione | Durata | Audio |
|-------|---------|-------------|--------|-------|
| `fx_spin_camera_subtle` | Spin start | Leggero zoom-in ruota (2–4%) | spin | spin_start |
| `fx_spin_motion_lines` | Alta velocità | Linee pixel tangenziali | mid-spin | spin_loop |
| `fx_spin_slow_trail` | Slowdown | Trail pallina più lungo | slowdown | spin_slowdown |
| `fx_spin_drop_spark` | Drop | Scintille pixel al bordo | 200 ms | spin_drop |
| `fx_spin_pocket_highlight` | Settle | Tasca vincente blink 3× | 600 ms | spin_settle |
| `fx_result_number_pop` | RESULT | Numero grande scale bounce | 400 ms | result_number |
| `fx_result_color_wash` | RESULT | Bordo HUD tint red/black/green | 500 ms | — |

Animation **OFF**: salta motion lunghi; tieni `fx_result_number_pop` + pocket highlight istantaneo.

### 3.4 PAYOUT (core — massima attenzione)

| ID FX | Trigger | Descrizione | Durata | Audio |
|-------|---------|-------------|--------|-------|
| `fx_pay_panel_intro` | Entra PAYOUT | Pannello PAY slide-up + glow | 300 ms | pay_enter |
| `fx_pay_clicks_counter` | Sempre in PAYOUT | **CLICKS k/N** e **LEFT** con pop a ogni tap | per tap | — |
| `fx_pay_chip_fly` | PAY corretto | Chip dal “banco” al seat (linea pixel) | 120–200 ms | pay_chip |
| `fx_pay_seat_glow` | Seat corrente | Outline seat + freccia “NEXT” | finché current | — |
| `fx_pay_progress_bar` | paid/amountDue | Barra units si riempie | continua | — |
| `fx_pay_seat_complete` | Seat done | Checkmark pixel + flash verde | 300 ms | pay_seat_complete |
| `fx_pay_all_complete` | Coda done | Ring di scintille sul felt | 500 ms | pay_all_complete |
| `fx_pay_perfect` | Perfect in time | Stars / confetti pixel + “PERFECT PAY” | 800 ms | perfect sting |
| `fx_pay_overpay` | Overpay | **Flash rosso**, shake tavolo, X sul PAY | 400 ms | overpay |
| `fx_pay_timeout` | Timeout unpaid | Vignette scura + “TOO SLOW” | 500 ms | pay_timeout |
| `fx_pay_auto_bonus` | Bonus auto-pay seat | Chip cascade multipla automatica | 400–700 ms | bonus_pay_auto |

**Regola UX:** durante PAYOUT, `fx_pay_clicks_counter` e highlight seat sono **sempre** più leggibili di particelle decorative.

### 3.5 Energia, score, level, bonus

| ID FX | Trigger | Descrizione | Durata | Audio |
|-------|---------|-------------|--------|-------|
| `fx_energy_lose` | −1 ENERGY | Segmento energia si spezza / fade + shake HUD | 400 ms | energy_lose |
| `fx_energy_gain` | +1 ENERGY | Segmento fill + glow ciano/verde | 400 ms | energy_gain |
| `fx_shield_bubble` | SHIELD attivo | Icona scudo pulse su ENERGY | finché carica | shield_gain |
| `fx_shield_absorb` | Fail bloccato | Flash scudo, no break energy | 350 ms | shield_block |
| `fx_score_tick_up` | House + | SCORE contatore tick su | 200–600 ms | score_up |
| `fx_score_tick_down` | House − | SCORE tick giù (rosso soft) | 200–600 ms | score_down |
| `fx_bonus_banner` | Bonus roll hit | Banner `BONUS! NAME` drop + rainbow pixel | 600 ms | bonus_appear |
| `fx_bonus_icon_hud` | Bonus attivo | Icona accanto pay timer | finché attivo | — |
| `fx_levelup` | LEVEL n → n+1 | “LEVEL UP” big + strip flash + confetti | 900 ms | levelup |
| `fx_level_number_pop` | Level up | Numero LEVEL bounce | 400 ms | — |
| `fx_gameover_fade` | Energy 0 | Desat tavolo + overlay GAME OVER | 800 ms | gameover |
| `fx_challenge_strip_pulse` | Perfect / levelup / GO | Pulse bordo strip screenshot | 300 ms | — |

### 3.6 NPC / seat

| ID FX | Trigger | Descrizione | Durata | Audio |
|-------|---------|-------------|--------|-------|
| `fx_npc_win_smile` | Seat win settle | Emote 8-bit / sparkle head | 400 ms | npc_react_win |
| `fx_npc_lose_sigh` | Seat lose | Emote down | 400 ms | npc_react_lose |
| `fx_npc_leave` | Leave table | Slide-out seat + dust | 500 ms | npc_leave |
| `fx_npc_bet_thought` | Opz. pre-bet | “…” bubble (Autoplay didattica) | 300 ms | — |

### 3.7 Autoplay

| ID FX | Trigger | Descrizione | Audio |
|-------|---------|-------------|-------|
| `fx_demo_badge_idle` | Sempre in Autoplay | Badge DEMO leggero pulse | — |
| `fx_demo_phase_arrow` | Cambio fase | Freccia/tutorial highlight zona | — |
| `fx_demo_ai_pay_ghost` | AI preme PAY | Ghost hand / click ring sul bottone | pay_chip |

### 3.8 Transizioni di fase (generiche)

| ID FX | Trigger | Descrizione |
|-------|---------|-------------|
| `fx_phase_banner` | Ogni cambio phase | Banner testo i18n slide |
| `fx_screen_flash_white` | Raro (perfect / level) | 1–2 frame white 20% opacity |
| `fx_screen_flash_red` | Overpay / energy lose | 2–3 frame red 25% |
| `fx_table_shake` | Overpay, timeout | Shake 3–6 px, 4–6 frame |

---

## 4. Intensità e preset qualità

| Setting | Comportamento |
|---------|----------------|
| `fxQuality: high` | Tutte particelle + trails |
| `fxQuality: medium` | No motion lines spin; meno confetti |
| `fxQuality: low` | Solo flash, highlight, counter pop, shake ridotto |
| `reduceMotion: true` | No shake/flash fullscreen; crossfade banner solo |

Default: `high`, rilevamento automatico low-end → `medium` (P1).

---

## 5. Sync critico audio ↔ FX (must match)

| Momento | FX | SFX / MUS (da sound.md) |
|---------|----|-------------------------|
| PAY corretto | `fx_pay_chip_fly` | `sfx_pay_chip` |
| Overpay | `fx_pay_overpay` + shake + flash red | `sfx_pay_overpay` |
| Timeout pay | `fx_pay_timeout` | `sfx_pay_timeout` |
| −Energy | `fx_energy_lose` | `sfx_energy_lose` |
| Bonus | `fx_bonus_banner` | `sfx_bonus_appear` + `mus_bonus_sting` |
| Level up | `fx_levelup` | `sfx_levelup` + `mus_levelup_sting` |
| Pocket settle | `fx_spin_pocket_highlight` | `sfx_spin_settle` |
| Perfect | `fx_pay_perfect` | `mus_perfect_sting` |

Implementazione: emettere **un evento di gioco** (`PayCorrect`, `Overpay`, …) ascoltato da audio e da FX.

---

## 6. Palette FX suggerita (8-bit)

| Uso | Colore indicativo |
|-----|-------------------|
| Success / complete | `#40f070` |
| Danger / overpay / timeout | `#f04040` |
| Bonus / magic | `#f0e040` + `#c060f0` |
| Energy | `#40e0f0` |
| House score up | `#f0c040` |
| Neutro flash | `#ffffff` max 25% opacity |

Allineare alla palette UI globale quando definita.

---

## 7. Priorità implementazione FX

| Priorità | Set |
|----------|-----|
| **P0** | bet_chip_drop, no_more_bets_flash, result_number_pop, pay_panel_intro, pay_clicks_counter, pay_chip_fly, pay_overpay, pay_timeout, energy_lose, bonus_banner, levelup, phase_banner, timer_pulse |
| **P1** | spin full set, perfect, seat_complete, score ticks, npc react, shield, demo arrows |
| **P2** | motion lines, confetti pesanti, thought bubbles, multi-layer particles |

---

## 8. Inventario ID (checklist)

### UI
- [ ] `fx_ui_focus_pulse`
- [ ] `fx_ui_confirm_flash`
- [ ] `fx_ui_error_shake`
- [ ] `fx_ui_locked_deny`
- [ ] `fx_ui_page_transition`

### Betting / spin / pay
- [ ] `fx_bet_chip_drop`
- [ ] `fx_bet_chip_stack`
- [ ] `fx_betting_open_banner`
- [ ] `fx_no_more_bets_flash`
- [ ] `fx_timer_pulse`
- [ ] `fx_bets_lock`
- [ ] `fx_spin_camera_subtle`
- [ ] `fx_spin_motion_lines`
- [ ] `fx_spin_slow_trail`
- [ ] `fx_spin_drop_spark`
- [ ] `fx_spin_pocket_highlight`
- [ ] `fx_result_number_pop`
- [ ] `fx_result_color_wash`
- [ ] `fx_pay_panel_intro`
- [ ] `fx_pay_clicks_counter`
- [ ] `fx_pay_chip_fly`
- [ ] `fx_pay_seat_glow`
- [ ] `fx_pay_progress_bar`
- [ ] `fx_pay_seat_complete`
- [ ] `fx_pay_all_complete`
- [ ] `fx_pay_perfect`
- [ ] `fx_pay_overpay`
- [ ] `fx_pay_timeout`
- [ ] `fx_pay_auto_bonus`

### Meta / NPC / system
- [ ] `fx_energy_lose` / `fx_energy_gain`
- [ ] `fx_shield_bubble` / `fx_shield_absorb`
- [ ] `fx_score_tick_up` / `fx_score_tick_down`
- [ ] `fx_bonus_banner` / `fx_bonus_icon_hud`
- [ ] `fx_levelup` / `fx_level_number_pop`
- [ ] `fx_gameover_fade`
- [ ] `fx_challenge_strip_pulse`
- [ ] `fx_npc_win_smile` / `fx_npc_lose_sigh` / `fx_npc_leave`
- [ ] `fx_demo_badge_idle` / `fx_demo_phase_arrow` / `fx_demo_ai_pay_ghost`
- [ ] `fx_phase_banner`
- [ ] `fx_screen_flash_white` / `fx_screen_flash_red`
- [ ] `fx_table_shake`

---

## 9. Nota design: coinvolgimento

Il loop emotivo del gioco è:

```text
tensione timer → spin spettacolo → PAY ritmico (chip fly + click sound)
  → perfect / overpay / bonus (picchi)
  → level up (meta-progress)
  → energy lose (paura di fine run)
```

Senza FX e audio, resta un foglio di conti.  
Con FX+sound allineati, diventa un **arcade da croupier**.

---

## Cronologia

| Ver | Data | Note |
|-----|------|------|
| 0.1 | 2026-08-05 | Prima specifica FX per azioni/fasi + sync audio |
