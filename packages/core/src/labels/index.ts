// Label resolvers per format. Each walker calls into its corresponding resolver
// when building TokenNodes so the UI can render human-readable labels alongside
// structurally-correct paths.

export {
  getLabel as getHL7v2Label,
  detectVersion as detectHL7v2Version,
} from "./hl7v2.js";

export {
  getLabel as getFHIRLabel,
  detectVersion as detectFHIRVersion,
} from "./fhir.js";

export { getLabel as getCDALabel } from "./cda.js";
