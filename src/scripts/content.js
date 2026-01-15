// src/scripts/content.js

// --- MODULE 4: VISUAL FEEDBACK (SHADOW DOM) ---
/**
 * Injects a status indicator into the page using Shadow DOM for style isolation.
 * Requirement: Module 4 [cite: 53, 54, 55]
 */
// src/scripts/content.js - Updated for visibility

function showNotification(message, isError = false) {
  const host = document.createElement('div');
  host.id = 'sf-extractor-toast-host';
  host.style.all = 'initial'; 
  document.body.appendChild(host);

  const shadow = host.attachShadow({ mode: 'open' });
  const div = document.createElement('div');
  
  const style = document.createElement('style');
  style.textContent = `
    .toast-container {
      position: fixed;
      /* CHANGE: Moved to bottom-right so it isn't blocked by the popup */
      bottom: 40px; 
      right: 40px;
      
      /* Ensure it stays above Salesforce's own UI elements */
      z-index: 2147483647; 
      
      padding: 16px 28px;
      border-radius: 12px;
      color: #ffffff;
      font-family: sans-serif;
      font-size: 14px;
      font-weight: 600;
      background: ${isError ? '#ef4444' : '#10b981'};
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
      display: flex;
      align-items: center;
      animation: slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1);
    }
    
    @keyframes slideUp {
      from { transform: translateY(100%); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
    
    @keyframes fadeOut {
      from { opacity: 1; transform: translateY(0); }
      to { opacity: 0; transform: translateY(10px); }
    }
  `;

  div.className = 'toast-container';
  div.textContent = message;
  shadow.appendChild(style);
  shadow.appendChild(div);

  setTimeout(() => {
    div.style.animation = 'fadeOut 0.5s forwards';
    setTimeout(() => host.remove(), 500);
  }, 3500);
}

// --- MODULE 1: DATA EXTRACTION ENGINE ---
/**
 * Polished extraction logic to handle dynamic DOM rendering and cleanup metadata.
 * Requirement: Module 1 [cite: 13, 14, 19]
 */
function getFieldValue(label) {
  const allLabels = Array.from(document.querySelectorAll('.test-id__field-label, .slds-form-element__label'));
  const targetLabel = allLabels.find(el => el.textContent.trim().startsWith(label));

  if (targetLabel) {
    const parent = targetLabel.closest('.slds-form-element') || targetLabel.parentElement.parentElement;
    if (parent) {
      const valueDiv = parent.querySelector('.slds-form-element__control, .test-id__field-value');
      if (valueDiv) {
        let cleanValue = valueDiv.innerText
          .replace(/\n/g, ' ')           
          .replace(/\bEdit\b/g, '')      
          .replace(label, '')             
          .replace(/%/g, '') // NEW: Strips any existing % symbol from the extracted data
          .replace(/\s+/g, ' ')          
          .trim();
        return cleanValue || null;
      }
    }
  }
  
  if (label === 'Opportunity Name' || label === 'Name') {
    const headerTitle = document.querySelector('slot[name="primaryFieldContent"] lightning-formatted-text');
    if (headerTitle) return headerTitle.textContent.trim();
  }
  
  return null;
}

/**
 * Detects object type and extracts data fields per Salesforce object.
 * Requirement: Leads, Contacts, Accounts, Opportunities, Tasks 
 */
function extractData() {
  const url = window.location.href;
  let type = 'unknown';
  let data = {};

  // Requirement: Detect which object the user is currently viewing [cite: 22]
  if (url.includes('/Lead/')) type = 'leads';
  else if (url.includes('/Contact/')) type = 'contacts';
  else if (url.includes('/Account/')) type = 'accounts';
  else if (url.includes('/Opportunity/')) type = 'opportunities';
  else if (url.includes('/Task/')) type = 'tasks';

  if (type === 'unknown') {
    showNotification('Please navigate to a valid Salesforce Record page', true);
    return;
  }

  // Extract common metadata
  data.id = url.split('/view')[0].split('/').pop();
  data.extractedAt = new Date().toISOString();

  // Object-Specific Extraction Rules [cite: 15, 16, 84]
  // Updated Object Specific Extraction Rules in content.js
  if (type === 'leads') {
    // Requirements: name, company, email, phone, lead source, lead status, lead owner
    data.name = getFieldValue('Name') || 'Unknown Lead';
    data.company = getFieldValue('Company');
    data.email = getFieldValue('Email');
    data.phone = getFieldValue('Phone');
    data.status = getFieldValue('Lead Status');
    data.source = getFieldValue('Lead Source');
    data.owner = getFieldValue('Lead Owner');
  }
  else if (type === 'opportunities') {
    // Requirement: Extract opportunity stages and probability [cite: 20, 52, 85]
    data.name = getFieldValue('Opportunity Name') || 'Unknown Opportunity';
    data.amount = getFieldValue('Amount');
    data.stage = getFieldValue('Stage'); 
    data.probability = getFieldValue('Probability (%)');
    data.closeDate = getFieldValue('Close Date');
    data.account = getFieldValue('Account Name');
    data.owner = getFieldValue('Opportunity Owner');
  }
  else if (type === 'contacts') {
    data.name = getFieldValue('Name') || 'Unknown Contact';
    data.email = getFieldValue('Email');
    data.phone = getFieldValue('Phone');
    data.account = getFieldValue('Account Name');
    data.title = getFieldValue('Title');
    data.owner = getFieldValue('Contact Owner');
  }
  else if (type === 'accounts') {
    data.name = getFieldValue('Account Name') || 'Unknown Account';
    data.website = getFieldValue('Website');
    data.phone = getFieldValue('Phone');
    data.industry = getFieldValue('Industry');
    data.revenue = getFieldValue('Annual Revenue');
    data.owner = getFieldValue('Account Owner');
  }
  else if (type === 'tasks') {
    data.name = getFieldValue('Subject') || 'Unknown Task';
    data.due = getFieldValue('Due Date');
    data.status = getFieldValue('Status');
    data.priority = getFieldValue('Priority');
    data.assignee = getFieldValue('Assigned To');
  }

  // --- MODULE 2: STORAGE LAYER ---
  /**
   * Persists data using chrome.storage.local with deduplication.
   * Requirement: Module 2 [cite: 11, 24, 25, 44]
   */
  chrome.storage.local.get(['salesforce_data'], (result) => {
    const store = result.salesforce_data || { leads: [], contacts: [], accounts: [], opportunities: [], tasks: [] };
    
    // 1. Identify current record by its unique Salesforce ID
    const currentId = window.location.href.split('/view')[0].split('/').pop();
    const existingIndex = store[type].findIndex(item => item.id === currentId);
    
    if (existingIndex > -1) {
      // 2. Update existing record with clean data
      store[type][existingIndex] = data; 
    } else {
      // 3. Add new clean record to the top
      store[type].unshift(data); 
    }
    
    store.lastSync = Date.now();
    chrome.storage.local.set({ salesforce_data: store }, () => {
      showNotification(`${type.slice(0, -1).toUpperCase()} extracted!`);
    });
  });
}

// --- MESSAGE PASSING ---
/**
 * Listen for the "Extract Current Object" trigger from the Popup Dashboard.
 * Requirement: Module 3 [cite: 50, 87]
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "EXTRACT_CURRENT") {
    extractData();
    sendResponse({ status: "extraction_started" });
  }
});



// // src/scripts/content.js

// // --- UTILITY: Shadow DOM Notification ---
// function showNotification(message, isError = false) {
//   // Create a host element for the shadow DOM
//   const host = document.createElement('div');
//   host.style.position = 'fixed';
//   host.style.top = '20px';
//   host.style.right = '20px';
//   host.style.zIndex = '10000'; // High z-index to stay on top
//   document.body.appendChild(host);

//   // Attach shadow root to isolate styles from Salesforce CSS
//   const shadow = host.attachShadow({ mode: 'open' });
//   const div = document.createElement('div');
  
//   div.textContent = message;
//   div.style.padding = '15px 25px';
//   div.style.borderRadius = '8px';
//   div.style.color = '#fff';
//   div.style.fontFamily = 'system-ui, sans-serif';
//   div.style.fontWeight = 'bold';
//   div.style.backgroundColor = isError ? '#ef4444' : '#10b981'; // Red for error, Green for success
//   div.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
//   div.style.transition = 'opacity 0.5s';

//   shadow.appendChild(div);

//   // Auto-remove the notification after 3 seconds
//   setTimeout(() => {
//     div.style.opacity = '0';
//     setTimeout(() => host.remove(), 500);
//   }, 3000);
// }

// // --- CORE: Extraction Logic ---
// // src/scripts/content.js

// // src/scripts/content.js refined for clean extraction
// function getFieldValue(label) {
//   // Find all potential label elements
//   const allLabels = Array.from(document.querySelectorAll('.test-id__field-label, .slds-form-element__label'));
//   const targetLabel = allLabels.find(el => el.textContent.trim().startsWith(label));

//   if (targetLabel) {
//     const parent = targetLabel.closest('.slds-form-element') || targetLabel.parentElement.parentElement;
//     if (parent) {
//       const valueDiv = parent.querySelector('.slds-form-element__control, .test-id__field-value');
//       if (valueDiv) {
//         // Clean up the text by removing "Edit" and extra whitespace
//         return valueDiv.innerText.replace(/\n/g, ' ').replace('Edit', '').trim();
//       }
//     }
//   }
  
//   // High-priority fallback for Opportunity Name in the header
//   if (label === 'Opportunity Name') {
//     const headerTitle = document.querySelector('slot[name="primaryFieldContent"] lightning-formatted-text');
//     if (headerTitle) return headerTitle.textContent.trim();
//   }
  
//   return null;
// }

// function extractData() {
//   const url = window.location.href;
//   let type = 'unknown';
//   let data = {};

//   // 1. Detect Object Type based on URL
//   if (url.includes('/Lead/')) type = 'leads';
//   else if (url.includes('/Contact/')) type = 'contacts';
//   else if (url.includes('/Account/')) type = 'accounts';
//   else if (url.includes('/Opportunity/')) type = 'opportunities';
//   else if (url.includes('/Task/')) type = 'tasks';

//   if (type === 'unknown') {
//     showNotification('Please navigate to a valid Record Page', true);
//     return;
//   }

//   // 2. Extract Data
//   data.id = url.split('/view')[0].split('/').pop(); // Extract Salesforce ID from URL
//   data.extractedAt = new Date().toISOString();

//   // Object Specific Extraction Rules
//   if (type === 'leads') {
//     data.name = getFieldValue('Name') || document.querySelector('.sPageTitle') ?.textContent || 'Unknown';
//     data.company = getFieldValue('Company');
//     data.email = getFieldValue('Email');
//     data.status = getFieldValue('Lead Status');
//   } 
//   else if (type === 'opportunities') {
//     data.name = getFieldValue('Opportunity Name');
//     data.amount = getFieldValue('Amount');
//     data.stage = getFieldValue('Stage'); 
//     data.probability = getFieldValue('Probability (%)');
//   }
//   else if (type === 'contacts') {
//     data.name = getFieldValue('Name');
//     data.email = getFieldValue('Email');
//     data.phone = getFieldValue('Phone');
//     data.account = getFieldValue('Account Name');
//   }
//   else if (type === 'accounts') {
//       data.name = getFieldValue('Account Name');
//       data.phone = getFieldValue('Phone');
//       data.website = getFieldValue('Website');
//   }

//   // 3. Save to Local Storage (Persistence)
//   chrome.storage.local.get(['salesforce_data'], (result) => {
//     const store = result.salesforce_data || { leads: [], contacts: [], accounts: [], opportunities: [], tasks: [] };
    
//     // Deduplication: Check if ID exists
//     const existingIndex = store[type].findIndex(item => item.id === data.id);
    
//     if (existingIndex > -1) {
//       store[type][existingIndex] = data; // Update existing record
//     } else {
//       store[type].push(data); // Add new record
//     }
    
//     store.lastSync = Date.now();

//     chrome.storage.local.set({ salesforce_data: store }, () => {
//       showNotification(`${type.slice(0, -1).toUpperCase()} extracted!`);
//     });
//   });
// }

// // --- MESSAGE LISTENER ---
// // Listens for the "Click" event from the popup
// chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
//   if (request.action === "EXTRACT_CURRENT") {
//     extractData();
//     sendResponse({ status: "started" });
//   }
// });