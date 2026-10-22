/* Word Hunt — GamePigeon style 4x4 grid, 80s countdown, contiguous swipe path & official length scoring! */
(function (A) {
  const { U, Sound, Words } = A;

  // Classic Boggle dice letter distributions for rich, playable boards
  const DICE = [
    'AAEEGN', 'ABBJOO', 'ACHOPS', 'AFFKPS',
    'AOOTTW', 'CIMOTU', 'DEILRX', 'DELRVY',
    'DISTTY', 'EEGHNW', 'EEINSU', 'EHRTVW',
    'EIOSST', 'ELRTTY', 'HIMNUQ', 'HLNNRZ'
  ];

  class WordHuntGame extends A.Game {
    init() {
      this.W = 420;
      this.H = 760;

      this.round = 0; // 0 = p0, 1 = p1
      this.scores = [0, 0];
      this.foundWords = [new Set(), new Set()];
      this.timeLeft = 80.0;
      this.activeRound = false;

      // 4x4 Board layout
      this.gridSize = 4;
      this.tileSize = 68;
      this.tileGap = 10;
      this.boardW = this.gridSize * this.tileSize + (this.gridSize - 1) * this.tileGap;
      this.boardX = (this.W - this.boardW) / 2;
      this.boardY = 240;

      this.boardLetters = this.generateBoard();

      // Swipe path state
      this.path = []; // list of { r, c }
      this.swiping = false;

      // Recent floating word animation
      this.floatingWords = [];

      Words.load().then(() => {
        this.completedRounds = 0;
        const first = (this.opts && this.opts.firstTurn != null) ? this.opts.firstTurn : 0;
        this.startRound(first);
      });
    }

    generateBoard() {
      const shuffledDice = U.shuffle(DICE.slice());
      const letters = [];
      for (let i = 0; i < 16; i++) {
        let die = shuffledDice[i];
        let ch = U.pick(die.split(''));
        if (ch === 'Q') ch = 'Q'; // strictly single letter
        letters.push(ch);
      }
      return letters;
    }

    startRound(playerIdx) {
      this.turn = playerIdx;
      this.round = playerIdx;
      this.timeLeft = 80.0;
      this.activeRound = true;
      this.path = [];
      this.swiping = false;

      // Both players play on the EXACT same board for fair competition!
      this.banner(playerIdx === 0 ? 'START!' : `${this.playerName(playerIdx)}'S TURN!`, { color: '#ffd166', dur: 1.2 });
      Sound.good();

      this.hud({
        score0: this.scores[0],
        score1: this.scores[1],
        p0sub: this.round === 0 ? '80s' : `${this.scores[0]} pts`,
        p1sub: this.round === 1 ? '80s' : `${this.scores[1]} pts`,
        status: `${this.playerName(playerIdx)}: Swipe contiguous letters to form words!`
      });

      if (this.cpuTurn) {
        this.runCpuSolving();
      }
    }

    /* ---------- Input & Swiping ---------- */
    tileAt(x, y) {
      const step = this.tileSize + this.tileGap;
      const snapRadius = this.tileSize * 0.72; // circular center snapping for effortless diagonal swiping

      let bestTile = null;
      let bestDist = snapRadius;

      for (let r = 0; r < this.gridSize; r++) {
        for (let c = 0; c < this.gridSize; c++) {
          const cx = this.boardX + c * step + this.tileSize / 2;
          const cy = this.boardY + r * step + this.tileSize / 2;
          const d = Math.hypot(x - cx, y - cy);
          if (d < bestDist) {
            bestDist = d;
            bestTile = { r, c, idx: r * this.gridSize + c };
          }
        }
      }
      return bestTile;
    }

    onDown(p) {
      if (!this.activeRound || this.cpuTurn) return;
      const tile = this.tileAt(p.x, p.y);
      if (tile) {
        this.swiping = true;
        this.path = [tile];
        Sound.letter(1);
      }
    }

    onMove(p) {
      if (!this.swiping || this.cpuTurn) return;
      const tile = this.tileAt(p.x, p.y);
      if (!tile) return;

      const last = this.path[this.path.length - 1];
      if (last.r === tile.r && last.c === tile.c) return;

      // Check if backtracking to previous tile
      if (this.path.length > 1) {
        const prev = this.path[this.path.length - 2];
        if (prev.r === tile.r && prev.c === tile.c) {
          this.path.pop();
          Sound.tap();
          return;
        }
      }

      // Must be adjacent (orthogonal or diagonal: dr <= 1, dc <= 1)
      const dr = Math.abs(tile.r - last.r);
      const dc = Math.abs(tile.c - last.c);
      const isAdjacent = dr <= 1 && dc <= 1 && (dr + dc > 0);

      // Cannot re-use already visited tile in same word
      const alreadyVisited = this.path.some(t => t.r === tile.r && t.c === tile.c);

      if (isAdjacent && !alreadyVisited) {
        this.path.push(tile);
        Sound.letter(this.path.length);
      }
    }

    onUp() {
      if (!this.swiping || this.cpuTurn) return;
      this.swiping = false;

      if (this.path.length >= 3) {
        const word = this.path.map(t => this.boardLetters[t.idx]).join('').toLowerCase();
        this.submitWord(word);
      }
      this.path = [];
    }

    submitWord(word) {
      const alreadyFound = this.foundWords[this.round].has(word);
      const isValid = Words.isWord(word);

      if (isValid && !alreadyFound) {
        const pts = Words.huntScore(word.length);
        this.scores[this.round] += pts;
        this.foundWords[this.round].add(word);

        Sound.good();
        this.banner(`+${pts} (${word.toUpperCase()})`, { color: '#3ee0b0', dur: 0.9, size: 28 });
        this.fx.burst(this.W / 2, this.boardY - 30, 15, { colors: ['#3ee0b0', '#ffd166'], speed: 120, life: 0.5 });

        this.floatingWords.push({ text: word.toUpperCase(), pts, t: 0, dur: 1.0 });
        this.updateHUD();
      } else if (alreadyFound) {
        Sound.bad();
        this.banner('ALREADY FOUND', { color: '#ff9f43', dur: 0.7, size: 24 });
      } else {
        Sound.bad();
        this.banner('NOT IN WORD LIST', { color: '#ff5d6c', dur: 0.7, size: 24 });
      }
    }

    /* ---------- CPU Word Solving ---------- */
    runCpuSolving() {
      if (!this.activeRound || !this.cpuTurn) return;

      // Find all possible words on this 4x4 grid via DFS
      const allWords = this.solveGrid();
      // Smart human-like word targets per difficulty:
      // Easy: 18-25 words (mostly 3-4 letters)
      // Medium: 32-45 words (solid 4-6 letters)
      // Hard: 55-75 words (pro tournament player prioritizing 6-8 letter words!)
      const skillCount = this.cpuSkill(20, 38, 65);

      // Difficulty sorting: Hard prioritizes longest/highest scoring words first
      const sorted = allWords.slice().sort((a, b) => {
        if (this.level === 'hard') return b.length - a.length || (Math.random() - 0.5);
        if (this.level === 'medium') {
          const scoreDiff = Words.huntScore(b.length) - Words.huntScore(a.length);
          return Math.random() < 0.7 ? scoreDiff : (Math.random() - 0.5);
        }
        return a.length - b.length || (Math.random() - 0.5);
      });
      this._cpuSelectedWords = sorted.slice(0, skillCount);
      this._cpuWordIdx = 0;

      const submitNext = () => {
        if (!this.activeRound || !this.cpuTurn || this._cpuWordIdx >= this._cpuSelectedWords.length) return;
        const w = this._cpuSelectedWords[this._cpuWordIdx++];
        const pts = Words.huntScore(w.length);
        this.scores[1] += pts;
        this.foundWords[1].add(w);

        // Visually animate CPU tracing the word on the 4x4 board
        const path = this.findPathForWord(w);
        if (path) {
          this.path = path;
          this.wait(350, () => { if (this.cpuTurn) this.path = []; });
        }

        Sound.letter(Math.min(6, w.length));
        this.banner(`+${pts} (${w.toUpperCase()})`, { color: '#ff5d6c', dur: 0.8, size: 26 });
        this.floatingWords.push({ text: w.toUpperCase(), pts, t: 0, dur: 1.0 });
        this.updateHUD();

        // Realistic human solving pace:
        // Easy: 2.0s - 2.8s
        // Medium: 1.2s - 1.8s
        // Hard: 0.65s - 1.1s
        const delay = this.cpuSkill(U.rand(2000, 2800), U.rand(1200, 1800), U.rand(650, 1100));
        this.wait(delay, submitNext);
      };

      this.wait(1000, submitNext);
    }

    skipCpu() {
      if (!this.activeRound || !this.cpuTurn) return;
      if (this._cpuSelectedWords) {
        while (this._cpuWordIdx < this._cpuSelectedWords.length) {
          const w = this._cpuSelectedWords[this._cpuWordIdx++];
          const pts = Words.huntScore(w.length);
          this.scores[1] += pts;
          this.foundWords[1].add(w);
        }
      }
      this.timeLeft = 0;
      this.activeRound = false;
      this.updateHUD();
      this.endRound();
    }

    findPathForWord(word) {
      const visited = new Array(16).fill(false);
      const target = word.toLowerCase();

      const dfs = (r, c, charIdx, currentPath) => {
        const idx = r * 4 + c;
        if (this.boardLetters[idx].toLowerCase() !== target[charIdx]) return null;

        visited[idx] = true;
        currentPath.push({ r, c, idx });

        if (charIdx === target.length - 1) {
          visited[idx] = false;
          return currentPath;
        }

        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            const nr = r + dr, nc = c + dc;
            if (nr >= 0 && nr < 4 && nc >= 0 && nc < 4 && !visited[nr * 4 + nc]) {
              const res = dfs(nr, nc, charIdx + 1, currentPath);
              if (res) {
                visited[idx] = false;
                return res;
              }
            }
          }
        }

        visited[idx] = false;
        currentPath.pop();
        return null;
      };

      for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 4; c++) {
          const res = dfs(r, c, 0, []);
          if (res) return res;
        }
      }
      return null;
    }

    solveGrid() {
      const results = new Set();
      const visited = new Array(16).fill(false);

      const dfs = (r, c, current) => {
        const idx = r * 4 + c;
        visited[idx] = true;
        const next = current + this.boardLetters[idx].toLowerCase();

        if (next.length >= 3 && Words.isWord(next)) {
          results.add(next);
        }

        if (Words.hasPrefix(next)) {
          for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
              if (dr === 0 && dc === 0) continue;
              const nr = r + dr, nc = c + dc;
              if (nr >= 0 && nr < 4 && nc >= 0 && nc < 4 && !visited[nr * 4 + nc]) {
                dfs(nr, nc, next);
              }
            }
          }
        }
        visited[idx] = false;
      };

      for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 4; c++) {
          dfs(r, c, '');
        }
      }

      return Array.from(results);
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

      // Update floating words
      for (const f of this.floatingWords) f.t += dt;
      this.floatingWords = this.floatingWords.filter(f => f.t < f.dur);
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
          const allPossible = this.solveGrid();
          const p0List = Array.from(this.foundWords[0]).map(w => ({ word: w, pts: Words.huntScore(w.length) }))
            .sort((a, b) => b.pts - a.pts || a.word.localeCompare(b.word));
          const p1List = Array.from(this.foundWords[1]).map(w => ({ word: w, pts: Words.huntScore(w.length) }))
            .sort((a, b) => b.pts - a.pts || a.word.localeCompare(b.word));
          const missedList = allPossible
            .filter(w => !this.foundWords[0].has(w) && !this.foundWords[1].has(w))
            .map(w => ({ word: w, pts: Words.huntScore(w.length) }))
            .sort((a, b) => b.pts - a.pts || a.word.localeCompare(b.word))
            .slice(0, 50);

          this.finish({
            winner,
            title: winner === -1 ? 'Tie Game!' : `${this.playerName(winner)} wins!`,
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
      // Sleek deep indigo gradient
      const g = c.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#100c2a');
      g.addColorStop(0.5, '#19133e');
      g.addColorStop(1, '#0c0a22');
      c.fillStyle = g;
      c.fillRect(0, 0, w, h);
    }

    render(c) {
      // 1. Top HUD: Timer & Words Found Count
      c.fillStyle = 'rgba(0,0,0,0.4)';
      U.rr(c, this.W / 2 - 80, 20, 160, 42, 21);
      c.fill();
      U.text(c, `⏱ ${Math.ceil(this.timeLeft)}s`, this.W / 2, 41, { size: 20, color: this.timeLeft < 10 ? '#ff5d6c' : '#ffd166', weight: 900 });

      // Active word display being traced
      if (this.path.length > 0) {
        const curWord = this.path.map(t => this.boardLetters[t.idx]).join('');
        c.fillStyle = 'rgba(0,0,0,0.5)';
        U.rr(c, this.W / 2 - 120, 95, 240, 46, 23);
        c.fill();
        c.strokeStyle = '#ffd166';
        c.lineWidth = 2;
        c.stroke();
        U.text(c, curWord, this.W / 2, 118, { size: 24, color: '#fff', weight: 900 });
      } else {
        const count = this.foundWords[this.round].size;
        U.text(c, `${count} WORD${count === 1 ? '' : 'S'} FOUND`, this.W / 2, 118, { size: 14, color: '#a9a3d1', weight: 900 });
      }

      // 2. 4x4 Grid Tiles
      const step = this.tileSize + this.tileGap;
      for (let r = 0; r < 4; r++) {
        for (let col = 0; col < 4; col++) {
          const idx = r * 4 + col;
          const x = this.boardX + col * step;
          const y = this.boardY + r * step;
          const letter = this.boardLetters[idx];
          const isSelected = this.path.some(t => t.r === r && t.c === col);

          c.save();
          c.shadowColor = 'rgba(0,0,0,0.4)';
          c.shadowBlur = 12;
          c.shadowOffsetY = 6;

          // Tile body
          const tileGrad = c.createLinearGradient(x, y, x, y + this.tileSize);
          if (isSelected) {
            tileGrad.addColorStop(0, '#ffd166');
            tileGrad.addColorStop(1, '#ff9f43');
          } else {
            tileGrad.addColorStop(0, '#ffffff');
            tileGrad.addColorStop(1, '#f1f3f5');
          }
          c.fillStyle = tileGrad;
          U.rr(c, x, y, this.tileSize, this.tileSize, 16);
          c.fill();
          c.restore();

          // Letter text
          U.text(c, letter, x + this.tileSize / 2, y + this.tileSize / 2, {
            size: letter.length > 1 ? 26 : 32,
            color: isSelected ? '#1b1b22' : '#2b2a3a',
            weight: 900,
            shadow: false
          });
        }
      }

      // 3. Connective Path Trace Lines
      if (this.path.length > 1) {
        c.save();
        c.strokeStyle = '#ff5d6c';
        c.lineWidth = 7;
        c.lineCap = 'round';
        c.lineJoin = 'round';
        c.beginPath();

        this.path.forEach((t, i) => {
          const tx = this.boardX + t.c * step + this.tileSize / 2;
          const ty = this.boardY + t.r * step + this.tileSize / 2;
          if (i === 0) c.moveTo(tx, ty);
          else c.lineTo(tx, ty);
        });
        c.stroke();
        c.restore();
      }

      // 4. Floating Score Feedback
      for (const f of this.floatingWords) {
        const k = f.t / f.dur;
        const fy = 180 - k * 45;
        const alpha = 1 - k;
        c.save();
        c.globalAlpha = Math.max(0, alpha);
        U.text(c, `${f.text} +${f.pts}`, this.W / 2, fy, { size: 18, color: '#3ee0b0', weight: 900 });
        c.restore();
      }
    }
  }

  A.register({
    id: 'wordhunt',
    name: 'Word Hunt',
    category: 'Word Games',
    tag: '4x4 Boggle Swipe',
    icon: A.ICONS.wordhunt,
    desc: 'Swipe adjacent letters on a 4x4 grid in 80 seconds. Long words award massive bonus points!',
    rules: [
      'Touch and drag across adjacent letters (orthogonal or diagonal) to spell words.',
      'You have 80 seconds on the clock.',
      'Scoring scales exponentially by word length: 3 letters = 100, 4 = 400, 5 = 800, 6 = 1400, 7 = 1800, 8+ = 2200+.',
      'Both players duel on the exact same 4x4 letter board. Highest score wins!'
    ],
    create: (stage, opts) => new WordHuntGame(stage, opts)
  });
})(window.Arcade);
