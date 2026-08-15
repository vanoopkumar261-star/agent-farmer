"""
Local FastAPI inference server.

  /predict  plant disease classification (MobileNetV3)
  /tts      speech synthesis for the AI assistant (Meta MMS-TTS)

Run:
  ml/.venv/Scripts/python.exe -m uvicorn server:app --host 127.0.0.1 --port 8008
  (from the ml/ directory)
"""
import io
import json
import os
import wave
from collections import OrderedDict

import numpy as np
import torch
import torch.nn.functional as F
from fastapi import FastAPI, File, Response, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
from pydantic import BaseModel
from torchvision import transforms
from torchvision.models import mobilenet_v3_large

MODEL_PATH = os.environ.get("MODEL_PATH", "models/plant_disease.pt")

app = FastAPI(title="Agent Farmer — Disease Inference")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

device = "cuda" if torch.cuda.is_available() else "cpu"
_model = None
_classes = []
_tf = None


def load_model():
    global _model, _classes, _tf
    if _model is not None:
        return
    ckpt = torch.load(MODEL_PATH, map_location=device)
    _classes = ckpt["classes"]
    img = ckpt.get("img", 224)
    model = mobilenet_v3_large(weights=None)
    in_feats = model.classifier[3].in_features
    model.classifier[3] = torch.nn.Linear(in_feats, len(_classes))
    model.load_state_dict(ckpt["state_dict"])
    model.eval().to(device)
    _model = model
    _tf = transforms.Compose([
        transforms.Resize((img, img)),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
    ])
    print(f"[server] model loaded: {len(_classes)} classes on {device}", flush=True)


def pretty(label: str):
    # "Tomato___Late_blight" -> ("Tomato", "Late blight")
    parts = label.split("___")
    crop = parts[0].replace("_", " ").strip()
    disease = (parts[1] if len(parts) > 1 else "healthy").replace("_", " ").strip()
    return crop, disease


# ── Text to speech ───────────────────────────────────────────────────────────
#
# Why this lives here rather than in a cloud API: the browser can only speak
# languages whose voices are installed on the device, and on desktop Windows
# seven of the app's nine languages have none. Bhashini would have solved it but
# registration was a dead end, so we serve the voices ourselves.
#
# Meta's MMS-TTS checkpoints are small (36.3M params, ~145MB) and synthesise
# faster than real time on CPU — measured 1.7s to produce 3.3s of Tamil audio.
# All nine languages were checked for `tokenizer.is_uroman`; every one is False,
# so native script goes straight in with no romanisation step.
#
# LICENCE: these checkpoints are CC-BY-NC 4.0 — non-commercial. Fine for the
# hackathon demo. Before this is ever sold, swap TTS_MODELS to Apache-2.0
# `ai4bharat/indic-parler-tts`, which covers the same languages.
TTS_MODELS = {
    "en": "facebook/mms-tts-eng",
    "hi": "facebook/mms-tts-hin",
    "kn": "facebook/mms-tts-kan",
    "ta": "facebook/mms-tts-tam",
    "te": "facebook/mms-tts-tel",
    "ml": "facebook/mms-tts-mal",
    "mr": "facebook/mms-tts-mar",
    "bn": "facebook/mms-tts-ben",
    "pa": "facebook/mms-tts-pan",
}

MAX_TTS_CHARS = 1200

# Loaded on first use per language, then kept. Loading all nine up front would
# cost ~1.3GB and slow startup for a feature many sessions never touch.
_tts_models = {}
# Bounded cache of finished audio. The voice loop replays identical replies
# often, and re-synthesising them is pure waste.
_tts_audio_cache = OrderedDict()
_TTS_CACHE_MAX = 32


def load_tts(locale: str):
    if locale in _tts_models:
        return _tts_models[locale]
    model_id = TTS_MODELS[locale]
    # Imported lazily so /predict still works if transformers isn't installed.
    from transformers import AutoTokenizer, VitsModel

    tokenizer = AutoTokenizer.from_pretrained(model_id)
    model = VitsModel.from_pretrained(model_id)
    model.eval().to(device)
    _tts_models[locale] = (tokenizer, model)
    print(f"[server] tts loaded: {locale} ({model_id}) on {device}", flush=True)
    return _tts_models[locale]


def to_wav_bytes(waveform, sampling_rate: int) -> bytes:
    """VITS emits a float waveform; browsers want a real WAV container.

    Written with the stdlib `wave` module rather than pulling in scipy or
    soundfile just to add a 44-byte header.
    """
    audio = waveform.squeeze().detach().cpu().numpy()
    audio = np.clip(audio, -1.0, 1.0)
    pcm = (audio * 32767.0).astype(np.int16)

    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)  # 16-bit
        w.setframerate(sampling_rate)
        w.writeframes(pcm.tobytes())
    return buf.getvalue()


class TTSRequest(BaseModel):
    text: str
    locale: str = "en"


@app.post("/tts")
def tts(req: TTSRequest):
    locale = req.locale if req.locale in TTS_MODELS else "en"
    text = (req.text or "").strip()[:MAX_TTS_CHARS]
    if not text:
        return Response(status_code=400, content="No text supplied.")

    key = f"{locale}:{text}"
    cached = _tts_audio_cache.get(key)
    if cached is not None:
        _tts_audio_cache.move_to_end(key)
        return Response(content=cached, media_type="audio/wav")

    try:
        tokenizer, model = load_tts(locale)
        inputs = tokenizer(text, return_tensors="pt").to(device)
        with torch.no_grad():
            waveform = model(**inputs).waveform
        data = to_wav_bytes(waveform, model.config.sampling_rate)
    except Exception as e:
        print(f"[server] tts failed ({locale}): {e}", flush=True)
        # 503 rather than 500 — the client treats this as "fall back quietly".
        return Response(status_code=503, content="Speech synthesis unavailable.")

    _tts_audio_cache[key] = data
    if len(_tts_audio_cache) > _TTS_CACHE_MAX:
        _tts_audio_cache.popitem(last=False)

    return Response(content=data, media_type="audio/wav")


@app.get("/health")
def health():
    ready = os.path.exists(MODEL_PATH)
    return {
        "ok": True,
        "model_present": ready,
        "device": device,
        "tts_languages": sorted(TTS_MODELS.keys()),
        "tts_loaded": sorted(_tts_models.keys()),
    }


@app.post("/predict")
async def predict(file: UploadFile = File(...)):
    load_model()
    raw = await file.read()
    img = Image.open(io.BytesIO(raw)).convert("RGB")
    x = _tf(img).unsqueeze(0).to(device)
    with torch.no_grad():
        logits = _model(x)
        probs = F.softmax(logits, dim=1)[0]
    top = torch.topk(probs, k=min(3, len(_classes)))
    results = []
    for score, idx in zip(top.values.tolist(), top.indices.tolist()):
        crop, disease = pretty(_classes[idx])
        results.append({
            "label": _classes[idx],
            "crop": crop,
            "disease": disease,
            "confidence": round(float(score), 4),
            "healthy": disease.lower() == "healthy",
        })
    return {"top": results, "best": results[0]}


if __name__ == "__main__":
    import uvicorn
    load_model()
    uvicorn.run(app, host="127.0.0.1", port=8008)
