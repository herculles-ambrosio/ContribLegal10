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
    
    // Verificar user agent para dispositivos móveis
    const isMobileUserAgent = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile|tablet/i.test(userAgent);
    
    // Verificar também a largura da tela (geralmente abaixo de 768px para dispositivos móveis)
    const isMobileScreenSize = window.innerWidth <= 768;
    
    // Considerar dispositivo móvel se o user agent indicar ou a tela for pequena
    const isMobileDevice = isMobileUserAgent || isMobileScreenSize;
    
    const isIOSDevice = /iphone|ipad|ipod/i.test(userAgent);
    const isAndroidDevice = /android/i.test(userAgent);

    setDeviceInfo({
      isMobile: isMobileDevice,
      isIOS: isIOSDevice,
      isAndroid: isAndroidDevice
    });
    
    // Adicionar listener para redimensionamento de janela
    const handleResize = () => {
      const newIsMobileScreenSize = window.innerWidth <= 768;
      setDeviceInfo(prev => ({
        ...prev,
        isMobile: isMobileUserAgent || newIsMobileScreenSize
      }));
    };
    
    window.addEventListener('resize', handleResize);
    
    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return deviceInfo;
} 