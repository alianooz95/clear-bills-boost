CREATE OR REPLACE FUNCTION public.generate_invoice_number(p_type invoice_type)
RETURNS text
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_n bigint;
  v_prefix text;
BEGIN
  v_prefix := CASE
    WHEN p_type = 'sales' THEN 'INV'
    WHEN p_type = 'quotation' THEN 'QT'
    ELSE 'CN'
  END;
  v_n := nextval('public.invoice_number_seq');
  RETURN v_prefix || '-' || LPAD(v_n::text, 6, '0');
END $function$;