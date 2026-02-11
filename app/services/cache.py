import time
from functools import wraps
from typing import Any

_cache: dict[str, tuple[float, Any]] = {}


def ttl_cache(ttl_seconds: int = 300):
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            cache_key = f"{func.__module__}.{func.__qualname__}:{args}:{kwargs}"
            now = time.time()

            cached = _cache.get(cache_key)
            if cached is not None:
                cached_time, cached_value = cached
                if now - cached_time < ttl_seconds:
                    return cached_value

            result = func(*args, **kwargs)
            _cache[cache_key] = (now, result)
            return result

        wrapper.cache_clear = lambda: _cache.clear()
        return wrapper

    return decorator


def clear_all_caches() -> None:
    _cache.clear()
