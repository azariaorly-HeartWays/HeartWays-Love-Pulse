// server.js
import express from "express";
import cors from "cors";
import cron from "node-cron";
import moment from "moment-timezone";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const cities = JSON.parse(fs.readFileSync(path.join(__dirname, "public/cities.json"), "utf-8"));
let clients = [];
let count = 0;

function sendAll(data){
  const str = `data: ${JSON.stringify(data)}\n\n`;
  clients.forEach(res => res.write(str));
}

app.get("/events", (req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
  });
  res.write("\n");
  clients.push(res);
  req.on("close", () => { clients = clients.filter(c => c !== res); });
});

// Manual sensor webhook: POST { city?: string, lat?: number, lon?: number }
app.post("/sensor", (req, res) => {
  const { city, lat, lon } = req.body || {};
  let p = null;
  if (typeof lat === "number" && typeof lon === "number") {
    p = { lat, lon, city: null };
  } else if (city) {
    const found = cities.find(c => c.name.toLowerCase() === String(city).toLowerCase());
    if (found) p = { lat: found.lat, lon: found.lon, city: found.name };
  }
  if (!p) return res.status(400).json({ ok:false, error:"Provide city or lat/lon" });
  count += 1;
  sendAll({ type:"pulse", kind:"sensor", ...p, count, play:true });
  return res.json({ ok:true });
});

// Inspiration rotator (optional)
const quotes = [
  "You are loved. You are never alone. Breathe love in.",
  "Your heart matters.",
  "We are one.",
  "Love is here, now."
];
let qi = 0;
cron.schedule("*/30 * * * * *", () => {
  qi = (qi+1) % quotes.length;
  sendAll({ type:"inspiration", text: quotes[qi] });
});

// Ceremony pulses: check timezones once per minute
cron.schedule("* * * * *", () => {
  const targetH = [8,20];
  const targetM = 18;
  cities.forEach(c => {
    const t = moment().tz(c.tz);
    if (targetH.includes(t.hour()) && t.minute() === targetM) {
      count += 1;
      sendAll({ type:"pulse", kind:"ceremony", lat:c.lat, lon:c.lon, city:c.name, tz:c.tz, count, play:true });
    }
  });
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public/index.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Love Pulse server running on :${PORT}`));
