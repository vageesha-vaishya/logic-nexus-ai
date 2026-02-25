import{j as y}from"./jsx-runtime-DF2Pcvd1.js";import{E as b}from"./EntityCard-DZJFKBXX.js";import{B as x}from"./button-Cpm3eO9b.js";import"./index-B2-qRKKC.js";import"./_commonjsHelpers-Cpj98o6Y.js";import"./card-DDgMyP-I.js";import"./utils-CytzSlOG.js";import"./badge-BlxpgidI.js";import"./index-Bh3JKd2m.js";const v={title:"System/EntityCard",component:b,parameters:{a11y:{disable:!1}},argTypes:{title:{control:"text",description:"Primary title"},subtitle:{control:"text",description:"Secondary text"},meta:{control:"text",description:"Small metadata block"},tags:{control:"object",description:"Array of tag labels"},onClick:{action:"click",description:"Click handler"}}},t={args:{title:"Acme Corp",subtitle:"Manufacturing",meta:"acme.com • +1 555-1111"}},r={args:{...t.args,tags:["Active","Enterprise","Priority"]}},a={args:{...r.args,right:y.jsx(x,{size:"sm",variant:"outline",children:"Manage"})}},e={args:{...a.args}};var s,o,i;t.parameters={...t.parameters,docs:{...(s=t.parameters)==null?void 0:s.docs,source:{originalSource:`{
  args: {
    title: "Acme Corp",
    subtitle: "Manufacturing",
    meta: "acme.com • +1 555-1111"
  }
}`,...(i=(o=t.parameters)==null?void 0:o.docs)==null?void 0:i.source}}};var n,c,m;r.parameters={...r.parameters,docs:{...(n=r.parameters)==null?void 0:n.docs,source:{originalSource:`{
  args: {
    ...Basic.args,
    tags: ["Active", "Enterprise", "Priority"]
  }
}`,...(m=(c=r.parameters)==null?void 0:c.docs)==null?void 0:m.source}}};var p,g,l;a.parameters={...a.parameters,docs:{...(p=a.parameters)==null?void 0:p.docs,source:{originalSource:`{
  args: {
    ...WithTags.args,
    right: <Button size="sm" variant="outline">Manage</Button>
  }
}`,...(l=(g=a.parameters)==null?void 0:g.docs)==null?void 0:l.source}}};var d,u,h;e.parameters={...e.parameters,docs:{...(d=e.parameters)==null?void 0:d.docs,source:{originalSource:`{
  args: {
    ...WithRightActions.args
  }
}`,...(h=(u=e.parameters)==null?void 0:u.docs)==null?void 0:h.source}}};const M=["Basic","WithTags","WithRightActions","Clickable"];export{t as Basic,e as Clickable,a as WithRightActions,r as WithTags,M as __namedExportsOrder,v as default};
