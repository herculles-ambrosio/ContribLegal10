import { InputHTMLAttributes, forwardRef } from 'react';
import { IconType } from 'react-icons';

type InputProps = {
  label?: string;
  error?: string;
  icon?: IconType;
  fullWidth?: boolean;
} & InputHTMLAttributes<HTMLInputElement>;

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, icon: Icon, fullWidth = false, className = '', ...props }, ref) => {
    const inputClasses = `
      block px-4 py-2 border rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 
      ${error ? 'border-red-500' : 'border-gray-300'} 
      ${fullWidth ? 'w-full' : ''}
      ${className}
    `;

    return (
      <div className={`mb-4 ${fullWidth ? 'w-full' : ''}`}>
        {label && (
          <label htmlFor={props.id} className="block mb-2 text-sm font-medium text-gray-700">
            {label}
          </label>
        )}
        
        <div className="relative">
          {Icon && (
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Icon className="h-5 w-5 text-gray-400" />
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