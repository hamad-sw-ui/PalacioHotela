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
  async function ask(value: string) {
    const question = value.trim(); if (!question || loading) return;
    const next: Message[] = [...messages, { role: "user", content: question }];
    setMessages(next); setInput(""); setLoading(true);
    try { const response = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: next.slice(-8), locale }) }); const data = await response.json(); setMessages([...next, { role: "assistant", content: data.reply || tr(locale, "Je suis momentanément indisponible. Contactez notre équipe sur WhatsApp.", "I'm temporarily unavailable. Please contact our team on WhatsApp.") }]); }
    catch { setMessages([...next, { role: "assistant", content: tr(locale, "Une erreur est survenue. Réessayez dans un instant.", "Something went wrong. Please try again shortly.") }]); }
    finally { setLoading(false); }
  }
  function submit(event: FormEvent) { event.preventDefault(); void ask(input); }
  return <div className="chat-root"><button className="chat-trigger" onClick={() => setOpen(!open)} aria-label={tr(locale, "Ouvrir l'assistant", "Open assistant")}>{open ? <X size={23}/> : <MessageCircle size={24}/>}<span className="chat-trigger-dot"/></button>{open && <div className="chat-panel"><div className="chat-head"><div className="chat-avatar"><Sparkles size={18}/></div><div><strong>{tr(locale, "Conciergerie Palacio", "Palacio Concierge")}</strong><small><span/> {tr(locale, "À votre écoute", "Here to help")}</small></div><button onClick={() => setOpen(false)} aria-label="Fermer"><X size={18}/></button></div><div className="chat-body"><div className="chat-greeting"><div className="chat-bot-icon"><Bot size={22}/></div><p>{tr(locale, "Bonjour et bienvenue au Palacio ! Je suis là pour vous aider à organiser un séjour, un événement ou une expérience sur mesure. ✨", "Hello and welcome to Palacio! I'm here to help plan a stay, event or tailored experience. ✨")}</p></div>{messages.map((m, i) => <div key={i} className={`chat-message ${m.role === "user" ? "chat-mine" : "chat-theirs"}`}>{m.content}</div>)}{loading && <div className="chat-message chat-theirs chat-typing">● ● ●</div>}{messages.length === 0 && <div className="chat-suggestions">{[tr(locale, "Voir les chambres", "Explore rooms"), tr(locale, "Organiser un événement", "Plan an event"), tr(locale, "Comment demander un devis ?", "How to request a quote?")].map((suggestion) => <button key={suggestion} onClick={() => ask(suggestion)}>{suggestion}</button>)}</div>}<div ref={bottom}/></div><form className="chat-form" onSubmit={submit}><input value={input} onChange={(e) => setInput(e.target.value)} placeholder={tr(locale, "Écrivez votre message...", "Type a message...")} maxLength={1000} aria-label="Message"/><button type="submit" disabled={!input.trim() || loading} aria-label="Envoyer"><Send size={18}/></button></form><div className="chat-footnote">{tr(locale, "Assistant virtuel · Notre équipe reste disponible", "Virtual assistant · Our team is here for you")}</div></div>}</div>;
}
