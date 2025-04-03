import { ButtonHTMLAttributes } from 'react';
import { IconType } from 'react-icons';

type ButtonVariant = 'primary' | 'secondary' | 'success' | 'danger' | 'warning' | 'info';

type ButtonProps = {
  variant?: ButtonVariant;
  icon?: IconType;
  isLoading?: boolean;
  fullWidth?: boolean;
} & ButtonHTMLAttributes<HTMLButtonElement>;

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-blue-600 hover:bg-blue-700 text-white',
  secondary: 'bg-gray-600 hover:bg-gray-700 text-white',
  success: 'bg-green-600 hover:bg-green-700 text-white',
  danger: 'bg-red-600 hover:bg-red-700 text-white',
  warning: 'bg-yellow-500 hover:bg-yellow-600 text-white',
  info: 'bg-cyan-500 hover:bg-cyan-600 text-white'
};

export default function Button({
  variant = 'primary',
  icon: Icon,
  isLoading = false,
  fullWidth = false,
  className = '',
  children,
  ...props
}: ButtonProps) {
  const baseClasses = "font-medium py-2 px-4 rounded focus:outline-none focus:ring-2 focus:ring-offset-2 transition-all";
  const widthClass = fullWidth ? 'w-full' : '';
  const variantClass = variantClasses[variant];
  const combinedClasses = `${baseClasses} ${variantClass} ${widthClass} ${className}`;
  
  return (
    <button 
      className={combinedClasses} 
      disabled={isLoading || props.disabled}
      {...props}
    >
      <div className="flex items-center justify-center space-x-2">
        {isLoading ? (
          <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
            <circle 
              className="opacity-25" 
              cx="12" 
              cy="12" 
              r="10" 
              stroke="currentColor" 
              strokeWidth="4"
              fill="none"
            />
            <path 
              className="opacity-75" 
              fill="currentColor" 
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        ) : Icon ? (
          <Icon className="h-5 w-5" />
        ) : null}
        {children && <span>{children}</span>}
      </div>
    </button>
  );
} 