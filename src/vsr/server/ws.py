"""Session notifications and live recording feedback."""

from asyncio import Lock

from fastapi import WebSocket, WebSocketDisconnect


class Connections:
    def __init__(self) -> None:
        self.clients: set[WebSocket] = set()
        self.lock = Lock()

    async def broadcast(self, event: dict | bytes | None = None) -> None:
        if event is None:
            event = {"type": "lanes_changed"}
        async with self.lock:
            for client in tuple(self.clients):
                try:
                    if isinstance(event, bytes):
                        await client.send_bytes(event)
                    else:
                        await client.send_json(event)
                except WebSocketDisconnect:
                    self.clients.discard(client)
