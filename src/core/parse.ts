import {
  type ExportedDeclarations,
  type JSDocableNode,
  Node,
  Project,
  type SourceFile,
  SyntaxKind,
  ts,
} from 'ts-morph'
import type { ParsedExport, ParsedFile, ResolvedOptions } from '../types'
import { toPosix } from './utils'

/**
 * Create a detached ts-morph project for classification. We only need
 * declaration-level analysis (function vs type vs value), not full type
 * resolution of the user's whole program, so we skip tsconfig file loading.
 */
export function createProject(): Project {
  return new Project({
    useInMemoryFileSystem: false,
    skipAddingFilesFromTsConfig: true,
    skipFileDependencyResolution: true,
    compilerOptions: {
      allowJs: true,
      target: ts.ScriptTarget.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
    },
  })
}

/**
 * Parse a single source file, returning the exports that qualify as IPC
 * handlers under the active options.
 *
 * Type-only exports, non-function value exports, and (by default) default
 * exports are excluded. In `marker` mode, only exports wrapped in the marker
 * call are kept.
 */
export function parseFile(
  project: Project,
  filePath: string,
  relativePath: string,
  options: ResolvedOptions,
): ParsedFile {
  const posix = toPosix(filePath)
  const sourceFile = ensureSourceFile(project, posix)

  const exports: ParsedExport[] = []

  for (const [name, declarations] of sourceFile.getExportedDeclarations()) {
    const decl = declarations[0]
    if (!decl) continue

    const isDefault = name === 'default'
    const classified = classifyDeclaration(decl, options.markerName)

    const parsed: ParsedExport = {
      exportName: name,
      isFunction: classified.isFunction,
      isAsync: classified.isAsync,
      isTypeOnly: classified.isTypeOnly,
      isDefault,
      isMarked: classified.isMarked,
      jsDoc: extractJsDoc(decl),
    }

    if (!qualifies(parsed, options)) continue
    exports.push(parsed)
  }

  return { filePath: posix, relativePath: toPosix(relativePath), exports }
}

/** Add the file fresh from disk (replacing any stale copy). */
function ensureSourceFile(project: Project, filePath: string): SourceFile {
  const existing = project.getSourceFile(filePath)
  if (existing) {
    existing.refreshFromFileSystemSync()
    return existing
  }
  return project.addSourceFileAtPath(filePath)
}

interface Classification {
  isFunction: boolean
  isAsync: boolean
  isTypeOnly: boolean
  isMarked: boolean
}

function classifyDeclaration(
  decl: ExportedDeclarations,
  markerName: string,
): Classification {
  // Type-only constructs.
  if (
    Node.isTypeAliasDeclaration(decl) ||
    Node.isInterfaceDeclaration(decl) ||
    Node.isEnumDeclaration(decl)
  ) {
    return { isFunction: false, isAsync: false, isTypeOnly: true, isMarked: false }
  }

  // `function foo() {}` (incl. default function exports).
  if (Node.isFunctionDeclaration(decl)) {
    return {
      isFunction: true,
      isAsync: decl.isAsync(),
      isTypeOnly: false,
      isMarked: false,
    }
  }

  // `const foo = ...` — inspect the initializer.
  if (Node.isVariableDeclaration(decl)) {
    const initializer = decl.getInitializer()
    return classifyInitializer(initializer, markerName)
  }

  // Direct arrow/function expression (e.g. default export of one).
  return classifyInitializer(decl, markerName)
}

function classifyInitializer(
  node: Node | undefined,
  markerName: string,
): Classification {
  if (!node) {
    return { isFunction: false, isAsync: false, isTypeOnly: false, isMarked: false }
  }

  if (Node.isArrowFunction(node) || Node.isFunctionExpression(node)) {
    return {
      isFunction: true,
      isAsync: node.isAsync(),
      isTypeOnly: false,
      isMarked: false,
    }
  }

  // Marker call: `defineIpcHandler(fn)`.
  if (Node.isCallExpression(node)) {
    const callee = node.getExpression().getText()
    const isMarked = callee === markerName
    const inner = node.getArguments()[0]
    const innerFn = classifyInitializer(inner, markerName)
    return {
      // The marker is assumed to return a callable handler.
      isFunction: isMarked || innerFn.isFunction,
      isAsync: innerFn.isAsync,
      isTypeOnly: false,
      isMarked,
    }
  }

  return { isFunction: false, isAsync: false, isTypeOnly: false, isMarked: false }
}

function qualifies(parsed: ParsedExport, options: ResolvedOptions): boolean {
  if (parsed.isTypeOnly) return false
  if (parsed.isDefault && !options.allowDefault) return false
  if (options.mode === 'marker') return parsed.isMarked
  return parsed.isFunction
}

/** Extract the leading JSDoc text from a declaration, walking to the owning statement. */
function extractJsDoc(decl: Node): string | undefined {
  const docable = findJsDocable(decl)
  if (!docable) return undefined
  const docs = docable.getJsDocs()
  const last = docs[docs.length - 1]
  const text = last?.getDescription().trim()
  return text ? text : undefined
}

function findJsDocable(node: Node): JSDocableNode | undefined {
  let current: Node | undefined = node
  // Walk up to a statement that carries JSDoc (VariableStatement, FunctionDeclaration).
  while (current) {
    if (
      Node.isFunctionDeclaration(current) ||
      Node.isVariableStatement(current) ||
      current.getKind() === SyntaxKind.VariableStatement
    ) {
      return current as unknown as JSDocableNode
    }
    current = current.getParent()
  }
  return undefined
}
