# Moodi – Emotion-Based ESP32 Interface

Questo progetto è un’applicazione desktop sviluppata con **Tauri** per comunicare tramite **seriale** con un dispositivo **ESP32** dotato di una **telecamera**.  
Il firmware personalizzato dell’ESP32 analizza le **espressioni facciali** attraverso la camera, stima una **possibile emozione** e invia i dati all’app desktop.  
In base all’emozione rilevata, il dispositivo cambia il **colore visualizzato sul display** (ad esempio: rosso, verde, blu…).

> ⚠️ **Nota importante:**  
> Il codice è completamente **custom** e non è utilizzabile senza un **ESP32 configurato con il firmware specifico** sviluppato per questo progetto universitario.

---

## 🚀 Funzionalità principali

- **Comunicazione seriale** tra PC e ESP32
- **Rilevamento emozioni** tramite telecamera collegata all’ESP32
- **Invio in tempo reale** dei dati analizzati dall’ESP32
- **Visualizzazione dell’emozione stimata** dall’applicazione Tauri
- **Cambio colore del display dell’ESP32** in base all’emozione rilevata
- **Interfaccia grafica moderna** e leggera grazie a Tauri
- Supporto a Windows, Linux e macOS

---

## 🛠️ Tecnologie utilizzate

### Software
- **Tauri** (Rust + Frontend Web)
- **Rust** per la logica seriale
- **JavaScript/TypeScript** per l’interfaccia

### Hardware
- **ESP32** con telecamera integrata
- **Display LED / TFT** per il cambio colore
- Firmware custom per:
    - acquisizione immagine
    - analisi espressioni facciali
    - invio dati via seriale
    - gestione dei colori sul display

---

## 📦 Installazione

### 1. Clona la repository
```bash
git clone https://github.com/tuo-username/tauri-serial-monitor.git
cd tauri-serial-monitor
```

### 2. Installa le dipendenze del frontend
```bash
npm install
```

### 3. Avvia in modalità sviluppo
```bash
npm run tauri dev
```

### 4. Compila l’app
```bash
npm run tauri build
```