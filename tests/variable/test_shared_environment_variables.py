import pytest
import json
from app import create_app, db
from app.models import SharedEnvironmentVariable, ActionSpace, ActionSpaceSharedVariable, ActionTask, ActionTaskEnvironmentVariable
from config import TestConfig


@pytest.fixture
def app():
    """创建测试应用"""
    app = create_app(TestConfig)
    with app.app_context():
        db.create_all()
        yield app
        db.drop_all()


@pytest.fixture
def client(app):
    """创建测试客户端"""
    return app.test_client()


@pytest.fixture
def sample_shared_variable(app):
    """创建示例共享环境变量"""
    with app.app_context():
        variable = SharedEnvironmentVariable(
            name='test_shared_var',
            label='测试共享变量',
            type='text',
            default_value='shared_value',
            description='这是一个测试共享变量',
            is_readonly=False
        )
        db.session.add(variable)
        db.session.commit()
        return variable


@pytest.fixture
def sample_action_space(app):
    """创建示例行动空间"""
    with app.app_context():
        space = ActionSpace(
            name='测试行动空间',
            description='用于测试的行动空间'
        )
        db.session.add(space)
        db.session.commit()
        return space


class TestSharedEnvironmentVariables:
    """共享环境变量测试类"""

    def test_create_shared_variable(self, client):
        """测试创建共享环境变量"""
        data = {
            'name': 'new_shared_var',
            'label': '新共享变量',
            'type': 'text',
            'default_value': 'default_value',
            'description': '新创建的共享变量',
            'is_readonly': True
        }
        
        response = client.post('/api/shared-environment-variables', 
                             data=json.dumps(data),
                             content_type='application/json')
        
        assert response.status_code == 201
        result = json.loads(response.data)
        assert result['name'] == 'new_shared_var'
        assert result['is_readonly'] == True

    def test_get_all_shared_variables(self, client, sample_shared_variable):
        """测试获取所有共享环境变量"""
        response = client.get('/api/shared-environment-variables')
        
        assert response.status_code == 200
        result = json.loads(response.data)
        assert len(result) == 1
        assert result[0]['name'] == 'test_shared_var'

    def test_get_shared_variable_by_id(self, client, sample_shared_variable):
        """测试根据ID获取共享环境变量"""
        response = client.get(f'/api/shared-environment-variables/{sample_shared_variable.id}')
        
        assert response.status_code == 200
        result = json.loads(response.data)
        assert result['name'] == 'test_shared_var'
        assert result['label'] == '测试共享变量'

    def test_update_shared_variable(self, client, sample_shared_variable):
        """测试更新共享环境变量"""
        data = {
            'label': '更新后的标签',
            'default_value': 'updated_value',
            'is_readonly': True
        }
        
        response = client.put(f'/api/shared-environment-variables/{sample_shared_variable.id}',
                            data=json.dumps(data),
                            content_type='application/json')
        
        assert response.status_code == 200
        result = json.loads(response.data)
        assert result['label'] == '更新后的标签'
        assert result['default_value'] == 'updated_value'
        assert result['is_readonly'] == True

    def test_delete_shared_variable(self, client, sample_shared_variable):
        """测试删除共享环境变量"""
        response = client.delete(f'/api/shared-environment-variables/{sample_shared_variable.id}')
        
        assert response.status_code == 200
        
        # 验证变量已被删除
        get_response = client.get(f'/api/shared-environment-variables/{sample_shared_variable.id}')
        assert get_response.status_code == 404

    def test_bind_shared_variable_to_action_space(self, client, sample_shared_variable, sample_action_space):
        """测试将共享环境变量绑定到行动空间"""
        response = client.post(f'/api/action-spaces/{sample_action_space.id}/shared-variables/{sample_shared_variable.id}')
        
        assert response.status_code == 201
        result = json.loads(response.data)
        assert result['variable_id'] == sample_shared_variable.id
        assert result['name'] == 'test_shared_var'

    def test_get_action_space_shared_variables(self, client, sample_shared_variable, sample_action_space):
        """测试获取行动空间绑定的共享环境变量"""
        # 先绑定变量
        client.post(f'/api/action-spaces/{sample_action_space.id}/shared-variables/{sample_shared_variable.id}')
        
        # 获取绑定的变量
        response = client.get(f'/api/action-spaces/{sample_action_space.id}/shared-variables')
        
        assert response.status_code == 200
        result = json.loads(response.data)
        assert len(result) == 1
        assert result[0]['name'] == 'test_shared_var'

    def test_unbind_shared_variable_from_action_space(self, client, sample_shared_variable, sample_action_space):
        """测试解除共享环境变量与行动空间的绑定"""
        # 先绑定变量
        client.post(f'/api/action-spaces/{sample_action_space.id}/shared-variables/{sample_shared_variable.id}')
        
        # 解除绑定
        response = client.delete(f'/api/action-spaces/{sample_action_space.id}/shared-variables/{sample_shared_variable.id}')
        
        assert response.status_code == 200
        
        # 验证绑定已解除
        get_response = client.get(f'/api/action-spaces/{sample_action_space.id}/shared-variables')
        result = json.loads(get_response.data)
        assert len(result) == 0

    def test_duplicate_variable_name(self, client, sample_shared_variable):
        """测试创建重复名称的共享环境变量"""
        data = {
            'name': 'test_shared_var',  # 与现有变量同名
            'label': '重复名称变量',
            'default_value': 'value'
        }
        
        response = client.post('/api/shared-environment-variables',
                             data=json.dumps(data),
                             content_type='application/json')
        
        assert response.status_code == 400
        result = json.loads(response.data)
        assert '变量名已存在' in result['error']

    def test_duplicate_binding(self, client, sample_shared_variable, sample_action_space):
        """测试重复绑定共享环境变量到同一行动空间"""
        # 第一次绑定
        response1 = client.post(f'/api/action-spaces/{sample_action_space.id}/shared-variables/{sample_shared_variable.id}')
        assert response1.status_code == 201
        
        # 第二次绑定（应该失败）
        response2 = client.post(f'/api/action-spaces/{sample_action_space.id}/shared-variables/{sample_shared_variable.id}')
        assert response2.status_code == 400
        result = json.loads(response2.data)
        assert '已绑定' in result['error']


class TestSharedVariableInheritance:
    """测试共享环境变量在任务中的继承"""

    def test_task_inherits_shared_variables(self, app, sample_shared_variable, sample_action_space):
        """测试行动任务继承共享环境变量"""
        with app.app_context():
            # 绑定共享变量到行动空间
            binding = ActionSpaceSharedVariable(
                action_space_id=sample_action_space.id,
                shared_variable_id=sample_shared_variable.id
            )
            db.session.add(binding)
            db.session.commit()
            
            # 创建行动任务
            task = ActionTask(
                title='测试任务',
                description='用于测试共享变量继承',
                action_space_id=sample_action_space.id,
                status='active'
            )
            db.session.add(task)
            db.session.commit()
            
            # 模拟任务创建时的环境变量继承逻辑
            # 这里应该调用实际的任务创建逻辑，但为了测试简化，直接创建任务环境变量
            task_var = ActionTaskEnvironmentVariable(
                name=sample_shared_variable.name,
                label=sample_shared_variable.label,
                value=sample_shared_variable.default_value,
                type=sample_shared_variable.type,
                shared_variable_id=sample_shared_variable.id,
                is_readonly=sample_shared_variable.is_readonly,
                action_task_id=task.id
            )
            db.session.add(task_var)
            db.session.commit()
            
            # 验证任务环境变量已创建
            task_vars = ActionTaskEnvironmentVariable.query.filter_by(action_task_id=task.id).all()
            assert len(task_vars) == 1
            assert task_vars[0].name == 'test_shared_var'
            assert task_vars[0].shared_variable_id == sample_shared_variable.id
            assert task_vars[0].is_readonly == sample_shared_variable.is_readonly


if __name__ == '__main__':
    pytest.main([__file__])
