#!/usr/bin/env python3
"""
迁移脚本：创建 Stripe 支付相关表
- stripe_config: Stripe 配置表（全局单例）
- payment_records: 支付记录表

运行方式：
cd backend && python scripts/migrate_add_stripe_tables.py
"""

import os
import sys
import sqlite3
from datetime import datetime

# 获取数据库路径
script_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.dirname(script_dir)
db_path = os.path.join(backend_dir, 'data', 'app.db')

def migrate():
    if not os.path.exists(db_path):
        print(f"数据库文件不存在: {db_path}")
        sys.exit(1)
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # 检查 stripe_config 表是否已存在
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='stripe_config'")
        if cursor.fetchone():
            print("stripe_config 表已存在，跳过创建")
        else:
            print("创建 stripe_config 表...")
            cursor.execute("""
                CREATE TABLE stripe_config (
                    id VARCHAR(36) PRIMARY KEY,
                    enabled BOOLEAN DEFAULT 0,
                    mode VARCHAR(10) DEFAULT 'test',
                    publishable_key VARCHAR(255),
                    secret_key_encrypted TEXT,
                    webhook_secret_encrypted TEXT,
                    created_at DATETIME,
                    updated_at DATETIME
                )
            """)
            # 插入默认配置记录
            now = datetime.utcnow().isoformat()
            cursor.execute("""
                INSERT INTO stripe_config (id, enabled, mode, created_at, updated_at)
                VALUES ('default', 0, 'test', ?, ?)
            """, (now, now))
            print("stripe_config 表创建成功，已插入默认配置")
        
        # 检查 payment_records 表是否已存在
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='payment_records'")
        if cursor.fetchone():
            print("payment_records 表已存在，跳过创建")
        else:
            print("创建 payment_records 表...")
            cursor.execute("""
                CREATE TABLE payment_records (
                    id VARCHAR(36) PRIMARY KEY,
                    user_id VARCHAR(36),
                    type VARCHAR(20) NOT NULL,
                    amount FLOAT NOT NULL,
                    currency VARCHAR(10) DEFAULT 'CNY',
                    status VARCHAR(20) DEFAULT 'pending',
                    stripe_payment_intent_id VARCHAR(255),
                    stripe_charge_id VARCHAR(255),
                    stripe_invoice_id VARCHAR(255),
                    subscription_id VARCHAR(36),
                    plan_id VARCHAR(36),
                    metadata_json TEXT,
                    failure_reason TEXT,
                    created_at DATETIME,
                    updated_at DATETIME,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
                    FOREIGN KEY (subscription_id) REFERENCES user_subscriptions(id) ON DELETE SET NULL,
                    FOREIGN KEY (plan_id) REFERENCES subscription_plans(id) ON DELETE SET NULL
                )
            """)
            # 创建索引
            cursor.execute("CREATE INDEX idx_payment_records_user_id ON payment_records(user_id)")
            cursor.execute("CREATE INDEX idx_payment_records_status ON payment_records(status)")
            cursor.execute("CREATE INDEX idx_payment_records_created_at ON payment_records(created_at)")
            cursor.execute("CREATE INDEX idx_payment_records_stripe_payment_intent_id ON payment_records(stripe_payment_intent_id)")
            print("payment_records 表创建成功")
        
        conn.commit()
        print("\n迁移完成!")
        
    except Exception as e:
        conn.rollback()
        print(f"迁移失败: {e}")
        sys.exit(1)
    finally:
        conn.close()

if __name__ == '__main__':
    migrate()
