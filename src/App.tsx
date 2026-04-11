/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  LayoutDashboard, 
  Sparkles, 
  Inbox, 
  UserSearch, 
  Search, 
  Bell, 
  Plus, 
  TrendingUp, 
  Verified, 
  Sprout, 
  Filter, 
  Download,
  ChevronRight,
  ChevronDown,
  Database,
  Menu,
  X,
  FileUp,
  Cpu,
  Table,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Send,
  Globe,
  ShoppingBag,
  Zap,
  Sun,
  Moon,
  FileText
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI, Type } from "@google/genai";

// --- Types ---

interface Lead {
  id: string;
  company: string;
  domain: string;
  initials: string;
  platform: string;
  signals: string;
  summary: string;
  score: number;
  scoreLabel: string;
  hasShopify: boolean;
  hasFBPixel: boolean;
  // Financial Audit
  salesRevenue?: string;
  techSpend?: string;
  employeeCount?: string;
  // Technical Audit
  marketingAutomation?: string;
  paymentPlatforms?: number;
  // Entry Point
  location?: string;
  facebookUrl?: string;
  source?: 'BuiltWith' | 'Manual' | 'CSV';
  // Vision Specific Signals
  hasAnalytics?: boolean;
  hasCRM?: boolean;
  hasGoogleAds?: boolean;
}

interface VisionMode {
  id: string;
  name: string;
  description: string;
  icon: any;
  color: string;
  focus: string;
  signals: string[];
  promptFocus: string;
}

const VISION_MODES: VisionMode[] = [
  {
    id: 'ecommerce',
    name: 'E-commerce Conversion',
    description: 'Optimize Shopify stores for higher conversion and retargeting.',
    icon: ShoppingBag,
    color: 'text-primary',
    focus: 'CRO & Paid Social',
    signals: ['Shopify', 'FB Pixel', 'Klaviyo'],
    promptFocus: 'Focus on checkout friction, retargeting gaps, and platform-specific optimizations for Shopify/E-commerce.'
  },
  {
    id: 'saas',
    name: 'SaaS Growth & PLG',
    description: 'Target high-growth software companies with tech stack audits.',
    icon: Cpu,
    color: 'text-indigo-500',
    focus: 'Tech Stack & PLG',
    signals: ['HubSpot', 'Segment', 'Mixpanel'],
    promptFocus: 'Focus on analytics depth, CRM integration, and product-led growth signals like self-serve onboarding.'
  },
  {
    id: 'local',
    name: 'Local Service Dominance',
    description: 'Help local businesses dominate their market with SEO and Ads.',
    icon: Globe,
    color: 'text-tertiary',
    focus: 'Local SEO & Lead Gen',
    signals: ['Google Ads', 'WordPress', 'G2/Yelp'],
    promptFocus: 'Focus on local search visibility, Google Ads spend efficiency, and reputation management signals.'
  }
];

interface Checkpoint {
  id: number;
  title: string;
  status: 'checked' | 'pending';
  description: string;
}

// --- Logic ---

const generateMockLeads = (tech: string, country: string): Lead[] => {
  const countryNames: Record<string, string> = {
    'GB': 'United Kingdom',
    'US': 'USA',
    'CA': 'Canada',
    'AU': 'Australia',
    'DE': 'Germany'
  };
  
  const mockCompanies: Record<string, string[]> = {
    'GB': ['London Luxe', 'Manchester Modern', 'Birmingham Boutique', 'Glasgow Goods', 'Leeds Lifestyle'],
    'US': ['NYC Novelties', 'LA Luxe', 'Chicago Chic', 'Miami Modern', 'Austin Apparel'],
    'CA': ['Toronto Tech', 'Vancouver Vibrant', 'Montreal Mode', 'Calgary Craft', 'Ottawa Organic'],
    'AU': ['Sydney Style', 'Melbourne Maker', 'Brisbane Brand', 'Perth Prime', 'Adelaide Art'],
    'DE': ['Berlin Basic', 'Munich Modern', 'Hamburg Home', 'Cologne Craft', 'Frankfurt Fashion']
  };

  const companies = mockCompanies[country] || mockCompanies['GB'];
  const countryName = countryNames[country] || country;

  return companies.map((name, index) => ({
    id: `fallback-${country}-${index}-${Date.now()}`,
    company: name,
    domain: `https://${name.toLowerCase().replace(/ /g, '')}.com`,
    platform: tech,
    signals: "Fallback Detection",
    initials: name.substring(0, 2).toUpperCase(),
    hasShopify: tech.toLowerCase() === "shopify",
    hasFBPixel: Math.random() > 0.5,
    summary: `Fallback lead for ${tech} in ${countryName}.`,
    score: tech.toLowerCase() === "shopify" ? 60 : 40,
    scoreLabel: "Fallback",
    location: `${name.split(' ')[0]}, ${countryName}`,
    source: 'Manual'
  }));
};

const calculateScore = (
  lead: Lead,
  visionText: string,
  hasAIContext: boolean
) => {
  let score = 0;
  const lowerText = visionText.toLowerCase();
  
  if (lowerText.includes('web3') || lowerText.includes('crypto')) {
    if (lead.hasAnalytics) score += 20;
    if (lead.techSpend === 'Tech-Forward') score += 30;
  } else if (lowerText.includes('recruit') || lowerText.includes('hiring')) {
    if (lead.employeeCount?.includes('50+')) score += 30;
    if (lead.hasCRM) score += 20;
  } else if (lowerText.includes('security') || lowerText.includes('cyber')) {
    if (lead.hasAnalytics) score += 25;
    if (lead.techSpend === 'Tech-Forward') score += 25;
  } else if (lowerText.includes('market') || lowerText.includes('agency')) {
    if (lead.hasFBPixel) score += 30;
    if (lead.hasGoogleAds) score += 20;
  } else if (lowerText.includes('saas') || lowerText.includes('b2b')) {
    if (lead.hasAnalytics) score += 20;
    if (lead.hasCRM) score += 20;
    if (lead.techSpend === 'Tech-Forward') score += 10;
  } else {
    // Default E-commerce
    if (lead.hasShopify) score += 25;
    if (lead.hasFBPixel) score += 25;
  }
  
  // AI Context (Common weight)
  if (hasAIContext) score += 40;
  
  return Math.min(100, score);
};

const getScoreLabel = (score: number) => {
  if (score >= 90) return 'Excellent';
  if (score >= 70) return 'Strong';
  if (score >= 50) return 'Average';
  return 'Weak';
};

// --- Mock Data ---

const INITIAL_LEADS: Lead[] = [
  {
    id: 'g5-1',
    company: 'Illuminate Essentials',
    domain: 'https://illuminateessentials.co.uk',
    initials: 'IE',
    platform: 'Shopify',
    signals: 'FB Pixel Active',
    summary: 'Premium wellness and home essentials brand. Strong digital footprint with active retargeting.',
    score: 100,
    scoreLabel: 'Excellent',
    hasShopify: true,
    hasFBPixel: true,
    salesRevenue: 'Tier 1: Over $50k/mo',
    techSpend: 'Tech-Forward',
    employeeCount: '1-10 (Founder-Led)',
    marketingAutomation: 'Klaviyo',
    paymentPlatforms: 6,
    location: 'London, UK',
    facebookUrl: 'https://facebook.com/illuminate',
    source: 'CSV'
  },
  {
    id: 'g5-2',
    company: 'gloomflex.co.uk',
    domain: 'https://gloomflex.co.uk',
    initials: 'GF',
    platform: 'Custom Stack',
    signals: 'No Pixel Found',
    summary: 'Specialized industrial equipment provider. High-intent domain but lacks modern tracking infrastructure.',
    score: 50,
    scoreLabel: 'Average',
    hasShopify: false,
    hasFBPixel: false,
    salesRevenue: 'Tier 2: $10k-$50k/mo',
    techSpend: 'Legacy',
    employeeCount: '50+ (Marketing Director)',
    marketingAutomation: '',
    paymentPlatforms: 2,
    location: 'Manchester, UK',
    source: 'CSV'
  },
  {
    id: 'g5-3',
    company: 'Thingsrfid Ltd',
    domain: 'https://thingsrfid.com',
    initials: 'TR',
    platform: 'Shopify',
    signals: 'No Pixel Found',
    summary: 'RFID technology solutions provider. Using Shopify for hardware sales but missing conversion signals.',
    score: 70,
    scoreLabel: 'Strong',
    hasShopify: true,
    hasFBPixel: false,
    salesRevenue: 'Tier 1: Over $50k/mo',
    techSpend: 'Tech-Forward',
    employeeCount: '11-50',
    marketingAutomation: 'Mailchimp',
    paymentPlatforms: 4,
    location: 'London, UK',
    source: 'CSV'
  },
  {
    id: 'g5-4',
    company: 'activesensor.co.uk',
    domain: 'https://activesensor.co.uk',
    initials: 'AS',
    platform: 'Custom Stack',
    signals: 'FB Pixel Active',
    summary: 'Sensor technology specialists. Investing in traffic but using a legacy platform stack.',
    score: 80,
    scoreLabel: 'Strong',
    hasShopify: false,
    hasFBPixel: true,
    salesRevenue: 'Tier 3: Under $10k/mo',
    techSpend: 'Moderate',
    employeeCount: '1-10 (Founder-Led)',
    marketingAutomation: '',
    paymentPlatforms: 3,
    location: 'Birmingham, UK',
    source: 'CSV'
  },
  {
    id: 'g5-5',
    company: 'hartglobal.co.uk',
    domain: 'https://hartglobal.co.uk',
    initials: 'HG',
    platform: 'Shopify',
    signals: 'FB Pixel Active',
    summary: 'Global logistics and supply chain brand. Fully optimized stack with high-fidelity signals.',
    score: 100,
    scoreLabel: 'Excellent',
    hasShopify: true,
    hasFBPixel: true,
    salesRevenue: 'Tier 1: Over $50k/mo',
    techSpend: 'Tech-Forward',
    employeeCount: '50+ (Marketing Director)',
    marketingAutomation: 'Klaviyo',
    paymentPlatforms: 8,
    location: 'London, UK'
  }
];

const CHECKPOINTS: Checkpoint[] = [
  { id: 1, title: 'Strategic Blueprint', status: 'checked', description: 'Target: Digital Marketing Agency. Flow: BuiltWith -> Scraper -> AI -> Sheets.' },
  { id: 2, title: 'Functional Rules', status: 'checked', description: 'Detect Shopify (20pt), FB Pixel (30pt), AI Context (50pt).' },
  { id: 3, title: 'Cleaned Input', status: 'checked', description: 'Protocol check (https://) and "Golden 5" test batch ready.' },
  { id: 4, title: 'Visual Alignment', status: 'checked', description: 'UI includes spots for Signals, Match Score, and AI Pitch.' }
];

// --- Components ---

const SidebarItem = ({ icon: Icon, label, active = false, onClick }: { icon: any, label: string, active?: boolean, onClick?: () => void }) => (
  <a 
    href="#" 
    onClick={(e) => {
      e.preventDefault();
      onClick?.();
    }}
    className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all duration-200 ${
      active 
        ? 'bg-surface-container-lowest text-primary shadow-sm' 
        : 'text-on-surface-variant hover:text-primary hover:translate-x-1'
    }`}
  >
    <Icon size={20} />
    <span>{label}</span>
  </a>
);

const StatCard = ({ title, value, subtext, icon: Icon, trend, variant = 'default' }: { 
  title: string, 
  value: string, 
  subtext: string, 
  icon: any, 
  trend?: string,
  variant?: 'default' | 'primary'
}) => (
  <div className={`p-6 rounded-2xl transition-all duration-300 ${
    variant === 'primary' 
      ? 'bg-primary text-white shadow-xl shadow-primary/20 relative overflow-hidden' 
      : 'bg-surface-container-lowest border border-outline-variant/10 shadow-sm'
  }`}>
    {variant === 'primary' && (
      <div className="absolute -right-4 -top-4 opacity-10">
        <Icon size={120} />
      </div>
    )}
    <div className="flex justify-between items-start mb-6">
      <div className={`p-2 rounded-xl ${variant === 'primary' ? 'bg-surface-container-lowest/20' : 'bg-primary/10 text-primary'}`}>
        <Icon size={20} />
      </div>
    </div>
    <div className="space-y-1">
      <h3 className={`text-[10px] font-bold uppercase tracking-widest ${variant === 'primary' ? 'text-white/80' : 'text-on-surface-variant'}`}>
        {title}
      </h3>
      <p className="text-3xl lg:text-4xl font-extrabold font-headline">{value}</p>
    </div>
    <div className={`mt-4 flex items-center gap-2 text-xs font-bold ${
      variant === 'primary' ? 'text-white/90' : trend ? 'text-tertiary' : 'text-on-surface-variant'
    }`}>
      {trend && <TrendingUp size={14} />}
      <span>{subtext}</span>
    </div>
  </div>
);

export default function App() {
  const [activeTab, setActiveTab] = useState('decision');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isScraping, setIsScraping] = useState(false);
  const [scrapeStep, setScrapeStep] = useState(0);
  const [leads, setLeads] = useState<Lead[]>(INITIAL_LEADS);
  const [rawText, setRawText] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showNewHuntModal, setShowNewHuntModal] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [bucketLeads, setBucketLeads] = useState<Lead[]>([]);
  const [apiStatus, setApiStatus] = useState({ 
    hasBuiltWithKey: false, 
    hasGeminiKey: false,
    hasShodanKey: false,
    hasSecurityScorecardKey: false
  });
  const [hunterTech, setHunterTech] = useState('Shopify');
  const [hunterCountry, setHunterCountry] = useState('GB');
  const [activeVision, setActiveVision] = useState<VisionMode>(VISION_MODES[0]);
  const [visionModeText, setVisionModeText] = useState(VISION_MODES[0].name);
  const [industrySummary, setIndustrySummary] = useState("Analyzing industry landscape...");
  const [apiSuggestions, setApiSuggestions] = useState<string[]>([]);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [apiDataFeed, setApiDataFeed] = useState('https://api.builtwith.com/lists/v11/api.json?KEY=YOUR_API_KEY&TECH=Shopify&COUNTRY=GB');
  const [isApiConnected, setIsApiConnected] = useState<boolean | null>(null);
  const [displayColumns, setDisplayColumns] = useState(['Domain', 'Company Name', 'Employee Count', 'FB Pixel']);
  const [qualityThreshold, setQualityThreshold] = useState(75);
  const [blacklist, setBlacklist] = useState(['Amazon', '.gov', 'Dropshipping']);
  const [triggerAction, setTriggerAction] = useState('Export to Google Sheets');

  const getDynamicConfig = useCallback((text: string) => {
    const lowerText = text.toLowerCase();
    
    if (lowerText.includes('web3') || lowerText.includes('crypto') || lowerText.includes('blockchain') || lowerText.includes('infrastructure') || lowerText.includes('defi') || lowerText.includes('on-chain')) {
      return {
        repository: [
          'Company & Source', 'Domain', 'Primary Chain', 'Wallet Integration', 
          'RPC Provider', 'Smart Contract Language', 'TVL (Total Value Locked)', 
          'Token Market Cap', 'VC Funding', 'Developer Activity', 
          'Security Audit Status', 'AI Intelligence Summary'
        ],
        defaults: ['Company & Source', 'Primary Chain', 'TVL (Total Value Locked)', 'AI Intelligence Summary'],
        summary: "Focus on protocol scalability, TVL growth, and developer activity. Audit smart contract security and VC backing.",
        api: "Alchemy SDK or DeBank API"
      };
    }
    
    if (lowerText.includes('recruit') || lowerText.includes('hiring') || lowerText.includes('talent') || lowerText.includes('hr') || lowerText.includes('headcount')) {
      return {
        repository: [
          'Company & Source', 'Domain', 'Employee Count', 'Hiring Velocity', 
          'Open Roles', 'Talent Density', 'Leadership Changes', 'Location', 
          'AI Intelligence Summary'
        ],
        defaults: ['Company & Source', 'Employee Count', 'Open Roles', 'AI Intelligence Summary'],
        summary: "Focus on headcounts, open roles, and talent density. Analyze hiring velocity and leadership changes.",
        api: "LinkedIn API or Indeed Scraper"
      };
    }
    
    if (lowerText.includes('saas') || lowerText.includes('b2b') || lowerText.includes('competitor') || lowerText.includes('flip') || lowerText.includes('plg')) {
      return {
        repository: [
          'Company & Source', 'Domain', 'Competitor Tech', 'Pricing Tiers', 
          'G2/Capterra Rating', 'Monthly Traffic', 'Churn Risk Signal', 
          'Salesforce/HubSpot', 'Integration Count', 'AI Intelligence Summary'
        ],
        defaults: ['Company & Source', 'Competitor Tech', 'G2/Capterra Rating', 'AI Intelligence Summary'],
        summary: "Identify competitor tech swaps and pricing gaps. Analyze G2 sentiment and traffic velocity for PLG signals.",
        api: "G2 API or SimilarWeb"
      };
    }

    if (lowerText.includes('market') || lowerText.includes('agency') || lowerText.includes('digital') || lowerText.includes('ad') || lowerText.includes('seo') || lowerText.includes('growth')) {
      return {
        repository: [
          'Company & Source', 'Domain', 'Shopify', 'FB Pixel', 'Google Ads', 
          'SEO Health', 'Ad Spend Estimate', 'Marketing Automation', 
          'Audit Insights', 'AI Intelligence Summary'
        ],
        defaults: ['Company & Source', 'FB Pixel', 'Audit Insights', 'AI Intelligence Summary'],
        summary: "Prioritize tracking pixels, ad spend estimates, and SEO health. Audit marketing automation depth.",
        api: "BuiltWith API or FB Ads Library"
      };
    }

    if (lowerText.includes('security') || lowerText.includes('cyber') || lowerText.includes('risk') || lowerText.includes('threat') || lowerText.includes('guard')) {
      return {
        repository: [
          'Company & Source', 'Domain', 'SSL Status', 'Firewall Detected', 
          'Vulnerability Score', 'Open Ports', 'Tech Stack Risk', 
          'Compliance (GDPR/SOC2)', 'Security Contact', 'AI Intelligence Summary'
        ],
        defaults: ['Company & Source', 'Vulnerability Score', 'Compliance (GDPR/SOC2)', 'AI Intelligence Summary'],
        summary: "Focus on attack surface reduction, vulnerability patching, and compliance gaps. Audit SSL health and firewall configurations.",
        api: "Shodan API or SecurityScorecard"
      };
    }

    if (lowerText.includes('m&a') || lowerText.includes('private equity') || lowerText.includes('acquisition') || lowerText.includes('buyout') || lowerText.includes('investment') || lowerText.includes('equity')) {
      return {
        repository: [
          'Company & Source', 'Domain', 'Valuation Estimate', 'Funding Rounds', 
          'EBITDA Margin', 'Debt-to-Equity', 'Key Executives', 'Market Share', 
          'Competitor Landscape', 'AI Intelligence Summary'
        ],
        defaults: ['Company & Source', 'Valuation Estimate', 'Funding Rounds', 'AI Intelligence Summary'],
        summary: "Focus on valuation multiples, EBITDA margins, and market consolidation opportunities. Analyze funding history and executive leadership stability.",
        api: "Crunchbase API or PitchBook"
      };
    }
    
    // Default / E-commerce
    return {
      repository: [
        'Company & Source', 'Domain', 'Shopify', 'FB Pixel', 'Audit Insights', 
        'AI Intelligence Summary', 'Sales Revenue', 'Tech Spend', 'Employee Count', 
        'Marketing Automation', 'Payment Platforms', 'Location'
      ],
      defaults: ['Company & Source', 'Shopify', 'Sales Revenue', 'AI Intelligence Summary'],
      summary: "Extract core business signals, growth indicators, and technical debt markers.",
      api: "BuiltWith or Custom Webhooks"
    };
  }, []);

  useEffect(() => {
    const generateIndustrySummary = async () => {
      if (!visionModeText || visionModeText.length < 3) return;
      
      setIsGeneratingSummary(true);
      try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
          setIndustrySummary("AI Summary unavailable: GEMINI_API_KEY not found in environment.");
          return;
        }

        const ai = new GoogleGenAI({ apiKey });
        
        const prompt = `You are the Sovereign Intelligence Engine. 
        Provide a concise (1-2 sentences) strategic summary of the industry: "${visionModeText}". 
        Focus on technical markers and growth signals relevant for lead generation.
        Also, suggest 3-4 specific data points (columns) that would be critical to track for this industry.
        Return as JSON: { "summary": "...", "suggestions": ["col1", "col2", ...] }`;

        const response = await ai.models.generateContent({
          model: "gemini-flash-latest",
          contents: prompt,
          config: {
            responseMimeType: "application/json"
          }
        });
        
        const text = response.text || '';
        
        // Clean markdown if present
        const jsonStr = text.replace(/```json|```/g, '').trim();
        const data = JSON.parse(jsonStr);
        
        setIndustrySummary(data.summary);
        setApiSuggestions(data.suggestions);
      } catch (error) {
        console.error("Failed to generate industry summary:", error);
        setIndustrySummary(`Strategic focus on ${visionModeText} market dynamics and technical infrastructure.`);
      } finally {
        setIsGeneratingSummary(false);
      }
    };

    const timer = setTimeout(generateIndustrySummary, 1000);
    return () => clearTimeout(timer);
  }, [visionModeText]);

  const currentConfig = useMemo(() => getDynamicConfig(visionModeText), [visionModeText, getDynamicConfig]);
  const currentRepository = currentConfig.repository;
  const promptSummary = currentConfig.summary;
  const promptApi = currentConfig.api;

  // Auto-update display columns when vision mode changes significantly
  useEffect(() => {
    const defaults = currentConfig.defaults;
    
    // Only update if the defaults are different from current selection to avoid constant resets
    const currentSet = new Set(displayColumns);
    const isDifferent = defaults.length !== displayColumns.length || !defaults.every(d => currentSet.has(d));
    
    if (isDifferent) {
      setDisplayColumns(defaults);
    }
  }, [currentConfig.defaults, displayColumns]);

  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [filterScore, setFilterScore] = useState(0);
  const [filterPlatform, setFilterPlatform] = useState('All');
  const [activeQuickFilter, setActiveQuickFilter] = useState('All Leads');
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('theme');
      return saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
    return false;
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  useEffect(() => {
    const checkApiStatus = async () => {
      try {
        const response = await fetch('/api/status');
        const data = await response.json();
        setApiStatus(data);
      } catch (error) {
        console.error("Failed to check API status:", error);
      }
    };
    checkApiStatus();
  }, []);

  const [icp, setIcp] = useState({
    industry: 'Digital Marketing',
    targetSize: '10-50 employees',
    techStack: 'Shopify, Facebook Pixel',
    focus: 'E-commerce Conversion'
  });

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  const runScraper = async (customLeads?: Lead[]) => {
    setIsScraping(true);
    setScrapeStep(1);
    
    // UI Refresh: Clear existing leads to show real-time update
    setLeads([]);
    
    let leadsToProcess: Lead[] = [];
    
    try {
      if (customLeads) {
        leadsToProcess = customLeads;
      } else {
        // Step 1: The Librarian (Pandas) -> Fetching from API
        let response;
        if (isApiConnected && !apiDataFeed.includes('builtwith.com')) {
          // Use custom API feed via proxy if verified and not the default BuiltWith
          response = await fetch(`/api/proxy?url=${encodeURIComponent(apiDataFeed)}`);
        } else {
          // Default to BuiltWith "Hunter" Proxy
          response = await fetch(`/api/hunter?tech=${hunterTech}&country=${hunterCountry}`);
        }
        
        const data = await response.json();
        
        // Handle different API response formats
        const rawLeads = Array.isArray(data) ? data : (data.leads || data.Results || data.data || []);
        
        if (rawLeads && rawLeads.length > 0) {
          leadsToProcess = rawLeads.map((item: any, index: number) => {
            // Map common fields if it's a custom API
            if (item.id && item.company) return item; // Already matches our Lead interface
            
            return {
              id: item.id || `custom-${index}-${Date.now()}`,
              company: item.company || item.name || item.Company || item.Domain?.split('.')[0] || 'Unknown Entity',
              domain: item.domain || item.url || item.Domain || 'example.com',
              platform: item.platform || item.tech || hunterTech,
              signals: item.signals || 'Custom API Feed',
              initials: (item.company || item.name || item.Domain || '??').substring(0, 2).toUpperCase(),
              hasShopify: item.hasShopify ?? (item.platform?.toLowerCase().includes('shopify') || false),
              hasFBPixel: item.hasFBPixel ?? false,
              summary: item.summary || `Extracted from custom API feed for ${visionModeText}.`,
              score: item.score || 50,
              scoreLabel: item.scoreLabel || 'Neutral',
              location: item.location || item.address || 'Global',
              source: 'Custom API'
            };
          });
        } else {
          // Fallback to dynamic mock leads if API returns nothing
          leadsToProcess = generateMockLeads(hunterTech, hunterCountry);
        }
      }
      // Update leads state immediately after fetching to show in Decision Center
      setLeads(leadsToProcess);
    } catch (error) {
      console.error("Hunter Fetch Error:", error);
      leadsToProcess = generateMockLeads(hunterTech, hunterCountry);
      setLeads(leadsToProcess);
    }
    
    await new Promise(resolve => setTimeout(resolve, 1500));
    setScrapeStep(2);

    // Step 2: Specialist Cleanup -> Filtering "Fluff" & https:// Formatting
    // This step now reflects the dynamic source (BuiltWith or CSV)
    await new Promise(resolve => setTimeout(resolve, 2000));
    setScrapeStep(3);

    // Step 3: Python Scraper -> Detecting Shopify & FB Pixel
    const leadsWithSignals: Lead[] = leadsToProcess.map(lead => {
      // Simulate signal detection for any lead that hasn't been fully analyzed
      const hasShopify = lead.hasShopify || Math.random() > 0.4;
      const hasFBPixel = lead.hasFBPixel || Math.random() > 0.5;
      
      // Simulate some audit data for new leads
      const paymentPlatforms = lead.paymentPlatforms || Math.floor(Math.random() * 8) + 1;
      const employeeCountNum = Math.floor(Math.random() * 100) + 1;
      const employeeCount = lead.employeeCount || (employeeCountNum <= 10 ? '1-10 (Founder-Led)' : employeeCountNum >= 50 ? '50+ (Marketing Director)' : '11-50');
      
      return {
        ...lead,
        hasShopify,
        hasFBPixel,
        paymentPlatforms,
        employeeCount,
        platform: hasShopify ? 'Shopify' : 'Custom Stack',
        signals: hasFBPixel ? 'FB Pixel Active' : 'No Pixel Found'
      };
    });
    setLeads(leadsWithSignals);
    await new Promise(resolve => setTimeout(resolve, 2000));
    setScrapeStep(4);

    // Step 4: AI Intelligence Synthesis & Sheets Sync
    try {
      const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

      // Helper for exponential backoff retry
      const fetchWithRetry = async (lead: Lead, retries = 2, delay = 1000): Promise<Lead> => {
        try {
          const prompt = `Perform a Financial & Technical Audit for a company named "${lead.company}" with domain "${lead.domain}". 
          
          VISION CONTEXT: ${activeVision.name} - ${activeVision.promptFocus}
          
          Extract the following in JSON format:
          - summary: A 1-2 sentence professional business summary tailored to the vision.
          - salesRevenue: Categorize into Tiers (Tier 1: Over $50k/mo, Tier 2: $10k-$50k/mo, Tier 3: Under $10k/mo).
          - techSpend: "Tech-Forward", "Moderate", or "Legacy".
          - marketingAutomation: Name of platform if found (e.g. Klaviyo, HubSpot), or empty string.
          - location: City and State/Country.
          - facebookUrl: Facebook page URL if found.
          - hasAnalytics: Boolean, true if advanced analytics (Mixpanel, Segment, Amplitude) are detected.
          - hasCRM: Boolean, true if CRM (Salesforce, HubSpot, Pipedrive) is detected.
          - hasGoogleAds: Boolean, true if Google Ads scripts are detected.
          
          Focus on their potential market position and digital presence. 
          Keep it concise and professional.`;

          const response = await genAI.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: [{ parts: [{ text: prompt }] }],
            config: {
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  summary: { type: Type.STRING },
                  salesRevenue: { type: Type.STRING },
                  techSpend: { type: Type.STRING },
                  marketingAutomation: { type: Type.STRING },
                  location: { type: Type.STRING },
                  facebookUrl: { type: Type.STRING },
                  hasAnalytics: { type: Type.BOOLEAN },
                  hasCRM: { type: Type.BOOLEAN },
                  hasGoogleAds: { type: Type.BOOLEAN },
                },
                required: ["summary", "salesRevenue", "techSpend", "marketingAutomation", "location", "facebookUrl", "hasAnalytics", "hasCRM", "hasGoogleAds"]
              }
            }
          });

          const result = JSON.parse(response.text || '{}');
          const summary = result.summary || "No summary generated.";
          const hasAIContext = summary.length > 25;
          
          const updatedLead = {
            ...lead,
            summary,
            salesRevenue: result.salesRevenue,
            techSpend: result.techSpend,
            marketingAutomation: result.marketingAutomation,
            location: result.location,
            facebookUrl: result.facebookUrl,
            hasAnalytics: result.hasAnalytics,
            hasCRM: result.hasCRM,
            hasGoogleAds: result.hasGoogleAds,
          };

          const score = calculateScore(updatedLead, visionModeText, hasAIContext);

          return {
            ...updatedLead,
            score,
            scoreLabel: getScoreLabel(score)
          };
        } catch (e: any) {
          const isRateLimit = e?.message?.includes('429') || e?.status === 'RESOURCE_EXHAUSTED';
          
          if (isRateLimit && retries > 0) {
            console.log(`Rate limit hit for ${lead.company}. Retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            return fetchWithRetry(lead, retries - 1, delay * 2);
          }

          console.error(`AI Error for ${lead.company}:`, e);
          // Fallback summary based on signals
          const fallbackSummary = `${lead.company} is a ${lead.hasShopify ? 'Shopify-powered' : 'digitally active'} brand. ${lead.hasFBPixel ? 'Utilizing advanced retargeting signals.' : 'Focusing on organic growth signals.'}`;
          const score = calculateScore(lead, visionModeText, false);
          return { ...lead, summary: fallbackSummary, score, scoreLabel: getScoreLabel(score) };
        }
      };

      // Process leads sequentially to avoid rate limits
      const currentLeads = [...leadsWithSignals];
      for (let i = 0; i < currentLeads.length; i++) {
        const lead = currentLeads[i];
        if (lead.summary === 'Processing uploaded lead data...' || !lead.summary || lead.id.startsWith('custom-') || lead.id.startsWith('bw-') || lead.id.startsWith('mock-')) {
          const processedLead = await fetchWithRetry(lead);
          currentLeads[i] = processedLead;
          
          // Update state incrementally so Decision Center updates in real-time
          setLeads([...currentLeads]);
          
          // Small delay between successful requests to be safe
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
      
      // Final step completion
      setScrapeStep(5);
      await new Promise(resolve => setTimeout(resolve, 2000));

    } catch (error) {
      console.error("AI Synthesis Batch Error:", error);
      setLeads(leadsWithSignals);
    } finally {
      setIsScraping(false);
      setScrapeStep(0);
      setActiveTab('decision');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n');
      const newLeads: Lead[] = [];
      
      // Basic CSV parsing (skipping header)
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        const parts = line.split(',');
        if (parts.length < 2) continue;
        
        const company = parts[0].trim();
        const domain = parts[1].trim().startsWith('http') ? parts[1].trim() : `https://${parts[1].trim()}`;
        
        newLeads.push({
          id: `custom-${i}-${Date.now()}`,
          company,
          domain,
          initials: company.substring(0, 2).toUpperCase(),
          platform: 'Analyzing...',
          signals: 'Scanning...',
          summary: 'Processing uploaded lead data...',
          score: 0,
          scoreLabel: 'Pending',
          hasShopify: false,
          hasFBPixel: false
        });
      }
      
      if (newLeads.length > 0) {
        runScraper(newLeads);
      }
    };
    reader.readAsText(file);
  };

  const addToBucket = (lead: Lead) => {
    if (!bucketLeads.find(l => l.id === lead.id)) {
      setBucketLeads(prev => [...prev, lead]);
    }
  };

  const removeFromBucket = (id: string) => {
    setBucketLeads(prev => prev.filter(l => l.id !== id));
  };

  const exportToCSV = () => {
    const headers = [
      'Company', 'Domain', 'Location', 'Platform', 'Signals', 'Score', 
      'Revenue Tier', 'Tech Spend', 'Employees', 'Automation', 'Payment Platforms', 'Summary'
    ];
    const rows = leads.map(l => [
      l.company,
      l.domain,
      l.location || 'N/A',
      l.platform,
      l.signals,
      l.score,
      l.salesRevenue || 'N/A',
      l.techSpend || 'N/A',
      l.employeeCount || 'N/A',
      l.marketingAutomation || 'N/A',
      l.paymentPlatforms || 0,
      `"${l.summary.replace(/"/g, '""')}"`
    ]);
    
    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `lead_hunt_export_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const analyzeText = async (text: string) => {
    if (!text.trim()) return;
    
    setIsAnalyzing(true);
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) throw new Error("GEMINI_API_KEY is not configured in Settings.");

      const genAI = new GoogleGenAI({ apiKey });
      const model = "gemini-flash-latest";
      
      const prompt = `Analyze the following raw text or HTML from a company website. 
      Perform a Financial & Technical Audit and extract the following information in JSON format:
      
      VISION CONTEXT: ${activeVision.name} - ${activeVision.promptFocus}
      
      - companyName: The name of the company.
      - domain: The website URL.
      - techStack: A comma-separated list of technologies mentioned.
      - growthSignals: A summary of growth signals like hiring or scaling.
      - summary: A 1-2 sentence professional summary tailored to the vision.
      - salesRevenue: Categorize into Tiers (Tier 1: Over $50k/mo, etc.).
      - techSpend: "Tech-Forward", "Moderate", or "Legacy".
      - employeeCount: Estimated count or "Founder-Led" (1-10) / "Marketing Director" (50+).
      - marketingAutomation: Platform name or empty.
      - paymentPlatformsCount: Number of payment platforms detected.
      - location: City and State.
      - facebookUrl: Facebook page URL.
      - hasAnalytics: Boolean, true if advanced analytics (Mixpanel, Segment, Amplitude) are detected.
      - hasCRM: Boolean, true if CRM (Salesforce, HubSpot, Pipedrive) is detected.
      - hasGoogleAds: Boolean, true if Google Ads scripts are detected.
      
      Text to analyze:
      ${text}`;

      const fetchWithRetry = async (retries = 2, delay = 1000): Promise<any> => {
        try {
          const response = await genAI.models.generateContent({
            model,
            contents: [{ parts: [{ text: prompt }] }],
            config: {
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  companyName: { type: Type.STRING },
                  domain: { type: Type.STRING },
                  techStack: { type: Type.STRING },
                  growthSignals: { type: Type.STRING },
                  summary: { type: Type.STRING },
                  salesRevenue: { type: Type.STRING },
                  techSpend: { type: Type.STRING },
                  employeeCount: { type: Type.STRING },
                  marketingAutomation: { type: Type.STRING },
                  paymentPlatformsCount: { type: Type.NUMBER },
                  location: { type: Type.STRING },
                  facebookUrl: { type: Type.STRING },
                  hasAnalytics: { type: Type.BOOLEAN },
                  hasCRM: { type: Type.BOOLEAN },
                  hasGoogleAds: { type: Type.BOOLEAN },
                },
                required: [
                  "companyName", "domain", "techStack", "growthSignals", "summary", 
                  "salesRevenue", "techSpend", "employeeCount", "marketingAutomation", 
                  "paymentPlatformsCount", "location", "facebookUrl", "hasAnalytics", "hasCRM", "hasGoogleAds"
                ]
              }
            }
          });
          return JSON.parse(response.text || '{}');
        } catch (e: any) {
          const isRateLimit = e?.message?.includes('429') || e?.status === 'RESOURCE_EXHAUSTED';
          if (isRateLimit && retries > 0) {
            await new Promise(resolve => setTimeout(resolve, delay));
            return fetchWithRetry(retries - 1, delay * 2);
          }
          throw e;
        }
      };

      const result = await fetchWithRetry();
      
      const techStack = (result.techStack || '').toLowerCase();
      const hasShopify = techStack.includes('shopify');
      const hasFBPixel = techStack.includes('facebook pixel') || techStack.includes('fb pixel');
      const hasAIContext = (result.growthSignals || '').length > 20;

      const companyName = result.companyName || 'Unknown Company';
      const newLead: Lead = {
        id: Math.random().toString(36).substr(2, 9),
        company: companyName,
        domain: result.domain || 'N/A',
        initials: companyName.split(' ').map((n: string) => n[0]).join('').toUpperCase().substr(0, 2),
        platform: hasShopify ? 'Shopify' : 'Custom Stack',
        signals: hasFBPixel ? 'FB Pixel Active' : 'No Pixel Found',
        summary: result.summary || 'No summary available.',
        score: 0,
        scoreLabel: '',
        hasShopify,
        hasFBPixel,
        salesRevenue: result.salesRevenue,
        techSpend: result.techSpend,
        employeeCount: result.employeeCount,
        marketingAutomation: result.marketingAutomation,
        paymentPlatforms: result.paymentPlatformsCount,
        location: result.location,
        facebookUrl: result.facebookUrl,
        hasAnalytics: result.hasAnalytics,
        hasCRM: result.hasCRM,
        hasGoogleAds: result.hasGoogleAds,
      };

      const score = calculateScore(newLead, visionModeText, hasAIContext);
      newLead.score = score;
      newLead.scoreLabel = getScoreLabel(score);
      
      setLeads(prev => [newLead, ...prev]);
      setRawText('');
      setShowNewHuntModal(false);
      setActiveTab('decision');
    } catch (error) {
      console.error("AI Analysis Error:", error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const [isTestingConnection, setIsTestingConnection] = useState(false);

  const exportDNAMapping = () => {
    const csvContent = "data:text/csv;charset=utf-8," + 
      "Column Name\n" + 
      displayColumns.join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `dna_mapping_${visionModeText.replace(/\s+/g, '_').toLowerCase()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportStrategicBlueprint = () => {
    const sections = [
      ["Section", "Details"],
      ["Section 1: The Intelligence Core (Vision & Fuel)", `Target: ${visionModeText}. Flow: API Intelligence Fuel -> Scraper -> AI -> Sheets.`],
      ["Section 2: Logic & Quality (The Eyes & Decider)", `Functional Rules: Detect Display Column Mapping (${displayColumns.join(', ')}). Scoring Preview: Shopify (20pt), FB Pixel (30pt), AI Context (50pt).`],
      ["Section 3: Safety & Execution (The Shield & Outbound)", `Cleaned Input: Protocol check (https://) and "Golden 5" test batch ready. Blacklist: ${blacklist.join(', ')}. Trigger: ${triggerAction}.`],
      ["Visual Alignment", "UI includes spots for Signals, Match Score, and AI Pitch."]
    ];

    const csvContent = "data:text/csv;charset=utf-8," + 
      sections.map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(",")).join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `strategic_blueprint_${visionModeText.replace(/\s+/g, '_').toLowerCase()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportPipelineCSV = () => {
    const data = [
      ["Component", "Action", "Details"],
      ["The Hunter (BuiltWith)", "Lists API", `Finding 10 new ${hunterCountry} ${hunterTech} stores.`],
      ["The Librarian (Pandas)", "pd.read_csv()", `Scanning ${hunterCountry}_${hunterTech}_Today.csv`]
    ];

    const csvContent = "data:text/csv;charset=utf-8," + 
      data.map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(",")).join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `pipeline_config_${hunterTech.toLowerCase()}_${hunterCountry.toLowerCase()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const testConnection = async () => {
    setIsTestingConnection(true);
    // Simulate connection test
    await new Promise(resolve => setTimeout(resolve, 1500));
    setIsTestingConnection(false);
    
    const toast = document.createElement('div');
    toast.className = `fixed bottom-8 right-8 bg-tertiary text-white px-6 py-3 rounded-2xl shadow-2xl z-50 font-bold text-sm animate-bounce`;
    toast.innerText = `Successfully connected to ${triggerAction}`;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  };

  const filteredLeads = leads.filter(lead => {
    const matchesScore = lead.score >= filterScore;
    const matchesPlatform = filterPlatform === 'All' || lead.platform === filterPlatform;
    const meetsQuality = lead.score >= qualityThreshold;
    
    const isBlacklisted = blacklist.some(term => 
      lead.company.toLowerCase().includes(term.toLowerCase()) || 
      lead.domain.toLowerCase().includes(term.toLowerCase())
    );
    
    let matchesQuickFilter = true;
    if (activeQuickFilter === 'High Probability') matchesQuickFilter = lead.score >= 80;
    else if (activeQuickFilter === 'Shopify Only') matchesQuickFilter = lead.hasShopify;
    else if (activeQuickFilter === 'Pixel Missing') matchesQuickFilter = !lead.hasFBPixel;
    else if (activeQuickFilter === 'Audit Ready') matchesQuickFilter = !!(lead.salesRevenue || lead.techSpend);
    
    return matchesScore && matchesPlatform && matchesQuickFilter && meetsQuality && !isBlacklisted;
  });

  return (
    <div className="flex min-h-screen bg-surface overflow-x-hidden">
      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={toggleSidebar}
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside className={`
        w-64 fixed inset-y-0 left-0 bg-surface-container-low border-r border-outline-variant/10 p-6 flex flex-col z-50 transition-transform duration-300 lg:translate-x-0
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="mb-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-white shadow-lg shadow-primary/20">
              <Sparkles size={20} />
            </div>
            <div>
              <h1 className="font-headline font-extrabold text-on-surface tracking-tightest text-lg leading-tight">The Lead Hunt</h1>
              <p className="text-[10px] text-on-surface-variant uppercase tracking-widest font-bold">Sovereign Analyst</p>
            </div>
          </div>
          <button onClick={toggleSidebar} className="lg:hidden text-on-surface-variant hover:text-primary transition-colors">
            <X size={24} />
          </button>
        </div>

        <nav className="flex flex-col gap-1 flex-1">
          <SidebarItem icon={LayoutDashboard} label="Decision Center" active={activeTab === 'decision'} onClick={() => { setActiveTab('decision'); setIsSidebarOpen(false); }} />
          <SidebarItem icon={Sparkles} label="Magic Signals" active={activeTab === 'magic'} onClick={() => { setActiveTab('magic'); setIsSidebarOpen(false); }} />
          <SidebarItem icon={Inbox} label="Lead Bucket" active={activeTab === 'bucket'} onClick={() => { setActiveTab('bucket'); setIsSidebarOpen(false); }} />
          <SidebarItem icon={UserSearch} label="Sovereign Settings" active={activeTab === 'settings'} onClick={() => { setActiveTab('settings'); setIsSidebarOpen(false); }} />
        </nav>

        <div className="mt-auto pt-6 space-y-4">
          <div className="bg-surface-container-lowest/50 rounded-xl p-3 border border-outline-variant/10">
            <h4 className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-2">Checkpoints</h4>
            <div className="space-y-2">
              {CHECKPOINTS.map(cp => (
                <div key={cp.id} className="flex items-center gap-2">
                  <CheckCircle2 size={12} className="text-tertiary" />
                  <span className="text-[10px] font-medium text-on-surface">{cp.title}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3 px-2">
            <img 
              src="https://api.dicebear.com/7.x/avataaars/svg?seed=Alex" 
              alt="Alex Mercer" 
              className="w-9 h-9 rounded-full bg-surface-container-lowest border border-outline-variant/30"
            />
            <div className="flex flex-col">
              <span className="text-xs font-bold text-on-surface">Alex Mercer</span>
              <span className="text-[10px] text-on-surface-variant font-medium">Pro Plan</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 lg:ml-64 min-h-screen flex flex-col w-full">
        {/* Top Bar */}
        <header className="h-20 flex items-center justify-between px-4 lg:px-8 sticky top-0 bg-surface/80 backdrop-blur-md z-30 border-b border-outline-variant/5">
          <div className="flex items-center gap-4 flex-1">
            <button onClick={toggleSidebar} className="lg:hidden p-2 text-on-surface-variant hover:text-primary transition-colors">
              <Menu size={24} />
            </button>
            <div className="relative w-full max-w-md hidden sm:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" size={18} />
              <input 
                type="text" 
                placeholder="Search hunted leads..."
                className="w-full pl-10 pr-4 py-2.5 bg-surface-container-low border-none rounded-xl text-sm focus:ring-2 focus:ring-primary/10 transition-all outline-none"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 lg:gap-6">
            <button 
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="p-2 text-on-surface-variant hover:text-primary transition-colors hover:bg-surface-container-low rounded-xl"
              title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
            >
              {isDarkMode ? <Sun size={22} /> : <Moon size={22} />}
            </button>
            <button className="relative text-on-surface-variant hover:text-primary transition-colors">
              <Bell size={22} />
              <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full border-2 border-surface"></span>
            </button>
            <button 
              onClick={() => setShowNewHuntModal(true)}
              className="bg-primary text-white px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold tracking-tight hover:shadow-lg hover:shadow-primary/30 active:scale-95 transition-all flex items-center gap-2"
            >
              <Plus size={18} />
              <span className="hidden xs:inline">ADD NEW HUNT</span>
              <span className="xs:hidden">ADD</span>
            </button>
          </div>
        </header>

        {/* New Hunt Modal */}
        <AnimatePresence>
          {showNewHuntModal && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowNewHuntModal(false)}
                className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative w-full max-w-2xl bg-surface rounded-3xl shadow-2xl overflow-hidden border border-outline-variant/10"
              >
                <div className="p-8 space-y-6">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
                        <Zap size={20} />
                      </div>
                      <div>
                        <h3 className="font-headline font-bold text-xl">Instant Lead Analysis</h3>
                        <p className="text-xs text-on-surface-variant">Paste raw website text or HTML to extract intelligence.</p>
                      </div>
                    </div>
                    <button onClick={() => setShowNewHuntModal(false)} className="p-2 hover:bg-surface-container-low rounded-full transition-colors">
                      <X size={20} />
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div className="relative">
                      <textarea 
                        value={rawText}
                        onChange={(e) => setRawText(e.target.value)}
                        placeholder="Paste raw text from About Us, Careers, or Homepage..."
                        className="w-full h-48 p-4 bg-surface-container-low border-none rounded-2xl text-sm focus:ring-2 focus:ring-primary/20 transition-all outline-none resize-none"
                      />
                      <div className="absolute bottom-4 right-4 text-[10px] font-bold text-on-surface-variant/50 uppercase tracking-widest">
                        AI-Powered Extraction
                      </div>
                    </div>

                    <div className="flex gap-4">
                      <button 
                        onClick={() => analyzeText(rawText)}
                        disabled={isAnalyzing || !rawText.trim()}
                        className={`flex-1 py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all ${
                          isAnalyzing || !rawText.trim() 
                            ? 'bg-surface-container-low text-on-surface-variant cursor-not-allowed' 
                            : 'bg-primary text-white hover:shadow-xl hover:shadow-primary/30 active:scale-[0.98]'
                        }`}
                      >
                        {isAnalyzing ? (
                          <>
                            <Loader2 size={20} className="animate-spin" />
                            Analyzing Intelligence...
                          </>
                        ) : (
                          <>
                            <Send size={18} />
                            Start AI Extraction
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Dashboard Content */}
        <div className="px-4 lg:px-8 py-8 space-y-8 lg:space-y-10 max-w-7xl w-full mx-auto">
          {activeTab === 'decision' && (
            <>
              <section className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                  <motion.h2 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-3xl lg:text-4xl font-extrabold font-headline text-on-surface tracking-tightest"
                  >
                    Decision Center
                  </motion.h2>
                  <motion.p 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="text-sm lg:text-base text-on-surface-variant mt-2 font-medium max-w-2xl"
                  >
                    High-fidelity analysis of your current market opportunities. Signal-driven lead intelligence curated for maximum conversion.
                  </motion.p>
                </div>
                
                <div className="flex flex-wrap gap-2">
                  <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1 w-full">Quick Filters</span>
                  {['All Leads', 'High Probability', 'Shopify Only', 'Pixel Missing', 'Audit Ready'].map((filter) => (
                    <button 
                      key={filter}
                      onClick={() => setActiveQuickFilter(filter)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
                        activeQuickFilter === filter 
                          ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20' 
                          : 'bg-surface border-outline-variant/20 text-on-surface-variant hover:border-primary/30'
                      }`}
                    >
                      {filter}
                    </button>
                  ))}
                </div>
              </section>

              <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
                <StatCard 
                  title="Total Leads Hunted" 
                  value={leads.length.toLocaleString()} 
                  subtext="+12% this week" 
                  icon={TrendingUp} 
                  trend="up" 
                />
                <StatCard 
                  title="High-Probability Matches" 
                  value={leads.filter(l => l.score >= 80).length.toString()} 
                  subtext="Score >= 80 detected" 
                  icon={Verified} 
                  variant="primary" 
                />
                <div className="sm:col-span-2 lg:col-span-1">
                  <StatCard 
                    title="Active Signal Scans" 
                    value={isScraping ? "1" : "0"} 
                    subtext={isScraping ? "Scanning live now" : "System idle"} 
                    icon={Sprout} 
                  />
                </div>
              </section>

              <section className="bg-surface-container-low rounded-2xl lg:rounded-3xl overflow-hidden shadow-sm border border-outline-variant/10">
                <div className="px-4 lg:px-8 py-5 lg:py-6 flex justify-between items-center bg-surface-container-lowest border-b border-outline-variant/10">
                  <h3 className="font-headline font-bold text-base lg:text-lg">Lead Intelligence Dashboard</h3>
                  <div className="flex gap-1 lg:gap-2 relative">
                    <button 
                      onClick={() => setShowFilterMenu(!showFilterMenu)}
                      className={`p-2 lg:p-2.5 hover:bg-surface-container-low rounded-xl transition-colors ${showFilterMenu ? 'bg-primary/10 text-primary' : 'text-on-surface-variant'}`}
                    >
                      <Filter size={18} />
                    </button>
                    
                    <AnimatePresence>
                      {showFilterMenu && (
                        <motion.div 
                          initial={{ opacity: 0, y: 10, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 10, scale: 0.95 }}
                          className="absolute right-0 top-full mt-2 w-64 bg-surface-container-lowest border border-outline-variant/10 rounded-2xl shadow-2xl z-50 p-4 space-y-4"
                        >
                          <div className="space-y-2">
                            <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Min Match Score: {filterScore}</label>
                            <input 
                              type="range" 
                              min="0" 
                              max="100" 
                              step="10"
                              value={filterScore}
                              onChange={(e) => setFilterScore(parseInt(e.target.value))}
                              className="w-full h-1.5 bg-surface-container-low rounded-lg appearance-none cursor-pointer accent-primary"
                            />
                          </div>
                          
                          <div className="space-y-2">
                            <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Platform</label>
                            <select 
                              value={filterPlatform}
                              onChange={(e) => setFilterPlatform(e.target.value)}
                              className="w-full bg-surface-container-low border-none rounded-xl text-xs font-bold p-2.5 focus:ring-1 focus:ring-primary/20"
                            >
                              <option value="All">All Platforms</option>
                              <option value="Shopify">Shopify</option>
                              <option value="Magento">Magento</option>
                              <option value="WooCommerce">WooCommerce</option>
                              <option value="Custom Stack">Custom Stack</option>
                            </select>
                          </div>

                          <button 
                            onClick={() => {
                              setFilterScore(0);
                              setFilterPlatform('All');
                              setShowFilterMenu(false);
                            }}
                            className="w-full py-2 text-[10px] font-bold text-primary hover:bg-primary/5 rounded-lg transition-colors uppercase tracking-widest"
                          >
                            Reset Filters
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <button 
                      onClick={exportToCSV}
                      className="p-2 lg:p-2.5 hover:bg-surface-container-low rounded-xl text-on-surface-variant transition-colors"
                      title="Export to CSV"
                    >
                      <Download size={18} />
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[800px] lg:min-w-0">
                    <thead>
                      <tr className="bg-surface-container-low">
                        <th className="px-4 lg:px-8 py-4 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Company & Source</th>
                        <th className="px-4 lg:px-8 py-4 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest text-center">Shopify</th>
                        <th className="px-4 lg:px-8 py-4 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest text-center">FB Pixel</th>
                        <th className="px-4 lg:px-8 py-4 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Audit Insights</th>
                        <th className="px-4 lg:px-8 py-4 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">AI Intelligence Summary</th>
                        <th className="px-4 lg:px-8 py-4 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest text-center">Match Score</th>
                        <th className="px-4 lg:px-8 py-4"></th>
                      </tr>
                    </thead>
                    <tbody className="bg-surface-container-lowest divide-y divide-outline-variant/5">
                      {filteredLeads.map((lead, idx) => (
                        <motion.tr 
                          key={lead.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.2 + idx * 0.05 }}
                          onClick={() => setSelectedLead(lead)}
                          className="hover:bg-surface-container-low/50 transition-colors group cursor-pointer"
                        >
                          <td className="px-4 lg:px-8 py-6">
                            <div className="flex items-center gap-3 lg:gap-4">
                              <div className="w-10 h-10 rounded-xl bg-surface-container-low flex items-center justify-center font-bold text-primary shrink-0">
                                {lead.initials}
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <div className="font-bold text-on-surface text-sm lg:text-base">{lead.company}</div>
                                  {lead.source && (
                                    <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-md uppercase tracking-widest ${
                                      lead.source === 'BuiltWith' ? 'bg-primary/10 text-primary' : 
                                      lead.source === 'Manual' ? 'bg-tertiary/10 text-tertiary' : 
                                      'bg-on-surface-variant/10 text-on-surface-variant'
                                    }`}>
                                      {lead.source}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <div className="text-[10px] lg:text-xs text-on-surface-variant font-medium">{lead.domain}</div>
                                  {lead.location && (
                                    <>
                                      <span className="text-[10px] text-on-surface-variant/30">•</span>
                                      <div className="flex items-center gap-1 text-[10px] lg:text-xs text-on-surface-variant font-medium">
                                        <Globe size={10} />
                                        {lead.location}
                                      </div>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 lg:px-8 py-6 text-center">
                            <div className="flex justify-center">
                              {lead.hasShopify ? (
                                <div className="flex flex-col items-center gap-1">
                                  <div className="w-6 h-6 bg-tertiary/10 text-tertiary rounded-full flex items-center justify-center">
                                    <CheckCircle2 size={14} />
                                  </div>
                                  <span className="text-[8px] font-bold text-tertiary uppercase tracking-tighter">YES</span>
                                </div>
                              ) : (
                                <div className="flex flex-col items-center gap-1">
                                  <div className="w-6 h-6 bg-on-surface-variant/10 text-on-surface-variant rounded-full flex items-center justify-center">
                                    <X size={14} />
                                  </div>
                                  <span className="text-[8px] font-bold text-on-surface-variant uppercase tracking-tighter">NO</span>
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-4 lg:px-8 py-6 text-center">
                            <div className="flex justify-center">
                              {lead.hasFBPixel ? (
                                <div className="flex flex-col items-center gap-1">
                                  <div className="w-6 h-6 bg-tertiary/10 text-tertiary rounded-full flex items-center justify-center">
                                    <CheckCircle2 size={14} />
                                  </div>
                                  <span className="text-[8px] font-bold text-tertiary uppercase tracking-tighter">YES</span>
                                </div>
                              ) : (
                                <div className="flex flex-col items-center gap-1">
                                  <div className="w-6 h-6 bg-on-surface-variant/10 text-on-surface-variant rounded-full flex items-center justify-center">
                                    <X size={14} />
                                  </div>
                                  <span className="text-[8px] font-bold text-on-surface-variant uppercase tracking-tighter">NO</span>
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-4 lg:px-8 py-6">
                            <div className="flex flex-wrap gap-1.5 max-w-[200px]">
                              {lead.salesRevenue && (
                                <span className="px-2 py-0.5 bg-primary/5 text-primary text-[9px] font-bold rounded-full uppercase tracking-wider">
                                  {lead.salesRevenue}
                                </span>
                              )}
                              {lead.techSpend === 'Tech-Forward' && (
                                <span className="px-2 py-0.5 bg-tertiary/5 text-tertiary text-[9px] font-bold rounded-full uppercase tracking-wider">
                                  Tech-Forward
                                </span>
                              )}
                              {lead.employeeCount && (
                                <span className="px-2 py-0.5 bg-on-surface-variant/5 text-on-surface-variant text-[9px] font-bold rounded-full uppercase tracking-wider">
                                  {lead.employeeCount}
                                </span>
                              )}
                              {lead.paymentPlatforms && lead.paymentPlatforms >= 5 && (
                                <span className="px-2 py-0.5 bg-amber-500/5 text-amber-600 text-[9px] font-bold rounded-full uppercase tracking-wider">
                                  High-Volume Checkout
                                </span>
                              )}
                              {lead.marketingAutomation ? (
                                <span className="px-2 py-0.5 bg-indigo-500/5 text-indigo-600 text-[9px] font-bold rounded-full uppercase tracking-wider">
                                  {lead.marketingAutomation}
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 bg-red-500/5 text-red-600 text-[9px] font-bold rounded-full uppercase tracking-wider border border-red-500/10">
                                  Missed Opportunity
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 lg:px-8 py-6">
                            <p className="text-xs text-on-surface-variant leading-relaxed max-w-xs line-clamp-2 lg:line-clamp-none">
                              {lead.summary}
                            </p>
                          </td>
                          <td className="px-4 lg:px-8 py-6 text-center">
                            <div className="inline-flex flex-col items-center">
                              <span className={`text-xl lg:text-2xl font-extrabold font-headline ${
                                lead.score >= 90 ? 'text-tertiary' : lead.score >= 70 ? 'text-primary' : 'text-on-surface-variant'
                              }`}>
                                {lead.score}
                              </span>
                              <div className="flex items-center gap-1.5">
                                <span className={`text-[8px] lg:text-[9px] font-bold uppercase tracking-widest ${
                                  lead.score >= 90 ? 'text-tertiary/70' : lead.score >= 70 ? 'text-primary/70' : 'text-on-surface-variant/70'
                                }`}>
                                  {lead.scoreLabel}
                                </span>
                                <div className="flex gap-0.5">
                                  {lead.hasShopify && <span className="text-[7px] font-bold text-primary" title="Shopify Detected (+20)">[S]</span>}
                                  {lead.hasFBPixel && <span className="text-[7px] font-bold text-tertiary" title="FB Pixel Active (+30)">[P]</span>}
                                  {lead.score > (lead.hasShopify ? 20 : 0) + (lead.hasFBPixel ? 30 : 0) && (
                                    <span className="text-[7px] font-bold text-amber-500" title="Audit Insights (+50)">[A]</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 lg:px-8 py-6 text-right">
                            <button className="opacity-0 group-hover:opacity-100 transition-opacity p-2 text-primary">
                              <ChevronRight size={18} />
                            </button>
                          </td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}

          {activeTab === 'magic' && (
            <div className="space-y-8">
              <section className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div>
                  <h2 className="text-3xl lg:text-4xl font-extrabold font-headline text-on-surface tracking-tightest">Magic Signals</h2>
                  <p className="text-on-surface-variant mt-2 font-medium max-w-2xl">
                    Automated lead enrichment engine. Configure your intelligence fuel and trigger AI-powered extraction.
                  </p>
                </div>
                
                <div className="flex flex-wrap gap-4">
                  <div className="bg-surface-container-low p-4 rounded-2xl border border-outline-variant/10 flex gap-6">
                    <div className="space-y-1">
                      <div className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest flex items-center gap-2">
                        Scoring Protocol
                        {apiStatus.hasBuiltWithKey ? (
                          <span className="flex items-center gap-1 text-tertiary">
                            <CheckCircle2 size={10} />
                            <span className="text-[8px]">BuiltWith Key Active</span>
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-red-500">
                            <X size={10} />
                            <span className="text-[8px]">BuiltWith Key Missing</span>
                          </span>
                        )}
                        {visionModeText.toLowerCase().includes('security') && (
                          <div className="flex gap-2 ml-2">
                            {apiStatus.hasShodanKey ? (
                              <span className="flex items-center gap-1 text-tertiary">
                                <CheckCircle2 size={10} />
                                <span className="text-[8px]">Shodan Active</span>
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-red-500">
                                <X size={10} />
                                <span className="text-[8px]">Shodan Missing</span>
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-3">
                        <div className="flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-full bg-primary"></div>
                          <span className="text-[10px] font-bold text-on-surface">Shopify (20pt)</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-full bg-tertiary"></div>
                          <span className="text-[10px] font-bold text-on-surface">Pixel (30pt)</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                          <span className="text-[10px] font-bold text-on-surface">Audit (50pt)</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-surface-container-low p-4 rounded-2xl border border-outline-variant/10 flex gap-6">
                    <div className="space-y-1">
                      <div className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Active Hunter</div>
                      <div className="flex gap-4">
                        <div className="flex items-center gap-1.5">
                          <Globe size={12} className="text-primary" />
                          <select 
                            value={hunterCountry}
                            onChange={(e) => setHunterCountry(e.target.value)}
                            className="bg-transparent text-[10px] font-bold text-on-surface border-none focus:ring-0 p-0 cursor-pointer"
                          >
                            <option value="GB">UK (GB)</option>
                            <option value="US">USA (US)</option>
                            <option value="CA">Canada (CA)</option>
                            <option value="AU">Australia (AU)</option>
                            <option value="DE">Germany (DE)</option>
                          </select>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <ShoppingBag size={12} className="text-tertiary" />
                          <select 
                            value={hunterTech}
                            onChange={(e) => setHunterTech(e.target.value)}
                            className="bg-transparent text-[10px] font-bold text-on-surface border-none focus:ring-0 p-0 cursor-pointer"
                          >
                            <option value="Shopify">Shopify</option>
                            <option value="Magento">Magento</option>
                            <option value="WooCommerce">WooCommerce</option>
                            <option value="BigCommerce">BigCommerce</option>
                            <option value="Klaviyo">Klaviyo</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column: Pipeline & Fuel */}
                <div className="lg:col-span-2 space-y-6">
                  {/* API Intelligence Fuel (The Gasoline) */}
                  <div className="bg-surface-container-lowest p-8 rounded-3xl border border-outline-variant/10 shadow-sm space-y-6">
                    <div className="flex items-center justify-between">
                      <h3 className="font-headline font-bold text-xl flex items-center gap-2">
                        <Database className="text-primary" size={24} />
                        API Intelligence Fuel (The "Gasoline")
                      </h3>
                      <div className="flex items-center gap-2">
                        {isApiConnected === true && (
                          <span className="flex items-center gap-1 text-tertiary text-[10px] font-bold uppercase tracking-widest bg-tertiary/10 px-2 py-1 rounded-md">
                            <CheckCircle2 size={12} />
                            Connected
                          </span>
                        )}
                        {isApiConnected === false && (
                          <span className="flex items-center gap-1 text-red-500 text-[10px] font-bold uppercase tracking-widest bg-red-500/10 px-2 py-1 rounded-md">
                            <AlertCircle size={12} />
                            Disconnected
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <input 
                            type="text" 
                            value={apiDataFeed}
                            onChange={(e) => {
                              setApiDataFeed(e.target.value);
                              setIsApiConnected(null);
                            }}
                            placeholder="Enter BuiltWith API Link, Shodan, or Custom Webhook..."
                            className="w-full px-4 py-3 bg-surface-container-low border-none rounded-xl text-sm focus:ring-2 focus:ring-primary/10 transition-all outline-none"
                          />
                          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                            <Database size={14} className="text-on-surface-variant/30" />
                          </div>
                        </div>
                        <button 
                          onClick={async () => {
                            setIsApiConnected(null);
                            try {
                              if (apiDataFeed.includes('YOUR_API_KEY') || apiDataFeed.includes('[YOUR_KEY]')) {
                                // Enable Demo Mode
                                setIsApiConnected(true);
                                const toast = document.createElement('div');
                                toast.className = `fixed bottom-8 right-8 bg-amber-500 text-white px-6 py-3 rounded-2xl shadow-2xl z-50 font-bold text-sm animate-bounce`;
                                toast.innerText = "Demo Intelligence Fuel Active (Using Mock Data)";
                                document.body.appendChild(toast);
                                setTimeout(() => toast.remove(), 3000);
                                return;
                              }

                              const response = await fetch(`/api/proxy?url=${encodeURIComponent(apiDataFeed)}`);
                              const data = await response.json();
                              
                              if (!response.ok) {
                                if (response.status === 404) {
                                  throw new Error("API Endpoint Not Found (404). Please check the URL path.");
                                }
                                throw new Error(data.error || `API Error ${response.status}`);
                              }
                              
                              const connected = !!data;
                              setIsApiConnected(connected);
                              
                              const toast = document.createElement('div');
                              toast.className = `fixed bottom-8 right-8 ${connected ? 'bg-tertiary' : 'bg-red-500'} text-white px-6 py-3 rounded-2xl shadow-2xl z-50 font-bold text-sm animate-bounce`;
                              toast.innerText = connected ? "API Intelligence Fuel Verified" : "Invalid API Response";
                              document.body.appendChild(toast);
                              setTimeout(() => toast.remove(), 3000);
                            } catch (error: any) {
                              console.error("API Verification Error:", error);
                              setIsApiConnected(false);
                              const toast = document.createElement('div');
                              toast.className = `fixed bottom-8 right-8 bg-red-500 text-white px-6 py-3 rounded-2xl shadow-2xl z-50 font-bold text-sm animate-bounce`;
                              toast.innerText = error.message || "Connection Failed (Check URL or API Status)";
                              document.body.appendChild(toast);
                              setTimeout(() => toast.remove(), 3000);
                            }
                          }}
                          className={`px-6 py-3 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                            isApiConnected === true ? 'bg-tertiary/10 text-tertiary' : 'bg-primary/10 text-primary hover:bg-primary hover:text-white'
                          }`}
                        >
                          {isApiConnected === null && <Loader2 size={14} className="animate-spin" />}
                          {isApiConnected === true ? 'Verified' : 'Fetch & Verify'}
                        </button>
                      </div>
                      <p className="text-[10px] text-on-surface-variant leading-relaxed">
                        This input bypasses browser security (CORS) via a server-side proxy to "ping" your data source directly.
                      </p>
                    </div>
                  </div>

                  <div className="bg-surface-container-lowest p-8 rounded-3xl border border-outline-variant/10 shadow-sm space-y-8">
                    <h3 className="font-headline font-bold text-xl flex items-center gap-2">
                      <Cpu className="text-primary" size={24} />
                      Lead Intelligence Pipeline
                    </h3>

                    <div className="relative flex flex-col gap-12">
                      {/* Stage 1: The Hunter */}
                      <div className={`flex items-center gap-6 transition-all duration-500 ${scrapeStep >= 1 ? 'opacity-100' : 'opacity-40'}`}>
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${scrapeStep === 1 ? 'bg-primary text-white animate-pulse' : scrapeStep > 1 ? 'bg-tertiary text-white' : 'bg-surface-container-low text-on-surface-variant'}`}>
                          <Search size={24} />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <h4 className="font-bold text-on-surface">Stage 1: The Hunter (Data Acquisition)</h4>
                            {scrapeStep >= 1 && (
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  exportToCSV();
                                }}
                                className="text-[10px] font-bold text-primary hover:underline flex items-center gap-1"
                              >
                                <Download size={10} />
                                Export Raw
                              </button>
                            )}
                          </div>
                          <p className="text-xs text-on-surface-variant">The system checks your API Intelligence Fuel. If Verified, it pings the live endpoint to fetch 10–50 domains matching your {hunterTech} {hunterCountry} settings. If no custom API is connected, it uses a built-in Hunter Proxy to retrieve high-intent mock leads.</p>
                        </div>
                        {scrapeStep > 1 && <CheckCircle2 className="text-tertiary" size={20} />}
                      </div>

                      {/* Stage 2: The Librarian */}
                      <div className={`flex items-center gap-6 transition-all duration-500 ${scrapeStep >= 2 ? 'opacity-100' : 'opacity-40'}`}>
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${scrapeStep === 2 ? 'bg-primary text-white animate-pulse' : scrapeStep > 2 ? 'bg-tertiary text-white' : 'bg-surface-container-low text-on-surface-variant'}`}>
                          <FileUp size={24} />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-bold text-on-surface">Stage 2: The Librarian (Data Normalization)</h4>
                          <p className="text-xs text-on-surface-variant">The system passes the raw JSON/CSV data through a simulated Pandas layer to map headers and remove duplicates.</p>
                        </div>
                        {scrapeStep > 2 && <CheckCircle2 className="text-tertiary" size={20} />}
                      </div>

                      {/* Stage 3: Python Scraper */}
                      <div className={`flex items-center gap-6 transition-all duration-500 ${scrapeStep >= 3 ? 'opacity-100' : 'opacity-40'}`}>
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${scrapeStep === 3 ? 'bg-primary text-white animate-pulse' : scrapeStep > 3 ? 'bg-tertiary text-white' : 'bg-surface-container-low text-on-surface-variant'}`}>
                          <Sparkles size={24} />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-bold text-on-surface">Stage 3: Python Scraper (Signal Verification)</h4>
                          <p className="text-xs text-on-surface-variant">A simulated headless browser "pings" each domain. Shopify Check: Looks for cdn.shopify.com (+20pt). Pixel Check: Looks for Facebook Pixel initialization (+30pt).</p>
                        </div>
                        {scrapeStep > 3 && <CheckCircle2 className="text-tertiary" size={20} />}
                      </div>

                      {/* Stage 4: AI Synthesis & Audit */}
                      <div className={`flex items-center gap-6 transition-all duration-500 ${scrapeStep >= 4 ? 'opacity-100' : 'opacity-40'}`}>
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${scrapeStep === 4 ? 'bg-primary text-white animate-pulse' : scrapeStep > 4 ? 'bg-tertiary text-white' : 'bg-surface-container-low text-on-surface-variant'}`}>
                          <Table size={24} />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-bold text-on-surface">Stage 4: AI Synthesis & Audit (The "Checkmate")</h4>
                          <p className="text-xs text-on-surface-variant">Gemini performs a Financial & Technical Audit, estimating revenue and employee count, writing strategic summaries, and applying the final +50pt for "Audit Insights."</p>
                        </div>
                        {scrapeStep > 4 && <CheckCircle2 className="text-tertiary" size={20} />}
                      </div>

                      {/* Final Synthesis */}
                      {scrapeStep > 4 && (
                        <motion.div 
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="mt-4 p-4 bg-tertiary/10 border border-tertiary/20 rounded-2xl text-center"
                        >
                          <p className="font-headline font-black text-tertiary tracking-widest uppercase text-sm">
                            Vision Locked. Fuel Connected. Ready to Hunt.
                          </p>
                        </motion.div>
                      )}

                      {/* Connector Line */}
                      <div className="absolute left-6 top-12 bottom-12 w-0.5 bg-outline-variant/20 -z-10" />
                    </div>

                    <div className="flex flex-col gap-3">
                      <button 
                        onClick={() => runScraper()}
                        disabled={isScraping}
                        className={`w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all ${isScraping ? 'bg-surface-container-low text-on-surface-variant cursor-not-allowed' : 'bg-primary text-white hover:shadow-xl hover:shadow-primary/30 active:scale-[0.98]'}`}
                      >
                        {isScraping ? (
                          <>
                            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}>
                              <Cpu size={20} />
                            </motion.div>
                            Processing Batch...
                          </>
                        ) : (
                          <>
                            <Zap size={20} />
                            Run "{hunterTech} {hunterCountry}" Hunt
                          </>
                        )}
                      </button>

                      <div className="relative">
                        <input 
                          type="file" 
                          accept=".csv" 
                          onChange={handleFileUpload}
                          className="absolute inset-0 opacity-0 cursor-pointer"
                          disabled={isScraping}
                        />
                        <button 
                          disabled={isScraping}
                          className={`w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-2 border-2 border-dashed transition-all ${isScraping ? 'bg-surface-container-low text-on-surface-variant border-outline-variant/20 cursor-not-allowed' : 'border-primary/30 text-primary hover:bg-primary/5 hover:border-primary'}`}
                        >
                          <FileUp size={20} />
                          Upload Custom CSV
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Checklist / Verification */}
                <div className="space-y-6">
                  <div className="bg-surface-container-lowest p-6 rounded-3xl border border-outline-variant/10 shadow-sm">
                    <h3 className="font-headline font-bold text-lg mb-4 flex items-center gap-2">
                      <Table className="text-primary" size={20} />
                      The Librarian's Logic
                    </h3>
                    <div className="space-y-4">
                      <div className="p-3 bg-surface-container-low rounded-xl">
                        <h4 className="text-[10px] font-bold uppercase tracking-widest text-primary mb-1">1. The Hunter (BuiltWith)</h4>
                        <p className="text-[11px] text-on-surface-variant leading-relaxed">
                          Connects to BuiltWith Lists API to fetch the newest 10 Shopify stores in the UK automatically every morning.
                        </p>
                      </div>
                      <div className="p-3 bg-surface-container-low rounded-xl">
                        <h4 className="text-[10px] font-bold uppercase tracking-widest text-primary mb-1">2. The Librarian (Pandas)</h4>
                        <p className="text-[11px] text-on-surface-variant leading-relaxed">
                          <code className="bg-primary/10 px-1 rounded">pd.read_csv()</code> maps headers (Root Domain, Company) and prepares the data for the Scraper.
                        </p>
                      </div>
                      <div className="p-3 bg-surface-container-low rounded-xl">
                        <h4 className="text-[10px] font-bold uppercase tracking-widest text-primary mb-1">3. Why not Excel?</h4>
                        <p className="text-[11px] text-on-surface-variant leading-relaxed">
                          <strong>Repeatable:</strong> Cleans new lists in 0.5s. <strong>Error-Free:</strong> No manual copy-pasting or broken links.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-surface-container-lowest p-6 rounded-3xl border border-outline-variant/10 shadow-sm">
                    <h3 className="font-headline font-bold text-lg mb-6">Automation Checkpoints</h3>
                    <div className="space-y-6">
                      {CHECKPOINTS.map(cp => (
                        <div key={cp.id} className="space-y-2">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 size={18} className="text-tertiary" />
                            <h4 className="font-bold text-sm text-on-surface">{cp.title}</h4>
                          </div>
                          <p className="text-xs text-on-surface-variant pl-7 leading-relaxed">{cp.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-primary/5 p-6 rounded-3xl border border-primary/10">
                    <h4 className="font-bold text-primary text-sm flex items-center gap-2 mb-2">
                      <AlertCircle size={16} />
                      Specialist Note
                    </h4>
                    <p className="text-xs text-on-surface-variant leading-relaxed">
                      The FB Pixel signal is the "Hook". It proves the lead is already investing in traffic, making them a high-intent prospect for conversion optimization services.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'bucket' && (
            <div className="space-y-8">
              <section>
                <h2 className="text-3xl lg:text-4xl font-extrabold font-headline text-on-surface tracking-tightest">Lead Bucket</h2>
                <p className="text-on-surface-variant mt-2 font-medium max-w-2xl">
                  Your high-priority targets ready for outreach.
                </p>
              </section>

              {bucketLeads.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center space-y-4 bg-surface-container-low rounded-3xl border border-dashed border-outline-variant">
                  <div className="w-20 h-20 bg-surface-container-lowest rounded-full flex items-center justify-center text-on-surface-variant shadow-sm">
                    <Inbox size={40} />
                  </div>
                  <div>
                    <h3 className="font-headline font-bold text-xl">Your bucket is empty</h3>
                    <p className="text-on-surface-variant max-w-sm">Save leads from the Decision Center to start building your outreach list.</p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {bucketLeads.map(lead => (
                    <motion.div 
                      key={lead.id}
                      layoutId={lead.id}
                      className="bg-surface-container-lowest p-6 rounded-3xl border border-outline-variant/10 shadow-sm space-y-4 group relative"
                    >
                      <button 
                        onClick={() => removeFromBucket(lead.id)}
                        className="absolute top-4 right-4 p-2 text-on-surface-variant hover:text-red-500 transition-colors"
                      >
                        <X size={18} />
                      </button>
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center font-bold text-primary text-xl">
                          {lead.initials}
                        </div>
                        <div>
                          <h4 className="font-bold text-on-surface">{lead.company}</h4>
                          <p className="text-xs text-on-surface-variant">{lead.domain}</p>
                        </div>
                      </div>
                      <p className="text-xs text-on-surface-variant line-clamp-3 leading-relaxed">
                        {lead.summary}
                      </p>
                      <div className="flex items-center justify-between pt-2">
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-extrabold font-headline text-primary">{lead.score}</span>
                          <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">{lead.scoreLabel}</span>
                        </div>
                        <button 
                          onClick={() => setSelectedLead(lead)}
                          className="text-xs font-bold text-primary hover:underline"
                        >
                          View Details
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="space-y-8 max-w-5xl mx-auto">
              <section>
                <h2 className="text-3xl lg:text-4xl font-extrabold font-headline text-on-surface tracking-tightest">Sovereign Settings</h2>
                <p className="text-on-surface-variant mt-2 font-medium max-w-2xl">
                  DNA Reconfiguration: Master control for your intelligence operating system.
                </p>
              </section>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Left Column: Settings */}
                <div className="lg:col-span-7 space-y-8">
                  {/* Section 1: The Intelligence Core (Vision & Fuel) */}
                  <div className="bg-surface-container-lowest p-8 rounded-3xl border border-outline-variant/10 shadow-sm space-y-6">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                        <Cpu size={18} />
                      </div>
                      <h3 className="font-headline font-bold text-lg">Section 1: The Intelligence Core (Vision & Fuel)</h3>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-2 flex items-center justify-between">
                          <span className="flex items-center gap-2">Vision Mode (Industry Pivot) <Sparkles size={12} className="text-primary" /></span>
                          {isGeneratingSummary && <Loader2 size={10} className="animate-spin text-primary" />}
                        </label>
                        <div className="relative">
                          <input 
                            type="text" 
                            value={visionModeText}
                            onChange={(e) => setVisionModeText(e.target.value)}
                            placeholder="e.g., Web3 Infrastructure or Technical Recruitment"
                            className="w-full px-4 py-3 bg-surface-container-low border-none rounded-xl text-sm focus:ring-2 focus:ring-primary/10 transition-all outline-none"
                          />
                          <div className="absolute right-3 top-1/2 -translate-y-1/2">
                            <button 
                              onClick={() => {
                                const trends = ['Web3 Infrastructure', 'AI-First SaaS', 'Sustainable E-commerce', 'Fractional CMO Agency', 'Technical Recruiter', 'DeFi Protocol Growth', 'Cybersecurity Risk Guard', 'SaaS / B2B Seller (Competitor Flip)', 'M&A / Private Equity'];
                                const randomTrend = trends[Math.floor(Math.random() * trends.length)];
                                setVisionModeText(randomTrend);
                              }}
                              className="p-2 hover:bg-primary/10 rounded-xl text-primary transition-all flex items-center gap-2 group"
                              title="AI Suggestion: Trending Industry"
                            >
                              <Sparkles size={16} className="group-hover:rotate-12 transition-transform" />
                              <span className="text-[10px] font-bold uppercase tracking-widest hidden group-hover:block">Trending</span>
                            </button>
                          </div>
                        </div>
                      </div>

                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-2 block">API Intelligence Fuel</label>
                        <div className="flex gap-2">
                          <div className="relative flex-1">
                            <input 
                              type="text" 
                              value={apiDataFeed}
                              onChange={(e) => {
                                setApiDataFeed(e.target.value);
                                setIsApiConnected(null);
                              }}
                              placeholder="Enter BuiltWith API Link or Custom Webhook..."
                              className="w-full px-4 py-3 bg-surface-container-low border-none rounded-xl text-sm focus:ring-2 focus:ring-primary/10 transition-all outline-none"
                            />
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                              {isApiConnected === true && <CheckCircle2 size={14} className="text-tertiary" />}
                              {isApiConnected === false && <AlertCircle size={14} className="text-red-500" />}
                              <Database size={14} className="text-on-surface-variant/30" />
                            </div>
                          </div>
                          <button 
                            onClick={async () => {
                              setIsApiConnected(null);
                              try {
                                if (apiDataFeed.includes('YOUR_API_KEY') || apiDataFeed.includes('[YOUR_KEY]')) {
                                  // Enable Demo Mode
                                  setIsApiConnected(true);
                                  const toast = document.createElement('div');
                                  toast.className = `fixed bottom-8 right-8 bg-amber-500 text-white px-6 py-3 rounded-2xl shadow-2xl z-50 font-bold text-sm animate-bounce`;
                                  toast.innerText = "Demo Intelligence Fuel Active (Using Mock Data)";
                                  document.body.appendChild(toast);
                                  setTimeout(() => toast.remove(), 3000);
                                  return;
                                }

                                const response = await fetch(`/api/proxy?url=${encodeURIComponent(apiDataFeed)}`);
                                const data = await response.json();
                                
                                if (!response.ok) {
                                  if (response.status === 404) {
                                    throw new Error("API Endpoint Not Found (404). Please check the URL path.");
                                  }
                                  throw new Error(data.error || `API Error ${response.status}`);
                                }
                                
                                const connected = !!data;
                                setIsApiConnected(connected);
                                
                                const toast = document.createElement('div');
                                toast.className = `fixed bottom-8 right-8 ${connected ? 'bg-tertiary' : 'bg-red-500'} text-white px-6 py-3 rounded-2xl shadow-2xl z-50 font-bold text-sm animate-bounce`;
                                toast.innerText = connected ? "API Connection Verified" : "Invalid API Response";
                                document.body.appendChild(toast);
                                setTimeout(() => toast.remove(), 3000);
                              } catch (error: any) {
                                console.error("API Verification Error:", error);
                                setIsApiConnected(false);
                                const toast = document.createElement('div');
                                toast.className = `fixed bottom-8 right-8 bg-red-500 text-white px-6 py-3 rounded-2xl shadow-2xl z-50 font-bold text-sm animate-bounce`;
                                toast.innerText = error.message || "Connection Failed (Check URL or API Status)";
                                document.body.appendChild(toast);
                                setTimeout(() => toast.remove(), 3000);
                              }
                            }}
                            className={`px-6 py-3 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                              isApiConnected === true ? 'bg-tertiary/10 text-tertiary' : 'bg-primary/10 text-primary hover:bg-primary hover:text-white'
                            }`}
                          >
                            {isApiConnected === null && <Loader2 size={14} className="animate-spin" />}
                            {isApiConnected === true ? 'Connected' : 'Fetch & Verify'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Section 2: Logic & Quality (The Eyes & Decider) */}
                  <div className="bg-surface-container-lowest p-8 rounded-3xl border border-outline-variant/10 shadow-sm space-y-6">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-600">
                        <Filter size={18} />
                      </div>
                      <h3 className="font-headline font-bold text-lg">Section 2: Logic & Quality (The Eyes & Decider)</h3>
                    </div>

                    <div className="space-y-6">
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-3 block">Display Column Mapping (The Eyes)</label>
                        <div className="flex flex-wrap gap-2">
                          {displayColumns.map(col => (
                            <div key={col} className="px-3 py-1.5 bg-surface-container-low border border-outline-variant/10 rounded-full text-xs font-bold text-on-surface flex items-center gap-2 group cursor-move">
                              <Menu size={12} className="text-on-surface-variant/30" />
                              {col}
                              <button 
                                onClick={() => setDisplayColumns(displayColumns.filter(c => c !== col))}
                                className="text-on-surface-variant hover:text-red-500 transition-colors"
                              >
                                <X size={12} />
                              </button>
                            </div>
                          ))}
                          <button 
                            onClick={() => {
                              const newCol = prompt('Enter column name:');
                              if (newCol) setDisplayColumns([...displayColumns, newCol]);
                            }}
                            className="px-3 py-1.5 border border-dashed border-outline-variant/30 rounded-full text-xs font-bold text-on-surface-variant hover:border-primary hover:text-primary transition-all flex items-center gap-1"
                          >
                            <Plus size={12} />
                            Add New
                          </button>
                        </div>
                        {apiSuggestions.length > 0 && (
                          <div className="mt-4 p-4 bg-primary/5 rounded-2xl border border-primary/10">
                            <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-2">AI Suggestions for {visionModeText}:</p>
                            <div className="flex flex-wrap gap-2">
                              {apiSuggestions.map(suggestion => (
                                <button 
                                  key={suggestion}
                                  onClick={() => !displayColumns.includes(suggestion) && setDisplayColumns([...displayColumns, suggestion])}
                                  className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all ${
                                    displayColumns.includes(suggestion) 
                                      ? 'bg-primary text-white' 
                                      : 'bg-white border border-primary/20 text-primary hover:bg-primary/10'
                                  }`}
                                >
                                  + {suggestion}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      <div>
                        <div className="flex justify-between items-center mb-3">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant block">Minimum Quality Threshold (The Decider)</label>
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                            qualityThreshold >= 75 ? 'bg-tertiary/10 text-tertiary' : 
                            qualityThreshold >= 40 ? 'bg-amber-500/10 text-amber-600' : 
                            'bg-red-500/10 text-red-600'
                          }`}>
                            {qualityThreshold}%
                          </span>
                        </div>
                        <div className="relative h-6 flex items-center">
                          <div className="absolute inset-0 h-1.5 bg-gradient-to-r from-red-500 via-amber-500 to-tertiary rounded-full top-1/2 -translate-y-1/2 opacity-20" />
                          <input 
                            type="range" 
                            min="0" 
                            max="100" 
                            value={qualityThreshold}
                            onChange={(e) => setQualityThreshold(parseInt(e.target.value))}
                            className="w-full h-1.5 bg-transparent appearance-none cursor-pointer accent-primary relative z-10"
                          />
                        </div>
                      </div>

                      <div className="p-4 bg-surface-container-low rounded-2xl border border-outline-variant/10 space-y-3">
                        <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Scoring Preview (The Math)</p>
                        <div className="space-y-2">
                          {visionModeText.toLowerCase().includes('web3') ? (
                            <>
                              <div className="flex justify-between text-[10px] font-medium"><span>Tech-Forward Marker</span><span className="text-primary">+30pts</span></div>
                              <div className="flex justify-between text-[10px] font-medium"><span>Analytics Detected</span><span className="text-primary">+20pts</span></div>
                            </>
                          ) : visionModeText.toLowerCase().includes('recruit') ? (
                            <>
                              <div className="flex justify-between text-[10px] font-medium"><span>50+ Employees</span><span className="text-primary">+30pts</span></div>
                              <div className="flex justify-between text-[10px] font-medium"><span>CRM Detected</span><span className="text-primary">+20pts</span></div>
                            </>
                          ) : visionModeText.toLowerCase().includes('security') ? (
                            <>
                              <div className="flex justify-between text-[10px] font-medium"><span>Vulnerability Score</span><span className="text-primary">+25pts</span></div>
                              <div className="flex justify-between text-[10px] font-medium"><span>Tech Risk Profile</span><span className="text-primary">+25pts</span></div>
                            </>
                          ) : (
                            <>
                              <div className="flex justify-between text-[10px] font-medium"><span>Shopify Engine</span><span className="text-primary">+25pts</span></div>
                              <div className="flex justify-between text-[10px] font-medium"><span>FB Pixel Active</span><span className="text-primary">+25pts</span></div>
                            </>
                          )}
                          <div className="flex justify-between text-[10px] font-medium pt-2 border-t border-outline-variant/5"><span>AI Intelligence Context</span><span className="text-primary">+40pts</span></div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Section 3: Safety & Execution (The Shield & Outbound) */}
                  <div className="bg-surface-container-lowest p-8 rounded-3xl border border-outline-variant/10 shadow-sm space-y-6">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center text-red-600">
                        <AlertCircle size={18} />
                      </div>
                      <h3 className="font-headline font-bold text-lg">Section 3: Safety & Execution (The Shield & Outbound)</h3>
                    </div>

                    <div className="space-y-6">
                      <details className="group">
                        <summary className="list-none cursor-pointer">
                          <div className="flex items-center justify-between">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant block">Global Blacklist (The Shield)</label>
                            <ChevronDown size={14} className="text-on-surface-variant group-open:rotate-180 transition-transform" />
                          </div>
                        </summary>
                        <div className="mt-3 flex flex-wrap gap-2 p-3 bg-surface-container-low rounded-2xl border border-outline-variant/5 min-h-[50px]">
                          {blacklist.map(tag => (
                            <span key={tag} className="px-2 py-1 bg-surface-container-lowest border border-outline-variant/10 rounded-lg text-[10px] font-bold text-on-surface flex items-center gap-1.5">
                              {tag}
                              <button onClick={() => setBlacklist(blacklist.filter(t => t !== tag))} className="text-on-surface-variant hover:text-red-500">
                                <X size={10} />
                              </button>
                            </span>
                          ))}
                          <input 
                            type="text" 
                            placeholder="Type & Enter..."
                            className="bg-transparent border-none focus:ring-0 p-0 text-[10px] font-bold text-on-surface placeholder:text-on-surface-variant/30 flex-1 min-w-[80px]"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                const val = (e.target as HTMLInputElement).value.trim();
                                if (val && !blacklist.includes(val)) {
                                  setBlacklist([...blacklist, val]);
                                  (e.target as HTMLInputElement).value = '';
                                }
                              }
                            }}
                          />
                        </div>
                      </details>

                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-2 block">Trigger Action (The Outbound)</label>
                        <div className="flex gap-3">
                          <select 
                            value={triggerAction}
                            onChange={(e) => setTriggerAction(e.target.value)}
                            className="flex-1 px-4 py-3 bg-surface-container-low border-none rounded-xl text-sm font-bold focus:ring-2 focus:ring-primary/10 transition-all outline-none"
                          >
                            <option value="Export to Google Sheets">Export to Google Sheets</option>
                            <option value="Send to Slack">Send to Slack</option>
                            <option value="Add to GoHighLevel">Add to GoHighLevel</option>
                            <option value="Webhook Outbound">Webhook Outbound</option>
                          </select>
                          <button 
                            onClick={testConnection}
                            disabled={isTestingConnection}
                            className="px-4 py-3 bg-surface-container-low hover:bg-primary/10 hover:text-primary rounded-xl text-xs font-bold transition-all border border-outline-variant/5 flex items-center gap-2 disabled:opacity-50"
                          >
                            {isTestingConnection ? <Loader2 size={14} className="animate-spin" /> : null}
                            Test Connection
                          </button>
                        </div>
                        <div className="mt-2 flex items-center gap-1.5">
                          <div className="w-1.5 h-1.5 rounded-full bg-tertiary animate-pulse" />
                          <span className="text-[8px] font-bold text-tertiary uppercase tracking-widest">Connection Active</span>
                        </div>
                      </div>

                      <div className="pt-6 border-t border-outline-variant/10 space-y-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="text-sm font-bold text-on-surface">DNA Reconfiguration</h4>
                            <p className="text-[10px] text-on-surface-variant font-medium">Master control for your intelligence operating system</p>
                          </div>
                          <button 
                            onClick={exportDNAMapping}
                            className="px-4 py-2 bg-primary text-white rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
                          >
                            <Download size={14} />
                            Export Mapping (The Eyes)
                          </button>
                        </div>

                        <div className="flex items-center justify-between pt-4 border-t border-outline-variant/5">
                          <div>
                            <h4 className="text-sm font-bold text-on-surface">Strategic Blueprint</h4>
                            <p className="text-[10px] text-on-surface-variant font-medium">Full architectural export of your current strategy</p>
                          </div>
                          <button 
                            onClick={exportStrategicBlueprint}
                            className="px-4 py-2 bg-tertiary text-white rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-tertiary/90 transition-all shadow-lg shadow-tertiary/20"
                          >
                            <FileText size={14} />
                            Export Blueprint (CSV)
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <button 
                    onClick={() => {
                      const updatedLeads = leads.map(l => {
                        const score = calculateScore(l, visionModeText, !!l.summary);
                        return { ...l, score, scoreLabel: getScoreLabel(score) };
                      });
                      setLeads(updatedLeads);
                      
                      // Sync activeVision if it matches a known mode
                      const matchedVision = VISION_MODES.find(v => visionModeText.toLowerCase().includes(v.id));
                      if (matchedVision) setActiveVision(matchedVision);
                      
                      setActiveTab('decision');
                      
                      const toast = document.createElement('div');
                      toast.className = `fixed bottom-8 right-8 bg-primary text-white px-6 py-3 rounded-2xl shadow-2xl z-50 font-bold text-sm animate-bounce`;
                      toast.innerText = "Intelligence Re-synced Successfully";
                      document.body.appendChild(toast);
                      setTimeout(() => toast.remove(), 3000);
                    }}
                    className="w-full py-5 bg-primary text-white rounded-3xl font-bold text-lg hover:shadow-2xl hover:shadow-primary/40 transition-all active:scale-[0.98] flex items-center justify-center gap-3"
                  >
                    <Zap size={24} />
                    Save & Re-sync Intelligence
                  </button>
                </div>

                {/* Right Column: Visual Feedback / Preview */}
                <div className="lg:col-span-5 space-y-6">
                  <div className="bg-surface-container-lowest p-8 rounded-3xl border border-outline-variant/10 shadow-sm sticky top-28">
                    <h3 className="font-headline font-bold text-xl mb-6 flex items-center gap-2">
                      <Cpu size={24} className="text-primary" />
                      OS Intelligence Preview
                    </h3>
                    
                    <div className="space-y-8">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between px-1">
                          <span className="text-[10px] font-bold text-primary uppercase tracking-widest">1. Industry Summary (Vision Check)</span>
                          <Sparkles size={14} className="text-primary" />
                        </div>
                        <div className="p-5 bg-primary/5 rounded-2xl border border-primary/10 space-y-4">
                          <div className="space-y-2">
                            <p className="text-[10px] font-bold text-primary uppercase tracking-widest opacity-60">Intelligence Summary</p>
                            <p className="text-xs text-on-surface-variant leading-relaxed italic">
                              "{industrySummary}"
                            </p>
                          </div>
                          <div className="flex items-center gap-2 pt-3 border-t border-primary/10">
                            <div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center">
                              <Database size={12} className="text-primary" />
                            </div>
                            <div>
                              <p className="text-[8px] font-bold text-on-surface-variant/50 uppercase tracking-widest">API Data Suggestions</p>
                              <p className="text-[10px] font-bold text-primary uppercase tracking-widest">
                                {apiSuggestions.length > 0 ? apiSuggestions.join(', ') : 'Analyzing feed...'}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="flex items-center justify-between px-1">
                          <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">2. Decision Center Layout</span>
                          <Table size={14} className="text-on-surface-variant/50" />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          {displayColumns.map((col, i) => (
                            <div 
                              key={i} 
                              className="h-10 rounded-xl border border-primary/20 bg-primary/5 flex items-center px-4 gap-3 transition-all"
                            >
                              <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                              <span className="text-[10px] font-bold truncate text-primary">{col}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="pt-4 border-t border-outline-variant/10">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Quality Gate Preview</span>
                          <span className="text-[10px] font-bold text-tertiary">{qualityThreshold}%</span>
                        </div>
                        <div className="w-full h-2 bg-surface-container-low rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${qualityThreshold}%` }}
                            className="h-full bg-primary"
                          />
                        </div>
                        <div className="mt-4 p-3 bg-tertiary/5 rounded-xl border border-tertiary/10 flex items-center gap-3">
                          <div className="w-2 h-2 rounded-full bg-tertiary animate-pulse" />
                          <p className="text-[10px] font-bold text-tertiary uppercase tracking-widest">
                            {qualityThreshold > 80 ? 'Strict Filtering Active' : qualityThreshold > 50 ? 'Balanced Quality Gate' : 'Open Intelligence Mode'}
                          </p>
                        </div>
                        <p className="text-[10px] font-bold text-primary uppercase tracking-widest mt-6 text-center animate-pulse">
                          Vision Locked. Fuel Connected. Ready to Hunt.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Lead Details Modal */}
      <AnimatePresence>
        {selectedLead && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedLead(null)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-3xl bg-surface rounded-3xl shadow-2xl overflow-hidden border border-outline-variant/10"
            >
              <div className="p-8 space-y-8">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-6">
                    <div className="w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center font-bold text-primary text-3xl">
                      {selectedLead.initials}
                    </div>
                    <div>
                      <h3 className="font-headline font-extrabold text-3xl text-on-surface">{selectedLead.company}</h3>
                      <a href={selectedLead.domain} target="_blank" rel="noreferrer" className="text-primary hover:underline flex items-center gap-1 mt-1 font-medium">
                        {selectedLead.domain} <ChevronRight size={14} />
                      </a>
                    </div>
                  </div>
                  <div className="flex flex-col items-end">
                    <div className="flex items-center gap-2">
                      <span className="text-4xl font-extrabold font-headline text-primary">{selectedLead.score}</span>
                      <div className="flex gap-1">
                        {selectedLead.hasShopify && <span className="w-6 h-6 rounded-lg bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold" title="Shopify (20pt)">S</span>}
                        {selectedLead.hasFBPixel && <span className="w-6 h-6 rounded-lg bg-tertiary/10 text-tertiary flex items-center justify-center text-[10px] font-bold" title="Pixel (30pt)">P</span>}
                        {selectedLead.score > (selectedLead.hasShopify ? 20 : 0) + (selectedLead.hasFBPixel ? 30 : 0) && (
                          <span className="w-6 h-6 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center text-[10px] font-bold" title="Audit (50pt)">A</span>
                        )}
                      </div>
                    </div>
                    <span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">{selectedLead.scoreLabel} Match</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <div>
                      <h4 className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-3">Intelligence Summary</h4>
                      <p className="text-sm text-on-surface leading-relaxed bg-surface-container-low p-4 rounded-2xl">
                        {selectedLead.summary}
                      </p>
                    </div>
                    <div className="flex gap-4">
                      <div className="flex-1 p-4 bg-surface-container-low rounded-2xl border border-outline-variant/10">
                        <h5 className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1">Platform</h5>
                        <p className="text-sm font-bold text-on-surface">{selectedLead.platform}</p>
                      </div>
                      <div className="flex-1 p-4 bg-surface-container-low rounded-2xl border border-outline-variant/10">
                        <h5 className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1">Signals</h5>
                        <p className="text-sm font-bold text-on-surface">{selectedLead.signals}</p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <h4 className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Audit Data</h4>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 bg-surface-container-lowest rounded-xl border border-outline-variant/5">
                          <p className="text-[9px] font-bold text-on-surface-variant uppercase tracking-tighter">Revenue Tier</p>
                          <p className="text-xs font-bold text-on-surface">{selectedLead.salesRevenue || 'N/A'}</p>
                        </div>
                        <div className="p-3 bg-surface-container-lowest rounded-xl border border-outline-variant/5">
                          <p className="text-[9px] font-bold text-on-surface-variant uppercase tracking-tighter">Tech Spend</p>
                          <p className="text-xs font-bold text-on-surface">{selectedLead.techSpend || 'N/A'}</p>
                        </div>
                        <div className="p-3 bg-surface-container-lowest rounded-xl border border-outline-variant/5">
                          <p className="text-[9px] font-bold text-on-surface-variant uppercase tracking-tighter">Employees</p>
                          <p className="text-xs font-bold text-on-surface">{selectedLead.employeeCount || 'N/A'}</p>
                        </div>
                        <div className="p-3 bg-surface-container-lowest rounded-xl border border-outline-variant/5">
                          <p className="text-[9px] font-bold text-on-surface-variant uppercase tracking-tighter">Automation</p>
                          <p className="text-xs font-bold text-on-surface">{selectedLead.marketingAutomation || 'Missed Opportunity'}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div>
                      <h4 className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-3">AI Pitch Hook</h4>
                      <div className="p-4 bg-tertiary/5 border border-tertiary/10 rounded-2xl space-y-3">
                        <p className="text-xs italic text-on-surface-variant">
                          "I noticed you're using {selectedLead.platform} and have an active Facebook Pixel. Given your focus on {selectedLead.summary.split('.')[0]}, we can help optimize your conversion rate by 15%..."
                        </p>
                        <button className="w-full py-3 bg-tertiary text-white rounded-xl text-xs font-bold hover:shadow-lg transition-all">
                          Copy Pitch to Clipboard
                        </button>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <button 
                        onClick={() => {
                          addToBucket(selectedLead);
                          setSelectedLead(null);
                        }}
                        className="flex-1 py-4 bg-primary text-white rounded-2xl font-bold hover:shadow-xl transition-all"
                      >
                        Save to Bucket
                      </button>
                      <button 
                        onClick={() => setSelectedLead(null)}
                        className="px-6 py-4 bg-surface-container-low text-on-surface-variant rounded-2xl font-bold hover:bg-outline-variant/20 transition-all"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
