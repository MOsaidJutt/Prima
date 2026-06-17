import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { Button } from '@/components/ui/button'

export const metadata = { title: 'Access denied — Prima' }

export default async function ForbiddenPage() {
  const t = await getTranslations('errors')
  const tc = await getTranslations('common')
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 text-center">
      <div>
        <p className="text-muted-foreground font-mono text-sm">{t('forbiddenCode')}</p>
        <h2 className="mt-2 text-2xl font-semibold">{t('forbiddenTitle')}</h2>
        <p className="text-muted-foreground mt-2 max-w-sm text-sm">{t('forbiddenBody')}</p>
      </div>
      <Button asChild variant="outline">
        <Link href="/">{tc('goHome')}</Link>
      </Button>
    </div>
  )
}
