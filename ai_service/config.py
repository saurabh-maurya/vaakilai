from pydantic_settings import BaseSettings
from typing import List, Optional


class Settings(BaseSettings):
    # ── Anthropic ──────────────────────────────────────────────────────────────
    anthropic_api_key: str = ""
    model_name: str = "claude-sonnet-4-6"          # legacy alias
    claude_model: str = "claude-sonnet-4-5"        # model used by the Claude provider

    # ── AI Provider switch (legacy factory) ────────────────────────────────────
    # Options: "claude" | "huggingface" | "ollama"
    ai_provider: str = "claude"

    # ── Generation provider chain (llm/) ───────────────────────────────────────
    # Tried in this order; the first provider that is configured AND succeeds wins.
    # Aalap (if aalap_enabled) is always tried FIRST for maximum legal coverage,
    # then this chain. Names: claude | groq | gemini | hosted | ollama
    llm_provider_priority: str = "claude,groq,gemini,hosted"

    # Groq (OpenAI-compatible, free tier, fast 70B)
    groq_api_key: str = ""
    groq_base_url: str = "https://api.groq.com/openai/v1"
    groq_model: str = "groq/compound-mini"  # Groq retired the Llama-3.x models

    # Gemini (Google, via its OpenAI-compatible endpoint)
    gemini_api_key: str = ""
    gemini_base_url: str = "https://generativelanguage.googleapis.com/v1beta/openai"
    gemini_model: str = "gemini-1.5-pro"

    # ── HuggingFace ───────────────────────────────────────────────────────────
    huggingface_api_token: str = ""
    hf_llm_model: str = "mistralai/Mistral-7B-Instruct-v0.3"
    hf_embedding_model: str = "sentence-transformers/all-MiniLM-L6-v2"
    hf_prediction_model: str = ""  # fine-tuned DistilBERT model ID on HF Hub

    # ── Ollama (LOCAL models) ──────────────────────────────────────────────────
    # Disabled by default. Enable to allow "ollama" as a backend option for the
    # generation chain, Aalap, and embeddings. Requires a running Ollama server.
    ollama_enabled: bool = False
    ollama_base_url: str = "http://localhost:11434"
    ollama_llm_model: str = "phi3:mini"
    ollama_embedding_model: str = "nomic-embed-text"

    # ── Embeddings ─────────────────────────────────────────────────────────────
    # Backend for RAG/FAISS embeddings. "huggingface" (hosted, default) or
    # "ollama" (local — only honoured when ollama_enabled=True).
    embedding_backend: str = "huggingface"

    # ── Swappable LLM layer (ai_service/llm) ────────────────────────────────────
    # Backend for the pluggable notice/drafting LLM. Never routes to Claude.
    #   "hosted" → OpenAI-compatible endpoint (HuggingFace router / Groq / Together / …)
    #   "local"  → Ollama (settings.ollama_* above)
    llm_backend: str = "hosted"
    # OpenAI-compatible hosted endpoint. Works with any vendor that speaks the
    # /chat/completions API — just change base_url + api_key + model:
    #   HuggingFace router : https://router.huggingface.co/v1
    #   Groq               : https://api.groq.com/openai/v1
    #   Together           : https://api.together.xyz/v1
    #   Fireworks          : https://api.fireworks.ai/inference/v1
    #   OpenRouter         : https://openrouter.ai/api/v1
    hosted_llm_base_url: str = "https://router.huggingface.co/v1"
    hosted_llm_api_key: str = ""  # HF token / vendor API key
    hosted_llm_model: str = "meta-llama/Llama-3.1-8B-Instruct"  # HF router chat model (free tier); Mistral-7B is not a chat model on the router

    # ── RAG / FAISS ───────────────────────────────────────────────────────────
    faiss_index_path: str = "./data/faiss_index"
    cases_data_path: str = "./data/cases"

    # ── Pinecone (legacy, optional) ────────────────────────────────────────────
    pinecone_api_key: str = ""
    pinecone_index_name: str = "vakilai-judgments"
    pinecone_environment: str = "us-east-1-aws"

    # ── JWT ───────────────────────────────────────────────────────────────────
    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60  # must match backend setting

    # ── Aalap (OpenNyAI Mistral 7B — Indian legal tasks) ──────────────────────
    # Tried FIRST for every task (maximum legal coverage). If Aalap is disabled
    # or unreachable, calls fall through to the provider chain (Claude → …).
    # Default off: no provider hosts Aalap for free. Re-enable via env when you
    # run it yourself (e.g. Ollama on a free CPU VM) with AALAP_BACKEND=ollama.
    aalap_enabled: bool = False
    aalap_model: str = "opennyaiorg/Aalap-Mistral-7B-v0.1-bf16"
    # Backend: "hosted" (HuggingFace Inference API) or "ollama" (local tag below).
    aalap_backend: str = "hosted"
    aalap_hf_base_url: str = "https://api-inference.huggingface.co/models"
    aalap_ollama_model: str = "aalap"  # ollama model tag when aalap_backend=ollama
    # Hosted Aalap uses HUGGINGFACE_API_TOKEN and may cold-start (~20s) on free tier.

    # ── NyayaAnumana (702k-case judgment dataset from IIT Kanpur) ─────────────
    nyayaanumana_dataset: str = "Exploration-Lab/NyayaAnumana"  # HF dataset ID
    nyayaanumana_batch_size: int = 500   # cases per FAISS batch (tune for RAM)
    nyayaanumana_max_cases: int = 0      # 0 = ingest all; set N to limit

    # ── eCourts ───────────────────────────────────────────────────────────────
    ecourts_api_url: str = "https://eciapi.akshit.me"  # free open-source API

    # ── WhatsApp / Twilio ─────────────────────────────────────────────────────
    twilio_account_sid: str = ""
    twilio_auth_token: str = ""
    twilio_whatsapp_number: str = "whatsapp:+14155238886"  # Twilio sandbox default

    # ── ODR Provider ──────────────────────────────────────────────────────────
    odr_provider_api_key: str = ""   # if set → full integration, else AI wizard only
    odr_provider_url: str = "https://api.presolv360.com"

    # ── Video (Jitsi) ─────────────────────────────────────────────────────────
    jitsi_domain: str = "meet.jit.si"
    jitsi_app_id: str = ""   # optional: for private Jitsi deployment

    # ── MongoDB (shared with backend) ─────────────────────────────────────────
    mongodb_url: str = "mongodb://localhost:27017"
    mongodb_db_name: str = "vakilai"

    # Internal service-to-service auth key (must match backend INTERNAL_SERVICE_KEY)
    internal_service_key: str = ""

    # Redis — required for distributed rate limiting in multi-worker deployments
    redis_url: str = ""

    # Metrics — protect /metrics endpoint from unauthenticated scraping
    # Must match the value configured in prometheus.yml bearer_token
    metrics_token: str = ""

    # Sentry — error tracking (https://sentry.io)
    sentry_dsn: Optional[str] = None

    # ── Service ───────────────────────────────────────────────────────────────
    app_env: str = "development"
    debug: bool = False
    cors_origins: str = "http://localhost:3000"

    def get_cors_origins(self) -> List[str]:
        return [o.strip() for o in self.cors_origins.split(",")]

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
