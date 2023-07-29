// All of the Node.js APIs are available in the preload process.

import { ipcRenderer, contextBridge, IpcRendererEvent } from "electron";
import { ElectronAPI, OnGameCommandCallbackFunction } from "./common";

// It has the same sandbox as a Chrome extension.
window.addEventListener("DOMContentLoaded", () => {
  const electronAPI: ElectronAPI = {
    onGameCommand: (callback: OnGameCommandCallbackFunction) => ipcRenderer.on('gameCommand', callback),
    setHighScore: async (highScore: number) => ipcRenderer.invoke('setHighScore', highScore),
    getHighScore: async () => ipcRenderer.invoke('getHighScore'),
  };
  contextBridge.exposeInMainWorld('electronAPI', electronAPI);
});
