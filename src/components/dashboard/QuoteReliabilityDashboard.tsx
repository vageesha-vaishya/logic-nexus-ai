import { useEffect, useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { invokeAnonymous } from "@/lib/supabase-functions"

type Metrics = {
  window_minutes: number
  pdfCount: number
  emailCount: number
  discrepancies: number
  successRate: number
  discrepancyRate: number
}

export function QuoteReliabilityDashboard() {
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadMetrics = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await invokeAnonymous('metrics-quotation', { minutes: 60 })
      setMetrics(res as Metrics)
    } catch (e: any) {
      setError(e?.message || "Failed to fetch metrics")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadMetrics() }, [])

  return (
    <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
      <Card className="p-4">
        <div className="text-sm text-muted-foreground">Quote→Email Success Rate</div>
        <div className="text-2xl font-semibold">{metrics ? (metrics.successRate * 100).toFixed(2) + "%" : "-"}</div>
      </Card>
      <Card className="p-4">
        <div className="text-sm text-muted-foreground">Discrepancy Rate</div>
        <div className={`text-2xl font-semibold ${metrics && metrics.discrepancyRate > 0.0001 ? 'text-destructive' : ''}`}>
          {metrics ? (metrics.discrepancyRate * 100).toFixed(4) + "%" : "-"}
        </div>
      </Card>
      <Card className="p-4">
        <div className="text-sm text-muted-foreground">Window</div>
        <div className="text-2xl font-semibold">{metrics ? metrics.window_minutes + " min" : "-"}</div>
      </Card>
      <div className="col-span-1 md:col-span-3 flex items-center gap-2">
        <Button onClick={loadMetrics} disabled={loading}>{loading ? "Refreshing..." : "Refresh"}</Button>
        {error && <span className="text-destructive text-sm">{error}</span>}
      </div>
    </div>
  )
}
