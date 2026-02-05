import { cn } from '@/lib/utils';
import type { RuleStatus } from '@/lib/types';

interface StatusChipProps {
  status: RuleStatus;
  className?: string;
}

export function StatusChip({ status, className }: StatusChipProps) {
  return (
    <span
      className={cn(
        'status-badge',
        status === 'ACTIVE' && 'status-active',
        status === 'DRAFT' && 'status-draft',
        status === 'INACTIVE' && 'status-inactive',
        className
      )}
    >
      {status}
    </span>
  );
}
