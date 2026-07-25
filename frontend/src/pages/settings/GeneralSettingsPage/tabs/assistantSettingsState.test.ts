import {
  buildAssistantSettingsPayload,
  getAssistantSettingsFormValues,
} from './assistantSettingsState';

describe('assistant settings state', () => {
  test('loads the dedicated experiment protocol settings', () => {
    expect(getAssistantSettingsFormValues({
      enable_assistant_generation: true,
      assistant_generation_model: 'generic-model',
      enable_experiment_protocol_generation: false,
      experiment_protocol_model: 'protocol-model',
    })).toEqual({
      enable_assistant_generation: true,
      assistant_generation_model: 'generic-model',
      enable_experiment_protocol_generation: false,
      experiment_protocol_model: 'protocol-model',
    });
  });

  test('loads camel-case assistant defaults from the settings endpoint', () => {
    expect(getAssistantSettingsFormValues({
      enableAssistantGeneration: false,
      assistantGenerationModel: 'generic-model',
      enable_experiment_protocol_generation: true,
      experiment_protocol_model: 'protocol-model',
    })).toEqual({
      enable_assistant_generation: false,
      assistant_generation_model: 'generic-model',
      enable_experiment_protocol_generation: true,
      experiment_protocol_model: 'protocol-model',
    });
  });

  test('saves the dedicated experiment protocol settings', () => {
    expect(buildAssistantSettingsPayload({
      enable_assistant_generation: true,
      assistant_generation_model: 'generic-model',
      enable_experiment_protocol_generation: true,
      experiment_protocol_model: 'protocol-model',
    })).toEqual({
      enable_assistant_generation: true,
      assistant_generation_model: 'generic-model',
      enable_experiment_protocol_generation: true,
      experiment_protocol_model: 'protocol-model',
    });
  });
});
