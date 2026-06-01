export const read = async (path: string): Promise<string> => `contents of ${path}`

export const write = (path: string, data: string): void => {
  void path
  void data
}
