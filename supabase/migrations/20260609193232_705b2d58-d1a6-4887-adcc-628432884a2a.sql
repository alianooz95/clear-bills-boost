
CREATE TABLE public.invoice_payment_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid,
  invoice_id uuid NOT NULL,
  owner_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('created','deleted')),
  amount numeric NOT NULL,
  payment_date date,
  method text,
  reference text,
  notes text,
  actor_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.invoice_payment_audit TO authenticated;
GRANT ALL ON public.invoice_payment_audit TO service_role;

ALTER TABLE public.invoice_payment_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners read their payment audit"
ON public.invoice_payment_audit FOR SELECT
TO authenticated
USING (auth.uid() = owner_id);

CREATE INDEX idx_inv_pay_audit_invoice ON public.invoice_payment_audit(invoice_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.tg_invoice_payment_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.invoice_payment_audit(payment_id, invoice_id, owner_id, action, amount, payment_date, method, reference, notes, actor_id)
    VALUES (NEW.id, NEW.invoice_id, NEW.owner_id, 'created', NEW.amount, NEW.payment_date, NEW.method, NEW.reference, NEW.notes, auth.uid());
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.invoice_payment_audit(payment_id, invoice_id, owner_id, action, amount, payment_date, method, reference, notes, actor_id)
    VALUES (OLD.id, OLD.invoice_id, OLD.owner_id, 'deleted', OLD.amount, OLD.payment_date, OLD.method, OLD.reference, OLD.notes, auth.uid());
  END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_invoice_payment_audit ON public.invoice_payments;
CREATE TRIGGER trg_invoice_payment_audit
AFTER INSERT OR DELETE ON public.invoice_payments
FOR EACH ROW EXECUTE FUNCTION public.tg_invoice_payment_audit();
