export interface Lane {
  id: string; name: string; source: string; sr: number; channels: number; samples: number;
  offset: number; gain_db: number; mute: boolean; solo: boolean; version: number;
}
export interface Settings { compute_device: string; available_devices: string[]; self_check: Record<string, number> | null; reason: string | null }
export interface Directory { path: string; entries: { name: string; is_dir: boolean; size: number; mtime: number }[] }
