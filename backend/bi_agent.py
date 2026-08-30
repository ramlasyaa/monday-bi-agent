import os
import sys
import io
import re
import uuid
import logging
import traceback
import requests
import pandas as pd
import numpy as np

logger = logging.getLogger(__name__)

def execute_pandas_query(code: str, deals_df: pd.DataFrame, wo_df: pd.DataFrame, static_dir: str) -> dict:
    """
    Executes a python code block on deals_df and wo_df inside a sandboxed environment.
    Captures prints, the 'result' variable, and saves any matplotlib plots.
    """
    # Redirect stdout
    old_stdout = sys.stdout
    redirected_output = io.StringIO()
    sys.stdout = redirected_output

    # Prepare execution environment
    local_env = {
        'deals_df': deals_df.copy(),
        'wo_df': wo_df.copy(),
        'pd': pd,
        'np': np,
        'plt': None
    }

    # Import matplotlib and configure headless mode
    import matplotlib
    matplotlib.use('Agg')  # Headless mode
    import matplotlib.pyplot as plt
    local_env['plt'] = plt

    # Close previous plots
    plt.close('all')

    error = None
    try:
        # Execute the python script
        exec(code, {}, local_env)
    except Exception:
        error = traceback.format_exc()
    finally:
        sys.stdout = old_stdout

    stdout_str = redirected_output.getvalue()

    # Save chart if generated
    chart_url = None
    fig_numbers = plt.get_fignums()
    if fig_numbers:
        try:
            chart_filename = f"chart_{uuid.uuid4().hex[:8]}.png"
            chart_path = os.path.join(static_dir, chart_filename)
            os.makedirs(static_dir, exist_ok=True)
            plt.savefig(chart_path, bbox_inches='tight', dpi=150)
            plt.close('all')
            chart_url = f"/static/{chart_filename}"
        except Exception as chart_err:
            logger.error(f"Failed to save generated chart: {chart_err}")

    # Extract final result
    result = local_env.get('result', None)

    return {
        "result": result,
        "stdout": stdout_str,
        "error": error,
        "chart_url": chart_url
    }

def call_gemini_api(api_key: str, model_name: str, prompt: str, system_instruction: str = None) -> str:
    """
    Three-way fallback caller for Gemini API:
    1. Modern google-genai SDK
    2. Legacy google-generativeai SDK
    3. Direct HTTP request (zero-dependency)
    """
    # 1. Try google-genai SDK
    try:
        from google import genai
        from google.genai import types
        client = genai.Client(api_key=api_key)
        config = types.GenerateContentConfig(
            temperature=0.1,
            system_instruction=system_instruction
        )
        response = client.models.generate_content(
            model=model_name,
            contents=prompt,
            config=config
        )
        return response.text
    except Exception as e:
        logger.debug(f"google-genai SDK call failed: {e}")

    # 2. Try google-generativeai legacy SDK
    try:
        import google.generativeai as legacy_genai
        legacy_genai.configure(api_key=api_key)
        model = legacy_genai.GenerativeModel(
            model_name=model_name,
            system_instruction=system_instruction
        )
        response = model.generate_content(
            prompt,
            generation_config={"temperature": 0.1}
        )
        return response.text
    except Exception as e:
        logger.debug(f"google-generativeai SDK call failed: {e}")

    # 3. Fallback to direct HTTP request
    try:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key}"
        
        body = {
            "contents": [
                {
                    "parts": [{"text": prompt}]
                }
            ],
            "generationConfig": {
                "temperature": 0.1
            }
        }
        if system_instruction:
            body["systemInstruction"] = {
                "parts": [{"text": system_instruction}]
            }
            
        headers = {"Content-Type": "application/json"}
        resp = requests.post(url, json=body, headers=headers, timeout=30)
        resp.raise_for_status()
        return resp.json()["candidates"][0]["content"]["parts"][0]["text"]
    except Exception as e:
        raise Exception(f"Failed to generate content from Gemini API via HTTP: {str(e)}")

class BIAgent:
    def __init__(self, api_key: str, static_dir: str):
        self.api_key = api_key
        self.static_dir = static_dir
        self.model_name = "gemini-2.5-flash"

    def process_query(self, user_question: str, deals_df: pd.DataFrame, wo_df: pd.DataFrame, dq_report: dict) -> dict:
        """
        Interprets a business question, writes python query code, executes it, 
        and summarizes the results with Gemini.
        """
        # Step 1: Instruct Gemini to write python code
        schema_info = f"""
DataFrame `deals_df` (Deals sales pipeline):
- Columns: {list(deals_df.columns)}
- Total Rows: {len(deals_df)}
- Sector/service unique values: {list(deals_df['Sector/service'].unique()) if 'Sector/service' in deals_df.columns else []}
- Deal Status unique values: {list(deals_df['Deal Status'].unique()) if 'Deal Status' in deals_df.columns else []}
- Deal Stage unique values: {list(deals_df['Deal Stage'].unique()) if 'Deal Stage' in deals_df.columns else []}

DataFrame `wo_df` (Work Orders tracking execution):
- Columns: {list(wo_df.columns)}
- Total Rows: {len(wo_df)}
- Sector unique values: {list(wo_df['Sector'].unique()) if 'Sector' in wo_df.columns else []}
- Execution Status unique values: {list(wo_df['Execution Status'].unique()) if 'Execution Status' in wo_df.columns else []}
"""

        system_instruction = """You are a top-tier Business Intelligence Agent. Your job is to write correct, clean, and robust Python code using pandas to query, aggregate, and analyze dataframes to answer business questions from the founder.

You must follow these rules:
1. Output your python code in a SINGLE ```python ... ``` block. Do not write any other explanation or text.
2. Put the final numerical or tabular result in a variable called `result` or print it.
3. You can generate charts! If the user's question involves a breakdown, trends, or comparisons, draw a plot using matplotlib (`plt.bar`, `plt.pie`, `plt.plot`, `plt.scatter`, etc.). Do NOT call `plt.show()`, just draw it and let the system save it. Set nice labels and titles, and use modern color palettes.
4. Treat sector names and other fields with flexibility (e.g. use `.str.lower()` or `.str.strip()` or fuzzy search like `.str.contains('energy', case=False)`).
5. Join dataframes if the question crosses both: deals_df and wo_df can be joined. You can join them by matching deal names: e.g. `deals_df.merge(wo_df, left_on='Deal Name', right_on='Deal name masked')` or client codes.
6. Address missing values/nans appropriately using `.fillna()` or `.dropna()` so the math is correct.
7. Return only code. No conversational preambles or postscripts.
"""

        prompt = f"""
We have the following dataframes available:
{schema_info}

Here is the data quality report (caveats):
{dq_report}

User Question: "{user_question}"

Please write the Python pandas code to analyze the data and answer this question.
"""
        
        # Self-correction loop (up to 3 attempts)
        code_block = ""
        execution_results = None
        
        for attempt in range(3):
            logger.info(f"Generating Python query code (attempt {attempt + 1})...")
            try:
                response_text = call_gemini_api(self.api_key, self.model_name, prompt, system_instruction)
            except Exception as api_err:
                return {
                    "answer": f"Gemini API Error: {str(api_err)}",
                    "caveats": "Unable to communicate with Gemini API.",
                    "chart_url": None
                }

            # Extract python code
            match = re.search(r"```python\s*(.*?)\s*```", response_text, re.DOTALL)
            if match:
                code_block = match.group(1)
            else:
                code_block = response_text.strip()
                # Clean up wrapping backticks if LLM didn't format correctly
                if code_block.startswith("```"):
                    code_block = code_block.strip("`").replace("python", "", 1).strip()

            logger.info(f"Executing generated code:\n{code_block}")
            execution_results = execute_pandas_query(code_block, deals_df, wo_df, self.static_dir)

            if execution_results["error"] is None:
                # Success! Break the loop
                break
            else:
                logger.warning(f"Execution failed: {execution_results['error']}")
                # Provide error output back to Gemini for self-correction
                prompt = f"""
The previous Python code you generated failed with the following traceback:
```
{execution_results["error"]}
```

Please correct the code to fix the error. Make sure to:
1. Return the entire corrected code block inside a single ```python ``` wrapper.
2. Ensure you handle NaN values, and double check column names.
"""

        # If we failed all 3 times, return error details
        if execution_results and execution_results["error"]:
            return {
                "answer": "Sorry, I encountered an internal error while executing the database query and was unable to self-correct.",
                "caveats": f"Traceback:\n{execution_results['error']}",
                "chart_url": None
            }

        # Step 2: Synthesis. Pass execution output to Gemini to write the natural language answer.
        synthesis_instruction = "You are a professional business intelligence advisor. Read the analytical results and write a concise, clear, and insightful answer to the founder's question. Detail any data quality caveats if necessary (such as missing values or rows excluded)."
        
        synthesis_prompt = f"""
User Question: "{user_question}"

Dataframes schemas & shapes:
- Deals shape: {deals_df.shape}
- Work Orders shape: {wo_df.shape}

Analytical script execution output:
Stdout:
{execution_results['stdout']}

Result variable:
{execution_results['result']}

Data quality report (caveats):
{dq_report}

Write a professional response summarizing this analysis. Point out any caveats, missing values, or exclusions that could affect the accuracy of the result. Use markdown formatting, bullet points, or tables where appropriate.
"""
        
        logger.info("Synthesizing final response...")
        try:
            final_answer = call_gemini_api(self.api_key, self.model_name, synthesis_prompt, synthesis_instruction)
        except Exception as api_err:
            final_answer = f"Analysis succeeded, but response synthesis failed: {str(api_err)}\nRaw result: {execution_results['result'] or execution_results['stdout']}"

        return {
            "answer": final_answer,
            "caveats": "Processed dynamically using in-memory data tables.",
            "chart_url": execution_results["chart_url"]
        }
