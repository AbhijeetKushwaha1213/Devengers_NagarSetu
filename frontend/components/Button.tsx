
import React from 'react';
import { cn } from '@/lib/utils';
import { BaseComponentProps, LoadingState } from '@/types';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'destructive';
type ButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

interface ButtonProps extends 
  React.ButtonHTMLAttributes<HTMLButtonElement>, 
  BaseComponentProps,
  Partial<LoadingState> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({
  className,
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  fullWidth = false,
  disabled,
  ...props
}, ref) => {
  const baseStyles = [
    "inline-flex items-center justify-center font-medium",
    "transition-all duration-200 ease-in-out",
    "focus:outline-none focus:ring-2 focus:ring-offset-2",
    "disabled:opacity-50 disabled:pointer-events-none disabled:cursor-not-allowed",
    "rounded-lg border",
    "select-none"
  ].join(" ");
  
  const variants: Record<ButtonVariant, string> = {
    primary: [
      "bg-blue-600 text-white border-blue-600",
      "hover:bg-blue-700 hover:border-blue-700",
      "focus:ring-blue-500",
      "active:bg-blue-800"
    ].join(" "),
    
    secondary: [
      "bg-gray-100 text-gray-900 border-gray-300",
      "hover:bg-gray-200 hover:border-gray-400",
      "focus:ring-gray-500",
      "active:bg-gray-300"
    ].join(" "),
    
    ghost: [
      "bg-transparent text-gray-700 border-transparent",
      "hover:bg-gray-100 hover:text-gray-900",
      "focus:ring-gray-500",
      "active:bg-gray-200"
    ].join(" "),
    
    outline: [
      "bg-transparent text-gray-700 border-gray-300",
      "hover:bg-gray-50 hover:text-gray-900 hover:border-gray-400",
      "focus:ring-gray-500",
      "active:bg-gray-100"
    ].join(" "),
    
    destructive: [
      "bg-red-600 text-white border-red-600",
      "hover:bg-red-700 hover:border-red-700",
      "focus:ring-red-500",
      "active:bg-red-800"
    ].join(" ")
  };
  
  const sizes: Record<ButtonSize, string> = {
    xs: "text-xs h-7 px-2 gap-1",
    sm: "text-sm h-8 px-3 gap-1.5",
    md: "text-sm h-10 px-4 gap-2",
    lg: "text-base h-11 px-6 gap-2",
    xl: "text-lg h-12 px-8 gap-2.5"
  };

  const iconSize = {
    xs: "h-3 w-3",
    sm: "h-3.5 w-3.5", 
    md: "h-4 w-4",
    lg: "h-4 w-4",
    xl: "h-5 w-5"
  }[size];

  return (
    <button
      className={cn(
        baseStyles,
        variants[variant],
        sizes[size],
        fullWidth && "w-full",
        isLoading && "cursor-wait",
        className
      )}
      disabled={isLoading || disabled}
      ref={ref}
      {...props}
    >
      {isLoading ? (
        <div className={cn("animate-spin rounded-full border-2 border-current border-t-transparent", iconSize)} />
      ) : leftIcon ? (
        <span className={iconSize}>{leftIcon}</span>
      ) : null}
      
      {children && (
        <span className={isLoading ? "opacity-70" : ""}>{children}</span>
      )}
      
      {!isLoading && rightIcon && (
        <span className={iconSize}>{rightIcon}</span>
      )}
    </button>
  );
});

Button.displayName = "Button";

export default Button;
