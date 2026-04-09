import{j as e}from"./iframe-BA3bigUR.js";import{B as t}from"./button-CbA7afJr.js";import{a as h,A as f,b as S}from"./AmroPartsUiStandards-cfqU8858.js";import"./preload-helper-C1FmrZbK.js";import"./badge-D9TJ8RBX.js";import"./card-CStZ5zmI.js";import"./search-hqmg7tQb.js";import"./filter-Cv-fmr1e.js";import"./sliders-horizontal-CWf4QNQ8.js";const w={title:"AMRO/Parts/UI Standards",parameters:{layout:"fullscreen",design:{type:"figma",url:"https://www.figma.com/file/AMRO-PARTS-NAVIGATION/AMRO-Parts-Navigation-System"}}},r={render:()=>e.jsx("div",{className:"p-4",children:e.jsx(f,{title:"Stock Ledger",subtitle:"Unified module surface template",moduleId:"inventory-core.stock-ledger",status:"ready",children:e.jsx("p",{className:"text-sm text-muted-foreground",children:"Use this shell for all AMRO Parts module panels."})})})},a={render:()=>e.jsx("div",{className:"p-4",children:e.jsx(S,{searchValue:"hydraulic",onSearchChange:()=>{},leftActions:e.jsx(t,{size:"sm",className:"h-8",children:"Save View"}),rightActions:e.jsx(t,{variant:"outline",size:"sm",className:"h-8",children:"Export"}),placeholder:"Search parts, references, notes..."})})},s={render:()=>e.jsx("div",{className:"p-4",children:e.jsx(h,{items:[{label:"Total Items",value:"420"},{label:"Low Stock",value:"12",tone:"warning"},{label:"Ready for Issue",value:"108",tone:"success"}]})})};var o,l,d;r.parameters={...r.parameters,docs:{...(o=r.parameters)==null?void 0:o.docs,source:{originalSource:`{
  render: () => <div className="p-4">
      <AmroModuleSurface title="Stock Ledger" subtitle="Unified module surface template" moduleId="inventory-core.stock-ledger" status="ready">
        <p className="text-sm text-muted-foreground">Use this shell for all AMRO Parts module panels.</p>
      </AmroModuleSurface>
    </div>
}`,...(d=(l=r.parameters)==null?void 0:l.docs)==null?void 0:d.source}}};var i,n,c;a.parameters={...a.parameters,docs:{...(i=a.parameters)==null?void 0:i.docs,source:{originalSource:`{
  render: () => <div className="p-4">
      <AmroStandardToolbar searchValue="hydraulic" onSearchChange={() => undefined} leftActions={<Button size="sm" className="h-8">Save View</Button>} rightActions={<Button variant="outline" size="sm" className="h-8">Export</Button>} placeholder="Search parts, references, notes..." />
    </div>
}`,...(c=(n=a.parameters)==null?void 0:n.docs)==null?void 0:c.source}}};var m,u,p;s.parameters={...s.parameters,docs:{...(m=s.parameters)==null?void 0:m.docs,source:{originalSource:`{
  render: () => <div className="p-4">
      <AmroKpiGrid items={[{
      label: 'Total Items',
      value: '420'
    }, {
      label: 'Low Stock',
      value: '12',
      tone: 'warning'
    }, {
      label: 'Ready for Issue',
      value: '108',
      tone: 'success'
    }]} />
    </div>
}`,...(p=(u=s.parameters)==null?void 0:u.docs)==null?void 0:p.source}}};const I=["ModuleSurface","StandardToolbar","KpiGrid"];export{s as KpiGrid,r as ModuleSurface,a as StandardToolbar,I as __namedExportsOrder,w as default};
