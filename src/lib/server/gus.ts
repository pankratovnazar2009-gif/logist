import { XMLParser } from "fast-xml-parser";
import { getEnv } from "./env";

/**
 * Интеграция с реестром GUS/REGON (BIR1.1 SOAP API). Ключ — бесплатно на api.stat.gov.pl.
 * GUS_ENV=test использует публичный тестовый ключ, но видит только фиктивные тестовые фирмы
 * (напр. NIP 5261040828); для реальных НИПов нужны GUS_ENV=prod и собственный ключ.
 */

const ENDPOINTS = {
  test: "https://wyszukiwarkaregontest.stat.gov.pl/wsBIR/UslugaBIRzewnPubl.svc",
  prod: "https://wyszukiwarkaregon.stat.gov.pl/wsBIR/UslugaBIRzewnPubl.svc",
} as const;

const NS = "http://CIS/BIR/PUBL/2014/07";
const xmlParser = new XMLParser({ ignoreAttributes: false, trimValues: true });

let cachedSid: { sid: string; expiresAt: number } | null = null;

export interface CompanyLookupResult {
  nip: string;
  name: string;
  regon: string;
  voivodeship: string | null;
  city: string | null;
  postalCode: string | null;
  street: string | null;
  regionCode: string | null;
}

function endpoint(): string {
  return ENDPOINTS[getEnv().GUS_ENV];
}

export async function lookupCompanyByNip(nip: string): Promise<CompanyLookupResult | null> {
  const sid = await getSession();
  const envelope = buildEnvelope(
    "DaneSzukajPodmioty",
    `<DaneSzukajPodmioty xmlns="${NS}">
       <pParametryWyszukiwania xmlns:dat="${NS}/DataContract">
         <dat:Nip>${escapeXml(nip)}</dat:Nip>
       </pParametryWyszukiwania>
     </DaneSzukajPodmioty>`,
  );

  const raw = await soapCall(envelope, sid);
  const parsed = xmlParser.parse(extractSoapEnvelope(raw));
  const body = findChild(findChild(parsed, "Envelope"), "Body");
  const resultXml = findChild(findChild(body, "DaneSzukajPodmiotyResponse"), "DaneSzukajPodmiotyResult");

  if (!resultXml || typeof resultXml !== "string") return null;

  const inner = xmlParser.parse(resultXml);
  const record = findChild(inner, "root")?.dane;
  if (!record) return null;

  return {
    nip: String(record.Nip ?? nip),
    name: String(record.Nazwa ?? "").trim(),
    regon: String(record.Regon ?? ""),
    voivodeship: record.Wojewodztwo ? String(record.Wojewodztwo) : null,
    city: record.Miejscowosc ? String(record.Miejscowosc) : null,
    postalCode: record.KodPocztowy ? String(record.KodPocztowy) : null,
    street: record.Ulica ? String(record.Ulica) : null,
    regionCode: voivodeshipToRegionCode(record.Wojewodztwo ? String(record.Wojewodztwo) : null),
  };
}

async function getSession(): Promise<string> {
  if (cachedSid && cachedSid.expiresAt > Date.now()) return cachedSid.sid;

  const envelope = buildEnvelope(
    "Zaloguj",
    `<Zaloguj xmlns="${NS}">
       <pKluczUzytkownika>${escapeXml(getEnv().GUS_API_KEY)}</pKluczUzytkownika>
     </Zaloguj>`,
  );

  const raw = await soapCall(envelope, null);
  const parsed = xmlParser.parse(extractSoapEnvelope(raw));
  const body = findChild(findChild(parsed, "Envelope"), "Body");
  const sid = findChild(findChild(body, "ZalogujResponse"), "ZalogujResult");

  if (!sid || typeof sid !== "string") {
    throw new Error("GUS: nie udało się zalogować (brak sid w odpowiedzi)");
  }

  // Sesja GUS wygasa po ~60 min bezczynności — odświeżamy z zapasem.
  cachedSid = { sid, expiresAt: Date.now() + 55 * 60 * 1000 };
  return sid;
}

async function soapCall(envelope: string, sid: string | null): Promise<string> {
  const res = await fetch(endpoint(), {
    method: "POST",
    headers: {
      "Content-Type": "application/soap+xml; charset=utf-8",
      ...(sid ? { sid } : {}),
    },
    body: envelope,
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`GUS SOAP error (${res.status}): ${text.slice(0, 500)}`);
  }
  return text;
}

function buildEnvelope(action: string, bodyXml: string): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope" xmlns:wsa="http://www.w3.org/2005/08/addressing">
  <soap:Header>
    <wsa:To>${endpoint()}</wsa:To>
    <wsa:Action>${NS}/IUslugaBIRzewnPubl/${action}</wsa:Action>
  </soap:Header>
  <soap:Body>${bodyXml}</soap:Body>
</soap:Envelope>`;
}

function escapeXml(value: string): string {
  return value.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]!);
}

/** GUS отвечает в MTOM (multipart) — перед парсингом XML вырезаем сам Envelope из MIME-обёртки. */
function extractSoapEnvelope(raw: string): string {
  const match = raw.match(/<([A-Za-z0-9]+):Envelope[\s\S]*<\/\1:Envelope>/);
  if (!match) throw new Error("GUS: nie znaleziono SOAP Envelope w odpowiedzi");
  return match[0];
}

/** Ищет дочерний узел по локальному имени, игнорируя префикс пространства имён ("s:Body" -> "Body"). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function findChild(obj: any, localName: string): any {
  if (obj == null || typeof obj !== "object") return undefined;
  for (const key of Object.keys(obj)) {
    const bare = key.includes(":") ? key.slice(key.indexOf(":") + 1) : key;
    if (bare === localName) return obj[key];
  }
  return undefined;
}

const VOIVODESHIP_CODES: Record<string, string> = {
  mazowieckie: "PL-MZ",
  małopolskie: "PL-MA",
  wielkopolskie: "PL-WP",
  dolnośląskie: "PL-DS",
  łódzkie: "PL-LD",
  pomorskie: "PL-PM",
  śląskie: "PL-SL",
  lubelskie: "PL-LU",
  podkarpackie: "PL-PK",
  podlaskie: "PL-PD",
  zachodniopomorskie: "PL-ZP",
  lubuskie: "PL-LB",
  "kujawsko-pomorskie": "PL-KP",
  "warmińsko-mazurskie": "PL-WM",
  świętokrzyskie: "PL-SK",
  opolskie: "PL-OP",
};

function voivodeshipToRegionCode(voivodeship: string | null): string | null {
  if (!voivodeship) return null;
  return VOIVODESHIP_CODES[voivodeship.trim().toLowerCase()] ?? null;
}
