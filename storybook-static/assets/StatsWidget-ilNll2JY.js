import{c as p,j as e,a as n,r as l}from"./iframe-CsWugpTQ.js";import{C as d}from"./card-DElVqdz_.js";import{u as j}from"./useTranslation-CXK7K2Ob.js";import{J as v,D as m,K as h}from"./AppSidebar-3Hby7JfO.js";import{C as g}from"./circle-alert-C3SUhW_I.js";import{R as w,T as S}from"./generateCategoricalChart-D6LNj-1x.js";import{A as C,a as A}from"./AreaChart-DYppwacV.js";import{d as u}from"./dashboardAnalytics--JFzepin.js";import"./preload-helper-C1FmrZbK.js";import"./index-QPA-lWnS.js";import"./client-ChqmrxG9.js";import"./button-hQwFhXKy.js";import"./user-plus-D9p1xEne.js";import"./building-2-BHww9zKy.js";import"./users-CGiJ4cc7.js";import"./file-text-DuZzt2eC.js";import"./palette-BufIVbno.js";import"./message-square-B5eC0DnN.js";import"./ellipsis-CbKO68Uu.js";import"./mail-7USXVOe9.js";import"./settings-WKO1cmok.js";import"./search-BUAN7JnB.js";import"./chevron-down-KegWGprN.js";import"./proxy-1TXl86YP.js";import"./loader-circle-BNjXOknN.js";import"./index-DbKEobXu.js";import"./YAxis-BOOrmHjf.js";/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const N=p("ArrowDownRight",[["path",{d:"m7 7 10 10",key:"1fmybs"}],["path",{d:"M17 7v10H7",key:"6fjiku"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const b=p("ArrowUpRight",[["path",{d:"M7 7h10v10",key:"1tivn9"}],["path",{d:"M7 17 17 7",key:"1vkiza"}]]),k=[{id:"shipments",title:"Active Shipments",value:"247",change:"+12.5%",trend:"up",icon:v,color:"text-primary",data:[{value:10},{value:15},{value:12},{value:20},{value:18},{value:25},{value:22}],description:"Total active shipments across all modes"},{id:"revenue",title:"Monthly Revenue",value:"$1.2M",change:"+8.2%",trend:"up",icon:m,color:"text-success",data:[{value:100},{value:120},{value:115},{value:130},{value:140},{value:135},{value:150}],description:"Recognized revenue for the current month"},{id:"velocity",title:"Pipeline Velocity",value:"14 days",change:"-2 days",trend:"up",icon:h,color:"text-accent",data:[{value:20},{value:18},{value:16},{value:15},{value:14},{value:14},{value:14}],description:"Average time from lead to closed deal"},{id:"issues",title:"Issues Flagged",value:"5",change:"+2",trend:"down",icon:g,color:"text-warning",data:[{value:2},{value:3},{value:2},{value:4},{value:3},{value:5},{value:5}],description:"Open support tickets or shipment exceptions"}],f=({stats:c=k,loading:o=!1,className:r})=>{const{t:s}=j();return o?e.jsx("div",{className:n("grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6",r),children:[1,2,3,4].map(t=>e.jsx(d,{className:"p-6 h-[140px] animate-pulse bg-muted/50"},t))}):e.jsx("div",{className:n("grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6",r),children:c.map(t=>e.jsxs(d,{className:n("p-6 overflow-hidden relative transition-all hover:shadow-md",t.onClick?"cursor-pointer active:scale-[0.98]":""),onClick:t.onClick,title:t.description?s(t.description):void 0,children:[e.jsxs("div",{className:"flex justify-between z-10 relative",children:[e.jsxs("div",{children:[e.jsx("p",{className:"text-sm text-muted-foreground mb-1 font-medium",children:s(t.title)}),e.jsx("h3",{className:"text-3xl font-bold mb-2 tracking-tight",children:t.value}),e.jsxs("div",{className:"flex items-center gap-1",children:[t.trend==="up"?e.jsx(b,{className:"w-4 h-4 text-success"}):e.jsx(N,{className:"w-4 h-4 text-destructive"}),e.jsx("span",{className:n("text-sm font-medium",t.trend==="up"?"text-success":"text-destructive"),children:t.change}),e.jsx("span",{className:"text-xs text-muted-foreground ml-1",children:s("vs last month")})]})]}),e.jsx("div",{className:n("w-12 h-12 rounded-lg bg-gradient-to-br from-white/50 to-white/10 shadow-sm flex items-center justify-center backdrop-blur-sm",t.color),children:e.jsx(t.icon,{className:"w-6 h-6"})})]}),e.jsx("div",{className:n("absolute bottom-0 left-0 right-0 h-16 opacity-10 pointer-events-none",t.color),children:e.jsx(w,{width:"100%",height:"100%",children:e.jsxs(C,{data:t.data,children:[e.jsx("defs",{children:e.jsxs("linearGradient",{id:`gradient-${t.id}`,x1:"0",y1:"0",x2:"0",y2:"1",children:[e.jsx("stop",{offset:"0%",stopColor:"currentColor",stopOpacity:.5}),e.jsx("stop",{offset:"100%",stopColor:"currentColor",stopOpacity:0})]})}),e.jsx(S,{cursor:!1,content:e.jsx(e.Fragment,{})}),e.jsx(A,{type:"monotone",dataKey:"value",stroke:"currentColor",strokeWidth:2,fill:`url(#gradient-${t.id})`})]})})})]},t.id))})};f.__docgenInfo={description:`StatsCards Component

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
]`,computed:!1}},loading:{required:!1,tsType:{name:"boolean"},description:"",defaultValue:{value:"false",computed:!1}},className:{required:!1,tsType:{name:"string"},description:""}}};function T({config:c}){const[o,r]=l.useState([]),[s,t]=l.useState(!0);return l.useEffect(()=>{async function x(){try{const[a,i]=await Promise.all([u.getDashboardStats(),u.getDailyStats()]),y=[{id:"shipments",title:"Active Shipments",value:a.active_shipments.toString(),change:"",trend:"up",icon:v,color:"text-primary",data:i.shipments.length>0?i.shipments:[{value:0},{value:a.active_shipments}],description:"Total active shipments"},{id:"revenue",title:"Total Revenue",value:`$${a.total_revenue.toLocaleString()}`,change:"",trend:"up",icon:m,color:"text-success",data:i.revenue.length>0?i.revenue:[{value:0},{value:100}],description:"Total recognized revenue"},{id:"invoices",title:"Pending Invoices",value:a.pending_invoices.toString(),change:"",trend:"down",icon:h,color:"text-accent",data:i.invoices.length>0?i.invoices:[{value:0},{value:a.pending_invoices}],description:"Invoices waiting for payment"},{id:"profit",title:"Total Profit",value:`$${a.total_profit.toLocaleString()}`,change:"",trend:"up",icon:g,color:"text-warning",data:i.profit.length>0?i.profit:[{value:0},{value:100}],description:"Total profit margin"}];r(y)}catch(a){console.error("Failed to load dashboard stats",a)}finally{t(!1)}}x()},[]),e.jsx("div",{className:"h-full",children:e.jsx(f,{stats:o.length>0?o:void 0,loading:s})})}T.__docgenInfo={description:"",methods:[],displayName:"StatsWidget"};export{T as StatsWidget};
