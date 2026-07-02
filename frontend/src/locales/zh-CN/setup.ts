// Namespace: setup
// Language: zh-CN
// Add new keys for this namespace below. Keep keys consistent across
// languages — run `node scripts/check-i18n-keys.js` before commit.
// eslint-disable-next-line import/no-anonymous-default-export
export default {
  'setup.dbType.sqlite': 'SQLite（本地文件，仅开发）',

  'setup.step.database': '数据库',
  'setup.step.redis': 'Redis',
  'setup.step.license': '许可证',
  'setup.step.confirm': '确认',

  'setup.msg.dbTestSuccess': '数据库连接成功',
  'setup.msg.dbTestFailed': '数据库连接失败：{{error}}',
  'setup.msg.redisUrlEmpty': '未填写 Redis 地址，将以无缓存模式运行',
  'setup.msg.redisTestSuccess': 'Redis 连接成功',
  'setup.msg.redisTestFailed': 'Redis 连接失败：{{error}}',
  'setup.msg.saveFailed': '保存失败：{{error}}',
  'setup.msg.restartSlow': '后端重启耗时较长，请稍后手动刷新页面',
  'setup.msg.dbTestRequired': '请先测试数据库连接通过',

  'setup.restarting.title': '配置已保存，后端正在重启…',
  'setup.restarting.subtitle': '正在等待服务恢复，完成后将自动进入登录页面，请稍候。',

  'setup.title': '系统初始化',
  'setup.subtitle': '首次启动，请配置必要的连接信息，完成后系统将自动重启。',
  'setup.dockerTag': '容器部署',
  'setup.dockerHint': '已按容器服务名预填，通常只需补全密码',

  'setup.form.dbTypeLabel': '数据库类型',
  'setup.form.sqlitePathLabel': '数据库文件路径',
  'setup.form.sqlitePathRequired': '请输入路径',
  'setup.form.hostLabel': '主机',
  'setup.form.hostRequired': '请输入主机',
  'setup.form.portLabel': '端口',
  'setup.form.portRequired': '请输入端口',
  'setup.form.databaseLabel': '数据库名',
  'setup.form.databaseRequired': '请输入数据库名',
  'setup.form.usernameLabel': '用户名',
  'setup.form.passwordLabel': '密码',
  'setup.form.passwordPlaceholder': '请输入数据库密码',

  'setup.redis.optionalHint': 'Redis 为可选项，留空则以无缓存模式运行，不影响核心功能。',
  'setup.redis.urlLabel': 'Redis 连接地址',

  'setup.license.hint': '许可证可在系统启动后于「设置 → 关于」中激活，此处可直接跳过。',

  'setup.confirm.dbLabel': '数据库',
  'setup.confirm.redisLabel': 'Redis',
  'setup.confirm.redisNotConfigured': '未配置（无缓存模式）',
  'setup.confirm.restartWarning': '保存后系统将写入配置并自动重启，期间服务短暂不可用。',

  'setup.action.connectionOk': '✓ 连接正常',
  'setup.action.testConnection': '测试连接',
  'setup.action.prev': '上一步',
  'setup.action.next': '下一步',
  'setup.action.saveAndStart': '保存并启动',

  // ----- 首启引导守卫 -----
  'setupGate.connecting': '正在连接后端…',
  'setupGate.cannotConnect': '无法连接到后端服务',
  'setupGate.cannotConnectDesc': '请确认后端已启动，然后重试。',
  'setupGate.retry': '重试',
};
