from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
import logging
import json

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("mock_llm")

app = FastAPI()


@app.post("/chat/completions")
async def chat_completions(request: Request):
    body = await request.json()
    logger.info(f"Received request: {body}")

    messages = body.get("messages", [])
    last_message = messages[-1]["content"] if messages else ""

    if "TRIGGER_FAILURE" in last_message:
        return JSONResponse(status_code=500, content={"error": {"message": "Simulated failure"}})

    mock_response = {
        "overview": "Both TVs offer excellent 4K resolution with smart features. The OLED model provides superior picture quality with perfect blacks, while the QNED model offers great value with Mini LED technology.",
        "products": [
            {
                "modelId": "MD09034027",
                "modelName": "LG 65 Inch Class C3 Series OLED evo 4K TV",
                "keyHighlights": "OLED display with perfect blacks, α9 AI Processor Gen6, 120Hz refresh rate, Dolby Vision support",
                "idealFor": "Movie enthusiasts and gamers who want the best picture quality",
            },
            {
                "modelId": "MD09033837",
                "modelName": "LG 65 Inch Class QNED85 Series Mini LED 4K TV",
                "keyHighlights": "Mini LED backlighting, Quantum Dot NanoCell technology, 120Hz refresh rate, excellent brightness",
                "idealFor": "Budget-conscious buyers who want premium features at a lower price point",
            },
        ],
        "recommendation": "Choose the OLED for the best picture quality, or the QNED for better value.",
        "confidence": "high",
    }

    content = json.dumps(mock_response)

    return {
        "id": "mock-chatcmpl-123",
        "object": "chat.completion",
        "created": 1677652288,
        "model": "gpt-3.5-turbo",
        "usage": {"prompt_tokens": 9, "completion_tokens": 12, "total_tokens": 21},
        "choices": [
            {
                "message": {"role": "assistant", "content": content},
                "finish_reason": "stop",
                "index": 0,
            }
        ],
    }


@app.get("/health")
def health():
    return {"status": "ok"}
