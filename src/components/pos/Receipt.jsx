import { formatDateTimeART } from '@/components/argentina'

const METHOD_LABELS = { efectivo: 'Efectivo', transferencia: 'Transferencia', qr: 'QR', tarjeta: 'Tarjeta', fiado: 'Fiado' }

function parsePaymentMethod(method) {
  if (!method) return [{ label: '—', amount: null }]
  if (method.includes('|')) {
    return method.split('|').map(part => {
      const [m, amt] = part.split(':')
      return { label: METHOD_LABELS[m] || m, amount: Number(amt) || null }
    })
  }
  if (method.includes(':')) {
    const [m, amt] = method.split(':')
    return [{ label: METHOD_LABELS[m] || m, amount: Number(amt) || null }]
  }
  return [{ label: METHOD_LABELS[method] || method, amount: null }]
}

export default function Receipt({ sale }) {
  if (!sale) return null
  const paymentParts = parsePaymentMethod(sale.payment_method)
  const isSplit = paymentParts.length > 1
  return (
    <div id="receipt-content" style={{ fontFamily: 'monospace', width: '80mm', padding: '4mm' }}>
      <div style={{ textAlign: 'center', borderBottom: '1px dashed #000', paddingBottom: '4px', marginBottom: '8px' }}>
        <div style={{ fontWeight: 'bold', fontSize: '14px' }}>GLIVAC</div>
        <div style={{ fontSize: '10px' }}>Sistema de Gestión</div>
      </div>
      <div style={{ fontSize: '10px', marginBottom: '8px' }}>
        <div>Ticket: {sale.sale_number}</div>
        <div>Fecha: {formatDateTimeART(sale.created_at)}</div>
        <div>Cajero: {sale.cashier}</div>
      </div>
      <div style={{ borderTop: '1px dashed #000', borderBottom: '1px dashed #000', padding: '4px 0', marginBottom: '8px' }}>
        {(sale.items || []).map((item, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px' }}>
            <span>{item.product_name} ×{item.quantity}</span>
            <span>${(item.subtotal || 0).toLocaleString('es-AR')}</span>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '12px', marginBottom: '8px' }}>
        <span>TOTAL</span>
        <span>${(sale.total || 0).toLocaleString('es-AR')}</span>
      </div>
      <div style={{ fontSize: '10px', marginBottom: '8px' }}>
        {isSplit ? (
          <div>
            <div>Pago combinado:</div>
            {paymentParts.map((p, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', paddingLeft: '8px' }}>
                <span>{p.label}</span>
                {p.amount != null && <span>${p.amount.toLocaleString('es-AR')}</span>}
              </div>
            ))}
          </div>
        ) : (
          <div>Pago: {paymentParts[0].label}</div>
        )}
      </div>
      <div style={{ textAlign: 'center', fontSize: '10px', borderTop: '1px dashed #000', paddingTop: '4px' }}>
        ¡Gracias por su compra!
      </div>
    </div>
  )
}
