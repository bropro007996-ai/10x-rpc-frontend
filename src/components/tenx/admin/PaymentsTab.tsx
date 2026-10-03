// 10X RPC — Admin Payments tab (table of all payments with filters + search + CSV)
'use client'
import { useEffect, useState, useCallback } from 'react'
import { toast } from 'sonner'
import { api, type AdminPayment } from '@/lib/api-client'
import { AdminCard, AdminSectionTitle, AdminEmptyState, AdminErrorState, formatMoney, formatDateTime, useAdminFetch } from './shared'
import { Search, CreditCard, Download } from 'lucide-react'

const STATUS_FILTERS = ['all', 'verified', 'created', 'failed', 'captured'] as const
type StatusFilter = typeof STATUS_FILTERS[number]

interface PaymentsTabProps {
  refreshKey: number
}

export function PaymentsTab({ refreshKey }: PaymentsTabProps) {
  const [status, setStatus] = useState<StatusFilter>('all')
  const [search, setSearch] = useState('')

  const fetcher = useCallback(() => api.adminPayments({
    status: status === 'all' ? undefined : status,
    search: search.trim() || undefined,
    take: 100,
  }), [status, search])

  const { data, loading, error, refetch } = useAdminFetch(fetcher, [status, search, refreshKey])

  const payments = data?.payments ?? []

  const handleExportCsv = () => {
    if (!payments.length) { toast.info('No payments to export'); return }
    const rows = [
      ['Username', 'Discord ID', 'Plan', 'Amount', 'Currency', 'Status', 'Razorpay Order', 'Razorpay Payment', 'Internal Order', 'Verified At', 'Created At'],
      ...payments.map(p => [
        p.user?.username || '',
        p.user?.discordId || '',
        p.planName || p.planId,
        String(p.amount / 100),
        p.currency,
        p.status,
        p.razorpayOrderId || '',
        p.razorpayPaymentId || '',
        p.internalOrderId || '',
        p.verifiedAt ? new Date(p.verifiedAt as any).toISOString() : '',
        new Date(p.createdAt).toISOString(),
      ]),
    ]
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `10xrpc-payments-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success(`Exported ${payments.length} payments`)
  }

  const totalAmount = payments.reduce((sum, p) => sum + p.amount, 0)
  const verifiedCount = payments.filter(p => p.status === 'verified' || p.status === 'captured').length

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <div className="glass-card-inner p-3 text-center">
          <div className="text-lg font-bold text-amber-400">{data?.total ?? 0}</div>
          <div className="text-[10px] uppercase tracking-wider text-white/40">Total</div>
        </div>
        <div className="glass-card-inner p-3 text-center">
          <div className="text-lg font-bold text-green-400">{verifiedCount}</div>
          <div className="text-[10px] uppercase tracking-wider text-white/40">Verified</div>
        </div>
        <div className="glass-card-inner p-3 text-center">
          <div className="text-lg font-bold text-white">{formatMoney(totalAmount)}</div>
          <div className="text-[10px] uppercase tracking-wider text-white/40">Volume</div>
        </div>
      </div>

      <AdminCard>
        <AdminSectionTitle
          icon={<CreditCard className="w-4 h-4" />}
          right={
            <button
              onClick={handleExportCsv}
              className="text-xs bg-white/5 border border-white/10 px-2 py-1 rounded-lg text-white/70 hover:text-white hover:bg-white/10 flex items-center gap-1"
            >
              <Download className="w-3 h-3" />CSV
            </button>
          }
        >
          Payments
        </AdminSectionTitle>

        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/40" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by username, order ID, payment ID..."
            className="w-full bg-[#13141a] border border-white/8 text-white text-xs rounded-xl pl-9 pr-3 py-2 placeholder:text-white/40 focus-visible:ring-purple-500/40 outline-none"
          />
        </div>

        {/* Status filters */}
        <div className="flex items-center gap-1.5 mb-3 overflow-x-auto no-scrollbar">
          {STATUS_FILTERS.map(s => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`text-[10px] font-medium px-2.5 py-1 rounded-full whitespace-nowrap transition-colors ${
                status === s ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' : 'bg-white/5 text-white/50 border border-white/8'
              }`}
            >
              {s.toUpperCase()}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <div className="w-6 h-6 rounded-full border-2 border-purple-500/30 border-t-purple-500 animate-spin" />
          </div>
        ) : error ? (
          <AdminErrorState message={error} onRetry={refetch} />
        ) : payments.length === 0 ? (
          <AdminEmptyState icon="💳" title="No payments found" hint="Try a different filter or search query." />
        ) : (
          <div className="space-y-2 max-h-[65vh] overflow-y-auto styled-scroll pr-1">
            {payments.map(p => <PaymentRow key={p.id} payment={p} />)}
          </div>
        )}
      </AdminCard>
    </div>
  )
}

function PaymentRow({ payment }: { payment: AdminPayment }) {
  const statusColor =
    payment.status === 'verified' || payment.status === 'captured'
      ? 'bg-green-500/20 text-green-300'
      : payment.status === 'failed'
      ? 'bg-red-500/20 text-red-300'
      : 'bg-yellow-500/20 text-yellow-300'

  return (
    <div className="glass-card-inner p-3 space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {payment.user?.avatar && (
            <img src={payment.user.avatar} alt={payment.user.username} className="w-7 h-7 rounded-full flex-shrink-0" />
          )}
          <div className="min-w-0">
            <div className="text-xs font-medium text-white truncate">{payment.user?.username || 'Unknown user'}</div>
            <div className="text-[10px] text-white/40 font-mono">{payment.user?.discordId || payment.userId.slice(0, 12)}</div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-sm font-bold text-white">{formatMoney(payment.amount, payment.currency)}</span>
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusColor}`}>{payment.status.toUpperCase()}</span>
        </div>
      </div>
      <div className="flex items-center justify-between text-[10px] text-white/40">
        <span className="truncate">{payment.planName || payment.planId}</span>
        <span>{formatDateTime(payment.createdAt)}</span>
      </div>
      {(payment.razorpayOrderId || payment.razorpayPaymentId || payment.internalOrderId) && (
        <div className="grid grid-cols-1 gap-0.5 text-[10px] text-white/40 font-mono pt-1 border-t border-white/5">
          {payment.internalOrderId && <div>internal: {payment.internalOrderId}</div>}
          {payment.razorpayOrderId && <div>order: {payment.razorpayOrderId}</div>}
          {payment.razorpayPaymentId && <div>payment: {payment.razorpayPaymentId}</div>}
        </div>
      )}
    </div>
  )
}
