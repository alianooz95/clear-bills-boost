
-- ============ suppliers ============
CREATE TABLE public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  name text NOT NULL,
  phone text,
  email text,
  tax_number text,
  balance numeric(14,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.suppliers TO authenticated;
GRANT ALL ON public.suppliers TO service_role;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage their suppliers" ON public.suppliers
  FOR ALL TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE TRIGGER trg_suppliers_updated_at BEFORE UPDATE ON public.suppliers
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============ purchase invoice type enum ============
CREATE TYPE public.purchase_invoice_type AS ENUM ('purchase','debit_note');

-- ============ purchase invoice number sequence ============
CREATE SEQUENCE public.purchase_invoice_number_seq START 1;

CREATE OR REPLACE FUNCTION public.generate_purchase_invoice_number(p_type public.purchase_invoice_type)
RETURNS text LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_n bigint; v_prefix text;
BEGIN
  v_prefix := CASE WHEN p_type = 'purchase' THEN 'PUR' ELSE 'DN' END;
  v_n := nextval('public.purchase_invoice_number_seq');
  RETURN v_prefix || '-' || LPAD(v_n::text, 6, '0');
END $$;

-- ============ purchase_invoices ============
CREATE TABLE public.purchase_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE RESTRICT,
  invoice_number text NOT NULL,
  invoice_type public.purchase_invoice_type NOT NULL,
  invoice_date date NOT NULL DEFAULT CURRENT_DATE,
  payment_type public.payment_type NOT NULL DEFAULT 'cash',
  due_date date,
  subtotal numeric(14,2) NOT NULL DEFAULT 0,
  discount_total numeric(14,2) NOT NULL DEFAULT 0,
  total numeric(14,2) NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_invoices TO authenticated;
GRANT ALL ON public.purchase_invoices TO service_role;
ALTER TABLE public.purchase_invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage their purchase invoices" ON public.purchase_invoices
  FOR ALL TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

-- ============ purchase_invoice_items ============
CREATE TABLE public.purchase_invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.purchase_invoices(id) ON DELETE CASCADE,
  item_name text NOT NULL,
  sold_quantity numeric(14,3) NOT NULL DEFAULT 0,
  bonus_quantity numeric(14,3) NOT NULL DEFAULT 0,
  unit_price numeric(14,4) NOT NULL DEFAULT 0,
  discount_amount numeric(14,2) NOT NULL DEFAULT 0,
  line_total numeric(14,2) NOT NULL DEFAULT 0,
  inventory_item_id uuid,
  batch_number text,
  expiry_date date,
  unit text
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_invoice_items TO authenticated;
GRANT ALL ON public.purchase_invoice_items TO service_role;
ALTER TABLE public.purchase_invoice_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage their purchase invoice items" ON public.purchase_invoice_items
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.purchase_invoices i WHERE i.id = purchase_invoice_items.invoice_id AND i.owner_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.purchase_invoices i WHERE i.id = purchase_invoice_items.invoice_id AND i.owner_id = auth.uid())
  );

CREATE TRIGGER trg_pii_calc BEFORE INSERT OR UPDATE ON public.purchase_invoice_items
  FOR EACH ROW EXECUTE FUNCTION public.tg_invoice_items_calc();

-- recalc purchase invoice totals
CREATE OR REPLACE FUNCTION public.recalc_purchase_invoice_totals(p_invoice_id uuid)
RETURNS void LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_subtotal numeric(14,2); v_disc numeric(14,2);
BEGIN
  SELECT COALESCE(SUM(sold_quantity * unit_price), 0), COALESCE(SUM(discount_amount), 0)
    INTO v_subtotal, v_disc
  FROM public.purchase_invoice_items WHERE invoice_id = p_invoice_id;
  UPDATE public.purchase_invoices
     SET subtotal = v_subtotal, discount_total = v_disc, total = v_subtotal - v_disc
   WHERE id = p_invoice_id;
END $$;

CREATE OR REPLACE FUNCTION public.tg_purchase_items_aiud()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recalc_purchase_invoice_totals(OLD.invoice_id);
  ELSE
    PERFORM public.recalc_purchase_invoice_totals(NEW.invoice_id);
    IF TG_OP = 'UPDATE' AND OLD.invoice_id <> NEW.invoice_id THEN
      PERFORM public.recalc_purchase_invoice_totals(OLD.invoice_id);
    END IF;
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER trg_pii_aiud AFTER INSERT OR UPDATE OR DELETE ON public.purchase_invoice_items
  FOR EACH ROW EXECUTE FUNCTION public.tg_purchase_items_aiud();

-- ============ supplier balance triggers ============
-- purchase invoice: increases supplier balance (we owe them); debit_note: decreases
CREATE OR REPLACE FUNCTION public.apply_purchase_invoice_delta(p_supplier uuid, p_type public.purchase_invoice_type, p_total numeric, p_sign integer)
RETURNS void LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_signed numeric; v_locked uuid;
BEGIN
  v_signed := CASE WHEN p_type = 'purchase' THEN p_total ELSE -p_total END;
  SELECT id INTO v_locked FROM public.suppliers WHERE id = p_supplier FOR UPDATE;
  IF v_locked IS NULL THEN RETURN; END IF;
  UPDATE public.suppliers SET balance = balance + (p_sign * v_signed), updated_at = now() WHERE id = p_supplier;
END $$;

CREATE OR REPLACE FUNCTION public.tg_purchase_invoice_balance()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.apply_purchase_invoice_delta(NEW.supplier_id, NEW.invoice_type, NEW.total, 1);
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.apply_purchase_invoice_delta(OLD.supplier_id, OLD.invoice_type, OLD.total, -1);
  ELSE
    IF OLD.supplier_id IS DISTINCT FROM NEW.supplier_id
       OR OLD.invoice_type IS DISTINCT FROM NEW.invoice_type
       OR OLD.total IS DISTINCT FROM NEW.total THEN
      PERFORM public.apply_purchase_invoice_delta(OLD.supplier_id, OLD.invoice_type, OLD.total, -1);
      PERFORM public.apply_purchase_invoice_delta(NEW.supplier_id, NEW.invoice_type, NEW.total, 1);
    END IF;
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER trg_pi_balance AFTER INSERT OR UPDATE OR DELETE ON public.purchase_invoices
  FOR EACH ROW EXECUTE FUNCTION public.tg_purchase_invoice_balance();

-- ============ purchase_payments ============
CREATE TABLE public.purchase_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  invoice_id uuid NOT NULL REFERENCES public.purchase_invoices(id) ON DELETE CASCADE,
  amount numeric(14,2) NOT NULL,
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  method text,
  reference text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_payments TO authenticated;
GRANT ALL ON public.purchase_payments TO service_role;
ALTER TABLE public.purchase_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage their purchase payments" ON public.purchase_payments
  FOR ALL TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

CREATE OR REPLACE FUNCTION public.tg_purchase_payment_balance()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_supplier uuid; v_locked uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT supplier_id INTO v_supplier FROM public.purchase_invoices WHERE id = NEW.invoice_id;
    SELECT id INTO v_locked FROM public.suppliers WHERE id = v_supplier FOR UPDATE;
    UPDATE public.suppliers SET balance = balance - NEW.amount, updated_at = now() WHERE id = v_supplier;
  ELSIF TG_OP = 'DELETE' THEN
    SELECT supplier_id INTO v_supplier FROM public.purchase_invoices WHERE id = OLD.invoice_id;
    SELECT id INTO v_locked FROM public.suppliers WHERE id = v_supplier FOR UPDATE;
    UPDATE public.suppliers SET balance = balance + OLD.amount, updated_at = now() WHERE id = v_supplier;
  ELSIF TG_OP = 'UPDATE' AND OLD.amount <> NEW.amount THEN
    SELECT supplier_id INTO v_supplier FROM public.purchase_invoices WHERE id = NEW.invoice_id;
    SELECT id INTO v_locked FROM public.suppliers WHERE id = v_supplier FOR UPDATE;
    UPDATE public.suppliers SET balance = balance + OLD.amount - NEW.amount, updated_at = now() WHERE id = v_supplier;
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER trg_pp_balance AFTER INSERT OR UPDATE OR DELETE ON public.purchase_payments
  FOR EACH ROW EXECUTE FUNCTION public.tg_purchase_payment_balance();

CREATE OR REPLACE FUNCTION public.tg_purchase_invoice_before_delete_clear_payments()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  DELETE FROM public.purchase_payments WHERE invoice_id = OLD.id;
  RETURN OLD;
END $$;
CREATE TRIGGER trg_pi_before_delete BEFORE DELETE ON public.purchase_invoices
  FOR EACH ROW EXECUTE FUNCTION public.tg_purchase_invoice_before_delete_clear_payments();

CREATE OR REPLACE FUNCTION public.purchase_invoice_paid_total(p_invoice uuid)
RETURNS numeric LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT COALESCE(SUM(amount), 0)::numeric FROM public.purchase_payments WHERE invoice_id = p_invoice
$$;

-- ============ purchase_payment_audit ============
CREATE TABLE public.purchase_payment_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid,
  invoice_id uuid NOT NULL,
  owner_id uuid NOT NULL,
  action text NOT NULL,
  amount numeric(14,2) NOT NULL,
  payment_date date,
  method text,
  reference text,
  notes text,
  actor_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.purchase_payment_audit TO authenticated;
GRANT ALL ON public.purchase_payment_audit TO service_role;
ALTER TABLE public.purchase_payment_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners read their purchase payment audit" ON public.purchase_payment_audit
  FOR SELECT TO authenticated USING (auth.uid() = owner_id);

CREATE OR REPLACE FUNCTION public.tg_purchase_payment_audit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.purchase_payment_audit(payment_id, invoice_id, owner_id, action, amount, payment_date, method, reference, notes, actor_id)
    VALUES (NEW.id, NEW.invoice_id, NEW.owner_id, 'created', NEW.amount, NEW.payment_date, NEW.method, NEW.reference, NEW.notes, auth.uid());
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.purchase_payment_audit(payment_id, invoice_id, owner_id, action, amount, payment_date, method, reference, notes, actor_id)
    VALUES (OLD.id, OLD.invoice_id, OLD.owner_id, 'deleted', OLD.amount, OLD.payment_date, OLD.method, OLD.reference, OLD.notes, auth.uid());
  END IF;
  RETURN NULL;
END $$;
REVOKE EXECUTE ON FUNCTION public.tg_purchase_payment_audit() FROM PUBLIC;
CREATE TRIGGER trg_pp_audit AFTER INSERT OR DELETE ON public.purchase_payments
  FOR EACH ROW EXECUTE FUNCTION public.tg_purchase_payment_audit();
