import { cn } from '@/lib/utils';

interface PriorityBadgeProps {
  priority: number;
  className?: string;
}

export function PriorityBadge({ priority, className }: PriorityBadgeProps) {
  return (
    <span className={cn('priority-badge', className)}>
      P{priority}
    </span>
  );
}
