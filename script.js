const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const overlayScreen = document.getElementById('overlay-screen');
const overlayTitle = document.getElementById('overlay-title');
const overlayText = document.getElementById('overlay-text');
const startBtn = document.getElementById('start-btn');
const levelDisplay = document.getElementById('level-display');
const timerDisplay = document.getElementById('timer-display');
const quitInGameBtn = document.getElementById('quit-in-game-btn');
const quitMenuBtn = document.getElementById('quit-menu-btn');
const levelSelect = document.getElementById('level-select');

// Game State
let currentLevel = 1;
let gameState = 'MENU'; // MENU, PLAYING, LEVEL_TRANSITION, GAME_OVER, WON
let player = { x: 0, y: 0, targetX: 0, targetY: 0, isMoving: false, moveProgress: 0 };
let maze = [];
let gridSize = 0;
let tileSize = 0;
let sightRadius = 0;
let timeElapsed = 0;
let timerInterval = null;

// TWEENING
const MOVE_DURATION = 150; // ms
let lastTime = 0;

// AUDIO SYNTHESIS
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playTone(freq, type, duration, vol = 0.1) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);

    gain.gain.setValueAtTime(vol, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start();
    osc.stop(audioCtx.currentTime + duration);
}

function playVictorySound() {
    // A nice happy arpeggio
    const notes = [440, 554.37, 659.25, 880]; // A4, C#5, E5, A5
    notes.forEach((freq, i) => {
        setTimeout(() => playTone(freq, 'sine', 0.5, 0.2), i * 150);
    });
}

function playStepSound() {
    playTone(200, 'triangle', 0.1, 0.05);
}

let bgmOsc = null;
let bgmGain = null;
let isBgmPlaying = false;

function startBGM() {
    if (isBgmPlaying) return;
    if (audioCtx.state === 'suspended') audioCtx.resume();

    bgmOsc = audioCtx.createOscillator();
    bgmGain = audioCtx.createGain();

    // Low mysterious drone
    bgmOsc.type = 'sine';
    bgmOsc.frequency.setValueAtTime(65, audioCtx.currentTime); // C2ish

    // Create a slow LFO for volume pulsing to add mystery
    const lfo = audioCtx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(0.2, audioCtx.currentTime);
    const lfoGain = audioCtx.createGain();
    lfoGain.gain.setValueAtTime(0.05, audioCtx.currentTime);
    lfo.connect(lfoGain);
    lfoGain.connect(bgmGain.gain);

    bgmGain.gain.setValueAtTime(0.1, audioCtx.currentTime);

    bgmOsc.connect(bgmGain);
    bgmGain.connect(audioCtx.destination);

    bgmOsc.start();
    lfo.start();
    isBgmPlaying = true;
}

function stopBGM() {
    if (bgmOsc) {
        bgmOsc.stop();
        bgmOsc.disconnect();
        bgmGain.disconnect();
        isBgmPlaying = false;
    }
}

// Levels Config
const levels = [
    { num: 1, size: 7, radius: 2.5, hasObstacles: false, hasTimer: false },
    { num: 2, size: 11, radius: 2.0, hasObstacles: true, hasTimer: false },
    { num: 3, size: 15, radius: 1.5, hasObstacles: true, hasTimer: true },
    { num: 4, size: 15, radius: 1.4, hasObstacles: false, hasTimer: true },
    { num: 5, size: 15, radius: 1.2, hasObstacles: true, hasTimer: true },
    { num: 6, size: 15, radius: 1.0, hasObstacles: false, hasTimer: true },
    { num: 7, size: 15, radius: 0.9, hasObstacles: true, hasTimer: true },
    { num: 8, size: 15, radius: 0.8, hasObstacles: false, hasTimer: true },
    { num: 9, size: 15, radius: 0.7, hasObstacles: true, hasTimer: true },
    { num: 10, size: 15, radius: 0.6, hasObstacles: false, hasTimer: true }
];

// Controls
const keys = {
    ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false,
    w: false, s: false, a: false, d: false
};

// Event Listeners
window.addEventListener('keydown', (e) => {
    if (keys.hasOwnProperty(e.key)) keys[e.key] = true;
});
window.addEventListener('keyup', (e) => {
    if (keys.hasOwnProperty(e.key)) keys[e.key] = false;
});

startBtn.addEventListener('click', () => {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    if (gameState === 'MENU' || gameState === 'GAME_OVER' || gameState === 'WON') {
        currentLevel = parseInt(levelSelect.value);
        startGame();
    } else if (gameState === 'LEVEL_TRANSITION') {
        startGame();
    }
});

quitMenuBtn.addEventListener('click', () => {
    if (confirm("Are you sure you want to quit the window? This may not work in all browsers.")) {
        window.close();
    }
});

quitInGameBtn.addEventListener('click', () => {
    // Return to main menu
    gameState = 'MENU';
    stopBGM();
    if (timerInterval) clearInterval(timerInterval);
    quitInGameBtn.classList.add('hidden');

    // Clear the canvas to dark
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    levelSelect.value = currentLevel;

    showOverlay('Fog of War Maze', 'Use WASD or Arrow Keys to navigate the maze.\nFind the glowing star exit.', 'Start Game');
    quitMenuBtn.style.display = 'block'; // Make sure menu quit button shows
    levelSelect.parentElement.style.display = 'block';
});

function resizeCanvas() {
    canvas.width = 600;
    canvas.height = 600;
    if (gridSize > 0) {
        tileSize = canvas.width / gridSize;
    }
}

// Map Generation (Simple Recursive Backtracker or DFS)
// For simplicity, we create a fully connected maze using Prim's or DFS.
function generateMaze(size, includeObstacles) {
    // Initialize empty grid, 1 for walls, 0 for empty
    const grid = Array(size).fill(0).map(() => Array(size).fill(1));

    // helper inner function for valid paths
    const isValid = (x, y) => x >= 0 && x < size && y >= 0 && y < size;

    // DFS to carve path
    const carve = (x, y) => {
        grid[y][x] = 0;
        const dirs = [[0, -2], [0, 2], [-2, 0], [2, 0]].sort(() => Math.random() - 0.5);

        for (let [dx, dy] of dirs) {
            const nx = x + dx, ny = y + dy;
            if (isValid(nx, ny) && grid[ny][nx] === 1) {
                grid[y + dy / 2][x + dx / 2] = 0; // break wall between
                carve(nx, ny);
            }
        }
    };

    carve(0, 0); // Start at top-left

    grid[size - 1][size - 1] = 2; // 2 represents exit
    grid[0][0] = 0; // Ensure start is empty

    // Remove some walls to create multiple paths, or add extra obstacles
    if (includeObstacles) {
        for (let i = 0; i < size * size / 4; i++) {
            let rx = Math.floor(Math.random() * size);
            let ry = Math.floor(Math.random() * size);
            if (grid[ry][rx] === 1 && rx !== 0 && ry !== 0 && rx !== size - 1 && ry !== size - 1) {
                grid[ry][rx] = 0; // open up wall
            }
        }
    }

    // To guarantee the exit is reachable, maybe simpler to just rely on DFS and not add random blocking walls, only random openings.

    return grid;
}

function startGame() {
    const config = levels[currentLevel - 1];
    gridSize = config.size;

    // Ensure odd size for better maze generation borders
    if (gridSize % 2 === 0) gridSize += 1;

    sightRadius = config.radius;
    maze = generateMaze(gridSize, config.hasObstacles);

    tileSize = canvas.width / gridSize;

    player.x = 0;
    player.y = 0;
    player.targetX = 0;
    player.targetY = 0;
    player.isMoving = false;

    levelDisplay.innerText = `Level: ${currentLevel}`;
    if (config.hasTimer) {
        timeElapsed = 0;
        timerDisplay.innerText = `Time: ${timeElapsed}s`;
        timerDisplay.classList.remove('hidden');
        if (timerInterval) clearInterval(timerInterval);
        timerInterval = setInterval(() => {
            if (gameState === 'PLAYING') {
                timeElapsed++;
                timerDisplay.innerText = `Time: ${timeElapsed}s`;
            }
        }, 1000);
    } else {
        timerDisplay.classList.add('hidden');
        if (timerInterval) clearInterval(timerInterval);
    }

    gameState = 'PLAYING';
    startBGM();
    quitInGameBtn.classList.remove('hidden');
    if (gameState === 'MENU' || gameState === 'LEVEL_TRANSITION' || gameState === 'PLAYING') {
        quitMenuBtn.style.display = 'none'; // hide the menu quit button when in game
    }
    overlayScreen.style.opacity = '0';
    setTimeout(() => { if (gameState === 'PLAYING') overlayScreen.classList.add('hidden'); }, 500);

    lastTime = performance.now();
    requestAnimationFrame(gameLoop);
}

function handleInput() {
    if (player.isMoving || gameState !== 'PLAYING') return;

    let dx = 0;
    let dy = 0;

    if (keys.ArrowUp || keys.w) dy = -1;
    else if (keys.ArrowDown || keys.s) dy = 1;
    else if (keys.ArrowLeft || keys.a) dx = -1;
    else if (keys.ArrowRight || keys.d) dx = 1;

    if (dx !== 0 || dy !== 0) {
        const nextX = player.x + dx;
        const nextY = player.y + dy;

        // Check bounds
        if (nextX >= 0 && nextX < gridSize && nextY >= 0 && nextY < gridSize) {
            // Check wall collision
            if (maze[nextY][nextX] !== 1) {
                player.targetX = nextX;
                player.targetY = nextY;
                player.isMoving = true;
                player.moveProgress = 0;
            }
        }
    }
}

function update(dt) {
    if (gameState !== 'PLAYING') return;

    if (player.isMoving) {
        player.moveProgress += dt / MOVE_DURATION;
        if (player.moveProgress >= 1) {
            // Finished moving
            player.x = player.targetX;
            player.y = player.targetY;
            player.isMoving = false;

            // Check exit
            if (maze[player.y][player.x] === 2) {
                levelComplete();
            } else {
                playStepSound();
            }
        }
    } else {
        handleInput();
    }
}

function levelComplete() {
    gameState = 'LEVEL_TRANSITION';
    stopBGM();
    playVictorySound();
    if (currentLevel < levels.length) {
        currentLevel++;
        showOverlay(`Level ${currentLevel - 1} Complete!`, 'Excellent navigation. Get ready for the next floor.', 'Next Level');
    } else {
        gameState = 'WON';
        showOverlay('You Escaped!', 'You conquered the Fog of War!', 'Play Again');
    }
}

function showOverlay(title, text, btnText) {
    overlayTitle.innerText = title;
    overlayText.innerText = text;
    startBtn.innerText = btnText;

    const selectContainer = levelSelect.parentElement;

    if (gameState === 'LEVEL_TRANSITION' || gameState === 'WON') {
        quitMenuBtn.style.display = 'none';
        quitInGameBtn.classList.add('hidden');
        selectContainer.style.display = 'none';
    } else {
        quitMenuBtn.style.display = 'block';
        selectContainer.style.display = 'block';
        if (levelSelect.options.length === 0) {
            levels.forEach(l => {
                const opt = document.createElement('option');
                opt.value = l.num;
                opt.text = `Level ${l.num}`;
                opt.style.backgroundColor = '#111';
                opt.style.color = '#00ffcc';
                levelSelect.appendChild(opt);
            });
        }
        levelSelect.value = currentLevel;
    }

    overlayScreen.classList.remove('hidden');
    // slight delay to allow display to apply before opacity transition
    setTimeout(() => overlayScreen.style.opacity = '1', 10);
}

function drawStar(cx, cy, spikes, outerRadius, innerRadius) {
    let rot = Math.PI / 2 * 3;
    let step = Math.PI / spikes;

    ctx.beginPath();
    ctx.moveTo(cx, cy - outerRadius);
    for (let i = 0; i < spikes; i++) {
        let x = cx + Math.cos(rot) * outerRadius;
        let y = cy + Math.sin(rot) * outerRadius;
        ctx.lineTo(x, y);
        rot += step;

        x = cx + Math.cos(rot) * innerRadius;
        y = cy + Math.sin(rot) * innerRadius;
        ctx.lineTo(x, y);
        rot += step;
    }
    ctx.lineTo(cx, cy - outerRadius);
    ctx.closePath();
    ctx.fill();
}

function draw(time) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw Floor
    ctx.fillStyle = '#222';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Pulsating Star Exit
    let starPulse = (Math.sin(time / 200) + 1) / 2; // 0 to 1
    let starHue = (time / 10) % 360;
    let exitColor = `hsl(${starHue}, 100%, 70%)`;

    // Draw Maze Walls and Exit
    for (let y = 0; y < gridSize; y++) {
        for (let x = 0; x < gridSize; x++) {
            if (maze[y][x] === 1) {
                // Wall
                ctx.fillStyle = '#444';
                ctx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
                // Subtle border for walls
                ctx.strokeStyle = '#333';
                ctx.lineWidth = 2;
                ctx.strokeRect(x * tileSize, y * tileSize, tileSize, tileSize);
            } else if (maze[y][x] === 2) {
                // Exit
                ctx.fillStyle = exitColor;
                ctx.shadowColor = exitColor;
                // Pulse shadow blur between 10 and 25
                ctx.shadowBlur = 10 + (15 * starPulse);
                const cx = x * tileSize + tileSize / 2;
                const cy = y * tileSize + tileSize / 2;
                // Pulse inner radius to make it beat
                const iRadius = tileSize * 0.15 + (tileSize * 0.1 * starPulse);
                drawStar(cx, cy, 5, tileSize * 0.4, iRadius);
                ctx.shadowBlur = 0; // reset
            }
        }
    }

    // Interpolate player position
    let drawX = player.x;
    let drawY = player.y;
    if (player.isMoving) {
        drawX += (player.targetX - player.x) * player.moveProgress;
        drawY += (player.targetY - player.y) * player.moveProgress;
    }

    // Draw Player
    const pCenterX = drawX * tileSize + tileSize / 2;
    const pCenterY = drawY * tileSize + tileSize / 2;
    const pRadius = tileSize * 0.35;

    ctx.fillStyle = '#00ffcc';
    ctx.shadowColor = '#00ffcc';
    ctx.shadowBlur = 15;
    ctx.beginPath();
    ctx.arc(pCenterX, pCenterY, pRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Draw Fog of War
    const radius = sightRadius * tileSize;
    const gradient = ctx.createRadialGradient(pCenterX, pCenterY, radius * 0.3, pCenterX, pCenterY, radius);
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0.95)');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function gameLoop(time) {
    const dt = time - lastTime;
    lastTime = time;

    update(dt);
    draw(time);

    if (gameState === 'PLAYING') {
        requestAnimationFrame(gameLoop);
    }
}

// Init
resizeCanvas();

// Initialize level dropdown
levels.forEach(l => {
    const opt = document.createElement('option');
    opt.value = l.num;
    opt.text = `Level ${l.num}`;
    opt.style.backgroundColor = '#111';
    opt.style.color = '#00ffcc';
    levelSelect.appendChild(opt);
});
levelSelect.value = currentLevel;

// Pre-draw an empty black canvas
ctx.fillStyle = '#000';
ctx.fillRect(0, 0, canvas.width, canvas.height);
