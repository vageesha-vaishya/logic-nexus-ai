import{j as e}from"./jsx-runtime-Z5uAzocK.js";import{P as t}from"./PipelineAnalytics-Cr3i39Rf.js";import{m as c}from"./mock-data-i6hjpj77.js";import"./index-pP6CS22B.js";import"./_commonjsHelpers-Cpj98o6Y.js";import"./card-BRH59LJj.js";import"./utils-mOyDzkE6.js";import"./differenceInDays-xBYjgmsl.js";import"./differenceInCalendarDays-DBTEEzZ7.js";import"./constants-DrTc0T0L.js";import"./getTimezoneOffsetInMilliseconds-DY_9x7Xo.js";import"./generateCategoricalChart-CUJPUrbO.js";import"./tiny-invariant-CopsF_GD.js";import"./index-CpCSUgdU.js";import"./BarChart-DtfbwV-5.js";import"./YAxis-6cut2Ze9.js";import"./PieChart-C-QDou4j.js";import"./addDays-B7SrYi78.js";import"./subDays-CUZy8QfG.js";const _={title:"CRM/Analytics Dashboard",component:t,parameters:{layout:"padded"},tags:["autodocs"]},s={args:{leads:c},render:r=>e.jsxs("div",{className:"p-6 bg-slate-50 min-h-screen",children:[e.jsx("h1",{className:"text-2xl font-bold mb-6",children:"Pipeline Analytics"}),e.jsx(t,{...r})]})},a={args:{leads:[]},render:r=>e.jsxs("div",{className:"p-6 bg-slate-50 min-h-screen",children:[e.jsx("h1",{className:"text-2xl font-bold mb-6",children:"Pipeline Analytics (Empty)"}),e.jsx(t,{...r})]})};var i,n,o;s.parameters={...s.parameters,docs:{...(i=s.parameters)==null?void 0:i.docs,source:{originalSource:`{
  args: {
    leads: mockLeads
  },
  render: args => <div className="p-6 bg-slate-50 min-h-screen">
      <h1 className="text-2xl font-bold mb-6">Pipeline Analytics</h1>
      <PipelineAnalytics {...args} />
    </div>
}`,...(o=(n=s.parameters)==null?void 0:n.docs)==null?void 0:o.source}}};var m,l,p;a.parameters={...a.parameters,docs:{...(m=a.parameters)==null?void 0:m.docs,source:{originalSource:`{
  args: {
    leads: []
  },
  render: args => <div className="p-6 bg-slate-50 min-h-screen">
      <h1 className="text-2xl font-bold mb-6">Pipeline Analytics (Empty)</h1>
      <PipelineAnalytics {...args} />
    </div>
}`,...(p=(l=a.parameters)==null?void 0:l.docs)==null?void 0:p.source}}};const C=["Default","EmptyState"];export{s as Default,a as EmptyState,C as __namedExportsOrder,_ as default};
