import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info' | 'purple';
  size?: 'sm' | 'md';
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'default',
  size = 'sm',
  className = '',
}) => {
  const variantStyles = {
    default: 'bg-neutral-800 text-neutral-300 border-neutral-700',
    success: 'bg-emerald-950/60 text-emerald-300 border-emerald-800',
    warning: 'bg-amber-950/60 text-amber-300 border-amber-800',
    error: 'bg-rose-950/60 text-rose-300 border-rose-800',
    info: 'bg-sky-950/60 text-sky-300 border-sky-800',
    purple: 'bg-purple-950/60 text-purple-300 border-purple-800',
  };

  const sizeStyles = {
    sm: 'text-[10px] px-1.5 py-0.5 rounded',
    md: 'text-xs px-2 py-1 rounded-md',
  };

  return (
    <span
      className={`inline-flex items-center gap-1 font-mono font-medium border ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
    >
      {children}
    </span>
  );
};
