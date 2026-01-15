/* global chrome */
import React, { useState, useEffect } from 'react';

// --- ICONS ---
const RefreshIcon = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>;
const TrashIcon = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>;

function App() {
  const [data, setData] = useState({ leads: [], contacts: [], opportunities: [], accounts: [] });
  const [activeTab, setActiveTab] = useState('leads');
  const [lastSync, setLastSync] = useState(null);

  // 1. Load Data from Chrome Storage
  const loadData = () => {
    chrome.storage.local.get(['salesforce_data'], (result) => {
      if (result.salesforce_data) {
        setData(result.salesforce_data);
        if (result.salesforce_data.lastSync) {
          setLastSync(new Date(result.salesforce_data.lastSync).toLocaleTimeString());
        }
      }
    });
  };

  // 2. Initial Load + Real-time Listener (Bonus #1)
  useEffect(() => {
    loadData();
    const listener = (changes, area) => {
      if (area === 'local' && changes.salesforce_data) loadData();
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);

  // 3. Trigger Extraction on Active Tab
  const handleExtract = () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, { action: "EXTRACT_CURRENT" });
        setTimeout(loadData, 1500); 
      }
    });
  };

  // 4. Export to CSV (Bonus #2)
  const exportToCSV = () => {
    const records = data[activeTab];
    if (!records.length) return alert("No records to export!");

    // Generate headers based on the first record keys
    const headers = Object.keys(records[0]).join(",");
    const rows = records.map(row => 
      Object.values(row).map(val => `"${val}"`).join(",")
    ).join("\n");

    const csvContent = "data:text/csv;charset=utf-8," + headers + "\n" + rows;
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `swades_crm_${activeTab}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 5. Delete Record
  const handleDelete = (id) => {
    const newData = { ...data };
    newData[activeTab] = newData[activeTab].filter(item => item.id !== id);
    chrome.storage.local.set({ salesforce_data: newData }); 
  };

  // 6. Clear All Data
  const handleClearAll = () => {
    if(confirm("Are you sure you want to clear all data?")) {
        chrome.storage.local.clear();
        setData({ leads: [], contacts: [], opportunities: [], accounts: [] });
    }
  };

  return (
    <div className="min-h-screen font-sans text-gray-800">
      
      {/* HEADER */}
      <div className="bg-white p-4 shadow-sm flex justify-between items-center sticky top-0 z-10">
        <div>
            <h1 className="text-xl font-bold text-indigo-600 flex items-center gap-2">
                Swades.AI CRM
            </h1>
            <p className="text-[10px] text-gray-400 font-mono">Synced: {lastSync || 'Waiting...'}</p>
        </div>
        <div className="flex gap-2">
            <button onClick={handleClearAll} className="px-2 py-1 text-xs text-red-500 hover:bg-red-50 rounded border border-transparent hover:border-red-100">
                Clear
            </button>
            <button 
                onClick={exportToCSV}
                className="px-3 py-1.5 bg-green-600 text-white text-xs font-bold rounded shadow hover:bg-green-700 ml-2 transition-transform active:scale-95"
            >
                Export CSV
            </button>
            <button 
                onClick={handleExtract}
                className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded shadow hover:bg-indigo-700 active:scale-95 transition-transform flex items-center gap-1"
            >
                <RefreshIcon /> Extract
            </button>
        </div>
      </div>

      {/* TABS */}
      <div className="flex bg-white border-b px-4 space-x-4">
        {['leads', 'contacts', 'opportunities', 'accounts'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`py-3 text-xs font-bold uppercase tracking-wide border-b-2 transition-colors ${
              activeTab === tab 
                ? 'border-indigo-600 text-indigo-600' 
                : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* DATA TABLE */}
      <div className="p-4">
        {data[activeTab]?.length === 0 ? (
          <div className="text-center py-10 bg-white rounded border border-dashed border-gray-300">
            <p className="text-gray-400 text-sm">No {activeTab} captured.</p>
            <p className="text-xs text-gray-300 mt-1">Navigate to a record & click Extract</p>
          </div>
        ) : (
          <div className="bg-white rounded shadow-sm border overflow-hidden">
            {data[activeTab].map((item) => (
              <div key={item.id} className="flex items-center justify-between p-3 border-b last:border-0 hover:bg-gray-50 transition-colors group">
                
                <div className="flex-1 min-w-0 pr-4">
                  <p className="text-sm font-semibold text-gray-900 truncate">{item.name || 'Unknown Name'}</p>
                  
                  <div className="text-xs text-gray-500 mt-0.5 truncate">
                    {activeTab === 'opportunities' && (
                        <span className="flex gap-2">
                             <span className="bg-green-100 text-green-800 px-1.5 rounded">{item.amount || '$0'}</span>
                             <span>{item.stage} ({item.probability}%)</span>
                        </span>
                    )}
                    {activeTab === 'leads' && (
                        <span>{item.company} • {item.email}</span>
                    )}
                    {activeTab === 'contacts' && (
                        <span>{item.email} • {item.phone}</span>
                    )}
                    {activeTab === 'accounts' && (
                        <span>{item.website}</span>
                    )}
                  </div>
                </div>

                <button 
                    onClick={() => handleDelete(item.id)}
                    className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors opacity-0 group-hover:opacity-100"
                    title="Delete Record"
                >
                    <TrashIcon />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;

