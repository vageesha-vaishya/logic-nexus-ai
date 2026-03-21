import fs from 'fs'
import path from 'path'
import dotenv from 'dotenv'
import Papa from 'papaparse'
import { createClient } from '@supabase/supabase-js'
import { v5 as uuidv5 } from 'uuid'

const rootDir = process.cwd()
dotenv.config({ path: path.resolve(rootDir, '.env.local') })
dotenv.config({ path: path.resolve(rootDir, '.env') })

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEW_SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing Supabase URL or service role key')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey)

let tenantId = '9e2686ba-ef3c-42df-aea6-dcc880436b9f'
const uuidNamespace = process.env.MGL_UUID_NAMESPACE || uuidv5.URL
const runId = `MGL_IMPORT_${new Date().toISOString().replace(/[-:.TZ]/g, '')}`
const batchSize = 500

const dataDir = path.resolve(rootDir, 'supabase', 'migrations', 'tempMGLData')
const leadFile = path.join(dataDir, 'MGL_Enquiry Data - Lead.csv')
const leadRemarkFile = path.join(dataDir, 'MGL_Enquiry Data - LeadRemark.csv')
const opportunityFile = path.join(dataDir, 'MGL_Enquiry Data - Opportunity.csv')
const contactFile = path.join(dataDir, 'MGL_ContactList Account&Contact.csv')

const sentinelValues = new Set(['', 'na', 'n/a', 'null', 'none', '-', '0', '0000-00-00'])

const normalizeString = (value) => {
  if (value === undefined || value === null) return null
  const trimmed = String(value).trim()
  if (sentinelValues.has(trimmed.toLowerCase())) return null
  return trimmed
}

const normalizeKey = (value) => {
  const normalized = normalizeString(value)
  if (!normalized) return null
  return normalized.toUpperCase().replace(/\s+/g, ' ').trim()
}

const normalizeEmail = (value) => {
  const normalized = normalizeString(value)
  if (!normalized) return null
  const email = normalized.toLowerCase()
  if (!email.includes('@')) return null
  return email
}

const normalizePhone = (value) => normalizeString(value)

const normalizeDate = (value) => {
  const normalized = normalizeString(value)
  if (!normalized) return null
  const parsed = new Date(normalized)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toISOString().slice(0, 10)
}

const parseCsv = (filePath) => {
  if (!fs.existsSync(filePath)) {
    console.error(`Missing CSV file: ${filePath}`)
    process.exit(1)
  }
  const content = fs.readFileSync(filePath, 'utf8')
  const result = Papa.parse(content, { header: true, skipEmptyLines: true })
  if (result.errors?.length) {
    console.error(`CSV parse errors in ${filePath}`)
    console.error(result.errors)
    process.exit(1)
  }
  return result.data
}

const chunkArray = (items, size) => {
  const chunks = []
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size))
  }
  return chunks
}

const buildLegacyJson = (base, raw, sourceFile, sourceSheet) => ({
  legacy_system: 'MGL-legacy-enquiry',
  legacy_primary_key: base.primaryKey || null,
  legacy_business_key: base.businessKey || null,
  source_file: sourceFile,
  source_sheet: sourceSheet,
  imported_at: new Date().toISOString(),
  raw
})

const buildFranchiseCode = (name) => {
  const normalized = normalizeKey(name)
  if (!normalized) return null
  const slug = normalized.replace(/[^A-Z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
  return `MGL-${slug}`
}

const mapLeadSource = (value) => {
  const normalized = normalizeString(value)
  if (!normalized) return 'other'
  const lower = normalized.toLowerCase()
  if (lower.includes('email')) return 'email'
  if (lower.includes('phone') || lower.includes('tele')) return 'phone'
  if (lower.includes('website') || lower.includes('web')) return 'website'
  if (lower.includes('referral')) return 'referral'
  if (lower.includes('social')) return 'social'
  if (lower.includes('event')) return 'event'
  return 'other'
}

const deriveOpportunityStage = (row) => {
  const isDeleted = normalizeString(row.IsDeleted) === '1'
  const isDraft = normalizeString(row.IsDraft) === '1'
  const isApproved = normalizeString(row.isapproved) === '1'
  if (isDeleted) return 'closed_lost'
  if (isDraft) return 'prospecting'
  if (isApproved) return 'proposal'
  return 'qualification'
}

const stageProbability = {
  prospecting: 10,
  qualification: 25,
  needs_analysis: 40,
  value_proposition: 55,
  proposal: 70,
  negotiation: 85,
  closed_won: 100,
  closed_lost: 0
}

const getSitename = (row) => normalizeString(row.SitName || row.sitename || row.SiteName || row.SiteName)

const resolveContactName = (row) => {
  const first = normalizeString(row.ContactPersonFirstName)
  const last = normalizeString(row.ContactPersonLastName)
  if (first || last) {
    return {
      firstName: first || 'MGL',
      lastName: last || normalizeString(row.ContactID) ? `Contact-${normalizeString(row.ContactID)}` : 'Contact'
    }
  }
  const person = normalizeString(row.ContactPerson)
  if (person) {
    const tokens = person.split(/\s+/)
    if (tokens.length === 1) return { firstName: tokens[0], lastName: `Contact-${normalizeString(row.ContactID) || 'Legacy'}` }
    return { firstName: tokens[0], lastName: tokens.slice(1).join(' ') }
  }
  return {
    firstName: 'MGL',
    lastName: `Contact-${normalizeString(row.ContactID) || 'Legacy'}`
  }
}

const buildAccountId = (companyName) => uuidv5(`${tenantId}:account:${companyName}`, uuidNamespace)
const buildContactId = (contactKey) => uuidv5(`${tenantId}:contact:${contactKey}`, uuidNamespace)
const buildLeadId = (leadKey) => uuidv5(`${tenantId}:lead:${leadKey}`, uuidNamespace)
const buildOpportunityId = (opportunityKey) => uuidv5(`${tenantId}:opportunity:${opportunityKey}`, uuidNamespace)
const buildFranchiseId = (franchiseKey) => uuidv5(`${tenantId}:franchise:${franchiseKey}`, uuidNamespace)

const run = async () => {
  const { error: domainUpsertError } = await supabase.from('platform_domains').upsert(
    {
      code: 'logistics',
      name: 'Logistics & Freight',
      description: 'Core logistics and freight forwarding capabilities',
      is_active: true
    },
    { onConflict: 'code', ignoreDuplicates: true }
  )
  if (domainUpsertError) throw domainUpsertError

  const { data: domainRow, error: domainSelectError } = await supabase
    .from('platform_domains')
    .select('id')
    .eq('code', 'logistics')
    .single()
  if (domainSelectError) throw domainSelectError

  const domainId = domainRow.id

  const { data: existingTenant, error: tenantLookupError } = await supabase
    .from('tenants')
    .select('id')
    .or('id.eq.9e2686ba-ef3c-42df-aea6-dcc880436b9f,name.eq.Miami Global Lines,slug.eq.miami-global-lines')
    .limit(1)
    .maybeSingle()
  if (tenantLookupError) throw tenantLookupError

  if (existingTenant?.id) {
    tenantId = existingTenant.id
    const { error: tenantUpdateError } = await supabase
      .from('tenants')
      .update({ domain_id: domainId, is_active: true })
      .eq('id', tenantId)
    if (tenantUpdateError) throw tenantUpdateError
  } else {
    const { error: tenantInsertError } = await supabase.from('tenants').insert({
      id: tenantId,
      name: 'Miami Global Lines',
      slug: 'miami-global-lines',
      domain_id: domainId,
      is_active: true
    })
    if (tenantInsertError) throw tenantInsertError
  }

  const { error: tenantDomainError } = await supabase.from('tenant_domain_assignments').upsert(
    {
      tenant_id: tenantId,
      domain_id: domainId,
      is_active: true
    },
    { onConflict: 'tenant_id,domain_id', ignoreDuplicates: true }
  )
  if (tenantDomainError && !tenantDomainError.message?.includes('Could not find the table')) {
    throw tenantDomainError
  }

  const leadRows = parseCsv(leadFile)
  const leadRemarkRows = parseCsv(leadRemarkFile)
  const opportunityRows = parseCsv(opportunityFile)
  const contactRows = parseCsv(contactFile)

  const sitenames = new Map()
  const collectSitename = (row) => {
    const name = getSitename(row)
    if (!name) return
    sitenames.set(normalizeKey(name), name)
  }

  leadRows.forEach(collectSitename)
  leadRemarkRows.forEach(collectSitename)
  opportunityRows.forEach(collectSitename)
  contactRows.forEach(collectSitename)

  const franchiseRecords = Array.from(sitenames.entries()).map(([key, original]) => {
    const code = buildFranchiseCode(original)
    return {
      id: buildFranchiseId(key),
      tenant_id: tenantId,
      name: original,
      code,
      is_active: true
    }
  }).filter((record) => record.code)

  for (const batch of chunkArray(franchiseRecords, batchSize)) {
    const { error } = await supabase.from('franchises').upsert(batch, { onConflict: 'code', ignoreDuplicates: true })
    if (error) throw error
  }

  const { data: franchiseData, error: franchiseError } = await supabase
    .from('franchises')
    .select('id,name,code')
    .eq('tenant_id', tenantId)
  if (franchiseError) throw franchiseError

  const franchiseMap = new Map()
  franchiseData.forEach((row) => {
    const key = normalizeKey(row.name)
    if (key) franchiseMap.set(key, row.id)
  })

  const companyNameSet = new Map()
  const addCompanyName = (row) => {
    const name = normalizeString(row.CompanyName)
    if (!name) return
    companyNameSet.set(normalizeKey(name), name)
  }

  leadRows.forEach(addCompanyName)
  leadRemarkRows.forEach(addCompanyName)
  contactRows.forEach(addCompanyName)

  const companyFranchiseMap = new Map()
  contactRows.forEach((row) => {
    const companyName = normalizeString(row.CompanyName)
    const sitename = getSitename(row)
    if (!companyName || !sitename) return
    companyFranchiseMap.set(normalizeKey(companyName), normalizeKey(sitename))
  })

  const accountRecords = Array.from(companyNameSet.entries()).map(([key, original]) => {
    const accountId = buildAccountId(key)
    const franchiseKey = companyFranchiseMap.get(key)
    const franchiseId = franchiseKey ? franchiseMap.get(franchiseKey) : null
    const legacyJson = buildLegacyJson(
      { primaryKey: null, businessKey: original },
      { CompanyName: original },
      'MGL_ContactList Account&Contact.csv',
      'ContactList'
    )
    return {
      id: accountId,
      tenant_id: tenantId,
      franchise_id: franchiseId,
      name: original,
      legacy_json: legacyJson
    }
  })

  for (const batch of chunkArray(accountRecords, batchSize)) {
    const { error } = await supabase.from('accounts').upsert(batch, { onConflict: 'id', ignoreDuplicates: true })
    if (error) throw error
  }

  const accountMap = new Map()
  companyNameSet.forEach((_, key) => {
    accountMap.set(key, buildAccountId(key))
  })

  const contactRecords = []
  const contactOrphans = []

  contactRows.forEach((row, index) => {
    const companyName = normalizeString(row.CompanyName)
    if (!companyName) {
      contactOrphans.push({ row: index + 1, reason: 'missing_company', source: row })
      return
    }
    const accountId = accountMap.get(normalizeKey(companyName))
    if (!accountId) {
      contactOrphans.push({ row: index + 1, reason: 'missing_account', source: row })
      return
    }
    const contactKey = normalizeString(row.ContactID) || `${companyName}:${normalizeEmail(row.Email) || index + 1}`
    const { firstName, lastName } = resolveContactName(row)
    const sitename = getSitename(row)
    const franchiseId = sitename ? franchiseMap.get(normalizeKey(sitename)) : null
    const legacyJson = buildLegacyJson(
      { primaryKey: normalizeString(row.ContactID), businessKey: normalizeString(row.CustomerCode) },
      row,
      'MGL_ContactList Account&Contact.csv',
      'ContactList'
    )
    contactRecords.push({
      id: buildContactId(contactKey),
      tenant_id: tenantId,
      franchise_id: franchiseId,
      account_id: accountId,
      first_name: firstName,
      last_name: lastName,
      title: normalizeString(row.Designation),
      email: normalizeEmail(row.Email),
      phone: normalizePhone(row.TelNo),
      mobile: normalizePhone(row.MobNo),
      notes: normalizeString(row.Remarks),
      is_primary: false,
      legacy_json: legacyJson
    })
  })

  for (const batch of chunkArray(contactRecords, batchSize)) {
    const { error } = await supabase.from('contacts').upsert(batch, { onConflict: 'id', ignoreDuplicates: true })
    if (error) throw error
  }

  const leadRecords = []
  const leadMap = new Map()

  leadRows.forEach((row) => {
    const enquiryId = normalizeString(row.EnquiryID)
    const enquiryNo = normalizeString(row.EnquiryNo)
    const leadKey = enquiryId || enquiryNo
    if (!leadKey) return
    const leadId = buildLeadId(leadKey)
    leadMap.set(enquiryId || enquiryNo, leadId)
    const companyName = normalizeString(row.CompanyName)
    const sitename = getSitename(row)
    const franchiseId = sitename ? franchiseMap.get(normalizeKey(sitename)) : null
    const leadSource = mapLeadSource(row.EnquiryType || row.sourceofcontact)
    const status = normalizeString(row.IsDeleted) === '1' ? 'lost' : 'new'
    const legacyJson = buildLegacyJson(
      { primaryKey: enquiryId, businessKey: enquiryNo },
      row,
      'MGL_Enquiry Data - Lead.csv',
      'Lead Data'
    )
    leadRecords.push({
      id: leadId,
      tenant_id: tenantId,
      franchise_id: franchiseId,
      first_name: 'MGL',
      last_name: enquiryNo || enquiryId || 'Lead',
      company: companyName,
      company_name: companyName,
      contact_name: companyName || 'Unknown Contact',
      title: normalizeString(row.Department),
      job_position: normalizeString(row.Department),
      status,
      source: leadSource,
      description: normalizeString(row.Remarks),
      notes: normalizeString(row.DelRemarks),
      legacy_metadata: legacyJson
    })
  })

  for (const batch of chunkArray(leadRecords, batchSize)) {
    const { error } = await supabase.from('leads').upsert(batch, { onConflict: 'id', ignoreDuplicates: true })
    if (error) throw error
  }

  const opportunityRecords = []
  const opportunityOrphans = []

  opportunityRows.forEach((row, index) => {
    const enquiryId = normalizeString(row.EnquiryID)
    const enquiryNo = normalizeString(row.EnquiryNo)
    const opportunityKey = enquiryId || enquiryNo
    if (!opportunityKey) return
    const opportunityId = buildOpportunityId(opportunityKey)
    const companyName = normalizeString(row.CompanyName)
    const accountId = companyName ? accountMap.get(normalizeKey(companyName)) : null
    const leadId = leadMap.get(enquiryId) || leadMap.get(enquiryNo) || null
    const sitename = getSitename(row)
    const franchiseId = sitename ? franchiseMap.get(normalizeKey(sitename)) : null
    const stage = deriveOpportunityStage(row)
    const closeDate = normalizeDate(row.ShipmentMoveDate || row.EnquiryDate)
    const today = new Date().toISOString().slice(0, 10)
    const isClosed = stage === 'closed_won' || stage === 'closed_lost'
    const validCloseDate = closeDate && (isClosed || closeDate >= today) ? closeDate : null
    if (!accountId && !leadId) {
      opportunityOrphans.push({ row: index + 1, reason: 'missing_account_and_lead', source: row })
    }
    opportunityRecords.push({
      id: opportunityId,
      tenant_id: tenantId,
      franchise_id: franchiseId,
      name: `${enquiryNo || enquiryId} - ${companyName || 'Opportunity'}`,
      description: normalizeString(row.Description || row.Remarks),
      stage,
      probability: stageProbability[stage],
      close_date: validCloseDate,
      account_id: accountId,
      contact_id: null,
      lead_id: leadId,
      lead_source: mapLeadSource(row.EnquiryType),
      next_step: normalizeString(row.DelRemarks),
      type: normalizeString(row.Department),
      forecast_category: stage === 'closed_won' ? 'Commit' : stage === 'proposal' || stage === 'negotiation' ? 'Best Case' : 'Pipeline',
      expected_revenue: null
    })
  })

  for (const batch of chunkArray(opportunityRecords, batchSize)) {
    const { error } = await supabase.from('opportunities').upsert(batch, { onConflict: 'id', ignoreDuplicates: true })
    if (error) throw error
  }

  console.log(`Run ID: ${runId}`)
  console.log(`Franchises upserted: ${franchiseRecords.length}`)
  console.log(`Accounts upserted: ${accountRecords.length}`)
  console.log(`Contacts upserted: ${contactRecords.length}`)
  console.log(`Leads upserted: ${leadRecords.length}`)
  console.log(`Opportunities upserted: ${opportunityRecords.length}`)
  console.log(`Contact orphans: ${contactOrphans.length}`)
  console.log(`Opportunity orphans: ${opportunityOrphans.length}`)
}

run().catch((error) => {
  console.error('Phase 2 execution failed')
  console.error(error)
  process.exit(1)
})
