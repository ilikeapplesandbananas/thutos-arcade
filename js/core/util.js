/* Shared helpers */
window.Arcade = window.Arcade || {};
(function (A) {
  const U = {};
  U.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  U.lerp = (a, b, t) => a + (b - a) * t;
  U.dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
  U.rand = (a, b) => a + Math.random() * (b - a);
  U.randInt = (a, b) => Math.floor(U.rand(a, b + 1));
  U.pick = arr => arr[Math.floor(Math.random() * arr.length)];
  U.shuffle = arr => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; };
  U.gauss = () => { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  U.easeOut = t => 1 - Math.pow(1 - t, 3);
  U.easeInOut = t => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  U.easeOutBack = t => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
  U.angDiff = (a, b) => { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };

  /* closest point on segment ab to p */
  U.closestOnSeg = (px, py, ax, ay, bx, by) => {
    const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
    let t = l2 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
    t = U.clamp(t, 0, 1);
    return { x: ax + dx * t, y: ay + dy * t, t };
  };

  U.distToSeg = (px, py, ax, ay, bx, by) => {
    const cp = U.closestOnSeg(px, py, ax, ay, bx, by);
    return Math.hypot(px - cp.x, py - cp.y);
  };

  /* ---------- canvas drawing ---------- */
  U.rr = (c, x, y, w, h, r) => {
    r = Math.min(r, w / 2, h / 2);
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  };
  U.circle = (c, x, y, r) => { c.beginPath(); c.arc(x, y, Math.max(0, r), 0, Math.PI * 2); };
  U.font = (size, weight = 800, fam = 'Fredoka') => `${weight} ${size}px ${fam}, Nunito, system-ui, sans-serif`;
  U.text = (c, str, x, y, opt = {}) => {
    c.save();
    c.font = U.font(opt.size || 16, opt.weight || 700, opt.family || 'Fredoka');
    c.textAlign = opt.align || 'center';
    c.textBaseline = opt.baseline || 'middle';
    if (opt.shadow !== false) { c.shadowColor = opt.shadowColor || 'rgba(0,0,0,.35)'; c.shadowBlur = opt.blur ?? 6; c.shadowOffsetY = opt.offY ?? 2; }
    if (opt.stroke) { c.lineWidth = opt.strokeWidth || 4; c.strokeStyle = opt.stroke; c.lineJoin = 'round'; c.strokeText(str, x, y); }
    c.fillStyle = opt.color || '#fff';
    c.fillText(str, x, y);
    c.restore();
  };
  /* glossy sphere */
  U.ball = (c, x, y, r, color, opt = {}) => {
    c.save();
    if (opt.shadow !== false) {
      c.fillStyle = 'rgba(0,0,0,.28)';
      c.beginPath(); c.ellipse(x + r * .18, y + r * .32, r * .95, r * .8, 0, 0, Math.PI * 2); c.fill();
    }
    const g = c.createRadialGradient(x - r * .35, y - r * .4, r * .1, x, y, r * 1.05);
    g.addColorStop(0, opt.light || '#fff');
    g.addColorStop(.25, color);
    g.addColorStop(1, opt.dark || U.shade(color, -0.45));
    c.fillStyle = g; U.circle(c, x, y, r); c.fill();
    c.restore();
  };
  /* lighten/darken hex color, amt -1..1 */
  U.shade = (hex, amt) => {
    let h = hex.replace('#', '');
    if (h.length === 3) h = h.split('').map(ch => ch + ch).join('');
    const n = parseInt(h, 16);
    let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    const t = amt < 0 ? 0 : 255, p = Math.abs(amt);
    r = Math.round((t - r) * p + r); g = Math.round((t - g) * p + g); b = Math.round((t - b) * p + b);
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  };
  U.alpha = (hex, a) => {
    let h = hex.replace('#', '');
    if (h.length === 3) h = h.split('').map(ch => ch + ch).join('');
    const n = parseInt(h, 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  };
  U.fmtTime = s => { s = Math.max(0, Math.ceil(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

  /* Simple particle system used by several games */
  class Particles {
    constructor() { this.list = []; }
    burst(x, y, n, opt = {}) {
      for (let i = 0; i < n; i++) {
        const a = opt.angle != null ? opt.angle + U.rand(-opt.spread || -1, opt.spread || 1) : Math.random() * Math.PI * 2;
        const s = U.rand(opt.speedMin || 40, opt.speed || 180);
        this.list.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0, max: U.rand(.5, opt.life || 1), size: U.rand(opt.sizeMin || 2, opt.size || 5), color: Array.isArray(opt.colors) ? U.pick(opt.colors) : (opt.color || '#fff'), g: opt.gravity ?? 260, shape: opt.shape || 'circle', rot: Math.random() * 6, vr: U.rand(-8, 8) });
      }
    }
    update(dt) {
      for (const p of this.list) { p.life += dt; p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 1 - 1.2 * dt; p.rot += p.vr * dt; }
      this.list = this.list.filter(p => p.life < p.max);
    }
    draw(c) {
      for (const p of this.list) {
        const k = 1 - p.life / p.max;
        c.globalAlpha = Math.min(1, k * 1.6);
        c.fillStyle = p.color;
        if (p.shape === 'rect') { c.save(); c.translate(p.x, p.y); c.rotate(p.rot); c.fillRect(-p.size, -p.size * .5, p.size * 2, p.size); c.restore(); }
        else { U.circle(c, p.x, p.y, p.size * (.4 + .6 * k)); c.fill(); }
      }
      c.globalAlpha = 1;
    }
  }
  U.Particles = Particles;
  U.CONFETTI = ['#ffd166', '#ff5d8f', '#4cc9f0', '#3ee0b0', '#8b5cf6', '#ff9f43'];
  A.U = U;
})(window.Arcade);
