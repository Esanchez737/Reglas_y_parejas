const palabrasReglas = [
  { palabra: "Fácil", regla: "Esdrújula: lleva tilde en la antepenúltima sílaba." },
  { palabra: "Camión", regla: "Aguda: lleva tilde porque termina en N, S o vocal." },
  { palabra: "Lápiz", regla: "Llana: lleva tilde porque no termina en N, S o vocal." },
  { palabra: "Corazón", regla: "Aguda: lleva tilde porque termina en N, S o vocal." },
  { palabra: "Árbol", regla: "Llana: lleva tilde porque no termina en N, S o vocal." },
  { palabra: "Música", regla: "Esdrújula: siempre lleva tilde." },
  { palabra: "Compás", regla: "Aguda: lleva tilde porque termina en S." },
  { palabra: "Difícil", regla: "Llana: lleva tilde porque no termina en N, S o vocal." },
  { palabra: "Número", regla: "Esdrújula: siempre lleva tilde." },
  { palabra: "Café", regla: "Aguda: lleva tilde porque termina en vocal." },
  { palabra: "Rápido", regla: "Esdrújula: siempre lleva tilde." },
  { palabra: "Sofá", regla: "Aguda: lleva tilde porque termina en vocal." }
];

let score = 0;
const scoreDisplay = document.getElementById("score");
const board = document.getElementById("game-board");
const restartBtn = document.getElementById("restart-btn");

// --- WebAudio: generador de sonidos (no se requieren archivos externos) ---
const AudioCtx = window.AudioContext || window.webkitAudioContext;
const audioCtx = new (AudioCtx)();
let bgOsc = null;
let bgGain = null;

function resumeAudioContext() {
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(()=>{});
  }
}

function startBackground() {
  if (bgOsc) return;
  resumeAudioContext();
  bgOsc = audioCtx.createOscillator();
  bgGain = audioCtx.createGain();
  bgOsc.type = 'sine';
  bgOsc.frequency.value = 220; // tono base
  bgGain.gain.value = 0.03; // volumen bajo
  const lfo = audioCtx.createOscillator();
  const lfoGain = audioCtx.createGain();
  lfo.frequency.value = 0.25;
  lfoGain.gain.value = 0.02;
  lfo.connect(lfoGain);
  lfoGain.connect(bgGain.gain);
  bgOsc.connect(bgGain);
  bgGain.connect(audioCtx.destination);
  lfo.start();
  bgOsc.start();
  // guardar lfo para detenerlo si es necesario
  bgOsc._lfo = lfo;
}

function stopBackground() {
  if (!bgOsc) return;
  try { bgOsc._lfo.stop(); } catch(e) {}
  try { bgOsc.stop(); } catch(e) {}
  try { bgOsc.disconnect(); } catch(e) {}
  try { bgGain.disconnect(); } catch(e) {}
  bgOsc = null;
  bgGain = null;
}

function playTone(freq = 440, duration = 0.15, type = 'sine', volume = 0.12) {
  resumeAudioContext();
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.value = 0.0001;
  o.connect(g);
  g.connect(audioCtx.destination);
  const now = audioCtx.currentTime;
  g.gain.exponentialRampToValueAtTime(volume, now + 0.01);
  o.start(now);
  g.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  o.stop(now + duration + 0.02);
}

function playAcierto() { playTone(880, 0.18, 'sine', 0.18); }
function playError() { playTone(220, 0.18, 'sawtooth', 0.12); }
function playFinal() { playTone(660, 0.5, 'triangle', 0.16); }

// Iniciar fondo tras la primera interacción del usuario (evita bloqueos de autoplay)
function activarAudioConInteraccion() {
  const once = () => {
    startBackground();
    window.removeEventListener('click', once);
    window.removeEventListener('keydown', once);
  };
  window.addEventListener('click', once);
  window.addEventListener('keydown', once);
}
activarAudioConInteraccion();

function iniciarJuego() {
  board.innerHTML = "";
  score = 0;
  scoreDisplay.textContent = score;

  // Elegir pares aleatorios
  const NUM_PARES = 5; // mantiene 5 pares como antes
  const seleccion = palabrasReglas.slice().sort(() => 0.5 - Math.random()).slice(0, NUM_PARES);

  // Construir cartas con pairId para emparejado robusto
  const cartas = seleccion.flatMap((item, idx) => {
    const pairId = `pair-${idx}`;
    return [
      { tipo: "palabra", contenido: item.palabra, pairId },
      { tipo: "regla", contenido: item.regla, pairId }
    ];
  }).sort(() => 0.5 - Math.random());

  cartas.forEach(data => {
    const card = document.createElement("div");
    card.classList.add("card");
    card.dataset.pair = data.pairId;
    card.setAttribute('role','button');
    card.setAttribute('aria-pressed','false');
    card.tabIndex = 0;

    // inner structure: front/back for flip animation
    card.innerHTML = `
      <div class="card-inner">
        <div class="card-front">?</div>
        <div class="card-back">${data.contenido}</div>
      </div>`;

    // click + keyboard
    const handler = () => voltearCarta(card, data);
    card.addEventListener("click", handler);
    card.addEventListener("keydown", (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handler();
      }
    });

    board.appendChild(card);
  });
}

let primeraCarta = null;
let bloqueo = false;
let matchesFound = 0;

function voltearCarta(card, data) {
  if (bloqueo || card.classList.contains("flipped") || card.classList.contains('matched')) return;

  // mostrar carta
  card.classList.add("flipped");
  card.setAttribute('aria-pressed','true');

  if (!primeraCarta) {
    primeraCarta = { card, data };
    return;
  }

  // comparar por pairId
  const firstPair = primeraCarta.data.pairId;
  const secondPair = data.pairId;

  if (firstPair === secondPair) {
    // acierto
    try { playAcierto(); } catch(e){}
    primeraCarta.card.classList.add('matched');
    card.classList.add('matched');
    primeraCarta = null;
    matchesFound++;
    score++;
    scoreDisplay.textContent = score;
    if (matchesFound === 5) {
      try { playFinal(); } catch(e){}
      setTimeout(() => alert("🎉 ¡Felicidades! Has encontrado todas las parejas."), 200);
    }
  } else {
    // fallo
    try { playError(); } catch(e){}
    bloqueo = true;
    setTimeout(() => {
      primeraCarta.card.classList.remove("flipped");
      primeraCarta.card.setAttribute('aria-pressed','false');
      card.classList.remove("flipped");
      card.setAttribute('aria-pressed','false');
      primeraCarta = null;
      bloqueo = false;
    }, 1000);
  }
}

restartBtn.addEventListener("click", () => {
  // pausar sonidos y reiniciar
  stopBackground();
  matchesFound = 0;
  iniciarJuego();
  // intentar reactivar fondo tras reinicio
  startBackground();
});

window.addEventListener('load', iniciarJuego);
