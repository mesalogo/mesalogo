"""
实体应用市场服务

提供应用市场相关的业务逻辑和数据初始化功能
"""
from app.models import MarketApp, db
from app.extensions import db as db_ext
import logging

logger = logging.getLogger(__name__)

class MarketService:
    """实体应用市场服务类"""

    @staticmethod
    def get_app_stats():
        """获取应用统计信息"""
        try:
            total_apps = MarketApp.query.count()
            enabled_apps = MarketApp.query.filter_by(enabled=True).count()
            
            # 获取分类统计
            apps = MarketApp.query.all()
            category_stats = {}
            total_launches = 0
            
            for app in apps:
                category = app.config.get('basic', {}).get('category', '未分类')
                if category not in category_stats:
                    category_stats[category] = {'count': 0, 'enabled': 0}
                
                category_stats[category]['count'] += 1
                if app.enabled:
                    category_stats[category]['enabled'] += 1
                
                # 统计启动次数
                launch_count = app.config.get('stats', {}).get('launch_count', 0)
                total_launches += launch_count
            
            return {
                'total_apps': total_apps,
                'enabled_apps': enabled_apps,
                'disabled_apps': total_apps - enabled_apps,
                'total_launches': total_launches,
                'category_stats': category_stats
            }
            
        except Exception as e:
            logger.error(f"获取应用统计失败: {e}")
            return None
    
    @staticmethod
    def reset_app_stats(app_id=None):
        """重置应用统计数据"""
        try:
            if app_id:
                # 重置特定应用的统计
                app = MarketApp.query.filter_by(app_id=app_id).first()
                if app:
                    if 'stats' in app.config:
                        app.config['stats']['launch_count'] = 0
                        app.config['stats']['install_count'] = 0
                        from sqlalchemy.orm.attributes import flag_modified
                        flag_modified(app, 'config')
                        db.session.commit()
                        return True
            else:
                # 重置所有应用的统计
                apps = MarketApp.query.all()
                for app in apps:
                    if 'stats' in app.config:
                        app.config['stats']['launch_count'] = 0
                        app.config['stats']['install_count'] = 0
                        from sqlalchemy.orm.attributes import flag_modified
                        flag_modified(app, 'config')
                
                db.session.commit()
                return True
                
            return False
            
        except Exception as e:
            logger.error(f"重置应用统计失败: {e}")
            db.session.rollback()
            return False
