import "i18next";
import type en from "./locales/en";

// Type-checked translation keys: t("inventory.addProduct") autocompletes and
// a missing/misspelled key is a build error.
declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "translation";
    resources: { translation: typeof en };
  }
}
