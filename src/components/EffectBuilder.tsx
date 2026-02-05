import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Trash2 } from 'lucide-react';
import type { Effect } from '@/lib/types';
import { KNOWN_SCORES } from '@/lib/types';

interface EffectBuilderProps {
  effects: Effect[];
  onChange: (effects: Effect[]) => void;
}

const EFFECT_TYPES = [
  { value: 'scoreDelta', label: 'Score Delta' },
  { value: 'addTag', label: 'Add Tag' },
  { value: 'removeTag', label: 'Remove Tag' },
];

export function EffectBuilder({ effects, onChange }: EffectBuilderProps) {
  const addEffect = (type: Effect['type']) => {
    const newEffect: Effect = type === 'scoreDelta'
      ? { type: 'scoreDelta', score: '', delta: 0 }
      : { type, tag: '' };
    onChange([...effects, newEffect]);
  };

  const updateEffect = (index: number, updates: Partial<Effect>) => {
    const updated = [...effects];
    updated[index] = { ...updated[index], ...updates } as Effect;
    onChange(updated);
  };

  const removeEffect = (index: number) => {
    onChange(effects.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">Effects</label>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => addEffect('scoreDelta')}
          >
            <Plus className="h-4 w-4 mr-1" />
            Score
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => addEffect('addTag')}
          >
            <Plus className="h-4 w-4 mr-1" />
            Tag
          </Button>
        </div>
      </div>

      {effects.length === 0 && (
        <p className="text-sm text-muted-foreground py-4 text-center border border-dashed rounded-lg">
          No effects defined. Add at least one effect.
        </p>
      )}

      {effects.map((effect, index) => (
        <div key={index} className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
          {/* Effect type */}
          <Select
            value={effect.type}
            onValueChange={(v) => {
              const type = v as Effect['type'];
              if (type === 'scoreDelta') {
                updateEffect(index, { type, score: '', delta: 0, tag: undefined });
              } else {
                updateEffect(index, { type, tag: '', score: undefined, delta: undefined });
              }
            }}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {EFFECT_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {effect.type === 'scoreDelta' ? (
            <>
              {/* Score name */}
              <Select
                value={effect.score || ''}
                onValueChange={(v) => updateEffect(index, { score: v })}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Select score" />
                </SelectTrigger>
                <SelectContent>
                  {KNOWN_SCORES.map((score) => (
                    <SelectItem key={score} value={score}>
                      {score}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Delta */}
              <div className="flex items-center gap-1">
                <span className="text-sm text-muted-foreground">±</span>
                <Input
                  type="number"
                  value={effect.delta || 0}
                  onChange={(e) => updateEffect(index, { delta: Number(e.target.value) })}
                  className="w-20"
                />
              </div>
            </>
          ) : (
            <>
              {/* Tag name */}
              <Input
                value={effect.tag || ''}
                onChange={(e) => updateEffect(index, { tag: e.target.value })}
                placeholder="Tag name"
                className="flex-1"
              />
            </>
          )}

          {/* Remove */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => removeEffect(index)}
          >
            <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
          </Button>
        </div>
      ))}
    </div>
  );
}
