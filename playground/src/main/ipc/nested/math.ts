/** Exercises namespace: 'folder' — exposed as window.ipc.nested.math.add. */
export function add(a: number, b: number): number {
  return a + b
}

/** Exposed as window.ipc.nested.math.mul. */
export function mul(a: number, b: number): number {
  return a * b
}
