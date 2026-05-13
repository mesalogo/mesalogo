"""
后台任务管理器（KISS 版本 - 纯数据库 + 线程池）
"""

import logging
from typing import Dict, Any, Optional, Callable
from concurrent.futures import ThreadPoolExecutor
from sqlalchemy.orm.attributes import flag_modified

from app.models import Job, db
from app.utils.datetime_utils import get_current_time_with_timezone
from core.config import settings

logger = logging.getLogger(__name__)


class JobManager:
    """极简后台任务管理器"""
    
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    def __init__(self):
        if hasattr(self, '_initialized'):
            return
        
        self._initialized = True
        self._executor = None  # 将在 init 时创建
        self._handlers = {}  # job_type -> handler_func
        self._running_jobs = {}  # job_id -> Future
    
    def init(self, max_workers: int = None):
        """初始化（在应用启动时调用）"""
        if max_workers is None:
            max_workers = self._get_max_workers()
        
        # 创建线程池
        self._executor = ThreadPoolExecutor(
            max_workers=max_workers,
            thread_name_prefix="job"
        )
        
        logger.info(f"JobManager 已初始化 (max_workers={max_workers})")
    
    def _get_max_workers(self) -> int:
        """获取最大并发数配置"""
        try:
            from app.models import SystemSetting
            max_workers = SystemSetting.get('job_manager_max_workers', None)
            if max_workers is not None:
                return int(max_workers) if isinstance(max_workers, str) else max_workers
        except Exception as e:
            logger.warning(f"从数据库读取 job_manager_max_workers 失败: {e}")
        
        return settings.get('JOB_MANAGER_MAX_WORKERS', 10)
    
    def register_handler(self, job_type: str, handler_func: Callable):
        """
        注册后台任务处理器
        
        Args:
            job_type: 后台任务类型，如 "kb:vectorize_file"
            handler_func: 处理函数，签名为 func(job_id, params, context) -> result
        """
        self._handlers[job_type] = handler_func
        logger.info(f"注册后台任务处理器: {job_type}")
    
    def submit_job(
        self,
        job_type: str,
        params: Dict[str, Any],
        user_id: str,
        priority: str = "medium",
        max_retries: int = 0
    ) -> str:
        """
        提交后台任务
        
        Args:
            job_type: 后台任务类型，如 "kb:vectorize_file"
            params: 后台任务参数（根据类型不同而不同）
            user_id: 用户ID
            priority: 优先级 high|medium|low
            max_retries: 最大重试次数
        
        Returns:
            job_id: 后台任务ID
        """
        # 构建 data 字段
        data = {
            "priority": priority,
            "progress": 0,
            "message": "等待执行",
            "started_at": None,
            "completed_at": None,
            "retry_count": 0,
            "max_retries": max_retries,
            "error": None,
            "params": params,
            "result": None,
            "logs": []
        }
        
        # 创建后台任务记录
        job = Job(
            job_type=job_type,
            status='pending',
            user_id=user_id,
            data=data
        )
        
        db.session.add(job)
        db.session.commit()
        
        job_id = job.id
        
        # 记录日志
        self._add_log(job_id, "INFO", "后台任务已提交")
        
        # 提交到线程池
        future = self._executor.submit(
            self._execute_job_wrapper,
            job_id
        )
        self._running_jobs[job_id] = future
        
        logger.info(f"后台任务已提交: {job_id} ({job_type})")
        return job_id
    
    def _execute_job_wrapper(self, job_id: str):
        """后台任务执行包装器（在线程中运行）"""
        try:
            job = Job.query.get(job_id)
            if not job:
                logger.error(f"后台任务不存在: {job_id}")
                return
            
            # 检查是否已取消
            if job.status == 'cancelled':
                logger.info(f"后台任务已取消: {job_id}")
                return
            
            # 更新状态为 running
            job.status = 'running'
            job.data['started_at'] = get_current_time_with_timezone().isoformat()
            job.data['progress'] = 0
            job.data['message'] = '开始执行'
            flag_modified(job, 'data')
            db.session.commit()
            
            self._add_log(job_id, "INFO", "开始执行后台任务")
            
            # 获取处理器
            handler = self._handlers.get(job.job_type)
            if not handler:
                raise ValueError(f"未注册的后台任务类型: {job.job_type}")
            
            # 执行后台任务
            context = {
                "job_id": job_id,
                "user_id": job.user_id,
                "manager": self
            }
            
            result = handler(job_id, job.data['params'], context)
            
            # 标记完成
            job = Job.query.get(job_id)
            job.status = 'completed'
            job.data['progress'] = 100
            job.data['message'] = '后台任务完成'
            job.data['result'] = result
            job.data['completed_at'] = get_current_time_with_timezone().isoformat()
            flag_modified(job, 'data')
            db.session.commit()
            
            self._add_log(job_id, "INFO", "后台任务执行成功")
            logger.info(f"后台任务完成: {job_id}")
            
        except Exception as e:
            logger.exception(f"后台任务执行失败: {job_id}")
            self._handle_job_error(job_id, str(e))
        
        finally:
            self._running_jobs.pop(job_id, None)
            db.session.remove()
    
    def _handle_job_error(self, job_id: str, error_msg: str):
        """处理任务错误"""
        job = Job.query.get(job_id)
        if not job:
            return
        
        retry_count = job.data.get('retry_count', 0)
        max_retries = job.data.get('max_retries', 0)
        
        if retry_count < max_retries:
            # 重试
            job.data['retry_count'] = retry_count + 1
            job.status = 'retrying'
            job.data['progress'] = 0
            job.data['message'] = f'重试 {retry_count + 1}/{max_retries}'
            job.data['error'] = error_msg
            flag_modified(job, 'data')
            db.session.commit()
            
            self._add_log(job_id, "WARNING", f"后台任务失败，准备重试: {error_msg}")
            
            # 重新提交
            future = self._executor.submit(self._execute_job_wrapper, job_id)
            self._running_jobs[job_id] = future
        else:
            # 放弃
            job.status = 'failed'
            job.data['progress'] = 0
            # 显示实际错误信息
            job.data['message'] = error_msg if len(error_msg) < 200 else error_msg[:200] + '...'
            job.data['error'] = error_msg  # 完整错误信息保存在error字段
            job.data['completed_at'] = get_current_time_with_timezone().isoformat()
            flag_modified(job, 'data')
            db.session.commit()
            
            self._add_log(job_id, "ERROR", f"后台任务失败: {error_msg}")
    
    def update_progress(self, job_id: str, progress: int, message: str = "", extra_data: dict = None):
        """更新任务进度（供任务处理器调用）
        
        Args:
            job_id: 任务ID
            progress: 进度百分比 (0-100)
            message: 进度消息
            extra_data: 额外数据，会合并到job.data中（如状态信息）
        """
        job = Job.query.get(job_id)
        if job:
            job.data['progress'] = progress
            if message:
                job.data['message'] = message
            
            # 合并额外数据
            if extra_data:
                job.data.update(extra_data)
            
            flag_modified(job, 'data')
            db.session.commit()
            
            if message:
                self._add_log(job_id, "INFO", message)
    
    def _add_log(self, job_id: str, level: str, message: str):
        """添加日志到 data.logs（保留最近 20 条）"""
        job = Job.query.get(job_id)
        if not job:
            return
        
        log_entry = {
            "time": get_current_time_with_timezone().isoformat(),
            "level": level,
            "message": message
        }
        
        logs = job.data.get('logs', [])
        logs.insert(0, log_entry)  # 新日志在前
        job.data['logs'] = logs[:20]  # 只保留最近 20 条
        flag_modified(job, 'data')
        
        db.session.commit()
    
    def get_job_status(self, job_id: str) -> Optional[Dict[str, Any]]:
        """查询后台任务状态"""
        job = Job.query.get(job_id)
        if not job:
            return None
        return job.to_dict()
    
    def cancel_job(self, job_id: str) -> bool:
        """取消后台任务"""
        job = Job.query.get(job_id)
        if not job or job.status in ['completed', 'failed']:
            return False
        
        job.status = 'cancelled'
        job.data['message'] = '用户取消'
        job.data['completed_at'] = get_current_time_with_timezone().isoformat()
        flag_modified(job, 'data')
        db.session.commit()
        
        self._add_log(job_id, "WARNING", "后台任务已取消")
        
        # 尝试取消 Future
        future = self._running_jobs.get(job_id)
        if future:
            future.cancel()
        
        return True
    
    def list_jobs(
        self,
        user_id: str = None,
        job_type: str = None,
        status: str = None,
        offset: int = 0,
        limit: int = 20
    ) -> Dict[str, Any]:
        """查询后台任务列表"""
        query = Job.query
        
        if user_id:
            query = query.filter_by(user_id=user_id)
        if job_type:
            query = query.filter_by(job_type=job_type)
        if status:
            query = query.filter_by(status=status)
        
        total = query.count()
        jobs = query.order_by(Job.created_at.desc())\
            .offset(offset)\
            .limit(limit)\
            .all()
        
        return {
            'jobs': [job.to_dict() for job in jobs],
            'total': total,
            'offset': offset,
            'limit': limit
        }
    
    def get_stats(self, user_id: str = None) -> Dict[str, Any]:
        """获取后台任务统计"""
        query = Job.query
        if user_id:
            query = query.filter_by(user_id=user_id)
        
        return {
            'total': query.count(),
            'pending': query.filter_by(status='pending').count(),
            'running': query.filter_by(status='running').count(),
            'completed': query.filter_by(status='completed').count(),
            'failed': query.filter_by(status='failed').count(),
        }
    
    def shutdown(self):
        """关闭线程池"""
        logger.info("正在关闭后台任务管理器...")
        self._executor.shutdown(wait=True)
        logger.info("后台任务管理器已关闭")


# 全局单例
job_manager = JobManager()
