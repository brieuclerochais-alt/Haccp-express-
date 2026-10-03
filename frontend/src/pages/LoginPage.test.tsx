import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { LoginPage } from '@/pages/LoginPage'
import { jsonResponse, renderWithProviders } from '@/test/render'

const me = {
  id: 'u1',
  email: 'chef@brasserie.fr',
  full_name: 'Chef',
  memberships: [
    {
      id: 'm1',
      role: 'owner',
      organization: { id: 'o1', name: 'Brasserie', siret: '', billing_address: '', created_at: '' },
    },
  ],
}

function renderLogin() {
  return renderWithProviders(
    <Routes>
      <Route path="/connexion" element={<LoginPage />} />
      <Route path="/" element={<h1>Aujourd'hui</h1>} />
    </Routes>,
    { route: '/connexion' },
  )
}

describe('LoginPage', () => {
  const fetchMock = vi.fn<typeof fetch>()

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock)
    fetchMock.mockReset()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('connecte le gérant et redirige vers « Aujourd’hui »', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ access: 'A', refresh: 'R' }))
      .mockResolvedValueOnce(jsonResponse(me))
    renderLogin()
    const user = userEvent.setup()

    await user.type(screen.getByLabelText('Email'), 'chef@brasserie.fr')
    await user.type(screen.getByLabelText('Mot de passe'), 'Choucroute-Garnie-7')
    await user.click(screen.getByRole('button', { name: 'Se connecter' }))

    await waitFor(() => expect(screen.getByRole('heading', { name: "Aujourd'hui" })).toBeVisible())
    const [, init] = fetchMock.mock.calls[0]
    expect(JSON.parse(init?.body as string)).toEqual({
      email: 'chef@brasserie.fr',
      password: 'Choucroute-Garnie-7',
    })
    expect(localStorage.getItem('haccp.access')).toBe('A')
  })

  it('affiche une erreur lisible quand les identifiants sont faux', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ detail: 'Aucun compte actif trouvé avec ces identifiants' }, 401),
    )
    renderLogin()
    const user = userEvent.setup()

    await user.type(screen.getByLabelText('Email'), 'chef@brasserie.fr')
    await user.type(screen.getByLabelText('Mot de passe'), 'mauvais')
    await user.click(screen.getByRole('button', { name: 'Se connecter' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/aucun compte actif/i)
    expect(localStorage.getItem('haccp.access')).toBeNull()
  })

  it('propose un lien vers l’inscription', () => {
    renderLogin()
    expect(screen.getByRole('link', { name: /créer mon établissement/i })).toHaveAttribute(
      'href',
      '/inscription',
    )
  })
})
