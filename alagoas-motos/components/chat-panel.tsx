'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getChatMessages, sendChatMessage, markChatRead, type ChatMessage } from '@/app/actions'

const CONSULTOR_ID = '00000000-0000-0000-0000-000000000001'
const OFICINA_ID = '00000000-0000-0000-0000-000000000002'

interface ChatPanelProps {
  open: boolean
  onClose: () => void
  myUserId: string
  myName: string
}

export function ChatPanel({ open, onClose, myUserId, myName }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const scrollRef = useRef<HTMLDivElement>(null)
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
    let cancelled = false
    setLoading(true)
    getChatMessages()
      .then((msgs) => {
        if (cancelled) return
        setMessages(msgs)
        setLoading(false)
        scrollToBottom()
      })
      .catch(() => setLoading(false))
    markChatRead(otherUserId).catch(() => {})
    return () => { cancelled = true }
  }, [open, otherUserId, scrollToBottom])

  // Realtime: escuta novas mensagens de qualquer um dos dois lados
  useEffect(() => {
    if (!open) return
    const supabase = createClient()
    const channel = supabase
      .channel('chat_messages_realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages' },
        (payload) => {
          const msg = payload.new as ChatMessage
          setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]))
          scrollToBottom()
          if (msg.sender_id === otherUserId) markChatRead(otherUserId).catch(() => {})
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [open, otherUserId, scrollToBottom])

  const handleSend = useCallback(async () => {
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
  }, [text, sending, myUserId, scrollToBottom])

  if (!open) return null

  return (
    <>
      <div
        className="fixed inset-0 z-40"
        style={{ background: 'rgba(0,0,0,0.35)' }}
        onClick={onClose}
      />
      <div
        className="fixed z-50 flex flex-col overflow-hidden"
        style={{
          top: 76, right: 24, width: 360, height: 480,
          background: 'var(--bg-panel)', border: '1px solid var(--border-line)',
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
              style={{ background: 'linear-gradient(135deg, #0f7a5a, #16a34a)' }}
            >
              {otherName.charAt(0)}
            </div>
            <div>
              <div className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{otherName}</div>
              <div className="text-[10.5px]" style={{ color: 'var(--text-muted)' }}>Chat interno</div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center transition-colors hover:bg-[var(--sidebar-hover)]"
            style={{ color: 'var(--text-muted)' }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* Mensagens */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-2">
          {loading && (
            <div className="text-xs text-center mt-4" style={{ color: 'var(--text-muted)' }}>Carregando conversa…</div>
          )}
          {!loading && messages.length === 0 && (
            <div className="text-xs text-center mt-4" style={{ color: 'var(--text-muted)' }}>
              Nenhuma mensagem ainda. Diga oi para {otherName}!
            </div>
          )}
          {messages.map((m) => {
            const mine = m.sender_id === myUserId
            return (
              <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div
                  className="max-w-[75%] px-3 py-2 rounded-2xl text-[13px] leading-snug break-words"
                  style={mine
                    ? { background: '#0f7a5a', color: '#fff', borderBottomRightRadius: 4 }
                    : { background: 'var(--bg-elevated)', color: 'var(--text-primary)', borderBottomLeftRadius: 4 }}
                >
                  {m.texto}
                  <div
                    className="text-[9.5px] mt-1 opacity-70"
                    style={{ textAlign: 'right' }}
                  >
                    {new Date(m.criado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Input */}
        <div
          className="flex items-center gap-2 px-3 py-3 flex-shrink-0"
          style={{ borderTop: '1px solid var(--border-line-soft)' }}
        >
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
            placeholder="Escreva uma mensagem…"
            className="flex-1 px-3 py-2 rounded-full text-[13px] outline-none"
            style={{ background: 'var(--bg-input)', border: '1px solid var(--border-line)', color: 'var(--text-primary)' }}
          />
          <button
            onClick={handleSend}
            disabled={!text.trim() || sending}
            className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-transform disabled:opacity-40"
            style={{ background: '#0f7a5a', color: '#fff' }}
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
