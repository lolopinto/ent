from typing import TypedDict
from .change_type import ChangeType


class Change(TypedDict, total=False):
    change: ChangeType
    desc: str
    col: str
    index: str
    edge_type: str
    extension: str
