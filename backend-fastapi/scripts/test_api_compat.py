#!/usr/bin/env python3
"""
API 兼容性测试 — 验证 FastAPI 迁移后所有端点的路径和响应格式与 Flask 一致

用法:
    # 先启动 FastAPI 服务: python run_app.py
    # 然后运行测试:
    python scripts/test_api_compat.py [--base-url http://localhost:8080]
"""
import sys
import os
import json
import time
import argparse
import logging
import requests

logging.basicConfig(level=logging.INFO, format='%(message)s')
logger = logging.getLogger(__name__)

# ── 测试配置 ──

# 需要认证的端点用 AUTH, 不需要的用 OPEN, 需要管理员的用 ADMIN
AUTH = 'auth'
OPEN = 'open'
ADMIN = 'admin'

# (method, path, auth_level, expected_status, response_check)
# response_check: 'json' = must return JSON, 'sse' = SSE stream, 'any' = any 2xx, None = just check status
TEST_CASES = [
    # ── 健康检查 ──
    ('GET', '/api/health', OPEN, 200, 'json'),
    
    # ── 认证 ──
    ('POST', '/api/auth/login', OPEN, None, 'json'),  # needs body, will 400/422
    ('GET', '/api/auth/validate', AUTH, 200, 'json'),
    ('GET', '/api/auth/user', AUTH, 200, 'json'),
    
    # ── 系统设置 ──
    ('GET', '/api/settings', AUTH, 200, 'json'),
    ('GET', '/api/settings/prompt-templates', AUTH, 200, 'json'),
    
    # ── 智能体 ──
    ('GET', '/api/agents', AUTH, 200, None),  # may timeout due to 260K agents
    ('GET', '/api/agents/model-configs', AUTH, 200, 'json'),
    
    # ── 行动任务 ──
    ('GET', '/api/action-tasks', AUTH, 200, 'json'),
    
    # ── 规则 ──
    ('GET', '/api/rules', AUTH, 200, 'json'),
    ('GET', '/api/rules/templates', AUTH, 200, 'json'),
    ('GET', '/api/rule-sets', AUTH, 200, 'json'),
    ('GET', '/api/rule-sets/all-stats', AUTH, 200, 'json'),
    
    # ── 行动空间 ──
    ('GET', '/api/action-spaces', AUTH, 200, 'json'),
    
    # ── 能力 ──
    ('GET', '/api/capabilities', AUTH, 200, 'json'),
    ('GET', '/api/capabilities/categories', AUTH, 200, 'json'),
    ('GET', '/api/capabilities/tools', AUTH, 200, 'json'),
    ('GET', '/api/capabilities/with_roles', AUTH, 200, 'json'),
    
    # ── 工具 ──
    ('GET', '/api/tools', AUTH, 200, 'json'),
    
    # ── 模型配置 ──
    ('GET', '/api/model-configs', AUTH, 200, 'json'),
    
    # ── 角色 ──
    ('GET', '/api/roles', AUTH, 200, 'json'),
    ('GET', '/api/roles/recent', AUTH, 200, 'json'),
    
    # ── 用户 ──
    ('GET', '/api/users', ADMIN, 200, 'json'),
    ('GET', '/api/users/current', AUTH, 200, 'json'),
    ('GET', '/api/users/permissions', AUTH, 200, 'json'),
    
    # ── 许可证 ──
    ('GET', '/api/license', OPEN, 200, 'json'),
    
    # ── 知识库 ──
    ('GET', '/api/knowledges', AUTH, 200, 'json'),
    ('GET', '/api/knowledges/files', AUTH, 200, 'json'),
    
    # ── 统计 ──
    ('GET', '/api/statistics/overview', AUTH, 200, 'json'),
    
    # ── 后台任务 ──
    ('GET', '/api/jobs', AUTH, 200, 'json'),
    ('GET', '/api/jobs/stats', AUTH, 200, 'json'),
    
    # ── 技能 ──
    ('GET', '/api/skills', AUTH, 200, 'json'),
    
    # ── 市场 ──
    ('GET', '/api/market/apps', AUTH, 200, 'json'),
    ('GET', '/api/market/categories', AUTH, 200, 'json'),
    
    # ── 环境变量 ──
    ('GET', '/api/environment-variables', AUTH, 200, 'json'),
    ('GET', '/api/shared-environment-variables', AUTH, 200, 'json'),
    
    # ── 外部变量 ──
    ('GET', '/api/external-variables', AUTH, 200, 'json'),
    
    # ── 日志 ──
    ('GET', '/api/logs', AUTH, 200, 'json'),
    
    # ── 权限 ──
    ('GET', '/api/permissions', ADMIN, 200, 'json'),
    
    # ── MCP 服务器 ──
    ('GET', '/api/mcp-servers', AUTH, 200, 'json'),
    
    # ── 并行实验 ──
    ('GET', '/api/parallel-experiments', AUTH, 200, 'json'),
    
    # ── 图谱增强 ──
    ('GET', '/api/graph-enhancement/config', AUTH, 200, 'json'),
    ('GET', '/api/graph-enhancement/status', AUTH, 200, 'json'),
    
    # ── 记忆管理 ──
    ('GET', '/api/memory/overview', AUTH, 200, 'json'),
    
    # ── LightRAG ──
    ('GET', '/api/lightrag/config', AUTH, 200, 'json'),
    ('GET', '/api/lightrag/status', AUTH, 200, 'json'),
    
    # ── 图谱可视化 ──
    ('GET', '/api/graph-visualization/config', AUTH, 200, 'json'),
    
    # ── 订阅 ──
    ('GET', '/api/subscription/status', AUTH, 200, 'json'),
    
    # ── 外部知识库 ──
    ('GET', '/api/external-kb/providers', AUTH, 200, 'json'),
    
    # ── OpenAI Export ──
    ('GET', '/api/openai-export/api-keys', AUTH, 200, 'json'),
    
    # ── 发布任务 ──
    ('GET', '/api/published-tasks', AUTH, 200, 'json'),
    
    # ── IM 配置 ──
    ('GET', '/api/im-bots', AUTH, 200, 'json'),
    
    # ── 监控 ──
    ('GET', '/api/monitoring/rule-logs', AUTH, 200, 'json'),
]


def get_token(base_url, username='admin', password='admin123'):
    """尝试登录获取 JWT token"""
    try:
        resp = requests.post(f'{base_url}/api/auth/login',
                           json={'username': username, 'password': password},
                           timeout=5)
        if resp.status_code == 200:
            data = resp.json()
            return data.get('access_token') or data.get('token')
    except Exception as e:
        logger.warning(f'登录失败: {e}')
    return None


def run_test(base_url, method, path, auth_level, expected_status, response_check, headers):
    """运行单个测试"""
    url = f'{base_url}{path}'
    req_headers = {}
    
    if auth_level in (AUTH, ADMIN) and headers.get('Authorization'):
        req_headers['Authorization'] = headers['Authorization']
    
    try:
        t0 = time.time()
        resp = requests.request(method, url, headers=req_headers, timeout=30)
        elapsed = (time.time() - t0) * 1000
        
        status_ok = True
        if expected_status is not None:
            status_ok = resp.status_code == expected_status
        else:
            status_ok = resp.status_code < 500  # 非 5xx 即可
        
        json_ok = True
        if response_check == 'json' and status_ok:
            try:
                resp.json()
            except Exception:
                json_ok = False
        
        is_slow = elapsed > 5000
        
        if status_ok and json_ok:
            status_icon = '✅'
            if is_slow:
                status_icon = '🐢'
        else:
            status_icon = '❌'
        
        detail = f'HTTP {resp.status_code}'
        if not json_ok:
            detail += ' (非JSON响应!)'
        if is_slow:
            detail += f' ({elapsed:.0f}ms SLOW)'
        elif elapsed > 1000:
            detail += f' ({elapsed:.0f}ms)'
        else:
            detail += f' ({elapsed:.0f}ms)'
        
        return status_icon, detail, status_ok and json_ok
        
    except requests.Timeout:
        return '⏰', 'TIMEOUT (>30s)', False
    except requests.ConnectionError:
        return '🔌', 'CONNECTION REFUSED', False
    except Exception as e:
        return '💥', str(e)[:50], False


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--base-url', default='http://localhost:8080')
    parser.add_argument('--username', default='admin')
    parser.add_argument('--password', default='admin123')
    args = parser.parse_args()
    
    base_url = args.base_url.rstrip('/')
    
    # 检查服务是否可用
    try:
        r = requests.get(f'{base_url}/api/health', timeout=5)
        if r.status_code != 200:
            logger.error(f'服务不健康: {r.status_code}')
            sys.exit(1)
    except Exception as e:
        logger.error(f'无法连接到 {base_url}: {e}')
        logger.error('请先启动 FastAPI 服务: python run_app.py')
        sys.exit(1)
    
    # 获取 token
    token = get_token(base_url, args.username, args.password)
    headers = {}
    if token:
        headers['Authorization'] = f'Bearer {token}'
        logger.info(f'✅ 已获取认证 Token')
    else:
        logger.warning('⚠️ 无法获取 Token，需认证的测试将跳过或失败')
    
    # 运行测试
    passed = 0
    failed = 0
    skipped = 0
    slow = 0
    results = []
    
    print(f'\n{"="*70}')
    print(f'API 兼容性测试 — {base_url}')
    print(f'{"="*70}\n')
    
    for method, path, auth_level, expected_status, response_check in TEST_CASES:
        if auth_level in (AUTH, ADMIN) and not token:
            print(f'  ⏭️  {method:6s} {path:55s} SKIPPED (no token)')
            skipped += 1
            continue
        
        icon, detail, ok = run_test(base_url, method, path, auth_level, expected_status, response_check, headers)
        print(f'  {icon}  {method:6s} {path:55s} {detail}')
        
        if ok:
            passed += 1
            if '🐢' in icon or 'SLOW' in detail:
                slow += 1
        else:
            failed += 1
            results.append((method, path, detail))
    
    print(f'\n{"="*70}')
    print(f'📊 结果: {passed} 通过, {failed} 失败, {skipped} 跳过, {slow} 慢')
    print(f'{"="*70}')
    
    if results:
        print(f'\n❌ 失败详情:')
        for method, path, detail in results:
            print(f'  {method} {path}: {detail}')
    
    sys.exit(0 if failed == 0 else 1)


if __name__ == '__main__':
    main()
