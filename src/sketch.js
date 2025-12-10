const invoke = window.__TAURI__.core.invoke;
// === VARIABILI GLOBALI ===
let cameraInterface, capture, tracker, classifier;
let selectedPort = null;
let isTrackingActive = false;
let faceDetected = false;
let appStatusMessage = "Caricamento...";

// --- Variabili per la stabilizzazione delle emozioni e il throttling ---
let lastPostTime = 0;
const postInterval = 1500;
let lastSentEmotion = "";
let currentDominantEmotion = "";
let stableDominantEmotion = "";
let emotionStreakCounter = 0;
const EMOTION_CONFIDENCE_THRESHOLD = 20;

function preload() {
    try {
        cameraInterface = loadImage("./img/interface_face_w.png");
    } catch (e) {
        console.error("ERRORE PRELOAD: Impossibile caricare l'immagine dell'interfaccia.", e);
        alert("ERRORE: Impossibile caricare ./img/interface_face_w.png. Controlla il percorso del file.");
    }
}

function setup() {
    createCanvas(800, 600);
    background(51);
    noStroke();

    populateDeviceLists();
    document.getElementById('start-stop-button').addEventListener('click', handleStartStop);
    document.getElementById('refresh-button').addEventListener('click', populateDeviceLists);
}

async function populateDeviceLists() {
    appStatusMessage = "Ricerca dispositivi...";
    const portSelect = document.getElementById('port-select');
    const cameraSelect = document.getElementById('camera-select');
    const startButton = document.getElementById('start-stop-button');

    portSelect.innerHTML = '<option>Caricamento...</option>';
    cameraSelect.innerHTML = '<option>Caricamento...</option>';

    try {
        const ports = await invoke("get_ports").catch(console.error);
        portSelect.innerHTML = '';
        if (ports.length === 0) {
            portSelect.innerHTML = '<option>Nessuna porta trovata</option>';
        } else {
            ports.forEach(port => {
                const option = document.createElement('option');
                option.value = port;
                option.textContent = port;
                portSelect.appendChild(option);
            });
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            // 2. Ferma subito lo stream per non lasciare la telecamera accesa.
            stream.getTracks().forEach(track => track.stop());
        } catch (permissionError) {
            console.error("L'utente ha negato il permesso per la fotocamera o non ci sono fotocamere.", permissionError);
            cameraSelect.innerHTML = '<option>Permesso negato</option>';
            throw new Error("Permesso fotocamera non concesso."); // Interrompe l'esecuzione ulteriore
        }

        const devices = await navigator.mediaDevices.enumerateDevices();
        const cameras = devices.filter(device => device.kind === 'videoinput');
        cameraSelect.innerHTML = '';
        if(cameras.length === 0) {
            cameraSelect.innerHTML = '<option>Nessuna camera trovata</option>';
        } else {
            cameras.forEach(camera => {
                const option = document.createElement('option');
                option.value = camera.deviceId;
                option.textContent = camera.label || `Camera ${cameraSelect.length + 1}`;
                cameraSelect.appendChild(option);
            });
        }

        if (ports.length > 0 && cameras.length > 0 && !ports[0].includes("Nessuna")) {
            startButton.disabled = false;
            appStatusMessage = "";
        } else {
            appStatusMessage = "Dispositivi non trovati.";
        }

    } catch (error) {
        console.error("Errore nel recuperare i dispositivi:", error);
        appStatusMessage = "Errore dispositivi.";
        alert("Errore nel recuperare i dispositivi. Assicurati che l'app abbia i permessi necessari.");
    }
}

function handleStartStop() {
    if (isTrackingActive) {
        // --- PULIZIA AGGRESSIVA (v3) ---
        console.log("Stop: avvio pulizia profonda delle risorse...");

        isTrackingActive = false; // Ferma il loop di 'draw' prima di pulire
        faceDetected = false;
        selectedPort = null;

        // Pulisci il canvas per aiutare il motore grafico a rilasciare la texture
        background(51);

        if (tracker) {
            tracker.stop();
            // Tentativo di cancellare le proprietà interne per rompere i riferimenti
            for (let prop in tracker) {
                if (tracker.hasOwnProperty(prop)) {
                    delete tracker[prop];
                }
            }
            tracker = null;
            console.log("Tracker fermato e pulito.");
        }

        if (capture && capture.elt && capture.elt.srcObject) {
            capture.elt.srcObject.getTracks().forEach(track => track.stop());
            capture.elt.srcObject = null;
            console.log("Tracce video fermate.");
        }

        if (capture) {
            capture.remove();
            capture = null;
            console.log("Elemento di cattura rimosso.");
        }

        if (classifier) {
            classifier = null;
        }

        // Forza il garbage collection (funziona solo se gli strumenti di sviluppo sono aperti con flag specifici)
        // if (window.gc) {
        //     window.gc();
        //     console.log("Garbage Collection forzato.");
        // } else {
        //     console.log("Per forzare il Garbage Collection, avvia Electron con il flag --js-flags='--expose-gc'");
        // }

        const startButton = document.getElementById('start-stop-button');
        startButton.textContent = 'Avvia Rilevamento';
        startButton.classList.remove('active');

        document.getElementById('port-select').disabled = false;
        document.getElementById('camera-select').disabled = false;
        document.getElementById('refresh-button').disabled = false;

        document.getElementById('status-message').textContent = 'Disconnesso';
        document.getElementById('status-message').style.color = '#e74c3c';
        appStatusMessage = "";

        console.log("Pulizia completata.");
    } else {
        // Logica di avvio (invariata)
        const portSelect = document.getElementById('port-select');
        const cameraSelect = document.getElementById('camera-select');
        selectedPort = portSelect.value;
        const selectedCameraId = cameraSelect.value;

        if(selectedPort && selectedCameraId && !selectedPort.includes('Nessuna')) {
            setupTracking(selectedCameraId);
            isTrackingActive = true;

            const startButton = document.getElementById('start-stop-button');
            startButton.textContent = 'Ferma Rilevamento';
            startButton.classList.add('active');

            document.getElementById('port-select').disabled = true;
            document.getElementById('camera-select').disabled = true;
            document.getElementById('refresh-button').disabled = true;

            document.getElementById('status-message').textContent = `Connesso a ${selectedPort}`;
            document.getElementById('status-message').style.color = '#2ecc71';
        } else {
            alert("Per favore, seleziona una porta e una telecamera valide.");
        }
    }
}

function draw() {
    if (!isTrackingActive || !capture) {
        background(51);
        drawAppStatus();
        return;
    }

    image(capture, 0, 0);
    let interfaceX = (width - 540) / 2;
    let interfaceY = (height - 540) / 2;
    image(cameraInterface, interfaceX, interfaceY, 540, 540);

    let face = track();
    faceDetected = !!face;
    drawAppStatus();

    if (face) {
        let frameDominantEmotion = "";
        let maxScore = 0;
        for (let emotionName in face.emotion) {
            if (face.emotion[emotionName] > maxScore) {
                maxScore = face.emotion[emotionName];
                frameDominantEmotion = emotionName;
            }
        }

        if (frameDominantEmotion === currentDominantEmotion) {
            emotionStreakCounter++;
        } else {
            currentDominantEmotion = frameDominantEmotion;
            emotionStreakCounter = 0;
        }

        if (emotionStreakCounter > EMOTION_CONFIDENCE_THRESHOLD) {
            stableDominantEmotion = currentDominantEmotion;
        }

        const currentTime = millis();
        if (isTrackingActive && stableDominantEmotion && stableDominantEmotion !== lastSentEmotion && currentTime - lastPostTime > postInterval) {
            if (stableDominantEmotion === "sad") sendRGB(0, 0, 255);
            else if (stableDominantEmotion === "angry") sendRGB(255, 0, 0);
            else if (stableDominantEmotion === "fear") sendRGB(255, 127, 0);
            else if (stableDominantEmotion === "surprised") sendRGB(0, 255, 255);
            else if (stableDominantEmotion === "disgusted") sendRGB(0, 255, 0);
            else if (stableDominantEmotion === "happy") sendRGB(255, 255, 0);

            lastSentEmotion = stableDominantEmotion;
            lastPostTime = currentTime;
        }

        const circlesY = interfaceY + 67;
        const firstCircleX = interfaceX + 170;
        const circleSpacing = 40;
        let index = 0;
        for (let emotionName in face.emotion) {
            let emotionPercentage = face.emotion[emotionName];
            let circleSize = map(emotionPercentage, 0, 100, 5, 25);
            if (emotionName === "sad") fill(0, 0, 255);
            else if (emotionName === "angry") fill(255, 0, 0);
            else if (emotionName === "fear") fill(255, 127, 0);
            else if (emotionName === "surprised") fill(0, 255, 255);
            else if (emotionName === "disgusted") fill(0, 255, 0);
            else if (emotionName === "happy") fill(255, 255, 0);
            else fill(255);
            ellipse(firstCircleX + (index * circleSpacing), circlesY, circleSize, circleSize);
            index++;
        }
        fill(255);
        ellipse(face.position.nose.x, face.position.nose.y, 5, 5);
    }
}

function drawAppStatus() {
    if (isTrackingActive) return;
    background(51);
    fill(255);
    textAlign(CENTER, CENTER);
    textSize(24);
    text(appStatusMessage, width/2, height/2);
}

function sendRGB(r, g, b) {
    if (!isTrackingActive || !selectedPort) return;
    invoke('send_color', { r, g, b, portName: selectedPort })
        .catch(console.error);
}

function setupTracking(deviceId) {
    appStatusMessage = "Avvio telecamera...";
    if (typeof pModel === 'undefined' || typeof emotionModel === 'undefined') {
        const missing = (typeof pModel === 'undefined') ? 'pModel' : 'emotionModel';
        alert(`ERRORE CRITICO: Il modello '${missing}' non è stato caricato.`);
        handleStartStop();
        return;
    }

    const constraints = { video: { deviceId: { exact: deviceId } }, audio: false };

    capture = createCapture(constraints, {flipped: true}, (stream) => {
        if(!stream) {
            console.error("ERRORE: Lo stream della telecamera non è stato ottenuto.");
            appStatusMessage = "Errore telecamera";
            handleStartStop();
            return;
        }
        console.log('Cattura video avviata con successo.');
        appStatusMessage = "Inizializzazione tracker...";

        tracker = new clm.tracker();
        tracker.init(pModel);
        tracker.start(capture.elt);

        classifier = new emotionClassifier();
        classifier.init(emotionModel);
        console.log('Tracker e classificatore inizializzati.');
        appStatusMessage = "Rilevamento attivo.";
    });
    capture.size(800, 600);
    capture.hide();
}

function track() {
    if(!tracker) return false;
    var pos = tracker.getCurrentPosition();
    if (!pos) { return false; }

    var parameters = tracker.getCurrentParameters();
    if(!parameters) return false;

    var emotionPrediction = classifier.meanPredict(parameters);
    if (!emotionPrediction) return false;

    var emotion = {};
    for (var i = 0; i < emotionPrediction.length; i++) {
        emotion[emotionPrediction[i].emotion] = int(map(emotionPrediction[i].value, 0, 1, 0, 100));
    }
    return { emotion: emotion, position: trackingPositionToFace(pos) };
}

function trackingPositionToFace(pos) {
    var coordsToCanvas = function (coord) {
        return {
            x: width - (coord[0] / capture.width) * width,
            y: (coord[1] / capture.height) * height,
        };
    };
    return { nose: coordsToCanvas(pos[62]) };
}