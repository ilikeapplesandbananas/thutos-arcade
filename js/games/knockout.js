/* Knockout — GamePigeon style penguin sumo battle with shrinking iceberg, slingshot aim & water knockoffs! */
(function (A) {
  const { U, Sound } = A;

  class KnockoutGame extends A.Game {
    init() {
      this.W = 420;
      this.H = 760;

      this.round = 1;
      this.turn = (this.opts && this.opts.firstTurn != null) ? this.opts.firstTurn : 0;
      this.r = 18; // penguin radius

      // Iceberg platform (circular ice floe)
      this.baseR = 175;
      this.iceR = this.baseR;
      this.iceCenter = { x: this.W / 2, y: 360 };

      this.penguins = [];
      this.selectedPenguin = null;
      this.pullAim = null;
      this.moving = false;

      this.spawnPenguins();
      this.updateHUD();
    }

    spawnPenguins() {
      this.penguins = [];
      const ic = this.iceCenter;
      const d = 55;

      // Team 0 (Blue) on bottom half
      this.penguins.push({ id: 0, team: 0, x: ic.x - d * 1.2, y: ic.y + d, vx: 0, vy: 0, alive: true, aimDx: 0, aimDy: 0, aimDist: 0, isAimed: false });
      this.penguins.push({ id: 1, team: 0, x: ic.x - d * 0.4, y: ic.y + d * 1.4, vx: 0, vy: 0, alive: true, aimDx: 0, aimDy: 0, aimDist: 0, isAimed: false });
      this.penguins.push({ id: 2, team: 0, x: ic.x + d * 0.4, y: ic.y + d * 1.4, vx: 0, vy: 0, alive: true, aimDx: 0, aimDy: 0, aimDist: 0, isAimed: false });
      this.penguins.push({ id: 3, team: 0, x: ic.x + d * 1.2, y: ic.y + d, vx: 0, vy: 0, alive: true, aimDx: 0, aimDy: 0, aimDist: 0, isAimed: false });

      // Team 1 (Orange/Red) on top half
      this.penguins.push({ id: 4, team: 1, x: ic.x - d * 1.2, y: ic.y - d, vx: 0, vy: 0, alive: true, aimDx: 0, aimDy: 0, aimDist: 0, isAimed: false });
      this.penguins.push({ id: 5, team: 1, x: ic.x - d * 0.4, y: ic.y - d * 1.4, vx: 0, vy: 0, alive: true, aimDx: 0, aimDy: 0, aimDist: 0, isAimed: false });
      this.penguins.push({ id: 6, team: 1, x: ic.x + d * 0.4, y: ic.y - d * 1.4, vx: 0, vy: 0, alive: true, aimDx: 0, aimDy: 0, aimDist: 0, isAimed: false });
      this.penguins.push({ id: 7, team: 1, x: ic.x + d * 1.2, y: ic.y - d, vx: 0, vy: 0, alive: true, aimDx: 0, aimDy: 0, aimDist: 0, isAimed: false });
    }

    /* ---------- Input ---------- */
    onDown(p) {
      if (this.moving || this.over) return;

      // 1. Check Launch Button (x: 100 to 320, y: 675 to 730)
      if (p.x >= 100 && p.x <= 320 && p.y >= 675 && p.y <= 730) {
        Sound.tap();
        this.handleLaunch();
        return;
      }

      // 2. Find if clicking on active player's alive penguin to aim it
      const myTeam = this.mode === 'local' ? this.turn : 0;
      for (const pen of this.penguins) {
        if (pen.alive && pen.team === myTeam && U.dist(p.x, p.y, pen.x, pen.y) < this.r * 2.2) {
          this.selectedPenguin = pen;
          this.pullAim = { x: p.x, y: p.y };
          Sound.tap();
          break;
        }
      }
    }

    onMove(p) {
      if (!this.selectedPenguin || this.moving) return;
      this.pullAim = { x: p.x, y: p.y };
    }

    onUp(p) {
      if (!this.selectedPenguin || this.moving) return;
      const pen = this.selectedPenguin;
      const dx = pen.x - p.x;
      const dy = pen.y - p.y;
      const dist = Math.hypot(dx, dy);

      this.selectedPenguin = null;
      this.pullAim = null;

      if (dist > 14) {
        pen.aimDx = dx;
        pen.aimDy = dy;
        pen.aimDist = dist;
        pen.isAimed = true;
        Sound.click();
      } else {
        pen.isAimed = false;
      }
    }

    /* ---------- Launch All & CPU Aiming ---------- */
    handleLaunch() {
      if (this.moving || this.over) return;

      const playerTeam = this.mode === 'local' ? this.turn : 0;
      const ownAlive = this.penguins.filter(p => p.alive && p.team === playerTeam);
      const enemyTeam = 1 - playerTeam;
      const enemies = this.penguins.filter(p => p.alive && p.team === enemyTeam);

      // Auto-aim any un-aimed friendly penguins towards nearest enemy
      for (const p of ownAlive) {
        if (!p.isAimed) {
          const nearest = enemies.slice().sort((a, b) => U.dist(p.x, p.y, a.x, a.y) - U.dist(p.x, p.y, b.x, b.y))[0];
          if (nearest) {
            p.aimDx = nearest.x - p.x;
            p.aimDy = nearest.y - p.y;
            p.aimDist = 85;
            p.isAimed = true;
          }
        }
      }

      // Local 2-player handoff
      if (this.mode === 'local' && this.turn === 0) {
        this.handoff(1, `Pass to ${this.playerName(1)}`, `Aim your penguins for Round ${this.round}!`)
          .then(() => {
            this.turn = 1;
            this.status(`${this.playerName(1)}: Aim your penguins, then tap Launch!`);
          });
        return;
      }

      // In CPU mode: calculate intelligent launch vectors for all CPU penguins
      if (this.mode === 'cpu') {
        const cpuPenguins = this.penguins.filter(p => p.alive && p.team === 1);
        const playerPenguins = this.penguins.filter(p => p.alive && p.team === 0);
        const skill = this.cpuSkill(0.55, 0.80, 0.96);

        for (const cp of cpuPenguins) {
          let bestFoe = null, bestScore = -9999;
          for (const f of playerPenguins) {
            const d = U.dist(cp.x, cp.y, f.x, f.y);
            const distToEdge = this.iceR - U.dist(f.x, f.y, this.iceCenter.x, this.iceCenter.y);
            const score = 250 - d + (120 - distToEdge) * 1.5;
            if (score > bestScore) {
              bestScore = score;
              bestFoe = f;
            }
          }
          const foe = bestFoe || U.pick(playerPenguins);
          let dx = foe ? (foe.x - cp.x) : 0;
          let dy = foe ? (foe.y - cp.y) : 60;
          if (Math.random() > skill) {
            dx += U.gauss() * (1 - skill) * 55;
            dy += U.gauss() * (1 - skill) * 55;
          }
          cp.aimDx = dx;
          cp.aimDy = dy;
          cp.aimDist = Math.min(130, Math.max(50, Math.hypot(dx, dy) * 0.95));
          cp.isAimed = true;
        }
      }

      this.launchAllPenguins();
    }

    launchAllPenguins() {
      this.moving = true;
      this.selectedPenguin = null;
      this.pullAim = null;
      Sound.whoosh();

      // Launch all aimed penguins simultaneously onto the ice!
      for (const p of this.penguins) {
        if (!p.alive || !p.isAimed) continue;
        const power = U.clamp((p.aimDist || 80) / 140, 0.2, 1.0);
        const speed = power * 960;
        const norm = Math.hypot(p.aimDx, p.aimDy) || 1;
        p.vx = (p.aimDx / norm) * speed;
        p.vy = (p.aimDy / norm) * speed;
        p.isAimed = false;
      }
    }

    skipCpu() {
      // No skip button for Knockout
      return;
    }

    /* ---------- Physics Loop ---------- */
    update(dt) {
      if (!this.moving) return;

      const sub = 8;
      const sdt = dt / sub;

      for (let s = 0; s < sub; s++) {
        // Integrate position & ice friction
        for (const p of this.penguins) {
          if (!p.alive) continue;

          p.x += p.vx * sdt;
          p.y += p.vy * sdt;

          // Low friction sliding on ice!
          const friction = Math.pow(0.978, sdt * 60);
          p.vx *= friction;
          p.vy *= friction;

          // Check if slid off ice edge into water
          const distFromCenter = U.dist(p.x, p.y, this.iceCenter.x, this.iceCenter.y);
          if (distFromCenter > this.iceR + this.r * 0.5) {
            p.alive = false;
            p.vx = 0;
            p.vy = 0;
            Sound.splash();
            this.fx.burst(p.x, p.y, 25, { colors: ['#4cc9f0', '#ffffff', '#ffd166'], speed: 140, life: 0.6 });
            this.banner('SPLASH! 🌊', { color: '#4cc9f0', dur: 0.8 });
          }
        }

        // Penguin-to-penguin rigid body collisions
        const active = this.penguins.filter(p => p.alive);
        for (let i = 0; i < active.length; i++) {
          for (let j = i + 1; j < active.length; j++) {
            const p1 = active[i];
            const p2 = active[j];
            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            const dist = Math.hypot(dx, dy);
            const minDist = this.r * 2;

            if (dist > 0 && dist < minDist) {
              const nx = dx / dist;
              const ny = dy / dist;
              const overlap = minDist - dist;

              p1.x -= nx * overlap * 0.5;
              p1.y -= ny * overlap * 0.5;
              p2.x += nx * overlap * 0.5;
              p2.y += ny * overlap * 0.5;

              // Bouncy elastic impulse
              const kx = p1.vx - p2.vx;
              const ky = p1.vy - p2.vy;
              const p = (nx * kx + ny * ky);

              p1.vx -= p * nx * 1.05;
              p1.vy -= p * ny * 1.05;
              p2.vx += p * nx * 1.05;
              p2.vy += p * ny * 1.05;

              Sound.bounce(Math.hypot(kx, ky) / 500);
            }
          }
        }
      }

      // Check if all penguins stopped moving
      const moving = this.penguins.some(p => p.alive && Math.hypot(p.vx, p.vy) > 3);
      if (!moving) {
        this.moving = false;
        this.resolveTurn();
      }
    }

    resolveTurn() {
      // Check win condition
      const team0Alive = this.penguins.filter(p => p.alive && p.team === 0).length;
      const team1Alive = this.penguins.filter(p => p.alive && p.team === 1).length;

      if (team0Alive === 0 && team1Alive === 0) {
        this.finish({ winner: -1, title: 'Draw!', text: 'All penguins fell into the ocean!' });
        return;
      } else if (team0Alive === 0) {
        this.finish({ winner: 1, title: `${this.playerName(1)} wins!`, text: 'All opponent penguins knocked off!' });
        return;
      } else if (team1Alive === 0) {
        this.finish({ winner: 0, title: `${this.playerName(0)} wins!`, text: 'All opponent penguins knocked off!' });
        return;
      }

      // Next round
      this.round++;
      this.turn = 0;
      if (this.iceR > 100) {
        this.iceR -= 14;
        Sound.thud();
        this.banner('ICE SHRINKING! ❄️', { color: '#4cc9f0', dur: 1.2 });
      }

      this.updateHUD();
      this.status(`Round ${this.round} · Aim your penguins, then tap Launch!`);
    }

    updateHUD() {
      const t0 = this.penguins.filter(p => p.alive && p.team === 0).length;
      const t1 = this.penguins.filter(p => p.alive && p.team === 1).length;

      this.hud({
        score0: t0,
        score1: t1,
        p0sub: `${t0} penguins`,
        p1sub: `${t1} penguins`,
        status: `Round ${this.round} · Aim penguins, tap Launch!`
      });
    }

    /* ---------- Rendering ---------- */
    renderBackdrop(c, w, h) {
      // Deep arctic ocean with subtle floating ice shards
      const sea = c.createRadialGradient(w / 2, h / 2, 80, w / 2, h / 2, h * 0.6);
      sea.addColorStop(0, '#0d2538');
      sea.addColorStop(1, '#05111c');
      c.fillStyle = sea;
      c.fillRect(0, 0, w, h);
    }

    render(c) {
      const ic = this.iceCenter;
      const R = this.iceR;

      // 1. Water Ripple around Iceberg
      c.strokeStyle = 'rgba(126, 211, 252, 0.2)';
      c.lineWidth = 6;
      U.circle(c, ic.x, ic.y, R + 10);
      c.stroke();

      // 2. Iceberg Floe Platform
      c.save();
      c.shadowColor = 'rgba(0,0,0,0.55)';
      c.shadowBlur = 32;
      c.shadowOffsetY = 14;

      // Iceberg 3D depth base
      c.fillStyle = '#4a8ba8';
      U.circle(c, ic.x, ic.y + 14, R);
      c.fill();

      // Shiny icy top surface
      const ice = c.createRadialGradient(ic.x - 30, ic.y - 40, 20, ic.x, ic.y, R);
      ice.addColorStop(0, '#ffffff');
      ice.addColorStop(0.35, '#d0f0fd');
      ice.addColorStop(1, '#a0d8ef');
      c.fillStyle = ice;
      U.circle(c, ic.x, ic.y, R);
      c.fill();
      c.restore();

      // Ice cracks & frost textures
      c.strokeStyle = 'rgba(255,255,255,0.45)';
      c.lineWidth = 1.8;
      c.beginPath();
      c.moveTo(ic.x - R * 0.5, ic.y - R * 0.2);
      c.lineTo(ic.x - R * 0.1, ic.y + R * 0.1);
      c.lineTo(ic.x + R * 0.4, ic.y - R * 0.3);
      c.stroke();

      // 3. Aim arrows for all aimed penguins
      if (!this.moving && !this.over) {
        for (const pen of this.penguins) {
          if (pen.alive && pen.isAimed && pen !== this.selectedPenguin) {
            const aimLen = Math.min(180, pen.aimDist * 1.5);
            const normX = pen.aimDx / pen.aimDist;
            const normY = pen.aimDy / pen.aimDist;

            c.save();
            c.strokeStyle = pen.team === 0 ? '#ffd166' : '#ff5d6c';
            c.lineWidth = 3;
            c.setLineDash([5, 5]);
            c.beginPath();
            c.moveTo(pen.x, pen.y);
            c.lineTo(pen.x + normX * aimLen, pen.y + normY * aimLen);
            c.stroke();
            c.setLineDash([]);

            // Arrow tip
            c.fillStyle = pen.team === 0 ? '#ffd166' : '#ff5d6c';
            c.translate(pen.x + normX * aimLen, pen.y + normY * aimLen);
            c.rotate(Math.atan2(normY, normX));
            c.beginPath();
            c.moveTo(0, 0);
            c.lineTo(-12, -6);
            c.lineTo(-12, 6);
            c.closePath();
            c.fill();
            c.restore();
          }
        }
      }

      // 4. Slingshot Elastic Pull for actively dragged penguin
      if (this.selectedPenguin && this.pullAim && !this.moving) {
        const pen = this.selectedPenguin;
        const dx = pen.x - this.pullAim.x;
        const dy = pen.y - this.pullAim.y;
        const dist = Math.hypot(dx, dy);

        if (dist > 8) {
          const aimLen = Math.min(220, dist * 1.8);
          const normX = dx / dist;
          const normY = dy / dist;

          // Trajectory guideline
          c.strokeStyle = '#ffd166';
          c.lineWidth = 2.5;
          c.setLineDash([5, 5]);
          c.beginPath();
          c.moveTo(pen.x, pen.y);
          c.lineTo(pen.x + normX * aimLen, pen.y + normY * aimLen);
          c.stroke();
          c.setLineDash([]);

          // Slingshot elastic band
          c.strokeStyle = pen.team === 0 ? '#3d8bff' : '#ff5d6c';
          c.lineWidth = 3.5;
          c.beginPath();
          c.moveTo(pen.x, pen.y);
          c.lineTo(this.pullAim.x, this.pullAim.y);
          c.stroke();
        }
      }

      // 5. Penguins
      for (const p of this.penguins) {
        if (p.alive) this.renderPenguin(c, p);
      }

      // 6. Launch Button
      if (!this.moving && !this.over) {
        c.save();
        c.shadowColor = 'rgba(0,0,0,0.45)';
        c.shadowBlur = 16;
        c.shadowOffsetY = 6;
        const lg = c.createLinearGradient(110, 680, 310, 726);
        lg.addColorStop(0, '#ff5d6c');
        lg.addColorStop(1, '#ff9f43');
        c.fillStyle = lg;
        U.rr(c, 110, 680, 200, 46, 23);
        c.fill();
        c.restore();
        U.text(c, 'LAUNCH PENGUINS 🚀', 210, 703, { size: 14, color: '#ffffff', weight: 900 });
      }
    }

    renderPenguin(c, p) {
      const { x, y, team } = p;
      const r = this.r;

      c.save();
      // Drop shadow
      c.fillStyle = 'rgba(0,0,0,0.3)';
      c.beginPath();
      c.ellipse(x, y + r * 0.7, r * 0.95, r * 0.45, 0, 0, Math.PI * 2);
      c.fill();

      // Black penguin body
      c.fillStyle = '#1b1b24';
      U.circle(c, x, y, r);
      c.fill();

      // Team colored beanie / scarf
      c.fillStyle = team === 0 ? '#3d8bff' : '#ff5d6c';
      c.beginPath();
      c.arc(x, y - r * 0.2, r * 0.92, Math.PI, 0);
      c.closePath();
      c.fill();

      // Beanie pom-pom
      c.fillStyle = '#ffd166';
      U.circle(c, x, y - r - 2, 4);
      c.fill();

      // White belly
      c.fillStyle = '#ffffff';
      c.beginPath();
      c.ellipse(x, y + r * 0.25, r * 0.58, r * 0.65, 0, 0, Math.PI * 2);
      c.fill();

      // Cute eyes
      c.fillStyle = '#111';
      U.circle(c, x - 4, y - 2, 2.2); c.fill();
      U.circle(c, x + 4, y - 2, 2.2); c.fill();
      c.fillStyle = '#fff';
      U.circle(c, x - 5, y - 3, 0.8); c.fill();
      U.circle(c, x + 3, y - 3, 0.8); c.fill();

      // Orange beak
      c.fillStyle = '#ff9f43';
      c.beginPath();
      c.moveTo(x - 3.5, y + 1);
      c.lineTo(x + 3.5, y + 1);
      c.lineTo(x, y + 6);
      c.closePath();
      c.fill();

      c.restore();
    }
  }

  A.register({
    id: 'knockout',
    name: 'Knockout',
    category: 'Sports',
    tag: 'Penguin Sumo',
    icon: A.ICONS.knockout,
    desc: 'Slingshot your 4 penguins across the ice and knock rival pieces into the freezing water! Ice shrinks each round.',
    rules: [
      'Touch and pull back on your team’s penguins to aim and set launch power.',
      'Release to launch your penguin sliding across the low-friction ice.',
      'Ram opponent penguins to push them over the icy ledge and eliminate them!',
      'Watch out: the iceberg shrinks every round, forcing high-stakes close-quarters combat.',
      'Last player with penguins remaining on the ice claims the crown!'
    ],
    create: (stage, opts) => new KnockoutGame(stage, opts)
  });
})(window.Arcade);
