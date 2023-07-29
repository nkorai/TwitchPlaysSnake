import { IpcRendererEvent } from "electron";

export type OnGameCommandCallbackFunction = (event: IpcRendererEvent, value: string) => void;

export interface ElectronAPI {
    onGameCommand: (callback: OnGameCommandCallbackFunction) => Electron.IpcRenderer;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setHighScore: (highScore: number) => Promise<any>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getHighScore: () => Promise<any>
}

export enum Direction {
    LEFT = "left",
    RIGHT = "right",
    UP = "up",
    DOWN = "down"
  }

export interface GameCommand {
    direction: Direction;
    distance: number;
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
        b: parseInt(result[3], 16)
    }
}