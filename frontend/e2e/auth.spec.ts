import { expect, test, type Page } from '@playwright/test'

const me = {
  id: 'u1',
  email: 'marco@pizzeria.fr',
  full_name: 'Marco Rossi',
  memberships: [
    {
      id: 'm1',
      role: 'owner',
      organization: {
        id: 'o1',
        name: 'Pizzeria Da Marco',
        siret: '',
        billing_address: '',
        created_at: '',
      },
    },
  ],
}

async function mockApi(page: Page) {
  await page.route('**/api/auth/register/', (route) =>
    route.fulfill({ status: 201, json: { access: 'A', refresh: 'R', user: me } }),
  )
  await page.route('**/api/auth/login/', async (route) => {
    const body = route.request().postDataJSON() as { password: string }
    if (body.password === 'Pizza-Napoli-2026') {
      await route.fulfill({ json: { access: 'A', refresh: 'R' } })
    } else {
      await route.fulfill({
        status: 401,
        json: { detail: 'Aucun compte actif trouvé avec ces identifiants' },
      })
    }
  })
  await page.route('**/api/auth/me/', (route) => route.fulfill({ json: me }))
}

test.beforeEach(async ({ page }) => {
  await mockApi(page)
})

test('un gérant crée son compte et arrive sur « Aujourd’hui »', async ({ page }) => {
  await page.goto('/inscription')

  await page.getByLabel('Nom de votre restaurant').fill('Pizzeria Da Marco')
  await page.getByLabel('Votre nom').fill('Marco Rossi')
  await page.getByLabel('Email').fill('marco@pizzeria.fr')
  await page.getByLabel('Mot de passe').fill('Pizza-Napoli-2026')
  await page.getByRole('button', { name: 'Créer mon compte' }).click()

  await expect(page.getByRole('heading', { name: "Aujourd'hui" })).toBeVisible()
  await expect(page.getByText('Pizzeria Da Marco')).toBeVisible()
})

test('un gérant se connecte, se déconnecte et revient à la connexion', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveURL(/\/connexion$/)

  await page.getByLabel('Email').fill('marco@pizzeria.fr')
  await page.getByLabel('Mot de passe').fill('mauvais')
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await expect(page.getByRole('alert')).toContainText('Aucun compte actif')

  await page.getByLabel('Mot de passe').fill('Pizza-Napoli-2026')
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await expect(page.getByRole('heading', { name: "Aujourd'hui" })).toBeVisible()

  await page.getByRole('button', { name: 'Se déconnecter' }).click()
  await expect(page).toHaveURL(/\/connexion$/)
})

test('la PWA expose un manifeste installable', async ({ page, request }) => {
  await page.goto('/connexion')
  const href = await page.locator('link[rel="manifest"]').getAttribute('href')
  expect(href).toBeTruthy()
  const manifest = await request.get(href!)
  expect(manifest.ok()).toBeTruthy()
  const json = (await manifest.json()) as { name: string; display: string; lang: string }
  expect(json.name).toBe('HACCP Express')
  expect(json.display).toBe('standalone')
  expect(json.lang).toBe('fr')
})

test('les boutons respectent la zone tactile minimale de 56 px', async ({ page }) => {
  await page.goto('/connexion')
  const box = await page.getByRole('button', { name: 'Se connecter' }).boundingBox()
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(56)
})
