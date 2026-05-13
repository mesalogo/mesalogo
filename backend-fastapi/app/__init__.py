"""
ABM-LLM App 包

在 FastAPI 版本中，应用启动入口已移至 main.py。
此文件保留 `db` 导出，兼容 services 层中大量的 `from app import db`。
"""
from app.extensions import db
