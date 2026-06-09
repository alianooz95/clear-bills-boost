
-- Make balance mutations serialize per-customer to prevent lost updates under concurrent payments/invoices.

CREATE OR REPLACE FUNCTION public.apply_invoice_delta(p_customer uuid, p_type invoice_type, p_total numeric, p_sign integer)
RETURNS void
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_signed numeric;
  v_locked uuid;
BEGIN
  IF p_type = 'quotation' THEN
    RETURN;
  END IF;
  v_signed := CASE WHEN p_type = 'sales' THEN p_total ELSE -p_total END;

  -- Lock the customer row to serialize concurrent balance updates
  SELECT id INTO v_locked FROM public.customers WHERE id = p_customer FOR UPDATE;
  IF v_locked IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.customers
     SET balance = balance + (p_sign * v_signed),
         updated_at = now()
   WHERE id = p_customer;
END $function$;

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
    SELECT customer_id, invoice_type INTO v_customer, v_type FROM public.invoices WHERE id = NEW.invoice_id;
    IF v_type <> 'quotation' THEN
      SELECT id INTO v_locked FROM public.customers WHERE id = v_customer FOR UPDATE;
      UPDATE public.customers SET balance = balance - NEW.amount, updated_at = now() WHERE id = v_customer;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    SELECT customer_id, invoice_type INTO v_customer, v_type FROM public.invoices WHERE id = OLD.invoice_id;
    IF v_type <> 'quotation' THEN
      SELECT id INTO v_locked FROM public.customers WHERE id = v_customer FOR UPDATE;
      UPDATE public.customers SET balance = balance + OLD.amount, updated_at = now() WHERE id = v_customer;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
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
