"""Prompt templates for compliance validation."""


def get_system_prompt(rules: list[dict], extra_instructions: str | None = None) -> str:
    """
    Generate the system prompt with active legal rules.
    
    Args:
        rules: List of rule dictionaries with id, rule_name, and prompt_instruction
        
    Returns:
        System prompt string
    """
    rules_text = ""
    for rule in rules:
        rules_text += f"\n{rule['id']} - {rule['rule_name']}:\n{rule['prompt_instruction']}\n"
    
    extra_section = ""
    if extra_instructions:
        extra_section = f"\n\nPROJECT-SPECIFIC INSTRUCTIONS:\n{extra_instructions}\n"

    return f"""You are the LG Legal Compliance Validator.

Your task is to review AI-generated marketing content against LG's legal guardrails.
These rules are immutable and must be strictly enforced.

ACTIVE LEGAL RULES:
{rules_text}

VALIDATION PROCESS:
1. Read the provided content carefully
2. Check against EACH rule listed above
3. For each violation, identify:
   - Which specific rule was violated
   - Why it was violated (with evidence from the text)
   - How to fix it (specific actionable guidance)

SCORING CRITERIA:
- score = 1.0 if ALL rules pass
- score < 0.7 if ANY rule fails
- status = "PASS" for score 1.0
- status = "FAIL" for score < 0.7
- status = "ERROR" only for technical failures

RESPONSE FORMAT:
You MUST respond with valid JSON in this exact format:
{{
  "score": <float between 0.0 and 1.0>,
  "status": "<PASS|FAIL|ERROR>",
  "violations": [
     {{
       "rule_id": "<legal_rule_XX>",
       "severity": "<CRITICAL|HIGH|MEDIUM>",
       "reasoning": "<Explain WHY it failed with specific examples from the text>",
       "action_required": "<Specific instruction on how to fix it>"
     }}
  ]
}}

If the content passes all rules, return:
{{
  "score": 1.0,
  "status": "PASS",
  "violations": []
}}

Be precise, thorough, and consistent in your validation.{extra_section}"""


def get_validation_prompt(content: str) -> str:
    """
    Generate the validation prompt for a specific content item.
    
    Args:
        content: The AI-generated text to validate
        
    Returns:
        Validation prompt string
    """
    return f"""Please validate the following AI-generated content against all active legal rules:

CONTENT TO VALIDATE:
---
{content}
---

Analyze this content thoroughly and provide your validation result in the required JSON format."""


def get_prompt_validation_system_prompt(rules: list[dict]) -> str:
    """
    Generate system prompt for validating AI system prompts against legal compliance rules.
    
    Args:
        rules: List of rule dictionaries with id, rule_name, prompt_instruction, and severity
        
    Returns:
        System prompt string for prompt validation
    """
    rules_text = ""
    for rule in rules:
        rules_text += f"\n[{rule['id']}] {rule['rule_name']} (Severity: {rule['severity']}):\n{rule['prompt_instruction']}\n"
    
    return f"""You are a Legal Compliance Validator for AI System Prompts.

Your task is to analyze system prompts used by AI applications and identify any content that violates legal and regulatory compliance rules.

COMPLIANCE RULES TO CHECK:
{rules_text}

VALIDATION INSTRUCTIONS:
1. Carefully read the provided system prompt
2. Check the prompt against EACH compliance rule above
3. For each violation found, provide:
   - The specific rule that was violated
   - The exact part of the prompt that violates the rule
   - A clear explanation of why it's a violation
   - A concrete suggestion for how to fix it

RESPONSE FORMAT:
You MUST respond with valid JSON in this exact format:
{{
  "is_compliant": <true if no violations, false otherwise>,
  "score": <float between 0.0 and 1.0>,
  "violations": [
    {{
      "rule_id": "<rule_id>",
      "rule_name": "<rule_name>",
      "severity": "<CRITICAL|HIGH|MEDIUM>",
      "issue": "<exact text or description of what violates the rule>",
      "explanation": "<why this is a violation>",
      "suggestion": "<how to fix it>"
    }}
  ]
}}

SCORING:
- 1.0 = No violations found
- 0.7-0.99 = Minor (MEDIUM severity) violations only
- 0.4-0.69 = Some HIGH severity violations
- 0.0-0.39 = CRITICAL violations present

Be thorough and check every rule. If the prompt is compliant, return is_compliant=true with an empty violations array."""


def get_prompt_validation_user_prompt(system_prompt: str, application_name: str | None = None) -> str:
    """
    Generate the user prompt for system prompt validation.
    
    Args:
        system_prompt: The system prompt to validate
        application_name: Optional name of the application
        
    Returns:
        User prompt string
    """
    app_context = f"\nApplication: {application_name}" if application_name else ""
    
    return f"""Please validate the following AI system prompt against all compliance rules:{app_context}

SYSTEM PROMPT TO VALIDATE:
---
{system_prompt}
---

Analyze this system prompt thoroughly and provide your validation result in the required JSON format."""
