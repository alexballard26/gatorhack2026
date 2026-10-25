/**
 * Static lookup for the 50 states + DC (name, postal code, FIPS, label point, bbox).
 * Generated once from TIGERweb State_County/MapServer/0 (INTPTLAT/INTPTLON and per-state extent in EPSG:4326).
 * Alaska and Hawaii bboxes are hand-trimmed (the raw extents cross the antimeridian / include remote atolls).
 */
export interface StateInfo {
  name: string;
  abbr: string;
  fips: string;
  /** [lng, lat] label anchor */
  label: [number, number];
  /** [west, south, east, north] */
  bbox: [number, number, number, number];
}

export const STATES: StateInfo[] = [
  { name: "Alabama", abbr: "AL", fips: "01", label: [-86.8434,32.7396], bbox: [-88.4732,30.1444,-84.8882,35.008] },
  { name: "Alaska", abbr: "AK", fips: "02", label: [-152.8386,63.347], bbox: [-170, 51.2, -129.9, 71.4] },
  { name: "Arizona", abbr: "AZ", fips: "04", label: [-111.6063,34.2039], bbox: [-114.8163,31.3323,-109.0452,37.0037] },
  { name: "Arkansas", abbr: "AR", fips: "05", label: [-92.4446,34.8955], bbox: [-94.6179,33.0043,-89.641,36.4997] },
  { name: "California", abbr: "CA", fips: "06", label: [-119.5713,37.1627], bbox: [-124.482,32.5295,-114.1312,42.0095] },
  { name: "Colorado", abbr: "CO", fips: "08", label: [-105.5087,38.9938], bbox: [-109.0602,36.9924,-102.0415,41.0034] },
  { name: "Connecticut", abbr: "CT", fips: "09", label: [-72.9,41.5], bbox: [-73.7278,40.9509,-71.7872,42.0505] },
  { name: "Delaware", abbr: "DE", fips: "10", label: [-75.3,39.15], bbox: [-75.789,38.4511,-74.9842,39.8395] },
  { name: "District of Columbia", abbr: "DC", fips: "11", label: [-76.9,38.75], bbox: [-77.1198,38.7916,-76.9094,38.9958] },
  { name: "Florida", abbr: "FL", fips: "12", label: [-81.55,28.15], bbox: [-87.6349,24.3963,-79.9743,31.001] },
  { name: "Georgia", abbr: "GA", fips: "13", label: [-83.4235,32.6296], bbox: [-85.6052,30.3558,-80.783,35.0013] },
  { name: "Hawaii", abbr: "HI", fips: "15", label: [-155.4951,19.8281], bbox: [-160.4, 18.85, -154.7, 22.3] },
  { name: "Idaho", abbr: "ID", fips: "16", label: [-114.5979,44.352], bbox: [-117.243,41.9882,-111.0435,49.0008] },
  { name: "Illinois", abbr: "IL", fips: "17", label: [-89.1526,40.1029], bbox: [-91.5131,36.9703,-87.0199,42.5085] },
  { name: "Indiana", abbr: "IN", fips: "18", label: [-86.2919,39.9013], bbox: [-88.0979,37.7717,-84.7845,41.7614] },
  { name: "Iowa", abbr: "IA", fips: "19", label: [-93.4933,42.07], bbox: [-96.6395,40.3754,-90.1401,43.5012] },
  { name: "Kansas", abbr: "KS", fips: "20", label: [-98.3834,38.4985], bbox: [-102.0518,36.993,-94.5884,40.0032] },
  { name: "Kentucky", abbr: "KY", fips: "21", label: [-85.293,37.5337], bbox: [-89.5712,36.4971,-81.9648,39.1477] },
  { name: "Louisiana", abbr: "LA", fips: "22", label: [-92.45,31.05], bbox: [-94.0434,28.8551,-88.7584,33.0196] },
  { name: "Maine", abbr: "ME", fips: "23", label: [-69.25,45.25], bbox: [-71.0839,42.9171,-66.8854,47.4598] },
  { name: "Maryland", abbr: "MD", fips: "24", label: [-76.75,39.35], bbox: [-79.4877,37.8866,-74.9863,39.723] },
  { name: "Massachusetts", abbr: "MA", fips: "25", label: [-71.9,42.35], bbox: [-73.5082,41.1871,-69.8589,42.8868] },
  { name: "Michigan", abbr: "MI", fips: "26", label: [-84.65,43.35], bbox: [-90.4184,41.6961,-82.123,48.3061] },
  { name: "Minnesota", abbr: "MN", fips: "27", label: [-94.1996,46.316], bbox: [-97.2391,43.4994,-89.4834,49.3845] },
  { name: "Mississippi", abbr: "MS", fips: "28", label: [-89.6561,32.6865], bbox: [-91.655,30.1398,-88.0979,34.9961] },
  { name: "Missouri", abbr: "MO", fips: "29", label: [-92.4568,38.3508], bbox: [-95.7747,35.9957,-89.099,40.6136] },
  { name: "Montana", abbr: "MT", fips: "30", label: [-109.6348,47.0512], bbox: [-116.0492,44.3579,-104.0397,49.0011] },
  { name: "Nebraska", abbr: "NE", fips: "31", label: [-99.8119,41.5433], bbox: [-104.0535,39.9999,-95.3083,43.0017] },
  { name: "Nevada", abbr: "NV", fips: "32", label: [-116.6151,39.3311], bbox: [-120.0065,35.0019,-114.0395,42.0018] },
  { name: "New Hampshire", abbr: "NH", fips: "33", label: [-71.6,43.7], bbox: [-72.5571,42.697,-70.5751,45.3058] },
  { name: "New Jersey", abbr: "NJ", fips: "34", label: [-74.4,40.2], bbox: [-75.5636,38.7887,-73.8851,41.3576] },
  { name: "New Mexico", abbr: "NM", fips: "35", label: [-106.1316,34.4347], bbox: [-109.0504,31.3322,-103.002,37.0002] },
  { name: "New York", abbr: "NY", fips: "36", label: [-75.5963,42.9134], bbox: [-79.7626,40.4766,-71.7775,45.0159] },
  { name: "North Carolina", abbr: "NC", fips: "37", label: [-79.1309,35.5397], bbox: [-84.3218,33.7529,-75.4001,36.5881] },
  { name: "North Dakota", abbr: "ND", fips: "38", label: [-100.4608,47.4422], bbox: [-104.049,45.9351,-96.5544,49.0006] },
  { name: "Ohio", abbr: "OH", fips: "39", label: [-82.712,40.4149], bbox: [-84.8203,38.4034,-80.5187,42.3271] },
  { name: "Oklahoma", abbr: "OK", fips: "40", label: [-97.4868,35.5901], bbox: [-103.0024,33.6158,-94.431,37.0023] },
  { name: "Oregon", abbr: "OR", fips: "41", label: [-120.623,43.9717], bbox: [-124.7035,41.9921,-116.4633,46.2991] },
  { name: "Pennsylvania", abbr: "PA", fips: "42", label: [-77.8275,40.9046], bbox: [-80.5199,39.7198,-74.6896,42.5161] },
  { name: "Rhode Island", abbr: "RI", fips: "44", label: [-71.4,41.62], bbox: [-71.9073,41.0958,-71.0886,42.0188] },
  { name: "South Carolina", abbr: "SC", fips: "45", label: [-80.8543,33.8742], bbox: [-83.3539,31.996,-78.4993,35.2155] },
  { name: "South Dakota", abbr: "SD", fips: "46", label: [-100.2382,44.4468], bbox: [-104.0579,42.4797,-96.4365,45.9454] },
  { name: "Tennessee", abbr: "TN", fips: "47", label: [-86.3496,35.8584], bbox: [-90.3105,34.9829,-81.6469,36.6783] },
  { name: "Texas", abbr: "TX", fips: "48", label: [-99.2818,31.4347], bbox: [-106.6456,25.837,-93.508,36.5007] },
  { name: "Utah", abbr: "UT", fips: "49", label: [-111.6563,39.335], bbox: [-114.0529,36.9977,-109.0416,42.0017] },
  { name: "Vermont", abbr: "VT", fips: "50", label: [-72.7,44.25], bbox: [-73.4379,42.7269,-71.465,45.0167] },
  { name: "Virginia", abbr: "VA", fips: "51", label: [-78.6671,37.5205], bbox: [-83.6754,36.5409,-75.1664,39.466] },
  { name: "Washington", abbr: "WA", fips: "53", label: [-120.576,47.4074], bbox: [-124.849,45.5435,-116.9161,49.0024] },
  { name: "West Virginia", abbr: "WV", fips: "54", label: [-80.6182,38.6473], bbox: [-82.6446,37.2015,-77.7195,40.6388] },
  { name: "Wisconsin", abbr: "WI", fips: "55", label: [-89.7094,44.6309], bbox: [-92.8894,42.4917,-86.2495,47.3098] },
  { name: "Wyoming", abbr: "WY", fips: "56", label: [-107.5291,42.9739], bbox: [-111.0546,40.9948,-104.0522,45.0058] },
];

export const STATE_BY_ABBR: Record<string, StateInfo> = Object.fromEntries(STATES.map((s) => [s.abbr, s]));
export const STATE_BY_FIPS: Record<string, StateInfo> = Object.fromEntries(STATES.map((s) => [s.fips, s]));

/** Contiguous US view for the national stage. */
export const CONUS_BOUNDS: [[number, number], [number, number]] = [[-124.8, 24.4], [-66.9, 49.4]];

/** Too small or crowded to fit a full name at the national fit: show the postal code instead. */
export const SHORT_LABEL = new Set(["RI", "DE", "CT", "NJ", "MD", "MA", "NH", "VT", "DC", "WV", "SC", "MS", "AL"]);
