(() => {
  "use strict";

  // ---------- Helpers ----------
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rand = (a, b) => a + Math.random() * (b - a);

  // ---------- Canvas setup ----------
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d", { alpha: false });

  function resize() {
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    const w = Math.floor(canvas.clientWidth * dpr);
    const h = Math.floor(canvas.clientHeight * dpr);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
  }
  window.addEventListener("resize", resize);

  // ---------- UI ----------
  const scoreEl = document.getElementById("score");
  const dodgedEl = document.getElementById("dodged");
  const overlay = document.getElementById("overlay");
  const startBtn = document.getElementById("startBtn");

  // ---------- Game state ----------
  let running = false;
  let gameOver = false;

  // World constants (tuned to feel good)
  const world = {
    gravity: 2200,          // px/s^2
    jumpVel: -900,          // px/s
    baseSpeed: 380,         // px/s
    speed: 380,
    speedMax: 820,
    speedRamp: 14,          // speed increase per 10 seconds (ish)
    spawnMin: 0.95,
    spawnMax: 1.65,
    tSpawn: 0,
    distance: 0,
    dodged: 0,
  };

  // Player (cartoon president)
  const player = {
    x: 0,
    y: 0,
    w: 46,
    h: 72,
    vy: 0,
    onGround: true,
    anim: 0,
  };

  // Obstacles: stacks of paper labeled "THE FILES"
  const obstacles = [];

  // Particles (paper poof)
  const particles = [];

  function resetGame() {
    resize();
    const W = canvas.width;
    const H = canvas.height;

    // Ground position based on screen height
    const groundY = Math.floor(H * 0.78);

    // Place player
    player.x = Math.floor(W * 0.18);
    player.y = groundY - player.h;
    player.vy = 0;
    player.onGround = true;
    player.anim = 0;

    // Reset world
    world.speed = world.baseSpeed;
    world.tSpawn = rand(world.spawnMin, world.spawnMax);
    world.distance = 0;
    world.dodged = 0;

    // Clear entities
    obstacles.length = 0;
    particles.length = 0;

    // Seed first obstacle a bit ahead
    spawnObstacle(W + 200, groundY);

    // Store groundY on world for easy access
    world.groundY = groundY;

    // UI
    scoreEl.textContent = "0";
    dodgedEl.textContent = "0";
  }

  function start() {
    resetGame();
    running = true;
    gameOver = false;
    overlay.classList.remove("show");
  }

  function end() {
    running = false;
    gameOver = true;
    overlay.classList.add("show");
    startBtn.textContent = "Tap to Restart";
  }

  // ---------- Input (tap anywhere to jump) ----------
  function tryJump() {
    if (!running) {
      start();
      return;
    }
    if (gameOver) {
      start();
      return;
    }
    if (player.onGround) {
      player.vy = world.jumpVel;
      player.onGround = false;
    }
  }

  // Prevent scrolling / zooming on mobile taps
  const inputOpts = { passive: false };
  window.addEventListener("pointerdown", (e) => { e.preventDefault(); tryJump(); }, inputOpts);
  window.addEventListener("keydown", (e) => {
    if (e.code === "Space" || e.code === "ArrowUp") {
      e.preventDefault();
      tryJump();
    }
  });

  startBtn.addEventListener("click", () => start());

  // ---------- Obstacles ----------
  function spawnObstacle(x, groundY) {
    // Heights: small/med/tall stacks
    const tier = Math.random();
    let h;
    if (tier < 0.40) h = 44;
    else if (tier < 0.78) h = 64;
    else h = 84;

    // Slight width variation
    const w = Math.floor(rand(42, 62));

    obstacles.push({
      x,
      y: groundY - h,
      w,
      h,
      passed: false,
    });
  }

  // ---------- Collision ----------
  function aabb(ax, ay, aw, ah, bx, by, bw, bh) {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  }

  // ---------- Particles ----------
  function burstPaper(x, y) {
    const count = 12;
    for (let i = 0; i < count; i++) {
      particles.push({
        x,
        y,
        vx: rand(-180, 120),
        vy: rand(-220, -60),
        life: rand(0.35, 0.65),
        age: 0,
        s: rand(3, 6),
        rot: rand(0, Math.PI * 2),
        vr: rand(-10, 10),
      });
    }
  }

  // ---------- Drawing (palace hallway vibes) ----------
  function drawBackground(W, H, t) {
    // Base
    ctx.fillStyle = "#070a14";
    ctx.fillRect(0, 0, W, H);

    // Wall gradient
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#1a2a58");
    g.addColorStop(0.55, "#0c1430");
    g.addColorStop(1, "#070a14");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // Panels (hallway walls)
    const panelY = Math.floor(H * 0.18);
    const panelH = Math.floor(H * 0.42);
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = "#ffffff";
    const panelW = Math.max(80, Math.floor(W * 0.10));
    const scroll = (t * 40) % panelW;

    for (let x = -panelW; x < W + panelW; x += panelW) {
      const px = Math.floor(x - scroll);
      ctx.fillRect(px + 10, panelY, panelW - 20, panelH);
    }
    ctx.globalAlpha = 1;

    // Simple chandeliers (just circles)
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = "#ffd37a";
    const cCount = 6;
    for (let i = 0; i < cCount; i++) {
      const cx = Math.floor((W * (i + 0.5)) / cCount);
      const cy = Math.floor(H * 0.12);
      ctx.beginPath();
      ctx.arc(cx, cy, Math.floor(H * 0.018), 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.12;
      ctx.beginPath();
      ctx.arc(cx, cy, Math.floor(H * 0.04), 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.25;
    }
    ctx.globalAlpha = 1;

    // Carpet
    const carpetTop = Math.floor(H * 0.62);
    const carpetBottom = H;
    const carpetG = ctx.createLinearGradient(0, carpetTop, 0, carpetBottom);
    carpetG.addColorStop(0, "#5b0f1a");
    carpetG.addColorStop(1, "#2a060b");
    ctx.fillStyle = carpetG;
    ctx.fillRect(0, carpetTop, W, carpetBottom - carpetTop);

    // Carpet stripes for motion
    ctx.globalAlpha = 0.20;
    ctx.fillStyle = "#ffffff";
    const stripeW = Math.max(40, Math.floor(W * 0.06));
    const stripeScroll = (t * 220) % stripeW;
    for (let x = -stripeW; x < W + stripeW; x += stripeW) {
      const sx = Math.floor(x - stripeScroll);
      ctx.fillRect(sx, carpetTop, Math.floor(stripeW * 0.35), carpetBottom - carpetTop);
    }
    ctx.globalAlpha = 1;

    // Ground line
    ctx.strokeStyle = "rgba(255,255,255,0.10)";
    ctx.lineWidth = Math.max(2, Math.floor(H * 0.002));
    ctx.beginPath();
    ctx.moveTo(0, world.groundY + 1);
    ctx.lineTo(W, world.groundY + 1);
    ctx.stroke();
  }

  function drawPlayer() {
    const { x, y, w, h } = player;

    // bobbing for run animation
    const bob = player.onGround ? Math.sin(player.anim * 18) * 2 : 0;

    // Shadow
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.ellipse(x + w * 0.5, world.groundY + 6, w * 0.52, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // Suit body
    const bodyX = x + 10;
    const bodyY = y + 22 + bob;
    const bodyW = w - 18;
    const bodyH = h - 26;

    ctx.fillStyle = "#182a55";
    roundRect(bodyX, bodyY, bodyW, bodyH, 10, true, false);

    // Tie
    ctx.fillStyle = "#c01822";
    ctx.beginPath();
    ctx.moveTo(bodyX + bodyW * 0.5, bodyY + 6);
    ctx.lineTo(bodyX + bodyW * 0.35, bodyY + 22);
    ctx.lineTo(bodyX + bodyW * 0.65, bodyY + 22);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(bodyX + bodyW * 0.47, bodyY + 22, bodyW * 0.06, 22);

    // Head (orange skin)
    ctx.fillStyle = "#f1a35a";
    ctx.beginPath();
    ctx.ellipse(x + w * 0.55, y + 18 + bob, 18, 15, 0.08, 0, Math.PI * 2);
    ctx.fill();

    // Hair (yellow swoosh)
    ctx.fillStyle = "#ffd24a";
    ctx.beginPath();
    ctx.moveTo(x + w * 0.40, y + 10 + bob);
    ctx.quadraticCurveTo(x + w * 0.52, y + 2 + bob, x + w * 0.70, y + 8 + bob);
    ctx.quadraticCurveTo(x + w * 0.64, y + 14 + bob, x + w * 0.52, y + 14 + bob);
    ctx.quadraticCurveTo(x + w * 0.45, y + 14 + bob, x + w * 0.40, y + 10 + bob);
    ctx.closePath();
    ctx.fill();

    // Legs (simple)
    const legY = y + h - 8;
    const step = player.onGround ? Math.sin(player.anim * 18) : 0;

    ctx.strokeStyle = "#0d142b";
    ctx.lineWidth = 6;
    ctx.lineCap = "round";

    // back leg
    ctx.beginPath();
    ctx.moveTo(x + 18, legY - 22);
    ctx.lineTo(x + 14 + step * 8, legY);
    ctx.stroke();

    // front leg
    ctx.beginPath();
    ctx.moveTo(x + 28, legY - 22);
    ctx.lineTo(x + 30 - step * 8, legY);
    ctx.stroke();

    // Arm (tiny)
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(bodyX + bodyW - 6, bodyY + 22);
    ctx.lineTo(bodyX + bodyW + 8, bodyY + 34 + step * 2);
    ctx.stroke();
  }

  function drawObstacle(o) {
    // Stack of paper
    ctx.fillStyle = "#f3f5ff";
    roundRect(o.x, o.y, o.w, o.h, 8, true, false);

    // Paper lines
    ctx.globalAlpha = 0.25;
    ctx.strokeStyle = "#2a2f55";
    ctx.lineWidth = 2;
    for (let i = 8; i < o.h; i += 10) {
      ctx.beginPath();
      ctx.moveTo(o.x + 8, o.y + i);
      ctx.lineTo(o.x + o.w - 8, o.y + i);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Stamp label "THE FILES"
    const labelH = Math.min(22, Math.floor(o.h * 0.35));
    const labelY = o.y + Math.floor(o.h * 0.25);
    ctx.fillStyle = "rgba(180, 40, 40, 0.88)";
    roundRect(o.x + 6, labelY, o.w - 12, labelH, 6, true, false);

    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.font = `800 ${Math.max(10, Math.floor(labelH * 0.65))}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("THE FILES", o.x + o.w / 2, labelY + labelH / 2);
  }

  function drawParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.age += dt;
      if (p.age >= p.life) {
        particles.splice(i, 1);
        continue;
      }
      p.vy += world.gravity * 0.55 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;

      const a = 1 - p.age / p.life;

      ctx.save();
      ctx.globalAlpha = 0.9 * a;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = "#f3f5ff";
      ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s);
      ctx.restore();
    }
  }

  function roundRect(x, y, w, h, r, fill, stroke) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    if (fill) ctx.fill();
    if (stroke) ctx.stroke();
  }

  // ---------- Main loop ----------
  let last = performance.now();

  function tick(now) {
    const dt = clamp((now - last) / 1000, 0, 0.033);
    last = now;

    resize();
    const W = canvas.width;
    const H = canvas.height;

    // Update
    if (running) {
      // Speed ramps up slowly over time
      const ramp = world.speedRamp * dt;
      world.speed = clamp(world.speed + ramp, world.baseSpeed, world.speedMax);

      // Distance
      world.distance += world.speed * dt * 0.06; // scale to "meters-ish"
      scoreEl.textContent = String(Math.floor(world.distance));

      // Player physics
      player.anim += dt;

      player.vy += world.gravity * dt;
      player.y += player.vy * dt;

      // Ground collision
      const groundTop = world.groundY - player.h;
      if (player.y >= groundTop) {
        if (!player.onGround) {
          burstPaper(player.x + player.w * 0.55, world.groundY - 6);
        }
        player.y = groundTop;
        player.vy = 0;
        player.onGround = true;
      } else {
        player.onGround = false;
      }

      // Spawn obstacles
      world.tSpawn -= dt;
      if (world.tSpawn <= 0) {
        spawnObstacle(W + rand(60, 160), world.groundY);
        world.tSpawn = rand(world.spawnMin, world.spawnMax) * (world.baseSpeed / world.speed);
      }

      // Move obstacles and check pass/collision
      for (let i = obstacles.length - 1; i >= 0; i--) {
        const o = obstacles[i];
        o.x -= world.speed * dt;

        // Remove offscreen
        if (o.x + o.w < -60) {
          obstacles.splice(i, 1);
          continue;
        }

        // Passed?
        if (!o.passed && o.x + o.w < player.x) {
          o.passed = true;
          world.dodged += 1;
          dodgedEl.textContent = String(world.dodged);
        }

        // Collision
        const hit = aabb(
          player.x + 8, player.y + 10, player.w - 16, player.h - 10,
          o.x + 4, o.y + 4, o.w - 8, o.h - 6
        );

        if (hit) {
          // little impact burst
          burstPaper(player.x + player.w * 0.7, player.y + player.h * 0.6);
          end();
          break;
        }
      }
    }

    // Draw
    const t = now / 1000;
    drawBackground(W, H, t);

    // Obstacles
    for (const o of obstacles) drawObstacle(o);

    // Player
    drawPlayer();

    // Particles
    drawParticles(dt);

    // If game over, show a big text on canvas too (nice for screenshots)
    if (gameOver) {
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      roundRect(W * 0.18, H * 0.28, W * 0.64, H * 0.18, 18, true, false);

      ctx.fillStyle = "#fff";
      ctx.globalAlpha = 1;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `900 ${Math.floor(H * 0.05)}px system-ui, sans-serif`;
      ctx.fillText("CAUGHT!", W * 0.5, H * 0.34);

      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.font = `700 ${Math.floor(H * 0.024)}px system-ui, sans-serif`;
      ctx.fillText("Tap to restart", W * 0.5, H * 0.40);
      ctx.globalAlpha = 1;
    }

    requestAnimationFrame(tick);
  }

  // Start idle loop with overlay visible
  overlay.classList.add("show");
  startBtn.textContent = "Tap to Start";
  resetGame();
  requestAnimationFrame(tick);
})();
