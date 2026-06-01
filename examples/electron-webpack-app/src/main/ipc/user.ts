export interface User {
  id: number
  name: string
}

const db = new Map<number, User>([
  [1, { id: 1, name: 'Ada' }],
  [2, { id: 2, name: 'Linus' }],
])

/** Fetch a user by id. Rejects if not found. */
export function getUser(id: number): User {
  const user = db.get(id)
  if (!user) {
    const err = Object.assign(new Error(`No user with id ${id}`), {
      code: 'E_NOT_FOUND',
    })
    throw err
  }
  return user
}

/** Rename a user and return the updated record. */
export async function renameUser(id: number, name: string): Promise<User> {
  const user = getUser(id)
  const updated = { ...user, name }
  db.set(id, updated)
  return updated
}
