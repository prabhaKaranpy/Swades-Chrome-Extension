# Salesforce CRM Data Extractor (Chrome Extension)

A Manifest V3 Chrome Extension designed to extract specific data fields from Salesforce Lightning records (Leads, Opportunities, Contacts, Accounts) and persist them locally for quick access.

##  Installation & Setup

1.  **Clone the Repository**
    ```bash
    git clone https://github.com/prabhaKaranpy/Swades-Chrome-Extension.git .
    cd salesforce-extractor
    ```

2.  **Install Dependencies**
    ```bash
    npm install
    ```

3.  **Build the Extension**
    ```bash
    npm run build
    ```
    *This will generate a `dist` folder.*

4.  **Load into Chrome**
    * Open `chrome://extensions/`
    * Enable **Developer mode** (top right).
    * Click **Load unpacked**.
    * Select the `dist` folder that has been previously generated.

##  Features
* **Smart DOM Scraping:** Detects active Salesforce objects and extracts relevant fields (e.g., Opportunity Stage & Probability).
* **Persistent Storage:** Uses `chrome.storage.local` to save data between sessions.
* **Shadow DOM Injection:** Provides non-intrusive visual feedback (toasts) directly on the Salesforce page.
* **React Dashboard:** A clean, tabbed UI built with Tailwind CSS to manage extracted leads.
* **Deduplication:** Automatically updates existing records instead of creating duplicates.
* **Export to CSV:** Download your captured CRM data as a `.csv` file directly from the dashboard for use in spreadsheets.

##  Technical Decisions & Architecture

### 1. Manifest V3 & Service Workers
Moved away from persistent background pages to a lightweight **Service Worker** (`background.js`). This ensures the extension is event-driven and consumes zero memory when not in use.

### 2. Handling Salesforce Lightning DOM
Salesforce uses dynamic IDs and Shadow DOM, making standard scraping difficult.
* **Strategy:** Instead of relying on brittle CSS IDs, I implemented a "Label-Based Heuristic". The script finds human-readable labels (e.g., "Stage", "Email") and traverses the DOM tree to find the associated value container.
* **Benefit:** This makes the extractor robust against minor Salesforce UI updates.

### 3. React + Vite Build System
Used **Vite** instead of CRA for faster build times and native ES module support.
* **Multi-Entry Build:** Configured `vite.config.js` to output separate bundles for the `popup` (React), `content scripts`, and `background workers` while maintaining a shared codebase.

### 4. Style Isolation
Used **Shadow DOM** for the status notification toasts. This ensures that the extension's CSS (Tailwind) never conflicts with Salesforce's complex internal stylesheets.

##  Storage Schema

The data is persisted in `chrome.storage.local` using a structured JSON format to organize different Salesforce objects:

```json
{
  "salesforce_data": {
    "leads": [
      {
        "id": "00Qfj000008ttDI",
        "name": "Mr. Prabhakaran G",
        "company": "Swades.AI",
        "email": "p.g@example.com",
        "phone": "+91 9876543210",
        "status": "Working - Contacted",
        "source": "Web",
        "owner": "Admin User",
        "extractedAt": "2026-01-16T01:35:02Z",
        "source_type": "detail_page"
      }
    ],
    "opportunities": [
      {
        "id": "006fj000008CcrJ",
        "name": "Test Deal 2026",
        "amount": "$1,000.00",
        "stage": "Qualification | Prospecting | Proposal | Negotiation | Closed | Won/Los",
        "probability": "10",
        "closeDate": "2/3/2026",
        "account": "Swades AI",
        "extractedAt": "2026-01-16T00:54:32Z",
        "source_type": "detail_page"
      }
    ],
    "contacts": [],
    "accounts": [],
    "tasks": [],
    "lastSync": 1737011102000
  }
}
```

##  How to Test

1.  Log in to your **Salesforce Developer Org**.
2.  Navigate to a Record Detail page (e.g., an **Opportunity**).
    * *Ensure you are on the "Details" tab where fields are visible.*
3.  Click the **Swades CRM Extractor** extension icon.
4.  Click **"Extract Page"**.
5.  A green toast notification will appear on the page.
6.  Open the extension popup again to see the data saved in the "Opportunities" tab.