# Fog of War Maze

A single-player, level-based maze game built entirely in HTML, CSS, and Vanilla JavaScript.

Navigate an infinite void of darkness where only the immediate area around you is visible. Find the glowing exit star to progress through increasingly complex procedurally generated mazes while the darkness slowly creeps closer.

## Features

- **Procedural Mazes**: Every level is randomly generated using a randomized Depth-First Search algorithm with added loops for variety.
- **Dynamic Fog of War**: The visibility radius shrinks as you progress through higher levels, dynamically masking the game canvas.
- **Audio Synthesizer**: Uses the Web Audio API to synthesize background drone music and sound effects natively without any audio files.
- **Custom Aesthetic**: Smooth 60fps tile-tweened movement, customizable glowing colors, and pulsating UI components rendered on HTML5 Canvas.

## Setup Instructions

Since this game is built entirely with client-side vanilla web technologies, there are absolutely no build steps, node modules, or dependencies required.

### Playing Locally

To play the game on your local machine:
1. Clone this repository or download the files.
2. Open `index.html` directly in any modern web browser.
*(Ensure your browser permits Web Audio Context auto-play or simply click anywhere on the page if you don't hear music immediately.)*

### Hosting on GitHub Pages

The project is fully compatible with GitHub Pages out-of-the-box.
1. Create a repository on GitHub.
2. Push `index.html`, `style.css`, and `script.js` to the `main` branch.
3. In your repository settings, go to **Pages** -> **Source** and select `main` branch.
4. Your Fog of War Maze game is now live on the internet!

## Controls

- **Movement:** `W A S D` or `Arrow Keys`
- **Goal:** Reach the glowing, pulsating star.
- **Menu:** Use the top right corner UI to return to the level selection screen.
