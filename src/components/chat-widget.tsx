"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Bot, MessageCircle, Send, Sparkles, X } from "lucide-react";
import { tr, useSite } from "@/components/site-shell";

type Message = { role: "user" | "assistant"; content: string };

export function ChatWidget() {
  const { locale } = useSite();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  useEffect(() => { bottom.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, open]);

  const hour = new Date().getHours();
  const greeting = locale === "en"
    ? (hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening")
    : (hour < 12 ? "Bonjour" : hour < 18 ? "Bon après-midi" : "Bonsoir");

  async function ask(value: string) {
    const question = value.trim(); if (!question || loading) return;
    const next: Message[] = [...messages, { role: "user", content: question }];
    setMessages(next); setInput(""); setLoading(true);
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next.slice(-8), locale }),
      });
      const data = await response.json();
      setMessages([...next, { role: "assistant", content: data.reply || tr(locale, "Je suis momentanément indisponible. Contactez notre équipe sur WhatsApp.", "I'm temporarily unavailable. Please contact our team on WhatsApp.") }]);
    } catch {
      setMessages([...next, { role: "assistant", content: tr(locale, "Une erreur est survenue. Réessayez dans un instant.", "Something went wrong. Please try again shortly.") }]);
    } finally {
      setLoading(false);
    }
  }
  function submit(event: FormEvent) { event.preventDefault(); void ask(input); }
  function contactHuman() {
    const msg = locale === "en" ? "Could you connect me with a human advisor, please?" : "Pourriez-vous me mettre en relation avec un conseiller humain, s'il vous plaît ?";
    void ask(msg);
  }

  const welcomeText = locale === "en"
    ? "Welcome to Palacio Hotel. I'm here to help you plan a stay, an event or a tailored experience."
    : "Bienvenue au Palacio Hotel. Je suis là pour vous aider à organiser un séjour, un événement ou une expérience sur mesure.";

  const humanLabel = locale === "en" ? "Talk to a human advisor" : "Parler à un conseiller humain";
  const roomLabel = locale === "en" ? "Explore rooms" : "Voir les chambres";
  const eventLabel = locale === "en" ? "Plan an event" : "Organiser un événement";
  const quoteLabel = locale === "en" ? "How to request a quote?" : "Comment demander un devis ?";

  return (
    <div className="chat-root">
      <button className="chat-trigger" onClick={() => setOpen(!open)} aria-label={tr(locale, "Ouvrir l'assistant", "Open assistant")}>
        {open ? <X size={23} /> : <MessageCircle size={24} />}
        <span className="chat-trigger-dot" />
      </button>
      {open && (
        <div className="chat-panel">
          <div className="chat-head">
            <div className="chat-avatar"><Sparkles size={18} /></div>
            <div>
              <strong>{tr(locale, "Conciergerie Palacio", "Palacio Concierge")}</strong>
              <small>{tr(locale, "À votre écoute", "Here to help")}</small>
            </div>
            <button onClick={() => setOpen(false)} aria-label="Fermer"><X size={18} /></button>
          </div>
          <div className="chat-body">
            <div className="chat-greeting">
              <div className="chat-bot-icon"><Bot size={22} /></div>
              <p>{greeting} ! {welcomeText}</p>
            </div>
            {messages.map((m, i) => (
              <div key={i} className={"chat-message " + (m.role === "user" ? "chat-mine" : "chat-theirs")}>{m.content}</div>
            ))}
            {loading && <div className="chat-message chat-theirs chat-typing">● ● ●</div>}
            {messages.length === 0 && (
              <div className="chat-suggestions">
                <button key="human" onClick={contactHuman} className="suggestion-human">{humanLabel}</button>
                <button key={roomLabel} onClick={() => ask(roomLabel)}>{roomLabel}</button>
                <button key={eventLabel} onClick={() => ask(eventLabel)}>{eventLabel}</button>
                <button key={quoteLabel} onClick={() => ask(quoteLabel)}>{quoteLabel}</button>
              </div>
            )}
            <div ref={bottom} />
          </div>
          <form className="chat-form" onSubmit={submit}>
            <input value={input} onChange={(e) => setInput(e.target.value)} placeholder={tr(locale, "Écrivez votre message...", "Type a message...")} maxLength={1000} aria-label="Message" />
            <button type="submit" disabled={!input.trim() || loading} aria-label="Envoyer"><Send size={18} /></button>
          </form>
          <div className="chat-footnote">{tr(locale, "Assistant virtuel · Notre équipe reste disponible", "Virtual assistant · Our team remains available")}</div>
        </div>
      )}
    </div>
  );
}
