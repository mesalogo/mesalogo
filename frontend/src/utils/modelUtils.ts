/**
 * 模型工具函数
 */

/**
 * 获取用于辅助生成的模型ID
 * @param {Array} models - 模型列表
 * @param {string} assistantGenerationModel - 系统设置中的辅助生成模型配置
 * @returns {Promise<number|null>} 模型ID
 */
export const getAssistantGenerationModelId = async (models, assistantGenerationModel) => {
  if (assistantGenerationModel !== 'default') {
    // 如果指定了具体的模型ID，直接返回
    return assistantGenerationModel;
  }

  // 使用默认文本生成模型
  let defaultModel = models.find(m => m.is_default_text);
  
  if (!defaultModel) {
    // 如果没有找到默认文本生成模型，尝试从API获取
    console.warn('未在模型列表中找到默认文本生成模型，尝试从API获取...');
    try {
      const defaultsResponse = await fetch('/api/model-configs/defaults');
      if (defaultsResponse.ok) {
        const defaults = await defaultsResponse.json();
        const textModelId = defaults.text_model?.id;
        if (textModelId) {
          defaultModel = models.find(m => m.id === textModelId);
          console.log('从API获取到默认文本模型ID:', textModelId);
        }
      }
    } catch (error) {
      console.error('获取默认模型配置失败:', error);
    }
  }
  
  if (!defaultModel) {
    // 查找包含text_output模态的模型
    defaultModel = models.find(m => m.modalities && m.modalities.includes('text_output'));
  }
  
  if (!defaultModel && models.length > 0) {
    // 最后的备选方案：使用第一个模型，但要记录警告
    defaultModel = models[0];
    console.warn('未找到合适的默认模型，使用第一个可用模型:', defaultModel.name);
  }
  
  if (defaultModel) {
    console.log('辅助生成使用模型:', defaultModel.name, '(ID:', defaultModel.id, ')');
    return defaultModel.id;
  } else {
    throw new Error('未找到可用的模型');
  }
};
