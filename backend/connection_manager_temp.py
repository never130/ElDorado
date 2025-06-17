class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        print(f"WebSocket connection established: {websocket.client}")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        print(f"WebSocket connection closed: {websocket.client}")

    async def send_personal_message(self, message: str, websocket: WebSocket):
        await websocket.send_text(message)

    async def send_json_to_connection(self, data: dict, websocket: WebSocket):
        """Enviar mensaje JSON a una conexión específica"""
        try:
            await websocket.send_json(data)
        except Exception as e:
            print(f"❌ Error enviando mensaje JSON a {websocket.client}: {e}")

    async def broadcast(self, message: str):
        for connection in self.active_connections:
            await connection.send_text(message)

    async def broadcast_json(self, data: dict):
        print(f"📡 Broadcasting a {len(self.active_connections)} conexiones: {data.get('type', 'unknown')}")
        for connection in self.active_connections:
            try:
                await connection.send_json(data)
                print(f"✅ Mensaje enviado a {connection.client}")
            except Exception as e:
                print(f"❌ Error enviando a {connection.client}: {e}")
                # Remove broken connections
                if connection in self.active_connections:
                    self.active_connections.remove(connection)

manager = ConnectionManager()
