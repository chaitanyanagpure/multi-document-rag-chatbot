"""
VerbaFlow AI - LLM Service
Abstraction layer over Google Gemini and OpenAI GPT models.
Supports streaming responses, chat structure formatting, and token counting.

KEY FIXES (v2):
- acomplete_stream() uses generate_content_async() for TRUE async streaming
- count_tokens() uses fast local estimation instead of blocking Gemini API call
- Explicit per-call timeout protection
- Reduced retry count to fail fast and surface errors quickly
"""
from __future__ import annotations

import logging
import re
import asyncio
from abc import ABC, abstractmethod
from typing import List, Dict, AsyncIterator, Any
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential

from app.core.config import settings

logger = logging.getLogger(__name__)


class BaseLLMProvider(ABC):
    """Abstract base class for all LLM providers."""

    @abstractmethod
    async def acomplete(
        self, messages: List[Dict[str, str]], system_instruction: str | None = None
    ) -> str:
        """Non-streaming text generation."""
        ...

    @abstractmethod
    async def acomplete_stream(
        self, messages: List[Dict[str, str]], system_instruction: str | None = None
    ) -> AsyncIterator[str]:
        """Streaming text generation - returns an async generator."""
        ...

    @abstractmethod
    def count_tokens(self, text: str) -> int:
        """Fast local token count estimation (no API call)."""
        ...


class GeminiProvider(BaseLLMProvider):
    """
    Google Gemini API Provider.
    Maps OpenAI-style messages: 'assistant' -> 'model', 'system' -> system_instruction.

    FIX: Uses generate_content_async() for true async streaming instead of
    run_in_executor with synchronous iteration.
    """

    def __init__(self, model: str = settings.GEMINI_MODEL) -> None:
        self.model_name = model
        self._client = None

    def _get_client(self):
        if self._client is None:
            import google.generativeai as genai
            genai.configure(api_key=settings.GEMINI_API_KEY)
            self._client = genai
        return self._client

    def _format_messages(self, messages: List[Dict[str, str]]) -> List[Any]:
        """Format messages to Google Generative AI contents schema."""
        formatted = []
        for msg in messages:
            role = msg["role"]
            if role == "system":
                continue  # System prompts are passed via system_instruction param
            gemini_role = "user" if role == "user" else "model"
            formatted.append({
                "role": gemini_role,
                "parts": [{"text": msg["content"]}]
            })
        # Gemini requires alternating user/model turns; ensure last message is user
        if formatted and formatted[-1]["role"] != "user":
            formatted.append({"role": "user", "parts": [{"text": "Continue."}]})
        return formatted

    def _extract_system_instruction(
        self, messages: List[Dict[str, str]], system_instruction: str | None
    ) -> str | None:
        """Extract system instruction from messages if not explicitly provided."""
        if system_instruction:
            return system_instruction
        return next((m["content"] for m in messages if m["role"] == "system"), None)

    def _sleep_for_rate_limit(self, err_msg: str, attempt: int) -> float:
        """Parse retry-after from error message, fall back to exponential backoff."""
        retry_match = re.search(r"retry\s+in\s+([\d\.]+)\s*s", err_msg)
        seconds_match = re.search(r"seconds:\s*(\d+)", err_msg)
        if retry_match:
            return min(int(float(retry_match.group(1))) + 1, 30)
        elif seconds_match:
            return min(int(seconds_match.group(1)) + 1, 30)
        return min(2 * (2 ** attempt), 30)  # Capped exponential: 4, 8, 16, 30

    async def acomplete(
        self, messages: List[Dict[str, str]], system_instruction: str | None = None
    ) -> str:
        """
        Non-streaming completion with rate-limit retry.
        Used for: query expansion, reranking (disabled by default).
        Timeout: 30 seconds per attempt.
        """
        client = self._get_client()
        formatted = self._format_messages(messages)
        sys_instr = self._extract_system_instruction(messages, system_instruction)

        model = client.GenerativeModel(
            model_name=self.model_name,
            system_instruction=sys_instr
        )

        max_retries = 2  # Fail fast - don't block for minutes
        for attempt in range(max_retries):
            try:
                response = await asyncio.wait_for(
                    asyncio.get_event_loop().run_in_executor(
                        None,
                        lambda: model.generate_content(contents=formatted)
                    ),
                    timeout=30.0
                )
                return response.text or ""
            except asyncio.TimeoutError:
                logger.warning(f"[LLM] acomplete timed out (attempt {attempt+1}/{max_retries})")
                if attempt == max_retries - 1:
                    raise TimeoutError("Gemini acomplete timed out after 30s")
            except Exception as e:
                err_msg = str(e).lower()
                is_rate_limit = any(x in err_msg for x in ["429", "resource_exhausted", "quota"])
                if is_rate_limit and attempt < max_retries - 1:
                    sleep_time = self._sleep_for_rate_limit(err_msg, attempt)
                    logger.warning(
                        f"[LLM] Rate limit hit (attempt {attempt+1}/{max_retries}). "
                        f"Sleeping {sleep_time:.1f}s. Error: {e}"
                    )
                    await asyncio.sleep(sleep_time)
                else:
                    logger.error(f"[LLM] acomplete failed: {e}")
                    raise

        raise RuntimeError("acomplete: all retries exhausted")

    async def acomplete_stream(
        self, messages: List[Dict[str, str]], system_instruction: str | None = None
    ) -> AsyncIterator[str]:
        """
        TRUE async streaming using generate_content_async() with stream=True.

        FIX: Previously used run_in_executor + sync for-loop which blocked the event loop.
        Now uses the native async API so tokens are yielded as they arrive.
        """
        client = self._get_client()
        import google.generativeai as genai

        formatted = self._format_messages(messages)
        sys_instr = self._extract_system_instruction(messages, system_instruction)

        model = client.GenerativeModel(
            model_name=self.model_name,
            system_instruction=sys_instr
        )

        max_retries = 3
        last_err = None

        for attempt in range(max_retries):
            try:
                async def _stream_generator():
                    try:
                        # generate_content_async with stream=True yields chunks asynchronously
                        async for chunk in await model.generate_content_async(
                            contents=formatted,
                            stream=True
                        ):
                            try:
                                text = chunk.text
                                if text:
                                    yield text
                            except Exception:
                                # Some chunks may have no text (finish_reason only)
                                pass
                    except Exception as stream_err:
                        err_msg = str(stream_err).lower()
                        logger.error(f"[LLM] Stream error: {stream_err}")
                        if any(x in err_msg for x in ["429", "resource_exhausted", "quota"]):
                            yield "\n\n[Error: Model quota exceeded. Please wait a moment and try again.]"
                        elif any(x in err_msg for x in ["timeout", "deadline"]):
                            yield "\n\n[Error: LLM response timed out. Please try again.]"
                        else:
                            yield f"\n\n[Error: {str(stream_err)[:200]}]"

                return _stream_generator()

            except Exception as e:
                err_msg = str(e).lower()
                is_rate_limit = any(x in err_msg for x in ["429", "resource_exhausted", "quota"])
                last_err = e
                if is_rate_limit and attempt < max_retries - 1:
                    sleep_time = self._sleep_for_rate_limit(err_msg, attempt)
                    logger.warning(
                        f"[LLM] Stream rate limit (attempt {attempt+1}/{max_retries}). "
                        f"Sleeping {sleep_time:.1f}s."
                    )
                    await asyncio.sleep(sleep_time)
                else:
                    logger.error(f"[LLM] Stream init failed: {e}")
                    break

        # If all retries failed, return an error generator
        async def _error_generator():
            err_str = str(last_err).lower() if last_err else ""
            if any(x in err_str for x in ["429", "resource_exhausted", "quota"]):
                yield "[Error: Model quota exceeded. Please try again in a few minutes.]"
            elif any(x in err_str for x in ["api_key", "unauthorized"]):
                yield "[Error: Invalid API key. Please check your AI provider credentials.]"
            else:
                yield f"[Error: Failed to connect to AI provider: {str(last_err)[:200]}]"

        return _error_generator()

    def count_tokens(self, text: str) -> int:
        """
        Fast LOCAL token count estimation.

        FIX: Previously called model.count_tokens() which makes a blocking Gemini API
        call adding 200-500ms latency per chat. Now uses a simple word-based estimate
        (industry standard: ~1.3 tokens per word for English text).
        """
        if not text:
            return 0
        word_count = len(text.split())
        return int(word_count * 1.3)


class OpenAIProvider(BaseLLMProvider):
    """OpenAI API Provider."""

    def __init__(self, model: str = settings.OPENAI_MODEL) -> None:
        self.model_name = model
        self._client = None

    def _get_client(self):
        if self._client is None:
            from openai import AsyncOpenAI
            self._client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
        return self._client

    def _format_messages(
        self, messages: List[Dict[str, str]], system_instruction: str | None = None
    ) -> List[Dict[str, str]]:
        formatted = []
        if system_instruction:
            formatted.append({"role": "system", "content": system_instruction})
        for msg in messages:
            if msg["role"] != "system":
                formatted.append({"role": msg["role"], "content": msg["content"]})
        return formatted

    @retry(
        retry=retry_if_exception_type(Exception),
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        reraise=True,
    )
    async def acomplete(
        self, messages: List[Dict[str, str]], system_instruction: str | None = None
    ) -> str:
        client = self._get_client()
        formatted_messages = self._format_messages(messages, system_instruction)
        response = await client.chat.completions.create(
            model=self.model_name,
            messages=formatted_messages,
            timeout=30.0
        )
        return response.choices[0].message.content or ""

    @retry(
        retry=retry_if_exception_type(Exception),
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        reraise=True,
    )
    async def acomplete_stream(
        self, messages: List[Dict[str, str]], system_instruction: str | None = None
    ) -> AsyncIterator[str]:
        client = self._get_client()
        formatted_messages = self._format_messages(messages, system_instruction)

        response = await client.chat.completions.create(
            model=self.model_name,
            messages=formatted_messages,
            stream=True,
            timeout=120.0
        )

        async def generator():
            try:
                async for chunk in response:
                    content = chunk.choices[0].delta.content
                    if content:
                        yield content
            except Exception as e:
                logger.error(f"[LLM] OpenAI stream error: {e}")
                yield f"\n\n[Error: {str(e)[:200]}]"

        return generator()

    def count_tokens(self, text: str) -> int:
        """Fast local estimation using tiktoken if available, else word count."""
        try:
            import tiktoken
            encoding = tiktoken.encoding_for_model(self.model_name)
            return len(encoding.encode(text))
        except Exception:
            return int(len(text.split()) * 1.3)


class LLMServiceFactory:
    """Factory returning the configured LLMProvider implementation (singleton)."""

    _instance: BaseLLMProvider | None = None

    @classmethod
    def get_provider(cls, provider: str | None = None) -> BaseLLMProvider:
        if cls._instance is not None:
            return cls._instance

        prov = provider or settings.LLM_PROVIDER
        if prov == "gemini":
            cls._instance = GeminiProvider()
        elif prov == "openai":
            cls._instance = OpenAIProvider()
        else:
            raise ValueError(f"Unknown LLM provider: {prov}")

        logger.info(f"[LLM] Provider initialized: {prov} (model: {cls._instance.model_name})")
        return cls._instance

    @classmethod
    def reset(cls) -> None:
        cls._instance = None
