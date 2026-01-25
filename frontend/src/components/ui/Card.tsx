import { HTMLAttributes, forwardRef } from 'react'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'elevated' | 'interactive'
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className = '', variant = 'default', children, ...props }, ref) => {
    const variants = {
      default: 'glass p-5',
      elevated: 'glass-elevated p-5',
      interactive: 'card cursor-pointer',
    }

    return (
      <div ref={ref} className={`${variants[variant]} ${className}`} {...props}>
        {children}
      </div>
    )
  }
)

Card.displayName = 'Card'
