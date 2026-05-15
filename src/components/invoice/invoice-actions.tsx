'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Send, Copy, XCircle, CheckCircle2, ChevronDown, Download, Pencil } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'

interface InvoiceActionsProps {
  invoice: { id: string; status: string; invoiceNumber: string }
}

export function InvoiceActions({ invoice }: InvoiceActionsProps) {
  const [loading, setLoading] = useState('')
  const router = useRouter()

  async function action(type: string) {
    setLoading(type)
    try {
      const res = await fetch(`/api/v1/invoices/${invoice.id}/${type}`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? `Failed: ${type}`)
        return
      }
      if (type === 'duplicate') {
        toast.success('Invoice duplicated')
        router.push(`/admin/invoices/${data.id}`)
      } else {
        toast.success(
          type === 'issue'
            ? 'Invoice issued'
            : type === 'send'
              ? 'Invoice sent to client'
              : type === 'cancel'
                ? 'Invoice cancelled'
                : 'Done'
        )
        router.refresh()
      }
    } finally {
      setLoading('')
    }
  }

  async function downloadPdf() {
    setLoading('pdf')
    try {
      const res = await fetch(`/api/v1/invoices/${invoice.id}/pdf`)
      if (!res.ok) {
        toast.error('PDF generation failed')
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `invoice-${invoice.invoiceNumber}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setLoading('')
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {invoice.status === 'DRAFT' && (
        <Button onClick={() => action('issue')} disabled={loading === 'issue'}>
          <CheckCircle2 className="mr-2 h-4 w-4" />
          {loading === 'issue' ? 'Issuing…' : 'Issue Invoice'}
        </Button>
      )}
      {invoice.status === 'DRAFT' && (
        <Button variant="outline" asChild>
          <Link href={`/admin/invoices/${invoice.id}/edit`}>
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </Link>
        </Button>
      )}
      {['ISSUED', 'PARTIALLY_PAID', 'OVERDUE'].includes(invoice.status) && (
        <Button variant="outline" onClick={() => action('send')} disabled={loading === 'send'}>
          <Send className="mr-2 h-4 w-4" />
          {loading === 'send' ? 'Sending…' : 'Send Email'}
        </Button>
      )}
      <Button variant="outline" onClick={downloadPdf} disabled={loading === 'pdf'}>
        <Download className="mr-2 h-4 w-4" />
        {loading === 'pdf' ? 'Generating…' : 'Download PDF'}
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon">
            <ChevronDown className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => action('duplicate')} disabled={!!loading}>
            <Copy className="mr-2 h-4 w-4" />
            Duplicate
          </DropdownMenuItem>
          {!['PAID', 'CANCELLED'].includes(invoice.status) && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => action('cancel')}
                disabled={!!loading}
                className="text-destructive"
              >
                <XCircle className="mr-2 h-4 w-4" />
                Cancel Invoice
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
