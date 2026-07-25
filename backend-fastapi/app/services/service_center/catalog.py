"""Allowlisted logical services shown by the Service Center."""

from .models import ServiceCapabilities, ServiceDefinition


def _capabilities(*, config_route: str | None, view_logs: bool = False) -> ServiceCapabilities:
    return ServiceCapabilities(configure=bool(config_route), view_logs=view_logs)


SERVICE_CATALOG: tuple[ServiceDefinition, ...] = (
    ServiceDefinition(
        id="backend",
        category="core",
        deployment="embedded",
        required=True,
        dependencies=("database",),
        components=("abm-backend",),
        capabilities=_capabilities(config_route=None, view_logs=True),
    ),
    ServiceDefinition(
        id="frontend",
        category="core",
        deployment="docker-compose",
        required=True,
        dependencies=("backend",),
        components=("abm-frontend",),
        capabilities=_capabilities(config_route=None),
    ),
    ServiceDefinition(
        id="database",
        category="infrastructure",
        deployment="docker-compose",
        required=True,
        components=("abm-mariadb",),
        capabilities=_capabilities(config_route=None),
    ),
    ServiceDefinition(
        id="redis",
        category="infrastructure",
        deployment="docker-compose",
        components=("abm-redis",),
        capabilities=_capabilities(config_route=None),
    ),
    ServiceDefinition(
        id="milvus",
        category="data",
        deployment="docker-compose",
        components=("milvus-etcd", "milvus-minio", "milvus-standalone", "milvus-attu"),
        config_route="/settings/general",
        capabilities=_capabilities(config_route="/settings/general"),
    ),
    ServiceDefinition(
        id="graphiti",
        category="knowledge",
        deployment="docker-compose",
        components=("neo4j", "graphiti"),
        config_route="/settings/graph-enhancement",
        capabilities=_capabilities(config_route="/settings/graph-enhancement"),
    ),
    ServiceDefinition(
        id="lightrag",
        category="knowledge",
        deployment="docker-compose",
        components=("lightrag",),
        config_route="/settings/graph-enhancement",
        capabilities=_capabilities(config_route="/settings/graph-enhancement"),
    ),
    ServiceDefinition(
        id="onlyoffice",
        category="capability",
        deployment="docker-compose",
        components=("onlyoffice-postgresql", "onlyoffice-rabbitmq", "onlyoffice-documentserver"),
        config_route="/action-spaces/market",
        capabilities=_capabilities(config_route="/action-spaces/market"),
    ),
    ServiceDefinition(
        id="galapagos",
        category="capability",
        deployment="docker-compose",
        components=("galapagos",),
        config_route="/action-spaces/market",
        capabilities=_capabilities(config_route="/action-spaces/market"),
    ),
    ServiceDefinition(
        id="paddleocr-vl",
        category="capability",
        deployment="docker-compose",
        components=("paddle-ocr-vl",),
        config_route="/settings/general",
        capabilities=_capabilities(config_route="/settings/general"),
    ),
    ServiceDefinition(
        id="code-server",
        category="capability",
        deployment="docker-compose",
        components=("code-server",),
        config_route="/action-spaces/market",
        capabilities=_capabilities(config_route="/action-spaces/market"),
    ),
)
