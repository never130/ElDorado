async def monitor_camera_live(camera_id: str, camera_config: dict):
    """Función para monitorear una cámara en tiempo real"""
    cap = None
    try:
        camera_url = camera_config["camera_url"]
        print(f"🎥 Iniciando monitoreo para cámara {camera_id} (URL: {camera_url})")

        if isinstance(camera_url, (int, str)) and str(camera_url).isdigit():
            cap = cv2.VideoCapture(int(camera_url))
        else:
            cap = cv2.VideoCapture(str(camera_url))

        if not cap.isOpened():
            raise Exception(f"No se pudo abrir la cámara {camera_id}")

        # Configurar propiedades
        cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
        cap.set(cv2.CAP_PROP_FPS, 15)

        # Verificar lectura
        ret, frame = cap.read()
        if not ret or frame is None:
            raise Exception(f"No se pueden leer frames de la cámara {camera_id}")

        # Configuración inicial
        frame_width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        frame_height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        frame_count = 0
        last_time = time.time()
        fps = 0

        print(f"✅ Cámara conectada (Resolución: {frame_width}x{frame_height})")

        # Bucle de monitoreo
        while True:
            try:
                ret, frame = cap.read()
                if not ret:
                    await asyncio.sleep(0.1)
                    continue

                # Control de FPS
                frame_count += 1
                current_time = time.time()
                elapsed = current_time - last_time

                if elapsed >= 1.0:
                    fps = frame_count / elapsed
                    frame_count = 0
                    last_time = current_time

                    # Enviar estadísticas
                    await manager.broadcast_json({
                        "type": "debug_info",
                        "data": {
                            "camera_id": camera_id,
                            "fps": round(fps, 1),
                            "resolution": f"{frame_width}x{frame_height}",
                            "timestamp": datetime.now().isoformat()
                        }
                    })

                # Procesamiento cada 30 frames
                if frame_count % 30 == 0:
                    await manager.broadcast_json({
                        "type": "detection",
                        "data": {
                            "camera_id": camera_id,
                            "timestamp": datetime.now().isoformat(),
                            "fps": round(fps, 1)
                        }
                    })

                await asyncio.sleep(0.01)

            except Exception as e:
                print(f"Error en frame: {e}")
                await asyncio.sleep(0.1)

    except asyncio.CancelledError:
        print(f"🛑 Monitor cancelado: {camera_id}")
    except Exception as e:
        print(f"❌ Error: {e}")
        raise
    finally:
        if cap:
            cap.release()
            print(f"📹 Cámara liberada: {camera_id}")
