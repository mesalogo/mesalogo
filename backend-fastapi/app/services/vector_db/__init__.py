"""TiDB vector database service package (TiDB 向量数据库服务包).

This ``__init__.py`` is intentionally near-empty. It must not perform any
work at import time:

  * No top-level ``from .tidb_vector_service import …`` — that file pulls in
    sentence_transformers → torch → CUDA → pynvml just to mount the
    ``vector_database`` HTTP route, which auto-loads on every cold boot.
  * No top-level dependency probe / health check — fail-loud at the call
    site instead (see AGENTS.md §4 "no silent fallbacks").
  * No legacy compatibility re-exports — call sites import the concrete
    submodule they need (see AGENTS.md §3.2 "no legacy-API back-compat
    shims"). Concretely: do not import ``vector_db.tidb_vector_service``
    or ``vector_db.initialize_vector_db`` from the package root; import
    ``app.services.vector_db.tidb_vector_service`` etc. directly.

Import the matching submodule for what you need:

    from app.services.vector_db.tidb_config import tidb_config_manager
    from app.services.vector_db.tidb_vector_service import tidb_vector_service
    from app.services.vector_db.embedding_service import embedding_service
    from app.services.vector_db.models import VectorDistanceMetric, VectorDataType
"""
