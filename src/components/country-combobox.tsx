"use client";

import { useMemo, useRef, useState } from "react";
import { countryOptions } from "@/lib/countries";

type Props = { value: string; onChange: (value: string) => void; locale: "fr" | "en"; required?: boolean; minLength?: number; placeholder?: string; id?: string };

/** Text input with a filtered country suggestion dropdown.
 *  Keeps free-text entry (same contract as a plain input): the dropdown only
 *  suggests, it never restricts. Matching is accent- and case-insensitive. */
export function CountryCombobox({ value, onChange, locale, required = false, minLength = 2, placeholder = "", id }: Props) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const listId = id ? `${id}-suggestions` : "country-suggestions";
  const skipClose = useRef(false);

  const suggestions = useMemo(() => {
    const options = countryOptions(locale);
    const query = value.trim().toLowerCase();
    const normalize = (text: string) => text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const needle = normalize(query);
    if (!needle) return options.slice(0, 8);
    return options.filter((option) => normalize(option).includes(needle)).slice(0, 8);
  }, [value, locale]);

  const choose = (country: string) => {
    skipClose.current = true;
    onChange(country);
    setOpen(false);
  };

  return (
    <div className="country-combobox" role="combobox" aria-expanded={open} aria-haspopup="listbox" aria-controls={listId}>
      <input
        id={id}
        required={required}
        minLength={minLength}
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        onChange={(event) => { onChange(event.target.value); setOpen(true); setHighlight(0); }}
        onFocus={() => setOpen(true)}
        onBlur={() => { if (skipClose.current) { skipClose.current = false; return; } setOpen(false); }}
        onKeyDown={(event) => {
          if (!open || suggestions.length === 0) return;
          if (event.key === "ArrowDown") { event.preventDefault(); setHighlight((current) => (current + 1) % suggestions.length); }
          else if (event.key === "ArrowUp") { event.preventDefault(); setHighlight((current) => (current - 1 + suggestions.length) % suggestions.length); }
          else if (event.key === "Enter" && open && suggestions[highlight]) { event.preventDefault(); choose(suggestions[highlight]); }
          else if (event.key === "Escape") setOpen(false);
        }}
      />
      {open && suggestions.length > 0 && (
        <ul className="country-combobox-list" id={listId} role="listbox" onMouseDown={(event) => event.preventDefault()}>
          {suggestions.map((country, index) => (
            <li key={country} role="option" aria-selected={index === highlight} className={index === highlight ? "active" : ""} onMouseEnter={() => setHighlight(index)} onMouseDown={(event) => { event.preventDefault(); choose(country); }}>
              {country}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
