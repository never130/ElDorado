import cv2
import numpy as np
from typing import List, Dict, Optional, Tuple, Any

def detectar_numero_compuesto_desde_resultados(resultados_yolo, frame=None, umbral_agrupacion=50):
    """
    Agrupa números individuales detectados por YOLO en números compuestos.
    Adaptado del código de Colab para tu sistema existente.
    
    Args:
        resultados_yolo: Resultados de YOLO v8
        frame: Frame de imagen opcional para dibujar detecciones
        umbral_agrupacion: Distancia máxima entre números para agruparlos
    
    Returns:
        tuple: (frame_procesado, numero_compuesto, info_deteccion)
    """
    detecciones_actuales = []

    # Procesar resultados de YOLO
    if resultados_yolo and len(resultados_yolo) > 0 and resultados_yolo[0].boxes is not None:
        for box, cls, conf in zip(resultados_yolo[0].boxes.xyxy, resultados_yolo[0].boxes.cls, resultados_yolo[0].boxes.conf):
            x1, y1, x2, y2 = map(int, box)
            detecciones_actuales.append({
                'bbox': (x1, y1, x2, y2),
                'class': int(cls),
                'confidence': float(conf),
                'x_center': (x1 + x2) // 2,
                'y_center': (y1 + y2) // 2
            })

    if not detecciones_actuales:
        return frame, None, {}

    # Ordenar de izquierda a derecha para composición correcta
    detecciones_actuales.sort(key=lambda x: x['x_center'])

    # Agrupar números cercanos
    grupos = []
    if detecciones_actuales:
        grupo_actual = [detecciones_actuales[0]]
        
        for i in range(1, len(detecciones_actuales)):
            # Distancia entre el borde derecho del anterior y el izquierdo del actual
            distancia = detecciones_actuales[i]['bbox'][0] - detecciones_actuales[i - 1]['bbox'][2]
            
            # También verificar distancia vertical para evitar agrupar números de diferentes líneas
            distancia_vertical = abs(detecciones_actuales[i]['y_center'] - detecciones_actuales[i - 1]['y_center'])
            
            if distancia < umbral_agrupacion and distancia_vertical < 30:  # 30 píxeles de tolerancia vertical
                grupo_actual.append(detecciones_actuales[i])
            else:
                grupos.append(grupo_actual)
                grupo_actual = [detecciones_actuales[i]]
        grupos.append(grupo_actual)

    # Procesar grupos y encontrar el mejor
    mejor_grupo = None
    mejor_confianza = 0
    
    for grupo in grupos:
        confianza_promedio = sum(d['confidence'] for d in grupo) / len(grupo)
        # Priorizar grupos con más dígitos y mayor confianza
        score = confianza_promedio * (1 + len(grupo) * 0.1)  # Bonus por más dígitos
        
        if score > mejor_confianza:
            mejor_confianza = score
            mejor_grupo = grupo

    if not mejor_grupo:
        return frame, None, {}

    # Mapear clases a números reales usando tu mapeo existente
    numero_compuesto = "".join(
        mapear_clases_a_numeros(d['class']) for d in sorted(mejor_grupo, key=lambda x: x['bbox'][0])
    )
    
    # Calcular bbox que engloba todo el grupo
    x1_min = min(d['bbox'][0] for d in mejor_grupo)
    y1_min = min(d['bbox'][1] for d in mejor_grupo)
    x2_max = max(d['bbox'][2] for d in mejor_grupo)
    y2_max = max(d['bbox'][3] for d in mejor_grupo)
    bbox_completo = (x1_min, y1_min, x2_max, y2_max)

    # Dibujar en el frame si se proporciona
    if frame is not None:
        cv2.rectangle(frame, (x1_min, y1_min), (x2_max, y2_max), (255, 0, 0), 3)
        cv2.putText(frame, numero_compuesto, (x1_min, y1_min - 10), 
                   cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 0, 0), 2)
        
        # Dibujar confianza
        confianza_texto = f"Conf: {mejor_confianza/len(mejor_grupo):.2f}"
        cv2.putText(frame, confianza_texto, (x1_min, y2_max + 20), 
                   cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)

    info_deteccion = {
        'numero': numero_compuesto,
        'confidence': mejor_confianza / len(mejor_grupo),  # Confianza promedio real
        'bbox': bbox_completo,
        'detecciones_individuales': len(mejor_grupo),
        'grupos_totales': len(grupos),
        'detecciones_raw': detecciones_actuales
    }

    return frame, numero_compuesto, info_deteccion

def mapear_clases_a_numeros(clase_detectada: int) -> str:
    """
    Mapea las clases del modelo YOLO a números reales.
    Basado en tu modelo numeros_enteros existente.
    """    # Mapeo basado en las clases del nuevo modelo numeros_enteros (31 clases)
    mapeo_clases = {
        0: "01", 1: "010", 2: "011", 3: "012", 4: "013", 5: "014", 6: "015", 7: "016", 8: "017", 9: "018",
        10: "019", 11: "02", 12: "020", 13: "021", 14: "03", 15: "030", 16: "035", 17: "04", 18: "040",
        19: "05", 20: "050", 21: "06", 22: "060", 23: "07", 24: "070", 25: "08", 26: "080", 27: "085", 28: "09", 29: "094", 30: "125"
    }
    
    return mapeo_clases.get(clase_detectada, str(clase_detectada))

def aplicar_estabilizacion_video(historial_detecciones: List[Dict], nueva_deteccion: Dict, 
                                max_historial: int = 5) -> str:
    """
    Estabiliza detecciones en video usando historial de frames anteriores.
    Útil para sistemas de captura automática.
    """
    # Agregar nueva detección al historial
    historial_detecciones.append(nueva_deteccion)
    
    # Limitar tamaño del historial
    if len(historial_detecciones) > max_historial:
        historial_detecciones.pop(0)
    
    # Contar ocurrencias de cada número
    contador_numeros = {}
    for deteccion in historial_detecciones:
        numero = deteccion.get('numero')
        if numero:
            contador_numeros[numero] = contador_numeros.get(numero, 0) + 1
    
    if not contador_numeros:
        return None
    
    # Retornar el número más frecuente
    numero_estable = max(contador_numeros.keys(), key=lambda k: contador_numeros[k])
    
    # Solo considerar estable si aparece en al menos 60% de los frames
    if contador_numeros[numero_estable] >= len(historial_detecciones) * 0.6:
        return numero_estable
    
    return None

def mejorar_deteccion_con_filtros(detecciones: List[Dict], 
                                 min_confidence: float = 0.3,
                                 min_area: int = 100) -> List[Dict]:
    """
    Aplica filtros para mejorar la calidad de las detecciones.
    """
    detecciones_filtradas = []
    
    for det in detecciones:
        # Filtro por confianza
        if det['confidence'] < min_confidence:
            continue
        
        # Filtro por área mínima
        x1, y1, x2, y2 = det['bbox']
        area = (x2 - x1) * (y2 - y1)
        if area < min_area:
            continue
        
        # Filtro por aspect ratio (evitar detecciones muy distorsionadas)
        width = x2 - x1
        height = y2 - y1
        aspect_ratio = width / height if height > 0 else 0
        
        if 0.3 <= aspect_ratio <= 3.0:  # Rango razonable para números
            detecciones_filtradas.append(det)
    
    return detecciones_filtradas

def analizar_calidad_deteccion(info_deteccion: Dict) -> Dict:
    """
    Analiza la calidad de una detección y proporciona métricas útiles.
    """
    if not info_deteccion:
        return {"calidad": "baja", "score": 0, "recomendaciones": ["No se detectó número"]}
    
    calidad_score = 0
    recomendaciones = []
    
    # Factor de confianza (0-40 puntos)
    confidence = info_deteccion.get('confidence', 0)
    calidad_score += min(confidence * 40, 40)
    
    # Factor de número de dígitos (0-20 puntos)
    num_digitos = info_deteccion.get('detecciones_individuales', 0)
    if num_digitos >= 2:
        calidad_score += min(num_digitos * 5, 20)
    elif num_digitos == 1:
        recomendaciones.append("Solo se detectó un dígito")
    
    # Factor de consistencia (menos grupos = mejor, 0-20 puntos)
    grupos_totales = info_deteccion.get('grupos_totales', 1)
    if grupos_totales == 1:
        calidad_score += 20
    else:
        calidad_score += max(20 - (grupos_totales - 1) * 5, 0)
        recomendaciones.append(f"Se detectaron {grupos_totales} grupos de números")
    
    # Factor de área del bbox (0-20 puntos)
    bbox = info_deteccion.get('bbox', (0, 0, 0, 0))
    area = (bbox[2] - bbox[0]) * (bbox[3] - bbox[1])
    if area > 1000:  # Área razonable
        calidad_score += 20
    elif area > 500:
        calidad_score += 10
        recomendaciones.append("Número detectado es pequeño")
    else:
        recomendaciones.append("Número detectado es muy pequeño")
    
    # Determinar nivel de calidad
    if calidad_score >= 80:
        nivel_calidad = "excelente"
    elif calidad_score >= 60:
        nivel_calidad = "buena"
    elif calidad_score >= 40:
        nivel_calidad = "regular"
    else:
        nivel_calidad = "baja"
    
    return {
        "calidad": nivel_calidad,
        "score": round(calidad_score, 1),
        "confidence": confidence,
        "recomendaciones": recomendaciones,
        "metricas": {
            "num_digitos": num_digitos,
            "grupos": grupos_totales,
            "area_bbox": area
        }
    }
