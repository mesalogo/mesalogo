import React, { useState } from 'react';
import { Card, Input, Button, Select, Space, Alert, Spin, Typography, Tag, Divider, InputNumber } from 'antd';
import { SearchOutlined, ThunderboltOutlined, GlobalOutlined, AimOutlined, BranchesOutlined, MergeCellsOutlined } from '@ant-design/icons';
import knowledgeAPI from '../../../services/api/knowledge';
import { MarkdownRenderer } from '../../actiontask/components/ConversationExtraction';

const { TextArea } = Input;
const { Option } = Select;
const { Title, Text, Paragraph } = Typography;

interface LightRAGQueryTestProps {
  knowledgeId: string;
  defaultMode?: string;
  enableModeSelection?: boolean;
}

const LightRAGQueryTest: React.FC<LightRAGQueryTestProps> = ({
  knowledgeId,
  defaultMode = 'mix',
  enableModeSelection = true,
}) => {
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState(defaultMode);
  const [topK, setTopK] = useState(10);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleQuery = async () => {
    if (!query.trim()) {
      setError('请输入查询内容');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setResult(null);

      const response = await knowledgeAPI.lightrag.query(knowledgeId, {
        query: query.trim(),
        mode: mode as any,
        top_k: topK,
      });

      if (response.success) {
        setResult(response.data);
      } else {
        setError(response.message || '查询失败');
      }
    } catch (err: any) {
      console.error('查询失败:', err);
      setError(err.message || '查询失败');
    } finally {
      setLoading(false);
    }
  };

  const getModeIcon = (m: string) => {
    switch (m) {
      case 'naive': return <ThunderboltOutlined />;
      case 'local': return <AimOutlined />;
      case 'global': return <GlobalOutlined />;
      case 'hybrid': return <BranchesOutlined />;
      case 'mix': return <MergeCellsOutlined />;
      default: return <SearchOutlined />;
    }
  };

  const getModeDescription = (m: string) => {
    switch (m) {
      case 'naive': return '纯向量检索，速度最快';
      case 'local': return '基于实体的图谱检索';
      case 'global': return '基于关系的图谱检索';
      case 'hybrid': return '实体+关系混合检索';
      case 'mix': return '图谱+向量混合检索（推荐）';
      default: return '';
    }
  };

  return (
    <div>
      <Alert
        message="LightRAG 查询测试"
        description="支持多种查询模式，可以根据不同场景选择最合适的检索策略。"
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
      />

      <Card title="查询配置" style={{ marginBottom: 16 }}>
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <div>
            <Text strong>查询内容</Text>
            <TextArea
              rows={4}
              placeholder="请输入查询内容..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={{ marginTop: 8 }}
            />
          </div>

          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end' }}>
            {enableModeSelection && (
              <div style={{ flex: 1 }}>
                <Text strong>查询模式</Text>
                <Select
                  value={mode}
                  onChange={setMode}
                  style={{ width: '100%', marginTop: 8 }}
                >
                  <Option value="naive">
                    <Space>
                      {getModeIcon('naive')}
                      Naive - {getModeDescription('naive')}
                    </Space>
                  </Option>
                  <Option value="local">
                    <Space>
                      {getModeIcon('local')}
                      Local - {getModeDescription('local')}
                    </Space>
                  </Option>
                  <Option value="global">
                    <Space>
                      {getModeIcon('global')}
                      Global - {getModeDescription('global')}
                    </Space>
                  </Option>
                  <Option value="hybrid">
                    <Space>
                      {getModeIcon('hybrid')}
                      Hybrid - {getModeDescription('hybrid')}
                    </Space>
                  </Option>
                  <Option value="mix">
                    <Space>
                      {getModeIcon('mix')}
                      Mix - {getModeDescription('mix')}
                    </Space>
                  </Option>
                </Select>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <Text strong>Top-K</Text>
              <InputNumber
                min={1}
                max={50}
                value={topK}
                onChange={(val) => setTopK(val || 10)}
                style={{ width: 100, marginTop: 8 }}
              />
            </div>
          </div>

          <Button
            type="primary"
            icon={<SearchOutlined />}
            onClick={handleQuery}
            loading={loading}
            block
          >
            查询
          </Button>
        </Space>
      </Card>

      {loading && (
        <Card>
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <Spin size="large" />
            <div style={{ marginTop: 16 }}>
              <Text type="secondary">正在查询中...</Text>
            </div>
          </div>
        </Card>
      )}

      {error && (
        <Alert
          message="查询失败"
          description={error}
          type="error"
          showIcon
          closable
          onClose={() => setError(null)}
        />
      )}

      {result && !loading && (
        <Card title="查询结果">
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <div>
              <Space>
                <Tag color="blue">模式: {result.mode || mode}</Tag>
                <Tag color="green">耗时: {result.elapsed_time || '-'}ms</Tag>
                {result.sources_count && (
                  <Tag color="purple">来源: {result.sources_count} 个</Tag>
                )}
              </Space>
            </div>

            <Divider />

            <div>
              <Title level={5}>回答</Title>
              <Card style={{ backgroundColor: '#f5f5f5' }}>
                <MarkdownRenderer content={result.result?.response || result.answer || result.response || '无结果'} />
              </Card>
            </div>

            {(result.result?.references || result.sources) && (result.result?.references?.length > 0 || result.sources?.length > 0) && (
              <div>
                <Title level={5}>来源文档</Title>
                <Space direction="vertical" style={{ width: '100%' }}>
                  {(result.result?.references || result.sources || []).map((source: any, index: number) => (
                    <Card key={index} size="small">
                      <Paragraph ellipsis={{ rows: 3, expandable: true }}>
                        {source.content || source.text || source.file_path || '无内容'}
                      </Paragraph>
                      {(source.metadata || source.file_path) && (
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          来源: {source.metadata?.source || source.metadata?.file_name || source.file_path || '未知'}
                        </Text>
                      )}
                    </Card>
                  ))}
                </Space>
              </div>
            )}
          </Space>
        </Card>
      )}
    </div>
  );
};

export default LightRAGQueryTest;
