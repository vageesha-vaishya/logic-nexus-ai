import{j as e,I as n}from"./iframe-CsWugpTQ.js";import{a as m,F as u}from"./FormLayout-iGbGMuL6.js";import{L as a}from"./label-0vt78nj7.js";import{B as x}from"./button-hQwFhXKy.js";import"./preload-helper-C1FmrZbK.js";import"./card-DElVqdz_.js";const b={title:"Forms/FormSection",component:m,parameters:{a11y:{disable:!1}},argTypes:{title:{control:"text",description:"Section title"},description:{control:"text",description:"Section description"},actions:{control:"object",description:"Header actions node"}}},r={args:{title:"Details",description:"Provide information below"},render:p=>e.jsx("div",{className:"p-4",children:e.jsx(m,{...p,children:e.jsxs(u,{columns:2,children:[e.jsxs("div",{className:"space-y-1",children:[e.jsx(a,{children:"Field A"}),e.jsx(n,{placeholder:"Value A"})]}),e.jsxs("div",{className:"space-y-1",children:[e.jsx(a,{children:"Field B"}),e.jsx(n,{placeholder:"Value B"})]})]})})})},s={args:{...r.args,actions:e.jsx(x,{size:"sm",variant:"outline",children:"Action"})},render:r.render};var i,o,t;r.parameters={...r.parameters,docs:{...(i=r.parameters)==null?void 0:i.docs,source:{originalSource:`{
  args: {
    title: "Details",
    description: "Provide information below"
  },
  render: args => <div className="p-4">
      <FormSection {...args}>
        <FormGrid columns={2}>
          <div className="space-y-1">
            <Label>Field A</Label>
            <Input placeholder="Value A" />
          </div>
          <div className="space-y-1">
            <Label>Field B</Label>
            <Input placeholder="Value B" />
          </div>
        </FormGrid>
      </FormSection>
    </div>
}`,...(t=(o=r.parameters)==null?void 0:o.docs)==null?void 0:t.source}}};var c,l,d;s.parameters={...s.parameters,docs:{...(c=s.parameters)==null?void 0:c.docs,source:{originalSource:`{
  args: {
    ...Basic.args,
    actions: <Button size="sm" variant="outline">Action</Button>
  },
  render: Basic.render
}`,...(d=(l=s.parameters)==null?void 0:l.docs)==null?void 0:d.source}}};const f=["Basic","WithActions"];export{r as Basic,s as WithActions,f as __namedExportsOrder,b as default};
