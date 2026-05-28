export type MissionType =
  | "kills"
  | "assistencias"
  | "adr"
  | "first_kill"
  | "multi_kill"
  | "vitorias";

export interface MissionDefinition {
  type: MissionType;
  name: string;
  verb: string;
  minTarget: number;
  maxTarget: number;
  step: number;
}

export const MISSION_DEFINITIONS: MissionDefinition[] = [
  {
    type: "kills",
    name: "Matador",
    verb: "Mate",
    minTarget: 30,
    maxTarget: 70,
    step: 5,
  },
  {
    type: "assistencias",
    name: "Garçom",
    verb: "Dê",
    minTarget: 15,
    maxTarget: 40,
    step: 5,
  },
  {
    type: "adr",
    name: "Bate em coitado",
    verb: "Cause",
    minTarget: 130,
    maxTarget: 260,
    step: 10,
  },
  {
    type: "first_kill",
    name: "Entry",
    verb: "Faça",
    minTarget: 15,
    maxTarget: 35,
    step: 5,
  },
  {
    type: "multi_kill",
    name: "Assasino",
    verb: "Faça",
    minTarget: 15,
    maxTarget: 35,
    step: 5,
  },
  {
    type: "vitorias",
    name: "Vitorioso",
    verb: "Ganhe",
    minTarget: 5,
    maxTarget: 12,
    step: 1,
  },
];

export const MISSIONS_PER_CYCLE = 5;
