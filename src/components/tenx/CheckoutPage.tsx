// 10X RPC — Checkout page (wraps PaymentFlow component)
'use client'
import { useEffect, useState } from 'react'
import { useRouter } from './useRouter'
import { PaymentFlow } from './PaymentFlow'
import { api, type Me, type AdminPlan } from '@/lib/api-client'

interface CheckoutPageProps {
  initial?: Me
}

export function CheckoutPage({ initial }: CheckoutPageProps) {
  const { navigate } = useRouter()
  const [plan, setPlan] = useState<AdminPlan | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Load plans from API + check for selected plan in sessionStorage
    Promise.all([
      api.publicPlans(),
      new Promise<AdminPlan | null>((resolve) => {
        try {
          const stored = sessionStorage.getItem('checkout_plan')
          resolve(stored ? JSON.parse(stored) : null)
        } catch { resolve(null) }
      }),
    ]).then(([plansRes, storedPlan]) => {
      if (storedPlan) {
        // Find the matching plan from the API (to get fresh pricing)
        const fresh = plansRes.plans.find(p => p.id === storedPlan.id || p.slug === storedPlan.slug)
        setPlan(fresh || storedPlan)
      } else if (plansRes.plans.length > 0) {
        // Default to the first non-trial plan
        const firstPaid = plansRes.plans.find(p => p.priceInr > 0) || plansRes.plans[0]
        setPlan(firstPaid)
      }
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0b10]">
        <div className="text-center">
          <div className="inline-block w-10 h-10 rounded-full border-2 border-purple-500/30 border-t-purple-500 animate-spin mb-3" />
          <p className="text-white/60 text-sm">Loading checkout...</p>
        </div>
      </div>
    )
  }

  if (!plan) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0b10] px-4">
        <div className="glass-card p-8 max-w-md text-center">
          <div className="text-4xl mb-3">😕</div>
          <h2 className="text-xl font-bold text-white mb-2">No Plan Selected</h2>
          <p className="text-sm text-white/60 mb-4">Please select a subscription plan first.</p>
          <button
            onClick={() => navigate({ name: 'dashboard' })}
            className="purple-gradient text-white font-semibold rounded-xl px-4 py-2.5 text-sm"
          >
            View Plans
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0b10] flex items-center justify-center px-4 py-8">
      <PaymentFlow
        plan={plan}
        onSuccess={() => {
          sessionStorage.removeItem('checkout_plan')
          navigate({ name: 'dashboard' })
        }}
        onCancel={() => {
          navigate({ name: 'dashboard' })
        }}
        onBack={() => {
          navigate({ name: 'dashboard' })
        }}
      />
    </div>
  )
}
