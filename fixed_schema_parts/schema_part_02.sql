
CREATE TABLE IF NOT EXISTS "public"."quote_documents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "quote_id" "uuid" NOT NULL,
    "document_type" "text" NOT NULL,
    "document_name" "text" NOT NULL,
    "file_url" "text",
    "is_public" boolean DEFAULT false,
    "generated_at" timestamp with time zone DEFAULT "now"()
);

CREATE TABLE IF NOT EXISTS "public"."quote_email_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "quote_id" "uuid" NOT NULL,
    "email_type" "text" NOT NULL,
    "subject" "text" NOT NULL,
    "to_emails" "text"[] NOT NULL,
    "sent_at" timestamp with time zone DEFAULT "now"(),
    "delivery_status" "text" DEFAULT 'sent'::"text"
);

CREATE TABLE IF NOT EXISTS "public"."quote_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "quote_id" "uuid" NOT NULL,
    "event_type" "text" NOT NULL,
    "actor_id" "uuid",
    "details" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);

CREATE TABLE IF NOT EXISTS "public"."quote_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "quote_id" "uuid" NOT NULL,
    "line_number" integer NOT NULL,
    "product_name" "text" NOT NULL,
    "description" "text",
    "quantity" numeric(10,2) DEFAULT 1 NOT NULL,
    "unit_price" numeric(15,2) DEFAULT 0 NOT NULL,
    "discount_percent" numeric(5,2) DEFAULT 0,
    "discount_amount" numeric(15,2) DEFAULT 0,
    "tax_percent" numeric(5,2) DEFAULT 0,
    "tax_amount" numeric(15,2) DEFAULT 0,
    "line_total" numeric(15,2) DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "package_category_id" "uuid",
    "package_size_id" "uuid",
    "cargo_type_id" "uuid",
    "weight_kg" numeric,
    "volume_cbm" numeric,
    "special_instructions" "text",
    "service_type_id" "uuid"
);

CREATE TABLE IF NOT EXISTS "public"."quote_legs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "quote_option_id" "uuid" NOT NULL,
    "leg_number" integer DEFAULT 1 NOT NULL,
    "mode" "text",
    "service_type_id" "uuid",
    "origin_location" "text",
    "destination_location" "text",
    "carrier_id" "uuid",
    "transit_days" integer,
    "departure_date" timestamp with time zone,
    "arrival_date" timestamp with time zone,
    "notes" "text",
    "sort_order" integer DEFAULT 1000,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);

CREATE TABLE IF NOT EXISTS "public"."quote_number_config_franchise" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "franchise_id" "uuid" NOT NULL,
    "prefix" "text" DEFAULT 'QUO'::"text" NOT NULL,
    "reset_policy" "public"."quote_reset_policy" DEFAULT 'none'::"public"."quote_reset_policy" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);

CREATE TABLE IF NOT EXISTS "public"."quote_number_config_tenant" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "prefix" "text" DEFAULT 'QUO'::"text" NOT NULL,
    "reset_policy" "public"."quote_reset_policy" DEFAULT 'none'::"public"."quote_reset_policy" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);

CREATE TABLE IF NOT EXISTS "public"."quote_number_sequences" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "franchise_id" "uuid",
    "period_key" "text" NOT NULL,
    "last_sequence" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);

CREATE TABLE IF NOT EXISTS "public"."quote_option_legs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "quote_option_id" "uuid" NOT NULL,
    "leg_order" integer DEFAULT 1 NOT NULL,
    "mode_id" "uuid",
    "service_id" "uuid",
    "origin_location" "text",
    "destination_location" "text",
    "provider_id" "uuid",
    "planned_departure" timestamp with time zone,
    "planned_arrival" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "service_type_id" "uuid",
    "container_type_id" "uuid",
    "container_size_id" "uuid",
    "trade_direction_id" "uuid",
    "leg_currency_id" "uuid"
);

CREATE TABLE IF NOT EXISTS "public"."quote_options" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "quote_version_id" "uuid" NOT NULL,
    "provider_id" "uuid",
    "service_type_id" "uuid",
    "service_id" "uuid",
    "container_type_id" "uuid",
    "container_size_id" "uuid",
    "package_category_id" "uuid",
    "package_size_id" "uuid",
    "origin_port_id" "uuid",
    "destination_port_id" "uuid",
    "transit_time_days" integer,
    "free_time_days" integer,
    "validity_date" timestamp with time zone,
    "currency_id" "uuid",
    "buy_subtotal" numeric DEFAULT 0 NOT NULL,
    "sell_subtotal" numeric DEFAULT 0 NOT NULL,
    "margin_amount" numeric DEFAULT 0 NOT NULL,
    "total_amount" numeric DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "trade_direction_id" "uuid",
    "provider_type_id" "uuid",
    "quote_currency_id" "uuid",
    "margin_method_id" "uuid",
    "margin_value" numeric,
    "auto_margin_enabled" boolean DEFAULT false NOT NULL,
    "min_margin" numeric,
    "rounding_rule" "text"
);

CREATE TABLE IF NOT EXISTS "public"."quote_presentation_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "franchise_id" "uuid",
    "template_name" "text" NOT NULL,
    "template_type" "text" NOT NULL,
    "logo_url" "text",
    "primary_color" "text",
    "secondary_color" "text",
    "font_family" "text" DEFAULT 'Arial'::"text",
    "layout_config" "jsonb" DEFAULT '{}'::"jsonb",
    "header_template" "text",
    "footer_template" "text",
    "terms_conditions_template" "text",
    "show_carrier_details" boolean DEFAULT true,
    "show_transit_times" boolean DEFAULT true,
    "show_buy_prices" boolean DEFAULT false,
    "is_default" boolean DEFAULT false,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);

CREATE TABLE IF NOT EXISTS "public"."quote_selection" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "quote_id" "uuid" NOT NULL,
    "version_id" "uuid" NOT NULL,
    "option_id" "uuid" NOT NULL,
    "selected_by" "uuid",
    "reason" "text",
    "selected_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

CREATE TABLE IF NOT EXISTS "public"."quote_sequences_franchise" (
    "tenant_id" "uuid" NOT NULL,
    "franchise_id" "uuid" NOT NULL,
    "seq_value" bigint DEFAULT 0 NOT NULL,
    "last_reset_bucket" "text"
);

CREATE TABLE IF NOT EXISTS "public"."quote_sequences_tenant" (
    "tenant_id" "uuid" NOT NULL,
    "seq_value" bigint DEFAULT 0 NOT NULL,
    "last_reset_bucket" "text"
);

CREATE TABLE IF NOT EXISTS "public"."quote_shares" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "quote_id" "uuid" NOT NULL,
    "share_token" "text" NOT NULL,
    "access_type" "text" DEFAULT 'view_only'::"text",
    "max_views" integer,
    "current_views" integer DEFAULT 0,
    "expires_at" timestamp with time zone,
    "created_by" "uuid",
    "last_accessed_at" timestamp with time zone,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"()
);

CREATE TABLE IF NOT EXISTS "public"."quote_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "category" "text",
    "content" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "is_active" boolean DEFAULT true,
    "version" integer DEFAULT 1,
    "created_by" "uuid",
    "updated_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);

CREATE TABLE IF NOT EXISTS "public"."quote_versions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "quote_id" "uuid" NOT NULL,
    "version_number" integer NOT NULL,
    "snapshot" "jsonb" NOT NULL,
    "total" numeric,
    "created_at" timestamp with time zone DEFAULT "now"()
);

CREATE TABLE IF NOT EXISTS "public"."quotes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "franchise_id" "uuid",
    "quote_number" "text" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "opportunity_id" "uuid",
    "account_id" "uuid",
    "contact_id" "uuid",
    "owner_id" "uuid",
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "valid_until" "date",
    "subtotal" numeric(15,2) DEFAULT 0,
    "discount_amount" numeric(15,2) DEFAULT 0,
    "discount_percent" numeric(5,2) DEFAULT 0,
    "tax_amount" numeric(15,2) DEFAULT 0,
    "tax_percent" numeric(5,2) DEFAULT 0,
    "shipping_amount" numeric(15,2) DEFAULT 0,
    "total_amount" numeric(15,2) DEFAULT 0,
    "currency" "text" DEFAULT 'USD'::"text",
    "terms_conditions" "text",
    "notes" "text",
    "billing_address" "jsonb" DEFAULT '{}'::"jsonb",
    "shipping_address" "jsonb" DEFAULT '{}'::"jsonb",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "accepted_at" timestamp with time zone,
    "rejected_at" timestamp with time zone,
    "incoterms" "text",
    "origin_location" "jsonb" DEFAULT '{}'::"jsonb",
    "destination_location" "jsonb" DEFAULT '{}'::"jsonb",
    "cargo_details" "jsonb" DEFAULT '{}'::"jsonb",
    "special_handling" "jsonb" DEFAULT '[]'::"jsonb",
    "regulatory_data" "jsonb" DEFAULT '{}'::"jsonb",
    "compliance_status" "text" DEFAULT 'pending'::"text",
    "carrier_id" "uuid",
    "service_id" "uuid",
    "is_primary" boolean DEFAULT false,
    "consignee_id" "uuid",
    "origin_port_id" "uuid",
    "destination_port_id" "uuid",
    "cost_price" numeric,
    "sell_price" numeric,
    "margin_amount" numeric,
    "margin_percentage" numeric,
    "additional_costs" "jsonb" DEFAULT '[]'::"jsonb",
    "incoterm_id" "uuid",
    "payment_terms" "text",
    "service_type_id" "uuid",
    "current_version_id" "uuid",
    CONSTRAINT "quotes_compliance_status_check" CHECK (("compliance_status" = ANY (ARRAY['pending'::"text", 'validated'::"text", 'requires_review'::"text", 'non_compliant'::"text"])))
);

CREATE TABLE IF NOT EXISTS "public"."rate_calculations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "quote_id" "uuid" NOT NULL,
    "service_id" "uuid",
    "carrier_rate_id" "uuid",
    "calculation_breakdown" "jsonb" NOT NULL,
    "applied_surcharges" "jsonb" DEFAULT '[]'::"jsonb",
    "applied_discounts" "jsonb" DEFAULT '[]'::"jsonb",
    "final_rate" numeric NOT NULL,
    "calculated_at" timestamp with time zone DEFAULT "now"(),
    "calculated_by" "uuid"
);

CREATE TABLE IF NOT EXISTS "public"."rate_components" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "rate_id" "uuid" NOT NULL,
    "component_type" "text" NOT NULL,
    "calc_method" "text" NOT NULL,
    "value" numeric NOT NULL,
    "min_amount" numeric,
    "max_amount" numeric,
    "notes" "text",
    "metadata" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);

CREATE TABLE IF NOT EXISTS "public"."rates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "franchise_id" "uuid",
    "mode" "public"."transport_mode" NOT NULL,
    "carrier_id" "uuid",
    "origin" "text" NOT NULL,
    "destination" "text" NOT NULL,
    "validity_start" "date",
    "validity_end" "date",
    "contract_type" "public"."contract_type" NOT NULL,
    "base_price" numeric,
    "currency" "text" DEFAULT 'USD'::"text",
    "metadata" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);

CREATE TABLE IF NOT EXISTS "public"."routes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "franchise_id" "uuid",
    "route_name" "text" NOT NULL,
    "route_code" "text" NOT NULL,
    "origin_warehouse_id" "uuid",
    "destination_warehouse_id" "uuid",
    "waypoints" "jsonb" DEFAULT '[]'::"jsonb",
    "distance_km" numeric,
    "estimated_duration_hours" numeric,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);

CREATE TABLE IF NOT EXISTS "public"."scheduled_emails" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "franchise_id" "uuid",
    "user_id" "uuid",
    "account_id" "uuid",
    "to_emails" "jsonb" NOT NULL,
    "cc_emails" "jsonb",
    "bcc_emails" "jsonb",
    "subject" "text",
    "body_html" "text",
    "body_text" "text",
    "template_id" "uuid",
    "template_variables" "jsonb",
    "scheduled_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "sent_at" timestamp with time zone,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "error_message" "text",
    "retry_count" integer DEFAULT 0,
    "max_retries" integer DEFAULT 3,
    "priority" "text" DEFAULT 'normal'::"text",
    "metadata" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "scheduled_emails_priority_check" CHECK (("priority" = ANY (ARRAY['low'::"text", 'normal'::"text", 'high'::"text", 'urgent'::"text"]))),
    CONSTRAINT "scheduled_emails_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'sent'::"text", 'failed'::"text", 'cancelled'::"text"])))
);

CREATE TABLE IF NOT EXISTS "public"."schema_migration_progress" (
    "version" "text" NOT NULL,
    "next_index" integer DEFAULT 0 NOT NULL,
    "total_statements" integer,
    "updated_at" timestamp with time zone DEFAULT "now"()
);

CREATE TABLE IF NOT EXISTS "public"."schema_migrations" (
    "version" "text" NOT NULL,
    "applied_at" timestamp with time zone DEFAULT "now"(),
    "execution_time_ms" integer,
    "success" boolean DEFAULT true,
    "error_message" "text"
);

CREATE TABLE IF NOT EXISTS "public"."service_details" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "service_id" "uuid" NOT NULL,
    "attributes" "jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);

CREATE TABLE IF NOT EXISTS "public"."service_leg_categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "icon_name" "text",
    "is_active" boolean DEFAULT true,
    "sort_order" integer DEFAULT 1000,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);

CREATE TABLE IF NOT EXISTS "public"."service_modes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "code" "text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

CREATE TABLE IF NOT EXISTS "public"."service_type_mappings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "service_id" "uuid",
    "is_default" boolean DEFAULT false,
    "is_active" boolean DEFAULT true,
    "priority" integer DEFAULT 0,
    "conditions" "jsonb" DEFAULT '{}'::"jsonb",
    "tenant_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "service_type_id" "uuid" NOT NULL
);

CREATE TABLE IF NOT EXISTS "public"."service_types" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "code" "text" NOT NULL,
    "mode_id" "uuid",
    "use_dimensional_weight" boolean DEFAULT false,
    "dim_divisor" numeric DEFAULT 6000,
    CONSTRAINT "service_types_dim_divisor_check" CHECK (("dim_divisor" > (0)::numeric))
);

CREATE TABLE IF NOT EXISTS "public"."services" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "service_code" "text" NOT NULL,
    "service_name" "text" NOT NULL,
    "service_type" "text" NOT NULL,
    "description" "text",
    "base_price" numeric,
    "pricing_unit" "text",
    "transit_time_days" integer,
    "is_active" boolean DEFAULT true,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "shipment_type" "public"."shipment_type" NOT NULL,
    "service_type_id" "uuid"
);

CREATE TABLE IF NOT EXISTS "public"."shipment_attachments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shipment_id" "uuid" NOT NULL,
    "tenant_id" "uuid",
    "franchise_id" "uuid",
    "created_by" "uuid",
    "name" "text" NOT NULL,
    "path" "text" NOT NULL,
    "size" bigint,
    "content_type" "text",
    "public_url" "text",
    "uploaded_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "document_type" "public"."document_type"
);

CREATE TABLE IF NOT EXISTS "public"."shipment_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shipment_id" "uuid" NOT NULL,
    "item_number" integer NOT NULL,
    "description" "text" NOT NULL,
    "quantity" integer DEFAULT 1 NOT NULL,
    "weight_kg" numeric,
    "volume_cbm" numeric,
    "dimensions" "jsonb",
    "package_type" "text",
    "hs_code" "text",
    "value" numeric,
    "currency" "text" DEFAULT 'USD'::"text",
    "is_hazardous" boolean DEFAULT false,
    "hazard_class" "text",
    "special_handling" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);

CREATE TABLE IF NOT EXISTS "public"."shipments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "franchise_id" "uuid",
    "shipment_number" "text" NOT NULL,
    "shipment_type" "public"."shipment_type" NOT NULL,
    "status" "public"."shipment_status" DEFAULT 'draft'::"public"."shipment_status",
    "account_id" "uuid",
    "contact_id" "uuid",
    "origin_address" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "destination_address" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "origin_warehouse_id" "uuid",
    "destination_warehouse_id" "uuid",
    "pickup_date" timestamp with time zone,
    "estimated_delivery_date" timestamp with time zone,
    "actual_delivery_date" timestamp with time zone,
    "total_weight_kg" numeric,
    "total_volume_cbm" numeric,
    "total_packages" integer DEFAULT 0,
    "container_type" "public"."container_type",
    "container_number" "text",
    "declared_value" numeric,
    "freight_charges" numeric,
    "insurance_charges" numeric,
    "customs_charges" numeric,
    "other_charges" numeric,
    "total_charges" numeric,
    "currency" "text" DEFAULT 'USD'::"text",
    "current_location" "jsonb",
    "current_status_description" "text",
    "service_level" "text",
    "priority_level" "text" DEFAULT 'normal'::"text",
    "special_instructions" "text",
    "customs_required" boolean DEFAULT false,
    "insurance_required" boolean DEFAULT false,
    "reference_number" "text",
    "purchase_order_number" "text",
    "invoice_number" "text",
    "assigned_to" "uuid",
    "vehicle_id" "uuid",
    "driver_id" "uuid",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "pod_received" boolean DEFAULT false NOT NULL,
    "pod_received_at" timestamp with time zone,
    "pod_status" "text" DEFAULT 'pending'::"text",
    "pod_received_by" "text",
    "pod_signature_url" "text",
    "pod_notes" "text",
    "pod_documents" "jsonb" DEFAULT '[]'::"jsonb",
    CONSTRAINT "shipments_pod_status_check" CHECK (("pod_status" = ANY (ARRAY['pending'::"text", 'received'::"text", 'rejected'::"text", 'disputed'::"text"])))
);

CREATE TABLE IF NOT EXISTS "public"."shipping_rates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "shipment_type" "public"."shipment_type" NOT NULL,
    "service_level" "text",
    "origin_country" "text",
    "destination_country" "text",
    "origin_zone" "text",
    "destination_zone" "text",
    "min_weight_kg" numeric,
    "max_weight_kg" numeric,
    "rate_per_kg" numeric,
    "base_rate" numeric,
    "currency" "text" DEFAULT 'USD'::"text",
    "effective_from" "date" NOT NULL,
    "effective_to" "date",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);

CREATE TABLE IF NOT EXISTS "public"."states" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "country_id" "uuid",
    "name" "text" NOT NULL,
    "code_iso" "text",
    "code_national" "text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "tenant_id" "uuid"
);

CREATE TABLE IF NOT EXISTS "public"."subscription_features" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "feature_key" "text" NOT NULL,
    "feature_name" "text" NOT NULL,
    "feature_category" "text" NOT NULL,
    "description" "text",
    "is_usage_based" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);

CREATE TABLE IF NOT EXISTS "public"."subscription_invoices" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "subscription_id" "uuid",
    "stripe_invoice_id" "text",
    "invoice_number" "text",
    "amount_due" numeric(10,2) NOT NULL,
    "amount_paid" numeric(10,2) DEFAULT 0,
    "currency" "text" DEFAULT 'USD'::"text" NOT NULL,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "due_date" timestamp with time zone,
    "paid_at" timestamp with time zone,
    "invoice_pdf_url" "text",
    "billing_reason" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);

CREATE TABLE IF NOT EXISTS "public"."subscription_plans" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "plan_type" "public"."plan_type" DEFAULT 'crm_base'::"public"."plan_type" NOT NULL,
    "tier" "public"."subscription_tier",
    "billing_period" "public"."billing_period" DEFAULT 'monthly'::"public"."billing_period" NOT NULL,
    "price_monthly" numeric(10,2) NOT NULL,
    "price_annual" numeric(10,2),
    "currency" "text" DEFAULT 'USD'::"text" NOT NULL,
    "features" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "limits" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "stripe_price_id" "text",
    "stripe_product_id" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "sort_order" integer DEFAULT 0,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);

CREATE TABLE IF NOT EXISTS "public"."tenant_subscriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "plan_id" "uuid" NOT NULL,
    "status" "public"."subscription_status" DEFAULT 'trial'::"public"."subscription_status" NOT NULL,
    "stripe_subscription_id" "text",
    "stripe_customer_id" "text",
    "current_period_start" timestamp with time zone DEFAULT "now"() NOT NULL,
    "current_period_end" timestamp with time zone NOT NULL,
    "trial_end" timestamp with time zone,
    "canceled_at" timestamp with time zone,
    "ended_at" timestamp with time zone,
    "auto_renew" boolean DEFAULT true NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);

CREATE TABLE IF NOT EXISTS "public"."tenants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "logo_url" "text",
    "domain" "text",
    "settings" "jsonb" DEFAULT '{}'::"jsonb",
    "subscription_tier" "text" DEFAULT 'free'::"text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "stripe_customer_id" "text",
    "billing_email" "text",
    "payment_method" "jsonb" DEFAULT '{}'::"jsonb",
    "billing_address" "jsonb" DEFAULT '{}'::"jsonb",
    CONSTRAINT "tenants_subscription_tier_check" CHECK (("subscription_tier" = ANY (ARRAY['free'::"text", 'basic'::"text", 'professional'::"text", 'enterprise'::"text"])))
);

CREATE TABLE IF NOT EXISTS "public"."territories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "criteria" "jsonb" DEFAULT '{}'::"jsonb",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);

CREATE TABLE IF NOT EXISTS "public"."territory_assignments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "territory_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "is_primary" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"()
);

CREATE TABLE IF NOT EXISTS "public"."territory_geographies" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "territory_id" "uuid" NOT NULL,
    "continent_id" "uuid",
    "country_id" "uuid",
    "state_id" "uuid",
    "city_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "territory_geography_type_check" CHECK ((((((("continent_id" IS NOT NULL))::integer + (("country_id" IS NOT NULL))::integer) + (("state_id" IS NOT NULL))::integer) + (("city_id" IS NOT NULL))::integer) = 1))
);

CREATE TABLE IF NOT EXISTS "public"."themes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid",
    "name" "text" NOT NULL,
    "is_default" boolean DEFAULT false,
    "is_active" boolean DEFAULT true,
    "colors" "jsonb" DEFAULT '{}'::"jsonb",
    "typography" "jsonb" DEFAULT '{}'::"jsonb",
    "spacing" "jsonb" DEFAULT '{}'::"jsonb",
    "borders" "jsonb" DEFAULT '{}'::"jsonb",
    "shadows" "jsonb" DEFAULT '{}'::"jsonb",
    "custom_css" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid"
);

CREATE TABLE IF NOT EXISTS "public"."tracking_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shipment_id" "uuid" NOT NULL,
    "event_type" "public"."tracking_event_type" NOT NULL,
    "event_date" timestamp with time zone DEFAULT "now"() NOT NULL,
    "location" "jsonb",
    "location_name" "text",
    "description" "text",
    "notes" "text",
    "is_milestone" boolean DEFAULT false,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);

CREATE TABLE IF NOT EXISTS "public"."trade_directions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "code" "text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "trade_directions_code_check" CHECK (("code" = ANY (ARRAY['import'::"text", 'export'::"text", 'inland'::"text"])))
);

CREATE TABLE IF NOT EXISTS "public"."transport_modes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "name" "text" NOT NULL,
    "icon_name" "text" NOT NULL,
    "color" "text" NOT NULL,
    "display_order" integer DEFAULT 1000 NOT NULL,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);

CREATE TABLE IF NOT EXISTS "public"."ui_themes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "tokens" "jsonb" NOT NULL,
    "scope" "text" NOT NULL,
    "tenant_id" "uuid",
    "franchise_id" "uuid",
    "user_id" "uuid",
    "is_default" boolean DEFAULT false NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ui_themes_scope_check" CHECK (("scope" = ANY (ARRAY['platform'::"text", 'tenant'::"text", 'franchise'::"text", 'user'::"text"])))
);

CREATE TABLE IF NOT EXISTS "public"."usage_records" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "subscription_id" "uuid",
    "feature_key" "text" NOT NULL,
    "usage_count" integer DEFAULT 0 NOT NULL,
    "limit_count" integer,
    "period_start" timestamp with time zone NOT NULL,
    "period_end" timestamp with time zone NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);

CREATE TABLE IF NOT EXISTS "public"."user_capacity" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "franchise_id" "uuid",
    "max_leads" integer DEFAULT 50,
    "current_leads" integer DEFAULT 0,
    "is_available" boolean DEFAULT true,
    "last_assigned_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);

CREATE TABLE IF NOT EXISTS "public"."user_custom_roles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role_id" "uuid" NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "franchise_id" "uuid",
    "assigned_by" "uuid",
    "assigned_at" timestamp with time zone DEFAULT "now"()
);

CREATE TABLE IF NOT EXISTS "public"."user_preferences" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "tenant_id" "uuid",
    "franchise_id" "uuid",
    "admin_override_enabled" boolean DEFAULT false NOT NULL,
    "theme" character varying(20) DEFAULT 'system'::character varying,
    "language" character varying(10) DEFAULT 'en'::character varying,
    "notifications_enabled" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

CREATE TABLE IF NOT EXISTS "public"."user_roles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "public"."app_role" NOT NULL,
    "tenant_id" "uuid",
    "franchise_id" "uuid",
    "assigned_by" "uuid",
    "assigned_at" timestamp with time zone DEFAULT "now"()
);

CREATE TABLE IF NOT EXISTS "public"."vehicles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "franchise_id" "uuid",
    "vehicle_number" "text" NOT NULL,
    "vehicle_type" "text" NOT NULL,
    "make" "text",
    "model" "text",
    "year" integer,
    "capacity_kg" numeric,
    "capacity_cbm" numeric,
    "status" "public"."vehicle_status" DEFAULT 'available'::"public"."vehicle_status",
    "current_location" "jsonb",
    "last_maintenance_date" "date",
    "next_maintenance_date" "date",
    "insurance_expiry" "date",
    "registration_expiry" "date",
    "driver_id" "uuid",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);

CREATE TABLE IF NOT EXISTS "public"."warehouse_inventory" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "warehouse_id" "uuid" NOT NULL,
    "shipment_id" "uuid",
    "item_description" "text" NOT NULL,
    "quantity" integer DEFAULT 0 NOT NULL,
    "weight_kg" numeric,
    "volume_cbm" numeric,
    "location_in_warehouse" "text",
    "received_date" timestamp with time zone DEFAULT "now"(),
    "expected_dispatch_date" timestamp with time zone,
    "status" "text" DEFAULT 'stored'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);

CREATE TABLE IF NOT EXISTS "public"."warehouses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "franchise_id" "uuid",
    "name" "text" NOT NULL,
    "code" "text" NOT NULL,
    "warehouse_type" "text",
    "address" "jsonb" DEFAULT '{}'::"jsonb",
    "contact_person" "text",
    "contact_phone" "text",
    "contact_email" "text",
    "capacity_sqft" numeric,
    "current_utilization" numeric DEFAULT 0,
    "is_active" boolean DEFAULT true,
    "operating_hours" "jsonb" DEFAULT '{}'::"jsonb",
    "facilities" "jsonb" DEFAULT '[]'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);

ALTER TABLE "public"."accounts" DROP CONSTRAINT IF EXISTS "accounts_pkey";
ALTER TABLE "public"."accounts" ADD CONSTRAINT "accounts_pkey" PRIMARY KEY ("id");

ALTER TABLE "public"."activities" DROP CONSTRAINT IF EXISTS "activities_pkey";
ALTER TABLE "public"."activities" ADD CONSTRAINT "activities_pkey" PRIMARY KEY ("id");

ALTER TABLE "public"."aes_hts_codes" DROP CONSTRAINT IF EXISTS "aes_hts_codes_hts_code_unique";
ALTER TABLE "public"."aes_hts_codes" ADD CONSTRAINT "aes_hts_codes_hts_code_unique" UNIQUE ("hts_code");

ALTER TABLE "public"."aes_hts_codes" DROP CONSTRAINT IF EXISTS "aes_hts_codes_pkey";
ALTER TABLE "public"."aes_hts_codes" ADD CONSTRAINT "aes_hts_codes_pkey" PRIMARY KEY ("id");

ALTER TABLE "public"."audit_logs" DROP CONSTRAINT IF EXISTS "audit_logs_pkey";
ALTER TABLE "public"."audit_logs" ADD CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id");

ALTER TABLE "public"."auth_permissions" DROP CONSTRAINT IF EXISTS "auth_permissions_pkey";
ALTER TABLE "public"."auth_permissions" ADD CONSTRAINT "auth_permissions_pkey" PRIMARY KEY ("id");

ALTER TABLE "public"."auth_role_hierarchy" DROP CONSTRAINT IF EXISTS "auth_role_hierarchy_pkey";
ALTER TABLE "public"."auth_role_hierarchy" ADD CONSTRAINT "auth_role_hierarchy_pkey" PRIMARY KEY ("manager_role_id", "target_role_id");

ALTER TABLE "public"."auth_role_permissions" DROP CONSTRAINT IF EXISTS "auth_role_permissions_pkey";
ALTER TABLE "public"."auth_role_permissions" ADD CONSTRAINT "auth_role_permissions_pkey" PRIMARY KEY ("role_id", "permission_id");

ALTER TABLE "public"."auth_roles" DROP CONSTRAINT IF EXISTS "auth_roles_pkey";
ALTER TABLE "public"."auth_roles" ADD CONSTRAINT "auth_roles_pkey" PRIMARY KEY ("id");

ALTER TABLE "public"."cargo_details" DROP CONSTRAINT IF EXISTS "cargo_details_pkey";
ALTER TABLE "public"."cargo_details" ADD CONSTRAINT "cargo_details_pkey" PRIMARY KEY ("id");

ALTER TABLE "public"."cargo_types" DROP CONSTRAINT IF EXISTS "cargo_types_pkey";
ALTER TABLE "public"."cargo_types" ADD CONSTRAINT "cargo_types_pkey" PRIMARY KEY ("id");

ALTER TABLE "public"."carrier_rate_attachments" DROP CONSTRAINT IF EXISTS "carrier_rate_attachments_pkey";
ALTER TABLE "public"."carrier_rate_attachments" ADD CONSTRAINT "carrier_rate_attachments_pkey" PRIMARY KEY ("id");

ALTER TABLE "public"."carrier_rate_charges" DROP CONSTRAINT IF EXISTS "carrier_rate_charges_pkey";
ALTER TABLE "public"."carrier_rate_charges" ADD CONSTRAINT "carrier_rate_charges_pkey" PRIMARY KEY ("id");

ALTER TABLE "public"."carrier_rates" DROP CONSTRAINT IF EXISTS "carrier_rates_pkey";
ALTER TABLE "public"."carrier_rates" ADD CONSTRAINT "carrier_rates_pkey" PRIMARY KEY ("id");

ALTER TABLE "public"."carrier_service_types" DROP CONSTRAINT IF EXISTS "carrier_service_types_pkey";
ALTER TABLE "public"."carrier_service_types" ADD CONSTRAINT "carrier_service_types_pkey" PRIMARY KEY ("id");

ALTER TABLE "public"."carrier_service_types" DROP CONSTRAINT IF EXISTS "carrier_service_types_unique_pair";
ALTER TABLE "public"."carrier_service_types" ADD CONSTRAINT "carrier_service_types_unique_pair" UNIQUE ("tenant_id", "carrier_id", "service_type");

ALTER TABLE "public"."carriers" DROP CONSTRAINT IF EXISTS "carriers_pkey";
ALTER TABLE "public"."carriers" ADD CONSTRAINT "carriers_pkey" PRIMARY KEY ("id");

ALTER TABLE "public"."carriers" DROP CONSTRAINT IF EXISTS "carriers_unique_name_per_tenant";
ALTER TABLE "public"."carriers" ADD CONSTRAINT "carriers_unique_name_per_tenant" UNIQUE ("tenant_id", "carrier_name");

ALTER TABLE "public"."charge_bases" DROP CONSTRAINT IF EXISTS "charge_bases_code_key";
ALTER TABLE "public"."charge_bases" ADD CONSTRAINT "charge_bases_code_key" UNIQUE ("code");

ALTER TABLE "public"."charge_bases" DROP CONSTRAINT IF EXISTS "charge_bases_pkey";
ALTER TABLE "public"."charge_bases" ADD CONSTRAINT "charge_bases_pkey" PRIMARY KEY ("id");

ALTER TABLE "public"."charge_categories" DROP CONSTRAINT IF EXISTS "charge_categories_code_key";
ALTER TABLE "public"."charge_categories" ADD CONSTRAINT "charge_categories_code_key" UNIQUE ("code");

ALTER TABLE "public"."charge_categories" DROP CONSTRAINT IF EXISTS "charge_categories_pkey";
ALTER TABLE "public"."charge_categories" ADD CONSTRAINT "charge_categories_pkey" PRIMARY KEY ("id");

ALTER TABLE "public"."charge_sides" DROP CONSTRAINT IF EXISTS "charge_sides_code_key";
ALTER TABLE "public"."charge_sides" ADD CONSTRAINT "charge_sides_code_key" UNIQUE ("code");

ALTER TABLE "public"."charge_sides" DROP CONSTRAINT IF EXISTS "charge_sides_pkey";
ALTER TABLE "public"."charge_sides" ADD CONSTRAINT "charge_sides_pkey" PRIMARY KEY ("id");

ALTER TABLE "public"."charge_tier_config" DROP CONSTRAINT IF EXISTS "charge_tier_config_pkey";
ALTER TABLE "public"."charge_tier_config" ADD CONSTRAINT "charge_tier_config_pkey" PRIMARY KEY ("id");

ALTER TABLE "public"."charge_tier_ranges" DROP CONSTRAINT IF EXISTS "charge_tier_ranges_pkey";
ALTER TABLE "public"."charge_tier_ranges" ADD CONSTRAINT "charge_tier_ranges_pkey" PRIMARY KEY ("id");

ALTER TABLE "public"."charge_types" DROP CONSTRAINT IF EXISTS "charge_types_pkey";
ALTER TABLE "public"."charge_types" ADD CONSTRAINT "charge_types_pkey" PRIMARY KEY ("code");

ALTER TABLE "public"."charge_weight_breaks" DROP CONSTRAINT IF EXISTS "charge_weight_breaks_pkey";
ALTER TABLE "public"."charge_weight_breaks" ADD CONSTRAINT "charge_weight_breaks_pkey" PRIMARY KEY ("id");

ALTER TABLE "public"."cities" DROP CONSTRAINT IF EXISTS "cities_country_state_name_key";
ALTER TABLE "public"."cities" ADD CONSTRAINT "cities_country_state_name_key" UNIQUE ("country_id", "state_id", "name");

ALTER TABLE "public"."cities" DROP CONSTRAINT IF EXISTS "cities_pkey";
ALTER TABLE "public"."cities" ADD CONSTRAINT "cities_pkey" PRIMARY KEY ("id");

ALTER TABLE "public"."compliance_checks" DROP CONSTRAINT IF EXISTS "compliance_checks_pkey";
ALTER TABLE "public"."compliance_checks" ADD CONSTRAINT "compliance_checks_pkey" PRIMARY KEY ("id");

ALTER TABLE "public"."compliance_rules" DROP CONSTRAINT IF EXISTS "compliance_rules_pkey";
ALTER TABLE "public"."compliance_rules" ADD CONSTRAINT "compliance_rules_pkey" PRIMARY KEY ("id");

ALTER TABLE "public"."consignees" DROP CONSTRAINT IF EXISTS "consignees_pkey";
ALTER TABLE "public"."consignees" ADD CONSTRAINT "consignees_pkey" PRIMARY KEY ("id");

ALTER TABLE "public"."contacts" DROP CONSTRAINT IF EXISTS "contacts_pkey";
ALTER TABLE "public"."contacts" ADD CONSTRAINT "contacts_pkey" PRIMARY KEY ("id");

ALTER TABLE "public"."container_sizes" DROP CONSTRAINT IF EXISTS "container_sizes_code_key";
ALTER TABLE "public"."container_sizes" ADD CONSTRAINT "container_sizes_code_key" UNIQUE ("code");

ALTER TABLE "public"."container_sizes" DROP CONSTRAINT IF EXISTS "container_sizes_pkey";
ALTER TABLE "public"."container_sizes" ADD CONSTRAINT "container_sizes_pkey" PRIMARY KEY ("id");

ALTER TABLE "public"."container_types" DROP CONSTRAINT IF EXISTS "container_types_code_key";
ALTER TABLE "public"."container_types" ADD CONSTRAINT "container_types_code_key" UNIQUE ("code");

ALTER TABLE "public"."container_types" DROP CONSTRAINT IF EXISTS "container_types_pkey";
ALTER TABLE "public"."container_types" ADD CONSTRAINT "container_types_pkey" PRIMARY KEY ("id");

ALTER TABLE "public"."continents" DROP CONSTRAINT IF EXISTS "continents_code_international_key";
ALTER TABLE "public"."continents" ADD CONSTRAINT "continents_code_international_key" UNIQUE ("code_international");

ALTER TABLE "public"."continents" DROP CONSTRAINT IF EXISTS "continents_code_national_key";
ALTER TABLE "public"."continents" ADD CONSTRAINT "continents_code_national_key" UNIQUE ("code_national");

ALTER TABLE "public"."continents" DROP CONSTRAINT IF EXISTS "continents_pkey";
ALTER TABLE "public"."continents" ADD CONSTRAINT "continents_pkey" PRIMARY KEY ("id");

ALTER TABLE "public"."countries" DROP CONSTRAINT IF EXISTS "countries_code_iso2_key";
ALTER TABLE "public"."countries" ADD CONSTRAINT "countries_code_iso2_key" UNIQUE ("code_iso2");

ALTER TABLE "public"."countries" DROP CONSTRAINT IF EXISTS "countries_code_iso3_key";
ALTER TABLE "public"."countries" ADD CONSTRAINT "countries_code_iso3_key" UNIQUE ("code_iso3");

ALTER TABLE "public"."countries" DROP CONSTRAINT IF EXISTS "countries_pkey";
ALTER TABLE "public"."countries" ADD CONSTRAINT "countries_pkey" PRIMARY KEY ("id");

ALTER TABLE "public"."currencies" DROP CONSTRAINT IF EXISTS "currencies_code_key";
ALTER TABLE "public"."currencies" ADD CONSTRAINT "currencies_code_key" UNIQUE ("code");

ALTER TABLE "public"."currencies" DROP CONSTRAINT IF EXISTS "currencies_pkey";
ALTER TABLE "public"."currencies" ADD CONSTRAINT "currencies_pkey" PRIMARY KEY ("id");

ALTER TABLE "public"."custom_role_permissions" DROP CONSTRAINT IF EXISTS "custom_role_permissions_pkey";
ALTER TABLE "public"."custom_role_permissions" ADD CONSTRAINT "custom_role_permissions_pkey" PRIMARY KEY ("id");

ALTER TABLE "public"."custom_role_permissions" DROP CONSTRAINT IF EXISTS "custom_role_permissions_role_id_permission_key_key";
ALTER TABLE "public"."custom_role_permissions" ADD CONSTRAINT "custom_role_permissions_role_id_permission_key_key" UNIQUE ("role_id", "permission_key");

ALTER TABLE "public"."custom_roles" DROP CONSTRAINT IF EXISTS "custom_roles_pkey";
ALTER TABLE "public"."custom_roles" ADD CONSTRAINT "custom_roles_pkey" PRIMARY KEY ("id");

ALTER TABLE "public"."custom_roles" DROP CONSTRAINT IF EXISTS "custom_roles_tenant_id_name_key";
ALTER TABLE "public"."custom_roles" ADD CONSTRAINT "custom_roles_tenant_id_name_key" UNIQUE ("tenant_id", "name");

ALTER TABLE "public"."customer_selections" DROP CONSTRAINT IF EXISTS "customer_selections_pkey";
ALTER TABLE "public"."customer_selections" ADD CONSTRAINT "customer_selections_pkey" PRIMARY KEY ("id");

ALTER TABLE "public"."customs_documents" DROP CONSTRAINT IF EXISTS "customs_documents_pkey";
ALTER TABLE "public"."customs_documents" ADD CONSTRAINT "customs_documents_pkey" PRIMARY KEY ("id");

ALTER TABLE "public"."dashboard_preferences" DROP CONSTRAINT IF EXISTS "dashboard_preferences_pkey";
ALTER TABLE "public"."dashboard_preferences" ADD CONSTRAINT "dashboard_preferences_pkey" PRIMARY KEY ("id");

ALTER TABLE "public"."dashboard_preferences" DROP CONSTRAINT IF EXISTS "dashboard_preferences_user_id_key";
ALTER TABLE "public"."dashboard_preferences" ADD CONSTRAINT "dashboard_preferences_user_id_key" UNIQUE ("user_id");

ALTER TABLE "public"."document_templates" DROP CONSTRAINT IF EXISTS "document_templates_pkey";
ALTER TABLE "public"."document_templates" ADD CONSTRAINT "document_templates_pkey" PRIMARY KEY ("id");

ALTER TABLE "public"."document_versions" DROP CONSTRAINT IF EXISTS "document_versions_document_id_version_key";
ALTER TABLE "public"."document_versions" ADD CONSTRAINT "document_versions_document_id_version_key" UNIQUE ("document_id", "version");

ALTER TABLE "public"."document_versions" DROP CONSTRAINT IF EXISTS "document_versions_pkey";
ALTER TABLE "public"."document_versions" ADD CONSTRAINT "document_versions_pkey" PRIMARY KEY ("id");

ALTER TABLE "public"."documents" DROP CONSTRAINT IF EXISTS "documents_pkey";
ALTER TABLE "public"."documents" ADD CONSTRAINT "documents_pkey" PRIMARY KEY ("id");

ALTER TABLE "public"."email_account_delegations" DROP CONSTRAINT IF EXISTS "email_account_delegations_account_id_delegate_user_id_key";
ALTER TABLE "public"."email_account_delegations" ADD CONSTRAINT "email_account_delegations_account_id_delegate_user_id_key" UNIQUE ("account_id", "delegate_user_id");

ALTER TABLE "public"."email_account_delegations" DROP CONSTRAINT IF EXISTS "email_account_delegations_pkey";
ALTER TABLE "public"."email_account_delegations" ADD CONSTRAINT "email_account_delegations_pkey" PRIMARY KEY ("id");

ALTER TABLE "public"."email_accounts" DROP CONSTRAINT IF EXISTS "email_accounts_pkey";
ALTER TABLE "public"."email_accounts" ADD CONSTRAINT "email_accounts_pkey" PRIMARY KEY ("id");

ALTER TABLE "public"."email_accounts" DROP CONSTRAINT IF EXISTS "email_accounts_user_id_email_address_key";
ALTER TABLE "public"."email_accounts" ADD CONSTRAINT "email_accounts_user_id_email_address_key" UNIQUE ("user_id", "email_address");

ALTER TABLE "public"."email_audit_log" DROP CONSTRAINT IF EXISTS "email_audit_log_pkey";
ALTER TABLE "public"."email_audit_log" ADD CONSTRAINT "email_audit_log_pkey" PRIMARY KEY ("id");

ALTER TABLE "public"."email_filters" DROP CONSTRAINT IF EXISTS "email_filters_pkey";
ALTER TABLE "public"."email_filters" ADD CONSTRAINT "email_filters_pkey" PRIMARY KEY ("id");

ALTER TABLE "public"."email_templates" DROP CONSTRAINT IF EXISTS "email_templates_pkey";
ALTER TABLE "public"."email_templates" ADD CONSTRAINT "email_templates_pkey" PRIMARY KEY ("id");

ALTER TABLE "public"."emails" DROP CONSTRAINT IF EXISTS "emails_account_id_message_id_key";
ALTER TABLE "public"."emails" ADD CONSTRAINT "emails_account_id_message_id_key" UNIQUE ("account_id", "message_id");

ALTER TABLE "public"."emails" DROP CONSTRAINT IF EXISTS "emails_pkey";
ALTER TABLE "public"."emails" ADD CONSTRAINT "emails_pkey" PRIMARY KEY ("id");

ALTER TABLE "public"."entity_transfer_items" DROP CONSTRAINT IF EXISTS "entity_transfer_items_pkey";
ALTER TABLE "public"."entity_transfer_items" ADD CONSTRAINT "entity_transfer_items_pkey" PRIMARY KEY ("id");

ALTER TABLE "public"."entity_transfers" DROP CONSTRAINT IF EXISTS "entity_transfers_pkey";
ALTER TABLE "public"."entity_transfers" ADD CONSTRAINT "entity_transfers_pkey" PRIMARY KEY ("id");

ALTER TABLE "public"."franchises" DROP CONSTRAINT IF EXISTS "franchises_code_key";
ALTER TABLE "public"."franchises" ADD CONSTRAINT "franchises_code_key" UNIQUE ("code");

ALTER TABLE "public"."franchises" DROP CONSTRAINT IF EXISTS "franchises_pkey";
ALTER TABLE "public"."franchises" ADD CONSTRAINT "franchises_pkey" PRIMARY KEY ("id");

ALTER TABLE "public"."fx_rates" DROP CONSTRAINT IF EXISTS "fx_rates_pkey";
ALTER TABLE "public"."fx_rates" ADD CONSTRAINT "fx_rates_pkey" PRIMARY KEY ("id");

ALTER TABLE "public"."history_filter_presets" DROP CONSTRAINT IF EXISTS "history_filter_presets_pkey";
ALTER TABLE "public"."history_filter_presets" ADD CONSTRAINT "history_filter_presets_pkey" PRIMARY KEY ("id");

ALTER TABLE "public"."history_filter_presets" DROP CONSTRAINT IF EXISTS "history_filter_presets_user_id_name_key";
ALTER TABLE "public"."history_filter_presets" ADD CONSTRAINT "history_filter_presets_user_id_name_key" UNIQUE ("user_id", "name");

ALTER TABLE "public"."import_errors" DROP CONSTRAINT IF EXISTS "import_errors_pkey";
ALTER TABLE "public"."import_errors" ADD CONSTRAINT "import_errors_pkey" PRIMARY KEY ("id");

ALTER TABLE "public"."import_history_details" DROP CONSTRAINT IF EXISTS "import_history_details_pkey";
ALTER TABLE "public"."import_history_details" ADD CONSTRAINT "import_history_details_pkey" PRIMARY KEY ("id");

ALTER TABLE "public"."import_history" DROP CONSTRAINT IF EXISTS "import_history_pkey";
ALTER TABLE "public"."import_history" ADD CONSTRAINT "import_history_pkey" PRIMARY KEY ("id");

ALTER TABLE "public"."incoterms" DROP CONSTRAINT IF EXISTS "incoterms_pkey";
ALTER TABLE "public"."incoterms" ADD CONSTRAINT "incoterms_pkey" PRIMARY KEY ("id");

ALTER TABLE "public"."invitations" DROP CONSTRAINT IF EXISTS "invitations_pkey";
ALTER TABLE "public"."invitations" ADD CONSTRAINT "invitations_pkey" PRIMARY KEY ("id");

ALTER TABLE "public"."invitations" DROP CONSTRAINT IF EXISTS "invitations_token_key";
ALTER TABLE "public"."invitations" ADD CONSTRAINT "invitations_token_key" UNIQUE ("token");

ALTER TABLE "public"."lead_activities" DROP CONSTRAINT IF EXISTS "lead_activities_pkey";
ALTER TABLE "public"."lead_activities" ADD CONSTRAINT "lead_activities_pkey" PRIMARY KEY ("id");

ALTER TABLE "public"."lead_assignment_history" DROP CONSTRAINT IF EXISTS "lead_assignment_history_pkey";
ALTER TABLE "public"."lead_assignment_history" ADD CONSTRAINT "lead_assignment_history_pkey" PRIMARY KEY ("id");

ALTER TABLE "public"."lead_assignment_queue" DROP CONSTRAINT IF EXISTS "lead_assignment_queue_pkey";
ALTER TABLE "public"."lead_assignment_queue" ADD CONSTRAINT "lead_assignment_queue_pkey" PRIMARY KEY ("id");

ALTER TABLE "public"."lead_assignment_rules" DROP CONSTRAINT IF EXISTS "lead_assignment_rules_pkey";
ALTER TABLE "public"."lead_assignment_rules" ADD CONSTRAINT "lead_assignment_rules_pkey" PRIMARY KEY ("id");

ALTER TABLE "public"."lead_score_config" DROP CONSTRAINT IF EXISTS "lead_score_config_pkey";
ALTER TABLE "public"."lead_score_config" ADD CONSTRAINT "lead_score_config_pkey" PRIMARY KEY ("id");

ALTER TABLE "public"."lead_score_config" DROP CONSTRAINT IF EXISTS "lead_score_config_tenant_id_key";
ALTER TABLE "public"."lead_score_config" ADD CONSTRAINT "lead_score_config_tenant_id_key" UNIQUE ("tenant_id");

ALTER TABLE "public"."lead_score_logs" DROP CONSTRAINT IF EXISTS "lead_score_logs_pkey";
ALTER TABLE "public"."lead_score_logs" ADD CONSTRAINT "lead_score_logs_pkey" PRIMARY KEY ("id");

ALTER TABLE "public"."lead_scoring_rules" DROP CONSTRAINT IF EXISTS "lead_scoring_rules_pkey";
ALTER TABLE "public"."lead_scoring_rules" ADD CONSTRAINT "lead_scoring_rules_pkey" PRIMARY KEY ("id");

ALTER TABLE "public"."leads" DROP CONSTRAINT IF EXISTS "leads_pkey";
ALTER TABLE "public"."leads" ADD CONSTRAINT "leads_pkey" PRIMARY KEY ("id");

ALTER TABLE "public"."margin_methods" DROP CONSTRAINT IF EXISTS "margin_methods_pkey";
ALTER TABLE "public"."margin_methods" ADD CONSTRAINT "margin_methods_pkey" PRIMARY KEY ("id");

ALTER TABLE "public"."margin_profiles" DROP CONSTRAINT IF EXISTS "margin_profiles_pkey";
ALTER TABLE "public"."margin_profiles" ADD CONSTRAINT "margin_profiles_pkey" PRIMARY KEY ("id");

ALTER TABLE "public"."oauth_configurations" DROP CONSTRAINT IF EXISTS "oauth_configurations_pkey";
ALTER TABLE "public"."oauth_configurations" ADD CONSTRAINT "oauth_configurations_pkey" PRIMARY KEY ("id");

ALTER TABLE "public"."oauth_configurations" DROP CONSTRAINT IF EXISTS "oauth_configurations_user_id_provider_key";
ALTER TABLE "public"."oauth_configurations" ADD CONSTRAINT "oauth_configurations_user_id_provider_key" UNIQUE ("user_id", "provider");

ALTER TABLE "public"."opportunities" DROP CONSTRAINT IF EXISTS "opportunities_pkey";
ALTER TABLE "public"."opportunities" ADD CONSTRAINT "opportunities_pkey" PRIMARY KEY ("id");

ALTER TABLE "public"."opportunity_items" DROP CONSTRAINT IF EXISTS "opportunity_items_pkey";
ALTER TABLE "public"."opportunity_items" ADD CONSTRAINT "opportunity_items_pkey" PRIMARY KEY ("id");

ALTER TABLE "public"."opportunity_probability_history" DROP CONSTRAINT IF EXISTS "opportunity_probability_history_pkey";
ALTER TABLE "public"."opportunity_probability_history" ADD CONSTRAINT "opportunity_probability_history_pkey" PRIMARY KEY ("id");

ALTER TABLE "public"."package_categories" DROP CONSTRAINT IF EXISTS "package_categories_pkey";
ALTER TABLE "public"."package_categories" ADD CONSTRAINT "package_categories_pkey" PRIMARY KEY ("id");

ALTER TABLE "public"."package_sizes" DROP CONSTRAINT IF EXISTS "package_sizes_pkey";
ALTER TABLE "public"."package_sizes" ADD CONSTRAINT "package_sizes_pkey" PRIMARY KEY ("id");

ALTER TABLE "public"."portal_tokens" DROP CONSTRAINT IF EXISTS "portal_tokens_pkey";
ALTER TABLE "public"."portal_tokens" ADD CONSTRAINT "portal_tokens_pkey" PRIMARY KEY ("id");

ALTER TABLE "public"."portal_tokens" DROP CONSTRAINT IF EXISTS "portal_tokens_token_key";
ALTER TABLE "public"."portal_tokens" ADD CONSTRAINT "portal_tokens_token_key" UNIQUE ("token");

ALTER TABLE "public"."ports_locations" DROP CONSTRAINT IF EXISTS "ports_locations_pkey";
ALTER TABLE "public"."ports_locations" ADD CONSTRAINT "ports_locations_pkey" PRIMARY KEY ("id");

ALTER TABLE "public"."profiles" DROP CONSTRAINT IF EXISTS "profiles_email_key";
ALTER TABLE "public"."profiles" ADD CONSTRAINT "profiles_email_key" UNIQUE ("email");

ALTER TABLE "public"."profiles" DROP CONSTRAINT IF EXISTS "profiles_pkey";
ALTER TABLE "public"."profiles" ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");

ALTER TABLE "public"."provider_api_configs" DROP CONSTRAINT IF EXISTS "provider_api_configs_pkey";
ALTER TABLE "public"."provider_api_configs" ADD CONSTRAINT "provider_api_configs_pkey" PRIMARY KEY ("id");

ALTER TABLE "public"."provider_api_configs" DROP CONSTRAINT IF EXISTS "provider_api_configs_unique";
ALTER TABLE "public"."provider_api_configs" ADD CONSTRAINT "provider_api_configs_unique" UNIQUE ("tenant_id", "carrier_id");

ALTER TABLE "public"."provider_charge_mappings" DROP CONSTRAINT IF EXISTS "provider_charge_mappings_pkey";
ALTER TABLE "public"."provider_charge_mappings" ADD CONSTRAINT "provider_charge_mappings_pkey" PRIMARY KEY ("id");

ALTER TABLE "public"."provider_charge_mappings" DROP CONSTRAINT IF EXISTS "provider_charge_mappings_unique";
ALTER TABLE "public"."provider_charge_mappings" ADD CONSTRAINT "provider_charge_mappings_unique" UNIQUE ("carrier_id", "provider_charge_code");

ALTER TABLE "public"."provider_rate_rules" DROP CONSTRAINT IF EXISTS "provider_rate_rules_pkey";
ALTER TABLE "public"."provider_rate_rules" ADD CONSTRAINT "provider_rate_rules_pkey" PRIMARY KEY ("id");

ALTER TABLE "public"."provider_rate_templates" DROP CONSTRAINT IF EXISTS "provider_rate_templates_pkey";
ALTER TABLE "public"."provider_rate_templates" ADD CONSTRAINT "provider_rate_templates_pkey" PRIMARY KEY ("id");

ALTER TABLE "public"."provider_rate_templates" DROP CONSTRAINT IF EXISTS "provider_rate_templates_unique";
ALTER TABLE "public"."provider_rate_templates" ADD CONSTRAINT "provider_rate_templates_unique" UNIQUE ("carrier_id", "service_type_id", "template_name");

ALTER TABLE "public"."provider_surcharges" DROP CONSTRAINT IF EXISTS "provider_surcharges_pkey";
ALTER TABLE "public"."provider_surcharges" ADD CONSTRAINT "provider_surcharges_pkey" PRIMARY KEY ("id");

ALTER TABLE "public"."provider_surcharges" DROP CONSTRAINT IF EXISTS "provider_surcharges_unique";
ALTER TABLE "public"."provider_surcharges" ADD CONSTRAINT "provider_surcharges_unique" UNIQUE ("carrier_id", "surcharge_code");

ALTER TABLE "public"."provider_types" DROP CONSTRAINT IF EXISTS "provider_types_pkey";
ALTER TABLE "public"."provider_types" ADD CONSTRAINT "provider_types_pkey" PRIMARY KEY ("id");

ALTER TABLE "public"."queue_members" DROP CONSTRAINT IF EXISTS "queue_members_pkey";
ALTER TABLE "public"."queue_members" ADD CONSTRAINT "queue_members_pkey" PRIMARY KEY ("queue_id", "user_id");

ALTER TABLE "public"."queues" DROP CONSTRAINT IF EXISTS "queues_pkey";
ALTER TABLE "public"."queues" ADD CONSTRAINT "queues_pkey" PRIMARY KEY ("id");

ALTER TABLE "public"."quotation_audit_log" DROP CONSTRAINT IF EXISTS "quotation_audit_log_pkey";
ALTER TABLE "public"."quotation_audit_log" ADD CONSTRAINT "quotation_audit_log_pkey" PRIMARY KEY ("id");

ALTER TABLE "public"."quotation_packages" DROP CONSTRAINT IF EXISTS "quotation_packages_pkey";
ALTER TABLE "public"."quotation_packages" ADD CONSTRAINT "quotation_packages_pkey" PRIMARY KEY ("id");

ALTER TABLE "public"."quotation_selection_events" DROP CONSTRAINT IF EXISTS "quotation_selection_events_pkey";
ALTER TABLE "public"."quotation_selection_events" ADD CONSTRAINT "quotation_selection_events_pkey" PRIMARY KEY ("id");

ALTER TABLE "public"."quotation_version_option_legs" DROP CONSTRAINT IF EXISTS "quotation_version_option_legs_pkey";
ALTER TABLE "public"."quotation_version_option_legs" ADD CONSTRAINT "quotation_version_option_legs_pkey" PRIMARY KEY ("id");

ALTER TABLE "public"."quotation_version_options" DROP CONSTRAINT IF EXISTS "quotation_version_options_pkey";
ALTER TABLE "public"."quotation_version_options" ADD CONSTRAINT "quotation_version_options_pkey" PRIMARY KEY ("id");

ALTER TABLE "public"."quotation_versions" DROP CONSTRAINT IF EXISTS "quotation_versions_pkey";
ALTER TABLE "public"."quotation_versions" ADD CONSTRAINT "quotation_versions_pkey" PRIMARY KEY ("id");

ALTER TABLE "public"."quote_acceptances" DROP CONSTRAINT IF EXISTS "quote_acceptances_pkey";
ALTER TABLE "public"."quote_acceptances" ADD CONSTRAINT "quote_acceptances_pkey" PRIMARY KEY ("id");

ALTER TABLE "public"."quote_access_logs" DROP CONSTRAINT IF EXISTS "quote_access_logs_pkey";
ALTER TABLE "public"."quote_access_logs" ADD CONSTRAINT "quote_access_logs_pkey" PRIMARY KEY ("id");

ALTER TABLE "public"."quote_charges" DROP CONSTRAINT IF EXISTS "quote_charges_pkey";
ALTER TABLE "public"."quote_charges" ADD CONSTRAINT "quote_charges_pkey" PRIMARY KEY ("id");

ALTER TABLE "public"."quote_comments" DROP CONSTRAINT IF EXISTS "quote_comments_pkey";
ALTER TABLE "public"."quote_comments" ADD CONSTRAINT "quote_comments_pkey" PRIMARY KEY ("id");

ALTER TABLE "public"."quote_documents" DROP CONSTRAINT IF EXISTS "quote_documents_pkey";
ALTER TABLE "public"."quote_documents" ADD CONSTRAINT "quote_documents_pkey" PRIMARY KEY ("id");

ALTER TABLE "public"."quote_email_history" DROP CONSTRAINT IF EXISTS "quote_email_history_pkey";
ALTER TABLE "public"."quote_email_history" ADD CONSTRAINT "quote_email_history_pkey" PRIMARY KEY ("id");

ALTER TABLE "public"."quote_events" DROP CONSTRAINT IF EXISTS "quote_events_pkey";
ALTER TABLE "public"."quote_events" ADD CONSTRAINT "quote_events_pkey" PRIMARY KEY ("id");

ALTER TABLE "public"."quote_items" DROP CONSTRAINT IF EXISTS "quote_items_pkey";
ALTER TABLE "public"."quote_items" ADD CONSTRAINT "quote_items_pkey" PRIMARY KEY ("id");

ALTER TABLE "public"."quote_legs" DROP CONSTRAINT IF EXISTS "quote_legs_pkey";
ALTER TABLE "public"."quote_legs" ADD CONSTRAINT "quote_legs_pkey" PRIMARY KEY ("id");

ALTER TABLE "public"."quote_number_config_franchise" DROP CONSTRAINT IF EXISTS "quote_number_config_franchise_pkey";
ALTER TABLE "public"."quote_number_config_franchise" ADD CONSTRAINT "quote_number_config_franchise_pkey" PRIMARY KEY ("id");

ALTER TABLE "public"."quote_number_config_franchise" DROP CONSTRAINT IF EXISTS "quote_number_config_franchise_tenant_id_franchise_id_key";
ALTER TABLE "public"."quote_number_config_franchise" ADD CONSTRAINT "quote_number_config_franchise_tenant_id_franchise_id_key" UNIQUE ("tenant_id", "franchise_id");

ALTER TABLE "public"."quote_number_config_tenant" DROP CONSTRAINT IF EXISTS "quote_number_config_tenant_pkey";
ALTER TABLE "public"."quote_number_config_tenant" ADD CONSTRAINT "quote_number_config_tenant_pkey" PRIMARY KEY ("id");

ALTER TABLE "public"."quote_number_config_tenant" DROP CONSTRAINT IF EXISTS "quote_number_config_tenant_tenant_id_key";
ALTER TABLE "public"."quote_number_config_tenant" ADD CONSTRAINT "quote_number_config_tenant_tenant_id_key" UNIQUE ("tenant_id");

ALTER TABLE "public"."quote_number_sequences" DROP CONSTRAINT IF EXISTS "quote_number_sequences_pkey";
ALTER TABLE "public"."quote_number_sequences" ADD CONSTRAINT "quote_number_sequences_pkey" PRIMARY KEY ("id");

ALTER TABLE "public"."quote_option_legs" DROP CONSTRAINT IF EXISTS "quote_option_legs_pkey";
ALTER TABLE "public"."quote_option_legs" ADD CONSTRAINT "quote_option_legs_pkey" PRIMARY KEY ("id");

ALTER TABLE "public"."quote_options" DROP CONSTRAINT IF EXISTS "quote_options_pkey";
ALTER TABLE "public"."quote_options" ADD CONSTRAINT "quote_options_pkey" PRIMARY KEY ("id");

ALTER TABLE "public"."quote_presentation_templates" DROP CONSTRAINT IF EXISTS "quote_presentation_templates_pkey";
ALTER TABLE "public"."quote_presentation_templates" ADD CONSTRAINT "quote_presentation_templates_pkey" PRIMARY KEY ("id");

ALTER TABLE "public"."quote_selection" DROP CONSTRAINT IF EXISTS "quote_selection_pkey";
ALTER TABLE "public"."quote_selection" ADD CONSTRAINT "quote_selection_pkey" PRIMARY KEY ("id");

ALTER TABLE "public"."quote_selection" DROP CONSTRAINT IF EXISTS "quote_selection_quote_id_key";
ALTER TABLE "public"."quote_selection" ADD CONSTRAINT "quote_selection_quote_id_key" UNIQUE ("quote_id");

ALTER TABLE "public"."quote_sequences_franchise" DROP CONSTRAINT IF EXISTS "quote_sequences_franchise_pk";
ALTER TABLE "public"."quote_sequences_franchise" ADD CONSTRAINT "quote_sequences_franchise_pk" PRIMARY KEY ("tenant_id", "franchise_id");

ALTER TABLE "public"."quote_sequences_tenant" DROP CONSTRAINT IF EXISTS "quote_sequences_tenant_pkey";
ALTER TABLE "public"."quote_sequences_tenant" ADD CONSTRAINT "quote_sequences_tenant_pkey" PRIMARY KEY ("tenant_id");

ALTER TABLE "public"."quote_shares" DROP CONSTRAINT IF EXISTS "quote_shares_pkey";
ALTER TABLE "public"."quote_shares" ADD CONSTRAINT "quote_shares_pkey" PRIMARY KEY ("id");

ALTER TABLE "public"."quote_shares" DROP CONSTRAINT IF EXISTS "quote_shares_share_token_key";
ALTER TABLE "public"."quote_shares" ADD CONSTRAINT "quote_shares_share_token_key" UNIQUE ("share_token");

ALTER TABLE "public"."quote_templates" DROP CONSTRAINT IF EXISTS "quote_templates_pkey";
ALTER TABLE "public"."quote_templates" ADD CONSTRAINT "quote_templates_pkey" PRIMARY KEY ("id");

ALTER TABLE "public"."quote_versions" DROP CONSTRAINT IF EXISTS "quote_versions_pkey";
ALTER TABLE "public"."quote_versions" ADD CONSTRAINT "quote_versions_pkey" PRIMARY KEY ("id");

ALTER TABLE "public"."quotes" DROP CONSTRAINT IF EXISTS "quotes_pkey";
ALTER TABLE "public"."quotes" ADD CONSTRAINT "quotes_pkey" PRIMARY KEY ("id");

ALTER TABLE "public"."rate_calculations" DROP CONSTRAINT IF EXISTS "rate_calculations_pkey";
ALTER TABLE "public"."rate_calculations" ADD CONSTRAINT "rate_calculations_pkey" PRIMARY KEY ("id");

ALTER TABLE "public"."rate_components" DROP CONSTRAINT IF EXISTS "rate_components_pkey";
ALTER TABLE "public"."rate_components" ADD CONSTRAINT "rate_components_pkey" PRIMARY KEY ("id");

ALTER TABLE "public"."rates" DROP CONSTRAINT IF EXISTS "rates_pkey";
ALTER TABLE "public"."rates" ADD CONSTRAINT "rates_pkey" PRIMARY KEY ("id");

ALTER TABLE "public"."routes" DROP CONSTRAINT IF EXISTS "routes_pkey";
ALTER TABLE "public"."routes" ADD CONSTRAINT "routes_pkey" PRIMARY KEY ("id");

ALTER TABLE "public"."routes" DROP CONSTRAINT IF EXISTS "routes_tenant_id_route_code_key";
ALTER TABLE "public"."routes" ADD CONSTRAINT "routes_tenant_id_route_code_key" UNIQUE ("tenant_id", "route_code");

ALTER TABLE "public"."scheduled_emails" DROP CONSTRAINT IF EXISTS "scheduled_emails_pkey";
ALTER TABLE "public"."scheduled_emails" ADD CONSTRAINT "scheduled_emails_pkey" PRIMARY KEY ("id");

ALTER TABLE "public"."schema_migration_progress" DROP CONSTRAINT IF EXISTS "schema_migration_progress_pkey";
ALTER TABLE "public"."schema_migration_progress" ADD CONSTRAINT "schema_migration_progress_pkey" PRIMARY KEY ("version");

ALTER TABLE "public"."schema_migrations" DROP CONSTRAINT IF EXISTS "schema_migrations_pkey";
ALTER TABLE "public"."schema_migrations" ADD CONSTRAINT "schema_migrations_pkey" PRIMARY KEY ("version");

ALTER TABLE "public"."service_details" DROP CONSTRAINT IF EXISTS "service_details_pkey";
ALTER TABLE "public"."service_details" ADD CONSTRAINT "service_details_pkey" PRIMARY KEY ("id");

ALTER TABLE "public"."service_leg_categories" DROP CONSTRAINT IF EXISTS "service_leg_categories_code_key";
ALTER TABLE "public"."service_leg_categories" ADD CONSTRAINT "service_leg_categories_code_key" UNIQUE ("code");

ALTER TABLE "public"."service_leg_categories" DROP CONSTRAINT IF EXISTS "service_leg_categories_pkey";
ALTER TABLE "public"."service_leg_categories" ADD CONSTRAINT "service_leg_categories_pkey" PRIMARY KEY ("id");

ALTER TABLE "public"."service_modes" DROP CONSTRAINT IF EXISTS "service_modes_pkey";
ALTER TABLE "public"."service_modes" ADD CONSTRAINT "service_modes_pkey" PRIMARY KEY ("id");

ALTER TABLE "public"."service_type_mappings" DROP CONSTRAINT IF EXISTS "service_type_mappings_pkey";
ALTER TABLE "public"."service_type_mappings" ADD CONSTRAINT "service_type_mappings_pkey" PRIMARY KEY ("id");

ALTER TABLE "public"."service_types" DROP CONSTRAINT IF EXISTS "service_types_code_key";
ALTER TABLE "public"."service_types" ADD CONSTRAINT "service_types_code_key" UNIQUE ("code");

ALTER TABLE "public"."service_types" DROP CONSTRAINT IF EXISTS "service_types_name_key";
ALTER TABLE "public"."service_types" ADD CONSTRAINT "service_types_name_key" UNIQUE ("name");

ALTER TABLE "public"."service_types" DROP CONSTRAINT IF EXISTS "service_types_pkey";
ALTER TABLE "public"."service_types" ADD CONSTRAINT "service_types_pkey" PRIMARY KEY ("id");

ALTER TABLE "public"."services" DROP CONSTRAINT IF EXISTS "services_pkey";
ALTER TABLE "public"."services" ADD CONSTRAINT "services_pkey" PRIMARY KEY ("id");

ALTER TABLE "public"."services" DROP CONSTRAINT IF EXISTS "services_tenant_id_service_code_key";
ALTER TABLE "public"."services" ADD CONSTRAINT "services_tenant_id_service_code_key" UNIQUE ("tenant_id", "service_code");

ALTER TABLE "public"."shipment_attachments" DROP CONSTRAINT IF EXISTS "shipment_attachments_pkey";
ALTER TABLE "public"."shipment_attachments" ADD CONSTRAINT "shipment_attachments_pkey" PRIMARY KEY ("id");

ALTER TABLE "public"."shipment_items" DROP CONSTRAINT IF EXISTS "shipment_items_pkey";
ALTER TABLE "public"."shipment_items" ADD CONSTRAINT "shipment_items_pkey" PRIMARY KEY ("id");

ALTER TABLE "public"."shipments" DROP CONSTRAINT IF EXISTS "shipments_pkey";
ALTER TABLE "public"."shipments" ADD CONSTRAINT "shipments_pkey" PRIMARY KEY ("id");

ALTER TABLE "public"."shipments" DROP CONSTRAINT IF EXISTS "shipments_tenant_id_shipment_number_key";
ALTER TABLE "public"."shipments" ADD CONSTRAINT "shipments_tenant_id_shipment_number_key" UNIQUE ("tenant_id", "shipment_number");

ALTER TABLE "public"."shipping_rates" DROP CONSTRAINT IF EXISTS "shipping_rates_pkey";
ALTER TABLE "public"."shipping_rates" ADD CONSTRAINT "shipping_rates_pkey" PRIMARY KEY ("id");

ALTER TABLE "public"."states" DROP CONSTRAINT IF EXISTS "states_country_code_key";
ALTER TABLE "public"."states" ADD CONSTRAINT "states_country_code_key" UNIQUE ("country_id", "code_iso");

ALTER TABLE "public"."states" DROP CONSTRAINT IF EXISTS "states_pkey";
ALTER TABLE "public"."states" ADD CONSTRAINT "states_pkey" PRIMARY KEY ("id");

ALTER TABLE "public"."subscription_features" DROP CONSTRAINT IF EXISTS "subscription_features_feature_key_key";
ALTER TABLE "public"."subscription_features" ADD CONSTRAINT "subscription_features_feature_key_key" UNIQUE ("feature_key");

ALTER TABLE "public"."subscription_features" DROP CONSTRAINT IF EXISTS "subscription_features_pkey";
ALTER TABLE "public"."subscription_features" ADD CONSTRAINT "subscription_features_pkey" PRIMARY KEY ("id");

ALTER TABLE "public"."subscription_invoices" DROP CONSTRAINT IF EXISTS "subscription_invoices_invoice_number_key";
ALTER TABLE "public"."subscription_invoices" ADD CONSTRAINT "subscription_invoices_invoice_number_key" UNIQUE ("invoice_number");

ALTER TABLE "public"."subscription_invoices" DROP CONSTRAINT IF EXISTS "subscription_invoices_pkey";
ALTER TABLE "public"."subscription_invoices" ADD CONSTRAINT "subscription_invoices_pkey" PRIMARY KEY ("id");

ALTER TABLE "public"."subscription_invoices" DROP CONSTRAINT IF EXISTS "subscription_invoices_stripe_invoice_id_key";
ALTER TABLE "public"."subscription_invoices" ADD CONSTRAINT "subscription_invoices_stripe_invoice_id_key" UNIQUE ("stripe_invoice_id");

ALTER TABLE "public"."subscription_plans" DROP CONSTRAINT IF EXISTS "subscription_plans_pkey";
ALTER TABLE "public"."subscription_plans" ADD CONSTRAINT "subscription_plans_pkey" PRIMARY KEY ("id");

ALTER TABLE "public"."subscription_plans" DROP CONSTRAINT IF EXISTS "subscription_plans_slug_key";
ALTER TABLE "public"."subscription_plans" ADD CONSTRAINT "subscription_plans_slug_key" UNIQUE ("slug");

ALTER TABLE "public"."tenant_subscriptions" DROP CONSTRAINT IF EXISTS "tenant_subscriptions_pkey";
ALTER TABLE "public"."tenant_subscriptions" ADD CONSTRAINT "tenant_subscriptions_pkey" PRIMARY KEY ("id");

ALTER TABLE "public"."tenant_subscriptions" DROP CONSTRAINT IF EXISTS "tenant_subscriptions_stripe_subscription_id_key";
ALTER TABLE "public"."tenant_subscriptions" ADD CONSTRAINT "tenant_subscriptions_stripe_subscription_id_key" UNIQUE ("stripe_subscription_id");

ALTER TABLE "public"."tenant_subscriptions" DROP CONSTRAINT IF EXISTS "tenant_subscriptions_tenant_id_plan_id_status_key";
ALTER TABLE "public"."tenant_subscriptions" ADD CONSTRAINT "tenant_subscriptions_tenant_id_plan_id_status_key" UNIQUE ("tenant_id", "plan_id", "status");

ALTER TABLE "public"."tenants" DROP CONSTRAINT IF EXISTS "tenants_name_key";
ALTER TABLE "public"."tenants" ADD CONSTRAINT "tenants_name_key" UNIQUE ("name");

ALTER TABLE "public"."tenants" DROP CONSTRAINT IF EXISTS "tenants_pkey";
ALTER TABLE "public"."tenants" ADD CONSTRAINT "tenants_pkey" PRIMARY KEY ("id");

ALTER TABLE "public"."tenants" DROP CONSTRAINT IF EXISTS "tenants_slug_key";
ALTER TABLE "public"."tenants" ADD CONSTRAINT "tenants_slug_key" UNIQUE ("slug");

ALTER TABLE "public"."tenants" DROP CONSTRAINT IF EXISTS "tenants_stripe_customer_id_key";
ALTER TABLE "public"."tenants" ADD CONSTRAINT "tenants_stripe_customer_id_key" UNIQUE ("stripe_customer_id");

ALTER TABLE "public"."territories" DROP CONSTRAINT IF EXISTS "territories_pkey";
ALTER TABLE "public"."territories" ADD CONSTRAINT "territories_pkey" PRIMARY KEY ("id");

ALTER TABLE "public"."territory_assignments" DROP CONSTRAINT IF EXISTS "territory_assignments_pkey";
ALTER TABLE "public"."territory_assignments" ADD CONSTRAINT "territory_assignments_pkey" PRIMARY KEY ("id");

ALTER TABLE "public"."territory_assignments" DROP CONSTRAINT IF EXISTS "territory_assignments_territory_id_user_id_key";
ALTER TABLE "public"."territory_assignments" ADD CONSTRAINT "territory_assignments_territory_id_user_id_key" UNIQUE ("territory_id", "user_id");

ALTER TABLE "public"."territory_geographies" DROP CONSTRAINT IF EXISTS "territory_geographies_pkey";
ALTER TABLE "public"."territory_geographies" ADD CONSTRAINT "territory_geographies_pkey" PRIMARY KEY ("id");

ALTER TABLE "public"."themes" DROP CONSTRAINT IF EXISTS "themes_pkey";
ALTER TABLE "public"."themes" ADD CONSTRAINT "themes_pkey" PRIMARY KEY ("id");

ALTER TABLE "public"."tracking_events" DROP CONSTRAINT IF EXISTS "tracking_events_pkey";
ALTER TABLE "public"."tracking_events" ADD CONSTRAINT "tracking_events_pkey" PRIMARY KEY ("id");

ALTER TABLE "public"."trade_directions" DROP CONSTRAINT IF EXISTS "trade_directions_pkey";
ALTER TABLE "public"."trade_directions" ADD CONSTRAINT "trade_directions_pkey" PRIMARY KEY ("id");

ALTER TABLE "public"."transport_modes" DROP CONSTRAINT IF EXISTS "transport_modes_code_key";
ALTER TABLE "public"."transport_modes" ADD CONSTRAINT "transport_modes_code_key" UNIQUE ("code");

ALTER TABLE "public"."transport_modes" DROP CONSTRAINT IF EXISTS "transport_modes_pkey";
ALTER TABLE "public"."transport_modes" ADD CONSTRAINT "transport_modes_pkey" PRIMARY KEY ("id");

ALTER TABLE "public"."ui_themes" DROP CONSTRAINT IF EXISTS "ui_themes_pkey";
ALTER TABLE "public"."ui_themes" ADD CONSTRAINT "ui_themes_pkey" PRIMARY KEY ("id");

ALTER TABLE "public"."charge_tier_config" DROP CONSTRAINT IF EXISTS "unique_tier_config_name";
ALTER TABLE "public"."charge_tier_config" ADD CONSTRAINT "unique_tier_config_name" UNIQUE ("tenant_id", "name");

ALTER TABLE "public"."quotation_versions" DROP CONSTRAINT IF EXISTS "uq_quote_major_minor";
ALTER TABLE "public"."quotation_versions" ADD CONSTRAINT "uq_quote_major_minor" UNIQUE ("quote_id", "major", "minor");

ALTER TABLE "public"."quotation_versions" DROP CONSTRAINT IF EXISTS "uq_quote_version_number";
ALTER TABLE "public"."quotation_versions" ADD CONSTRAINT "uq_quote_version_number" UNIQUE ("quote_id", "version_number");

ALTER TABLE "public"."usage_records" DROP CONSTRAINT IF EXISTS "usage_records_pkey";
ALTER TABLE "public"."usage_records" ADD CONSTRAINT "usage_records_pkey" PRIMARY KEY ("id");

ALTER TABLE "public"."user_capacity" DROP CONSTRAINT IF EXISTS "user_capacity_pkey";
ALTER TABLE "public"."user_capacity" ADD CONSTRAINT "user_capacity_pkey" PRIMARY KEY ("id");

ALTER TABLE "public"."user_capacity" DROP CONSTRAINT IF EXISTS "user_capacity_user_id_tenant_id_key";
ALTER TABLE "public"."user_capacity" ADD CONSTRAINT "user_capacity_user_id_tenant_id_key" UNIQUE ("user_id", "tenant_id");

ALTER TABLE "public"."user_custom_roles" DROP CONSTRAINT IF EXISTS "user_custom_roles_pkey";
ALTER TABLE "public"."user_custom_roles" ADD CONSTRAINT "user_custom_roles_pkey" PRIMARY KEY ("id");

ALTER TABLE "public"."user_custom_roles" DROP CONSTRAINT IF EXISTS "user_custom_roles_user_id_role_id_key";
ALTER TABLE "public"."user_custom_roles" ADD CONSTRAINT "user_custom_roles_user_id_role_id_key" UNIQUE ("user_id", "role_id");

ALTER TABLE "public"."user_preferences" DROP CONSTRAINT IF EXISTS "user_preferences_pkey";
ALTER TABLE "public"."user_preferences" ADD CONSTRAINT "user_preferences_pkey" PRIMARY KEY ("id");

ALTER TABLE "public"."user_preferences" DROP CONSTRAINT IF EXISTS "user_preferences_user_id_key";
ALTER TABLE "public"."user_preferences" ADD CONSTRAINT "user_preferences_user_id_key" UNIQUE ("user_id");

ALTER TABLE "public"."user_roles" DROP CONSTRAINT IF EXISTS "user_roles_pkey";
ALTER TABLE "public"."user_roles" ADD CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id");

ALTER TABLE "public"."user_roles" DROP CONSTRAINT IF EXISTS "user_roles_user_id_role_tenant_id_franchise_id_key";
ALTER TABLE "public"."user_roles" ADD CONSTRAINT "user_roles_user_id_role_tenant_id_franchise_id_key" UNIQUE ("user_id", "role", "tenant_id", "franchise_id");

ALTER TABLE "public"."user_roles" DROP CONSTRAINT IF EXISTS "user_roles_user_role_unique";
ALTER TABLE "public"."user_roles" ADD CONSTRAINT "user_roles_user_role_unique" UNIQUE ("user_id", "role");

ALTER TABLE "public"."vehicles" DROP CONSTRAINT IF EXISTS "vehicles_pkey";
ALTER TABLE "public"."vehicles" ADD CONSTRAINT "vehicles_pkey" PRIMARY KEY ("id");

ALTER TABLE "public"."vehicles" DROP CONSTRAINT IF EXISTS "vehicles_tenant_id_vehicle_number_key";
ALTER TABLE "public"."vehicles" ADD CONSTRAINT "vehicles_tenant_id_vehicle_number_key" UNIQUE ("tenant_id", "vehicle_number");

ALTER TABLE "public"."warehouse_inventory" DROP CONSTRAINT IF EXISTS "warehouse_inventory_pkey";
ALTER TABLE "public"."warehouse_inventory" ADD CONSTRAINT "warehouse_inventory_pkey" PRIMARY KEY ("id");

ALTER TABLE "public"."warehouses" DROP CONSTRAINT IF EXISTS "warehouses_pkey";
ALTER TABLE "public"."warehouses" ADD CONSTRAINT "warehouses_pkey" PRIMARY KEY ("id");

ALTER TABLE "public"."warehouses" DROP CONSTRAINT IF EXISTS "warehouses_tenant_id_code_key";
ALTER TABLE "public"."warehouses" ADD CONSTRAINT "warehouses_tenant_id_code_key" UNIQUE ("tenant_id", "code");

CREATE UNIQUE INDEX IF NOT EXISTS "carriers_tenant_code_unique" ON "public"."carriers" USING "btree" ("tenant_id", "carrier_code") WHERE ("carrier_code" IS NOT NULL);

CREATE UNIQUE INDEX IF NOT EXISTS "carriers_tenant_name_unique" ON "public"."carriers" USING "btree" ("tenant_id", "lower"("carrier_name"));

CREATE UNIQUE INDEX IF NOT EXISTS "cities_country_state_name_unique" ON "public"."cities" USING "btree" ("country_id", "state_id", "name");

CREATE INDEX IF NOT EXISTS "fx_rates_idx" ON "public"."fx_rates" USING "btree" ("tenant_id", "from_currency_id", "to_currency_id", "effective_date");

CREATE INDEX IF NOT EXISTS "idx_accounts_account_number" ON "public"."accounts" USING "btree" ("account_number");

CREATE INDEX IF NOT EXISTS "idx_accounts_duns_number" ON "public"."accounts" USING "btree" ("duns_number");

CREATE INDEX IF NOT EXISTS "idx_accounts_franchise_id" ON "public"."accounts" USING "btree" ("franchise_id");

CREATE INDEX IF NOT EXISTS "idx_accounts_owner_id" ON "public"."accounts" USING "btree" ("owner_id");

CREATE INDEX IF NOT EXISTS "idx_accounts_parent_account_id" ON "public"."accounts" USING "btree" ("parent_account_id");

CREATE INDEX IF NOT EXISTS "idx_accounts_parent_id" ON "public"."accounts" USING "btree" ("parent_account_id");

CREATE INDEX IF NOT EXISTS "idx_accounts_sic_code" ON "public"."accounts" USING "btree" ("sic_code");

CREATE INDEX IF NOT EXISTS "idx_accounts_status" ON "public"."accounts" USING "btree" ("status");

CREATE INDEX IF NOT EXISTS "idx_accounts_tenant_id" ON "public"."accounts" USING "btree" ("tenant_id");

CREATE INDEX IF NOT EXISTS "idx_accounts_tenant_parent" ON "public"."accounts" USING "btree" ("tenant_id", "parent_account_id");

CREATE UNIQUE INDEX IF NOT EXISTS "idx_active_version_per_quote" ON "public"."quotation_versions" USING "btree" ("quote_id") WHERE ("is_active" = true);

CREATE INDEX IF NOT EXISTS "idx_activities_account_id" ON "public"."activities" USING "btree" ("account_id");

CREATE INDEX IF NOT EXISTS "idx_activities_assigned_to" ON "public"."activities" USING "btree" ("assigned_to");

CREATE INDEX IF NOT EXISTS "idx_activities_contact_id" ON "public"."activities" USING "btree" ("contact_id");

CREATE INDEX IF NOT EXISTS "idx_activities_custom_fields" ON "public"."activities" USING "gin" ("custom_fields");

CREATE INDEX IF NOT EXISTS "idx_activities_due_date" ON "public"."activities" USING "btree" ("due_date");

CREATE INDEX IF NOT EXISTS "idx_activities_franchise_id" ON "public"."activities" USING "btree" ("franchise_id");

CREATE INDEX IF NOT EXISTS "idx_activities_lead_id" ON "public"."activities" USING "btree" ("lead_id");

CREATE INDEX IF NOT EXISTS "idx_activities_opportunity_id" ON "public"."activities" USING "btree" ("opportunity_id");

CREATE INDEX IF NOT EXISTS "idx_activities_status" ON "public"."activities" USING "btree" ("status");

CREATE INDEX IF NOT EXISTS "idx_activities_tenant_id" ON "public"."activities" USING "btree" ("tenant_id");

CREATE INDEX IF NOT EXISTS "idx_aes_hts_codes_category" ON "public"."aes_hts_codes" USING "btree" ("category");

CREATE INDEX IF NOT EXISTS "idx_aes_hts_codes_description_tsv" ON "public"."aes_hts_codes" USING "gin" ("to_tsvector"('"english"'::"regconfig", "description"));

CREATE INDEX IF NOT EXISTS "idx_aes_hts_codes_hts_code" ON "public"."aes_hts_codes" USING "btree" ("hts_code");

CREATE INDEX IF NOT EXISTS "idx_assignment_history_assigned_to" ON "public"."lead_assignment_history" USING "btree" ("assigned_to");

CREATE INDEX IF NOT EXISTS "idx_assignment_history_lead" ON "public"."lead_assignment_history" USING "btree" ("lead_id");

CREATE INDEX IF NOT EXISTS "idx_assignment_queue_status" ON "public"."lead_assignment_queue" USING "btree" ("status");

CREATE INDEX IF NOT EXISTS "idx_audit_created_at" ON "public"."quotation_audit_log" USING "btree" ("created_at" DESC);

CREATE INDEX IF NOT EXISTS "idx_audit_logs_created_at" ON "public"."audit_logs" USING "btree" ("created_at" DESC);

CREATE INDEX IF NOT EXISTS "idx_audit_logs_resource_type" ON "public"."audit_logs" USING "btree" ("resource_type");

CREATE INDEX IF NOT EXISTS "idx_audit_logs_user_id" ON "public"."audit_logs" USING "btree" ("user_id");

CREATE INDEX IF NOT EXISTS "idx_audit_quote_id" ON "public"."quotation_audit_log" USING "btree" ("quote_id");

CREATE INDEX IF NOT EXISTS "idx_audit_version_id" ON "public"."quotation_audit_log" USING "btree" ("quotation_version_id");

CREATE INDEX IF NOT EXISTS "idx_auth_role_permissions_role" ON "public"."auth_role_permissions" USING "btree" ("role_id");

CREATE INDEX IF NOT EXISTS "idx_cargo_details_active" ON "public"."cargo_details" USING "btree" ("is_active") WHERE ("is_active" = true);

CREATE INDEX IF NOT EXISTS "idx_cargo_details_service" ON "public"."cargo_details" USING "btree" ("service_id");

CREATE INDEX IF NOT EXISTS "idx_cargo_details_tenant" ON "public"."cargo_details" USING "btree" ("tenant_id");

CREATE INDEX IF NOT EXISTS "idx_cargo_details_type" ON "public"."cargo_details" USING "btree" ("service_type");

CREATE INDEX IF NOT EXISTS "idx_carrier_rate_charges_rate" ON "public"."carrier_rate_charges" USING "btree" ("carrier_rate_id");

CREATE INDEX IF NOT EXISTS "idx_carrier_rate_charges_rate_id" ON "public"."carrier_rate_charges" USING "btree" ("carrier_rate_id");

CREATE INDEX IF NOT EXISTS "idx_carrier_rates_carrier" ON "public"."carrier_rates" USING "btree" ("carrier_id");

CREATE INDEX IF NOT EXISTS "idx_carrier_rates_carrier_id" ON "public"."carrier_rates" USING "btree" ("carrier_id");

CREATE INDEX IF NOT EXISTS "idx_carrier_rates_dates" ON "public"."carrier_rates" USING "btree" ("valid_from", "valid_until");

CREATE INDEX IF NOT EXISTS "idx_carrier_rates_destination_port" ON "public"."carrier_rates" USING "btree" ("destination_port_id");

CREATE INDEX IF NOT EXISTS "idx_carrier_rates_origin_port" ON "public"."carrier_rates" USING "btree" ("origin_port_id");

CREATE INDEX IF NOT EXISTS "idx_carrier_rates_reference" ON "public"."carrier_rates" USING "btree" ("rate_reference_id");

CREATE INDEX IF NOT EXISTS "idx_carrier_rates_route" ON "public"."carrier_rates" USING "btree" ("origin_port_id", "destination_port_id");

CREATE INDEX IF NOT EXISTS "idx_carrier_rates_service" ON "public"."carrier_rates" USING "btree" ("service_id");

CREATE INDEX IF NOT EXISTS "idx_carrier_rates_tenant" ON "public"."carrier_rates" USING "btree" ("tenant_id");

CREATE INDEX IF NOT EXISTS "idx_carriers_tenant" ON "public"."carriers" USING "btree" ("tenant_id");

CREATE INDEX IF NOT EXISTS "idx_charge_tier_config_basis" ON "public"."charge_tier_config" USING "btree" ("basis_id");

CREATE INDEX IF NOT EXISTS "idx_charge_tier_config_carrier" ON "public"."charge_tier_config" USING "btree" ("carrier_id");

CREATE INDEX IF NOT EXISTS "idx_charge_tier_config_category" ON "public"."charge_tier_config" USING "btree" ("category_id");

CREATE INDEX IF NOT EXISTS "idx_charge_tier_config_service_type" ON "public"."charge_tier_config" USING "btree" ("service_type_id");

CREATE INDEX IF NOT EXISTS "idx_charge_tier_config_tenant" ON "public"."charge_tier_config" USING "btree" ("tenant_id");

CREATE INDEX IF NOT EXISTS "idx_charge_tier_ranges_config" ON "public"."charge_tier_ranges" USING "btree" ("tier_config_id");

CREATE INDEX IF NOT EXISTS "idx_charge_tier_ranges_values" ON "public"."charge_tier_ranges" USING "btree" ("min_value", "max_value");

CREATE INDEX IF NOT EXISTS "idx_charge_weight_breaks_carrier" ON "public"."charge_weight_breaks" USING "btree" ("carrier_id");

CREATE INDEX IF NOT EXISTS "idx_charge_weight_breaks_dates" ON "public"."charge_weight_breaks" USING "btree" ("effective_from", "effective_until");

CREATE INDEX IF NOT EXISTS "idx_charge_weight_breaks_service_type" ON "public"."charge_weight_breaks" USING "btree" ("service_type_id");

CREATE INDEX IF NOT EXISTS "idx_charge_weight_breaks_tenant" ON "public"."charge_weight_breaks" USING "btree" ("tenant_id");

CREATE INDEX IF NOT EXISTS "idx_charge_weight_breaks_weight" ON "public"."charge_weight_breaks" USING "btree" ("min_weight_kg", "max_weight_kg");

CREATE INDEX IF NOT EXISTS "idx_cities_state_country" ON "public"."cities" USING "btree" ("state_id", "country_id");

CREATE INDEX IF NOT EXISTS "idx_compliance_checks_quote" ON "public"."compliance_checks" USING "btree" ("quote_id");

CREATE INDEX IF NOT EXISTS "idx_consignees_tenant" ON "public"."consignees" USING "btree" ("tenant_id");

CREATE INDEX IF NOT EXISTS "idx_contacts_account_id" ON "public"."contacts" USING "btree" ("account_id");

CREATE INDEX IF NOT EXISTS "idx_contacts_franchise_id" ON "public"."contacts" USING "btree" ("franchise_id");

CREATE INDEX IF NOT EXISTS "idx_contacts_owner_id" ON "public"."contacts" USING "btree" ("owner_id");

CREATE INDEX IF NOT EXISTS "idx_contacts_tenant_id" ON "public"."contacts" USING "btree" ("tenant_id");

CREATE INDEX IF NOT EXISTS "idx_countries_continent" ON "public"."countries" USING "btree" ("continent_id");

CREATE INDEX IF NOT EXISTS "idx_cst_active" ON "public"."carrier_service_types" USING "btree" ("is_active");

CREATE INDEX IF NOT EXISTS "idx_cst_tenant" ON "public"."carrier_service_types" USING "btree" ("tenant_id");

CREATE INDEX IF NOT EXISTS "idx_cst_tenant_type" ON "public"."carrier_service_types" USING "btree" ("tenant_id", "service_type");

CREATE INDEX IF NOT EXISTS "idx_customer_selections_quote_id" ON "public"."customer_selections" USING "btree" ("quote_id");

CREATE INDEX IF NOT EXISTS "idx_dashboard_preferences_user_id" ON "public"."dashboard_preferences" USING "btree" ("user_id");

CREATE UNIQUE INDEX IF NOT EXISTS "idx_documents_path_unique" ON "public"."documents" USING "btree" ("path");

CREATE INDEX IF NOT EXISTS "idx_email_accounts_franchise_id" ON "public"."email_accounts" USING "btree" ("franchise_id");

CREATE INDEX IF NOT EXISTS "idx_email_accounts_tenant_id" ON "public"."email_accounts" USING "btree" ("tenant_id");

CREATE INDEX IF NOT EXISTS "idx_email_accounts_user_id" ON "public"."email_accounts" USING "btree" ("user_id");

CREATE INDEX IF NOT EXISTS "idx_email_audit_log_created_at" ON "public"."email_audit_log" USING "btree" ("created_at");

CREATE INDEX IF NOT EXISTS "idx_email_audit_log_email_id" ON "public"."email_audit_log" USING "btree" ("email_id");

CREATE INDEX IF NOT EXISTS "idx_email_audit_log_event_type" ON "public"."email_audit_log" USING "btree" ("event_type");

CREATE INDEX IF NOT EXISTS "idx_email_audit_log_tenant_id" ON "public"."email_audit_log" USING "btree" ("tenant_id");

CREATE INDEX IF NOT EXISTS "idx_email_delegations_account_id" ON "public"."email_account_delegations" USING "btree" ("account_id");

CREATE INDEX IF NOT EXISTS "idx_email_delegations_delegate_user_id" ON "public"."email_account_delegations" USING "btree" ("delegate_user_id");

CREATE INDEX IF NOT EXISTS "idx_email_delegations_is_active" ON "public"."email_account_delegations" USING "btree" ("is_active");

CREATE INDEX IF NOT EXISTS "idx_email_filters_account_id" ON "public"."email_filters" USING "btree" ("account_id");

CREATE INDEX IF NOT EXISTS "idx_email_filters_priority" ON "public"."email_filters" USING "btree" ("priority" DESC);

CREATE INDEX IF NOT EXISTS "idx_email_filters_user_id" ON "public"."email_filters" USING "btree" ("user_id");

CREATE INDEX IF NOT EXISTS "idx_email_templates_franchise_id" ON "public"."email_templates" USING "btree" ("franchise_id");

CREATE INDEX IF NOT EXISTS "idx_email_templates_tenant_id" ON "public"."email_templates" USING "btree" ("tenant_id");

CREATE INDEX IF NOT EXISTS "idx_emails_account_id" ON "public"."emails" USING "btree" ("account_id");

CREATE INDEX IF NOT EXISTS "idx_emails_bcc_emails_gin" ON "public"."emails" USING "gin" ("bcc_emails" "jsonb_path_ops");

CREATE INDEX IF NOT EXISTS "idx_emails_cc_emails_gin" ON "public"."emails" USING "gin" ("cc_emails" "jsonb_path_ops");

CREATE INDEX IF NOT EXISTS "idx_emails_contact_id" ON "public"."emails" USING "btree" ("contact_id");

CREATE INDEX IF NOT EXISTS "idx_emails_conversation_id" ON "public"."emails" USING "btree" ("conversation_id");

CREATE INDEX IF NOT EXISTS "idx_emails_direction" ON "public"."emails" USING "btree" ("direction");

CREATE INDEX IF NOT EXISTS "idx_emails_folder" ON "public"."emails" USING "btree" ("folder");

CREATE INDEX IF NOT EXISTS "idx_emails_franchise_id" ON "public"."emails" USING "btree" ("franchise_id");

CREATE INDEX IF NOT EXISTS "idx_emails_from_email_lower" ON "public"."emails" USING "btree" ("lower"("from_email"));

CREATE INDEX IF NOT EXISTS "idx_emails_in_reply_to" ON "public"."emails" USING "btree" ("in_reply_to");

CREATE INDEX IF NOT EXISTS "idx_emails_internet_message_id" ON "public"."emails" USING "btree" ("internet_message_id");

CREATE INDEX IF NOT EXISTS "idx_emails_lead_id" ON "public"."emails" USING "btree" ("lead_id");

CREATE INDEX IF NOT EXISTS "idx_emails_message_id" ON "public"."emails" USING "btree" ("message_id");

CREATE INDEX IF NOT EXISTS "idx_emails_received_at" ON "public"."emails" USING "btree" ("received_at" DESC);

CREATE INDEX IF NOT EXISTS "idx_emails_sync_error" ON "public"."emails" USING "btree" ("sync_error") WHERE ("sync_error" IS NOT NULL);

CREATE INDEX IF NOT EXISTS "idx_emails_tenant_id" ON "public"."emails" USING "btree" ("tenant_id");

CREATE INDEX IF NOT EXISTS "idx_emails_thread_id" ON "public"."emails" USING "btree" ("thread_id");

CREATE INDEX IF NOT EXISTS "idx_emails_to_emails_gin" ON "public"."emails" USING "gin" ("to_emails" "jsonb_path_ops");

CREATE INDEX IF NOT EXISTS "idx_emails_user_id" ON "public"."emails" USING "btree" ("user_id");

CREATE INDEX IF NOT EXISTS "idx_franchises_tenant_id" ON "public"."franchises" USING "btree" ("tenant_id");

CREATE INDEX IF NOT EXISTS "idx_history_filter_presets_tenant" ON "public"."history_filter_presets" USING "btree" ("tenant_id");

CREATE INDEX IF NOT EXISTS "idx_history_filter_presets_user" ON "public"."history_filter_presets" USING "btree" ("user_id");

CREATE INDEX IF NOT EXISTS "idx_import_errors_import_id" ON "public"."import_errors" USING "btree" ("import_id");

CREATE INDEX IF NOT EXISTS "idx_import_history_details_import" ON "public"."import_history_details" USING "btree" ("import_id");

CREATE INDEX IF NOT EXISTS "idx_import_history_details_import_id" ON "public"."import_history_details" USING "btree" ("import_id");

CREATE INDEX IF NOT EXISTS "idx_import_history_table" ON "public"."import_history" USING "btree" ("table_name");

CREATE INDEX IF NOT EXISTS "idx_import_history_tenant" ON "public"."import_history" USING "btree" ("tenant_id");

CREATE INDEX IF NOT EXISTS "idx_invitations_email" ON "public"."invitations" USING "btree" ("email");

CREATE INDEX IF NOT EXISTS "idx_invitations_token" ON "public"."invitations" USING "btree" ("token");

CREATE INDEX IF NOT EXISTS "idx_lead_activities_created_at" ON "public"."lead_activities" USING "btree" ("created_at");

CREATE INDEX IF NOT EXISTS "idx_lead_activities_lead" ON "public"."lead_activities" USING "btree" ("lead_id");

CREATE INDEX IF NOT EXISTS "idx_lead_activities_lead_id" ON "public"."lead_activities" USING "btree" ("lead_id");

CREATE INDEX IF NOT EXISTS "idx_lead_score_logs_lead" ON "public"."lead_score_logs" USING "btree" ("lead_id");

CREATE INDEX IF NOT EXISTS "idx_lead_score_logs_lead_id" ON "public"."lead_score_logs" USING "btree" ("lead_id");

CREATE INDEX IF NOT EXISTS "idx_leads_custom_fields" ON "public"."leads" USING "gin" ("custom_fields");

CREATE INDEX IF NOT EXISTS "idx_leads_franchise_id" ON "public"."leads" USING "btree" ("franchise_id");

CREATE INDEX IF NOT EXISTS "idx_leads_owner_id" ON "public"."leads" USING "btree" ("owner_id");

CREATE INDEX IF NOT EXISTS "idx_leads_status" ON "public"."leads" USING "btree" ("status");

CREATE INDEX IF NOT EXISTS "idx_leads_tenant_id" ON "public"."leads" USING "btree" ("tenant_id");

CREATE INDEX IF NOT EXISTS "idx_oauth_configurations_user_provider" ON "public"."oauth_configurations" USING "btree" ("user_id", "provider");

CREATE INDEX IF NOT EXISTS "idx_opportunities_account" ON "public"."opportunities" USING "btree" ("account_id");

CREATE INDEX IF NOT EXISTS "idx_opportunities_close_date" ON "public"."opportunities" USING "btree" ("close_date");

CREATE INDEX IF NOT EXISTS "idx_opportunities_contact" ON "public"."opportunities" USING "btree" ("contact_id");

CREATE INDEX IF NOT EXISTS "idx_opportunities_franchise" ON "public"."opportunities" USING "btree" ("franchise_id");

CREATE INDEX IF NOT EXISTS "idx_opportunities_owner" ON "public"."opportunities" USING "btree" ("owner_id");

CREATE INDEX IF NOT EXISTS "idx_opportunities_salesforce_id" ON "public"."opportunities" USING "btree" ("salesforce_opportunity_id");

CREATE INDEX IF NOT EXISTS "idx_opportunities_stage" ON "public"."opportunities" USING "btree" ("stage");

CREATE INDEX IF NOT EXISTS "idx_opportunities_tenant" ON "public"."opportunities" USING "btree" ("tenant_id");

CREATE INDEX IF NOT EXISTS "idx_opportunity_items_opportunity_id" ON "public"."opportunity_items" USING "btree" ("opportunity_id");

CREATE INDEX IF NOT EXISTS "idx_opportunity_probability_history_opportunity_id" ON "public"."opportunity_probability_history" USING "btree" ("opportunity_id");

CREATE INDEX IF NOT EXISTS "idx_portal_tokens_quote" ON "public"."portal_tokens" USING "btree" ("quote_id");

CREATE INDEX IF NOT EXISTS "idx_portal_tokens_token" ON "public"."portal_tokens" USING "btree" ("token");

CREATE INDEX IF NOT EXISTS "idx_ports_tenant" ON "public"."ports_locations" USING "btree" ("tenant_id");

CREATE INDEX IF NOT EXISTS "idx_provider_api_configs_active" ON "public"."provider_api_configs" USING "btree" ("is_active");

CREATE INDEX IF NOT EXISTS "idx_provider_api_configs_carrier" ON "public"."provider_api_configs" USING "btree" ("carrier_id");

CREATE INDEX IF NOT EXISTS "idx_provider_charge_mappings_active" ON "public"."provider_charge_mappings" USING "btree" ("is_active");

CREATE INDEX IF NOT EXISTS "idx_provider_charge_mappings_carrier" ON "public"."provider_charge_mappings" USING "btree" ("carrier_id");

CREATE INDEX IF NOT EXISTS "idx_provider_charge_mappings_category" ON "public"."provider_charge_mappings" USING "btree" ("charge_category_id");

CREATE INDEX IF NOT EXISTS "idx_provider_rate_rules_active" ON "public"."provider_rate_rules" USING "btree" ("is_active");

CREATE INDEX IF NOT EXISTS "idx_provider_rate_rules_carrier" ON "public"."provider_rate_rules" USING "btree" ("carrier_id");

CREATE INDEX IF NOT EXISTS "idx_provider_rate_rules_priority" ON "public"."provider_rate_rules" USING "btree" ("priority");

CREATE INDEX IF NOT EXISTS "idx_provider_rate_rules_service_type" ON "public"."provider_rate_rules" USING "btree" ("service_type_id");

CREATE INDEX IF NOT EXISTS "idx_provider_rate_templates_active" ON "public"."provider_rate_templates" USING "btree" ("is_active");

CREATE INDEX IF NOT EXISTS "idx_provider_rate_templates_carrier" ON "public"."provider_rate_templates" USING "btree" ("carrier_id");

CREATE INDEX IF NOT EXISTS "idx_provider_rate_templates_service_type" ON "public"."provider_rate_templates" USING "btree" ("service_type_id");

CREATE INDEX IF NOT EXISTS "idx_provider_surcharges_active" ON "public"."provider_surcharges" USING "btree" ("is_active");

CREATE INDEX IF NOT EXISTS "idx_provider_surcharges_carrier" ON "public"."provider_surcharges" USING "btree" ("carrier_id");

CREATE INDEX IF NOT EXISTS "idx_qc_q" ON "public"."quote_comments" USING "btree" ("quote_id");

CREATE INDEX IF NOT EXISTS "idx_qd_q" ON "public"."quote_documents" USING "btree" ("quote_id");

CREATE INDEX IF NOT EXISTS "idx_qpt_t" ON "public"."quote_presentation_templates" USING "btree" ("tenant_id");

CREATE INDEX IF NOT EXISTS "idx_qs_q" ON "public"."quote_shares" USING "btree" ("quote_id");

CREATE INDEX IF NOT EXISTS "idx_queue_members_queue_id" ON "public"."queue_members" USING "btree" ("queue_id");

CREATE INDEX IF NOT EXISTS "idx_queue_members_user_id" ON "public"."queue_members" USING "btree" ("user_id");

CREATE INDEX IF NOT EXISTS "idx_queues_tenant_id" ON "public"."queues" USING "btree" ("tenant_id");

CREATE INDEX IF NOT EXISTS "idx_quotation_packages_quote_id" ON "public"."quotation_packages" USING "btree" ("quote_id");

CREATE INDEX IF NOT EXISTS "idx_quotation_packages_tenant_id" ON "public"."quotation_packages" USING "btree" ("tenant_id");

CREATE INDEX IF NOT EXISTS "idx_quotation_version_option_legs_franchise" ON "public"."quotation_version_option_legs" USING "btree" ("franchise_id");

CREATE INDEX IF NOT EXISTS "idx_quotation_version_option_legs_leg_type" ON "public"."quotation_version_option_legs" USING "btree" ("leg_type");

CREATE INDEX IF NOT EXISTS "idx_quotation_version_option_legs_option_id" ON "public"."quotation_version_option_legs" USING "btree" ("quotation_version_option_id");

CREATE INDEX IF NOT EXISTS "idx_quotation_version_options_franchise" ON "public"."quotation_version_options" USING "btree" ("franchise_id");

CREATE INDEX IF NOT EXISTS "idx_quotation_version_options_version_id" ON "public"."quotation_version_options" USING "btree" ("quotation_version_id");

CREATE INDEX IF NOT EXISTS "idx_quotation_versions_current" ON "public"."quotation_versions" USING "btree" ("quote_id", "is_current") WHERE ("is_current" = true);

CREATE INDEX IF NOT EXISTS "idx_quotation_versions_franchise" ON "public"."quotation_versions" USING "btree" ("franchise_id");

CREATE INDEX IF NOT EXISTS "idx_quotation_versions_quote_id" ON "public"."quotation_versions" USING "btree" ("quote_id");

CREATE INDEX IF NOT EXISTS "idx_quotation_versions_version_number" ON "public"."quotation_versions" USING "btree" ("quote_id", "version_number" DESC);

CREATE INDEX IF NOT EXISTS "idx_quote_acceptances_quote" ON "public"."quote_acceptances" USING "btree" ("quote_id");

CREATE INDEX IF NOT EXISTS "idx_quote_acceptances_token" ON "public"."quote_acceptances" USING "btree" ("token_id");

CREATE INDEX IF NOT EXISTS "idx_quote_charges_franchise" ON "public"."quote_charges" USING "btree" ("franchise_id");

CREATE INDEX IF NOT EXISTS "idx_quote_charges_leg_id" ON "public"."quote_charges" USING "btree" ("leg_id");

CREATE INDEX IF NOT EXISTS "idx_quote_charges_quote_option_id" ON "public"."quote_charges" USING "btree" ("quote_option_id");

CREATE INDEX IF NOT EXISTS "idx_quote_items_quote_id" ON "public"."quote_items" USING "btree" ("quote_id");

CREATE INDEX IF NOT EXISTS "idx_quote_legs_option" ON "public"."quote_legs" USING "btree" ("quote_option_id");

CREATE INDEX IF NOT EXISTS "idx_quote_legs_service_type" ON "public"."quote_legs" USING "btree" ("service_type_id");

CREATE INDEX IF NOT EXISTS "idx_quote_legs_tenant" ON "public"."quote_legs" USING "btree" ("tenant_id");

CREATE INDEX IF NOT EXISTS "idx_quote_templates_category" ON "public"."quote_templates" USING "btree" ("category");

CREATE INDEX IF NOT EXISTS "idx_quote_templates_is_active" ON "public"."quote_templates" USING "btree" ("is_active");

CREATE INDEX IF NOT EXISTS "idx_quote_templates_tenant" ON "public"."quote_templates" USING "btree" ("tenant_id");

CREATE INDEX IF NOT EXISTS "idx_quote_templates_tenant_id" ON "public"."quote_templates" USING "btree" ("tenant_id");

CREATE INDEX IF NOT EXISTS "idx_quotes_account_id" ON "public"."quotes" USING "btree" ("account_id");

CREATE INDEX IF NOT EXISTS "idx_quotes_carrier" ON "public"."quotes" USING "btree" ("carrier_id");

CREATE INDEX IF NOT EXISTS "idx_quotes_consignee" ON "public"."quotes" USING "btree" ("consignee_id");

CREATE INDEX IF NOT EXISTS "idx_quotes_current_version" ON "public"."quotes" USING "btree" ("current_version_id") WHERE ("current_version_id" IS NOT NULL);

CREATE INDEX IF NOT EXISTS "idx_quotes_destination_port" ON "public"."quotes" USING "btree" ("destination_port_id");

CREATE INDEX IF NOT EXISTS "idx_quotes_franchise_id" ON "public"."quotes" USING "btree" ("franchise_id");

CREATE INDEX IF NOT EXISTS "idx_quotes_opportunity_id" ON "public"."quotes" USING "btree" ("opportunity_id");

CREATE INDEX IF NOT EXISTS "idx_quotes_origin_port" ON "public"."quotes" USING "btree" ("origin_port_id");

CREATE INDEX IF NOT EXISTS "idx_quotes_quote_number" ON "public"."quotes" USING "btree" ("quote_number");

CREATE INDEX IF NOT EXISTS "idx_quotes_tenant_id" ON "public"."quotes" USING "btree" ("tenant_id");

CREATE INDEX IF NOT EXISTS "idx_qvo_version" ON "public"."quotation_version_options" USING "btree" ("quotation_version_id");

CREATE INDEX IF NOT EXISTS "idx_rate_calculations_quote" ON "public"."rate_calculations" USING "btree" ("quote_id");

CREATE INDEX IF NOT EXISTS "idx_scheduled_emails_scheduled_at" ON "public"."scheduled_emails" USING "btree" ("scheduled_at");

CREATE INDEX IF NOT EXISTS "idx_scheduled_emails_status" ON "public"."scheduled_emails" USING "btree" ("status");

CREATE INDEX IF NOT EXISTS "idx_scheduled_emails_tenant_id" ON "public"."scheduled_emails" USING "btree" ("tenant_id");

CREATE INDEX IF NOT EXISTS "idx_scheduled_emails_user_id" ON "public"."scheduled_emails" USING "btree" ("user_id");

CREATE INDEX IF NOT EXISTS "idx_service_type_mappings_service_id" ON "public"."service_type_mappings" USING "btree" ("service_id");

CREATE INDEX IF NOT EXISTS "idx_service_type_mappings_tenant_id" ON "public"."service_type_mappings" USING "btree" ("tenant_id");

CREATE INDEX IF NOT EXISTS "idx_service_types_active" ON "public"."service_types" USING "btree" ("is_active");

CREATE INDEX IF NOT EXISTS "idx_service_types_mode_id" ON "public"."service_types" USING "btree" ("mode_id");

CREATE INDEX IF NOT EXISTS "idx_service_types_name" ON "public"."service_types" USING "btree" ("name");

CREATE INDEX IF NOT EXISTS "idx_services_service_type_id" ON "public"."services" USING "btree" ("service_type_id");

CREATE INDEX IF NOT EXISTS "idx_services_tenant" ON "public"."services" USING "btree" ("tenant_id");

CREATE INDEX IF NOT EXISTS "idx_services_type" ON "public"."services" USING "btree" ("service_type");

CREATE INDEX IF NOT EXISTS "idx_shipment_attachments_shipment" ON "public"."shipment_attachments" USING "btree" ("shipment_id");

CREATE INDEX IF NOT EXISTS "idx_shipment_attachments_shipment_id" ON "public"."shipment_attachments" USING "btree" ("shipment_id");

CREATE INDEX IF NOT EXISTS "idx_shipment_attachments_shipment_id_document_type" ON "public"."shipment_attachments" USING "btree" ("shipment_id", "document_type");

CREATE INDEX IF NOT EXISTS "idx_shipment_attachments_uploaded_at" ON "public"."shipment_attachments" USING "btree" ("uploaded_at" DESC);

CREATE INDEX IF NOT EXISTS "idx_shipments_account" ON "public"."shipments" USING "btree" ("account_id");

CREATE INDEX IF NOT EXISTS "idx_shipments_franchise" ON "public"."shipments" USING "btree" ("franchise_id");

CREATE INDEX IF NOT EXISTS "idx_shipments_pod_received_at" ON "public"."shipments" USING "btree" ("pod_received_at");

CREATE INDEX IF NOT EXISTS "idx_shipments_pod_status" ON "public"."shipments" USING "btree" ("pod_status");

CREATE INDEX IF NOT EXISTS "idx_shipments_shipment_number" ON "public"."shipments" USING "btree" ("shipment_number");

CREATE INDEX IF NOT EXISTS "idx_shipments_status" ON "public"."shipments" USING "btree" ("status");

CREATE INDEX IF NOT EXISTS "idx_shipments_tenant" ON "public"."shipments" USING "btree" ("tenant_id");

CREATE INDEX IF NOT EXISTS "idx_states_country" ON "public"."states" USING "btree" ("country_id");

CREATE INDEX IF NOT EXISTS "idx_stm_active" ON "public"."service_type_mappings" USING "btree" ("is_active");

CREATE INDEX IF NOT EXISTS "idx_stm_tenant" ON "public"."service_type_mappings" USING "btree" ("tenant_id");

CREATE INDEX IF NOT EXISTS "idx_subscription_invoices_stripe" ON "public"."subscription_invoices" USING "btree" ("stripe_invoice_id");

CREATE INDEX IF NOT EXISTS "idx_subscription_invoices_tenant" ON "public"."subscription_invoices" USING "btree" ("tenant_id");

CREATE INDEX IF NOT EXISTS "idx_tenant_subscriptions_status" ON "public"."tenant_subscriptions" USING "btree" ("status");

CREATE INDEX IF NOT EXISTS "idx_tenant_subscriptions_stripe" ON "public"."tenant_subscriptions" USING "btree" ("stripe_subscription_id");

CREATE INDEX IF NOT EXISTS "idx_tenant_subscriptions_tenant" ON "public"."tenant_subscriptions" USING "btree" ("tenant_id");

CREATE INDEX IF NOT EXISTS "idx_territories_tenant" ON "public"."territories" USING "btree" ("tenant_id");

CREATE INDEX IF NOT EXISTS "idx_territory_geographies_city_id" ON "public"."territory_geographies" USING "btree" ("city_id");

CREATE INDEX IF NOT EXISTS "idx_territory_geographies_continent" ON "public"."territory_geographies" USING "btree" ("continent_id");

CREATE INDEX IF NOT EXISTS "idx_territory_geographies_continent_id" ON "public"."territory_geographies" USING "btree" ("continent_id");

CREATE INDEX IF NOT EXISTS "idx_territory_geographies_country" ON "public"."territory_geographies" USING "btree" ("country_id");

CREATE INDEX IF NOT EXISTS "idx_territory_geographies_country_id" ON "public"."territory_geographies" USING "btree" ("country_id");

CREATE INDEX IF NOT EXISTS "idx_territory_geographies_state" ON "public"."territory_geographies" USING "btree" ("state_id");

CREATE INDEX IF NOT EXISTS "idx_territory_geographies_state_id" ON "public"."territory_geographies" USING "btree" ("state_id");

CREATE INDEX IF NOT EXISTS "idx_territory_geographies_territory" ON "public"."territory_geographies" USING "btree" ("territory_id");

CREATE INDEX IF NOT EXISTS "idx_territory_geographies_territory_id" ON "public"."territory_geographies" USING "btree" ("territory_id");

CREATE INDEX IF NOT EXISTS "idx_themes_is_active" ON "public"."themes" USING "btree" ("is_active");

CREATE INDEX IF NOT EXISTS "idx_themes_is_default" ON "public"."themes" USING "btree" ("is_default");

CREATE INDEX IF NOT EXISTS "idx_themes_tenant_id" ON "public"."themes" USING "btree" ("tenant_id");

CREATE INDEX IF NOT EXISTS "idx_tracking_events_date" ON "public"."tracking_events" USING "btree" ("event_date");

CREATE INDEX IF NOT EXISTS "idx_tracking_events_shipment" ON "public"."tracking_events" USING "btree" ("shipment_id");

CREATE INDEX IF NOT EXISTS "idx_usage_records_period" ON "public"."usage_records" USING "btree" ("period_start", "period_end");

CREATE INDEX IF NOT EXISTS "idx_usage_records_tenant_feature" ON "public"."usage_records" USING "btree" ("tenant_id", "feature_key");

CREATE INDEX IF NOT EXISTS "idx_user_capacity_user" ON "public"."user_capacity" USING "btree" ("user_id");

CREATE INDEX IF NOT EXISTS "idx_user_roles_franchise_id" ON "public"."user_roles" USING "btree" ("franchise_id");

CREATE INDEX IF NOT EXISTS "idx_user_roles_tenant_id" ON "public"."user_roles" USING "btree" ("tenant_id");

CREATE INDEX IF NOT EXISTS "idx_user_roles_user_id" ON "public"."user_roles" USING "btree" ("user_id");

CREATE INDEX IF NOT EXISTS "idx_vehicles_tenant" ON "public"."vehicles" USING "btree" ("tenant_id");

CREATE INDEX IF NOT EXISTS "idx_warehouses_tenant" ON "public"."warehouses" USING "btree" ("tenant_id");

CREATE INDEX IF NOT EXISTS "quotation_version_option_legs_option_order_idx" ON "public"."quotation_version_option_legs" USING "btree" ("quotation_version_option_id", "sort_order");

CREATE INDEX IF NOT EXISTS "quotation_version_option_legs_service_type_idx" ON "public"."quotation_version_option_legs" USING "btree" ("service_type_id");

CREATE INDEX IF NOT EXISTS "quote_charges_option_idx" ON "public"."quote_charges" USING "btree" ("quote_option_id");

CREATE INDEX IF NOT EXISTS "quote_events_quote_idx" ON "public"."quote_events" USING "btree" ("quote_id");

CREATE INDEX IF NOT EXISTS "quote_items_quote_idx" ON "public"."quote_items" USING "btree" ("quote_id");

CREATE UNIQUE INDEX IF NOT EXISTS "quote_number_sequences_franchise_unique" ON "public"."quote_number_sequences" USING "btree" ("tenant_id", "franchise_id", "period_key") WHERE ("franchise_id" IS NOT NULL);

CREATE UNIQUE INDEX IF NOT EXISTS "quote_number_sequences_tenant_unique" ON "public"."quote_number_sequences" USING "btree" ("tenant_id", "period_key") WHERE ("franchise_id" IS NULL);

CREATE INDEX IF NOT EXISTS "quote_option_legs_container_idx" ON "public"."quote_option_legs" USING "btree" ("container_type_id", "container_size_id");

CREATE INDEX IF NOT EXISTS "quote_option_legs_option_order_idx" ON "public"."quote_option_legs" USING "btree" ("quote_option_id", "leg_order");

CREATE INDEX IF NOT EXISTS "quote_option_legs_service_type_idx" ON "public"."quote_option_legs" USING "btree" ("service_type_id");

CREATE INDEX IF NOT EXISTS "quote_option_legs_trade_dir_idx" ON "public"."quote_option_legs" USING "btree" ("trade_direction_id");

CREATE INDEX IF NOT EXISTS "quote_options_version_idx" ON "public"."quote_options" USING "btree" ("quote_version_id");

CREATE UNIQUE INDEX IF NOT EXISTS "quote_versions_unique" ON "public"."quote_versions" USING "btree" ("quote_id", "version_number");

CREATE INDEX IF NOT EXISTS "rates_lane_idx" ON "public"."rates" USING "btree" ("mode", "origin", "destination");

CREATE INDEX IF NOT EXISTS "rates_validity_idx" ON "public"."rates" USING "btree" ("validity_start", "validity_end");

CREATE INDEX IF NOT EXISTS "service_type_mappings_service_type_id_idx" ON "public"."service_type_mappings" USING "btree" ("service_type_id");

CREATE UNIQUE INDEX IF NOT EXISTS "service_type_mappings_unique_fk" ON "public"."service_type_mappings" USING "btree" ("tenant_id", "service_type_id", "service_id");

CREATE UNIQUE INDEX IF NOT EXISTS "service_types_code_unique" ON "public"."service_types" USING "btree" ("code");

CREATE UNIQUE INDEX IF NOT EXISTS "states_country_iso_unique" ON "public"."states" USING "btree" ("country_id", "code_iso") WHERE ("code_iso" IS NOT NULL);

CREATE UNIQUE INDEX IF NOT EXISTS "states_country_name_unique" ON "public"."states" USING "btree" ("country_id", "name");

CREATE UNIQUE INDEX IF NOT EXISTS "ui_themes_scope_name_unique" ON "public"."ui_themes" USING "btree" ("scope", COALESCE("tenant_id", '00000000-0000-0000-0000-000000000000'::"uuid"), COALESCE("franchise_id", '00000000-0000-0000-0000-000000000000'::"uuid"), COALESCE("user_id", '00000000-0000-0000-0000-000000000000'::"uuid"), "lower"("name"));

CREATE UNIQUE INDEX IF NOT EXISTS "uniq_service_types_norm_name" ON "public"."service_types" USING "btree" ("lower"(TRIM(BOTH FROM "name")));

CREATE UNIQUE INDEX IF NOT EXISTS "uq_quote_version" ON "public"."quotation_versions" USING "btree" ("quote_id", "major", "minor");

CREATE UNIQUE INDEX IF NOT EXISTS "uq_quotes_primary_per_opportunity" ON "public"."quotes" USING "btree" ("opportunity_id") WHERE ("is_primary" IS TRUE);

CREATE OR REPLACE TRIGGER "log_opportunity_probability_changes_trigger" AFTER UPDATE ON "public"."opportunities" FOR EACH ROW EXECUTE FUNCTION "public"."log_opportunity_probability_changes"();

CREATE OR REPLACE TRIGGER "log_option_changes_trigger" AFTER INSERT OR DELETE OR UPDATE ON "public"."quotation_version_options" FOR EACH ROW EXECUTE FUNCTION "public"."log_option_changes"();

CREATE OR REPLACE TRIGGER "log_version_changes_trigger" AFTER INSERT OR DELETE OR UPDATE ON "public"."quotation_versions" FOR EACH ROW EXECUTE FUNCTION "public"."log_version_changes"();

CREATE OR REPLACE TRIGGER "set_quote_legs_updated_at" BEFORE UPDATE ON "public"."quote_legs" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();

CREATE OR REPLACE TRIGGER "trg_dashboard_preferences_updated" BEFORE UPDATE ON "public"."dashboard_preferences" FOR EACH ROW EXECUTE FUNCTION "public"."update_scheduled_email_timestamp"();

CREATE OR REPLACE TRIGGER "trg_email_audit" AFTER INSERT OR UPDATE ON "public"."emails" FOR EACH ROW EXECUTE FUNCTION "public"."log_email_audit"();

CREATE OR REPLACE TRIGGER "trg_email_delegations_updated" BEFORE UPDATE ON "public"."email_account_delegations" FOR EACH ROW EXECUTE FUNCTION "public"."update_scheduled_email_timestamp"();

CREATE OR REPLACE TRIGGER "trg_opp_items_sync_del" AFTER DELETE ON "public"."opportunity_items" FOR EACH ROW EXECUTE FUNCTION "public"."sync_quote_items_from_opportunity_trigger"();

CREATE OR REPLACE TRIGGER "trg_opp_items_sync_ins" AFTER INSERT ON "public"."opportunity_items" FOR EACH ROW EXECUTE FUNCTION "public"."sync_quote_items_from_opportunity_trigger"();

CREATE OR REPLACE TRIGGER "trg_opp_items_sync_upd" AFTER UPDATE ON "public"."opportunity_items" FOR EACH ROW EXECUTE FUNCTION "public"."sync_quote_items_from_opportunity_trigger"();

CREATE OR REPLACE TRIGGER "trg_quote_items_recalc_total_del" AFTER DELETE ON "public"."quote_items" FOR EACH ROW EXECUTE FUNCTION "public"."recalculate_and_sync_quote_trigger"();

CREATE OR REPLACE TRIGGER "trg_quote_items_recalc_total_ins" AFTER INSERT ON "public"."quote_items" FOR EACH ROW EXECUTE FUNCTION "public"."recalculate_and_sync_quote_trigger"();

CREATE OR REPLACE TRIGGER "trg_quote_items_recalc_total_upd" AFTER UPDATE ON "public"."quote_items" FOR EACH ROW EXECUTE FUNCTION "public"."recalculate_and_sync_quote_trigger"();

CREATE OR REPLACE TRIGGER "trg_quotes_ensure_single_primary" BEFORE INSERT OR UPDATE OF "is_primary", "opportunity_id" ON "public"."quotes" FOR EACH ROW EXECUTE FUNCTION "public"."ensure_single_primary_quote"();

CREATE OR REPLACE TRIGGER "trg_quotes_sync_opportunity" AFTER INSERT OR UPDATE ON "public"."quotes" FOR EACH ROW EXECUTE FUNCTION "public"."sync_opportunity_from_primary_quote"();

CREATE OR REPLACE TRIGGER "trg_qvo_populate" BEFORE INSERT ON "public"."quotation_version_options" FOR EACH ROW EXECUTE FUNCTION "public"."populate_option_from_rate"();

CREATE OR REPLACE TRIGGER "trg_recalc_total_on_charge_del" AFTER DELETE ON "public"."carrier_rate_charges" FOR EACH ROW EXECUTE FUNCTION "public"."recalc_carrier_rate_total_trigger"();

CREATE OR REPLACE TRIGGER "trg_recalc_total_on_charge_ins" AFTER INSERT ON "public"."carrier_rate_charges" FOR EACH ROW EXECUTE FUNCTION "public"."recalc_carrier_rate_total_trigger"();

CREATE OR REPLACE TRIGGER "trg_recalc_total_on_charge_upd" AFTER UPDATE ON "public"."carrier_rate_charges" FOR EACH ROW EXECUTE FUNCTION "public"."recalc_carrier_rate_total_trigger"();

CREATE OR REPLACE TRIGGER "trg_recalc_total_on_rate_upd" BEFORE UPDATE ON "public"."carrier_rates" FOR EACH ROW EXECUTE FUNCTION "public"."recalc_carrier_rate_on_rate_update"();

CREATE OR REPLACE TRIGGER "trg_scheduled_emails_updated" BEFORE UPDATE ON "public"."scheduled_emails" FOR EACH ROW EXECUTE FUNCTION "public"."update_scheduled_email_timestamp"();

CREATE OR REPLACE TRIGGER "trg_set_quote_number_before_insert" BEFORE INSERT ON "public"."quotes" FOR EACH ROW EXECUTE FUNCTION "public"."trg_set_quote_number_before_insert"();

CREATE OR REPLACE TRIGGER "trg_update_option_totals_on_charge_change" AFTER INSERT OR DELETE OR UPDATE ON "public"."quote_charges" FOR EACH ROW EXECUTE FUNCTION "public"."update_option_totals"();

CREATE OR REPLACE TRIGGER "trg_validate_current_version" BEFORE INSERT OR UPDATE OF "is_current" ON "public"."quotation_versions" FOR EACH ROW EXECUTE FUNCTION "public"."validate_version_uniqueness"();

CREATE OR REPLACE TRIGGER "trg_validate_leg_sort_order" BEFORE INSERT ON "public"."quotation_version_option_legs" FOR EACH ROW EXECUTE FUNCTION "public"."validate_leg_sort_order"();

CREATE OR REPLACE TRIGGER "trigger_auto_assign_version_number" BEFORE INSERT ON "public"."quotation_versions" FOR EACH ROW EXECUTE FUNCTION "public"."auto_assign_version_number"();

CREATE OR REPLACE TRIGGER "trigger_auto_generate_quote_number" BEFORE INSERT ON "public"."quotes" FOR EACH ROW EXECUTE FUNCTION "public"."auto_generate_quote_number"();

CREATE OR REPLACE TRIGGER "trigger_log_option_changes" BEFORE INSERT OR DELETE OR UPDATE ON "public"."quotation_version_options" FOR EACH ROW EXECUTE FUNCTION "public"."log_option_changes"();

CREATE OR REPLACE TRIGGER "trigger_update_lead_last_activity" AFTER INSERT OR UPDATE ON "public"."activities" FOR EACH ROW EXECUTE FUNCTION "public"."update_lead_last_activity"();

CREATE OR REPLACE TRIGGER "trigger_update_lead_score" BEFORE INSERT OR UPDATE ON "public"."leads" FOR EACH ROW EXECUTE FUNCTION "public"."update_lead_score"();

CREATE OR REPLACE TRIGGER "trigger_update_option_margins" AFTER INSERT OR DELETE OR UPDATE ON "public"."quote_charges" FOR EACH ROW EXECUTE FUNCTION "public"."update_option_margins_on_charge_change"();

CREATE OR REPLACE TRIGGER "trigger_validate_customer_selection" BEFORE INSERT OR UPDATE ON "public"."customer_selections" FOR EACH ROW EXECUTE FUNCTION "public"."validate_single_selection_per_version"();

CREATE OR REPLACE TRIGGER "trigger_validate_version_status" BEFORE INSERT OR UPDATE ON "public"."quotation_versions" FOR EACH ROW EXECUTE FUNCTION "public"."validate_version_status_transition"();

CREATE OR REPLACE TRIGGER "upd_qc" BEFORE UPDATE ON "public"."quote_comments" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();

CREATE OR REPLACE TRIGGER "upd_qpt" BEFORE UPDATE ON "public"."quote_presentation_templates" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();

CREATE OR REPLACE TRIGGER "update_accounts_updated_at" BEFORE UPDATE ON "public"."accounts" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();

CREATE OR REPLACE TRIGGER "update_activities_updated_at" BEFORE UPDATE ON "public"."activities" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();

CREATE OR REPLACE TRIGGER "update_auth_roles_updated_at" BEFORE UPDATE ON "public"."auth_roles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();

CREATE OR REPLACE TRIGGER "update_cargo_details_updated_at" BEFORE UPDATE ON "public"."cargo_details" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();

CREATE OR REPLACE TRIGGER "update_cargo_types_updated_at" BEFORE UPDATE ON "public"."cargo_types" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();

CREATE OR REPLACE TRIGGER "update_carrier_rates_updated_at" BEFORE UPDATE ON "public"."carrier_rates" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();

CREATE OR REPLACE TRIGGER "update_carrier_service_types_updated_at" BEFORE UPDATE ON "public"."carrier_service_types" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();

CREATE OR REPLACE TRIGGER "update_charge_bases_updated_at" BEFORE UPDATE ON "public"."charge_bases" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();

CREATE OR REPLACE TRIGGER "update_charge_categories_updated_at" BEFORE UPDATE ON "public"."charge_categories" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();

CREATE OR REPLACE TRIGGER "update_charge_sides_updated_at" BEFORE UPDATE ON "public"."charge_sides" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();

CREATE OR REPLACE TRIGGER "update_charge_tier_config_updated_at" BEFORE UPDATE ON "public"."charge_tier_config" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();

CREATE OR REPLACE TRIGGER "update_charge_tier_ranges_updated_at" BEFORE UPDATE ON "public"."charge_tier_ranges" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();

CREATE OR REPLACE TRIGGER "update_charge_weight_breaks_updated_at" BEFORE UPDATE ON "public"."charge_weight_breaks" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();

CREATE OR REPLACE TRIGGER "update_compliance_rules_updated_at" BEFORE UPDATE ON "public"."compliance_rules" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();

CREATE OR REPLACE TRIGGER "update_contacts_updated_at" BEFORE UPDATE ON "public"."contacts" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();

CREATE OR REPLACE TRIGGER "update_currencies_updated_at" BEFORE UPDATE ON "public"."currencies" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();

CREATE OR REPLACE TRIGGER "update_custom_roles_updated_at" BEFORE UPDATE ON "public"."custom_roles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();

CREATE OR REPLACE TRIGGER "update_customs_documents_updated_at" BEFORE UPDATE ON "public"."customs_documents" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();

CREATE OR REPLACE TRIGGER "update_document_templates_updated_at" BEFORE UPDATE ON "public"."document_templates" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();

CREATE OR REPLACE TRIGGER "update_email_accounts_updated_at" BEFORE UPDATE ON "public"."email_accounts" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();

CREATE OR REPLACE TRIGGER "update_email_filters_updated_at" BEFORE UPDATE ON "public"."email_filters" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();

CREATE OR REPLACE TRIGGER "update_email_templates_updated_at" BEFORE UPDATE ON "public"."email_templates" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();

CREATE OR REPLACE TRIGGER "update_emails_updated_at" BEFORE UPDATE ON "public"."emails" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();

CREATE OR REPLACE TRIGGER "update_entity_transfer_items_updated_at" BEFORE UPDATE ON "public"."entity_transfer_items" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();

CREATE OR REPLACE TRIGGER "update_entity_transfers_updated_at" BEFORE UPDATE ON "public"."entity_transfers" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();

CREATE OR REPLACE TRIGGER "update_franchises_updated_at" BEFORE UPDATE ON "public"."franchises" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();

CREATE OR REPLACE TRIGGER "update_history_filter_presets_updated_at" BEFORE UPDATE ON "public"."history_filter_presets" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();

CREATE OR REPLACE TRIGGER "update_incoterms_updated_at" BEFORE UPDATE ON "public"."incoterms" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();

CREATE OR REPLACE TRIGGER "update_lead_score_config_updated_at" BEFORE UPDATE ON "public"."lead_score_config" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();

CREATE OR REPLACE TRIGGER "update_leads_updated_at" BEFORE UPDATE ON "public"."leads" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();

CREATE OR REPLACE TRIGGER "update_oauth_configurations_updated_at" BEFORE UPDATE ON "public"."oauth_configurations" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();

CREATE OR REPLACE TRIGGER "update_opportunities_updated_at" BEFORE UPDATE ON "public"."opportunities" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();

CREATE OR REPLACE TRIGGER "update_package_categories_updated_at" BEFORE UPDATE ON "public"."package_categories" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();

CREATE OR REPLACE TRIGGER "update_package_sizes_updated_at" BEFORE UPDATE ON "public"."package_sizes" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();

CREATE OR REPLACE TRIGGER "update_profiles_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();

CREATE OR REPLACE TRIGGER "update_provider_api_configs_updated_at" BEFORE UPDATE ON "public"."provider_api_configs" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();

CREATE OR REPLACE TRIGGER "update_provider_charge_mappings_updated_at" BEFORE UPDATE ON "public"."provider_charge_mappings" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();

CREATE OR REPLACE TRIGGER "update_provider_rate_rules_updated_at" BEFORE UPDATE ON "public"."provider_rate_rules" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();

CREATE OR REPLACE TRIGGER "update_provider_rate_templates_updated_at" BEFORE UPDATE ON "public"."provider_rate_templates" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();

CREATE OR REPLACE TRIGGER "update_provider_surcharges_updated_at" BEFORE UPDATE ON "public"."provider_surcharges" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();

CREATE OR REPLACE TRIGGER "update_quotation_packages_updated_at" BEFORE UPDATE ON "public"."quotation_packages" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();

CREATE OR REPLACE TRIGGER "update_quotation_version_option_legs_updated_at" BEFORE UPDATE ON "public"."quotation_version_option_legs" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();

CREATE OR REPLACE TRIGGER "update_quote_items_updated_at" BEFORE UPDATE ON "public"."quote_items" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();

CREATE OR REPLACE TRIGGER "update_quote_number_config_franchise_updated_at" BEFORE UPDATE ON "public"."quote_number_config_franchise" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();

CREATE OR REPLACE TRIGGER "update_quote_number_config_tenant_updated_at" BEFORE UPDATE ON "public"."quote_number_config_tenant" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();

CREATE OR REPLACE TRIGGER "update_quote_number_sequences_updated_at" BEFORE UPDATE ON "public"."quote_number_sequences" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();

CREATE OR REPLACE TRIGGER "update_quote_templates_updated_at" BEFORE UPDATE ON "public"."quote_templates" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();

CREATE OR REPLACE TRIGGER "update_quotes_updated_at" BEFORE UPDATE ON "public"."quotes" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();

CREATE OR REPLACE TRIGGER "update_routes_updated_at" BEFORE UPDATE ON "public"."routes" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();

CREATE OR REPLACE TRIGGER "update_service_leg_categories_updated_at" BEFORE UPDATE ON "public"."service_leg_categories" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();

CREATE OR REPLACE TRIGGER "update_service_type_mappings_updated_at" BEFORE UPDATE ON "public"."service_type_mappings" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();

CREATE OR REPLACE TRIGGER "update_service_types_updated_at" BEFORE UPDATE ON "public"."service_types" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();

CREATE OR REPLACE TRIGGER "update_services_updated_at" BEFORE UPDATE ON "public"."services" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();

CREATE OR REPLACE TRIGGER "update_shipment_items_updated_at" BEFORE UPDATE ON "public"."shipment_items" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();

CREATE OR REPLACE TRIGGER "update_shipments_updated_at" BEFORE UPDATE ON "public"."shipments" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();

CREATE OR REPLACE TRIGGER "update_shipping_rates_updated_at" BEFORE UPDATE ON "public"."shipping_rates" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();

CREATE OR REPLACE TRIGGER "update_subscription_features_updated_at" BEFORE UPDATE ON "public"."subscription_features" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();

CREATE OR REPLACE TRIGGER "update_subscription_invoices_updated_at" BEFORE UPDATE ON "public"."subscription_invoices" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();

CREATE OR REPLACE TRIGGER "update_subscription_plans_updated_at" BEFORE UPDATE ON "public"."subscription_plans" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();

CREATE OR REPLACE TRIGGER "update_tenant_subscriptions_updated_at" BEFORE UPDATE ON "public"."tenant_subscriptions" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();

CREATE OR REPLACE TRIGGER "update_tenants_updated_at" BEFORE UPDATE ON "public"."tenants" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();

CREATE OR REPLACE TRIGGER "update_territories_updated_at" BEFORE UPDATE ON "public"."territories" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();

CREATE OR REPLACE TRIGGER "update_themes_updated_at" BEFORE UPDATE ON "public"."themes" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();

CREATE OR REPLACE TRIGGER "update_transport_modes_updated_at" BEFORE UPDATE ON "public"."transport_modes" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();

CREATE OR REPLACE TRIGGER "update_usage_records_updated_at" BEFORE UPDATE ON "public"."usage_records" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();

CREATE OR REPLACE TRIGGER "update_user_capacity_updated_at" BEFORE UPDATE ON "public"."user_capacity" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();

CREATE OR REPLACE TRIGGER "update_user_preferences_updated_at" BEFORE UPDATE ON "public"."user_preferences" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();

CREATE OR REPLACE TRIGGER "update_vehicles_updated_at" BEFORE UPDATE ON "public"."vehicles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();

CREATE OR REPLACE TRIGGER "update_warehouse_inventory_updated_at" BEFORE UPDATE ON "public"."warehouse_inventory" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();

CREATE OR REPLACE TRIGGER "update_warehouses_updated_at" BEFORE UPDATE ON "public"."warehouses" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();

CREATE OR REPLACE TRIGGER "validate_service_leg_before_insert_update" BEFORE INSERT OR UPDATE ON "public"."quotation_version_option_legs" FOR EACH ROW EXECUTE FUNCTION "public"."validate_service_leg_requirements"();

ALTER TABLE "public"."accounts" DROP CONSTRAINT IF EXISTS "accounts_created_by_fkey";
ALTER TABLE "public"."accounts" ADD CONSTRAINT "accounts_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");

ALTER TABLE "public"."accounts" DROP CONSTRAINT IF EXISTS "accounts_franchise_id_fkey";
ALTER TABLE "public"."accounts" ADD CONSTRAINT "accounts_franchise_id_fkey" FOREIGN KEY ("franchise_id") REFERENCES "public"."franchises"("id") ON DELETE SET NULL;

ALTER TABLE "public"."accounts" DROP CONSTRAINT IF EXISTS "accounts_owner_id_fkey";
ALTER TABLE "public"."accounts" ADD CONSTRAINT "accounts_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id");

ALTER TABLE "public"."accounts" DROP CONSTRAINT IF EXISTS "accounts_tenant_id_fkey";
ALTER TABLE "public"."accounts" ADD CONSTRAINT "accounts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;

ALTER TABLE "public"."activities" DROP CONSTRAINT IF EXISTS "activities_account_id_fkey";
ALTER TABLE "public"."activities" ADD CONSTRAINT "activities_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE CASCADE;

ALTER TABLE "public"."activities" DROP CONSTRAINT IF EXISTS "activities_assigned_to_fkey";
ALTER TABLE "public"."activities" ADD CONSTRAINT "activities_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "public"."profiles"("id");

ALTER TABLE "public"."activities" DROP CONSTRAINT IF EXISTS "activities_contact_id_fkey";
ALTER TABLE "public"."activities" ADD CONSTRAINT "activities_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE CASCADE;

ALTER TABLE "public"."activities" DROP CONSTRAINT IF EXISTS "activities_created_by_fkey";
ALTER TABLE "public"."activities" ADD CONSTRAINT "activities_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");

ALTER TABLE "public"."activities" DROP CONSTRAINT IF EXISTS "activities_franchise_id_fkey";
ALTER TABLE "public"."activities" ADD CONSTRAINT "activities_franchise_id_fkey" FOREIGN KEY ("franchise_id") REFERENCES "public"."franchises"("id") ON DELETE SET NULL;

ALTER TABLE "public"."activities" DROP CONSTRAINT IF EXISTS "activities_lead_id_fkey";
ALTER TABLE "public"."activities" ADD CONSTRAINT "activities_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE CASCADE;

ALTER TABLE "public"."activities" DROP CONSTRAINT IF EXISTS "activities_opportunity_id_fkey";
ALTER TABLE "public"."activities" ADD CONSTRAINT "activities_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE SET NULL;

ALTER TABLE "public"."activities" DROP CONSTRAINT IF EXISTS "activities_tenant_id_fkey";
ALTER TABLE "public"."activities" ADD CONSTRAINT "activities_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;

ALTER TABLE "public"."audit_logs" DROP CONSTRAINT IF EXISTS "audit_logs_user_id_fkey";
ALTER TABLE "public"."audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id");

ALTER TABLE "public"."auth_role_hierarchy" DROP CONSTRAINT IF EXISTS "auth_role_hierarchy_manager_role_id_fkey";
ALTER TABLE "public"."auth_role_hierarchy" ADD CONSTRAINT "auth_role_hierarchy_manager_role_id_fkey" FOREIGN KEY ("manager_role_id") REFERENCES "public"."auth_roles"("id") ON DELETE CASCADE;

ALTER TABLE "public"."auth_role_hierarchy" DROP CONSTRAINT IF EXISTS "auth_role_hierarchy_target_role_id_fkey";
ALTER TABLE "public"."auth_role_hierarchy" ADD CONSTRAINT "auth_role_hierarchy_target_role_id_fkey" FOREIGN KEY ("target_role_id") REFERENCES "public"."auth_roles"("id") ON DELETE CASCADE;

ALTER TABLE "public"."auth_role_permissions" DROP CONSTRAINT IF EXISTS "auth_role_permissions_permission_id_fkey";
ALTER TABLE "public"."auth_role_permissions" ADD CONSTRAINT "auth_role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "public"."auth_permissions"("id") ON DELETE CASCADE;

ALTER TABLE "public"."auth_role_permissions" DROP CONSTRAINT IF EXISTS "auth_role_permissions_role_id_fkey";
ALTER TABLE "public"."auth_role_permissions" ADD CONSTRAINT "auth_role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."auth_roles"("id") ON DELETE CASCADE;

ALTER TABLE "public"."cargo_details" DROP CONSTRAINT IF EXISTS "cargo_details_cargo_type_id_fkey";
ALTER TABLE "public"."cargo_details" ADD CONSTRAINT "cargo_details_cargo_type_id_fkey" FOREIGN KEY ("cargo_type_id") REFERENCES "public"."cargo_types"("id") ON DELETE SET NULL;

ALTER TABLE "public"."cargo_details" DROP CONSTRAINT IF EXISTS "cargo_details_service_id_fkey";
ALTER TABLE "public"."cargo_details" ADD CONSTRAINT "cargo_details_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE CASCADE;

ALTER TABLE "public"."cargo_details" DROP CONSTRAINT IF EXISTS "cargo_details_tenant_id_fkey";
ALTER TABLE "public"."cargo_details" ADD CONSTRAINT "cargo_details_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;

ALTER TABLE "public"."carrier_rate_attachments" DROP CONSTRAINT IF EXISTS "carrier_rate_attachments_carrier_rate_id_fkey";
ALTER TABLE "public"."carrier_rate_attachments" ADD CONSTRAINT "carrier_rate_attachments_carrier_rate_id_fkey" FOREIGN KEY ("carrier_rate_id") REFERENCES "public"."carrier_rates"("id") ON DELETE CASCADE;

ALTER TABLE "public"."carrier_rate_charges" DROP CONSTRAINT IF EXISTS "carrier_rate_charges_carrier_rate_id_fkey";
ALTER TABLE "public"."carrier_rate_charges" ADD CONSTRAINT "carrier_rate_charges_carrier_rate_id_fkey" FOREIGN KEY ("carrier_rate_id") REFERENCES "public"."carrier_rates"("id") ON DELETE CASCADE;

ALTER TABLE "public"."carrier_rates" DROP CONSTRAINT IF EXISTS "carrier_rates_carrier_id_fkey";
ALTER TABLE "public"."carrier_rates" ADD CONSTRAINT "carrier_rates_carrier_id_fkey" FOREIGN KEY ("carrier_id") REFERENCES "public"."carriers"("id") ON DELETE CASCADE;

ALTER TABLE "public"."carrier_rates" DROP CONSTRAINT IF EXISTS "carrier_rates_container_category_id_fkey";
ALTER TABLE "public"."carrier_rates" ADD CONSTRAINT "carrier_rates_container_category_id_fkey" FOREIGN KEY ("container_category_id") REFERENCES "public"."package_categories"("id") ON DELETE SET NULL;

ALTER TABLE "public"."carrier_rates" DROP CONSTRAINT IF EXISTS "carrier_rates_container_size_id_fkey";
ALTER TABLE "public"."carrier_rates" ADD CONSTRAINT "carrier_rates_container_size_id_fkey" FOREIGN KEY ("container_size_id") REFERENCES "public"."package_sizes"("id") ON DELETE SET NULL;

ALTER TABLE "public"."carrier_rates" DROP CONSTRAINT IF EXISTS "carrier_rates_service_id_fkey";
ALTER TABLE "public"."carrier_rates" ADD CONSTRAINT "carrier_rates_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE CASCADE;

ALTER TABLE "public"."carrier_rates" DROP CONSTRAINT IF EXISTS "carrier_rates_tenant_id_fkey";
ALTER TABLE "public"."carrier_rates" ADD CONSTRAINT "carrier_rates_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;

ALTER TABLE "public"."carrier_service_types" DROP CONSTRAINT IF EXISTS "carrier_service_types_carrier_id_fkey";
ALTER TABLE "public"."carrier_service_types" ADD CONSTRAINT "carrier_service_types_carrier_id_fkey" FOREIGN KEY ("carrier_id") REFERENCES "public"."carriers"("id") ON DELETE CASCADE;

ALTER TABLE "public"."charge_tier_config" DROP CONSTRAINT IF EXISTS "charge_tier_config_basis_id_fkey";
ALTER TABLE "public"."charge_tier_config" ADD CONSTRAINT "charge_tier_config_basis_id_fkey" FOREIGN KEY ("basis_id") REFERENCES "public"."charge_bases"("id");

ALTER TABLE "public"."charge_tier_config" DROP CONSTRAINT IF EXISTS "charge_tier_config_carrier_id_fkey";
ALTER TABLE "public"."charge_tier_config" ADD CONSTRAINT "charge_tier_config_carrier_id_fkey" FOREIGN KEY ("carrier_id") REFERENCES "public"."carriers"("id");

ALTER TABLE "public"."charge_tier_config" DROP CONSTRAINT IF EXISTS "charge_tier_config_category_id_fkey";
ALTER TABLE "public"."charge_tier_config" ADD CONSTRAINT "charge_tier_config_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."charge_categories"("id");

ALTER TABLE "public"."charge_tier_config" DROP CONSTRAINT IF EXISTS "charge_tier_config_service_type_id_fkey";
ALTER TABLE "public"."charge_tier_config" ADD CONSTRAINT "charge_tier_config_service_type_id_fkey" FOREIGN KEY ("service_type_id") REFERENCES "public"."service_types"("id");

ALTER TABLE "public"."charge_tier_config" DROP CONSTRAINT IF EXISTS "charge_tier_config_tenant_id_fkey";
ALTER TABLE "public"."charge_tier_config" ADD CONSTRAINT "charge_tier_config_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;

ALTER TABLE "public"."charge_tier_ranges" DROP CONSTRAINT IF EXISTS "charge_tier_ranges_currency_id_fkey";
ALTER TABLE "public"."charge_tier_ranges" ADD CONSTRAINT "charge_tier_ranges_currency_id_fkey" FOREIGN KEY ("currency_id") REFERENCES "public"."currencies"("id");

ALTER TABLE "public"."charge_tier_ranges" DROP CONSTRAINT IF EXISTS "charge_tier_ranges_tier_config_id_fkey";
ALTER TABLE "public"."charge_tier_ranges" ADD CONSTRAINT "charge_tier_ranges_tier_config_id_fkey" FOREIGN KEY ("tier_config_id") REFERENCES "public"."charge_tier_config"("id") ON DELETE CASCADE;

ALTER TABLE "public"."charge_weight_breaks" DROP CONSTRAINT IF EXISTS "charge_weight_breaks_carrier_id_fkey";
ALTER TABLE "public"."charge_weight_breaks" ADD CONSTRAINT "charge_weight_breaks_carrier_id_fkey" FOREIGN KEY ("carrier_id") REFERENCES "public"."carriers"("id") ON DELETE CASCADE;

ALTER TABLE "public"."charge_weight_breaks" DROP CONSTRAINT IF EXISTS "charge_weight_breaks_currency_id_fkey";
ALTER TABLE "public"."charge_weight_breaks" ADD CONSTRAINT "charge_weight_breaks_currency_id_fkey" FOREIGN KEY ("currency_id") REFERENCES "public"."currencies"("id");

ALTER TABLE "public"."charge_weight_breaks" DROP CONSTRAINT IF EXISTS "charge_weight_breaks_service_type_id_fkey";
ALTER TABLE "public"."charge_weight_breaks" ADD CONSTRAINT "charge_weight_breaks_service_type_id_fkey" FOREIGN KEY ("service_type_id") REFERENCES "public"."service_types"("id");

ALTER TABLE "public"."charge_weight_breaks" DROP CONSTRAINT IF EXISTS "charge_weight_breaks_tenant_id_fkey";
ALTER TABLE "public"."charge_weight_breaks" ADD CONSTRAINT "charge_weight_breaks_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;

ALTER TABLE "public"."cities" DROP CONSTRAINT IF EXISTS "cities_country_id_fkey";
ALTER TABLE "public"."cities" ADD CONSTRAINT "cities_country_id_fkey" FOREIGN KEY ("country_id") REFERENCES "public"."countries"("id") ON DELETE SET NULL;

ALTER TABLE "public"."cities" DROP CONSTRAINT IF EXISTS "cities_state_id_fkey";
ALTER TABLE "public"."cities" ADD CONSTRAINT "cities_state_id_fkey" FOREIGN KEY ("state_id") REFERENCES "public"."states"("id") ON DELETE SET NULL;

ALTER TABLE "public"."compliance_checks" DROP CONSTRAINT IF EXISTS "compliance_checks_checked_by_fkey";
ALTER TABLE "public"."compliance_checks" ADD CONSTRAINT "compliance_checks_checked_by_fkey" FOREIGN KEY ("checked_by") REFERENCES "auth"."users"("id");

ALTER TABLE "public"."compliance_checks" DROP CONSTRAINT IF EXISTS "compliance_checks_quote_id_fkey";
ALTER TABLE "public"."compliance_checks" ADD CONSTRAINT "compliance_checks_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE CASCADE;

ALTER TABLE "public"."compliance_checks" DROP CONSTRAINT IF EXISTS "compliance_checks_rule_id_fkey";
ALTER TABLE "public"."compliance_checks" ADD CONSTRAINT "compliance_checks_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "public"."compliance_rules"("id");

ALTER TABLE "public"."compliance_rules" DROP CONSTRAINT IF EXISTS "compliance_rules_tenant_id_fkey";
ALTER TABLE "public"."compliance_rules" ADD CONSTRAINT "compliance_rules_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;

ALTER TABLE "public"."contacts" DROP CONSTRAINT IF EXISTS "contacts_account_id_fkey";
ALTER TABLE "public"."contacts" ADD CONSTRAINT "contacts_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE SET NULL;

ALTER TABLE "public"."contacts" DROP CONSTRAINT IF EXISTS "contacts_created_by_fkey";
ALTER TABLE "public"."contacts" ADD CONSTRAINT "contacts_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");

ALTER TABLE "public"."contacts" DROP CONSTRAINT IF EXISTS "contacts_franchise_id_fkey";
ALTER TABLE "public"."contacts" ADD CONSTRAINT "contacts_franchise_id_fkey" FOREIGN KEY ("franchise_id") REFERENCES "public"."franchises"("id") ON DELETE SET NULL;

ALTER TABLE "public"."contacts" DROP CONSTRAINT IF EXISTS "contacts_owner_id_fkey";
ALTER TABLE "public"."contacts" ADD CONSTRAINT "contacts_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id");

ALTER TABLE "public"."contacts" DROP CONSTRAINT IF EXISTS "contacts_tenant_id_fkey";
ALTER TABLE "public"."contacts" ADD CONSTRAINT "contacts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;

ALTER TABLE "public"."countries" DROP CONSTRAINT IF EXISTS "countries_continent_id_fkey";
ALTER TABLE "public"."countries" ADD CONSTRAINT "countries_continent_id_fkey" FOREIGN KEY ("continent_id") REFERENCES "public"."continents"("id") ON DELETE SET NULL;

ALTER TABLE "public"."custom_role_permissions" DROP CONSTRAINT IF EXISTS "custom_role_permissions_role_id_fkey";
ALTER TABLE "public"."custom_role_permissions" ADD CONSTRAINT "custom_role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."custom_roles"("id") ON DELETE CASCADE;

ALTER TABLE "public"."custom_roles" DROP CONSTRAINT IF EXISTS "custom_roles_created_by_fkey";
ALTER TABLE "public"."custom_roles" ADD CONSTRAINT "custom_roles_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");

ALTER TABLE "public"."customer_selections" DROP CONSTRAINT IF EXISTS "customer_selections_quotation_version_id_fkey";
ALTER TABLE "public"."customer_selections" ADD CONSTRAINT "customer_selections_quotation_version_id_fkey" FOREIGN KEY ("quotation_version_id") REFERENCES "public"."quotation_versions"("id") ON DELETE CASCADE;

ALTER TABLE "public"."customer_selections" DROP CONSTRAINT IF EXISTS "customer_selections_quotation_version_option_id_fkey";
ALTER TABLE "public"."customer_selections" ADD CONSTRAINT "customer_selections_quotation_version_option_id_fkey" FOREIGN KEY ("quotation_version_option_id") REFERENCES "public"."quotation_version_options"("id") ON DELETE CASCADE;

ALTER TABLE "public"."customer_selections" DROP CONSTRAINT IF EXISTS "customer_selections_quote_id_fkey";
ALTER TABLE "public"."customer_selections" ADD CONSTRAINT "customer_selections_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE CASCADE;

ALTER TABLE "public"."customs_documents" DROP CONSTRAINT IF EXISTS "customs_documents_created_by_fkey";
ALTER TABLE "public"."customs_documents" ADD CONSTRAINT "customs_documents_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;

ALTER TABLE "public"."customs_documents" DROP CONSTRAINT IF EXISTS "customs_documents_shipment_id_fkey";
ALTER TABLE "public"."customs_documents" ADD CONSTRAINT "customs_documents_shipment_id_fkey" FOREIGN KEY ("shipment_id") REFERENCES "public"."shipments"("id") ON DELETE CASCADE;

ALTER TABLE "public"."dashboard_preferences" DROP CONSTRAINT IF EXISTS "dashboard_preferences_tenant_id_fkey";
ALTER TABLE "public"."dashboard_preferences" ADD CONSTRAINT "dashboard_preferences_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");

ALTER TABLE "public"."dashboard_preferences" DROP CONSTRAINT IF EXISTS "dashboard_preferences_user_id_fkey";
ALTER TABLE "public"."dashboard_preferences" ADD CONSTRAINT "dashboard_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

ALTER TABLE "public"."document_templates" DROP CONSTRAINT IF EXISTS "document_templates_tenant_id_fkey";
ALTER TABLE "public"."document_templates" ADD CONSTRAINT "document_templates_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;

ALTER TABLE "public"."document_versions" DROP CONSTRAINT IF EXISTS "document_versions_created_by_fkey";
ALTER TABLE "public"."document_versions" ADD CONSTRAINT "document_versions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");

ALTER TABLE "public"."document_versions" DROP CONSTRAINT IF EXISTS "document_versions_document_id_fkey";
ALTER TABLE "public"."document_versions" ADD CONSTRAINT "document_versions_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE CASCADE;

ALTER TABLE "public"."documents" DROP CONSTRAINT IF EXISTS "documents_quote_id_fkey";
ALTER TABLE "public"."documents" ADD CONSTRAINT "documents_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE CASCADE;

ALTER TABLE "public"."email_account_delegations" DROP CONSTRAINT IF EXISTS "email_account_delegations_account_id_fkey";
ALTER TABLE "public"."email_account_delegations" ADD CONSTRAINT "email_account_delegations_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."email_accounts"("id") ON DELETE CASCADE;

ALTER TABLE "public"."email_account_delegations" DROP CONSTRAINT IF EXISTS "email_account_delegations_delegate_user_id_fkey";
ALTER TABLE "public"."email_account_delegations" ADD CONSTRAINT "email_account_delegations_delegate_user_id_fkey" FOREIGN KEY ("delegate_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

ALTER TABLE "public"."email_account_delegations" DROP CONSTRAINT IF EXISTS "email_account_delegations_granted_by_fkey";
ALTER TABLE "public"."email_account_delegations" ADD CONSTRAINT "email_account_delegations_granted_by_fkey" FOREIGN KEY ("granted_by") REFERENCES "auth"."users"("id");

ALTER TABLE "public"."email_audit_log" DROP CONSTRAINT IF EXISTS "email_audit_log_email_id_fkey";
ALTER TABLE "public"."email_audit_log" ADD CONSTRAINT "email_audit_log_email_id_fkey" FOREIGN KEY ("email_id") REFERENCES "public"."emails"("id") ON DELETE SET NULL;

ALTER TABLE "public"."email_audit_log" DROP CONSTRAINT IF EXISTS "email_audit_log_franchise_id_fkey";
ALTER TABLE "public"."email_audit_log" ADD CONSTRAINT "email_audit_log_franchise_id_fkey" FOREIGN KEY ("franchise_id") REFERENCES "public"."franchises"("id");

ALTER TABLE "public"."email_audit_log" DROP CONSTRAINT IF EXISTS "email_audit_log_scheduled_email_id_fkey";
ALTER TABLE "public"."email_audit_log" ADD CONSTRAINT "email_audit_log_scheduled_email_id_fkey" FOREIGN KEY ("scheduled_email_id") REFERENCES "public"."scheduled_emails"("id") ON DELETE SET NULL;

ALTER TABLE "public"."email_audit_log" DROP CONSTRAINT IF EXISTS "email_audit_log_tenant_id_fkey";
ALTER TABLE "public"."email_audit_log" ADD CONSTRAINT "email_audit_log_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");

ALTER TABLE "public"."email_audit_log" DROP CONSTRAINT IF EXISTS "email_audit_log_user_id_fkey";
ALTER TABLE "public"."email_audit_log" ADD CONSTRAINT "email_audit_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");

ALTER TABLE "public"."email_filters" DROP CONSTRAINT IF EXISTS "email_filters_account_id_fkey";
ALTER TABLE "public"."email_filters" ADD CONSTRAINT "email_filters_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."email_accounts"("id") ON DELETE CASCADE;

ALTER TABLE "public"."emails" DROP CONSTRAINT IF EXISTS "emails_account_id_crm_fkey";
ALTER TABLE "public"."emails" ADD CONSTRAINT "emails_account_id_crm_fkey" FOREIGN KEY ("account_id_crm") REFERENCES "public"."accounts"("id") ON DELETE SET NULL;

ALTER TABLE "public"."emails" DROP CONSTRAINT IF EXISTS "emails_account_id_fkey";
ALTER TABLE "public"."emails" ADD CONSTRAINT "emails_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."email_accounts"("id") ON DELETE CASCADE;

ALTER TABLE "public"."emails" DROP CONSTRAINT IF EXISTS "emails_contact_id_fkey";
ALTER TABLE "public"."emails" ADD CONSTRAINT "emails_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE SET NULL;

ALTER TABLE "public"."emails" DROP CONSTRAINT IF EXISTS "emails_lead_id_fkey";
ALTER TABLE "public"."emails" ADD CONSTRAINT "emails_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE SET NULL;

ALTER TABLE "public"."emails" DROP CONSTRAINT IF EXISTS "emails_opportunity_id_fkey";
ALTER TABLE "public"."emails" ADD CONSTRAINT "emails_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE SET NULL;

ALTER TABLE "public"."emails" DROP CONSTRAINT IF EXISTS "emails_user_id_fkey";
ALTER TABLE "public"."emails" ADD CONSTRAINT "emails_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");

ALTER TABLE "public"."entity_transfer_items" DROP CONSTRAINT IF EXISTS "entity_transfer_items_transfer_id_fkey";
ALTER TABLE "public"."entity_transfer_items" ADD CONSTRAINT "entity_transfer_items_transfer_id_fkey" FOREIGN KEY ("transfer_id") REFERENCES "public"."entity_transfers"("id") ON DELETE CASCADE;

ALTER TABLE "public"."entity_transfers" DROP CONSTRAINT IF EXISTS "entity_transfers_approved_by_fkey_profiles";
ALTER TABLE "public"."entity_transfers" ADD CONSTRAINT "entity_transfers_approved_by_fkey_profiles" FOREIGN KEY ("approved_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;

ALTER TABLE "public"."entity_transfers" DROP CONSTRAINT IF EXISTS "entity_transfers_requested_by_fkey_profiles";
ALTER TABLE "public"."entity_transfers" ADD CONSTRAINT "entity_transfers_requested_by_fkey_profiles" FOREIGN KEY ("requested_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;

ALTER TABLE "public"."entity_transfers" DROP CONSTRAINT IF EXISTS "entity_transfers_source_franchise_id_fkey";
ALTER TABLE "public"."entity_transfers" ADD CONSTRAINT "entity_transfers_source_franchise_id_fkey" FOREIGN KEY ("source_franchise_id") REFERENCES "public"."franchises"("id");

ALTER TABLE "public"."entity_transfers" DROP CONSTRAINT IF EXISTS "entity_transfers_source_tenant_id_fkey";
ALTER TABLE "public"."entity_transfers" ADD CONSTRAINT "entity_transfers_source_tenant_id_fkey" FOREIGN KEY ("source_tenant_id") REFERENCES "public"."tenants"("id");

ALTER TABLE "public"."entity_transfers" DROP CONSTRAINT IF EXISTS "entity_transfers_target_franchise_id_fkey";
ALTER TABLE "public"."entity_transfers" ADD CONSTRAINT "entity_transfers_target_franchise_id_fkey" FOREIGN KEY ("target_franchise_id") REFERENCES "public"."franchises"("id");

ALTER TABLE "public"."entity_transfers" DROP CONSTRAINT IF EXISTS "entity_transfers_target_tenant_id_fkey";
ALTER TABLE "public"."entity_transfers" ADD CONSTRAINT "entity_transfers_target_tenant_id_fkey" FOREIGN KEY ("target_tenant_id") REFERENCES "public"."tenants"("id");

ALTER TABLE "public"."accounts" DROP CONSTRAINT IF EXISTS "fk_parent_account";
ALTER TABLE "public"."accounts" ADD CONSTRAINT "fk_parent_account" FOREIGN KEY ("parent_account_id") REFERENCES "public"."accounts"("id") ON DELETE SET NULL;

ALTER TABLE "public"."quote_legs" DROP CONSTRAINT IF EXISTS "fk_quote_legs_option";
ALTER TABLE "public"."quote_legs" ADD CONSTRAINT "fk_quote_legs_option" FOREIGN KEY ("quote_option_id") REFERENCES "public"."quotation_version_options"("id") ON DELETE CASCADE;

ALTER TABLE "public"."quote_legs" DROP CONSTRAINT IF EXISTS "fk_quote_legs_tenant";
ALTER TABLE "public"."quote_legs" ADD CONSTRAINT "fk_quote_legs_tenant" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;

ALTER TABLE "public"."franchises" DROP CONSTRAINT IF EXISTS "franchises_manager_id_fkey";
ALTER TABLE "public"."franchises" ADD CONSTRAINT "franchises_manager_id_fkey" FOREIGN KEY ("manager_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;

ALTER TABLE "public"."franchises" DROP CONSTRAINT IF EXISTS "franchises_tenant_id_fkey";
ALTER TABLE "public"."franchises" ADD CONSTRAINT "franchises_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;

ALTER TABLE "public"."fx_rates" DROP CONSTRAINT IF EXISTS "fx_rates_from_currency_id_fkey";
ALTER TABLE "public"."fx_rates" ADD CONSTRAINT "fx_rates_from_currency_id_fkey" FOREIGN KEY ("from_currency_id") REFERENCES "public"."currencies"("id");

ALTER TABLE "public"."fx_rates" DROP CONSTRAINT IF EXISTS "fx_rates_to_currency_id_fkey";
ALTER TABLE "public"."fx_rates" ADD CONSTRAINT "fx_rates_to_currency_id_fkey" FOREIGN KEY ("to_currency_id") REFERENCES "public"."currencies"("id");

ALTER TABLE "public"."history_filter_presets" DROP CONSTRAINT IF EXISTS "history_filter_presets_tenant_id_fkey";
ALTER TABLE "public"."history_filter_presets" ADD CONSTRAINT "history_filter_presets_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE SET NULL;

ALTER TABLE "public"."history_filter_presets" DROP CONSTRAINT IF EXISTS "history_filter_presets_user_id_fkey";
ALTER TABLE "public"."history_filter_presets" ADD CONSTRAINT "history_filter_presets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

ALTER TABLE "public"."import_errors" DROP CONSTRAINT IF EXISTS "import_errors_import_id_fkey";
ALTER TABLE "public"."import_errors" ADD CONSTRAINT "import_errors_import_id_fkey" FOREIGN KEY ("import_id") REFERENCES "public"."import_history"("id") ON DELETE CASCADE;

ALTER TABLE "public"."import_history_details" DROP CONSTRAINT IF EXISTS "import_history_details_import_id_fkey";
ALTER TABLE "public"."import_history_details" ADD CONSTRAINT "import_history_details_import_id_fkey" FOREIGN KEY ("import_id") REFERENCES "public"."import_history"("id") ON DELETE CASCADE;

ALTER TABLE "public"."import_history" DROP CONSTRAINT IF EXISTS "import_history_imported_by_fkey";
ALTER TABLE "public"."import_history" ADD CONSTRAINT "import_history_imported_by_fkey" FOREIGN KEY ("imported_by") REFERENCES "public"."profiles"("id");

ALTER TABLE "public"."import_history" DROP CONSTRAINT IF EXISTS "import_history_reverted_by_fkey";
ALTER TABLE "public"."import_history" ADD CONSTRAINT "import_history_reverted_by_fkey" FOREIGN KEY ("reverted_by") REFERENCES "public"."profiles"("id");

ALTER TABLE "public"."import_history" DROP CONSTRAINT IF EXISTS "import_history_tenant_id_fkey";
ALTER TABLE "public"."import_history" ADD CONSTRAINT "import_history_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;

ALTER TABLE "public"."invitations" DROP CONSTRAINT IF EXISTS "invitations_franchise_id_fkey";
ALTER TABLE "public"."invitations" ADD CONSTRAINT "invitations_franchise_id_fkey" FOREIGN KEY ("franchise_id") REFERENCES "public"."franchises"("id") ON DELETE CASCADE;

ALTER TABLE "public"."invitations" DROP CONSTRAINT IF EXISTS "invitations_invited_by_fkey";
ALTER TABLE "public"."invitations" ADD CONSTRAINT "invitations_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "public"."profiles"("id");

ALTER TABLE "public"."invitations" DROP CONSTRAINT IF EXISTS "invitations_tenant_id_fkey";
ALTER TABLE "public"."invitations" ADD CONSTRAINT "invitations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;

ALTER TABLE "public"."lead_activities" DROP CONSTRAINT IF EXISTS "lead_activities_lead_id_fkey";
ALTER TABLE "public"."lead_activities" ADD CONSTRAINT "lead_activities_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE CASCADE;

ALTER TABLE "public"."lead_activities" DROP CONSTRAINT IF EXISTS "lead_activities_tenant_id_fkey";
ALTER TABLE "public"."lead_activities" ADD CONSTRAINT "lead_activities_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");

ALTER TABLE "public"."lead_assignment_history" DROP CONSTRAINT IF EXISTS "lead_assignment_history_assigned_by_fkey";
ALTER TABLE "public"."lead_assignment_history" ADD CONSTRAINT "lead_assignment_history_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "auth"."users"("id");

ALTER TABLE "public"."lead_assignment_history" DROP CONSTRAINT IF EXISTS "lead_assignment_history_assigned_from_fkey";
ALTER TABLE "public"."lead_assignment_history" ADD CONSTRAINT "lead_assignment_history_assigned_from_fkey" FOREIGN KEY ("assigned_from") REFERENCES "auth"."users"("id");

ALTER TABLE "public"."lead_assignment_history" DROP CONSTRAINT IF EXISTS "lead_assignment_history_assigned_to_fkey";
ALTER TABLE "public"."lead_assignment_history" ADD CONSTRAINT "lead_assignment_history_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "auth"."users"("id");

ALTER TABLE "public"."lead_assignment_history" DROP CONSTRAINT IF EXISTS "lead_assignment_history_lead_id_fkey";
ALTER TABLE "public"."lead_assignment_history" ADD CONSTRAINT "lead_assignment_history_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE CASCADE;

ALTER TABLE "public"."lead_assignment_history" DROP CONSTRAINT IF EXISTS "lead_assignment_history_rule_id_fkey";
ALTER TABLE "public"."lead_assignment_history" ADD CONSTRAINT "lead_assignment_history_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "public"."lead_assignment_rules"("id");

ALTER TABLE "public"."lead_assignment_queue" DROP CONSTRAINT IF EXISTS "lead_assignment_queue_lead_id_fkey";
ALTER TABLE "public"."lead_assignment_queue" ADD CONSTRAINT "lead_assignment_queue_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE CASCADE;

ALTER TABLE "public"."lead_assignment_rules" DROP CONSTRAINT IF EXISTS "lead_assignment_rules_assigned_queue_id_fkey";
ALTER TABLE "public"."lead_assignment_rules" ADD CONSTRAINT "lead_assignment_rules_assigned_queue_id_fkey" FOREIGN KEY ("assigned_queue_id") REFERENCES "public"."queues"("id") ON DELETE SET NULL;

ALTER TABLE "public"."lead_assignment_rules" DROP CONSTRAINT IF EXISTS "lead_assignment_rules_territory_id_fkey";
ALTER TABLE "public"."lead_assignment_rules" ADD CONSTRAINT "lead_assignment_rules_territory_id_fkey" FOREIGN KEY ("territory_id") REFERENCES "public"."territories"("id");

ALTER TABLE "public"."lead_score_config" DROP CONSTRAINT IF EXISTS "lead_score_config_tenant_id_fkey";
ALTER TABLE "public"."lead_score_config" ADD CONSTRAINT "lead_score_config_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;

ALTER TABLE "public"."lead_score_logs" DROP CONSTRAINT IF EXISTS "lead_score_logs_lead_id_fkey";
ALTER TABLE "public"."lead_score_logs" ADD CONSTRAINT "lead_score_logs_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE CASCADE;

ALTER TABLE "public"."leads" DROP CONSTRAINT IF EXISTS "leads_converted_account_id_fkey";
ALTER TABLE "public"."leads" ADD CONSTRAINT "leads_converted_account_id_fkey" FOREIGN KEY ("converted_account_id") REFERENCES "public"."accounts"("id");

ALTER TABLE "public"."leads" DROP CONSTRAINT IF EXISTS "leads_converted_contact_id_fkey";
ALTER TABLE "public"."leads" ADD CONSTRAINT "leads_converted_contact_id_fkey" FOREIGN KEY ("converted_contact_id") REFERENCES "public"."contacts"("id");

ALTER TABLE "public"."leads" DROP CONSTRAINT IF EXISTS "leads_created_by_fkey";
ALTER TABLE "public"."leads" ADD CONSTRAINT "leads_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");

ALTER TABLE "public"."leads" DROP CONSTRAINT IF EXISTS "leads_franchise_id_fkey";
ALTER TABLE "public"."leads" ADD CONSTRAINT "leads_franchise_id_fkey" FOREIGN KEY ("franchise_id") REFERENCES "public"."franchises"("id") ON DELETE SET NULL;

ALTER TABLE "public"."leads" DROP CONSTRAINT IF EXISTS "leads_owner_id_fkey";
ALTER TABLE "public"."leads" ADD CONSTRAINT "leads_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id");

ALTER TABLE "public"."leads" DROP CONSTRAINT IF EXISTS "leads_owner_queue_id_fkey";
ALTER TABLE "public"."leads" ADD CONSTRAINT "leads_owner_queue_id_fkey" FOREIGN KEY ("owner_queue_id") REFERENCES "public"."queues"("id") ON DELETE SET NULL;

ALTER TABLE "public"."leads" DROP CONSTRAINT IF EXISTS "leads_tenant_id_fkey";
ALTER TABLE "public"."leads" ADD CONSTRAINT "leads_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;

ALTER TABLE "public"."margin_profiles" DROP CONSTRAINT IF EXISTS "margin_profiles_default_method_id_fkey";
ALTER TABLE "public"."margin_profiles" ADD CONSTRAINT "margin_profiles_default_method_id_fkey" FOREIGN KEY ("default_method_id") REFERENCES "public"."margin_methods"("id");

ALTER TABLE "public"."oauth_configurations" DROP CONSTRAINT IF EXISTS "oauth_configurations_tenant_id_fkey";
ALTER TABLE "public"."oauth_configurations" ADD CONSTRAINT "oauth_configurations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;

ALTER TABLE "public"."oauth_configurations" DROP CONSTRAINT IF EXISTS "oauth_configurations_user_id_fkey";
ALTER TABLE "public"."oauth_configurations" ADD CONSTRAINT "oauth_configurations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

ALTER TABLE "public"."opportunities" DROP CONSTRAINT IF EXISTS "opportunities_account_id_fkey";
ALTER TABLE "public"."opportunities" ADD CONSTRAINT "opportunities_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE SET NULL;

ALTER TABLE "public"."opportunities" DROP CONSTRAINT IF EXISTS "opportunities_contact_id_fkey";
ALTER TABLE "public"."opportunities" ADD CONSTRAINT "opportunities_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE SET NULL;

ALTER TABLE "public"."opportunities" DROP CONSTRAINT IF EXISTS "opportunities_lead_id_fkey";
ALTER TABLE "public"."opportunities" ADD CONSTRAINT "opportunities_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE SET NULL;

ALTER TABLE "public"."opportunities" DROP CONSTRAINT IF EXISTS "opportunities_primary_quote_id_fkey";
ALTER TABLE "public"."opportunities" ADD CONSTRAINT "opportunities_primary_quote_id_fkey" FOREIGN KEY ("primary_quote_id") REFERENCES "public"."quotes"("id") ON DELETE SET NULL;

ALTER TABLE "public"."opportunity_items" DROP CONSTRAINT IF EXISTS "opportunity_items_opportunity_id_fkey";
ALTER TABLE "public"."opportunity_items" ADD CONSTRAINT "opportunity_items_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE CASCADE;

ALTER TABLE "public"."opportunity_probability_history" DROP CONSTRAINT IF EXISTS "opportunity_probability_history_changed_by_fkey";
ALTER TABLE "public"."opportunity_probability_history" ADD CONSTRAINT "opportunity_probability_history_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "auth"."users"("id");

ALTER TABLE "public"."opportunity_probability_history" DROP CONSTRAINT IF EXISTS "opportunity_probability_history_opportunity_id_fkey";
ALTER TABLE "public"."opportunity_probability_history" ADD CONSTRAINT "opportunity_probability_history_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE CASCADE;

ALTER TABLE "public"."portal_tokens" DROP CONSTRAINT IF EXISTS "portal_tokens_created_by_fkey";
ALTER TABLE "public"."portal_tokens" ADD CONSTRAINT "portal_tokens_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");

ALTER TABLE "public"."portal_tokens" DROP CONSTRAINT IF EXISTS "portal_tokens_quote_id_fkey";
ALTER TABLE "public"."portal_tokens" ADD CONSTRAINT "portal_tokens_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE CASCADE;

ALTER TABLE "public"."profiles" DROP CONSTRAINT IF EXISTS "profiles_id_fkey";
ALTER TABLE "public"."profiles" ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

ALTER TABLE "public"."provider_api_configs" DROP CONSTRAINT IF EXISTS "provider_api_configs_carrier_id_fkey";
ALTER TABLE "public"."provider_api_configs" ADD CONSTRAINT "provider_api_configs_carrier_id_fkey" FOREIGN KEY ("carrier_id") REFERENCES "public"."carriers"("id") ON DELETE CASCADE;

ALTER TABLE "public"."provider_api_configs" DROP CONSTRAINT IF EXISTS "provider_api_configs_tenant_id_fkey";
ALTER TABLE "public"."provider_api_configs" ADD CONSTRAINT "provider_api_configs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;

ALTER TABLE "public"."provider_charge_mappings" DROP CONSTRAINT IF EXISTS "provider_charge_mappings_carrier_id_fkey";
ALTER TABLE "public"."provider_charge_mappings" ADD CONSTRAINT "provider_charge_mappings_carrier_id_fkey" FOREIGN KEY ("carrier_id") REFERENCES "public"."carriers"("id") ON DELETE CASCADE;

ALTER TABLE "public"."provider_charge_mappings" DROP CONSTRAINT IF EXISTS "provider_charge_mappings_charge_basis_id_fkey";
ALTER TABLE "public"."provider_charge_mappings" ADD CONSTRAINT "provider_charge_mappings_charge_basis_id_fkey" FOREIGN KEY ("charge_basis_id") REFERENCES "public"."charge_bases"("id") ON DELETE SET NULL;

ALTER TABLE "public"."provider_charge_mappings" DROP CONSTRAINT IF EXISTS "provider_charge_mappings_charge_category_id_fkey";
ALTER TABLE "public"."provider_charge_mappings" ADD CONSTRAINT "provider_charge_mappings_charge_category_id_fkey" FOREIGN KEY ("charge_category_id") REFERENCES "public"."charge_categories"("id") ON DELETE SET NULL;

ALTER TABLE "public"."provider_charge_mappings" DROP CONSTRAINT IF EXISTS "provider_charge_mappings_currency_id_fkey";
ALTER TABLE "public"."provider_charge_mappings" ADD CONSTRAINT "provider_charge_mappings_currency_id_fkey" FOREIGN KEY ("currency_id") REFERENCES "public"."currencies"("id") ON DELETE SET NULL;

ALTER TABLE "public"."provider_charge_mappings" DROP CONSTRAINT IF EXISTS "provider_charge_mappings_tenant_id_fkey";
ALTER TABLE "public"."provider_charge_mappings" ADD CONSTRAINT "provider_charge_mappings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;

ALTER TABLE "public"."provider_rate_rules" DROP CONSTRAINT IF EXISTS "provider_rate_rules_carrier_id_fkey";
ALTER TABLE "public"."provider_rate_rules" ADD CONSTRAINT "provider_rate_rules_carrier_id_fkey" FOREIGN KEY ("carrier_id") REFERENCES "public"."carriers"("id") ON DELETE CASCADE;

ALTER TABLE "public"."provider_rate_rules" DROP CONSTRAINT IF EXISTS "provider_rate_rules_service_type_id_fkey";
ALTER TABLE "public"."provider_rate_rules" ADD CONSTRAINT "provider_rate_rules_service_type_id_fkey" FOREIGN KEY ("service_type_id") REFERENCES "public"."service_types"("id") ON DELETE CASCADE;

ALTER TABLE "public"."provider_rate_rules" DROP CONSTRAINT IF EXISTS "provider_rate_rules_tenant_id_fkey";
ALTER TABLE "public"."provider_rate_rules" ADD CONSTRAINT "provider_rate_rules_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;

ALTER TABLE "public"."provider_rate_templates" DROP CONSTRAINT IF EXISTS "provider_rate_templates_carrier_id_fkey";
ALTER TABLE "public"."provider_rate_templates" ADD CONSTRAINT "provider_rate_templates_carrier_id_fkey" FOREIGN KEY ("carrier_id") REFERENCES "public"."carriers"("id") ON DELETE CASCADE;

ALTER TABLE "public"."provider_rate_templates" DROP CONSTRAINT IF EXISTS "provider_rate_templates_service_type_id_fkey";
ALTER TABLE "public"."provider_rate_templates" ADD CONSTRAINT "provider_rate_templates_service_type_id_fkey" FOREIGN KEY ("service_type_id") REFERENCES "public"."service_types"("id") ON DELETE SET NULL;

ALTER TABLE "public"."provider_rate_templates" DROP CONSTRAINT IF EXISTS "provider_rate_templates_tenant_id_fkey";
ALTER TABLE "public"."provider_rate_templates" ADD CONSTRAINT "provider_rate_templates_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;

ALTER TABLE "public"."provider_surcharges" DROP CONSTRAINT IF EXISTS "provider_surcharges_carrier_id_fkey";
ALTER TABLE "public"."provider_surcharges" ADD CONSTRAINT "provider_surcharges_carrier_id_fkey" FOREIGN KEY ("carrier_id") REFERENCES "public"."carriers"("id") ON DELETE CASCADE;

ALTER TABLE "public"."provider_surcharges" DROP CONSTRAINT IF EXISTS "provider_surcharges_currency_id_fkey";
ALTER TABLE "public"."provider_surcharges" ADD CONSTRAINT "provider_surcharges_currency_id_fkey" FOREIGN KEY ("currency_id") REFERENCES "public"."currencies"("id") ON DELETE SET NULL;

ALTER TABLE "public"."provider_surcharges" DROP CONSTRAINT IF EXISTS "provider_surcharges_tenant_id_fkey";
ALTER TABLE "public"."provider_surcharges" ADD CONSTRAINT "provider_surcharges_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;

ALTER TABLE "public"."queue_members" DROP CONSTRAINT IF EXISTS "queue_members_queue_id_fkey";
ALTER TABLE "public"."queue_members" ADD CONSTRAINT "queue_members_queue_id_fkey" FOREIGN KEY ("queue_id") REFERENCES "public"."queues"("id") ON DELETE CASCADE;

ALTER TABLE "public"."queue_members" DROP CONSTRAINT IF EXISTS "queue_members_user_id_fkey";
ALTER TABLE "public"."queue_members" ADD CONSTRAINT "queue_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;

ALTER TABLE "public"."queues" DROP CONSTRAINT IF EXISTS "queues_franchise_id_fkey";
ALTER TABLE "public"."queues" ADD CONSTRAINT "queues_franchise_id_fkey" FOREIGN KEY ("franchise_id") REFERENCES "public"."franchises"("id") ON DELETE SET NULL;

ALTER TABLE "public"."queues" DROP CONSTRAINT IF EXISTS "queues_tenant_id_fkey";
ALTER TABLE "public"."queues" ADD CONSTRAINT "queues_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;

ALTER TABLE "public"."quotation_audit_log" DROP CONSTRAINT IF EXISTS "quotation_audit_log_quotation_version_id_fkey";
ALTER TABLE "public"."quotation_audit_log" ADD CONSTRAINT "quotation_audit_log_quotation_version_id_fkey" FOREIGN KEY ("quotation_version_id") REFERENCES "public"."quotation_versions"("id") ON DELETE SET NULL;

ALTER TABLE "public"."quotation_audit_log" DROP CONSTRAINT IF EXISTS "quotation_audit_log_quotation_version_option_id_fkey";
ALTER TABLE "public"."quotation_audit_log" ADD CONSTRAINT "quotation_audit_log_quotation_version_option_id_fkey" FOREIGN KEY ("quotation_version_option_id") REFERENCES "public"."quotation_version_options"("id") ON DELETE SET NULL;

ALTER TABLE "public"."quotation_audit_log" DROP CONSTRAINT IF EXISTS "quotation_audit_log_quote_id_fkey";
ALTER TABLE "public"."quotation_audit_log" ADD CONSTRAINT "quotation_audit_log_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE CASCADE;

ALTER TABLE "public"."quotation_audit_log" DROP CONSTRAINT IF EXISTS "quotation_audit_log_tenant_id_fkey";
ALTER TABLE "public"."quotation_audit_log" ADD CONSTRAINT "quotation_audit_log_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;

ALTER TABLE "public"."quotation_audit_log" DROP CONSTRAINT IF EXISTS "quotation_audit_log_user_id_fkey";
ALTER TABLE "public"."quotation_audit_log" ADD CONSTRAINT "quotation_audit_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;

ALTER TABLE "public"."quotation_selection_events" DROP CONSTRAINT IF EXISTS "quotation_selection_events_quotation_version_id_fkey";
ALTER TABLE "public"."quotation_selection_events" ADD CONSTRAINT "quotation_selection_events_quotation_version_id_fkey" FOREIGN KEY ("quotation_version_id") REFERENCES "public"."quotation_versions"("id") ON DELETE CASCADE;

ALTER TABLE "public"."quotation_selection_events" DROP CONSTRAINT IF EXISTS "quotation_selection_events_quote_id_fkey";
ALTER TABLE "public"."quotation_selection_events" ADD CONSTRAINT "quotation_selection_events_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE CASCADE;

ALTER TABLE "public"."quotation_selection_events" DROP CONSTRAINT IF EXISTS "quotation_selection_events_selected_option_id_fkey";
ALTER TABLE "public"."quotation_selection_events" ADD CONSTRAINT "quotation_selection_events_selected_option_id_fkey" FOREIGN KEY ("selected_option_id") REFERENCES "public"."quotation_version_options"("id") ON DELETE RESTRICT;

ALTER TABLE "public"."quotation_version_option_legs" DROP CONSTRAINT IF EXISTS "quotation_version_option_legs_franchise_id_fkey";
ALTER TABLE "public"."quotation_version_option_legs" ADD CONSTRAINT "quotation_version_option_legs_franchise_id_fkey" FOREIGN KEY ("franchise_id") REFERENCES "public"."franchises"("id");

ALTER TABLE "public"."quotation_version_option_legs" DROP CONSTRAINT IF EXISTS "quotation_version_option_legs_mode_id_fkey";
ALTER TABLE "public"."quotation_version_option_legs" ADD CONSTRAINT "quotation_version_option_legs_mode_id_fkey" FOREIGN KEY ("mode_id") REFERENCES "public"."service_modes"("id");

ALTER TABLE "public"."quotation_version_option_legs" DROP CONSTRAINT IF EXISTS "quotation_version_option_legs_provider_id_fkey";
ALTER TABLE "public"."quotation_version_option_legs" ADD CONSTRAINT "quotation_version_option_legs_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."carriers"("id");

ALTER TABLE "public"."quotation_version_option_legs" DROP CONSTRAINT IF EXISTS "quotation_version_option_legs_quotation_version_option_id_fkey";
ALTER TABLE "public"."quotation_version_option_legs" ADD CONSTRAINT "quotation_version_option_legs_quotation_version_option_id_fkey" FOREIGN KEY ("quotation_version_option_id") REFERENCES "public"."quotation_version_options"("id") ON DELETE CASCADE;

ALTER TABLE "public"."quotation_version_option_legs" DROP CONSTRAINT IF EXISTS "quotation_version_option_legs_service_id_fkey";
ALTER TABLE "public"."quotation_version_option_legs" ADD CONSTRAINT "quotation_version_option_legs_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id");

ALTER TABLE "public"."quotation_version_option_legs" DROP CONSTRAINT IF EXISTS "quotation_version_option_legs_service_type_id_fkey";
ALTER TABLE "public"."quotation_version_option_legs" ADD CONSTRAINT "quotation_version_option_legs_service_type_id_fkey" FOREIGN KEY ("service_type_id") REFERENCES "public"."service_types"("id");

ALTER TABLE "public"."quotation_version_options" DROP CONSTRAINT IF EXISTS "quotation_version_options_created_by_fkey";
ALTER TABLE "public"."quotation_version_options" ADD CONSTRAINT "quotation_version_options_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");

ALTER TABLE "public"."quotation_version_options" DROP CONSTRAINT IF EXISTS "quotation_version_options_franchise_id_fkey";
ALTER TABLE "public"."quotation_version_options" ADD CONSTRAINT "quotation_version_options_franchise_id_fkey" FOREIGN KEY ("franchise_id") REFERENCES "public"."franchises"("id");

ALTER TABLE "public"."quotation_version_options" DROP CONSTRAINT IF EXISTS "quotation_version_options_margin_method_id_fkey";
ALTER TABLE "public"."quotation_version_options" ADD CONSTRAINT "quotation_version_options_margin_method_id_fkey" FOREIGN KEY ("margin_method_id") REFERENCES "public"."margin_methods"("id");

ALTER TABLE "public"."quotation_version_options" DROP CONSTRAINT IF EXISTS "quotation_version_options_provider_type_id_fkey";
ALTER TABLE "public"."quotation_version_options" ADD CONSTRAINT "quotation_version_options_provider_type_id_fkey" FOREIGN KEY ("provider_type_id") REFERENCES "public"."provider_types"("id");

ALTER TABLE "public"."quotation_version_options" DROP CONSTRAINT IF EXISTS "quotation_version_options_quotation_version_id_fkey";
ALTER TABLE "public"."quotation_version_options" ADD CONSTRAINT "quotation_version_options_quotation_version_id_fkey" FOREIGN KEY ("quotation_version_id") REFERENCES "public"."quotation_versions"("id") ON DELETE CASCADE;

ALTER TABLE "public"."quotation_version_options" DROP CONSTRAINT IF EXISTS "quotation_version_options_quote_currency_id_fkey";
ALTER TABLE "public"."quotation_version_options" ADD CONSTRAINT "quotation_version_options_quote_currency_id_fkey" FOREIGN KEY ("quote_currency_id") REFERENCES "public"."currencies"("id");

ALTER TABLE "public"."quotation_version_options" DROP CONSTRAINT IF EXISTS "quotation_version_options_trade_direction_id_fkey";
ALTER TABLE "public"."quotation_version_options" ADD CONSTRAINT "quotation_version_options_trade_direction_id_fkey" FOREIGN KEY ("trade_direction_id") REFERENCES "public"."trade_directions"("id");

ALTER TABLE "public"."quotation_versions" DROP CONSTRAINT IF EXISTS "quotation_versions_franchise_id_fkey";
ALTER TABLE "public"."quotation_versions" ADD CONSTRAINT "quotation_versions_franchise_id_fkey" FOREIGN KEY ("franchise_id") REFERENCES "public"."franchises"("id");

ALTER TABLE "public"."quotation_versions" DROP CONSTRAINT IF EXISTS "quotation_versions_locked_by_fkey";
ALTER TABLE "public"."quotation_versions" ADD CONSTRAINT "quotation_versions_locked_by_fkey" FOREIGN KEY ("locked_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;

ALTER TABLE "public"."quotation_versions" DROP CONSTRAINT IF EXISTS "quotation_versions_quote_id_fkey";
ALTER TABLE "public"."quotation_versions" ADD CONSTRAINT "quotation_versions_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE CASCADE;

ALTER TABLE "public"."quote_acceptances" DROP CONSTRAINT IF EXISTS "quote_acceptances_quote_id_fkey";
ALTER TABLE "public"."quote_acceptances" ADD CONSTRAINT "quote_acceptances_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE CASCADE;

ALTER TABLE "public"."quote_acceptances" DROP CONSTRAINT IF EXISTS "quote_acceptances_token_id_fkey";
ALTER TABLE "public"."quote_acceptances" ADD CONSTRAINT "quote_acceptances_token_id_fkey" FOREIGN KEY ("token_id") REFERENCES "public"."portal_tokens"("id") ON DELETE CASCADE;

ALTER TABLE "public"."quote_access_logs" DROP CONSTRAINT IF EXISTS "quote_access_logs_quote_id_fkey";
ALTER TABLE "public"."quote_access_logs" ADD CONSTRAINT "quote_access_logs_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE CASCADE;

ALTER TABLE "public"."quote_access_logs" DROP CONSTRAINT IF EXISTS "quote_access_logs_quote_share_id_fkey";
ALTER TABLE "public"."quote_access_logs" ADD CONSTRAINT "quote_access_logs_quote_share_id_fkey" FOREIGN KEY ("quote_share_id") REFERENCES "public"."quote_shares"("id") ON DELETE CASCADE;

ALTER TABLE "public"."quote_charges" DROP CONSTRAINT IF EXISTS "quote_charges_basis_id_fkey";
ALTER TABLE "public"."quote_charges" ADD CONSTRAINT "quote_charges_basis_id_fkey" FOREIGN KEY ("basis_id") REFERENCES "public"."charge_bases"("id");

ALTER TABLE "public"."quote_charges" DROP CONSTRAINT IF EXISTS "quote_charges_category_id_fkey";
ALTER TABLE "public"."quote_charges" ADD CONSTRAINT "quote_charges_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."charge_categories"("id");

ALTER TABLE "public"."quote_charges" DROP CONSTRAINT IF EXISTS "quote_charges_charge_side_id_fkey";
ALTER TABLE "public"."quote_charges" ADD CONSTRAINT "quote_charges_charge_side_id_fkey" FOREIGN KEY ("charge_side_id") REFERENCES "public"."charge_sides"("id");

ALTER TABLE "public"."quote_charges" DROP CONSTRAINT IF EXISTS "quote_charges_currency_id_fkey";
ALTER TABLE "public"."quote_charges" ADD CONSTRAINT "quote_charges_currency_id_fkey" FOREIGN KEY ("currency_id") REFERENCES "public"."currencies"("id");

ALTER TABLE "public"."quote_charges" DROP CONSTRAINT IF EXISTS "quote_charges_franchise_id_fkey";
ALTER TABLE "public"."quote_charges" ADD CONSTRAINT "quote_charges_franchise_id_fkey" FOREIGN KEY ("franchise_id") REFERENCES "public"."franchises"("id");

ALTER TABLE "public"."quote_charges" DROP CONSTRAINT IF EXISTS "quote_charges_leg_id_fkey";
ALTER TABLE "public"."quote_charges" ADD CONSTRAINT "quote_charges_leg_id_fkey" FOREIGN KEY ("leg_id") REFERENCES "public"."quote_option_legs"("id") ON DELETE SET NULL;

ALTER TABLE "public"."quote_charges" DROP CONSTRAINT IF EXISTS "quote_charges_quote_option_id_fkey";
ALTER TABLE "public"."quote_charges" ADD CONSTRAINT "quote_charges_quote_option_id_fkey" FOREIGN KEY ("quote_option_id") REFERENCES "public"."quotation_version_options"("id") ON DELETE CASCADE;

ALTER TABLE "public"."quote_comments" DROP CONSTRAINT IF EXISTS "quote_comments_author_user_id_fkey";
ALTER TABLE "public"."quote_comments" ADD CONSTRAINT "quote_comments_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "public"."profiles"("id");

ALTER TABLE "public"."quote_comments" DROP CONSTRAINT IF EXISTS "quote_comments_quote_id_fkey";
ALTER TABLE "public"."quote_comments" ADD CONSTRAINT "quote_comments_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE CASCADE;

ALTER TABLE "public"."quote_comments" DROP CONSTRAINT IF EXISTS "quote_comments_tenant_id_fkey";
ALTER TABLE "public"."quote_comments" ADD CONSTRAINT "quote_comments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;

ALTER TABLE "public"."quote_documents" DROP CONSTRAINT IF EXISTS "quote_documents_quote_id_fkey";
ALTER TABLE "public"."quote_documents" ADD CONSTRAINT "quote_documents_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE CASCADE;

ALTER TABLE "public"."quote_documents" DROP CONSTRAINT IF EXISTS "quote_documents_tenant_id_fkey";
ALTER TABLE "public"."quote_documents" ADD CONSTRAINT "quote_documents_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;

ALTER TABLE "public"."quote_email_history" DROP CONSTRAINT IF EXISTS "quote_email_history_quote_id_fkey";
ALTER TABLE "public"."quote_email_history" ADD CONSTRAINT "quote_email_history_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE CASCADE;

ALTER TABLE "public"."quote_email_history" DROP CONSTRAINT IF EXISTS "quote_email_history_tenant_id_fkey";
ALTER TABLE "public"."quote_email_history" ADD CONSTRAINT "quote_email_history_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;

ALTER TABLE "public"."quote_events" DROP CONSTRAINT IF EXISTS "quote_events_quote_id_fkey";
ALTER TABLE "public"."quote_events" ADD CONSTRAINT "quote_events_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE CASCADE;

ALTER TABLE "public"."quote_items" DROP CONSTRAINT IF EXISTS "quote_items_quote_id_fkey";
ALTER TABLE "public"."quote_items" ADD CONSTRAINT "quote_items_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE CASCADE;

ALTER TABLE "public"."quote_items" DROP CONSTRAINT IF EXISTS "quote_items_service_type_id_fkey";
ALTER TABLE "public"."quote_items" ADD CONSTRAINT "quote_items_service_type_id_fkey" FOREIGN KEY ("service_type_id") REFERENCES "public"."service_types"("id");

ALTER TABLE "public"."quote_number_config_franchise" DROP CONSTRAINT IF EXISTS "quote_number_config_franchise_franchise_id_fkey";
ALTER TABLE "public"."quote_number_config_franchise" ADD CONSTRAINT "quote_number_config_franchise_franchise_id_fkey" FOREIGN KEY ("franchise_id") REFERENCES "public"."franchises"("id") ON DELETE CASCADE;

ALTER TABLE "public"."quote_number_config_franchise" DROP CONSTRAINT IF EXISTS "quote_number_config_franchise_tenant_id_fkey";
ALTER TABLE "public"."quote_number_config_franchise" ADD CONSTRAINT "quote_number_config_franchise_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;

ALTER TABLE "public"."quote_number_config_tenant" DROP CONSTRAINT IF EXISTS "quote_number_config_tenant_tenant_id_fkey";
ALTER TABLE "public"."quote_number_config_tenant" ADD CONSTRAINT "quote_number_config_tenant_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;

ALTER TABLE "public"."quote_number_sequences" DROP CONSTRAINT IF EXISTS "quote_number_sequences_franchise_id_fkey";
ALTER TABLE "public"."quote_number_sequences" ADD CONSTRAINT "quote_number_sequences_franchise_id_fkey" FOREIGN KEY ("franchise_id") REFERENCES "public"."franchises"("id") ON DELETE CASCADE;

ALTER TABLE "public"."quote_number_sequences" DROP CONSTRAINT IF EXISTS "quote_number_sequences_tenant_id_fkey";
ALTER TABLE "public"."quote_number_sequences" ADD CONSTRAINT "quote_number_sequences_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;

ALTER TABLE "public"."quote_option_legs" DROP CONSTRAINT IF EXISTS "quote_option_legs_container_size_id_fkey";
ALTER TABLE "public"."quote_option_legs" ADD CONSTRAINT "quote_option_legs_container_size_id_fkey" FOREIGN KEY ("container_size_id") REFERENCES "public"."container_sizes"("id");

ALTER TABLE "public"."quote_option_legs" DROP CONSTRAINT IF EXISTS "quote_option_legs_container_type_id_fkey";
ALTER TABLE "public"."quote_option_legs" ADD CONSTRAINT "quote_option_legs_container_type_id_fkey" FOREIGN KEY ("container_type_id") REFERENCES "public"."container_types"("id");

ALTER TABLE "public"."quote_option_legs" DROP CONSTRAINT IF EXISTS "quote_option_legs_leg_currency_id_fkey";
ALTER TABLE "public"."quote_option_legs" ADD CONSTRAINT "quote_option_legs_leg_currency_id_fkey" FOREIGN KEY ("leg_currency_id") REFERENCES "public"."currencies"("id");

ALTER TABLE "public"."quote_option_legs" DROP CONSTRAINT IF EXISTS "quote_option_legs_mode_id_fkey";
ALTER TABLE "public"."quote_option_legs" ADD CONSTRAINT "quote_option_legs_mode_id_fkey" FOREIGN KEY ("mode_id") REFERENCES "public"."service_modes"("id");

ALTER TABLE "public"."quote_option_legs" DROP CONSTRAINT IF EXISTS "quote_option_legs_provider_id_fkey";
ALTER TABLE "public"."quote_option_legs" ADD CONSTRAINT "quote_option_legs_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."carriers"("id");

ALTER TABLE "public"."quote_option_legs" DROP CONSTRAINT IF EXISTS "quote_option_legs_quote_option_id_fkey";
ALTER TABLE "public"."quote_option_legs" ADD CONSTRAINT "quote_option_legs_quote_option_id_fkey" FOREIGN KEY ("quote_option_id") REFERENCES "public"."quote_options"("id") ON DELETE CASCADE;

ALTER TABLE "public"."quote_option_legs" DROP CONSTRAINT IF EXISTS "quote_option_legs_service_id_fkey";
ALTER TABLE "public"."quote_option_legs" ADD CONSTRAINT "quote_option_legs_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id");

ALTER TABLE "public"."quote_option_legs" DROP CONSTRAINT IF EXISTS "quote_option_legs_service_type_id_fkey";
ALTER TABLE "public"."quote_option_legs" ADD CONSTRAINT "quote_option_legs_service_type_id_fkey" FOREIGN KEY ("service_type_id") REFERENCES "public"."service_types"("id");

ALTER TABLE "public"."quote_option_legs" DROP CONSTRAINT IF EXISTS "quote_option_legs_trade_direction_id_fkey";
ALTER TABLE "public"."quote_option_legs" ADD CONSTRAINT "quote_option_legs_trade_direction_id_fkey" FOREIGN KEY ("trade_direction_id") REFERENCES "public"."trade_directions"("id");

ALTER TABLE "public"."quote_options" DROP CONSTRAINT IF EXISTS "quote_options_container_size_id_fkey";
ALTER TABLE "public"."quote_options" ADD CONSTRAINT "quote_options_container_size_id_fkey" FOREIGN KEY ("container_size_id") REFERENCES "public"."container_sizes"("id");

ALTER TABLE "public"."quote_options" DROP CONSTRAINT IF EXISTS "quote_options_container_type_id_fkey";
ALTER TABLE "public"."quote_options" ADD CONSTRAINT "quote_options_container_type_id_fkey" FOREIGN KEY ("container_type_id") REFERENCES "public"."container_types"("id");

ALTER TABLE "public"."quote_options" DROP CONSTRAINT IF EXISTS "quote_options_currency_id_fkey";
ALTER TABLE "public"."quote_options" ADD CONSTRAINT "quote_options_currency_id_fkey" FOREIGN KEY ("currency_id") REFERENCES "public"."currencies"("id");

ALTER TABLE "public"."quote_options" DROP CONSTRAINT IF EXISTS "quote_options_destination_port_id_fkey";
ALTER TABLE "public"."quote_options" ADD CONSTRAINT "quote_options_destination_port_id_fkey" FOREIGN KEY ("destination_port_id") REFERENCES "public"."ports_locations"("id");

ALTER TABLE "public"."quote_options" DROP CONSTRAINT IF EXISTS "quote_options_margin_method_id_fkey";
ALTER TABLE "public"."quote_options" ADD CONSTRAINT "quote_options_margin_method_id_fkey" FOREIGN KEY ("margin_method_id") REFERENCES "public"."margin_methods"("id");

ALTER TABLE "public"."quote_options" DROP CONSTRAINT IF EXISTS "quote_options_origin_port_id_fkey";
ALTER TABLE "public"."quote_options" ADD CONSTRAINT "quote_options_origin_port_id_fkey" FOREIGN KEY ("origin_port_id") REFERENCES "public"."ports_locations"("id");

ALTER TABLE "public"."quote_options" DROP CONSTRAINT IF EXISTS "quote_options_package_category_id_fkey";
ALTER TABLE "public"."quote_options" ADD CONSTRAINT "quote_options_package_category_id_fkey" FOREIGN KEY ("package_category_id") REFERENCES "public"."package_categories"("id");

ALTER TABLE "public"."quote_options" DROP CONSTRAINT IF EXISTS "quote_options_package_size_id_fkey";
ALTER TABLE "public"."quote_options" ADD CONSTRAINT "quote_options_package_size_id_fkey" FOREIGN KEY ("package_size_id") REFERENCES "public"."package_sizes"("id");

ALTER TABLE "public"."quote_options" DROP CONSTRAINT IF EXISTS "quote_options_provider_id_fkey";
ALTER TABLE "public"."quote_options" ADD CONSTRAINT "quote_options_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."carriers"("id");

ALTER TABLE "public"."quote_options" DROP CONSTRAINT IF EXISTS "quote_options_provider_type_id_fkey";
ALTER TABLE "public"."quote_options" ADD CONSTRAINT "quote_options_provider_type_id_fkey" FOREIGN KEY ("provider_type_id") REFERENCES "public"."provider_types"("id");

ALTER TABLE "public"."quote_options" DROP CONSTRAINT IF EXISTS "quote_options_quote_currency_id_fkey";
ALTER TABLE "public"."quote_options" ADD CONSTRAINT "quote_options_quote_currency_id_fkey" FOREIGN KEY ("quote_currency_id") REFERENCES "public"."currencies"("id");

ALTER TABLE "public"."quote_options" DROP CONSTRAINT IF EXISTS "quote_options_quote_version_id_fkey";
ALTER TABLE "public"."quote_options" ADD CONSTRAINT "quote_options_quote_version_id_fkey" FOREIGN KEY ("quote_version_id") REFERENCES "public"."quotation_versions"("id") ON DELETE CASCADE;

ALTER TABLE "public"."quote_options" DROP CONSTRAINT IF EXISTS "quote_options_service_id_fkey";
ALTER TABLE "public"."quote_options" ADD CONSTRAINT "quote_options_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id");

ALTER TABLE "public"."quote_options" DROP CONSTRAINT IF EXISTS "quote_options_service_type_id_fkey";
ALTER TABLE "public"."quote_options" ADD CONSTRAINT "quote_options_service_type_id_fkey" FOREIGN KEY ("service_type_id") REFERENCES "public"."service_types"("id");

ALTER TABLE "public"."quote_options" DROP CONSTRAINT IF EXISTS "quote_options_trade_direction_id_fkey";
ALTER TABLE "public"."quote_options" ADD CONSTRAINT "quote_options_trade_direction_id_fkey" FOREIGN KEY ("trade_direction_id") REFERENCES "public"."trade_directions"("id");

ALTER TABLE "public"."quote_presentation_templates" DROP CONSTRAINT IF EXISTS "quote_presentation_templates_franchise_id_fkey";
ALTER TABLE "public"."quote_presentation_templates" ADD CONSTRAINT "quote_presentation_templates_franchise_id_fkey" FOREIGN KEY ("franchise_id") REFERENCES "public"."franchises"("id") ON DELETE CASCADE;
