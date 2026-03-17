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

SYSTEM_PROMPT = f"""You are a FAQ assistant.
Answer ONLY using the FAQ document below.
If the answer is not there, say: "Please contact support."

--- FAQ ---
{FAQ}
-----------"""

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
    messages = [m.model_dump() for m in req.history] + [
        {"role": "user", "content": req.message}
    ]

    async def stream_response():
        async with httpx.AsyncClient(timeout=120) as client:
            async with client.stream("POST", f"{OLLAMA_URL}/api/chat",
                json={"model": MODEL, "system": SYSTEM_PROMPT,
                      "messages": messages, "stream": True}
            ) as r:
                async for line in r.aiter_lines():
                    if line:
                        chunk = json.loads(line)
                        text = chunk.get("message", {}).get("content", "")
                        done = chunk.get("done", False)
                        yield json.dumps({"text": text, "done": done}) + "\n"

    return StreamingResponse(stream_response(), media_type="application/x-ndjson")