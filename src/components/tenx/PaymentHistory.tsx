// 10X RPC — Payment History component
'use client'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { api } from '@/lib/api-client'
import { Receipt, CheckCircle, XCircle, Clock, RefreshCw } from 'lucide-react'

interface PaymentItem {
  id: string
  planName: string
  amount: number
  currency: string
  status: string
  orderId: string
  date: string
  verified: boolean
}

export function PaymentHistory() {
  const [payments, setPayments] = useState<PaymentItem[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = async () => {
    try {
      const res = await fetch('/api/payments/list', { credentials: 'include' })
      const data = await res.json()
      if (data.ok) {
        setPayments(data.payments || [])
      }
    } catch {}
    finally { setLoading(false) }
  }

  useEffect(() => { refresh() }, [])

  return (
    <div className="relative overflow-hidden bg-gradient-to-b from-[#13111d]/95 via-[#0e0d14]/95 to-[#0a0a0f] border border-white/10 rounded-[28px] p-6 shadow-2xl backdrop-blur-xl">
      <div className="absolute -top-16 -left-12 w-48 h-48 bg-amber-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Receipt className="w-5 h-5 text-amber-400" />
            Payment History
          </h2>
          <button
            onClick={refresh}
            className="text-[10px] text-white/40 hover:text-white flex items-center gap-1"
          >
            <RefreshCw className="w-3 h-3" />
            Refresh
          </button>
        </div>

        <div className="space-y-2 max-h-64 overflow-y-auto styled-scroll">
          {loading ? (
            <div className="text-center py-8">
              <div className="inline-block w-6 h-6 rounded-full border-2 border-amber-500/30 border-t-amber-500 animate-spin" />
              <p className="text-xs text-white/40 mt-2">Loading...</p>
            </div>
          ) : payments.length > 0 ? (
            payments.map(p => (
              <div key={p.id} className="glass-card-inner p-3 flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                  p.status === 'captured' ? 'bg-green-500/15' :
                  p.status === 'failed' || p.status === 'cancelled' ? 'bg-red-500/15' :
                  'bg-yellow-500/15'
                }`}>
                  {p.status === 'captured' ? (
                    <CheckCircle className="w-4 h-4 text-green-400" />
                  ) : p.status === 'failed' || p.status === 'cancelled' ? (
                    <XCircle className="w-4 h-4 text-red-400" />
                  ) : (
                    <Clock className="w-4 h-4 text-yellow-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white">{p.planName}</span>
                    <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded-full ${
                      p.status === 'captured' ? 'bg-green-500/20 text-green-300' :
                      p.status === 'failed' ? 'bg-red-500/20 text-red-300' :
                      'bg-yellow-500/20 text-yellow-300'
                    }`}>
                      {p.status}
                    </span>
                  </div>
                  <p className="text-[10px] text-white/30 font-mono mt-0.5 truncate">{p.orderId}</p>
                  <p className="text-[10px] text-white/25">{new Date(p.date).toLocaleString()}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-amber-400">
                    ₹{(p.amount * 83).toFixed(0)}
                  </p>
                  <p className="text-[10px] text-white/30">{p.currency}</p>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-8">
              <Receipt className="w-8 h-8 text-white/10 mx-auto mb-2" />
              <p className="text-xs text-white/40">No payments yet</p>
              <p className="text-[10px] text-white/30 mt-1">Your payment history will appear here</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
