"""
Local FastAPI inference server for plant disease classification.
Loads the trained MobileNetV3 model and exposes /predict.

Run:
  ml/.venv/Scripts/python.exe -m uvicorn server:app --host 127.0.0.1 --port 8008
  (from the ml/ directory)
"""
import io
import json
import os

import torch
import torch.nn.functional as F
from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
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


@app.get("/health")
def health():
    ready = os.path.exists(MODEL_PATH)
    return {"ok": True, "model_present": ready, "device": device}


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
