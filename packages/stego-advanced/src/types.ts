export interface PvdRange {
  lower: number;
  upper: number;
  bits: number;
}

export interface PvdOptions {
  channels?: Array<'R' | 'G' | 'B'>;
}

export interface DwtOptions {
  channels?: Array<'R' | 'G' | 'B'>;
}

export interface DctOptions {
  channels?: Array<'R' | 'G' | 'B'>;
  quality?: number;
}
