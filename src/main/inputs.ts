import { mainWindow } from '.';
import {
  Direction,
  GameCommand,
  GameMode,
  IpcEventString,
  VotingSignal,
} from '../common';
import { getConfiguration, setConfiguration } from './config';

const inputBuffer: Array<GameCommand> = [];

interface ProcessInputBufferResponse {
  isGameMessage: boolean;
}

/* This is the entrypoint for all incoming game chat messages */
export const processInputToBuffer = (
  inputString: string,
  canUpdateGameState: boolean,
): ProcessInputBufferResponse => {
  if (!inputString.toLowerCase().startsWith('sg:')) {
    return {
      isGameMessage: false,
    };
  }

  if (
    inputString.toLowerCase().startsWith('sg:gamemode:') &&
    canUpdateGameState
  ) {
    const inputGameMode = inputString.replace('sg:gamemode:', '') as GameMode;
    if (Object.values(GameMode).includes(inputGameMode)) {
      const persistentConfiguration = getConfiguration();
      persistentConfiguration.gameMode = inputGameMode;
      setConfiguration(undefined, persistentConfiguration);
      return {
        isGameMessage: true,
      };
    }
  }

  // sg:right, sg:right5, sg:left, sg:left7, sg:up, sg:down
  const directionAndDistanceString = inputString
    .split(':')[1]
    .replace(/\s/g, '');
  const chatCommandMatchGroups =
    directionAndDistanceString.match(/([a-zA-Z]+)(-?\d+)?/);
  if (!chatCommandMatchGroups || chatCommandMatchGroups.length != 3) {
    return {
      isGameMessage: false,
    };
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
      return {
        isGameMessage: false,
      };
  }

  let distanceInteger = parseInt(distanceString);

  // Clamp down the values between the minimum and maximum distance values
  distanceInteger = Math.min(
    distanceInteger,
    getConfiguration().maxGameChatDistance,
  );
  distanceInteger = Math.max(
    distanceInteger,
    getConfiguration().minGameChatDistance,
  );

  inputBuffer.push(new GameCommand(direction, distanceInteger));
  return {
    isGameMessage: true,
  };
};

const emitVotingSignal = (): void => {
  const votingSignal: VotingSignal = {
    durationMs: getConfiguration().voteDurationMs,
  };

  mainWindow.webContents.send(
    IpcEventString.VOTE_PERIOD_STARTED,
    JSON.stringify(votingSignal),
  );
};

interface PopularityReduction {
  gameCommand: GameCommand;
  popularity: number;
}

export const processBuffer = (): void => {
  emitVotingSignal();

  let gameCommandToExecute: GameCommand;
  // Copy the curernt buffer and empty out the input buffer
  const currentBuffer = inputBuffer.splice(0, inputBuffer.length);
  if (currentBuffer.length > 0) {
    const reductionRecords: Record<string, PopularityReduction> = {};
    // Group game commands by popularity, add counts
    currentBuffer.reduce(
      (
        _acc: Record<string, PopularityReduction>,
        curr: GameCommand,
        _index: number,
        _arr: GameCommand[],
      ) => {
        const key = curr.toPopularityString();
        if (!reductionRecords[key]) {
          reductionRecords[key] = {
            gameCommand: curr,
            popularity: 0,
          };
        }

        reductionRecords[key].popularity++;
        return reductionRecords;
      },
      reductionRecords,
    );

    // Sort by most popular descending, get first in array (most popular)
    const popularityCommand = Object.values(reductionRecords).sort(
      (reductionA: PopularityReduction, reductionB: PopularityReduction) =>
        reductionB.popularity - reductionA.popularity,
    )[0];
    gameCommandToExecute = popularityCommand.gameCommand;
  } else if (getConfiguration().gameMode === GameMode.CONTINUOUS) {
    gameCommandToExecute = new GameCommand(
      Direction.CONTINUE,
      getConfiguration().minGameChatDistance,
    );
  } else {
    return;
  }

  mainWindow.webContents.send(
    IpcEventString.GAME_COMMAND,
    JSON.stringify(gameCommandToExecute),
  );
};
