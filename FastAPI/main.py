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

# Format into clean Q&A text for the system prompt
FAQ = "\n\n".join(
    f"Q: {item['question']}\nA: {item['answer']}"
    for item in data["faqs"]
)

SYSTEM_PROMPT = f"""You are a strict FAQ-only assistant for a Morocco travel guide.
Your ONLY job is to answer questions using the FAQ document below.

STRICT RULES:
1. ONLY answer questions that are covered in the FAQ below.
2. Do NOT use any outside knowledge, even if you know the answer.
3. Do NOT answer general knowledge questions, math, coding, or anything unrelated.
4. If the user's question is NOT covered in the FAQ, respond EXACTLY with: "I'm sorry, this question is not covered in our FAQ. Please contact support for further assistance."
5. Keep your answers concise and based strictly on the FAQ content.

--- FAQ START ---
{FAQ}
--- FAQ END ---

Remember: you must REFUSE to answer anything not in the FAQ above."""

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
    # Always inject system prompt as the first message in the conversation
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT}
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