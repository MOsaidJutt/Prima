import ExcelJS from 'exceljs'
import Papa from 'papaparse'

// Shared spreadsheet parsing for import endpoints. Replaces the abandoned
// `xlsx` (SheetJS) npm package (GHSA-4r6h-8v6p-xvw6 prototype pollution,
// GHSA-5pgg-2g8v-p4x9 ReDoS — no fix published to the npm registry).
// Supported formats: .csv (papaparse) and .xlsx (exceljs). Legacy binary
// .xls is NOT supported — callers should tell users to re-save as .xlsx.

/**
 * Parse an uploaded CSV/XLSX file into an array of records keyed by the
 * header row, with '' for empty cells (mirrors sheet_to_json defval: '').
 */
export async function parseSpreadsheet(
  buffer: Buffer,
  filename: string
): Promise<Record<string, string>[]> {
  if (/\.csv$/i.test(filename)) {
    return parseCsv(buffer.toString('utf8'))
  }
  return parseXlsx(buffer)
}

function parseCsv(text: string): Record<string, string>[] {
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transform: (v) => v.trim(),
  })
  if (result.errors.some((e) => e.type === 'Delimiter')) {
    throw new Error('Invalid CSV file')
  }
  return result.data
}

async function parseXlsx(buffer: Buffer): Promise<Record<string, string>[]> {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer)
  const sheet = workbook.worksheets[0]
  if (!sheet) return []

  // Header row → column keys
  const headerRow = sheet.getRow(1)
  const headers: string[] = []
  headerRow.eachCell({ includeEmpty: true }, (cell, col) => {
    headers[col] = cellText(cell.value).trim()
  })

  const rows: Record<string, string>[] = []
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return
    const record: Record<string, string> = {}
    for (let col = 1; col < headers.length; col++) {
      const key = headers[col]
      if (!key) continue
      record[key] = cellText(row.getCell(col).value)
    }
    // skip fully empty rows
    if (Object.values(record).some((v) => v !== '')) rows.push(record)
  })
  return rows
}

function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'object') {
    if ('richText' in value) return value.richText.map((r) => r.text).join('')
    if ('text' in value) return String(value.text)
    if ('result' in value) return value.result === undefined ? '' : String(value.result)
    if (value instanceof Date) return value.toISOString()
    return String(value)
  }
  return String(value)
}
