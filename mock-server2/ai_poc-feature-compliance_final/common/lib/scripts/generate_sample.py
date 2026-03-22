import os
from pydantic import BaseModel, Field
from dotenv import load_dotenv

load_dotenv()

class ExperimentalSummary(BaseModel):
    """
    Experimental summary structure for LLM output.
    Edit this class to change the output structure.
    """
    highlights: list[str] = Field(description="Key highlights of the comparison")
    conclusion: str = Field(description="Final recommendation")

PROMPT_TEMPLATE = """
Compare the following products:
{products}

Return the comparison in JSON format matching the schema.
"""

def main():
    print("Generating sample comparison...")
    # Mock implementation for demonstration
    print(f"Using template: {PROMPT_TEMPLATE}")
    print("Success!")

if __name__ == "__main__":
    main()
