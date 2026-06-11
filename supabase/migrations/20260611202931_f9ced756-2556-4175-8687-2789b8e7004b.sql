
-- Standalone customer receipt vouchers (سند تحصيل) — not tied to a specific invoice
CREATE SEQUENCE IF NOT EXISTS public.customer_receipt_number_seq START 1;

CREATE TABLE public.customer_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  receipt_number text NOT NULL UNIQUE,
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  receipt_date date NOT NULL DEFAULT CURRENT_DATE,
  method text,
  reference text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_receipts TO authenticated;
GRANT ALL ON public.customer_receipts TO service_role;

ALTER TABLE public.customer_receipts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner manages own receipts" ON public.customer_receipts
  FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

CREATE TRIGGER trg_customer_receipts_updated_at
  BEFORE UPDATE ON public.customer_receipts
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Generator
CREATE OR REPLACE FUNCTION public.generate_customer_receipt_number()
RETURNS text LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_n bigint;
BEGIN
  v_n := nextval('public.customer_receipt_number_seq');
  RETURN 'RC-' || LPAD(v_n::text, 6, '0');
END $$;

-- Balance trigger: receipt reduces customer balance (collection)
CREATE OR REPLACE FUNCTION public.tg_customer_receipt_balance()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_locked uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT id INTO v_locked FROM public.customers WHERE id = NEW.customer_id FOR UPDATE;
    UPDATE public.customers SET balance = balance - NEW.amount, updated_at = now() WHERE id = NEW.customer_id;
  ELSIF TG_OP = 'DELETE' THEN
    SELECT id INTO v_locked FROM public.customers WHERE id = OLD.customer_id FOR UPDATE;
    UPDATE public.customers SET balance = balance + OLD.amount, updated_at = now() WHERE id = OLD.customer_id;
  ELSIF TG_OP = 'UPDATE' AND (OLD.amount <> NEW.amount OR OLD.customer_id <> NEW.customer_id) THEN
    SELECT id INTO v_locked FROM public.customers WHERE id = OLD.customer_id FOR UPDATE;
    UPDATE public.customers SET balance = balance + OLD.amount, updated_at = now() WHERE id = OLD.customer_id;
    SELECT id INTO v_locked FROM public.customers WHERE id = NEW.customer_id FOR UPDATE;
    UPDATE public.customers SET balance = balance - NEW.amount, updated_at = now() WHERE id = NEW.customer_id;
  END IF;
  RETURN NULL;
END $$;

CREATE TRIGGER trg_customer_receipt_balance
  AFTER INSERT OR UPDATE OR DELETE ON public.customer_receipts
  FOR EACH ROW EXECUTE FUNCTION public.tg_customer_receipt_balance();

CREATE INDEX idx_customer_receipts_customer ON public.customer_receipts(customer_id);
CREATE INDEX idx_customer_receipts_owner_date ON public.customer_receipts(owner_id, receipt_date DESC);
