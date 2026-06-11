import { Document, Page, Text, View, StyleSheet, renderToBuffer, Font } from '@react-pdf/renderer'

Font.register({
  family: 'Inter',
  fonts: [
    {
      src: 'https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiA.woff2',
    },
  ],
})

// Prima's own branding — platform invoices are issued BY Prima TO the tenant,
// so this is intentionally hardcoded rather than pulled from org branding fields.
const PRIMA_BRAND = {
  name: 'Prima',
  tagline: 'Intelligent Sales Management Platform',
  address: 'Plot 12, Block 6, PECHS',
  city: 'Karachi, Pakistan',
  email: 'billing@prima.app',
  website: 'www.prima.app',
}

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: '#020617',
    padding: '40 50',
    backgroundColor: '#FFFFFF',
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 32 },
  brandName: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: '#0F172A', marginBottom: 4 },
  brandMeta: { fontSize: 9, color: '#64748B', marginBottom: 2 },
  invoiceTitle: {
    fontSize: 28,
    fontFamily: 'Helvetica-Bold',
    color: '#0F172A',
    textAlign: 'right',
  },
  invoiceMeta: { fontSize: 10, color: '#334155', textAlign: 'right', marginTop: 4 },
  sectionLabel: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  billTo: { marginBottom: 24 },
  clientName: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#0F172A', marginBottom: 2 },
  clientMeta: { fontSize: 9, color: '#475569', marginBottom: 2 },
  divider: { borderBottom: '1 solid #E2E8F0', marginBottom: 16 },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    padding: '8 12',
    borderRadius: 4,
    marginBottom: 4,
  },
  tableHeaderText: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: '#64748B',
    textTransform: 'uppercase',
  },
  tableRow: { flexDirection: 'row', padding: '8 12', borderBottom: '1 solid #F1F5F9' },
  tableRowAlt: {
    flexDirection: 'row',
    padding: '8 12',
    borderBottom: '1 solid #F1F5F9',
    backgroundColor: '#FAFAFA',
  },
  col_desc: { flex: 4 },
  col_total: { flex: 2, textAlign: 'right' },
  totalsSection: { marginTop: 16, alignItems: 'flex-end' },
  totalsRow: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 6, width: 240 },
  totalsLabel: { flex: 1, textAlign: 'right', color: '#64748B', paddingRight: 16 },
  totalsValue: { width: 110, textAlign: 'right', fontFamily: 'Helvetica-Bold' },
  grandTotalRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
    width: 240,
    backgroundColor: '#0F172A',
    padding: '8 12',
    borderRadius: 4,
  },
  grandTotalLabel: {
    flex: 1,
    textAlign: 'right',
    color: '#FFFFFF',
    paddingRight: 16,
    fontFamily: 'Helvetica-Bold',
  },
  grandTotalValue: {
    width: 110,
    textAlign: 'right',
    color: '#FFFFFF',
    fontFamily: 'Helvetica-Bold',
    fontSize: 12,
  },
  statusBadge: {
    padding: '4 10',
    borderRadius: 20,
    textAlign: 'center',
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
  },
  notes: { marginTop: 24, fontSize: 9, color: '#475569' },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 50,
    right: 50,
    fontSize: 8,
    color: '#94A3B8',
    borderTop: '1 solid #E2E8F0',
    paddingTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
})

function fmt(n: number) {
  return `PKR ${n.toLocaleString('en-PK', { minimumFractionDigits: 2 })}`
}

function statusColor(status: string) {
  const map: Record<string, string> = {
    DRAFT: '#94A3B8',
    ISSUED: '#0369A1',
    PAID: '#22C55E',
    OVERDUE: '#EF4444',
    CANCELLED: '#DC2626',
  }
  return map[status] ?? '#94A3B8'
}

interface PlatformInvoicePdfProps {
  invoice: {
    invoiceNumber: string
    status: string
    issueDate: Date
    dueDate: Date
    periodStart: Date
    periodEnd: Date
    subscriptionFee: { toString(): string }
    setupFee: { toString(): string }
    tokenTopUpTotal: { toString(): string }
    discount: { toString(): string }
    totalAmount: { toString(): string }
    notes: string | null
  }
  org: {
    name: string
    plan: string
    billingEmail: string | null
    email: string
  }
}

function PlatformInvoiceDocument({ invoice, org }: PlatformInvoicePdfProps) {
  const subscriptionFee = Number(invoice.subscriptionFee)
  const setupFee = Number(invoice.setupFee)
  const tokenTopUpTotal = Number(invoice.tokenTopUpTotal)
  const discount = Number(invoice.discount)
  const total = Number(invoice.totalAmount)

  const lineItems: Array<{ description: string; amount: number }> = [
    { description: `${org.plan} plan subscription`, amount: subscriptionFee },
  ]
  if (setupFee > 0) lineItems.push({ description: 'One-time setup fee', amount: setupFee })
  if (tokenTopUpTotal > 0)
    lineItems.push({ description: 'AI token top-ups', amount: tokenTopUpTotal })

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.brandName}>{PRIMA_BRAND.name}</Text>
            <Text style={styles.brandMeta}>{PRIMA_BRAND.tagline}</Text>
            <Text style={styles.brandMeta}>{PRIMA_BRAND.address}</Text>
            <Text style={styles.brandMeta}>{PRIMA_BRAND.city}</Text>
            <Text style={styles.brandMeta}>{PRIMA_BRAND.email}</Text>
            <Text style={styles.brandMeta}>{PRIMA_BRAND.website}</Text>
          </View>
          <View>
            <Text style={styles.invoiceTitle}>INVOICE</Text>
            <Text style={styles.invoiceMeta}>#{invoice.invoiceNumber}</Text>
            <Text style={styles.invoiceMeta}>
              Date: {new Date(invoice.issueDate).toLocaleDateString('en-PK')}
            </Text>
            <Text style={styles.invoiceMeta}>
              Due: {new Date(invoice.dueDate).toLocaleDateString('en-PK')}
            </Text>
            <View style={{ alignItems: 'flex-end', marginTop: 6 }}>
              <View
                style={[
                  styles.statusBadge,
                  { backgroundColor: statusColor(invoice.status), color: '#FFFFFF' },
                ]}
              >
                <Text style={{ color: '#FFFFFF', fontSize: 9 }}>{invoice.status}</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Bill To */}
        <View style={styles.billTo}>
          <Text style={styles.sectionLabel}>Billed To</Text>
          <Text style={styles.clientName}>{org.name}</Text>
          <Text style={styles.clientMeta}>{org.billingEmail ?? org.email}</Text>
          <Text style={styles.clientMeta}>
            Billing period: {new Date(invoice.periodStart).toLocaleDateString('en-PK')} –{' '}
            {new Date(invoice.periodEnd).toLocaleDateString('en-PK')}
          </Text>
        </View>

        {/* Line Items Table */}
        <View style={styles.tableHeader}>
          <Text style={[styles.tableHeaderText, styles.col_desc]}>Description</Text>
          <Text style={[styles.tableHeaderText, styles.col_total]}>Amount</Text>
        </View>

        {lineItems.map((li, i) => (
          <View key={i} style={i % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
            <Text style={styles.col_desc}>{li.description}</Text>
            <Text style={styles.col_total}>{fmt(li.amount)}</Text>
          </View>
        ))}

        {/* Totals */}
        <View style={styles.totalsSection}>
          {discount > 0 && (
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Discount</Text>
              <Text style={[styles.totalsValue, { color: '#22C55E' }]}>- {fmt(discount)}</Text>
            </View>
          )}
          <View style={styles.grandTotalRow}>
            <Text style={styles.grandTotalLabel}>Total Due</Text>
            <Text style={styles.grandTotalValue}>{fmt(total)}</Text>
          </View>
        </View>

        {/* Notes */}
        {invoice.notes && (
          <View style={styles.notes}>
            <Text style={{ fontFamily: 'Helvetica-Bold', marginBottom: 4 }}>Notes</Text>
            <Text>{invoice.notes}</Text>
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text>Invoice #{invoice.invoiceNumber}</Text>
          <Text>
            {PRIMA_BRAND.name} · {PRIMA_BRAND.website}
          </Text>
          <Text>
            Page <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
          </Text>
        </View>
      </Page>
    </Document>
  )
}

export async function renderPlatformInvoicePdf(props: PlatformInvoicePdfProps): Promise<Buffer> {
  return renderToBuffer(<PlatformInvoiceDocument {...props} />)
}
