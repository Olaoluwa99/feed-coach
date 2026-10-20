// Tiny helpers for building the popup and settings pages without a framework.

export const $ = <T extends HTMLElement = HTMLElement>(id: string): T => {
  const found = document.getElementById(id);
  if (!found) throw new Error(`Missing #${id}`);
  return found as T;
};

type Props = Partial<{ className: string; type: string; value: string; title: string; style: string; href: string }>;

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, props: Props = {}, children: string | Node[] = []): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined) continue;
    if (key === "className") node.className = value;
    else node.setAttribute(key, value);
  }
  if (typeof children === "string") node.textContent = children;
  else node.append(...children);
  return node;
}

export function pct(share: number): string {
  return `${Math.round(share * 100)}%`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}
