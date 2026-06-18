import Link from 'next/link'

const COLUMNS = [
  {
    heading: 'Product',
    links: [
      { href: '/pricing', label: 'Pricing' },
      { href: '/docs', label: 'Docs' },
      { href: '/login', label: 'Log in' },
    ],
  },
  {
    heading: 'Company',
    links: [
      { href: '/about', label: 'About' },
      { href: '/contact', label: 'Contact' },
    ],
  },
  {
    heading: 'Legal',
    links: [
      { href: '/privacy', label: 'Privacy policy' },
      { href: '/terms', label: 'Terms of service' },
    ],
  },
]

export function SiteFooter() {
  return (
    <footer className="border-border/60 border-t">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Link href="/" className="flex items-center gap-2 text-lg font-bold tracking-tight">
              <span className="bg-primary text-primary-foreground flex h-7 w-7 items-center justify-center rounded-md text-sm">
                P
              </span>
              Prima
            </Link>
            <p className="text-muted-foreground mt-4 max-w-xs text-sm leading-relaxed">
              Daily sales reporting and AI insights for distribution businesses across Pakistan.
            </p>
          </div>

          {COLUMNS.map((column) => (
            <div key={column.heading}>
              <h3 className="text-foreground text-sm font-semibold">{column.heading}</h3>
              <ul className="mt-4 space-y-3">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-muted-foreground hover:text-foreground text-sm transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-border/60 mt-12 flex flex-col gap-4 border-t pt-8 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-muted-foreground text-sm">
            &copy; {new Date().getFullYear()} Prima. All rights reserved.
          </p>
          <p className="text-muted-foreground text-sm">Made for distribution teams in Pakistan.</p>
        </div>
      </div>
    </footer>
  )
}
