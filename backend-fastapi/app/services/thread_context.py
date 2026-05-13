"""
线程本地上下文 — 替代 Flask 的 g 对象

在 Flask 中，g 是请求范围的全局存储。
在 FastAPI + 线程池 中，用 threading.local() 实现相同功能。

用法:
    from app.services.thread_context import g
    g.conversation_context = {...}   # 设置
    ctx = g.conversation_context     # 读取
"""
import threading


class _ThreadLocal(threading.local):
    """带默认值的线程本地存储，模拟 Flask g 的 getattr 行为"""

    def __getattr__(self, name):
        # 未设置的属性返回 None 而不是抛 AttributeError
        # 这和 Flask g 的 hasattr(g, 'xxx') 检查兼容
        return None


g = _ThreadLocal()
