"""
并行实验室 API 路由

提供并行实验的 REST API 端点
"""
import logging
from typing import Optional
from fastapi import APIRouter, HTTPException, Query, Request, Depends
from fastapi.responses import JSONResponse, StreamingResponse
from core.config import settings
from core.dependencies import get_current_user, get_admin_user, clean_db_session
from app import db
from app.services.parallel_experiment_service import ParallelExperimentService

logger = logging.getLogger(__name__)

# 所有并行实验路由使用 clean_db_session 依赖，确保每个请求的 DB session 干净
# 这是因为：
# 1. 并行实验涉及大量后台线程写入（experiment_executor），容易导致 MySQL 乐观锁冲突
# 2. FastAPI sync 路由运行在 AnyIO 线程池中，线程会被复用
# 3. MySQL REPEATABLE READ 隔离级别下，复用线程的 session 可能看不到其他线程提交的新数据
# clean_db_session 通过 rollback() 开启新事务，确保能看到最新数据
router = APIRouter(dependencies=[Depends(clean_db_session)])



@router.get('/parallel-experiments')
def list_experiments(request: Request):
    """获取实验列表（包含模板和用户实验，支持分页）
    
    Query params:
        - page: 页码（默认 1）
        - limit: 每页数量（默认 20）
        - include_templates: 是否包含模板（默认 true）
    """
    try:
        page = int(request.query_params.get('page', 1))
        limit = int(request.query_params.get('limit', 20))
        include_templates = request.query_params.get('include_templates', 'true').lower() == 'true'
        
        result = ParallelExperimentService.list_experiments(
            include_templates=include_templates,
            page=page,
            limit=limit
        )
        return {
            'success': True,
            **result
        }
    except Exception as e:
        logger.error(f"获取实验列表失败: {str(e)}")
        db.session.rollback()
        raise HTTPException(status_code=500, detail={'error': f'获取实验列表失败: {str(e)}'})


@router.post('/parallel-experiments')
async def create_experiment(request: Request, current_user=Depends(get_current_user)):
    """创建新的并行实验"""
    try:
        # 获取当前用户
        data = await request.json()
        
        # 验证必填字段
        required_fields = ['name', 'source_action_space_id']
        for field in required_fields:
            if not data.get(field):
                raise HTTPException(status_code=400, detail={'error': f'缺少必填字段: {field}'})
        
        # 构建配置
        # task_config 可以直接从前端传入，也可以从顶层字段获取
        task_config = data.get('task_config', {})
        if not task_config:
            task_config = {
                'type': data.get('type', 'discussion'),
                'rounds': data.get('rounds', 3),
                'topic': data.get('topic', ''),
                'totalTasks': data.get('totalTasks', 3),
                'maxConcurrent': data.get('maxConcurrent', 3)
            }
        
        config = {
            'name': data['name'],
            'description': data.get('description', ''),
            'source_action_space_id': data['source_action_space_id'],
            'variables': data.get('variables', {}),
            'objectives': data.get('objectives', []),
            'stop_conditions': data.get('stopConditions', data.get('stop_conditions', [])),
            'task_config': task_config
        }
        
        experiment_id = ParallelExperimentService.create_experiment(
            config, 
            user_id=current_user.id if current_user else None
        )
        
        return JSONResponse(content={
            'success': True,
            'id': experiment_id,
            'message': '实验创建成功'
        }, status_code=201)
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail={'error': str(e)})
    except Exception as e:
        logger.error(f"创建实验失败: {str(e)}")
        raise HTTPException(status_code=500, detail={'error': f'创建实验失败: {str(e)}'})


@router.get('/parallel-experiments/{experiment_id}')
def get_experiment(experiment_id):
    """获取实验详情（Redis 缓存：completed/stopped 60s，running 5s）"""
    try:
        # 尝试 Redis 缓存
        try:
            from core.cache import cache_get, cache_set
            cache_key = f"exp_detail:{experiment_id}"
            cached = cache_get(cache_key)
            if cached:
                return {'success': True, 'experiment': cached}
        except Exception:
            pass

        experiment = ParallelExperimentService.get_experiment(experiment_id)
        if not experiment:
            raise HTTPException(status_code=404, detail={'error': '实验未找到'})
        
        # 写入缓存
        try:
            from core.cache import cache_set
            status = experiment.get('status', 'running')
            ttl = 60 if status in ('completed', 'stopped', 'template') else 5
            cache_set(f"exp_detail:{experiment_id}", experiment, ttl)
        except Exception:
            pass

        return {
            'success': True,
            'experiment': experiment
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取实验详情失败: {str(e)}")
        db.session.rollback()
        raise HTTPException(status_code=500, detail={'error': f'获取实验详情失败: {str(e)}'})


@router.get('/parallel-experiments/{experiment_id}/status')
def get_experiment_status(experiment_id, request: Request):
    """获取实验状态（用于轮询，支持 runs 分页）
    
    Redis 缓存策略：
    - running 状态: TTL 3s（高频轮询去重，3s 内重复请求直接返回缓存）
    - completed/stopped: TTL 60s（状态不变，可以缓存更久）
    - include_messages=true / 分页请求: 不缓存
    
    Query params:
        - include_messages: 是否包含消息列表（默认 false）
        - iteration: 指定轮次（默认为当前轮次）
        - runs_page: runs 分页页码（1-based）
        - runs_limit: 每页 runs 数量（默认 10）
    """
    try:
        include_messages = request.query_params.get('include_messages', 'false').lower() == 'true'
        iteration_str = request.query_params.get('iteration')
        iteration = int(iteration_str) if iteration_str else None
        runs_page_str = request.query_params.get('runs_page')
        runs_limit_str = request.query_params.get('runs_limit')
        runs_page = int(runs_page_str) if runs_page_str else None
        runs_limit = int(runs_limit_str) if runs_limit_str else None
        
        # 不含消息 且 不分页时 才走 Redis 缓存
        if not include_messages and runs_page is None:
            try:
                from core.cache import cache_get, cache_set
                cache_key = f"exp_status:{experiment_id}:{iteration or 'cur'}"
                cached = cache_get(cache_key)
                if cached:
                    return {'success': True, **cached}
            except Exception:
                pass
        
        status = ParallelExperimentService.get_experiment_status(
            experiment_id, 
            include_messages=include_messages,
            iteration=iteration,
            runs_page=runs_page,
            runs_limit=runs_limit
        )
        if not status:
            raise HTTPException(status_code=404, detail={'error': '实验未找到'})
        
        # 写入缓存（不含 messages 且不分页时）
        if not include_messages and runs_page is None:
            try:
                from core.cache import cache_set
                exp_status = status.get('status', 'running')
                ttl = 60 if exp_status in ('completed', 'stopped', 'template') else 3
                cache_key = f"exp_status:{experiment_id}:{iteration or 'cur'}"
                cache_set(cache_key, status, ttl)
            except Exception:
                pass
        
        return {
            'success': True,
            **status
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取实验状态失败: {str(e)}")
        db.session.rollback()
        raise HTTPException(status_code=500, detail={'error': f'获取实验状态失败: {str(e)}'})


@router.post('/parallel-experiments/draft')
async def create_draft_experiment(request: Request):
    """创建草稿实验（仅基础信息，不启动）"""
    try:
        data = await request.json()
        
        # 验证必填字段
        required_fields = ['name', 'source_action_space_id']
        for field in required_fields:
            if not data.get(field):
                raise HTTPException(status_code=400, detail={'error': f'缺少必填字段: {field}'})
        
        experiment_id = ParallelExperimentService.create_draft_experiment(
            name=data['name'],
            description=data.get('description', ''),
            source_action_space_id=data['source_action_space_id']
        )
        
        return JSONResponse(content={
            'success': True,
            'id': experiment_id,
            'message': '草稿实验创建成功'
        }, status_code=201)
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail={'error': str(e)})
    except Exception as e:
        logger.error(f"创建草稿实验失败: {str(e)}")
        raise HTTPException(status_code=500, detail={'error': f'创建草稿实验失败: {str(e)}'})


@router.put('/parallel-experiments/{experiment_id}')
async def update_experiment(experiment_id, request: Request):
    """更新实验配置"""
    try:
        data = await request.json()
        
        success = ParallelExperimentService.update_experiment(experiment_id, data)
        if not success:
            raise HTTPException(status_code=400, detail={'error': '更新实验失败，实验可能不存在或状态不允许更新'})
        
        return {
            'success': True,
            'message': '实验配置已更新'
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail={'error': str(e)})
    except Exception as e:
        logger.error(f"更新实验失败: {str(e)}")
        raise HTTPException(status_code=500, detail={'error': f'更新实验失败: {str(e)}'})


@router.post('/parallel-experiments/{experiment_id}/start')
def start_experiment(experiment_id, current_user=Depends(get_current_user)):
    """启动实验（从 created 状态启动）"""
    try:
        # 获取当前用户
        success = ParallelExperimentService.start_experiment(
            experiment_id,
            user_id=current_user.id if current_user else None
        )
        if not success:
            raise HTTPException(status_code=400, detail={'error': '启动实验失败，实验可能不存在或状态不允许启动'})
        
        return {
            'success': True,
            'message': '实验已启动'
        }
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail={'error': str(e)})
    except Exception as e:
        logger.error(f"启动实验失败: {str(e)}")
        db.session.rollback()
        raise HTTPException(status_code=500, detail={'error': f'启动实验失败: {str(e)}'})


@router.post('/parallel-experiments/{experiment_id}/clone')
async def clone_experiment(experiment_id, request: Request):
    """复制实验（包括模板实验）"""
    try:
        data = await request.json() or {}
        new_name = data.get('name')
        
        new_experiment_id = ParallelExperimentService.clone_experiment(experiment_id, new_name)
        
        return JSONResponse(content={
            'success': True,
            'id': new_experiment_id,
            'message': '实验复制成功，可以修改配置后启动'
        }, status_code=201)
    except ValueError as e:
        raise HTTPException(status_code=400, detail={'error': str(e)})
    except Exception as e:
        logger.error(f"复制实验失败: {str(e)}")
        raise HTTPException(status_code=500, detail={'error': f'复制实验失败: {str(e)}'})


@router.post('/parallel-experiments/{experiment_id}/pause')
def pause_experiment(experiment_id):
    """暂停实验"""
    try:
        success = ParallelExperimentService.pause_experiment(experiment_id)
        if not success:
            raise HTTPException(status_code=400, detail={'error': '暂停实验失败，实验可能不存在或状态不允许暂停'})
        
        return {
            'success': True,
            'message': '实验已暂停'
        }
    except Exception as e:
        logger.error(f"暂停实验失败: {str(e)}")
        raise HTTPException(status_code=500, detail={'error': f'暂停实验失败: {str(e)}'})


@router.post('/parallel-experiments/{experiment_id}/resume')
def resume_experiment(experiment_id):
    """恢复实验"""
    try:
        success = ParallelExperimentService.resume_experiment(experiment_id)
        if not success:
            raise HTTPException(status_code=400, detail={'error': '恢复实验失败，实验可能不存在或状态不允许恢复'})
        
        return {
            'success': True,
            'message': '实验已恢复'
        }
    except Exception as e:
        logger.error(f"恢复实验失败: {str(e)}")
        raise HTTPException(status_code=500, detail={'error': f'恢复实验失败: {str(e)}'})


@router.post('/parallel-experiments/{experiment_id}/stop')
def stop_experiment(experiment_id):
    """停止实验"""
    try:
        success = ParallelExperimentService.stop_experiment(experiment_id)
        if not success:
            raise HTTPException(status_code=400, detail={'error': '停止实验失败，实验可能不存在或状态不允许停止'})
        
        return {
            'success': True,
            'message': '实验已停止'
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"停止实验失败: {str(e)}")
        db.session.rollback()
        raise HTTPException(status_code=500, detail={'error': f'停止实验失败: {str(e)}'})


@router.delete('/parallel-experiments/{experiment_id}')
def delete_experiment(experiment_id):
    """删除实验"""
    try:
        success = ParallelExperimentService.delete_experiment(experiment_id)
        if not success:
            raise HTTPException(status_code=404, detail={'error': '删除实验失败，实验可能不存在'})
        
        return {
            'success': True,
            'message': '实验已删除'
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail={'error': str(e)})
    except Exception as e:
        logger.error(f"删除实验失败: {str(e)}")
        raise HTTPException(status_code=500, detail={'error': f'删除实验失败: {str(e)}'})


@router.post('/parallel-experiments/{experiment_id}/create-best-task')
async def create_best_task(experiment_id, request: Request, current_user=Depends(get_current_user)):
    """使用最佳参数创建新任务"""
    try:
        # 获取当前用户
        data = await request.json() or {}
        task_name = data.get('name')
        
        task_id = ParallelExperimentService.create_best_task(
            experiment_id, 
            task_name,
            user_id=current_user.id if current_user else None
        )
        
        return JSONResponse(content={
            'success': True,
            'action_task_id': task_id,
            'message': '已创建新任务'
        }, status_code=201)
    except ValueError as e:
        raise HTTPException(status_code=400, detail={'error': str(e)})
    except Exception as e:
        logger.error(f"创建任务失败: {str(e)}")
        raise HTTPException(status_code=500, detail={'error': f'创建任务失败: {str(e)}'})


@router.get('/parallel-experiments/{experiment_id}/steps')
def get_experiment_steps(experiment_id, request: Request):
    """获取实验的步骤记录（变量历史，支持分页）
    
    Query params:
        - page: 页码（不传则返回全部，向后兼容）
        - limit: 每页数量（默认 50）
    
    Redis 缓存：已完成实验的 steps 不变，缓存 60s
    """
    try:
        page_str = request.query_params.get('page')
        limit_str = request.query_params.get('limit')
        page = int(page_str) if page_str else None
        limit = int(limit_str) if limit_str else None

        # 已完成实验尝试 Redis 缓存
        cache_key = None
        try:
            from core.cache import cache_get, cache_set
            cache_key = f"exp_steps:{experiment_id}:p{page or 'all'}:l{limit or 'all'}"
            cached = cache_get(cache_key)
            if cached:
                return {'success': True, **cached} if isinstance(cached, dict) and 'steps' in cached else {'success': True, 'steps': cached}
        except Exception:
            pass

        result = ParallelExperimentService.get_experiment_steps(experiment_id, page=page, limit=limit)
        
        # 写入缓存
        if cache_key:
            try:
                from core.cache import cache_set
                cache_set(cache_key, result, 60)
            except Exception:
                pass

        if isinstance(result, dict):
            return {'success': True, **result}
        return {'success': True, 'steps': result}
    except Exception as e:
        logger.error(f"获取实验步骤失败: {str(e)}")
        raise HTTPException(status_code=500, detail={'error': f'获取实验步骤失败: {str(e)}'})


@router.get('/parallel-experiments/{experiment_id}/runs/{action_task_id}/steps')
def get_run_steps(experiment_id, action_task_id):
    """获取单个 run 的步骤记录"""
    try:
        steps = ParallelExperimentService.get_run_steps(experiment_id, action_task_id)
        return {
            'success': True,
            'steps': steps
        }
    except Exception as e:
        logger.error(f"获取运行步骤失败: {str(e)}")
        raise HTTPException(status_code=500, detail={'error': f'获取运行步骤失败: {str(e)}'})


@router.post('/parallel-experiments/validate-config')
async def validate_experiment_config(request: Request):
    """验证实验配置"""
    try:
        data = await request.json()
        errors = []
        
        # 验证必填字段
        if not data.get('name'):
            errors.append('缺少实验名称')
        if not data.get('source_action_space_id'):
            errors.append('缺少行动空间ID')
        
        # 验证变量配置
        variables = data.get('variables', {})
        for var_name, var_config in variables.items():
            if not isinstance(var_config, dict):
                errors.append(f'变量 {var_name} 配置格式错误')
                continue
            
            var_type = var_config.get('type')
            if var_type not in ['enumerated', 'stepped', 'random']:
                errors.append(f'变量 {var_name} 类型无效: {var_type}')
            
            if var_type == 'enumerated':
                if 'values' not in var_config or not isinstance(var_config['values'], list):
                    errors.append(f'枚举变量 {var_name} 缺少 values 参数')
            elif var_type == 'stepped':
                if not all(k in var_config for k in ['start', 'step', 'end']):
                    errors.append(f'步进变量 {var_name} 缺少 start、step 或 end 参数')
            elif var_type == 'random':
                if 'min' not in var_config or 'max' not in var_config:
                    errors.append(f'随机变量 {var_name} 缺少 min 或 max 参数')
        
        # 验证目标配置
        objectives = data.get('objectives', [])
        for obj in objectives:
            if not obj.get('variable'):
                errors.append('目标配置缺少 variable 字段')
            if obj.get('type') not in ['maximize', 'minimize', None]:
                errors.append(f'目标类型无效: {obj.get("type")}')
        
        if errors:
            raise HTTPException(status_code=400, detail={
                'valid': False,
                'errors': errors
            })
        
        return {
            'valid': True,
            'message': '配置验证通过'
        }
    except Exception as e:
        logger.error(f"验证实验配置失败: {str(e)}")
        raise HTTPException(status_code=500, detail={'error': f'验证实验配置失败: {str(e)}'})

