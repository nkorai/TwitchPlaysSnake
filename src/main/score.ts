import { IpcMainInvokeEvent } from 'electron';
import { appPersistentStore } from '.';

const HIGH_SCORE_KEY = 'HIGH_SCORE_KEY';

export const setHighScore = async (
  _event: IpcMainInvokeEvent,
  highScore: number,
) => {
  appPersistentStore.set(HIGH_SCORE_KEY, highScore);
};

export const clearHighScore = async (_event: IpcMainInvokeEvent) => {
  appPersistentStore.set(HIGH_SCORE_KEY, 0);
};

export const getHighScore = async (_event: IpcMainInvokeEvent) => {
  return appPersistentStore.get(HIGH_SCORE_KEY, 0);
};
