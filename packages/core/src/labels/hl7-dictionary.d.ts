declare module "hl7-dictionary" {
  export interface FieldDef {
    datatype: string;
    desc: string;
    opt?: number;
    rep?: number;
    len?: number;
    table?: number;
  }
  export interface SegmentDef {
    desc: string;
    fields: ReadonlyArray<FieldDef>;
  }
  export interface VersionDef {
    segments: Record<string, SegmentDef | undefined>;
    fields?: Record<string, unknown>;
    messages?: Record<string, unknown>;
  }
  const dict: {
    definitions: Record<string, VersionDef | undefined>;
    tables: Record<string, unknown>;
  };
  export default dict;
}
