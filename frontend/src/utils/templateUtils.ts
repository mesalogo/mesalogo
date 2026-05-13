/**
 * 模板变量替换工具函数
 * 支持Jinja2风格的变量替换 {{variable}}
 */

/**
 * 替换模板中的变量
 * @param {string} template - 包含变量的模板字符串
 * @param {Object} variables - 变量对象，键为变量名，值为替换值
 * @returns {string} 替换后的字符串
 */
export const replaceTemplateVariables = (template, variables) => {
  if (!template || typeof template !== 'string') {
    return template;
  }

  let result = template;

  // 替换所有 {{variable}} 格式的变量
  Object.keys(variables).forEach(key => {
    const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
    const value = variables[key] || '';
    result = result.replace(regex, value);
  });

  return result;
};

/**
 * 从模板中提取所有变量名
 * @param {string} template - 模板字符串
 * @returns {Array<string>} 变量名数组
 */
export const extractTemplateVariables = (template) => {
  if (!template || typeof template !== 'string') {
    return [];
  }

  const regex = /\{\{\s*(\w+)\s*\}\}/g;
  const variables = [];
  let match;

  while ((match = regex.exec(template)) !== null) {
    const variable = match[1];
    if (!variables.includes(variable)) {
      variables.push(variable);
    }
  }

  return variables;
};

/**
 * 验证模板变量是否都有对应的值
 * @param {string} template - 模板字符串
 * @param {Object} variables - 变量对象
 * @returns {Object} 验证结果 {isValid: boolean, missingVariables: Array<string>}
 */
export const validateTemplateVariables = (template, variables) => {
  const requiredVariables = extractTemplateVariables(template);
  const missingVariables = requiredVariables.filter(variable =>
    variables[variable] === undefined || variables[variable] === null || variables[variable] === ''
  );

  return {
    isValid: missingVariables.length === 0,
    missingVariables
  };
};

/**
 * 格式化角色列表为字符串
 * @param {Array} roles - 角色数组
 * @returns {string} 格式化后的角色字符串
 */
export const formatRolesForTemplate = (roles) => {
  if (!Array.isArray(roles) || roles.length === 0) {
    return '无';
  }

  return roles.map(role => role.name || role).join('、');
};

/**
 * 格式化环境变量为模板变量对象
 * @param {Array} internalVars - 内部环境变量数组
 * @param {Array} externalVars - 外部环境变量数组
 * @returns {Object} 变量对象，键为变量名，值为变量值
 */
export const formatEnvironmentVariables = (internalVars = [], externalVars = []) => {
  const variables = {};

  // 处理内部环境变量
  internalVars.forEach(variable => {
    if (variable.name && variable.value !== undefined) {
      variables[variable.name] = variable.value;
    }
  });

  // 处理外部环境变量
  externalVars.forEach(variable => {
    if (variable.name && variable.value !== undefined) {
      variables[variable.name] = variable.value;
    }
  });

  return variables;
};

/**
 * 获取模板中使用的变量及其描述信息
 * @param {string} template - 模板字符串
 * @param {Array} internalVars - 内部环境变量数组
 * @param {Array} externalVars - 外部环境变量数组
 * @returns {Array} 变量信息数组
 */
export const getTemplateVariableInfo = (template, internalVars = [], externalVars = []) => {
  const usedVariables = extractTemplateVariables(template);
  const variableInfo = [];

  usedVariables.forEach(varName => {
    // 查找内部变量
    const internalVar = internalVars.find(v => v.name === varName);
    if (internalVar) {
      variableInfo.push({
        name: varName,
        type: 'internal',
        label: internalVar.label || varName,
        description: internalVar.description || '',
        value: internalVar.value || '',
        source: '内部变量'
      });
      return;
    }

    // 查找外部变量
    const externalVar = externalVars.find(v => v.name === varName);
    if (externalVar) {
      variableInfo.push({
        name: varName,
        type: 'external',
        label: externalVar.label || varName,
        description: externalVar.description || '',
        value: externalVar.value || '',
        source: '外部变量'
      });
      return;
    }

    // 未找到的变量
    variableInfo.push({
      name: varName,
      type: 'unknown',
      label: varName,
      description: '未定义的变量',
      value: '',
      source: '未知'
    });
  });

  return variableInfo;
};

const templateUtils = {
  replaceTemplateVariables,
  extractTemplateVariables,
  validateTemplateVariables,
  formatRolesForTemplate,
  formatEnvironmentVariables,
  getTemplateVariableInfo
};

export default templateUtils;
