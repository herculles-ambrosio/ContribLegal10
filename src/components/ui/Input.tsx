import { InputHTMLAttributes, forwardRef } from 'react';
import { IconType } from 'react-icons';

type InputProps = {
  label?: string;
  error?: string;
  icon?: IconType;
  fullWidth?: boolean;
  variant?: 'light' | 'dark';
} & InputHTMLAttributes<HTMLInputElement>;

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ 
    label, 
    error, 
    icon: Icon, 
    fullWidth = false, 
    variant = 'light',
    className = '', 
    ...props 
  }, ref) => {
    const isDark = variant === 'dark';
    
    const inputClasses = `
      block w-full px-4 py-3 rounded-lg shadow-sm focus:outline-none focus:ring-2 
      transition-all duration-200 ease-in-out
      ${isDark 
        ? 'bg-blue-900/30 border-blue-400/30 text-white placeholder-blue-200/60 focus:ring-blue-400 focus:border-blue-300' 
        : 'bg-white border-gray-300 text-gray-700 focus:ring-blue-500 focus:border-blue-500'
      }
      ${error ? 'border-red-500' : 'border'}
      ${fullWidth ? 'w-full' : ''}
      ${className}
    `;

    const labelClasses = `block mb-2 text-sm font-medium ${
      isDark ? 'text-blue-100' : 'text-gray-700'
    }`;

    const iconClasses = `h-5 w-5 ${
      isDark ? 'text-blue-300' : 'text-gray-400'
    }`;

    return (
      <div className={`mb-4 ${fullWidth ? 'w-full' : ''}`}>
        {label && (
          <label htmlFor={props.id} className={labelClasses}>
            {label}
          </label>
        )}
        
        <div className="relative">
          {Icon && (
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Icon className={iconClasses} />
            </div>
          )}
          
          <input
            ref={ref}
            className={`${inputClasses} ${Icon ? 'pl-10' : ''}`}
            {...props}
          />
        </div>
        
        {error && (
          <p className="mt-2 text-sm text-red-600">{error}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export default Input; 