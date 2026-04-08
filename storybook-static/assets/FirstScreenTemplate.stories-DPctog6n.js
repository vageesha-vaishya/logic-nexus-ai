import{j as e,r as l}from"./iframe-CsWugpTQ.js";import{F as m}from"./FirstScreenTemplate-CdBkyfs1.js";import{E}from"./EntityCard-mO65JnRK.js";import{B as T}from"./button-hQwFhXKy.js";import{C as N}from"./CRMModuleHeaderNavigation-D2bOTthf.js";import"./preload-helper-C1FmrZbK.js";import"./breadcrumb-DPXQILSR.js";import"./chevron-right-gZLE9Dpm.js";import"./useTranslation-CXK7K2Ob.js";import"./index-QPA-lWnS.js";import"./plus-GiGrk20-.js";import"./index-DDiXTfvP.js";import"./proxy-1TXl86YP.js";import"./card-DElVqdz_.js";import"./badge-CieB6EZu.js";import"./select-Bos0K022.js";import"./index-BdQq_4o_.js";import"./index-BMNU2nVA.js";import"./index-DutRtgoX.js";import"./chevron-down-KegWGprN.js";import"./check-CREjJjm4.js";import"./chevron-up-Bu-ihN1g.js";import"./palette-BufIVbno.js";import"./refresh-ccw-BHRAc9mE.js";import"./download-BUwnyLdH.js";import"./layout-grid-D9nqpmEH.js";import"./list-BATlJO1W.js";const ae={title:"System/FirstScreenTemplate",component:m,parameters:{layout:"fullscreen",a11y:{disable:!1}},argTypes:{title:{control:"text",description:"Page title"},description:{control:"text",description:"Optional subtitle text"},viewMode:{control:{type:"radio"},options:["list","card","grid"],description:"Active view mode"},availableModes:{control:"object",description:"Modes shown in toggle"},onImport:{action:"import",description:"Import handler"},onExport:{action:"export",description:"Export handler"},onCreate:{action:"create",description:"Create handler"}}},u=Array.from({length:6}).map((i,r)=>({id:`id-${r+1}`,title:`Entity ${r+1}`,subtitle:r%2===0?"Category A":"Category B",meta:"meta one • meta two",tags:["Active",r%2===0?"Tier 1":"Tier 2"]}));function V({mode:i}){if(i==="list")return e.jsx("div",{className:"space-y-2",children:u.map(t=>e.jsxs("div",{className:"flex items-center justify-between border rounded-md p-3",children:[e.jsxs("div",{children:[e.jsx("div",{className:"font-medium",children:t.title}),e.jsx("div",{className:"text-muted-foreground text-sm",children:t.subtitle})]}),e.jsx(T,{size:"sm",children:"Open"})]},t.id))});if(i==="analytics")return e.jsx("div",{className:"border rounded-md p-4",children:"Analytics content placeholder"});const r=i==="grid"?"grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3":"flex flex-col gap-3";return e.jsx("div",{className:r,children:u.map(t=>e.jsx(E,{title:t.title,subtitle:t.subtitle,meta:t.meta,tags:t.tags},t.id))})}const o={render:i=>{const r=t=>{const[a,c]=l.useState(t.viewMode??"list");return e.jsx("div",{className:"p-4",children:e.jsx(m,{...t,viewMode:a,availableModes:t.availableModes??["list","card","grid"],onViewModeChange:c,children:e.jsx(V,{mode:a})})})};return e.jsx(r,{...i})},args:{title:"Entities",description:"Browse and manage items",viewMode:"list",breadcrumbs:[{label:"Dashboard",to:"/"},{label:"Entities"}],onImport:()=>{},onExport:()=>{},onCreate:()=>{}}},s={...o,args:{...o.args,viewMode:"card"}},n={...o,args:{...o.args,viewMode:"grid"}},d={render:()=>{const i=()=>{const[r,t]=l.useState("list"),[a,c]=l.useState("Azure Sky"),[A,p]=l.useState(!1);return e.jsx("div",{className:"p-4",children:e.jsx(m,{title:"Leads Workspace With Long Title For Wrapping Validation",description:"Validates that all 9 header controls remain visible without horizontal scrolling.",breadcrumbs:[{label:"Dashboard",to:"/"},{label:"Leads"}],actionsRight:e.jsx(N,{moduleLabel:"Leads",viewMode:r,theme:a,onViewModeChange:j=>{p(!1),t(j)},analyticsLabel:"Analytics",analyticsActive:A,onAnalyticsClick:()=>p(!0),controlSequence:["pipeline","list","create","card","grid","refresh","analytics","importExport","theme"],onThemeChange:c,onCreate:()=>{},createLabel:"New Lead",iconOnly:!0,onRefresh:()=>{},onImportExport:()=>{}}),children:e.jsx(V,{mode:"list"})})})};return e.jsx(i,{})}};var g,h,v;o.parameters={...o.parameters,docs:{...(g=o.parameters)==null?void 0:g.docs,source:{originalSource:`{
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
}`,...(v=(h=o.parameters)==null?void 0:h.docs)==null?void 0:v.source}}};var w,b,x;s.parameters={...s.parameters,docs:{...(w=s.parameters)==null?void 0:w.docs,source:{originalSource:`{
  ...ListView,
  args: {
    ...ListView.args,
    viewMode: "card"
  }
}`,...(x=(b=s.parameters)==null?void 0:b.docs)==null?void 0:x.source}}};var y,C,M;n.parameters={...n.parameters,docs:{...(y=n.parameters)==null?void 0:y.docs,source:{originalSource:`{
  ...ListView,
  args: {
    ...ListView.args,
    viewMode: "grid"
  }
}`,...(M=(C=n.parameters)==null?void 0:C.docs)==null?void 0:M.source}}};var L,f,S;d.parameters={...d.parameters,docs:{...(L=d.parameters)==null?void 0:L.docs,source:{originalSource:`{
  render: () => {
    const LeadsHeaderControlsStory = () => {
      const [viewMode, setViewMode] = useState<'pipeline' | 'card' | 'grid' | 'list'>('list');
      const [theme, setTheme] = useState('Azure Sky');
      const [analyticsActive, setAnalyticsActive] = useState(false);
      return <div className="p-4">
          <FirstScreenTemplate title="Leads Workspace With Long Title For Wrapping Validation" description="Validates that all 9 header controls remain visible without horizontal scrolling." breadcrumbs={[{
          label: "Dashboard",
          to: "/"
        }, {
          label: "Leads"
        }]} actionsRight={<CRMModuleHeaderNavigation moduleLabel="Leads" viewMode={viewMode} theme={theme} onViewModeChange={mode => {
          setAnalyticsActive(false);
          setViewMode(mode);
        }} analyticsLabel="Analytics" analyticsActive={analyticsActive} onAnalyticsClick={() => setAnalyticsActive(true)} controlSequence={['pipeline', 'list', 'create', 'card', 'grid', 'refresh', 'analytics', 'importExport', 'theme']} onThemeChange={setTheme} onCreate={() => {}} createLabel="New Lead" iconOnly onRefresh={() => {}} onImportExport={() => {}} />}>
            <Content mode="list" />
          </FirstScreenTemplate>
        </div>;
    };
    return <LeadsHeaderControlsStory />;
  }
}`,...(S=(f=d.parameters)==null?void 0:f.docs)==null?void 0:S.source}}};const se=["ListView","CardView","GridView","LeadsHeaderControls"];export{s as CardView,n as GridView,d as LeadsHeaderControls,o as ListView,se as __namedExportsOrder,ae as default};
