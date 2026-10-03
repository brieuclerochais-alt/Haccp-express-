/*
  Client HTTP minimal vers l'API Django.

  - Jetons JWT (accès + rafraîchissement) conservés dans localStorage.
  - Rafraîchissement automatique et transparent sur 401.
  - Erreurs normalisées en `ApiError` avec les messages DRF (par champ).
*/

export const API_BASE = import.meta.env.VITE_API_BASE ?? '/api'

const ACCESS_KEY = 'haccp.access'
const REFRESH_KEY = 'haccp.refresh'

export interface Tokens {
  access: string
  refresh: string
}

export const tokenStore = {
  get(): Tokens | null {
    const access = localStorage.getItem(ACCESS_KEY)
    const refresh = localStorage.getItem(REFRESH_KEY)
    return access && refresh ? { access, refresh } : null
  },
  set(tokens: Tokens) {
    localStorage.setItem(ACCESS_KEY, tokens.access)
    localStorage.setItem(REFRESH_KEY, tokens.refresh)
  },
  clear() {
    localStorage.removeItem(ACCESS_KEY)
    localStorage.removeItem(REFRESH_KEY)
  },
}

export type FieldErrors = Record<string, string[]>

export class ApiError extends Error {
  status: number
  fieldErrors: FieldErrors

  constructor(status: number, body: unknown) {
    super(ApiError.messageFrom(status, body))
    this.name = 'ApiError'
    this.status = status
    this.fieldErrors = ApiError.fieldErrorsFrom(body)
  }

  static fieldErrorsFrom(body: unknown): FieldErrors {
    if (!body || typeof body !== 'object') return {}
    const result: FieldErrors = {}
    for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
      if (Array.isArray(value)) result[key] = value.map(String)
      else if (typeof value === 'string') result[key] = [value]
    }
    return result
  }

  static messageFrom(status: number, body: unknown): string {
    const errors = ApiError.fieldErrorsFrom(body)
    if (errors.detail?.length) return errors.detail[0]
    if (errors.non_field_errors?.length) return errors.non_field_errors[0]
    if (status === 0) return 'Impossible de joindre le serveur. Vérifiez votre connexion.'
    if (status === 401) return 'Identifiants incorrects.'
    if (status === 429) return 'Trop de tentatives. Réessayez dans une minute.'
    if (status >= 500) return 'Le serveur a rencontré une erreur. Réessayez plus tard.'
    return 'La requête a été refusée.'
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  body?: unknown
  auth?: boolean
  signal?: AbortSignal
}

let refreshing: Promise<string | null> | null = null

async function refreshAccessToken(): Promise<string | null> {
  if (refreshing) return refreshing
  refreshing = (async () => {
    const tokens = tokenStore.get()
    if (!tokens) return null
    try {
      const response = await fetch(`${API_BASE}/auth/refresh/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh: tokens.refresh }),
      })
      if (!response.ok) {
        tokenStore.clear()
        return null
      }
      const data = (await response.json()) as { access: string; refresh?: string }
      tokenStore.set({ access: data.access, refresh: data.refresh ?? tokens.refresh })
      return data.access
    } catch {
      return null
    } finally {
      refreshing = null
    }
  })()
  return refreshing
}

async function parseBody(response: Response): Promise<unknown> {
  if (response.status === 204) return null
  const text = await response.text()
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return { detail: text }
  }
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, auth = true, signal } = options

  const doFetch = async (access: string | null) => {
    const headers: Record<string, string> = { Accept: 'application/json' }
    if (body !== undefined) headers['Content-Type'] = 'application/json'
    if (auth && access) headers.Authorization = `Bearer ${access}`
    return fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    })
  }

  let response: Response
  try {
    response = await doFetch(tokenStore.get()?.access ?? null)
    if (response.status === 401 && auth && tokenStore.get()) {
      const access = await refreshAccessToken()
      if (access) response = await doFetch(access)
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new ApiError(0, null)
  }

  const data = await parseBody(response)
  if (!response.ok) throw new ApiError(response.status, data)
  return data as T
}

export const api = {
  get: <T>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'GET' }),
  post: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'POST', body }),
  patch: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'PATCH', body }),
}
