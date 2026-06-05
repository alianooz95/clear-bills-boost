
-- Enum for invoice types
CREATE TYPE public.invoice_type AS ENUM ('sales', 'credit_note');

-- Customers
CREATE TABLE public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  phone text,
  email text,
  tax_number text,
  balance numeric(14,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX customers_owner_id_idx ON public.customers(owner_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO authenticated;
GRANT ALL ON public.customers TO service_role;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage their customers" ON public.customers
  FOR ALL TO authenticated
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

-- Sequence for invoice numbers
CREATE SEQUENCE public.invoice_number_seq START 1;

-- Invoices
CREATE TABLE public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  invoice_number text NOT NULL UNIQUE,
  invoice_type public.invoice_type NOT NULL,
  invoice_date date NOT NULL DEFAULT CURRENT_DATE,
  subtotal numeric(14,2) NOT NULL DEFAULT 0,
  discount_total numeric(14,2) NOT NULL DEFAULT 0,
  total numeric(14,2) NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX invoices_customer_idx ON public.invoices(customer_id, invoice_date);
CREATE INDEX invoices_owner_idx ON public.invoices(owner_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoices TO authenticated;
GRANT ALL ON public.invoices TO service_role;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage their invoices" ON public.invoices
  FOR ALL TO authenticated
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

-- Invoice items
CREATE TABLE public.invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  item_name text NOT NULL,
  sold_quantity numeric(12,3) NOT NULL DEFAULT 0,
  bonus_quantity numeric(12,3) NOT NULL DEFAULT 0,
  unit_price numeric(14,2) NOT NULL DEFAULT 0,
  discount_amount numeric(14,2) NOT NULL DEFAULT 0,
  line_total numeric(14,2) NOT NULL DEFAULT 0
);
CREATE INDEX invoice_items_invoice_idx ON public.invoice_items(invoice_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoice_items TO authenticated;
GRANT ALL ON public.invoice_items TO service_role;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage their invoice items" ON public.invoice_items
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.invoices i
    WHERE i.id = invoice_items.invoice_id AND i.owner_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.invoices i
    WHERE i.id = invoice_items.invoice_id AND i.owner_id = auth.uid()
  ));

-- Generic updated_at trigger
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER customers_updated_at BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Compute line_total on items
CREATE OR REPLACE FUNCTION public.tg_invoice_items_calc()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.sold_quantity < 0 OR NEW.bonus_quantity < 0
     OR NEW.unit_price < 0 OR NEW.discount_amount < 0 THEN
    RAISE EXCEPTION 'Negative values are not allowed in invoice items';
  END IF;
  NEW.line_total := ROUND((NEW.sold_quantity * NEW.unit_price) - NEW.discount_amount, 2);
  RETURN NEW;
END $$;

CREATE TRIGGER invoice_items_calc
  BEFORE INSERT OR UPDATE ON public.invoice_items
  FOR EACH ROW EXECUTE FUNCTION public.tg_invoice_items_calc();

-- Recalc invoice totals from items
CREATE OR REPLACE FUNCTION public.recalc_invoice_totals(p_invoice_id uuid)
RETURNS void LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_subtotal numeric(14,2);
  v_disc numeric(14,2);
BEGIN
  SELECT COALESCE(SUM(sold_quantity * unit_price), 0),
         COALESCE(SUM(discount_amount), 0)
    INTO v_subtotal, v_disc
  FROM public.invoice_items WHERE invoice_id = p_invoice_id;

  UPDATE public.invoices
     SET subtotal = v_subtotal,
         discount_total = v_disc,
         total = v_subtotal - v_disc
   WHERE id = p_invoice_id;
END $$;

CREATE OR REPLACE FUNCTION public.tg_invoice_items_aiud()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recalc_invoice_totals(OLD.invoice_id);
  ELSE
    PERFORM public.recalc_invoice_totals(NEW.invoice_id);
    IF TG_OP = 'UPDATE' AND OLD.invoice_id <> NEW.invoice_id THEN
      PERFORM public.recalc_invoice_totals(OLD.invoice_id);
    END IF;
  END IF;
  RETURN NULL;
END $$;

CREATE TRIGGER invoice_items_aiud
  AFTER INSERT OR UPDATE OR DELETE ON public.invoice_items
  FOR EACH ROW EXECUTE FUNCTION public.tg_invoice_items_aiud();

-- Apply invoice effect on customer balance
CREATE OR REPLACE FUNCTION public.apply_invoice_delta(
  p_customer uuid, p_type public.invoice_type, p_total numeric, p_sign int
) RETURNS void LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_signed numeric;
BEGIN
  v_signed := CASE WHEN p_type = 'sales' THEN p_total ELSE -p_total END;
  UPDATE public.customers
     SET balance = balance + (p_sign * v_signed),
         updated_at = now()
   WHERE id = p_customer;
END $$;

CREATE OR REPLACE FUNCTION public.tg_invoice_balance()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.apply_invoice_delta(NEW.customer_id, NEW.invoice_type, NEW.total, 1);
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.apply_invoice_delta(OLD.customer_id, OLD.invoice_type, OLD.total, -1);
  ELSE
    IF OLD.customer_id IS DISTINCT FROM NEW.customer_id
       OR OLD.invoice_type IS DISTINCT FROM NEW.invoice_type
       OR OLD.total IS DISTINCT FROM NEW.total THEN
      PERFORM public.apply_invoice_delta(OLD.customer_id, OLD.invoice_type, OLD.total, -1);
      PERFORM public.apply_invoice_delta(NEW.customer_id, NEW.invoice_type, NEW.total, 1);
    END IF;
  END IF;
  RETURN NULL;
END $$;

CREATE TRIGGER invoices_balance_aiud
  AFTER INSERT OR UPDATE OR DELETE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.tg_invoice_balance();

-- Invoice number generator
CREATE OR REPLACE FUNCTION public.generate_invoice_number(p_type public.invoice_type)
RETURNS text LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_n bigint;
  v_prefix text;
BEGIN
  v_prefix := CASE WHEN p_type = 'sales' THEN 'INV' ELSE 'CN' END;
  v_n := nextval('public.invoice_number_seq');
  RETURN v_prefix || '-' || LPAD(v_n::text, 6, '0');
END $$;
