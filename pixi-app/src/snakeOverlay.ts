import * as PIXI from 'pixi.js';
import './style.css';

const snakeOverlay = document.getElementById('snakeOverlay') as HTMLDivElement;

// Determine canvas size based on screen dimensions
const maxCanvasSize = 620; // Maximum size for larger screens
const minCanvasSize = 250; // Reduced for smaller screens (smartphones)
const padding = 10; // Reduced padding to fit better on small screens

// Calculate canvas size based on the smaller dimension (to maintain square aspect ratio)
const calculateCanvasSize = (): number => {
  const windowWidth = window.innerWidth - padding;
  const windowHeight = window.innerHeight - padding;
  // Ensure the canvas size is constrained by the viewport width
  const maxSizeByWidth = Math.min(windowWidth, windowHeight); // Use the smaller dimension
  const size = Math.max(minCanvasSize, Math.min(maxCanvasSize, maxSizeByWidth));
  console.log(`SnakeOverlay CANVAS_SIZE: ${size}, windowWidth: ${windowWidth}, windowHeight: ${windowHeight}`);
  return size;
};

let CANVAS_SIZE = calculateCanvasSize();

// Initialize PixiJS application with dynamic size
const snakeApp = new PIXI.Application({
  width: CANVAS_SIZE,
  height: CANVAS_SIZE,
  backgroundAlpha: 0, // Transparent background
  antialias: true,
  resizeTo: undefined, // We’ll handle resizing manually
});

if (snakeOverlay) {
  snakeOverlay.innerHTML = ''; // Clear any existing canvases
  snakeOverlay.appendChild(snakeApp.view as HTMLCanvasElement);
}

// Snake setup
const snakeSegments: PIXI.Graphics[] = [];
const snakeLength = 10;

// Scale segment size based on canvas size (e.g., 1% of canvas size)
let segmentSize = CANVAS_SIZE * 0.01; // Adjust multiplier as needed (0.01 = 1% of canvas size)
for (let i = 0; i < snakeLength; i++) {
  const segment = new PIXI.Graphics();
  segment.beginFill(0xff00ff);
  segment.drawRect(0, 0, segmentSize, segmentSize);
  segment.endFill();
  snakeApp.stage.addChild(segment);
  snakeSegments.push(segment);
}

let snakeProgress = 0;
const speed = 2; // Adjust this to control actual speed

snakeApp.ticker.add((delta) => {
  snakeProgress += speed * delta;

  for (let i = 0; i < snakeSegments.length; i++) {
    const p = (snakeProgress - i * 10) % (2 * (CANVAS_SIZE - segmentSize + CANVAS_SIZE - segmentSize));
    const pos = getSnakePerimeterPosition(p);
    snakeSegments[i].x = pos.x;
    snakeSegments[i].y = pos.y;
  }
});

// Snake movement path around the canvas border
function getSnakePerimeterPosition(step: number): { x: number; y: number } {
  const width = CANVAS_SIZE - segmentSize;
  const height = CANVAS_SIZE - segmentSize;
  const perimeter = 2 * (width + height);
  step %= perimeter;

  if (step < width) return { x: step, y: 0 }; // Top edge
  else if (step < width + height) return { x: width, y: step - width }; // Right edge
  else if (step < 2 * width + height) return { x: 2 * width + height - step, y: height }; // Bottom edge
  else return { x: 0, y: perimeter - step }; // Left edge
}

// Handle window resize to make the canvas responsive
const resizeCanvas = () => {
  CANVAS_SIZE = calculateCanvasSize();

  // Resize the PixiJS application
  snakeApp.renderer.resize(CANVAS_SIZE, CANVAS_SIZE);

  // Adjust segment sizes on resize
  segmentSize = CANVAS_SIZE * 0.01;
  snakeSegments.forEach(segment => {
    segment.clear();
    segment.beginFill(0xff00ff);
    segment.drawRect(0, 0, segmentSize, segmentSize);
    segment.endFill();
  });
};

// Add resize event listener
window.addEventListener('resize', resizeCanvas);

// Initial resize to ensure correct sizing on load
resizeCanvas();