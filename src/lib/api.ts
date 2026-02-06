// API functions for DBX Rule Studio

import { supabase } from '@/integrations/supabase/client';
import type { Rule, RuleVersion, Product, Profile, AuditLog, Condition, Effect, RuleScopes, RuleMetadata } from './types';
import { evaluateRules, recommend, generateNarrative } from './evaluator';
import type { SimulationEvent, SimulationResult } from './types';
import type { Json } from '@/integrations/supabase/types';

// Helper to convert DB row to Rule type
function dbToRule(row: Record<string, unknown>): Rule {
  return {
    id: row.id as string,
    name: row.name as string,
    status: row.status as Rule['status'],
    priority: row.priority as number,
    event: row.event as Rule['event'],
    conditions: row.conditions as Condition[],
    effects: row.effects as Effect[],
    scopes: row.scopes as RuleScopes | undefined,
    metadata: row.metadata as RuleMetadata | undefined,
    version: row.version as number,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

// Helper to convert DB row to Product type
function dbToProduct(row: Record<string, unknown>): Product {
  return {
    id: row.id as string,
    name: row.name as string,
    required_scores: row.required_scores as Record<string, number> | undefined,
    weight_by_score: row.weight_by_score as Record<string, number> | undefined,
    exclusions: row.exclusions as string[] | undefined,
    active: row.active as boolean,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

// Helper to convert DB row to Profile type
function dbToProfile(row: Record<string, unknown>): Profile {
  return {
    customer_id: row.customer_id as string,
    static_data: row.static_data as Profile['static_data'],
    behavioral: row.behavioral as Profile['behavioral'],
    scores: row.scores as Record<string, number>,
    tags: row.tags as string[],
    last_updated: row.last_updated as string,
  };
}

// RULES API

export async function fetchRules(filters?: {
  status?: string;
  event?: string;
  q?: string;
}): Promise<Rule[]> {
  let query = supabase.from('rules').select('*');

  if (filters?.status) {
    query = query.eq('status', filters.status as 'ACTIVE' | 'DRAFT' | 'INACTIVE');
  }
  if (filters?.event) {
    query = query.eq('event', filters.event as 'LOGIN' | 'SALARY_CREDIT' | 'TRANSFER_POSTED' | 'MARKETPLACE_VIEW');
  }
  if (filters?.q) {
    query = query.ilike('name', `%${filters.q}%`);
  }

  const { data, error } = await query.order('priority', { ascending: false });
  
  if (error) throw error;
  return (data || []).map(dbToRule);
}

export async function fetchRule(id: string): Promise<Rule | null> {
  const { data, error } = await supabase
    .from('rules')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data ? dbToRule(data) : null;
}

export async function createRule(rule: Partial<Rule>, actor: string = 'Manager'): Promise<Rule> {
  const { data, error } = await supabase
    .from('rules')
    .insert({
      name: rule.name!,
      status: 'DRAFT' as const,
      priority: rule.priority || 50,
      event: rule.event!,
      conditions: (rule.conditions || []) as unknown as Json,
      effects: (rule.effects || []) as unknown as Json,
      scopes: (rule.scopes || {}) as unknown as Json,
      metadata: (rule.metadata || {}) as unknown as Json,
    })
    .select()
    .single();

  if (error) throw error;
  
  // Create audit log
  await supabase.from('audit_logs').insert({
    entity_type: 'RULE',
    entity_id: data.id,
    action: 'CREATE',
    actor,
    after_state: data as unknown as Json,
  });

  return dbToRule(data);
}

export async function updateRule(id: string, updates: Partial<Rule>, actor: string = 'Manager'): Promise<Rule> {
  // Get current state for audit
  const { data: before } = await supabase.from('rules').select('*').eq('id', id).single();
  
  if (before && before.status === 'ACTIVE') {
    throw new Error('Cannot edit ACTIVE rule. Disable it first or clone.');
  }

  const { data, error } = await supabase
    .from('rules')
    .update({
      name: updates.name,
      priority: updates.priority,
      event: updates.event,
      conditions: updates.conditions as unknown as Json,
      effects: updates.effects as unknown as Json,
      scopes: updates.scopes as unknown as Json,
      metadata: updates.metadata as unknown as Json,
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  // Create audit log
  await supabase.from('audit_logs').insert({
    entity_type: 'RULE',
    entity_id: id,
    action: 'UPDATE',
    actor,
    before_state: before as unknown as Json,
    after_state: data as unknown as Json,
  });

  return dbToRule(data);
}

export async function publishRule(id: string, releaseNote?: string, actor: string = 'Manager'): Promise<Rule> {
  // Get current rule
  const { data: rule, error: fetchError } = await supabase
    .from('rules')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchError) throw fetchError;

  // Create version snapshot
  const newVersion = (rule.version || 1) + 1;
  
  await supabase.from('rule_versions').insert({
    rule_id: id,
    version: rule.version,
    snapshot: rule as unknown as Json,
    release_note: releaseNote,
  });

  // Update rule to ACTIVE
  const { data: updated, error } = await supabase
    .from('rules')
    .update({
      status: 'ACTIVE' as const,
      version: newVersion,
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  // Create audit log
  await supabase.from('audit_logs').insert({
    entity_type: 'RULE',
    entity_id: id,
    action: 'PUBLISH',
    actor,
    before_state: rule as unknown as Json,
    after_state: updated as unknown as Json,
  });

  return dbToRule(updated);
}

export async function disableRule(id: string, actor: string = 'Manager'): Promise<Rule> {
  const { data: before } = await supabase.from('rules').select('*').eq('id', id).single();

  const { data, error } = await supabase
    .from('rules')
    .update({ status: 'INACTIVE' as const })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  await supabase.from('audit_logs').insert({
    entity_type: 'RULE',
    entity_id: id,
    action: 'DISABLE',
    actor,
    before_state: before as unknown as Json,
    after_state: data as unknown as Json,
  });

  return dbToRule(data);
}

export async function cloneRule(id: string, actor: string = 'Manager'): Promise<Rule> {
  const { data: original } = await supabase.from('rules').select('*').eq('id', id).single();
  
  if (!original) throw new Error('Rule not found');

  const originalMetadata = (original.metadata || {}) as Record<string, unknown>;

  const { data, error } = await supabase
    .from('rules')
    .insert({
      name: `${original.name} (Copy)`,
      status: 'DRAFT' as const,
      priority: original.priority,
      event: original.event,
      conditions: original.conditions,
      effects: original.effects,
      scopes: original.scopes,
      metadata: { ...originalMetadata, clonedFrom: id } as unknown as Json,
    })
    .select()
    .single();

  if (error) throw error;

  await supabase.from('audit_logs').insert({
    entity_type: 'RULE',
    entity_id: data.id,
    action: 'CREATE',
    actor,
    after_state: { ...data, clonedFrom: id } as unknown as Json,
  });

  return dbToRule(data);
}

export async function fetchRuleVersions(ruleId: string): Promise<RuleVersion[]> {
  const { data, error } = await supabase
    .from('rule_versions')
    .select('*')
    .eq('rule_id', ruleId)
    .order('version', { ascending: false });

  if (error) throw error;
  return (data || []).map(row => ({
    id: row.id,
    rule_id: row.rule_id,
    version: row.version,
    snapshot: row.snapshot as unknown as Rule,
    release_note: row.release_note || undefined,
    created_at: row.created_at,
  }));
}

export async function rollbackRule(id: string, version: number, actor: string = 'Manager'): Promise<Rule> {
  const { data: versions } = await supabase
    .from('rule_versions')
    .select('*')
    .eq('rule_id', id)
    .eq('version', version)
    .single();

  if (!versions) throw new Error('Version not found');

  const snapshot = versions.snapshot as unknown as Rule;
  const { data: before } = await supabase.from('rules').select('*').eq('id', id).single();

  const { data, error } = await supabase
    .from('rules')
    .update({
      name: snapshot.name,
      priority: snapshot.priority,
      event: snapshot.event,
      conditions: snapshot.conditions as unknown as Json,
      effects: snapshot.effects as unknown as Json,
      scopes: snapshot.scopes as unknown as Json,
      metadata: snapshot.metadata as unknown as Json,
      status: 'DRAFT' as const,
      version: (before?.version || 1) + 1,
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  await supabase.from('audit_logs').insert({
    entity_type: 'RULE',
    entity_id: id,
    action: 'ROLLBACK',
    actor,
    before_state: before as unknown as Json,
    after_state: { ...data, rolledBackTo: version } as unknown as Json,
  });

  return dbToRule(data);
}

export async function deleteRule(id: string, actor: string = 'Manager'): Promise<void> {
  const { data: before } = await supabase.from('rules').select('*').eq('id', id).single();

  const { error } = await supabase.from('rules').delete().eq('id', id);
  if (error) throw error;

  await supabase.from('audit_logs').insert({
    entity_type: 'RULE',
    entity_id: id,
    action: 'DELETE',
    actor,
    before_state: before as unknown as Json,
  });
}

// PRODUCTS API

export async function fetchProducts(): Promise<Product[]> {
  const { data, error } = await supabase.from('products').select('*').order('name');
  if (error) throw error;
  return (data || []).map(dbToProduct);
}

export async function fetchProduct(id: string): Promise<Product | null> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data ? dbToProduct(data) : null;
}

export async function createProduct(product: Partial<Product>, actor: string = 'Manager'): Promise<Product> {
  const { data, error } = await supabase
    .from('products')
    .insert({
      id: product.id || crypto.randomUUID(),
      name: product.name!,
      active: product.active ?? true,
      required_scores: (product.required_scores || {}) as unknown as Json,
      weight_by_score: (product.weight_by_score || {}) as unknown as Json,
      exclusions: (product.exclusions || []) as unknown as Json,
    })
    .select()
    .single();

  if (error) throw error;

  await supabase.from('audit_logs').insert({
    entity_type: 'PRODUCT',
    entity_id: data.id,
    action: 'CREATE',
    actor,
    after_state: data as unknown as Json,
  });

  return dbToProduct(data);
}

export async function updateProduct(id: string, updates: Partial<Product>, actor: string = 'Manager'): Promise<Product> {
  const { data: before } = await supabase.from('products').select('*').eq('id', id).single();

  const { data, error } = await supabase
    .from('products')
    .update({
      name: updates.name,
      active: updates.active,
      required_scores: updates.required_scores as unknown as Json,
      weight_by_score: updates.weight_by_score as unknown as Json,
      exclusions: updates.exclusions as unknown as Json,
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  await supabase.from('audit_logs').insert({
    entity_type: 'PRODUCT',
    entity_id: id,
    action: 'UPDATE',
    actor,
    before_state: before as unknown as Json,
    after_state: data as unknown as Json,
  });

  return dbToProduct(data);
}

// PROFILES API

export async function fetchProfile(customerId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('customer_id', customerId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data ? dbToProfile(data) : null;
}

export async function updateProfile(customerId: string, profile: Partial<Profile>): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .upsert({
      customer_id: customerId,
      static_data: profile.static_data as unknown as Json,
      behavioral: profile.behavioral as unknown as Json,
      scores: profile.scores as unknown as Json,
      tags: profile.tags as unknown as Json,
      last_updated: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw error;
  return dbToProfile(data);
}

// SIMULATION API

export async function runSimulation(
  profile: Profile,
  events: SimulationEvent[]
): Promise<SimulationResult> {
  // Fetch all active rules
  const rules = await fetchRules({ status: 'ACTIVE' });
  
  // Fetch all products
  const products = await fetchProducts();

  // Run evaluation
  const { newProfile, trace } = evaluateRules(rules, profile, events);

  // Generate recommendations
  const recommendations = recommend(products, newProfile);

  // Generate narrative
  const narrative = generateNarrative(trace, recommendations);

  return {
    originalProfile: profile,
    newProfile,
    trace,
    recommendations,
    narrative,
  };
}

// AUDIT LOGS API

export async function fetchAuditLogs(entityId?: string): Promise<AuditLog[]> {
  let query = supabase.from('audit_logs').select('*').order('created_at', { ascending: false });
  
  if (entityId) {
    query = query.eq('entity_id', entityId);
  }

  const { data, error } = await query.limit(100);
  if (error) throw error;
  
  return (data || []).map(row => ({
    id: row.id,
    entity_type: row.entity_type,
    entity_id: row.entity_id,
    action: row.action,
    actor: row.actor,
    before_state: row.before_state as Record<string, unknown> | undefined,
    after_state: row.after_state as Record<string, unknown> | undefined,
    created_at: row.created_at,
  }));
}

// STATS API

export async function fetchStats(): Promise<{
  activeRules: number;
  draftRules: number;
  inactiveRules: number;
  totalProducts: number;
}> {
  const [rulesData, productsData] = await Promise.all([
    supabase.from('rules').select('status'),
    supabase.from('products').select('id').eq('active', true),
  ]);

  const rules = rulesData.data || [];
  
  return {
    activeRules: rules.filter(r => r.status === 'ACTIVE').length,
    draftRules: rules.filter(r => r.status === 'DRAFT').length,
    inactiveRules: rules.filter(r => r.status === 'INACTIVE').length,
    totalProducts: productsData.data?.length || 0,
  };
}
