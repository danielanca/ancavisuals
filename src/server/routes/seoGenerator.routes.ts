import { Router } from "express";
import { requireFirebaseAuth, requireSupremeAdmin } from "../middleware/requireFirebaseAuth";
import Anthropic from "@anthropic-ai/sdk";
import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { CITIES, SERVICES, type CityData } from "../../client/pages/LocationSEO/locationData";
import { addSitemapEntries, getSitemapEntries } from "../utils/sitemapGenerator";

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOCATION_DATA_PATH = join(__dirname, "../../client/pages/LocationSEO/locationData.ts");
const SITEMAP_PATH = join(__dirname, "../../../public/sitemap.xml");

const router = Router();
router.use(requireFirebaseAuth, requireSupremeAdmin);

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const existingCitySlugs = new Set(CITIES.map(city => city.slug));
const allServiceSlugs = SERVICES.map(service => service.slug);

router.get("/pages", async (_req, res) => {
  try {
    res.json({ entries: await getSitemapEntries() });
  } catch (error) {
    console.error("[seo-generator] sitemap entries read error:", error);
    res.status(500).json({ error: "Nu s-au putut încărca paginile SEO." });
  }
});

router.post("/analyze", async (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const sendEvent = (data: object) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  try {
    const coveredCities = CITIES.map(city => `${city.name} (${city.county})`).join(", ");

    sendEvent({ type: "status", message: `Analizez acoperirea curentă (${CITIES.length} orașe)...` });

    const stream = client.messages.stream({
      model: "claude-sonnet-4-6",
      max_tokens: 2000,
      messages: [
        {
          role: "user",
          content: `Ești un expert SEO pentru un studio de fotografie și videografie din România (Anca Visuals).

Studioul acoperă deja aceste orașe/localități:
${coveredCities}

Servicii oferite: nunți, botezuri, majorate, evenimente, cununie civilă, logodnă, corporate, înmormântare, trash the dress, save the date.

Identifică TOP 10 orașe sau localități din România care NU sunt în lista de mai sus și care au potențial SEO ridicat pentru un fotograf/videograf de nunți. Prioritizează orașe cu:
- populație mare sau medie
- activitate mare de nunți/evenimente
- concurență SEO redusă sau medie

Răspunde STRICT în format JSON array, fără text suplimentar:
[
  {
    "name": "Numele Orașului",
    "slug": "numele-orasului",
    "county": "Județul",
    "estimatedMonthlySearches": 450,
    "reason": "Motiv scurt pentru care e valoros SEO",
    "suggestedServices": ["nunta", "botez"]
  }
]

suggestedServices trebuie să fie un subset din: nunta, botez, majorat, evenimente, cununie-civila, logodna, corporate, inmormantare, trash-the-dress, save-the-date
Dacă e un oraș mare pune toate serviciile, dacă e mic pune doar nunta.`,
        },
      ],
    });

    let fullText = "";

    stream.on("text", (chunk) => {
      fullText += chunk;
      sendEvent({ type: "text", content: chunk });
    });

    await stream.finalMessage();

    const jsonMatch = fullText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      sendEvent({ type: "error", message: "Nu am putut parsa răspunsul Claude" });
      res.end();
      return;
    }

    const suggestions = JSON.parse(jsonMatch[0]) as Array<{
      name: string;
      slug: string;
      county: string;
      estimatedMonthlySearches: number;
      reason: string;
      suggestedServices: string[];
    }>;

    const filtered = suggestions.filter(suggestion => !existingCitySlugs.has(suggestion.slug));
    sendEvent({ type: "done", suggestions: filtered });
  } catch (error) {
    console.error("[seo-generator] analyze error:", error);
    sendEvent({ type: "error", message: "Analiza a eșuat" });
  } finally {
    res.end();
  }
});

router.post("/generate", async (req, res) => {
  const { cities } = req.body as {
    cities: Array<{ name: string; slug: string; county: string; suggestedServices: string[] }>;
  };

  if (!Array.isArray(cities) || cities.length === 0) {
    res.status(400).json({ error: "No cities provided" });
    return;
  }

  try {
    const generatedCities: CityData[] = [];

    for (const cityInfo of cities) {
      if (existingCitySlugs.has(cityInfo.slug)) continue;

      const message = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 800,
        messages: [
          {
            role: "user",
            content: `Generează date pentru o pagină SEO de fotografie/videografie pentru:
Oraș: ${cityInfo.name}
Județ: ${cityInfo.county}

Răspunde STRICT în format JSON, fără text suplimentar:
{
  "description": "descriere scurtă a orașului din perspectiva unui fotograf (max 20 cuvinte, fără virgulă la început)",
  "intro": "frază de introducere pentru pagina SEO, la persoana 1 plural (max 40 cuvinte)",
  "nearbyAreas": ["localitate1", "localitate2", "localitate3", "localitate4"],
  "venues": ["locatie1", "locatie2", "locatie3", "locatie4"],
  "photoSpots": ["spot1", "spot2", "spot3"]
}

Toate datele trebuie să fie reale și specifice orașului respectiv.`,
          },
        ],
      });

      const textContent = message.content.find(block => block.type === "text");
      if (!textContent || textContent.type !== "text") continue;

      const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) continue;

      const generated = JSON.parse(jsonMatch[0]) as {
        description: string;
        intro: string;
        nearbyAreas: string[];
        venues: string[];
        photoSpots: string[];
      };

      const validServices = cityInfo.suggestedServices.filter(serviceSlug =>
        allServiceSlugs.includes(serviceSlug as never)
      );
      const hasAllServices = validServices.length === allServiceSlugs.length;

      const cityData: CityData = {
        slug: cityInfo.slug,
        name: cityInfo.name,
        county: cityInfo.county,
        description: generated.description,
        intro: generated.intro,
        nearbyAreas: generated.nearbyAreas,
        venues: generated.venues,
        photoSpots: generated.photoSpots,
        ...(hasAllServices ? {} : { services: validServices as CityData["services"] }),
      };

      generatedCities.push(cityData);
    }

    if (generatedCities.length === 0) {
      res.status(400).json({ error: "No new cities were generated" });
      return;
    }

    appendCitiesToLocationData(generatedCities);

    // Construiește intrările pentru sitemap și salvează în Firestore (persistă cross-deploy)
    const BASE = "https://www.ancavisuals.ro";
    const sitemapEntries = generatedCities.flatMap(city => {
      const services = city.services ?? allServiceSlugs;
      return services.map(serviceSlug => ({
        loc: `${BASE}/foto-video-${serviceSlug}-${city.slug}`,
        changefreq: "monthly" as const,
        priority: serviceSlug === "nunta" ? "0.8" : "0.7",
      }));
    });
    await addSitemapEntries(sitemapEntries);

    res.json({
      generated: generatedCities.map(city => city.slug),
      count: generatedCities.length,
    });
  } catch (error) {
    console.error("[seo-generator] generate error:", error);
    res.status(500).json({ error: "Generation failed" });
  }
});

function appendCitiesToLocationData(newCities: CityData[]) {
  const fileContent = readFileSync(LOCATION_DATA_PATH, "utf-8");

  const cityEntries = newCities.map(city => {
    const servicesLine = city.services
      ? `\n    services: ${JSON.stringify(city.services)},`
      : "";
    return `  {
    slug: "${city.slug}",
    name: "${city.name}",
    county: "${city.county}",
    description: "${city.description.replace(/"/g, '\\"')}",
    intro: "${city.intro.replace(/"/g, '\\"')}",
    nearbyAreas: ${JSON.stringify(city.nearbyAreas)},
    venues: ${JSON.stringify(city.venues)},
    photoSpots: ${JSON.stringify(city.photoSpots)},${servicesLine}
  }`;
  }).join(",\n");

  const insertMarker = "export const SERVICES: ServiceData[]";
  const insertIndex = fileContent.indexOf(insertMarker);
  if (insertIndex === -1) throw new Error("Cannot find SERVICES marker in locationData.ts");

  const lastBracketIndex = fileContent.lastIndexOf("];", insertIndex);
  if (lastBracketIndex === -1) throw new Error("Cannot find end of CITIES array");

  const updated =
    fileContent.slice(0, lastBracketIndex) +
    ",\n\n  // [seo-generator]\n" +
    cityEntries +
    ",\n" +
    fileContent.slice(lastBracketIndex);

  writeFileSync(LOCATION_DATA_PATH, updated, "utf-8");
}

export default router;
