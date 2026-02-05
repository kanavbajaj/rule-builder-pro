// Rule evaluation engine for DBX Rule Studio

import type { Rule, Profile, SimulationEvent, TraceEntry, Product, ProductRecommendation } from './types';

/**
 * Get value from nested object using dot notation path
 */
export function getByPath(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;
  
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  
  return current;
}

/**
 * Check if a condition is satisfied
 */
export function checkCondition(
  sourceValue: unknown,
  op: string,
  targetValue: unknown
): boolean {
  // Handle undefined source values
  if (sourceValue === undefined || sourceValue === null) {
    return false;
  }

  switch (op) {
    case '>':
      return Number(sourceValue) > Number(targetValue);
    case '<':
      return Number(sourceValue) < Number(targetValue);
    case '>=':
      return Number(sourceValue) >= Number(targetValue);
    case '<=':
      return Number(sourceValue) <= Number(targetValue);
    case '=':
      return String(sourceValue).toLowerCase() === String(targetValue).toLowerCase();
    case 'contains':
      return String(sourceValue).toLowerCase().includes(String(targetValue).toLowerCase());
    case 'in':
      if (Array.isArray(targetValue)) {
        return targetValue.some(v => String(v).toLowerCase() === String(sourceValue).toLowerCase());
      }
      return false;
    default:
      return false;
  }
}

/**
 * Build context object for condition evaluation
 */
function buildContext(profile: Profile, event: SimulationEvent): Record<string, unknown> {
  return {
    event: event.payload,
    profile: {
      static: profile.static_data,
      behavioral: profile.behavioral,
      scores: profile.scores,
      tags: profile.tags,
    },
  };
}

/**
 * Apply effect to profile
 */
function applyEffect(
  profile: Profile,
  effect: { type: string; score?: string; delta?: number; tag?: string }
): { description: string; profile: Profile } {
  const newProfile = JSON.parse(JSON.stringify(profile)) as Profile;
  let description = '';

  switch (effect.type) {
    case 'scoreDelta':
      if (effect.score && effect.delta !== undefined) {
        const currentScore = newProfile.scores[effect.score] || 0;
        newProfile.scores[effect.score] = currentScore + effect.delta;
        const sign = effect.delta >= 0 ? '+' : '';
        description = `${effect.score} ${sign}${effect.delta} (${currentScore} → ${newProfile.scores[effect.score]})`;
      }
      break;
    case 'addTag':
      if (effect.tag && !newProfile.tags.includes(effect.tag)) {
        newProfile.tags.push(effect.tag);
        description = `Added tag "${effect.tag}"`;
      }
      break;
    case 'removeTag':
      if (effect.tag) {
        const idx = newProfile.tags.indexOf(effect.tag);
        if (idx >= 0) {
          newProfile.tags.splice(idx, 1);
          description = `Removed tag "${effect.tag}"`;
        }
      }
      break;
  }

  return { description, profile: newProfile };
}

/**
 * Evaluate rules against a profile and events
 */
export function evaluateRules(
  rules: Rule[],
  initialProfile: Profile,
  events: SimulationEvent[]
): { newProfile: Profile; trace: TraceEntry[] } {
  let currentProfile = JSON.parse(JSON.stringify(initialProfile)) as Profile;
  const trace: TraceEntry[] = [];

  // Sort rules by priority (higher first)
  const sortedRules = [...rules].sort((a, b) => b.priority - a.priority);

  // Process each event
  for (const event of events) {
    // Filter rules matching this event and ACTIVE status
    const matchingRules = sortedRules.filter(
      r => r.status === 'ACTIVE' && r.event === event.type
    );

    for (const rule of matchingRules) {
      // Build context for condition evaluation
      const context = buildContext(currentProfile, event);

      // Check all conditions
      const allConditionsMet = rule.conditions.every(condition => {
        const sourceValue = getByPath(context, condition.source);
        return checkCondition(sourceValue, condition.op, condition.value);
      });

      if (allConditionsMet) {
        // Apply all effects
        const effectDescriptions: string[] = [];
        
        for (const effect of rule.effects) {
          const result = applyEffect(currentProfile, effect);
          currentProfile = result.profile;
          if (result.description) {
            effectDescriptions.push(result.description);
          }
        }

        trace.push({
          ruleId: rule.id,
          ruleName: rule.name,
          effectDescription: effectDescriptions.join('; '),
        });
      }
    }
  }

  // Update last_updated
  currentProfile.last_updated = new Date().toISOString();

  return { newProfile: currentProfile, trace };
}

/**
 * Generate product recommendations based on profile
 */
export function recommend(
  products: Product[],
  profile: Profile
): ProductRecommendation[] {
  const recommendations: ProductRecommendation[] = [];

  for (const product of products) {
    if (!product.active) continue;

    const why: string[] = [];
    const scoreBreakdown: Record<string, number> = {};
    let decision: 'SHOWN' | 'HIDDEN' = 'SHOWN';
    let rankScore = 0;

    // Check exclusions
    const exclusions = product.exclusions || [];
    const hasExclusion = exclusions.some(tag => profile.tags.includes(tag));
    
    if (hasExclusion) {
      decision = 'HIDDEN';
      const matchedExclusion = exclusions.find(tag => profile.tags.includes(tag));
      why.push(`Excluded: customer has "${matchedExclusion}" tag`);
    } else {
      // Check required scores
      const requiredScores = product.required_scores || {};
      let allScoresMet = true;

      for (const [scoreName, threshold] of Object.entries(requiredScores)) {
        const profileScore = profile.scores[scoreName] || 0;
        scoreBreakdown[scoreName] = profileScore;

        if (profileScore >= threshold) {
          why.push(`✓ ${scoreName}: ${profileScore} ≥ ${threshold}`);
        } else {
          why.push(`✗ ${scoreName}: ${profileScore} < ${threshold} required`);
          allScoresMet = false;
        }
      }

      if (!allScoresMet) {
        decision = 'HIDDEN';
      }

      // Calculate ranking score
      const weights = product.weight_by_score || {};
      for (const [scoreName, weight] of Object.entries(weights)) {
        const profileScore = profile.scores[scoreName] || 0;
        rankScore += profileScore * weight;
      }
    }

    recommendations.push({
      product,
      decision,
      rank: 0, // Will be set after sorting
      score: Math.round(rankScore * 100) / 100,
      why,
      scoreBreakdown,
    });
  }

  // Sort by decision (SHOWN first) then by score
  recommendations.sort((a, b) => {
    if (a.decision !== b.decision) {
      return a.decision === 'SHOWN' ? -1 : 1;
    }
    return b.score - a.score;
  });

  // Assign ranks
  recommendations.forEach((rec, idx) => {
    rec.rank = idx + 1;
  });

  return recommendations;
}

/**
 * Generate human-readable narrative
 */
export function generateNarrative(
  trace: TraceEntry[],
  recommendations: ProductRecommendation[]
): string {
  const parts: string[] = [];

  if (trace.length === 0) {
    parts.push('No rules were triggered by the provided events.');
  } else {
    parts.push(`${trace.length} rule${trace.length > 1 ? 's' : ''} matched:`);
    trace.forEach(t => {
      parts.push(`• "${t.ruleName}": ${t.effectDescription}`);
    });
  }

  parts.push('');
  parts.push('Recommendation Summary:');

  const shown = recommendations.filter(r => r.decision === 'SHOWN');
  const hidden = recommendations.filter(r => r.decision === 'HIDDEN');

  if (shown.length > 0) {
    parts.push(`Showing: ${shown.map(r => r.product.name).join(', ')}`);
  }
  if (hidden.length > 0) {
    parts.push(`Hidden: ${hidden.map(r => r.product.name).join(', ')}`);
  }

  return parts.join('\n');
}

/**
 * Generate human-readable rule preview
 */
export function generateRulePreview(rule: Partial<Rule>): string {
  if (!rule.event || !rule.conditions?.length || !rule.effects?.length) {
    return 'Complete the rule configuration to see preview...';
  }

  const eventLabel = rule.event.replace('_', ' ').toLowerCase();
  
  const conditionParts = rule.conditions.map(c => {
    const fieldLabel = c.source.split('.').pop() || c.source;
    return `${fieldLabel} ${c.op} ${JSON.stringify(c.value)}`;
  });

  const effectParts = rule.effects.map(e => {
    if (e.type === 'scoreDelta') {
      const sign = (e.delta || 0) >= 0 ? '+' : '';
      return `${e.score} ${sign}${e.delta}`;
    }
    if (e.type === 'addTag') return `add tag "${e.tag}"`;
    if (e.type === 'removeTag') return `remove tag "${e.tag}"`;
    return '';
  }).filter(Boolean);

  return `When **${eventLabel}** and ${conditionParts.join(' and ')} → ${effectParts.join(', ')}`;
}
