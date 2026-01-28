

ALTER TABLE "public"."quote_presentation_templates" DROP CONSTRAINT IF EXISTS "quote_presentation_templates_tenant_id_fkey";
ALTER TABLE "public"."quote_presentation_templates" ADD CONSTRAINT "quote_presentation_templates_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;

ALTER TABLE "public"."quote_selection" DROP CONSTRAINT IF EXISTS "quote_selection_option_id_fkey";
ALTER TABLE "public"."quote_selection" ADD CONSTRAINT "quote_selection_option_id_fkey" FOREIGN KEY ("option_id") REFERENCES "public"."quote_options"("id") ON DELETE CASCADE;

ALTER TABLE "public"."quote_selection" DROP CONSTRAINT IF EXISTS "quote_selection_quote_id_fkey";
ALTER TABLE "public"."quote_selection" ADD CONSTRAINT "quote_selection_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE CASCADE;

ALTER TABLE "public"."quote_selection" DROP CONSTRAINT IF EXISTS "quote_selection_selected_by_fkey";
ALTER TABLE "public"."quote_selection" ADD CONSTRAINT "quote_selection_selected_by_fkey" FOREIGN KEY ("selected_by") REFERENCES "public"."profiles"("id");

ALTER TABLE "public"."quote_selection" DROP CONSTRAINT IF EXISTS "quote_selection_version_id_fkey";
ALTER TABLE "public"."quote_selection" ADD CONSTRAINT "quote_selection_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "public"."quotation_versions"("id") ON DELETE CASCADE;

ALTER TABLE "public"."quote_shares" DROP CONSTRAINT IF EXISTS "quote_shares_created_by_fkey";
ALTER TABLE "public"."quote_shares" ADD CONSTRAINT "quote_shares_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");

ALTER TABLE "public"."quote_shares" DROP CONSTRAINT IF EXISTS "quote_shares_quote_id_fkey";
ALTER TABLE "public"."quote_shares" ADD CONSTRAINT "quote_shares_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE CASCADE;

ALTER TABLE "public"."quote_shares" DROP CONSTRAINT IF EXISTS "quote_shares_tenant_id_fkey";
ALTER TABLE "public"."quote_shares" ADD CONSTRAINT "quote_shares_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;

ALTER TABLE "public"."quote_templates" DROP CONSTRAINT IF EXISTS "quote_templates_created_by_fkey";
ALTER TABLE "public"."quote_templates" ADD CONSTRAINT "quote_templates_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");

ALTER TABLE "public"."quote_templates" DROP CONSTRAINT IF EXISTS "quote_templates_tenant_id_fkey";
ALTER TABLE "public"."quote_templates" ADD CONSTRAINT "quote_templates_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");

ALTER TABLE "public"."quote_templates" DROP CONSTRAINT IF EXISTS "quote_templates_updated_by_fkey";
ALTER TABLE "public"."quote_templates" ADD CONSTRAINT "quote_templates_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id");

ALTER TABLE "public"."quote_versions" DROP CONSTRAINT IF EXISTS "quote_versions_quote_id_fkey";
ALTER TABLE "public"."quote_versions" ADD CONSTRAINT "quote_versions_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE CASCADE;

ALTER TABLE "public"."quotes" DROP CONSTRAINT IF EXISTS "quotes_account_id_fkey";
ALTER TABLE "public"."quotes" ADD CONSTRAINT "quotes_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE SET NULL;

ALTER TABLE "public"."quotes" DROP CONSTRAINT IF EXISTS "quotes_consignee_id_fkey";
ALTER TABLE "public"."quotes" ADD CONSTRAINT "quotes_consignee_id_fkey" FOREIGN KEY ("consignee_id") REFERENCES "public"."consignees"("id");

ALTER TABLE "public"."quotes" DROP CONSTRAINT IF EXISTS "quotes_contact_id_fkey";
ALTER TABLE "public"."quotes" ADD CONSTRAINT "quotes_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE SET NULL;

ALTER TABLE "public"."quotes" DROP CONSTRAINT IF EXISTS "quotes_current_version_id_fkey";
ALTER TABLE "public"."quotes" ADD CONSTRAINT "quotes_current_version_id_fkey" FOREIGN KEY ("current_version_id") REFERENCES "public"."quotation_versions"("id") ON DELETE SET NULL;

ALTER TABLE "public"."quotes" DROP CONSTRAINT IF EXISTS "quotes_destination_port_id_fkey";
ALTER TABLE "public"."quotes" ADD CONSTRAINT "quotes_destination_port_id_fkey" FOREIGN KEY ("destination_port_id") REFERENCES "public"."ports_locations"("id");

ALTER TABLE "public"."quotes" DROP CONSTRAINT IF EXISTS "quotes_opportunity_id_fkey";
ALTER TABLE "public"."quotes" ADD CONSTRAINT "quotes_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE SET NULL;

ALTER TABLE "public"."quotes" DROP CONSTRAINT IF EXISTS "quotes_origin_port_id_fkey";
ALTER TABLE "public"."quotes" ADD CONSTRAINT "quotes_origin_port_id_fkey" FOREIGN KEY ("origin_port_id") REFERENCES "public"."ports_locations"("id");

ALTER TABLE "public"."quotes" DROP CONSTRAINT IF EXISTS "quotes_service_id_fkey";
ALTER TABLE "public"."quotes" ADD CONSTRAINT "quotes_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id");

ALTER TABLE "public"."quotes" DROP CONSTRAINT IF EXISTS "quotes_service_type_id_fkey";
ALTER TABLE "public"."quotes" ADD CONSTRAINT "quotes_service_type_id_fkey" FOREIGN KEY ("service_type_id") REFERENCES "public"."service_types"("id");

ALTER TABLE "public"."rate_calculations" DROP CONSTRAINT IF EXISTS "rate_calculations_calculated_by_fkey";
ALTER TABLE "public"."rate_calculations" ADD CONSTRAINT "rate_calculations_calculated_by_fkey" FOREIGN KEY ("calculated_by") REFERENCES "auth"."users"("id");

ALTER TABLE "public"."rate_calculations" DROP CONSTRAINT IF EXISTS "rate_calculations_carrier_rate_id_fkey";
ALTER TABLE "public"."rate_calculations" ADD CONSTRAINT "rate_calculations_carrier_rate_id_fkey" FOREIGN KEY ("carrier_rate_id") REFERENCES "public"."carrier_rates"("id");

ALTER TABLE "public"."rate_calculations" DROP CONSTRAINT IF EXISTS "rate_calculations_quote_id_fkey";
ALTER TABLE "public"."rate_calculations" ADD CONSTRAINT "rate_calculations_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE CASCADE;

ALTER TABLE "public"."rate_calculations" DROP CONSTRAINT IF EXISTS "rate_calculations_service_id_fkey";
ALTER TABLE "public"."rate_calculations" ADD CONSTRAINT "rate_calculations_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id");

ALTER TABLE "public"."rate_components" DROP CONSTRAINT IF EXISTS "rate_components_rate_id_fkey";
ALTER TABLE "public"."rate_components" ADD CONSTRAINT "rate_components_rate_id_fkey" FOREIGN KEY ("rate_id") REFERENCES "public"."rates"("id") ON DELETE CASCADE;

ALTER TABLE "public"."rates" DROP CONSTRAINT IF EXISTS "rates_carrier_id_fkey";
ALTER TABLE "public"."rates" ADD CONSTRAINT "rates_carrier_id_fkey" FOREIGN KEY ("carrier_id") REFERENCES "public"."carriers"("id") ON DELETE SET NULL;

ALTER TABLE "public"."routes" DROP CONSTRAINT IF EXISTS "routes_destination_warehouse_id_fkey";
ALTER TABLE "public"."routes" ADD CONSTRAINT "routes_destination_warehouse_id_fkey" FOREIGN KEY ("destination_warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE SET NULL;

ALTER TABLE "public"."routes" DROP CONSTRAINT IF EXISTS "routes_franchise_id_fkey";
ALTER TABLE "public"."routes" ADD CONSTRAINT "routes_franchise_id_fkey" FOREIGN KEY ("franchise_id") REFERENCES "public"."franchises"("id") ON DELETE SET NULL;

ALTER TABLE "public"."routes" DROP CONSTRAINT IF EXISTS "routes_origin_warehouse_id_fkey";
ALTER TABLE "public"."routes" ADD CONSTRAINT "routes_origin_warehouse_id_fkey" FOREIGN KEY ("origin_warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE SET NULL;

ALTER TABLE "public"."routes" DROP CONSTRAINT IF EXISTS "routes_tenant_id_fkey";
ALTER TABLE "public"."routes" ADD CONSTRAINT "routes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;

ALTER TABLE "public"."scheduled_emails" DROP CONSTRAINT IF EXISTS "scheduled_emails_account_id_fkey";
ALTER TABLE "public"."scheduled_emails" ADD CONSTRAINT "scheduled_emails_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."email_accounts"("id");

ALTER TABLE "public"."scheduled_emails" DROP CONSTRAINT IF EXISTS "scheduled_emails_franchise_id_fkey";
ALTER TABLE "public"."scheduled_emails" ADD CONSTRAINT "scheduled_emails_franchise_id_fkey" FOREIGN KEY ("franchise_id") REFERENCES "public"."franchises"("id");

ALTER TABLE "public"."scheduled_emails" DROP CONSTRAINT IF EXISTS "scheduled_emails_template_id_fkey";
ALTER TABLE "public"."scheduled_emails" ADD CONSTRAINT "scheduled_emails_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."email_templates"("id");

ALTER TABLE "public"."scheduled_emails" DROP CONSTRAINT IF EXISTS "scheduled_emails_tenant_id_fkey";
ALTER TABLE "public"."scheduled_emails" ADD CONSTRAINT "scheduled_emails_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");

ALTER TABLE "public"."scheduled_emails" DROP CONSTRAINT IF EXISTS "scheduled_emails_user_id_fkey";
ALTER TABLE "public"."scheduled_emails" ADD CONSTRAINT "scheduled_emails_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");

ALTER TABLE "public"."service_details" DROP CONSTRAINT IF EXISTS "service_details_service_id_fkey";
ALTER TABLE "public"."service_details" ADD CONSTRAINT "service_details_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE CASCADE;

ALTER TABLE "public"."service_type_mappings" DROP CONSTRAINT IF EXISTS "service_type_mappings_service_id_fkey";
ALTER TABLE "public"."service_type_mappings" ADD CONSTRAINT "service_type_mappings_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE CASCADE;

ALTER TABLE "public"."service_types" DROP CONSTRAINT IF EXISTS "service_types_mode_id_fkey";
ALTER TABLE "public"."service_types" ADD CONSTRAINT "service_types_mode_id_fkey" FOREIGN KEY ("mode_id") REFERENCES "public"."transport_modes"("id");

ALTER TABLE "public"."services" DROP CONSTRAINT IF EXISTS "services_service_type_id_fkey";
ALTER TABLE "public"."services" ADD CONSTRAINT "services_service_type_id_fkey" FOREIGN KEY ("service_type_id") REFERENCES "public"."service_types"("id");

ALTER TABLE "public"."services" DROP CONSTRAINT IF EXISTS "services_tenant_id_fkey";
ALTER TABLE "public"."services" ADD CONSTRAINT "services_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;

ALTER TABLE "public"."shipment_attachments" DROP CONSTRAINT IF EXISTS "shipment_attachments_shipment_id_fkey";
ALTER TABLE "public"."shipment_attachments" ADD CONSTRAINT "shipment_attachments_shipment_id_fkey" FOREIGN KEY ("shipment_id") REFERENCES "public"."shipments"("id") ON DELETE CASCADE;

ALTER TABLE "public"."shipment_items" DROP CONSTRAINT IF EXISTS "shipment_items_shipment_id_fkey";
ALTER TABLE "public"."shipment_items" ADD CONSTRAINT "shipment_items_shipment_id_fkey" FOREIGN KEY ("shipment_id") REFERENCES "public"."shipments"("id") ON DELETE CASCADE;

ALTER TABLE "public"."shipments" DROP CONSTRAINT IF EXISTS "shipments_account_id_fkey";
ALTER TABLE "public"."shipments" ADD CONSTRAINT "shipments_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE SET NULL;

ALTER TABLE "public"."shipments" DROP CONSTRAINT IF EXISTS "shipments_assigned_to_fkey";
ALTER TABLE "public"."shipments" ADD CONSTRAINT "shipments_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "auth"."users"("id") ON DELETE SET NULL;

ALTER TABLE "public"."shipments" DROP CONSTRAINT IF EXISTS "shipments_contact_id_fkey";
ALTER TABLE "public"."shipments" ADD CONSTRAINT "shipments_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE SET NULL;

ALTER TABLE "public"."shipments" DROP CONSTRAINT IF EXISTS "shipments_created_by_fkey";
ALTER TABLE "public"."shipments" ADD CONSTRAINT "shipments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;

ALTER TABLE "public"."shipments" DROP CONSTRAINT IF EXISTS "shipments_destination_warehouse_id_fkey";
ALTER TABLE "public"."shipments" ADD CONSTRAINT "shipments_destination_warehouse_id_fkey" FOREIGN KEY ("destination_warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE SET NULL;

ALTER TABLE "public"."shipments" DROP CONSTRAINT IF EXISTS "shipments_driver_id_fkey";
ALTER TABLE "public"."shipments" ADD CONSTRAINT "shipments_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;

ALTER TABLE "public"."shipments" DROP CONSTRAINT IF EXISTS "shipments_franchise_id_fkey";
ALTER TABLE "public"."shipments" ADD CONSTRAINT "shipments_franchise_id_fkey" FOREIGN KEY ("franchise_id") REFERENCES "public"."franchises"("id") ON DELETE SET NULL;

ALTER TABLE "public"."shipments" DROP CONSTRAINT IF EXISTS "shipments_origin_warehouse_id_fkey";
ALTER TABLE "public"."shipments" ADD CONSTRAINT "shipments_origin_warehouse_id_fkey" FOREIGN KEY ("origin_warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE SET NULL;

ALTER TABLE "public"."shipments" DROP CONSTRAINT IF EXISTS "shipments_tenant_id_fkey";
ALTER TABLE "public"."shipments" ADD CONSTRAINT "shipments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;

ALTER TABLE "public"."shipments" DROP CONSTRAINT IF EXISTS "shipments_vehicle_id_fkey";
ALTER TABLE "public"."shipments" ADD CONSTRAINT "shipments_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE SET NULL;

ALTER TABLE "public"."shipping_rates" DROP CONSTRAINT IF EXISTS "shipping_rates_tenant_id_fkey";
ALTER TABLE "public"."shipping_rates" ADD CONSTRAINT "shipping_rates_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;

ALTER TABLE "public"."states" DROP CONSTRAINT IF EXISTS "states_country_id_fkey";
ALTER TABLE "public"."states" ADD CONSTRAINT "states_country_id_fkey" FOREIGN KEY ("country_id") REFERENCES "public"."countries"("id") ON DELETE CASCADE;

ALTER TABLE "public"."subscription_invoices" DROP CONSTRAINT IF EXISTS "subscription_invoices_subscription_id_fkey";
ALTER TABLE "public"."subscription_invoices" ADD CONSTRAINT "subscription_invoices_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "public"."tenant_subscriptions"("id") ON DELETE SET NULL;

ALTER TABLE "public"."subscription_invoices" DROP CONSTRAINT IF EXISTS "subscription_invoices_tenant_id_fkey";
ALTER TABLE "public"."subscription_invoices" ADD CONSTRAINT "subscription_invoices_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;

ALTER TABLE "public"."tenant_subscriptions" DROP CONSTRAINT IF EXISTS "tenant_subscriptions_plan_id_fkey";
ALTER TABLE "public"."tenant_subscriptions" ADD CONSTRAINT "tenant_subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."subscription_plans"("id");

ALTER TABLE "public"."tenant_subscriptions" DROP CONSTRAINT IF EXISTS "tenant_subscriptions_tenant_id_fkey";
ALTER TABLE "public"."tenant_subscriptions" ADD CONSTRAINT "tenant_subscriptions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;

ALTER TABLE "public"."territory_assignments" DROP CONSTRAINT IF EXISTS "territory_assignments_territory_id_fkey";
ALTER TABLE "public"."territory_assignments" ADD CONSTRAINT "territory_assignments_territory_id_fkey" FOREIGN KEY ("territory_id") REFERENCES "public"."territories"("id") ON DELETE CASCADE;

ALTER TABLE "public"."territory_assignments" DROP CONSTRAINT IF EXISTS "territory_assignments_user_id_fkey";
ALTER TABLE "public"."territory_assignments" ADD CONSTRAINT "territory_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

ALTER TABLE "public"."territory_geographies" DROP CONSTRAINT IF EXISTS "territory_geographies_city_id_fkey";
ALTER TABLE "public"."territory_geographies" ADD CONSTRAINT "territory_geographies_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE CASCADE;

ALTER TABLE "public"."territory_geographies" DROP CONSTRAINT IF EXISTS "territory_geographies_continent_id_fkey";
ALTER TABLE "public"."territory_geographies" ADD CONSTRAINT "territory_geographies_continent_id_fkey" FOREIGN KEY ("continent_id") REFERENCES "public"."continents"("id") ON DELETE CASCADE;

ALTER TABLE "public"."territory_geographies" DROP CONSTRAINT IF EXISTS "territory_geographies_country_id_fkey";
ALTER TABLE "public"."territory_geographies" ADD CONSTRAINT "territory_geographies_country_id_fkey" FOREIGN KEY ("country_id") REFERENCES "public"."countries"("id") ON DELETE CASCADE;

ALTER TABLE "public"."territory_geographies" DROP CONSTRAINT IF EXISTS "territory_geographies_state_id_fkey";
ALTER TABLE "public"."territory_geographies" ADD CONSTRAINT "territory_geographies_state_id_fkey" FOREIGN KEY ("state_id") REFERENCES "public"."states"("id") ON DELETE CASCADE;

ALTER TABLE "public"."territory_geographies" DROP CONSTRAINT IF EXISTS "territory_geographies_territory_id_fkey";
ALTER TABLE "public"."territory_geographies" ADD CONSTRAINT "territory_geographies_territory_id_fkey" FOREIGN KEY ("territory_id") REFERENCES "public"."territories"("id") ON DELETE CASCADE;

ALTER TABLE "public"."themes" DROP CONSTRAINT IF EXISTS "themes_created_by_fkey";
ALTER TABLE "public"."themes" ADD CONSTRAINT "themes_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;

ALTER TABLE "public"."themes" DROP CONSTRAINT IF EXISTS "themes_tenant_id_fkey";
ALTER TABLE "public"."themes" ADD CONSTRAINT "themes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;

ALTER TABLE "public"."tracking_events" DROP CONSTRAINT IF EXISTS "tracking_events_created_by_fkey";
ALTER TABLE "public"."tracking_events" ADD CONSTRAINT "tracking_events_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;

ALTER TABLE "public"."tracking_events" DROP CONSTRAINT IF EXISTS "tracking_events_shipment_id_fkey";
ALTER TABLE "public"."tracking_events" ADD CONSTRAINT "tracking_events_shipment_id_fkey" FOREIGN KEY ("shipment_id") REFERENCES "public"."shipments"("id") ON DELETE CASCADE;

ALTER TABLE "public"."ui_themes" DROP CONSTRAINT IF EXISTS "ui_themes_franchise_id_fkey";
ALTER TABLE "public"."ui_themes" ADD CONSTRAINT "ui_themes_franchise_id_fkey" FOREIGN KEY ("franchise_id") REFERENCES "public"."franchises"("id") ON DELETE CASCADE;

ALTER TABLE "public"."ui_themes" DROP CONSTRAINT IF EXISTS "ui_themes_tenant_id_fkey";
ALTER TABLE "public"."ui_themes" ADD CONSTRAINT "ui_themes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;

ALTER TABLE "public"."ui_themes" DROP CONSTRAINT IF EXISTS "ui_themes_user_id_fkey";
ALTER TABLE "public"."ui_themes" ADD CONSTRAINT "ui_themes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

ALTER TABLE "public"."usage_records" DROP CONSTRAINT IF EXISTS "usage_records_subscription_id_fkey";
ALTER TABLE "public"."usage_records" ADD CONSTRAINT "usage_records_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "public"."tenant_subscriptions"("id") ON DELETE SET NULL;

ALTER TABLE "public"."usage_records" DROP CONSTRAINT IF EXISTS "usage_records_tenant_id_fkey";
ALTER TABLE "public"."usage_records" ADD CONSTRAINT "usage_records_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;

ALTER TABLE "public"."user_capacity" DROP CONSTRAINT IF EXISTS "user_capacity_user_id_fkey";
ALTER TABLE "public"."user_capacity" ADD CONSTRAINT "user_capacity_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

ALTER TABLE "public"."user_custom_roles" DROP CONSTRAINT IF EXISTS "user_custom_roles_assigned_by_fkey";
ALTER TABLE "public"."user_custom_roles" ADD CONSTRAINT "user_custom_roles_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "auth"."users"("id");

ALTER TABLE "public"."user_custom_roles" DROP CONSTRAINT IF EXISTS "user_custom_roles_role_id_fkey";
ALTER TABLE "public"."user_custom_roles" ADD CONSTRAINT "user_custom_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."custom_roles"("id") ON DELETE CASCADE;

ALTER TABLE "public"."user_custom_roles" DROP CONSTRAINT IF EXISTS "user_custom_roles_user_id_fkey";
ALTER TABLE "public"."user_custom_roles" ADD CONSTRAINT "user_custom_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

ALTER TABLE "public"."user_preferences" DROP CONSTRAINT IF EXISTS "user_preferences_franchise_id_fkey";
ALTER TABLE "public"."user_preferences" ADD CONSTRAINT "user_preferences_franchise_id_fkey" FOREIGN KEY ("franchise_id") REFERENCES "public"."franchises"("id") ON DELETE SET NULL;

ALTER TABLE "public"."user_preferences" DROP CONSTRAINT IF EXISTS "user_preferences_tenant_id_fkey";
ALTER TABLE "public"."user_preferences" ADD CONSTRAINT "user_preferences_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE SET NULL;

ALTER TABLE "public"."user_preferences" DROP CONSTRAINT IF EXISTS "user_preferences_user_id_fkey";
ALTER TABLE "public"."user_preferences" ADD CONSTRAINT "user_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

ALTER TABLE "public"."user_roles" DROP CONSTRAINT IF EXISTS "user_roles_assigned_by_fkey";
ALTER TABLE "public"."user_roles" ADD CONSTRAINT "user_roles_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "public"."profiles"("id");

ALTER TABLE "public"."user_roles" DROP CONSTRAINT IF EXISTS "user_roles_franchise_id_fkey";
ALTER TABLE "public"."user_roles" ADD CONSTRAINT "user_roles_franchise_id_fkey" FOREIGN KEY ("franchise_id") REFERENCES "public"."franchises"("id") ON DELETE CASCADE;

ALTER TABLE "public"."user_roles" DROP CONSTRAINT IF EXISTS "user_roles_tenant_id_fkey";
ALTER TABLE "public"."user_roles" ADD CONSTRAINT "user_roles_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;

ALTER TABLE "public"."user_roles" DROP CONSTRAINT IF EXISTS "user_roles_user_id_fkey";
ALTER TABLE "public"."user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;

ALTER TABLE "public"."vehicles" DROP CONSTRAINT IF EXISTS "vehicles_driver_id_fkey";
ALTER TABLE "public"."vehicles" ADD CONSTRAINT "vehicles_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;

ALTER TABLE "public"."vehicles" DROP CONSTRAINT IF EXISTS "vehicles_franchise_id_fkey";
ALTER TABLE "public"."vehicles" ADD CONSTRAINT "vehicles_franchise_id_fkey" FOREIGN KEY ("franchise_id") REFERENCES "public"."franchises"("id") ON DELETE SET NULL;

ALTER TABLE "public"."vehicles" DROP CONSTRAINT IF EXISTS "vehicles_tenant_id_fkey";
ALTER TABLE "public"."vehicles" ADD CONSTRAINT "vehicles_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;

ALTER TABLE "public"."warehouse_inventory" DROP CONSTRAINT IF EXISTS "warehouse_inventory_shipment_id_fkey";
ALTER TABLE "public"."warehouse_inventory" ADD CONSTRAINT "warehouse_inventory_shipment_id_fkey" FOREIGN KEY ("shipment_id") REFERENCES "public"."shipments"("id") ON DELETE SET NULL;

ALTER TABLE "public"."warehouse_inventory" DROP CONSTRAINT IF EXISTS "warehouse_inventory_warehouse_id_fkey";
ALTER TABLE "public"."warehouse_inventory" ADD CONSTRAINT "warehouse_inventory_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE CASCADE;

ALTER TABLE "public"."warehouses" DROP CONSTRAINT IF EXISTS "warehouses_franchise_id_fkey";
ALTER TABLE "public"."warehouses" ADD CONSTRAINT "warehouses_franchise_id_fkey" FOREIGN KEY ("franchise_id") REFERENCES "public"."franchises"("id") ON DELETE SET NULL;

ALTER TABLE "public"."warehouses" DROP CONSTRAINT IF EXISTS "warehouses_tenant_id_fkey";
ALTER TABLE "public"."warehouses" ADD CONSTRAINT "warehouses_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;

DROP POLICY IF EXISTS "Admins can manage queue members" ON "public"."queue_members";
DROP POLICY IF EXISTS "Admins can manage queue members" ON "public"."queue_members";
CREATE POLICY "Admins can manage queue members" ON "public"."queue_members" USING ("public"."has_role"("auth"."uid"(), 'platform_admin'::"public"."app_role")) WITH CHECK ("public"."has_role"("auth"."uid"(), 'platform_admin'::"public"."app_role"));

DROP POLICY IF EXISTS "Admins can manage queues" ON "public"."queues";
DROP POLICY IF EXISTS "Admins can manage queues" ON "public"."queues";
CREATE POLICY "Admins can manage queues" ON "public"."queues" USING ("public"."has_role"("auth"."uid"(), 'platform_admin'::"public"."app_role")) WITH CHECK ("public"."has_role"("auth"."uid"(), 'platform_admin'::"public"."app_role"));

DROP POLICY IF EXISTS "Admins can manage score config" ON "public"."lead_score_config";
DROP POLICY IF EXISTS "Admins can manage score config" ON "public"."lead_score_config";
CREATE POLICY "Admins can manage score config" ON "public"."lead_score_config" USING ((("tenant_id" IN ( SELECT "user_roles"."tenant_id"
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = ANY (ARRAY['tenant_admin'::"public"."app_role", 'platform_admin'::"public"."app_role"]))))) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'platform_admin'::"public"."app_role"))))));

DROP POLICY IF EXISTS "Admins can update their tenant score config" ON "public"."lead_score_config";
DROP POLICY IF EXISTS "Admins can update their tenant score config" ON "public"."lead_score_config";
CREATE POLICY "Admins can update their tenant score config" ON "public"."lead_score_config" FOR UPDATE USING ((("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())) AND "public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role")));

DROP POLICY IF EXISTS "All authenticated can read auth_permissions" ON "public"."auth_permissions";
DROP POLICY IF EXISTS "All authenticated can read auth_permissions" ON "public"."auth_permissions";
CREATE POLICY "All authenticated can read auth_permissions" ON "public"."auth_permissions" FOR SELECT USING (("auth"."uid"() IS NOT NULL));

DROP POLICY IF EXISTS "All authenticated can read auth_role_permissions" ON "public"."auth_role_permissions";
DROP POLICY IF EXISTS "All authenticated can read auth_role_permissions" ON "public"."auth_role_permissions";
CREATE POLICY "All authenticated can read auth_role_permissions" ON "public"."auth_role_permissions" FOR SELECT USING (("auth"."uid"() IS NOT NULL));

DROP POLICY IF EXISTS "All authenticated can read auth_roles" ON "public"."auth_roles";
DROP POLICY IF EXISTS "All authenticated can read auth_roles" ON "public"."auth_roles";
CREATE POLICY "All authenticated can read auth_roles" ON "public"."auth_roles" FOR SELECT USING (("auth"."uid"() IS NOT NULL));

DROP POLICY IF EXISTS "All authenticated users can view service types" ON "public"."service_types";
DROP POLICY IF EXISTS "All authenticated users can view service types" ON "public"."service_types";
CREATE POLICY "All authenticated users can view service types" ON "public"."service_types" FOR SELECT TO "authenticated" USING (true);

DROP POLICY IF EXISTS "Allow insert/update access to authenticated users" ON "public"."document_versions";
DROP POLICY IF EXISTS "Allow insert/update access to authenticated users" ON "public"."document_versions";
CREATE POLICY "Allow insert/update access to authenticated users" ON "public"."document_versions" TO "authenticated" USING (true);

DROP POLICY IF EXISTS "Allow insert/update access to authenticated users" ON "public"."documents";
DROP POLICY IF EXISTS "Allow insert/update access to authenticated users" ON "public"."documents";
CREATE POLICY "Allow insert/update access to authenticated users" ON "public"."documents" TO "authenticated" USING (true);

DROP POLICY IF EXISTS "Allow read access to authenticated users" ON "public"."document_versions";
DROP POLICY IF EXISTS "Allow read access to authenticated users" ON "public"."document_versions";
CREATE POLICY "Allow read access to authenticated users" ON "public"."document_versions" FOR SELECT TO "authenticated" USING (true);

DROP POLICY IF EXISTS "Allow read access to authenticated users" ON "public"."documents";
DROP POLICY IF EXISTS "Allow read access to authenticated users" ON "public"."documents";
CREATE POLICY "Allow read access to authenticated users" ON "public"."documents" FOR SELECT TO "authenticated" USING (true);

DROP POLICY IF EXISTS "Anyone can view active service leg categories" ON "public"."service_leg_categories";
DROP POLICY IF EXISTS "Anyone can view active service leg categories" ON "public"."service_leg_categories";
CREATE POLICY "Anyone can view active service leg categories" ON "public"."service_leg_categories" FOR SELECT USING (("is_active" = true));

DROP POLICY IF EXISTS "Anyone can view active subscription plans" ON "public"."subscription_plans";
DROP POLICY IF EXISTS "Anyone can view active subscription plans" ON "public"."subscription_plans";
CREATE POLICY "Anyone can view active subscription plans" ON "public"."subscription_plans" FOR SELECT USING (("is_active" = true));

DROP POLICY IF EXISTS "Anyone can view active transport modes" ON "public"."transport_modes";
DROP POLICY IF EXISTS "Anyone can view active transport modes" ON "public"."transport_modes";
CREATE POLICY "Anyone can view active transport modes" ON "public"."transport_modes" FOR SELECT USING (("is_active" = true));

DROP POLICY IF EXISTS "Anyone can view service types" ON "public"."service_types";
DROP POLICY IF EXISTS "Anyone can view service types" ON "public"."service_types";
CREATE POLICY "Anyone can view service types" ON "public"."service_types" FOR SELECT USING (true);

DROP POLICY IF EXISTS "Anyone can view subscription features" ON "public"."subscription_features";
DROP POLICY IF EXISTS "Anyone can view subscription features" ON "public"."subscription_features";
CREATE POLICY "Anyone can view subscription features" ON "public"."subscription_features" FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert audit logs for their actions" ON "public"."email_audit_log";
DROP POLICY IF EXISTS "Authenticated users can insert audit logs for their actions" ON "public"."email_audit_log";
CREATE POLICY "Authenticated users can insert audit logs for their actions" ON "public"."email_audit_log" FOR INSERT TO "authenticated" WITH CHECK ((("user_id" = "auth"."uid"()) OR "public"."is_super_admin"("auth"."uid"()) OR ("public"."is_tenant_admin"("auth"."uid"()) AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))) OR ("public"."is_franchise_admin"("auth"."uid"()) AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())) AND ("franchise_id" = "public"."get_user_franchise_id"("auth"."uid"())))));

DROP POLICY IF EXISTS "Delegates can view their delegations" ON "public"."email_account_delegations";
DROP POLICY IF EXISTS "Delegates can view their delegations" ON "public"."email_account_delegations";
CREATE POLICY "Delegates can view their delegations" ON "public"."email_account_delegations" FOR SELECT USING (("delegate_user_id" = "auth"."uid"()));

DROP POLICY IF EXISTS "Delegation owners can manage" ON "public"."email_account_delegations";
DROP POLICY IF EXISTS "Delegation owners can manage" ON "public"."email_account_delegations";
CREATE POLICY "Delegation owners can manage" ON "public"."email_account_delegations" USING (("account_id" IN ( SELECT "email_accounts"."id"
   FROM "public"."email_accounts"
  WHERE ("email_accounts"."user_id" = "auth"."uid"())))) WITH CHECK (("account_id" IN ( SELECT "email_accounts"."id"
   FROM "public"."email_accounts"
  WHERE ("email_accounts"."user_id" = "auth"."uid"()))));

DROP POLICY IF EXISTS "Email accounts scope matrix - DELETE" ON "public"."email_accounts";
DROP POLICY IF EXISTS "Email accounts scope matrix - DELETE" ON "public"."email_accounts";
CREATE POLICY "Email accounts scope matrix - DELETE" ON "public"."email_accounts" FOR DELETE TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR "public"."is_platform_admin"("auth"."uid"())));

DROP POLICY IF EXISTS "Email accounts scope matrix - INSERT" ON "public"."email_accounts";
DROP POLICY IF EXISTS "Email accounts scope matrix - INSERT" ON "public"."email_accounts";
CREATE POLICY "Email accounts scope matrix - INSERT" ON "public"."email_accounts" FOR INSERT TO "authenticated" WITH CHECK ((("user_id" = "auth"."uid"()) OR "public"."is_platform_admin"("auth"."uid"())));

DROP POLICY IF EXISTS "Email accounts scope matrix - SELECT" ON "public"."email_accounts";
DROP POLICY IF EXISTS "Email accounts scope matrix - SELECT" ON "public"."email_accounts";
CREATE POLICY "Email accounts scope matrix - SELECT" ON "public"."email_accounts" FOR SELECT TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR "public"."is_platform_admin"("auth"."uid"()) OR ("public"."is_tenant_admin"("auth"."uid"()) AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))) OR ("public"."is_franchise_admin"("auth"."uid"()) AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())) AND ("franchise_id" = "public"."get_user_franchise_id"("auth"."uid"()))) OR ("id" IN ( SELECT "email_account_delegations"."account_id"
   FROM "public"."email_account_delegations"
  WHERE (("email_account_delegations"."delegate_user_id" = "auth"."uid"()) AND ("email_account_delegations"."is_active" = true) AND (("email_account_delegations"."expires_at" IS NULL) OR ("email_account_delegations"."expires_at" > "now"())))))));

DROP POLICY IF EXISTS "Email accounts scope matrix - UPDATE" ON "public"."email_accounts";
DROP POLICY IF EXISTS "Email accounts scope matrix - UPDATE" ON "public"."email_accounts";
CREATE POLICY "Email accounts scope matrix - UPDATE" ON "public"."email_accounts" FOR UPDATE TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR "public"."is_platform_admin"("auth"."uid"())));

DROP POLICY IF EXISTS "Email scope matrix - DELETE" ON "public"."emails";
DROP POLICY IF EXISTS "Email scope matrix - DELETE" ON "public"."emails";
CREATE POLICY "Email scope matrix - DELETE" ON "public"."emails" FOR DELETE TO "authenticated" USING (((NOT "public"."is_viewer"("auth"."uid"())) AND (("user_id" = "auth"."uid"()) OR ("account_id" IN ( SELECT "email_accounts"."id"
   FROM "public"."email_accounts"
  WHERE ("email_accounts"."user_id" = "auth"."uid"()))) OR "public"."is_platform_admin"("auth"."uid"()) OR ("public"."is_tenant_admin"("auth"."uid"()) AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))))));

DROP POLICY IF EXISTS "Email scope matrix - INSERT" ON "public"."emails";
DROP POLICY IF EXISTS "Email scope matrix - INSERT" ON "public"."emails";
CREATE POLICY "Email scope matrix - INSERT" ON "public"."emails" FOR INSERT TO "authenticated" WITH CHECK (((NOT "public"."is_viewer"("auth"."uid"())) AND (("account_id" IN ( SELECT "email_accounts"."id"
   FROM "public"."email_accounts"
  WHERE ("email_accounts"."user_id" = "auth"."uid"()))) OR "public"."is_platform_admin"("auth"."uid"()) OR ("account_id" IN ( SELECT "email_account_delegations"."account_id"
   FROM "public"."email_account_delegations"
  WHERE (("email_account_delegations"."delegate_user_id" = "auth"."uid"()) AND ("email_account_delegations"."is_active" = true) AND ("email_account_delegations"."permissions" ? 'send'::"text") AND (("email_account_delegations"."expires_at" IS NULL) OR ("email_account_delegations"."expires_at" > "now"()))))))));

DROP POLICY IF EXISTS "Email scope matrix - SELECT" ON "public"."emails";
DROP POLICY IF EXISTS "Email scope matrix - SELECT" ON "public"."emails";
CREATE POLICY "Email scope matrix - SELECT" ON "public"."emails" FOR SELECT TO "authenticated" USING (("public"."is_platform_admin"("auth"."uid"()) OR "public"."is_super_admin"("auth"."uid"()) OR ("public"."is_tenant_admin"("auth"."uid"()) AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))) OR ("public"."is_franchise_admin"("auth"."uid"()) AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())) AND ("franchise_id" = "public"."get_user_franchise_id"("auth"."uid"()))) OR ("public"."is_sales_manager"("auth"."uid"()) AND (("user_id" = "auth"."uid"()) OR ("user_id" IN ( SELECT "public"."get_sales_manager_team_user_ids"("auth"."uid"()) AS "get_sales_manager_team_user_ids")) OR ("account_id" IN ( SELECT "email_accounts"."id"
   FROM "public"."email_accounts"
  WHERE ("email_accounts"."user_id" IN ( SELECT "public"."get_sales_manager_team_user_ids"("auth"."uid"()) AS "get_sales_manager_team_user_ids")))))) OR (("user_id" = "auth"."uid"()) OR ("account_id" IN ( SELECT "email_accounts"."id"
   FROM "public"."email_accounts"
  WHERE ("email_accounts"."user_id" = "auth"."uid"())))) OR ("account_id" IN ( SELECT "email_account_delegations"."account_id"
   FROM "public"."email_account_delegations"
  WHERE (("email_account_delegations"."delegate_user_id" = "auth"."uid"()) AND ("email_account_delegations"."is_active" = true) AND (("email_account_delegations"."expires_at" IS NULL) OR ("email_account_delegations"."expires_at" > "now"())))))));

DROP POLICY IF EXISTS "Email scope matrix - UPDATE" ON "public"."emails";
DROP POLICY IF EXISTS "Email scope matrix - UPDATE" ON "public"."emails";
CREATE POLICY "Email scope matrix - UPDATE" ON "public"."emails" FOR UPDATE TO "authenticated" USING (((NOT "public"."is_viewer"("auth"."uid"())) AND (("user_id" = "auth"."uid"()) OR ("account_id" IN ( SELECT "email_accounts"."id"
   FROM "public"."email_accounts"
  WHERE ("email_accounts"."user_id" = "auth"."uid"()))) OR "public"."is_platform_admin"("auth"."uid"()) OR ("public"."is_tenant_admin"("auth"."uid"()) AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))) OR ("public"."is_franchise_admin"("auth"."uid"()) AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())) AND ("franchise_id" = "public"."get_user_franchise_id"("auth"."uid"()))))));

DROP POLICY IF EXISTS "Entity transfer items: delete (platform admin)" ON "public"."entity_transfer_items";
DROP POLICY IF EXISTS "Entity transfer items: delete (platform admin)" ON "public"."entity_transfer_items";
CREATE POLICY "Entity transfer items: delete (platform admin)" ON "public"."entity_transfer_items" FOR DELETE USING ("public"."is_platform_admin"("auth"."uid"()));

DROP POLICY IF EXISTS "Entity transfer items: insert" ON "public"."entity_transfer_items";
DROP POLICY IF EXISTS "Entity transfer items: insert" ON "public"."entity_transfer_items";
CREATE POLICY "Entity transfer items: insert" ON "public"."entity_transfer_items" FOR INSERT WITH CHECK (("public"."is_platform_admin"("auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."entity_transfers" "et"
  WHERE (("et"."id" = "entity_transfer_items"."transfer_id") AND ("et"."source_tenant_id" IN ( SELECT "ur"."tenant_id"
           FROM "public"."user_roles" "ur"
          WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."tenant_id" IS NOT NULL)))))))));

DROP POLICY IF EXISTS "Entity transfer items: select" ON "public"."entity_transfer_items";
DROP POLICY IF EXISTS "Entity transfer items: select" ON "public"."entity_transfer_items";
CREATE POLICY "Entity transfer items: select" ON "public"."entity_transfer_items" FOR SELECT USING (("public"."is_platform_admin"("auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."entity_transfers" "et"
  WHERE (("et"."id" = "entity_transfer_items"."transfer_id") AND (("et"."source_tenant_id" IN ( SELECT "ur"."tenant_id"
           FROM "public"."user_roles" "ur"
          WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."tenant_id" IS NOT NULL)))) OR ("et"."target_tenant_id" IN ( SELECT "ur"."tenant_id"
           FROM "public"."user_roles" "ur"
          WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."tenant_id" IS NOT NULL))))))))));

DROP POLICY IF EXISTS "Entity transfer items: update (platform admin)" ON "public"."entity_transfer_items";
DROP POLICY IF EXISTS "Entity transfer items: update (platform admin)" ON "public"."entity_transfer_items";
CREATE POLICY "Entity transfer items: update (platform admin)" ON "public"."entity_transfer_items" FOR UPDATE USING ("public"."is_platform_admin"("auth"."uid"())) WITH CHECK ("public"."is_platform_admin"("auth"."uid"()));

DROP POLICY IF EXISTS "Entity transfers: delete (platform admin)" ON "public"."entity_transfers";
DROP POLICY IF EXISTS "Entity transfers: delete (platform admin)" ON "public"."entity_transfers";
CREATE POLICY "Entity transfers: delete (platform admin)" ON "public"."entity_transfers" FOR DELETE USING ("public"."is_platform_admin"("auth"."uid"()));

DROP POLICY IF EXISTS "Entity transfers: insert" ON "public"."entity_transfers";
DROP POLICY IF EXISTS "Entity transfers: insert" ON "public"."entity_transfers";
CREATE POLICY "Entity transfers: insert" ON "public"."entity_transfers" FOR INSERT WITH CHECK ((("public"."is_platform_admin"("auth"."uid"()) OR ("source_tenant_id" IN ( SELECT "ur"."tenant_id"
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."tenant_id" IS NOT NULL))))) AND ("requested_by" = "auth"."uid"())));

DROP POLICY IF EXISTS "Entity transfers: select" ON "public"."entity_transfers";
DROP POLICY IF EXISTS "Entity transfers: select" ON "public"."entity_transfers";
CREATE POLICY "Entity transfers: select" ON "public"."entity_transfers" FOR SELECT USING (("public"."is_platform_admin"("auth"."uid"()) OR ("source_tenant_id" IN ( SELECT "ur"."tenant_id"
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."tenant_id" IS NOT NULL)))) OR ("target_tenant_id" IN ( SELECT "ur"."tenant_id"
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."tenant_id" IS NOT NULL))))));

DROP POLICY IF EXISTS "Entity transfers: update" ON "public"."entity_transfers";
DROP POLICY IF EXISTS "Entity transfers: update" ON "public"."entity_transfers";
CREATE POLICY "Entity transfers: update" ON "public"."entity_transfers" FOR UPDATE USING (("public"."is_platform_admin"("auth"."uid"()) OR ("target_tenant_id" IN ( SELECT "ur"."tenant_id"
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."tenant_id" IS NOT NULL))))));

DROP POLICY IF EXISTS "Everyone can view hierarchy" ON "public"."auth_role_hierarchy";
DROP POLICY IF EXISTS "Everyone can view hierarchy" ON "public"."auth_role_hierarchy";
CREATE POLICY "Everyone can view hierarchy" ON "public"."auth_role_hierarchy" FOR SELECT USING (true);

DROP POLICY IF EXISTS "Everyone can view permissions" ON "public"."auth_permissions";
DROP POLICY IF EXISTS "Everyone can view permissions" ON "public"."auth_permissions";
CREATE POLICY "Everyone can view permissions" ON "public"."auth_permissions" FOR SELECT USING (true);

DROP POLICY IF EXISTS "Everyone can view role permissions" ON "public"."auth_role_permissions";
DROP POLICY IF EXISTS "Everyone can view role permissions" ON "public"."auth_role_permissions";
CREATE POLICY "Everyone can view role permissions" ON "public"."auth_role_permissions" FOR SELECT USING (true);

DROP POLICY IF EXISTS "Everyone can view roles" ON "public"."auth_roles";
DROP POLICY IF EXISTS "Everyone can view roles" ON "public"."auth_roles";
CREATE POLICY "Everyone can view roles" ON "public"."auth_roles" FOR SELECT USING (true);

DROP POLICY IF EXISTS "Franchise admins can manage franchise accounts" ON "public"."accounts";
DROP POLICY IF EXISTS "Franchise admins can manage franchise accounts" ON "public"."accounts";
CREATE POLICY "Franchise admins can manage franchise accounts" ON "public"."accounts" USING (("public"."has_role"("auth"."uid"(), 'franchise_admin'::"public"."app_role") AND ("franchise_id" = "public"."get_user_franchise_id"("auth"."uid"()))));

DROP POLICY IF EXISTS "Franchise admins can manage franchise activities" ON "public"."activities";
DROP POLICY IF EXISTS "Franchise admins can manage franchise activities" ON "public"."activities";
CREATE POLICY "Franchise admins can manage franchise activities" ON "public"."activities" USING (("public"."has_role"("auth"."uid"(), 'franchise_admin'::"public"."app_role") AND ("franchise_id" = "public"."get_user_franchise_id"("auth"."uid"()))));

DROP POLICY IF EXISTS "Franchise admins can manage franchise contacts" ON "public"."contacts";
DROP POLICY IF EXISTS "Franchise admins can manage franchise contacts" ON "public"."contacts";
CREATE POLICY "Franchise admins can manage franchise contacts" ON "public"."contacts" USING (("public"."has_role"("auth"."uid"(), 'franchise_admin'::"public"."app_role") AND ("franchise_id" = "public"."get_user_franchise_id"("auth"."uid"()))));

DROP POLICY IF EXISTS "Franchise admins can manage franchise invitations" ON "public"."invitations";
DROP POLICY IF EXISTS "Franchise admins can manage franchise invitations" ON "public"."invitations";
CREATE POLICY "Franchise admins can manage franchise invitations" ON "public"."invitations" USING (("public"."has_role"("auth"."uid"(), 'franchise_admin'::"public"."app_role") AND ("franchise_id" = "public"."get_user_franchise_id"("auth"."uid"()))));

DROP POLICY IF EXISTS "Franchise admins can manage franchise leads" ON "public"."leads";
DROP POLICY IF EXISTS "Franchise admins can manage franchise leads" ON "public"."leads";
CREATE POLICY "Franchise admins can manage franchise leads" ON "public"."leads" USING (("public"."has_role"("auth"."uid"(), 'franchise_admin'::"public"."app_role") AND ("franchise_id" = "public"."get_user_franchise_id"("auth"."uid"()))));

DROP POLICY IF EXISTS "Franchise admins can manage franchise opportunities" ON "public"."opportunities";
DROP POLICY IF EXISTS "Franchise admins can manage franchise opportunities" ON "public"."opportunities";
CREATE POLICY "Franchise admins can manage franchise opportunities" ON "public"."opportunities" USING (("public"."has_role"("auth"."uid"(), 'franchise_admin'::"public"."app_role") AND ("franchise_id" = "public"."get_user_franchise_id"("auth"."uid"()))));

DROP POLICY IF EXISTS "Franchise admins can manage franchise quote config" ON "public"."quote_number_config_franchise";
DROP POLICY IF EXISTS "Franchise admins can manage franchise quote config" ON "public"."quote_number_config_franchise";
CREATE POLICY "Franchise admins can manage franchise quote config" ON "public"."quote_number_config_franchise" USING (("public"."has_role"("auth"."uid"(), 'franchise_admin'::"public"."app_role") AND ("franchise_id" = "public"."get_user_franchise_id"("auth"."uid"()))));

DROP POLICY IF EXISTS "Franchise admins can manage franchise quotes" ON "public"."quotes";
DROP POLICY IF EXISTS "Franchise admins can manage franchise quotes" ON "public"."quotes";
CREATE POLICY "Franchise admins can manage franchise quotes" ON "public"."quotes" TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'franchise_admin'::"public"."app_role") AND ("franchise_id" = "public"."get_user_franchise_id"("auth"."uid"()))));

DROP POLICY IF EXISTS "Franchise admins can manage franchise shipments" ON "public"."shipments";
DROP POLICY IF EXISTS "Franchise admins can manage franchise shipments" ON "public"."shipments";
CREATE POLICY "Franchise admins can manage franchise shipments" ON "public"."shipments" USING (("public"."has_role"("auth"."uid"(), 'franchise_admin'::"public"."app_role") AND ("franchise_id" = "public"."get_user_franchise_id"("auth"."uid"()))));

DROP POLICY IF EXISTS "Franchise admins can manage franchise user custom roles" ON "public"."user_custom_roles";
DROP POLICY IF EXISTS "Franchise admins can manage franchise user custom roles" ON "public"."user_custom_roles";
CREATE POLICY "Franchise admins can manage franchise user custom roles" ON "public"."user_custom_roles" USING (("public"."has_role"("auth"."uid"(), 'franchise_admin'::"public"."app_role") AND ("franchise_id" = "public"."get_user_franchise_id"("auth"."uid"()))));

DROP POLICY IF EXISTS "Franchise admins can update franchise user roles" ON "public"."user_roles";
DROP POLICY IF EXISTS "Franchise admins can update franchise user roles" ON "public"."user_roles";
CREATE POLICY "Franchise admins can update franchise user roles" ON "public"."user_roles" FOR UPDATE USING (("public"."has_role"("auth"."uid"(), 'franchise_admin'::"public"."app_role") AND ("franchise_id" = "public"."get_user_franchise_id"("auth"."uid"()))));

DROP POLICY IF EXISTS "Franchise admins can update own franchise" ON "public"."franchises";
DROP POLICY IF EXISTS "Franchise admins can update own franchise" ON "public"."franchises";
CREATE POLICY "Franchise admins can update own franchise" ON "public"."franchises" FOR UPDATE USING (("id" = "public"."get_user_franchise_id"("auth"."uid"())));

DROP POLICY IF EXISTS "Franchise admins can view franchise assignment history" ON "public"."lead_assignment_history";
DROP POLICY IF EXISTS "Franchise admins can view franchise assignment history" ON "public"."lead_assignment_history";
CREATE POLICY "Franchise admins can view franchise assignment history" ON "public"."lead_assignment_history" FOR SELECT USING (("public"."has_role"("auth"."uid"(), 'franchise_admin'::"public"."app_role") AND ("franchise_id" = "public"."get_user_franchise_id"("auth"."uid"()))));

DROP POLICY IF EXISTS "Franchise admins can view franchise audit logs" ON "public"."email_audit_log";
DROP POLICY IF EXISTS "Franchise admins can view franchise audit logs" ON "public"."email_audit_log";
CREATE POLICY "Franchise admins can view franchise audit logs" ON "public"."email_audit_log" FOR SELECT TO "authenticated" USING (("public"."is_franchise_admin"("auth"."uid"()) AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())) AND ("franchise_id" = "public"."get_user_franchise_id"("auth"."uid"()))));

DROP POLICY IF EXISTS "Franchise admins can view franchise delegations" ON "public"."email_account_delegations";
DROP POLICY IF EXISTS "Franchise admins can view franchise delegations" ON "public"."email_account_delegations";
CREATE POLICY "Franchise admins can view franchise delegations" ON "public"."email_account_delegations" FOR SELECT USING (("public"."is_franchise_admin"("auth"."uid"()) AND ("account_id" IN ( SELECT "email_accounts"."id"
   FROM "public"."email_accounts"
  WHERE (("email_accounts"."franchise_id" = "public"."get_user_franchise_id"("auth"."uid"())) AND ("email_accounts"."tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())))))));

DROP POLICY IF EXISTS "Franchise admins can view franchise profiles" ON "public"."profiles";
DROP POLICY IF EXISTS "Franchise admins can view franchise profiles" ON "public"."profiles";
CREATE POLICY "Franchise admins can view franchise profiles" ON "public"."profiles" FOR SELECT USING (("public"."has_role"("auth"."uid"(), 'franchise_admin'::"public"."app_role") AND ("id" IN ( SELECT "user_roles"."user_id"
   FROM "public"."user_roles"
  WHERE ("user_roles"."franchise_id" = "public"."get_user_franchise_id"("auth"."uid"()))))));

DROP POLICY IF EXISTS "Franchise admins can view franchise roles" ON "public"."user_roles";
DROP POLICY IF EXISTS "Franchise admins can view franchise roles" ON "public"."user_roles";
CREATE POLICY "Franchise admins can view franchise roles" ON "public"."user_roles" FOR SELECT USING (("public"."has_role"("auth"."uid"(), 'franchise_admin'::"public"."app_role") AND ("franchise_id" = "public"."get_user_franchise_id"("auth"."uid"()))));

DROP POLICY IF EXISTS "Franchise admins can view own franchise" ON "public"."franchises";
DROP POLICY IF EXISTS "Franchise admins can view own franchise" ON "public"."franchises";
CREATE POLICY "Franchise admins can view own franchise" ON "public"."franchises" FOR SELECT USING (("id" = "public"."get_user_franchise_id"("auth"."uid"())));

DROP POLICY IF EXISTS "Franchise admins manage franchise option legs" ON "public"."quotation_version_option_legs";
DROP POLICY IF EXISTS "Franchise admins manage franchise option legs" ON "public"."quotation_version_option_legs";
CREATE POLICY "Franchise admins manage franchise option legs" ON "public"."quotation_version_option_legs" TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'franchise_admin'::"public"."app_role") AND (("franchise_id" = "public"."get_user_franchise_id"("auth"."uid"())) OR ("franchise_id" IS NULL))));

DROP POLICY IF EXISTS "Franchise admins manage franchise quotation options" ON "public"."quotation_version_options";
DROP POLICY IF EXISTS "Franchise admins manage franchise quotation options" ON "public"."quotation_version_options";
CREATE POLICY "Franchise admins manage franchise quotation options" ON "public"."quotation_version_options" TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'franchise_admin'::"public"."app_role") AND (("franchise_id" = "public"."get_user_franchise_id"("auth"."uid"())) OR ("franchise_id" IS NULL))));

DROP POLICY IF EXISTS "Franchise admins manage franchise quotation versions" ON "public"."quotation_versions";
DROP POLICY IF EXISTS "Franchise admins manage franchise quotation versions" ON "public"."quotation_versions";
CREATE POLICY "Franchise admins manage franchise quotation versions" ON "public"."quotation_versions" TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'franchise_admin'::"public"."app_role") AND (("franchise_id" = "public"."get_user_franchise_id"("auth"."uid"())) OR ("franchise_id" IS NULL))));

DROP POLICY IF EXISTS "Franchise admins manage franchise quote charges" ON "public"."quote_charges";
DROP POLICY IF EXISTS "Franchise admins manage franchise quote charges" ON "public"."quote_charges";
CREATE POLICY "Franchise admins manage franchise quote charges" ON "public"."quote_charges" TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'franchise_admin'::"public"."app_role") AND (("franchise_id" = "public"."get_user_franchise_id"("auth"."uid"())) OR ("franchise_id" IS NULL))));

DROP POLICY IF EXISTS "Franchise users can view franchise vehicles" ON "public"."vehicles";
DROP POLICY IF EXISTS "Franchise users can view franchise vehicles" ON "public"."vehicles";
CREATE POLICY "Franchise users can view franchise vehicles" ON "public"."vehicles" FOR SELECT USING (("franchise_id" = "public"."get_user_franchise_id"("auth"."uid"())));

DROP POLICY IF EXISTS "Franchise users can view franchise warehouses" ON "public"."warehouses";
DROP POLICY IF EXISTS "Franchise users can view franchise warehouses" ON "public"."warehouses";
CREATE POLICY "Franchise users can view franchise warehouses" ON "public"."warehouses" FOR SELECT USING (("franchise_id" = "public"."get_user_franchise_id"("auth"."uid"())));

DROP POLICY IF EXISTS "Import details: insert" ON "public"."import_history_details";
DROP POLICY IF EXISTS "Import details: insert" ON "public"."import_history_details";
CREATE POLICY "Import details: insert" ON "public"."import_history_details" FOR INSERT WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = 'platform_admin'::"public"."app_role")))) OR ("import_id" IN ( SELECT "ih"."id"
   FROM "public"."import_history" "ih"
  WHERE ("ih"."tenant_id" IN ( SELECT "ur"."tenant_id"
           FROM "public"."user_roles" "ur"
          WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."tenant_id" IS NOT NULL))))))));

DROP POLICY IF EXISTS "Import details: select" ON "public"."import_history_details";
DROP POLICY IF EXISTS "Import details: select" ON "public"."import_history_details";
CREATE POLICY "Import details: select" ON "public"."import_history_details" FOR SELECT USING (((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = 'platform_admin'::"public"."app_role")))) OR ("import_id" IN ( SELECT "ih"."id"
   FROM "public"."import_history" "ih"
  WHERE ("ih"."tenant_id" IN ( SELECT "ur"."tenant_id"
           FROM "public"."user_roles" "ur"
          WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."tenant_id" IS NOT NULL))))))));

DROP POLICY IF EXISTS "Import details: update" ON "public"."import_history_details";
DROP POLICY IF EXISTS "Import details: update" ON "public"."import_history_details";
CREATE POLICY "Import details: update" ON "public"."import_history_details" FOR UPDATE USING (((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = 'platform_admin'::"public"."app_role")))) OR ("import_id" IN ( SELECT "ih"."id"
   FROM "public"."import_history" "ih"
  WHERE ("ih"."tenant_id" IN ( SELECT "ur"."tenant_id"
           FROM "public"."user_roles" "ur"
          WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."tenant_id" IS NOT NULL)))))))) WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = 'platform_admin'::"public"."app_role")))) OR ("import_id" IN ( SELECT "ih"."id"
   FROM "public"."import_history" "ih"
  WHERE ("ih"."tenant_id" IN ( SELECT "ur"."tenant_id"
           FROM "public"."user_roles" "ur"
          WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."tenant_id" IS NOT NULL))))))));

DROP POLICY IF EXISTS "Import errors: delete (platform admin)" ON "public"."import_errors";
DROP POLICY IF EXISTS "Import errors: delete (platform admin)" ON "public"."import_errors";
CREATE POLICY "Import errors: delete (platform admin)" ON "public"."import_errors" FOR DELETE USING ("public"."is_platform_admin"("auth"."uid"()));

DROP POLICY IF EXISTS "Import errors: insert" ON "public"."import_errors";
DROP POLICY IF EXISTS "Import errors: insert" ON "public"."import_errors";
CREATE POLICY "Import errors: insert" ON "public"."import_errors" FOR INSERT WITH CHECK (("public"."is_platform_admin"("auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."import_history" "ih"
  WHERE (("ih"."id" = "import_errors"."import_id") AND ("ih"."tenant_id" IN ( SELECT "ur"."tenant_id"
           FROM "public"."user_roles" "ur"
          WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."tenant_id" IS NOT NULL)))))))));

DROP POLICY IF EXISTS "Import errors: select" ON "public"."import_errors";
DROP POLICY IF EXISTS "Import errors: select" ON "public"."import_errors";
CREATE POLICY "Import errors: select" ON "public"."import_errors" FOR SELECT USING (("public"."is_platform_admin"("auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."import_history" "ih"
  WHERE (("ih"."id" = "import_errors"."import_id") AND ("ih"."tenant_id" IN ( SELECT "ur"."tenant_id"
           FROM "public"."user_roles" "ur"
          WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."tenant_id" IS NOT NULL)))))))));

DROP POLICY IF EXISTS "Import errors: update (platform admin)" ON "public"."import_errors";
DROP POLICY IF EXISTS "Import errors: update (platform admin)" ON "public"."import_errors";
CREATE POLICY "Import errors: update (platform admin)" ON "public"."import_errors" FOR UPDATE USING ("public"."is_platform_admin"("auth"."uid"())) WITH CHECK ("public"."is_platform_admin"("auth"."uid"()));

DROP POLICY IF EXISTS "Import history: insert" ON "public"."import_history";
DROP POLICY IF EXISTS "Import history: insert" ON "public"."import_history";
CREATE POLICY "Import history: insert" ON "public"."import_history" FOR INSERT WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = 'platform_admin'::"public"."app_role")))) OR ("tenant_id" IN ( SELECT "ur"."tenant_id"
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."tenant_id" IS NOT NULL))))));

DROP POLICY IF EXISTS "Import history: select" ON "public"."import_history";
DROP POLICY IF EXISTS "Import history: select" ON "public"."import_history";
CREATE POLICY "Import history: select" ON "public"."import_history" FOR SELECT USING (((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = 'platform_admin'::"public"."app_role")))) OR ("tenant_id" IN ( SELECT "ur"."tenant_id"
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."tenant_id" IS NOT NULL))))));

DROP POLICY IF EXISTS "Import history: update" ON "public"."import_history";
DROP POLICY IF EXISTS "Import history: update" ON "public"."import_history";
CREATE POLICY "Import history: update" ON "public"."import_history" FOR UPDATE USING (((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = 'platform_admin'::"public"."app_role")))) OR ("tenant_id" IN ( SELECT "ur"."tenant_id"
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."tenant_id" IS NOT NULL)))))) WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = 'platform_admin'::"public"."app_role")))) OR ("tenant_id" IN ( SELECT "ur"."tenant_id"
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."tenant_id" IS NOT NULL))))));

DROP POLICY IF EXISTS "Internal users manage tokens" ON "public"."portal_tokens";
DROP POLICY IF EXISTS "Internal users manage tokens" ON "public"."portal_tokens";
CREATE POLICY "Internal users manage tokens" ON "public"."portal_tokens" TO "authenticated" USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Manage attachments by tenant admins" ON "public"."carrier_rate_attachments";
DROP POLICY IF EXISTS "Manage attachments by tenant admins" ON "public"."carrier_rate_attachments";
CREATE POLICY "Manage attachments by tenant admins" ON "public"."carrier_rate_attachments" USING (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())))) WITH CHECK (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));

DROP POLICY IF EXISTS "Manage charges by tenant admins" ON "public"."carrier_rate_charges";
DROP POLICY IF EXISTS "Manage charges by tenant admins" ON "public"."carrier_rate_charges";
CREATE POLICY "Manage charges by tenant admins" ON "public"."carrier_rate_charges" USING (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())))) WITH CHECK (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));

DROP POLICY IF EXISTS "Platform admins can insert profiles" ON "public"."profiles";
DROP POLICY IF EXISTS "Platform admins can insert profiles" ON "public"."profiles";
CREATE POLICY "Platform admins can insert profiles" ON "public"."profiles" FOR INSERT WITH CHECK ("public"."is_platform_admin"("auth"."uid"()));

DROP POLICY IF EXISTS "Platform admins can manage all OAuth configs" ON "public"."oauth_configurations";
DROP POLICY IF EXISTS "Platform admins can manage all OAuth configs" ON "public"."oauth_configurations";
CREATE POLICY "Platform admins can manage all OAuth configs" ON "public"."oauth_configurations" USING ("public"."is_platform_admin"("auth"."uid"()));

DROP POLICY IF EXISTS "Platform admins can manage all accounts" ON "public"."accounts";
DROP POLICY IF EXISTS "Platform admins can manage all accounts" ON "public"."accounts";
CREATE POLICY "Platform admins can manage all accounts" ON "public"."accounts" USING ("public"."is_platform_admin"("auth"."uid"()));

DROP POLICY IF EXISTS "Platform admins can manage all activities" ON "public"."activities";
DROP POLICY IF EXISTS "Platform admins can manage all activities" ON "public"."activities";
CREATE POLICY "Platform admins can manage all activities" ON "public"."activities" USING ("public"."is_platform_admin"("auth"."uid"()));

DROP POLICY IF EXISTS "Platform admins can manage all assignment history" ON "public"."lead_assignment_history";
DROP POLICY IF EXISTS "Platform admins can manage all assignment history" ON "public"."lead_assignment_history";
CREATE POLICY "Platform admins can manage all assignment history" ON "public"."lead_assignment_history" USING ("public"."is_platform_admin"("auth"."uid"()));

DROP POLICY IF EXISTS "Platform admins can manage all assignment queue" ON "public"."lead_assignment_queue";
DROP POLICY IF EXISTS "Platform admins can manage all assignment queue" ON "public"."lead_assignment_queue";
CREATE POLICY "Platform admins can manage all assignment queue" ON "public"."lead_assignment_queue" USING ("public"."is_platform_admin"("auth"."uid"()));

DROP POLICY IF EXISTS "Platform admins can manage all assignment rules" ON "public"."lead_assignment_rules";
DROP POLICY IF EXISTS "Platform admins can manage all assignment rules" ON "public"."lead_assignment_rules";
CREATE POLICY "Platform admins can manage all assignment rules" ON "public"."lead_assignment_rules" USING ("public"."is_platform_admin"("auth"."uid"()));

DROP POLICY IF EXISTS "Platform admins can manage all cargo details" ON "public"."cargo_details";
DROP POLICY IF EXISTS "Platform admins can manage all cargo details" ON "public"."cargo_details";
CREATE POLICY "Platform admins can manage all cargo details" ON "public"."cargo_details" USING ("public"."is_platform_admin"("auth"."uid"()));

DROP POLICY IF EXISTS "Platform admins can manage all cargo types" ON "public"."cargo_types";
DROP POLICY IF EXISTS "Platform admins can manage all cargo types" ON "public"."cargo_types";
CREATE POLICY "Platform admins can manage all cargo types" ON "public"."cargo_types" TO "authenticated" USING ("public"."is_platform_admin"("auth"."uid"()));

DROP POLICY IF EXISTS "Platform admins can manage all carrier rate charges" ON "public"."carrier_rate_charges";
DROP POLICY IF EXISTS "Platform admins can manage all carrier rate charges" ON "public"."carrier_rate_charges";
CREATE POLICY "Platform admins can manage all carrier rate charges" ON "public"."carrier_rate_charges" USING ("public"."is_platform_admin"("auth"."uid"()));

DROP POLICY IF EXISTS "Platform admins can manage all carrier type mappings" ON "public"."carrier_service_types";
DROP POLICY IF EXISTS "Platform admins can manage all carrier type mappings" ON "public"."carrier_service_types";
CREATE POLICY "Platform admins can manage all carrier type mappings" ON "public"."carrier_service_types" TO "authenticated" USING ("public"."is_platform_admin"("auth"."uid"())) WITH CHECK ("public"."is_platform_admin"("auth"."uid"()));

DROP POLICY IF EXISTS "Platform admins can manage all carriers" ON "public"."carriers";
DROP POLICY IF EXISTS "Platform admins can manage all carriers" ON "public"."carriers";
CREATE POLICY "Platform admins can manage all carriers" ON "public"."carriers" USING ("public"."is_platform_admin"("auth"."uid"()));

DROP POLICY IF EXISTS "Platform admins can manage all charge bases" ON "public"."charge_bases";
DROP POLICY IF EXISTS "Platform admins can manage all charge bases" ON "public"."charge_bases";
CREATE POLICY "Platform admins can manage all charge bases" ON "public"."charge_bases" USING ("public"."is_platform_admin"("auth"."uid"()));

DROP POLICY IF EXISTS "Platform admins can manage all charge categories" ON "public"."charge_categories";
DROP POLICY IF EXISTS "Platform admins can manage all charge categories" ON "public"."charge_categories";
CREATE POLICY "Platform admins can manage all charge categories" ON "public"."charge_categories" USING ("public"."is_platform_admin"("auth"."uid"()));

DROP POLICY IF EXISTS "Platform admins can manage all charge sides" ON "public"."charge_sides";
DROP POLICY IF EXISTS "Platform admins can manage all charge sides" ON "public"."charge_sides";
CREATE POLICY "Platform admins can manage all charge sides" ON "public"."charge_sides" USING ("public"."is_platform_admin"("auth"."uid"()));

DROP POLICY IF EXISTS "Platform admins can manage all compliance rules" ON "public"."compliance_rules";
DROP POLICY IF EXISTS "Platform admins can manage all compliance rules" ON "public"."compliance_rules";
CREATE POLICY "Platform admins can manage all compliance rules" ON "public"."compliance_rules" USING ("public"."is_platform_admin"("auth"."uid"()));

DROP POLICY IF EXISTS "Platform admins can manage all consignees" ON "public"."consignees";
DROP POLICY IF EXISTS "Platform admins can manage all consignees" ON "public"."consignees";
CREATE POLICY "Platform admins can manage all consignees" ON "public"."consignees" TO "authenticated" USING ("public"."is_platform_admin"("auth"."uid"())) WITH CHECK ("public"."is_platform_admin"("auth"."uid"()));

DROP POLICY IF EXISTS "Platform admins can manage all contacts" ON "public"."contacts";
DROP POLICY IF EXISTS "Platform admins can manage all contacts" ON "public"."contacts";
CREATE POLICY "Platform admins can manage all contacts" ON "public"."contacts" USING ("public"."is_platform_admin"("auth"."uid"()));

DROP POLICY IF EXISTS "Platform admins can manage all container sizes" ON "public"."container_sizes";
DROP POLICY IF EXISTS "Platform admins can manage all container sizes" ON "public"."container_sizes";
CREATE POLICY "Platform admins can manage all container sizes" ON "public"."container_sizes" USING ("public"."is_platform_admin"("auth"."uid"()));

DROP POLICY IF EXISTS "Platform admins can manage all container types" ON "public"."container_types";
DROP POLICY IF EXISTS "Platform admins can manage all container types" ON "public"."container_types";
CREATE POLICY "Platform admins can manage all container types" ON "public"."container_types" USING ("public"."is_platform_admin"("auth"."uid"()));

DROP POLICY IF EXISTS "Platform admins can manage all currencies" ON "public"."currencies";
DROP POLICY IF EXISTS "Platform admins can manage all currencies" ON "public"."currencies";
CREATE POLICY "Platform admins can manage all currencies" ON "public"."currencies" USING ("public"."is_platform_admin"("auth"."uid"()));

DROP POLICY IF EXISTS "Platform admins can manage all custom role permissions" ON "public"."custom_role_permissions";
DROP POLICY IF EXISTS "Platform admins can manage all custom role permissions" ON "public"."custom_role_permissions";
CREATE POLICY "Platform admins can manage all custom role permissions" ON "public"."custom_role_permissions" USING ("public"."is_platform_admin"("auth"."uid"()));

DROP POLICY IF EXISTS "Platform admins can manage all custom roles" ON "public"."custom_roles";
DROP POLICY IF EXISTS "Platform admins can manage all custom roles" ON "public"."custom_roles";
CREATE POLICY "Platform admins can manage all custom roles" ON "public"."custom_roles" USING ("public"."is_platform_admin"("auth"."uid"()));

DROP POLICY IF EXISTS "Platform admins can manage all customs documents" ON "public"."customs_documents";
DROP POLICY IF EXISTS "Platform admins can manage all customs documents" ON "public"."customs_documents";
CREATE POLICY "Platform admins can manage all customs documents" ON "public"."customs_documents" USING ("public"."is_platform_admin"("auth"."uid"()));

DROP POLICY IF EXISTS "Platform admins can manage all delegations" ON "public"."email_account_delegations";
DROP POLICY IF EXISTS "Platform admins can manage all delegations" ON "public"."email_account_delegations";
CREATE POLICY "Platform admins can manage all delegations" ON "public"."email_account_delegations" USING ("public"."is_platform_admin"("auth"."uid"()));

DROP POLICY IF EXISTS "Platform admins can manage all email filters" ON "public"."email_filters";
DROP POLICY IF EXISTS "Platform admins can manage all email filters" ON "public"."email_filters";
CREATE POLICY "Platform admins can manage all email filters" ON "public"."email_filters" USING ("public"."is_platform_admin"("auth"."uid"()));

DROP POLICY IF EXISTS "Platform admins can manage all franchise quote configs" ON "public"."quote_number_config_franchise";
DROP POLICY IF EXISTS "Platform admins can manage all franchise quote configs" ON "public"."quote_number_config_franchise";
CREATE POLICY "Platform admins can manage all franchise quote configs" ON "public"."quote_number_config_franchise" USING ("public"."is_platform_admin"("auth"."uid"()));

DROP POLICY IF EXISTS "Platform admins can manage all incoterms" ON "public"."incoterms";
DROP POLICY IF EXISTS "Platform admins can manage all incoterms" ON "public"."incoterms";
CREATE POLICY "Platform admins can manage all incoterms" ON "public"."incoterms" TO "authenticated" USING ("public"."is_platform_admin"("auth"."uid"()));

DROP POLICY IF EXISTS "Platform admins can manage all invoices" ON "public"."subscription_invoices";
DROP POLICY IF EXISTS "Platform admins can manage all invoices" ON "public"."subscription_invoices";
CREATE POLICY "Platform admins can manage all invoices" ON "public"."subscription_invoices" USING ("public"."is_platform_admin"("auth"."uid"()));

DROP POLICY IF EXISTS "Platform admins can manage all leads" ON "public"."leads";
DROP POLICY IF EXISTS "Platform admins can manage all leads" ON "public"."leads";
CREATE POLICY "Platform admins can manage all leads" ON "public"."leads" USING ("public"."is_platform_admin"("auth"."uid"()));

DROP POLICY IF EXISTS "Platform admins can manage all mappings" ON "public"."service_type_mappings";
DROP POLICY IF EXISTS "Platform admins can manage all mappings" ON "public"."service_type_mappings";
CREATE POLICY "Platform admins can manage all mappings" ON "public"."service_type_mappings" USING ("public"."is_platform_admin"("auth"."uid"()));

DROP POLICY IF EXISTS "Platform admins can manage all opportunities" ON "public"."opportunities";
DROP POLICY IF EXISTS "Platform admins can manage all opportunities" ON "public"."opportunities";
CREATE POLICY "Platform admins can manage all opportunities" ON "public"."opportunities" USING ("public"."is_platform_admin"("auth"."uid"()));

DROP POLICY IF EXISTS "Platform admins can manage all package categories" ON "public"."package_categories";
DROP POLICY IF EXISTS "Platform admins can manage all package categories" ON "public"."package_categories";
CREATE POLICY "Platform admins can manage all package categories" ON "public"."package_categories" TO "authenticated" USING ("public"."is_platform_admin"("auth"."uid"()));

DROP POLICY IF EXISTS "Platform admins can manage all package sizes" ON "public"."package_sizes";
DROP POLICY IF EXISTS "Platform admins can manage all package sizes" ON "public"."package_sizes";
CREATE POLICY "Platform admins can manage all package sizes" ON "public"."package_sizes" TO "authenticated" USING ("public"."is_platform_admin"("auth"."uid"()));

DROP POLICY IF EXISTS "Platform admins can manage all ports" ON "public"."ports_locations";
DROP POLICY IF EXISTS "Platform admins can manage all ports" ON "public"."ports_locations";
CREATE POLICY "Platform admins can manage all ports" ON "public"."ports_locations" USING ("public"."is_platform_admin"("auth"."uid"()));

DROP POLICY IF EXISTS "Platform admins can manage all presets" ON "public"."history_filter_presets";
DROP POLICY IF EXISTS "Platform admins can manage all presets" ON "public"."history_filter_presets";
CREATE POLICY "Platform admins can manage all presets" ON "public"."history_filter_presets" USING ("public"."is_platform_admin"("auth"."uid"()));

DROP POLICY IF EXISTS "Platform admins can manage all queue members" ON "public"."queue_members";
DROP POLICY IF EXISTS "Platform admins can manage all queue members" ON "public"."queue_members";
CREATE POLICY "Platform admins can manage all queue members" ON "public"."queue_members" USING ("public"."is_platform_admin"("auth"."uid"())) WITH CHECK ("public"."is_platform_admin"("auth"."uid"()));

DROP POLICY IF EXISTS "Platform admins can manage all queues" ON "public"."queues";
DROP POLICY IF EXISTS "Platform admins can manage all queues" ON "public"."queues";
CREATE POLICY "Platform admins can manage all queues" ON "public"."queues" USING ("public"."is_platform_admin"("auth"."uid"())) WITH CHECK ("public"."is_platform_admin"("auth"."uid"()));

DROP POLICY IF EXISTS "Platform admins can manage all quotation packages" ON "public"."quotation_packages";
DROP POLICY IF EXISTS "Platform admins can manage all quotation packages" ON "public"."quotation_packages";
CREATE POLICY "Platform admins can manage all quotation packages" ON "public"."quotation_packages" TO "authenticated" USING ("public"."is_platform_admin"("auth"."uid"()));

DROP POLICY IF EXISTS "Platform admins can manage all quotation version options" ON "public"."quotation_version_options";
DROP POLICY IF EXISTS "Platform admins can manage all quotation version options" ON "public"."quotation_version_options";
CREATE POLICY "Platform admins can manage all quotation version options" ON "public"."quotation_version_options" USING ("public"."is_platform_admin"("auth"."uid"()));

DROP POLICY IF EXISTS "Platform admins can manage all quote items" ON "public"."quote_items";
DROP POLICY IF EXISTS "Platform admins can manage all quote items" ON "public"."quote_items";
CREATE POLICY "Platform admins can manage all quote items" ON "public"."quote_items" TO "authenticated" USING ("public"."is_platform_admin"("auth"."uid"()));

DROP POLICY IF EXISTS "Platform admins can manage all quote legs" ON "public"."quote_legs";
DROP POLICY IF EXISTS "Platform admins can manage all quote legs" ON "public"."quote_legs";
CREATE POLICY "Platform admins can manage all quote legs" ON "public"."quote_legs" USING ("public"."is_platform_admin"("auth"."uid"()));

DROP POLICY IF EXISTS "Platform admins can manage all quote sequences" ON "public"."quote_number_sequences";
DROP POLICY IF EXISTS "Platform admins can manage all quote sequences" ON "public"."quote_number_sequences";
CREATE POLICY "Platform admins can manage all quote sequences" ON "public"."quote_number_sequences" USING ("public"."is_platform_admin"("auth"."uid"()));

DROP POLICY IF EXISTS "Platform admins can manage all quotes" ON "public"."quotes";
DROP POLICY IF EXISTS "Platform admins can manage all quotes" ON "public"."quotes";
CREATE POLICY "Platform admins can manage all quotes" ON "public"."quotes" TO "authenticated" USING ("public"."is_platform_admin"("auth"."uid"()));

DROP POLICY IF EXISTS "Platform admins can manage all rates" ON "public"."carrier_rates";
DROP POLICY IF EXISTS "Platform admins can manage all rates" ON "public"."carrier_rates";
CREATE POLICY "Platform admins can manage all rates" ON "public"."carrier_rates" USING ("public"."is_platform_admin"("auth"."uid"()));

DROP POLICY IF EXISTS "Platform admins can manage all routes" ON "public"."routes";
DROP POLICY IF EXISTS "Platform admins can manage all routes" ON "public"."routes";
CREATE POLICY "Platform admins can manage all routes" ON "public"."routes" USING ("public"."is_platform_admin"("auth"."uid"()));

DROP POLICY IF EXISTS "Platform admins can manage all scoring rules" ON "public"."lead_scoring_rules";
DROP POLICY IF EXISTS "Platform admins can manage all scoring rules" ON "public"."lead_scoring_rules";
CREATE POLICY "Platform admins can manage all scoring rules" ON "public"."lead_scoring_rules" USING ("public"."is_platform_admin"("auth"."uid"()));

DROP POLICY IF EXISTS "Platform admins can manage all service type mappings" ON "public"."service_type_mappings";
DROP POLICY IF EXISTS "Platform admins can manage all service type mappings" ON "public"."service_type_mappings";
CREATE POLICY "Platform admins can manage all service type mappings" ON "public"."service_type_mappings" TO "authenticated" USING ("public"."is_platform_admin"("auth"."uid"())) WITH CHECK ("public"."is_platform_admin"("auth"."uid"()));

DROP POLICY IF EXISTS "Platform admins can manage all service types" ON "public"."service_types";
DROP POLICY IF EXISTS "Platform admins can manage all service types" ON "public"."service_types";
CREATE POLICY "Platform admins can manage all service types" ON "public"."service_types" TO "authenticated" USING ("public"."is_platform_admin"("auth"."uid"())) WITH CHECK ("public"."is_platform_admin"("auth"."uid"()));

DROP POLICY IF EXISTS "Platform admins can manage all services" ON "public"."services";
DROP POLICY IF EXISTS "Platform admins can manage all services" ON "public"."services";
CREATE POLICY "Platform admins can manage all services" ON "public"."services" USING ("public"."is_platform_admin"("auth"."uid"())) WITH CHECK ("public"."is_platform_admin"("auth"."uid"()));

DROP POLICY IF EXISTS "Platform admins can manage all shipment items" ON "public"."shipment_items";
DROP POLICY IF EXISTS "Platform admins can manage all shipment items" ON "public"."shipment_items";
CREATE POLICY "Platform admins can manage all shipment items" ON "public"."shipment_items" USING ("public"."is_platform_admin"("auth"."uid"()));

DROP POLICY IF EXISTS "Platform admins can manage all shipments" ON "public"."shipments";
DROP POLICY IF EXISTS "Platform admins can manage all shipments" ON "public"."shipments";
CREATE POLICY "Platform admins can manage all shipments" ON "public"."shipments" USING ("public"."is_platform_admin"("auth"."uid"()));

DROP POLICY IF EXISTS "Platform admins can manage all shipping rates" ON "public"."shipping_rates";
DROP POLICY IF EXISTS "Platform admins can manage all shipping rates" ON "public"."shipping_rates";
CREATE POLICY "Platform admins can manage all shipping rates" ON "public"."shipping_rates" USING ("public"."is_platform_admin"("auth"."uid"()));

DROP POLICY IF EXISTS "Platform admins can manage all subscriptions" ON "public"."tenant_subscriptions";
DROP POLICY IF EXISTS "Platform admins can manage all subscriptions" ON "public"."tenant_subscriptions";
CREATE POLICY "Platform admins can manage all subscriptions" ON "public"."tenant_subscriptions" USING ("public"."is_platform_admin"("auth"."uid"()));

DROP POLICY IF EXISTS "Platform admins can manage all templates" ON "public"."document_templates";
DROP POLICY IF EXISTS "Platform admins can manage all templates" ON "public"."document_templates";
CREATE POLICY "Platform admins can manage all templates" ON "public"."document_templates" USING ("public"."is_platform_admin"("auth"."uid"()));

DROP POLICY IF EXISTS "Platform admins can manage all templates" ON "public"."email_templates";
DROP POLICY IF EXISTS "Platform admins can manage all templates" ON "public"."email_templates";
CREATE POLICY "Platform admins can manage all templates" ON "public"."email_templates" USING ("public"."is_platform_admin"("auth"."uid"()));

DROP POLICY IF EXISTS "Platform admins can manage all tenant quote configs" ON "public"."quote_number_config_tenant";
DROP POLICY IF EXISTS "Platform admins can manage all tenant quote configs" ON "public"."quote_number_config_tenant";
CREATE POLICY "Platform admins can manage all tenant quote configs" ON "public"."quote_number_config_tenant" USING ("public"."is_platform_admin"("auth"."uid"()));

DROP POLICY IF EXISTS "Platform admins can manage all territories" ON "public"."territories";
DROP POLICY IF EXISTS "Platform admins can manage all territories" ON "public"."territories";
CREATE POLICY "Platform admins can manage all territories" ON "public"."territories" USING ("public"."is_platform_admin"("auth"."uid"()));

DROP POLICY IF EXISTS "Platform admins can manage all territory assignments" ON "public"."territory_assignments";
DROP POLICY IF EXISTS "Platform admins can manage all territory assignments" ON "public"."territory_assignments";
CREATE POLICY "Platform admins can manage all territory assignments" ON "public"."territory_assignments" USING ("public"."is_platform_admin"("auth"."uid"()));

DROP POLICY IF EXISTS "Platform admins can manage all territory geographies" ON "public"."territory_geographies";
DROP POLICY IF EXISTS "Platform admins can manage all territory geographies" ON "public"."territory_geographies";
CREATE POLICY "Platform admins can manage all territory geographies" ON "public"."territory_geographies" USING ("public"."is_platform_admin"("auth"."uid"()));

DROP POLICY IF EXISTS "Platform admins can manage all tier configs" ON "public"."charge_tier_config";
DROP POLICY IF EXISTS "Platform admins can manage all tier configs" ON "public"."charge_tier_config";
CREATE POLICY "Platform admins can manage all tier configs" ON "public"."charge_tier_config" USING ("public"."is_platform_admin"("auth"."uid"()));

DROP POLICY IF EXISTS "Platform admins can manage all tier ranges" ON "public"."charge_tier_ranges";
DROP POLICY IF EXISTS "Platform admins can manage all tier ranges" ON "public"."charge_tier_ranges";
CREATE POLICY "Platform admins can manage all tier ranges" ON "public"."charge_tier_ranges" USING ("public"."is_platform_admin"("auth"."uid"()));

DROP POLICY IF EXISTS "Platform admins can manage all tracking events" ON "public"."tracking_events";
DROP POLICY IF EXISTS "Platform admins can manage all tracking events" ON "public"."tracking_events";
CREATE POLICY "Platform admins can manage all tracking events" ON "public"."tracking_events" USING ("public"."is_platform_admin"("auth"."uid"()));

DROP POLICY IF EXISTS "Platform admins can manage all usage records" ON "public"."usage_records";
DROP POLICY IF EXISTS "Platform admins can manage all usage records" ON "public"."usage_records";
CREATE POLICY "Platform admins can manage all usage records" ON "public"."usage_records" USING ("public"."is_platform_admin"("auth"."uid"()));

DROP POLICY IF EXISTS "Platform admins can manage all user capacity" ON "public"."user_capacity";
DROP POLICY IF EXISTS "Platform admins can manage all user capacity" ON "public"."user_capacity";
CREATE POLICY "Platform admins can manage all user capacity" ON "public"."user_capacity" USING ("public"."is_platform_admin"("auth"."uid"()));

DROP POLICY IF EXISTS "Platform admins can manage all user custom roles" ON "public"."user_custom_roles";
DROP POLICY IF EXISTS "Platform admins can manage all user custom roles" ON "public"."user_custom_roles";
CREATE POLICY "Platform admins can manage all user custom roles" ON "public"."user_custom_roles" USING ("public"."is_platform_admin"("auth"."uid"()));

DROP POLICY IF EXISTS "Platform admins can manage all vehicles" ON "public"."vehicles";
DROP POLICY IF EXISTS "Platform admins can manage all vehicles" ON "public"."vehicles";
CREATE POLICY "Platform admins can manage all vehicles" ON "public"."vehicles" USING ("public"."is_platform_admin"("auth"."uid"()));

DROP POLICY IF EXISTS "Platform admins can manage all warehouse inventory" ON "public"."warehouse_inventory";
DROP POLICY IF EXISTS "Platform admins can manage all warehouse inventory" ON "public"."warehouse_inventory";
CREATE POLICY "Platform admins can manage all warehouse inventory" ON "public"."warehouse_inventory" USING ("public"."is_platform_admin"("auth"."uid"()));

DROP POLICY IF EXISTS "Platform admins can manage all warehouses" ON "public"."warehouses";
DROP POLICY IF EXISTS "Platform admins can manage all warehouses" ON "public"."warehouses";
CREATE POLICY "Platform admins can manage all warehouses" ON "public"."warehouses" USING ("public"."is_platform_admin"("auth"."uid"()));

DROP POLICY IF EXISTS "Platform admins can manage all weight breaks" ON "public"."charge_weight_breaks";
DROP POLICY IF EXISTS "Platform admins can manage all weight breaks" ON "public"."charge_weight_breaks";
CREATE POLICY "Platform admins can manage all weight breaks" ON "public"."charge_weight_breaks" USING ("public"."is_platform_admin"("auth"."uid"()));

DROP POLICY IF EXISTS "Platform admins can manage auth_permissions" ON "public"."auth_permissions";
DROP POLICY IF EXISTS "Platform admins can manage auth_permissions" ON "public"."auth_permissions";
CREATE POLICY "Platform admins can manage auth_permissions" ON "public"."auth_permissions" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'platform_admin'::"public"."app_role")))));

DROP POLICY IF EXISTS "Platform admins can manage auth_role_permissions" ON "public"."auth_role_permissions";
DROP POLICY IF EXISTS "Platform admins can manage auth_role_permissions" ON "public"."auth_role_permissions";
CREATE POLICY "Platform admins can manage auth_role_permissions" ON "public"."auth_role_permissions" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'platform_admin'::"public"."app_role")))));

DROP POLICY IF EXISTS "Platform admins can manage auth_roles" ON "public"."auth_roles";
DROP POLICY IF EXISTS "Platform admins can manage auth_roles" ON "public"."auth_roles";
CREATE POLICY "Platform admins can manage auth_roles" ON "public"."auth_roles" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'platform_admin'::"public"."app_role")))));

DROP POLICY IF EXISTS "Platform admins can manage service leg categories" ON "public"."service_leg_categories";
DROP POLICY IF EXISTS "Platform admins can manage service leg categories" ON "public"."service_leg_categories";
CREATE POLICY "Platform admins can manage service leg categories" ON "public"."service_leg_categories" USING ("public"."is_platform_admin"("auth"."uid"()));

DROP POLICY IF EXISTS "Platform admins can manage subscription features" ON "public"."subscription_features";
DROP POLICY IF EXISTS "Platform admins can manage subscription features" ON "public"."subscription_features";
CREATE POLICY "Platform admins can manage subscription features" ON "public"."subscription_features" USING ("public"."is_platform_admin"("auth"."uid"()));

DROP POLICY IF EXISTS "Platform admins can manage subscription plans" ON "public"."subscription_plans";
DROP POLICY IF EXISTS "Platform admins can manage subscription plans" ON "public"."subscription_plans";
CREATE POLICY "Platform admins can manage subscription plans" ON "public"."subscription_plans" USING ("public"."is_platform_admin"("auth"."uid"()));

DROP POLICY IF EXISTS "Platform admins can manage transport modes" ON "public"."transport_modes";
DROP POLICY IF EXISTS "Platform admins can manage transport modes" ON "public"."transport_modes";
CREATE POLICY "Platform admins can manage transport modes" ON "public"."transport_modes" USING ("public"."is_platform_admin"("auth"."uid"()));

DROP POLICY IF EXISTS "Platform admins can update all profiles" ON "public"."profiles";
DROP POLICY IF EXISTS "Platform admins can update all profiles" ON "public"."profiles";
CREATE POLICY "Platform admins can update all profiles" ON "public"."profiles" FOR UPDATE USING ("public"."is_platform_admin"("auth"."uid"()));

DROP POLICY IF EXISTS "Platform admins can update user roles" ON "public"."user_roles";
DROP POLICY IF EXISTS "Platform admins can update user roles" ON "public"."user_roles";
CREATE POLICY "Platform admins can update user roles" ON "public"."user_roles" FOR UPDATE USING ("public"."is_platform_admin"("auth"."uid"()));

DROP POLICY IF EXISTS "Platform admins can view all audit logs" ON "public"."audit_logs";
DROP POLICY IF EXISTS "Platform admins can view all audit logs" ON "public"."audit_logs";
CREATE POLICY "Platform admins can view all audit logs" ON "public"."audit_logs" FOR SELECT USING ("public"."is_platform_admin"("auth"."uid"()));

DROP POLICY IF EXISTS "Platform admins can view all audit logs" ON "public"."quotation_audit_log";
DROP POLICY IF EXISTS "Platform admins can view all audit logs" ON "public"."quotation_audit_log";
CREATE POLICY "Platform admins can view all audit logs" ON "public"."quotation_audit_log" FOR SELECT USING ("public"."is_platform_admin"("auth"."uid"()));

DROP POLICY IF EXISTS "Platform admins can view all profiles" ON "public"."profiles";
DROP POLICY IF EXISTS "Platform admins can view all profiles" ON "public"."profiles";
CREATE POLICY "Platform admins can view all profiles" ON "public"."profiles" FOR SELECT USING ("public"."is_platform_admin"("auth"."uid"()));

DROP POLICY IF EXISTS "Platform admins full access to customer selections" ON "public"."customer_selections";
DROP POLICY IF EXISTS "Platform admins full access to customer selections" ON "public"."customer_selections";
CREATE POLICY "Platform admins full access to customer selections" ON "public"."customer_selections" USING ("public"."is_platform_admin"("auth"."uid"()));

DROP POLICY IF EXISTS "Platform admins full access to franchises" ON "public"."franchises";
DROP POLICY IF EXISTS "Platform admins full access to franchises" ON "public"."franchises";
CREATE POLICY "Platform admins full access to franchises" ON "public"."franchises" USING ("public"."is_platform_admin"("auth"."uid"()));

DROP POLICY IF EXISTS "Platform admins full access to invitations" ON "public"."invitations";
DROP POLICY IF EXISTS "Platform admins full access to invitations" ON "public"."invitations";
CREATE POLICY "Platform admins full access to invitations" ON "public"."invitations" USING ("public"."is_platform_admin"("auth"."uid"()));

DROP POLICY IF EXISTS "Platform admins full access to option legs" ON "public"."quotation_version_option_legs";
DROP POLICY IF EXISTS "Platform admins full access to option legs" ON "public"."quotation_version_option_legs";
CREATE POLICY "Platform admins full access to option legs" ON "public"."quotation_version_option_legs" TO "authenticated" USING ("public"."is_platform_admin"("auth"."uid"())) WITH CHECK ("public"."is_platform_admin"("auth"."uid"()));

DROP POLICY IF EXISTS "Platform admins full access to provider api configs" ON "public"."provider_api_configs";
DROP POLICY IF EXISTS "Platform admins full access to provider api configs" ON "public"."provider_api_configs";
CREATE POLICY "Platform admins full access to provider api configs" ON "public"."provider_api_configs" TO "authenticated" USING ("public"."is_platform_admin"("auth"."uid"())) WITH CHECK ("public"."is_platform_admin"("auth"."uid"()));

DROP POLICY IF EXISTS "Platform admins full access to provider charge mappings" ON "public"."provider_charge_mappings";
DROP POLICY IF EXISTS "Platform admins full access to provider charge mappings" ON "public"."provider_charge_mappings";
CREATE POLICY "Platform admins full access to provider charge mappings" ON "public"."provider_charge_mappings" TO "authenticated" USING ("public"."is_platform_admin"("auth"."uid"())) WITH CHECK ("public"."is_platform_admin"("auth"."uid"()));

DROP POLICY IF EXISTS "Platform admins full access to provider rate rules" ON "public"."provider_rate_rules";
DROP POLICY IF EXISTS "Platform admins full access to provider rate rules" ON "public"."provider_rate_rules";
CREATE POLICY "Platform admins full access to provider rate rules" ON "public"."provider_rate_rules" TO "authenticated" USING ("public"."is_platform_admin"("auth"."uid"())) WITH CHECK ("public"."is_platform_admin"("auth"."uid"()));

DROP POLICY IF EXISTS "Platform admins full access to provider rate templates" ON "public"."provider_rate_templates";
DROP POLICY IF EXISTS "Platform admins full access to provider rate templates" ON "public"."provider_rate_templates";
CREATE POLICY "Platform admins full access to provider rate templates" ON "public"."provider_rate_templates" TO "authenticated" USING ("public"."is_platform_admin"("auth"."uid"())) WITH CHECK ("public"."is_platform_admin"("auth"."uid"()));

DROP POLICY IF EXISTS "Platform admins full access to provider surcharges" ON "public"."provider_surcharges";
DROP POLICY IF EXISTS "Platform admins full access to provider surcharges" ON "public"."provider_surcharges";
CREATE POLICY "Platform admins full access to provider surcharges" ON "public"."provider_surcharges" TO "authenticated" USING ("public"."is_platform_admin"("auth"."uid"())) WITH CHECK ("public"."is_platform_admin"("auth"."uid"()));

DROP POLICY IF EXISTS "Platform admins full access to quotation options" ON "public"."quotation_version_options";
DROP POLICY IF EXISTS "Platform admins full access to quotation options" ON "public"."quotation_version_options";
CREATE POLICY "Platform admins full access to quotation options" ON "public"."quotation_version_options" TO "authenticated" USING ("public"."is_platform_admin"("auth"."uid"())) WITH CHECK ("public"."is_platform_admin"("auth"."uid"()));

DROP POLICY IF EXISTS "Platform admins full access to quotation versions" ON "public"."quotation_versions";
DROP POLICY IF EXISTS "Platform admins full access to quotation versions" ON "public"."quotation_versions";
CREATE POLICY "Platform admins full access to quotation versions" ON "public"."quotation_versions" TO "authenticated" USING ("public"."is_platform_admin"("auth"."uid"())) WITH CHECK ("public"."is_platform_admin"("auth"."uid"()));

DROP POLICY IF EXISTS "Platform admins full access to quote charges" ON "public"."quote_charges";
DROP POLICY IF EXISTS "Platform admins full access to quote charges" ON "public"."quote_charges";
CREATE POLICY "Platform admins full access to quote charges" ON "public"."quote_charges" TO "authenticated" USING ("public"."is_platform_admin"("auth"."uid"())) WITH CHECK ("public"."is_platform_admin"("auth"."uid"()));

DROP POLICY IF EXISTS "Platform admins full access to quote versions" ON "public"."quotation_versions";
DROP POLICY IF EXISTS "Platform admins full access to quote versions" ON "public"."quotation_versions";
CREATE POLICY "Platform admins full access to quote versions" ON "public"."quotation_versions" USING ("public"."is_platform_admin"("auth"."uid"()));

DROP POLICY IF EXISTS "Platform admins full access to roles" ON "public"."user_roles";
DROP POLICY IF EXISTS "Platform admins full access to roles" ON "public"."user_roles";
CREATE POLICY "Platform admins full access to roles" ON "public"."user_roles" USING ("public"."is_platform_admin"("auth"."uid"()));

DROP POLICY IF EXISTS "Platform admins full access to tenants" ON "public"."tenants";
DROP POLICY IF EXISTS "Platform admins full access to tenants" ON "public"."tenants";
CREATE POLICY "Platform admins full access to tenants" ON "public"."tenants" USING ("public"."is_platform_admin"("auth"."uid"()));

DROP POLICY IF EXISTS "Platform admins full access to version options" ON "public"."quotation_version_options";
DROP POLICY IF EXISTS "Platform admins full access to version options" ON "public"."quotation_version_options";
CREATE POLICY "Platform admins full access to version options" ON "public"."quotation_version_options" USING ("public"."is_platform_admin"("auth"."uid"()));

DROP POLICY IF EXISTS "Platform admins manage all cargo details" ON "public"."cargo_details";
DROP POLICY IF EXISTS "Platform admins manage all cargo details" ON "public"."cargo_details";
CREATE POLICY "Platform admins manage all cargo details" ON "public"."cargo_details" TO "authenticated" USING ("public"."is_platform_admin"("auth"."uid"())) WITH CHECK ("public"."is_platform_admin"("auth"."uid"()));

DROP POLICY IF EXISTS "Platform admins manage all carrier rates" ON "public"."carrier_rates";
DROP POLICY IF EXISTS "Platform admins manage all carrier rates" ON "public"."carrier_rates";
CREATE POLICY "Platform admins manage all carrier rates" ON "public"."carrier_rates" USING ("public"."is_platform_admin"("auth"."uid"())) WITH CHECK ("public"."is_platform_admin"("auth"."uid"()));

DROP POLICY IF EXISTS "Platform admins manage all opportunity items" ON "public"."opportunity_items";
DROP POLICY IF EXISTS "Platform admins manage all opportunity items" ON "public"."opportunity_items";
CREATE POLICY "Platform admins manage all opportunity items" ON "public"."opportunity_items" USING ("public"."is_platform_admin"("auth"."uid"()));

DROP POLICY IF EXISTS "Platform admins view all logs" ON "public"."audit_logs";
DROP POLICY IF EXISTS "Platform admins view all logs" ON "public"."audit_logs";
CREATE POLICY "Platform admins view all logs" ON "public"."audit_logs" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = 'platform_admin'::"public"."app_role")))));

DROP POLICY IF EXISTS "Scheduled emails scope matrix" ON "public"."scheduled_emails";
DROP POLICY IF EXISTS "Scheduled emails scope matrix" ON "public"."scheduled_emails";
CREATE POLICY "Scheduled emails scope matrix" ON "public"."scheduled_emails" TO "authenticated" USING (("public"."is_platform_admin"("auth"."uid"()) OR ("public"."is_tenant_admin"("auth"."uid"()) AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))) OR ("public"."is_franchise_admin"("auth"."uid"()) AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())) AND ("franchise_id" = "public"."get_user_franchise_id"("auth"."uid"()))) OR ("public"."is_sales_manager"("auth"."uid"()) AND ("user_id" IN ( SELECT "public"."get_sales_manager_team_user_ids"("auth"."uid"()) AS "get_sales_manager_team_user_ids"))) OR ("user_id" = "auth"."uid"()))) WITH CHECK (((NOT "public"."is_viewer"("auth"."uid"())) AND ("public"."is_platform_admin"("auth"."uid"()) OR ("public"."is_tenant_admin"("auth"."uid"()) AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))) OR ("public"."is_franchise_admin"("auth"."uid"()) AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())) AND ("franchise_id" = "public"."get_user_franchise_id"("auth"."uid"()))) OR ("user_id" = "auth"."uid"()))));

DROP POLICY IF EXISTS "Super admins can view all audit logs" ON "public"."email_audit_log";
DROP POLICY IF EXISTS "Super admins can view all audit logs" ON "public"."email_audit_log";
CREATE POLICY "Super admins can view all audit logs" ON "public"."email_audit_log" FOR SELECT TO "authenticated" USING ("public"."is_super_admin"("auth"."uid"()));

DROP POLICY IF EXISTS "System can manage quote sequences" ON "public"."quote_number_sequences";
DROP POLICY IF EXISTS "System can manage quote sequences" ON "public"."quote_number_sequences";
CREATE POLICY "System can manage quote sequences" ON "public"."quote_number_sequences" USING (true);

DROP POLICY IF EXISTS "Tenant admins can create own subscriptions" ON "public"."tenant_subscriptions";
DROP POLICY IF EXISTS "Tenant admins can create own subscriptions" ON "public"."tenant_subscriptions";
CREATE POLICY "Tenant admins can create own subscriptions" ON "public"."tenant_subscriptions" FOR INSERT WITH CHECK (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));

DROP POLICY IF EXISTS "Tenant admins can manage cargo details" ON "public"."cargo_details";
DROP POLICY IF EXISTS "Tenant admins can manage cargo details" ON "public"."cargo_details";
CREATE POLICY "Tenant admins can manage cargo details" ON "public"."cargo_details" USING (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));

DROP POLICY IF EXISTS "Tenant admins can manage cargo types" ON "public"."cargo_types";
DROP POLICY IF EXISTS "Tenant admins can manage cargo types" ON "public"."cargo_types";
CREATE POLICY "Tenant admins can manage cargo types" ON "public"."cargo_types" TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));

DROP POLICY IF EXISTS "Tenant admins can manage carrier rate charges" ON "public"."carrier_rate_charges";
DROP POLICY IF EXISTS "Tenant admins can manage carrier rate charges" ON "public"."carrier_rate_charges";
CREATE POLICY "Tenant admins can manage carrier rate charges" ON "public"."carrier_rate_charges" USING (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));

DROP POLICY IF EXISTS "Tenant admins can manage carriers" ON "public"."carriers";
DROP POLICY IF EXISTS "Tenant admins can manage carriers" ON "public"."carriers";
CREATE POLICY "Tenant admins can manage carriers" ON "public"."carriers" USING (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));

DROP POLICY IF EXISTS "Tenant admins can manage compliance rules" ON "public"."compliance_rules";
DROP POLICY IF EXISTS "Tenant admins can manage compliance rules" ON "public"."compliance_rules";
CREATE POLICY "Tenant admins can manage compliance rules" ON "public"."compliance_rules" USING (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));

DROP POLICY IF EXISTS "Tenant admins can manage consignees" ON "public"."consignees";
DROP POLICY IF EXISTS "Tenant admins can manage consignees" ON "public"."consignees";
CREATE POLICY "Tenant admins can manage consignees" ON "public"."consignees" USING (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));

DROP POLICY IF EXISTS "Tenant admins can manage container sizes" ON "public"."container_sizes";
DROP POLICY IF EXISTS "Tenant admins can manage container sizes" ON "public"."container_sizes";
CREATE POLICY "Tenant admins can manage container sizes" ON "public"."container_sizes" USING (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));

DROP POLICY IF EXISTS "Tenant admins can manage container types" ON "public"."container_types";
DROP POLICY IF EXISTS "Tenant admins can manage container types" ON "public"."container_types";
CREATE POLICY "Tenant admins can manage container types" ON "public"."container_types" USING (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));

DROP POLICY IF EXISTS "Tenant admins can manage franchise quote configs" ON "public"."quote_number_config_franchise";
DROP POLICY IF EXISTS "Tenant admins can manage franchise quote configs" ON "public"."quote_number_config_franchise";
CREATE POLICY "Tenant admins can manage franchise quote configs" ON "public"."quote_number_config_franchise" USING (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));

DROP POLICY IF EXISTS "Tenant admins can manage incoterms" ON "public"."incoterms";
DROP POLICY IF EXISTS "Tenant admins can manage incoterms" ON "public"."incoterms";
CREATE POLICY "Tenant admins can manage incoterms" ON "public"."incoterms" TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));

DROP POLICY IF EXISTS "Tenant admins can manage members of their tenant queues" ON "public"."queue_members";
DROP POLICY IF EXISTS "Tenant admins can manage members of their tenant queues" ON "public"."queue_members";
CREATE POLICY "Tenant admins can manage members of their tenant queues" ON "public"."queue_members" USING (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND (EXISTS ( SELECT 1
   FROM "public"."queues" "q"
  WHERE (("q"."id" = "queue_members"."queue_id") AND ("q"."tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))))))) WITH CHECK (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND (EXISTS ( SELECT 1
   FROM "public"."queues" "q"
  WHERE (("q"."id" = "queue_members"."queue_id") AND ("q"."tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())))))));

DROP POLICY IF EXISTS "Tenant admins can manage own carrier type mappings" ON "public"."carrier_service_types";
DROP POLICY IF EXISTS "Tenant admins can manage own carrier type mappings" ON "public"."carrier_service_types";
CREATE POLICY "Tenant admins can manage own carrier type mappings" ON "public"."carrier_service_types" TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())))) WITH CHECK (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));

DROP POLICY IF EXISTS "Tenant admins can manage own service type mappings" ON "public"."service_type_mappings";
DROP POLICY IF EXISTS "Tenant admins can manage own service type mappings" ON "public"."service_type_mappings";
CREATE POLICY "Tenant admins can manage own service type mappings" ON "public"."service_type_mappings" TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())))) WITH CHECK (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));

DROP POLICY IF EXISTS "Tenant admins can manage package categories" ON "public"."package_categories";
DROP POLICY IF EXISTS "Tenant admins can manage package categories" ON "public"."package_categories";
CREATE POLICY "Tenant admins can manage package categories" ON "public"."package_categories" TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));

DROP POLICY IF EXISTS "Tenant admins can manage package sizes" ON "public"."package_sizes";
DROP POLICY IF EXISTS "Tenant admins can manage package sizes" ON "public"."package_sizes";
CREATE POLICY "Tenant admins can manage package sizes" ON "public"."package_sizes" TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));

DROP POLICY IF EXISTS "Tenant admins can manage ports" ON "public"."ports_locations";
DROP POLICY IF EXISTS "Tenant admins can manage ports" ON "public"."ports_locations";
CREATE POLICY "Tenant admins can manage ports" ON "public"."ports_locations" USING (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));

DROP POLICY IF EXISTS "Tenant admins can manage queue members" ON "public"."queue_members";
DROP POLICY IF EXISTS "Tenant admins can manage queue members" ON "public"."queue_members";
CREATE POLICY "Tenant admins can manage queue members" ON "public"."queue_members" USING ((EXISTS ( SELECT 1
   FROM "public"."queues" "q"
  WHERE (("q"."id" = "queue_members"."queue_id") AND ("q"."tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())) AND "public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."queues" "q"
  WHERE (("q"."id" = "queue_members"."queue_id") AND ("q"."tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())) AND "public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role")))));

DROP POLICY IF EXISTS "Tenant admins can manage queues" ON "public"."queues";
DROP POLICY IF EXISTS "Tenant admins can manage queues" ON "public"."queues";
CREATE POLICY "Tenant admins can manage queues" ON "public"."queues" USING (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())))) WITH CHECK (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));

DROP POLICY IF EXISTS "Tenant admins can manage rates" ON "public"."carrier_rates";
DROP POLICY IF EXISTS "Tenant admins can manage rates" ON "public"."carrier_rates";
CREATE POLICY "Tenant admins can manage rates" ON "public"."carrier_rates" USING (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));

DROP POLICY IF EXISTS "Tenant admins can manage services" ON "public"."services";
DROP POLICY IF EXISTS "Tenant admins can manage services" ON "public"."services";
CREATE POLICY "Tenant admins can manage services" ON "public"."services" USING (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));

DROP POLICY IF EXISTS "Tenant admins can manage templates" ON "public"."document_templates";
DROP POLICY IF EXISTS "Tenant admins can manage templates" ON "public"."document_templates";
CREATE POLICY "Tenant admins can manage templates" ON "public"."document_templates" USING (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));

DROP POLICY IF EXISTS "Tenant admins can manage tenant accounts" ON "public"."accounts";
DROP POLICY IF EXISTS "Tenant admins can manage tenant accounts" ON "public"."accounts";
CREATE POLICY "Tenant admins can manage tenant accounts" ON "public"."accounts" USING (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));

DROP POLICY IF EXISTS "Tenant admins can manage tenant activities" ON "public"."activities";
DROP POLICY IF EXISTS "Tenant admins can manage tenant activities" ON "public"."activities";
CREATE POLICY "Tenant admins can manage tenant activities" ON "public"."activities" USING (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));

DROP POLICY IF EXISTS "Tenant admins can manage tenant assignment rules" ON "public"."lead_assignment_rules";
DROP POLICY IF EXISTS "Tenant admins can manage tenant assignment rules" ON "public"."lead_assignment_rules";
CREATE POLICY "Tenant admins can manage tenant assignment rules" ON "public"."lead_assignment_rules" USING (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));

DROP POLICY IF EXISTS "Tenant admins can manage tenant contacts" ON "public"."contacts";
DROP POLICY IF EXISTS "Tenant admins can manage tenant contacts" ON "public"."contacts";
CREATE POLICY "Tenant admins can manage tenant contacts" ON "public"."contacts" USING (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));

DROP POLICY IF EXISTS "Tenant admins can manage tenant custom role permissions" ON "public"."custom_role_permissions";
DROP POLICY IF EXISTS "Tenant admins can manage tenant custom role permissions" ON "public"."custom_role_permissions";
CREATE POLICY "Tenant admins can manage tenant custom role permissions" ON "public"."custom_role_permissions" USING (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("role_id" IN ( SELECT "custom_roles"."id"
   FROM "public"."custom_roles"
  WHERE ("custom_roles"."tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))))));

DROP POLICY IF EXISTS "Tenant admins can manage tenant custom roles" ON "public"."custom_roles";
DROP POLICY IF EXISTS "Tenant admins can manage tenant custom roles" ON "public"."custom_roles";
CREATE POLICY "Tenant admins can manage tenant custom roles" ON "public"."custom_roles" USING (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));

DROP POLICY IF EXISTS "Tenant admins can manage tenant franchises" ON "public"."franchises";
DROP POLICY IF EXISTS "Tenant admins can manage tenant franchises" ON "public"."franchises";
CREATE POLICY "Tenant admins can manage tenant franchises" ON "public"."franchises" USING (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())));

DROP POLICY IF EXISTS "Tenant admins can manage tenant invitations" ON "public"."invitations";
DROP POLICY IF EXISTS "Tenant admins can manage tenant invitations" ON "public"."invitations";
CREATE POLICY "Tenant admins can manage tenant invitations" ON "public"."invitations" USING (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));

DROP POLICY IF EXISTS "Tenant admins can manage tenant leads" ON "public"."leads";
DROP POLICY IF EXISTS "Tenant admins can manage tenant leads" ON "public"."leads";
CREATE POLICY "Tenant admins can manage tenant leads" ON "public"."leads" USING (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));

DROP POLICY IF EXISTS "Tenant admins can manage tenant mappings" ON "public"."service_type_mappings";
DROP POLICY IF EXISTS "Tenant admins can manage tenant mappings" ON "public"."service_type_mappings";
CREATE POLICY "Tenant admins can manage tenant mappings" ON "public"."service_type_mappings" USING (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));

DROP POLICY IF EXISTS "Tenant admins can manage tenant opportunities" ON "public"."opportunities";
DROP POLICY IF EXISTS "Tenant admins can manage tenant opportunities" ON "public"."opportunities";
CREATE POLICY "Tenant admins can manage tenant opportunities" ON "public"."opportunities" USING (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));

DROP POLICY IF EXISTS "Tenant admins can manage tenant queues" ON "public"."queues";
DROP POLICY IF EXISTS "Tenant admins can manage tenant queues" ON "public"."queues";
CREATE POLICY "Tenant admins can manage tenant queues" ON "public"."queues" USING (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())))) WITH CHECK (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));

DROP POLICY IF EXISTS "Tenant admins can manage tenant quotation packages" ON "public"."quotation_packages";
DROP POLICY IF EXISTS "Tenant admins can manage tenant quotation packages" ON "public"."quotation_packages";
CREATE POLICY "Tenant admins can manage tenant quotation packages" ON "public"."quotation_packages" TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));

DROP POLICY IF EXISTS "Tenant admins can manage tenant quote config" ON "public"."quote_number_config_tenant";
DROP POLICY IF EXISTS "Tenant admins can manage tenant quote config" ON "public"."quote_number_config_tenant";
CREATE POLICY "Tenant admins can manage tenant quote config" ON "public"."quote_number_config_tenant" USING (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));

DROP POLICY IF EXISTS "Tenant admins can manage tenant quote legs" ON "public"."quote_legs";
DROP POLICY IF EXISTS "Tenant admins can manage tenant quote legs" ON "public"."quote_legs";
CREATE POLICY "Tenant admins can manage tenant quote legs" ON "public"."quote_legs" USING (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));

DROP POLICY IF EXISTS "Tenant admins can manage tenant quotes" ON "public"."quotes";
DROP POLICY IF EXISTS "Tenant admins can manage tenant quotes" ON "public"."quotes";
CREATE POLICY "Tenant admins can manage tenant quotes" ON "public"."quotes" TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));

DROP POLICY IF EXISTS "Tenant admins can manage tenant roles" ON "public"."user_roles";
DROP POLICY IF EXISTS "Tenant admins can manage tenant roles" ON "public"."user_roles";
CREATE POLICY "Tenant admins can manage tenant roles" ON "public"."user_roles" USING (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));

DROP POLICY IF EXISTS "Tenant admins can manage tenant routes" ON "public"."routes";
DROP POLICY IF EXISTS "Tenant admins can manage tenant routes" ON "public"."routes";
CREATE POLICY "Tenant admins can manage tenant routes" ON "public"."routes" USING (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));

DROP POLICY IF EXISTS "Tenant admins can manage tenant scoring rules" ON "public"."lead_scoring_rules";
DROP POLICY IF EXISTS "Tenant admins can manage tenant scoring rules" ON "public"."lead_scoring_rules";
CREATE POLICY "Tenant admins can manage tenant scoring rules" ON "public"."lead_scoring_rules" USING (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));

DROP POLICY IF EXISTS "Tenant admins can manage tenant shipments" ON "public"."shipments";
DROP POLICY IF EXISTS "Tenant admins can manage tenant shipments" ON "public"."shipments";
CREATE POLICY "Tenant admins can manage tenant shipments" ON "public"."shipments" USING (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));

DROP POLICY IF EXISTS "Tenant admins can manage tenant shipping rates" ON "public"."shipping_rates";
DROP POLICY IF EXISTS "Tenant admins can manage tenant shipping rates" ON "public"."shipping_rates";
CREATE POLICY "Tenant admins can manage tenant shipping rates" ON "public"."shipping_rates" USING (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));

DROP POLICY IF EXISTS "Tenant admins can manage tenant territories" ON "public"."territories";
DROP POLICY IF EXISTS "Tenant admins can manage tenant territories" ON "public"."territories";
CREATE POLICY "Tenant admins can manage tenant territories" ON "public"."territories" USING (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));

DROP POLICY IF EXISTS "Tenant admins can manage tenant user capacity" ON "public"."user_capacity";
DROP POLICY IF EXISTS "Tenant admins can manage tenant user capacity" ON "public"."user_capacity";
CREATE POLICY "Tenant admins can manage tenant user capacity" ON "public"."user_capacity" USING (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));

DROP POLICY IF EXISTS "Tenant admins can manage tenant user custom roles" ON "public"."user_custom_roles";
DROP POLICY IF EXISTS "Tenant admins can manage tenant user custom roles" ON "public"."user_custom_roles";
CREATE POLICY "Tenant admins can manage tenant user custom roles" ON "public"."user_custom_roles" USING (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));

DROP POLICY IF EXISTS "Tenant admins can manage tenant vehicles" ON "public"."vehicles";
DROP POLICY IF EXISTS "Tenant admins can manage tenant vehicles" ON "public"."vehicles";
CREATE POLICY "Tenant admins can manage tenant vehicles" ON "public"."vehicles" USING (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));

DROP POLICY IF EXISTS "Tenant admins can manage tenant warehouse inventory" ON "public"."warehouse_inventory";
DROP POLICY IF EXISTS "Tenant admins can manage tenant warehouse inventory" ON "public"."warehouse_inventory";
CREATE POLICY "Tenant admins can manage tenant warehouse inventory" ON "public"."warehouse_inventory" USING (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("warehouse_id" IN ( SELECT "warehouses"."id"
   FROM "public"."warehouses"
  WHERE ("warehouses"."tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))))));

DROP POLICY IF EXISTS "Tenant admins can manage tenant warehouses" ON "public"."warehouses";
DROP POLICY IF EXISTS "Tenant admins can manage tenant warehouses" ON "public"."warehouses";
CREATE POLICY "Tenant admins can manage tenant warehouses" ON "public"."warehouses" USING (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));

DROP POLICY IF EXISTS "Tenant admins can manage territory assignments" ON "public"."territory_assignments";
DROP POLICY IF EXISTS "Tenant admins can manage territory assignments" ON "public"."territory_assignments";
CREATE POLICY "Tenant admins can manage territory assignments" ON "public"."territory_assignments" USING (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("territory_id" IN ( SELECT "territories"."id"
   FROM "public"."territories"
  WHERE ("territories"."tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))))));

DROP POLICY IF EXISTS "Tenant admins can manage their territory geographies" ON "public"."territory_geographies";
DROP POLICY IF EXISTS "Tenant admins can manage their territory geographies" ON "public"."territory_geographies";
CREATE POLICY "Tenant admins can manage their territory geographies" ON "public"."territory_geographies" USING ((EXISTS ( SELECT 1
   FROM "public"."territories" "t"
  WHERE (("t"."id" = "territory_geographies"."territory_id") AND ("t"."tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))))));

DROP POLICY IF EXISTS "Tenant admins can manage themes" ON "public"."themes";
DROP POLICY IF EXISTS "Tenant admins can manage themes" ON "public"."themes";
CREATE POLICY "Tenant admins can manage themes" ON "public"."themes" USING ((("tenant_id" IN ( SELECT "user_roles"."tenant_id"
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = ANY (ARRAY['tenant_admin'::"public"."app_role", 'platform_admin'::"public"."app_role"]))))) OR "public"."is_platform_admin"("auth"."uid"())));

DROP POLICY IF EXISTS "Tenant admins can manage tier configs" ON "public"."charge_tier_config";
DROP POLICY IF EXISTS "Tenant admins can manage tier configs" ON "public"."charge_tier_config";
CREATE POLICY "Tenant admins can manage tier configs" ON "public"."charge_tier_config" USING (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));

DROP POLICY IF EXISTS "Tenant admins can manage tier ranges" ON "public"."charge_tier_ranges";
DROP POLICY IF EXISTS "Tenant admins can manage tier ranges" ON "public"."charge_tier_ranges";
CREATE POLICY "Tenant admins can manage tier ranges" ON "public"."charge_tier_ranges" USING (("tier_config_id" IN ( SELECT "charge_tier_config"."id"
   FROM "public"."charge_tier_config"
  WHERE ("charge_tier_config"."tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())))));

DROP POLICY IF EXISTS "Tenant admins can manage weight breaks" ON "public"."charge_weight_breaks";
DROP POLICY IF EXISTS "Tenant admins can manage weight breaks" ON "public"."charge_weight_breaks";
CREATE POLICY "Tenant admins can manage weight breaks" ON "public"."charge_weight_breaks" USING (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));

DROP POLICY IF EXISTS "Tenant admins can update own subscriptions" ON "public"."tenant_subscriptions";
DROP POLICY IF EXISTS "Tenant admins can update own subscriptions" ON "public"."tenant_subscriptions";
CREATE POLICY "Tenant admins can update own subscriptions" ON "public"."tenant_subscriptions" FOR UPDATE USING (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));

DROP POLICY IF EXISTS "Tenant admins can update own tenant" ON "public"."tenants";
DROP POLICY IF EXISTS "Tenant admins can update own tenant" ON "public"."tenants";
CREATE POLICY "Tenant admins can update own tenant" ON "public"."tenants" FOR UPDATE USING (("id" = "public"."get_user_tenant_id"("auth"."uid"())));

DROP POLICY IF EXISTS "Tenant admins can update tenant user roles" ON "public"."user_roles";
DROP POLICY IF EXISTS "Tenant admins can update tenant user roles" ON "public"."user_roles";
CREATE POLICY "Tenant admins can update tenant user roles" ON "public"."user_roles" FOR UPDATE USING (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));

DROP POLICY IF EXISTS "Tenant admins can view all audit logs" ON "public"."quotation_audit_log";
DROP POLICY IF EXISTS "Tenant admins can view all audit logs" ON "public"."quotation_audit_log";
CREATE POLICY "Tenant admins can view all audit logs" ON "public"."quotation_audit_log" FOR SELECT USING (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));

DROP POLICY IF EXISTS "Tenant admins can view delegations" ON "public"."email_account_delegations";
DROP POLICY IF EXISTS "Tenant admins can view delegations" ON "public"."email_account_delegations";
CREATE POLICY "Tenant admins can view delegations" ON "public"."email_account_delegations" FOR SELECT USING (("public"."is_tenant_admin"("auth"."uid"()) AND ("account_id" IN ( SELECT "email_accounts"."id"
   FROM "public"."email_accounts"
  WHERE ("email_accounts"."tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))))));

DROP POLICY IF EXISTS "Tenant admins can view own invoices" ON "public"."subscription_invoices";
DROP POLICY IF EXISTS "Tenant admins can view own invoices" ON "public"."subscription_invoices";
CREATE POLICY "Tenant admins can view own invoices" ON "public"."subscription_invoices" FOR SELECT USING (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));

DROP POLICY IF EXISTS "Tenant admins can view own subscriptions" ON "public"."tenant_subscriptions";
DROP POLICY IF EXISTS "Tenant admins can view own subscriptions" ON "public"."tenant_subscriptions";
CREATE POLICY "Tenant admins can view own subscriptions" ON "public"."tenant_subscriptions" FOR SELECT USING (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));

DROP POLICY IF EXISTS "Tenant admins can view own tenant" ON "public"."tenants";
DROP POLICY IF EXISTS "Tenant admins can view own tenant" ON "public"."tenants";
CREATE POLICY "Tenant admins can view own tenant" ON "public"."tenants" FOR SELECT USING (("id" = "public"."get_user_tenant_id"("auth"."uid"())));

DROP POLICY IF EXISTS "Tenant admins can view own usage records" ON "public"."usage_records";
DROP POLICY IF EXISTS "Tenant admins can view own usage records" ON "public"."usage_records";
CREATE POLICY "Tenant admins can view own usage records" ON "public"."usage_records" FOR SELECT USING (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));

DROP POLICY IF EXISTS "Tenant admins can view tenant assignment history" ON "public"."lead_assignment_history";
DROP POLICY IF EXISTS "Tenant admins can view tenant assignment history" ON "public"."lead_assignment_history";
CREATE POLICY "Tenant admins can view tenant assignment history" ON "public"."lead_assignment_history" FOR SELECT USING (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));

DROP POLICY IF EXISTS "Tenant admins can view tenant assignment queue" ON "public"."lead_assignment_queue";
DROP POLICY IF EXISTS "Tenant admins can view tenant assignment queue" ON "public"."lead_assignment_queue";
CREATE POLICY "Tenant admins can view tenant assignment queue" ON "public"."lead_assignment_queue" FOR SELECT USING (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));

DROP POLICY IF EXISTS "Tenant admins can view tenant audit logs" ON "public"."audit_logs";
DROP POLICY IF EXISTS "Tenant admins can view tenant audit logs" ON "public"."audit_logs";
CREATE POLICY "Tenant admins can view tenant audit logs" ON "public"."audit_logs" FOR SELECT USING (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("user_id" IN ( SELECT "ur"."user_id"
   FROM "public"."user_roles" "ur"
  WHERE ("ur"."tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))))));

DROP POLICY IF EXISTS "Tenant admins can view tenant audit logs" ON "public"."email_audit_log";
DROP POLICY IF EXISTS "Tenant admins can view tenant audit logs" ON "public"."email_audit_log";
CREATE POLICY "Tenant admins can view tenant audit logs" ON "public"."email_audit_log" FOR SELECT TO "authenticated" USING (("public"."is_tenant_admin"("auth"."uid"()) AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));

DROP POLICY IF EXISTS "Tenant admins can view tenant profiles" ON "public"."profiles";
DROP POLICY IF EXISTS "Tenant admins can view tenant profiles" ON "public"."profiles";
CREATE POLICY "Tenant admins can view tenant profiles" ON "public"."profiles" FOR SELECT USING (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("id" IN ( SELECT "user_roles"."user_id"
   FROM "public"."user_roles"
  WHERE ("user_roles"."tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))))));

DROP POLICY IF EXISTS "Tenant admins manage own cargo details" ON "public"."cargo_details";
DROP POLICY IF EXISTS "Tenant admins manage own cargo details" ON "public"."cargo_details";
CREATE POLICY "Tenant admins manage own cargo details" ON "public"."cargo_details" TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())))) WITH CHECK (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));

DROP POLICY IF EXISTS "Tenant admins manage provider api configs" ON "public"."provider_api_configs";
DROP POLICY IF EXISTS "Tenant admins manage provider api configs" ON "public"."provider_api_configs";
CREATE POLICY "Tenant admins manage provider api configs" ON "public"."provider_api_configs" TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));

DROP POLICY IF EXISTS "Tenant admins manage provider charge mappings" ON "public"."provider_charge_mappings";
DROP POLICY IF EXISTS "Tenant admins manage provider charge mappings" ON "public"."provider_charge_mappings";
CREATE POLICY "Tenant admins manage provider charge mappings" ON "public"."provider_charge_mappings" TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));

DROP POLICY IF EXISTS "Tenant admins manage provider rate rules" ON "public"."provider_rate_rules";
DROP POLICY IF EXISTS "Tenant admins manage provider rate rules" ON "public"."provider_rate_rules";
CREATE POLICY "Tenant admins manage provider rate rules" ON "public"."provider_rate_rules" TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));

DROP POLICY IF EXISTS "Tenant admins manage provider rate templates" ON "public"."provider_rate_templates";
DROP POLICY IF EXISTS "Tenant admins manage provider rate templates" ON "public"."provider_rate_templates";
CREATE POLICY "Tenant admins manage provider rate templates" ON "public"."provider_rate_templates" TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));

DROP POLICY IF EXISTS "Tenant admins manage provider surcharges" ON "public"."provider_surcharges";
DROP POLICY IF EXISTS "Tenant admins manage provider surcharges" ON "public"."provider_surcharges";
CREATE POLICY "Tenant admins manage provider surcharges" ON "public"."provider_surcharges" TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));

DROP POLICY IF EXISTS "Tenant admins manage quotation versions" ON "public"."quotation_versions";
DROP POLICY IF EXISTS "Tenant admins manage quotation versions" ON "public"."quotation_versions";
CREATE POLICY "Tenant admins manage quotation versions" ON "public"."quotation_versions" USING (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())))) WITH CHECK (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));

DROP POLICY IF EXISTS "Tenant admins manage selection events" ON "public"."quotation_selection_events";
DROP POLICY IF EXISTS "Tenant admins manage selection events" ON "public"."quotation_selection_events";
CREATE POLICY "Tenant admins manage selection events" ON "public"."quotation_selection_events" USING (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())))) WITH CHECK (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));

DROP POLICY IF EXISTS "Tenant admins manage tenant carrier rates" ON "public"."carrier_rates";
DROP POLICY IF EXISTS "Tenant admins manage tenant carrier rates" ON "public"."carrier_rates";
CREATE POLICY "Tenant admins manage tenant carrier rates" ON "public"."carrier_rates" USING (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())))) WITH CHECK (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));

DROP POLICY IF EXISTS "Tenant admins manage tenant option legs" ON "public"."quotation_version_option_legs";
DROP POLICY IF EXISTS "Tenant admins manage tenant option legs" ON "public"."quotation_version_option_legs";
CREATE POLICY "Tenant admins manage tenant option legs" ON "public"."quotation_version_option_legs" TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));

DROP POLICY IF EXISTS "Tenant admins manage tenant quotation options" ON "public"."quotation_version_options";
DROP POLICY IF EXISTS "Tenant admins manage tenant quotation options" ON "public"."quotation_version_options";
CREATE POLICY "Tenant admins manage tenant quotation options" ON "public"."quotation_version_options" TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));

DROP POLICY IF EXISTS "Tenant admins manage tenant quotation versions" ON "public"."quotation_versions";
DROP POLICY IF EXISTS "Tenant admins manage tenant quotation versions" ON "public"."quotation_versions";
CREATE POLICY "Tenant admins manage tenant quotation versions" ON "public"."quotation_versions" TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));

DROP POLICY IF EXISTS "Tenant admins manage tenant quote charges" ON "public"."quote_charges";
DROP POLICY IF EXISTS "Tenant admins manage tenant quote charges" ON "public"."quote_charges";
CREATE POLICY "Tenant admins manage tenant quote charges" ON "public"."quote_charges" TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));

DROP POLICY IF EXISTS "Tenant admins manage version options" ON "public"."quotation_version_options";
DROP POLICY IF EXISTS "Tenant admins manage version options" ON "public"."quotation_version_options";
CREATE POLICY "Tenant admins manage version options" ON "public"."quotation_version_options" USING (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())))) WITH CHECK (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));

DROP POLICY IF EXISTS "Tenant members can view own subscription invoices" ON "public"."subscription_invoices";
DROP POLICY IF EXISTS "Tenant members can view own subscription invoices" ON "public"."subscription_invoices";
CREATE POLICY "Tenant members can view own subscription invoices" ON "public"."subscription_invoices" FOR SELECT USING (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())));

DROP POLICY IF EXISTS "Tenant members can view own subscriptions" ON "public"."tenant_subscriptions";
DROP POLICY IF EXISTS "Tenant members can view own subscriptions" ON "public"."tenant_subscriptions";
CREATE POLICY "Tenant members can view own subscriptions" ON "public"."tenant_subscriptions" FOR SELECT USING (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())));

DROP POLICY IF EXISTS "Tenant members can view own usage records" ON "public"."usage_records";
DROP POLICY IF EXISTS "Tenant members can view own usage records" ON "public"."usage_records";
CREATE POLICY "Tenant members can view own usage records" ON "public"."usage_records" FOR SELECT USING (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())));

DROP POLICY IF EXISTS "Tenant users can view compliance rules" ON "public"."compliance_rules";
DROP POLICY IF EXISTS "Tenant users can view compliance rules" ON "public"."compliance_rules";
CREATE POLICY "Tenant users can view compliance rules" ON "public"."compliance_rules" FOR SELECT USING (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())));

DROP POLICY IF EXISTS "Tenant users can view container sizes" ON "public"."container_sizes";
DROP POLICY IF EXISTS "Tenant users can view container sizes" ON "public"."container_sizes";
CREATE POLICY "Tenant users can view container sizes" ON "public"."container_sizes" FOR SELECT USING ((("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())) OR ("tenant_id" IS NULL)));

DROP POLICY IF EXISTS "Tenant users can view container types" ON "public"."container_types";
DROP POLICY IF EXISTS "Tenant users can view container types" ON "public"."container_types";
CREATE POLICY "Tenant users can view container types" ON "public"."container_types" FOR SELECT USING ((("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())) OR ("tenant_id" IS NULL)));

DROP POLICY IF EXISTS "Tenant users can view rates" ON "public"."carrier_rates";
DROP POLICY IF EXISTS "Tenant users can view rates" ON "public"."carrier_rates";
CREATE POLICY "Tenant users can view rates" ON "public"."carrier_rates" FOR SELECT USING (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())));

DROP POLICY IF EXISTS "Tenant users can view services" ON "public"."services";
DROP POLICY IF EXISTS "Tenant users can view services" ON "public"."services";
CREATE POLICY "Tenant users can view services" ON "public"."services" FOR SELECT USING (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())));

DROP POLICY IF EXISTS "Tenant users can view templates" ON "public"."document_templates";
DROP POLICY IF EXISTS "Tenant users can view templates" ON "public"."document_templates";
CREATE POLICY "Tenant users can view templates" ON "public"."document_templates" FOR SELECT USING (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())));

DROP POLICY IF EXISTS "Territory geographies deletable" ON "public"."territory_geographies";
DROP POLICY IF EXISTS "Territory geographies deletable" ON "public"."territory_geographies";
CREATE POLICY "Territory geographies deletable" ON "public"."territory_geographies" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."territories" "t" ON (("t"."id" = "territory_geographies"."territory_id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND (("ur"."role" = 'platform_admin'::"public"."app_role") OR ("ur"."tenant_id" = "t"."tenant_id"))))));

DROP POLICY IF EXISTS "Territory geographies insertable" ON "public"."territory_geographies";
DROP POLICY IF EXISTS "Territory geographies insertable" ON "public"."territory_geographies";
CREATE POLICY "Territory geographies insertable" ON "public"."territory_geographies" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."territories" "t" ON (("t"."id" = "territory_geographies"."territory_id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND (("ur"."role" = 'platform_admin'::"public"."app_role") OR ("ur"."tenant_id" = "t"."tenant_id"))))));

DROP POLICY IF EXISTS "Territory geographies readable" ON "public"."territory_geographies";
DROP POLICY IF EXISTS "Territory geographies readable" ON "public"."territory_geographies";
CREATE POLICY "Territory geographies readable" ON "public"."territory_geographies" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."territories" "t" ON (("t"."id" = "territory_geographies"."territory_id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND (("ur"."role" = 'platform_admin'::"public"."app_role") OR ("ur"."tenant_id" = "t"."tenant_id"))))));

DROP POLICY IF EXISTS "Territory geographies updatable" ON "public"."territory_geographies";
DROP POLICY IF EXISTS "Territory geographies updatable" ON "public"."territory_geographies";
CREATE POLICY "Territory geographies updatable" ON "public"."territory_geographies" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."territories" "t" ON (("t"."id" = "territory_geographies"."territory_id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND (("ur"."role" = 'platform_admin'::"public"."app_role") OR ("ur"."tenant_id" = "t"."tenant_id")))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."territories" "t" ON (("t"."id" = "territory_geographies"."territory_id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND (("ur"."role" = 'platform_admin'::"public"."app_role") OR ("ur"."tenant_id" = "t"."tenant_id"))))));

DROP POLICY IF EXISTS "Users can create activities" ON "public"."activities";
DROP POLICY IF EXISTS "Users can create activities" ON "public"."activities";
CREATE POLICY "Users can create activities" ON "public"."activities" FOR INSERT WITH CHECK (("franchise_id" = "public"."get_user_franchise_id"("auth"."uid"())));

DROP POLICY IF EXISTS "Users can create calculations" ON "public"."rate_calculations";
DROP POLICY IF EXISTS "Users can create calculations" ON "public"."rate_calculations";
CREATE POLICY "Users can create calculations" ON "public"."rate_calculations" FOR INSERT WITH CHECK (("quote_id" IN ( SELECT "quotes"."id"
   FROM "public"."quotes"
  WHERE (("quotes"."franchise_id" = "public"."get_user_franchise_id"("auth"."uid"())) OR ("quotes"."owner_id" = "auth"."uid"())))));

DROP POLICY IF EXISTS "Users can create cargo details" ON "public"."cargo_details";
DROP POLICY IF EXISTS "Users can create cargo details" ON "public"."cargo_details";
CREATE POLICY "Users can create cargo details" ON "public"."cargo_details" FOR INSERT WITH CHECK (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())));

DROP POLICY IF EXISTS "Users can create compliance checks" ON "public"."compliance_checks";
DROP POLICY IF EXISTS "Users can create compliance checks" ON "public"."compliance_checks";
CREATE POLICY "Users can create compliance checks" ON "public"."compliance_checks" FOR INSERT WITH CHECK (("quote_id" IN ( SELECT "quotes"."id"
   FROM "public"."quotes"
  WHERE (("quotes"."franchise_id" = "public"."get_user_franchise_id"("auth"."uid"())) OR ("quotes"."owner_id" = "auth"."uid"())))));

DROP POLICY IF EXISTS "Users can create customer selections" ON "public"."customer_selections";
DROP POLICY IF EXISTS "Users can create customer selections" ON "public"."customer_selections";
CREATE POLICY "Users can create customer selections" ON "public"."customer_selections" FOR INSERT WITH CHECK (("quote_id" IN ( SELECT "quotes"."id"
   FROM "public"."quotes"
  WHERE ("quotes"."franchise_id" = "public"."get_user_franchise_id"("auth"."uid"())))));

DROP POLICY IF EXISTS "Users can create franchise accounts" ON "public"."accounts";
DROP POLICY IF EXISTS "Users can create franchise accounts" ON "public"."accounts";
CREATE POLICY "Users can create franchise accounts" ON "public"."accounts" FOR INSERT WITH CHECK (("franchise_id" = "public"."get_user_franchise_id"("auth"."uid"())));

DROP POLICY IF EXISTS "Users can create franchise contacts" ON "public"."contacts";
DROP POLICY IF EXISTS "Users can create franchise contacts" ON "public"."contacts";
CREATE POLICY "Users can create franchise contacts" ON "public"."contacts" FOR INSERT WITH CHECK (("franchise_id" = "public"."get_user_franchise_id"("auth"."uid"())));

DROP POLICY IF EXISTS "Users can create franchise leads" ON "public"."leads";
DROP POLICY IF EXISTS "Users can create franchise leads" ON "public"."leads";
CREATE POLICY "Users can create franchise leads" ON "public"."leads" FOR INSERT WITH CHECK (("franchise_id" = "public"."get_user_franchise_id"("auth"."uid"())));

DROP POLICY IF EXISTS "Users can create franchise opportunities" ON "public"."opportunities";
DROP POLICY IF EXISTS "Users can create franchise opportunities" ON "public"."opportunities";
CREATE POLICY "Users can create franchise opportunities" ON "public"."opportunities" FOR INSERT WITH CHECK (("franchise_id" = "public"."get_user_franchise_id"("auth"."uid"())));

DROP POLICY IF EXISTS "Users can create franchise quote legs" ON "public"."quote_legs";
DROP POLICY IF EXISTS "Users can create franchise quote legs" ON "public"."quote_legs";
CREATE POLICY "Users can create franchise quote legs" ON "public"."quote_legs" FOR INSERT WITH CHECK (("quote_option_id" IN ( SELECT "qvo"."id"
   FROM (("public"."quotation_version_options" "qvo"
     JOIN "public"."quotation_versions" "qv" ON (("qvo"."quotation_version_id" = "qv"."id")))
     JOIN "public"."quotes" "q" ON (("qv"."quote_id" = "q"."id")))
  WHERE ("q"."franchise_id" = "public"."get_user_franchise_id"("auth"."uid"())))));

DROP POLICY IF EXISTS "Users can create franchise quotes" ON "public"."quotes";
DROP POLICY IF EXISTS "Users can create franchise quotes" ON "public"."quotes";
CREATE POLICY "Users can create franchise quotes" ON "public"."quotes" FOR INSERT TO "authenticated" WITH CHECK (("franchise_id" = "public"."get_user_franchise_id"("auth"."uid"())));

DROP POLICY IF EXISTS "Users can create franchise shipments" ON "public"."shipments";
DROP POLICY IF EXISTS "Users can create franchise shipments" ON "public"."shipments";
CREATE POLICY "Users can create franchise shipments" ON "public"."shipments" FOR INSERT WITH CHECK (("franchise_id" = "public"."get_user_franchise_id"("auth"."uid"())));

DROP POLICY IF EXISTS "Users can create quotation packages" ON "public"."quotation_packages";
DROP POLICY IF EXISTS "Users can create quotation packages" ON "public"."quotation_packages";
CREATE POLICY "Users can create quotation packages" ON "public"."quotation_packages" FOR INSERT TO "authenticated" WITH CHECK (("quote_id" IN ( SELECT "quotes"."id"
   FROM "public"."quotes"
  WHERE ("quotes"."franchise_id" = "public"."get_user_franchise_id"("auth"."uid"())))));

DROP POLICY IF EXISTS "Users can create quote versions" ON "public"."quotation_versions";
DROP POLICY IF EXISTS "Users can create quote versions" ON "public"."quotation_versions";
CREATE POLICY "Users can create quote versions" ON "public"."quotation_versions" FOR INSERT WITH CHECK (("quote_id" IN ( SELECT "quotes"."id"
   FROM "public"."quotes"
  WHERE ("quotes"."franchise_id" = "public"."get_user_franchise_id"("auth"."uid"())))));

DROP POLICY IF EXISTS "Users can create templates" ON "public"."email_templates";
DROP POLICY IF EXISTS "Users can create templates" ON "public"."email_templates";
CREATE POLICY "Users can create templates" ON "public"."email_templates" FOR INSERT WITH CHECK ((("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())) AND ("created_by" = "auth"."uid"())));

DROP POLICY IF EXISTS "Users can create templates for their tenant" ON "public"."quote_templates";
DROP POLICY IF EXISTS "Users can create templates for their tenant" ON "public"."quote_templates";
CREATE POLICY "Users can create templates for their tenant" ON "public"."quote_templates" FOR INSERT WITH CHECK (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())));

DROP POLICY IF EXISTS "Users can create tracking events for accessible shipments" ON "public"."tracking_events";
DROP POLICY IF EXISTS "Users can create tracking events for accessible shipments" ON "public"."tracking_events";
CREATE POLICY "Users can create tracking events for accessible shipments" ON "public"."tracking_events" FOR INSERT WITH CHECK (("shipment_id" IN ( SELECT "shipments"."id"
   FROM "public"."shipments"
  WHERE (("shipments"."franchise_id" = "public"."get_user_franchise_id"("auth"."uid"())) OR ("shipments"."assigned_to" = "auth"."uid"())))));

DROP POLICY IF EXISTS "Users can create version options" ON "public"."quotation_version_options";
DROP POLICY IF EXISTS "Users can create version options" ON "public"."quotation_version_options";
CREATE POLICY "Users can create version options" ON "public"."quotation_version_options" FOR INSERT WITH CHECK (("quotation_version_id" IN ( SELECT "qv"."id"
   FROM ("public"."quotation_versions" "qv"
     JOIN "public"."quotes" "q" ON (("qv"."quote_id" = "q"."id")))
  WHERE ("q"."franchise_id" = "public"."get_user_franchise_id"("auth"."uid"())))));

DROP POLICY IF EXISTS "Users can delete own dashboard preferences" ON "public"."dashboard_preferences";
DROP POLICY IF EXISTS "Users can delete own dashboard preferences" ON "public"."dashboard_preferences";
CREATE POLICY "Users can delete own dashboard preferences" ON "public"."dashboard_preferences" FOR DELETE TO "authenticated" USING (("user_id" = "auth"."uid"()));

DROP POLICY IF EXISTS "Users can delete own templates" ON "public"."email_templates";
DROP POLICY IF EXISTS "Users can delete own templates" ON "public"."email_templates";
CREATE POLICY "Users can delete own templates" ON "public"."email_templates" FOR DELETE USING (("created_by" = "auth"."uid"()));

DROP POLICY IF EXISTS "Users can delete templates from their tenant" ON "public"."quote_templates";
DROP POLICY IF EXISTS "Users can delete templates from their tenant" ON "public"."quote_templates";
CREATE POLICY "Users can delete templates from their tenant" ON "public"."quote_templates" FOR DELETE USING (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())));

DROP POLICY IF EXISTS "Users can delete their own preferences" ON "public"."user_preferences";
DROP POLICY IF EXISTS "Users can delete their own preferences" ON "public"."user_preferences";
CREATE POLICY "Users can delete their own preferences" ON "public"."user_preferences" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));

DROP POLICY IF EXISTS "Users can insert activities" ON "public"."lead_activities";
DROP POLICY IF EXISTS "Users can insert activities" ON "public"."lead_activities";
CREATE POLICY "Users can insert activities" ON "public"."lead_activities" FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Users can insert import details" ON "public"."import_history_details";
DROP POLICY IF EXISTS "Users can insert import details" ON "public"."import_history_details";
CREATE POLICY "Users can insert import details" ON "public"."import_history_details" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));

DROP POLICY IF EXISTS "Users can insert import history" ON "public"."import_history";
DROP POLICY IF EXISTS "Users can insert import history" ON "public"."import_history";
CREATE POLICY "Users can insert import history" ON "public"."import_history" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));

DROP POLICY IF EXISTS "Users can insert logs" ON "public"."audit_logs";
DROP POLICY IF EXISTS "Users can insert logs" ON "public"."audit_logs";
CREATE POLICY "Users can insert logs" ON "public"."audit_logs" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));

DROP POLICY IF EXISTS "Users can insert own dashboard preferences" ON "public"."dashboard_preferences";
DROP POLICY IF EXISTS "Users can insert own dashboard preferences" ON "public"."dashboard_preferences";
CREATE POLICY "Users can insert own dashboard preferences" ON "public"."dashboard_preferences" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));

DROP POLICY IF EXISTS "Users can insert own preferences" ON "public"."user_preferences";
DROP POLICY IF EXISTS "Users can insert own preferences" ON "public"."user_preferences";
CREATE POLICY "Users can insert own preferences" ON "public"."user_preferences" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));

DROP POLICY IF EXISTS "Users can insert their own preferences" ON "public"."user_preferences";
DROP POLICY IF EXISTS "Users can insert their own preferences" ON "public"."user_preferences";
CREATE POLICY "Users can insert their own preferences" ON "public"."user_preferences" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));

DROP POLICY IF EXISTS "Users can manage customs documents for accessible shipments" ON "public"."customs_documents";
DROP POLICY IF EXISTS "Users can manage customs documents for accessible shipments" ON "public"."customs_documents";
CREATE POLICY "Users can manage customs documents for accessible shipments" ON "public"."customs_documents" USING (("shipment_id" IN ( SELECT "shipments"."id"
   FROM "public"."shipments"
  WHERE (("shipments"."franchise_id" = "public"."get_user_franchise_id"("auth"."uid"())) OR ("shipments"."assigned_to" = "auth"."uid"())))));

DROP POLICY IF EXISTS "Users can manage items for accessible quotes" ON "public"."quote_items";
DROP POLICY IF EXISTS "Users can manage items for accessible quotes" ON "public"."quote_items";
CREATE POLICY "Users can manage items for accessible quotes" ON "public"."quote_items" TO "authenticated" USING (("quote_id" IN ( SELECT "quotes"."id"
   FROM "public"."quotes"
  WHERE (("quotes"."franchise_id" = "public"."get_user_franchise_id"("auth"."uid"())) OR ("quotes"."owner_id" = "auth"."uid"())))));

DROP POLICY IF EXISTS "Users can manage items for accessible shipments" ON "public"."shipment_items";
DROP POLICY IF EXISTS "Users can manage items for accessible shipments" ON "public"."shipment_items";
CREATE POLICY "Users can manage items for accessible shipments" ON "public"."shipment_items" USING (("shipment_id" IN ( SELECT "shipments"."id"
   FROM "public"."shipments"
  WHERE (("shipments"."franchise_id" = "public"."get_user_franchise_id"("auth"."uid"())) OR ("shipments"."assigned_to" = "auth"."uid"())))));

DROP POLICY IF EXISTS "Users can manage options for accessible versions" ON "public"."quotation_version_options";
DROP POLICY IF EXISTS "Users can manage options for accessible versions" ON "public"."quotation_version_options";
CREATE POLICY "Users can manage options for accessible versions" ON "public"."quotation_version_options" USING (("quotation_version_id" IN ( SELECT "qv"."id"
   FROM ("public"."quotation_versions" "qv"
     JOIN "public"."quotes" "q" ON (("qv"."quote_id" = "q"."id")))
  WHERE (("q"."franchise_id" = "public"."get_user_franchise_id"("auth"."uid"())) OR ("q"."owner_id" = "auth"."uid"())))));

DROP POLICY IF EXISTS "Users can manage own OAuth configs" ON "public"."oauth_configurations";
DROP POLICY IF EXISTS "Users can manage own OAuth configs" ON "public"."oauth_configurations";
CREATE POLICY "Users can manage own OAuth configs" ON "public"."oauth_configurations" USING (("user_id" = "auth"."uid"()));

DROP POLICY IF EXISTS "Users can manage own email filters" ON "public"."email_filters";
DROP POLICY IF EXISTS "Users can manage own email filters" ON "public"."email_filters";
CREATE POLICY "Users can manage own email filters" ON "public"."email_filters" USING (("user_id" = "auth"."uid"()));

DROP POLICY IF EXISTS "Users can manage own presets" ON "public"."history_filter_presets";
DROP POLICY IF EXISTS "Users can manage own presets" ON "public"."history_filter_presets";
CREATE POLICY "Users can manage own presets" ON "public"."history_filter_presets" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));

DROP POLICY IF EXISTS "Users can manage their quote tokens" ON "public"."portal_tokens";
DROP POLICY IF EXISTS "Users can manage their quote tokens" ON "public"."portal_tokens";
CREATE POLICY "Users can manage their quote tokens" ON "public"."portal_tokens" USING ((("quote_id" IN ( SELECT "quotes"."id"
   FROM "public"."quotes"
  WHERE ("quotes"."tenant_id" IN ( SELECT "user_roles"."tenant_id"
           FROM "public"."user_roles"
          WHERE ("user_roles"."user_id" = "auth"."uid"()))))) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'platform_admin'::"public"."app_role"))))));

DROP POLICY IF EXISTS "Users can manage their shipment attachments" ON "public"."shipment_attachments";
DROP POLICY IF EXISTS "Users can manage their shipment attachments" ON "public"."shipment_attachments";
CREATE POLICY "Users can manage their shipment attachments" ON "public"."shipment_attachments" USING ((("shipment_id" IN ( SELECT "shipments"."id"
   FROM "public"."shipments"
  WHERE ("shipments"."tenant_id" IN ( SELECT "user_roles"."tenant_id"
           FROM "public"."user_roles"
          WHERE ("user_roles"."user_id" = "auth"."uid"()))))) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'platform_admin'::"public"."app_role"))))));

DROP POLICY IF EXISTS "Users can manage their tenant lead activities" ON "public"."lead_activities";
DROP POLICY IF EXISTS "Users can manage their tenant lead activities" ON "public"."lead_activities";
CREATE POLICY "Users can manage their tenant lead activities" ON "public"."lead_activities" USING ((("lead_id" IN ( SELECT "leads"."id"
   FROM "public"."leads"
  WHERE ("leads"."tenant_id" IN ( SELECT "user_roles"."tenant_id"
           FROM "public"."user_roles"
          WHERE ("user_roles"."user_id" = "auth"."uid"()))))) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'platform_admin'::"public"."app_role"))))));

DROP POLICY IF EXISTS "Users can manage their tenant templates" ON "public"."quote_templates";
DROP POLICY IF EXISTS "Users can manage their tenant templates" ON "public"."quote_templates";
CREATE POLICY "Users can manage their tenant templates" ON "public"."quote_templates" USING ((("tenant_id" IN ( SELECT "user_roles"."tenant_id"
   FROM "public"."user_roles"
  WHERE ("user_roles"."user_id" = "auth"."uid"()))) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'platform_admin'::"public"."app_role"))))));

DROP POLICY IF EXISTS "Users can manage versions for accessible quotes" ON "public"."quotation_versions";
DROP POLICY IF EXISTS "Users can manage versions for accessible quotes" ON "public"."quotation_versions";
CREATE POLICY "Users can manage versions for accessible quotes" ON "public"."quotation_versions" USING (("quote_id" IN ( SELECT "quotes"."id"
   FROM "public"."quotes"
  WHERE (("quotes"."franchise_id" = "public"."get_user_franchise_id"("auth"."uid"())) OR ("quotes"."owner_id" = "auth"."uid"())))));

DROP POLICY IF EXISTS "Users can update assigned opportunities" ON "public"."opportunities";
DROP POLICY IF EXISTS "Users can update assigned opportunities" ON "public"."opportunities";
CREATE POLICY "Users can update assigned opportunities" ON "public"."opportunities" FOR UPDATE USING (("owner_id" = "auth"."uid"()));

DROP POLICY IF EXISTS "Users can update import history" ON "public"."import_history";
DROP POLICY IF EXISTS "Users can update import history" ON "public"."import_history";
CREATE POLICY "Users can update import history" ON "public"."import_history" FOR UPDATE USING (("auth"."role"() = 'authenticated'::"text"));

DROP POLICY IF EXISTS "Users can update own activities" ON "public"."activities";
DROP POLICY IF EXISTS "Users can update own activities" ON "public"."activities";
CREATE POLICY "Users can update own activities" ON "public"."activities" FOR UPDATE USING (("assigned_to" = "auth"."uid"()));

DROP POLICY IF EXISTS "Users can update own dashboard preferences" ON "public"."dashboard_preferences";
DROP POLICY IF EXISTS "Users can update own dashboard preferences" ON "public"."dashboard_preferences";
CREATE POLICY "Users can update own dashboard preferences" ON "public"."dashboard_preferences" FOR UPDATE USING (("auth"."uid"() = "user_id"));

DROP POLICY IF EXISTS "Users can update own preferences" ON "public"."user_preferences";
DROP POLICY IF EXISTS "Users can update own preferences" ON "public"."user_preferences";
CREATE POLICY "Users can update own preferences" ON "public"."user_preferences" FOR UPDATE USING (("auth"."uid"() = "user_id"));

DROP POLICY IF EXISTS "Users can update own profile" ON "public"."profiles";
DROP POLICY IF EXISTS "Users can update own profile" ON "public"."profiles";
CREATE POLICY "Users can update own profile" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "id"));

DROP POLICY IF EXISTS "Users can update own templates" ON "public"."email_templates";
DROP POLICY IF EXISTS "Users can update own templates" ON "public"."email_templates";
CREATE POLICY "Users can update own templates" ON "public"."email_templates" FOR UPDATE USING (("created_by" = "auth"."uid"()));

DROP POLICY IF EXISTS "Users can update quotation packages" ON "public"."quotation_packages";
DROP POLICY IF EXISTS "Users can update quotation packages" ON "public"."quotation_packages";
CREATE POLICY "Users can update quotation packages" ON "public"."quotation_packages" FOR UPDATE TO "authenticated" USING (("quote_id" IN ( SELECT "quotes"."id"
   FROM "public"."quotes"
  WHERE ("quotes"."franchise_id" = "public"."get_user_franchise_id"("auth"."uid"())))));

DROP POLICY IF EXISTS "Users can update templates from their tenant" ON "public"."quote_templates";
DROP POLICY IF EXISTS "Users can update templates from their tenant" ON "public"."quote_templates";
CREATE POLICY "Users can update templates from their tenant" ON "public"."quote_templates" FOR UPDATE USING (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())));

DROP POLICY IF EXISTS "Users can update their own preferences" ON "public"."user_preferences";
DROP POLICY IF EXISTS "Users can update their own preferences" ON "public"."user_preferences";
CREATE POLICY "Users can update their own preferences" ON "public"."user_preferences" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));

DROP POLICY IF EXISTS "Users can view activities for their leads" ON "public"."lead_activities";
DROP POLICY IF EXISTS "Users can view activities for their leads" ON "public"."lead_activities";
CREATE POLICY "Users can view activities for their leads" ON "public"."lead_activities" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."leads"
  WHERE ("leads"."id" = "lead_activities"."lead_id"))));

DROP POLICY IF EXISTS "Users can view assigned activities" ON "public"."activities";
DROP POLICY IF EXISTS "Users can view assigned activities" ON "public"."activities";
CREATE POLICY "Users can view assigned activities" ON "public"."activities" FOR SELECT USING ((("assigned_to" = "auth"."uid"()) OR ("franchise_id" = "public"."get_user_franchise_id"("auth"."uid"()))));

DROP POLICY IF EXISTS "Users can view assigned shipments" ON "public"."shipments";
DROP POLICY IF EXISTS "Users can view assigned shipments" ON "public"."shipments";
CREATE POLICY "Users can view assigned shipments" ON "public"."shipments" FOR SELECT USING ((("assigned_to" = "auth"."uid"()) OR ("franchise_id" = "public"."get_user_franchise_id"("auth"."uid"()))));

DROP POLICY IF EXISTS "Users can view calculations for accessible quotes" ON "public"."rate_calculations";
DROP POLICY IF EXISTS "Users can view calculations for accessible quotes" ON "public"."rate_calculations";
CREATE POLICY "Users can view calculations for accessible quotes" ON "public"."rate_calculations" FOR SELECT USING (("quote_id" IN ( SELECT "quotes"."id"
   FROM "public"."quotes"
  WHERE (("quotes"."franchise_id" = "public"."get_user_franchise_id"("auth"."uid"())) OR ("quotes"."owner_id" = "auth"."uid"())))));

DROP POLICY IF EXISTS "Users can view charge bases" ON "public"."charge_bases";
DROP POLICY IF EXISTS "Users can view charge bases" ON "public"."charge_bases";
CREATE POLICY "Users can view charge bases" ON "public"."charge_bases" FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can view charge categories" ON "public"."charge_categories";
DROP POLICY IF EXISTS "Users can view charge categories" ON "public"."charge_categories";
CREATE POLICY "Users can view charge categories" ON "public"."charge_categories" FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can view charge sides" ON "public"."charge_sides";
DROP POLICY IF EXISTS "Users can view charge sides" ON "public"."charge_sides";
CREATE POLICY "Users can view charge sides" ON "public"."charge_sides" FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can view compliance checks for accessible quotes" ON "public"."compliance_checks";
DROP POLICY IF EXISTS "Users can view compliance checks for accessible quotes" ON "public"."compliance_checks";
CREATE POLICY "Users can view compliance checks for accessible quotes" ON "public"."compliance_checks" FOR SELECT USING (("quote_id" IN ( SELECT "quotes"."id"
   FROM "public"."quotes"
  WHERE (("quotes"."franchise_id" = "public"."get_user_franchise_id"("auth"."uid"())) OR ("quotes"."owner_id" = "auth"."uid"())))));

DROP POLICY IF EXISTS "Users can view currencies" ON "public"."currencies";
DROP POLICY IF EXISTS "Users can view currencies" ON "public"."currencies";
CREATE POLICY "Users can view currencies" ON "public"."currencies" FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can view custom role permissions" ON "public"."custom_role_permissions";
DROP POLICY IF EXISTS "Users can view custom role permissions" ON "public"."custom_role_permissions";
CREATE POLICY "Users can view custom role permissions" ON "public"."custom_role_permissions" FOR SELECT USING (("role_id" IN ( SELECT "custom_roles"."id"
   FROM "public"."custom_roles"
  WHERE ("custom_roles"."tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())))));

DROP POLICY IF EXISTS "Users can view franchise accounts" ON "public"."accounts";
DROP POLICY IF EXISTS "Users can view franchise accounts" ON "public"."accounts";
CREATE POLICY "Users can view franchise accounts" ON "public"."accounts" FOR SELECT USING (("franchise_id" = "public"."get_user_franchise_id"("auth"."uid"())));

DROP POLICY IF EXISTS "Users can view franchise audit logs" ON "public"."quotation_audit_log";
DROP POLICY IF EXISTS "Users can view franchise audit logs" ON "public"."quotation_audit_log";
CREATE POLICY "Users can view franchise audit logs" ON "public"."quotation_audit_log" FOR SELECT USING (("quote_id" IN ( SELECT "quotes"."id"
   FROM "public"."quotes"
  WHERE ("quotes"."franchise_id" = "public"."get_user_franchise_id"("auth"."uid"())))));

DROP POLICY IF EXISTS "Users can view franchise contacts" ON "public"."contacts";
DROP POLICY IF EXISTS "Users can view franchise contacts" ON "public"."contacts";
CREATE POLICY "Users can view franchise contacts" ON "public"."contacts" FOR SELECT USING (("franchise_id" = "public"."get_user_franchise_id"("auth"."uid"())));

DROP POLICY IF EXISTS "Users can view franchise customer selections" ON "public"."customer_selections";
DROP POLICY IF EXISTS "Users can view franchise customer selections" ON "public"."customer_selections";
CREATE POLICY "Users can view franchise customer selections" ON "public"."customer_selections" FOR SELECT USING (("quote_id" IN ( SELECT "quotes"."id"
   FROM "public"."quotes"
  WHERE ("quotes"."franchise_id" = "public"."get_user_franchise_id"("auth"."uid"())))));

DROP POLICY IF EXISTS "Users can view franchise leads" ON "public"."leads";
DROP POLICY IF EXISTS "Users can view franchise leads" ON "public"."leads";
CREATE POLICY "Users can view franchise leads" ON "public"."leads" FOR SELECT USING (("franchise_id" = "public"."get_user_franchise_id"("auth"."uid"())));

DROP POLICY IF EXISTS "Users can view franchise opportunities" ON "public"."opportunities";
DROP POLICY IF EXISTS "Users can view franchise opportunities" ON "public"."opportunities";
CREATE POLICY "Users can view franchise opportunities" ON "public"."opportunities" FOR SELECT USING (("franchise_id" = "public"."get_user_franchise_id"("auth"."uid"())));

DROP POLICY IF EXISTS "Users can view franchise quotation packages" ON "public"."quotation_packages";
DROP POLICY IF EXISTS "Users can view franchise quotation packages" ON "public"."quotation_packages";
CREATE POLICY "Users can view franchise quotation packages" ON "public"."quotation_packages" FOR SELECT TO "authenticated" USING (("quote_id" IN ( SELECT "quotes"."id"
   FROM "public"."quotes"
  WHERE ("quotes"."franchise_id" = "public"."get_user_franchise_id"("auth"."uid"())))));

DROP POLICY IF EXISTS "Users can view franchise quote config" ON "public"."quote_number_config_franchise";
DROP POLICY IF EXISTS "Users can view franchise quote config" ON "public"."quote_number_config_franchise";
CREATE POLICY "Users can view franchise quote config" ON "public"."quote_number_config_franchise" FOR SELECT USING (("franchise_id" = "public"."get_user_franchise_id"("auth"."uid"())));

DROP POLICY IF EXISTS "Users can view franchise quote legs" ON "public"."quote_legs";
DROP POLICY IF EXISTS "Users can view franchise quote legs" ON "public"."quote_legs";
CREATE POLICY "Users can view franchise quote legs" ON "public"."quote_legs" FOR SELECT USING (("quote_option_id" IN ( SELECT "qvo"."id"
   FROM (("public"."quotation_version_options" "qvo"
     JOIN "public"."quotation_versions" "qv" ON (("qvo"."quotation_version_id" = "qv"."id")))
     JOIN "public"."quotes" "q" ON (("qv"."quote_id" = "q"."id")))
  WHERE ("q"."franchise_id" = "public"."get_user_franchise_id"("auth"."uid"())))));

DROP POLICY IF EXISTS "Users can view franchise quote versions" ON "public"."quotation_versions";
DROP POLICY IF EXISTS "Users can view franchise quote versions" ON "public"."quotation_versions";
CREATE POLICY "Users can view franchise quote versions" ON "public"."quotation_versions" FOR SELECT USING (("quote_id" IN ( SELECT "quotes"."id"
   FROM "public"."quotes"
  WHERE ("quotes"."franchise_id" = "public"."get_user_franchise_id"("auth"."uid"())))));

DROP POLICY IF EXISTS "Users can view franchise quotes" ON "public"."quotes";
DROP POLICY IF EXISTS "Users can view franchise quotes" ON "public"."quotes";
CREATE POLICY "Users can view franchise quotes" ON "public"."quotes" FOR SELECT TO "authenticated" USING (("franchise_id" = "public"."get_user_franchise_id"("auth"."uid"())));

DROP POLICY IF EXISTS "Users can view franchise version options" ON "public"."quotation_version_options";
DROP POLICY IF EXISTS "Users can view franchise version options" ON "public"."quotation_version_options";
CREATE POLICY "Users can view franchise version options" ON "public"."quotation_version_options" FOR SELECT USING (("quotation_version_id" IN ( SELECT "qv"."id"
   FROM ("public"."quotation_versions" "qv"
     JOIN "public"."quotes" "q" ON (("qv"."quote_id" = "q"."id")))
  WHERE ("q"."franchise_id" = "public"."get_user_franchise_id"("auth"."uid"())))));

DROP POLICY IF EXISTS "Users can view franchise warehouse inventory" ON "public"."warehouse_inventory";
DROP POLICY IF EXISTS "Users can view franchise warehouse inventory" ON "public"."warehouse_inventory";
CREATE POLICY "Users can view franchise warehouse inventory" ON "public"."warehouse_inventory" FOR SELECT USING (("warehouse_id" IN ( SELECT "warehouses"."id"
   FROM "public"."warehouses"
  WHERE ("warehouses"."franchise_id" = "public"."get_user_franchise_id"("auth"."uid"())))));

DROP POLICY IF EXISTS "Users can view global carrier type mappings" ON "public"."carrier_service_types";
DROP POLICY IF EXISTS "Users can view global carrier type mappings" ON "public"."carrier_service_types";
CREATE POLICY "Users can view global carrier type mappings" ON "public"."carrier_service_types" FOR SELECT USING (("tenant_id" IS NULL));

DROP POLICY IF EXISTS "Users can view global carriers" ON "public"."carriers";
DROP POLICY IF EXISTS "Users can view global carriers" ON "public"."carriers";
CREATE POLICY "Users can view global carriers" ON "public"."carriers" FOR SELECT USING (("tenant_id" IS NULL));

DROP POLICY IF EXISTS "Users can view global ports" ON "public"."ports_locations";
DROP POLICY IF EXISTS "Users can view global ports" ON "public"."ports_locations";
CREATE POLICY "Users can view global ports" ON "public"."ports_locations" FOR SELECT USING (("tenant_id" IS NULL));

DROP POLICY IF EXISTS "Users can view history of opportunities they can view" ON "public"."opportunity_probability_history";
DROP POLICY IF EXISTS "Users can view history of opportunities they can view" ON "public"."opportunity_probability_history";
CREATE POLICY "Users can view history of opportunities they can view" ON "public"."opportunity_probability_history" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."opportunities" "o"
  WHERE ("o"."id" = "opportunity_probability_history"."opportunity_id"))));

DROP POLICY IF EXISTS "Users can view history within tenant" ON "public"."opportunity_probability_history";
DROP POLICY IF EXISTS "Users can view history within tenant" ON "public"."opportunity_probability_history";
CREATE POLICY "Users can view history within tenant" ON "public"."opportunity_probability_history" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."opportunities" "o"
  WHERE (("o"."id" = "opportunity_probability_history"."opportunity_id") AND ("o"."tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))))));

DROP POLICY IF EXISTS "Users can view import details" ON "public"."import_history_details";
DROP POLICY IF EXISTS "Users can view import details" ON "public"."import_history_details";
CREATE POLICY "Users can view import details" ON "public"."import_history_details" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));

DROP POLICY IF EXISTS "Users can view import history" ON "public"."import_history";
DROP POLICY IF EXISTS "Users can view import history" ON "public"."import_history";
CREATE POLICY "Users can view import history" ON "public"."import_history" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));

DROP POLICY IF EXISTS "Users can view own audit logs" ON "public"."email_audit_log";
DROP POLICY IF EXISTS "Users can view own audit logs" ON "public"."email_audit_log";
CREATE POLICY "Users can view own audit logs" ON "public"."email_audit_log" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));

DROP POLICY IF EXISTS "Users can view own capacity" ON "public"."user_capacity";
DROP POLICY IF EXISTS "Users can view own capacity" ON "public"."user_capacity";
CREATE POLICY "Users can view own capacity" ON "public"."user_capacity" FOR SELECT USING (("user_id" = "auth"."uid"()));

DROP POLICY IF EXISTS "Users can view own custom roles" ON "public"."user_custom_roles";
DROP POLICY IF EXISTS "Users can view own custom roles" ON "public"."user_custom_roles";
CREATE POLICY "Users can view own custom roles" ON "public"."user_custom_roles" FOR SELECT USING (("user_id" = "auth"."uid"()));

DROP POLICY IF EXISTS "Users can view own dashboard preferences" ON "public"."dashboard_preferences";
DROP POLICY IF EXISTS "Users can view own dashboard preferences" ON "public"."dashboard_preferences";
CREATE POLICY "Users can view own dashboard preferences" ON "public"."dashboard_preferences" FOR SELECT USING (("auth"."uid"() = "user_id"));

DROP POLICY IF EXISTS "Users can view own franchise" ON "public"."franchises";
DROP POLICY IF EXISTS "Users can view own franchise" ON "public"."franchises";
CREATE POLICY "Users can view own franchise" ON "public"."franchises" FOR SELECT USING (("id" = "public"."get_user_franchise_id"("auth"."uid"())));

DROP POLICY IF EXISTS "Users can view own preferences" ON "public"."user_preferences";
DROP POLICY IF EXISTS "Users can view own preferences" ON "public"."user_preferences";
CREATE POLICY "Users can view own preferences" ON "public"."user_preferences" FOR SELECT USING (("auth"."uid"() = "user_id"));

DROP POLICY IF EXISTS "Users can view own profile" ON "public"."profiles";
DROP POLICY IF EXISTS "Users can view own profile" ON "public"."profiles";
CREATE POLICY "Users can view own profile" ON "public"."profiles" FOR SELECT USING (("auth"."uid"() = "id"));

DROP POLICY IF EXISTS "Users can view own roles" ON "public"."user_roles";
DROP POLICY IF EXISTS "Users can view own roles" ON "public"."user_roles";
CREATE POLICY "Users can view own roles" ON "public"."user_roles" FOR SELECT USING (("user_id" = "auth"."uid"()));

DROP POLICY IF EXISTS "Users can view queue members in their tenant" ON "public"."queue_members";
DROP POLICY IF EXISTS "Users can view queue members in their tenant" ON "public"."queue_members";
CREATE POLICY "Users can view queue members in their tenant" ON "public"."queue_members" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."queues" "q"
  WHERE (("q"."id" = "queue_members"."queue_id") AND ("q"."tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))))));

DROP POLICY IF EXISTS "Users can view queues in their tenant" ON "public"."queues";
DROP POLICY IF EXISTS "Users can view queues in their tenant" ON "public"."queues";
CREATE POLICY "Users can view queues in their tenant" ON "public"."queues" FOR SELECT USING (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())));

DROP POLICY IF EXISTS "Users can view quotation versions" ON "public"."quotation_versions";
DROP POLICY IF EXISTS "Users can view quotation versions" ON "public"."quotation_versions";
CREATE POLICY "Users can view quotation versions" ON "public"."quotation_versions" FOR SELECT USING (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())));

DROP POLICY IF EXISTS "Users can view score logs for their leads" ON "public"."lead_score_logs";
DROP POLICY IF EXISTS "Users can view score logs for their leads" ON "public"."lead_score_logs";
CREATE POLICY "Users can view score logs for their leads" ON "public"."lead_score_logs" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."leads"
  WHERE ("leads"."id" = "lead_score_logs"."lead_id"))));

DROP POLICY IF EXISTS "Users can view selection events" ON "public"."quotation_selection_events";
DROP POLICY IF EXISTS "Users can view selection events" ON "public"."quotation_selection_events";
CREATE POLICY "Users can view selection events" ON "public"."quotation_selection_events" FOR SELECT USING (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())));

DROP POLICY IF EXISTS "Users can view team dashboard preferences" ON "public"."dashboard_preferences";
DROP POLICY IF EXISTS "Users can view team dashboard preferences" ON "public"."dashboard_preferences";
CREATE POLICY "Users can view team dashboard preferences" ON "public"."dashboard_preferences" FOR SELECT USING (("tenant_id" IN ( SELECT "user_roles"."tenant_id"
   FROM "public"."user_roles"
  WHERE ("user_roles"."user_id" = "auth"."uid"()))));

DROP POLICY IF EXISTS "Users can view templates from their tenant" ON "public"."quote_templates";
DROP POLICY IF EXISTS "Users can view templates from their tenant" ON "public"."quote_templates";
CREATE POLICY "Users can view templates from their tenant" ON "public"."quote_templates" FOR SELECT USING (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())));

DROP POLICY IF EXISTS "Users can view tenant attachments" ON "public"."carrier_rate_attachments";
DROP POLICY IF EXISTS "Users can view tenant attachments" ON "public"."carrier_rate_attachments";
CREATE POLICY "Users can view tenant attachments" ON "public"."carrier_rate_attachments" FOR SELECT USING (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())));

DROP POLICY IF EXISTS "Users can view tenant cargo details" ON "public"."cargo_details";
DROP POLICY IF EXISTS "Users can view tenant cargo details" ON "public"."cargo_details";
CREATE POLICY "Users can view tenant cargo details" ON "public"."cargo_details" FOR SELECT USING (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())));

DROP POLICY IF EXISTS "Users can view tenant cargo types" ON "public"."cargo_types";
DROP POLICY IF EXISTS "Users can view tenant cargo types" ON "public"."cargo_types";
CREATE POLICY "Users can view tenant cargo types" ON "public"."cargo_types" FOR SELECT TO "authenticated" USING (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())));

DROP POLICY IF EXISTS "Users can view tenant carrier rate charges" ON "public"."carrier_rate_charges";
DROP POLICY IF EXISTS "Users can view tenant carrier rate charges" ON "public"."carrier_rate_charges";
CREATE POLICY "Users can view tenant carrier rate charges" ON "public"."carrier_rate_charges" FOR SELECT USING (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())));

DROP POLICY IF EXISTS "Users can view tenant carrier rates" ON "public"."carrier_rates";
DROP POLICY IF EXISTS "Users can view tenant carrier rates" ON "public"."carrier_rates";
CREATE POLICY "Users can view tenant carrier rates" ON "public"."carrier_rates" FOR SELECT USING (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())));

DROP POLICY IF EXISTS "Users can view tenant carrier type mappings" ON "public"."carrier_service_types";
DROP POLICY IF EXISTS "Users can view tenant carrier type mappings" ON "public"."carrier_service_types";
CREATE POLICY "Users can view tenant carrier type mappings" ON "public"."carrier_service_types" FOR SELECT TO "authenticated" USING (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())));

DROP POLICY IF EXISTS "Users can view tenant carriers" ON "public"."carriers";
DROP POLICY IF EXISTS "Users can view tenant carriers" ON "public"."carriers";
CREATE POLICY "Users can view tenant carriers" ON "public"."carriers" FOR SELECT USING (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())));

DROP POLICY IF EXISTS "Users can view tenant charges" ON "public"."carrier_rate_charges";
DROP POLICY IF EXISTS "Users can view tenant charges" ON "public"."carrier_rate_charges";
CREATE POLICY "Users can view tenant charges" ON "public"."carrier_rate_charges" FOR SELECT USING (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())));

DROP POLICY IF EXISTS "Users can view tenant consignees" ON "public"."consignees";
DROP POLICY IF EXISTS "Users can view tenant consignees" ON "public"."consignees";
CREATE POLICY "Users can view tenant consignees" ON "public"."consignees" FOR SELECT USING (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())));

DROP POLICY IF EXISTS "Users can view tenant custom roles" ON "public"."custom_roles";
DROP POLICY IF EXISTS "Users can view tenant custom roles" ON "public"."custom_roles";
CREATE POLICY "Users can view tenant custom roles" ON "public"."custom_roles" FOR SELECT USING (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())));

DROP POLICY IF EXISTS "Users can view tenant incoterms" ON "public"."incoterms";
DROP POLICY IF EXISTS "Users can view tenant incoterms" ON "public"."incoterms";
CREATE POLICY "Users can view tenant incoterms" ON "public"."incoterms" FOR SELECT TO "authenticated" USING (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())));

DROP POLICY IF EXISTS "Users can view tenant mappings" ON "public"."service_type_mappings";
DROP POLICY IF EXISTS "Users can view tenant mappings" ON "public"."service_type_mappings";
CREATE POLICY "Users can view tenant mappings" ON "public"."service_type_mappings" FOR SELECT USING (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())));

DROP POLICY IF EXISTS "Users can view tenant package categories" ON "public"."package_categories";
DROP POLICY IF EXISTS "Users can view tenant package categories" ON "public"."package_categories";
CREATE POLICY "Users can view tenant package categories" ON "public"."package_categories" FOR SELECT TO "authenticated" USING (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())));

DROP POLICY IF EXISTS "Users can view tenant package sizes" ON "public"."package_sizes";
DROP POLICY IF EXISTS "Users can view tenant package sizes" ON "public"."package_sizes";
CREATE POLICY "Users can view tenant package sizes" ON "public"."package_sizes" FOR SELECT TO "authenticated" USING (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())));

DROP POLICY IF EXISTS "Users can view tenant ports" ON "public"."ports_locations";
DROP POLICY IF EXISTS "Users can view tenant ports" ON "public"."ports_locations";
CREATE POLICY "Users can view tenant ports" ON "public"."ports_locations" FOR SELECT USING (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())));

DROP POLICY IF EXISTS "Users can view tenant quote config" ON "public"."quote_number_config_tenant";
DROP POLICY IF EXISTS "Users can view tenant quote config" ON "public"."quote_number_config_tenant";
CREATE POLICY "Users can view tenant quote config" ON "public"."quote_number_config_tenant" FOR SELECT USING (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())));

DROP POLICY IF EXISTS "Users can view tenant routes" ON "public"."routes";
DROP POLICY IF EXISTS "Users can view tenant routes" ON "public"."routes";
CREATE POLICY "Users can view tenant routes" ON "public"."routes" FOR SELECT USING (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())));

DROP POLICY IF EXISTS "Users can view tenant service type mappings" ON "public"."service_type_mappings";
DROP POLICY IF EXISTS "Users can view tenant service type mappings" ON "public"."service_type_mappings";
CREATE POLICY "Users can view tenant service type mappings" ON "public"."service_type_mappings" FOR SELECT TO "authenticated" USING (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())));

DROP POLICY IF EXISTS "Users can view tenant shipping rates" ON "public"."shipping_rates";
DROP POLICY IF EXISTS "Users can view tenant shipping rates" ON "public"."shipping_rates";
CREATE POLICY "Users can view tenant shipping rates" ON "public"."shipping_rates" FOR SELECT USING (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())));

DROP POLICY IF EXISTS "Users can view tenant templates" ON "public"."email_templates";
DROP POLICY IF EXISTS "Users can view tenant templates" ON "public"."email_templates";
CREATE POLICY "Users can view tenant templates" ON "public"."email_templates" FOR SELECT USING ((("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())) AND (("is_shared" = true) OR ("created_by" = "auth"."uid"()))));

DROP POLICY IF EXISTS "Users can view tenant tier configs" ON "public"."charge_tier_config";
DROP POLICY IF EXISTS "Users can view tenant tier configs" ON "public"."charge_tier_config";
CREATE POLICY "Users can view tenant tier configs" ON "public"."charge_tier_config" FOR SELECT USING (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())));

DROP POLICY IF EXISTS "Users can view tenant tier ranges" ON "public"."charge_tier_ranges";
DROP POLICY IF EXISTS "Users can view tenant tier ranges" ON "public"."charge_tier_ranges";
CREATE POLICY "Users can view tenant tier ranges" ON "public"."charge_tier_ranges" FOR SELECT USING (("tier_config_id" IN ( SELECT "charge_tier_config"."id"
   FROM "public"."charge_tier_config"
  WHERE ("charge_tier_config"."tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())))));

DROP POLICY IF EXISTS "Users can view tenant weight breaks" ON "public"."charge_weight_breaks";
DROP POLICY IF EXISTS "Users can view tenant weight breaks" ON "public"."charge_weight_breaks";
CREATE POLICY "Users can view tenant weight breaks" ON "public"."charge_weight_breaks" FOR SELECT USING (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())));

DROP POLICY IF EXISTS "Users can view territory geographies" ON "public"."territory_geographies";
DROP POLICY IF EXISTS "Users can view territory geographies" ON "public"."territory_geographies";
CREATE POLICY "Users can view territory geographies" ON "public"."territory_geographies" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."territories" "t"
  WHERE (("t"."id" = "territory_geographies"."territory_id") AND (("t"."tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())) OR "public"."is_platform_admin"("auth"."uid"()))))));

DROP POLICY IF EXISTS "Users can view their own preferences" ON "public"."user_preferences";
DROP POLICY IF EXISTS "Users can view their own preferences" ON "public"."user_preferences";
CREATE POLICY "Users can view their own preferences" ON "public"."user_preferences" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));

DROP POLICY IF EXISTS "Users can view their quote tokens" ON "public"."portal_tokens";
DROP POLICY IF EXISTS "Users can view their quote tokens" ON "public"."portal_tokens";
CREATE POLICY "Users can view their quote tokens" ON "public"."portal_tokens" FOR SELECT USING ((("quote_id" IN ( SELECT "quotes"."id"
   FROM "public"."quotes"
  WHERE ("quotes"."tenant_id" IN ( SELECT "user_roles"."tenant_id"
           FROM "public"."user_roles"
          WHERE ("user_roles"."user_id" = "auth"."uid"()))))) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'platform_admin'::"public"."app_role"))))));

DROP POLICY IF EXISTS "Users can view their shipment attachments" ON "public"."shipment_attachments";
DROP POLICY IF EXISTS "Users can view their shipment attachments" ON "public"."shipment_attachments";
CREATE POLICY "Users can view their shipment attachments" ON "public"."shipment_attachments" FOR SELECT USING ((("shipment_id" IN ( SELECT "shipments"."id"
   FROM "public"."shipments"
  WHERE ("shipments"."tenant_id" IN ( SELECT "user_roles"."tenant_id"
           FROM "public"."user_roles"
          WHERE ("user_roles"."user_id" = "auth"."uid"()))))) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'platform_admin'::"public"."app_role"))))));

DROP POLICY IF EXISTS "Users can view their tenant lead activities" ON "public"."lead_activities";
DROP POLICY IF EXISTS "Users can view their tenant lead activities" ON "public"."lead_activities";
CREATE POLICY "Users can view their tenant lead activities" ON "public"."lead_activities" FOR SELECT USING ((("lead_id" IN ( SELECT "leads"."id"
   FROM "public"."leads"
  WHERE ("leads"."tenant_id" IN ( SELECT "user_roles"."tenant_id"
           FROM "public"."user_roles"
          WHERE ("user_roles"."user_id" = "auth"."uid"()))))) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'platform_admin'::"public"."app_role"))))));

DROP POLICY IF EXISTS "Users can view their tenant score config" ON "public"."lead_score_config";
DROP POLICY IF EXISTS "Users can view their tenant score config" ON "public"."lead_score_config";
CREATE POLICY "Users can view their tenant score config" ON "public"."lead_score_config" FOR SELECT USING ((("tenant_id" IN ( SELECT "user_roles"."tenant_id"
   FROM "public"."user_roles"
  WHERE ("user_roles"."user_id" = "auth"."uid"()))) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'platform_admin'::"public"."app_role"))))));

DROP POLICY IF EXISTS "Users can view their tenant score logs" ON "public"."lead_score_logs";
DROP POLICY IF EXISTS "Users can view their tenant score logs" ON "public"."lead_score_logs";
CREATE POLICY "Users can view their tenant score logs" ON "public"."lead_score_logs" FOR SELECT USING ((("lead_id" IN ( SELECT "leads"."id"
   FROM "public"."leads"
  WHERE ("leads"."tenant_id" IN ( SELECT "user_roles"."tenant_id"
           FROM "public"."user_roles"
          WHERE ("user_roles"."user_id" = "auth"."uid"()))))) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'platform_admin'::"public"."app_role"))))));

DROP POLICY IF EXISTS "Users can view their tenant templates" ON "public"."quote_templates";
DROP POLICY IF EXISTS "Users can view their tenant templates" ON "public"."quote_templates";
CREATE POLICY "Users can view their tenant templates" ON "public"."quote_templates" FOR SELECT USING ((("tenant_id" IN ( SELECT "user_roles"."tenant_id"
   FROM "public"."user_roles"
  WHERE ("user_roles"."user_id" = "auth"."uid"()))) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'platform_admin'::"public"."app_role"))))));

DROP POLICY IF EXISTS "Users can view themes in their tenant" ON "public"."themes";
DROP POLICY IF EXISTS "Users can view themes in their tenant" ON "public"."themes";
CREATE POLICY "Users can view themes in their tenant" ON "public"."themes" FOR SELECT USING ((("tenant_id" IN ( SELECT "user_roles"."tenant_id"
   FROM "public"."user_roles"
  WHERE ("user_roles"."user_id" = "auth"."uid"()))) OR "public"."is_platform_admin"("auth"."uid"())));

DROP POLICY IF EXISTS "Users can view tracking for accessible shipments" ON "public"."tracking_events";
DROP POLICY IF EXISTS "Users can view tracking for accessible shipments" ON "public"."tracking_events";
CREATE POLICY "Users can view tracking for accessible shipments" ON "public"."tracking_events" FOR SELECT USING (("shipment_id" IN ( SELECT "shipments"."id"
   FROM "public"."shipments"
  WHERE (("shipments"."franchise_id" = "public"."get_user_franchise_id"("auth"."uid"())) OR ("shipments"."assigned_to" = "auth"."uid"())))));

DROP POLICY IF EXISTS "Users can view version options" ON "public"."quotation_version_options";
DROP POLICY IF EXISTS "Users can view version options" ON "public"."quotation_version_options";
CREATE POLICY "Users can view version options" ON "public"."quotation_version_options" FOR SELECT USING (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())));

DROP POLICY IF EXISTS "Users create franchise option legs" ON "public"."quotation_version_option_legs";
DROP POLICY IF EXISTS "Users create franchise option legs" ON "public"."quotation_version_option_legs";
CREATE POLICY "Users create franchise option legs" ON "public"."quotation_version_option_legs" FOR INSERT TO "authenticated" WITH CHECK (("franchise_id" = "public"."get_user_franchise_id"("auth"."uid"())));

DROP POLICY IF EXISTS "Users create franchise quotation options" ON "public"."quotation_version_options";
DROP POLICY IF EXISTS "Users create franchise quotation options" ON "public"."quotation_version_options";
CREATE POLICY "Users create franchise quotation options" ON "public"."quotation_version_options" FOR INSERT TO "authenticated" WITH CHECK (("franchise_id" = "public"."get_user_franchise_id"("auth"."uid"())));

DROP POLICY IF EXISTS "Users create franchise quotation versions" ON "public"."quotation_versions";
DROP POLICY IF EXISTS "Users create franchise quotation versions" ON "public"."quotation_versions";
CREATE POLICY "Users create franchise quotation versions" ON "public"."quotation_versions" FOR INSERT TO "authenticated" WITH CHECK (("franchise_id" = "public"."get_user_franchise_id"("auth"."uid"())));

DROP POLICY IF EXISTS "Users create franchise quote charges" ON "public"."quote_charges";
DROP POLICY IF EXISTS "Users create franchise quote charges" ON "public"."quote_charges";
CREATE POLICY "Users create franchise quote charges" ON "public"."quote_charges" FOR INSERT TO "authenticated" WITH CHECK (("franchise_id" = "public"."get_user_franchise_id"("auth"."uid"())));

DROP POLICY IF EXISTS "Users view franchise option legs" ON "public"."quotation_version_option_legs";
DROP POLICY IF EXISTS "Users view franchise option legs" ON "public"."quotation_version_option_legs";
CREATE POLICY "Users view franchise option legs" ON "public"."quotation_version_option_legs" FOR SELECT TO "authenticated" USING ((("franchise_id" = "public"."get_user_franchise_id"("auth"."uid"())) OR ("franchise_id" IS NULL)));

DROP POLICY IF EXISTS "Users view franchise quotation options" ON "public"."quotation_version_options";
DROP POLICY IF EXISTS "Users view franchise quotation options" ON "public"."quotation_version_options";
CREATE POLICY "Users view franchise quotation options" ON "public"."quotation_version_options" FOR SELECT TO "authenticated" USING ((("franchise_id" = "public"."get_user_franchise_id"("auth"."uid"())) OR ("franchise_id" IS NULL)));

DROP POLICY IF EXISTS "Users view franchise quotation versions" ON "public"."quotation_versions";
DROP POLICY IF EXISTS "Users view franchise quotation versions" ON "public"."quotation_versions";
CREATE POLICY "Users view franchise quotation versions" ON "public"."quotation_versions" FOR SELECT TO "authenticated" USING ((("franchise_id" = "public"."get_user_franchise_id"("auth"."uid"())) OR ("franchise_id" IS NULL)));

DROP POLICY IF EXISTS "Users view franchise quote charges" ON "public"."quote_charges";
DROP POLICY IF EXISTS "Users view franchise quote charges" ON "public"."quote_charges";
CREATE POLICY "Users view franchise quote charges" ON "public"."quote_charges" FOR SELECT TO "authenticated" USING ((("franchise_id" = "public"."get_user_franchise_id"("auth"."uid"())) OR ("franchise_id" IS NULL)));

DROP POLICY IF EXISTS "Users view own logs" ON "public"."audit_logs";
DROP POLICY IF EXISTS "Users view own logs" ON "public"."audit_logs";
CREATE POLICY "Users view own logs" ON "public"."audit_logs" FOR SELECT USING (("auth"."uid"() = "user_id"));

DROP POLICY IF EXISTS "Users view tenant provider charge mappings" ON "public"."provider_charge_mappings";
DROP POLICY IF EXISTS "Users view tenant provider charge mappings" ON "public"."provider_charge_mappings";
CREATE POLICY "Users view tenant provider charge mappings" ON "public"."provider_charge_mappings" FOR SELECT TO "authenticated" USING (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())));

DROP POLICY IF EXISTS "Users view tenant provider rate rules" ON "public"."provider_rate_rules";
DROP POLICY IF EXISTS "Users view tenant provider rate rules" ON "public"."provider_rate_rules";
CREATE POLICY "Users view tenant provider rate rules" ON "public"."provider_rate_rules" FOR SELECT TO "authenticated" USING (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())));

DROP POLICY IF EXISTS "Users view tenant provider rate templates" ON "public"."provider_rate_templates";
DROP POLICY IF EXISTS "Users view tenant provider rate templates" ON "public"."provider_rate_templates";
CREATE POLICY "Users view tenant provider rate templates" ON "public"."provider_rate_templates" FOR SELECT TO "authenticated" USING (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())));

DROP POLICY IF EXISTS "Users view tenant provider surcharges" ON "public"."provider_surcharges";
DROP POLICY IF EXISTS "Users view tenant provider surcharges" ON "public"."provider_surcharges";
CREATE POLICY "Users view tenant provider surcharges" ON "public"."provider_surcharges" FOR SELECT TO "authenticated" USING (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())));

ALTER TABLE "public"."accounts" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."activities" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."audit_logs" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."auth_permissions" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."auth_role_hierarchy" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."auth_role_permissions" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."auth_roles" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."cargo_details" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."cargo_types" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."carrier_rate_attachments" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."carrier_rate_charges" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."carrier_rates" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."carrier_service_types" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."carriers" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."charge_bases" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "charge_bases_manage" ON "public"."charge_bases";
DROP POLICY IF EXISTS "charge_bases_manage" ON "public"."charge_bases";
CREATE POLICY "charge_bases_manage" ON "public"."charge_bases" USING (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))) WITH CHECK (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())));

DROP POLICY IF EXISTS "charge_bases_read" ON "public"."charge_bases";
DROP POLICY IF EXISTS "charge_bases_read" ON "public"."charge_bases";
CREATE POLICY "charge_bases_read" ON "public"."charge_bases" FOR SELECT USING ((("tenant_id" IS NULL) OR ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));

ALTER TABLE "public"."charge_categories" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "charge_categories_manage" ON "public"."charge_categories";
DROP POLICY IF EXISTS "charge_categories_manage" ON "public"."charge_categories";
CREATE POLICY "charge_categories_manage" ON "public"."charge_categories" USING (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))) WITH CHECK (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())));

DROP POLICY IF EXISTS "charge_categories_read" ON "public"."charge_categories";
DROP POLICY IF EXISTS "charge_categories_read" ON "public"."charge_categories";
CREATE POLICY "charge_categories_read" ON "public"."charge_categories" FOR SELECT USING ((("tenant_id" IS NULL) OR ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));

ALTER TABLE "public"."charge_sides" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "charge_sides_manage" ON "public"."charge_sides";
DROP POLICY IF EXISTS "charge_sides_manage" ON "public"."charge_sides";
CREATE POLICY "charge_sides_manage" ON "public"."charge_sides" USING (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))) WITH CHECK (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())));

DROP POLICY IF EXISTS "charge_sides_read" ON "public"."charge_sides";
DROP POLICY IF EXISTS "charge_sides_read" ON "public"."charge_sides";
CREATE POLICY "charge_sides_read" ON "public"."charge_sides" FOR SELECT USING ((("tenant_id" IS NULL) OR ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));

ALTER TABLE "public"."charge_tier_config" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."charge_tier_ranges" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."charge_weight_breaks" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."cities" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cities_manage" ON "public"."cities";
DROP POLICY IF EXISTS "cities_manage" ON "public"."cities";
CREATE POLICY "cities_manage" ON "public"."cities" USING (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))) WITH CHECK (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())));

DROP POLICY IF EXISTS "cities_read" ON "public"."cities";
DROP POLICY IF EXISTS "cities_read" ON "public"."cities";
CREATE POLICY "cities_read" ON "public"."cities" FOR SELECT USING ((("tenant_id" IS NULL) OR ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));

ALTER TABLE "public"."compliance_checks" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."compliance_rules" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."consignees" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."contacts" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."container_sizes" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "container_sizes_manage" ON "public"."container_sizes";
DROP POLICY IF EXISTS "container_sizes_manage" ON "public"."container_sizes";
CREATE POLICY "container_sizes_manage" ON "public"."container_sizes" USING (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))) WITH CHECK (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())));

DROP POLICY IF EXISTS "container_sizes_read" ON "public"."container_sizes";
DROP POLICY IF EXISTS "container_sizes_read" ON "public"."container_sizes";
CREATE POLICY "container_sizes_read" ON "public"."container_sizes" FOR SELECT USING ((("tenant_id" IS NULL) OR ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));

ALTER TABLE "public"."container_types" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "container_types_manage" ON "public"."container_types";
DROP POLICY IF EXISTS "container_types_manage" ON "public"."container_types";
CREATE POLICY "container_types_manage" ON "public"."container_types" USING (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))) WITH CHECK (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())));

DROP POLICY IF EXISTS "container_types_read" ON "public"."container_types";
DROP POLICY IF EXISTS "container_types_read" ON "public"."container_types";
CREATE POLICY "container_types_read" ON "public"."container_types" FOR SELECT USING ((("tenant_id" IS NULL) OR ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));

ALTER TABLE "public"."continents" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "continents_manage" ON "public"."continents";
DROP POLICY IF EXISTS "continents_manage" ON "public"."continents";
CREATE POLICY "continents_manage" ON "public"."continents" USING (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))) WITH CHECK (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())));

DROP POLICY IF EXISTS "continents_read" ON "public"."continents";
DROP POLICY IF EXISTS "continents_read" ON "public"."continents";
CREATE POLICY "continents_read" ON "public"."continents" FOR SELECT USING ((("tenant_id" IS NULL) OR ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));

ALTER TABLE "public"."countries" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "countries_manage" ON "public"."countries";
DROP POLICY IF EXISTS "countries_manage" ON "public"."countries";
CREATE POLICY "countries_manage" ON "public"."countries" USING (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))) WITH CHECK (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())));

DROP POLICY IF EXISTS "countries_read" ON "public"."countries";
DROP POLICY IF EXISTS "countries_read" ON "public"."countries";
CREATE POLICY "countries_read" ON "public"."countries" FOR SELECT USING ((("tenant_id" IS NULL) OR ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));

ALTER TABLE "public"."currencies" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "currencies_manage" ON "public"."currencies";
DROP POLICY IF EXISTS "currencies_manage" ON "public"."currencies";
CREATE POLICY "currencies_manage" ON "public"."currencies" USING (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))) WITH CHECK (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())));

DROP POLICY IF EXISTS "currencies_read" ON "public"."currencies";
DROP POLICY IF EXISTS "currencies_read" ON "public"."currencies";
CREATE POLICY "currencies_read" ON "public"."currencies" FOR SELECT USING ((("tenant_id" IS NULL) OR ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));

ALTER TABLE "public"."custom_role_permissions" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."custom_roles" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."customer_selections" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."customs_documents" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."dashboard_preferences" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."document_templates" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."document_versions" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."documents" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."email_account_delegations" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."email_accounts" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."email_audit_log" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."email_filters" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."email_templates" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."emails" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."entity_transfer_items" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."entity_transfers" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."franchises" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."fx_rates" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fx_rates_tenant_read" ON "public"."fx_rates";
DROP POLICY IF EXISTS "fx_rates_tenant_read" ON "public"."fx_rates";
CREATE POLICY "fx_rates_tenant_read" ON "public"."fx_rates" FOR SELECT USING (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())));

DROP POLICY IF EXISTS "fx_rates_tenant_write" ON "public"."fx_rates";
DROP POLICY IF EXISTS "fx_rates_tenant_write" ON "public"."fx_rates";
CREATE POLICY "fx_rates_tenant_write" ON "public"."fx_rates" USING (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))) WITH CHECK (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())));

ALTER TABLE "public"."history_filter_presets" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."import_errors" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."import_history" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."import_history_details" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."incoterms" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."invitations" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."lead_activities" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."lead_assignment_history" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."lead_assignment_queue" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."lead_assignment_rules" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."lead_score_config" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."lead_score_logs" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."lead_scoring_rules" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."leads" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."margin_methods" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "margin_methods_tenant_read" ON "public"."margin_methods";
DROP POLICY IF EXISTS "margin_methods_tenant_read" ON "public"."margin_methods";
CREATE POLICY "margin_methods_tenant_read" ON "public"."margin_methods" FOR SELECT USING (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())));

DROP POLICY IF EXISTS "margin_methods_tenant_write" ON "public"."margin_methods";
DROP POLICY IF EXISTS "margin_methods_tenant_write" ON "public"."margin_methods";
CREATE POLICY "margin_methods_tenant_write" ON "public"."margin_methods" USING (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))) WITH CHECK (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())));

ALTER TABLE "public"."margin_profiles" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "margin_profiles_tenant_read" ON "public"."margin_profiles";
DROP POLICY IF EXISTS "margin_profiles_tenant_read" ON "public"."margin_profiles";
CREATE POLICY "margin_profiles_tenant_read" ON "public"."margin_profiles" FOR SELECT USING (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())));

DROP POLICY IF EXISTS "margin_profiles_tenant_write" ON "public"."margin_profiles";
DROP POLICY IF EXISTS "margin_profiles_tenant_write" ON "public"."margin_profiles";
CREATE POLICY "margin_profiles_tenant_write" ON "public"."margin_profiles" USING (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))) WITH CHECK (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())));

ALTER TABLE "public"."oauth_configurations" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."opportunities" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."opportunity_items" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."opportunity_probability_history" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."package_categories" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."package_sizes" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."portal_tokens" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."ports_locations" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."provider_api_configs" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."provider_charge_mappings" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."provider_rate_rules" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."provider_rate_templates" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."provider_surcharges" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."provider_types" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "provider_types_tenant_read" ON "public"."provider_types";
DROP POLICY IF EXISTS "provider_types_tenant_read" ON "public"."provider_types";
CREATE POLICY "provider_types_tenant_read" ON "public"."provider_types" FOR SELECT USING (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())));

DROP POLICY IF EXISTS "provider_types_tenant_write" ON "public"."provider_types";
DROP POLICY IF EXISTS "provider_types_tenant_write" ON "public"."provider_types";
CREATE POLICY "provider_types_tenant_write" ON "public"."provider_types" USING (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))) WITH CHECK (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())));

DROP POLICY IF EXISTS "pt_admin" ON "public"."quote_presentation_templates";
DROP POLICY IF EXISTS "pt_admin" ON "public"."quote_presentation_templates";
CREATE POLICY "pt_admin" ON "public"."quote_presentation_templates" TO "authenticated" USING ("public"."is_platform_admin"("auth"."uid"()));

DROP POLICY IF EXISTS "pt_tenant" ON "public"."quote_presentation_templates";
DROP POLICY IF EXISTS "pt_tenant" ON "public"."quote_presentation_templates";
CREATE POLICY "pt_tenant" ON "public"."quote_presentation_templates" TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'tenant_admin'::"public"."app_role") AND ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));

DROP POLICY IF EXISTS "pt_view" ON "public"."quote_presentation_templates";
DROP POLICY IF EXISTS "pt_view" ON "public"."quote_presentation_templates";
CREATE POLICY "pt_view" ON "public"."quote_presentation_templates" FOR SELECT TO "authenticated" USING (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())));

DROP POLICY IF EXISTS "qal_insert" ON "public"."quote_access_logs";
DROP POLICY IF EXISTS "qal_insert" ON "public"."quote_access_logs";
CREATE POLICY "qal_insert" ON "public"."quote_access_logs" FOR INSERT TO "authenticated", "anon" WITH CHECK (true);

DROP POLICY IF EXISTS "qal_view" ON "public"."quote_access_logs";
DROP POLICY IF EXISTS "qal_view" ON "public"."quote_access_logs";
CREATE POLICY "qal_view" ON "public"."quote_access_logs" FOR SELECT TO "authenticated" USING (("quote_id" IN ( SELECT "quotes"."id"
   FROM "public"."quotes"
  WHERE ("quotes"."franchise_id" = "public"."get_user_franchise_id"("auth"."uid"())))));

DROP POLICY IF EXISTS "qc_admin" ON "public"."quote_comments";
DROP POLICY IF EXISTS "qc_admin" ON "public"."quote_comments";
CREATE POLICY "qc_admin" ON "public"."quote_comments" TO "authenticated" USING ("public"."is_platform_admin"("auth"."uid"()));

DROP POLICY IF EXISTS "qc_public" ON "public"."quote_comments";
DROP POLICY IF EXISTS "qc_public" ON "public"."quote_comments";
CREATE POLICY "qc_public" ON "public"."quote_comments" FOR INSERT TO "authenticated", "anon" WITH CHECK (("author_type" = 'customer'::"text"));

DROP POLICY IF EXISTS "qc_user" ON "public"."quote_comments";
DROP POLICY IF EXISTS "qc_user" ON "public"."quote_comments";
CREATE POLICY "qc_user" ON "public"."quote_comments" TO "authenticated" USING (("quote_id" IN ( SELECT "quotes"."id"
   FROM "public"."quotes"
  WHERE ("quotes"."franchise_id" = "public"."get_user_franchise_id"("auth"."uid"())))));

DROP POLICY IF EXISTS "qd_admin" ON "public"."quote_documents";
DROP POLICY IF EXISTS "qd_admin" ON "public"."quote_documents";
CREATE POLICY "qd_admin" ON "public"."quote_documents" TO "authenticated" USING ("public"."is_platform_admin"("auth"."uid"()));

DROP POLICY IF EXISTS "qd_public" ON "public"."quote_documents";
DROP POLICY IF EXISTS "qd_public" ON "public"."quote_documents";
CREATE POLICY "qd_public" ON "public"."quote_documents" FOR SELECT TO "authenticated", "anon" USING (("is_public" = true));

DROP POLICY IF EXISTS "qd_user" ON "public"."quote_documents";
DROP POLICY IF EXISTS "qd_user" ON "public"."quote_documents";
CREATE POLICY "qd_user" ON "public"."quote_documents" TO "authenticated" USING (("quote_id" IN ( SELECT "quotes"."id"
   FROM "public"."quotes"
  WHERE ("quotes"."franchise_id" = "public"."get_user_franchise_id"("auth"."uid"())))));

DROP POLICY IF EXISTS "qeh_insert" ON "public"."quote_email_history";
DROP POLICY IF EXISTS "qeh_insert" ON "public"."quote_email_history";
CREATE POLICY "qeh_insert" ON "public"."quote_email_history" FOR INSERT TO "authenticated" WITH CHECK (("quote_id" IN ( SELECT "quotes"."id"
   FROM "public"."quotes"
  WHERE ("quotes"."franchise_id" = "public"."get_user_franchise_id"("auth"."uid"())))));

DROP POLICY IF EXISTS "qeh_view" ON "public"."quote_email_history";
DROP POLICY IF EXISTS "qeh_view" ON "public"."quote_email_history";
CREATE POLICY "qeh_view" ON "public"."quote_email_history" FOR SELECT TO "authenticated" USING (("quote_id" IN ( SELECT "quotes"."id"
   FROM "public"."quotes"
  WHERE ("quotes"."franchise_id" = "public"."get_user_franchise_id"("auth"."uid"())))));

DROP POLICY IF EXISTS "qs_admin" ON "public"."quote_shares";
DROP POLICY IF EXISTS "qs_admin" ON "public"."quote_shares";
CREATE POLICY "qs_admin" ON "public"."quote_shares" TO "authenticated" USING ("public"."is_platform_admin"("auth"."uid"()));

DROP POLICY IF EXISTS "qs_public" ON "public"."quote_shares";
DROP POLICY IF EXISTS "qs_public" ON "public"."quote_shares";
CREATE POLICY "qs_public" ON "public"."quote_shares" FOR SELECT TO "authenticated", "anon" USING (("is_active" = true));

DROP POLICY IF EXISTS "qs_user" ON "public"."quote_shares";
DROP POLICY IF EXISTS "qs_user" ON "public"."quote_shares";
CREATE POLICY "qs_user" ON "public"."quote_shares" TO "authenticated" USING (("quote_id" IN ( SELECT "quotes"."id"
   FROM "public"."quotes"
  WHERE ("quotes"."franchise_id" = "public"."get_user_franchise_id"("auth"."uid"())))));

ALTER TABLE "public"."queue_members" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."queues" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."quotation_audit_log" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."quotation_packages" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."quotation_selection_events" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."quotation_version_option_legs" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "quotation_version_option_legs_manage_alignment" ON "public"."quotation_version_option_legs";
DROP POLICY IF EXISTS "quotation_version_option_legs_manage_alignment" ON "public"."quotation_version_option_legs";
CREATE POLICY "quotation_version_option_legs_manage_alignment" ON "public"."quotation_version_option_legs" USING ((EXISTS ( SELECT 1
   FROM (("public"."quotation_version_options" "qvo"
     JOIN "public"."quotation_versions" "qv" ON (("qv"."id" = "qvo"."quotation_version_id")))
     JOIN "public"."quotes" "q" ON (("q"."id" = "qv"."quote_id")))
  WHERE (("qvo"."id" = "quotation_version_option_legs"."quotation_version_option_id") AND (("q"."tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())) OR ("q"."franchise_id" = "public"."get_user_franchise_id"("auth"."uid"())) OR "public"."is_platform_admin"("auth"."uid"())))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM (("public"."quotation_version_options" "qvo"
     JOIN "public"."quotation_versions" "qv" ON (("qv"."id" = "qvo"."quotation_version_id")))
     JOIN "public"."quotes" "q" ON (("q"."id" = "qv"."quote_id")))
  WHERE (("qvo"."id" = "quotation_version_option_legs"."quotation_version_option_id") AND (("q"."tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())) OR ("q"."franchise_id" = "public"."get_user_franchise_id"("auth"."uid"())) OR "public"."is_platform_admin"("auth"."uid"()))))));

DROP POLICY IF EXISTS "quotation_version_option_legs_read" ON "public"."quotation_version_option_legs";
DROP POLICY IF EXISTS "quotation_version_option_legs_read" ON "public"."quotation_version_option_legs";
CREATE POLICY "quotation_version_option_legs_read" ON "public"."quotation_version_option_legs" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."quotation_version_options" "qvo"
  WHERE (("qvo"."id" = "quotation_version_option_legs"."quotation_version_option_id") AND ("qvo"."tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))))));

DROP POLICY IF EXISTS "quotation_version_option_legs_read_alignment" ON "public"."quotation_version_option_legs";
DROP POLICY IF EXISTS "quotation_version_option_legs_read_alignment" ON "public"."quotation_version_option_legs";
CREATE POLICY "quotation_version_option_legs_read_alignment" ON "public"."quotation_version_option_legs" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM (("public"."quotation_version_options" "qvo"
     JOIN "public"."quotation_versions" "qv" ON (("qv"."id" = "qvo"."quotation_version_id")))
     JOIN "public"."quotes" "q" ON (("q"."id" = "qv"."quote_id")))
  WHERE (("qvo"."id" = "quotation_version_option_legs"."quotation_version_option_id") AND (("q"."tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())) OR ("q"."franchise_id" = "public"."get_user_franchise_id"("auth"."uid"())) OR "public"."is_platform_admin"("auth"."uid"()))))));

DROP POLICY IF EXISTS "quotation_version_option_legs_write" ON "public"."quotation_version_option_legs";
DROP POLICY IF EXISTS "quotation_version_option_legs_write" ON "public"."quotation_version_option_legs";
CREATE POLICY "quotation_version_option_legs_write" ON "public"."quotation_version_option_legs" USING ((EXISTS ( SELECT 1
   FROM "public"."quotation_version_options" "qvo"
  WHERE (("qvo"."id" = "quotation_version_option_legs"."quotation_version_option_id") AND ("qvo"."tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."quotation_version_options" "qvo"
  WHERE (("qvo"."id" = "quotation_version_option_legs"."quotation_version_option_id") AND ("qvo"."tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))))));

ALTER TABLE "public"."quotation_version_options" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."quotation_versions" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "quotation_versions_manage" ON "public"."quotation_versions";
DROP POLICY IF EXISTS "quotation_versions_manage" ON "public"."quotation_versions";
CREATE POLICY "quotation_versions_manage" ON "public"."quotation_versions" USING ((EXISTS ( SELECT 1
   FROM "public"."quotes" "q"
  WHERE (("q"."id" = "quotation_versions"."quote_id") AND ("q"."tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."quotes" "q"
  WHERE (("q"."id" = "quotation_versions"."quote_id") AND ("q"."tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))))));

DROP POLICY IF EXISTS "quotation_versions_read" ON "public"."quotation_versions";
DROP POLICY IF EXISTS "quotation_versions_read" ON "public"."quotation_versions";
CREATE POLICY "quotation_versions_read" ON "public"."quotation_versions" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."quotes" "q"
  WHERE (("q"."id" = "quotation_versions"."quote_id") AND ("q"."tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))))));

ALTER TABLE "public"."quote_access_logs" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."quote_charges" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."quote_comments" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."quote_documents" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."quote_email_history" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."quote_events" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."quote_items" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."quote_legs" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."quote_number_config_franchise" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."quote_number_config_tenant" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."quote_number_sequences" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."quote_option_legs" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "quote_option_legs_read" ON "public"."quote_option_legs";
DROP POLICY IF EXISTS "quote_option_legs_read" ON "public"."quote_option_legs";
CREATE POLICY "quote_option_legs_read" ON "public"."quote_option_legs" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."quote_options" "qo"
  WHERE (("qo"."id" = "quote_option_legs"."quote_option_id") AND ("qo"."tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))))));

DROP POLICY IF EXISTS "quote_option_legs_write" ON "public"."quote_option_legs";
DROP POLICY IF EXISTS "quote_option_legs_write" ON "public"."quote_option_legs";
CREATE POLICY "quote_option_legs_write" ON "public"."quote_option_legs" USING ((EXISTS ( SELECT 1
   FROM "public"."quote_options" "qo"
  WHERE (("qo"."id" = "quote_option_legs"."quote_option_id") AND ("qo"."tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."quote_options" "qo"
  WHERE (("qo"."id" = "quote_option_legs"."quote_option_id") AND ("qo"."tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))))));

ALTER TABLE "public"."quote_options" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "quote_options_manage" ON "public"."quote_options";
DROP POLICY IF EXISTS "quote_options_manage" ON "public"."quote_options";
CREATE POLICY "quote_options_manage" ON "public"."quote_options" USING (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))) WITH CHECK (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())));

DROP POLICY IF EXISTS "quote_options_read" ON "public"."quote_options";
DROP POLICY IF EXISTS "quote_options_read" ON "public"."quote_options";
CREATE POLICY "quote_options_read" ON "public"."quote_options" FOR SELECT USING (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())));

ALTER TABLE "public"."quote_presentation_templates" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."quote_selection" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "quote_selection_manage" ON "public"."quote_selection";
DROP POLICY IF EXISTS "quote_selection_manage" ON "public"."quote_selection";
CREATE POLICY "quote_selection_manage" ON "public"."quote_selection" USING (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))) WITH CHECK (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())));

DROP POLICY IF EXISTS "quote_selection_read" ON "public"."quote_selection";
DROP POLICY IF EXISTS "quote_selection_read" ON "public"."quote_selection";
CREATE POLICY "quote_selection_read" ON "public"."quote_selection" FOR SELECT USING (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())));

ALTER TABLE "public"."quote_shares" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."quote_templates" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."quote_versions" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."quotes" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."rate_calculations" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."rate_components" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."rates" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."routes" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."scheduled_emails" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."service_details" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."service_leg_categories" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."service_modes" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_modes_tenant_read" ON "public"."service_modes";
DROP POLICY IF EXISTS "service_modes_tenant_read" ON "public"."service_modes";
CREATE POLICY "service_modes_tenant_read" ON "public"."service_modes" FOR SELECT USING (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())));

DROP POLICY IF EXISTS "service_modes_tenant_write" ON "public"."service_modes";
DROP POLICY IF EXISTS "service_modes_tenant_write" ON "public"."service_modes";
CREATE POLICY "service_modes_tenant_write" ON "public"."service_modes" USING (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))) WITH CHECK (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())));

ALTER TABLE "public"."service_type_mappings" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."service_types" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."services" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."shipment_attachments" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "shipment_attachments_delete_by_creator" ON "public"."shipment_attachments";
DROP POLICY IF EXISTS "shipment_attachments_delete_by_creator" ON "public"."shipment_attachments";
CREATE POLICY "shipment_attachments_delete_by_creator" ON "public"."shipment_attachments" FOR DELETE TO "authenticated" USING (("created_by" = "auth"."uid"()));

DROP POLICY IF EXISTS "shipment_attachments_insert_authenticated" ON "public"."shipment_attachments";
DROP POLICY IF EXISTS "shipment_attachments_insert_authenticated" ON "public"."shipment_attachments";
CREATE POLICY "shipment_attachments_insert_authenticated" ON "public"."shipment_attachments" FOR INSERT TO "authenticated" WITH CHECK (true);

DROP POLICY IF EXISTS "shipment_attachments_read_authenticated" ON "public"."shipment_attachments";
DROP POLICY IF EXISTS "shipment_attachments_read_authenticated" ON "public"."shipment_attachments";
CREATE POLICY "shipment_attachments_read_authenticated" ON "public"."shipment_attachments" FOR SELECT TO "authenticated" USING (true);

ALTER TABLE "public"."shipment_items" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."shipments" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."shipping_rates" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."states" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "states_manage" ON "public"."states";
DROP POLICY IF EXISTS "states_manage" ON "public"."states";
CREATE POLICY "states_manage" ON "public"."states" USING (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))) WITH CHECK (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())));

DROP POLICY IF EXISTS "states_read" ON "public"."states";
DROP POLICY IF EXISTS "states_read" ON "public"."states";
CREATE POLICY "states_read" ON "public"."states" FOR SELECT USING ((("tenant_id" IS NULL) OR ("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))));

ALTER TABLE "public"."subscription_features" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."subscription_invoices" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."subscription_plans" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."tenant_subscriptions" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."tenants" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."territories" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."territory_assignments" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."territory_geographies" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."themes" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."tracking_events" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."trade_directions" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "trade_directions_tenant_read" ON "public"."trade_directions";
DROP POLICY IF EXISTS "trade_directions_tenant_read" ON "public"."trade_directions";
CREATE POLICY "trade_directions_tenant_read" ON "public"."trade_directions" FOR SELECT USING (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())));

DROP POLICY IF EXISTS "trade_directions_tenant_write" ON "public"."trade_directions";
DROP POLICY IF EXISTS "trade_directions_tenant_write" ON "public"."trade_directions";
CREATE POLICY "trade_directions_tenant_write" ON "public"."trade_directions" USING (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"()))) WITH CHECK (("tenant_id" = "public"."get_user_tenant_id"("auth"."uid"())));

ALTER TABLE "public"."transport_modes" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."ui_themes" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ui_themes_read_authenticated" ON "public"."ui_themes";
DROP POLICY IF EXISTS "ui_themes_read_authenticated" ON "public"."ui_themes";
CREATE POLICY "ui_themes_read_authenticated" ON "public"."ui_themes" FOR SELECT TO "authenticated" USING ("is_active");

DROP POLICY IF EXISTS "ui_themes_user_write" ON "public"."ui_themes";
DROP POLICY IF EXISTS "ui_themes_user_write" ON "public"."ui_themes";
CREATE POLICY "ui_themes_user_write" ON "public"."ui_themes" TO "authenticated" USING ((("scope" = 'user'::"text") AND ("user_id" = "auth"."uid"()))) WITH CHECK ((("scope" = 'user'::"text") AND ("user_id" = "auth"."uid"())));

ALTER TABLE "public"."usage_records" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."user_capacity" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."user_custom_roles" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."user_preferences" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."user_roles" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."vehicles" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."warehouse_inventory" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."warehouses" ENABLE ROW LEVEL SECURITY;

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";

-- Create tables for dynamic role management

-- Roles table (Extension of the hardcoded types)
CREATE TABLE IF NOT EXISTS public.auth_roles (
    id TEXT PRIMARY KEY, -- 'platform_admin', 'tenant_admin', etc.
    label TEXT NOT NULL,
    description TEXT,
    level INTEGER NOT NULL DEFAULT 99,
    can_manage_scopes TEXT[] DEFAULT '{}', -- 'global', 'tenant', 'franchise'
    is_system BOOLEAN DEFAULT FALSE, -- Prevent deletion of core roles
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Permissions Catalog
CREATE TABLE IF NOT EXISTS public.auth_permissions (
    id TEXT PRIMARY KEY, -- 'leads.view', etc.
    category TEXT NOT NULL, -- 'Leads', 'Admin', etc.
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Role <-> Permission Mapping
CREATE TABLE IF NOT EXISTS public.auth_role_permissions (
    role_id TEXT REFERENCES public.auth_roles(id) ON DELETE CASCADE,
    permission_id TEXT REFERENCES public.auth_permissions(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (role_id, permission_id)
);

-- Role Hierarchy (Who can manage whom)
CREATE TABLE IF NOT EXISTS public.auth_role_hierarchy (
    manager_role_id TEXT REFERENCES public.auth_roles(id) ON DELETE CASCADE,
    target_role_id TEXT REFERENCES public.auth_roles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (manager_role_id, target_role_id)
);

-- Enable RLS
ALTER TABLE public.auth_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_role_hierarchy ENABLE ROW LEVEL SECURITY;

-- Policies
-- Platform admins can view and manage everything
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'user_roles'
  ) THEN
    EXECUTE 'DROP POLICY IF EXISTS "Platform admins can manage roles" ON public.auth_roles;
CREATE POLICY "Platform admins can manage roles" ON public.auth_roles ' ||
            'USING (auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role = ''platform_admin''))';

    EXECUTE 'DROP POLICY IF EXISTS "Platform admins can manage permissions" ON public.auth_permissions;
CREATE POLICY "Platform admins can manage permissions" ON public.auth_permissions ' ||
            'USING (auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role = ''platform_admin''))';

    EXECUTE 'DROP POLICY IF EXISTS "Platform admins can manage role permissions" ON public.auth_role_permissions;
CREATE POLICY "Platform admins can manage role permissions" ON public.auth_role_permissions ' ||
            'USING (auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role = ''platform_admin''))';

    EXECUTE 'DROP POLICY IF EXISTS "Platform admins can manage hierarchy" ON public.auth_role_hierarchy;
CREATE POLICY "Platform admins can manage hierarchy" ON public.auth_role_hierarchy ' ||
            'USING (auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role = ''platform_admin''))';
  END IF;
END $$;

-- Everyone can view roles and permissions (needed for UI/logic)
DROP POLICY IF EXISTS "Everyone can view roles" ON public.auth_roles;
CREATE POLICY "Everyone can view roles" ON public.auth_roles
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Everyone can view permissions" ON public.auth_permissions;
CREATE POLICY "Everyone can view permissions" ON public.auth_permissions
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Everyone can view role permissions" ON public.auth_role_permissions;
CREATE POLICY "Everyone can view role permissions" ON public.auth_role_permissions
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Everyone can view hierarchy" ON public.auth_role_hierarchy;
CREATE POLICY "Everyone can view hierarchy" ON public.auth_role_hierarchy
    FOR SELECT USING (true);

-- Insert Initial Data (Seed from existing hardcoded values)
INSERT INTO public.auth_roles (id, label, description, level, can_manage_scopes, is_system) VALUES
('platform_admin', 'Platform Administrator', 'Full system access with global visibility', 0, '{global,tenant,franchise}', true),
('tenant_admin', 'Tenant Administrator', 'Manages a specific tenant and its franchises', 1, '{tenant,franchise}', true),
('franchise_admin', 'Franchise Administrator', 'Manages a specific franchise location', 2, '{franchise}', true),
('user', 'Standard User', 'Operational user with restricted access', 3, '{}', true)
ON CONFLICT (id) DO NOTHING;

-- Note: We would need to seed permissions and role_permissions here too, 
-- but that list is long. Ideally, we run a script to populate it from permissions.ts
-- Migration: 20240110_crm_enhancements
-- Description: Adds advanced CRM features for Accounts and Contacts (Segmentation, Relationships, Extended Fields)

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'accounts'
  ) THEN
    ALTER TABLE public.accounts 
      ADD COLUMN IF NOT EXISTS custom_fields JSONB DEFAULT '{}'::jsonb,
      ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMP WITH TIME ZONE,
      ADD COLUMN IF NOT EXISTS social_profiles JSONB DEFAULT '{}'::jsonb;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'contacts'
  ) THEN
    ALTER TABLE public.contacts
      ADD COLUMN IF NOT EXISTS department TEXT,
      ADD COLUMN IF NOT EXISTS title_level TEXT,
      ADD COLUMN IF NOT EXISTS reports_to UUID REFERENCES public.contacts(id),
      ADD COLUMN IF NOT EXISTS lifecycle_stage TEXT DEFAULT 'lead',
      ADD COLUMN IF NOT EXISTS lead_source TEXT,
      ADD COLUMN IF NOT EXISTS custom_fields JSONB DEFAULT '{}'::jsonb,
      ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMP WITH TIME ZONE,
      ADD COLUMN IF NOT EXISTS social_profiles JSONB DEFAULT '{}'::jsonb;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'tenants'
  ) THEN
    -- 3. Create Account Relationships Table
    CREATE TABLE IF NOT EXISTS public.account_relationships (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES public.tenants(id),
        from_account_id UUID NOT NULL REFERENCES public.accounts(id),
        to_account_id UUID NOT NULL REFERENCES public.accounts(id),
        relationship_type TEXT NOT NULL,
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
        created_by UUID REFERENCES public.profiles(id),
        
        CONSTRAINT unique_account_relationship UNIQUE (from_account_id, to_account_id, relationship_type)
    );

    -- 4. Create Segments Table (Dynamic Lists)
    CREATE TABLE IF NOT EXISTS public.segments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES public.tenants(id),
        name TEXT NOT NULL,
        description TEXT,
        entity_type TEXT NOT NULL,
        criteria JSONB NOT NULL DEFAULT '{}'::jsonb,
        is_dynamic BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
        created_by UUID REFERENCES public.profiles(id)
    );

    -- 5. Create Static Segment Members Table
    CREATE TABLE IF NOT EXISTS public.segment_members (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        segment_id UUID NOT NULL REFERENCES public.segments(id) ON DELETE CASCADE,
        entity_id UUID NOT NULL,
        added_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
        
        CONSTRAINT unique_segment_member UNIQUE (segment_id, entity_id)
    );

    -- 6. Enable RLS
    ALTER TABLE public.account_relationships ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.segments ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.segment_members ENABLE ROW LEVEL SECURITY;

    -- 7. Add RLS Policies (Standard Tenant Isolation)
    DROP POLICY IF EXISTS "Users can view account relationships in their tenant" ON public.account_relationships;
CREATE POLICY "Users can view account relationships in their tenant" ON public.account_relationships
        FOR SELECT USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

    DROP POLICY IF EXISTS "Users can manage account relationships in their tenant" ON public.account_relationships;
CREATE POLICY "Users can manage account relationships in their tenant" ON public.account_relationships
        FOR ALL USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

    DROP POLICY IF EXISTS "Users can view segments in their tenant" ON public.segments;
CREATE POLICY "Users can view segments in their tenant" ON public.segments
        FOR SELECT USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

    DROP POLICY IF EXISTS "Users can manage segments in their tenant" ON public.segments;
CREATE POLICY "Users can manage segments in their tenant" ON public.segments
        FOR ALL USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

    DROP POLICY IF EXISTS "Users can view segment members via segment" ON public.segment_members;
CREATE POLICY "Users can view segment members via segment" ON public.segment_members
        FOR SELECT USING (
            EXISTS (
                SELECT 1 FROM public.segments s 
                WHERE s.id = segment_members.segment_id 
                AND s.tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
            )
        );

    DROP POLICY IF EXISTS "Users can manage segment members via segment" ON public.segment_members;
CREATE POLICY "Users can manage segment members via segment" ON public.segment_members
        FOR ALL USING (
            EXISTS (
                SELECT 1 FROM public.segments s 
                WHERE s.id = segment_members.segment_id 
                AND s.tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
            )
        );

    -- 8. Indexes for Performance
    CREATE INDEX IF NOT EXISTS idx_accounts_custom_fields ON public.accounts USING GIN (custom_fields);
    CREATE INDEX IF NOT EXISTS idx_contacts_custom_fields ON public.contacts USING GIN (custom_fields);
    CREATE INDEX IF NOT EXISTS idx_contacts_email ON public.contacts(email);
    CREATE INDEX IF NOT EXISTS idx_account_relationships_from ON public.account_relationships(from_account_id);
    CREATE INDEX IF NOT EXISTS idx_account_relationships_to ON public.account_relationships(to_account_id);
  END IF;
END $$;
-- Add tenant_id to segment_members
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'segment_members'
  ) THEN
    EXECUTE 'ALTER TABLE public.segment_members ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id)';

    EXECUTE 'UPDATE public.segment_members sm
      SET tenant_id = s.tenant_id
      FROM public.segments s
      WHERE sm.segment_id = s.id
        AND sm.tenant_id IS NULL';

    EXECUTE 'DELETE FROM public.segment_members WHERE tenant_id IS NULL';

    EXECUTE 'ALTER TABLE public.segment_members ALTER COLUMN tenant_id SET NOT NULL';

    EXECUTE 'ALTER TABLE public.segment_members ENABLE ROW LEVEL SECURITY';

    EXECUTE 'DROP POLICY IF EXISTS "Users can view segment members via segment" ON public.segment_members';

    EXECUTE '' ||
      'DROP POLICY IF EXISTS "Users can view segment members based on tenant" ON public.segment_members;
CREATE POLICY "Users can view segment members based on tenant" ON public.segment_members ' ||
      'FOR SELECT ' ||
      'USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()))';

    EXECUTE '' ||
      'DROP POLICY IF EXISTS "Users can insert segment members based on tenant" ON public.segment_members;
CREATE POLICY "Users can insert segment members based on tenant" ON public.segment_members ' ||
      'FOR INSERT ' ||
      'WITH CHECK (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()))';

    EXECUTE '' ||
      'DROP POLICY IF EXISTS "Users can update segment members based on tenant" ON public.segment_members;
CREATE POLICY "Users can update segment members based on tenant" ON public.segment_members ' ||
      'FOR UPDATE ' ||
      'USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()))';

    EXECUTE '' ||
      'DROP POLICY IF EXISTS "Users can delete segment members based on tenant" ON public.segment_members;
CREATE POLICY "Users can delete segment members based on tenant" ON public.segment_members ' ||
      'FOR DELETE ' ||
      'USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()))';
  END IF;
END $$;

-- Migration to add caching for AI quotes
CREATE TABLE IF NOT EXISTS public.ai_quote_cache (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    request_hash text NOT NULL,
    response_payload jsonb NOT NULL,
    created_at timestamptz DEFAULT now(),
    expires_at timestamptz DEFAULT (now() + interval '24 hours')
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_ai_quote_cache_hash ON public.ai_quote_cache(request_hash);

-- RLS Policies
ALTER TABLE public.ai_quote_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read access to authenticated users" ON public.ai_quote_cache;
DROP POLICY IF EXISTS "Allow read access to authenticated users" ON public.ai_quote_cache;
CREATE POLICY "Allow read access to authenticated users" ON public.ai_quote_cache FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Allow insert access to authenticated users" ON public.ai_quote_cache;
DROP POLICY IF EXISTS "Allow insert access to authenticated users" ON public.ai_quote_cache;
CREATE POLICY "Allow insert access to authenticated users" ON public.ai_quote_cache FOR INSERT
TO authenticated
WITH CHECK (true);

-- Function to clean up expired cache
DROP FUNCTION IF EXISTS clean_expired_ai_cache();
CREATE OR REPLACE FUNCTION clean_expired_ai_cache()
RETURNS void AS $$
BEGIN
    DELETE FROM public.ai_quote_cache WHERE expires_at < now();
END;
$$ LANGUAGE plpgsql;
DO $$
DECLARE lbl text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'app_role' AND n.nspname = 'public'
  ) THEN BEGIN
    CREATE TYPE public.app_role AS ENUM ('platform_admin','tenant_admin','franchise_admin','user');
EXCEPTION
    WHEN duplicate_object THEN null;
END;
EXCEPTION
    WHEN duplicate_object THEN null;
END;
EXCEPTION
    WHEN duplicate_object THEN null;
END;
EXCEPTION
    WHEN duplicate_object THEN null;
END;
EXCEPTION
    WHEN duplicate_object THEN null;
END;
EXCEPTION
    WHEN duplicate_object THEN null;
END;
EXCEPTION
    WHEN duplicate_object THEN null;
END; ELSE
    FOREACH lbl IN ARRAY ARRAY['platform_admin','tenant_admin','franchise_admin','user'] LOOP
      IF NOT EXISTS (
        SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE t.typname = 'app_role' AND n.nspname = 'public' AND e.enumlabel = lbl
      ) THEN
        EXECUTE 'ALTER TYPE public.app_role ADD VALUE ' || quote_literal(lbl) || ';';
      END IF;
    END LOOP;
  END IF;
END $$;

-- Create tenants table
CREATE TABLE IF NOT EXISTS public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  logo_url TEXT,
  domain TEXT,
  settings JSONB DEFAULT '{}'::jsonb,
  subscription_tier TEXT DEFAULT 'free' CHECK (subscription_tier IN ('free', 'basic', 'professional', 'enterprise')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create franchises table
CREATE TABLE IF NOT EXISTS public.franchises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  address JSONB DEFAULT '{}'::jsonb,
  manager_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  is_active BOOLEAN DEFAULT true,
  must_change_password BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create user_roles table (idempotent for fresh/local environments)
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  franchise_id UUID REFERENCES public.franchises(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES public.profiles(id),
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, role, tenant_id, franchise_id)
);

-- Create invitations table
CREATE TABLE IF NOT EXISTS public.invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  role public.app_role NOT NULL,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  franchise_id UUID REFERENCES public.franchises(id) ON DELETE CASCADE,
  invited_by UUID NOT NULL REFERENCES public.profiles(id),
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  accepted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
