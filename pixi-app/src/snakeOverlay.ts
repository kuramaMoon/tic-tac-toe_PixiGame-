import * as PIXI from 'pixi.js';
import './style.css';

// Ensure the DOM is fully loaded before running the script
document.addEventListener('DOMContentLoaded', () => {
  const snakeOverlay = document.getElementById('snakeOverlay') as HTMLDivElement;
  if (!snakeOverlay) {
    console.error("snakeOverlay element not found in the DOM.");
    return;
  }
  console.log("snakeOverlay element found:", snakeOverlay);

  // Determine canvas size based on screen dimensions
  const maxCanvasSize = 620; // Maximum size for larger screens
  const minCanvasSize = 250; // Reduced for smaller screens (smartphones)
  const padding = 30; // Reduced padding to fit better on small screens

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

  // Append the canvas to the snakeOverlay element
  snakeOverlay.innerHTML = ''; // Clear any existing canvases
  snakeOverlay.appendChild(snakeApp.view as HTMLCanvasElement);
  console.log("Snake canvas appended to snakeOverlay:", snakeApp.view);

  // Snake setup
  const snakeSegments: PIXI.Graphics[] = [];
  const snakeLength = 10;

  // Scale segment size based on canvas size (e.g., 2% of canvas size for better visibility)
  let segmentSize = CANVAS_SIZE * 0.02; // Increased from 0.01 to 0.02 for visibility
  for (let i = 0; i < snakeLength; i++) {
    const segment = new PIXI.Graphics();
    segment.beginFill(0xff00ff); // Neon magenta
    segment.drawRect(0, 0, segmentSize, segmentSize);
    segment.endFill();
    snakeApp.stage.addChild(segment);
    snakeSegments.push(segment);
    console.log(`Snake segment ${i} created at size ${segmentSize}x${segmentSize}`);
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
      // Log position of the first segment for debugging
      if (i === 0) {
        console.log(`Snake segment 0 position: x=${pos.x}, y=${pos.y}`);
      }
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
    segmentSize = CANVAS_SIZE * 0.01; // Update segment size
    snakeSegments.forEach(segment => {
      segment.clear();
      segment.beginFill(0xff00ff);
      segment.drawRect(0, 0, segmentSize, segmentSize);
      segment.endFill();
    });
    console.log(`Snake canvas resized to ${CANVAS_SIZE}x${CANVAS_SIZE}, segmentSize: ${segmentSize}`);
  };

  // Add resize event listener
  window.addEventListener('resize', resizeCanvas);

  // Initial resize to ensure correct sizing on load
  resizeCanvas();
});