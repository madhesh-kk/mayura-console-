import { useCallback, useEffect, useMemo, useState } from "react";
import type { InventoryItem, Order } from "@/lib/firebase";

type AlertTone = "order" | "low-stock" | "reminder";

function beep() {
  try {
    const AudioContextClass = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const context = new AudioContextClass();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(740, context.currentTime);
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.18, context.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.22);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.24);
    window.setTimeout(() => void context.close(), 400);
  } catch {
    // Browsers can block AudioContext until the first user gesture.
  }
}

function speak(text: string, tone: AlertTone) {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "ta-IN";
  const tamilVoice = window.speechSynthesis
    .getVoices()
    .find((voice) => voice.lang.toLowerCase() === "ta-in" || voice.lang.toLowerCase().startsWith("ta-"));
  if (tamilVoice) utterance.voice = tamilVoice;
  utterance.rate = tone === "low-stock" ? 0.84 : 0.9;
  utterance.pitch = 1;
  window.speechSynthesis.speak(utterance);
}

export function useTamilAlerts({
  pendingOrders,
  reminderOrders,
  lowStock,
}: {
  pendingOrders: Order[];
  reminderOrders: Order[];
  lowStock: InventoryItem[];
}) {
  const [enabled, setEnabled] = useState(false);
  const pendingKey = useMemo(() => pendingOrders.map((order) => order.id).join(","), [pendingOrders]);
  const reminderKey = useMemo(() => reminderOrders.map((order) => order.id).join(","), [reminderOrders]);
  const lowStockKey = useMemo(() => lowStock.map((item) => item.itemName).join(","), [lowStock]);

  const announce = useCallback((text: string, tone: AlertTone) => {
    beep();
    speak(text, tone);
  }, []);

  const enable = useCallback(() => {
    setEnabled(true);
    beep();
    speak("ஒலி அறிவிப்புகள் இயக்கப்பட்டன", "order");
  }, []);

  useEffect(() => {
    if (!enabled || pendingOrders.length === 0) return;
    const order = pendingOrders[0];
    announce(`${order.itemName} ${order.quantity} கேஸ் ஆர்டர் வந்துள்ளது, தயவுசெய்து உறுதிப்படுத்தவும்`, "order");
    const interval = window.setInterval(() => {
      const current = pendingOrders[0];
      if (current) announce(`${current.itemName} ஆர்டர் இன்னும் உறுதிப்படுத்தப்படவில்லை`, "order");
    }, 12000);
    return () => window.clearInterval(interval);
  }, [announce, enabled, pendingKey]);

  useEffect(() => {
    if (!enabled || reminderOrders.length === 0) return;
    const order = reminderOrders[0];
    announce(`${order.itemName} ஆர்டர் பெறப்படவில்லை, தயவுசெய்து Shop 1-ஐ தொடர்பு கொள்ளவும்`, "reminder");
    const interval = window.setInterval(() => {
      const current = reminderOrders[0];
      if (current) announce(`${current.itemName} பெறுதல் நினைவூட்டல்`, "reminder");
    }, 12000);
    return () => window.clearInterval(interval);
  }, [announce, enabled, reminderKey]);

  useEffect(() => {
    if (!enabled || lowStock.length === 0) return;
    const item = lowStock[0];
    announce(`${item.itemName} இருப்பு குறைவாக உள்ளது, தயவுசெய்து நிரப்பவும்`, "low-stock");
    const interval = window.setInterval(() => {
      const current = lowStock[0];
      if (current) announce(`${current.itemName} இருப்பு குறைவாக உள்ளது`, "low-stock");
    }, 180000);
    return () => window.clearInterval(interval);
  }, [announce, enabled, lowStockKey]);

  useEffect(() => () => window.speechSynthesis?.cancel(), []);

  return { enabled, enable, announce };
}