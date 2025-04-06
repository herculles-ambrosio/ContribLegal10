'use client';

import { useState, useEffect } from 'react';

interface DeviceInfo {
  isMobile: boolean;
  isIOS: boolean;
  isAndroid: boolean;
}

export default function useDeviceDetect(): DeviceInfo {
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo>({
    isMobile: false,
    isIOS: false,
    isAndroid: false
  });

  useEffect(() => {
    // Somente executar no navegador
    if (typeof window === 'undefined') return;

    const userAgent = navigator.userAgent.toLowerCase();
    
    const isMobileDevice = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile|tablet/i.test(userAgent);
    const isIOSDevice = /iphone|ipad|ipod/i.test(userAgent);
    const isAndroidDevice = /android/i.test(userAgent);

    setDeviceInfo({
      isMobile: isMobileDevice,
      isIOS: isIOSDevice,
      isAndroid: isAndroidDevice
    });
  }, []);

  return deviceInfo;
} 