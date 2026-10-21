/* Cup Pong — GamePigeon style with 10 red cups, 2 shots per turn, table bounces, splashes & re-racks! */
(function (A) {
  const { U, Sound } = A;

  class CupPongGame extends A.Game {
    init() {
      this.W = 420;
      this.H = 760;

      // Table geometry (portrait perspective viewed from shooter's end)
      this.table = {
        topY: 130,
        btmY: this.H - 50,
        topW: 240,
        btmW: 380,
        x: this.W / 2
      };

      // Each player has their own rack of 10 cups to defend
      // Turn player shoots at the opponent's cups!
      this.cups = [
        this.createTriangleRack(), // Player 0's target cups (at the far end)
        this.createTriangleRack()  // Player 1's target cups
      ];

      this.shotsLeft = 2;
      this.turn = 0;
      this.ball = null;
      this.swipeStart = null;
      this.dragAim = null;
      this.reRacksUsed = [false, false];

      this.spawnBall();
      this.hud({
        score0: 10,
        score1: 10,
        p0sub: '2 shots left',
        p1sub: '10 cups',
        status: `${this.playerName(0)}'s turn · Drag back to aim or flick!`
      });
    }

    createTriangleRack() {
      // 10-cup triangle formation (4-3-2-1)
      const cups = [];
      const baseY = 210;
      const rowDist = 34;
      const cupDist = 32;
      let id = 0;

      for (let row = 0; row < 4; row++) {
        const count = 4 - row;
        const cy = baseY + row * rowDist;
        const startX = this.W / 2 - ((count - 1) * cupDist) / 2;
        for (let col = 0; col < count; col++) {
          cups.push({
            id: id++,
            x: startX + col * cupDist,
            y: cy,
            r: 15 - row * 0.5,
            sunk: false
          });
        }
      }
      return cups;
    }

    reRack(formation = 'triangle') {
      const targetCups = this.cups[this.turn].filter(c => !c.sunk);
      const n = targetCups.length;
      if (n <= 1) return;

      const baseY = 230;
      let pos = [];

      if (n === 6) {
        // 3-2-1 triangle
        pos = [
          { x: 0, y: 0 },
          { x: -16, y: 32 }, { x: 16, y: 32 },
          { x: -32, y: 64 }, { x: 0, y: 64 }, { x: 32, y: 64 }
        ];
      } else if (n === 4) {
        // Diamond
        pos = [
          { x: 0, y: 0 },
          { x: -18, y: 28 }, { x: 18, y: 28 },
          { x: 0, y: 56 }
        ];
      } else if (n === 3) {
        // 2-1 triangle
        pos = [
          { x: 0, y: 0 },
          { x: -16, y: 32 }, { x: 16, y: 32 }
        ];
      } else if (n === 2) {
        // Vertical line
        pos = [{ x: 0, y: 0 }, { x: 0, y: 34 }];
      }

      if (pos.length === n) {
        targetCups.forEach((c, i) => {
          c.x = this.W / 2 + pos[i].x;
          c.y = baseY + pos[i].y;
        });
        this.reRacksUsed[this.turn] = true;
        this.banner('RE-RACKED!', { color: '#ffd166', dur: 1.0 });
        Sound.tap();
      }
    }

    spawnBall() {
      this.ball = {
        x: this.W / 2,
        y: this.H - 120,
        z: 0, // 0 = shooter hand, 1.0 = cup table depth
        vx: 0,
        vy: 0,
        vz: 0,
        bounced: false,
        inAir: false,
        sunk: false
      };
      this.dragAim = null;
    }

    /* ---------- Input ---------- */
    onDown(p) {
      if (this.cpuTurn || this.over || !this.ball || this.ball.inAir) return;

      // Re-rack button hit (near top right)
      if (p.x > this.W - 90 && p.y < 90 && !this.reRacksUsed[this.turn]) {
        const remaining = this.cups[this.turn].filter(c => !c.sunk).length;
        if ([6, 4, 3, 2].includes(remaining)) {
          this.reRack();
          return;
        }
      }

      if (U.dist(p.x, p.y, this.ball.x, this.ball.y) < 80 || p.y > this.H * 0.7) {
        this.swipeStart = { x: p.x, y: p.y, t: performance.now() };
      }
    }

    onMove(p) {
      if (!this.swipeStart || this.ball.inAir) return;
      this.dragAim = { x: p.x, y: p.y };
      this.ball.x = this.W / 2 + (p.x - this.swipeStart.x) * 0.3;
      this.ball.y = this.H - 120 + Math.min(60, (p.y - this.swipeStart.y) * 0.5);
    }

    onUp(p) {
      if (!this.swipeStart || this.ball.inAir) return;
      const dt = (performance.now() - this.swipeStart.t) / 1000;
      const dx = p.x - this.swipeStart.x;
      const dy = p.y - this.swipeStart.y;
      this.swipeStart = null;
      this.dragAim = null;

      // Swipe upward or pull back downward to throw
      if (dy < -30 && dt < 0.6) {
        // Flick upward
        this.throwBall(dx * 1.5, dy * 1.8, dt);
      } else if (dy > 30) {
        // Pull back and slingshot release
        this.throwBall(-dx * 2.2, -dy * 2.5, 0.2);
      } else {
        this.ball.x = this.W / 2;
        this.ball.y = this.H - 120;
      }
    }

    throwBall(dx, dy, dt) {
      this.ball.inAir = true;
      const spdY = Math.abs(dy) / Math.max(0.08, dt);
      const spdX = dx / Math.max(0.08, dt);

      this.ball.vx = U.clamp(spdX * 0.65, -260, 260);
      this.ball.vy = -U.clamp(spdY * 0.72, 440, 780);
      this.ball.vz = U.clamp(spdY * 0.0017, 1.1, 1.5);

      Sound.whoosh();
    }

    /* ---------- CPU Shoot ---------- */
    cpuShoot() {
      if (!this.cpuTurn || this.over) return;

      const targetCups = this.cups[1].filter(c => !c.sunk);
      if (!targetCups.length) return;

      this.wait(900, () => {
        if (!this.cpuTurn || this.over) return;
        const accuracy = this.cpuSkill(0.42, 0.72, 0.94);

        let target;
        if (accuracy > 0.9) {
          target = targetCups.slice().sort((a, b) => Math.abs(b.x - this.W / 2) - Math.abs(a.x - this.W / 2))[0] || U.pick(targetCups);
        } else {
          target = U.pick(targetCups);
        }

        let tx = target.x, ty = target.y;
        if (Math.random() > accuracy) {
          tx += U.gauss() * (1 - accuracy) * 75;
          ty += U.gauss() * (1 - accuracy) * 85;
        }

        const dx = (tx - this.ball.x) * 1.1;
        const dy = (ty - this.ball.y) * 0.8;
        this.throwBall(dx, dy, 0.2);
      });
    }

    /* ---------- Physics Loop ---------- */
    update(dt) {
      const b = this.ball;
      if (!b || !b.inAir) return;

      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.z += b.vz * dt;
      b.vy += 1150 * dt; // gravity

      // Table surface bounce (when z reaches ~0.8 and y is on table surface)
      if (!b.bounced && b.z >= 0.75 && b.z <= 0.95 && b.y > 260 && b.y < 540) {
        b.bounced = true;
        b.vy = -Math.abs(b.vy) * 0.58;
        b.vz *= 0.8;
        Sound.tap();
        this.fx.burst(b.x, b.y, 6, { color: '#ffd166', speed: 50, life: 0.3 });
      }

      // Sinking vortex animation into cup
      if (b.sinking) {
        b.sinking.t += dt;
        const k = Math.min(1, b.sinking.t / b.sinking.dur);
        const cup = b.sinking.cup;
        const angle = k * Math.PI * 4;
        const rad = (1 - k) * (cup.r * 0.45);
        b.x = cup.x + Math.cos(angle) * rad;
        b.y = cup.y + 2 + Math.sin(angle) * (rad * 0.35) + k * 8;
        b.scale = (b.sinking.startScale || 0.55) * (1 - k * 0.42);
        b.alpha = 1 - k * 0.5;
        return;
      }

      // Cup collisions (active target rack)
      const targetCups = this.cups[this.turn];
      if (b.z >= 0.85 && b.z <= 1.15 && !b.sunk && !b.sinking) {
        for (const cup of targetCups) {
          if (cup.sunk) continue;
          const dist = U.dist(b.x, b.y, cup.x, cup.y);

          // Direct swish or bounce into cup opening
          if (dist < cup.r * 0.85 && b.vy > 30) {
            this.handleSink(cup);
            return;
          }
          // Rim bounce
          else if (dist < cup.r * 1.25 && b.vy > 0) {
            const nx = (b.x - cup.x) / dist;
            const ny = (b.y - cup.y) / dist;
            b.vx += nx * 140;
            b.vy = -Math.abs(b.vy) * 0.5;
            Sound.rim();
            break;
          }
        }
      }

      // Ball missed / landed off table
      if (b.y > this.H + 40 || b.z > 1.35) {
        this.finishShot(false);
      }
    }

    handleSink(cup) {
      const b = this.ball;
      b.sinking = {
        cup,
        startX: b.x,
        startY: b.y,
        startScale: 1 - b.z * 0.48,
        t: 0,
        dur: 0.55
      };
      b.vx = 0;
      b.vy = 0;
      b.vz = 0;
      Sound.splash();
      this.fx.burst(cup.x, cup.y, 25, { colors: ['#ffd166', '#ff5d6c', '#fff', '#fcc419'], speed: 160, life: 0.65 });
      this.banner('CUP SUNK!', { color: '#ffd166', dur: 1.2 });

      this.wait(700, () => {
        cup.sunk = true;
        b.sunk = true;
        b.sinking = null;
        this.finishShot(true);
      });
    }

    finishShot(sunk) {
      this.shotsLeft--;
      const remaining = this.cups[this.turn].filter(c => !c.sunk).length;

      // Check win condition
      if (remaining === 0) {
        this.finish({
          winner: this.turn,
          title: `${this.playerName(this.turn)} wins!`,
          text: `All 10 cups cleared!`
        });
        return;
      }

      // Update remaining cups score
      const c0 = this.cups[0].filter(c => !c.sunk).length;
      const c1 = this.cups[1].filter(c => !c.sunk).length;

      this.hud({
        score0: 10 - c0,
        score1: 10 - c1,
        p0sub: this.turn === 0 ? `${this.shotsLeft} shot${this.shotsLeft === 1 ? '' : 's'} left` : `${c0} cups left`,
        p1sub: this.turn === 1 ? `${this.shotsLeft} shot${this.shotsLeft === 1 ? '' : 's'} left` : `${c1} cups left`
      });

      if (this.shotsLeft > 0) {
        this.spawnBall();
        this.status(`${this.playerName(this.turn)}: 1 shot remaining!`);
        if (this.cpuTurn) this.cpuShoot();
      } else {
        // Change turns
        this.shotsLeft = 2;
        const nextPlayer = 1 - this.turn;

        if (this.mode === 'local') {
          this.handoff(nextPlayer, `Pass to ${this.playerName(nextPlayer)}`, `Take your 2 shots at the rack!`)
            .then(() => {
              this.turn = nextPlayer;
              this.spawnBall();
              this.status(`${this.playerName(this.turn)}'s turn · 2 shots`);
            });
        } else {
          this.turn = nextPlayer;
          this.spawnBall();
          this.status(this.cpuTurn ? `CPU's turn · 2 shots` : `${this.playerName(this.turn)}'s turn · 2 shots`);
          if (this.cpuTurn) this.cpuShoot();
        }
      }
    }

    /* ---------- Rendering ---------- */
    renderBackdrop(c, w, h) {
      // Warm pub / basement lighting
      const g = c.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#100c28');
      g.addColorStop(0.3, '#1f1642');
      g.addColorStop(1, '#0e0a24');
      c.fillStyle = g;
      c.fillRect(0, 0, w, h);
    }

    render(c) {
      // 1. Perspective Beer Pong Table
      const t = this.table;
      c.save();
      c.shadowColor = 'rgba(0,0,0,0.6)';
      c.shadowBlur = 32;
      c.shadowOffsetY = 16;

      // Wooden plank texture
      const wood = c.createLinearGradient(0, t.topY, 0, t.btmY);
      wood.addColorStop(0, '#6e411b');
      wood.addColorStop(0.5, '#995c26');
      wood.addColorStop(1, '#532e10');
      c.fillStyle = wood;

      c.beginPath();
      c.moveTo(t.x - t.topW / 2, t.topY);
      c.lineTo(t.x + t.topW / 2, t.topY);
      c.lineTo(t.x + t.btmW / 2, t.btmY);
      c.lineTo(t.x - t.btmW / 2, t.btmY);
      c.closePath();
      c.fill();
      c.restore();

      // Table centerline and cup zone triangles
      c.strokeStyle = 'rgba(255,255,255,0.18)';
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(t.x, t.topY);
      c.lineTo(t.x, t.btmY);
      c.stroke();

      // 2. Target Cups (10 Red Solo Cups)
      const targetCups = this.cups[this.turn];
      for (const cup of targetCups) {
        if (!cup.sunk) this.renderCup(c, cup);
      }

      // 3. Re-rack button indicator (if available)
      const remaining = targetCups.filter(cup => !cup.sunk).length;
      if (!this.reRacksUsed[this.turn] && [6, 4, 3, 2].includes(remaining) && !this.ball.inAir) {
        c.fillStyle = '#ffd166';
        U.rr(c, this.W - 100, 20, 85, 32, 16);
        c.fill();
        U.text(c, 'RE-RACK', this.W - 57, 36, { size: 12, color: '#1b1b22', weight: 900 });
      }

      // 4. Ping Pong Ball
      if (this.ball) {
        this.renderBall(c);
      }

      // 5. Aim trajectory indicator (when dragging)
      if (this.dragAim && !this.ball.inAir) {
        const dx = this.dragAim.x - this.ball.x;
        const dy = this.dragAim.y - this.ball.y;
        c.strokeStyle = 'rgba(255,255,255,0.6)';
        c.lineWidth = 2.5;
        c.setLineDash([5, 5]);
        c.beginPath();
        c.moveTo(this.ball.x, this.ball.y);
        c.lineTo(this.ball.x - dx * 1.5, this.ball.y - dy * 1.5);
        c.stroke();
        c.setLineDash([]);
      }
    }

    renderCup(c, cup) {
      const { x, y, r } = cup;
      const h = r * 2.8;

      c.save();
      // Cup cast shadow on table
      c.fillStyle = 'rgba(0,0,0,0.38)';
      c.beginPath();
      c.ellipse(x, y + h * 0.45, r * 1.15, r * 0.45, 0, 0, Math.PI * 2);
      c.fill();

      // Red cup trapezoid body with specular highlights
      const redGrad = c.createLinearGradient(x - r, y, x + r, y);
      redGrad.addColorStop(0, '#c92a2a');
      redGrad.addColorStop(0.35, '#ff6b6b');
      redGrad.addColorStop(0.7, '#e03131');
      redGrad.addColorStop(1, '#a61e1e');
      c.fillStyle = redGrad;

      c.beginPath();
      c.moveTo(x - r, y);
      c.lineTo(x + r, y);
      c.lineTo(x + r * 0.72, y + h);
      c.lineTo(x - r * 0.72, y + h);
      c.closePath();
      c.fill();

      // Horizontal Solo cup plastic ridges
      c.strokeStyle = 'rgba(0,0,0,0.18)';
      c.lineWidth = 1.6;
      [0.32, 0.58].forEach(pct => {
        const ry = y + h * pct;
        const rw = r * (1 - pct * 0.28);
        c.beginPath();
        c.ellipse(x, ry, rw, rw * 0.3, 0, 0, Math.PI);
        c.stroke();
      });

      // White inner cup opening
      c.fillStyle = '#f1f3f5';
      c.beginPath();
      c.ellipse(x, y, r, r * 0.38, 0, 0, Math.PI * 2);
      c.fill();

      // Rolled white outer lip rim
      c.strokeStyle = '#ffffff';
      c.lineWidth = 2.2;
      c.beginPath();
      c.ellipse(x, y, r + 0.5, (r + 0.5) * 0.38, 0, 0, Math.PI * 2);
      c.stroke();

      // Beer inside cup with surface meniscus
      const beerGrad = c.createRadialGradient(x, y + 2, 2, x, y + 2, r * 0.85);
      beerGrad.addColorStop(0, '#ffe066');
      beerGrad.addColorStop(0.8, '#fcc419');
      beerGrad.addColorStop(1, '#e67700');
      c.fillStyle = beerGrad;
      c.beginPath();
      c.ellipse(x, y + 2, r * 0.82, r * 0.28, 0, 0, Math.PI * 2);
      c.fill();

      // Foam ring around edge of liquid
      c.strokeStyle = 'rgba(255,255,255,0.6)';
      c.lineWidth = 1.2;
      c.beginPath();
      c.ellipse(x, y + 2, r * 0.80, r * 0.26, 0, 0, Math.PI * 2);
      c.stroke();

      c.restore();
    }

    renderBall(c) {
      const b = this.ball;
      if (!b || (b.sunk && !b.sinking)) return;

      const scale = b.scale != null ? b.scale : (1 - b.z * 0.48);
      const r = Math.max(7, 20 * scale);

      c.save();
      if (b.alpha != null) c.globalAlpha = Math.max(0, Math.min(1, b.alpha));

      // Ball shadow
      c.fillStyle = 'rgba(0,0,0,0.32)';
      c.beginPath();
      c.ellipse(b.x, b.y + r * 0.9, r * 0.9, r * 0.4, 0, 0, Math.PI * 2);
      c.fill();

      // White celluloid ball with 3D spherical gradient & shine
      U.ball(c, b.x, b.y, r, '#ffffff', { light: '#ffffff', dark: '#d0d4dc' });
      c.restore();
    }
  }

  A.register({
    id: 'cuppong',
    name: 'Cup Pong',
    category: 'Sports',
    tag: 'Party Table Pong',
    icon: A.ICONS.cuppong,
    desc: 'Sink ping pong balls into all 10 red cups. Two shots per turn with table bounce ricochets and re-racks!',
    rules: [
      'Each player shoots 2 balls per turn at their opponent’s 10 cups.',
      'Swipe forward or pull back and release to arc your shot toward the cups.',
      'Balls can swish directly or bounce off the wooden table into a cup.',
      'Sunk cups are removed from play. Re-rack into tighter shapes at 6, 4, 3, or 2 cups.',
      'Clear all 10 cups first to claim victory!'
    ],
    create: (stage, opts) => new CupPongGame(stage, opts)
  });
})(window.Arcade);
