// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../types.d.ts" />
import { serveWithLogger } from '../_shared/logger.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { requireAuth } from '../_shared/auth.ts'
import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'

type CaptchaVerificationResult = {
  success: boolean
  provider: 'turnstile' | 'recaptcha' | 'dev_bypass' | 'none'
  score?: number
  reason?: 'config_missing' | 'token_missing' | 'provider_request_failed' | 'provider_rejected' | 'invalid_bypass'
  error_codes?: string[]
}

type CaptchaProviderName = 'turnstile' | 'recaptcha' | 'dev_bypass' | 'none'

const startRegistrationSchema = z.object({
  action: z.literal('start_registration'),
  organization_name: z.string().min(2).max(120),
  country: z.string().min(2).max(80),
  plan_tier: z.enum(['free', 'professional', 'enterprise']),
  billing_period: z.enum(['monthly', 'annual']).default('monthly'),
  requested_user_count: z.number().int().min(1).max(10000).default(2),
  requested_franchise_count: z.number().int().min(0).max(10000).default(1),
  data_residency: z.string().min(2).max(80),
  captcha_provider: z.enum(['turnstile', 'recaptcha', 'dev_bypass', 'none']).optional(),
  captcha_token: z.string().min(5),
  legal_name: z.string().max(160).nullish(),
  tax_id: z.string().max(80).nullish(),
  tax_jurisdiction: z.string().max(80).nullish(),
  registered_address: z.string().max(400).nullish(),
  admin: z.object({
    email: z.string().email(),
    first_name: z.string().min(1).max(80),
    last_name: z.string().min(1).max(80),
    password: z.string()
      .min(12)
      .max(128)
      .regex(/[a-z]/, 'Password must include at least one lowercase letter')
      .regex(/[A-Z]/, 'Password must include at least one uppercase letter')
      .regex(/\d/, 'Password must include at least one number')
      .regex(/[^A-Za-z0-9]/, 'Password must include at least one special character')
  }),
  initial_config: z.object({
    currency: z.string().min(3).max(3).nullish(),
    timezone: z.string().min(2).max(80).nullish(),
    preferred_language: z.string().min(2).max(10).nullish(),
    domain: z.string().max(120).nullish(),
    industry: z.string().max(80).nullish(),
    website: z.string().max(180).nullish()
  }).optional()
})

const verifyEmailSchema = z.object({
  action: z.literal('verify_email'),
  request_id: z.string().uuid(),
  verification_code: z.string().regex(/^\d{6}$/),
  admin_password: z.string()
    .min(12)
    .max(128)
    .regex(/[a-z]/, 'Password must include at least one lowercase letter')
    .regex(/[A-Z]/, 'Password must include at least one uppercase letter')
    .regex(/\d/, 'Password must include at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must include at least one special character')
    .optional()
})

const adminListSchema = z.object({
  action: z.literal('admin_list_requests'),
  status: z.string().optional(),
  search: z.string().optional(),
  from_date: z.string().optional(),
  to_date: z.string().optional(),
  limit: z.number().int().min(1).max(200).optional()
})

const adminDetailSchema = z.object({
  action: z.literal('admin_get_request_detail'),
  request_id: z.string().uuid()
})

const adminTriggerVerificationSchema = z.object({
  action: z.literal('admin_trigger_verification_email'),
  request_id: z.string().uuid(),
  comment: z.string().max(500).optional()
})

const adminConfirmEmailSchema = z.object({
  action: z.literal('admin_confirm_email'),
  request_id: z.string().uuid(),
  comment: z.string().max(500).optional()
})

const adminApproveSchema = z.object({
  action: z.literal('admin_approve_request'),
  request_id: z.string().uuid(),
  comment: z.string().max(1000).optional()
})

const adminRejectSchema = z.object({
  action: z.literal('admin_reject_request'),
  request_id: z.string().uuid(),
  comment: z.string().min(3).max(1500)
})

const adminBulkSchema = z.object({
  action: z.literal('admin_bulk_action'),
  operation: z.enum(['approve', 'reject', 'trigger_verification_email', 'confirm_email']),
  request_ids: z.array(z.string().uuid()).min(1).max(100),
  comment: z.string().max(1500).optional()
})

const listDomainsSchema = z.object({
  action: z.union([z.literal('list_domains'), z.literal('get_platform_domains')])
})

const checkOrgDomainUniquenessSchema = z.object({
  action: z.literal('check_org_domain_uniqueness'),
  organization_name: z.string().min(2).max(120),
  domain: z.string().min(1).max(120)
})

const removeControlCharacters = (value: string): string =>
  value
    .split('')
    .filter((char) => {
      const code = char.charCodeAt(0)
      return code >= 32 && code !== 127
    })
    .join('')

const sanitizeText = (value: string, maxLength: number): string =>
  removeControlCharacters(value)
    .replace(/[<>]/g, '')
    .trim()
    .slice(0, maxLength)

const sanitizeEmail = (value: string): string =>
  sanitizeText(value, 160).toLowerCase()

const sanitizeDomain = (value: string): string =>
  sanitizeText(value, 120).toLowerCase().replace(/[^a-z0-9.-]/g, '')

const pendingOnboardingStatuses = ['pending_verification', 'email_verified', 'approved', 'in_progress', 'provisioning'] as const

const formatOnboardingStatus = (status: string): string =>
  sanitizeText(status, 80).replace(/_/g, ' ')

const duplicateOnboardingMessage = (status: string): string =>
  `Onboarding request already pending with status: ${formatOnboardingStatus(status)}`

const existingUserMessage = 'Admin email is already registered with an existing user account. Please use a different admin email.'

const tenantRequestAlreadyExistsMessage = 'Request already exist.'

const tenantAlreadyPresentMessage = 'Tenant already present.'

const tenantDuplicateRequestStatuses = [
  'pending_verification',
  'email_verified',
  'approved',
  'in_progress',
  'provisioning',
  'completed'
] as const

const findAuthUserByEmail = async (
  supabase: SupabaseClient,
  email: string
): Promise<{ id: string; email: string | null } | null> => {
  const targetEmail = sanitizeEmail(email)
  let page = 1
  const perPage = 100

  while (page <= 20) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage })
    if (error) {
      throw error
    }

    const matchedUser = (data?.users || []).find((user) => sanitizeEmail(user.email || '') === targetEmail)
    if (matchedUser) {
      return { id: matchedUser.id, email: matchedUser.email || null }
    }

    if (!data?.users || data.users.length < perPage) {
      break
    }
    page += 1
  }

  return null
}

const json = (status: number, payload: Record<string, unknown>) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })

const getClientIp = (req: Request): string => {
  const forwarded = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || ''
  if (!forwarded) return 'unknown'
  return forwarded.split(',')[0].trim().slice(0, 120) || 'unknown'
}

const sha256Hex = async (value: string): Promise<string> => {
  const input = new TextEncoder().encode(value)
  const hash = await crypto.subtle.digest('SHA-256', input)
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

const generateVerificationCode = (): string =>
  String(Math.floor(100000 + Math.random() * 900000))

const addMinutes = (date: Date, minutes: number): string =>
  new Date(date.getTime() + minutes * 60 * 1000).toISOString()

const slugifyOrganizationName = (organizationName: string): string =>
  sanitizeText(organizationName, 80)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50)

const buildUniqueSlug = async (supabase: SupabaseClient, organizationName: string): Promise<string> => {
  const base = sanitizeText(organizationName, 80)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50) || `tenant-${Date.now()}`

  let currentSlug = base
  for (let attempt = 0; attempt < 10; attempt++) {
    const { data, error } = await supabase
      .from('tenants')
      .select('id')
      .eq('slug', currentSlug)
      .limit(1)
    if (error) throw error
    if (!data || data.length === 0) {
      return currentSlug
    }
    const suffix = crypto.randomUUID().replace(/-/g, '').slice(0, 6)
    currentSlug = `${base}-${suffix}`.slice(0, 60)
  }
  return `${base}-${crypto.randomUUID().replace(/-/g, '').slice(0, 8)}`.slice(0, 60)
}

const isValidIpAddress = (value: string): boolean => {
  const trimmed = (value || '').trim()
  if (!trimmed) return false

  const ipv4Match = /^(\d{1,3}\.){3}\d{1,3}$/.test(trimmed)
  if (ipv4Match) {
    const parts = trimmed.split('.').map((part) => Number(part))
    return parts.length === 4 && parts.every((part) => Number.isInteger(part) && part >= 0 && part <= 255)
  }

  const ipv6Match = trimmed.length <= 45 && /^[0-9a-fA-F:]+$/.test(trimmed) && trimmed.includes(':')
  return ipv6Match
}

const verifyCaptcha = async (
  token: string,
  ipAddress: string,
  providerHint?: CaptchaProviderName
): Promise<CaptchaVerificationResult> => {
  const turnstileSecret = Deno.env.get('TURNSTILE_SECRET_KEY') || Deno.env.get('CAPTCHA_TURNSTILE_SECRET_KEY')
  const recaptchaSecret = Deno.env.get('RECAPTCHA_SECRET_KEY') || Deno.env.get('CAPTCHA_RECAPTCHA_SECRET_KEY')
  const rawAllowBypass = (Deno.env.get('ALLOW_DEV_CAPTCHA_BYPASS') || Deno.env.get('CAPTCHA_ALLOW_DEV_BYPASS') || '').trim().toLowerCase()
  const allowBypass = rawAllowBypass === 'true' || rawAllowBypass === '1' || rawAllowBypass === 'yes'
  const bypassToken = (Deno.env.get('DEV_CAPTCHA_BYPASS_TOKEN') || 'dev-captcha-pass').trim()
  const trimmedToken = sanitizeText(token || '', 4096)
  const sanitizedIpAddress = isValidIpAddress(ipAddress) ? ipAddress : ''

  if (!trimmedToken) {
    return { success: false, provider: 'none', reason: 'token_missing' }
  }

  const verifyTurnstile = async (): Promise<CaptchaVerificationResult> => {
    if (!turnstileSecret) {
      return { success: false, provider: 'turnstile', reason: 'config_missing' }
    }
    try {
      const body = new URLSearchParams({
        secret: turnstileSecret,
        response: trimmedToken
      })
      if (sanitizedIpAddress) body.set('remoteip', sanitizedIpAddress)
      const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body
      })

      if (!response.ok) {
        return { success: false, provider: 'turnstile', reason: 'provider_request_failed' }
      }

      const data = await response.json()
      const errorCodes = Array.isArray(data?.['error-codes']) ? data['error-codes'].map((code: unknown) => String(code)) : []
      if (!data?.success) {
        return {
          success: false,
          provider: 'turnstile',
          reason: 'provider_rejected',
          error_codes: errorCodes
        }
      }

      return {
        success: true,
        provider: 'turnstile',
        score: typeof data?.score === 'number' ? data.score : undefined
      }
    } catch {
      return { success: false, provider: 'turnstile', reason: 'provider_request_failed' }
    }
  }

  const verifyRecaptcha = async (): Promise<CaptchaVerificationResult> => {
    if (!recaptchaSecret) {
      return { success: false, provider: 'recaptcha', reason: 'config_missing' }
    }
    try {
      const body = new URLSearchParams({
        secret: recaptchaSecret,
        response: trimmedToken
      })
      if (sanitizedIpAddress) body.set('remoteip', sanitizedIpAddress)
      const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body
      })

      if (!response.ok) {
        return { success: false, provider: 'recaptcha', reason: 'provider_request_failed' }
      }

      const data = await response.json()
      const errorCodes = Array.isArray(data?.['error-codes']) ? data['error-codes'].map((code: unknown) => String(code)) : []
      const minScoreRaw = sanitizeText(Deno.env.get('RECAPTCHA_MIN_SCORE') || '0', 16)
      const minScore = Number.isFinite(Number(minScoreRaw)) ? Number(minScoreRaw) : 0
      const score = typeof data?.score === 'number' ? data.score : undefined
      const scorePass = score === undefined ? true : score >= minScore
      if (!data?.success || !scorePass) {
        return {
          success: false,
          provider: 'recaptcha',
          reason: 'provider_rejected',
          error_codes: scorePass ? errorCodes : [...errorCodes, 'low-score']
        }
      }

      return {
        success: true,
        provider: 'recaptcha',
        score
      }
    } catch {
      return { success: false, provider: 'recaptcha', reason: 'provider_request_failed' }
    }
  }

  const normalizedProviderHint: CaptchaProviderName =
    providerHint === 'turnstile' || providerHint === 'recaptcha' || providerHint === 'dev_bypass' || providerHint === 'none'
      ? providerHint
      : 'none'

  if (normalizedProviderHint === 'turnstile') {
    const turnstileResult = await verifyTurnstile()
    if (turnstileResult.success) return turnstileResult
    return turnstileResult
  }

  if (normalizedProviderHint === 'recaptcha') {
    const recaptchaResult = await verifyRecaptcha()
    if (recaptchaResult.success) return recaptchaResult
    if (recaptchaResult.reason === 'provider_request_failed' && turnstileSecret) {
      return verifyTurnstile()
    }
    return recaptchaResult
  }

  if (allowBypass && trimmedToken === bypassToken) {
    return {
      success: true,
      provider: 'dev_bypass',
      score: 1
    }
  }

  if (allowBypass) {
    return { success: false, provider: 'dev_bypass', reason: 'invalid_bypass' }
  }

  if (recaptchaSecret) {
    const recaptchaResult = await verifyRecaptcha()
    if (recaptchaResult.success) {
      return recaptchaResult
    }
    if (recaptchaResult.reason === 'provider_request_failed' && turnstileSecret) {
      return verifyTurnstile()
    }
    return recaptchaResult
  }

  if (turnstileSecret) {
    return verifyTurnstile()
  }

  return { success: false, provider: 'none', reason: 'config_missing' }
}

const applyRateLimit = async (
  supabase: SupabaseClient,
  scope: 'ip' | 'email',
  key: string,
  maxAttempts: number,
  windowMinutes: number,
  blockMinutes: number
): Promise<{ allowed: boolean; retry_after_seconds: number }> => {
  const id = `${scope}:${key}`
  const now = new Date()
  const { data, error } = await supabase
    .from('self_service_onboarding_rate_limits')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error) {
    throw error
  }

  if (!data) {
    const { error: insertError } = await supabase
      .from('self_service_onboarding_rate_limits')
      .insert({
        id,
        scope,
        attempt_count: 1,
        window_started_at: now.toISOString(),
        last_attempt_at: now.toISOString(),
        blocked_until: null
      })
    if (insertError) throw insertError
    return { allowed: true, retry_after_seconds: 0 }
  }

  const blockedUntil = data.blocked_until ? new Date(data.blocked_until) : null
  if (blockedUntil && blockedUntil > now) {
    const retryAfter = Math.ceil((blockedUntil.getTime() - now.getTime()) / 1000)
    return { allowed: false, retry_after_seconds: retryAfter }
  }

  const windowStartedAt = new Date(data.window_started_at)
  const elapsedMs = now.getTime() - windowStartedAt.getTime()
  const inWindow = elapsedMs <= windowMinutes * 60 * 1000

  const nextAttemptCount = inWindow ? (data.attempt_count || 0) + 1 : 1
  const nextWindowStartedAt = inWindow ? data.window_started_at : now.toISOString()
  let nextBlockedUntil: string | null = null

  if (nextAttemptCount > maxAttempts) {
    nextBlockedUntil = addMinutes(now, blockMinutes)
  }

  const { error: updateError } = await supabase
    .from('self_service_onboarding_rate_limits')
    .update({
      attempt_count: nextAttemptCount,
      window_started_at: nextWindowStartedAt,
      blocked_until: nextBlockedUntil,
      last_attempt_at: now.toISOString()
    })
    .eq('id', id)
  if (updateError) throw updateError

  if (nextBlockedUntil) {
    const retryAfter = Math.ceil((new Date(nextBlockedUntil).getTime() - now.getTime()) / 1000)
    return { allowed: false, retry_after_seconds: retryAfter }
  }

  return { allowed: true, retry_after_seconds: 0 }
}

const sendVerificationEmail = async (
  supabase: SupabaseClient,
  to: string,
  code: string,
  organizationName: string
) => {
  const html = `<p>Your Logic Nexus-AI verification code for <strong>${organizationName}</strong> is:</p><h2>${code}</h2><p>This code expires in 15 minutes.</p>`
  const payload = {
    to: [to],
    subject: 'Verify your Logic Nexus-AI onboarding request',
    body: html,
    provider: 'resend',
    priority: 'high',
    isVip: true
  }

  const { data, error } = await supabase.functions.invoke('send-email', {
    body: payload
  })

  if (error) {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    if (supabaseUrl && serviceRoleKey) {
      const response = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${serviceRoleKey}`,
          apikey: serviceRoleKey
        },
        body: JSON.stringify(payload)
      })
      const responseText = await response.text()
      let responseJson: any = null
      try {
        responseJson = responseText ? JSON.parse(responseText) : null
      } catch {
        responseJson = null
      }
      if (!response.ok) {
        const fallbackError = responseJson?.error || responseText || error.message || 'Unable to send verification email'
        throw new Error(fallbackError)
      }
      if (responseJson?.success === false) {
        throw new Error(responseJson?.error || 'Unable to send verification email')
      }
      return
    }
    throw new Error(error.message || 'Unable to send verification email')
  }
  if (data?.success === false) {
    throw new Error(data?.error || 'Unable to send verification email')
  }
}

const getMatchingPlan = async (supabase: SupabaseClient, tier: 'free' | 'professional' | 'enterprise') => {
  const { data, error } = await supabase
    .from('subscription_plans')
    .select('id, name, tier, price_monthly, price_annual')
    .eq('is_active', true)
    .eq('tier', tier)
    .order('price_monthly', { ascending: true })
    .limit(1)

  if (error) throw error
  if (!data || data.length === 0) return null
  return data[0]
}

const generateStrongPassword = (): string => {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
  const specials = '!@#$%^&*()-_=+[]{}'
  const randomChunk = (len: number, chars: string) =>
    Array.from(crypto.getRandomValues(new Uint32Array(len)))
      .map((n) => chars[n % chars.length])
      .join('')
  return `${randomChunk(6, alphabet)}${randomChunk(2, specials)}${randomChunk(4, '0123456789')}${randomChunk(4, alphabet)}`
}

const normalizeRequestStatus = (rawStatus: string): string => {
  if (rawStatus === 'provisioning') return 'in_progress'
  return rawStatus
}

const getPlatformOwnerRecipients = async (supabase: SupabaseClient): Promise<string[]> => {
  const { data: roleRows, error: roleError } = await supabase
    .from('user_roles')
    .select('user_id')
    .eq('role', 'platform_admin')
  if (roleError || !roleRows || roleRows.length === 0) return []

  const userIds = roleRows.map((row: any) => row.user_id).filter(Boolean)
  if (userIds.length === 0) return []

  const { data: profileRows, error: profileError } = await supabase
    .from('profiles')
    .select('email')
    .in('id', userIds)
  if (profileError || !profileRows) return []

  return Array.from(
    new Set(
      profileRows
        .map((row: any) => sanitizeEmail(row.email || ''))
        .filter((email) => email.length > 5 && email.includes('@'))
    )
  )
}

const sendEmailNotification = async (
  supabase: SupabaseClient,
  to: string[],
  subject: string,
  html: string
) => {
  if (!Array.isArray(to) || to.length === 0) return
  const payload = {
    to,
    subject,
    body: html,
    provider: 'resend',
    priority: 'high',
    isVip: true
  }
  const { data, error } = await supabase.functions.invoke('send-email', { body: payload })
  if (error) throw new Error(error.message || 'Unable to send notification email')
  if (data?.success === false) throw new Error(data?.error || 'Unable to send notification email')
}

const logOnboardingAudit = async (
  supabase: SupabaseClient,
  userId: string,
  requestId: string,
  action: string,
  details: Record<string, unknown>
) => {
  await supabase.from('audit_logs').insert({
    user_id: userId,
    action,
    resource_type: 'self_service_onboarding_request',
    resource_id: requestId,
    details
  })
}

type PlatformOwnerAuthResult =
  | { authorized: true; userId: string }
  | { authorized: false; response: Response }

const requirePlatformOwner = async (req: Request, logger: any, supabase: SupabaseClient): Promise<PlatformOwnerAuthResult> => {
  const auth = await requireAuth(req, logger)
  if (auth.error || !auth.user) {
    return {
      authorized: false,
      response: json(401, { success: false, error: 'Unauthorized' })
    }
  }

  const { data: isAdmin, error: adminCheckError } = await supabase.rpc('is_platform_admin', {
    check_user_id: auth.user.id
  })
  if (adminCheckError || !isAdmin) {
    return {
      authorized: false,
      response: json(403, { success: false, error: 'Forbidden. Platform Owner role is required' })
    }
  }

  return { authorized: true, userId: auth.user.id }
}

const performProvisioningForRequest = async (
  supabase: SupabaseClient,
  logger: any,
  requestRow: any
) => {
  if (requestRow.tenant_id) {
    const { data: existingTenant } = await supabase
      .from('tenants')
      .select('id')
      .eq('id', requestRow.tenant_id)
      .limit(1)
      .maybeSingle()
    if (existingTenant?.id) {
      return {
        success: true,
        tenant_id: existingTenant.id,
        onboarding_session_id: requestRow.onboarding_session_id || null
      }
    }
  }

  const requestPayload = requestRow.request_payload || {}
  const initialConfig = requestPayload.initial_config || {}
  const isPaidPlan = requestRow.plan_tier !== 'free'
  let resolvedCountryCode = sanitizeText(requestRow.country || '', 80).toUpperCase()
  let resolvedCountryName = sanitizeText(requestRow.country || '', 120)
  let resolvedCurrencyCode = sanitizeText(requestRow.currency || initialConfig.currency || 'USD', 3).toUpperCase()

  if (requestRow.country_id) {
    const { data: countryRef, error: countryRefError } = await supabase
      .from('countries')
      .select('id, name, code_iso2')
      .eq('id', requestRow.country_id)
      .limit(1)
      .maybeSingle()
    if (countryRefError) throw new Error(countryRefError.message || 'Unable to resolve country reference')
    if (!countryRef?.id) throw new Error('Country reference is invalid for this onboarding request')
    resolvedCountryCode = sanitizeText(countryRef.code_iso2 || resolvedCountryCode, 80).toUpperCase()
    resolvedCountryName = sanitizeText(countryRef.name || resolvedCountryName, 120)
  }

  if (requestRow.currency_id) {
    const { data: currencyRef, error: currencyRefError } = await supabase
      .from('currencies')
      .select('id, code')
      .eq('id', requestRow.currency_id)
      .limit(1)
      .maybeSingle()
    if (currencyRefError) throw new Error(currencyRefError.message || 'Unable to resolve currency reference')
    if (!currencyRef?.id) throw new Error('Currency reference is invalid for this onboarding request')
    resolvedCurrencyCode = sanitizeText(currencyRef.code || resolvedCurrencyCode, 3).toUpperCase()
  }

  const orgSlug = await buildUniqueSlug(supabase, requestRow.organization_slug || requestRow.organization_name)
  const { data: tenant, error: tenantError } = await supabase
    .from('tenants')
    .insert({
      name: requestRow.organization_name,
      slug: orgSlug,
      subscription_tier: requestRow.plan_tier,
      max_users: requestRow.requested_user_count,
      max_franchises: requestRow.requested_franchise_count,
      country: resolvedCountryCode || resolvedCountryName,
      status: isPaidPlan ? 'pending' : 'active',
      settings: {
        onboarding_source: 'self_service',
        onboarding_status: isPaidPlan ? 'payment_pending' : 'active',
        data_residency: { region: requestRow.data_residency },
        locale: {
          currency: resolvedCurrencyCode || 'USD',
          timezone: initialConfig.timezone || 'UTC',
          preferred_language: initialConfig.preferred_language || 'en'
        }
      }
    })
    .select('id, name')
    .single()
  if (tenantError || !tenant) throw new Error(tenantError?.message || 'Tenant creation failed')

  const generatedPassword = generateStrongPassword()
  const { data: createdUser, error: userError } = await supabase.auth.admin.createUser({
    email: requestRow.admin_email,
    password: generatedPassword,
    email_confirm: true,
    user_metadata: {
      first_name: requestRow.admin_first_name,
      last_name: requestRow.admin_last_name,
      tenant_id: tenant.id
    },
    app_metadata: {
      role: 'tenant_admin',
      tenant_id: tenant.id
    }
  })

  if (userError || !createdUser?.user) {
    await supabase.from('tenants').delete().eq('id', tenant.id)
    throw new Error(userError?.message || 'Admin user creation failed')
  }

  const adminUserId = createdUser.user.id
  await supabase.from('profiles').upsert({
    id: adminUserId,
    email: requestRow.admin_email,
    first_name: requestRow.admin_first_name,
    last_name: requestRow.admin_last_name,
    tenant_id: tenant.id
  })
  await supabase.from('user_roles').upsert({
    user_id: adminUserId,
    role: 'tenant_admin',
    tenant_id: tenant.id
  })
  await supabase.from('tenant_profile').upsert({
    tenant_id: tenant.id,
    legal_name: requestPayload.legal_name || requestRow.organization_name,
    registered_address: requestPayload.registered_address || null,
    tax_id: requestPayload.tax_id || null,
    tax_jurisdiction: requestPayload.tax_jurisdiction || null,
    country_of_operation: resolvedCountryName || resolvedCountryCode || requestRow.country,
    data_residency_region: requestRow.data_residency
  }, { onConflict: 'tenant_id' })

  const { data: onboardingSession, error: sessionError } = await supabase
    .from('tenant_onboarding_sessions')
    .upsert({
      tenant_id: tenant.id,
      status: isPaidPlan ? 'payment_pending' : 'active',
      current_step: isPaidPlan ? 'payment' : 'completed',
      started_by: adminUserId,
      step_payloads: {
        source: 'self_service',
        product: 'logic-nexus-ai',
        legal_profile_completed: true,
        data_residency_completed: true,
        email_verified: true
      },
      completed_at: isPaidPlan ? null : new Date().toISOString()
    }, { onConflict: 'tenant_id' })
    .select('id')
    .single()
  if (sessionError || !onboardingSession) throw new Error(sessionError?.message || 'Onboarding session creation failed')

  const plan = await getMatchingPlan(supabase, requestRow.plan_tier)
  if (plan) {
    const now = new Date()
    const trialEnd = isPaidPlan ? addMinutes(now, 7 * 24 * 60) : null
    const nextPeriodEnd = requestRow.billing_period === 'annual'
      ? new Date(now.getFullYear() + 1, now.getMonth(), now.getDate()).toISOString()
      : new Date(now.getFullYear(), now.getMonth() + 1, now.getDate()).toISOString()
    await supabase.from('tenant_subscriptions').insert({
      tenant_id: tenant.id,
      plan_id: plan.id,
      status: isPaidPlan ? 'trial' : 'active',
      current_period_start: now.toISOString(),
      current_period_end: nextPeriodEnd,
      trial_end: trialEnd,
      metadata: {
        source: 'self_service_onboarding',
        requested_user_count: requestRow.requested_user_count,
        requested_franchise_count: requestRow.requested_franchise_count,
        billing_period: requestRow.billing_period
      }
    })
  }

  try {
    await sendEmailNotification(
      supabase,
      [requestRow.admin_email],
      'Your Logic Nexus-AI workspace is ready',
      `<p>Your onboarding request for <strong>${sanitizeText(requestRow.organization_name || '', 120)}</strong> has been approved and provisioned.</p><p>Sign in with your email and use password reset if needed.</p>`
    )
  } catch (emailError: any) {
    await logger.warn('Post-provisioning notification email failed', {
      requestId: requestRow.id,
      error: String(emailError?.message || emailError)
    })
  }

  return {
    success: true,
    tenant_id: tenant.id,
    admin_user_id: adminUserId,
    onboarding_session_id: onboardingSession.id
  }
}

serveWithLogger(async (req, logger, supabase) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return json(405, { success: false, error: 'Method not allowed' })
  }

  let payload: unknown
  try {
    payload = await req.json()
  } catch {
    return json(400, { success: false, error: 'Invalid JSON payload' })
  }

  const action = (payload as { action?: string })?.action
  const ipAddress = getClientIp(req)
  const userAgent = sanitizeText(req.headers.get('user-agent') || 'unknown', 240)

  if (action === 'list_domains' || action === 'get_platform_domains') {
    const parsed = listDomainsSchema.safeParse(payload)
    if (!parsed.success) {
      return json(422, { success: false, error: 'Validation failed', issues: parsed.error.issues })
    }

    const { data: platformDomains, error: domainsError } = await supabase
      .from('platform_domains')
      .select('id, key, code, name, description, is_active, status')
      .eq('is_active', true)
      .order('name', { ascending: true })

    if (domainsError) {
      await logger.error('Failed to load platform domains', { error: domainsError.message })
      return json(500, { success: false, error: 'Unable to load available domains' })
    }

    const domains = (platformDomains || [])
      .map((domain) => {
        const value = sanitizeDomain(domain.key || domain.code || domain.name || '')
        if (!value) return null
        const label = sanitizeText(domain.name || domain.code || domain.key || value, 120)
        return {
          value,
          label,
          description: domain.description ? sanitizeText(domain.description, 300) : null
        }
      })
      .filter((domain): domain is { value: string; label: string; description: string | null } => Boolean(domain))

    return json(200, {
      success: true,
      domains
    })
  }

  if (action === 'check_org_domain_uniqueness') {
    const parsed = checkOrgDomainUniquenessSchema.safeParse(payload)
    if (!parsed.success) {
      return json(422, { success: false, error: 'Validation failed', issues: parsed.error.issues })
    }

    const sanitizedOrganizationName = sanitizeText(parsed.data.organization_name, 120)
    const sanitizedDomain = sanitizeDomain(parsed.data.domain)

    if (!sanitizedOrganizationName || !sanitizedDomain) {
      return json(422, { success: false, error: 'Organization name and preferred domain are required' })
    }

    const { data: existingRequests, error: existingRequestsError } = await supabase
      .from('self_service_onboarding_requests')
      .select('id')
      .ilike('organization_name', sanitizedOrganizationName)
      .filter('request_payload->initial_config->>domain', 'eq', sanitizedDomain)
      .limit(1)

    if (existingRequestsError) {
      await logger.error('Failed checking organization and domain uniqueness', { error: existingRequestsError.message })
      return json(500, { success: false, error: 'Unable to validate organization and domain uniqueness' })
    }

    const isUnique = !existingRequests || existingRequests.length === 0
    return json(200, {
      success: true,
      is_unique: isUnique
    })
  }

  if (action === 'admin_list_requests') {
    const parsed = adminListSchema.safeParse(payload)
    if (!parsed.success) {
      return json(422, { success: false, error: 'Validation failed', issues: parsed.error.issues })
    }
    const auth = await requirePlatformOwner(req, logger, supabase)
    if (!auth.authorized) return auth.response

    const filters = parsed.data
    const queryLimit = filters.limit || 100
    let query = supabase
      .from('self_service_onboarding_requests')
      .select('id, status, organization_name, organization_slug, admin_email, admin_first_name, admin_last_name, verified_at, verification_sent_at, verification_expires_at, verification_attempt_count, failure_reason, created_at, updated_at, completed_at, tenant_id, request_payload')
      .order('updated_at', { ascending: false })
      .limit(queryLimit)

    if (filters.status && filters.status !== 'all') {
      query = query.eq('status', filters.status)
    }
    if (filters.from_date) {
      query = query.gte('created_at', new Date(filters.from_date).toISOString())
    }
    if (filters.to_date) {
      query = query.lte('created_at', new Date(filters.to_date).toISOString())
    }
    if (filters.search && filters.search.trim().length > 0) {
      const search = sanitizeText(filters.search, 120)
      query = query.or(
        `organization_name.ilike.%${search}%,admin_email.ilike.%${search}%,admin_first_name.ilike.%${search}%,admin_last_name.ilike.%${search}%`
      )
    }

    const { data, error } = await query
    if (error) {
      await logger.error('Failed to list onboarding requests for admin', { error: error.message })
      return json(500, { success: false, error: 'Unable to load onboarding requests' })
    }

    return json(200, {
      success: true,
      requests: (data || []).map((row: any) => ({
        ...row,
        status: normalizeRequestStatus(row.status)
      }))
    })
  }

  if (action === 'admin_get_request_detail') {
    const parsed = adminDetailSchema.safeParse(payload)
    if (!parsed.success) {
      return json(422, { success: false, error: 'Validation failed', issues: parsed.error.issues })
    }
    const auth = await requirePlatformOwner(req, logger, supabase)
    if (!auth.authorized) return auth.response

    const { data, error } = await supabase
      .from('self_service_onboarding_requests')
      .select('*')
      .eq('id', parsed.data.request_id)
      .single()
    if (error || !data) {
      return json(404, { success: false, error: 'Onboarding request not found' })
    }

    return json(200, {
      success: true,
      request: {
        ...data,
        status: normalizeRequestStatus(data.status)
      }
    })
  }

  if (action === 'admin_trigger_verification_email') {
    const parsed = adminTriggerVerificationSchema.safeParse(payload)
    if (!parsed.success) {
      return json(422, { success: false, error: 'Validation failed', issues: parsed.error.issues })
    }
    const auth = await requirePlatformOwner(req, logger, supabase)
    if (!auth.authorized) return auth.response

    const { data: requestRow, error: requestError } = await supabase
      .from('self_service_onboarding_requests')
      .select('*')
      .eq('id', parsed.data.request_id)
      .single()
    if (requestError || !requestRow) {
      return json(404, { success: false, error: 'Onboarding request not found' })
    }

    const verificationCode = generateVerificationCode()
    const verificationCodeHash = await sha256Hex(verificationCode)
    const nowIso = new Date().toISOString()
    const nextStatus = requestRow.status === 'rejected' ? 'pending_verification' : requestRow.status
    const { error: updateError } = await supabase
      .from('self_service_onboarding_requests')
      .update({
        verification_code_hash: verificationCodeHash,
        verification_expires_at: addMinutes(new Date(), 15),
        verification_sent_at: nowIso,
        verification_attempt_count: 0,
        status: nextStatus,
        failure_reason: null
      })
      .eq('id', requestRow.id)
    if (updateError) {
      return json(500, { success: false, error: 'Unable to trigger verification email' })
    }

    try {
      await sendVerificationEmail(supabase, requestRow.admin_email, verificationCode, requestRow.organization_name)
    } catch (error: any) {
      await logger.error('Manual trigger verification email failed', { requestId: requestRow.id, error: String(error?.message || error) })
      return json(502, { success: false, error: 'Verification email delivery failed' })
    }

    await logOnboardingAudit(supabase, auth.userId as string, requestRow.id, 'manual_verification_email_triggered', {
      comment: parsed.data.comment || null
    })

    return json(200, { success: true, status: normalizeRequestStatus(nextStatus) })
  }

  if (action === 'admin_confirm_email') {
    const parsed = adminConfirmEmailSchema.safeParse(payload)
    if (!parsed.success) {
      return json(422, { success: false, error: 'Validation failed', issues: parsed.error.issues })
    }
    const auth = await requirePlatformOwner(req, logger, supabase)
    if (!auth.authorized) return auth.response

    const { data: requestRow, error: requestError } = await supabase
      .from('self_service_onboarding_requests')
      .select('id, status, admin_email, organization_name')
      .eq('id', parsed.data.request_id)
      .single()
    if (requestError || !requestRow) {
      return json(404, { success: false, error: 'Onboarding request not found' })
    }
    if (requestRow.status === 'rejected') {
      return json(409, { success: false, error: 'Rejected request cannot be confirmed' })
    }

    const { error: updateError } = await supabase
      .from('self_service_onboarding_requests')
      .update({
        status: 'email_verified',
        verified_at: new Date().toISOString(),
        verification_attempt_count: 0,
        failure_reason: null
      })
      .eq('id', requestRow.id)
    if (updateError) {
      return json(500, { success: false, error: 'Unable to confirm email ownership' })
    }

    await logOnboardingAudit(supabase, auth.userId as string, requestRow.id, 'manual_email_confirmed', {
      comment: parsed.data.comment || null
    })

    return json(200, { success: true, status: 'email_verified' })
  }

  if (action === 'admin_reject_request') {
    const parsed = adminRejectSchema.safeParse(payload)
    if (!parsed.success) {
      return json(422, { success: false, error: 'Validation failed', issues: parsed.error.issues })
    }
    const auth = await requirePlatformOwner(req, logger, supabase)
    if (!auth.authorized) return auth.response

    const comment = sanitizeText(parsed.data.comment, 1500)
    if (!comment) return json(422, { success: false, error: 'Rejection comment is required' })

    const { data: requestRow, error: requestError } = await supabase
      .from('self_service_onboarding_requests')
      .select('id, status, admin_email, organization_name')
      .eq('id', parsed.data.request_id)
      .single()
    if (requestError || !requestRow) {
      return json(404, { success: false, error: 'Onboarding request not found' })
    }
    if (requestRow.status === 'completed') {
      return json(409, { success: false, error: 'Completed request cannot be rejected' })
    }

    const { error: updateError } = await supabase
      .from('self_service_onboarding_requests')
      .update({
        status: 'rejected',
        failure_reason: comment
      })
      .eq('id', requestRow.id)
    if (updateError) {
      return json(500, { success: false, error: 'Unable to reject onboarding request' })
    }

    await logOnboardingAudit(supabase, auth.userId as string, requestRow.id, 'onboarding_rejected', { comment })
    try {
      await sendEmailNotification(
        supabase,
        [requestRow.admin_email],
        'Your Logic Nexus-AI onboarding request was rejected',
        `<p>Your onboarding request for <strong>${sanitizeText(requestRow.organization_name || '', 120)}</strong> was rejected.</p><p>Reason: ${comment}</p>`
      )
    } catch (notifyError: any) {
      await logger.warn('Failed sending rejection notification', { requestId: requestRow.id, error: String(notifyError?.message || notifyError) })
    }

    return json(200, { success: true, status: 'rejected' })
  }

  if (action === 'admin_approve_request') {
    const parsed = adminApproveSchema.safeParse(payload)
    if (!parsed.success) {
      return json(422, { success: false, error: 'Validation failed', issues: parsed.error.issues })
    }
    const auth = await requirePlatformOwner(req, logger, supabase)
    if (!auth.authorized) return auth.response

    const { data: requestRow, error: requestError } = await supabase
      .from('self_service_onboarding_requests')
      .select('*')
      .eq('id', parsed.data.request_id)
      .single()
    if (requestError || !requestRow) {
      return json(404, { success: false, error: 'Onboarding request not found' })
    }

    if (requestRow.status === 'completed' && requestRow.tenant_id) {
      return json(200, { success: true, status: 'completed', tenant_id: requestRow.tenant_id })
    }
    if (requestRow.status === 'rejected') {
      return json(409, { success: false, error: 'Rejected request cannot be approved' })
    }
    if (!requestRow.verified_at && requestRow.status !== 'email_verified' && requestRow.status !== 'approved') {
      return json(409, { success: false, error: 'Email ownership must be verified before approval' })
    }

    const lockStatuses = ['email_verified', 'approved', 'pending_verification']
    const { data: lockRows, error: lockError } = await supabase
      .from('self_service_onboarding_requests')
      .update({
        status: 'in_progress',
        failure_reason: null
      })
      .eq('id', requestRow.id)
      .in('status', lockStatuses)
      .select('*')
    if (lockError) {
      return json(500, { success: false, error: 'Unable to start provisioning' })
    }
    if (!lockRows || lockRows.length === 0) {
      return json(409, { success: false, error: 'Request is already being processed' })
    }

    await logOnboardingAudit(supabase, auth.userId as string, requestRow.id, 'onboarding_approved', {
      comment: parsed.data.comment || null
    })

    const freshRow = lockRows[0]
    try {
      const provisioned = await performProvisioningForRequest(supabase, logger, freshRow)
      await supabase
        .from('self_service_onboarding_requests')
        .update({
          status: 'completed',
          tenant_id: provisioned.tenant_id,
          admin_user_id: provisioned.admin_user_id || freshRow.admin_user_id || null,
          onboarding_session_id: provisioned.onboarding_session_id || freshRow.onboarding_session_id || null,
          completed_at: new Date().toISOString(),
          failure_reason: null
        })
        .eq('id', requestRow.id)

      const platformOwners = await getPlatformOwnerRecipients(supabase)
      await Promise.allSettled([
        sendEmailNotification(
          supabase,
          [freshRow.admin_email],
          'Your Logic Nexus-AI onboarding request is approved',
          `<p>Your request for <strong>${sanitizeText(freshRow.organization_name || '', 120)}</strong> has been approved and provisioned.</p>`
        ),
        sendEmailNotification(
          supabase,
          platformOwners,
          'Self-service onboarding request completed',
          `<p>Request <strong>${freshRow.id}</strong> for <strong>${sanitizeText(freshRow.organization_name || '', 120)}</strong> is completed.</p>`
        )
      ])

      return json(200, {
        success: true,
        status: 'completed',
        tenant_id: provisioned.tenant_id,
        onboarding_session_id: provisioned.onboarding_session_id
      })
    } catch (error: any) {
      await supabase
        .from('self_service_onboarding_requests')
        .update({
          status: 'failed',
          failure_reason: sanitizeText(String(error?.message || 'Provisioning failed'), 500)
        })
        .eq('id', requestRow.id)
      await logger.error('Manual approval provisioning failed', {
        requestId: requestRow.id,
        error: String(error?.message || error)
      })
      return json(500, { success: false, error: String(error?.message || 'Tenant provisioning failed') })
    }
  }

  if (action === 'admin_bulk_action') {
    const parsed = adminBulkSchema.safeParse(payload)
    if (!parsed.success) {
      return json(422, { success: false, error: 'Validation failed', issues: parsed.error.issues })
    }
    const auth = await requirePlatformOwner(req, logger, supabase)
    if (!auth.authorized) return auth.response
    if (parsed.data.operation === 'reject' && !parsed.data.comment?.trim()) {
      return json(422, { success: false, error: 'Rejection comment is required for bulk reject' })
    }

    const successes: Array<{ request_id: string; status: string }> = []
    const failures: Array<{ request_id: string; error: string }> = []
    for (const requestId of parsed.data.request_ids) {
      try {
        if (parsed.data.operation === 'trigger_verification_email') {
          const code = generateVerificationCode()
          const hash = await sha256Hex(code)
          const { data: row, error: rowError } = await supabase
            .from('self_service_onboarding_requests')
            .select('id, status, admin_email, organization_name')
            .eq('id', requestId)
            .single()
          if (rowError || !row) throw new Error('Request not found')
          const nextStatus = row.status === 'rejected' ? 'pending_verification' : row.status
          const { error: updateError } = await supabase
            .from('self_service_onboarding_requests')
            .update({
              verification_code_hash: hash,
              verification_expires_at: addMinutes(new Date(), 15),
              verification_sent_at: new Date().toISOString(),
              verification_attempt_count: 0,
              status: nextStatus
            })
            .eq('id', requestId)
          if (updateError) throw new Error(updateError.message || 'Failed to update request')
          await sendVerificationEmail(supabase, row.admin_email, code, row.organization_name)
          await logOnboardingAudit(supabase, auth.userId as string, requestId, 'bulk_manual_verification_email_triggered', {
            comment: parsed.data.comment || null
          })
          successes.push({ request_id: requestId, status: normalizeRequestStatus(nextStatus) })
          continue
        }

        if (parsed.data.operation === 'confirm_email') {
          const { error: updateError } = await supabase
            .from('self_service_onboarding_requests')
            .update({
              status: 'email_verified',
              verified_at: new Date().toISOString(),
              verification_attempt_count: 0,
              failure_reason: null
            })
            .eq('id', requestId)
          if (updateError) throw new Error(updateError.message || 'Failed to confirm email')
          await logOnboardingAudit(supabase, auth.userId as string, requestId, 'bulk_manual_email_confirmed', {
            comment: parsed.data.comment || null
          })
          successes.push({ request_id: requestId, status: 'email_verified' })
          continue
        }

        if (parsed.data.operation === 'reject') {
          const comment = sanitizeText(parsed.data.comment || '', 1500)
          const { error: updateError } = await supabase
            .from('self_service_onboarding_requests')
            .update({ status: 'rejected', failure_reason: comment })
            .eq('id', requestId)
          if (updateError) throw new Error(updateError.message || 'Failed to reject request')
          await logOnboardingAudit(supabase, auth.userId as string, requestId, 'bulk_onboarding_rejected', { comment })
          successes.push({ request_id: requestId, status: 'rejected' })
          continue
        }

        const { data: row, error: rowError } = await supabase
          .from('self_service_onboarding_requests')
          .select('*')
          .eq('id', requestId)
          .single()
        if (rowError || !row) throw new Error('Request not found')
        if (!row.verified_at && row.status !== 'email_verified' && row.status !== 'approved') {
          throw new Error('Email must be verified before approval')
        }
        const { data: lockRows, error: lockError } = await supabase
          .from('self_service_onboarding_requests')
          .update({ status: 'in_progress', failure_reason: null })
          .eq('id', requestId)
          .in('status', ['email_verified', 'approved', 'pending_verification'])
          .select('*')
        if (lockError) throw new Error(lockError.message || 'Unable to start provisioning')
        if (!lockRows || lockRows.length === 0) throw new Error('Request is already being processed')
        const provisioned = await performProvisioningForRequest(supabase, logger, lockRows[0])
        await supabase
          .from('self_service_onboarding_requests')
          .update({
            status: 'completed',
            tenant_id: provisioned.tenant_id,
            admin_user_id: provisioned.admin_user_id || lockRows[0].admin_user_id || null,
            onboarding_session_id: provisioned.onboarding_session_id || lockRows[0].onboarding_session_id || null,
            completed_at: new Date().toISOString(),
            failure_reason: null
          })
          .eq('id', requestId)
        await logOnboardingAudit(supabase, auth.userId as string, requestId, 'bulk_onboarding_approved', {
          comment: parsed.data.comment || null
        })
        successes.push({ request_id: requestId, status: 'completed' })
      } catch (error: any) {
        failures.push({
          request_id: requestId,
          error: String(error?.message || error || 'Failed')
        })
      }
    }

    return json(200, {
      success: true,
      operation: parsed.data.operation,
      successes,
      failures
    })
  }

  if (action === 'start_registration') {
    const parsed = startRegistrationSchema.safeParse(payload)
    if (!parsed.success) {
      return json(422, { success: false, error: 'Validation failed', issues: parsed.error.issues })
    }

    const input = parsed.data
    const sanitizedEmail = sanitizeEmail(input.admin.email)
    const sanitizedOrganization = sanitizeText(input.organization_name, 120)

    const ipRate = await applyRateLimit(supabase, 'ip', ipAddress, 10, 15, 30)
    if (!ipRate.allowed) {
      return json(429, { success: false, error: 'Too many requests', retry_after_seconds: ipRate.retry_after_seconds })
    }

    const emailRate = await applyRateLimit(supabase, 'email', sanitizedEmail, 5, 30, 60)
    if (!emailRate.allowed) {
      return json(429, { success: false, error: 'Too many requests', retry_after_seconds: emailRate.retry_after_seconds })
    }

    const captchaResult = await verifyCaptcha(input.captcha_token, ipAddress, input.captcha_provider)
    if (!captchaResult.success) {
      await logger.warn('Captcha verification failed', {
        ipAddress,
        email: sanitizedEmail,
        provider: captchaResult.provider,
        reason: captchaResult.reason,
        errorCodes: captchaResult.error_codes
      })

      if (captchaResult.reason === 'config_missing') {
        return json(503, {
          success: false,
          error: 'Captcha service is not configured',
          error_code: 'captcha_config_missing'
        })
      }

      if (captchaResult.reason === 'provider_request_failed') {
        return json(502, {
          success: false,
          error: 'Captcha verification service unavailable',
          error_code: 'captcha_provider_unavailable'
        })
      }

      return json(400, {
        success: false,
        error: 'Captcha verification failed',
        error_code: 'captcha_validation_failed'
      })
    }

    const baseOrganizationSlug = slugifyOrganizationName(sanitizedOrganization)

    const existingTenantRequest = await supabase
      .from('self_service_onboarding_requests')
      .select('id, status, organization_name, organization_slug, created_at, updated_at')
      .ilike('organization_name', sanitizedOrganization)
      .in('status', [...tenantDuplicateRequestStatuses])
      .order('updated_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(1)

    if (existingTenantRequest.error) {
      await logger.error('Failed checking existing tenant onboarding request', { error: existingTenantRequest.error.message })
      return json(500, { success: false, error: 'Unable to process request' })
    }

    if (existingTenantRequest.data && existingTenantRequest.data.length > 0) {
      const activeTenantRequest = existingTenantRequest.data[0]
      return json(409, {
        success: false,
        error: tenantRequestAlreadyExistsMessage,
        existing_request_id: activeTenantRequest.id,
        existing_request_status: activeTenantRequest.status
      })
    }

    const [{ data: existingTenantByName, error: existingTenantByNameError }, { data: existingTenantBySlug, error: existingTenantBySlugError }] =
      await Promise.all([
        supabase
          .from('tenants')
          .select('id, name, slug')
          .ilike('name', sanitizedOrganization)
          .maybeSingle(),
        supabase
          .from('tenants')
          .select('id, name, slug')
          .eq('slug', baseOrganizationSlug)
          .maybeSingle()
      ])

    if (existingTenantByNameError || existingTenantBySlugError) {
      await logger.error('Failed checking existing tenant by onboarding organization name', {
        error: existingTenantByNameError?.message || existingTenantBySlugError?.message
      })
      return json(500, { success: false, error: 'Unable to process request' })
    }

    const existingTenant = existingTenantByName || existingTenantBySlug
    if (existingTenant?.id) {
      return json(409, {
        success: false,
        error: tenantAlreadyPresentMessage,
        existing_tenant_id: existingTenant.id,
        existing_tenant_name: sanitizeText(existingTenant.name || sanitizedOrganization, 120),
        existing_tenant_slug: sanitizeText(existingTenant.slug || baseOrganizationSlug, 120)
      })
    }

    const existingPending = await supabase
      .from('self_service_onboarding_requests')
      .select('id, status, verification_expires_at, created_at, updated_at')
      .eq('admin_email', sanitizedEmail)
      .in('status', [...pendingOnboardingStatuses])
      .order('updated_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(1)

    if (existingPending.error) {
      await logger.error('Failed checking existing onboarding request', { error: existingPending.error.message })
      return json(500, { success: false, error: 'Unable to process request' })
    }

    if (existingPending.data && existingPending.data.length > 0) {
      const activeRequest = existingPending.data[0]
      return json(409, {
        success: false,
        error: duplicateOnboardingMessage(activeRequest.status),
        existing_request_id: activeRequest.id,
        existing_request_status: activeRequest.status
      })
    }

    const { data: existingProfile, error: existingProfileError } = await supabase
      .from('profiles')
      .select('id, email')
      .eq('email', sanitizedEmail)
      .maybeSingle()

    if (existingProfileError) {
      await logger.error('Failed checking existing profile by onboarding admin email', { error: existingProfileError.message })
      return json(500, { success: false, error: 'Unable to process request' })
    }

    if (existingProfile?.id) {
      return json(409, {
        success: false,
        error: existingUserMessage,
        existing_user_id: existingProfile.id,
        existing_user_email: sanitizeEmail(existingProfile.email || sanitizedEmail)
      })
    }

    try {
      const existingAuthUser = await findAuthUserByEmail(supabase, sanitizedEmail)
      if (existingAuthUser?.id) {
        return json(409, {
          success: false,
          error: existingUserMessage,
          existing_user_id: existingAuthUser.id,
          existing_user_email: sanitizeEmail(existingAuthUser.email || sanitizedEmail)
        })
      }
    } catch (error: any) {
      await logger.error('Failed checking existing auth user by onboarding admin email', { error: String(error?.message || error) })
      return json(500, { success: false, error: 'Unable to process request' })
    }

    const verificationCode = generateVerificationCode()
    const verificationCodeHash = await sha256Hex(verificationCode)
    const organizationSlug = await buildUniqueSlug(supabase, sanitizedOrganization)
    const verificationExpiresAt = addMinutes(new Date(), 15)
    const preferredDomainValue = input.initial_config?.domain ? sanitizeDomain(input.initial_config.domain) : null
    const sanitizedCountryInput = sanitizeText(input.country, 80)
    const normalizedCountryCode = sanitizedCountryInput.toUpperCase()
    const normalizedCurrencyCode = sanitizeText(input.initial_config?.currency || 'USD', 3).toUpperCase()

    const [{ data: countryByCode, error: countryByCodeError }, { data: matchedCurrency, error: currencyLookupError }] = await Promise.all([
      supabase
        .from('countries')
        .select('id, name, code_iso2')
        .eq('is_active', true)
        .eq('code_iso2', normalizedCountryCode)
        .limit(1)
        .maybeSingle(),
      supabase
        .from('currencies')
        .select('id, code, name')
        .eq('is_active', true)
        .eq('code', normalizedCurrencyCode)
        .limit(1)
        .maybeSingle()
    ])

    if (countryByCodeError) {
      await logger.error('Failed resolving country reference for onboarding request', { error: countryByCodeError.message })
      return json(500, { success: false, error: 'Unable to validate country selection' })
    }

    if (currencyLookupError) {
      await logger.error('Failed resolving currency reference for onboarding request', { error: currencyLookupError.message })
      return json(500, { success: false, error: 'Unable to validate currency selection' })
    }

    let matchedCountry = countryByCode
    if (!matchedCountry?.id) {
      const { data: countryByName, error: countryByNameError } = await supabase
        .from('countries')
        .select('id, name, code_iso2')
        .eq('is_active', true)
        .eq('name', sanitizedCountryInput)
        .limit(1)
        .maybeSingle()

      if (countryByNameError) {
        await logger.error('Failed resolving country reference by name for onboarding request', { error: countryByNameError.message })
        return json(500, { success: false, error: 'Unable to validate country selection' })
      }

      matchedCountry = countryByName
    }

    if (!matchedCountry?.id) {
      return json(422, { success: false, error: 'Selected country is not available' })
    }

    if (!matchedCurrency?.id) {
      return json(422, { success: false, error: 'Selected currency is not available' })
    }

    if (preferredDomainValue) {
      const { data: availableDomains, error: availableDomainsError } = await supabase
        .from('platform_domains')
        .select('key, code, name, is_active')
        .eq('is_active', true)

      if (availableDomainsError) {
        await logger.error('Failed validating selected preferred domain', { error: availableDomainsError.message })
        return json(500, { success: false, error: 'Unable to validate selected domain' })
      }

      const validDomainSet = new Set(
        (availableDomains || [])
          .map((domain) => sanitizeDomain(domain.key || domain.code || domain.name || ''))
          .filter((value) => value.length > 0)
      )

      if (!validDomainSet.has(preferredDomainValue)) {
        return json(422, { success: false, error: 'Selected preferred domain is not available' })
      }
    }

    const requestPayload = {
      legal_name: input.legal_name ? sanitizeText(input.legal_name, 160) : null,
      tax_id: input.tax_id ? sanitizeText(input.tax_id, 80) : null,
      tax_jurisdiction: input.tax_jurisdiction ? sanitizeText(input.tax_jurisdiction, 80) : null,
      registered_address: input.registered_address ? sanitizeText(input.registered_address, 400) : null,
      country_id: matchedCountry.id,
      currency_id: matchedCurrency.id,
      initial_config: {
        currency: matchedCurrency.code || normalizedCurrencyCode,
        timezone: sanitizeText(input.initial_config?.timezone || 'UTC', 80),
        preferred_language: sanitizeText(input.initial_config?.preferred_language || 'en', 10),
        domain: preferredDomainValue,
        industry: input.initial_config?.industry ? sanitizeText(input.initial_config.industry, 80) : null,
        website: input.initial_config?.website ? sanitizeText(input.initial_config.website, 180) : null
      }
    }

    const insertPayload = {
      status: 'pending_verification',
      organization_name: sanitizedOrganization,
      organization_slug: organizationSlug,
      admin_email: sanitizedEmail,
      admin_first_name: sanitizeText(input.admin.first_name, 80),
      admin_last_name: sanitizeText(input.admin.last_name, 80),
      country: matchedCountry.code_iso2 || normalizedCountryCode || matchedCountry.name,
      country_id: matchedCountry.id,
      plan_tier: input.plan_tier,
      billing_period: input.billing_period,
      currency: matchedCurrency.code || requestPayload.initial_config.currency,
      currency_id: matchedCurrency.id,
      requested_user_count: input.requested_user_count,
      requested_franchise_count: input.requested_franchise_count,
      data_residency: sanitizeText(input.data_residency, 80),
      verification_code_hash: verificationCodeHash,
      verification_expires_at: verificationExpiresAt,
      verification_sent_at: new Date().toISOString(),
      captcha_provider: captchaResult.provider,
      captcha_score: captchaResult.score || null,
      ip_address: ipAddress,
      user_agent: userAgent,
      request_payload: requestPayload
    }

    const { data: createdRequest, error: createError } = await supabase
      .from('self_service_onboarding_requests')
      .insert(insertPayload)
      .select('id')
      .single()

    if (createError || !createdRequest) {
      if (createError?.code === '23505') {
        const { data: duplicateRequest } = await supabase
          .from('self_service_onboarding_requests')
          .select('id, status')
          .eq('admin_email', sanitizedEmail)
          .order('updated_at', { ascending: false, nullsFirst: false })
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        const duplicateStatus = duplicateRequest?.status || 'pending_verification'
        return json(409, {
          success: false,
          error: duplicateOnboardingMessage(duplicateStatus),
          existing_request_id: duplicateRequest?.id || null,
          existing_request_status: duplicateStatus
        })
      }
      await logger.error('Failed creating self-service onboarding request', { error: createError?.message })
      return json(500, { success: false, error: 'Unable to create onboarding request' })
    }

    let emailDeliveryStatus: 'sent' | 'fallback_manual'
    let emailDeliveryMessage: string | null = null

    try {
      await sendVerificationEmail(supabase, sanitizedEmail, verificationCode, sanitizedOrganization)
      emailDeliveryStatus = 'sent'
    } catch (error: any) {
      const errorMessage = String(error?.message || 'Email dispatch failed')
      await supabase
        .from('self_service_onboarding_requests')
        .update({ failure_reason: `verification_email_failed:${errorMessage}` })
        .eq('id', createdRequest.id)
      await logger.error('Verification email dispatch failed, enabling manual fallback code', {
        requestId: createdRequest.id,
        error: errorMessage
      })
      emailDeliveryStatus = 'fallback_manual'
      emailDeliveryMessage = 'Email delivery failed. Use the fallback verification code.'
    }

    return json(200, {
      success: true,
      request_id: createdRequest.id,
      status: 'pending_verification',
      expires_in_minutes: 15,
      email_delivery_status: emailDeliveryStatus,
      email_delivery_message: emailDeliveryMessage,
      verification_code: emailDeliveryStatus === 'fallback_manual' ? verificationCode : undefined
    })
  }

  if (action === 'verify_email') {
    const parsed = verifyEmailSchema.safeParse(payload)
    if (!parsed.success) {
      return json(422, { success: false, error: 'Validation failed', issues: parsed.error.issues })
    }

    const input = parsed.data
    const requestRate = await applyRateLimit(supabase, 'ip', `verify:${ipAddress}`, 20, 15, 30)
    if (!requestRate.allowed) {
      return json(429, { success: false, error: 'Too many attempts', retry_after_seconds: requestRate.retry_after_seconds })
    }

    const { data: requestRow, error: requestError } = await supabase
      .from('self_service_onboarding_requests')
      .select('*')
      .eq('id', input.request_id)
      .single()

    if (requestError || !requestRow) {
      return json(404, { success: false, error: 'Onboarding request not found' })
    }

    if (requestRow.status === 'completed' && requestRow.tenant_id) {
      return json(200, {
        success: true,
        status: 'completed',
        tenant_id: requestRow.tenant_id
      })
    }

    if (requestRow.status === 'failed' || requestRow.status === 'expired') {
      return json(400, { success: false, error: 'Onboarding request is no longer valid' })
    }

    if (new Date(requestRow.verification_expires_at) < new Date()) {
      await supabase
        .from('self_service_onboarding_requests')
        .update({ status: 'expired', failure_reason: 'Verification code expired' })
        .eq('id', requestRow.id)
      return json(400, { success: false, error: 'Verification code expired' })
    }

    const suppliedHash = await sha256Hex(input.verification_code)
    if (suppliedHash !== requestRow.verification_code_hash) {
      const nextAttemptCount = (requestRow.verification_attempt_count || 0) + 1
      const nextStatus = nextAttemptCount >= 8 ? 'failed' : requestRow.status
      const failureReason = nextAttemptCount >= 8 ? 'Too many invalid verification attempts' : null
      await supabase
        .from('self_service_onboarding_requests')
        .update({
          verification_attempt_count: nextAttemptCount,
          status: nextStatus,
          failure_reason: failureReason
        })
        .eq('id', requestRow.id)
      return json(400, { success: false, error: 'Invalid verification code' })
    }

    const verifiedAt = new Date().toISOString()
    const { error: updateError } = await supabase
      .from('self_service_onboarding_requests')
      .update({
        status: 'email_verified',
        verified_at: verifiedAt,
        verification_attempt_count: 0,
        failure_reason: null
      })
      .eq('id', requestRow.id)
    if (updateError) {
      return json(500, { success: false, error: 'Unable to update verification status' })
    }

    const platformOwners = await getPlatformOwnerRecipients(supabase)
    await Promise.allSettled([
      sendEmailNotification(
        supabase,
        [requestRow.admin_email],
        'Email verified. Request is pending Platform Owner approval',
        `<p>Your email for <strong>${sanitizeText(requestRow.organization_name || '', 120)}</strong> has been verified.</p><p>Your request now requires Platform Owner approval before provisioning starts.</p>`
      ),
      sendEmailNotification(
        supabase,
        platformOwners,
        'Self-service onboarding request ready for approval',
        `<p>Request <strong>${requestRow.id}</strong> for <strong>${sanitizeText(requestRow.organization_name || '', 120)}</strong> has completed email verification and is awaiting approval.</p>`
      )
    ])

    return json(200, {
      success: true,
      status: 'email_verified',
      approval_required: true
    })
  }

  return json(400, { success: false, error: 'Unsupported action' })
}, 'self-service-onboarding')
