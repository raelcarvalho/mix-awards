import { useCallback, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card } from '@/components/ui/Card'
import PlayerSelect from '@/components/ui/PlayerSelect'
import * as api from '@/services/api'

/**
 * NOTA DE LAYOUT: o reset global de index.css (`* { margin: 0; padding: 0 }`)
 * não está em @layer e por isso anula os utilitários de espaçamento do Tailwind
 * (`p-*`, `m-*`, `mx-auto`). Aqui o espaçamento entre elementos usa `gap` e a
 * centralização usa `flex justify-center` — ambos funcionam. Padding vai inline.
 */

const COLOR_A = '#22d3ee'
const COLOR_B = '#fb923c'
const COLOR_SEASON = '#f5c842'

const CARD_PAD = { padding: 22 }

interface ComparacaoSelecionada {
  seasonId: number
  jogadorA: number
  jogadorB: number
}

function fmt(value: number, decimals = 0) {
  if (!Number.isFinite(value)) return '0'
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

function formatarData(raw: string) {
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return raw
  return d.toLocaleDateString('pt-BR')
}

/** Barra comparativa A x B, proporcional ao total. */
function BarraComparativa({
  label,
  valorA,
  valorB,
  decimals = 0,
}: {
  label: string
  valorA: number
  valorB: number
  decimals?: number
}) {
  const total = valorA + valorB
  const pctA = total > 0 ? (valorA / total) * 100 : 50
  const lidera = valorA === valorB ? null : valorA > valorB ? 'a' : 'b'

  return (
    <div className="flex flex-col gap-1.5">
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-baseline gap-3">
        <span
          className="font-orbitron text-sm sm:text-base font-bold tabular-nums"
          style={{ color: COLOR_A, opacity: lidera === 'b' ? 0.5 : 1 }}
        >
          {fmt(valorA, decimals)}
        </span>
        <span className="font-rajdhani text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.18em] text-white/40 text-center">
          {label}
        </span>
        <span
          className="font-orbitron text-sm sm:text-base font-bold tabular-nums text-right"
          style={{ color: COLOR_B, opacity: lidera === 'a' ? 0.5 : 1 }}
        >
          {fmt(valorB, decimals)}
        </span>
      </div>

      <div className="flex h-2 rounded-full overflow-hidden bg-white/[0.06]">
        <div
          className="transition-[width] duration-300"
          style={{ width: `${pctA}%`, background: COLOR_A }}
        />
        <div
          className="transition-[width] duration-300"
          style={{ width: `${100 - pctA}%`, background: COLOR_B }}
        />
      </div>
    </div>
  )
}

/** Lado do placar — markup idêntico nos dois lados, garantindo simetria. */
function PlacarLado({
  nome,
  imagem,
  vitorias,
  color,
}: {
  nome: string
  imagem?: string | null
  vitorias: number
  color: string
}) {
  return (
    <div className="flex flex-col items-center gap-2 min-w-0">
      {imagem ? (
        <img
          src={imagem}
          alt={nome}
          className="w-12 h-12 sm:w-14 sm:h-14 rounded-full object-cover border-2"
          style={{ borderColor: `${color}88`, boxShadow: `0 0 18px ${color}33` }}
          onError={(e) => {
            ;(e.target as HTMLImageElement).style.visibility = 'hidden'
          }}
        />
      ) : (
        <span
          className="w-12 h-12 sm:w-14 sm:h-14 rounded-full border-2 flex items-center justify-center text-lg font-bold"
          style={{ background: `${color}1a`, borderColor: `${color}88`, color }}
        >
          {nome?.[0]?.toUpperCase() || '?'}
        </span>
      )}

      <span className="font-rajdhani text-sm sm:text-base font-bold text-white text-center truncate max-w-full">
        {nome}
      </span>

      <span
        className="font-orbitron text-4xl sm:text-5xl font-black leading-none tabular-nums"
        style={{ color }}
      >
        {vitorias}
      </span>
    </div>
  )
}

/** Dupla (par de avatares + nomes) usada no ranking e nas listas de adversários. */
function DuplaLabel({
  a,
  b,
  compact = false,
}: {
  a?: api.ConfrontoJogador
  b?: api.ConfrontoJogador
  compact?: boolean
}) {
  const size = compact ? 'w-6 h-6 text-[10px]' : 'w-8 h-8 text-xs'
  const render = (j?: api.ConfrontoJogador, fallback = '?') =>
    j?.imagem ? (
      <img
        src={j.imagem}
        alt={j.nome}
        className={`${size} rounded-full object-cover border border-white/15`}
        onError={(e) => {
          ;(e.target as HTMLImageElement).style.visibility = 'hidden'
        }}
      />
    ) : (
      <span
        className={`${size} rounded-full border border-white/15 bg-white/10 flex items-center justify-center font-bold text-white/70`}
      >
        {j?.nome?.[0]?.toUpperCase() || fallback}
      </span>
    )

  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className="flex -space-x-1.5">
        {render(a)}
        {render(b)}
      </div>
      <span
        className={`font-rajdhani font-bold text-white/85 truncate ${
          compact ? 'text-xs' : 'text-sm'
        }`}
      >
        {a?.nome || 'Jogador'} <span className="text-white/30">+</span>{' '}
        {b?.nome || 'Jogador'}
      </span>
    </div>
  )
}

/** Linha de aproveitamento (barra + %). */
function AproveitamentoBar({ pct }: { pct: number }) {
  const cor = pct >= 60 ? '#4ade80' : pct >= 45 ? COLOR_SEASON : '#fb7185'
  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className="flex-1 h-2 rounded-full overflow-hidden bg-white/[0.06] min-w-[60px]">
        <div
          className="h-full transition-[width] duration-300"
          style={{ width: `${Math.min(100, pct)}%`, background: cor }}
        />
      </div>
      <span
        className="font-orbitron text-sm font-bold tabular-nums w-14 text-right"
        style={{ color: cor }}
      >
        {fmt(pct, 1)}%
      </span>
    </div>
  )
}

/** Chips com os jogadores do time adversário de um jogo. */
function TimeAdversario({
  adversarios,
  jogadorPorId,
}: {
  adversarios: api.DuplaAdversarioJogador[]
  jogadorPorId: Map<number, api.ConfrontoJogador>
}) {
  if (adversarios.length === 0) {
    return <span className="font-rajdhani text-[11px] text-white/25">—</span>
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {adversarios.map((adv) => {
        const j = jogadorPorId.get(adv.jogador_id)
        return (
          <span
            key={adv.jogador_id}
            className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04]"
            style={{ padding: '2px 8px 2px 2px' }}
            title={`${j?.nome || `#${adv.jogador_id}`} — ${adv.kills}K / ${adv.mortes}M`}
          >
            {j?.imagem ? (
              <img
                src={j.imagem}
                alt={j.nome}
                className="w-4 h-4 rounded-full object-cover"
                onError={(e) => {
                  ;(e.target as HTMLImageElement).style.visibility = 'hidden'
                }}
              />
            ) : (
              <span className="w-4 h-4 rounded-full bg-white/15 flex items-center justify-center text-[8px] font-bold text-white/70">
                {j?.nome?.[0]?.toUpperCase() || '?'}
              </span>
            )}
            <span className="font-rajdhani text-[11px] font-medium text-white/70">
              {j?.nome || `#${adv.jogador_id}`}
            </span>
          </span>
        )
      })}
    </div>
  )
}

/** Histórico jogo a jogo da dupla — cada partida real, explícita. */
function HistoricoJogos({
  jogos,
  jogadorPorId,
}: {
  jogos: api.DuplaJogo[]
  jogadorPorId: Map<number, api.ConfrontoJogador>
}) {
  if (jogos.length === 0) {
    return (
      <span className="font-rajdhani text-xs text-white/30">
        Sem partidas registradas.
      </span>
    )
  }
  return (
    <div className="flex flex-col gap-2">
      {jogos.map((j) => {
        const resultado = j.empate
          ? { txt: 'EMPATE', cor: 'rgba(255,255,255,.45)', bg: 'rgba(255,255,255,.04)' }
          : j.venceu
          ? { txt: 'VITÓRIA', cor: '#4ade80', bg: 'rgba(74,222,128,.08)' }
          : { txt: 'DERROTA', cor: '#fb7185', bg: 'rgba(251,113,133,.08)' }
        const temPlacar = j.placar_dupla != null && j.placar_adversario != null
        return (
          <div
            key={j.partida_id}
            className="rounded-xl border"
            style={{
              padding: '10px 12px',
              background: resultado.bg,
              borderColor: `${resultado.cor}33`,
            }}
          >
            <div className="flex items-center gap-3 flex-wrap">
              <span
                className="font-rajdhani text-[10px] font-black uppercase tracking-[0.12em] rounded px-2 py-0.5 shrink-0"
                style={{ color: resultado.cor, background: `${resultado.cor}1f` }}
              >
                {resultado.txt}
              </span>

              {temPlacar && (
                <span className="font-orbitron text-sm font-bold tabular-nums shrink-0">
                  <span style={{ color: resultado.cor }}>{j.placar_dupla}</span>
                  <span className="text-white/25"> × </span>
                  <span className="text-white/60">{j.placar_adversario}</span>
                </span>
              )}

              <span className="font-rajdhani text-xs text-white/60 truncate">
                {j.mapa}
              </span>

              <span className="font-rajdhani text-[11px] text-white/30 ml-auto shrink-0">
                {formatarData(j.data)}
              </span>
            </div>

            <div className="flex items-center gap-2 mt-2.5">
              <span className="font-rajdhani text-[10px] font-bold uppercase tracking-[0.12em] text-white/30 shrink-0">
                vs
              </span>
              <TimeAdversario adversarios={j.adversarios} jogadorPorId={jogadorPorId} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

function DuplaDetalheBox({
  seasonId,
  dupla,
  jogadorPorId,
}: {
  seasonId: number
  dupla: api.DuplaRanking
  jogadorPorId: Map<number, api.ConfrontoJogador>
}) {
  const { data, isFetching, isError } = useQuery({
    queryKey: ['dupla-detalhe', seasonId, dupla.jogador_a, dupla.jogador_b],
    queryFn: () =>
      api.detalharDupla({
        seasonId,
        jogadorA: dupla.jogador_a,
        jogadorB: dupla.jogador_b,
      }),
  })

  if (isFetching) {
    return (
      <p className="font-rajdhani text-xs text-white/35" style={{ padding: '12px 0' }}>
        Carregando…
      </p>
    )
  }
  if (isError || !data) {
    return (
      <p className="font-rajdhani text-xs text-red-400" style={{ padding: '12px 0' }}>
        Não foi possível carregar o detalhe.
      </p>
    )
  }

  return (
    <div
      className="flex flex-col gap-5 border-t border-white/[0.06]"
      style={{ paddingTop: 14, marginTop: 12 }}
    >
      <p className="font-rajdhani text-xs text-white/45">
        Juntos:{' '}
        <span className="font-bold text-emerald-400">{data.vitorias} vitórias</span> e{' '}
        <span className="font-bold text-rose-400">{data.derrotas} derrotas</span> em{' '}
        {data.partidas} {data.partidas === 1 ? 'jogo' : 'jogos'}.
      </p>

      <div className="flex flex-col gap-2.5">
        <span className="font-rajdhani text-[11px] font-bold uppercase tracking-[0.18em] text-white/45">
          Histórico jogo a jogo
        </span>
        <HistoricoJogos jogos={data.jogos} jogadorPorId={jogadorPorId} />
      </div>
    </div>
  )
}

function DuplasView({
  seasonId,
  jogadorPorId,
}: {
  seasonId: number
  jogadorPorId: Map<number, api.ConfrontoJogador>
}) {
  const [expandida, setExpandida] = useState<string | null>(null)

  const { data: duplas = [], isFetching, isError } = useQuery({
    queryKey: ['duplas-vitoriosas', seasonId],
    queryFn: () => api.listarDuplasVitoriosas(seasonId),
  })

  if (isFetching) {
    return (
      <Card style={CARD_PAD}>
        <p className="text-center font-rajdhani text-sm text-white/35">
          Carregando duplas…
        </p>
      </Card>
    )
  }
  if (isError) {
    return (
      <Card style={CARD_PAD}>
        <p className="text-center font-rajdhani text-sm text-red-400">
          Não foi possível carregar as duplas.
        </p>
      </Card>
    )
  }
  if (duplas.length === 0) {
    return (
      <Card style={CARD_PAD}>
        <p className="text-center font-rajdhani text-sm text-white/35">
          Nenhuma dupla com partidas suficientes nesta temporada.
        </p>
      </Card>
    )
  }

  return (
    <Card style={CARD_PAD}>
      <div className="flex flex-col gap-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-rajdhani text-lg font-bold text-white">
            Duplas mais vitoriosas
          </h2>
          <span className="font-rajdhani text-[11px] text-white/30">
            top 20 · mín. 3 jogos juntos
          </span>
        </div>

        <div className="flex flex-col gap-2">
          {duplas.map((d, i) => {
            const key = `${d.jogador_a}-${d.jogador_b}`
            const aberta = expandida === key
            return (
              <div
                key={key}
                className="rounded-xl border border-white/[0.06] bg-white/[0.025]"
                style={{ padding: '12px 14px' }}
              >
                <button
                  type="button"
                  onClick={() => setExpandida(aberta ? null : key)}
                  className="w-full flex items-center gap-3 sm:gap-4 text-left cursor-pointer"
                >
                  <span className="font-orbitron text-xs font-bold text-white/25 w-5 shrink-0">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <DuplaLabel
                      a={jogadorPorId.get(d.jogador_a)}
                      b={jogadorPorId.get(d.jogador_b)}
                    />
                  </div>
                  <div className="w-[130px] sm:w-[170px] shrink-0">
                    <AproveitamentoBar pct={d.aproveitamento} />
                  </div>
                  <span className="hidden sm:inline font-rajdhani text-xs text-white/45 w-16 text-right shrink-0 tabular-nums">
                    {d.vitorias}V {d.derrotas}D
                  </span>
                  <span
                    className="text-white/30 text-xs shrink-0 transition-transform"
                    style={{ transform: aberta ? 'rotate(180deg)' : 'none' }}
                  >
                    ▾
                  </span>
                </button>

                {aberta && (
                  <DuplaDetalheBox
                    seasonId={seasonId}
                    dupla={d}
                    jogadorPorId={jogadorPorId}
                  />
                )}
              </div>
            )
          })}
        </div>
      </div>
    </Card>
  )
}

type Modo = 'h2h' | 'duplas'

export default function ConfrontosPage() {
  const [modo, setModo] = useState<Modo>('h2h')
  const [seasonId, setSeasonId] = useState<number>(2)
  const [jogadorA, setJogadorA] = useState<number | null>(null)
  const [jogadorB, setJogadorB] = useState<number | null>(null)
  // A comparação só dispara ao clicar em "Comparar": guardamos os parâmetros
  // confirmados, e a query key deriva deles.
  const [comparacao, setComparacao] = useState<ComparacaoSelecionada | null>(null)

  const { data: jogadores = [], isLoading: carregandoJogadores } = useQuery({
    queryKey: ['confrontos-jogadores', seasonId],
    queryFn: () => api.listarJogadoresDaTemporada(seasonId),
  })

  const {
    data: resultado,
    isFetching: comparando,
    isError,
  } = useQuery({
    queryKey: [
      'confrontos-comparar',
      comparacao?.seasonId,
      comparacao?.jogadorA,
      comparacao?.jogadorB,
    ],
    queryFn: () =>
      api.compararJogadores({
        seasonId: comparacao!.seasonId,
        jogadorA: comparacao!.jogadorA,
        jogadorB: comparacao!.jogadorB,
      }),
    enabled: comparacao !== null,
  })

  const jogadorPorId = useMemo(() => {
    const map = new Map<number, api.ConfrontoJogador>()
    for (const j of jogadores) map.set(j.id, j)
    return map
  }, [jogadores])

  // Cada lado não oferece o jogador já escolhido no outro — um confronto exige
  // dois jogadores distintos.
  const opcoesA = useMemo(
    () => (jogadorB === null ? jogadores : jogadores.filter((j) => j.id !== jogadorB)),
    [jogadores, jogadorB]
  )
  const opcoesB = useMemo(
    () => (jogadorA === null ? jogadores : jogadores.filter((j) => j.id !== jogadorA)),
    [jogadores, jogadorA]
  )

  const podeComparar =
    jogadorA !== null && jogadorB !== null && jogadorA !== jogadorB

  const handleTrocarTemporada = useCallback((next: number) => {
    setSeasonId(next)
    // Os jogadores da nova temporada podem ser outros; o resultado antigo
    // deixa de valer.
    setComparacao(null)
  }, [])

  const handleComparar = useCallback(() => {
    if (jogadorA === null || jogadorB === null || jogadorA === jogadorB) return
    setComparacao({ seasonId, jogadorA, jogadorB })
  }, [seasonId, jogadorA, jogadorB])

  const infoA = comparacao ? jogadorPorId.get(comparacao.jogadorA) : undefined
  const infoB = comparacao ? jogadorPorId.get(comparacao.jogadorB) : undefined

  return (
    <div className="w-full flex justify-center">
      <div className="w-full flex flex-col gap-5" style={{ maxWidth: 980 }}>
        {/* ── Header ─────────────────────────────────────────────── */}
        <div
          className="rounded-2xl border flex flex-col items-center gap-2 text-center"
          style={{
            padding: '26px 24px',
            background:
              'linear-gradient(135deg,rgba(34,211,238,.08) 0%,rgba(251,146,60,.07) 100%)',
            borderColor: 'rgba(34,211,238,.2)',
          }}
        >
          <span
            className="font-rajdhani text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.25em]"
            style={{ color: 'rgba(34,211,238,.7)' }}
          >
            ⚔ Temporada {seasonId}
          </span>
          <h1 className="font-orbitron text-xl sm:text-2xl font-black text-white tracking-[0.12em]">
            CONFRONTOS
          </h1>
          <p
            className="font-rajdhani text-xs sm:text-sm text-white/40"
            style={{ maxWidth: 420 }}
          >
            {modo === 'h2h'
              ? 'Compare dois jogadores nas partidas em que estiveram em times opostos.'
              : 'Ranking das duplas com melhor aproveitamento jogando no mesmo time.'}
          </p>
        </div>

        {/* ── Alternador de modo ─────────────────────────────────── */}
        <div className="flex justify-center">
          <div
            className="inline-flex rounded-xl border border-white/10 bg-white/[0.03]"
            style={{ padding: 4 }}
          >
            {(
              [
                ['h2h', 'Confronto direto'],
                ['duplas', 'Duplas vitoriosas'],
              ] as [Modo, string][]
            ).map(([value, label]) => {
              const ativo = modo === value
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setModo(value)}
                  className={`font-rajdhani text-xs sm:text-sm font-bold uppercase tracking-[0.1em] rounded-lg transition-all ${
                    ativo ? 'text-[#12121a]' : 'text-white/45 hover:text-white/70'
                  }`}
                  style={{
                    padding: '8px 16px',
                    background: ativo
                      ? `linear-gradient(135deg, ${COLOR_SEASON}, ${COLOR_SEASON}aa)`
                      : 'transparent',
                  }}
                >
                  {label}
                </button>
              )
            })}
          </div>
        </div>

        {modo === 'duplas' && (
          <DuplasView seasonId={seasonId} jogadorPorId={jogadorPorId} />
        )}

        {modo === 'h2h' && (
        <>
        {/* ── Seletores ──────────────────────────────────────────── */}
        <Card style={CARD_PAD}>
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] gap-5 md:gap-7 items-start">
              <PlayerSelect
                label="Jogador 1"
                color={COLOR_A}
                options={opcoesA}
                value={jogadorA}
                onChange={setJogadorA}
                disabled={carregandoJogadores}
              />

              {/* Coluna central alinhada às laterais: label + controle na
                  mesma altura, botão logo abaixo. */}
              <div
                className="w-full flex flex-col gap-1.5 justify-self-center"
                style={{ maxWidth: 190 }}
              >
                <span
                  className="font-rajdhani text-[10px] font-bold uppercase tracking-[0.2em] leading-4 text-center"
                  style={{ color: `${COLOR_SEASON}b3` }}
                >
                  Temporada
                </span>

                <div className="flex flex-col gap-2.5">
                  <select
                    value={seasonId}
                    onChange={(e) =>
                      handleTrocarTemporada(Number(e.target.value) === 1 ? 1 : 2)
                    }
                    className="w-full h-12 rounded-xl border text-sm text-white font-rajdhani font-bold text-center outline-none cursor-pointer"
                    style={{
                      padding: '0 10px',
                      background: 'rgba(255,255,255,.05)',
                      borderColor: `${COLOR_SEASON}59`,
                    }}
                  >
                    <option value={2}>Temporada 2</option>
                    <option value={1}>Temporada 1</option>
                  </select>

                  <button
                    type="button"
                    onClick={handleComparar}
                    disabled={!podeComparar || comparando}
                    className={`w-full h-11 rounded-xl border font-rajdhani text-sm font-extrabold uppercase tracking-[0.12em] transition-all ${
                      podeComparar && !comparando
                        ? 'cursor-pointer hover:brightness-110'
                        : 'cursor-not-allowed'
                    }`}
                    style={
                      podeComparar
                        ? {
                            background: `linear-gradient(135deg, ${COLOR_SEASON}, ${COLOR_SEASON}aa)`,
                            borderColor: `${COLOR_SEASON}88`,
                            color: '#12121a',
                          }
                        : {
                            background: 'rgba(255,255,255,.05)',
                            borderColor: 'rgba(255,255,255,.1)',
                            color: 'rgba(255,255,255,.3)',
                          }
                    }
                  >
                    {comparando ? 'Comparando…' : 'Comparar'}
                  </button>
                </div>
              </div>

              <PlayerSelect
                label="Jogador 2"
                color={COLOR_B}
                options={opcoesB}
                value={jogadorB}
                onChange={setJogadorB}
                disabled={carregandoJogadores}
              />
            </div>

          </div>
        </Card>

        {isError && (
          <Card style={CARD_PAD}>
            <p className="text-center font-rajdhani text-sm text-red-400">
              Não foi possível calcular o confronto.
            </p>
          </Card>
        )}

        {resultado && !isError && (
          <>
            <Card style={CARD_PAD}>
              <div className="flex flex-col gap-6">
                <h2 className="font-rajdhani text-lg font-bold text-white">
                  Resumo do confronto
                </h2>

                {resultado.confrontos === 0 ? (
                  <p
                    className="text-center font-rajdhani text-sm text-white/35"
                    style={{ padding: '28px 0' }}
                  >
                    Esses jogadores nunca se enfrentaram na Temporada{' '}
                    {resultado.season_id}.
                  </p>
                ) : (
                  <div className="flex flex-col items-center gap-7">
                    {/* Placar — 3 colunas simétricas */}
                    <div
                      className="w-full grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-4 sm:gap-8"
                      style={{ maxWidth: 560 }}
                    >
                      <PlacarLado
                        nome={infoA?.nome || `#${resultado.jogador_a.id}`}
                        imagem={infoA?.imagem}
                        vitorias={resultado.jogador_a.vitorias}
                        color={COLOR_A}
                      />

                      <div className="flex flex-col items-center gap-1">
                        <span className="font-orbitron text-sm sm:text-base text-white/25 tracking-widest">
                          VS
                        </span>
                        <span className="font-rajdhani text-[11px] text-white/45 text-center whitespace-nowrap">
                          {resultado.confrontos} confronto
                          {resultado.confrontos === 1 ? '' : 's'}
                        </span>
                        {resultado.empates > 0 && (
                          <span className="font-rajdhani text-[10px] text-white/30 text-center">
                            {resultado.empates} sem vencedor
                          </span>
                        )}
                      </div>

                      <PlacarLado
                        nome={infoB?.nome || `#${resultado.jogador_b.id}`}
                        imagem={infoB?.imagem}
                        vitorias={resultado.jogador_b.vitorias}
                        color={COLOR_B}
                      />
                    </div>

                    {/* Métricas */}
                    <div
                      className="w-full flex flex-col gap-5"
                      style={{ maxWidth: 560 }}
                    >
                      <BarraComparativa
                        label="Vitórias"
                        valorA={resultado.jogador_a.vitorias}
                        valorB={resultado.jogador_b.vitorias}
                      />
                      <BarraComparativa
                        label="Kills"
                        valorA={resultado.jogador_a.kills}
                        valorB={resultado.jogador_b.kills}
                      />
                      <BarraComparativa
                        label="Mortes"
                        valorA={resultado.jogador_a.mortes}
                        valorB={resultado.jogador_b.mortes}
                      />
                      <BarraComparativa
                        label="ADR médio"
                        valorA={resultado.jogador_a.adr}
                        valorB={resultado.jogador_b.adr}
                        decimals={1}
                      />
                    </div>

                    <p
                      className="font-rajdhani text-[11px] leading-relaxed text-white/30 text-center"
                      style={{ maxWidth: 420 }}
                    >
                      As kills mostradas são o total de cada jogador nas partidas de
                      confronto — as partidas importadas não registram quem matou quem.
                    </p>
                  </div>
                )}
              </div>
            </Card>

            {resultado.partidas.length > 0 && (
              <Card style={CARD_PAD}>
                <div className="flex flex-col gap-4">
                  <h2 className="font-rajdhani text-lg font-bold text-white">
                    Últimos confrontos
                  </h2>

                  <div className="flex flex-col gap-2">
                    {/* Cabeçalho só no desktop; no mobile cada linha vira cartão. */}
                    <div
                      className="hidden md:grid grid-cols-[100px_minmax(0,1fr)_minmax(0,1fr)_72px_72px] gap-4 font-rajdhani text-[9px] font-bold uppercase tracking-[0.15em] text-white/25"
                      style={{ padding: '0 14px' }}
                    >
                      <span>Data</span>
                      <span>Mapa</span>
                      <span>Vencedor</span>
                      <span className="text-right">Kills 1</span>
                      <span className="text-right">Kills 2</span>
                    </div>

                    {resultado.partidas.map((p) => {
                      const vencedor = p.venceu_a
                        ? { nome: infoA?.nome || 'Jogador 1', cor: COLOR_A }
                        : p.venceu_b
                        ? { nome: infoB?.nome || 'Jogador 2', cor: COLOR_B }
                        : { nome: '—', cor: 'rgba(255,255,255,.3)' }

                      return (
                        <div
                          key={p.partida_id}
                          className="rounded-xl border border-white/[0.06] bg-white/[0.025]
                            grid grid-cols-2 gap-x-4 gap-y-2
                            md:grid-cols-[100px_minmax(0,1fr)_minmax(0,1fr)_72px_72px] md:gap-4 md:items-center"
                          style={{ padding: '12px 14px' }}
                        >
                          <span className="font-rajdhani text-xs text-white/55">
                            {formatarData(p.data)}
                          </span>

                          <span className="font-rajdhani text-xs text-white/75 truncate text-right md:text-left">
                            {p.mapa}
                          </span>

                          <span
                            className="font-rajdhani text-xs font-bold truncate col-span-2 md:col-span-1"
                            style={{ color: vencedor.cor }}
                          >
                            <span className="md:hidden text-white/30 font-normal">
                              Vencedor:{' '}
                            </span>
                            {vencedor.nome}
                          </span>

                          <span
                            className="font-orbitron text-xs tabular-nums md:text-right"
                            style={{ color: COLOR_A }}
                          >
                            <span className="md:hidden text-white/30 font-rajdhani">
                              Kills 1:{' '}
                            </span>
                            {fmt(Number(p.kills_a || 0))}
                          </span>

                          <span
                            className="font-orbitron text-xs tabular-nums text-right"
                            style={{ color: COLOR_B }}
                          >
                            <span className="md:hidden text-white/30 font-rajdhani">
                              Kills 2:{' '}
                            </span>
                            {fmt(Number(p.kills_b || 0))}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </Card>
            )}
          </>
        )}
        </>
        )}
      </div>
    </div>
  )
}
