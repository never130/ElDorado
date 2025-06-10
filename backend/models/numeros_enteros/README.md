# Modelo YOLOv8 para Detección de Números de Vagonetas

## Descripción
Este directorio contiene el modelo YOLOv8 entrenado para la detección de números en vagonetas. El modelo (`best.pt`) es utilizado por el backend para identificar vagonetas y extraer sus números a partir de imágenes o frames de video.

## Estructura del Directorio del Modelo
```
numeros_enteros/
├── README.md               # Este archivo
└── yolo_model/
    ├── dataset/            # Archivos relacionados con el dataset original (si se incluyen)
    │   ├── CarroNenteros800.mp4 # Ejemplo de video usado en el dataset
    │   ├── README.dataset.txt   # Info del dataset
    │   └── README.roboflow.txt  # Info de Roboflow (si aplica)
    ├── detection/            # Scripts para pruebas de detección (si se incluyen)
    │   └── detect_video.py
    ├── result/               # Resultados de pruebas de detección (si se incluyen)
    │   ├── detecciones.json
    │   └── video_prueba.mp4
    └── training/             # Archivos de entrenamiento
        ├── best.pt           # El modelo entrenado final que usa la aplicación
        └── data.yaml         # Archivo de configuración del dataset para YOLO
        # train.py            # Script de entrenamiento (si se incluye)
```

**Nota:** El archivo principal utilizado por la aplicación backend es `training/best.pt`. Los otros archivos (dataset, scripts de detección/entrenamiento) son más relevantes para el proceso de desarrollo y re-entrenamiento del modelo.

## Uso por el Backend
El archivo `backend/utils/image_processing.py` carga este modelo (`best.pt`) para realizar las detecciones. La configuración del modelo, como el umbral de confianza, puede ser ajustada a través de la API del backend.

## Re-entrenamiento del Modelo (Opcional)

Si se necesita re-entrenar el modelo con un nuevo dataset:

1.  **Preparar el Dataset**:
    *   Asegúrate de que tu dataset esté en el formato esperado por YOLOv8.
    *   Actualiza el archivo `data.yaml` (ubicado generalmente junto al script de entrenamiento o en la carpeta del dataset) para que apunte a las rutas correctas de tus imágenes de entrenamiento y validación, y defina las clases.

2.  **Instalar `ultralytics`**:
    ```bash
    pip install ultralytics
    ```

3.  **Ejecutar el Entrenamiento**:
    Un script de entrenamiento típico (`train.py`) podría verse así:
    ```python
    from ultralytics import YOLO

    # Cargar un modelo base (ej. yolov8n.pt) o continuar desde un checkpoint
    model = YOLO("yolov8n.pt") # o model = YOLO("ruta/a/best.pt") para continuar

    # Entrenar el modelo
    results = model.train(
        data="ruta/a/tu/data.yaml", # Ruta al archivo de configuración del dataset
        epochs=150,                 # Número de épocas
        imgsz=1280,                 # Tamaño de imagen
        project="runs/train",       # Directorio para guardar los resultados del entrenamiento
        name="exp_nuevo_entrenamiento" # Nombre del experimento
    )

    # El mejor modelo se guardará en "runs/train/exp_nuevo_entrenamiento/weights/best.pt"
    # Luego, puedes copiar este `best.pt` a `backend/models/numeros_enteros/yolo_model/training/best.pt`
    # para que la aplicación lo utilice.
    ```
    Ajusta los parámetros (`data`, `epochs`, `imgsz`, `project`, `name`) según tus necesidades.

4.  **Actualizar el Modelo en la Aplicación**:
    Una vez que el entrenamiento haya finalizado y estés satisfecho con el nuevo `best.pt`, reemplaza el archivo existente en `backend/models/numeros_enteros/yolo_model/training/best.pt` con el nuevo modelo generado.

## Consideraciones
- El rendimiento de la detección depende de la calidad del dataset de entrenamiento y de los parámetros de entrenamiento.
- El archivo `best.pt` es el único estrictamente necesario en este directorio para que el backend funcione con el modelo pre-entrenado. Los demás archivos son para referencia o para facilitar el re-entrenamiento.
