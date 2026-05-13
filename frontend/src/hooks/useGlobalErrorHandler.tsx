import { useEffect } from 'react';
import { App } from 'antd';
import { useTranslation } from 'react-i18next';

export const useGlobalErrorHandler = () => {
  const { message } = App.useApp();
  const { t } = useTranslation();
  
  useEffect(() => {
    const handleUnhandledRejection = (event) => {
      const error = event.reason;
      
      if (error && error.isLicenseError) {
        console.log('Global error handler: license error caught, handled by axios interceptor');
        event.preventDefault();
        return;
      }
      
      if (error && error.handled) {
        console.log('Global error handler: handled error caught, skipping');
        event.preventDefault();
        return;
      }
      
      console.error('Global error handler: unhandled Promise rejection:', error);
      
      if (error && error.message) {
        if (error.message.includes('网络') || error.message.includes('连接') || error.message.includes('network')) {
          message.error(t('error.networkError'));
        } else if (error.message.includes('超时') || error.message.includes('timeout')) {
          message.error(t('error.timeout'));
        } else {
          message.error(`${t('error.unknown')}: ${error.message}`);
        }
      } else {
        message.error(t('error.unknown'));
      }
      
      event.preventDefault();
    };
    
    const handleError = (event) => {
      if (!event.error) {
        return;
      }
      
      if (event.message && event.message.includes('ResizeObserver loop')) {
        event.preventDefault();
        return;
      }
      
      console.error('Global error handler: uncaught JavaScript error:', event.error);
      
      if (event.error && event.error.isLicenseError) {
        console.log('Global error handler: JavaScript license error handled');
        event.preventDefault();
        return;
      }
      
      message.error(t('error.pageError'));
      event.preventDefault();
    };
    
    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    window.addEventListener('error', handleError);
    
    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      window.removeEventListener('error', handleError);
    };
  }, [message, t]);
};

export default useGlobalErrorHandler;
