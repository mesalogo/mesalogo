import { useState } from 'react';
import {
  ApartmentOutlined,
  BookOutlined,
  BranchesOutlined,
  CheckCircleFilled,
  ClockCircleOutlined,
  DatabaseOutlined,
  FileTextOutlined,
  GlobalOutlined,
  HeartOutlined,
  NodeIndexOutlined,
  RobotOutlined,
  SafetyCertificateOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import {
  Badge,
  Button,
  Card,
  Col,
  Descriptions,
  Divider,
  Flex,
  Progress,
  Row,
  Space,
  Statistic,
  Tag,
  Timeline,
  Tree,
  Typography,
} from 'antd';
import { useTranslation } from 'react-i18next';
import './MemoryPalaceDemo.css';

const { Paragraph, Text, Title } = Typography;

type ViewMode = 'room' | 'timeline' | 'graph';
type DrawerKind = 'episode' | 'fact' | 'reflection' | 'tool';
type MemoryStatus = 'current' | 'verified' | 'reflection';

interface DemoDrawer {
  id: string;
  kind: DrawerKind;
  status: MemoryStatus;
  titleKey: string;
  contentKey: string;
  sourceKey: string;
  time: string;
  tags: string[];
  scores: {
    semantic: number;
    entity: number;
    recency: number;
  };
}

interface DemoRoom {
  id: string;
  titleKey: string;
  hallKey: string;
  summaryKey: string;
  drawers: DemoDrawer[];
}

const DEMO_ROOMS: DemoRoom[] = [
  {
    id: 'room-preferences',
    titleKey: 'memory.demo.rooms.preferences',
    hallKey: 'memory.demo.halls.collaboration',
    summaryKey: 'memory.demo.rooms.preferencesSummary',
    drawers: [
      {
        id: 'drawer-1042',
        kind: 'episode',
        status: 'verified',
        titleKey: 'memory.demo.drawers.conciseUpdates.title',
        contentKey: 'memory.demo.drawers.conciseUpdates.content',
        sourceKey: 'memory.demo.sources.conversation',
        time: '2026-07-28 16:42',
        tags: ['memory.demo.tags.preference', 'memory.demo.tags.reporting'],
        scores: { semantic: 92, entity: 78, recency: 96 },
      },
      {
        id: 'drawer-1047',
        kind: 'fact',
        status: 'current',
        titleKey: 'memory.demo.drawers.fridayReport.title',
        contentKey: 'memory.demo.drawers.fridayReport.content',
        sourceKey: 'memory.demo.sources.factPromotion',
        time: '2026-07-29 09:30',
        tags: ['memory.demo.tags.schedule', 'memory.demo.tags.currentFact'],
        scores: { semantic: 88, entity: 91, recency: 98 },
      },
      {
        id: 'drawer-1051',
        kind: 'reflection',
        status: 'reflection',
        titleKey: 'memory.demo.drawers.evidenceFirst.title',
        contentKey: 'memory.demo.drawers.evidenceFirst.content',
        sourceKey: 'memory.demo.sources.heartbeatReflection',
        time: '2026-07-29 10:00',
        tags: ['memory.demo.tags.reflection', 'memory.demo.tags.heartbeat'],
        scores: { semantic: 84, entity: 72, recency: 99 },
      },
    ],
  },
  {
    id: 'room-architecture',
    titleKey: 'memory.demo.rooms.architecture',
    hallKey: 'memory.demo.halls.research',
    summaryKey: 'memory.demo.rooms.architectureSummary',
    drawers: [
      {
        id: 'drawer-1031',
        kind: 'fact',
        status: 'current',
        titleKey: 'memory.demo.drawers.dualLayer.title',
        contentKey: 'memory.demo.drawers.dualLayer.content',
        sourceKey: 'memory.demo.sources.designDecision',
        time: '2026-07-27 14:20',
        tags: ['MemoryPalace', 'Drawer', 'Temporal KG'],
        scores: { semantic: 96, entity: 94, recency: 88 },
      },
      {
        id: 'drawer-1035',
        kind: 'tool',
        status: 'verified',
        titleKey: 'memory.demo.drawers.storageStack.title',
        contentKey: 'memory.demo.drawers.storageStack.content',
        sourceKey: 'memory.demo.sources.toolResult',
        time: '2026-07-27 15:05',
        tags: ['MariaDB', 'Milvus', 'Redis'],
        scores: { semantic: 90, entity: 97, recency: 87 },
      },
    ],
  },
  {
    id: 'room-heartbeat',
    titleKey: 'memory.demo.rooms.heartbeat',
    hallKey: 'memory.demo.halls.operations',
    summaryKey: 'memory.demo.rooms.heartbeatSummary',
    drawers: [
      {
        id: 'drawer-1056',
        kind: 'tool',
        status: 'verified',
        titleKey: 'memory.demo.drawers.pressure.title',
        contentKey: 'memory.demo.drawers.pressure.content',
        sourceKey: 'memory.demo.sources.heartbeatObservation',
        time: '2026-07-29 10:15',
        tags: ['memory.demo.tags.pressure', 'memory.demo.tags.background'],
        scores: { semantic: 91, entity: 80, recency: 100 },
      },
      {
        id: 'drawer-1058',
        kind: 'reflection',
        status: 'reflection',
        titleKey: 'memory.demo.drawers.cognitiveDebt.title',
        contentKey: 'memory.demo.drawers.cognitiveDebt.content',
        sourceKey: 'memory.demo.sources.heartbeatReflection',
        time: '2026-07-29 10:30',
        tags: ['memory.demo.tags.cognitiveDebt', 'memory.demo.tags.deferred'],
        scores: { semantic: 89, entity: 76, recency: 100 },
      },
    ],
  },
];

const KIND_COLORS: Record<DrawerKind, string> = {
  episode: 'blue',
  fact: 'green',
  reflection: 'purple',
  tool: 'gold',
};

const STATUS_COLORS: Record<MemoryStatus, string> = {
  current: 'success',
  verified: 'processing',
  reflection: 'purple',
};

const MemoryPalaceDemo = () => {
  const { t } = useTranslation('memory');
  const [selectedRoomId, setSelectedRoomId] = useState(DEMO_ROOMS[0].id);
  const [selectedDrawerId, setSelectedDrawerId] = useState(DEMO_ROOMS[0].drawers[0].id);
  const [viewMode, setViewMode] = useState<ViewMode>('room');

  const selectedRoom =
    DEMO_ROOMS.find((room) => room.id === selectedRoomId) ?? DEMO_ROOMS[0];
  const selectedDrawer =
    selectedRoom.drawers.find((drawer) => drawer.id === selectedDrawerId) ??
    selectedRoom.drawers[0];

  const treeData = [
    {
      key: 'realm-atlas',
      title: t('memory.demo.realm'),
      icon: <GlobalOutlined />,
      children: [
        {
          key: 'wing-space',
          title: t('memory.demo.wings.space'),
          icon: <ApartmentOutlined />,
          children: [
            {
              key: 'hall-collaboration',
              title: t('memory.demo.halls.collaboration'),
              icon: <BookOutlined />,
              children: [
                {
                  key: 'room-preferences',
                  title: t('memory.demo.rooms.preferences'),
                  icon: <FileTextOutlined />,
                },
              ],
            },
            {
              key: 'hall-research',
              title: t('memory.demo.halls.research'),
              icon: <BookOutlined />,
              children: [
                {
                  key: 'room-architecture',
                  title: t('memory.demo.rooms.architecture'),
                  icon: <FileTextOutlined />,
                },
              ],
            },
            {
              key: 'hall-operations',
              title: t('memory.demo.halls.operations'),
              icon: <BookOutlined />,
              children: [
                {
                  key: 'room-heartbeat',
                  title: t('memory.demo.rooms.heartbeat'),
                  icon: <FileTextOutlined />,
                },
              ],
            },
          ],
        },
        {
          key: 'wing-role',
          title: t('memory.demo.wings.role'),
          icon: <BranchesOutlined />,
        },
        {
          key: 'wing-agent',
          title: t('memory.demo.wings.agent'),
          icon: <RobotOutlined />,
        },
      ],
    },
  ];

  const selectRoom = (keys: React.Key[]) => {
    const room = DEMO_ROOMS.find((candidate) => candidate.id === keys[0]);
    if (!room) return;
    setSelectedRoomId(room.id);
    setSelectedDrawerId(room.drawers[0].id);
    setViewMode('room');
  };

  const renderRoomView = () => (
    <div className="memory-demo-drawer-list">
      {selectedRoom.drawers.map((drawer) => {
        const isSelected = drawer.id === selectedDrawer.id;
        return (
          <button
            className={`memory-demo-drawer${isSelected ? ' is-selected' : ''}`}
            key={drawer.id}
            onClick={() => setSelectedDrawerId(drawer.id)}
            type="button"
          >
            <Flex justify="space-between" align="flex-start" gap={12}>
              <Space size={8} wrap>
                <Tag color={KIND_COLORS[drawer.kind]}>
                  {t(`memory.demo.kind.${drawer.kind}`)}
                </Tag>
                <Text strong>{t(drawer.titleKey)}</Text>
              </Space>
              <Text type="secondary" className="memory-demo-nowrap">
                {drawer.time}
              </Text>
            </Flex>
            <Paragraph ellipsis={{ rows: 2 }} className="memory-demo-drawer-copy">
              {t(drawer.contentKey)}
            </Paragraph>
            <Flex justify="space-between" align="center" gap={12}>
              <Space size={[4, 4]} wrap>
                {drawer.tags.map((tag) => (
                  <Tag bordered={false} key={tag}>
                    {tag.startsWith('memory.') ? t(tag) : tag}
                  </Tag>
                ))}
              </Space>
              <Badge
                status={drawer.status === 'current' ? 'success' : 'processing'}
                text={t(`memory.demo.status.${drawer.status}`)}
              />
            </Flex>
          </button>
        );
      })}
    </div>
  );

  const renderTimelineView = () => (
    <div className="memory-demo-timeline">
      <Title level={5}>{t('memory.demo.timeline.title')}</Title>
      <Text type="secondary">{t('memory.demo.timeline.subtitle')}</Text>
      <Timeline
        className="memory-demo-timeline-items"
        items={selectedRoom.drawers.map((drawer) => ({
          color: KIND_COLORS[drawer.kind],
          dot:
            drawer.kind === 'reflection' ? (
              <ThunderboltOutlined />
            ) : drawer.kind === 'fact' ? (
              <SafetyCertificateOutlined />
            ) : (
              <ClockCircleOutlined />
            ),
          children: (
            <button
              className="memory-demo-timeline-event"
              onClick={() => setSelectedDrawerId(drawer.id)}
              type="button"
            >
              <Text type="secondary">{drawer.time}</Text>
              <Text strong>{t(drawer.titleKey)}</Text>
              <Text>{t(drawer.contentKey)}</Text>
            </button>
          ),
        }))}
      />
    </div>
  );

  const renderGraphView = () => (
    <div className="memory-demo-graph">
      <Flex justify="space-between" align="center">
        <div>
          <Title level={5}>{t('memory.demo.graph.title')}</Title>
          <Text type="secondary">{t('memory.demo.graph.subtitle')}</Text>
        </div>
        <Tag icon={<NodeIndexOutlined />} color="geekblue">
          {t('memory.demo.graph.temporal')}
        </Tag>
      </Flex>
      <svg
        aria-label={t('memory.demo.graph.ariaLabel')}
        className="memory-demo-graph-canvas"
        role="img"
        viewBox="0 0 720 340"
      >
        <defs>
          <linearGradient id="memoryNodePrimary" x1="0" x2="1">
            <stop offset="0%" stopColor="#1677ff" />
            <stop offset="100%" stopColor="#69b1ff" />
          </linearGradient>
          <linearGradient id="memoryNodeSecondary" x1="0" x2="1">
            <stop offset="0%" stopColor="#722ed1" />
            <stop offset="100%" stopColor="#b37feb" />
          </linearGradient>
        </defs>
        <line className="memory-demo-graph-edge" x1="170" x2="360" y1="95" y2="95" />
        <line className="memory-demo-graph-edge" x1="455" x2="600" y1="95" y2="220" />
        <line className="memory-demo-graph-edge" x1="170" x2="360" y1="250" y2="95" />
        <text className="memory-demo-graph-label" x="235" y="80">
          {t('memory.demo.graph.prefers')}
        </text>
        <text className="memory-demo-graph-label" x="500" y="145">
          {t('memory.demo.graph.validAt')}
        </text>
        <text className="memory-demo-graph-label" x="220" y="190">
          {t('memory.demo.graph.derivedFrom')}
        </text>
        <g>
          <rect fill="url(#memoryNodePrimary)" height="62" rx="16" width="140" x="30" y="64" />
          <text className="memory-demo-graph-node-text" x="100" y="101">
            {t('memory.demo.graph.user')}
          </text>
        </g>
        <g>
          <rect fill="url(#memoryNodeSecondary)" height="62" rx="16" width="190" x="360" y="64" />
          <text className="memory-demo-graph-node-text" x="455" y="101">
            {t('memory.demo.graph.conciseReports')}
          </text>
        </g>
        <g>
          <rect className="memory-demo-graph-node-neutral" height="62" rx="16" width="170" x="30" y="220" />
          <text className="memory-demo-graph-node-dark" x="115" y="257">
            {t('memory.demo.graph.sourceDrawer')}
          </text>
        </g>
        <g>
          <rect className="memory-demo-graph-node-current" height="62" rx="16" width="150" x="555" y="190" />
          <text className="memory-demo-graph-node-dark" x="630" y="227">
            {t('memory.demo.graph.current')}
          </text>
        </g>
      </svg>
      <Flex gap={8} wrap>
        <Tag color="green">{t('memory.demo.graph.currentFacts', { count: 37 })}</Tag>
        <Tag color="orange">{t('memory.demo.graph.historicalFacts', { count: 8 })}</Tag>
        <Tag color="blue">{t('memory.demo.graph.evidenceLinked', { count: 45 })}</Tag>
      </Flex>
    </div>
  );

  const renderCenterView = () => {
    if (viewMode === 'timeline') return renderTimelineView();
    if (viewMode === 'graph') return renderGraphView();
    return renderRoomView();
  };

  return (
    <div className="memory-demo-page">
      <Card className="memory-demo-hero" bordered={false}>
        <Flex justify="space-between" align="center" gap={24} wrap>
          <div>
            <Space size={8} wrap>
              <Tag color="blue">{t('memory.demo.badge')}</Tag>
              <Badge status="success" text={t('memory.demo.heartbeatHealthy')} />
            </Space>
            <Title level={3} className="memory-demo-hero-title">
              {t('memory.demo.title')}
            </Title>
            <Text type="secondary">{t('memory.demo.subtitle')}</Text>
          </div>
          <Space>
            <HeartOutlined className="memory-demo-heartbeat-icon" />
            <div>
              <Text type="secondary">{t('memory.demo.nextHeartbeat')}</Text>
              <div>
                <Text strong>{t('memory.demo.nextHeartbeatValue')}</Text>
              </div>
            </div>
          </Space>
        </Flex>
      </Card>

      <Row gutter={[12, 12]} className="memory-demo-stats">
        <Col xs={12} lg={6}>
          <Card size="small">
            <Statistic prefix={<ApartmentOutlined />} title={t('memory.demo.stats.wings')} value={4} />
          </Card>
        </Col>
        <Col xs={12} lg={6}>
          <Card size="small">
            <Statistic prefix={<BookOutlined />} title={t('memory.demo.stats.rooms')} value={12} />
          </Card>
        </Col>
        <Col xs={12} lg={6}>
          <Card size="small">
            <Statistic prefix={<DatabaseOutlined />} title={t('memory.demo.stats.drawers')} value={248} />
          </Card>
        </Col>
        <Col xs={12} lg={6}>
          <Card size="small">
            <Statistic
              prefix={<SafetyCertificateOutlined />}
              suffix={<Text type="secondary">/ 45</Text>}
              title={t('memory.demo.stats.currentFacts')}
              value={37}
            />
          </Card>
        </Col>
      </Row>

      <div className="memory-demo-workbench">
        <Card
          className="memory-demo-tree-panel"
          size="small"
          title={
            <Space>
              <ApartmentOutlined />
              {t('memory.demo.navigation')}
            </Space>
          }
        >
          <Tree
            blockNode
            defaultExpandAll
            onSelect={selectRoom}
            selectedKeys={[selectedRoom.id]}
            showIcon
            treeData={treeData}
          />
          <Divider />
          <Space direction="vertical" size={4}>
            <Text type="secondary">{t('memory.demo.partitionRule')}</Text>
            <Tag color="blue">{t('memory.demo.partitionValue')}</Tag>
            <Text type="secondary">{t('memory.demo.tenantBoundary')}</Text>
          </Space>
        </Card>

        <Card
          className="memory-demo-center-panel"
          title={
            <div>
              <Space size={8} wrap>
                <Text strong>{t(selectedRoom.titleKey)}</Text>
                <Tag>{t(selectedRoom.hallKey)}</Tag>
              </Space>
              <div>
                <Text type="secondary">{t(selectedRoom.summaryKey)}</Text>
              </div>
            </div>
          }
          extra={
            <Space.Compact>
              <Button
                onClick={() => setViewMode('room')}
                type={viewMode === 'room' ? 'primary' : 'default'}
              >
                {t('memory.demo.views.room')}
              </Button>
              <Button
                icon={<ClockCircleOutlined />}
                onClick={() => setViewMode('timeline')}
                type={viewMode === 'timeline' ? 'primary' : 'default'}
              >
                {t('memory.demo.views.timeline')}
              </Button>
              <Button
                icon={<BranchesOutlined />}
                onClick={() => setViewMode('graph')}
                type={viewMode === 'graph' ? 'primary' : 'default'}
              >
                {t('memory.demo.views.graph')}
              </Button>
            </Space.Compact>
          }
        >
          {renderCenterView()}
        </Card>

        <Card
          className="memory-demo-detail-panel"
          size="small"
          title={t('memory.demo.inspector.title')}
          extra={<CheckCircleFilled className="memory-demo-verified-icon" />}
        >
          <Space direction="vertical" size={8}>
            <Tag color={KIND_COLORS[selectedDrawer.kind]}>
              {t(`memory.demo.kind.${selectedDrawer.kind}`)}
            </Tag>
            <Title level={5}>{t(selectedDrawer.titleKey)}</Title>
            <Paragraph>{t(selectedDrawer.contentKey)}</Paragraph>
          </Space>
          <Descriptions
            className="memory-demo-descriptions"
            column={1}
            items={[
              {
                key: 'status',
                label: t('memory.demo.inspector.status'),
                children: (
                  <Tag color={STATUS_COLORS[selectedDrawer.status]}>
                    {t(`memory.demo.status.${selectedDrawer.status}`)}
                  </Tag>
                ),
              },
              {
                key: 'scope',
                label: t('memory.demo.inspector.scope'),
                children: t('memory.demo.inspector.spaceScope'),
              },
              {
                key: 'source',
                label: t('memory.demo.inspector.source'),
                children: t(selectedDrawer.sourceKey),
              },
              {
                key: 'time',
                label: t('memory.demo.inspector.time'),
                children: selectedDrawer.time,
              },
              {
                key: 'evidence',
                label: t('memory.demo.inspector.evidence'),
                children: selectedDrawer.id,
              },
            ]}
            size="small"
          />
          <Divider titlePlacement="left">{t('memory.demo.inspector.recallSignals')}</Divider>
          <Space direction="vertical" size={8} className="memory-demo-signal-list">
            <div>
              <Flex justify="space-between">
                <Text>{t('memory.demo.inspector.semantic')}</Text>
                <Text>{selectedDrawer.scores.semantic}%</Text>
              </Flex>
              <Progress percent={selectedDrawer.scores.semantic} showInfo={false} size="small" />
            </div>
            <div>
              <Flex justify="space-between">
                <Text>{t('memory.demo.inspector.entity')}</Text>
                <Text>{selectedDrawer.scores.entity}%</Text>
              </Flex>
              <Progress
                percent={selectedDrawer.scores.entity}
                showInfo={false}
                size="small"
                strokeColor="#722ed1"
              />
            </div>
            <div>
              <Flex justify="space-between">
                <Text>{t('memory.demo.inspector.recency')}</Text>
                <Text>{selectedDrawer.scores.recency}%</Text>
              </Flex>
              <Progress
                percent={selectedDrawer.scores.recency}
                showInfo={false}
                size="small"
                strokeColor="#13c2c2"
              />
            </div>
          </Space>
          <Divider titlePlacement="left">{t('memory.demo.inspector.heartbeatTrace')}</Divider>
          <Timeline
            items={[
              { color: 'blue', children: t('memory.demo.trace.observe') },
              { color: 'blue', children: t('memory.demo.trace.consolidate') },
              { color: 'green', children: t('memory.demo.trace.gate') },
              { color: 'green', children: t('memory.demo.trace.apply') },
            ]}
          />
        </Card>
      </div>
    </div>
  );
};

export default MemoryPalaceDemo;
