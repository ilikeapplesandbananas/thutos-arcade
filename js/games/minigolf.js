/* Mini Golf — GamePigeon style 3-hole course with bank shots, bumpers, sand traps, water hazards & par scoring! */
(function (A) {
  const { U, Sound } = A;

  const COURSES = [
    // Hole 1: Classic Straightaway with Angled Bank Walls (Par 2)
    {
      par: 2,
      start: { x: 210, y: 660 },
      hole: { x: 210, y: 180 },
      walls: [
        { ax: 70, ay: 120, bx: 350, by: 120 },
        { ax: 350, ay: 120, bx: 350, by: 700 },
        { ax: 350, ay: 700, bx: 70, by: 700 },
        { ax: 70, ay: 700, bx: 70, by: 120 },
        // Choke bumpers
        { ax: 70, ay: 400, bx: 160, by: 400 },
        { ax: 260, ay: 400, bx: 350, by: 400 }
      ],
      bumpers: [
        { x: 210, y: 320, r: 24 }
      ],
      hazards: []
    },
    // Hole 2: Dual Route with Center Sand Trap (Par 3)
    {
      par: 3,
      start: { x: 210, y: 660 },
      hole: { x: 210, y: 160 },
      walls: [
        { ax: 60, ay: 100, bx: 360, by: 100 },
        { ax: 360, ay: 100, bx: 360, by: 700 },
        { ax: 360, ay: 700, bx: 60, by: 700 },
        { ax: 60, ay: 700, bx: 60, by: 100 },
        // Island divider
        { ax: 160, ay: 340, bx: 260, by: 340 },
        { ax: 260, ay: 340, bx: 260, by: 480 },
        { ax: 260, ay: 480, bx: 160, by: 480 },
        { ax: 160, ay: 480, bx: 160, by: 340 }
      ],
      bumpers: [
        { x: 110, y: 410, r: 18 },
        { x: 310, y: 410, r: 18 }
      ],
      hazards: [
        { type: 'sand', x: 210, y: 250, rx: 55, ry: 35 }
      ]
    },
    // Hole 3: The Dogleg with Water Hazard (Par 3)
    {
      par: 3,
      start: { x: 130, y: 660 },
      hole: { x: 290, y: 170 },
      walls: [
        { ax: 60, ay: 420, bx: 60, by: 700 },
        { ax: 60, ay: 700, bx: 200, by: 700 },
        { ax: 200, ay: 700, bx: 200, by: 520 },
        { ax: 200, ay: 520, bx: 360, by: 520 },
        { ax: 360, ay: 520, bx: 360, by: 110 },
        { ax: 360, ay: 110, bx: 220, by: 110 },
        { ax: 220, ay: 110, bx: 220, by: 420 },
        { ax: 220, ay: 420, bx: 60, by: 420 }
      ],
      bumpers: [
        { x: 290, y: 320, r: 22 }
      ],
      hazards: [
        { type: 'water', x: 290, y: 450, rx: 45, ry: 30 }
      ]
    }
  ];

  class MiniGolfGame extends A.Game {
    init() {
      this.W = 420;
      this.H = 760;

      this.currentHole = 0;
      this.strokes = [0, 0];       // strokes for current hole [p0, p1]
      this.totalScores = [0, 0];   // cumulative strokes across all holes
      this.turn = 0;
      this.holeFinished = [false, false];

      this.r = 8.5; // golf ball radius
      this.ball = { x: 0, y: 0, vx: 0, vy: 0, inHole: false };
      this.pullAim = null;
      this.moving = false;

      this.loadHole(0);
    }

    loadHole(holeIdx) {
      this.currentHole = holeIdx;
      this.course = COURSES[holeIdx];
      this.strokes = [0, 0];
      this.holeFinished = [false, false];
      this.turn = 0;

      this.resetBallToStart();
      this.banner(`HOLE ${holeIdx + 1} · PAR ${this.course.par}`, { color: '#ffd166', dur: 1.2 });
      this.updateHUD();
    }

    resetBallToStart() {
      this.ball.x = this.course.start.x;
      this.ball.y = this.course.start.y;
      this.ball.vx = 0;
      this.ball.vy = 0;
      this.ball.inHole = false;
      this.moving = false;
      this.pullAim = null;
    }

    /* ---------- Input ---------- */
    onDown(p) {
      if (this.moving || this.over || this.cpuTurn || this.ball.inHole) return;
      if (U.dist(p.x, p.y, this.ball.x, this.ball.y) < 55) {
        this.pullAim = { x: p.x, y: p.y };
      }
    }

    onMove(p) {
      if (!this.pullAim || this.moving) return;
      this.pullAim = { x: p.x, y: p.y };
    }

    onUp(p) {
      if (!this.pullAim || this.moving) return;
      const dx = this.ball.x - p.x;
      const dy = this.ball.y - p.y;
      const dist = Math.hypot(dx, dy);
      this.pullAim = null;

      if (dist > 12) {
        this.putt(dx, dy, dist);
      }
    }

    putt(dx, dy, dist) {
      this.moving = true;
      this.strokes[this.turn]++;
      this.totalScores[this.turn]++;

      const power = U.clamp(dist / 140, 0.1, 1.0);
      const speed = power * 780;
      const norm = Math.hypot(dx, dy) || 1;

      this.ball.vx = (dx / norm) * speed;
      this.ball.vy = (dy / norm) * speed;

      Sound.cue(power);
      this.updateHUD();
    }

    /* ---------- CPU AI ---------- */
    cpuPutt() {
      if (!this.cpuTurn || this.over || this.moving || this.ball.inHole) return;

      this.wait(800, () => {
        if (!this.cpuTurn || this.over) return;
        const target = this.course.hole;
        const dx = target.x - this.ball.x;
        const dy = target.y - this.ball.y;
        const dist = Math.hypot(dx, dy);
        const accuracy = this.cpuSkill(0.68, 0.85, 0.96);

        let aimX = dx, aimY = dy;
        if (Math.random() > accuracy) {
          aimX += U.gauss() * 25;
          aimY += U.gauss() * 25;
        }

        const pwrDist = Math.min(130, dist * 0.45);
        this.putt(aimX, aimY, pwrDist);
      });
    }

    /* ---------- Physics Loop ---------- */
    update(dt) {
      if (!this.moving) return;

      const sub = 8;
      const sdt = dt / sub;

      for (let s = 0; s < sub; s++) {
        this.ball.x += this.ball.vx * sdt;
        this.ball.y += this.ball.vy * sdt;

        // Check if rolling over sand trap
        let inSand = false;
        for (const h of this.course.hazards) {
          if (h.type === 'sand' && U.dist(this.ball.x, this.ball.y, h.x, h.y) < h.rx) {
            inSand = true;
            break;
          }
        }

        // Friction: sand slows much faster than turf
        const friction = inSand ? Math.pow(0.92, sdt * 60) : Math.pow(0.982, sdt * 60);
        this.ball.vx *= friction;
        this.ball.vy *= friction;

        // Check water hazard (penalty + reset)
        for (const h of this.course.hazards) {
          if (h.type === 'water' && U.dist(this.ball.x, this.ball.y, h.x, h.y) < h.rx) {
            Sound.splash();
            this.fx.burst(this.ball.x, this.ball.y, 18, { color: '#4cc9f0', speed: 120, life: 0.5 });
            this.banner('WATER HAZARD! +1', { color: '#ff5d6c' });
            this.strokes[this.turn]++;
            this.totalScores[this.turn]++;
            this.resetBallToStart();
            this.updateHUD();
            return;
          }
        }

        // Hole cup suction & sink detection
        const hole = this.course.hole;
        const dHole = U.dist(this.ball.x, this.ball.y, hole.x, hole.y);
        const ballSpeed = Math.hypot(this.ball.vx, this.ball.vy);

        if (dHole < 16) {
          // Gravity well pulls ball toward cup center
          this.ball.vx += (hole.x - this.ball.x) * 14 * sdt;
          this.ball.vy += (hole.y - this.ball.y) * 14 * sdt;

          if (dHole < 10 && ballSpeed < 320) {
            this.sinkHole();
            return;
          }
        }

        // Wall collisions (segment bounce)
        for (const w of this.course.walls) {
          const pt = U.closestOnSeg(this.ball.x, this.ball.y, w.ax, w.ay, w.bx, w.by);
          const dist = U.dist(this.ball.x, this.ball.y, pt.x, pt.y);
          if (dist < this.r) {
            const nx = (this.ball.x - pt.x) / (dist || 1);
            const ny = (this.ball.y - pt.y) / (dist || 1);
            const dot = this.ball.vx * nx + this.ball.vy * ny;
            if (dot < 0) {
              this.ball.vx = (this.ball.vx - 2 * dot * nx) * 0.82;
              this.ball.vy = (this.ball.vy - 2 * dot * ny) * 0.82;
              Sound.thud(Math.hypot(this.ball.vx, this.ball.vy) / 600);
            }
          }
        }

        // Circular bumpers
        for (const b of this.course.bumpers) {
          const dist = U.dist(this.ball.x, this.ball.y, b.x, b.y);
          if (dist < this.r + b.r) {
            const nx = (this.ball.x - b.x) / dist;
            const ny = (this.ball.y - b.y) / dist;
            const dot = this.ball.vx * nx + this.ball.vy * ny;
            if (dot < 0) {
              this.ball.vx = (this.ball.vx - 2 * dot * nx) * 1.15; // bouncy rubber bumper!
              this.ball.vy = (this.ball.vy - 2 * dot * ny) * 1.15;
              Sound.rim();
              this.fx.burst(b.x, b.y, 10, { color: '#ff9f43', speed: 80, life: 0.3 });
            }
          }
        }

        if (ballSpeed < 2) {
          this.ball.vx = 0;
          this.ball.vy = 0;
          break;
        }
      }

      if (Math.hypot(this.ball.vx, this.ball.vy) < 2) {
        this.moving = false;
        if (!this.ball.inHole) {
          this.switchTurnOrContinue();
        }
      }
    }

    sinkHole() {
      this.moving = false;
      this.ball.inHole = true;
      this.ball.x = this.course.hole.x;
      this.ball.y = this.course.hole.y;
      this.ball.vx = 0;
      this.ball.vy = 0;
      this.holeFinished[this.turn] = true;

      Sound.pocket();
      this.fx.burst(this.ball.x, this.ball.y, 25, { colors: U.CONFETTI, speed: 180, life: 0.8 });

      const par = this.course.par;
      const count = this.strokes[this.turn];
      let term = 'PAR';
      if (count === 1) term = 'HOLE IN ONE! 🌟';
      else if (count === par - 1) term = 'BIRDIE! 🦅';
      else if (count === par + 1) term = 'BOGEY';
      else if (count > par + 1) term = `+${count - par}`;

      this.banner(term, { color: count <= par ? '#3ee0b0' : '#ff5d6c', dur: 1.4 });

      this.wait(1600, () => {
        // Check if other player still needs to complete this hole
        const opp = 1 - this.turn;
        if (!this.holeFinished[opp]) {
          this.turn = opp;
          this.resetBallToStart();
          this.updateHUD();
          if (this.mode === 'local') {
            this.handoff(opp, `Pass to ${this.playerName(opp)}`, `Hole ${this.currentHole + 1} · Par ${this.course.par}`);
          } else if (this.cpuTurn) {
            this.cpuPutt();
          }
        } else {
          // Both players finished hole -> move to next hole
          if (this.currentHole < COURSES.length - 1) {
            this.loadHole(this.currentHole + 1);
          } else {
            // Match finished: lowest total strokes wins
            const s0 = this.totalScores[0];
            const s1 = this.totalScores[1];
            const winner = s0 < s1 ? 0 : s1 < s0 ? 1 : -1;

            this.finish({
              winner,
              title: winner === -1 ? 'Draw!' : `${this.playerName(winner)} wins!`,
              text: `${this.playerName(0)}: ${s0} strokes  ·  ${this.playerName(1)}: ${s1} strokes`
            });
          }
        }
      });
    }

    switchTurnOrContinue() {
      // In GamePigeon, player continues putting until sunk, or alternating
      if (this.cpuTurn) {
        this.cpuPutt();
      }
    }

    updateHUD() {
      this.hud({
        score0: this.totalScores[0],
        score1: this.totalScores[1],
        p0sub: `Hole: ${this.strokes[0]}`,
        p1sub: `Hole: ${this.strokes[1]}`,
        status: `Hole ${this.currentHole + 1} of ${COURSES.length} (Par ${this.course.par})`
      });
    }

    /* ---------- Rendering ---------- */
    renderBackdrop(c, w, h) {
      // Deep blue/indigo clubhouse ambient background
      c.fillStyle = '#0f1124';
      c.fillRect(0, 0, w, h);
    }

    render(c) {
      // 1. Lush Green Turf Course
      c.save();
      c.shadowColor = 'rgba(0,0,0,0.5)';
      c.shadowBlur = 24;
      c.shadowOffsetY = 12;

      // Golf course turf gradient
      const turf = c.createRadialGradient(this.W / 2, this.H / 2, 40, this.W / 2, this.H / 2, this.H * 0.6);
      turf.addColorStop(0, '#2b8a3e');
      turf.addColorStop(1, '#1b5e20');
      c.fillStyle = turf;

      // Draw course bounding polygon from walls
      c.beginPath();
      const walls = this.course.walls;
      c.moveTo(walls[0].ax, walls[0].ay);
      for (const w of walls) c.lineTo(w.bx, w.by);
      c.closePath();
      c.fill();
      c.restore();

      // 2. Sand Traps & Water Hazards
      for (const h of this.course.hazards) {
        if (h.type === 'sand') {
          c.fillStyle = '#fcc419';
          c.beginPath();
          c.ellipse(h.x, h.y, h.rx, h.ry, 0, 0, Math.PI * 2);
          c.fill();
          c.strokeStyle = '#e67700';
          c.lineWidth = 3;
          c.stroke();
          U.text(c, 'SAND', h.x, h.y, { size: 10, color: '#d9480f', weight: 900 });
        } else if (h.type === 'water') {
          c.fillStyle = '#22b8cf';
          c.beginPath();
          c.ellipse(h.x, h.y, h.rx, h.ry, 0, 0, Math.PI * 2);
          c.fill();
          c.strokeStyle = '#1098ad';
          c.lineWidth = 3;
          c.stroke();
          U.text(c, 'WATER', h.x, h.y, { size: 10, color: '#fff', weight: 900 });
        }
      }

      // 3. Wooden Course Border Walls
      c.strokeStyle = '#5a2e17';
      c.lineWidth = 14;
      c.lineCap = 'round';
      c.lineJoin = 'round';
      c.beginPath();
      for (const w of this.course.walls) {
        c.moveTo(w.ax, w.ay);
        c.lineTo(w.bx, w.by);
      }
      c.stroke();

      // Inner rim highlight
      c.strokeStyle = '#8d4d24';
      c.lineWidth = 4;
      c.stroke();

      // 4. Bumpers
      for (const b of this.course.bumpers) {
        c.save();
        c.shadowColor = 'rgba(0,0,0,0.4)';
        c.shadowBlur = 10;
        U.ball(c, b.x, b.y, b.r, '#ff9f43', { light: '#ffd8a8', dark: '#d9480f' });
        c.strokeStyle = '#fff';
        c.lineWidth = 2.5;
        U.circle(c, b.x, b.y, b.r * 0.5);
        c.stroke();
        c.restore();
      }

      // 5. Hole Cup & Red Flag Stick
      const hole = this.course.hole;
      c.fillStyle = '#080a0c';
      U.circle(c, hole.x, hole.y, 11);
      c.fill();
      c.strokeStyle = '#fff';
      c.lineWidth = 1.5;
      c.stroke();

      // Flag pole + pennant
      c.fillStyle = '#fff';
      c.fillRect(hole.x - 1.5, hole.y - 40, 3, 40);
      c.fillStyle = '#ff5d6c';
      c.beginPath();
      c.moveTo(hole.x + 1.5, hole.y - 40);
      c.lineTo(hole.x + 24, hole.y - 30);
      c.lineTo(hole.x + 1.5, hole.y - 20);
      c.closePath();
      c.fill();

      // 6. Aim Guideline & Power Arrow (when pulling back)
      if (this.pullAim && !this.moving && !this.ball.inHole) {
        const dx = this.ball.x - this.pullAim.x;
        const dy = this.ball.y - this.pullAim.y;
        const dist = Math.hypot(dx, dy);

        if (dist > 8) {
          const power = U.clamp(dist / 140, 0.1, 1.0);
          const aimLen = Math.min(220, dist * 1.8);
          const normX = dx / dist;
          const normY = dy / dist;

          // Trajectory dashed guide line
          c.strokeStyle = 'rgba(255,255,255,0.75)';
          c.lineWidth = 2.5;
          c.setLineDash([5, 5]);
          c.beginPath();
          c.moveTo(this.ball.x, this.ball.y);
          c.lineTo(this.ball.x + normX * aimLen, this.ball.y + normY * aimLen);
          c.stroke();
          c.setLineDash([]);

          // Pull arrow
          c.strokeStyle = '#ffd166';
          c.lineWidth = 3.5;
          c.beginPath();
          c.moveTo(this.ball.x, this.ball.y);
          c.lineTo(this.pullAim.x, this.pullAim.y);
          c.stroke();
        }
      }

      // 7. Golf Ball
      if (!this.ball.inHole) {
        U.ball(c, this.ball.x, this.ball.y, this.r, '#ffffff', { light: '#ffffff', dark: '#d0d4dc' });
        // Dimples
        c.fillStyle = '#ced4da';
        U.circle(c, this.ball.x - 2, this.ball.y - 2, 1.2); c.fill();
        U.circle(c, this.ball.x + 2, this.ball.y - 1, 1.2); c.fill();
        U.circle(c, this.ball.x - 1, this.ball.y + 2, 1.2); c.fill();
      }
    }
  }

  A.register({
    id: 'minigolf',
    name: 'Mini Golf',
    category: 'Sports',
    tag: 'Putt-Putt Course',
    icon: A.ICONS.minigolf,
    desc: '3-hole mini golf challenge with bumper ricochets, sand traps, and water hazards. Fewest strokes wins!',
    rules: [
      'Tap and drag backward from your golf ball to set your putt angle and power.',
      'Release to strike the ball. Bank off walls and bounce off orange bumpers to navigate corners.',
      'Watch out for Sand Traps (drastically slows roll) and Water Hazards (+1 penalty stroke & reset).',
      'Sink the ball in the fewest strokes across all 3 holes to win!'
    ],
    create: (stage, opts) => new MiniGolfGame(stage, opts)
  });
})(window.Arcade);
