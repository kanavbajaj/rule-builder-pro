import type { ProductRecommendation } from '@/lib/types';
import { CheckCircle2, XCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

interface RecommendationsViewProps {
  recommendations: ProductRecommendation[];
}

export function RecommendationsView({ recommendations }: RecommendationsViewProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      {recommendations.map((rec) => {
        const isExpanded = expandedId === rec.product.id;
        const isShown = rec.decision === 'SHOWN';

        return (
          <div
            key={rec.product.id}
            className={cn(
              'rounded-lg border transition-colors',
              isShown
                ? 'border-status-active/30 bg-status-active/5'
                : 'border-border bg-muted/30'
            )}
          >
            {/* Header */}
            <button
              onClick={() => setExpandedId(isExpanded ? null : rec.product.id)}
              className="w-full flex items-center justify-between p-4 text-left"
            >
              <div className="flex items-center gap-3">
                {isShown ? (
                  <CheckCircle2 className="h-5 w-5 text-status-active" />
                ) : (
                  <XCircle className="h-5 w-5 text-muted-foreground" />
                )}
                <div>
                  <span className="font-medium">{rec.product.name}</span>
                  <span className={cn(
                    'ml-2 text-xs px-2 py-0.5 rounded-full',
                    isShown
                      ? 'bg-status-active/20 text-status-active'
                      : 'bg-muted text-muted-foreground'
                  )}>
                    {rec.decision}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm text-muted-foreground">
                  Rank #{rec.rank} • Score: {rec.score}
                </span>
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </div>
            </button>

            {/* Expanded details */}
            {isExpanded && (
              <div className="px-4 pb-4 pt-0 border-t border-border/50 space-y-4">
                {/* Why */}
                <div>
                  <h5 className="text-xs font-medium text-muted-foreground mb-2">
                    Explanation
                  </h5>
                  <ul className="space-y-1">
                    {rec.why.map((reason, i) => (
                      <li key={i} className="text-sm flex items-start gap-2">
                        <span className="text-muted-foreground">•</span>
                        {reason}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Score breakdown */}
                {Object.keys(rec.scoreBreakdown).length > 0 && (
                  <div>
                    <h5 className="text-xs font-medium text-muted-foreground mb-2">
                      Score Breakdown
                    </h5>
                    <div className="grid grid-cols-2 gap-2">
                      {Object.entries(rec.scoreBreakdown).map(([key, value]) => (
                        <div key={key} className="flex justify-between text-sm">
                          <span className="text-muted-foreground">{key}</span>
                          <span className="font-mono">{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
