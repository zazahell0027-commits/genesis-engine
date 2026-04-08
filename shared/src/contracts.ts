export type RoleType = "hero" | "faction" | "nation" | "gm";

export type WorldCell = {
  id: string;
  x: number;
  y: number;
  owner: string;
  richness: number;
  stability: number;
  tension: number;
};

export type World = {
  id: string;
  name: string;
  tick: number;
  width: number;
  height: number;
  role: RoleType;
  cells: WorldCell[];
};

export type CreateWorldInput = {
  name?: string;
  width?: number;
  height?: number;
  role?: RoleType;
};
