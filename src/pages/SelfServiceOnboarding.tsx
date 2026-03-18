import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { z } from 'zod'
import { toast } from 'sonner'
import { CheckCircle2, Eye, EyeOff, ShieldCheck, Sparkles } from 'lucide-react'
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
type CountryOption = {
  value: string
  label: string
}
type CurrencyOption = {
  value: string
  label: string
}

type TurnstileApi = {
  render: (
    element: string | HTMLElement,
    options: {
      sitekey: string
      callback: (token: string) => void
      'expired-callback'?: () => void
      'error-callback'?: () => void
      theme?: 'light' | 'dark' | 'auto'
    }
  ) => string
  remove: (widgetId: string) => void
}

type RecaptchaApi = {
  render: (
    element: string | HTMLElement,
    options: {
      sitekey: string
      callback: (token: string) => void
      'expired-callback'?: () => void
      'error-callback'?: () => void
      theme?: 'light' | 'dark'
    }
  ) => number
  reset: (widgetId?: number) => void
}

declare global {
  interface Window {
    turnstile?: TurnstileApi
    grecaptcha?: RecaptchaApi
  }
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
const passwordPolicy = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{12,128}$/
const turnstileSiteKey = String(import.meta.env.VITE_TURNSTILE_SITE_KEY || '').trim()
const recaptchaSiteKey = String(import.meta.env.VITE_RECAPTCHA_SITE_KEY || '').trim()
const allowDevCaptchaBypass = import.meta.env.DEV && String(import.meta.env.VITE_ALLOW_DEV_CAPTCHA_BYPASS || '').trim().toLowerCase() === 'true'
const captchaContainerId = 'self-service-onboarding-captcha'
const captchaInitTimeoutMs = 4000

const schema = z.object({
  organization_name: z.string().min(2, 'Organization name is required'),
  country: z.string().min(2, 'Country is required'),
  admin_first_name: z.string().min(1, 'First name is required'),
  admin_last_name: z.string().min(1, 'Last name is required'),
  admin_email: z.string().email('Valid email is required'),
  admin_password: z.string()
    .min(12, 'Password must be at least 12 characters')
    .max(128, 'Password must be at most 128 characters')
    .regex(passwordPolicy, 'Password must include uppercase, lowercase, number, and special character'),
  admin_password_confirm: z.string().min(1, 'Confirm Password is required'),
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
  captcha_provider: z.enum(['turnstile', 'recaptcha', 'dev_bypass', 'none']).optional(),
  captcha_token: z.string().min(5, 'Captcha token is required')
})

type FormState = z.infer<typeof schema>
type FieldErrorKey =
  | 'plan_tier'
  | 'organization_name'
  | 'country'
  | 'domain'
  | 'organization_domain_combination'
  | 'admin_first_name'
  | 'admin_last_name'
  | 'admin_email'
  | 'admin_password'
  | 'admin_password_confirm'
  | 'billing_period'
  | 'data_residency'
  | 'requested_user_count'
  | 'requested_franchise_count'
  | 'currency'
  | 'timezone'
  | 'captcha_token'
type FieldErrors = Partial<Record<FieldErrorKey, string>>

const stepIds = ['package', 'organization', 'admin', 'compliance', 'verify'] as const

export default function SelfServiceOnboarding() {
  const preferredCaptchaProvider = recaptchaSiteKey ? 'recaptcha' : turnstileSiteKey ? 'turnstile' : 'none'
  const hasBothCaptchaProviders = Boolean(recaptchaSiteKey && turnstileSiteKey)
  const turnstileWidgetIdRef = useRef<string | null>(null)
  const recaptchaWidgetIdRef = useRef<number | null>(null)
  const [stepIndex, setStepIndex] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [validatingOrgDomain, setValidatingOrgDomain] = useState(false)
  const [domainsLoading, setDomainsLoading] = useState(true)
  const [domainsError, setDomainsError] = useState<string | null>(null)
  const [domainOptions, setDomainOptions] = useState<DomainOption[]>([])
  const [countriesLoading, setCountriesLoading] = useState(true)
  const [countriesError, setCountriesError] = useState<string | null>(null)
  const [countryOptions, setCountryOptions] = useState<CountryOption[]>([])
  const [currenciesLoading, setCurrenciesLoading] = useState(true)
  const [currenciesError, setCurrenciesError] = useState<string | null>(null)
  const [currencyOptions, setCurrencyOptions] = useState<CurrencyOption[]>([])
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [requestId, setRequestId] = useState<string | null>(null)
  const [verificationCode, setVerificationCode] = useState('')
  const [fallbackVerificationCode, setFallbackVerificationCode] = useState<string | null>(null)
  const [status, setStatus] = useState<'form' | 'verification' | 'completed'>('form')
  const [tenantId, setTenantId] = useState<string | null>(null)
  const [turnstileScriptReady, setTurnstileScriptReady] = useState(false)
  const [recaptchaScriptReady, setRecaptchaScriptReady] = useState(false)
  const [activeCaptchaProvider, setActiveCaptchaProvider] = useState<'turnstile' | 'recaptcha' | 'none'>(
    preferredCaptchaProvider
  )
  const [captchaWidgetError, setCaptchaWidgetError] = useState<string | null>(null)
  const [showAdminPassword, setShowAdminPassword] = useState(false)
  const [showAdminPasswordConfirm, setShowAdminPasswordConfirm] = useState(false)
  const [form, setForm] = useState<FormState>({
    organization_name: '',
    country: '',
    admin_first_name: '',
    admin_last_name: '',
    admin_email: '',
    admin_password: '',
    admin_password_confirm: '',
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
    captcha_provider: preferredCaptchaProvider,
    captcha_token: import.meta.env.DEV ? 'dev-captcha-pass' : ''
  })

  const selectedPlan = useMemo(() => plans.find((p) => p.tier === form.plan_tier), [form.plan_tier])
  const progress = ((stepIndex + 1) / stepIds.length) * 100

  const updateField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setFieldErrors((prev) => ({
      ...prev,
      plan_tier: key === 'plan_tier' ? undefined : prev.plan_tier,
      organization_name: key === 'organization_name' ? undefined : prev.organization_name,
      country: key === 'country' ? undefined : prev.country,
      domain: key === 'domain' ? undefined : prev.domain,
      organization_domain_combination:
        key === 'organization_name' || key === 'domain' ? undefined : prev.organization_domain_combination,
      admin_first_name: key === 'admin_first_name' ? undefined : prev.admin_first_name,
      admin_last_name: key === 'admin_last_name' ? undefined : prev.admin_last_name,
      admin_email: key === 'admin_email' ? undefined : prev.admin_email,
      admin_password: key === 'admin_password' ? undefined : prev.admin_password,
      admin_password_confirm: key === 'admin_password' || key === 'admin_password_confirm' ? undefined : prev.admin_password_confirm,
      billing_period: key === 'billing_period' ? undefined : prev.billing_period,
      data_residency: key === 'data_residency' ? undefined : prev.data_residency,
      requested_user_count: key === 'requested_user_count' ? undefined : prev.requested_user_count,
      requested_franchise_count: key === 'requested_franchise_count' ? undefined : prev.requested_franchise_count,
      currency: key === 'currency' ? undefined : prev.currency,
      timezone: key === 'timezone' ? undefined : prev.timezone,
      captcha_token: key === 'captcha_token' ? undefined : prev.captcha_token
    }))
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const getCaptchaProviderLabel = (provider: 'turnstile' | 'recaptcha' | 'none') => {
    if (provider === 'recaptcha') return 'Google reCAPTCHA'
    if (provider === 'turnstile') return 'Cloudflare Turnstile'
    return 'None'
  }

  const clearCaptchaWidgets = () => {
    if (turnstileWidgetIdRef.current && window.turnstile) {
      window.turnstile.remove(turnstileWidgetIdRef.current)
      turnstileWidgetIdRef.current = null
    }
    if (recaptchaWidgetIdRef.current !== null && window.grecaptcha) {
      window.grecaptcha.reset(recaptchaWidgetIdRef.current)
      recaptchaWidgetIdRef.current = null
    }
    const container = document.getElementById(captchaContainerId)
    if (container) {
      container.innerHTML = ''
    }
  }

  const switchCaptchaProvider = (targetProvider: 'turnstile' | 'recaptcha', message?: string) => {
    if (targetProvider === 'recaptcha' && !recaptchaSiteKey) return
    if (targetProvider === 'turnstile' && !turnstileSiteKey) return
    clearCaptchaWidgets()
    setActiveCaptchaProvider(targetProvider)
    updateField('captcha_provider', targetProvider)
    updateField('captcha_token', '')
    setCaptchaWidgetError(message || null)
  }

  useEffect(() => {
    if (!turnstileSiteKey) return
    if (window.turnstile) {
      setTurnstileScriptReady(true)
      return
    }

    const existingScript = document.getElementById('turnstile-api-script') as HTMLScriptElement | null
    if (existingScript) {
      const handleLoad = () => setTurnstileScriptReady(true)
      const handleError = () => setCaptchaWidgetError('Unable to load Cloudflare Turnstile widget')
      existingScript.addEventListener('load', handleLoad)
      existingScript.addEventListener('error', handleError)
      return () => {
        existingScript.removeEventListener('load', handleLoad)
        existingScript.removeEventListener('error', handleError)
      }
    }

    const script = document.createElement('script')
    script.id = 'turnstile-api-script'
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
    script.async = true
    script.defer = true
    script.onload = () => setTurnstileScriptReady(true)
    script.onerror = () => setCaptchaWidgetError('Unable to load Cloudflare Turnstile widget')
    document.head.appendChild(script)
  }, [])

  useEffect(() => {
    if (activeCaptchaProvider !== 'recaptcha') return
    if (!recaptchaSiteKey) return
    if (window.grecaptcha) {
      setRecaptchaScriptReady(true)
      return
    }

    const existingScript = document.getElementById('recaptcha-api-script') as HTMLScriptElement | null
    if (existingScript) {
      const handleLoad = () => setRecaptchaScriptReady(true)
      const handleError = () => {
        if (turnstileSiteKey) {
          switchCaptchaProvider('turnstile', 'Google reCAPTCHA unavailable. Switched to Cloudflare Turnstile backup.')
        } else {
          setActiveCaptchaProvider('none')
          updateField('captcha_provider', allowDevCaptchaBypass ? 'dev_bypass' : 'none')
          setCaptchaWidgetError('Google reCAPTCHA failed to load. Please retry.')
        }
      }
      existingScript.addEventListener('load', handleLoad)
      existingScript.addEventListener('error', handleError)
      return () => {
        existingScript.removeEventListener('load', handleLoad)
        existingScript.removeEventListener('error', handleError)
      }
    }

    const script = document.createElement('script')
    script.id = 'recaptcha-api-script'
    script.src = 'https://www.google.com/recaptcha/api.js?render=explicit'
    script.async = true
    script.defer = true
    script.onload = () => setRecaptchaScriptReady(true)
    script.onerror = () => {
      if (turnstileSiteKey) {
        switchCaptchaProvider('turnstile', 'Google reCAPTCHA unavailable. Switched to Cloudflare Turnstile backup.')
      } else {
        setActiveCaptchaProvider('none')
        updateField('captcha_provider', allowDevCaptchaBypass ? 'dev_bypass' : 'none')
        setCaptchaWidgetError('Google reCAPTCHA failed to load. Please retry.')
      }
    }
    document.head.appendChild(script)
  }, [activeCaptchaProvider])

  useEffect(() => {
    if (!recaptchaSiteKey) return
    if (stepIds[stepIndex] !== 'verify') return
    if (activeCaptchaProvider !== 'recaptcha') return
    if (recaptchaScriptReady) return

    const timeoutId = window.setTimeout(() => {
      if (turnstileSiteKey) {
        switchCaptchaProvider('turnstile', 'Google reCAPTCHA timed out. Switched to Cloudflare Turnstile backup.')
      } else {
        setCaptchaWidgetError('CAPTCHA initialization timed out. Please refresh and retry.')
      }
    }, captchaInitTimeoutMs)

    return () => window.clearTimeout(timeoutId)
  }, [stepIndex, activeCaptchaProvider, recaptchaScriptReady])

  useEffect(() => {
    if (!turnstileSiteKey) return
    if (stepIds[stepIndex] !== 'verify') return
    if (activeCaptchaProvider !== 'turnstile') return
    if (turnstileScriptReady) return

    const timeoutId = window.setTimeout(() => {
      updateField('captcha_token', '')
      setCaptchaWidgetError('Backup CAPTCHA timed out. Please refresh and retry.')
    }, captchaInitTimeoutMs)

    return () => window.clearTimeout(timeoutId)
  }, [stepIndex, activeCaptchaProvider, turnstileScriptReady])

  useEffect(() => {
    if (!turnstileSiteKey) return
    if (stepIds[stepIndex] !== 'verify') return
    if (activeCaptchaProvider !== 'turnstile') return
    if (!turnstileScriptReady || !window.turnstile) return
    const container = document.getElementById(captchaContainerId)
    if (!container) return

    container.innerHTML = ''
    try {
      const widgetId = window.turnstile.render(`#${captchaContainerId}`, {
        sitekey: turnstileSiteKey,
        callback: (token: string) => {
          setCaptchaWidgetError(null)
          updateField('captcha_provider', 'turnstile')
          updateField('captcha_token', token)
        },
        'expired-callback': () => {
          updateField('captcha_provider', 'turnstile')
          updateField('captcha_token', '')
          setFieldErrors((prev) => ({ ...prev, captcha_token: 'Captcha expired. Please verify again.' }))
        },
        'error-callback': () => {
          updateField('captcha_provider', 'turnstile')
          updateField('captcha_token', '')
          setCaptchaWidgetError('Cloudflare Turnstile backup encountered an error. Please retry.')
        },
        theme: 'light'
      })
      turnstileWidgetIdRef.current = widgetId
    } catch {
      updateField('captcha_provider', 'turnstile')
      updateField('captcha_token', '')
      setCaptchaWidgetError('Unable to initialize Cloudflare Turnstile backup widget')
    }

    return () => {
      if (turnstileWidgetIdRef.current && window.turnstile) {
        window.turnstile.remove(turnstileWidgetIdRef.current)
        turnstileWidgetIdRef.current = null
      }
    }
  }, [turnstileScriptReady, stepIndex, activeCaptchaProvider])

  useEffect(() => {
    if (!recaptchaSiteKey) return
    if (stepIds[stepIndex] !== 'verify') return
    if (activeCaptchaProvider !== 'recaptcha') return
    if (!recaptchaScriptReady || !window.grecaptcha) return
    const container = document.getElementById(captchaContainerId)
    if (!container) return

    container.innerHTML = ''
    try {
      const widgetId = window.grecaptcha.render(`#${captchaContainerId}`, {
        sitekey: recaptchaSiteKey,
        callback: (token: string) => {
          setCaptchaWidgetError(null)
          updateField('captcha_provider', 'recaptcha')
          updateField('captcha_token', token)
        },
        'expired-callback': () => {
          updateField('captcha_provider', 'recaptcha')
          updateField('captcha_token', '')
          setFieldErrors((prev) => ({ ...prev, captcha_token: 'Captcha expired. Please verify again.' }))
        },
        'error-callback': () => {
          if (turnstileSiteKey) {
            switchCaptchaProvider('turnstile', 'Google reCAPTCHA encountered an error. Switched to Cloudflare Turnstile backup.')
          } else {
            updateField('captcha_provider', 'recaptcha')
            updateField('captcha_token', '')
            setCaptchaWidgetError('Google reCAPTCHA encountered an error. Please retry.')
          }
        },
        theme: 'light'
      })
      recaptchaWidgetIdRef.current = widgetId
    } catch {
      if (turnstileSiteKey) {
        switchCaptchaProvider('turnstile', 'Google reCAPTCHA unavailable. Switched to Cloudflare Turnstile backup.')
      } else {
        updateField('captcha_token', '')
        setCaptchaWidgetError('Unable to initialize Google reCAPTCHA widget')
      }
    }

    return () => {
      if (recaptchaWidgetIdRef.current !== null && window.grecaptcha) {
        window.grecaptcha.reset(recaptchaWidgetIdRef.current)
        recaptchaWidgetIdRef.current = null
      }
    }
  }, [stepIndex, activeCaptchaProvider, recaptchaScriptReady])

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

  useEffect(() => {
    const loadCountryOptions = async () => {
      setCountriesLoading(true)
      setCountriesError(null)
      try {
        const { data, error } = await supabase
          .from('countries')
          .select('name, code_iso2')
          .order('name', { ascending: true })

        if (error) {
          throw new Error(error.message || 'Failed to load countries')
        }

        const countries = (data || []).reduce<CountryOption[]>((acc, country) => {
          const name = (country.name || '').trim()
          const code = (country.code_iso2 || '').trim().toUpperCase()
          if (!name && !code) return acc
          const value = code || name
          const label = code && name ? `${name} (${code})` : name || code
          acc.push({ value, label })
          return acc
        }, [])

        setCountryOptions(countries)
      } catch (error: any) {
        setCountryOptions([])
        setCountriesError(error?.message || 'Unable to load countries')
        toast.error(error?.message || 'Unable to load countries')
      } finally {
        setCountriesLoading(false)
      }
    }

    void loadCountryOptions()
  }, [])

  useEffect(() => {
    const loadCurrencyOptions = async () => {
      setCurrenciesLoading(true)
      setCurrenciesError(null)
      try {
        const { data, error } = await supabase
          .from('currencies')
          .select('code, name, symbol')
          .eq('is_active', true)
          .order('code', { ascending: true })

        if (error) {
          throw new Error(error.message || 'Failed to load currencies')
        }

        const currencies = (data || []).reduce<CurrencyOption[]>((acc, currency) => {
          const code = (currency.code || '').trim().toUpperCase()
          const name = (currency.name || '').trim()
          const symbol = (currency.symbol || '').trim()
          if (!code) return acc
          const label = [code, name, symbol ? `(${symbol})` : ''].filter(Boolean).join(' - ').replace(' - (', ' (')
          acc.push({ value: code, label })
          return acc
        }, [])

        setCurrencyOptions(currencies)
      } catch (error: any) {
        setCurrencyOptions([])
        setCurrenciesError(error?.message || 'Unable to load currencies')
        toast.error(error?.message || 'Unable to load currencies')
      } finally {
        setCurrenciesLoading(false)
      }
    }

    void loadCurrencyOptions()
  }, [])

  const validateCurrentStep = async (): Promise<boolean> => {
    if (stepIds[stepIndex] === 'package') {
      if (!form.plan_tier) {
        setFieldErrors((prev) => ({ ...prev, plan_tier: 'Package selection is required' }))
        toast.error('Select a package to continue')
        return false
      }
      setFieldErrors((prev) => ({ ...prev, plan_tier: undefined }))
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
      } else if (!countryOptions.some((country) => country.value === form.country)) {
        nextErrors.country = 'Select a country from available options'
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
          reason?: 'tenant_request_exists' | 'tenant_exists' | 'org_domain_exists'
          message?: string
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
          const duplicateMessage = response.message || 'This Organization Name and Preferred Domain combination already exists. Please use a different combination.'
          if (response.reason === 'tenant_exists' || response.reason === 'tenant_request_exists') {
            setFieldErrors((prev) => ({
              ...prev,
              organization_name: duplicateMessage
            }))
            toast.error(duplicateMessage)
            return false
          }

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
      const nextErrors: FieldErrors = {}

      if (!form.admin_first_name.trim()) nextErrors.admin_first_name = 'First Name is required'
      if (!form.admin_last_name.trim()) nextErrors.admin_last_name = 'Last Name is required'
      if (!form.admin_email.trim()) {
        nextErrors.admin_email = 'Admin Email is required'
      } else if (!z.string().email().safeParse(form.admin_email.trim()).success) {
        nextErrors.admin_email = 'Enter a valid email address'
      }
      if (!form.admin_password.trim()) {
        nextErrors.admin_password = 'Admin Password is required'
      } else if (!passwordPolicy.test(form.admin_password)) {
        nextErrors.admin_password = 'Use 12-128 chars with uppercase, lowercase, number, and special character'
      }
      if (!form.admin_password_confirm.trim()) {
        nextErrors.admin_password_confirm = 'Confirm Password is required'
      } else if (form.admin_password !== form.admin_password_confirm) {
        nextErrors.admin_password_confirm = 'Passwords do not match'
      }

      if (nextErrors.admin_first_name || nextErrors.admin_last_name || nextErrors.admin_email || nextErrors.admin_password || nextErrors.admin_password_confirm) {
        setFieldErrors((prev) => ({ ...prev, ...nextErrors }))
        toast.error(nextErrors.admin_first_name || nextErrors.admin_last_name || nextErrors.admin_email || nextErrors.admin_password || nextErrors.admin_password_confirm || 'Complete admin details to continue')
        return false
      }

      setFieldErrors((prev) => ({
        ...prev,
        admin_first_name: undefined,
        admin_last_name: undefined,
        admin_email: undefined,
        admin_password: undefined,
        admin_password_confirm: undefined
      }))
      return true
    }
    if (stepIds[stepIndex] === 'compliance') {
      const nextErrors: FieldErrors = {}

      if (!form.billing_period.trim()) nextErrors.billing_period = 'Billing Period is required'
      if (!form.data_residency.trim()) nextErrors.data_residency = 'Data Residency is required'
      if (!Number.isInteger(form.requested_user_count) || form.requested_user_count < 1) {
        nextErrors.requested_user_count = 'Requested Users must be at least 1'
      }
      if (!Number.isInteger(form.requested_franchise_count) || form.requested_franchise_count < 0) {
        nextErrors.requested_franchise_count = 'Requested Franchises cannot be negative'
      }
      if (!form.currency.trim()) {
        nextErrors.currency = 'Currency is required'
      } else if (!currencyOptions.some((currency) => currency.value === form.currency.trim().toUpperCase())) {
        nextErrors.currency = 'Select a currency from available options'
      }
      if (!form.timezone.trim()) {
        nextErrors.timezone = 'Timezone is required'
      } else if (form.timezone.trim().length < 2) {
        nextErrors.timezone = 'Timezone is invalid'
      }

      if (
        nextErrors.billing_period ||
        nextErrors.data_residency ||
        nextErrors.requested_user_count ||
        nextErrors.requested_franchise_count ||
        nextErrors.currency ||
        nextErrors.timezone
      ) {
        setFieldErrors((prev) => ({ ...prev, ...nextErrors }))
        toast.error(
          nextErrors.billing_period ||
          nextErrors.data_residency ||
          nextErrors.requested_user_count ||
          nextErrors.requested_franchise_count ||
          nextErrors.currency ||
          nextErrors.timezone ||
          'Please complete required fields'
        )
        return false
      }

      setFieldErrors((prev) => ({
        ...prev,
        billing_period: undefined,
        data_residency: undefined,
        requested_user_count: undefined,
        requested_franchise_count: undefined,
        currency: undefined,
        timezone: undefined
      }))
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
    if (!form.captcha_token.trim() || form.captcha_token.trim().length < 5) {
      const captchaErrorMessage = turnstileSiteKey ? 'Complete CAPTCHA verification to continue' : 'Captcha token is required'
      setFieldErrors((prev) => ({ ...prev, captcha_token: captchaErrorMessage }))
      toast.error(captchaErrorMessage)
      return
    }
    setFieldErrors((prev) => ({ ...prev, captcha_token: undefined }))

    const parsed = schema.safeParse(form)
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message || 'Please complete all required fields')
      return
    }

    setSubmitting(true)
    setFallbackVerificationCode(null)
    try {
      const response = await invokeAnonymous<{
        success: boolean
        request_id?: string
        email_delivery_status?: 'sent' | 'fallback_manual'
        email_delivery_message?: string | null
        verification_code?: string
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
        captcha_provider: form.captcha_provider,
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
      setFallbackVerificationCode(response.verification_code || null)
      if (response.verification_code) {
        setVerificationCode(response.verification_code)
      }
      setStatus('verification')
      if (response.email_delivery_status === 'fallback_manual' && response.verification_code) {
        toast.warning(response.email_delivery_message || 'Email delivery failed. Using fallback verification code.')
      } else {
        toast.success('Verification code sent to admin email')
      }
    } catch (error: any) {
      const message = error?.message || 'Unable to start onboarding'
      if (String(message).toLowerCase().includes('captcha service is not configured')) {
        toast.error('Captcha service is not configured. Please set Turnstile or reCAPTCHA secrets on the backend.')
      } else if (String(message).toLowerCase().includes('onboarding request already pending with status')) {
        setFieldErrors((prev) => ({
          ...prev,
          admin_email: message
        }))
        toast.error(message)
      } else if (String(message).toLowerCase().includes('request already exist')) {
        setFieldErrors((prev) => ({
          ...prev,
          organization_name: message
        }))
        toast.error(message)
      } else if (String(message).toLowerCase().includes('tenant already present')) {
        setFieldErrors((prev) => ({
          ...prev,
          organization_name: message
        }))
        toast.error(message)
      } else if (String(message).toLowerCase().includes('admin email is already registered with an existing user account')) {
        setFieldErrors((prev) => ({
          ...prev,
          admin_email: message
        }))
        toast.error(message)
      } else {
        toast.error(message)
      }
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
            <CardDescription>
              {fallbackVerificationCode
                ? `Email delivery failed. Use the fallback code below to continue for ${form.admin_email}.`
                : `Enter the 6-digit code sent to ${form.admin_email}`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {fallbackVerificationCode && (
              <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                Fallback verification code: <span className="font-semibold tracking-wider">{fallbackVerificationCode}</span>
              </div>
            )}
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
                <div className="space-y-2">
                  <Label>Package <span className="text-destructive">*</span></Label>
                  <div className={`grid md:grid-cols-3 gap-4 ${fieldErrors.plan_tier ? 'border border-destructive rounded-lg p-3' : ''}`}>
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
                  {fieldErrors.plan_tier && <p className="text-xs text-destructive">{fieldErrors.plan_tier}</p>}
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
                    <Select
                      value={form.country || '__none__'}
                      onValueChange={(value) => updateField('country', value === '__none__' ? '' : value)}
                      disabled={countriesLoading || countryOptions.length === 0}
                    >
                      <SelectTrigger id="country" className={fieldErrors.country ? 'border-destructive focus:ring-destructive/30' : ''}>
                        <SelectValue placeholder={countriesLoading ? 'Loading countries...' : 'Select country code'} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Select country</SelectItem>
                        {countryOptions.map((country) => (
                          <SelectItem key={country.value} value={country.value}>
                            {country.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {countriesError && <p className="text-xs text-destructive">{countriesError}</p>}
                    {fieldErrors.country && <p className="text-xs text-destructive">{fieldErrors.country}</p>}
                    {!countriesError && !countriesLoading && countryOptions.length === 0 && (
                      <p className="text-xs text-muted-foreground">No countries are currently available.</p>
                    )}
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
                    <Label htmlFor="admin_first_name">First Name <span className="text-destructive">*</span></Label>
                    <Input
                      id="admin_first_name"
                      value={form.admin_first_name}
                      onChange={(e) => updateField('admin_first_name', e.target.value)}
                      className={fieldErrors.admin_first_name ? 'border-destructive focus-visible:ring-destructive/30' : ''}
                    />
                    {fieldErrors.admin_first_name && <p className="text-xs text-destructive">{fieldErrors.admin_first_name}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="admin_last_name">Last Name <span className="text-destructive">*</span></Label>
                    <Input
                      id="admin_last_name"
                      value={form.admin_last_name}
                      onChange={(e) => updateField('admin_last_name', e.target.value)}
                      className={fieldErrors.admin_last_name ? 'border-destructive focus-visible:ring-destructive/30' : ''}
                    />
                    {fieldErrors.admin_last_name && <p className="text-xs text-destructive">{fieldErrors.admin_last_name}</p>}
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="admin_email">Admin Email <span className="text-destructive">*</span></Label>
                    <Input
                      id="admin_email"
                      type="email"
                      value={form.admin_email}
                      onChange={(e) => updateField('admin_email', e.target.value)}
                      className={fieldErrors.admin_email ? 'border-destructive focus-visible:ring-destructive/30' : ''}
                    />
                    {fieldErrors.admin_email && <p className="text-xs text-destructive">{fieldErrors.admin_email}</p>}
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="admin_password">Admin Password <span className="text-destructive">*</span></Label>
                    <div className="relative">
                      <Input
                        id="admin_password"
                        type={showAdminPassword ? 'text' : 'password'}
                        value={form.admin_password}
                        onChange={(e) => updateField('admin_password', e.target.value)}
                        className={[
                          'pr-10',
                          fieldErrors.admin_password ? 'border-destructive focus-visible:ring-destructive/30' : ''
                        ].join(' ')}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-2 top-1/2 h-8 w-8 -translate-y-1/2"
                        onClick={() => setShowAdminPassword((prev) => !prev)}
                        aria-label={showAdminPassword ? 'Hide password' : 'Show password'}
                        title={showAdminPassword ? 'Hide password' : 'Show password'}
                      >
                        {showAdminPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                    {fieldErrors.admin_password && <p className="text-xs text-destructive">{fieldErrors.admin_password}</p>}
                    {!fieldErrors.admin_password && (
                      <p className="text-xs text-muted-foreground">Use 12-128 characters with uppercase, lowercase, number, and special character.</p>
                    )}
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="admin_password_confirm">Confirm Password <span className="text-destructive">*</span></Label>
                    <div className="relative">
                      <Input
                        id="admin_password_confirm"
                        type={showAdminPasswordConfirm ? 'text' : 'password'}
                        value={form.admin_password_confirm}
                        onChange={(e) => updateField('admin_password_confirm', e.target.value)}
                        className={[
                          'pr-10',
                          fieldErrors.admin_password_confirm ? 'border-destructive focus-visible:ring-destructive/30' : ''
                        ].join(' ')}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-2 top-1/2 h-8 w-8 -translate-y-1/2"
                        onClick={() => setShowAdminPasswordConfirm((prev) => !prev)}
                        aria-label={showAdminPasswordConfirm ? 'Hide password' : 'Show password'}
                        title={showAdminPasswordConfirm ? 'Hide password' : 'Show password'}
                      >
                        {showAdminPasswordConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                    {fieldErrors.admin_password_confirm && <p className="text-xs text-destructive">{fieldErrors.admin_password_confirm}</p>}
                  </div>
                </div>
              )}

              {stepIds[stepIndex] === 'compliance' && (
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Billing Period <span className="text-destructive">*</span></Label>
                    <Select value={form.billing_period} onValueChange={(v: BillingPeriod) => updateField('billing_period', v)}>
                      <SelectTrigger className={fieldErrors.billing_period ? 'border-destructive focus:ring-destructive/30' : ''}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="annual">Annual</SelectItem>
                      </SelectContent>
                    </Select>
                    {fieldErrors.billing_period && <p className="text-xs text-destructive">{fieldErrors.billing_period}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label>Data Residency <span className="text-destructive">*</span></Label>
                    <Select value={form.data_residency} onValueChange={(v) => updateField('data_residency', v)}>
                      <SelectTrigger className={fieldErrors.data_residency ? 'border-destructive focus:ring-destructive/30' : ''}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="India">India</SelectItem>
                        <SelectItem value="EU">EU</SelectItem>
                        <SelectItem value="US">US</SelectItem>
                        <SelectItem value="Singapore">Singapore</SelectItem>
                      </SelectContent>
                    </Select>
                    {fieldErrors.data_residency && <p className="text-xs text-destructive">{fieldErrors.data_residency}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="requested_user_count">Requested Users <span className="text-destructive">*</span></Label>
                    <Input
                      id="requested_user_count"
                      type="number"
                      value={String(form.requested_user_count)}
                      onChange={(e) => updateField('requested_user_count', Number(e.target.value || 1))}
                      className={fieldErrors.requested_user_count ? 'border-destructive focus-visible:ring-destructive/30' : ''}
                    />
                    {fieldErrors.requested_user_count && <p className="text-xs text-destructive">{fieldErrors.requested_user_count}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="requested_franchise_count">Requested Franchises <span className="text-destructive">*</span></Label>
                    <Input
                      id="requested_franchise_count"
                      type="number"
                      value={String(form.requested_franchise_count)}
                      onChange={(e) => updateField('requested_franchise_count', Number(e.target.value || 0))}
                      className={fieldErrors.requested_franchise_count ? 'border-destructive focus-visible:ring-destructive/30' : ''}
                    />
                    {fieldErrors.requested_franchise_count && <p className="text-xs text-destructive">{fieldErrors.requested_franchise_count}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="currency">Currency <span className="text-destructive">*</span></Label>
                    <Select
                      value={form.currency || '__none__'}
                      onValueChange={(value) => updateField('currency', value === '__none__' ? '' : value)}
                      disabled={currenciesLoading || currencyOptions.length === 0}
                    >
                      <SelectTrigger id="currency" className={fieldErrors.currency ? 'border-destructive focus:ring-destructive/30' : ''}>
                        <SelectValue placeholder={currenciesLoading ? 'Loading currencies...' : 'Select currency'} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Select currency</SelectItem>
                        {currencyOptions.map((currency) => (
                          <SelectItem key={currency.value} value={currency.value}>
                            {currency.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {currenciesError && <p className="text-xs text-destructive">{currenciesError}</p>}
                    {fieldErrors.currency && <p className="text-xs text-destructive">{fieldErrors.currency}</p>}
                    {!currenciesError && !currenciesLoading && currencyOptions.length === 0 && (
                      <p className="text-xs text-muted-foreground">No currencies are currently available.</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="timezone">Timezone <span className="text-destructive">*</span></Label>
                    <Input
                      id="timezone"
                      value={form.timezone}
                      onChange={(e) => updateField('timezone', e.target.value)}
                      className={fieldErrors.timezone ? 'border-destructive focus-visible:ring-destructive/30' : ''}
                    />
                    {fieldErrors.timezone && <p className="text-xs text-destructive">{fieldErrors.timezone}</p>}
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
                    <Label htmlFor="captcha_token">Captcha Token <span className="text-destructive">*</span></Label>
                    {(turnstileSiteKey || recaptchaSiteKey) ? (
                      <div className="space-y-2">
                        <div id={captchaContainerId} className={fieldErrors.captcha_token ? 'rounded-md border border-destructive p-2' : ''} />
                        <p className="text-xs text-muted-foreground">
                          Active CAPTCHA provider: {getCaptchaProviderLabel(activeCaptchaProvider)}
                        </p>
                        {hasBothCaptchaProviders && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              switchCaptchaProvider(
                                activeCaptchaProvider === 'recaptcha' ? 'turnstile' : 'recaptcha',
                                activeCaptchaProvider === 'recaptcha'
                                  ? 'Switched to Cloudflare Turnstile backup.'
                                  : 'Switched to Google reCAPTCHA primary.'
                              )
                            }
                            disabled={submitting || verifying}
                          >
                            {activeCaptchaProvider === 'recaptcha' ? 'Switch to Cloudflare Turnstile' : 'Switch to Google reCAPTCHA'}
                          </Button>
                        )}
                        {captchaWidgetError && <p className="text-xs text-destructive">{captchaWidgetError}</p>}
                        {!captchaWidgetError && !form.captcha_token && <p className="text-xs text-muted-foreground">Complete CAPTCHA challenge to continue.</p>}
                      </div>
                    ) : (
                      <Input
                        id="captcha_token"
                        value={form.captcha_token}
                        onChange={(e) => updateField('captcha_token', e.target.value)}
                        placeholder={allowDevCaptchaBypass ? 'dev-captcha-pass' : 'Set VITE_TURNSTILE_SITE_KEY to enable CAPTCHA'}
                        className={fieldErrors.captcha_token ? 'border-destructive focus-visible:ring-destructive/30' : ''}
                      />
                    )}
                    {fieldErrors.captcha_token && <p className="text-xs text-destructive">{fieldErrors.captcha_token}</p>}
                    {!turnstileSiteKey && !recaptchaSiteKey && (
                      <p className="text-xs text-muted-foreground">
                        CAPTCHA site key is not configured in frontend. Set VITE_TURNSTILE_SITE_KEY or VITE_RECAPTCHA_SITE_KEY.
                      </p>
                    )}
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
