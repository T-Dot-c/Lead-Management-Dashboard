import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // --- API Routes ---

  // BuiltWith "Hunter" Proxy
  app.get("/api/status", (req, res) => {
    res.json({ 
      hasBuiltWithKey: !!process.env.BUILTWITH_API_KEY,
      hasGeminiKey: !!process.env.GEMINI_API_KEY,
      hasShodanKey: !!process.env.SHODAN_API_KEY,
      hasSecurityScorecardKey: !!process.env.SECURITYSCORECARD_API_KEY
    });
  });

  app.get("/api/hunter", async (req, res) => {
    const apiKey = process.env.BUILTWITH_API_KEY;
    const tech = (req.query.tech as string) || "Shopify";
    const country = (req.query.country as string) || "GB";

    const getMockLeads = (tech: string, country: string) => {
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
        id: `mock-${country}-${index}-${Date.now()}`,
        company: name,
        domain: `https://${name.toLowerCase().replace(/ /g, '')}.com`,
        platform: tech,
        signals: "Mock Detection",
        initials: name.substring(0, 2).toUpperCase(),
        hasShopify: tech.toLowerCase() === "shopify",
        hasFBPixel: Math.random() > 0.5,
        summary: `Mock lead for ${tech} in ${countryName}. (BuiltWith API key missing)`,
        score: tech.toLowerCase() === "shopify" ? 60 : 40,
        scoreLabel: "Mock",
        location: `${name.split(' ')[0]}, ${countryName}`,
        source: 'BuiltWith (Mock)'
      }));
    };

    if (!apiKey) {
      return res.json({ 
        leads: getMockLeads(tech, country),
        isMock: true,
        message: "Using mock data. Configure BUILTWITH_API_KEY for live results."
      });
    }

    try {
      // Fetching the newest 10 stores using dynamic parameters
      const response = await fetch(
        `https://api.builtwith.com/lists12/api.json?KEY=${apiKey}&TECH=${tech}&COUNTRY=${country}`
      );
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`BuiltWith API Error (${response.status}):`, errorText);
        return res.json({ 
          leads: getMockLeads(tech, country),
          isMock: true,
          message: `BuiltWith API Error: ${response.status}. Falling back to mock data.`
        });
      }

      const data = await response.json();
      
      // BuiltWith Lists API returns an array of results
      let leads = (data.Results || []).slice(0, 10).map((item: any, index: number) => ({
        id: `bw-${index}-${Date.now()}`,
        company: item.Company || item.Domain.split('.')[0].charAt(0).toUpperCase() + item.Domain.split('.')[0].slice(1),
        domain: `https://${item.Domain}`,
        platform: tech,
        signals: "New Detection",
        initials: (item.Company || item.Domain).substring(0, 2).toUpperCase(),
        hasShopify: tech.toLowerCase() === "shopify",
        hasFBPixel: false, 
        summary: `Freshly hunted from BuiltWith Lists API (${tech} in ${country}).`,
        score: tech.toLowerCase() === "shopify" ? 20 : 10, 
        scoreLabel: "New",
        location: country === "GB" ? "United Kingdom" : country,
        firstDetected: item.FirstDetected,
        source: 'BuiltWith'
      }));

      // If no results found, provide mock data so the UI updates
      if (leads.length === 0) {
        console.log(`No results from BuiltWith for ${tech} in ${country}. Providing mock data.`);
        return res.json({ 
          leads: getMockLeads(tech, country),
          isMock: true,
          message: `No live results found for ${tech} in ${country}. Showing mock leads.`
        });
      }

      res.json({ leads, isMock: false });
    } catch (error) {
      console.error("BuiltWith API Error:", error);
      res.json({ 
        leads: getMockLeads(tech, country),
        isMock: true,
        message: "Failed to fetch from BuiltWith. Falling back to mock data."
      });
    }
  });

  // Shodan "Risk Guard" Proxy
  app.get("/api/shodan", async (req, res) => {
    const apiKey = process.env.SHODAN_API_KEY;
    const query = (req.query.query as string) || "port:80";

    if (!apiKey) {
      return res.json({ 
        results: [],
        isMock: true,
        message: "Configure SHODAN_API_KEY for live security scans."
      });
    }

    try {
      const response = await fetch(`https://api.shodan.io/shodan/host/search?key=${apiKey}&query=${query}`);
      if (!response.ok) throw new Error(`Shodan API Error: ${response.status}`);
      const data = await response.json();
      res.json({ results: data.matches || [], isMock: false });
    } catch (error) {
      console.error("Shodan API Error:", error);
      res.status(500).json({ error: "Failed to fetch from Shodan" });
    }
  });

  // Generic Proxy for any API
  app.get("/api/proxy", async (req, res) => {
    const url = req.query.url as string;
    if (!url) return res.status(400).json({ error: "URL is required" });

    try {
      const response = await fetch(url);
      const contentType = response.headers.get("content-type");
      
      if (!response.ok) {
        return res.status(response.status).json({ 
          error: `API returned ${response.status}: ${response.statusText}`,
          status: response.status 
        });
      }

      if (contentType && contentType.includes("application/json")) {
        const data = await response.json();
        res.json(data);
      } else {
        const text = await response.text();
        res.json({ message: "Success (Non-JSON response)", preview: text.substring(0, 100) });
      }
    } catch (error: any) {
      console.error("Proxy Error:", error);
      res.status(500).json({ error: error.message || "Failed to fetch from the provided URL" });
    }
  });

  // --- Vite Middleware ---

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
