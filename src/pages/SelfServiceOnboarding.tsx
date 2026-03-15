import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { z } from 'zod'
import { toast } from 'sonner'
import { CheckCircle2, ShieldCheck, Sparkles } from 'lucide-react'
import { invokeAnonymous } from '@/lib/supabase-functions'
import { supabase } from '@/integrations/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'

type PlanTier = 'free' | 'professional' | 'enterprise'
type BillingPeriod = 'monthly' | 'annual'
type DomainOption = {
  value: string
  label: string
  description?: string | null
}

const plans: Array<{
  tier: PlanTier
  title: string
  subtitle: string
  users: string
  franchises: string
}> = [
  { tier: 'free', title: 'Free', subtitle: 'Start quickly', users: '2 users', franchises: '1 franchise' },
  { tier: 'professional', title: 'Professional', subtitle: 'Scale operations', users: '25+ users', franchises: '10+ franchises' },
  { tier: 'enterprise', title: 'Enterprise', subtitle: 'Global compliance and scale', users: 'Custom users', franchises: 'Custom franchises' }
]

const features = [
  'Lead capture across email, WhatsApp, Telegram, X, and webhooks',
  'Opportunity, account, contract, and quotation lifecycle',
  'Tenant and franchise hierarchy with role-based security',
  'Domain provisioning, personalization, and guided activation'
]

const customerProof = ['Global Freight Group', 'Orbit Supply Chain', 'Aster Manufacturing', 'Helix Healthcare Logistics']

const schema = z.object({
  organization_name: z.string().min(2, 'Organization name is required'),
  country: z.string().min(2, 'Country is required'),
  admin_first_name: z.string().min(1, 'First name is required'),
  admin_last_name: z.string().min(1, 'Last name is required'),
  admin_email: z.string().email('Valid email is required'),
  admin_password: z.string().min(12, 'Password must be at least 12 characters'),
  plan_tier: z.enum(['free', 'professional', 'enterprise']),
  billing_period: z.enum(['monthly', 'annual']),
  requested_user_count: z.number().int().min(1).max(10000),
  requested_franchise_count: z.number().int().min(0).max(10000),
  data_residency: z.string().min(2, 'Data residency is required'),
  legal_name: z.string().optional(),
  tax_id: z.string().optional(),
  tax_jurisdiction: z.string().optional(),
  registered_address: z.string().optional(),
  currency: z.string().length(3),
  timezone: z.string().min(2),
  preferred_language: z.string().min(2),
  domain: z.string().optional(),
  industry: z.string().optional(),
  website: z.string().optional(),
  captcha_token: z.string().min(5, 'Captcha token is required')
})

type FormState = z.infer<typeof schema>

const stepIds = ['package', 'organization', 'admin', 'compliance', 'verify'] as const

export default function SelfServiceOnboarding() {
  const [stepIndex, setStepIndex] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [validatingOrgDomain, setValidatingOrgDomain] = useState(false)
  const [domainsLoading, setDomainsLoading] = useState(true)
  const [domainsError, setDomainsError] = useState<string | null>(null)
  const [domainOptions, setDomainOptions] = useState<DomainOption[]>([])
  const [fieldErrors, setFieldErrors] = useState<{
    organization_name?: string
    country?: string
    domain?: string
    organization_domain_combination?: string
  }>({})
  const [requestId, setRequestId] = useState<string | null>(null)
  const [verificationCode, setVerificationCode] = useState('')
  const [status, setStatus] = useState<'form' | 'verification' | 'completed'>('form')
  const [tenantId, setTenantId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>({
    organization_name: '',
    country: '',
    admin_first_name: '',
    admin_last_name: '',
    admin_email: '',
    admin_password: '',
    plan_tier: 'free',
    billing_period: 'monthly',
    requested_user_count: 2,
    requested_franchise_count: 1,
    data_residency: 'India',
    legal_name: '',
    tax_id: '',
    tax_jurisdiction: '',
    registered_address: '',
    currency: 'USD',
    timezone: 'UTC',
    preferred_language: 'en',
    domain: '',
    industry: '',
    website: '',
    captcha_token: import.meta.env.DEV ? 'dev-captcha-pass' : ''
  })

  const selectedPlan = useMemo(() => plans.find((p) => p.tier === form.plan_tier), [form.plan_tier])
  const progress = ((stepIndex + 1) / stepIds.length) * 100

  const updateField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    if (key === 'organization_name') {
      setFieldErrors((prev) => ({ ...prev, organization_name: undefined, organization_domain_combination: undefined }))
    }
    if (key === 'domain') {
      setFieldErrors((prev) => ({ ...prev, domain: undefined, organization_domain_combination: undefined }))
    }
    if (key === 'country') {
      setFieldErrors((prev) => ({ ...prev, country: undefined }))
    }
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  useEffect(() => {
    const loadDomainOptions = async () => {
      setDomainsLoading(true)
      setDomainsError(null)
      try {
        const { data, error } = await supabase
          .from('platform_domains')
          .select('id, key, code, name, description')
          .eq('is_active', true)
          .order('name', { ascending: true })

        if (error) {
          throw new Error(error.message || 'Failed to load domains')
        }

        const domains = (data || []).reduce<DomainOption[]>((acc, domain) => {
            const domainValue = domain.key || domain.code || domain.name || ''
            const value = domainValue.trim().toLowerCase()
            if (!value) return acc
            const label = domain.name || domain.code || value
            const description = domain.description || null
            acc.push({ value, label, description })
            return acc
          }, [])

        setDomainOptions(domains)
      } catch (error: any) {
        setDomainOptions([])
        setDomainsError(error?.message || 'Unable to load available domains')
        toast.error(error?.message || 'Unable to load available domains')
      } finally {
        setDomainsLoading(false)
      }
    }

    void loadDomainOptions()
  }, [])

  const validateCurrentStep = async (): Promise<boolean> => {
    if (stepIds[stepIndex] === 'package') {
      if (!form.plan_tier) {
        toast.error('Select a package to continue')
        return false
      }
      return true
    }
    if (stepIds[stepIndex] === 'organization') {
      const nextErrors: {
        organization_name?: string
        country?: string
        domain?: string
        organization_domain_combination?: string
      } = {}

      if (!form.organization_name.trim() || !form.country.trim()) {
        if (!form.organization_name.trim()) {
          nextErrors.organization_name = 'Organization Name is required'
        }
        if (!form.country.trim()) {
          nextErrors.country = 'Country is required'
        }
      }
      if (!form.domain.trim()) {
        nextErrors.domain = 'Preferred Domain is required'
      } else if (!domainOptions.some((domain) => domain.value === form.domain)) {
        nextErrors.domain = 'Select a preferred domain from available options'
      }

      if (nextErrors.organization_name || nextErrors.country || nextErrors.domain) {
        setFieldErrors(nextErrors)
        toast.error(nextErrors.organization_name || nextErrors.country || nextErrors.domain || 'Please complete required fields')
        return false
      }

      setValidatingOrgDomain(true)
      try {
        const response = await invokeAnonymous<{
          success: boolean
          is_unique?: boolean
          error?: string
        }>('self-service-onboarding', {
          action: 'check_org_domain_uniqueness',
          organization_name: form.organization_name.trim(),
          domain: form.domain.trim()
        })

        if (!response?.success) {
          throw new Error(response?.error || 'Unable to validate organization and domain combination')
        }

        if (response.is_unique === false) {
          const duplicateMessage = 'This Organization Name and Preferred Domain combination already exists. Please use a different combination.'
          setFieldErrors({
            organization_name: duplicateMessage,
            domain: duplicateMessage,
            organization_domain_combination: duplicateMessage
          })
          toast.error(duplicateMessage)
          return false
        }
      } catch (error: any) {
        const message = error?.message || 'Unable to validate organization and domain combination'
        setFieldErrors((prev) => ({
          ...prev,
          organization_domain_combination: message
        }))
        toast.error(message)
        return false
      } finally {
        setValidatingOrgDomain(false)
      }

      setFieldErrors((prev) => ({
        ...prev,
        organization_name: undefined,
        country: undefined,
        domain: undefined,
        organization_domain_combination: undefined
      }))
      return true
    }
    if (stepIds[stepIndex] === 'admin') {
      if (!form.admin_first_name.trim() || !form.admin_last_name.trim() || !form.admin_email.trim() || !form.admin_password.trim()) {
        toast.error('Complete admin details to continue')
        return false
      }
      if (form.admin_password.length < 12) {
        toast.error('Password must be at least 12 characters')
        return false
      }
      return true
    }
    if (stepIds[stepIndex] === 'compliance') {
      if (!form.data_residency.trim()) {
        toast.error('Data residency is required')
        return false
      }
      return true
    }
    return true
  }

  const nextStep = async () => {
    if (!await validateCurrentStep()) return
    setStepIndex((prev) => Math.min(prev + 1, stepIds.length - 1))
  }

  const prevStep = () => {
    setStepIndex((prev) => Math.max(prev - 1, 0))
  }

  const startRegistration = async () => {
    const parsed = schema.safeParse(form)
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message || 'Please complete all required fields')
      return
    }

    setSubmitting(true)
    try {
      const response = await invokeAnonymous<{
        success: boolean
        request_id?: string
        error?: string
      }>('self-service-onboarding', {
        action: 'start_registration',
        organization_name: form.organization_name,
        country: form.country,
        plan_tier: form.plan_tier,
        billing_period: form.billing_period,
        requested_user_count: form.requested_user_count,
        requested_franchise_count: form.requested_franchise_count,
        data_residency: form.data_residency,
        captcha_token: form.captcha_token,
        legal_name: form.legal_name || null,
        tax_id: form.tax_id || null,
        tax_jurisdiction: form.tax_jurisdiction || null,
        registered_address: form.registered_address || null,
        admin: {
          email: form.admin_email,
          first_name: form.admin_first_name,
          last_name: form.admin_last_name,
          password: form.admin_password
        },
        initial_config: {
          currency: form.currency,
          timezone: form.timezone,
          preferred_language: form.preferred_language,
          domain: form.domain || null,
          industry: form.industry || null,
          website: form.website || null
        }
      })

      if (!response?.success || !response?.request_id) {
        throw new Error(response?.error || 'Failed to start onboarding')
      }

      setRequestId(response.request_id)
      setStatus('verification')
      toast.success('Verification code sent to admin email')
    } catch (error: any) {
      toast.error(error?.message || 'Failed to start onboarding')
    } finally {
      setSubmitting(false)
    }
  }

  const verifyAndProvision = async () => {
    if (!requestId) {
      toast.error('Missing onboarding request id')
      return
    }
    if (!/^\d{6}$/.test(verificationCode)) {
      toast.error('Enter the 6-digit verification code')
      return
    }

    setVerifying(true)
    try {
      const response = await invokeAnonymous<{
        success: boolean
        status?: string
        tenant_id?: string
        error?: string
      }>('self-service-onboarding', {
        action: 'verify_email',
        request_id: requestId,
        verification_code: verificationCode,
        admin_password: form.admin_password
      })

      if (!response?.success) {
        throw new Error(response?.error || 'Verification failed')
      }

      if (response?.tenant_id) {
        setTenantId(response.tenant_id)
      }
      setStatus('completed')
      toast.success('Onboarding initialized successfully')
    } catch (error: any) {
      toast.error(error?.message || 'Verification failed')
    } finally {
      setVerifying(false)
    }
  }

  if (status === 'completed') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 p-4 flex items-center justify-center">
        <Card className="w-full max-w-2xl">
          <CardHeader className="text-center space-y-4">
            <div className="mx-auto w-14 h-14 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle2 className="w-7 h-7 text-green-600" />
            </div>
            <CardTitle className="text-2xl">Organization registration completed</CardTitle>
            <CardDescription>
              Your tenant has been created. Use the admin credentials you configured to sign in.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {tenantId && (
              <div className="text-sm text-muted-foreground">
                Tenant ID: <span className="font-mono">{tenantId}</span>
              </div>
            )}
            <div className="flex flex-wrap gap-3">
              <Button asChild>
                <Link to="/auth">Go to Sign In</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link to="/">Back to Home</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (status === 'verification') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 p-4 flex items-center justify-center">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <CardTitle>Verify admin email</CardTitle>
            <CardDescription>Enter the 6-digit code sent to {form.admin_email}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="verificationCode">Verification Code</Label>
              <Input
                id="verificationCode"
                value={verificationCode}
                maxLength={6}
                onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                placeholder="123456"
              />
            </div>
            <div className="flex gap-3">
              <Button onClick={verifyAndProvision} disabled={verifying} className="w-full">
                {verifying ? 'Verifying...' : 'Verify and Create Tenant'}
              </Button>
              <Button variant="outline" onClick={() => setStatus('form')} disabled={verifying}>
                Back
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 px-4 py-10">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-xl flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                Logic Nexus-AI
              </CardTitle>
              <CardDescription>Enterprise CRM and logistics platform</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {features.map((feature) => (
                <div key={feature} className="text-sm text-muted-foreground">{feature}</div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Customers using this product</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {customerProof.map((name) => (
                <Badge key={name} variant="secondary">{name}</Badge>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle>Register your organization</CardTitle>
                  <CardDescription>Secure self-service onboarding with verification and tenant bootstrap</CardDescription>
                </div>
                <Badge variant="outline" className="flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Secure Flow
                </Badge>
              </div>
              <div className="mt-4">
                <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                  <div className="h-2 bg-primary transition-all duration-300" style={{ width: `${progress}%` }} />
                </div>
                <div className="mt-2 text-xs text-muted-foreground">
                  Step {stepIndex + 1} of {stepIds.length}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              {stepIds[stepIndex] === 'package' && (
                <div className="grid md:grid-cols-3 gap-4">
                  {plans.map((plan) => (
                    <button
                      key={plan.tier}
                      type="button"
                      className={`text-left border rounded-lg p-4 transition-all ${form.plan_tier === plan.tier ? 'border-primary ring-2 ring-primary/30' : 'border-border hover:border-primary/50'}`}
                      onClick={() => updateField('plan_tier', plan.tier)}
                    >
                      <div className="font-semibold">{plan.title}</div>
                      <div className="text-sm text-muted-foreground mt-1">{plan.subtitle}</div>
                      <div className="mt-3 text-xs text-muted-foreground">{plan.users}</div>
                      <div className="text-xs text-muted-foreground">{plan.franchises}</div>
                    </button>
                  ))}
                </div>
              )}

              {stepIds[stepIndex] === 'organization' && (
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="organization_name">Organization Name <span className="text-destructive">*</span></Label>
                    <Input
                      id="organization_name"
                      value={form.organization_name}
                      onChange={(e) => updateField('organization_name', e.target.value)}
                      className={fieldErrors.organization_name ? 'border-destructive focus-visible:ring-destructive/30' : ''}
                    />
                    {fieldErrors.organization_name && <p className="text-xs text-destructive">{fieldErrors.organization_name}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="country">Country <span className="text-destructive">*</span></Label>
                    <Input
                      id="country"
                      value={form.country}
                      onChange={(e) => updateField('country', e.target.value)}
                      className={fieldErrors.country ? 'border-destructive focus-visible:ring-destructive/30' : ''}
                    />
                    {fieldErrors.country && <p className="text-xs text-destructive">{fieldErrors.country}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="website">Website</Label>
                    <Input id="website" value={form.website || ''} onChange={(e) => updateField('website', e.target.value)} placeholder="https://example.com" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="domain">Preferred Domain <span className="text-destructive">*</span></Label>
                    <Select
                      value={form.domain || '__none__'}
                      onValueChange={(value) => updateField('domain', value === '__none__' ? '' : value)}
                      disabled={domainsLoading || domainOptions.length === 0}
                    >
                      <SelectTrigger id="domain" className={fieldErrors.domain ? 'border-destructive focus:ring-destructive/30' : ''}>
                        <SelectValue placeholder={domainsLoading ? 'Loading domains...' : 'Select a preferred domain'} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">No preference</SelectItem>
                        {domainOptions.map((domain) => (
                          <SelectItem key={domain.value} value={domain.value}>
                            {domain.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {domainsError && <p className="text-xs text-destructive">{domainsError}</p>}
                    {fieldErrors.domain && <p className="text-xs text-destructive">{fieldErrors.domain}</p>}
                    {fieldErrors.organization_domain_combination && (
                      <p className="text-xs text-destructive">{fieldErrors.organization_domain_combination}</p>
                    )}
                    {!domainsError && !domainsLoading && domainOptions.length === 0 && (
                      <p className="text-xs text-muted-foreground">No domains are currently available.</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="industry">Domain Specification</Label>
                    <Input id="industry" value={form.industry || ''} onChange={(e) => updateField('industry', e.target.value)} placeholder="Describe your domain-specific requirements" />
                  </div>
                </div>
              )}

              {stepIds[stepIndex] === 'admin' && (
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="admin_first_name">First Name</Label>
                    <Input id="admin_first_name" value={form.admin_first_name} onChange={(e) => updateField('admin_first_name', e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="admin_last_name">Last Name</Label>
                    <Input id="admin_last_name" value={form.admin_last_name} onChange={(e) => updateField('admin_last_name', e.target.value)} />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="admin_email">Admin Email</Label>
                    <Input id="admin_email" type="email" value={form.admin_email} onChange={(e) => updateField('admin_email', e.target.value)} />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="admin_password">Admin Password</Label>
                    <Input id="admin_password" type="password" value={form.admin_password} onChange={(e) => updateField('admin_password', e.target.value)} />
                  </div>
                </div>
              )}

              {stepIds[stepIndex] === 'compliance' && (
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Billing Period</Label>
                    <Select value={form.billing_period} onValueChange={(v: BillingPeriod) => updateField('billing_period', v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="annual">Annual</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Data Residency</Label>
                    <Select value={form.data_residency} onValueChange={(v) => updateField('data_residency', v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="India">India</SelectItem>
                        <SelectItem value="EU">EU</SelectItem>
                        <SelectItem value="US">US</SelectItem>
                        <SelectItem value="Singapore">Singapore</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="requested_user_count">Requested Users</Label>
                    <Input
                      id="requested_user_count"
                      type="number"
                      value={String(form.requested_user_count)}
                      onChange={(e) => updateField('requested_user_count', Number(e.target.value || 1))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="requested_franchise_count">Requested Franchises</Label>
                    <Input
                      id="requested_franchise_count"
                      type="number"
                      value={String(form.requested_franchise_count)}
                      onChange={(e) => updateField('requested_franchise_count', Number(e.target.value || 0))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="currency">Currency</Label>
                    <Input id="currency" value={form.currency} onChange={(e) => updateField('currency', e.target.value.toUpperCase())} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="timezone">Timezone</Label>
                    <Input id="timezone" value={form.timezone} onChange={(e) => updateField('timezone', e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="legal_name">Legal Name</Label>
                    <Input id="legal_name" value={form.legal_name || ''} onChange={(e) => updateField('legal_name', e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="registered_address">Registered Address</Label>
                    <Input id="registered_address" value={form.registered_address || ''} onChange={(e) => updateField('registered_address', e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tax_id">Tax ID</Label>
                    <Input id="tax_id" value={form.tax_id || ''} onChange={(e) => updateField('tax_id', e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tax_jurisdiction">Tax Jurisdiction</Label>
                    <Input id="tax_jurisdiction" value={form.tax_jurisdiction || ''} onChange={(e) => updateField('tax_jurisdiction', e.target.value)} />
                  </div>
                </div>
              )}

              {stepIds[stepIndex] === 'verify' && (
                <div className="space-y-4">
                  <Card className="bg-muted/40">
                    <CardContent className="pt-6 space-y-2">
                      <div className="text-sm">Selected Package: <span className="font-semibold">{selectedPlan?.title}</span></div>
                      <div className="text-sm">Admin Email: <span className="font-semibold">{form.admin_email}</span></div>
                      <div className="text-sm">Organization: <span className="font-semibold">{form.organization_name}</span></div>
                    </CardContent>
                  </Card>
                  <div className="space-y-2">
                    <Label htmlFor="captcha_token">Captcha Token</Label>
                    <Input
                      id="captcha_token"
                      value={form.captcha_token}
                      onChange={(e) => updateField('captcha_token', e.target.value)}
                      placeholder={import.meta.env.DEV ? 'dev-captcha-pass' : 'Enter CAPTCHA token'}
                    />
                  </div>
                </div>
              )}

              <div className="flex justify-between pt-2">
                <Button variant="outline" onClick={prevStep} disabled={stepIndex === 0 || submitting}>
                  Back
                </Button>
                {stepIds[stepIndex] === 'verify' ? (
                  <Button onClick={startRegistration} disabled={submitting}>
                    {submitting ? 'Submitting...' : 'Start Onboarding'}
                  </Button>
                ) : (
                  <Button onClick={nextStep} disabled={validatingOrgDomain}>
                    {validatingOrgDomain ? 'Validating...' : 'Continue'}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
