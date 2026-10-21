/* Word Bites — GamePigeon style 8x9 grid, 2-letter horizontal & vertical fixed blocks + singles, 80s clock! */
(function (A) {
  const { U, Sound, Words } = A;

  class WordBitesGame extends A.Game {
    init() {
      this.W = 420;
      this.H = 760;

      this.round = 0;
      this.scores = [0, 0];
      this.foundWords = [new Set(), new Set()];
      this.timeLeft = 80.0;
      this.activeRound = false;

      // 8 columns x 9 rows grid
      this.cols = 8;
      this.rows = 9;
      this.cellSize = 38;
      this.cellGap = 3;
      this.gridW = this.cols * this.cellSize + (this.cols - 1) * this.cellGap;
      this.gridH = this.rows * this.cellSize + (this.rows - 1) * this.cellGap;
      this.gridX = (this.W - this.gridW) / 2;
      this.gridY = 85;

      // Grid letter contents [r][c]
      this.grid = Array.from({ length: this.rows }, () => new Array(this.cols).fill(null));

      // Letter pieces in player tray: singles, 2-letter horizontal, 2-letter vertical
      this.blocks = this.generateBlocks();
      this.draggingBlock = null;
      this.dragOffset = { x: 0, y: 0 };

      Words.load().then(() => {
        this.startRound(0);
      });
    }

    generateBlocks() {
      // GamePigeon Word Bites block pool: balanced vowels and common consonants + double blocks
      const doubleH = ['TH', 'IN', 'ER', 'AN', 'RE', 'ON', 'AT', 'EN', 'ED'];
      const doubleV = ['ST', 'HE', 'ND', 'OR', 'ES', 'TE', 'IS', 'AR', 'NT'];
      const singles = 'AAABCDEEEFGHIIJKLMNOOOPQRSTUUUVWXYZ'.split('');

      const list = [];
      let id = 0;

      // 3 horizontal pairs
      for (let i = 0; i < 3; i++) {
        const pair = U.pick(doubleH);
        list.push({ id: id++, letters: pair.split(''), orientation: 'H', w: 2, h: 1, placed: false, gridC: -1, gridR: -1 });
      }
      // 3 vertical pairs
      for (let i = 0; i < 3; i++) {
        const pair = U.pick(doubleV);
        list.push({ id: id++, letters: pair.split(''), orientation: 'V', w: 1, h: 2, placed: false, gridC: -1, gridR: -1 });
      }
      // 8 singles
      for (let i = 0; i < 8; i++) {
        const ch = U.pick(singles);
        list.push({ id: id++, letters: [ch], orientation: 'S', w: 1, h: 1, placed: false, gridC: -1, gridR: -1 });
      }

      // Arrange initially in bottom tray (y: 470)
      this.layoutTray(list);
      return list;
    }

    layoutTray(list) {
      const hPairs = list.filter(b => b.orientation === 'H');
      const vPairs = list.filter(b => b.orientation === 'V');
      const singles = list.filter(b => b.orientation === 'S');

      // Row 1: Horizontal pairs (3 blocks: 79x38px each)
      const hXs = [36, 170, 304];
      const hY = 492;
      hPairs.forEach((b, i) => {
        b.trayX = hXs[i] !== undefined ? hXs[i] : 36;
        b.trayY = hY;
        if (!b.placed) { b.x = b.trayX; b.y = b.trayY; }
      });

      // Row 2: Vertical pairs (3 blocks: 38x79px each)
      const vXs = [75, 191, 307];
      const vY = 544;
      vPairs.forEach((b, i) => {
        b.trayX = vXs[i] !== undefined ? vXs[i] : 75;
        b.trayY = vY;
        if (!b.placed) { b.x = b.trayX; b.y = b.trayY; }
      });

      // Row 3 & 4: Singles (8 blocks: 38x38px each, 4 per row)
      const sXs = [45, 129, 213, 297];
      const sY1 = 638;
      const sY2 = 688;
      singles.forEach((b, i) => {
        b.trayX = sXs[i % 4];
        b.trayY = i < 4 ? sY1 : sY2;
        if (!b.placed) { b.x = b.trayX; b.y = b.trayY; }
      });
    }

    startRound(playerIdx) {
      this.turn = playerIdx;
      this.round = playerIdx;
      this.timeLeft = 80.0;
      this.activeRound = true;

      // Reset grid
      this.grid = Array.from({ length: this.rows }, () => new Array(this.cols).fill(null));
      for (const b of this.blocks) {
        b.placed = false;
        b.gridC = -1;
        b.gridR = -1;
      }
      this.layoutTray(this.blocks);

      this.banner(playerIdx === 0 ? 'START!' : `${this.playerName(playerIdx)}'S TURN!`, { color: '#ffd166', dur: 1.2 });
      Sound.good();

      this.hud({
        score0: this.scores[0],
        score1: this.scores[1],
        p0sub: this.round === 0 ? '80s' : `${this.scores[0]} pts`,
        p1sub: this.round === 1 ? '80s' : `${this.scores[1]} pts`,
        status: `${this.playerName(playerIdx)}: Drag blocks to form crossword words!`
      });

      if (this.cpuTurn) {
        this.runCpuSolving();
      }
    }

    /* ---------- Input & Dragging ---------- */
    onDown(p) {
      if (!this.activeRound || this.cpuTurn) return;

      // 1. Check Recall All Button
      if (p.x >= this.W - 130 && p.x <= this.W - 10 && p.y >= 465 && p.y <= 495) {
        let recalled = 0;
        for (const b of this.blocks) {
          if (b.placed) {
            this.removeBlockFromGrid(b);
            b.x = b.trayX;
            b.y = b.trayY;
            recalled++;
          }
        }
        if (recalled > 0) {
          Sound.click();
          this.scanGridForWords();
        }
        return;
      }

      // 2. Find top-most block under touch
      for (let i = this.blocks.length - 1; i >= 0; i--) {
        const b = this.blocks[i];
        const bw = b.w * this.cellSize + (b.w - 1) * this.cellGap;
        const bh = b.h * this.cellSize + (b.h - 1) * this.cellGap;

        if (p.x >= b.x && p.x <= b.x + bw && p.y >= b.y && p.y <= b.y + bh) {
          this.draggingBlock = b;
          this.dragOffset = { x: p.x - b.x, y: p.y - b.y };

          // If was on grid, remove from grid matrix
          if (b.placed) {
            this.removeBlockFromGrid(b);
          }
          Sound.tap();
          break;
        }
      }
    }

    onMove(p) {
      if (!this.draggingBlock || this.cpuTurn) return;
      this.draggingBlock.x = p.x - this.dragOffset.x;
      this.draggingBlock.y = p.y - this.dragOffset.y;
    }

    onUp() {
      if (!this.draggingBlock || this.cpuTurn) return;
      const b = this.draggingBlock;
      this.draggingBlock = null;

      // Check if dropped over grid
      const step = this.cellSize + this.cellGap;
      const col = Math.round((b.x - this.gridX) / step);
      const row = Math.round((b.y - this.gridY) / step);

      if (this.canPlaceBlock(b, col, row)) {
        this.placeBlockOnGrid(b, col, row);
        Sound.tap();
        this.scanGridForWords();
      } else {
        // Return to designated tray slot
        b.placed = false;
        b.x = b.trayX;
        b.y = b.trayY;
        Sound.click();
      }
    }

    canPlaceBlock(b, col, row) {
      if (col < 0 || row < 0 || col + b.w > this.cols || row + b.h > this.rows) return false;

      // Check for overlap with other blocks on grid
      for (let r = 0; r < b.h; r++) {
        for (let c = 0; c < b.w; c++) {
          if (this.grid[row + r][col + c] !== null) return false;
        }
      }
      return true;
    }

    placeBlockOnGrid(b, col, row) {
      b.placed = true;
      b.gridC = col;
      b.gridR = row;
      const step = this.cellSize + this.cellGap;
      b.x = this.gridX + col * step;
      b.y = this.gridY + row * step;

      let idx = 0;
      for (let r = 0; r < b.h; r++) {
        for (let c = 0; c < b.w; c++) {
          this.grid[row + r][col + c] = b.letters[idx++];
        }
      }
    }

    removeBlockFromGrid(b) {
      b.placed = false;
      for (let r = 0; r < b.h; r++) {
        for (let c = 0; c < b.w; c++) {
          this.grid[b.gridR + r][b.gridC + c] = null;
        }
      }
      b.gridC = -1;
      b.gridR = -1;
    }

    /* ---------- Crossword Word Scanning ---------- */
    scanGridForWords() {
      // 1. Scan all horizontal words (left-to-right, minLen = 2)
      for (let r = 0; r < this.rows; r++) {
        let current = '';
        for (let c = 0; c < this.cols; c++) {
          const ch = this.grid[r][c];
          if (ch !== null) {
            current += ch;
          } else {
            if (current.length >= 2) this.checkWordMatch(current);
            current = '';
          }
        }
        if (current.length >= 2) this.checkWordMatch(current);
      }

      // 2. Scan all vertical words (top-to-bottom, minLen = 2)
      for (let c = 0; c < this.cols; c++) {
        let current = '';
        for (let r = 0; r < this.rows; r++) {
          const ch = this.grid[r][c];
          if (ch !== null) {
            current += ch;
          } else {
            if (current.length >= 2) this.checkWordMatch(current);
            current = '';
          }
        }
        if (current.length >= 2) this.checkWordMatch(current);
      }
    }

    checkWordMatch(word) {
      const w = word.toLowerCase();
      if (!this.foundWords[this.round].has(w) && Words.isWord(w, 2)) {
        const pts = Words.huntScore(w.length);
        this.scores[this.round] += pts;
        this.foundWords[this.round].add(w);

        Sound.good();
        this.banner(`+${pts} (${word.toUpperCase()})`, { color: '#3ee0b0', dur: 1.0, size: 28 });
        this.fx.burst(this.W / 2, this.gridY + this.gridH / 2, 18, { colors: ['#ffd166', '#3ee0b0'], speed: 140, life: 0.6 });
        this.updateHUD();
      }
    }

    /* ---------- Candidate Formations for CPU ---------- */
    findWordFormations() {
      const hPool = [...this.blocks.filter(b => b.orientation === 'H'), ...this.blocks.filter(b => b.orientation === 'S')];
      const vPool = [...this.blocks.filter(b => b.orientation === 'V'), ...this.blocks.filter(b => b.orientation === 'S')];

      const formations = [];
      const usedH = new Set();
      const usedV = new Set();

      const searchH = (prefix, blockList) => {
        if (prefix.length >= 2 && Words.isWord(prefix, 2)) {
          formations.push({ word: prefix, blocks: [...blockList], orientation: 'H' });
        }
        if (prefix.length >= 6) return;

        for (let i = 0; i < hPool.length; i++) {
          if (!usedH.has(i)) {
            const b = hPool[i];
            const nextStr = prefix + b.letters.join('').toLowerCase();
            if (Words.hasPrefix(nextStr)) {
              usedH.add(i);
              blockList.push(b);
              searchH(nextStr, blockList);
              blockList.pop();
              usedH.delete(i);
            }
          }
        }
      };

      const searchV = (prefix, blockList) => {
        if (prefix.length >= 2 && Words.isWord(prefix, 2)) {
          formations.push({ word: prefix, blocks: [...blockList], orientation: 'V' });
        }
        if (prefix.length >= 6) return;

        for (let i = 0; i < vPool.length; i++) {
          if (!usedV.has(i)) {
            const b = vPool[i];
            const nextStr = prefix + b.letters.join('').toLowerCase();
            if (Words.hasPrefix(nextStr)) {
              usedV.add(i);
              blockList.push(b);
              searchV(nextStr, blockList);
              blockList.pop();
              usedV.delete(i);
            }
          }
        }
      };

      searchH('', []);
      searchV('', []);

      return formations;
    }

    /* ---------- Intelligent CPU Solving ---------- */
    runCpuSolving() {
      if (!this.activeRound || !this.cpuTurn) return;

      const allFormations = this.findWordFormations();
      // Difficulty calibration:
      // Easy: 5-7 simple 2-3 letter words
      // Medium: 9-13 words (3-5 letters)
      // Hard: 15-20 words (up to 6 letters)
      const targetCount = this.cpuSkill(6, 11, 18);
      const minWordLen = this.cpuSkill(2, 3, 3);
      const maxWordLen = this.cpuSkill(4, 5, 6);

      const filtered = allFormations.filter(f => f.word.length >= minWordLen && f.word.length <= maxWordLen);
      const sorted = U.shuffle(filtered).sort((a, b) => {
        return this.diff === 'hard' ? b.word.length - a.word.length : a.word.length - b.word.length;
      });

      let placedCount = 0;

      const makeCpuMove = () => {
        if (!this.activeRound || !this.cpuTurn || placedCount >= targetCount) return;

        // Find a formation whose blocks are currently unplaced
        for (const f of sorted) {
          const allFree = f.blocks.every(b => !b.placed);
          if (!allFree) continue;

          let success = false;
          if (f.orientation === 'H') {
            const totalW = f.blocks.reduce((acc, b) => acc + b.w, 0);
            for (let r = 0; r < this.rows && !success; r++) {
              for (let col = 0; col <= this.cols - totalW && !success; col++) {
                // Check if all cells empty
                let canFit = true;
                for (let i = 0; i < totalW; i++) {
                  if (this.grid[r][col + i] !== null) { canFit = false; break; }
                }
                if (canFit) {
                  let curC = col;
                  for (const b of f.blocks) {
                    this.placeBlockOnGrid(b, curC, r);
                    curC += b.w;
                  }
                  success = true;
                }
              }
            }
          } else {
            const totalH = f.blocks.reduce((acc, b) => acc + b.h, 0);
            for (let col = 0; col < this.cols && !success; col++) {
              for (let r = 0; r <= this.rows - totalH && !success; r++) {
                let canFit = true;
                for (let i = 0; i < totalH; i++) {
                  if (this.grid[r + i][col] !== null) { canFit = false; break; }
                }
                if (canFit) {
                  let curR = r;
                  for (const b of f.blocks) {
                    this.placeBlockOnGrid(b, col, curR);
                    curR += b.h;
                  }
                  success = true;
                }
              }
            }
          }

          if (success) {
            placedCount++;
            Sound.tap();
            this.scanGridForWords();
            break;
          }
        }

        // Delay between moves: Easy ~3.6s, Medium ~2.6s, Hard ~1.6s
        const delay = this.cpuSkill(U.rand(3400, 4400), U.rand(2400, 3200), U.rand(1500, 2200));
        this.wait(delay, makeCpuMove);
      };

      this.wait(1400, makeCpuMove);
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
        if (this.round === 0) {
          if (this.mode === 'local') {
            this.handoff(1, `Pass to ${this.playerName(1)}`, `Same block tray! ${this.playerName(0)} scored ${this.scores[0]} pts. Beat it!`)
              .then(() => this.startRound(1));
          } else {
            this.startRound(1);
          }
        } else {
          // Resolve match
          const s0 = this.scores[0];
          const s1 = this.scores[1];
          const winner = s0 > s1 ? 0 : s1 > s0 ? 1 : -1;

          // Word breakdown data
          const allFormations = this.findWordFormations();
          const p0List = Array.from(this.foundWords[0]).map(w => ({ word: w, pts: Words.bitesScore(w.length) }))
            .sort((a, b) => b.pts - a.pts || a.word.localeCompare(b.word));
          const p1List = Array.from(this.foundWords[1]).map(w => ({ word: w, pts: Words.bitesScore(w.length) }))
            .sort((a, b) => b.pts - a.pts || a.word.localeCompare(b.word));

          const uniquePossible = Array.from(new Set(allFormations.map(f => f.word)));
          const missedList = uniquePossible
            .filter(w => !this.foundWords[0].has(w) && !this.foundWords[1].has(w))
            .map(w => ({ word: w, pts: Words.bitesScore(w.length) }))
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
      g.addColorStop(0, '#100c28');
      g.addColorStop(0.5, '#18123c');
      g.addColorStop(1, '#0c0920');
      c.fillStyle = g;
      c.fillRect(0, 0, w, h);
    }

    render(c) {
      // 1. Clock & Score Header
      c.fillStyle = 'rgba(0,0,0,0.35)';
      U.rr(c, this.W / 2 - 75, 20, 150, 40, 20);
      c.fill();
      U.text(c, `⏱ ${Math.ceil(this.timeLeft)}s`, this.W / 2, 40, { size: 20, color: this.timeLeft < 10 ? '#ff5d6c' : '#ffd166', weight: 900 });

      // 2. 8x9 Grid Board
      c.save();
      c.shadowColor = 'rgba(0,0,0,0.45)';
      c.shadowBlur = 20;
      c.shadowOffsetY = 10;

      c.fillStyle = 'rgba(0,0,0,0.3)';
      U.rr(c, this.gridX - 8, this.gridY - 8, this.gridW + 16, this.gridH + 16, 18);
      c.fill();
      c.restore();

      const step = this.cellSize + this.cellGap;
      for (let r = 0; r < this.rows; r++) {
        for (let col = 0; col < this.cols; col++) {
          const cx = this.gridX + col * step;
          const cy = this.gridY + r * step;

          c.fillStyle = 'rgba(255,255,255,0.06)';
          U.rr(c, cx, cy, this.cellSize, this.cellSize, 8);
          c.fill();
        }
      }

      // 3. Tray Area Background Divider
      c.fillStyle = 'rgba(255,255,255,0.05)';
      U.rr(c, 14, 462, this.W - 28, 280, 20);
      c.fill();
      U.text(c, 'LETTER TRAY · DRAG TO BOARD', 130, 480, { size: 10, color: '#8882b5', weight: 800 });

      // Recall button
      c.fillStyle = 'rgba(255,255,255,0.12)';
      U.rr(c, this.W - 124, 468, 102, 24, 12);
      c.fill();
      U.text(c, 'RECALL ALL ↺', this.W - 73, 480, { size: 10, color: '#ffd166', weight: 900 });

      // Ghost slot guides showing neat organizer arrangement
      for (const b of this.blocks) {
        const bw = b.w * this.cellSize + (b.w - 1) * this.cellGap;
        const bh = b.h * this.cellSize + (b.h - 1) * this.cellGap;
        c.strokeStyle = 'rgba(255,255,255,0.08)';
        c.lineWidth = 1.5;
        U.rr(c, b.trayX, b.trayY, bw, bh, 8);
        c.stroke();
      }

      // 4. Letter Blocks (rendered in tray and on grid)
      for (const b of this.blocks) {
        if (b !== this.draggingBlock) this.renderBlock(c, b);
      }

      // 5. Active dragging block (rendered on top with elevated shadow)
      if (this.draggingBlock) {
        this.renderBlock(c, this.draggingBlock, true);
      }
    }

    renderBlock(c, b, isElevated = false) {
      const bw = b.w * this.cellSize + (b.w - 1) * this.cellGap;
      const bh = b.h * this.cellSize + (b.h - 1) * this.cellGap;

      c.save();
      if (isElevated) {
        c.shadowColor = 'rgba(0,0,0,0.55)';
        c.shadowBlur = 24;
        c.shadowOffsetY = 14;
      } else {
        c.shadowColor = 'rgba(0,0,0,0.25)';
        c.shadowBlur = 8;
        c.shadowOffsetY = 4;
      }

      // Block body color: 2-letter blocks get golden amber, singles get ivory
      const bg = c.createLinearGradient(b.x, b.y, b.x, b.y + bh);
      if (b.orientation === 'S') {
        bg.addColorStop(0, '#ffffff');
        bg.addColorStop(1, '#f1f3f5');
      } else {
        bg.addColorStop(0, '#ffd166');
        bg.addColorStop(1, '#ff9f43');
      }
      c.fillStyle = bg;
      U.rr(c, b.x, b.y, bw, bh, 10);
      c.fill();

      // Letters on block
      const step = this.cellSize + this.cellGap;
      let idx = 0;
      for (let r = 0; r < b.h; r++) {
        for (let col = 0; col < b.w; col++) {
          const lx = b.x + col * step + this.cellSize / 2;
          const ly = b.y + r * step + this.cellSize / 2;
          U.text(c, b.letters[idx++], lx, ly, {
            size: 20,
            color: b.orientation === 'S' ? '#1b1b22' : '#2b1a0e',
            weight: 900,
            shadow: false
          });
        }
      }
      c.restore();
    }
  }

  A.register({
    id: 'wordbites',
    name: 'Word Bites',
    category: 'Word Games',
    tag: '8x9 Crossword Grid',
    icon: A.ICONS.wordbites,
    desc: 'Drag single tiles and fixed 2-letter blocks onto an 8x9 grid in 80 seconds. Form interlocking crossword words!',
    rules: [
      'Drag letter blocks from your bottom tray onto the 8x9 grid.',
      'Blocks include single letters and fixed 2-letter pairs (horizontal and vertical). Pairs cannot be rotated!',
      'Form words reading across (left-to-right) or down (top-to-bottom).',
      'Append prefixes and suffixes to existing words to extend length and multiply your score.',
      '80 seconds on the clock. Highest crossword score wins!'
    ],
    create: (stage, opts) => new WordBitesGame(stage, opts)
  });
})(window.Arcade);
