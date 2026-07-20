// Mix Bet: página inteira desativada por enquanto (feature não está em uso).
// Para reativar: descomente este arquivo todo, o bloco "Mix Bet" em
// web/src/api/api.ts, e os trechos "Mix Bet" marcados em App.tsx e
// AppLayout.tsx.
// import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
// import { useQuery } from '@tanstack/react-query'
// import { Card } from '@/components/ui/Card'
// import { useAuth } from '@/hooks/useAuth'
// import * as api from '@/services/api'
// import type { BetAposta, BetAtiva, BetFaixa, BetPlayerOdds, BetSelecao } from '@/api/api'
// 
// type CategoriaJogador = 'kills' | 'mortes' | 'assistencias' | 'multi_kills' | 'first_kills'
// 
// const CATEGORIAS_JOGADOR: Array<{ id: CategoriaJogador; label: string; mediaKey: keyof BetPlayerOdds }> = [
//   { id: 'kills', label: 'Matadores', mediaKey: 'media_kills' },
//   { id: 'mortes', label: 'Mortes', mediaKey: 'media_mortes' },
//   { id: 'assistencias', label: 'Assistências', mediaKey: 'media_assistencias' },
//   { id: 'multi_kills', label: 'Multi Kills', mediaKey: 'media_multi_kills' },
//   { id: 'first_kills', label: 'First Kill', mediaKey: 'media_first_kills' },
// ]
// 
// const CATEGORIA_LABEL: Record<string, string> = {
//   kills: 'Matadores',
//   mortes: 'Mortes',
//   assistencias: 'Assistências',
//   multi_kills: 'Multi Kills',
//   first_kills: 'First Kill',
//   rounds: 'Rounds',
//   vitoria: 'Vitória',
// }
// 
// type Selecao = {
//   chave: string
//   categoria: string
//   jogador_id: number | null
//   jogador_nome: string | null
//   faixa: string
//   odd: number
// }
// 
// const GREEN = '#4ade80'
// const RED = '#f87171'
// const GOLD = '#facc15'
// 
// function fmtOdd(odd: number) {
//   return odd.toFixed(2)
// }
// 
// function Toast({ msg, type }: { msg: string; type: 'ok' | 'err' | '' }) {
//   if (!msg) return null
//   return (
//     <div
//       style={{
//         position: 'fixed',
//         bottom: 32,
//         left: '50%',
//         transform: 'translateX(-50%)',
//         background: type === 'ok' ? 'rgba(74,222,128,.15)' : 'rgba(248,113,113,.15)',
//         border: `1px solid ${type === 'ok' ? GREEN : RED}`,
//         borderRadius: 10,
//         padding: '12px 24px',
//         color: type === 'ok' ? GREEN : RED,
//         fontFamily: "'Rajdhani',sans-serif",
//         fontWeight: 700,
//         fontSize: 14,
//         letterSpacing: 1,
//         zIndex: 300,
//         backdropFilter: 'blur(12px)',
//       }}
//     >
//       {msg}
//     </div>
//   )
// }
// 
// function OddButton({
//   faixa,
//   ativo,
//   disabled,
//   onClick,
// }: {
//   faixa: BetFaixa
//   ativo: boolean
//   disabled: boolean
//   onClick: () => void
// }) {
//   return (
//     <button
//       onClick={onClick}
//       disabled={disabled}
//       className="flex flex-col items-center justify-center rounded-lg px-2 py-1.5 transition-all"
//       style={{
//         minWidth: 74,
//         border: `1px solid ${ativo ? GREEN : 'rgba(255,255,255,0.1)'}`,
//         background: ativo ? 'rgba(74,222,128,.18)' : 'rgba(255,255,255,0.04)',
//         cursor: disabled ? 'not-allowed' : 'pointer',
//         opacity: disabled ? 0.45 : 1,
//       }}
//     >
//       <span className="text-[11px] text-white/60 leading-none">{faixa.faixa}</span>
//       <span className="text-sm font-bold leading-tight" style={{ color: ativo ? GREEN : '#7dd3a7' }}>
//         {fmtOdd(faixa.odd)}
//       </span>
//     </button>
//   )
// }
// 
// function CategoriaJogadores({
//   titulo,
//   categoria,
//   jogadores,
//   mediaKey,
//   selecoes,
//   disabled,
//   onToggle,
// }: {
//   titulo: string
//   categoria: CategoriaJogador
//   jogadores: BetPlayerOdds[]
//   mediaKey: keyof BetPlayerOdds
//   selecoes: Map<string, Selecao>
//   disabled: boolean
//   onToggle: (sel: Selecao) => void
// }) {
//   const [aberta, setAberta] = useState(categoria === 'kills')
// 
//   return (
//     <Card className="!p-0 overflow-hidden">
//       <button
//         className="flex items-center justify-between w-full px-5 py-4"
//         onClick={() => setAberta((v) => !v)}
//         style={{ cursor: 'pointer' }}
//       >
//         <span className="font-bold text-white tracking-wide" style={{ fontFamily: "'Rajdhani',sans-serif" }}>
//           {titulo}
//         </span>
//         <span className="text-white/50 text-sm">{aberta ? '▲' : '▼'}</span>
//       </button>
// 
//       {aberta && (
//         <div className="px-3 pb-4 overflow-x-auto">
//           {jogadores.map((j) => {
//             const chave = `${categoria}:${j.jogador_id}`
//             const atual = selecoes.get(chave)
//             const faixas = j[categoria] as BetFaixa[]
//             return (
//               <div
//                 key={j.jogador_id}
//                 className="flex items-center gap-3 py-2 px-2 rounded-lg"
//                 style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
//               >
//                 <div className="flex items-center gap-2 min-w-[170px]">
//                   {j.imagem ? (
//                     <img src={j.imagem} alt="" className="w-7 h-7 rounded-full object-cover" />
//                   ) : (
//                     <div className="w-7 h-7 rounded-full bg-white/10" />
//                   )}
//                   <div className="flex flex-col">
//                     <span className="text-sm text-white font-semibold leading-tight">{j.nome}</span>
//                     <span className="text-[10px] text-white/40 leading-tight">
//                       Time {j.time} · média {Number(j[mediaKey] ?? 0)}
//                     </span>
//                   </div>
//                 </div>
//                 <div className="flex gap-1.5 flex-wrap">
//                   {faixas.map((f) => (
//                     <OddButton
//                       key={f.faixa}
//                       faixa={f}
//                       disabled={disabled}
//                       ativo={atual?.faixa === f.faixa}
//                       onClick={() =>
//                         onToggle({
//                           chave,
//                           categoria,
//                           jogador_id: j.jogador_id,
//                           jogador_nome: j.nome,
//                           faixa: f.faixa,
//                           odd: f.odd,
//                         })
//                       }
//                     />
//                   ))}
//                 </div>
//               </div>
//             )
//           })}
//         </div>
//       )}
//     </Card>
//   )
// }
// 
// function ApostaCard({ aposta, onResgatar }: { aposta: BetAposta; onResgatar: (id: number) => void }) {
//   const itens: BetSelecao[] = aposta.resultado ?? aposta.selecoes
//   const liquidada = !!aposta.resultado
//   const cor =
//     aposta.status === 'ganha' ? GREEN : aposta.status === 'perdida' ? RED : 'rgba(255,255,255,0.6)'
// 
//   return (
//     <div
//       className="rounded-xl p-4 flex flex-col gap-2"
//       style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid rgba(255,255,255,0.08)` }}
//     >
//       <div className="flex items-center justify-between">
//         <span className="text-xs text-white/50">
//           {aposta.bet?.codigo ? `${aposta.bet.codigo} · ${aposta.bet.mapa}` : `Aposta #${aposta.id}`}
//         </span>
//         <span className="text-xs font-bold uppercase tracking-wider" style={{ color: cor }}>
//           {aposta.status}
//         </span>
//       </div>
// 
//       {itens.map((s, i) => (
//         <div key={i} className="flex items-center justify-between text-sm">
//           <div className="flex items-center gap-2">
//             {liquidada && (
//               <span style={{ color: s.acertou ? GREEN : RED, fontWeight: 700 }}>{s.acertou ? '✓' : '✗'}</span>
//             )}
//             <span className="text-white/80">
//               {CATEGORIA_LABEL[s.categoria] || s.categoria}
//               {s.jogador_nome ? ` · ${s.jogador_nome}` : ''} — {s.faixa}
//               {liquidada && s.valor_real !== null && s.valor_real !== undefined ? (
//                 <span className="text-white/40"> (real: {s.valor_real})</span>
//               ) : null}
//             </span>
//           </div>
//           <span style={{ color: '#7dd3a7', fontWeight: 700 }}>{fmtOdd(s.odd)}</span>
//         </div>
//       ))}
// 
//       <div className="flex items-center justify-between pt-1" style={{ borderTop: '1px dashed rgba(255,255,255,0.1)' }}>
//         <span className="text-xs text-white/60">
//           {aposta.valor} gold × {fmtOdd(aposta.multiplicador)}
//         </span>
//         <span className="text-sm font-bold" style={{ color: GOLD }}>
//           {aposta.retorno_potencial} gold
//         </span>
//       </div>
// 
//       {aposta.status === 'ganha' && !aposta.resgatada && (
//         <button
//           onClick={() => onResgatar(aposta.id)}
//           className="mt-1 rounded-lg py-2 font-bold text-sm tracking-wide"
//           style={{ background: 'rgba(250,204,21,.15)', border: `1px solid ${GOLD}`, color: GOLD, cursor: 'pointer' }}
//         >
//           🪙 Resgatar Gold ({aposta.retorno_potencial})
//         </button>
//       )}
//       {aposta.status === 'ganha' && aposta.resgatada && (
//         <span className="text-xs text-center" style={{ color: GOLD }}>
//           Gold resgatado ✓
//         </span>
//       )}
//     </div>
//   )
// }
// 
// export default function BetPage() {
//   const { gold, refreshGold, jogadorId } = useAuth()
//   const [selecoes, setSelecoes] = useState<Map<string, Selecao>>(new Map())
//   const [valor, setValor] = useState<string>('10')
//   const [enviando, setEnviando] = useState(false)
//   const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' | '' }>({ msg: '', type: '' })
//   const [segundos, setSegundos] = useState(0)
//   const [slipAberto, setSlipAberto] = useState(true)
//   const betIdRef = useRef<number | null>(null)
// 
//   const showToast = (msg: string, type: 'ok' | 'err') => {
//     setToast({ msg, type })
//     setTimeout(() => setToast({ msg: '', type: '' }), 3500)
//   }
// 
//   // O poll de 5s pausa sozinho quando a aba perde o foco (comportamento
//   // padrão do react-query para refetchInterval), diferente do setInterval
//   // manual que rodava indefinidamente em segundo plano.
//   const { data: betQueryData, refetch: carregar } = useQuery({
//     queryKey: ['bet-ativa'],
//     queryFn: async () => {
//       const res = await api.betAtiva().catch(() => null)
//       const h = await api.betMinhas().catch(() => null)
//       return { data: res as BetAtiva | null, historico: (h?.apostas || []) as BetAposta[] }
//     },
//     refetchInterval: 5000,
//   })
// 
//   const data = betQueryData?.data ?? null
//   const historico = betQueryData?.historico ?? []
// 
//   useEffect(() => {
//     const bet = data?.bet
//     if (bet) {
//       if (betIdRef.current !== bet.id) {
//         // Nova bet: limpa seleções antigas
//         setSelecoes(new Map())
//         betIdRef.current = bet.id
//       }
//       setSegundos(bet.segundos_restantes || 0)
//     }
//   }, [data?.bet])
// 
//   useEffect(() => {
//     const tick = setInterval(() => setSegundos((s) => Math.max(0, s - 1)), 1000)
//     return () => clearInterval(tick)
//   }, [])
// 
//   const bet = data?.bet || null
//   const odds = bet?.odds || null
//   const janelaAberta = !!bet && bet.status === 'aberta' && segundos > 0
//   const souParticipante = !!bet?.sou_participante
//   const podeApostar = janelaAberta && !souParticipante && !!jogadorId
// 
//   const toggleSelecao = (sel: Selecao) => {
//     if (!podeApostar) return
//     setSelecoes((prev) => {
//       const next = new Map(prev)
//       const atual = next.get(sel.chave)
//       if (atual?.faixa === sel.faixa) next.delete(sel.chave)
//       else next.set(sel.chave, sel)
//       return next
//     })
//   }
// 
//   const listaSelecoes = useMemo(() => Array.from(selecoes.values()), [selecoes])
//   const multiplicador = useMemo(
//     () => Math.round(listaSelecoes.reduce((acc, s) => acc * s.odd, 1) * 100) / 100,
//     [listaSelecoes]
//   )
//   const valorNum = Math.max(0, Math.floor(Number(valor) || 0))
//   const retorno = Math.floor(valorNum * multiplicador)
// 
//   const enviarAposta = async () => {
//     if (!bet || !listaSelecoes.length || valorNum <= 0 || enviando) return
//     setEnviando(true)
//     try {
//       await api.betApostar(
//         bet.id,
//         valorNum,
//         listaSelecoes.map((s) => ({ categoria: s.categoria, jogador_id: s.jogador_id, faixa: s.faixa }))
//       )
//       showToast('Aposta registrada! Boa sorte 🍀', 'ok')
//       setSelecoes(new Map())
//       await refreshGold()
//       await carregar()
//     } catch (e: any) {
//       showToast(e?.message || 'Erro ao apostar.', 'err')
//     } finally {
//       setEnviando(false)
//     }
//   }
// 
//   const resgatar = async (apostaId: number) => {
//     try {
//       const r = await api.betResgatar(apostaId)
//       showToast(`+${r.premio} gold resgatado! 🪙`, 'ok')
//       await refreshGold()
//       await carregar()
//     } catch (e: any) {
//       showToast(e?.message || 'Erro ao resgatar.', 'err')
//     }
//   }
// 
//   const mmss = `${String(Math.floor(segundos / 60)).padStart(2, '0')}:${String(segundos % 60).padStart(2, '0')}`
// 
//   return (
//     <div className="flex flex-col gap-5 pb-40">
//       <Toast msg={toast.msg} type={toast.type} />
// 
//       {/* Cabeçalho da bet */}
//       {bet && odds ? (
//         <Card className="!p-5">
//           <div className="flex flex-wrap items-center justify-between gap-3">
//             <div className="flex flex-col">
//               <span className="text-xs text-white/40 tracking-widest">{bet.codigo}</span>
//               <span
//                 className="text-xl font-bold text-white"
//                 style={{ fontFamily: "'Rajdhani',sans-serif" }}
//               >
//                 {bet.nome_time_a} <span className="text-white/40">vs</span> {bet.nome_time_b}
//               </span>
//               <span className="text-sm text-white/50">Mapa: {bet.mapa}</span>
//             </div>
//             <div className="flex flex-col items-end">
//               {janelaAberta ? (
//                 <>
//                   <span className="text-xs text-white/50">Apostas fecham em</span>
//                   <span className="text-2xl font-bold" style={{ color: segundos <= 20 ? RED : GREEN }}>
//                     {mmss}
//                   </span>
//                 </>
//               ) : (
//                 <span
//                   className="text-sm font-bold px-3 py-1 rounded-full"
//                   style={{
//                     color: bet.status === 'liquidada' ? GOLD : RED,
//                     border: `1px solid ${bet.status === 'liquidada' ? GOLD : RED}`,
//                   }}
//                 >
//                   {bet.status === 'fechada' ? 'Apostas encerradas — aguardando resultado' : bet.status.toUpperCase()}
//                 </span>
//               )}
//             </div>
//           </div>
//           {souParticipante && (
//             <div
//               className="mt-3 rounded-lg px-4 py-2 text-sm font-semibold"
//               style={{ background: 'rgba(248,113,113,.12)', border: `1px solid ${RED}`, color: RED }}
//             >
//               Você está nesta partida — jogadores da partida não podem apostar.
//             </div>
//           )}
//         </Card>
//       ) : (
//         <Card className="!p-8 text-center">
//           <span className="text-white/60 text-sm">
//             Nenhuma partida disponível para apostas no momento. A bet abre automaticamente ao final do
//             veto de mapas (janela de 2 minutos).
//           </span>
//         </Card>
//       )}
// 
//       {/* Vitória + Rounds */}
//       {bet && odds && (
//         <>
//           <Card title="Vitória" className="!p-5">
//             <div className="flex gap-3 flex-wrap">
//               {odds.vitoria.map((v) => {
//                 const chave = `vitoria:${v.time}`
//                 const atual = selecoes.get(chave)
//                 return (
//                   <button
//                     key={v.time}
//                     disabled={!podeApostar}
//                     onClick={() =>
//                       toggleSelecao({
//                         chave,
//                         categoria: 'vitoria',
//                         jogador_id: null,
//                         jogador_nome: v.nome,
//                         faixa: v.time,
//                         odd: v.odd,
//                       })
//                     }
//                     className="flex-1 min-w-[200px] rounded-xl px-4 py-3 flex items-center justify-between"
//                     style={{
//                       border: `1px solid ${atual ? GREEN : 'rgba(255,255,255,0.1)'}`,
//                       background: atual ? 'rgba(74,222,128,.15)' : 'rgba(255,255,255,0.04)',
//                       cursor: podeApostar ? 'pointer' : 'not-allowed',
//                       opacity: podeApostar ? 1 : 0.5,
//                     }}
//                   >
//                     <span className="text-white font-semibold">{v.nome}</span>
//                     <span className="font-bold" style={{ color: '#7dd3a7' }}>
//                       {fmtOdd(v.odd)}
//                     </span>
//                   </button>
//                 )
//               })}
//             </div>
//           </Card>
// 
//           <Card title="Quantidade de Rounds" className="!p-5">
//             <div className="flex gap-2 flex-wrap">
//               {odds.rounds.map((f) => {
//                 const chave = 'rounds:total'
//                 const atual = selecoes.get(chave)
//                 return (
//                   <OddButton
//                     key={f.faixa}
//                     faixa={f}
//                     disabled={!podeApostar}
//                     ativo={atual?.faixa === f.faixa}
//                     onClick={() =>
//                       toggleSelecao({
//                         chave,
//                         categoria: 'rounds',
//                         jogador_id: null,
//                         jogador_nome: null,
//                         faixa: f.faixa,
//                         odd: f.odd,
//                       })
//                     }
//                   />
//                 )
//               })}
//             </div>
//           </Card>
// 
//           {CATEGORIAS_JOGADOR.map((cat) => (
//             <CategoriaJogadores
//               key={cat.id}
//               titulo={cat.label}
//               categoria={cat.id}
//               mediaKey={cat.mediaKey}
//               jogadores={odds.jogadores}
//               selecoes={selecoes}
//               disabled={!podeApostar}
//               onToggle={toggleSelecao}
//             />
//           ))}
//         </>
//       )}
// 
//       {/* Minhas apostas */}
//       {(data?.minhas_apostas?.length || historico.length) > 0 && (
//         <Card title="Minhas Apostas" className="!p-5">
//           <div className="flex flex-col gap-3">
//             {historico.map((a) => (
//               <ApostaCard key={a.id} aposta={a} onResgatar={resgatar} />
//             ))}
//           </div>
//         </Card>
//       )}
// 
//       {/* Bet slip flutuante (regra 5) */}
//       {listaSelecoes.length > 0 && (
//         <div
//           className="fixed bottom-4 right-4 rounded-2xl overflow-hidden"
//           style={{
//             width: 340,
//             maxWidth: 'calc(100vw - 32px)',
//             background: 'rgba(15,20,18,0.97)',
//             border: `1px solid rgba(74,222,128,.35)`,
//             boxShadow: '0 8px 40px rgba(0,0,0,.6)',
//             zIndex: 250,
//             backdropFilter: 'blur(14px)',
//           }}
//         >
//           <button
//             className="w-full flex items-center justify-between px-4 py-3"
//             onClick={() => setSlipAberto((v) => !v)}
//             style={{ background: 'rgba(74,222,128,.12)', cursor: 'pointer' }}
//           >
//             <span className="font-bold text-white text-sm">
//               <span
//                 className="inline-flex items-center justify-center w-5 h-5 rounded-full mr-2 text-[11px]"
//                 style={{ background: GREEN, color: '#0b0f0d' }}
//               >
//                 {listaSelecoes.length}
//               </span>
//               Criar Aposta
//             </span>
//             <span className="text-white/60 text-xs">{slipAberto ? '▼' : '▲'}</span>
//           </button>
// 
//           {slipAberto && (
//             <div className="p-4 flex flex-col gap-2 max-h-[50vh] overflow-y-auto">
//               {listaSelecoes.map((s) => (
//                 <div key={s.chave} className="flex items-start justify-between gap-2 text-sm">
//                   <div className="flex items-start gap-2">
//                     <button
//                       onClick={() => toggleSelecao(s)}
//                       className="text-white/40 hover:text-white"
//                       style={{ cursor: 'pointer', lineHeight: 1 }}
//                     >
//                       ✕
//                     </button>
//                     <div className="flex flex-col">
//                       <span className="text-white/90 font-semibold leading-tight">
//                         {s.jogador_nome || CATEGORIA_LABEL[s.categoria]}
//                       </span>
//                       <span className="text-[11px] text-white/50">
//                         {CATEGORIA_LABEL[s.categoria]} — {s.categoria === 'vitoria' ? 'Vencedor' : s.faixa}
//                       </span>
//                     </div>
//                   </div>
//                   <span className="font-bold" style={{ color: '#7dd3a7' }}>
//                     {fmtOdd(s.odd)}
//                   </span>
//                 </div>
//               ))}
// 
//               <div
//                 className="flex items-center justify-between pt-2 mt-1"
//                 style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}
//               >
//                 <span className="text-xs text-white/60">Multiplicador total</span>
//                 <span className="font-bold text-lg" style={{ color: GREEN }}>
//                   {fmtOdd(multiplicador)}x
//                 </span>
//               </div>
// 
//               <div className="flex items-center gap-2">
//                 <input
//                   type="number"
//                   min={1}
//                   value={valor}
//                   onChange={(e) => setValor(e.target.value)}
//                   className="flex-1 rounded-lg px-3 py-2 text-sm text-white outline-none"
//                   style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}
//                   placeholder="Valor (gold)"
//                 />
//                 <span className="text-xs text-white/50">saldo: {gold}</span>
//               </div>
// 
//               <div className="flex items-center justify-between text-sm">
//                 <span className="text-white/60">Retorno potencial</span>
//                 <span className="font-bold" style={{ color: GOLD }}>
//                   {retorno} gold
//                 </span>
//               </div>
// 
//               <button
//                 onClick={enviarAposta}
//                 disabled={!podeApostar || enviando || valorNum <= 0 || valorNum > gold}
//                 className="rounded-xl py-3 font-bold tracking-wide mt-1"
//                 style={{
//                   background:
//                     !podeApostar || valorNum <= 0 || valorNum > gold
//                       ? 'rgba(255,255,255,0.08)'
//                       : GREEN,
//                   color: !podeApostar || valorNum <= 0 || valorNum > gold ? 'rgba(255,255,255,0.4)' : '#0b0f0d',
//                   cursor: !podeApostar || enviando ? 'not-allowed' : 'pointer',
//                 }}
//               >
//                 {enviando
//                   ? 'Enviando...'
//                   : !janelaAberta
//                   ? 'Apostas encerradas'
//                   : souParticipante
//                   ? 'Você está na partida'
//                   : valorNum > gold
//                   ? 'Gold insuficiente'
//                   : `Fazer aposta · ${valorNum} gold`}
//               </button>
//             </div>
//           )}
//         </div>
//       )}
//     </div>
//   )
// }
