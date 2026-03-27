"""
inject_faqs.py — Load faq.json into Redis as a RediSearch full-text index.

Run once after Redis is up:
    python inject_faqs.py

This creates an index called 'idx:faqs' with full-text search on question and answer fields.
"""

import json
import redis

# Try to import Redis Search components with fallback for different redis-py versions
try:
    from redis.commands.search.field import TextField, NumericField
    from redis.commands.search.indexDefinition import IndexDefinition, IndexType
except ImportError:
    try:
        from redis.commands.search.field import TextField, NumericField
        from redis.commands.search.index_definition import IndexDefinition, IndexType
    except ImportError:
        # Final fallback for some distributions
        from redis.commands.search.field import TextField, NumericField
        IndexDefinition, IndexType = None, None

def check_redis_version():
    print(f"DEBUG: Redis-py version: {redis.__version__}")

REDIS_HOST = "localhost"
REDIS_PORT = 6379
INDEX_NAME = "idx:faqs"
PREFIX     = "faq:"

def main():
    check_redis_version()
    
    if IndexDefinition is None:
        print("[ERROR] Could not find IndexDefinition in redis-py. Please run: pip install --upgrade redis")
        return

    r = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, decode_responses=True)

    # Test connection
    r.ping()
    print("[OK] Connected to Redis")

    # Drop old index if it exists
    try:
        r.ft(INDEX_NAME).dropindex(delete_documents=True)
        print("[OK] Dropped old index")
    except Exception:
        pass

    # Load FAQ data
    with open("faq.json", encoding="utf-8") as f:
        data = json.load(f)

    # Create the RediSearch index
    schema = (
        TextField("question", weight=5.0),   # questions are more important
        TextField("answer",   weight=1.0),
        NumericField("id"),
    )
    definition = IndexDefinition(prefix=[PREFIX], index_type=IndexType.HASH)
    r.ft(INDEX_NAME).create_index(schema, definition=definition)
    print(f"[OK] Created index '{INDEX_NAME}'")

    # Insert each FAQ as a Redis hash
    for i, item in enumerate(data["faqs"]):
        key = f"{PREFIX}{i}"
        r.hset(key, mapping={
            "id":       i,
            "question": item["question"],
            "answer":   item["answer"],
        })

    print(f"[OK] Loaded {len(data['faqs'])} FAQ entries into Redis")


if __name__ == "__main__":
    main()
