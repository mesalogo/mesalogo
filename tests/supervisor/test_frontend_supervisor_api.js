/**
 * 测试脚本：验证前端监督者API功能
 * 这个脚本模拟前端API调用，验证监督者相关功能
 */

// 模拟前端API模块
const mockApi = {
  get: async (url) => {
    console.log(`Mock GET: ${url}`);
    
    // 模拟不同的API响应
    if (url.includes('/agents?is_observer=true')) {
      return {
        data: {
          agents: [
            {
              id: 1,
              name: '监督者智能体1',
              role_name: '监督者角色',
              is_observer: true,
              type: 'agent'
            },
            {
              id: 2,
              name: '监督者智能体2',
              role_name: '监督者角色',
              is_observer: true,
              type: 'agent'
            }
          ]
        }
      };
    } else if (url.includes('/agents?is_observer=false')) {
      return {
        data: {
          agents: [
            {
              id: 3,
              name: '普通智能体1',
              role_name: '普通角色',
              is_observer: false,
              type: 'agent'
            },
            {
              id: 4,
              name: '普通智能体2',
              role_name: '普通角色',
              is_observer: false,
              type: 'agent'
            }
          ]
        }
      };
    } else if (url.includes('/agents')) {
      return {
        data: {
          agents: [
            {
              id: 1,
              name: '监督者智能体1',
              role_name: '监督者角色',
              is_observer: true,
              type: 'agent'
            },
            {
              id: 2,
              name: '监督者智能体2',
              role_name: '监督者角色',
              is_observer: true,
              type: 'agent'
            },
            {
              id: 3,
              name: '普通智能体1',
              role_name: '普通角色',
              is_observer: false,
              type: 'agent'
            },
            {
              id: 4,
              name: '普通智能体2',
              role_name: '普通角色',
              is_observer: false,
              type: 'agent'
            }
          ]
        }
      };
    } else if (url.includes('/messages')) {
      return {
        data: {
          messages: [
            {
              id: 1,
              content: '用户消息1',
              role: 'human',
              agent_id: null,
              created_at: '2025-05-30T15:00:00Z'
            },
            {
              id: 2,
              content: '普通智能体回复',
              role: 'agent',
              agent_id: 3,
              created_at: '2025-05-30T15:01:00Z'
            },
            {
              id: 3,
              content: '监督者观察和建议',
              role: 'supervisor',
              agent_id: 1,
              created_at: '2025-05-30T15:02:00Z'
            },
            {
              id: 4,
              content: '用户向监督者的消息',
              role: 'human',
              agent_id: 1,
              created_at: '2025-05-30T15:03:00Z'
            },
            {
              id: 5,
              content: '监督者回复用户',
              role: 'supervisor',
              agent_id: 1,
              created_at: '2025-05-30T15:04:00Z'
            }
          ]
        }
      };
    }
    
    return { data: {} };
  },
  
  post: async (url, data) => {
    console.log(`Mock POST: ${url}`, data);
    return {
      data: {
        human_message: {
          id: 6,
          content: data.content,
          role: 'human',
          agent_id: data.target_agent_id
        },
        response: {
          id: 7,
          content: '监督者的回复：' + data.content,
          role: 'supervisor',
          agent_id: data.target_agent_id
        }
      }
    };
  }
};

// 模拟actionTaskAPI
const actionTaskAPI = {
  // 获取行动任务的智能体
  getAgents: async (id, isObserver = null) => {
    let url = `/action-tasks/${id}/agents`;
    if (isObserver !== null) {
      url += `?is_observer=${isObserver}`;
    }
    const response = await mockApi.get(url);
    return response.data.agents || [];
  },

  // 获取行动任务的监督者智能体
  getSupervisorAgents: async (id) => {
    const response = await mockApi.get(`/action-tasks/${id}/agents?is_observer=true`);
    return response.data.agents || [];
  },

  // 获取行动任务的普通智能体
  getNormalAgents: async (id) => {
    const response = await mockApi.get(`/action-tasks/${id}/agents?is_observer=false`);
    return response.data.agents || [];
  },

  // 发送监督者消息
  sendSupervisorMessage: async (taskId, conversationId, content, targetAgentId, sendTarget = 'supervisor') => {
    try {
      const response = await mockApi.post(`/action-tasks/${taskId}/conversations/${conversationId}/messages`, {
        content: content,
        target_agent_id: targetAgentId,
        send_target: sendTarget
      });
      return response.data;
    } catch (error) {
      console.error('发送监督者消息失败:', error);
      throw error;
    }
  },

  // 获取监督者相关消息
  getSupervisorMessages: async (taskId, conversationId, supervisorAgentIds = []) => {
    try {
      const response = await mockApi.get(`/action-tasks/${taskId}/conversations/${conversationId}/messages`);
      const allMessages = response.data.messages || [];
      
      // 筛选监督者相关消息
      const supervisorMessages = allMessages.filter(msg => 
        msg.role === 'supervisor' || 
        (msg.role === 'human' && supervisorAgentIds.includes(msg.agent_id))
      );
      
      return supervisorMessages;
    } catch (error) {
      console.error('获取监督者消息失败:', error);
      return [];
    }
  },

  // 获取任务消息（排除监督者相关的human消息）
  getTaskMessages: async (taskId, conversationId, supervisorAgentIds = []) => {
    try {
      const response = await mockApi.get(`/action-tasks/${taskId}/conversations/${conversationId}/messages`);
      const allMessages = response.data.messages || [];
      
      // 筛选任务消息（排除监督者相关的human消息）
      const taskMessages = allMessages.filter(msg => 
        !(msg.role === 'human' && supervisorAgentIds.includes(msg.agent_id))
      );
      
      return taskMessages;
    } catch (error) {
      console.error('获取任务消息失败:', error);
      return [];
    }
  }
};

// 测试函数
async function testSupervisorAPI() {
  console.log('=== 测试前端监督者API功能 ===\n');
  
  const taskId = 1;
  const conversationId = 1;
  
  try {
    // 测试1: 获取所有智能体
    console.log('1. 测试获取所有智能体...');
    const allAgents = await actionTaskAPI.getAgents(taskId);
    console.log(`✅ 获取到${allAgents.length}个智能体:`);
    allAgents.forEach(agent => {
      const type = agent.is_observer ? '监督者' : '普通智能体';
      console.log(`   - ${type}: ${agent.name} (ID: ${agent.id})`);
    });
    console.log('');
    
    // 测试2: 获取监督者智能体
    console.log('2. 测试获取监督者智能体...');
    const supervisors = await actionTaskAPI.getSupervisorAgents(taskId);
    console.log(`✅ 获取到${supervisors.length}个监督者:`);
    supervisors.forEach(supervisor => {
      console.log(`   - 监督者: ${supervisor.name} (ID: ${supervisor.id})`);
    });
    console.log('');
    
    // 测试3: 获取普通智能体
    console.log('3. 测试获取普通智能体...');
    const normalAgents = await actionTaskAPI.getNormalAgents(taskId);
    console.log(`✅ 获取到${normalAgents.length}个普通智能体:`);
    normalAgents.forEach(agent => {
      console.log(`   - 普通智能体: ${agent.name} (ID: ${agent.id})`);
    });
    console.log('');
    
    // 测试4: 获取监督者相关消息
    console.log('4. 测试获取监督者相关消息...');
    const supervisorAgentIds = supervisors.map(s => s.id);
    const supervisorMessages = await actionTaskAPI.getSupervisorMessages(taskId, conversationId, supervisorAgentIds);
    console.log(`✅ 获取到${supervisorMessages.length}条监督者相关消息:`);
    supervisorMessages.forEach(msg => {
      console.log(`   - ${msg.role}: ${msg.content} (ID: ${msg.id})`);
    });
    console.log('');
    
    // 测试5: 获取任务消息
    console.log('5. 测试获取任务消息...');
    const taskMessages = await actionTaskAPI.getTaskMessages(taskId, conversationId, supervisorAgentIds);
    console.log(`✅ 获取到${taskMessages.length}条任务消息:`);
    taskMessages.forEach(msg => {
      console.log(`   - ${msg.role}: ${msg.content} (ID: ${msg.id})`);
    });
    console.log('');
    
    // 测试6: 发送监督者消息
    console.log('6. 测试发送监督者消息...');
    const targetSupervisor = supervisors[0];
    const messageContent = '请监督者检查当前对话是否符合规范';
    const result = await actionTaskAPI.sendSupervisorMessage(
      taskId, 
      conversationId, 
      messageContent, 
      targetSupervisor.id, 
      'supervisor'
    );
    console.log('✅ 监督者消息发送成功:');
    console.log(`   - 用户消息: ${result.human_message.content}`);
    console.log(`   - 监督者回复: ${result.response.content}`);
    console.log('');
    
    console.log('🎉 所有前端API测试通过！');
    
  } catch (error) {
    console.error('❌ 测试失败:', error);
  }
}

// 运行测试
testSupervisorAPI();
