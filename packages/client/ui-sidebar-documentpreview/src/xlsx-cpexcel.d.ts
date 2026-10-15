declare module 'xlsx/dist/cpexcel.full.mjs' {
  const codepages: Record<number, string>
  export = codepages
  export as namespace codepages
}
