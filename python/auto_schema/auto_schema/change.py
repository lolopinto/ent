from typing import TypedDict
from .change_type import ChangeType


class Change(TypedDict):
    change: ChangeType
    desc: str
    # optional
    col: str
    index: str
    edge_type: str
