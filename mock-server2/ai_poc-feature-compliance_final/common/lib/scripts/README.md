# Scripts Usage

This directory contains utility scripts for the Product Comparison API.

## Sample Generator

The `scripts/generate_sample.py` script is used to generate sample comparison data using an LLM.

### Usage

1.  **Edit the Output Structure**: Edit the `ExperimentalSummary` class in `scripts/generate_sample.py` to change the fields and structure of the LLM output.
2.  **Edit the Prompt**: Edit the `PROMPT_TEMPLATE` string in `scripts/generate_sample.py` to change the instructions sent to the LLM.
3.  **Run the Script**:
    ```bash
    python -m scripts.generate_sample
    ```
