import * as PIXI from 'pixi.js';
import { GlowFilter } from '@pixi/filter-glow';
import './style.css';

// Type definitions
type Player = 'X' | 'O';
type Cell = Player | '';
type Board = Cell[][];
type SymbolData = { text: PIXI.Text; row: number; col: number };

// Initialize PixiJS application
const app: PIXI.Application = new PIXI.Application({
  width: 600,
  height: 600,
  backgroundColor: 0x1a1a1a, // Dark background for cyberpunk aesthetic
  antialias: true,
});

// Get the snakeContainer element and append the canvas to it
const snakeContainer: HTMLDivElement | null = document.getElementById('snakeContainer') as HTMLDivElement;
if (snakeContainer) {
  snakeContainer.appendChild(app.view as HTMLCanvasElement);
} else {
  console.error("snakeContainer element not found in the DOM.");
}

// Get the turn indicator DOM element
const turnIndicator: HTMLDivElement | null = document.getElementById('turnIndicator') as HTMLDivElement;
if (!turnIndicator) {
  console.error("Turn indicator element not found in the DOM.");
}

// Game state
let board: Board = [
  ['', '', ''],
  ['', '', ''],
  ['', '', '']
];
let currentPlayer: Player = 'X';
let gameOver: boolean = false;
let xSymbols: SymbolData[] = [];
let oSymbols: SymbolData[] = [];

// Grid setup
const gridSize: number = 3;
const cellSize: number = app.screen.width / gridSize;
const graphics: PIXI.Graphics = new PIXI.Graphics();
app.stage.addChild(graphics);

// Draw grid lines with a neon effect
graphics.lineStyle(6, 0x00ffcc, 0.8); // Neon cyan lines
for (let i = 1; i < gridSize; i++) {
  graphics.moveTo(i * cellSize, 0);
  graphics.lineTo(i * cellSize, app.screen.height);
  graphics.moveTo(0, i * cellSize);
  graphics.lineTo(app.screen.width, i * cellSize);
}

// Text style for X and O with cyberpunk font
const textStyle: PIXI.TextStyle = new PIXI.TextStyle({
  fontFamily: 'Orbitron',
  fontSize: 120,
  fontWeight: '700',
  align: 'center'
});

// Glow filters for X and O
const xGlowFilter: GlowFilter = new GlowFilter({
  color: 0xff00ff, // Neon magenta for X
  outerStrength: 3,
  innerStrength: 0,
  distance: 15,
  quality: 0.1
});

const oGlowFilter: GlowFilter = new GlowFilter({
  color: 0x00f0ff, // Electric blue for O
  outerStrength: 3,
  innerStrength: 0,
  distance: 15,
  quality: 0.1
});

// Create an interactive hit area for the entire canvas
const hitArea: PIXI.Graphics = new PIXI.Graphics();
hitArea.beginFill(0x000000, 0.001);
hitArea.drawRect(0, 0, app.screen.width, app.screen.height);
hitArea.endFill();
hitArea.interactive = true;
//hitArea.buttonMode = true;
app.stage.addChild(hitArea);

// Handle clicks using PixiJS's event system
hitArea.on('pointertap', (event): void => {
  if (gameOver) return;

  const localPos: PIXI.Point = event.data.getLocalPosition(app.stage);
  const x: number = localPos.x;
  const y: number = localPos.y;
  const col: number = Math.floor(x / cellSize);
  const row: number = Math.floor(y / cellSize);

  if (row >= 0 && row < 3 && col >= 0 && col < 3 && board[row][col] === '') {
    board[row][col] = currentPlayer;

    const text: PIXI.Text = new PIXI.Text(currentPlayer, {
      ...textStyle,
      fill: currentPlayer === 'X' ? '#ff00ff' : '#00f0ff' // Neon magenta for X, electric blue for O
    });
    text.anchor.set(0.5);
    text.x = col * cellSize + cellSize / 2;
    text.y = row * cellSize + cellSize / 2;

    // Apply glow filter
    text.filters = [currentPlayer === 'X' ? xGlowFilter : oGlowFilter];

    // Start with scale 0 for animation
    text.scale.set(0);
    app.stage.addChild(text);

    // Animate scale and glow
    animatePlacement(text);
    animateGlow(text, currentPlayer === 'X' ? xGlowFilter : oGlowFilter);

    // Track symbols with position for the current player
    const symbolArray: SymbolData[] = currentPlayer === 'X' ? xSymbols : oSymbols;
    symbolArray.push({ text, row, col });

    // Fade and disappear logic
    if (symbolArray.length >= 3) {
      // If there are 4 or more symbols, remove the earliest
      if (symbolArray.length >= 4) {
        const symbolToRemove: SymbolData = symbolArray.shift()!;
        app.stage.removeChild(symbolToRemove.text);
        // Clear the corresponding cell on the board
        board[symbolToRemove.row][symbolToRemove.col] = '';
      }

      // Fade the earliest unfaded symbol
      const earliestUnfaded: SymbolData | undefined = symbolArray.find(symbol => symbol.text.alpha === 1);
      if (earliestUnfaded) {
        console.log(`Fading symbol at row ${earliestUnfaded.row}, col ${earliestUnfaded.col}, alpha: ${earliestUnfaded.text.alpha}`);
        fadeSymbol(earliestUnfaded.text);
      }
    }

    if (checkWin(currentPlayer)) {
      displayMessage(`${currentPlayer} Wins!`);
      gameOver = true;
      if (turnIndicator) turnIndicator.textContent = `${currentPlayer} Wins!`;
    } else if (checkDraw()) {
      displayMessage("It's a Draw!");
      gameOver = true;
      if (turnIndicator) turnIndicator.textContent = "Draw!";
    } else {
      currentPlayer = currentPlayer === 'X' ? 'O' : 'X';
      if (turnIndicator) turnIndicator.textContent = `Player ${currentPlayer}'s Turn`;
    }
  }
});

// Reset button
const resetButton: HTMLButtonElement | null = document.getElementById('resetButton') as HTMLButtonElement;
if (resetButton) {
  resetButton.addEventListener('click', resetGame);
} else {
  console.error("Reset button not found in the DOM.");
}

// Animate symbol placement (scale from 0 to 1)
function animatePlacement(symbol: PIXI.Text): void {
  const animationDuration: number = 200;
  let elapsed: number = 0;

  app.ticker.add((delta: number): void => {
    elapsed += delta * (1000 / 60);
    const progress: number = Math.min(elapsed / animationDuration, 1);
    symbol.scale.set(progress);

    if (progress >= 1) {
      app.ticker.remove(animatePlacement as () => void);
    }
  });
}

// Animate glow effect (pulsing)
function animateGlow(symbol: PIXI.Text, glowFilter: GlowFilter): void {
  let time: number = 0;
  const pulseSpeed: number = 0.05; // Speed of the pulsing effect
  const minStrength: number = 2;
  const maxStrength: number = 4;

  app.ticker.add((delta: number): void => {
    time += delta * pulseSpeed;
    glowFilter.outerStrength = minStrength + Math.sin(time) * (maxStrength - minStrength) / 2;

    // Stop animation if symbol is removed
    if (!symbol.parent) {
      app.ticker.remove(animateGlow as () => void);
    }
  });
}

// Fade animation for a symbol to half opacity
function fadeSymbol(symbol: PIXI.Text): void {
  const fadeDuration: number = 1000;
  const startAlpha: number = symbol.alpha;
  const targetAlpha: number = 0.1;
  let elapsed: number = 0;

  app.ticker.add((delta: number): void => {
    elapsed += delta * (1000 / 60);
    const progress: number = elapsed / fadeDuration;
    symbol.alpha = startAlpha - (startAlpha - targetAlpha) * progress;

    if (progress >= 1) {
      symbol.alpha = targetAlpha;
      app.ticker.remove(fadeSymbol as () => void);
    }
  });
}

function resetGame(): void {
  board = [
    ['', '', ''],
    ['', '', ''],
    ['', '', '']
  ];
  currentPlayer = 'X';
  gameOver = false;

  xSymbols.forEach(symbol => app.stage.removeChild(symbol.text));
  oSymbols.forEach(symbol => app.stage.removeChild(symbol.text));
  xSymbols = [];
  oSymbols = [];

  const message: PIXI.DisplayObject | null = app.stage.getChildByName('message');
  if (message) app.stage.removeChild(message);

  if (turnIndicator) turnIndicator.textContent = "Player X's Turn";
}

function checkWin(player: Player): boolean {
  for (let i = 0; i < 3; i++) {
    if (board[i][0] === player && board[i][1] === player && board[i][2] === player) return true;
  }
  for (let i = 0; i < 3; i++) {
    if (board[0][i] === player && board[1][i] === player && board[2][i] === player) return true;
  }
  if (board[0][0] === player && board[1][1] === player && board[2][2] === player) return true;
  if (board[0][2] === player && board[1][1] === player && board[2][0] === player) return true;
  return false;
}

function checkDraw(): boolean {
  return board.every(row => row.every(cell => cell !== ''));
}

function displayMessage(message: string): void {
  const messageText: PIXI.Text = new PIXI.Text(message, {
    fontFamily: 'Orbitron',
    fontSize: 60,
    fill: 0x00ffcc, // Neon cyan for message
    fontWeight: '700',
    align: 'center'
  });
  messageText.filters = [new GlowFilter({ color: 0x00ffcc, outerStrength: 3, distance: 15, quality: 0.1 })];
  messageText.name = 'message';
  messageText.anchor.set(0.5);
  messageText.x = app.screen.width / 2;
  messageText.y = app.screen.height / 2;
  //app.stage.addChild(messageText);

  // Animate glow for the message
  //animateGlow(messageText, messageText.filters[0] as GlowFilter);
}