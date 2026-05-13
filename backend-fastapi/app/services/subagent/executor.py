"""
SubAgent 执行引擎

在调用方 Agent 的工具调用中，创建独立的 LLM 请求，
使用目标 Agent 的 system_prompt、角色和知识，
执行给定的任务并返回结果。

核心特点：
- SubAgent 使用独立上下文（不共享调用方的会话历史）
- SubAgent 使用目标 Agent 配置的模型
- 结果作为工具调用结果返回给调用方
- 支持并行调用多个 SubAgent（asyncio.gather）
"""

import asyncio
import time
import logging
import traceback
from typing import Dict, Any, Optional, List

from app.models import (
    db, Agent, Role, ActionTask, ActionTaskAgent,
    Conversation, Message, ModelConfig
)
from app.services.subagent.context_builder import SubAgentContextBuilder
from app.services.subagent.security import SubAgentSecurity

logger = logging.getLogger(__name__)


class SubAgentExecutor:
    """SubAgent 执行引擎"""

    @staticmethod
    def get_available_agents(task_id: str, exclude_agent_id: str = None) -> List[Dict[str, Any]]:
        """
        获取当前行动任务中可调用的 Agent 列表

        Args:
            task_id: 行动任务ID
            exclude_agent_id: 排除的 Agent ID（通常是调用方自己）

        Returns:
            Agent 信息列表
        """
        task_agents = ActionTaskAgent.query.filter_by(action_task_id=task_id).all()
        agents_info = []

        for ta in task_agents:
            agent = Agent.query.get(ta.agent_id)
            if not agent:
                continue
            if exclude_agent_id and str(agent.id) == str(exclude_agent_id):
                continue
            # 排除监督者
            if hasattr(agent, 'is_observer') and agent.is_observer:
                continue

            role = agent.role if hasattr(agent, 'role') and agent.role else None
            role_name = role.name if role else "未定义角色"
            role_description = role.system_prompt[:200] if role and role.system_prompt else "无描述"

            agents_info.append({
                "name": agent.name,
                "id": agent.id,
                "role_name": role_name,
                "description": role_description
            })

        return agents_info

    @staticmethod
    def invoke_single(
        task_id: str,
        caller_agent_id: str,
        target_agent_name: str,
        task_description: str,
        context: str = None,
        conversation_id: str = None,
        nesting_depth: int = 0,
        max_tokens: int = 2048,
        call_chain: List[str] = None
    ) -> Dict[str, Any]:
        """
        同步调用单个 SubAgent

        Returns:
            {
                "agent_name": str,
                "agent_role": str,
                "response": str,
                "status": "success" | "error",
                "token_usage": { "prompt": int, "completion": int },
                "elapsed_seconds": float
            }
        """
        start_time = time.time()

        try:
            # 获取行动任务
            action_task = ActionTask.query.get(task_id)
            if not action_task:
                return {
                    "agent_name": target_agent_name,
                    "agent_role": "",
                    "response": f"错误: 找不到行动任务 ID={task_id}",
                    "status": "error",
                    "elapsed_seconds": time.time() - start_time
                }

            # 获取调用方 Agent 信息
            caller_agent = Agent.query.get(caller_agent_id)
            if not caller_agent:
                return {
                    "agent_name": target_agent_name,
                    "agent_role": "",
                    "response": f"错误: 找不到调用方智能体 ID={caller_agent_id}",
                    "status": "error",
                    "elapsed_seconds": time.time() - start_time
                }

            caller_role = caller_agent.role if hasattr(caller_agent, 'role') else None
            caller_role_name = caller_role.name if caller_role else "未知角色"

            # 获取可用 Agent 列表
            available_agents = SubAgentExecutor.get_available_agents(task_id)
            available_names = [a["name"] for a in available_agents]

            # 安全验证
            current_chain = call_chain or [caller_agent.name]
            is_valid, error = SubAgentSecurity.validate_invocation(
                task_id=task_id,
                caller_agent_id=str(caller_agent_id),
                caller_agent_name=caller_agent.name,
                target_agent_name=target_agent_name,
                available_agent_names=available_names,
                nesting_depth=nesting_depth,
                call_chain=current_chain
            )

            if not is_valid:
                return {
                    "agent_name": target_agent_name,
                    "agent_role": "",
                    "response": f"调用被拒绝: {error}",
                    "status": "error",
                    "elapsed_seconds": time.time() - start_time
                }

            # 查找目标 Agent
            target_agent = SubAgentExecutor._find_agent_by_name(task_id, target_agent_name)
            if not target_agent:
                return {
                    "agent_name": target_agent_name,
                    "agent_role": "",
                    "response": f"错误: 找不到智能体 '{target_agent_name}'",
                    "status": "error",
                    "elapsed_seconds": time.time() - start_time
                }

            target_role = target_agent.role if hasattr(target_agent, 'role') else None
            target_role_name = target_role.name if target_role else "未知角色"

            # 构建 SubAgent 上下文
            messages = SubAgentContextBuilder.build_subagent_messages(
                target_agent=target_agent,
                target_role=target_role,
                action_task=action_task,
                caller_agent_name=caller_agent.name,
                caller_role_name=caller_role_name,
                task_description=task_description,
                context=context,
                max_tokens=max_tokens
            )

            # 获取目标 Agent 的模型配置
            model_config = SubAgentExecutor._get_agent_model_config(target_agent, target_role)
            if not model_config:
                return {
                    "agent_name": target_agent_name,
                    "agent_role": target_role_name,
                    "response": f"错误: 智能体 '{target_agent_name}' 没有可用的模型配置",
                    "status": "error",
                    "elapsed_seconds": time.time() - start_time
                }

            # 调用 LLM
            logger.info(f"[SubAgent] 开始调用: {caller_agent.name} → {target_agent_name} (深度={nesting_depth})")
            response_text = SubAgentExecutor._call_llm(
                messages=messages,
                model_config=model_config,
                max_tokens=max_tokens,
                timeout=SubAgentSecurity.DEFAULT_TIMEOUT
            )

            elapsed = time.time() - start_time
            logger.info(f"[SubAgent] 调用完成: {target_agent_name}, 耗时={elapsed:.1f}s")

            result = {
                "agent_name": target_agent_name,
                "agent_role": target_role_name,
                "response": response_text,
                "status": "success",
                "elapsed_seconds": round(elapsed, 1)
            }

            # 消息记录（内联模式）：在主会话中记录一条系统消息
            SubAgentExecutor._record_invocation(
                conversation_id=conversation_id,
                task_id=task_id,
                caller_agent_id=caller_agent_id,
                caller_agent_name=caller_agent.name,
                target_agent_name=target_agent_name,
                target_agent_id=str(target_agent.id),
                task_description=task_description,
                result=result,
                nesting_depth=nesting_depth
            )

            return result

        except Exception as e:
            elapsed = time.time() - start_time
            error_msg = f"SubAgent 调用异常: {str(e)}"
            logger.error(f"[SubAgent] {error_msg}\n{traceback.format_exc()}")
            return {
                "agent_name": target_agent_name,
                "agent_role": "",
                "response": error_msg,
                "status": "error",
                "elapsed_seconds": round(elapsed, 1)
            }

    @staticmethod
    def invoke_parallel(
        task_id: str,
        caller_agent_id: str,
        invocations: List[Dict],
        conversation_id: str = None,
        nesting_depth: int = 0,
        max_tokens_per_agent: int = 2048,
        call_chain: List[str] = None
    ) -> Dict[str, Any]:
        """
        并行调用多个 SubAgent

        Args:
            invocations: [{"target_agent_name": str, "task_description": str, "context": str}, ...]

        Returns:
            {
                "results": [...],
                "total_elapsed_seconds": float
            }
        """
        start_time = time.time()

        try:
            # 获取调用方信息做安全验证
            caller_agent = Agent.query.get(caller_agent_id)
            if not caller_agent:
                return {
                    "results": [],
                    "total_elapsed_seconds": 0,
                    "error": f"找不到调用方智能体 ID={caller_agent_id}"
                }

            available_agents = SubAgentExecutor.get_available_agents(task_id)
            available_names = [a["name"] for a in available_agents]
            current_chain = call_chain or [caller_agent.name]

            # 并行验证
            is_valid, error = SubAgentSecurity.validate_parallel_invocation(
                invocations=invocations,
                task_id=task_id,
                caller_agent_id=str(caller_agent_id),
                caller_agent_name=caller_agent.name,
                available_agent_names=available_names,
                nesting_depth=nesting_depth,
                call_chain=current_chain
            )

            if not is_valid:
                return {
                    "results": [],
                    "total_elapsed_seconds": time.time() - start_time,
                    "error": f"并行调用验证失败: {error}"
                }

            # 并行调用——使用线程池
            from concurrent.futures import ThreadPoolExecutor, as_completed

            def _invoke_with_context(inv):
                """在独立线程中执行 SubAgent 调用"""
                return SubAgentExecutor.invoke_single(
                    task_id=task_id,
                    caller_agent_id=caller_agent_id,
                    target_agent_name=inv['target_agent_name'],
                    task_description=inv['task_description'],
                    context=inv.get('context'),
                    conversation_id=conversation_id,
                    nesting_depth=nesting_depth,
                    max_tokens=max_tokens_per_agent,
                    call_chain=current_chain
                )

            results = []
            with ThreadPoolExecutor(max_workers=min(len(invocations), SubAgentSecurity.MAX_PARALLEL_INVOCATIONS)) as pool:
                futures = {}
                for inv in invocations:
                    future = pool.submit(_invoke_with_context, inv)
                    futures[future] = inv['target_agent_name']

                for future in as_completed(futures):
                    target_name = futures[future]
                    try:
                        result = future.result(timeout=SubAgentSecurity.DEFAULT_TIMEOUT)
                        results.append(result)
                    except Exception as e:
                        results.append({
                            "agent_name": target_name,
                            "agent_role": "",
                            "response": f"执行超时或异常: {str(e)}",
                            "status": "error",
                            "elapsed_seconds": SubAgentSecurity.DEFAULT_TIMEOUT
                        })

            total_elapsed = time.time() - start_time
            logger.info(f"[SubAgent] 并行调用完成: {len(results)} 个 Agent, 总耗时={total_elapsed:.1f}s")

            return {
                "results": results,
                "total_elapsed_seconds": round(total_elapsed, 1)
            }

        except Exception as e:
            elapsed = time.time() - start_time
            logger.error(f"[SubAgent] 并行调用异常: {str(e)}\n{traceback.format_exc()}")
            return {
                "results": [],
                "total_elapsed_seconds": round(elapsed, 1),
                "error": str(e)
            }

    @staticmethod
    def _record_invocation(
        conversation_id: str,
        task_id: str,
        caller_agent_id: str,
        caller_agent_name: str,
        target_agent_name: str,
        target_agent_id: str,
        task_description: str,
        result: Dict[str, Any],
        nesting_depth: int = 0
    ):
        """
        在主会话中记录 SubAgent 调用（内联模式）

        写入一条 role='system' 的消息，meta 中包含完整的调用信息，
        刷新页面后用户仍能看到 SubAgent 的调用历史。
        """
        if not conversation_id:
            return

        try:
            content = (
                f"[SubAgent] {caller_agent_name} 调用了 {target_agent_name}: "
                f"{task_description[:100]}{'...' if len(task_description) > 100 else ''}"
            )

            msg = Message(
                conversation_id=conversation_id,
                action_task_id=task_id,
                role='system',
                content=content,
                agent_id=caller_agent_id,
                meta={
                    "type": "subagent_invocation",
                    "caller_agent_id": caller_agent_id,
                    "caller_agent_name": caller_agent_name,
                    "target_agent_id": target_agent_id,
                    "target_agent_name": target_agent_name,
                    "task_description": task_description,
                    "response_summary": result.get("response", "")[:500],
                    "full_response": result.get("response", ""),
                    "status": result.get("status", "unknown"),
                    "elapsed_seconds": result.get("elapsed_seconds", 0),
                    "nesting_depth": nesting_depth
                }
            )
            db.session.add(msg)
            db.session.commit()
            logger.debug(f"[SubAgent] 已记录调用消息: {caller_agent_name} → {target_agent_name}, msg_id={msg.id}")

        except Exception as e:
            logger.warning(f"[SubAgent] 记录调用消息失败: {str(e)}")
            try:
                db.session.rollback()
            except Exception:
                pass

    @staticmethod
    def _find_agent_by_name(task_id: str, agent_name: str) -> Optional[Agent]:
        """通过名称查找行动任务中的 Agent"""
        task_agents = ActionTaskAgent.query.filter_by(action_task_id=task_id).all()
        for ta in task_agents:
            agent = Agent.query.get(ta.agent_id)
            if agent and agent.name == agent_name:
                return agent
        return None

    @staticmethod
    def _get_agent_model_config(agent: Agent, role: Role) -> Optional[Dict[str, Any]]:
        """
        获取 Agent 的模型配置

        优先级：Role 绑定的模型 > 默认模型
        与 message_processor.py 中的查找逻辑保持一致

        Returns:
            {"api_url": str, "api_key": str, "model_id": str, "params": dict} 或 None
        """
        try:
            role_model = None

            # 从角色的 model 字段查找（role.model 是 ModelConfig 的 ID）
            if role and hasattr(role, 'model') and role.model:
                role_model = ModelConfig.query.get(role.model)

            # fallback: 默认文本生成模型（与 message_processor.py 保持一致）
            if not role_model:
                role_model = ModelConfig.query.filter_by(is_default_text=True).first()

            # fallback: 任何支持文本输出的模型
            if not role_model:
                text_models = ModelConfig.query.filter(
                    ModelConfig.modalities.contains('text_output')
                ).all()
                if text_models:
                    role_model = text_models[0]

            # fallback: is_default 标记的模型
            if not role_model:
                role_model = ModelConfig.query.filter_by(is_default=True).first()

            if not role_model:
                logger.warning(f"[SubAgent] 找不到模型配置: agent={agent.name}")
                return None

            # 获取模型参数（从角色读取温度等参数）
            params = {}
            if role:
                if hasattr(role, 'temperature') and role.temperature is not None:
                    params['temperature'] = role.temperature
                if hasattr(role, 'max_output_tokens') and role.max_output_tokens is not None:
                    params['max_tokens'] = role.max_output_tokens

            return {
                "api_url": role_model.base_url,
                "api_key": role_model.api_key,
                "model_id": role_model.model_id,
                "params": params,
                "model_obj": role_model
            }

        except Exception as e:
            logger.error(f"[SubAgent] 获取模型配置失败: {str(e)}")
            return None

    @staticmethod
    def _call_llm(
        messages: List[Dict],
        model_config: Dict[str, Any],
        max_tokens: int = 2048,
        timeout: int = 120
    ) -> str:
        """
        调用 LLM 获取 SubAgent 回复

        SubAgent 调用不走 SSE 流式输出，直接获取完整回复。

        Returns:
            回复文本
        """
        try:
            from app.services.conversation.model_client import ModelClient

            model_client = ModelClient()

            # SubAgent 使用同步非流式调用，直接获取完整响应
            # 注意：不能用 is_stream=True，因为异步流依赖 connection_manager
            # 注册（需要 task_id/conversation_id/agent_id），SubAgent 在
            # ThreadPoolExecutor 中运行时没有这些上下文，会被判断为"取消"
            api_response = model_client.send_request(
                api_url=model_config["api_url"],
                api_key=model_config["api_key"],
                messages=messages,
                model=model_config["model_id"],
                is_stream=False,
                agent_info={},
                max_tokens=max_tokens,
                **model_config.get("params", {})
            )

            if api_response and not api_response.startswith('Error:'):
                return api_response
            elif api_response and api_response.startswith('Error:'):
                return f"LLM 调用失败: {api_response}"
            else:
                return "SubAgent 未返回任何内容"

        except Exception as e:
            error_msg = f"LLM 调用异常: {str(e)}"
            logger.error(f"[SubAgent] {error_msg}\n{traceback.format_exc()}")
            return error_msg
