import{j as o}from"./iframe-CsWugpTQ.js";import{B as D}from"./badge-CieB6EZu.js";import{U as H}from"./UimStandardFormTemplate-BTR7-8Nh.js";import"./preload-helper-C1FmrZbK.js";import"./alert-Fk3RaEnb.js";import"./card-DElVqdz_.js";import"./button-hQwFhXKy.js";import"./dropdown-menu-DS66NQQn.js";import"./index-BMNU2nVA.js";import"./index-lk_7jC7R.js";import"./check-CREjJjm4.js";import"./chevron-right-gZLE9Dpm.js";import"./table-CwdJlCEK.js";import"./chevron-up-Bu-ihN1g.js";import"./chevron-down-KegWGprN.js";import"./chevrons-up-down-CYGPMSC2.js";import"./select-Bos0K022.js";import"./index-BdQq_4o_.js";import"./index-DutRtgoX.js";import"./search-BUAN7JnB.js";import"./arrow-up-down-fUW5vfvh.js";import"./arrow-up-t6BYoJdo.js";import"./sliders-horizontal-BcKRI8gt.js";import"./refresh-ccw-BHRAc9mE.js";import"./download-BUwnyLdH.js";import"./circle-alert-C3SUhW_I.js";function e(p){return p.map(a=>({key:a,header:a.replace(/_/g," ").replace(/\b\w/g,y=>y.toUpperCase()),sortable:!0,render:y=>{const s=(y.payload||{})[a];return s==null||s===""?"-":String(s)}}))}function t(p,a){return{id:p,updated_at:a.updated_at||"2026-04-05T00:00:00.000Z",payload:a}}const fe={title:"UIM/Templates/UimStandardFormTemplate",component:H,parameters:{layout:"padded"},args:{moduleTitle:"UIM Template",moduleDescription:"Standardized form/list template for UIM modules",moduleKey:"template",mode:"edit",state:"ready",statusBadge:"Canonical",breadcrumbs:["UIM","Template"],validation:{status:"ok",messages:[]},formSlot:o.jsx("div",{className:"text-sm",children:"Form fields slot"}),sidePanelSlot:o.jsx(D,{variant:"outline",children:"Activity / Side Panel"}),list:{records:[],total:0,columns:[],exportFileName:"uim-template.csv",defaultVisibleColumnKeys:[],showFieldSelector:!0,statusOptions:[{value:"all",label:"All"},{value:"active",label:"Active"},{value:"pending",label:"Pending"}]}},argTypes:{mode:{control:"inline-radio",options:["create","edit","readonly"]},state:{control:"inline-radio",options:["ready","loading","empty","error"]},validation:{control:"object"},list:{control:"object"}}},r={args:{moduleTitle:"UIM Overview",moduleKey:"overview",list:{records:[t("ov-1",{module_name:"Universal Inventory Management",owner_email:"owner@logicnexus.ai",rollout_phase:"phase_4",target_go_live_date:"2026-05-15",status:"active",updated_at:"2026-04-05T11:00:00.000Z"})],total:1,columns:e(["module_name","owner_email","rollout_phase","target_go_live_date","status","updated_at"]),exportFileName:"uim-overview.csv",defaultVisibleColumnKeys:["module_name","owner_email","rollout_phase","target_go_live_date","status","updated_at"],showFieldSelector:!0}}},n={args:{moduleTitle:"UIM Item Master",moduleKey:"item-master",list:{records:[t("im-1",{sku:"UIM-MRO-000101",part_number:"MRO-PN-70000101",item_name:"Fuel Pump",category:"rotable",status:"active",updated_at:"2026-04-05T11:05:00.000Z"})],total:1,columns:e(["sku","part_number","item_name","category","status","updated_at","manufacturer_name"]),exportFileName:"uim-item-master.csv",defaultVisibleColumnKeys:["sku","part_number","item_name","category","status","updated_at"],showFieldSelector:!0}}},i={args:{moduleTitle:"UIM Stock Ledger",moduleKey:"stock-ledger",list:{records:[t("sl-1",{item_id:"inv-1001",transaction_type:"RECEIVE",quantity_delta:"12",referenced_module:"procurement",status:"posted",updated_at:"2026-04-05T11:10:00.000Z"})],total:1,columns:e(["item_id","transaction_type","quantity_delta","referenced_module","status","updated_at"]),exportFileName:"uim-stock-ledger.csv",defaultVisibleColumnKeys:["item_id","transaction_type","quantity_delta","referenced_module","status","updated_at"],showFieldSelector:!0}}},l={args:{moduleTitle:"UIM Reservations",moduleKey:"reservations",list:{records:[t("rsv-1",{reservation_token:"RSV-900001",item_id:"inv-1001",requested_quantity:"2",reservation_status:"active",expected_use_date:"2026-04-12",updated_at:"2026-04-05T11:15:00.000Z"})],total:1,columns:e(["reservation_token","item_id","requested_quantity","reservation_status","expected_use_date","updated_at"]),exportFileName:"uim-reservations.csv",defaultVisibleColumnKeys:["reservation_token","item_id","requested_quantity","reservation_status","expected_use_date","updated_at"],showFieldSelector:!0}}},d={args:{moduleTitle:"UIM Issue & Consume",moduleKey:"issue-consume",list:{records:[t("ic-1",{item_id:"inv-1002",transaction_type:"CONSUME",quantity_delta:"1",reference:"WO-7781",status:"posted",updated_at:"2026-04-05T11:20:00.000Z"})],total:1,columns:e(["item_id","transaction_type","quantity_delta","reference","status","updated_at"]),exportFileName:"uim-issue-consume.csv",defaultVisibleColumnKeys:["item_id","transaction_type","quantity_delta","reference","status","updated_at"],showFieldSelector:!0}}},u={args:{moduleTitle:"UIM Restock",moduleKey:"restock",list:{records:[t("rs-1",{item_id:"inv-1003",transaction_type:"RECEIVE",quantity_delta:"8",reference:"PO-5588",status:"posted",updated_at:"2026-04-05T11:25:00.000Z"})],total:1,columns:e(["item_id","transaction_type","quantity_delta","reference","status","updated_at"]),exportFileName:"uim-restock.csv",defaultVisibleColumnKeys:["item_id","transaction_type","quantity_delta","reference","status","updated_at"],showFieldSelector:!0}}},m={args:{moduleTitle:"UIM Locations",moduleKey:"locations",list:{records:[t("loc-1",{location_code:"HGR-MAIN",location_name:"Hangar Main Stores",location_type:"warehouse",quantity:"188",status:"available",updated_at:"2026-04-05T11:30:00.000Z"})],total:1,columns:e(["location_code","location_name","location_type","quantity","status","updated_at"]),exportFileName:"uim-locations.csv",defaultVisibleColumnKeys:["location_code","location_name","location_type","quantity","status","updated_at"],showFieldSelector:!0}}},c={args:{moduleTitle:"UIM Analytics",moduleKey:"analytics",list:{records:[t("an-1",{report_name:"Inventory Snapshot",metric_group:"inventory_health",catalog_items:"900",inventory_items:"900",projection_snapshots:"900",updated_at:"2026-04-05T11:35:00.000Z"})],total:1,columns:e(["report_name","metric_group","catalog_items","inventory_items","projection_snapshots","updated_at"]),exportFileName:"uim-analytics.csv",defaultVisibleColumnKeys:["report_name","metric_group","catalog_items","inventory_items","projection_snapshots","updated_at"],showFieldSelector:!0}}},_={args:{moduleTitle:"UIM Form Standard Contract",moduleKey:"contract",state:"ready",validation:{status:"warning",messages:["Default visible fields must include exactly 6 business-critical columns.","Field selector must allow users to add/remove extra columns."]},formSlot:o.jsxs("div",{className:"space-y-2 text-sm",children:[o.jsxs("div",{children:[o.jsx("strong",{children:"Contract Rule:"})," No module-level layout forks."]}),o.jsx("div",{children:"Use config to define fields, defaults, status options, and validation states."})]}),list:{records:[t("contract-1",{rule_id:"STD-001",rule_name:"Six default business fields",owner:"UIM Architecture",compliance:"required",status:"active",updated_at:"2026-04-05T11:40:00.000Z"})],total:1,columns:e(["rule_id","rule_name","owner","compliance","status","updated_at"]),exportFileName:"uim-form-standard-contract.csv",defaultVisibleColumnKeys:["rule_id","rule_name","owner","compliance","status","updated_at"],showFieldSelector:!0}}};var v,g,f;r.parameters={...r.parameters,docs:{...(v=r.parameters)==null?void 0:v.docs,source:{originalSource:`{
  args: {
    moduleTitle: 'UIM Overview',
    moduleKey: 'overview',
    list: {
      records: [makeRecord('ov-1', {
        module_name: 'Universal Inventory Management',
        owner_email: 'owner@logicnexus.ai',
        rollout_phase: 'phase_4',
        target_go_live_date: '2026-05-15',
        status: 'active',
        updated_at: '2026-04-05T11:00:00.000Z'
      })],
      total: 1,
      columns: makeColumns(['module_name', 'owner_email', 'rollout_phase', 'target_go_live_date', 'status', 'updated_at']),
      exportFileName: 'uim-overview.csv',
      defaultVisibleColumnKeys: ['module_name', 'owner_email', 'rollout_phase', 'target_go_live_date', 'status', 'updated_at'],
      showFieldSelector: true
    }
  }
}`,...(f=(g=r.parameters)==null?void 0:g.docs)==null?void 0:f.source}}};var M,S,h;n.parameters={...n.parameters,docs:{...(M=n.parameters)==null?void 0:M.docs,source:{originalSource:`{
  args: {
    moduleTitle: 'UIM Item Master',
    moduleKey: 'item-master',
    list: {
      records: [makeRecord('im-1', {
        sku: 'UIM-MRO-000101',
        part_number: 'MRO-PN-70000101',
        item_name: 'Fuel Pump',
        category: 'rotable',
        status: 'active',
        updated_at: '2026-04-05T11:05:00.000Z'
      })],
      total: 1,
      columns: makeColumns(['sku', 'part_number', 'item_name', 'category', 'status', 'updated_at', 'manufacturer_name']),
      exportFileName: 'uim-item-master.csv',
      defaultVisibleColumnKeys: ['sku', 'part_number', 'item_name', 'category', 'status', 'updated_at'],
      showFieldSelector: true
    }
  }
}`,...(h=(S=n.parameters)==null?void 0:S.docs)==null?void 0:h.source}}};var k,F,w;i.parameters={...i.parameters,docs:{...(k=i.parameters)==null?void 0:k.docs,source:{originalSource:`{
  args: {
    moduleTitle: 'UIM Stock Ledger',
    moduleKey: 'stock-ledger',
    list: {
      records: [makeRecord('sl-1', {
        item_id: 'inv-1001',
        transaction_type: 'RECEIVE',
        quantity_delta: '12',
        referenced_module: 'procurement',
        status: 'posted',
        updated_at: '2026-04-05T11:10:00.000Z'
      })],
      total: 1,
      columns: makeColumns(['item_id', 'transaction_type', 'quantity_delta', 'referenced_module', 'status', 'updated_at']),
      exportFileName: 'uim-stock-ledger.csv',
      defaultVisibleColumnKeys: ['item_id', 'transaction_type', 'quantity_delta', 'referenced_module', 'status', 'updated_at'],
      showFieldSelector: true
    }
  }
}`,...(w=(F=i.parameters)==null?void 0:F.docs)==null?void 0:w.source}}};var C,x,T;l.parameters={...l.parameters,docs:{...(C=l.parameters)==null?void 0:C.docs,source:{originalSource:`{
  args: {
    moduleTitle: 'UIM Reservations',
    moduleKey: 'reservations',
    list: {
      records: [makeRecord('rsv-1', {
        reservation_token: 'RSV-900001',
        item_id: 'inv-1001',
        requested_quantity: '2',
        reservation_status: 'active',
        expected_use_date: '2026-04-12',
        updated_at: '2026-04-05T11:15:00.000Z'
      })],
      total: 1,
      columns: makeColumns(['reservation_token', 'item_id', 'requested_quantity', 'reservation_status', 'expected_use_date', 'updated_at']),
      exportFileName: 'uim-reservations.csv',
      defaultVisibleColumnKeys: ['reservation_token', 'item_id', 'requested_quantity', 'reservation_status', 'expected_use_date', 'updated_at'],
      showFieldSelector: true
    }
  }
}`,...(T=(x=l.parameters)==null?void 0:x.docs)==null?void 0:T.source}}};var b,I,q;d.parameters={...d.parameters,docs:{...(b=d.parameters)==null?void 0:b.docs,source:{originalSource:`{
  args: {
    moduleTitle: 'UIM Issue & Consume',
    moduleKey: 'issue-consume',
    list: {
      records: [makeRecord('ic-1', {
        item_id: 'inv-1002',
        transaction_type: 'CONSUME',
        quantity_delta: '1',
        reference: 'WO-7781',
        status: 'posted',
        updated_at: '2026-04-05T11:20:00.000Z'
      })],
      total: 1,
      columns: makeColumns(['item_id', 'transaction_type', 'quantity_delta', 'reference', 'status', 'updated_at']),
      exportFileName: 'uim-issue-consume.csv',
      defaultVisibleColumnKeys: ['item_id', 'transaction_type', 'quantity_delta', 'reference', 'status', 'updated_at'],
      showFieldSelector: true
    }
  }
}`,...(q=(I=d.parameters)==null?void 0:I.docs)==null?void 0:q.source}}};var K,U,R;u.parameters={...u.parameters,docs:{...(K=u.parameters)==null?void 0:K.docs,source:{originalSource:`{
  args: {
    moduleTitle: 'UIM Restock',
    moduleKey: 'restock',
    list: {
      records: [makeRecord('rs-1', {
        item_id: 'inv-1003',
        transaction_type: 'RECEIVE',
        quantity_delta: '8',
        reference: 'PO-5588',
        status: 'posted',
        updated_at: '2026-04-05T11:25:00.000Z'
      })],
      total: 1,
      columns: makeColumns(['item_id', 'transaction_type', 'quantity_delta', 'reference', 'status', 'updated_at']),
      exportFileName: 'uim-restock.csv',
      defaultVisibleColumnKeys: ['item_id', 'transaction_type', 'quantity_delta', 'reference', 'status', 'updated_at'],
      showFieldSelector: true
    }
  }
}`,...(R=(U=u.parameters)==null?void 0:U.docs)==null?void 0:R.source}}};var N,V,Z;m.parameters={...m.parameters,docs:{...(N=m.parameters)==null?void 0:N.docs,source:{originalSource:`{
  args: {
    moduleTitle: 'UIM Locations',
    moduleKey: 'locations',
    list: {
      records: [makeRecord('loc-1', {
        location_code: 'HGR-MAIN',
        location_name: 'Hangar Main Stores',
        location_type: 'warehouse',
        quantity: '188',
        status: 'available',
        updated_at: '2026-04-05T11:30:00.000Z'
      })],
      total: 1,
      columns: makeColumns(['location_code', 'location_name', 'location_type', 'quantity', 'status', 'updated_at']),
      exportFileName: 'uim-locations.csv',
      defaultVisibleColumnKeys: ['location_code', 'location_name', 'location_type', 'quantity', 'status', 'updated_at'],
      showFieldSelector: true
    }
  }
}`,...(Z=(V=m.parameters)==null?void 0:V.docs)==null?void 0:Z.source}}};var j,E,O;c.parameters={...c.parameters,docs:{...(j=c.parameters)==null?void 0:j.docs,source:{originalSource:`{
  args: {
    moduleTitle: 'UIM Analytics',
    moduleKey: 'analytics',
    list: {
      records: [makeRecord('an-1', {
        report_name: 'Inventory Snapshot',
        metric_group: 'inventory_health',
        catalog_items: '900',
        inventory_items: '900',
        projection_snapshots: '900',
        updated_at: '2026-04-05T11:35:00.000Z'
      })],
      total: 1,
      columns: makeColumns(['report_name', 'metric_group', 'catalog_items', 'inventory_items', 'projection_snapshots', 'updated_at']),
      exportFileName: 'uim-analytics.csv',
      defaultVisibleColumnKeys: ['report_name', 'metric_group', 'catalog_items', 'inventory_items', 'projection_snapshots', 'updated_at'],
      showFieldSelector: true
    }
  }
}`,...(O=(E=c.parameters)==null?void 0:E.docs)==null?void 0:O.source}}};var A,P,L;_.parameters={..._.parameters,docs:{...(A=_.parameters)==null?void 0:A.docs,source:{originalSource:`{
  args: {
    moduleTitle: 'UIM Form Standard Contract',
    moduleKey: 'contract',
    state: 'ready',
    validation: {
      status: 'warning',
      messages: ['Default visible fields must include exactly 6 business-critical columns.', 'Field selector must allow users to add/remove extra columns.']
    },
    formSlot: <div className="space-y-2 text-sm">
        <div><strong>Contract Rule:</strong> No module-level layout forks.</div>
        <div>Use config to define fields, defaults, status options, and validation states.</div>
      </div>,
    list: {
      records: [makeRecord('contract-1', {
        rule_id: 'STD-001',
        rule_name: 'Six default business fields',
        owner: 'UIM Architecture',
        compliance: 'required',
        status: 'active',
        updated_at: '2026-04-05T11:40:00.000Z'
      })],
      total: 1,
      columns: makeColumns(['rule_id', 'rule_name', 'owner', 'compliance', 'status', 'updated_at']),
      exportFileName: 'uim-form-standard-contract.csv',
      defaultVisibleColumnKeys: ['rule_id', 'rule_name', 'owner', 'compliance', 'status', 'updated_at'],
      showFieldSelector: true
    }
  }
}`,...(L=(P=_.parameters)==null?void 0:P.docs)==null?void 0:L.source}}};const Me=["OverviewModule","ItemMasterModule","StockLedgerModule","ReservationsModule","IssueConsumeModule","RestockModule","LocationsModule","AnalyticsModule","FormStandardContract"];export{c as AnalyticsModule,_ as FormStandardContract,d as IssueConsumeModule,n as ItemMasterModule,m as LocationsModule,r as OverviewModule,l as ReservationsModule,u as RestockModule,i as StockLedgerModule,Me as __namedExportsOrder,fe as default};
