/* Basketball — GamePigeon style with 30s clock, swipe shot, backboard/rim physics, moving hoop & On Fire streak! */
(function (A) {
  const { U, Sound } = A;

  class BasketballGame extends A.Game {
    init() {
      this.W = 420;
      this.H = 760;

      // Hoop configuration (at depth z = 1.0)
      this.hoop = {
        baseX: this.W / 2,
        x: this.W / 2,
        y: 195,
        width: 66,
        rimRadius: 5.5,
        moving: false,
        moveSpeed: 110,
        moveDir: 1,
        netPhase: 0
      };

      // Player scores for both rounds
      this.scores = [0, 0];
      this.round = 0; // 0 for player 1, 1 for player 2
      this.streak = 0;
      this.onFire = false;
      this.timeLeft = 30.0;
      this.activeRound = false;

      // Ball spawn point
      this.spawnX = this.W / 2;
      this.spawnY = this.H - 140;
      this.ballRadius = 32;

      // 3D Net spring dynamics
      this.net = {
        bulge: 0,
        vBulge: 0,
        stretch: 0,
        vStretch: 0,
        swayX: 0,
        vSwayX: 0
      };

      // Ball state
      this.ball = null;
      this.trail = [];
      this.swipeStart = null;
      this.spawnBall();

      this.hud({
        score0: 0,
        score1: 0,
        status: `${this.playerName(0)}'s turn · Swipe to shoot!`
      });

      this.startRound(0);
    }

    startRound(playerIdx) {
      this.turn = playerIdx;
      this.round = playerIdx;
      this.streak = 0;
      this.onFire = false;
      this.timeLeft = 30.0;
      this.hoop.moving = false;
      this.hoop.x = this.hoop.baseX;
      this.activeRound = true;
      this.spawnBall();

      this.banner(playerIdx === 0 ? 'START!' : `${this.playerName(playerIdx)}'S TURN!`, { color: '#ffd166', dur: 1.2 });
      Sound.whistle ? Sound.whistle() : Sound.good();

      if (this.cpuTurn) {
        this.status(`CPU is shooting...`);
        this.scheduleCpuShots();
      } else {
        this.status(`Flick upward to shoot! Streak 3 to catch FIRE!`);
      }
    }

    spawnBall() {
      this.ball = {
        x: this.spawnX,
        y: this.spawnY,
        z: 0, // 0 = near screen, 1 = hoop depth, >1 = behind backboard
        vx: 0,
        vy: 0,
        vz: 0,
        rot: 0,
        vrot: 0,
        inAir: false,
        scored: false,
        hitRim: false
      };
      this.trail = [];
    }

    /* ---------- Input ---------- */
    onDown(p) {
      if (!this.activeRound || this.cpuTurn || !this.ball || this.ball.inAir) return;
      if (U.dist(p.x, p.y, this.ball.x, this.ball.y) < this.ballRadius * 3.5 || p.y > this.H * 0.65) {
        this.swipeStart = { x: p.x, y: p.y, t: performance.now() };
      }
    }

    onMove(p) {
      if (!this.swipeStart || this.ball.inAir) return;
      // Ball slightly follows drag
      this.ball.x = this.spawnX + (p.x - this.swipeStart.x) * 0.25;
      this.ball.y = this.spawnY + Math.min(0, (p.y - this.swipeStart.y) * 0.4);
    }

    onUp(p) {
      if (!this.swipeStart || this.ball.inAir) return;
      const dt = (performance.now() - this.swipeStart.t) / 1000;
      const dx = p.x - this.swipeStart.x;
      const dy = p.y - this.swipeStart.y;
      this.swipeStart = null;

      // Only shoot if swiped upward
      if (dy < -25 && dt < 0.75) {
        this.shootBall(dx, dy, dt);
      } else {
        // Return ball to spawn
        this.ball.x = this.spawnX;
        this.ball.y = this.spawnY;
      }
    }

    shootBall(dx, dy, dt) {
      if (!this.ball || this.ball.inAir) return;
      this.ball.inAir = true;

      // Velocity calculation tuned for GamePigeon arc feel
      const speedY = Math.abs(dy) / Math.max(0.06, dt);
      const speedX = dx / Math.max(0.06, dt);

      this.ball.vx = U.clamp(speedX * 0.72, -320, 320);
      this.ball.vy = -U.clamp(speedY * 0.85, 520, 880);
      this.ball.vz = U.clamp(speedY * 0.0016, 1.1, 1.6);
      this.ball.vrot = -this.ball.vx * 0.02 - 6;

      Sound.whoosh();
    }

    /* ---------- CPU Automation ---------- */
    scheduleCpuShots() {
      if (!this.activeRound || !this.cpuTurn) return;

      const shootInterval = this.cpuSkill(1300, 950, 700);
      this.wait(shootInterval, () => {
        if (!this.activeRound || !this.cpuTurn) return;
        if (!this.ball || this.ball.inAir) {
          this.scheduleCpuShots();
          return;
        }

        // Calculate lead on moving hoop
        const lead = this.hoop.moving ? this.hoop.moveDir * this.cpuSkill(10, 18, 25) : 0;
        const targetX = this.hoop.x + lead;
        const aimDx = targetX - this.ball.x;
        const accuracy = this.cpuSkill(0.50, 0.74, 0.92);

        let dx = aimDx * 0.8;
        if (Math.random() > accuracy) {
          dx += U.gauss() * (1 - accuracy) * 110;
        }

        const dy = -260 + U.rand(-16, 16);
        this.shootBall(dx, dy, 0.18);
        this.scheduleCpuShots();
      });
    }

    /* ---------- Physics Loop ---------- */
    update(dt) {
      // 1. Timer countdown
      if (this.activeRound) {
        this.timeLeft -= dt;
        if (this.timeLeft <= 0) {
          this.timeLeft = 0;
          this.activeRound = false;
          this.endRound();
          return;
        }
        this.hud({
          p0sub: this.round === 0 ? `${Math.ceil(this.timeLeft)}s` : `${this.scores[0]} pts`,
          p1sub: this.round === 1 ? `${Math.ceil(this.timeLeft)}s` : `${this.scores[1]} pts`
        });
      }

      // 2. Moving hoop logic (activates once 10+ points reached)
      const currentScore = this.scores[this.round];
      if (currentScore >= 10 && !this.hoop.moving) {
        this.hoop.moving = true;
        this.banner('MOVING HOOP!', { color: '#ffd166', size: 36 });
      }

      if (this.hoop.moving) {
        this.hoop.x += this.hoop.moveSpeed * this.hoop.moveDir * dt;
        if (this.hoop.x > this.hoop.baseX + 110) {
          this.hoop.x = this.hoop.baseX + 110;
          this.hoop.moveDir = -1;
        } else if (this.hoop.x < this.hoop.baseX - 110) {
          this.hoop.x = this.hoop.baseX - 110;
          this.hoop.moveDir = 1;
        }
      }

      // 3. 3D Net spring physics simulation
      const n = this.net;
      n.vBulge += (-n.bulge * 140 - n.vBulge * 14) * dt;
      n.bulge += n.vBulge * dt;
      n.vStretch += (-n.stretch * 125 - n.vStretch * 12) * dt;
      n.stretch += n.vStretch * dt;
      n.vSwayX += (-n.swayX * 110 - n.vSwayX * 11) * dt;
      n.swayX += n.vSwayX * dt;

      // 4. Ball motion & collisions
      const b = this.ball;
      if (!b || !b.inAir) return;

      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.z += b.vz * dt;
      b.vy += 1250 * dt; // gravity
      b.rot += b.vrot * dt;

      // Interactive net swish cradle physics
      if (b.scored && b.inAir) {
        const rimY = this.hoop.y;
        if (b.y >= rimY - 8 && b.y <= rimY + 70) {
          // Ball is travelling inside the net: net catches & drags ball
          n.vStretch += 380 * dt;
          n.vBulge += 260 * dt;
          n.swayX = U.clamp((b.x - this.hoop.x) * 0.45, -16, 16);

          // Dampen ball downward velocity and guide through funnel
          b.vy = Math.min(b.vy, 320);
          b.vx *= 0.86;
        } else if (b.y > rimY + 70 && b.y < rimY + 105) {
          if (n.vStretch < 50) n.vStretch = 120;
        }
      }

      // Particle trail for On Fire
      if (this.onFire) {
        this.trail.push({ x: b.x, y: b.y, z: b.z, t: 0 });
        if (Math.random() < 0.45) {
          this.fx.burst(b.x, b.y, 3, { colors: ['#ffd166', '#ff5d6c', '#ff9f43'], speed: 60, life: 0.35 });
        }
      }
      for (const t of this.trail) t.t += dt;
      this.trail = this.trail.filter(t => t.t < 0.28);

      // Backboard collision (when ball reaches z ~= 1.0)
      const boardY = this.hoop.y - 75;
      const boardW = 140;
      const boardH = 100;

      if (b.z >= 0.95 && b.z <= 1.15 && b.vy < 0) {
        if (Math.abs(b.x - this.hoop.x) < boardW / 2 && b.y > boardY && b.y < boardY + boardH) {
          b.vz = -Math.abs(b.vz) * 0.45;
          b.vx += (b.x - this.hoop.x) * 0.6;
          Sound.rim();
        }
      }

      // Rim collisions (left and right rims)
      const rimY = this.hoop.y;
      const rimW = this.hoop.width;
      const leftRimX = this.hoop.x - rimW / 2;
      const rightRimX = this.hoop.x + rimW / 2;

      if (b.z >= 0.88 && b.z <= 1.12) {
        // Left rim
        const dLeft = U.dist(b.x, b.y, leftRimX, rimY);
        if (dLeft < this.ballRadius * (1 - b.z * 0.45) + 6) {
          b.vx = -Math.abs(b.vx) * 0.6 - 60;
          b.vy = -Math.abs(b.vy) * 0.55;
          b.hitRim = true;
          Sound.rim();
        }
        // Right rim
        const dRight = U.dist(b.x, b.y, rightRimX, rimY);
        if (dRight < this.ballRadius * (1 - b.z * 0.45) + 6) {
          b.vx = Math.abs(b.vx) * 0.6 + 60;
          b.vy = -Math.abs(b.vy) * 0.55;
          b.hitRim = true;
          Sound.rim();
        }

        // Swish / Basket detection (passes downward through center of rim)
        if (!b.scored && b.vy > 100 && Math.abs(b.x - this.hoop.x) < rimW * 0.44 && Math.abs(b.y - rimY) < 24) {
          b.scored = true;
          this.scoreBasket();
        }
      }

      // Reset when ball falls off bottom of screen
      if (b.y > this.H + 80) {
        if (!b.scored) {
          // Miss resets the streak
          if (this.streak > 0) {
            this.streak = 0;
            if (this.onFire) {
              this.onFire = false;
              this.status(`Streak lost!`);
            }
          }
        }
        this.spawnBall();
      }
    }

    scoreBasket() {
      this.streak++;
      const pts = this.onFire ? 2 : 1;
      this.scores[this.round] += pts;

      this.hoop.netPhase = 1.0;
      Sound.swish();
      this.fx.burst(this.hoop.x, this.hoop.y + 25, 20, { colors: U.CONFETTI, speed: 180, life: 0.6 });

      // Check on fire trigger (3 in a row)
      if (this.streak >= 3 && !this.onFire) {
        this.onFire = true;
        this.banner('ON FIRE! 🔥 2X PTS', { color: '#ff5d6c', dur: 1.5 });
        Sound.great();
      } else {
        this.banner(pts > 1 ? '+2 PTS!' : '+1 PT!', { color: '#ffd166', dur: 0.8, size: 36 });
      }

      this.hud({
        score0: this.scores[0],
        score1: this.scores[1]
      });
    }

    endRound() {
      Sound.lose();
      this.banner("TIME'S UP!", { color: '#ff5d6c', dur: 1.5 });

      this.wait(1600, () => {
        if (this.round === 0) {
          // Move to Player 2 / CPU round
          if (this.mode === 'local') {
            this.handoff(1, `Pass to ${this.playerName(1)}`, `${this.playerName(0)} scored ${this.scores[0]} pts. Beat it!`)
              .then(() => this.startRound(1));
          } else {
            this.startRound(1);
          }
        } else {
          // Both rounds complete: resolve match
          const s0 = this.scores[0];
          const s1 = this.scores[1];
          let winner = s0 > s1 ? 0 : s1 > s0 ? 1 : -1;

          this.finish({
            winner,
            title: winner === -1 ? "It's a Tie!" : `${this.playerName(winner)} wins!`,
            text: `${this.playerName(0)}: ${s0} pts  ·  ${this.playerName(1)}: ${s1} pts`
          });
        }
      });
    }

    /* ---------- Rendering ---------- */
    renderBackdrop(c, w, h) {
      // Sleek hardwood gymnasium court with stadium lighting
      const g = c.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#100c28');
      g.addColorStop(0.35, '#221948');
      g.addColorStop(0.36, '#bb8144'); // Court wood start
      g.addColorStop(1, '#6c3f15');
      c.fillStyle = g;
      c.fillRect(0, 0, w, h);
    }

    render(c) {
      // 1. Gymnasium perspective court floor lines
      c.save();
      c.strokeStyle = 'rgba(255,255,255,0.18)';
      c.lineWidth = 2.5;

      // Key paint (trapezoid in perspective)
      c.beginPath();
      c.moveTo(this.hoop.baseX - 45, 200);
      c.lineTo(this.hoop.baseX + 45, 200);
      c.lineTo(this.hoop.baseX + 130, this.H);
      c.lineTo(this.hoop.baseX - 130, this.H);
      c.closePath();
      c.stroke();

      // Free throw circle
      c.beginPath();
      c.ellipse(this.hoop.baseX, 480, 85, 34, 0, 0, Math.PI * 2);
      c.stroke();

      // Court wood planks
      c.strokeStyle = 'rgba(0,0,0,0.06)';
      c.lineWidth = 1;
      for (let y = 260; y < this.H; y += 32) {
        c.beginPath(); c.moveTo(0, y); c.lineTo(this.W, y); c.stroke();
      }
      c.restore();

      // 2. Backboard & rear rim arc
      this.renderBackboardAndRearRim(c);

      // 3. Rear half of 3D net (behind the ball)
      this.renderNetMesh(c, false);

      // 4. Ball Fire Trail (behind ball)
      if (this.onFire && this.trail.length > 1) {
        for (let i = 1; i < this.trail.length; i++) {
          const t0 = this.trail[i - 1];
          const t1 = this.trail[i];
          const k = 1 - t1.t / 0.28;
          const r = this.ballRadius * (1 - t1.z * 0.45) * k;

          c.fillStyle = U.alpha('#ff9f43', k * 0.4);
          U.circle(c, t1.x, t1.y, r * 1.3); c.fill();
          c.fillStyle = U.alpha('#ffd166', k * 0.6);
          U.circle(c, t1.x, t1.y, r * 0.8); c.fill();
        }
      }

      // 5. Basketball (drawn inside the hoop volume)
      if (this.ball) {
        this.renderBall(c);
      }

      // 6. Front half of 3D net (cradles and covers ball in front)
      this.renderNetMesh(c, true);

      // 7. Front half of metallic orange rim
      this.renderFrontRim(c);

      // 8. Streak / Clock HUD on-court banner
      c.fillStyle = 'rgba(0,0,0,0.35)';
      U.rr(c, this.W / 2 - 70, 20, 140, 36, 18);
      c.fill();
      U.text(c, `⏱ ${Math.ceil(this.timeLeft)}s`, this.W / 2, 38, { size: 18, color: this.timeLeft < 6 ? '#ff5d6c' : '#ffd166', weight: 900 });

      if (this.streak >= 2) {
        U.text(c, `${this.streak} IN A ROW!`, this.W / 2, 70, { size: 14, color: this.onFire ? '#ff5d6c' : '#ff9f43', weight: 900 });
      }
    }

    renderBackboardAndRearRim(c) {
      const hx = this.hoop.x;
      const hy = this.hoop.y;
      const hw = this.hoop.width;

      // Backboard (acrylic transparent style with white borders & red target square)
      const bw = 140, bh = 95;
      const bx = hx - bw / 2, by = hy - bh + 12;

      c.save();
      c.shadowColor = 'rgba(0,0,0,0.55)';
      c.shadowBlur = 16;
      c.fillStyle = 'rgba(255,255,255,0.78)';
      U.rr(c, bx, by, bw, bh, 8);
      c.fill();
      c.strokeStyle = '#e03131';
      c.lineWidth = 3.5;
      c.stroke();

      // Inner target square
      const tw = 54, th = 40;
      c.strokeStyle = '#e03131';
      c.lineWidth = 2.8;
      c.strokeRect(hx - tw / 2, hy - th - 2, tw, th);
      c.restore();

      // Support bracket & back rim arc
      c.fillStyle = '#ff5d00';
      c.fillRect(hx - 12, hy - 6, 24, 7);

      // Back half of orange metal rim
      c.strokeStyle = '#e8590c';
      c.lineWidth = 4.5;
      c.beginPath();
      c.ellipse(hx, hy, hw / 2, 9, 0, Math.PI, 0);
      c.stroke();
    }

    renderNetMesh(c, isFront) {
      const hx = this.hoop.x;
      const hy = this.hoop.y;
      const hw = this.hoop.width;
      const n = this.net;

      c.save();
      c.lineWidth = isFront ? 1.8 : 1.3;
      c.strokeStyle = isFront ? '#ffffff' : 'rgba(200, 205, 225, 0.42)';

      // 4 horizontal rings of the net funnel
      const rings = [
        { y: hy, rx: hw / 2, ry: 9, sx: 0 },
        { y: hy + 16 + n.stretch * 0.25, rx: hw * 0.44 + n.bulge * 0.35, ry: 7.5, sx: n.swayX * 0.3 },
        { y: hy + 35 + n.stretch * 0.65, rx: hw * 0.36 + n.bulge * 0.75, ry: 6.5, sx: n.swayX * 0.7 },
        { y: hy + 54 + n.stretch * 1.05, rx: hw * 0.30 + n.bulge * 0.40, ry: 5.5, sx: n.swayX * 1.0 }
      ];

      const numKnots = 10;
      const knotPoints = rings.map(ring => {
        const pts = [];
        for (let i = 0; i < numKnots; i++) {
          const theta = (i / numKnots) * Math.PI * 2;
          const kx = hx + ring.sx + Math.cos(theta) * ring.rx;
          const ky = ring.y + Math.sin(theta) * ring.ry;
          pts.push({ x: kx, y: ky, z: Math.sin(theta) });
        }
        return pts;
      });

      // Draw diamond weave cords between consecutive rings
      for (let r = 0; r < rings.length - 1; r++) {
        const upper = knotPoints[r];
        const lower = knotPoints[r + 1];

        for (let i = 0; i < numKnots; i++) {
          const uPt = upper[i];
          const lPt1 = lower[i];
          const lPt2 = lower[(i + 1) % numKnots];

          const isCordFront = (uPt.z >= 0) || (lPt1.z >= 0);
          if (isFront === isCordFront) {
            c.beginPath();
            c.moveTo(uPt.x, uPt.y);
            c.lineTo(lPt1.x, lPt1.y);
            c.stroke();

            c.beginPath();
            c.moveTo(uPt.x, uPt.y);
            c.lineTo(lPt2.x, lPt2.y);
            c.stroke();
          }
        }
      }

      // Draw horizontal knot rings
      for (let r = 1; r < rings.length; r++) {
        const ring = rings[r];
        c.beginPath();
        if (isFront) {
          c.ellipse(hx + ring.sx, ring.y, ring.rx, ring.ry, 0, 0, Math.PI);
        } else {
          c.ellipse(hx + ring.sx, ring.y, ring.rx, ring.ry, 0, Math.PI, Math.PI * 2);
        }
        c.stroke();
      }

      c.restore();
    }

    renderFrontRim(c) {
      const hx = this.hoop.x;
      const hy = this.hoop.y;
      const hw = this.hoop.width;

      // Front half of orange metal rim with 3D highlight (renders on top of ball & front net)
      c.save();
      c.strokeStyle = '#ff6b00';
      c.lineWidth = 5;
      c.beginPath();
      c.ellipse(hx, hy, hw / 2, 9, 0, 0, Math.PI);
      c.stroke();

      // Top specular rim highlight
      c.strokeStyle = '#ffa94d';
      c.lineWidth = 1.8;
      c.beginPath();
      c.ellipse(hx, hy - 1, hw / 2 - 1, 8.5, 0, 0.2, Math.PI - 0.2);
      c.stroke();
      c.restore();
    }

    renderBall(c) {
      const b = this.ball;
      // Perspective scale based on z (1.0 at hoop, 0 at hand)
      const scale = 1 - b.z * 0.48;
      const r = Math.max(12, this.ballRadius * scale);

      c.save();
      c.translate(b.x, b.y);
      c.rotate(b.rot);

      // On Fire aura
      if (this.onFire) {
        c.fillStyle = 'rgba(255, 93, 108, 0.4)';
        U.circle(c, 0, 0, r * 1.35); c.fill();
        c.fillStyle = 'rgba(255, 209, 102, 0.6)';
        U.circle(c, 0, 0, r * 1.15); c.fill();
      }

      // Ball sphere gradient (orange rubber)
      U.ball(c, 0, 0, r, '#e8590c', { light: '#ffa94d', dark: '#a63300' });

      // Black seam ribs
      c.strokeStyle = 'rgba(20,10,0,0.85)';
      c.lineWidth = Math.max(1.2, 2.2 * scale);
      c.beginPath();
      c.moveTo(-r, 0); c.lineTo(r, 0);
      c.moveTo(0, -r); c.lineTo(0, r);
      c.ellipse(0, 0, r * 0.65, r, 0, 0, Math.PI * 2);
      c.stroke();

      c.restore();
    }
  }

  A.register({
    id: 'basketball',
    name: 'Basketball',
    category: 'Sports',
    tag: 'Arcade Swish',
    icon: A.ICONS.basketball,
    desc: 'Flick shots into the basket in 30 seconds. Streak 3 to catch fire and score moving hoop bonus points!',
    rules: [
      'Swipe upward on the ball to flick your shot toward the hoop.',
      'You have 30 seconds to score as many points as possible.',
      'Sink 3 shots in a row without missing to catch FIRE! Fire balls award 2X points.',
      'Score 10+ points to test your timing against a moving hoop.',
      'Take turns in 2-player pass & play or challenge the CPU.'
    ],
    create: (stage, opts) => new BasketballGame(stage, opts)
  });
})(window.Arcade);
