/**
 * Moves a node to `document.body` (or another target) once mounted. Needed for
 * `position: fixed` overlays (confirm dialogs) that would otherwise render inside
 * an ancestor with `backdrop-filter`/`filter`/`transform` — those properties make
 * the ancestor a containing block for fixed descendants, so a "fullscreen centered"
 * dialog ends up clipped to that ancestor's box instead of the viewport.
 */
export function portal(node: HTMLElement, target: string | HTMLElement = 'body') {
  const targetEl = typeof target === 'string' ? document.querySelector(target) : target;
  targetEl?.appendChild(node);

  return {
    destroy() {
      node.remove();
    },
  };
}
