export interface ProtocolGenerationSettings {
  enableAssistantGeneration: boolean;
  enableExperimentProtocolGeneration: boolean;
  experimentProtocolModel: string;
}

export type ProtocolGenerationDisabledReason =
  | 'read-only'
  | 'assistant-disabled'
  | 'protocol-disabled'
  | 'space-required';

export const resolveProtocolGenerationSettings = (
  settings: Record<string, any> | null | undefined,
): ProtocolGenerationSettings => {
  const assistantEnabled =
    settings?.enable_assistant_generation
    ?? settings?.enableAssistantGeneration;
  const protocolEnabled =
    settings?.enable_experiment_protocol_generation
    ?? settings?.enableExperimentProtocolGeneration;

  return {
    enableAssistantGeneration: assistantEnabled !== false,
    enableExperimentProtocolGeneration: protocolEnabled !== false,
    experimentProtocolModel:
      settings?.experiment_protocol_model
      || settings?.experimentProtocolModel
      || 'default',
  };
};

export const getProtocolGenerationAvailability = ({
  readOnly,
  selectedSpace,
  enableAssistantGeneration,
  enableExperimentProtocolGeneration,
}: {
  readOnly: boolean;
  selectedSpace: string | null;
  enableAssistantGeneration: boolean;
  enableExperimentProtocolGeneration: boolean;
}): {
  enabled: boolean;
  reason: ProtocolGenerationDisabledReason | null;
} => {
  if (readOnly) {
    return { enabled: false, reason: 'read-only' };
  }
  if (!enableAssistantGeneration) {
    return { enabled: false, reason: 'assistant-disabled' };
  }
  if (!enableExperimentProtocolGeneration) {
    return { enabled: false, reason: 'protocol-disabled' };
  }
  if (!selectedSpace) {
    return { enabled: false, reason: 'space-required' };
  }
  return { enabled: true, reason: null };
};
