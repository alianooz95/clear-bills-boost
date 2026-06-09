
-- Fix: when an invoice is deleted, its payments cascade-delete, but the payment trigger
-- can no longer look up the (now-deleted) invoice. Solution: pre-delete payments in a
-- BEFORE DELETE trigger on invoices so each payment's balance reversal runs first.

CREATE OR REPLACE FUNCTION public.tg_invoice_before_delete_clear_payments()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  DELETE FROM public.invoice_payments WHERE invoice_id = OLD.id;
  RETURN OLD;
END $function$;

DROP TRIGGER IF EXISTS tg_invoice_before_delete_clear_payments ON public.invoices;
CREATE TRIGGER tg_invoice_before_delete_clear_payments
BEFORE DELETE ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.tg_invoice_before_delete_clear_payments();
