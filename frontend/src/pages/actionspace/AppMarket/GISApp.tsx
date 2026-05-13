import React, { useState, useEffect, useRef } from 'react';
import {
  Card,
  Button,
  Space,
  Typography,
  Row,
  Col,
  Tag,
  message,
  Tooltip,
  Modal,
  Input,
  Select,
  List,
  Popconfirm
} from 'antd';
import {
  EnvironmentOutlined,
  EditOutlined,
  DeleteOutlined,
  PlusOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
  AimOutlined,
  BorderOutlined,
  RadiusSettingOutlined,
  SaveOutlined,
  LineChartOutlined,
  SearchOutlined,
  DownloadOutlined
} from '@ant-design/icons';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';
import 'leaflet-draw';

// 修复Leaflet默认图标问题
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

const { Title, Text } = Typography;
const { TextArea } = Input;
const { Option } = Select;

const GISApp = () => {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const drawControlRef = useRef(null);
  const drawnItemsRef = useRef(null);

  const [selectedTool, setSelectedTool] = useState('pointer');
  const [annotations, setAnnotations] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingAnnotation, setEditingAnnotation] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  const tools = [
    { key: 'pointer', name: '选择', icon: <AimOutlined />, description: '选择和移动对象' },
    { key: 'marker', name: '标记', icon: <EnvironmentOutlined />, description: '添加地图标记点' },
    { key: 'polygon', name: '多边形', icon: <BorderOutlined />, description: '绘制多边形区域' },
    { key: 'polyline', name: '线条', icon: <LineChartOutlined />, description: '绘制线条路径' },
    { key: 'circle', name: '圆形', icon: <RadiusSettingOutlined />, description: '绘制圆形区域' },
    { key: 'rectangle', name: '矩形', icon: <BorderOutlined />, description: '绘制矩形区域' }
  ];

  // 初始化地图
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    // 创建地图实例
    const map = L.map(mapRef.current).setView([39.9042, 116.4074], 10);

    // 添加OpenStreetMap图层
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    // 创建绘制图层组
    const drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);

    // 创建绘制控件
    const drawControl = new L.Control.Draw({
      position: 'topright',
      draw: {
        polygon: {
          allowIntersection: false,
          showArea: true
        },
        polyline: {
          metric: true
        },
        rectangle: {
          showArea: true
        },
        circle: {
          showRadius: true,
          metric: true
        },
        marker: true,
        circlemarker: false
      },
      edit: {
        featureGroup: drawnItems,
        remove: true
      }
    });

    map.addControl(drawControl);

    // 绘制事件监听
    map.on(L.Draw.Event.CREATED, (event) => {
      const { layer, layerType } = event;
      drawnItems.addLayer(layer);
      addAnnotationFromLayer(layer, layerType);
    });

    // 编辑事件监听
    map.on(L.Draw.Event.EDITED, (event) => {
      const layers = event.layers;
      layers.eachLayer((layer) => {
        // 更新对应的标注数据
        setAnnotations(prev => prev.map(ann => {
          if (ann.layer === layer) {
            return {
              ...ann,
              data: getLayerData(layer, ann.type)
            };
          }
          return ann;
        }));
      });
      message.success('图形已更新');
    });

    // 删除事件监听
    map.on(L.Draw.Event.DELETED, (event) => {
      const layers = event.layers;
      layers.eachLayer((layer) => {
        setAnnotations(prev => prev.filter(ann => ann.layer !== layer));
      });
      message.success('图形已删除');
    });

    mapInstanceRef.current = map;
    drawControlRef.current = drawControl;
    drawnItemsRef.current = drawnItems;

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // 获取图层数据
  const getLayerData = (layer, type) => {
    switch (type) {
      case 'marker':
        const latlng = layer.getLatLng();
        return { lat: latlng.lat, lng: latlng.lng };
      case 'polygon':
      case 'polyline':
        return { coordinates: layer.getLatLngs() };
      case 'rectangle':
        return { bounds: layer.getBounds() };
      case 'circle':
        const center = layer.getLatLng();
        return { center: { lat: center.lat, lng: center.lng }, radius: layer.getRadius() };
      default:
        return {};
    }
  };

  // 获取类型名称
  const getTypeName = (type) => {
    const names = {
      marker: '标记点',
      polygon: '多边形',
      polyline: '线条',
      rectangle: '矩形',
      circle: '圆形'
    };
    return names[type] || type;
  };

  const handleToolSelect = (toolKey) => {
    setSelectedTool(toolKey);
    if (mapInstanceRef.current) {
      // 取消当前的绘制模式
      mapInstanceRef.current.off('click');

      if (toolKey === 'pointer') {
        // 选择模式，不做特殊处理
        message.info('已选择选择工具，可以编辑现有图形');
      } else {
        // 启用对应的绘制模式
        const toolName = tools.find(t => t.key === toolKey)?.name;
        message.info(`已选择${toolName}工具，请在地图上绘制`);

        // 根据工具类型启用相应的绘制模式
        switch (toolKey) {
          case 'marker':
            enableMarkerDrawing();
            break;
          case 'polygon':
            enablePolygonDrawing();
            break;
          case 'polyline':
            enablePolylineDrawing();
            break;
          case 'circle':
            enableCircleDrawing();
            break;
          case 'rectangle':
            enableRectangleDrawing();
            break;
        }
      }
    }
  };

  // 启用标记绘制
  const enableMarkerDrawing = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.on('click', (e) => {
        const marker = L.marker(e.latlng).addTo(drawnItemsRef.current);
        addAnnotationFromLayer(marker, 'marker');
      });
    }
  };

  // 启用多边形绘制
  const enablePolygonDrawing = () => {
    if (mapInstanceRef.current && drawControlRef.current) {
      const drawHandler = new L.Draw.Polygon(mapInstanceRef.current, drawControlRef.current.options.draw.polygon);
      drawHandler.enable();
    }
  };

  // 启用线条绘制
  const enablePolylineDrawing = () => {
    if (mapInstanceRef.current && drawControlRef.current) {
      const drawHandler = new L.Draw.Polyline(mapInstanceRef.current, drawControlRef.current.options.draw.polyline);
      drawHandler.enable();
    }
  };

  // 启用圆形绘制
  const enableCircleDrawing = () => {
    if (mapInstanceRef.current && drawControlRef.current) {
      const drawHandler = new L.Draw.Circle(mapInstanceRef.current, drawControlRef.current.options.draw.circle);
      drawHandler.enable();
    }
  };

  // 启用矩形绘制
  const enableRectangleDrawing = () => {
    if (mapInstanceRef.current && drawControlRef.current) {
      const drawHandler = new L.Draw.Rectangle(mapInstanceRef.current, drawControlRef.current.options.draw.rectangle);
      drawHandler.enable();
    }
  };

  // 从图层添加标注
  const addAnnotationFromLayer = (layer, type) => {
    const newAnnotation = {
      id: Date.now(),
      type: type,
      name: `${getTypeName(type)}${annotations.length + 1}`,
      description: `新建的${getTypeName(type)}`,
      layer: layer,
      data: getLayerData(layer, type)
    };

    setAnnotations(prev => [...prev, newAnnotation]);
    message.success(`已添加${getTypeName(type)}`);
  };

  const handleEditAnnotation = (annotation) => {
    setEditingAnnotation(annotation);
    setModalVisible(true);
  };

  const handleDeleteAnnotation = (annotation) => {
    if (annotation.layer && drawnItemsRef.current) {
      drawnItemsRef.current.removeLayer(annotation.layer);
    }
    setAnnotations(prev => prev.filter(a => a.id !== annotation.id));
    message.success('标注已删除');
  };

  const handleSaveAnnotation = (values) => {
    if (editingAnnotation) {
      setAnnotations(prev => prev.map(a =>
        a.id === editingAnnotation.id ? { ...a, ...values } : a
      ));
      message.success('标注已更新');
    }
    setModalVisible(false);
  };

  const handleZoomIn = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.zoomIn();
    }
  };

  const handleZoomOut = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.zoomOut();
    }
  };

  const handleSearch = () => {
    if (!searchQuery.trim()) {
      message.warning('请输入搜索内容');
      return;
    }
    // 这里可以集成地理编码服务
    message.info(`搜索功能开发中: ${searchQuery}`);
  };

  const handleExportData = () => {
    const exportData = {
      annotations: annotations.map(ann => ({
        id: ann.id,
        type: ann.type,
        name: ann.name,
        description: ann.description,
        data: ann.data
      }))
    };

    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'gis-annotations.json';
    link.click();
    URL.revokeObjectURL(url);
    message.success('数据已导出');
  };

  const getTypeColor = (type) => {
    const colors = {
      marker: 'blue',
      polygon: 'green',
      polyline: 'orange',
      circle: 'purple',
      rectangle: 'cyan'
    };
    return colors[type] || 'default';
  };

  const getTypeIcon = (type) => {
    const icons = {
      marker: <EnvironmentOutlined />,
      polygon: <BorderOutlined />,
      polyline: <LineChartOutlined />,
      circle: <RadiusSettingOutlined />,
      rectangle: <BorderOutlined />
    };
    return icons[type] || <EnvironmentOutlined />;
  };

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* 顶部工具栏 */}
      <Card style={{ marginBottom: 8 }}>
        <Row justify="space-between" align="middle">
          <Col>
            <Title level={4} style={{ margin: 0 }}>
              <EnvironmentOutlined style={{ marginRight: 8, color: '#1677ff' }} />
              GIS地图操作工具
            </Title>
          </Col>
          <Col>
            <Space>
              <Input.Search
                placeholder="搜索地点"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onSearch={handleSearch}
                style={{ width: 200 }}
               
              />
              <Button icon={<ZoomInOutlined />} onClick={handleZoomIn}>放大</Button>
              <Button icon={<ZoomOutOutlined />} onClick={handleZoomOut}>缩小</Button>
              <Button icon={<DownloadOutlined />} onClick={handleExportData}>导出</Button>
            </Space>
          </Col>
        </Row>
      </Card>

      <Row gutter={8} style={{ flex: 1 }}>
        {/* 左侧工具面板 */}
        <Col span={6}>
          <Card title="绘制工具" style={{ marginBottom: 8, height: 'fit-content' }}>
            <Space orientation="vertical" style={{ width: '100%' }}>
              {tools.map(tool => (
                <Tooltip key={tool.key} title={tool.description} placement="right">
                  <Button
                    block
                    type={selectedTool === tool.key ? 'primary' : 'default'}
                    icon={tool.icon}
                    onClick={() => handleToolSelect(tool.key)}
                  >
                    {tool.name}
                  </Button>
                </Tooltip>
              ))}
            </Space>
          </Card>

          <Card
            title={`标注列表 (${annotations.length})`}
           
            style={{ height: 'calc(100vh - 250px)' }}
            bodyStyle={{ padding: '8px', height: 'calc(100% - 57px)', overflow: 'auto' }}
          >
            {annotations.length > 0 ? (
              <List
               
                dataSource={annotations}
                renderItem={(annotation) => (
                  <List.Item
                    actions={[
                      <Button
                        type="text"
                        icon={<EditOutlined />}
                       
                        onClick={() => handleEditAnnotation(annotation)}
                      />,
                      <Popconfirm
                        title="确定删除这个标注吗？"
                        onConfirm={() => handleDeleteAnnotation(annotation)}
                        okText="确定"
                        cancelText="取消"
                      >
                        <Button
                          type="text"
                          icon={<DeleteOutlined />}
                         
                          danger
                        />
                      </Popconfirm>
                    ]}
                  >
                    <List.Item.Meta
                      avatar={getTypeIcon(annotation.type)}
                      title={
                        <Space>
                          <Text strong>{annotation.name}</Text>
                          <Tag color={getTypeColor(annotation.type)}>
                            {getTypeName(annotation.type)}
                          </Tag>
                        </Space>
                      }
                      description={
                        <Text type="secondary" style={{ fontSize: '12px' }}>
                          {annotation.description}
                        </Text>
                      }
                    />
                  </List.Item>
                )}
              />
            ) : (
              <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--custom-text-secondary)' }}>
                <EnvironmentOutlined style={{ fontSize: '24px', marginBottom: 8 }} />
                <div>暂无标注</div>
                <div style={{ fontSize: '12px' }}>在地图上绘制图形来添加标注</div>
              </div>
            )}
          </Card>
        </Col>

        {/* 右侧地图区域 */}
        <Col span={18}>
          <Card
            title={
              <Space>
                <span>地图视图</span>
                <Tag color="blue">
                  当前工具: {tools.find(t => t.key === selectedTool)?.name}
                </Tag>
              </Space>
            }
           
            style={{ height: '100%' }}
            bodyStyle={{
              height: 'calc(100% - 57px)',
              padding: 0
            }}
          >
            <div
              ref={mapRef}
              style={{
                width: '100%',
                height: '100%',
                minHeight: '500px'
              }}
            />
          </Card>
        </Col>
      </Row>

      {/* 标注编辑Modal */}
      <Modal
        title="编辑标注信息"
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={() => {
          const nameInput = document.getElementById('annotation-name') as HTMLInputElement;
          const descInput = document.getElementById('annotation-desc') as HTMLInputElement;

          if (nameInput && descInput) {
            handleSaveAnnotation({
              name: nameInput.value,
              description: descInput.value
            });
          }
        }}
        okText="保存"
        cancelText="取消"
      >
        <Space orientation="vertical" style={{ width: '100%' }}>
          <div>
            <Text>名称:</Text>
            <Input
              id="annotation-name"
              placeholder="输入标注名称"
              defaultValue={editingAnnotation?.name}
              style={{ marginTop: 4 }}
            />
          </div>
          <div>
            <Text>类型:</Text>
            <Tag color={getTypeColor(editingAnnotation?.type)} style={{ marginTop: 4 }}>
              {getTypeName(editingAnnotation?.type)}
            </Tag>
          </div>
          <div>
            <Text>描述:</Text>
            <TextArea
              id="annotation-desc"
              rows={3}
              placeholder="输入标注描述"
              defaultValue={editingAnnotation?.description}
              style={{ marginTop: 4 }}
            />
          </div>
        </Space>
      </Modal>
    </div>
  );
};

export default GISApp;
