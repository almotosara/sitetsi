'use client'

import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'
import { getChatMessages, sendChatMessage, markChatRead, deleteChatMessageForMe, deleteChatMessageForEveryone, type ChatMessage } from '@/app/actions'

const CONSULTOR_ID = '00000000-0000-0000-0000-000000000001'
const OFICINA_ID = '00000000-0000-0000-0000-000000000002'

const EMOJIS = ['😀', '😂', '😍', '👍', '🙏', '🔥', '🎉', '😢', '😮', '🤔', '👏', '❤️', '✅', '❌', '🙌', '😅', '🚀', '💪', '😴', '🤝']

function formatDateSeparator(iso: string): string {
  const d = new Date(iso)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString()
  if (sameDay(d, today)) return 'Hoje'
  if (sameDay(d, yesterday)) return 'Ontem'
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
}

interface ChatPanelProps {
  open: boolean
  onClose: () => void
  myUserId: string
  myName: string
}

export function ChatPanel({ open, onClose, myUserId, myName }: ChatPanelProps) {
  const supabaseConfigured = isSupabaseConfigured()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [menuFor, setMenuFor] = useState<string | null>(null)
  const [emojiOpen, setEmojiOpen] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const otherUserId = myUserId === CONSULTOR_ID ? OFICINA_ID : CONSULTOR_ID
  const otherName = myUserId === CONSULTOR_ID ? 'Oficina' : 'Consultor'

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
    })
  }, [])

  // Carrega histórico + marca como lido ao abrir
  useEffect(() => {
    if (!open) return
    if (!supabaseConfigured) {
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    getChatMessages(myUserId)
      .then((msgs) => {
        if (cancelled) return
        setMessages(msgs)
        setLoading(false)
        scrollToBottom()
      })
      .catch(() => setLoading(false))
    markChatRead(otherUserId).catch(() => {})
    return () => { cancelled = true }
  }, [open, otherUserId, myUserId, scrollToBottom, supabaseConfigured])

  // Realtime: escuta novas mensagens de qualquer um dos dois lados
  useEffect(() => {
    if (!open || !supabaseConfigured) return
    const supabase = createClient()
    const channel = supabase
      .channel('chat_messages_realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages' },
        (payload) => {
          const msg = payload.new as ChatMessage
          if ((msg.apagada_para || []).includes(myUserId)) return
          setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]))
          scrollToBottom()
          if (msg.sender_id === otherUserId) markChatRead(otherUserId).catch(() => {})
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'chat_messages' },
        (payload) => {
          const msg = payload.new as ChatMessage
          if ((msg.apagada_para || []).includes(myUserId)) {
            setMessages((prev) => prev.filter((m) => m.id !== msg.id))
          } else {
            setMessages((prev) => prev.map((m) => (m.id === msg.id ? msg : m)))
          }
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [open, otherUserId, myUserId, scrollToBottom, supabaseConfigured])

  const handleSend = useCallback(async () => {
    if (!supabaseConfigured) return
    const trimmed = text.trim()
    if (!trimmed || sending) return
    setSending(true)
    setText('')
    const optimistic: ChatMessage = {
      id: `tmp-${Date.now()}`,
      sender_id: myUserId,
      texto: trimmed,
      criado_em: new Date().toISOString(),
      lido: false,
      apagada_para_todos: false,
      apagada_para: [],
    }
    setMessages((prev) => [...prev, optimistic])
    scrollToBottom()
    try {
      const saved = await sendChatMessage(myUserId, trimmed)
      setMessages((prev) => prev.map((m) => (m.id === optimistic.id ? saved : m)))
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id))
      setText(trimmed)
    } finally {
      setSending(false)
    }
  }, [text, sending, myUserId, scrollToBottom, supabaseConfigured])

  const handleDeleteForMe = useCallback(async (id: string) => {
    setMenuFor(null)
    setMessages((prev) => prev.filter((m) => m.id !== id))
    try {
      await deleteChatMessageForMe(id, myUserId)
    } catch {
      toastSilentFail()
    }
  }, [myUserId])

  const handleDeleteForEveryone = useCallback(async (id: string) => {
    setMenuFor(null)
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, apagada_para_todos: true } : m)))
    try {
      await deleteChatMessageForEveryone(id)
    } catch {
      toastSilentFail()
    }
  }, [])

  function toastSilentFail() {
    // Falha silenciosa: o realtime/próxima leitura corrige o estado se necessário.
  }

  const handleEmojiPick = useCallback((emoji: string) => {
    setText((prev) => prev + emoji)
    setEmojiOpen(false)
    inputRef.current?.focus()
  }, [])

  // Agrupa mensagens por dia para os separadores de data
  const groupedByDay = useMemo(() => {
    const groups: { dayKey: string; label: string; msgs: ChatMessage[] }[] = []
    messages.forEach((m) => {
      const dayKey = m.criado_em.slice(0, 10)
      const last = groups[groups.length - 1]
      if (last && last.dayKey === dayKey) {
        last.msgs.push(m)
      } else {
        groups.push({ dayKey, label: formatDateSeparator(m.criado_em), msgs: [m] })
      }
    })
    return groups
  }, [messages])

  if (!open) return null

  return (
    <>
      <div
        className="fixed inset-0 z-40"
        style={{ background: 'rgba(0,0,0,0.35)' }}
        onClick={onClose}
      />
      <div
        className="chat-panel fixed z-50 flex flex-col overflow-hidden glass-effect"
        style={{
          top: 76, right: 24, width: 360, height: 480,
          border: '1px solid var(--border-line)',
          borderRadius: 16, boxShadow: '0 20px 50px -12px rgba(0,0,0,0.5)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3 flex-shrink-0"
          style={{ borderBottom: '1px solid var(--border-line-soft)' }}
        >
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #d71920, #ef3a43)' }}
            >
              {otherName.charAt(0)}
            </div>
            <div>
              <div className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{otherName}</div>
              <div className="text-[10.5px]" style={{ color: 'var(--text-muted)' }}>Chat interno</div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center transition-colors hover:bg-[var(--sidebar-hover)]"
            style={{ color: 'var(--text-muted)' }}
            aria-label="Fechar chat"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* Mensagens */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-1" onClick={() => setMenuFor(null)}>
          {loading && (
            <div className="text-xs text-center mt-4" style={{ color: 'var(--text-muted)' }}>Carregando conversa…</div>
          )}
          {!loading && messages.length === 0 && (
            <div className="text-xs text-center mt-4" style={{ color: 'var(--text-muted)' }}>
              {supabaseConfigured
                ? `Nenhuma mensagem ainda. Diga oi para ${otherName}!`
                : 'Chat indisponível neste ambiente: configure as variáveis públicas do Supabase.'}
            </div>
          )}
          {groupedByDay.map((group) => (
            <div key={group.dayKey} className="flex flex-col gap-2">
              <div className="flex justify-center my-2">
                <span
                  className="text-[10.5px] font-semibold px-2.5 py-1 rounded-full"
                  style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}
                >
                  {group.label}
                </span>
              </div>
              {group.msgs.map((m) => {
                const mine = m.sender_id === myUserId
                const apagada = m.apagada_para_todos
                return (
                  <div key={m.id} className={`flex mb-1.5 ${mine ? 'justify-end' : 'justify-start'}`}>
                    <div className="relative max-w-[75%]" onClick={(e) => e.stopPropagation()}>
                      <div
                        className="px-3 py-2 rounded-2xl text-[13px] leading-snug break-words cursor-pointer select-none"
                        style={apagada
                          ? { background: 'var(--bg-elevated)', color: 'var(--text-muted)', fontStyle: 'italic', borderBottomRightRadius: mine ? 4 : 16, borderBottomLeftRadius: mine ? 16 : 4 }
                          : mine
                            ? { background: '#d71920', color: '#fff', borderBottomRightRadius: 4 }
                            : { background: 'var(--bg-elevated)', color: 'var(--text-primary)', borderBottomLeftRadius: 4 }}
                        onClick={() => !apagada && setMenuFor(menuFor === m.id ? null : m.id)}
                      >
                        {apagada ? '🚫 Mensagem apagada' : m.texto}
                        <div className="flex items-center gap-1 mt-1 justify-end opacity-70">
                          <span className="text-[9.5px]">
                            {new Date(m.criado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          {mine && !apagada && (
                            <svg width="14" height="10" viewBox="0 0 16 11" fill="none">
                              <path d="M1 5.5L4.5 9L11 1.5" stroke={m.lido ? '#6ec9ff' : 'currentColor'} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                              <path d="M5.5 5.5L9 9L15.5 1.5" stroke={m.lido ? '#6ec9ff' : 'currentColor'} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </div>
                      </div>

                      {/* Menu de contexto: apagar para mim / para todos */}
                      {menuFor === m.id && !apagada && (
                        <div
                          className="absolute z-10 mt-1 rounded-xl overflow-hidden shadow-lg"
                          style={{
                            [mine ? 'right' : 'left']: 0,
                            background: 'var(--bg-panel)', border: '1px solid var(--border-line)', minWidth: 170,
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => handleDeleteForMe(m.id)}
                            className="w-full text-left px-3.5 py-2.5 text-[12.5px] font-medium hover:bg-[var(--sidebar-hover)] transition-colors"
                            style={{ color: 'var(--text-primary)' }}
                          >
                            Apagar para mim
                          </button>
                          {mine && (
                            <button
                              type="button"
                              onClick={() => handleDeleteForEveryone(m.id)}
                              className="w-full text-left px-3.5 py-2.5 text-[12.5px] font-medium hover:bg-[var(--sidebar-hover)] transition-colors"
                              style={{ color: '#ff5a5f', borderTop: '1px solid var(--border-line-soft)' }}
                            >
                              Apagar para todos
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ))}
        </div>

        {/* Input */}
        <div
          className="flex items-center gap-2 px-3 py-3 flex-shrink-0 relative"
          style={{ borderTop: '1px solid var(--border-line-soft)' }}
        >
          {emojiOpen && (
            <div
              className="chat-emoji-picker absolute z-10 bottom-full mb-2 left-3 grid grid-cols-5 gap-1 p-2 rounded-xl shadow-lg"
              style={{ background: 'var(--bg-panel)', border: '1px solid var(--border-line)', width: 210 }}
            >
              {EMOJIS.map((em) => (
                <button
                  type="button"
                  key={em}
                  onClick={() => handleEmojiPick(em)}
                  className="chat-emoji-button text-lg w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[var(--sidebar-hover)] transition-colors"
                >
                  {em}
                </button>
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={() => setEmojiOpen((v) => !v)}
            disabled={!supabaseConfigured}
            className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-colors hover:bg-[var(--sidebar-hover)]"
            style={{ color: 'var(--text-muted)' }}
            title="Emojis"
            aria-label="Abrir seletor de emojis"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><path d="M8 14s1.5 2 4 2 4-2 4-2" /><line x1="9" y1="9" x2="9.01" y2="9" /><line x1="15" y1="9" x2="15.01" y2="9" />
            </svg>
          </button>
          <input
            ref={inputRef}
            disabled={!supabaseConfigured}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onFocus={() => setEmojiOpen(false)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
            placeholder={supabaseConfigured ? 'Escreva uma mensagem…' : 'Chat indisponível neste ambiente'}
            className="flex-1 px-3 py-2 rounded-full text-[13px] outline-none"
            style={{ background: 'var(--bg-input)', border: '1px solid var(--border-line)', color: 'var(--text-primary)' }}
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!supabaseConfigured || !text.trim() || sending}
            className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-transform disabled:opacity-40"
            style={{ background: '#d71920', color: '#fff' }}
            aria-label="Enviar mensagem"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/>
            </svg>
          </button>
        </div>
      </div>
    </>
  )
}
