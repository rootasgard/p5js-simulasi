// ============================================================
// SIMULASI KESELAMATAN KENDARAAN (FISIKA KOMPUTASI)
// Hukum Newton, Energi Kinetik, Momentum, Impuls & Airbag
// Menggunakan p5.js (3D WebGL) + HTML5 Responsive Dashboard
// ============================================================

// ---------- KONSTANTA FISIKA ----------
const g = 9.8; // Percepatan gravitasi (m/s^2)
const DT_NO_AIRBAG = 0.05; // Durasi benturan tanpa airbag (detik)

// ---------- PARAMETER KENDARAAN & SIMULASI ----------
let v0_kmh = 60;          // Kecepatan awal (km/jam)
let v0 = v0_kmh / 3.6;    // Kecepatan awal (m/s)
let mass = 1000;          // Massa kendaraan (kg)
let mu = 0.60;            // Koefisien gesekan ban-jalan
let wallDistance = 45;    // Jarak ke penghalang perbaikan jalan (m)
let impactTimeAirbag = 0.20; // Waktu redam airbag (detik)

// ---------- STATUS SIMULASI ----------
let carPosM = 0;          // Posisi mobil dalam meter (0 s.d. wallDistance)
let currentSpeed = 0;     // Kecepatan saat ini (m/s)
let simState = "idle";    // "idle" | "running" | "paused" | "crashed" | "safe"
let collisionTime = 0;    // Timer setelah tabrakan (detik)
let wheelRotation = 0;    // Sudut putaran roda (radian)
let impactSpeed = 0;      // Kecepatan saat menabrak dinding (m/s)

// Data jejak rem (skid marks)
let skidMarks = [];

// Partikel percikan benturan
let impactParticles = [];

// Shake kamera saat benturan
let cameraShake = 0;

// Mode Tema: "dark" (malam hari) | "light" (siang hari)
let currentTheme = "dark";
let domBtnThemeToggle, domThemeToggleText;

// Waktu gerak nyata kendaraan hingga berhenti / tabrakan (detik)
let simMotionDuration = 0;

// Data perkotaan 3D (Skyline Gedung & Lampu PJU)
let cityBuildings = [];
let streetLights = [];

// ---------- MODEL OBJEK KENDARAAN & EFEK CUACA ----------
let currentVehicleType = "city"; // "city" | "rain" | "sport" | "truck"
let domVehicleSelect, domVehicleBadge, domHudVehicleName;
let rainParticles = [];
let waterSprayParticles = [];
let speedTrailParticles = [];


// ---------- EFEK SUARA PROSEDURAL (WEB AUDIO API) ----------
let audioCtx = null;
let masterGainNode = null;
let soundEnabled = true;
let activeEngine = null;

// Inisialisasi AudioContext & Master Gain
function initAudio() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
      masterGainNode = audioCtx.createGain();
      masterGainNode.gain.setValueAtTime(soundEnabled ? 1.0 : 0.0, audioCtx.currentTime);
      masterGainNode.connect(audioCtx.destination);
    }
  }
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }
}

// Global unlocker: buka akses audio pada interaksi pertama pengguna (klik/sentuh/keyboard)
function unlockAudio() {
  initAudio();
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }
}
["click", "pointerdown", "touchstart", "keydown"].forEach((evt) => {
  window.addEventListener(evt, unlockAudio, { passive: true });
});

// Nada konfirmasi pendek saat tombol suara dinyalakan
function playConfirmationChirp() {
  if (!soundEnabled) return;
  initAudio();
  if (!audioCtx) return;
  try {
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(587.33, now); // D5
    osc.frequency.setValueAtTime(880.00, now + 0.06); // A5
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.18, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    osc.connect(gain);
    gain.connect(masterGainNode || audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.18);
  } catch (e) {}
}

function startEngineSound() {
  if (!soundEnabled) return;
  initAudio();
  if (!audioCtx) return;

  // Hentikan mesin lama seketika tanpa timeout yang merusak node baru
  stopEngineSound(true);

  try {
    const now = audioCtx.currentTime;

    // Dual Oscillator: Sawtooth (deru putaran mesin) + Triangle (dentuman silinder sub-bass)
    const osc1 = audioCtx.createOscillator();
    const osc2 = audioCtx.createOscillator();
    osc1.type = "sawtooth";
    osc2.type = "triangle";

    const filter = audioCtx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(220, now);
    filter.Q.setValueAtTime(1.5, now);

    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0.01, now);
    gain.gain.linearRampToValueAtTime(0.28, now + 0.08);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(masterGainNode || audioCtx.destination);

    osc1.start(now);
    osc2.start(now);

    // Generator desisan gesekan ban ke aspal (procedural bandpass noise)
    const bufferSize = audioCtx.sampleRate * 2;
    const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const tireNode = audioCtx.createBufferSource();
    tireNode.buffer = noiseBuffer;
    tireNode.loop = true;

    const tireFilter = audioCtx.createBiquadFilter();
    tireFilter.type = "bandpass";
    tireFilter.frequency.setValueAtTime(1600, now);
    tireFilter.Q.setValueAtTime(2.8, now);

    const tireGain = audioCtx.createGain();
    tireGain.gain.setValueAtTime(0.0001, now);

    tireNode.connect(tireFilter);
    tireFilter.connect(tireGain);
    tireGain.connect(masterGainNode || audioCtx.destination);

    tireNode.start(now);

    activeEngine = {
      osc1,
      osc2,
      filter,
      gain,
      tireNode,
      tireFilter,
      tireGain
    };
  } catch (e) {
    console.warn("Audio start error:", e);
  }
}

function updateEngineSound(speed, maxSpeed, muVal) {
  if (!audioCtx || !soundEnabled || !activeEngine) return;
  try {
    const now = audioCtx.currentTime;
    const speedRatio = Math.max(0, Math.min(1, speed / Math.max(1, maxSpeed)));

    // Frekuensi mesin naik saat kecepatan tinggi: dari 48 Hz (idle/pelan) sampai 185 Hz
    const baseFreq = 48 + speedRatio * 137;
    activeEngine.osc1.frequency.setTargetAtTime(baseFreq, now, 0.04);
    activeEngine.osc2.frequency.setTargetAtTime(baseFreq * 0.5, now, 0.04);

    // Filter bukaan throttle membuka lebih lebar saat kecepatan tinggi
    const filterFreq = 200 + speedRatio * 750;
    activeEngine.filter.frequency.setTargetAtTime(filterFreq, now, 0.04);

    // Volume mesin tetap terdengar jelas selama meluncur
    const vol = speed > 0.3 ? (0.16 + speedRatio * 0.22) : 0.05;
    activeEngine.gain.gain.setTargetAtTime(vol, now, 0.04);

    // Decitan ban saat pengereman keras di aspal kering
    if (activeEngine.tireGain) {
      const isScreeching = (muVal >= 0.30 && speed > 1.2);
      const screechVol = isScreeching ? Math.min(0.24, 0.05 + (speed / 20) * 0.20) : 0.0001;
      activeEngine.tireGain.gain.setTargetAtTime(screechVol, now, 0.06);
    }
  } catch (e) {}
}

function stopEngineSound(immediate = false) {
  if (!activeEngine) return;
  const eng = activeEngine;
  activeEngine = null; // Detach segera agar panggilan baru tidak terganggu

  if (!audioCtx) return;
  const now = audioCtx.currentTime;

  if (immediate) {
    try { eng.gain.gain.setValueAtTime(0, now); } catch (e) {}
    try { eng.tireGain.gain.setValueAtTime(0, now); } catch (e) {}
    try { eng.osc1.stop(); eng.osc1.disconnect(); } catch (e) {}
    try { eng.osc2.stop(); eng.osc2.disconnect(); } catch (e) {}
    try { eng.tireNode.stop(); eng.tireNode.disconnect(); } catch (e) {}
    try { eng.filter.disconnect(); } catch (e) {}
  } else {
    try { eng.gain.gain.setTargetAtTime(0.0001, now, 0.05); } catch (e) {}
    try { eng.tireGain.gain.setTargetAtTime(0.0001, now, 0.05); } catch (e) {}
    setTimeout(() => {
      try { eng.osc1.stop(); eng.osc1.disconnect(); } catch (e) {}
      try { eng.osc2.stop(); eng.osc2.disconnect(); } catch (e) {}
      try { eng.tireNode.stop(); eng.tireNode.disconnect(); } catch (e) {}
      try { eng.filter.disconnect(); } catch (e) {}
      try { eng.gain.disconnect(); } catch (e) {}
    }, 100);
  }
}

function playCrashSound() {
  if (!soundEnabled) return;
  initAudio();
  if (!audioCtx) return;

  // Hentikan suara deru mesin seketika saat benturan
  stopEngineSound(true);

  try {
    const now = audioCtx.currentTime;

    // 1. Sub-Bass Thump (Dentuman momentum bodi logam terhenti mendadak)
    const thumpOsc = audioCtx.createOscillator();
    const thumpGain = audioCtx.createGain();
    thumpOsc.type = "sine";
    thumpOsc.frequency.setValueAtTime(170, now);
    thumpOsc.frequency.exponentialRampToValueAtTime(22, now + 0.40);

    thumpGain.gain.setValueAtTime(0.95, now);
    thumpGain.gain.exponentialRampToValueAtTime(0.001, now + 0.50);

    thumpOsc.connect(thumpGain);
    thumpGain.connect(masterGainNode || audioCtx.destination);
    thumpOsc.start(now);
    thumpOsc.stop(now + 0.52);

    // 2. Metallic Crash / Deformasi Bodi (Resonant Crunch)
    const bufferSize = audioCtx.sampleRate * 0.55;
    const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (audioCtx.sampleRate * 0.14));
    }

    const noiseNode = audioCtx.createBufferSource();
    noiseNode.buffer = noiseBuffer;

    const bandpass = audioCtx.createBiquadFilter();
    bandpass.type = "bandpass";
    bandpass.frequency.setValueAtTime(900, now);
    bandpass.Q.setValueAtTime(2.2, now);

    const noiseGain = audioCtx.createGain();
    noiseGain.gain.setValueAtTime(0.85, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

    noiseNode.connect(bandpass);
    bandpass.connect(noiseGain);
    noiseGain.connect(masterGainNode || audioCtx.destination);
    noiseNode.start(now);

    // 3. High Shatter / Pecahan Kaca & Komponen Ringsek
    const shatterNode = audioCtx.createBufferSource();
    shatterNode.buffer = noiseBuffer;
    const highpass = audioCtx.createBiquadFilter();
    highpass.type = "highpass";
    highpass.frequency.setValueAtTime(2600, now);

    const shatterGain = audioCtx.createGain();
    shatterGain.gain.setValueAtTime(0.40, now);
    shatterGain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);

    shatterNode.connect(highpass);
    highpass.connect(shatterGain);
    shatterGain.connect(masterGainNode || audioCtx.destination);
    shatterNode.start(now);

    // 4. Airbag Explosive Deployment & Venting (Ledakan pyrotechnic & desisan airbag)
    const airbagNoise = audioCtx.createBufferSource();
    airbagNoise.buffer = noiseBuffer;
    const lowpass = audioCtx.createBiquadFilter();
    lowpass.type = "lowpass";
    lowpass.frequency.setValueAtTime(320, now);
    lowpass.frequency.exponentialRampToValueAtTime(1600, now + 0.08);
    lowpass.frequency.exponentialRampToValueAtTime(150, now + 0.40);

    const airbagGain = audioCtx.createGain();
    airbagGain.gain.setValueAtTime(0.001, now);
    airbagGain.gain.linearRampToValueAtTime(0.55, now + 0.03);
    airbagGain.gain.exponentialRampToValueAtTime(0.001, now + 0.42);

    airbagNoise.connect(lowpass);
    lowpass.connect(airbagGain);
    airbagGain.connect(masterGainNode || audioCtx.destination);
    airbagNoise.start(now + 0.02);
  } catch (e) {
    console.warn("Crash audio error:", e);
  }
}

// ---------- ELEMEN DOM ----------
let domSpeed, domMass, domMu, domDist, domAirbag;
let domBadgeSpeed, domBadgeMass, domBadgeMu, domBadgeDist, domBadgeAirbag;
let domBtnStart, domBtnStartText, domBtnPause, domBtnReset;
let domStatusBadge, domStatusText;
let domHudSpeed, domHudPos, domHudTarget, domHudAccel, domHudTime;
let domValBrakeDist, domValBrakeStatus, domValReduction, domValForceCompare;
let domValAccelMetric;
let domParamDrawer, domBtnToggleParams, domBtnCloseParams, domParamBackdrop;
let domRightToolbar, domBtnToggleToolbar;
let domResultsModal, domBtnOpenResultsModal, domBtnCloseResultsModal;
let domFlowModal, domBtnOpenFlowchart, domBtnCloseFlowchart;
let domBtnRecordTrial, domBtnClearTable, domTrialTableBody;
let trialCount = 0;
let graphCanvas, graphCtx;

// ============================================================
// SETUP P5.js
// ============================================================
function setup() {
  const container = document.getElementById("canvas-container");
  const w = container ? container.clientWidth : 800;
  const h = container ? container.clientHeight : 420;

  const cnv = createCanvas(w, h, WEBGL);
  if (container) cnv.parent("canvas-container");

  // Inisialisasi referensi DOM & Event Listener
  initDOM();

  // Buat data gedung perkotaan & lampu jalan 3D
  initCityData();

  // Reset simulasi ke kondisi awal
  resetSimulation();

  // Render grafik pertama kali (statis)
  drawImpulseGraph();
}

// ============================================================
// INISIALISASI ELEMEN HTML DOM
// ============================================================
function initDOM() {
  domVehicleSelect = document.getElementById("vehicleSelect");
  domVehicleBadge = document.getElementById("vehicleBadge");
  domHudVehicleName = document.getElementById("hudVehicleName");

  domSpeed = document.getElementById("speedInput");
  domMass = document.getElementById("massInput");
  domMu = document.getElementById("muInput");
  domDist = document.getElementById("distInput");
  domAirbag = document.getElementById("airbagInput");

  domBadgeSpeed = document.getElementById("speedBadge");
  domBadgeMass = document.getElementById("massBadge");
  domBadgeMu = document.getElementById("muBadge");
  domBadgeDist = document.getElementById("distBadge");
  domBadgeAirbag = document.getElementById("airbagBadge");

  domBtnStart = document.getElementById("btnStart");
  domBtnStartText = document.getElementById("btnStartText");
  domBtnPause = document.getElementById("btnPause");
  domBtnPauseText = document.getElementById("btnPauseText");
  domBtnReset = document.getElementById("btnReset");

  domStatusBadge = document.getElementById("statusBadge");
  domStatusText = document.getElementById("statusText");

  domHudSpeed = document.getElementById("hudSpeed");
  domHudPos = document.getElementById("hudPos");
  domHudTarget = document.getElementById("hudTarget");
  domHudAccel = document.getElementById("hudAccel");
  domHudTime = document.getElementById("hudTime");

  // Toggle Mode Siang (Terang) / Malam (Gelap)
  domBtnThemeToggle = document.getElementById("btnThemeToggle");
  domThemeToggleText = document.getElementById("themeToggleText");

  function toggleTheme() {
    currentTheme = (currentTheme === "dark") ? "light" : "dark";
    if (currentTheme === "light") {
      document.documentElement.setAttribute("data-theme", "light");
      if (domThemeToggleText) domThemeToggleText.textContent = "Malam";
      if (domBtnThemeToggle) domBtnThemeToggle.setAttribute("title", "Beralih ke Mode Malam");
    } else {
      document.documentElement.removeAttribute("data-theme");
      if (domThemeToggleText) domThemeToggleText.textContent = "Siang";
      if (domBtnThemeToggle) domBtnThemeToggle.setAttribute("title", "Beralih ke Mode Siang");
    }
    drawImpulseGraph(simState === "crashed", collisionTime);
  }

  if (domBtnThemeToggle) domBtnThemeToggle.addEventListener("click", toggleTheme);

  // Toggle Efek Suara (Mute / Unmute)
  const domBtnSoundToggle = document.getElementById("btnSoundToggle");
  const domSoundToggleText = document.getElementById("soundToggleText");

  function toggleSound() {
    initAudio();
    soundEnabled = !soundEnabled;
    if (masterGainNode && audioCtx) {
      masterGainNode.gain.setValueAtTime(soundEnabled ? 1.0 : 0.0, audioCtx.currentTime);
    }
    if (domBtnSoundToggle) {
      const iconOn = domBtnSoundToggle.querySelector(".icon-sound-on");
      const iconOff = domBtnSoundToggle.querySelector(".icon-sound-off");
      if (soundEnabled) {
        domBtnSoundToggle.classList.remove("muted");
        if (iconOn) iconOn.style.display = "inline-block";
        if (iconOff) iconOff.style.display = "none";
        if (domSoundToggleText) domSoundToggleText.textContent = "Suara";
        playConfirmationChirp();
      } else {
        domBtnSoundToggle.classList.add("muted");
        if (iconOn) iconOn.style.display = "none";
        if (iconOff) iconOff.style.display = "inline-block";
        if (domSoundToggleText) domSoundToggleText.textContent = "Bisu";
        stopEngineSound(true);
      }
    }
  }

  if (domBtnSoundToggle) domBtnSoundToggle.addEventListener("click", toggleSound);


  domValBrakeDist = document.getElementById("valBrakeDist");
  domValBrakeStatus = document.getElementById("valBrakeStatus");
  domValReduction = document.getElementById("valReduction");
  domValForceCompare = document.getElementById("valForceCompare");
  domValAccelMetric = document.getElementById("valAccelMetric");

  // Modal Flowchart (button removed from UI; keep modal closeable via Escape)
  domFlowModal = document.getElementById("flowchartModal");
  domBtnOpenFlowchart = null; // button removed from toolbar
  domBtnCloseFlowchart = document.getElementById("btnCloseFlowchart");

  function openFlowchartModal() {
    if (domFlowModal) domFlowModal.classList.add("open");
  }
  function closeFlowchartModal() {
    if (domFlowModal) domFlowModal.classList.remove("open");
  }

  if (domBtnCloseFlowchart) domBtnCloseFlowchart.addEventListener("click", closeFlowchartModal);
  if (domFlowModal) {
    domFlowModal.addEventListener("click", (e) => {
      if (e.target === domFlowModal) closeFlowchartModal();
    });
  }

  // Modal Hasil & Grafik Pengukuran
  domResultsModal = document.getElementById("resultsModal");
  domBtnOpenResultsModal = document.getElementById("btnOpenResultsModal");
  domBtnCloseResultsModal = document.getElementById("btnCloseResultsModal");

  function openResultsModal() {
    if (domResultsModal) {
      domResultsModal.classList.add("open");
      setTimeout(() => {
        drawImpulseGraph(simState === "crashed", collisionTime);
      }, 50);
    }
  }
  function closeResultsModal() {
    if (domResultsModal) domResultsModal.classList.remove("open");
  }

  if (domBtnOpenResultsModal) domBtnOpenResultsModal.addEventListener("click", openResultsModal);
  if (domBtnCloseResultsModal) domBtnCloseResultsModal.addEventListener("click", closeResultsModal);
  if (domResultsModal) {
    domResultsModal.addEventListener("click", (e) => {
      if (e.target === domResultsModal) closeResultsModal();
    });
  }

  // Right Toolbar Collapse / Expand (Icon hamburger tetap di sisi kanan saat tersembunyi)
  domRightToolbar = document.getElementById("rightToolbar");
  domBtnToggleToolbar = document.getElementById("btnToggleToolbar");
  if (domBtnToggleToolbar && domRightToolbar) {
    domBtnToggleToolbar.addEventListener("click", () => {
      domRightToolbar.classList.toggle("collapsed");
      domBtnToggleToolbar.classList.toggle("active");
    });
  }

  // Bottom Parameter Drawer (Buka / Tutup)
  domParamDrawer = document.getElementById("paramDrawer");
  domBtnToggleParams = document.getElementById("btnToggleParams");
  domBtnCloseParams = document.getElementById("btnCloseParams");
  domParamBackdrop = document.getElementById("paramBackdrop");

  function openParamDrawer() {
    if (domParamDrawer) domParamDrawer.classList.add("open");
    if (domParamBackdrop) domParamBackdrop.classList.add("open");
    if (domBtnToggleParams) {
      domBtnToggleParams.classList.add("open");
      domBtnToggleParams.setAttribute("aria-expanded", "true");
    }
  }

  function closeParamDrawer() {
    if (domParamDrawer) domParamDrawer.classList.remove("open");
    if (domParamBackdrop) domParamBackdrop.classList.remove("open");
    if (domBtnToggleParams) {
      domBtnToggleParams.classList.remove("open");
      domBtnToggleParams.setAttribute("aria-expanded", "false");
    }
  }

  function toggleParamDrawer() {
    if (domParamDrawer && domParamDrawer.classList.contains("open")) {
      closeParamDrawer();
    } else {
      openParamDrawer();
    }
  }

  if (domBtnToggleParams) domBtnToggleParams.addEventListener("click", toggleParamDrawer);
  if (domBtnCloseParams) domBtnCloseParams.addEventListener("click", closeParamDrawer);
  if (domParamBackdrop) domParamBackdrop.addEventListener("click", closeParamDrawer);

  // Global Escape key
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeFlowchartModal();
      closeResultsModal();
      closeParamDrawer();
    }
  });

  graphCanvas = document.getElementById("forceGraphCanvas");
  if (graphCanvas) {
    graphCtx = graphCanvas.getContext("2d");
  }

  // Tabel Percobaan: tombol Catat & Hapus Semua
  domBtnRecordTrial = document.getElementById("btnRecordTrial");
  domBtnClearTable = document.getElementById("btnClearTable");
  domTrialTableBody = document.getElementById("trialTableBody");

  if (domBtnRecordTrial) domBtnRecordTrial.addEventListener("click", recordTrial);
  if (domBtnClearTable) domBtnClearTable.addEventListener("click", clearTrialTable);

  // Event listener pemilih model kendaraan
  if (domVehicleSelect) {
    domVehicleSelect.addEventListener("change", () => {
      setVehicleType(domVehicleSelect.value, false);
      resetSimulation();
    });
  }

  // Event listener slider
  if (domSpeed) domSpeed.addEventListener("input", onParamChange);
  if (domMass) domMass.addEventListener("input", onParamChange);
  if (domMu) domMu.addEventListener("input", onParamChange);
  if (domDist) domDist.addEventListener("input", onParamChange);
  if (domAirbag) domAirbag.addEventListener("input", onParamChange);

  // Event listener tombol kontrol
  if (domBtnStart) domBtnStart.addEventListener("click", toggleStart);
  if (domBtnPause) domBtnPause.addEventListener("click", togglePause);
  if (domBtnReset) domBtnReset.addEventListener("click", resetSimulation);

  // Preset fungsi global (menerapkan parameter + model kendaraan sesuai skenario)
  window.applyPreset = function(v, m, u, d, air, type) {
    if (domSpeed) domSpeed.value = v;
    if (domMass) domMass.value = m;
    if (domMu) domMu.value = u;
    if (domDist) domDist.value = d;
    if (domAirbag) domAirbag.value = air;
    if (v !== undefined) { v0_kmh = v; v0 = v0_kmh / 3.6; }
    if (m !== undefined) mass = m;
    if (u !== undefined) mu = u;
    if (d !== undefined) wallDistance = d;
    if (air !== undefined) impactTimeAirbag = air;
    if (type) {
      setVehicleType(type, true);
    }
    onParamChange();
    resetSimulation();
  };
}

// ============================================================
// PENGATURAN TIPE KENDARAAN & SKENARIO
// ============================================================
function setVehicleType(type, updateSelect = true) {
  currentVehicleType = type;

  // Nilai default koefisien gesek sesuai jenis kendaraan / kondisi jalan jika slider disembunyikan
  const frictionMap = {
    city: 0.60,
    rain: 0.35,
    sport: 0.85,
    truck: 0.55
  };
  if (!domMu && frictionMap[type] !== undefined) {
    mu = frictionMap[type];
  }

  const infoMap = {
    city: { badge: "Mobil Kota", hud: "Mobil Kota" },
    rain: { badge: "Sedan Hujan", hud: "Sedan (Jalan Basah)" },
    sport: { badge: "Supercar Sport", hud: "Supercar Sport" },
    truck: { badge: "Truk 6 Roda", hud: "Truk Muatan Berat" }
  };

  const info = infoMap[type] || infoMap.city;

  if (updateSelect && domVehicleSelect) {
    domVehicleSelect.value = type;
  }
  if (domVehicleBadge) {
    domVehicleBadge.textContent = info.badge;
  }
  if (domHudVehicleName) {
    domHudVehicleName.textContent = info.hud;
  }

  // Perbarui kelas tombol pill skenario aktif
  const presetButtons = document.querySelectorAll(".pill-btn");
  presetButtons.forEach(btn => {
    if (btn.getAttribute("data-preset") === type) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
  });

  // Siapkan partikel hujan jika skenario hujan aktif
  if (type === "rain") {
    initRainParticles();
  } else {
    rainParticles = [];
    waterSprayParticles = [];
  }
}

// ============================================================
// MEMBACA DAN MEMPERBARUI PARAMETER
// ============================================================
function onParamChange() {
  if (domSpeed) v0_kmh = parseFloat(domSpeed.value);
  if (domMass) mass = parseFloat(domMass.value);
  if (domMu) mu = parseFloat(domMu.value);
  if (domDist) wallDistance = parseFloat(domDist.value);
  if (domAirbag) impactTimeAirbag = parseFloat(domAirbag.value);

  v0 = v0_kmh / 3.6;

  // Perbarui teks badge
  if (domBadgeSpeed) domBadgeSpeed.textContent = `${v0_kmh} km/jam (${v0.toFixed(1)} m/s)`;
  if (domBadgeMass) domBadgeMass.textContent = `${mass} kg`;
  if (domBadgeMu) domBadgeMu.textContent = mu.toFixed(2);
  if (domBadgeDist) domBadgeDist.textContent = `${wallDistance} m`;
  if (domBadgeAirbag) domBadgeAirbag.textContent = `${impactTimeAirbag.toFixed(2)} detik`;

  updateCalculatedMetrics();
  drawImpulseGraph();

  if (simState === "idle") {
    currentSpeed = v0;
  }
}

// ============================================================
// PERHITUNGAN FISIKA ANALITIK (SESUAI FLOWCHART)
// ============================================================
function updateCalculatedMetrics() {
  const v0_ms = v0_kmh / 3.6;
  const a_brake = mu * g;                          // Perlambatan fisis GLBB: a = mu * g
  const s_brake = (v0_ms * v0_ms) / (2 * a_brake); // Jarak pengereman teoritis: s = v0^2 / 2a
  const isSafe = (s_brake <= wallDistance);

  // Taksiran kecepatan benturan jika s > d (sesuai rumus flowchart): v_b = sqrt(v0^2 - 2ad)
  let v_crash = 0;
  if (!isSafe) {
    const v_sq = (v0_ms * v0_ms) - (2 * a_brake * wallDistance);
    v_crash = v_sq > 0 ? Math.sqrt(v_sq) : 0;
  }

  // Momentum dan gaya impak
  const p_impact = (v_crash > 0 ? mass * v_crash : mass * v0_ms);
  const F_no = p_impact / DT_NO_AIRBAG;
  const F_air = p_impact / impactTimeAirbag;
  const reduction = ((F_no - F_air) / F_no) * 100;

  // 1. Tampilkan ke kartu metrik utama dengan notasi matematis standar
  if (domValAccelMetric) {
    domValAccelMetric.innerHTML = `${a_brake.toFixed(2)} m/s<sup>2</sup>`;
  }
  if (domValBrakeDist) {
    domValBrakeDist.innerHTML = `${s_brake.toFixed(1)} m`;
  }
  if (domValBrakeStatus) {
    if (isSafe) {
      domValBrakeStatus.innerHTML = `Aman: <i>s</i> &le; ${wallDistance.toFixed(1)} m`;
      domValBrakeStatus.style.color = "var(--success)";
    } else {
      domValBrakeStatus.innerHTML = `Tabrakan: <i>s</i> &gt; ${wallDistance.toFixed(1)} m`;
      domValBrakeStatus.style.color = "var(--danger)";
    }
  }

  // 2. Efektivitas Airbag
  if (domValReduction) domValReduction.innerHTML = `${reduction.toFixed(1)} %`;
  if (domValForceCompare) {
    domValForceCompare.innerHTML = `<i>F</i><sub>airbag</sub>: ${(F_air / 1000).toFixed(0)} kN vs <i>F</i><sub>kaku</sub>: ${(F_no / 1000).toFixed(0)} kN`;
  }

  // 4. Update HUD Target & Perlambatan
  if (domHudTarget) domHudTarget.innerHTML = `${wallDistance.toFixed(1)} m`;
  if (domHudAccel) domHudAccel.innerHTML = `-${a_brake.toFixed(2)} m/s<sup>2</sup>`;
}

// ============================================================
// KONTROL SIMULASI (START / PAUSE / RESET)
// ============================================================
function toggleStart() {
  if (simState === "idle" || simState === "safe" || simState === "crashed") {
    resetSimulation();
    simMotionDuration = 0;
    simState = "running";
    updateStatusUI("Sedang Mengerem...", "var(--primary)");
    initAudio();
    startEngineSound();
    if (domBtnStartText) {
      domBtnStartText.textContent = "Ulangi Simulasi";
    }
  } else if (simState === "paused") {
    simState = "running";
    updateStatusUI("Sedang Mengerem...", "var(--primary)");
    initAudio();
    startEngineSound();
    if (domBtnPauseText) domBtnPauseText.textContent = "Jeda";
  }
}

function togglePause() {
  if (simState === "running") {
    simState = "paused";
    updateStatusUI("Simulasi Dijeda", "var(--warning)");
    stopEngineSound();
    if (domBtnPauseText) domBtnPauseText.textContent = "Lanjut";
  } else if (simState === "paused") {
    simState = "running";
    updateStatusUI("Sedang Mengerem...", "var(--primary)");
    initAudio();
    startEngineSound();
    if (domBtnPauseText) domBtnPauseText.textContent = "Jeda";
  }
}

function resetSimulation() {
  stopEngineSound();
  onParamChange();
  simState = "idle";
  carPosM = 0;
  currentSpeed = v0;
  collisionTime = 0;
  simMotionDuration = 0;
  wheelRotation = 0;
  impactSpeed = 0;
  cameraShake = 0;
  skidMarks = [];
  impactParticles = [];

  updateStatusUI("Siap Dijalankan", "var(--primary)");
  if (domBtnStartText) domBtnStartText.textContent = "Mulai Simulasi";
  if (domBtnPauseText) domBtnPauseText.textContent = "Jeda";

  updateHUD();
  drawImpulseGraph();
}

function updateStatusUI(text, color) {
  if (domStatusText) domStatusText.textContent = text;
  if (domStatusBadge) {
    domStatusBadge.style.color = color;
    domStatusBadge.style.borderColor = color;
    domStatusBadge.style.background = "rgba(255, 255, 255, 0.05)";
  }
}

function updateHUD() {
  if (domHudSpeed) {
    const kmh = (currentSpeed * 3.6).toFixed(1);
    domHudSpeed.innerHTML = `${kmh} km/jam`;
  }
  if (domHudPos) {
    domHudPos.innerHTML = `${carPosM.toFixed(1)} m`;
  }
  if (domHudTime) {
    domHudTime.innerHTML = `${simMotionDuration.toFixed(2)} s`;
  }
}

// ============================================================
// LOOP UTAMA P5.js (DRAW)
// ============================================================
function draw() {
  // Update fisika kendaraan jika berjalan
  if (simState === "running" || simState === "crashed") {
    updatePhysics();
  }

  // Render Scene 3D WebGL
  drawScene3D();

  // Update HUD teks pada overlay HTML
  updateHUD();

  // Redam guncangan kamera
  if (cameraShake > 0) {
    cameraShake *= 0.88;
    if (cameraShake < 0.1) cameraShake = 0;
  }
}

// ============================================================
// UPDATE FISIKA KENDARAAN
// ============================================================
function updatePhysics() {
  // Batasi lonjakan waktu agar gerak tetap stabil saat frame terlambat.
  const dt = min(deltaTime / 1000, 0.033);

  // JIKA SEDANG MELUNCUR & MENGEREM
  if (simState === "running") {
    simMotionDuration += dt;
    const a_brake = mu * g; // Deselerasi (m/s^2)
    currentSpeed = max(0, currentSpeed - a_brake * dt);
    updateEngineSound(currentSpeed, v0, mu);

    carPosM += currentSpeed * dt;

    // Putaran roda sinkron dengan laju: dTheta = dx / radius_roda (radius ~ 0.35m)
    wheelRotation += (currentSpeed * dt) / 0.35;

    // Catat jejak ban (skid mark) saat pengereman cukup keras
    if (mu >= 0.25 && currentSpeed > 0.5) {
      skidMarks.push({
        dist: carPosM,
        alpha: map(a_brake, 1, 9.8, 80, 220)
      });
      if (skidMarks.length > 250) skidMarks.shift();
    }

    // CEK BENTURAN DINDING
    if (carPosM >= wallDistance) {
      carPosM = wallDistance;
      impactSpeed = currentSpeed;

      if (impactSpeed > 0.3) {
        // TERJADI TABRAKAN (s > d)
        simState = "crashed";
        collisionTime = 0;
        currentSpeed = 0;
        cameraShake = min(25, impactSpeed * 0.9);

        // Mainkan efek suara benturan tabrakan
        playCrashSound();

        // Buat partikel percikan benturan
        createImpactParticles();

        updateStatusUI("Tabrakan Terjadi", "var(--danger)");
        // Render kurva impuls dengan data tabrakan nyata
        drawImpulseGraph(true);
      } else {
        // Berhenti pas di depan dinding
        simState = "safe";
        currentSpeed = 0;
        stopEngineSound();
        updateStatusUI("Berhenti Tepat", "var(--success)");
      }
    } else if (currentSpeed <= 0.01) {
      // BERHENTI SELAMAT SEBELUM DINDING (s <= d)
      currentSpeed = 0;
      simState = "safe";
      stopEngineSound();
      const sisa = (wallDistance - carPosM).toFixed(1);
      updateStatusUI("Berhenti Aman", "var(--success)");
    }
  }

  // JIKA TAHAP ANIMASI TUMBUKAN (AIRBAG MENGEMBANG & MEMBANTU)
  if (simState === "crashed") {
    collisionTime += dt;
    updateImpactParticles(dt);

    // Animasi plot grafik saat tabrakan
    if (collisionTime <= impactTimeAirbag + 0.15) {
      drawImpulseGraph(true, collisionTime);
    }
  }
}

// ============================================================
// SISTEM PARTIKEL PERCIKAN SAAT BENTURAN
// ============================================================
function createImpactParticles() {
  impactParticles = [];
  const count = min(60, Math.floor(impactSpeed * 3));
  for (let i = 0; i < count; i++) {
    impactParticles.push({
      x: 0,
      y: random(-15, 20),
      z: random(-30, 30),
      vx: random(-80, -10),
      vy: random(-90, 20),
      vz: random(-45, 45),
      size: random(3, 8),
      life: 1.0,
      decay: random(1.2, 2.5),
      col: random() > 0.4 ? [255, 180, 50] : [240, 240, 240]
    });
  }
}

function updateImpactParticles(dt) {
  for (let i = impactParticles.length - 1; i >= 0; i--) {
    let p = impactParticles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.z += p.vz * dt;
    p.vy += 180 * dt; // gravitasi partikel
    p.life -= p.decay * dt;
    if (p.life <= 0) {
      impactParticles.splice(i, 1);
    }
  }
}

// ============================================================
// SISTEM PARTIKEL CUACA & EFEK KHUSUS SKENARIO
// ============================================================
function initRainParticles() {
  rainParticles = [];
  for (let i = 0; i < 180; i++) {
    rainParticles.push({
      x: random(-420, 420),
      y: random(-260, 110),
      z: random(-180, 180),
      len: random(12, 22),
      speedY: random(14, 22),
      speedX: random(-3, -1)
    });
  }
}

function updateAndDrawRain3D() {
  if (currentVehicleType !== "rain") return;
  push();
  stroke(185, 215, 255, 140);
  strokeWeight(1.5);
  for (let p of rainParticles) {
    p.y += p.speedY;
    p.x += p.speedX;
    if (p.y > 125) {
      p.y = random(-260, -180);
      p.x = random(-420, 420);
      p.z = random(-180, 180);
    }
    line(p.x, p.y, p.z, p.x + p.speedX * 1.5, p.y + p.len, p.z);
  }
  pop();
}

function updateAndDrawWaterSpray3D(carWorldX) {
  if (currentVehicleType !== "rain") return;

  if (simState === "running" && currentSpeed > 1) {
    const rearX = carWorldX - 40;
    for (let i = 0; i < 3; i++) {
      waterSprayParticles.push({
        x: rearX + random(-4, 4),
        y: 112 + random(-4, 4),
        z: random(-35, 35),
        vx: -random(15, 35) * (currentSpeed / 12),
        vy: -random(10, 25),
        vz: random(-15, 15),
        life: 1.0,
        decay: random(2.5, 4.2),
        size: random(2, 5)
      });
    }
  }

  push();
  noStroke();
  for (let i = waterSprayParticles.length - 1; i >= 0; i--) {
    let p = waterSprayParticles[i];
    p.x += p.vx * 0.03;
    p.y += p.vy * 0.03;
    p.z += p.vz * 0.03;
    p.life -= p.decay * 0.03;
    if (p.life <= 0) {
      waterSprayParticles.splice(i, 1);
    } else {
      fill(200, 225, 255, p.life * 130);
      push();
      translate(p.x, p.y, p.z);
      sphere(p.size);
      pop();
    }
  }
  pop();
}

function updateAndDrawSpeedTrails3D(carWorldX) {
  if (currentVehicleType !== "sport") return;

  if (simState === "running" && currentSpeed > 14) {
    const tailX = carWorldX - 54;
    speedTrailParticles.push({
      x: tailX,
      y: 68 + random(-10, 10),
      z: random(-28, 28),
      len: map(currentSpeed, 14, 40, 20, 75),
      life: 1.0,
      decay: 3.5
    });
  }

  push();
  strokeWeight(2);
  for (let i = speedTrailParticles.length - 1; i >= 0; i--) {
    let s = speedTrailParticles[i];
    s.life -= s.decay * 0.03;
    if (s.life <= 0) {
      speedTrailParticles.splice(i, 1);
    } else {
      stroke(255, 230, 240, s.life * 150);
      line(s.x, s.y, s.z, s.x - s.len, s.y, s.z);
    }
  }
  pop();
}


// ============================================================
// DATA PERKOTAAN 3D & LAMPU JALAN (URBAN SKYLINE & HIGHWAY)
// ============================================================
function initCityData() {
  cityBuildings = [];
  streetLights = [];

  // LAYER 1: SKYLINE GEDUNG PENCAKAR LANGIT KEJAUHAN (Z = -680 s.d. -860)
  for (let x = -2500; x <= 2500; x += 115) {
    const seed = Math.abs(Math.sin(x * 12.9898 + 78.233));
    const h = 260 + Math.floor(seed * 320); // Tinggi 260 s.d. 580
    const w = 80 + Math.floor((seed * 3.7 % 1) * 65); // Lebar 80 s.d. 145
    const d = 90 + Math.floor((seed * 7.1 % 1) * 75);
    const z = -720 - Math.floor((seed * 5.3 % 1) * 160);

    const hasAntenna = (seed > 0.62);
    const baseShade = 20 + Math.floor(seed * 18);
    const tintB = baseShade + Math.floor((seed * 2.5 % 1) * 16);

    // Pola jendela perkantoran
    const windowRows = 6;
    const windowCols = 3;
    const litWindows = [];
    for (let r = 0; r < windowRows; r++) {
      for (let c = 0; c < windowCols; c++) {
        const winSeed = Math.abs(Math.sin(x * 4.1 + r * 17.3 + c * 31.7));
        if (winSeed > 0.44) {
          const isAmber = (winSeed > 0.62);
          litWindows.push({
            rx: (c - (windowCols - 1) / 2) * (w / (windowCols + 1)),
            ry: (r - (windowRows - 1) / 2) * (h * 0.72 / (windowRows + 1)),
            isAmber: isAmber
          });
        }
      }
    }

    cityBuildings.push({
      x: x + Math.floor((seed * 1.7 % 1) * 35),
      y: 126 - h / 2,
      z: z,
      w: w,
      h: h,
      d: d,
      col: [baseShade, baseShade + 4, tintB],
      hasAntenna: hasAntenna,
      litWindows: litWindows,
      layer: "skyline"
    });
  }

  // LAYER 2: GEDUNG PERKANTORAN TINGKAT MENENGAH (Z = -380 s.d. -480)
  for (let x = -2400; x <= 2400; x += 175) {
    const seed = Math.abs(Math.sin(x * 93.123 + 45.67));
    const h = 130 + Math.floor(seed * 160); // Tinggi 130 s.d. 290
    const w = 110 + Math.floor((seed * 4.3 % 1) * 70);
    const d = 80 + Math.floor((seed * 2.9 % 1) * 55);
    const z = -430 - Math.floor((seed * 3.1 % 1) * 70);

    const baseShade = 26 + Math.floor(seed * 16);
    const tintB = baseShade + 10;

    cityBuildings.push({
      x: x + 40,
      y: 126 - h / 2,
      z: z,
      w: w,
      h: h,
      d: d,
      col: [baseShade, baseShade + 6, tintB],
      hasAntenna: false,
      litWindows: [],
      layer: "mid"
    });
  }

  // LAMPU JALAN PJU MODERN (STREETLIGHTS)
  for (let lx = -2400; lx <= 2400; lx += 220) {
    streetLights.push({
      x: lx,
      y: 122,
      z: -205
    });
  }
}

// ------------------------------------------------------------
// RENDER LATAR BELAKANG GEDUNG PERKOTAAN 3D
// ------------------------------------------------------------
function drawCitySkyline() {
  push();
  noStroke();

  const isLight = (currentTheme === "light");
  const isRain = (currentVehicleType === "rain");
  const isSport = (currentVehicleType === "sport");

  for (let i = 0; i < cityBuildings.length; i++) {
    const b = cityBuildings[i];
    push();
    translate(b.x, b.y, b.z);

    if (isLight) {
      // Siang hari: warna gedung beton modern & kaca terang elegan
      fill(b.col[0] + 185, b.col[1] + 190, b.col[2] + 200);
    } else {
      // Malam hari: warna gedung gelap atmosferis
      if (isRain) {
        fill(b.col[0] * 0.75, b.col[1] * 0.8, b.col[2] * 0.85);
      } else if (isSport) {
        fill(b.col[0] * 0.85, b.col[1] * 0.88, b.col[2] * 1.15);
      } else {
        fill(b.col[0], b.col[1], b.col[2]);
      }
    }
    box(b.w, b.h, b.d);

    // Lis atap (rooftop cornice)
    push();
    translate(0, -b.h / 2 - 2, 0);
    if (isLight) {
      fill(b.col[0] + 200, b.col[1] + 205, b.col[2] + 215);
    } else {
      fill(b.col[0] + 16, b.col[1] + 18, b.col[2] + 22);
    }
    box(b.w + 4, 4, b.d + 4);
    pop();

    // Antena pemancar dengan lampu peringatan penerbangan merah berkedip
    if (b.hasAntenna) {
      push();
      translate(0, -b.h / 2 - 18, 0);
      fill(isLight ? 120 : 85, isLight ? 130 : 95, isLight ? 145 : 110);
      cylinder(1.5, 32);
      translate(0, -18, 0);
      if (frameCount % 60 < 30) {
        fill(255, 50, 50);
        emissiveMaterial(255, 40, 40);
      } else {
        fill(isLight ? 160 : 90, 20, 20);
      }
      sphere(3);
      pop();
    }

    // Aksen neon atap pada skenario supercar
    if (isSport && b.layer === "mid" && (i % 3 === 0)) {
      push();
      translate(0, -b.h / 2 - 2, b.d / 2 + 1);
      fill(56, 189, 248, 220);
      emissiveMaterial(56, 189, 248);
      box(b.w * 0.85, 3, 2);
      pop();
    }

    // Jendela perkantoran
    if (b.litWindows && b.litWindows.length > 0) {
      for (let wIdx = 0; wIdx < b.litWindows.length; wIdx++) {
        const win = b.litWindows[wIdx];
        push();
        translate(win.rx, win.ry, b.d / 2 + 1);
        if (isLight) {
          // Siang hari: jendela kaca memantulkan rona langit biru cerah
          fill(160, 205, 240, 180);
        } else {
          // Malam hari: jendela menyala hangat / cyan
          if (win.isAmber) {
            fill(245, 185, 95, 210);
            emissiveMaterial(245, 175, 80);
          } else {
            fill(160, 220, 255, 190);
            emissiveMaterial(120, 200, 255);
          }
        }
        box(b.w * 0.18, 7, 1);
        pop();
      }
    }

    pop();
  }
  pop();
}

// ------------------------------------------------------------
// RENDER LAMPU JALAN PJU MODERN (STREETLIGHTS)
// ------------------------------------------------------------
function drawStreetLights3D() {
  push();
  noStroke();

  const isLight = (currentTheme === "light");

  for (let i = 0; i < streetLights.length; i++) {
    const sl = streetLights[i];
    push();
    translate(sl.x, sl.y, sl.z);

    // Tiang vertikal baja (tinggi 82px)
    translate(0, -41, 0);
    fill(isLight ? color(140, 150, 165) : color(90, 100, 115));
    cylinder(2.2, 82);

    // Lengan melengkung horizontal mengarah ke badan jalan (ke arah Z positif)
    translate(0, -41, 16);
    box(2.5, 3, 34);

    // Rumah lampu LED (luminaire head)
    translate(0, 2, 17);
    fill(isLight ? color(110, 120, 132) : color(55, 65, 78));
    box(7, 4, 14);

    // Lampu LED: mati pada siang hari, menyala pada malam hari
    translate(0, 2, 0);
    if (isLight) {
      fill(175, 180, 185);
      box(5, 1.5, 11);
    } else {
      fill(255, 245, 220);
      emissiveMaterial(255, 240, 200);
      box(5, 1.5, 11);
    }

    pop();
  }
  pop();
}

// ============================================================
// VISUALISASI 3D LINTASAN, KENDARAAN & DINDING
// ============================================================
function drawScene3D() {
  const isLight = (currentTheme === "light");

  // Latar belakang atmosfer dinamis: Siang Hari (Light) vs Malam Hari (Dark)
  if (isLight) {
    if (currentVehicleType === "rain") {
      background(175, 188, 202); // Langit siang mendung hujan
    } else if (currentVehicleType === "sport") {
      background(205, 225, 248); // Siang cerah sirkuit modern
    } else if (currentVehicleType === "truck") {
      background(195, 212, 230); // Siang jalan tol logistik antar kota
    } else {
      background(190, 220, 246); // Langit biru siang metropolitan cerah
    }
  } else {
    if (currentVehicleType === "rain") {
      background(8, 11, 18); // Langit malam mendung hujan badai
    } else if (currentVehicleType === "sport") {
      background(9, 12, 22); // Sirkuit malam modern berlampu neon
    } else if (currentVehicleType === "truck") {
      background(10, 14, 24); // Koridor jalan tol logistik perkotaan
    } else {
      background(11, 15, 26); // Metropolis malam elegan
    }
  }

  // Efek kamera getar saat tabrakan
  const shakeX = cameraShake > 0 ? (random(-1, 1) * cameraShake) : 0;
  const shakeY = cameraShake > 0 ? (random(-1, 1) * cameraShake) : 0;

  // Kamera perspektif isometrik fokus lintasan (Adaptif Responsif Desktop & Ponsel)
  const aspect = width / height;
  let camTargetX = -120;
  if (width < 600) {
    camTargetX = -90;
  }
  // Jarak kamera adaptif: memastikan seluruh lintasan dari posisi awal mobil di sisi jauh kiri (-900px)
  // hingga barikade (+320px) dan zona perbaikan (+780px) terlihat proporsional & utuh
  const neededHalfW = 960;
  const tanHalfFov = Math.tan((PI / 2.6) / 2);
  const minDepth = (neededHalfW / (tanHalfFov * aspect)) * 1.04;
  const camZ = Math.max(780, minDepth);
  const camY = -185 - Math.max(0, camZ - 780) * 0.16;

  camera(camTargetX + shakeX, camY + shakeY, camZ, camTargetX, 42, 0, 0, 1, 0);
  perspective(PI / 2.6, aspect, 10, 8000); // 8000 far plane agar gedung kejauhan utuh terlihat

  // Pencahayaan terarah + ambient dinamis sesuai mode Siang vs Malam
  if (isLight) {
    ambientLight(225);
    directionalLight(255, 252, 242, -0.35, -1, -0.6); // Cahaya matahari siang alami
  } else {
    if (currentVehicleType === "rain") {
      ambientLight(90);
      directionalLight(190, 210, 240, -0.2, -1, -0.5);
    } else if (currentVehicleType === "sport") {
      ambientLight(115);
      directionalLight(235, 240, 255, -0.3, -1, -0.6);
      pointLight(56, 189, 248, 0, -120, -300);
    } else {
      ambientLight(120);
      directionalLight(245, 245, 255, -0.3, -1, -0.6);
      pointLight(255, 225, 185, 200, -80, 150);
    }
  }

  // Skala visual: Posisi awal mobil dibuat jauh di sebelah kiri (-900px)
  // Barikade perbaikan jalan di +320px (panjang lintasan uji pengereman 1220px)
  const trackPixelStart = -900;
  const trackPixelEnd = 320;
  const trackLengthPx = trackPixelEnd - trackPixelStart;

  // Posisi X mobil dalam ruang 3D
  const carNorm = constrain(carPosM / wallDistance, 0, 1);
  const carWorldX = trackPixelStart + carNorm * trackLengthPx;

  // 0. GAMBAR LATAR BELAKANG GEDUNG PERKOTAAN METROPOLIS 3D
  drawCitySkyline();

  // 0b. GAMBAR LAMPU JALAN PJU MODERN
  drawStreetLights3D();

  // 1. GAMBAR LINTASAN JALAN PANJANG REALISTIS (Bahu, Trotoar, Aspal, Marka)
  drawRoad3D(trackPixelStart, trackPixelEnd);

  // 2. EFEK CUACA HUJAN & SEMBURAN AIR
  if (currentVehicleType === "rain") {
    updateAndDrawRain3D();
    updateAndDrawWaterSpray3D(carWorldX);
  } else if (currentVehicleType === "sport") {
    updateAndDrawSpeedTrails3D(carWorldX);
  }

  // 3. GAMBAR JEJAK REM (SKID MARKS)
  drawSkidMarks(trackPixelStart, trackLengthPx);

  // 4. GAMBAR TANDA JARAK (DISTANCE POSTS)
  drawDistanceMarkers(trackPixelStart, trackLengthPx);

  // 5. GAMBAR PENANDA JARAK PENGEREMAN TEORITIS (s) PADA JALAN
  drawStoppingDistanceMarker3D(trackPixelStart, trackLengthPx);

  // 6. GAMBAR PENGHALANG PERINGATAN JALAN DIPERBAIKI (ROAD WORK BARRIER)
  drawRoadWorkBarrier3D(trackPixelEnd);

  // 6b. GAMBAR JALAN BERLUBANG & ZONA PERBAIKAN SETELAH OBJEK PENGHALANG
  drawPotholesZone3D(trackPixelEnd);

  // 7. GAMBAR KENDARAAN 3D (Model sesuai skenario aktif)
  drawVehicle3D(carWorldX, 75, 0);

  // 8. GAMBAR PARTIKEL PERCIKAN TUMBUKAN
  if (impactParticles.length > 0) {
    drawParticles3D(trackPixelEnd - 10, 60, 0);
  }
}

// ------------------------------------------------------------
// GARIS & PENANDA JARAK PENGEREMAN TEORITIS (s) PADA JALAN
// ------------------------------------------------------------
function drawStoppingDistanceMarker3D(xStart, trackLen) {
  const a_brake = mu * g;
  const s = (v0 * v0) / (2 * a_brake);
  const isSafe = (s <= wallDistance);
  const sNorm = constrain(s / wallDistance, 0, 1.35);
  const sX = xStart + sNorm * trackLen;

  push();
  if (isSafe) {
    // Garis marka hijau emerald di jalan tepat di titik henti teoritis s
    translate(sX, 117, 0);
    fill(16, 185, 129, 210);
    box(5, 1, 230);

    // Tiang penanda di pinggir bahu jalan
    push();
    translate(0, -18, -125);
    fill(16, 185, 129);
    cylinder(2.5, 34);
    translate(0, -14, 0);
    fill(15, 23, 42);
    box(32, 14, 4);
    fill(52, 211, 153);
    box(28, 10, 5);
    pop();
  } else {
    // Garis bahaya merah menyala di depan dinding (menunjukkan s > d)
    translate(xStart + trackLen, 117, 0);
    const pulseAlpha = (frameCount % 40 < 20) ? 240 : 120;
    fill(239, 68, 68, pulseAlpha);
    box(6, 1, 230);
  }
  pop();
}

// ------------------------------------------------------------
// LINTASAN JALAN RAYA PANJANG REALISTIS (BOULEVARD / HIGHWAY)
// ------------------------------------------------------------
function drawRoad3D(xStart, xEnd) {
  const isLight = (currentTheme === "light");
  const isWet = (currentVehicleType === "rain");
  const totalRoadLength = 5400; // Jalan raya panjang membentang hingga batas cakrawala

  push();
  // 1. Dasar tanah perkotaan & rumput pembatas (Segar & Terang di Siang Hari)
  translate(0, 130, 0);
  if (isLight) {
    fill(isWet ? color(140, 168, 142) : color(152, 188, 144));
  } else {
    fill(isWet ? color(14, 18, 25) : color(20, 26, 36));
  }
  box(totalRoadLength + 200, 8, 900);

  // 2. Aspal utama jalan raya panjang (Aspal Abu-abu Terang Bersih di Siang Hari)
  translate(0, -6, 0);
  if (isLight) {
    if (isWet) {
      specularMaterial(110, 120, 132);
      shininess(120);
    } else {
      fill(130, 136, 146); // Aspal abu-abu siang hari alami & cerah
    }
  } else {
    if (isWet) {
      specularMaterial(20, 24, 32);
      shininess(110);
    } else {
      fill(36, 40, 48); // Aspal malam
    }
  }
  box(totalRoadLength, 6, 380);

  // 3. Trotoar pejalan kaki beton modern (Paving Terang di Siang Hari)
  // Trotoar sisi jauh (Z = -205)
  push();
  translate(0, -3, -205);
  fill(isLight ? color(225, 230, 238) : color(52, 60, 72));
  box(totalRoadLength, 8, 30);
  pop();

  // Trotoar sisi dekat (Z = +205)
  push();
  translate(0, -3, 205);
  fill(isLight ? color(218, 224, 232) : color(44, 52, 64));
  box(totalRoadLength, 8, 30);
  pop();

  // 4. Efek genangan air pada skenario hujan
  if (isWet) {
    push();
    fill(40, 60, 85, 130);
    translate(40, -4, -20);
    box(180, 1, 70);
    translate(-220, 0, 35);
    box(140, 1, 55);
    translate(420, 0, -40);
    box(200, 1, 65);
    pop();
  }

  // 5. Garis tepi kuning pengaman bahu jalan (Solid Yellow Shoulder Lines)
  fill(245, 197, 24);
  push();
  translate(0, -4, -185);
  box(totalRoadLength, 2, 6);
  pop();
  push();
  translate(0, -4, 185);
  box(totalRoadLength, 2, 6);
  pop();

  // 6. Garis marka jalan putih putus-putus sepanjang lintasan
  fill(235, 240, 245);
  const stripeStep = 80;
  for (let sx = -totalRoadLength / 2 + 40; sx < totalRoadLength / 2; sx += stripeStep) {
    push();
    translate(sx, -4, 0);
    box(45, 2, 7);
    pop();
  }

  // 7. Garis start pengujian pengereman (0 meter)
  push();
  translate(xStart, -4, 0);
  fill(56, 189, 248, 220);
  box(6, 3, 370);
  pop();

  pop();
}

// ------------------------------------------------------------
// JEJAK BAN PENGEREMAN (SKID MARKS)
// ------------------------------------------------------------
function drawSkidMarks(xStart, trackLen) {
  if (skidMarks.length === 0) return;

  push();
  noStroke();
  for (let i = 0; i < skidMarks.length; i += 2) {
    const sm = skidMarks[i];
    const smX = xStart + (sm.dist / wallDistance) * trackLen;
    fill(20, 22, 25, sm.alpha);

    // Jejak roda kiri & kanan
    push();
    translate(smX, 117, -30);
    box(10, 1, 9);
    pop();
    push();
    translate(smX, 117, 30);
    box(10, 1, 9);
    pop();
  }
  pop();
}

// ------------------------------------------------------------
// TIANG TANDA JARAK (0m, 10m, 20m, dst)
// ------------------------------------------------------------
function drawDistanceMarkers(xStart, trackLen) {
  const isLight = (currentTheme === "light");
  const steps = 4;
  for (let i = 0; i <= steps; i++) {
    const fraction = i / steps;
    const markerDist = fraction * wallDistance;
    const mx = xStart + fraction * trackLen;

    push();
    translate(mx, 110, -145);

    // Tiang
    fill(isLight ? color(185, 195, 210) : color(130, 140, 155));
    cylinder(3, 30);

    // Papan tanda jarak
    translate(0, -18, 0);
    fill(isLight ? color(255, 255, 255) : color(35, 45, 60));
    box(24, 14, 4);

    pop();
  }
}

// ------------------------------------------------------------
// PENGHALANG PERINGATAN PERBAIKAN JALAN (ROAD WORK BARRICADE)
// ------------------------------------------------------------
function drawRoadWorkBarrier3D(barrierX) {
  const isLight = (currentTheme === "light");
  const isCrashed = (simState === "crashed");

  push();
  translate(barrierX, 60, 0);

  // Jika tertabrak, barikade miring terdorong ke belakang
  if (isCrashed) {
    translate(14, 4, 0);
    rotateZ(radians(-10));
  }

  // 1. DUA TIANG PENOPANG UTAMA A-FRAME (TYPE III BARRICADE STANDS)
  [-100, 100].forEach((postZ) => {
    push();
    translate(0, 0, postZ);

    // Kaki horizontal penstabil di aspal
    fill(isLight ? color(215, 222, 230) : color(140, 150, 165));
    push();
    translate(0, 56, 0);
    box(46, 5, 14);
    pop();

    // Tiang vertikal putih berstruktur
    fill(isLight ? color(248, 250, 252) : color(220, 226, 235));
    push();
    translate(0, 6, 0);
    box(8, 105, 8);
    pop();

    // Lampu suar kuning peringatan konstruksi di puncak tiang (Amber Warning Beacons)
    push();
    translate(0, -52, 0);
    fill(45, 52, 60);
    cylinder(4, 10);
    translate(0, -8, 0);

    const isBlinking = isCrashed ? (frameCount % 18 < 9) : (frameCount % 46 < 23);
    if (isBlinking) {
      fill(251, 146, 60); // Amber menyala terang
      emissiveMaterial(251, 146, 60);
    } else {
      fill(180, 83, 9); // Amber redup
    }
    sphere(7.5);
    pop();

    pop();
  });

  // 2. TIGA BILAH PAPAN REFLEKTIF HORIZONTAL HAZARD ORANYE-PUTIH
  const boardY = [-28, 4, 36];
  const numStripes = 11;
  const boardSpan = 250;

  boardY.forEach((by) => {
    push();
    translate(0, by, 0);

    // Papan dasar putih reflektif
    fill(248, 250, 252);
    box(5, 22, boardSpan);

    // Garis miring chevron hazard oranye
    for (let s = 0; s < numStripes; s++) {
      if (s % 2 === 0) {
        push();
        const sz = -boardSpan / 2 + (s + 0.5) * (boardSpan / numStripes);
        translate(2.6, 0, sz);
        fill(234, 88, 12); // Safety Orange
        box(1.5, 22, boardSpan / numStripes);
        pop();
      }
    }
    pop();
  });

  // 3. PAPAN RAMBU BELAH KETUPAT KUNING BESAR: PERINGATAN JALAN RUSAK / PERBAIKAN
  push();
  translate(3.5, -58, 0);

  // Belah ketupat kuning
  push();
  rotateX(radians(45));
  fill(245, 158, 11); // Safety Yellow
  box(2, 40, 40);

  // Garis tepi hitam
  translate(1.2, 0, 0);
  fill(15, 23, 42);
  box(0.8, 35, 35);

  translate(0.8, 0, 0);
  fill(245, 158, 11);
  box(0.8, 29, 29);

  // Piktogram tanda seru / simbol jalan rusak
  translate(0.8, 0, 0);
  fill(15, 23, 42);
  box(1.0, 17, 5);
  translate(0, 11, 0);
  box(1.0, 4, 4);
  pop();

  pop();

  // 4. KERUCUT LALU LINTAS DI SEKITAR PENGHALANG (SAFETY TRAFFIC CONES)
  const conePositions = [
    { x: -35, z: -115 },
    { x: -22, z: -55 },
    { x: -22, z: 55 },
    { x: -35, z: 115 },
    { x: 38, z: -125 },
    { x: 38, z: 125 }
  ];

  conePositions.forEach((cp) => {
    push();
    translate(cp.x, 48, cp.z);

    // Dasar karet persegi hitam
    fill(24, 28, 36);
    box(16, 3, 16);

    // Badan kerucut oranye terang
    translate(0, -11, 0);
    fill(249, 115, 22);
    cone(6, 20);

    // Pita reflektif putih
    translate(0, -2, 0);
    fill(255, 255, 255);
    cone(4.5, 6);
    pop();
  });

  pop();
}

// ------------------------------------------------------------
// ZONA JALAN BERLUBANG SETELAH OBJEK PENGHALANG (DAMAGED ROAD & POTHOLES)
// ------------------------------------------------------------
function drawPotholesZone3D(barrierX) {
  const isLight = (currentTheme === "light");
  const isWet = (currentVehicleType === "rain");

  push();

  // Warna lubang, aspal rusak & material
  const holeDark = color(20, 23, 28);
  const rubbleColor = isLight ? color(110, 118, 128) : color(45, 52, 62);
  const mudPuddle = isWet ? color(32, 45, 62, 230) : color(24, 30, 38, 200);

  // 1. ZONA PENGELUPASAN ASPAL RUSAK (ASPHALT MILLING & ROUGH EXCAVATION)
  // Membentang di belakang barikade dari x = barrierX + 60 s.d. barrierX + 650
  push();
  translate(barrierX + 355, 122, 0);
  fill(isLight ? color(112, 118, 128) : color(28, 32, 40));
  box(620, 2, 280);
  pop();

  // Alur bekas pengerukan mesin milling
  for (let gx = barrierX + 70; gx <= barrierX + 630; gx += 40) {
    push();
    translate(gx, 121, 0);
    fill(isLight ? color(98, 104, 114) : color(20, 24, 30));
    box(20, 1.5, 260);
    pop();
  }

  // 2. LUBANG-LUBANG JALAN BERVARIASI UKURAN & KEDALAMAN (POTHOLES)
  const potholes = [
    { x: barrierX + 115, z: -45, w: 75, d: 52, depth: 6, hasWater: true },
    { x: barrierX + 215, z: 45, w: 98, d: 68, depth: 8, hasWater: true },
    { x: barrierX + 345, z: -25, w: 125, d: 48, depth: 7, hasWater: false },
    { x: barrierX + 465, z: 50, w: 85, d: 60, depth: 6, hasWater: true },
    { x: barrierX + 575, z: -45, w: 92, d: 55, depth: 7, hasWater: false }
  ];

  potholes.forEach((p) => {
    push();
    translate(p.x, 120 + p.depth / 2, p.z);

    // Dasar cekungan lubang aspal
    fill(holeDark);
    box(p.w, p.depth, p.d);

    // Genangan air / lumpur di dasar lubang
    if (p.hasWater || isWet) {
      push();
      translate(0, -p.depth / 2 + 1, 0);
      fill(mudPuddle);
      box(p.w * 0.76, 1, p.d * 0.76);
      pop();
    }

    // Pinggiran aspal pecah dan batu kerikil di sekitar bibir lubang (Rubble rim)
    fill(rubbleColor);
    [-p.w * 0.48, p.w * 0.48].forEach((rx) => {
      push();
      translate(rx, -p.depth / 2 - 1, 0);
      box(8, 3, p.d * 0.6);
      pop();
    });
    [-p.d * 0.48, p.d * 0.48].forEach((rz) => {
      push();
      translate(0, -p.depth / 2 - 1, rz);
      box(p.w * 0.6, 3, 8);
      pop();
    });

    pop();
  });

  // 3. TUMPUKAN MATERIAL KERIKIL / ASPAL KUPASAN (GRAVEL MOUNDS)
  const gravelMounds = [
    { x: barrierX + 155, z: -140, r: 24, h: 18 },
    { x: barrierX + 285, z: 140, r: 28, h: 22 },
    { x: barrierX + 435, z: -135, r: 22, h: 16 },
    { x: barrierX + 535, z: 135, r: 26, h: 20 }
  ];

  gravelMounds.forEach((m) => {
    push();
    translate(m.x, 122 - m.h / 2, m.z);
    fill(isLight ? color(135, 142, 150) : color(50, 56, 65));
    cone(m.r, m.h);
    pop();
  });

  // 4. TONG / DRUM PENGAMAN KONSTRUKSI (SAFETY DELINEATOR DRUMS)
  const drums = [
    { x: barrierX + 165, z: 90 },
    { x: barrierX + 270, z: -85 },
    { x: barrierX + 395, z: 95 },
    { x: barrierX + 505, z: -90 }
  ];

  drums.forEach((dm) => {
    push();
    translate(dm.x, 98, dm.z);

    // Silinder tong oranye konstruksi
    fill(249, 115, 22);
    cylinder(11, 46);

    // Dua pita reflektif putih
    translate(0, -8, 0);
    fill(255, 255, 255);
    cylinder(11.5, 8);
    translate(0, 16, 0);
    cylinder(11.5, 8);
    pop();
  });

  pop();
}

// ============================================================
// DISPATCHER PENGGAMBARAN KENDARAAN 3D
// ============================================================
function drawVehicle3D(x, y, z) {
  push();
  translate(x, y, z);

  // Kompresi bodi jika menabrak
  let crumpleX = 0;
  if (simState === "crashed") {
    crumpleX = -min(16, impactSpeed * 0.42);
  }

  // Skala ekspansi balon airbag
  let airbagSize = 0;
  if (simState === "crashed") {
    const crashProgress = constrain(collisionTime / impactTimeAirbag, 0, 1);
    const airbagInflation = sin(crashProgress * HALF_PI);
    airbagSize = map(airbagInflation, 0, 1, 6, 32);
  }

  // Render model 3D kendaraan sesuai skenario aktif
  if (currentVehicleType === "truck") {
    drawHeavyTruck3D(crumpleX, airbagSize);
  } else if (currentVehicleType === "sport") {
    drawSportCar3D(crumpleX, airbagSize);
  } else if (currentVehicleType === "rain") {
    drawRainSedan3D(crumpleX, airbagSize);
  } else {
    drawCityCar3D(crumpleX, airbagSize);
  }

  pop();
}

// ------------------------------------------------------------
// MODEL 1: MOBIL KOTA (HATCHBACK KOMPAK)
// ------------------------------------------------------------
function drawCityCar3D(crumpleX, airbagSize) {
  // Sasis utama bodi kompak (Cyan / Sky Blue Metalik)
  push();
  translate(crumpleX / 2, 0, 0);
  fill(14, 165, 233);
  ambientMaterial(14, 165, 233);
  specularMaterial(56, 189, 248);
  shininess(85);
  box(102 + crumpleX, 36, 66);

  // Grille depan modern
  push();
  translate(51 + crumpleX / 2, 6, 0);
  fill(25);
  box(2, 10, 36);
  pop();

  // Lampu depan LED
  push();
  translate(51 + crumpleX / 2, 2, -22);
  fill(255, 255, 230);
  emissiveMaterial(255, 255, 210);
  box(4, 9, 14);
  translate(0, 0, 44);
  box(4, 9, 14);
  pop();

  // Lampu rem belakang
  push();
  translate(-52, 2, -22);
  if (simState === "running" && currentSpeed > 0.1) {
    fill(255, 30, 30);
    emissiveMaterial(255, 30, 30);
  } else {
    fill(120, 20, 20);
  }
  box(4, 9, 14);
  translate(0, 0, 44);
  box(4, 9, 14);
  pop();
  pop();

  // Kabin kompak melengkung & kaca
  push();
  translate(-4 + crumpleX * 0.3, -26, 0);
  fill(30, 140, 210);
  box(58, 24, 56);

  // Kaca depan
  translate(24, 0, 0);
  fill(160, 220, 250, 210);
  box(8, 20, 52);

  // Kaca belakang
  translate(-48, 0, 0);
  box(8, 20, 52);
  pop();

  // Pengemudi dummy
  push();
  translate(8, -24, 0);
  fill(255, 195, 140);
  sphere(8);
  translate(0, 13, 0);
  fill(60, 80, 110);
  box(14, 18, 20);
  pop();

  // Setir
  push();
  translate(24, -18, 0);
  fill(30);
  box(6, 12, 16);
  pop();

  // Airbag mengembang saat tumbukan
  if (airbagSize > 0) {
    push();
    translate(22, -18, 0);
    fill(245, 245, 240, 235);
    specularMaterial(250, 250, 245);
    ellipsoid(airbagSize, airbagSize * 0.9, airbagSize * 0.85);
    pop();
  }

  // 4 Roda Berputar
  drawWheelSet(34, 32, 24, 16, 9);
}

// ------------------------------------------------------------
// MODEL 2: SEDAN KELUARGA (SKENARIO HUJAN & JALAN BASAH)
// ------------------------------------------------------------
function drawRainSedan3D(crumpleX, airbagSize) {
  // Sasis utama sedan 3-box (Slate Silver Metalik)
  push();
  translate(crumpleX / 2, 2, 0);
  fill(100, 116, 139);
  ambientMaterial(100, 116, 139);
  specularMaterial(148, 163, 184);
  shininess(110); // Kilau basah
  box(120 + crumpleX, 32, 66);

  // Grille krom horizontal depan
  push();
  translate(60 + crumpleX / 2, 2, 0);
  fill(200);
  box(3, 14, 40);
  pop();

  // Lampu kabut amber bawah
  push();
  translate(59 + crumpleX / 2, 10, -22);
  fill(255, 180, 20);
  emissiveMaterial(255, 180, 20);
  box(3, 6, 12);
  translate(0, 0, 44);
  box(3, 6, 12);
  pop();

  // Lampu depan Xenon
  push();
  translate(60 + crumpleX / 2, -2, -22);
  fill(240, 245, 255);
  emissiveMaterial(230, 240, 255);
  box(4, 8, 14);
  translate(0, 0, 44);
  box(4, 8, 14);
  pop();

  // Lampu rem belakang + high mount
  push();
  translate(-61, 0, -22);
  if (simState === "running" && currentSpeed > 0.1) {
    fill(255, 20, 20);
    emissiveMaterial(255, 20, 20);
  } else {
    fill(120, 20, 20);
  }
  box(4, 8, 14);
  translate(0, 0, 44);
  box(4, 8, 14);
  pop();
  pop();

  // Kabin sedan lebih panjang dengan kaca depan landai
  push();
  translate(-6 + crumpleX * 0.3, -25, 0);
  fill(85, 100, 120);
  box(64, 23, 58);

  // Kaca depan
  translate(26, 0, 0);
  fill(150, 200, 235, 200);
  box(8, 19, 54);

  // Indikasi wiper kaca
  translate(2, 6, 0);
  fill(20);
  box(3, 2, 38);

  // Kaca belakang sedan
  translate(-56, -6, 0);
  fill(150, 200, 235, 200);
  box(8, 19, 54);
  pop();

  // Pengemudi dummy
  push();
  translate(6, -24, 0);
  fill(255, 195, 140);
  sphere(8);
  translate(0, 13, 0);
  fill(55, 75, 95);
  box(14, 18, 20);
  pop();

  // Setir
  push();
  translate(24, -18, 0);
  fill(30);
  box(6, 12, 16);
  pop();

  // Airbag saat tumbukan
  if (airbagSize > 0) {
    push();
    translate(22, -18, 0);
    fill(245, 245, 240, 235);
    specularMaterial(250, 250, 245);
    ellipsoid(airbagSize, airbagSize * 0.9, airbagSize * 0.85);
    pop();
  }

  // 4 Roda Sedan Berputar
  drawWheelSet(34, 38, 24, 16, 9);
}

// ------------------------------------------------------------
// MODEL 3: SUPERCAR SPORT (KECEPATAN TINGGI & AERODINAMIS)
// ------------------------------------------------------------
function drawSportCar3D(crumpleX, airbagSize) {
  // Sasis ceper agresif (Merah Balap / Crimson Racing Red)
  push();
  translate(crumpleX / 2, 7, 0);
  fill(225, 29, 72);
  ambientMaterial(225, 29, 72);
  specularMaterial(244, 63, 94);
  shininess(125);
  box(114 + crumpleX, 22, 70);

  // Garis balap putih ganda (Dual Racing Stripes) di atas bodi
  push();
  translate(0, -12, 0);
  fill(245, 245, 250);
  box(112 + crumpleX, 2, 14);
  pop();

  // Splitter aerodinamis karbon depan
  push();
  translate(57 + crumpleX / 2, 8, 0);
  fill(20);
  box(10, 4, 72);
  pop();

  // Lampu depan sipit tajam
  push();
  translate(56 + crumpleX / 2, 0, -24);
  fill(255, 255, 240);
  emissiveMaterial(255, 255, 230);
  box(4, 6, 14);
  translate(0, 0, 48);
  box(4, 6, 14);
  pop();

  // Knalpot ganda krom belakang
  push();
  translate(-58, 6, -14);
  fill(200);
  rotateZ(HALF_PI);
  cylinder(4, 8);
  translate(0, 28, 0);
  cylinder(4, 8);
  pop();

  // Lampu rem belakang sport
  push();
  translate(-58, -2, -22);
  if (simState === "running" && currentSpeed > 0.1) {
    fill(255, 10, 10);
    emissiveMaterial(255, 10, 10);
  } else {
    fill(130, 15, 15);
  }
  box(4, 6, 16);
  translate(0, 0, 44);
  box(4, 6, 16);
  pop();
  pop();

  // Kokpit kaca aerodinamis rendah (Bubble Canopy)
  push();
  translate(-6 + crumpleX * 0.3, -12, 0);
  fill(180, 20, 50);
  box(52, 18, 54);

  // Kaca gelap kokpit
  translate(14, 0, 0);
  fill(40, 50, 70, 230);
  box(24, 15, 50);
  pop();

  // Sayap spoiler GT Wing besar di belakang
  push();
  translate(-48, -4, 0);
  // Tiang penyangga sayap
  fill(25);
  push();
  translate(0, -6, -20);
  box(4, 16, 3);
  translate(0, 0, 40);
  box(4, 16, 3);
  pop();
  // Bilah sayap utama aerodinamis
  translate(0, -15, 0);
  fill(20);
  specularMaterial(40, 40, 40);
  box(16, 3, 68);
  pop();

  // Pengemudi dummy dengan Helm Balap
  push();
  translate(6, -14, 0);
  // Helm kuning/merah balap
  fill(245, 180, 20);
  sphere(7);
  // Visor helm hitam
  translate(4, -1, 0);
  fill(20);
  box(3, 4, 9);
  // Badan baju balap
  translate(-4, 13, 0);
  fill(200, 25, 40);
  box(12, 16, 18);
  pop();

  // Setir sport
  push();
  translate(22, -9, 0);
  fill(25);
  box(5, 10, 14);
  pop();

  // Airbag saat tumbukan kecepatan tinggi
  if (airbagSize > 0) {
    push();
    translate(20, -10, 0);
    fill(245, 245, 240, 235);
    specularMaterial(250, 250, 245);
    ellipsoid(airbagSize, airbagSize * 0.85, airbagSize * 0.85);
    pop();
  }

  // 4 Roda Balap Rendah (Velg Hitam Sport + Kaliper Merah)
  drawWheelSet(36, 36, 24, 15, 11, [25, 25, 25]);
}

// ------------------------------------------------------------
// MODEL 4: TRUK MUATAN BERAT (6 RODA & KONTENGER BESAR)
// ------------------------------------------------------------
function drawHeavyTruck3D(crumpleX, airbagSize) {
  // Sasis baja hitam kokoh memanjang
  push();
  translate(-8, 14, 0);
  fill(30, 35, 42);
  box(152, 10, 52);
  pop();

  // 1. KABIN DEPAN TINGGI (Bright Caterpillar Yellow-Orange)
  push();
  translate(42 + crumpleX / 2, -15, 0);
  fill(245, 158, 11);
  ambientMaterial(245, 158, 11);
  specularMaterial(251, 191, 36);
  shininess(75);
  box(52 + crumpleX, 48, 68);

  // Kaca depan kabin tegak & tinggi
  push();
  translate(26 + crumpleX / 2, -6, 0);
  fill(140, 190, 230, 210);
  box(4, 22, 60);
  pop();

  // Pelindung matahari (Sun Visor) atas kabin
  push();
  translate(24 + crumpleX / 2, -22, 0);
  fill(30);
  box(8, 4, 64);
  pop();

  // 3 Lampu penanda atap (Clearance roof lights)
  push();
  translate(22 + crumpleX / 2, -25, -18);
  fill(255, 160, 20);
  emissiveMaterial(255, 160, 20);
  sphere(2.5);
  translate(0, 0, 18);
  sphere(2.5);
  translate(0, 0, 18);
  sphere(2.5);
  pop();

  // Grill krom vertikal besar khas truk komersial
  push();
  translate(27 + crumpleX / 2, 10, 0);
  fill(210);
  specularMaterial(230, 230, 235);
  box(3, 24, 46);
  // Garis kisi-kisi grill
  fill(40);
  box(4, 20, 40);
  pop();

  // Bumper besi depan berat
  push();
  translate(28 + crumpleX / 2, 25, 0);
  fill(35, 40, 48);
  box(8, 10, 74);
  // Lampu kabut truk
  translate(0, 0, -24);
  fill(255, 255, 200);
  emissiveMaterial(255, 255, 200);
  box(4, 6, 12);
  translate(0, 0, 48);
  box(4, 6, 12);
  pop();

  // Spion samping kabin besar
  push();
  translate(10, -4, -37);
  fill(30);
  box(4, 14, 3);
  translate(0, 0, 74);
  box(4, 14, 3);
  pop();
  pop();

  // 2. CEROBONG KNALPOT VERTIKAL GANDA (CHROME EXHAUST STACKS)
  push();
  translate(14, -30, -35);
  fill(210);
  specularMaterial(230, 230, 235);
  cylinder(3.5, 46);
  translate(0, 0, 70);
  cylinder(3.5, 46);
  pop();

  // 3. TANGKI BAHAN BAKAR SILINDER
  push();
  translate(8, 18, -30);
  fill(180);
  specularMaterial(200, 200, 210);
  rotateZ(HALF_PI);
  cylinder(9, 26);
  translate(0, 60, 0);
  cylinder(9, 26);
  pop();

  // 4. KONTAINER / BOX KARGO BESAR DI BELAKANG
  push();
  translate(-32, -18, 0);
  specularMaterial(225, 230, 240);
  shininess(40);
  box(90, 58, 70);

  // Garis-garis panel kontainer kargo
  fill(190, 195, 205);
  for (let ribX = -36; ribX <= 36; ribX += 18) {
    push();
    translate(ribX, 0, -36);
    box(3, 52, 2);
    translate(0, 0, 72);
    box(3, 52, 2);
    pop();
  }

  // Pita reflektor hazard merah-putih di sisi bawah kontainer
  push();
  translate(0, 25, -36);
  fill(235, 40, 40);
  box(88, 4, 1);
  translate(0, 0, 72);
  box(88, 4, 1);
  pop();

  // Pintu kargo belakang & pengait batang baja
  push();
  translate(-46, 0, 0);
  fill(40);
  box(2, 54, 66);
  fill(200);
  translate(0, 0, -12);
  box(3, 48, 3);
  translate(0, 0, 24);
  box(3, 48, 3);
  pop();
  pop();

  // 5. PENGEMUDI DUDUK TINGGI DI DALAM KABIN TRUK
  push();
  translate(42, -22, 0);
  fill(255, 195, 140);
  sphere(8);
  translate(0, 13, 0);
  fill(50, 70, 95);
  box(14, 18, 20);
  pop();

  // Setir truk besar miring 45 derajat
  push();
  translate(58, -14, 0);
  rotateZ(-0.4);
  fill(30);
  box(4, 14, 18);
  pop();

  // Airbag kabin truk besar
  if (airbagSize > 0) {
    push();
    translate(56, -16, 0);
    fill(245, 245, 240, 235);
    specularMaterial(250, 250, 245);
    ellipsoid(airbagSize * 1.2, airbagSize * 1.1, airbagSize * 1.05);
    pop();
  }

  // 6. RODA GANDA / 6 RODA BESAR TRUK
  // 1 Pasang Roda Depan (wx = 46), 2 Pasang Roda Belakang Tandem (wx = -22 dan wx = -58)
  const truckWheelRadius = 18;
  const truckWheelWidth = 12;
  const truckWheelY = 22; // Menyentuh jalan sempurna pada Y = 115
  const truckOffsetZ = 37;

  const truckAxles = [46, -22, -58]; // 3 as roda = 6 roda!
  for (let wx of truckAxles) {
    for (let wz of [-truckOffsetZ, truckOffsetZ]) {
      push();
      translate(wx, truckWheelY, wz);
      rotateZ(wheelRotation);
      rotateX(HALF_PI);

      // Ban tebal bergerigi hitam
      fill(22);
      cylinder(truckWheelRadius, truckWheelWidth);

      // Velg baja industri
      fill(160);
      cylinder(truckWheelRadius * 0.52, truckWheelWidth + 1);

      // Hubcap tengah
      fill(80);
      cylinder(truckWheelRadius * 0.22, truckWheelWidth + 2);
      pop();
    }
  }
}

// ------------------------------------------------------------
// HELPER: MENGGAMBAR 4 RODA MOBIL DENGAN ROTASI REALISTIS
// ------------------------------------------------------------
function drawWheelSet(offsetZ, offsetX, wheelY, radius, width, rimColor = [185, 185, 185]) {
  for (let wx of [-offsetX, offsetX]) {
    for (let wz of [-offsetZ, offsetZ]) {
      push();
      translate(wx, wheelY, wz);
      rotateZ(wheelRotation);
      rotateX(HALF_PI);

      // Ban karet hitam
      fill(25);
      cylinder(radius, width);

      // Velg alloy
      fill(rimColor[0], rimColor[1], rimColor[2]);
      cylinder(radius * 0.52, width + 1);

      // Baut tengah
      fill(80);
      cylinder(radius * 0.2, width + 1.5);
      pop();
    }
  }
}

// ------------------------------------------------------------
// RENDER PARTIKEL PERCIKAN 3D
// ------------------------------------------------------------
function drawParticles3D(px, py, pz) {
  push();
  translate(px, py, pz);
  noStroke();
  for (let p of impactParticles) {
    push();
    translate(p.x, p.y, p.z);
    fill(p.col[0], p.col[1], p.col[2], p.life * 255);
    sphere(p.size * p.life);
    pop();
  }
  pop();
}

// ============================================================
// GRAFIK IMPULS 2D (GAYA VS WAKTU) PADA CANVAS TERPISAH
// ============================================================
function drawImpulseGraph(isColliding = false, animTime = 0) {
  if (!graphCanvas || !graphCtx) return;

  // Skalakan resolusi tajam pada layar Retina / Ponsel ber-DPI tinggi
  const rect = graphCanvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const displayW = rect.width > 0 ? rect.width : 700;
  const displayH = 190;

  if (graphCanvas.width !== Math.round(displayW * dpr) || graphCanvas.height !== Math.round(displayH * dpr)) {
    graphCanvas.width = Math.round(displayW * dpr);
    graphCanvas.height = Math.round(displayH * dpr);
  }

  const w = displayW;
  const h = displayH;
  const ctx = graphCtx;

  ctx.save();
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, w, h);

  // Perhitungan Fisika untuk Grafik
  const a_brake = mu * g;
  const s_brake = (v0 * v0) / (2 * a_brake);
  let v_crash = v0;

  if (s_brake > wallDistance) {
    const v_sq = (v0 * v0) - (2 * a_brake * wallDistance);
    v_crash = v_sq > 0 ? Math.sqrt(v_sq) : 0;
  }

  const p_impact = mass * v_crash; // kg·m/s
  const tMax = Math.max(0.40, impactTimeAirbag + 0.08);

  // Gaya puncak sinusoidal: F_peak = (pi / 2) * (p / dt)
  const F_peak_no = (Math.PI / 2) * (p_impact / DT_NO_AIRBAG);
  const F_peak_air = (Math.PI / 2) * (p_impact / impactTimeAirbag);
  const maxForceAxis = Math.max(F_peak_no * 1.15, 1000);

  // Margin grafik responsif
  const padLeft = displayW < 450 ? 50 : 70;
  const padRight = 20;
  const padTop = 20;
  const padBottom = 35;
  const plotW = w - padLeft - padRight;
  const plotH = h - padTop - padBottom;

  // 1. Grid Sumbu & Skala (Mendukung Mode Siang & Malam)
  const isLight = (currentTheme === "light");
  ctx.strokeStyle = isLight ? "rgba(15, 23, 42, 0.08)" : "rgba(255, 255, 255, 0.07)";
  ctx.lineWidth = 1;
  ctx.font = "11px ui-monospace, monospace";
  ctx.fillStyle = isLight ? "#64748b" : "#94a3b8";

  // Garis horizontal (Gaya)
  const ySteps = 4;
  for (let i = 0; i <= ySteps; i++) {
    const yVal = (maxForceAxis * i) / ySteps;
    const yPx = padTop + plotH - (i / ySteps) * plotH;
    ctx.beginPath();
    ctx.moveTo(padLeft, yPx);
    ctx.lineTo(padLeft + plotW, yPx);
    ctx.stroke();

    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillText(`${(yVal / 1000).toFixed(0)}k`, padLeft - 6, yPx);
  }

  // Garis vertikal (Waktu)
  const xSteps = 5;
  for (let i = 0; i <= xSteps; i++) {
    const tVal = (tMax * i) / xSteps;
    const xPx = padLeft + (i / xSteps) * plotW;
    ctx.beginPath();
    ctx.moveTo(xPx, padTop);
    ctx.lineTo(xPx, padTop + plotH);
    ctx.stroke();

    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(`${tVal.toFixed(2)}s`, xPx, padTop + plotH + 8);
  }

  // Label Sumbu dengan Notasi Matematis
  ctx.fillStyle = isLight ? "#334155" : "#cbd5e1";
  ctx.font = "600 11px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Waktu Benturan t (s)", padLeft + plotW / 2, h - 6);

  ctx.save();
  ctx.translate(14, padTop + plotH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText("Gaya Impuls F (kN)", 0, 0);
  ctx.restore();

  // Helper fungsi proyeksi koordinat
  const toX = (t) => padLeft + (t / tMax) * plotW;
  const toY = (f) => padTop + plotH - (f / maxForceAxis) * plotH;

  // 2. PLOT KURVA MERAH: TANPA AIRBAG (dt = 0.05s)
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(toX(0), toY(0));
  const stepsNo = 40;
  for (let i = 0; i <= stepsNo; i++) {
    const t = (DT_NO_AIRBAG * i) / stepsNo;
    const f = F_peak_no * Math.sin((Math.PI * t) / DT_NO_AIRBAG);
    ctx.lineTo(toX(t), toY(f));
  }
  ctx.lineTo(toX(DT_NO_AIRBAG), toY(0));
  ctx.closePath();

  // Gradient area bawah kurva
  const gradRed = ctx.createLinearGradient(0, padTop, 0, padTop + plotH);
  gradRed.addColorStop(0, "rgba(239, 68, 68, 0.35)");
  gradRed.addColorStop(1, "rgba(239, 68, 68, 0.02)");
  ctx.fillStyle = gradRed;
  ctx.fill();

  ctx.strokeStyle = "#ef4444";
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.restore();

  // 3. PLOT KURVA BIRU: DENGAN AIRBAG (dt = impactTimeAirbag)
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(toX(0), toY(0));
  const stepsAir = 60;
  for (let i = 0; i <= stepsAir; i++) {
    const t = (impactTimeAirbag * i) / stepsAir;
    const f = F_peak_air * Math.sin((Math.PI * t) / impactTimeAirbag);
    ctx.lineTo(toX(t), toY(f));
  }
  ctx.lineTo(toX(impactTimeAirbag), toY(0));
  ctx.closePath();

  const gradBlue = ctx.createLinearGradient(0, padTop, 0, padTop + plotH);
  gradBlue.addColorStop(0, "rgba(56, 189, 248, 0.35)");
  gradBlue.addColorStop(1, "rgba(56, 189, 248, 0.02)");
  ctx.fillStyle = gradBlue;
  ctx.fill();

  ctx.strokeStyle = "#38bdf8";
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.restore();

  // 4. PENANDA GAYA PUNCAK DENGAN NOTASI MATEMATIS
  ctx.fillStyle = isLight ? "#b91c1c" : "#ef4444";
  ctx.font = "bold 11px ui-monospace, monospace";
  ctx.textAlign = "left";
  ctx.fillText(`F_peak (tanpa airbag) = ${(F_peak_no / 1000).toFixed(0)} kN`, toX(DT_NO_AIRBAG / 2) + 6, toY(F_peak_no) + 4);

  ctx.fillStyle = isLight ? "#0284c7" : "#38bdf8";
  ctx.fillText(`F_peak (airbag) = ${(F_peak_air / 1000).toFixed(0)} kN`, toX(impactTimeAirbag / 2) + 6, toY(F_peak_air) - 6);

  // 5. ANIMASI GARIS WAKTU SAAT BENTURAN
  if (isColliding && animTime > 0 && animTime <= tMax) {
    const scanX = toX(animTime);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(scanX, padTop);
    ctx.lineTo(scanX, padTop + plotH);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(scanX, padTop + plotH, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

// ============================================================
// PENCATATAN PERCOBAAN KE TABEL DATA
// ============================================================
function recordTrial() {
  if (simState === "idle" && simMotionDuration === 0) {
    return; // Belum ada simulasi yang dijalankan
  }

  if (!domTrialTableBody) return;

  trialCount++;

  const v0_kmh_val = (v0 * 3.6).toFixed(1);
  const a_brake = mu * g;
  const s_henti = (v0 * v0) / (2 * a_brake);
  const isSafe = s_henti <= wallDistance;

  // Kecepatan benturan (jika terjadi tabrakan)
  let v_impact_ms = 0;
  if (!isSafe) {
    const v_sq = (v0 * v0) - (2 * a_brake * wallDistance);
    v_impact_ms = v_sq > 0 ? Math.sqrt(v_sq) : 0;
  }
  const v_impact_kmh = (v_impact_ms * 3.6).toFixed(1);
  const hasilText = isSafe ? "Aman" : "Tabrakan";
  const hasilClass = isSafe ? "result-safe" : "result-crash";

  // Waktu gerak nyata atau analitik GLBB
  const t_teori = isSafe ? (v0 / a_brake) : ((v0 - v_impact_ms) / a_brake);
  const t_gerak_val = (simMotionDuration > 0 ? simMotionDuration : t_teori).toFixed(2);

  // Hapus placeholder jika ada
  const placeholder = domTrialTableBody.querySelector("tr td.no-data");
  if (placeholder) {
    domTrialTableBody.innerHTML = "";
  }

  const tr = document.createElement("tr");
  tr.innerHTML = [
    `<td>${trialCount}</td>`,
    `<td>${v0_kmh_val}</td>`,
    `<td>${mu.toFixed(2)}</td>`,
    `<td>${mass}</td>`,
    `<td>${wallDistance}</td>`,
    `<td>${impactTimeAirbag.toFixed(2)}</td>`,
    `<td>${t_gerak_val}</td>`,
    `<td>${s_henti.toFixed(2)}</td>`,
    `<td>${isSafe ? "-" : v_impact_kmh}</td>`,
    `<td class="${hasilClass}">${hasilText}</td>`
  ].join("");
  domTrialTableBody.appendChild(tr);
}

function clearTrialTable() {
  trialCount = 0;
  if (domTrialTableBody) {
    domTrialTableBody.innerHTML =
      '<tr><td colspan="10" class="no-data">Belum ada percobaan dicatat. Jalankan simulasi lalu tekan tombol Catat.</td></tr>';
  }
}

// ============================================================
// RESPONSIF UKURAN JENDELA BROWSER
// ============================================================
function windowResized() {
  const container = document.getElementById("canvas-container");
  if (container) {
    resizeCanvas(container.clientWidth, container.clientHeight);
  }
  drawImpulseGraph();
}
