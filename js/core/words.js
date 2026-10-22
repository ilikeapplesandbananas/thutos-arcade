/* Comprehensive Dictionary Controller: ENABLE word list + Modern/Popular Words + Fast O(1) Prefix Tree */
(function (A) {
  let loading = null;

  // Valid 2-letter words (official Scrabble & GamePigeon standard)
  const TWO_LETTER_WORDS = [
    'aa','ab','ad','ae','ag','ah','ai','al','am','an','ar','as','at','aw','ax','ay',
    'ba','be','bi','bo','by','da','de','do','ed','ef','eh','el','em','en','er','es','et','ex',
    'fa','go','ha','he','hi','hm','ho','id','if','in','is','it','jo','ka','la','li','lo',
    'ma','me','mi','mo','mu','my','na','ne','no','nu','od','oe','of','oh','oi','om','on','op',
    'or','os','ow','ox','oy','pa','pe','pi','qi','re','sh','si','so','ta','ti','to',
    'uh','um','un','up','us','ut','we','wo','xi','xu','ya','ye','yo','za'
  ];

  // Modern, pop-culture, tech, slang, and everyday words commonly played
  const MODERN_WORDS = [
    'app','apps','online','wifi','blog','blogs','blogger','meme','memes','vibe','vibes','vibing',
    'hype','hyped','pro','pros','nerd','nerds','geek','geeks','bot','bots','chat','chats','code','codes',
    'text','texts','quiz','quizzes','avatar','avatars','crypto','pix','pixel','pixels','hd','tv','pc','vr','ar',
    'web','site','sites','link','links','sync','syncs','intro','outro','retro','demo','demos','hack','hacks',
    'bio','bios','stats','promo','promos','zoom','chill','chillin','legit','bro','bros','sis','fam','squad',
    'swag','epic','cool','dude','dudes','rizz','sus','cap','goat','drip','lit','rad','slay','flex','extra',
    'tea','snack','fit','fits','mood','icon','fire','bet','clap','claps','roast','roasts','dunk','dunks',
    'gamer','gaming','arcade','cpu','ai','fan','fans','sub','subs','repost','post','posts','dm','tag','tags',
    'live','feed','feeds','stream','streams','reels','clip','clips','lol','omg','wow','yay','oof','oofs',
    'yeet','yeets','tweet','tweets','selfie','selfies','emoji','emojis','wifi','router','glitch','glitches',
    'noob','noobs','mod','mods','ping','pings','buff','buffs','nerf','nerfs','loot','looted','spawn','spawns',
    // Everyday slang, colloquialisms, and adult vocabulary
    'damn','damns','damned','damning','hell','hells','ass','asses','bitch','bitches','bitching',
    'bastard','bastards','cunt','cunts','dick','dicks','cock','cocks','pussy','pussies','shit','shits','shitting',
    'fuck','fucks','fucked','fucking','fucker','fuckers','piss','pisses','pissed','pissing','fart','farts',
    'boob','boobs','tit','tits','penis','penises','vagina','vaginas','crap','craps','crappy',
    'whore','whores','slut','sluts','butt','butts','sexy','babe','babes','hunk','hunks'
  ];

  const W = {
    ready: false,
    list: [],
    set: new Set(),
    prefixSet: new Set(),
    common: [],

    register(all, common) {
      const rawWords = all.split(' ');
      const combined = new Set([...rawWords, ...TWO_LETTER_WORDS, ...MODERN_WORDS]);
      this.list = Array.from(combined).sort();
      this.set = combined;
      this.common = common ? common.split(' ') : [];

      // Build O(1) prefix lookup cache for fast DFS up to 4 letters
      this.prefixSet = new Set();
      for (const w of this.list) {
        if (w.length >= 2) this.prefixSet.add(w.slice(0, 2));
        if (w.length >= 3) this.prefixSet.add(w.slice(0, 3));
        if (w.length >= 4) this.prefixSet.add(w.slice(0, 4));
      }

      this.ready = true;
    },

    load() {
      if (this.ready) return Promise.resolve();
      if (loading) return loading;
      loading = new Promise((res, rej) => {
        if (W.ready) return res();
        const s = document.createElement('script');
        s.src = 'data/words.js';
        s.onload = () => (this.ready ? res() : rej(new Error('Dictionary failed')));
        s.onerror = () => { loading = null; rej(new Error('Dictionary failed to load')); };
        document.head.appendChild(s);
      });
      return loading;
    },

    isWord(w, minLen = 3) {
      if (!w || w.length < minLen) return false;
      return this.set.has(w.toLowerCase());
    },

    /* Fast O(1) prefix check using precomputed sets + binary search for 5+ letter prefixes */
    hasPrefix(p) {
      if (!p) return true;
      p = p.toLowerCase();
      if (p.length <= 4) return this.prefixSet.has(p);

      const a = this.list;
      let lo = 0, hi = a.length;
      while (lo < hi) {
        const m = (lo + hi) >> 1;
        if (a[m] < p) lo = m + 1;
        else hi = m;
      }
      return lo < a.length && a[lo].startsWith(p);
    },

    /* GamePigeon Word Hunt / Word Bites scoring */
    huntScore(len) {
      if (len === 2) return 100;
      const t = { 3: 100, 4: 400, 5: 800, 6: 1400, 7: 1800, 8: 2200 };
      return len >= 9 ? 2200 + (len - 8) * 400 : (t[len] || 0);
    },

    /* GamePigeon Anagrams scoring */
    anagramScore(len) {
      return { 3: 100, 4: 400, 5: 1200, 6: 2000 }[len] || 0;
    },

    /* all dictionary words that can be built from a multiset of letters */
    wordsFromLetters(letters, minLen = 3) {
      const cnt = {};
      for (const ch of letters) {
        const c = String(ch).toLowerCase();
        cnt[c] = (cnt[c] || 0) + 1;
      }
      const out = [];
      for (const w of this.list) {
        if (w.length < minLen || w.length > letters.length) continue;
        const c = Object.assign({}, cnt);
        let ok = true;
        for (const ch of w) {
          if (!c[ch]) { ok = false; break; }
          c[ch]--;
        }
        if (ok) out.push(w);
      }
      return out;
    }
  };

  A.Words = W;
})(window.Arcade);
