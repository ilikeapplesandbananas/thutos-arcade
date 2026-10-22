/* 8 Ball & 9 Ball Pool — GamePigeon style with ghost-ball aiming lines, cue stick & power slider */
(function (A) {
  const { U, Sound } = A;

  const COLORS = {
    cue: '#ffffff',
    1: '#ffd166', 2: '#3d8bff', 3: '#ff5d6c', 4: '#a855f7',
    5: '#ff9f43', 6: '#2ec4b6', 7: '#9333ea', 8: '#1b1b22',
    9: '#ffd166', 10: '#3d8bff', 11: '#ff5d6c', 12: '#a855f7',
    13: '#ff9f43', 14: '#2ec4b6', 15: '#9333ea'
  };

  class PoolGame extends A.Game {
    init() {
      this.variant = (this.opts && (this.opts.variant || this.opts.gameId)) || this.variant || '8ball';
      this.W = 420;
      this.H = 760;

      // Table area (portrait orientation, pool table viewed from above)
      // tw: 296, tx: 74 leaves 74px on left so power bar has plenty of room
      this.tw = 296;
      this.th = 570;
      this.tx = 74;
      this.ty = (this.H - this.th) / 2 + 10;
      this.r = 9.5; // ball radius

      // Pockets (6 pockets with authentic mouth positioning)
      const pr = 19;
      const x0 = this.tx, x1 = this.tx + this.tw;
      const y0 = this.ty, ym = this.ty + this.th / 2, y1 = this.ty + this.th;
      this.pockets = [
        { id: 0, x: x0 + 8, y: y0 + 8, r: pr },
        { id: 1, x: x1 - 8, y: y0 + 8, r: pr },
        { id: 2, x: x0 + 2, y: ym,     r: pr - 1 },
        { id: 3, x: x1 - 2, y: ym,     r: pr - 1 },
        { id: 4, x: x0 + 8, y: y1 - 8, r: pr },
        { id: 5, x: x1 - 8, y: y1 - 8, r: pr }
      ];

      // Table play bounds (cushion inner edges)
      this.cushion = 18;
      this.minX = this.tx + this.cushion + this.r;
      this.maxX = this.tx + this.tw - this.cushion - this.r;
      this.minY = this.ty + this.cushion + this.r;
      this.maxY = this.ty + this.th - this.cushion - this.r;

      // Game state
      this.balls = [];
      this.sunk = [[], []];
      this.groups = [null, null]; // 'solids' | 'stripes'
      this.score = [0, 0];
      this.turn = (this.opts && this.opts.firstTurn != null) ? this.opts.firstTurn : 0;
      this.aimAngle = -Math.PI / 2; // aiming upward initially
      this.power = 0;
      this.aiming = true;
      this.draggingPower = false;
      this.draggingAim = false;
      this.ballInHand = false;
      this.moving = false;
      this.firstContact = null;
      this.pocketedThisShot = [];
      this.scratch = false;

      this.rackBalls();
      this.hud({
        p0sub: this.variant === '8ball' ? 'Open table' : 'Hit lowest ball',
        p1sub: this.variant === '8ball' ? 'Open table' : 'Hit lowest ball',
        score0: 0,
        score1: 0,
        status: `${this.playerName(this.turn)}: Drag to aim, pull cue to shoot`
      });
      if (this.cpuTurn) {
        this.wait(800, () => this.cpuTakeShot());
      }
    }

    cpuShoot() {
      return this.cpuTakeShot();
    }

    skipCpu() {
      if (!this.cpuTurn || this.over) return;
      if (!this.moving) {
        this.cpuTakeShot();
      }
      let guard = 0;
      while (this.moving && guard < 600) {
        this.update(0.05);
        guard++;
      }
    }

    rackBalls() {
      this.balls = [];
      const cx = this.tx + this.tw / 2;
      const cy = this.ty + this.th * 0.72; // Cue ball near bottom

      // Cue ball (id: 0)
      this.cueBall = { id: 0, x: cx, y: cy, vx: 0, vy: 0, r: this.r, sunk: false, type: 'cue' };
      this.balls.push(this.cueBall);

      const rackY = this.ty + this.th * 0.28;
      const r = this.r;
      const d = r * 2.02;

      if (this.variant === '8ball') {
        // Standard 15-ball triangle rack: 8-ball in center, corners one solid one stripe
        const order = [
          1,
          9, 2,
          3, 8, 10,
          11, 4, 12, 5,
          13, 14, 6, 7, 15
        ];
        let idx = 0;
        for (let row = 0; row < 5; row++) {
          const rowY = rackY - row * (d * 0.866);
          const startX = cx - (row * d) / 2;
          for (let col = 0; col <= row; col++) {
            const id = order[idx++];
            const type = id === 8 ? 'eight' : id <= 7 ? 'solid' : 'stripe';
            this.balls.push({
              id,
              x: startX + col * d,
              y: rowY,
              vx: 0,
              vy: 0,
              r: this.r,
              sunk: false,
              type
            });
          }
        }
      } else {
        // 9-ball diamond rack: 1 ball at the apex, 9 ball in the center
        const diamond = [
          [1],
          [2, 3],
          [4, 9, 5],
          [6, 7],
          [8]
        ];
        for (let row = 0; row < diamond.length; row++) {
          const count = diamond[row].length;
          const rowY = rackY - (row - 2) * (d * 0.866);
          const startX = cx - ((count - 1) * d) / 2;
          for (let col = 0; col < count; col++) {
            const id = diamond[row][col];
            this.balls.push({
              id,
              x: startX + col * d,
              y: rowY,
              vx: 0,
              vy: 0,
              r: this.r,
              sunk: false,
              type: id === 9 ? 'nine' : 'ball'
            });
          }
        }
      }
    }

    lowestBallOnTable() {
      let min = 99;
      for (const b of this.balls) {
        if (!b.sunk && b.id > 0 && b.id < min) min = b.id;
      }
      return min;
    }

    /* ---------- Input handlers ---------- */
    onDown(p) {
      if (this.moving || this.over) return;
      if (this.cpuTurn) return;

      // Ball in hand placement
      if (this.ballInHand) {
        if (p.x >= this.minX && p.x <= this.maxX && p.y >= this.minY && p.y <= this.maxY) {
          // Check collision with other balls
          const overlap = this.balls.some(b => !b.sunk && b.id !== 0 && U.dist(p.x, p.y, b.x, b.y) < this.r * 2.2);
          if (!overlap) {
            this.cueBall.x = p.x;
            this.cueBall.y = p.y;
            this.cueBall.sunk = false;
            this.cueBall.sinking = null;
            this.cueBall.vx = 0;
            this.cueBall.vy = 0;
            this.ballInHand = false;
            this.status(`${this.playerName(this.turn)}: Ball placed. Aim and shoot!`);
            Sound.tap();
          }
        }
        return;
      }

      // Left power slider hit (x: 5 to 52)
      if (p.x < 52) {
        this.draggingPower = true;
        this.updatePower(p.y);
        return;
      }

      // Cue stick pull-back touch (near cue stick or pulling back from cue ball)
      const oppAngle = this.aimAngle + Math.PI;
      const dX = p.x - this.cueBall.x;
      const dY = p.y - this.cueBall.y;
      const projAlongCue = Math.cos(oppAngle) * dX + Math.sin(oppAngle) * dY;
      const distFromCueBall = Math.hypot(dX, dY);
      if (distFromCueBall < 65 || (projAlongCue > 10 && projAlongCue < 220 && Math.abs(-Math.sin(oppAngle) * dX + Math.cos(oppAngle) * dY) < 45)) {
        this.draggingCueStick = true;
        return;
      }

      // Dragging cue or aiming anywhere else on table
      this.draggingAim = true;
      this.updateAim(p);
    }

    onMove(p) {
      if (this.moving || this.over || this.cpuTurn) return;
      if (this.draggingPower) {
        this.updatePower(p.y);
      } else if (this.draggingCueStick) {
        const oppAngle = this.aimAngle + Math.PI;
        const dX = p.x - this.cueBall.x;
        const dY = p.y - this.cueBall.y;
        const pullDist = Math.max(0, Math.cos(oppAngle) * dX + Math.sin(oppAngle) * dY);
        this.power = U.clamp(pullDist / 120, 0, 1);
      } else if (this.draggingAim) {
        this.updateAim(p);
      }
    }

    onUp() {
      if ((this.draggingPower || this.draggingCueStick) && this.power > 0.05) {
        this.shoot(this.power);
      }
      this.draggingPower = false;
      this.draggingCueStick = false;
      this.draggingAim = false;
      this.power = 0;
    }

    updatePower(y) {
      const top = this.ty + 60, btm = this.ty + this.th - 60;
      const norm = U.clamp((y - top) / (btm - top), 0, 1);
      this.power = norm;
    }

    updateAim(p) {
      const dx = p.x - this.cueBall.x;
      const dy = p.y - this.cueBall.y;
      if (Math.hypot(dx, dy) > 10) {
        this.aimAngle = Math.atan2(dy, dx);
      }
    }

    shoot(power) {
      if (this.moving || this.cueBall.sunk) return;
      this.moving = true;
      this.aiming = false;
      this.firstContact = null;
      this.pocketedThisShot = [];
      this.scratch = false;

      // Realistic speed curve fitting chosen pull bar effort
      const speed = U.lerp(150, 1250, Math.pow(power, 1.15));
      this.cueBall.vx = Math.cos(this.aimAngle) * speed;
      this.cueBall.vy = Math.sin(this.aimAngle) * speed;
      Sound.cue(power);
    }

    /* ---------- Physics Loop ---------- */
    update(dt) {
      // CPU Watchdog: ensures CPU never freezes
      if (this.cpuTurn && !this.moving && !this.over && !this.ballInHand) {
        this.cpuIdleTimer = (this.cpuIdleTimer || 0) + dt;
        if (this.cpuIdleTimer > 1.8) {
          this.cpuIdleTimer = 0;
          this.cpuTakeShot();
        }
      } else {
        this.cpuIdleTimer = 0;
      }

      if (!this.moving) return;

      const subSteps = 8;
      const sdt = dt / subSteps;

      for (let s = 0; s < subSteps; s++) {
        // Integrate position & cushion bounce
        for (const b of this.balls) {
          if (b.sunk) continue;

          b.x += b.vx * sdt;
          b.y += b.vy * sdt;

          // Friction
          const friction = Math.pow(0.985, sdt * 60);
          b.vx *= friction;
          b.vy *= friction;
          if (Math.hypot(b.vx, b.vy) < 2) {
            b.vx = 0;
            b.vy = 0;
          }

          // Check pocket drops and funnel suction
          let nearPocket = false;
          for (const p of this.pockets) {
            const dist = U.dist(b.x, b.y, p.x, p.y);
            if (dist < p.r * 1.35) {
              if (!b.sinking && !b.sunk) {
                this.pocketBall(b, p);
              }
              nearPocket = true;
              break;
            } else if (dist < p.r * 2.5) {
              nearPocket = true;
              // Pocket mouth suction funnels the ball smoothly into the cup
              const pull = (p.r * 2.5 - dist) * 28 * sdt;
              b.vx += ((p.x - b.x) / dist) * pull;
              b.vy += ((p.y - b.y) / dist) * pull;
            }
          }
          if (b.sunk || b.sinking) continue;

          // Cushion bounds with open gaps at all 6 pocket mouths
          const ym = this.ty + this.th / 2;
          const cornerGap = 36;
          const sideGap = 24;

          const inTopCushionX = b.x >= this.tx + cornerGap && b.x <= this.tx + this.tw - cornerGap;
          const inBtmCushionX = b.x >= this.tx + cornerGap && b.x <= this.tx + this.tw - cornerGap;
          const inSideCushionY = (b.y >= this.ty + cornerGap && b.y <= ym - sideGap) || (b.y >= ym + sideGap && b.y <= this.ty + this.th - cornerGap);

          let hitRail = false;
          if (inSideCushionY) {
            if (b.x < this.minX) { b.x = this.minX; b.vx = -b.vx * 0.82; hitRail = true; }
            if (b.x > this.maxX) { b.x = this.maxX; b.vx = -b.vx * 0.82; hitRail = true; }
          }
          if (inTopCushionX && b.y < this.minY) {
            b.y = this.minY; b.vy = -b.vy * 0.82; hitRail = true;
          }
          if (inBtmCushionX && b.y > this.maxY) {
            b.y = this.maxY; b.vy = -b.vy * 0.82; hitRail = true;
          }
          if (hitRail && Math.hypot(b.vx, b.vy) > 30) {
            Sound.thud(Math.hypot(b.vx, b.vy) / 600);
          }
        }

        // Ball-to-ball elastic collisions
        const active = this.balls.filter(b => !b.sunk && !b.sinking);
        for (let i = 0; i < active.length; i++) {
          for (let j = i + 1; j < active.length; j++) {
            const b1 = active[i];
            const b2 = active[j];
            const dx = b2.x - b1.x;
            const dy = b2.y - b1.y;
            const dist = Math.hypot(dx, dy);
            const minDist = (b1.r || this.r) + (b2.r || this.r);

            if (dist > 0 && dist < minDist) {
              const nx = dx / dist;
              const ny = dy / dist;
              const overlap = minDist - dist;

              b1.x -= nx * overlap * 0.5;
              b1.y -= ny * overlap * 0.5;
              b2.x += nx * overlap * 0.5;
              b2.y += ny * overlap * 0.5;

              // Elastic collision impulse along normal
              const kx = b1.vx - b2.vx;
              const ky = b1.vy - b2.vy;
              const p = 2 * (nx * kx + ny * ky) / 2; // equal masses

              b1.vx -= p * nx * 0.96;
              b1.vy -= p * ny * 0.96;
              b2.vx += p * nx * 0.96;
              b2.vy += p * ny * 0.96;

              if (b1.id === 0 && !this.firstContact) this.firstContact = b2;
              if (b2.id === 0 && !this.firstContact) this.firstContact = b1;

              const relSpeed = Math.hypot(kx, ky);
              if (relSpeed > 25) Sound.clack(relSpeed / 500);
            }
          }
        }
      }

      // Sinking ball animations into pockets with 3D swirl
      for (const b of this.balls) {
        if (b.sinking) {
          b.sinking.t += dt;
          const k = Math.min(1, b.sinking.t / b.sinking.dur);
          const p = b.sinking;
          const ang = (p.startAngle || 0) + k * Math.PI * 3.5;
          const swirlRad = (1 - k) * 7;
          b.x = U.lerp(p.startX, p.px, k) + Math.cos(ang) * swirlRad;
          b.y = U.lerp(p.startY, p.py, k) + Math.sin(ang) * swirlRad;
          b.scale = 1 - k * 0.70;
          b.alpha = 1 - k * 0.85;
          if (k >= 1) {
            b.sunk = true;
            b.sinking = null;
            b.vx = 0;
            b.vy = 0;
          }
        }
      }

      // Check if all balls have come to rest
      const stillMoving = this.balls.some(b => b.sinking || (!b.sunk && Math.hypot(b.vx, b.vy) > 1));
      if (!stillMoving) {
        this.moving = false;
        this.resolveTurn();
      }
    }

    pocketBall(b, p) {
      if (b.sinking || b.sunk) return;
      b.sinking = {
        px: p.x,
        py: p.y,
        startX: b.x,
        startY: b.y,
        startAngle: Math.atan2(b.y - p.y, b.x - p.x),
        t: 0,
        dur: 0.40
      };
      b.vx = 0;
      b.vy = 0;
      Sound.pocket();
      this.fx.burst(p.x, p.y, 14, { color: '#ffd166', speed: 90, life: 0.5 });

      if (b.id === 0) {
        this.scratch = true;
      } else {
        this.pocketedThisShot.push(b);
      }
    }

    /* ---------- Game Rules & Turn Resolution ---------- */
    resolveTurn() {
      if (this.cueBall.sunk) {
        this.scratch = true;
      }

      const p = this.turn;
      const opp = 1 - p;

      // 8-Ball Rules
      if (this.variant === '8ball') {
        const eightSunk = this.pocketedThisShot.some(b => b.id === 8);
        const playerGroup = this.groups[p];

        if (eightSunk) {
          // Pocketing 8-ball: win if player cleared group and didn't scratch; else loss
          const ownRemaining = this.balls.some(b => !b.sunk && b.id !== 8 && b.id !== 0 && b.type === playerGroup);
          if (ownRemaining || this.scratch || !playerGroup) {
            this.finish({
              winner: opp,
              title: `${this.playerName(opp)} wins!`,
              text: `${this.playerName(p)} pocketed the 8-ball prematurely or scratched.`
            });
          } else {
            this.finish({
              winner: p,
              title: `${this.playerName(p)} wins!`,
              text: `Clean 8-ball finish!`
            });
          }
          return;
        }

        // Scratch handling
        if (this.scratch) {
          this.ballInHand = true;
          this.cueBall.sunk = false;
          this.cueBall.x = this.tx + this.tw / 2;
          this.cueBall.y = this.ty + this.th * 0.75;
          this.cueBall.vx = 0;
          this.cueBall.vy = 0;
          this.turn = opp;
          this.banner('SCRATCH!', { color: '#ff5d6c' });
          this.status(`${this.playerName(opp)}: Ball in hand! Tap table to place cue ball.`);
          this.updateHUD();
          this.prepNext();
          return;
        }

        // Group assignment (open table break or first legal sink)
        let legalSink = false;
        if (!this.groups[0]) {
          const firstNumbered = this.pocketedThisShot.find(b => b.id !== 8);
          if (firstNumbered) {
            this.groups[p] = firstNumbered.type;
            this.groups[opp] = firstNumbered.type === 'solid' ? 'stripe' : 'solid';
            legalSink = true;
            this.banner(firstNumbered.type.toUpperCase() + 'S!', { color: '#ffd166' });
          }
        } else {
          legalSink = this.pocketedThisShot.some(b => b.type === playerGroup);
        }

        // Legal first contact check
        let foul = false;
        if (this.groups[p] && this.firstContact) {
          const ownRemaining = this.balls.some(b => !b.sunk && b.type === this.groups[p]);
          if (ownRemaining && this.firstContact.type !== this.groups[p]) foul = true;
          if (!ownRemaining && this.firstContact.id !== 8) foul = true;
        } else if (!this.firstContact) {
          foul = true;
        }

        if (foul) {
          this.banner('FOUL!', { color: '#ff5d6c' });
          this.ballInHand = true;
          this.turn = opp;
          this.status(`${this.playerName(opp)}: Ball in hand after foul.`);
        } else if (legalSink) {
          this.status(`${this.playerName(p)} pockets a ball and continues!`);
        } else {
          this.turn = opp;
          this.status(`${this.playerName(opp)}'s turn.`);
        }
      }
      // 9-Ball Rules
      else {
        const lowest = this.lowestBallOnTable();
        const nineSunk = this.pocketedThisShot.some(b => b.id === 9);

        if (this.scratch) {
          if (nineSunk) {
            // Re-spot 9-ball on foot spot
            const nb = this.balls.find(b => b.id === 9);
            nb.sunk = false;
            nb.x = this.tx + this.tw / 2;
            nb.y = this.ty + this.th * 0.28;
          }
          this.ballInHand = true;
          this.cueBall.sunk = false;
          this.cueBall.x = this.tx + this.tw / 2;
          this.cueBall.y = this.ty + this.th * 0.75;
          this.turn = opp;
          this.banner('SCRATCH!', { color: '#ff5d6c' });
          this.status(`${this.playerName(opp)}: Ball in hand!`);
          this.updateHUD();
          this.prepNext();
          return;
        }

        const hitLowestFirst = this.firstContact && this.firstContact.id === lowest;
        if (!hitLowestFirst) {
          if (nineSunk) {
            const nb = this.balls.find(b => b.id === 9);
            nb.sunk = false;
            nb.x = this.tx + this.tw / 2;
            nb.y = this.ty + this.th * 0.28;
          }
          this.banner('FOUL!', { color: '#ff5d6c' });
          this.ballInHand = true;
          this.turn = opp;
          this.status(`${this.playerName(opp)}: Ball in hand (must hit lowest ball #${lowest}).`);
        } else if (nineSunk) {
          this.finish({
            winner: p,
            title: `${this.playerName(p)} wins!`,
            text: `9-ball pocketed legally!`
          });
          return;
        } else if (this.pocketedThisShot.length > 0) {
          this.status(`${this.playerName(p)} pockets ball and continues!`);
        } else {
          this.turn = opp;
          this.status(`${this.playerName(opp)}'s turn.`);
        }
      }

      this.updateHUD();
      this.prepNext();
    }

    updateHUD() {
      const solidsLeft = this.balls.filter(b => !b.sunk && b.type === 'solid').length;
      const stripesLeft = this.balls.filter(b => !b.sunk && b.type === 'stripe').length;

      const subFor = i => {
        if (this.variant === '8ball') {
          if (!this.groups[i]) return 'Open table';
          const cnt = this.groups[i] === 'solid' ? solidsLeft : stripesLeft;
          return `${this.groups[i]}s · ${cnt} left`;
        }
        return `Target: #${this.lowestBallOnTable()}`;
      };

      this.hud({
        p0sub: subFor(0),
        p1sub: subFor(1),
        turn: this.turn
      });
    }

    prepNext() {
      this.aiming = true;
      if (this.mode === 'local' && this.humanTurn) {
        // Hand off if needed
      }
      if (this.cpuTurn && !this.over) {
        this.wait(600, () => this.cpuTakeShot());
      }
    }

    /* ---------- CPU AI ---------- */
    cpuTakeShot() {
      if (this.over || !this.cpuTurn) return;

      if (this.ballInHand) {
        // Place cue ball in good position behind head string
        this.cueBall.x = this.tx + this.tw / 2 + U.rand(-35, 35);
        this.cueBall.y = this.ty + this.th * 0.68;
        this.cueBall.sunk = false;
        this.cueBall.sinking = null;
        this.cueBall.vx = 0;
        this.cueBall.vy = 0;
        this.ballInHand = false;
      }

      const playerGroup = this.groups[1];
      let candidateBalls = this.balls.filter(b => !b.sunk && !b.sinking && b.id !== 0);

      if (this.variant === '8ball') {
        if (playerGroup) {
          const own = candidateBalls.filter(b => b.type === playerGroup);
          candidateBalls = own.length > 0 ? own : candidateBalls.filter(b => b.id === 8);
        } else {
          candidateBalls = candidateBalls.filter(b => b.id !== 8);
        }
      } else {
        const lowest = this.lowestBallOnTable();
        candidateBalls = candidateBalls.filter(b => b.id === lowest);
      }

      if (!candidateBalls.length) candidateBalls = this.balls.filter(b => !b.sunk && !b.sinking && b.id !== 0);

      // Find best target ball + pocket combination
      let bestShot = null;
      let bestScore = -9999;

      for (const target of candidateBalls) {
        for (const pocket of this.pockets) {
          const tpX = pocket.x - target.x;
          const tpY = pocket.y - target.y;
          const tpDist = Math.hypot(tpX, tpY);
          const tpNormX = tpX / tpDist;
          const tpNormY = tpY / tpDist;

          // Ghost ball center position
          const gx = target.x - tpNormX * ((target.r || this.r) * 2);
          const gy = target.y - tpNormY * ((target.r || this.r) * 2);

          // Vector from cue ball to ghost ball
          const cgX = gx - this.cueBall.x;
          const cgY = gy - this.cueBall.y;
          const cgDist = Math.hypot(cgX, cgY);

          // Dot product between cue->ghost and target->pocket (closer to 1 is a direct straight-in shot)
          const cut = (cgX * tpNormX + cgY * tpNormY) / cgDist;
          if (cut < 0.08) continue; // too sharp a cut angle

          const score = cut * 240 - tpDist * 0.25 - cgDist * 0.15;
          if (score > bestScore) {
            bestScore = score;
            bestShot = { gx, gy, dist: cgDist, target, cut };
          }
        }
      }

      // Difficulty calibration:
      // Easy: 42% accuracy, sub-optimal choices, noticeable noise
      // Medium: 78% accuracy, solid cut shots
      // Hard: 96% accuracy, calculates ghost ball collision angle & power
      const skill = this.cpuSkill(0.42, 0.78, 0.96);
      let aimAngle;
      if (bestShot && Math.random() < skill) {
        aimAngle = Math.atan2(bestShot.gy - this.cueBall.y, bestShot.gx - this.cueBall.x);
        aimAngle += U.gauss() * (1 - skill) * 0.06;
      } else {
        const fallback = U.pick(candidateBalls) || { x: this.tx + this.tw / 2, y: this.ty + this.th * 0.28 };
        aimAngle = Math.atan2(fallback.y - this.cueBall.y, fallback.x - this.cueBall.x);
        if (Math.random() > skill) aimAngle += U.gauss() * 0.15;
      }

      this.aimAngle = aimAngle;
      this.status(`CPU is lining up a shot...`);

      this.wait(600, () => {
        const pwr = this.cpuSkill(U.rand(0.4, 0.65), U.rand(0.55, 0.8), U.rand(0.65, 0.9));
        this.shoot(pwr);
      });
    }

    /* ---------- Raycast Ghost Ball Aiming Line ---------- */
    calcAimRay() {
      const dirX = Math.cos(this.aimAngle);
      const dirY = Math.sin(this.aimAngle);
      let closestDist = 9999;
      let hitBall = null;

      for (const b of this.balls) {
        if (b.sunk || b.id === 0) continue;
        const toX = b.x - this.cueBall.x;
        const toY = b.y - this.cueBall.y;
        const proj = toX * dirX + toY * dirY;
        if (proj <= 0) continue;

        const perpDist2 = toX * toX + toY * toY - proj * proj;
        const r2 = (this.r * 2) * (this.r * 2);
        if (perpDist2 < r2) {
          const hitDist = proj - Math.sqrt(r2 - perpDist2);
          if (hitDist > 0 && hitDist < closestDist) {
            closestDist = hitDist;
            hitBall = b;
          }
        }
      }

      if (hitBall) {
        const gx = this.cueBall.x + dirX * closestDist;
        const gy = this.cueBall.y + dirY * closestDist;
        // Collision normal from ghost ball to target ball
        const nx = hitBall.x - gx;
        const ny = hitBall.y - gy;
        const nd = Math.hypot(nx, ny) || 1;
        const targetDirX = nx / nd;
        const targetDirY = ny / nd;

        // Tangent direction for deflected cue ball
        const cueDirX = -targetDirY * Math.sign(dirX * -targetDirY + dirY * targetDirX);
        const cueDirY = targetDirX * Math.sign(dirX * -targetDirY + dirY * targetDirX);

        return {
          hit: true,
          gx,
          gy,
          targetBall: hitBall,
          targetDirX,
          targetDirY,
          cueDirX,
          cueDirY
        };
      }

      // No ball hit: ray extends to cushion
      let dist = 600;
      if (dirX > 0) dist = Math.min(dist, (this.maxX - this.cueBall.x) / dirX);
      if (dirX < 0) dist = Math.min(dist, (this.minX - this.cueBall.x) / dirX);
      if (dirY > 0) dist = Math.min(dist, (this.maxY - this.cueBall.y) / dirY);
      if (dirY < 0) dist = Math.min(dist, (this.minY - this.cueBall.y) / dirY);

      return {
        hit: false,
        gx: this.cueBall.x + dirX * Math.max(0, dist),
        gy: this.cueBall.y + dirY * Math.max(0, dist)
      };
    }

    /* ---------- Rendering ---------- */
    renderBackdrop(c, w, h) {
      // Warm dark wood floor background
      const g = c.createRadialGradient(w / 2, h / 2, 40, w / 2, h / 2, Math.max(w, h));
      g.addColorStop(0, '#1a1436');
      g.addColorStop(1, '#0b0920');
      c.fillStyle = g;
      c.fillRect(0, 0, w, h);
    }

    render(c) {
      // 1. Table Outer Wood Rail
      const x = this.tx, y = this.ty, w = this.tw, h = this.th;
      c.save();
      c.shadowColor = 'rgba(0,0,0,0.6)';
      c.shadowBlur = 28;
      c.shadowOffsetY = 12;

      // Beveled wood frame
      const wood = c.createLinearGradient(x, y, x + w, y + h);
      wood.addColorStop(0, '#5a2e17');
      wood.addColorStop(0.5, '#783e1f');
      wood.addColorStop(1, '#4a2412');
      c.fillStyle = wood;
      U.rr(c, x - 18, y - 18, w + 36, h + 36, 26);
      c.fill();
      c.restore();

      // Rail sight diamonds
      c.fillStyle = '#ffdfa0';
      const drawDiamonds = () => {
        // Vertical sights
        for (let i = 1; i <= 3; i++) {
          const dy = y + (h / 4) * i;
          U.circle(c, x - 9, dy, 2.5); c.fill();
          U.circle(c, x + w + 9, dy, 2.5); c.fill();
        }
        // Horizontal sights
        for (let i = 1; i <= 2; i++) {
          const dx = x + (w / 3) * i;
          U.circle(c, dx, y - 9, 2.5); c.fill();
          U.circle(c, dx, y + h + 9, 2.5); c.fill();
        }
      };
      drawDiamonds();

      // 2. Slate Bed Cloth (Green Baize)
      const cloth = c.createRadialGradient(x + w / 2, y + h / 2, 60, x + w / 2, y + h / 2, h * 0.7);
      cloth.addColorStop(0, '#1e824c');
      cloth.addColorStop(1, '#145a32');
      c.fillStyle = cloth;
      U.rr(c, x, y, w, h, 14);
      c.fill();

      // Inner cushion stroke
      c.strokeStyle = '#0e4424';
      c.lineWidth = 8;
      U.rr(c, x + 4, y + 4, w - 8, h - 8, 10);
      c.stroke();

      // Head string line & spot (subtle)
      c.strokeStyle = 'rgba(255,255,255,0.12)';
      c.lineWidth = 1.5;
      c.setLineDash([4, 4]);
      c.beginPath();
      c.moveTo(this.minX, this.ty + this.th * 0.72);
      c.lineTo(this.maxX, this.ty + this.th * 0.72);
      c.stroke();
      c.setLineDash([]);

      // Foot spot
      c.fillStyle = 'rgba(0,0,0,0.35)';
      U.circle(c, x + w / 2, this.ty + this.th * 0.28, 3);
      c.fill();

      // 3. Pockets with 3D drop depth and leather rim
      for (const p of this.pockets) {
        c.save();
        // Outer drop shadow on table cloth
        c.fillStyle = 'rgba(0,0,0,0.55)';
        U.circle(c, p.x, p.y + 1.5, p.r + 3);
        c.fill();

        // Dark leather rim / pocket mouth
        c.fillStyle = '#18120c';
        U.circle(c, p.x, p.y, p.r + 1.5);
        c.fill();
        c.strokeStyle = '#382b20';
        c.lineWidth = 2;
        c.stroke();

        // 3D inner cup depth gradient
        const innerGrad = c.createRadialGradient(p.x, p.y, 2, p.x, p.y, p.r);
        innerGrad.addColorStop(0, '#020305');
        innerGrad.addColorStop(0.75, '#080a10');
        innerGrad.addColorStop(1, '#181a26');
        c.fillStyle = innerGrad;
        U.circle(c, p.x, p.y, p.r);
        c.fill();
        c.restore();
      }

      // 4. Aiming Guidelines (when aiming & not moving)
      if (this.aiming && !this.moving && !this.cueBall.sunk && !this.ballInHand) {
        const ray = this.calcAimRay();

        // Line from cue ball to ghost ball
        c.strokeStyle = 'rgba(255, 255, 255, 0.75)';
        c.lineWidth = 2;
        c.setLineDash([5, 5]);
        c.beginPath();
        c.moveTo(this.cueBall.x, this.cueBall.y);
        c.lineTo(ray.gx, ray.gy);
        c.stroke();
        c.setLineDash([]);

        // Ghost ball at impact point
        c.strokeStyle = 'rgba(255, 255, 255, 0.85)';
        c.lineWidth = 1.8;
        U.circle(c, ray.gx, ray.gy, this.r);
        c.stroke();

        if (ray.hit) {
          // Trajectory of object ball into pocket
          c.strokeStyle = '#ffd166';
          c.lineWidth = 2.2;
          c.beginPath();
          c.moveTo(ray.targetBall.x, ray.targetBall.y);
          c.lineTo(ray.targetBall.x + ray.targetDirX * 70, ray.targetBall.y + ray.targetDirY * 70);
          c.stroke();

          // Deflection line of cue ball
          c.strokeStyle = 'rgba(255, 255, 255, 0.4)';
          c.lineWidth = 1.5;
          c.beginPath();
          c.moveTo(ray.gx, ray.gy);
          c.lineTo(ray.gx + ray.cueDirX * 40, ray.gy + ray.cueDirY * 40);
          c.stroke();
        }

        // Cue stick rendering
        this.renderCueStick(c);
      }

      // 5. Balls (renders visible and sinking balls)
      for (const b of this.balls) {
        if (!b.sunk || b.sinking) this.renderBall(c, b);
      }

      // 6. Ball-in-hand placement indicator
      if (this.ballInHand && !this.moving) {
        c.strokeStyle = '#ffd166';
        c.lineWidth = 2.5;
        c.setLineDash([4, 4]);
        U.circle(c, this.cueBall.x, this.cueBall.y, this.r * 2.2);
        c.stroke();
        c.setLineDash([]);
        U.text(c, 'TAP TO PLACE', this.cueBall.x, this.cueBall.y - 24, { size: 12, color: '#ffd166' });
      }

      // 7. Left Power Bar Slider
      this.renderPowerSlider(c);
    }

    renderBall(c, b) {
      const r = (b.r || this.r) * (b.scale || 1);
      const { x, y, id, type } = b;
      c.save();
      if (b.alpha != null) c.globalAlpha = Math.max(0, Math.min(1, b.alpha));

      // Drop shadow
      c.fillStyle = 'rgba(0,0,0,0.32)';
      c.beginPath();
      c.ellipse(x + 1.5, y + 2.5, r * 0.95, r * 0.75, 0, 0, Math.PI * 2);
      c.fill();

      // Ball base color
      if (type === 'cue') {
        U.ball(c, x, y, r, '#ffffff', { light: '#ffffff', dark: '#d0d4dc' });
        // Red dot on cue ball for spin feedback
        c.fillStyle = '#ff4d6d';
        U.circle(c, x, y, 1.8);
        c.fill();
      } else if (type === 'eight') {
        U.ball(c, x, y, r, '#1b1b22', { light: '#555566', dark: '#0a0a0e' });
        c.fillStyle = '#fff';
        U.circle(c, x, y, r * 0.52);
        c.fill();
        U.text(c, '8', x, y, { size: 10, color: '#111', weight: 900, shadow: false });
      } else if (type === 'stripe' || (this.variant === '9ball' && id === 9)) {
        // Striped ball: white ball with colored center belt
        U.ball(c, x, y, r, '#f5f5f7', { light: '#ffffff', dark: '#cfd2d8' });
        c.save();
        U.circle(c, x, y, r);
        c.clip();
        c.fillStyle = COLORS[id] || '#ffd166';
        c.fillRect(x - r, y - r * 0.45, r * 2, r * 0.9);
        c.restore();

        c.fillStyle = '#fff';
        U.circle(c, x, y, r * 0.48);
        c.fill();
        U.text(c, String(id), x, y, { size: 9, color: '#111', weight: 900, shadow: false });
      } else {
        // Solid ball
        const color = COLORS[id] || '#ffd166';
        U.ball(c, x, y, r, color);
        c.fillStyle = '#fff';
        U.circle(c, x, y, r * 0.48);
        c.fill();
        U.text(c, String(id), x, y, { size: 9, color: '#111', weight: 900, shadow: false });
      }

      c.restore();
    }

    renderCueStick(c) {
      c.save();
      const oppAngle = this.aimAngle + Math.PI;
      const pull = this.power * 50; // pull back distance
      const stickDist = this.r + 10 + pull;
      const stickLen = 220;

      const sx = this.cueBall.x + Math.cos(oppAngle) * stickDist;
      const sy = this.cueBall.y + Math.sin(oppAngle) * stickDist;

      c.translate(sx, sy);
      c.rotate(oppAngle);

      // Cue stick shadow
      c.fillStyle = 'rgba(0,0,0,0.3)';
      c.fillRect(0, 4, stickLen, 4);

      // Wood cue shaft gradient
      const shaft = c.createLinearGradient(0, 0, stickLen, 0);
      shaft.addColorStop(0, '#f0d3a2'); // maple tip
      shaft.addColorStop(0.65, '#d9a764');
      shaft.addColorStop(0.7, '#3d2516'); // butt wrap
      shaft.addColorStop(1, '#1b120c');
      c.fillStyle = shaft;
      c.beginPath();
      c.moveTo(0, -2);
      c.lineTo(stickLen, -5);
      c.lineTo(stickLen, 5);
      c.lineTo(0, 2);
      c.closePath();
      c.fill();

      // White ferrule + blue chalk tip
      c.fillStyle = '#fff';
      c.fillRect(-4, -2.5, 4, 5);
      c.fillStyle = '#3d8bff';
      c.fillRect(-6, -2.5, 2, 5);

      c.restore();
    }

    renderPowerSlider(c) {
      const x = 18;
      const top = this.ty + 40;
      const h = this.th - 80;
      const w = 20;

      // Track background
      c.fillStyle = 'rgba(0,0,0,0.55)';
      U.rr(c, x, top, w, h, 10);
      c.fill();
      c.strokeStyle = 'rgba(255,255,255,0.18)';
      c.lineWidth = 1.5;
      c.stroke();

      // Power fill gradient (yellow -> orange -> red)
      if (this.power > 0) {
        const fillH = h * this.power;
        const fg = c.createLinearGradient(0, top, 0, top + fillH);
        fg.addColorStop(0, '#ffd166');
        fg.addColorStop(0.5, '#ff9f43');
        fg.addColorStop(1, '#ff5d6c');
        c.fillStyle = fg;
        U.rr(c, x + 2, top + 2, w - 4, fillH, 8);
        c.fill();
      }

      // Slider handle
      const hy = top + h * this.power;
      c.save();
      c.shadowColor = this.power > 0 ? '#ff9f43' : 'rgba(0,0,0,0.4)';
      c.shadowBlur = this.power > 0 ? 12 : 6;
      c.fillStyle = '#ffffff';
      U.circle(c, x + w / 2, hy, 13);
      c.fill();
      c.fillStyle = '#1b1b22';
      U.circle(c, x + w / 2, hy, 4.5);
      c.fill();
      c.restore();

      // Power percentage & title - placed with vertical headroom above circular handle
      const pct = Math.round(this.power * 100);
      U.text(c, 'PULL', x + w / 2, top - 36, { size: 10, weight: 900, color: '#a9a3d1' });
      U.text(c, `${pct}%`, x + w / 2, top - 22, { size: 11, weight: 900, color: pct > 75 ? '#ff5d6c' : '#ffd166' });
    }
  }

  // 8-Ball Pool
  A.register({
    id: '8ball',
    name: '8-Ball Pool',
    category: 'Pool',
    tag: 'Solids vs Stripes',
    icon: A.ICONS.pool,
    desc: 'Pocket all solids or stripes, call your shots, and sink the 8-ball to win.',
    rules: [
      'Drag to aim your cue stick with ghost-ball guidelines.',
      'Pull back the power slider on the left to set shot power and shoot.',
      'First player to pocket an object ball claims Solids (1-7) or Stripes (9-15).',
      'Clear your full group before pocketing the 8-ball to win.',
      'Scratch or premature 8-ball pocket results in a foul or loss!'
    ],
    create: (stage, opts) => new PoolGame(stage, Object.assign({}, opts, { variant: '8ball', gameId: '8ball' }))
  });

  // 9-Ball Pool
  A.register({
    id: '9ball',
    name: '9-Ball Pool',
    category: 'Pool',
    tag: 'Rotation Billiards',
    icon: A.ICONS.nineball,
    desc: 'Strike the lowest numbered ball first on every shot. Legally pocket the 9-ball to win!',
    rules: [
      'Drag to aim with precise ghost-ball cue projection.',
      'Pull back the left slider to control power and strike.',
      'Always hit the lowest numbered ball remaining on the table first.',
      'Any legal shot that pockets the 9-ball (including combination shots) wins the match immediately!',
      'Scratch or failing to hit the lowest ball first gives opponent ball-in-hand.'
    ],
    create: (stage, opts) => new PoolGame(stage, Object.assign({}, opts, { variant: '9ball', gameId: '9ball' }))
  });
})(window.Arcade);
