# AMRO Enterprise Enhancement - Quick Start Guide

## 🚀 Getting Started

This guide will help you integrate and use the new Enterprise-Grade Work Package Templates features in your existing AMRO system.

---

## 📦 What's Been Implemented

### ✅ Completed Components

1. **TypeScript Types** (650+ lines)
   - Location: `services/amro-api/src/types/amro.enterprise.types.ts`
   - 40+ field MaterialLineItem (vs. original 4)
   - 35+ field ToolingLineItem (vs. original 2)
   - 50+ field ComplianceRequirement (vs. original 3)

2. **Database Schema** (700+ lines)
   - Location: `supabase/migrations/20260413100000_amro_enterprise_enhancement_schema.sql`
   - 13 new normalized tables
   - 40+ performance indexes
   - Automated triggers and RLS policies
   - Sample seed data included

3. **API Endpoints** (1,350+ lines)
   - Materials API: 6 endpoints
   - Tooling API: 6 endpoints
   - Compliance API: 6 endpoints

4. **React Query Hooks** (600+ lines)
   - Location: `src/features/module-amro/components/work-orders/useEnterpriseAMRO.ts`
   - 18 hooks for data fetching and mutations
   - Automatic cache management
   - Composition hooks for dashboards

5. **UI Components** (850+ lines)
   - Enterprise Materials Editor
   - Enterprise Tooling Editor
   - Smart search, stock indicators, cost calculators
   - Calibration dashboards and alerts

6. **Documentation** (500+ lines)
   - Implementation Summary: `AMRO_ENTERPRISE_IMPLEMENTATION_SUMMARY.md`
   - This Quick Start Guide

---

## 🔧 Step 1: Apply Database Migration

```bash
# Navigate to your project directory
cd "/Users/user/Downloads/Vimal/Development Projects/Trae/SOS-Nexues/logic-nexus-ai"

# Apply the migration using Supabase CLI
supabase db push

# OR manually apply via SQL
# 1. Open Supabase Dashboard
# 2. Go to SQL Editor
# 3. Copy contents of: supabase/migrations/20260413100000_amro_enterprise_enhancement_schema.sql
# 4. Execute the script
```

### Verify Migration

```sql
-- Check new tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name LIKE 'amro_%'
ORDER BY table_name;

-- Should return 13+ tables including:
-- amro_materials_catalog
-- amro_tooling_registry
-- amro_tooling_instances
-- amro_compliance_ad_sb_registry
-- amro_compliance_requirements_enhanced
-- etc.

-- Check seed data
SELECT COUNT(*) FROM amro_materials_catalog;
SELECT COUNT(*) FROM amro_tooling_registry;
SELECT COUNT(*) FROM amro_compliance_ad_sb_registry;
```

---

## 💻 Step 2: Install Dependencies (if needed)

All required dependencies are already in your project. Verify:

```bash
# Check package.json for these existing dependencies:
- @tanstack/react-query (✅ already installed)
- @supabase/supabase-js (✅ already installed)
- lucide-react (✅ already installed)
- sonner (✅ already installed)
```

No new dependencies needed! 🎉

---

## 🔗 Step 3: Integrate Components

### Option A: Use in Existing Template Management Page

Update `AmroWorkPackageTemplatesPage.tsx` to use the new enterprise editors:

```typescript
// In src/features/module-amro/templates/AmroWorkPackageTemplatesPage.tsx

// Add imports at the top
import { EnterpriseMaterialsEditor } from './EnterpriseMaterialsEditor';
import { EnterpriseToolingEditor } from './EnterpriseToolingEditor';
import type { MaterialLineItem, ToolingLineItem } from '../../../services/amro-api/src/types/amro.enterprise.types';

// Replace the existing materials editor section with:
<TabsContent value="materials">
  <EnterpriseMaterialsEditor
    materials={template.materials_json as MaterialLineItem[]}
    onChange={(materials) => updateTemplate('materials_json', materials)}
    workPackageTemplateId={template.id}
    readOnly={viewMode}
  />
</TabsContent>

<TabsContent value="tooling">
  <EnterpriseToolingEditor
    tools={template.tooling_json as ToolingLineItem[]}
    onChange={(tools) => updateTemplate('tooling_json', tools)}
    workPackageTemplateId={template.id}
    readOnly={viewMode}
  />
</TabsContent>
```

### Option B: Use Hooks Directly in Custom Components

```typescript
import { 
  useMaterialsSearch, 
  useReserveMaterial,
  useMaterialAnalytics 
} from './work-orders/useEnterpriseAMRO';

function MyCustomMaterialSelector() {
  const { data, isLoading } = useMaterialsSearch({
    query: 'filter',
    material_group: 'rotable',
    in_stock_only: true,
  });

  const reserveMutation = useReserveMaterial();

  // Your custom logic here
}
```

---

## 🎨 Step 4: Use the UI Components

### Materials Editor Example

```typescript
import { EnterpriseMaterialsEditor } from './templates/EnterpriseMaterialsEditor';
import type { MaterialLineItem } from '../../../services/amro-api/src/types/amro.enterprise.types';

function WorkPackageTemplateEditor({ templateId }) {
  const [materials, setMaterials] = useState<MaterialLineItem[]>([]);

  return (
    <EnterpriseMaterialsEditor
      materials={materials}
      onChange={setMaterials}
      workPackageTemplateId={templateId}
      readOnly={false}
    />
  );
}
```

### Tooling Editor Example

```typescript
import { EnterpriseToolingEditor } from './templates/EnterpriseToolingEditor';
import type { ToolingLineItem } from '../../../services/amro-api/src/types/amro.enterprise.types';

function WorkPackageToolingSection({ templateId }) {
  const [tools, setTools] = useState<ToolingLineItem[]>([]);

  return (
    <EnterpriseToolingEditor
      tools={tools}
      onChange={setTools}
      workPackageTemplateId={templateId}
      readOnly={false}
    />
  );
}
```

---

## 📊 Step 5: Build Dashboards

### Enterprise Dashboard Example

```typescript
import { useEnterpriseDashboard } from './work-orders/useEnterpriseAMRO';

function EnterpriseDashboard() {
  const {
    materials,
    tooling,
    compliance,
    isLoading,
    isError,
  } = useEnterpriseDashboard(true);

  if (isLoading) return <div>Loading dashboard...</div>;
  if (isError) return <div>Error loading dashboard</div>;

  return (
    <div className="space-y-8">
      {/* Materials Section */}
      <section>
        <h2>Materials Management</h2>
        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardTitle>Total Parts</CardTitle>
            <CardContent>{materials.analytics.data?.total_parts_in_use}</CardContent>
          </Card>
          <Card>
            <CardTitle>Inventory Value</CardTitle>
            <CardContent>${materials.analytics.data?.total_inventory_value}</CardContent>
          </Card>
          <Card>
            <CardTitle>Low Stock Items</CardTitle>
            <CardContent className="text-yellow-600">
              {materials.analytics.data?.parts_below_reorder_point}
            </CardContent>
          </Card>
          <Card>
            <CardTitle>Out of Stock</CardTitle>
            <CardContent className="text-red-600">
              {materials.analytics.data?.parts_out_of_stock}
            </CardContent>
          </Card>
        </div>

        {/* Shortages Alert */}
        {materials.shortages.data?.total_shortages > 0 && (
          <Alert variant="warning">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>
              {materials.shortages.data.total_shortages} material shortages detected
            </AlertTitle>
          </Alert>
        )}
      </section>

      {/* Tooling Section */}
      <section>
        <h2>Tooling & Equipment</h2>
        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardTitle>Total Tools</CardTitle>
            <CardContent>{tooling.analytics.data?.total_tools}</CardContent>
          </Card>
          <Card>
            <CardTitle>Available</CardTitle>
            <CardContent className="text-green-600">
              {tooling.analytics.data?.tools_available}
            </CardContent>
          </Card>
          <Card>
            <CardTitle>Calibration Overdue</CardTitle>
            <CardContent className="text-red-600">
              {tooling.analytics.data?.calibration_overdue}
            </CardContent>
          </Card>
          <Card>
            <CardTitle>Utilization Rate</CardTitle>
            <CardContent>{tooling.analytics.data?.utilization_rate}%</CardContent>
          </Card>
        </div>
      </section>

      {/* Compliance Section */}
      <section>
        <h2>Compliance & Regulatory</h2>
        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardTitle>Compliance Rate</CardTitle>
            <CardContent>{compliance.analytics.data?.fleet_compliance_percentage}%</CardContent>
          </Card>
          <Card>
            <CardTitle>Overdue</CardTitle>
            <CardContent className="text-red-600">
              {compliance.analytics.data?.overdue_requirements}
            </CardContent>
          </Card>
          <Card>
            <CardTitle>Due 30 Days</CardTitle>
            <CardContent className="text-yellow-600">
              {compliance.analytics.data?.due_30_days}
            </CardContent>
          </Card>
          <Card>
            <CardTitle>Active Exemptions</CardTitle>
            <CardContent>{compliance.analytics.data?.exemptions_active}</CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
```

---

## 🔌 Step 6: Use API Endpoints Directly

### Materials API Examples

```typescript
// Search materials
const searchMaterials = async () => {
  const response = await fetch('/api/v2/amro/materials/search', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: 'oil filter',
      ata_chapter: '79-21-00',
      material_group: 'rotable',
      in_stock_only: true,
      limit: 50,
    }),
  });
  
  return response.json();
};

// Check stock levels
const checkStock = async (materialId: string) => {
  const response = await fetch(`/api/v2/amro/materials/${materialId}/stock`, {
    headers: { 'Authorization': `Bearer ${accessToken}` },
  });
  
  return response.json();
};

// Reserve material
const reserveMaterial = async (materialId: string, quantity: number) => {
  const response = await fetch(`/api/v2/amro/materials/${materialId}/reserve`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      quantity,
      work_package_template_id: 'template-123',
      expected_issue_date: '2026-04-20',
    }),
  });
  
  return response.json();
};

// Generate purchase order
const createPurchaseOrder = async () => {
  const response = await fetch('/api/v2/amro/materials/purchase-order', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      materials: [
        { part_number: 'PN-12345', quantity: 10, supplier_id: 'supplier-1' },
        { part_number: 'PN-67890', quantity: 5, supplier_id: 'supplier-2' },
      ],
      priority: 'urgent',
    }),
  });
  
  return response.json();
};
```

### Tooling API Examples

```typescript
// Check tool availability
const checkToolAvailability = async (toolId: string) => {
  const response = await fetch(`/api/v2/amro/tooling/${toolId}/availability`, {
    headers: { 'Authorization': `Bearer ${accessToken}` },
  });
  
  return response.json();
};

// Get calibration due list
const getCalibrationDue = async () => {
  const response = await fetch('/api/v2/amro/tooling/calibration-due', {
    headers: { 'Authorization': `Bearer ${accessToken}` },
  });
  
  return response.json();
  // Returns: { overdue: [], due_30_days: [], due_60_days: [], due_90_days: [] }
};

// Log calibration
const logCalibration = async (toolInstanceId: string) => {
  const response = await fetch(`/api/v2/amro/tooling/tool-123/calibration-log`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      tool_instance_id: toolInstanceId,
      calibration_date: '2026-04-13',
      next_calibration_due: '2026-10-13',
      calibration_standard: 'ISO 6789',
      calibration_result: 'pass',
      certificate_number: 'CAL-2026-001',
      calibrated_by: 'user-123',
    }),
  });
  
  return response.json();
};
```

### Compliance API Examples

```typescript
// Get AD/SB feed
const getADSBFeed = async () => {
  const response = await fetch('/api/v2/amro/compliance-enterprise/ad-sb-feed?applicable_only=true', {
    headers: { 'Authorization': `Bearer ${accessToken}` },
  });
  
  return response.json();
};

// Check applicability
const checkApplicability = async (requirementId: string) => {
  const response = await fetch(`/api/v2/amro/compliance-enterprise/${requirementId}/applicability`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      aircraft_model: 'A320neo',
      engine_model: 'CFM LEAP-1A',
    }),
  });
  
  return response.json();
};

// Digital sign-off
const signOffCompliance = async (requirementId: string) => {
  const response = await fetch(`/api/v2/amro/compliance-enterprise/${requirementId}/sign-off`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      compliance_date: '2026-04-13',
      complied_method: 'Inspection per AMM 72-00-00',
      compliance_reference: 'WP-2026-001',
      digital_signature: {
        certifying_staff_id: 'user-123',
        license_number: 'B1-2024-12345',
        license_type: 'B1',
        license_expiry: '2027-12-31',
        organization: 'ABC MRO',
      },
    }),
  });
  
  return response.json();
};

// Get fleet compliance status
const getFleetStatus = async () => {
  const response = await fetch('/api/v2/amro/compliance-enterprise/fleet-status', {
    headers: { 'Authorization': `Bearer ${accessToken}` },
  });
  
  return response.json();
  // Returns: { compliance_percentage, overdue, upcoming_deadlines: [], ... }
};
```

---

## 🧪 Step 7: Testing

### Test Materials Flow

```typescript
// 1. Search for materials
const searchResults = await fetch('/api/v2/amro/materials/search', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: 'filter', limit: 10 }),
}).then(r => r.json());

console.log('Found materials:', searchResults.total);

// 2. Check stock for a material
const stock = await fetch(`/api/v2/amro/materials/${searchResults.results[0].id}/stock`)
  .then(r => r.json());

console.log('Stock levels:', stock.stock);

// 3. Reserve material
const reservation = await fetch(`/api/v2/amro/materials/${searchResults.results[0].id}/reserve`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    quantity: 5,
    work_package_template_id: 'test-template',
  }),
}).then(r => r.json());

console.log('Reservation created:', reservation.reservation.id);
```

### Test Tooling Flow

```typescript
// 1. Search tools
const toolSearch = await fetch('/api/v2/amro/tooling/search', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: 'torque wrench', limit: 10 }),
}).then(r => r.json());

console.log('Found tools:', toolSearch.total);

// 2. Check availability
const availability = await fetch(`/api/v2/amro/tooling/${toolSearch.results[0].id}/availability`)
  .then(r => r.json());

console.log('Available instances:', availability.quantity_available);

// 3. Check calibration due
const calDue = await fetch('/api/v2/amro/tooling/calibration-due')
  .then(r => r.json());

console.log('Overdue calibrations:', calDue.overdue.length);
```

### Test Compliance Flow

```typescript
// 1. Get AD/SB feed
const adsbFeed = await fetch('/api/v2/amro/compliance-enterprise/ad-sb-feed')
  .then(r => r.json());

console.log('Active directives:', adsbFeed.total);

// 2. Get fleet status
const fleetStatus = await fetch('/api/v2/amro/compliance-enterprise/fleet-status')
  .then(r => r.json());

console.log('Compliance rate:', fleetStatus.compliance_percentage + '%');
console.log('Overdue items:', fleetStatus.overdue);
```

---

## 📚 Integration with Existing Modules

### Stock Ledger Integration

The materials catalog works alongside your existing stock ledger:

```typescript
// Materials catalog handles master data
// Stock ledger handles transactions

// Example: When material is reserved
// 1. Materials API updates amro_material_reservations
// 2. Stock ledger records the transaction
// 3. Both stay in sync via triggers
```

### Parts Inventory Workbench

Enhance the existing parts workbench with enterprise features:

```typescript
// In AmroPartsInventoryWorkbench.tsx
import { useMaterialsSearch } from './work-orders/useEnterpriseAMRO';

// Add enterprise search alongside existing filters
// Use stock indicators from materials catalog
// Show cost estimates and supplier info
```

### Master Data API

The new tables integrate with your existing master data system:

```typescript
// Materials catalog is accessible via:
// - /api/v2/amro/materials/* (new enterprise endpoints)
// - /api/v2/amro/master-data/materials_catalog (via generic handler)

// Tooling registry is accessible via:
// - /api/v2/amro/tooling/* (new enterprise endpoints)
// - /api/v2/amro/master-data/tooling_registry (via generic handler)
```

---

## 🎯 Common Use Cases

### Use Case 1: Create Work Package with Materials

```typescript
function CreateWorkPackageWithMaterials() {
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [materials, setMaterials] = useState([]);
  
  // Load template with enterprise materials
  const { data: template } = useQuery({
    queryKey: ['template', selectedTemplate],
    queryFn: () => fetch(`/api/v2/amro/work-package-templates/${selectedTemplate}`)
      .then(r => r.json()),
  });

  // Reserve all materials
  const reserveMutation = useReserveMaterial();
  
  const handleCreate = async () => {
    for (const material of materials) {
      await reserveMutation.mutateAsync({
        materialId: material.id,
        quantity: material.quantity_required,
        work_package_template_id: selectedTemplate,
      });
    }
    
    // Create work package
    // ...
  };
  
  return <EnterpriseMaterialsEditor materials={materials} onChange={setMaterials} />;
}
```

### Use Case 2: Check Tool Availability Before Scheduling

```typescript
function ToolAvailabilityChecker({ toolId, requiredDate }) {
  const { data: availability } = useToolAvailability(toolId);
  
  if (!availability) return <div>Checking...</div>;
  
  const canReserve = availability.reservation_available;
  
  return (
    <div>
      {canReserve ? (
        <Badge variant="outline" className="text-green-700">
          ✓ {availability.quantity_available} tools available
        </Badge>
      ) : (
        <Badge variant="destructive">
          ✗ No tools available
        </Badge>
      )}
      
      {availability.available_instances.map(instance => (
        <div key={instance.instance_id}>
          {instance.serial_number} - {instance.location}
          <Badge>{instance.calibration_status}</Badge>
        </div>
      ))}
    </div>
  );
}
```

### Use Case 3: Compliance Deadline Monitoring

```typescript
function ComplianceMonitor() {
  const { data: fleetStatus } = useFleetComplianceStatus();
  const { data: adsbFeed } = useADSBFeed({ applicable_only: true });
  
  const urgentItems = fleetStatus?.upcoming_deadlines
    .filter(item => item.days_remaining <= 30)
    .sort((a, b) => a.days_remaining - b.days_remaining);
  
  return (
    <div>
      <h2>Compliance Dashboard</h2>
      
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardTitle>Compliance Rate</CardTitle>
          <CardContent>{fleetStatus?.compliance_percentage}%</CardContent>
        </Card>
        
        <Card>
          <CardTitle>Overdue</CardTitle>
          <CardContent className="text-red-600">
            {fleetStatus?.overdue}
          </CardContent>
        </Card>
        
        <Card>
          <CardTitle>Due in 30 Days</CardTitle>
          <CardContent className="text-yellow-600">
            {urgentItems?.length}
          </CardContent>
        </Card>
      </div>
      
      {urgentItems?.length > 0 && (
        <Alert variant="warning">
          <AlertTriangle />
          <AlertTitle>Urgent Compliance Items</AlertTitle>
          {urgentItems.map(item => (
            <div key={item.requirement_code}>
              {item.directive_number} - {item.days_remaining} days remaining
              <Badge>{item.severity_level}</Badge>
            </div>
          ))}
        </Alert>
      )}
    </div>
  );
}
```

---

## 🐛 Troubleshooting

### Issue: Migration fails to apply

**Solution**: Check PostgreSQL version (requires 12+)
```sql
SELECT version();
```

### Issue: API returns 404

**Solution**: Verify API routes are accessible
```bash
# Check if route file exists
ls src/pages/api/v2/amro/materials/\[...path\].ts
ls src/pages/api/v2/amro/tooling/\[...path\].ts
ls src/pages/api/v2/amro/compliance-enterprise/\[...path\].ts
```

### Issue: React Query hooks return undefined

**Solution**: Ensure authentication is working
```typescript
const { session } = useAuth();
console.log('Session:', session);
// Should have access_token
```

### Issue: Stock levels not updating

**Solution**: Check database triggers
```sql
-- Verify trigger exists
SELECT trigger_name 
FROM information_schema.triggers 
WHERE event_object_table = 'amro_materials_catalog';

-- Should see: trg_materials_catalog_updated_at
```

### Issue: RLS policy blocking access

**Solution**: Set tenant context
```sql
-- Before querying, set tenant
SET app.current_tenant = 'your-tenant-uuid';

-- Or in application code, ensure tenant_id is passed in all queries
```

---

## 📞 Support & Resources

### Documentation Files

- **Enhancement Plan**: `AMRO_WPT_ENTERPRISE_ENHANCEMENT_PLAN.md`
- **Implementation Summary**: `AMRO_ENTERPRISE_IMPLEMENTATION_SUMMARY.md`
- **This Guide**: `AMRO_ENTERPRISE_QUICK_START.md`

### Key Code Files

- **Types**: `services/amro-api/src/types/amro.enterprise.types.ts`
- **Migration**: `supabase/migrations/20260413100000_amro_enterprise_enhancement_schema.sql`
- **Materials API**: `src/pages/api/v2/amro/materials/[...path].ts`
- **Tooling API**: `src/pages/api/v2/amro/tooling/[...path].ts`
- **Compliance API**: `src/pages/api/v2/amro/compliance-enterprise/[...path].ts`
- **Hooks**: `src/features/module-amro/components/work-orders/useEnterpriseAMRO.ts`
- **Materials UI**: `src/features/module-amro/components/templates/EnterpriseMaterialsEditor.tsx`
- **Tooling UI**: `src/features/module-amro/components/templates/EnterpriseToolingEditor.tsx`

### Next Steps

1. ✅ Apply database migration
2. ✅ Integrate components into your workflow
3. ✅ Test all three domains (materials, tooling, compliance)
4. ⏳ Build custom analytics dashboards
5. ⏳ Implement compliance tab UI enhancements
6. ⏳ Write integration tests
7. ⏳ User acceptance testing

---

## 🎉 Success Checklist

- [ ] Database migration applied successfully
- [ ] Can search materials catalog
- [ ] Can check stock levels
- [ ] Can reserve materials
- [ ] Can search tooling registry
- [ ] Can check tool availability
- [ ] Can view calibration due list
- [ ] Can view AD/SB feed
- [ ] Can check compliance applicability
- [ ] Can perform digital sign-off
- [ ] Enterprise editors integrated into template management
- [ ] Analytics dashboards working
- [ ] All tests passing

---

**Happy Building! 🚀**

For questions or issues, refer to:
- Implementation Summary (detailed technical documentation)
- Enhancement Plan (business requirements and competitive analysis)
- Code comments (inline documentation)
