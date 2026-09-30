let counter = 0;

/** Short, collision-safe id for local entities. */
export function uid(prefix = ''): string {
  counter = (counter + 1) % 10000;
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}${Date.now().toString(36)}${rand}${counter}`;
}
