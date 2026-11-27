/** Product page: any variation id of the product works as its address. */
export const productHref = (variationId: string) => `/inventory/product/${variationId}`;
/** Color page: any variation id of that color works as its address. */
export const colorHref = (variationId: string) => `/inventory/color/${variationId}`;

export const colorKey = (color: string | null | undefined) => (color ?? "").trim().toLowerCase();
