import Database from "@ioc:Adonis/Lucid/Database";
import { DateTime } from "luxon";
import {
  MISSION_DEFINITIONS,
  MISSIONS_PER_CYCLE,
  MissionDefinition,
  MissionType,
} from "./MissionConfig";

const TABLE = "tb_jogadores_missoes";

type MissionRow = {
  id: number;
  jogador_id: number;
  ciclo: number;
  ordem: number;
  tipo: MissionType;
  nome: string;
  descricao: string;
  meta: number | string;
  progresso: number | string;
  concluida: boolean | number;
  concluida_em: string | null;
};

export type MissionSnapshot = {
  id: number;
  jogador_id: number;
  cycle: number;
  order: number;
  type: MissionType;
  name: string;
  description: string;
  target: number;
  progress: number;
  percentage: number;
  completed: boolean;
  completed_at: string | null;
};

export type MissionMatchStats = {
  kills: number;
  assistencias: number;
  adr: number;
  first_kill: number;
  multi_kill: number;
  vitoria: boolean;
};

function toNum(value: any): number {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const normalized = String(value).replace(",", ".");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function normalizeBool(value: any): boolean {
  if (typeof value === "boolean") return value;
  return Number(value || 0) > 0;
}

function missionDescription(def: MissionDefinition, target: number): string {
  switch (def.type) {
    case "kills":
      return `${def.verb} ${target} jogadores`;
    case "assistencias":
      return `${def.verb} ${target} assistências`;
    case "adr":
      return `${def.verb} ${target} de ADR`;
    case "first_kill":
      return `${def.verb} ${target} first kills`;
    case "multi_kill":
      return `${def.verb} ${target} multi kills`;
    case "vitorias":
      return `${def.verb} ${target} partidas`;
    default:
      return `${def.verb} ${target}`;
  }
}

export class MissionService {
  private static shuffleDefinitions() {
    const copy = [...MISSION_DEFINITIONS];
    for (let i = copy.length - 1; i > 0; i--) {
      const rand = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[rand]] = [copy[rand], copy[i]];
    }
    return copy;
  }

  private static pickTarget(def: MissionDefinition): number {
    if (def.maxTarget <= def.minTarget) return def.minTarget;
    const step = Math.max(1, def.step || 1);
    const span = def.maxTarget - def.minTarget;
    const steps = Math.floor(span / step);
    const randStep = Math.floor(Math.random() * (steps + 1));
    return def.minTarget + randStep * step;
  }

  private static calcIncrement(type: MissionType, stats: MissionMatchStats): number {
    switch (type) {
      case "kills":
        return Math.max(0, toNum(stats.kills));
      case "assistencias":
        return Math.max(0, toNum(stats.assistencias));
      case "adr":
        return Math.max(0, toNum(stats.adr));
      case "first_kill":
        return Math.max(0, toNum(stats.first_kill));
      case "multi_kill":
        return Math.max(0, toNum(stats.multi_kill));
      case "vitorias":
        return stats.vitoria ? 1 : 0;
      default:
        return 0;
    }
  }

  private static toSnapshot(row: MissionRow): MissionSnapshot {
    const target = Math.max(1, round2(toNum(row.meta)));
    const progress = Math.max(0, Math.min(target, round2(toNum(row.progresso))));
    const completed = normalizeBool(row.concluida) || progress >= target;
    return {
      id: Number(row.id),
      jogador_id: Number(row.jogador_id),
      cycle: Number(row.ciclo),
      order: Number(row.ordem),
      type: row.tipo,
      name: String(row.nome || ""),
      description: String(row.descricao || ""),
      target,
      progress,
      percentage: Math.max(0, Math.min(100, Math.round((progress / target) * 100))),
      completed,
      completed_at: row.concluida_em || null,
    };
  }

  private static async fetchCycleRows(
    db: any,
    jogadorId: number,
    cycle: number
  ): Promise<MissionRow[]> {
    return (await db
      .from(TABLE)
      .where("jogador_id", jogadorId)
      .where("ciclo", cycle)
      .orderBy("ordem", "asc")) as MissionRow[];
  }

  private static isCycleCompleted(rows: MissionRow[]): boolean {
    if (rows.length < MISSIONS_PER_CYCLE) return false;
    return rows.every((row) => normalizeBool(row.concluida) || toNum(row.progresso) >= toNum(row.meta));
  }

  private static async createCycle(db: any, jogadorId: number, cycle: number) {
    const now = DateTime.now().toSQL();
    const selected = this.shuffleDefinitions().slice(0, MISSIONS_PER_CYCLE);
    const rows = selected.map((definition, index) => {
      const target = this.pickTarget(definition);
      return {
        jogador_id: jogadorId,
        ciclo: cycle,
        ordem: index + 1,
        tipo: definition.type,
        nome: definition.name,
        descricao: missionDescription(definition, target),
        meta: target,
        progresso: 0,
        concluida: false,
        concluida_em: null,
        created_at: now,
        updated_at: now,
      };
    });

    await db.table(TABLE).insert(rows);
    return this.fetchCycleRows(db, jogadorId, cycle);
  }

  static async ensureActiveMissions(jogadorId: number, client?: any) {
    const id = Number(jogadorId || 0);
    if (id <= 0) return { cycle: 1, missions: [] as MissionSnapshot[] };

    const db = client || Database;
    const maxCycleRow = await db
      .from(TABLE)
      .where("jogador_id", id)
      .max("ciclo as ciclo")
      .first();

    let cycle = Number(maxCycleRow?.ciclo || 0);
    let rows: MissionRow[] = [];

    if (cycle <= 0) {
      cycle = 1;
      rows = await this.createCycle(db, id, cycle);
    } else {
      rows = await this.fetchCycleRows(db, id, cycle);
      if (rows.length < MISSIONS_PER_CYCLE) {
        await db.from(TABLE).where("jogador_id", id).where("ciclo", cycle).delete();
        rows = await this.createCycle(db, id, cycle);
      } else if (this.isCycleCompleted(rows)) {
        cycle += 1;
        rows = await this.createCycle(db, id, cycle);
      }
    }

    return {
      cycle,
      missions: rows.map((row) => this.toSnapshot(row)),
    };
  }

  static async applyMatchProgress(
    jogadorId: number,
    matchStats: MissionMatchStats,
    client?: any
  ) {
    const id = Number(jogadorId || 0);
    if (id <= 0) return;

    const db = client || Database;
    const active = await this.ensureActiveMissions(id, db);
    if (active.missions.length === 0) return;

    const now = DateTime.now().toSQL();
    const rows = (await this.fetchCycleRows(db, id, active.cycle)) as MissionRow[];

    for (const row of rows) {
      if (normalizeBool(row.concluida)) continue;

      const increment = this.calcIncrement(row.tipo, matchStats);
      if (increment <= 0) continue;

      const target = Math.max(1, toNum(row.meta));
      const current = Math.max(0, toNum(row.progresso));
      const next = Math.min(target, round2(current + increment));
      const completed = next >= target;

      await db
        .from(TABLE)
        .where("id", row.id)
        .update({
          progresso: next,
          concluida: completed,
          concluida_em: completed ? now : null,
          updated_at: now,
        });

      row.progresso = next;
      row.concluida = completed;
      row.concluida_em = completed ? now : null;
    }

    if (this.isCycleCompleted(rows)) {
      await this.createCycle(db, id, active.cycle + 1);
    }
  }

  static async getPlayerMissions(jogadorId: number, client?: any) {
    return this.ensureActiveMissions(jogadorId, client);
  }
}

