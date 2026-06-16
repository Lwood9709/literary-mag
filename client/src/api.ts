const BASE = import.meta.env.VITE_API_URL ?? ''

export const api = (path: string) => `${BASE}${path}`
