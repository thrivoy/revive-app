import './index.css';
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createRoot } from 'react-dom/client';

// --- SAFE IMPORT FIX ---
import * as ReactWindowPkg from 'react-window';
const List = ReactWindowPkg.FixedSizeList || ReactWindowPkg.default?.FixedSizeList;

import * as AutoSizerPkg from 'react-virtualized-auto-sizer';
const AutoSizer = AutoSizerPkg.default || AutoSizerPkg;
// -----------------------

import { motion, useAnimation, AnimatePresence } from 'framer-motion';
import Papa from 'papaparse';
import { 
  Phone, Upload, UserPlus, ArrowLeft, Trash2, Zap, ScanLine, Settings, 
  List as ListIcon, Plus, X, Wand2, Play, Flame, 
  ThumbsUp, Snowflake, Camera, Mic, LogOut, 
  Share2, Users, RefreshCw, ChevronRight, Lock, Briefcase, HelpCircle,
  LayoutDashboard, BarChart3, CheckCircle2, WifiOff, UserCheck, Mail, Globe, Building2
} from 'lucide-react';

// --- MEMORY LEAK FIX ---
const requestCache = new Map();
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of requestCache.entries()) {
    if (now - val.timestamp > 300000) { 
        requestCache.delete(key);
    }
  }
}, 60000);

// --- ERROR BOUNDARY ---
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-screen flex flex-col items-center justify-center p-6 text-center bg-gray-50">
          <div className="bg-red-100 p-4 rounded-full text-red-600 mb-4"><WifiOff size={32}/></div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Engine Stalled</h1>
          <p className="text-sm text-gray-500 mb-6 max-w-xs mx-auto">Something went wrong. Don't worry, your data is safe in the cloud.</p>
          <button 
            onClick={() => window.location.reload()} 
            className="bg-gray-900 text-white px-6 py-3 rounded-xl font-bold shadow-lg"
          >
            Restart Engine
          </button>
          <p className="mt-4 text-xs text-gray-400 font-mono">{this.state.error?.message}</p>
        </div>
      );
    }
    return this.props.children;
  }
}

// --- CONFIGURATION ---
// ⚠️ PASTE YOUR GOOGLE APPS SCRIPT URL HERE
const API_URL = "https://script.google.com/macros/s/AKfycbwTmH-Db341gQGXZ9GcaDD0hwP11kMoACe-7oAoQaWU6i_sxGe5owO_tPAsN6_eABKDJw/exec"; 

const ADMIN_PASSWORD = "thrivoy_boss"; 
const ADMIN_KEY = "master";
const LEAD_LIMIT = 100;

// --- UTILS & SECURITY ---

const safeStorage = {
  getItem: (k) => { try { return localStorage.getItem(k); } catch(e) { return null; } },
  setItem: (k, v) => { try { localStorage.setItem(k, v); } catch(e) {} },
  removeItem: (k) => { try { localStorage.removeItem(k); } catch(e) {} }
};

const vibrate = (ms = 50) => { if (navigator.vibrate) navigator.vibrate(ms); };
const pendingRequests = new Map();

async function signedRequest(action, payload) {
  const cacheKey = JSON.stringify({ action, payload });
   
  // 1. Deduplication
  if (pendingRequests.has(cacheKey)) return pendingRequests.get(cacheKey);
   
  // 2. Cache Read (5s TTL, except for mutations)
  if (requestCache.has(cacheKey)) {
    const cached = requestCache.get(cacheKey);
    if (Date.now() - cached.timestamp < 5000 && !action.includes("MARK") && !action.includes("ADD")) {
      return Promise.resolve(new Response(JSON.stringify(cached.data)));
    }
    requestCache.delete(cacheKey);
  }

  const timestamp = Date.now();
  const clientId = payload.client_id;
  let signature = "";

  // 3. HMAC Security
  if (action !== "ADD_CLIENT" && clientId !== ADMIN_KEY) {
      const secret = safeStorage.getItem(`thrivoy_secret_${clientId}`);
      if (secret && window.crypto && crypto.subtle) {
          try {
            const enc = new TextEncoder();
            const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
            const sig = await crypto.subtle.sign('HMAC', key, enc.encode(`${clientId}:${timestamp}`));
            signature = btoa(String.fromCharCode(...new Uint8Array(sig)));
          } catch(e) { console.error("Signing failed", e); }
      }
  }

  const requestPromise = fetch(API_URL, {
      method: 'POST',
      body: JSON.stringify({ action, payload, timestamp, signature })
  }).then(async response => {
      const data = await response.json();
      if (data.status === 'success' && action.startsWith("GET")) {
        requestCache.set(cacheKey, { data, timestamp: Date.now() });
      }
      pendingRequests.delete(cacheKey);
      return new Response(JSON.stringify(data));
  }).catch(error => {
      pendingRequests.delete(cacheKey);
      throw error;
  });

  pendingRequests.set(cacheKey, requestPromise);
  return requestPromise;
}

// --- OPTIMIZED COMPONENTS ---

// 1. Virtualized Row (For QueueList)
const QueueRow = ({ index, style, data }) => {
  const { queue, onSelect } = data;
  const lead = queue[index];
  return (
    <div style={style} className="px-4 py-2">
      <div onClick={() => onSelect(lead)} className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm flex justify-between items-center active:bg-blue-50 transition-colors cursor-pointer">
        <div className="flex-1 min-w-0 pr-2">
           <div className="font-bold text-gray-800 truncate">{lead.name}</div>
           <div className="flex items-center gap-2 text-xs text-gray-500 font-mono">
              <span>{lead.phone}</span>
              {lead.company && <span className="bg-gray-100 px-1 rounded text-[10px] truncate max-w-[80px]">{lead.company}</span>}
           </div>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
           <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${lead.status === 'SENT' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{lead.status}</span>
           <ChevronRight size={16} className="text-gray-300"/>
        </div>
      </div>
    </div>
  );
};

// --- MAIN APP ---

function App() {
  const [view, setView] = useState("menu");
  const [clientId, setClientId] = useState(() => {
      const params = new URLSearchParams(window.location.search);
      return params.get("key") || safeStorage.getItem("thrivoy_client_id") || "";
  });
  const [publicId, setPublicId] = useState(() => new URLSearchParams(window.location.search).get("u"));

  const [queue, setQueue] = useState([]);
  const [stats, setStats] = useState({ today: 0 });
  const [loading, setLoading] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
   
  // Navigation State
  const [activeLead, setActiveLead] = useState(null);
  const [prefillData, setPrefillData] = useState(null);
  const [bulkData, setBulkData] = useState([]);
   
  // Settings
  const [template, setTemplate] = useState(() => safeStorage.getItem("active_template") || "Hi {{name}}, regarding {{context}}.");
  const [library, setLibrary] = useState(() => JSON.parse(safeStorage.getItem("msg_library") || "[]"));
  const [userProfile, setUserProfile] = useState({});

  useEffect(() => safeStorage.setItem("active_template", template), [template]);
  useEffect(() => safeStorage.setItem("msg_library", JSON.stringify(library)), [library]);
   
  // Offline Listener
  useEffect(() => {
     const up = () => setIsOnline(true);
     const down = () => setIsOnline(false);
     window.addEventListener('online', up);
     window.addEventListener('offline', down);
     return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down); };
  }, []);

  const fetchQueue = useCallback(async (id) => {
    if(!id || id === ADMIN_KEY) return;
    setLoading(true);
    try {
        const res = await signedRequest("GET_QUEUE", { client_id: id });
        const json = await res.json();
        if(json.data) { 
          setQueue(json.data.queue || []); 
          setStats(json.data.stats || { today: 0 }); 
        }
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if(publicId) return;
    if(clientId && clientId !== ADMIN_KEY) {
       safeStorage.setItem("thrivoy_client_id", clientId);
       fetchQueue(clientId);
       signedRequest("GET_CLIENT_PROFILE", { client_id: clientId }).then(r=>r.json()).then(j => {
          if(j.data) {
             setUserProfile(j.data);
             if(j.data.secret) safeStorage.setItem(`thrivoy_secret_${clientId}`, j.data.secret);
          }
       });
    }
  }, [clientId, fetchQueue, publicId]);

  const handleBulkSubmit = async (leads) => {
    setLoading(true);
    try {
       const res = await signedRequest("ADD_LEADS", { client_id: clientId, leads });
       const json = await res.json();
       if(json.status === 'success') {
          alert(`Saved ${json.count} leads.`);
          fetchQueue(clientId);
          setView("menu");
       } else {
          alert("Error: " + json.message);
       }
    } finally { setLoading(false); }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if(!file) return;
    Papa.parse(file, { header: true, complete: (results) => {
        const valid = results.data.filter(r => r.Phone || r.Mobile).map(r => ({
           name: r.Name || "Lead",
           phone: r.Phone || r.Mobile,
           context: r.Context || r.Notes || "Imported",
           email: r.Email || "",
           company: r.Company || "",
           website: r.Website || ""
        }));
        setBulkData(valid);
        setView("bulk");
    }});
  };

  if (!isOnline) return <div className="h-screen flex flex-col items-center justify-center p-6 text-center"><WifiOff size={48} className="text-gray-300 mb-4"/><h2 className="text-xl font-bold">Offline</h2><p className="text-gray-500">Check internet.</p></div>;

  // --- GATEKEEPER LOGIC ---
  if (publicId) return <DigitalCard profileId={publicId} />;
  if (!clientId) return <LandingPage />;
  if (view === "admin") return <AdminDashboard />;
  if (clientId === ADMIN_KEY) return <AdminLogin onLogin={() => setView("admin")} />;
   
  // --- VIEWS ---
  if(view === "menu") return <MenuScreen queue={queue} stats={stats} loading={loading} onViewChange={setView} onUpload={handleFileUpload} onRefresh={() => fetchQueue(clientId)} clientId={clientId} onBulkSubmit={handleBulkSubmit} />;
  if(view === "stack") return <CardStack queue={queue} setQueue={setQueue} template={template} library={library} clientId={clientId} onBack={() => { fetchQueue(clientId); setView("menu"); }} initialLead={activeLead} />;
  if(view === "list") return <QueueList queue={queue} onBack={() => setView("menu")} onSelect={(lead) => { setActiveLead(lead); setView("stack"); }} />;
  if(view === "hotlist") return <HotList clientId={clientId} onBack={() => setView("menu")} />;
  if(view === "camera") return <CameraScan clientId={clientId} onBack={() => setView("menu")} onScanComplete={(d) => { setPrefillData(d); setView("manual"); }} />;
  if(view === "manual") return <ManualForm prefill={prefillData} onBack={() => setView("menu")} onSubmit={(l) => handleBulkSubmit([l])} />;
  if(view === "bulk") return <BulkPasteForm initialData={bulkData} clientId={clientId} onBack={() => setView("menu")} onSubmit={handleBulkSubmit} />;
  if(view === "settings") return <SettingsForm template={template} setTemplate={setTemplate} library={library} setLibrary={setLibrary} userProfile={userProfile} clientId={clientId} onBack={() => setView("menu")} onLogout={() => { safeStorage.removeItem("thrivoy_client_id"); window.location.reload(); }} />;
  if(view === "help") return <HelpScreen onBack={() => setView("menu")} />;

  return <div className="p-10 text-center animate-pulse">Loading Engine...</div>;
}

// --- NEW COMPONENT: Power Emailer (Rapid Fire) ---
function PowerEmailer({ queue, selectedIds, template, onBack }) {
    // Filter queue to show ONLY selected leads
    const campaignList = useMemo(() => queue.filter(l => selectedIds.has(l.lead_id) && l.email), [queue, selectedIds]);
    const [index, setIndex] = useState(0);
    const lead = campaignList[index];
    const [msg, setMsg] = useState("");

    useEffect(() => {
        if(lead) {
            setMsg(template.replace("{{name}}", lead.name).replace("{{context}}", lead.context || ""));
        }
    }, [lead, template]);

    const send = () => {
        const subject = encodeURIComponent(`Regarding: ${lead.context || "Connect"}`);
        const body = encodeURIComponent(msg);
        window.location.href = `mailto:${lead.email}?subject=${subject}&body=${body}`;
        if(index < campaignList.length - 1) setIndex(index + 1);
        else alert("Campaign Finished!");
    };

    if(!lead) return <div className="p-10 text-center">No leads with email found in selection.<br/><button onClick={onBack} className="mt-4 text-blue-600 underline">Go Back</button></div>;

    return (
        <div className="h-screen bg-slate-100 flex flex-col items-center justify-center p-6">
            <div className="bg-white w-full max-w-sm rounded-3xl shadow-xl p-6 relative">
                <div className="flex justify-between items-center mb-4">
                    <button onClick={onBack}><ArrowLeft/></button>
                    <span className="text-xs font-bold text-gray-400">Email {index + 1} of {campaignList.length}</span>
                </div>
                <h2 className="text-2xl font-bold truncate">{lead.name}</h2>
                <p className="text-blue-600 font-mono text-sm mb-4">{lead.email}</p>
                <textarea value={msg} onChange={e => setMsg(e.target.value)} className="w-full h-32 p-3 bg-gray-50 rounded-xl mb-4 text-sm resize-none outline-none focus:ring-2 focus:ring-blue-100"/>
                
                <button onClick={send} className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold shadow-lg flex items-center justify-center gap-2 mb-2">
                    <Send size={18}/> Send & Next
                </button>
                <button onClick={() => { if(index < campaignList.length - 1) setIndex(index + 1); }} className="w-full bg-gray-100 text-gray-500 py-3 rounded-xl font-bold text-sm">Skip</button>
            </div>
        </div>
    );
}

// --- UPDATED: QueueList with Selection ---
function QueueList({ queue, onBack, onSelect, selectedLeads, setSelectedLeads, onPowerEmail, clientId, onRefresh }) {
  const [selectionMode, setSelectionMode] = useState(false);
  const [showTagInput, setShowTagInput] = useState(false);
  const [newTag, setNewTag] = useState("");

  const toggleSelect = (id) => {
      setSelectionMode(true);
      const next = new Set(selectedLeads);
      if(next.has(id)) next.delete(id); else next.add(id);
      setSelectedLeads(next);
      if(next.size === 0) setSelectionMode(false);
  };

  const handleBCC = () => {
      const emails = queue.filter(l => selectedLeads.has(l.lead_id) && l.email).map(l => l.email).join(',');
      if(!emails) return alert("No emails in selection");
      window.location.href = `mailto:?bcc=${emails}&subject=Update`;
  };

  const handleAddTag = async () => {
      if(!newTag) return;
      await signedRequest("UPDATE_TAGS", { client_id: clientId, lead_ids: Array.from(selectedLeads), tag: newTag });
      alert("Tags Added!");
      setShowTagInput(false);
      setNewTag("");
      setSelectedLeads(new Set());
      setSelectionMode(false);
      onRefresh();
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50">
       <div className="bg-white p-4 border-b flex items-center justify-between shadow-sm z-10">
          <div className="flex items-center gap-3">
             <button onClick={onBack}><ArrowLeft/></button>
             <h2 className="font-bold">{selectionMode ? `${selectedLeads.size} Selected` : `Queue (${queue.length})`}</h2>
          </div>
          {!selectionMode && <button onClick={() => setSelectionMode(true)} className="text-sm font-bold text-blue-600">Select</button>}
          {selectionMode && <button onClick={() => { setSelectionMode(false); setSelectedLeads(new Set()); }} className="text-sm font-bold text-gray-500">Cancel</button>}
       </div>
       
       <div className="flex-1 relative">
          <AutoSizer>
             {({ height, width }) => (
                <List height={height} width={width} itemCount={queue.length} itemSize={80} itemData={{queue, onSelect, selected: selectedLeads, toggleSelect, selectionMode}}>
                   {QueueRow}
                </List>
             )}
          </AutoSizer>
       </div>

       {/* BULK ACTION BAR */}
       {selectionMode && selectedLeads.size > 0 && (
           <div className="bg-white border-t p-4 flex gap-2 overflow-x-auto pb-safe shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
               <button onClick={onPowerEmail} className="bg-blue-600 text-white px-4 py-3 rounded-xl font-bold text-sm whitespace-nowrap flex items-center gap-2"><Zap size={16}/> Rapid Fire</button>
               <button onClick={handleBCC} className="bg-gray-900 text-white px-4 py-3 rounded-xl font-bold text-sm whitespace-nowrap flex items-center gap-2"><Mail size={16}/> BCC Blast</button>
               <button onClick={() => setShowTagInput(true)} className="bg-purple-100 text-purple-700 px-4 py-3 rounded-xl font-bold text-sm whitespace-nowrap flex items-center gap-2"><Tag size={16}/> Tag</button>
           </div>
       )}

       {/* TAG MODAL */}
       {showTagInput && (
           <div className="absolute inset-0 bg-black/50 z-50 flex items-center justify-center p-6">
               <div className="bg-white p-6 rounded-2xl w-full max-w-sm">
                   <h3 className="font-bold mb-4">Add Tag to {selectedLeads.size} leads</h3>
                   <input autoFocus value={newTag} onChange={e=>setNewTag(e.target.value)} placeholder="#Hot, #Jan, #Investor" className="w-full p-3 border rounded-xl mb-4 outline-none focus:border-blue-500"/>
                   <div className="flex gap-2">
                       <button onClick={() => setShowTagInput(false)} className="flex-1 py-3 font-bold text-gray-500">Cancel</button>
                       <button onClick={handleAddTag} className="flex-1 bg-purple-600 text-white rounded-xl font-bold py-3">Save</button>
                   </div>
               </div>
           </div>
       )}
    </div>
  );
}

function CardStack({ queue, setQueue, template, library, clientId, onBack, initialLead }) {
  const [active, setActive] = useState(initialLead || queue[0]);
  const [msg, setMsg] = useState("");
  const controls = useAnimation();
  const [mode, setMode] = useState("card");
  const [polyglot, setPolyglot] = useState(false);

  useEffect(() => {
    if(!active) return;
    const ctx = (active.context || "").split(" ||| ")[0];
    let tpl = template;
    const match = library.find(l => ctx.toLowerCase().includes(l.name.toLowerCase()));
    if(match) tpl = match.text;
    setMsg(tpl.replace("{{name}}", active.name).replace("{{context}}", ctx));
    controls.set({ x: 0, opacity: 1 });
  }, [active, template, library, controls]);

  const next = () => {
    const idx = queue.findIndex(l => l.lead_id === active.lead_id);
    if(idx < queue.length - 1) {
       setActive(queue[idx+1]);
       setMode("card");
    } else {
       onBack();
    }
  };

  const submitAction = async (outcome) => {
    vibrate();
    await controls.start({ x: 500, opacity: 0 });
    setQueue(prev => prev.filter(l => l.lead_id !== active.lead_id));
    signedRequest("MARK_SENT", { client_id: clientId, lead_id: active.lead_id, outcome });
    next();
  };

  const handleAction = async (type) => {
    vibrate();
    if(type === 'call') window.location.href = `tel:${active.phone}`;
    else if(type === 'email') {
        const subject = encodeURIComponent(`Regarding: ${active.context || "Our Discussion"}`);
        const body = encodeURIComponent(msg);
        window.location.href = `mailto:${active.email}?subject=${subject}&body=${body}`;
        submitAction("Emailed");
    }
    else if(type === 'share') {
       if(navigator.share) await navigator.share({ title: 'Lead', text: `${active.name} ${active.phone}` });
       else alert("Share not supported");
    } else {
       window.open(`https://wa.me/${active.phone}?text=${encodeURIComponent(msg)}`);
    }
    if (type !== 'email') setMode("disposition");
  };

  const handleRewrite = async (tone) => {
     setPolyglot(false);
     const res = await signedRequest("AI_REWRITE_MSG", { client_id: clientId, context: active.context, current_msg: msg, tone });
     const json = await res.json();
     if(json.data) setMsg(json.data);
  };
   
  const handleSnooze = (days) => {
     vibrate();
     const d = new Date(); d.setDate(d.getDate() + days);
     const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=Call ${active.name}&dates=${d.toISOString().replace(/-|:|\.\d+/g,"")}/${d.toISOString().replace(/-|:|\.\d+/g,"")}`;
     window.open(url, '_blank');
     submitAction("Snoozed");
  };

  if(!active) return <div className="p-10 text-center">Queue Finished!</div>;

  return (
    <div className="h-screen flex flex-col bg-slate-100 overflow-hidden relative">
       <div className="p-4 z-10 flex justify-between items-center">
          <button onClick={onBack} className="p-2 bg-white rounded-full shadow-sm"><ArrowLeft/></button>
          <div className="text-xs font-bold bg-white px-3 py-1 rounded-full shadow-sm text-gray-500">
            {queue.findIndex(l => l.lead_id === active.lead_id) + 1} / {queue.length}
          </div>
       </div>

       <div className="flex-1 flex items-center justify-center p-4">
         <AnimatePresence mode='wait'>
            {mode === 'card' ? (
              <motion.div key="card" animate={controls} className="bg-white w-full max-w-sm rounded-3xl shadow-xl overflow-hidden flex flex-col h-[75vh] border border-gray-100 relative">
                 {polyglot && (
                    <div className="absolute top-16 right-4 bg-white shadow-xl border rounded-xl p-2 z-20 flex flex-col gap-2">
                       <button onClick={() => handleRewrite('Professional')} className="text-xs font-bold p-2 hover:bg-gray-50 text-left">👔 Professional</button>
                       <button onClick={() => handleRewrite('Friendly')} className="text-xs font-bold p-2 hover:bg-gray-50 text-left">👋 Friendly</button>
                       <button onClick={() => handleRewrite('Urgent')} className="text-xs font-bold p-2 hover:bg-gray-50 text-left">🔥 Urgent</button>
                    </div>
                 )}
                 
                 <div className="p-6 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-100">
                    <h2 className="text-2xl font-bold truncate text-gray-800">{active.name}</h2>
                    <p className="text-blue-600 font-mono font-medium">{active.phone}</p>
                    <div className="flex flex-wrap gap-1 mt-2">
                        {active.company && <span className="text-[10px] bg-white text-gray-600 px-2 py-1 rounded border flex items-center gap-1"><Building2 size={10}/> {active.company}</span>}
                        {active.email && <span className="text-[10px] bg-white text-gray-600 px-2 py-1 rounded border flex items-center gap-1"><Mail size={10}/> {active.email}</span>}
                        {active.website && <span className="text-[10px] bg-white text-gray-600 px-2 py-1 rounded border flex items-center gap-1"><Globe size={10}/> {active.website}</span>}
                    </div>
                 </div>
                 
                 <div className="p-4 flex-1 bg-white flex flex-col relative">
                    <div className="flex justify-between items-center mb-2">
                       <label className="text-xs font-bold text-gray-400 uppercase">Message</label>
                       <button onClick={() => setPolyglot(!polyglot)} className="text-purple-600"><Wand2 size={16}/></button>
                    </div>
                    <textarea value={msg} onChange={e => setMsg(e.target.value)} className="w-full flex-1 bg-gray-50 p-4 rounded-xl outline-none resize-none text-sm text-gray-700 focus:ring-2 focus:ring-blue-100 transition-all"/>
                 </div>
                 
                 <div className="p-4 grid grid-cols-4 gap-2 bg-white border-t">
                    <button onClick={() => handleAction('call')} className="bg-gray-900 text-white p-3 rounded-xl font-bold flex flex-col items-center justify-center gap-1"><Phone size={20}/><span className="text-[8px]">Call</span></button>
                    <button onClick={() => handleAction('wa')} className="bg-green-600 text-white p-3 rounded-xl font-bold flex flex-col items-center justify-center gap-1"><Zap size={20}/><span className="text-[8px]">WA</span></button>
                    {active.email ? (
                        <button onClick={() => handleAction('email')} className="bg-blue-600 text-white p-3 rounded-xl font-bold flex flex-col items-center justify-center gap-1"><Mail size={20}/><span className="text-[8px]">Mail</span></button>
                    ) : (
                        <button disabled className="bg-gray-200 text-gray-400 p-3 rounded-xl font-bold flex flex-col items-center justify-center gap-1"><Mail size={20}/><span className="text-[8px]">No Mail</span></button>
                    )}
                    <button onClick={() => handleAction('share')} className="bg-pink-600 text-white p-3 rounded-xl font-bold flex flex-col items-center justify-center gap-1"><Share2 size={20}/><span className="text-[8px]">Share</span></button>
                 </div>
                 <div className="px-4 pb-4 flex gap-2">
                     <button onClick={() => setMode("snooze")} className="flex-1 bg-gray-100 text-gray-500 py-3 rounded-xl font-bold text-xs">Snooze</button>
                     <button onClick={() => next()} className="flex-1 bg-gray-100 text-red-400 py-3 rounded-xl font-bold text-xs">Skip</button>
                 </div>
              </motion.div>
            ) : mode === 'snooze' ? (
               <div className="bg-white w-full max-w-sm rounded-3xl shadow-xl p-8 flex flex-col justify-center items-center gap-4">
                  <h3 className="font-bold">Snooze until...</h3>
                  <button onClick={() => handleSnooze(1)} className="w-full p-4 bg-purple-50 text-purple-700 rounded-xl font-bold">Tomorrow</button>
                  <button onClick={() => handleSnooze(3)} className="w-full p-4 bg-purple-50 text-purple-700 rounded-xl font-bold">3 Days</button>
                  <button onClick={() => setMode("card")} className="mt-4 text-sm text-gray-400">Cancel</button>
               </div>
            ) : (
               <motion.div key="disp" initial={{opacity: 0, scale: 0.9}} animate={{opacity: 1, scale: 1}} className="bg-white w-full max-w-sm rounded-3xl shadow-xl p-8 flex flex-col justify-center items-center gap-4 border border-gray-200">
                  <h3 className="text-xl font-bold mb-4 text-gray-800">How did it go?</h3>
                  <button onClick={() => submitAction("Interested")} className="w-full p-4 bg-green-100 text-green-700 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-green-200"><ThumbsUp/> Interested</button>
                  <button onClick={() => submitAction("No Answer")} className="w-full p-4 bg-gray-100 text-gray-700 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-gray-200"><Snowflake/> No Answer</button>
                  <button onClick={() => submitAction("Hot")} className="w-full p-4 bg-orange-100 text-orange-600 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-orange-200"><Flame/> Hot Lead</button>
                  <button onClick={() => setMode("card")} className="mt-4 text-sm text-gray-400">Cancel</button>
               </motion.div>
            )}
         </AnimatePresence>
       </div>
    </div>
  );
}

function CameraScan({ onBack, onScanComplete, clientId }) {
    const fileInput = useRef(null);
    const [images, setImages] = useState([]);
    const [scanning, setScanning] = useState(false);

    const handleFile = (e) => {
        const file = e.target.files[0];
        if(!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            const img = new Image();
            img.onload = () => {
                const cvs = document.createElement('canvas');
                const scale = 800 / img.width;
                cvs.width = 800; cvs.height = img.height * scale;
                cvs.getContext('2d').drawImage(img, 0, 0, cvs.width, cvs.height);
                const b64 = cvs.toDataURL('image/jpeg', 0.7).split(',')[1];
                setImages(prev => [...prev, b64]);
            };
            img.src = ev.target.result;
        };
        reader.readAsDataURL(file);
    };

    const processImages = () => {
        setScanning(true);
        signedRequest("AI_ANALYZE_IMAGE", { client_id: clientId, images })
          .then(r => r.json())
          .then(res => {
              setScanning(false);
              if(res.data) onScanComplete(res.data);
              else alert("Could not read card");
          });
    };

    return (
        <div className="h-screen bg-black flex flex-col items-center justify-center text-white p-6 text-center">
           {scanning ? (
              <div className="flex flex-col items-center animate-in fade-in">
                 <div className="animate-spin rounded-full h-12 w-12 border-4 border-orange-500 border-t-transparent mb-4"></div>
                 <p className="font-bold">AI Analyzing {images.length} Image(s)...</p>
              </div>
           ) : (
              <>
                <Camera size={64} className="mb-6 text-orange-500"/>
                <h2 className="text-2xl font-bold mb-2">Scan Business Card</h2>
                <div className="flex gap-2 mb-8">
                   <div className={`w-3 h-3 rounded-full ${images.length >= 1 ? 'bg-green-500' : 'bg-gray-700'}`}></div>
                   <div className={`w-3 h-3 rounded-full ${images.length >= 2 ? 'bg-green-500' : 'bg-gray-700'}`}></div>
                </div>
                
                {images.length === 0 && <button onClick={() => fileInput.current.click()} className="w-full bg-orange-600 py-4 rounded-xl font-bold text-lg hover:bg-orange-700 transition-colors">Capture Front</button>}
                {images.length === 1 && (
                    <div className="space-y-3 w-full">
                        <button onClick={() => fileInput.current.click()} className="w-full bg-gray-800 border border-gray-600 py-4 rounded-xl font-bold text-lg hover:bg-gray-700 transition-colors">Capture Back (Optional)</button>
                        <button onClick={processImages} className="w-full bg-green-600 py-4 rounded-xl font-bold text-lg hover:bg-green-700 transition-colors">Analyze Card</button>
                    </div>
                )}
                {images.length === 2 && <button onClick={processImages} className="w-full bg-green-600 py-4 rounded-xl font-bold text-lg hover:bg-green-700 transition-colors">Analyze Both Sides</button>}
                
                <button onClick={onBack} className="mt-6 font-bold text-gray-500">Cancel</button>
                <input ref={fileInput} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFile} value=""/>
              </>
           )}
        </div>
    );
}

function BulkPasteForm({ initialData, clientId, onBack, onSubmit }) {
    const [text, setText] = useState("");
    const [parsed, setParsed] = useState(initialData || []);
    const [loading, setLoading] = useState(false);

    const handleAI = async () => {
        if(!text) return;
        setLoading(true);
        try {
            const res = await signedRequest("AI_PARSE_TEXT", { client_id: clientId, text });
            const json = await res.json();
            
            if(json.data && json.data.length > 0) {
               setParsed(json.data);
            } else {
               alert("No leads found. Did you paste the right text? (Name + Phone)");
            }
        } catch(e) { 
           alert("AI Error: " + e.message); 
        } finally { 
           setLoading(false); 
        }
    };

    if(parsed.length > 0) return (
        <div className="h-screen flex flex-col bg-gray-50">
           <div className="p-4 bg-white border-b flex justify-between items-center shadow-sm">
              <button onClick={() => setParsed([])} className="text-gray-500 flex items-center gap-1"><ArrowLeft size={16}/> Retry</button>
              <h2 className="font-bold text-gray-800">Found {parsed.length} Leads</h2>
           </div>
           <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {parsed.map((l, i) => (
                 <div key={i} className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm space-y-2">
                    <input value={l.name} onChange={e => {const n=[...parsed];n[i].name=e.target.value;setParsed(n)}} className="font-bold w-full outline-none text-gray-800 border-b border-transparent focus:border-blue-500"/>
                    <div className="flex items-center gap-2">
                       <span className="text-gray-400 text-xs">+91</span>
                       <input value={l.phone} onChange={e => {const n=[...parsed];n[i].phone=e.target.value;setParsed(n)}} className="text-sm font-mono w-full outline-none text-gray-600"/>
                    </div>
                    <input value={l.email} placeholder="Email" onChange={e => {const n=[...parsed];n[i].email=e.target.value;setParsed(n)}} className="text-xs w-full outline-none text-gray-500 border-b border-gray-100"/>
                    <input value={l.company} placeholder="Company" onChange={e => {const n=[...parsed];n[i].company=e.target.value;setParsed(n)}} className="text-xs w-full outline-none text-gray-500 border-b border-gray-100"/>
                 </div>
              ))}
           </div>
           <div className="p-4 bg-white border-t">
              <button onClick={() => onSubmit(parsed)} className="w-full bg-green-600 text-white py-4 rounded-xl font-bold shadow-lg">Save All</button>
           </div>
        </div>
    );

    return (
        <div className="h-screen bg-white p-6 flex flex-col">
           <button onClick={onBack} className="mb-4 text-gray-500"><ArrowLeft/></button>
           <h1 className="text-2xl font-black mb-2 text-gray-800">AI Paste</h1>
           <p className="text-gray-500 mb-4 text-sm">Paste messy text, Excel rows, or WhatsApp forwards here.</p>
           <textarea value={text} onChange={e => setText(e.target.value)} placeholder="e.g. John 9888822222, Sarah 9999911111..." className="flex-1 bg-gray-50 p-4 rounded-xl mb-4 resize-none outline-none border focus:border-blue-500 transition-colors"/>
           <button onClick={handleAI} disabled={loading || !text} className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white py-4 rounded-xl font-bold disabled:opacity-50 shadow-lg flex items-center justify-center gap-2">
              {loading ? "AI is Thinking..." : <><Wand2 size={20}/> Extract Leads</>}
           </button>
        </div>
    );
}

function ManualForm({ prefill, onBack, onSubmit }) {
    const [form, setForm] = useState(prefill || { name: '', phone: '', email: '', company: '', website: '', context: '' });
    const [listening, setListening] = useState(false);
     
    // VOICE INPUT
    const toggleMic = () => {
        if (!('webkitSpeechRecognition' in window)) return alert("Voice not supported");
        const recognition = new window.webkitSpeechRecognition();
        recognition.onstart = () => setListening(true);
        recognition.onend = () => setListening(false);
        recognition.onresult = (e) => setForm(f => ({...f, context: f.context + " " + e.results[0][0].transcript}));
        recognition.start();
    };

    return (
        <div className="p-6 bg-white h-screen overflow-y-auto">
           <button onClick={onBack} className="mb-6 text-gray-500"><ArrowLeft/></button>
           <h1 className="text-2xl font-bold mb-6 text-gray-800">Add Lead</h1>
           <div className="space-y-4">
              <input value={form.name} onChange={e=>setForm({...form, name: e.target.value})} placeholder="Name" className="w-full p-4 bg-gray-50 rounded-xl border outline-none focus:border-blue-500"/>
              <input value={form.phone} onChange={e=>setForm({...form, phone: e.target.value})} placeholder="Phone (e.g. 9876543210)" className="w-full p-4 bg-gray-50 rounded-xl border outline-none focus:border-blue-500"/>
              
              {/* NEW FIELDS: Email & Company */}
              <div className="grid grid-cols-2 gap-2">
                 <input value={form.email} onChange={e=>setForm({...form, email: e.target.value})} placeholder="Email" className="w-full p-4 bg-gray-50 rounded-xl border outline-none focus:border-blue-500"/>
                 <input value={form.company} onChange={e=>setForm({...form, company: e.target.value})} placeholder="Company" className="w-full p-4 bg-gray-50 rounded-xl border outline-none focus:border-blue-500"/>
              </div>
              
              <input value={form.website} onChange={e=>setForm({...form, website: e.target.value})} placeholder="Website" className="w-full p-4 bg-gray-50 rounded-xl border outline-none focus:border-blue-500"/>
              
              <div className="relative">
                 <input value={form.context} onChange={e=>setForm({...form, context: e.target.value})} placeholder="Notes / Context" className="w-full p-4 bg-gray-50 rounded-xl border outline-none focus:border-blue-500"/>
                 <button onClick={toggleMic} className={`absolute right-2 top-2 p-2 rounded-full ${listening ? 'bg-red-500 text-white animate-pulse' : 'bg-gray-200 text-gray-600'}`}><Mic size={20}/></button>
              </div>
              <button onClick={() => onSubmit(form)} className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold mt-4 shadow-lg">Save to Queue</button>
           </div>
        </div>
    );
}

function SettingsForm({ template, setTemplate, library, setLibrary, userProfile, setUserProfile, clientId, onBack, onLogout }) {
    const [newName, setNewName] = useState("");
    const [title, setTitle] = useState(userProfile.title || "");
    const [photo, setPhoto] = useState(userProfile.photo || "");

    const saveProfile = () => {
       signedRequest("UPDATE_PROFILE", { client_id: clientId, title, photo }).then(() => alert("Profile Saved"));
    };

    // Safe Logout Handler
    const handleLogout = () => {
        if (confirm("Are you sure you want to log out? Any unsaved changes in forms will be lost.")) {
            onLogout();
        }
    };

    return (
        <div className="p-6 bg-white h-screen overflow-y-auto">
           {/* Header with Back and Safe Logout */}
           <div className="flex justify-between items-center mb-6">
              <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full transition-colors"><ArrowLeft/></button>
              <button onClick={handleLogout} className="text-red-500 font-bold flex items-center gap-1 hover:bg-red-50 px-3 py-1 rounded-lg transition-colors">
                  <LogOut size={16}/> Logout
              </button>
           </div>
           
           <h1 className="text-2xl font-bold mb-6">Settings</h1>
           
           {/* Profile Section */}
           <div className="mb-8 p-4 border rounded-xl bg-gray-50">
              <h3 className="font-bold mb-4 flex items-center gap-2"><Briefcase size={16} className="text-blue-600"/> Digital Card Profile</h3>
              <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Your Job Title" className="w-full p-2 mb-2 rounded border text-sm focus:border-blue-500 outline-none"/>
              <input value={photo} onChange={e=>setPhoto(e.target.value)} placeholder="Photo URL" className="w-full p-2 mb-2 rounded border text-sm focus:border-blue-500 outline-none"/>
              <button onClick={saveProfile} className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-bold w-full hover:bg-blue-700 transition-colors">Save Profile</button>
           </div>

           {/* Template Editor */}
           <div className="mb-8">
              <h3 className="font-bold mb-2">Default Message Template</h3>
              <textarea value={template} onChange={e => setTemplate(e.target.value)} className="w-full h-24 p-4 bg-gray-50 rounded-xl mb-2 text-sm border outline-none focus:border-blue-500 transition-colors"/>
           </div>

           {/* Template Library */}
           <div>
              <h3 className="font-bold mb-2">Template Library</h3>
              <div className="flex gap-2 mb-4">
                 <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="New Template Name" className="flex-1 p-2 bg-gray-50 rounded-lg border focus:border-blue-500 outline-none"/>
                 <button onClick={() => { if(newName) { setLibrary([...library, {name: newName, text: template}]); setNewName(""); }}} className="bg-green-500 text-white p-2 rounded-lg hover:bg-green-600 transition-colors"><Plus/></button>
              </div>
              <div className="space-y-2">
                 {library.map((l, i) => (
                    <div key={i} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg border">
                       <span className="font-bold text-sm text-gray-700">{l.name}</span>
                       <button onClick={() => setLibrary(library.filter((_, idx) => idx !== i))} className="text-red-400 hover:text-red-600"><Trash2 size={16}/></button>
                    </div>
                 ))}
              </div>
           </div>
        </div>
    );
}

function HelpScreen({ onBack }) {
   return (
      <div className="p-6 bg-white h-screen overflow-y-auto">
         <button onClick={onBack} className="mb-6"><ArrowLeft/></button>
         <h1 className="text-2xl font-bold mb-6">Help & FAQ</h1>
         <div className="space-y-6">
            <div><h3 className="font-bold">How do I add leads?</h3><p className="text-gray-500 text-sm">Use "Add One" for single entry, or "AI Paste" to copy-paste messy text from WhatsApp or Excel.</p></div>
            <div><h3 className="font-bold">How does the Digital Card work?</h3><p className="text-gray-500 text-sm">Click the scan icon on the top right. Share that link. When people enter their details there, they appear in your queue instantly.</p></div>
            <div><h3 className="font-bold">Is data secure?</h3><p className="text-gray-500 text-sm">Yes. Your data is stored in your private Google Sheet.</p></div>
         </div>
      </div>
   );
}

function DigitalCard({ profileId }) {
    const [profile, setProfile] = useState(null);
    const [sent, setSent] = useState(false);
     
    useEffect(() => {
       signedRequest("GET_CLIENT_PROFILE", { client_id: profileId })
         .then(r => r.json())
         .then(j => setProfile(j.data));
    }, [profileId]);

    const submit = (e) => {
       e.preventDefault();
       const data = { name: e.target.name.value, phone: e.target.phone.value, context: "Digital Card Signup" };
       signedRequest("ADD_LEADS", { client_id: profileId, leads: [data] }).then(() => setSent(true));
    };

    if(!profile) return <div className="h-screen flex items-center justify-center">Loading Profile...</div>;
    if(sent) return <div className="h-screen flex flex-col items-center justify-center p-10 text-center"><CheckCircle2 size={64} className="text-green-500 mb-4"/><h1 className="text-2xl font-bold">Details Sent!</h1><p>{profile.name} will contact you shortly.</p></div>;

    return (
        <div className="h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
           <div className="bg-white p-8 rounded-3xl shadow-xl w-full max-w-sm text-center">
              {profile.photo && <img src={profile.photo} alt="Profile" className="w-24 h-24 rounded-full mx-auto mb-4 object-cover border-4 border-white shadow-md"/>}
              <h1 className="text-2xl font-bold text-gray-900">{profile.name}</h1>
              <p className="text-blue-600 font-medium mb-6">{profile.title || "Consultant"}</p>
              
              <form onSubmit={submit} className="space-y-4 text-left">
                 <div>
                    <label className="text-xs font-bold text-gray-500 uppercase ml-1">Your Name</label>
                    <input name="name" required className="w-full p-3 bg-gray-50 rounded-xl border outline-none focus:border-blue-500"/>
                 </div>
                 <div>
                    <label className="text-xs font-bold text-gray-500 uppercase ml-1">Your Phone</label>
                    <input name="phone" required type="tel" className="w-full p-3 bg-gray-50 rounded-xl border outline-none focus:border-blue-500"/>
                 </div>
                 <button className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold shadow-lg mt-2">Connect Now</button>
              </form>
           </div>
        </div>
    );
}

function AdminDashboard() {
   // --- NEW: Client Generation Form ---
   const [formData, setFormData] = useState({ name: '', phone: '', plan: 'Free' });
   const [loading, setLoading] = useState(false);
   
   // --- NEW: Real Stats State ---
   const [stats, setStats] = useState({ clients: 0, leads: 0, hits: 0 });

   // Fetch Real Stats on Mount
   useEffect(() => {
      signedRequest("GET_ADMIN_STATS", { admin_key: ADMIN_KEY, client_id: ADMIN_KEY })
        .then(r => r.json())
        .then(json => {
           if(json.status === 'success') setStats(json.data);
        });
   }, []);

   const createClient = async () => {
      if(!formData.name || !formData.phone) return alert("Enter Name and Phone");
      setLoading(true);
      try {
         const res = await signedRequest("ADD_CLIENT", { ...formData, admin_key: ADMIN_KEY, client_id: ADMIN_KEY });
         const json = await res.json();
         if(json.status === 'success') {
            alert(`Client Created!\n\nKEY: ${json.data.key}\nURL: ${json.data.url}`);
            setFormData({ name: '', phone: '', plan: 'Free' });
            // Refresh stats
            setStats(prev => ({ ...prev, clients: prev.clients + 1 }));
         } else {
            alert("Error: " + json.message);
         }
      } catch(e) { alert("Failed: " + e.message); }
      finally { setLoading(false); }
   };

   return (
      <div className="h-screen bg-slate-900 text-white p-6 overflow-y-auto">
         <div className="flex items-center gap-3 mb-8">
            <LayoutDashboard className="text-orange-500"/>
            <h1 className="text-2xl font-bold">Master View</h1>
         </div>
         
         {/* Stats Grid */}
         <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
               <p className="text-gray-400 text-xs uppercase tracking-wider">Total Clients</p>
               <p className="text-3xl font-black mt-1 text-white">{stats.clients}</p>
            </div>
            <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
               <p className="text-gray-400 text-xs uppercase tracking-wider">Total Leads</p>
               <p className="text-3xl font-black mt-1 text-blue-400">{stats.leads}</p>
            </div>
         </div>

         {/* Create Client Section */}
         <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 mb-8 shadow-xl">
            <h3 className="font-bold mb-4 flex items-center gap-2"><UserCheck size={20} className="text-green-400"/> Create New Client</h3>
            <div className="space-y-3">
               <input value={formData.name} onChange={e=>setFormData({...formData, name: e.target.value})} placeholder="Client Name" className="w-full p-3 rounded-lg bg-slate-900 border border-slate-600 outline-none focus:border-green-500 transition-colors"/>
               <input value={formData.phone} onChange={e=>setFormData({...formData, phone: e.target.value})} placeholder="Phone Number" className="w-full p-3 rounded-lg bg-slate-900 border border-slate-600 outline-none focus:border-green-500 transition-colors"/>
               <select value={formData.plan} onChange={e=>setFormData({...formData, plan: e.target.value})} className="w-full p-3 rounded-lg bg-slate-900 border border-slate-600 outline-none text-gray-300">
                  <option value="Free">Free Plan</option>
                  <option value="Pro">Pro Plan</option>
               </select>
               <button onClick={createClient} disabled={loading} className="w-full bg-green-600 py-3 rounded-lg font-bold hover:bg-green-500 transition-colors disabled:opacity-50 text-white shadow-lg shadow-green-900/20">
                  {loading ? "Generating Keys..." : "Generate Access Key"}
               </button>
            </div>
         </div>

         {/* System Health */}
         <div className="p-4 bg-slate-800 rounded-xl border border-slate-700">
            <h3 className="font-bold mb-4 flex items-center gap-2 text-gray-300"><BarChart3 size={16}/> System Health</h3>
            <div className="space-y-3 text-sm text-gray-400">
               <div className="flex justify-between border-b border-slate-700 pb-2"><span>API Hits (10m)</span> <span className="text-white font-mono">{stats.hits}</span></div>
               <div className="flex justify-between border-b border-slate-700 pb-2"><span>Status</span> <span className="text-green-400 font-bold">OPERATIONAL</span></div>
               <div className="flex justify-between"><span>Version</span> <span className="text-gray-500">v22.1.0</span></div>
            </div>
         </div>
      </div>
   );
}

function AdminLogin({ onLogin }) {
  const [pw, setPw] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault(); // Prevents page reload
    if (pw.trim() === ADMIN_PASSWORD) {
      onLogin();
    } else {
      alert(`Access Denied. You typed: '${pw}'`);
    }
  };

  return (
    <div className="h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-white">
      <Lock size={48} className="mb-6 text-orange-500" />
      <h2 className="text-xl font-bold mb-6">Thrivoy Admin</h2>
      
      <form onSubmit={handleSubmit} className="w-full max-w-xs flex flex-col gap-4">
        <input
          type="password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          className="w-full p-4 rounded-xl bg-slate-800 text-center text-white font-bold tracking-widest outline-none border border-slate-700 focus:border-orange-500 transition-colors"
          placeholder="ENTER CODE"
          autoFocus
        />
        <button type="submit" className="w-full py-4 bg-orange-600 rounded-xl font-bold hover:bg-orange-700 transition-colors shadow-lg shadow-orange-900/20 active:scale-95">
          UNLOCK
        </button>
      </form>
    </div>
  );
}

function LandingPage() {
  const handleLogin = (e) => {
    e.preventDefault();
    const k = e.target.key.value;
    if(k) window.location.search = `?key=${k}`;
  };

  const scrollToLogin = () => {
    // --- SCROLL FIX: Added offset so it doesn't hide under header ---
    const el = document.getElementById('login-form');
    if(el) {
       // Manual scroll with offset calculation
       const y = el.getBoundingClientRect().top + window.pageYOffset - 150;
       window.scrollTo({top: y, behavior: 'smooth'});
    }
  };

  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans selection:bg-blue-100">
      
      {/* --- NAVBAR --- */}
      <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 font-black text-xl tracking-tight">
            <div className="w-8 h-8 bg-blue-600 rounded-lg text-white flex items-center justify-center text-lg shadow-blue-200 shadow-lg">T</div>
            Thrivoy
          </div>
          <button onClick={scrollToLogin} className="text-sm font-bold bg-gray-900 text-white px-5 py-2 rounded-full hover:bg-black transition-colors">
            Member Login
          </button>
        </div>
      </nav>

      {/* --- HERO SECTION --- */}
      <header className="relative pt-20 pb-32 overflow-hidden bg-gradient-to-b from-white to-gray-50/50">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-blue-100/40 rounded-full blur-[100px] -z-10"></div>
        
        <div className="max-w-4xl mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-2 mb-8 px-4 py-2 rounded-full bg-blue-50 border border-blue-100 text-blue-700 text-xs font-bold uppercase tracking-wider shadow-sm">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
            </span>
            v2.0 Now Live for India
          </div>
          
          <h1 className="text-5xl md:text-7xl font-black mb-6 tracking-tight text-gray-900 leading-[1.1]">
            Stop managing leads.<br/>
            Start <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">closing deals</span>.
          </h1>
          
          <p className="text-xl text-gray-500 mb-10 max-w-2xl mx-auto leading-relaxed">
            The secret weapon for Real Estate, Insurance, and Sales pros. 
            Ditch the diaries and messy Excel sheets.
          </p>

          {/* --- LOGIN BOX (THE GATEKEEPER) --- */}
          {/* Added scroll-mt class for Tailwind offset support */}
          <div id="login-form" className="scroll-mt-32 bg-white p-3 rounded-2xl shadow-2xl shadow-blue-900/10 border border-gray-200 max-w-md mx-auto transform hover:scale-[1.01] transition-transform duration-300">
            <form onSubmit={handleLogin} className="flex gap-2">
              <input 
                name="key" 
                placeholder="Enter Invite Key" 
                className="flex-1 bg-gray-50 text-gray-900 font-bold px-6 py-4 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-all placeholder:font-medium placeholder:text-gray-400"
              />
              <button className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-4 rounded-xl font-bold transition-colors flex items-center gap-2 shadow-lg shadow-blue-200">
                Enter <ArrowLeft size={18} className="rotate-180"/>
              </button>
            </form>
          </div>
          <p className="mt-6 text-sm text-gray-500 font-medium">
            Don't have a key? <a href="#" className="text-blue-600 hover:underline">Request access</a>
          </p>
        </div>
      </header>

      {/* --- HOW IT WORKS --- */}
      <section className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-black mb-4 text-gray-900">3 Steps to Revenue</h2>
            <p className="text-gray-500">Simple enough for beginners. Powerful enough for top tier agents.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-12 relative">
            {/* Connector Line (Desktop Only) */}
            <div className="hidden md:block absolute top-12 left-[20%] right-[20%] h-0.5 bg-gradient-to-r from-gray-200 via-blue-200 to-gray-200 -z-10"></div>

            <div className="text-center bg-white">
              <div className="w-24 h-24 mx-auto bg-blue-50 rounded-full flex items-center justify-center mb-6 border-4 border-white shadow-lg">
                <Upload size={32} className="text-blue-600"/>
              </div>
              <h3 className="text-xl font-bold mb-2">1. Dump the Data</h3>
              <p className="text-gray-500 text-sm px-4">Paste messy WhatsApp lists, forward emails, or upload CSVs. Our AI cleans it instantly.</p>
            </div>

            <div className="text-center bg-white">
              <div className="w-24 h-24 mx-auto bg-purple-50 rounded-full flex items-center justify-center mb-6 border-4 border-white shadow-lg">
                <Wand2 size={32} className="text-purple-600"/>
              </div>
              <h3 className="text-xl font-bold mb-2">2. AI Sorting</h3>
              <p className="text-gray-500 text-sm px-4">Thrivoy identifies hot leads, categorizes them, and queues them up for calling.</p>
            </div>

            <div className="text-center bg-white">
              <div className="w-24 h-24 mx-auto bg-green-50 rounded-full flex items-center justify-center mb-6 border-4 border-white shadow-lg">
                <CheckCircle2 size={32} className="text-green-600"/>
              </div>
              <h3 className="text-xl font-bold mb-2">3. Close & Repeat</h3>
              <p className="text-gray-500 text-sm px-4">Speed dial through your list. Send WhatsApp follow-ups in 1 click. Double your speed.</p>
            </div>
          </div>
        </div>
      </section>

      {/* --- PRICING SECTION (NEW) --- */}
      <section className="py-24 bg-gray-50 border-y border-gray-200">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-black mb-4 text-gray-900">Simple, Transparent Pricing</h2>
            <p className="text-gray-500">Pay for performance. Cancel anytime.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto items-center">
            
            {/* FREE TIER */}
            <div className="bg-white p-8 rounded-3xl border border-gray-200 shadow-sm text-center">
              <h3 className="font-bold text-lg text-gray-500 mb-2">Starter</h3>
              <div className="text-4xl font-black mb-6">Free</div>
              <ul className="space-y-4 mb-8 text-left text-sm text-gray-600">
                <li className="flex items-center gap-2"><CheckCircle2 size={16} className="text-green-500"/> 50 Leads Capacity</li>
                <li className="flex items-center gap-2"><CheckCircle2 size={16} className="text-green-500"/> Basic Calling Queue</li>
                <li className="flex items-center gap-2"><CheckCircle2 size={16} className="text-green-500"/> 1 Digital Card</li>
                <li className="flex items-center gap-2 opacity-50"><X size={16}/> No AI Rewriting</li>
              </ul>
              <button onClick={scrollToLogin} className="w-full py-3 rounded-xl border-2 border-gray-200 font-bold hover:bg-gray-50 transition-colors">Try Free</button>
            </div>

            {/* PRO TIER (HIGHLIGHTED) */}
            <div className="bg-gray-900 text-white p-8 rounded-3xl shadow-2xl relative transform scale-105 z-10">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 bg-gradient-to-r from-blue-500 to-indigo-500 text-white text-xs font-bold px-3 py-1 rounded-b-lg">MOST POPULAR</div>
              <h3 className="font-bold text-lg text-gray-400 mb-2 mt-2">Pro Agent</h3>
              <div className="text-5xl font-black mb-1">₹999<span className="text-lg font-medium text-gray-500">/mo</span></div>
              <p className="text-gray-400 text-xs mb-6">Billed annually</p>
              
              <ul className="space-y-4 mb-8 text-left text-sm">
                <li className="flex items-center gap-2"><CheckCircle2 size={16} className="text-green-400"/> Unlimited Leads</li>
                <li className="flex items-center gap-2"><CheckCircle2 size={16} className="text-green-400"/> Full AI Suite (Parsing + Writing)</li>
                <li className="flex items-center gap-2"><CheckCircle2 size={16} className="text-green-400"/> Hot Lead Vault</li>
                <li className="flex items-center gap-2"><CheckCircle2 size={16} className="text-green-400"/> WhatsApp Integration</li>
                <li className="flex items-center gap-2"><CheckCircle2 size={16} className="text-green-400"/> Priority Support</li>
              </ul>
              <button onClick={scrollToLogin} className="w-full py-4 rounded-xl bg-blue-600 font-bold hover:bg-blue-500 transition-colors shadow-lg shadow-blue-900/50">Get Started</button>
            </div>

            {/* TEAM TIER */}
            <div className="bg-white p-8 rounded-3xl border border-gray-200 shadow-sm text-center">
              <h3 className="font-bold text-lg text-gray-500 mb-2">Teams</h3>
              <div className="text-4xl font-black mb-6">Custom</div>
              <ul className="space-y-4 mb-8 text-left text-sm text-gray-600">
                <li className="flex items-center gap-2"><CheckCircle2 size={16} className="text-green-500"/> Everything in Pro</li>
                <li className="flex items-center gap-2"><CheckCircle2 size={16} className="text-green-500"/> Team Dashboard</li>
                <li className="flex items-center gap-2"><CheckCircle2 size={16} className="text-green-500"/> Lead Distribution</li>
                <li className="flex items-center gap-2"><CheckCircle2 size={16} className="text-green-500"/> Performance Analytics</li>
              </ul>
              <button onClick={scrollToLogin} className="w-full py-3 rounded-xl border-2 border-gray-200 font-bold hover:bg-gray-50 transition-colors">Contact Sales</button>
            </div>

          </div>
        </div>
      </section>

      {/* --- CASE STUDIES --- */}
      <section className="py-24 bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-3xl font-black mb-12 text-center text-gray-900">Built for Indian Markets</h2>
          
          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-slate-50 p-8 rounded-3xl border border-slate-200 hover:border-blue-500 transition-colors">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">RE</div>
                <div>
                  <h4 className="font-bold text-lg text-gray-900">Real Estate</h4>
                  <p className="text-gray-500 text-sm">Managing 500+ site visits</p>
                </div>
              </div>
              <p className="text-gray-600 mb-6 italic">"I used to lose leads in my phonebook. With Thrivoy, I dump all inquiries from MagicBricks and 99acres into the engine. My conversion jumped 40% in month one."</p>
              <div className="flex gap-3 text-sm font-bold text-gray-800 items-center">
                <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center text-xs">VS</div>
                Vikram S., Property Consultant, Pune
              </div>
            </div>

            <div className="bg-slate-50 p-8 rounded-3xl border border-slate-200 hover:border-green-500 transition-colors">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 bg-green-600 text-white rounded-full flex items-center justify-center font-bold">INS</div>
                <div>
                  <h4 className="font-bold text-lg text-gray-900">Insurance & Loans</h4>
                  <p className="text-gray-500 text-sm">High volume calling</p>
                </div>
              </div>
              <p className="text-gray-600 mb-6 italic">"Speed is everything. I can call 50 people in an hour using the Queue mode. The AI rewriting my WhatsApp messages makes me look super professional."</p>
              <div className="flex gap-3 text-sm font-bold text-gray-800 items-center">
                <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center text-xs">PM</div>
                Priya M., Financial Advisor, Mumbai
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* --- FAQ --- */}
      <section className="py-24 bg-gray-50 border-t border-gray-100">
        <div className="max-w-3xl mx-auto px-6">
          <h2 className="text-3xl font-black mb-10 text-center text-gray-900">Frequently Asked Questions</h2>
          <div className="space-y-4">
            <details className="group bg-white p-6 rounded-2xl cursor-pointer open:bg-blue-50 transition-colors shadow-sm">
              <summary className="font-bold text-lg flex justify-between items-center text-gray-800 list-none">
                Is my client data safe?
                <ChevronRight className="group-open:rotate-90 transition-transform"/>
              </summary>
              <p className="mt-4 text-gray-600 leading-relaxed">
                100% Safe. Thrivoy is a "Headless" engine. We don't store your database. All your data lives in your own private Google Sheet. We just provide the fast interface to manage it.
              </p>
            </details>

            <details className="group bg-white p-6 rounded-2xl cursor-pointer open:bg-blue-50 transition-colors shadow-sm">
              <summary className="font-bold text-lg flex justify-between items-center text-gray-800 list-none">
                Do I need a laptop?
                <ChevronRight className="group-open:rotate-90 transition-transform"/>
              </summary>
              <p className="mt-4 text-gray-600 leading-relaxed">
                No. Thrivoy is designed as a "Mobile First" web app. It works perfectly on your phone browser, making it easy to call and WhatsApp leads directly.
              </p>
            </details>

            <details className="group bg-white p-6 rounded-2xl cursor-pointer open:bg-blue-50 transition-colors shadow-sm">
              <summary className="font-bold text-lg flex justify-between items-center text-gray-800 list-none">
                Does it work with WhatsApp?
                <ChevronRight className="group-open:rotate-90 transition-transform"/>
              </summary>
              <p className="mt-4 text-gray-600 leading-relaxed">
                Yes. We have a native "One-Click WhatsApp" button. You can also use our AI to rewrite messages to sound more professional or friendly before sending.
              </p>
            </details>
          </div>
        </div>
      </section>

      {/* --- FOOTER CTA --- */}
      <footer className="py-12 bg-white text-center border-t">
        <h3 className="text-2xl font-bold mb-6">Ready to upgrade your workflow?</h3>
        <button onClick={scrollToLogin} className="bg-gray-900 text-white px-8 py-4 rounded-xl font-bold hover:scale-105 transition-transform shadow-xl">
          Enter Your Key
        </button>
        <div className="mt-12 text-gray-400 text-sm">
          &copy; {new Date().getFullYear()} Thrivoy Systems. Made with <span className="text-red-400">♥</span> in India.
        </div>
      </footer>

    </div>
  );
}

const root = createRoot(document.getElementById('root'));
root.render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);