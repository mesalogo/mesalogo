#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
数据库种子数据初始化脚本
用于添加默认的角色、行动空间、规则、规则集、标签等基础数据
优化点：
1. 减少行动空间冗余，合并功能相似的空间
2. 减少通用角色冗余，避免创建不必要的角色
3. 优化规则集结构，删除空规则集
4. 重新规划标签体系，减少标签重叠
5. 整合工具和能力配置
6. 角色体系优化：将原本800多个角色精简为约20个核心角色，包括通用专家、领域专家和专业角色
   - 保留必要的专业角色如市场分析师、研发工程师等
   - 删除重复功能的角色
   - 合并相似角色，确保每个角色都有明确的定位和职责
"""

from app.models import User, Role, Agent, ModelConfig, Knowledge, Tool, ActionSpace, RuleSet, Rule, RuleSetRule, Tag, ActionSpaceTag, Capability, RoleCapability, RoleTool, RoleKnowledge, SystemSetting, ActionSpaceRole, ActionSpaceRuleSet, ExternalEnvironmentVariable, UserRole, UserPermission, UserRoleAssignment, UserRolePermission, WorkspaceTemplate, SubscriptionPlan, UserSubscription
from app.extensions import db
import json
from datetime import datetime
import os
import uuid
import secrets
import string
import logging
from sqlalchemy import text
from sqlalchemy import inspect
from app.services.role_service import RoleService
from werkzeug.security import generate_password_hash

logger = logging.getLogger(__name__)

def seed_data():
    """初始化数据库种子数据"""
    logger.info("开始执行数据库种子数据初始化...")

    try:
        # 清空数据库表
        logger.info("清空现有数据表...")
        ActionSpaceTag.query.delete()  # 先删除关联表
        Tag.query.delete()  # 再删除标签表
        ModelConfig.query.delete()
        Agent.query.delete()
        RoleCapability.query.delete()  # 先删除角色能力关联表
        RoleTool.query.delete()  # 先删除角色工具关联表
        RoleKnowledge.query.delete()  # 先删除角色知识关联表

        ActionSpaceRole.query.delete()  # 先删除行动空间角色关联表
        Role.query.delete()

        # 清空用户权限系统相关表
        UserRoleAssignment.query.delete()  # 先删除用户角色分配表
        UserRolePermission.query.delete()  # 先删除角色权限关联表
        UserRole.query.delete()  # 再删除用户角色表
        UserPermission.query.delete()  # 再删除用户权限表
        User.query.delete()

        Knowledge.query.delete()
        Tool.query.delete()

        RuleSetRule.query.delete()  # 先删除关联表
        Rule.query.delete()  # 再删除规则表
        RuleSet.query.delete()
        ActionSpace.query.delete()
        SystemSetting.query.delete()  # 清空系统设置表
        db.session.commit()

        # 创建默认用户
        logger.info("创建默认用户...")
        user = User(
            username="admin",
            email="admin@example.com",
            is_active=True,
            is_admin=True  # 设置为管理员
        )
        user.set_password('admin123')
        db.session.add(user)

        # 创建预定义角色
        logger.info("创建预定义角色...")
        predefined_roles = json.load(open('app/seed_data/seed_data_roles.json', 'r', encoding='utf-8'))

        roles = []
        for role_data in predefined_roles:
            role_data['is_shared'] = True  # 系统预定义角色设为公开
            role = Role(**role_data)
            db.session.add(role)
            roles.append(role)

        db.session.commit()

        # 创建模型配置
        logger.info("创建模型配置...")
        model_configs = json.load(open('app/seed_data/seed_data_models.json', 'r', encoding='utf-8'))

        for config_data in model_configs:
            config = ModelConfig(**config_data)
            db.session.add(config)

        # 创建行动空间 - 优化：减少重复空间
        logger.info("创建行动空间...")
        action_spaces = json.load(open('app/seed_data/seed_data_action_space.json', 'r', encoding='utf-8'))
        # 添加行动空间
        spaces = []
        for space_data in action_spaces:
            space_data['is_shared'] = True  # 系统预定义行动空间设为公开
            space = ActionSpace(**space_data)
            db.session.add(space)
            db.session.flush()  # 获取ID
            spaces.append(space)

        db.session.commit()
        logger.info(f"行动空间创建完成，总计 {len(spaces)} 个空间")

        # 创建标签 - 优化：减少重叠标签
        logger.info("创建标签...")

        # 行业标签（优化：合并相似行业）
        industry_tags = [
            {"name": "制造业", "type": "industry", "description": "制造业相关行动空间", "color": "#1890ff"},
            {"name": "医疗健康", "type": "industry", "description": "医疗健康行业相关行动空间", "color": "#52c41a"},
            {"name": "金融服务", "type": "industry", "description": "金融服务行业相关行动空间", "color": "#faad14"},
            {"name": "零售消费", "type": "industry", "description": "零售消费行业相关行动空间", "color": "#eb2f96"},
            {"name": "信息技术", "type": "industry", "description": "信息技术行业相关行动空间", "color": "#2f54eb"},
            {"name": "物流交通", "type": "industry", "description": "物流交通行业相关行动空间", "color": "#a0d911"},
            {"name": "法律服务", "type": "industry", "description": "法律服务行业相关行动空间", "color": "#722ed1"},
            {"name": "教育培训", "type": "industry", "description": "教育培训行业相关行动空间", "color": "#fa541c"},
            {"name": "农业食品", "type": "industry", "description": "农业食品行业相关行动空间", "color": "#a0d911"},
            {"name": "环境能源", "type": "industry", "description": "环境能源相关行动空间", "color": "#0bce74"}
        ]

        # 场景标签（优化：整合相似场景）
        scenario_tags = [
            {"name": "产品研发", "type": "scenario", "description": "产品研发相关场景", "color": "#1890ff"},
            {"name": "供应链管理", "type": "scenario", "description": "供应链管理相关场景", "color": "#52c41a"},
            {"name": "客户服务", "type": "scenario", "description": "客户服务相关场景", "color": "#faad14"},
            {"name": "市场营销", "type": "scenario", "description": "市场营销相关场景", "color": "#eb2f96"},
            {"name": "质量控制", "type": "scenario", "description": "质量控制相关场景", "color": "#722ed1"},
            {"name": "风险管理", "type": "scenario", "description": "风险管理相关场景", "color": "#13c2c2"},
            {"name": "生产制造", "type": "scenario", "description": "生产制造相关场景", "color": "#fa541c"},
            {"name": "项目管理", "type": "scenario", "description": "项目管理相关场景", "color": "#eb2f96"},
            {"name": "诊断分析", "type": "scenario", "description": "诊断分析相关场景", "color": "#13c2c2"},
            {"name": "战略决策", "type": "scenario", "description": "战略决策相关场景", "color": "#a0d911"},
            {"name": "资源优化", "type": "scenario", "description": "资源优化相关场景", "color": "#1890ff"},
            {"name": "多专家协作", "type": "scenario", "description": "多专家协作决策相关场景", "color": "#52c41a"}
        ]

        # 保存所有标签
        all_tags = {}
        for tag_data in industry_tags + scenario_tags:
            tag = Tag(
                name=tag_data["name"],
                type=tag_data["type"],
                description=tag_data["description"],
                color=tag_data["color"]
            )
            db.session.add(tag)
            db.session.flush()  # 获取ID
            all_tags[tag.name] = tag

        db.session.commit()
        logger.info(f"已创建{len(all_tags)}个标签")

        # 为不同场景定义标签
        space_tags = json.load(open("app/seed_data/seed_data_space_tags.json", encoding='utf-8'))

        # 创建映射字典，通过名称访问行动空间
        action_space_map = {space.name: space for space in spaces}

        # 添加标签关联
        for space_name, tags_config in space_tags.items():
            # 确保该行动空间存在
            if space_name in action_space_map:
                space = action_space_map[space_name]

                # 添加行业标签
                for industry in tags_config["industry"]:
                    # 标签名称映射 - 将旧标签名映射到新标签名
                    industry_map = {
                        "家电": "制造业",
                        "消费电子": "制造业",
                        "工业": "制造业",
                        "医疗": "医疗健康",
                        "金融": "金融服务",
                        "保险": "金融服务",
                        "零售业": "零售消费",
                        "服务业": "零售消费",
                        "咨询": "零售消费"
                    }

                    # 使用映射后的标签名
                    mapped_industry = industry_map.get(industry, industry)
                    if mapped_industry in all_tags:
                        action_space_tag = ActionSpaceTag(
                            action_space_id=space.id,
                            tag_id=all_tags[mapped_industry].id
                        )
                        db.session.add(action_space_tag)

                # 添加场景标签
                for scenario in tags_config["scenario"]:
                    # 标签名称映射 - 将旧标签名映射到新标签名
                    scenario_map = {
                        "销售": "市场营销",
                        "库存管理": "供应链管理",
                        "研发": "产品研发",
                        "投资决策": "战略决策",
                        "战略规划": "战略决策",
                        "市场模拟": "市场营销",
                        "协作决策": "多专家协作",
                        "国际业务": "市场营销"
                    }

                    # 使用映射后的标签名
                    mapped_scenario = scenario_map.get(scenario, scenario)
                    if mapped_scenario in all_tags:
                        action_space_tag = ActionSpaceTag(
                            action_space_id=space.id,
                            tag_id=all_tags[mapped_scenario].id
                        )
                        db.session.add(action_space_tag)
            else:
                logger.warning(f"行动空间 '{space_name}' 不存在")

        db.session.commit()
        logger.info("场景标签关联创建完成")

        # 创建规则 - 保持规则精简，避免冗余
        logger.info("创建规则...")
        rules = json.load(open("app/seed_data/seed_data_rules.json", encoding='utf-8'))

        # 添加规则
        rule_objects = []
        for rule_data in rules:
            rule_data['is_shared'] = True  # 系统预定义规则设为公开
            rule = Rule(**rule_data)
            db.session.add(rule)
            rule_objects.append(rule)

        # 提交规则数据，确保它们获得ID
        db.session.commit()
        logger.info(f"规则创建完成，总计 {len(rule_objects)} 个规则")

        # 为每个行动空间创建规则集 - 优化：去除空规则集
        logger.info("创建规则集...")
        rule_sets = json.load(open("app/seed_data/seed_data_rules_sets.json", encoding='utf-8'))

        # 添加规则集，只添加有实际规则的规则集
        rule_set_objects = []

        # 创建规则名称到规则ID的映射
        rule_map = {rule.name: rule.id for rule in rule_objects}

        for rule_set_data in rule_sets:
            # 过滤掉不支持的字段
            if 'category' in rule_set_data:
                del rule_set_data['category']
            if 'is_active' in rule_set_data:
                del rule_set_data['is_active']

            # 只添加有实际规则的规则集
            if rule_set_data.get('rules'):
                # 保存规则名称列表
                rule_names = rule_set_data.get('rules', [])

                # 创建规则集记录
                rule_set = RuleSet(
                    name=rule_set_data.get('name'),
                    description=rule_set_data.get('description', ''),
                    conditions=rule_set_data.get('conditions', []),
                    actions=rule_set_data.get('actions', []),
                    settings=rule_set_data.get('settings', {}),
                    is_shared=True  # 系统预定义规则集设为公开
                )
                db.session.add(rule_set)
                db.session.flush()  # 获取新ID但不提交
                rule_set_objects.append(rule_set)

                # 直接关联规则到规则集
                for rule_name in rule_names:
                    if rule_name in rule_map:
                        rule_set_rule = RuleSetRule(
                            rule_set_id=rule_set.id,
                            rule_id=rule_map[rule_name],
                            priority=0  # 默认优先级设为0
                        )
                        db.session.add(rule_set_rule)

        db.session.commit()
        logger.info(f"规则集创建完成，总计 {len(rule_set_objects)} 个规则集")

        # 为行动空间关联规则集
        logger.info("关联规则集到行动空间...")
        # 这里创建一个简单的映射表，根据规则集的使用场景关联到相应行动空间
        rule_set_space_map = {
            "基础问答规则集": ["智能助手空间", "教育学习空间"],
            "团队协作规则集": ["产品创新研发空间", "军事决策模拟空间", "辩论行动空间"],
            "教育学习规则集": ["教育学习空间"],
            "企业决策规则集": ["企业决策分析空间", "军事决策模拟空间"],
            "法律分析规则集": ["法律案例多维分析空间", "辩论行动空间"],
            "医疗诊断规则集": ["医疗诊断与会诊空间"],
            "金融投资规则集": ["金融投资分析空间"],
            "安全监管规则集": ["工业安全与监管空间", "军事决策模拟空间"],
            "环境监测规则集": ["环境监测与分析空间"],
            "城市规划规则集": ["城市规划空间"],
            "供应链规则集": ["供应链风险管理空间"],
            "军事决策规则集": ["军事决策模拟空间"],
            "辩论规则集": ["辩论行动空间"]
            # 已删除的规则集：农业生产规则集、技术评估规则集、零售物流规则集、智能制造规则集、产品研发规则集、市场营销规则集、可持续发展规则集
        }

        # 创建规则集名称到规则集ID的映射
        rule_set_name_to_id = {rule_set.name: rule_set.id for rule_set in rule_set_objects}
        logger.info(f"已创建规则集名称到ID的映射，共有 {len(rule_set_name_to_id)} 个规则集")

        # 输出行动空间映射信息，用于调试
        action_space_names = list(action_space_map.keys())
        logger.info(f"可用的行动空间名称列表: {action_space_names}")

        # 创建规则集与行动空间的关联
        associations_created = 0
        missing_rule_sets = set()
        missing_action_spaces = set()

        for rule_set_name, space_names in rule_set_space_map.items():
            if rule_set_name in rule_set_name_to_id:
                rule_set_id = rule_set_name_to_id[rule_set_name]
                logger.debug(f"处理规则集: {rule_set_name} (ID: {rule_set_id})")

                for space_name in space_names:
                    if space_name in action_space_map:
                        space_id = action_space_map[space_name].id
                        logger.debug(f"  关联到行动空间: {space_name} (ID: {space_id})")

                        association = ActionSpaceRuleSet(
                            rule_set_id=rule_set_id,
                            action_space_id=space_id,
                            settings={}
                        )
                        db.session.add(association)
                        associations_created += 1
                    else:
                        missing_action_spaces.add(space_name)
                        logger.warning(f"  未找到行动空间: {space_name}")
            else:
                missing_rule_sets.add(rule_set_name)
                logger.warning(f"未找到规则集: {rule_set_name}")

        if missing_rule_sets:
            logger.warning(f"以下规则集未找到: {', '.join(missing_rule_sets)}")

        if missing_action_spaces:
            logger.warning(f"以下行动空间未找到: {', '.join(missing_action_spaces)}")

        logger.info(f"创建了 {associations_created} 个规则集与行动空间的关联")

        # 为行动空间关联角色 - 优化：根据实际需要关联角色
        logger.info("关联角色到行动空间...")
        space_roles = json.load(open("app/seed_data/seed_data_space_roles.json", encoding='utf-8'))

        # 加载空间角色额外提示词（如果文件存在）
        space_role_prompts = {}
        try:
            space_role_prompts = json.load(open("app/seed_data/seed_data_space_role_prompts.json", encoding='utf-8'))
            logger.info("已加载空间角色额外提示词")
        except FileNotFoundError:
            logger.warning("未找到空间角色额外提示词文件，将使用默认设置")
        except Exception as e:
            logger.warning(f"加载空间角色额外提示词时出错: {str(e)}")

        # 创建角色名称到角色ID的映射
        role_map = {role.name: role.id for role in roles}

        for space_name, role_names in space_roles.items():
            if space_name in action_space_map:
                space = action_space_map[space_name]
                for role_name in role_names:
                    if role_name in role_map:
                        # 检查是否有该空间和角色的额外提示词
                        settings = {}
                        additional_prompt = ''
                        if space_name in space_role_prompts and role_name in space_role_prompts[space_name]:
                            additional_prompt = space_role_prompts[space_name][role_name]
                            logger.info(f"为空间 '{space_name}' 的角色 '{role_name}' 添加了额外提示词")

                        space_role = ActionSpaceRole(
                            action_space_id=space.id,
                            role_id=role_map[role_name],
                            quantity=1,
                            settings=settings,
                            additional_prompt=additional_prompt
                        )
                        db.session.add(space_role)
            else:
                logger.warning(f"行动空间 '{space_name}' 不存在，无法关联角色")

        db.session.commit()
        logger.info("行动空间-角色关联创建完成")

        # 创建能力
        logger.info("创建能力...")
        capabilities = json.load(open("app/seed_data/seed_data_capabilities.json", encoding='utf-8'))

        capability_objects = []
        for capability_data in capabilities:
            # 对于基础能力(core)，设置default_enabled=True, security_level=1
            if capability_data.get('type') == 'core':
                capability_data['default_enabled'] = True
                capability_data['security_level'] = 1

            capability_data['is_shared'] = True  # 系统预定义能力设为公开
            capability = Capability(**capability_data)
            db.session.add(capability)
            capability_objects.append(capability)

        db.session.commit()
        logger.info(f"能力创建完成，总计 {len(capability_objects)} 个能力")

        # 关联能力和工具
        logger.info("关联能力和MCP服务器工具...")
        capability_tools = json.load(open("app/seed_data/seed_data_capabilities_tools.json", encoding='utf-8'))

        # 创建能力名称到能力对象的映射
        capability_map = {cap.name: cap for cap in capability_objects}

        # 设置能力与工具的关联
        for capability_name, tools_data in capability_tools.items():
            if capability_name in capability_map:
                capability = capability_map[capability_name]
                # 为每个能力设置关联的工具
                capability.tools = tools_data
                db.session.add(capability)
                logger.info(f"为能力 '{capability_name}' 关联了 {len(tools_data.get('mcp', []))} 个MCP工具")

        db.session.commit()
        logger.info("能力与工具关联完成")

        # 关联能力到角色
        logger.info("关联能力到角色...")
        # 简化处理：为所有角色关联核心能力
        core_capabilities = [cap for cap in capability_objects if cap.type == 'core']
        for role in roles:
            for cap in core_capabilities:
                role_cap = RoleCapability(
                    role_id=role.id,
                    capability_id=cap.id
                )
                db.session.add(role_cap)

        db.session.commit()
        logger.info("能力和角色关联完成")

        # 创建系统设置
        logger.info("创建系统设置...")
        system_settings = json.load(open("app/seed_data/seed_data_system_settings.json", 'r', encoding='utf-8'))

        for setting_data in system_settings:
            # 检查设置是否已存在
            existing_setting = SystemSetting.query.filter_by(key=setting_data['key']).first()
            if existing_setting:
                logger.info(f"系统设置 '{setting_data['key']}' 已存在，正在更新...")
                # 更新现有设置
                existing_setting.value = setting_data['value']
                existing_setting.value_type = setting_data['value_type']
                existing_setting.description = setting_data['description']
                existing_setting.category = setting_data['category']
                existing_setting.is_secret = setting_data['is_secret']
                db.session.add(existing_setting)
            else:
                # 创建新设置
                setting = SystemSetting(**setting_data)
                db.session.add(setting)
                logger.info(f"创建系统设置: {setting_data['key']}")

        # 生成随机的license密钥
        logger.info("生成随机的license密钥...")
        # 检查是否已存在license密钥
        existing_license_key = SystemSetting.query.filter_by(key='license_secret_key').first()
        if not existing_license_key:
            # 生成一个32字符的随机密钥
            alphabet = string.ascii_letters + string.digits
            license_key = ''.join(secrets.choice(alphabet) for _ in range(32))

            # 保存到系统设置
            license_setting = SystemSetting(
                key='license_secret_key',
                value=license_key,
                value_type='string',
                description='系统许可证密钥，用于验证许可证',
                category='license',
                is_secret=True
            )
            db.session.add(license_setting)
            logger.info("已生成随机license密钥")

            # 保存到文件
            license_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data')
            os.makedirs(license_dir, exist_ok=True)
            license_file = os.path.join(license_dir, 'license_request.txt')
            with open(license_file, 'w') as f:
                f.write(f"系统许可证密钥: {license_key}\n")
                f.write("请将此密钥提供给厂商，用于生成与系统匹配的许可证。\n")
            logger.info(f"已将license密钥保存到文件: {license_file}")
        else:
            logger.info("系统已存在license密钥，跳过生成步骤")

        db.session.commit()
        logger.info(f"系统设置创建完成，总计 {len(system_settings)} 个设置")

        # 创建默认外部环境变量
        logger.info("创建默认外部环境变量...")

        # 检查是否已存在默认的健康检查变量
        existing_health_var = ExternalEnvironmentVariable.query.filter_by(name='health_status').first()
        if not existing_health_var:
            # 创建健康检查外部变量
            health_var = ExternalEnvironmentVariable(
                name='health_status',
                label='系统健康状态',
                api_url='http://localhost:8080/api/health',
                api_method='GET',
                sync_interval=60,  # 1分钟同步一次
                sync_enabled=False,
                status='inactive',
                settings={
                    'api_headers': '{}',
                    'data_path': 'status',
                    'data_type': 'string',
                    'timeout': 10,
                    'description': '从本地API获取系统健康状态'
                }
            )
            db.session.add(health_var)
            logger.info("已创建默认健康检查外部变量")
        else:
            logger.info("健康检查外部变量已存在，跳过创建")

        db.session.commit()
        logger.info("默认外部环境变量创建完成")

        # 创建实体应用市场应用
        logger.info("创建实体应用市场应用...")
        from app.models import MarketApp

        # 检查是否已有market应用
        existing_market_apps = MarketApp.query.count()
        if existing_market_apps == 0:
            # 加载market应用数据
            market_apps_data = json.load(open("app/seed_data/seed_data_market.json", encoding='utf-8'))

            created_apps = 0
            for app_data in market_apps_data:
                market_app = MarketApp(
                    app_id=app_data['app_id'],
                    name=app_data['name'],
                    enabled=app_data['enabled'],
                    launchable=app_data.get('launchable', True),
                    sort_order=app_data['sort_order'],
                    scope=app_data.get('scope', 'space'),
                    config=app_data['config']
                )
                db.session.add(market_app)
                created_apps += 1

            db.session.commit()
            logger.info(f"已创建 {created_apps} 个实体应用市场应用")
        else:
            logger.info(f"实体应用市场应用已存在 ({existing_market_apps} 个)，跳过创建")

        # 初始化用户权限系统
        logger.info("初始化用户权限系统...")
        user_permission_data = json.load(open('app/seed_data/seed_data_user_role_permission.json', 'r', encoding='utf-8'))

        # 创建用户权限
        logger.info("创建用户权限...")
        permissions_data = user_permission_data['permissions']
        permission_objects = []
        for perm_data in permissions_data:
            permission = UserPermission(
                name=perm_data['name'],
                display_name=perm_data['display_name'],
                description=perm_data['description'],
                category=perm_data['category'],
                resource=perm_data['resource'],
                action=perm_data['action'],
                is_system=True
            )
            db.session.add(permission)
            permission_objects.append(permission)

        db.session.commit()
        logger.info(f"用户权限创建完成，总计 {len(permission_objects)} 个权限")

        # 创建用户角色
        logger.info("创建用户角色...")
        roles_data = user_permission_data['roles']
        user_role_objects = []
        for role_data in roles_data:
            user_role = UserRole(
                name=role_data['name'],
                display_name=role_data['display_name'],
                description=role_data['description'],
                is_system=role_data['is_system'],
                is_active=True
            )
            db.session.add(user_role)
            user_role_objects.append(user_role)

        db.session.commit()
        logger.info(f"用户角色创建完成，总计 {len(user_role_objects)} 个角色")

        # 为角色分配权限
        logger.info("为角色分配权限...")
        role_permissions_data = user_permission_data['role_permissions']

        # 创建权限名称到权限ID的映射
        permission_map = {perm.name: perm.id for perm in permission_objects}
        # 创建角色名称到角色ID的映射
        user_role_map = {role.name: role.id for role in user_role_objects}

        for role_name, permission_names in role_permissions_data.items():
            if role_name in user_role_map:
                role_id = user_role_map[role_name]
                for perm_name in permission_names:
                    if perm_name in permission_map:
                        role_perm = UserRolePermission(
                            user_role_id=role_id,
                            user_permission_id=permission_map[perm_name]
                        )
                        db.session.add(role_perm)
                logger.info(f"为角色 '{role_name}' 分配了 {len(permission_names)} 个权限")

        db.session.commit()
        logger.info("角色权限分配完成")

        # 为admin用户分配超级管理员角色
        logger.info("为admin用户分配超级管理员角色...")
        super_admin_role = UserRole.query.filter_by(name='super_admin').first()
        if super_admin_role and user:
            # 检查是否已经有该角色
            existing_assignment = UserRoleAssignment.query.filter_by(
                user_id=user.id,
                user_role_id=super_admin_role.id
            ).first()

            if not existing_assignment:
                user_role_assignment = UserRoleAssignment(
                    user_id=user.id,
                    user_role_id=super_admin_role.id,
                    assigned_by=user.id
                )
                db.session.add(user_role_assignment)
                db.session.commit()
                logger.info(f"为用户 '{user.username}' 分配了超级管理员角色")
            else:
                logger.info(f"用户 '{user.username}' 已经拥有超级管理员角色")
        else:
            logger.warning("未找到admin用户或超级管理员角色")

        logger.info("用户权限系统初始化完成")

        # 创建工作空间默认模板
        logger.info("创建工作空间默认模板...")
        workspace_templates_data = json.load(open('app/seed_data/seed_data_workspace_template.json', 'r', encoding='utf-8'))
        
        templates_created = 0
        for template_data in workspace_templates_data:
            # 检查是否已存在同名模板
            existing_template = WorkspaceTemplate.query.filter_by(
                name=template_data['name'],
                is_active=True
            ).first()
            
            if existing_template:
                logger.info(f"工作空间模板 '{template_data['name']}' 已存在，跳过")
                continue
            
            # 创建新模板
            template = WorkspaceTemplate(
                name=template_data['name'],
                description=template_data['description'],
                category=template_data['category'],
                content=template_data['content'],
                settings=template_data['settings'],
                is_active=True
            )
            db.session.add(template)
            templates_created += 1
            logger.info(f"创建工作空间模板: {template_data['name']}")
        
        db.session.commit()
        logger.info(f"工作空间默认模板创建完成，总计 {templates_created} 个模板")

        # 创建并行实验模板
        logger.info("创建并行实验模板...")
        try:
            from app.models import ParallelExperiment
            
            parallel_experiments_data = json.load(open('app/seed_data/seed_data_parallel_experiments.json', 'r', encoding='utf-8'))
            
            # 构建行动空间名称到ID的映射
            action_space_map = {space.name: space.id for space in ActionSpace.query.all()}
            
            experiments_created = 0
            for exp_data in parallel_experiments_data:
                # 通过名称查找行动空间ID
                space_name = exp_data.get('source_action_space_name')
                if space_name not in action_space_map:
                    logger.warning(f"实验模板 '{exp_data['name']}' 的行动空间 '{space_name}' 不存在，跳过")
                    continue
                
                # 检查是否已存在同名模板
                existing_exp = ParallelExperiment.query.filter_by(
                    name=exp_data['name'],
                    is_template=True
                ).first()
                
                if existing_exp:
                    logger.info(f"实验模板 '{exp_data['name']}' 已存在，跳过")
                    continue
                
                # 创建模板实验
                experiment = ParallelExperiment(
                    name=exp_data['name'],
                    description=exp_data.get('description', ''),
                    source_action_space_id=action_space_map[space_name],
                    config=exp_data.get('config', {}),
                    status='template',
                    is_template=True
                )
                db.session.add(experiment)
                experiments_created += 1
                logger.info(f"创建实验模板: {exp_data['name']}")
            
            db.session.commit()
            logger.info(f"并行实验模板创建完成，总计 {experiments_created} 个模板")
        except Exception as e:
            logger.warning(f"创建并行实验模板失败（可忽略）: {str(e)}")

        # 创建订阅计划
        logger.info("创建订阅计划...")
        subscription_plans_data = json.load(open('app/seed_data/seed_data_subscription_plans.json', 'r', encoding='utf-8'))
        
        plans_created = 0
        for plan_data in subscription_plans_data:
            existing_plan = SubscriptionPlan.query.filter_by(name=plan_data['name']).first()
            if existing_plan:
                logger.info(f"订阅计划 '{plan_data['name']}' 已存在，跳过")
                continue
            
            plan = SubscriptionPlan(**plan_data)
            db.session.add(plan)
            plans_created += 1
        
        db.session.commit()
        logger.info(f"订阅计划创建完成，总计 {plans_created} 个计划")

        # 为admin用户分配默认订阅
        logger.info("为admin用户分配默认订阅...")
        default_plan = SubscriptionPlan.query.filter_by(is_default=True).first()
        if default_plan and user:
            existing_sub = UserSubscription.query.filter_by(user_id=user.id, is_current=True).first()
            if not existing_sub:
                subscription = UserSubscription(
                    user_id=user.id,
                    plan_id=default_plan.id,
                    status='active',
                    is_current=True,
                    source='system_default'
                )
                db.session.add(subscription)
                db.session.commit()
                logger.info(f"为用户 '{user.username}' 分配了默认订阅计划 '{default_plan.display_name}'")

        logger.info("数据库种子数据初始化完成！")

        return True

    except Exception as e:
        db.session.rollback()
        logger.error(f"数据库种子数据初始化失败: {str(e)}")
        return False

if __name__ == "__main__":
    seed_data()
