
// Content script for Nexus Connect
// Runs on https://mail.google.com/*

console.log("[Nexus Connect] Content script loaded");

// Function to extract email details from Gmail
function extractEmailDetails() {
  // Basic extraction - Gmail classes are obfuscated, so this is best-effort or requires maintenance
  // A more robust way is to use the Gmail API or InboxSDK, but for Phase 2.1 we use DOM scraping
  
  // Try to find the subject
  // .hP is a long-standing class for the subject line in open view
  const subjectElement = document.querySelector('h2.hP');
  const subject = subjectElement ? subjectElement.textContent : document.title.split('-')[0].trim();

  // Try to find the sender
  // .gD is often the sender name/email container
  const senderElement = document.querySelector('.gD');
  const senderName = senderElement ? senderElement.textContent : "Unknown Sender";
  const senderEmail = senderElement ? senderElement.getAttribute('email') : null;

  // Try to find the body
  // .a3s is the message body container, .aiL often accompanies it
  const bodyElement = document.querySelector('.a3s.aiL');
  const body = bodyElement ? bodyElement.textContent : "";

  // URL check to see if we are in an email view
  const isEmailView = window.location.hash.includes('#inbox/') || window.location.hash.includes('#sent/') || (!!subjectElement && !!bodyElement);

  return {
    subject: subject || "No Subject",
    sender: senderEmail || senderName || "Unknown",
    senderName: senderName,
    body: body || "",
    url: window.location.href,
    isEmailView
  };
}

// Listen for messages from the Side Panel
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.action === "GET_EMAIL_CONTEXT") {
    const details = extractEmailDetails();
    sendResponse(details);
  }
});

// Optional: Observe DOM changes to auto-update (debounce this in production)
// For now, we rely on the Side Panel polling or the user clicking "Refresh"
