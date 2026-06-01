import type { HandlerEntry, HandlerManifest } from '../../types'

/** A node in the nested namespace tree used to render the bridge/dts shapes. */
export interface NsNode {
  /** Child namespaces, keyed by identifier segment. */
  namespaces: Map<string, NsNode>
  /** Handlers directly on this namespace, keyed by export name. */
  methods: Map<string, HandlerEntry>
}

function emptyNode(): NsNode {
  return { namespaces: new Map(), methods: new Map() }
}

/**
 * Group manifest entries into a nested tree by dotted namespace. The `flat`
 * strategy yields entries with an empty namespace, which land on the root.
 */
export function buildTree(manifest: HandlerManifest): NsNode {
  const root = emptyNode()

  for (const entry of manifest) {
    const segments = entry.namespace ? entry.namespace.split('.') : []
    let node = root
    for (const segment of segments) {
      let child = node.namespaces.get(segment)
      if (!child) {
        child = emptyNode()
        node.namespaces.set(segment, child)
      }
      node = child
    }
    node.methods.set(entry.exportName, entry)
  }

  return root
}
