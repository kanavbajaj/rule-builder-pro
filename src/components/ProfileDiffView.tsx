import type { Profile } from '@/lib/types';
import { ArrowRight } from 'lucide-react';

interface ProfileDiffViewProps {
  before: Profile;
  after: Profile;
}

export function ProfileDiffView({ before, after }: ProfileDiffViewProps) {
  const allScoreKeys = Array.from(
    new Set([...Object.keys(before.scores), ...Object.keys(after.scores)])
  );

  const allTags = Array.from(
    new Set([...before.tags, ...after.tags])
  );

  return (
    <div className="space-y-6">
      {/* Scores */}
      <div>
        <h4 className="text-sm font-medium mb-3">Scores</h4>
        <div className="grid gap-2">
          {allScoreKeys.map((key) => {
            const beforeVal = before.scores[key] || 0;
            const afterVal = after.scores[key] || 0;
            const delta = afterVal - beforeVal;
            const changed = delta !== 0;

            return (
              <div
                key={key}
                className={`flex items-center justify-between p-3 rounded-lg ${
                  changed ? 'bg-primary/10 border border-primary/20' : 'bg-muted/50'
                }`}
              >
                <span className="font-medium">{key}</span>
                <div className="flex items-center gap-3">
                  <span className={changed ? 'text-muted-foreground' : ''}>
                    {beforeVal}
                  </span>
                  {changed && (
                    <>
                      <ArrowRight className="h-4 w-4 text-primary" />
                      <span className="font-semibold text-primary">{afterVal}</span>
                      <span className={`text-sm ${delta > 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                        ({delta > 0 ? '+' : ''}{delta})
                      </span>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Tags */}
      <div>
        <h4 className="text-sm font-medium mb-3">Tags</h4>
        <div className="flex flex-wrap gap-2">
          {allTags.map((tag) => {
            const wasPresent = before.tags.includes(tag);
            const isPresent = after.tags.includes(tag);
            const added = !wasPresent && isPresent;
            const removed = wasPresent && !isPresent;

            return (
              <span
                key={tag}
                className={`px-2.5 py-1 rounded-full text-sm ${
                  added
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : removed
                    ? 'bg-red-500/20 text-red-400 border border-red-500/30 line-through'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {added && '+ '}
                {removed && '- '}
                {tag}
              </span>
            );
          })}
          {allTags.length === 0 && (
            <span className="text-sm text-muted-foreground">No tags</span>
          )}
        </div>
      </div>
    </div>
  );
}
