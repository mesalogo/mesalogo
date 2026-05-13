import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Modal, Form, Input, Radio, Select, Button, Card, Space, Typography,
  Spin, message, Empty, Tooltip, Tag, Collapse, Row, Col, Checkbox
} from 'antd';
import {
  InfoCircleOutlined, QuestionCircleOutlined, BugOutlined, TeamOutlined
} from '@ant-design/icons';
import Editor from '@monaco-editor/react';
import { actionSpaceAPI } from '../../../services/api/actionspace';
import { extractTemplateVariables, getTemplateVariableInfo, formatEnvironmentVariables } from '../../../utils/templateUtils';

const { TextArea } = Input;
const { Text, Title } = Typography;
const { Option } = Select;

// 防抖函数
const debounce = (func, wait) => {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

/**
 * 规则编辑 Modal - 支持自然语言规则和逻辑规则
 */
const RuleEditModal = ({ visible, rule, roles, environmentVariables, onCancel, onSuccess }: any) => {
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
        message.success('规则更新成功');
      } else {
        await actionSpaceAPI.createRule(ruleData);
        message.success('规则创建成功');
      }

      form.resetFields();
      onSuccess();
    } catch (error) {
      console.error('保存规则失败:', error);
      message.error(rule ? '更新规则失败' : '创建规则失败');
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
      message.warning('请输入测试场景描述');
      return;
    }

    if (ruleType === 'llm' && !selectedRoleId) {
      message.warning('测试自然语言规则时请选择一个角色');
      return;
    }

    setIsTestLoading(true);
    try {
      const currentRuleData = {
        id: rule?.id || 'temp-id',
        name: form.getFieldValue('name') || '临时规则',
        type: ruleType,
        content: form.getFieldValue('content') || '',
        interpreter: form.getFieldValue('interpreter') || 'javascript'
      };

      const testData = ruleType === 'logic' ? { scenario: '默认测试场景' } : testContext;
      const variables = formatEnvironmentVariables(
        environmentVariables.internal,
        environmentVariables.external
      );

      const results = await actionSpaceAPI.testRules([currentRuleData], testData, selectedRoleId, variables);
      setTestResults(results);
      message.success('规则测试完成');
    } catch (error) {
      console.error('规则测试失败:', error);
      message.error('规则测试失败');
    } finally {
      setIsTestLoading(false);
    }
  };

  return (
    <Modal
      title={`${rule ? '编辑' : '添加'}${ruleType === 'llm' ? '自然语言' : '逻辑'}规则`}
      open={visible}
      onCancel={handleCancel}
      width={900}
      style={{ top: 20 }}
      styles={{ body: { maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' } }}
      footer={[
        <Button key="cancel" onClick={handleCancel}>取消</Button>,
        <Button key="submit" type="primary" loading={loading} onClick={handleSubmit}>
          {rule ? '保存' : '创建'}
        </Button>
      ]}
    >
      <Form form={form} layout="vertical">
        <Form.Item
          name="name"
          label="规则名称"
          rules={[{ required: true, message: '请输入规则名称' }]}
        >
          <Input placeholder="输入规则名称" />
        </Form.Item>

        <Form.Item name="ruleType" label="规则类型" initialValue={ruleType}>
          <Radio.Group onChange={e => setRuleType(e.target.value)} value={ruleType}>
            <Radio value="llm">自然语言规则</Radio>
            <Radio value="logic">逻辑规则</Radio>
          </Radio.Group>
        </Form.Item>

        <Form.Item name="is_shared" valuePropName="checked" tooltip="勾选后，该规则将对所有用户可见可用（但只有创建者可编辑）">
          <Checkbox>
            <Space>
              <TeamOutlined />
              共享给所有用户
            </Space>
          </Checkbox>
        </Form.Item>

        {ruleType === 'llm' ? (
          <>
            <Form.Item
              name="content"
              label={
                <span>
                  规则内容
                  <Tooltip title="可以使用 {{变量名}} 格式引用环境变量">
                    <InfoCircleOutlined style={{ marginLeft: 4, color: 'var(--custom-text-secondary)' }} />
                  </Tooltip>
                </span>
              }
              rules={[{ required: true, message: '请输入规则内容' }]}
            >
              <TextArea
                ref={textAreaRef}
                rows={8}
                placeholder="使用自然语言描述规则，例如：如果玩家进入危险区域，则生命值每秒减少10点。可以使用 {{变量名}} 引用环境变量。"
                onChange={(e) => debouncedAnalyzeVariables(e.target.value)}
              />
            </Form.Item>

            {currentRuleVariables.length > 0 && (
              <div style={{ marginBottom: 16, padding: '12px', backgroundColor: '#f6ffed', borderRadius: '6px', border: '1px solid #b7eb8f' }}>
                <div style={{ marginBottom: 8 }}>
                  <Text strong style={{ fontSize: '13px' }}>
                    <InfoCircleOutlined style={{ marginRight: 4, color: '#52c41a' }} />
                    检测到的模板变量:
                  </Text>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {currentRuleVariables.map((variable, index) => (
                    <Tooltip
                      key={index}
                      title={
                        <div>
                          <div><strong>变量名:</strong> {variable.name}</div>
                          <div><strong>标签:</strong> {variable.label}</div>
                          <div><strong>来源:</strong> {variable.source}</div>
                          <div><strong>当前值:</strong> {variable.value || '未设置'}</div>
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
                        可用环境变量 (点击插入)
                      </span>
                    ),
                    children: (
                      <div>
                        {(() => {
                          const groupedInternalVars = environmentVariables.internal.reduce((groups, variable) => {
                            const spaceName = variable.action_space_name || '未分类';
                            if (!groups[spaceName]) groups[spaceName] = [];
                            groups[spaceName].push(variable);
                            return groups;
                          }, {});

                          return Object.keys(groupedInternalVars).map(spaceName => (
                            <div key={spaceName} style={{ marginBottom: 12 }}>
                              <div style={{ marginBottom: 6 }}>
                                <Text strong style={{ fontSize: '12px', color: '#1677ff' }}>
                                  📁 {spaceName} (内部变量)
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
                                🌐 外部环境变量
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
                  规则解释器
                  <Tooltip title="选择用于执行规则代码的解释器">
                    <QuestionCircleOutlined style={{ marginLeft: 4, color: 'var(--custom-text-secondary)' }} />
                  </Tooltip>
                </span>
              }
              initialValue="javascript"
              rules={[{ required: true, message: '请选择规则解释器' }]}
            >
              <Select
                placeholder="选择规则解释器"
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
                  规则代码
                  <Tooltip
                    title={
                      <div>
                        <div>JavaScript示例: return context.age {'>'}= 18;</div>
                        <div>Python示例: return context['age'] {'>'}= 18</div>
                        <div>规则代码需要返回布尔值</div>
                        <div>可以使用 {'{'}{'{'} 变量名 {'}'}{'}'}  格式引用环境变量</div>
                      </div>
                    }
                  >
                    <QuestionCircleOutlined style={{ marginLeft: 4, color: 'var(--custom-text-secondary)' }} />
                  </Tooltip>
                </span>
              }
              rules={[{ required: true, message: '请输入规则代码' }]}
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

            {/* 显示检测到的模板变量 - 逻辑规则 */}
            {currentRuleVariables.length > 0 && (
              <div style={{ marginBottom: 16, padding: '12px', backgroundColor: '#f6ffed', borderRadius: '6px', border: '1px solid #b7eb8f' }}>
                <div style={{ marginBottom: 8 }}>
                  <Text strong style={{ fontSize: '13px' }}>
                    <InfoCircleOutlined style={{ marginRight: 4, color: '#52c41a' }} />
                    检测到的模板变量:
                  </Text>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {currentRuleVariables.map((variable, index) => (
                    <Tooltip
                      key={index}
                      title={
                        <div>
                          <div><strong>变量名:</strong> {variable.name}</div>
                          <div><strong>标签:</strong> {variable.label}</div>
                          <div><strong>来源:</strong> {variable.source}</div>
                          <div><strong>当前值:</strong> {variable.value || '未设置'}</div>
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

            {/* 可用环境变量列表 - 逻辑规则 */}
            {(environmentVariables.internal.length > 0 || environmentVariables.external.length > 0) && (
              <Collapse
               
                style={{ marginBottom: 16 }}
                items={[
                  {
                    key: 'available-variables-logic',
                    label: (
                      <span>
                        <InfoCircleOutlined style={{ marginRight: 4, color: '#1677ff' }} />
                        可用环境变量 (点击插入到代码中)
                      </span>
                    ),
                    children: (
                      <div>
                        {(() => {
                          const groupedInternalVars = environmentVariables.internal.reduce((groups, variable) => {
                            const spaceName = variable.action_space_name || '未分类';
                            if (!groups[spaceName]) groups[spaceName] = [];
                            groups[spaceName].push(variable);
                            return groups;
                          }, {});

                          return Object.keys(groupedInternalVars).map(spaceName => (
                            <div key={spaceName} style={{ marginBottom: 12 }}>
                              <div style={{ marginBottom: 6 }}>
                                <Text strong style={{ fontSize: '12px', color: '#1677ff' }}>
                                  📁 {spaceName} (内部变量)
                                </Text>
                              </div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginLeft: 12 }}>
                                {groupedInternalVars[spaceName].map((variable, index) => (
                                  <Tooltip
                                    key={index}
                                    title={
                                      <div>
                                        <div><strong>变量名:</strong> {variable.name}</div>
                                        <div><strong>标签:</strong> {variable.label}</div>
                                        <div><strong>行动空间:</strong> {variable.action_space_name}</div>
                                        <div><strong>默认值:</strong> {variable.value || '未设置'}</div>
                                        <div style={{ marginTop: 4, fontSize: '12px', color: 'var(--custom-text-secondary)' }}>点击插入到代码中</div>
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
                                🌐 外部环境变量
                              </Text>
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginLeft: 12 }}>
                              {environmentVariables.external.map((variable, index) => (
                                <Tooltip
                                  key={index}
                                  title={
                                    <div>
                                      <div><strong>变量名:</strong> {variable.name}</div>
                                      <div><strong>标签:</strong> {variable.label}</div>
                                      <div><strong>当前值:</strong> {variable.value || '未设置'}</div>
                                      <div style={{ marginTop: 4, fontSize: '12px', color: 'var(--custom-text-secondary)' }}>点击插入到代码中</div>
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

      {/* 测试区域 */}
      <Collapse
       
        activeKey={testSectionCollapsed ? [] : ['test']}
        onChange={() => setTestSectionCollapsed(!testSectionCollapsed)}
        items={[
          {
            key: 'test',
            label: (
              <span>
                <BugOutlined style={{ marginRight: 4 }} />
                规则测试 (可选)
              </span>
            ),
            children: (
              <Row gutter={16}>
                <Col xs={24} md={12}>
                  <div>
                    {ruleType === 'llm' && (
                      <div style={{ marginBottom: 16 }}>
                        <Title level={5}>选择测试角色</Title>
                        <Select
                          placeholder="选择一个角色"
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
                        <Title level={5}>输入测试场景</Title>
                        <TextArea
                          rows={6}
                          value={testContext}
                          onChange={e => setTestContext(e.target.value)}
                          placeholder="描述一个测试场景"
                        />
                      </div>
                    )}

                    <div style={{ marginTop: 16 }}>
                      <Space>
                        <Button type="primary" onClick={handleTestRule} loading={isTestLoading}>
                          执行测试
                        </Button>
                        <Button onClick={() => { setTestContext(''); setTestResults(null); setSelectedRoleId(null); }}>
                          重置
                        </Button>
                      </Space>
                    </div>
                  </div>
                </Col>

                <Col xs={24} md={12}>
                  <div>
                    <Title level={5}>测试结果</Title>
                    {isTestLoading ? (
                      <div style={{ textAlign: 'center', padding: '20px 0' }}>
                        <Spin><div style={{ padding: '20px' }}>测试执行中...</div></Spin>
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
                                  {result.passed ? '通过' : '失败'}
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
                      <Empty description="尚未执行测试" />
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
