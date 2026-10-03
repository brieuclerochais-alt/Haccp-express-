import { LogOut } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/lib/auth'

const dateFormatter = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
})

/*
  Écran central « Aujourd'hui ». Au Lot 0 il affiche seulement l'en-tête et
  l'organisation du gérant : les tâches du jour arrivent au Lot 2.
*/
export function TodayPage() {
  const { user, logout } = useAuth()
  const organization = user?.memberships[0]?.organization

  return (
    <main className="mx-auto flex min-h-svh max-w-3xl flex-col gap-6 p-4">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="text-base capitalize text-muted-foreground">
            {dateFormatter.format(new Date())}
          </p>
          <h1 className="text-3xl font-bold tracking-tight">Aujourd'hui</h1>
          {organization && <p className="text-lg">{organization.name}</p>}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={logout}
          aria-label="Se déconnecter"
          className="shrink-0"
        >
          <LogOut />
          <span className="hidden sm:inline">Déconnexion</span>
        </Button>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Bienvenue, {user?.full_name || user?.email}</CardTitle>
          <CardDescription>
            Votre compte est créé. La configuration de l'établissement (enceintes froides,
            fournisseurs, plan de nettoyage, équipe) arrive dans la prochaine version.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="list-disc space-y-1 pl-5 text-base text-muted-foreground">
            <li>Rôle : {user?.memberships[0]?.role === 'owner' ? 'Gérant' : 'Responsable'}</li>
            <li>Email : {user?.email}</li>
          </ul>
        </CardContent>
      </Card>
    </main>
  )
}
