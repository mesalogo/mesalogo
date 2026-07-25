export interface EvidenceCheck {
  key:
    | 'researchQuestion'
    | 'scenario'
    | 'factors'
    | 'metrics'
    | 'protocol'
    | 'runEvidence';
  ready: boolean;
}

const hasEntries = (value: unknown): boolean => {
  if (Array.isArray(value)) return value.length > 0;
  if (value && typeof value === 'object') return Object.keys(value).length > 0;
  return Boolean(value);
};

export const getEvidenceChecks = (experiment: any): EvidenceCheck[] => {
  const config = experiment?.config || {};
  return [
    {
      key: 'researchQuestion',
      ready: Boolean(experiment?.description?.trim())
    },
    {
      key: 'scenario',
      ready: Boolean(experiment?.source_action_space_id || experiment?.source_action_space_name)
    },
    {
      key: 'factors',
      ready: hasEntries(config.variables)
    },
    {
      key: 'metrics',
      ready: hasEntries(config.objectives)
    },
    {
      key: 'protocol',
      ready: Boolean(config.experiment_protocol?.trim())
    },
    {
      key: 'runEvidence',
      ready: Number(experiment?.completed_runs || experiment?.completedRuns || 0) > 0
    }
  ];
};

export const getPortfolioStats = (experiments: any[]) => {
  const studies = experiments.filter(experiment => !experiment.is_template);
  return {
    studies: studies.length,
    active: studies.filter(experiment => ['running', 'paused'].includes(experiment.status)).length,
    completed: studies.filter(experiment => experiment.status === 'completed').length,
    templates: experiments.filter(experiment => experiment.is_template).length
  };
};

export const toWorkspaceExperiment = (experiment: any) => ({
  ...experiment,
  actionSpaceId: experiment?.source_action_space_id,
  actionSpaceName: experiment?.source_action_space_name,
  totalRuns: experiment?.total_runs || 0,
  completedRuns: experiment?.completed_runs || 0,
  failedRuns: experiment?.failed_runs || 0,
  total_runs: experiment?.total_runs || 0,
  completed_runs: experiment?.completed_runs || 0,
  failed_runs: experiment?.failed_runs || 0,
  results: experiment?.results_summary
});
