
-- 1) Payment type enum
DO $$ BEGIN
  CREATE TYPE public.payment_type AS ENUM ('cash', 'deferred_cash', 'credit');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) Add columns to invoices
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS payment_type public.payment_type NOT NULL DEFAULT 'cash',
  ADD COLUMN IF NOT EXISTS due_date date;

-- 3) Invoice payments table
CREATE TABLE IF NOT EXISTS public.invoice_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  method text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoice_payments TO authenticated;
GRANT ALL ON public.invoice_payments TO service_role;

ALTER TABLE public.invoice_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners manage their invoice payments" ON public.invoice_payments;
CREATE POLICY "Owners manage their invoice payments"
  ON public.invoice_payments FOR ALL
  TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE INDEX IF NOT EXISTS idx_invoice_payments_invoice ON public.invoice_payments(invoice_id);

-- 4) Trigger: payments reduce customer balance
CREATE OR REPLACE FUNCTION public.tg_invoice_payment_balance()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_customer uuid;
  v_type invoice_type;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT customer_id, invoice_type INTO v_customer, v_type FROM public.invoices WHERE id = NEW.invoice_id;
    IF v_type <> 'quotation' THEN
      UPDATE public.customers SET balance = balance - NEW.amount, updated_at = now() WHERE id = v_customer;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    SELECT customer_id, invoice_type INTO v_customer, v_type FROM public.invoices WHERE id = OLD.invoice_id;
    IF v_type <> 'quotation' THEN
      UPDATE public.customers SET balance = balance + OLD.amount, updated_at = now() WHERE id = v_customer;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.amount <> NEW.amount THEN
      SELECT customer_id, invoice_type INTO v_customer, v_type FROM public.invoices WHERE id = NEW.invoice_id;
      IF v_type <> 'quotation' THEN
        UPDATE public.customers SET balance = balance + OLD.amount - NEW.amount, updated_at = now() WHERE id = v_customer;
      END IF;
    END IF;
  END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_invoice_payment_balance ON public.invoice_payments;
CREATE TRIGGER trg_invoice_payment_balance
  AFTER INSERT OR UPDATE OR DELETE ON public.invoice_payments
  FOR EACH ROW EXECUTE FUNCTION public.tg_invoice_payment_balance();

-- 5) Helper view-like function: get invoice paid + remaining (used optionally)
CREATE OR REPLACE FUNCTION public.invoice_paid_total(p_invoice uuid)
RETURNS numeric LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT COALESCE(SUM(amount), 0)::numeric FROM public.invoice_payments WHERE invoice_id = p_invoice
$$;
