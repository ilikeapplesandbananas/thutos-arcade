/* 301 Darts — GamePigeon style with pub dartboard sectors, swipe throw, 3 darts/turn & Bust rule! */
(function (A) {
  const { U, Sound } = A;

  // Clockwise dartboard numbers starting from top (12 o'clock)
  const SECTORS = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];

  class DartsGame extends A.Game {
    init() {
      this.W = 420;
      this.H = 760;

      this.scores = [301, 301];
      this.turnStartScore = 301;
      this.turn = (this.opts && this.opts.firstTurn != null) ? this.opts.firstTurn : 0;
      this.dartsLeft = 3;
      this.dartsInBoard = [];

      // Dartboard center & radius
      this.board = { x: this.W / 2, y: 280, r: 140 };

      // Aiming & swipe state
      this.aiming = false;
      this.crosshair = { x: this.board.x, y: this.board.y };
      this.swipeStart = null;
      this.inFlight = null;

      this.updateHUD();
      if (this.cpuTurn) {
        this.wait(700, () => this.cpuThrow());
      }
    }

    /* ---------- Input ---------- */
    onDown(p) {
      if (this.cpuTurn || this.over || this.inFlight) return;
      this.aiming = true;
      this.crosshair.x = p.x;
      this.crosshair.y = p.y;
      this.swipeStart = { x: p.x, y: p.y, t: performance.now() };
    }

    onMove(p) {
      if (!this.aiming || this.inFlight) return;
      this.crosshair.x = p.x;
      this.crosshair.y = p.y;
    }

    onUp(p) {
      if (!this.aiming || this.inFlight) return;
      const dt = (performance.now() - this.swipeStart.t) / 1000;
      const dy = p.y - this.swipeStart.y;
      this.aiming = false;
      this.swipeStart = null;

      // Quick flick upward throws dart towards crosshair
      this.throwDart(this.crosshair.x, this.crosshair.y);
    }

    throwDart(aimX, aimY) {
      Sound.whoosh();
      const hitX = aimX + U.gauss() * 4.5;
      const hitY = aimY + U.gauss() * 4.5;

      this.inFlight = {
        startX: this.W / 2,
        startY: this.H - 80,
        endX: hitX,
        endY: hitY,
        t: 0,
        dur: 0.32
      };
    }

    /* ---------- CPU AI ---------- */
    cpuThrow() {
      if (!this.cpuTurn || this.over || this.inFlight) return;

      this.wait(900, () => {
        if (!this.cpuTurn || this.over) return;
        const remaining = this.scores[1];

        // Target selection: Triple 20 if > 60; else aim for exact finish
        let targetAngle = -Math.PI / 2; // Sector 20 (top)
        let targetDist = this.board.r * 0.58; // Triple ring

        if (remaining <= 40 && remaining % 2 === 0) {
          // Aim for double out! (e.g. remaining 40 -> Double 20)
          const targetNum = remaining / 2;
          const idx = SECTORS.indexOf(targetNum);
          if (idx !== -1) {
            targetAngle = -Math.PI / 2 + (idx / 20) * (Math.PI * 2);
            targetDist = this.board.r * 0.81; // Double ring
          }
        } else if (remaining === 50) {
          // Inner bullseye
          targetDist = 0;
        }

        const skill = this.cpuSkill(0.62, 0.82, 0.94);
        let tx = this.board.x + Math.cos(targetAngle) * targetDist;
        let ty = this.board.y + Math.sin(targetAngle) * targetDist;

        if (Math.random() > skill) {
          tx += U.gauss() * 26;
          ty += U.gauss() * 26;
        }

        this.throwDart(tx, ty);
      });
    }

    /* ---------- Board Sector Evaluation ---------- */
    calcScore(x, y) {
      const bx = this.board.x, by = this.board.y, R = this.board.r;
      const dist = U.dist(x, y, bx, by);
      const norm = dist / R;

      // Missed board completely
      if (norm > 1.0) return { pts: 0, label: 'MISS' };

      // Inner Red Bull (50 pts)
      if (norm < 0.05) return { pts: 50, label: 'BULLSEYE 50', double: true };
      // Outer Green Bull (25 pts)
      if (norm < 0.11) return { pts: 25, label: 'BULL 25' };

      // Calculate sector angle (clockwise starting at 12 o'clock sector 20)
      let angle = Math.atan2(y - by, x - bx) + Math.PI / 2;
      if (angle < 0) angle += Math.PI * 2;
      const sectorAngle = (Math.PI * 2) / 20;
      const shifted = (angle + sectorAngle / 2) % (Math.PI * 2);
      const idx = Math.floor(shifted / sectorAngle);
      const val = SECTORS[idx];

      // Double ring (outer thin band: 0.77 to 0.85)
      if (norm >= 0.77 && norm <= 0.85) {
        return { pts: val * 2, label: `DOUBLE ${val} (+${val * 2})`, double: true };
      }
      // Triple ring (inner thin band: 0.52 to 0.60)
      if (norm >= 0.52 && norm <= 0.60) {
        return { pts: val * 3, label: `TRIPLE ${val} (+${val * 3})`, triple: true };
      }

      // Single sector
      return { pts: val, label: `SINGLE ${val}` };
    }

    /* ---------- Animation & Scoring ---------- */
    update(dt) {
      if (this.inFlight) {
        this.inFlight.t += dt;
        if (this.inFlight.t >= this.inFlight.dur) {
          const d = this.inFlight;
          this.inFlight = null;
          this.stickDart(d.endX, d.endY);
        }
      }
    }

    stickDart(x, y) {
      Sound.thunk();
      const res = this.calcScore(x, y);
      this.dartsInBoard.push({ x, y, pts: res.pts });

      const currentScore = this.scores[this.turn];
      const newScore = currentScore - res.pts;

      // Win Condition: exactly 0 points!
      if (newScore === 0) {
        this.scores[this.turn] = 0;
        this.updateHUD();
        Sound.win();
        this.fx.burst(x, y, 35, { colors: U.CONFETTI, speed: 220, life: 1.0 });

        this.finish({
          winner: this.turn,
          title: `${this.playerName(this.turn)} wins!`,
          text: `Hit exactly 0 with a ${res.label}!`
        });
        return;
      }
      // BUST Condition: score drops below 0 or to 1
      else if (newScore < 0) {
        Sound.bad();
        this.banner('BUST!', { color: '#ff5d6c', dur: 1.4 });
        this.scores[this.turn] = this.turnStartScore; // revert to start of turn
        this.updateHUD();

        this.wait(1400, () => {
          this.endTurn();
        });
        return;
      }
      // Legal hit
      else {
        this.scores[this.turn] = newScore;
        if (res.triple) {
          Sound.great();
          this.banner(res.label, { color: '#ffd166', dur: 1.0, size: 36 });
          this.fx.burst(x, y, 14, { color: '#ffd166', speed: 110, life: 0.4 });
        } else if (res.double || res.pts >= 25) {
          Sound.good();
          this.banner(res.label, { color: '#3ee0b0', dur: 0.9, size: 34 });
        } else if (res.pts > 0) {
          this.banner(`-${res.pts}`, { color: '#fff', dur: 0.8, size: 32 });
        } else {
          this.banner('MISS', { color: '#a9a3d1', dur: 0.8 });
        }
      }

      this.dartsLeft--;
      this.updateHUD();

      this.wait(900, () => {
        if (this.dartsLeft > 0) {
          if (this.cpuTurn) this.cpuThrow();
        } else {
          this.endTurn();
        }
      });
    }

    endTurn() {
      this.dartsLeft = 3;
      this.dartsInBoard = [];
      const opp = 1 - this.turn;
      this.turn = opp;
      this.turnStartScore = this.scores[opp];
      this.updateHUD();

      if (this.mode === 'local') {
        this.handoff(opp, `Pass to ${this.playerName(opp)}`, `Remaining: ${this.scores[opp]} points · 3 Darts`)
          .then(() => {
            this.status(`${this.playerName(this.turn)}: Aim & throw 3 darts!`);
          });
      } else {
        this.status(this.cpuTurn ? `CPU's turn · 3 Darts` : `${this.playerName(this.turn)}: Aim & throw 3 darts!`);
        if (this.cpuTurn) this.cpuThrow();
      }
    }

    updateHUD() {
      this.hud({
        score0: this.scores[0],
        score1: this.scores[1],
        p0sub: this.turn === 0 ? `${this.dartsLeft} dart${this.dartsLeft === 1 ? '' : 's'}` : `${this.scores[0]} pts`,
        p1sub: this.turn === 1 ? `${this.dartsLeft} dart${this.dartsLeft === 1 ? '' : 's'}` : `${this.scores[1]} pts`,
        status: `301 Darts · ${this.playerName(this.turn)}: ${this.scores[this.turn]} left`
      });
    }

    /* ---------- Rendering ---------- */
    renderBackdrop(c, w, h) {
      // Atmospheric British pub dartboard cabinet
      const g = c.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#100c24');
      g.addColorStop(0.35, '#1e143b');
      g.addColorStop(1, '#0e0a1e');
      c.fillStyle = g;
      c.fillRect(0, 0, w, h);
    }

    render(c) {
      const bx = this.board.x;
      const by = this.board.y;
      const R = this.board.r;

      // 1. Wooden Octagonal Backing Cabinet
      c.save();
      c.shadowColor = 'rgba(0,0,0,0.6)';
      c.shadowBlur = 32;
      c.shadowOffsetY = 14;

      c.fillStyle = '#3d2516';
      U.rr(c, bx - R - 35, by - R - 35, (R + 35) * 2, (R + 35) * 2, 38);
      c.fill();
      c.restore();

      // Black outer catch ring
      c.fillStyle = '#111218';
      U.circle(c, bx, by, R + 18);
      c.fill();

      // 2. 20 Alternating Board Sectors
      const sectorAngle = (Math.PI * 2) / 20;
      for (let i = 0; i < 20; i++) {
        const startAng = -Math.PI / 2 + (i - 0.5) * sectorAngle;
        const endAng = startAng + sectorAngle;

        // Sector body
        c.fillStyle = i % 2 === 0 ? '#1b1b22' : '#f5e6ca';
        c.beginPath();
        c.moveTo(bx, by);
        c.arc(bx, by, R, startAng, endAng);
        c.closePath();
        c.fill();

        // Double ring (outer thin band)
        c.fillStyle = i % 2 === 0 ? '#e03131' : '#2f9e44';
        c.beginPath();
        c.arc(bx, by, R * 0.85, startAng, endAng);
        c.arc(bx, by, R * 0.77, endAng, startAng, true);
        c.closePath();
        c.fill();

        // Triple ring (inner thin band)
        c.fillStyle = i % 2 === 0 ? '#e03131' : '#2f9e44';
        c.beginPath();
        c.arc(bx, by, R * 0.60, startAng, endAng);
        c.arc(bx, by, R * 0.52, endAng, startAng, true);
        c.closePath();
        c.fill();

        // Number labels along outer rim
        const numAng = -Math.PI / 2 + i * sectorAngle;
        const numX = bx + Math.cos(numAng) * (R + 10);
        const numY = by + Math.sin(numAng) * (R + 10);
        U.text(c, String(SECTORS[i]), numX, numY, { size: 13, weight: 900, color: '#ffd166', shadow: false });
      }

      // Outer Green Bull (25 pts)
      c.fillStyle = '#2f9e44';
      U.circle(c, bx, by, R * 0.11);
      c.fill();

      // Inner Red Bull (50 pts)
      c.fillStyle = '#e03131';
      U.circle(c, bx, by, R * 0.05);
      c.fill();

      // Metal spider wire grid
      c.strokeStyle = 'rgba(255,255,255,0.45)';
      c.lineWidth = 1.2;
      for (let i = 0; i < 20; i++) {
        const ang = -Math.PI / 2 + (i - 0.5) * sectorAngle;
        c.beginPath();
        c.moveTo(bx, by);
        c.lineTo(bx + Math.cos(ang) * R, by + Math.sin(ang) * R);
        c.stroke();
      }
      U.circle(c, bx, by, R * 0.85); c.stroke();
      U.circle(c, bx, by, R * 0.77); c.stroke();
      U.circle(c, bx, by, R * 0.60); c.stroke();
      U.circle(c, bx, by, R * 0.52); c.stroke();

      // 3. Stuck Darts
      for (const d of this.dartsInBoard) {
        c.save();
        // Dart shadow
        c.fillStyle = 'rgba(0,0,0,0.35)';
        U.circle(c, d.x + 3, d.y + 4, 4); c.fill();

        // Dart flight wings & barrel
        c.fillStyle = '#ff5d6c';
        U.circle(c, d.x, d.y, 4.5); c.fill();
        c.fillStyle = '#ffd166';
        U.circle(c, d.x, d.y, 2); c.fill();
        c.restore();
      }

      // 4. Dart In Flight
      if (this.inFlight) {
        const k = this.inFlight.t / this.inFlight.dur;
        const curX = U.lerp(this.inFlight.startX, this.inFlight.endX, k);
        const curY = U.lerp(this.inFlight.startY, this.inFlight.endY, k) - Math.sin(k * Math.PI) * 45;
        const scale = U.lerp(1.3, 0.5, k);

        c.save();
        c.translate(curX, curY);
        c.scale(scale, scale);

        // Steel barrel & flight wings
        c.fillStyle = '#ced4da';
        c.fillRect(-2, -20, 4, 30);
        c.fillStyle = '#ff5d6c';
        c.beginPath();
        c.moveTo(-8, 10); c.lineTo(0, -6); c.lineTo(8, 10); c.lineTo(0, 18);
        c.closePath();
        c.fill();
        c.restore();
      }

      // 5. Crosshairs Aim Reticle (when aiming)
      if (this.aiming && !this.inFlight) {
        const cx = this.crosshair.x;
        const cy = this.crosshair.y;

        c.strokeStyle = '#ffd166';
        c.lineWidth = 2.2;
        U.circle(c, cx, cy, 22);
        c.stroke();

        c.beginPath();
        c.moveTo(cx - 30, cy); c.lineTo(cx - 8, cy);
        c.moveTo(cx + 8, cy); c.lineTo(cx + 30, cy);
        c.moveTo(cx, cy - 30); c.lineTo(cx, cy - 8);
        c.moveTo(cx, cy + 8); c.lineTo(cx, cy + 30);
        c.stroke();
      }

      // 6. Remaining Darts Bar on Bottom
      c.fillStyle = 'rgba(0,0,0,0.35)';
      U.rr(c, this.W / 2 - 80, this.H - 85, 160, 46, 23);
      c.fill();

      for (let i = 0; i < 3; i++) {
        const dx = this.W / 2 - 40 + i * 40;
        const available = i < this.dartsLeft;
        c.fillStyle = available ? '#ffd166' : 'rgba(255,255,255,0.15)';
        U.circle(c, dx, this.H - 62, 10);
        c.fill();
        if (available) {
          c.fillStyle = '#1b1b22';
          U.circle(c, dx, this.H - 62, 3);
          c.fill();
        }
      }
    }
  }

  A.register({
    id: 'darts',
    name: 'Darts',
    category: 'Sports',
    tag: 'Classic Pub 301',
    icon: A.ICONS.darts,
    desc: 'Countdown from 301 to exactly zero. 3 darts per turn with Double & Triple multipliers and the Bust rule!',
    rules: [
      'Each player starts at 301. Your goal is to subtract your score to exactly 0.',
      'Touch and hold anywhere on the board to line up your crosshair, then release to throw.',
      'Thin outer ring = DOUBLE (2x). Thin inner ring = TRIPLE (3x). Triple 20 is worth 60 points!',
      'Bullseye: Outer Green = 25 pts, Inner Red = 50 pts.',
      'Bust Rule: If your score drops below 0, you BUST! Your turn ends and your score resets to what it was at the start of that turn.'
    ],
    create: (stage, opts) => new DartsGame(stage, opts)
  });
})(window.Arcade);
