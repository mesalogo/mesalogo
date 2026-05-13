#!/usr/bin/env python3
"""
直接查询 Neo4j 数据库获取 Graphiti 数据

这个模块提供直接连接 Neo4j 数据库的功能，
用于获取 Graphiti 存储的实体节点和关系数据，支持图谱可视化
"""

import json
import asyncio
from neo4j import AsyncGraphDatabase
from typing import Dict, List, Any, Optional

import logging
logger = logging.getLogger(__name__)


class DirectNeo4jQuery:
    def __init__(self, uri: str = "bolt://localhost:7687", user: str = "neo4j", password: str = "password"):
        self.uri = uri
        self.user = user
        self.password = password
        self.driver = None

    @classmethod
    def from_config(cls, config_dict: dict, use_browser_uri: bool = False):
        """从配置字典创建实例
        
        Args:
            config_dict: 配置字典
            use_browser_uri: 是否使用浏览器访问地址（用于前端图谱可视化）
                           True: 使用 neo4j_browser_uri（默认 bolt://127.0.0.1:7687）
                           False: 使用 neo4j_uri（容器内地址 bolt://neo4j:7687）
        """
        framework_config = config_dict.get('framework_config', {})
        
        # 根据参数选择使用哪个 URI
        if use_browser_uri:
            # 用于前端图谱可视化，使用宿主机可访问的地址
            uri = framework_config.get('neo4j_browser_uri', 'bolt://127.0.0.1:7687')
        else:
            # 用于容器内部访问，使用容器网络地址
            uri = framework_config.get('neo4j_uri', 'bolt://neo4j:7687')
        
        return cls(
            uri=uri,
            user=framework_config.get('neo4j_user', 'neo4j'),
            password=framework_config.get('neo4j_password', 'password')
        )
    
    async def connect(self):
        """连接到 Neo4j 数据库"""
        self.driver = AsyncGraphDatabase.driver(self.uri, auth=(self.user, self.password))
        
    async def close(self):
        """关闭数据库连接"""
        if self.driver:
            await self.driver.close()
    
    async def get_all_entities(self, group_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """获取所有实体节点"""
        if not self.driver:
            await self.connect()
        
        query = """
        MATCH (n:Entity)
        """
        
        params = {}
        if group_id:
            query += " WHERE n.group_id = $group_id"
            params["group_id"] = group_id
        
        query += """
        RETURN n.uuid as uuid, n.name as name, n.group_id as group_id, 
               n.summary as summary, n.created_at as created_at, 
               labels(n) as labels
        ORDER BY n.created_at DESC
        """
        
        async with self.driver.session() as session:
            result = await session.run(query, params)
            records = await result.data()
            
        entities = []
        for record in records:
            entity = {
                "uuid": record["uuid"],
                "name": record["name"],
                "group_id": record["group_id"],
                "summary": record["summary"] or "",
                "created_at": record["created_at"],
                "labels": record["labels"] or []
            }
            entities.append(entity)
        
        return entities
    
    async def get_all_relationships(self, group_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """获取所有关系"""
        if not self.driver:
            await self.connect()
        
        query = """
        MATCH (source:Entity)-[r:RELATES_TO]->(target:Entity)
        """
        
        params = {}
        if group_id:
            query += " WHERE r.group_id = $group_id"
            params["group_id"] = group_id
        
        query += """
        RETURN r.uuid as uuid, r.name as name, r.fact as fact,
               r.group_id as group_id, r.created_at as created_at,
               source.uuid as source_uuid, source.name as source_name,
               target.uuid as target_uuid, target.name as target_name
        ORDER BY r.created_at DESC
        """
        
        async with self.driver.session() as session:
            result = await session.run(query, params)
            records = await result.data()
        
        relationships = []
        for record in records:
            relationship = {
                "uuid": record["uuid"],
                "name": record["name"],
                "fact": record["fact"] or "",
                "group_id": record["group_id"],
                "created_at": record["created_at"],
                "source_uuid": record["source_uuid"],
                "source_name": record["source_name"],
                "target_uuid": record["target_uuid"],
                "target_name": record["target_name"]
            }
            relationships.append(relationship)
        
        return relationships
    
    async def get_graph_data(self, group_id: Optional[str] = None) -> Dict[str, Any]:
        """获取完整的图谱数据"""
        entities = await self.get_all_entities(group_id)
        relationships = await self.get_all_relationships(group_id)
        
        # 转换为可视化格式
        nodes = []
        edges = []
        
        # 处理实体节点
        for entity in entities:
            node = {
                "id": entity["uuid"],
                "label": entity["name"],
                "title": f"{entity['name']}\n{entity['summary']}",
                "group": entity["group_id"],
                "color": {
                    "background": "#97C2FC",
                    "border": "#2B7CE9"
                }
            }
            nodes.append(node)
        
        # 处理关系边
        for rel in relationships:
            edge = {
                "id": rel["uuid"],
                "from": rel["source_uuid"],
                "to": rel["target_uuid"],
                "label": rel["name"],
                "title": f"{rel['name']}: {rel['fact']}",
                "color": {"color": "#848484"},
                "arrows": {"to": {"enabled": True}}
            }
            edges.append(edge)
        
        return {
            "nodes": nodes,
            "edges": edges,
            "stats": {
                "entity_count": len(entities),
                "relationship_count": len(relationships),
                "group_id": group_id
            }
        }
    
    async def get_database_info(self) -> Dict[str, Any]:
        """获取数据库基本信息"""
        if not self.driver:
            await self.connect()
        
        queries = {
            "entity_count": "MATCH (n:Entity) RETURN count(n) as count",
            "relationship_count": "MATCH ()-[r:RELATES_TO]->() RETURN count(r) as count",
            "episodic_count": "MATCH (n:Episodic) RETURN count(n) as count",
            "community_count": "MATCH (n:Community) RETURN count(n) as count",
            "group_ids": "MATCH (n:Entity) WHERE n.group_id IS NOT NULL RETURN DISTINCT n.group_id as group_id"
        }
        
        info = {}
        
        async with self.driver.session() as session:
            for key, query in queries.items():
                result = await session.run(query)
                if key == "group_ids":
                    records = await result.data()
                    info[key] = [record["group_id"] for record in records]
                else:
                    record = await result.single()
                    info[key] = record["count"] if record else 0
        
        return info


async def main():
    """主函数 - 测试直接查询功能"""
    logger.info("🔍 直接查询 Neo4j 数据库")
    logger.info("=" * 50)
    
    # 创建查询实例
    neo4j_query = DirectNeo4jQuery()
    
    try:
        # 连接数据库
        await neo4j_query.connect()
        logger.info("✅ 成功连接到 Neo4j 数据库")
        
        # 获取数据库信息
        logger.info("\n📊 数据库信息:")
        db_info = await neo4j_query.get_database_info()
        for key, value in db_info.items():
            logger.info(f"  {key}: {value}")
        
        # 获取特定分区的图谱数据
        group_id = "test-partition"
        logger.info(f"\n🎯 获取分区 '{group_id}' 的图谱数据:")
        
        graph_data = await neo4j_query.get_graph_data(group_id)
        
        logger.info(f"  节点数量: {len(graph_data['nodes'])}")
        logger.info(f"  关系数量: {len(graph_data['edges'])}")
        
        # 显示节点详情
        if graph_data['nodes']:
            logger.info("\n📋 实体节点:")
            for node in graph_data['nodes']:
                logger.info(f"  - {node['label']} ({node['id'][:8]}...)")
        
        # 显示关系详情
        if graph_data['edges']:
            logger.info("\n🔗 关系边:")
            for edge in graph_data['edges']:
                logger.info(f"  - {edge['label']} ({edge['id'][:8]}...)")
        
        # 保存数据到文件
        output_file = "graphiti_data.json"
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(graph_data, f, ensure_ascii=False, indent=2, default=str)
        
        logger.info(f"\n💾 数据已保存到 {output_file}")
        
        # 如果没有关系数据，获取所有实体
        if not graph_data['edges']:
            logger.info("\n⚠️  没有找到关系数据，获取所有实体:")
            entities = await neo4j_query.get_all_entities(group_id)
            for entity in entities:
                logger.info(f"  - {entity['name']}: {entity['summary']}")
        
    except Exception as e:
        logger.error(f"❌ 错误: {e}")
        logger.info("请确保:")
        logger.info("  1. Neo4j 数据库正在运行")
        logger.info("  2. 连接参数正确 (URI, 用户名, 密码)")
        logger.info("  3. 数据库中有 Graphiti 数据")
    
    finally:
        await neo4j_query.close()
        logger.info("\n🔚 数据库连接已关闭")


if __name__ == "__main__":
    asyncio.run(main())
