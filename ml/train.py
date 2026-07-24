"""
Transfer-learning trainer for plant disease classification (MobileNetV3-Large).
Trains on PlantVillage (ImageFolder layout), saves best model + labels.

Usage:
  ml/.venv/Scripts/python.exe ml/train.py --data ml/data/plantvillage --epochs 6
"""
import argparse
import json
import os
import time
from pathlib import Path

import torch
import torch.nn as nn
from torch.utils.data import DataLoader, random_split
from torchvision import datasets, transforms
from torchvision.models import mobilenet_v3_large, MobileNet_V3_Large_Weights


def build_loaders(data_dir: str, img_size: int, batch: int):
    weights = MobileNet_V3_Large_Weights.IMAGENET1K_V2
    norm = weights.transforms()  # matches pretrained normalization

    train_tf = transforms.Compose([
        transforms.Resize((img_size, img_size)),
        transforms.RandomHorizontalFlip(),
        transforms.RandomRotation(15),
        transforms.ColorJitter(0.2, 0.2, 0.2),
        transforms.ToTensor(),
        transforms.Normalize(mean=norm.mean, std=norm.std),
    ])
    eval_tf = transforms.Compose([
        transforms.Resize((img_size, img_size)),
        transforms.ToTensor(),
        transforms.Normalize(mean=norm.mean, std=norm.std),
    ])

    full = datasets.ImageFolder(data_dir)
    n_val = int(len(full) * 0.15)
    n_train = len(full) - n_val
    g = torch.Generator().manual_seed(42)
    train_set, val_set = random_split(full, [n_train, n_val], generator=g)
    # apply transforms per split
    train_set.dataset = datasets.ImageFolder(data_dir, transform=train_tf)
    val_set.dataset = datasets.ImageFolder(data_dir, transform=eval_tf)

    train_loader = DataLoader(train_set, batch_size=batch, shuffle=True, num_workers=4, pin_memory=True)
    val_loader = DataLoader(val_set, batch_size=batch, shuffle=False, num_workers=4, pin_memory=True)
    return train_loader, val_loader, full.classes


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", required=True)
    ap.add_argument("--epochs", type=int, default=6)
    ap.add_argument("--batch", type=int, default=64)
    ap.add_argument("--img", type=int, default=224)
    ap.add_argument("--out", default="ml/models")
    args = ap.parse_args()

    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"[train] device={device} ({torch.cuda.get_device_name(0) if device=='cuda' else 'CPU'})", flush=True)

    train_loader, val_loader, classes = build_loaders(args.data, args.img, args.batch)
    print(f"[train] classes={len(classes)} train_batches={len(train_loader)} val_batches={len(val_loader)}", flush=True)

    weights = MobileNet_V3_Large_Weights.IMAGENET1K_V2
    model = mobilenet_v3_large(weights=weights)
    in_feats = model.classifier[3].in_features
    model.classifier[3] = nn.Linear(in_feats, len(classes))
    model = model.to(device)

    criterion = nn.CrossEntropyLoss()
    optimizer = torch.optim.AdamW(model.parameters(), lr=3e-4, weight_decay=1e-4)
    scaler = torch.cuda.amp.GradScaler(enabled=(device == "cuda"))

    Path(args.out).mkdir(parents=True, exist_ok=True)
    best_acc = 0.0

    for epoch in range(1, args.epochs + 1):
        model.train()
        t0 = time.time()
        running = 0.0
        for i, (x, y) in enumerate(train_loader):
            x, y = x.to(device, non_blocking=True), y.to(device, non_blocking=True)
            optimizer.zero_grad()
            with torch.cuda.amp.autocast(enabled=(device == "cuda")):
                out = model(x)
                loss = criterion(out, y)
            scaler.scale(loss).backward()
            scaler.step(optimizer)
            scaler.update()
            running += loss.item()
            if i % 20 == 0:
                print(f"[train] epoch {epoch} step {i}/{len(train_loader)} loss={loss.item():.3f}", flush=True)

        # validate
        model.eval()
        correct = total = 0
        with torch.no_grad():
            for x, y in val_loader:
                x, y = x.to(device), y.to(device)
                out = model(x)
                correct += (out.argmax(1) == y).sum().item()
                total += y.size(0)
        acc = correct / max(1, total)
        print(f"[train] epoch {epoch} done in {time.time()-t0:.0f}s val_acc={acc:.4f}", flush=True)

        if acc > best_acc:
            best_acc = acc
            torch.save({"state_dict": model.state_dict(), "classes": classes, "img": args.img},
                       os.path.join(args.out, "plant_disease.pt"))
            with open(os.path.join(args.out, "labels.json"), "w") as f:
                json.dump(classes, f, indent=2)
            print(f"[train] saved best (acc={acc:.4f})", flush=True)

    print(f"[train] DONE best_acc={best_acc:.4f}", flush=True)


if __name__ == "__main__":
    main()
