import { HTMLAttributes, ReactNode } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  title?: string;
  footer?: ReactNode;
  variant?: 'default' | 'blue-gradient';
}

export default function Card({ 
  children, 
  title, 
  footer, 
  variant = 'default',
  className = '', 
  ...props 
}: CardProps) {
  const bgClass = variant === 'blue-gradient' 
    ? 'bg-gradient-blue text-white'
    : 'bg-white';
  
  return (
    <div 
      className={`${bgClass} rounded-lg shadow-lg overflow-hidden ${className}`}
      {...props}
    >
      {title && (
        <div className={`px-6 py-4 ${variant === 'blue-gradient' ? 'border-b border-blue-400/30' : 'border-b border-gray-200'}`}>
          <h3 className={`text-lg font-medium ${variant === 'blue-gradient' ? 'text-white' : 'text-gray-900'}`}>{title}</h3>
        </div>
      )}
      
      <div className="px-6 py-4">
        {children}
      </div>
      
      {footer && (
        <div className={`px-6 py-4 ${variant === 'blue-gradient' ? 'bg-blue-900/20 border-t border-blue-400/30' : 'bg-gray-50 border-t border-gray-200'}`}>
          {footer}
        </div>
      )}
    </div>
  );
} 