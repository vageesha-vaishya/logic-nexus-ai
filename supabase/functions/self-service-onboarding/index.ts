import { serveWithLogger } from '../_shared/logger.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'

type CaptchaVerificationResult = {
  success: boolean
  provider: 'turnstile' | 'recaptcha' | 'dev_bypass' | 'none'
  score?: number
}

const startRegistrationSchema = z.object({
  action: z.literal('start_registration'),
  organization_name: z.string().min(2).max(120),
  country: z.string().min(2).max(80),
  plan_tier: z.enum(['free', 'professional', 'enterprise']),
  billing_period: z.enum(['monthly', 'annual']).default('monthly'),
  requested_user_count: z.number().int().min(1).max(10000).default(2),
  requested_franchise_count: z.number().int().min(0).max(10000).default(1),
  data_residency: z.string().min(2).max(80),
  captcha_token: z.string().min(5),
  legal_name: z.string().max(160).optional(),
  tax_id: z.string().max(80).optional(),
  tax_jurisdiction: z.string().max(80).optional(),
  registered_address: z.string().max(400).optional(),
  admin: z.object({
    email: z.string().email(),
    first_name: z.string().min(1).max(80),
    last_name: z.string().min(1).max(80),
    password: z.string().min(12).max(128)
  }),
  initial_config: z.object({
    currency: z.string().min(3).max(3).optional(),
    timezone: z.string().min(2).max(80).optional(),
    preferred_language: z.string().min(2).max(10).optional(),
    domain: z.string().max(120).optional(),
    industry: z.string().max(80).optional(),
    website: z.string().max(180).optional()
  }).optional()
})

const verifyEmailSchema = z.object({
  action: z.literal('verify_email'),
  request_id: z.string().uuid(),
  verification_code: z.string().regex(/^\d{6}$/),
  admin_password: z.string().min(12).max(128)
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

const verifyCaptcha = async (token: string, ipAddress: string): Promise<CaptchaVerificationResult> => {
  const turnstileSecret = Deno.env.get('TURNSTILE_SECRET_KEY')
  const recaptchaSecret = Deno.env.get('RECAPTCHA_SECRET_KEY')

  if (turnstileSecret) {
    const body = new URLSearchParams({
      secret: turnstileSecret,
      response: token,
      remoteip: ipAddress
    })
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body
    })
    const data = await response.json()
    return {
      success: !!data?.success,
      provider: 'turnstile',
      score: typeof data?.score === 'number' ? data.score : undefined
    }
  }

  if (recaptchaSecret) {
    const body = new URLSearchParams({
      secret: recaptchaSecret,
      response: token,
      remoteip: ipAddress
    })
    const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      body
    })
    const data = await response.json()
    return {
      success: !!data?.success,
      provider: 'recaptcha',
      score: typeof data?.score === 'number' ? data.score : undefined
    }
  }

  const allowBypass = Deno.env.get('ALLOW_DEV_CAPTCHA_BYPASS') === 'true'
  if (allowBypass && token === 'dev-captcha-pass') {
    return { success: true, provider: 'dev_bypass', score: 1 }
  }

  return { success: false, provider: 'none' }
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

  const { data, error } = await supabase.functions.invoke('send-email', {
    body: {
      to: [to],
      subject: 'Verify your Logic Nexus-AI onboarding request',
      body: html,
      provider: 'resend'
    }
  })

  if (error) throw error
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

    const captchaResult = await verifyCaptcha(input.captcha_token, ipAddress)
    if (!captchaResult.success) {
      await logger.warn('Captcha verification failed', { ipAddress, email: sanitizedEmail, provider: captchaResult.provider })
      return json(400, { success: false, error: 'Captcha verification failed' })
    }

    const existingPending = await supabase
      .from('self_service_onboarding_requests')
      .select('id, status, verification_expires_at')
      .eq('admin_email', sanitizedEmail)
      .in('status', ['pending_verification', 'email_verified', 'provisioning'])
      .order('created_at', { ascending: false })
      .limit(1)

    if (existingPending.error) {
      await logger.error('Failed checking existing onboarding request', { error: existingPending.error.message })
      return json(500, { success: false, error: 'Unable to process request' })
    }

    if (existingPending.data && existingPending.data.length > 0) {
      const activeRequest = existingPending.data[0]
      const notExpired = new Date(activeRequest.verification_expires_at) > new Date()
      if (activeRequest.status === 'pending_verification' && notExpired) {
        return json(200, {
          success: true,
          request_id: activeRequest.id,
          status: 'pending_verification',
          message: 'Verification code already sent'
        })
      }
    }

    const verificationCode = generateVerificationCode()
    const verificationCodeHash = await sha256Hex(verificationCode)
    const organizationSlug = await buildUniqueSlug(supabase, sanitizedOrganization)
    const verificationExpiresAt = addMinutes(new Date(), 15)
    const preferredDomainValue = input.initial_config?.domain ? sanitizeDomain(input.initial_config.domain) : null

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
      initial_config: {
        currency: sanitizeText(input.initial_config?.currency || 'USD', 3).toUpperCase(),
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
      country: sanitizeText(input.country, 80),
      plan_tier: input.plan_tier,
      billing_period: input.billing_period,
      currency: requestPayload.initial_config.currency,
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
      await logger.error('Failed creating self-service onboarding request', { error: createError?.message })
      return json(500, { success: false, error: 'Unable to create onboarding request' })
    }

    try {
      await sendVerificationEmail(supabase, sanitizedEmail, verificationCode, sanitizedOrganization)
    } catch (error: any) {
      await supabase
        .from('self_service_onboarding_requests')
        .update({ status: 'failed', failure_reason: error?.message || 'Email dispatch failed' })
        .eq('id', createdRequest.id)
      await logger.error('Failed sending verification email', { requestId: createdRequest.id, error: error?.message })
      return json(500, { success: false, error: 'Unable to send verification code' })
    }

    return json(200, {
      success: true,
      request_id: createdRequest.id,
      status: 'pending_verification',
      expires_in_minutes: 15
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

    const requestPayload = requestRow.request_payload || {}
    const initialConfig = requestPayload.initial_config || {}
    const isPaidPlan = requestRow.plan_tier !== 'free'

    await supabase
      .from('self_service_onboarding_requests')
      .update({
        status: 'provisioning',
        verified_at: new Date().toISOString(),
        verification_attempt_count: 0
      })
      .eq('id', requestRow.id)

    const orgSlug = await buildUniqueSlug(supabase, requestRow.organization_slug || requestRow.organization_name)

    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .insert({
        name: requestRow.organization_name,
        slug: orgSlug,
        subscription_tier: requestRow.plan_tier,
        max_users: requestRow.requested_user_count,
        max_franchises: requestRow.requested_franchise_count,
        country: requestRow.country,
        status: isPaidPlan ? 'pending' : 'active',
        settings: {
          onboarding_source: 'self_service',
          onboarding_status: isPaidPlan ? 'payment_pending' : 'active',
          data_residency: {
            region: requestRow.data_residency
          },
          locale: {
            currency: requestRow.currency || 'USD',
            timezone: initialConfig.timezone || 'UTC',
            preferred_language: initialConfig.preferred_language || 'en'
          }
        }
      })
      .select('id, name')
      .single()

    if (tenantError || !tenant) {
      await supabase
        .from('self_service_onboarding_requests')
        .update({ status: 'failed', failure_reason: tenantError?.message || 'Tenant creation failed' })
        .eq('id', requestRow.id)
      return json(500, { success: false, error: 'Tenant provisioning failed' })
    }

    const { data: createdUser, error: userError } = await supabase.auth.admin.createUser({
      email: requestRow.admin_email,
      password: input.admin_password,
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
      await supabase
        .from('tenants')
        .delete()
        .eq('id', tenant.id)
      await supabase
        .from('self_service_onboarding_requests')
        .update({ status: 'failed', failure_reason: userError?.message || 'Admin user creation failed' })
        .eq('id', requestRow.id)
      return json(500, { success: false, error: 'Admin user provisioning failed' })
    }

    const adminUserId = createdUser.user.id

    await supabase
      .from('profiles')
      .upsert({
        id: adminUserId,
        email: requestRow.admin_email,
        first_name: requestRow.admin_first_name,
        last_name: requestRow.admin_last_name,
        tenant_id: tenant.id
      })

    await supabase
      .from('user_roles')
      .upsert({
        user_id: adminUserId,
        role: 'tenant_admin',
        tenant_id: tenant.id
      })

    const legalName = requestPayload.legal_name || requestRow.organization_name
    await supabase
      .from('tenant_profile')
      .upsert({
        tenant_id: tenant.id,
        legal_name: legalName,
        registered_address: requestPayload.registered_address || null,
        tax_id: requestPayload.tax_id || null,
        tax_jurisdiction: requestPayload.tax_jurisdiction || null,
        country_of_operation: requestRow.country,
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

    if (sessionError || !onboardingSession) {
      await supabase
        .from('self_service_onboarding_requests')
        .update({ status: 'failed', failure_reason: sessionError?.message || 'Onboarding session creation failed', tenant_id: tenant.id, admin_user_id: adminUserId })
        .eq('id', requestRow.id)
      return json(500, { success: false, error: 'Onboarding session provisioning failed' })
    }

    const plan = await getMatchingPlan(supabase, requestRow.plan_tier)
    if (plan) {
      const now = new Date()
      const trialEnd = isPaidPlan ? addMinutes(now, 7 * 24 * 60) : null
      const nextPeriodEnd = requestRow.billing_period === 'annual'
        ? new Date(now.getFullYear() + 1, now.getMonth(), now.getDate()).toISOString()
        : new Date(now.getFullYear(), now.getMonth() + 1, now.getDate()).toISOString()

      await supabase
        .from('tenant_subscriptions')
        .insert({
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

    await supabase
      .from('self_service_onboarding_requests')
      .update({
        status: isPaidPlan ? 'email_verified' : 'completed',
        tenant_id: tenant.id,
        admin_user_id: adminUserId,
        onboarding_session_id: onboardingSession.id,
        completed_at: isPaidPlan ? null : new Date().toISOString()
      })
      .eq('id', requestRow.id)

    return json(200, {
      success: true,
      status: isPaidPlan ? 'payment_pending' : 'completed',
      tenant_id: tenant.id,
      onboarding_session_id: onboardingSession.id
    })
  }

  return json(400, { success: false, error: 'Unsupported action' })
}, 'self-service-onboarding')
