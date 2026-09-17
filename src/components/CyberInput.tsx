import React from 'react';
import { cn } from '../lib/utils';

interface CyberInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export const CyberInput = React.forwardRef<HTMLInputElement, CyberInputProps>(
  ({ className, label, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1 w-full">
        {label && <label className="text-sm text-cyber-cyan/80 uppercase tracking-wider">{label}</label>}
        <input
          ref={ref}
          className={cn(
            "w-full bg-cyber-bg border border-cyber-cyan/30 text-white px-3 py-2 rounded-md",
            "focus:outline-none focus:border-cyber-cyan focus:shadow-[0_0_10px_rgba(0,229,255,0.3)] transition-all",
            "placeholder:text-gray-600",
            className
          )}
          {...props}
        />
      </div>
    );
  }
);
CyberInput.displayName = "CyberInput";
