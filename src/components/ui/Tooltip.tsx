'use client';

import { useState, ReactNode } from 'react';

interface TooltipProps {
  children: ReactNode;
  content: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

export default function Tooltip({ children, content, position = 'top' }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  
  const positionClasses = {
    top: 'bottom-full left-1/2 transform -translate-x-1/2 -translate-y-2 mb-1',
    bottom: 'top-full left-1/2 transform -translate-x-1/2 translate-y-2 mt-1',
    left: 'right-full top-1/2 transform -translate-y-1/2 -translate-x-2 mr-1',
    right: 'left-full top-1/2 transform -translate-y-1/2 translate-x-2 ml-1',
  };
  
  const arrowClasses = {
    top: 'bottom-[-4px] left-1/2 transform -translate-x-1/2 border-l-transparent border-r-transparent border-b-transparent',
    bottom: 'top-[-4px] left-1/2 transform -translate-x-1/2 border-l-transparent border-r-transparent border-t-transparent',
    left: 'right-[-4px] top-1/2 transform -translate-y-1/2 border-t-transparent border-b-transparent border-r-transparent',
    right: 'left-[-4px] top-1/2 transform -translate-y-1/2 border-t-transparent border-b-transparent border-l-transparent',
  };
  
  return (
    <div className="relative inline-block" onMouseEnter={() => setIsVisible(true)} onMouseLeave={() => setIsVisible(false)}>
      {children}
      
      {isVisible && (
        <div className={`absolute z-50 px-2 py-1 text-xs font-medium text-white bg-gray-800 rounded shadow-lg whitespace-nowrap ${positionClasses[position]}`}>
          {content}
          <div className={`absolute w-0 h-0 border-4 border-gray-800 ${arrowClasses[position]}`} />
        </div>
      )}
    </div>
  );
} 