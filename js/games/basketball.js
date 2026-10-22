/* Basketball — Authentic GamePigeon style: rapid-fire multi-ball shooting, 60s clock, backboard/rim physics, moving hoop & On Fire streak! */
(function (A) {
  const { U, Sound } = A;

  class BasketballGame extends A.Game {
    init() {
      this.W = 420;
      this.H = 760;

      // Hoop configuration (depth z = 1.0)
      this.hoop = {
        baseX: this.W / 2,
        x: this.W / 2,
        y: 195,
        width: 68,
        rimRadius: 5.5,
        moving: false,
        moveSpeed: 115,
        moveDir: 1,
        netPhase: 0
      };

      // Player scores for both rounds
      this.scores = [0, 0];
      this.round = 0; // 0 for player 1, 1 for player 2
      this.streak = 0;
      this.onFire = false;
      this.timeLeft = 60.0;
      this.activeRound = false;

      // Ball spawn point
      this.spawnX = this.W / 2;
      this.spawnY = this.H - 135;
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

      // Multi-ball management: ready ball at bottom + all in-flight balls
      this.readyBall = null;
      this.respawnTimer = 0;
      this.inFlightBalls = [];
      this.swipeStart = null;
      this.draggingReadyBall = false;

      this.spawnReadyBall();

      this.hud({
        score0: 0,
        score1: 0,
        status: `${this.playerName(0)}'s turn · Flick to shoot!`
      });

      this.completedRounds = 0;
      const first = (this.opts && this.opts.firstTurn != null) ? this.opts.firstTurn : 0;
      this.startRound(first);
    }

    startRound(playerIdx) {
      this.turn = playerIdx;
      this.round = playerIdx;
      this.streak = 0;
      this.onFire = false;
      this.timeLeft = 60.0; // Authentic GamePigeon 60-second round!
      this.hoop.moving = false;
      this.hoop.x = this.hoop.baseX;
      this.activeRound = true;
      this.inFlightBalls = [];
      this.respawnTimer = 0;
      this.spawnReadyBall();

      const bannerText = playerIdx === 0 ? 'START!' : `${this.playerName(playerIdx)}'S TURN!`;
      this.banner(bannerText, { color: '#ffd166', dur: 1.2, sub: '60 SECONDS · RAPID FIRE!' });
      Sound.whistle ? Sound.whistle() : Sound.good();

      if (this.cpuTurn) {
        this.status(`CPU is shooting...`);
        this.scheduleCpuShots();
      } else {
        this.status(`Flick upward rapid-fire! Streak 3 to catch FIRE 🔥`);
      }
    }

    spawnReadyBall() {
      this.readyBall = {
        x: this.spawnX,
        y: this.spawnY,
        rot: 0
      };
    }

    skipCpu() {
      if (!this.activeRound || !this.cpuTurn) return;
      // Calculate realistic CPU final score based on difficulty and remaining time
      const skill = this.cpuSkill(0.46, 0.72, 0.90);
      const remainingSecs = Math.max(0, this.timeLeft);
      const estShots = Math.round(remainingSecs * 0.9);
      const makes = Math.round(estShots * skill);
      const fireBonus = Math.floor(makes * 0.28);
      this.scores[this.round] += makes + fireBonus;
      this.timeLeft = 0;
      this.inFlightBalls = [];
      this.readyBall = null;
      this.updateHUD();
      this.endRound();
    }

    /* ---------- Input ---------- */
    onDown(p) {
      if (!this.activeRound || this.cpuTurn || !this.readyBall) return;
      if (U.dist(p.x, p.y, this.readyBall.x, this.readyBall.y) < this.ballRadius * 3.5 || p.y > this.H * 0.65) {
        this.swipeStart = { x: p.x, y: p.y, t: performance.now() };
        this.draggingReadyBall = true;
      }
    }

    onMove(p) {
      if (!this.draggingReadyBall || !this.readyBall || !this.swipeStart) return;
      this.readyBall.x = this.spawnX + (p.x - this.swipeStart.x) * 0.25;
      this.readyBall.y = this.spawnY + Math.min(0, (p.y - this.swipeStart.y) * 0.35);
    }

    onUp(p) {
      if (!this.draggingReadyBall || !this.readyBall || !this.swipeStart) return;
      this.draggingReadyBall = false;
      const dt = (performance.now() - this.swipeStart.t) / 1000;
      const dx = p.x - this.swipeStart.x;
      const dy = p.y - this.swipeStart.y;
      this.swipeStart = null;

      // Only shoot if swiped upward
      if (dy < -25 && dt < 0.75) {
        this.launchBall(this.readyBall.x, this.readyBall.y, dx, dy, dt);
        this.readyBall = null;
        this.respawnTimer = 0.14; // Immediate rapid-fire respawn (140ms)!
      } else {
        this.readyBall.x = this.spawnX;
        this.readyBall.y = this.spawnY;
      }
    }

    launchBall(originX, originY, dx, dy, dt) {
      const speedY = Math.abs(dy) / Math.max(0.06, dt);
      const speedX = dx / Math.max(0.06, dt);

      const vx = U.clamp(speedX * 0.72, -320, 320);
      const vy = -U.clamp(speedY * 0.85, 520, 880);
      const vz = U.clamp(speedY * 0.0016, 1.1, 1.6);
      const vrot = -vx * 0.02 - 6;

      const ball = {
        x: originX,
        y: originY,
        z: 0,
        vx,
        vy,
        vz,
        rot: 0,
        vrot,
        scored: false,
        hitRim: false,
        trail: []
      };

      this.inFlightBalls.push(ball);
      Sound.whoosh();
    }

    /* ---------- CPU Automation ---------- */
    scheduleCpuShots() {
      if (!this.activeRound || !this.cpuTurn) return;

      // Rapid-fire CPU interval based on difficulty
      const shootInterval = this.cpuSkill(1150, 900, 720);
      this.wait(shootInterval, () => {
        if (!this.activeRound || !this.cpuTurn) return;

        // Calculate lead on moving hoop
        const lead = this.hoop.moving ? this.hoop.moveDir * this.cpuSkill(12, 20, 26) : 0;
        const targetX = this.hoop.x + lead;
        const aimDx = targetX - this.spawnX;
        const accuracy = this.cpuSkill(0.48, 0.74, 0.92);

        let dx = aimDx * 0.8;
        if (Math.random() > accuracy) {
          dx += U.gauss() * (1 - accuracy) * 110;
        }

        const dy = -260 + U.rand(-16, 16);
        this.launchBall(this.spawnX, this.spawnY, dx, dy, 0.18);

        this.scheduleCpuShots();
      });
    }

    /* ---------- Physics Loop ---------- */
    update(dt) {
      // 1. Timer countdown (60s total)
      if (this.activeRound) {
        this.timeLeft -= dt;
        if (this.timeLeft <= 0) {
          this.timeLeft = 0;
          this.activeRound = false;
          this.endRound();
          return;
        }
        this.updateHUD();
      }

      // 2. Rapid-fire ball respawn
      if (this.activeRound && !this.readyBall && !this.cpuTurn) {
        this.respawnTimer -= dt;
        if (this.respawnTimer <= 0) {
          this.spawnReadyBall();
        }
      }

      // 3. Moving hoop logic (GamePigeon rule: starts moving at 30s remaining or 10+ points!)
      const currentScore = this.scores[this.round];
      if ((this.timeLeft <= 30.0 || currentScore >= 10) && !this.hoop.moving) {
        this.hoop.moving = true;
        this.banner('MOVING HOOP!', { color: '#ffd166', size: 36 });
      }

      if (this.hoop.moving) {
        this.hoop.x += this.hoop.moveSpeed * this.hoop.moveDir * dt;
        if (this.hoop.x > this.hoop.baseX + 115) {
          this.hoop.x = this.hoop.baseX + 115;
          this.hoop.moveDir = -1;
        } else if (this.hoop.x < this.hoop.baseX - 115) {
          this.hoop.x = this.hoop.baseX - 115;
          this.hoop.moveDir = 1;
        }
      }

      // 4. 3D Net spring physics simulation
      const n = this.net;
      n.vBulge += (-n.bulge * 140 - n.vBulge * 14) * dt;
      n.bulge += n.vBulge * dt;
      n.vStretch += (-n.stretch * 125 - n.vStretch * 12) * dt;
      n.stretch += n.vStretch * dt;
      n.vSwayX += (-n.swayX * 110 - n.vSwayX * 11) * dt;
      n.swayX += n.vSwayX * dt;

      // 5. Multi-ball physics & collisions
      const boardY = this.hoop.y - 75;
      const boardW = 145;
      const boardH = 100;
      const rimY = this.hoop.y;
      const rimW = this.hoop.width;
      const leftRimX = this.hoop.x - rimW / 2;
      const rightRimX = this.hoop.x + rimW / 2;

      this.inFlightBalls = this.inFlightBalls.filter(b => {
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        b.z += b.vz * dt;
        b.vy += 1250 * dt; // gravity
        b.rot += b.vrot * dt;

        // Interactive net swish cradle physics
        if (b.scored) {
          if (b.y >= rimY - 12 && b.y <= rimY + 85) {
            const netPct = (b.y - rimY + 12) / 97;
            n.vStretch += 460 * dt;
            n.vBulge += 380 * Math.sin(netPct * Math.PI) * dt;
            n.swayX += (b.x - this.hoop.x) * 1.5 * dt;

            // Funnel ball through center with gentle net friction
            b.vy = Math.min(b.vy, 280);
            b.vx *= 0.82;
            b.x += (this.hoop.x - b.x) * 0.18;
          } else if (b.y > rimY + 85 && b.y < rimY + 125) {
            if (n.vStretch < 80) n.vStretch = 150;
          }
        }

        // Particle trail for On Fire
        if (this.onFire) {
          b.trail.push({ x: b.x, y: b.y, z: b.z, t: 0 });
          if (Math.random() < 0.40) {
            this.fx.burst(b.x, b.y, 3, { colors: ['#ffd166', '#ff5d6c', '#ff9f43'], speed: 60, life: 0.35 });
          }
        }
        for (const t of b.trail) t.t += dt;
        b.trail = b.trail.filter(t => t.t < 0.28);

        // Backboard collision (when ball reaches backboard depth z ~= 0.94 - 1.20)
        if (b.z >= 0.94 && b.z <= 1.22 && b.vy < 0) {
          if (Math.abs(b.x - this.hoop.x) < boardW / 2 && b.y > boardY && b.y < boardY + boardH) {
            b.vz = -Math.abs(b.vz) * 0.48; // Rebound forward towards camera!
            b.vx += (b.x - this.hoop.x) * 0.6;
            Sound.rim();
          }
        }

        // Rim & Basket detection (at hoop depth z ~= 0.82 to 1.25)
        if (b.z >= 0.82 && b.z <= 1.25) {
          const dxFromCenter = b.x - this.hoop.x;
          const dyFromRim = b.y - rimY;

          // 1. Basket score detection (evaluated FIRST so valid shots are never rejected by rim edge)
          if (!b.scored && b.vy > 30 && Math.abs(dxFromCenter) < rimW * 0.46 && dyFromRim >= -16 && dyFromRim <= 32) {
            b.scored = true;
            b.vx = (this.hoop.x - b.x) * 3;
            b.vy = Math.min(b.vy, 280);
            this.scoreBasket();
          }

          // 2. Rim collision (evaluated only if ball has not already scored)
          if (!b.scored && b.z >= 0.85 && b.z <= 1.18) {
            const effectiveR = this.ballRadius * (1 - b.z * 0.45) * 0.62 + 5;
            const dLeft = U.dist(b.x, b.y, leftRimX, rimY);
            const dRight = U.dist(b.x, b.y, rightRimX, rimY);

            if (dLeft < effectiveR) {
              const nx = (b.x - leftRimX) / (dLeft || 1);
              b.vx = nx * 140 - 45;
              b.vy = -Math.abs(b.vy) * 0.52 - 30;
              b.hitRim = true;
              n.vSwayX -= 40;
              Sound.rim();
            } else if (dRight < effectiveR) {
              const nx = (b.x - rightRimX) / (dRight || 1);
              b.vx = nx * 140 + 45;
              b.vy = -Math.abs(b.vy) * 0.52 - 30;
              b.hitRim = true;
              n.vSwayX += 40;
              Sound.rim();
            }
          }
        }

        // Reset streak on miss when ball falls off bottom
        if (b.y > this.H + 80) {
          if (!b.scored) {
            if (this.streak > 0) {
              this.streak = 0;
              if (this.onFire) {
                this.onFire = false;
                this.status(`Streak lost!`);
              }
            }
          }
          return false; // remove ball
        }

        return true; // keep ball in flight
      });
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

      this.updateHUD();
    }

    updateHUD() {
      this.hud({
        score0: this.scores[0],
        score1: this.scores[1],
        p0sub: this.round === 0 ? `${Math.ceil(this.timeLeft)}s` : `${this.scores[0]} pts`,
        p1sub: this.round === 1 ? `${Math.ceil(this.timeLeft)}s` : `${this.scores[1]} pts`,
        turn: this.turn
      });
    }

    endRound() {
      Sound.lose();
      this.banner("TIME'S UP!", { color: '#ff5d6c', dur: 1.5 });

      this.wait(1600, () => {
        this.completedRounds = (this.completedRounds || 0) + 1;
        if (this.completedRounds === 1) {
          const nextPlayer = 1 - this.round;
          if (this.mode === 'local') {
            this.handoff(nextPlayer, `Pass to ${this.playerName(nextPlayer)}`, `${this.playerName(this.round)} scored ${this.scores[this.round]} pts. Beat it!`)
              .then(() => this.startRound(nextPlayer));
          } else {
            this.startRound(nextPlayer);
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

      // 3. Rear half of 3D net (behind balls)
      this.renderNetMesh(c, false);

      // 4. In-flight Basketballs & trails
      for (const b of this.inFlightBalls) {
        if (this.onFire && b.trail.length > 1) {
          for (let i = 1; i < b.trail.length; i++) {
            const t1 = b.trail[i];
            const k = 1 - t1.t / 0.28;
            const r = this.ballRadius * (1 - t1.z * 0.45) * k;
            c.fillStyle = U.alpha('#ff9f43', k * 0.4);
            U.circle(c, t1.x, t1.y, r * 1.3); c.fill();
            c.fillStyle = U.alpha('#ffd166', k * 0.6);
            U.circle(c, t1.x, t1.y, r * 0.8); c.fill();
          }
        }
        this.renderBall(c, b);
      }

      // 5. Front half of 3D net (cradles and covers ball in front)
      this.renderNetMesh(c, true);

      // 6. Front half of metallic orange rim
      this.renderFrontRim(c);

      // 7. Ready Ball at bottom (spawn rack)
      if (this.readyBall && !this.cpuTurn) {
        this.renderBall(c, { x: this.readyBall.x, y: this.readyBall.y, z: 0, rot: this.readyBall.rot });
      }

      // 8. Streak / Clock HUD on-court banner
      c.fillStyle = 'rgba(0,0,0,0.40)';
      U.rr(c, this.W / 2 - 75, 20, 150, 38, 19);
      c.fill();
      c.strokeStyle = 'rgba(255,255,255,0.15)';
      c.lineWidth = 1;
      c.stroke();
      U.text(c, `⏱ ${Math.ceil(this.timeLeft)}s`, this.W / 2, 39, { size: 19, color: this.timeLeft < 10 ? '#ff5d6c' : '#ffd166', weight: 900 });

      if (this.streak >= 2) {
        U.text(c, `${this.streak} IN A ROW!`, this.W / 2, 72, { size: 14, color: this.onFire ? '#ff5d6c' : '#ff9f43', weight: 900 });
      }
    }

    renderBackboardAndRearRim(c) {
      const hx = this.hoop.x;
      const hy = this.hoop.y;
      const hw = this.hoop.width;

      // Backboard (GamePigeon acrylic transparent style with white borders & red target square)
      const bw = 145, bh = 98;
      const bx = hx - bw / 2, by = hy - bh + 14;

      c.save();
      c.shadowColor = 'rgba(0,0,0,0.55)';
      c.shadowBlur = 16;
      c.fillStyle = 'rgba(255,255,255,0.82)';
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

    renderBall(c, b) {
      const scale = 1 - (b.z || 0) * 0.48;
      const r = Math.max(12, this.ballRadius * scale);

      c.save();
      c.translate(b.x, b.y);
      c.rotate(b.rot || 0);

      // On Fire aura
      if (this.onFire) {
        c.fillStyle = 'rgba(255, 93, 108, 0.4)';
        U.circle(c, 0, 0, r * 1.35); c.fill();
        c.fillStyle = 'rgba(255, 209, 102, 0.6)';
        U.circle(c, 0, 0, r * 1.15); c.fill();
      }

      // Ball sphere gradient (GamePigeon vibrant orange rubber)
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
    desc: 'Rapid-fire flick shots into the basket in 60 seconds. Streak 3 to catch fire and score moving hoop bonus points!',
    rules: [
      'Swipe upward on the ball to flick your shot toward the hoop.',
      'Rapid fire! Another ball is ready immediately so you can shoot ball after ball without waiting.',
      'You have 60 seconds to score as many points as possible.',
      'Sink 3 shots in a row to catch FIRE! Fire balls award 2X points.',
      'At 30 seconds left or 10+ points, test your timing against a moving hoop.',
      'Challenge the CPU or take turns in 2-player pass & play.'
    ],
    create: (stage, opts) => new BasketballGame(stage, opts)
  });
})(window.Arcade);
