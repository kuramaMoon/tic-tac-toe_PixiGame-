import * as PIXI from 'pixi.js';
import { GlowFilter } from '@pixi/filter-glow';
import './style.css';

// Type definitions
type Player = 'X' | 'O';
type Cell = Player | '';
type Board = Cell[][];
type SymbolData = { text: PIXI.Text; row: number; col: number };

// Determine canvas size based on screen dimensions
const maxCanvasSize = 600; // Maximum size for larger screens
const minCanvasSize = 250; // Reduced for smaller screens (smartphones)
const padding = 50; // Reduced padding to fit better on small screens

const calculateCanvasSize = (): number => {
  const windowWidth = window.innerWidth - padding;
  const windowHeight = window.innerHeight - padding;
  // Ensure the canvas size is constrained by the viewport width
  const maxSizeByWidth = Math.min(windowWidth, windowHeight); // Use the smaller dimension
  const size = Math.max(minCanvasSize, Math.min(maxCanvasSize, maxSizeByWidth));
  console.log(`Main Canvas CANVAS_SIZE: ${size}, windowWidth: ${windowWidth}, windowHeight: ${windowHeight}`);
  return size;
};

let CANVAS_SIZE = calculateCanvasSize();

// Initialize PixiJS application with dynamic size
const app: PIXI.Application = new PIXI.Application({
  width: CANVAS_SIZE,
  height: CANVAS_SIZE,
  backgroundColor: 0x1a1a1a, // Dark background for cyberpunk aesthetic
  antialias: true,
});

// Get the snakeContainer element and append the canvas to it
const snakeContainer: HTMLDivElement | null = document.getElementById('snakeContainer') as HTMLDivElement;
if (snakeContainer) {
  // Instead of clearing all content, append the canvas without affecting #snakeOverlay
  const existingMainCanvas = snakeContainer.querySelector('canvas');
  if (existingMainCanvas) {
    existingMainCanvas.remove(); // Remove only the previous main canvas if it exists
  }
  snakeContainer.insertBefore(app.view as HTMLCanvasElement, snakeContainer.firstChild); // Insert before #snakeOverlay
  console.log("Main canvas appended to snakeContainer:", app.view);
} else {
  console.error("snakeContainer element not found in the DOM.");
}

// Get the turn indicator DOM element
const turnIndicator: HTMLDivElement | null = document.getElementById('turnIndicator') as HTMLDivElement;
if (!turnIndicator) {
  console.error("Turn indicator element not found in the DOM.");
}

// Game state
const GRID_SIZE = 3; // Ensure 3x3 grid
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
let cellSize: number = CANVAS_SIZE / GRID_SIZE;
const graphics: PIXI.Graphics = new PIXI.Graphics();
app.stage.addChild(graphics);

// Function to draw the grid with dynamic size
const drawGrid = () => {
  graphics.clear();
  graphics.lineStyle(6, 0x00ffcc, 0.8); // Neon cyan lines
  for (let i = 1; i < GRID_SIZE; i++) {
    graphics.moveTo(i * cellSize, 0);
    graphics.lineTo(i * cellSize, CANVAS_SIZE);
    graphics.moveTo(0, i * cellSize);
    graphics.lineTo(CANVAS_SIZE, i * cellSize);
  }
  console.log(`Drew grid: ${GRID_SIZE}x${GRID_SIZE}, cellSize=${cellSize}, CANVAS_SIZE=${CANVAS_SIZE}`);
};

// Initial grid draw
drawGrid();

// Text style for X and O with dynamic font size
const calculateFontSize = () => CANVAS_SIZE * 0.2; // 20% of canvas size
const textStyle: PIXI.TextStyle = new PIXI.TextStyle({
  fontFamily: 'Orbitron',
  fontSize: calculateFontSize(),
  fontWeight: '700',
  align: 'center',
});

// Glow filters for X and O
const xGlowFilter: GlowFilter = new GlowFilter({
  color: 0xff00ff, // Neon magenta for X
  outerStrength: 3,
  innerStrength: 0,
  distance: 15,
  quality: 0.1,
});

const oGlowFilter: GlowFilter = new GlowFilter({
  color: 0x00f0ff, // Electric blue for O
  outerStrength: 3,
  innerStrength: 0,
  distance: 15,
  quality: 0.1,
});

// Create an interactive hit area for the entire canvas
const hitArea: PIXI.Graphics = new PIXI.Graphics();
const updateHitArea = () => {
  hitArea.clear();
  hitArea.beginFill(0x000000, 0.001);
  hitArea.drawRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  hitArea.endFill();
  hitArea.interactive = true;
  console.log(`Updated hit area: ${CANVAS_SIZE}x${CANVAS_SIZE}`);
};
updateHitArea();
app.stage.addChild(hitArea);

// Handle clicks using PixiJS's event system
hitArea.on('pointertap', (event): void => {
  if (gameOver) return;

  const localPos: PIXI.Point = event.data.getLocalPosition(app.stage);
  const x: number = localPos.x;
  const y: number = localPos.y;
  const col: number = Math.floor(x / cellSize);
  const row: number = Math.floor(y / cellSize);

  console.log(`Click at x=${x}, y=${y}, row=${row}, col=${col}, cellSize=${cellSize}`);

  if (row >= 0 && row < GRID_SIZE && col >= 0 && col < GRID_SIZE && board[row][col] === '') {
    board[row][col] = currentPlayer;

    const text: PIXI.Text = new PIXI.Text(currentPlayer, {
      ...textStyle,
      fill: currentPlayer === 'X' ? '#ff00ff' : '#00f0ff', // Neon magenta for X, electric blue for O
      fontSize: calculateFontSize(),
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
  } else {
    console.log(`Invalid click: row=${row}, col=${col}, board[row][col]=${board[row] ? board[row][col] : 'undefined'}`);
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
function animateGlow(symbol: PIXI.Text | PIXI.Graphics, glowFilter: GlowFilter): void {
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

  const messageBackground: PIXI.DisplayObject | null = app.stage.getChildByName('messageBackground');
  if (messageBackground) app.stage.removeChild(messageBackground);

  if (turnIndicator) turnIndicator.textContent = "Player X's Turn";
}

function checkWin(player: Player): boolean {
  // Check rows
  for (let i = 0; i < GRID_SIZE; i++) {
    if (board[i][0] === player && board[i][1] === player && board[i][2] === player) return true;
  }
  // Check columns
  for (let i = 0; i < GRID_SIZE; i++) {
    if (board[0][i] === player && board[1][i] === player && board[2][i] === player) return true;
  }
  // Check diagonals
  if (board[0][0] === player && board[1][1] === player && board[2][2] === player) return true;
  if (board[0][2] === player && board[1][1] === player && board[2][0] === player) return true;
  return false;
}

function checkDraw(): boolean {
  return board.every(row => row.every(cell => cell !== ''));
}

function displayMessage(message: string): void {
  // Create the message text
  const messageText: PIXI.Text = new PIXI.Text(message, {
    fontFamily: 'Orbitron',
    fontSize: CANVAS_SIZE * 0.1, // 10% of canvas size
    fill: 0xfafafa, // Light gray for message
    fontWeight: '700',
    align: 'center',
  });
  messageText.name = 'message';
  messageText.anchor.set(0.5);
  messageText.x = CANVAS_SIZE / 2;
  messageText.y = CANVAS_SIZE / 2;

  // Create a glow filter for the message text
  const messageGlowFilter: GlowFilter = new GlowFilter({
    color: 0xff9500, // Orange glow to match the border
    outerStrength: 3,
    distance: 15,
    quality: 0.1,
  });
  messageText.filters = [messageGlowFilter];

  // Create a black rectangle with an orange border as the background
  const messageBackground: PIXI.Graphics = new PIXI.Graphics();
  messageBackground.name = 'messageBackground';
  messageBackground.lineStyle(4, 0xff9500, 1); // Orange border, 4px thick
  messageBackground.beginFill(0x000000); // Black background
  // Calculate the rectangle size based on the text dimensions with padding
  const textWidth = messageText.width;
  const textHeight = messageText.height;
  const padding = 20; // Padding around the text
  const rectWidth = textWidth + padding * 2;
  const rectHeight = textHeight + padding * 2;
  messageBackground.drawRect(-rectWidth / 2, -rectHeight / 2, rectWidth, rectHeight);
  messageBackground.endFill();
  messageBackground.x = CANVAS_SIZE / 2;
  messageBackground.y = CANVAS_SIZE / 2;

  // Create a glow filter for the rectangle's border
  const backgroundGlowFilter: GlowFilter = new GlowFilter({
    color: 0xff9500, // Orange glow to match the border
    outerStrength: 3,
    distance: 15,
    quality: 0.1,
  });
  messageBackground.filters = [backgroundGlowFilter];

  // Add the background first, then the text on top
  app.stage.addChild(messageBackground);
  app.stage.addChild(messageText);

  // Animate glow for both the message and the background
  animateGlow(messageText, messageGlowFilter);
  animateGlow(messageBackground, backgroundGlowFilter);
}

// Handle window resize to make the canvas responsive
const resizeCanvas = () => {
  CANVAS_SIZE = calculateCanvasSize();
  cellSize = CANVAS_SIZE / GRID_SIZE;

  // Resize the PixiJS application
  app.renderer.resize(CANVAS_SIZE, CANVAS_SIZE);

  // Redraw the grid
  drawGrid();

  // Update hit area
  updateHitArea();

  // Update existing symbols' positions and sizes
  const newFontSize = calculateFontSize();
  [...xSymbols, ...oSymbols].forEach(({ text, row, col }) => {
    text.style.fontSize = newFontSize;
    text.x = col * cellSize + cellSize / 2;
    text.y = row * cellSize + cellSize / 2;
  });

  // Update message text if it exists
  const message: PIXI.DisplayObject | null = app.stage.getChildByName('message');
  if (message) {
    (message as PIXI.Text).style.fontSize = CANVAS_SIZE * 0.1;
    message.x = CANVAS_SIZE / 2;
    message.y = CANVAS_SIZE / 2;
  }
};

// Add resize event listener
window.addEventListener('resize', resizeCanvas);

// Initial resize to ensure correct sizing on load
resizeCanvas();