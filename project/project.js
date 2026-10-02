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
let wallDistance = 35;    // Jarak ke dinding rintangan (m)
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

// ---------- MODEL OBJEK KENDARAAN & EFEK CUACA ----------
let currentVehicleType = "city"; // "city" | "rain" | "sport" | "truck"
let domVehicleSelect, domVehicleBadge, domHudVehicleName;
let rainParticles = [];
let waterSprayParticles = [];
let speedTrailParticles = [];

// ---------- ELEMEN DOM ----------
let domSpeed, domMass, domMu, domDist, domAirbag;
let domBadgeSpeed, domBadgeMass, domBadgeMu, domBadgeDist, domBadgeAirbag;
let domBtnStart, domBtnPause, domBtnReset;
let domStatusBadge, domStatusText, domHudAlert;
let domHudSpeed, domHudPos, domHudTarget, domHudAccel;
let domValKinetic, domValMomentum, domValBrakeDist, domValBrakeStatus, domValReduction, domValForceCompare;
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
  domBtnPause = document.getElementById("btnPause");
  domBtnReset = document.getElementById("btnReset");

  domStatusBadge = document.getElementById("statusBadge");
  domStatusText = document.getElementById("statusText");
  domHudAlert = document.getElementById("hudAlert");

  domHudSpeed = document.getElementById("hudSpeed");
  domHudPos = document.getElementById("hudPos");
  domHudTarget = document.getElementById("hudTarget");
  domHudAccel = document.getElementById("hudAccel");

  domValKinetic = document.getElementById("valKinetic");
  domValMomentum = document.getElementById("valMomentum");
  domValBrakeDist = document.getElementById("valBrakeDist");
  domValBrakeStatus = document.getElementById("valBrakeStatus");
  domValReduction = document.getElementById("valReduction");
  domValForceCompare = document.getElementById("valForceCompare");

  graphCanvas = document.getElementById("forceGraphCanvas");
  if (graphCanvas) {
    graphCtx = graphCanvas.getContext("2d");
  }

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

  const infoMap = {
    city: { badge: "Mobil Kota", hud: "🚗 Mobil Kota" },
    rain: { badge: "Sedan Hujan", hud: "🌧️ Sedan (Jalan Basah)" },
    sport: { badge: "Supercar Sport", hud: "⚡ Supercar Sport" },
    truck: { badge: "Truk 6 Roda", hud: "🚚 Truk Muatan Berat" }
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

  // Perbarui kelas tombol preset aktif
  const presetButtons = document.querySelectorAll(".btn-preset");
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
  if (domBadgeSpeed) domBadgeSpeed.textContent = `${v0_kmh} km/jam`;
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
// PERHITUNGAN FISIKA ANALITIK
// ============================================================
function updateCalculatedMetrics() {
  const Ek_initial = 0.5 * mass * (v0 * v0); // Joule
  const p_initial = mass * v0;              // kg·m/s
  const a_brake = mu * g;                    // m/s^2
  const s_brake = (v0 * v0) / (2 * a_brake); // meter

  // Taksiran kecepatan tumbukan jika jarak tidak cukup
  let v_crash = 0;
  if (s_brake > wallDistance) {
    const v_sq = (v0 * v0) - (2 * a_brake * wallDistance);
    v_crash = v_sq > 0 ? Math.sqrt(v_sq) : 0;
  }

  // Momentum yang diserap pada benturan
  const p_impact = (v_crash > 0 ? mass * v_crash : p_initial);

  // Gaya rata-rata
  const F_no = p_impact / DT_NO_AIRBAG;
  const F_air = p_impact / impactTimeAirbag;
  const reduction = ((F_no - F_air) / F_no) * 100;

  // Tampilkan ke kartu metrik
  if (domValKinetic) domValKinetic.textContent = `${(Ek_initial / 1000).toFixed(1)} kJ`;
  if (domValMomentum) domValMomentum.textContent = `${Math.round(p_initial).toLocaleString()} kg·m/s`;
  if (domValBrakeDist) domValBrakeDist.textContent = `${s_brake.toFixed(1)} m`;

  if (domValBrakeStatus) {
    if (s_brake <= wallDistance) {
      domValBrakeStatus.textContent = `Aman: Berhenti ${(wallDistance - s_brake).toFixed(1)} m sebelum dinding`;
      domValBrakeStatus.style.color = "#10b981";
    } else {
      domValBrakeStatus.textContent = `Bahaya: Menabrak pada kecepatan ${(v_crash * 3.6).toFixed(1)} km/jam!`;
      domValBrakeStatus.style.color = "#ef4444";
    }
  }

  if (domValReduction) domValReduction.textContent = `${reduction.toFixed(1)} %`;
  if (domValForceCompare) {
    domValForceCompare.textContent = `F_airbag: ${(F_air / 1000).toFixed(1)} kN vs F_tanpa: ${(F_no / 1000).toFixed(1)} kN`;
  }

  if (domHudTarget) domHudTarget.textContent = `${wallDistance.toFixed(1)} m`;
  if (domHudAccel) domHudAccel.textContent = `-${a_brake.toFixed(2)} m/s²`;
}

// ============================================================
// KONTROL SIMULASI (START / PAUSE / RESET)
// ============================================================
function toggleStart() {
  if (simState === "idle" || simState === "safe" || simState === "crashed") {
    resetSimulation();
    simState = "running";
    updateStatusUI("🟢 Sedang Melaju & Mengerem...", "var(--success)");
    if (domBtnStart) {
      domBtnStart.innerHTML = "<span>↻</span> <span>Ulangi Simulasi</span>";
    }
  } else if (simState === "paused") {
    simState = "running";
    updateStatusUI("🟢 Melanjutkan Simulasi...", "var(--success)");
  }
}

function togglePause() {
  if (simState === "running") {
    simState = "paused";
    updateStatusUI("🟡 Simulasi Dijeda", "var(--warning)");
    if (domBtnPause) domBtnPause.textContent = "▶ Lanjut";
  } else if (simState === "paused") {
    simState = "running";
    updateStatusUI("🟢 Sedang Berjalan...", "var(--success)");
    if (domBtnPause) domBtnPause.textContent = "⏸ Jeda";
  }
}

function resetSimulation() {
  onParamChange();
  simState = "idle";
  carPosM = 0;
  currentSpeed = v0;
  collisionTime = 0;
  wheelRotation = 0;
  impactSpeed = 0;
  cameraShake = 0;
  skidMarks = [];
  impactParticles = [];

  updateStatusUI("Siap Dijalankan", "var(--primary)");
  if (domBtnStart) domBtnStart.innerHTML = "<span>▶</span> <span>Mulai Simulasi</span>";
  if (domBtnPause) domBtnPause.textContent = "⏸ Jeda";
  if (domHudAlert) domHudAlert.style.display = "none";

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
    domHudSpeed.textContent = `${kmh} km/jam`;
  }
  if (domHudPos) {
    domHudPos.textContent = `${carPosM.toFixed(1)} m`;
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
  // Ambil delta waktu frame yang aman (maksimal 33 ms)
  const dt = min(deltaTime / 1000, 0.033);

  // JIKA SEDANG MELUNCUR & MENGEREM
  if (simState === "running") {
    const a_brake = mu * g; // Deselerasi (m/s^2)
    currentSpeed = max(0, currentSpeed - a_brake * dt);

    const prevPos = carPosM;
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
        // TERJADI TABRAKAN
        simState = "crashed";
        collisionTime = 0;
        currentSpeed = 0;
        cameraShake = min(25, impactSpeed * 0.9);

        // Buat partikel percikan benturan
        createImpactParticles();

        updateStatusUI("🔴 TUMBUKAN TERJADI!", "var(--danger)");
        if (domHudAlert) {
          domHudAlert.style.display = "flex";
          domHudAlert.style.background = "rgba(239, 68, 68, 0.25)";
          domHudAlert.style.borderColor = "rgba(239, 68, 68, 0.6)";
          domHudAlert.innerHTML = `⚠️ BENTURAN (${(impactSpeed * 3.6).toFixed(1)} km/jam)`;
        }

        // Render kurva impuls dengan data tabrakan nyata
        drawImpulseGraph(true);
      } else {
        // Berhenti pas di depan dinding
        simState = "safe";
        currentSpeed = 0;
        updateStatusUI("✅ BERHENTI SEMPURNA", "var(--success)");
      }
    } else if (currentSpeed <= 0.01) {
      // BERHENTI SELAMAT SEBELUM DINDING
      currentSpeed = 0;
      simState = "safe";
      updateStatusUI(`✅ AMAN: Berhenti ${(wallDistance - carPosM).toFixed(1)} m sebelum dinding`, "var(--success)");
      if (domHudAlert) {
        domHudAlert.style.display = "flex";
        domHudAlert.style.background = "rgba(16, 185, 129, 0.2)";
        domHudAlert.style.borderColor = "rgba(16, 185, 129, 0.5)";
        domHudAlert.innerHTML = `🛡️ KENDARAAN BERHENTI AMAN`;
      }
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
// VISUALISASI 3D LINTASAN, KENDARAAN & DINDING
// ============================================================
function drawScene3D() {
  // Latar belakang atmosfer dinamis berdasarkan skenario
  if (currentVehicleType === "rain") {
    background(9, 13, 22); // Langit malam mendung hujan badai
  } else if (currentVehicleType === "sport") {
    background(10, 14, 25); // Sirkuit malam modern
  } else if (currentVehicleType === "truck") {
    background(11, 16, 26); // Jalan tol logistik antar kota
  } else {
    background(13, 18, 30); // Studio malam perkotaan elegan
  }

  // Efek kamera getar saat tabrakan
  const shakeX = cameraShake > 0 ? (random(-1, 1) * cameraShake) : 0;
  const shakeY = cameraShake > 0 ? (random(-1, 1) * cameraShake) : 0;

  // Kamera perspektif isometrik fokus lintasan
  camera(
    shakeX, -165 + shakeY, 560,
    0, 35, 0,
    0, 1, 0
  );

  // Pencahayaan terarah + ambient dinamis
  if (currentVehicleType === "rain") {
    ambientLight(95);
    directionalLight(210, 225, 255, -0.2, -1, -0.5);
  } else {
    ambientLight(125);
    directionalLight(255, 255, 255, -0.3, -1, -0.6);
  }
  pointLight(255, 230, 200, 200, -80, 150);

  // Skala visual: Lintasan di layar berjarak -340px (posisi 0m) hingga +340px (posisi D dinding)
  const trackPixelStart = -340;
  const trackPixelEnd = 340;
  const trackLengthPx = trackPixelEnd - trackPixelStart;

  // Posisi X mobil dalam ruang 3D
  const carNorm = constrain(carPosM / wallDistance, 0, 1);
  const carWorldX = trackPixelStart + carNorm * trackLengthPx;

  // 1. GAMBAR LINTASAN JALAN (Disesuaikan basah/kering)
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

  // 5. GAMBAR DINDING PENGHALANG (CRASH WALL)
  drawBarrierWall3D(trackPixelEnd);

  // 6. GAMBAR KENDARAAN 3D (Model sesuai skenario aktif)
  drawVehicle3D(carWorldX, 75, 0);

  // 7. GAMBAR PARTIKEL PERCIKAN TUMBUKAN
  if (impactParticles.length > 0) {
    drawParticles3D(trackPixelEnd - 15, 60, 0);
  }
}

// ------------------------------------------------------------
// LINTASAN JALAN RAYA (Kering / Basah Licin Sesuai Skenario)
// ------------------------------------------------------------
function drawRoad3D(xStart, xEnd) {
  const roadWidth = (xEnd - xStart) + 120;
  const roadCenterX = (xStart + xEnd) / 2;
  const isWet = (currentVehicleType === "rain");

  push();
  // Bahu jalan / rumput dasar
  translate(roadCenterX, 130, 0);
  if (isWet) {
    fill(18, 24, 30);
  } else {
    fill(25, 33, 44);
  }
  box(roadWidth + 140, 8, 380);

  // Aspal utama
  translate(0, -6, 0);
  if (isWet) {
    specularMaterial(20, 24, 32);
    shininess(110); // Aspal basah berkilau memantulkan cahaya
  } else {
    fill(40, 44, 52);
  }
  box(roadWidth, 6, 260);

  // Efek genangan air pada skenario hujan
  if (isWet) {
    push();
    fill(40, 60, 85, 120);
    translate(40, -4, -20);
    box(180, 1, 70);
    translate(-220, 0, 35);
    box(140, 1, 55);
    pop();
  }

  // Garis tepi kuning
  fill(245, 197, 24);
  push();
  translate(0, -4, -118);
  box(roadWidth, 2, 6);
  pop();
  push();
  translate(0, -4, 118);
  box(roadWidth, 2, 6);
  pop();

  // Garis marka jalan putih putus-putus
  fill(235, 240, 245);
  const stripeStep = 80;
  for (let sx = -roadWidth / 2 + 30; sx < roadWidth / 2; sx += stripeStep) {
    push();
    translate(sx, -4, 0);
    box(45, 2, 7);
    pop();
  }
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
  const steps = 4;
  for (let i = 0; i <= steps; i++) {
    const fraction = i / steps;
    const markerDist = fraction * wallDistance;
    const mx = xStart + fraction * trackLen;

    push();
    translate(mx, 110, -145);

    // Tiang
    fill(130, 140, 155);
    cylinder(3, 30);

    // Papan tanda kecil
    translate(0, -18, 0);
    fill(35, 45, 60);
    box(24, 14, 4);

    pop();
  }
}

// ------------------------------------------------------------
// DINDING BENTURAN (CRASH BARRIER)
// ------------------------------------------------------------
function drawBarrierWall3D(wallX) {
  push();
  translate(wallX + 22, 38, 0);

  // Blok beton utama
  fill(90, 95, 105);
  box(36, 170, 260);

  // Strip peringatan hazard kuning-hitam
  const stripeCount = 7;
  for (let j = 0; j < stripeCount; j++) {
    push();
    translate(-19, -65 + j * 22, 0);
    fill(j % 2 === 0 ? color(245, 197, 24) : color(25, 25, 30));
    box(2, 18, 255);
    pop();
  }

  // Sensor tumbukan merah di permukaan depan
  push();
  translate(-19, 30, 0);
  fill(simState === "crashed" ? color(255, 50, 50) : color(180, 40, 40));
  box(3, 30, 100);
  pop();

  // Lampu peringatan berkedip di atas dinding
  push();
  translate(0, -95, 0);
  fill(40);
  cylinder(5, 16);
  translate(0, -12, 0);
  if (simState === "crashed" || (frameCount % 60 < 30)) {
    fill(255, 60, 60);
    emissiveMaterial(255, 50, 50);
  } else {
    fill(100, 20, 20);
  }
  sphere(8);
  pop();

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
  specularMaterial(14, 165, 233);
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
  specularMaterial(95, 110, 130);
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
  specularMaterial(225, 29, 72);
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
  specularMaterial(245, 158, 11);
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

  const w = graphCanvas.width;
  const h = graphCanvas.height;
  const ctx = graphCtx;

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

  // Margin grafik
  const padLeft = 70;
  const padRight = 30;
  const padTop = 20;
  const padBottom = 35;
  const plotW = w - padLeft - padRight;
  const plotH = h - padTop - padBottom;

  // 1. Grid Sumbu
  ctx.strokeStyle = "rgba(255, 255, 255, 0.07)";
  ctx.lineWidth = 1;
  ctx.font = "11px ui-monospace, monospace";
  ctx.fillStyle = "#64748b";

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
    ctx.fillText(`${(yVal / 1000).toFixed(0)} kN`, padLeft - 10, yPx);
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
    ctx.fillText(`${tVal.toFixed(2)} s`, xPx, padTop + plotH + 8);
  }

  // Label Sumbu
  ctx.fillStyle = "#94a3b8";
  ctx.font = "12px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Waktu Benturan t (detik)", padLeft + plotW / 2, h - 8);

  ctx.save();
  ctx.translate(18, padTop + plotH / 2);
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

  // 4. PENANDA GAYA PUNCAK
  ctx.fillStyle = "#ef4444";
  ctx.font = "bold 11px ui-monospace, monospace";
  ctx.textAlign = "left";
  ctx.fillText(`Puncak: ${(F_peak_no / 1000).toFixed(0)} kN`, toX(DT_NO_AIRBAG / 2) + 6, toY(F_peak_no) + 4);

  ctx.fillStyle = "#38bdf8";
  ctx.fillText(`Puncak: ${(F_peak_air / 1000).toFixed(0)} kN`, toX(impactTimeAirbag / 2) + 6, toY(F_peak_air) - 6);

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