import httpx
import os
import json
import redis
from redis.commands.search.query import Query
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:4200"],
    allow_methods=["*"],
    allow_headers=["*"],
)

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
MODEL      = os.getenv("MODEL", "smollm2:1.7b-instruct-q4_0")
REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = int(os.getenv("REDIS_PORT", "6379"))
INDEX_NAME = "idx:faqs"

# Connect to Redis once at startup
r = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, decode_responses=True)

STOP_WORDS = {
    "do", "i", "a", "the", "is", "it", "to", "for", "of", "and", "or", "in", "on", "at", "how", 
    "what", "where", "when", "why", "can", "should", "will", "be", "are", "me", "my", "you",
    "your", "with", "as", "if", "but", "have", "has", "make", "get", "go", "use", "want", "need"
}


def search_faqs_redis(query: str, top_k: int = 3) -> str:
    """Search FAQs using RediSearch full-text search and strict post-filtering."""
    # Escape special RediSearch characters and split into words
    escaped = query.replace("@", " ").replace("{", " ").replace("}", " ").replace("?", "")
    
    # Filter out stop words so we don't match on "how", "do", "i", etc.
    words = [w for w in escaped.lower().split() if w not in STOP_WORDS]
    if not words:
        return ""

    # Use each word as an optional term so partial matches still rank
    search_query = " | ".join(words)

    try:
        q = (
            Query(search_query)
            .return_fields("question", "answer")
            .paging(0, top_k)
        )
        results = r.ft(INDEX_NAME).search(q)
    except Exception:
        return ""

    if not results.docs:
        return ""

    snippets = []
    query_word_set = set(words)
    
    for doc in results.docs:
        faq_text = (doc.question + " " + doc.answer).lower()
        # Clean punctuation to get true words
        clean_faq = "".join(c if c.isalnum() else " " for c in faq_text)
        faq_words = set(clean_faq.split())
        
        # Calculate how many of the user's focus words actually appear in the FAQ
        overlap = query_word_set.intersection(faq_words)
        overlap_ratio = len(overlap) / len(query_word_set)
        
        # Only keep the result if at least 60% of the user's keywords are in the FAQ
        # (e.g. "visit kosovo" -> "kosovo" is missing -> 50% overlap -> Rejected)
        # OR if it matches at least 2 distinct strong keywords.
        if overlap_ratio >= 0.6 or len(overlap) >= 2:
            snippets.append(f"Q: {doc.question}\nA: {doc.answer}")

    return "\n\n".join(snippets)


class Message(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    message: str
    history: list[Message] = []

@app.get("/health")
def health():
    try:
        r.ping()
        redis_ok = True
    except Exception:
        redis_ok = False
    return {"status": "ok", "model": MODEL, "redis": redis_ok}

@app.post("/api/chat")
async def chat(req: ChatRequest):
    # Retrieve only relevant context from Redis
    relevant_context = search_faqs_redis(req.message)

    if not relevant_context:
        # Short-circuit: Do not ask the LLM. Just stream the refusal directly.
        async def stream_refusal():
            msg = "I'm sorry, this question is not covered in our FAQ. Please contact support."
            # Stream in a few chunks to simulate typing, or just one chunk
            yield json.dumps({"text": msg, "done": True}) + "\n"
        return StreamingResponse(stream_refusal(), media_type="application/x-ndjson")

    # If we have context, build the strict prompt
    prompt = f"""You are a strict FAQ-only assistant for a Morocco travel guide.
Your ONLY job is to answer questions using the FAQ document snippets below.

STRICT RULES:
1. ONLY answer questions using the provided FAQ items.
2. Do NOT use outside knowledge.
3. Keep the answer concise.

--- RELEVANT FAQ SNIPPETS ---
{relevant_context}
---------------------------"""

    messages = [
        {"role": "system", "content": prompt}
    ] + [m.model_dump() for m in req.history] + [
        {"role": "user", "content": req.message}
    ]

    async def stream_response():
        async with httpx.AsyncClient(timeout=300) as client:
            async with client.stream("POST", f"{OLLAMA_URL}/api/chat",
                json={"model": MODEL, "messages": messages, "stream": True}
            ) as resp:
                async for line in resp.aiter_lines():
                    if line:
                        chunk = json.loads(line)
                        text = chunk.get("message", {}).get("content", "")
                        done = chunk.get("done", False)
                        yield json.dumps({"text": text, "done": done}) + "\n"

    return StreamingResponse(stream_response(), media_type="application/x-ndjson")