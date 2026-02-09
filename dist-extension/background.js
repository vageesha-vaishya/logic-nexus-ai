chrome.runtime.onInstalled.addListener(()=>{console.log("Nexus Connect Extension Installed")});chrome.sidePanel.setPanelBehavior({openPanelOnActionClick:!0}).catch(e=>console.error(e));
