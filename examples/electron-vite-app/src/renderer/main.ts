// window.ipc is fully typed via the generated d.ts — types are inferred
// directly from the main-process handler signatures.
async function run(): Promise<void> {
  const lines: string[] = []

  const sys = await window.ipc.system.info()
  lines.push(`system.info -> ${JSON.stringify(sys)}`)

  const user = await window.ipc.user.getUser(1)
  lines.push(`user.getUser(1) -> ${JSON.stringify(user)}`)

  const renamed = await window.ipc.user.renameUser(2, 'Linus T.')
  lines.push(`user.renameUser(2, 'Linus T.') -> ${JSON.stringify(renamed)}`)

  try {
    await window.ipc.user.getUser(999)
  } catch (err) {
    // Error round-trips with name + custom `code` intact.
    const e = err as Error & { code?: string }
    lines.push(`user.getUser(999) rejected -> ${e.name}: ${e.message} (code=${e.code})`)
  }

  document.getElementById('out')!.textContent = lines.join('\n')
}

run().catch((err) => {
  document.getElementById('out')!.textContent = `ERROR: ${String(err)}`
})
