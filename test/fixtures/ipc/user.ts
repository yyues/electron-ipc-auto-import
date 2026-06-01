export interface User {
  id: number
  name: string
}

export type UserId = number

// A non-function value export — must be skipped.
export const SECRET = 42

/** Fetch a user by id. */
export function getUser(id: number): User {
  return { id, name: 'demo' }
}

export async function updateUser(user: User): Promise<boolean> {
  return user.id > 0
}

// Not exported — must be ignored.
function internal(): void {}

export default function noop(): void {}
