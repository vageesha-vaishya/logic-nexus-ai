import{j as t}from"./jsx-runtime-DF2Pcvd1.js";import{r as V}from"./index-B2-qRKKC.js";import{F as b}from"./FirstScreenTemplate-axwoyGsC.js";import{E as C}from"./EntityCard-DZJFKBXX.js";import{B as f}from"./button-Cpm3eO9b.js";import"./_commonjsHelpers-Cpj98o6Y.js";import"./index-Bh3JKd2m.js";import"./utils-CytzSlOG.js";import"./chevron-right-Bf89TUQQ.js";import"./createLucideIcon-DapQ2WKf.js";import"./index-CMMd_KE_.js";import"./plus-B4oY7sqh.js";import"./index-DnUU7YDG.js";import"./proxy-Cbcr9-XL.js";import"./card-DDgMyP-I.js";import"./badge-BlxpgidI.js";const R={title:"System/FirstScreenTemplate",component:b,parameters:{layout:"fullscreen",a11y:{disable:!1}},argTypes:{title:{control:"text",description:"Page title"},description:{control:"text",description:"Optional subtitle text"},viewMode:{control:{type:"radio"},options:["list","card","grid"],description:"Active view mode"},availableModes:{control:"object",description:"Modes shown in toggle"},onImport:{action:"import",description:"Import handler"},onExport:{action:"export",description:"Export handler"},onCreate:{action:"create",description:"Create handler"}}},d=Array.from({length:6}).map((o,r)=>({id:`id-${r+1}`,title:`Entity ${r+1}`,subtitle:r%2===0?"Category A":"Category B",meta:"meta one • meta two",tags:["Active",r%2===0?"Tier 1":"Tier 2"]}));function h({mode:o}){if(o==="list")return t.jsx("div",{className:"space-y-2",children:d.map(e=>t.jsxs("div",{className:"flex items-center justify-between border rounded-md p-3",children:[t.jsxs("div",{children:[t.jsx("div",{className:"font-medium",children:e.title}),t.jsx("div",{className:"text-muted-foreground text-sm",children:e.subtitle})]}),t.jsx(f,{size:"sm",children:"Open"})]},e.id))});const r=o==="grid"?"grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3":"flex flex-col gap-3";return t.jsx("div",{className:r,children:d.map(e=>t.jsx(C,{title:e.title,subtitle:e.subtitle,meta:e.meta,tags:e.tags},e.id))})}const i={name:"List View",render:o=>{const r=e=>{const[n,M]=V.useState(e.viewMode??"list");return t.jsx("div",{className:"p-4",children:t.jsx(b,{...e,viewMode:n,availableModes:e.availableModes??["list","card","grid"],onViewModeChange:M,children:t.jsx(h,{mode:n})})})};return t.jsx(r,{...o})},args:{title:"Entities",description:"Browse and manage items",viewMode:"list",breadcrumbs:[{label:"Dashboard",to:"/"},{label:"Entities"}],onImport:()=>{},onExport:()=>{},onCreate:()=>{}}},s={name:"Card View",...i,args:{...i.args,viewMode:"card"}},a={name:"Grid View",...i,args:{...i.args,viewMode:"grid"}};var m,l,c;i.parameters={...i.parameters,docs:{...(m=i.parameters)==null?void 0:m.docs,source:{originalSource:`{
  name: "List View",
  render: args => {
    const ListViewComponent = (props: React.ComponentProps<typeof FirstScreenTemplate>) => {
      const [mode, setMode] = useState(props.viewMode ?? "list");
      return <div className="p-4">
          <FirstScreenTemplate {...props} viewMode={mode} availableModes={props.availableModes ?? ["list", "card", "grid"]} onViewModeChange={setMode}>
            <Content mode={mode} />
          </FirstScreenTemplate>
        </div>;
    };
    return <ListViewComponent {...args} />;
  },
  args: {
    title: "Entities",
    description: "Browse and manage items",
    viewMode: "list",
    breadcrumbs: [{
      label: "Dashboard",
      to: "/"
    }, {
      label: "Entities"
    }],
    onImport: () => {},
    onExport: () => {},
    onCreate: () => {}
  }
}`,...(c=(l=i.parameters)==null?void 0:l.docs)==null?void 0:c.source}}};var p,g,w;s.parameters={...s.parameters,docs:{...(p=s.parameters)==null?void 0:p.docs,source:{originalSource:`{
  name: "Card View",
  ...ListView,
  args: {
    ...ListView.args,
    viewMode: "card"
  }
}`,...(w=(g=s.parameters)==null?void 0:g.docs)==null?void 0:w.source}}};var u,x,v;a.parameters={...a.parameters,docs:{...(u=a.parameters)==null?void 0:u.docs,source:{originalSource:`{
  name: "Grid View",
  ...ListView,
  args: {
    ...ListView.args,
    viewMode: "grid"
  }
}`,...(v=(x=a.parameters)==null?void 0:x.docs)==null?void 0:v.source}}};const $=["ListView","CardView","GridView"];export{s as CardView,a as GridView,i as ListView,$ as __namedExportsOrder,R as default};
