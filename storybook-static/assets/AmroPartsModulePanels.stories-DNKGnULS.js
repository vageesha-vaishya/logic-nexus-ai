import{r as s,j as e}from"./iframe-BA3bigUR.js";import{B as K}from"./badge-D9TJ8RBX.js";import{b as U,c as H,T as u,d as l,e as Q,a as i}from"./table-Cr9AVkuC.js";import{c as $,g as B}from"./mockPartsInventoryData-Bqi8Qb1u.js";import{A as m,a as o}from"./AmroPartsUiStandards-cfqU8858.js";import"./preload-helper-C1FmrZbK.js";import"./chevron-up-q6yw7oks.js";import"./chevron-down-Bjk6AhXu.js";import"./chevrons-up-down-DUAo3Ada.js";import"./button-CbA7afJr.js";import"./card-CStZ5zmI.js";import"./search-hqmg7tQb.js";import"./filter-Cv-fmr1e.js";import"./sliders-horizontal-CWf4QNQ8.js";function q(n){return new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0}).format(n||0)}function T({records:n}){const a=s.useMemo(()=>n.filter(r=>r.quantity_reserved>0),[n]);return e.jsx(m,{title:"Reservations",subtitle:"Reserved stock by part and warehouse location.",moduleId:"operations.reservations",children:e.jsxs("div",{className:"space-y-3",children:[e.jsx(o,{items:[{label:"Reserved Records",value:String(a.length)}]}),e.jsx("p",{className:"text-xs text-muted-foreground",children:"Reserved stock by part and warehouse location."}),e.jsx("div",{className:"overflow-x-auto rounded-md border",children:e.jsxs(U,{children:[e.jsx(H,{children:e.jsxs(u,{children:[e.jsx(l,{children:"Part"}),e.jsx(l,{children:"Location"}),e.jsx(l,{children:"Reserved"}),e.jsx(l,{children:"Available"})]})}),e.jsx(Q,{children:a.length===0?e.jsx(u,{children:e.jsx(i,{colSpan:4,className:"text-muted-foreground",children:"No reservations found."})}):a.map(r=>e.jsxs(u,{children:[e.jsx(i,{children:r.part_number}),e.jsx(i,{children:r.warehouse_location}),e.jsx(i,{children:r.quantity_reserved}),e.jsx(i,{children:r.quantity_available})]},`reservation-${r.id}`))})]})})]})})}function L({records:n}){const a=s.useMemo(()=>n.filter(r=>r.quantity_available>0).sort((r,t)=>t.quantity_available-r.quantity_available).slice(0,12),[n]);return e.jsx(m,{title:"Issue & Consume",subtitle:"Operational queue for issue/consume-ready inventory lots.",moduleId:"operations.issue-consume",children:e.jsxs("div",{className:"space-y-3",children:[e.jsx(o,{items:[{label:"Ready Candidates",value:String(a.length),tone:"success"}]}),e.jsx("p",{className:"text-xs text-muted-foreground",children:"Operational queue for issue/consume-ready inventory lots."}),e.jsx("div",{className:"grid grid-cols-1 gap-2 md:grid-cols-2",children:a.length===0?e.jsx("p",{className:"text-sm text-muted-foreground",children:"No available inventory to issue."}):a.map(r=>e.jsxs("div",{className:"rounded-md border p-3 text-xs",children:[e.jsxs("div",{className:"mb-1 flex items-center justify-between gap-2",children:[e.jsx("p",{className:"font-semibold",children:r.part_number}),e.jsx(K,{variant:"outline",children:r.item_type})]}),e.jsx("p",{className:"text-muted-foreground",children:r.description}),e.jsxs("p",{className:"mt-1",children:["Available: ",e.jsx("span",{className:"font-semibold",children:r.quantity_available})]}),e.jsxs("p",{className:"text-muted-foreground",children:["Location: ",r.warehouse_location]})]},`issue-${r.id}`))})]})})}function M({records:n}){const a=s.useMemo(()=>n.filter(r=>r.quantity_available<=r.reorder_level||r.status==="low_stock").sort((r,t)=>r.quantity_available-t.quantity_available),[n]);return e.jsx(m,{title:"Restock",subtitle:"Auto-prioritized replenishment list based on reorder thresholds.",moduleId:"operations.restock",children:e.jsxs("div",{className:"space-y-3",children:[e.jsx(o,{items:[{label:"Low Stock Items",value:String(a.length),tone:a.length>0?"warning":"success"}]}),e.jsx("p",{className:"text-xs text-muted-foreground",children:"Auto-prioritized replenishment list based on reorder thresholds."}),e.jsx("div",{className:"overflow-x-auto rounded-md border",children:e.jsxs(U,{children:[e.jsx(H,{children:e.jsxs(u,{children:[e.jsx(l,{children:"Part"}),e.jsx(l,{children:"Available"}),e.jsx(l,{children:"Reorder Level"}),e.jsx(l,{children:"Reorder Qty"})]})}),e.jsx(Q,{children:a.length===0?e.jsx(u,{children:e.jsx(i,{colSpan:4,className:"text-muted-foreground",children:"No restock actions required."})}):a.map(r=>e.jsxs(u,{children:[e.jsx(i,{children:r.part_number}),e.jsx(i,{children:r.quantity_available}),e.jsx(i,{children:r.reorder_level}),e.jsx(i,{children:r.reorder_quantity})]},`restock-${r.id}`))})]})})]})})}function D({records:n}){const a=s.useMemo(()=>{const r=new Map;for(const t of n){const c=t.warehouse_location||"UNASSIGNED",b=r.get(c)||{count:0,value:0};b.count+=1,b.value+=t.quantity_on_hand*t.unit_cost,r.set(c,b)}return Array.from(r.entries()).sort((t,c)=>t[0].localeCompare(c[0]))},[n]);return e.jsx(m,{title:"Locations",subtitle:"Location-level inventory density and value distribution.",moduleId:"operations.locations",children:e.jsxs("div",{className:"space-y-3",children:[e.jsx(o,{items:[{label:"Active Locations",value:String(a.length)}]}),e.jsx("p",{className:"text-xs text-muted-foreground",children:"Location-level inventory density and value distribution."}),e.jsx("div",{className:"grid grid-cols-1 gap-2 md:grid-cols-3",children:a.map(([r,t])=>e.jsxs("div",{className:"rounded-md border p-3 text-xs",children:[e.jsx("p",{className:"font-semibold",children:r}),e.jsxs("p",{className:"text-muted-foreground",children:["Distinct SKUs: ",t.count]}),e.jsxs("p",{className:"text-muted-foreground",children:["Inventory Value: ",q(t.value)]})]},`location-${r}`))})]})})}function E({records:n}){const a=s.useMemo(()=>$(n),[n]);return e.jsx(m,{title:"Analytics",subtitle:"KPI snapshot for inventory health, reservation pressure, and value exposure.",moduleId:"insights.analytics",children:e.jsxs("div",{className:"space-y-3",children:[e.jsx(o,{items:[{label:"Total Items",value:String(a.totalItems)},{label:"Low Stock",value:String(a.lowStockItems),tone:a.lowStockItems>0?"warning":"success"},{label:"Inventory Value",value:q(a.inventoryValue)}]}),e.jsx("p",{className:"text-xs text-muted-foreground",children:"KPI snapshot for inventory health, reservation pressure, and value exposure."}),e.jsxs("div",{className:"grid grid-cols-2 gap-2 text-sm md:grid-cols-3",children:[e.jsxs("div",{className:"rounded-md border p-2",children:["Total Items: ",a.totalItems]}),e.jsxs("div",{className:"rounded-md border p-2",children:["Low Stock: ",a.lowStockItems]}),e.jsxs("div",{className:"rounded-md border p-2",children:["Reserved: ",a.reservedItems]}),e.jsxs("div",{className:"rounded-md border p-2",children:["Quarantine: ",a.quarantineItems]}),e.jsxs("div",{className:"rounded-md border p-2",children:["Critical: ",a.criticalItems]}),e.jsxs("div",{className:"rounded-md border p-2",children:["Inventory Value: ",q(a.inventoryValue)]})]})]})})}T.__docgenInfo={description:"",methods:[],displayName:"ReservationsPanel",props:{records:{required:!0,tsType:{name:"Array",elements:[{name:"signature",type:"object",raw:`{
  id: string;
  part_number: string;
  serial_number: string | null;
  description: string;
  lifecycle_status?: 'serviceable' | 'inspection_due' | 'needs_repair' | 'repair_in_progress' | 'ready_for_install' | 'replaced' | 'retired' | 'quarantined';
  item_type: PartItemType;
  ata_chapter: string;
  warehouse_location: string;
  quantity_on_hand: number;
  quantity_reserved: number;
  quantity_available: number;
  reorder_level: number;
  reorder_quantity: number;
  min_serviceable_qty: number;
  status: PartInventoryStatus;
  criticality: PartCriticality;
  supplier_name: string;
  unit_cost: number;
  currency: string;
  certification_expiry_date: string | null;
  expiry_date: string | null;
  updated_at: string;
  metadata: {
    barcode_value: string;
    rfid_tag: string;
    condition_code: 'SV' | 'AR' | 'INSP' | 'OH' | 'SCRAP' | 'QUAR';
    aog_priority: boolean;
    tags: string[];
    item_master_id?: string;
    item_master_part_number?: string;
    linkage_source?: string;
    linked_at?: string;
  };
}`,signature:{properties:[{key:"id",value:{name:"string",required:!0}},{key:"part_number",value:{name:"string",required:!0}},{key:"serial_number",value:{name:"union",raw:"string | null",elements:[{name:"string"},{name:"null"}],required:!0}},{key:"description",value:{name:"string",required:!0}},{key:"lifecycle_status",value:{name:"union",raw:"'serviceable' | 'inspection_due' | 'needs_repair' | 'repair_in_progress' | 'ready_for_install' | 'replaced' | 'retired' | 'quarantined'",elements:[{name:"literal",value:"'serviceable'"},{name:"literal",value:"'inspection_due'"},{name:"literal",value:"'needs_repair'"},{name:"literal",value:"'repair_in_progress'"},{name:"literal",value:"'ready_for_install'"},{name:"literal",value:"'replaced'"},{name:"literal",value:"'retired'"},{name:"literal",value:"'quarantined'"}],required:!1}},{key:"item_type",value:{name:"union",raw:"'part' | 'consumable' | 'tool' | 'equipment'",elements:[{name:"literal",value:"'part'"},{name:"literal",value:"'consumable'"},{name:"literal",value:"'tool'"},{name:"literal",value:"'equipment'"}],required:!0}},{key:"ata_chapter",value:{name:"string",required:!0}},{key:"warehouse_location",value:{name:"string",required:!0}},{key:"quantity_on_hand",value:{name:"number",required:!0}},{key:"quantity_reserved",value:{name:"number",required:!0}},{key:"quantity_available",value:{name:"number",required:!0}},{key:"reorder_level",value:{name:"number",required:!0}},{key:"reorder_quantity",value:{name:"number",required:!0}},{key:"min_serviceable_qty",value:{name:"number",required:!0}},{key:"status",value:{name:"union",raw:"'available' | 'low_stock' | 'reserved' | 'quarantined' | 'unserviceable'",elements:[{name:"literal",value:"'available'"},{name:"literal",value:"'low_stock'"},{name:"literal",value:"'reserved'"},{name:"literal",value:"'quarantined'"},{name:"literal",value:"'unserviceable'"}],required:!0}},{key:"criticality",value:{name:"union",raw:"'critical' | 'high' | 'normal' | 'low'",elements:[{name:"literal",value:"'critical'"},{name:"literal",value:"'high'"},{name:"literal",value:"'normal'"},{name:"literal",value:"'low'"}],required:!0}},{key:"supplier_name",value:{name:"string",required:!0}},{key:"unit_cost",value:{name:"number",required:!0}},{key:"currency",value:{name:"string",required:!0}},{key:"certification_expiry_date",value:{name:"union",raw:"string | null",elements:[{name:"string"},{name:"null"}],required:!0}},{key:"expiry_date",value:{name:"union",raw:"string | null",elements:[{name:"string"},{name:"null"}],required:!0}},{key:"updated_at",value:{name:"string",required:!0}},{key:"metadata",value:{name:"signature",type:"object",raw:`{
  barcode_value: string;
  rfid_tag: string;
  condition_code: 'SV' | 'AR' | 'INSP' | 'OH' | 'SCRAP' | 'QUAR';
  aog_priority: boolean;
  tags: string[];
  item_master_id?: string;
  item_master_part_number?: string;
  linkage_source?: string;
  linked_at?: string;
}`,signature:{properties:[{key:"barcode_value",value:{name:"string",required:!0}},{key:"rfid_tag",value:{name:"string",required:!0}},{key:"condition_code",value:{name:"union",raw:"'SV' | 'AR' | 'INSP' | 'OH' | 'SCRAP' | 'QUAR'",elements:[{name:"literal",value:"'SV'"},{name:"literal",value:"'AR'"},{name:"literal",value:"'INSP'"},{name:"literal",value:"'OH'"},{name:"literal",value:"'SCRAP'"},{name:"literal",value:"'QUAR'"}],required:!0}},{key:"aog_priority",value:{name:"boolean",required:!0}},{key:"tags",value:{name:"Array",elements:[{name:"string"}],raw:"string[]",required:!0}},{key:"item_master_id",value:{name:"string",required:!1}},{key:"item_master_part_number",value:{name:"string",required:!1}},{key:"linkage_source",value:{name:"string",required:!1}},{key:"linked_at",value:{name:"string",required:!1}}]},required:!0}}]}}],raw:"PartInventoryRecord[]"},description:""}}};L.__docgenInfo={description:"",methods:[],displayName:"IssueConsumePanel",props:{records:{required:!0,tsType:{name:"Array",elements:[{name:"signature",type:"object",raw:`{
  id: string;
  part_number: string;
  serial_number: string | null;
  description: string;
  lifecycle_status?: 'serviceable' | 'inspection_due' | 'needs_repair' | 'repair_in_progress' | 'ready_for_install' | 'replaced' | 'retired' | 'quarantined';
  item_type: PartItemType;
  ata_chapter: string;
  warehouse_location: string;
  quantity_on_hand: number;
  quantity_reserved: number;
  quantity_available: number;
  reorder_level: number;
  reorder_quantity: number;
  min_serviceable_qty: number;
  status: PartInventoryStatus;
  criticality: PartCriticality;
  supplier_name: string;
  unit_cost: number;
  currency: string;
  certification_expiry_date: string | null;
  expiry_date: string | null;
  updated_at: string;
  metadata: {
    barcode_value: string;
    rfid_tag: string;
    condition_code: 'SV' | 'AR' | 'INSP' | 'OH' | 'SCRAP' | 'QUAR';
    aog_priority: boolean;
    tags: string[];
    item_master_id?: string;
    item_master_part_number?: string;
    linkage_source?: string;
    linked_at?: string;
  };
}`,signature:{properties:[{key:"id",value:{name:"string",required:!0}},{key:"part_number",value:{name:"string",required:!0}},{key:"serial_number",value:{name:"union",raw:"string | null",elements:[{name:"string"},{name:"null"}],required:!0}},{key:"description",value:{name:"string",required:!0}},{key:"lifecycle_status",value:{name:"union",raw:"'serviceable' | 'inspection_due' | 'needs_repair' | 'repair_in_progress' | 'ready_for_install' | 'replaced' | 'retired' | 'quarantined'",elements:[{name:"literal",value:"'serviceable'"},{name:"literal",value:"'inspection_due'"},{name:"literal",value:"'needs_repair'"},{name:"literal",value:"'repair_in_progress'"},{name:"literal",value:"'ready_for_install'"},{name:"literal",value:"'replaced'"},{name:"literal",value:"'retired'"},{name:"literal",value:"'quarantined'"}],required:!1}},{key:"item_type",value:{name:"union",raw:"'part' | 'consumable' | 'tool' | 'equipment'",elements:[{name:"literal",value:"'part'"},{name:"literal",value:"'consumable'"},{name:"literal",value:"'tool'"},{name:"literal",value:"'equipment'"}],required:!0}},{key:"ata_chapter",value:{name:"string",required:!0}},{key:"warehouse_location",value:{name:"string",required:!0}},{key:"quantity_on_hand",value:{name:"number",required:!0}},{key:"quantity_reserved",value:{name:"number",required:!0}},{key:"quantity_available",value:{name:"number",required:!0}},{key:"reorder_level",value:{name:"number",required:!0}},{key:"reorder_quantity",value:{name:"number",required:!0}},{key:"min_serviceable_qty",value:{name:"number",required:!0}},{key:"status",value:{name:"union",raw:"'available' | 'low_stock' | 'reserved' | 'quarantined' | 'unserviceable'",elements:[{name:"literal",value:"'available'"},{name:"literal",value:"'low_stock'"},{name:"literal",value:"'reserved'"},{name:"literal",value:"'quarantined'"},{name:"literal",value:"'unserviceable'"}],required:!0}},{key:"criticality",value:{name:"union",raw:"'critical' | 'high' | 'normal' | 'low'",elements:[{name:"literal",value:"'critical'"},{name:"literal",value:"'high'"},{name:"literal",value:"'normal'"},{name:"literal",value:"'low'"}],required:!0}},{key:"supplier_name",value:{name:"string",required:!0}},{key:"unit_cost",value:{name:"number",required:!0}},{key:"currency",value:{name:"string",required:!0}},{key:"certification_expiry_date",value:{name:"union",raw:"string | null",elements:[{name:"string"},{name:"null"}],required:!0}},{key:"expiry_date",value:{name:"union",raw:"string | null",elements:[{name:"string"},{name:"null"}],required:!0}},{key:"updated_at",value:{name:"string",required:!0}},{key:"metadata",value:{name:"signature",type:"object",raw:`{
  barcode_value: string;
  rfid_tag: string;
  condition_code: 'SV' | 'AR' | 'INSP' | 'OH' | 'SCRAP' | 'QUAR';
  aog_priority: boolean;
  tags: string[];
  item_master_id?: string;
  item_master_part_number?: string;
  linkage_source?: string;
  linked_at?: string;
}`,signature:{properties:[{key:"barcode_value",value:{name:"string",required:!0}},{key:"rfid_tag",value:{name:"string",required:!0}},{key:"condition_code",value:{name:"union",raw:"'SV' | 'AR' | 'INSP' | 'OH' | 'SCRAP' | 'QUAR'",elements:[{name:"literal",value:"'SV'"},{name:"literal",value:"'AR'"},{name:"literal",value:"'INSP'"},{name:"literal",value:"'OH'"},{name:"literal",value:"'SCRAP'"},{name:"literal",value:"'QUAR'"}],required:!0}},{key:"aog_priority",value:{name:"boolean",required:!0}},{key:"tags",value:{name:"Array",elements:[{name:"string"}],raw:"string[]",required:!0}},{key:"item_master_id",value:{name:"string",required:!1}},{key:"item_master_part_number",value:{name:"string",required:!1}},{key:"linkage_source",value:{name:"string",required:!1}},{key:"linked_at",value:{name:"string",required:!1}}]},required:!0}}]}}],raw:"PartInventoryRecord[]"},description:""}}};M.__docgenInfo={description:"",methods:[],displayName:"RestockPanel",props:{records:{required:!0,tsType:{name:"Array",elements:[{name:"signature",type:"object",raw:`{
  id: string;
  part_number: string;
  serial_number: string | null;
  description: string;
  lifecycle_status?: 'serviceable' | 'inspection_due' | 'needs_repair' | 'repair_in_progress' | 'ready_for_install' | 'replaced' | 'retired' | 'quarantined';
  item_type: PartItemType;
  ata_chapter: string;
  warehouse_location: string;
  quantity_on_hand: number;
  quantity_reserved: number;
  quantity_available: number;
  reorder_level: number;
  reorder_quantity: number;
  min_serviceable_qty: number;
  status: PartInventoryStatus;
  criticality: PartCriticality;
  supplier_name: string;
  unit_cost: number;
  currency: string;
  certification_expiry_date: string | null;
  expiry_date: string | null;
  updated_at: string;
  metadata: {
    barcode_value: string;
    rfid_tag: string;
    condition_code: 'SV' | 'AR' | 'INSP' | 'OH' | 'SCRAP' | 'QUAR';
    aog_priority: boolean;
    tags: string[];
    item_master_id?: string;
    item_master_part_number?: string;
    linkage_source?: string;
    linked_at?: string;
  };
}`,signature:{properties:[{key:"id",value:{name:"string",required:!0}},{key:"part_number",value:{name:"string",required:!0}},{key:"serial_number",value:{name:"union",raw:"string | null",elements:[{name:"string"},{name:"null"}],required:!0}},{key:"description",value:{name:"string",required:!0}},{key:"lifecycle_status",value:{name:"union",raw:"'serviceable' | 'inspection_due' | 'needs_repair' | 'repair_in_progress' | 'ready_for_install' | 'replaced' | 'retired' | 'quarantined'",elements:[{name:"literal",value:"'serviceable'"},{name:"literal",value:"'inspection_due'"},{name:"literal",value:"'needs_repair'"},{name:"literal",value:"'repair_in_progress'"},{name:"literal",value:"'ready_for_install'"},{name:"literal",value:"'replaced'"},{name:"literal",value:"'retired'"},{name:"literal",value:"'quarantined'"}],required:!1}},{key:"item_type",value:{name:"union",raw:"'part' | 'consumable' | 'tool' | 'equipment'",elements:[{name:"literal",value:"'part'"},{name:"literal",value:"'consumable'"},{name:"literal",value:"'tool'"},{name:"literal",value:"'equipment'"}],required:!0}},{key:"ata_chapter",value:{name:"string",required:!0}},{key:"warehouse_location",value:{name:"string",required:!0}},{key:"quantity_on_hand",value:{name:"number",required:!0}},{key:"quantity_reserved",value:{name:"number",required:!0}},{key:"quantity_available",value:{name:"number",required:!0}},{key:"reorder_level",value:{name:"number",required:!0}},{key:"reorder_quantity",value:{name:"number",required:!0}},{key:"min_serviceable_qty",value:{name:"number",required:!0}},{key:"status",value:{name:"union",raw:"'available' | 'low_stock' | 'reserved' | 'quarantined' | 'unserviceable'",elements:[{name:"literal",value:"'available'"},{name:"literal",value:"'low_stock'"},{name:"literal",value:"'reserved'"},{name:"literal",value:"'quarantined'"},{name:"literal",value:"'unserviceable'"}],required:!0}},{key:"criticality",value:{name:"union",raw:"'critical' | 'high' | 'normal' | 'low'",elements:[{name:"literal",value:"'critical'"},{name:"literal",value:"'high'"},{name:"literal",value:"'normal'"},{name:"literal",value:"'low'"}],required:!0}},{key:"supplier_name",value:{name:"string",required:!0}},{key:"unit_cost",value:{name:"number",required:!0}},{key:"currency",value:{name:"string",required:!0}},{key:"certification_expiry_date",value:{name:"union",raw:"string | null",elements:[{name:"string"},{name:"null"}],required:!0}},{key:"expiry_date",value:{name:"union",raw:"string | null",elements:[{name:"string"},{name:"null"}],required:!0}},{key:"updated_at",value:{name:"string",required:!0}},{key:"metadata",value:{name:"signature",type:"object",raw:`{
  barcode_value: string;
  rfid_tag: string;
  condition_code: 'SV' | 'AR' | 'INSP' | 'OH' | 'SCRAP' | 'QUAR';
  aog_priority: boolean;
  tags: string[];
  item_master_id?: string;
  item_master_part_number?: string;
  linkage_source?: string;
  linked_at?: string;
}`,signature:{properties:[{key:"barcode_value",value:{name:"string",required:!0}},{key:"rfid_tag",value:{name:"string",required:!0}},{key:"condition_code",value:{name:"union",raw:"'SV' | 'AR' | 'INSP' | 'OH' | 'SCRAP' | 'QUAR'",elements:[{name:"literal",value:"'SV'"},{name:"literal",value:"'AR'"},{name:"literal",value:"'INSP'"},{name:"literal",value:"'OH'"},{name:"literal",value:"'SCRAP'"},{name:"literal",value:"'QUAR'"}],required:!0}},{key:"aog_priority",value:{name:"boolean",required:!0}},{key:"tags",value:{name:"Array",elements:[{name:"string"}],raw:"string[]",required:!0}},{key:"item_master_id",value:{name:"string",required:!1}},{key:"item_master_part_number",value:{name:"string",required:!1}},{key:"linkage_source",value:{name:"string",required:!1}},{key:"linked_at",value:{name:"string",required:!1}}]},required:!0}}]}}],raw:"PartInventoryRecord[]"},description:""}}};D.__docgenInfo={description:"",methods:[],displayName:"LocationsPanel",props:{records:{required:!0,tsType:{name:"Array",elements:[{name:"signature",type:"object",raw:`{
  id: string;
  part_number: string;
  serial_number: string | null;
  description: string;
  lifecycle_status?: 'serviceable' | 'inspection_due' | 'needs_repair' | 'repair_in_progress' | 'ready_for_install' | 'replaced' | 'retired' | 'quarantined';
  item_type: PartItemType;
  ata_chapter: string;
  warehouse_location: string;
  quantity_on_hand: number;
  quantity_reserved: number;
  quantity_available: number;
  reorder_level: number;
  reorder_quantity: number;
  min_serviceable_qty: number;
  status: PartInventoryStatus;
  criticality: PartCriticality;
  supplier_name: string;
  unit_cost: number;
  currency: string;
  certification_expiry_date: string | null;
  expiry_date: string | null;
  updated_at: string;
  metadata: {
    barcode_value: string;
    rfid_tag: string;
    condition_code: 'SV' | 'AR' | 'INSP' | 'OH' | 'SCRAP' | 'QUAR';
    aog_priority: boolean;
    tags: string[];
    item_master_id?: string;
    item_master_part_number?: string;
    linkage_source?: string;
    linked_at?: string;
  };
}`,signature:{properties:[{key:"id",value:{name:"string",required:!0}},{key:"part_number",value:{name:"string",required:!0}},{key:"serial_number",value:{name:"union",raw:"string | null",elements:[{name:"string"},{name:"null"}],required:!0}},{key:"description",value:{name:"string",required:!0}},{key:"lifecycle_status",value:{name:"union",raw:"'serviceable' | 'inspection_due' | 'needs_repair' | 'repair_in_progress' | 'ready_for_install' | 'replaced' | 'retired' | 'quarantined'",elements:[{name:"literal",value:"'serviceable'"},{name:"literal",value:"'inspection_due'"},{name:"literal",value:"'needs_repair'"},{name:"literal",value:"'repair_in_progress'"},{name:"literal",value:"'ready_for_install'"},{name:"literal",value:"'replaced'"},{name:"literal",value:"'retired'"},{name:"literal",value:"'quarantined'"}],required:!1}},{key:"item_type",value:{name:"union",raw:"'part' | 'consumable' | 'tool' | 'equipment'",elements:[{name:"literal",value:"'part'"},{name:"literal",value:"'consumable'"},{name:"literal",value:"'tool'"},{name:"literal",value:"'equipment'"}],required:!0}},{key:"ata_chapter",value:{name:"string",required:!0}},{key:"warehouse_location",value:{name:"string",required:!0}},{key:"quantity_on_hand",value:{name:"number",required:!0}},{key:"quantity_reserved",value:{name:"number",required:!0}},{key:"quantity_available",value:{name:"number",required:!0}},{key:"reorder_level",value:{name:"number",required:!0}},{key:"reorder_quantity",value:{name:"number",required:!0}},{key:"min_serviceable_qty",value:{name:"number",required:!0}},{key:"status",value:{name:"union",raw:"'available' | 'low_stock' | 'reserved' | 'quarantined' | 'unserviceable'",elements:[{name:"literal",value:"'available'"},{name:"literal",value:"'low_stock'"},{name:"literal",value:"'reserved'"},{name:"literal",value:"'quarantined'"},{name:"literal",value:"'unserviceable'"}],required:!0}},{key:"criticality",value:{name:"union",raw:"'critical' | 'high' | 'normal' | 'low'",elements:[{name:"literal",value:"'critical'"},{name:"literal",value:"'high'"},{name:"literal",value:"'normal'"},{name:"literal",value:"'low'"}],required:!0}},{key:"supplier_name",value:{name:"string",required:!0}},{key:"unit_cost",value:{name:"number",required:!0}},{key:"currency",value:{name:"string",required:!0}},{key:"certification_expiry_date",value:{name:"union",raw:"string | null",elements:[{name:"string"},{name:"null"}],required:!0}},{key:"expiry_date",value:{name:"union",raw:"string | null",elements:[{name:"string"},{name:"null"}],required:!0}},{key:"updated_at",value:{name:"string",required:!0}},{key:"metadata",value:{name:"signature",type:"object",raw:`{
  barcode_value: string;
  rfid_tag: string;
  condition_code: 'SV' | 'AR' | 'INSP' | 'OH' | 'SCRAP' | 'QUAR';
  aog_priority: boolean;
  tags: string[];
  item_master_id?: string;
  item_master_part_number?: string;
  linkage_source?: string;
  linked_at?: string;
}`,signature:{properties:[{key:"barcode_value",value:{name:"string",required:!0}},{key:"rfid_tag",value:{name:"string",required:!0}},{key:"condition_code",value:{name:"union",raw:"'SV' | 'AR' | 'INSP' | 'OH' | 'SCRAP' | 'QUAR'",elements:[{name:"literal",value:"'SV'"},{name:"literal",value:"'AR'"},{name:"literal",value:"'INSP'"},{name:"literal",value:"'OH'"},{name:"literal",value:"'SCRAP'"},{name:"literal",value:"'QUAR'"}],required:!0}},{key:"aog_priority",value:{name:"boolean",required:!0}},{key:"tags",value:{name:"Array",elements:[{name:"string"}],raw:"string[]",required:!0}},{key:"item_master_id",value:{name:"string",required:!1}},{key:"item_master_part_number",value:{name:"string",required:!1}},{key:"linkage_source",value:{name:"string",required:!1}},{key:"linked_at",value:{name:"string",required:!1}}]},required:!0}}]}}],raw:"PartInventoryRecord[]"},description:""}}};E.__docgenInfo={description:"",methods:[],displayName:"AnalyticsPanel",props:{records:{required:!0,tsType:{name:"Array",elements:[{name:"signature",type:"object",raw:`{
  id: string;
  part_number: string;
  serial_number: string | null;
  description: string;
  lifecycle_status?: 'serviceable' | 'inspection_due' | 'needs_repair' | 'repair_in_progress' | 'ready_for_install' | 'replaced' | 'retired' | 'quarantined';
  item_type: PartItemType;
  ata_chapter: string;
  warehouse_location: string;
  quantity_on_hand: number;
  quantity_reserved: number;
  quantity_available: number;
  reorder_level: number;
  reorder_quantity: number;
  min_serviceable_qty: number;
  status: PartInventoryStatus;
  criticality: PartCriticality;
  supplier_name: string;
  unit_cost: number;
  currency: string;
  certification_expiry_date: string | null;
  expiry_date: string | null;
  updated_at: string;
  metadata: {
    barcode_value: string;
    rfid_tag: string;
    condition_code: 'SV' | 'AR' | 'INSP' | 'OH' | 'SCRAP' | 'QUAR';
    aog_priority: boolean;
    tags: string[];
    item_master_id?: string;
    item_master_part_number?: string;
    linkage_source?: string;
    linked_at?: string;
  };
}`,signature:{properties:[{key:"id",value:{name:"string",required:!0}},{key:"part_number",value:{name:"string",required:!0}},{key:"serial_number",value:{name:"union",raw:"string | null",elements:[{name:"string"},{name:"null"}],required:!0}},{key:"description",value:{name:"string",required:!0}},{key:"lifecycle_status",value:{name:"union",raw:"'serviceable' | 'inspection_due' | 'needs_repair' | 'repair_in_progress' | 'ready_for_install' | 'replaced' | 'retired' | 'quarantined'",elements:[{name:"literal",value:"'serviceable'"},{name:"literal",value:"'inspection_due'"},{name:"literal",value:"'needs_repair'"},{name:"literal",value:"'repair_in_progress'"},{name:"literal",value:"'ready_for_install'"},{name:"literal",value:"'replaced'"},{name:"literal",value:"'retired'"},{name:"literal",value:"'quarantined'"}],required:!1}},{key:"item_type",value:{name:"union",raw:"'part' | 'consumable' | 'tool' | 'equipment'",elements:[{name:"literal",value:"'part'"},{name:"literal",value:"'consumable'"},{name:"literal",value:"'tool'"},{name:"literal",value:"'equipment'"}],required:!0}},{key:"ata_chapter",value:{name:"string",required:!0}},{key:"warehouse_location",value:{name:"string",required:!0}},{key:"quantity_on_hand",value:{name:"number",required:!0}},{key:"quantity_reserved",value:{name:"number",required:!0}},{key:"quantity_available",value:{name:"number",required:!0}},{key:"reorder_level",value:{name:"number",required:!0}},{key:"reorder_quantity",value:{name:"number",required:!0}},{key:"min_serviceable_qty",value:{name:"number",required:!0}},{key:"status",value:{name:"union",raw:"'available' | 'low_stock' | 'reserved' | 'quarantined' | 'unserviceable'",elements:[{name:"literal",value:"'available'"},{name:"literal",value:"'low_stock'"},{name:"literal",value:"'reserved'"},{name:"literal",value:"'quarantined'"},{name:"literal",value:"'unserviceable'"}],required:!0}},{key:"criticality",value:{name:"union",raw:"'critical' | 'high' | 'normal' | 'low'",elements:[{name:"literal",value:"'critical'"},{name:"literal",value:"'high'"},{name:"literal",value:"'normal'"},{name:"literal",value:"'low'"}],required:!0}},{key:"supplier_name",value:{name:"string",required:!0}},{key:"unit_cost",value:{name:"number",required:!0}},{key:"currency",value:{name:"string",required:!0}},{key:"certification_expiry_date",value:{name:"union",raw:"string | null",elements:[{name:"string"},{name:"null"}],required:!0}},{key:"expiry_date",value:{name:"union",raw:"string | null",elements:[{name:"string"},{name:"null"}],required:!0}},{key:"updated_at",value:{name:"string",required:!0}},{key:"metadata",value:{name:"signature",type:"object",raw:`{
  barcode_value: string;
  rfid_tag: string;
  condition_code: 'SV' | 'AR' | 'INSP' | 'OH' | 'SCRAP' | 'QUAR';
  aog_priority: boolean;
  tags: string[];
  item_master_id?: string;
  item_master_part_number?: string;
  linkage_source?: string;
  linked_at?: string;
}`,signature:{properties:[{key:"barcode_value",value:{name:"string",required:!0}},{key:"rfid_tag",value:{name:"string",required:!0}},{key:"condition_code",value:{name:"union",raw:"'SV' | 'AR' | 'INSP' | 'OH' | 'SCRAP' | 'QUAR'",elements:[{name:"literal",value:"'SV'"},{name:"literal",value:"'AR'"},{name:"literal",value:"'INSP'"},{name:"literal",value:"'OH'"},{name:"literal",value:"'SCRAP'"},{name:"literal",value:"'QUAR'"}],required:!0}},{key:"aog_priority",value:{name:"boolean",required:!0}},{key:"tags",value:{name:"Array",elements:[{name:"string"}],raw:"string[]",required:!0}},{key:"item_master_id",value:{name:"string",required:!1}},{key:"item_master_part_number",value:{name:"string",required:!1}},{key:"linkage_source",value:{name:"string",required:!1}},{key:"linked_at",value:{name:"string",required:!1}}]},required:!0}}]}}],raw:"PartInventoryRecord[]"},description:""}}};const d=B({seed:424242,count:32}),le={title:"AMRO/Parts/Operational Panels",parameters:{layout:"padded"}},_={render:()=>e.jsx(T,{records:d})},v={render:()=>e.jsx(L,{records:d})},y={render:()=>e.jsx(M,{records:d})},g={render:()=>e.jsx(D,{records:d})},p={render:()=>e.jsx(E,{records:d})};var k,h,x;_.parameters={..._.parameters,docs:{...(k=_.parameters)==null?void 0:k.docs,source:{originalSource:`{
  render: () => <ReservationsPanel records={records} />
}`,...(x=(h=_.parameters)==null?void 0:h.docs)==null?void 0:x.source}}};var f,w,j;v.parameters={...v.parameters,docs:{...(f=v.parameters)==null?void 0:f.docs,source:{originalSource:`{
  render: () => <IssueConsumePanel records={records} />
}`,...(j=(w=v.parameters)==null?void 0:w.docs)==null?void 0:j.source}}};var S,A,R;y.parameters={...y.parameters,docs:{...(S=y.parameters)==null?void 0:S.docs,source:{originalSource:`{
  render: () => <RestockPanel records={records} />
}`,...(R=(A=y.parameters)==null?void 0:A.docs)==null?void 0:R.source}}};var P,I,N;g.parameters={...g.parameters,docs:{...(P=g.parameters)==null?void 0:P.docs,source:{originalSource:`{
  render: () => <LocationsPanel records={records} />
}`,...(N=(I=g.parameters)==null?void 0:I.docs)==null?void 0:N.source}}};var C,O,V;p.parameters={...p.parameters,docs:{...(C=p.parameters)==null?void 0:C.docs,source:{originalSource:`{
  render: () => <AnalyticsPanel records={records} />
}`,...(V=(O=p.parameters)==null?void 0:O.docs)==null?void 0:V.source}}};const ue=["Reservations","IssueAndConsume","Restock","Locations","Analytics"];export{p as Analytics,v as IssueAndConsume,g as Locations,_ as Reservations,y as Restock,ue as __namedExportsOrder,le as default};
