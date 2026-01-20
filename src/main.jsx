import './index.css';
import React, { useState, useEffect, useRef, useMemo, useCallback, Component } from 'react';
import { createRoot } from 'react-dom/client';
import * as ReactWindowPkg from 'react-window';
import * as AutoSizerPkg from 'react-virtualized-auto-sizer';
import { motion, AnimatePresence, useAnimation } from 'framer-motion';
import Papa from 'papaparse';
import { 
  Phone, Upload, UserPlus, ArrowLeft, Trash2, Zap, ScanLine, Settings, List as ListIcon, 
  Plus, X, Wand2, Play, Flame, ThumbsUp, Snowflake, Camera, Mic, LogOut, Share2, Users, 
  RefreshCw, ChevronRight, Lock, Briefcase, HelpCircle, LayoutDashboard, BarChart3, 
  CheckCircle2, WifiOff, UserCheck, Mail, Globe, Building2, CheckSquare, Tag, Send, 
  Facebook, Linkedin, Instagram, KeyRound, Copy, DollarSign, AlertTriangle, CreditCard, 
  Sparkles, TrendingUp, Download, Pause 
} from 'lucide-react';

const FixedSizeList = ReactWindowPkg.FixedSizeList ?? ReactWindowPkg.default?.FixedSizeList;
const AutoSizer = AutoSizerPkg.default ?? AutoSizerPkg.AutoSizer;

const requestCache = new Map();
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of requestCache.entries()) {
    if (now - val.timestamp > 300000) requestCache.delete(key);
  }
}, 60000);

function sanitizeValue(val, type = 'string') {
  if (val === null || val === undefined) return '';
  if (type === 'string') {
    if (typeof val === 'object' && !Array.isArray(val)) {
      if (type === 'string') {
        try {
          if (val.value !== undefined) return String(val.value);
          if (val.text !== undefined) return String(val.text);
          if (val.name !== undefined) return String(val.name);
          return JSON.stringify(val);
        } catch {
          return Object.prototype.toString.call(val);
        }
      }
    }
    if (Array.isArray(val) && type === 'string') return val.join(', ');
    try { return String(val); } catch { return ''; }
  }
  if (type === 'number') return Number(val) || 0;
  if (type === 'array') return Array.isArray(val) ? val : [];
  return val;
}

function sanitizeLead(lead) {
  if (!lead || typeof lead !== 'object') {
    return {
      lead_id: 'invalid-' + Date.now(),
      name: 'Invalid Lead',
      phone: '',
      email: '',
      company: '',
      website: '',
      designation: '',
      context: '',
      tags: '',
      status: 'PENDING',
      outcome: ''
    };
  }
  
  // ✅ FIX: Handle both lead_id and leadid during transition
  const leadId = lead.lead_id || lead.leadid || 'unknown-' + Date.now();
  
  return {
    lead_id: leadId,  // ✅ Always output lead_id (underscore)
    name: sanitizeValue(lead.name, 'string') || 'Unknown',
    phone: sanitizeValue(lead.phone, 'string'),
    email: sanitizeValue(lead.email, 'string'),
    company: sanitizeValue(lead.company, 'string'),
    website: sanitizeValue(lead.website, 'string'),
    designation: sanitizeValue(lead.designation, 'string'),
    context: sanitizeValue(lead.context, 'string'),
    tags: sanitizeValue(lead.tags, 'string'),
    status: sanitizeValue(lead.status, 'string') || 'PENDING',
    outcome: sanitizeValue(lead.outcome, 'string')
  };
}

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-screen flex flex-col items-center justify-center p-6 text-center bg-gray-50">
          <div className="bg-red-100 p-4 rounded-full text-red-600 mb-4">
            <WifiOff size={32} />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Engine Stalled</h1>
          <p className="text-sm text-gray-500 mb-6 max-w-xs mx-auto">
            Something went wrong. Don't worry, your data is safe in the cloud.
          </p>
          <button 
            onClick={() => window.location.reload()}
            className="bg-gray-900 text-white px-6 py-3 rounded-xl font-bold shadow-lg"
          >
            Restart Engine
          </button>
          <p className="mt-4 text-xs text-gray-400 font-mono">
            {this.state.error?.message}
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}

const API_URL = 'https://script.google.com/macros/s/AKfycbxOngDPlaePVboF3MQPZV76Wm_ap4684yJuRrOvptq5cLiURTTx6S_jD_IZ_LBCDIgQPg/exec';
const ADMIN_KEY = 'master';
const LEAD_LIMIT = 100;
const CACHE_TTL_MS = 300000; // 5 minutes
const PIN_MAX_LENGTH = 4;
const RATE_LIMIT_DELAY_MS = 60000; // 1 minute
const MAX_PIN_ATTEMPTS = 5;

const safeStorage = {
  getItem: (k) => {
    try { return localStorage.getItem(k); } catch { return null; }
  },
  setItem: (k, v) => {
    try { localStorage.setItem(k, v); } catch { }
  },
  removeItem: (k) => {
    try { localStorage.removeItem(k); } catch { }
  }
};

const vibrate = (ms = 50) => {
  if (navigator.vibrate) navigator.vibrate(ms);
};
const ValidationUtils = {
  email: (email) => {
    if (!email) return true;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  },
  phone: (phone) => {
    const cleaned = String(phone).replace(/\D/g, '');
    return cleaned.length >= 10 && cleaned.length <= 13;
  },
  pin: (pin) => {
    return /^\d{4}$/.test(String(pin));
  },
  aiCardData: (data) => {
    if (!data.phone || !ValidationUtils.phone(data.phone)) {
      return { valid: false, error: 'Invalid or missing phone number' };
    }
    if (!data.name || String(data.name).length < 2) {
      return { valid: false, error: 'Invalid or missing name' };
    }
    
    const phoneDigits = String(data.phone).replace(/[^\d]/g, '');
    if (/(.)\1{5}/.test(phoneDigits)) {
      return { valid: false, error: 'Phone number appears invalid (repeated digits)' };
    }
    
    const lowercaseName = String(data.name).toLowerCase();
    const placeholders = ['john doe', 'jane doe', 'sample', 'example', 'test', 'card holder', 'name', 'customer'];
    if (placeholders.some(p => lowercaseName.includes(p))) {
      return { valid: false, warning: 'Name appears generic - please verify' };
    }
    
    return { valid: true };
  }
};

const pendingRequests = new Map();

async function signedRequest(action, payload) {
  const cacheKey = JSON.stringify({ action, payload });
  if (pendingRequests.has(cacheKey)) return pendingRequests.get(cacheKey);
  
  if (requestCache.has(cacheKey) && !action.includes('MARK') && !action.includes('ADD') && !action.includes('UPDATE')) {
    const cached = requestCache.get(cacheKey);
    if (Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return Promise.resolve(new Response(JSON.stringify(cached.data)));
    }
  }

  const timestamp = Date.now();
  const clientId = payload.client_id || payload.clientid;
  
  let signature = '';
  if (action !== 'ADD_CLIENT' && action !== 'GET_CLIENT_BY_SLUG' && action !== 'VERIFY_PIN' && 
      action !== 'ADD_LEADS' && action !== 'GET_REFERRAL_STATS') {
    const secret = safeStorage.getItem(`thrivoy_secret_${clientId}`);
    if (secret && window.crypto?.subtle) {
      try {
        const enc = new TextEncoder();
        const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
        const sig = await crypto.subtle.sign('HMAC', key, enc.encode(`${clientId}:${timestamp}`));
        signature = btoa(String.fromCharCode(...new Uint8Array(sig)));
      } catch (e) {
        if (e.message.includes('Rate Limit')) {
          alert('⏳ Too many requests. Please wait 1 minute and try again.');
        } else if (e.message.includes('Network')) {
          alert('📡 Connection error. Check your internet and try again.');
        } else {
          alert('❌ Something went wrong: ' + e.message);
        }
      }
    }
  }

  const requestPromise = fetch(API_URL, {
    method: 'POST',
    body: JSON.stringify({ action, payload, timestamp, signature })
  }).then(async response => {
    const data = await response.json();
    if (data.status === 'success' && action.startsWith('GET')) {
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

function exportToCSV(data, filename) {
  const headers = ['Name', 'Phone', 'Email', 'Company', 'Designation', 'Website', 'Context', 'Tags', 'Status'];
  const rows = data.map(d => [
    d.name,
    d.phone,
    d.email,
    d.company,
    d.designation,
    d.website,
    d.context,
    d.tags,
    d.status || 'PENDING'
  ]);
  
  const csvContent = [headers.join(','), ...rows.map(row => 
    row.map(cell => String(cell).replace(/"/g, '""')).join(',')
  )].join('\n');
  
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}-${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
}

function LoadingOverlay({ message = 'Processing...' }) {
  return (
    <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center">
      <div className="bg-white rounded-2xl p-6 flex flex-col items-center gap-4 shadow-2xl">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent" />
        <p className="font-bold text-gray-900">{message}</p>
      </div>
    </div>
  );
}

function ConfirmDialog({ 
  isOpen, 
  title, 
  message, 
  onConfirm, 
  onCancel, 
  confirmText = 'Confirm', 
  cancelText = 'Cancel', 
  confirmColor = 'blue' 
}) {
  if (!isOpen) return null;
  
  const colorClasses = {
    blue: 'bg-blue-600 hover:bg-blue-700',
    red: 'bg-red-600 hover:bg-red-700',
    green: 'bg-green-600 hover:bg-green-700'
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-6">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl"
      >
        <h3 className="text-xl font-bold mb-2 text-gray-900">{title}</h3>
        <p className="text-gray-600 mb-6">{message}</p>
        <div className="flex gap-3">
          <button 
            onClick={onCancel}
            className="flex-1 py-3 rounded-xl border-2 border-gray-200 font-bold text-gray-700 hover:bg-gray-50 transition-colors"
          >
            {cancelText}
          </button>
          <button 
            onClick={onConfirm}
            className={`flex-1 py-3 rounded-xl font-bold text-white transition-colors shadow-lg ${colorClasses[confirmColor]}`}
          >
            {confirmText}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function EditLeadModal({ lead, onSave, onClose }) {
  const [form, setForm] = useState(() => sanitizeLead(lead));
  const [errors, setErrors] = useState({});

  const handleSave = () => {
    const newErrors = {};
    if (!form.name || !form.name.trim()) newErrors.name = 'Name is required';
    if (!ValidationUtils.phone(form.phone)) newErrors.phone = 'Invalid phone number';
    if (form.email && !ValidationUtils.email(form.email)) newErrors.email = 'Invalid email';
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    
    onSave(form);
  };

  return (
    <div className="absolute inset-0 bg-black/50 z-50 flex items-center justify-center p-6">
      <div className="bg-white p-6 rounded-2xl w-full max-w-md max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-lg">Edit Lead</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full">
            <X size={20} />
          </button>
        </div>
        
        <div className="space-y-3">
          <div>
            <input
              value={form.name}
              onChange={(e) => {
                setForm({ ...form, name: e.target.value });
                setErrors(prev => ({ ...prev, name: null }));
              }}
              placeholder="Name"
              className={`w-full p-3 border rounded-xl outline-none focus:border-blue-500 ${errors.name ? 'border-red-500 bg-red-50' : ''}`}
            />
            {errors.name && <p className="text-red-600 text-xs mt-1">{errors.name}</p>}
          </div>
          
          <div>
            <input
              value={form.phone}
              onChange={(e) => {
                setForm({ ...form, phone: e.target.value });
                setErrors(prev => ({ ...prev, phone: null }));
              }}
              placeholder="Phone"
              type="tel"
              className={`w-full p-3 border rounded-xl outline-none focus:border-blue-500 ${errors.phone ? 'border-red-500 bg-red-50' : ''}`}
            />
            {errors.phone && <p className="text-red-600 text-xs mt-1">{errors.phone}</p>}
          </div>
          
          <div>
            <input
              value={form.email}
              onChange={(e) => {
                setForm({ ...form, email: e.target.value });
                setErrors(prev => ({ ...prev, email: null }));
              }}
              placeholder="Email"
              type="email"
              className={`w-full p-3 border rounded-xl outline-none focus:border-blue-500 ${errors.email ? 'border-red-500 bg-red-50' : ''}`}
            />
            {errors.email && <p className="text-red-600 text-xs mt-1">{errors.email}</p>}
          </div>
          
          <input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} placeholder="Company" className="w-full p-3 border rounded-xl outline-none focus:border-blue-500" />
          <input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} placeholder="Website" className="w-full p-3 border rounded-xl outline-none focus:border-blue-500" />
          <input value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} placeholder="Designation" className="w-full p-3 border rounded-xl outline-none focus:border-blue-500" />
          <textarea 
            value={form.context} 
            onChange={(e) => setForm({ ...form, context: e.target.value })}
            placeholder="Notes / Context"
            className="w-full p-3 border rounded-xl outline-none focus:border-blue-500 min-h-[80px] resize-none"
          />
        </div>
        
        <div className="flex gap-2 mt-6">
          <button onClick={onClose} className="flex-1 py-3 font-bold text-gray-500 border rounded-xl">Cancel</button>
          <button onClick={handleSave} className="flex-1 bg-blue-600 text-white rounded-xl font-bold py-3">Save Changes</button>
        </div>
      </div>
    </div>
  );
}

function AnalyticsScreen({ clientId, queue, onBack }) {
  const [stats, setStats] = useState({ total: 0, sent: 0, pending: 0, hot: 0, interested: 0, noAnswer: 0, conversionRate: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const calculateStats = async () => {
      setLoading(true);
      try {
        // ✅ Fetch ALL leads from backend for accurate analytics
        const res = await signedRequest("GET_QUEUE", { client_id: clientId });
        const json = await res.json();
        
        const allLeads = json.data?.allLeads || json.data?.queue || [];
        const safeLeads = Array.isArray(allLeads) ? allLeads.map(sanitizeLead) : [];
        
        console.log('Analytics - All Leads:', safeLeads);
        
        const total = safeLeads.length;
        const sent = safeLeads.filter(l => l.status && l.status !== 'PENDING').length;
        const pending = safeLeads.filter(l => !l.status || l.status === 'PENDING').length;
        const hot = safeLeads.filter(l => {
          const tags = String(l.tags || '').toLowerCase();
          return tags.includes('hot');
        }).length;
        
        const interested = safeLeads.filter(l => {
          const outcome = String(l.outcome || '').toLowerCase();
          const status = String(l.status || '').toLowerCase();
          return outcome.includes('interested') || status.includes('interested');
        }).length;
        
        const noAnswer = safeLeads.filter(l => {
          const outcome = String(l.outcome || '').toLowerCase();
          const status = String(l.status || '').toLowerCase();
          return outcome.includes('no answer') || status.includes('no answer');
        }).length;
        
        const conversionRate = total > 0 ? Math.round((interested / total) * 100) : 0;
        
        console.log('Analytics Stats:', { total, sent, pending, hot, interested, noAnswer, conversionRate });
        
        setStats({ total, sent, pending, hot, interested, noAnswer, conversionRate });
      } catch (e) {
        if (e.message.includes('Rate Limit')) {
          alert('⏳ Too many requests. Please wait 1 minute and try again.');
        } else if (e.message.includes('Network')) {
          alert('📡 Connection error. Check your internet and try again.');
        } else {
          alert('❌ Something went wrong: ' + e.message);
        }
      } finally {
        setLoading(false);
      }
    };
    
    calculateStats();
  }, [clientId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="bg-white p-4 border-b shadow-sm sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <ArrowLeft />
          </button>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <TrendingUp className="text-blue-600" /> Analytics
          </h1>
        </div>
      </div>
      
      <div className="p-6 space-y-6">
        {/* Key Metrics Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
            <p className="text-gray-500 text-xs uppercase font-bold mb-1">Total Leads</p>
            <p className="text-4xl font-black text-gray-900">{stats.total}</p>
            <div className="mt-2 flex items-center gap-1 text-xs text-gray-500">
              <ListIcon size={12} /> <span>In database</span>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
            <p className="text-gray-500 text-xs uppercase font-bold mb-1">Contacted</p>
            <p className="text-4xl font-black text-green-600">{stats.sent}</p>
            <div className="mt-2 flex items-center gap-1 text-xs text-green-600">
              <CheckCircle2 size={12}/>
              <span>Reached out</span>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
            <p className="text-gray-500 text-xs uppercase font-bold mb-1">Pending</p>
            <p className="text-4xl font-black text-orange-600">{stats.pending}</p>
            <div className="mt-2 flex items-center gap-1 text-xs text-orange-600">
              <AlertTriangle size={12}/>
              <span>Not contacted</span>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
            <p className="text-gray-500 text-xs uppercase font-bold mb-1">Hot Leads</p>
            <p className="text-4xl font-black text-red-600">{stats.hot}</p>
            <div className="mt-2 flex items-center gap-1 text-xs text-red-600">
              <Flame size={12}/>
              <span>Priority</span>
            </div>
          </div>
        </div>

        {/* Conversion Rate Card */}
        {stats.total > 0 && (
          <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-6 rounded-2xl shadow-xl text-white">
            <h3 className="font-bold mb-4 flex items-center gap-2">
              <BarChart3 size={20}/>
              Conversion Rate
            </h3>
            
            <div className="mb-4">
              <div className="flex justify-between items-end mb-2">
                <span className="text-6xl font-black">{stats.conversionRate}%</span>
                <span className="text-blue-100 text-sm">{stats.interested} / {stats.total}</span>
              </div>
              
              <div className="h-3 bg-white/20 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-white transition-all duration-500 rounded-full"
                  style={{ width: `${stats.conversionRate}%` }}
                ></div>
              </div>
            </div>

            <p className="text-blue-100 text-sm">
              {stats.interested} leads showed interest out of {stats.total} total
            </p>
          </div>
        )}

        {/* Outcome Breakdown */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h3 className="font-bold mb-4 text-gray-900">Outcome Breakdown</h3>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-green-50 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
                  <ThumbsUp size={18} className="text-white"/>
                </div>
                <span className="font-bold text-gray-700">Interested</span>
              </div>
              <span className="text-2xl font-black text-green-600">{stats.interested}</span>
            </div>

            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-400 rounded-full flex items-center justify-center">
                  <Phone size={18} className="text-white"/>
                </div>
                <span className="font-bold text-gray-700">No Answer</span>
              </div>
              <span className="text-2xl font-black text-gray-600">{stats.noAnswer}</span>
            </div>

            <div className="flex items-center justify-between p-3 bg-orange-50 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-orange-500 rounded-full flex items-center justify-center">
                  <AlertTriangle size={18} className="text-white"/>
                </div>
                <span className="font-bold text-gray-700">Not Contacted</span>
              </div>
              <span className="text-2xl font-black text-orange-600">{stats.pending}</span>
            </div>
          </div>
        </div>

        {/* Performance Tips */}
        <div className="bg-blue-50 border-2 border-blue-200 p-5 rounded-2xl">
          <h3 className="font-bold mb-3 text-blue-900 flex items-center gap-2">
            <Sparkles size={18}/>
            Performance Tips
          </h3>
          
          <ul className="space-y-2 text-sm text-blue-800">
            {stats.pending > stats.sent && (
              <li className="flex items-start gap-2">
                <span className="text-blue-600 mt-0.5">•</span>
                <span>You have {stats.pending} leads waiting. Start calling to boost your stats!</span>
              </li>
            )}
            
            {stats.conversionRate < 20 && stats.total > 10 && (
              <li className="flex items-start gap-2">
                <span className="text-blue-600 mt-0.5">•</span>
                <span>Try refining your pitch. Industry average is 20-30% conversion.</span>
              </li>
            )}
            
            {stats.hot > 0 && (
              <li className="flex items-start gap-2">
                <span className="text-blue-600 mt-0.5">•</span>
                <span>You have {stats.hot} hot leads! Prioritize these for quick wins.</span>
              </li>
            )}

            {stats.conversionRate >= 30 && (
              <li className="flex items-start gap-2">
                <span className="text-blue-600 mt-0.5">•</span>
                <span>🎉 Excellent conversion rate! Keep up the great work!</span>
              </li>
            )}
          </ul>
        </div>

        {/* Empty State */}
        {stats.total === 0 && (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-200 rounded-full mx-auto mb-4 flex items-center justify-center">
              <TrendingUp size={32} className="text-gray-400"/>
            </div>
            <h3 className="font-bold text-gray-700 mb-2">No Data Yet</h3>
            <p className="text-gray-500 text-sm">Add some leads to see your analytics!</p>
          </div>
        )}
      </div>
    </div>
  );
}

// Custom hook to detect unsaved changes
function useUnsavedChanges(currentState, initialState) {
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (!currentState || !initialState) {
      setHasChanges(false);
      return;
    }

    // Deep comparison for objects
    const changed = JSON.stringify(currentState) !== JSON.stringify(initialState);
    setHasChanges(changed);
  }, [currentState, initialState]);

  return hasChanges;
}

// Custom hook for back button handling
function useBackButtonHandler(onBack, shouldWarn = false, warningMessage = "You have unsaved changes. Are you sure you want to leave?") {
  useEffect(() => {
    const handlePopState = (e) => {
      if (shouldWarn) {
        e.preventDefault();
        if (window.confirm(warningMessage)) {
          onBack();
        } else {
          // Push state back to prevent navigation
          window.history.pushState(null, '', window.location.href);
        }
      } else {
        onBack();
      }
    };

    // Push initial state
    window.history.pushState(null, '', window.location.href);
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [onBack, shouldWarn, warningMessage]);
} 

function App() {
  const [view, setView] = useState("loader");
  const [clientId, setClientId] = useState(null);
  const [publicProfile, setPublicProfile] = useState(null);
  
  const [queue, setQueue] = useState([]);
  const [allLeads, setAllLeads] = useState([]);
  const [stats, setStats] = useState({ today: 0 });
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  
  const [activeLead, setActiveLead] = useState(null);
  const [prefillData, setPrefillData] = useState(null);
  const [bulkData, setBulkData] = useState([]);
  const [selectedLeads, setSelectedLeads] = useState(new Set());
  
  const [template, setTemplate] = useState("");
  const [library, setLibrary] = useState([]);
  const [userProfile, setUserProfile] = useState({});

  useEffect(() => {
    const init = async () => {
      const params = new URLSearchParams(window.location.search);
      const keyParam = params.get("key");
      const slugParam = params.get("u");
      const refParam = params.get("ref");
      
      if (refParam) sessionStorage.setItem('referrer_id', refParam);
      const pathSlug = window.location.pathname.replace('/', '');
      
      // FIXED: Always show landing page unless explicit access params
      const hasExplicitAccess = keyParam || slugParam || (pathSlug && pathSlug.length > 2);
      
      if (!hasExplicitAccess) {
        const stored = safeStorage.getItem("thrivoy_client_id");
        const hasAuth = stored ? safeStorage.getItem(`thrivoy_auth_${stored}`) : null;
        
        // Only skip landing if user has BOTH stored ID and valid auth
        if (stored && hasAuth) {
          setClientId(stored);
          setView("menu");
          return;
        }
        
        setView("landing");
        return;
      }
      
      if (keyParam) {
        setClientId(keyParam);
        safeStorage.setItem("thrivoy_client_id", keyParam);
        const hasAuth = safeStorage.getItem(`thrivoy_auth_${keyParam}`);
        if (hasAuth) setView("menu");
        else setView("pin_check");
        return;
      }

      const targetSlug = slugParam || (pathSlug && pathSlug.length > 2 ? pathSlug : null);
      if (targetSlug) {
        try {
          const res = await signedRequest("GET_CLIENT_BY_SLUG", { slug: targetSlug });
          const json = await res.json();
          if (json.status === 'success') {
            setPublicProfile(json.data);
            setView("public_card");
          } else {
            setView("landing");
          }
        } catch (e) {
          setView("landing");
        }
        return;
      }

      setView("landing");
    };
    init();
  }, []);

  useEffect(() => {
    if (clientId && view === 'menu' && clientId !== ADMIN_KEY) {
      requestCache.clear();
      fetchQueue(clientId);
      
      signedRequest("GET_CLIENT_PROFILE", { client_id: clientId })
        .then(r => r.json())
        .then(j => {
          if (j.data) {
            setUserProfile(j.data);
            if (j.data.secret) safeStorage.setItem(`thrivoy_secret_${clientId}`, j.data.secret);
            
            const savedTpl = safeStorage.getItem(`tpl_${clientId}`);
            if (savedTpl) setTemplate(savedTpl);
            else setTemplate("Hi {{name}}, regarding {{context}}.");
            
            const savedLib = safeStorage.getItem(`lib_${clientId}`);
            if (savedLib) setLibrary(JSON.parse(savedLib));
          }
        });
    }
  }, [clientId, view]);

  const fetchQueue = useCallback(async (id) => {
    if (!id || id === ADMIN_KEY) return;
    setLoading(true);
    setLoadingMessage("Loading queue...");
    
    const cacheKey = JSON.stringify({ action: "GET_QUEUE", payload: { client_id: id } });
    requestCache.delete(cacheKey);
    
    try {
      const res = await signedRequest("GET_QUEUE", { client_id: id });
      const json = await res.json();
      
      console.log('=== FETCH QUEUE DEBUG ===');
      console.log('API Response:', json);
      console.log('Queue Data:', json.data?.queue);
      console.log('All Leads Data:', json.data?.allLeads); // ✅ ADD THIS
      console.log('========================');
      
      if (json.data) {
        const queueData = json.data.queue;
        const processedQueue = Array.isArray(queueData) ? queueData.map(sanitizeLead) : [];
        setQueue(processedQueue);
        
        // ✅ ADD THIS: Process all leads for analytics
        const allLeadsData = json.data.allLeads || queueData;
        const processedAllLeads = Array.isArray(allLeadsData) ? allLeadsData.map(sanitizeLead) : [];
        setAllLeads(processedAllLeads);
        
        const statsData = json.data.stats;
        setStats(statsData && typeof statsData === 'object' ? { today: statsData.today || 0 } : { today: 0 });
      } else {
        setQueue([]);
        setAllLeads([]); // ✅ ADD THIS
        setStats({ today: 0 });
      }
    } catch (e) {
      console.error("Fetch queue error:", e);
      setQueue([]);
      setAllLeads([]); // ✅ ADD THIS
      setStats({ today: 0 });
    } finally {
      setLoading(false);
      setLoadingMessage("");
    }
  }, []);

  const handleBulkSubmit = async (leads) => {
    setLoading(true);
    setLoadingMessage(`Saving ${leads.length} lead${leads.length !== 1 ? 's' : ''}...`);
    try {
      const refId = sessionStorage.getItem('referrer_id');
      const res = await signedRequest("ADD_LEADS", { client_id: clientId, leads, ref_id: refId });
      const json = await res.json();
      
      if (json.status === 'success') {
        let message = `✅ Saved ${json.count} lead${json.count !== 1 ? 's' : ''}!`;
        
        if (json.duplicates > 0) {
          message += `\n\n⚠️ Skipped ${json.duplicates} duplicate${json.duplicates !== 1 ? 's' : ''}:`;
          if (json.skipped_leads && json.skipped_leads.length > 0) {
            const preview = json.skipped_leads.slice(0, 3);
            preview.forEach(skip => {
              message += `\n• ${skip.name} (${skip.phone})\n  ${skip.reason}`;
            });
            if (json.skipped_leads.length > 3) {
              message += `\n\n...and ${json.skipped_leads.length - 3} more`;
            }
          }
        }
        
        alert(message);
        await fetchQueue(clientId);
        setView("menu");
      } else {
        alert("Error: " + json.message);
      }
      } catch (e) {
        if (e.message.includes('Rate Limit')) {
          alert('⏳ Too many requests. Please wait 1 minute and try again.');
        } else if (e.message.includes('Network')) {
          alert('📡 Connection error. Check your internet and try again.');
        } else {
          alert('❌ Something went wrong: ' + e.message);
        }
      } finally {
      setLoading(false);
      setLoadingMessage("");
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    Papa.parse(file, {
      header: true,
      complete: (results) => {
        const valid = results.data
          .filter(r => r.Phone || r.Mobile)
          .map(r => ({
            name: r.Name || "Lead",
            phone: r.Phone || r.Mobile,
            context: r.Context || r.Notes || "Imported",
            email: r.Email || "",
            company: r.Company || "",
            website: r.Website || "",
            designation: r.Designation || r.Title || ""
          }));
        setBulkData(valid);
        setView("bulk");
      }
    });
  };

  if (!isOnline) {
    return (
      <div className="h-screen flex flex-col items-center justify-center p-6 text-center">
        <WifiOff size={48} className="text-gray-300 mb-4" />
        <h2 className="text-xl font-bold">Offline</h2>
        <p className="text-gray-500">Check internet.</p>
      </div>
    );
  }

  if (view === "loader") {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (view === "landing") return <LandingPage />;
  if (view === "admin") return <AdminDashboard />;
  if (clientId === ADMIN_KEY && view !== "admin") return <AdminLogin onLogin={() => setView("admin")} />;
  if (view === "pin_check") {
    return (
      <PinScreen
        clientId={clientId}
        onSuccess={() => {
          safeStorage.setItem(`thrivoy_auth_${clientId}`, "true");
          setView("menu");
        }}
      />
    );
  }
  if (view === "public_card") return <BioLinkCard profile={publicProfile} />;
  if (view === "affiliates") return <AffiliateScreen clientId={clientId} onBack={() => setView("menu")} />;

  return (
    <>
      {loading && <LoadingOverlay message={loadingMessage || "Processing..."} />}
      
      {view === "menu" && (
        <MenuScreen
          queue={queue}
          stats={stats}
          loading={loading}
          onViewChange={setView}
          onUpload={handleFileUpload}
          onRefresh={() => fetchQueue(clientId)}
          clientId={clientId}
          onBulkSubmit={handleBulkSubmit}
          userProfile={userProfile}
        />
      )}
      
      {view === "stack" && (
        <CardStack
          queue={queue}
          setQueue={setQueue}
          template={template}
          library={library}
          clientId={clientId}
          onBack={() => {
            fetchQueue(clientId);
            setView("menu");
          }}
          initialLead={activeLead}
        />
      )}
      
      {view === "list" && (
        <QueueList
          queue={Array.isArray(queue) ? queue : []}
          onBack={() => setView("menu")}
          onSelect={(lead) => {
            setActiveLead(lead);
            setView("stack");
          }}
          selectedLeads={selectedLeads}
          setSelectedLeads={setSelectedLeads}
          onPowerEmail={() => setView("power_email")}
          clientId={clientId}
          onRefresh={() => fetchQueue(clientId)}
        />
      )}
      
      {view === "power_email" && (
        <PowerEmailer
          queue={queue}
          selectedIds={selectedLeads}
          template={template}
          onBack={() => setView("list")}
        />
      )}
      
      {view === "hotlist" && (
        <HotList
          clientId={clientId}
          onBack={() => setView("menu")}
        />
      )}
      
      {view === "camera" && (
        <CameraScan
          clientId={clientId}
          onBack={() => setView("menu")}
          onScanComplete={(d) => {
            setPrefillData(d);
            setView("manual");
          }}
        />
      )}
      
      {view === "manual" && (
        <ManualForm
          prefill={prefillData}
          onBack={() => {
            setPrefillData(null);
            setView("menu");
          }}
          onSubmit={(l) => {
            setPrefillData(null);
            handleBulkSubmit([l]);
          }}
        />
      )}
      
      {view === "bulk" && (
        <BulkPasteForm
          initialData={bulkData}
          clientId={clientId}
          onBack={() => setView("menu")}
          onSubmit={handleBulkSubmit}
        />
      )}
      
      {view === "settings" && (
        <SettingsForm
          template={template}
          setTemplate={setTemplate}
          library={library}
          setLibrary={setLibrary}
          userProfile={userProfile}
          setUserProfile={setUserProfile}
          clientId={clientId}
          onBack={() => setView("menu")}
          onLogout={() => {
            safeStorage.removeItem("thrivoy_client_id");
            safeStorage.removeItem(`thrivoy_auth_${clientId}`);
            window.location.href = "/";
          }}
        />
      )}
      
      {view === "analytics" && (
        <AnalyticsScreen 
          clientId={clientId}
          queue={allLeads} // ✅ CHANGE: Pass allLeads instead of queue
          onBack={() => setView("menu")}
        />
      )}
      
      {view === "help" && <HelpScreen onBack={() => setView("menu")} />}
    </>
  );
}

function MenuScreen({ queue, stats, loading, onViewChange, onUpload, onRefresh, clientId, onBulkSubmit, userProfile }) {
  useEffect(() => {
    const interval = setInterval(() => {
      if (clientId !== ADMIN_KEY) onRefresh();
    }, 30000);
    return () => clearInterval(interval);
  }, [clientId, onRefresh]);

  const shareCard = () => { 
    if(navigator.share) navigator.share({ title: 'My Digital Card', url: `${window.location.origin}?u=${userProfile.slug || clientId}` }); 
    else { navigator.clipboard.writeText(`${window.location.origin}?u=${userProfile.slug || clientId}`); alert("Link copied"); }
  };
  
  const importContacts = async () => {
    if ('contacts' in navigator && 'ContactsManager' in window) {
       try {
          const props = ['name', 'tel', 'email'];
          const contacts = await navigator.contacts.select(props, { multiple: true });
          if (contacts.length > 0) {
             const formatted = contacts.map(c => ({ 
               name: c.name[0], 
               phone: c.tel[0], 
               email: c.email?.[0] || "", 
               context: "Imported from Phonebook" 
             }));
             await onBulkSubmit(formatted);
             onRefresh();
          }
       } catch (ex) { console.log(ex); }
    } else alert("Use 'AI Paste' for non-mobile devices.");
  };

  const handleExport = () => {
    if (queue.length === 0) {
      alert("No leads to export");
      return;
    }
    exportToCSV(queue, `thrivoy_leads_${clientId}`);
    vibrate(100);
    alert("CSV downloaded!");
  };

  const safeQueue = Array.isArray(queue) ? queue : [];
  const usage = safeQueue.length;
  const isFree = userProfile?.plan === "Free" || !userProfile?.plan;
  const percentUsed = (usage / 100) * 100;

  console.log('MenuScreen - Queue:', safeQueue);
  console.log('MenuScreen - Queue Length:', usage);
  console.log('MenuScreen - User Plan:', userProfile?.plan);

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
          {/* ✅ FIX: Check plan status properly */}
          {isFree && usage >= 40 && (
            <div className="bg-gradient-to-r from-orange-50 to-red-50 border-2 border-orange-300 p-4 rounded-2xl shadow-lg animate-pulse">
            <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-red-500 rounded-full flex items-center justify-center"><AlertTriangle size={20} className="text-white"/></div>
                <div className="flex-1"><p className="font-black text-red-700">Storage Critical!</p><p className="text-xs text-gray-600">Only {100 - usage} slots remaining</p></div>
            </div>

          {/* ✅ ADD: Show Pro badge for Pro users */}
          {!isFree && (
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-300 p-4 rounded-2xl shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
                  <Sparkles size={20} className="text-white"/>
                </div>
                <div className="flex-1">
                  <p className="font-black text-green-700">Pro Plan Active</p>
                  <p className="text-xs text-gray-600">Unlimited leads & full AI features</p>
                </div>
              </div>
            </div>
          )}
            <div className="bg-white rounded-lg p-2 mb-2">
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-orange-500 to-red-600 transition-all" style={{width: `${percentUsed}%`}}></div>
                </div>
            </div>
            <button onClick={() => window.open(`https://wa.me/919999999999?text=I want to upgrade to Pro. My ID: ${clientId}`)} className="w-full bg-red-600 hover:bg-red-700 text-white py-3 rounded-xl font-bold shadow-lg flex items-center justify-center gap-2">
                <Zap size={18}/> Upgrade to Pro Now
            </button>
          </div>
         )}
         
         <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-5 text-white shadow-xl shadow-blue-200 flex justify-between items-center relative overflow-hidden">
            <div className="relative z-10"><p className="text-blue-100 text-xs font-bold uppercase tracking-wider">Today's Wins</p><p className="text-4xl font-black mt-1">{stats.today || 0}</p></div>
            <div className="bg-white/20 p-3 rounded-xl relative z-10"><Zap size={24} fill="currentColor"/></div>
         </div>
         
         <button onClick={() => onViewChange("affiliates")} className="w-full bg-purple-50 text-purple-700 p-3 rounded-xl border border-purple-100 font-bold flex items-center justify-center gap-2">
             <DollarSign size={20}/> Earn with Referrals
         </button>

         <button 
          onClick={() => {
            console.log('Active Queue Clicked - Queue:', safeQueue);
            onViewChange("list");
          }} 
          className="w-full bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex justify-between items-center active:bg-gray-50 transition-colors"
        >
            <div className="flex items-center gap-3">
                <div className="bg-orange-100 text-orange-600 p-2 rounded-lg"><ListIcon size={20}/></div>
                <div className="text-left">
                  <p className="font-bold text-gray-800">Active Queue</p>
                  {/* ✅ FIX: Don't show limit for Pro users */}
                  <p className="text-xs text-gray-500">
                    {isFree ? `${usage} / ${LEAD_LIMIT} leads` : `${usage} leads`}
                  </p>
                </div>
            </div>
            <ChevronRight size={20} className="text-gray-300"/>
         </button>

         <button onClick={() => onViewChange("analytics")} className="w-full bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex justify-between items-center active:bg-gray-50 transition-colors">
             <div className="flex items-center gap-3">
                 <div className="bg-purple-100 text-purple-600 p-2 rounded-lg"><TrendingUp size={20}/></div>
                 <div className="text-left"><p className="font-bold text-gray-800">Analytics</p><p className="text-xs text-gray-500">View your stats</p></div>
             </div>
             <ChevronRight size={20} className="text-gray-300"/>
         </button>

         <div className="grid grid-cols-2 gap-4">
             <button onClick={() => onViewChange("camera")} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col items-center gap-2 active:scale-95 transition-transform"><Camera size={28} className="text-purple-500"/><span className="font-bold text-sm text-gray-700">Scan Card</span></button>
             <button onClick={() => onViewChange("bulk")} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col items-center gap-2 active:scale-95 transition-transform"><Wand2 size={28} className="text-pink-500"/><span className="font-bold text-sm text-gray-700">AI Paste</span></button>
             <button onClick={() => onViewChange("manual")} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col items-center gap-2 active:scale-95 transition-transform"><UserPlus size={28} className="text-green-500"/><span className="font-bold text-sm text-gray-700">Add One</span></button>
             <button onClick={() => onViewChange("hotlist")} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col items-center gap-2 active:scale-95 transition-transform"><Flame size={28} className="text-orange-500"/><span className="font-bold text-sm text-gray-700">Hot Vault</span></button>
         </div>

         {('contacts' in navigator) && (
             <button onClick={importContacts} className="w-full bg-indigo-50 text-indigo-700 p-3 rounded-xl border border-indigo-100 font-bold flex items-center justify-center gap-2"><Users size={20}/> Import Contacts</button>
         )}

         <div className="flex gap-2">
             <label className="flex-1 bg-gray-100 p-3 rounded-xl text-center text-xs font-bold text-gray-500 cursor-pointer hover:bg-gray-200 flex items-center justify-center gap-2"><Upload size={16}/> Upload CSV <input type="file" accept=".csv" onChange={onUpload} className="hidden"/></label>
             <button onClick={handleExport} className="flex-1 bg-green-100 text-green-700 p-3 rounded-xl text-center text-xs font-bold hover:bg-green-200 flex items-center justify-center gap-2"><Download size={16}/> Export CSV</button>
             <button onClick={() => onViewChange("help")} className="bg-gray-100 p-3 rounded-xl text-gray-500"><HelpCircle size={16}/></button>
         </div>

         {safeQueue.length > 0 && (
             <button 
               onClick={() => {
                 console.log('Start Calling - Queue:', safeQueue);
                 onViewChange("stack");
               }} 
               className="w-full py-4 bg-gray-900 text-white rounded-xl font-bold shadow-xl flex items-center justify-center gap-2 mt-4 active:scale-[0.98] transition-transform"
             >
               <Play fill="currentColor" size={20}/> Start Calling
             </button>
         )}
      </main>
    </div>
  );
}

function AffiliateScreen({ clientId, onBack }) {
  const [stats, setStats] = useState({ referrals: 0, earnings: 0 });
  const shareUrl = `${window.location.origin}?key=SIGNUP&ref=${clientId}`;
  useEffect(() => { signedRequest("GET_REFERRAL_STATS", { client_id: clientId }).then(r => r.json()).then(j => { if(j.status === 'success') setStats(j.data); }); }, [clientId]);
  const copyLink = () => { navigator.clipboard.writeText(shareUrl); alert("Referral link copied!"); };
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 p-6">
      <button onClick={onBack} className="mb-6"><ArrowLeft/></button>
      <div className="max-w-md mx-auto">
        <h1 className="text-3xl font-black mb-2 text-gray-900">Affiliate Program</h1>
        <p className="text-gray-600 mb-8">Earn ₹500/month for every Pro user you refer</p>
        <div className="bg-white rounded-3xl p-6 shadow-2xl mb-6">
            <p className="text-sm text-gray-500 mb-1">Monthly Earnings</p>
            <p className="text-5xl font-black text-green-600 mb-4">₹{stats.earnings}</p>
            <div className="flex gap-4 text-sm">
                <div><p className="text-gray-500">Active Referrals</p><p className="text-2xl font-bold">{stats.referrals}</p></div>
                <div><p className="text-gray-500">Commission</p><p className="text-2xl font-bold">50%</p></div>
            </div>
        </div>
        <div className="bg-white rounded-2xl p-6 shadow-lg mb-6">
            <p className="font-bold mb-3">Your Referral Link</p>
            <div className="bg-gray-50 p-3 rounded-xl mb-3 break-all text-xs font-mono text-gray-600">{shareUrl}</div>
            <button onClick={copyLink} className="w-full bg-purple-600 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2"><Copy size={18}/> Copy Link</button>
        </div>
      </div>
    </div>
  );
}

function PowerEmailer({ queue, selectedIds, template, onBack }) {
    const safeQueue = Array.isArray(queue) ? queue : [];
    const campaignList = useMemo(() => safeQueue.filter(l => selectedIds.has(l.lead_id) && l.email), [safeQueue, selectedIds]);
    const [index, setIndex] = useState(0); 
    const lead = campaignList[index]; 
    const [msg, setMsg] = useState("");

    useEffect(() => { if(lead) setMsg(template.replace("{{name}}", lead.name).replace("{{context}}", lead.context || "")); }, [lead, template]);
    
    const send = () => { 
        const subject = encodeURIComponent(`Regarding: ${lead.context || "Connect"}`); 
        const body = encodeURIComponent(msg); 
        window.location.href = `mailto:${lead.email}?subject=${subject}&body=${body}`; 
        if(index < campaignList.length - 1) setIndex(index + 1); else alert("Campaign Finished!"); 
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
                <button onClick={send} className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold shadow-lg flex items-center justify-center gap-2 mb-2"><Send size={18}/> Send & Next</button>
                <button onClick={() => { if(index < campaignList.length - 1) setIndex(index + 1); }} className="w-full bg-gray-100 text-gray-500 py-3 rounded-xl font-bold text-sm">Skip</button>
            </div>
        </div>
    );
}

function QueueRow({ index, style, data }) {
  const { queue, onSelect, selected, toggleSelect, selectionMode, onLongPress } = data;
  const lead = queue[index];
  const pressTimerRef = useRef(null); // ✅ FIX: Use ref instead of regular variable
  
  if (!lead) return null;
  
  const isSelected = selected.has(lead.lead_id);
  
  // Long press handling
  const handleTouchStart = () => {
    pressTimerRef.current = setTimeout(() => {
      if (onLongPress) {
        vibrate(100); // Optional: Add haptic feedback
        onLongPress(lead);
      }
    }, 500);
  };
  
  const handleTouchEnd = () => {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
  };

  return (
    <div style={style} className="px-4">
      <div 
        className={`p-3 rounded-xl border transition-all cursor-pointer ${
          isSelected ? 'bg-blue-50 border-blue-500' : 'bg-white border-gray-200'
        } hover:shadow-md`}
        onClick={() => {
          if (selectionMode) {
            toggleSelect(lead.lead_id);
          } else {
            onSelect(lead);
          }
        }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd} // ✅ ADD: Handle touch cancel
      >
        <div className="flex items-center gap-3">
          {selectionMode && (
            <div 
              className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                isSelected ? 'bg-blue-600 border-blue-600' : 'border-gray-300'
              }`}
            >
              {isSelected && <CheckCircle2 size={14} className="text-white"/>}
            </div>
          )}
          
          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm ${
            lead.tags?.toLowerCase().includes('hot') ? 'bg-red-500' : 'bg-blue-500'
          }`}>
            {lead.name.charAt(0).toUpperCase()}
          </div>
          
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-gray-900 truncate">{lead.name}</h3>
            <p className="text-sm text-gray-600 font-mono">{lead.phone}</p>
            {lead.company && (
              <p className="text-xs text-gray-500 truncate flex items-center gap-1">
                <Building2 size={10}/> {lead.company}
              </p>
            )}
          </div>
          
          <div className="flex flex-col items-end gap-1">
            {lead.tags && (
              <div className="flex gap-1 flex-wrap justify-end">
                {lead.tags.split(',').slice(0, 2).map((tag, i) => (
                  <span key={i} className="text-[9px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-bold">
                    {tag.trim()}
                  </span>
                ))}
              </div>
            )}
            <ChevronRight size={16} className="text-gray-400"/>
          </div>
        </div>
        
        {lead.context && (
          <p className="text-xs text-gray-500 mt-2 pl-13 line-clamp-1">{lead.context}</p>
        )}
      </div>
    </div>
  );
}

function QueueListSkeleton() {
  return (
    <div className="p-4 space-y-3">
      {[...Array(8)].map((_, i) => (
        <div key={i} className="p-3 rounded-xl border border-gray-100 bg-white animate-pulse">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
            <div className="flex-1">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
              <div className="h-3 bg-gray-200 rounded w-1/2"></div>
            </div>
            <div className="w-4 h-4 bg-gray-200 rounded"></div>
          </div>
        </div>
      ))}
    </div>
  );
}

function QueueList({ queue, onBack, onSelect, selectedLeads, setSelectedLeads, onPowerEmail, clientId, onRefresh }) {
  const safeQueue = Array.isArray(queue) ? queue : [];
  
  const [selectionMode, setSelectionMode] = useState(false); 
  const [showTagInput, setShowTagInput] = useState(false); 
  const [newTag, setNewTag] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [editingLead, setEditingLead] = useState(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);

  console.log('🔍 QueueList Render:', {
    queueLength: safeQueue.length,
    searchQuery,
    queue: safeQueue
  });

  // Filter queue based on search
  const filteredQueue = useMemo(() => {
    if (!searchQuery) return safeQueue;
    const q = searchQuery.toLowerCase();
    return safeQueue.filter(l => {
      try {
        return (l.name && String(l.name).toLowerCase().includes(q)) ||
               (l.phone && String(l.phone).includes(q)) ||
               (l.email && String(l.email).toLowerCase().includes(q)) ||
               (l.company && String(l.company).toLowerCase().includes(q));
      } catch (e) {
        console.error('Search filter error:', e, l);
        return false;
      }
    });
  }, [safeQueue, searchQuery]);

  console.log('🔍 Filtered Queue:', filteredQueue.length);

  const toggleSelect = (id) => { 
      setSelectionMode(true); 
      const next = new Set(selectedLeads); 
      if(next.has(id)) next.delete(id); else next.add(id); 
      setSelectedLeads(next); 
      if(next.size === 0) setSelectionMode(false); 
  };

  const handleBCCWithConfirm = () => {
    const emailCount = safeQueue.filter(l => selectedLeads.has(l.lead_id) && l.email).length;
    if (emailCount === 0) return alert("No emails found in selection");
    
    setConfirmAction({
      title: "Send BCC Email?",
      message: `This will open your email client with ${emailCount} email${emailCount !== 1 ? 's' : ''} in BCC.`,
      onConfirm: handleBCC
    });
    setShowConfirm(true);
  };

  const handleBCC = () => { 
      const emails = safeQueue.filter(l => selectedLeads.has(l.lead_id) && l.email).map(l => l.email).join(','); 
      window.location.href = `mailto:?bcc=${emails}&subject=Update`; 
      setShowConfirm(false);
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

  const handleEditLead = async (updatedLead) => {
    try {
      await signedRequest("UPDATE_LEAD", { 
        client_id: clientId, 
        lead_id: updatedLead.lead_id,
        name: updatedLead.name,
        phone: updatedLead.phone,
        email: updatedLead.email,
        company: updatedLead.company,
        website: updatedLead.website,
        designation: updatedLead.designation,
        context: updatedLead.context
      });
      setEditingLead(null);
      onRefresh();
      vibrate(50);
      } catch (e) {
        if (e.message.includes('Rate Limit')) {
          alert('⏳ Too many requests. Please wait 1 minute and try again.');
        } else if (e.message.includes('Network')) {
          alert('📡 Connection error. Check your internet and try again.');
        } else {
          alert('❌ Something went wrong: ' + e.message);
        }
      }
  };

  const handleLongPress = (lead) => {
    if (!selectionMode) {
      setEditingLead(lead);
      vibrate(100);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50">
        <div className="bg-white p-4 border-b shadow-sm z-10">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <button onClick={onBack} aria-label="Go back to menu">
                  <ArrowLeft/>
                </button>
                <h2 className="font-bold">{selectionMode ? `${selectedLeads.size} Selected` : `Queue (${filteredQueue.length})`}</h2>
              </div>
              {!selectionMode && filteredQueue.length > 0 && <button onClick={() => setSelectionMode(true)} className="text-sm font-bold text-blue-600">Select</button>}
              {selectionMode && <button onClick={() => { setSelectionMode(false); setSelectedLeads(new Set()); }} className="text-sm font-bold text-gray-500">Cancel</button>}
            </div>
            
            {/* Search Bar */}
            <div className="relative">
              <input 
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, phone, email..."
                className="w-full p-3 pl-10 bg-gray-50 rounded-xl border border-gray-200 outline-none focus:border-blue-500 text-sm"
                aria-label="Search leads"
              />
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              </div>
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600" aria-label="Clear search">
                  <X size={16}/>
                </button>
              )}
            </div>
        </div>

        {/* SIMPLE LIST - No virtualization for debugging */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {filteredQueue.length === 0 ? (
              <div className="flex items-center justify-center h-full text-gray-400">
                <div className="text-center py-20">
                  <ListIcon size={48} className="mx-auto mb-4 opacity-50"/>
                  <p className="font-bold">No leads found</p>
                  <p className="text-sm">{searchQuery ? 'Try adjusting your search' : 'Add some leads to get started'}</p>
                </div>
              </div>
            ) : (
              filteredQueue.map((lead, index) => {
                const isSelected = selectedLeads.has(lead.lead_id);
                
                return (
                  <div 
                    key={lead.lead_id || index}
                    className={`p-3 rounded-xl border transition-all cursor-pointer ${
                      isSelected ? 'bg-blue-50 border-blue-500' : 'bg-white border-gray-200'
                    } hover:shadow-md`}
                    onClick={() => {
                      if (selectionMode) {
                        toggleSelect(lead.lead_id);
                      } else {
                        onSelect(lead);
                      }
                    }}
                  >
                    <div className="flex items-center gap-3">
                      {selectionMode && (
                        <div 
                          className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                            isSelected ? 'bg-blue-600 border-blue-600' : 'border-gray-300'
                          }`}
                        >
                          {isSelected && <CheckCircle2 size={14} className="text-white"/>}
                        </div>
                      )}
                      
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm ${
                        lead.tags?.toLowerCase().includes('hot') ? 'bg-red-500' : 'bg-blue-500'
                      }`}>
                        {lead.name ? lead.name.charAt(0).toUpperCase() : '?'}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-gray-900 truncate">{lead.name}</h3>
                        <p className="text-sm text-gray-600 font-mono">{lead.phone}</p>
                        {lead.company && (
                          <p className="text-xs text-gray-500 truncate flex items-center gap-1">
                            <Building2 size={10}/> {lead.company}
                          </p>
                        )}
                      </div>
                      
                      <div className="flex flex-col items-end gap-1">
                        {lead.tags && (
                          <div className="flex gap-1 flex-wrap justify-end">
                            {lead.tags.split(',').slice(0, 2).map((tag, i) => (
                              <span key={i} className="text-[9px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-bold">
                                {tag.trim()}
                              </span>
                            ))}
                          </div>
                        )}
                        <ChevronRight size={16} className="text-gray-400"/>
                      </div>
                    </div>
                    
                    {lead.context && (
                      <p className="text-xs text-gray-500 mt-2 pl-13 truncate">{lead.context}</p>
                    )}
                  </div>
                );
              })
            )}
        </div>

        {selectionMode && selectedLeads.size > 0 && (
            <div className="bg-white border-t p-4 flex gap-2 overflow-x-auto pb-safe shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
                <button onClick={onPowerEmail} className="bg-blue-600 text-white px-4 py-3 rounded-xl font-bold text-sm whitespace-nowrap flex items-center gap-2">
                  <Zap size={16}/> Rapid Fire
                </button>
                <button onClick={handleBCCWithConfirm} className="bg-gray-900 text-white px-4 py-3 rounded-xl font-bold text-sm whitespace-nowrap flex items-center gap-2">
                  <Mail size={16}/> BCC Blast
                </button>
                <button onClick={() => setShowTagInput(true)} className="bg-purple-100 text-purple-700 px-4 py-3 rounded-xl font-bold text-sm whitespace-nowrap flex items-center gap-2">
                  <Tag size={16}/> Tag
                </button>
            </div>
        )}

        {showTagInput && (
            <div className="absolute inset-0 bg-black/50 z-50 flex items-center justify-center p-6">
                <div className="bg-white p-6 rounded-2xl w-full max-w-sm">
                    <h3 className="font-bold mb-4">Add Tag</h3>
                    <input autoFocus value={newTag} onChange={e=>setNewTag(e.target.value)} placeholder="#Hot" className="w-full p-3 border rounded-xl mb-4 outline-none focus:border-blue-500"/>
                    <div className="flex gap-2">
                        <button onClick={() => setShowTagInput(false)} className="flex-1 py-3 font-bold text-gray-500 border rounded-xl">Cancel</button>
                        <button onClick={handleAddTag} className="flex-1 bg-purple-600 text-white rounded-xl font-bold py-3">Save</button>
                    </div>
                </div>
            </div>
        )}

        <ConfirmDialog 
          isOpen={showConfirm}
          title={confirmAction?.title || ""}
          message={confirmAction?.message || ""}
          onConfirm={() => {
            confirmAction?.onConfirm();
            setShowConfirm(false);
          }}
          onCancel={() => setShowConfirm(false)}
          confirmText="Continue"
          confirmColor="blue"
        />

        {editingLead && (
          <EditLeadModal 
            lead={editingLead} 
            onSave={handleEditLead} 
            onClose={() => setEditingLead(null)} 
          />
        )}
    </div>
  );
}

function CardStack({ queue, setQueue, template, library, clientId, onBack, initialLead }) {
  const safeQueue = Array.isArray(queue) ? queue : [];
  
  const [active, setActive] = useState(initialLead || safeQueue[0]);
  const [msg, setMsg] = useState("");
  const [msgCache, setMsgCache] = useState({});
  const controls = useAnimation();
  const [mode, setMode] = useState("card");
  const [polyglot, setPolyglot] = useState(false);
  const [showUndo, setShowUndo] = useState(false);
  const [lastAction, setLastAction] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useBackButtonHandler(
    () => {
      if (isProcessing) {
        alert("Action in progress, please wait");
        return;
      }
      if (window.confirm("Exit calling queue?")) {
        onBack();
      }
    },
    isProcessing || safeQueue.length > 0,
    "Exit calling queue? Progress will be lost."
  );

  const generateMessage = useCallback((lead) => {
    if (!lead) return "";
    const ctx = (lead.context || "").split(" ||| ")[0];
    let tpl = template || "Hi {{name}}, regarding {{context}}.";
    const match = library.find(l => ctx.toLowerCase().includes(l.name.toLowerCase()));
    if (match) tpl = match.text;
    return tpl.replace("{{name}}", lead.name || "").replace("{{context}}", ctx || "");
  }, [template, library]);

  // ✅ FIX: Only run once on mount
  useEffect(() => {
    const savedPosition = safeStorage.getItem(`queue_position_${clientId}`);
    if (savedPosition && !initialLead) {
      try {
        const { leadId, timestamp } = JSON.parse(savedPosition);
        
        if (Date.now() - timestamp < 7200000) {
          const resumeLead = safeQueue.find(l => l.lead_id === leadId);
          if (resumeLead && window.confirm("Resume from where you left off?")) {
            setActive(resumeLead);
            safeStorage.removeItem(`queue_position_${clientId}`);
          }
        }
      } catch (e) {
        console.error("Resume error:", e);
      }
    }
  }, []); // Run only once on mount

  // ✅ FIX: Only update message when active lead changes
  useEffect(() => {
    if (!active) return;
    
    // Check cache first
    const cachedMsg = msgCache[active.lead_id];
    if (cachedMsg) {
      setMsg(cachedMsg);
    } else {
      // Generate new message only if not in cache
      const newMsg = generateMessage(active);
      setMsg(newMsg);
      setMsgCache(prev => ({ ...prev, [active.lead_id]: newMsg }));
    }
    
    // Reset animation position
    controls.set({ x: 0, opacity: 1 });
  }, [active?.lead_id]); // ✅ Only depend on lead_id

  // ✅ FIX: Debounced cache update for user edits
  useEffect(() => {
    if (!active || !msg) return;
    
    // Only update cache if message has changed
    if (msg !== msgCache[active.lead_id]) {
      const timeoutId = setTimeout(() => {
        setMsgCache(prev => ({ ...prev, [active.lead_id]: msg }));
      }, 500); // Debounce updates
      
      return () => clearTimeout(timeoutId);
    }
  }, [msg]); // Only depend on msg

  const next = () => {
    const idx = safeQueue.findIndex(l => l.lead_id === active.lead_id);
    if (idx < safeQueue.length - 1) {
      setActive(safeQueue[idx + 1]);
      setMode("card");
    } else {
      onBack();
    }
  };

  const submitAction = async (outcome) => {
    setIsProcessing(true);
    vibrate();
    await controls.start({ x: 500, opacity: 0 });
    setLastAction({ lead: active, outcome });
    setShowUndo(true);
    setTimeout(() => setShowUndo(false), 3000);
    
    // ✅ FIX: Filter using lead_id
    setQueue(prev => Array.isArray(prev) ? prev.filter(l => l.lead_id !== active.lead_id) : []);
    
    try {
      await signedRequest("MARK_SENT", {
        client_id: clientId,
        lead_id: active.lead_id, // ✅ Uses lead_id
        outcome
      });
    } catch (e) {
      console.error("Failed to mark sent:", e);
    } finally {
      setIsProcessing(false);
    }
    next();
  };

  const handleUndo = async () => {
    if (!lastAction) return;
    setIsProcessing(true);
    vibrate(100);
    setShowUndo(false);
    setQueue(prev => [lastAction.lead, ...(Array.isArray(prev) ? prev : [])]);
    try {
      await signedRequest("MARK_SENT", {
        client_id: clientId,
        lead_id: lastAction.lead.lead_id, // ✅ Uses lead_id
        outcome: "UNDO"
      });
    } catch (e) {
      console.error("Undo failed:", e);
    } finally {
      setIsProcessing(false);
    }
    setLastAction(null);
  };

  const handlePause = () => {
    const position = {
      leadId: active.lead_id, // ✅ Uses lead_id
      timestamp: Date.now(),
      queueSnapshot: safeQueue.map(l => l.lead_id) // ✅ Uses lead_id
    };
    
    safeStorage.setItem(`queue_position_${clientId}`, JSON.stringify(position));
    
    if (window.confirm("Pause calling? You can resume anytime from the menu.")) {
      onBack();
    }
  };

  const handleAction = async (type) => {
    vibrate();
    if (type === 'call') {
      window.location.href = `tel:${active.phone}`;
    } else if (type === 'email') {
      const s = encodeURIComponent(`Re: ${active.context || "Connect"}`);
      const b = encodeURIComponent(msg);
      window.location.href = `mailto:${active.email}?subject=${s}&body=${b}`;
      submitAction("Emailed");
    } else if (type === 'share') {
      if (navigator.share) {
        await navigator.share({
          title: 'Lead',
          text: `${active.name} ${active.phone}`
        });
      }
    } else {
      window.open(`https://wa.me/${active.phone}?text=${encodeURIComponent(msg)}`);
    }
    if (type !== 'email') setMode("disposition");
  };

  const handleRewrite = async (tone) => {
    setIsProcessing(true);
    setPolyglot(false);
    try {
      const res = await signedRequest("AI_REWRITE_MSG", {
        client_id: clientId,
        context: active.context,
        current_msg: msg,
        tone
      });
      const json = await res.json();
      if (json.data) setMsg(json.data);
    } catch (e) {
      alert("AI rewrite failed");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSnooze = (days) => {
    vibrate();
    const d = new Date();
    d.setDate(d.getDate() + days);
    const isoDate = d.toISOString().replace(/-|:|\.\d+/g, "");
    const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=Call ${active.name}&dates=${isoDate}/${isoDate}`;
    window.open(url, '_blank');
    submitAction("Snoozed");
  };

  if (!active) {
    return (
      <div className="flex items-center justify-center h-screen">
        <h2 className="text-2xl font-bold">Queue Finished!</h2>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-slate-100 overflow-hidden relative">
      <AnimatePresence>
        {showUndo && (
          <motion.div 
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -100, opacity: 0 }}
            className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3"
          >
            <CheckCircle2 size={16} className="text-green-400"/>
            <span className="font-bold text-sm">Lead marked</span>
            <button 
              onClick={handleUndo}
              disabled={isProcessing}
              className="ml-2 bg-white text-gray-900 px-3 py-1 rounded-full text-xs font-bold hover:bg-gray-100 disabled:opacity-50"
            >
              UNDO
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {isProcessing && (
        <div className="absolute inset-0 bg-black/20 z-40 flex items-center justify-center">
          <div className="bg-white rounded-2xl p-4 shadow-xl">
            <div className="animate-spin rounded-full h-8 w-8 border-4 border-blue-600 border-t-transparent"></div>
          </div>
        </div>
      )}

      <div className="p-4 z-10 flex justify-between items-center">
        <button 
          onClick={() => {
            if (isProcessing) {
              alert("Action in progress");
              return;
            }
            if (window.confirm("Exit calling queue?")) onBack();
          }} 
          className="p-2 bg-white rounded-full shadow-sm"
        >
          <ArrowLeft/>
        </button>
        
        <button 
          onClick={handlePause}
          className="p-2 bg-orange-100 text-orange-600 rounded-full shadow-sm hover:bg-orange-200"
        >
          <Pause size={20}/>
        </button>
        
        <div className="text-xs font-bold bg-white px-3 py-1 rounded-full shadow-sm text-gray-500">
          {safeQueue.findIndex(l => l.lead_id === active.lead_id) + 1} / {safeQueue.length}
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-4">
        <AnimatePresence mode='wait'>
          {mode === 'card' ? (
            <motion.div 
              key="card" 
              animate={controls} 
              className="bg-white w-full max-w-sm rounded-3xl shadow-xl overflow-hidden flex flex-col h-[75vh] border border-gray-100 relative"
            >
              {polyglot && (
                <div className="absolute top-16 right-4 bg-white shadow-xl border rounded-xl p-2 z-20 flex flex-col gap-2">
                  <button 
                    onClick={() => handleRewrite('Professional')} 
                    disabled={isProcessing} 
                    className="text-xs font-bold p-2 hover:bg-gray-50 text-left disabled:opacity-50"
                  >
                    👔 Professional
                  </button>
                  <button 
                    onClick={() => handleRewrite('Friendly')} 
                    disabled={isProcessing} 
                    className="text-xs font-bold p-2 hover:bg-gray-50 text-left disabled:opacity-50"
                  >
                    👋 Friendly
                  </button>
                </div>
              )}

              <div className="p-6 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-100">
                <h2 className="text-2xl font-bold truncate text-gray-800">{active.name}</h2>
                <p className="text-blue-600 font-mono font-medium">{active.phone}</p>
                <div className="flex flex-wrap gap-1 mt-2">
                  {active.designation && <span className="text-[10px] bg-white text-gray-600 px-2 py-1 rounded border flex items-center gap-1"><Briefcase size={10}/> {active.designation}</span>}
                  {active.company && <span className="text-[10px] bg-white text-gray-600 px-2 py-1 rounded border flex items-center gap-1"><Building2 size={10}/> {active.company}</span>}
                  {active.email && <span className="text-[10px] bg-white text-gray-600 px-2 py-1 rounded border flex items-center gap-1"><Mail size={10}/> {active.email}</span>}
                  {active.website && <span className="text-[10px] bg-white text-gray-600 px-2 py-1 rounded border flex items-center gap-1"><Globe size={10}/> {active.website}</span>}
                </div>
              </div>

              <div className="p-4 flex-1 bg-white flex flex-col relative">
                <div className="flex justify-between items-center mb-2">
                  <label className="text-xs font-bold text-gray-400 uppercase">Message</label>
                  <button 
                    onClick={() => setPolyglot(!polyglot)} 
                    disabled={isProcessing} 
                    className="text-purple-600 disabled:opacity-50"
                  >
                    <Wand2 size={16}/>
                  </button>
                </div>
                <textarea 
                  key={active.lead_id}
                  value={msg} 
                  onChange={e => setMsg(e.target.value)} 
                  disabled={isProcessing} 
                  className="w-full flex-1 bg-gray-50 p-4 rounded-xl outline-none resize-none text-sm text-gray-700 focus:ring-2 focus:ring-blue-100 transition-all disabled:opacity-50"
                />
              </div>

              <div className="p-4 grid grid-cols-4 gap-2 bg-white border-t">
                <button 
                  onClick={() => handleAction('call')} 
                  disabled={isProcessing} 
                  className="bg-gray-900 text-white p-3 rounded-xl font-bold flex flex-col items-center justify-center gap-1 disabled:opacity-50"
                >
                  <Phone size={20}/>
                  <span className="text-[8px]">Call</span>
                </button>
                <button 
                  onClick={() => handleAction('wa')} 
                  disabled={isProcessing} 
                  className="bg-green-600 text-white p-3 rounded-xl font-bold flex flex-col items-center justify-center gap-1 disabled:opacity-50"
                >
                  <Zap size={20}/>
                  <span className="text-[8px]">WA</span>
                </button>
                {active.email ? (
                  <button 
                    onClick={() => handleAction('email')} 
                    disabled={isProcessing} 
                    className="bg-blue-600 text-white p-3 rounded-xl font-bold flex flex-col items-center justify-center gap-1 disabled:opacity-50"
                  >
                    <Mail size={20}/>
                    <span className="text-[8px]">Mail</span>
                  </button>
                ) : (
                  <button 
                    disabled 
                    className="bg-gray-200 text-gray-400 p-3 rounded-xl font-bold flex flex-col items-center justify-center gap-1"
                  >
                    <Mail size={20}/>
                    <span className="text-[8px]">No Mail</span>
                  </button>
                )}
                <button 
                  onClick={() => handleAction('share')} 
                  disabled={isProcessing} 
                  className="bg-pink-600 text-white p-3 rounded-xl font-bold flex flex-col items-center justify-center gap-1 disabled:opacity-50"
                >
                  <Share2 size={20}/>
                  <span className="text-[8px]">Share</span>
                </button>
              </div>

              <div className="px-4 pb-4 flex gap-2">
                <button 
                  onClick={() => setMode("snooze")} 
                  disabled={isProcessing} 
                  className="flex-1 bg-gray-100 text-gray-500 py-3 rounded-xl font-bold text-xs disabled:opacity-50"
                >
                  Snooze
                </button>
                <button 
                  onClick={() => next()} 
                  disabled={isProcessing} 
                  className="flex-1 bg-gray-100 text-red-400 py-3 rounded-xl font-bold text-xs disabled:opacity-50"
                >
                  Skip
                </button>
              </div>
            </motion.div>
          ) : mode === 'snooze' ? (
            <motion.div
              key="snooze"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white w-full max-w-sm rounded-3xl shadow-xl p-8 flex flex-col justify-center items-center gap-4"
            >
              <h3 className="font-bold">Snooze until...</h3>
              <button 
                onClick={() => handleSnooze(1)} 
                disabled={isProcessing} 
                className="w-full p-4 bg-purple-50 text-purple-700 rounded-xl font-bold disabled:opacity-50"
              >
                Tomorrow
              </button>
              <button 
                onClick={() => handleSnooze(3)} 
                disabled={isProcessing} 
                className="w-full p-4 bg-purple-50 text-purple-700 rounded-xl font-bold disabled:opacity-50"
              >
                3 Days
              </button>
              <button onClick={() => setMode("card")} className="mt-4 text-sm text-gray-400">
                Cancel
              </button>
            </motion.div>
          ) : (
            <motion.div 
              key="disp" 
              initial={{opacity: 0, scale: 0.9}} 
              animate={{opacity: 1, scale: 1}} 
              className="bg-white w-full max-w-sm rounded-3xl shadow-xl p-8 flex flex-col justify-center items-center gap-4 border border-gray-200"
            >
              <h3 className="text-xl font-bold mb-4 text-gray-800">How did it go?</h3>
              <button 
                onClick={() => submitAction("Interested")} 
                disabled={isProcessing} 
                className="w-full p-4 bg-green-100 text-green-700 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-green-200 disabled:opacity-50"
              >
                <ThumbsUp/> Interested
              </button>
              <button 
                onClick={() => submitAction("No Answer")} 
                disabled={isProcessing} 
                className="w-full p-4 bg-gray-100 text-gray-700 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-gray-200 disabled:opacity-50"
              >
                <Snowflake/> No Answer
              </button>
              <button 
                onClick={() => submitAction("Hot")} 
                disabled={isProcessing} 
                className="w-full p-4 bg-orange-100 text-orange-600 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-orange-200 disabled:opacity-50"
              >
                <Flame/> Hot Lead
              </button>
              <button onClick={() => setMode("card")} className="mt-4 text-sm text-gray-400">
                Cancel
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function HotList({ clientId, onBack }) {
   const [leads, setLeads] = useState([]);
   const [loading, setLoading] = useState(true);
   useEffect(() => { signedRequest("GET_HOTLIST", { client_id: clientId }).then(r => r.json()).then(j => { setLeads(j.data || []); setLoading(false); }); }, [clientId]);
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
               <div><h3 className="font-bold text-gray-800">{lead.name}</h3><p className="text-blue-600 font-mono text-sm">{lead.phone}</p></div>
               <a href={`tel:${lead.phone}`} className="bg-green-100 text-green-700 p-2 rounded-full"><Phone size={18}/></a>
             </div>
           ))
         )}
       </div>
     </div>
   );
}

function CameraScan({ onBack, onScanComplete, clientId }) {
    const fileInput = useRef(null); 
    const [images, setImages] = useState([]); 
    const [scanning, setScanning] = useState(false);
    const [scanResult, setScanResult] = useState(null);
    
    useBackButtonHandler(
      () => {
        if (scanning) {
          alert("Please wait for scanning to complete");
          return;
        }
        onBack();
      },
      scanning,
      "AI is still scanning. Wait?"
    );
    
    const handleFile = (e) => { 
      const file = e.target.files[0]; 
      if(!file) return; 
      const reader = new FileReader(); 
      reader.onload = (ev) => { 
        const img = new Image(); 
        img.onload = () => { 
          const cvs = document.createElement('canvas'); 
          const scale = 800 / img.width; 
          cvs.width = 800; 
          cvs.height = img.height * scale; 
          cvs.getContext('2d').drawImage(img, 0, 0, cvs.width, cvs.height); 
          const b64 = cvs.toDataURL('image/jpeg', 0.7).split(',')[1]; 
          setImages(prev => [...prev, b64]); 
        }; 
        img.src = ev.target.result; 
      }; 
      reader.readAsDataURL(file); 
    };
    
    const processImages = async () => { 
      setScanning(true); 
      
      try {
        const res = await signedRequest("AI_ANALYZE_IMAGE", { client_id: clientId, images });
        const json = await res.json();
        
        if (json.status === 'success' && json.data) {
          const validation = ValidationUtils.aiCardData(json.data);
          
          if (!validation.valid) {
            alert(`⚠️ Card scan issue: ${validation.error || validation.warning}\n\nPlease verify the data carefully or try scanning again.`);
          }
          
          setScanResult({ ...json.data, hasWarning: !!validation.warning });
        } else {
          alert("Could not read card. Try better lighting or manual entry."); 
        }
      } catch (err) {
        alert("Scan failed: " + err.message);
      } finally {
        setScanning(false);
      }
    };

    const handleScanAnother = () => {
      setImages([]);
      setScanResult(null);
      if (fileInput.current) {
        fileInput.current.value = "";
      }
    };

    const handleUseResult = () => {
      onScanComplete(scanResult);
    };
    
    if (scanResult) {
      return (
        <div className="h-screen bg-white flex flex-col p-6">
          <button onClick={onBack} className="mb-6 text-gray-500 self-start"><ArrowLeft/></button>
          
          <div className="flex-1 flex flex-col items-center justify-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <CheckCircle2 size={32} className="text-green-600"/>
            </div>
            
            <h2 className="text-2xl font-bold mb-2 text-gray-900">Card Scanned!</h2>
            <p className="text-gray-500 mb-8 text-center">Review the extracted information</p>
            
            {scanResult.hasWarning && (
              <div className="w-full max-w-sm bg-yellow-100 border-l-4 border-yellow-500 p-3 mb-4 rounded">
                <p className="text-sm text-yellow-800 font-bold">⚠️ Please verify this data</p>
                <p className="text-xs text-yellow-700">AI detected potentially generic information</p>
              </div>
            )}
            
            <div className="w-full max-w-sm bg-gray-50 rounded-2xl p-6 mb-6 space-y-3">
              <div><span className="text-xs text-gray-500 uppercase font-bold">Name</span><p className="font-bold text-lg">{scanResult.name}</p></div>
              <div><span className="text-xs text-gray-500 uppercase font-bold">Phone</span><p className="font-mono">{scanResult.phone}</p></div>
              {scanResult.email && <div><span className="text-xs text-gray-500 uppercase font-bold">Email</span><p className="text-sm">{scanResult.email}</p></div>}
              {scanResult.company && <div><span className="text-xs text-gray-500 uppercase font-bold">Company</span><p className="text-sm">{scanResult.company}</p></div>}
              {scanResult.designation && <div><span className="text-xs text-gray-500 uppercase font-bold">Designation</span><p className="text-sm">{scanResult.designation}</p></div>}
              {scanResult.context && <div><span className="text-xs text-gray-500 uppercase font-bold">Notes</span><p className="text-sm text-gray-600">{scanResult.context}</p></div>}
            </div>

            <div className="w-full max-w-sm space-y-3">
              <button 
                onClick={handleUseResult}
                className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold shadow-lg hover:bg-blue-700 transition-colors"
              >
                Continue with This Data
              </button>
              <button 
                onClick={handleScanAnother}
                className="w-full bg-gray-100 text-gray-700 py-4 rounded-xl font-bold hover:bg-gray-200 transition-colors"
              >
                Scan Another Card
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="h-screen bg-black flex flex-col items-center justify-center text-white p-6 text-center">
        {scanning ? (
          <div className="flex flex-col items-center animate-in fade-in">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-orange-500 border-t-transparent mb-4"></div>
            <p className="font-bold">AI Analyzing...</p>
            <p className="text-xs text-gray-400 mt-2">Please wait, don't go back</p>
          </div>
        ) : (
          <>
            <Camera size={64} className="mb-6 text-orange-500"/>
            <h2 className="text-2xl font-bold mb-2">Scan Business Card</h2>
            <p className="text-gray-400 text-sm mb-8">Capture both sides for best results</p>
            
            <div className="flex gap-2 mb-8">
              <div className={`w-3 h-3 rounded-full transition-colors ${images.length >= 1 ? 'bg-green-500' : 'bg-gray-700'}`}></div>
              <div className={`w-3 h-3 rounded-full transition-colors ${images.length >= 2 ? 'bg-green-500' : 'bg-gray-700'}`}></div>
            </div>

            {images.length === 0 && <button onClick={() => fileInput.current.click()} className="w-full bg-orange-600 py-4 rounded-xl font-bold text-lg hover:bg-orange-700 transition-colors">Capture Front</button>}
            {images.length === 1 && (
              <div className="space-y-3 w-full">
                <button onClick={() => fileInput.current.click()} className="w-full bg-gray-800 border border-gray-600 py-4 rounded-xl font-bold text-lg hover:bg-gray-700 transition-colors">Capture Back (Optional)</button>
                <button onClick={processImages} className="w-full bg-green-600 py-4 rounded-xl font-bold text-lg hover:bg-green-700 transition-colors">Analyze Card</button>
              </div>
            )}
            {images.length === 2 && <button onClick={processImages} className="w-full bg-green-600 py-4 rounded-xl font-bold text-lg hover:bg-green-700 transition-colors">Analyze Both Sides</button>}
            <button 
              onClick={() => {
                if (images.length > 0 && !window.confirm("Discard captured images?")) return;
                onBack();
              }} 
              className="mt-6 font-bold text-gray-500"
            >
              Cancel
            </button>
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
    const [errors, setErrors] = useState({});
    const [selectedLeads, setSelectedLeads] = useState(new Set());
    
    const hasUnsavedChanges = text.trim().length > 0 || parsed.length > 0;
    
    // ADDED: Back button protection
    useBackButtonHandler(
      () => {
        if (loading) return; // Prevent during AI processing
        onBack();
      },
      hasUnsavedChanges,
      "Discard parsed leads?"
    );
    
    useEffect(() => {
      if (parsed.length > 0 && selectedLeads.size === 0) {
        setSelectedLeads(new Set(parsed.map((_, i) => i)));
      }
    }, [parsed]);

    // ADDED: Warn on refresh
    useEffect(() => {
      if (!hasUnsavedChanges) return;
      const handleBeforeUnload = (e) => {
        e.preventDefault();
        e.returnValue = '';
      };
      window.addEventListener('beforeunload', handleBeforeUnload);
      return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [hasUnsavedChanges]);

    const handleAI = async () => { 
      if(!text) return; 
      setLoading(true); 
      try { 
        const res = await signedRequest("AI_PARSE_TEXT", { client_id: clientId, text }); 
        const json = await res.json(); 
        if(json.data && json.data.length > 0) {
          setParsed(json.data);
          setSelectedLeads(new Set(json.data.map((_, i) => i)));
        } else {
          alert("No leads found."); 
        }
      } catch(e) { 
        alert("AI Error: " + e.message); 
      } finally { 
        setLoading(false); 
      } 
    };

    const toggleSelect = (index) => {
      const newSelected = new Set(selectedLeads);
      if (newSelected.has(index)) {
        newSelected.delete(index);
      } else {
        newSelected.add(index);
      }
      setSelectedLeads(newSelected);
    };

    const handleSubmit = () => {
      if (selectedLeads.size === 0) {
        alert("Please select at least one lead");
        return;
      }

      const newErrors = {};
      const leadsToSubmit = [];
      
      parsed.forEach((l, i) => {
        if (!selectedLeads.has(i)) return;
        
        if (!l.name || !l.name.trim()) newErrors[`${i}-name`] = true;
        if (!ValidationUtils.phone(l.phone)) newErrors[`${i}-phone`] = true;
        if (l.email && !ValidationUtils.email(l.email)) newErrors[`${i}-email`] = true;
        
        if (!newErrors[`${i}-name`] && !newErrors[`${i}-phone`]) {
          leadsToSubmit.push(l);
        }
      });
      
      if (Object.keys(newErrors).length > 0) {
        setErrors(newErrors);
        alert("Please fix highlighted fields in selected leads");
        return;
      }
      
      onSubmit(leadsToSubmit);
    };
    
    if(parsed.length > 0) return (
      <div className="h-screen flex flex-col bg-gray-50">
        <div className="p-4 bg-white border-b flex justify-between items-center shadow-sm sticky top-0 z-10">
          <button 
            onClick={() => {
              if (window.confirm("Discard parsed leads?")) {
                setParsed([]);
              }
            }} 
            className="text-gray-500 flex items-center gap-1"
          >
            <ArrowLeft size={16}/> Retry
          </button>
          <h2 className="font-bold text-gray-800">
            {selectedLeads.size} of {parsed.length} Selected
          </h2>
          <button 
            onClick={() => {
              if (selectedLeads.size === parsed.length) {
                setSelectedLeads(new Set());
              } else {
                setSelectedLeads(new Set(parsed.map((_, i) => i)));
              }
            }}
            className="text-blue-600 text-sm font-bold"
          >
            {selectedLeads.size === parsed.length ? "Deselect All" : "Select All"}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {parsed.map((l, i) => {
            const isSelected = selectedLeads.has(i);
            return (
              <div key={i} className={`p-3 rounded-xl border shadow-sm transition-all ${isSelected ? 'bg-white border-blue-500' : 'bg-gray-100 border-gray-200 opacity-60'}`}>
                <div className="flex items-center gap-3 mb-3">
                  <button
                    onClick={() => toggleSelect(i)}
                    className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-colors ${isSelected ? 'bg-blue-600 border-blue-600' : 'border-gray-300'}`}
                  >
                    {isSelected && <CheckCircle2 size={16} className="text-white"/>}
                  </button>
                  <span className="font-bold text-sm text-gray-500">Lead #{i + 1}</span>
                </div>

                <div className={`space-y-2 ${!isSelected && 'pointer-events-none'}`}>
                  <input 
                    value={l.name} 
                    onChange={e => {const n=[...parsed];n[i].name=e.target.value;setParsed(n);setErrors(prev=>({...prev,[`${i}-name`]:false}))}} 
                    className={`font-bold w-full outline-none text-gray-800 border-b p-2 ${errors[`${i}-name`] ? 'border-red-500 bg-red-50' : 'border-transparent focus:border-blue-500'}`}
                    placeholder="Name *"
                  />
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400 text-xs">📱</span>
                    <input 
                      value={l.phone} 
                      onChange={e => {const n=[...parsed];n[i].phone=e.target.value;setParsed(n);setErrors(prev=>({...prev,[`${i}-phone`]:false}))}} 
                      className={`text-sm font-mono w-full outline-none p-2 border-b ${errors[`${i}-phone`] ? 'border-red-500 bg-red-50 text-red-600' : 'text-gray-600 border-transparent focus:border-blue-500'}`}
                      placeholder="Phone *"
                    />
                  </div>
                  <input 
                    value={l.email||""} 
                    placeholder="Email" 
                    onChange={e => {const n=[...parsed];n[i].email=e.target.value;setParsed(n);setErrors(prev=>({...prev,[`${i}-email`]:false}))}} 
                    className={`text-xs w-full outline-none p-2 border-b ${errors[`${i}-email`] ? 'border-red-500 bg-red-50' : 'border-gray-100 focus:border-blue-500'}`}
                  />
                  <input value={l.company||""} placeholder="Company" onChange={e => {const n=[...parsed];n[i].company=e.target.value;setParsed(n)}} className="text-xs w-full outline-none text-gray-500 border-b border-gray-100 focus:border-blue-500 p-2"/>
                  <input value={l.website||""} placeholder="Website" onChange={e => {const n=[...parsed];n[i].website=e.target.value;setParsed(n)}} className="text-xs w-full outline-none text-gray-500 border-b border-gray-100 focus:border-blue-500 p-2"/>
                  <input value={l.designation||""} placeholder="Designation" onChange={e => {const n=[...parsed];n[i].designation=e.target.value;setParsed(n)}} className="text-xs w-full outline-none text-gray-500 border-b border-gray-100 focus:border-blue-500 p-2"/>
                  <textarea 
                    value={l.context||""} 
                    placeholder="Notes / Context" 
                    onChange={e => {const n=[...parsed];n[i].context=e.target.value;setParsed(n)}} 
                    className="text-xs w-full outline-none text-gray-600 bg-gray-50 border border-gray-200 focus:border-blue-500 rounded-lg p-2 min-h-[60px] resize-none"
                  />
                </div>
              </div>
            );
          })}
        </div>

        <div className="p-4 bg-white border-t">
          <button 
            onClick={handleSubmit} 
            disabled={selectedLeads.size === 0}
            className="w-full bg-green-600 text-white py-4 rounded-xl font-bold shadow-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Save {selectedLeads.size} Selected Lead{selectedLeads.size !== 1 ? 's' : ''}
          </button>
        </div>
      </div>
    );
    
    return (
      <div className="h-screen bg-white p-6 flex flex-col">
        <button 
          onClick={() => {
            if (hasUnsavedChanges && !window.confirm("Discard text?")) return;
            onBack();
          }} 
          className="mb-4 text-gray-500"
        >
          <ArrowLeft/>
        </button>
        <h1 className="text-2xl font-black mb-2 text-gray-800">AI Paste</h1>
        <p className="text-gray-500 mb-4 text-sm">Paste messy text, Excel rows, or WhatsApp forwards here.</p>
        <textarea value={text} onChange={e => setText(e.target.value)} placeholder="e.g. John 9888822222..." className="flex-1 bg-gray-50 p-4 rounded-xl mb-4 resize-none outline-none border focus:border-blue-500 transition-colors"/>
        <button onClick={handleAI} disabled={loading || !text} className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white py-4 rounded-xl font-bold disabled:opacity-50 shadow-lg flex items-center justify-center gap-2">{loading ? "AI is Thinking..." : <><Wand2 size={20}/> Extract Leads</>}</button>
      </div>
    );
}

function ManualForm({ prefill, onBack, onSubmit }) {
  const initialState = { 
    name: '', 
    phone: '', 
    email: '', 
    company: '', 
    website: '', 
    designation: '', 
    context: '' 
  };
  
  const [form, setForm] = useState(initialState); 
  const [listening, setListening] = useState(false);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [phoneType, setPhoneType] = useState('mobile');
  
  const hasUnsavedChanges = useUnsavedChanges(form, initialState);
  
  useBackButtonHandler(
    () => {
      if (submitting) return;
      onBack();
    },
    hasUnsavedChanges,
    "You have unsaved changes. Discard?"
  );
  
  useEffect(() => {
    if (prefill) {
      setForm(prefill);
    }
  }, []);

  useEffect(() => {
    const digits = String(form.phone).replace(/\D/g, '');
    if (digits.startsWith('0') && digits.length === 11) {
      setPhoneType('landline');
    } else {
      setPhoneType('mobile');
    }
  }, [form.phone]);
  
  const toggleMic = () => { 
    if (!('webkitSpeechRecognition' in window)) return alert("Voice not supported"); 
    const recognition = new window.webkitSpeechRecognition(); 
    recognition.onstart = () => setListening(true); 
    recognition.onend = () => setListening(false); 
    recognition.onresult = (e) => setForm(f => ({...f, context: f.context + " " + e.results[0][0].transcript})); 
    recognition.start(); 
  };

  const checkDuplicate = async (phone) => {
    try {
      const res = await signedRequest("CHECK_DUPLICATE", {
        client_id: window.clientId || safeStorage.getItem("thrivoy_client_id"),
        phone: phone
      });
      const json = await res.json();
      return json.exists;
    } catch (e) {
      return false;
    }
  };

  const handleSubmit = async () => {
    const newErrors = {};
    if (!form.name || !form.name.trim()) newErrors.name = "Name is required";
    if (!ValidationUtils.phone(form.phone)) newErrors.phone = "Invalid phone number (10-13 digits)";
    if (form.email && !ValidationUtils.email(form.email)) newErrors.email = "Invalid email format";
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    
    const isDuplicate = await checkDuplicate(form.phone);
    if (isDuplicate) {
      if (!window.confirm("⚠️ This number already exists in your queue. Add anyway?")) {
        return;
      }
    }
    
    setSubmitting(true);
    try {
      await onSubmit(form);
      setForm(initialState);
      setErrors({});
      vibrate(100);
    } catch (e) {
      if (e.message.includes('Rate Limit')) {
        alert('⏳ Too many requests. Please wait 1 minute and try again.');
      } else if (e.message.includes('Network')) {
        alert('📡 Connection error. Check your internet and try again.');
      } else {
        alert('❌ Something went wrong: ' + e.message);
      }
    } finally {
      setSubmitting(false);
    }
  };
  
  useEffect(() => {
    if (!hasUnsavedChanges) return;
    
    const handleBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);
  
  return (
    <div className="p-6 bg-white h-screen overflow-y-auto">
      <button 
        onClick={() => {
          if (submitting) return;
          if (hasUnsavedChanges && !window.confirm("Discard unsaved changes?")) return;
          onBack();
        }} 
        className="mb-6 text-gray-500 flex items-center gap-2"
        aria-label="Go back to menu"
      >
        <ArrowLeft/> 
        {hasUnsavedChanges && <span className="text-orange-600 text-xs font-bold">• Unsaved</span>}
      </button>
      
      <h1 className="text-2xl font-bold mb-6 text-gray-800">Add Lead</h1>
      <div className="space-y-4">
        <div>
          <input 
            value={form.name}
            onChange={e => {
              setForm({...form, name: e.target.value});
              setErrors(prev => ({...prev, name: null}));
            }}
            placeholder="Name *"
            className={`w-full p-4 bg-gray-50 rounded-xl border outline-none focus:border-blue-500 ${errors.name ? 'border-red-500 bg-red-50' : ''}`}
            aria-label="Lead name"
          />
          {errors.name && <p className="text-red-600 text-xs mt-1 ml-2">{errors.name}</p>}
        </div>
        
        <div>
          <input 
            value={form.phone} 
            onChange={e => {
              setForm({...form, phone: e.target.value});
              setErrors(prev => ({...prev, phone: null}));
            }} 
            placeholder="Phone * (10 digits)" 
            type="tel"
            className={`w-full p-4 bg-gray-50 rounded-xl border outline-none focus:border-blue-500 ${errors.phone ? 'border-red-500 bg-red-50' : ''}`}
            aria-label="Lead phone number"
          />
          {errors.phone && <p className="text-red-600 text-xs mt-1 ml-2">{errors.phone}</p>}
          
          <div className="flex gap-2 mt-2 text-xs">
            <button
              type="button"
              onClick={() => setPhoneType('mobile')}
              className={`px-3 py-1 rounded-lg transition-colors ${phoneType === 'mobile' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'}`}
            >
              📱 Mobile
            </button>
            <button
              type="button"
              onClick={() => setPhoneType('landline')}
              className={`px-3 py-1 rounded-lg transition-colors ${phoneType === 'landline' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'}`}
            >
              ☎️ Landline
            </button>
          </div>
        </div>

        <div>
          <input 
            value={form.email || ""} 
            onChange={e => {
              setForm({...form, email: e.target.value});
              setErrors(prev => ({...prev, email: null}));
            }} 
            placeholder="Email (optional)" 
            type="email"
            className={`w-full p-4 bg-gray-50 rounded-xl border outline-none focus:border-blue-500 ${errors.email ? 'border-red-500 bg-red-50' : ''}`}
            aria-label="Lead email address"
          />
          {errors.email && <p className="text-red-600 text-xs mt-1 ml-2">{errors.email}</p>}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <input 
            value={form.company || ""} 
            onChange={e => setForm({...form, company: e.target.value})} 
            placeholder="Company" 
            className="w-full p-4 bg-gray-50 rounded-xl border outline-none focus:border-blue-500"
            aria-label="Company name"
          />
          <input 
            value={form.website || ""} 
            onChange={e => setForm({...form, website: e.target.value})} 
            placeholder="Website" 
            className="w-full p-4 bg-gray-50 rounded-xl border outline-none focus:border-blue-500"
            aria-label="Company website"
          />
        </div>
        
        <input 
          value={form.designation || ""} 
          onChange={e => setForm({...form, designation: e.target.value})} 
          placeholder="Designation (e.g. Sales Manager)" 
          className="w-full p-4 bg-gray-50 rounded-xl border outline-none focus:border-blue-500"
          aria-label="Job designation"
        />
        
        <div className="relative">
          <textarea 
            value={form.context || ""} 
            onChange={e => setForm({...form, context: e.target.value})} 
            placeholder="Notes / Context" 
            className="w-full p-4 pr-12 bg-gray-50 rounded-xl border outline-none focus:border-blue-500 min-h-[100px] resize-none"
            aria-label="Notes and context about the lead"
          />
          <button 
            onClick={toggleMic} 
            className={`absolute right-2 top-2 p-2 rounded-full ${listening ? 'bg-red-500 text-white animate-pulse' : 'bg-gray-200 text-gray-600'}`}
            aria-label={listening ? "Recording voice input" : "Start voice input"}
          >
            <Mic size={20}/>
          </button>
        </div>
        
        <button 
          onClick={handleSubmit} 
          disabled={submitting}
          className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold mt-4 shadow-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          {submitting ? "Saving..." : "Save to Queue"}
        </button>
      </div>
    </div>
  );
}

function SettingsForm({ template, setTemplate, library, setLibrary, userProfile, setUserProfile, clientId, onBack, onLogout }) {
    const [newName, setNewName] = useState("");
    const [form, setForm] = useState({ 
      title: userProfile.title||"", 
      photo: userProfile.photo||"", 
      slug: userProfile.slug||"", 
      pin: userProfile.pin||"", 
      instagram: userProfile.socials?.instagram||"", 
      linkedin: userProfile.socials?.linkedin||"", 
      website: userProfile.website||"" 
    });
    const [pinError, setPinError] = useState("");
    const [showPinGenerator, setShowPinGenerator] = useState(false);
    
    // ✅ ADD THIS: Check if user is Pro
    const isPro = userProfile?.plan === "Pro";
    
    const saveProfile = async () => {
      // Validate PIN
      if (form.pin && !ValidationUtils.pin(form.pin)) {
        setPinError("PIN must be exactly 4 digits");
        return;
      }

      const socials = { instagram: form.instagram, linkedin: form.linkedin }; 
      await signedRequest("UPDATE_PROFILE", { 
        client_id: clientId, 
        title: form.title, 
        photo: form.photo, 
        slug: form.slug, 
        pin: form.pin, 
        website: form.website, 
        socials: socials 
      }); 
      alert("Profile Saved!"); 
      setUserProfile({...userProfile, ...form, socials}); 
    };

    const saveTemplate = () => {
      safeStorage.setItem(`tpl_${clientId}`, template);
      safeStorage.setItem(`lib_${clientId}`, JSON.stringify(library));
      alert("Templates Saved!");
    };

    const generateRandomPin = () => {
      const newPin = String(Math.floor(1000 + Math.random() * 9000));
      setForm({...form, pin: newPin});
      setPinError("");
      setShowPinGenerator(false);
    };
    
    const handleLogout = () => { if (confirm("Log out?")) onLogout(); };
    
    return (
        <div className="p-6 bg-white h-screen overflow-y-auto">
           <div className="flex justify-between items-center mb-6">
             <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full transition-colors"><ArrowLeft/></button>
             <button onClick={handleLogout} className="text-red-500 font-bold flex items-center gap-1 hover:bg-red-50 px-3 py-1 rounded-lg transition-colors"><LogOut size={16}/> Logout</button>
           </div>
           <h1 className="text-2xl font-bold mb-6">Settings</h1>
           
           {/* ✅ FIXED: Show correct plan status */}
           <div className={`mb-8 p-4 border-2 rounded-xl ${isPro ? 'border-green-200 bg-green-50' : 'border-green-200 bg-green-50'}`}>
             <h3 className="font-bold mb-4 flex items-center gap-2">
               <CreditCard size={16} className={isPro ? "text-green-600" : "text-green-600"}/> 
               {isPro ? "Subscription Status" : "Upgrade to Pro"}
             </h3>
             
             {isPro ? (
               <div className="text-center py-4">
                 <CheckCircle2 size={48} className="text-green-600 mx-auto mb-2"/>
                 <p className="font-bold text-green-700">Pro Plan Active</p>
                 <p className="text-sm text-gray-600 mt-1">Unlimited leads & full AI features</p>
               </div>
             ) : (
               <>
                 <div className="mb-4 space-y-2 text-sm">
                   <div className="flex justify-between"><span>✓ Unlimited Leads</span><span className="font-bold">₹999/mo</span></div>
                   <div className="flex justify-between"><span>✓ AI Rewriting</span></div>
                 </div>
                 <button onClick={() => window.open(`https://wa.me/917892159170?text=Upgrade Request%0AClient ID: ${clientId}`)} className="w-full bg-green-600 text-white py-3 rounded-xl font-bold">Contact to Upgrade</button>
                 <p className="text-xs text-gray-500 mt-2 text-center">Pay via UPI • Instant activation</p>
               </>
             )}
           </div>
           
           <div className="mb-8 p-4 border rounded-xl bg-gray-50">
             <h3 className="font-bold mb-4 flex items-center gap-2 text-blue-600"><Briefcase size={16}/> Public Profile</h3>
             <div className="space-y-2">
               <input value={form.title} onChange={e=>setForm({...form, title: e.target.value})} placeholder="Job Title" className="w-full p-2 rounded border text-sm outline-none"/>
               <input value={form.photo} onChange={e=>setForm({...form, photo: e.target.value})} placeholder="Photo URL" className="w-full p-2 rounded border text-sm outline-none"/>
               <div className="relative">
                 <span className="absolute left-2 top-2 text-gray-400 text-sm">thrivoy.pages.dev/</span>
                 <input value={form.slug} onChange={e=>setForm({...form, slug: e.target.value.replace(/[^a-z0-9]/g,"")})} className="w-full p-2 pl-36 rounded border text-sm outline-none font-bold" placeholder="username"/>
               </div>
             </div>
           </div>
           
           <div className="mb-8 p-4 border rounded-xl bg-gray-50">
             <h3 className="font-bold mb-4 flex items-center gap-2 text-purple-600"><Share2 size={16}/> Social Links</h3>
             <div className="space-y-2">
               <input value={form.website} onChange={e=>setForm({...form, website: e.target.value})} placeholder="Website URL" className="w-full p-2 rounded border text-sm outline-none"/>
               <input value={form.linkedin} onChange={e=>setForm({...form, linkedin: e.target.value})} placeholder="LinkedIn URL" className="w-full p-2 rounded border text-sm outline-none"/>
               <input value={form.instagram} onChange={e=>setForm({...form, instagram: e.target.value})} placeholder="Instagram URL" className="w-full p-2 rounded border text-sm outline-none"/>
             </div>
           </div>
           
           <div className="mb-8 p-4 border rounded-xl bg-gray-50">
             <h3 className="font-bold mb-4 flex items-center gap-2 text-red-600"><KeyRound size={16}/> Security PIN</h3>
             <div className="space-y-3">
               <div>
                 <div className="flex gap-2">
                   <input 
                     type="text" 
                     inputMode="numeric"
                     maxLength={PIN_MAX_LENGTH}
                     value={form.pin} 
                     onChange={e=>{
                       const val = e.target.value.replace(/\D/g, '');
                       setForm({...form, pin: val});
                       setPinError("");
                     }}
                     onKeyDown={e => {
                       if (e.key === 'Enter' && form.pin.length === PIN_MAX_LENGTH) {
                         saveProfile();
                       }
                     }} 
                     placeholder="4-Digit PIN" 
                     className={`flex-1 p-2 rounded border text-sm outline-none font-mono tracking-widest text-center ${pinError ? 'border-red-500 bg-red-50' : ''}`}
                   />
                   <button 
                     onClick={() => setShowPinGenerator(true)}
                     className="px-4 py-2 bg-blue-100 text-blue-700 rounded font-bold text-sm hover:bg-blue-200 transition-colors"
                   >
                     Generate
                   </button>
                 </div>
                 {pinError && <p className="text-red-600 text-xs mt-1">{pinError}</p>}
               </div>
               <p className="text-xs text-gray-500">This PIN is required to access your workspace. Keep it safe!</p>
             </div>
           </div>
           
           <button onClick={saveProfile} className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold shadow-lg mb-8 hover:bg-blue-700 transition-colors">Save All Changes</button>
           
           <div className="mb-8">
             <h3 className="font-bold mb-2">Default Message Template</h3>
             <textarea value={template} onChange={e => setTemplate(e.target.value)} className="w-full h-24 p-4 bg-gray-50 rounded-xl mb-2 text-sm border outline-none focus:border-blue-500 transition-colors"/>
           </div>
           
           <div className="mb-8">
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

           <button onClick={saveTemplate} className="w-full bg-purple-600 text-white py-3 rounded-xl font-bold shadow-lg mb-4 hover:bg-purple-700 transition-colors">Save Templates</button>

           {showPinGenerator && (
             <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-6">
               <div className="bg-white p-6 rounded-2xl max-w-sm w-full">
                 <h3 className="font-bold mb-4 text-center">Generate New PIN</h3>
                 <p className="text-sm text-gray-600 mb-6 text-center">Generate a random 4-digit PIN for your workspace security.</p>
                 <div className="flex gap-2">
                   <button 
                     onClick={() => setShowPinGenerator(false)} 
                     className="flex-1 py-3 font-bold text-gray-500 border rounded-xl hover:bg-gray-50"
                   >
                     Cancel
                   </button>
                   <button 
                     onClick={generateRandomPin} 
                     className="flex-1 bg-blue-600 text-white rounded-xl font-bold py-3 hover:bg-blue-700"
                   >
                     Generate
                   </button>
                 </div>
               </div>
             </div>
           )}
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

function BioLinkCard({ profile }) {
    const [sent, setSent] = useState(false);
     
    const submit = (e) => {
       e.preventDefault();
       const data = { 
         name: e.target.name.value, 
         phone: e.target.phone.value, 
         context: "Digital Card Signup" 
       };
       signedRequest("ADD_LEADS", { client_id: profile.client_id, leads: [data] })
         .then(() => setSent(true));
    };

    if(sent) return (
      <div className="h-screen flex flex-col items-center justify-center p-10 text-center">
        <CheckCircle2 size={64} className="text-green-500 mb-4"/>
        <h1 className="text-2xl font-bold">Details Sent!</h1>
        <p>{profile.name} will contact you shortly.</p>
      </div>
    );

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

function PinScreen({ clientId, onSuccess }) {
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [attemptsRemaining, setAttemptsRemaining] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!ValidationUtils.pin(pin)) {
      setError("PIN must be exactly 4 digits");
      return;
    }
    
    setLoading(true);
    setError("");
    
    try {
      const res = await signedRequest("VERIFY_PIN", { client_id: clientId, pin });
      const json = await res.json();
      
      if (json.status === 'success') {
        if (json.secret) safeStorage.setItem(`thrivoy_secret_${clientId}`, json.secret);
        vibrate(100);
        onSuccess();
      } else {
        // Parse attempts remaining from error message
        const attemptsMatch = json.message?.match(/(\d+) attempt/);
        if (attemptsMatch) {
          const remaining = parseInt(attemptsMatch[1]);
          setAttemptsRemaining(remaining);
          setError(`Incorrect PIN. ${remaining} ${remaining === 1 ? 'attempt' : 'attempts'} remaining.`);
        } else {
          setError(json.message || "Invalid PIN");
        }
        setPin("");
        vibrate(200);
      }
    } catch (e) {
      if (e.message.includes('Rate Limit')) {
        setError("Too many attempts. Please wait 1 minute.");
      } else if (e.message.includes('locked')) {
        setError("Account locked. Please contact support.");
      } else {
        setError("Connection error. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex flex-col items-center justify-center p-6">
      <div className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-sm text-center">
        <div className="w-16 h-16 bg-blue-600 rounded-full mx-auto mb-6 flex items-center justify-center">
          <Lock size={32} className="text-white" />
        </div>
        <h1 className="text-2xl font-bold mb-2 text-gray-900">Enter PIN</h1>
        <p className="text-gray-500 mb-8 text-sm">Secure access to your workspace</p>
        
        <form onSubmit={handleSubmit}>
            <div className="mb-6">
            <input
              type="password"
              inputMode="numeric"
              maxLength={PIN_MAX_LENGTH}
              value={pin}
              onChange={(e) => {
                setPin(e.target.value.replace(/\D/g, ""));
                setError("");
              }}
              className={`w-full p-4 text-center text-2xl font-bold tracking-widest bg-gray-50 rounded-xl border-2 outline-none transition-colors ${
                error ? 'border-red-500 bg-red-50' : 'border-gray-200 focus:border-blue-500'
              }`}
              placeholder="••••"
              autoFocus
              disabled={loading}
            />
            {error && (
              <p className="text-red-600 text-sm mt-2 text-center font-medium">{error}</p>
            )}
            {attemptsRemaining !== null && attemptsRemaining <= 2 && (
              <p className="text-orange-600 text-xs mt-1 text-center">
                ⚠️ Warning: Only {attemptsRemaining} {attemptsRemaining === 1 ? 'attempt' : 'attempts'} left
              </p>
            )}
          </div>
          <button
            type="submit"
            disabled={pin.length !== 4 || loading}
            className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors"
          >
            {loading ? "Verifying..." : "Unlock"}
          </button>
        </form>
      </div>
    </div>
  );
}

function AdminDashboard() {
   const [formData, setFormData] = useState({ name: '', phone: '', plan: 'Free' });
   const [loading, setLoading] = useState(false);
   const [createdUser, setCreatedUser] = useState(null);
   const [stats, setStats] = useState({ clients: 0, leads: 0, hits: 0 });

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
            setCreatedUser({
                ...formData,
                key: json.data.key,
                url: json.data.url
            });
            setFormData({ name: '', phone: '', plan: 'Free' });
            setStats(prev => ({ ...prev, clients: prev.clients + 1 }));
         } else {
            alert("Error: " + json.message);
         }
      } catch (e) {
        if (e.message.includes('Rate Limit')) {
          alert('⏳ Too many requests. Please wait 1 minute and try again.');
        } else if (e.message.includes('Network')) {
          alert('📡 Connection error. Check your internet and try again.');
        } else {
          alert('❌ Something went wrong: ' + e.message);
        }
      }
      finally { setLoading(false); }
   };

   return (
      <div className="h-screen bg-slate-900 text-white p-6 overflow-y-auto">
         <div className="flex items-center gap-3 mb-8">
            <LayoutDashboard className="text-orange-500"/>
            <h1 className="text-2xl font-bold">Master View</h1>
         </div>
         
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

         <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 mb-8 shadow-xl">
            <h3 className="font-bold mb-4 flex items-center gap-2"><UserCheck size={20} className="text-green-400"/> Create New Client</h3>
            
            {createdUser && (
                <div className="bg-green-600/20 border border-green-500 p-4 rounded-xl mb-4 animate-in fade-in">
                    <h4 className="font-bold text-green-400 mb-2">✅ Client Created Successfully!</h4>
                    <p className="text-sm text-gray-300 mb-1">Key: <span className="font-mono text-white">{createdUser.key}</span></p>
                    <button 
                        onClick={() => {
                            const text = encodeURIComponent(`Welcome to Thrivoy!\n\nHere are your login details:\n\n🔑 Access Key: ${createdUser.key}\n🔗 Login Link: ${createdUser.url}\n\nStart closing deals!`);
                            window.open(`https://wa.me/${createdUser.phone}?text=${text}`);
                        }}
                        className="mt-3 w-full bg-green-500 text-white font-bold py-2 rounded-lg flex items-center justify-center gap-2 hover:bg-green-400 transition-colors"
                    >
                        <Zap size={16} fill="currentColor"/> Send Credentials via WhatsApp
                    </button>
                    <button onClick={() => setCreatedUser(null)} className="mt-2 text-xs text-gray-400 underline w-full text-center">Dismiss</button>
                </div>
            )}

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

         <div className="p-4 bg-slate-800 rounded-xl border border-slate-700">
            <h3 className="font-bold mb-4 flex items-center gap-2 text-gray-300"><BarChart3 size={16}/> System Health</h3>
            <div className="space-y-3 text-sm text-gray-400">
               <div className="flex justify-between border-b border-slate-700 pb-2"><span>API Hits (10m)</span> <span className="text-white font-mono">{stats.hits}</span></div>
               <div className="flex justify-between border-b border-slate-700 pb-2"><span>Status</span> <span className="text-green-400 font-bold">OPERATIONAL</span></div>
               <div className="flex justify-between"><span>Version</span> <span className="text-gray-500">v28.2.0</span></div>
            </div>
         </div>
      </div>
   );
}

function AdminLogin({ onLogin }) {
  return (
    <div className="h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-white">
      <Lock size={48} className="mb-6 text-orange-500" />
      <h2 className="text-xl font-bold mb-6">Admin Access Moved</h2>
      <p className="text-gray-400 text-center max-w-sm">
        Admin functions now require backend authentication. 
        Please use the secure admin portal.
      </p>
    </div>
  );
}

function LandingPage() {
  const [loading, setLoading] = useState(false);
  const [keyValue, setKeyValue] = useState("");

  const handleLogin = (e) => {
    e.preventDefault();
    if(keyValue) window.location.search = `?key=${keyValue}`;
  };

  const handleQuickStart = async () => {
    if (!window.confirm("Create instant free account? You'll get your credentials immediately.")) {
      return;
    }

    setLoading(true);
    try {
      const tempName = `User_${Math.random().toString(36).substr(2, 6)}`;
      const res = await signedRequest("ADD_CLIENT", {
        admin_key: "QUICK_START",
        client_id: ADMIN_KEY,
        name: tempName,
        phone: "0000000000",
        plan: "Free"
      });
      
      const json = await res.json();
      if (json.status === 'success') {
        const { key, pin } = json.data;
        
        safeStorage.setItem("thrivoy_client_id", key);
        
        const credentialsMsg = `🎉 Account Created Successfully!\n\n` +
                              `SAVE THESE CREDENTIALS:\n\n` +
                              `🔑 Access Key: ${key}\n` +
                              `🔐 PIN: ${pin}\n\n` +
                              `You'll need these to login.\n` +
                              `Screenshot this message!`;
        
        alert(credentialsMsg);
        window.location.search = `?key=${key}`;
      } else {
        alert("Quick start failed: " + (json.message || "Unknown error"));
      }
    } catch (e) {
      if (e.message.includes('Rate Limit')) {
        alert('⏳ Too many requests. Please wait 1 minute and try again.');
      } else if (e.message.includes('Network')) {
        alert('📡 Connection error. Check your internet and try again.');
      } else {
        alert('❌ Something went wrong: ' + e.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const scrollToLogin = () => {
    const el = document.getElementById('login-form');
    if(el) {
       const y = el.getBoundingClientRect().top + window.pageYOffset - 100;
       window.scrollTo({top: y, behavior: 'smooth'});
    }
  };

  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans selection:bg-blue-100">
      
      {loading && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-8 flex flex-col items-center gap-4 shadow-2xl max-w-sm mx-4 w-full">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-600 border-t-transparent"></div>
            <p className="font-bold text-gray-900 text-center">Creating your account...</p>
            <p className="text-sm text-gray-500 text-center">This will only take a moment</p>
          </div>
        </div>
      )}

      {/* Sticky Navigation */}
      <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-gray-100 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 font-black text-lg sm:text-xl tracking-tight">
            <div className="w-8 h-8 bg-blue-600 rounded-lg text-white flex items-center justify-center text-lg shadow-lg shadow-blue-200">T</div>
            <span className="hidden xs:inline">Thrivoy</span>
          </div>
          <button 
            onClick={scrollToLogin} 
            className="text-xs sm:text-sm font-bold bg-gray-900 text-white px-4 sm:px-5 py-2 rounded-full hover:bg-black transition-colors"
          >
            Member Login
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <header className="relative pt-12 sm:pt-20 pb-20 sm:pb-32 overflow-hidden bg-gradient-to-b from-white to-gray-50/50">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] sm:w-[800px] h-[400px] sm:h-[500px] bg-blue-100/40 rounded-full blur-[100px] -z-10"></div>
        
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <div className="inline-flex items-center gap-2 mb-6 sm:mb-8 px-3 sm:px-4 py-2 rounded-full bg-blue-50 border border-blue-100 text-blue-700 text-[10px] sm:text-xs font-bold uppercase tracking-wider shadow-sm">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
            </span>
            v2.0 Now Live for India
          </div>
          
          <h1 className="text-3xl sm:text-5xl md:text-7xl font-black mb-4 sm:mb-6 tracking-tight text-gray-900 leading-[1.1] px-2">
            Stop managing leads.<br/>
            Start <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">closing deals</span>.
          </h1>
          
          <p className="text-base sm:text-xl text-gray-500 mb-8 sm:mb-10 max-w-2xl mx-auto leading-relaxed px-4">
            The secret weapon for Real Estate, Insurance, and Sales pros. 
            Ditch the diaries and messy Excel sheets.
          </p>

          {/* Quick Start Section */}
          <div className="mb-6 sm:mb-8 max-w-md mx-auto px-4">
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200 rounded-2xl p-4 sm:p-6 shadow-lg">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                  <Zap size={20} className="sm:w-6 sm:h-6 text-white" fill="currentColor"/>
                </div>
                <div className="text-left">
                  <h3 className="font-bold text-base sm:text-lg text-gray-900">New User?</h3>
                  <p className="text-xs sm:text-sm text-gray-600">Get instant access - no signup required</p>
                </div>
              </div>
              
              <button 
                onClick={handleQuickStart}
                disabled={loading}
                className="w-full bg-gradient-to-r from-green-600 to-emerald-600 text-white py-3 sm:py-4 rounded-xl font-bold shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm sm:text-base"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                    Creating Account...
                  </>
                ) : (
                  <>
                    🚀 Start Free Trial Now
                  </>
                )}
              </button>
              
              <div className="mt-3 flex flex-wrap items-center justify-center gap-2 sm:gap-4 text-[10px] sm:text-xs text-gray-600">
                <span className="flex items-center gap-1">
                  <CheckCircle2 size={12} className="text-green-600"/>
                  Instant access
                </span>
                <span className="flex items-center gap-1">
                  <CheckCircle2 size={12} className="text-green-600"/>
                  No credit card
                </span>
                <span className="flex items-center gap-1">
                  <CheckCircle2 size={12} className="text-green-600"/>
                  50 free leads
                </span>
              </div>
            </div>
          </div>

          {/* Login Section - FIXED */}
          <div className="relative px-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200"></div>
            </div>
            <div className="relative flex justify-center text-xs sm:text-sm mb-4 sm:mb-6">
              <span className="px-4 bg-white text-gray-500 font-medium">or login with your key</span>
            </div>
          </div>

          <div id="login-form" className="scroll-mt-24 sm:scroll-mt-32 max-w-md mx-auto px-4">
            <form onSubmit={handleLogin} className="bg-white p-4 sm:p-6 rounded-2xl shadow-2xl shadow-blue-900/10 border border-gray-200 space-y-3">
              <input 
                name="key"
                value={keyValue}
                onChange={(e) => setKeyValue(e.target.value)}
                placeholder="Enter Invite Key" 
                className="w-full bg-gray-50 text-gray-900 font-bold px-4 sm:px-6 py-3 sm:py-4 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-all placeholder:font-medium placeholder:text-gray-400 text-sm sm:text-base"
              />
              <button 
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 sm:px-6 py-3 sm:py-4 rounded-xl font-bold transition-colors flex items-center justify-center gap-2 shadow-lg shadow-blue-200 text-sm sm:text-base"
              >
                Enter <ArrowLeft size={18} className="rotate-180"/>
              </button>
            </form>
          </div>

          <p className="mt-4 sm:mt-6 text-xs sm:text-sm text-gray-500 font-medium px-4">
            Don't have a key? <a href="https://wa.me/917892159170?text=I want Thrivoy access" className="text-blue-600 hover:underline">Request access</a>
          </p>
        </div>
      </header>

      {/* 3 Steps Section */}
      <section className="py-12 sm:py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12 sm:mb-16">
            <h2 className="text-2xl sm:text-3xl font-black mb-3 sm:mb-4 text-gray-900">3 Steps to Revenue</h2>
            <p className="text-sm sm:text-base text-gray-500 px-4">Simple enough for beginners. Powerful enough for top tier agents.</p>
          </div>

          <div className="grid sm:grid-cols-3 gap-8 sm:gap-12 relative">
            <div className="hidden sm:block absolute top-12 left-[20%] right-[20%] h-0.5 bg-gradient-to-r from-gray-200 via-blue-200 to-gray-200 -z-10"></div>

            <div className="text-center bg-white">
              <div className="w-20 h-20 sm:w-24 sm:h-24 mx-auto bg-blue-50 rounded-full flex items-center justify-center mb-4 sm:mb-6 border-4 border-white shadow-lg">
                <Upload size={28} className="sm:w-8 sm:h-8 text-blue-600"/>
              </div>
              <h3 className="text-lg sm:text-xl font-bold mb-2">1. Dump the Data</h3>
              <p className="text-gray-500 text-sm px-4">Paste messy WhatsApp lists, forward emails, or upload CSVs. Our AI cleans it instantly.</p>
            </div>

            <div className="text-center bg-white">
              <div className="w-20 h-20 sm:w-24 sm:h-24 mx-auto bg-purple-50 rounded-full flex items-center justify-center mb-4 sm:mb-6 border-4 border-white shadow-lg">
                <Wand2 size={28} className="sm:w-8 sm:h-8 text-purple-600"/>
              </div>
              <h3 className="text-lg sm:text-xl font-bold mb-2">2. AI Sorting</h3>
              <p className="text-gray-500 text-sm px-4">Thrivoy identifies hot leads, categorizes them, and queues them up for calling.</p>
            </div>

            <div className="text-center bg-white">
              <div className="w-20 h-20 sm:w-24 sm:h-24 mx-auto bg-green-50 rounded-full flex items-center justify-center mb-4 sm:mb-6 border-4 border-white shadow-lg">
                <CheckCircle2 size={28} className="sm:w-8 sm:h-8 text-green-600"/>
              </div>
              <h3 className="text-lg sm:text-xl font-bold mb-2">3. Close & Repeat</h3>
              <p className="text-gray-500 text-sm px-4">Speed dial through your list. Send WhatsApp follow-ups in 1 click. Double your speed.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-16 sm:py-24 bg-gray-50 border-y border-gray-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12 sm:mb-16">
            <h2 className="text-2xl sm:text-3xl font-black mb-3 sm:mb-4 text-gray-900">Simple, Transparent Pricing</h2>
            <p className="text-sm sm:text-base text-gray-500">Pay for performance. Cancel anytime.</p>
          </div>

          <div className="grid sm:grid-cols-3 gap-6 sm:gap-8 max-w-5xl mx-auto items-center">
            
            {/* Free Plan */}
            <div className="bg-white p-6 sm:p-8 rounded-3xl border border-gray-200 shadow-sm text-center">
              <h3 className="font-bold text-base sm:text-lg text-gray-500 mb-2">Starter</h3>
              <div className="text-3xl sm:text-4xl font-black mb-4 sm:mb-6">Free</div>
              <ul className="space-y-3 sm:space-y-4 mb-6 sm:mb-8 text-left text-xs sm:text-sm text-gray-600">
                <li className="flex items-center gap-2"><CheckCircle2 size={16} className="text-green-500 flex-shrink-0"/> 100 Leads Capacity</li>
                <li className="flex items-center gap-2"><CheckCircle2 size={16} className="text-green-500 flex-shrink-0"/> Basic Calling Queue</li>
                <li className="flex items-center gap-2"><CheckCircle2 size={16} className="text-green-500 flex-shrink-0"/> 1 Digital Card</li>
                <li className="flex items-center gap-2 opacity-50"><X size={16} className="flex-shrink-0"/> No AI Rewriting</li>
              </ul>
              <button 
                onClick={handleQuickStart} 
                disabled={loading} 
                className="w-full py-3 rounded-xl border-2 border-gray-200 font-bold hover:bg-gray-50 transition-colors disabled:opacity-50 text-sm sm:text-base"
              >
                {loading ? "Creating..." : "Start Free"}
              </button>
            </div>

            {/* Pro Plan */}
            <div className="bg-gray-900 text-white p-6 sm:p-8 rounded-3xl shadow-2xl relative transform sm:scale-105 z-10">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 bg-gradient-to-r from-blue-500 to-indigo-500 text-white text-[10px] sm:text-xs font-bold px-3 py-1 rounded-b-lg">MOST POPULAR</div>
              <h3 className="font-bold text-base sm:text-lg text-gray-400 mb-2 mt-2">Pro Agent</h3>
              <div className="text-4xl sm:text-5xl font-black mb-1">₹999<span className="text-base sm:text-lg font-medium text-gray-500">/mo</span></div>
              <p className="text-gray-400 text-xs mb-4 sm:mb-6">Billed annually</p>
              
              <ul className="space-y-3 sm:space-y-4 mb-6 sm:mb-8 text-left text-xs sm:text-sm">
                <li className="flex items-center gap-2"><CheckCircle2 size={16} className="text-green-400 flex-shrink-0"/> Unlimited Leads</li>
                <li className="flex items-center gap-2"><CheckCircle2 size={16} className="text-green-400 flex-shrink-0"/> Full AI Suite</li>
                <li className="flex items-center gap-2"><CheckCircle2 size={16} className="text-green-400 flex-shrink-0"/> Hot Lead Vault</li>
                <li className="flex items-center gap-2"><CheckCircle2 size={16} className="text-green-400 flex-shrink-0"/> WhatsApp Integration</li>
                <li className="flex items-center gap-2"><CheckCircle2 size={16} className="text-green-400 flex-shrink-0"/> Priority Support</li>
              </ul>
              <button 
                onClick={scrollToLogin} 
                className="w-full py-3 sm:py-4 rounded-xl bg-blue-600 font-bold hover:bg-blue-500 transition-colors shadow-lg shadow-blue-900/50 text-sm sm:text-base"
              >
                Get Started
              </button>
            </div>

            {/* Teams Plan */}
            <div className="bg-white p-6 sm:p-8 rounded-3xl border border-gray-200 shadow-sm text-center">
              <h3 className="font-bold text-base sm:text-lg text-gray-500 mb-2">Teams</h3>
              <div className="text-3xl sm:text-4xl font-black mb-4 sm:mb-6">Custom</div>
              <ul className="space-y-3 sm:space-y-4 mb-6 sm:mb-8 text-left text-xs sm:text-sm text-gray-600">
                <li className="flex items-center gap-2"><CheckCircle2 size={16} className="text-green-500 flex-shrink-0"/> Everything in Pro</li>
                <li className="flex items-center gap-2"><CheckCircle2 size={16} className="text-green-500 flex-shrink-0"/> Team Dashboard</li>
                <li className="flex items-center gap-2"><CheckCircle2 size={16} className="text-green-500 flex-shrink-0"/> Lead Distribution</li>
                <li className="flex items-center gap-2"><CheckCircle2 size={16} className="text-green-500 flex-shrink-0"/> Performance Analytics</li>
              </ul>
              <button 
                onClick={() => window.open("https://wa.me/917892159170?text=I want Teams plan")} 
                className="w-full py-3 rounded-xl border-2 border-gray-200 font-bold hover:bg-gray-50 transition-colors text-sm sm:text-base"
              >
                Contact Sales
              </button>
            </div>

          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-16 sm:py-24 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <h2 className="text-2xl sm:text-3xl font-black mb-8 sm:mb-12 text-center text-gray-900">Built for Indian Markets</h2>
          
          <div className="grid sm:grid-cols-2 gap-6 sm:gap-8">
            <div className="bg-slate-50 p-6 sm:p-8 rounded-3xl border border-slate-200 hover:border-blue-500 transition-colors">
              <div className="flex items-center gap-3 sm:gap-4 mb-4 sm:mb-6">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-xs sm:text-sm flex-shrink-0">RE</div>
                <div>
                  <h4 className="font-bold text-base sm:text-lg text-gray-900">Real Estate</h4>
                  <p className="text-gray-500 text-xs sm:text-sm">Managing 500+ site visits</p>
                </div>
              </div>
              <p className="text-gray-600 mb-4 sm:mb-6 italic text-sm sm:text-base">"I used to lose leads in my phonebook. With Thrivoy, I dump all inquiries from MagicBricks and 99acres into the engine. My conversion jumped 40% in month one."</p>
              <div className="flex gap-3 text-xs sm:text-sm font-bold text-gray-800 items-center">
                <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center text-xs flex-shrink-0">VS</div>
                Vikram S., Property Consultant, Pune
              </div>
            </div>

            <div className="bg-slate-50 p-6 sm:p-8 rounded-3xl border border-slate-200 hover:border-green-500 transition-colors">
              <div className="flex items-center gap-3 sm:gap-4 mb-4 sm:mb-6">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-green-600 text-white rounded-full flex items-center justify-center font-bold text-xs sm:text-sm flex-shrink-0">INS</div>
                <div>
                  <h4 className="font-bold text-base sm:text-lg text-gray-900">Insurance & Loans</h4>
                  <p className="text-gray-500 text-xs sm:text-sm">High volume calling</p>
                </div>
              </div>
              <p className="text-gray-600 mb-4 sm:mb-6 italic text-sm sm:text-base">"Speed is everything. I can call 50 people in an hour using the Queue mode. The AI rewriting my WhatsApp messages makes me look super professional."</p>
              <div className="flex gap-3 text-xs sm:text-sm font-bold text-gray-800 items-center">
                <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center text-xs flex-shrink-0">PM</div>
                Priya M., Financial Advisor, Mumbai
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 sm:py-12 bg-gray-900 text-gray-400 text-center text-xs sm:text-sm">
        <p>© 2025 Thrivoy. Built for hustlers who close.</p>
      </footer>
    </div>
  );
}

// Add this to your frontend for debugging
console.log('API URL:', API_URL);
console.log('Origin:', window.location.origin);

// --- ROOT RENDER ---
const root = createRoot(document.getElementById('root'));
root.render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);