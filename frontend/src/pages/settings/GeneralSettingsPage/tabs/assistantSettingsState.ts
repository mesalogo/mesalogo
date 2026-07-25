export interface AssistantSettingsFormValues {
  enable_assistant_generation: boolean;
  assistant_generation_model: string;
  enable_experiment_protocol_generation: boolean;
  experiment_protocol_model: string;
}

export const getAssistantSettingsFormValues = (
  initialValues: Record<string, any> | null | undefined,
): AssistantSettingsFormValues => {
  const assistantEnabled =
    initialValues?.enable_assistant_generation
    ?? initialValues?.enableAssistantGeneration;
  const protocolEnabled =
    initialValues?.enable_experiment_protocol_generation
    ?? initialValues?.enableExperimentProtocolGeneration;

  return {
    enable_assistant_generation: assistantEnabled !== false,
    assistant_generation_model:
      initialValues?.assistant_generation_model
      || initialValues?.assistantGenerationModel
      || 'default',
    enable_experiment_protocol_generation: protocolEnabled !== false,
    experiment_protocol_model:
      initialValues?.experiment_protocol_model
      || initialValues?.experimentProtocolModel
      || 'default',
  };
};

export const buildAssistantSettingsPayload = (
  values: Partial<AssistantSettingsFormValues>,
): AssistantSettingsFormValues => ({
  enable_assistant_generation:
    values.enable_assistant_generation !== false,
  assistant_generation_model:
    values.assistant_generation_model || 'default',
  enable_experiment_protocol_generation:
    values.enable_experiment_protocol_generation !== false,
  experiment_protocol_model:
    values.experiment_protocol_model || 'default',
});
