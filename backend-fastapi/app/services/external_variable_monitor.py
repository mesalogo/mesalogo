import threading
import time
import logging
from datetime import datetime, timedelta
from app.extensions import db
from app.models import ExternalEnvironmentVariable
from app.api.routes.external_variables import sync_external_variable

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class ExternalVariableMonitor:
    """外部环境变量监控器

    负责在后台线程中定期同步外部环境变量
    """

    def __init__(self, app=None):
        self.app = app
        self.monitor_thread = None
        self.stop_event = threading.Event()
        self.check_interval = 30  # 检查间隔（秒）

    def init_app(self, app):
        """初始化应用"""
        self.app = app

    def start_monitoring(self):
        """启动监控线程"""
        if self.monitor_thread and self.monitor_thread.is_alive():
            logger.warning("监控线程已在运行")
            return

        self.stop_event.clear()
        self.monitor_thread = threading.Thread(target=self._monitor_loop, daemon=True)
        self.monitor_thread.start()
        logger.info("外部环境变量监控线程已启动")

    def stop_monitoring(self):
        """停止监控线程"""
        if self.monitor_thread and self.monitor_thread.is_alive():
            self.stop_event.set()
            self.monitor_thread.join(timeout=5)
            logger.info("外部环境变量监控线程已停止")

    def _monitor_loop(self):
        """监控循环"""
        logger.info("开始监控外部环境变量")

        while not self.stop_event.is_set():
            try:
                try:
                    self._check_and_sync_variables()
                finally:
                    db.session.remove()
            except Exception as e:
                logger.error(f"监控循环出错: {str(e)}")

            # 等待下次检查
            self.stop_event.wait(self.check_interval)

        logger.info("监控循环结束")

    def _check_and_sync_variables(self):
        """检查并同步需要更新的变量"""
        try:
            # 获取所有启用的外部环境变量
            variables = ExternalEnvironmentVariable.query.filter_by(sync_enabled=True).all()

            current_time = datetime.utcnow()
            sync_count = 0

            for variable in variables:
                try:
                    # 检查是否需要同步
                    if self._should_sync_variable(variable, current_time):
                        logger.info(f"开始同步变量: {variable.name}")

                        # 在单独的线程中执行同步，避免阻塞主监控循环
                        sync_thread = threading.Thread(
                            target=self._sync_variable_thread,
                            args=(variable,),
                            daemon=True
                        )
                        sync_thread.start()
                        sync_count += 1

                except Exception as e:
                    logger.error(f"检查变量 {variable.name} 时出错: {str(e)}")

            if sync_count > 0:
                logger.info(f"启动了 {sync_count} 个同步任务")

        except Exception as e:
            logger.error(f"检查变量时出错: {str(e)}")

    def _should_sync_variable(self, variable, current_time):
        """判断变量是否需要同步"""
        # 如果从未同步过，需要同步
        if not variable.last_sync:
            return True

        # 计算下次同步时间
        next_sync_time = variable.last_sync + timedelta(seconds=variable.sync_interval)

        # 如果当前时间超过了下次同步时间，需要同步
        return current_time >= next_sync_time

    def _sync_variable_thread(self, variable):
        """在单独线程中同步变量"""
        try:
            try:
                # 重新获取变量实例，避免跨线程问题
                fresh_variable = ExternalEnvironmentVariable.query.get(variable.id)
                if fresh_variable and fresh_variable.sync_enabled:
                    success, error_msg = sync_external_variable(fresh_variable)
                    if success:
                        logger.info(f"变量 {fresh_variable.name} 同步成功")
                    else:
                        logger.error(f"变量 {fresh_variable.name} 同步失败: {error_msg}")
            finally:
                db.session.remove()
        except Exception as e:
            logger.error(f"同步变量 {variable.name} 时出错: {str(e)}")

    def get_monitor_status(self):
        """获取监控状态"""
        return {
            'is_running': self.monitor_thread and self.monitor_thread.is_alive(),
            'check_interval': self.check_interval,
            'thread_name': self.monitor_thread.name if self.monitor_thread else None
        }

    def sync_all_variables(self):
        """手动同步所有启用的变量"""
        try:
            variables = ExternalEnvironmentVariable.query.filter_by(sync_enabled=True).all()

            sync_results = []
            for variable in variables:
                try:
                    success, error_msg = sync_external_variable(variable)
                    sync_results.append({
                        'name': variable.name,
                        'success': success,
                        'error': error_msg
                    })
                except Exception as e:
                    sync_results.append({
                        'name': variable.name,
                        'success': False,
                        'error': str(e)
                    })

            return sync_results
        except Exception as e:
            logger.error(f"批量同步变量失败: {str(e)}")
            return []

# 全局监控器实例
external_variable_monitor = ExternalVariableMonitor()

def init_external_variable_monitor(app):
    """初始化外部变量监控器"""
    external_variable_monitor.init_app(app)

    # 直接启动监控器（在应用初始化时）
    def start_monitor():
        try:
            external_variable_monitor.start_monitoring()
            logger.info("外部变量监控器启动成功")
        except Exception as e:
            logger.error(f"外部变量监控器启动失败: {e}")

    # 延迟启动监控器
    import threading
    def delayed_start():
        import time
        time.sleep(2)  # 等待应用完全启动
        start_monitor()

    threading.Thread(target=delayed_start, daemon=True).start()

    # 在应用关闭时停止监控
    import atexit
    atexit.register(external_variable_monitor.stop_monitoring)

    return external_variable_monitor
