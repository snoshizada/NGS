// data.js - all the game content (countries, parties, ministries etc)
// money is in BILLIONS, people are in MILLIONS unless it says otherwise

var GAME_VERSION = "0.1.0";
var CONTENT_VERSION = "0.1.0";

// the 15 ministries from the plan
var MINISTRIES = [
  { id: "finance", name: "Finance and Treasury" },
  { id: "interior", name: "Interior and Public Safety" },
  { id: "defence", name: "Defence" },
  { id: "foreign", name: "Foreign Affairs" },
  { id: "health", name: "Health" },
  { id: "education", name: "Education and Research" },
  { id: "transport", name: "Transport and Infrastructure" },
  { id: "energy", name: "Energy" },
  { id: "environment", name: "Environment and Climate" },
  { id: "housing", name: "Housing and Local Government" },
  { id: "industry", name: "Industry and Trade" },
  { id: "agriculture", name: "Agriculture and Food" },
  { id: "justice", name: "Justice" },
  { id: "labour", name: "Labour and Social Protection" },
  { id: "digital", name: "Digital Affairs and Communications" }
];

// 9 sectors. share = share of gross value added, jobs = share of employment
var SECTORS = [
  { id: "agri", name: "Agriculture and food", share: 0.03, jobs: 0.04, energy: 0.6 },
  { id: "energy", name: "Energy and utilities", share: 0.04, jobs: 0.01, energy: 1.0 },
  { id: "manuf", name: "Manufacturing", share: 0.14, jobs: 0.11, energy: 0.8 },
  { id: "constr", name: "Construction and property", share: 0.12, jobs: 0.08, energy: 0.4 },
  { id: "transp", name: "Transport and logistics", share: 0.06, jobs: 0.06, energy: 0.9 },
  { id: "retail", name: "Retail and hospitality", share: 0.13, jobs: 0.19, energy: 0.3 },
  { id: "finbus", name: "Finance and business services", share: 0.20, jobs: 0.15, energy: 0.1 },
  { id: "tech", name: "Information and technology", share: 0.08, jobs: 0.05, energy: 0.2 },
  { id: "public", name: "Public and other services", share: 0.20, jobs: 0.31, energy: 0.2 }
];

// spending lines (annual, billions). transfer:true means its money paid to households
var SPENDING_LINES = [
  { id: "health", name: "Health", ministry: "health" },
  { id: "education", name: "Education and research", ministry: "education" },
  { id: "police", name: "Police and public safety", ministry: "interior" },
  { id: "justice", name: "Courts and prisons", ministry: "justice" },
  { id: "defence", name: "Defence", ministry: "defence" },
  { id: "transport", name: "Transport and infrastructure", ministry: "transport", investment: true },
  { id: "housing", name: "Housing and local government", ministry: "housing", investment: true },
  { id: "environment", name: "Environment and energy", ministry: "environment" },
  { id: "pensions", name: "State pensions", ministry: "labour", transfer: true },
  { id: "welfare", name: "Unemployment and family benefits", ministry: "labour", transfer: true },
  { id: "admin", name: "General administration", ministry: "finance" },
  { id: "foreign", name: "Foreign affairs and aid", ministry: "foreign" }
];

// the tax types the player can change. rates are in percent
var TAX_INFO = {
  incomeBasic: { name: "Income tax - basic rate", min: 0, max: 40, unit: "%" },
  incomeHigher: { name: "Income tax - higher rate", min: 0, max: 60, unit: "%" },
  incomeTop: { name: "Income tax - top rate", min: 0, max: 75, unit: "%" },
  vat: { name: "Value added tax (VAT)", min: 0, max: 30, unit: "%" },
  corp: { name: "Corporate profit tax", min: 0, max: 50, unit: "%" },
  payroll: { name: "Social insurance contributions", min: 0, max: 30, unit: "%" },
  property: { name: "Property tax", min: 0, max: 3, unit: "% of value" },
  excise: { name: "Excise duties (fuel, alcohol, tobacco)", min: 0, max: 40, unit: "%" },
  tariff: { name: "Average import tariff", min: 0, max: 40, unit: "%" },
  carbon: { name: "Carbon tax", min: 0, max: 200, unit: "per tonne" }
};

// public services. line = which spending line pays for it
// staffShare = how much of the budget goes on staff. perStaff = units each staff member delivers a year
var SERVICES = [
  { id: "health", name: "Healthcare", line: "health", staffShare: 0.62, unit: "treatments", demandPerHead: 2.1, oldDemand: 3.5 },
  { id: "education", name: "Schools and colleges", line: "education", staffShare: 0.70, unit: "pupil places", demandPerHead: 0.0, youngDemand: 1.0 },
  { id: "police", name: "Policing", line: "police", staffShare: 0.75, unit: "cases handled", demandPerHead: 0.08, oldDemand: 0.08 },
  { id: "transport", name: "Roads and rail", line: "transport", staffShare: 0.30, unit: "network condition points", demandPerHead: 1.0, oldDemand: 1.0 }
];

// 6 newspapers/outlets. lean: 0 = left, 100 = right. sensational 0-1
var OUTLETS = [
  { id: "nbs", name: "National Broadcasting Service", type: "Public broadcaster", lean: 50, sensational: 0.1, reliability: "High" },
  { id: "herald", name: "The Daily Herald", type: "National newspaper", lean: 65, sensational: 0.3, reliability: "Good" },
  { id: "citizen", name: "The Citizen", type: "National newspaper", lean: 30, sensational: 0.3, reliability: "Good" },
  { id: "ledger", name: "The Business Ledger", type: "Business outlet", lean: 70, sensational: 0.1, reliability: "High" },
  { id: "regional", name: "Provincial Gazette", type: "Regional outlet", lean: 45, sensational: 0.4, reliability: "Fair" },
  { id: "flash", name: "The Daily Flash", type: "Tabloid", lean: 60, sensational: 0.9, reliability: "Low" }
];

// 12 foreign countries. all made up
var FOREIGN = [
  { id: "ostmark", name: "Ostmark", gov: "Parliamentary republic", pop: 41, gdp: 1650, military: 62, trade: 0.14, interest: "trade", relation: 60 },
  { id: "velland", name: "Velland", gov: "Constitutional monarchy", pop: 9, gdp: 420, military: 30, trade: 0.08, interest: "trade", relation: 70 },
  { id: "sarkand", name: "Sarkand", gov: "One-party state", pop: 120, gdp: 2100, military: 85, trade: 0.12, interest: "security", relation: 35 },
  { id: "lumeria", name: "Lumeria", gov: "Presidential republic", pop: 65, gdp: 900, military: 55, trade: 0.07, interest: "resources", relation: 50 },
  { id: "tiraan", name: "Tiraan", gov: "Military government", pop: 28, gdp: 160, military: 48, trade: 0.02, interest: "security", relation: 20 },
  { id: "corvel", name: "Corvel Islands", gov: "Parliamentary democracy", pop: 3, gdp: 140, military: 8, trade: 0.03, interest: "aid", relation: 65 },
  { id: "hasmir", name: "Hasmir", gov: "Absolute monarchy", pop: 22, gdp: 610, military: 40, trade: 0.06, interest: "resources", relation: 45 },
  { id: "doruvia", name: "Doruvia", gov: "Federal republic", pop: 80, gdp: 2900, military: 78, trade: 0.18, interest: "trade", relation: 55 },
  { id: "pellago", name: "Pellago", gov: "Parliamentary republic", pop: 15, gdp: 210, military: 15, trade: 0.04, interest: "aid", relation: 60 },
  { id: "karst", name: "Karst", gov: "Presidential republic", pop: 33, gdp: 380, military: 42, trade: 0.05, interest: "security", relation: 40 },
  { id: "nyhavn", name: "Nyhavn", gov: "Constitutional monarchy", pop: 6, gdp: 390, military: 20, trade: 0.06, interest: "environment", relation: 72 },
  { id: "zemlar", name: "Zemlar", gov: "Hybrid regime", pop: 54, gdp: 520, military: 66, trade: 0.05, interest: "security", relation: 30 }
];

// names for ministers (random pick using the seed)
var FIRST_NAMES = ["Anna", "Tomas", "Mira", "Henrik", "Leona", "Pavel", "Iris", "Johan", "Sofia", "Marek", "Elin", "Victor", "Nadia", "Oskar", "Clara", "Dmitri", "Greta", "Felix", "Hana", "Rudi", "Ines", "Karl", "Lotte", "Emil", "Vera", "Anton", "Rosa", "Bruno", "Petra", "Ivo"];
var LAST_NAMES = ["Varga", "Lindqvist", "Moreau", "Kessler", "Novak", "Halloran", "Brandt", "Okafor", "Ferreira", "Strand", "Kowal", "Duval", "Ritter", "Amsel", "Petrov", "Holm", "Castell", "Weiss", "Marin", "Bauer", "Sorensen", "Albrecht", "Lucan", "Fenwick", "Orsini"];

// the three country templates
var TEMPLATES = {
  A: {
    title: "Small developed parliamentary democracy",
    name: "Commonwealth of Arvenia",
    capital: "Halden",
    currency: "crown",
    currencySymbol: "Kr",
    languages: "Arvenian",
    flag: ["#17345B", "#FFFFFF", "#C8102E"],
    govType: "Parliamentary democracy",
    leaderTitle: "Prime Minister",
    electionSystem: "dhondt", // proportional by region
    termYears: 4,
    seats: 150,
    majority: 76,
    confidenceRule: true,
    amendment: "Two-thirds of parliament (100 of 150 seats) and a national referendum",
    regions: [
      { name: "Capital Region", pop: 2.1, income: 1.25, unemp: 0.85, seats: 52 },
      { name: "Northmark", pop: 1.4, income: 0.9, unemp: 1.15, seats: 34 },
      { name: "Westvale", pop: 1.3, income: 0.95, unemp: 1.0, seats: 32 },
      { name: "Southern Isles", pop: 1.2, income: 0.85, unemp: 1.1, seats: 32 }
    ],
    gdp: 360, unemployment: 0.055, inflation: 0.022, debtRatio: 0.58, policyRate: 0.03,
    oldShare: 0.21, youngShare: 0.18,
    taxes: { incomeBasic: 22, incomeHigher: 40, incomeTop: 48, vat: 21, corp: 22, payroll: 12, property: 0.6, excise: 18, tariff: 3, carbon: 40 },
    spending: { health: 31, education: 20, police: 6, justice: 3, defence: 5.5, transport: 10, housing: 6, environment: 4, pensions: 34, welfare: 16, admin: 9, foreign: 3 },
    parties: [
      { id: "lab", name: "Labour Alliance", econ: 32, social: 60, color: "#B22222", seats: 48, inGov: true, player: true },
      { id: "grn", name: "Green Left", econ: 25, social: 80, color: "#2E8B57", seats: 18, inGov: true },
      { id: "cen", name: "Centre Party", econ: 52, social: 55, color: "#DAA520", seats: 14, inGov: true },
      { id: "con", name: "Conservative Union", econ: 68, social: 35, color: "#1E3A8A", seats: 44, inGov: false },
      { id: "lib", name: "Liberal Democrats", econ: 62, social: 70, color: "#E68A00", seats: 12, inGov: false },
      { id: "nat", name: "National Front of Arvenia", econ: 55, social: 15, color: "#5B3A29", seats: 14, inGov: false }
    ]
  },
  B: {
    title: "Middle-income presidential republic with regional governments",
    name: "Federal Republic of Castavia",
    capital: "San Aurel",
    currency: "peso",
    currencySymbol: "$C",
    languages: "Castavian, Ornish",
    flag: ["#0A6E3C", "#F2C200", "#0A6E3C"],
    govType: "Presidential federal republic",
    leaderTitle: "President",
    electionSystem: "fptp", // districts in each region
    termYears: 4,
    seats: 200,
    majority: 101,
    confidenceRule: false,
    amendment: "Three-fifths of congress (120 of 200 seats) and approval by a majority of regional governments",
    regions: [
      { name: "Aurel Capital District", pop: 9.5, income: 1.5, unemp: 0.8, seats: 50 },
      { name: "Costa Verde", pop: 11.0, income: 1.0, unemp: 0.95, seats: 52 },
      { name: "Altiplano", pop: 8.0, income: 0.7, unemp: 1.25, seats: 40 },
      { name: "Ornland", pop: 6.5, income: 0.8, unemp: 1.15, seats: 30 },
      { name: "Rio Seco", pop: 5.0, income: 0.75, unemp: 1.1, seats: 28 }
    ],
    gdp: 560, unemployment: 0.085, inflation: 0.048, debtRatio: 0.52, policyRate: 0.065,
    oldShare: 0.12, youngShare: 0.27,
    taxes: { incomeBasic: 15, incomeHigher: 28, incomeTop: 35, vat: 16, corp: 28, payroll: 9, property: 0.3, excise: 15, tariff: 9, carbon: 0 },
    spending: { health: 30, education: 29, police: 12, justice: 5, defence: 12, transport: 18, housing: 9, environment: 3, pensions: 36, welfare: 14, admin: 18, foreign: 2 },
    parties: [
      { id: "pdc", name: "Democratic Renewal Party", econ: 45, social: 55, color: "#6A1B9A", seats: 92, inGov: true, player: true },
      { id: "fpc", name: "Federal People's Coalition", econ: 65, social: 30, color: "#1565C0", seats: 76, inGov: false },
      { id: "mts", name: "Workers' Movement", econ: 20, social: 50, color: "#C62828", seats: 20, inGov: false },
      { id: "orn", name: "Ornish Regional League", econ: 50, social: 45, color: "#00897B", seats: 12, inGov: true }
    ]
  },
  C: {
    title: "Post-crisis coalition republic with high debt and weak trust",
    name: "Republic of Morvania",
    capital: "Kessel",
    currency: "mark",
    currencySymbol: "M",
    languages: "Morvanian",
    flag: ["#7A1F1F", "#E0D6C2", "#2B2B2B"],
    govType: "Parliamentary republic",
    leaderTitle: "Prime Minister",
    electionSystem: "national", // national list proportional
    termYears: 4,
    seats: 120,
    majority: 61,
    confidenceRule: true,
    amendment: "Two-thirds of parliament (80 of 120 seats) and a ruling from the Constitutional Court",
    regions: [
      { name: "Kessel Metropolitan", pop: 3.2, income: 1.3, unemp: 0.85, seats: 40 },
      { name: "Upper Morva", pop: 2.4, income: 0.9, unemp: 1.1, seats: 30 },
      { name: "Lower Morva", pop: 2.1, income: 0.8, unemp: 1.2, seats: 26 },
      { name: "Eastern Marches", pop: 1.8, income: 0.75, unemp: 1.25, seats: 24 }
    ],
    gdp: 240, unemployment: 0.112, inflation: 0.035, debtRatio: 1.18, policyRate: 0.04,
    oldShare: 0.23, youngShare: 0.16,
    taxes: { incomeBasic: 23, incomeHigher: 38, incomeTop: 45, vat: 23, corp: 24, payroll: 15, property: 0.4, excise: 20, tariff: 4, carbon: 15 },
    spending: { health: 17, education: 11, police: 4.5, justice: 2.2, defence: 3.5, transport: 4, housing: 2.5, environment: 1.5, pensions: 30, welfare: 12, admin: 8, foreign: 1 },
    parties: [
      { id: "smp", name: "Social Market Party", econ: 50, social: 50, color: "#0277BD", seats: 34, inGov: true, player: true },
      { id: "cdm", name: "Christian Democrats", econ: 62, social: 30, color: "#37474F", seats: 18, inGov: true },
      { id: "rnw", name: "Renewal", econ: 45, social: 70, color: "#F57C00", seats: 12, inGov: true },
      { id: "soc", name: "Socialist Party", econ: 22, social: 60, color: "#B71C1C", seats: 30, inGov: false },
      { id: "pat", name: "Patriots of Morvania", econ: 58, social: 12, color: "#4E342E", seats: 20, inGov: false },
      { id: "pir", name: "Citizens' Protest List", econ: 40, social: 55, color: "#9E9D24", seats: 6, inGov: false }
    ]
  }
};

// policies for the policy composer (the "effect library"). each one has a parameter with a range
// effects are coded in sim.js applyPolicyEffect() because I couldnt work out a nicer way
var POLICIES = [
  { id: "minwage", name: "National minimum wage", ministry: "labour", instrument: "Bill", param: "Hourly rate as % of median wage", min: 0, max: 80, def: 50, unit: "%",
    desc: "Sets a wage floor. Raises pay for low earners, can cost jobs in low-productivity sectors (retail, agriculture).", supporters: "Unions, left parties", opponents: "Business groups, right parties" },
  { id: "rentcap", name: "Rent controls", ministry: "housing", instrument: "Bill", param: "Max annual rent increase", min: 0, max: 20, def: 10, unit: "%",
    desc: "Caps rent rises. Helps renters now, reduces new construction over time.", supporters: "Renters, left parties", opponents: "Landlords, construction" },
  { id: "energysub", name: "Household energy subsidy", ministry: "energy", instrument: "Budget line", param: "Annual cost", min: 0, max: 20, def: 0, unit: "bn",
    desc: "Pays part of household energy bills. Lowers inflation a bit, costs money.", supporters: "Everyone using energy", opponents: "Fiscal hawks, greens" },
  { id: "hospstaff", name: "Hospital staffing programme", ministry: "health", instrument: "Administrative programme", param: "Extra recruits per year (thousands)", min: 0, max: 20, def: 0, unit: "k",
    desc: "Recruits and trains extra clinical staff. Each 1,000 staff cost about 0.07bn a year at average pay. Capacity rises slowly as staff are trained.", supporters: "Health unions, patients", opponents: "Treasury" },
  { id: "infra", name: "National infrastructure programme", ministry: "transport", instrument: "Bill", param: "Extra capital spending per year", min: 0, max: 30, def: 0, unit: "bn",
    desc: "Builds roads, rail and grid. Adds demand now and productivity later.", supporters: "Construction, regions", opponents: "Fiscal hawks" },
  { id: "pensionidx", name: "Pension uprating", ministry: "labour", instrument: "Bill", param: "One-off pension increase", min: -10, max: 20, def: 0, unit: "%",
    desc: "Changes the level of the state pension. Over-65s care about this a lot.", supporters: "Pensioners", opponents: "Younger taxpayers" },
  { id: "nationalise", name: "Nationalise energy utilities", ministry: "energy", instrument: "Bill", param: "Compensation paid (bn)", min: 0, max: 60, def: 0, unit: "bn",
    desc: "Brings energy firms into public ownership. Costs compensation (added to debt). State can cap prices but efficiency may drop.", supporters: "Left parties", opponents: "Business, right parties" },
  { id: "privatise", name: "Privatise rail operations", ministry: "transport", instrument: "Bill", param: "Sale proceeds (bn)", min: 0, max: 40, def: 0, unit: "bn",
    desc: "Sells rail operations. Proceeds reduce debt. Transport spending falls but service quality can drop.", supporters: "Right parties, investors", opponents: "Unions, left parties" },
  { id: "conscription", name: "Military conscription", ministry: "defence", instrument: "Bill", param: "Months of service", min: 0, max: 18, def: 0, unit: "months",
    desc: "Young people serve in the forces. Raises readiness, reduces labour supply, unpopular with the young.", supporters: "Defence lobby, nationalists", opponents: "Young people, liberals" },
  { id: "immigration", name: "Skilled immigration quota", ministry: "interior", instrument: "Regulation", param: "Work visas per year (thousands)", min: 0, max: 200, def: 20, unit: "k",
    desc: "Lets more workers in. Grows the labour force and GDP; some voters dislike it.", supporters: "Business, liberals", opponents: "Nationalists" },
  { id: "freeschool", name: "Free school meals and childcare", ministry: "education", instrument: "Bill", param: "Annual cost", min: 0, max: 10, def: 0, unit: "bn",
    desc: "Helps families with children and raises participation of parents in work.", supporters: "Families, left parties", opponents: "Fiscal hawks" },
  { id: "emissions", name: "Industrial emissions standard", ministry: "environment", instrument: "Regulation", param: "Required cut by 2030", min: 0, max: 60, def: 0, unit: "%",
    desc: "Forces cleaner industry. Costs manufacturers and energy firms, pleases green voters.", supporters: "Greens, young voters", opponents: "Manufacturing, energy" }
];

// treaty types for foreign affairs
var TREATIES = [
  { id: "fta", name: "Free trade agreement", desc: "Mutual tariff cuts. Boosts exports to them." },
  { id: "cooperation", name: "Economic cooperation pact", desc: "Smaller trade boost, easy to agree." },
  { id: "defence", name: "Mutual defence treaty", desc: "Security guarantee. Raises defence costs a little." },
  { id: "nonaggression", name: "Non-aggression pact", desc: "Lowers tension with a rival." },
  { id: "aid", name: "Development aid package", desc: "We send aid. Costs money, improves relations." },
  { id: "climate", name: "Climate accord", desc: "Joint emissions commitment." },
  { id: "embassy", name: "Open embassy", desc: "Diplomatic recognition and an embassy." },
  { id: "extradition", name: "Extradition and policing treaty", desc: "Cooperation on crime." },
  { id: "sanctions", name: "Impose sanctions", desc: "Cut trade to punish them. Hurts our exports too." },
  { id: "lift", name: "Lift sanctions", desc: "Restore normal trade." }
];

// glossary - definitions for every indicator (shown as tooltips too)
var GLOSSARY = {
  "GDP": "Gross domestic product: total value of goods and services produced in a year (nominal, billions). GDP = consumption + government consumption + investment + exports - imports.",
  "Real growth": "Annualised change in GDP after removing inflation, compared with 52 weeks earlier.",
  "Inflation": "Annual change in the consumer price index (CPI) compared with 52 weeks earlier.",
  "Unemployment": "Unemployed people divided by the labour force.",
  "Labour force": "Employed people plus unemployed people actively looking for work.",
  "Debt/GDP": "Gross government debt as a share of annual GDP.",
  "Budget balance": "Government revenue minus government spending over the last 52 weeks. Negative = deficit.",
  "Primary balance": "Budget balance excluding debt interest.",
  "Population": "Residents, in millions. Changes with births, deaths and migration.",
  "Approval": "Share of adults who approve of the government, weighted over all population cohorts.",
  "Majority": "Seats held by government parties compared with seats needed for a majority.",
  "Disposable income": "Average household income after taxes and benefits, per adult, per year (thousands).",
  "Health capacity": "Treatments the health service can deliver per year with its current staff (millions).",
  "Health access": "Share of health demand actually served. Below 100% means waiting lists grow.",
  "Waiting time": "Typical weeks waiting for non-emergency treatment.",
  "Policy rate": "Interest rate set by the independent central bank.",
  "Exchange rate": "Index of the currency against trading partners (100 = start of game). Higher = stronger.",
  "Poverty rate": "Share of people with disposable income below 60% of the median.",
  "Gini": "Income inequality measure from 0 (equal) to 100 (one person has everything).",
  "Readiness": "How prepared the armed forces are, 0-100.",
  "Current account": "Exports minus imports (simplified), billions per year."
};

// tutorial hints for the first 12 weeks
var TUTORIAL = {
  1: "Welcome! This is your National Dashboard. Every number has a link - click GDP or Approval to see the history and what changed it. When you're ready, click 'Advance 1 week' at the top.",
  2: "Try the Treasury page. You can change tax rates and spending, then submit them as a Finance Bill. Parliament votes on it the next week.",
  3: "Bills need a majority. Check the Parliament page to see how many seats your government has.",
  4: "Every 4 weeks the monthly accounts are reconciled. The Statistics page shows quarterly national accounts.",
  5: "Public Services shows capacity vs demand. If demand is bigger than capacity, waiting times go up and people get angry.",
  6: "Hiring staff takes time. Health capacity only grows as fast as people can be recruited and trained.",
  7: "The News page shows stories written from real events. Click an article to see the event it came from.",
  8: "Use the Legislation page to make your own policies like a minimum wage or rent controls.",
  9: "Foreign Affairs lets you offer treaties. Countries say yes or no depending on their own interests.",
  10: "Save your game from Settings and Save Games. It autosaves after every turn too.",
  11: "The 'Why did this change?' report explains movements in key numbers over the last 1, 4 or 12 weeks.",
  12: "That's the tutorial done. Good luck - try to win the next election!"
};
