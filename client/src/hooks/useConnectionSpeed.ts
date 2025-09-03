import { useState, useEffect } from 'react';

interface ConnectionInfo {
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
  saveData?: boolean;
}

export function useConnectionSpeed() {
  const [connectionInfo, setConnectionInfo] = useState<ConnectionInfo>({});
  const [isSlowConnection, setIsSlowConnection] = useState(false);

  useEffect(() => {
    // @ts-ignore - Navigator.connection is experimental but widely supported
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    
    if (connection) {
      const updateConnectionInfo = () => {
        const info: ConnectionInfo = {
          effectiveType: connection.effectiveType,
          downlink: connection.downlink,
          rtt: connection.rtt,
          saveData: connection.saveData
        };
        
        setConnectionInfo(info);
        
        // Determine if connection is slow
        const isSlow = 
          connection.effectiveType === 'slow-2g' ||
          connection.effectiveType === '2g' ||
          connection.downlink < 1 ||
          connection.rtt > 500 ||
          connection.saveData;
          
        setIsSlowConnection(isSlow);
      };
      
      updateConnectionInfo();
      connection.addEventListener('change', updateConnectionInfo);
      
      return () => {
        connection.removeEventListener('change', updateConnectionInfo);
      };
    } else {
      // Fallback detection based on user agent for older browsers
      const userAgent = navigator.userAgent.toLowerCase();
      const isMobile = /mobile|android|iphone|ipad/.test(userAgent);
      setIsSlowConnection(isMobile); // Assume mobile connections are potentially slower
    }
  }, []);

  return {
    connectionInfo,
    isSlowConnection,
    effectiveType: connectionInfo.effectiveType || 'unknown',
    downlink: connectionInfo.downlink || 0,
    rtt: connectionInfo.rtt || 0,
    saveData: connectionInfo.saveData || false
  };
}