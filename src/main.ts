import { app, BrowserWindow, ipcMain } from 'electron';
import Store from 'electron-store';
import * as path from 'path';
import * as tmi from 'tmi.js';
import { IpcEventString } from './common';
import { getConfiguration, setConfiguration } from './config';
import { processBuffer, processInputToBuffer } from './inputs';
import { getHighScore, setHighScore } from './score';
import * as secrets from './utils/secrets.json';

export let mainWindow: BrowserWindow;

export const appPersistentStore = new Store();

// Setup connection configurations
// These include the channel, username and password
const client = new tmi.Client({
  options: { debug: true, messagesLogLevel: 'info' },
  connection: {
    reconnect: true,
    secure: true,
  },
  identity: {
    username: secrets.twitchBotUsername,
    password: secrets.twitchPassword,
  },
  channels: [secrets.twitchChannelName],
});

// Connect to the channel specified using the setings found in the configurations
// Any error found shall be logged out in the console
client.connect().catch(console.error);

// We shall pass the parameters which shall be required
client.on(
  'message',
  (
    _channel: string,
    userstate: tmi.ChatUserstate,
    message: string,
    self: boolean,
  ) => {
    // Lack of this statement or it's inverse (!self) will make it in active
    if (self) return;

    const canUpdateGameState =
      userstate.badges?.admin === '1' ||
      userstate.badges?.broadcaster === '1' ||
      userstate.badges?.moderator === '1';
    processInputToBuffer(message, canUpdateGameState);
  },
);

function createWindow() {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    height: 610,
    width: 370,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: true,
    },
    alwaysOnTop: true,
    backgroundColor: '#000',
    frame: false,
  });

  // and load the index.html of the app.
  mainWindow
    .loadFile(path.join(__dirname, '../index.html'))
    .catch(() => console.log('Unable to load index.html'));
  ipcMain.handle(IpcEventString.SET_HIGH_SCORE, setHighScore);
  ipcMain.handle(IpcEventString.GET_HIGH_SCORE, getHighScore);
  ipcMain.handle(IpcEventString.SET_CONFIGURATION, setConfiguration);
  ipcMain.handle(IpcEventString.GET_CONFIGURATION, getConfiguration);
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app
  .whenReady()
  .then(() => {
    createWindow();

    setInterval(processBuffer, getConfiguration().voteDurationMs);

    app.on('activate', function () {
      // On macOS it's common to re-create a window in the app when the
      // dock icon is clicked and there are no other windows open.
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  })
  .catch(() => console.log('Unable to initialize'));

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
