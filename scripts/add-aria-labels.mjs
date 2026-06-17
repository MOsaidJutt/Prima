// One-off Phase 7 codemod: add aria-label to icon-only buttons.
// Run: node scripts/add-aria-labels.mjs  (idempotent; safe to delete after)
import { readFileSync, writeFileSync } from 'fs'

const edits = [
  {
    file: 'src/components/dsr/dsr-form.tsx',
    find: 'size="icon" onClick={() => remove(idx)}',
    replace: 'size="icon" aria-label="Remove item" onClick={() => remove(idx)}',
  },
  {
    file: 'src/components/invoice/invoice-form.tsx',
    find: 'size="icon" onClick={() => remove(idx)}',
    replace: 'size="icon" aria-label="Remove item" onClick={() => remove(idx)}',
  },
  {
    file: 'src/components/ai/chat-interface.tsx',
    find: '<Button type="submit" size="icon" disabled=',
    replace: '<Button type="submit" size="icon" aria-label="Send message" disabled=',
  },
  {
    file: 'src/components/invoice/invoice-actions.tsx',
    find: '<Button variant="outline" size="icon">',
    replace: '<Button variant="outline" size="icon" aria-label="More invoice actions">',
  },
  {
    file: 'src/components/ai/chat-float.tsx',
    find: '<Button variant="ghost" size="icon" className="h-6 w-6">',
    replace:
      '<Button variant="ghost" size="icon" aria-label="Open full assistant" className="h-6 w-6">',
  },
  {
    file: 'src/components/ai/chat-float.tsx',
    find: 'size="icon"\n                className="h-6 w-6"\n                onClick={() => setOpen(false)}',
    replace:
      'size="icon"\n                aria-label="Close chat"\n                className="h-6 w-6"\n                onClick={() => setOpen(false)}',
  },
  {
    file: 'src/components/layout/sidebar.tsx',
    find: 'size="icon"\n          onClick={() => setCollapsed(!collapsed)}',
    replace:
      'size="icon"\n          aria-label={collapsed ? \'Expand sidebar\' : \'Collapse sidebar\'}\n          onClick={() => setCollapsed(!collapsed)}',
  },
  {
    file: 'src/components/layout/top-bar.tsx',
    find: '<Button variant="ghost" size="icon" className="h-9 w-9 rounded-full">',
    replace:
      '<Button variant="ghost" size="icon" aria-label="Account menu" className="h-9 w-9 rounded-full">',
  },
  {
    file: 'src/app/(super-admin)/super-admin/organizations/[id]/page.tsx',
    find: '<Button variant="ghost" size="icon" asChild>\n          <Link href="/super-admin/organizations">',
    replace:
      '<Button variant="ghost" size="icon" aria-label="Back to organizations" asChild>\n          <Link href="/super-admin/organizations">',
  },
  {
    file: 'src/app/(super-admin)/super-admin/organizations/[id]/billing/page.tsx',
    find: '<Button variant="ghost" size="icon" asChild>\n          <Link href={`/super-admin/organizations/${id}`}>',
    replace:
      '<Button variant="ghost" size="icon" aria-label="Back to organization" asChild>\n          <Link href={`/super-admin/organizations/${id}`}>',
  },
  {
    file: 'src/app/(tenant)/admin/users/[id]/page.tsx',
    find: '<Button variant="ghost" size="icon" asChild>\n            <Link href="/admin/users">',
    replace:
      '<Button variant="ghost" size="icon" aria-label="Back to users" asChild>\n            <Link href="/admin/users">',
  },
  {
    file: 'src/app/(tenant)/admin/users/new/page.tsx',
    find: '<Button variant="ghost" size="icon" asChild>\n          <Link href="/admin/users">',
    replace:
      '<Button variant="ghost" size="icon" aria-label="Back to users" asChild>\n          <Link href="/admin/users">',
  },
  {
    file: 'src/app/(tenant)/admin/users/page.tsx',
    find: 'size="icon" onClick={fetchUsers}>',
    replace: 'size="icon" aria-label="Refresh users" onClick={fetchUsers}>',
  },
  {
    file: 'src/app/(tenant)/admin/users/page.tsx',
    find: '<Button variant="ghost" size="icon">\n                              <MoreHorizontal',
    replace:
      '<Button variant="ghost" size="icon" aria-label="User actions">\n                              <MoreHorizontal',
  },
  {
    file: 'src/app/(tenant)/admin/settings/roles/[id]/page.tsx',
    find: '<Button variant="ghost" size="icon" asChild>\n          <Link href="/admin/settings/roles">',
    replace:
      '<Button variant="ghost" size="icon" aria-label="Back to roles" asChild>\n          <Link href="/admin/settings/roles">',
  },
  {
    file: 'src/app/(tenant)/admin/settings/roles/new/page.tsx',
    find: '<Button variant="ghost" size="icon" asChild>\n          <Link href="/admin/settings/roles">',
    replace:
      '<Button variant="ghost" size="icon" aria-label="Back to roles" asChild>\n          <Link href="/admin/settings/roles">',
  },
  {
    file: 'src/app/(tenant)/admin/settings/roles/page.tsx',
    find: '<Button variant="ghost" size="icon" asChild>',
    replace: '<Button variant="ghost" size="icon" aria-label="Edit role" asChild>',
    all: true,
  },
  {
    file: 'src/app/(tenant)/admin/settings/roles/page.tsx',
    find: 'size="icon"\n                                  disabled={role._count.users > 0}',
    replace:
      'size="icon"\n                                  aria-label="Delete role"\n                                  disabled={role._count.users > 0}',
  },
  {
    file: 'src/app/(tenant)/admin/settings/audit-log/page.tsx',
    find: 'size="icon" onClick={fetchLogs}>',
    replace: 'size="icon" aria-label="Refresh audit log" onClick={fetchLogs}>',
  },
  {
    file: 'src/app/(tenant)/admin/settings/departments/page.tsx',
    find: 'size="icon" onClick={() => openEdit(dept)}>',
    replace: 'size="icon" aria-label="Edit department" onClick={() => openEdit(dept)}>',
  },
  {
    file: 'src/app/(tenant)/admin/settings/departments/page.tsx',
    find: 'size="icon"\n                                    disabled={dept._count.users > 0}',
    replace:
      'size="icon"\n                                    aria-label="Delete department"\n                                    disabled={dept._count.users > 0}',
  },
  {
    file: 'src/app/(tenant)/admin/distributors/page.tsx',
    find: '<Button variant="ghost" size="icon" className="h-8 w-8">',
    replace:
      '<Button variant="ghost" size="icon" aria-label="Distributor actions" className="h-8 w-8">',
  },
  {
    file: 'src/app/(tenant)/admin/products/page.tsx',
    find: '<Button variant="ghost" size="icon" className="h-8 w-8">',
    replace:
      '<Button variant="ghost" size="icon" aria-label="Product actions" className="h-8 w-8">',
  },
  {
    file: 'src/app/(tenant)/admin/clients/page.tsx',
    find: '<Button variant="ghost" size="icon" className="h-8 w-8">',
    replace:
      '<Button variant="ghost" size="icon" aria-label="Client actions" className="h-8 w-8">',
  },
  {
    file: 'src/app/(tenant)/admin/recommendations/page.tsx',
    find: 'size="icon"\n            disabled={page <= 1}',
    replace: 'size="icon"\n            aria-label="Previous page"\n            disabled={page <= 1}',
  },
  {
    file: 'src/app/(tenant)/admin/recommendations/page.tsx',
    find: 'size="icon"\n            disabled={page >= totalPages}',
    replace:
      'size="icon"\n            aria-label="Next page"\n            disabled={page >= totalPages}',
  },
]

let applied = 0
let skipped = 0
for (const { file, find, replace, all } of edits) {
  const src = readFileSync(file, 'utf8')
  if (!src.includes(find)) {
    if (src.includes(replace)) {
      skipped++ // already applied
      continue
    }
    console.error(`NOT FOUND in ${file}:\n${find}\n`)
    continue
  }
  const out = all ? src.split(find).join(replace) : src.replace(find, replace)
  writeFileSync(file, out)
  applied++
}
console.log(`applied=${applied} alreadyDone=${skipped} total=${edits.length}`)
