-- Create enums for rule status and events
CREATE TYPE rule_status AS ENUM ('DRAFT', 'ACTIVE', 'INACTIVE');
CREATE TYPE rule_event AS ENUM ('LOGIN', 'SALARY_CREDIT', 'TRANSFER_POSTED', 'MARKETPLACE_VIEW');

-- Create rules table
CREATE TABLE public.rules (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL,
  status rule_status NOT NULL DEFAULT 'DRAFT',
  priority INTEGER NOT NULL DEFAULT 50,
  event rule_event NOT NULL,
  conditions JSONB NOT NULL DEFAULT '[]'::jsonb,
  effects JSONB NOT NULL DEFAULT '[]'::jsonb,
  scopes JSONB DEFAULT '{}'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create rule versions table for versioning/rollback
CREATE TABLE public.rule_versions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  rule_id TEXT NOT NULL REFERENCES public.rules(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  snapshot JSONB NOT NULL,
  release_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create audit logs table
CREATE TABLE public.audit_logs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  entity_type TEXT NOT NULL DEFAULT 'RULE',
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL,
  actor TEXT NOT NULL DEFAULT 'Manager',
  before_state JSONB,
  after_state JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create products table for recommendation engine
CREATE TABLE public.products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  required_scores JSONB DEFAULT '{}'::jsonb,
  weight_by_score JSONB DEFAULT '{}'::jsonb,
  exclusions JSONB DEFAULT '[]'::jsonb,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create customer profiles table
CREATE TABLE public.profiles (
  customer_id TEXT PRIMARY KEY,
  static_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  behavioral JSONB NOT NULL DEFAULT '{}'::jsonb,
  scores JSONB NOT NULL DEFAULT '{}'::jsonb,
  tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  last_updated TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rule_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create public read/write policies (hackathon-simple, no auth required)
CREATE POLICY "Public read access for rules" ON public.rules FOR SELECT USING (true);
CREATE POLICY "Public insert access for rules" ON public.rules FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update access for rules" ON public.rules FOR UPDATE USING (true);
CREATE POLICY "Public delete access for rules" ON public.rules FOR DELETE USING (true);

CREATE POLICY "Public read access for rule_versions" ON public.rule_versions FOR SELECT USING (true);
CREATE POLICY "Public insert access for rule_versions" ON public.rule_versions FOR INSERT WITH CHECK (true);

CREATE POLICY "Public read access for audit_logs" ON public.audit_logs FOR SELECT USING (true);
CREATE POLICY "Public insert access for audit_logs" ON public.audit_logs FOR INSERT WITH CHECK (true);

CREATE POLICY "Public read access for products" ON public.products FOR SELECT USING (true);
CREATE POLICY "Public insert access for products" ON public.products FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update access for products" ON public.products FOR UPDATE USING (true);

CREATE POLICY "Public read access for profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Public insert access for profiles" ON public.profiles FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update access for profiles" ON public.profiles FOR UPDATE USING (true);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
CREATE TRIGGER update_rules_updated_at
  BEFORE UPDATE ON public.rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed demo products
INSERT INTO public.products (id, name, required_scores, weight_by_score, exclusions) VALUES
('home-loan', 'Home Loan', '{"financialStability": 60, "homeOwnershipIntent": 50}', '{"financialStability": 0.6, "homeOwnershipIntent": 0.4}', '["has-home-loan"]'),
('credit-card', 'Credit Card', '{"creditReadiness": 55, "digitalEngagement": 30}', '{"creditReadiness": 0.6, "digitalEngagement": 0.4}', '[]'),
('personal-loan', 'Personal Loan', '{"financialStability": 50, "creditReadiness": 45}', '{"financialStability": 0.5, "creditReadiness": 0.5}', '[]'),
('investment-account', 'Investment Account', '{"financialStability": 70, "digitalEngagement": 40}', '{"financialStability": 0.7, "digitalEngagement": 0.3}', '[]');

-- Seed demo rules
INSERT INTO public.rules (id, name, status, priority, event, conditions, effects, version) VALUES
('r-salary', 'Salary credit boosts stability', 'ACTIVE', 90, 'SALARY_CREDIT', 
  '[{"source": "event.amount", "op": ">", "value": 50000}]',
  '[{"type": "scoreDelta", "score": "financialStability", "delta": 10}, {"type": "addTag", "tag": "stable-income"}]',
  1),
('r-rent', 'Recurring rent → renter intent', 'ACTIVE', 85, 'TRANSFER_POSTED',
  '[{"source": "event.counterpartyLabel", "op": "contains", "value": "rent"}, {"source": "event.frequency", "op": "=", "value": "monthly"}]',
  '[{"type": "scoreDelta", "score": "homeOwnershipIntent", "delta": 20}, {"type": "addTag", "tag": "renter"}]',
  1),
('r-login-engagement', 'Login boosts digital engagement', 'ACTIVE', 70, 'LOGIN',
  '[{"source": "profile.behavioral.marketplaceVisits", "op": ">", "value": 2}]',
  '[{"type": "scoreDelta", "score": "digitalEngagement", "delta": 5}]',
  1),
('r-marketplace', 'Marketplace browsing indicates credit interest', 'DRAFT', 60, 'MARKETPLACE_VIEW',
  '[{"source": "event.category", "op": "=", "value": "loans"}]',
  '[{"type": "scoreDelta", "score": "creditReadiness", "delta": 8}, {"type": "addTag", "tag": "loan-interest"}]',
  1);

-- Seed demo profile
INSERT INTO public.profiles (customer_id, static_data, behavioral, scores, tags) VALUES
('C123', 
  '{"age": 30, "employment": "salaried", "hasHomeLoan": false}',
  '{"salaryCreditsPerMonth": 1, "rentPaymentsPerMonth": 1, "marketplaceVisits": 4}',
  '{"financialStability": 52, "homeOwnershipIntent": 35, "creditReadiness": 40, "digitalEngagement": 20}',
  '[]');