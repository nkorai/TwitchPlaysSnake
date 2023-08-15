// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// No Node.js APIs are available in this process unless
// nodeIntegration is set to true in webPreferences.
// Use preload.js to selectively enable features
// needed in the renderer process.
import { IpcRendererEvent } from 'electron';
import { merge } from 'lodash';
// Import all of Bootstrap's JS
import 'bootstrap';
import ProgressBar from 'progressbar.js';
import {
  Configuration,
  Direction,
  ElectronAPI,
  GameCommand,
  GameMode,
  hexToRgb,
  toTitleCase,
  VotingSignal,
} from '../common';
import './scss/styles.scss';

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

interface Config {
  snakeSize: number;
  cellSize: number;
}

interface Coordinates {
  x: number;
  y: number;
}

enum CellType {
  BACKGROUND,
  HEAD,
  TAIL,
  FOOD,
}

const cellTypeToColorMap: Record<CellType, string> = {
  [CellType.BACKGROUND]: 'C6D7A0',
  [CellType.HEAD]: '304321',
  [CellType.TAIL]: '527424',
  [CellType.FOOD]: '304321',
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
    this.width = canvas.width;
    this.height = canvas.height;
    this.snakeBodyPositions = [];
    this.food = { x: 0, y: 0 };
    this.score = 0;
    this.direction = 'right';
    this.config = {
      snakeSize: 2,
      cellSize: 20,
    };

    // Merge config
    if (typeof config == 'object') {
      this.config = merge(config, this.config);
    }
  }
}

class Snake {
  stage: Stage;

  constructor(_canvas: HTMLCanvasElement, _config: Config, stage: Stage) {
    this.stage = stage;

    // Call init Snake
    this.initSnake();

    // Init Food
    this.initFood();
  }

  initFood() {
    // Add food on stage
    this.stage.food = {
      x: Math.round(
        (Math.random() * (this.stage.width - this.stage.config.cellSize)) /
          this.stage.config.cellSize,
      ),
      y: Math.round(
        (Math.random() * (this.stage.height - this.stage.config.cellSize)) /
          this.stage.config.cellSize,
      ),
    };
  }

  initSnake() {
    // Iteration in Snake config Size
    for (let i = 0; i < this.stage.config.snakeSize; i++) {
      // Add Snake Cells
      this.stage.snakeBodyPositions.push({ x: i, y: 0 });
    }
  }

  resetGame() {
    this.stage.snakeBodyPositions = [];
    this.stage.food = { x: 0, y: 0 };
    this.stage.score = 0;
    this.stage.direction = 'right';
    this.initSnake();
    this.initFood();
  }
}

interface RenderResult {
  thereWasACollision: boolean;
}

class Game {
  stage: Stage;
  snake: Snake;
  context: CanvasRenderingContext2D;

  constructor(canvas: HTMLCanvasElement, config?: Config) {
    this.stage = new Stage(canvas, config);
    this.snake = new Snake(canvas, config, this.stage);
    this.context = canvas.getContext('2d');
  }

  async beginGame() {
    await this.render(undefined, true);

    const onGameCommand = (_event: IpcRendererEvent, value: string): void => {
      // IIFE to return void
      void (async () => {
        const gameCommand = JSON.parse(value) as GameCommand;
        for (let i = 0; i < gameCommand.distance; i++) {
          const { thereWasACollision } = await this.render(gameCommand);
          if (thereWasACollision) {
            return;
          }
        }
      })();
    };

    const onVotingSignal = (_event: IpcRendererEvent, value: string): void => {
      const votingSignal = JSON.parse(value) as VotingSignal;
      const bufferMsToAllowForAnimation = 10;

      const container = document.getElementById('progress_bar_container');
      container.innerHTML = '';

      const bar = new ProgressBar.Line(container, {
        easing: 'linear',
        color: `#${cellTypeToColorMap[CellType.TAIL]}`,
        svgStyle: { width: 'calc(100% - 6px)', height: 'calc(100% - 6px)' },
      });

      bar.animate(1.0, {
        duration: votingSignal.durationMs - bufferMsToAllowForAnimation,
      });
    };

    window.electronAPI.onGameCommand(onGameCommand);
    window.electronAPI.onVotingSignal(onVotingSignal);

    // First voting render
    const firstVotingSignal: VotingSignal = {
      durationMs: (await window.electronAPI.getConfiguration()).voteDurationMs,
    };
    onVotingSignal(undefined as any, JSON.stringify(firstVotingSignal));
  }

  async render(
    gameCommand?: GameCommand,
    initialRenderPass?: boolean,
  ): Promise<RenderResult> {
    // Set Stage direction
    if (typeof gameCommand != 'undefined') {
      // If the game command says keep moving in the same direction, do not update the stage direction
      // Otherwise, use the game command input
      if (gameCommand.direction !== Direction.CONTINUE) {
        this.stage.direction = gameCommand.direction;
      }
    }

    // Render White Stage
    const backgroundColorHex = cellTypeToColorMap[CellType.BACKGROUND];
    const { r, g, b } = hexToRgb(backgroundColorHex);

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
      await this.render(undefined, true);
      return {
        thereWasACollision: true,
      };
    }

    // Logic of Snake food
    let tail: Coordinates;
    if (newX == this.stage.food.x && newY == this.stage.food.y) {
      tail = { x: newX, y: newY };
      this.stage.score++;
      if (this.stage.score > (await window.electronAPI.getHighScore())) {
        await window.electronAPI.setHighScore(this.stage.score);
      }

      this.snake.initFood();
    } else {
      tail = this.stage.snakeBodyPositions.pop();
      tail.x = newX;
      tail.y = newY;
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
    return {
      thereWasACollision: false,
    };
  }

  async updateScore() {
    const scoreElement = document.getElementById('score');
    const highScoreElement = document.getElementById('high_score');

    const scoreText = 'Score: ' + this.stage.score;
    const highScoreText =
      'High Score: ' + (await window.electronAPI.getHighScore());

    if (scoreElement.innerText != scoreText) {
      scoreElement.innerText = scoreText;
    }

    if (highScoreElement.innerText != highScoreText) {
      highScoreElement.innerText = highScoreText;
    }
  }

  drawCell(x: number, y: number, cellType: CellType) {
    // Fill with gradient
    const cellColor = `#${cellTypeToColorMap[cellType]}`;
    this.context.strokeStyle = cellColor;
    this.context.fillStyle = cellColor;
    this.context.beginPath();
    this.context.roundRect(
      x * this.stage.config.cellSize,
      y * this.stage.config.cellSize,
      this.stage.config.cellSize,
      this.stage.config.cellSize,
      6,
    );
    this.context.stroke();
    this.context.fill();
  }

  // Check Collision
  collision(nx: number, ny: number, initialRenderPass: boolean) {
    const snakeHasHitTheSidesOfTheGame =
      nx == -1 ||
      nx == this.stage.width / this.stage.config.cellSize ||
      ny == -1 ||
      ny == this.stage.height / this.stage.config.cellSize;

    const currentTail =
      this.snake.stage.snakeBodyPositions[
        this.snake.stage.snakeBodyPositions.length - 1
      ];
    const snakeHeadCollisions = this.snake.stage.snakeBodyPositions
      .filter(
        (oldPosition) =>
          !(oldPosition.x == currentTail.x && oldPosition.y == currentTail.y),
      ) // Filter out the tail from all calculations because the head will always take up the tail position
      .filter((oldPosition) => oldPosition.x == nx && oldPosition.y == ny);

    const snakeHasRunIntoItself =
      !initialRenderPass && snakeHeadCollisions.length > 0;
    return snakeHasHitTheSidesOfTheGame || snakeHasRunIntoItself;
  }
}

enum Screen {
  GAME,
  CONFIGURATION,
}

const displayScreen = async (screen: Screen): Promise<void> => {
  const configuration = await window.electronAPI.getConfiguration();

  const gameScreen = document.getElementById('game_screen') as HTMLDivElement;
  const configurationScreen = document.getElementById(
    'configuration_screen',
  ) as HTMLDivElement;

  const configurationInputs = document.getElementById(
    'configuration_inputs',
  ) as HTMLDivElement;

  switch (screen) {
    case Screen.GAME:
      gameScreen.style.display = 'block';
      configurationScreen.style.display = 'none';
      break;
    case Screen.CONFIGURATION:
      gameScreen.style.display = 'none';
      configurationScreen.style.display = 'block';

      configurationInputs.innerHTML = '';

      const configurationInputsDefinitions: Record<
        keyof Configuration,
        {
          id: string;
          title: string;
          placeholder?: string;
          min?: number;
          max?: number;
          displayConfigOption: boolean;
          type: 'text' | 'number' | 'GameMode';
        }
      > = {
        channelName: {
          id: 'configuration_channel_name',
          displayConfigOption: true,
          type: 'text',
          placeholder: 'sadboifeverdreamz',
          title: 'Channel Name',
        },
        gameMode: {
          id: 'configuration_game_mode',
          displayConfigOption: true,
          type: 'GameMode',
          title: 'Game Mode',
        },
        minGameChatDistance: {
          id: 'configuration_min_chat_distance',
          displayConfigOption: true,
          type: 'number',
          title: 'Minimum Chat Distance',
        },
        maxGameChatDistance: {
          id: 'configuration_max_chat_distance',
          displayConfigOption: true,
          type: 'number',
          title: 'Maximum Chat Distance',
        },
        voteDurationMs: {
          id: 'configuration_vote_duration_ms',
          displayConfigOption: true,
          type: 'number',
          title: 'Vote Duration (ms)',
        },
      };

      const addTextBoxInput = (inputDefinitionKey: keyof Configuration) => {
        const inputDefinition =
          configurationInputsDefinitions[inputDefinitionKey];
        const inputElement = document.createElement('input');
        inputElement.id = inputDefinition.id;
        inputElement.placeholder = inputDefinition.placeholder;
        inputElement.type = inputDefinition.type;
        inputElement.min = inputDefinition.min?.toString();
        inputElement.max = inputDefinition.max?.toString();

        inputElement.onchange = async (event: Event) => {
          const inputValue = (event.target as any).value as string;
          const configuration = await window.electronAPI.getConfiguration();
          (configuration as any)[inputDefinitionKey] = inputValue;
          await window.electronAPI.setConfiguration(configuration);
        };

        inputElement.value = (configuration as any)[inputDefinitionKey] || '';

        configurationInputs.appendChild(inputElement);
      };

      const addGameModeSelection = async (
        inputDefinitionKey: keyof Configuration,
      ) => {
        const possibleGameModes = Object.values(GameMode);
        for (let i = 0; i < possibleGameModes.length; i++) {
          const gameModeValue = possibleGameModes[i];

          const formCheck = document.createElement('div');
          formCheck.classList.add('form-check');
          if (i > 0) {
            formCheck.classList.add('form-check-inline');
          }

          const formCheckInput = document.createElement('input');
          formCheckInput.classList.add('form-check-input');
          formCheckInput.type = 'radio';
          formCheckInput.name = 'flexRadioDefault';
          formCheckInput.id = `flexRadio${gameModeValue}`;
          const configuration = await window.electronAPI.getConfiguration();
          const currentGameMode = configuration.gameMode;
          formCheckInput.checked = currentGameMode === gameModeValue;
          formCheckInput.onchange = async (event: Event) => {
            const inputValue = document.getElementById(
              `flexRadio${GameMode.STATIC}`,
            ) as HTMLInputElement;
            const gameModeInEffect = inputValue.checked
              ? GameMode.STATIC
              : GameMode.CONTINUOUS;
            const configuration = await window.electronAPI.getConfiguration();
            (configuration as any)[inputDefinitionKey] = gameModeInEffect;
            await window.electronAPI.setConfiguration(configuration);
          };
          formCheck.appendChild(formCheckInput);

          const formCheckLabel = document.createElement('label');
          formCheckLabel.classList.add('form-check-label');
          (formCheckLabel as any).for = `flexRadio${gameModeValue}`;
          formCheckLabel.innerText = toTitleCase(gameModeValue);
          formCheck.appendChild(formCheckLabel);

          configurationInputs.appendChild(formCheck);
        }
      };

      for (const inputDefinitionKey of Object.keys(
        configurationInputsDefinitions,
      ) as Array<keyof Configuration>) {
        const inputDefinition =
          configurationInputsDefinitions[inputDefinitionKey];

        const title = document.createElement('h6');
        title.innerText = inputDefinition.title;
        configurationInputs.appendChild(title);

        if (
          inputDefinition.type === 'text' ||
          inputDefinition.type === 'number'
        ) {
          addTextBoxInput(inputDefinitionKey);
        } else if (inputDefinition.type === 'GameMode') {
          await addGameModeSelection(inputDefinitionKey);
        }
      }

      break;
    default:
      throw Error('Unexpected display screen command received');
  }
};

const wireUpButtons = (): void => {
  const configurationButton = document.getElementById(
    'configuration_button',
  ) as HTMLButtonElement;

  const backToMainButton = document.getElementById(
    'back_to_main_button',
  ) as HTMLButtonElement;

  const resetHighScoreButton = document.getElementById(
    'reset_high_score_button',
  ) as HTMLButtonElement;

  configurationButton.onclick = async () => {
    await displayScreen(Screen.CONFIGURATION);
  };

  backToMainButton.onclick = async () => {
    const { channelName } = await window.electronAPI.getConfiguration();
    if (!channelName) {
      return;
    }

    await displayScreen(Screen.GAME);
  };

  resetHighScoreButton.onclick = async () => {
    await window.electronAPI.clearHighScore();
  };
};
/**
 * Window Load
 */
window.onload = async function () {
  const canvas = document.getElementById('game_board') as HTMLCanvasElement;

  wireUpButtons();

  // For fresh launches of the game, check if there is a base configuration and if there isn't send to the configuration
  const configuration = await window.electronAPI.getConfiguration();
  if (!configuration.channelName) {
    displayScreen(Screen.CONFIGURATION);
  } else {
    displayScreen(Screen.GAME);
  }

  const game = new Game(canvas);
  await game.beginGame();
};
