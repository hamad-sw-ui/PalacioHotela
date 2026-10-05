"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

export type HeroSlide = { src: string; alt: string; href?: string; caption?: string };

const FALLBACK = "/images/palacio-hero.jpg";

export function HeroGallery({ slides, children, label, previousLabel = "Précédent", nextLabel = "Suivant", className = "" }: { slides: HeroSlide[]; children: ReactNode; label: string; previousLabel?: string; nextLabel?: string; className?: string }) {
  const photos = slides.length ? slides : [{ src: FALLBACK, alt: label }];
  const count = photos.length;
  const loop = count > 1;
  const extended = loop ? [photos[count - 1], ...photos, photos[0]] : photos;
  const [position, setPosition] = useState(loop ? 1 : 0);
  const [motion, setMotion] = useState(true);
  const [paused, setPaused] = useState(false);
  const [reduce, setReduce] = useState(false);
  const [touchX, setTouchX] = useState<number | null>(null);
  const positionRef = useRef(position);
  useEffect(() => { positionRef.current = position; }, [position]);
  const [veiled, setVeiled] = useState(false);
  const veilTimer = useRef<number | null>(null);
  useEffect(() => () => { if (veilTimer.current) window.clearTimeout(veilTimer.current); }, []);
  function veilText() {
    if (reduce) return;
    if (veilTimer.current) window.clearTimeout(veilTimer.current);
    setVeiled(true);
  }
  function unveilText() {
    if (reduce) { setVeiled(false); return; }
    if (veilTimer.current) window.clearTimeout(veilTimer.current);
    veilTimer.current = window.setTimeout(() => setVeiled(false), 5000);
  }
  function pressArrow(event: PointerEvent<HTMLButtonElement>) {
    veilText();
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* the title still veils if the pointer cannot be captured */ }
  }
  function releaseArrow() { unveilText(); }
  function pressArrowKey(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.repeat) return;
    if (event.key === "Enter" || event.key === " ") veilText();
  }
  function releaseArrowKey(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "Enter" || event.key === " ") unveilText();
  }
  const signature = photos.map((slide) => slide.src).join("|");

  useEffect(() => { setPosition(loop ? 1 : 0); setMotion(false); }, [signature, loop]);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduce(media.matches);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  const realIndex = loop ? ((position - 1) % count + count) % count : 0;
  const current = photos[realIndex];
  const step = (direction: number) => {
    if (!loop) return;
    setMotion(true);
    setPosition((value) => (value <= 0 || value >= count + 1 ? value : value + direction));
  };
  const settle = (event: React.TransitionEvent<HTMLDivElement>) => {
    if (event.propertyName !== "transform" || event.target !== event.currentTarget) return;
    const value = positionRef.current;
    if (value !== 0 && value !== count + 1) return;
    setMotion(false);
    setPosition(value === 0 ? count : 1);
  };

  useEffect(() => {
    if (!loop || paused || reduce) return;
    const timer = window.setInterval(() => step(1), 7000);
    return () => window.clearInterval(timer);
  }, [loop, paused, reduce, count, position]);

  return <section className={`page-hero hero-gallery ${loop ? "has-controls" : ""} ${className}`} tabIndex={loop ? 0 : undefined} aria-roledescription={loop ? "carousel" : undefined} aria-label={label} onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false); }} onKeyDown={(event) => { if (!loop) return; if (event.key === "ArrowRight") step(1); if (event.key === "ArrowLeft") step(-1); }} onTouchStart={(event) => setTouchX(event.changedTouches[0]?.clientX ?? null)} onTouchEnd={(event) => { if (touchX == null || !loop) return; const delta = (event.changedTouches[0]?.clientX ?? touchX) - touchX; if (delta > 40) step(-1); if (delta < -40) step(1); setTouchX(null); }}><div className={`hero-gallery-track ${motion && !reduce ? "" : "is-instant"}`} style={{ transform: `translateX(-${position * 100}%)` }} onTransitionEnd={settle} aria-hidden="true">{extended.map((slide, slideIndex) => <div className="hero-gallery-slide" key={`${slide.src}-${slideIndex}`} style={{ backgroundImage: `url("${slide.src}")` }}/>)}</div><div className={`container page-hero-inner${veiled ? " is-mist" : ""}`}>{children}{current?.caption && current.href && <Link className="hero-gallery-caption" href={current.href}>{current.caption}</Link>}</div>{loop && <div className="hero-gallery-controls"><button type="button" className="hero-gallery-arrow" onPointerDown={pressArrow} onPointerUp={releaseArrow} onPointerCancel={releaseArrow} onKeyDown={pressArrowKey} onKeyUp={releaseArrowKey} onClick={() => step(-1)} aria-label={previousLabel}><ChevronLeft size={20}/></button><button type="button" className="hero-gallery-arrow" onPointerDown={pressArrow} onPointerUp={releaseArrow} onPointerCancel={releaseArrow} onKeyDown={pressArrowKey} onKeyUp={releaseArrowKey} onClick={() => step(1)} aria-label={nextLabel}><ChevronRight size={20}/></button></div>}</section>;
}
