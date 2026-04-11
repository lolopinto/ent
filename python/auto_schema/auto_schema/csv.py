from collections.abc import Iterable


def render_list_csv(values: Iterable[object]) -> str:
    str_l = [f"'{v}'" for v in values]
    return ", ".join(str_l)


def render_list_csv_as_list(values: Iterable[object]) -> str:
    str_l = [f"'{v}'" for v in values]
    return f"[{', '.join(str_l)}]"
