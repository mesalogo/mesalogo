import { useState, useEffect, useCallback, useRef } from 'react';
import jobsAPI from '../services/api/jobs';

interface JobPollingOptions {
  interval?: number;
  enabled?: boolean;
  onCompleted?: (data: any) => void;
  onFailed?: (data: any) => void;
  onProgress?: (data: any) => void;
}

export const useJobPolling = (jobId: any, options: JobPollingOptions = {}) => {
  const {
    interval = 5000, // 默认5秒，降低轮询频率
    enabled = true,
    onCompleted,
    onFailed,
    onProgress,
  } = options;

  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const intervalRef = useRef(null);
  const mountedRef = useRef(true);
  
  // 使用ref存储回调，避免依赖变化导致重新创建interval
  const callbacksRef = useRef({ onCompleted, onFailed, onProgress });
  
  // 更新回调ref
  useEffect(() => {
    callbacksRef.current = { onCompleted, onFailed, onProgress };
  }, [onCompleted, onFailed, onProgress]);

  const fetchJob = useCallback(async () => {
    if (!jobId) return;

    try {
      const data = await jobsAPI.getJobStatus(jobId);
      
      if (!mountedRef.current) return;
      
      setJob(data);
      setError(null);
      setLoading(false);

      if (callbacksRef.current.onProgress) {
        callbacksRef.current.onProgress(data);
      }

      if (data.status === 'completed') {
        if (intervalRef.current) clearInterval(intervalRef.current);
        if (callbacksRef.current.onCompleted) callbacksRef.current.onCompleted(data);
      } else if (data.status === 'failed' || data.status === 'cancelled') {
        if (intervalRef.current) clearInterval(intervalRef.current);
        if (callbacksRef.current.onFailed) callbacksRef.current.onFailed(data);
      }
      
    } catch (err) {
      console.error('获取后台任务状态失败:', err);
      if (!mountedRef.current) return;
      setError(err);
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    mountedRef.current = true;
    
    if (!jobId || !enabled) {
      setLoading(false);
      return;
    }

    // 首次加载
    fetchJob();
    
    // 只有任务运行中时才启动轮询
    // 如果任务已完成/失败，fetchJob会在第一次请求后清除interval
    intervalRef.current = setInterval(fetchJob, interval);

    return () => {
      mountedRef.current = false;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [jobId, enabled, interval, fetchJob]);

  const refresh = useCallback(() => {
    fetchJob();
  }, [fetchJob]);

  return {
    job,
    loading,
    error,
    refresh,
    progress: job?.progress || 0,
    status: job?.status || 'pending',
    message: job?.message || '',
    isRunning: ['running', 'pending', 'retrying'].includes(job?.status),
    isCompleted: job?.status === 'completed',
    isFailed: job?.status === 'failed',
  };
};
