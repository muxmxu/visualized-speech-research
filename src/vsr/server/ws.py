"""Session change notifications."""

from fastapi import WebSocket


class Connections:
    def __init__(self) -> None:
        self.clients: list[WebSocket] = []

    async def broadcast(self) -> None:
        for client in self.clients:
            await client.send_json({"type": "lanes_changed"})
