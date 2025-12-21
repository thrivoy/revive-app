import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import { motion, useAnimation } from 'framer-motion';
import Papa from 'papaparse';
import './index.css'; 
import { 
  Phone, 
  Upload, 
  UserPlus, 
  ArrowLeft, 
  ClipboardPaste, 
  Trash2, 
  Zap, 
  ScanLine, 
  Settings, 
  List, 
  Plus, 
  X, 
  Wand2, 
  HelpCircle, 
  Info, 
  CheckSquare, 
  Square, 
  Play, 
  UserMinus, 
  Mail, 
  Clock, 
  Flame, 
  ThumbsUp, 
  Snowflake, 
  UserCheck, 
  ShieldCheck, 
  Camera, 
  Mic, 
  Globe, 
  Edit3, 
  Link as LinkIcon, 
  ChevronDown, 
  ChevronUp
} from 'lucide-react';

// ==========================================
// CONFIGURATION
// ==========================================

// ⚠️ PASTE YOUR NEW GOOGLE SCRIPT DEPLOYMENT URL HERE
const API_URL = "https://script.google.com/macros/s/AKfycbyzw_dmwd4VI2sZklYM4t87sUtPo-twJP4lMDzBOBHaETKNdhaLb32tI5-KoHg0bteOFw/exec";

const ADMIN_KEY = "master";

const ANNOUNCEMENT = {
    title: "AI Power Unlocked 🧠",
    text: "Use the Camera icon to scan business cards instantly. Use the Wand to rewrite messages in Hindi!",
    type: "info" 
};

const DEFAULT_TEMPLATE = "Hi {{name}}, regarding {{context}}. Can we have a quick chat?";

// ==========================================
// 1. MAIN APP CONTROLLER
// ==========================================
function App() {
  // --- STATE MANAGEMENT ---
  const [view, setView] = useState("menu");
  const [clientId, setClientId] = useState("");
  const [publicProfileId, setPublicProfileId] = useState(null);
  const [queue, setQueue] = useState([]);
  const [stats, setStats] = useState({ today: 0 });
  const [userProfile, setUserProfile] = useState(null); 
  const [status, setStatus] = useState("");
  
  // Persistent Settings
  const [template, setTemplate] = useState(() => {
      return localStorage.getItem("revive_active_template") || DEFAULT_TEMPLATE;
  });
  
  const [library, setLibrary] = useState(() => {
      return JSON.parse(localStorage.getItem("revive_library") || "[]");
  });

  // --- EFFECTS ---

  // Save template whenever it changes
  useEffect(() => { 
      localStorage.setItem("revive_active_template", template); 
  }, [template]);

  // Handle URL Parameters on Load
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const key = params.get("key"); 
    const user = params.get("u"); 

    if (user) {
        setPublicProfileId(user);
    } else if (key) {
        setClientId(key); 
        fetchQueue(key); 
        
        // Fetch User Profile for Settings Editor
        fetch(API_URL, { 
            method: 'POST', 
            body: JSON.stringify({ action: "GET_CLIENT_PROFILE", payload: { client_id: key } }) 
        })
        .then(r => r.json())
        .then(j => { 
            if(j.data) setUserProfile(j.data); 
        });
    }
  }, []);

  // --- ACTION HANDLERS ---

  const saveActiveTemplate = (newTemp) => { 
      setTemplate(newTemp); 
      localStorage.setItem("revive_active_template", newTemp); 
  };

  const addToLibrary = (name, text) => { 
      const n = [...library, { id: Date.now(), name, text }]; 
      setLibrary(n); 
      localStorage.setItem("revive_library", JSON.stringify(n)); 
  };

  const removeFromLibrary = (id) => { 
      const n = library.filter(t => t.id !== id); 
      setLibrary(n); 
      localStorage.setItem("revive_library", JSON.stringify(n)); 
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
    } catch(e) { 
        console.error("API Error", e); 
    }
  };

  const handleBulkSubmit = async (leads) => {
    setStatus(`Saving ${leads.length} leads...`);
    try {
        const res = await fetch(API_URL, { 
            method: 'POST', 
            body: JSON.stringify({ action: "ADD_LEADS", payload: { client_id: clientId, leads: leads } }) 
        });
        const json = await res.json();
        
        if(json.status === "error" && json.message === "LIMIT_REACHED") {
            alert("🔒 LIMIT REACHED!\n\nYou have hit the 100 Lead Limit on the Free Plan.\nUpgrade to Pro to add more.");
            setStatus("");
        } else {
            setStatus("Saved!");
            fetchQueue(clientId); 
            setView("menu");
        }
    } catch(e) { 
        setStatus("Error: " + e.message); 
    }
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

  // --- ROUTING LOGIC ---

  if (publicProfileId) return <DigitalCard profileId={publicProfileId} />;
  if (clientId === ADMIN_KEY) return <AdminDashboard />;
  if (!clientId) return <LandingPage />;
  
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
          userProfile={userProfile} clientId={clientId} 
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
  
  if(view === "camera") return (
      <CameraScan 
          onBack={() => setView("menu")} onSubmit={(l) => handleBulkSubmit([l])} 
      />
  );
  
  return <div className="h-screen flex items-center justify-center">Loading Thrivoy...</div>;
}

// ==========================================
// 2. MENU SCREEN (DASHBOARD)
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
      <div className="p-6 max-w-md mx-auto space-y-6 animate-in fade-in pb-24">
          {/* Header */}
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
          
          {/* Scoreboard */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-500 rounded-xl p-4 text-white shadow-lg flex justify-between items-center">
              <div>
                  <div className="text-blue-100 text-xs font-bold uppercase tracking-wider">Daily Score</div>
                  <div className="text-3xl font-black">{stats.today} <span className="text-lg font-normal opacity-70">wins</span></div>
              </div>
              <div className="bg-white/20 p-3 rounded-lg"><Zap size={24} fill="currentColor"/></div>
          </div>

          {/* Announcement */}
          {announcement.text && (
              <div className="p-4 rounded-xl border bg-purple-50 border-purple-100 text-purple-900 flex items-start gap-3">
                  <div className="mt-1"><Info size={20} /></div>
                  <div>
                      <h3 className="font-bold text-sm">{announcement.title}</h3>
                      <p className="text-xs opacity-90 leading-relaxed">{announcement.text}</p>
                  </div>
              </div>
          )}
          
          {/* AI Tools */}
          <div className="grid grid-cols-2 gap-4">
              <button onClick={() => onViewChange("camera")} className="bg-white border border-gray-200 text-gray-700 p-4 rounded-xl shadow-sm flex flex-col items-center justify-center gap-2 hover:bg-gray-50">
                  <Camera size={24} className="text-orange-500"/>
                  <span className="font-bold text-sm">Scan Card</span>
              </button>
              <button onClick={() => onViewChange("bulk")} className="bg-white border border-gray-200 text-gray-700 p-4 rounded-xl shadow-sm flex flex-col items-center justify-center gap-2 hover:bg-gray-50">
                  <Wand2 size={24} className="text-purple-600"/>
                  <span className="font-bold text-sm">AI Paste</span>
              </button>
          </div>
          
          {/* Manual Tools */}
          <div className="grid grid-cols-2 gap-4">
              <button onClick={() => onViewChange("manual")} className="bg-white border border-gray-200 text-gray-700 p-4 rounded-xl shadow-sm flex flex-col items-center justify-center gap-2 hover:bg-gray-50">
                  <UserPlus size={24} className="text-blue-600"/>
                  <span className="font-bold text-sm">Add One</span>
              </button>
               <button onClick={() => onViewChange("hotlist")} className="bg-orange-50 border border-orange-200 text-orange-800 p-4 rounded-xl shadow-sm flex flex-col items-center justify-center gap-2 hover:bg-orange-100">
                  <Flame size={24} />
                  <span className="font-bold text-sm">Hot Vault</span>
              </button>
          </div>

          {/* File Upload */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 text-center">
              <Upload className="mx-auto mb-2 text-gray-400" />
              <p className="text-sm text-gray-500 mb-4">Have a CSV file?</p>
              <label className="bg-gray-100 text-gray-600 px-4 py-2 rounded-lg text-sm font-bold cursor-pointer hover:bg-gray-200 transition-colors">
                  Upload CSV 
                  <input type="file" accept=".csv" onChange={onUpload} className="hidden" />
              </label>
          </div>
          
          {/* Play Button */}
          {queue.length > 0 && (
             <button onClick={() => onViewChange("stack")} className="w-full bg-green-600 text-white p-4 rounded-xl font-bold shadow-lg flex items-center justify-center gap-2 hover:bg-green-700">
                <Play size={20} fill="currentColor"/> Start Calling ({queue.length})
             </button>
          )}
          
          {status && <p className="text-center font-bold text-blue-600 animate-pulse">{status}</p>}
      </div>
    );
}

// ==========================================
// 3. CARD STACK (THE ENGINE)
// ==========================================
function CardStack({ queue, setQueue, template, library, onBack }) { 
    const [mode, setMode] = useState("card"); // 'card' | 'disposition' | 'snooze'
    const [actionType, setActionType] = useState("whatsapp"); // 'whatsapp' | 'call'
    const [file, setFile] = useState(null); 
    const [polyglotMenu, setPolyglotMenu] = useState(false);
    const controls = useAnimation(); 
    
    // Safety check
    if(queue.length === 0) return (
        <div className="h-screen flex flex-col items-center justify-center p-6 text-center">
            <div className="text-6xl mb-6">🎉</div>
            <h2 className="text-2xl font-bold text-gray-800">All Caught Up!</h2>
            <button onClick={onBack} className="mt-8 bg-blue-600 text-white px-6 py-3 rounded-xl font-bold">Return to Menu</button>
        </div>
    ); 

    const active = queue[0]; 

    // Template Logic
    let activeTemplate = template; 
    const matched = library.find(t => (active.context || "").toLowerCase().includes(t.name.toLowerCase())); 
    if(matched) activeTemplate = matched.text; 
    
    // Message State
    const [currentMessage, setCurrentMessage] = useState(activeTemplate.replace("{{name}}", active.name).replace("{{context}}", active.context || "your update"));
    
    // Reset message when card changes
    useEffect(() => {
        setCurrentMessage(activeTemplate.replace("{{name}}", active.name).replace("{{context}}", active.context || "your update"));
    }, [active.lead_id]);

    const updateActive = (field, value) => { const newQ = [...queue]; newQ[0][field] = value; setQueue(newQ); }; 
    const removeCard = () => { setQueue(q => q.slice(1)); setMode("card"); setFile(null); }; 

    // AI POLYGLOT REWRITE ACTION
    const handleAiRewrite = async (tone, lang) => {
        setPolyglotMenu(false);
        // Show temporary loading text
        const oldMsg = currentMessage;
        setCurrentMessage("AI is writing...");
        
        const res = await fetch(API_URL, { 
            method: 'POST', 
            body: JSON.stringify({ action: "AI_REWRITE_MSG", payload: { context: active.context, current_msg: oldMsg, tone, lang } }) 
        });
        
        const json = await res.json();
        if(json.data) setCurrentMessage(json.data);
        else setCurrentMessage(oldMsg);
    };

    // MAIN ACTION (Call or Chat)
    const handlePrimaryAction = async () => {
        if (actionType === 'call') { 
            window.open(`tel:${active.phone}`, '_self'); 
            setMode("disposition"); 
        } else {
            if (file && navigator.share) { 
                try { 
                    await navigator.share({ files: [file], title: 'Message', text: currentMessage }); 
                    setMode("disposition"); 
                } catch (err) { console.log(err); } 
            } else { 
                window.open(`https://wa.me/${active.phone}?text=${encodeURIComponent(currentMessage)}`, '_blank'); 
                setMode("disposition"); 
            }
        }
    };

    const submitOutcome = (tag) => { 
        controls.start({ x: 500, opacity: 0 }).then(() => { 
            controls.set({ x: 0, opacity: 1 }); 
            fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: "MARK_SENT", payload: { lead_id: active.lead_id, outcome: tag } }) }); 
            removeCard(); 
        }); 
    };
    
    const addToCalendar = (days) => { 
        const d = new Date(); d.setDate(d.getDate() + days); 
        const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent('Call '+active.name)}&details=${encodeURIComponent(active.context)}&dates=${d.toISOString().replace(/-|:|\.\d\d\d/g,"")}/${d.toISOString().replace(/-|:|\.\d\d\d/g,"")}`;
        window.open(url, '_blank');
        
        controls.start({ y: 500, opacity: 0 }).then(() => { 
            controls.set({ y: 0, opacity: 1 }); 
            fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: "SNOOZE_LEAD", payload: { lead_id: active.lead_id, date: d.toISOString().split('T')[0] } }) }); 
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
                <button onClick={() => addToCalendar(1)} className="bg-purple-600 p-4 rounded-xl font-bold">Tomorrow</button>
                <button onClick={() => addToCalendar(3)} className="bg-purple-600 p-4 rounded-xl font-bold">3 Days</button>
                <button onClick={() => addToCalendar(7)} className="bg-purple-600 p-4 rounded-xl font-bold">Next Week</button>
            </div>
            <button onClick={() => setMode("card")} className="mt-8 underline text-sm">Cancel</button>
        </div>
    );

    // --- MAIN CARD RENDER ---
    return (
        <div className="h-screen flex flex-col items-center justify-center p-4 max-w-sm mx-auto relative">
            <button onClick={onBack} className="absolute top-6 left-6 p-2 bg-gray-100 rounded-full text-gray-600 z-10"><ArrowLeft size={20} /></button>
            <div className="absolute top-6 right-6 z-10 bg-gray-100 p-1 rounded-lg flex">
                <button onClick={() => setActionType('whatsapp')} className={`p-2 rounded-md ${actionType === 'whatsapp' ? 'bg-white shadow text-green-600' : 'text-gray-400'}`}><Zap size={20}/></button>
                <button onClick={() => setActionType('call')} className={`p-2 rounded-md ${actionType === 'call' ? 'bg-white shadow text-blue-600' : 'text-gray-400'}`}><Phone size={20}/></button>
            </div>
            
            <motion.div animate={controls} className="bg-white w-full h-full max-h-[80vh] rounded-3xl shadow-2xl p-6 flex flex-col justify-between relative overflow-hidden mt-8">
                <div className="space-y-4 flex-1 flex flex-col min-h-0 relative">
                   
                   {/* Polyglot Menu Popup */}
                   {polyglotMenu && (
                       <div className="absolute top-10 right-0 z-20 bg-white border shadow-xl rounded-xl p-2 w-48 animate-in fade-in">
                           <div className="text-xs font-bold text-gray-400 mb-2 px-2">REWRITE AS:</div>
                           <button onClick={() => handleAiRewrite("Professional", "English")} className="w-full text-left p-2 hover:bg-gray-50 rounded text-sm font-bold">👔 Professional</button>
                           <button onClick={() => handleAiRewrite("Friendly", "English")} className="w-full text-left p-2 hover:bg-gray-50 rounded text-sm font-bold">👋 Friendly</button>
                           <div className="border-t my-1"></div>
                           <button onClick={() => handleAiRewrite("Persuasive", "Hindi")} className="w-full text-left p-2 hover:bg-gray-50 rounded text-sm font-bold">🇮🇳 Hindi</button>
                           <button onClick={() => handleAiRewrite("Persuasive", "Hinglish")} className="w-full text-left p-2 hover:bg-gray-50 rounded text-sm font-bold">💬 Hinglish</button>
                           <button onClick={() => setPolyglotMenu(false)} className="w-full text-center text-xs text-red-400 mt-2">Close</button>
                       </div>
                   )}

                   {/* Lead Context */}
                   <div className="relative shrink-0">
                       <input value={active.context} onChange={(e) => updateActive('context', e.target.value)} className="bg-blue-50 text-blue-800 text-xs font-bold px-2 py-1 rounded w-full outline-none" placeholder="Reason" />
                       <button onClick={() => setPolyglotMenu(!polyglotMenu)} className="absolute right-0 top-0 p-1 text-purple-600"><Globe size={16}/></button>
                   </div>
                   
                   {/* Lead Details */}
                   <div className="shrink-0">
                       <input value={active.name} onChange={(e) => updateActive('name', e.target.value)} className="text-3xl font-bold text-gray-800 w-full outline-none" />
                       <div className="flex flex-col mt-1"><span className="text-gray-400 font-mono text-sm">+{active.phone}</span></div>
                   </div>
                   
                   {/* Message Area */}
                   {actionType === 'whatsapp' ? (
                       <textarea value={currentMessage} onChange={e => setCurrentMessage(e.target.value)} className="bg-gray-50 p-3 rounded-lg text-xs text-gray-600 overflow-y-auto border border-gray-100 flex-1 w-full outline-none resize-none" />
                   ) : (
                       <div className="bg-blue-50 p-3 rounded-lg text-xs text-blue-800 flex-1 flex items-center justify-center font-bold border border-blue-100">
                           📞 Power Dialer Mode Active
                       </div>
                   )}
                   
                   {/* Attachment Area */}
                   {actionType === 'whatsapp' && (
                       <label className={`block border-2 border-dashed rounded-xl p-2 text-center cursor-pointer shrink-0 ${file ? 'border-green-500 bg-green-50' : 'border-gray-200'}`}>
                           <input type="file" accept="image/*,.pdf" onChange={(e)=>setFile(e.target.files[0])} className="hidden" />
                           <div className="flex items-center justify-center gap-2 text-xs font-bold text-gray-500">
                               {file ? "Attached" : "Attach Photo"}
                           </div>
                       </label>
                   )}
                </div>
                
                {/* Fixed Footer Buttons */}
                <div className="mt-4 space-y-2 shrink-0">
                    <button onClick={handlePrimaryAction} className={`w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 text-white shadow-lg active:scale-95 transition-transform ${actionType === 'call' ? 'bg-blue-600' : 'bg-green-500'}`}>
                        {actionType === 'call' ? <><Phone size={24} /> DIAL NUMBER</> : <><Zap size={24} /> Send WhatsApp</>}
                    </button>
                    <div className="flex gap-2">
                        <button onClick={() => controls.start({ x: -500 }).then(removeCard)} className="flex-1 py-3 rounded-xl font-bold text-gray-500 bg-gray-50 flex items-center justify-center gap-2"><Trash2 size={18} /> Skip</button>
                        <button onClick={() => setMode("snooze")} className="px-4 py-3 rounded-xl font-bold text-purple-600 bg-purple-50 flex items-center justify-center"><Clock size={18} /></button>
                    </div>
                </div>
            </motion.div>
        </div>
    ); 
}

// ==========================================
// 4. MANUAL FORM (WITH VOICE)
// ==========================================
function ManualForm({ onBack, onSubmit, status }) { 
    const [name, setName] = useState(""); 
    const [phone, setPhone] = useState(""); 
    const [context, setContext] = useState(""); 
    const [listening, setListening] = useState(false);

    const toggleMic = () => {
        if (!('webkitSpeechRecognition' in window)) return alert("Voice not supported in this browser. Use Chrome.");
        const recognition = new window.webkitSpeechRecognition();
        recognition.continuous = false;
        recognition.lang = 'en-IN';
        
        recognition.onstart = () => setListening(true);
        recognition.onend = () => setListening(false);
        recognition.onresult = (event) => {
            const text = event.results[0][0].transcript;
            setContext(prev => prev + " " + text);
        };
        
        if(listening) recognition.stop();
        else recognition.start();
    };

    const handleSubmit = () => { 
        if(!phone) return alert("Phone is required"); 
        onSubmit({ name: name || "Customer", phone: "91" + phone.replace(/\D/g,'').slice(-10), context: context || "Lead" }); 
        setName(""); setPhone(""); setContext(""); 
    }; 
    
    return (
        <div className="p-6 max-w-md mx-auto h-screen bg-white">
            <button onClick={onBack} className="text-gray-400 mb-6 flex items-center gap-2"><ArrowLeft size={16}/> Back</button>
            <h1 className="text-2xl font-bold text-gray-800 mb-6">Add New Lead</h1>
            <div className="space-y-4">
                <div>
                    <label className="text-xs font-bold text-gray-400 uppercase">Name</label>
                    <input value={name} onChange={e=>setName(e.target.value)} className="w-full p-3 bg-gray-50 rounded-lg text-lg border outline-none" placeholder="Name" />
                </div>
                <div>
                    <label className="text-xs font-bold text-gray-400 uppercase">Phone</label>
                    <input type="tel" value={phone} onChange={e=>setPhone(e.target.value)} className="w-full p-3 bg-gray-50 rounded-lg text-lg border outline-none font-mono" placeholder="Phone" />
                </div>
                <div>
                    <label className="text-xs font-bold text-gray-400 uppercase">Context / Notes</label>
                    <div className="relative">
                        <textarea value={context} onChange={e=>setContext(e.target.value)} className="w-full p-3 bg-gray-50 rounded-lg text-lg border outline-none" placeholder="E.g. Met at gym, wants 3BHK" />
                        <button onClick={toggleMic} className={`absolute right-2 bottom-2 p-2 rounded-full ${listening ? 'bg-red-500 text-white animate-pulse' : 'bg-gray-200 text-gray-600'}`}><Mic size={20}/></button>
                    </div>
                </div>
                <button onClick={handleSubmit} className="w-full bg-blue-600 text-white p-4 rounded-xl font-bold text-lg mt-4 shadow-lg">Save to Queue</button>
                {status && <p className="text-center font-bold text-green-600">{status}</p>}
            </div>
        </div>
    ); 
}

// ==========================================
// 5. CAMERA SCAN (VISION AI)
// ==========================================
function CameraScan({ onBack, onSubmit }) {
    const fileInputRef = useRef(null);
    const [loading, setLoading] = useState(false);

    const handleFile = async (e) => {
        const file = e.target.files[0];
        if(!file) return;
        setLoading(true);

        const reader = new FileReader();
        reader.onload = (readerEvent) => {
            const img = new Image();
            img.onload = () => {
                // Resize logic to keep payload small for Gemini
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 800; 
                const scaleSize = MAX_WIDTH / img.width;
                canvas.width = MAX_WIDTH;
                canvas.height = img.height * scaleSize;
                const ctx = canvas.getContext("2d");
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
                const base64 = dataUrl.split(",")[1];

                // Call Backend
                fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: "AI_ANALYZE_IMAGE", payload: { image: base64 } }) })
                .then(r => r.json())
                .then(json => {
                    if(json.data) onSubmit([json.data]);
                    else alert("Could not scan card.");
                    setLoading(false);
                });
            };
            img.src = readerEvent.target.result;
        };
        reader.readAsDataURL(file);
    };

    return (
        <div className="h-screen bg-black flex flex-col items-center justify-center p-6 text-white text-center">
            {loading ? (
                <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-orange-500 mb-4"></div>
            ) : (
                <>
                    <Camera size={64} className="mb-6 text-orange-500"/>
                    <h2 className="text-2xl font-bold mb-2">Scan Business Card</h2>
                    <p className="text-gray-400 mb-8">Take a photo. AI will type it for you.</p>
                    <button onClick={() => fileInputRef.current.click()} className="w-full py-4 bg-orange-600 rounded-xl font-bold text-lg mb-4">Open Camera</button>
                    <button onClick={onBack} className="text-gray-400">Cancel</button>
                    <input type="file" ref={fileInputRef} accept="image/*" capture="environment" onChange={handleFile} className="hidden" />
                </>
            )}
        </div>
    );
}

// ==========================================
// 6. BULK PASTE (SMART SCAN WITH FIXED FOOTER)
// ==========================================
function BulkPasteForm({ onBack, onSubmit }) { 
    const [text, setText] = useState(""); 
    const [parsed, setParsed] = useState([]); 
    const [loading, setLoading] = useState(false); 
    
    const handleSmartScan = async () => {
        if(!text) return;
        setLoading(true);
        try {
            const res = await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: "AI_PARSE_TEXT", payload: { text } }) });
            const json = await res.json();
            if(json.data) setParsed(json.data);
        } catch(e) { alert("AI Error: " + e.message); }
        setLoading(false);
    };

    const handleSave = async () => { await onSubmit(parsed); }; 
    
    // RESULT VIEW
    if(parsed.length > 0) return (
        <div className="h-screen bg-white flex flex-col font-sans">
            <div className="p-4 border-b flex justify-between items-center bg-gray-50 shrink-0">
                <h2 className="font-bold">✨ AI Found {parsed.length} Leads</h2>
                <button onClick={() => setParsed([])} className="text-red-500 text-sm font-bold">Reset</button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 pb-24">
                {parsed.map((l, i) => (
                    <div key={i} className="flex gap-3 p-3 bg-white rounded-xl border shadow-sm">
                        <div className={`w-1 rounded-full ${l.score === 'Hot' ? 'bg-orange-500' : 'bg-gray-300'}`}></div>
                        <div className="flex-1">
                            <div className="flex justify-between"><span className="font-bold text-gray-800">{l.name}</span><span className="text-[10px] font-bold bg-gray-100 px-2 rounded text-gray-500">{l.score}</span></div>
                            <div className="text-xs text-gray-500">{l.phone}</div>
                            <div className="text-xs text-blue-600 mt-1 italic">"{l.context}"</div>
                        </div>
                    </div>
                ))}
            </div>
            {/* FIXED FOOTER */}
            <div className="p-4 border-t shrink-0 bg-white">
                <button onClick={handleSave} className="w-full py-3 bg-green-600 text-white rounded-xl font-bold shadow-lg">Save to CRM</button>
            </div>
        </div>
    ); 
    
    // INPUT VIEW
    return (
        <div className="p-6 max-w-md mx-auto h-screen bg-white flex flex-col">
            <button onClick={onBack} className="text-gray-400 mb-4 flex items-center gap-2"><ArrowLeft size={16}/> Back</button>
            <h1 className="text-2xl font-black text-gray-800 mb-2">AI Smart Scan 🧠</h1>
            <p className="text-sm text-gray-500 mb-4">Paste messy text (e.g. from WhatsApp or Notes). AI will fix it.</p>
            <textarea value={text} onChange={e => setText(e.target.value)} placeholder="e.g. Met Rahul 9888822222 at the gym, he wants a 3BHK..." className="flex-1 w-full p-4 bg-gray-50 rounded-xl border outline-none font-mono text-sm mb-4"/>
            <button onClick={handleSmartScan} disabled={!text || loading} className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white p-4 rounded-xl font-bold text-lg shadow-lg flex items-center justify-center gap-2">
                {loading ? "AI is Thinking..." : <><Wand2 size={20}/> Extract Leads</>}
            </button>
        </div>
    ); 
}

// ==========================================
// 7. SETTINGS (PRO PROFILE EDITOR)
// ==========================================
function SettingsForm({ currentTemplate, library, onSaveActive, onAddToLib, onRemoveFromLib, onBack, userProfile, clientId }) { 
    const [temp, setTemp] = useState(currentTemplate); 
    const [saveName, setSaveName] = useState(""); 
    
    // Profile State
    const [title, setTitle] = useState(userProfile?.title || "");
    const [photo, setPhoto] = useState(userProfile?.photo || "");
    const [website, setWebsite] = useState(userProfile?.website || "");

    const saveProfile = () => {
        fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: "UPDATE_PROFILE", payload: { client_id: clientId, title, photo, website } }) });
        alert("Profile Updated!");
    };

    return (
        <div className="p-6 max-w-md mx-auto h-screen bg-white overflow-y-auto">
            <button onClick={onBack} className="text-gray-400 mb-6 flex items-center gap-2"><ArrowLeft size={16}/> Back</button>
            <h1 className="text-2xl font-bold text-gray-800 mb-6">Settings</h1>
            
            {/* Pro Profile Section */}
            <div className="mb-8 p-4 bg-gray-50 rounded-xl border border-gray-100 shadow-sm">
                <h2 className="font-bold text-sm mb-4 flex items-center gap-2"><ShieldCheck size={16} className="text-blue-600"/> Pro Profile Identity</h2>
                <div className="space-y-3">
                    <div>
                        <label className="text-xs font-bold text-gray-400">Job Title</label>
                        <input value={title} onChange={e=>setTitle(e.target.value)} className="w-full p-2 text-sm border rounded" placeholder="e.g. Senior Agent" />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-400">Photo URL (LinkedIn/WhatsApp)</label>
                        <input value={photo} onChange={e=>setPhoto(e.target.value)} className="w-full p-2 text-sm border rounded" placeholder="https://..." />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-400">Website Link</label>
                        <input value={website} onChange={e=>setWebsite(e.target.value)} className="w-full p-2 text-sm border rounded" placeholder="https://..." />
                    </div>
                    <button onClick={saveProfile} className="w-full py-2 bg-blue-600 text-white rounded font-bold text-xs mt-2">Save Profile</button>
                </div>
            </div>

            <h2 className="font-bold text-sm mb-2">Message Template</h2>
            <textarea value={temp} onChange={e => setTemp(e.target.value)} className="w-full h-24 p-4 bg-gray-50 rounded-xl border outline-none mb-4" />
            <button onClick={() => onSaveActive(temp)} className="w-full bg-gray-800 text-white p-3 rounded-xl font-bold mb-8">Set Active</button>
            
            <div className="flex gap-2 mb-4">
                <input value={saveName} onChange={e => setSaveName(e.target.value)} placeholder="New Template Name" className="flex-1 p-2 rounded-lg border outline-none"/>
                <button onClick={() => { if(saveName) { onAddToLib(saveName, temp); setSaveName(""); }}} className="bg-purple-600 text-white p-2 rounded-lg font-bold"><Plus size={20}/></button>
            </div>
            
            <div className="space-y-3 pb-24">
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

// ==========================================
// 8. DIGITAL BUSINESS CARD (PRO VERSION)
// ==========================================
function DigitalCard({ profileId }) {
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: "GET_CLIENT_PROFILE", payload: { client_id: profileId } }) })
            .then(res => res.json()).then(json => { if(json.status === 'success') setProfile(json.data); setLoading(false); });
    }, [profileId]);

    const saveContact = () => {
        const vcard = `BEGIN:VCARD\nVERSION:3.0\nFN:${profile.name}\nTEL;TYPE=CELL:${profile.phone}\nEND:VCARD`;
        const blob = new Blob([vcard], { type: "text/vcard" });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${profile.name}.vcf`; a.click();
    };

    if (loading) return <div className="h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div>;
    if (!profile) return <div className="h-screen flex items-center justify-center text-gray-500">Profile Not Found</div>;

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 font-sans">
            <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden border border-gray-100 animate-in fade-in">
                {/* Header Image */}
                <div className="h-32 bg-gradient-to-r from-blue-600 to-purple-600 relative">
                    <div className="absolute -bottom-12 left-0 right-0 flex justify-center">
                        <div className="w-24 h-24 bg-white rounded-full p-1 shadow-lg overflow-hidden">
                            {profile.photo ? (
                                <img src={profile.photo} className="w-full h-full object-cover" alt="Profile" />
                            ) : (
                                <div className="w-full h-full bg-gray-200 flex items-center justify-center text-gray-500 font-bold text-2xl">{profile.name.charAt(0)}</div>
                            )}
                        </div>
                    </div>
                </div>
                
                {/* Content */}
                <div className="pt-16 pb-8 px-8 text-center">
                    <h1 className="text-2xl font-black text-gray-900">{profile.name}</h1>
                    <p className="text-blue-600 font-bold text-xs uppercase tracking-wide mb-1">{profile.title || "Sales Professional"}</p>
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
                        
                        {profile.website && (
                             <button onClick={() => window.open(profile.website, '_blank')} className="w-full py-3 bg-gray-100 text-gray-700 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-gray-200">
                                <LinkIcon size={18} /> Visit Website
                             </button>
                        )}
                    </div>
                </div>
                
                {/* Footer */}
                <div className="bg-gray-50 p-4 text-center border-t border-gray-100 cursor-pointer" onClick={() => window.open(window.location.origin, '_blank')}>
                    <p className="text-xs text-gray-400 font-bold uppercase tracking-widest flex items-center justify-center gap-1">
                        <Zap size={12} className="text-orange-500"/> Powered by Thrivoy
                    </p>
                </div>
            </div>
        </div>
    );
}

// ==========================================
// 9. HOTLIST VAULT
// ==========================================
function HotList({ clientId, onBack }) {
    const [leads, setLeads] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: "GET_HOTLIST", payload: { client_id: clientId } }) })
        .then(res => res.json()).then(json => { setLeads(json.data || []); setLoading(false); });
    }, []);

    const requeue = (id) => {
        setLeads(leads.filter(l => l.lead_id !== id));
        fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: "REQUEUE_LEAD", payload: { lead_id: id } }) });
        alert("Lead moved back to Stack!");
    };

    return (
        <div className="p-4 max-w-md mx-auto h-screen bg-white flex flex-col">
            <div className="flex items-center justify-between mb-6">
                <button onClick={onBack} className="text-gray-400 flex items-center gap-1"><ArrowLeft size={16}/> Back</button>
                <span className="font-bold text-orange-600 flex items-center gap-2"><Flame size={18} fill="currentColor"/> The Vault</span>
            </div>
            
            {loading ? <div className="text-center p-8 text-gray-400">Digging for gold...</div> : (
                <div className="flex-1 overflow-y-auto space-y-3">
                    {leads.length === 0 ? <div className="text-center p-8 text-gray-400">No Hot Leads yet.</div> : leads.map(l => (
                        <div key={l.lead_id} className="p-4 rounded-xl border border-orange-100 bg-orange-50 shadow-sm">
                            <div className="flex justify-between items-start mb-2">
                                <div>
                                    <h3 className="font-bold text-gray-900">{l.name}</h3>
                                    <p className="text-xs text-gray-500 font-mono">+{l.phone}</p>
                                </div>
                                <span className="bg-orange-200 text-orange-800 text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider">{l.outcome}</span>
                            </div>
                            <button onClick={() => requeue(l.lead_id)} className="w-full mt-2 bg-orange-600 text-white py-2 rounded-lg text-xs font-bold shadow-sm hover:bg-orange-700">
                                Follow Up Now
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// ==========================================
// 10. ADMIN DASHBOARD
// ==========================================
function AdminDashboard() { 
    const [name, setName] = useState(""); 
    const [phone, setPhone] = useState(""); 
    const [res, setRes] = useState(null);
    const [loading, setLoading] = useState(false);

    const create = async () => { 
        setLoading(true);
        const r = await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: "ADD_CLIENT", payload: { name, phone: "91"+phone } }) }); 
        const j = await r.json(); 
        setRes(j.data); 
        setLoading(false);
    };

    return (
        <div className="h-screen bg-slate-900 text-white p-6 flex flex-col justify-center">
            <h1 className="font-bold text-3xl mb-8 text-center">👑 Admin Console</h1>
            {!res ? (
                <div className="bg-slate-800 p-6 rounded-xl space-y-4">
                    <h2 className="text-xl font-bold text-slate-300">Add New Client</h2>
                    <input value={name} onChange={e=>setName(e.target.value)} className="w-full p-3 bg-slate-700 rounded text-white" placeholder="Client Name"/>
                    <input value={phone} onChange={e=>setPhone(e.target.value)} className="w-full p-3 bg-slate-700 rounded text-white" placeholder="Phone Number"/>
                    <button onClick={create} disabled={loading} className="bg-blue-600 w-full p-4 rounded-xl font-bold hover:bg-blue-500">
                        {loading ? "Creating..." : "Create Account"}
                    </button>
                </div>
            ) : (
                <div className="bg-green-900 p-6 rounded-xl text-center space-y-4 border border-green-500">
                    <h2 className="text-2xl font-bold">Success!</h2>
                    <div className="bg-black/30 p-4 rounded text-xs font-mono break-all text-green-200">{res.magic_link}</div>
                    <button onClick={() => window.open(`https://wa.me/${res.phone}`, '_blank')} className="w-full bg-green-500 text-green-900 py-3 rounded-xl font-bold">Send via WhatsApp</button>
                    <button onClick={() => setRes(null)} className="text-green-400 underline text-sm">Add Another</button>
                </div>
            )}
        </div>
    );
}

// ==========================================
// 11. LANDING PAGE
// ==========================================
function LandingPage() { 
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
                    The #1 Sales Tool for India. Scan leads with AI, dial automatically, and close deals on WhatsApp.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 w-full justify-center">
                    <button onClick={() => window.open(`https://wa.me/917892159170?text=I%20want%20Revive%20access`, '_blank')} className="px-8 py-4 bg-orange-600 text-white rounded-xl font-bold text-lg shadow-xl hover:bg-orange-700 hover:scale-105 transition-all">Get Free Access 🇮🇳</button>
                </div>
            </div>
            
            {/* USE CASES */}
             <div className="py-20 px-6 bg-white border-t border-gray-100">
                <div className="max-w-5xl mx-auto">
                    <h2 className="text-3xl font-black text-center text-gray-900 mb-12">Who uses Thrivoy?</h2>
                    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <div className="p-6 rounded-2xl border border-gray-100 hover:shadow-lg transition-shadow bg-gray-50">
                            <div className="text-orange-600 mb-4"><Flame size={32}/></div>
                            <h3 className="font-bold text-lg mb-2">Real Estate</h3>
                            <p className="text-sm text-gray-500 leading-relaxed">Send property photos & brochures to 50 leads in minutes.</p>
                        </div>
                        <div className="p-6 rounded-2xl border border-gray-100 hover:shadow-lg transition-shadow bg-gray-50">
                            <div className="text-orange-600 mb-4"><Phone size={32}/></div>
                            <h3 className="font-bold text-lg mb-2">Used Cars</h3>
                            <p className="text-sm text-gray-500 leading-relaxed">Walkaround videos & car details sent instantly after a call.</p>
                        </div>
                        <div className="p-6 rounded-2xl border border-gray-100 hover:shadow-lg transition-shadow bg-gray-50">
                            <div className="text-orange-600 mb-4"><ShieldCheck size={32}/></div>
                            <h3 className="font-bold text-lg mb-2">Insurance</h3>
                            <p className="text-sm text-gray-500 leading-relaxed">Scan handwritten leads & send policy PDFs effortlessly.</p>
                        </div>
                        <div className="p-6 rounded-2xl border border-gray-100 hover:shadow-lg transition-shadow bg-gray-50">
                            <div className="text-orange-600 mb-4"><Zap size={32}/></div>
                            <h3 className="font-bold text-lg mb-2">Gym Owners</h3>
                            <p className="text-sm text-gray-500 leading-relaxed">Send membership price cards to old inquiries.</p>
                        </div>
                    </div>
                </div>
            </div>
            <div className="p-6 bg-gray-900 text-center text-gray-500 text-sm"><p>&copy; 2025 Thrivoy Inc. Made for India 🇮🇳</p></div>
        </div>
    ); 
}

// ==========================================
// 12. UTILITY & HELP
// ==========================================
function QueueList({ queue, setQueue, library, onBack, onLaunchStack }) {
    const [selected, setSelected] = useState([]);
    const [bulkContext, setBulkContext] = useState("");
    
    const toggleSelect = (id) => { if (selected.includes(id)) setSelected(selected.filter(i => i !== id)); else setSelected([...selected, id]); };
    const toggleAll = () => { if (selected.length === queue.length) setSelected([]); else setSelected(queue.map(q => q.lead_id)); };
    
    const deleteSelected = async () => { 
        if(!confirm(`Archive ${selected.length} leads?`)) return; 
        const newQueue = queue.filter(q => !selected.includes(q.lead_id)); 
        setQueue(newQueue); 
        selected.forEach(id => fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: "MARK_SENT", payload: { lead_id: id, outcome: "Archived" } }) })); 
        setSelected([]); 
    };
    
    const launchCampaign = () => { 
        if(selected.length === 0) return alert("Select at least one!"); 
        const campaignQueue = queue.filter(q => selected.includes(q.lead_id)).map(q => ({ ...q, context: bulkContext || q.context })); 
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
                    <input value={bulkContext} onChange={e => setBulkContext(e.target.value)} placeholder="Bulk Context (e.g. Diwali Offer)" className="flex-1 p-2 text-sm rounded border outline-none font-bold text-blue-900"/>
                    <button onClick={()=>alert("Use context to update many leads at once.")} className="p-2 bg-white rounded border text-blue-600"><Wand2 size={18}/></button>
                </div>
                <div className="flex gap-2">
                    <button onClick={toggleAll} className="flex-1 bg-white border border-blue-200 text-blue-600 py-2 rounded-lg text-xs font-bold">{selected.length === queue.length ? "Deselect All" : "Select All"}</button>
                    {selected.length > 0 && (<button onClick={deleteSelected} className="px-4 bg-red-50 text-red-600 rounded-lg text-xs font-bold flex items-center gap-2 border border-red-100"><UserMinus size={16} /> Archive</button>)}
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

function HelpScreen({ onBack }) { 
    return (
        <div className="p-6 max-w-md mx-auto h-screen bg-white flex flex-col overflow-y-auto">
            <button onClick={onBack} className="text-gray-400 mb-4 flex items-center gap-2"><ArrowLeft size={16}/> Back</button>
            <h1 className="text-3xl font-black text-gray-800 mb-6">User Guide</h1>
            <div className="space-y-6">
                <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                    <h3 className="font-bold text-lg mb-2 flex items-center gap-2"><Camera className="text-orange-500"/> 1. Scanning Cards</h3>
                    <p className="text-sm text-gray-600">Click the Camera icon to take a photo of any business card. AI will automatically extract the name, phone number, and context for you.</p>
                </div>
                
                <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                    <h3 className="font-bold text-lg mb-2 flex items-center gap-2"><Wand2 className="text-purple-500"/> 2. AI Paste</h3>
                    <p className="text-sm text-gray-600">Copy messy text from WhatsApp (e.g., "Rahul 9999999999 wants 3BHK"). Paste it into the AI Paste tool. It will clean it up instantly.</p>
                </div>

                <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                    <h3 className="font-bold text-lg mb-2 flex items-center gap-2"><Zap className="text-green-500"/> 3. Power Calling</h3>
                    <p className="text-sm text-gray-600">Hit "Start Calling". Use the Toggle at the top right to switch between 📞 (Dialer Mode) and ⚡ (WhatsApp Mode). Use the Globe icon to rewrite messages in Hindi or Hinglish.</p>
                </div>
                
                <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                    <h3 className="font-bold text-lg mb-2 flex items-center gap-2"><ScanLine className="text-blue-500"/> 4. Digital Card</h3>
                    <p className="text-sm text-gray-600">Click the QR/Share icon on the main menu. This copies your personal website link. Send this to every client you meet.</p>
                </div>
            </div>
        </div>
    ); 
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);