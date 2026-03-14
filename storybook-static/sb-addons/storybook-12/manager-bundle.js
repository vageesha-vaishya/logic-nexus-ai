try{
(()=>{var m=__STORYBOOK_API__,{ActiveTabs:u,Consumer:g,ManagerContext:h,Provider:x,RequestResponseError:S,addons:a,combineParameters:_,controlOrMetaKey:k,controlOrMetaSymbol:y,eventMatchesShortcut:v,eventToShortcut:O,experimental_MockUniversalStore:T,experimental_UniversalStore:C,experimental_requestResponse:B,experimental_useUniversalStore:R,isMacLike:w,isShortcutTaken:A,keyToSymbol:M,merge:P,mockChannel:E,optionOrAltSymbol:I,shortcutMatchesShortcut:H,shortcutToHumanString:N,types:U,useAddonState:K,useArgTypes:L,useArgs:Y,useChannel:G,useGlobalTypes:z,useGlobals:D,useParameter:q,useSharedState:F,useStoryPrepared:V,useStorybookApi:j,useStorybookState:J}=__STORYBOOK_API__;var $=__STORYBOOK_THEMING_CREATE__,{create:n,themes:ee}=__STORYBOOK_THEMING_CREATE__;var i=n({base:"light",brandTitle:"SOS Logistics Pro Design System",brandUrl:"https://soslogistics.example.com",brandImage:void 0,colorPrimary:"#2563eb",colorSecondary:"#111827",appBg:"#ffffff",appContentBg:"#ffffff",appPreviewBg:"#ffffff",appBorderColor:"#e5e7eb",appBorderRadius:8,fontBase:'"Inter", "Segoe UI", "Roboto", "Helvetica Neue", Arial, sans-serif',fontCode:'"SFMono-Regular", Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',textColor:"#111827",textInverseColor:"#ffffff",barTextColor:"#6b7280",barHoverColor:"#111827",barSelectedColor:"#2563eb",barBg:"#f8fafc",inputBg:"#ffffff",inputBorder:"#d1d5db",inputTextColor:"#111827",inputBorderRadius:8});a.setConfig({theme:i,enableShortcuts:!0,showPanel:!0,panelPosition:"right"});var s=`
  :root {
    --ln-sidebar-bg: #fafafa;
    --ln-sidebar-fg: #3f3f46;
    --ln-sidebar-fg-strong: #111827;
    --ln-sidebar-accent: #f4f4f5;
    --ln-sidebar-border: #e5e7eb;
    --ln-sidebar-ring: #3b82f6;
  }

  body,
  #root {
    font-family: "Inter", "Segoe UI", "Roboto", "Helvetica Neue", Arial, sans-serif;
    font-size: 14px;
    line-height: 1.4;
    color: var(--ln-sidebar-fg-strong);
  }

  .sidebar-container {
    background: var(--ln-sidebar-bg) !important;
    color: var(--ln-sidebar-fg) !important;
    border-right: 1px solid var(--ln-sidebar-border) !important;
    padding: 8px !important;
  }

  .sidebar-header,
  .sidebar-subheading {
    color: var(--ln-sidebar-fg) !important;
    font-size: 12px !important;
    font-weight: 600 !important;
    letter-spacing: 0.01em !important;
  }

  #storybook-explorer-tree {
    padding: 4px 0 !important;
  }

  #storybook-explorer-tree [role="treeitem"] {
    border-radius: 6px !important;
  }

  #storybook-explorer-tree [data-selected="true"] {
    background: rgba(37, 99, 235, 0.1) !important;
    color: #2563eb !important;
    font-weight: 500 !important;
  }

  #storybook-explorer-tree [role="treeitem"]:hover {
    background: var(--ln-sidebar-accent) !important;
    color: var(--ln-sidebar-fg-strong) !important;
  }

  .search-field input {
    min-height: 36px !important;
    border-radius: 8px !important;
    border: 1px solid #d1d5db !important;
    box-shadow: none !important;
    font-size: 14px !important;
    line-height: 20px !important;
  }

  .search-field input:focus {
    border-color: var(--ln-sidebar-ring) !important;
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.25) !important;
    outline: none !important;
  }

  .sidebar-container,
  #storybook-explorer-tree {
    scrollbar-width: auto;
    scrollbar-color: #9ca3af transparent;
  }

  .sidebar-container::-webkit-scrollbar,
  #storybook-explorer-tree::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }

  .sidebar-container::-webkit-scrollbar-thumb,
  #storybook-explorer-tree::-webkit-scrollbar-thumb {
    background: #9ca3af;
    border-radius: 9999px;
  }

  .sidebar-container::-webkit-scrollbar-track,
  #storybook-explorer-tree::-webkit-scrollbar-track {
    background: rgba(148, 163, 184, 0.15);
  }
`;if(typeof document<"u"){let e=document.createElement("style");e.setAttribute("data-manager-theme","logic-nexus-native-sidebar"),e.innerHTML=s,document.head.appendChild(e)}})();
}catch(e){ console.error("[Storybook] One of your manager-entries failed: " + import.meta.url, e); }
