import { IpcRendererEvent } from 'electron';

export type OnMainCommandCallbackFunction = (
  event: IpcRendererEvent,
  jsonStringValue: string,
) => void;

export interface ElectronAPI {
  onGameCommand: (
    callback: OnMainCommandCallbackFunction,
  ) => Electron.IpcRenderer;
  onVotingSignal: (
    callback: OnMainCommandCallbackFunction,
  ) => Electron.IpcRenderer;
  setHighScore: (highScore: number) => Promise<any>;
  getHighScore: () => Promise<number>;
  clearHighScore: () => Promise<any>;
  setConfiguration: (configuration: Configuration) => Promise<any>;
  getConfiguration: () => Promise<Configuration>;
}

export enum Direction {
  LEFT = 'left',
  RIGHT = 'right',
  UP = 'up',
  DOWN = 'down',
  CONTINUE = 'continue',
}

export class GameCommand {
  direction: Direction;
  distance: number;

  constructor(direction: Direction, distance: number) {
    this.direction = direction;
    this.distance = distance;
  }

  /** Generates a popularity string that can be used to group game commands to ascertain popularity */
  toPopularityString(): string {
    return `${this.direction}${this.distance}`.toLowerCase();
  }
}

interface RgbResult {
  r: number;
  g: number;
  b: number;
}

export const hexToRgb = (hex: string): RgbResult => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) {
    throw Error('Unable to parse hex to RGB');
  }

  return {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  };
};

export enum GameMode {
  STATIC = 'static',
  CONTINUOUS = 'continuous',
}

export interface VotingSignal {
  durationMs: number;
}

export enum IpcEventString {
  GAME_COMMAND = 'gameCommand',
  SET_HIGH_SCORE = 'setHighScore',
  CLEAR_HIGH_SCORE = 'clearHighScore',
  GET_HIGH_SCORE = 'getHighScore',
  VOTE_PERIOD_STARTED = 'votePeriodStarted',
  GET_CONFIGURATION = 'getConfiguration',
  SET_CONFIGURATION = 'setConfiguration',
}

export interface Configuration {
  channelName: string;
  voteDurationMs: number;
  minGameChatDistance: number;
  maxGameChatDistance: number;
  gameMode: GameMode;
}
