"""LLM-based content validator for compliance checking."""

import asyncio
import json
import re
from typing import Any
from google.adk.models.lite_llm import LlmRequest
from google.genai.types import Content, Part
from common.lib.utils.logging import get_logger
from ..models.schemas import ValidationResult, RuleViolation
from ..config.llm_config import LLM_TOKENS_PER_ITEM_RESPONSE, LLM_MAX_OUTPUT_TOKENS

logger = get_logger(__name__)


# Load compliance rules from the consolidated rules file
try:
    from ..rules.rules_loader import load_rules
except ImportError:
    try:
        from common.agents.compliance_validator.rules.rules_loader import load_rules
    except ImportError:
        logger.warning("Could not import compliance rules. Using empty list.")
        load_rules = None


class LLMValidator:
    """Validates content against compliance rules using LLM."""
    
    def __init__(self, model: Any = None):
        """
        Initialize the LLM validator.
        
        Args:
            model: The LLM model to use for validation (defaults to env variable)
        """
        if hasattr(model, 'model'):
            # It's an ADK LiteLlm object
            self.model_obj = model
            self.model = model.model
        else:
            # Enforce shared ADK model usage; do not allow fallback for compliance validation
            raise RuntimeError("LLMValidator requires a shared ADK LiteLlm model instance")

        self.compliance_rules = load_rules() if load_rules else []
        
        logger.info(f"LLMValidator initialized - model: {self.model}")
    
    async def _call_model_obj(self, system_prompt: str, user_prompt: str, max_output_tokens: int = 800) -> str:
        """Helper to call self.model_obj.generate_content_async correctly."""
        llm_request = LlmRequest(
            contents=[
                Content(role="system", parts=[Part(text=system_prompt)]),
                Content(role="user", parts=[Part(text=user_prompt)])
            ],
            config={"temperature": 0.1, "max_output_tokens": max_output_tokens}
        )
        
        response_text = ""
        async for chunk in self.model_obj.generate_content_async(llm_request):
            if chunk.content and chunk.content.parts:
                for part in chunk.content.parts:
                    if hasattr(part, 'text') and part.text:
                        response_text += part.text
        return response_text

    async def validate(self, system_prompt: str, user_prompt: str) -> dict[str, Any]:
        """
        Generic validation method for backward compatibility with test runner.
        """
        try:
            if not self.model_obj or not hasattr(self.model_obj, 'generate_content_async'):
                raise RuntimeError("Shared ADK model is required for compliance validation")

            response_text = await self._call_model_obj(system_prompt, user_prompt)
            
            result = self._parse_json_response(response_text)
            
            # Map 'score' to 'compliance_score' if needed by tests
            if "score" in result and "compliance_score" not in result:
                result["compliance_score"] = result["score"]
            elif "compliance_score" in result and "score" not in result:
                result["score"] = result["compliance_score"]

            return result
        except Exception as e:
            logger.error(f"Error in validate: {e}")
            return {"status": "ERROR", "error": str(e), "compliance_score": 0.0, "score": 0.0}
    
    async def validate_content_standalone(
        self,
        content: str,
        content_type: str = "prompt",
        application_name: str = "Unknown Application",
        rules: list[dict] | None = None
    ) -> dict[str, Any]:
        """
        Validate content against legal compliance rules.
        
        Args:
            content: The content to validate (string or JSON string)
            content_type: Type of content ('prompt' or 'json_response')
            application_name: Name of the application being validated
            rules: Optional list of rules from database. If None, uses hardcoded rules.
            
        Returns:
            Dictionary with validation results
        """
        try:
            # Use provided rules or fall back to hardcoded rules
            compliance_rules = rules if rules else self.compliance_rules
            
            # Build the system prompt with all rules
            rules_text = "\n".join([
                f"{i+1}. **{rule.get('rule_name', rule.get('id'))}** (ID: {rule['id']}, Severity: {rule.get('severity', 'MEDIUM')})\n   - {rule.get('prompt_instruction', 'No instruction provided')}"
                for i, rule in enumerate(compliance_rules)
            ])
            
            system_prompt = f"""You are a Legal Compliance Validator. Check content against these {len(compliance_rules)} rules:

{rules_text}

Scoring: 1.0=no violations, 0.7-0.9=MEDIUM only, 0.4-0.6=HIGH, 0.0-0.3=CRITICAL.

Respond ONLY with this JSON (no extra text):
{{"compliance_score":<0.0-1.0>,"total_rules_checked":{len(compliance_rules)},"violations":[{{"rule_id":"<id>","rule_name":"<name>","severity":"<CRITICAL|HIGH|MEDIUM>","message":"<why it violates>","field":"<where>","suggestion":"<fix>"}}],"summary":"<brief>"}}"""

            user_prompt = f"""Content-Type: {content_type} | App: {application_name}

{content}"""

            logger.info(f"Calling LLM - model: {self.model}, content_type: {content_type}, content_length: {len(content)}")
            
            # Call shared ADK model (no API keys handled here)
            if not self.model_obj or not hasattr(self.model_obj, 'generate_content_async'):
                raise RuntimeError("Shared ADK model is required for compliance validation")

            response_text = await self._call_model_obj(system_prompt, user_prompt)
            
            logger.info(f"LLM response received, length: {len(response_text)}")
            logger.debug(f"LLM raw response: {response_text[:500]}...")
            
            # Try to extract JSON from the response
            result = self._parse_json_response(response_text)
            
            # Ensure violations is always a list
            if "violations" not in result:
                result["violations"] = []
            
            # Log detailed results
            logger.info(f"Validation complete: score={result.get('compliance_score')}, violations={len(result.get('violations', []))}")
            for v in result.get("violations", []):
                logger.info(f"  Violation: [{v.get('rule_id')}] {v.get('severity')} - {v.get('message', '')[:100]}")
            
            return result
            
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse LLM response as JSON: {e}")
            return {
                "compliance_score": 0.0,
                "total_rules_checked": len(compliance_rules) if rules else len(self.compliance_rules),
                "violations": [],
                "summary": f"Error parsing validation response: {str(e)}"
            }
        except Exception as e:
            logger.error(f"Error during content validation: {e}", exc_info=True)
            return {
                "compliance_score": 0.0,
                "total_rules_checked": 0,
                "violations": [],
                "summary": f"Error during validation: {str(e)}"
            }
    
    def _parse_json_response(self, response_text: str) -> dict[str, Any]:
        """
        Parse JSON from LLM response, handling potential markdown code blocks.
        
        Args:
            response_text: Raw response text from LLM
            
        Returns:
            Parsed JSON dictionary
        """
        # Try direct JSON parse first
        try:
            return json.loads(response_text)
        except json.JSONDecodeError:
            pass
        
        # Try to extract JSON from markdown code blocks
        json_patterns = [
            r'```json\s*([\s\S]*?)\s*```',
            r'```\s*([\s\S]*?)\s*```',
        ]
        
        for pattern in json_patterns:
            match = re.search(pattern, response_text)
            if match:
                try:
                    json_str = match.group(1)
                    return json.loads(json_str)
                except (json.JSONDecodeError, IndexError):
                    continue
        
        # Try to find raw JSON object
        json_match = re.search(r'\{[\s\S]*\}', response_text)
        if json_match:
            try:
                return json.loads(json_match.group(0))
            except json.JSONDecodeError:
                pass
        
        # If all parsing fails, raise error
        raise json.JSONDecodeError("Could not parse JSON from response", response_text, 0)

    @staticmethod
    def _safe_call_size() -> int:
        """
        How many items fit in one LLM call without truncating the response?
        Derived from compliance config constants — not hardcoded here.
          chunk_size = LLM_MAX_OUTPUT_TOKENS // LLM_TOKENS_PER_ITEM_RESPONSE
        Tune LLM_MAX_OUTPUT_TOKENS / LLM_TOKENS_PER_ITEM_RESPONSE in
        common/agents/compliance_validator/config/rules_config.py.
        """
        return LLM_MAX_OUTPUT_TOKENS // LLM_TOKENS_PER_ITEM_RESPONSE

    async def validate_batch(
        self,
        items: list[dict],  # list of {content_id, content, content_type}
        rules: list[dict] | None = None,
        application_name: str = "Unknown Application",
    ) -> list[dict]:
        """
        Validate ALL N items, paying the rules prompt exactly once.
        If N exceeds the safe output-token limit, splits into chunks
        automatically — caller always gets back exactly N results in order.

        The safe chunk size is computed from token budgets, not hardcoded:
          chunk_size = MAX_OUTPUT_TOKENS // TOKENS_PER_ITEM_RESPONSE  (~34)

        Each result: {"compliance_score": float, "violations": [...], "summary": str}
        Every item gets its own result regardless of success or failure.
        """
        compliance_rules = rules if rules else self.compliance_rules

        def _error_result(msg: str) -> dict:
            return {"compliance_score": 0.0, "violations": [], "summary": msg, "total_rules_checked": 0}

        rules_text = "\n".join([
            f"{i+1}. {r.get('rule_name', r['id'])} (ID:{r['id']}, Sev:{r.get('severity','MEDIUM')}): {r.get('prompt_instruction','')}"
            for i, r in enumerate(compliance_rules)
        ])

        system_prompt = f"""You are a Legal Compliance Validator. Check each item against these {len(compliance_rules)} rules:

{rules_text}

Scoring per item: 1.0=no violations, 0.7-0.9=MEDIUM only, 0.4-0.6=HIGH, 0.0-0.3=CRITICAL.

Respond ONLY with a JSON array — one entry per item in the same order. No extra text:
[{{"item_index":0,"compliance_score":<0.0-1.0>,"violations":[{{"rule_id":"<id>","rule_name":"<n>","severity":"<CRITICAL|HIGH|MEDIUM>","message":"<why>","suggestion":"<fix>"}}],"summary":"<brief>"}}]"""

        # ── Compute chunk size from compliance config (no magic number here) ──
        chunk_size = self._safe_call_size()
        chunks = [items[i:i + chunk_size] for i in range(0, len(items), chunk_size)]
        n_calls = len(chunks)
        logger.info(
            f"validate_batch: {len(items)} items → {n_calls} LLM call(s) "
            f"(chunk_size={chunk_size} from config: "
            f"{LLM_MAX_OUTPUT_TOKENS} output tokens / {LLM_TOKENS_PER_ITEM_RESPONSE} per item)"
        )

        all_results: list[dict] = []

        for chunk_idx, chunk in enumerate(chunks):
            items_text = "\n\n".join([
                f"ITEM_{idx} [{item['content_type']}]: {item['content'][:500]}"
                for idx, item in enumerate(chunk)
            ])
            user_prompt = f"App: {application_name}\n\n{items_text}"

            # Output tokens needed = chunk size × per-item budget (from config)
            max_output_tokens = len(chunk) * LLM_TOKENS_PER_ITEM_RESPONSE
            logger.info(f"  chunk {chunk_idx + 1}/{n_calls}: {len(chunk)} items, max_output_tokens={max_output_tokens}")

            # Retry with exponential backoff on rate limit errors only
            max_retries = 2
            last_error: Exception | None = None
            chunk_results: list[dict] | None = None

            for attempt in range(max_retries + 1):
                try:
                    response_text = await self._call_model_obj(system_prompt, user_prompt, max_output_tokens)
                    logger.info(f"  chunk {chunk_idx + 1} response: {len(response_text)} chars")

                    array_match = re.search(r'\[[\s\S]*\]', response_text)
                    if not array_match:
                        raise json.JSONDecodeError("No JSON array found", response_text, 0)
                    batch_results = json.loads(array_match.group(0))

                    # item_index in LLM response is local to this chunk (0..chunk_size-1)
                    result_map = {r.get("item_index", i): r for i, r in enumerate(batch_results)}

                    chunk_results = []
                    for idx in range(len(chunk)):
                        r = result_map.get(idx, {})
                        chunk_results.append({
                            "compliance_score": r.get("compliance_score", 0.0),
                            "violations": r.get("violations", []),
                            "summary": r.get("summary", "No result"),
                            "total_rules_checked": len(compliance_rules),
                        })
                    break  # success — exit retry loop

                except Exception as e:
                    last_error = e
                    is_rate_limit = (
                        "rate_limit" in str(type(e).__name__).lower()
                        or "ratelimit" in str(e).lower()
                        or "429" in str(e)
                    )
                    if is_rate_limit and attempt < max_retries:
                        wait = 2 ** attempt  # 1s, 2s
                        logger.warning(f"  Rate limit, retry {attempt + 1}/{max_retries} in {wait}s")
                        await asyncio.sleep(wait)
                        continue
                    break

            if chunk_results is None:
                logger.error(f"  chunk {chunk_idx + 1} failed after retries: {last_error}", exc_info=True)
                chunk_results = [_error_result(f"Validation error: {last_error}") for _ in chunk]

            all_results.extend(chunk_results)

        return all_results
