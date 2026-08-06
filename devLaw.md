Definiamo subito le **linee guida vincolanti** per qualunque app di cui parleremo d’ora in avanti.  
Queste regole diventano il filtro obbligatorio: se un’idea non le rispetta, la scartiamo.

### Linee guida per lo sviluppo (valide per tutte le app)

1. **L’utente è l’unico padrone dei suoi dati**  
   Nessun dato viene mai inviato a un server, a te, o a terze parti.  
   L’app non ha accesso ai dati dell’utente oltre a ciò che gira localmente sul suo dispositivo/browser.

2. **Solo local storage**  
   I dati vengono salvati esclusivamente in `localStorage` o `IndexedDB` del browser.  
   Nessun database backend, nessun account, nessun login.

3. **Export completo e leggibile**  
   L’utente deve poter esportare **tutti** i suoi dati in un formato standard e aperto (JSON preferito, eventualmente anche CSV).  
   Il file di export deve essere umano-leggibile e completo.

4. **Import / restore**  
   L’utente deve poter ricaricare un file di export precedente e ripristinare esattamente lo stato precedente (backup e migrazione tra dispositivi).

5. **Nessun analytics e nessun tracking**  
   Zero Google Analytics, zero pixel, zero log di utilizzo, zero cookie di terze parti.

6. **Funzionamento offline-first**  
   Dopo il primo caricamento l’app deve funzionare anche senza connessione (PWA con Service Worker).

7. **Trasparenza e semplicità**  
   Codice leggibile, nessuna dipendenza oscura, hosting statico (GitHub Pages / Netlify / Cloudflare Pages o equivalente).  
   Nessuna raccolta di dati anche “anonimi”.

8. **Zero adempimenti pesanti**  
   Nessuna partita IVA obbligatoria, nessun trattamento di dati personali da parte del gestore, nessuna responsabilità da moderazione di contenuti o chat.

Queste 8 regole sono ora **obbligatorie**.  
Ogni idea futura verrà valutata solo se le rispetta tutte.

**Perché queste regole sono importanti se sviluppi in Europa e in Italia.**

### 1. GDPR (Regolamento UE 2016/679) – il motivo principale
Il GDPR si applica **solo** quando qualcuno “tratta” dati personali.  
Se l’app:
- non invia mai dati a un server
- non ha account
- non usa analytics
- tiene tutto solo nel browser dell’utente

…allora **tu non tratti dati personali**.  
Di conseguenza:
- non serve base giuridica
- non serve informativa privacy pesante
- non serve registro dei trattamenti
- non serve DPIA (valutazione d’impatto)
- non serve nominare un DPO
- il rischio di sanzioni del Garante Privacy (che in Italia è molto attivo) scende quasi a zero

### 2. Principio di “controllo dell’interessato”
Il GDPR mette l’utente al centro (diritto di accesso, di portabilità, di cancellazione).  
Rendere i dati **esportabili e ricaricabili** non è solo una cortesia: è il modo più semplice e concreto di rispettare questi diritti **senza** dover gestire richieste formali.

### 3. Direttiva ePrivacy e cookie
Qualsiasi analytics, tracking o cookie non essenziale richiede consenso.  
Eliminandoli del tutto eviti:
- banner cookie
- gestione del consenso
- possibili contestazioni

### 4. Responsabilità civile e penale
App con chat, incontri, contenuti generati dagli utenti o moderazione espongono a rischi seri (diffamazione, contenuti illeciti, minori, ecc.).  
Un’app 100 % locale e senza interazione tra utenti elimina quasi completamente queste responsabilità.

### 5. Aspetti burocratici e fiscali italiani
- Se non tratti dati e non hai scopo commerciale rilevante, spesso non serve aprire partita IVA solo per l’app.
- Eviti costi di avvocati per privacy policy, termini di servizio e contratti.
- Eviti obblighi di nomina di responsabili del trattamento e relative scartoffie.

### 6. Fiducia e sostenibilità nel tempo
In Italia e in Europa gli utenti sono sempre più sensibili alla privacy.  
Un’app che dichiara chiaramente “i tuoi dati restano solo sul tuo dispositivo e puoi esportarli quando vuoi” genera più fiducia e meno abbandoni rispetto a soluzioni che chiedono account e sincronizzazione cloud.

---

**In sintesi**  
Queste regole non sono un vezzo tecnico: sono il modo più efficace per **ridurre drasticamente** obblighi legali, costi, rischi di sanzioni e complessità burocratica tipici dello sviluppo in Europa e in Italia, mantenendo comunque un prodotto utile e rispettoso dell’utente.