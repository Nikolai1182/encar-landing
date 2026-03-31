const HANGUL_SCRIPT = /\p{Script=Hangul}/gu;

const BRAND_KO_TO_EN: Record<string, string> = {
  기아: "Kia",
  현대: "Hyundai",
  제네시스: "Genesis",
  쉐보레: "Chevrolet",
  "KG모빌리티(쌍용)": "KG Mobility",
  KG모빌리티: "KG Mobility",
  쌍용: "SsangYong",
  "르노코리아(삼성)": "Renault Korea",
  르노코리아: "Renault Korea",
  대우: "Daewoo",
  벤츠: "Mercedes-Benz",
  아우디: "Audi",
  볼보: "Volvo",
  렉서스: "Lexus",
  도요타: "Toyota",
  혼다: "Honda",
  닛산: "Nissan",
  미쯔비시: "Mitsubishi",
  마쯔다: "Mazda",
  폭스바겐: "Volkswagen",
  포르쉐: "Porsche",
  랜드로버: "Land Rover",
  재규어: "Jaguar",
  람보르기니: "Lamborghini",
  페라리: "Ferrari",
  포드: "Ford",
  지프: "Jeep",
  푸조: "Peugeot",
  시트로엥: "Citroën",
  르노: "Renault",
  미니: "Mini",
  BMW: "BMW",
  Audi: "Audi",
};

const MODEL_PHRASE_KO_TO_EN: { pattern: RegExp; en: string }[] = [
  { pattern: /더\s*뉴/gi, en: "New" },
  { pattern: /가솔린/gi, en: "Gasoline" },
  { pattern: /디젤/gi, en: "Diesel" },
  { pattern: /하이브리드/gi, en: "Hybrid" },
  { pattern: /전기/gi, en: "Electric" },
  { pattern: /(\d+)\s*인승/gi, en: "$1-seat" },
  { pattern: /(\d+)\s*WD/gi, en: "$1WD" },
];

const MODEL_WORD_KO_TO_EN: [string, string][] = [
  ["모하비 더 마스터", "Mohave Master"],
  ["올 뉴 쏘렌토", "New Sorento"],
  ["더 뉴 쏘렌토", "New Sorento"],
  ["올 뉴 카니발", "New Carnival"],
  ["더 뉴 카니발", "New Carnival"],
  ["모하비", "Mohave"],
  ["스포티지", "Sportage"],
  ["투싼", "Tucson"],
  ["싼타페", "Santa Fe"],
  ["팰리세이드", "Palisade"],
  ["그랜저", "Grandeur"],
  ["아반떼", "Avante"],
  ["소나타", "Sonata"],
  ["코나", "Kona"],
  ["스타리아", "Staria"],
  ["카니발", "Carnival"],
  ["쏘렌토", "Sorento"],
  ["셀토스", "Seltos"],
  ["니로", "Niro"],
  ["토레스", "Torres"],
  ["렉스턴", "Rexton"],
  ["티볼리", "Tivoli"],
  ["코란도", "Korando"],
  ["QM6", "QM6"],
  ["SM6", "SM6"],
  ["XM3", "XM3"],
  ["클래시", "Classe"],
  ["프리미어", "Premier"],
];

const MODEL_TERM_KO_TO_EN: [string, string][] = [
  ["4세대", "4th Gen"],
  ["5세대", "5th Gen"],
  ["3세대", "3rd Gen"],
  ["2세대", "2nd Gen"],
  ["1세대", "1st Gen"],
  ["올 뉴", "New"],
  ["더 뉴", "New"],
  ["올뉴", "New"],
  ["하이리무진", "High Limousine"],
  ["시그니처", "Signature"],
  ["노블레스", "Noble"],
  ["스페셜", "Special"],
  ["프레스티지", "Prestige"],
  ["마스터즈", "Masters"],
  ["익스클루시브", "Exclusive"],
  ["럭셔리", "Luxury"],
  ["스마트스트림", "Smartstream"],
  ["노블", "Noble"],
  ["리무진", "Limousine"],
  ["하이리무", "High Limo"],
  ["프리미엄", "Premium"],
  ["스포츠", "Sport"],
  ["익스트림", "Extreme"],
  ["플래티넘", "Platinum"],
  ["디럭스", "Deluxe"],
  ["슈퍼", "Super"],
  ["롱바디", "Long Body"],
  ["숏바디", "Short Body"],
  ["GT라인", "GT-Line"],
  ["GT 라인", "GT-Line"],
  ["지티", "GT"],
];

function ordinalTh(n: number): string {
  if (n === 1) return "1st";
  if (n === 2) return "2nd";
  if (n === 3) return "3rd";
  return `${n}th`;
}

function normKey(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function sortByKeyLengthDesc(pairs: [string, string][]): [string, string][] {
  return [...pairs].sort((a, b) => b[0].length - a[0].length);
}

export function stripHangul(s: string): string {
  return normKey(s.replace(HANGUL_SCRIPT, " ").replace(/\s+/g, " "));
}

/** После `translateModelKoToEn`: термины, «N세대», затем удаление Hangul. */
export function cleanModelName(model: string): string {
  let s = normKey(model);
  if (!s) return s;

  for (const [ko, en] of sortByKeyLengthDesc(MODEL_TERM_KO_TO_EN)) {
    if (s.includes(ko)) s = s.split(ko).join(en);
  }

  s = s.replace(/(\d+)세대/g, (_, n: string) => `${ordinalTh(Number(n))} Gen`);

  for (const { pattern, en } of MODEL_PHRASE_KO_TO_EN) {
    s = s.replace(pattern, en);
  }

  s = stripHangul(s);

  const words = s.split(" ").filter(Boolean);
  const deduped = words.filter((w, i) => i === 0 || w !== words[i - 1]);
  return deduped.join(" ");
}

export function carTitleEnglish(brand: string, model: string): string {
  const b = translateBrandKoToEn(brand.trim()) || brand.trim();
  const m = cleanModelName(translateModelKoToEn(model.trim())).trim() || stripHangul(model).trim();
  return normKey(`${b} ${m}`.trim());
}

export function translateBrandKoToEn(raw: string): string {
  const s = normKey(raw);
  if (!s) return s;
  if (BRAND_KO_TO_EN[s]) return BRAND_KO_TO_EN[s];
  const lower = s.toLowerCase();
  for (const [k, v] of Object.entries(BRAND_KO_TO_EN)) {
    if (k.toLowerCase() === lower) return v;
  }
  return s;
}

export function translateModelKoToEn(raw: string): string {
  let s = normKey(raw);
  if (!s) return s;

  for (const [ko, en] of sortByKeyLengthDesc(MODEL_WORD_KO_TO_EN)) {
    if (s.includes(ko)) s = s.split(ko).join(en);
  }
  for (const { pattern, en } of MODEL_PHRASE_KO_TO_EN) {
    s = s.replace(pattern, en);
  }
  return normKey(s.replace(/\s{2,}/g, " "));
}
