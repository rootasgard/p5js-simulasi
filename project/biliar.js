const BALL_MASS = 0.17;
const TABLE_LENGTH_METERS = 2.54;
const ROLLING_DECELERATION = 0.16;
const ANGLE_LIMIT = 180;

let tableElement;
let controls = {};
let felt;
let ballRadius;
let cueBall;
let targetBall;
let shotVelocity = { x: 0, y: 0 };
let postCollision = null;
let preCollision = null;
let collisionHandled = false;
let shotRunning = false;
let simulationPaused = false;
let draggingTarget = false;
let impactFlash = 0;
let impactParticles = [];
let cueAngleDegrees = 8;
let cueSpeed = 5;
let restitution = 0.96;
let beforeMomentum = null;
let afterMomentum = null;

function setup() {
  tableElement = document.getElementById("billiard-canvas");
  pixelDensity(1);
  createCanvas(tableElement.clientWidth, tableElement.clientHeight).parent(tableElement);
  initializeControls();
  configureTable();
  resetSimulation();
}

function initializeControls() {
  controls.speed = document.getElementById("speedInput");
  controls.angle = document.getElementById("angleInput");
  controls.restitution = document.getElementById("restitutionInput");
  controls.speedValue = document.getElementById("speedValue");
  controls.angleValue = document.getElementById("angleValue");
  controls.restitutionValue = document.getElementById("restitutionValue");
  controls.status = document.getElementById("statusText");
  controls.initialSpeed = document.getElementById("initialSpeed");
  controls.initialVector = document.getElementById("initialVector");
  controls.cueFinalSpeed = document.getElementById("cueFinalSpeed");
  controls.cueFinalVector = document.getElementById("cueFinalVector");
  controls.targetFinalSpeed = document.getElementById("targetFinalSpeed");
  controls.targetFinalVector = document.getElementById("targetFinalVector");
  controls.momentumValue = document.getElementById("momentumValue");
  controls.momentumVector = document.getElementById("momentumVector");
  controls.shootButton = document.getElementById("shootButton");
  controls.pauseButton = document.getElementById("pauseButton");

  controls.speed.addEventListener("input", () => {
    cueSpeed = Number(controls.speed.value);
    updateParameterLabels();
    updateInitialVelocityCard();
  });
  controls.angle.addEventListener("input", () => {
    cueAngleDegrees = Number(controls.angle.value);
    updateParameterLabels();
    updateInitialVelocityCard();
  });
  controls.restitution.addEventListener("input", () => {
    restitution = Number(controls.restitution.value);
    updateParameterLabels();
  });
  controls.shootButton.addEventListener("click", launchShot);
  controls.pauseButton.addEventListener("click", togglePause);
  document.getElementById("resetButton").addEventListener("click", resetSimulation);
  updateParameterLabels();
}

function configureTable() {
  const outerWidth = min(width * 0.9, height * 1.78);
  const outerHeight = outerWidth / 2;
  const outerX = (width - outerWidth) / 2;
  const outerY = (height - outerHeight) / 2 + height * 0.025;
  const rail = outerHeight * 0.075;
  felt = {
    x: outerX + rail,
    y: outerY + rail,
    w: outerWidth - rail * 2,
    h: outerHeight - rail * 2
  };
  ballRadius = max(5, min(felt.h * 0.03, felt.w * 0.014));
}

function resetSimulation() {
  configureTable();
  cueBall = { x: felt.x + felt.w * 0.25, y: felt.y + felt.h * 0.51, vx: 0, vy: 0 };
  targetBall = { x: felt.x + felt.w * 0.65, y: felt.y + felt.h * 0.61, vx: 0, vy: 0 };
  shotVelocity = { x: 0, y: 0 };
  postCollision = null;
  preCollision = null;
  beforeMomentum = null;
  afterMomentum = null;
  impactParticles = [];
  impactFlash = 0;
  collisionHandled = false;
  shotRunning = false;
  simulationPaused = false;
  draggingTarget = false;
  controls.pauseButton.textContent = "Ⅱ  Jeda";
  controls.shootButton.disabled = false;
  controls.pauseButton.disabled = true;
  controls.status.textContent = "Siap. Atur arah stik, lalu tembak bola putih.";
  resetResultCards();
  updateInitialVelocityCard();
}

function resetResultCards() {
  controls.cueFinalSpeed.textContent = "—";
  controls.cueFinalVector.textContent = "Menunggu tumbukan";
  controls.targetFinalSpeed.textContent = "—";
  controls.targetFinalVector.textContent = "Menunggu tumbukan";
  controls.momentumValue.textContent = "—";
  controls.momentumVector.textContent = "Diperiksa setelah tumbukan";
}

function updateParameterLabels() {
  controls.speedValue.textContent = `${formatDecimal(cueSpeed, 1)} m/s`;
  controls.angleValue.textContent = `${cueAngleDegrees > 0 ? "+" : ""}${cueAngleDegrees}°`;
  controls.restitutionValue.textContent = formatDecimal(restitution, 2);
}

function updateInitialVelocityCard(velocity = null) {
  const angle = radians(cueAngleDegrees);
  const vx = velocity ? velocity.x : cueSpeed * cos(angle);
  const vy = velocity ? velocity.y : cueSpeed * sin(angle);
  controls.initialSpeed.textContent = `${formatDecimal(magnitude(vx, vy), 2)} m/s`;
  controls.initialVector.textContent = `vx ${signedDecimal(vx)} · vy ${signedDecimal(vy)} m/s`;
}

function draw() {
  background("#0d1820");
  drawPoolTable();
  drawAimGuide();
  if (shotRunning && !simulationPaused) updatePhysics(min(deltaTime / 1000, 0.033));
  drawMotionTrails();
  drawVectorGuides();
  drawCueStick();
  drawBall(cueBall, "cue");
  drawBall(targetBall, "target");
  drawImpactEffects();
  drawTableLabels();
}

function drawPoolTable() {
  const outer = {
    x: felt.x - felt.h * 0.075,
    y: felt.y - felt.h * 0.075,
    w: felt.w + felt.h * 0.15,
    h: felt.h + felt.h * 0.15
  };
  noStroke();
  drawingContext.save();
  drawingContext.shadowColor = "rgba(0, 0, 0, 0.55)";
  drawingContext.shadowBlur = 30;
  drawingContext.shadowOffsetY = 13;
  fill("#07100f");
  rect(outer.x, outer.y, outer.w, outer.h, 15);
  drawingContext.restore();

  const wood = drawingContext.createLinearGradient(outer.x, outer.y, outer.x + outer.w, outer.y + outer.h);
  wood.addColorStop(0, "#745334");
  wood.addColorStop(0.22, "#bd8c51");
  wood.addColorStop(0.55, "#805b34");
  wood.addColorStop(0.82, "#c09058");
  wood.addColorStop(1, "#63452e");
  drawingContext.fillStyle = wood;
  drawingContext.beginPath();
  drawingContext.roundRect(outer.x, outer.y, outer.w, outer.h, 15);
  drawingContext.fill();

  stroke("rgba(255, 223, 166, 0.25)");
  strokeWeight(1);
  noFill();
  rect(outer.x + 4, outer.y + 4, outer.w - 8, outer.h - 8, 12);

  const cloth = drawingContext.createLinearGradient(felt.x, felt.y, felt.x + felt.w, felt.y + felt.h);
  cloth.addColorStop(0, "#176b56");
  cloth.addColorStop(0.48, "#10533f");
  cloth.addColorStop(1, "#0b4436");
  drawingContext.fillStyle = cloth;
  drawingContext.fillRect(felt.x, felt.y, felt.w, felt.h);

  drawingContext.save();
  drawingContext.beginPath();
  drawingContext.rect(felt.x, felt.y, felt.w, felt.h);
  drawingContext.clip();
  stroke("rgba(198, 255, 223, 0.025)");
  strokeWeight(1);
  for (let x = felt.x - felt.h; x < felt.x + felt.w; x += 9) {
    line(x, felt.y, x + felt.h, felt.y + felt.h);
  }
  drawingContext.restore();

  noFill();
  stroke("rgba(191, 255, 218, 0.11)");
  strokeWeight(1);
  rect(felt.x + 4, felt.y + 4, felt.w - 8, felt.h - 8);
  drawDiamonds(outer);
  drawPockets();
  drawTableMarkings();
}

function drawDiamonds(outer) {
  noStroke();
  fill("#ead1a0");
  const count = 7;
  const topY = outer.y + (felt.y - outer.y) * 0.53;
  const bottomY = felt.y + felt.h + (outer.h * 0.075) * 0.53;
  for (let i = 1; i <= count; i++) {
    const x = felt.x + (felt.w * i) / (count + 1);
    drawDiamond(x, topY, min(3.5, ballRadius * 0.33));
    drawDiamond(x, bottomY, min(3.5, ballRadius * 0.33));
  }
}

function drawDiamond(x, y, size) {
  push();
  translate(x, y);
  rotate(QUARTER_PI);
  rectMode(CENTER);
  rect(0, 0, size, size, 1);
  rectMode(CORNER);
  pop();
}

function drawPockets() {
  const pocketRadius = ballRadius * 1.55;
  const pockets = [
    [felt.x, felt.y], [felt.x + felt.w / 2, felt.y], [felt.x + felt.w, felt.y],
    [felt.x, felt.y + felt.h], [felt.x + felt.w / 2, felt.y + felt.h],
    [felt.x + felt.w, felt.y + felt.h]
  ];
  for (const [x, y] of pockets) {
    drawingContext.save();
    drawingContext.shadowColor = "rgba(0, 0, 0, 0.55)";
    drawingContext.shadowBlur = 9;
    noStroke();
    fill("#070b0e");
    circle(x, y, pocketRadius * 2);
    drawingContext.restore();
    noFill();
    stroke("rgba(223, 185, 126, 0.42)");
    strokeWeight(2);
    circle(x, y, pocketRadius * 2.2);
  }
}

function drawTableMarkings() {
  stroke("rgba(229, 248, 228, 0.12)");
  strokeWeight(1);
  line(felt.x + felt.w * 0.25, felt.y + 7, felt.x + felt.w * 0.25, felt.y + felt.h - 7);
  noFill();
  circle(felt.x + felt.w * 0.25, felt.y + felt.h * 0.5, felt.h * 0.28);
  noStroke();
  fill("rgba(234, 248, 225, 0.5)");
  circle(felt.x + felt.w * 0.72, felt.y + felt.h * 0.5, max(2, ballRadius * 0.22));
}

function drawAimGuide() {
  if (shotRunning) return;
  const direction = aimDirection();
  const endX = cueBall.x + direction.x * felt.w * 0.25;
  const endY = cueBall.y + direction.y * felt.w * 0.25;
  drawingContext.save();
  drawingContext.setLineDash([5, 7]);
  stroke("rgba(83, 215, 242, 0.45)");
  strokeWeight(1.5);
  line(cueBall.x + direction.x * ballRadius, cueBall.y + direction.y * ballRadius, endX, endY);
  drawingContext.restore();
  noStroke();
  fill("rgba(83, 215, 242, 0.68)");
  circle(endX, endY, 4);
}

function drawCueStick() {
  if (shotRunning) return;
  const direction = aimDirection();
  const tip = {
    x: cueBall.x - direction.x * ballRadius * 1.35,
    y: cueBall.y - direction.y * ballRadius * 1.35
  };
  const butt = {
    x: cueBall.x - direction.x * ballRadius * 8.2,
    y: cueBall.y - direction.y * ballRadius * 8.2
  };
  const perpendicular = { x: -direction.y, y: direction.x };
  const tipWidth = ballRadius * 0.12;
  const buttWidth = ballRadius * 0.38;

  drawingContext.save();
  drawingContext.shadowColor = "rgba(0, 0, 0, 0.36)";
  drawingContext.shadowBlur = 7;
  drawingContext.shadowOffsetY = 3;
  noStroke();
  fill("#b67c49");
  beginShape();
  vertex(butt.x + perpendicular.x * buttWidth, butt.y + perpendicular.y * buttWidth);
  vertex(butt.x - perpendicular.x * buttWidth, butt.y - perpendicular.y * buttWidth);
  vertex(tip.x - perpendicular.x * tipWidth, tip.y - perpendicular.y * tipWidth);
  vertex(tip.x + perpendicular.x * tipWidth, tip.y + perpendicular.y * tipWidth);
  endShape(CLOSE);
  drawingContext.restore();

  stroke("#f2d5a2");
  strokeWeight(max(1, ballRadius * 0.11));
  line(tip.x, tip.y, tip.x - direction.x * ballRadius * 1.1, tip.y - direction.y * ballRadius * 1.1);
  stroke("rgba(90, 48, 28, 0.55)");
  strokeWeight(max(1, ballRadius * 0.07));
  line(
    butt.x + perpendicular.x * buttWidth * 0.45,
    butt.y + perpendicular.y * buttWidth * 0.45,
    tip.x + perpendicular.x * tipWidth * 0.45,
    tip.y + perpendicular.y * tipWidth * 0.45
  );
}

function drawBall(ball, kind) {
  const r = ballRadius;
  drawingContext.save();
  drawingContext.shadowColor = "rgba(0, 0, 0, 0.46)";
  drawingContext.shadowBlur = r * 0.8;
  drawingContext.shadowOffsetY = r * 0.43;
  noStroke();
  fill("#071a17");
  circle(ball.x + r * 0.08, ball.y + r * 0.15, r * 2.04);
  drawingContext.restore();

  drawingContext.save();
  const gradient = drawingContext.createRadialGradient(
    ball.x - r * 0.33, ball.y - r * 0.4, r * 0.04, ball.x, ball.y, r * 1.18
  );
  if (kind === "cue") {
    gradient.addColorStop(0, "#ffffff");
    gradient.addColorStop(0.66, "#e7edf0");
    gradient.addColorStop(1, "#aebbc3");
  } else {
    gradient.addColorStop(0, "#fff0b0");
    gradient.addColorStop(0.55, "#f8bc3c");
    gradient.addColorStop(1, "#b9771f");
  }
  drawingContext.fillStyle = gradient;
  drawingContext.beginPath();
  drawingContext.arc(ball.x, ball.y, r, 0, TWO_PI);
  drawingContext.fill();
  drawingContext.restore();

  noStroke();
  if (kind === "target") {
    fill("rgba(255, 246, 210, 0.62)");
    circle(ball.x - r * 0.37, ball.y - r * 0.39, r * 0.22);
    fill("#fff8e8");
    circle(ball.x + r * 0.13, ball.y + r * 0.08, r * 0.72);
    fill("#a75f19");
    textAlign(CENTER, CENTER);
    textStyle(BOLD);
    textSize(max(7, r * 0.76));
    text("9", ball.x + r * 0.13, ball.y + r * 0.09);
  } else {
    fill("rgba(255, 255, 255, 0.82)");
    circle(ball.x - r * 0.36, ball.y - r * 0.38, r * 0.23);
    fill("rgba(153, 35, 42, 0.7)");
    circle(ball.x + r * 0.22, ball.y + r * 0.2, max(1.3, r * 0.12));
    circle(ball.x - r * 0.18, ball.y + r * 0.24, max(1.1, r * 0.1));
  }

  noFill();
  stroke("rgba(255, 255, 255, 0.35)");
  strokeWeight(max(0.7, r * 0.06));
  circle(ball.x, ball.y, r * 1.98);
}

function drawMotionTrails() {
  const trails = [[cueBall, [184, 166, 255]], [targetBall, [255, 198, 109]]];
  for (const [ball, color] of trails) {
    const speed = magnitude(ball.vx, ball.vy);
    if (speed < 20) continue;
    const direction = { x: ball.vx / speed, y: ball.vy / speed };
    const length = min(felt.w * 0.13, speed * 0.075);
    drawingContext.save();
    const gradient = drawingContext.createLinearGradient(
      ball.x - direction.x * length, ball.y - direction.y * length, ball.x, ball.y
    );
    gradient.addColorStop(0, `rgba(${color[0]}, ${color[1]}, ${color[2]}, 0)`);
    gradient.addColorStop(1, `rgba(${color[0]}, ${color[1]}, ${color[2]}, 0.42)`);
    drawingContext.strokeStyle = gradient;
    drawingContext.lineWidth = ballRadius * 0.65;
    drawingContext.lineCap = "round";
    drawingContext.beginPath();
    drawingContext.moveTo(ball.x - direction.x * length, ball.y - direction.y * length);
    drawingContext.lineTo(ball.x - direction.x * ballRadius, ball.y - direction.y * ballRadius);
    drawingContext.stroke();
    drawingContext.restore();
  }
}

function drawVectorGuides() {
  if (!shotRunning && !postCollision) return;
  if (preCollision) {
    drawVelocityArrow(cueBall.x, cueBall.y, preCollision.x, preCollision.y, "#53d7f2", 100);
  } else if (shotRunning) {
    drawVelocityArrow(cueBall.x, cueBall.y, shotVelocity.x, shotVelocity.y, "#53d7f2", 95);
  }
  if (postCollision) {
    drawVelocityArrow(cueBall.x, cueBall.y, postCollision.cue.x, postCollision.cue.y, "#b8a6ff", 82);
    drawVelocityArrow(targetBall.x, targetBall.y, postCollision.target.x, postCollision.target.y, "#ffc66d", 95);
  }
}

function drawVelocityArrow(x, y, vx, vy, color, maximumLength) {
  const speed = magnitude(vx, vy);
  if (speed < 0.015) return;
  const length = constrain(30 + speed * 10, 30, maximumLength);
  const endX = x + (vx / speed) * length;
  const endY = y + (vy / speed) * length;
  drawingContext.save();
  drawingContext.shadowColor = color;
  drawingContext.shadowBlur = 8;
  stroke(color);
  strokeWeight(max(2, ballRadius * 0.2));
  line(x, y, endX, endY);
  noStroke();
  fill(color);
  push();
  translate(endX, endY);
  rotate(atan2(vy, vx));
  triangle(0, 0, -ballRadius * 0.7, -ballRadius * 0.4, -ballRadius * 0.7, ballRadius * 0.4);
  pop();
  drawingContext.restore();
}

function drawTableLabels() {
  if (shotRunning || postCollision) return;
  noStroke();
  fill("rgba(241, 255, 248, 0.7)");
  textAlign(LEFT, CENTER);
  textStyle(BOLD);
  textSize(max(9, ballRadius * 0.74));
  text("BOLA PUTIH", cueBall.x - ballRadius * 2, cueBall.y + ballRadius * 2.4);
  fill("rgba(255, 234, 179, 0.76)");
  textAlign(CENTER, CENTER);
  text("BOLA SASARAN", targetBall.x, targetBall.y + ballRadius * 2.5);
}

function updatePhysics(frameSeconds) {
  const maxSpeed = max(magnitude(cueBall.vx, cueBall.vy), magnitude(targetBall.vx, targetBall.vy));
  const substeps = constrain(ceil((maxSpeed * frameSeconds) / max(1, ballRadius * 0.5)), 1, 28);
  const stepSeconds = frameSeconds / substeps;
  for (let step = 0; step < substeps; step++) {
    moveBall(cueBall, stepSeconds);
    moveBall(targetBall, stepSeconds);
    resolveCushions(cueBall);
    resolveCushions(targetBall);
    resolveBallCollision();
  }
  if (magnitude(cueBall.vx, cueBall.vy) < 1.5) cueBall.vx = cueBall.vy = 0;
  if (magnitude(targetBall.vx, targetBall.vy) < 1.5) targetBall.vx = targetBall.vy = 0;
  updateImpactParticles(frameSeconds);
  if (magnitude(cueBall.vx, cueBall.vy) === 0 && magnitude(targetBall.vx, targetBall.vy) === 0) {
    shotRunning = false;
    controls.shootButton.disabled = false;
    controls.pauseButton.disabled = true;
    controls.status.textContent = collisionHandled
      ? "Bola berhenti. Tinjau vektor dan momentum setelah tumbukan."
      : "Bola berhenti tanpa mengenai sasaran. Atur sudut atau titik tumbuk.";
  }
}

function moveBall(ball, dt) {
  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;
  const speed = magnitude(ball.vx, ball.vy);
  if (speed > 0) {
    const lostSpeed = ROLLING_DECELERATION * (felt.w / TABLE_LENGTH_METERS) * dt;
    const ratio = max(0, speed - lostSpeed) / speed;
    ball.vx *= ratio;
    ball.vy *= ratio;
  }
}

function resolveCushions(ball) {
  const left = felt.x + ballRadius;
  const right = felt.x + felt.w - ballRadius;
  const top = felt.y + ballRadius;
  const bottom = felt.y + felt.h - ballRadius;
  const cushionRestitution = 0.88;
  if (ball.x < left) {
    ball.x = left;
    if (ball.vx < 0) ball.vx *= -cushionRestitution;
  } else if (ball.x > right) {
    ball.x = right;
    if (ball.vx > 0) ball.vx *= -cushionRestitution;
  }
  if (ball.y < top) {
    ball.y = top;
    if (ball.vy < 0) ball.vy *= -cushionRestitution;
  } else if (ball.y > bottom) {
    ball.y = bottom;
    if (ball.vy > 0) ball.vy *= -cushionRestitution;
  }
}

function resolveBallCollision() {
  const dx = targetBall.x - cueBall.x;
  const dy = targetBall.y - cueBall.y;
  const distance = magnitude(dx, dy);
  const minimumDistance = ballRadius * 2;
  if (distance >= minimumDistance || distance === 0) return;

  const normal = { x: dx / distance, y: dy / distance };
  const relativeSpeed = (cueBall.vx - targetBall.vx) * normal.x +
    (cueBall.vy - targetBall.vy) * normal.y;
  const overlap = minimumDistance - distance;
  cueBall.x -= normal.x * overlap * 0.5;
  cueBall.y -= normal.y * overlap * 0.5;
  targetBall.x += normal.x * overlap * 0.5;
  targetBall.y += normal.y * overlap * 0.5;
  if (relativeSpeed <= 0) return;

  const beforeCue = { x: cueBall.vx, y: cueBall.vy };
  const beforeTarget = { x: targetBall.vx, y: targetBall.vy };
  const impulse = ((1 + restitution) * relativeSpeed) / (1 / BALL_MASS + 1 / BALL_MASS);
  cueBall.vx -= (impulse / BALL_MASS) * normal.x;
  cueBall.vy -= (impulse / BALL_MASS) * normal.y;
  targetBall.vx += (impulse / BALL_MASS) * normal.x;
  targetBall.vy += (impulse / BALL_MASS) * normal.y;

  if (!collisionHandled) {
    preCollision = beforeCue;
    postCollision = {
      cue: { x: cueBall.vx, y: cueBall.vy },
      target: { x: targetBall.vx, y: targetBall.vy }
    };
    beforeMomentum = {
      x: BALL_MASS * (beforeCue.x + beforeTarget.x),
      y: BALL_MASS * (beforeCue.y + beforeTarget.y)
    };
    afterMomentum = {
      x: BALL_MASS * (cueBall.vx + targetBall.vx),
      y: BALL_MASS * (cueBall.vy + targetBall.vy)
    };
    collisionHandled = true;
    impactFlash = 1;
    createImpactParticles((cueBall.x + targetBall.x) * 0.5, (cueBall.y + targetBall.y) * 0.5);
    updateResultCards();
    controls.status.textContent = "Tumbukan terjadi! Bandingkan arah dan besar kecepatan kedua bola.";
  }
}

function updateResultCards() {
  const pixelsPerMeter = felt.w / TABLE_LENGTH_METERS;
  const cueMps = { x: postCollision.cue.x / pixelsPerMeter, y: postCollision.cue.y / pixelsPerMeter };
  const targetMps = { x: postCollision.target.x / pixelsPerMeter, y: postCollision.target.y / pixelsPerMeter };
  const before = { x: beforeMomentum.x / pixelsPerMeter, y: beforeMomentum.y / pixelsPerMeter };
  const after = { x: afterMomentum.x / pixelsPerMeter, y: afterMomentum.y / pixelsPerMeter };
  const beforeMagnitude = magnitude(before.x, before.y);
  const afterMagnitude = magnitude(after.x, after.y);
  const difference = magnitude(after.x - before.x, after.y - before.y);
  const conservation = beforeMagnitude > 0 ? max(0, 100 * (1 - difference / beforeMagnitude)) : 100;

  updateInitialVelocityCard({ x: preCollision.x / pixelsPerMeter, y: preCollision.y / pixelsPerMeter });
  controls.cueFinalSpeed.textContent = `${formatDecimal(magnitude(cueMps.x, cueMps.y), 2)} m/s`;
  controls.cueFinalVector.textContent = `vx ${signedDecimal(cueMps.x)} · vy ${signedDecimal(cueMps.y)} m/s`;
  controls.targetFinalSpeed.textContent = `${formatDecimal(magnitude(targetMps.x, targetMps.y), 2)} m/s`;
  controls.targetFinalVector.textContent = `vx ${signedDecimal(targetMps.x)} · vy ${signedDecimal(targetMps.y)} m/s`;
  controls.momentumValue.textContent = `${formatDecimal(conservation, 2)}%`;
  controls.momentumVector.textContent =
    `|p| ${formatDecimal(beforeMagnitude, 3)} → ${formatDecimal(afterMagnitude, 3)} kg·m/s`;
}

function launchShot() {
  if (shotRunning) return;
  cueAngleDegrees = Number(controls.angle.value);
  cueSpeed = Number(controls.speed.value);
  restitution = Number(controls.restitution.value);
  const direction = aimDirection();
  const pixelsPerMeter = felt.w / TABLE_LENGTH_METERS;
  cueBall.vx = direction.x * cueSpeed * pixelsPerMeter;
  cueBall.vy = direction.y * cueSpeed * pixelsPerMeter;
  shotVelocity = { x: cueBall.vx, y: cueBall.vy };
  targetBall.vx = 0;
  targetBall.vy = 0;
  preCollision = null;
  postCollision = null;
  beforeMomentum = null;
  afterMomentum = null;
  collisionHandled = false;
  shotRunning = true;
  simulationPaused = false;
  controls.pauseButton.textContent = "Ⅱ  Jeda";
  controls.pauseButton.disabled = false;
  controls.shootButton.disabled = true;
  resetResultCards();
  updateInitialVelocityCard();
  controls.status.textContent = "Bola melaju di meja...";
}

function togglePause() {
  if (!shotRunning) return;
  simulationPaused = !simulationPaused;
  controls.pauseButton.textContent = simulationPaused ? "▶  Lanjutkan" : "Ⅱ  Jeda";
  controls.status.textContent = simulationPaused ? "Simulasi dijeda." : "Simulasi dilanjutkan.";
}

function mousePressed() {
  if (!felt || shotRunning || !isInsideFelt(mouseX, mouseY)) return;
  if (distanceBetween(mouseX, mouseY, targetBall.x, targetBall.y) < ballRadius * 1.8) {
    draggingTarget = true;
    return false;
  }
  setAimFromPointer(mouseX, mouseY);
  return false;
}

function mouseDragged() {
  if (!felt || shotRunning) return false;
  if (draggingTarget) {
    targetBall.x = constrain(mouseX, felt.x + ballRadius * 2.2, felt.x + felt.w - ballRadius * 2.2);
    targetBall.y = constrain(mouseY, felt.y + ballRadius * 2.2, felt.y + felt.h - ballRadius * 2.2);
    if (distanceBetween(targetBall.x, targetBall.y, cueBall.x, cueBall.y) < ballRadius * 2.2) {
      targetBall.x = cueBall.x + ballRadius * 2.2;
    }
    resetResultCards();
    return false;
  }
  if (isInsideFelt(mouseX, mouseY)) setAimFromPointer(mouseX, mouseY);
  return false;
}

function mouseReleased() {
  draggingTarget = false;
}

function setAimFromPointer(x, y) {
  const angle = atan2(y - cueBall.y, x - cueBall.x) * 180 / PI;
  cueAngleDegrees = constrain(angle, -ANGLE_LIMIT, ANGLE_LIMIT);
  controls.angle.value = cueAngleDegrees;
  updateParameterLabels();
  updateInitialVelocityCard();
}

function aimDirection() {
  const angle = radians(cueAngleDegrees);
  return { x: cos(angle), y: sin(angle) };
}

function isInsideFelt(x, y) {
  return x >= felt.x && x <= felt.x + felt.w && y >= felt.y && y <= felt.y + felt.h;
}

function createImpactParticles(x, y) {
  for (let i = 0; i < 22; i++) {
    const angle = random(TWO_PI);
    const speed = random(ballRadius * 2, ballRadius * 7);
    impactParticles.push({
      x, y,
      vx: cos(angle) * speed,
      vy: sin(angle) * speed,
      life: random(0.35, 0.8),
      size: random(1.5, ballRadius * 0.28)
    });
  }
}

function updateImpactParticles(dt) {
  for (const particle of impactParticles) {
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.life -= dt;
    particle.vx *= 0.97;
    particle.vy *= 0.97;
  }
  impactParticles = impactParticles.filter(particle => particle.life > 0);
  impactFlash = max(0, impactFlash - dt * 2.6);
}

function drawImpactEffects() {
  if (impactFlash > 0) {
    noFill();
    stroke(255, 231, 170, impactFlash * 210);
    strokeWeight(max(1, ballRadius * 0.12));
    circle((cueBall.x + targetBall.x) * 0.5, (cueBall.y + targetBall.y) * 0.5, ballRadius * (2.5 + (1 - impactFlash) * 3));
  }
  noStroke();
  for (const particle of impactParticles) {
    fill(255, 209, 128, 255 * constrain(particle.life, 0, 1));
    circle(particle.x, particle.y, particle.size);
  }
}

function windowResized() {
  if (!tableElement) return;
  resizeCanvas(tableElement.clientWidth, tableElement.clientHeight);
  resetSimulation();
  controls.status.textContent = "Ukuran meja diperbarui. Siap untuk pukulan baru.";
}

function formatDecimal(value, digits) {
  return Number(value).toFixed(digits).replace(".", ",");
}

function signedDecimal(value) {
  const sign = value >= 0 ? "+" : "−";
  return `${sign}${formatDecimal(abs(value), 2)}`;
}

function magnitude(x, y) {
  return sqrt(x * x + y * y);
}

function distanceBetween(x1, y1, x2, y2) {
  return magnitude(x2 - x1, y2 - y1);
}