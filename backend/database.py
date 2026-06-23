from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import IndexModel, ASCENDING, DESCENDING, TEXT
from config import settings
import logging
import certifi

logger = logging.getLogger(__name__)

client: AsyncIOMotorClient = None


def get_client() -> AsyncIOMotorClient:
    return client


def get_db():
    return client[settings.mongodb_db_name]


async def connect_db():
    global client
    # tlsCAFile=certifi.where() fixes SSL cert verification on macOS Python 3.12
    client = AsyncIOMotorClient(settings.mongodb_url, tlsCAFile=certifi.where())
    db = client[settings.mongodb_db_name]
    await create_indexes(db)
    logger.info("Connected to MongoDB")


async def close_db():
    global client
    if client:
        client.close()
        logger.info("Disconnected from MongoDB")


async def create_indexes(db):
    # Users
    await db.users.create_indexes([
        IndexModel([("email", ASCENDING)], unique=True),
        IndexModel([("phone", ASCENDING)], unique=True, sparse=True),
        IndexModel([("role", ASCENDING)]),
    ])

    # Lawyer profiles
    await db.lawyer_profiles.create_indexes([
        IndexModel([("user_id", ASCENDING)], unique=True),
        IndexModel([("practice_areas", ASCENDING)]),
        IndexModel([("city", ASCENDING)]),
        IndexModel([("languages", ASCENDING)]),
        IndexModel([("rating", DESCENDING)]),
        IndexModel([("name", TEXT), ("bio", TEXT)]),
    ])

    # Consultations
    await db.consultations.create_indexes([
        IndexModel([("consumer_id", ASCENDING)]),
        IndexModel([("lawyer_id", ASCENDING)]),
        IndexModel([("status", ASCENDING)]),
        IndexModel([("created_at", DESCENDING)]),
    ])

    # Cases
    await db.cases.create_indexes([
        IndexModel([("lawyer_id", ASCENDING)]),
        IndexModel([("client_id", ASCENDING)]),
        IndexModel([("status", ASCENDING)]),
        IndexModel([("next_hearing_date", ASCENDING)]),
    ])

    # Clients
    await db.clients.create_indexes([
        IndexModel([("lawyer_id", ASCENDING)]),
        IndexModel([("email", ASCENDING)]),
    ])

    # Payments
    await db.payments.create_indexes([
        IndexModel([("user_id", ASCENDING)]),
        IndexModel([("razorpay_order_id", ASCENDING)], sparse=True),
        IndexModel([("status", ASCENDING)]),
    ])

    # Documents
    await db.documents.create_indexes([
        IndexModel([("user_id", ASCENDING)]),
        IndexModel([("case_id", ASCENDING)], sparse=True),
        IndexModel([("created_at", DESCENDING)]),
    ])

    # Time entries
    await db.time_entries.create_indexes([
        IndexModel([("lawyer_id", ASCENDING)]),
        IndexModel([("case_id", ASCENDING)]),
    ])

    # Invoices
    await db.invoices.create_indexes([
        IndexModel([("lawyer_id", ASCENDING)]),
        IndexModel([("client_id", ASCENDING)]),
        IndexModel([("status", ASCENDING)]),
    ])

    # Token blacklist — auto-expire after the token's expiry time
    await db.token_blacklist.create_indexes([
        IndexModel([("token", ASCENDING)], unique=True),
        IndexModel([("expires_at", ASCENDING)], expireAfterSeconds=0),  # TTL index
    ])

    # Login attempt lockout — auto-expire records after 24 hours
    await db.login_attempts.create_indexes([
        IndexModel([("email", ASCENDING)], unique=True),
        IndexModel([("last_attempt", ASCENDING)], expireAfterSeconds=86400),  # 24h TTL
    ])

    # Admin config store — encrypted key-value pairs
    await db.app_config.create_indexes([
        IndexModel([("key", ASCENDING)], unique=True),
        IndexModel([("updated_at", DESCENDING)]),
    ])

    logger.info("MongoDB indexes created")
