import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { exportToXlsx, SCANNER_COLUMNS } from '@/lib/xlsxUtils'
import { toast } from 'sonner'
import { Upload, Sparkles, Download, Loader2 } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'

export default function InvoiceScanner() {
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [processing, setProcessing] = useState(false)
  const [supplier, setSupplier] = useState('')
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [items, setItems] = useState([])

  const { user } = useAuth()
  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const { data } = await supabase.from('products').select('*')
      return data || []
    },
    enabled: !!user,
  })

  const handleFileChange = (e) => {
    const selected = e.target.files?.[0]
    if (!selected) return
    setFile(selected)
    setPreview(URL.createObjectURL(selected))
    setItems([])
  }

  const fileToBase64 = (f) => new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result.split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(f)
  })

  const handleProcess = async () => {
    if (!file) { toast.error('Seleccioná una imagen primero'); return }
    const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY
    if (!apiKey) { toast.error('Falta VITE_ANTHROPIC_API_KEY en .env'); return }

    setProcessing(true)
    try {
      const base64 = await fileToBase64(file)
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-opus-4-5',
          max_tokens: 2000,
          messages: [{
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: file.type, data: base64 } },
              { type: 'text', text: `Analizá esta factura de proveedor. Extraé todos los productos.
Respondé SOLO con JSON válido, sin markdown ni explicaciones:
{
  "supplier": "nombre del proveedor",
  "invoice_number": "número de factura",
  "items": [
    { "name": "nombre producto", "barcode": "código si existe o vacío", "quantity": número, "purchase_price": precio_unitario_compra, "sale_price": precio_venta_sugerido }
  ]
}
Si no hay precio de venta en la factura, calculá un 40% de margen sobre el precio de compra.` }
            ]
          }]
        })
      })

      if (!res.ok) throw new Error(`API error: ${res.status}`)
      const apiData = await res.json()
      const text = apiData.content?.[0]?.text || apiData.output?.[0]?.content[0]?.text || ''
      const parsed = JSON.parse(text.replace(/```json|```/g, '').trim())

      setSupplier(parsed.supplier || '')
      setInvoiceNumber(parsed.invoice_number || '')

      const enriched = (parsed.items || []).map(item => ({
        ...item,
        match_status: products.some(p =>
          (item.barcode && p.barcode === item.barcode) ||
          (p.name || '').toLowerCase().includes((item.name || '').toLowerCase())
        ) ? 'Coincide' : 'Nuevo',
        quantity: item.quantity || 1,
        purchase_price: item.purchase_price || 0,
        sale_price: item.sale_price || 0,
      }))

      setItems(enriched)
      toast.success(`${enriched.length} producto(s) extraídos`)
    } catch (err) {
      toast.error('Error al procesar: ' + err.message)
    } finally {
      setProcessing(false)
    }
  }

  const handleExport = () => {
    if (!items.length) { toast.error('No hay items para exportar'); return }
    exportToXlsx(
      items,
      SCANNER_COLUMNS,
      `scanner_${supplier || 'factura'}_${Date.now()}`,
      'Productos Escaneados',
      {
        title: `Factura escaneada${supplier ? ' — ' + supplier : ''}`,
        subtitle: `N° ${invoiceNumber || 'S/N'} · ${new Date().toLocaleDateString('es-AR')}`,
      }
    )
  }

  const updateItem = (index, field, value) => {
    setItems(prev => prev.map((item, idx) => idx === index ? { ...item, [field]: value } : item))
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Scanner de Facturas</h1>
        <p className="text-gray-500 text-sm mt-1">Cargá una foto de tu factura y la IA extrae los productos automáticamente</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2"><Upload className="w-4 h-4" /> Cargar Factura / Remito</h2>

          <label className="block border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-blue-400 transition-colors">
            {preview
              ? <img src={preview} alt="preview" className="max-h-48 mx-auto rounded-lg object-contain" />
              : <div className="space-y-2 text-gray-400">
                <Upload className="w-10 h-10 mx-auto" />
                <div className="font-medium">Hacé clic para subir imagen</div>
                <div className="text-xs">JPG, PNG · Foto de factura o remito de proveedor</div>
              </div>
            }
            <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
          </label>

          <button
            onClick={handleProcess}
            disabled={!file || processing}
            className="w-full h-12 bg-zinc-800 hover:bg-zinc-900 disabled:opacity-50 text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors"
          >
            {processing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
            {processing ? 'Procesando con IA...' : 'Procesar con IA'}
          </button>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h2 className="font-semibold text-gray-900">Datos de la Factura</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-gray-600 block mb-1">Proveedor</label>
              <input value={supplier} onChange={e => setSupplier(e.target.value)} placeholder="Nombre del proveedor..." className="w-full h-10 px-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
            </div>
            <div>
              <label className="text-sm text-gray-600 block mb-1">N° de Factura</label>
              <input value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} placeholder="0001-00012345" className="w-full h-10 px-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
            </div>
          </div>
          {!items.length && (
            <div className="bg-zinc-50 rounded-xl p-4 text-sm text-zinc-800 space-y-1">
              <div className="font-medium">¿Cómo funciona?</div>
              <div>1. Subí una foto clara de tu factura de proveedor</div>
              <div>2. La IA lee productos, códigos de barra y precios</div>
              <div>3. Revisá y corregí los datos si es necesario</div>
              <div>4. Descargá el Excel e importalo en <strong>Compras</strong></div>
            </div>
          )}
        </div>
      </div>

      {items.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">{items.length} producto(s) extraídos</h2>
            <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-900 text-white text-sm font-medium rounded-lg transition-colors">
              <Download className="w-4 h-4" /> Descargar Excel
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-zinc-900 text-white text-left">
                  {['Código', 'Nombre', 'Cantidad', 'P. Compra', 'P. Venta', 'Estado'].map(header => (
                    <th key={header} className="px-3 py-2 font-medium text-xs uppercase tracking-wide">{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => (
                  <tr key={idx} className={idx % 2 === 0 ? 'bg-zinc-50' : 'bg-white'}>
                    <td className="px-3 py-2">
                      <input value={item.barcode || ''} onChange={e => updateItem(idx, 'barcode', e.target.value)} className="w-full bg-transparent border-b border-gray-200 focus:border-blue-400 focus:outline-none text-xs" />
                    </td>
                    <td className="px-3 py-2">
                      <input value={item.name} onChange={e => updateItem(idx, 'name', e.target.value)} className="w-full bg-transparent border-b border-gray-200 focus:border-blue-400 focus:outline-none" />
                    </td>
                    <td className="px-3 py-2">
                      <input type="number" value={item.quantity} onChange={e => updateItem(idx, 'quantity', Number(e.target.value))} className="w-16 bg-transparent border-b border-gray-200 focus:border-blue-400 focus:outline-none text-right" />
                    </td>
                    <td className="px-3 py-2">
                      <input type="number" value={item.purchase_price} onChange={e => updateItem(idx, 'purchase_price', Number(e.target.value))} className="w-24 bg-transparent border-b border-gray-200 focus:border-blue-400 focus:outline-none text-right" />
                    </td>
                    <td className="px-3 py-2">
                      <input type="number" value={item.sale_price} onChange={e => updateItem(idx, 'sale_price', Number(e.target.value))} className="w-24 bg-transparent border-b border-gray-200 focus:border-blue-400 focus:outline-none text-right" />
                    </td>
                    <td className="px-3 py-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${item.match_status === 'Coincide' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                        {item.match_status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
