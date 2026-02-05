// Core types for DBX Rule Studio

export type RuleStatus = 'DRAFT' | 'ACTIVE' | 'INACTIVE';
export type RuleEvent = 'LOGIN' | 'SALARY_CREDIT' | 'TRANSFER_POSTED' | 'MARKETPLACE_VIEW';

export interface Condition {
  source: string;
  op: '>' | '<' | '=' | '>=' | '<=' | 'contains' | 'in';
  value: string | number | boolean | string[];
}

export interface Effect {
  type: 'scoreDelta' | 'addTag' | 'removeTag';
  score?: string;
  delta?: number;
  tag?: string;
}

export interface RuleScopes {
  channels?: string[];
  segments?: string[];
  validFrom?: string;
  validTo?: string;
}

export interface RuleMetadata {
  owner?: string;
  lastEditedBy?: string;
  notes?: string;
}

export interface Rule {
  id: string;
  name: string;
  status: RuleStatus;
  priority: number;
  event: RuleEvent;
  conditions: Condition[];
  effects: Effect[];
  scopes?: RuleScopes;
  metadata?: RuleMetadata;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface RuleVersion {
  id: string;
  rule_id: string;
  version: number;
  snapshot: Rule;
  release_note?: string;
  created_at: string;
}

export interface AuditLog {
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  actor: string;
  before_state?: Record<string, unknown>;
  after_state?: Record<string, unknown>;
  created_at: string;
}

export interface Product {
  id: string;
  name: string;
  required_scores?: Record<string, number>;
  weight_by_score?: Record<string, number>;
  exclusions?: string[];
  active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Profile {
  customer_id: string;
  static_data: {
    age?: number;
    employment?: string;
    hasHomeLoan?: boolean;
    [key: string]: unknown;
  };
  behavioral: {
    salaryCreditsPerMonth?: number;
    rentPaymentsPerMonth?: number;
    marketplaceVisits?: number;
    [key: string]: unknown;
  };
  scores: Record<string, number>;
  tags: string[];
  last_updated: string;
}

export interface SimulationEvent {
  type: RuleEvent;
  payload: Record<string, unknown>;
}

export interface TraceEntry {
  ruleId: string;
  ruleName: string;
  effectDescription: string;
}

export interface SimulationResult {
  originalProfile: Profile;
  newProfile: Profile;
  trace: TraceEntry[];
  recommendations: ProductRecommendation[];
  narrative: string;
}

export interface ProductRecommendation {
  product: Product;
  decision: 'SHOWN' | 'HIDDEN';
  rank: number;
  score: number;
  why: string[];
  scoreBreakdown: Record<string, number>;
}

export type UserRole = 'Admin' | 'Manager' | 'Analyst' | 'Auditor';

// Event options for dropdown
export const RULE_EVENTS: { value: RuleEvent; label: string }[] = [
  { value: 'LOGIN', label: 'Login' },
  { value: 'SALARY_CREDIT', label: 'Salary Credit' },
  { value: 'TRANSFER_POSTED', label: 'Transfer Posted' },
  { value: 'MARKETPLACE_VIEW', label: 'Marketplace View' },
];

// Known scores for suggestions
export const KNOWN_SCORES = [
  'financialStability',
  'homeOwnershipIntent',
  'creditReadiness',
  'digitalEngagement',
];

// Field suggestions for conditions
export const FIELD_SUGGESTIONS = [
  { path: 'event.amount', label: 'Event Amount', type: 'number' },
  { path: 'event.counterpartyLabel', label: 'Counterparty Label', type: 'string' },
  { path: 'event.frequency', label: 'Event Frequency', type: 'string' },
  { path: 'event.category', label: 'Event Category', type: 'string' },
  { path: 'profile.static.age', label: 'Customer Age', type: 'number' },
  { path: 'profile.static.employment', label: 'Employment Status', type: 'string' },
  { path: 'profile.static.hasHomeLoan', label: 'Has Home Loan', type: 'boolean' },
  { path: 'profile.behavioral.salaryCreditsPerMonth', label: 'Salary Credits/Month', type: 'number' },
  { path: 'profile.behavioral.rentPaymentsPerMonth', label: 'Rent Payments/Month', type: 'number' },
  { path: 'profile.behavioral.marketplaceVisits', label: 'Marketplace Visits', type: 'number' },
  { path: 'profile.scores.financialStability', label: 'Financial Stability Score', type: 'number' },
  { path: 'profile.scores.homeOwnershipIntent', label: 'Home Ownership Intent', type: 'number' },
  { path: 'profile.scores.creditReadiness', label: 'Credit Readiness', type: 'number' },
  { path: 'profile.scores.digitalEngagement', label: 'Digital Engagement', type: 'number' },
];

// Operators
export const OPERATORS = [
  { value: '>', label: 'Greater than' },
  { value: '<', label: 'Less than' },
  { value: '=', label: 'Equals' },
  { value: '>=', label: 'Greater or equal' },
  { value: '<=', label: 'Less or equal' },
  { value: 'contains', label: 'Contains' },
  { value: 'in', label: 'In list' },
];
