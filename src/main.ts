import { app, BrowserWindow, ipcMain, IpcMainInvokeEvent } from "electron";
import * as path from "path";
import * as secrets from "./utils/secrets.json"
import * as tmi from "tmi.js";
import Store from 'electron-store';
import { Direction, GameCommand } from "./common";

let mainWindow: BrowserWindow;

export const appPersistentStore = new Store();
const HIGH_SCORE_KEY = "HIGH_SCORE_KEY";

async function setHighScore (_event: IpcMainInvokeEvent, highScore: number) {
  appPersistentStore.set(HIGH_SCORE_KEY, highScore);
}

async function getHighScore (_event: IpcMainInvokeEvent) {
  return appPersistentStore.get(HIGH_SCORE_KEY, 0);
}

const MIN_GAME_CHAT_DISTANCE = 1;
const MAX_GAME_CHAT_DISTANCE = 10;

const inputBuffer: Array<GameCommand> = [];

/* This is the entrypoint for all incoming game chat messages */
const processInputToBuffer = (inputString: string): void => {
  if (!inputString.startsWith("sg:")) {
    return;
  }

  // sg:right, sg:right5, sg:left, sg:left7, sg:up, sg:down
  const directionAndDistanceString = inputString.split(":")[1].replace(/\s/g, '');
  const chatCommandMatchGroups = directionAndDistanceString.match(/([a-zA-Z]+)(-?\d+)?/);
  if (chatCommandMatchGroups.length != 3) {
    return;
  }

  const directionString = chatCommandMatchGroups[1];
  const distanceString = chatCommandMatchGroups[2] || "1";

  let direction: Direction | undefined = undefined;
  switch (directionString.toLowerCase()) {
    case "left":
        direction = Direction.LEFT;
        break;
    case "right":
        direction = Direction.RIGHT;
        break;
    case "up":
        direction = Direction.UP;
        break;
    case "down":
        direction = Direction.DOWN;
        break;
    default:
      return;
  }

  const distanceInteger = parseInt(distanceString);
  const distanceIsValid = distanceInteger >= MIN_GAME_CHAT_DISTANCE && distanceInteger <= MAX_GAME_CHAT_DISTANCE;
  if (!distanceIsValid) {
    return;
  }

  inputBuffer.push({
    direction,
    distance: distanceInteger
  });
};

const processBuffer = (): void => {
  const popularityKeyToGameCommand: { [key: string]: GameCommand } = {};
  const popularityMap: { [key: string]: number } = {};

  // Copy the curernt buffer and empty out the input buffer
  const currentBuffer = inputBuffer.splice(0, inputBuffer.length);
  if (currentBuffer.length == 0) {
    return;
  }

  // De-duplicated input commands by popularity hits
  for (let i = 0; i < currentBuffer.length; i++) {
    const gameCommand = currentBuffer[i];
    const popularityKey = `${gameCommand.direction}`;
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

  const gameCommandToExecute = popularityKeyToGameCommand[mostPopularKey];
  mainWindow.webContents.send('gameCommand', JSON.stringify(gameCommandToExecute));
};

// Setup connection configurations
// These include the channel, username and password
const client = new tmi.Client({
    options: { debug: true, messagesLogLevel: "info" },
    connection: {
        reconnect: true,
        secure: true
    },

// Lack of the identity tags makes the bot anonymous and able to fetch messages from the channel
// for reading, supervision, spying, or viewing purposes only
    channels: [secrets.twitchChannelName]
});

// Connect to the channel specified using the setings found in the configurations
// Any error found shall be logged out in the console
client.connect().catch(console.error);

// We shall pass the parameters which shall be required
client.on('message', (channel, tags, message, self) => {
    // Lack of this statement or it's inverse (!self) will make it in active
    if (self) return;
    
    // This logs out all the messages sent on the channel on the terminal
    console.log(message);
    processInputToBuffer(message);
});

function createWindow() {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    height: 470,
    width: 361,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      sandbox: false,
      nodeIntegration: true,
      webSecurity: false
    },
    alwaysOnTop: true,
    backgroundColor: "#000",
    frame: false
  });

  // and load the index.html of the app.
  mainWindow.loadFile(path.join(__dirname, "../index.html")).catch(() => console.log("Unable to load index.html"));
  ipcMain.handle('setHighScore', setHighScore);
  ipcMain.handle('getHighScore', getHighScore);
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  createWindow();

  setInterval(processBuffer, 700);

  app.on("activate", function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
}).catch(() => console.log("Unable to initialize"));

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// In this file you can include the rest of your app"s specific main process
// code. You can also put them in separate files and require them here.
