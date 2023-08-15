import 'bootstrap';
import { ElectronAPI } from '../common';
import { displayConfigurationScreen } from './screenConfiguration';
import './scss/styles.scss';
import { displaySnakeScreen, Game } from './sreenSnake';

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

enum Screen {
  GAME,
  CONFIGURATION,
}

const displayScreen = async (screen: Screen): Promise<void> => {
  switch (screen) {
    case Screen.GAME:
      await displaySnakeScreen();
      break;
    case Screen.CONFIGURATION:
      await displayConfigurationScreen();
      break;
    default:
      throw Error('Unexpected display screen command received');
  }
};

// This can be broken up into the requisite screens
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
    await displayScreen(Screen.CONFIGURATION);
  } else {
    await displayScreen(Screen.GAME);
  }

  const game = new Game(canvas);
  await game.beginGame();
};
