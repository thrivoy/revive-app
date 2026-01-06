import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { FixedSizeList as List } from 'react-window';

// --- FIX: Bulletproof Import for AutoSizer ---
import * as AutoSizerPkg from 'react-virtualized-auto-sizer';
const AutoSizer = AutoSizerPkg.default || AutoSizerPkg;

import { motion, useAnimation, AnimatePresence } from 'framer-motion';
import Papa from 'papaparse';
import { 
  Phone, Upload, UserPlus, ArrowLeft, Trash2, Zap, ScanLine, Settings, 
  List as ListIcon, Plus, X, Wand2, Info, Play, Mail, Clock, Flame, 
  ThumbsUp, Snowflake, ShieldCheck, Camera, Mic, LogOut, Save, 
  Share2, Users, RefreshCw, ChevronRight, Lock, Globe, Briefcase, HelpCircle,
  LayoutDashboard, BarChart3, CheckCircle2, WifiOff
} from 'lucide-react';

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

// Request Cache for Deduplication
const requestCache = new Map();
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
           <div className="text-xs text-gray-500 font-mono">{lead.phone}</div>
           {lead.context && <div className="text-[10px] text-blue-600 mt-1 truncate bg-blue-50 inline-block px-1 rounded">{lead.context}</div>}
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
           email: r.Email || ""
        }));
        setBulkData(valid);
        setView("bulk");
    }});
  };

  if (!isOnline) return <div className="h-screen flex flex-col items-center justify-center p-6 text-center"><WifiOff size={48} className="text-gray-300 mb-4"/><h2 className="text-xl font-bold">Offline</h2><p className="text-gray-500">Check internet.</p></div>;

  if (publicId) return <DigitalCard profileId={publicId} />;
  if (!clientId) return <LandingPage />;
  if (clientId === ADMIN_KEY) return <AdminLogin onLogin={() => setView("admin")} />;
  if (view === "admin") return <AdminDashboard />;
  
  // Main Views
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

// --- SUB SCREENS ---

function MenuScreen({ queue, stats, loading, onViewChange, onUpload, onRefresh, clientId, onBulkSubmit }) {
  const shareCard = () => {
      const url = `${window.location.origin}?u=${clientId}`;
      if(navigator.share) navigator.share({ title: 'My Digital Card', url });
      else alert("Link copied: " + url);
  };

  // NATIVE CONTACT PICKER
  const importContacts = async () => {
    if ('contacts' in navigator && 'ContactsManager' in window) {
       try {
          const props = ['name', 'tel'];
          const contacts = await navigator.contacts.select(props, { multiple: true });
          if (contacts.length > 0) {
             const formatted = contacts.map(c => ({
               name: c.name[0],
               phone: c.tel[0],
               context: "Imported from Phonebook"
             }));
             onBulkSubmit(formatted);
          }
       } catch (ex) { console.log(ex); }
    } else {
       alert("Use 'AI Paste' for non-mobile devices.");
    }
  };

  return (
    <div className="max-w-md mx-auto min-h-screen bg-gray-50 pb-safe">
      <header className="bg-white p-4 flex justify-between items-center shadow-sm sticky top-0 z-10">
         <h1 className="font-bold text-xl flex items-center gap-2 text-gray-800">
           <div className="w-8 h-8 bg-blue-600 rounded-lg text-white flex items-center justify-center font-black">T</div> Thrivoy
         </h1>
         <div className="flex gap-2">
           <button onClick={shareCard} className="p-2 rounded-full bg-blue-50 text-blue-600"><ScanLine size={20}/></button>
           <button onClick={onRefresh} className={`p-2 rounded-full bg-gray-100 ${loading && 'animate-spin'}`}><RefreshCw size={20}/></button>
           <button onClick={() => onViewChange("settings")} className="p-2 rounded-full bg-gray-100"><Settings size={20}/></button>
         </div>
      </header>
      
      <main className="p-4 space-y-4 animate-in fade-in">
         {/* Stats */}
         <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-5 text-white shadow-xl shadow-blue-200 flex justify-between items-center relative overflow-hidden">
            <div className="relative z-10">
               <p className="text-blue-100 text-xs font-bold uppercase tracking-wider">Today's Wins</p>
               <p className="text-4xl font-black mt-1">{stats.today}</p>
            </div>
            <div className="bg-white/20 p-3 rounded-xl relative z-10"><Zap size={24} fill="currentColor"/></div>
         </div>

         {/* Queue Status */}
         <button onClick={() => onViewChange("list")} className="w-full bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex justify-between items-center active:bg-gray-50 transition-colors">
            <div className="flex items-center gap-3">
               <div className="bg-orange-100 text-orange-600 p-2 rounded-lg"><ListIcon size={20}/></div>
               <div className="text-left">
                  <p className="font-bold text-gray-800">Active Queue</p>
                  <p className="text-xs text-gray-500">{queue.length} / {LEAD_LIMIT} leads</p>
               </div>
            </div>
            <ChevronRight size={20} className="text-gray-300"/>
         </button>

         {/* Actions */}
         <div className="grid grid-cols-2 gap-4">
            <button onClick={() => onViewChange("camera")} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col items-center gap-2 active:scale-95 transition-transform">
               <Camera size={28} className="text-purple-500"/>
               <span className="font-bold text-sm text-gray-700">Scan Card</span>
            </button>
            <button onClick={() => onViewChange("bulk")} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col items-center gap-2 active:scale-95 transition-transform">
               <Wand2 size={28} className="text-pink-500"/>
               <span className="font-bold text-sm text-gray-700">AI Paste</span>
            </button>
            <button onClick={() => onViewChange("manual")} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col items-center gap-2 active:scale-95 transition-transform">
               <UserPlus size={28} className="text-green-500"/>
               <span className="font-bold text-sm text-gray-700">Add One</span>
            </button>
            <button onClick={() => onViewChange("hotlist")} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col items-center gap-2 active:scale-95 transition-transform">
               <Flame size={28} className="text-orange-500"/>
               <span className="font-bold text-sm text-gray-700">Hot Vault</span>
            </button>
         </div>
         
         {/* Native Contacts */}
         {('contacts' in navigator) && (
            <button onClick={importContacts} className="w-full bg-indigo-50 text-indigo-700 p-3 rounded-xl border border-indigo-100 font-bold flex items-center justify-center gap-2">
               <Users size={20}/> Import from Contacts
            </button>
         )}

         <div className="flex gap-2">
            <label className="flex-1 bg-gray-100 p-3 rounded-xl text-center text-xs font-bold text-gray-500 cursor-pointer hover:bg-gray-200 flex items-center justify-center gap-2">
               <Upload size={16}/> Upload CSV <input type="file" accept=".csv" onChange={onUpload} className="hidden"/>
            </label>
            <button onClick={() => onViewChange("help")} className="bg-gray-100 p-3 rounded-xl text-gray-500"><HelpCircle size={16}/></button>
         </div>

         {queue.length > 0 && (
           <button onClick={() => onViewChange("stack")} className="w-full py-4 bg-gray-900 text-white rounded-xl font-bold shadow-xl flex items-center justify-center gap-2 mt-4 active:scale-[0.98] transition-transform">
              <Play fill="currentColor" size={20}/> Start Calling
           </button>
         )}
      </main>
    </div>
  );
}

function HotList({ clientId, onBack }) {
   const [leads, setLeads] = useState([]);
   const [loading, setLoading] = useState(true);

   useEffect(() => {
     signedRequest("GET_HOTLIST", { client_id: clientId })
       .then(r => r.json())
       .then(j => { setLeads(j.data || []); setLoading(false); });
   }, [clientId]);

   return (
     <div className="h-screen bg-gray-50 flex flex-col">
       <div className="bg-white p-4 border-b flex items-center gap-3 sticky top-0">
          <button onClick={onBack}><ArrowLeft/></button>
          <h2 className="font-bold flex items-center gap-2"><Flame className="text-orange-500" fill="currentColor"/> Hot Vault</h2>
       </div>
       <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading ? <div className="text-center p-10 text-gray-400">Opening Vault...</div> : leads.length === 0 ? <div className="text-center p-10 text-gray-400">No hot leads yet.</div> : (
             leads.map((lead, i) => (
                <div key={i} className="bg-white p-4 rounded-xl border border-orange-100 shadow-sm flex justify-between items-center">
                   <div>
                      <h3 className="font-bold text-gray-800">{lead.name}</h3>
                      <p className="text-blue-600 font-mono text-sm">{lead.phone}</p>
                   </div>
                   <a href={`tel:${lead.phone}`} className="bg-green-100 text-green-700 p-2 rounded-full"><Phone size={18}/></a>
                </div>
             ))
          )}
       </div>
     </div>
   );
}

function QueueList({ queue, onBack, onSelect }) {
  // PERFORMANCE FIX: Virtualized List
  return (
    <div className="h-screen flex flex-col bg-gray-50">
       <div className="bg-white p-4 border-b flex items-center gap-3">
          <button onClick={onBack}><ArrowLeft/></button>
          <h2 className="font-bold">Queue ({queue.length})</h2>
       </div>
       <div className="flex-1">
          <AutoSizer>
             {({ height, width }) => (
                <List height={height} width={width} itemCount={queue.length} itemSize={80} itemData={{queue, onSelect}}>
                   {QueueRow}
                </List>
             )}
          </AutoSizer>
       </div>
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

  // NATIVE SHARE
  const handleAction = async (type) => {
    vibrate();
    if(type === 'call') window.location.href = `tel:${active.phone}`;
    else if(type === 'share') {
       if(navigator.share) await navigator.share({ title: 'Message', text: msg });
       else alert("Share not supported");
    } else {
       window.open(`https://wa.me/${active.phone}?text=${encodeURIComponent(msg)}`);
    }
    setMode("disposition");
  };

  const handleRewrite = async (tone) => {
     setPolyglot(false);
     const res = await signedRequest("AI_REWRITE_MSG", { client_id: clientId, context: active.context, current_msg: msg, tone });
     const json = await res.json();
     if(json.data) setMsg(json.data);
  };
  
  // CALENDAR SNOOZE
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
                 {/* POLYGLOT MENU */}
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
                    {active.context && <div className="mt-2 text-[10px] bg-white text-gray-600 inline-block px-2 py-1 rounded border border-gray-200">{active.context}</div>}
                 </div>
                 
                 <div className="p-4 flex-1 bg-white flex flex-col relative">
                    <div className="flex justify-between items-center mb-2">
                       <label className="text-xs font-bold text-gray-400 uppercase">Message</label>
                       <button onClick={() => setPolyglot(!polyglot)} className="text-purple-600"><Wand2 size={16}/></button>
                    </div>
                    <textarea value={msg} onChange={e => setMsg(e.target.value)} className="w-full flex-1 bg-gray-50 p-4 rounded-xl outline-none resize-none text-sm text-gray-700 focus:ring-2 focus:ring-blue-100 transition-all"/>
                 </div>
                 
                 <div className="p-4 grid grid-cols-3 gap-2 bg-white border-t">
                    <button onClick={() => handleAction('call')} className="bg-gray-900 text-white p-3 rounded-xl font-bold flex flex-col items-center justify-center gap-1"><Phone size={20}/><span className="text-[10px]">Call</span></button>
                    <button onClick={() => handleAction('wa')} className="bg-green-600 text-white p-3 rounded-xl font-bold flex flex-col items-center justify-center gap-1"><Zap size={20}/><span className="text-[10px]">WhatsApp</span></button>
                    <button onClick={() => handleAction('share')} className="bg-pink-600 text-white p-3 rounded-xl font-bold flex flex-col items-center justify-center gap-1"><Share2 size={20}/><span className="text-[10px]">Share</span></button>
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
    const [scanning, setScanning] = useState(false);

    const handleFile = (e) => {
        const file = e.target.files[0];
        if(!file) return;
        setScanning(true);
        const reader = new FileReader();
        reader.onload = (ev) => {
            const img = new Image();
            img.onload = () => {
                const cvs = document.createElement('canvas');
                const scale = 800 / img.width;
                cvs.width = 800; cvs.height = img.height * scale;
                cvs.getContext('2d').drawImage(img, 0, 0, cvs.width, cvs.height);
                const b64 = cvs.toDataURL('image/jpeg', 0.7).split(',')[1];
                
                signedRequest("AI_ANALYZE_IMAGE", { client_id: clientId, image: b64 })
                  .then(r => r.json())
                  .then(res => {
                     setScanning(false);
                     if(res.data) onScanComplete(res.data);
                     else alert("Could not read card");
                  });
            };
            img.src = ev.target.result;
        };
        reader.readAsDataURL(file);
    };

    return (
        <div className="h-screen bg-black flex flex-col items-center justify-center text-white p-6 text-center">
           {scanning ? (
              <div className="flex flex-col items-center animate-in fade-in">
                 <div className="animate-spin rounded-full h-12 w-12 border-4 border-orange-500 border-t-transparent mb-4"></div>
                 <p className="font-bold">AI Analyzing...</p>
              </div>
           ) : (
              <>
                <Camera size={64} className="mb-6 text-orange-500"/>
                <h2 className="text-2xl font-bold mb-2">Scan Business Card</h2>
                <p className="text-gray-400 mb-8">AI will extract Name, Phone, and Role.</p>
                <button onClick={() => fileInput.current.click()} className="w-full bg-orange-600 py-4 rounded-xl font-bold text-lg hover:bg-orange-700 transition-colors">Open Camera</button>
                <button onClick={onBack} className="mt-6 font-bold text-gray-500">Cancel</button>
                <input ref={fileInput} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFile}/>
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
            if(json.data) setParsed(json.data);
        } finally { setLoading(false); }
    };

    if(parsed.length > 0) return (
        <div className="h-screen flex flex-col bg-gray-50">
           <div className="p-4 bg-white border-b flex justify-between items-center shadow-sm">
              <button onClick={() => setParsed([])} className="text-gray-500 flex items-center gap-1"><ArrowLeft size={16}/> Retry</button>
              <h2 className="font-bold text-gray-800">Found {parsed.length} Leads</h2>
           </div>
           <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {parsed.map((l, i) => (
                 <div key={i} className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm">
                    <input value={l.name} onChange={e => {const n=[...parsed];n[i].name=e.target.value;setParsed(n)}} className="font-bold w-full outline-none text-gray-800 border-b border-transparent focus:border-blue-500"/>
                    <div className="flex items-center gap-2 mt-1">
                       <span className="text-gray-400 text-xs">+91</span>
                       <input value={l.phone} onChange={e => {const n=[...parsed];n[i].phone=e.target.value;setParsed(n)}} className="text-sm font-mono w-full outline-none text-gray-600"/>
                    </div>
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
    const [form, setForm] = useState(prefill || { name: '', phone: '', context: '' });
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
        <div className="p-6 bg-white h-screen">
           <button onClick={onBack} className="mb-6 text-gray-500"><ArrowLeft/></button>
           <h1 className="text-2xl font-bold mb-6 text-gray-800">Add Lead</h1>
           <div className="space-y-4">
              <input value={form.name} onChange={e=>setForm({...form, name: e.target.value})} placeholder="Name" className="w-full p-4 bg-gray-50 rounded-xl border outline-none focus:border-blue-500"/>
              <input value={form.phone} onChange={e=>setForm({...form, phone: e.target.value})} placeholder="Phone (e.g. 9876543210)" className="w-full p-4 bg-gray-50 rounded-xl border outline-none focus:border-blue-500"/>
              <div className="relative">
                 <input value={form.context} onChange={e=>setForm({...form, context: e.target.value})} placeholder="Notes / Context" className="w-full p-4 bg-gray-50 rounded-xl border outline-none focus:border-blue-500"/>
                 <button onClick={toggleMic} className={`absolute right-2 top-2 p-2 rounded-full ${listening ? 'bg-red-500 text-white animate-pulse' : 'bg-gray-200 text-gray-600'}`}><Mic size={20}/></button>
              </div>
              <button onClick={() => onSubmit(form)} className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold mt-4 shadow-lg">Save to Queue</button>
           </div>
        </div>
    );
}

function SettingsForm({ template, setTemplate, library, setLibrary, userProfile, clientId, onBack, onLogout }) {
    const [newName, setNewName] = useState("");
    const [title, setTitle] = useState(userProfile.title || "");
    const [photo, setPhoto] = useState(userProfile.photo || "");

    const saveProfile = () => {
       signedRequest("UPDATE_PROFILE", { client_id: clientId, title, photo }).then(() => alert("Profile Saved"));
    };

    return (
        <div className="p-6 bg-white h-screen overflow-y-auto">
           <div className="flex justify-between items-center mb-6">
              <button onClick={onBack}><ArrowLeft/></button>
              <button onClick={onLogout} className="text-red-500 font-bold flex items-center gap-1"><LogOut size={16}/> Logout</button>
           </div>
           
           <h1 className="text-2xl font-bold mb-6">Settings</h1>
           
           <div className="mb-8 p-4 border rounded-xl bg-gray-50">
              <h3 className="font-bold mb-4 flex items-center gap-2"><Briefcase size={16} className="text-blue-600"/> Digital Card Profile</h3>
              <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Your Job Title" className="w-full p-2 mb-2 rounded border text-sm"/>
              <input value={photo} onChange={e=>setPhoto(e.target.value)} placeholder="Photo URL" className="w-full p-2 mb-2 rounded border text-sm"/>
              <button onClick={saveProfile} className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-bold w-full">Save Profile</button>
           </div>

           <div className="mb-8">
              <h3 className="font-bold mb-2">Default Message Template</h3>
              <textarea value={template} onChange={e => setTemplate(e.target.value)} className="w-full h-24 p-4 bg-gray-50 rounded-xl mb-2 text-sm border outline-none"/>
           </div>

           <div>
              <h3 className="font-bold mb-2">Template Library</h3>
              <div className="flex gap-2 mb-4">
                 <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="New Template Name" className="flex-1 p-2 bg-gray-50 rounded-lg border"/>
                 <button onClick={() => { if(newName) { setLibrary([...library, {name: newName, text: template}]); setNewName(""); }}} className="bg-green-500 text-white p-2 rounded-lg"><Plus/></button>
              </div>
              <div className="space-y-2">
                 {library.map((l, i) => (
                    <div key={i} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg border">
                       <span className="font-bold text-sm text-gray-700">{l.name}</span>
                       <button onClick={() => setLibrary(library.filter((_, idx) => idx !== i))} className="text-red-400"><Trash2 size={16}/></button>
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
   return (
      <div className="h-screen bg-slate-900 text-white p-6">
         <div className="flex items-center gap-3 mb-8">
            <LayoutDashboard className="text-orange-500"/>
            <h1 className="text-2xl font-bold">Master View</h1>
         </div>
         <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-800 p-4 rounded-xl">
               <p className="text-gray-400 text-xs">Total Clients</p>
               <p className="text-2xl font-bold">12</p>
            </div>
            <div className="bg-slate-800 p-4 rounded-xl">
               <p className="text-gray-400 text-xs">Leads Processed</p>
               <p className="text-2xl font-bold">1,240</p>
            </div>
         </div>
         <div className="mt-8 p-4 bg-slate-800 rounded-xl border border-slate-700">
            <h3 className="font-bold mb-4 flex items-center gap-2"><BarChart3 size={16}/> System Health</h3>
            <div className="space-y-2 text-sm text-gray-400">
               <div className="flex justify-between"><span>API Latency</span> <span className="text-green-400">45ms</span></div>
               <div className="flex justify-between"><span>Error Rate</span> <span className="text-green-400">0.01%</span></div>
            </div>
         </div>
      </div>
   );
}

function AdminLogin({ onLogin }) {
    const [pw, setPw] = useState("");
    return (
        <div className="h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-white">
           <Lock size={48} className="mb-6 text-orange-500"/>
           <h2 className="text-xl font-bold mb-6">Thrivoy Admin</h2>
           <input type="password" value={pw} onChange={e => setPw(e.target.value)} className="w-full max-w-xs p-4 rounded-xl bg-slate-800 text-center mb-4 text-white font-bold tracking-widest outline-none border border-slate-700 focus:border-orange-500 transition-colors" placeholder="ENTER CODE" />
           <button onClick={() => pw === ADMIN_PASSWORD ? onLogin() : alert("Access Denied")} className="w-full max-w-xs py-4 bg-orange-600 rounded-xl font-bold hover:bg-orange-700 transition-colors">UNLOCK</button>
        </div>
    );
}

function LandingPage() {
    return (
        <div className="h-screen flex flex-col items-center justify-center p-6 text-center bg-gray-50">
            <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center text-white font-black text-3xl mb-4 shadow-xl shadow-blue-200">T</div>
            <h1 className="text-4xl font-black text-gray-900 mb-2 tracking-tight">Thrivoy</h1>
            <p className="text-gray-500 mb-8 max-w-xs mx-auto">The high-performance lead management engine for pros.</p>
            <div className="bg-white p-8 rounded-3xl shadow-xl w-full max-w-sm border border-gray-100">
                <p className="font-bold mb-4 text-gray-800">Have an invite key?</p>
                <form onSubmit={e => { e.preventDefault(); const k = e.target.key.value; if(k) window.location.search = `?key=${k}`; }}>
                   <input name="key" placeholder="Enter Client Key" className="w-full p-4 bg-gray-50 rounded-xl mb-4 text-center border outline-none focus:border-blue-500 transition-colors"/>
                   <button className="w-full bg-gray-900 text-white py-4 rounded-xl font-bold shadow-lg active:scale-95 transition-transform">Enter Engine</button>
                </form>
            </div>
            <div className="mt-8 flex gap-4 text-gray-400">
               <Globe size={20}/>
               <ShieldCheck size={20}/>
            </div>
        </div>
    );
}

const root = createRoot(document.getElementById('root'));
root.render(<App />);