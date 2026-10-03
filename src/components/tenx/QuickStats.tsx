// 10X RPC — Quick Stats Dashboard component (animated counters)
'use client'
import { useEffect, useState, useRef } from 'react'
import { api, type Me } from '@/lib/api-client'
import { Activity, Clock, Server, Zap } from 'lucide-react'

interface QuickStatsProps {
  me: Me | null
}

export function QuickStats({ me }: QuickStatsProps) {
  const sub = me?.subscription
  const session = me?.session
  const rpcConfig = me?.rpcConfig

  const stats = [
    {
      label: 'RPC Status',
      value: session?.rpcEnabled ? 'LIVE' : 'OFF',
      icon: <Activity className="w-4 h-4" />,
      color: session?.rpcEnabled ? 'text-green-400' : 'text-white/40',
      glow: session?.rpcEnabled ? 'shadow-green-500/20' : '',
    },
    {
      label: 'Gateway',
      value: session?.gatewayReady ? 'Connected' : 'Disconnected',
      icon: <Server className="w-4 h-4" />,
      color: session?.gatewayReady ? 'text-green-400' : 'text-red-400',
      glow: '',
    },
    {
      label: 'Plan',
      value: sub?.planName || 'Trial',
      icon: <Zap className="w-4 h-4" />,
      color: 'text-amber-400',
      glow: '',
    },
    {
      label: 'Days Left',
      value: sub?.isLifetime ? '∞' : (sub?.daysLeft ?? me?.trial?.daysLeft ?? 0).toString(),
      icon: <Clock className="w-4 h-4" />,
      color: (sub?.daysLeft ?? 999) > 7 ? 'text-green-400' : (sub?.daysLeft ?? 999) > 3 ? 'text-yellow-400' : 'text-red-400',
      glow: '',
    },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      {stats.map((stat, i) => (
        <div
          key={stat.label}
          className={`glass-card-inner p-3 text-center hover:scale-105 transition-transform ${stat.glow}`}
          style={{ animationDelay: `${i * 50}ms` }}
        >
          <div className={`flex items-center justify-center gap-1.5 mb-1 ${stat.color}`}>
            {stat.icon}
            <span className="text-base font-bold">{stat.value}</span>
          </div>
          <p className="text-[10px] uppercase tracking-wider text-white/40">{stat.label}</p>
        </div>
      ))}
    </div>
  )
}
