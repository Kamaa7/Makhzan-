/// <reference types="vite/client" />

declare module "*.sql?raw" {
  const content: string;
  export default content;
}

declare module "*.wasm?url" {
  const url: string;
  export default url;
}

declare module "jsbarcode" {
  export default function JsBarcode(
    element: string | HTMLElement | SVGElement,
    data: string,
    options?: Record<string, unknown>,
  ): void;
}
