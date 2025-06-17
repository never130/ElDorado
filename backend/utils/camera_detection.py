import cv2

def get_connected_cameras():
    """
    Detecta únicamente la webcam integrada o la primera cámara USB conectada.
    
    Returns:
        list: Lista con la información de la cámara detectada
    """
    available_cameras = []
    
    try:
        # Intentar primero con la cámara 0 (generalmente la webcam integrada)
        cap = cv2.VideoCapture(0, cv2.CAP_DSHOW)  # Usar DirectShow en Windows
        if cap.isOpened():
            ret, frame = cap.read()
            if ret:
                # Obtener información de la cámara
                width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
                height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
                fps = int(cap.get(cv2.CAP_PROP_FPS))
                
                # Intentar obtener el nombre real de la cámara
                backend = cv2.CAP_DSHOW
                camera_name = "Webcam"
                try:
                    camera_name = cap.getBackendName()
                except:
                    pass
                
                camera_info = {
                    "camera_id": "0",
                    "index": 0,
                    "resolution": f"{width}x{height}",
                    "fps": fps,
                    "name": camera_name,
                    "is_connected": True,
                    "type": "webcam"
                }
                available_cameras.append(camera_info)
            cap.release()
    except Exception as e:
        print(f"Error detectando cámara: {str(e)}")
    
    return available_cameras
