#!/usr/bin/env python3
"""
迁移脚本：为 parallel_experiments 表添加 pending_combinations 字段

用于延迟创建优化：当任务数量很大时，只预创建少量任务，
剩余参数组合存储在 pending_combinations 中按需创建。

支持 MySQL 和 SQLite。

运行方式：
cd backend && python scripts/migrate_add_pending_combinations.py
"""

import os
import sys

# 将 backend 目录加入 sys.path
script_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.dirname(script_dir)
sys.path.insert(0, backend_dir)


def migrate():
    from app import create_app, db
    from sqlalchemy import text, inspect

    app = create_app()
    with app.app_context():
        inspector = inspect(db.engine)
        columns = [col['name'] for col in inspector.get_columns('parallel_experiments')]

        if 'pending_combinations' not in columns:
            print("添加 pending_combinations 字段...")
            # 根据数据库类型选择 SQL
            dialect = db.engine.dialect.name
            if dialect == 'mysql':
                sql = "ALTER TABLE parallel_experiments ADD COLUMN pending_combinations JSON DEFAULT NULL"
            else:
                # SQLite
                sql = "ALTER TABLE parallel_experiments ADD COLUMN pending_combinations TEXT DEFAULT '{}'"
            db.session.execute(text(sql))
            db.session.commit()
            print(f"pending_combinations 字段添加成功 (dialect={dialect})")
        else:
            print("pending_combinations 字段已存在，跳过")

        print("\n迁移完成!")


if __name__ == '__main__':
    migrate()
