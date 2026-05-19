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
import { useTranslation } from 'react-i18next';

// Fix Leaflet default icon paths
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
  const { t } = useTranslation();
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
    { key: 'pointer', name: t('gisApp.tool.pointer'), icon: <AimOutlined />, description: t('gisApp.tool.pointerDesc') },
    { key: 'marker', name: t('gisApp.tool.marker'), icon: <EnvironmentOutlined />, description: t('gisApp.tool.markerDesc') },
    { key: 'polygon', name: t('gisApp.tool.polygon'), icon: <BorderOutlined />, description: t('gisApp.tool.polygonDesc') },
    { key: 'polyline', name: t('gisApp.tool.polyline'), icon: <LineChartOutlined />, description: t('gisApp.tool.polylineDesc') },
    { key: 'circle', name: t('gisApp.tool.circle'), icon: <RadiusSettingOutlined />, description: t('gisApp.tool.circleDesc') },
    { key: 'rectangle', name: t('gisApp.tool.rectangle'), icon: <BorderOutlined />, description: t('gisApp.tool.rectangleDesc') }
  ];

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    // Create map instance
    const map = L.map(mapRef.current).setView([39.9042, 116.4074], 10);

    // Add OpenStreetMap layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    // Create drawing layer group
    const drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);

    // Create drawing controls
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

    // Draw event listener
    map.on(L.Draw.Event.CREATED, (event) => {
      const { layer, layerType } = event;
      drawnItems.addLayer(layer);
      addAnnotationFromLayer(layer, layerType);
    });

    // Edit event listener
    map.on(L.Draw.Event.EDITED, (event) => {
      const layers = event.layers;
      layers.eachLayer((layer) => {
        // Update corresponding annotation data
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
      message.success(t('gisApp.msg.shapeUpdated'));
    });

    // Delete event listener
    map.on(L.Draw.Event.DELETED, (event) => {
      const layers = event.layers;
      layers.eachLayer((layer) => {
        setAnnotations(prev => prev.filter(ann => ann.layer !== layer));
      });
      message.success(t('gisApp.msg.shapeDeleted'));
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

  // Get layer data
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

  // Get type label
  const getTypeName = (type) => {
    const names = {
      marker: t('gisApp.type.marker'),
      polygon: t('gisApp.type.polygon'),
      polyline: t('gisApp.type.polyline'),
      rectangle: t('gisApp.type.rectangle'),
      circle: t('gisApp.type.circle')
    };
    return names[type] || type;
  };

  const handleToolSelect = (toolKey) => {
    setSelectedTool(toolKey);
    if (mapInstanceRef.current) {
      // Cancel current draw mode
      mapInstanceRef.current.off('click');

      if (toolKey === 'pointer') {
        // Pointer mode
        message.info(t('gisApp.msg.pointerSelected'));
      } else {
        // Enable corresponding draw mode
        const toolName = tools.find(t => t.key === toolKey)?.name;
        message.info(t('gisApp.msg.toolSelected', { tool: toolName }));

        // Enable draw mode by tool type
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

  // Enable marker drawing
  const enableMarkerDrawing = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.on('click', (e) => {
        const marker = L.marker(e.latlng).addTo(drawnItemsRef.current);
        addAnnotationFromLayer(marker, 'marker');
      });
    }
  };

  // Enable polygon drawing
  const enablePolygonDrawing = () => {
    if (mapInstanceRef.current && drawControlRef.current) {
      const drawHandler = new L.Draw.Polygon(mapInstanceRef.current, drawControlRef.current.options.draw.polygon);
      drawHandler.enable();
    }
  };

  // Enable polyline drawing
  const enablePolylineDrawing = () => {
    if (mapInstanceRef.current && drawControlRef.current) {
      const drawHandler = new L.Draw.Polyline(mapInstanceRef.current, drawControlRef.current.options.draw.polyline);
      drawHandler.enable();
    }
  };

  // Enable circle drawing
  const enableCircleDrawing = () => {
    if (mapInstanceRef.current && drawControlRef.current) {
      const drawHandler = new L.Draw.Circle(mapInstanceRef.current, drawControlRef.current.options.draw.circle);
      drawHandler.enable();
    }
  };

  // Enable rectangle drawing
  const enableRectangleDrawing = () => {
    if (mapInstanceRef.current && drawControlRef.current) {
      const drawHandler = new L.Draw.Rectangle(mapInstanceRef.current, drawControlRef.current.options.draw.rectangle);
      drawHandler.enable();
    }
  };

  // Add annotation from layer
  const addAnnotationFromLayer = (layer, type) => {
    const newAnnotation = {
      id: Date.now(),
      type: type,
      name: t('gisApp.defaultName', { type: getTypeName(type), index: annotations.length + 1 }),
      description: t('gisApp.defaultDesc', { type: getTypeName(type) }),
      layer: layer,
      data: getLayerData(layer, type)
    };

    setAnnotations(prev => [...prev, newAnnotation]);
    message.success(t('gisApp.msg.added', { type: getTypeName(type) }));
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
    message.success(t('gisApp.msg.annotationDeleted'));
  };

  const handleSaveAnnotation = (values) => {
    if (editingAnnotation) {
      setAnnotations(prev => prev.map(a =>
        a.id === editingAnnotation.id ? { ...a, ...values } : a
      ));
      message.success(t('gisApp.msg.annotationUpdated'));
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
      message.warning(t('gisApp.msg.enterSearch'));
      return;
    }
    // Geocoding service can be integrated here
    message.info(t('gisApp.msg.searchWip', { query: searchQuery }));
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
    message.success(t('gisApp.msg.exported'));
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
      {/* top toolbar */}
      <Card style={{ marginBottom: 8 }}>
        <Row justify="space-between" align="middle">
          <Col>
            <Title level={4} style={{ margin: 0 }}>
              <EnvironmentOutlined style={{ marginRight: 8, color: '#1677ff' }} />
              {t('gisApp.title')}
            </Title>
          </Col>
          <Col>
            <Space>
              <Input.Search
                placeholder={t('gisApp.searchPh')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onSearch={handleSearch}
                style={{ width: 200 }}
               
              />
              <Button icon={<ZoomInOutlined />} onClick={handleZoomIn}>{t('gisApp.zoomIn')}</Button>
              <Button icon={<ZoomOutOutlined />} onClick={handleZoomOut}>{t('gisApp.zoomOut')}</Button>
              <Button icon={<DownloadOutlined />} onClick={handleExportData}>{t('gisApp.export')}</Button>
            </Space>
          </Col>
        </Row>
      </Card>

      <Row gutter={8} style={{ flex: 1 }}>
        {/* left tool panel */}
        <Col span={6}>
          <Card title={t('gisApp.drawTools')} style={{ marginBottom: 8, height: 'fit-content' }}>
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
            title={t('gisApp.annotationList', { count: annotations.length })}
           
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
                        title={t('gisApp.confirmDelete')}
                        onConfirm={() => handleDeleteAnnotation(annotation)}
                        okText={t('gisApp.ok')}
                        cancelText={t('gisApp.cancel')}
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
                <div>{t('gisApp.emptyAnnotations')}</div>
                <div style={{ fontSize: '12px' }}>{t('gisApp.emptyHint')}</div>
              </div>
            )}
          </Card>
        </Col>

        {/* right map area */}
        <Col span={18}>
          <Card
            title={
              <Space>
                <span>{t('gisApp.mapView')}</span>
                <Tag color="blue">
                  {t('gisApp.currentTool', { tool: tools.find(t => t.key === selectedTool)?.name })}
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

      {/* annotation edit modal */}
      <Modal
        title={t('gisApp.editAnnotation')}
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
        okText={t('gisApp.save')}
        cancelText={t('gisApp.cancel')}
      >
        <Space orientation="vertical" style={{ width: '100%' }}>
          <div>
            <Text>{t('gisApp.nameLabel')}</Text>
            <Input
              id="annotation-name"
              placeholder={t('gisApp.namePh')}
              defaultValue={editingAnnotation?.name}
              style={{ marginTop: 4 }}
            />
          </div>
          <div>
            <Text>{t('gisApp.typeLabel')}</Text>
            <Tag color={getTypeColor(editingAnnotation?.type)} style={{ marginTop: 4 }}>
              {getTypeName(editingAnnotation?.type)}
            </Tag>
          </div>
          <div>
            <Text>{t('gisApp.descLabel')}</Text>
            <TextArea
              id="annotation-desc"
              rows={3}
              placeholder={t('gisApp.descPh')}
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
