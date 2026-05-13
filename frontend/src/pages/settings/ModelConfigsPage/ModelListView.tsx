import React, { useState, useEffect, useMemo } from 'react';
import {
  Card,
  Row,
  Col,
  Button,
  Table,
  Space,
  Input,
  Tooltip,
  Tag,
  Typography,
  Dropdown,
  Badge,
  Pagination,
  Skeleton,
  Segmented
} from 'antd';
import {
  EditOutlined,
  DeleteOutlined,
  ThunderboltOutlined,
  SearchOutlined,
  FilterOutlined,
  AppstoreOutlined,
  OrderedListOutlined
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';

const { Text } = Typography;

// 常量配置 - 直接放在文件中（KISS原则）
// 使用翻译key，在渲染时通过t函数翻译
const getModelModalities = (t) => [
  { value: 'text_input', labelKey: 'modelConfig.modality.textInput', icon: '📄', color: 'blue', descKey: 'modelConfig.modality.textInput.desc' },
  { value: 'text_output', labelKey: 'modelConfig.modality.textOutput', icon: '📄', color: 'blue', descKey: 'modelConfig.modality.textOutput.desc' },
  { value: 'image_input', labelKey: 'modelConfig.modality.imageInput', icon: '🖼️', color: 'purple', descKey: 'modelConfig.modality.imageInput.desc' },
  { value: 'image_output', labelKey: 'modelConfig.modality.imageOutput', icon: '🖼️', color: 'purple', descKey: 'modelConfig.modality.imageOutput.desc' },
  { value: 'audio_input', labelKey: 'modelConfig.modality.audioInput', icon: '🎵', color: 'orange', descKey: 'modelConfig.modality.audioInput.desc' },
  { value: 'audio_output', labelKey: 'modelConfig.modality.audioOutput', icon: '🎵', color: 'orange', descKey: 'modelConfig.modality.audioOutput.desc' },
  { value: 'video_input', labelKey: 'modelConfig.modality.videoInput', icon: '🎬', color: 'red', descKey: 'modelConfig.modality.videoInput.desc' },
  { value: 'video_output', labelKey: 'modelConfig.modality.videoOutput', icon: '🎬', color: 'red', descKey: 'modelConfig.modality.videoOutput.desc' },
  { value: 'vector_output', labelKey: 'modelConfig.modality.vectorOutput', icon: '📊', color: 'green', descKey: 'modelConfig.modality.vectorOutput.desc' },
  { value: 'rerank_input', labelKey: 'modelConfig.modality.rerankInput', icon: '🔄', color: 'orange', descKey: 'modelConfig.modality.rerankInput.desc' },
  { value: 'rerank_output', labelKey: 'modelConfig.modality.rerankOutput', icon: '📊', color: 'orange', descKey: 'modelConfig.modality.rerankOutput.desc' },
];

const getModelCapabilities = (t) => [
  { value: 'function_calling', labelKey: 'modelConfig.capability.functionCalling', icon: '🔧', color: 'geekblue', descKey: 'modelConfig.capability.functionCalling.desc' },
  { value: 'reasoning', labelKey: 'modelConfig.capability.reasoning', icon: '🧠', color: 'gold', descKey: 'modelConfig.capability.reasoning.desc' },
];

// 获取provider翻译名称的函数
const getProviderName = (provider, t) => {
  const key = `modelConfig.provider.${provider}`;
  const translated = t(key);
  // 如果翻译key不存在，返回原始provider名称
  return translated === key ? provider : translated;
};

const ModelListView = ({ 
  modelConfigs, 
  loading, 
  onEdit, 
  onDelete,
  onTest,
  providerStats,
  capabilityStats
}) => {
  const { t } = useTranslation();
  
  const MODEL_MODALITIES = getModelModalities(t);
  const MODEL_CAPABILITIES = getModelCapabilities(t);
  
  // 视图模式和过滤状态
  const [viewMode, setViewMode] = useState('card');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [selectedProviders, setSelectedProviders] = useState([]);
  const [selectedCapabilities, setSelectedCapabilities] = useState([]);
  const [cardPagination, setCardPagination] = useState({ current: 1, pageSize: 12 });
  
  // 当过滤条件改变时，重置分页到第一页
  useEffect(() => {
    setCardPagination(prev => ({ ...prev, current: 1 }));
  }, [selectedProviders, selectedCapabilities, searchKeyword]);
  
  // 过滤和排序模型
  const filteredModels = useMemo(() => {
    return modelConfigs.filter(model => {
      // 搜索关键词过滤
      if (searchKeyword.trim()) {
        const keyword = searchKeyword.toLowerCase();
        const matchesName = model.name.toLowerCase().includes(keyword);
        const matchesModelId = model.model_id.toLowerCase().includes(keyword);
        const matchesProvider = getProviderName(model.provider, t).toLowerCase().includes(keyword);
        if (!matchesName && !matchesModelId && !matchesProvider) {
          return false;
        }
      }
      
      // 提供商过滤
      if (selectedProviders.length > 0 && !selectedProviders.includes(model.provider)) {
        return false;
      }
      
      // 能力标签过滤
      if (selectedCapabilities.length > 0) {
        const modelCapabilities = model.capabilities || [];
        const hasMatchingCapability = selectedCapabilities.some(cap =>
          modelCapabilities.includes(cap)
        );
        if (!hasMatchingCapability) {
          return false;
        }
      }
      
      return true;
    }).sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
  }, [modelConfigs, searchKeyword, selectedProviders, selectedCapabilities]);
  
  // 渲染过滤器
  const renderFilters = () => {
    const existingProviders = Object.keys(providerStats).filter(provider => providerStats[provider] > 0);
    const providerItems = existingProviders.map(provider => ({
      key: provider,
      label: (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{getProviderName(provider, t)}</span>
          <Badge count={providerStats[provider]} />
        </div>
      ),
    }));
    
    const existingCapabilities = Object.keys(capabilityStats).filter(cap => capabilityStats[cap] > 0);
    const capabilityItems = existingCapabilities.map(capValue => {
      const capConfig = MODEL_CAPABILITIES.find(c => c.value === capValue) ||
        { value: capValue, labelKey: capValue, color: 'default' };
      return {
        key: capValue,
        label: (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Tag color={capConfig.color}>{capConfig.labelKey ? t(capConfig.labelKey) : capValue}</Tag>
            <Badge count={capabilityStats[capValue]} />
          </div>
        ),
      };
    });
    
    return (
      <Space size="middle">
        {(searchKeyword.trim() || selectedProviders.length > 0 || selectedCapabilities.length > 0) && (
          <Button
            type="text"
            onClick={() => {
              setSearchKeyword('');
              setSelectedProviders([]);
              setSelectedCapabilities([]);
            }}
            style={{ color: '#ff4d4f' }}
          >
            {t('modelConfig.list.clearFilters')}
          </Button>
        )}
        
        {existingProviders.length > 0 && (
          <Dropdown
            menu={{
              items: providerItems,
              selectable: true,
              multiple: true,
              selectedKeys: selectedProviders,
              onSelect: ({ selectedKeys }) => setSelectedProviders(selectedKeys),
              onDeselect: ({ selectedKeys }) => setSelectedProviders(selectedKeys),
            }}
            trigger={['click']}
          >
            <Button
              icon={<FilterOutlined />}
              type={selectedProviders.length > 0 ? "primary" : "default"}
            >
              {t('modelConfig.list.providerFilter')} {selectedProviders.length > 0 && (
                <Badge count={selectedProviders.length} 
                  style={{ backgroundColor: 'var(--custom-card-bg)', color: '#1677ff', marginLeft: '4px' }} />
              )}
            </Button>
          </Dropdown>
        )}
        
        {existingCapabilities.length > 0 && (
          <Dropdown
            menu={{
              items: capabilityItems,
              selectable: true,
              multiple: true,
              selectedKeys: selectedCapabilities,
              onSelect: ({ selectedKeys }) => setSelectedCapabilities(selectedKeys),
              onDeselect: ({ selectedKeys }) => setSelectedCapabilities(selectedKeys),
            }}
            trigger={['click']}
          >
            <Button
              icon={<FilterOutlined />}
              type={selectedCapabilities.length > 0 ? "primary" : "default"}
            >
              {t('modelConfig.list.capabilityFilter')} {selectedCapabilities.length > 0 && (
                <Badge count={selectedCapabilities.length}
                  style={{ backgroundColor: 'var(--custom-card-bg)', color: '#1677ff', marginLeft: '4px' }} />
              )}
            </Button>
          </Dropdown>
        )}
      </Space>
    );
  };
  
  // 网格展示卡片统一样式
  const gridCardStyle = {
    height: '100%',
    borderRadius: '8px',
    boxShadow: 'var(--custom-shadow)',
    display: 'flex',
    flexDirection: 'column' as const
  };

  const gridCardBodyStyle = {
    padding: '12px',
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const
  };

  // 渲染卡片视图
  const renderCardView = () => {
    if (loading) {
      return (
        <Row gutter={[16, 16]}>
          {[1, 2, 3, 4, 5, 6].map(item => (
            <Col xs={24} sm={12} lg={8} xl={6} key={item}>
              <Card style={gridCardStyle}>
                <Skeleton active avatar paragraph={{ rows: 4 }} />
              </Card>
            </Col>
          ))}
        </Row>
      );
    }
    
    if (filteredModels.length === 0) {
      return (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <Text type="secondary">
            {modelConfigs.length === 0 ? t('modelConfig.list.noConfigurations') : t('modelConfig.list.noMatchingModels')}
          </Text>
        </div>
      );
    }
    
    const { current, pageSize } = cardPagination;
    const startIndex = (current - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedModels = filteredModels.slice(startIndex, endIndex);
    
    return (
      <div>
        <Row gutter={[16, 16]} style={{ minHeight: '400px' }}>
          {paginatedModels.map(model => (
            <Col xs={24} sm={12} lg={8} xl={6} key={model.id}>
              <Card
               
                hoverable
                style={{
                  ...gridCardStyle,
                  border: (() => {
                    if (model.is_default_text) return '2px solid #1677ff';
                    if (model.is_default_embedding) return '2px solid #52c41a';
                    if (model.is_default_rerank) return '2px solid #fa8c16';
                    return 'none';
                  })()
                }}
                styles={{ body: gridCardBodyStyle }}
                actions={[
                  <Tooltip title={t('modelConfig.list.edit')}>
                    <EditOutlined style={{ color: '#1677ff' }} onClick={() => onEdit(model)} />
                  </Tooltip>,
                  <Tooltip title={t('modelConfig.testModel')}>
                    <ThunderboltOutlined
                      style={{ color: '#52c41a' }}
                      onClick={() => {
                        onTest(model);
                        document.querySelector('.model-test-section')?.scrollIntoView({ behavior: 'smooth' });
                      }}
                    />
                  </Tooltip>,
                  <Tooltip title={t('modelConfig.list.delete')}>
                    <DeleteOutlined
                      style={{ 
                        color: model.is_default_text || model.is_default_embedding || model.is_default_rerank 
                          ? '#d9d9d9' 
                          : '#ff4d4f',
                        cursor: model.is_default_text || model.is_default_embedding || model.is_default_rerank 
                          ? 'not-allowed' 
                          : 'pointer'
                      }}
                      onClick={() => {
                        if (!(model.is_default_text || model.is_default_embedding || model.is_default_rerank)) {
                          onDelete(model);
                        }
                      }}
                    />
                  </Tooltip>
                ]}
              >
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <div style={{ marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Text strong style={{ fontSize: '14px' }}>{model.name}</Text>
                    </div>
                    <div style={{ marginBottom: '8px' }}>
                      {model.is_default_text && <Tag color="blue">{t('modelConfig.list.defaultTextGeneration')}</Tag>}
                      {model.is_default_embedding && <Tag color="green">{t('modelConfig.list.defaultEmbedding')}</Tag>}
                      {model.is_default_rerank && <Tag color="orange">{t('modelConfig.list.defaultRerank')}</Tag>}
                    </div>
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                      {getProviderName(model.provider, t)}
                    </Text>
                  </div>
                  
                  <div style={{ marginBottom: '8px' }}>
                    <Text type="secondary" style={{ fontSize: '11px' }}>{t('modelConfig.list.modelId')}:</Text>
                    <br />
                    <Text style={{ fontSize: '12px', wordBreak: 'break-all' }}>{model.model_id}</Text>
                  </div>
                  
                  <div style={{ marginBottom: '8px' }}>
                    <Text type="secondary" style={{ fontSize: '11px' }}>{t('modelConfig.list.modalities')}:</Text>
                    <br />
                    {(() => {
                      const inputModalities = (model.modalities || []).filter(mod => mod.includes('_input'));
                      const outputModalities = (model.modalities || []).filter(mod => mod.includes('_output'));
                      return (
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            {inputModalities.length > 0 && (
                              <>
                                <Text type="secondary" style={{ fontSize: '10px', display: 'block', marginBottom: 2 }}>{t('modelConfig.list.inputLabel')}:</Text>
                                <Space size={[2, 2]} wrap>
                                  {inputModalities.map(mod => {
                                    const modConfig = MODEL_MODALITIES.find(m => m.value === mod) ||
                                      { labelKey: mod, icon: '?', color: 'default' };
                                    return (
                                      <Tag color={modConfig.color} key={mod}>
                                        <span style={{ marginRight: 2 }}>{modConfig.icon}</span>
                                        {modConfig.labelKey ? t(modConfig.labelKey).replace('输入', '').replace('Input', '') : mod}
                                      </Tag>
                                    );
                                  })}
                                </Space>
                              </>
                            )}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            {outputModalities.length > 0 && (
                              <>
                                <Text type="secondary" style={{ fontSize: '10px', display: 'block', marginBottom: 2 }}>{t('modelConfig.list.outputLabel')}:</Text>
                                <Space size={[2, 2]} wrap>
                                  {outputModalities.map(mod => {
                                    const modConfig = MODEL_MODALITIES.find(m => m.value === mod) ||
                                      { labelKey: mod, icon: '?', color: 'default' };
                                    return (
                                      <Tag color={modConfig.color} key={mod}>
                                        <span style={{ marginRight: 2 }}>{modConfig.icon}</span>
                                        {modConfig.labelKey ? t(modConfig.labelKey).replace('输出', '').replace('Output', '') : mod}
                                      </Tag>
                                    );
                                  })}
                                </Space>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                  
                  <div style={{ marginBottom: '8px' }}>
                    <Text type="secondary" style={{ fontSize: '11px' }}>{t('modelConfig.list.capabilities')}:</Text>
                    <br />
                    <Space size={[4, 4]} wrap>
                      {(model.capabilities || []).map(cap => {
                        const capConfig = MODEL_CAPABILITIES.find(c => c.value === cap) ||
                          { labelKey: cap, icon: '?', color: 'default' };
                        return (
                          <Tag color={capConfig.color} key={cap}>
                            <span style={{ marginRight: 2 }}>{capConfig.icon}</span>
                            {capConfig.labelKey ? t(capConfig.labelKey) : cap}
                          </Tag>
                        );
                      })}
                    </Space>
                  </div>
                  
                  <div style={{ fontSize: '11px', color: 'var(--custom-text-secondary)', marginTop: 'auto' }}>
                    <div>{t('modelConfig.list.context')}: {model.context_window?.toLocaleString()} tokens</div>
                    <div>{t('modelConfig.list.maxOutput')}: {model.max_output_tokens?.toLocaleString()} tokens</div>
                  </div>
                </div>
              </Card>
            </Col>
          ))}
        </Row>
        
        {filteredModels.length > pageSize && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px' }}>
            <Pagination
              current={current}
              pageSize={pageSize}
              total={filteredModels.length}
              showTotal={(total, range) => `第 ${range[0]}-${range[1]} 项，共 ${total} 个模型`}
              onChange={(page) => setCardPagination({ current: page, pageSize })}
            />
          </div>
        )}
      </div>
    );
  };
  
  // 渲染表格视图
  const renderTableView = () => {
    const columns = [
      {
        title: t('modelConfig.columns.name'),
        dataIndex: 'name',
        key: 'name',
        render: (text, record) => (
          <Space>
            {text}
            {record.is_default_text && <Tag color="blue">{t('modelConfig.tags.defaultText')}</Tag>}
            {record.is_default_embedding && <Tag color="green">{t('modelConfig.tags.defaultEmbedding')}</Tag>}
            {record.is_default_rerank && <Tag color="orange">{t('modelConfig.tags.defaultRerank')}</Tag>}
          </Space>
        )
      },
      {
        title: t('modelConfig.columns.provider'),
        dataIndex: 'provider',
        key: 'provider',
        render: (provider) => getProviderName(provider, t),
      },
      {
        title: t('modelConfig.list.modelId'),
        dataIndex: 'model_id',
        key: 'model_id',
      },
      {
        title: t('modelConfig.list.modalities'),
        dataIndex: 'modalities',
        key: 'modalities',
        render: (modalities) => {
          const inputModalities = (modalities || []).filter(mod => mod.includes('_input'));
          const outputModalities = (modalities || []).filter(mod => mod.includes('_output'));
          return (
            <div>
              {inputModalities.length > 0 && (
                <div style={{ marginBottom: 4 }}>
                  <Text type="secondary" style={{ fontSize: '11px', marginRight: 4 }}>{t('modelConfig.list.inputLabel')}:</Text>
                  <Space size={[0, 2]} wrap>
                    {inputModalities.map(mod => {
                      const modConfig = MODEL_MODALITIES.find(m => m.value === mod) || 
                        { labelKey: mod, icon: '?', color: 'default' };
                      return (
                        <Tag color={modConfig.color} key={mod}>
                          <span style={{ marginRight: 2 }}>{modConfig.icon}</span>
                          {modConfig.labelKey ? t(modConfig.labelKey).replace('输入', '').replace('Input', '') : mod}
                        </Tag>
                      );
                    })}
                  </Space>
                </div>
              )}
              {outputModalities.length > 0 && (
                <div>
                  <Text type="secondary" style={{ fontSize: '11px', marginRight: 4 }}>{t('modelConfig.list.outputLabel')}:</Text>
                  <Space size={[0, 2]} wrap>
                    {outputModalities.map(mod => {
                      const modConfig = MODEL_MODALITIES.find(m => m.value === mod) || 
                        { labelKey: mod, icon: '?', color: 'default' };
                      return (
                        <Tag color={modConfig.color} key={mod}>
                          <span style={{ marginRight: 2 }}>{modConfig.icon}</span>
                          {modConfig.labelKey ? t(modConfig.labelKey).replace('输出', '').replace('Output', '') : mod}
                        </Tag>
                      );
                    })}
                  </Space>
                </div>
              )}
            </div>
          );
        }
      },
      {
        title: t('modelConfig.list.capabilities'),
        dataIndex: 'capabilities',
        key: 'capabilities',
        render: (capabilities) => (
          <Space size={[0, 4]} wrap>
            {(capabilities || []).map(cap => {
              const capConfig = MODEL_CAPABILITIES.find(c => c.value === cap) || 
                { labelKey: cap, icon: '?', color: 'default' };
              return (
                <Tag color={capConfig.color} key={cap}>
                  <span style={{ marginRight: 4 }}>{capConfig.icon}</span>
                  {capConfig.labelKey ? t(capConfig.labelKey) : cap}
                </Tag>
              );
            })}
          </Space>
        )
      },
      {
        title: t('modelConfig.list.contextWindow'),
        dataIndex: 'context_window',
        key: 'context_window',
        render: (text) => `${text.toLocaleString()} tokens`
      },
      {
        title: t('common.actions'),
        key: 'action',
        render: (_, record) => (
          <Space size="middle">
            <Button type="text" icon={<EditOutlined />} onClick={() => onEdit(record)} style={{ color: '#1677ff' }}>
              {t('modelConfig.list.edit')}
            </Button>
            <Button
              type="text"
              danger
              icon={<DeleteOutlined />}
              onClick={() => onDelete(record)}
              disabled={record.is_default_text || record.is_default_embedding || record.is_default_rerank}
            >
              {t('modelConfig.list.delete')}
            </Button>
          </Space>
        ),
      },
    ];
    
    return (
      <Table
        columns={columns}
        dataSource={filteredModels}
        rowKey="id"
        loading={loading}
        pagination={false}
       
      />
    );
  };
  
  return (
    <div style={{ marginBottom: '24px' }}>
      {/* 工具栏 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        {/* 左侧：搜索框 */}
        <Input
          placeholder={t('modelConfig.searchPlaceholder')}
          prefix={<SearchOutlined />}
          value={searchKeyword}
          onChange={(e) => setSearchKeyword(e.target.value)}
          allowClear
          style={{ width: 240 }}
        />
        {/* 右侧：筛选和视图切换 */}
        <Space size="middle">
          {renderFilters()}
          <Segmented
            value={viewMode}
            onChange={setViewMode}
            options={[
              { label: t('modelConfig.view.card'), value: 'card', icon: <AppstoreOutlined /> },
              { label: t('modelConfig.view.table'), value: 'table', icon: <OrderedListOutlined /> }
            ]}
          />
        </Space>
      </div>
      
      {/* 内容区 */}
      {viewMode === 'card' ? renderCardView() : renderTableView()}
    </div>
  );
};

export default React.memo(ModelListView);
