# 🕹️ Thuto's Arcade

> **A mobile-first browser arcade suite packed with fast-paced party games, real-time physics, and local multiplayer rematches.**

[![Live Demo](https://img.shields.io/badge/demo-online-brightgreen.svg)](https://ilikeapplesandbananas.github.io/thutos-arcade/)
[![JavaScript](https://img.shields.io/badge/JavaScript-ES_Modules-f7df1e.svg)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![Three.js](https://img.shields.io/badge/3D_Engine-Three.js-black.svg)](https://threejs.org/)
[![Matter.js](https://img.shields.io/badge/2D_Physics-Matter.js-4b8bbe.svg)](https://brm.io/matter-js/)
[![Cannon-es](https://img.shields.io/badge/3D_Physics-Cannon--es-ff69b4.svg)](https://pmndrs.github.io/cannon-es/)

---

## 🌟 Overview

**Thuto's Arcade** is an all-in-one web game platform inspired by turn-based party game classics (such as GamePigeon). Crafted as a high-performance single-page application, it delivers instant, responsive gameplay across both desktop and mobile devices without requiring any installation or app store downloads.

Whether you are challenging a smart CPU with selectable difficulty levels or passing the device to a friend for an intense 2-player duel, every game is built with fine-tuned controls, dynamic canvas animations, and interactive feedback.

---

## 🎮 The Game Roster

The arcade features **10 distinct mini-games** spanning pool, sports, physics battles, and word puzzles:

| Game | Category | Engine / Tech | Gameplay Description |
| :--- | :--- | :--- | :--- |
| 🎱 **8 Ball / 9 Ball** | Pool | 2D Canvas & Physics | Realistic cue-ball billiards. Call solids or stripes, control shot power and angles, and pocket balls to close the table. |
| 🏀 **Basketball** | Sports | Real-time Physics | Swipe to arc your shots cleanly through the rim or bank them off the backboard. |
| 🍺 **Cup Pong** | Sports | 3D / Cannon-es | Precision trajectory aiming to bounce table tennis balls directly into cup formations. |
| ⛳ **Mini Golf** | Sports | Canvas Vector Physics | Read tricky sloped greens, calculate banking angles, and sink your putts under par. |
| 🏹 **Archery** | Sports | Wind & Sway Physics | Compensate for dynamic crosswinds and sight sway to hit dead-center bullseyes. |
| 🎯 **Darts** | Sports | Precision Trajectory | Play classic 301 rules. Land high-value triples and finish the game on a double ring. |
| 🐧 **Knockout** | Sports / Battle | Matter.js Physics | Slingshot your penguin squad across an icy arena to knock your opponent’s pieces off the board. |
| 🔍 **Word Hunt** | Word Games | Grid Graph Traversal | Trace contiguous letter paths across a 4×4 grid to discover valid words before time expires. |
| 🔠 **Anagrams** | Word Games | SCOWL Lexicon | Unscramble letters from a 6-letter bank to unlock as many dictionary words as possible. |
| 🧩 **Word Bites** | Word Games | Block Physics & Lexicon | Slide and arrange segmented letter tiles horizontally and vertically to form crossword combinations. |

---

## ✨ Key Features

- **🤖 Smart AI & Local 2-Player**:
  - Play solo against an AI CPU across three difficulty tiers (**Normal**, **Medium**, **Hard**).
  - Switch to **Local 2-Player (Pass & Play)** mode for live head-to-head showdowns.
- **⚡ Physics & 3D Integration**:
  - 2D rigid-body simulation via [Matter.js](https://brm.io/matter-js/).
  - 3D rendering and volumetric collision detection via [Three.js](https://threejs.org/) & [Cannon-es](https://pmndrs.github.io/cannon-es/).
- **📚 Authentic Word Validation**:
  - Full dictionary checking powered by the Kevin Atkinson **SCOWL** wordlist.
- **🔊 Web Audio FX**:
  - Built-in synthesized sound effects for ball collisions, countdown timers, swishes, and victory chimes (toggleable with one click).
- **📱 Responsive & Touch-Optimized**:
  - Fluid mobile drag, pull-back aiming, and gesture controls tailored for touchscreens and mouse input alike.
- **🎨 Glassmorphic Cyberpunk UI**:
  - Sleek modern arcade aesthetics with glowing neon accents, avatar selection, live player statistics, and responsive modal viewports.

---

## 🚀 Quick Start / How to Run

### Method 1: Direct Browser Launch
Simply double-click [`index.html`](index.html) or open it directly in Google Chrome, Brave, Firefox, Edge, or Safari:
```bash
# On Windows PowerShell:
Start-Process index.html
```

### Method 2: Local HTTP Server (Recommended)
Running a local web server ensures seamless loading of CDN ES modules and cross-origin assets:

```bash
# Using Python:
python -m http.server 8080

# Using Node / npx:
npx serve .
```
Then visit **`http://localhost:8080`** in your browser.

---

## 🌐 Deploy to GitHub Pages

You can host **Thuto's Arcade** for free on GitHub Pages:
1. Go to your repository on GitHub: `https://github.com/ilikeapplesandbananas/thutos-arcade`
2. Navigate to **Settings** > **Pages**.
3. Under **Build and deployment** > **Source**, select `Deploy from a branch`.
4. Choose the `main` branch and `/ (root)` folder, then click **Save**.
5. Your arcade will be live at `https://ilikeapplesandbananas.github.io/thutos-arcade/`!

---

## 🛠️ Tech Stack

- **Frontend**: HTML5, Modern Vanilla CSS, ES Modules JavaScript
- **3D Graphics**: [Three.js](https://threejs.org/)
- **3D Physics**: [Cannon-es](https://github.com/pmndrs/cannon-es)
- **2D Physics**: [Matter.js](https://brm.io/matter-js/)
- **Audio**: Web Audio API (Synthesized SFX)
- **Word Data**: SCOWL (Spell Checking Oriented Word Lists)

---

## 📜 Credits & Acknowledgements

- **Author**: Thuto ([@ilikeapplesandbananas](https://github.com/ilikeapplesandbananas))
- **Wordlist**: Kevin Atkinson’s [SCOWL](https://github.com/BartMassey/wordlists/blob/main/README-scowl-60.txt) (2000–2019)
- Physics and rendering engines courtesy of the open-source Three.js, Cannon-es, and Matter.js communities.

---

<p align="center">Made with ❤️ by Thuto • Ready for the rematch!</p>