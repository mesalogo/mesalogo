import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Modal, Form, Input, Radio, Select, Button, Card, Space, Typography,
  Spin, message, Empty, Tooltip, Tag, Collapse, Row, Col, Checkbox
} from 'antd';
import {
  InfoCircleOutlined, QuestionCircleOutlined, BugOutlined, TeamOutlined
} from '@ant-design/icons';
import Editor from '@monaco-editor/react';
import { useTranslation } from 'react-i18next';
import { actionSpaceAPI } from '../../../services/api/actionspace';
import { extractTemplateVariables, getTemplateVariableInfo, formatEnvironmentVariables } from '../../../utils/templateUtils';

const { TextArea } = Input;
const { Text, Title } = Typography;
const { Option } = Select;

// debounce
const debounce = (func, wait) => {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

/**
 * Rule edit Modal — supports natural-language rules and logic rules.
 */
const RuleEditModal = ({ visible, rule, roles, environmentVariables, onCancel, onSuccess }: any) => {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [ruleType, setRuleType] = useState('llm');
  
  // Monaco Editor 相关
  const [editorValue, setEditorValue] = useState('');
  const [editorLanguage, setEditorLanguage] = useState('javascript');
  const editorRef = useRef(null);
  const textAreaRef = useRef(null);
  
  // 测试相关
  const [testContext, setTestContext] = useState('');
  const [testResults, setTestResults] = useState(null);
  const [isTestLoading, setIsTestLoading] = useState(false);
  const [selectedRoleId, setSelectedRoleId] = useState(null);
  const [testSectionCollapsed, setTestSectionCollapsed] = useState(true);
  const [rolesLoading, setRolesLoading] = useState(false);
  
  // 环境变量相关
  const [currentRuleVariables, setCurrentRuleVariables] = useState([]);

  // 分析模板变量
  const analyzeVariables = useCallback((content) => {
    if (!content) {
      setCurrentRuleVariables([]);
      return;
    }

    // getTemplateVariableInfo 接收完整的模板字符串，会自动提取和分析变量
    const variableInfoList = getTemplateVariableInfo(
      content,
      environmentVariables.internal,
      environmentVariables.external
    );
    setCurrentRuleVariables(variableInfoList);
  }, [environmentVariables]);

  // 防抖的变量分析
  const debouncedAnalyzeVariables = useCallback(
    debounce((content) => analyzeVariables(content), 500),
    [analyzeVariables]
  );

  // 插入变量到 TextArea
  const insertVariableToTextArea = (variableName) => {
    if (!textAreaRef.current) return;
    
    const textarea = textAreaRef.current.resizableTextArea.textArea;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const value = form.getFieldValue('content') || '';
    const varTemplate = `{{${variableName}}}`;
    const newValue = value.substring(0, start) + varTemplate + value.substring(end);
    
    form.setFieldsValue({ content: newValue });
    setTimeout(() => {
      const newCursorPos = start + varTemplate.length;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
      textarea.focus();
    }, 0);
    
    debouncedAnalyzeVariables(newValue);
  };

  // 插入变量到 Monaco Editor（逻辑规则使用）
  const insertVariableAtCursor = (variableName) => {
    const variableText = `{{${variableName}}}`;
    
    if (editorRef.current) {
      const editor = editorRef.current;
      const selection = editor.getSelection();
      const range = new (window as any).monaco.Range(
        selection.startLineNumber,
        selection.startColumn,
        selection.endLineNumber,
        selection.endColumn
      );
      
      const op = {
        range: range,
        text: variableText,
        forceMoveMarkers: true
      };
      
      editor.executeEdits('insert-variable', [op]);
      
      const newPosition = new (window as any).monaco.Position(
        selection.startLineNumber,
        selection.startColumn + variableText.length
      );
      editor.setPosition(newPosition);
      editor.focus();
      
      const newContent = editor.getValue();
      setEditorValue(newContent);
      form.setFieldsValue({ content: newContent });
      debouncedAnalyzeVariables(newContent);
    } else {
      // 如果编辑器未就绪，直接追加到内容末尾
      const currentContent = editorValue;
      const newContent = currentContent + variableText;
      setEditorValue(newContent);
      form.setFieldsValue({ content: newContent });
      debouncedAnalyzeVariables(newContent);
    }
  };

  // 初始化表单
  useEffect(() => {
    if (visible) {
      if (rule) {
        // 编辑模式
        const type = rule.type || 'llm';
        const interpreter = rule.interpreter || 'javascript';
        
        setRuleType(type);
        setEditorLanguage(interpreter === 'python' ? 'python' : 'javascript');
        setEditorValue(rule.content || '');
        
        setTimeout(() => {
          form.setFieldsValue({
            name: rule.name,
            content: rule.content,
            ruleType: type,
            interpreter: interpreter,
            is_shared: rule.is_shared || false
          });
          analyzeVariables(rule.content);
        }, 100);
      } else {
        // 创建模式
        setRuleType('llm');
        setEditorLanguage('javascript');
        setEditorValue('');
        form.resetFields();
        setCurrentRuleVariables([]);
      }
      
      // 重置测试相关状态
      setTestContext('');
      setTestResults(null);
      setSelectedRoleId(null);
      setTestSectionCollapsed(true);
    }
  }, [visible, rule, form, analyzeVariables]);

  // 当环境变量加载完成后，重新分析当前内容中的变量
  useEffect(() => {
    if (visible && (environmentVariables.internal.length > 0 || environmentVariables.external.length > 0)) {
      const content = form.getFieldValue('content') || editorValue || '';
      if (content) {
        analyzeVariables(content);
      }
    }
  }, [visible, environmentVariables, editorValue, form, analyzeVariables]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      const ruleData: any = {
        name: values.name,
        type: ruleType,
        content: values.content,
        is_shared: values.is_shared || false
      };

      if (ruleType === 'logic') {
        ruleData.interpreter = values.interpreter || 'javascript';
      }

      if (rule) {
        await actionSpaceAPI.updateRule(rule.id, ruleData);
        message.success(t('ruleEdit.msg.updateSuccess'));
      } else {
        await actionSpaceAPI.createRule(ruleData);
        message.success(t('ruleEdit.msg.createSuccess'));
      }

      form.resetFields();
      onSuccess();
    } catch (error) {
      console.error('save rule failed:', error);
      message.error(rule ? t('ruleEdit.msg.updateFailed') : t('ruleEdit.msg.createFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    form.resetFields();
    setTestContext('');
    setTestResults(null);
    setSelectedRoleId(null);
    setEditorValue('');
    setCurrentRuleVariables([]);
    onCancel();
  };

  const handleTestRule = async () => {
    if (ruleType === 'llm' && !testContext.trim()) {
      message.warning(t('ruleEdit.msg.enterScenario'));
      return;
    }

    if (ruleType === 'llm' && !selectedRoleId) {
      message.warning(t('ruleEdit.msg.pickRoleForLLM'));
      return;
    }

    setIsTestLoading(true);
    try {
      const currentRuleData = {
        id: rule?.id || 'temp-id',
        name: form.getFieldValue('name') || t('ruleEdit.tempRule'),
        type: ruleType,
        content: form.getFieldValue('content') || '',
        interpreter: form.getFieldValue('interpreter') || 'javascript'
      };

      const testData = ruleType === 'logic' ? { scenario: t('ruleEdit.defaultScenario') } : testContext;
      const variables = formatEnvironmentVariables(
        environmentVariables.internal,
        environmentVariables.external
      );

      const results = await actionSpaceAPI.testRules([currentRuleData], testData, selectedRoleId, variables);
      setTestResults(results);
      message.success(t('ruleEdit.msg.testDone'));
    } catch (error) {
      console.error('test rule failed:', error);
      message.error(t('ruleEdit.msg.testFailed'));
    } finally {
      setIsTestLoading(false);
    }
  };

  return (
    <Modal
      title={t('ruleEdit.modalTitle', {
        mode: rule ? t('ruleEdit.modeEdit') : t('ruleEdit.modeAdd'),
        kind: ruleType === 'llm' ? t('ruleEdit.kindLLM') : t('ruleEdit.kindLogic'),
      })}
      open={visible}
      onCancel={handleCancel}
      width={900}
      style={{ top: 20 }}
      styles={{ body: { maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' } }}
      footer={[
        <Button key="cancel" onClick={handleCancel}>{t('ruleEdit.cancel')}</Button>,
        <Button key="submit" type="primary" loading={loading} onClick={handleSubmit}>
          {rule ? t('ruleEdit.save') : t('ruleEdit.create')}
        </Button>
      ]}
    >
      <Form form={form} layout="vertical">
        <Form.Item
          name="name"
          label={t('ruleEdit.field.name')}
          rules={[{ required: true, message: t('ruleEdit.req.name') }]}
        >
          <Input placeholder={t('ruleEdit.ph.name')} />
        </Form.Item>

        <Form.Item name="ruleType" label={t('ruleEdit.field.ruleType')} initialValue={ruleType}>
          <Radio.Group onChange={e => setRuleType(e.target.value)} value={ruleType}>
            <Radio value="llm">{t('ruleEdit.kindLLMFull')}</Radio>
            <Radio value="logic">{t('ruleEdit.kindLogicFull')}</Radio>
          </Radio.Group>
        </Form.Item>

        <Form.Item name="is_shared" valuePropName="checked" tooltip={t('ruleEdit.tip.shareAll')}>
          <Checkbox>
            <Space>
              <TeamOutlined />
              {t('ruleEdit.shareAll')}
            </Space>
          </Checkbox>
        </Form.Item>

        {ruleType === 'llm' ? (
          <>
            <Form.Item
              name="content"
              label={
                <span>
                  {t('ruleEdit.field.content')}
                  <Tooltip title={t('ruleEdit.tip.varRef')}>
                    <InfoCircleOutlined style={{ marginLeft: 4, color: 'var(--custom-text-secondary)' }} />
                  </Tooltip>
                </span>
              }
              rules={[{ required: true, message: t('ruleEdit.req.content') }]}
            >
              <TextArea
                ref={textAreaRef}
                rows={8}
                placeholder={t('ruleEdit.ph.contentLLM')}
                onChange={(e) => debouncedAnalyzeVariables(e.target.value)}
              />
            </Form.Item>

            {currentRuleVariables.length > 0 && (
              <div style={{ marginBottom: 16, padding: '12px', backgroundColor: '#f6ffed', borderRadius: '6px', border: '1px solid #b7eb8f' }}>
                <div style={{ marginBottom: 8 }}>
                  <Text strong style={{ fontSize: '13px' }}>
                    <InfoCircleOutlined style={{ marginRight: 4, color: '#52c41a' }} />
                    {t('ruleEdit.detectedVars')}
                  </Text>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {currentRuleVariables.map((variable, index) => (
                    <Tooltip
                      key={index}
                      title={
                        <div>
                          <div><strong>{t('ruleEdit.varName')}</strong> {variable.name}</div>
                          <div><strong>{t('ruleEdit.varLabel')}</strong> {variable.label}</div>
                          <div><strong>{t('ruleEdit.varSource')}</strong> {variable.source}</div>
                          <div><strong>{t('ruleEdit.varValue')}</strong> {variable.value || t('ruleEdit.unset')}</div>
                        </div>
                      }
                    >
                      <Tag
                        color={variable.type === 'internal' ? 'blue' : variable.type === 'external' ? 'green' : 'red'}
                        style={{ cursor: 'help' }}
                      >
                        {variable.name}
                      </Tag>
                    </Tooltip>
                  ))}
                </div>
              </div>
            )}

            {(environmentVariables.internal.length > 0 || environmentVariables.external.length > 0) && (
              <Collapse
               
                style={{ marginBottom: 16 }}
                items={[
                  {
                    key: 'available-variables',
                    label: (
                      <span>
                        <InfoCircleOutlined style={{ marginRight: 4, color: '#1677ff' }} />
                        {t('ruleEdit.availVarsClickInsert')}
                      </span>
                    ),
                    children: (
                      <div>
                        {(() => {
                          const groupedInternalVars = environmentVariables.internal.reduce((groups, variable) => {
                            const spaceName = variable.action_space_name || t('ruleEdit.uncategorized');
                            if (!groups[spaceName]) groups[spaceName] = [];
                            groups[spaceName].push(variable);
                            return groups;
                          }, {});

                          return Object.keys(groupedInternalVars).map(spaceName => (
                            <div key={spaceName} style={{ marginBottom: 12 }}>
                              <div style={{ marginBottom: 6 }}>
                                <Text strong style={{ fontSize: '12px', color: '#1677ff' }}>
                                  📁 {spaceName} {t('ruleEdit.internalVarSuffix')}
                                </Text>
                              </div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginLeft: 12 }}>
                                {groupedInternalVars[spaceName].map((variable, index) => (
                                  <Tag
                                    key={index}
                                    color="blue"
                                    style={{ cursor: 'pointer', fontSize: '11px' }}
                                    onClick={() => insertVariableToTextArea(variable.name)}
                                  >
                                    {variable.name}
                                  </Tag>
                                ))}
                              </div>
                            </div>
                          ));
                        })()}

                        {environmentVariables.external.length > 0 && (
                          <div>
                            <div style={{ marginBottom: 6 }}>
                              <Text strong style={{ fontSize: '12px', color: '#52c41a' }}>
                                🌐 {t('ruleEdit.externalVars')}
                              </Text>
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginLeft: 12 }}>
                              {environmentVariables.external.map((variable, index) => (
                                <Tag
                                  key={index}
                                  color="green"
                                  style={{ cursor: 'pointer', fontSize: '11px' }}
                                  onClick={() => insertVariableToTextArea(variable.name)}
                                >
                                  {variable.name}
                                </Tag>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  }
                ]}
              />
            )}
          </>
        ) : (
          <>
            <Form.Item
              name="interpreter"
              label={
                <span>
                  {t('ruleEdit.field.interpreter')}
                  <Tooltip title={t('ruleEdit.tip.interpreter')}>
                    <QuestionCircleOutlined style={{ marginLeft: 4, color: 'var(--custom-text-secondary)' }} />
                  </Tooltip>
                </span>
              }
              initialValue="javascript"
              rules={[{ required: true, message: t('ruleEdit.req.interpreter') }]}
            >
              <Select
                placeholder={t('ruleEdit.ph.interpreter')}
                onChange={(value) => setEditorLanguage(value === 'python' ? 'python' : 'javascript')}
              >
                <Option value="javascript">JavaScript</Option>
                <Option value="python">Python</Option>
              </Select>
            </Form.Item>

            <Form.Item
              name="content"
              label={
                <span>
                  {t('ruleEdit.field.code')}
                  <Tooltip
                    title={
                      <div>
                        <div>{t('ruleEdit.tip.jsExample')}: return context.age {'>'}= 18;</div>
                        <div>{t('ruleEdit.tip.pyExample')}: return context['age'] {'>'}= 18</div>
                        <div>{t('ruleEdit.tip.returnBool')}</div>
                        <div>{t('ruleEdit.tip.varRefFmt', { fmt: '{{varName}}' })}</div>
                      </div>
                    }
                  >
                    <QuestionCircleOutlined style={{ marginLeft: 4, color: 'var(--custom-text-secondary)' }} />
                  </Tooltip>
                </span>
              }
              rules={[{ required: true, message: t('ruleEdit.req.code') }]}
            >
              <div style={{ border: '1px solid var(--custom-border)', borderRadius: '6px', overflow: 'hidden' }}>
                <Editor
                  height="200px"
                  language={editorLanguage}
                  theme="vs-dark"
                  value={editorValue}
                  onChange={(value) => {
                    const newValue = value || '';
                    setEditorValue(newValue);
                    form.setFieldsValue({ content: newValue });
                    debouncedAnalyzeVariables(newValue);
                  }}
                  onMount={(editor) => { editorRef.current = editor; }}
                  options={{
                    fontSize: 14,
                    fontFamily: 'JetBrains Mono, Consolas, monospace',
                    lineNumbers: 'on',
                    minimap: { enabled: false },
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                    tabSize: 2}}
                />
              </div>
            </Form.Item>

            {/* detected template variables — logic rule */}
            {currentRuleVariables.length > 0 && (
              <div style={{ marginBottom: 16, padding: '12px', backgroundColor: '#f6ffed', borderRadius: '6px', border: '1px solid #b7eb8f' }}>
                <div style={{ marginBottom: 8 }}>
                  <Text strong style={{ fontSize: '13px' }}>
                    <InfoCircleOutlined style={{ marginRight: 4, color: '#52c41a' }} />
                    {t('ruleEdit.detectedVars')}
                  </Text>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {currentRuleVariables.map((variable, index) => (
                    <Tooltip
                      key={index}
                      title={
                        <div>
                          <div><strong>{t('ruleEdit.varName')}</strong> {variable.name}</div>
                          <div><strong>{t('ruleEdit.varLabel')}</strong> {variable.label}</div>
                          <div><strong>{t('ruleEdit.varSource')}</strong> {variable.source}</div>
                          <div><strong>{t('ruleEdit.varValue')}</strong> {variable.value || t('ruleEdit.unset')}</div>
                        </div>
                      }
                    >
                      <Tag
                        color={variable.type === 'internal' ? 'blue' : variable.type === 'external' ? 'green' : 'red'}
                        style={{ cursor: 'help' }}
                      >
                        {variable.name}
                      </Tag>
                    </Tooltip>
                  ))}
                </div>
              </div>
            )}

            {/* available env vars — logic rule */}
            {(environmentVariables.internal.length > 0 || environmentVariables.external.length > 0) && (
              <Collapse

                style={{ marginBottom: 16 }}
                items={[
                  {
                    key: 'available-variables-logic',
                    label: (
                      <span>
                        <InfoCircleOutlined style={{ marginRight: 4, color: '#1677ff' }} />
                        {t('ruleEdit.availVarsClickInsertCode')}
                      </span>
                    ),
                    children: (
                      <div>
                        {(() => {
                          const groupedInternalVars = environmentVariables.internal.reduce((groups, variable) => {
                            const spaceName = variable.action_space_name || t('ruleEdit.uncategorized');
                            if (!groups[spaceName]) groups[spaceName] = [];
                            groups[spaceName].push(variable);
                            return groups;
                          }, {});

                          return Object.keys(groupedInternalVars).map(spaceName => (
                            <div key={spaceName} style={{ marginBottom: 12 }}>
                              <div style={{ marginBottom: 6 }}>
                                <Text strong style={{ fontSize: '12px', color: '#1677ff' }}>
                                  📁 {spaceName} {t('ruleEdit.internalVarSuffix')}
                                </Text>
                              </div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginLeft: 12 }}>
                                {groupedInternalVars[spaceName].map((variable, index) => (
                                  <Tooltip
                                    key={index}
                                    title={
                                      <div>
                                        <div><strong>{t('ruleEdit.varName')}</strong> {variable.name}</div>
                                        <div><strong>{t('ruleEdit.varLabel')}</strong> {variable.label}</div>
                                        <div><strong>{t('ruleEdit.varActionSpace')}</strong> {variable.action_space_name}</div>
                                        <div><strong>{t('ruleEdit.varDefault')}</strong> {variable.value || t('ruleEdit.unset')}</div>
                                        <div style={{ marginTop: 4, fontSize: '12px', color: 'var(--custom-text-secondary)' }}>{t('ruleEdit.clickInsertCode')}</div>
                                      </div>
                                    }
                                  >
                                    <Tag
                                      color="blue"
                                      style={{ cursor: 'pointer', fontSize: '11px' }}
                                      onClick={() => insertVariableAtCursor(variable.name)}
                                    >
                                      {variable.name}
                                    </Tag>
                                  </Tooltip>
                                ))}
                              </div>
                            </div>
                          ));
                        })()}

                        {environmentVariables.external.length > 0 && (
                          <div>
                            <div style={{ marginBottom: 6 }}>
                              <Text strong style={{ fontSize: '12px', color: '#52c41a' }}>
                                🌐 {t('ruleEdit.externalVars')}
                              </Text>
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginLeft: 12 }}>
                              {environmentVariables.external.map((variable, index) => (
                                <Tooltip
                                  key={index}
                                  title={
                                    <div>
                                      <div><strong>{t('ruleEdit.varName')}</strong> {variable.name}</div>
                                      <div><strong>{t('ruleEdit.varLabel')}</strong> {variable.label}</div>
                                      <div><strong>{t('ruleEdit.varValue')}</strong> {variable.value || t('ruleEdit.unset')}</div>
                                      <div style={{ marginTop: 4, fontSize: '12px', color: 'var(--custom-text-secondary)' }}>{t('ruleEdit.clickInsertCode')}</div>
                                    </div>
                                  }
                                >
                                  <Tag
                                    color="green"
                                    style={{ cursor: 'pointer', fontSize: '11px' }}
                                    onClick={() => insertVariableAtCursor(variable.name)}
                                  >
                                    {variable.name}
                                  </Tag>
                                </Tooltip>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  }
                ]}
              />
            )}
          </>
        )}
      </Form>

      {/* test area */}
      <Collapse

        activeKey={testSectionCollapsed ? [] : ['test']}
        onChange={() => setTestSectionCollapsed(!testSectionCollapsed)}
        items={[
          {
            key: 'test',
            label: (
              <span>
                <BugOutlined style={{ marginRight: 4 }} />
                {t('ruleEdit.testOptional')}
              </span>
            ),
            children: (
              <Row gutter={16}>
                <Col xs={24} md={12}>
                  <div>
                    {ruleType === 'llm' && (
                      <div style={{ marginBottom: 16 }}>
                        <Title level={5}>{t('ruleEdit.pickTestRole')}</Title>
                        <Select
                          placeholder={t('ruleEdit.ph.pickRole')}
                          style={{ width: '100%' }}
                          value={selectedRoleId}
                          onChange={setSelectedRoleId}
                          loading={rolesLoading}
                        >
                          {roles.map(role => (
                            <Option key={role.id} value={role.id}>{role.name}</Option>
                          ))}
                        </Select>
                      </div>
                    )}

                    {ruleType === 'llm' && (
                      <div>
                        <Title level={5}>{t('ruleEdit.enterScenario')}</Title>
                        <TextArea
                          rows={6}
                          value={testContext}
                          onChange={e => setTestContext(e.target.value)}
                          placeholder={t('ruleEdit.ph.scenario')}
                        />
                      </div>
                    )}

                    <div style={{ marginTop: 16 }}>
                      <Space>
                        <Button type="primary" onClick={handleTestRule} loading={isTestLoading}>
                          {t('ruleEdit.runTest')}
                        </Button>
                        <Button onClick={() => { setTestContext(''); setTestResults(null); setSelectedRoleId(null); }}>
                          {t('ruleEdit.reset')}
                        </Button>
                      </Space>
                    </div>
                  </div>
                </Col>

                <Col xs={24} md={12}>
                  <div>
                    <Title level={5}>{t('ruleEdit.testResults')}</Title>
                    {isTestLoading ? (
                      <div style={{ textAlign: 'center', padding: '20px 0' }}>
                        <Spin><div style={{ padding: '20px' }}>{t('ruleEdit.testing')}</div></Spin>
                      </div>
                    ) : testResults ? (
                      <div>
                        {testResults.results.map((result, index) => (
                          <Card
                            key={index}

                            style={{
                              marginBottom: 8,
                              borderLeft: `4px solid ${result.passed ? '#52c41a' : '#f5222d'}`
                            }}
                          >
                            <div>
                              <Space>
                                <Text strong>{result.rule_name}</Text>
                                <Tag color={result.passed ? 'success' : 'error'}>
                                  {result.passed ? t('ruleEdit.pass') : t('ruleEdit.fail')}
                                </Tag>
                              </Space>
                            </div>
                            <div style={{ marginTop: 8 }}>
                              <Text>{result.message}</Text>
                            </div>
                          </Card>
                        ))}
                      </div>
                    ) : (
                      <Empty description={t('ruleEdit.noTestYet')} />
                    )}
                  </div>
                </Col>
              </Row>
            )
          }
        ]}
      />
    </Modal>
  );
};

export default RuleEditModal;
