import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { motion, useAnimation } from 'framer-motion';
import Papa from 'papaparse';
import './index.css'; // Ensure this is here for styling!
import { 
  Phone, Upload, UserPlus, ArrowLeft, ClipboardPaste, 
  Trash2, Zap, ScanLine, Settings, List, Plus, X, 
  Wand2, HelpCircle, Gift, Info, CheckSquare, Square, 
  Play, UserMinus, Mail, Clock, Flame, ThumbsUp, 
  Snowflake, UserCheck, ShieldCheck 
} from 'lucide-react';

// ⚠️ PASTE YOUR DEPLOYMENT URL HERE
const API_URL = "https://script.google.com/macros/s/AKfycbwXGbYLfIt_lAE2SV4C4JdcdR17VpejDYuHeMs06agExgSWd0xldO1JBZULEcpnnPM-FQ/exec";

const ADMIN_KEY = "master";

const ANNOUNCEMENT = {
    title: "New: Digital Business Cards 📇",
    text: "You now have a free personal website! Click the share button to send it to clients.",
    type: "info" 
};

const DEFAULT_TEMPLATE = "Hi {{name}}, regarding {{context}}. Can we have a quick chat?";

// ==========================================
// 1. MAIN APP CONTROLLER
// ==========================================
function App() {
  const [view, setView] = useState("menu");
  const [clientId, setClientId] = useState("");
  const [publicProfileId, setPublicProfileId] = useState(null);
  const [queue, setQueue] = useState([]);
  const [stats, setStats] = useState({ today: 0 });
  const [status, setStatus] = useState("");
  
  const [template, setTemplate] = useState(() => {
    return localStorage.getItem("revive_active_template") || DEFAULT_TEMPLATE;
  });

  const [library, setLibrary] = useState(() => {
      const saved = localStorage.getItem("revive_library");
      return saved ? JSON.parse(saved) : [];
  });

  // Save template when it changes
  useEffect(() => {
    localStorage.setItem("revive_active_template", template);
  }, [template]);

  // INITIALIZATION: Handle URL Parameters
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const key = params.get("key"); // Private User Key
    const user = params.get("u");  // Public Profile ID

    if (user) {
        setPublicProfileId(user);
    } else if (key) {
        setClientId(key); 
        fetchQueue(key); 
    }
  }, []);

  // --- ACTIONS ---

  const saveActiveTemplate = (newTemp) => { 
      setTemplate(newTemp); 
      localStorage.setItem("revive_active_template", newTemp); 
  };
  
  const addToLibrary = (name, text) => {
    const newLib = [...library, { id: Date.now(), name, text }];
    setLibrary(newLib);
    localStorage.setItem("revive_library", JSON.stringify(newLib));
  };

  const removeFromLibrary = (id) => {
    const newLib = library.filter(t => t.id !== id);
    setLibrary(newLib);
    localStorage.setItem("revive_library", JSON.stringify(newLib));
  };

  const fetchQueue = async (id) => {
    if(id === ADMIN_KEY) return; 
    try {
        const res = await fetch(API_URL, { 
            method: 'POST', 
            body: JSON.stringify({ action: "GET_QUEUE", payload: { client_id: id } }) 
        });
        const json = await res.json();
        if(json.data) { 
            setQueue(json.data.queue); 
            if(json.data.stats) setStats(json.data.stats);
        }
    } catch(e) { console.error("API Error", e); }
  };

  const handleBulkSubmit = async (leads) => {
    setStatus(`Saving ${leads.length} leads...`);
    try {
        await fetch(API_URL, { 
            method: 'POST', 
            body: JSON.stringify({ action: "ADD_LEADS", payload: { client_id: clientId, leads: leads } }) 
        });
        setStatus("Saved!");
        fetchQueue(clientId); 
        setView("menu");
    } catch(e) { setStatus("Error: " + e.message); }
  };

  const handleFileUpload = (e) => {
    setStatus("Parsing CSV...");
    Papa.parse(e.target.files[0], {
        header: true,
        complete: async (results) => {
            const leads = results.data.filter(row => row.Phone).map(row => ({
                name: row.Name || "Customer",
                phone: "91" + row.Phone.replace(/\D/g,'').slice(-10),
                email: row.Email || "",
                context: row.Context || "Follow Up"
            }));
            handleBulkSubmit(leads);
        }
    });
  };

  // --- ROUTING ---

  // 1. Public Profile (Digital Card)
  if (publicProfileId) return <DigitalCard profileId={publicProfileId} />;
  
  // 2. Admin Console
  if (clientId === ADMIN_KEY) return <AdminDashboard />;
  
  // 3. Landing Page (No ID)
  if (!clientId) return <LandingPage />;
  
  // 4. Main App Views
  if(view === "menu") return (
      <MenuScreen 
        queue={queue} stats={stats} status={status} 
        onViewChange={setView} onUpload={handleFileUpload} 
        announcement={ANNOUNCEMENT} clientId={clientId} 
      />
  );

  if(view === "hotlist") return <HotList clientId={clientId} onBack={() => setView("menu")} />;
  
  if(view === "stack") return (
      <CardStack 
        queue={queue} setQueue={setQueue} 
        template={template} library={library} 
        onBack={() => { fetchQueue(clientId); setView("menu"); }} 
      />
  );

  if(view === "settings") return (
      <SettingsForm 
        currentTemplate={template} library={library} 
        onSaveActive={saveActiveTemplate} onAddToLib={addToLibrary} 
        onRemoveFromLib={removeFromLibrary} onBack={() => setView("menu")} 
      />
  );

  if(view === "list") return (
      <QueueList 
        queue={queue} setQueue={setQueue} library={library} 
        onBack={() => setView("menu")} onLaunchStack={() => setView("stack")} 
      />
  );

  if(view === "manual") return (
      <ManualForm 
        onBack={() => setView("menu")} 
        onSubmit={(l) => handleBulkSubmit([l])} status={status} 
      />
  );

  if(view === "bulk") return (
      <BulkPasteForm 
        onBack={() => setView("menu")} onSubmit={handleBulkSubmit} 
      />
  );

  if(view === "help") return <HelpScreen onBack={() => setView("menu")} />;
  
  return <div className="h-screen flex items-center justify-center">Loading Thrivoy...</div>;
}

// ==========================================
// 2. MENU SCREEN (Dashboard)
// ==========================================
function MenuScreen({ queue, stats, status, onViewChange, onUpload, announcement, clientId }) {
    
    const shareMyCard = () => {
        const url = `${window.location.origin}/?u=${clientId}`;
        const text = `Here is my digital business card. Save my number instantly: ${url}`;
        if (navigator.share) {
            navigator.share({ title: 'My Digital Card', text: text, url: url });
        } else {
            window.open(`https://wa.me/?text=${encodeURIComponent(text)}`);
        }
    };

    return (
      <div className="p-6 max-w-md mx-auto space-y-6 animate-in fade-in">
          <div className="flex justify-between items-center">
             <h1 className="text-2xl font-bold text-gray-800">Thrivoy</h1>
             <div className="flex gap-2">
                 <button onClick={shareMyCard} className="p-2 bg-black text-white rounded-full shadow-lg animate-pulse" title="Share Digital Card">
                    <ScanLine size={20} />
                 </button>
                 <button onClick={() => onViewChange("help")} className="p-2 bg-blue-50 text-blue-600 rounded-full">
                    <HelpCircle size={20} />
                 </button>
                 <button onClick={() => onViewChange("settings")} className="p-2 bg-gray-100 rounded-full text-gray-600">
                    <Settings size={20} />
                 </button>
             </div>
          </div>
          
          {/* Daily Scoreboard */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-500 rounded-xl p-4 text-white shadow-lg flex justify-between items-center">
              <div>
                  <div className="text-blue-100 text-xs font-bold uppercase tracking-wider">Daily Score</div>
                  <div className="text-3xl font-black">{stats.today} <span className="text-lg font-normal opacity-70">wins</span></div>
              </div>
              <div className="bg-white/20 p-3 rounded-lg">
                  <Zap size={24} fill="currentColor"/>
              </div>
          </div>

          {announcement.text && (
              <div className="p-4 rounded-xl border bg-purple-50 border-purple-100 text-purple-900 flex items-start gap-3">
                  <div className="mt-1"><Info size={20} /></div>
                  <div>
                      <h3 className="font-bold text-sm">{announcement.title}</h3>
                      <p className="text-xs opacity-90 leading-relaxed">{announcement.text}</p>
                  </div>
              </div>
          )}
          
          <div className="grid grid-cols-2 gap-4">
              <button onClick={() => onViewChange("manual")} className="bg-white border border-gray-200 text-gray-700 p-4 rounded-xl shadow-sm flex flex-col items-center justify-center gap-2 hover:bg-gray-50">
                  <UserPlus size={24} className="text-blue-600"/>
                  <span className="font-bold text-sm">Add One</span>
              </button>
              <button onClick={() => onViewChange("bulk")} className="bg-white border border-gray-200 text-gray-700 p-4 rounded-xl shadow-sm flex flex-col items-center justify-center gap-2 hover:bg-gray-50">
                  <ClipboardPaste size={24} className="text-purple-600"/>
                  <span className="font-bold text-sm">Paste Page</span>
              </button>
          </div>
          
          <button onClick={() => onViewChange("hotlist")} className="w-full bg-orange-100 text-orange-800 p-4 rounded-xl font-bold border border-orange-200 flex items-center justify-center gap-2 hover:bg-orange-200">
             <Flame size={20} /> My Hot Leads 💰
          </button>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 text-center">
              <Upload className="mx-auto mb-2 text-gray-400" />
              <p className="text-sm text-gray-500 mb-4">Have a CSV file? Or Screenshots?</p>
              <label className="bg-gray-100 text-gray-600 px-4 py-2 rounded-lg text-sm font-bold cursor-pointer hover:bg-gray-200 transition-colors">
                  Upload File
                  <input type="file" accept=".csv,image/*" onChange={onUpload} className="hidden" />
              </label>
          </div>
          
          {queue.length > 0 && (
             <div className="space-y-3">
                 <button onClick={() => onViewChange("stack")} className="w-full bg-green-100 text-green-800 p-4 rounded-xl font-bold border border-green-200 flex items-center justify-center gap-2 hover:bg-green-200">
                    <Zap size={20} /> Quick Start ({queue.length})
                 </button>
                 <button onClick={() => onViewChange("list")} className="w-full bg-gray-900 text-white p-4 rounded-xl font-bold shadow-lg flex items-center justify-center gap-2 hover:bg-black">
                    <List size={20} /> Select & Send
                 </button>
             </div>
          )}
          {status && <p className="text-center font-bold text-blue-600 animate-pulse">{status}</p>}
      </div>
    );
}

// ==========================================
// 3. CARD STACK (The Engine)
// ==========================================
function CardStack({ queue, setQueue, template, library, onBack }) { 
    const [mode, setMode] = useState("card"); // 'card' | 'disposition' | 'snooze'
    const [actionType, setActionType] = useState("whatsapp"); // 'whatsapp' | 'call'
    const [file, setFile] = useState(null); 
    const controls = useAnimation(); 
    
    if(queue.length === 0) return (
        <div className="h-screen flex flex-col items-center justify-center p-6 text-center">
            <div className="text-6xl mb-6">🎉</div>
            <h2 className="text-2xl font-bold text-gray-800">All Caught Up!</h2>
            <button onClick={onBack} className="mt-8 bg-blue-600 text-white px-6 py-3 rounded-xl font-bold">Return to Menu</button>
        </div>
    ); 

    const active = queue[0]; 
    let activeTemplate = template; 
    const matched = library.find(t => (active.context || "").toLowerCase().includes(t.name.toLowerCase())); 
    if(matched) activeTemplate = matched.text; 
    const message = activeTemplate.replace("{{name}}", active.name).replace("{{context}}", active.context || "your update");
    
    const updateActive = (field, value) => { const newQ = [...queue]; newQ[0][field] = value; setQueue(newQ); }; 
    const removeCard = () => { setQueue(q => q.slice(1)); setMode("card"); setFile(null); }; 

    // PRIMARY ACTION HANDLER
    const handlePrimaryAction = async () => {
        if (actionType === 'call') {
            // Call Mode
            window.open(`tel:${active.phone}`, '_self');
            setMode("disposition");
        } else {
            // WhatsApp Mode
            if (file && navigator.share) {
                try {
                    await navigator.share({ files: [file], title: 'Message', text: message });
                    setMode("disposition");
                } catch (err) { console.log(err); }
            } else {
                window.open(`https://wa.me/${active.phone}?text=${encodeURIComponent(message)}`, '_blank');
                setMode("disposition");
            }
        }
    };

    const handleFileSelect = (e) => { if(e.target.files[0]) setFile(e.target.files[0]); };

    // SNOOZE WITH CALENDAR LOGIC
    const addToCalendar = (days) => {
        const d = new Date(); d.setDate(d.getDate() + days);
        const title = `Call ${active.name}`;
        const details = `Thrivoy Reminder: ${active.context} | Ph: ${active.phone}`;
        const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&details=${encodeURIComponent(details)}&dates=${d.toISOString().replace(/-|:|\.\d\d\d/g,"")}/${d.toISOString().replace(/-|:|\.\d\d\d/g,"")}`;
        window.open(url, '_blank');
        
        controls.start({ y: 500, opacity: 0 }).then(() => { 
            controls.set({ y: 0, opacity: 1 }); 
            fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: "SNOOZE_LEAD", payload: { lead_id: active.lead_id, date: d.toISOString().split('T')[0] } }) }); 
            removeCard(); 
        });
    };

    const submitOutcome = (tag) => {
        controls.start({ x: 500, opacity: 0 }).then(() => { 
            controls.set({ x: 0, opacity: 1 }); 
            fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: "MARK_SENT", payload: { lead_id: active.lead_id, outcome: tag } }) }); 
            removeCard(); 
        });
    };

    const skipLead = () => {
        controls.start({ x: -500, opacity: 0 }).then(() => { 
            controls.set({ x: 0, opacity: 1 }); 
            fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: "MARK_SENT", payload: { lead_id: active.lead_id, outcome: "Skipped" } }) }); 
            removeCard(); 
        });
    };

    // --- SUB-VIEWS ---

    if(mode === "disposition") return (
        <div className="h-screen flex flex-col items-center justify-center p-6 bg-slate-900 text-white animate-in fade-in">
            <h2 className="text-2xl font-bold mb-8">{actionType === 'call' ? "Call Outcome?" : "Message Outcome?"}</h2>
            <div className="grid grid-cols-1 gap-4 w-full max-w-xs">
                <button onClick={() => submitOutcome("Hot")} className="bg-orange-500 p-4 rounded-xl font-bold flex gap-3 justify-center"><Flame/> Hot Lead</button>
                <button onClick={() => submitOutcome("Interested")} className="bg-blue-600 p-4 rounded-xl font-bold flex gap-3 justify-center"><ThumbsUp/> Interested</button>
                <button onClick={() => submitOutcome("No Answer")} className="bg-slate-700 p-4 rounded-xl font-bold flex gap-3 justify-center"><Snowflake/> No Answer / Cold</button>
            </div>
            <button onClick={() => setMode("card")} className="mt-8 text-gray-400 underline text-sm">Back</button>
        </div>
    );

    if(mode === "snooze") return (
        <div className="h-screen flex flex-col items-center justify-center p-6 bg-purple-900 text-white animate-in fade-in">
            <h2 className="text-2xl font-bold mb-8">Snooze & Remind...</h2>
            <div className="gap-4 grid w-full max-w-xs">
                <button onClick={() => addToCalendar(1)} className="bg-purple-600 p-4 rounded-xl font-bold">Tomorrow (+ GCal)</button>
                <button onClick={() => addToCalendar(3)} className="bg-purple-600 p-4 rounded-xl font-bold">3 Days (+ GCal)</button>
                <button onClick={() => addToCalendar(7)} className="bg-purple-600 p-4 rounded-xl font-bold">Next Week (+ GCal)</button>
            </div>
            <button onClick={() => setMode("card")} className="mt-8 underline text-sm">Cancel</button>
        </div>
    );

    // MAIN CARD RENDER
    return (
        <div className="h-screen flex flex-col items-center justify-center p-4 max-w-sm mx-auto relative">
            <button onClick={onBack} className="absolute top-6 left-6 p-2 bg-gray-100 rounded-full text-gray-600 z-10">
                <ArrowLeft size={20} />
            </button>
            
            {/* Toggle Switch */}
            <div className="absolute top-6 right-6 z-10 bg-gray-100 p-1 rounded-lg flex">
                <button onClick={() => setActionType('whatsapp')} className={`p-2 rounded-md transition-all ${actionType === 'whatsapp' ? 'bg-white shadow text-green-600' : 'text-gray-400'}`}><Zap size={20}/></button>
                <button onClick={() => setActionType('call')} className={`p-2 rounded-md transition-all ${actionType === 'call' ? 'bg-white shadow text-blue-600' : 'text-gray-400'}`}><Phone size={20}/></button>
            </div>
            
            <motion.div animate={controls} className="bg-white w-full aspect-[3/4] rounded-3xl shadow-2xl p-8 flex flex-col justify-between relative overflow-hidden mt-8">
                <div className="space-y-4">
                   <div className="relative">
                       <input value={active.context} onChange={(e) => updateActive('context', e.target.value)} className="bg-blue-50 text-blue-800 text-xs font-bold px-2 py-1 rounded w-full outline-none" placeholder="Reason" />
                       {matched && <Wand2 size={12} className="absolute right-2 top-1.5 text-purple-500 animate-pulse" />}
                   </div>
                   <div>
                       <input value={active.name} onChange={(e) => updateActive('name', e.target.value)} className="text-3xl font-bold text-gray-800 w-full outline-none border-b border-transparent focus:border-gray-300" />
                       <div className="flex flex-col mt-1">
                           <span className="text-gray-400 font-mono text-sm">+{active.phone}</span>
                           {active.email && <span className="text-blue-400 font-mono text-xs">{active.email}</span>}
                       </div>
                   </div>
                   
                   {actionType === 'whatsapp' ? (
                       <div className="bg-gray-50 p-3 rounded-lg text-xs text-gray-500 h-20 overflow-y-auto border border-gray-100">{message}</div>
                   ) : (
                       <div className="bg-blue-50 p-3 rounded-lg text-xs text-blue-800 h-20 flex items-center justify-center font-bold border border-blue-100">
                           📞 Power Dialer Mode Active
                       </div>
                   )}

                   {/* Attachment Area */}
                   {actionType === 'whatsapp' && (
                       <label className={`block border-2 border-dashed rounded-xl p-2 text-center cursor-pointer ${file ? 'border-green-500 bg-green-50' : 'border-gray-200'}`}>
                           <input type="file" accept="image/*,.pdf" onChange={handleFileSelect} className="hidden" />
                           <div className="flex items-center justify-center gap-2 text-xs font-bold text-gray-500">
                               {file ? <><CheckSquare size={14} className="text-green-600"/> Attached</> : <><ClipboardPaste size={14}/> Attach Photo</>}
                           </div>
                       </label>
                   )}
                </div>
                
                <div className="mt-auto space-y-2">
                    <button onClick={handlePrimaryAction} className={`w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 text-white shadow-lg active:scale-95 transition-transform ${actionType === 'call' ? 'bg-blue-600' : 'bg-green-500'}`}>
                        {actionType === 'call' ? <><Phone size={24} /> DIAL NUMBER</> : <><Zap size={24} /> {file ? "Share + File" : "Send WhatsApp"}</>}
                    </button>
                    {active.email && actionType === 'whatsapp' && (
                        <button onClick={() => {window.open(`mailto:${active.email}?subject=${encodeURIComponent(active.context)}&body=${encodeURIComponent(message)}`); setMode("disposition");}} className="w-full py-3 rounded-xl font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 flex items-center justify-center gap-2">
                            <Mail size={20} /> Send Email
                        </button>
                    )}
                    <div className="flex gap-2">
                        <button onClick={skipLead} className="flex-1 py-3 rounded-xl font-bold text-gray-500 bg-gray-50 hover:bg-gray-100 flex items-center justify-center gap-2"><Trash2 size={18} /> Skip</button>
                        <button onClick={() => setMode("snooze")} className="px-4 py-3 rounded-xl font-bold text-purple-600 bg-purple-50 hover:bg-purple-100 flex items-center justify-center"><Clock size={18} /></button>
                    </div>
                </div>
            </motion.div>
        </div>
    ); 
}

// ==========================================
// 4. LANDING PAGE (Marketing & Pricing)
// ==========================================
function LandingPage() { 
    const SALES_WHATSAPP = "917892159170"; 
    const scrollToSection = (id) => document.getElementById(id).scrollIntoView({ behavior: 'smooth' });

    return (
        <div className="min-h-screen bg-white flex flex-col font-sans text-gray-900">
            {/* HERO */}
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-8 max-w-4xl mx-auto pt-20">
                <div className="w-20 h-20 bg-orange-100 rounded-3xl flex items-center justify-center mb-4 shadow-sm animate-bounce">
                    <Zap size={40} className="text-orange-600" />
                </div>
                <h1 className="text-5xl md:text-7xl font-black text-gray-900 leading-tight tracking-tight">
                    Notebooks to <span className="text-orange-600">Revenue</span>.
                </h1>
                <p className="text-xl text-gray-500 leading-relaxed max-w-2xl mx-auto">
                    The #1 Sales Tool for India. Scan leads, attach photos, and switch to <strong>Power Dialer</strong> mode for instant cold calling.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 w-full justify-center">
                    <button onClick={() => window.open(`https://wa.me/${SALES_WHATSAPP}?text=I%20want%20Revive%20access`, '_blank')} className="px-8 py-4 bg-orange-600 text-white rounded-xl font-bold text-lg shadow-xl hover:bg-orange-700 hover:scale-105 transition-all">Get Free Access 🇮🇳</button>
                    <button onClick={() => scrollToSection('features')} className="px-8 py-4 bg-gray-100 text-gray-700 rounded-xl font-bold text-lg hover:bg-gray-200">See Features</button>
                </div>
            </div>

            {/* FEATURES GRID */}
            <div id="features" className="py-20 px-6 bg-gray-50">
                <div className="max-w-5xl mx-auto">
                    <h2 className="text-3xl font-black text-center text-gray-900 mb-12">The Complete Sales Stack</h2>
                    <div className="grid md:grid-cols-3 gap-8">
                        <FeatureCard icon={<ScanLine />} title="Scan & Extract" text="Digitise handwritten notebooks or cards instantly with AI extraction." />
                        <FeatureCard icon={<Phone />} title="Power Dialer" text="Switch to Call Mode. Dial 50 leads in 30 mins without typing a digit." />
                        <FeatureCard icon={<ClipboardPaste />} title="Attach Media" text="Send brochures, price lists, or property photos via WhatsApp." />
                    </div>
                </div>
            </div>
            
            {/* USE CASES */}
            <div className="py-20 px-6 bg-white border-t border-gray-100">
                <div className="max-w-5xl mx-auto">
                    <h2 className="text-3xl font-black text-center text-gray-900 mb-12">Who uses Thrivoy?</h2>
                    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <UseCaseCard icon={<Flame/>} title="Real Estate" text="Send property photos & brochures to 50 leads in minutes." />
                        <UseCaseCard icon={<Phone/>} title="Used Cars" text="Walkaround videos & car details sent instantly after a call." />
                        <UseCaseCard icon={<ShieldCheck/>} title="Insurance" text="Scan handwritten leads & send policy PDFs effortlessly." />
                        <UseCaseCard icon={<Zap/>} title="Gym Owners" text="Send membership price cards to old inquiries." />
                    </div>
                </div>
            </div>

            {/* PRICING (India) */}
            <div id="pricing" className="py-20 px-6 bg-white">
                <div className="max-w-5xl mx-auto">
                    <h2 className="text-4xl font-black text-center text-gray-900 mb-4">Pricing for India 🇮🇳</h2>
                    <p className="text-center text-gray-500 mb-12 text-lg">Invest in your sales speed.</p>
                    <div className="grid md:grid-cols-3 gap-8">
                        <PricingCard title="Starter" price="₹0" btn="Try Free" features={["100 Leads", "Basic Scan", "Text Only"]} />
                        <PricingCard title="Pro Hustler" price="₹999" highlight btn="Get Pro" features={["Unlimited Leads", "Power Dialer Mode", "Send Photos/PDFs", "Calendar Sync"]} />
                        <PricingCard title="Corporate" price="Custom" btn="Contact Sales" features={["Private Data", "Team Admin", "GST Invoice"]} />
                    </div>
                </div>
            </div>
            <div className="p-6 bg-gray-900 text-center text-gray-500 text-sm"><p>&copy; 2025 Thrivoy Inc. Made for India 🇮🇳</p></div>
        </div>
    ); 
}

// ==========================================
// 5. DIGITAL BUSINESS CARD (Public)
// ==========================================
function DigitalCard({ profileId }) {
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch(API_URL, { 
            method: 'POST', 
            body: JSON.stringify({ action: "GET_CLIENT_PROFILE", payload: { client_id: profileId } }) 
        })
        .then(res => res.json())
        .then(json => { 
            if(json.status === 'success') setProfile(json.data);
            setLoading(false);
        });
    }, [profileId]);

    const saveContact = () => {
        const vcard = `BEGIN:VCARD\nVERSION:3.0\nFN:${profile.name}\nTEL;TYPE=CELL:${profile.phone}\nEND:VCARD`;
        const blob = new Blob([vcard], { type: "text/vcard" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); 
        a.href = url; 
        a.download = `${profile.name}.vcf`; 
        a.click();
    };

    if (loading) return (
        <div className="h-screen flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
    );
    
    if (!profile) return <div className="h-screen flex items-center justify-center text-gray-500">Profile Not Found</div>;

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 font-sans">
            <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden border border-gray-100 animate-in fade-in">
                <div className="h-32 bg-gradient-to-r from-blue-600 to-purple-600 relative">
                    <div className="absolute -bottom-12 left-0 right-0 flex justify-center">
                        <div className="w-24 h-24 bg-white rounded-full p-1 shadow-lg">
                            <div className="w-full h-full bg-gray-200 rounded-full flex items-center justify-center text-gray-500 font-bold text-2xl">
                                {profile.name.charAt(0)}
                            </div>
                        </div>
                    </div>
                </div>
                
                <div className="pt-16 pb-8 px-8 text-center">
                    <h1 className="text-2xl font-black text-gray-900">{profile.name}</h1>
                    <p className="text-gray-500 font-medium mb-6">+{profile.phone}</p>
                    
                    <div className="space-y-3">
                        <button onClick={saveContact} className="w-full py-4 bg-gray-900 text-white rounded-xl font-bold shadow-lg flex items-center justify-center gap-2 hover:bg-black active:scale-95 transition-transform">
                            <UserCheck size={20} /> Save Contact
                        </button>
                        
                        <div className="grid grid-cols-2 gap-3">
                            <button onClick={() => window.open(`https://wa.me/${profile.phone}`, '_blank')} className="py-4 bg-green-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-green-600">
                                <Zap size={20} /> WhatsApp
                            </button>
                            <button onClick={() => window.open(`tel:${profile.phone}`, '_self')} className="py-4 bg-blue-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-blue-700">
                                <Phone size={20} /> Call
                            </button>
                        </div>
                    </div>
                </div>

                <div className="bg-gray-50 p-4 text-center border-t border-gray-100 cursor-pointer hover:bg-gray-100" onClick={() => window.open(window.location.origin, '_blank')}>
                    <p className="text-xs text-gray-400 font-bold uppercase tracking-widest flex items-center justify-center gap-1">
                        <Zap size={12} className="text-orange-500"/> Powered by Thrivoy
                    </p>
                </div>
            </div>
        </div>
    );
}

// ==========================================
// 6. HOTLIST (The Vault)
// ==========================================
function HotList({ clientId, onBack }) {
    const [leads, setLeads] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch(API_URL, { 
            method: 'POST', 
            body: JSON.stringify({ action: "GET_HOTLIST", payload: { client_id: clientId } }) 
        })
        .then(res => res.json())
        .then(json => { 
            setLeads(json.data || []); 
            setLoading(false); 
        });
    }, []);

    const requeue = (id) => {
        setLeads(leads.filter(l => l.lead_id !== id));
        fetch(API_URL, { 
            method: 'POST', 
            body: JSON.stringify({ action: "REQUEUE_LEAD", payload: { lead_id: id } }) 
        });
        alert("Lead moved back to Stack! Go to Quick Start.");
    };

    return (
        <div className="p-4 max-w-md mx-auto h-screen bg-white flex flex-col">
            <div className="flex items-center justify-between mb-6">
                <button onClick={onBack} className="text-gray-400 flex items-center gap-1">
                    <ArrowLeft size={16}/> Back
                </button>
                <span className="font-bold text-orange-600 flex items-center gap-2">
                    <Flame size={18} fill="currentColor"/> The Vault
                </span>
            </div>
            
            <h2 className="text-2xl font-black text-gray-800 mb-2">Your Potential Deals</h2>
            <p className="text-sm text-gray-500 mb-6">These people showed interest.</p>

            {loading ? <div className="text-center p-8 text-gray-400">Digging for gold...</div> : (
                <div className="flex-1 overflow-y-auto space-y-3">
                    {leads.length === 0 ? (
                        <div className="text-center p-8 bg-gray-50 rounded-xl">
                            <p className="text-gray-400 font-bold">No Hot Leads yet.</p>
                        </div>
                    ) : leads.map(lead => (
                        <div key={lead.lead_id} className="p-4 rounded-xl border border-orange-100 bg-orange-50 shadow-sm">
                            <div className="flex justify-between items-start mb-2">
                                <div>
                                    <h3 className="font-bold text-gray-900">{lead.name}</h3>
                                    <p className="text-xs text-gray-500 font-mono">+{lead.phone}</p>
                                </div>
                                <span className="bg-orange-200 text-orange-800 text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider">
                                    {lead.outcome}
                                </span>
                            </div>
                            <div className="flex gap-2 mt-3">
                                <button onClick={() => window.open(`tel:${lead.phone}`, '_self')} className="flex-1 bg-white border border-gray-200 py-2 rounded-lg font-bold text-xs flex items-center justify-center gap-1 text-gray-600">
                                    <Phone size={14}/> Call
                                </button>
                                <button onClick={() => window.open(`https://wa.me/${lead.phone}`, '_blank')} className="flex-1 bg-white border border-gray-200 py-2 rounded-lg font-bold text-xs flex items-center justify-center gap-1 text-gray-600">
                                    <Zap size={14}/> Chat
                                </button>
                                <button onClick={() => requeue(lead.lead_id)} className="flex-1 bg-orange-600 text-white py-2 rounded-lg font-bold text-xs shadow-md">
                                    Follow Up
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// ==========================================
// 7. UTILITY COMPONENTS
// ==========================================

function AdminDashboard() { 
    const [name, setName] = useState(""); 
    const [phone, setPhone] = useState(""); 
    const [result, setResult] = useState(null); 
    const [loading, setLoading] = useState(false); 
    
    const createClient = async () => { 
        if(!name || !phone) return alert("Enter Name and Phone"); 
        setLoading(true); 
        const cleanPhone = "91" + phone.replace(/\D/g,'').slice(-10); 
        try { 
            const res = await fetch(API_URL, { 
                method: 'POST', 
                body: JSON.stringify({ action: "ADD_CLIENT", payload: { name, phone: cleanPhone } }) 
            }); 
            const json = await res.json(); 
            setResult({ ...json.data, phone: cleanPhone }); 
            setName(""); setPhone(""); 
        } catch(e) { alert("Error: " + e.message); } 
        setLoading(false); 
    }; 
    
    const sendWhatsApp = () => {
        if(!result) return;
        const msg = `Welcome to Thrivoy! 🚀\n\nLink: ${result.magic_link}`;
        window.open(`https://wa.me/${result.phone}?text=${encodeURIComponent(msg)}`, '_blank');
    };

    return (
        <div className="min-h-screen bg-slate-900 text-white p-6">
            <h1 className="text-3xl font-bold mb-8 text-center">👑 Admin Console</h1>
            {!result ? (
                <div className="bg-slate-800 p-6 rounded-xl space-y-6">
                    <h2 className="text-xl font-bold text-slate-300">Add New Client</h2>
                    <input value={name} onChange={e=>setName(e.target.value)} className="w-full bg-slate-700 p-3 rounded text-white outline-none" placeholder="Client Name" />
                    <input type="tel" value={phone} onChange={e=>setPhone(e.target.value)} className="w-full bg-slate-700 p-3 rounded text-white outline-none" placeholder="WhatsApp Number" />
                    <button onClick={createClient} disabled={loading} className="w-full bg-blue-600 py-4 rounded-xl font-bold shadow-lg hover:bg-blue-500 transition-colors">
                        {loading ? "Creating..." : "Create Account & Generate Link"}
                    </button>
                </div>
            ) : (
                <div className="bg-green-900 p-6 rounded-xl text-center space-y-6 border border-green-500">
                    <h2 className="text-2xl font-bold">Client Created!</h2>
                    <div className="bg-black/30 p-4 rounded text-xs font-mono break-all text-green-200">{result.magic_link}</div>
                    <button onClick={sendWhatsApp} className="w-full bg-green-500 text-green-900 py-4 rounded-xl font-bold shadow-lg flex items-center justify-center gap-2">
                        <Zap size={20}/> Send via WhatsApp
                    </button>
                    <button onClick={() => setResult(null)} className="text-green-400 text-sm font-bold underline">Add Another Client</button>
                </div>
            )}
        </div>
    ); 
}

function QueueList({ queue, setQueue, library, onBack, onLaunchStack }) {
    const [selected, setSelected] = useState([]);
    const [bulkContext, setBulkContext] = useState("");
    
    const toggleSelect = (id) => { 
        if (selected.includes(id)) setSelected(selected.filter(i => i !== id)); 
        else setSelected([...selected, id]); 
    };
    
    const toggleAll = () => { 
        if (selected.length === queue.length) setSelected([]); 
        else setSelected(queue.map(q => q.lead_id)); 
    };
    
    const deleteSelected = async () => {
        if(!confirm(`Archive ${selected.length} leads?`)) return;
        const newQueue = queue.filter(q => !selected.includes(q.lead_id));
        setQueue(newQueue);
        selected.forEach(id => fetch(API_URL, { 
            method: 'POST', 
            body: JSON.stringify({ action: "MARK_SENT", payload: { lead_id: id, outcome: "Archived" } }) 
        }));
        setSelected([]);
    };
    
    const launchCampaign = () => {
        if(selected.length === 0) return alert("Select at least one!");
        const campaignQueue = queue.filter(q => selected.includes(q.lead_id)).map(q => ({ 
            ...q, context: bulkContext || q.context 
        }));
        setQueue(campaignQueue); 
        onLaunchStack(); 
    };

    return (
        <div className="p-4 max-w-md mx-auto h-screen bg-white flex flex-col">
            <div className="flex items-center justify-between mb-4">
                <button onClick={onBack} className="text-gray-400 flex items-center gap-1"><ArrowLeft size={16}/> Back</button>
                <span className="font-bold text-gray-800">{selected.length} Selected</span>
            </div>
            <div className="bg-blue-50 p-4 rounded-xl mb-4 space-y-3 border border-blue-100">
                <div className="flex gap-2 items-center">
                    <input value={bulkContext} onChange={e => setBulkContext(e.target.value)} placeholder="Context (e.g. Offer)" className="flex-1 p-2 text-sm rounded border outline-none font-bold text-blue-900"/>
                    {library.length > 0 && (
                        <div className="relative group">
                            <button className="p-2 bg-white rounded border text-blue-600"><Wand2 size={18}/></button>
                            <div className="absolute right-0 top-10 bg-white shadow-xl rounded-lg border w-40 z-20 hidden group-hover:block">
                                {library.map(t => (<div key={t.id} onClick={() => setBulkContext(t.name)} className="p-2 hover:bg-gray-50 text-xs font-bold cursor-pointer border-b">{t.name}</div>))}
                            </div>
                        </div>
                    )}
                </div>
                <div className="flex gap-2">
                    <button onClick={toggleAll} className="flex-1 bg-white border border-blue-200 text-blue-600 py-2 rounded-lg text-xs font-bold">
                        {selected.length === queue.length ? "Deselect All" : "Select All"}
                    </button>
                    {selected.length > 0 && (
                        <button onClick={deleteSelected} className="px-4 bg-red-50 text-red-600 rounded-lg text-xs font-bold flex items-center gap-2 border border-red-100">
                            <UserMinus size={16} /> Archive
                        </button>
                    )}
                </div>
                <button onClick={launchCampaign} disabled={selected.length === 0} className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold shadow-lg flex items-center justify-center gap-2 disabled:opacity-50">
                    <Play size={18} fill="currentColor" /> Start Campaign
                </button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-2">
                {queue.map(lead => (
                    <div key={lead.lead_id} onClick={() => toggleSelect(lead.lead_id)} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${selected.includes(lead.lead_id) ? 'bg-blue-50 border-blue-500' : 'bg-white border-gray-100'}`}>
                        <div className={`text-blue-500 ${selected.includes(lead.lead_id) ? 'opacity-100' : 'opacity-20'}`}>
                            {selected.includes(lead.lead_id) ? <CheckSquare size={20} /> : <Square size={20} />}
                        </div>
                        <div>
                            <h3 className="font-bold text-gray-800 text-sm">{lead.name}</h3>
                            <p className="text-xs text-gray-500">+{lead.phone} {lead.email && "• 📧"}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function BulkPasteForm({ onBack, onSubmit }) { 
    const [text, setText] = useState(""); 
    const [parsed, setParsed] = useState([]); 
    const [isSaving, setIsSaving] = useState(false); 
    
    const parseText = () => { 
        const lines = text.split(/\n/); 
        const found = []; 
        const phoneRegex = /(\d{10})/;
        const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/;
        
        lines.forEach(line => { 
            const match = line.match(phoneRegex); 
            if(match) { 
                const phone = match[0]; 
                const emailMatch = line.match(emailRegex); 
                const email = emailMatch ? emailMatch[0] : ""; 
                
                let name = line.replace(phone, "").replace(email, "").replace(/[^\w\s]/g, "").trim(); 
                if(!name) name = "Unknown Lead"; 
                found.push({ name, phone: "91" + phone, email, context: "From Notebook" }); 
            } 
        }); 
        setParsed(found); 
    }; 
    
    const handleSave = async () => { 
        if (isSaving) return; 
        setIsSaving(true); 
        await onSubmit(parsed); 
    }; 
    
    if(parsed.length > 0) return (
        <div className="p-6 max-w-md mx-auto h-screen bg-white overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">Found {parsed.length} Leads</h2>
            <div className="space-y-3 mb-6">
                {parsed.map((l, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border">
                        <div className="flex-1">
                            <div className="font-bold">{l.name}</div>
                            <div className="text-xs text-gray-400">{l.phone} {l.email && `• ${l.email}`}</div>
                        </div>
                        <button onClick={() => setParsed(parsed.filter((_, idx) => idx !== i))} className="text-red-400">
                            <Trash2 size={16}/>
                        </button>
                    </div>
                ))}
            </div>
            <div className="flex gap-3">
                <button onClick={() => setParsed([])} className="flex-1 py-3 text-gray-500 font-bold">Cancel</button>
                <button onClick={handleSave} className="flex-1 py-3 bg-green-600 text-white rounded-xl font-bold shadow-lg">
                    {isSaving ? "Saving..." : "Save All"}
                </button>
            </div>
        </div>
    ); 
    
    return (
        <div className="p-6 max-w-md mx-auto h-screen bg-white flex flex-col">
            <button onClick={onBack} className="text-gray-400 mb-4 flex items-center gap-2">
                <ArrowLeft size={16}/> Back
            </button>
            <h1 className="text-2xl font-bold text-gray-800 mb-2">Paste Page</h1>
            <textarea value={text} onChange={e => setText(e.target.value)} placeholder="Paste here..." className="flex-1 w-full p-4 bg-gray-50 rounded-xl border outline-none font-mono text-sm mb-4"/>
            <button onClick={parseText} disabled={!text} className="w-full bg-purple-600 disabled:bg-gray-300 text-white p-4 rounded-xl font-bold text-lg shadow-lg">Find Leads</button>
        </div>
    ); 
}

function ManualForm({ onBack, onSubmit, status }) { 
    const [name, setName] = useState(""); 
    const [phone, setPhone] = useState(""); 
    const [email, setEmail] = useState(""); 
    const [context, setContext] = useState("Policy Expiry"); 
    
    const handleSubmit = () => { 
        if(!phone) return alert("Phone is required"); 
        onSubmit({ name: name || "Customer", phone: "91" + phone.replace(/\D/g,'').slice(-10), email, context }); 
        setName(""); setPhone(""); setEmail(""); setContext("Policy Expiry"); 
    }; 
    
    return (
        <div className="p-6 max-w-md mx-auto h-screen bg-white">
            <button onClick={onBack} className="text-gray-400 mb-6 flex items-center gap-2">
                <ArrowLeft size={16}/> Back
            </button>
            <h1 className="text-2xl font-bold text-gray-800 mb-6">Add New Lead</h1>
            <div className="space-y-4">
                <div>
                    <label className="text-xs font-bold text-gray-400 uppercase">Name</label>
                    <input value={name} onChange={e=>setName(e.target.value)} className="w-full p-3 bg-gray-50 rounded-lg text-lg border outline-none" placeholder="Rahul Sharma" />
                </div>
                <div>
                    <label className="text-xs font-bold text-gray-400 uppercase">Phone</label>
                    <input type="tel" value={phone} onChange={e=>setPhone(e.target.value)} className="w-full p-3 bg-gray-50 rounded-lg text-lg border outline-none font-mono" placeholder="9876543210" />
                </div>
                <div>
                    <label className="text-xs font-bold text-gray-400 uppercase">Email</label>
                    <input type="email" value={email} onChange={e=>setEmail(e.target.value)} className="w-full p-3 bg-gray-50 rounded-lg text-lg border outline-none" placeholder="rahul@example.com" />
                </div>
                <div>
                    <label className="text-xs font-bold text-gray-400 uppercase">Context</label>
                    <input value={context} onChange={e=>setContext(e.target.value)} className="w-full p-3 bg-gray-50 rounded-lg text-lg border outline-none" placeholder="Policy Expired" />
                </div>
                <button onClick={handleSubmit} className="w-full bg-blue-600 text-white p-4 rounded-xl font-bold text-lg mt-4 shadow-lg">Save to Queue</button>
                {status && <p className="text-center font-bold text-green-600">{status}</p>}
            </div>
        </div>
    ); 
}

function HelpScreen({ onBack }) { 
    return (
        <div className="p-6 max-w-md mx-auto h-screen bg-white flex flex-col overflow-y-auto">
            <button onClick={onBack} className="text-gray-400 mb-4 flex items-center gap-2">
                <ArrowLeft size={16}/> Back
            </button>
            <h1 className="text-3xl font-black text-gray-800 mb-6">User Guide</h1>
            <div className="space-y-6">
                <p><strong>1. Scan:</strong> Use 'Paste Page' to import data from notebooks or cards.</p>
                <p><strong>2. Stack:</strong> Use the Toggle (⚡/📞) to switch between WhatsApp and Calling mode.</p>
                <p><strong>3. Vault:</strong> Leads tagged as 'Hot' appear in the 'My Hot Leads' section for follow-ups.</p>
                <p><strong>4. Digital Card:</strong> Click the share icon (ScanLine) on the main menu to send your personal website link.</p>
            </div>
        </div>
    ); 
}

function SettingsForm({ currentTemplate, library, onSaveActive, onAddToLib, onRemoveFromLib, onBack }) { 
    const [temp, setTemp] = useState(currentTemplate); 
    const [saveName, setSaveName] = useState(""); 
    
    return (
        <div className="p-6 max-w-md mx-auto h-screen bg-white overflow-y-auto">
            <button onClick={onBack} className="text-gray-400 mb-6 flex items-center gap-2">
                <ArrowLeft size={16}/> Back
            </button>
            <h1 className="text-2xl font-bold text-gray-800 mb-6">Settings</h1>
            <textarea value={temp} onChange={e => setTemp(e.target.value)} className="w-full h-32 p-4 bg-gray-50 rounded-xl border outline-none mb-4" />
            <button onClick={() => onSaveActive(temp)} className="w-full bg-blue-600 text-white p-3 rounded-xl font-bold mb-8">Save Active</button>
            
            <div className="flex gap-2 mb-4">
                <input value={saveName} onChange={e => setSaveName(e.target.value)} placeholder="Template Name" className="flex-1 p-2 rounded-lg border outline-none"/>
                <button onClick={() => { if(saveName) { onAddToLib(saveName, temp); setSaveName(""); }}} className="bg-purple-600 text-white p-2 rounded-lg font-bold"><Plus size={20}/></button>
            </div>
            
            <div className="space-y-3">
                {library.map(t => (
                    <div key={t.id} className="p-3 border rounded-xl flex items-center justify-between">
                        <div onClick={() => setTemp(t.text)} className="cursor-pointer flex-1">
                            <div className="font-bold">{t.name}</div>
                            <div className="text-xs text-gray-400 truncate w-48">{t.text}</div>
                        </div>
                        <button onClick={() => onRemoveFromLib(t.id)} className="text-red-300"><X size={16}/></button>
                    </div>
                ))}
            </div>
        </div>
    ); 
}

// 8. HELPERS (Landing Page Components)
function FeatureCard({ icon, title, text }) { 
    return (
        <div className="bg-white p-8 rounded-3xl border border-gray-100 hover:shadow-xl transition-shadow">
            <div className="text-blue-600 bg-blue-50 p-4 rounded-xl w-16 h-16 flex items-center justify-center mb-6">{icon}</div>
            <h3 className="font-bold text-xl text-gray-900 mb-3">{title}</h3>
            <p className="text-gray-500 leading-relaxed">{text}</p>
        </div>
    ); 
}

function UseCaseCard({ icon, title, text }) { 
    return (
        <div className="p-6 rounded-2xl border border-gray-100 hover:shadow-lg transition-shadow bg-gray-50">
            <div className="text-orange-600 mb-4">{icon}</div>
            <h3 className="font-bold text-lg mb-2">{title}</h3>
            <p className="text-sm text-gray-500 leading-relaxed">{text}</p>
        </div>
    ); 
}

function PricingCard({ title, price, highlight, btn, features }) { 
    return (
        <div className={`rounded-3xl p-8 flex flex-col ${highlight ? 'border-2 border-orange-500 bg-orange-50 shadow-2xl transform md:-translate-y-4' : 'border border-gray-200 hover:shadow-xl'}`}>
            {highlight && <div className="text-xs font-bold text-orange-600 uppercase tracking-widest mb-2">Best Value</div>}
            <h3 className="text-xl font-bold text-gray-800 mb-2">{title}</h3>
            <div className="text-4xl font-black text-gray-900 mb-6">{price}</div>
            <ul className="space-y-4 mb-8 flex-1">
                {features.map((f,i) => <li key={i} className="flex gap-2 text-sm font-bold text-gray-600"><CheckSquare size={16} className={highlight ? "text-orange-600" : "text-gray-400"}/> {f}</li>)}
            </ul>
            <button className={`w-full py-4 rounded-xl font-bold ${highlight ? 'bg-orange-600 text-white' : 'bg-gray-100 text-gray-700'}`}>{btn}</button>
        </div>
    ); 
}

// 9. HELPER COMPONENT: PRICING CHECKMARK
function PricingCheck({ text, highlight }) {
    return (
        <li className="flex items-center gap-3">
            <div className={`p-1 rounded-full ${highlight ? 'bg-orange-200 text-orange-700' : 'bg-gray-100 text-gray-500'}`}>
                <CheckSquare size={14} strokeWidth={3} />
            </div>
            <span className={`text-sm font-bold ${highlight ? 'text-gray-900' : 'text-gray-500'}`}>{text}</span>
        </li>
    );
}

// 10. FAQ ITEM
function FAQItem({ q, a }) {
    const [open, setOpen] = useState(false);
    return (
        <div onClick={() => setOpen(!open)} className="cursor-pointer border-b border-gray-100 pb-4">
            <div className="flex justify-between items-center">
                <h3 className="font-bold text-gray-700 text-sm">{q}</h3>
                {open ? <ChevronUp size={16} className="text-gray-400"/> : <ChevronDown size={16} className="text-gray-400"/>}
            </div>
            {open && <p className="text-sm text-gray-500 mt-2 leading-relaxed">{a}</p>}
        </div>
    );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);