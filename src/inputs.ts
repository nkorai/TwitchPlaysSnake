import {
  Direction,
  GameCommand,
  GameMode,
  IpcEventString,
  VotingSignal,
} from './common';
import { Config } from './config';
import { mainWindow } from './main';

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
  distanceInteger = Math.min(distanceInteger, Config.maxGameChatDistance);
  distanceInteger = Math.max(distanceInteger, Config.minGameChatDistance);

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
