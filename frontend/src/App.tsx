import React, { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { App as AntdApp, ConfigProvider, Skeleton, Card, Space } from 'antd';
import { useTranslation } from 'react-i18next';
import zhCN from 'antd/locale/zh_CN';
import enUS from 'antd/locale/en_US';
import { LayoutProvider } from './contexts/LayoutContext';
import LayoutWrapper from './components/layout/LayoutWrapper';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import { lightTheme, darkTheme } from './theme';
import ProtectedRoute from './components/auth/ProtectedRoute';
import PermissionGuard from './components/auth/PermissionGuard';
import { useGlobalErrorHandler } from './hooks/useGlobalErrorHandler';
import { PERMISSIONS } from './constants/permissions';
import './App.css';

// 核心组件保持同步导入（用于首屏渲染）
import Login from './pages/login/Login';
import LoginDemo from './pages/login/LoginDemo';
import OAuthCallback from './pages/oauth/OAuthCallback';
import { TaskWindowManager } from './components/TaskWindowManager/TaskWindowManager';

// 页面级组件使用懒加载
const Home = lazy(() => import('./pages/Home'));

// 角色管理相关页面
const RoleManagement = lazy(() => import('./pages/roles/RoleManagement'));
const ToolManagement = lazy(() => import('./pages/roles/ToolManagement'));
const SkillManagement = lazy(() => import('./pages/roles/SkillManagement'));
const WorkspaceManagement = lazy(() => import('./pages/workspace'));
const PartitionWorkspaceTab = lazy(() => import('./pages/workspace/PartitionWorkspaceTab'));

// 知识库管理
const KnowledgeBaseMain = lazy(() => import('./pages/knowledgebase/KnowledgeBaseMain'));
const InternalKnowledge = lazy(() => import('./pages/knowledgebase/InternalKnowledge'));
const ExternalKnowledge = lazy(() => import('./pages/knowledgebase/ExternalKnowledge'));
const RoleBindings = lazy(() => import('./pages/knowledgebase/RoleBindings'));
const RagasEvaluationWrapper = lazy(() => import('./pages/knowledgebase/RagasEvaluationWrapper'));

// 记忆管理
const MemoryPartitionPage = lazy(() => import('./pages/memory').then(module => ({ default: module.MemoryPartitionPage })));

// 行动空间相关页面
const ActionSpaceOverview = lazy(() => import('./pages/actionspace/ActionSpaceOverview'));
const ActionSpaceDetail = lazy(() => import('./pages/actionspace/ActionSpaceDetail'));
const ActionRules = lazy(() => import('./pages/actionspace/ActionRules'));
const EnvironmentVariables = lazy(() => import('./pages/actionspace/Variable/EnvironmentVariables'));
const MonitoringCenter = lazy(() => import('./pages/actionspace/MonitoringCenter'));
const JointSpaceManagement = lazy(() => import('./pages/actionspace/JointSpaceManagement'));
const MarketPage = lazy(() => import('./pages/actionspace/AppMarket/MarketPage'));

// 行动任务组件
const ActionTaskOverview = lazy(() => import('./pages/actiontask/ActionTaskOverview'));
const ActionTaskDetail = lazy(() => import('./pages/actiontask/ActionTaskDetail'));
const ParallelLab = lazy(() => import('./pages/actiontask/parallellab/ParallelLab'));

// 并行实验室子页面
const ExperimentListPage = lazy(() => import('./pages/actiontask/parallellab/ExperimentListPage'));
const ExecutionMonitoringPage = lazy(() => import('./pages/actiontask/parallellab/ExecutionMonitoringPage'));
const AnalysisReportPage = lazy(() => import('./pages/actiontask/parallellab/AnalysisReportPage'));

// 公开访问页面
const PublicTaskView = lazy(() => import('./pages/public/PublicTaskView'));
const EmbedTaskView = lazy(() => import('./pages/public/EmbedTaskView'));

// 设置页面
const GeneralSettingsPage = lazy(() => import('./pages/settings/GeneralSettingsPage'));
const ModelConfigsPage = lazy(() => import('./pages/settings/ModelConfigsPage/ModelConfigsPage'));
const MCPServersPage = lazy(() => import('./pages/settings/MCPServersPage'));
const AboutPage = lazy(() => import('./pages/settings/AboutPage'));
const LogsPage = lazy(() => import('./pages/settings/LogsPage'));
const GraphEnhancementSettingsPage = lazy(() => import('./pages/settings/GraphEnhancementSettingsPage'));
const UserManagementPage = lazy(() => import('./pages/settings/UserManagementPage'));
const SubscriptionPage = lazy(() => import('./pages/settings/SubscriptionPage'));
const SubscriptionManagementPage = lazy(() => import('./pages/settings/SubscriptionManagementPage'));
const IMIntegrationPage = lazy(() => import('./pages/settings/IMIntegrationPage'));

// 账户页面
const ProfilePage = lazy(() => import('./pages/account/ProfilePage'));
const TeamSettingsPage = lazy(() => import('./pages/account/TeamSettingsPage'));
const PaymentsPage = lazy(() => import('./pages/account/PaymentsPage'));

// 智能体页面
const Agents = lazy(() => import('./pages/Agents'));

// 加载占位组件 - 空白占位，避免与页面内部骨架屏冲突
// 懒路由加载通常很快，不需要显示加载动画
const PageLoading = () => null;

// 内部组件，使用主题
const AppContent: React.FC = () => {
  const { isDark } = useTheme();
  const { i18n } = useTranslation();
  const antdLocale = i18n.language === 'en-US' ? enUS : zhCN;

  // 启用全局错误处理
  useGlobalErrorHandler();

  return (
    <ConfigProvider 
      locale={antdLocale}
      theme={isDark ? darkTheme : lightTheme}
    >
      <AntdApp>
        <AuthProvider>
          <LayoutProvider>
            <Routes>
              {/* 登录页面 - 不需要认证 */}
              <Route path="/login" element={<Login />} />
              
              {/* 登录风格Demo页面 - 不需要认证 */}
              <Route path="/login-demo" element={<LoginDemo />} />

              {/* OAuth 回调页面 - 不需要认证 */}
              <Route path="/oauth/callback" element={<OAuthCallback />} />

          {/* 公开访问页面 - 不需要认证 */}
          <Route path="/public/task/:shareToken" element={
            <Suspense fallback={<PageLoading />}>
              <PublicTaskView />
            </Suspense>
          } />
          <Route path="/embed/task/:shareToken" element={
            <Suspense fallback={<PageLoading />}>
              <EmbedTaskView />
            </Suspense>
          } />

              {/* 所有需要认证的路由 */}
              <Route path="/*" element={
                <ProtectedRoute>
                  <LayoutWrapper>
                <TaskWindowManager
                  maxWindows={10}
                  renderTaskDetail={(taskId) => (
                    <Suspense fallback={<PageLoading />}>
                      <ActionTaskDetail key={taskId} taskIdProp={taskId} />
                    </Suspense>
                  )}
                >
                  <Suspense fallback={<PageLoading />}>
                    <Routes>
                      {/* 首页重定向到系统概览 */}
                      <Route path="/" element={<Navigate to="/home" replace />} />

                      {/* 系统概览页面 */}
                      <Route path="/home" element={<Home />} />

                      {/* 行动任务管理路由 */}
                      <Route path="/action-tasks/overview" element={<ActionTaskOverview />} />
                      <Route path="/action-tasks/detail/:taskId" element={<div />} />
                      <Route path="/action-tasks/detail" element={<Navigate to="/action-tasks/overview" replace />} />
                      <Route path="/action-tasks/monitoring" element={<MonitoringCenter />} />
                      <Route path="/action-tasks/agent/:id" element={<div />} />
                      
                      {/* 并行实验室路由 */}
                      <Route path="/parallel-lab" element={<Navigate to="/parallel-lab/list" replace />} />
                      <Route path="/parallel-lab/list" element={<ExperimentListPage />} />
                      <Route path="/parallel-lab/monitoring" element={<ExecutionMonitoringPage />} />
                      <Route path="/parallel-lab/analysis" element={<AnalysisReportPage />} />
                      <Route path="/action-tasks/parallel-lab" element={<Navigate to="/parallel-lab/list" replace />} />

                  {/* 角色与智能体路由 */}
                  <Route path="/agents" element={<Agents />} />
                  <Route path="/roles" element={<RoleManagement />} />
                  <Route path="/roles/management" element={<RoleManagement />} />
                  <Route path="/roles/tools" element={<ToolManagement />} />
                  <Route path="/roles/skills" element={<SkillManagement />} />
                  <Route path="/roles/memories" element={<WorkspaceManagement />} />
                  <Route path="/workspace/browser" element={<PartitionWorkspaceTab />} />

                  {/* 知识库管理路由 */}
                  <Route path="/knowledges" element={<KnowledgeBaseMain />} />
                  <Route path="/knowledges/internal" element={<InternalKnowledge />} />
                  <Route path="/knowledges/external" element={<ExternalKnowledge />} />
                  <Route path="/knowledges/bindings" element={<RoleBindings />} />
                  <Route path="/knowledges/evaluation" element={<RagasEvaluationWrapper />} />

                  {/* 行动空间管理路由 */}
                  <Route path="/action-spaces/overview" element={<ActionSpaceOverview />} />
                  <Route path="/action-spaces/detail/:id" element={<ActionSpaceDetail />} />
                  <Route path="/action-spaces/joint" element={<JointSpaceManagement />} />
                  <Route path="/action-spaces/rules" element={<ActionRules />} />
                  <Route path="/action-spaces/environment" element={<EnvironmentVariables />} />
                  <Route path="/action-spaces/market" element={<MarketPage />} />
                  <Route path="/action-space/detail/:id" element={<ActionSpaceDetail />} />

                  {/* 记忆管理 */}
                  <Route path="/memory" element={<MemoryPartitionPage />} />

                  {/* 账户中心 */}
                  <Route path="/account" element={<Navigate to="/account/profile" replace />} />
                  <Route path="/account/profile" element={<ProfilePage />} />
                  <Route path="/account/subscription" element={<SubscriptionPage />} />
                  <Route path="/account/payments" element={<PaymentsPage />} />
                  <Route path="/account/team" element={<TeamSettingsPage />} />
                  <Route path="/account/im-integration" element={<IMIntegrationPage />} />

                  {/* 系统设置 */}
                  <Route path="/settings" element={<Navigate to="/settings/about" replace />} />
                  {/* 只有超级管理员可以访问的系统设置页面 */}
                  <Route
                    path="/settings/general"
                    element={
                      <PermissionGuard requiredPermission={PERMISSIONS.MENU_SETTINGS_ADMIN}>
                        <GeneralSettingsPage />
                      </PermissionGuard>
                    }
                  />
                  <Route
                    path="/settings/model-configs"
                    element={
                      <PermissionGuard requiredPermission={PERMISSIONS.MENU_SETTINGS_ADMIN}>
                        <ModelConfigsPage />
                      </PermissionGuard>
                    }
                  />
                  <Route
                    path="/settings/graph-enhancement"
                    element={
                      <PermissionGuard requiredPermission={PERMISSIONS.MENU_SETTINGS_ADMIN}>
                        <GraphEnhancementSettingsPage />
                      </PermissionGuard>
                    }
                  />
                  <Route
                    path="/settings/users"
                    element={
                      <PermissionGuard requiredPermission={PERMISSIONS.MENU_SETTINGS_ADMIN}>
                        <UserManagementPage />
                      </PermissionGuard>
                    }
                  />
                  <Route
                    path="/settings/logs"
                    element={
                      <PermissionGuard requiredPermission={PERMISSIONS.MENU_SETTINGS_ADMIN}>
                        <LogsPage />
                      </PermissionGuard>
                    }
                  />
                  {/* 所有人都可以访问关于系统 */}
                  <Route path="/settings/about" element={<AboutPage />} />
                  {/* 订阅管理 - 所有人可以查看自己的订阅 */}
                  <Route path="/settings/subscription" element={<SubscriptionPage />} />
                  {/* 订阅计划管理 - 只有超级管理员可以访问 */}
                  <Route
                    path="/settings/subscription-management"
                    element={
                      <PermissionGuard requiredPermission={PERMISSIONS.MENU_SETTINGS_ADMIN}>
                        <SubscriptionManagementPage />
                      </PermissionGuard>
                    }
                  />

                  {/* MCP服务器管理 - 只有超级管理员可以访问 */}
                  <Route
                    path="/settings/mcp-servers"
                    element={
                      <PermissionGuard requiredPermission={PERMISSIONS.MENU_SETTINGS_ADMIN}>
                        <MCPServersPage />
                      </PermissionGuard>
                    }
                  />

                    </Routes>
                  </Suspense>
                </TaskWindowManager>
                  </LayoutWrapper>
                </ProtectedRoute>
              } />
            </Routes>
          </LayoutProvider>
        </AuthProvider>
      </AntdApp>
    </ConfigProvider>
  );
};

// 主组件
function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}

export default App;