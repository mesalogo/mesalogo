// Namespace: serviceCenter
// Language: zh-CN
// Keep keys consistent with en-US/serviceCenter.ts.
// eslint-disable-next-line import/no-anonymous-default-export
export default {
  // ----- Page -----
  'serviceCenter.title': '服务与集成',
  'serviceCenter.subtitle': '查看当前安装中各项服务的配置状态、运行状态与健康状态。',

  // ----- Summary -----
  'serviceCenter.summary.total': '服务总数',
  'serviceCenter.summary.healthy': '健康',
  'serviceCenter.summary.degraded': '降级',
  'serviceCenter.summary.unhealthy': '异常',
  'serviceCenter.summary.disabled': '未启用',
  'serviceCenter.summary.unknown': '未知',

  // ----- Metadata and actions -----
  'serviceCenter.meta.deploymentMode': '部署模式',
  'serviceCenter.meta.lastChecked': '最近检查',
  'serviceCenter.deploymentMode.docker': 'Docker',
  'serviceCenter.deploymentMode.native': '原生部署',
  'serviceCenter.deployment.embedded': '内嵌服务',
  'serviceCenter.deployment.native': '原生进程',
  'serviceCenter.deployment.dockerCompose': 'Docker Compose',
  'serviceCenter.deployment.external': '外部服务',
  'serviceCenter.deployment.other': '其他（{{deployment}}）',
  'serviceCenter.action.refresh': '刷新',
  'serviceCenter.action.retry': '重试',
  'serviceCenter.action.configure': '配置',
  'serviceCenter.action.viewLogs': '查看日志',
  'serviceCenter.action.start': '启动',
  'serviceCenter.action.stop': '停止',
  'serviceCenter.action.restart': '重启',
  'serviceCenter.filter.category': '按类别筛选',

  // ----- Lifecycle control -----
  'serviceCenter.control.unavailableTitle': '服务控制功能未启用',
  'serviceCenter.control.unavailableDescription': '请在 abm-docker 目录执行 make up-control，以挂载 Docker Socket 并启用启动、停止和重启。尚未由 Docker Compose 创建的容器，仍需先通过 Docker Compose 完成首次创建。',
  'serviceCenter.control.actionChanged': '{{service}} 已完成{{action}}操作。',
  'serviceCenter.control.noChange': '{{service}} 已处于请求的状态，无需更改。',
  'serviceCenter.confirm.stopTitle': '停止 {{service}}？',
  'serviceCenter.confirm.stopDescription': '停止服务可能中断正在处理的请求。确认后将停止该服务的全部受管容器。',
  'serviceCenter.confirm.restartTitle': '重启 {{service}}？',
  'serviceCenter.confirm.restartDescription': '重启期间服务会短暂不可用，正在处理的请求可能中断。',

  // ----- Table -----
  'serviceCenter.table.title': '服务目录',
  'serviceCenter.table.details': '详情',
  'serviceCenter.table.empty': '当前类别下没有服务。',
  'serviceCenter.column.service': '服务',
  'serviceCenter.column.category': '类别',
  'serviceCenter.column.configured': '配置状态',
  'serviceCenter.column.runtime': '运行状态',
  'serviceCenter.column.images': '镜像状态',
  'serviceCenter.column.health': '健康状态',
  'serviceCenter.column.endpoint': '服务端点',
  'serviceCenter.column.dependencies': '依赖服务',
  'serviceCenter.column.configuration': '配置入口',
  'serviceCenter.column.actions': '操作',

  // ----- State -----
  'serviceCenter.configured.enabled': '已启用',
  'serviceCenter.configured.disabled': '未启用',
  'serviceCenter.configured.unknown': '未知',
  'serviceCenter.runtime.running': '运行中',
  'serviceCenter.runtime.stopped': '已停止',
  'serviceCenter.runtime.unknown': '未知',
  'serviceCenter.image.available': '全部存在',
  'serviceCenter.image.partial': '部分存在',
  'serviceCenter.image.missing': '缺失',
  'serviceCenter.image.unknown': '未检查',
  'serviceCenter.image.present': '已存在',
  'serviceCenter.health.healthy': '健康',
  'serviceCenter.health.degraded': '降级',
  'serviceCenter.health.unhealthy': '异常',
  'serviceCenter.health.disabled': '未启用',
  'serviceCenter.health.unknown': '未知',

  // ----- Categories -----
  'serviceCenter.category.all': '全部类别',
  'serviceCenter.category.core': '核心服务',
  'serviceCenter.category.infrastructure': '基础设施',
  'serviceCenter.category.data': '数据服务',
  'serviceCenter.category.knowledge': '知识服务',
  'serviceCenter.category.capability': '能力服务',
  'serviceCenter.category.integration': '集成',
  'serviceCenter.category.other': '其他（{{category}}）',

  // ----- Logical service names -----
  'serviceCenter.services.backend': '后端 API',
  'serviceCenter.services.frontend': '前端界面',
  'serviceCenter.services.database': '数据库',
  'serviceCenter.services.redis': 'Redis',
  'serviceCenter.services.milvus': 'Milvus',
  'serviceCenter.services.graphiti': 'Graphiti',
  'serviceCenter.services.lightrag': 'LightRAG',
  'serviceCenter.services.onlyoffice': 'OnlyOffice',
  'serviceCenter.services.galapagos': 'Galapagos',
  'serviceCenter.services.paddleocrVl': 'PaddleOCR-VL',
  'serviceCenter.services.codeServer': 'Code Server',
  'serviceCenter.services.unknown': '未知服务（{{id}}）',

  // ----- Expanded details -----
  'serviceCenter.detail.deployment': '部署方式',
  'serviceCenter.detail.latency': '探测延迟',
  'serviceCenter.detail.components': '目录组件',
  'serviceCenter.detail.componentsHint': '组件名称用于描述逻辑服务组，不代表各组件已被单独观测到运行状态。',
  'serviceCenter.detail.images': '所需镜像',
  'serviceCenter.detail.imagesHint': '镜像存在性通过 Docker Engine 在本机检查，系统不会自动拉取镜像。',
  'serviceCenter.detail.statusDetail': '状态详情',
  'serviceCenter.detail.controlStatus': '控制状态详情',
  'serviceCenter.detail.checkedAt': '服务检查时间',
  'serviceCenter.value.none': '无',
  'serviceCenter.value.notAvailable': '不可用',
  'serviceCenter.value.required': '必需',
  'serviceCenter.value.latency': '{{value}} 毫秒',
  'serviceCenter.installed.notInstalled': '尚未创建',

  // ----- Stable probe details -----
  'serviceCenter.statusDetail.timeout': '健康探测已超时。',
  'serviceCenter.statusDetail.probeError': '健康探测未能完成。',
  'serviceCenter.statusDetail.notConfigured': '服务尚未配置。',
  'serviceCenter.statusDetail.configUnavailable': '无法读取服务配置。',
  'serviceCenter.statusDetail.invalidProbeTarget': '配置的探测目标不在允许范围内。',
  'serviceCenter.statusDetail.httpClientError': '健康端点返回了 HTTP 客户端错误。',
  'serviceCenter.statusDetail.httpServerError': '健康端点返回了 HTTP 服务端错误。',
  'serviceCenter.statusDetail.httpError': '健康端点返回了 HTTP {{status}}。',
  'serviceCenter.statusDetail.httpUnknownError': '健康端点返回了 HTTP 错误。',
  'serviceCenter.statusDetail.other': '更多诊断详情可在服务端日志中查看。',

  // ----- Stable control details -----
  'serviceCenter.controlStatusDetail.notInstalled': '尚未创建受管容器，请先通过 Docker Compose 创建。',
  'serviceCenter.controlStatusDetail.partiallyInstalled': '仅创建了部分受管容器，请先通过 Docker Compose 校准该服务。',
  'serviceCenter.controlStatusDetail.foreignContainer': '预期的容器名称已被非本项目容器占用，为保证安全已禁用控制。',
  'serviceCenter.controlStatusDetail.mixedRuntime': '该服务的组件处于不同运行状态，请检查各容器后再操作。',
  'serviceCenter.controlStatusDetail.externalService': '外部服务的生命周期不能在此页面控制。',
  'serviceCenter.controlStatusDetail.other': '当前无法安全控制该服务，请查看服务端日志。',

  // ----- Integrations -----
  'serviceCenter.integration.mcpTitle': 'MCP 服务器',
  'serviceCenter.integration.mcpDescription': '请在独立管理页面配置 MCP 连接并查看工具；MCP 不计入服务健康汇总。',
  'serviceCenter.integration.manageMcp': '管理 MCP 服务器',

  // ----- Errors -----
  'serviceCenter.error.title': '服务目录暂不可用',
  'serviceCenter.error.loadFailed': '无法加载服务目录；如已有数据，页面会继续保留。',
  'serviceCenter.error.actionFailed': '无法对 {{service}} 执行{{action}}操作，请检查控制权限和服务端日志。',
};
