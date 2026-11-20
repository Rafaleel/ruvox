from pydantic import BaseModel


class FakeLLM:
    """Stands in for StructuredLLM: returns canned outputs in order, records calls."""

    def __init__(self, *outputs: BaseModel | Exception) -> None:
        self.outputs = list(outputs)
        self.calls: list[tuple[str, str, str]] = []

    def run[T: BaseModel](
        self, agent: str, prompt: str, user_input: str, schema: type[T]
    ) -> T:
        self.calls.append((agent, prompt, user_input))
        output = self.outputs.pop(0)
        if isinstance(output, Exception):
            raise output
        assert isinstance(output, schema)
        return output
