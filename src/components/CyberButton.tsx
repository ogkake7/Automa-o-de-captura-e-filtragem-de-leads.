import React from 'react';
import { cn } from '../lib/utils';

interface CyberButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
  glow?: boolean;
}

export const CyberButton = React.forwardRef<HTMLButtonElement, CyberButtonProps>(
  ({ className, variant = 'primary', glow = true, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "px-4 py-2 rounded-md font-mono transition-all duration-200 border outline-none disabled:opacity-50 disabled:cursor-not-allowed",
          variant === 'primary' && "bg-cyber-green/10 border-cyber-green text-cyber-green hover:bg-cyber-green/20 focus:ring-1 focus:ring-cyber-green",
          variant === 'primary' && glow && "hover:shadow-[0_0_15px_rgba(0,255,157,0.4)]",
          variant === 'secondary' && "bg-cyber-cyan/10 border-cyber-cyan text-cyber-cyan hover:bg-cyber-cyan/20 focus:ring-1 focus:ring-cyber-cyan",
          variant === 'secondary' && glow && "hover:shadow-[0_0_15px_rgba(0,229,255,0.4)]",
          variant === 'danger' && "bg-cyber-red/10 border-cyber-red text-cyber-red hover:bg-cyber-red/20 focus:ring-1 focus:ring-cyber-red",
          variant === 'danger' && glow && "hover:shadow-[0_0_15px_rgba(255,51,102,0.4)]",
          className
        )}
        {...props}
      />
    );
  }
);
CyberButton.displayName = "CyberButton";
