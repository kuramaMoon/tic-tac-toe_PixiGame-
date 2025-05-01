import * as PIXI from 'pixi.js';
import { GlowFilter } from '@pixi/filter-glow';
import PubNub from 'pubnub';
import './style.css';

// Type definitions
type Player = 'X' | 'O';
type Cell = Player | '';
type Board = Cell[][];
type SymbolData = { text: PIXI.Text; row: number; col: number };

// Define the structure of PubNub message payloads
interface MessagePayload {
  type: 'playerJoined' | 'move' | 'gameOver' | 'reset';
  row?: number;
  col?: number;
  player?: Player;
  nextPlayer?: Player;
  messageText?: string;
  resetInitiator?: string;
  gameOverId?: string;
  startingPlayer?: Player;
}

// PubNub setup
const pubnub = new PubNub({
  publishKey: 'pub-c-7a6bde4e-96b8-4e30-b3dd-371ac3033756',
  subscribeKey: 'sub-c-95aa0fd1-e295-4812-9b06-73c5b7a8755e',
  userId: `player-${Math.random().toString(36).substring(2, 9)}`,
});

// Game session variables
let roomId: string | null = null;
let isCreator: boolean = false;
let myPlayer: Player | null = null;
let opponentJoined: boolean = false;
let lastMove: { row: number; col: number; player: Player } | null = null;
let lastResetInitiator: string | null = null;
let lastGameOverId: string | null = null;
let creatorStartsNext: boolean = true; // Changed to true since first game starts with 'X'
let copyLinkTimeout: NodeJS.Timeout | null = null; // To manage the timer for copy link

// DOM elements for lobby
const lobbyDiv = document.getElementById('lobby') as HTMLDivElement;
const gameDiv = document.getElementById('game') as HTMLDivElement;
const createGameButton = document.getElementById('createGameButton') as HTMLButtonElement;
const gameLinkDiv = document.getElementById('gameLink') as HTMLDivElement;
const linkText = document.getElementById('linkText') as HTMLSpanElement;
const copyLinkButton = document.getElementById('copyLinkButton') as HTMLButtonElement;
const waitingMessage = document.getElementById('waitingMessage') as HTMLDivElement;

// Function to display a temporary message in the lobby
function showTemporaryMessage(message: string, duration: number): void {
  const messageDiv = document.createElement('div');
  messageDiv.className = 'temporary-message';
  messageDiv.textContent = message;
  lobbyDiv.appendChild(messageDiv);
  console.log(`Displaying temporary message: ${message} for ${duration}ms`);

  setTimeout(() => {
    lobbyDiv.removeChild(messageDiv);
    console.log(`Removed temporary message: ${message}`);
  }, duration);
}

// Determine canvas size based on screen dimensions
const maxCanvasSize = 600;
const minCanvasSize = 250;
const padding = 15; // Match padding from style.css

const calculateCanvasSize = (): number => {
  const windowWidth = window.innerWidth - padding * 2;
  const windowHeight = window.innerHeight - padding * 2;
  const maxSizeByWidth = Math.min(windowWidth, windowHeight);
  const size = Math.max(minCanvasSize, Math.min(maxCanvasSize, maxSizeByWidth));
  console.log(`Main Canvas CANVAS_SIZE: ${size}, windowWidth: ${windowWidth}, windowHeight: ${windowHeight}`);
  return size;
};

let CANVAS_SIZE = calculateCanvasSize();

// Initialize PixiJS application with dynamic size
const app: PIXI.Application = new PIXI.Application({
  width: CANVAS_SIZE,
  height: CANVAS_SIZE,
  backgroundColor: 0x1a1a1a,
  antialias: true,
  autoStart: false,
});

// Get the snakeContainer element and append the canvas to it
const snakeContainer: HTMLDivElement | null = document.getElementById('snakeContainer') as HTMLDivElement;
if (snakeContainer) {
  const existingMainCanvas = snakeContainer.querySelector('canvas');
  if (existingMainCanvas) {
    existingMainCanvas.remove();
  }
  snakeContainer.insertBefore(app.view as HTMLCanvasElement, snakeContainer.firstChild);
  console.log("Main canvas appended to snakeContainer:", app.view);
  console.log(`Canvas dimensions: width=${app.view.width}, height=${app.view.height}`);
} else {
  console.error("snakeContainer element not found in the DOM.");
}

// Get the turn indicator DOM element
const turnIndicator: HTMLDivElement | null = document.getElementById('turnIndicator') as HTMLDivElement;
if (!turnIndicator) {
  console.error("Turn indicator element not found in the DOM.");
}

// Game state
const GRID_SIZE = 3;
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
  graphics.lineStyle(6, 0x00ffcc, 0.8);
  for (let i = 1; i < GRID_SIZE; i++) {
    graphics.moveTo(i * cellSize, 0);
    graphics.lineTo(i * cellSize, CANVAS_SIZE);
    graphics.moveTo(0, i * cellSize);
    graphics.lineTo(CANVAS_SIZE, i * cellSize);
  }
  console.log(`Drew grid: ${GRID_SIZE}x${GRID_SIZE}, cellSize=${cellSize}, CANVAS_SIZE=${CANVAS_SIZE}`);
  app.renderer.render(app.stage); // Force render
};

// Text style for X and O with dynamic font size
const calculateFontSize = () => CANVAS_SIZE * 0.2;
const textStyle: PIXI.TextStyle = new PIXI.TextStyle({
  fontFamily: 'Orbitron',
  fontSize: calculateFontSize(),
  fontWeight: '700',
  align: 'center',
});

// Glow filters for X and O
const xGlowFilter: GlowFilter = new GlowFilter({
  color: 0xff00ff,
  outerStrength: 3,
  innerStrength: 0,
  distance: 15,
  quality: 0.1,
});

const oGlowFilter: GlowFilter = new GlowFilter({
  color: 0x00f0ff,
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

// Function to show the game UI and render the board
const showGameAndRender = () => {
  lobbyDiv.style.display = 'none';
  gameDiv.style.display = 'flex';
  console.log("Game UI made visible: gameDiv display =", gameDiv.style.display);

  // Recalculate canvas size and resize
  CANVAS_SIZE = calculateCanvasSize();
  cellSize = CANVAS_SIZE / GRID_SIZE;
  app.renderer.resize(CANVAS_SIZE, CANVAS_SIZE);
  console.log(`Canvas resized: width=${app.view.width}, height=${app.view.height}`);

  // Redraw the grid and force render
  drawGrid();
  updateHitArea();
  app.start(); // Start the PixiJS ticker for animations
  console.log("Game rendered for player:", isCreator ? "Creator" : "Joiner");
  console.log(`Initial turn: currentPlayer=${currentPlayer}, myPlayer=${myPlayer}, opponentJoined=${opponentJoined}`);
};

// Lobby logic
createGameButton.addEventListener('click', () => {
  roomId = Math.random().toString(36).substring(2, 9);
  isCreator = true;
  myPlayer = 'X'; // Creator is always X

  pubnub.subscribe({ channels: [roomId] });

  const gameUrl = `${window.location.origin}${window.location.pathname}?room=${roomId}`;
  linkText.textContent = gameUrl;
  gameLinkDiv.style.display = 'block';
  waitingMessage.style.display = 'block';
  createGameButton.style.display = 'none';

  console.log("Creator: Waiting for opponent to join");
});

copyLinkButton.addEventListener('click', () => {
  const gameUrl = linkText.textContent || '';
  navigator.clipboard.writeText(gameUrl).then(() => {
    showTemporaryMessage('Link copied to clipboard!', 5000);

    // Clear any existing timeout to prevent multiple timers
    if (copyLinkTimeout) {
      clearTimeout(copyLinkTimeout);
    }

    // Start a 10-second timer after copying the link
    copyLinkTimeout = setTimeout(() => {
      if (!opponentJoined) {
        console.warn("Opponent did not join within 10 seconds, showing game for debugging");
        showGameAndRender();
      }
    }, 10000);
  });
});

// Check if joining via URL
const urlParams = new URLSearchParams(window.location.search);
const joinRoomId = urlParams.get('room');
if (joinRoomId) {
  roomId = joinRoomId;
  isCreator = false;
  myPlayer = 'O'; // Joiner is always O
  opponentJoined = true;

  pubnub.subscribe({ channels: [roomId] });

  pubnub.publish({
    channel: roomId,
    message: { type: 'playerJoined' },
  });

  console.log("Joiner: Subscribed to room and sent playerJoined message, opponentJoined=", opponentJoined);
  showGameAndRender();
}

// PubNub message listener
pubnub.addListener({
  message: (msg) => {
    const payload = msg.message as unknown;

    if (typeof payload !== 'object' || payload === null || !('type' in payload)) {
      console.error('Invalid message payload: Expected an object with a "type" property', payload);
      return;
    }

    const messagePayload = payload as MessagePayload;
    console.log("Received PubNub message:", messagePayload);

    switch (messagePayload.type) {
      case 'playerJoined':
        if (isCreator) {
          opponentJoined = true;
          console.log("Creator: Opponent joined, opponentJoined=", opponentJoined);
          // Clear the copy link timeout since the opponent has joined
          if (copyLinkTimeout) {
            clearTimeout(copyLinkTimeout);
            copyLinkTimeout = null;
          }
          showGameAndRender();
        }
        break;
      case 'move':
        if (
          typeof messagePayload.row !== 'number' ||
          typeof messagePayload.col !== 'number' ||
          !messagePayload.player ||
          (messagePayload.player !== 'X' && messagePayload.player !== 'O') ||
          !messagePayload.nextPlayer ||
          (messagePayload.nextPlayer !== 'X' && messagePayload.nextPlayer !== 'O')
        ) {
          console.error('Invalid move payload: Missing or invalid row, col, player, or nextPlayer', messagePayload);
          return;
        }
        if (
          lastMove &&
          lastMove.row === messagePayload.row &&
          lastMove.col === messagePayload.col &&
          lastMove.player === messagePayload.player &&
          messagePayload.player === myPlayer
        ) {
          console.log(`Skipping duplicate move: row=${messagePayload.row}, col=${messagePayload.col}, player=${messagePayload.player}`);
          currentPlayer = messagePayload.nextPlayer;
          if (turnIndicator) turnIndicator.textContent = `Player ${currentPlayer}'s Turn`;
          console.log(`After skipped move: currentPlayer=${currentPlayer}, myPlayer=${myPlayer}, opponentJoined=${opponentJoined}`);
          return;
        }
        handleMove(messagePayload.row, messagePayload.col, messagePayload.player);
        currentPlayer = messagePayload.nextPlayer;
        if (turnIndicator) turnIndicator.textContent = `Player ${currentPlayer}'s Turn`;
        console.log(`After move: currentPlayer=${currentPlayer}, myPlayer=${myPlayer}, opponentJoined=${opponentJoined}`);
        break;
      case 'gameOver':
        if (!messagePayload.messageText || typeof messagePayload.messageText !== 'string') {
          console.error('Invalid gameOver payload: Missing or invalid messageText', messagePayload);
          return;
        }
        if (messagePayload.gameOverId && messagePayload.gameOverId === lastGameOverId) {
          console.log("Skipping duplicate gameOver message:", messagePayload.messageText);
          return;
        }
        lastGameOverId = messagePayload.gameOverId || null;
        gameOver = true;
        displayMessage(messagePayload.messageText);
        if (turnIndicator) turnIndicator.textContent = messagePayload.messageText;
        break;
      case 'reset':
        if (messagePayload.resetInitiator === pubnub.getUUID()) {
          console.log("Skipping reset message initiated by this player");
          return;
        }
        if (messagePayload.startingPlayer) {
          creatorStartsNext = (messagePayload.startingPlayer === 'X');
          console.log(`Updated creatorStartsNext to ${creatorStartsNext} based on startingPlayer=${messagePayload.startingPlayer}`);
        }
        resetGameLocally();
        if (!isCreator) {
          pubnub.publish({
            channel: roomId!,
            message: { type: 'playerJoined' },
          });
          opponentJoined = true;
          console.log("Joiner: Sent playerJoined message after reset, opponentJoined=", opponentJoined);
        }
        break;
      default:
        console.warn('Unknown message type:', messagePayload.type);
    }
  },
  status: (statusEvent) => {
    if (statusEvent.error) {
      console.error("PubNub status error:", statusEvent);
    } else {
      console.log("PubNub status:", statusEvent);
    }
  },
});

// Handle clicks using PixiJS's event system
hitArea.on('pointertap', (event): void => {
  console.log(`Click event triggered: gameOver=${gameOver}, myPlayer=${myPlayer}, currentPlayer=${currentPlayer}, opponentJoined=${opponentJoined}`);
  if (gameOver || !myPlayer || currentPlayer !== myPlayer || !opponentJoined) return;

  const localPos: PIXI.Point = event.data.getLocalPosition(app.stage);
  const x: number = localPos.x;
  const y: number = localPos.y;
  const col: number = Math.floor(x / cellSize);
  const row: number = Math.floor(y / cellSize);

  console.log(`Click at x=${x}, y=${y}, row=${row}, col=${col}, cellSize=${cellSize}`);

  if (row >= 0 && row < GRID_SIZE && col >= 0 && col < GRID_SIZE && board[row][col] === '') {
    const nextPlayer: Player = myPlayer === 'X' ? 'O' : 'X';
    lastMove = { row, col, player: myPlayer };
    pubnub.publish({
      channel: roomId!,
      message: { type: 'move', row, col, player: myPlayer, nextPlayer },
    });

    handleMove(row, col, myPlayer);
    currentPlayer = nextPlayer;
    if (turnIndicator) turnIndicator.textContent = `Player ${currentPlayer}'s Turn`;
    console.log(`After local move: currentPlayer=${currentPlayer}, myPlayer=${myPlayer}, opponentJoined=${opponentJoined}`);
  }
});

// Handle a move (local or from opponent)
function handleMove(row: number, col: number, player: Player): void {
  board[row][col] = player;

  const text: PIXI.Text = new PIXI.Text(player, {
    ...textStyle,
    fill: player === 'X' ? '#ff00ff' : '#00f0ff',
    fontSize: calculateFontSize(),
  });
  text.anchor.set(0.5);
  text.x = col * cellSize + cellSize / 2;
  text.y = row * cellSize + cellSize / 2;

  text.filters = [player === 'X' ? xGlowFilter : oGlowFilter];
  text.scale.set(0);
  app.stage.addChild(text);

  animatePlacement(text);
  animateGlow(text, player === 'X' ? xGlowFilter : oGlowFilter);

  const symbolArray: SymbolData[] = player === 'X' ? xSymbols : oSymbols;
  symbolArray.push({ text, row, col });

  console.log(`Board after move: ${JSON.stringify(board)}`);
  console.log(`symbolArray (${player}):`, symbolArray);

  if (symbolArray.length >= 3) {
    console.log('----------------------------------------');
    console.log(`symbolArray (${player}) length: ${symbolArray.length}`, symbolArray);
    console.log('----------------------------------------');
    if (symbolArray.length >= 4) {
      const symbolToRemove: SymbolData = symbolArray.shift()!;
      app.stage.removeChild(symbolToRemove.text);
      board[symbolToRemove.row][symbolToRemove.col] = '';
      console.log(`Removed symbol at row ${symbolToRemove.row}, col ${symbolToRemove.col}`);
    }

    const earliestUnfaded: SymbolData | undefined = symbolArray.find(symbol => symbol.text.alpha === 1);
    if (earliestUnfaded) {
      console.log(`Fading symbol at row ${earliestUnfaded.row}, col ${earliestUnfaded.col}, alpha: ${earliestUnfaded.text.alpha}`);
      fadeSymbol(earliestUnfaded.text);
    }
  }

  if (checkWin(player)) {
    const gameOverId = Math.random().toString(36).substring(2, 9);
    pubnub.publish({
      channel: roomId!,
      message: { type: 'gameOver', messageText: `${player} Wins!`, gameOverId },
    });
    lastGameOverId = gameOverId;
    gameOver = true;
    displayMessage(`${player} Wins!`);
    if (turnIndicator) turnIndicator.textContent = `${player} Wins!`;
  } else if (checkDraw()) {
    const gameOverId = Math.random().toString(36).substring(2, 9);
    pubnub.publish({
      channel: roomId!,
      message: { type: 'gameOver', messageText: "It's a Draw!", gameOverId },
    });
    lastGameOverId = gameOverId;
    gameOver = true;
    displayMessage("It's a Draw!");
    if (turnIndicator) turnIndicator.textContent = "Draw!";
  }
}

// Reset button
const resetButton: HTMLButtonElement | null = document.getElementById('resetButton') as HTMLButtonElement;
if (resetButton) {
  resetButton.addEventListener('click', () => {
    lastResetInitiator = pubnub.getUUID();
    // Toggle who starts next
    creatorStartsNext = !creatorStartsNext;
    const startingPlayer: Player = creatorStartsNext ? 'X' : 'O';
    pubnub.publish({
      channel: roomId!,
      message: { type: 'reset', resetInitiator: lastResetInitiator, startingPlayer },
    });
    resetGameLocally();
    if (isCreator) {
      opponentJoined = false;
      console.log("Creator: Waiting for Joiner to rejoin after reset, opponentJoined=", opponentJoined);
    }
  });
} else {
  console.error("Reset button not found in the DOM.");
}

// Reset game locally
function resetGameLocally(): void {
  board = [
    ['', '', ''],
    ['', '', ''],
    ['', '', '']
  ];
  currentPlayer = creatorStartsNext ? 'X' : 'O'; // Alternate starting player
  gameOver = false;

  xSymbols.forEach(symbol => app.stage.removeChild(symbol.text));
  oSymbols.forEach(symbol => app.stage.removeChild(symbol.text));
  xSymbols = [];
  oSymbols = [];

  lastMove = null;
  lastGameOverId = null;

  // Remove all messages and backgrounds
  const childrenToRemove: PIXI.DisplayObject[] = [];
  app.stage.children.forEach(child => {
    if (child.name === 'message' || child.name === 'messageBackground') {
      childrenToRemove.push(child);
      console.log(`Found ${child.name} to remove`);
    }
  });
  childrenToRemove.forEach(child => {
    app.stage.removeChild(child);
    console.log(`Removed ${child.name} from stage`);
  });

  if (turnIndicator) turnIndicator.textContent = `Player ${currentPlayer}'s Turn`;

  app.stage.removeChild(hitArea);
  updateHitArea();
  app.stage.addChild(hitArea);
  drawGrid();

  app.renderer.render(app.stage);

  console.log(`After reset: currentPlayer=${currentPlayer}, myPlayer=${myPlayer}, opponentJoined=${opponentJoined}, creatorStartsNext=${creatorStartsNext}`);
}

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

function animateGlow(symbol: PIXI.Text | PIXI.Graphics, glowFilter: GlowFilter): void {
  let time: number = 0;
  const pulseSpeed: number = 0.05;
  const minStrength: number = 2;
  const maxStrength: number = 4;

  app.ticker.add((delta: number): void => {
    time += delta * pulseSpeed;
    glowFilter.outerStrength = minStrength + Math.sin(time) * (maxStrength - minStrength) / 2;

    if (!symbol.parent) {
      app.ticker.remove(animateGlow as () => void);
    }
  });
}

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

function checkWin(player: Player): boolean {
  for (let i = 0; i < GRID_SIZE; i++) {
    if (board[i][0] === player && board[i][1] === player && board[i][2] === player) return true;
  }
  for (let i = 0; i < GRID_SIZE; i++) {
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
  console.log(`Displaying message: ${message}`);
  const messageText: PIXI.Text = new PIXI.Text(message, {
    fontFamily: 'Orbitron',
    fontSize: CANVAS_SIZE * 0.1,
    fill: 0xfafafa,
    fontWeight: '700',
    align: 'center',
  });
  messageText.name = 'message';
  messageText.anchor.set(0.5);
  messageText.x = CANVAS_SIZE / 2;
  messageText.y = CANVAS_SIZE / 2;

  const messageGlowFilter: GlowFilter = new GlowFilter({
    color: 0xff9500,
    outerStrength: 3,
    distance: 15,
    quality: 0.1,
  });
  messageText.filters = [messageGlowFilter];

  const messageBackground: PIXI.Graphics = new PIXI.Graphics();
  messageBackground.name = 'messageBackground';
  messageBackground.lineStyle(4, 0xff9500, 1);
  messageBackground.beginFill(0x000000);
  const textWidth = messageText.width;
  const textHeight = messageText.height;
  const padding = 20;
  const rectWidth = textWidth + padding * 2;
  const rectHeight = textHeight + padding * 2;
  messageBackground.drawRect(-rectWidth / 2, -rectHeight / 2, rectWidth, rectHeight);
  messageBackground.endFill();
  messageBackground.x = CANVAS_SIZE / 2;
  messageBackground.y = CANVAS_SIZE / 2;

  const backgroundGlowFilter: GlowFilter = new GlowFilter({
    color: 0xff9500,
    outerStrength: 3,
    distance: 15,
    quality: 0.1,
  });
  messageBackground.filters = [backgroundGlowFilter];

  app.stage.addChild(messageBackground);
  app.stage.addChild(messageText);

  animateGlow(messageText, messageGlowFilter);
  animateGlow(messageBackground, backgroundGlowFilter);

  app.renderer.render(app.stage); // Force render to ensure the message appears
}

const resizeCanvas = () => {
  CANVAS_SIZE = calculateCanvasSize();
  cellSize = CANVAS_SIZE / GRID_SIZE;

  app.renderer.resize(CANVAS_SIZE, CANVAS_SIZE);
  drawGrid();
  updateHitArea();

  const newFontSize = calculateFontSize();
  [...xSymbols, ...oSymbols].forEach(({ text, row, col }) => {
    text.style.fontSize = newFontSize;
    text.x = col * cellSize + cellSize / 2;
    text.y = row * cellSize + cellSize / 2;
  });

  const childrenToKeep: PIXI.DisplayObject[] = [];
  const messagesToUpdate: PIXI.DisplayObject[] = [];
  app.stage.children.forEach(child => {
    if (child.name === 'message' || child.name === 'messageBackground') {
      messagesToUpdate.push(child);
    } else {
      childrenToKeep.push(child);
    }
  });

  messagesToUpdate.forEach(child => {
    if (child.name === 'message') {
      (child as PIXI.Text).style.fontSize = CANVAS_SIZE * 0.1;
      child.x = CANVAS_SIZE / 2;
      child.y = CANVAS_SIZE / 2;
    } else if (child.name === 'messageBackground') {
      child.x = CANVAS_SIZE / 2;
      child.y = CANVAS_SIZE / 2;
    }
  });

  console.log(`Canvas dimensions after resize: width=${app.view.width}, height=${app.view.height}`);
};

window.addEventListener('resize', resizeCanvas);
resizeCanvas();