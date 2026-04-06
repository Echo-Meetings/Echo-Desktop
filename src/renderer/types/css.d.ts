declare module '*.css' {}

interface Window {
  setProgress?: (pct: number) => void
  finishLoading?: () => void
}
