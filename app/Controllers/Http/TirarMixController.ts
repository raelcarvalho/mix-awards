import { HttpContextContract } from "@ioc:Adonis/Core/HttpContext";
import Database from "@ioc:Adonis/Lucid/Database";
import { DateTime } from "luxon";

import CustomResponse from "App/Utils/CustomResponse";
import Jogadores from "App/Models/Jogadores";

type Team = "A" | "B";

type SessaoRow = {
  id: number;
  status: "criando" | "capitaes_definidos" | "draft_em_andamento" | "finalizado" | "cancelado";
  fase:
    | "aguardando_capitaes"
    | "aguardando_inicio"
    | "countdown"
    | "dice"
    | "draft"
    | "finalizado";
  criado_por_usuario_adm_id: number;
  time_a_capitao_id: number | null;
  time_b_capitao_id: number | null;
  start_ready_a: boolean;
  start_ready_b: boolean;
  start_countdown_started_at: string | Date | null;
  start_countdown_ends_at: string | Date | null;
  dice_first_turn: Team | null;
  dice_turn: Team | null;
  dice_winner: Team | null;
  dice_a_d1: number | null;
  dice_a_d2: number | null;
  dice_a_total: number | null;
  dice_b_d1: number | null;
  dice_b_d2: number | null;
  dice_b_total: number | null;
  pick_turn: Team | null;
  pick_deadline: string | Date | null;
  map_stage: "idle" | "countdown" | "dice" | "veto" | "done" | null;
  map_countdown_ends_at: string | Date | null;
  map_dice_first_turn: Team | null;
  map_dice_turn: Team | null;
  map_dice_winner: Team | null;
  map_dice_a_d1: number | null;
  map_dice_a_d2: number | null;
  map_dice_a_total: number | null;
  map_dice_b_d1: number | null;
  map_dice_b_d2: number | null;
  map_dice_b_total: number | null;
  map_veto_turn: Team | null;
  map_veto_deadline: string | Date | null;
  mapa_escolhido: string | null;
  mapa_escolhido_em: string | Date | null;
  iniciado_em: string | Date | null;
  finalizado_em: string | Date | null;
  accept_ends_at: string | Date | null;
  room_code: string | null;
  room_name: string | null;
  room_password: string | null;
  max_players: number;
  owner_id: number | null;
  game_mode: "solo" | "room";
  is_public: boolean;
  draft_mode: "alternating" | "snake";
};

type SessaoPlayerRow = {
  id: number;
  sessao_id: number;
  jogador_id: number;
  is_selecionado: boolean;
  is_capitao: boolean;
  time: Team | null;
  ordem_pick: number | null;
  pool_slot: number | null;
  aceitou: boolean;
  is_ready: boolean;
  nome: string;
  imagem: string | null;
  kda_player: string | null;
  pontos: string | null;
  kills: string | null;
  adr: string | null;
  vitorias: string | null;
  qtd_partidas: string | null;
  level: number | null;
};

type SessaoMapaRow = {
  id: number;
  sessao_id: number;
  mapa: string;
  banido: boolean;
  banido_por_time: Team | null;
  ordem_ban: number | null;
  banido_em: string | Date | null;
};

export default class TirarMixController {
  protected customResponse = new CustomResponse();
  private ONLINE_SECONDS = 90;
  private MAX_POOL_SLOTS = 8;
  // Se houver jogadores aguardando e os capitães não entrarem dentro desse tempo,
  // a sessão é limpa (pool zerado) para não ficar cacheada.
  private CAPTAIN_WAIT_TIMEOUT_SECONDS = 120;
  private MAP_POOL = [
    "de_ancient",
    "de_anubis",
    "de_cache",
    "de_dust2",
    "de_inferno",
    "de_mirage",
    "de_nuke",
    "de_overpass",
  ];

  private toMillis(v: unknown): number | null {
    if (!v) return null;
    if (v instanceof Date) return v.getTime();
    const s = DateTime.fromISO(String(v));
    return s.isValid ? s.toMillis() : null;
  }

  private nowSql() {
    return DateTime.now().toSQL();
  }

  private normalizePoolSlot(value: unknown): number | null {
    const n = Number(value);
    if (!Number.isFinite(n)) return null;
    const slot = Math.trunc(n);
    if (slot < 1 || slot > this.MAX_POOL_SLOTS) return null;
    return slot;
  }

  private async firstFreePoolSlot(sessaoId: number, trx?: any) {
    const rows = await (trx || Database)
      .from("tb_tirar_mix_players")
      .where("sessao_id", sessaoId)
      .where("is_capitao", false)
      .where("is_selecionado", false)
      .whereNotNull("pool_slot")
      .select("pool_slot");

    const used = new Set<number>();
    for (const row of rows) {
      const slot = this.normalizePoolSlot((row as any)?.pool_slot);
      if (slot !== null) used.add(slot);
    }

    for (let slot = 1; slot <= this.MAX_POOL_SLOTS; slot += 1) {
      if (!used.has(slot)) return slot;
    }
    return null;
  }

  private calcDiceTotal(
    d1: number | null | undefined,
    d2: number | null | undefined,
    fallback: number | null | undefined = null
  ): number | null {
    if (typeof d1 === "number" && typeof d2 === "number") {
      return d1 + d2;
    }
    return typeof fallback === "number" ? fallback : null;
  }

  private normalizeMapName(value: unknown) {
    return String(value || "")
      .trim()
      .toLowerCase();
  }

  private mapImagePath(mapa: string) {
    return `/uploads/mapas/${mapa}.png`;
  }

  private async sessaoMapas(sessaoId: number, trx?: any): Promise<SessaoMapaRow[]> {
    return ((trx || Database)
      .from("tb_tirar_mix_mapas")
      .where("sessao_id", sessaoId)
      .orderBy("ordem_ban", "asc")
      .orderBy("mapa", "asc")
      .select(
        "id",
        "sessao_id",
        "mapa",
        "banido",
        "banido_por_time",
        "ordem_ban",
        "banido_em"
      )) as Promise<SessaoMapaRow[]>;
  }

  private async ensureMapPool(sessaoId: number, trx?: any) {
    const rows = await this.sessaoMapas(sessaoId, trx);
    const existing = new Set(rows.map((r) => this.normalizeMapName(r.mapa)));
    const now = this.nowSql();
    const missing = this.MAP_POOL.filter((m) => !existing.has(m));
    if (!missing.length) return;

    await (trx || Database).table("tb_tirar_mix_mapas").insert(
      missing.map((mapa) => ({
        sessao_id: sessaoId,
        mapa,
        banido: false,
        banido_por_time: null,
        ordem_ban: null,
        banido_em: null,
        created_at: now,
        updated_at: now,
      }))
    );
  }

  private async jogadorDoUsuario(usuarioId: number) {
    return Jogadores.query().where("usuario_adm_id", usuarioId).first();
  }

  private async jogadorDoUsuarioOrFail(usuarioId: number) {
    const jogador = await this.jogadorDoUsuario(usuarioId);
    if (!jogador) throw new Error("Nenhum jogador vinculado ao usuário.");
    return jogador;
  }

  private normalizeClientSession(raw: string | undefined | null, userId: number) {
    const cleaned = String(raw || "").trim();
    if (!cleaned) return `u${userId}-default`;
    return cleaned.slice(0, 64);
  }

  private async cleanupOnline() {
    const cutoff = DateTime.now().minus({ seconds: this.ONLINE_SECONDS }).toSQL();
    await Database.from("tb_online_usuarios").where("last_seen", "<", cutoff!).delete();
  }

  private async markOnline(
    usuarioId: number,
    jogadorId: number | null,
    clientSessionId: string,
    userAgent: string | null
  ) {
    await this.cleanupOnline();

    const now = this.nowSql();
    const existing = await Database.from("tb_online_usuarios")
      .where("usuario_id", usuarioId)
      .where("session_id", clientSessionId)
      .first();

    if (existing) {
      await Database.from("tb_online_usuarios")
        .where("id", existing.id)
        .update({
          jogador_id: jogadorId,
          user_agent: userAgent,
          last_seen: now,
        });
    } else {
      await Database.table("tb_online_usuarios").insert({
        usuario_id: usuarioId,
        jogador_id: jogadorId,
        session_id: clientSessionId,
        user_agent: userAgent,
        last_seen: now,
      });
    }
  }

  private async sessionAtiva(usuarioId: number): Promise<SessaoRow> {
    let sessao = (await Database.from("tb_tirar_mix_sessoes")
      .whereNotIn("status", ["finalizado", "cancelado"])
      .orderBy("id", "desc")
      .first()) as SessaoRow | undefined;

    if (!sessao) {
      const inserted = await Database.table("tb_tirar_mix_sessoes")
        .insert({
          status: "criando",
          fase: "aguardando_capitaes",
          criado_por_usuario_adm_id: usuarioId,
          start_ready_a: false,
          start_ready_b: false,
          turno_index: 0,
          turno_consumidos: 0,
          created_at: this.nowSql(),
          updated_at: this.nowSql(),
        })
        .returning("id");

      const id = Array.isArray(inserted)
        ? Number((inserted[0] as any)?.id ?? inserted[0])
        : Number(inserted);

      sessao = (await Database.from("tb_tirar_mix_sessoes")
        .where("id", id)
        .first()) as SessaoRow;
    }

    return sessao;
  }

  private async sessionById(id: number): Promise<SessaoRow | null> {
    const sessao = (await Database.from("tb_tirar_mix_sessoes")
      .where("id", id)
      .first()) as SessaoRow | undefined;
    return sessao ?? null;
  }

  private async playersSessao(sessaoId: number): Promise<SessaoPlayerRow[]> {
    const rows = (await Database.from("tb_tirar_mix_players as sp")
      .innerJoin("tb_jogadores as j", "j.id", "sp.jogador_id")
      .where("sp.sessao_id", sessaoId)
      .select(
        "sp.id",
        "sp.sessao_id",
        "sp.jogador_id",
        "sp.is_selecionado",
        "sp.is_capitao",
        "sp.time",
        "sp.ordem_pick",
        "sp.pool_slot",
        "sp.aceitou",
        "j.nome",
        "j.imagem",
        "j.kda_player",
        "j.pontos",
        "j.kills",
        "j.adr",
        "j.vitorias",
        "j.qtd_partidas",
        "j.level"
      )) as SessaoPlayerRow[];

    return rows;
  }

  private async onlinePlayers() {
    const cutoff = DateTime.now().minus({ seconds: this.ONLINE_SECONDS }).toSQL();

    const rows = await Database.from("tb_online_usuarios as ou")
      .innerJoin("tb_jogadores as j", "j.id", "ou.jogador_id")
      .where("ou.last_seen", ">=", cutoff!)
      .select(
        "j.id",
        "j.nome",
        "j.imagem",
        "j.kda_player",
        "j.pontos",
        "j.kills",
        "j.adr",
        "j.vitorias",
        "j.qtd_partidas",
        "j.level",
        "ou.usuario_id",
        "ou.last_seen"
      )
      .orderBy("ou.last_seen", "desc");

    const used = new Set<number>();
    const deduped: any[] = [];
    for (const row of rows) {
      const id = Number(row.id);
      if (used.has(id)) continue;
      used.add(id);
      deduped.push(row);
    }

    return deduped;
  }

  private teamByCaptain(sessao: SessaoRow, jogadorId: number): Team | null {
    if (sessao.time_a_capitao_id === jogadorId) return "A";
    if (sessao.time_b_capitao_id === jogadorId) return "B";
    return null;
  }

  private pickOrderSequence(sessao: SessaoRow) {
    const picks = ["A", "B", "A", "B", "A", "B", "A", "B"] as Team[];
    if (sessao.dice_winner === "A") return picks;
    return picks.map((t) => (t === "A" ? "B" : "A"));
  }

  private async countTeamPicks(sessaoId: number, team: Team, trx?: any) {
    const q = (trx || Database)
      .from("tb_tirar_mix_players")
      .where("sessao_id", sessaoId)
      .where("is_capitao", false)
      .where("is_selecionado", true)
      .where("time", team)
      .count("* as c")
      .first();
    const row = await q;
    return Number(row?.c || 0);
  }

  private async remainingPool(sessaoId: number, trx?: any) {
    return (trx || Database)
      .from("tb_tirar_mix_players")
      .where("sessao_id", sessaoId)
      .where("is_capitao", false)
      .where("is_selecionado", false)
      .orderByRaw("RANDOM()");
  }

  private async nextPickOrder(sessaoId: number, trx?: any) {
    const row = await (trx || Database)
      .from("tb_tirar_mix_picks")
      .where("sessao_id", sessaoId)
      .count("* as c")
      .first();
    return Number(row?.c || 0) + 1;
  }

  private async startMapVetoStage(sessaoId: number, trx?: any) {
    await this.ensureMapPool(sessaoId, trx);
    const now = this.nowSql();

    await (trx || Database)
      .from("tb_tirar_mix_mapas")
      .where("sessao_id", sessaoId)
      .update({
        banido: false,
        banido_por_time: null,
        ordem_ban: null,
        banido_em: null,
        updated_at: now,
      });

    await (trx || Database)
      .from("tb_tirar_mix_sessoes")
      .where("id", sessaoId)
      .update({
        status: "draft_em_andamento",
        fase: "finalizado",
        pick_turn: null,
        pick_deadline: null,
        map_stage: "countdown",
        map_countdown_ends_at: DateTime.now().plus({ seconds: 5 }).toSQL(),
        map_dice_first_turn: null,
        map_dice_turn: null,
        map_dice_winner: null,
        map_dice_a_d1: null,
        map_dice_a_d2: null,
        map_dice_a_total: null,
        map_dice_b_d1: null,
        map_dice_b_d2: null,
        map_dice_b_total: null,
        map_veto_turn: null,
        map_veto_deadline: null,
        mapa_escolhido: null,
        mapa_escolhido_em: null,
        finalizado_em: null,
        updated_at: now,
      });
  }

  private async closeSessaoComMapa(sessaoId: number, mapaEscolhido: string, trx?: any) {
    await (trx || Database)
      .from("tb_tirar_mix_sessoes")
      .where("id", sessaoId)
      .update({
        status: "finalizado",
        fase: "finalizado",
        map_stage: "done",
        map_veto_turn: null,
        map_veto_deadline: null,
        mapa_escolhido: mapaEscolhido,
        mapa_escolhido_em: this.nowSql(),
        finalizado_em: this.nowSql(),
        updated_at: this.nowSql(),
      });
  }

  private async setFinalizado(sessaoId: number, trx?: any) {
    await this.startMapVetoStage(sessaoId, trx);
  }

  private async applyMapBan(sessaoId: number, team: Team, mapaRaw: string, trx?: any) {
    const mapa = this.normalizeMapName(mapaRaw);
    if (!this.MAP_POOL.includes(mapa)) {
      throw new Error("Mapa inválido para veto.");
    }

    const db = trx || Database;
    await this.ensureMapPool(sessaoId, trx);

    const mapRow = (await db
      .from("tb_tirar_mix_mapas")
      .where("sessao_id", sessaoId)
      .whereRaw("LOWER(mapa) = ?", [mapa])
      .first()) as SessaoMapaRow | undefined;

    if (!mapRow || mapRow.banido) {
      throw new Error("Mapa já banido ou indisponível.");
    }

    const bannedRow = await db
      .from("tb_tirar_mix_mapas")
      .where("sessao_id", sessaoId)
      .where("banido", true)
      .count("* as c")
      .first();
    const ordemBan = Number(bannedRow?.c || 0) + 1;

    await db
      .from("tb_tirar_mix_mapas")
      .where("id", mapRow.id)
      .update({
        banido: true,
        banido_por_time: team,
        ordem_ban: ordemBan,
        banido_em: this.nowSql(),
        updated_at: this.nowSql(),
      });

    const remaining = (await db
      .from("tb_tirar_mix_mapas")
      .where("sessao_id", sessaoId)
      .where("banido", false)
      .orderBy("mapa", "asc")
      .select("mapa")) as Array<{ mapa: string }>;

    if (remaining.length <= 1) {
      const selected = this.normalizeMapName(remaining[0]?.mapa || "");
      if (selected) {
        await this.closeSessaoComMapa(sessaoId, selected, trx);
      } else {
        await this.closeSessaoComMapa(sessaoId, mapa, trx);
      }
      return;
    }

    const nextTurn: Team = team === "A" ? "B" : "A";
    await db
      .from("tb_tirar_mix_sessoes")
      .where("id", sessaoId)
      .update({
        map_stage: "veto",
        map_veto_turn: nextTurn,
        map_veto_deadline: DateTime.now().plus({ seconds: 30 }).toSQL(),
        updated_at: this.nowSql(),
      });
  }

  private async autoBanMapIfExpired(sessao: SessaoRow) {
    if (sessao.map_stage !== "veto" || !sessao.map_veto_turn || !sessao.map_veto_deadline) return;

    const ms = this.toMillis(sessao.map_veto_deadline);
    if (ms === null || ms > Date.now()) return;

    await this.ensureMapPool(sessao.id);
    const pool = (await Database.from("tb_tirar_mix_mapas")
      .where("sessao_id", sessao.id)
      .where("banido", false)
      .orderByRaw("RANDOM()")
      .select("mapa")) as Array<{ mapa: string }>;
    const target = pool[0]?.mapa;
    if (!target) return;

    await this.applyMapBan(sessao.id, sessao.map_veto_turn, target);
  }

  private async applyPick(sessaoId: number, team: Team, captainId: number, playerId: number) {
    await Database.transaction(async (trx) => {
      const sessao = (await trx
        .from("tb_tirar_mix_sessoes")
        .where("id", sessaoId)
        .forUpdate()
        .first()) as SessaoRow;

      if (!sessao) throw new Error("Sessão não encontrada.");

      const teamCount = await this.countTeamPicks(sessaoId, team, trx);
      if (teamCount >= 4) throw new Error("Time já está completo.");

      const slot = await trx
        .from("tb_tirar_mix_players")
        .where("sessao_id", sessaoId)
        .where("jogador_id", playerId)
        .where("is_capitao", false)
        .where("is_selecionado", false)
        .first();

      if (!slot) throw new Error("Jogador não disponível para pick.");

      const ordem = await this.nextPickOrder(sessaoId, trx);

      await trx.from("tb_tirar_mix_players").where("id", slot.id).update({
        is_selecionado: true,
        time: team,
        ordem_pick: ordem,
        pool_slot: null,
        updated_at: this.nowSql(),
      });

      await trx.table("tb_tirar_mix_picks").insert({
        sessao_id: sessaoId,
        captain_id: captainId,
        player_id: playerId,
        time: team,
        ordem_pick: ordem,
        created_at: this.nowSql(),
      });

      const remRows = await this.remainingPool(sessaoId, trx);
      const countA = await this.countTeamPicks(sessaoId, "A", trx);
      const countB = await this.countTeamPicks(sessaoId, "B", trx);

      if (remRows.length === 1) {
        const last = remRows[0];
        let targetTeam: Team;
        if (countA < countB) targetTeam = "A";
        else if (countB < countA) targetTeam = "B";
        else targetTeam = team === "A" ? "B" : "A";

        const targetCaptain =
          targetTeam === "A" ? sessao.time_a_capitao_id : sessao.time_b_capitao_id;

        if (targetCaptain) {
          const ordemAuto = await this.nextPickOrder(sessaoId, trx);
          await trx.from("tb_tirar_mix_players").where("id", last.id).update({
            is_selecionado: true,
            time: targetTeam,
            ordem_pick: ordemAuto,
            pool_slot: null,
            updated_at: this.nowSql(),
          });

          await trx.table("tb_tirar_mix_picks").insert({
            sessao_id: sessaoId,
            captain_id: targetCaptain,
            player_id: last.jogador_id,
            time: targetTeam,
            ordem_pick: ordemAuto,
            created_at: this.nowSql(),
          });
        }
      }

      const remAfter = await this.remainingPool(sessaoId, trx);
      const countAFinal = await this.countTeamPicks(sessaoId, "A", trx);
      const countBFinal = await this.countTeamPicks(sessaoId, "B", trx);

      if (remAfter.length === 0 || (countAFinal >= 4 && countBFinal >= 4)) {
        await this.setFinalizado(sessaoId, trx);
        return;
      }

      const picksDoneRow = await trx
        .from("tb_tirar_mix_picks")
        .where("sessao_id", sessaoId)
        .count("* as c")
        .first();
      const picksDone = Number(picksDoneRow?.c || 0);

      const order = this.pickOrderSequence(sessao);
      const nextTurn = order[Math.min(picksDone, order.length - 1)];

      await trx.from("tb_tirar_mix_sessoes").where("id", sessaoId).update({
        status: "draft_em_andamento",
        fase: "draft",
        pick_turn: nextTurn,
        pick_deadline: DateTime.now().plus({ seconds: 30 }).toSQL(),
        updated_at: this.nowSql(),
      });
    });
  }

  private async autoPickIfExpired(sessao: SessaoRow) {
    if (sessao.fase !== "draft" || !sessao.pick_turn || !sessao.pick_deadline) return;

    const ms = this.toMillis(sessao.pick_deadline);
    if (ms === null || ms > Date.now()) return;

    const captainId =
      sessao.pick_turn === "A" ? sessao.time_a_capitao_id : sessao.time_b_capitao_id;
    if (!captainId) return;

    const pool = await this.remainingPool(sessao.id);
    if (!pool.length) {
      await this.setFinalizado(sessao.id);
      return;
    }

    const player = pool[0];
    await this.applyPick(sessao.id, sessao.pick_turn, captainId, Number(player.jogador_id));
  }

  private async reconcile(sessaoId: number) {
    let sessao = await this.sessionById(sessaoId);
    if (!sessao) return null;

    const hasCaptains = !!(sessao.time_a_capitao_id && sessao.time_b_capitao_id);

    if (!hasCaptains) {
      // Só limpa o pool quando NENHUM capitão entrou. Se ao menos um capitão já entrou
      // (mesmo que o outro esteja pendente ou ainda não tenham startado), não reseta.
      const nenhumCapitao = !sessao.time_a_capitao_id && !sessao.time_b_capitao_id;
      // Se há jogadores aguardando e os capitães não entraram dentro do tempo limite,
      // limpa o pool para a sessão não ficar cacheada com jogadores presos.
      const waiting = (await Database.from("tb_tirar_mix_players")
        .where("sessao_id", sessao.id)
        .where("is_capitao", false)
        .min("created_at as oldest")
        .count("* as total")
        .first()) as { oldest: string | Date | null; total: number | string } | undefined;

      const waitingCount = Number(waiting?.total || 0);
      const oldestMs = this.toMillis(waiting?.oldest);
      if (
        nenhumCapitao &&
        waitingCount > 0 &&
        oldestMs !== null &&
        Date.now() - oldestMs >= this.CAPTAIN_WAIT_TIMEOUT_SECONDS * 1000
      ) {
        await Database.from("tb_tirar_mix_players").where("sessao_id", sessao.id).delete();
      }

      await Database.from("tb_tirar_mix_sessoes").where("id", sessao.id).update({
        status: "criando",
        fase: "aguardando_capitaes",
        start_ready_a: false,
        start_ready_b: false,
        pick_turn: null,
        pick_deadline: null,
        map_stage: "idle",
        map_countdown_ends_at: null,
        map_dice_first_turn: null,
        map_dice_turn: null,
        map_dice_winner: null,
        map_dice_a_d1: null,
        map_dice_a_d2: null,
        map_dice_a_total: null,
        map_dice_b_d1: null,
        map_dice_b_d2: null,
        map_dice_b_total: null,
        map_veto_turn: null,
        map_veto_deadline: null,
        mapa_escolhido: null,
        mapa_escolhido_em: null,
        updated_at: this.nowSql(),
      });
      await Database.from("tb_tirar_mix_mapas").where("sessao_id", sessao.id).delete();
      return this.sessionById(sessao.id);
    }

    if (sessao.fase === "aguardando_capitaes") {
      await Database.from("tb_tirar_mix_sessoes").where("id", sessao.id).update({
        status: "capitaes_definidos",
        fase: "aguardando_inicio",
        updated_at: this.nowSql(),
      });
      sessao = await this.sessionById(sessao.id);
    }

    if (sessao && sessao.fase === "countdown" && sessao.start_countdown_ends_at) {
      const endMs = this.toMillis(sessao.start_countdown_ends_at);
      if (endMs !== null && endMs <= Date.now()) {
        const first = (Math.random() < 0.5 ? "A" : "B") as Team;
        await Database.from("tb_tirar_mix_sessoes").where("id", sessao.id).update({
          fase: "dice",
          dice_first_turn: first,
          dice_turn: first,
          updated_at: this.nowSql(),
        });
        sessao = await this.sessionById(sessao.id);
      }
    }

    if (sessao && sessao.fase === "dice") {
      const aTotal = this.calcDiceTotal(
        sessao.dice_a_d1,
        sessao.dice_a_d2,
        sessao.dice_a_total
      );
      const bTotal = this.calcDiceTotal(
        sessao.dice_b_d1,
        sessao.dice_b_d2,
        sessao.dice_b_total
      );

      const fixPatch: any = {};
      if (sessao.dice_a_total !== aTotal) fixPatch.dice_a_total = aTotal;
      if (sessao.dice_b_total !== bTotal) fixPatch.dice_b_total = bTotal;
      if (Object.keys(fixPatch).length) {
        const sessaoAtualId = sessao.id;
        fixPatch.updated_at = this.nowSql();
        await Database.from("tb_tirar_mix_sessoes").where("id", sessaoAtualId).update(fixPatch);
        sessao = await this.sessionById(sessaoAtualId);
        if (!sessao) return null;
      }

      if (aTotal !== null && bTotal !== null) {
        if (aTotal === bTotal) {
          const sessaoAtualId = sessao.id;
          const first = (Math.random() < 0.5 ? "A" : "B") as Team;
          await Database.from("tb_tirar_mix_sessoes").where("id", sessaoAtualId).update({
            fase: "dice",
            dice_first_turn: first,
            dice_turn: first,
            dice_winner: null,
            dice_a_d1: null,
            dice_a_d2: null,
            dice_a_total: null,
            dice_b_d1: null,
            dice_b_d2: null,
            dice_b_total: null,
            updated_at: this.nowSql(),
          });
          sessao = await this.sessionById(sessaoAtualId);
          if (!sessao) return null;
        } else {
          const sessaoAtualId = sessao.id;
          const iniciadoEm = sessao.iniciado_em;
          const winner: Team = aTotal > bTotal ? "A" : "B";
          await Database.from("tb_tirar_mix_sessoes").where("id", sessaoAtualId).update({
            status: "draft_em_andamento",
            fase: "draft",
            dice_winner: winner,
            dice_turn: null,
            pick_turn: winner,
            pick_deadline: DateTime.now().plus({ seconds: 30 }).toSQL(),
            iniciado_em: iniciadoEm ?? this.nowSql(),
            updated_at: this.nowSql(),
          });
          sessao = await this.sessionById(sessaoAtualId);
          if (!sessao) return null;
        }
      }
    }

    if (sessao && sessao.fase === "draft") {
      await this.autoPickIfExpired(sessao);
      sessao = await this.sessionById(sessao.id);
    }

    if (
      sessao &&
      sessao.fase === "finalizado" &&
      sessao.map_stage &&
      sessao.map_stage !== "idle" &&
      sessao.status !== "cancelado"
    ) {
      await this.ensureMapPool(sessao.id);

      if (sessao.map_stage === "countdown" && sessao.map_countdown_ends_at) {
        const endMs = this.toMillis(sessao.map_countdown_ends_at);
        if (endMs !== null && endMs <= Date.now()) {
          const first = (Math.random() < 0.5 ? "A" : "B") as Team;
          await Database.from("tb_tirar_mix_sessoes").where("id", sessao.id).update({
            map_stage: "dice",
            map_dice_first_turn: first,
            map_dice_turn: first,
            map_dice_winner: null,
            map_dice_a_d1: null,
            map_dice_a_d2: null,
            map_dice_a_total: null,
            map_dice_b_d1: null,
            map_dice_b_d2: null,
            map_dice_b_total: null,
            map_veto_turn: null,
            map_veto_deadline: null,
            updated_at: this.nowSql(),
          });
          sessao = await this.sessionById(sessao.id);
          if (!sessao) return null;
        }
      }

      if (sessao && sessao.map_stage === "dice") {
        const aTotal = this.calcDiceTotal(
          sessao.map_dice_a_d1,
          sessao.map_dice_a_d2,
          sessao.map_dice_a_total
        );
        const bTotal = this.calcDiceTotal(
          sessao.map_dice_b_d1,
          sessao.map_dice_b_d2,
          sessao.map_dice_b_total
        );

        const fixPatch: any = {};
        if (sessao.map_dice_a_total !== aTotal) fixPatch.map_dice_a_total = aTotal;
        if (sessao.map_dice_b_total !== bTotal) fixPatch.map_dice_b_total = bTotal;
        if (Object.keys(fixPatch).length) {
          fixPatch.updated_at = this.nowSql();
          await Database.from("tb_tirar_mix_sessoes").where("id", sessao.id).update(fixPatch);
          sessao = await this.sessionById(sessao.id);
          if (!sessao) return null;
        }

        if (aTotal !== null && bTotal !== null) {
          if (aTotal === bTotal) {
            const first = (Math.random() < 0.5 ? "A" : "B") as Team;
            await Database.from("tb_tirar_mix_sessoes").where("id", sessao.id).update({
              map_stage: "dice",
              map_dice_first_turn: first,
              map_dice_turn: first,
              map_dice_winner: null,
              map_dice_a_d1: null,
              map_dice_a_d2: null,
              map_dice_a_total: null,
              map_dice_b_d1: null,
              map_dice_b_d2: null,
              map_dice_b_total: null,
              updated_at: this.nowSql(),
            });
            sessao = await this.sessionById(sessao.id);
            if (!sessao) return null;
          } else {
            const winner: Team = aTotal > bTotal ? "A" : "B";
            await Database.from("tb_tirar_mix_sessoes").where("id", sessao.id).update({
              map_stage: "veto",
              map_dice_winner: winner,
              map_dice_turn: null,
              map_veto_turn: winner,
              map_veto_deadline: DateTime.now().plus({ seconds: 30 }).toSQL(),
              updated_at: this.nowSql(),
            });
            sessao = await this.sessionById(sessao.id);
            if (!sessao) return null;
          }
        }
      }

      if (sessao && sessao.map_stage === "veto") {
        const remaining = (await Database.from("tb_tirar_mix_mapas")
          .where("sessao_id", sessao.id)
          .where("banido", false)
          .select("mapa")) as Array<{ mapa: string }>;
        if (remaining.length <= 1) {
          const selected = this.normalizeMapName(remaining[0]?.mapa || sessao.mapa_escolhido || "");
          if (selected) {
            await this.closeSessaoComMapa(sessao.id, selected);
            sessao = await this.sessionById(sessao.id);
            if (!sessao) return null;
            return sessao;
          }
        }
        await this.autoBanMapIfExpired(sessao);
        sessao = await this.sessionById(sessao.id);
      }
    }

    return sessao;
  }

  private async buildMapStats(
    mapas: string[],
    teamA: SessaoPlayerRow[],
    teamB: SessaoPlayerRow[]
  ) {
    const mapSet = new Set(mapas.map((m) => this.normalizeMapName(m)));
    const aIds = teamA.map((p) => Number(p.jogador_id)).filter((v) => v > 0);
    const bIds = teamB.map((p) => Number(p.jogador_id)).filter((v) => v > 0);
    const allIds = Array.from(new Set([...aIds, ...bIds]));

    const base = new Map<string, { partidas: number; vitorias: number }>();
    if (mapSet.size && allIds.length) {
      try {
        let rows: any[] = [];
        try {
          rows = (await Database.from("tb_partidas_jogadores as pj")
            .innerJoin("tb_partidas as p", "p.id", "pj.partidas_id")
            .whereIn("pj.jogadores_id", allIds)
            .select("pj.jogadores_id", "p.mapa", "pj.partida_ganha")) as any[];
        } catch {
          rows = (await Database.from("tb_partidas_jogadores as pj")
            .innerJoin("tb_partidas as p", "p.id", "pj.partida_id")
            .whereIn("pj.jogadores_id", allIds)
            .select("pj.jogadores_id", "p.mapa", "pj.partida_ganha")) as any[];
        }

        for (const row of rows) {
          const mapa = this.normalizeMapName(row.mapa);
          if (!mapSet.has(mapa)) continue;
          const jogadorId = Number(row.jogadores_id);
          if (!jogadorId) continue;
          const key = `${mapa}|${jogadorId}`;
          const curr = base.get(key) || { partidas: 0, vitorias: 0 };
          curr.partidas += 1;
          if (row.partida_ganha) curr.vitorias += 1;
          base.set(key, curr);
        }
      } catch {
        // Fallback seguro: mantém estatísticas zeradas sem quebrar snapshot.
      }
    }

    const toTeamPlayerStats = (players: SessaoPlayerRow[], mapa: string, mirrored = false) =>
      players.map((p) => {
        const key = `${mapa}|${Number(p.jogador_id)}`;
        const total = base.get(key) || { partidas: 0, vitorias: 0 };
        const winRate = total.partidas > 0 ? (total.vitorias / total.partidas) * 100 : 0;
        return {
          jogador_id: p.jogador_id,
          nome: p.nome,
          partidas: total.partidas,
          vitorias: total.vitorias,
          winRate: Number(winRate.toFixed(1)),
          mirrored,
        };
      });

    const result: Record<string, { A: any[]; B: any[] }> = {};
    for (const mapa of mapSet) {
      result[mapa] = {
        A: toTeamPlayerStats(teamA, mapa, false),
        B: toTeamPlayerStats(teamB, mapa, true),
      };
    }
    return result;
  }

  private async snapshotFromSessao(sessao: SessaoRow, meJogadorId: number | null) {
    const players = await this.playersSessao(sessao.id);
    const online = await this.onlinePlayers();

    const capA = players.find((p) => p.jogador_id === sessao.time_a_capitao_id) || null;
    const capB = players.find((p) => p.jogador_id === sessao.time_b_capitao_id) || null;

    const teamAPlayers = players
      .filter((p) => p.time === "A" && p.is_selecionado && !p.is_capitao)
      .sort((a, b) => (a.ordem_pick || 0) - (b.ordem_pick || 0));
    const teamBPlayers = players
      .filter((p) => p.time === "B" && p.is_selecionado && !p.is_capitao)
      .sort((a, b) => (a.ordem_pick || 0) - (b.ordem_pick || 0));

    const pool = players
      .filter((p) => !p.is_capitao && !p.is_selecionado)
      .sort((a, b) => {
        const sa = this.normalizePoolSlot(a.pool_slot);
        const sb = this.normalizePoolSlot(b.pool_slot);
        if (sa !== null && sb !== null) return sa - sb;
        if (sa !== null) return -1;
        if (sb !== null) return 1;
        return (a.nome || "").localeCompare(b.nome || "");
      });

    const meSessao = players.find((p) => p.jogador_id === meJogadorId) || null;

    const countdownMs = this.toMillis(sessao.start_countdown_ends_at);
    const pickDeadlineMs = this.toMillis(sessao.pick_deadline);
    const mapCountdownMs = this.toMillis(sessao.map_countdown_ends_at);
    const mapVetoDeadlineMs = this.toMillis(sessao.map_veto_deadline);

    const startReadyCount = (sessao.start_ready_a ? 1 : 0) + (sessao.start_ready_b ? 1 : 0);
    const mapStage = sessao.map_stage || "idle";

    const acceptEndsMs = this.toMillis(sessao.accept_ends_at);
    const acceptActive = acceptEndsMs !== null;
    const acceptPlayers = players.map((p) => ({
      jogador_id: p.jogador_id,
      nome: p.nome,
      imagem: p.imagem,
      is_capitao: !!p.is_capitao,
      time: p.time,
      aceitou: !!p.aceitou,
    }));
    const acceptedCount = acceptPlayers.filter((p) => p.aceitou).length;

    let mapRows = await this.sessaoMapas(sessao.id);
    if ((mapStage !== "idle" || !!sessao.mapa_escolhido) && !mapRows.length) {
      await this.ensureMapPool(sessao.id);
      mapRows = await this.sessaoMapas(sessao.id);
    }

    const teamAAll = [capA, ...teamAPlayers].filter(Boolean) as SessaoPlayerRow[];
    const teamBAll = [capB, ...teamBPlayers].filter(Boolean) as SessaoPlayerRow[];
    const mapNames = mapRows.map((m) => this.normalizeMapName(m.mapa));
    const mapStatsByMap = await this.buildMapStats(mapNames, teamAAll, teamBAll);

    const selectedMapFallback =
      mapStage === "done" ? mapRows.find((m) => !m.banido)?.mapa || null : null;
    const selectedMapRaw = sessao.mapa_escolhido || selectedMapFallback || null;
    const selectedMap = selectedMapRaw ? this.normalizeMapName(selectedMapRaw) : null;

    const message =
      mapStage === "countdown"
        ? `Times definidos. Iniciando veto de mapas em ${
            mapCountdownMs !== null ? Math.max(0, Math.ceil((mapCountdownMs - Date.now()) / 1000)) : 0
          }s.`
        : mapStage === "dice"
        ? `Dados do veto: capitão do Time ${sessao.map_dice_turn || "?"} vai rolar.`
        : mapStage === "veto"
        ? `Vez do capitão do Time ${sessao.map_veto_turn || "?"} vetar mapa.`
        : mapStage === "done" && selectedMap
        ? `O mapa escolhido do mix foi: ${selectedMap}. Bom jogo!`
        : sessao.fase === "finalizado"
        ? "Times definidos, bom jogo a todos!"
        : sessao.fase === "draft"
        ? `Vez do capitão do Time ${sessao.pick_turn || "?"}`
        : sessao.fase === "dice"
        ? `Vez de rolar os dados: capitão do Time ${sessao.dice_turn || "?"}`
        : sessao.fase === "countdown"
        ? "Preparando início dos dados..."
        : sessao.fase === "aguardando_inicio"
        ? "Aguardando os 2 capitães clicarem em iniciar."
        : "Aguardando 2 capitães entrarem.";

    return {
      id: sessao.id,
      status: sessao.status,
      fase: sessao.fase,
      message,
      start: {
        readyA: !!sessao.start_ready_a,
        readyB: !!sessao.start_ready_b,
        readyCount: startReadyCount,
        total: 2,
        countdownSeconds:
          countdownMs !== null ? Math.max(0, Math.ceil((countdownMs - Date.now()) / 1000)) : 0,
      },
      accept: {
        active: acceptActive,
        secondsLeft:
          acceptEndsMs !== null ? Math.max(0, Math.ceil((acceptEndsMs - Date.now()) / 1000)) : 0,
        total: acceptPlayers.length,
        acceptedCount,
        meAceitou: !!meSessao?.aceitou,
        players: acceptPlayers,
      },
      dice: {
        firstTurn: sessao.dice_first_turn,
        turn: sessao.dice_turn,
        winner: sessao.dice_winner,
        a: {
          d1: sessao.dice_a_d1,
          d2: sessao.dice_a_d2,
          total: this.calcDiceTotal(
            sessao.dice_a_d1,
            sessao.dice_a_d2,
            sessao.dice_a_total
          ),
        },
        b: {
          d1: sessao.dice_b_d1,
          d2: sessao.dice_b_d2,
          total: this.calcDiceTotal(
            sessao.dice_b_d1,
            sessao.dice_b_d2,
            sessao.dice_b_total
          ),
        },
      },
      draft: {
        pickTurn: sessao.pick_turn,
        pickSecondsLeft:
          pickDeadlineMs !== null ? Math.max(0, Math.ceil((pickDeadlineMs - Date.now()) / 1000)) : 0,
      },
      mapDraft: {
        stage: mapStage,
        countdownSeconds:
          mapCountdownMs !== null ? Math.max(0, Math.ceil((mapCountdownMs - Date.now()) / 1000)) : 0,
        vetoSecondsLeft:
          mapVetoDeadlineMs !== null
            ? Math.max(0, Math.ceil((mapVetoDeadlineMs - Date.now()) / 1000))
            : 0,
        selectedMap,
        dice: {
          firstTurn: sessao.map_dice_first_turn,
          turn: sessao.map_dice_turn,
          winner: sessao.map_dice_winner,
          a: {
            d1: sessao.map_dice_a_d1,
            d2: sessao.map_dice_a_d2,
            total: this.calcDiceTotal(
              sessao.map_dice_a_d1,
              sessao.map_dice_a_d2,
              sessao.map_dice_a_total
            ),
          },
          b: {
            d1: sessao.map_dice_b_d1,
            d2: sessao.map_dice_b_d2,
            total: this.calcDiceTotal(
              sessao.map_dice_b_d1,
              sessao.map_dice_b_d2,
              sessao.map_dice_b_total
            ),
          },
        },
        veto: {
          turn: sessao.map_veto_turn,
        },
        maps: mapRows.map((m) => {
          const mapName = this.normalizeMapName(m.mapa);
          return {
            id: m.id,
            mapa: mapName,
            image: this.mapImagePath(mapName),
            banido: !!m.banido,
            banidoPorTeam: m.banido_por_time,
            ordemBan: m.ordem_ban,
            selected: selectedMap === mapName,
            stats: mapStatsByMap[mapName] || { A: [], B: [] },
          };
        }),
      },
      teams: {
        A: {
          captain: capA,
          picks: teamAPlayers,
          total: (capA ? 1 : 0) + teamAPlayers.length,
        },
        B: {
          captain: capB,
          picks: teamBPlayers,
          total: (capB ? 1 : 0) + teamBPlayers.length,
        },
      },
      pool,
      online,
      me: {
        jogador_id: meJogadorId,
        role: meSessao?.is_capitao ? "capitao" : meSessao ? "jogador" : "fora",
        team: meSessao?.time || null,
      },
    };
  }

  public async heartbeat({ auth, request, response }: HttpContextContract) {
    try {
      const user = await auth.authenticate();
      const jogador = await this.jogadorDoUsuario(user.id);
      const clientSession = this.normalizeClientSession(request.header("x-client-session"), user.id);

      await this.markOnline(
        user.id,
        jogador?.id ?? null,
        clientSession,
        String(request.header("user-agent") || "").slice(0, 180)
      );

      const online = await this.onlinePlayers();
      return this.customResponse.sucesso(response, "Heartbeat atualizado.", {
        online_count: online.length,
      });
    } catch (error) {
      return this.customResponse.erro(response, "Erro no heartbeat.", error, 500);
    }
  }

  public async online({ response }: HttpContextContract) {
    try {
      const online = await this.onlinePlayers();
      return this.customResponse.sucesso(response, "Jogadores online.", online);
    } catch (error) {
      return this.customResponse.erro(response, "Erro ao listar online.", error, 500);
    }
  }

  public async sessaoAtual({ auth, response }: HttpContextContract) {
    try {
      const user = await auth.authenticate();
      const jogador = await this.jogadorDoUsuario(user.id);
      const sessao = await this.sessionAtiva(user.id);
      const rec = await this.reconcile(sessao.id);
      if (!rec) throw new Error("Sessão inválida.");
      const snap = await this.snapshotFromSessao(rec, jogador?.id ?? null);
      return this.customResponse.sucesso(response, "Sessão atual.", snap);
    } catch (error) {
      return this.customResponse.erro(response, "Erro ao carregar sessão atual.", error, 500);
    }
  }

  public async sessaoNova({ auth, response }: HttpContextContract) {
    try {
      const user = await auth.authenticate();
      const userRow = await Database.from("tb_usuarios_adm")
        .where("id", user.id)
        .select("usuario_admin")
        .first();

      if (!userRow?.usuario_admin) {
        return this.customResponse.erro(
          response,
          "Apenas administradores podem criar uma nova sessão.",
          {},
          403
        );
      }

      await Database.from("tb_tirar_mix_sessoes")
        .whereNotIn("status", ["finalizado", "cancelado"])
        .update({
          status: "cancelado",
          fase: "finalizado",
          finalizado_em: this.nowSql(),
          updated_at: this.nowSql(),
        });

      const inserted = await Database.table("tb_tirar_mix_sessoes")
        .insert({
          status: "criando",
          fase: "aguardando_capitaes",
          criado_por_usuario_adm_id: user.id,
          start_ready_a: false,
          start_ready_b: false,
          created_at: this.nowSql(),
          updated_at: this.nowSql(),
        })
        .returning("id");

      const id = Array.isArray(inserted)
        ? Number((inserted[0] as any)?.id ?? inserted[0])
        : Number(inserted);

      const sessao = await this.sessionById(id);
      if (!sessao) throw new Error("Erro ao criar sessão.");

      const jogador = await this.jogadorDoUsuario(user.id);
      const snap = await this.snapshotFromSessao(sessao, jogador?.id ?? null);
      return this.customResponse.sucesso(response, "Nova sessão criada.", snap);
    } catch (error) {
      return this.customResponse.erro(response, "Erro ao criar sessão.", error, 500);
    }
  }

  public async entrar({ auth, request, response }: HttpContextContract) {
    try {
      const user = await auth.authenticate();
      const jogador = await this.jogadorDoUsuarioOrFail(user.id);
      const role = String(request.input("role", "jogador")).toLowerCase();
      const requestedPoolSlot = this.normalizePoolSlot(request.input("pool_slot"));
      const requestedTeamRaw = String(request.input("team", "") || "")
        .trim()
        .toUpperCase();
      const requestedCaptainTeam: Team | null =
        requestedTeamRaw === "A" || requestedTeamRaw === "B"
          ? (requestedTeamRaw as Team)
          : null;

      if (role !== "capitao" && role !== "jogador") {
        return this.customResponse.erro(response, "Tipo de entrada inválido.", {}, 400);
      }

      const clientSession = this.normalizeClientSession(request.header("x-client-session"), user.id);
      await this.markOnline(
        user.id,
        jogador.id,
        clientSession,
        String(request.header("user-agent") || "").slice(0, 180)
      );

      const sessao = await this.sessionAtiva(user.id);
      const rec = await this.reconcile(sessao.id);
      if (!rec) throw new Error("Sessão inválida.");

      if (rec.fase === "draft" || rec.fase === "finalizado") {
        return this.customResponse.erro(
          response,
          "Sessão em andamento/finalizada. Aguarde nova sessão.",
          {},
          409
        );
      }

      const existing = await Database.from("tb_tirar_mix_players")
        .where("sessao_id", rec.id)
        .where("jogador_id", jogador.id)
        .first();

      if (role === "capitao") {
        let team: Team | null = null;

        if (rec.time_a_capitao_id === jogador.id) team = "A";
        else if (rec.time_b_capitao_id === jogador.id) team = "B";
        else if (requestedCaptainTeam) {
          if (
            (requestedCaptainTeam === "A" && rec.time_a_capitao_id) ||
            (requestedCaptainTeam === "B" && rec.time_b_capitao_id)
          ) {
            return this.customResponse.erro(
              response,
              `O slot de capitão do Time ${requestedCaptainTeam} já está ocupado.`,
              {},
              409
            );
          }
          team = requestedCaptainTeam;
        } else if (!rec.time_a_capitao_id) team = "A";
        else if (!rec.time_b_capitao_id) team = "B";

        if (!team) {
          return this.customResponse.erro(response, "Já existem 2 capitães na sessão.", {}, 409);
        }

        if (existing) {
          await Database.from("tb_tirar_mix_players").where("id", existing.id).update({
            is_capitao: true,
            is_selecionado: true,
            time: team,
            pool_slot: null,
            updated_at: this.nowSql(),
          });
        } else {
          await Database.table("tb_tirar_mix_players").insert({
            sessao_id: rec.id,
            jogador_id: jogador.id,
            is_capitao: true,
            is_selecionado: true,
            time: team,
            pool_slot: null,
            created_at: this.nowSql(),
            updated_at: this.nowSql(),
          });
        }

        const nextA = team === "A" ? jogador.id : rec.time_a_capitao_id;
        const nextB = team === "B" ? jogador.id : rec.time_b_capitao_id;

        await Database.from("tb_tirar_mix_sessoes").where("id", rec.id).update({
          time_a_capitao_id: nextA,
          time_b_capitao_id: nextB,
          status: nextA && nextB ? "capitaes_definidos" : "criando",
          fase: nextA && nextB ? "aguardando_inicio" : "aguardando_capitaes",
          updated_at: this.nowSql(),
        });
      } else {
        if (requestedPoolSlot === null) {
          return this.customResponse.erro(
            response,
            `Selecione um slot de 1 a ${this.MAX_POOL_SLOTS} para entrar como jogador.`,
            {},
            400
          );
        }

        const slotOwner = await Database.from("tb_tirar_mix_players")
          .where("sessao_id", rec.id)
          .where("is_capitao", false)
          .where("is_selecionado", false)
          .where("pool_slot", requestedPoolSlot)
          .whereNot("jogador_id", jogador.id)
          .first();

        if (slotOwner) {
          return this.customResponse.erro(response, "Este slot já está ocupado.", {}, 409);
        }

        if (rec.time_a_capitao_id === jogador.id || rec.time_b_capitao_id === jogador.id) {
          const nextA = rec.time_a_capitao_id === jogador.id ? null : rec.time_a_capitao_id;
          const nextB = rec.time_b_capitao_id === jogador.id ? null : rec.time_b_capitao_id;
          const hasBothCaptains = !!(nextA && nextB);

          await Database.from("tb_tirar_mix_sessoes")
            .where("id", rec.id)
            .update({
              time_a_capitao_id: nextA,
              time_b_capitao_id: nextB,
              status: hasBothCaptains ? "capitaes_definidos" : "criando",
              fase: hasBothCaptains ? "aguardando_inicio" : "aguardando_capitaes",
              start_ready_a: false,
              start_ready_b: false,
              start_countdown_started_at: null,
              start_countdown_ends_at: null,
              updated_at: this.nowSql(),
            });
        }

        if (existing) {
          await Database.from("tb_tirar_mix_players").where("id", existing.id).update({
            is_capitao: false,
            is_selecionado: false,
            time: null,
            ordem_pick: null,
            pool_slot: requestedPoolSlot,
            updated_at: this.nowSql(),
          });
        } else {
          await Database.table("tb_tirar_mix_players").insert({
            sessao_id: rec.id,
            jogador_id: jogador.id,
            is_capitao: false,
            is_selecionado: false,
            pool_slot: requestedPoolSlot,
            created_at: this.nowSql(),
            updated_at: this.nowSql(),
          });
        }
      }

      const next = await this.reconcile(rec.id);
      if (!next) throw new Error("Sessão inválida após entrada.");
      const snap = await this.snapshotFromSessao(next, jogador.id);
      return this.customResponse.sucesso(response, "Entrada confirmada.", snap);
    } catch (error) {
      return this.customResponse.erro(response, "Erro ao entrar na sessão.", error, 500);
    }
  }

  public async mockCapitaoOponente({ auth, request, response }: HttpContextContract) {
    try {
      const user = await auth.authenticate();
      const jogador = await this.jogadorDoUsuarioOrFail(user.id);
      const sessaoId = Number(request.input("sessao_id"));

      let sessao = sessaoId ? await this.sessionById(sessaoId) : await this.sessionAtiva(user.id);
      if (!sessao) throw new Error("SessÃ£o nÃ£o encontrada.");
      sessao = await this.reconcile(sessao.id);
      if (!sessao) throw new Error("SessÃ£o invÃ¡lida.");

      if (sessao.fase === "draft" || sessao.fase === "finalizado") {
        return this.customResponse.erro(
          response,
          "NÃ£o Ã© possÃ­vel mockar capitÃ£o com draft em andamento/finalizado.",
          {},
          409
        );
      }

      let myTeam = this.teamByCaptain(sessao, jogador.id);

      /**
       * Se o usuÃ¡rio ainda nÃ£o entrou como capitÃ£o, promovemos ele no primeiro slot livre.
       * Isso simplifica o teste em ambiente local.
       */
      if (!myTeam) {
        let team: Team | null = null;
        if (!sessao.time_a_capitao_id) team = "A";
        else if (!sessao.time_b_capitao_id) team = "B";

        if (!team) {
          return this.customResponse.erro(response, "JÃ¡ existem 2 capitÃ£es na sessÃ£o.", {}, 409);
        }

        const meRow = await Database.from("tb_tirar_mix_players")
          .where("sessao_id", sessao.id)
          .where("jogador_id", jogador.id)
          .first();

        if (meRow) {
          await Database.from("tb_tirar_mix_players").where("id", meRow.id).update({
            is_capitao: true,
            is_selecionado: true,
            time: team,
            ordem_pick: null,
            pool_slot: null,
            updated_at: this.nowSql(),
          });
        } else {
          await Database.table("tb_tirar_mix_players").insert({
            sessao_id: sessao.id,
            jogador_id: jogador.id,
            is_capitao: true,
            is_selecionado: true,
            time: team,
            pool_slot: null,
            created_at: this.nowSql(),
            updated_at: this.nowSql(),
          });
        }

        const patch: any = {
          status: "criando",
          fase: "aguardando_capitaes",
          start_ready_a: false,
          start_ready_b: false,
          start_countdown_started_at: null,
          start_countdown_ends_at: null,
          updated_at: this.nowSql(),
        };
        if (team === "A") patch.time_a_capitao_id = jogador.id;
        else patch.time_b_capitao_id = jogador.id;

        await Database.from("tb_tirar_mix_sessoes").where("id", sessao.id).update(patch);

        const nextSessao = await this.reconcile(sessao.id);
        if (!nextSessao) throw new Error("SessÃ£o invÃ¡lida apÃ³s promoÃ§Ã£o de capitÃ£o.");
        sessao = nextSessao;
        myTeam = team;
      }

      const opponentTeam: Team = myTeam === "A" ? "B" : "A";
      const hasOpponentCaptain =
        opponentTeam === "A" ? !!sessao.time_a_capitao_id : !!sessao.time_b_capitao_id;

      if (hasOpponentCaptain) {
        const snap = await this.snapshotFromSessao(sessao, jogador.id);
        return this.customResponse.sucesso(response, "CapitÃ£o oponente jÃ¡ definido.", snap);
      }

      const sessaoPlayers = await Database.from("tb_tirar_mix_players")
        .where("sessao_id", sessao.id)
        .select("jogador_id");

      const blockedIds = new Set<number>([jogador.id]);
      for (const p of sessaoPlayers) blockedIds.add(Number(p.jogador_id));
      if (sessao.time_a_capitao_id) blockedIds.add(Number(sessao.time_a_capitao_id));
      if (sessao.time_b_capitao_id) blockedIds.add(Number(sessao.time_b_capitao_id));

      let candidateId: number | null = null;

      const online = await this.onlinePlayers();
      for (const row of online) {
        const id = Number(row.id);
        if (!blockedIds.has(id)) {
          candidateId = id;
          break;
        }
      }

      if (!candidateId) {
        const candidates = await Database.from("tb_jogadores")
          .whereNot("id", jogador.id)
          .select("id")
          .orderByRaw("RANDOM()");

        const found = candidates.find((c: any) => !blockedIds.has(Number(c.id)));
        candidateId = found ? Number(found.id) : null;
      }

      if (!candidateId) {
        return this.customResponse.erro(
          response,
          "NÃ£o foi possÃ­vel criar mock: nÃ£o hÃ¡ outro jogador disponÃ­vel.",
          {},
          409
        );
      }

      const candidateRow = await Database.from("tb_tirar_mix_players")
        .where("sessao_id", sessao.id)
        .where("jogador_id", candidateId)
        .first();

      if (candidateRow) {
        await Database.from("tb_tirar_mix_players").where("id", candidateRow.id).update({
          is_capitao: true,
          is_selecionado: true,
          time: opponentTeam,
          ordem_pick: null,
          pool_slot: null,
          updated_at: this.nowSql(),
        });
      } else {
        await Database.table("tb_tirar_mix_players").insert({
          sessao_id: sessao.id,
          jogador_id: candidateId,
          is_capitao: true,
          is_selecionado: true,
          time: opponentTeam,
          pool_slot: null,
          created_at: this.nowSql(),
          updated_at: this.nowSql(),
        });
      }

      const patchSession: any = {
        status: "capitaes_definidos",
        fase: "aguardando_inicio",
        start_ready_a: false,
        start_ready_b: false,
        start_countdown_started_at: null,
        start_countdown_ends_at: null,
        updated_at: this.nowSql(),
      };

      if (opponentTeam === "A") patchSession.time_a_capitao_id = candidateId;
      else patchSession.time_b_capitao_id = candidateId;

      await Database.from("tb_tirar_mix_sessoes").where("id", sessao.id).update(patchSession);

      const next = await this.reconcile(sessao.id);
      if (!next) throw new Error("SessÃ£o invÃ¡lida apÃ³s mock.");
      const snap = await this.snapshotFromSessao(next, jogador.id);
      return this.customResponse.sucesso(response, "CapitÃ£o mock definido com sucesso.", snap);
    } catch (error) {
      return this.customResponse.erro(response, "Erro ao mockar capitÃ£o oponente.", error, 500);
    }
  }

  public async mockIniciarOponente({ auth, request, response }: HttpContextContract) {
    try {
      const user = await auth.authenticate();
      const jogador = await this.jogadorDoUsuarioOrFail(user.id);
      const sessaoId = Number(request.input("sessao_id"));

      let sessao = sessaoId ? await this.sessionById(sessaoId) : await this.sessionAtiva(user.id);
      if (!sessao) throw new Error("SessÃ£o nÃ£o encontrada.");
      sessao = await this.reconcile(sessao.id);
      if (!sessao) throw new Error("SessÃ£o invÃ¡lida.");

      if (sessao.fase === "draft" || sessao.fase === "finalizado") {
        return this.customResponse.erro(
          response,
          "NÃ£o Ã© possÃ­vel iniciar mock com draft em andamento/finalizado.",
          {},
          409
        );
      }

      if (sessao.fase !== "aguardando_inicio" && sessao.fase !== "countdown") {
        return this.customResponse.erro(
          response,
          "A sessÃ£o nÃ£o estÃ¡ pronta para iniciar.",
          {},
          409
        );
      }

      const myTeam = this.teamByCaptain(sessao, jogador.id);
      if (!myTeam) {
        return this.customResponse.erro(
          response,
          "Entre como capitÃ£o antes de usar o mock de iniciar.",
          {},
          403
        );
      }

      const opponentTeam: Team = myTeam === "A" ? "B" : "A";
      const opponentCaptainId =
        opponentTeam === "A" ? sessao.time_a_capitao_id : sessao.time_b_capitao_id;

      if (!opponentCaptainId) {
        return this.customResponse.erro(
          response,
          "Ainda nÃ£o existe capitÃ£o no time oposto.",
          {},
          409
        );
      }

      const patch: any = { updated_at: this.nowSql() };
      if (opponentTeam === "A") patch.start_ready_a = true;
      else patch.start_ready_b = true;

      const readyA = opponentTeam === "A" ? true : !!sessao.start_ready_a;
      const readyB = opponentTeam === "B" ? true : !!sessao.start_ready_b;

      if (readyA && readyB && sessao.fase !== "countdown") {
        patch.fase = "countdown";
        patch.start_countdown_started_at = this.nowSql();
        patch.start_countdown_ends_at = DateTime.now().plus({ seconds: 3 }).toSQL();
      }

      await Database.from("tb_tirar_mix_sessoes").where("id", sessao.id).update(patch);

      const next = await this.reconcile(sessao.id);
      if (!next) throw new Error("SessÃ£o invÃ¡lida apÃ³s start mock.");
      const snap = await this.snapshotFromSessao(next, jogador.id);
      return this.customResponse.sucesso(
        response,
        "Start mock do capitÃ£o oponente aplicado.",
        snap
      );
    } catch (error) {
      return this.customResponse.erro(response, "Erro ao iniciar mock do oponente.", error, 500);
    }
  }

  public async mockRolarDadosOponente({ auth, request, response }: HttpContextContract) {
    try {
      const user = await auth.authenticate();
      const jogador = await this.jogadorDoUsuarioOrFail(user.id);
      const sessaoId = Number(request.input("sessao_id"));

      let sessao = sessaoId ? await this.sessionById(sessaoId) : await this.sessionAtiva(user.id);
      if (!sessao) throw new Error("SessÃ£o nÃ£o encontrada.");
      sessao = await this.reconcile(sessao.id);
      if (!sessao) throw new Error("SessÃ£o invÃ¡lida.");

      const isTeamDice = sessao.fase === "dice";
      const isMapDice = sessao.map_stage === "dice";
      if (!isTeamDice && !isMapDice) {
        return this.customResponse.erro(response, "A fase de dados nÃ£o estÃ¡ ativa.", {}, 409);
      }

      const myTeam = this.teamByCaptain(sessao, jogador.id);
      if (!myTeam) {
        return this.customResponse.erro(
          response,
          "Entre como capitÃ£o antes de usar o mock de dados.",
          {},
          403
        );
      }

      const opponentTeam: Team = myTeam === "A" ? "B" : "A";
      const opponentCaptainId =
        opponentTeam === "A" ? sessao.time_a_capitao_id : sessao.time_b_capitao_id;

      if (!opponentCaptainId) {
        return this.customResponse.erro(
          response,
          "Ainda nÃ£o existe capitÃ£o no time oposto.",
          {},
          409
        );
      }

      const currentTurn = isTeamDice ? sessao.dice_turn : sessao.map_dice_turn;
      if (currentTurn !== opponentTeam) {
        return this.customResponse.erro(
          response,
          "Ainda nÃ£o Ã© a vez do capitÃ£o rival rolar os dados.",
          {},
          409
        );
      }

      const alreadyRolled = isTeamDice
        ? opponentTeam === "A"
          ? sessao.dice_a_total !== null
          : sessao.dice_b_total !== null
        : opponentTeam === "A"
        ? sessao.map_dice_a_total !== null
        : sessao.map_dice_b_total !== null;
      if (alreadyRolled) {
        const snap = await this.snapshotFromSessao(sessao, jogador.id);
        return this.customResponse.sucesso(
          response,
          "O capitÃ£o rival jÃ¡ lanÃ§ou os dados.",
          snap
        );
      }

      const d1 = Math.floor(Math.random() * 6) + 1;
      const d2 = Math.floor(Math.random() * 6) + 1;
      const total = d1 + d2;

      const patch: any = { updated_at: this.nowSql() };
      if (isTeamDice) {
        if (opponentTeam === "A") {
          patch.dice_a_d1 = d1;
          patch.dice_a_d2 = d2;
          patch.dice_a_total = total;
        } else {
          patch.dice_b_d1 = d1;
          patch.dice_b_d2 = d2;
          patch.dice_b_total = total;
        }
      } else {
        if (opponentTeam === "A") {
          patch.map_dice_a_d1 = d1;
          patch.map_dice_a_d2 = d2;
          patch.map_dice_a_total = total;
        } else {
          patch.map_dice_b_d1 = d1;
          patch.map_dice_b_d2 = d2;
          patch.map_dice_b_total = total;
        }
      }

      const otherRolled = isTeamDice
        ? myTeam === "A"
          ? sessao.dice_a_total !== null
          : sessao.dice_b_total !== null
        : myTeam === "A"
        ? sessao.map_dice_a_total !== null
        : sessao.map_dice_b_total !== null;
      if (isTeamDice) patch.dice_turn = otherRolled ? null : myTeam;
      else patch.map_dice_turn = otherRolled ? null : myTeam;

      await Database.from("tb_tirar_mix_sessoes").where("id", sessao.id).update(patch);

      const next = await this.reconcile(sessao.id);
      if (!next) throw new Error("SessÃ£o invÃ¡lida apÃ³s rolagem mock.");
      const snap = await this.snapshotFromSessao(next, jogador.id);
      return this.customResponse.sucesso(
        response,
        "Dados mock do capitÃ£o rival aplicados.",
        snap
      );
    } catch (error) {
      return this.customResponse.erro(response, "Erro ao mockar rolagem do oponente.", error, 500);
    }
  }

  public async mockOitoJogadores({ auth, request, response }: HttpContextContract) {
    try {
      const user = await auth.authenticate();
      const jogador = await this.jogadorDoUsuarioOrFail(user.id);
      const sessaoId = Number(request.input("sessao_id"));

      let sessao = sessaoId ? await this.sessionById(sessaoId) : await this.sessionAtiva(user.id);
      if (!sessao) throw new Error("SessÃ£o nÃ£o encontrada.");
      sessao = await this.reconcile(sessao.id);
      if (!sessao) throw new Error("SessÃ£o invÃ¡lida.");

      if (sessao.fase === "finalizado") {
        return this.customResponse.erro(
          response,
          "NÃ£o Ã© possÃ­vel mockar jogadores em sessÃ£o finalizada.",
          {},
          409
        );
      }

      const targetPool = 8;
      const poolRow = await Database.from("tb_tirar_mix_players")
        .where("sessao_id", sessao.id)
        .where("is_capitao", false)
        .where("is_selecionado", false)
        .count("* as c")
        .first();
      const currentPool = Number(poolRow?.c || 0);

      const needAdd = Math.max(0, targetPool - currentPool);
      if (needAdd === 0) {
        const snap = await this.snapshotFromSessao(sessao, jogador.id);
        return this.customResponse.sucesso(response, "Pool jÃ¡ possui 8 jogadores.", snap);
      }

      const sessaoPlayers = await Database.from("tb_tirar_mix_players")
        .where("sessao_id", sessao.id)
        .select("jogador_id");

      const blockedIds = new Set<number>();
      for (const p of sessaoPlayers) blockedIds.add(Number(p.jogador_id));
      blockedIds.add(jogador.id);
      if (sessao.time_a_capitao_id) blockedIds.add(Number(sessao.time_a_capitao_id));
      if (sessao.time_b_capitao_id) blockedIds.add(Number(sessao.time_b_capitao_id));

      const blockedArray = Array.from(blockedIds);
      const candidatos = blockedArray.length
        ? await Database.from("tb_jogadores")
            .whereNotIn("id", blockedArray)
            .select("id")
            .orderByRaw("RANDOM()")
        : await Database.from("tb_jogadores").select("id").orderByRaw("RANDOM()");

      const existingIds = candidatos.slice(0, needAdd).map((r: any) => Number(r.id));
      const remaining = needAdd - existingIds.length;

      const createdIds: number[] = [];
      if (remaining > 0) {
        const stamp = DateTime.now().toFormat("yyyyLLddHHmmss");
        const bots = Array.from({ length: remaining }, (_, idx) => {
          const nick = `BOT_PICK_${stamp}_${idx + 1}`;
          return {
            nome: nick,
            nome_normalizado: nick.toUpperCase(),
            imagem: "",
            gold: 0,
            adr: "0",
            kills: "0",
            assistencias: "0",
            mortes: "0",
            kda_player: "0.00",
            kast: 0,
            flash_assist: "0",
            first_kill: "0",
            multi_kill: "0",
            vitorias: "0",
            qtd_partidas: "0",
            pontos: "0",
            created_at: this.nowSql(),
            updated_at: this.nowSql(),
          };
        });

        const inserted = await Database.table("tb_jogadores").insert(bots).returning("id");
        const ids = Array.isArray(inserted) ? inserted : [inserted];
        for (const row of ids as any[]) {
          createdIds.push(Number((row as any)?.id ?? row));
        }
      }

      const addIds = [...existingIds, ...createdIds];
      if (addIds.length) {
        const existingSessionRows = await Database.from("tb_tirar_mix_players")
          .where("sessao_id", sessao.id)
          .whereIn("jogador_id", addIds)
          .select("jogador_id");

        const existingInSession = new Set<number>(
          existingSessionRows.map((row: any) => Number(row.jogador_id))
        );

        const toInsertIds = addIds.filter((id) => !existingInSession.has(Number(id)));

        if (toInsertIds.length) {
          const occupiedRows = await Database.from("tb_tirar_mix_players")
            .where("sessao_id", sessao.id)
            .where("is_capitao", false)
            .where("is_selecionado", false)
            .whereNotNull("pool_slot")
            .select("pool_slot");

          const usedSlots = new Set<number>();
          for (const row of occupiedRows) {
            const slot = this.normalizePoolSlot((row as any)?.pool_slot);
            if (slot !== null) usedSlots.add(slot);
          }

          const rows = toInsertIds.map((id) => {
            const slot = (() => {
              for (let i = 1; i <= this.MAX_POOL_SLOTS; i += 1) {
                if (!usedSlots.has(i)) {
                  usedSlots.add(i);
                  return i;
                }
              }
              return null;
            })();

            return {
              sessao_id: sessao.id,
              jogador_id: id,
              is_capitao: false,
              is_selecionado: false,
              pool_slot: slot,
              created_at: this.nowSql(),
              updated_at: this.nowSql(),
            };
          });

          await Database.table("tb_tirar_mix_players").insert(rows);
        }
      }

      const next = await this.reconcile(sessao.id);
      if (!next) throw new Error("SessÃ£o invÃ¡lida apÃ³s mock de jogadores.");
      const snap = await this.snapshotFromSessao(next, jogador.id);
      return this.customResponse.sucesso(
        response,
        `Mock aplicado: pool ajustado para 8 jogadores (${addIds.length} adicionados).`,
        snap
      );
    } catch (error) {
      return this.customResponse.erro(response, "Erro ao mockar 8 jogadores.", error, 500);
    }
  }

  public async mockPickAleatorio({ auth, request, response }: HttpContextContract) {
    try {
      const user = await auth.authenticate();
      const jogador = await this.jogadorDoUsuarioOrFail(user.id);
      const sessaoId = Number(request.input("sessao_id"));

      let sessao = sessaoId ? await this.sessionById(sessaoId) : await this.sessionAtiva(user.id);
      if (!sessao) throw new Error("Sessão não encontrada.");
      sessao = await this.reconcile(sessao.id);
      if (!sessao) throw new Error("Sessão inválida.");

      const myTeam = this.teamByCaptain(sessao, jogador.id);
      if (!myTeam) {
        return this.customResponse.erro(
          response,
          "Entre como capitão antes de usar o mock de pick.",
          {},
          403
        );
      }

      if (sessao.fase !== "draft") {
        return this.customResponse.erro(
          response,
          "O draft ainda não está ativo para mock de pick.",
          {},
          409
        );
      }

      const turn = sessao.pick_turn;
      if (!turn) {
        return this.customResponse.erro(response, "Não há turno de pick ativo.", {}, 409);
      }

      const captainId = turn === "A" ? sessao.time_a_capitao_id : sessao.time_b_capitao_id;
      if (!captainId) {
        return this.customResponse.erro(response, "Capitão do time da vez não encontrado.", {}, 409);
      }

      const pool = await this.remainingPool(sessao.id);
      if (!pool.length) {
        const next = await this.reconcile(sessao.id);
        if (!next) throw new Error("Sessão inválida após reconcile.");
        const snap = await this.snapshotFromSessao(next, jogador.id);
        return this.customResponse.sucesso(
          response,
          "Sem jogadores no centro para mock de pick.",
          snap
        );
      }

      const randomIdx = Math.floor(Math.random() * pool.length);
      const selected = pool[randomIdx];
      const selectedId = Number(selected.jogador_id);

      await this.applyPick(sessao.id, turn, Number(captainId), selectedId);

      const next = await this.reconcile(sessao.id);
      if (!next) throw new Error("Sessão inválida após mock de pick.");
      const snap = await this.snapshotFromSessao(next, jogador.id);
      return this.customResponse.sucesso(
        response,
        "Mock de pick aleatório aplicado.",
        snap
      );
    } catch (error) {
      return this.customResponse.erro(response, "Erro ao aplicar mock de pick aleatório.", error, 500);
    }
  }

  public async sair({ auth, response }: HttpContextContract) {
    try {
      const user = await auth.authenticate();
      const jogador = await this.jogadorDoUsuarioOrFail(user.id);
      const sessao = await this.sessionAtiva(user.id);
      const rec = await this.reconcile(sessao.id);
      if (!rec) throw new Error("Sessão inválida.");

      if (rec.fase === "draft") {
        return this.customResponse.erro(
          response,
          "Não é possível sair com draft em andamento.",
          {},
          409
        );
      }

      const row = await Database.from("tb_tirar_mix_players")
        .where("sessao_id", rec.id)
        .where("jogador_id", jogador.id)
        .first();

      if (!row) {
        const snap = await this.snapshotFromSessao(rec, jogador.id);
        return this.customResponse.sucesso(response, "Usuário já estava fora.", snap);
      }

      await Database.from("tb_tirar_mix_players").where("id", row.id).delete();

      const patch: any = { updated_at: this.nowSql() };
      if (rec.time_a_capitao_id === jogador.id) {
        patch.time_a_capitao_id = null;
        patch.start_ready_a = false;
      }
      if (rec.time_b_capitao_id === jogador.id) {
        patch.time_b_capitao_id = null;
        patch.start_ready_b = false;
      }
      await Database.from("tb_tirar_mix_sessoes").where("id", rec.id).update(patch);

      const next = await this.reconcile(rec.id);
      if (!next) throw new Error("Sessão inválida após saída.");
      const snap = await this.snapshotFromSessao(next, jogador.id);
      return this.customResponse.sucesso(response, "Saída realizada.", snap);
    } catch (error) {
      return this.customResponse.erro(response, "Erro ao sair da sessão.", error, 500);
    }
  }

  public async iniciarDraftPost({ auth, request, response }: HttpContextContract) {
    try {
      const user = await auth.authenticate();
      const jogador = await this.jogadorDoUsuarioOrFail(user.id);
      const sessaoId = Number(request.input("sessao_id"));

      let sessao = sessaoId ? await this.sessionById(sessaoId) : await this.sessionAtiva(user.id);
      if (!sessao) throw new Error("Sessão não encontrada.");
      sessao = await this.reconcile(sessao.id);
      if (!sessao) throw new Error("Sessão inválida.");

      const myTeam = this.teamByCaptain(sessao, jogador.id);
      if (!myTeam) {
        return this.customResponse.erro(response, "Apenas capitães podem iniciar.", {}, 403);
      }

      if (sessao.fase !== "aguardando_inicio" && sessao.fase !== "countdown") {
        return this.customResponse.erro(
          response,
          "Sessão não está pronta para iniciar.",
          {},
          409
        );
      }

      const patch: any = { updated_at: this.nowSql() };
      if (myTeam === "A") patch.start_ready_a = true;
      if (myTeam === "B") patch.start_ready_b = true;

      const readyA = myTeam === "A" ? true : !!sessao.start_ready_a;
      const readyB = myTeam === "B" ? true : !!sessao.start_ready_b;

      // Quando os 2 capitães iniciarem, vai direto para o countdown dos dados.
      const iniciarCountdown = readyA && readyB && sessao.fase !== "countdown";
      if (iniciarCountdown) {
        patch.fase = "countdown";
        patch.start_countdown_started_at = this.nowSql();
        patch.start_countdown_ends_at = DateTime.now().plus({ seconds: 3 }).toSQL();
      }

      await Database.from("tb_tirar_mix_sessoes").where("id", sessao.id).update(patch);

      const next = await this.reconcile(sessao.id);
      if (!next) throw new Error("Erro ao iniciar.");
      const snap = await this.snapshotFromSessao(next, jogador.id);
      return this.customResponse.sucesso(response, "Status de início atualizado.", snap);
    } catch (error) {
      return this.customResponse.erro(response, "Erro ao iniciar draft.", error, 500);
    }
  }

  public async aceitarPartida({ auth, request, response }: HttpContextContract) {
    try {
      const user = await auth.authenticate();
      const jogador = await this.jogadorDoUsuarioOrFail(user.id);
      const sessaoId = Number(request.input("sessao_id"));

      let sessao = sessaoId ? await this.sessionById(sessaoId) : await this.sessionAtiva(user.id);
      if (!sessao) throw new Error("Sessão não encontrada.");
      sessao = await this.reconcile(sessao.id);
      if (!sessao) throw new Error("Sessão inválida.");

      if (!sessao.accept_ends_at) {
        return this.customResponse.erro(
          response,
          "Não há aceite de partida ativo.",
          {},
          409
        );
      }

      const updated = await Database.from("tb_tirar_mix_players")
        .where("sessao_id", sessao.id)
        .where("jogador_id", jogador.id)
        .update({ aceitou: true, aceitou_em: this.nowSql(), updated_at: this.nowSql() });

      if (!updated) {
        return this.customResponse.erro(
          response,
          "Você não faz parte desta sessão.",
          {},
          403
        );
      }

      const next = await this.reconcile(sessao.id);
      if (!next) throw new Error("Erro ao registrar aceite.");
      const snap = await this.snapshotFromSessao(next, jogador.id);
      return this.customResponse.sucesso(response, "Partida aceita.", snap);
    } catch (error) {
      return this.customResponse.erro(response, "Erro ao aceitar partida.", error, 500);
    }
  }

  public async rolarDados({ auth, request, response }: HttpContextContract) {
    try {
      const user = await auth.authenticate();
      const jogador = await this.jogadorDoUsuarioOrFail(user.id);
      const sessaoId = Number(request.input("sessao_id"));

      let sessao = sessaoId ? await this.sessionById(sessaoId) : await this.sessionAtiva(user.id);
      if (!sessao) throw new Error("Sessão não encontrada.");
      sessao = await this.reconcile(sessao.id);
      if (!sessao) throw new Error("Sessão inválida.");

      const myTeam = this.teamByCaptain(sessao, jogador.id);
      if (!myTeam) {
        return this.customResponse.erro(
          response,
          "Apenas capitães podem rolar dados.",
          {},
          403
        );
      }

      const isTeamDice = sessao.fase === "dice";
      const isMapDice = sessao.map_stage === "dice";
      if (!isTeamDice && !isMapDice) {
        return this.customResponse.erro(response, "A fase de dados não está ativa.", {}, 409);
      }

      const currentTurn = isTeamDice ? sessao.dice_turn : sessao.map_dice_turn;
      if (currentTurn !== myTeam) {
        return this.customResponse.erro(response, "Aguarde sua vez de rolar os dados.", {}, 409);
      }

      const alreadyRolled = isTeamDice
        ? myTeam === "A"
          ? sessao.dice_a_total !== null
          : sessao.dice_b_total !== null
        : myTeam === "A"
        ? sessao.map_dice_a_total !== null
        : sessao.map_dice_b_total !== null;
      if (alreadyRolled) {
        const snap = await this.snapshotFromSessao(sessao, jogador.id);
        return this.customResponse.sucesso(response, "Dado já lançado para este capitão.", snap);
      }

      const d1 = Math.floor(Math.random() * 6) + 1;
      const d2 = Math.floor(Math.random() * 6) + 1;
      const total = d1 + d2;

      const patch: any = { updated_at: this.nowSql() };
      if (isTeamDice) {
        if (myTeam === "A") {
          patch.dice_a_d1 = d1;
          patch.dice_a_d2 = d2;
          patch.dice_a_total = total;
        } else {
          patch.dice_b_d1 = d1;
          patch.dice_b_d2 = d2;
          patch.dice_b_total = total;
        }
      } else {
        if (myTeam === "A") {
          patch.map_dice_a_d1 = d1;
          patch.map_dice_a_d2 = d2;
          patch.map_dice_a_total = total;
        } else {
          patch.map_dice_b_d1 = d1;
          patch.map_dice_b_d2 = d2;
          patch.map_dice_b_total = total;
        }
      }

      const otherTeam: Team = myTeam === "A" ? "B" : "A";
      const otherRolled = isTeamDice
        ? otherTeam === "A"
          ? sessao.dice_a_total !== null
          : sessao.dice_b_total !== null
        : otherTeam === "A"
        ? sessao.map_dice_a_total !== null
        : sessao.map_dice_b_total !== null;
      if (isTeamDice) patch.dice_turn = otherRolled ? null : otherTeam;
      else patch.map_dice_turn = otherRolled ? null : otherTeam;

      await Database.from("tb_tirar_mix_sessoes").where("id", sessao.id).update(patch);

      const next = await this.reconcile(sessao.id);
      if (!next) throw new Error("Erro ao avançar a sessão.");
      const snap = await this.snapshotFromSessao(next, jogador.id);
      return this.customResponse.sucesso(response, "Dados lançados.", snap);
    } catch (error) {
      return this.customResponse.erro(response, "Erro ao rolar dados.", error, 500);
    }
  }

  public async pick({ auth, params, request, response }: HttpContextContract) {
    try {
      const user = await auth.authenticate();
      const jogador = await this.jogadorDoUsuarioOrFail(user.id);

      const rawPlayerId = params.id ?? request.input("player_id");
      const playerId = Number(rawPlayerId);
      if (!playerId) {
        return this.customResponse.erro(response, "Jogador inválido para pick.", {}, 400);
      }

      const sessaoId = Number(request.input("sessao_id"));
      let sessao = sessaoId ? await this.sessionById(sessaoId) : await this.sessionAtiva(user.id);
      if (!sessao) throw new Error("Sessão não encontrada.");
      sessao = await this.reconcile(sessao.id);
      if (!sessao) throw new Error("Sessão inválida.");

      const team = this.teamByCaptain(sessao, jogador.id);
      if (!team) {
        return this.customResponse.erro(
          response,
          "Apenas capitães podem escolher jogadores.",
          {},
          403
        );
      }

      if (sessao.fase !== "draft") {
        return this.customResponse.erro(response, "Draft ainda não está ativo.", {}, 409);
      }
      if (sessao.pick_turn !== team) {
        return this.customResponse.erro(response, "Não é a vez do seu time escolher.", {}, 409);
      }

      const captainId = team === "A" ? sessao.time_a_capitao_id : sessao.time_b_capitao_id;
      if (!captainId) throw new Error("Capitão do time não encontrado.");

      await this.applyPick(sessao.id, team, captainId, playerId);

      const next = await this.reconcile(sessao.id);
      if (!next) throw new Error("Erro ao avançar sessão após pick.");
      const snap = await this.snapshotFromSessao(next, jogador.id);
      return this.customResponse.sucesso(response, "Pick registrado com sucesso.", snap);
    } catch (error) {
      return this.customResponse.erro(response, "Erro ao registrar pick.", error, 500);
    }
  }

  public async banirMapa({ auth, params, request, response }: HttpContextContract) {
    try {
      const user = await auth.authenticate();
      const jogador = await this.jogadorDoUsuarioOrFail(user.id);

      const mapaRaw = String(params.mapa || request.input("mapa") || "")
        .trim()
        .toLowerCase();
      if (!mapaRaw) {
        return this.customResponse.erro(response, "Informe um mapa para vetar.", {}, 400);
      }

      const sessaoId = Number(request.input("sessao_id"));
      let sessao = sessaoId ? await this.sessionById(sessaoId) : await this.sessionAtiva(user.id);
      if (!sessao) throw new Error("Sessão não encontrada.");
      sessao = await this.reconcile(sessao.id);
      if (!sessao) throw new Error("Sessão inválida.");

      const team = this.teamByCaptain(sessao, jogador.id);
      if (!team) {
        return this.customResponse.erro(
          response,
          "Apenas capitães podem vetar mapas.",
          {},
          403
        );
      }

      if (sessao.map_stage !== "veto") {
        return this.customResponse.erro(response, "A fase de veto de mapas não está ativa.", {}, 409);
      }

      if (sessao.map_veto_turn !== team) {
        return this.customResponse.erro(response, "Não é a vez do seu time vetar.", {}, 409);
      }

      await this.applyMapBan(sessao.id, team, mapaRaw);

      const next = await this.reconcile(sessao.id);
      if (!next) throw new Error("Sessão inválida após veto.");
      const snap = await this.snapshotFromSessao(next, jogador.id);
      return this.customResponse.sucesso(response, "Mapa vetado com sucesso.", snap);
    } catch (error) {
      return this.customResponse.erro(response, "Erro ao vetar mapa.", error, 500);
    }
  }

  public async undoPost({ auth, request, response }: HttpContextContract) {
    try {
      const user = await auth.authenticate();
      const jogador = await this.jogadorDoUsuarioOrFail(user.id);
      const sessaoId = Number(request.input("sessao_id"));

      let sessao = sessaoId ? await this.sessionById(sessaoId) : await this.sessionAtiva(user.id);
      if (!sessao) throw new Error("Sessão não encontrada.");

      const myTeam = this.teamByCaptain(sessao, jogador.id);
      const canUndo = myTeam !== null || sessao.criado_por_usuario_adm_id === user.id;
      if (!canUndo) {
        return this.customResponse.erro(response, "Sem permissão para desfazer pick.", {}, 403);
      }

      await Database.transaction(async (trx) => {
        const last = await trx
          .from("tb_tirar_mix_picks")
          .where("sessao_id", sessao!.id)
          .orderBy("ordem_pick", "desc")
          .first();

        if (!last) return;

        await trx.from("tb_tirar_mix_picks").where("id", last.id).delete();
        const firstFreeSlot = await this.firstFreePoolSlot(sessao!.id, trx);

        await trx
          .from("tb_tirar_mix_players")
          .where("sessao_id", sessao!.id)
          .where("jogador_id", last.player_id)
          .update({
            is_selecionado: false,
            time: null,
            ordem_pick: null,
            pool_slot: firstFreeSlot,
            updated_at: this.nowSql(),
          });

        await trx.from("tb_tirar_mix_sessoes").where("id", sessao!.id).update({
          status: "draft_em_andamento",
          fase: "draft",
          pick_turn: last.time,
          pick_deadline: DateTime.now().plus({ seconds: 30 }).toSQL(),
          finalizado_em: null,
          updated_at: this.nowSql(),
        });
      });

      const next = await this.reconcile(sessao.id);
      if (!next) throw new Error("Sessão inválida após desfazer.");
      const snap = await this.snapshotFromSessao(next, jogador.id);
      return this.customResponse.sucesso(response, "Último pick desfeito.", snap);
    } catch (error) {
      return this.customResponse.erro(response, "Erro ao desfazer pick.", error, 500);
    }
  }

  public async jogadoresDisponiveis({ response }: HttpContextContract) {
    try {
      const online = await this.onlinePlayers();
      return this.customResponse.sucesso(response, "Jogadores online.", online);
    } catch (error) {
      return this.customResponse.erro(response, "Erro ao listar jogadores.", error, 500);
    }
  }

  public async stats({ request, response }: HttpContextContract) {
    try {
      const idsRaw = String(request.input("ids") || "")
        .split(",")
        .map((v) => Number(v.trim()))
        .filter((n) => Number.isFinite(n) && n > 0);

      if (!idsRaw.length) {
        return this.customResponse.sucesso(response, "Stats dos jogadores.", []);
      }

      const rows = await Jogadores.query().whereIn("id", idsRaw);
      const stats = rows.map((j) => ({
        jogador_id: j.id,
        kdr_medio: Number(String(j.kda_player || "0").replace(",", ".")),
        win_rate:
          Number(j.qtd_partidas || 0) > 0
            ? (Number(j.vitorias || 0) / Number(j.qtd_partidas || 0)) * 100
            : 0,
        kast_medio: Number(j.kast || 0),
      }));

      return this.customResponse.sucesso(response, "Stats dos jogadores.", stats);
    } catch (error) {
      return this.customResponse.erro(response, "Erro ao listar stats.", error, 500);
    }
  }

  public async snapshot({ params, auth, response }: HttpContextContract) {
    try {
      const user = await auth.authenticate();
      const jogador = await this.jogadorDoUsuario(user.id);

      const sessaoId = Number(params.id || 0);
      let sessao = sessaoId ? await this.sessionById(sessaoId) : await this.sessionAtiva(user.id);
      if (!sessao) throw new Error("Sessão não encontrada.");

      sessao = await this.reconcile(sessao.id);
      if (!sessao) throw new Error("Sessão inválida.");

      const snap = await this.snapshotFromSessao(sessao, jogador?.id ?? null);
      return this.customResponse.sucesso(response, "Snapshot da sessão.", snap);
    } catch (error) {
      return this.customResponse.erro(response, "Erro ao carregar snapshot.", error, 500);
    }
  }

  public async convidarCapitaes({ auth, request, response }: HttpContextContract) {
    try {
      const user = await auth.authenticate();
      const sessaoId = Number(request.input("sessao_id"));
      const capAId = Number(request.input("capA_id"));
      const capBId = Number(request.input("capB_id"));

      if (!sessaoId || !capAId || !capBId || capAId === capBId) {
        return this.customResponse.erro(response, "Capitães inválidos.", {}, 400);
      }

      let sessao = await this.sessionById(sessaoId);
      if (!sessao) throw new Error("Sessão não encontrada.");

      const jogadores = await Jogadores.query().whereIn("id", [capAId, capBId]);
      if (jogadores.length < 2) {
        return this.customResponse.erro(response, "Capitães não encontrados.", {}, 404);
      }

      await Database.transaction(async (trx) => {
        await trx
          .from("tb_tirar_mix_players")
          .where("sessao_id", sessaoId)
          .whereIn("jogador_id", [capAId, capBId])
          .delete();

        await trx.table("tb_tirar_mix_players").insert([
          {
            sessao_id: sessaoId,
            jogador_id: capAId,
            is_capitao: true,
            is_selecionado: true,
            time: "A",
            pool_slot: null,
            created_at: this.nowSql(),
            updated_at: this.nowSql(),
          },
          {
            sessao_id: sessaoId,
            jogador_id: capBId,
            is_capitao: true,
            is_selecionado: true,
            time: "B",
            pool_slot: null,
            created_at: this.nowSql(),
            updated_at: this.nowSql(),
          },
        ]);

        await trx.from("tb_tirar_mix_sessoes").where("id", sessaoId).update({
          time_a_capitao_id: capAId,
          time_b_capitao_id: capBId,
          status: "capitaes_definidos",
          fase: "aguardando_inicio",
          start_ready_a: false,
          start_ready_b: false,
          updated_at: this.nowSql(),
        });
      });

      sessao = await this.reconcile(sessaoId);
      if (!sessao) throw new Error("Sessão inválida.");

      const meJogador = await this.jogadorDoUsuario(user.id);
      const snap = await this.snapshotFromSessao(sessao, meJogador?.id ?? null);

      return this.customResponse.sucesso(response, "Capitães definidos.", {
        A: { status: "aceito" },
        B: { status: "aceito" },
        snapshot: snap,
      });
    } catch (error) {
      return this.customResponse.erro(response, "Erro ao definir capitães.", error, 500);
    }
  }

  public async conviteMinhaSituacao({ auth, request, response }: HttpContextContract) {
    try {
      const user = await auth.authenticate();
      const jogador = await this.jogadorDoUsuario(user.id);
      const sessaoId = Number(request.input("sessao_id") || 0);
      const sessao = sessaoId ? await this.sessionById(sessaoId) : await this.sessionAtiva(user.id);
      if (!sessao) throw new Error("Sessão não encontrada.");

      const myTeam = jogador ? this.teamByCaptain(sessao, jogador.id) : null;
      const payload = {
        A: { status: sessao.time_a_capitao_id ? "aceito" : "pendente" },
        B: { status: sessao.time_b_capitao_id ? "aceito" : "pendente" },
        eu: {
          token: null,
          time: myTeam,
          status: myTeam ? "aceito" : "pendente",
        },
      };

      return this.customResponse.sucesso(response, "Situação de convites.", payload);
    } catch (error) {
      return this.customResponse.erro(response, "Erro ao consultar situação.", error, 500);
    }
  }

  public async aceitarCapitao({ response }: HttpContextContract) {
    return this.customResponse.sucesso(response, "Convite aceito.", { ok: true });
  }

  public async recusarCapitao({ response }: HttpContextContract) {
    return this.customResponse.sucesso(response, "Convite recusado.", { ok: true });
  }
}
