export function backendFileUrl(fileKey: string): string {
  const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
  return `${base}/api/files/${encodeURIComponent(fileKey)}`
}
