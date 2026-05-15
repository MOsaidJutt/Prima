import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

const styles = StyleSheet.create({
  page: { padding: 32, fontFamily: 'Helvetica', fontSize: 10, color: '#020617' },
  title: { fontSize: 16, fontFamily: 'Helvetica-Bold', marginBottom: 16, color: '#0F172A' },
  table: { width: '100%' },
  headerRow: {
    flexDirection: 'row',
    backgroundColor: '#0F172A',
    paddingVertical: 6,
    paddingHorizontal: 8,
    marginBottom: 0,
  },
  headerCell: { color: '#FFFFFF', fontFamily: 'Helvetica-Bold', flex: 1, fontSize: 9 },
  row: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingVertical: 5,
    paddingHorizontal: 8,
  },
  rowAlt: { backgroundColor: '#F8FAFC' },
  cell: { flex: 1, fontSize: 9, color: '#020617' },
  footer: { marginTop: 24, fontSize: 8, color: '#94A3B8', textAlign: 'center' },
})

interface DashboardPDFProps {
  title: string
  columns: { key: string; label: string }[]
  data: Record<string, unknown>[]
}

export function DashboardPDF({ title, columns, data }: DashboardPDFProps) {
  const now = new Date().toLocaleDateString('en-PK', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <Text style={styles.title}>{title}</Text>
        <Text style={{ fontSize: 8, color: '#64748B', marginBottom: 12 }}>Generated: {now}</Text>

        <View style={styles.table}>
          <View style={styles.headerRow}>
            {columns.map((col) => (
              <Text key={col.key} style={styles.headerCell}>
                {col.label}
              </Text>
            ))}
          </View>

          {data.map((row, i) => (
            <View key={i} style={[styles.row, i % 2 === 1 ? styles.rowAlt : {}]}>
              {columns.map((col) => (
                <Text key={col.key} style={styles.cell}>
                  {row[col.key] === null || row[col.key] === undefined ? '—' : String(row[col.key])}
                </Text>
              ))}
            </View>
          ))}
        </View>

        <Text style={styles.footer}>Prima DSR Platform — Exported {now}</Text>
      </Page>
    </Document>
  )
}
