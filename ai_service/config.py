from pydantic_settings import BaseSettings
from typing import List, Optional


class Settings(BaseSettings):
    # ── Anthropic ──────────────────────────────────────────────────────────────
    anthropic_api_key: str = ""
    model_name: str = "claude-sonnet-4-6"

    # ── AI Provider switch ─────────────────────────────────────────────────────
    # Options: "claude" | "huggingface" | "ollama"
    ai_provider: str = "claude"

    # ── HuggingFace ───────────────────────────────────────────────────────────
    huggingface_api_token: str = ""
    hf_llm_model: str = "mistralai/Mistral-7B-Instruct-v0.3"
    hf_embedding_model: str = "sentence-transformers/all-MiniLM-L6-v2"
    hf_prediction_model: str = ""  # fine-tuned DistilBERT model ID on HF Hub

    # ── Ollama ─────────────────────────────────────────────────────────────────
    ollama_base_url: str = "http://localhost:11434"
    ollama_llm_model: str = "phi3:mini"
    ollama_embedding_model: str = "nomic-embed-text"

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
    aalap_enabled: bool = False  # set True to route legal tasks through Aalap
    aalap_model: str = "opennyaiorg/Aalap-Mistral-7B-v0.1-bf16"
    # Uses same HUGGINGFACE_API_TOKEN — Aalap requires the model to be loaded
    # (may take ~20s cold start on HF free tier)

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
