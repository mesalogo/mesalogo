import {
  getEvidenceChecks,
  getPortfolioStats,
  toWorkspaceExperiment
} from './researchWorkbench';

test('builds an honest experiment preparation checklist', () => {
  const checks = getEvidenceChecks({
    description: 'Compare recovery policies',
    source_action_space_id: 'space-1',
    completed_runs: 2,
    config: {
      variables: { delay: { type: 'enumerated', values: [1, 2] } },
      objectives: [{ variable: 'recovery_time', type: 'minimize' }],
      experiment_protocol: ''
    }
  });

  expect(checks).toEqual([
    { key: 'researchQuestion', ready: true },
    { key: 'scenario', ready: true },
    { key: 'factors', ready: true },
    { key: 'metrics', ready: true },
    { key: 'protocol', ready: false },
    { key: 'runEvidence', ready: true }
  ]);
});

test('summarizes the experiment portfolio without counting templates as studies', () => {
  expect(getPortfolioStats([
    { status: 'running', is_template: false },
    { status: 'paused', is_template: false },
    { status: 'completed', is_template: false },
    { status: 'template', is_template: true }
  ])).toEqual({
    studies: 3,
    active: 2,
    completed: 1,
    templates: 1
  });
});

test('maps API experiment fields to the existing monitoring and analysis contract', () => {
  expect(toWorkspaceExperiment({
    source_action_space_id: 'space-1',
    source_action_space_name: 'Scenario',
    total_runs: 12,
    completed_runs: 9,
    failed_runs: 1,
    results_summary: { best_run: null }
  })).toMatchObject({
    actionSpaceId: 'space-1',
    actionSpaceName: 'Scenario',
    totalRuns: 12,
    completedRuns: 9,
    failedRuns: 1,
    results: { best_run: null }
  });
});
