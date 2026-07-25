from app.services.service_center.catalog import SERVICE_CATALOG
from app.services.service_center.docker_control import CONTROL_POLICIES


def test_service_catalog_has_stable_unique_logical_ids_and_routes():
    expected = {
        "backend": None,
        "frontend": None,
        "database": None,
        "redis": None,
        "milvus": "/settings/general",
        "graphiti": "/settings/graph-enhancement",
        "lightrag": "/settings/graph-enhancement",
        "onlyoffice": "/action-spaces/market",
        "galapagos": "/action-spaces/market",
        "paddleocr-vl": "/settings/general",
        "code-server": "/action-spaces/market",
    }

    assert {item.id: item.config_route for item in SERVICE_CATALOG} == expected
    assert len(SERVICE_CATALOG) == 11
    assert len({item.id for item in SERVICE_CATALOG}) == len(SERVICE_CATALOG)
    assert all(item.capabilities.configure == bool(item.config_route) for item in SERVICE_CATALOG)

    service_ids = {item.id for item in SERVICE_CATALOG}
    assert all(set(item.dependencies) <= service_ids for item in SERVICE_CATALOG)
    assert all(item.id not in item.dependencies for item in SERVICE_CATALOG)


def test_catalog_keeps_lifecycle_controls_dynamic_and_off_by_default():
    for item in SERVICE_CATALOG:
        assert item.capabilities.start is False
        assert item.capabilities.stop is False
        assert item.capabilities.restart is False


def test_grouped_components_are_listed_in_dependency_order():
    components = {item.id: item.components for item in SERVICE_CATALOG}

    assert components["milvus"] == (
        "milvus-etcd",
        "milvus-minio",
        "milvus-standalone",
        "milvus-attu",
    )
    assert components["graphiti"] == ("neo4j", "graphiti")
    assert components["onlyoffice"] == (
        "onlyoffice-postgresql",
        "onlyoffice-rabbitmq",
        "onlyoffice-documentserver",
    )


def test_control_policy_exactly_matches_catalog_component_metadata():
    expected_ids = {
        "milvus",
        "graphiti",
        "lightrag",
        "onlyoffice",
        "galapagos",
        "paddleocr-vl",
        "code-server",
    }
    catalog_components = {item.id: item.components for item in SERVICE_CATALOG}

    assert set(CONTROL_POLICIES) == expected_ids
    for service_id, policy in CONTROL_POLICIES.items():
        assert tuple(component.container_name for component in policy.components) == catalog_components[service_id]
