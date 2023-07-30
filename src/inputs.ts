import {
  Direction,
  GameCommand,
  GameMode,
  IpcEventString,
  VotingSignal,
} from './common';
import { Config } from './config';
import { mainWindow } from './main';

const MIN_GAME_CHAT_DISTANCE = 1;
const MAX_GAME_CHAT_DISTANCE = 10;

const inputBuffer: Array<GameCommand> = [];

/* This is the entrypoint for all incoming game chat messages */
export const processInputToBuffer = (
  inputString: string,
  canUpdateGameState: boolean,
): void => {
  if (!inputString.toLowerCase().startsWith('sg:')) {
    return;
  }

  if (
    inputString.toLowerCase().startsWith('sg:gamemode:') &&
    canUpdateGameState
  ) {
    const inputGameMode = inputString.replace('sg:gamemode:', '') as GameMode;
    if (Object.values(GameMode).includes(inputGameMode)) {
      Config.gameMode = inputGameMode;
    }
  }

  // sg:right, sg:right5, sg:left, sg:left7, sg:up, sg:down
  const directionAndDistanceString = inputString
    .split(':')[1]
    .replace(/\s/g, '');
  const chatCommandMatchGroups =
    directionAndDistanceString.match(/([a-zA-Z]+)(-?\d+)?/);
  if (chatCommandMatchGroups.length != 3) {
    return;
  }

  const directionString = chatCommandMatchGroups[1];
  const distanceString = chatCommandMatchGroups[2] || '1';

  let direction: Direction | undefined = undefined;
  switch (directionString.toLowerCase()) {
    case 'left':
      direction = Direction.LEFT;
      break;
    case 'right':
      direction = Direction.RIGHT;
      break;
    case 'up':
      direction = Direction.UP;
      break;
    case 'down':
      direction = Direction.DOWN;
      break;
    default:
      return;
  }

  let distanceInteger = parseInt(distanceString);
  // Clamp down the values between the minimum and maximum distance values
  distanceInteger = Math.min(distanceInteger, MAX_GAME_CHAT_DISTANCE);
  distanceInteger = Math.max(distanceInteger, MIN_GAME_CHAT_DISTANCE);

  const distanceIsValid =
    distanceInteger >= MIN_GAME_CHAT_DISTANCE &&
    distanceInteger <= MAX_GAME_CHAT_DISTANCE;
  if (!distanceIsValid) {
    return;
  }

  inputBuffer.push(new GameCommand(direction, distanceInteger));
};

const emitVotingSignal = (): void => {
  const votingSignal: VotingSignal = {
    durationMs: Config.voteDurationMs,
  };

  mainWindow.webContents.send(
    IpcEventString.VOTE_PERIOD_STARTED,
    JSON.stringify(votingSignal),
  );
};

export const processBuffer = (): void => {
  emitVotingSignal();

  const popularityKeyToGameCommand: { [popularityKey: string]: GameCommand } =
    {};
  const popularityMap: { [popularityKey: string]: number } = {};

  let gameCommandToExecute;
  // Copy the curernt buffer and empty out the input buffer
  const currentBuffer = inputBuffer.splice(0, inputBuffer.length);
  if (currentBuffer.length > 0) {
    // De-duplicated input commands by popularity hits
    for (let i = 0; i < currentBuffer.length; i++) {
      const gameCommand = currentBuffer[i];
      const popularityKey = gameCommand.toPopularityString();
      if (!popularityMap[popularityKey]) {
        popularityMap[popularityKey] = 0;
      }
      popularityMap[popularityKey]++;
      popularityKeyToGameCommand[popularityKey] = gameCommand;
    }

    // Figure out the most popular command TODO: can be done in the above loop
    let mostPopularKey = Object.keys(popularityMap)[0];
    for (const popularityKey of Object.keys(popularityMap)) {
      if (popularityMap[popularityKey] > popularityMap[mostPopularKey]) {
        mostPopularKey = popularityKey;
      }
    }
    gameCommandToExecute = popularityKeyToGameCommand[mostPopularKey];
  } else if (Config.gameMode === GameMode.CONTINUOUS) {
    gameCommandToExecute = new GameCommand(Direction.CONTINUE, 1);
  } else {
    return;
  }

  mainWindow.webContents.send(
    IpcEventString.GAME_COMMAND,
    JSON.stringify(gameCommandToExecute),
  );
};
