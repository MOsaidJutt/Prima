'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Download, FileSpreadsheet, FileText, FileBarChart2 } from 'lucide-react'
import { toast } from 'sonner'

interface ExportButtonProps {
  data: Record<string, unknown>[]
  filename: string
  pdfTitle?: string
  columns?: { key: string; label: string }[]
}

export function ExportButton({ data, filename, columns }: ExportButtonProps) {
  const [exporting, setExporting] = useState(false)

  async function exportCSV() {
    setExporting(true)
    try {
      const cols =
        columns ?? (data[0] ? Object.keys(data[0]).map((k) => ({ key: k, label: k })) : [])
      const header = cols.map((c) => c.label).join(',')
      const rows = data.map((row) =>
        cols
          .map((c) => {
            const val = row[c.key]
            const str = val === null || val === undefined ? '' : String(val)
            return str.includes(',') || str.includes('"') ? `"${str.replace(/"/g, '""')}"` : str
          })
          .join(',')
      )
      const csv = [header, ...rows].join('\n')
      const blob = new Blob([csv], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${filename}.csv`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('CSV exported')
    } catch {
      toast.error('Export failed')
    } finally {
      setExporting(false)
    }
  }

  async function exportExcel() {
    setExporting(true)
    try {
      const ExcelJS = await import('exceljs')
      const wb = new ExcelJS.Workbook()
      const ws = wb.addWorksheet('Data')

      const cols =
        columns ?? (data[0] ? Object.keys(data[0]).map((k) => ({ key: k, label: k })) : [])
      ws.columns = cols.map((c) => ({ header: c.label, key: c.key, width: 18 }))
      ws.getRow(1).font = { bold: true }
      ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } }
      ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }

      data.forEach((row) => ws.addRow(row))

      const buffer = await wb.xlsx.writeBuffer()
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${filename}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Excel exported')
    } catch {
      toast.error('Export failed')
    } finally {
      setExporting(false)
    }
  }

  async function exportPDF() {
    setExporting(true)
    try {
      const { pdf } = await import('@react-pdf/renderer')
      const { DashboardPDF } = await import('./dashboard-pdf')
      const cols =
        columns ?? (data[0] ? Object.keys(data[0]).map((k) => ({ key: k, label: k })) : [])
      const blob = await pdf(<DashboardPDF title={filename} columns={cols} data={data} />).toBlob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${filename}.pdf`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('PDF exported')
    } catch {
      toast.error('PDF export failed')
    } finally {
      setExporting(false)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1.5" disabled={exporting}>
          <Download className="h-3.5 w-3.5" />
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={exportCSV} className="gap-2">
          <FileText className="h-4 w-4" />
          CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportExcel} className="gap-2">
          <FileSpreadsheet className="h-4 w-4" />
          Excel
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportPDF} className="gap-2">
          <FileBarChart2 className="h-4 w-4" />
          PDF Snapshot
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
