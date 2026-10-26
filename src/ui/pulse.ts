const queued: { el: Element; name: string }[] = [];
let due = false;
export function pulseClass(el: Element, name: string): void {
  if (queued.some(q => q.el === el && q.name === name)) return;
  if (!el.classList.contains(name)) { el.classList.add(name); return; }
  el.classList.remove(name); queued.push({ el, name });
  if (!due) { due = true; queueMicrotask(flush); }
}
function flush() {
  due = false;
  const batch = queued.splice(0);
  if (typeof getComputedStyle === 'function') for (const { el } of batch) void getComputedStyle(el).animationName;
  for (const { el, name } of batch) el.classList.add(name);
}
