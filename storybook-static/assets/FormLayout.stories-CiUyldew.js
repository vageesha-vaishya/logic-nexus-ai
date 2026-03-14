import{j as e}from"./jsx-runtime-Z5uAzocK.js";import{F as o,a as u,b as n}from"./FormLayout-oyGXQSLB.js";import{I as a}from"./input-CNzcFKnn.js";import{L as r}from"./label-2DaX8R5k.js";import{S as j,a as I,b as F,c as S,d as s}from"./select-Cd8M99ts.js";import{B as m}from"./button-_friVzh6.js";import"./index-pP6CS22B.js";import"./_commonjsHelpers-Cpj98o6Y.js";import"./card-DV47ztDp.js";import"./utils-CytzSlOG.js";import"./index-B1bLLDhJ.js";import"./index-DLHbBEj9.js";import"./index-DXxPFvzQ.js";import"./index-7TLWIpSA.js";import"./index-DW48STyt.js";import"./index-DHumPsSE.js";import"./index-CuDmVINA.js";import"./Combination-FaLM8ji1.js";import"./index-DSMx10ar.js";import"./tslib.es6-CmEaCU22.js";import"./index-CiCgAmAg.js";import"./index-D9SpBz_a.js";import"./index-BO9nGImx.js";import"./createLucideIcon-DEP7aKU9.js";import"./index-DLuVoU5X.js";import"./index-WyfESzTi.js";import"./chevron-up-DGrNAj5y.js";const J={title:"Forms/FormLayout",component:o,parameters:{layout:"padded"},tags:["autodocs"]},t={render:()=>e.jsx(u,{title:"Complex Entity Form",description:"Example of a complex form with mixed column spans",className:"max-w-4xl",children:e.jsxs(o,{columns:4,children:[e.jsxs(n,{span:2,children:[e.jsx(r,{children:"Status"}),e.jsxs(j,{children:[e.jsx(I,{children:e.jsx(F,{placeholder:"...Enter status"})}),e.jsxs(S,{children:[e.jsx(s,{value:"active",children:"Active"}),e.jsx(s,{value:"inactive",children:"Inactive"})]})]})]}),e.jsxs(n,{span:2,children:[e.jsx(r,{children:"Tax ID"}),e.jsx(a,{placeholder:"...Enter tax id"})]}),e.jsxs(n,{span:4,children:[e.jsx(r,{children:"Organization Name"}),e.jsx(a,{placeholder:"...Enter organization name"})]}),e.jsxs(n,{span:4,children:[e.jsx(r,{children:"Full Address"}),e.jsx(a,{defaultValue:"Main St, Suite 100 123"})]}),e.jsxs(n,{span:1,children:[e.jsx(r,{children:"Country"}),e.jsx(a,{placeholder:"...Enter country"})]}),e.jsxs(n,{span:1,children:[e.jsx(r,{children:"Zip Code"}),e.jsx(a,{placeholder:"...Enter zip code"})]}),e.jsxs(n,{span:1,children:[e.jsx(r,{children:"State"}),e.jsx(a,{placeholder:"...Enter state"})]}),e.jsxs(n,{span:1,children:[e.jsx(r,{children:"City"}),e.jsx(a,{placeholder:"...Enter city"})]}),e.jsx(n,{span:4,className:"p-4 bg-muted rounded-md border border-dashed text-center text-muted-foreground",children:"Full width section (span 4)"}),e.jsxs(n,{span:2,children:[e.jsx(r,{children:"Email"}),e.jsx(a,{placeholder:"...Enter email"})]}),e.jsxs(n,{span:2,children:[e.jsx(r,{children:"Contact Person"}),e.jsx(a,{placeholder:"...Enter contact person"})]}),e.jsx(n,{span:4,className:"flex justify-end pt-4",children:e.jsxs("div",{className:"flex gap-2",children:[e.jsx(m,{variant:"outline",children:"Cancel"}),e.jsx(m,{children:"Save Changes"})]})})]})})},l={render:()=>e.jsxs(o,{columns:4,children:[e.jsxs(n,{span:1,children:[e.jsx(r,{children:"Column 1"}),e.jsx(a,{placeholder:"Span 1"})]}),e.jsxs(n,{span:1,children:[e.jsx(r,{children:"Column 2"}),e.jsx(a,{placeholder:"Span 1"})]}),e.jsxs(n,{span:1,children:[e.jsx(r,{children:"Column 3"}),e.jsx(a,{placeholder:"Span 1"})]}),e.jsxs(n,{span:1,children:[e.jsx(r,{children:"Column 4"}),e.jsx(a,{placeholder:"Span 1"})]}),e.jsxs(n,{span:2,children:[e.jsx(r,{children:"Span 2"}),e.jsx(a,{placeholder:"Span 2"})]}),e.jsxs(n,{span:2,children:[e.jsx(r,{children:"Span 2"}),e.jsx(a,{placeholder:"Span 2"})]}),e.jsxs(n,{span:3,children:[e.jsx(r,{children:"Span 3"}),e.jsx(a,{placeholder:"Span 3"})]}),e.jsxs(n,{span:1,children:[e.jsx(r,{children:"Span 1"}),e.jsx(a,{placeholder:"Span 1"})]}),e.jsxs(n,{span:4,children:[e.jsx(r,{children:"Span 4 (Full Width)"}),e.jsx(a,{placeholder:"Span 4"})]})]})};var p,c,i;t.parameters={...t.parameters,docs:{...(p=t.parameters)==null?void 0:p.docs,source:{originalSource:`{
  render: () => <FormSection title="Complex Entity Form" description="Example of a complex form with mixed column spans" className="max-w-4xl">
      <FormGrid columns={4}>
        <FormItem span={2}>
          <Label>Status</Label>
          <Select>
            <SelectTrigger>
              <SelectValue placeholder="...Enter status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </FormItem>
        <FormItem span={2}>
          <Label>Tax ID</Label>
          <Input placeholder="...Enter tax id" />
        </FormItem>

        <FormItem span={4}>
          <Label>Organization Name</Label>
          <Input placeholder="...Enter organization name" />
        </FormItem>

        <FormItem span={4}>
          <Label>Full Address</Label>
          <Input defaultValue="Main St, Suite 100 123" />
        </FormItem>

        <FormItem span={1}>
          <Label>Country</Label>
          <Input placeholder="...Enter country" />
        </FormItem>
        <FormItem span={1}>
          <Label>Zip Code</Label>
          <Input placeholder="...Enter zip code" />
        </FormItem>
        <FormItem span={1}>
          <Label>State</Label>
          <Input placeholder="...Enter state" />
        </FormItem>
        <FormItem span={1}>
          <Label>City</Label>
          <Input placeholder="...Enter city" />
        </FormItem>

        <FormItem span={4} className="p-4 bg-muted rounded-md border border-dashed text-center text-muted-foreground">
          Full width section (span 4)
        </FormItem>

        <FormItem span={2}>
          <Label>Email</Label>
          <Input placeholder="...Enter email" />
        </FormItem>
        <FormItem span={2}>
          <Label>Contact Person</Label>
          <Input placeholder="...Enter contact person" />
        </FormItem>
        
        <FormItem span={4} className="flex justify-end pt-4">
          <div className="flex gap-2">
            <Button variant="outline">Cancel</Button>
            <Button>Save Changes</Button>
          </div>
        </FormItem>
      </FormGrid>
    </FormSection>
}`,...(i=(c=t.parameters)==null?void 0:c.docs)==null?void 0:i.source}}};var d,x,h;l.parameters={...l.parameters,docs:{...(d=l.parameters)==null?void 0:d.docs,source:{originalSource:`{
  render: () => <FormGrid columns={4}>
      <FormItem span={1}>
        <Label>Column 1</Label>
        <Input placeholder="Span 1" />
      </FormItem>
      <FormItem span={1}>
        <Label>Column 2</Label>
        <Input placeholder="Span 1" />
      </FormItem>
      <FormItem span={1}>
        <Label>Column 3</Label>
        <Input placeholder="Span 1" />
      </FormItem>
      <FormItem span={1}>
        <Label>Column 4</Label>
        <Input placeholder="Span 1" />
      </FormItem>
      
      <FormItem span={2}>
        <Label>Span 2</Label>
        <Input placeholder="Span 2" />
      </FormItem>
      <FormItem span={2}>
        <Label>Span 2</Label>
        <Input placeholder="Span 2" />
      </FormItem>
      
      <FormItem span={3}>
        <Label>Span 3</Label>
        <Input placeholder="Span 3" />
      </FormItem>
      <FormItem span={1}>
        <Label>Span 1</Label>
        <Input placeholder="Span 1" />
      </FormItem>
      
      <FormItem span={4}>
        <Label>Span 4 (Full Width)</Label>
        <Input placeholder="Span 4" />
      </FormItem>
    </FormGrid>
}`,...(h=(x=l.parameters)==null?void 0:x.docs)==null?void 0:h.source}}};const K=["ComplexEntityForm","FourColumnLayout"];export{t as ComplexEntityForm,l as FourColumnLayout,K as __namedExportsOrder,J as default};
