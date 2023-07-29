// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// No Node.js APIs are available in this process unless
// nodeIntegration is set to true in webPreferences.
// Use preload.js to selectively enable features
// needed in the renderer process.
import { merge } from 'lodash';
import { ElectronAPI, GameCommand, hexToRgb } from './common';

declare global {
  interface Window { electronAPI: ElectronAPI; }
}

interface Config {
  cw: number;
  snakeSize: number;
}

interface Coordinates {
  x: number;
  y: number;
}

enum CellType {
  BACKGROUND,
  HEAD,
  TAIL,
  FOOD
}

const cellTypeToColorMap: Record<CellType, string> = {
  [CellType.BACKGROUND]: "C6D7A0",
  [CellType.HEAD]: "304321",
  [CellType.TAIL]: "527424",
  [CellType.FOOD]: "304321"
};

class Stage {
  width: number;
  height: number;
  snakeBodyPositions: Array<Coordinates>;
  food: Coordinates;
  score: number;
  direction: string;
  config: Config;

  constructor(canvas: HTMLCanvasElement, config: Config) {
      // Sets
      this.width     = canvas.width;
      this.height    = canvas.height;
      this.snakeBodyPositions    = [];
      this.food      = { x: 0, y: 0 };
      this.score     = 0;
      this.direction = 'right';
      this.config      = {
        cw: 10,
        snakeSize: 2
      };
    
      // Merge config      
      if (typeof config == 'object') {
        this.config = merge(config, this.config);
      }
  }
}

class Snake {
  stage: Stage;

  constructor(canvas: HTMLCanvasElement, config: Config, stage: Stage) {
    this.stage = stage;

    // Call init Snake
    this.initSnake();

    // Init Food
    this.initFood();
  }

  initFood() {
    // Add food on stage
    this.stage.food = {
      x: Math.round(Math.random() * (this.stage.width - this.stage.config.cw) / this.stage.config.cw),
      y: Math.round(Math.random() * (this.stage.height - this.stage.config.cw) / this.stage.config.cw),
    };
  }

  initSnake() {
    // Iteration in Snake config Size
    for (let i = 0; i < this.stage.config.snakeSize; i++) {

      // Add Snake Cells
      this.stage.snakeBodyPositions.push({x: i, y:0});
    }
  }

  resetGame() {
    this.stage.snakeBodyPositions            = [];
    this.stage.food              = {x: 0, y:0}
    this.stage.score             = 0;
    this.stage.direction         = 'right';
    this.initSnake();
    this.initFood();
  }
}

class Game {
  stage: Stage;
  snake: Snake;
  context: CanvasRenderingContext2D;

  constructor(canvas: HTMLCanvasElement, config?: Config) {
    this.stage = new Stage(canvas, config);
    this.snake = new Snake(canvas, config, this.stage);
    this.context = canvas.getContext("2d");
  }

  async beginGame(){
    await this.render(undefined, true);

    const onGameCommand = (_event: any, value: string): void => {
      // IIFE to return void
      void (async () => {
        const gameCommand = JSON.parse(value);
        for (let i = 0; i < gameCommand.distance; i++) {
          await this.render(gameCommand);
        }
      })();
    };

    window.electronAPI.onGameCommand(onGameCommand);
  }

  async render(gameCommand?: GameCommand, initialRenderPass?: boolean) {
      // Set Stage direction
      if (typeof(gameCommand) != 'undefined') {
        this.stage.direction = gameCommand.direction;
      }
  
      // Render White Stage
      const backgroundColorHex = cellTypeToColorMap[CellType.BACKGROUND];
      const { r, g, b } = hexToRgb(backgroundColorHex)

      this.context.fillStyle = `rgb(${r}, ${g}, ${b})`;
      this.context.fillRect(0, 0, this.stage.width, this.stage.height);
  
      // Snake Position
      let newX = this.stage.snakeBodyPositions[0].x;
      let newY = this.stage.snakeBodyPositions[0].y;
  
      // Add position by stage direction
      switch (this.stage.direction) {
        case 'right':
          newX++;
          break;
        case 'left':
          newX--;
          break;
        case 'up':
          newY--;
          break;
        case 'down':
          newY++;
          break;
      }
  
      // Check Collision
      if (this.collision(newX, newY, initialRenderPass) == true) {
        this.snake.resetGame();
        this.render(undefined, true);
        return;
      }
  
      // Logic of Snake food
      let tail: Coordinates;
      if (newX == this.stage.food.x && newY == this.stage.food.y) {
        tail = {x: newX, y: newY};
        this.stage.score++;
        if (this.stage.score > (await window.electronAPI.getHighScore())) {
          console.log('setting high score');
          await window.electronAPI.setHighScore(this.stage.score);
        }
  
        this.snake.initFood();
      } else {
        tail = this.stage.snakeBodyPositions.pop();
        tail.x   = newX;
        tail.y   = newY;
      }
      this.stage.snakeBodyPositions.unshift(tail);
  
      // Render Snake
      for (let i = 0; i < this.stage.snakeBodyPositions.length; i++) {
        const cell = this.stage.snakeBodyPositions[i];
        const snakeCellType = i === 0 ? CellType.HEAD : CellType.TAIL;
        this.drawCell(cell.x, cell.y, snakeCellType);
      }
  
      // Render Food
      this.drawCell(this.stage.food.x, this.stage.food.y, CellType.FOOD);
  
      await this.updateScore();
    }

    async updateScore() {
      const scoreElement = document.getElementById('score');
      const highScoreElement = document.getElementById('high_score');

      scoreElement.innerText = 'Score: ' + this.stage.score;
      highScoreElement.innerText = 'High Score: ' + await window.electronAPI.getHighScore();  
    }
    
    drawCell(x: number, y: number, cellType: CellType) {
      // Fill with gradient
      this.context.fillStyle = `#${cellTypeToColorMap[cellType]}`;
      this.context.fillRect((x * this.stage.config.cw + 6), (y * this.stage.config.cw + 6), 10, 10);
    }
  
    // Check Collision
    collision (nx: number, ny: number, initialRenderPass: boolean) {
      console.log(`Testing a collision nx: ${nx} ny: ${ny}`, this.snake.stage.snakeBodyPositions);
      const snakeHasHitTheSidesOfTheGame = nx == -1 || nx == (this.stage.width / this.stage.config.cw) || ny == -1 || ny == (this.stage.height / this.stage.config.cw);

      const currentTail = this.snake.stage.snakeBodyPositions[this.snake.stage.snakeBodyPositions.length - 1];
      const snakeHeadCollisions = this.snake.stage.snakeBodyPositions
        .filter((oldPosition) => !(oldPosition.x == currentTail.x && oldPosition.y == currentTail.y)) // Filter out the tail from all calculations because the head will always take up the tail position
        .filter((oldPosition) => oldPosition.x == nx && oldPosition.y == ny);
      
      const snakeHasRunIntoItself = !initialRenderPass && snakeHeadCollisions.length > 0;
      return snakeHasHitTheSidesOfTheGame || snakeHasRunIntoItself;
    }
}

/**
 * Window Load
 */
window.onload = async function() {
  const canvas = document.getElementById('game_board') as HTMLCanvasElement;

  const game = new Game(canvas);
  await game.beginGame();
};