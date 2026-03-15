import{j as e}from"./jsx-runtime-Z5uAzocK.js";import{r as l}from"./index-pP6CS22B.js";import{C as c}from"./card-BRH59LJj.js";import{c as n}from"./utils-mOyDzkE6.js";import{u as w}from"./useTranslation-B4ORIRtT.js";import{h as u,i as m,j as v}from"./AppSidebar-DjH8Ok9V.js";import{C as g}from"./circle-alert-CpVRAWZS.js";import{c as h}from"./createLucideIcon-DEP7aKU9.js";import{R as j,T as S}from"./generateCategoricalChart-CUJPUrbO.js";import{A as C,a as b}from"./AreaChart-lYhVpfHw.js";import{d as p}from"./dashboardAnalytics-CbSc2VgM.js";import"./_commonjsHelpers-Cpj98o6Y.js";import"./index-C_BnrBF9.js";import"./index-DyZtt5qy.js";import"./index-DW48STyt.js";import"./index-BzXjCyLi.js";import"./index-DLHbBEj9.js";import"./index-CyLt0tHj.js";import"./index-DSMx10ar.js";import"./index-CuDmVINA.js";import"./sidebar-DlAukRpg.js";import"./use-mobile-Dni3OF_D.js";import"./button-SB7iZ1uz.js";import"./input-uwiBJMe4.js";import"./index-DGOKVkT8.js";import"./index-CiCgAmAg.js";import"./index-DLuVoU5X.js";import"./index-Bk-1lDEB.js";import"./x-DFQ5vw_2.js";import"./skeleton-JqcMxz8I.js";import"./index-DvPxE0jW.js";import"./index-CTbEET-J.js";import"./index-hrYVS3HY.js";import"./proxy-C3Nso6pS.js";import"./index-BXs83rev.js";import"./iframe-Bv_Xf4nP.js";import"./user-plus-G6XQ1r6r.js";import"./building-2-BKp0Ui21.js";import"./users-CK-74-gf.js";import"./file-text-BpOUT4Fo.js";import"./message-square-BA2hELBN.js";import"./ellipsis-irieReKa.js";import"./mail-Ceh6d5_X.js";import"./settings-DB_wZjJV.js";import"./search-C-UEa-iZ.js";import"./chevron-down-D-nzWkjq.js";import"./tiny-invariant-CopsF_GD.js";import"./index-CpCSUgdU.js";import"./YAxis-6cut2Ze9.js";/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const A=h("ArrowDownRight",[["path",{d:"m7 7 10 10",key:"1fmybs"}],["path",{d:"M17 7v10H7",key:"6fjiku"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const N=h("ArrowUpRight",[["path",{d:"M7 7h10v10",key:"1tivn9"}],["path",{d:"M7 17 17 7",key:"1vkiza"}]]),k=[{id:"shipments",title:"Active Shipments",value:"247",change:"+12.5%",trend:"up",icon:u,color:"text-primary",data:[{value:10},{value:15},{value:12},{value:20},{value:18},{value:25},{value:22}],description:"Total active shipments across all modes"},{id:"revenue",title:"Monthly Revenue",value:"$1.2M",change:"+8.2%",trend:"up",icon:m,color:"text-success",data:[{value:100},{value:120},{value:115},{value:130},{value:140},{value:135},{value:150}],description:"Recognized revenue for the current month"},{id:"velocity",title:"Pipeline Velocity",value:"14 days",change:"-2 days",trend:"up",icon:v,color:"text-accent",data:[{value:20},{value:18},{value:16},{value:15},{value:14},{value:14},{value:14}],description:"Average time from lead to closed deal"},{id:"issues",title:"Issues Flagged",value:"5",change:"+2",trend:"down",icon:g,color:"text-warning",data:[{value:2},{value:3},{value:2},{value:4},{value:3},{value:5},{value:5}],description:"Open support tickets or shipment exceptions"}],f=({stats:d=k,loading:r=!1,className:s})=>{const{t:o}=w();return r?e.jsx("div",{className:n("grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6",s),children:[1,2,3,4].map(t=>e.jsx(c,{className:"p-6 h-[140px] animate-pulse bg-muted/50"},t))}):e.jsx("div",{className:n("grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6",s),children:d.map(t=>e.jsxs(c,{className:n("p-6 overflow-hidden relative transition-all hover:shadow-md",t.onClick?"cursor-pointer active:scale-[0.98]":""),onClick:t.onClick,title:t.description?o(t.description):void 0,children:[e.jsxs("div",{className:"flex justify-between z-10 relative",children:[e.jsxs("div",{children:[e.jsx("p",{className:"text-sm text-muted-foreground mb-1 font-medium",children:o(t.title)}),e.jsx("h3",{className:"text-3xl font-bold mb-2 tracking-tight",children:t.value}),e.jsxs("div",{className:"flex items-center gap-1",children:[t.trend==="up"?e.jsx(N,{className:"w-4 h-4 text-success"}):e.jsx(A,{className:"w-4 h-4 text-destructive"}),e.jsx("span",{className:n("text-sm font-medium",t.trend==="up"?"text-success":"text-destructive"),children:t.change}),e.jsx("span",{className:"text-xs text-muted-foreground ml-1",children:o("vs last month")})]})]}),e.jsx("div",{className:n("w-12 h-12 rounded-lg bg-gradient-to-br from-white/50 to-white/10 shadow-sm flex items-center justify-center backdrop-blur-sm",t.color),children:e.jsx(t.icon,{className:"w-6 h-6"})})]}),e.jsx("div",{className:n("absolute bottom-0 left-0 right-0 h-16 opacity-10 pointer-events-none",t.color),children:e.jsx(j,{width:"100%",height:"100%",children:e.jsxs(C,{data:t.data,children:[e.jsx("defs",{children:e.jsxs("linearGradient",{id:`gradient-${t.id}`,x1:"0",y1:"0",x2:"0",y2:"1",children:[e.jsx("stop",{offset:"0%",stopColor:"currentColor",stopOpacity:.5}),e.jsx("stop",{offset:"100%",stopColor:"currentColor",stopOpacity:0})]})}),e.jsx(S,{cursor:!1,content:e.jsx(e.Fragment,{})}),e.jsx(b,{type:"monotone",dataKey:"value",stroke:"currentColor",strokeWidth:2,fill:`url(#gradient-${t.id})`})]})})})]},t.id))})};f.__docgenInfo={description:`StatsCards Component

Displays a grid of KPI cards with sparkline visualizations.
Implements the design patterns from the Dashboard Widget Guide.

@param stats - Array of StatItem objects containing metric data
@param loading - Boolean to show skeleton loading state
@param className - Optional CSS class for the grid container`,methods:[],displayName:"StatsCards",props:{stats:{required:!1,tsType:{name:"Array",elements:[{name:"StatItem"}],raw:"StatItem[]"},description:"",defaultValue:{value:`[
  {
    id: "shipments",
    title: "Active Shipments",
    value: "247",
    change: "+12.5%",
    trend: "up",
    icon: Ship,
    color: "text-primary",
    data: [{ value: 10 }, { value: 15 }, { value: 12 }, { value: 20 }, { value: 18 }, { value: 25 }, { value: 22 }],
    description: "Total active shipments across all modes"
  },
  {
    id: "revenue",
    title: "Monthly Revenue",
    value: "$1.2M",
    change: "+8.2%",
    trend: "up",
    icon: DollarSign,
    color: "text-success",
    data: [{ value: 100 }, { value: 120 }, { value: 115 }, { value: 130 }, { value: 140 }, { value: 135 }, { value: 150 }],
    description: "Recognized revenue for the current month"
  },
  {
    id: "velocity",
    title: "Pipeline Velocity",
    value: "14 days",
    change: "-2 days",
    trend: "up", // "up" trend here means improvement (lower days)
    icon: Activity,
    color: "text-accent",
    data: [{ value: 20 }, { value: 18 }, { value: 16 }, { value: 15 }, { value: 14 }, { value: 14 }, { value: 14 }],
    description: "Average time from lead to closed deal"
  },
  {
    id: "issues",
    title: "Issues Flagged",
    value: "5",
    change: "+2",
    trend: "down", // "down" trend means getting worse (more issues)
    icon: AlertCircle,
    color: "text-warning",
    data: [{ value: 2 }, { value: 3 }, { value: 2 }, { value: 4 }, { value: 3 }, { value: 5 }, { value: 5 }],
    description: "Open support tickets or shipment exceptions"
  }
]`,computed:!1}},loading:{required:!1,tsType:{name:"boolean"},description:"",defaultValue:{value:"false",computed:!1}},className:{required:!1,tsType:{name:"string"},description:""}}};function T({config:d}){const[r,s]=l.useState([]),[o,t]=l.useState(!0);return l.useEffect(()=>{async function x(){try{const[i,a]=await Promise.all([p.getDashboardStats(),p.getDailyStats()]),y=[{id:"shipments",title:"Active Shipments",value:i.active_shipments.toString(),change:"",trend:"up",icon:u,color:"text-primary",data:a.shipments.length>0?a.shipments:[{value:0},{value:i.active_shipments}],description:"Total active shipments"},{id:"revenue",title:"Total Revenue",value:`$${i.total_revenue.toLocaleString()}`,change:"",trend:"up",icon:m,color:"text-success",data:a.revenue.length>0?a.revenue:[{value:0},{value:100}],description:"Total recognized revenue"},{id:"invoices",title:"Pending Invoices",value:i.pending_invoices.toString(),change:"",trend:"down",icon:v,color:"text-accent",data:a.invoices.length>0?a.invoices:[{value:0},{value:i.pending_invoices}],description:"Invoices waiting for payment"},{id:"profit",title:"Total Profit",value:`$${i.total_profit.toLocaleString()}`,change:"",trend:"up",icon:g,color:"text-warning",data:a.profit.length>0?a.profit:[{value:0},{value:100}],description:"Total profit margin"}];s(y)}catch(i){console.error("Failed to load dashboard stats",i)}finally{t(!1)}}x()},[]),e.jsx("div",{className:"h-full",children:e.jsx(f,{stats:r.length>0?r:void 0,loading:o})})}T.__docgenInfo={description:"",methods:[],displayName:"StatsWidget",props:{config:{required:!0,tsType:{name:"WidgetConfig"},description:""},onRemove:{required:!0,tsType:{name:"signature",type:"function",raw:"(id: string) => void",signature:{arguments:[{type:{name:"string"},name:"id"}],return:{name:"void"}}},description:""},onEdit:{required:!0,tsType:{name:"signature",type:"function",raw:"(id: string, newConfig: Partial<WidgetConfig>) => void",signature:{arguments:[{type:{name:"string"},name:"id"},{type:{name:"Partial",elements:[{name:"WidgetConfig"}],raw:"Partial<WidgetConfig>"},name:"newConfig"}],return:{name:"void"}}},description:""},isEditMode:{required:!0,tsType:{name:"boolean"},description:""}}};export{T as StatsWidget};
