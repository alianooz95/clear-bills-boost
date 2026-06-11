
-- Product category for pharmaceutical items
CREATE TYPE public.product_category AS ENUM ('owned', 'negotiation', 'market');

ALTER TABLE public.inventory_items
  ADD COLUMN scientific_name text,
  ADD COLUMN cost_price numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN quantity numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN bonus_quantity numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  ADD COLUMN pharma_form text,
  ADD COLUMN country text,
  ADD COLUMN category public.product_category NOT NULL DEFAULT 'owned';

CREATE INDEX idx_inventory_category ON public.inventory_items(owner_id, category);
