/**
 * 并行实验室 API 服务
 */

import request from './axios';

// 类型定义
export interface VariableConfig {
  type: 'enumerated' | 'stepped' | 'random';
  values?: (string | number)[];
  start?: number;
  step?: number;
  end?: number;
  min?: number;
  max?: number;
  count?: number;
}

export interface Objective {
  variable: string;
  type: 'maximize' | 'minimize';
  weight?: number;
}

export interface StopCondition {
  expression: string;
}

export interface TaskConfig {
  type: 'discussion' | 'conditional_stop';
  rounds: number;
  topic?: string;
  summarize?: boolean;
  totalTasks?: number;
  maxConcurrent?: number;
  singleTaskTimeout?: number;
}

export interface ExperimentConfig {
  name: string;
  description?: string;
  source_action_space_id: string;
  variables: Record<string, VariableConfig>;
  objectives?: Objective[];
  stop_conditions?: StopCondition[];
  task_config?: TaskConfig;
}

export interface CreateDraftExperimentConfig {
  name: string;
  description?: string;
  source_action_space_id: string;
}

export interface UpdateExperimentConfig {
  name?: string;
  description?: string;
  variables?: Record<string, VariableConfig>;
  objectives?: Objective[];
  stop_conditions?: StopCondition[];
  task_config?: TaskConfig;
}

export interface ExperimentRun {
  run_number: number;
  action_task_id: string | null;  // null for queued (not yet created) tasks
  status: 'queued' | 'pending' | 'running' | 'completed' | 'failed' | 'stopped';
  parameters: Record<string, any>;
  current_metrics: Record<string, any>;
  messages?: Array<{
    id: number;
    agent_name: string;
    content_preview: string;
    role: string;
    created_at: string;
  }>;
}

export interface Experiment {
  id: string;
  name: string;
  description?: string;
  source_action_space_id: string;
  source_action_space_name?: string;
  config: ExperimentConfig;
  status: 'template' | 'created' | 'running' | 'paused' | 'completed' | 'failed' | 'stopped';
  is_template: boolean;
  current_iteration: number;
  total_runs: number;
  completed_runs: number;
  failed_runs: number;
  start_time?: string;
  end_time?: string;
  results_summary?: {
    best_run?: {
      action_task_id: string;
      parameters: Record<string, any>;
      metrics: Record<string, any>;
    };
    all_results?: Array<{
      action_task_id: string;
      parameters: Record<string, any>;
      metrics: Record<string, any>;
    }>;
  };
  all_iterations?: string[];
  created_at: string;
  updated_at: string;
}

export interface ExperimentStatus {
  experiment_id: string;
  name: string;
  status: string;
  current_iteration: number;
  query_iteration: number;
  total_runs: number;
  completed_runs: number;
  failed_runs: number;
  stopped_runs: number;
  runs: ExperimentRun[];
  results_summary?: Experiment['results_summary'];
  all_iterations?: string[];
  pending_task_count?: number;  // 待创建任务数（延迟创建模式）
  // runs 分页信息（传入 runs_page 时返回）
  runs_page?: number;
  runs_limit?: number;
  runs_total?: number;
  runs_total_pages?: number;
}

export interface ExperimentStep {
  id: string;
  experiment_id: string;
  action_task_id: string;
  conversation_id?: string;
  step_number: number;
  variables_snapshot: Record<string, any>;
  created_at: string;
}

export interface ListExperimentsResponse {
  success: boolean;
  experiments: Experiment[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

// API 函数

/**
 * 获取实验列表
 */
export const listExperiments = async (params?: {
  page?: number;
  limit?: number;
  include_templates?: boolean;
}): Promise<ListExperimentsResponse> => {
  const response = await request.get('/parallel-experiments', { params });
  return response.data;
};

/**
 * 创建实验（完整配置，立即启动）
 */
export const createExperiment = async (config: ExperimentConfig): Promise<{ success: boolean; id: string; message: string }> => {
  const response = await request.post('/parallel-experiments', config);
  return response.data;
};

/**
 * 创建草稿实验（仅基础信息，不启动）
 */
export const createDraftExperiment = async (config: CreateDraftExperimentConfig): Promise<{ success: boolean; id: string; message: string }> => {
  const response = await request.post('/parallel-experiments/draft', config);
  return response.data;
};

/**
 * 更新实验配置
 */
export const updateExperiment = async (experimentId: string, config: UpdateExperimentConfig): Promise<{ success: boolean; message: string }> => {
  const response = await request.put(`/parallel-experiments/${experimentId}`, config);
  return response.data;
};

/**
 * 启动实验（从 created 状态启动）
 */
export const startExperiment = async (experimentId: string): Promise<{ success: boolean; message: string }> => {
  const response = await request.post(`/parallel-experiments/${experimentId}/start`);
  return response.data;
};

/**
 * 获取实验详情
 */
export const getExperiment = async (experimentId: string): Promise<{ success: boolean; experiment: Experiment }> => {
  const response = await request.get(`/parallel-experiments/${experimentId}`);
  return response.data;
};

/**
 * 获取实验状态（用于轮询）
 */
export const getExperimentStatus = async (
  experimentId: string,
  includeMessages: boolean = false,
  iteration?: number,
  runsPage?: number,
  runsLimit?: number
): Promise<{ success: boolean } & ExperimentStatus> => {
  const response = await request.get(`/parallel-experiments/${experimentId}/status`, {
    params: { 
      include_messages: includeMessages, 
      iteration,
      runs_page: runsPage,
      runs_limit: runsLimit
    }
  });
  return response.data;
};

/**
 * 复制实验
 */
export const cloneExperiment = async (
  experimentId: string,
  name?: string
): Promise<{ success: boolean; id: string; message: string }> => {
  const response = await request.post(`/parallel-experiments/${experimentId}/clone`, { name });
  return response.data;
};

/**
 * 暂停实验
 */
export const pauseExperiment = async (experimentId: string): Promise<{ success: boolean; message: string }> => {
  const response = await request.post(`/parallel-experiments/${experimentId}/pause`);
  return response.data;
};

/**
 * 恢复实验
 */
export const resumeExperiment = async (experimentId: string): Promise<{ success: boolean; message: string }> => {
  const response = await request.post(`/parallel-experiments/${experimentId}/resume`);
  return response.data;
};

/**
 * 停止实验
 */
export const stopExperiment = async (experimentId: string): Promise<{ success: boolean; message: string }> => {
  const response = await request.post(`/parallel-experiments/${experimentId}/stop`);
  return response.data;
};

/**
 * 删除实验
 */
export const deleteExperiment = async (experimentId: string): Promise<{ success: boolean; message: string }> => {
  const response = await request.delete(`/parallel-experiments/${experimentId}`);
  return response.data;
};

/**
 * 使用最佳参数创建任务
 */
export const createBestTask = async (
  experimentId: string,
  name?: string
): Promise<{ success: boolean; action_task_id: string; message: string }> => {
  const response = await request.post(`/parallel-experiments/${experimentId}/create-best-task`, { name });
  return response.data;
};

/**
 * 获取实验步骤（变量历史）
 */
export const getExperimentSteps = async (experimentId: string): Promise<{ success: boolean; steps: ExperimentStep[] }> => {
  const response = await request.get(`/parallel-experiments/${experimentId}/steps`);
  return response.data;
};

/**
 * 获取单个 run 的步骤
 */
export const getRunSteps = async (
  experimentId: string,
  actionTaskId: string
): Promise<{ success: boolean; steps: ExperimentStep[] }> => {
  const response = await request.get(`/parallel-experiments/${experimentId}/runs/${actionTaskId}/steps`);
  return response.data;
};

/**
 * 验证实验配置
 */
export const validateExperimentConfig = async (
  config: Partial<ExperimentConfig>
): Promise<{ valid: boolean; errors?: string[]; message?: string }> => {
  const response = await request.post('/parallel-experiments/validate-config', config);
  return response.data;
};

export default {
  listExperiments,
  createExperiment,
  createDraftExperiment,
  updateExperiment,
  startExperiment,
  getExperiment,
  getExperimentStatus,
  cloneExperiment,
  pauseExperiment,
  resumeExperiment,
  stopExperiment,
  deleteExperiment,
  createBestTask,
  getExperimentSteps,
  getRunSteps,
  validateExperimentConfig
};
