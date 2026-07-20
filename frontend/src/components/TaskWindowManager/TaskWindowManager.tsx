import React, {
  useState,
  useEffect,
  useRef,
  createContext,
  useContext,
  useCallback,
  useMemo,
} from 'react';
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
  const windowOrderRef = useRef([]);

  const activeTaskId = useMemo(() => {
    const match = location.pathname.match(/^\/action-tasks\/detail\/([^/]+)$/);
    return match ? decodeURIComponent(match[1]) : null;
  }, [location.pathname]);

  const ensureTaskWindow = useCallback((taskId, taskInfo = null) => {
    setWindows(prev => {
      const newMap = new Map(prev);
      const existingWindow = newMap.get(taskId);
      const windowLimit = Math.max(1, maxWindows);

      newMap.set(taskId, {
        taskId,
        taskInfo: taskInfo || existingWindow?.taskInfo || null,
        createdAt: existingWindow?.createdAt || Date.now(),
        lastActiveAt: Date.now()
      });

      windowOrderRef.current = windowOrderRef.current.filter(id => id !== taskId);
      windowOrderRef.current.push(taskId);

      while (newMap.size > windowLimit) {
        const oldestId = windowOrderRef.current.shift();
        if (oldestId !== undefined) {
          newMap.delete(oldestId);
        }
      }

      return newMap;
    });
  }, [maxWindows]);

  /**
   * 打开任务窗口
   */
  const openTaskWindow = useCallback((taskId, taskInfo = null) => {
    const normalizedTaskId = String(taskId);
    ensureTaskWindow(normalizedTaskId, taskInfo);
    navigate(`/action-tasks/detail/${encodeURIComponent(normalizedTaskId)}`);
  }, [ensureTaskWindow, navigate]);
  
  /**
   * 更新任务信息（用于显示任务名称）
   */
  const updateTaskInfo = useCallback((taskId, taskInfo) => {
    setWindows(prev => {
      const newMap = new Map(prev);
      const taskWindow = newMap.get(taskId);
      if (taskWindow) {
        newMap.set(taskId, {
          ...taskWindow,
          taskInfo
        });
      }
      return newMap;
    });
  }, []);
  
  /**
   * 关闭任务窗口
   */
  const closeTaskWindow = useCallback((taskId) => {
    const remainingOrder = windowOrderRef.current.filter(id => id !== taskId);

    setWindows(prev => {
      const newMap = new Map(prev);
      newMap.delete(taskId);
      return newMap;
    });
    
    windowOrderRef.current = remainingOrder;
    
    if (taskId === activeTaskId) {
      if (remainingOrder.length > 0) {
        const lastTaskId = remainingOrder[remainingOrder.length - 1];
        navigate(`/action-tasks/detail/${encodeURIComponent(lastTaskId)}`);
      } else {
        navigate('/action-tasks/overview');
      }
    }
  }, [activeTaskId, navigate]);
  
  /**
   * 返回任务列表
   */
  const backToList = useCallback(() => {
    navigate('/action-tasks/overview');
  }, [navigate]);
  
  /**
   * 清除所有窗口
   */
  const closeAllWindows = useCallback(() => {
    setWindows(new Map());
    windowOrderRef.current = [];
    if (activeTaskId) {
      navigate('/action-tasks/overview');
    }
  }, [activeTaskId, navigate]);
  
  useEffect(() => {
    if (activeTaskId) {
      ensureTaskWindow(activeTaskId);
    }
  }, [activeTaskId, ensureTaskWindow]);
  
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
              height: 'calc(100vh - 1px)',
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
