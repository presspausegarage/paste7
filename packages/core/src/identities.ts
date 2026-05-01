// Themed obvious-fake identity pool. See docs/engine-contract.md section 7.
//
// Norse mythology: chosen for vivid, uniformly-recognizable substitutions that
// no real-world Patient confuses with their own data. Pairs are
// {family, given} where family is a descriptive epithet and given is a real
// Norse mythological name — both shapes work as either family or given when
// the source format only emits one component.

import type { IdentityPool, NamePair } from "./types.js";

export const NORSE_NAMES: ReadonlyArray<NamePair> = [
  { family: "THUNDERER", given: "THOR" },
  { family: "ALLFATHER", given: "ODIN" },
  { family: "TRICKSTER", given: "LOKI" },
  { family: "RAINBOWGUARDIAN", given: "HEIMDALL" },
  { family: "LIGHTBRINGER", given: "BALDR" },
  { family: "APPLEKEEPER", given: "IDUNN" },
  { family: "RAVENWHISPERER", given: "HUGINN" },
  { family: "WOLFRIDER", given: "ULLR" },
  { family: "SKYWEAVER", given: "FRIGG" },
  { family: "HUNTRESS", given: "SKADI" },
  { family: "SHIPMASTER", given: "NJORD" },
  { family: "GOLDENMANE", given: "SIF" },
  { family: "RUNECASTER", given: "BRAGI" },
  { family: "JUSTICEKEEPER", given: "FORSETI" },
  { family: "SHADOWWALKER", given: "HODR" },
  { family: "SUMMERLIGHT", given: "SOL" },
  { family: "MOONCHASER", given: "MANI" },
  { family: "SHIELDMAIDEN", given: "BRYNHILD" },
  { family: "SEAWANDERER", given: "AEGIR" },
  { family: "WAVEDAUGHTER", given: "RAN" },
  { family: "SILENTSON", given: "VIDAR" },
  { family: "GIANTSLAYER", given: "MAGNI" },
  { family: "EARTHMOTHER", given: "JORD" },
  { family: "DARKBRINGER", given: "NOTT" },
  { family: "DAWNDRESSER", given: "DAGR" },
  { family: "FLAMECARRIER", given: "LOGI" },
  { family: "WINTERGUARD", given: "YMIR" },
  { family: "DRAGONSEER", given: "NIDHOGG" },
  { family: "LIGHTNINGCALLER", given: "TYR" },
  { family: "GOLDENBOAR", given: "FREYR" },
];

export const NORSE_STREETS: ReadonlyArray<string> = [
  "1 BIFROST BRIDGE",
  "1 YGGDRASIL ROOT",
  "2 VALHALLA HALL",
  "3 ASGARD GATE",
  "4 MIDGARD CIRCLE",
  "5 VANAHEIM WAY",
  "6 ALFHEIM LANE",
  "7 NIDAVELLIR PATH",
  "8 JOTUNHEIM ROAD",
  "9 HELHEIM TRAIL",
  "10 MUSPELHEIM PEAK",
  "11 NIFLHEIM TERRACE",
  "12 SVARTALFHEIM RIDGE",
  "13 GLADSHEIM ALLEY",
  "14 THRUDHEIM AVENUE",
  "15 NOATUN COURT",
  "16 SESSRUMNIR LOOP",
  "17 SOKKVABEKK STREET",
  "18 BREIDABLIK PLACE",
  "19 GIMLE ROAD",
  "20 IDAVOLL DRIVE",
];

export const NORSE_CITIES: ReadonlyArray<string> = [
  "ASGARD",
  "MIDGARD",
  "VANAHEIM",
  "ALFHEIM",
  "NIDAVELLIR",
  "JOTUNHEIM",
  "HELHEIM",
  "MUSPELHEIM",
  "NIFLHEIM",
  "SVARTALFHEIM",
];

export const DEFAULT_POOL: IdentityPool = {
  names: NORSE_NAMES,
  streetAddresses: NORSE_STREETS,
  cities: NORSE_CITIES,
};
