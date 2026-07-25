import {
  getProtocolGenerationAvailability,
  resolveProtocolGenerationSettings,
} from './protocolGeneration';

describe('Parallel Lab protocol generation settings', () => {
  test('uses the dedicated protocol switch and model', () => {
    expect(resolveProtocolGenerationSettings({
      enable_assistant_generation: true,
      assistant_generation_model: 'generic-model',
      enable_experiment_protocol_generation: false,
      experiment_protocol_model: 'protocol-model',
    })).toEqual({
      enableAssistantGeneration: true,
      enableExperimentProtocolGeneration: false,
      experimentProtocolModel: 'protocol-model',
    });
  });

  test('honors the camel-case master switch returned by settings defaults', () => {
    expect(resolveProtocolGenerationSettings({
      enableAssistantGeneration: false,
      assistantGenerationModel: 'generic-model',
      enable_experiment_protocol_generation: true,
      experiment_protocol_model: 'protocol-model',
    })).toEqual({
      enableAssistantGeneration: false,
      enableExperimentProtocolGeneration: true,
      experimentProtocolModel: 'protocol-model',
    });
  });

  test('allows generation before scan variables are configured', () => {
    expect(getProtocolGenerationAvailability({
      readOnly: false,
      selectedSpace: 'space-1',
      enableAssistantGeneration: true,
      enableExperimentProtocolGeneration: true,
    })).toEqual({
      enabled: true,
      reason: null,
    });
  });

  test('reports the dedicated setting as the reason when it is disabled', () => {
    expect(getProtocolGenerationAvailability({
      readOnly: false,
      selectedSpace: 'space-1',
      enableAssistantGeneration: true,
      enableExperimentProtocolGeneration: false,
    })).toEqual({
      enabled: false,
      reason: 'protocol-disabled',
    });
  });
});
