/* App Reciclaje Inteligente — 8° Computación · Liceo Tacuabé
   Modelo: https://teachablemachine.withgoogle.com/models/xhik3-sbN/
*/
const MODEL_URL = "https://teachablemachine.withgoogle.com/models/xhik3-sbN/";
let model, webcam, maxPredictions;
let running = false;
let facingMode = "environment"; // preferimos cámara trasera en móviles

// UI refs
const startBtn = document.getElementById("startBtn");
const stopBtn  = document.getElementById("stopBtn");
const switchBtn= document.getElementById("switchBtn");
const statusBadge = document.getElementById("statusBadge");
const webcamContainer = document.getElementById("webcam-container");
const webcamPlaceholder = document.getElementById("webcam-placeholder");
const resultPanel = document.getElementById("resultPanel");
const resultLabel = document.getElementById("resultLabel");
const resultDetail = document.getElementById("resultDetail");
const barsWrap = document.getElementById("bars");

// Diccionario de clases (por si el modelo quedó con "Class 1/2")
const CLASS_LABELS = {
  "Class 1": "No Reciclable",
  "Class 2": "Reciclable"
};
function mapLabel(name) {
  return CLASS_LABELS[name] || name;
}

// Controles
startBtn.addEventListener("click", () => initCameraAndModel().catch(handleError));
stopBtn.addEventListener("click", () => stop());
switchBtn.addEventListener("click", async () => {
  facingMode = (facingMode === "environment") ? "user" : "environment";
  await restartCamera();
});

// Inicializa modelo + cámara
async function initCameraAndModel() {
  if (!isSecureContext()) {
    toastStatus("Necesitás HTTPS para usar la cámara.", "bad");
    return;
  }

  startBtn.disabled = true;
  toastStatus("Cargando modelo…", "neutral");

  model = await tmImage.load(MODEL_URL + "model.json", MODEL_URL + "metadata.json");
  maxPredictions = model.getTotalClasses();

  buildBars(await model.getClassLabels?.() || []);
  await startCamera();
  running = true;
  stopBtn.disabled = false;
  switchBtn.disabled = false;
  toastStatus("En vivo", "good");

  window.requestAnimationFrame(loop);
}

async function startCamera() {
  const flip = true; // espejado para vista natural
  webcam = new tmImage.Webcam(640, 480, flip);
  try {
    await webcam.setup({ facingMode });
  } catch {
    await webcam.setup();
  }
  await webcam.play();

  if (webcamPlaceholder) webcamPlaceholder.remove();
  webcamContainer.innerHTML = "";
  webcamContainer.appendChild(webcam.canvas);
}

async function restartCamera() {
  if (!webcam) return;
  await webcam.stop();
  await startCamera();
}

async function stop() {
  running = false;
  startBtn.disabled = false;
  stopBtn.disabled = true;
  switchBtn.disabled = true;

  if (webcam) await webcam.stop();
  toastStatus("Detenido", "neutral");
  resultPanel.classList.remove("result-bad", "result-good");
  resultLabel.textContent = "Cámara detenida";
  resultDetail.textContent = "Presioná Iniciar cámara para reanudar.";
}

function isSecureContext() {
  return location.protocol === "https:" || location.hostname === "localhost";
}

async function loop() {
  if (!running) return;
  webcam.update();
  await predict();
  window.requestAnimationFrame(loop);
}

function normalizeName(name) {
  return (name || "").toLowerCase().replace(/\s|_/g, "");
}
function isRecyclableClass(name) {
  return /reciclable|recycle/.test(normalizeName(name));
}

async function predict() {
  const prediction = await model.predict(webcam.canvas);
  prediction.sort((a, b) => b.probability - a.probability);
  const top = prediction[0];

  const displayName = mapLabel(top.className);
  const recyclable = isRecyclableClass(displayName);
  const confidence = (top.probability * 100).toFixed(1) + "%";

  resultLabel.textContent = recyclable ? "RECICLABLE" : "NO RECICLABLE";
  resultDetail.textContent = `Confianza: ${confidence} · Clase detectada: ${displayName}`;

  resultPanel.classList.toggle("result-bad", !recyclable);
  resultPanel.classList.toggle("result-good", recyclable);

  updateBars(prediction);
}

function buildBars(classLabels) {
  barsWrap.innerHTML = "";
  const labels = Array.isArray(classLabels) && classLabels.length ? classLabels : ["Clase A","Clase B"];
  labels.forEach(label => {
    const row = document.createElement("div");
    row.className = "bar";
    const name = document.createElement("div");
    name.className = "name";
    name.textContent = mapLabel(label);
    const meter = document.createElement("div");
    meter.className = "meter";
    const fill = document.createElement("div");
    fill.className = "fill neutral";
    meter.appendChild(fill);
    const value = document.createElement("div");
    value.className = "value small";
    value.textContent = "0%";
    row.appendChild(name);
    row.appendChild(value);
    row.appendChild(meter);
    barsWrap.appendChild(row);
  });
}

function updateBars(prediction) {
  const rows = barsWrap.querySelectorAll(".bar");
  if (rows.length !== prediction.length) {
    buildBars(prediction.map(p => mapLabel(p.className)));
  }
  prediction.forEach((p, i) => {
    const row = barsWrap.children[i];
    if (!row) return;
    const value = row.querySelector(".value");
    const fill  = row.querySelector(".fill");
    const percent = Math.round(p.probability * 100);
    value.textContent = `${percent}%`;
    fill.style.width = `${percent}%`;
    fill.className = "fill " + (isRecyclableClass(mapLabel(p.className)) ? "good" : "neutral");
    row.querySelector(".name").textContent = mapLabel(p.className);
  });
}

function toastStatus(text, mode) {
  statusBadge.textContent = text;
  statusBadge.className = "badge " + (mode === "good" ? "good" : mode === "bad" ? "bad" : "neutral");
}

function handleError(err) {
  console.error(err);
  toastStatus("Error: " + (err?.message || "ver consola"), "bad");
  startBtn.disabled = false;
  stopBtn.disabled = true;
  switchBtn.disabled = true;
  resultLabel.textContent = "Error con la cámara o el modelo";
  resultDetail.textContent = "Revisá permisos del navegador y que la URL del modelo esté disponible.";
}

if (!isSecureContext()) {
  toastStatus("Para usar la cámara, abrí esta página en HTTPS (GitHub Pages).", "neutral");
}

