/* Anagrams — GamePigeon style 6-letter bank, 60s countdown, grouped word slots, shuffle & length scoring! */
(function (A) {
  const { U, Sound, Words } = A;

  // 66 rich 6-letter seeds that guarantee dozens of valid 3, 4, 5 and 6-letter anagrams
  const SEEDS = [
    'PLANET', 'STREAM', 'MASTER', 'GARDEN', 'SPRING', 'SILVER',
    'WINTER', 'CASTLE', 'FLOWER', 'FRIEND', 'FOREST', 'DANCER',
    'LISTEN', 'PRINCE', 'ORANGE', 'MONKEY', 'RESCUE', 'SIMPLE',
    'BRIDGE', 'CANDLE', 'DOCTOR', 'FARMER', 'HUNTER', 'ISLAND',
    'JUNGLE', 'KNIGHT', 'LEMONS', 'MARKET', 'NATURE', 'PALACE',
    'PENCIL', 'POCKET', 'RABBIT', 'SAILOR', 'SHADOW', 'TIGERS',
    'TRAVEL', 'VALLEY', 'WIZARD', 'YELLOW', 'BEAUTY', 'BREEZE',
    'CHANCE', 'CLOVER', 'DRAGON', 'EAGLES', 'FLIGHT', 'FROZEN',
    'GOLDEN', 'HARBOR', 'HEROES', 'IMPACT', 'LEGEND', 'MAGNET',
    'MEADOW', 'MIRROR', 'ROCKET', 'SEASON', 'TEMPLE', 'VICTOR',
    'ARTIST', 'BASKET', 'CAMERA', 'DESERT', 'ENERGY', 'FATHER'
  ];

  class AnagramsGame extends A.Game {
    init() {
      this.W = 420;
      this.H = 760;

      this.round = 0;
      this.scores = [0, 0];
      this.foundWords = [new Set(), new Set()];
      this.timeLeft = 60.0;
      this.activeRound = false;

      // Pick seed word
      this.seedWord = U.pick(SEEDS);
      this.bankLetters = this.seedWord.split('');
      this.shuffledBank = U.shuffle(this.bankLetters.slice());

      // Current entered word in input tray
      this.currentWord = '';
      this.usedBankIndices = new Set();

      // Word slots data: find all valid words for this seed
      this.validWords = [];

      Words.load().then(() => {
        this.validWords = Words.wordsFromLetters(this.bankLetters, 3);
        this.completedRounds = 0;
        const first = (this.opts && this.opts.firstTurn != null) ? this.opts.firstTurn : 0;
        this.startRound(first);
      });
    }

    startRound(playerIdx) {
      this.turn = playerIdx;
      this.round = playerIdx;
      this.timeLeft = 60.0;
      this.activeRound = true;
      this.currentWord = '';
      this.usedBankIndices.clear();

      // Fresh randomized 6-letter seed word for this round
      if (playerIdx > 0 || !this.validWords || !this.validWords.length) {
        const otherSeeds = SEEDS.filter(s => s !== this.seedWord);
        this.seedWord = U.pick(otherSeeds.length ? otherSeeds : SEEDS);
        this.bankLetters = this.seedWord.split('');
        this.validWords = Words.wordsFromLetters(this.bankLetters, 3);
      }
      this.shuffledBank = U.shuffle(this.bankLetters.slice());

      this.banner(playerIdx === 0 ? 'START!' : `${this.playerName(playerIdx)}'S TURN!`, { color: '#ffd166', dur: 1.2 });
      Sound.good();

      this.hud({
        score0: this.scores[0],
        score1: this.scores[1],
        p0sub: this.round === 0 ? '60s' : `${this.scores[0]} pts`,
        p1sub: this.round === 1 ? '60s' : `${this.scores[1]} pts`,
        status: `${this.playerName(playerIdx)}: Spell words using the 6 letters!`
      });

      if (this.cpuTurn) {
        this.runCpuSolving();
      }
    }

    /* ---------- Input ---------- */
    onDown(p) {
      if (!this.activeRound || this.cpuTurn) return;

      // 1. Bank letter tiles (y: 570)
      const tileW = 52, tileH = 58, gap = 8;
      const startX = (this.W - (6 * tileW + 5 * gap)) / 2;
      const bankY = 570;

      if (p.y >= bankY && p.y <= bankY + tileH) {
        for (let i = 0; i < 6; i++) {
          const tx = startX + i * (tileW + gap);
          if (p.x >= tx && p.x <= tx + tileW) {
            if (!this.usedBankIndices.has(i)) {
              this.usedBankIndices.add(i);
              this.currentWord += this.shuffledBank[i];
              Sound.letter(this.currentWord.length);
            }
            return;
          }
        }
      }

      // 2. Action Buttons: Shuffle, Clear, Enter (y: 650)
      const btnY = 650;
      // Shuffle button (left: 30 to 120)
      if (p.y >= btnY && p.y <= btnY + 44) {
        if (p.x >= 30 && p.x <= 130) {
          this.shuffleBank();
          return;
        }
        // Clear button (center: 150 to 240)
        if (p.x >= 150 && p.x <= 250) {
          this.clearWord();
          return;
        }
        // Enter button (right: 270 to 390)
        if (p.x >= 270 && p.x <= 390) {
          this.submitCurrentWord();
          return;
        }
      }

      // 3. Tapping on the active input tray removes the last letter
      if (p.y >= 490 && p.y <= 550 && this.currentWord.length > 0) {
        this.backspace();
      }
    }

    onKey(e) {
      if (!this.activeRound || this.cpuTurn) return;
      const k = e.key.toUpperCase();

      if (k === 'ENTER') {
        this.submitCurrentWord();
      } else if (k === 'BACKSPACE') {
        this.backspace();
      } else if (k === ' ') {
        this.shuffleBank();
      } else if (/^[A-Z]$/.test(k)) {
        // Find unused bank tile with this letter
        for (let i = 0; i < 6; i++) {
          if (!this.usedBankIndices.has(i) && this.shuffledBank[i] === k) {
            this.usedBankIndices.add(i);
            this.currentWord += k;
            Sound.letter(this.currentWord.length);
            break;
          }
        }
      }
    }

    backspace() {
      if (!this.currentWord.length) return;
      const lastChar = this.currentWord[this.currentWord.length - 1];
      this.currentWord = this.currentWord.slice(0, -1);

      // Re-enable the corresponding bank index
      for (const idx of Array.from(this.usedBankIndices).reverse()) {
        if (this.shuffledBank[idx] === lastChar) {
          this.usedBankIndices.delete(idx);
          break;
        }
      }
      Sound.tap();
    }

    clearWord() {
      this.currentWord = '';
      this.usedBankIndices.clear();
      Sound.click();
    }

    shuffleBank() {
      Sound.tap();
      this.clearWord();
      this.shuffledBank = U.shuffle(this.bankLetters.slice());
    }

    canSpellFromBank(word) {
      const counts = {};
      for (const ch of this.bankLetters) {
        const c = String(ch).toLowerCase();
        counts[c] = (counts[c] || 0) + 1;
      }
      for (const ch of word.toLowerCase()) {
        if (!counts[ch]) return false;
        counts[ch]--;
      }
      return true;
    }

    submitCurrentWord() {
      const word = this.currentWord.trim().toLowerCase();
      this.clearWord();
      if (word.length < 3) return;

      const already = this.foundWords[this.round].has(word);
      const canSpell = this.canSpellFromBank(word);
      const inDict = Words.isWord(word, 3) || this.validWords.includes(word);
      const isLegal = canSpell && inDict;

      if (isLegal && !already) {
        if (!this.validWords.includes(word)) this.validWords.push(word);
        const pts = Words.anagramScore(word.length);
        this.scores[this.round] += pts;
        this.foundWords[this.round].add(word);

        Sound.good();
        this.banner(`+${pts} (${word.toUpperCase()})`, { color: '#3ee0b0', dur: 0.9, size: 28 });
        this.fx.burst(this.W / 2, 510, 15, { colors: ['#ffd166', '#3ee0b0'], speed: 120, life: 0.5 });
        this.updateHUD();
      } else if (already) {
        Sound.bad();
        this.banner('ALREADY SOLVED', { color: '#ff9f43', dur: 0.7, size: 24 });
      } else {
        Sound.bad();
        this.banner('NOT A WORD', { color: '#ff5d6c', dur: 0.7, size: 24 });
      }
    }

    /* ---------- CPU Automation ---------- */
    runCpuSolving() {
      if (!this.activeRound || !this.cpuTurn) return;

      const cpuCount = this.cpuSkill(8, 18, 30);

      // Difficulty sorting: Hard targets the 5 and 6 letter anagrams first; Easy stays on 3 letters
      const sorted = this.validWords.slice().sort((a, b) => {
        if (this.level === 'hard') return b.length - a.length || (Math.random() - 0.5);
        if (this.level === 'easy') return a.length - b.length || (Math.random() - 0.5);
        return Math.random() - 0.5;
      });
      const targets = sorted.slice(0, cpuCount);

      let idx = 0;
      const solveNext = () => {
        if (!this.activeRound || !this.cpuTurn || idx >= targets.length) return;
        const w = targets[idx++];
        const pts = Words.anagramScore(w.length);
        this.scores[1] += pts;
        this.foundWords[1].add(w);

        Sound.letter(Math.min(6, w.length));
        this.banner(`+${pts} (${w.toUpperCase()})`, { color: '#ff5d6c', dur: 0.8, size: 26 });
        this.updateHUD();

        const delay = this.cpuSkill(U.rand(2800, 3900), U.rand(1800, 2600), U.rand(1100, 1800));
        this.wait(delay, solveNext);
      };

      this.wait(1500, solveNext);
    }

    /* ---------- Timer & Round Loop ---------- */
    update(dt) {
      if (this.activeRound) {
        this.timeLeft -= dt;
        if (this.timeLeft <= 0) {
          this.timeLeft = 0;
          this.activeRound = false;
          this.endRound();
          return;
        }

        this.hud({
          p0sub: this.round === 0 ? `${Math.ceil(this.timeLeft)}s` : `${this.scores[0]} pts`,
          p1sub: this.round === 1 ? `${Math.ceil(this.timeLeft)}s` : `${this.scores[1]} pts`
        });
      }
    }

    endRound() {
      Sound.lose();
      this.banner("TIME'S UP!", { color: '#ff5d6c', dur: 1.5 });

      this.wait(1600, () => {
        this.completedRounds = (this.completedRounds || 0) + 1;
        if (this.completedRounds === 1) {
          const nextPlayer = 1 - this.round;
          if (this.mode === 'local') {
            this.handoff(nextPlayer, `Pass to ${this.playerName(nextPlayer)}`, `${this.playerName(this.round)} scored ${this.scores[this.round]} pts. Beat it!`)
              .then(() => this.startRound(nextPlayer));
          } else {
            this.startRound(nextPlayer);
          }
        } else {
          // Resolve match
          const s0 = this.scores[0];
          const s1 = this.scores[1];
          const winner = s0 > s1 ? 0 : s1 > s0 ? 1 : -1;

          // Word breakdown data
          const p0List = Array.from(this.foundWords[0]).map(w => ({ word: w, pts: Words.anagramScore(w.length) }))
            .sort((a, b) => b.pts - a.pts || a.word.localeCompare(b.word));
          const p1List = Array.from(this.foundWords[1]).map(w => ({ word: w, pts: Words.anagramScore(w.length) }))
            .sort((a, b) => b.pts - a.pts || a.word.localeCompare(b.word));
          const missedList = this.validWords
            .filter(w => !this.foundWords[0].has(w) && !this.foundWords[1].has(w))
            .map(w => ({ word: w, pts: Words.anagramScore(w.length) }))
            .sort((a, b) => b.pts - a.pts || a.word.localeCompare(b.word))
            .slice(0, 50);

          this.finish({
            winner,
            title: winner === -1 ? 'Draw!' : `${this.playerName(winner)} wins!`,
            text: `${this.playerName(0)}: ${s0} pts (${p0List.length} words) · ${this.playerName(1)}: ${s1} pts (${p1List.length} words)`,
            words: {
              p0: p0List,
              p1: p1List,
              missed: missedList
            }
          });
        }
      });
    }

    updateHUD() {
      this.hud({
        score0: this.scores[0],
        score1: this.scores[1]
      });
    }

    /* ---------- Rendering ---------- */
    renderBackdrop(c, w, h) {
      const g = c.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#120d2d');
      g.addColorStop(0.5, '#1b1442');
      g.addColorStop(1, '#0e0b24');
      c.fillStyle = g;
      c.fillRect(0, 0, w, h);
    }

    render(c) {
      // 1. Clock & Word Slots Header
      c.fillStyle = 'rgba(0,0,0,0.35)';
      U.rr(c, this.W / 2 - 75, 20, 150, 40, 20);
      c.fill();
      U.text(c, `⏱ ${Math.ceil(this.timeLeft)}s`, this.W / 2, 40, { size: 20, color: this.timeLeft < 10 ? '#ff5d6c' : '#ffd166', weight: 900 });

      // 2. Word Slot Boxes (grouped by length: 3, 4, 5, 6 letters)
      this.renderWordSlots(c);

      // 3. Active Current Input Tray
      this.renderInputTray(c);

      // 4. 6 Letter Bank Tiles
      this.renderBankTiles(c);

      // 5. Action Buttons (Shuffle, Clear, Enter)
      this.renderActionButtons(c);
    }

    renderWordSlots(c) {
      // Display small slot pills of solved words
      const currentSolved = Array.from(this.foundWords[this.round]);
      const startY = 80;

      c.fillStyle = 'rgba(0,0,0,0.2)';
      U.rr(c, 20, startY, this.W - 40, 390, 20);
      c.fill();

      // Summary counts by length
      const counts = { 3: 0, 4: 0, 5: 0, 6: 0 };
      for (const w of currentSolved) counts[w.length] = (counts[w.length] || 0) + 1;

      U.text(c, `SOLVED WORDS (${currentSolved.length})`, this.W / 2, startY + 22, { size: 13, color: '#a9a3d1', weight: 900 });

      // Display solved words in multi-column list
      const cols = 3;
      const colW = (this.W - 70) / cols;
      let row = 0, col = 0;

      for (let i = 0; i < Math.min(30, currentSolved.length); i++) {
        const w = currentSolved[i];
        const wx = 35 + col * colW;
        const wy = startY + 54 + row * 28;

        c.fillStyle = 'rgba(255,255,255,0.08)';
        U.rr(c, wx, wy - 11, colW - 8, 24, 8);
        c.fill();
        U.text(c, w.toUpperCase(), wx + (colW - 8) / 2, wy + 1, { size: 12, color: '#ffd166', weight: 900 });

        row++;
        if (row >= 11) {
          row = 0;
          col++;
        }
      }
    }

    renderInputTray(c) {
      const y = 490;
      const w = 280, h = 54;
      const x = (this.W - w) / 2;

      c.fillStyle = 'rgba(0,0,0,0.45)';
      U.rr(c, x, y, w, h, 16);
      c.fill();
      c.strokeStyle = this.currentWord.length > 0 ? '#ffd166' : 'rgba(255,255,255,0.15)';
      c.lineWidth = 2;
      c.stroke();

      if (this.currentWord.length > 0) {
        U.text(c, this.currentWord, this.W / 2, y + h / 2, { size: 28, color: '#fff', weight: 900 });
      } else {
        U.text(c, 'TAP LETTERS TO SPELL', this.W / 2, y + h / 2, { size: 13, color: '#7a74a8', weight: 800 });
      }
    }

    renderBankTiles(c) {
      const tileW = 52, tileH = 58, gap = 8;
      const startX = (this.W - (6 * tileW + 5 * gap)) / 2;
      const bankY = 570;

      for (let i = 0; i < 6; i++) {
        const tx = startX + i * (tileW + gap);
        const letter = this.shuffledBank[i];
        const isUsed = this.usedBankIndices.has(i);

        c.save();
        if (!isUsed) {
          c.shadowColor = 'rgba(0,0,0,0.35)';
          c.shadowBlur = 10;
          c.shadowOffsetY = 5;

          const tg = c.createLinearGradient(tx, bankY, tx, bankY + tileH);
          tg.addColorStop(0, '#ffffff');
          tg.addColorStop(1, '#f1f3f5');
          c.fillStyle = tg;
          U.rr(c, tx, bankY, tileW, tileH, 14);
          c.fill();

          U.text(c, letter, tx + tileW / 2, bankY + tileH / 2, { size: 28, color: '#1b1b22', weight: 900, shadow: false });
        } else {
          // Dim placeholder for used tile
          c.fillStyle = 'rgba(255,255,255,0.06)';
          U.rr(c, tx, bankY, tileW, tileH, 14);
          c.fill();
        }
        c.restore();
      }
    }

    renderActionButtons(c) {
      const btnY = 650, btnH = 46;

      // 1. Shuffle
      c.fillStyle = 'rgba(255,255,255,0.12)';
      U.rr(c, 24, btnY, 105, btnH, 14); c.fill();
      U.text(c, '🔀 SHUFFLE', 24 + 105 / 2, btnY + btnH / 2, { size: 13, color: '#fff', weight: 900 });

      // 2. Clear
      c.fillStyle = 'rgba(255,255,255,0.08)';
      U.rr(c, 140, btnY, 95, btnH, 14); c.fill();
      U.text(c, 'CLEAR', 140 + 95 / 2, btnY + btnH / 2, { size: 13, color: '#a9a3d1', weight: 900 });

      // 3. Enter / Submit
      const eg = c.createLinearGradient(245, btnY, 395, btnY + btnH);
      eg.addColorStop(0, '#ffd166');
      eg.addColorStop(1, '#ff9f43');
      c.fillStyle = eg;
      U.rr(c, 245, btnY, 150, btnH, 14); c.fill();
      U.text(c, 'ENTER ↵', 245 + 150 / 2, btnY + btnH / 2, { size: 15, color: '#1b1b22', weight: 900 });
    }
  }

  A.register({
    id: 'anagrams',
    name: 'Anagrams',
    category: 'Word Games',
    tag: '6-Letter Word Solver',
    icon: A.ICONS.anagrams,
    desc: 'Unscramble words from a 6-letter bank in 60 seconds. Find the 6-letter anagram for 2,000 points!',
    rules: [
      'Tap letter tiles or type on your keyboard to spell valid words.',
      'Tap ENTER to submit your word; tap SHUFFLE to rearrange the letter bank.',
      'Scoring: 3 letters = 100, 4 = 400, 5 = 1200, 6 = 2000 points.',
      'Both players duel using the exact same 6-letter puzzle seed. Highest score wins!'
    ],
    create: (stage, opts) => new AnagramsGame(stage, opts)
  });
})(window.Arcade);
