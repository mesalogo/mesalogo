"""
SubAgent 安全检查模块

提供嵌套深度限制、循环调用检测、频率限制等安全机制。
"""

import time
import logging
from collections import defaultdict
from typing import Tuple, Optional, List

logger = logging.getLogger(__name__)


class SubAgentSecurity:
    """SubAgent 安全检查器"""

    MAX_NESTING_DEPTH = 3          # 最大嵌套深度
    MAX_PARALLEL_INVOCATIONS = 5   # 单次最大并行调用数
    DEFAULT_TIMEOUT = 120          # 默认超时（秒）
    MAX_TOKENS_PER_AGENT = 2048    # SubAgent 回复 token 限制
    RATE_LIMIT_PER_MINUTE = 10     # 每分钟每 Agent 最大调用次数

    # 频率限制记录: {caller_agent_id: [(timestamp, target_agent_name), ...]}
    _rate_limit_records = defaultdict(list)

    @classmethod
    def validate_invocation(
        cls,
        task_id: str,
        caller_agent_id: str,
        caller_agent_name: str,
        target_agent_name: str,
        available_agent_names: List[str],
        nesting_depth: int = 0,
        call_chain: Optional[List[str]] = None
    ) -> Tuple[bool, Optional[str]]:
        """
        验证 SubAgent 调用是否合法

        Args:
            task_id: 行动任务ID
            caller_agent_id: 调用方 Agent ID
            caller_agent_name: 调用方 Agent 名称
            target_agent_name: 目标 Agent 名称
            available_agent_names: 可调用的 Agent 名称列表
            nesting_depth: 当前嵌套深度
            call_chain: 调用链（用于循环检测），如 ["A", "B", "C"]

        Returns:
            (是否允许, 错误信息)
        """
        # 1. 嵌套深度检查
        if nesting_depth >= cls.MAX_NESTING_DEPTH:
            msg = f"SubAgent 调用嵌套深度已达上限 ({cls.MAX_NESTING_DEPTH})，不允许继续嵌套调用"
            logger.warning(f"[SubAgent安全] {msg}: caller={caller_agent_name}, target={target_agent_name}")
            return False, msg

        # 2. 目标 Agent 存在性检查
        if target_agent_name not in available_agent_names:
            msg = f"目标智能体 '{target_agent_name}' 不在当前行动任务中。可用的智能体: {', '.join(available_agent_names)}"
            logger.warning(f"[SubAgent安全] {msg}")
            return False, msg

        # 3. 自调用检查
        if target_agent_name == caller_agent_name:
            msg = f"智能体不能调用自己"
            logger.warning(f"[SubAgent安全] {msg}: {caller_agent_name}")
            return False, msg

        # 4. 循环调用检测
        if call_chain:
            if target_agent_name in call_chain:
                chain_str = " → ".join(call_chain + [target_agent_name])
                msg = f"检测到循环调用: {chain_str}"
                logger.warning(f"[SubAgent安全] {msg}")
                return False, msg

        # 5. 频率限制检查
        is_allowed, rate_msg = cls._check_rate_limit(caller_agent_id, target_agent_name)
        if not is_allowed:
            return False, rate_msg

        return True, None

    @classmethod
    def validate_parallel_invocation(
        cls,
        invocations: list,
        task_id: str,
        caller_agent_id: str,
        caller_agent_name: str,
        available_agent_names: List[str],
        nesting_depth: int = 0,
        call_chain: Optional[List[str]] = None
    ) -> Tuple[bool, Optional[str]]:
        """
        验证并行 SubAgent 调用是否合法

        Args:
            invocations: 调用列表
            其他参数同 validate_invocation

        Returns:
            (是否允许, 错误信息)
        """
        # 并行数量检查
        if len(invocations) > cls.MAX_PARALLEL_INVOCATIONS:
            msg = f"单次并行调用数量 ({len(invocations)}) 超过上限 ({cls.MAX_PARALLEL_INVOCATIONS})"
            return False, msg

        if len(invocations) == 0:
            return False, "调用列表为空"

        # 检查是否有重复的目标
        target_names = [inv.get('target_agent_name', '') for inv in invocations]
        duplicates = set([name for name in target_names if target_names.count(name) > 1])
        if duplicates:
            msg = f"并行调用中存在重复目标: {', '.join(duplicates)}"
            return False, msg

        # 逐个验证
        for inv in invocations:
            target_name = inv.get('target_agent_name', '')
            is_valid, error = cls.validate_invocation(
                task_id=task_id,
                caller_agent_id=caller_agent_id,
                caller_agent_name=caller_agent_name,
                target_agent_name=target_name,
                available_agent_names=available_agent_names,
                nesting_depth=nesting_depth,
                call_chain=call_chain
            )
            if not is_valid:
                return False, f"调用 {target_name} 失败: {error}"

        return True, None

    @classmethod
    def _check_rate_limit(cls, caller_agent_id: str, target_agent_name: str) -> Tuple[bool, Optional[str]]:
        """
        频率限制检查

        Returns:
            (是否允许, 错误信息)
        """
        now = time.time()
        one_minute_ago = now - 60

        # 清理过期记录
        cls._rate_limit_records[caller_agent_id] = [
            (ts, name) for ts, name in cls._rate_limit_records[caller_agent_id]
            if ts > one_minute_ago
        ]

        # 检查频率
        recent_calls = len(cls._rate_limit_records[caller_agent_id])
        if recent_calls >= cls.RATE_LIMIT_PER_MINUTE:
            msg = f"调用频率超限: 最近1分钟内已调用 {recent_calls} 次 (上限 {cls.RATE_LIMIT_PER_MINUTE} 次)"
            logger.warning(f"[SubAgent安全] {msg}: caller_id={caller_agent_id}")
            return False, msg

        # 记录本次调用
        cls._rate_limit_records[caller_agent_id].append((now, target_agent_name))

        return True, None
