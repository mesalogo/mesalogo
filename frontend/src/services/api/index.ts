// 导入服务模块
import { default as apiInstance } from './axios';
import { actionTaskAPI } from './actionTask';
import { agentAPI } from './agent';
import { modelConfigAPI } from './model';
import { roleAPI } from './role';
import { actionSpaceAPI } from './actionspace';
import { validateApiUrl } from './validation';
import toolAPI from './tool';
import capabilityAPI from './capability';
import settingsAPI from './settings';
import { authAPI } from './auth';
import { logsAPI } from './logs';
import externalKnowledgeAPI from './externalKnowledge';
import { vectorDatabaseAPI, tidbAPI } from './vectorDatabase';

// 导出API实例和各API模块
export {
  apiInstance as api,
  actionTaskAPI,
  agentAPI,
  modelConfigAPI,
  roleAPI,
  actionSpaceAPI,
  validateApiUrl,
  toolAPI,
  capabilityAPI,
  settingsAPI,
  authAPI,
  logsAPI,
  externalKnowledgeAPI,
  vectorDatabaseAPI,
  tidbAPI
};

// 如果需要工具函数，可以从 './utils' 导入

// 综合API服务导出
const apiServices = {
  api: apiInstance,
  actionTask: actionTaskAPI,
  agent: agentAPI,
  model: modelConfigAPI,
  role: roleAPI,
  actionSpace: actionSpaceAPI,
  tool: toolAPI,
  capability: capabilityAPI,
  settings: settingsAPI,
  auth: authAPI,
  logs: logsAPI,
  externalKnowledge: externalKnowledgeAPI,
  vectorDatabase: vectorDatabaseAPI,
  tidb: tidbAPI
};

export default apiServices;