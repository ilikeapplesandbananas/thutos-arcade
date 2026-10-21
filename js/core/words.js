/* Dictionary: lazily loads data/words.js (works from file:// too) */
(function (A) {
  let loading = null;
  const W = {
    ready: false,
    list: [], set: null, common: [],
    register(all, common) {
      this.list = all.split(' ');
      this.set = new Set(this.list);
      this.common = common.split(' ');
      this.ready = true;
    },
    load() {
      if (this.ready) return Promise.resolve();
      if (loading) return loading;
      loading = new Promise((res, rej) => {
        const s = document.createElement('script');
        s.src = 'data/words.js';
        s.onload = () => (this.ready ? res() : rej(new Error('Dictionary failed')));
        s.onerror = () => { loading = null; rej(new Error('Dictionary failed to load')); };
        document.head.appendChild(s);
      });
      return loading;
    },
    isWord(w) { return w.length >= 3 && this.set.has(w.toLowerCase()); },
    /* binary search in sorted list */
    hasPrefix(p) {
      p = p.toLowerCase();
      const a = this.list;
      let lo = 0, hi = a.length;
      while (lo < hi) { const m = (lo + hi) >> 1; if (a[m] < p) lo = m + 1; else hi = m; }
      return lo < a.length && a[lo].startsWith(p);
    },
    /* GamePigeon Word Hunt / Word Bites scoring */
    huntScore(len) {
      const t = { 3: 100, 4: 400, 5: 800, 6: 1400, 7: 1800, 8: 2200 };
      return len >= 9 ? 2200 + (len - 8) * 400 : (t[len] || 0);
    },
    /* GamePigeon Anagrams scoring */
    anagramScore(len) { return { 3: 100, 4: 400, 5: 1200, 6: 2000 }[len] || 0; },
    /* all dictionary words that can be built from a multiset of letters */
    wordsFromLetters(letters, minLen = 3) {
      const cnt = {};
      for (const ch of letters) cnt[ch] = (cnt[ch] || 0) + 1;
      const out = [];
      for (const w of this.list) {
        if (w.length < minLen || w.length > letters.length) continue;
        const c = Object.assign({}, cnt);
        let ok = true;
        for (const ch of w) { if (!c[ch]) { ok = false; break; } c[ch]--; }
        if (ok) out.push(w);
      }
      return out;
    }
  };
  A.Words = W;
})(window.Arcade);
