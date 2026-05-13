# 行动监控页面 - 实施计划

## 现状分析

行动监控页面（`MonitoringCenter.tsx`）包含 5 个 Tab，整体完成度约 15%。

| Tab | 现状 | 完成度 |
|-----|------|--------|
| 仪表盘 | 全部 mock 数据，未对接后端 | 10% |
| 智能体监控 | 基本可用，消息记录未实现 | 70% |
| 自主行动监控 | 基本可用 | 80% |
| 任务会话 | 已对接 ConversationHistoryTab | 90% |
| 执行日志 | mock 数据，搜索/导出未实现 | 10% |

### 已有后端资源

- `StatisticsService` + `/statistics/*` API — 已有丰富的统计接口（overview, tasks, roles, action-spaces, activity-trends, autonomous-tasks 等）
- `RuleTriggerLog` 模型 — 已有规则触发记录表
- `AutonomousTaskExecution` 模型 — 已有自主任务执行记录表
- `/logs` API — 已有系统日志文件读取接口
- 前端 `statisticsAPI` — 已封装统计 API 调用

---

## 实施计划

### Phase 1: 仪表盘对接真实数据

**目标**: 去掉所有 mock 数据，对接已有的 statistics API

**后端**:
- [ ] 1.1 新增 `/api/monitoring/dashboard` 接口，聚合以下数据：
  - 活跃行动空间数（从 `ActionSpace` 查询）
  - 规则集总数（从 `RuleSet` 查询）
  - 今日规则执行次数（从 `RuleTriggerLog` 按日期统计）
  - 异常执行数（从 `RuleTriggerLog` 中 `passed=False` 统计）
  - 规则执行成功率
  - 大模型规则 vs 逻辑规则执行占比
  - 最近异常列表（最近 10 条 `passed=False` 的 RuleTriggerLog）
  - 最近执行记录（最近 10 条 RuleTriggerLog）
- [ ] 1.2 创建 `MonitoringService`（`backend/app/services/monitoring_service.py`）

**前端**:
- [ ] 1.3 在 `services/api/` 中新增 `monitoring.ts`，封装监控 API
- [ ] 1.4 改造 `MonitoringCenter.tsx` 仪表盘 Tab：
  - 去掉 `fetchMonitoringData` 和 `fetchLogs` 中的 mock 数据
  - 调用真实 API 获取统计数据
  - 调用真实 API 获取最近异常和执行记录

---

### Phase 2: 执行日志对接真实数据

**目标**: 执行日志 Tab 对接 RuleTriggerLog，实现搜索过滤和导出

**后端**:
- [ ] 2.1 新增 `/api/monitoring/rule-logs` 接口：
  - 支持分页（page, per_page）
  - 支持按行动空间、规则类型、状态、时间范围过滤
  - 返回 RuleTriggerLog 关联的行动空间名、规则集名、规则名
- [ ] 2.2 新增 `/api/monitoring/rule-logs/export` 接口（CSV 导出）

**前端**:
- [ ] 2.3 改造执行日志 Tab：
  - 对接真实 API，去掉 mock 数据
  - 实现搜索按钮逻辑（调用带过滤参数的 API）
  - 实现导出按钮（调用导出 API 下载 CSV）
  - 行动空间下拉框改为动态加载

---

### Phase 3: 智能体监控补全

**目标**: 补全智能体详情中的"消息记录"功能

**后端**:
- [ ] 3.1 确认 `/api/agents/<id>/messages` 接口是否存在，不存在则新增
  - 返回该智能体参与的最近消息列表（关联 conversation_messages）

**前端**:
- [ ] 3.2 实现 `AgentMonitoring.tsx` 详情弹窗中的"消息记录" Tab
  - 调用消息 API，展示时间线格式的消息列表
  - 支持按时间倒序分页加载

---

### Phase 4: 规则执行统计（可选增强）

**目标**: 提供更丰富的规则执行分析

**后端**:
- [ ] 4.1 新增 `/api/monitoring/stats/rules` 接口：
  - 按规则维度统计执行次数、成功率
  - 按时间维度统计趋势（近 7 天/30 天）
  - 按行动空间维度统计

**前端**:
- [ ] 4.2 在仪表盘 Tab 中增加图表组件（可用 antd 内置或 @ant-design/charts）
  - 规则执行趋势折线图
  - 行动空间执行分布饼图

---

### Phase 5: 监控设置（可选增强）

**目标**: 支持配置监控告警规则

**后端**:
- [ ] 5.1 新增 `MonitoringConfig` 模型（告警阈值、通知方式等）
- [ ] 5.2 新增 `/api/monitoring/config` CRUD 接口

**前端**:
- [ ] 5.3 新增"监控设置" Tab
  - 告警规则配置表单（异常率阈值、通知方式）
  - 告警历史列表

---

## 优先级与依赖

```
Phase 1 (仪表盘) ──→ Phase 2 (执行日志) ──→ Phase 4 (统计图表)
                                              ↓
Phase 3 (智能体消息) ──────────────────→ Phase 5 (监控设置)
```

Phase 1-3 为核心功能，建议优先完成。Phase 4-5 为增强功能，可根据需要安排。

## 涉及文件

| 类型 | 文件路径 |
|------|---------|
| 后端 Service | `backend/app/services/monitoring_service.py`（新建） |
| 后端 Route | `backend/app/api/routes/monitoring.py`（新建） |
| 后端 Model | `backend/app/models.py`（可能需要新增 MonitoringConfig） |
| 前端 API | `frontend/src/services/api/monitoring.ts`（新建） |
| 前端页面 | `frontend/src/pages/actionspace/MonitoringCenter.tsx`（改造） |
| 前端页面 | `frontend/src/pages/actionspace/AgentMonitoring.tsx`（补全消息记录） |
