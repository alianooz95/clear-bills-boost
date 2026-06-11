
-- 1) Link invoice payments to a receipt (for allocations)
ALTER TABLE public.invoice_payments
  ADD COLUMN source_receipt_id uuid REFERENCES public.customer_receipts(id) ON DELETE CASCADE;

CREATE INDEX idx_invoice_payments_receipt ON public.invoice_payments(source_receipt_id);

-- 2) Skip balance double-counting for payments tied to a receipt
CREATE OR REPLACE FUNCTION public.tg_invoice_payment_balance()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_customer uuid;
  v_type invoice_type;
  v_locked uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.source_receipt_id IS NOT NULL THEN RETURN NULL; END IF;
    SELECT customer_id, invoice_type INTO v_customer, v_type FROM public.invoices WHERE id = NEW.invoice_id;
    IF v_type <> 'quotation' THEN
      SELECT id INTO v_locked FROM public.customers WHERE id = v_customer FOR UPDATE;
      UPDATE public.customers SET balance = balance - NEW.amount, updated_at = now() WHERE id = v_customer;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.source_receipt_id IS NOT NULL THEN RETURN NULL; END IF;
    SELECT customer_id, invoice_type INTO v_customer, v_type FROM public.invoices WHERE id = OLD.invoice_id;
    IF v_type <> 'quotation' THEN
      SELECT id INTO v_locked FROM public.customers WHERE id = v_customer FOR UPDATE;
      UPDATE public.customers SET balance = balance + OLD.amount, updated_at = now() WHERE id = v_customer;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.source_receipt_id IS NOT NULL OR OLD.source_receipt_id IS NOT NULL THEN RETURN NULL; END IF;
    IF OLD.amount <> NEW.amount THEN
      SELECT customer_id, invoice_type INTO v_customer, v_type FROM public.invoices WHERE id = NEW.invoice_id;
      IF v_type <> 'quotation' THEN
        SELECT id INTO v_locked FROM public.customers WHERE id = v_customer FOR UPDATE;
        UPDATE public.customers SET balance = balance + OLD.amount - NEW.amount, updated_at = now() WHERE id = v_customer;
      END IF;
    END IF;
  END IF;
  RETURN NULL;
END $function$;

-- 3) Receipt number with year prefix: RC-YYYY-NNNNNN. UNIQUE constraint on receipt_number already prevents duplicates.
CREATE OR REPLACE FUNCTION public.generate_customer_receipt_number()
RETURNS text LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_n bigint; v_year text;
BEGIN
  v_n := nextval('public.customer_receipt_number_seq');
  v_year := to_char(now(), 'YYYY');
  RETURN 'RC-' || v_year || '-' || LPAD(v_n::text, 6, '0');
END $$;
