/* Main Application Controller — Lobby, Game Launch, HUD Sync, Overlays & Persistence */
(function (A) {
  const { U, Sound, GAMES, ICONS } = A;

  // DOM Elements
  const $ = id => document.getElementById(id);

  let activeGameInstance = null;
  let activeGameDef = null;
  let selectedCategory = 'All';

  // Player state
  let meName = localStorage.getItem('arcade.name') || 'Thuto';
  let p2Name = 'Player 2';
  let mode = 'cpu';        // 'cpu' | 'local'
  let level = 'medium';    // 'easy' | 'medium' | 'hard'
  let variant = null;

  // Init Lobby
  function initLobby() {
    updateNameDisplay();
    updateSoundBtn();

    // Floating cards in Hero Art
    const heroArt = $('heroArt');
    if (heroArt) {
      const artIcons = [
        { icon: ICONS.pool, bg: '#1b1b22', x: '10%', y: '15%', r: '-12deg', d: '0s' },
        { icon: ICONS.basketball, bg: '#e8590c', x: '55%', y: '10%', r: '14deg', d: '-2s' },
        { icon: ICONS.knockout, bg: '#3d8bff', x: '25%', y: '50%', r: '-6deg', d: '-3.5s' },
        { icon: ICONS.wordhunt, bg: '#ffd166', x: '65%', y: '55%', r: '8deg', d: '-1.5s' }
      ];
      heroArt.innerHTML = artIcons.map(a =>
        `<div class="float" style="left:${a.x};top:${a.y};background:${a.bg};--r:${a.r};animation-delay:${a.d}">${a.icon}</div>`
      ).join('');
    }

    // Category Chips
    const categories = ['All', 'Pool', 'Sports', 'Word Games'];
    const chipsContainer = $('chips');
    chipsContainer.innerHTML = categories.map(cat =>
      `<button class="chip ${cat === selectedCategory ? 'on' : ''}" data-cat="${cat}">${cat}</button>`
    ).join('');

    chipsContainer.querySelectorAll('.chip').forEach(btn => {
      btn.addEventListener('click', () => {
        selectedCategory = btn.dataset.cat;
        chipsContainer.querySelectorAll('.chip').forEach(b => b.classList.toggle('on', b === btn));
        renderGrid();
      });
    });

    renderGrid();
    setupEventListeners();
  }

  function updateNameDisplay() {
    $('meName').textContent = meName;
    $('meAvatar').textContent = meName.charAt(0).toUpperCase();
  }

  function updateSoundBtn() {
    const icon = Sound.muted ? ICONS.mute : ICONS.sound;
    $('soundBtn').innerHTML = icon;
    $('soundBtn2').innerHTML = icon;
  }

  const HighScores = {
    get(gameId) {
      try {
        return parseInt(localStorage.getItem(`arcade.highscore.${gameId}`) || '0', 10);
      } catch (_) { return 0; }
    },
    set(gameId, score) {
      try {
        const cur = this.get(gameId);
        if (score > cur) {
          localStorage.setItem(`arcade.highscore.${gameId}`, score.toString());
          return true;
        }
      } catch (_) {}
      return false;
    }
  };

  // Render Game Cards Grid
  function renderGrid() {
    const grid = $('grid');
    const filtered = selectedCategory === 'All' ? GAMES : GAMES.filter(g => g.category === selectedCategory);

    grid.innerHTML = filtered.map(g => {
      const best = HighScores.get(g.id);
      const bestHtml = best > 0 ? `<span class="tag best-tag">⭐ BEST: ${best}</span>` : '';
      return `
        <article class="card" data-id="${g.id}" tabindex="0">
          <div class="card-art" style="background:${cardGradient(g.id)}">${g.icon}</div>
          <div class="card-body">
            <span class="tag">${g.tag || g.category}</span>
            <h3>${g.name}</h3>
            <p>${g.desc}</p>
            <div class="card-meta">
              <span class="tag">${g.variants ? g.variants.length + ' MODES' : 'CLASSIC'}</span>
              ${bestHtml}
              <div class="play-dot">${ICONS.play}</div>
            </div>
          </div>
        </article>
      `;
    }).join('');

    grid.querySelectorAll('.card').forEach(card => {
      card.addEventListener('click', () => openGameSetup(card.dataset.id));
      card.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openGameSetup(card.dataset.id);
        }
      });
    });
  }

  function cardGradient(id) {
    const grads = {
      '8ball': 'linear-gradient(135deg, #1b1b22, #145a32)',
      '9ball': 'linear-gradient(135deg, #1b1b22, #b58900)',
      pool: 'linear-gradient(135deg, #2b1f4d, #145a32)',
      basketball: 'linear-gradient(135deg, #2b1f4d, #9c4221)',
      cuppong: 'linear-gradient(135deg, #2b1f4d, #a82333)',
      minigolf: 'linear-gradient(135deg, #2b1f4d, #1e7e34)',
      archery: 'linear-gradient(135deg, #2b1f4d, #1f4068)',
      darts: 'linear-gradient(135deg, #2b1f4d, #3d2516)',
      knockout: 'linear-gradient(135deg, #2b1f4d, #104f55)',
      wordhunt: 'linear-gradient(135deg, #2b1f4d, #b58900)',
      anagrams: 'linear-gradient(135deg, #2b1f4d, #7952b3)',
      wordbites: 'linear-gradient(135deg, #2b1f4d, #d9480f)'
    };
    return grads[id] || 'linear-gradient(135deg, #262059, #1d1846)';
  }

  // Game Setup Sheet
  function openGameSetup(gameId) {
    activeGameDef = GAMES.find(g => g.id === gameId);
    if (!activeGameDef) return;

    $('setupIcon').innerHTML = activeGameDef.icon;
    $('setupTitle').textContent = activeGameDef.name;
    $('setupTag').textContent = activeGameDef.desc;

    // Variants (e.g. 8 Ball vs 9 Ball)
    const varField = $('variantField');
    const varSeg = $('variantSeg');
    if (activeGameDef.variants && activeGameDef.variants.length > 1) {
      varField.style.display = 'block';
      variant = activeGameDef.variants[0].id;
      varSeg.innerHTML = activeGameDef.variants.map((v, i) =>
        `<button class="${i === 0 ? 'on' : ''}" data-v="${v.id}">${v.name}</button>`
      ).join('');
      varSeg.querySelectorAll('button').forEach(btn => {
        btn.addEventListener('click', () => {
          variant = btn.dataset.v;
          varSeg.querySelectorAll('button').forEach(b => b.classList.toggle('on', b === btn));
        });
      });
    } else {
      varField.style.display = 'none';
      variant = null;
    }

    // Rules list
    $('setupRules').innerHTML = activeGameDef.rules.map(r => `<li>${r}</li>`).join('');

    // Open overlay
    $('setup').classList.add('open');
  }

  // Launch Game
  function launchGame() {
    $('setup').classList.remove('open');
    $('results').classList.remove('open');

    p2Name = $('p2Name').value.trim() || 'Player 2';

    // Show Game Screen
    $('gameScreen').classList.add('open');
    $('gameScreen').setAttribute('aria-hidden', 'false');

    // Setup Scoreboard Header
    $('pl0').querySelector('.avatar').textContent = meName.charAt(0).toUpperCase();
    $('pl0').querySelector('.pname').textContent = meName;
    $('pl0').querySelector('.pscore').textContent = '0';
    $('pl0').querySelector('.psub').textContent = '';

    const p1Label = mode === 'cpu' ? `CPU (${level.toUpperCase()})` : p2Name;
    $('pl1').querySelector('.avatar').textContent = mode === 'cpu' ? '🤖' : p2Name.charAt(0).toUpperCase();
    $('pl1').querySelector('.pname').textContent = p1Label;
    $('pl1').querySelector('.pscore').textContent = '0';
    $('pl1').querySelector('.psub').textContent = '';

    $('gameName').textContent = activeGameDef.name;
    const curBest = HighScores.get(activeGameDef.id);
    $('gameStatus').textContent = curBest > 0 ? `High Score: ${curBest}` : '';

    // Teardown previous game instance if any
    if (activeGameInstance) {
      activeGameInstance.destroy();
      activeGameInstance = null;
    }

    const stage = $('stage');
    stage.innerHTML = '';

    // Game UI bridge
    const ui = {
      hud: state => {
        if (state.score0 != null) $('pl0').querySelector('.pscore').textContent = state.score0;
        if (state.score1 != null) $('pl1').querySelector('.pscore').textContent = state.score1;
        if (state.p0sub != null) $('pl0').querySelector('.psub').textContent = state.p0sub;
        if (state.p1sub != null) $('pl1').querySelector('.psub').textContent = state.p1sub;
        if (state.status != null) $('gameStatus').textContent = state.status;

        if (state.turn != null) {
          $('pl0').classList.toggle('turn', state.turn === 0);
          $('pl1').classList.toggle('turn', state.turn === 1);

          // Skip button rules:
          // 1. Exclude games like knockout and darts
          // 2. Only show when mode is 'cpu' and it is currently CPU's turn (state.turn === 1)
          // 3. Immediately disappear as soon as CPU's turn ends or human's turn begins
          const noSkipGames = ['knockout', 'darts'];
          const canShowSkip = activeGameDef && !noSkipGames.includes(activeGameDef.id);
          const skipBtn = $('cpuSkipBtn');
          if (skipBtn) {
            skipBtn.style.display = (canShowSkip && mode === 'cpu' && state.turn === 1) ? 'inline-flex' : 'none';
          }
        }
      },
      handoff: (playerIdx, title, text) => {
        return new Promise(resolve => {
          const hAvatar = $('handoffAvatar');
          hAvatar.textContent = playerIdx === 0 ? meName.charAt(0).toUpperCase() : p2Name.charAt(0).toUpperCase();
          hAvatar.className = 'handoff-avatar ' + (playerIdx === 0 ? 'p0' : 'p1');
          $('handoffTitle').textContent = title || `Pass to ${playerIdx === 0 ? meName : p2Name}`;
          $('handoffText').textContent = text || "Don't peek! Tap when you're ready.";
          $('handoff').classList.add('open');

          const onGo = () => {
            $('handoffGo').removeEventListener('click', onGo);
            $('handoff').classList.remove('open');
            resolve();
          };
          $('handoffGo').addEventListener('click', onGo);
        });
      },
      end: result => {
        const skipBtn = $('cpuSkipBtn');
        if (skipBtn) skipBtn.style.display = 'none';

        $('resultTitle').textContent = result.title;
        $('resultText').textContent = result.text;

        const p0Score = $('pl0').querySelector('.pscore').textContent;
        const p1Score = $('pl1').querySelector('.pscore').textContent;

        $('resultScores').innerHTML = `
          <div class="rs ${result.winner === 0 ? 'win' : ''}">
            <span>${meName}</span>
            <b>${p0Score}</b>
            <small>${result.winner === 0 ? 'WINNER 🏆' : ''}</small>
          </div>
          <div class="rs ${result.winner === 1 ? 'win' : ''}">
            <span>${mode === 'cpu' ? 'CPU' : p2Name}</span>
            <b>${p1Score}</b>
            <small>${result.winner === 1 ? 'WINNER 🏆' : ''}</small>
          </div>
        `;

        // Word breakdown display for word games
        const wb = $('wordBreakdown');
        if (result.words) {
          wb.style.display = 'block';
          $('wbTitle0').textContent = `${meName} (${result.words.p0.length})`;
          $('wbTitle1').textContent = `${mode === 'cpu' ? 'CPU' : p2Name} (${result.words.p1.length})`;

          const renderPills = list => list.length
            ? list.map(item => `<span class="wb-tag">${item.word.toUpperCase()} <small>+${item.pts}</small></span>`).join('')
            : '<span class="wb-empty">No words</span>';

          $('wbList0').innerHTML = renderPills(result.words.p0);
          $('wbList1').innerHTML = renderPills(result.words.p1);

          const missedBox = $('wbMissed');
          missedBox.style.display = 'none';
          const revealBtn = $('wbRevealBtn');
          revealBtn.textContent = `Reveal Missed Words 👁️ (${result.words.missed.length})`;

          revealBtn.onclick = () => {
            const isHidden = missedBox.style.display === 'none';
            missedBox.style.display = isHidden ? 'block' : 'none';
            revealBtn.textContent = isHidden ? 'Hide Missed Words 🙈' : `Reveal Missed Words 👁️ (${result.words.missed.length})`;
            if (isHidden) {
              $('wbMissedList').innerHTML = result.words.missed.length
                ? result.words.missed.map(item => `<span class="wb-tag missed">${item.word.toUpperCase()} <small>+${item.pts}</small></span>`).join('')
                : '<span class="wb-empty">None! You found everything!</span>';
            }
          };
        } else {
          wb.style.display = 'none';
        }

        $('trophy').innerHTML = result.winner >= 0 ? ICONS.trophy : ICONS.handshake;

        // High Score Tracking & Display
        const p0Num = parseInt(p0Score, 10) || 0;
        const gid = activeGameDef ? activeGameDef.id : 'game';
        const isNewBest = HighScores.set(gid, p0Num);
        const bestScore = HighScores.get(gid);
        const hsEl = $('resultHighScore');
        if (hsEl) {
          if (isNewBest && p0Num > 0) {
            hsEl.innerHTML = `<span class="new-best-pill">🌟 NEW HIGH SCORE: ${bestScore} 🌟</span>`;
          } else if (bestScore > 0) {
            hsEl.innerHTML = `<span class="best-pill">High Score: <b>${bestScore}</b></span>`;
          } else {
            hsEl.innerHTML = '';
          }
        }

        $('results').classList.add('open');
      }
    };

    // Word games rule: human player ALWAYS plays first so CPU words don't give an unfair advantage!
    const isWordGame = ['wordhunt', 'wordbites', 'anagrams'].includes(activeGameDef.id);
    const firstTurn = isWordGame ? 0 : (mode === 'cpu' ? (Math.random() < 0.5 ? 0 : 1) : 0);

    activeGameInstance = activeGameDef.create(stage, {
      mode,
      level,
      variant,
      firstTurn,
      names: [meName, mode === 'cpu' ? 'CPU' : p2Name],
      ui
    });

    activeGameInstance.start();
  }

  function quitToLobby() {
    if (activeGameInstance) {
      activeGameInstance.destroy();
      activeGameInstance = null;
    }
    renderGrid();
    const skipBtn = $('cpuSkipBtn');
    if (skipBtn) skipBtn.style.display = 'none';
    $('gameScreen').classList.remove('open');
    $('gameScreen').setAttribute('aria-hidden', 'true');
    $('setup').classList.remove('open');
    $('results').classList.remove('open');
    $('help').classList.remove('open');
  }

  // Global Event Listeners
  function setupEventListeners() {
    // Top action buttons
    $('soundBtn').addEventListener('click', () => { Sound.toggle(); updateSoundBtn(); });
    $('soundBtn2').addEventListener('click', () => { Sound.toggle(); updateSoundBtn(); });

    $('nameBtn').addEventListener('click', () => {
      $('nameInput').value = meName;
      $('nameDlg').classList.add('open');
      $('nameInput').focus();
    });

    $('nameSave').addEventListener('click', () => {
      const val = $('nameInput').value.trim();
      if (val) {
        meName = val;
        localStorage.setItem('arcade.name', meName);
        updateNameDisplay();
      }
      $('nameDlg').classList.remove('open');
    });

    $('quickPlay').addEventListener('click', () => {
      const randGame = U.pick(GAMES);
      openGameSetup(randGame.id);
    });

    // Game Setup controls
    $('setupCancel').addEventListener('click', () => $('setup').classList.remove('open'));
    $('setupStart').addEventListener('click', launchGame);

    // Mode Seg (vs CPU vs Pass & Play)
    $('modeSeg').querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        mode = btn.dataset.v;
        $('modeSeg').querySelectorAll('button').forEach(b => b.classList.toggle('on', b === btn));
        $('levelField').style.display = mode === 'cpu' ? 'block' : 'none';
        $('p2Field').style.display = mode === 'local' ? 'block' : 'none';
      });
    });

    // Level Seg (Easy, Medium, Hard)
    $('levelSeg').querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        level = btn.dataset.v;
        $('levelSeg').querySelectorAll('button').forEach(b => b.classList.toggle('on', b === btn));
      });
    });

    // Game bar back button
    $('backBtn').addEventListener('click', quitToLobby);

    // Skip CPU turn button
    $('cpuSkipBtn').addEventListener('click', () => {
      $('cpuSkipBtn').style.display = 'none';
      if (activeGameInstance && typeof activeGameInstance.skipCpu === 'function') {
        activeGameInstance.skipCpu();
      }
    });

    // Help modal
    $('helpBtn').addEventListener('click', () => {
      if (!activeGameDef) return;
      $('helpIcon').innerHTML = activeGameDef.icon;
      $('helpTitle').textContent = activeGameDef.name;
      $('helpRules').innerHTML = activeGameDef.rules.map(r => `<li>${r}</li>`).join('');
      $('help').classList.add('open');
    });

    $('helpClose').addEventListener('click', () => $('help').classList.remove('open'));
    $('helpRestart').addEventListener('click', () => {
      $('help').classList.remove('open');
      launchGame();
    });

    // Results modal buttons
    $('resLobby').addEventListener('click', quitToLobby);
    $('resSettings').addEventListener('click', () => {
      $('results').classList.remove('open');
      openGameSetup(activeGameDef.id);
    });
    $('resRematch').addEventListener('click', launchGame);
  }

  // Start app on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLobby);
  } else {
    initLobby();
  }

})(window.Arcade);
