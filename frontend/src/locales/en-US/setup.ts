// Namespace: setup
// Language: en-US
// Add new keys for this namespace below. Keep keys consistent across
// languages — run `node scripts/check-i18n-keys.js` before commit.
// eslint-disable-next-line import/no-anonymous-default-export
export default {
  'setup.dbType.sqlite': 'SQLite (local file, dev only)',

  'setup.step.database': 'Database',
  'setup.step.redis': 'Redis',
  'setup.step.license': 'License',
  'setup.step.confirm': 'Confirm',

  'setup.msg.dbTestSuccess': 'Database connection succeeded',
  'setup.msg.dbTestFailed': 'Database connection failed: {{error}}',
  'setup.msg.redisUrlEmpty': 'No Redis address provided; running in no-cache mode',
  'setup.msg.redisTestSuccess': 'Redis connection succeeded',
  'setup.msg.redisTestFailed': 'Redis connection failed: {{error}}',
  'setup.msg.saveFailed': 'Failed to save: {{error}}',
  'setup.msg.restartSlow': 'Backend restart is taking a while — please refresh the page manually later',
  'setup.msg.dbTestRequired': 'Please test the database connection first',

  'setup.restarting.title': 'Configuration saved, backend is restarting…',
  'setup.restarting.subtitle': 'Waiting for the service to recover. You will be redirected to the login page automatically once it is ready.',

  'setup.title': 'System Setup',
  'setup.subtitle': 'First-time startup — please configure the required connections. The system will restart automatically once done.',
  'setup.dockerTag': 'Containerized deployment',
  'setup.dockerHint': 'Pre-filled with container service names; usually only the password needs to be completed',

  'setup.form.dbTypeLabel': 'Database type',
  'setup.form.sqlitePathLabel': 'Database file path',
  'setup.form.sqlitePathRequired': 'Please enter the path',
  'setup.form.hostLabel': 'Host',
  'setup.form.hostRequired': 'Please enter the host',
  'setup.form.portLabel': 'Port',
  'setup.form.portRequired': 'Please enter the port',
  'setup.form.databaseLabel': 'Database name',
  'setup.form.databaseRequired': 'Please enter the database name',
  'setup.form.usernameLabel': 'Username',
  'setup.form.passwordLabel': 'Password',
  'setup.form.passwordPlaceholder': 'Enter the database password',

  'setup.redis.optionalHint': 'Redis is optional — leave it blank to run in no-cache mode; core features are not affected.',
  'setup.redis.urlLabel': 'Redis connection URL',

  'setup.license.hint': 'The license can be activated after startup, under "Settings → About". You may skip this for now.',

  'setup.confirm.dbLabel': 'Database',
  'setup.confirm.redisLabel': 'Redis',
  'setup.confirm.redisNotConfigured': 'Not configured (no-cache mode)',
  'setup.confirm.restartWarning': 'After saving, the system will write the configuration and restart automatically; the service will be briefly unavailable.',

  'setup.action.connectionOk': '✓ Connection OK',
  'setup.action.testConnection': 'Test connection',
  'setup.action.prev': 'Previous',
  'setup.action.next': 'Next',
  'setup.action.saveAndStart': 'Save and start',

  // ----- Setup Gate -----
  'setupGate.connecting': 'Connecting to backend...',
  'setupGate.cannotConnect': 'Cannot connect to backend service',
  'setupGate.cannotConnectDesc': 'Please confirm the backend is started, then retry.',
  'setupGate.retry': 'Retry',
};
