import { Document, Page, Text, View, StyleSheet, renderToBuffer, Font } from '@react-pdf/renderer'

Font.register({
  family: 'Inter',
  fonts: [
    {
      src: 'https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiA.woff2',
    },
  ],
})

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: '#020617',
    padding: '40 50',
    backgroundColor: '#FFFFFF',
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 32 },
  orgName: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: '#0F172A', marginBottom: 4 },
  orgMeta: { fontSize: 9, color: '#64748B', marginBottom: 2 },
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
  col_qty: { flex: 1, textAlign: 'right' },
  col_price: { flex: 2, textAlign: 'right' },
  col_tax: { flex: 1, textAlign: 'right' },
  col_total: { flex: 2, textAlign: 'right' },
  totalsSection: { marginTop: 16, alignItems: 'flex-end' },
  totalsRow: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 6, width: 240 },
  totalsLabel: { flex: 1, textAlign: 'right', color: '#64748B', paddingRight: 16 },
  totalsValue: { width: 90, textAlign: 'right', fontFamily: 'Helvetica-Bold' },
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
    width: 90,
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
    PARTIALLY_PAID: '#F59E0B',
    PAID: '#22C55E',
    OVERDUE: '#EF4444',
    CANCELLED: '#DC2626',
  }
  return map[status] ?? '#94A3B8'
}

interface InvoicePdfProps {
  invoice: {
    invoiceNumber: string
    status: string
    issueDate: Date
    dueDate: Date | null
    subtotal: { toString(): string }
    taxTotal: { toString(): string }
    discountTotal: { toString(): string }
    shippingAmount: { toString(): string }
    grandTotal: { toString(): string }
    notes: string | null
    terms: string | null
    lineItems: Array<{
      description: string
      quantity: number
      unitPrice: { toString(): string }
      taxRate: { toString(): string }
      taxAmount: { toString(): string }
      lineTotal: { toString(): string }
      product?: { name: string; sku: string } | null
    }>
    client: {
      companyName: string
      contactName: string | null
      email: string | null
      phone: string | null
      address: string | null
      city: string | null
    }
    template?: {
      taxLabel: string
      primaryColor: string | null
    } | null
  }
  org?: {
    name: string
    address: string | null
    city: string | null
    phone: string | null
    email: string | null
    ntn: string | null
    logoLight: string | null
  } | null
}

function InvoiceDocument({ invoice, org }: InvoicePdfProps) {
  const taxLabel = invoice.template?.taxLabel ?? 'GST'
  const primaryColor = invoice.template?.primaryColor ?? '#0F172A'
  const sub = Number(invoice.subtotal)
  const tax = Number(invoice.taxTotal)
  const disc = Number(invoice.discountTotal)
  const ship = Number(invoice.shippingAmount)
  const grand = Number(invoice.grandTotal)

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={[styles.orgName, { color: primaryColor }]}>{org?.name ?? 'Company'}</Text>
            {org?.address && <Text style={styles.orgMeta}>{org.address}</Text>}
            {org?.city && <Text style={styles.orgMeta}>{org.city}</Text>}
            {org?.phone && <Text style={styles.orgMeta}>{org.phone}</Text>}
            {org?.email && <Text style={styles.orgMeta}>{org.email}</Text>}
            {org?.ntn && <Text style={styles.orgMeta}>NTN: {org.ntn}</Text>}
          </View>
          <View>
            <Text style={styles.invoiceTitle}>INVOICE</Text>
            <Text style={styles.invoiceMeta}>#{invoice.invoiceNumber}</Text>
            <Text style={styles.invoiceMeta}>
              Date: {new Date(invoice.issueDate).toLocaleDateString('en-PK')}
            </Text>
            {invoice.dueDate && (
              <Text style={styles.invoiceMeta}>
                Due: {new Date(invoice.dueDate).toLocaleDateString('en-PK')}
              </Text>
            )}
            <View style={{ alignItems: 'flex-end', marginTop: 6 }}>
              <View
                style={[
                  styles.statusBadge,
                  { backgroundColor: statusColor(invoice.status), color: '#FFFFFF' },
                ]}
              >
                <Text style={{ color: '#FFFFFF', fontSize: 9 }}>
                  {invoice.status.replace('_', ' ')}
                </Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Bill To */}
        <View style={styles.billTo}>
          <Text style={styles.sectionLabel}>Bill To</Text>
          <Text style={styles.clientName}>{invoice.client.companyName}</Text>
          {invoice.client.contactName && (
            <Text style={styles.clientMeta}>{invoice.client.contactName}</Text>
          )}
          {invoice.client.email && <Text style={styles.clientMeta}>{invoice.client.email}</Text>}
          {invoice.client.phone && <Text style={styles.clientMeta}>{invoice.client.phone}</Text>}
          {invoice.client.address && (
            <Text style={styles.clientMeta}>{invoice.client.address}</Text>
          )}
          {invoice.client.city && <Text style={styles.clientMeta}>{invoice.client.city}</Text>}
        </View>

        {/* Line Items Table */}
        <View style={styles.tableHeader}>
          <Text style={[styles.tableHeaderText, styles.col_desc]}>Description</Text>
          <Text style={[styles.tableHeaderText, styles.col_qty]}>Qty</Text>
          <Text style={[styles.tableHeaderText, styles.col_price]}>Unit Price</Text>
          <Text style={[styles.tableHeaderText, styles.col_tax]}>{taxLabel}%</Text>
          <Text style={[styles.tableHeaderText, styles.col_total]}>Total</Text>
        </View>

        {invoice.lineItems.map((li, i) => (
          <View key={i} style={i % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
            <Text style={styles.col_desc}>{li.description}</Text>
            <Text style={styles.col_qty}>{li.quantity}</Text>
            <Text style={styles.col_price}>{fmt(Number(li.unitPrice))}</Text>
            <Text style={styles.col_tax}>{Number(li.taxRate)}%</Text>
            <Text style={styles.col_total}>{fmt(Number(li.lineTotal))}</Text>
          </View>
        ))}

        {/* Totals */}
        <View style={styles.totalsSection}>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>Subtotal</Text>
            <Text style={styles.totalsValue}>{fmt(sub)}</Text>
          </View>
          {disc > 0 && (
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Discount</Text>
              <Text style={[styles.totalsValue, { color: '#22C55E' }]}>- {fmt(disc)}</Text>
            </View>
          )}
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>{taxLabel}</Text>
            <Text style={styles.totalsValue}>{fmt(tax)}</Text>
          </View>
          {ship > 0 && (
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Shipping</Text>
              <Text style={styles.totalsValue}>{fmt(ship)}</Text>
            </View>
          )}
          <View style={styles.grandTotalRow}>
            <Text style={styles.grandTotalLabel}>Total Due</Text>
            <Text style={styles.grandTotalValue}>{fmt(grand)}</Text>
          </View>
        </View>

        {/* Notes */}
        {(invoice.notes || invoice.terms) && (
          <View style={styles.notes}>
            {invoice.notes && (
              <Text style={{ fontFamily: 'Helvetica-Bold', marginBottom: 4 }}>Notes</Text>
            )}
            {invoice.notes && <Text>{invoice.notes}</Text>}
            {invoice.terms && (
              <Text style={{ fontFamily: 'Helvetica-Bold', marginTop: 8, marginBottom: 4 }}>
                Terms & Conditions
              </Text>
            )}
            {invoice.terms && <Text>{invoice.terms}</Text>}
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text>Invoice #{invoice.invoiceNumber}</Text>
          <Text>Generated by Prima</Text>
          <Text>
            Page <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
          </Text>
        </View>
      </Page>
    </Document>
  )
}

export async function renderInvoicePdf(props: InvoicePdfProps): Promise<Buffer> {
  return renderToBuffer(<InvoiceDocument {...props} />)
}
