import { IpcMainInvokeEvent } from 'electron';
import lodash from 'lodash';
import { Configuration, GameMode } from './common';
import { appPersistentStore, initializeChatClient } from './main';

const CONFIGURATION_KEY = 'CONFIGURATION_KEY';

const initialConfigurationSeed: Configuration = {
  channelName: undefined,
  voteDurationMs: 5000,
  minGameChatDistance: 1,
  maxGameChatDistance: 10,
  gameMode: GameMode.STATIC,
};

export const getConfiguration = (): Configuration => {
  // Merge of the persistent configuration and the initialConfigurationSeed to ensure that new properties are always seeded correctly
  let persistentConfiguration: Configuration | undefined =
    appPersistentStore.get(CONFIGURATION_KEY) as Configuration | undefined;
  if (!persistentConfiguration) {
    persistentConfiguration = initialConfigurationSeed;
    setConfiguration(undefined, persistentConfiguration);
  }

  const mergedConfiguration = lodash.merge(
    initialConfigurationSeed,
    persistentConfiguration,
  );
  return mergedConfiguration;
};

const configurationUpdated = () => {
  initializeChatClient();
};

export const setConfiguration = (
  _event: IpcMainInvokeEvent,
  configuration: Configuration,
): void => {
  appPersistentStore.set(CONFIGURATION_KEY, configuration);
  configurationUpdated();
};
