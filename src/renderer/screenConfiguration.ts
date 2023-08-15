import { Configuration, GameMode, toTitleCase } from '../common';
import './scss/styles.scss';

export const displayConfigurationScreen = async () => {
  const configuration = await window.electronAPI.getConfiguration();

  const gameScreen = document.getElementById('game_screen') as HTMLDivElement;
  const configurationScreen = document.getElementById(
    'configuration_screen',
  ) as HTMLDivElement;

  const configurationInputs = document.getElementById(
    'configuration_inputs',
  ) as HTMLDivElement;

  gameScreen.style.display = 'none';
  configurationScreen.style.display = 'block';

  configurationInputs.innerHTML = '';

  const configurationInputsDefinitions: Record<
    keyof Configuration,
    {
      id: string;
      title: string;
      placeholder?: string;
      min?: number;
      max?: number;
      displayConfigOption: boolean;
      type: 'text' | 'number' | 'GameMode';
    }
  > = {
    channelName: {
      id: 'configuration_channel_name',
      displayConfigOption: true,
      type: 'text',
      placeholder: 'sadboifeverdreamz',
      title: 'Channel Name',
    },
    gameMode: {
      id: 'configuration_game_mode',
      displayConfigOption: true,
      type: 'GameMode',
      title: 'Game Mode',
    },
    minGameChatDistance: {
      id: 'configuration_min_chat_distance',
      displayConfigOption: true,
      type: 'number',
      title: 'Minimum Chat Distance',
    },
    maxGameChatDistance: {
      id: 'configuration_max_chat_distance',
      displayConfigOption: true,
      type: 'number',
      title: 'Maximum Chat Distance',
    },
    voteDurationMs: {
      id: 'configuration_vote_duration_ms',
      displayConfigOption: true,
      type: 'number',
      title: 'Vote Duration (ms)',
    },
  };

  const addTextBoxInput = (inputDefinitionKey: keyof Configuration) => {
    const inputDefinition = configurationInputsDefinitions[inputDefinitionKey];
    const inputElement = document.createElement('input');
    inputElement.id = inputDefinition.id;
    inputElement.placeholder = inputDefinition.placeholder;
    inputElement.type = inputDefinition.type;
    inputElement.min = inputDefinition.min?.toString();
    inputElement.max = inputDefinition.max?.toString();

    inputElement.onchange = async (event: Event) => {
      const inputValue = (event.target as any).value as string;
      const configuration = await window.electronAPI.getConfiguration();
      (configuration as any)[inputDefinitionKey] = inputValue;
      await window.electronAPI.setConfiguration(configuration);
    };

    inputElement.value = (configuration as any)[inputDefinitionKey] || '';

    configurationInputs.appendChild(inputElement);
  };

  const addGameModeSelection = async (
    inputDefinitionKey: keyof Configuration,
  ) => {
    const possibleGameModes = Object.values(GameMode);
    for (let i = 0; i < possibleGameModes.length; i++) {
      const gameModeValue = possibleGameModes[i];

      const formCheck = document.createElement('div');
      formCheck.classList.add('form-check');
      if (i > 0) {
        formCheck.classList.add('form-check-inline');
      }

      const formCheckInput = document.createElement('input');
      formCheckInput.classList.add('form-check-input');
      formCheckInput.type = 'radio';
      formCheckInput.name = 'flexRadioDefault';
      formCheckInput.id = `flexRadio${gameModeValue}`;
      const configuration = await window.electronAPI.getConfiguration();
      const currentGameMode = configuration.gameMode;
      formCheckInput.checked = currentGameMode === gameModeValue;
      formCheckInput.onchange = async (event: Event) => {
        const inputValue = document.getElementById(
          `flexRadio${GameMode.STATIC}`,
        ) as HTMLInputElement;
        const gameModeInEffect = inputValue.checked
          ? GameMode.STATIC
          : GameMode.CONTINUOUS;
        const configuration = await window.electronAPI.getConfiguration();
        (configuration as any)[inputDefinitionKey] = gameModeInEffect;
        await window.electronAPI.setConfiguration(configuration);
      };
      formCheck.appendChild(formCheckInput);

      const formCheckLabel = document.createElement('label');
      formCheckLabel.classList.add('form-check-label');
      (formCheckLabel as any).for = `flexRadio${gameModeValue}`;
      formCheckLabel.innerText = toTitleCase(gameModeValue);
      formCheck.appendChild(formCheckLabel);

      configurationInputs.appendChild(formCheck);
    }
  };

  for (const inputDefinitionKey of Object.keys(
    configurationInputsDefinitions,
  ) as Array<keyof Configuration>) {
    const inputDefinition = configurationInputsDefinitions[inputDefinitionKey];

    const title = document.createElement('h6');
    title.innerText = inputDefinition.title;
    configurationInputs.appendChild(title);

    if (inputDefinition.type === 'text' || inputDefinition.type === 'number') {
      addTextBoxInput(inputDefinitionKey);
    } else if (inputDefinition.type === 'GameMode') {
      await addGameModeSelection(inputDefinitionKey);
    }
  }
};
