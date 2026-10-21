# 🕹️ Thuto's Arcade

> **A mobile-first browser arcade suite packed with authentic GamePigeon-style party games, real-time physics, and local multiplayer rematches.**

[![Live Demo](https://img.shields.io/badge/demo-online-brightgreen.svg)](https://ilikeapplesandbananas.github.io/thutos-arcade/)
[![JavaScript](https://img.shields.io/badge/JavaScript-Vanilla_ES6-f7df1e.svg)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![CSS](https://img.shields.io/badge/Design-Glassmorphic_Dark-8b5cf6.svg)](css/styles.css)
[![Zero Dependencies](https://img.shields.io/badge/Dependencies-Zero_CDN-3ee0b0.svg)](index.html)

---

## 🌟 Overview

**Thuto's Arcade** is an authentic browser recreation of the iconic turn-based party game classics from iMessage (GamePigeon). Built from the ground up with high-performance Canvas 2D graphics, fixed-timestep physics, synthesized Web Audio, and zero external blocking dependencies, every game launches instantly and plays without freezing or frame drops.

Challenge a smart CPU across three difficulty tiers (**Easy**, **Medium**, **Hard**) or pass your device to a friend for head-to-head **Pass & Play** rematches.

---

## 🎮 The Game Roster & Authentic Mechanics

The arcade features **10 complete party games** faithfully simulating the controls, physics, and rules of GamePigeon:

| Game | Category | Engine & Simulation | Authentic GamePigeon Rules & Mechanics |
| :--- | :--- | :--- | :--- |
| 🎱 **8 Ball / 9 Ball** | Pool | Sub-stepped 2D Physics | Ghost-ball aiming line showing projected path into pockets; left vertical power slider; scratch ball-in-hand placement; solid vs stripe group claims; legal contact rules. |
| 🏀 **Basketball** | Sports | Parabolic Arc + Depth | 30-second countdown clock; swipe/flick to shoot; rim and backboard banking physics; net swish animation; **ON FIRE** streak (2X points after 3 in a row); moving hoop after 10 points! |
| 🍺 **Cup Pong** | Sports | Trajectory Simulation | 10 red Solo cups arranged in a triangle on a long wooden beer pong table; 2 shots per turn; direct swishes or table bounce ricochets; water splash FX; re-rack options at 6, 4, 3, or 2 cups. |
| ⛳ **Mini Golf** | Sports | Vector Physics | 3-hole course with bank walls, bouncy orange bumpers, sand traps (heavy deceleration), and water hazards (+1 penalty stroke & reset); drag-back aim guideline; par scoring. |
| 🏹 **Archery** | Sports | Wind Deflection Physics | 3 distance rounds (50ft, 70ft, 90ft) with distance multipliers; dynamic wind meter (direction & magnitude); touch-to-draw bowstring with sight sway; 10-ring scoring. |
| 🎯 **Darts (301)** | Sports | Pub Dartboard Sectors | Classic 301 rules; touch-and-hold aiming crosshair; swipe throw; 3 darts per turn; Singles, Doubles (2x), Triples (3x), Outer Bull (25), Inner Bull (50); **Bust rule** on dropping below 0. |
| 🐧 **Knockout** | Sports / Battle | Ice Friction Collisions | 4 penguins per team on a circular iceberg; slingshot drag-back aiming with power arrow; low-friction ice sliding; elastic circle collisions; **shrinking ice** each round; water knockoffs. |
| 🔍 **Word Hunt** | Word Games | 4×4 Boggle Graph Traversal | 80-second countdown timer; touch-and-drag contiguous path across adjacent letter tiles; exponential length scoring (3: 100, 4: 400, 5: 800, 6: 1400, 7: 1800, 8+: 2200+); ENABLE dictionary validation. |
| 🔠 **Anagrams** | Word Games | 6-Letter Lexicon Solver | 60-second countdown timer; 6 scrambled letter tiles in a bottom tray; grouped word slots (3, 4, 5, 6 letters); keyboard typing support; shuffle button; 2,000 pts for the 6-letter anagram! |
| 🧩 **Word Bites** | Word Games | 8×9 Crossword Grid | 80-second countdown timer; 8×9 crossword grid; tray with singles and fixed 2-letter blocks (horizontal and vertical); words formed across and down; prefix/suffix extensions. |

---

## ✨ Design & Architecture Highlights

- **⚡ Freeze-Free Architecture**:
  - Independent capped fixed-timestep game engine with managed timers and complete resource teardown on screen switch.
  - No blocking CDN modules (`three.js`, `cannon.js`, `matter.js` removed in favor of lightweight, deterministic canvas physics).
- **🎨 Glassmorphic Cyberpunk UI**:
  - Deep indigo color palette (`#0d0b22`) with neon accents (`#ffd166`, `#ff5d8f`, `#3ee0b0`, `#4cc9f0`).
  - Animated hero floating cards, category filters, and responsive mobile layout.
  - Live Scoreboard Header with active player turn glow, scores, sub-stats, rules help modal, and audio mute toggle.
  - Turn handoff privacy screen ("Pass to Player 2 — Don't peek!").
- **🔊 Web Audio SFX**:
  - Synthesized sound effects without external audio files (ball clacks, cue hits, rim bounces, swishes, splashes, arrow thunks, and victory chimes).
- **📚 Integrated English Lexicon**:
  - Embedded 125,000+ word ENABLE dictionary with prefix indexing for instant word lookup without API latency.

---

## 🚀 How to Run Locally

### Direct Browser Launch
Open [`index.html`](index.html) directly in any modern browser:
```powershell
Start-Process index.html
```

### Local Web Server
```bash
# Using Node:
npx serve .

# Using Python:
python -m http.server 8080
```
Then navigate to **`http://localhost:8080`**.

---

## 🌐 GitHub Pages Deployment

The repository is hosted live on GitHub Pages:
**[https://ilikeapplesandbananas.github.io/thutos-arcade/](https://ilikeapplesandbananas.github.io/thutos-arcade/)**

---

## 📜 Credits & License

- **Author**: Thuto ([@ilikeapplesandbananas](https://github.com/ilikeapplesandbananas))
- **Word Data**: ENABLE (Public Domain) & Google 10,000 English (MIT)
- **License**: MIT

<p align="center">Made with ❤️ by Thuto • Ready for the rematch!</p>