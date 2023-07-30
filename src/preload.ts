// All of the Node.js APIs are available in the preload process.

import { contextBridge, ipcRenderer } from 'electron';
import {
  ElectronAPI,
  IpcEventString,
  OnMainCommandCallbackFunction,
} from './common';

// It has the same sandbox as a Chrome extension.
window.addEventListener('DOMContentLoaded', () => {
  const electronAPI: ElectronAPI = {
    onGameCommand: (callback: OnMainCommandCallbackFunction) =>
      ipcRenderer.on(IpcEventString.GAME_COMMAND, callback),
    onVotingSignal: (callback: OnMainCommandCallbackFunction) =>
      ipcRenderer.on(IpcEventString.VOTE_PERIOD_STARTED, callback),
    setHighScore: async (highScore: number) =>
      ipcRenderer.invoke(IpcEventString.SET_HIGH_SCORE, highScore),
    getHighScore: async () => ipcRenderer.invoke(IpcEventString.GET_HIGH_SCORE),
  };
  contextBridge.exposeInMainWorld('electronAPI', electronAPI);
});
