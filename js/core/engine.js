/* Game base class: canvas sizing, fixed-timestep loop, input, managed timers, clean teardown. */
(function (A) {
  const U = A.U;
  const STEP = 1 / 120;

  class Game {
    constructor(stage, opts) {
      this.stage = stage;
      this.opts = opts;
      this.mode = opts.mode;            // 'cpu' | 'local'
      this.level = opts.level;          // 'easy' | 'medium' | 'hard'
      this.variant = opts.variant;
      this.names = opts.names;          // [p0, p1]
      this.ui = opts.ui;
      this.W = 420; this.H = 760;       // logical world (portrait, like a phone)
      this.turn = 0;
      this.timeScale = 1;
      this.time = 0;
      this.paused = false;
      this.over = false;
      this._timers = new Set();
      this._banners = [];
      this.fx = new U.Particles();
    }

    /* ---------- lifecycle ---------- */
    start() {
      const c = this.canvas = document.createElement('canvas');
      this.ctx = c.getContext('2d');
      this.stage.appendChild(c);
      this._onDown = e => this._pointer(e, 'down');
      this._onMove = e => this._pointer(e, 'move');
      this._onUp = e => this._pointer(e, 'up');
      this._onKey = e => { if (!this.paused && !this.over && this.onKey) this.onKey(e); };
      c.addEventListener('pointerdown', this._onDown);
      c.addEventListener('pointermove', this._onMove);
      c.addEventListener('pointerup', this._onUp);
      c.addEventListener('pointercancel', this._onUp);
      c.addEventListener('contextmenu', e => e.preventDefault());
      window.addEventListener('keydown', this._onKey);
      this._ro = new ResizeObserver(() => this.resize());
      this._ro.observe(this.stage);
      this.resize();
      this.init();
      this._last = performance.now();
      this._acc = 0;
      this._alive = true;
      this._loop = t => this.frame(t);
      this._raf = requestAnimationFrame(this._loop);
    }

    destroy() {
      this._alive = false;
      cancelAnimationFrame(this._raf);
      this._timers.forEach(id => clearTimeout(id));
      this._timers.clear();
      if (this._ro) this._ro.disconnect();
      window.removeEventListener('keydown', this._onKey);
      if (this.canvas) this.canvas.remove();
      if (this.cleanup) this.cleanup();
    }

    resize() {
      const r = this.stage.getBoundingClientRect();
      if (!r.width || !r.height) return;
      this.dpr = Math.min(2, window.devicePixelRatio || 1);
      this.cw = r.width; this.ch = r.height;
      this.canvas.width = Math.round(r.width * this.dpr);
      this.canvas.height = Math.round(r.height * this.dpr);
      this.scale = Math.min(r.width / this.W, r.height / this.H);
      this.ox = (r.width - this.W * this.scale) / 2;
      this.oy = (r.height - this.H * this.scale) / 2;
    }

    frame(t) {
      if (!this._alive) return;
      let dt = (t - this._last) / 1000;
      this._last = t;
      if (!(dt > 0)) dt = 0;
      if (dt > .1) dt = .1;
      try {
        if (!this.paused) {
          this._acc += dt * this.timeScale;
          let n = 0;
          while (this._acc >= STEP && n < 40) { this.time += STEP; this.update(STEP); this.fx.update(STEP); this._acc -= STEP; n++; }
          if (n >= 40) this._acc = 0;
        }
        for (const b of this._banners) b.t += dt;
        this._banners = this._banners.filter(b => b.t < b.dur);
        this.draw();
      } catch (err) {
        if (!this._errShown) { console.error('[Arcade]', err); this._errShown = true; }
      }
      this._raf = requestAnimationFrame(this._loop);
    }

    draw() {
      const c = this.ctx, d = this.dpr;
      c.setTransform(d, 0, 0, d, 0, 0);
      this.renderBackdrop(c, this.cw, this.ch);
      c.setTransform(d * this.scale, 0, 0, d * this.scale, d * this.ox, d * this.oy);
      this.render(c);
      this.fx.draw(c);
      this.drawBanners(c);
    }

    /* ---------- input ---------- */
    toWorld(e) {
      const r = this.canvas.getBoundingClientRect();
      return { x: (e.clientX - r.left - this.ox) / this.scale, y: (e.clientY - r.top - this.oy) / this.scale, t: performance.now() };
    }
    _pointer(e, kind) {
      if (kind === 'down') {
        if (this._pid != null) return;
        A.Sound.unlock();
        this._pid = e.pointerId;
        try { this.canvas.setPointerCapture(e.pointerId); } catch (_) { }
      } else if (e.pointerId !== this._pid) return;
      if (kind === 'up') this._pid = null;
      e.preventDefault();
      if (this.paused || this.over) return;
      const p = this.toWorld(e);
      if (kind === 'down' && this.onDown) this.onDown(p);
      if (kind === 'move' && this.onMove) this.onMove(p);
      if (kind === 'up' && this.onUp) this.onUp(p);
    }

    /* ---------- helpers ---------- */
    wait(ms, fn) {
      const id = setTimeout(() => { this._timers.delete(id); if (this._alive) fn(); }, ms / Math.max(1, this.timeScale));
      this._timers.add(id);
      return id;
    }
    get cpuTurn() { return this.mode === 'cpu' && this.turn === 1; }
    get humanTurn() { return !this.cpuTurn; }
    playerName(i) { return this.names[i]; }
    cpuSkill(easy, medium, hard) { return this.level === 'easy' ? easy : this.level === 'hard' ? hard : medium; }

    hud(state) { this.ui.hud(Object.assign({ turn: this.turn }, state)); }
    status(text) { this.ui.hud({ status: text }); }

    banner(text, opt = {}) {
      this._banners.push({ text, sub: opt.sub || '', color: opt.color || '#fff', t: 0, dur: opt.dur || 1.5, y: opt.y || this.H * .42, size: opt.size || 44 });
    }
    drawBanners(c) {
      for (const b of this._banners) {
        const k = b.t / b.dur;
        const s = k < .15 ? U.easeOutBack(k / .15) : 1;
        const a = k > .8 ? 1 - (k - .8) / .2 : 1;
        c.save();
        c.globalAlpha = Math.max(0, a);
        c.translate(this.W / 2, b.y);
        c.scale(s, s);
        U.text(c, b.text, 0, 0, { size: b.size, weight: 700, color: b.color, stroke: 'rgba(20,10,40,.85)', strokeWidth: 7, blur: 12 });
        if (b.sub) U.text(c, b.sub, 0, b.size * .8, { size: 18, weight: 700, color: '#fff', stroke: 'rgba(20,10,40,.8)', strokeWidth: 5 });
        c.restore();
      }
    }

    async handoff(player, title, text) {
      this.paused = true;
      await this.ui.handoff(player, title, text);
      this.paused = false;
      this._last = performance.now();
    }

    finish(result) {
      if (this.over) return;
      this.over = true;
      const humanWon = this.mode === 'cpu' ? result.winner === 0 : result.winner >= 0;
      if (humanWon) { A.Sound.win(); this.fx.burst(this.W / 2, this.H * .35, 90, { colors: U.CONFETTI, speed: 420, gravity: 420, life: 2.2, shape: 'rect', size: 6 }); }
      else A.Sound.lose();
      this.wait(1400, () => this.ui.end(result));
    }

    /* default backdrop: fill whole canvas */
    renderBackdrop(c, w, h) { c.fillStyle = this.bg || '#0b0920'; c.fillRect(0, 0, w, h); }
    init() { } update() { } render() { }
  }

  A.Game = Game;
  A.GAMES = [];
  A.register = def => A.GAMES.push(def);
})(window.Arcade);
