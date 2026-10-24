import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

describe("useDebouncedValue", () => {
  afterEach(() => vi.useRealTimers());

  it("solo entrega el último valor cuando deja de cambiar", () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ v }) => useDebouncedValue(v, 300), {
      initialProps: { v: "" },
    });

    rerender({ v: "a" });
    act(() => vi.advanceTimersByTime(100));
    rerender({ v: "an" });
    act(() => vi.advanceTimersByTime(100));
    rerender({ v: "ana" });

    // Aún no han pasado 300 ms desde la última tecla
    act(() => vi.advanceTimersByTime(299));
    expect(result.current).toBe("");

    act(() => vi.advanceTimersByTime(1));
    expect(result.current).toBe("ana");
  });
});
