// src/scripts/background.js

// Listener to ensure the service worker is active
chrome.runtime.onInstalled.addListener(() => {
  console.log("Swades CRM Extractor Installed");
});

// Listener to handle messages from content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'DATA_EXTRACTED') {
    console.log('Data received in background:', request.payload);
    sendResponse({ status: 'success' });
  }
});