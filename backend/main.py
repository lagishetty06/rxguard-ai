import io
import os
import json
import re
import time
import logging
from typing import List, Optional
from dotenv import load_dotenv
from fastapi import FastAPI, File, UploadFile, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from PIL import Image
from google import genai
from google.genai import types

load_dotenv()
logging.basicConfig(level=logging.INFO)

app = FastAPI(
    title="RxGuard Clinical Intelligence Engine",
    description="Deterministic DDI verification, LASA auditor, and multimodal prescription parser",
    version="2.5.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
client = genai.Client(api_key=GEMINI_API_KEY)

# Active supported models on Google AI Studio
ACTIVE_MODELS = ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-3.5-flash-lite"]

# =====================================================================
# 1. DETERMINISTIC CLINICAL SAFETY KNOWLEDGE BASE
# =====================================================================
CLINICAL_INTERACTION_GRAPH = {
    "metformin": {
        "alcohol": {"severity": "HIGH", "message": "Risk of severe lactic acidosis. Strict alcohol abstinence recommended."},
        "iodinated contrast": {"severity": "HIGH", "message": "Risk of acute renal failure. Withhold metformin 48h prior."}
    },
    "telmisartan": {
        "ibuprofen": {"severity": "HIGH", "message": "NSAIDs blunt antihypertensive efficacy and heighten acute nephrotoxicity risk."},
        "potassium": {"severity": "MODERATE", "message": "Increased risk of hyperkalemia. Serum potassium monitoring indicated."}
    },
    "aspirin": {
        "warfarin": {"severity": "CRITICAL", "message": "Synergistic anticoagulant activity. Severe hemorrhage risk."},
        "ibuprofen": {"severity": "MODERATE", "message": "Increased gastric mucosal ulceration and GI bleeding hazard."}
    },
    "atorvastatin": {
        "clarithromycin": {"severity": "HIGH", "message": "CYP3A4 inhibition elevates statin plasma concentration. Severe rhabdomyolysis risk."},
        "grapefruit": {"severity": "MODERATE", "message": "Substantial bioavailability surge. Restrict grapefruit juice intake."}
    },
    "paracetamol": {
        "alcohol": {"severity": "HIGH", "message": "Exacerbates hepatotoxicity risk via glutathione depletion."}
    }
}

KNOWN_LASA_PAIRS = [
    ("metformin", "metronidazole"),
    ("telmisartan", "olmesartan"),
    ("prednisone", "prednisolone"),
    ("celebrex", "celexa"),
    ("zyrtec", "zyprexa"),
    ("clonidine", "klonopin"),
    ("hydralazine", "hydroxyzine")
]

# =====================================================================
# 2. SCHEMAS
# =====================================================================
class SafetyFlag(BaseModel):
    severity: str
    category: str
    drugs_involved: List[str]
    clinical_note: str

class MedicationItem(BaseModel):
    name: str = ""
    dosage: str = ""
    frequency: str = ""
    timing_slots: List[str] = []
    meal_relation: str = "Not specified"
    purpose_or_category: str = "Medication"
    cautions: List[str] = []

class PrescriptionAuditResponse(BaseModel):
    patient_name: Optional[str] = None
    doctor_or_clinic: Optional[str] = None
    medications: List[MedicationItem] = []
    clinical_safety_flags: List[SafetyFlag] = []
    unclear_instructions: List[str] = []
    confidence_score: float = 0.98

class PillIdentificationResponse(BaseModel):
    detected_pill_name: str
    imprint_or_marking: Optional[str] = None
    color_and_shape: str
    matched_prescription_drug: Optional[str] = None
    match_status: str
    advice: str

def clean_json_text(raw_text: str) -> str:
    cleaned = raw_text.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\n?", "", cleaned)
        cleaned = re.sub(r"\n?```$", "", cleaned)
    return cleaned.strip()

# =====================================================================
# 3. DETERMINISTIC CLINICAL VERIFICATION
# =====================================================================
def run_deterministic_safety_audit(medications: List[MedicationItem]) -> List[SafetyFlag]:
    flags: List[SafetyFlag] = []
    med_names = [m.name.lower() for m in medications]

    for i in range(len(med_names)):
        for j in range(len(med_names)):
            if i == j:
                continue
            d1, d2 = med_names[i], med_names[j]
            for key, interactions in CLINICAL_INTERACTION_GRAPH.items():
                if key in d1:
                    for target, data in interactions.items():
                        if target in d2:
                            flags.append(SafetyFlag(
                                severity=data["severity"],
                                category="DDI (Drug-Drug Interaction)",
                                drugs_involved=[medications[i].name, medications[j].name],
                                clinical_note=data["message"]
                            ))

    for med in medications:
        m_lower = med.name.lower()
        for key, interactions in CLINICAL_INTERACTION_GRAPH.items():
            if key in m_lower:
                for target, data in interactions.items():
                    if target in ["alcohol", "grapefruit", "potassium"]:
                        flags.append(SafetyFlag(
                            severity=data["severity"],
                            category="LIFESTYLE / FOOD INTERACTION",
                            drugs_involved=[med.name, target.capitalize()],
                            clinical_note=data["message"]
                        ))

    for med in medications:
        m_name = med.name.lower()
        for pair1, pair2 in KNOWN_LASA_PAIRS:
            if pair1 in m_name:
                flags.append(SafetyFlag(
                    severity="MODERATE",
                    category="LASA RISK",
                    drugs_involved=[med.name, pair2.capitalize()],
                    clinical_note=f"High risk of pharmacist dispensing confusion with '{pair2.capitalize()}'."
                ))
            elif pair2 in m_name:
                flags.append(SafetyFlag(
                    severity="MODERATE",
                    category="LASA RISK",
                    drugs_involved=[med.name, pair1.capitalize()],
                    clinical_note=f"High risk of pharmacist dispensing confusion with '{pair1.capitalize()}'."
                ))

    unique_flags = []
    seen = set()
    for f in flags:
        k = (f.category, tuple(sorted(f.drugs_involved)), f.clinical_note)
        if k not in seen:
            seen.add(k)
            unique_flags.append(f)

    return unique_flags

# =====================================================================
# 4. ENDPOINTS
# =====================================================================
@app.get("/")
def root():
    return {"message": "RxGuard Clinical Engine v2.5 Online"}

@app.get("/api/health")
def health():
    return {
        "status": "online",
        "engine": "Dual Multimodal Vision + Algorithmic DDI Knowledge Graph",
        "supported_languages": ["en", "hi", "te", "es"]
    }

@app.post("/api/audit-prescription", response_model=PrescriptionAuditResponse)
async def audit_prescription(file: UploadFile = File(...)):
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Only image files are accepted")

    image_bytes = await file.read()
    pil_image = Image.open(io.BytesIO(image_bytes))

    prompt = (
        "You are an expert hospital clinical pharmacologist. Parse this medical prescription image.\n"
        "Return ONLY a strictly valid JSON object matching this schema:\n"
        "{\n"
        '  "patient_name": "string or null",\n'
        '  "doctor_or_clinic": "string or null",\n'
        '  "medications": [\n'
        "    {\n"
        '      "name": "Generic or brand medicine name",\n'
        '      "dosage": "Strength e.g. 500mg, 40mg",\n'
        '      "frequency": "Frequency e.g. Twice Daily, Once Daily",\n'
        '      "timing_slots": ["Morning", "Afternoon", "Evening", "Night"],\n'
        '      "meal_relation": "Before Food | After Food | With Food | Not specified",\n'
        '      "purpose_or_category": "Clinical condition or drug class",\n'
        '      "cautions": ["cautions or warnings"]\n'
        "    }\n"
        "  ],\n"
        '  "clinical_safety_flags": [],\n'
        '  "unclear_instructions": ["Any illegible or ambiguous notes, else empty"],\n'
        '  "confidence_score": 0.98\n'
        "}\n"
        "Do not output any markdown text outside the JSON."
    )

    last_error = None
    for model_name in ACTIVE_MODELS:
        for attempt in range(2):
            try:
                logging.info(f"Trying model: {model_name} (attempt {attempt + 1})")
                response = client.models.generate_content(
                    model=model_name,
                    contents=[pil_image, prompt],
                    config=types.GenerateContentConfig(
                        response_mime_type="application/json",
                        temperature=0.1,
                    ),
                )
                raw_text = clean_json_text(response.text)
                parsed_dict = json.loads(raw_text)
                parsed = PrescriptionAuditResponse.model_validate(parsed_dict)
                
                # Deterministic Algorithmic Safety Check
                deterministic_flags = run_deterministic_safety_audit(parsed.medications)
                parsed.clinical_safety_flags.extend(deterministic_flags)

                return parsed
            except Exception as e:
                logging.warning(f"Model {model_name} attempt {attempt + 1} failed: {e}")
                last_error = e
                time.sleep(1)

    raise HTTPException(status_code=500, detail=f"All models failed. Last error: {str(last_error)}")


@app.post("/api/verify-loose-pill", response_model=PillIdentificationResponse)
async def verify_loose_pill(file: UploadFile = File(...), expected_meds: str = Query("")):
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Please upload a valid image")

    image_bytes = await file.read()
    pil_image = Image.open(io.BytesIO(image_bytes))

    prompt = (
        f"You are a pharmaceutical vision inspector. Examine this loose pill/tablet/capsule.\n"
        f"Active patient prescription contains: [{expected_meds}].\n"
        "Return ONLY a strictly valid JSON object matching this schema:\n"
        "{\n"
        '  "detected_pill_name": "Name of the tablet or unidentified",\n'
        '  "imprint_or_marking": "Imprint text, code, or score line",\n'
        '  "color_and_shape": "Color and shape e.g. White circular biconvex",\n'
        '  "matched_prescription_drug": "Matching prescription medicine or null",\n'
        '  "match_status": "VERIFIED_MATCH | CAUTION | UNRECOGNIZED",\n'
        '  "advice": "Actionable patient safety advice"\n'
        "}\n"
        "Do not output any markdown text outside the JSON."
    )

    for model_name in ACTIVE_MODELS:
        try:
            response = client.models.generate_content(
                model=model_name,
                contents=[pil_image, prompt],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    temperature=0.1,
                ),
            )
            raw_text = clean_json_text(response.text)
            parsed_dict = json.loads(raw_text)
            return PillIdentificationResponse.model_validate(parsed_dict)
        except Exception:
            continue

    raise HTTPException(status_code=500, detail="Pill identification failed.")
