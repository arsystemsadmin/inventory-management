/** Draft model + paste parser for Quick setup (many products at once). */

export const STANDARD_SIZES = ["XS", "S", "M", "L", "XL"];

export type DraftColor = { key: string; color: string; photo: string | null; qty: Record<string, string> };
export type DraftProduct = {
  key: string; name: string; price: string; cost: string; category: string; photo: string | null;
  /** Size options offered on this card (standard + any custom ones). */
  sizes: string[];
  colors: DraftColor[];
  /** Last save problem for this product, shown on the card. */
  error?: string;
};

export const newKey = () => Math.random().toString(36).slice(2, 10);
export const emptyColor = (qty: Record<string, string> = {}): DraftColor => ({ key: newKey(), color: "", photo: null, qty });
export const emptyProduct = (): DraftProduct => ({
  key: newKey(), name: "", price: "", cost: "", category: "", photo: null, sizes: [...STANDARD_SIZES], colors: [emptyColor()],
});

const norm = (s: string) => s.trim().toLowerCase();
export const colorPieces = (c: DraftColor) => Object.entries(c.qty).filter(([, q]) => q !== undefined);
export const colorUnits = (c: DraftColor) => colorPieces(c).reduce((n, [, q]) => n + (parseInt(q || "0", 10) || 0), 0);

export type ParsedLine = {
  line: number; raw: string; name: string; color: string; price: string;
  sizes: { size: string; qty: string }[]; warnings: ("noName" | "noPrice" | "noSizes")[];
};

/**
 * One product color per line: name, color, price, sizes. Separated by commas,
 * tabs (pasted from a spreadsheet) or semicolons. Sizes: "S2 M3 L1", "S:2",
 * "36x2"; a lone number means one size with that quantity.
 */
export function parsePaste(text: string): ParsedLine[] {
  return text.split(/\r?\n/).map((raw, i) => ({ raw: raw.trim(), i })).filter((l) => l.raw).map(({ raw, i }) => {
    const sep = raw.includes("\t") ? "\t" : raw.includes(";") && !raw.includes(",") ? ";" : ",";
    const [name = "", color = "", priceRaw = "", ...rest] = raw.split(sep).map((x) => x.trim());
    const price = priceRaw.replace(/[₪\s]/g, "").replace(/^(\d+),(\d{1,2})$/, "$1.$2");
    const sizes: { size: string; qty: string }[] = [];
    for (const tok of rest.join(" ").split(/\s+/).filter(Boolean)) {
      const m = tok.match(/^(.+?)[:x×=-]?(\d+)$/i);
      if (/^\d+$/.test(tok)) sizes.push({ size: "One size", qty: tok });
      else if (m) sizes.push({ size: m[1].toUpperCase(), qty: m[2] });
      else sizes.push({ size: tok.toUpperCase(), qty: "1" });
    }
    const warnings: ParsedLine["warnings"] = [];
    if (!name) warnings.push("noName");
    if (!price || Number.isNaN(Number(price))) warnings.push("noPrice");
    if (!sizes.length) warnings.push("noSizes");
    return { line: i + 1, raw, name, color, price: Number.isNaN(Number(price)) ? "" : price, sizes, warnings };
  });
}

/** Merge pasted lines into the cards: same product name joins its card, same color joins its block. */
export function mergeParsed(draft: DraftProduct[], lines: ParsedLine[]): DraftProduct[] {
  const next = draft.filter((p) => p.name.trim() || p.colors.some((c) => c.color.trim() || colorPieces(c).length)).map((p) => ({ ...p, sizes: [...p.sizes], colors: p.colors.map((c) => ({ ...c, qty: { ...c.qty } })) }));
  for (const l of lines) {
    if (!l.name) continue;
    let p = next.find((x) => norm(x.name) === norm(l.name));
    if (!p) { p = { ...emptyProduct(), name: l.name, colors: [] }; next.push(p); }
    if (!p.price && l.price) p.price = l.price;
    let c = p.colors.find((x) => norm(x.color) === norm(l.color));
    if (!c) { c = emptyColor(); c.color = l.color; p.colors.push(c); }
    for (const s of l.sizes) {
      if (!p.sizes.some((x) => norm(x) === norm(s.size))) p.sizes = [...p.sizes, s.size];
      const sizeName = p.sizes.find((x) => norm(x) === norm(s.size))!;
      c.qty = { ...c.qty, [sizeName]: String((parseInt(c.qty[sizeName] || "0", 10) || 0) + (parseInt(s.qty, 10) || 0)) };
    }
  }
  return next.length ? next : [emptyProduct()];
}
