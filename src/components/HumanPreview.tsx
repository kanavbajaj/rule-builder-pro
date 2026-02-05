import { generateRulePreview } from '@/lib/evaluator';
import type { Rule } from '@/lib/types';
import { Sparkles } from 'lucide-react';

interface HumanPreviewProps {
  rule: Partial<Rule>;
}

export function HumanPreview({ rule }: HumanPreviewProps) {
  const preview = generateRulePreview(rule);
  
  // Convert markdown-style bold to spans
  const formattedPreview = preview.split('**').map((part, i) => 
    i % 2 === 1 ? (
      <span key={i} className="font-semibold text-primary">{part}</span>
    ) : (
      <span key={i}>{part}</span>
    )
  );

  return (
    <div className="rule-preview">
      <div className="flex items-center gap-2 mb-2 text-sm text-muted-foreground">
        <Sparkles className="h-4 w-4 text-primary" />
        <span>Rule Preview</span>
      </div>
      <p className="text-sm leading-relaxed">
        {formattedPreview}
      </p>
    </div>
  );
}
