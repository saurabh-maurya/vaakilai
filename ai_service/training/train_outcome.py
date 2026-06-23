"""
DistilBERT fine-tuning script for Indian case outcome prediction.
Runs on CPU — use small batch sizes and few epochs.

Usage:
  cd ai_service
  python training/train_outcome.py --data_path ./data/cases/outcomes.jsonl --output_dir ./models/outcome_classifier

Dataset format (outcomes.jsonl) — one JSON per line:
  {"text": "case facts...", "label": "Allowed"}
  {"text": "case facts...", "label": "Dismissed"}

After training, push to HF Hub and set HF_PREDICTION_MODEL in .env.
"""

import argparse
import json
import logging
import os

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

LABELS = ["Allowed", "Dismissed", "Partly Allowed", "Settled", "Remanded"]
LABEL2ID = {l: i for i, l in enumerate(LABELS)}
ID2LABEL = {i: l for i, l in enumerate(LABELS)}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--data_path", default="./data/cases/outcomes.jsonl")
    parser.add_argument("--output_dir", default="./models/outcome_classifier")
    parser.add_argument("--model_name", default="distilbert-base-uncased")
    parser.add_argument("--epochs", type=int, default=3)
    parser.add_argument("--batch_size", type=int, default=8)  # small for CPU
    parser.add_argument("--max_length", type=int, default=256)
    parser.add_argument("--hf_push", action="store_true", help="Push to HuggingFace Hub after training")
    parser.add_argument("--hf_repo_id", default="", help="HF repo id e.g. yourname/vakilai-outcome-classifier")
    args = parser.parse_args()

    try:
        from transformers import (
            AutoTokenizer,
            AutoModelForSequenceClassification,
            TrainingArguments,
            Trainer,
            DataCollatorWithPadding,
        )
        from datasets import Dataset
        import torch
        import numpy as np
        from sklearn.metrics import accuracy_score, f1_score
    except ImportError:
        logger.error("Install training deps: pip install transformers datasets scikit-learn torch --index-url https://download.pytorch.org/whl/cpu")
        return

    # Load data
    if not os.path.exists(args.data_path):
        logger.error(f"Data file not found: {args.data_path}")
        logger.info("Creating sample data file for demonstration...")
        _create_sample_data(args.data_path)

    samples = []
    with open(args.data_path) as f:
        for line in f:
            line = line.strip()
            if line:
                obj = json.loads(line)
                if obj.get("label") in LABEL2ID:
                    samples.append({"text": obj["text"][:args.max_length * 4], "label": LABEL2ID[obj["label"]]})

    if len(samples) < 10:
        logger.error(f"Need at least 10 samples, found {len(samples)}")
        return

    logger.info(f"Loaded {len(samples)} samples")

    # Split train/eval
    split = int(len(samples) * 0.85)
    train_data = samples[:split]
    eval_data = samples[split:]

    # Tokenizer
    tokenizer = AutoTokenizer.from_pretrained(args.model_name)

    def tokenize(batch):
        return tokenizer(batch["text"], truncation=True, max_length=args.max_length)

    train_ds = Dataset.from_list(train_data).map(tokenize, batched=True)
    eval_ds = Dataset.from_list(eval_data).map(tokenize, batched=True)

    # Model
    model = AutoModelForSequenceClassification.from_pretrained(
        args.model_name,
        num_labels=len(LABELS),
        id2label=ID2LABEL,
        label2id=LABEL2ID,
    )

    def compute_metrics(eval_pred):
        logits, labels = eval_pred
        preds = np.argmax(logits, axis=1)
        return {
            "accuracy": accuracy_score(labels, preds),
            "f1": f1_score(labels, preds, average="weighted"),
        }

    training_args = TrainingArguments(
        output_dir=args.output_dir,
        num_train_epochs=args.epochs,
        per_device_train_batch_size=args.batch_size,
        per_device_eval_batch_size=args.batch_size,
        evaluation_strategy="epoch",
        save_strategy="epoch",
        load_best_model_at_end=True,
        metric_for_best_model="f1",
        no_cuda=True,  # CPU training
        logging_steps=10,
        warmup_ratio=0.1,
        learning_rate=2e-5,
    )

    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=train_ds,
        eval_dataset=eval_ds,
        tokenizer=tokenizer,
        data_collator=DataCollatorWithPadding(tokenizer),
        compute_metrics=compute_metrics,
    )

    logger.info("Starting training (CPU mode)...")
    trainer.train()
    trainer.save_model(args.output_dir)
    tokenizer.save_pretrained(args.output_dir)
    logger.info(f"Model saved to {args.output_dir}")

    if args.hf_push and args.hf_repo_id:
        logger.info(f"Pushing to HuggingFace Hub: {args.hf_repo_id}")
        model.push_to_hub(args.hf_repo_id)
        tokenizer.push_to_hub(args.hf_repo_id)
        logger.info(f"Done! Set HF_PREDICTION_MODEL={args.hf_repo_id} in .env")


def _create_sample_data(path: str):
    """Create minimal sample data for testing."""
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    samples = [
        {"text": "Petitioner filed writ petition challenging arbitrary dismissal from government service without following due process under Article 311 of the Constitution.", "label": "Allowed"},
        {"text": "Accused convicted for murder under Section 302 IPC. Sentence of life imprisonment confirmed by High Court.", "label": "Dismissed"},
        {"text": "Consumer complaint regarding deficiency in banking services. Bank failed to process loan application within reasonable time.", "label": "Allowed"},
        {"text": "Company petition for winding up on grounds of inability to pay debts. Respondent failed to appear.", "label": "Allowed"},
        {"text": "Appeal against maintenance order under Section 125 CrPC. Wife held disentitled on account of adultery.", "label": "Dismissed"},
        {"text": "Property dispute between co-owners. Partition suit seeking division of ancestral property.", "label": "Partly Allowed"},
        {"text": "Labour dispute regarding illegal termination. Reinstatement sought with back wages.", "label": "Allowed"},
        {"text": "Tax assessment challenged on grounds of improper notice. Income Tax Officer followed correct procedure.", "label": "Dismissed"},
        {"text": "Bail application in narcotics case under NDPS Act. Accused arrested with commercial quantity.", "label": "Dismissed"},
        {"text": "Divorce petition on grounds of cruelty and desertion. Both parties settled terms mutually.", "label": "Settled"},
    ]
    with open(path, "w") as f:
        for s in samples:
            f.write(json.dumps(s) + "\n")
    logger.info(f"Sample data created at {path}")


if __name__ == "__main__":
    main()
