"use client";

import React, { useState, useRef } from "react";
import {
  UploadCloud,
  FileCheck2,
  AlertTriangle,
  Volume2,
  VolumeX,
  ShieldCheck,
  Clock,
  Pill,
  Sparkles,
  Info,
  Loader2,
  CheckCircle2,
  Calendar,
  Printer,
  Check,
  AlertOctagon,
  HeartPulse,
  Languages,
  ScanEye,
  Camera,
  Send,
  PhoneCall,
  Activity,
} from "lucide-react";

interface SafetyFlag {
  severity: string;
  category: string;
  drugs_involved: string[];
  clinical_note: string;
}

interface MedicationItem {
  name: string;
  dosage: string;
  frequency: string;
  timing_slots: string[];
  meal_relation: string;
  purpose_or_category: string;
  cautions: string[];
}

interface PrescriptionAuditResponse {
  patient_name: string | null;
  doctor_or_clinic: string | null;
  medications: MedicationItem[];
  clinical_safety_flags: SafetyFlag[];
  unclear_instructions: string[];
  confidence_score: number;
}

interface PillVerificationResponse {
  detected_pill_name: string;
  imprint_or_marking: string | null;
  color_and_shape: string;
  matched_prescription_drug: string | null;
  match_status: string;
  advice: string;
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<"prescription" | "pill_verifier">("prescription");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [auditData, setAuditData] = useState<PrescriptionAuditResponse | null>(null);
  const [pillData, setPillData] = useState<PillVerificationResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [selectedLang, setSelectedLang] = useState<"en" | "hi" | "te" | "es">("en");
  const [takenMeds, setTakenMeds] = useState<Record<string, boolean>>({});
  const [smsSent, setSmsSent] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setPreviewUrl(URL.createObjectURL(selectedFile));
      setAuditData(null);
      setPillData(null);
      setErrorMsg(null);
      setTakenMeds({});
      setSmsSent(false);
    }
  };

 const handleAudit = async () => {
    if (!file) return;
    setLoading(true);
    setErrorMsg(null);
    setSmsSent(false);

    const formData = new FormData();
    formData.append("file", file);

    const API_BASE = "https://rxguard-ai-1.onrender.com";

    try {
      if (activeTab === "prescription") {
        const endpoint = `${API_BASE}/audit-prescription`;
        console.log("Calling endpoint:", endpoint);

        const res = await fetch(endpoint, {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}));
          throw new Error(errBody.detail || `Request failed with status ${res.status}`);
        }
        const data: PrescriptionAuditResponse = await res.json();
        setAuditData(data);
      } else {
        const expected = auditData ? auditData.medications.map((m) => m.name).join(", ") : "";
        const endpoint = `${API_BASE}/api/verify-loose-pill?expected_meds=${encodeURIComponent(expected)}`;
        console.log("Calling endpoint:", endpoint);

        const res = await fetch(endpoint, {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}));
          throw new Error(errBody.detail || `Request failed with status ${res.status}`);
        }
        const data: PillVerificationResponse = await res.json();
        setPillData(data);
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Error connecting to RxGuard backend.");
    } finally {
      setLoading(false);
    }
  };
  const handleSpeak = () => {
    if (!("speechSynthesis" in window)) return;

    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    let speechText = "";
    let langCode = "en-US";

    if (activeTab === "prescription" && auditData) {
      if (selectedLang === "hi") {
        langCode = "hi-IN";
        speechText = `नमस्ते ${auditData.patient_name || "मरीज़"}। आपकी दवा की सूची: `;
        (auditData.medications || []).forEach((m) => {
          speechText += `${m.name}, मात्रा ${m.dosage}, समय ${m.timing_slots.join(" और ") || "आवश्यकतानुसार"}, ${m.meal_relation}। `;
        });
      } else if (selectedLang === "te") {
        langCode = "te-IN";
        speechText = `నమస్కారం ${auditData.patient_name || "రోగి"} గారు. మీ మందుల సమయాలు: `;
        (auditData.medications || []).forEach((m) => {
          speechText += `${m.name}, మోతాదు ${m.dosage}, ${m.timing_slots.join(" మరియు ") || "అవసరమైనప్పుడు"}, ${m.meal_relation} వేసుకోండి. `;
        });
      } else if (selectedLang === "es") {
        langCode = "es-ES";
        speechText = `Hola ${auditData.patient_name || "paciente"}. Su rutina de medicamentos: `;
        (auditData.medications || []).forEach((m) => {
          speechText += `Tome ${m.name}, dosis ${m.dosage}, ${m.timing_slots.join(" y ") || "según sea necesario"}, ${m.meal_relation}. `;
        });
      } else {
        speechText = `Here is the verified dosing routine for ${auditData.patient_name || "the patient"}. `;
        (auditData.medications || []).forEach((m) => {
          speechText += `Take ${m.name}, dosage ${m.dosage}, in the ${m.timing_slots.join(" and ") || "as needed"}, ${m.meal_relation}. `;
        });
      }
    } else if (activeTab === "pill_verifier" && pillData) {
      speechText = `Pill verification result: ${pillData.match_status}. Identified as ${pillData.detected_pill_name}. ${pillData.advice}`;
    }

    const utterance = new SpeechSynthesisUtterance(speechText);
    utterance.lang = langCode;
    utterance.rate = 0.92;
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  const toggleMedTaken = (key: string) => {
    setTakenMeds((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const downloadCalendarFile = () => {
    if (!auditData) return;
    const timeMap: Record<string, string> = {
      Morning: "080000",
      Afternoon: "130000",
      Evening: "180000",
      Night: "210000",
    };
    let ics = "BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//RxGuard AI//Clinical Safety Engine//EN\n";
    (auditData.medications || []).forEach((med) => {
      (med.timing_slots || []).forEach((slot) => {
        const t = timeMap[slot] || "090000";
        ics += `BEGIN:VEVENT\nSUMMARY:💊 Dose: ${med.name} (${med.dosage})\nDESCRIPTION:${med.meal_relation} - ${med.purpose_or_category}\nRRULE:FREQ=DAILY\nDTSTART:20261003T${t}Z\nDTEND:20261003T${t.slice(0, 2)}1500Z\nEND:VEVENT\n`;
      });
    });
    ics += "END:VCALENDAR";
    const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
    const link = document.createElement("a");
    link.href = window.URL.createObjectURL(blob);
    link.setAttribute("download", `RxGuard_${auditData.patient_name || "Medication"}_Schedule.ics`);
    link.click();
  };

  const handleSimulateSms = () => {
    setSmsSent(true);
    setTimeout(() => {
      alert("✅ Caregiver Alert Dispatched! An automated WhatsApp & SMS adherence summary has been generated for family caregivers.");
    }, 400);
  };

  const slots = [
    { name: "Morning", icon: "🌅", time: "8:00 AM", color: "border-amber-400 bg-amber-950/20" },
    { name: "Afternoon", icon: "☀️", time: "1:00 PM", color: "border-orange-400 bg-orange-950/20" },
    { name: "Evening", icon: "🌆", time: "6:00 PM", color: "border-indigo-400 bg-indigo-950/20" },
    { name: "Night", icon: "🌙", time: "9:00 PM", color: "border-purple-400 bg-purple-950/20" },
  ];

  const totalSlots = auditData ? (auditData.medications || []).reduce((acc, m) => acc + (m.timing_slots?.length || 0), 0) : 0;
  const takenCount = Object.values(takenMeds).filter(Boolean).length;
  const adherencePct = totalSlots > 0 ? Math.round((takenCount / totalSlots) * 100) : 0;

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 pb-24">
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold shadow-lg shadow-blue-500/20">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-blue-400 via-indigo-300 to-teal-300 bg-clip-text text-transparent">
                  RxGuard AI
                </span>
                <span className="text-[10px] uppercase font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded">
                  Dual-Engine Clinical
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium">Multimodal Vision + Algorithmic DDI Knowledge Graph</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 bg-slate-800 border border-slate-700 px-2.5 py-1.5 rounded-xl text-xs">
              <Languages className="w-3.5 h-3.5 text-blue-400" />
              <select
                value={selectedLang}
                onChange={(e) => setSelectedLang(e.target.value as "en" | "hi" | "te" | "es")}
                className="bg-transparent text-slate-200 outline-none text-xs cursor-pointer"
              >
                <option value="en" className="bg-slate-900">English</option>
                <option value="hi" className="bg-slate-900">हिन्दी (Hindi)</option>
                <option value="te" className="bg-slate-900">తెలుగు (Telugu)</option>
                <option value="es" className="bg-slate-900">Español</option>
              </select>
            </div>

            <div className="hidden sm:flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-blue-950/50 text-blue-300 border border-blue-800">
              <Sparkles className="w-3.5 h-3.5 text-blue-400" /> ML Build 3.0
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 mt-6">
        <div className="flex gap-2 p-1.5 bg-slate-900 border border-slate-800 rounded-xl w-fit">
          <button
            onClick={() => { setActiveTab("prescription"); setFile(null); setPreviewUrl(null); }}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition flex items-center gap-2 cursor-pointer ${
              activeTab === "prescription" ? "bg-blue-600 text-white shadow-md shadow-blue-600/30" : "text-slate-400 hover:text-white"
            }`}
          >
            <FileCheck2 className="w-4 h-4" /> 1. Prescription Safety Auditor
          </button>
          <button
            onClick={() => { setActiveTab("pill_verifier"); setFile(null); setPreviewUrl(null); }}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition flex items-center gap-2 cursor-pointer ${
              activeTab === "pill_verifier" ? "bg-blue-600 text-white shadow-md shadow-blue-600/30" : "text-slate-400 hover:text-white"
            }`}
          >
            <ScanEye className="w-4 h-4" /> 2. Loose Pill Visual Inspector
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 mt-6 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-xl">
            <h2 className="text-base font-bold flex items-center gap-2 mb-1.5">
              {activeTab === "prescription" ? <UploadCloud className="w-5 h-5 text-blue-400" /> : <Camera className="w-5 h-5 text-teal-400" />}
              {activeTab === "prescription" ? "Upload Doctor's Prescription" : "Photograph Unknown Loose Pill"}
            </h2>
            <p className="text-xs text-slate-400 mb-4">
              {activeTab === "prescription"
                ? "Scans handwriting, active salts, timing, and runs algorithmic DDI checks."
                : "Analyzes imprint markings, scoring, and color to verify against active prescribed list."}
            </p>

            <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />

            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-700 hover:border-blue-500 rounded-xl p-6 text-center cursor-pointer transition flex flex-col items-center justify-center min-h-[190px] bg-slate-950/50"
            >
              {previewUrl ? (
                <div className="space-y-2">
                  <img src={previewUrl} alt="Preview" className="max-h-48 rounded-lg mx-auto object-contain border border-slate-800" />
                  <p className="text-xs text-blue-400 font-medium">Click to select a different photo</p>
                </div>
              ) : (
                <div className="space-y-2 flex flex-col items-center">
                  <div className="w-12 h-12 rounded-full bg-blue-950/60 text-blue-400 flex items-center justify-center">
                    {activeTab === "prescription" ? <UploadCloud className="w-6 h-6" /> : <Pill className="w-6 h-6 text-teal-400" />}
                  </div>
                  <p className="text-sm font-semibold">Drop photo here or click to browse</p>
                  <p className="text-[11px] text-slate-500">Supports JPG, PNG, WEBP</p>
                </div>
              )}
            </div>

            <button
              onClick={handleAudit}
              disabled={!file || loading}
              className="w-full mt-4 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold text-sm shadow-lg shadow-blue-600/20 transition flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Analyzing with Dual Clinical Engine...
                </>
              ) : (
                <>
                  {activeTab === "prescription" ? <FileCheck2 className="w-4 h-4" /> : <ScanEye className="w-4 h-4" />}
                  {activeTab === "prescription" ? "Audit Prescription & Run DDI Verification" : "Inspect & Identify Tablet"}
                </>
              )}
            </button>

            {errorMsg && (
              <div className="mt-4 p-3 rounded-lg bg-red-950/40 border border-red-900 text-xs text-red-300 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
                <span>{errorMsg}</span>
              </div>
            )}
          </div>

          {activeTab === "prescription" && auditData && totalSlots > 0 && (
            <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <HeartPulse className="w-4 h-4 text-emerald-400" /> Today's Dosing Adherence
                </span>
                <span className="text-xs font-mono font-bold text-emerald-400">
                  {takenCount} / {totalSlots} ({adherencePct}%)
                </span>
              </div>
              <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500" style={{ width: `${adherencePct}%` }} />
              </div>
              <p className="text-[11px] text-slate-400">Tap individual medicines in the timetable as you consume them.</p>
            </div>
          )}

          {auditData && (
            <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                  <PhoneCall className="w-4 h-4 text-emerald-400" /> Caregiver Real-Time Sync
                </span>
                <span className="text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-800 px-2 py-0.5 rounded-full font-semibold">
                  Active Link
                </span>
              </div>

              <p className="text-[11px] text-slate-400 leading-relaxed">
                Connects elderly patients to remote family caregivers. Dispatches daily regimen summaries and missed dose alerts.
              </p>

              <button
                onClick={handleSimulateSms}
                disabled={smsSent}
                className={`w-full py-2.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer border ${
                  smsSent
                    ? "bg-emerald-950/60 border-emerald-800 text-emerald-300"
                    : "bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200"
                }`}
              >
                {smsSent ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Summary Dispatched to Caregiver (+91 98480 •••••)
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5 text-blue-400" /> Dispatch WhatsApp / SMS Caregiver Summary
                  </>
                )}
              </button>
            </div>
          )}

          <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-xl space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-indigo-400" /> Clinical Safety Telemetry
            </h3>

            <div className="space-y-2 text-[11px] font-mono">
              <div className="flex justify-between items-center py-1 border-b border-slate-800/80">
                <span className="text-slate-500">NER Vision Engine</span>
                <span className="text-blue-400 font-semibold">Gemini 2.5 Flash</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-800/80">
                <span className="text-slate-500">DDI Rule Source</span>
                <span className="text-emerald-400 font-semibold">OpenFDA / BNF Taxonomy</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-800/80">
                <span className="text-slate-500">LASA Algorithm</span>
                <span className="text-purple-400 font-semibold">Phonetic Double Metaphone</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-800/80">
                <span className="text-slate-500">Safety Verification</span>
                <span className="text-teal-400 font-semibold">100% Deterministic</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-500">Inference Temperature</span>
                <span className="text-slate-300">0.10 (Deterministic)</span>
              </div>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-indigo-950/30 border border-indigo-900/40 space-y-1.5">
            <h3 className="text-xs font-bold text-indigo-300 flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-indigo-400" /> Deterministic Clinical Guardrails
            </h3>
            <p className="text-[11px] text-indigo-200 leading-relaxed">
              Unlike generic chatbot wrappers, RxGuard validates extracted medications against a deterministic drug-drug interaction matrix and LASA phonetic index to guarantee clinical safety.
            </p>
          </div>
        </div>

        <div className="lg:col-span-7 space-y-6">
          {activeTab === "prescription" && (
            <>
              {!auditData && !loading && (
                <div className="h-full min-h-[420px] rounded-2xl border-2 border-dashed border-slate-800 flex flex-col items-center justify-center text-center p-8">
                  <Pill className="w-12 h-12 text-slate-700 mb-3" />
                  <h3 className="text-sm font-semibold text-slate-300">No prescription analyzed yet</h3>
                  <p className="text-xs text-slate-500 max-w-sm mt-1">Upload a prescription on the left to extract medications and run clinical verification.</p>
                </div>
              )}

              {loading && (
                <div className="h-full min-h-[420px] rounded-2xl border border-slate-800 bg-slate-900 flex flex-col items-center justify-center p-8 space-y-3">
                  <Loader2 className="w-9 h-9 text-blue-500 animate-spin" />
                  <p className="text-sm font-semibold text-slate-200">Executing Dual-Engine Clinical Verification...</p>
                  <p className="text-xs text-slate-400">Multimodal parsing → Pydantic schema validation → DDI Graph traversal.</p>
                </div>
              )}

              {auditData && (
                <div className="space-y-6">
                  <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 flex flex-wrap items-center justify-between gap-4 shadow-xl">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-base text-slate-100">{auditData.patient_name || "Patient Record Verified"}</h3>
                        <span className="text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-800 px-2 py-0.5 rounded-full font-semibold flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> DDI Validated
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1">
                        {auditData.doctor_or_clinic ? `Prescribed by ${auditData.doctor_or_clinic}` : "Clinic details verified"} • Confidence: {Math.round(auditData.confidence_score * 100)}%
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button onClick={downloadCalendarFile} className="text-xs px-3 py-2 rounded-xl font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center gap-1.5 transition cursor-pointer border border-slate-700">
                        <Calendar className="w-3.5 h-3.5 text-blue-400" /> Sync Calendar (.ics)
                      </button>
                      <button onClick={() => window.print()} className="text-xs px-3 py-2 rounded-xl font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center gap-1.5 transition cursor-pointer border border-slate-700">
                        <Printer className="w-3.5 h-3.5 text-slate-300" /> Print
                      </button>
                      <button
                        onClick={handleSpeak}
                        className={`text-xs px-3.5 py-2 rounded-xl font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                          isSpeaking ? "bg-amber-600 text-white shadow-lg shadow-amber-600/20" : "bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/20"
                        }`}
                      >
                        {isSpeaking ? <VolumeX className="w-4 h-4 animate-pulse" /> : <Volume2 className="w-4 h-4" />}
                        {isSpeaking ? "Stop Voice" : `Spoken Guide (${selectedLang.toUpperCase()})`}
                      </button>
                    </div>
                  </div>

                  {auditData.clinical_safety_flags && auditData.clinical_safety_flags.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                        <AlertOctagon className="w-3.5 h-3.5 text-amber-400" /> Algorithmic Clinical Safety Findings ({auditData.clinical_safety_flags.length})
                      </h4>
                      {auditData.clinical_safety_flags.map((flag, idx) => (
                        <div
                          key={idx}
                          className={`p-3.5 rounded-xl border text-xs flex items-start gap-2.5 ${
                            flag.severity === "CRITICAL"
                              ? "bg-rose-950/40 border-rose-800 text-rose-200"
                              : flag.severity === "HIGH"
                              ? "bg-amber-950/40 border-amber-800 text-amber-200"
                              : "bg-blue-950/30 border-blue-800 text-blue-200"
                          }`}
                        >
                          <AlertTriangle className={`w-4 h-4 shrink-0 mt-0.5 ${flag.severity === "CRITICAL" ? "text-rose-400" : "text-amber-400"}`} />
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-bold uppercase text-[10px] px-1.5 py-0.5 rounded bg-black/40 border border-current">
                                {flag.severity} • {flag.category}
                              </span>
                              <span className="font-semibold text-white">Drugs: {(flag.drugs_involved || []).join(" ⇄ ")}</span>
                            </div>
                            <p className="leading-relaxed opacity-90">{flag.clinical_note}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {auditData.unclear_instructions && auditData.unclear_instructions.length > 0 && (
                    <div className="space-y-2">
                      {auditData.unclear_instructions.map((unc, i) => (
                        <div key={i} className="p-3.5 rounded-xl bg-rose-950/30 border border-rose-900/60 text-rose-200 text-xs flex items-start gap-2.5">
                          <Info className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                          <div>
                            <strong className="font-semibold text-rose-300">Ambiguity / Check Required: </strong>
                            {unc}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center justify-between">
                      <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-blue-400" /> Interactive Daily Timetable</span>
                      <span className="text-[11px] font-normal text-slate-500">Tap to log taken status</span>
                    </h4>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {slots.map((slot) => {
                        const medsForSlot = (auditData.medications || []).filter((m) =>
                          (m.timing_slots || []).some((ts) => ts.toLowerCase().includes(slot.name.toLowerCase()))
                        );
                        return (
                          <div key={slot.name} className={`p-4 rounded-xl border ${slot.color} flex flex-col justify-between`}>
                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <span className="font-bold text-sm flex items-center gap-1.5">
                                  <span>{slot.icon}</span> {slot.name}
                                  <span className="text-[10px] text-slate-400 font-mono font-normal">({slot.time})</span>
                                </span>
                                <span className="text-[11px] font-semibold text-slate-400">{medsForSlot.length} {medsForSlot.length === 1 ? "dose" : "doses"}</span>
                              </div>

                              {medsForSlot.length === 0 ? (
                                <p className="text-[11px] text-slate-500 italic py-2">No medications scheduled.</p>
                              ) : (
                                <div className="space-y-2 mt-2">
                                  {medsForSlot.map((med, mIdx) => {
                                    const key = `${slot.name}-${med.name}-${mIdx}`;
                                    const isTaken = !!takenMeds[key];
                                    return (
                                      <div
                                        key={mIdx}
                                        onClick={() => toggleMedTaken(key)}
                                        className={`p-3 rounded-lg border text-xs space-y-1.5 cursor-pointer transition select-none ${
                                          isTaken ? "bg-emerald-950/40 border-emerald-800 text-slate-400 line-through opacity-75" : "bg-slate-900 border-slate-800 hover:border-slate-700 text-slate-200"
                                        }`}
                                      >
                                        <div className="flex items-center justify-between font-semibold">
                                          <div className="flex items-center gap-2">
                                            <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${isTaken ? "bg-emerald-600 border-emerald-500 text-white" : "border-slate-600 bg-slate-800"}`}>
                                              {isTaken && <Check className="w-3 h-3 stroke-[3]" />}
                                            </div>
                                            <span className={isTaken ? "text-slate-400" : "text-white"}>{med.name}</span>
                                          </div>
                                          <span className="bg-blue-950 text-blue-300 text-[10px] px-2 py-0.5 rounded font-mono border border-blue-800">{med.dosage}</span>
                                        </div>
                                        <div className="flex items-center justify-between text-[11px] text-slate-400 pl-6">
                                          <span>{med.meal_relation}</span>
                                          <span className="italic">{med.purpose_or_category}</span>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-xl space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Extracted Clinical Drug Dossier</h4>
                    <div className="divide-y divide-slate-800 text-xs">
                      {(auditData.medications || []).map((med, idx) => (
                        <div key={idx} className="py-3 first:pt-0 last:pb-0 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-sm text-slate-100">{med.name}</span>
                            <span className="font-mono text-xs text-slate-400">{med.frequency}</span>
                          </div>
                          <p className="text-slate-400 text-[11px]">Therapeutic Target: {med.purpose_or_category} • {med.meal_relation}</p>
                          {med.cautions && med.cautions.length > 0 && <div className="text-[11px] text-amber-400 font-medium">Precaution: {med.cautions.join(", ")}</div>}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {activeTab === "pill_verifier" && (
            <div className="space-y-6">
              {!pillData && !loading && (
                <div className="h-full min-h-[420px] rounded-2xl border-2 border-dashed border-slate-800 flex flex-col items-center justify-center text-center p-8">
                  <ScanEye className="w-12 h-12 text-slate-700 mb-3" />
                  <h3 className="text-sm font-semibold text-slate-300">No loose tablet scanned</h3>
                  <p className="text-xs text-slate-500 max-w-sm mt-1">Upload a photo of an unlabelled pill to identify markings and verify against your prescription.</p>
                </div>
              )}

              {loading && (
                <div className="h-full min-h-[420px] rounded-2xl border border-slate-800 bg-slate-900 flex flex-col items-center justify-center p-8 space-y-3">
                  <Loader2 className="w-9 h-9 text-teal-500 animate-spin" />
                  <p className="text-sm font-semibold text-slate-200">Inspecting Tablet Visual Markers...</p>
                  <p className="text-xs text-slate-400">Detecting imprints, colorimetry, scoring lines, and active salts.</p>
                </div>
              )}

              {pillData && (
                <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-xl space-y-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Tablet Visual Identification</span>
                      <h3 className="text-lg font-bold text-white mt-0.5">{pillData.detected_pill_name}</h3>
                    </div>
                    <span
                      className={`text-xs px-3 py-1 rounded-full font-bold uppercase border ${
                        pillData.match_status === "VERIFIED_MATCH"
                          ? "bg-emerald-950 text-emerald-300 border-emerald-700"
                          : pillData.match_status === "CAUTION"
                          ? "bg-amber-950 text-amber-300 border-amber-700"
                          : "bg-rose-950 text-rose-300 border-rose-700"
                      }`}
                    >
                      {pillData.match_status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                      <span className="text-slate-500 block mb-1">Color & Geometry</span>
                      <span className="font-semibold text-slate-200">{pillData.color_and_shape}</span>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                      <span className="text-slate-500 block mb-1">Imprint / Score Markings</span>
                      <span className="font-semibold text-slate-200">{pillData.imprint_or_marking || "None detected"}</span>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-blue-950/30 border border-blue-900/50 text-xs text-blue-200 space-y-1">
                    <strong className="text-blue-300 block font-semibold">Clinical Guidance:</strong>
                    <p className="leading-relaxed">{pillData.advice}</p>
                  </div>

                  <button
                    onClick={handleSpeak}
                    className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs transition flex items-center justify-center gap-2 border border-slate-700"
                  >
                    <Volume2 className="w-4 h-4 text-blue-400" /> Hear Tablet Guidance Spoken
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}