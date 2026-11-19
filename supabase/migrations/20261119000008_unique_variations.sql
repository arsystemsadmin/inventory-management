-- Variations are grouped into products by name within a store. A product can't
-- have the same size + color twice (use "Add stock" instead).
create unique index items_variant_unique
  on public.items (store_id, lower(btrim(name)), lower(coalesce(size, '')), lower(coalesce(color, '')))
  where not archived;
