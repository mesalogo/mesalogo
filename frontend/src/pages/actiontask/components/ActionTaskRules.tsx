import React, { useState, useEffect, useImperativeHandle, forwardRef } from 'react';
import {
  Empty, Button, Modal, Radio, Checkbox, Input, Select,
  message, Spin, List, Tag, Space, Typography, Statistic,
  Divider, Card, Alert, Tooltip
} from 'antd';
import {
  CheckCircleOutlined, CloseCircleOutlined, PlayCircleOutlined,
  InfoCircleOutlined, ExperimentOutlined
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { actionTaskAPI } from '../../../services/api/actionTask';

const { TextArea } = Input;
const { Text } = Typography;
const { Option } = Select;
const { Group: RadioGroup } = Radio;
const { Group: CheckboxGroup } = Checkbox;

export interface ActionTaskRulesRef {
  openManualCheck: () => void;
}

interface ActionTaskRulesProps {
  task: any;
}

const ActionTaskRules = forwardRef(({ task }: ActionTaskRulesProps, ref) => {
  const { t } = useTranslation();

  // 暴露方法给父组件
  useImperativeHandle(ref, () => ({
    openManualCheck: handleManualCheck
  }));
  // 规则触发数据状态
  const [ruleTriggers, setRuleTriggers] = useState([]);
  const [loadingTriggers, setLoadingTriggers] = useState(false);
  const [triggersPagination, setTriggersPagination] = useState({
    page: 1,
    per_page: 10,
    total: 0,
    pages: 0
  });

  // 手动检查相关状态
  const [checkModalVisible, setCheckModalVisible] = useState(false);
  const [checkScope, setCheckScope] = useState('all'); // 'all' | 'selected'
  const [availableRules, setAvailableRules] = useState([]);
  const [selectedRules, setSelectedRules] = useState([]);
  const [ruleTypeFilter, setRuleTypeFilter] = useState(['llm', 'logic']);
  const [checkScenario, setCheckScenario] = useState('current'); // 'current' | 'custom'
  const [customScenario, setCustomScenario] = useState('');
  const [selectedSupervisor, setSelectedSupervisor] = useState(null);
  const [supervisorAgents, setSupervisorAgents] = useState([]);
  const [checking, setChecking] = useState(false);
  const [checkResults, setCheckResults] = useState([]);
  const [loadingRules, setLoadingRules] = useState(false);

  // 加载规则触发记录
  const loadRuleTriggers = async (page = 1) => {
    if (!task?.id) return;

    setLoadingTriggers(true);
    try {
      const response = await actionTaskAPI.getRuleTriggers(task.id, {
        page,
        per_page: triggersPagination.per_page
      });

      setRuleTriggers(response.triggers || []);
      setTriggersPagination(response.pagination || {});
      console.log('加载规则触发记录成功:', response);
    } catch (error) {
      console.error('加载规则触发记录失败:', error);
      message.error(t('rules.card.loadingTriggers'));
    } finally {
      setLoadingTriggers(false);
    }
  };

  // 初始化时获取规则数据
  useEffect(() => {
    console.log('ActionTaskRules组件接收到任务数据:', task);
    if (task?.id) {
      loadRuleTriggers();
    }
  }, [task]);

  // 加载任务规则
  const loadTaskRules = async () => {
    if (!task?.id) return;

    setLoadingRules(true);
    try {
      const rules = await actionTaskAPI.getTaskRules(task.id);
      setAvailableRules(rules);
      // 默认选择所有激活的规则
      setSelectedRules(rules.filter(rule => rule.is_active).map(rule => rule.id));
      console.log('加载任务规则成功:', rules);
    } catch (error) {
      message.error(t('rules.load.failed') + ': ' + error.message);
    } finally {
      setLoadingRules(false);
    }
  };

  // 加载监督者智能体
  const loadSupervisorAgents = async () => {
    if (!task?.id) return;

    try {
      const agents = await actionTaskAPI.getSupervisorAgents(task.id);
      setSupervisorAgents(agents);
      // 自动选择第一个监督者
      if (agents.length > 0 && !selectedSupervisor) {
        setSelectedSupervisor(agents[0].id);
      }
      console.log('加载监督者智能体成功:', agents);
    } catch (error) {
      console.error('加载监督者智能体失败:', error);
      // 不显示错误消息，因为可能没有监督者
    }
  };

  // 打开手动检查弹窗
  const handleManualCheck = async () => {
    setCheckModalVisible(true);
    setCheckResults([]); // 清空之前的结果

    // 加载规则和监督者数据
    await Promise.all([
      loadTaskRules(),
      loadSupervisorAgents()
    ]);
  };

  // 执行规则检查
  const executeRuleCheck = async () => {
    if (!task?.id) return;

    // 触发新检查时，清理旧的检查结果
    setCheckResults([]);
    setChecking(true);
    try {
      // 确定要检查的规则，同时考虑规则类型筛选
      const rulesToCheck = checkScope === 'all'
        ? availableRules.filter(rule => rule.is_active && ruleTypeFilter.includes(rule.type))
        : availableRules.filter(rule => selectedRules.includes(rule.id) && ruleTypeFilter.includes(rule.type));

      if (rulesToCheck.length === 0) {
        message.warning(t('rules.check.selectRules'));
        return;
      }

      // 构建检查上下文
      let context = '';
      if (checkScenario === 'current') {
        if (!task.conversation_id) {
          message.warning(t('rules.check.noActiveConversation'));
          return;
        }
        context = await actionTaskAPI.buildTaskContext(task.id, task.conversation_id);
      } else {
        context = customScenario;
      }

      if (!context.trim()) {
        message.warning(t('rules.check.provideScenario'));
        return;
      }

      // 如果使用当前任务上下文但获取失败，提供默认场景
      if (checkScenario === 'current' && context.includes('无法获取')) {
        context = `默认测试场景：当前时间 ${new Date().toLocaleString()}，正在进行规则合规性检查。`;
        message.info(t('rules.check.usingDefaultScenario'));
      }

      // 检查自然语言规则是否需要监督者
      const llmRules = rulesToCheck.filter(rule => rule.type === 'llm');
      if (llmRules.length > 0 && !selectedSupervisor) {
        message.warning(t('rules.check.needSupervisor'));
        return;
      }

      // 预取一次变量，供并发请求复用，避免重复请求变量接口
      const preloadedVariables = await actionTaskAPI.getTaskRuleVariables(task.id);

      // 按规则粒度并行（兼容后端限制：逻辑规则每次仅允许1条）
      const logicRules = rulesToCheck.filter(rule => rule.type === 'logic');
      const logicPromises = logicRules.map(rule => (
        actionTaskAPI
          .testTaskRules(task.id, [rule], context, null, { variables: preloadedVariables })
          .then(res => (res && res.results && res.results.length > 0)
            ? res.results
            : [{
                rule_id: rule.id,
                rule_name: rule.name,
                rule_type: 'logic',
                passed: false,
                message: '规则检查无结果',
                details: '规则测试返回了空结果'
              }])
          .catch(error => ([{
            rule_id: rule.id,
            rule_name: rule.name,
            rule_type: 'logic',
            passed: false,
            message: '规则检查出错',
            details: error.message || '未知错误'
          }]))
      ));

      const llmPromises = llmRules.map(rule => (
        actionTaskAPI
          .testTaskRules(task.id, [rule], context, selectedSupervisor, { variables: preloadedVariables })
          .then(res => (res && res.results && res.results.length > 0)
            ? res.results
            : [{
                rule_id: rule.id,
                rule_name: rule.name,
                rule_type: 'llm',
                passed: false,
                message: '规则检查无结果',
                details: '规则测试返回了空结果'
              }])
          .catch(error => ([{
            rule_id: rule.id,
            rule_name: rule.name,
            rule_type: 'llm',
            passed: false,
            message: '规则检查出错',
            details: error.message || '未知错误'
          }]))
      ));

      const settled = await Promise.allSettled([...logicPromises, ...llmPromises]);
      const results = settled.flatMap(s => s.status === 'fulfilled' ? s.value : []);

      setCheckResults(results);

      // 为每个检查结果创建触发记录（并行写入）
      try {
        const triggerPayloads = results.map(result => ({
          rule_id: result.rule_id,
          conversation_id: task.conversation_id,
          trigger_type: 'manual',
          trigger_source: 'user',
          context: context,
          result: result,
          passed: result.passed,
          message: result.message,
          details: result.details,
          execution_time: result.execution_time
        }));

        await Promise.allSettled(triggerPayloads.map(payload => actionTaskAPI.createRuleTrigger(task.id, payload)));

        // 刷新触发记录显示
        loadRuleTriggers();
        console.log('规则触发记录创建完成');
      } catch (error) {
        console.error('创建规则触发记录失败:', error);
        // 不影响主要功能，只记录错误
      }

      // 统计结果
      const passedCount = results.filter(r => r.passed).length;
      const failedCount = results.length - passedCount;

      if (results.length > 0) {
        message.success(t('rules.check.success', { total: results.length, passed: passedCount, failed: failedCount }));
      } else {
        message.warning(t('rules.check.noResults'));
      }
    } catch (error) {
      console.error('规则检查失败:', error);
      message.error(t('rules.check.failed') + '：' + (error.message || t('message.unknownError')));
    } finally {
      setChecking(false);
    }
  };

  // 渲染检查结果统计
  const renderCheckSummary = () => {
    if (checkResults.length === 0) return null;

    const totalRules = checkResults.length;
    const passedRules = checkResults.filter(r => r.passed).length;
    const failedRules = totalRules - passedRules;

    return (
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-around' }}>
          <Statistic title={t('rules.modal.total')} value={totalRules} />
          <Statistic title={t('rules.card.passed')} value={passedRules} styles={{ content: { color: '#3f8600' } }} />
          <Statistic title={t('rules.card.failed')} value={failedRules} styles={{ content: { color: '#cf1322' } }} />
        </div>
      </Card>
    );
  };

  // 渲染检查结果列表
  const renderCheckResults = () => {
    if (checkResults.length === 0) return null;

    return (
      <List
        dataSource={checkResults}
        renderItem={(result) => (
          <List.Item>
            <List.Item.Meta
              avatar={
                result.passed ?
                  <CheckCircleOutlined style={{ color: '#52c41a', fontSize: '16px' }} /> :
                  <CloseCircleOutlined style={{ color: '#ff4d4f', fontSize: '16px' }} />
              }
              title={
                <Space>
                  <Text strong>{result.rule_name}</Text>
                  <Tag color={result.rule_type === 'logic' ? 'blue' : 'green'}>
                    {result.rule_type === 'logic' ? t('rules.card.logicRule') : t('rules.card.llmRule')}
                  </Tag>
                  <Tag color={result.passed ? 'success' : 'error'}>
                    {result.passed ? t('rules.card.passed') : t('rules.card.failed')}
                  </Tag>
                </Space>
              }
              description={
                <div>
                  <Text type="secondary">{result.message}</Text>
                  {result.details && (
                    <div style={{ marginTop: 4 }}>
                      <Text style={{ fontSize: '12px' }}>{result.details}</Text>
                    </div>
                  )}
                </div>
              }
            />
          </List.Item>
        )}
      />
    );
  };

  // 渲染规则触发记录
  const renderRuleTriggers = () => {
    if (!ruleTriggers || ruleTriggers.length === 0) {
      return <Empty description={t('rules.card.noTriggers')} />;
    }

    return (
      <div>
        <List
          dataSource={ruleTriggers}
          renderItem={(trigger) => (
            <List.Item>
              <List.Item.Meta
                avatar={
                  trigger.passed ?
                    <CheckCircleOutlined style={{ color: '#52c41a', fontSize: '16px' }} /> :
                    <CloseCircleOutlined style={{ color: '#ff4d4f', fontSize: '16px' }} />
                }
                title={
                  <Space>
                    <Text strong>{trigger.rule_name}</Text>
                    <Tag color={trigger.rule_type === 'logic' ? 'blue' : 'green'}>
                      {trigger.rule_type === 'logic' ? t('rules.card.logicRule') : t('rules.card.llmRule')}
                    </Tag>
                    <Tag color={trigger.passed ? 'success' : 'error'}>
                      {trigger.passed ? t('rules.card.passed') : t('rules.card.failed')}
                    </Tag>
                    <Tag color="default">
                      {trigger.trigger_type === 'manual' ? t('rules.card.manualTrigger') :
                       trigger.trigger_type === 'automatic' ? t('rules.card.automaticTrigger') : t('rules.card.scheduledTrigger')}
                    </Tag>
                  </Space>
                }
                description={
                  <div>
                    <div style={{ marginBottom: 4 }}>
                      <Text type="secondary">{trigger.message}</Text>
                    </div>
                    {trigger.details && (
                      <div style={{ marginBottom: 4 }}>
                        <Text style={{ fontSize: '12px' }}>{trigger.details}</Text>
                      </div>
                    )}
                    <div style={{ fontSize: '12px', color: 'var(--custom-text-secondary)' }}>
                      <Space split={<span>•</span>}>
                        <span>{t('rules.card.triggerTime')}: {new Date(trigger.created_at).toLocaleString()}</span>
                        {trigger.execution_time && (
                          <span>{t('rules.card.executionTime')}: {(trigger.execution_time * 1000).toFixed(0)}ms</span>
                        )}
                        {trigger.trigger_source && (
                          <span>{t('rules.card.triggerSource')}: {trigger.trigger_source}</span>
                        )}
                      </Space>
                    </div>
                  </div>
                }
              />
            </List.Item>
          )}
        />

        {/* 分页 */}
        {triggersPagination.pages > 1 && (
          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <Space.Compact>
              <Button
                disabled={!(triggersPagination as any).has_prev}
                onClick={() => loadRuleTriggers(triggersPagination.page - 1)}
              >
                {t('rules.card.previousPage')}
              </Button>
              <Button disabled>
                {triggersPagination.page} / {triggersPagination.pages}
              </Button>
              <Button
                disabled={!(triggersPagination as any).has_next}
                onClick={() => loadRuleTriggers(triggersPagination.page + 1)}
              >
                {t('rules.card.nextPage')}
              </Button>
            </Space.Compact>
          </div>
        )}
      </div>
    );
  };

  // 渲染规则选择区域
  const renderRuleSelection = () => {
    if (checkScope !== 'selected') return null;

    const filteredRules = availableRules.filter(rule =>
      ruleTypeFilter.includes(rule.type)
    );

    return (
      <div style={{ marginTop: 16 }}>
        <div style={{ marginBottom: 12 }}>
          <Text strong>{t('rules.modal.ruleTypeFilter')}：</Text>
          <CheckboxGroup
            value={ruleTypeFilter}
            onChange={setRuleTypeFilter}
            style={{ marginLeft: 8 }}
          >
            <Checkbox value="llm">{t('rules.card.llmRule')}</Checkbox>
            <Checkbox value="logic">{t('rules.card.logicRule')}</Checkbox>
          </CheckboxGroup>
        </div>

        <div>
          <Text strong>{t('rules.modal.selectRules')}：</Text>
          <div style={{ maxHeight: '200px', overflowY: 'auto', marginTop: 8, border: '1px solid var(--custom-border)', borderRadius: '6px', padding: '8px' }}>
            <CheckboxGroup
              value={selectedRules}
              onChange={setSelectedRules}
              style={{ width: '100%' }}
            >
              {filteredRules.map(rule => (
                <div key={rule.id} style={{ marginBottom: 8 }}>
                  <Checkbox value={rule.id}>
                    <Space>
                      <Tag color={rule.type === 'logic' ? 'blue' : 'green'}>
                        {rule.type === 'logic' ? t('rules.card.logicRule') : t('rules.card.llmRule')}
                      </Tag>
                      <Text>{rule.name}</Text>
                      {rule.rule_set_name && (
                        <Text type="secondary" style={{ fontSize: '12px' }}>
                          ({rule.rule_set_name})
                        </Text>
                      )}
                    </Space>
                  </Checkbox>
                </div>
              ))}
            </CheckboxGroup>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div>
      {/* 规则触发记录 */}
      {renderRuleTriggers()}

      {/* 手动检查弹窗 */}
      <Modal
        title={
          <Space>
            <ExperimentOutlined />
            <span>{t('rules.modal.title')}</span>
          </Space>
        }
        open={checkModalVisible}
        onCancel={() => setCheckModalVisible(false)}
        width={800}
        footer={null}
      >
        <Spin spinning={loadingRules}>
          {/* 检查范围选择 */}
          <div style={{ marginBottom: 16 }}>
            <Text strong>{t('rules.modal.checkScope')}：</Text>
            <RadioGroup
              value={checkScope}
              onChange={e => setCheckScope(e.target.value)}
              style={{ marginLeft: 8 }}
            >
              <Radio value="all">{t('rules.modal.allRules')}</Radio>
              <Radio value="selected">{t('rules.modal.selectedRules')}</Radio>
            </RadioGroup>
          </div>

          {/* 规则选择区域 */}
          {renderRuleSelection()}

          {/* 检查场景选择 */}
          <div style={{ marginTop: 16, marginBottom: 16 }}>
            <Text strong>{t('rules.modal.checkScenario')}：</Text>
            <RadioGroup
              value={checkScenario}
              onChange={e => setCheckScenario(e.target.value)}
              style={{ marginLeft: 8 }}
            >
              <Radio value="current" disabled={!task?.conversation_id}>
                {t('rules.modal.currentContext')}
                {!task?.conversation_id && (
                  <Text type="secondary" style={{ fontSize: '12px', marginLeft: 4 }}>
                    {t('rules.modal.currentContextDisabled')}
                  </Text>
                )}
              </Radio>
              <Radio value="custom">{t('rules.modal.customScenario')}</Radio>
            </RadioGroup>
          </div>

          {/* 无活动会话提示 */}
          {!task?.conversation_id && (
            <Alert
              message={t('rules.modal.noActiveConversation')}
              description={t('rules.modal.noActiveConversationDesc')}
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
            />
          )}

          {/* 自定义场景输入 */}
          {checkScenario === 'custom' && (
            <div style={{ marginBottom: 16 }}>
              <TextArea
                placeholder={t('rules.modal.customScenarioPlaceholder')}
                value={customScenario}
                onChange={e => setCustomScenario(e.target.value)}
                rows={4}
              />
            </div>
          )}

          {/* 监督者角色选择 */}
          {availableRules.some(rule => rule.type === 'llm') && (
            <div style={{ marginBottom: 16 }}>
              <Text strong>
                {t('rules.modal.supervisorRole')}：
                <Tooltip title={t('rules.modal.supervisorRoleTooltip')}>
                  <InfoCircleOutlined style={{ marginLeft: 4, color: 'var(--custom-text-secondary)' }} />
                </Tooltip>
              </Text>
              <Select
                placeholder={t('rules.modal.selectSupervisor')}
                value={selectedSupervisor}
                onChange={setSelectedSupervisor}
                style={{ width: '100%', marginTop: 8 }}
                disabled={supervisorAgents.length === 0}
              >
                {supervisorAgents.map(agent => (
                  <Option key={agent.id} value={agent.id}>
                    {agent.name} ({agent.role_name})
                  </Option>
                ))}
              </Select>
              {supervisorAgents.length === 0 && (
                <Alert
                  message={t('rules.modal.noSupervisor')}
                  type="warning"
                  showIcon
                  style={{ marginTop: 8 }}
                />
              )}
            </div>
          )}


          {/* 操作按钮 - 放在结果列表上方 */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, margin: '8px 0 16px' }}>
            <Button onClick={() => setCheckModalVisible(false)}>
              {t('cancel')}
            </Button>
            <Button
              type="primary"
              icon={<PlayCircleOutlined />}
              loading={checking}
              onClick={executeRuleCheck}
              disabled={loadingRules}
            >
              {t('rules.modal.startCheck')}
            </Button>
          </div>

          {/* 检查结果 */}
          {checkResults.length > 0 && (
            <div style={{ marginTop: 24 }}>
              <Divider>{t('rules.modal.checkResults')}</Divider>
              {renderCheckSummary()}
              {renderCheckResults()}



              {/* 结果说明 */}
              <Alert
                message={t('rules.modal.resultsExplanation')}
                description={
                  <div>
                    <p>• <strong>{t('rules.card.logicRule')}</strong>：{t('rules.modal.logicRuleExplanation')}</p>
                    <p>• <strong>{t('rules.card.llmRule')}</strong>：{t('rules.modal.llmRuleExplanation')}</p>
                    <p>• {t('rules.modal.variableReplacement')}</p>
                  </div>
                }
                type="info"
                showIcon
                style={{ marginTop: 16 }}
              />
            </div>
          )}
        </Spin>
      </Modal>
    </div>
  );
});

export default ActionTaskRules;