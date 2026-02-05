import { cn } from '@/lib/utils';
import type { RuleEvent } from '@/lib/types';
import { Wallet, CreditCard, Send, Eye } from 'lucide-react';

interface EventPillProps {
  event: RuleEvent;
  className?: string;
}

const EVENT_CONFIG: Record<RuleEvent, { icon: typeof Wallet; label: string }> = {
  LOGIN: { icon: Eye, label: 'Login' },
  SALARY_CREDIT: { icon: Wallet, label: 'Salary Credit' },
  TRANSFER_POSTED: { icon: Send, label: 'Transfer' },
  MARKETPLACE_VIEW: { icon: CreditCard, label: 'Marketplace' },
};

export function EventPill({ event, className }: EventPillProps) {
  const config = EVENT_CONFIG[event];
  const Icon = config.icon;

  return (
    <span className={cn('event-pill inline-flex items-center gap-1.5', className)}>
      <Icon className="h-3 w-3" />
      {config.label}
    </span>
  );
}
