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
import type { Condition } from '@/lib/types';
import { FIELD_SUGGESTIONS, OPERATORS } from '@/lib/types';

interface ConditionBuilderProps {
  conditions: Condition[];
  onChange: (conditions: Condition[]) => void;
}

export function ConditionBuilder({ conditions, onChange }: ConditionBuilderProps) {
  const addCondition = () => {
    onChange([
      ...conditions,
      { source: '', op: '=', value: '' },
    ]);
  };

  const updateCondition = (index: number, field: keyof Condition, value: unknown) => {
    const updated = [...conditions];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  const removeCondition = (index: number) => {
    onChange(conditions.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">Conditions</label>
        <Button type="button" variant="outline" size="sm" onClick={addCondition}>
          <Plus className="h-4 w-4 mr-1" />
          Add Condition
        </Button>
      </div>

      {conditions.length === 0 && (
        <p className="text-sm text-muted-foreground py-4 text-center border border-dashed rounded-lg">
          No conditions defined. Click "Add Condition" to start.
        </p>
      )}

      {conditions.map((condition, index) => (
        <div key={index} className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
          {/* Field selector */}
          <Select
            value={condition.source || undefined}
            onValueChange={(v) => updateCondition(index, 'source', v)}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Select field" />
            </SelectTrigger>
            <SelectContent>
              {FIELD_SUGGESTIONS.filter((field) => field.path !== '').map((field) => (
                <SelectItem key={field.path} value={field.path}>
                  {field.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Operator */}
          <Select
            value={condition.op}
            onValueChange={(v) => updateCondition(index, 'op', v)}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {OPERATORS.map((op) => (
                <SelectItem key={op.value} value={op.value}>
                  {op.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Value */}
          <Input
            value={String(condition.value)}
            onChange={(e) => {
              // Try to parse as number
              const val = e.target.value;
              const numVal = Number(val);
              updateCondition(index, 'value', isNaN(numVal) || val === '' ? val : numVal);
            }}
            placeholder="Value"
            className="flex-1"
          />

          {/* Remove */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => removeCondition(index)}
          >
            <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
          </Button>
        </div>
      ))}
    </div>
  );
}
