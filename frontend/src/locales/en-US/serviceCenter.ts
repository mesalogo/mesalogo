// Namespace: serviceCenter
// Language: en-US
// Keep keys consistent with zh-CN/serviceCenter.ts.
// eslint-disable-next-line import/no-anonymous-default-export
export default {
  // ----- Page -----
  'serviceCenter.title': 'Services & Integrations',
  'serviceCenter.subtitle': 'Review configured, runtime, and health states for services in this installation.',

  // ----- Summary -----
  'serviceCenter.summary.total': 'Total',
  'serviceCenter.summary.healthy': 'Healthy',
  'serviceCenter.summary.degraded': 'Degraded',
  'serviceCenter.summary.unhealthy': 'Unhealthy',
  'serviceCenter.summary.disabled': 'Disabled',
  'serviceCenter.summary.unknown': 'Unknown',

  // ----- Metadata and actions -----
  'serviceCenter.meta.deploymentMode': 'Deployment mode',
  'serviceCenter.meta.lastChecked': 'Last checked',
  'serviceCenter.deploymentMode.docker': 'Docker',
  'serviceCenter.deploymentMode.native': 'Native',
  'serviceCenter.deployment.embedded': 'Embedded',
  'serviceCenter.deployment.native': 'Native process',
  'serviceCenter.deployment.dockerCompose': 'Docker Compose',
  'serviceCenter.deployment.external': 'External service',
  'serviceCenter.deployment.other': 'Other ({{deployment}})',
  'serviceCenter.action.refresh': 'Refresh',
  'serviceCenter.action.retry': 'Retry',
  'serviceCenter.action.configure': 'Configure',
  'serviceCenter.action.viewLogs': 'View logs',
  'serviceCenter.action.start': 'Start',
  'serviceCenter.action.stop': 'Stop',
  'serviceCenter.action.restart': 'Restart',
  'serviceCenter.filter.category': 'Filter by category',

  // ----- Lifecycle control -----
  'serviceCenter.control.unavailableTitle': 'Service control is not enabled',
  'serviceCenter.control.unavailableDescription': 'Run make up-control in the abm-docker directory to mount the Docker socket and enable start, stop, and restart. Containers that Docker Compose has never created must still be created with Docker Compose first.',
  'serviceCenter.control.actionChanged': '{{action}} completed for {{service}}.',
  'serviceCenter.control.noChange': '{{service}} is already in the requested state; no change was needed.',
  'serviceCenter.confirm.stopTitle': 'Stop {{service}}?',
  'serviceCenter.confirm.stopDescription': 'Stopping the service may interrupt active requests. Confirming will stop all managed containers for this service.',
  'serviceCenter.confirm.restartTitle': 'Restart {{service}}?',
  'serviceCenter.confirm.restartDescription': 'The service will be briefly unavailable during restart, and active requests may be interrupted.',

  // ----- Table -----
  'serviceCenter.table.title': 'Service inventory',
  'serviceCenter.table.details': 'Details',
  'serviceCenter.table.empty': 'No services match this category.',
  'serviceCenter.column.service': 'Service',
  'serviceCenter.column.category': 'Category',
  'serviceCenter.column.configured': 'Configured',
  'serviceCenter.column.runtime': 'Runtime',
  'serviceCenter.column.images': 'Images',
  'serviceCenter.column.health': 'Health',
  'serviceCenter.column.endpoint': 'Endpoint',
  'serviceCenter.column.dependencies': 'Dependencies',
  'serviceCenter.column.configuration': 'Configuration',
  'serviceCenter.column.actions': 'Actions',

  // ----- State -----
  'serviceCenter.configured.enabled': 'Enabled',
  'serviceCenter.configured.disabled': 'Disabled',
  'serviceCenter.configured.unknown': 'Unknown',
  'serviceCenter.runtime.running': 'Running',
  'serviceCenter.runtime.stopped': 'Stopped',
  'serviceCenter.runtime.unknown': 'Unknown',
  'serviceCenter.image.available': 'Available',
  'serviceCenter.image.partial': 'Partially available',
  'serviceCenter.image.missing': 'Missing',
  'serviceCenter.image.unknown': 'Not checked',
  'serviceCenter.image.present': 'Present',
  'serviceCenter.health.healthy': 'Healthy',
  'serviceCenter.health.degraded': 'Degraded',
  'serviceCenter.health.unhealthy': 'Unhealthy',
  'serviceCenter.health.disabled': 'Disabled',
  'serviceCenter.health.unknown': 'Unknown',

  // ----- Categories -----
  'serviceCenter.category.all': 'All categories',
  'serviceCenter.category.core': 'Core',
  'serviceCenter.category.infrastructure': 'Infrastructure',
  'serviceCenter.category.data': 'Data',
  'serviceCenter.category.knowledge': 'Knowledge',
  'serviceCenter.category.capability': 'Capability',
  'serviceCenter.category.integration': 'Integration',
  'serviceCenter.category.other': 'Other ({{category}})',

  // ----- Logical service names -----
  'serviceCenter.services.backend': 'Backend API',
  'serviceCenter.services.frontend': 'Frontend UI',
  'serviceCenter.services.database': 'Database',
  'serviceCenter.services.redis': 'Redis',
  'serviceCenter.services.milvus': 'Milvus',
  'serviceCenter.services.graphiti': 'Graphiti',
  'serviceCenter.services.lightrag': 'LightRAG',
  'serviceCenter.services.onlyoffice': 'OnlyOffice',
  'serviceCenter.services.galapagos': 'Galapagos',
  'serviceCenter.services.paddleocrVl': 'PaddleOCR-VL',
  'serviceCenter.services.codeServer': 'Code Server',
  'serviceCenter.services.unknown': 'Unknown service ({{id}})',

  // ----- Expanded details -----
  'serviceCenter.detail.deployment': 'Deployment',
  'serviceCenter.detail.latency': 'Probe latency',
  'serviceCenter.detail.components': 'Catalog components',
  'serviceCenter.detail.componentsHint': 'Component names describe the service group; they are not individual observed runtime states.',
  'serviceCenter.detail.images': 'Required images',
  'serviceCenter.detail.imagesHint': 'Image presence is checked locally through Docker Engine. No image is pulled automatically.',
  'serviceCenter.detail.statusDetail': 'Status detail',
  'serviceCenter.detail.controlStatus': 'Control status detail',
  'serviceCenter.detail.checkedAt': 'Service checked at',
  'serviceCenter.value.none': 'None',
  'serviceCenter.value.notAvailable': 'Not available',
  'serviceCenter.value.required': 'Required',
  'serviceCenter.value.latency': '{{value}} ms',
  'serviceCenter.installed.notInstalled': 'Not created',

  // ----- Stable probe details -----
  'serviceCenter.statusDetail.timeout': 'The health probe timed out.',
  'serviceCenter.statusDetail.probeError': 'The health probe could not be completed.',
  'serviceCenter.statusDetail.notConfigured': 'The service is not configured.',
  'serviceCenter.statusDetail.configUnavailable': 'The service configuration is unavailable.',
  'serviceCenter.statusDetail.invalidProbeTarget': 'The configured probe target is not allowed.',
  'serviceCenter.statusDetail.httpClientError': 'The health endpoint returned an HTTP client error.',
  'serviceCenter.statusDetail.httpServerError': 'The health endpoint returned an HTTP server error.',
  'serviceCenter.statusDetail.httpError': 'The health endpoint returned HTTP {{status}}.',
  'serviceCenter.statusDetail.httpUnknownError': 'The health endpoint returned an HTTP error.',
  'serviceCenter.statusDetail.other': 'Additional diagnostic detail is available in server logs.',

  // ----- Stable control details -----
  'serviceCenter.controlStatusDetail.notInstalled': 'Managed containers have not been created. Create them with Docker Compose first.',
  'serviceCenter.controlStatusDetail.partiallyInstalled': 'Only some managed containers exist. Reconcile this service with Docker Compose first.',
  'serviceCenter.controlStatusDetail.foreignContainer': 'An expected container name belongs to a container outside this project, so control has been disabled for safety.',
  'serviceCenter.controlStatusDetail.mixedRuntime': 'This service\'s components are in different runtime states. Inspect the containers before acting.',
  'serviceCenter.controlStatusDetail.externalService': 'The lifecycle of an external service cannot be controlled from this page.',
  'serviceCenter.controlStatusDetail.other': 'This service cannot be controlled safely right now. See server logs for details.',

  // ----- Integrations -----
  'serviceCenter.integration.mcpTitle': 'MCP servers',
  'serviceCenter.integration.mcpDescription': 'Configure MCP connections and inspect their tools on the dedicated management page. MCP is not included in the service health summary.',
  'serviceCenter.integration.manageMcp': 'Manage MCP servers',

  // ----- Errors -----
  'serviceCenter.error.title': 'Service inventory unavailable',
  'serviceCenter.error.loadFailed': 'The service inventory could not be loaded. Existing data, if any, has been kept.',
  'serviceCenter.error.actionFailed': 'Could not {{action}} {{service}}. Check the control permission and server logs.',
};
