CREATE OR REPLACE FUNCTION public.apply_invoice_delta(p_customer uuid, p_type invoice_type, p_total numeric, p_sign integer)
RETURNS void
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_signed numeric;
BEGIN
  IF p_type = 'quotation' THEN
    RETURN;
  END IF;
  v_signed := CASE WHEN p_type = 'sales' THEN p_total ELSE -p_total END;
  UPDATE public.customers
     SET balance = balance + (p_sign * v_signed),
         updated_at = now()
   WHERE id = p_customer;
END $function$;