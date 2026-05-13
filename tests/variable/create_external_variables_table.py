#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
创建外部环境变量表的脚本
"""

import os
import sys
import sqlite3
from datetime import datetime

# 添加项目根目录到Python路径
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, project_root)

def create_external_variables_table():
    """创建外部环境变量表"""

    # 数据库文件路径
    db_path = os.path.join(project_root, 'app.db')

    if not os.path.exists(db_path):
        print(f"数据库文件不存在: {db_path}")
        return False

    try:
        # 连接数据库
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        # 检查表是否已存在
        cursor.execute("""
            SELECT name FROM sqlite_master
            WHERE type='table' AND name='external_environment_variables'
        """)

        if cursor.fetchone():
            print("外部环境变量表已存在，检查表结构...")

            # 检查表结构是否完整
            cursor.execute("PRAGMA table_info(external_environment_variables)")
            columns = cursor.fetchall()
            column_names = [col[1] for col in columns]

            required_columns = ['id', 'name', 'label', 'api_url', 'api_method', 'sync_interval',
                              'sync_enabled', 'current_value', 'last_sync', 'last_error',
                              'status', 'settings', 'created_at', 'updated_at']

            missing_columns = [col for col in required_columns if col not in column_names]

            if missing_columns:
                print(f"表结构不完整，缺少字段: {missing_columns}")
                print("删除旧表并重新创建...")
                cursor.execute("DROP TABLE external_environment_variables")
            else:
                print("表结构完整")
                return True

        # 创建外部环境变量表
        cursor.execute("""
            CREATE TABLE external_environment_variables (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name VARCHAR(100) NOT NULL UNIQUE,
                label VARCHAR(200) NOT NULL,
                api_url VARCHAR(500) NOT NULL,
                api_method VARCHAR(10) NOT NULL DEFAULT 'GET',
                sync_interval INTEGER NOT NULL DEFAULT 300,
                sync_enabled BOOLEAN NOT NULL DEFAULT 1,
                current_value TEXT,
                last_sync DATETIME,
                last_error TEXT,
                status VARCHAR(20) NOT NULL DEFAULT 'inactive',
                settings JSON,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # 创建索引
        cursor.execute("""
            CREATE INDEX idx_external_env_vars_name ON external_environment_variables(name)
        """)

        cursor.execute("""
            CREATE INDEX idx_external_env_vars_status ON external_environment_variables(status)
        """)

        cursor.execute("""
            CREATE INDEX idx_external_env_vars_sync_enabled ON external_environment_variables(sync_enabled)
        """)

        # 插入测试数据
        test_data = {
            'name': 'health_status',
            'label': '健康检查状态',
            'api_url': 'http://localhost:8080/health',
            'api_method': 'GET',
            'sync_interval': 60,
            'sync_enabled': 1,
            'status': 'inactive',
            'settings': '{"api_headers": "{}", "data_path": "status", "data_type": "string", "timeout": 10, "description": "从本地健康检查API获取系统状态"}'
        }

        cursor.execute("""
            INSERT INTO external_environment_variables
            (name, label, api_url, api_method, sync_interval, sync_enabled, status, settings)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            test_data['name'],
            test_data['label'],
            test_data['api_url'],
            test_data['api_method'],
            test_data['sync_interval'],
            test_data['sync_enabled'],
            test_data['status'],
            test_data['settings']
        ))

        # 提交更改
        conn.commit()

        print("外部环境变量表创建成功")
        print("已插入测试数据: health_status")

        # 验证表结构
        cursor.execute("PRAGMA table_info(external_environment_variables)")
        columns = cursor.fetchall()
        print("\n表结构:")
        for col in columns:
            print(f"  {col[1]} {col[2]} {'NOT NULL' if col[3] else ''} {'PRIMARY KEY' if col[5] else ''}")

        return True

    except sqlite3.Error as e:
        print(f"数据库操作失败: {e}")
        return False
    finally:
        if conn:
            conn.close()

def verify_table():
    """验证表是否创建成功"""
    db_path = os.path.join(project_root, 'app.db')

    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        # 查询测试数据
        cursor.execute("""
            SELECT id, name, label, api_url, status, settings
            FROM external_environment_variables
        """)

        rows = cursor.fetchall()
        print(f"\n外部环境变量表中有 {len(rows)} 条记录:")

        for row in rows:
            print(f"  ID: {row[0]}, Name: {row[1]}, Label: {row[2]}")
            print(f"  URL: {row[3]}, Status: {row[4]}")
            print(f"  Settings: {row[5]}")
            print()

        return True

    except sqlite3.Error as e:
        print(f"验证失败: {e}")
        return False
    finally:
        if conn:
            conn.close()

if __name__ == '__main__':
    print("开始创建外部环境变量表...")

    if create_external_variables_table():
        print("表创建成功，正在验证...")
        verify_table()
        print("完成!")
    else:
        print("表创建失败!")
        sys.exit(1)
