import { ApiClient } from '@twurple/api';
import { ElectronAuthProvider } from '@twurple/auth-electron';
import { ChatClient, PrivateMessage } from '@twurple/chat';
import { app, BrowserWindow, ipcMain } from 'electron';
import Store from 'electron-store';
import * as path from 'path';
import { IpcEventString } from './common';
import { getConfiguration, setConfiguration } from './config';
import { processBuffer, processInputToBuffer } from './inputs';
import { getHighScore, setHighScore } from './score';

export let mainWindow: BrowserWindow;
export const appPersistentStore = new Store();

const clientId = 'ik8s2f4mbxkgmgz9gfffjq6r2xcrww';
const redirectUri = 'http://localhost/login';

const authProvider = new ElectronAuthProvider({
  clientId,
  redirectUri,
});

const apiClient = new ApiClient({
  authProvider,
});

// Setup connection configurations
// These include the channel, username and password
let chatClient: ChatClient | undefined = undefined;

export const initializeChatClient = (): void => {
  const channelName = getConfiguration().channelName;
  if (!channelName) {
    return;
  }

  if (chatClient) {
    chatClient.quit();
  }

  chatClient = new ChatClient({
    channels: [channelName],
  });

  chatClient.connect().catch(console.log);
  chatClient.quit;
  // We shall pass the parameters which shall be required
  chatClient.onMessage(
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    async (
      _channel: string,
      _user: string,
      text: string,
      msg: PrivateMessage,
    ) => {
      const canUpdateGameState =
        msg.userInfo.isBroadcaster || msg.userInfo.isMod;
      const processInputToBufferResponse = processInputToBuffer(
        text,
        canUpdateGameState,
      );
      if (processInputToBufferResponse.isGameMessage) {
        await apiClient.moderation.deleteChatMessages(
          msg.channelId,
          msg.channelId,
          msg.id,
        );
      }
    },
  );
};

function createWindow() {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    height: 640,
    width: 370,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: true,
    },
    alwaysOnTop: true,
    frame: false,
    backgroundColor: '#000',
    maximizable: false,
    movable: true,
  });

  // and load the index.html of the app.
  mainWindow
    .loadFile(path.join(__dirname, '../index.html'))
    .catch(() => console.log('Unable to load index.html'));

  ipcMain.handle(IpcEventString.SET_HIGH_SCORE, setHighScore);
  ipcMain.handle(IpcEventString.GET_HIGH_SCORE, getHighScore);
  ipcMain.handle(IpcEventString.SET_CONFIGURATION, setConfiguration);
  ipcMain.handle(IpcEventString.GET_CONFIGURATION, getConfiguration);

  // Attempt chat initialization as soon as the game starts
  initializeChatClient();
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
