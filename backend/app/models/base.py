from abc import ABC, abstractmethod
from typing import Dict, Any

class BaseVoiceModel(ABC):
    """
    Base class for voice authentication pipeline models.
    Each model explicitly tracks its availability and integration status.
    """
    def __init__(self, name: str, expected_weight_path: str):
        self.name = name
        self.expected_weight_path = expected_weight_path
        self._is_loaded = False
        self._error_message: str = "Model weights not yet loaded"

    @property
    def is_available(self) -> bool:
        return self._is_loaded

    @abstractmethod
    def load(self) -> bool:
        pass

    @abstractmethod
    def get_status(self) -> Dict[str, Any]:
        pass
