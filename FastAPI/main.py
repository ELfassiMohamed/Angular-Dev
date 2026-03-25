import httpx
import os
import json
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

with open("faq.json", encoding="utf-8") as f:
    data = json.load(f)

STOP_WORDS = {
    "do", "i", "a", "the", "is", "it", "to", "for", "of", "and", "or", "in", "on", "at", "how", 
    "what", "where", "when", "why", "can", "should", "will", "be", "are", "me", "my", "you",
    "your", "with", "as", "if", "but", "have", "has", "make", "get", "go", "use", "want"
}

def search_faqs(query: str, faqs: list, top_k: int = 3) -> str:
    """Keyword-based search with whole-word matching and threshold filtering."""
    # Remove punctuation and split into lowercase words
    clean_query = "".join(char if char.isalnum() or char.isspace() else " " for char in query.lower())
    query_words = {word for word in clean_query.split() if word not in STOP_WORDS}
    
    if not query_words:
        return ""
    
    scored_faqs = []
    for item in faqs:
        score = 0
        search_text = (item['question'] + " " + item['answer']).lower()
        clean_search = "".join(char if char.isalnum() or char.isspace() else " " for char in search_text)
        search_words = set(clean_search.split())
        
        question_words = set("".join(char if char.isalnum() or char.isspace() else " " for char in item['question'].lower()).split())
        
        for word in query_words:
            if word in search_words:
                # Prioritize matches in the question
                score += 3 if word in question_words else 1
        
        # Only include if there's a strong match (e.g., in the question or multiple in the answer)
        if score >= 2:
            scored_faqs.append((score, item))
            
    # Sort by score and take top_k
    scored_faqs.sort(key=lambda x: x[0], reverse=True)
    relevant = [f"Q: {item['question']}\nA: {item['answer']}" for _, item in scored_faqs[:top_k]]
    return "\n\n".join(relevant)

class Message(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    message: str
    history: list[Message] = []

@app.get("/health")
def health():
    return {"status": "ok", "model": MODEL}

@app.post("/api/chat")
async def chat(req: ChatRequest):
    # Retrieve only relevant context pieces
    relevant_context = search_faqs(req.message, data["faqs"])
    
    if relevant_context:
        prompt = f"""You are a strict FAQ-only assistant for a Morocco travel guide.
Your ONLY job is to answer questions using the FAQ document snippets below.

STRICT RULES:
1. ONLY answer questions using the provided FAQ items.
2. Do NOT use outside knowledge.
3. If the answer is not in the FAQ snippets, say: "I'm sorry, this question is not covered in our FAQ. Please contact support."
4. Keep the answer concise.

--- RELEVANT FAQ SNIPPETS ---
{relevant_context}
---------------------------"""
    else:
        # No context found, force refusal
        prompt = "You are an FAQ assistant. The user asked a question not found in the FAQ. Respond EXACTLY with: 'I'm sorry, this question is not covered in our FAQ. Please contact support.'"

    messages = [
        {"role": "system", "content": prompt}
    ] + [m.model_dump() for m in req.history] + [
        {"role": "user", "content": req.message}
    ]

    async def stream_response():
        async with httpx.AsyncClient(timeout=300) as client:
            async with client.stream("POST", f"{OLLAMA_URL}/api/chat",
                json={"model": MODEL, "messages": messages, "stream": True}
            ) as r:
                async for line in r.aiter_lines():
                    if line:
                        chunk = json.loads(line)
                        text = chunk.get("message", {}).get("content", "")
                        done = chunk.get("done", False)
                        yield json.dumps({"text": text, "done": done}) + "\n"

    return StreamingResponse(stream_response(), media_type="application/x-ndjson")