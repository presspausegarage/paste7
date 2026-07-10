// scratchpad-data.jsx — shared sample data + theme tokens for paste7 design mockup

const HL7_LINES = [
  { seg: "MSH", rest: "|^~\\&|LAB|RIVERSIDE|EHR|RECORG|20240612151200||ORU^R01|MSG-0088|P|2.5" },
  { seg: "PID", rest: "|1||MRN-FAKE-0001^^^RIVERSIDE^MR||THUNDERER^THOR^T^^^^||19500101|F|||1 BIFROST BRIDGE^^ASGARD^XX^00001^^||(555) 555-0100" },
  { seg: "PV1", rest: "|1|I|3N^312^B^RIVERSIDE||||DRFAKE^WELLINGTON^H^^DR^^MD" },
  { seg: "ORC", rest: "|RE|ORD-FAKE-4471|FIL-FAKE-9920" },
  { seg: "OBR", rest: "|1|ORD-FAKE-4471|FIL-FAKE-9920|58410-2^CBC panel^LN||20240612144500||||||||DRFAKE^WELLINGTON^H^^DR^^MD|||||20240612151000|||F" },
  { seg: "OBX", rest: "|1|NM|718-7^Hemoglobin^LN|1|13.4|g/dL|12.0-16.0|N|||F" },
  { seg: "OBX", rest: "|2|NM|4544-3^Hematocrit^LN|1|40.1|%|36.0-46.0|N|||F" },
  { seg: "OBX", rest: "|3|NM|6690-2^Leukocytes^LN|1|7.2|10*3/uL|4.0-11.0|N|||F" },
  { seg: "OBX", rest: "|4|NM|777-3^Platelets^LN|1|245|10*3/uL|150-400|N|||F" },
];

const TREE_NODES = [
  { path: "MSH", label: "Message Header",       kind: "segment", expanded: false, children: [] },
  { path: "PID", label: "Patient Identification", kind: "segment", expanded: true,  children: [
    { path: "PID-3",  label: "MRN-FAKE-0001",    kind: "field", value: "MRN-FAKE-0001",    redaction: { category: "id",      rule: "patient-id" } },
    { path: "PID-5",  label: "THUNDERER^THOR^T", kind: "field", value: "THUNDERER^THOR^T", redaction: { category: "name",    rule: "patient-name" } },
    { path: "PID-8",  label: "F",                kind: "field", value: "F",                redaction: null },
    { path: "PID-11", label: "[scrubbed]",        kind: "field", value: null,               redaction: { category: "address", rule: "patient-addr" } },
    { path: "PID-13", label: "[removed]",         kind: "field", value: null,               redaction: { category: "phone",   rule: "home-phone" } },
  ]},
  { path: "PV1", label: "Patient Visit",         kind: "segment", expanded: false, children: [] },
  { path: "ORC", label: "Common Order",          kind: "segment", expanded: false, children: [] },
  { path: "OBR", label: "Observation Request",   kind: "segment", expanded: false, children: [] },
  { path: "OBX", label: "Observation/Result ×4", kind: "segment", expanded: false, children: [] },
];

const FINDINGS = [
  { category: "name",    path: "PID-5",  rule: "patient-name",  strategy: "substitute", replacement: "THUNDERER^THOR^T" },
  { category: "id",      path: "PID-3",  rule: "patient-id",    strategy: "substitute", replacement: "MRN-FAKE-0001" },
  { category: "address", path: "PID-11", rule: "patient-addr",  strategy: "scrub",      replacement: null },
  { category: "phone",   path: "PID-13", rule: "home-phone",    strategy: "remove",     replacement: null },
  { category: "name",    path: "PV1-8",  rule: "provider-name", strategy: "substitute", replacement: "DRFAKE^WELLINGTON^H" },
  { category: "name",    path: "OBR-16", rule: "provider-name", strategy: "substitute", replacement: "DRFAKE^WELLINGTON^H" },
  { category: "id",      path: "ORC-2",  rule: "placer-order",  strategy: "substitute", replacement: "ORD-FAKE-4471" },
  { category: "id",      path: "ORC-3",  rule: "filler-order",  strategy: "substitute", replacement: "FIL-FAKE-9920" },
  { category: "date",    path: "PID-7",  rule: "birth-date",    strategy: "substitute", replacement: "19500101" },
];

const SEG_GROUP = {
  MSH: "ctrl", EVN: "ctrl",
  PID: "pat",  PV1: "pat",  NK1: "pat",
  ORC: "ord",  OBR: "ord",
  OBX: "res",  NTE: "res",
};

const CAT_CLR = {
  name:      { text: "#5c86d6", bg: "rgba(92,134,214,0.14)",  border: "rgba(92,134,214,0.30)" },
  id:        { text: "#5c86d6", bg: "rgba(92,134,214,0.14)",  border: "rgba(92,134,214,0.30)" },
  date:      { text: "#d88a3a", bg: "rgba(216,138,58,0.13)",  border: "rgba(216,138,58,0.30)" },
  address:   { text: "#d88a3a", bg: "rgba(216,138,58,0.13)",  border: "rgba(216,138,58,0.30)" },
  phone:     { text: "#3da88e", bg: "rgba(61,168,142,0.13)",  border: "rgba(61,168,142,0.30)" },
  geo:       { text: "#d88a3a", bg: "rgba(216,138,58,0.13)",  border: "rgba(216,138,58,0.30)" },
  biometric: { text: "#d9534f", bg: "rgba(217,83,79,0.13)",   border: "rgba(217,83,79,0.30)" },
};

const DARK = {
  bg: '#0b0e18', bg2: '#111524', surface: '#161b2e', surface2: '#1c2340',
  border: '#242d4c', border2: '#2d3760',
  text: '#e5e9f4', text2: '#9aa5c3', text3: '#5e6884',
  accent: '#3da88e', accentSoft: 'rgba(61,168,142,0.14)', accentBorder: 'rgba(61,168,142,0.30)',
  blue: '#5c86d6', blueSoft: 'rgba(92,134,214,0.14)', blueBorder: 'rgba(92,134,214,0.30)',
  amber: '#d88a3a', amberSoft: 'rgba(216,138,58,0.10)',
  editorBg: '#0d1117', isDark: true,
};

const LIGHT = {
  bg: '#f2f3f8', bg2: '#e9ecf4', surface: '#ffffff', surface2: '#f0f1f7',
  border: '#dde1ef', border2: '#c5cad9',
  text: '#1a1f2e', text2: '#47527a', text3: '#7a82a0',
  accent: '#268069', accentSoft: 'rgba(38,128,105,0.12)', accentBorder: 'rgba(38,128,105,0.30)',
  blue: '#3b6bbf', blueSoft: 'rgba(59,107,191,0.12)', blueBorder: 'rgba(59,107,191,0.30)',
  amber: '#b8711e', amberSoft: 'rgba(184,113,30,0.10)',
  editorBg: '#ffffff', isDark: false,
};

function getSegClr(seg, T) {
  const g = SEG_GROUP[seg] || 'ctrl';
  return {
    ctrl: { text: T.text3,  bg: T.surface2, border: T.border2 },
    pat:  { text: T.blue,   bg: T.blueSoft, border: T.blueBorder },
    ord:  { text: T.amber,  bg: T.amberSoft, border: 'rgba(216,138,58,0.30)' },
    res:  { text: T.accent, bg: T.accentSoft, border: T.accentBorder },
  }[g];
}

function getCatClr(cat) {
  return CAT_CLR[cat] || { text: '#9aa5c3', bg: 'rgba(154,165,195,0.10)', border: 'rgba(154,165,195,0.25)' };
}

Object.assign(window, { HL7_LINES, TREE_NODES, FINDINGS, SEG_GROUP, CAT_CLR, DARK, LIGHT, getSegClr, getCatClr });
