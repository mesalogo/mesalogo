"""
Auto-converted from Flask Blueprint → FastAPI APIRouter
Source files: api_docs.py
"""
import logging
from typing import Optional
from fastapi import APIRouter, HTTPException, Query, Request, Depends
from fastapi.responses import JSONResponse, StreamingResponse, HTMLResponse
from core.config import settings
from core.dependencies import get_current_user, get_admin_user

logger = logging.getLogger(__name__)

router = APIRouter()

# ============================================================
# Source: api_docs.py
# ============================================================

"""
自动 API 文档路由

扫描 Flask app.url_map 自动生成所有 API 路由的文档页面，零侵入。
访问 /api/docs 查看 HTML 页面，/api/docs/json 获取 JSON 格式。
"""
from collections import defaultdict


IGNORED_METHODS = {'OPTIONS', 'HEAD'}
IGNORED_PREFIXES = ('/static', '/flasgger_static')


def _collect_routes(request: Request):
    """从 FastAPI app 收集所有路由，按前缀分组"""
    groups = defaultdict(list)
    app = request.app
    for route in app.routes:
        if not hasattr(route, 'methods') or not hasattr(route, 'path'):
            continue
        path = route.path
        methods = sorted(route.methods - {'OPTIONS', 'HEAD'})
        if not methods:
            continue
        if any(path.startswith(p) for p in IGNORED_PREFIXES):
            continue

        # Extract docstring
        doc = ''
        if hasattr(route, 'endpoint'):
            func = route.endpoint if callable(route.endpoint) else None
            if func:
                doc = (func.__doc__ or '').strip().split('\n')[0]

        # Group by second path segment
        parts = [p for p in path.split('/') if p and not p.startswith('{')]
        if len(parts) >= 2 and parts[0] == 'api':
            group = parts[1]
        elif parts:
            group = parts[0]
        else:
            group = 'root'

        groups[group].append({
            'path': path,
            'methods': methods,
            'endpoint': route.name or '',
            'doc': doc,
        })
    return dict(groups)


@router.get('/docs/json')
def api_docs_json(request: Request):
    """以 JSON 格式返回所有路由"""
    return _collect_routes(request)


@router.get('/docs')
def api_docs_html(request: Request):
    """自动生成的 API 文档页面"""
    groups = _collect_routes(request)
    total = sum(len(routes) for routes in groups.values())

    method_colors = {
        'GET': '#61affe',
        'POST': '#49cc90',
        'PUT': '#fca130',
        'DELETE': '#f93e3e',
        'PATCH': '#50e3c2',
    }

    rows = []
    for group in sorted(groups.keys()):
        routes = groups[group]
        rows.append(f'<tr class="group-header"><td colspan="4">{group} ({len(routes)})</td></tr>')
        for r in routes:
            method_badges = ' '.join(
                f'<span class="method" style="background:{method_colors.get(m, "#999")}">{m}</span>'
                for m in r['methods']
            )
            # GET 且无参数占位符的路径可点击
            has_param = '<' in r['path']
            is_get = 'GET' in r['methods']
            if is_get and not has_param:
                path_cell = f'<a href="{r["path"]}" target="_blank" class="path">{r["path"]}</a>'
            else:
                path_cell = f'<span class="path">{r["path"]}</span>'
            rows.append(
                f'<tr>'
                f'<td>{method_badges}</td>'
                f'<td>{path_cell}</td>'
                f'<td class="doc">{r["doc"]}</td>'
                f'<td class="endpoint">{r["endpoint"]}</td>'
                f'</tr>'
            )

    html = f"""<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="utf-8">
<title>ABM-LLM API Docs</title>
<style>
  * {{ margin:0; padding:0; box-sizing:border-box; }}
  body {{ font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace; background:#1a1a2e; color:#e0e0e0; padding:24px; }}
  h1 {{ color:#61affe; margin-bottom:4px; }}
  .meta {{ color:#888; margin-bottom:16px; font-size:14px; }}
  .filter {{ margin-bottom:16px; }}
  .filter input {{ padding:8px 12px; width:400px; border-radius:4px; border:1px solid #444; background:#16213e; color:#e0e0e0; font-size:14px; }}
  table {{ width:100%; border-collapse:collapse; }}
  th {{ text-align:left; padding:8px 12px; background:#16213e; color:#61affe; border-bottom:2px solid #333; font-size:13px; }}
  td {{ padding:6px 12px; border-bottom:1px solid #2a2a4a; font-size:13px; vertical-align:top; }}
  tr:hover {{ background:#16213e; }}
  .group-header td {{ background:#0f3460; color:#e94560; font-weight:bold; font-size:14px; padding:10px 12px; }}
  .method {{ display:inline-block; padding:2px 8px; border-radius:3px; color:#fff; font-size:11px; font-weight:bold; margin-right:4px; min-width:52px; text-align:center; }}
  .path {{ font-family:monospace; color:#fca130; }}
  a.path {{ font-family:monospace; color:#fca130; text-decoration:none; }}
  a.path:hover {{ text-decoration:underline; color:#ffd580; }}
  .doc {{ color:#aaa; max-width:400px; }}
  .endpoint {{ color:#666; font-size:12px; }}
  .hidden {{ display:none; }}
</style>
</head>
<body>
<h1>ABM-LLM API Documentation</h1>
<p class="meta">{total} endpoints in {len(groups)} groups &mdash; auto-generated from url_map</p>
<div class="filter"><input id="search" placeholder="Filter by path, method, or description..." autofocus></div>
<table>
<thead><tr><th>Method</th><th>Path</th><th>Description</th><th>Endpoint</th></tr></thead>
<tbody>
{''.join(rows)}
</tbody>
</table>
<script>
document.getElementById('search').addEventListener('input', function() {{
  const q = this.value.toLowerCase();
  document.querySelectorAll('tbody tr').forEach(tr => {{
    if (tr.classList.contains('group-header')) {{ tr.classList.remove('hidden'); return; }}
    const text = tr.textContent.toLowerCase();
    tr.classList.toggle('hidden', q && !text.includes(q));
  }});
  // 隐藏空分组
  let rows = [...document.querySelectorAll('tbody tr')];
  for (let i = 0; i < rows.length; i++) {{
    if (rows[i].classList.contains('group-header')) {{
      let hasVisible = false;
      for (let j = i + 1; j < rows.length && !rows[j].classList.contains('group-header'); j++) {{
        if (!rows[j].classList.contains('hidden')) {{ hasVisible = true; break; }}
      }}
      rows[i].classList.toggle('hidden', !hasVisible);
    }}
  }}
}});
</script>
</body>
</html>"""
    return HTMLResponse(content=html)

