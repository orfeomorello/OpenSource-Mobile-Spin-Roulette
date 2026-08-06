**BitCroupier — vincolo A1 (canone):** queste librerie valgono solo per **presentazione** (ruota, juice, scene UI opzionali).  
Regole tavolo, PAY, SpinEngine, NPC e session restano in **TypeScript puro** (`REQUISITI.md` §0 / §13.1). Scegliere o cambiare motore qui **non** deve riscrivere il dominio.

---

Ecco i **migliori motori/librerie JavaScript** adatti a creare giochi in stile **8-bit / pixel art**, tutti con **licenza MIT** (libera per uso commerciale, modifica e distribuzione).

### 1. Phaser (il più consigliato)
- Il framework 2D più completo e usato al mondo per giochi HTML5.
- Supporto nativo per **pixel-perfect rendering** (`pixelArt: true`), tilemap (Tiled), fisica (Arcade + Matter.js), animazioni sprite, audio, input, scene, telecamere, particelle.
- Perfetta per platformer, action, RPG, shoot’em up stile NES/Game Boy.
- Documentazione eccellente + community enorme.
- Sito: [phaser.io](https://phaser.io)  
- GitHub: [phaserjs/phaser](https://github.com/phaserjs/phaser)

### 2. LittleJS
- Motore **piccolissimo e velocissimo**, zero dipendenze.
- Rendering ibrido WebGL + Canvas, fisica, particelle, audio (ZzFX), input, tile layer.
- Ideale per giochi retro e competizioni tipo **js13kGames**.
- Molto adatto allo stile 8-bit grazie alla leggerezza e al controllo preciso dei pixel.
- GitHub: [KilledByAPixel/LittleJS](https://github.com/KilledByAPixel/LittleJS)

### 3. KAPLAY (ex Kaboom.js)
- API super semplice e “fun-first”.
- Ottima per prototipi rapidi, game jam e principianti.
- Gestisce facilmente sprite, collisioni, scene, audio e input.
- Compatibile con pixel art e stile 8-bit.
- Sito: [kaplayjs.com](https://kaplayjs.com)  
- GitHub: [kaplayjs/kaplay](https://github.com/kaplayjs/kaplay)

### 4. melonJS
- Motore leggero e moderno (ES6, tree-shakeable).
- Eccellente supporto nativo a **Tiled** (mappe ortogonali, isometriche, esagonali).
- WebGL + Canvas, fisica, audio, input, particelle.
- Molto adatto a giochi tile-based e stile 8/16-bit.
- Sito: [melonjs.org](https://www.melonjs.org)  
- GitHub: [melonjs/melonJS](https://github.com/melonjs/melonJS)

### 5. PixiJS
- Non è un motore completo (è principalmente un **renderer** ad altissime prestazioni), ma è la base di tantissimi giochi.
- WebGL / WebGPU, gestione avanzata di sprite, filtri, maschere, testo.
- Si combina facilmente con Matter.js o Box2D per la fisica.
- Perfetto se vuoi massimo controllo e performance con pixel art.
- Sito: [pixijs.com](https://pixijs.com)

### 6. BeepMini (specifico per 8-bit)
- Creato appositamente per stile **retro 8-bit**.
- Palette limitata, griglia a caratteri/tile, chiptune integrato, controlli on-screen.
- Molto semplice e ispirato ai computer degli anni ’80.
- GitHub: [BeepMini/b8](https://github.com/BeepMini/b8)  
- Sito: [beepmini.com](https://beepmini.com)

### Confronto rapido

| Motore | Complessità | Adatto a 8-bit | Feature complete | Dimensione | Note principali |
|-------------|-------------|----------------|------------------|------------|----------------------------------|
| **Phaser** | Media | Eccellente | Sì | Media | Scelta migliore per la maggior parte |
| **LittleJS**| Bassa | Eccellente | Sì | Piccolissima | Velocissimo e leggero |
| **KAPLAY** | Molto bassa | Molto buona | Buona | Piccola | Prototipi e jam |
| **melonJS** | Media-bassa | Molto buona | Sì | Piccola | Ottimo con Tiled |
| **PixiJS** | Media | Eccellente | No (solo render) | Piccola | Massima performance |
| **BeepMini**| Bassa | Specifico | Limitata | Piccolissima | Puro stile 8-bit |

### Consiglio pratico
- **Vuoi un gioco completo e professionale** → **Phaser**
- **Vuoi qualcosa di ultra-leggero e veloce** → **LittleJS**
- **Sei principiante o fai game jam** → **KAPLAY**
- **Lavori molto con mappe Tiled** → **melonJS**
- **Vuoi solo rendering potentissimo** → **PixiJS** (+ fisica separata)

Tutti sono MIT, quindi puoi usarli liberamente anche in progetti commerciali senza problemi di licenza.