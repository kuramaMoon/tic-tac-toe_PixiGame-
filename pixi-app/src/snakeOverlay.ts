import * as PIXI from 'pixi.js';
import './style.css';

const CANVAS_WIDTH = 620;
const CANVAS_HEIGHT = 620;

const snakeOverlay = document.getElementById('snakeOverlay') as HTMLDivElement;
const snakeApp = new PIXI.Application({
  width: CANVAS_WIDTH,
  height: CANVAS_HEIGHT,
  backgroundAlpha: 0, // transparent background
  antialias: true,
});
if (snakeOverlay) {
  snakeOverlay.appendChild(snakeApp.view as HTMLCanvasElement);
}

// Snake setup (same style as before)
const snakeSegments: PIXI.Graphics[] = [];
const snakeLength = 10;
const segmentSize = 6;
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
    const p = (snakeProgress - i * 10) % (2 * (CANVAS_WIDTH - 5 + CANVAS_HEIGHT - 5));
    const pos = getSnakePerimeterPosition(p);
    snakeSegments[i].x = pos.x;
    snakeSegments[i].y = pos.y;
  }
});

// Snake movement path around the canvas border
function getSnakePerimeterPosition(step: number): { x: number; y: number } {
    const width = CANVAS_WIDTH - 5 ;
    const height = CANVAS_HEIGHT - 5;
    const perimeter = 2 * (width + height);
    step %= perimeter;
  

    if (step < width) return { x: step, y: 0 }; // Top edge
    else if (step < width + height) return { x: width, y: step - width }; // Right edge
    else if (step < 2 * width + height) return { x: 2 * width + height - step, y: height }; // Bottom edge
    else ; return { x: 0, y: perimeter - step }; // Left edge
  }
