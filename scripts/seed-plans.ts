// 10X RPC — Seed the 3 subscription plans into the database
// Run with: bun run scripts/seed-plans.ts
import { db } from '../src/lib/db'

async function seedPlans() {
  console.log('🌱 Seeding subscription plans...')

  const plans = [
    {
      name: 'Trial',
      slug: 'trial',
      priceInr: 0,
      originalPriceInr: null,
      offerPriceInr: null,
      offerEnabled: false,
      offerTag: null,
      offerText: null,
      offerStartsAt: null,
      offerEndsAt: null,
      durationDays: 30,
      durationUnit: 'days',
      description: '30 days of full access — no payment required',
      features: JSON.stringify(['Full Feature Access', '30 Days Validity']),
      isActive: true,
      isVisible: true,
      isArchived: false,
      isPopular: false,
      isRecommended: false,
      badge: null,
      displayOrder: 0,
    },
    {
      name: 'Pro',
      slug: 'pro',
      priceInr: 39900,        // ₹399 in paise
      originalPriceInr: 49900, // ₹499 in paise (crossed out)
      offerPriceInr: 39900,    // ₹399 offer price
      offerEnabled: true,      // offer is active
      offerTag: '20% OFF',
      offerText: null,
      offerStartsAt: null,    // no start date = always active
      offerEndsAt: null,       // no end date = never expires
      durationDays: 90,
      durationUnit: 'days',
      description: 'Pro plan — 3 months of full access with priority support',
      features: JSON.stringify([
        'Full Feature Access',
        'Priority Support',
        'Game RPC Requests',
        'Custom Discord Role',
      ]),
      isActive: true,
      isVisible: true,
      isArchived: false,
      isPopular: true,
      isRecommended: true,
      badge: 'BEST VALUE',
      displayOrder: 1,
    },
    {
      name: 'Plus',
      slug: 'plus',
      priceInr: 19900,         // ₹199 in paise
      originalPriceInr: null,
      offerPriceInr: null,
      offerEnabled: false,
      offerTag: null,
      offerText: null,
      offerStartsAt: null,
      offerEndsAt: null,
      durationDays: 30,
      durationUnit: 'days',
      description: 'Plus plan — 1 month of full access',
      features: JSON.stringify([
        'Full Feature Access',
        'Standard Support',
        'Basic Discord Role',
      ]),
      isActive: true,
      isVisible: true,
      isArchived: false,
      isPopular: false,
      isRecommended: false,
      badge: null,
      displayOrder: 2,
    },
  ]

  for (const planData of plans) {
    const existing = await db.plan.findUnique({ where: { slug: planData.slug } })
    if (existing) {
      // Update existing plan with new fields (preserves id + existing subscribers)
      await db.plan.update({
        where: { slug: planData.slug },
        data: planData,
      })
      console.log(`  ✓ Updated: ${planData.name} (${planData.slug})`)
    } else {
      await db.plan.create({ data: planData })
      console.log(`  ✓ Created: ${planData.name} (${planData.slug})`)
    }
  }

  console.log('\n✅ Plans seeded successfully!')
  console.log('   - Trial: ₹0 / 30 days')
  console.log('   - Pro: ₹399 (was ₹499, 20% OFF) / 90 days [POPULAR]')
  console.log('   - Plus: ₹199 / 30 days')
}

seedPlans()
  .catch(console.error)
  .finally(() => process.exit(0))
