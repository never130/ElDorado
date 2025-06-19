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

        frame_width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        frame_height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        frame_count = 0
        last_time = time.time()
        fps = 0
        print(f"✅ Cámara conectada (Resolución: {frame_width}x{frame_height})")

        while True:
            try:
                ret, frame = cap.read()
                if not ret:
                    await asyncio.sleep(0.1)
                    continue
                
                frame_count += 1
                current_time = time.time()
                elapsed = current_time - last_time

                if elapsed >= 1.0:
                    fps = frame_count / elapsed
                    frame_count = 0
                    last_time = current_time
                    await manager.broadcast_json({
                        "type": "debug_info",
                        "data": {
                            "camera_id": camera_id,
                            "fps": round(fps, 1),
                            "resolution": f"{frame_width}x{frame_height}",
                            "timestamp": datetime.now().isoformat()
                        }
                    })

                # Realizar detección en algunos frames (cada 30 frames, aproximadamente 1-2 segundos)
                if frame_count % 30 == 0:
                    # Procesar el frame para detección
                    try:
                        _, _, _, numero_detectado, confianza_placa = detectar_vagoneta_y_placa_mejorado(frame)
                        
                        if numero_detectado and confianza_placa is not None:
                            # Convertir a float la confianza
                            confianza_float = float(confianza_placa) if confianza_placa is not None else 0.0
                            
                            # Solo procesar detecciones con confianza razonable
                            if confianza_float >= 0.5:
                                # Guardar imagen del frame
                                timestamp_str = datetime.now().strftime("%Y%m%d_%H%M%S_%f")[:-3]
                                frame_filename = f"detection_frame_{camera_id}_{timestamp_str}.jpg"
                                frame_path = UPLOAD_DIR / frame_filename
                                cv2.imwrite(str(frame_path), frame)
                                
                                # Crear registro en la BD
                                vagoneta_data = VagonetaCreate(
                                    numero=str(numero_detectado),
                                    imagen_path=f"uploads/{frame_filename}",
                                    timestamp=datetime.now(timezone.utc),
                                    tunel=camera_config.get("tunel", "Desconocido"),
                                    evento=camera_config.get("evento", "detección"),
                                    modelo_ladrillo=None,  # No se detecta en tiempo real
                                    merma=None,  # No se registra en tiempo real
                                    metadata={"source": "live_monitor", "camera_id": camera_id},
                                    confianza=confianza_float,
                                    origen_deteccion="live_monitor"
                                )
                                
                                record_id = crud.create_vagoneta_record(vagoneta_data)
                                
                                # Convertir a dict para enviar por WebSocket
                                db_record_dict = vagoneta_data.dict()
                                db_record_dict["_id"] = str(record_id)
                                db_record_dict["id"] = str(record_id)
                                if isinstance(db_record_dict.get("timestamp"), datetime):
                                    db_record_dict["timestamp"] = db_record_dict["timestamp"].isoformat()
                                
                                # Enviar detección a todos los clientes conectados
                                await manager.broadcast_json({
                                    "type": "new_detection",
                                    "data": db_record_dict
                                })
                                
                                print(f"🔍 Detección en vivo: N°{numero_detectado} (Conf: {confianza_float:.3f})")
                    except Exception as e:
                        print(f"❌ Error en detección: {e}")
                    
                    # Enviar info básica de monitoreo (sin detección)
                    await manager.broadcast_json({
                        "type": "monitor_status",
                        "data": {
                            "camera_id": camera_id,
                            "status": "started",
                            "timestamp": datetime.now().isoformat(),
                            "fps": round(fps, 1)
                        }
                    })

                await asyncio.sleep(0.01)
            except Exception as e:
                print(f"❌ Error en frame: {e}")
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
