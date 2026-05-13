"""
智能体 API 路由

Flask → FastAPI 变更:
- request.args.get() → Query()
- request.get_json() → Body / Pydantic model
- jsonify(data), 500 → HTTPException
"""
import logging
from typing import Optional
from fastapi import APIRouter, HTTPException, Query
from fastapi.requests import Request
from sqlalchemy.orm import joinedload
from app.models import Agent, Message, db
from app.services.agent_service import AgentService

logger = logging.getLogger(__name__)

router = APIRouter()

# 创建服务实例
agent_service = AgentService()


@router.get('')
def get_agents(
    request: Request,
    status: Optional[str] = Query(None),
    simplified: str = Query('true'),
):
    """获取所有智能体列表
    
    Query params:
        - status: 过滤状态
        - simplified: 是否简化返回（默认 true）
        - include_experiment_clones: 是否包含实验克隆智能体（默认 false）
        - page: 页码（不传则返回全部）
        - limit: 每页数量（默认 50）
    """
    is_simplified = simplified.lower() == 'true'
    include_experiment_clones = request.query_params.get('include_experiment_clones', 'false').lower() == 'true'
    page_str = request.query_params.get('page')
    limit_str = request.query_params.get('limit')

    try:
        from app.models import ActionTask

        query = Agent.query.options(
            joinedload(Agent.role),
            joinedload(Agent.action_task)
        )

        if status:
            query = query.filter(Agent.status == status.lower())

        # 过滤实验克隆智能体（默认排除，将 275,742 → ~56 条）
        if not include_experiment_clones:
            query = query.outerjoin(ActionTask, Agent.action_task_id == ActionTask.id).filter(
                (ActionTask.is_experiment_clone == False) |
                (ActionTask.is_experiment_clone == None) |
                (Agent.action_task_id == None)
            )

        # 分页
        if page_str:
            page = int(page_str)
            limit = int(limit_str) if limit_str else 50
            total = query.count()
            agents = query.offset((page - 1) * limit).limit(limit).all()
        else:
            agents = query.all()
            total = len(agents)

        if is_simplified:
            result = [agent_service.format_agent_for_list(agent) for agent in agents]
        else:
            result = [agent_service.format_agent_for_api(agent) for agent in agents]

        if page_str:
            page = int(page_str)
            limit = int(limit_str) if limit_str else 50
            return {
                'agents': result,
                'total': total,
                'page': page,
                'limit': limit,
                'total_pages': (total + limit - 1) // limit
            }
        return result
    except Exception as e:
        logger.error(f"Error in get_agents: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get('/model-configs')
def get_agent_model_configs():
    """获取智能体可用的模型配置"""
    configs = agent_service.get_all_model_configs()
    return {'model_configs': configs}


@router.get('/{agent_id}')
def get_agent(agent_id: str):
    """获取特定智能体详情"""
    agent = agent_service.get_agent_by_id(agent_id)
    if agent:
        return agent
    raise HTTPException(status_code=404, detail='Agent not found')


@router.post('', status_code=201)
async def create_agent(request: Request):
    """创建新智能体"""
    data = await request.json()
    agent = agent_service.create_agent(data)
    return agent


@router.put('/{agent_id}')
async def update_agent(agent_id: str, request: Request):
    """更新智能体信息"""
    data = await request.json()
    agent = agent_service.update_agent(agent_id, data)
    if agent:
        try:
            from core.model_cache import invalidate_agent
            invalidate_agent(agent_id)
        except Exception:
            pass
        return agent
    raise HTTPException(status_code=404, detail='Agent not found')


@router.delete('/{agent_id}')
def delete_agent(agent_id: str):
    """删除智能体"""
    success = agent_service.delete_agent(agent_id)
    if success:
        try:
            from core.model_cache import invalidate_agent
            invalidate_agent(agent_id)
        except Exception:
            pass
        return {'success': True}
    raise HTTPException(status_code=404, detail='Agent not found or cannot be deleted')


@router.get('/{agent_id}/memories')
def get_agent_memories(agent_id: str):
    """获取智能体的记忆数据
    
    根据图谱增强配置和分区策略，从图谱记忆系统中获取该智能体相关的记忆。
    如果图谱增强未启用，返回空列表。
    """
    agent = Agent.query.get(agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail='Agent not found')

    try:
        from app.models import GraphEnhancement, ActionTask
        from app.services.memory_partition_service import memory_partition_service

        # 检查图谱增强是否启用
        config = GraphEnhancement.query.filter_by(framework='graphiti').first()
        if not config or not config.enabled:
            return []

        # 获取分区配置
        partition_config = memory_partition_service.get_partition_config()
        strategy = partition_config.get('partition_strategy', 'by_space')

        # 构建上下文信息
        context = {
            'agent_id': agent.id,
            'role_id': agent.role_id or 'default',
            'action_task_id': agent.action_task_id or 'default',
            'action_space_id': 'default',
        }

        # 获取行动空间ID（通过行动任务）
        if agent.action_task_id:
            action_task = ActionTask.query.get(agent.action_task_id)
            if action_task and action_task.action_space_id:
                context['action_space_id'] = action_task.action_space_id

        # 生成分区标识符
        group_id = memory_partition_service.generate_partition_identifier(strategy, context)

        # 从图谱服务获取记忆数据
        framework_config = config.framework_config or {}
        service_url = framework_config.get('service_url', '') or framework_config.get('server_url', '')

        if not service_url:
            return []

        # 通过搜索接口获取该分区的记忆
        import requests as http_requests
        try:
            search_payload = {
                "query": "*",
                "max_facts": 50,
                "group_ids": [group_id],
            }
            response = http_requests.post(
                f"{service_url.rstrip('/')}/search",
                json=search_payload,
                timeout=10
            )

            if response.status_code == 200:
                result = response.json()
                facts = result.get('facts', [])

                # 将图谱数据格式化为前端期望的记忆格式
                memories = []
                for fact in facts:
                    memories.append({
                        'type': 'knowledge',
                        'content': fact.get('fact', fact.get('content', str(fact))),
                        'created_at': fact.get('created_at', fact.get('valid_at', None)),
                    })
                return memories
            else:
                logger.warning(f"从图谱服务获取记忆失败: HTTP {response.status_code}")
                return []

        except http_requests.exceptions.RequestException as e:
            logger.warning(f"连接图谱服务失败: {e}")
            return []

    except Exception as e:
        logger.error(f"获取智能体记忆失败: {e}")
        return []


@router.get('/{agent_id}/messages')
def get_agent_messages(
    agent_id: str,
    page: int = Query(1),
    per_page: int = Query(20),
):
    """获取智能体参与的消息记录"""
    from app.services.message_service import MessageService

    agent = Agent.query.get(agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail='Agent not found')

    try:
        query = Message.query.filter(
            Message.agent_id == agent_id
        ).order_by(Message.created_at.desc())

        total = query.count()
        messages = query.offset((page - 1) * per_page).limit(per_page).all()

        result = []
        for msg in messages:
            formatted = MessageService.format_message_for_api(msg)
            formatted['action_task_id'] = msg.action_task_id
            formatted['conversation_id'] = msg.conversation_id
            result.append(formatted)

        return {
            'success': True,
            'data': {
                'messages': result,
                'total': total,
                'page': page,
                'per_page': per_page
            }
        }
    except Exception as e:
        logger.error(f"获取智能体消息失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))
