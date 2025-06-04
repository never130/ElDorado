
from ultralytics import YOLO

modelo = YOLO("runs/train_final/weights/best.pt")
modelo.predict(source="/content/videos/video_prueba.mp4", conf=0.7, save=True, project="runs", name="detect_final")
