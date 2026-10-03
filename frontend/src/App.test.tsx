import { screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import App from '@/App'
import { tokenStore } from '@/lib/api'
import { jsonResponse, renderWithProviders } from '@/test/render'

describe('App (routage protégé)', () => {
  const fetchMock = vi.fn<typeof fetch>()

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock)
    fetchMock.mockReset()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('redirige un visiteur anonyme vers la connexion', async () => {
    renderWithProviders(<App />, { route: '/' })
    expect(await screen.findByRole('heading', { name: 'Connexion' })).toBeVisible()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('affiche « Aujourd’hui » pour un gérant déjà connecté', async () => {
    tokenStore.set({ access: 'A', refresh: 'R' })
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        id: 'u1',
        email: 'chef@brasserie.fr',
        full_name: 'Chef',
        memberships: [
          {
            id: 'm1',
            role: 'owner',
            organization: { id: 'o1', name: 'Brasserie du Port', siret: '', billing_address: '', created_at: '' },
          },
        ],
      }),
    )

    renderWithProviders(<App />, { route: '/' })

    expect(await screen.findByRole('heading', { name: "Aujourd'hui" })).toBeVisible()
    expect(screen.getByText('Brasserie du Port')).toBeVisible()
  })

  it('renvoie à la connexion si le jeton stocké est invalide', async () => {
    tokenStore.set({ access: 'A', refresh: 'R' })
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ detail: 'expiré' }, 401))
      .mockResolvedValueOnce(jsonResponse({ detail: 'invalide' }, 401))

    renderWithProviders(<App />, { route: '/' })

    expect(await screen.findByRole('heading', { name: 'Connexion' })).toBeVisible()
    expect(tokenStore.get()).toBeNull()
  })
})
