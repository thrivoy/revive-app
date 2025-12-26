import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import { motion, useAnimation } from 'framer-motion';
import Papa from 'papaparse';
import './index.css'; 
import { 
  Phone, Upload, UserPlus, ArrowLeft, ClipboardPaste, 
  Trash2, Zap, ScanLine, Settings, List, Plus, X, 
  Wand2, HelpCircle, Info, CheckSquare, Square, 
  Play, UserMinus, Mail, Clock, Flame, ThumbsUp, 
  Snowflake, UserCheck, ShieldCheck, Camera, Mic, 
  Globe, Edit3, Link as LinkIcon, ChevronDown, ChevronUp
} from 'lucide-react';

// ⚠️ PASTE YOUR NEW GOOGLE SCRIPT DEPLOYMENT URL HERE
const API_URL = "https://script.google.com/macros/s/AKfycbwUo_K96Kjy1j5Mr1IrwvE_eCigJxK46k7QZ7VNKD-5soGwK1amu1IWcaVX8MYlu3xW2A/exec";

const ADMIN_KEY = "master";

const ANNOUNCEMENT = {
    title: "System Optimized 🚀",
    text: "Duplicate protection active. Manual Form is now mobile-friendly.",
    type: "info" 
};

// ==========================================
// 1. MAIN APP ROUTER
// ==========================================
function App() {
  const [view, setView] = useState("menu");
  const [clientId, setClientId] = useState("");
  const [publicProfileId, setPublicProfileId] = useState(null);
  const [queue, setQueue] = useState([]);
  const [stats, setStats] = useState({ today: 0 });
  const [userProfile, setUserProfile] = useState(null); 
  const [status, setStatus] = useState("");
  const [prefillData, setPrefillData] = useState(null); 
  
  const [template, setTemplate] = useState(() => localStorage.getItem("revive_active_template") || "Hi {{name}}, regarding {{context}}.");
  const [library, setLibrary] = useState(() => JSON.parse(localStorage.getItem("revive_library") || "[]"));

  useEffect(() => { localStorage.setItem("revive_active_template", template); }, [template]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const key = params.get("key"); 
    const user = params.get("u"); 

    if (user) {
        setPublicProfileId(user);
    } else if (key) {
        setClientId(key); 
        fetchQueue(key); 
        fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: "GET_CLIENT_PROFILE", payload: { client_id: key } }) })
            .then(r=>r.json()).then(j => { if(j.data) setUserProfile(j.data); });
    }
  }, []);

  const saveActiveTemplate = (newTemp) => { setTemplate(newTemp); localStorage.setItem("revive_active_template", newTemp); };
  const addToLibrary = (name, text) => { const n = [...library, { id: Date.now(), name, text }]; setLibrary(n); localStorage.setItem("revive_library", JSON.stringify(n)); };
  const removeFromLibrary = (id) => { const n = library.filter(t => t.id !== id); setLibrary(n); localStorage.setItem("revive_library", JSON.stringify(n)); };

  const fetchQueue = async (id) => {
    if(id === ADMIN_KEY) return; 
    try {
        const res = await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: "GET_QUEUE", payload: { client_id: id } }) });
        const json = await res.json();
        if(json.data) { setQueue(json.data.queue || []); if(json.data.stats) setStats(json.data.stats); }
    } catch(e) { console.error("API Error", e); }
  };

  const handleBulkSubmit = async (leads) => {
    setStatus(`Saving ${leads.length} leads...`);
    try {
        const res = await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: "ADD_LEADS", payload: { client_id: clientId, leads: leads } }) });
        const json = await res.json();
        
        if(json.status === "error" && json.message === "LIMIT_REACHED") {
            alert("🔒 LIMIT REACHED!\n\nUpgrade to Pro to add more.");
            setStatus("");
        } else {
            const skipped = json.duplicates_skipped || 0;
            const added = json.count || 0;
            
            if(skipped > 0) {
                alert(`✅ Successfully Saved: ${added}\n🛡️ Duplicates Skipped: ${skipped}`);
            } else {
                setStatus("Saved!");
                setTimeout(() => setStatus(""), 2000);
            }
            
            fetchQueue(clientId); 
            setView("menu");
        }
    } catch(e) { setStatus("Error: " + e.message); }
  };

  const handleFileUpload = (e) => {
    setStatus("Parsing CSV...");
    Papa.parse(e.target.files[0], { header: true, complete: async (results) => {
        const leads = results.data.filter(row => row.Phone).map(row => {
            let ctx = row.Context || "Follow Up";
            if(row.Company) ctx = `[${row.Company}] ` + ctx;
            if(row.Website) ctx = ctx + ` (${row.Website})`;

            return { 
                name: row.Name || "Customer", 
                phone: "91" + row.Phone.replace(/\D/g,'').slice(-10), 
                email: row.Email || "", 
                context: ctx 
            };
        });
        handleBulkSubmit(leads);
    }});
  };

  if (publicProfileId) return <DigitalCard profileId={publicProfileId} />;
  if (clientId === ADMIN_KEY) return <AdminDashboard />;
  if (!clientId) return <LandingPage />;
  
  if(view === "menu") return <MenuScreen queue={queue} stats={stats} status={status} onViewChange={(newView) => { if(newView === "manual") { setPrefillData(null); setStatus(""); } setView(newView); }} onUpload={handleFileUpload} announcement={ANNOUNCEMENT} clientId={clientId} />;
  if(view === "hotlist") return <HotList clientId={clientId} onBack={() => setView("menu")} />;
  if(view === "stack") return <CardStack queue={queue} setQueue={setQueue} template={template} library={library} onBack={() => { fetchQueue(clientId); setView("menu"); }} />;
  if(view === "settings") return <SettingsForm currentTemplate={template} library={library} onSaveActive={saveActiveTemplate} onAddToLib={addToLibrary} onRemoveFromLib={removeFromLibrary} onBack={() => setView("menu")} userProfile={userProfile} clientId={clientId} />;
  if(view === "list") return <QueueList queue={queue} setQueue={setQueue} library={library} onBack={() => setView("menu")} onLaunchStack={() => setView("stack")} />;
  if(view === "manual") return <ManualForm onBack={() => setView("menu")} onSubmit={(l) => handleBulkSubmit([l])} status={status} prefill={prefillData} />;
  if(view === "bulk") return <BulkPasteForm onBack={() => setView("menu")} onSubmit={handleBulkSubmit} />;
  if(view === "help") return <HelpScreen onBack={() => setView("menu")} />;
  if(view === "camera") return <CameraScan onBack={() => setView("menu")} onScanComplete={(data) => { setPrefillData(data); setView("manual"); }} />;
  
  return <div className="h-screen flex items-center justify-center">Loading Thrivoy...</div>;
}

function MenuScreen({ queue, stats, status, onViewChange, onUpload, announcement, clientId }) {
    const shareMyCard = () => { const url = `${window.location.origin}/?u=${clientId}`; if (navigator.share) navigator.share({ title: 'My Digital Card', url }); else window.open(`https://wa.me/?text=${encodeURIComponent(url)}`); };
    return (
      <div className="p-6 max-w-md mx-auto space-y-6 animate-in fade-in pb-24">
          <div className="flex justify-between items-center"><h1 className="text-2xl font-bold text-gray-800">Thrivoy</h1><div className="flex gap-2"><button onClick={shareMyCard} className="p-2 bg-black text-white rounded-full shadow-lg animate-pulse"><ScanLine size={20}/></button><button onClick={() => onViewChange("settings")} className="p-2 bg-gray-100 rounded-full"><Settings size={20}/></button></div></div>
          <div className="bg-gradient-to-r from-blue-600 to-blue-500 rounded-xl p-4 text-white shadow-lg flex justify-between items-center"><div><div className="text-blue-100 text-xs font-bold uppercase tracking-wider">Daily Score</div><div className="text-3xl font-black">{stats.today} <span className="text-lg font-normal opacity-70">wins</span></div></div><div className="bg-white/20 p-3 rounded-lg"><Zap size={24} fill="currentColor"/></div></div>
          {announcement.text && (<div className="p-4 rounded-xl border bg-purple-50 border-purple-100 text-purple-900 flex items-start gap-3"><div className="mt-1"><Info size={20}/></div><div><h3 className="font-bold text-sm">{announcement.title}</h3><p className="text-xs opacity-90 leading-relaxed">{announcement.text}</p></div></div>)}
          <div className="grid grid-cols-2 gap-4"><button onClick={() => onViewChange("camera")} className="bg-white border border-gray-200 text-gray-700 p-4 rounded-xl shadow-sm flex flex-col items-center justify-center gap-2 hover:bg-gray-50"><Camera size={24} className="text-orange-500"/><span className="font-bold text-sm">Scan Card</span></button><button onClick={() => onViewChange("bulk")} className="bg-white border border-gray-200 text-gray-700 p-4 rounded-xl shadow-sm flex flex-col items-center justify-center gap-2 hover:bg-gray-50"><Wand2 size={24} className="text-purple-600"/><span className="font-bold text-sm">AI Paste</span></button></div>
          <div className="grid grid-cols-2 gap-4"><button onClick={() => onViewChange("manual")} className="bg-white border border-gray-200 text-gray-700 p-4 rounded-xl shadow-sm flex flex-col items-center justify-center gap-2 hover:bg-gray-50"><UserPlus size={24} className="text-blue-600"/><span className="font-bold text-sm">Add One</span></button><button onClick={() => onViewChange("hotlist")} className="bg-orange-50 border border-orange-200 text-orange-800 p-4 rounded-xl shadow-sm flex flex-col items-center justify-center gap-2 hover:bg-orange-100"><Flame size={24}/><span className="font-bold text-sm">Hot Vault</span></button></div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 text-center"><Upload className="mx-auto mb-2 text-gray-400"/><p className="text-sm text-gray-500 mb-4">Have a CSV file?</p><label className="bg-gray-100 text-gray-600 px-4 py-2 rounded-lg text-sm font-bold cursor-pointer hover:bg-gray-200 transition-colors">Upload CSV <input type="file" accept=".csv" onChange={onUpload} className="hidden"/></label></div>
          {queue.length > 0 && (<button onClick={() => onViewChange("stack")} className="w-full bg-green-600 text-white p-4 rounded-xl font-bold shadow-lg flex items-center justify-center gap-2 hover:bg-green-700"><Play size={20} fill="currentColor"/> Start Calling ({queue.length})</button>)}
          {status && <p className="text-center font-bold text-blue-600 animate-pulse">{status}</p>}
      </div>
    );
}

function CardStack({ queue, setQueue, template, library, onBack }) { 
    const [mode, setMode] = useState("card"); 
    const [actionType, setActionType] = useState("whatsapp");
    const [file, setFile] = useState(null); 
    const [polyglotMenu, setPolyglotMenu] = useState(false);
    const [currentMessage, setCurrentMessage] = useState("");
    const controls = useAnimation(); 
    
    const active = queue.length > 0 ? queue[0] : null;

    useEffect(() => {
        if(active) {
            controls.set({ x: 0, y: 0, opacity: 1 });
            let activeTemplate = template; 
            const matched = library.find(t => (active.context || "").toLowerCase().includes(t.name.toLowerCase())); 
            if(matched) activeTemplate = matched.text; 
            setCurrentMessage(activeTemplate.replace("{{name}}", active.name || "Customer").replace("{{context}}", active.context || "your update"));
        }
    }, [active, template, library]);

    if(!active) return (
        <div className="h-screen flex flex-col items-center justify-center p-6 text-center animate-in fade-in">
            <div className="text-6xl mb-6">🎉</div>
            <h2 className="text-2xl font-bold text-gray-800">All Caught Up!</h2>
            <button onClick={onBack} className="mt-8 bg-blue-600 text-white px-6 py-3 rounded-xl font-bold">Return to Menu</button>
        </div>
    ); 

    const handleAiRewrite = async (tone, lang) => {
        setPolyglotMenu(false);
        const res = await fetch(API_URL, { 
            method: 'POST', 
            body: JSON.stringify({ action: "AI_REWRITE_MSG", payload: { context: active.context, current_msg: currentMessage, tone, lang } }) 
        });
        const json = await res.json();
        if(json.data) setCurrentMessage(json.data);
    };

    const handlePrimaryAction = async () => {
        if (actionType === 'call') { 
            window.open(`tel:${active.phone}`, '_self'); setMode("disposition"); 
        } else {
            if (file && navigator.share) { 
                try { await navigator.share({ files: [file], title: 'Message', text: currentMessage }); setMode("disposition"); } catch (err) { console.log(err); } 
            } else { 
                window.open(`https://wa.me/${active.phone}?text=${encodeURIComponent(currentMessage)}`, '_blank'); setMode("disposition"); 
            }
        }
    };

    const submitOutcome = (tag) => { controls.start({ x: 500, opacity: 0 }).then(() => { controls.set({ x: 0, opacity: 1 }); fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: "MARK_SENT", payload: { lead_id: active.lead_id, outcome: tag } }) }); setQueue(q => q.slice(1)); setMode("card"); }); };
    
    const addToCalendar = (days) => { 
        const d = new Date(); d.setDate(d.getDate() + days); 
        const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent('Call '+(active.name||"Lead"))}&details=${encodeURIComponent(active.context||"")}&dates=${d.toISOString().replace(/-|:|\.\d\d\d/g,"")}/${d.toISOString().replace(/-|:|\.\d\d\d/g,"")}`;
        window.open(url, '_blank');
        controls.start({ y: 500, opacity: 0 }).then(() => { controls.set({ y: 0, opacity: 1 }); fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: "SNOOZE_LEAD", payload: { lead_id: active.lead_id, date: d.toISOString().split('T')[0] } }) }); setQueue(q => q.slice(1)); setMode("card"); });
    };

    if(mode === "disposition") return (
        <div className="h-screen flex flex-col items-center justify-center p-6 bg-slate-900 text-white animate-in fade-in"><h2 className="text-2xl font-bold mb-8">Outcome?</h2><div className="grid gap-4 w-full max-w-xs"><button onClick={() => submitOutcome("Hot")} className="bg-orange-500 p-4 rounded-xl font-bold flex gap-3 justify-center"><Flame/> Hot Lead</button><button onClick={() => submitOutcome("Interested")} className="bg-blue-600 p-4 rounded-xl font-bold flex gap-3 justify-center"><ThumbsUp/> Interested</button><button onClick={() => submitOutcome("No Answer")} className="bg-slate-700 p-4 rounded-xl font-bold flex gap-3 justify-center"><Snowflake/> No Answer / Cold</button></div></div>
    );
    
    if(mode === "snooze") return (
        <div className="h-screen flex flex-col items-center justify-center p-6 bg-purple-900 text-white animate-in fade-in"><h2 className="text-2xl font-bold mb-8">Snooze...</h2><div className="gap-4 grid w-full max-w-xs"><button onClick={() => addToCalendar(1)} className="bg-purple-600 p-4 rounded-xl font-bold">Tomorrow</button><button onClick={() => addToCalendar(3)} className="bg-purple-600 p-4 rounded-xl font-bold">3 Days</button><button onClick={() => addToCalendar(7)} className="bg-purple-600 p-4 rounded-xl font-bold">Next Week</button></div><button onClick={() => setMode("card")} className="mt-8 underline text-sm">Cancel</button></div>
    );

    return (
        <div className="h-screen flex flex-col items-center justify-center p-4 max-w-md mx-auto relative">
            <button onClick={onBack} className="absolute top-6 left-6 p-2 bg-gray-100 rounded-full text-gray-600 z-10"><ArrowLeft size={20}/></button>
            <div className="absolute top-6 right-6 z-10 bg-gray-100 p-1 rounded-lg flex"><button onClick={() => setActionType('whatsapp')} className={`p-2 rounded-md ${actionType === 'whatsapp' ? 'bg-white shadow text-green-600' : 'text-gray-400'}`}><Zap size={20}/></button><button onClick={() => setActionType('call')} className={`p-2 rounded-md ${actionType === 'call' ? 'bg-white shadow text-blue-600' : 'text-gray-400'}`}><Phone size={20}/></button></div>
            <motion.div animate={controls} className="bg-white w-full h-full max-h-[80vh] rounded-3xl shadow-2xl p-6 flex flex-col justify-between relative overflow-hidden mt-8">
                <div className="space-y-4 flex-1 flex flex-col min-h-0 relative">
                   {polyglotMenu && (<div className="absolute top-10 right-0 z-20 bg-white border shadow-xl rounded-xl p-2 w-48 animate-in fade-in"><button onClick={() => handleAiRewrite("Professional", "English")} className="w-full text-left p-2 hover:bg-gray-50 rounded text-sm font-bold">👔 Professional</button><button onClick={() => handleAiRewrite("Friendly", "English")} className="w-full text-left p-2 hover:bg-gray-50 rounded text-sm font-bold">👋 Friendly</button><button onClick={() => handleAiRewrite("Persuasive", "Hindi")} className="w-full text-left p-2 hover:bg-gray-50 rounded text-sm font-bold">🇮🇳 Hindi</button><button onClick={() => setPolyglotMenu(false)} className="w-full text-center text-xs text-red-400 mt-2">Close</button></div>)}
                   <div className="relative shrink-0"><input value={active.context} onChange={(e) => {const n=[...queue]; n[0].context=e.target.value; setQueue(n)}} className="bg-blue-50 text-blue-800 text-xs font-bold px-2 py-1 rounded w-full outline-none" /><button onClick={() => setPolyglotMenu(!polyglotMenu)} className="absolute right-0 top-0 p-1 text-purple-600"><Wand2 size={16}/></button></div>
                   <div className="shrink-0"><input value={active.name} onChange={(e) => {const n=[...queue]; n[0].name=e.target.value; setQueue(n)}} className="text-3xl font-bold text-gray-800 w-full outline-none" placeholder="Unknown Name" /><div className="text-gray-400 font-mono text-sm">+{active.phone}</div></div>
                   {actionType === 'whatsapp' ? (<textarea value={currentMessage} onChange={e => setCurrentMessage(e.target.value)} className="bg-gray-50 p-3 rounded-lg text-xs text-gray-600 flex-1 w-full outline-none resize-none h-32" />) : (<div className="bg-blue-50 p-3 rounded-lg text-xs text-blue-800 flex-1 flex items-center justify-center font-bold border border-blue-100">📞 Power Dialer Mode Active</div>)}
                   {actionType === 'whatsapp' && (<label className={`block border-2 border-dashed rounded-xl p-2 text-center cursor-pointer shrink-0 ${file ? 'border-green-500 bg-green-50' : 'border-gray-200'}`}><input type="file" accept="image/*,.pdf" onChange={(e)=>setFile(e.target.files[0])} className="hidden" /><div className="flex items-center justify-center gap-2 text-xs font-bold text-gray-500">{file ? "Attached" : "Attach Photo"}</div></label>)}
                </div>
                <div className="mt-4 space-y-2 shrink-0"><button onClick={handlePrimaryAction} className={`w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 text-white shadow-lg ${actionType === 'call' ? 'bg-blue-600' : 'bg-green-500'}`}>{actionType === 'call' ? <><Phone size={24}/> DIAL</> : <><Zap size={24}/> WhatsApp</>}</button><div className="flex gap-2"><button onClick={() => controls.start({ x: -500 }).then(() => {setQueue(q => q.slice(1)); setMode("card");})} className="flex-1 py-3 rounded-xl font-bold text-gray-500 bg-gray-50 flex items-center justify-center gap-2"><Trash2 size={18} /> Skip</button><button onClick={() => setMode("snooze")} className="px-4 py-3 rounded-xl font-bold text-purple-600 bg-purple-50 flex items-center justify-center"><Clock size={18} /></button></div></div>
            </motion.div>
        </div>
    ); 
}

function ManualForm({ onBack, onSubmit, status, prefill }) { 
    const [name, setName] = useState(prefill ? prefill.name : ""); 
    const [phone, setPhone] = useState(prefill ? prefill.phone : ""); 
    const [email, setEmail] = useState(prefill ? prefill.email : "");
    const [company, setCompany] = useState(prefill ? prefill.company : ""); 
    const [website, setWebsite] = useState(prefill ? prefill.website : ""); 
    const [context, setContext] = useState(prefill ? prefill.context : ""); 
    const [listening, setListening] = useState(false);

    useEffect(() => {
        if(prefill) {
            setName(prefill.name); setPhone(prefill.phone); 
            setEmail(prefill.email); setCompany(prefill.company); 
            setWebsite(prefill.website); setContext(prefill.context);
        }
    }, [prefill]);

    const toggleMic = () => {
        if (!('webkitSpeechRecognition' in window)) return alert("Voice not supported. Use Chrome.");
        const recognition = new window.webkitSpeechRecognition();
        recognition.continuous = false; recognition.lang = 'en-IN';
        recognition.onstart = () => setListening(true);
        recognition.onend = () => setListening(false);
        recognition.onresult = (event) => { const text = event.results[0][0].transcript; setContext(prev => prev + " " + text); };
        if(listening) recognition.stop(); else recognition.start();
    };

    const handleSubmit = () => { 
        if(!phone) return alert("Phone is required"); 
        
        let finalContext = context;
        if(company) finalContext = `[${company}] ` + finalContext;
        if(website) finalContext = finalContext + ` (${website})`;

        onSubmit({ 
            name: name || "Customer", 
            phone: "91" + phone.replace(/\D/g,'').slice(-10), 
            email: email || "",
            context: finalContext
        }); 
        
        setName(""); setPhone(""); setEmail(""); setContext(""); setCompany(""); setWebsite("");
    }; 
    
    return (
        <div className="p-6 max-w-md mx-auto h-screen bg-white overflow-y-auto">
            <button onClick={onBack} className="text-gray-400 mb-6 flex items-center gap-2"><ArrowLeft size={16}/> Back</button>
            <h1 className="text-2xl font-bold text-gray-800 mb-6">{prefill ? "Verify Scan" : "Add New Lead"}</h1>
            <div className="space-y-4">
                <input value={name} onChange={e=>setName(e.target.value)} className="w-full p-3 bg-gray-50 rounded-lg border" placeholder="Name" />
                <input type="tel" value={phone} onChange={e=>setPhone(e.target.value)} className="w-full p-3 bg-gray-50 rounded-lg border" placeholder="Phone" />
                <div className="flex flex-col gap-4">
                    <input value={company} onChange={e=>setCompany(e.target.value)} className="w-full p-3 bg-gray-50 rounded-lg border" placeholder="Company" />
                    <input value={website} onChange={e=>setWebsite(e.target.value)} className="w-full p-3 bg-gray-50 rounded-lg border" placeholder="Website" />
                </div>
                <input type="email" value={email} onChange={e=>setEmail(e.target.value)} className="w-full p-3 bg-gray-50 rounded-lg border" placeholder="Email (Optional)" />
                <div className="relative">
                    <textarea value={context} onChange={e=>setContext(e.target.value)} className="w-full p-3 bg-gray-50 rounded-lg border" placeholder="Notes / Context" />
                    <button onClick={toggleMic} className={`absolute right-2 bottom-2 p-2 rounded-full ${listening ? 'bg-red-500 text-white animate-pulse' : 'bg-gray-200 text-gray-600'}`}><Mic size={20}/></button>
                </div>
                <button onClick={handleSubmit} className="w-full bg-blue-600 text-white p-4 rounded-xl font-bold shadow-lg">Save to Queue</button>
                {status && <p className="text-center font-bold text-green-600">{status}</p>}
            </div>
        </div>
    ); 
}

function CameraScan({ onBack, onScanComplete }) {
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
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 800; const scaleSize = MAX_WIDTH / img.width;
                canvas.width = MAX_WIDTH; canvas.height = img.height * scaleSize;
                const ctx = canvas.getContext("2d"); ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                const dataUrl = canvas.toDataURL("image/jpeg", 0.7); const base64 = dataUrl.split(",")[1];
                
                fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: "AI_ANALYZE_IMAGE", payload: { image: base64 } }) })
                .then(r => r.json())
                .then(json => { 
                    setLoading(false);
                    if(json.data) {
                        onScanComplete(json.data); 
                    } else { alert("❌ AI couldn't read the card. Try again."); }
                })
                .catch(err => { setLoading(false); alert("Error: " + err.message); });
            };
            img.src = readerEvent.target.result;
        };
        reader.readAsDataURL(file);
    };

    return (
        <div className="h-screen bg-black flex flex-col items-center justify-center p-6 text-white text-center">
            {loading ? <div className="flex flex-col items-center animate-in fade-in"><div className="animate-spin rounded-full h-16 w-16 border-b-4 border-orange-500 mb-6"></div><h2 className="text-xl font-bold">Analysing Card...</h2></div> : (
                <>
                    <Camera size={64} className="mb-6 text-orange-500"/>
                    <h2 className="text-2xl font-bold mb-2">Scan Business Card</h2>
                    <p className="text-gray-400 mb-8">Take a photo. AI will pre-fill the form.</p>
                    <button onClick={() => fileInputRef.current.click()} className="w-full py-4 bg-orange-600 rounded-xl font-bold text-lg mb-4">Open Camera</button>
                    <button onClick={onBack} className="text-gray-400 font-bold">Cancel</button>
                    <input type="file" ref={fileInputRef} accept="image/*" capture="environment" onChange={handleFile} className="hidden" />
                </>
            )}
        </div>
    );
}

function BulkPasteForm({ onBack, onSubmit }) { 
    const [text, setText] = useState(""); 
    const [parsed, setParsed] = useState([]); 
    const [loading, setLoading] = useState(false); 
    const handleSmartScan = async () => { if(!text) return; setLoading(true); try { const res = await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: "AI_PARSE_TEXT", payload: { text } }) }); const json = await res.json(); if(json.data) { setParsed(json.data); alert(`✅ AI Found ${json.data.length} Leads!`); } } catch(e) { alert("AI Error: " + e.message); } setLoading(false); };
    const handleSave = async () => { await onSubmit(parsed); }; 
    if(parsed.length > 0) return (<div className="h-screen bg-white flex flex-col p-4"><div className="flex justify-between mb-4 items-center"><h2 className="font-bold">Found {parsed.length}</h2><button onClick={handleSave} className="bg-green-600 text-white px-4 py-2 rounded-lg font-bold shadow">Save All</button></div><div className="flex-1 overflow-y-auto space-y-2">{parsed.map((l, i) => (<div key={i} className="p-3 border rounded-xl bg-gray-50"><div className="font-bold">{l.name}</div><div className="text-xs text-gray-500">{l.phone} • {l.email}</div><div className="text-xs text-blue-600 italic">{l.context}</div></div>))}</div></div>);
    return (<div className="p-6 max-w-md mx-auto h-screen bg-white flex flex-col"><button onClick={onBack} className="text-gray-400 mb-4 flex items-center gap-2"><ArrowLeft size={16}/> Back</button><h1 className="text-2xl font-black text-gray-800 mb-2">AI Smart Scan 🧠</h1><p className="text-sm text-gray-500 mb-4">Paste messy text.</p><textarea value={text} onChange={e => setText(e.target.value)} placeholder="e.g. Rahul 988822222 from Acme Corp..." className="flex-1 w-full p-4 bg-gray-50 rounded-xl border outline-none font-mono text-sm mb-4"/><button onClick={handleSmartScan} disabled={!text || loading} className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white p-4 rounded-xl font-bold text-lg shadow-lg flex items-center justify-center gap-2">{loading ? "AI is Thinking..." : "Extract Leads"}</button></div>); 
}

function SettingsForm({ currentTemplate, library, onSaveActive, onAddToLib, onRemoveFromLib, onBack, userProfile, clientId }) { const [temp, setTemp] = useState(currentTemplate); const [saveName, setSaveName] = useState(""); const [title, setTitle] = useState(userProfile?.title || ""); const [photo, setPhoto] = useState(userProfile?.photo || ""); const [website, setWebsite] = useState(userProfile?.website || ""); const saveProfile = () => { fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: "UPDATE_PROFILE", payload: { client_id: clientId, title, photo, website } }) }); alert("Profile Updated!"); }; return (<div className="p-6 max-w-md mx-auto h-screen bg-white overflow-y-auto"><button onClick={onBack} className="text-gray-400 mb-6 flex items-center gap-2"><ArrowLeft size={16}/> Back</button><h1 className="text-2xl font-bold text-gray-800 mb-6">Settings</h1><div className="mb-8 p-4 bg-gray-50 rounded-xl border border-gray-100"><h2 className="font-bold text-sm mb-4 flex items-center gap-2"><ShieldCheck size={16} className="text-blue-600"/> Pro Profile Identity</h2><div className="space-y-3"><input value={title} onChange={e=>setTitle(e.target.value)} className="w-full p-2 text-sm border rounded" placeholder="Job Title" /><input value={photo} onChange={e=>setPhoto(e.target.value)} className="w-full p-2 text-sm border rounded" placeholder="Photo URL" /><input value={website} onChange={e=>setWebsite(e.target.value)} className="w-full p-2 text-sm border rounded" placeholder="Website Link" /><button onClick={saveProfile} className="w-full py-2 bg-blue-600 text-white rounded font-bold text-xs">Save Profile</button></div></div><h2 className="font-bold text-sm mb-2">Message Template</h2><textarea value={temp} onChange={e => setTemp(e.target.value)} className="w-full h-24 p-4 bg-gray-50 rounded-xl border outline-none mb-4" /><button onClick={() => onSaveActive(temp)} className="w-full bg-gray-800 text-white p-3 rounded-xl font-bold mb-8">Set Active</button><div className="flex gap-2 mb-4"><input value={saveName} onChange={e => setSaveName(e.target.value)} placeholder="New Template Name" className="flex-1 p-2 rounded-lg border outline-none"/><button onClick={() => { if(saveName) { onAddToLib(saveName, temp); setSaveName(""); }}} className="bg-purple-600 text-white p-2 rounded-lg font-bold"><Plus size={20}/></button></div><div className="space-y-3 pb-24">{library.map(t => (<div key={t.id} className="p-3 border rounded-xl flex items-center justify-between"><div onClick={() => setTemp(t.text)} className="cursor-pointer flex-1"><div className="font-bold">{t.name}</div><div className="text-xs text-gray-400 truncate w-48">{t.text}</div></div><button onClick={() => onRemoveFromLib(t.id)} className="text-red-300"><X size={16}/></button></div>))}</div></div>); }

function DigitalCard({ profileId }) { const [profile, setProfile] = useState(null); const [loading, setLoading] = useState(true); useEffect(() => { fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: "GET_CLIENT_PROFILE", payload: { client_id: profileId } }) }).then(res => res.json()).then(json => { if(json.status === 'success') setProfile(json.data); setLoading(false); }); }, [profileId]); const saveContact = () => { const vcard = `BEGIN:VCARD\nVERSION:3.0\nFN:${profile.name}\nTEL;TYPE=CELL:${profile.phone}\nEND:VCARD`; const blob = new Blob([vcard], { type: "text/vcard" }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${profile.name}.vcf`; a.click(); }; if (loading) return <div className="h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div>; if (!profile) return <div className="h-screen flex items-center justify-center text-gray-500">Profile Not Found</div>; return (<div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 font-sans"><div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden border border-gray-100 animate-in fade-in"><div className="h-32 bg-gradient-to-r from-blue-600 to-purple-600 relative"><div className="absolute -bottom-12 left-0 right-0 flex justify-center"><div className="w-24 h-24 bg-white rounded-full p-1 shadow-lg overflow-hidden">{profile.photo ? <img src={profile.photo} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-gray-200 flex items-center justify-center text-gray-500 font-bold text-2xl">{profile.name.charAt(0)}</div>}</div></div></div><div className="pt-16 pb-8 px-8 text-center"><h1 className="text-2xl font-black text-gray-900">{profile.name}</h1><p className="text-blue-600 font-bold text-xs uppercase tracking-wide mb-1">{profile.title || "Sales Professional"}</p><p className="text-gray-500 font-medium mb-6">+{profile.phone}</p><div className="space-y-3"><button onClick={saveContact} className="w-full py-4 bg-gray-900 text-white rounded-xl font-bold shadow-lg flex items-center justify-center gap-2 hover:bg-black active:scale-95 transition-transform"><UserCheck size={20} /> Save Contact</button><div className="grid grid-cols-2 gap-3"><button onClick={() => window.open(`https://wa.me/${profile.phone}`, '_blank')} className="py-4 bg-green-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-green-600"><Zap size={20} /> WhatsApp</button><button onClick={() => window.open(`tel:${profile.phone}`, '_self')} className="py-4 bg-blue-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-blue-700"><Phone size={20} /> Call</button></div>{profile.website && (<button onClick={() => window.open(profile.website, '_blank')} className="w-full py-3 bg-gray-100 text-gray-700 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-gray-200"><LinkIcon size={18} /> Visit Website</button>)}</div></div><div className="bg-gray-50 p-4 text-center border-t border-gray-100 cursor-pointer" onClick={() => window.open(window.location.origin, '_blank')}><p className="text-xs text-gray-400 font-bold uppercase tracking-widest flex items-center justify-center gap-1"><Zap size={12} className="text-orange-500"/> Powered by Thrivoy</p></div></div></div>); }

function HotList({ clientId, onBack }) { const [leads, setLeads] = useState([]); const [loading, setLoading] = useState(true); useEffect(() => { fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: "GET_HOTLIST", payload: { client_id: clientId } }) }).then(res => res.json()).then(json => { setLeads(json.data || []); setLoading(false); }); }, []); const requeue = (id) => { setLeads(leads.filter(l => l.lead_id !== id)); fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: "REQUEUE_LEAD", payload: { lead_id: id } }) }); alert("Lead moved back to Stack!"); }; return (<div className="p-4 max-w-md mx-auto h-screen bg-white flex flex-col"><div className="flex items-center justify-between mb-6"><button onClick={onBack} className="text-gray-400 flex items-center gap-1"><ArrowLeft size={16}/> Back</button><span className="font-bold text-orange-600 flex items-center gap-2"><Flame size={18} fill="currentColor"/> Vault</span></div>{loading ? <div className="text-center p-8 text-gray-400">Loading...</div> : (<div className="flex-1 overflow-y-auto space-y-3">{leads.length === 0 ? <div className="text-center p-8 text-gray-400">No Hot Leads.</div> : leads.map(l => (<div key={l.lead_id} className="p-4 rounded-xl border border-orange-100 bg-orange-50"><div className="flex justify-between"><div><h3 className="font-bold">{l.name}</h3><p className="text-xs">{l.phone}</p></div><span className="bg-orange-200 text-orange-800 text-[10px] px-2 rounded-full uppercase">{l.outcome}</span></div><button onClick={() => requeue(l.lead_id)} className="w-full mt-2 bg-orange-600 text-white py-2 rounded text-xs font-bold">Follow Up</button></div>))}</div>)}</div>); }

function AdminDashboard() { const [name, setName] = useState(""); const [phone, setPhone] = useState(""); const [result, setResult] = useState(null); const [loading, setLoading] = useState(false); const createClient = async () => { if(!name || !phone) return alert("Enter Name and Phone"); setLoading(true); const cleanPhone = "91" + phone.replace(/\D/g,'').slice(-10); try { const res = await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: "ADD_CLIENT", payload: { name, phone: cleanPhone } }) }); const json = await res.json(); setResult({ ...json.data, phone: cleanPhone }); setName(""); setPhone(""); } catch(e) { alert("Error: " + e.message); } setLoading(false); }; const whatsAppLink = result ? `https://wa.me/${result.phone}?text=${encodeURIComponent(`Welcome to Thrivoy! 🚀\n\nHere is your access link:\n${result.magic_link}`)}` : "#"; return (<div className="min-h-screen bg-slate-900 text-white p-6 font-sans flex flex-col items-center justify-center"><div className="w-full max-w-md"><h1 className="text-3xl font-black mb-8 text-center text-orange-500">👑 Admin Console</h1>{!result ? (<div className="bg-slate-800 p-8 rounded-2xl shadow-2xl border border-slate-700 space-y-6"><h2 className="text-xl font-bold text-slate-300">New User Setup</h2><input value={name} onChange={e=>setName(e.target.value)} className="w-full bg-slate-900 p-4 rounded-xl text-white outline-none border border-slate-700" placeholder="e.g. Rahul Sharma" /><input type="tel" value={phone} onChange={e=>setPhone(e.target.value)} className="w-full bg-slate-900 p-4 rounded-xl text-white outline-none border border-slate-700" placeholder="e.g. 9876543210" /><button onClick={createClient} disabled={loading} className="w-full bg-orange-600 hover:bg-orange-500 text-white py-4 rounded-xl font-bold text-lg shadow-lg">{loading ? "Generating..." : "Create Account 🚀"}</button></div>) : (<div className="bg-green-900/20 p-8 rounded-2xl text-center space-y-6 border border-green-500/50 shadow-2xl"><div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto shadow-lg"><CheckSquare size={32} className="text-white" /></div><h2 className="text-2xl font-bold text-green-400">Account Created!</h2><div className="bg-black/50 p-4 rounded-xl text-left"><p className="text-xs text-green-500 font-bold uppercase mb-1">Magic Link</p><div className="text-xs font-mono text-gray-300 break-all">{result.magic_link}</div></div><a href={whatsAppLink} target="_blank" rel="noopener noreferrer" className="block w-full bg-green-500 hover:bg-green-400 text-white py-4 rounded-xl font-bold shadow-lg flex items-center justify-center gap-2 text-decoration-none"><Zap size={24} fill="currentColor" /> Send via WhatsApp</a><button onClick={() => setResult(null)} className="text-slate-400 text-sm font-bold underline">Create Another User</button></div>)}</div></div>); }

function QueueList({ queue, setQueue, library, onBack, onLaunchStack }) { const [selected, setSelected] = useState([]); const [bulkContext, setBulkContext] = useState(""); const toggleSelect = (id) => { if (selected.includes(id)) setSelected(selected.filter(i => i !== id)); else setSelected([...selected, id]); }; const toggleAll = () => { if (selected.length === queue.length) setSelected([]); else setSelected(queue.map(q => q.lead_id)); }; const deleteSelected = async () => { if(!confirm(`Archive ${selected.length} leads?`)) return; const newQueue = queue.filter(q => !selected.includes(q.lead_id)); setQueue(newQueue); selected.forEach(id => fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: "MARK_SENT", payload: { lead_id: id, outcome: "Archived" } }) })); setSelected([]); }; const launchCampaign = () => { if(selected.length === 0) return alert("Select at least one!"); const campaignQueue = queue.filter(q => selected.includes(q.lead_id)).map(q => ({ ...q, context: bulkContext || q.context })); setQueue(campaignQueue); onLaunchStack(); }; return (<div className="p-4 max-w-md mx-auto h-screen bg-white flex flex-col"><div className="flex items-center justify-between mb-4"><button onClick={onBack} className="text-gray-400 flex items-center gap-1"><ArrowLeft size={16}/> Back</button><span className="font-bold text-gray-800">{selected.length} Selected</span></div><div className="bg-blue-50 p-4 rounded-xl mb-4 space-y-3 border border-blue-100"><div className="flex gap-2 items-center"><input value={bulkContext} onChange={e => setBulkContext(e.target.value)} placeholder="Context (e.g. Offer)" className="flex-1 p-2 text-sm rounded border outline-none font-bold text-blue-900"/><button onClick={()=>alert("Use context to update many leads at once.")} className="p-2 bg-white rounded border text-blue-600"><Wand2 size={18}/></button></div><div className="flex gap-2"><button onClick={toggleAll} className="flex-1 bg-white border border-blue-200 text-blue-600 py-2 rounded-lg text-xs font-bold">{selected.length === queue.length ? "Deselect All" : "Select All"}</button>{selected.length > 0 && (<button onClick={deleteSelected} className="px-4 bg-red-50 text-red-600 rounded-lg text-xs font-bold flex items-center gap-2 border border-red-100"><UserMinus size={16} /> Archive</button>)}</div><button onClick={launchCampaign} disabled={selected.length === 0} className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"><Play size={18} fill="currentColor" /> Start Campaign</button></div><div className="flex-1 overflow-y-auto space-y-2">{queue.map(lead => (<div key={lead.lead_id} onClick={() => toggleSelect(lead.lead_id)} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${selected.includes(lead.lead_id) ? 'bg-blue-50 border-blue-500' : 'bg-white border-gray-100'}`}><div className={`text-blue-500 ${selected.includes(lead.lead_id) ? 'opacity-100' : 'opacity-20'}`}>{selected.includes(lead.lead_id) ? <CheckSquare size={20} /> : <Square size={20} />}</div><div><h3 className="font-bold text-gray-800 text-sm">{lead.name}</h3><p className="text-xs text-gray-500">+{lead.phone} {lead.email && "• 📧"}</p></div></div>))}</div></div>); }

function HelpScreen({ onBack }) { return (<div className="p-6 max-w-md mx-auto h-screen bg-white flex flex-col overflow-y-auto"><button onClick={onBack} className="text-gray-400 mb-4 flex items-center gap-2"><ArrowLeft size={16}/> Back</button><h1 className="text-3xl font-black text-gray-800 mb-6">User Guide</h1><div className="space-y-6"><p><strong>1. Scan:</strong> Use 'Paste Page' or 'Camera' to import data.</p><p><strong>2. Stack:</strong> Use the Toggle (⚡/📞) to switch between WhatsApp and Calling mode.</p><p><strong>3. Vault:</strong> Leads tagged as 'Hot' appear in the 'My Hot Leads' section.</p><p><strong>4. Digital Card:</strong> Click the share icon on the menu to send your link.</p><p><strong>5. AI:</strong> Use the Wand to rewrite text or the Camera to scan cards.</p></div></div>); }

function LandingPage() { return (<div className="min-h-screen bg-white flex flex-col font-sans text-gray-900"><div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-8 max-w-4xl mx-auto pt-20"><div className="w-20 h-20 bg-orange-100 rounded-3xl flex items-center justify-center mb-4 shadow-sm animate-bounce"><Zap size={40} className="text-orange-600" /></div><h1 className="text-5xl md:text-7xl font-black text-gray-900 leading-tight tracking-tight">Notebooks to <span className="text-orange-600">Revenue</span>.</h1><p className="text-xl text-gray-500 leading-relaxed max-w-2xl mx-auto">The #1 Sales Tool for India. Scan leads, attach photos, and switch to <strong>Power Dialer</strong> mode for instant cold calling.</p><div className="flex flex-col sm:flex-row gap-4 w-full justify-center"><button onClick={() => window.open(`https://wa.me/917892159170?text=I%20want%20Revive%20access`, '_blank')} className="px-8 py-4 bg-orange-600 text-white rounded-xl font-bold text-lg shadow-xl hover:bg-orange-700 hover:scale-105 transition-all">Get Free Access 🇮🇳</button><button onClick={() => document.getElementById('features').scrollIntoView({ behavior: 'smooth' })} className="px-8 py-4 bg-gray-100 text-gray-700 rounded-xl font-bold text-lg hover:bg-gray-200">See Features</button></div></div><div id="features" className="py-20 px-6 bg-gray-50"><div className="max-w-5xl mx-auto"><h2 className="text-3xl font-black text-center text-gray-900 mb-12">The Complete Sales Stack</h2><div className="grid md:grid-cols-3 gap-8"><FeatureCard icon={<ScanLine />} title="Scan & Extract" text="Digitise handwritten notebooks or cards instantly with AI extraction." /><FeatureCard icon={<Phone />} title="Power Dialer" text="Switch to Call Mode. Dial 50 leads in 30 mins without typing a digit." /><FeatureCard icon={<ClipboardPaste />} title="Attach Media" text="Send brochures, price lists, or property photos via WhatsApp." /></div></div></div><div className="py-20 px-6 bg-white border-t border-gray-100"><div className="max-w-5xl mx-auto"><h2 className="text-3xl font-black text-center text-gray-900 mb-12">Who uses Thrivoy?</h2><div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6"><UseCaseCard icon={<Flame/>} title="Real Estate" text="Send property photos & brochures to 50 leads in minutes." /><UseCaseCard icon={<Phone/>} title="Used Cars" text="Walkaround videos & car details sent instantly after a call." /><UseCaseCard icon={<ShieldCheck/>} title="Insurance" text="Scan handwritten leads & send policy PDFs effortlessly." /><UseCaseCard icon={<Zap/>} title="Gym Owners" text="Send membership price cards to old inquiries." /></div></div></div><div id="pricing" className="py-20 px-6 bg-white"><div className="max-w-5xl mx-auto"><h2 className="text-4xl font-black text-center text-gray-900 mb-4">Pricing for India 🇮🇳</h2><p className="text-center text-gray-500 mb-12 text-lg">Invest in your sales speed.</p><div className="grid md:grid-cols-3 gap-8"><PricingCard title="Starter" price="₹0" btn="Try Free" features={["100 Leads", "Basic Scan", "Text Only"]} /><PricingCard title="Pro Hustler" price="₹999" highlight btn="Get Pro" features={["Unlimited Leads", "Power Dialer Mode", "Send Photos/PDFs", "Calendar Sync"]} /><PricingCard title="Corporate" price="Custom" btn="Contact Sales" features={["Private Data", "Team Admin", "GST Invoice"]} /></div></div></div><div className="py-20 px-6 bg-gray-50"><div className="max-w-3xl mx-auto"><h2 className="text-3xl font-black text-center text-gray-900 mb-12">Frequently Asked Questions</h2><div className="space-y-4"><FAQItem q="Is the data safe?" a="Yes. Your data is stored in your own Google Sheet. We do not sell or see your client data." /><FAQItem q="Does it work on iPhone?" a="Yes. Thrivoy works on any phone browser (Chrome/Safari). No app store download needed." /><FAQItem q="Can I add team members?" a="Currently, Thrivoy is for solo hustlers. Team features are coming in the Corporate plan." /></div></div></div><div className="p-6 bg-gray-900 text-center text-gray-500 text-sm"><p>&copy; 2025 Thrivoy Inc. Made for India 🇮🇳</p></div></div>); }

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

function FAQItem({ q, a }) {
    const [open, setOpen] = useState(false);
    return (
        <div onClick={() => setOpen(!open)} className="cursor-pointer border-b border-gray-200 pb-4 bg-white p-4 rounded-xl hover:bg-gray-50 transition-colors">
            <div className="flex justify-between items-center">
                <h3 className="font-bold text-gray-800 text-sm">{q}</h3>
                {open ? <ChevronUp size={16} className="text-gray-400"/> : <ChevronDown size={16} className="text-gray-400"/>}
            </div>
            {open && <p className="text-sm text-gray-500 mt-2 leading-relaxed animate-in fade-in slide-in-from-top-2">{a}</p>}
        </div>
    );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);