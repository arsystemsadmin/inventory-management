import type { SVGProps } from "react";

/** ₪ in the lucide icon style (lucide has no shekel icon). */
export function ShekelSign(props: SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M5 20V8a4 4 0 0 1 4-4h3a4 4 0 0 1 4 4v7" />
      <path d="M19 4v12a4 4 0 0 1-4 4h-3a4 4 0 0 1-4-4V9" />
    </svg>
  );
}
