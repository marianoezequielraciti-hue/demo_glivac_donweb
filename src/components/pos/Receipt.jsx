import { formatDateTimeART } from '@/components/argentina'

export default function Receipt({ sale }) {
  if (!sale) return null
  return (
    <div id="receipt-content" style={{ fontFamily: 'monospace', width: '80mm', padding: '4mm' }}>
      <div style={{ textAlign: 'center', borderBottom: '1px dashed #000', paddingBottom: '4px', marginBottom: '8px' }}>
        <div style={{ fontWeight: 'bold', fontSize: '14px' }}>FIAMBRERÍAS VALE</div>
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
        Pago: {sale.payment_method}
      </div>
      <div style={{ textAlign: 'center', fontSize: '10px', borderTop: '1px dashed #000', paddingTop: '4px' }}>
        ¡Gracias por su compra!
      </div>
    </div>
  )
}
