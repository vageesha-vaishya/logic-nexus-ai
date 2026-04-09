import{c as y,R as o,j as e,z as w,B as N,C,D as S}from"./iframe-BA3bigUR.js";import{B as g}from"./badge-D9TJ8RBX.js";import{B as j}from"./button-CbA7afJr.js";import{C as k,a as D,b as R,c as A}from"./card-CStZ5zmI.js";import{A as P}from"./AmroInventoryDataGridTemplate-CYSZUcr6.js";import{b as B,c as d,d as O}from"./amroPartsEnterpriseStoryTemplate-yPioTkv-.js";import{B as T}from"./bell-Bt2CM6gB.js";import{P as z}from"./plus-LC_JnUKm.js";import{C as _}from"./circle-check-8TQDJzXV.js";import"./preload-helper-C1FmrZbK.js";import"./label-D9P-urtt.js";import"./select-tCR7EeRx.js";import"./index-BdQq_4o_.js";import"./index-qkao1V5Z.js";import"./index-M3gPENRQ.js";import"./index-C6ofQxaF.js";import"./chevron-down-Bjk6AhXu.js";import"./check-6KMg7cXL.js";import"./chevron-up-q6yw7oks.js";import"./switch-CNSQvbRa.js";import"./textarea-BrNA5qoz.js";import"./arrow-up-DCVWlWzZ.js";import"./rows-3-CgbrJqjX.js";import"./chevron-left-4UEH2n0y.js";import"./chevron-right-B8SgNuvV.js";import"./grip-vertical-BUIT8cdh.js";import"./trash-2-DPqZeQC6.js";import"./save-BjhEVdwS.js";/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const E=y("ClipboardCheck",[["rect",{width:"8",height:"4",x:"8",y:"2",rx:"1",ry:"1",key:"tgr4d6"}],["path",{d:"M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2",key:"116196"}],["path",{d:"m9 14 2 2 4-4",key:"df797q"}]]),U=Array.from({length:140}).map((r,t)=>({id:`INV-${t+1}`,partNumber:`PN-${1e3+t}`,status:t%9===0?"quarantined":t%4===0?"low_stock":t%3===0?"reserved":"available",quantity:Math.max(0,80-t%41),updatedAt:new Date(2026,t%12,t%28+1).toISOString()})),M=[{key:"id",header:"ID",sortable:!0,filterable:!0,groupable:!0,resizable:!0,dataType:"text",width:130},{key:"partNumber",header:"Part Number",sortable:!0,filterable:!0,groupable:!0,resizable:!0,dataType:"text",width:160},{key:"status",header:"Status",sortable:!0,filterable:!0,groupable:!0,resizable:!0,dataType:"text",width:130},{key:"quantity",header:"Qty",sortable:!0,filterable:!1,resizable:!0,dataType:"numeric",width:100},{key:"updatedAt",header:"Updated",sortable:!0,filterable:!1,resizable:!0,dataType:"date",width:150}],ue={title:"AMRO/Module Layout v2.3/Comparative Prototypes",parameters:{...d,docs:{...d.docs||{},description:{component:O({componentId:"AMRO-MODULE-LAYOUT-V23-PROTOTYPES",ownerTeam:"AMRO UX Architecture",releaseRing:"staging",dataClassification:"internal",approvalPolicy:"architecture_review_required",auditReference:"SCR-AMRO-MODULE-LAYOUT-V23"})}}},decorators:[B],tags:["autodocs","amro","parts","enterprise"]};function l(){return e.jsx(P,{title:"Module Layout v2.3 Prototype",subtitle:"Grid + Record Detail baseline",records:U,columns:M,viewMode:"horizontal-split",scrollBehavior:"virtualization",density:"normal",persistKey:"v23-prototype-grid"})}const s={render:()=>{const[r]=o.useState(Array.from({length:40}).map((t,a)=>({id:`evt-${a+1}`,type:a%3===0?"inventory.updated":a%2===0?"reservation.changed":"checklist.recomputed",ts:new Date(Date.now()-a*35e3).toISOString()})));return e.jsxs("div",{className:"grid min-h-screen gap-4 p-4 lg:grid-cols-[1fr_340px]",children:[e.jsx(l,{}),e.jsxs(k,{className:"h-[min(80vh,760px)]",children:[e.jsx(D,{className:"pb-2",children:e.jsxs(R,{className:"flex items-center gap-2 text-base",children:[e.jsx(T,{className:"h-4 w-4"}),"Event Stream"]})}),e.jsx(A,{className:"h-full overflow-auto space-y-2",children:r.map(t=>e.jsx("div",{className:"rounded border p-2 text-xs",children:e.jsxs("div",{className:"flex items-center justify-between",children:[e.jsx(g,{variant:"outline",children:t.type}),e.jsx("span",{className:"text-muted-foreground",children:new Date(t.ts).toLocaleTimeString()})]})},t.id))})]})]})}},i={render:()=>{const[r,t]=o.useState(!1);return e.jsxs("div",{className:"relative min-h-screen p-4",children:[e.jsx(l,{}),e.jsx(j,{type:"button",size:"icon",className:"fixed bottom-6 right-6 z-40 h-12 w-12 rounded-full shadow-lg","aria-label":"Open CRUD event form",onClick:()=>t(!0),children:e.jsx(z,{className:"h-5 w-5"})}),e.jsx(w,{open:r,onOpenChange:t,children:e.jsxs(N,{side:"right",className:"w-[460px] sm:w-[520px]",children:[e.jsx(C,{children:e.jsx(S,{children:"CRUD Event Form"})}),e.jsxs("div",{className:"mt-4 space-y-3 text-sm text-muted-foreground",children:[e.jsx("p",{children:"Prototype drawer surface for contextual create/update/delete workflows."}),e.jsx("p",{children:"Action payloads are validated before dispatch to Event Stream channel."})]})]})})]})}},n={render:()=>{const[r]=o.useState([{id:"c1",label:"No horizontal scroll on 1366x768",pass:!0},{id:"c2",label:"Sticky CRUD action bar visible",pass:!0},{id:"c3",label:"Restore panel control visible",pass:!0},{id:"c4",label:"Keyboard resize and restore shortcut",pass:!0},{id:"c5",label:"ARIA labels present for icon controls",pass:!0}]),t=r.filter(a=>!a.pass).length;return e.jsxs("div",{className:"min-h-screen p-4",children:[e.jsx("div",{className:"sticky top-2 z-30 mb-3 rounded-md border bg-background/95 p-3 backdrop-blur",children:e.jsxs("div",{className:"flex flex-wrap items-center justify-between gap-2",children:[e.jsxs("div",{className:"flex items-center gap-2",children:[e.jsx(E,{className:"h-4 w-4"}),e.jsx("span",{className:"text-sm font-semibold",children:"Viewport Validation Checklist"}),e.jsx(g,{variant:t?"destructive":"default",children:t?`${t} pending`:"all passed"})]}),e.jsx("div",{className:"flex flex-wrap items-center gap-2 text-xs text-muted-foreground",children:r.map(a=>e.jsxs("span",{className:"inline-flex items-center gap-1",children:[e.jsx(_,{className:`h-3.5 w-3.5 ${a.pass?"text-emerald-500":"text-amber-500"}`}),a.label]},a.id))})]})}),e.jsx(l,{})]})}};var c,p,m;s.parameters={...s.parameters,docs:{...(c=s.parameters)==null?void 0:c.docs,source:{originalSource:`{
  render: () => {
    const [events] = React.useState(Array.from({
      length: 40
    }).map((_, idx) => ({
      id: \`evt-\${idx + 1}\`,
      type: idx % 3 === 0 ? 'inventory.updated' : idx % 2 === 0 ? 'reservation.changed' : 'checklist.recomputed',
      ts: new Date(Date.now() - idx * 35_000).toISOString()
    })));
    return <div className="grid min-h-screen gap-4 p-4 lg:grid-cols-[1fr_340px]">
        <BaseGrid />
        <Card className="h-[min(80vh,760px)]">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Bell className="h-4 w-4" />
              Event Stream
            </CardTitle>
          </CardHeader>
          <CardContent className="h-full overflow-auto space-y-2">
            {events.map(event => <div key={event.id} className="rounded border p-2 text-xs">
                <div className="flex items-center justify-between">
                  <Badge variant="outline">{event.type}</Badge>
                  <span className="text-muted-foreground">{new Date(event.ts).toLocaleTimeString()}</span>
                </div>
              </div>)}
          </CardContent>
        </Card>
      </div>;
  }
}`,...(m=(p=s.parameters)==null?void 0:p.docs)==null?void 0:m.source}}};var u,h,x;i.parameters={...i.parameters,docs:{...(u=i.parameters)==null?void 0:u.docs,source:{originalSource:`{
  render: () => {
    const [open, setOpen] = React.useState(false);
    return <div className="relative min-h-screen p-4">
        <BaseGrid />
        <Button type="button" size="icon" className="fixed bottom-6 right-6 z-40 h-12 w-12 rounded-full shadow-lg" aria-label="Open CRUD event form" onClick={() => setOpen(true)}>
          <Plus className="h-5 w-5" />
        </Button>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent side="right" className="w-[460px] sm:w-[520px]">
            <SheetHeader>
              <SheetTitle>CRUD Event Form</SheetTitle>
            </SheetHeader>
            <div className="mt-4 space-y-3 text-sm text-muted-foreground">
              <p>Prototype drawer surface for contextual create/update/delete workflows.</p>
              <p>Action payloads are validated before dispatch to Event Stream channel.</p>
            </div>
          </SheetContent>
        </Sheet>
      </div>;
  }
}`,...(x=(h=i.parameters)==null?void 0:h.docs)==null?void 0:x.source}}};var b,v,f;n.parameters={...n.parameters,docs:{...(b=n.parameters)==null?void 0:b.docs,source:{originalSource:`{
  render: () => {
    const [checks] = React.useState([{
      id: 'c1',
      label: 'No horizontal scroll on 1366x768',
      pass: true
    }, {
      id: 'c2',
      label: 'Sticky CRUD action bar visible',
      pass: true
    }, {
      id: 'c3',
      label: 'Restore panel control visible',
      pass: true
    }, {
      id: 'c4',
      label: 'Keyboard resize and restore shortcut',
      pass: true
    }, {
      id: 'c5',
      label: 'ARIA labels present for icon controls',
      pass: true
    }]);
    const pending = checks.filter(item => !item.pass).length;
    return <div className="min-h-screen p-4">
        <div className="sticky top-2 z-30 mb-3 rounded-md border bg-background/95 p-3 backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4" />
              <span className="text-sm font-semibold">Viewport Validation Checklist</span>
              <Badge variant={pending ? 'destructive' : 'default'}>
                {pending ? \`\${pending} pending\` : 'all passed'}
              </Badge>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {checks.map(item => <span key={item.id} className="inline-flex items-center gap-1">
                  <CheckCircle2 className={\`h-3.5 w-3.5 \${item.pass ? 'text-emerald-500' : 'text-amber-500'}\`} />
                  {item.label}
                </span>)}
            </div>
          </div>
        </div>
        <BaseGrid />
      </div>;
  }
}`,...(f=(v=n.parameters)==null?void 0:v.docs)==null?void 0:f.source}}};const he=["PrototypeA_EventStreamSidePanel","PrototypeB_CRUDFabAndDrawer","PrototypeC_ViewportChecklistBanner"];export{s as PrototypeA_EventStreamSidePanel,i as PrototypeB_CRUDFabAndDrawer,n as PrototypeC_ViewportChecklistBanner,he as __namedExportsOrder,ue as default};
