import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { RegisterPage } from '@/pages/RegisterPage'
import { jsonResponse, renderWithProviders } from '@/test/render'

function renderRegister() {
  return renderWithProviders(
    <Routes>
      <Route path="/inscription" element={<RegisterPage />} />
      <Route path="/" element={<h1>Aujourd'hui</h1>} />
    </Routes>,
    { route: '/inscription' },
  )
}

async function fillForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Nom de votre restaurant'), 'Pizzeria Da Marco')
  await user.type(screen.getByLabelText('Votre nom'), 'Marco Rossi')
  await user.type(screen.getByLabelText('Email'), 'marco@pizzeria.fr')
  await user.type(screen.getByLabelText('Mot de passe'), 'Pizza-Napoli-2026')
}

describe('RegisterPage', () => {
  const fetchMock = vi.fn<typeof fetch>()

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock)
    fetchMock.mockReset()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('crée le compte et redirige vers « Aujourd’hui »', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        {
          access: 'A',
          refresh: 'R',
          user: { id: 'u1', email: 'marco@pizzeria.fr', full_name: 'Marco Rossi', memberships: [] },
        },
        201,
      ),
    )
    renderRegister()
    const user = userEvent.setup()

    await fillForm(user)
    await user.click(screen.getByRole('button', { name: 'Créer mon compte' }))

    await waitFor(() => expect(screen.getByRole('heading', { name: "Aujourd'hui" })).toBeVisible())
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/auth/register/')
    expect(JSON.parse(init?.body as string)).toEqual({
      organization_name: 'Pizzeria Da Marco',
      full_name: 'Marco Rossi',
      email: 'marco@pizzeria.fr',
      password: 'Pizza-Napoli-2026',
    })
  })

  it('affiche les erreurs de validation sous les champs concernés', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        {
          email: ['Un compte existe déjà avec cet email.'],
          password: ['Ce mot de passe est trop courant.'],
        },
        400,
      ),
    )
    renderRegister()
    const user = userEvent.setup()

    await fillForm(user)
    await user.click(screen.getByRole('button', { name: 'Créer mon compte' }))

    expect(await screen.findByText('Un compte existe déjà avec cet email.')).toBeVisible()
    expect(screen.getByText('Ce mot de passe est trop courant.')).toBeVisible()
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true')
  })
})
