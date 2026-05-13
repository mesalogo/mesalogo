import React, { useState, useEffect, useRef, createContext, useContext, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

/**
 * 任务窗口管理器 Context
 */
const TaskWindowContext = createContext(null);

export const useTaskWindow = () => {
  const context = useContext(TaskWindowContext);
  if (!context) {
    throw new Error('useTaskWindow must be used within TaskWindowProvider');
  }
  return context;
};

/**
 * 任务窗口管理器
 * 
 * 功能：管理多个任务详情页实例，类似浏览器的多标签页
 * 
 * 核心特性：
 * 1. 打开任务时，创建新的 ActionTaskDetail 实例
 * 2. 切换任务时，隐藏当前实例，显示目标实例
 * 3. 隐藏的实例继续运行（EventSource 保持活跃）
 * 4. 支持最多缓存 N 个任务（LRU 策略）
 */
export const TaskWindowManager = ({ 
  children,
  maxWindows = 5,
  renderTaskDetail 
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  
  const [windows, setWindows] = useState(new Map());
  const [activeTaskId, setActiveTaskId] = useState(null);
  const windowOrderRef = useRef([]);
  
  /**
   * 打开任务窗口
   */
  const openTaskWindow = (taskId, taskInfo = null) => {
    
    setWindows(prev => {
      const newMap = new Map(prev);
      
      if (!newMap.has(taskId)) {
        newMap.set(taskId, {
          taskId,
          taskInfo,
          createdAt: Date.now(),
          lastActiveAt: Date.now()
        });
        
        windowOrderRef.current = windowOrderRef.current.filter(id => id !== taskId);
        windowOrderRef.current.push(taskId);
        
        if (newMap.size > maxWindows) {
          const oldestId = windowOrderRef.current.shift();
          newMap.delete(oldestId);
        }
      } else {
        const window = newMap.get(taskId);
        window.lastActiveAt = Date.now();
        if (taskInfo) {
          window.taskInfo = taskInfo;
        }
        
        windowOrderRef.current = windowOrderRef.current.filter(id => id !== taskId);
        windowOrderRef.current.push(taskId);
      }
      
      return newMap;
    });
    
    setActiveTaskId(taskId);
    window.history.pushState({}, '', `/action-tasks/detail/${taskId}`);
  };
  
  /**
   * 更新任务信息（用于显示任务名称）
   */
  const updateTaskInfo = useCallback((taskId, taskInfo) => {
    setWindows(prev => {
      const newMap = new Map(prev);
      const window = newMap.get(taskId);
      if (window) {
        window.taskInfo = taskInfo;
      }
      return newMap;
    });
  }, []);
  
  /**
   * 关闭任务窗口
   */
  const closeTaskWindow = (taskId) => {
    setWindows(prev => {
      const newMap = new Map(prev);
      newMap.delete(taskId);
      return newMap;
    });
    
    windowOrderRef.current = windowOrderRef.current.filter(id => id !== taskId);
    
    if (taskId === activeTaskId) {
      if (windowOrderRef.current.length > 0) {
        const lastTaskId = windowOrderRef.current[windowOrderRef.current.length - 1];
        setActiveTaskId(lastTaskId);
        window.history.pushState({}, '', `/action-tasks/detail/${lastTaskId}`);
      } else {
        setActiveTaskId(null);
        navigate('/action-tasks/overview');
      }
    }
  };
  
  /**
   * 返回任务列表
   */
  const backToList = () => {
    setActiveTaskId(null);
    navigate('/action-tasks/overview');
  };
  
  /**
   * 清除所有窗口
   */
  const closeAllWindows = () => {
    setWindows(new Map());
    windowOrderRef.current = [];
    setActiveTaskId(null);
  };
  
  useEffect(() => {
    const match = location.pathname.match(/\/action-tasks\/detail\/([^/]+)/);
    if (match) {
      const taskId = match[1];
      openTaskWindow(taskId);
    } else {
      if (activeTaskId) {
        setActiveTaskId(null);
      }
    }
  }, [location.pathname]);
  
  useEffect(() => {
    const handlePopState = () => {
      const match = location.pathname.match(/\/action-tasks\/detail\/([^/]+)/);
      if (match) {
        const taskId = match[1];
        setActiveTaskId(taskId);
      } else if (location.pathname === '/action-tasks/overview') {
        setActiveTaskId(null);
      }
    };
    
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [location, windows]);
  
  const contextValue = {
    windows,
    activeTaskId,
    openTaskWindow,
    updateTaskInfo,
    closeTaskWindow,
    backToList,
    closeAllWindows
  };
  
  return (
    <TaskWindowContext.Provider value={contextValue}>
      {/* 如果没有活跃窗口，显示主内容（任务列表等） */}
      {!activeTaskId && children}
      
      {/* 所有任务窗口实例 */}
      {Array.from(windows.entries()).map(([taskId, window]) => {
        const isActive = taskId === activeTaskId;
        
        return (
          <div
            key={taskId}
            style={{
              display: isActive ? 'block' : 'none',
              height: '100vh-1px',
              width: '100%',
              position: isActive ? 'relative' : 'absolute',
              top: 0,
              left: 0,
              overflow: 'hidden'
            }}
            data-task-window={taskId}
            data-active={isActive}
          >
            {renderTaskDetail(taskId)}
          </div>
        );
      })}
      

    </TaskWindowContext.Provider>
  );
};

export default TaskWindowManager;
