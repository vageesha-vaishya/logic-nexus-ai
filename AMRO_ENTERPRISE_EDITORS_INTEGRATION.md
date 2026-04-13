# AMRO Enterprise Editors - Integration Guide

## ✅ Components Created

Three enterprise-grade editor components have been created and are ready to integrate:

### 1. EnterpriseMaterialsEditor
**File**: `src/features/module-amro/components/templates/EnterpriseMaterialsEditor.tsx`

**Features**:
- ✅ Integrates with existing `parts_inventory` table
- ✅ Smart search with parts catalog
- ✅ Real-time stock status indicators (In Stock, Low, Out of Stock)
- ✅ Cost calculator with live totals
- ✅ Analytics summary cards
- ✅ Aviation-specific fields (ATA chapter, material group, NSN, CAGE code)

**Props**:
```typescript
interface EnterpriseMaterialsEditorProps {
  materials: MaterialLineItem[];
  onChange: (materials: MaterialLineItem[]) => void;
  workPackageTemplateId?: string;
  readOnly?: boolean;
}
```

**Usage Example**:
```typescript
import { EnterpriseMaterialsEditor } from './templates/EnterpriseMaterialsEditor';

function TemplateEditor({ templateId }) {
  const [materials, setMaterials] = useState([]);

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

### 2. EnterpriseToolingEditor
**File**: `src/features/module-amro/components/templates/EnterpriseToolingEditor.tsx`

**Features**:
- ✅ Tool registry search and selection
- ✅ Calibration status indicators
- ✅ Category management (Hand Tool, Power Tool, Test Equipment, etc.)
- ✅ Quantity tracking
- ✅ Analytics summary cards

**Props**:
```typescript
interface EnterpriseToolingEditorProps {
  tools: ToolingLineItem[];
  onChange: (tools: ToolingLineItem[]) => void;
  workPackageTemplateId?: string;
  readOnly?: boolean;
}
```

**Usage Example**:
```typescript
import { EnterpriseToolingEditor } from './templates/EnterpriseToolingEditor';

function TemplateToolingSection({ templateId }) {
  const [tools, setTools] = useState([]);

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

### 3. EnterpriseComplianceEditor
**File**: `src/features/module-amro/components/templates/EnterpriseComplianceEditor.tsx`

**Features**:
- ✅ AD/SB regulatory feed integration
- ✅ Three-tab interface (Requirements, Feed, Analytics)
- ✅ Fleet applicability checking
- ✅ Compliance deadline tracking with overdue alerts
- ✅ Severity level indicators (Critical, High, Medium, Low)
- ✅ Status management (Not Started, In Progress, Complied, Exempted, Deferred)
- ✅ Analytics dashboard with compliance rate, effort estimation

**Props**:
```typescript
interface EnterpriseComplianceEditorProps {
  requirements: ComplianceRequirement[];
  onChange: (requirements: ComplianceRequirement[]) => void;
  workPackageTemplateId?: string;
  readOnly?: boolean;
}
```

**Usage Example**:
```typescript
import { EnterpriseComplianceEditor } from './templates/EnterpriseComplianceEditor';

function TemplateComplianceSection({ templateId }) {
  const [requirements, setRequirements] = useState([]);

  return (
    <EnterpriseComplianceEditor
      requirements={requirements}
      onChange={setRequirements}
      workPackageTemplateId={templateId}
      readOnly={false}
    />
  );
}
```

---

## 🔌 Integration into Work Package Templates Page

### Option 1: Add as New Tabs (Recommended)

Update `AmroWorkPackageTemplatesPage.tsx` to include enterprise tabs:

```typescript
import { EnterpriseMaterialsEditor } from './EnterpriseMaterialsEditor';
import { EnterpriseToolingEditor } from './EnterpriseToolingEditor';
import { EnterpriseComplianceEditor } from './EnterpriseComplianceEditor';

// In your template edit dialog or page:
<Tabs defaultValue="details">
  <TabsList>
    <TabsTrigger value="details">Details</TabsTrigger>
    <TabsTrigger value="tasks">Tasks</TabsTrigger>
    <TabsTrigger value="materials">Materials (Enterprise)</TabsTrigger>
    <TabsTrigger value="tooling">Tooling (Enterprise)</TabsTrigger>
    <TabsTrigger value="compliance">Compliance (Enterprise)</TabsTrigger>
  </TabsList>

  <TabsContent value="materials">
    <EnterpriseMaterialsEditor
      materials={editTemplate.materials_json || []}
      onChange={(materials) => updateTemplateField('materials_json', materials)}
      workPackageTemplateId={editTemplate.id}
      readOnly={viewMode}
    />
  </TabsContent>

  <TabsContent value="tooling">
    <EnterpriseToolingEditor
      tools={editTemplate.tooling_json || []}
      onChange={(tools) => updateTemplateField('tooling_json', tools)}
      workPackageTemplateId={editTemplate.id}
      readOnly={viewMode}
    />
  </TabsContent>

  <TabsContent value="compliance">
    <EnterpriseComplianceEditor
      requirements={editTemplate.compliance_requirements_json || []}
      onChange={(reqs) => updateTemplateField('compliance_requirements_json', reqs)}
      workPackageTemplateId={editTemplate.id}
      readOnly={viewMode}
    />
  </TabsContent>
</Tabs>
```

### Option 2: Create Separate Enterprise Page

Create a new page `AmroEnterpriseTemplatesPage.tsx` that uses all three editors:

```typescript
import { EnterpriseMaterialsEditor } from '../components/templates/EnterpriseMaterialsEditor';
import { EnterpriseToolingEditor } from '../components/templates/EnterpriseToolingEditor';
import { EnterpriseComplianceEditor } from '../components/templates/EnterpriseComplianceEditor';

export function AmroEnterpriseTemplatesPage() {
  // Your logic here
  return (
    <div className="space-y-6">
      <EnterpriseMaterialsEditor {...materialsProps} />
      <EnterpriseToolingEditor {...toolingProps} />
      <EnterpriseComplianceEditor {...complianceProps} />
    </div>
  );
}
```

---

## 📊 API Endpoints Used

### Materials API
- `POST /api/v2/amro/materials/search` - Search parts inventory
- Uses existing `parts_inventory` table (enhanced with aviation fields)

### Tooling API
- `POST /api/v2/amro/enterprise/tooling/search` - Search tooling registry
- `GET /api/v2/amro/enterprise/tooling/calibration-due` - Calibration due list
- Uses new `amro_tooling_registry` and `amro_tooling_instances` tables

### Compliance API
- `GET /api/v2/amro/enterprise/compliance/ad-sb-feed` - AD/SB regulatory feed
- `GET /api/v2/amro/enterprise/compliance/fleet-status` - Fleet compliance status
- Uses new `amro_compliance_ad_sb_registry` and `amro_compliance_requirements_enhanced` tables

---

## 🎨 UI Features

### Common Features Across All Editors
- ✅ Smart search dialogs
- ✅ Analytics summary cards
- ✅ Color-coded status indicators
- ✅ Inline editing
- ✅ Add/Remove functionality
- ✅ Empty states with helpful messages
- ✅ Responsive table layouts
- ✅ Loading states

### Materials-Specific
- Stock status badges (In Stock, Low, Out of Stock)
- Cost calculation
- ATA chapter display
- Material group badges

### Tooling-Specific
- Calibration status indicators
- Tool category color coding
- Quantity management
- Manufacturer display

### Compliance-Specific
- Three-tab interface (Requirements, Feed, Analytics)
- Severity level badges (Critical, High, Medium, Low)
- Compliance status dropdowns
- Deadline tracking with overdue alerts
- Days remaining/overdue display
- Analytics tab with compliance rate, effort estimation

---

## 🚀 Next Steps

1. **Choose integration approach** (Option 1 or 2 above)
2. **Add the components** to your Work Package Templates page
3. **Test with real data** from your Supabase database
4. **Verify API endpoints** are working (may need Express service restart)
5. **Customize styling** if needed to match your design system

---

## 🐛 Troubleshooting

### API Returns 404
- Ensure Express service is running: `cd services/amro-api && npm run dev`
- Check routes are registered in `app.ts`
- Verify endpoint paths match `/api/v2/amro/enterprise/*`

### Search Returns No Results
- Check if data exists in database
- Verify search query is not too restrictive
- Check network tab for API errors

### Components Don't Render
- Check imports are correct
- Verify props match expected interfaces
- Check for TypeScript errors

---

## 📝 Data Structures

### MaterialLineItem
```typescript
{
  id: string;
  inventory_id: string;
  part_number: string;
  description: string;
  quantity: number;
  unit_cost: number;
  total_cost: number;
  ata_chapter?: string;
  material_group?: string;
  stock_available?: number;
  is_critical?: boolean;
  notes?: string;
}
```

### ToolingLineItem
```typescript
{
  id: string;
  tool_id: string;
  tool_code: string;
  tool_name: string;
  manufacturer: string;
  tool_category: string;
  quantity_required: number;
  calibration_required: boolean;
  calibration_status?: string;
  notes?: string;
}
```

### ComplianceRequirement
```typescript
{
  id: string;
  ad_sb_id?: string;
  requirement_code: string;
  requirement_type: string;
  directive_number: string;
  regulatory_authority: string;
  title: string;
  description: string;
  compliance_deadline: string;
  compliance_status: 'not_started' | 'in_progress' | 'complied' | 'exempted' | 'deferred';
  severity_level: string;
  safety_impact: boolean;
  grounding_requirement: boolean;
  estimated_labor_hours?: number;
  estimated_material_cost?: number;
  notes?: string;
}
```

---

## ✅ Checklist

- [x] EnterpriseMaterialsEditor created
- [x] EnterpriseToolingEditor created
- [x] EnterpriseComplianceEditor created
- [x] All components use correct API endpoints
- [x] All components integrate with proper database tables
- [ ] Components integrated into Work Package Templates page
- [ ] API endpoints tested and working
- [ ] End-to-end flow tested (search → add → save → load)

---

**Ready for Integration!** 🎉

All three enterprise editors are complete and ready to be integrated into your Work Package Templates management interface.
