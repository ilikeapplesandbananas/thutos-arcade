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
      let curX = 22, curY = 480;
      for (const b of list) {
        if (!b.placed) {
          const bw = b.w * this.cellSize + (b.w - 1) * this.cellGap;
          const bh = b.h * this.cellSize + (b.h - 1) * this.cellGap;
          if (curX + bw > this.W - 20) {
            curX = 22;
            curY += 56;
          }
          b.trayX = curX;
          b.trayY = curY;
          b.x = curX;
          b.y = curY;
          curX += bw + 12;
        }
      }
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

      // Find top-most block under touch
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
        // Return to tray
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
      // 1. Scan all horizontal words (left-to-right)
      for (let r = 0; r < this.rows; r++) {
        let current = '';
        for (let c = 0; c < this.cols; c++) {
          const ch = this.grid[r][c];
          if (ch !== null) {
            current += ch;
          } else {
            if (current.length >= 3) this.checkWordMatch(current);
            current = '';
          }
        }
        if (current.length >= 3) this.checkWordMatch(current);
      }

      // 2. Scan all vertical words (top-to-bottom)
      for (let c = 0; c < this.cols; c++) {
        let current = '';
        for (let r = 0; r < this.rows; r++) {
          const ch = this.grid[r][c];
          if (ch !== null) {
            current += ch;
          } else {
            if (current.length >= 3) this.checkWordMatch(current);
            current = '';
          }
        }
        if (current.length >= 3) this.checkWordMatch(current);
      }
    }

    checkWordMatch(word) {
      const w = word.toLowerCase();
      if (!this.foundWords[this.round].has(w) && Words.isWord(w)) {
        const pts = Words.huntScore(w.length);
        this.scores[this.round] += pts;
        this.foundWords[this.round].add(w);

        Sound.good();
        this.banner(`+${pts} (${word})`, { color: '#3ee0b0', dur: 1.0, size: 28 });
        this.fx.burst(this.W / 2, this.gridY + this.gridH / 2, 18, { colors: ['#ffd166', '#3ee0b0'], speed: 140, life: 0.6 });
        this.updateHUD();
      }
    }

    /* ---------- CPU Automation ---------- */
    runCpuSolving() {
      if (!this.activeRound || !this.cpuTurn) return;

      const cpuCount = this.cpuSkill(6, 12, 18);
      let count = 0;

      const makeCpuMove = () => {
        if (!this.activeRound || !this.cpuTurn || count >= cpuCount) return;
        const unplaced = this.blocks.filter(b => !b.placed);
        if (unplaced.length) {
          const b = U.pick(unplaced);
          // Try random grid cells
          for (let attempt = 0; attempt < 25; attempt++) {
            const col = U.randInt(0, this.cols - b.w);
            const row = U.randInt(0, this.rows - b.h);
            if (this.canPlaceBlock(b, col, row)) {
              this.placeBlockOnGrid(b, col, row);
              this.scanGridForWords();
              count++;
              break;
            }
          }
        }
        const delay = this.cpuSkill(U.rand(3200, 4200), U.rand(2400, 3200), U.rand(1600, 2400));
        this.wait(delay, makeCpuMove);
      };

      this.wait(2000, makeCpuMove);
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

          this.finish({
            winner,
            title: winner === -1 ? 'Draw!' : `${this.playerName(winner)} wins!`,
            text: `${this.playerName(0)}: ${s0} pts (${this.foundWords[0].size} words) · ${this.playerName(1)}: ${s1} pts (${this.foundWords[1].size} words)`
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
      U.rr(c, 14, 465, this.W - 28, 260, 20);
      c.fill();
      U.text(c, 'LETTER TRAY · DRAG TO BOARD', this.W / 2, 475, { size: 11, color: '#7a74a8', weight: 900 });

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
