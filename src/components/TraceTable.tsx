import type { TraceEntry } from '@/lib/types';
import { CheckCircle2 } from 'lucide-react';

interface TraceTableProps {
  trace: TraceEntry[];
}

export function TraceTable({ trace }: TraceTableProps) {
  if (trace.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No rules were triggered by the provided events.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <table className="data-table">
        <thead>
          <tr>
            <th className="w-8"></th>
            <th>Rule</th>
            <th>Effects Applied</th>
          </tr>
        </thead>
        <tbody>
          {trace.map((entry, index) => (
            <tr key={index} className="trace-row">
              <td>
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              </td>
              <td>
                <span className="font-medium">{entry.ruleName}</span>
                <span className="text-xs text-muted-foreground ml-2">
                  {entry.ruleId}
                </span>
              </td>
              <td className="font-mono text-sm">{entry.effectDescription}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
