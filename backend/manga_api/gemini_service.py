import os
import google.generativeai as genai
from django.conf import settings

TRANSLATION_PROMPT = """[TASK] You are an expert AI Manga Translator. Your task is to perform an end-to-end process of OCR, context-aware analysis, and English translation on the provided manga page image.

[INPUT RULES]
1. Read the provided manga image as the sole source.
2. The primary reading order is from right to left, top to bottom. Follow this logic.

[TRANSLATION GUIDELINES]
1. Focus only on relevant text for a human-readable English version.
2. DO NOT include onomatopoeia (SFX like "BANG," "ZAP," "RUMBLE"). Ignore them entirely.
3. Keep translations precise to the scene and the characters' expressions.
4. If a word is a specific term from the manga universe (a name, an ability, a place), leave it untranslated, or include the original Japanese in parentheses if helpful for context.

[OUTPUT FORMAT]
1. Generate the final output with a clean-text-only format.
2. Use single apostrophes ('...') to identify each distinct piece of dialogue or speech bubble.
3. Every speech bubble or text box should have its own line, preceded by a blank line for readability.
4. DO NOT provide any notes, commentary, or introduction of any kind. Deliver the translations in reading order.
5. Provide a direct translation of the page's text contents, without any headers or extra text."""


def translate_page_with_gemini(image_bytes: bytes, mime_type: str = "image/jpeg") -> str:
    """
    Send a manga page image to Gemini and return the translation.
    
    Args:
        image_bytes: Raw image bytes
        mime_type: MIME type of the image (image/jpeg, image/png, etc.)
    
    Returns:
        Translation string or error message
    """
    api_key = settings.GEMINI_API_KEY
    if not api_key:
        return "Error: GEMINI_API_KEY is not configured on the server."

    genai.configure(api_key=api_key)
    model = genai.GenerativeModel("gemini-2.5-flash")

    image_part = {
        "mime_type": mime_type,
        "data": image_bytes,
    }

    try:
        response = model.generate_content([TRANSLATION_PROMPT, image_part])
        return response.text
    except Exception as e:
        return f"Translation error: {str(e)}"
