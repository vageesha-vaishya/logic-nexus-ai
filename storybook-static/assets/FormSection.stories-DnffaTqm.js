import{j as e}from"./jsx-runtime-DF2Pcvd1.js";import{a as m,F as u,L as i}from"./label-CvlwLwVJ.js";import{I as o}from"./input-DQrLB-hL.js";import{B as x}from"./button-Cpm3eO9b.js";import"./index-B2-qRKKC.js";import"./_commonjsHelpers-Cpj98o6Y.js";import"./card-DDgMyP-I.js";import"./utils-CytzSlOG.js";import"./index-BmZbFD_3.js";import"./index-CFX93qP1.js";import"./index-Bh3JKd2m.js";const L={title:"Forms/FormSection",component:m,parameters:{a11y:{disable:!1}},argTypes:{title:{control:"text",description:"Section title"},description:{control:"text",description:"Section description"},actions:{control:"object",description:"Header actions node"}}},r={args:{title:"Details",description:"Provide information below"},render:p=>e.jsx("div",{className:"p-4",children:e.jsx(m,{...p,children:e.jsxs(u,{columns:2,children:[e.jsxs("div",{className:"space-y-1",children:[e.jsx(i,{children:"Field A"}),e.jsx(o,{placeholder:"Value A"})]}),e.jsxs("div",{className:"space-y-1",children:[e.jsx(i,{children:"Field B"}),e.jsx(o,{placeholder:"Value B"})]})]})})})},s={args:{...r.args,actions:e.jsx(x,{size:"sm",variant:"outline",children:"Action"})},render:r.render};var n,a,t;r.parameters={...r.parameters,docs:{...(n=r.parameters)==null?void 0:n.docs,source:{originalSource:`{
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
}`,...(t=(a=r.parameters)==null?void 0:a.docs)==null?void 0:t.source}}};var c,l,d;s.parameters={...s.parameters,docs:{...(c=s.parameters)==null?void 0:c.docs,source:{originalSource:`{
  args: {
    ...Basic.args,
    actions: <Button size="sm" variant="outline">Action</Button>
  },
  render: Basic.render
}`,...(d=(l=s.parameters)==null?void 0:l.docs)==null?void 0:d.source}}};const N=["Basic","WithActions"];export{r as Basic,s as WithActions,N as __namedExportsOrder,L as default};
