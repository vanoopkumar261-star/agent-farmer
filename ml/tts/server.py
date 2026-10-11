"""
Speech server for the AI assistant — Chatterbox Indic LoRA.

  POST /tts     {text, locale}  ->  audio/wav
  GET  /health

Why this is its own process, apart from ml/server.py (disease detection):
Chatterbox wants numpy<2 and a CUDA torch, and it holds a GPU model resident.
Keeping it separate means installing it can never break the disease classifier,
and in production the two can live on different machines (TTS_URL vs INFERENCE_URL).

Languages
  Chatterbox (reenigne314/chatterbox-indic-lora): en hi kn ta te mr bn
  MMS-TTS fallback:                               ml pa
    Malayalam is flagged experimental by the LoRA's author (CER 0.86 — mostly
    unintelligible) and Punjabi is not covered at all, so those two keep Meta's
    small MMS voices rather than serving garbled or no audio.

Licences: Chatterbox and the LoRA are MIT. The MMS checkpoints used for ml/pa are
CC-BY-NC 4.0 (non-commercial) — fine for the demo; revisit before selling.
The IndicTTS / Rasa training-data licences are not stated by the LoRA author.

Run (from ml/tts):
  .venv/Scripts/python.exe -m uvicorn server:app --host 127.0.0.1 --port 8009
"""
import io
import os
import re
import threading
import time
import wave
from collections import OrderedDict
from contextlib import asynccontextmanager

import numpy as np
import torch
from fastapi import FastAPI, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

device = "cuda" if torch.cuda.is_available() else "cpu"

# App locale -> Chatterbox language_id. Hindi voice speaks Hindi, etc.
CHATTERBOX_LANG = {
    "en": "en",
    "hi": "hi",
    "kn": "kn",
    "ta": "ta",
    "te": "te",
    "mr": "mr",
    "bn": "bn",
}

# Locales Chatterbox cannot speak well enough to ship.
MMS_MODELS = {
    "ml": "facebook/mms-tts-mal",
    "pa": "facebook/mms-tts-pan",
}

GENDER = os.environ.get("TTS_SPEAKER_GENDER", "female")  # female | male
# Pin the revision once a known-good one is chosen: best.pt is a pickle, so an
# unpinned repo is a supply-chain surface. e.g. TTS_LORA_REVISION=<commit sha>.
LORA_REVISION = os.environ.get("TTS_LORA_REVISION") or None

MAX_TTS_CHARS = 600  # the web route sends sentence-sized chunks; this is a backstop

# ── Making a model's prose speakable ─────────────────────────────────────────
#
# The assistant writes like a document, not like a person talking: "≈ 450‑500 mm
# (लगभग 4.5‑5 ली/मी²)". Measured, that one clause took 7.9s to synthesise and came
# out as 9.6s of audio, against 4.2s/3.5s for a plain sentence of the same length
# — the model spells symbols out at length, or stumbles over them. So symbols are
# turned into words (in the farmer's own language) or dropped before synthesis.
# This is also what stops ₹ and % being silently swallowed, which would turn a
# price into a bare number.
SPOKEN = {
    #        rupees        percent      degrees      decimal point
    "en": ("rupees", "percent", "degrees", "point"),
    "hi": ("रुपये", "प्रतिशत", "डिग्री", "दशमलव"),
    "mr": ("रुपये", "टक्के", "अंश", "दशांश"),
    "bn": ("টাকা", "শতাংশ", "ডিগ্রি", "দশমিক"),
    "ta": ("ரூபாய்", "சதவீதம்", "டிகிரி", "புள்ளி"),
    "te": ("రూపాయలు", "శాతం", "డిగ్రీలు", "పాయింట్"),
    "kn": ("ರೂಪಾಯಿ", "ಶೇಕಡಾ", "ಡಿಗ್ರಿ", "ಪಾಯಿಂಟ್"),
    "ml": ("രൂപ", "ശതമാനം", "ഡിഗ്രി", "പോയിന്റ്"),
    "pa": ("ਰੁਪਏ", "ਪ੍ਰਤੀਸ਼ਤ", "ਡਿਗਰੀ", "ਦਸ਼ਮਲਵ"),
}


def spell_numbers(text: str, locale: str) -> str:
    """Write numerals out as words, in the farmer's language.

    This is not cosmetic. Measured on this model, "यूरिया की कीमत 500 रुपये है।"
    came back from Whisper as "पांच हो रुबए है हाई और बीस पेशस से…" — the digits
    sent it rambling — while the identical sentence with "पाँच सौ" was read back
    perfectly. "32 डिग्री" was also heard as "30 से". An advisory app is full of
    prices, doses and temperatures, so a mangled number is a wrong instruction.
    """
    from indic_numtowords import num2words

    point = SPOKEN.get(locale, SPOKEN["en"])[3]

    def words(n: str) -> str:
        return num2words(int(n), lang=locale if locale in SPOKEN else "en")

    def one(m: re.Match) -> str:
        whole, frac = m.group(1).replace(",", ""), m.group(2)
        # Beyond a crore the words get unwieldy and are rarely what was meant
        # (an id, a pincode); leaving the digits alone is the safer failure.
        if len(whole) > 9:
            return m.group(0)
        try:
            out = words(whole)
            if frac:
                # Decimals are read digit by digit after the point, as people say them.
                out += " " + point + " " + " ".join(words(d) for d in frac)
            return out
        except Exception:  # noqa: BLE001
            return m.group(0)

    # A comma only counts as a digit group separator when digits follow it,
    # otherwise "450, 500" is read as one number and the pause is swallowed.
    return re.sub(r"(\d+(?:,\d+)*)(?:\.(\d+))?", one, text)


def speakable(text: str, locale: str) -> str:
    rupees, percent, degrees, _point = SPOKEN.get(locale, SPOKEN["en"])
    t = text
    # Indian languages put the unit after the amount, as English does here.
    t = re.sub(r"₹\s*([\d,.]+)", rf"\1 {rupees}", t)
    t = re.sub(r"([\d.]+)\s*%", rf"\1 {percent}", t)
    t = re.sub(r"([\d.]+)\s*°\s*[CF]?", rf"\1 {degrees}", t)
    # Super/subscripts are noise when spoken: unit powers ("मी²") and chemical
    # formulae the assistant likes to use ("P₂O₅", "K₂O") read better as letters.
    t = re.sub(r"[²³¹⁰-⁹₀-₉]", "", t)
    # A range (450‑500) becomes a pause rather than a word, since the right word
    # differs per language and a wrong one is worse than a comma.
    t = re.sub(r"(?<=\d)\s*[‐-―−-]\s*(?=\d)", ", ", t)
    t = re.sub(r"[‐-―−]", "-", t)  # any remaining dash
    t = re.sub(r"[≈~^|*_#<>=+\\]", " ", t)
    t = re.sub(r"\s*/\s*", " ", t)  # "ली/मी" reads as two words, not a slash
    # Last, so the symbol rules above still see digits ("₹500", "30%").
    t = spell_numbers(t, locale)
    return re.sub(r"\s+", " ", t).strip()

_lock = threading.Lock()  # one GPU job at a time; model.conds is shared state
_state = {"model": None, "conds": {}, "default_conds": None, "load_error": None, "loaded_at": None}
_mms = {}
_audio_cache = OrderedDict()
_CACHE_MAX = 64


def load_chatterbox():
    from chatterbox.mtl_tts import ChatterboxMultilingualTTS, Conditionals
    from huggingface_hub import snapshot_download

    t0 = time.time()
    lora_dir = snapshot_download("reenigne314/chatterbox-indic-lora", revision=LORA_REVISION)
    # A speaker name that does not exist leaves the base model's own default
    # voice in place (it prints a warning) — that is the English voice we want.
    model = ChatterboxMultilingualTTS.from_indic_lora(
        device=device, lora_dir=lora_dir, speaker="_base_default_"
    )
    _state["default_conds"] = model.conds
    for code in CHATTERBOX_LANG:
        if code == "en":
            continue
        f = os.path.join(lora_dir, "conds", f"{code}_{GENDER}.pt")
        if os.path.exists(f):
            _state["conds"][code] = Conditionals.load(f, map_location=device).to(device)
    _state["model"] = model
    _state["loaded_at"] = time.time()
    print(
        f"[tts] chatterbox ready on {device} in {time.time() - t0:.0f}s; "
        f"voices: {sorted(_state['conds'])} + en",
        flush=True,
    )


def synth_chatterbox(text: str, locale: str):
    model = _state["model"]
    conds = _state["default_conds"] if locale == "en" else _state["conds"].get(locale)
    if conds is None:
        raise RuntimeError(f"no speaker for {locale}")
    with _lock:
        model.conds = conds
        wav = model.generate(text, language_id=CHATTERBOX_LANG[locale])
    return wav, model.sr


def synth_mms(text: str, locale: str):
    from transformers import AutoTokenizer, VitsModel

    if locale not in _mms:
        model_id = MMS_MODELS[locale]
        tok = AutoTokenizer.from_pretrained(model_id)
        m = VitsModel.from_pretrained(model_id).eval().to(device)
        _mms[locale] = (tok, m)
        print(f"[tts] mms loaded: {locale}", flush=True)
    tok, m = _mms[locale]
    inputs = tok(text, return_tensors="pt").to(device)
    with _lock, torch.no_grad():
        wav = m(**inputs).waveform
    return wav, m.config.sampling_rate


def to_wav_bytes(waveform, sampling_rate: int) -> bytes:
    audio = waveform.squeeze().detach().float().cpu().numpy()
    audio = np.clip(audio, -1.0, 1.0)

    # Trim the dead air the model leaves at each end. A reply is spoken as
    # several chunks in a row, so without this the farmer hears a second of
    # silence at every sentence break.
    loud = np.flatnonzero(np.abs(audio) > 0.01)
    if loud.size:
        pad = int(0.05 * sampling_rate)
        audio = audio[max(0, loud[0] - pad) : min(len(audio), loud[-1] + pad)]

    pcm = (audio * 32767.0).astype(np.int16)
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(int(sampling_rate))
        w.writeframes(pcm.tobytes())
    return buf.getvalue()


@asynccontextmanager
async def lifespan(_app):
    # Load at startup, not on first request: the first farmer to tap the speaker
    # should not wait for a multi-gigabyte model to come off disk.
    def boot():
        try:
            load_chatterbox()
            # Warm the kernels so the first real request is not the slow one.
            synth_chatterbox("नमस्ते।", "hi")
            print("[tts] warm-up done", flush=True)
        except Exception as e:  # noqa: BLE001
            _state["load_error"] = repr(e)
            print(f"[tts] chatterbox failed to load: {e!r}", flush=True)

    threading.Thread(target=boot, daemon=True).start()
    yield


app = FastAPI(title="Agent Farmer — Speech", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


class TTSRequest(BaseModel):
    text: str
    locale: str = "en"


@app.post("/tts")
def tts(req: TTSRequest):
    locale = req.locale if (req.locale in CHATTERBOX_LANG or req.locale in MMS_MODELS) else "en"
    text = speakable((req.text or "")[:MAX_TTS_CHARS], locale)
    if not text:
        return Response(status_code=400, content="No text supplied.")

    key = f"{locale}:{text}"
    cached = _audio_cache.get(key)
    if cached is not None:
        _audio_cache.move_to_end(key)
        return Response(content=cached, media_type="audio/wav")

    try:
        if locale in MMS_MODELS:
            wav, sr = synth_mms(text, locale)
        else:
            if _state["model"] is None:
                # Still loading (or failed): the client treats 503 as "no voice yet".
                return Response(status_code=503, content="Speech model is still loading.")
            wav, sr = synth_chatterbox(text, locale)
        data = to_wav_bytes(wav, sr)
    except Exception as e:  # noqa: BLE001
        print(f"[tts] synthesis failed ({locale}): {e!r}", flush=True)
        return Response(status_code=503, content="Speech synthesis unavailable.")

    _audio_cache[key] = data
    if len(_audio_cache) > _CACHE_MAX:
        _audio_cache.popitem(last=False)
    return Response(content=data, media_type="audio/wav")


@app.get("/health")
def health():
    return {
        "ok": True,
        "device": device,
        "chatterbox_ready": _state["model"] is not None,
        "load_error": _state["load_error"],
        "chatterbox_locales": sorted(set(_state["conds"]) | ({"en"} if _state["model"] else set())),
        "mms_locales": sorted(MMS_MODELS),
        "vram_gb": round(torch.cuda.memory_allocated() / 1e9, 2) if device == "cuda" else None,
    }
