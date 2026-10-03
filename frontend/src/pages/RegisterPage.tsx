import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { AuthLayout } from '@/components/AuthLayout'
import { FormField } from '@/components/FormField'
import { Button } from '@/components/ui/button'
import { ApiError, type FieldErrors } from '@/lib/api'
import { useAuth } from '@/lib/auth'

export function RegisterPage() {
  const { register } = useAuth()
  const navigate = useNavigate()

  const [form, setForm] = useState({
    organization_name: '',
    full_name: '',
    email: '',
    password: '',
  })
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const update = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [key]: event.target.value }))

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setFieldErrors({})
    setSubmitting(true)
    try {
      await register({ ...form, email: form.email.trim() })
      navigate('/', { replace: true })
    } catch (err) {
      if (err instanceof ApiError) {
        setFieldErrors(err.fieldErrors)
        if (Object.keys(err.fieldErrors).length === 0) setError(err.message)
      } else {
        setError('Une erreur est survenue.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout
      title="Créer mon compte"
      description="Essai gratuit 14 jours, sans carte bancaire."
      footer={
        <>
          Déjà inscrit ?{' '}
          <Link to="/connexion" className="font-semibold text-primary underline-offset-4 hover:underline">
            Se connecter
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <FormField
          id="organization_name"
          label="Nom de votre restaurant"
          autoComplete="organization"
          required
          value={form.organization_name}
          onChange={update('organization_name')}
          errors={fieldErrors.organization_name}
        />
        <FormField
          id="full_name"
          label="Votre nom"
          autoComplete="name"
          required
          value={form.full_name}
          onChange={update('full_name')}
          errors={fieldErrors.full_name}
        />
        <FormField
          id="email"
          label="Email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          value={form.email}
          onChange={update('email')}
          errors={fieldErrors.email}
        />
        <FormField
          id="password"
          label="Mot de passe"
          type="password"
          autoComplete="new-password"
          required
          minLength={10}
          hint="10 caractères minimum."
          value={form.password}
          onChange={update('password')}
          errors={fieldErrors.password}
        />
        {error && (
          <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-base text-destructive">
            {error}
          </p>
        )}
        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? 'Création…' : 'Créer mon compte'}
        </Button>
      </form>
    </AuthLayout>
  )
}
