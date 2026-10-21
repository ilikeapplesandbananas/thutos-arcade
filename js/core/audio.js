/* Tiny synthesized sound kit (Web Audio, no files) */
(function (A) {
  let ctx = null, master = null;
  let muted = localStorage.getItem('arcade.muted') === '1';
  const ensure = () => {
    if (muted) return null;
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = .55; master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  };
  const tone = (freq, dur, opt = {}) => {
    const c = ensure(); if (!c) return;
    const t = c.currentTime + (opt.delay || 0);
    const o = c.createOscillator(), g = c.createGain();
    o.type = opt.type || 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (opt.to) o.frequency.exponentialRampToValueAtTime(opt.to, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(opt.vol || .3, t + (opt.attack || .005));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + .05);
  };
  let noiseBuf = null;
  const noise = (dur, opt = {}) => {
    const c = ensure(); if (!c) return;
    if (!noiseBuf) { noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
    const t = c.currentTime + (opt.delay || 0);
    const s = c.createBufferSource(); s.buffer = noiseBuf;
    const f = c.createBiquadFilter(); f.type = opt.filter || 'bandpass'; f.frequency.value = opt.freq || 1200; f.Q.value = opt.q || 1;
    const g = c.createGain();
    g.gain.setValueAtTime(opt.vol || .3, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(master); s.start(t); s.stop(t + dur + .05);
  };
  const S = {
    get muted() { return muted; },
    toggle() { muted = !muted; localStorage.setItem('arcade.muted', muted ? '1' : '0'); if (!muted) ensure(); return muted; },
    unlock: ensure,
    click: () => tone(900, .05, { type: 'triangle', vol: .12 }),
    tap: () => tone(620, .06, { type: 'sine', vol: .18 }),
    clack: (v = 1) => { tone(1800 + Math.random() * 400, .04, { type: 'triangle', vol: .08 + .3 * Math.min(1, v) }); noise(.03, { freq: 3500, q: 2, vol: .1 * Math.min(1, v) }); },
    cue: (v = 1) => { noise(.06, { freq: 2200, q: 1.5, vol: .25 * v }); tone(300, .05, { type: 'triangle', vol: .15 * v }); },
    thud: (v = 1) => { tone(140, .12, { type: 'sine', to: 70, vol: .3 * Math.min(1, v) }); noise(.05, { freq: 400, vol: .1 * v }); },
    pocket: () => { tone(200, .18, { type: 'sine', to: 90, vol: .3 }); noise(.12, { freq: 600, vol: .12, delay: .02 }); },
    bounce: (v = 1) => tone(240, .1, { type: 'sine', to: 120, vol: .25 * Math.min(1, v) }),
    swish: () => { noise(.35, { freq: 2600, q: .6, vol: .22, filter: 'highpass' }); },
    rim: () => { tone(520, .25, { type: 'triangle', vol: .14 }); tone(780, .2, { type: 'sine', vol: .07 }); },
    plop: () => { tone(420, .14, { type: 'sine', to: 180, vol: .3 }); noise(.15, { freq: 900, vol: .12 }); },
    splash: () => { noise(.45, { freq: 700, q: .5, vol: .3 }); tone(160, .25, { to: 60, vol: .15 }); },
    whoosh: () => noise(.3, { freq: 1400, q: .7, vol: .16 }),
    thunk: () => { tone(180, .1, { type: 'square', to: 90, vol: .12 }); noise(.06, { freq: 900, vol: .2 }); },
    draw: () => noise(.25, { freq: 500, q: 3, vol: .06 }),
    tick: () => tone(1200, .03, { type: 'square', vol: .05 }),
    good: () => { tone(660, .12, { type: 'triangle', vol: .2 }); tone(990, .16, { type: 'triangle', vol: .18, delay: .08 }); },
    great: () => { [523, 659, 784, 1046].forEach((f, i) => tone(f, .18, { type: 'triangle', vol: .18, delay: i * .07 })); },
    bad: () => { tone(220, .18, { type: 'sawtooth', to: 160, vol: .1 }); },
    win: () => { [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, .3, { type: 'triangle', vol: .2, delay: i * .1 })); },
    lose: () => { [440, 392, 349, 294].forEach((f, i) => tone(f, .3, { type: 'triangle', vol: .16, delay: i * .14 })); },
    letter: (i = 0) => tone(500 + i * 45, .06, { type: 'sine', vol: .14 })
  };
  A.Sound = S;
})(window.Arcade);
