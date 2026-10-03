import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError, api, tokenStore } from '@/lib/api'
import { jsonResponse } from '@/test/render'

describe('api client', () => {
  const fetchMock = vi.fn<typeof fetch>()

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock)
    fetchMock.mockReset()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('envoie le jeton d’accès dans l’en-tête Authorization', async () => {
    tokenStore.set({ access: 'ACCESS', refresh: 'REFRESH' })
    fetchMock.mockResolvedValueOnce(jsonResponse({ email: 'a@b.fr' }))

    const data = await api.get<{ email: string }>('/auth/me/')

    expect(data.email).toBe('a@b.fr')
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/auth/me/')
    expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer ACCESS')
  })

  it('rafraîchit le jeton sur 401 puis rejoue la requête', async () => {
    tokenStore.set({ access: 'OLD', refresh: 'REFRESH' })
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ detail: 'expiré' }, 401))
      .mockResolvedValueOnce(jsonResponse({ access: 'NEW', refresh: 'REFRESH2' }))
      .mockResolvedValueOnce(jsonResponse({ email: 'a@b.fr' }))

    const data = await api.get<{ email: string }>('/auth/me/')

    expect(data.email).toBe('a@b.fr')
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(fetchMock.mock.calls[1][0]).toBe('/api/auth/refresh/')
    expect((fetchMock.mock.calls[2][1]?.headers as Record<string, string>).Authorization).toBe(
      'Bearer NEW',
    )
    expect(tokenStore.get()).toEqual({ access: 'NEW', refresh: 'REFRESH2' })
  })

  it('efface les jetons si le rafraîchissement échoue', async () => {
    tokenStore.set({ access: 'OLD', refresh: 'BAD' })
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ detail: 'expiré' }, 401))
      .mockResolvedValueOnce(jsonResponse({ detail: 'invalide' }, 401))

    await expect(api.get('/auth/me/')).rejects.toBeInstanceOf(ApiError)
    expect(tokenStore.get()).toBeNull()
  })

  it('expose les erreurs par champ renvoyées par DRF', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ email: ['Un compte existe déjà avec cet email.'] }, 400),
    )

    const error = (await api
      .post('/auth/register/', {}, { auth: false })
      .catch((e: unknown) => e)) as ApiError

    expect(error).toBeInstanceOf(ApiError)
    expect(error.status).toBe(400)
    expect(error.fieldErrors.email).toEqual(['Un compte existe déjà avec cet email.'])
  })

  it('traduit une panne réseau en message lisible', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))

    const error = (await api.get('/auth/me/', { auth: false }).catch((e: unknown) => e)) as ApiError

    expect(error).toBeInstanceOf(ApiError)
    expect(error.status).toBe(0)
    expect(error.message).toMatch(/connexion/i)
  })
})
