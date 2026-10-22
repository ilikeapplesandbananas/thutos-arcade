/* Archery — GamePigeon style 3 rounds (50ft, 70ft, 90ft), dynamic wind deflection, bow draw & 10-ring scoring! */
(function (A) {
  const { U, Sound } = A;

  const ROUNDS = [
    { name: 'Level 1', dist: '50 FT', mult: 0.75, targetScale: 1.0 },
    { name: 'Level 2', dist: '70 FT', mult: 1.0,  targetScale: 0.85 },
    { name: 'Level 3', dist: '90 FT', mult: 1.25, targetScale: 0.70 }
  ];

  class ArcheryGame extends A.Game {
    init() {
      this.W = 420;
      this.H = 760;

      this.currentRound = 0;
      this.arrowsLeft = 3;
      this.scores = [0, 0];
      this.turn = (this.opts && this.opts.firstTurn != null) ? this.opts.firstTurn : 0;

      // Target position
      this.target = { x: this.W / 2, y: 270, r: 130 };

      // Wind (speed -5 to +5, negative = left, positive = right)
      this.wind = 0;
      this.arrowsOnBoard = []; // stuck arrows from current round

      // Bow & crosshair state
      this.drawing = false;
      this.crosshair = { x: this.target.x, y: this.target.y };
      this.drawSway = 0;
      this.inFlight = null;

      this.animTime = 0;
      this.leaves = Array.from({ length: 14 }, () => ({
        x: U.rand(0, this.W),
        y: U.rand(120, this.H - 120),
        size: U.rand(4, 7),
        speed: U.rand(35, 75),
        rot: U.rand(0, Math.PI * 2),
        vrot: U.rand(-3, 3)
      }));

      this.rollWind();
      this.updateHUD();
      if (this.cpuTurn) {
        this.wait(800, () => this.cpuShoot());
      }
    }

    rollWind() {
      // 360-degree wind in any direction!
      this.windAngle = Math.random() * Math.PI * 2;
      this.windSpeed = U.rand(1.2, 5.0);
      this.windX = Math.cos(this.windAngle) * this.windSpeed;
      this.windY = Math.sin(this.windAngle) * this.windSpeed;
      this.wind = Math.round(this.windSpeed);
      this.rollClothes();
    }

    rollClothes() {
      const wardrobe = [
        { w: 26, h: 36, col: '#3d8bff', name: 'towel' },
        { w: 30, h: 42, col: '#ffd166', name: 'shirt' },
        { w: 24, h: 32, col: '#ff5d6c', name: 'cloth' },
        { w: 28, h: 34, col: '#a855f7', name: 'jersey' },
        { w: 22, h: 38, col: '#2ec4b6', name: 'shorts' },
        { w: 18, h: 26, col: '#ff9f43', name: 'socks' },
        { w: 32, h: 44, col: '#ffffff', name: 'tee' }
      ];
      this.clothes = [
        Object.assign({ x: 135, y: 467 }, U.pick(wardrobe)),
        Object.assign({ x: 210, y: 472 }, U.pick(wardrobe)),
        Object.assign({ x: 285, y: 467 }, U.pick(wardrobe))
      ];
    }

    /* ---------- Input ---------- */
    onDown(p) {
      if (this.cpuTurn || this.over || this.inFlight) return;
      this.drawing = true;
      this.crosshair.x = p.x;
      this.crosshair.y = p.y;
      Sound.draw();
    }

    onMove(p) {
      if (!this.drawing || this.inFlight) return;
      this.crosshair.x = p.x;
      this.crosshair.y = p.y;
    }

    onUp() {
      if (!this.drawing || this.inFlight) return;
      this.drawing = false;
      this.releaseArrow(this.crosshair.x, this.crosshair.y);
    }

    releaseArrow(aimX, aimY) {
      Sound.whoosh();
      const rData = ROUNDS[this.currentRound];

      // Calculate 360-degree wind drift in pixels (both X and Y)
      const ringWidth = (this.target.r * rData.targetScale) / 10;
      const driftX = (this.windX || 0) * rData.mult * ringWidth;
      const driftY = (this.windY || 0) * rData.mult * ringWidth;

      const hitX = aimX + driftX + U.gauss() * 2.0;
      const hitY = aimY + driftY + U.gauss() * 2.0;

      this.inFlight = {
        startX: this.W / 2,
        startY: this.H - 80,
        endX: hitX,
        endY: hitY,
        t: 0,
        dur: 0.38
      };
    }

    /* ---------- CPU Shoot ---------- */
    cpuShoot() {
      if (!this.cpuTurn || this.over || this.inFlight) return;

      this.wait(1000, () => {
        if (!this.cpuTurn || this.over) return;
        const rData = ROUNDS[this.currentRound];
        const ringWidth = (this.target.r * rData.targetScale) / 10;
        const driftX = (this.windX || 0) * rData.mult * ringWidth;
        const driftY = (this.windY || 0) * rData.mult * ringWidth;

        // Pro CPU counter-aims against both X and Y wind drift!
        const skill = this.cpuSkill(0.65, 0.82, 0.95);
        let aimX = this.target.x - driftX * skill;
        let aimY = this.target.y - driftY * skill;

        if (Math.random() > skill) {
          aimX += U.gauss() * 28;
          aimY += U.gauss() * 28;
        }

        this.releaseArrow(aimX, aimY);
      });
    }

    skipCpu() {
      if (!this.cpuTurn || this.over) return;
      const rData = ROUNDS[this.currentRound];
      const ringWidth = (this.target.r * rData.targetScale) / 10;
      const skill = this.cpuSkill(0.65, 0.82, 0.95);

      while (this.arrowsLeft > 0 && !this.over) {
        const ring = skill > 0.9 ? U.rand(8, 10) : skill > 0.75 ? U.rand(6, 9) : U.rand(4, 8);
        const pts = Math.round(ring);
        this.scores[1] += pts;
        const ang = Math.random() * Math.PI * 2;
        const dist = (10 - pts) * ringWidth + U.rand(0, ringWidth * 0.8);
        this.arrowsOnBoard.push({
          x: this.target.x + Math.cos(ang) * dist,
          y: this.target.y + Math.sin(ang) * dist,
          pts
        });
        this.arrowsLeft--;
      }
      this.inFlight = null;
      this.updateHUD();
      this.endTurn();
    }

    /* ---------- Animation & Scoring ---------- */
    update(dt) {
      this.animTime += dt;

      // Update blowing leaves based on 360-degree wind
      if (this.leaves) {
        const driftX = (this.windX || 0) * 45;
        const driftY = (this.windY || 0) * 35;
        for (const l of this.leaves) {
          l.x += (driftX + l.speed * 0.4) * dt;
          l.y += (driftY + 20) * dt;
          l.rot += l.vrot * dt;
          if (l.x > this.W + 20) l.x = -20;
          if (l.x < -20) l.x = this.W + 20;
          if (l.y > this.H + 20) l.y = 80;
          if (l.y < 80) l.y = this.H + 20;
        }
      }

      // Arrow in flight
      if (this.inFlight) {
        this.inFlight.t += dt;
        if (this.inFlight.t >= this.inFlight.dur) {
          const arrow = this.inFlight;
          this.inFlight = null;
          this.stickArrow(arrow.endX, arrow.endY);
        }
      }
    }

    stickArrow(x, y) {
      Sound.thunk();
      const rData = ROUNDS[this.currentRound];
      const targetR = this.target.r * rData.targetScale;
      const dist = U.dist(x, y, this.target.x, this.target.y);
      const normDist = dist / targetR;

      let score = 0;
      if (normDist <= 1.0) {
        score = Math.max(1, Math.min(10, 11 - Math.ceil(normDist * 10)));
      }

      this.scores[this.turn] += score;
      this.arrowsOnBoard.push({ x, y, score });

      // Visual feedback
      if (score === 10) {
        Sound.great();
        this.banner('BULLSEYE! 🎯 10', { color: '#ffd166', dur: 1.2 });
        this.fx.burst(x, y, 20, { colors: U.CONFETTI, speed: 160, life: 0.6 });
      } else if (score >= 8) {
        Sound.good();
        this.banner(`+${score} PTS!`, { color: '#ff5d6c', dur: 0.9, size: 38 });
      } else if (score > 0) {
        this.banner(`+${score}`, { color: '#fff', dur: 0.8, size: 32 });
      } else {
        this.banner('MISS', { color: '#a9a3d1', dur: 0.8, size: 30 });
      }

      this.arrowsLeft--;
      this.updateHUD();

      this.wait(1100, () => {
        if (this.arrowsLeft > 0) {
          this.rollWind();
          this.status(`${this.playerName(this.turn)}: ${this.arrowsLeft} arrow${this.arrowsLeft === 1 ? '' : 's'} remaining.`);
          if (this.cpuTurn) this.cpuShoot();
        } else {
          // Finished round turn
          this.endArrowRound();
        }
      });
    }

    endArrowRound() {
      const opp = 1 - this.turn;
      this.arrowsLeft = 3;
      this.arrowsOnBoard = [];

      if (this.turn === 0) {
        // Player 1 finished this distance -> hand off to Player 2
        const rData = ROUNDS[this.currentRound];
        if (this.mode === 'local') {
          this.handoff(1, `Pass to ${this.playerName(1)}`, `${rData.name} (${rData.dist}) · 3 Arrows`)
            .then(() => {
              this.turn = 1;
              this.rollWind();
              this.updateHUD();
            });
        } else {
          this.turn = 1;
          this.rollWind();
          this.updateHUD();
          this.cpuShoot();
        }
      } else {
        // Both players finished this distance round
        if (this.currentRound < ROUNDS.length - 1) {
          this.currentRound++;
          this.turn = 0;
          this.rollWind();
          const nextR = ROUNDS[this.currentRound];
          this.banner(`${nextR.name} · ${nextR.dist}`, { color: '#ffd166', dur: 1.4 });
          this.updateHUD();
        } else {
          // Finished all 3 rounds! Highest total score wins
          const s0 = this.scores[0];
          const s1 = this.scores[1];
          const winner = s0 > s1 ? 0 : s1 > s0 ? 1 : -1;

          this.finish({
            winner,
            title: winner === -1 ? 'Tie Match!' : `${this.playerName(winner)} wins!`,
            text: `${this.playerName(0)}: ${s0} pts  ·  ${this.playerName(1)}: ${s1} pts`
          });
        }
      }
    }

    updateHUD() {
      const rData = ROUNDS[this.currentRound];
      this.hud({
        score0: this.scores[0],
        score1: this.scores[1],
        p0sub: this.turn === 0 ? `${this.arrowsLeft} arrows` : `${this.scores[0]} pts`,
        p1sub: this.turn === 1 ? `${this.arrowsLeft} arrows` : `${this.scores[1]} pts`,
        status: `${rData.name} (${rData.dist}) · Wind: ${this.wind === 0 ? 'Calm' : Math.abs(this.wind) + (this.wind > 0 ? ' ▶' : ' ◀')}`
      });
    }

    /* ---------- Rendering ---------- */
    renderBackdrop(c, w, h) {
      // 1. Sky and turf terrain
      const sky = c.createLinearGradient(0, 0, 0, h);
      sky.addColorStop(0, '#151433');
      sky.addColorStop(0.46, '#282458');
      sky.addColorStop(0.48, '#2e7d32'); // Horizon
      sky.addColorStop(1, '#1b5e20');
      c.fillStyle = sky;
      c.fillRect(0, 0, w, h);

      // 2. Drifting clouds in the breeze
      c.save();
      c.fillStyle = 'rgba(255, 255, 255, 0.12)';
      const cloudShift = (this.animTime * (this.wind * 10 + 12)) % (w + 240);
      [
        { x: 70, y: 75, r: 32 },
        { x: 230, y: 95, r: 42 },
        { x: 380, y: 65, r: 28 }
      ].forEach(cl => {
        let cx = (cl.x + cloudShift) % (w + 140);
        if (cx < -70) cx += w + 140;
        U.circle(c, cx, cl.y, cl.r); c.fill();
        U.circle(c, cx + cl.r * 0.7, cl.y + 4, cl.r * 0.75); c.fill();
        U.circle(c, cx - cl.r * 0.7, cl.y + 6, cl.r * 0.65); c.fill();
      });
      c.restore();

      // 3. Swaying trees on the left and right edges
      const treeSway = this.wind * 0.042 + Math.sin(this.animTime * 2.6) * 0.018 * (Math.abs(this.wind) + 0.6);
      this.renderSwayingTree(c, 36, 430, 1.0, treeSway);
      this.renderSwayingTree(c, w - 36, 430, -1.0, treeSway * 0.85);

      // 4. Animated clothesline with flapping laundry
      this.renderClothesline(c);

      // 5. Blowing leaf flecks
      c.save();
      for (const l of this.leaves) {
        c.save();
        c.translate(l.x, l.y);
        c.rotate(l.rot);
        c.fillStyle = 'rgba(102, 187, 106, 0.75)';
        c.beginPath();
        c.ellipse(0, 0, l.size, l.size * 0.45, 0, 0, Math.PI * 2);
        c.fill();
        c.restore();
      }
      c.restore();
    }

    renderSwayingTree(c, x, baseY, dir, sway) {
      c.save();
      c.translate(x, baseY);
      c.rotate(sway * dir);

      // Tree trunk
      c.fillStyle = '#4e342e';
      c.fillRect(-6, -110, 12, 110);

      // 3 tiers of pine foliage
      const layers = [
        { y: -80, w: 56, h: 45, col: '#1b5e20' },
        { y: -115, w: 46, h: 40, col: '#2e7d32' },
        { y: -145, w: 34, h: 35, col: '#388e3c' }
      ];
      for (const lyr of layers) {
        c.fillStyle = lyr.col;
        c.beginPath();
        c.moveTo(0, lyr.y - lyr.h);
        c.lineTo(-lyr.w / 2, lyr.y);
        c.lineTo(lyr.w / 2, lyr.y);
        c.closePath();
        c.fill();
      }
      c.restore();
    }

    renderClothesline(c) {
      const p1x = 75, p2x = 345, topY = 460;

      c.save();
      // Wooden fence posts
      c.fillStyle = '#6d4c41';
      c.fillRect(p1x - 3, topY - 10, 6, 65);
      c.fillRect(p2x - 3, topY - 10, 6, 65);

      // Sagging clothesline rope
      c.strokeStyle = 'rgba(235, 235, 245, 0.7)';
      c.lineWidth = 1.8;
      c.beginPath();
      c.moveTo(p1x, topY);
      c.quadraticCurveTo(this.W / 2, topY + 14, p2x, topY);
      c.stroke();

      // Flapping laundry items (dynamic wardrobe changes every shot)
      const items = this.clothes || [
        { x: 135, y: topY + 7, w: 26, h: 36, col: '#3d8bff', name: 'towel' },
        { x: 210, y: topY + 12, w: 30, h: 40, col: '#ffd166', name: 'shirt' },
        { x: 285, y: topY + 7, w: 24, h: 32, col: '#ff5d6c', name: 'cloth' }
      ];

      items.forEach((item, idx) => {
        const flutter = Math.sin(this.animTime * 7 + idx * 1.5) * (Math.abs(this.wind) * 4.2 + 2);
        const billowX = this.wind * 9 + flutter;

        c.save();
        // Clothes pins
        c.fillStyle = '#d7ccc8';
        c.fillRect(item.x - 3, item.y - 4, 6, 5);

        // Laundry fabric quadrilateral billowing in the wind
        c.fillStyle = item.col;
        c.beginPath();
        c.moveTo(item.x - item.w / 2, item.y);
        c.lineTo(item.x + item.w / 2, item.y);
        c.lineTo(item.x + item.w / 2 + billowX, item.y + item.h);
        c.lineTo(item.x - item.w / 2 + billowX, item.y + item.h);
        c.closePath();
        c.fill();

        // Shading fold lines
        c.strokeStyle = 'rgba(0,0,0,0.15)';
        c.lineWidth = 1.2;
        c.beginPath();
        c.moveTo(item.x, item.y);
        c.lineTo(item.x + billowX * 0.8, item.y + item.h);
        c.stroke();
        c.restore();
      });

      c.restore();
    }

    render(c) {
      const rData = ROUNDS[this.currentRound];
      const targetR = this.target.r * rData.targetScale;
      const tx = this.target.x;
      const ty = this.target.y;

      // 1. Archery Stand Legs (wooden tripod)
      c.strokeStyle = '#5a2e17';
      c.lineWidth = 8;
      c.beginPath();
      c.moveTo(tx - 70, ty + 240);
      c.lineTo(tx, ty);
      c.lineTo(tx + 70, ty + 240);
      c.moveTo(tx, ty);
      c.lineTo(tx, ty + 245);
      c.stroke();

      // 2. Concentric Target Rings
      const rings = [
        { color: '#ffffff', pts: [1, 2] },  // White outer
        { color: '#1b1b22', pts: [3, 4] },  // Black
        { color: '#3d8bff', pts: [5, 6] },  // Blue
        { color: '#ff5d6c', pts: [7, 8] },  // Red
        { color: '#ffd166', pts: [9, 10] }  // Yellow inner
      ];

      c.save();
      c.shadowColor = 'rgba(0,0,0,0.45)';
      c.shadowBlur = 18;
      c.shadowOffsetY = 8;

      for (let i = 0; i < 5; i++) {
        const rad = targetR * (1 - i * 0.2);
        c.fillStyle = rings[i].color;
        U.circle(c, tx, ty, rad);
        c.fill();
        c.strokeStyle = 'rgba(0,0,0,0.25)';
        c.lineWidth = 1;
        c.stroke();

        // Inner divider line per color zone
        U.circle(c, tx, ty, rad - targetR * 0.1);
        c.stroke();
      }
      c.restore();

      // Bullseye X center mark
      c.strokeStyle = '#1b1b22';
      c.lineWidth = 1.8;
      c.beginPath();
      c.moveTo(tx - 5, ty); c.lineTo(tx + 5, ty);
      c.moveTo(tx, ty - 5); c.lineTo(tx, ty + 5);
      c.stroke();

      // 3. Arrows Stuck on Target
      for (const a of this.arrowsOnBoard) {
        c.save();
        // Arrow shadow
        c.fillStyle = 'rgba(0,0,0,0.3)';
        U.circle(c, a.x + 3, a.y + 3, 4); c.fill();

        // Shaft & nock
        c.fillStyle = '#ff5d6c';
        U.circle(c, a.x, a.y, 4.5); c.fill();
        c.fillStyle = '#ffd166';
        U.circle(c, a.x, a.y, 2); c.fill();
        c.restore();
      }

      // 4. Arrow In Flight
      if (this.inFlight) {
        const k = this.inFlight.t / this.inFlight.dur;
        const curX = U.lerp(this.inFlight.startX, this.inFlight.endX, k);
        const curY = U.lerp(this.inFlight.startY, this.inFlight.endY, k) - Math.sin(k * Math.PI) * 55;
        const arrowScale = U.lerp(1.4, 0.45, k);

        c.save();
        c.translate(curX, curY);
        c.scale(arrowScale, arrowScale);

        // Wooden arrow shaft
        c.fillStyle = '#d9a764';
        c.fillRect(-2, -35, 4, 70);

        // Red/Yellow fletching feathers
        c.fillStyle = '#ff5d6c';
        c.beginPath();
        c.moveTo(-2, 25); c.lineTo(-8, 35); c.lineTo(-2, 35);
        c.moveTo(2, 25); c.lineTo(8, 35); c.lineTo(2, 35);
        c.fill();

        // Steel arrowhead tip
        c.fillStyle = '#adb5bd';
        c.beginPath();
        c.moveTo(0, -42); c.lineTo(-5, -35); c.lineTo(5, -35);
        c.closePath();
        c.fill();
        c.restore();
      }

      // 5. Wind Indicator Widget (top right)
      this.renderWindWidget(c);

      // 6. Crosshair & Bow Aim Reticle (when drawing bow)
      if (this.drawing && !this.inFlight) {
        const cx = this.crosshair.x;
        const cy = this.crosshair.y;

        c.strokeStyle = '#ffd166';
        c.lineWidth = 2.5;
        U.circle(c, cx, cy, 24);
        c.stroke();

        c.beginPath();
        c.moveTo(cx - 32, cy); c.lineTo(cx - 10, cy);
        c.moveTo(cx + 10, cy); c.lineTo(cx + 32, cy);
        c.moveTo(cx, cy - 32); c.lineTo(cx, cy - 10);
        c.moveTo(cx, cy + 10); c.lineTo(cx, cy + 32);
        c.stroke();

        c.fillStyle = '#ff5d6c';
        U.circle(c, cx, cy, 3);
        c.fill();
      }
    }

    renderWindWidget(c) {
      const wx = this.W - 65, wy = 46;
      c.fillStyle = 'rgba(0,0,0,0.55)';
      U.rr(c, wx - 48, wy - 24, 96, 48, 14);
      c.fill();
      c.strokeStyle = 'rgba(255,255,255,0.15)';
      c.lineWidth = 1;
      c.stroke();

      U.text(c, 'WIND', wx, wy - 11, { size: 9.5, color: '#a9a3d1', weight: 900 });

      // Compass rose with rotating arrow pointing in wind direction
      const cx = wx - 26, cy = wy + 8;
      c.fillStyle = 'rgba(255,255,255,0.12)';
      U.circle(c, cx, cy, 11);
      c.fill();

      c.save();
      c.translate(cx, cy);
      c.rotate(this.windAngle != null ? this.windAngle : 0);
      c.fillStyle = '#ffd166';
      c.beginPath();
      c.moveTo(8, 0);
      c.lineTo(-5, -4.5);
      c.lineTo(-2, 0);
      c.lineTo(-5, 4.5);
      c.closePath();
      c.fill();
      c.restore();

      const speedVal = (this.windSpeed || 0).toFixed(1);
      U.text(c, `${speedVal} MPH`, wx + 13, wy + 8, { size: 12.5, color: '#ffd166', weight: 900 });
    }
  }

  A.register({
    id: 'archery',
    name: 'Archery',
    category: 'Sports',
    tag: 'Wind & Range Target',
    icon: A.ICONS.archery,
    desc: '3 distance rounds (50ft, 70ft, 90ft). Gauge shifting crosswinds to compensate your aim and hit bullseyes!',
    rules: [
      'Touch and drag anywhere on screen to draw back your bowstring and aim crosshairs.',
      'Release your finger to shoot the arrow toward the target.',
      'Check the WIND meter: wind drifts your arrow left or right. Distance amplifies the wind effect!',
      'Scoring: Yellow Bullseye = 10 / 9, Red = 8 / 7, Blue = 6 / 5, Black = 4 / 3, White = 2 / 1.',
      'Shoot 3 arrows across 3 rounds. Highest total score takes the gold!'
    ],
    create: (stage, opts) => new ArcheryGame(stage, opts)
  });
})(window.Arcade);
