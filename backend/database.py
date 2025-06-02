from pymongo import MongoClient, IndexModel, ASCENDING, DESCENDING
from pymongo.errors import ConnectionFailure, OperationFailure
import os
from typing import Optional

# Cargar variables de entorno para la conexión a MongoDB
MONGO_HOST = os.getenv("MONGO_HOST", "localhost")
MONGO_PORT = int(os.getenv("MONGO_PORT", 27017)) # Asegúrate de que sea un entero
MONGO_USER = os.getenv("MONGO_USER") # Puede ser None si no se requiere autenticación
MONGO_PASS = os.getenv("MONGO_PASS") # Puede ser None
DB_NAME = os.getenv("MONGO_DB_NAME", "el_dorado") # Actualizado al nombre de tu BD
MONGO_AUTH_DB = os.getenv("MONGO_AUTH_DB", "admin") # Base de datos para autenticación

# Cliente de MongoDB
client: Optional[MongoClient] = None
db = None

def connect_to_mongo():
    """Establece la conexión con MongoDB"""
    global client, db
    if client is None:
        try:
            if MONGO_USER and MONGO_PASS:
                # Conectar con autenticación
                client = MongoClient(
                    host=MONGO_HOST,
                    port=MONGO_PORT,
                    username=MONGO_USER,
                    password=MONGO_PASS,
                    authSource=MONGO_AUTH_DB,
                    authMechanism='SCRAM-SHA-256' # O SCRAM-SHA-1 según tu config de MongoDB
                )
                print(f"✅ Conectando a MongoDB en {MONGO_HOST}:{MONGO_PORT} con usuario {MONGO_USER} a la BD '{DB_NAME}'")
            else:
                # Conectar sin autenticación (para desarrollo local sin credenciales)
                mongo_uri_local = f"mongodb://{MONGO_HOST}:{MONGO_PORT}/"
                client = MongoClient(mongo_uri_local)
                print(f"✅ Conectando a MongoDB en {MONGO_HOST}:{MONGO_PORT} sin autenticación a la BD '{DB_NAME}'")
            
            # Probar la conexión
            client.admin.command('ping')
            db = client[DB_NAME]
            
            # Crear índices básicos si no existen
            # Primero, verifica si la colección 'vagonetas' existe, si no, no intentes crear índices aún.
            # Los índices se crearán cuando se inserte el primer dato si la colección no existe.
            # O puedes crear la colección explícitamente si es necesario antes de crear índices.
            if 'vagonetas' in db.list_collection_names():
                existing_indexes = [index['name'] for index in db.vagonetas.list_indexes()]
                indexes_to_create = [
                    IndexModel([("numero", ASCENDING)], name="numero_asc_idx"),
                    IndexModel([("timestamp", DESCENDING)], name="timestamp_desc_idx"),
                    IndexModel([("evento", ASCENDING)], name="evento_asc_idx")
                ]
                
                new_indexes_added = False
                for index_model in indexes_to_create:
                    # Nombres de índice deben ser únicos
                    if index_model.document['name'] not in existing_indexes:
                        db.vagonetas.create_indexes([index_model])
                        new_indexes_added = True
                
                if new_indexes_added:
                    print("🔧 Índices creados/verificados en la colección 'vagonetas'.")
                else:
                    print("👍 Índices ya existen en la colección 'vagonetas'.")
            else:
                print("ℹ️ La colección 'vagonetas' aún no existe. Los índices se crearán más tarde o manualmente.")
                
            print(f"✅ Conexión a MongoDB establecida y base de datos '{DB_NAME}' seleccionada.")

        except OperationFailure as e:
            print(f"❌ Error de autenticación o operación en MongoDB: {str(e)}")
            print(f"   Detalles: {e.details}")
            print("   Verifica tus credenciales (MONGO_USER, MONGO_PASS), MONGO_AUTH_DB y que el usuario tenga permisos para la base de datos '{DB_NAME}'.")
            client = None # Asegura que no se reintente con un cliente fallido
            db = None
            raise
        except ConnectionFailure as e:
            print(f"❌ Error conectando a MongoDB en {MONGO_HOST}:{MONGO_PORT}: {str(e)}")
            print("   Asegúrate de que MongoDB esté corriendo y accesible.")
            client = None
            db = None
            raise
        except Exception as e:
            print(f"❌ Error inesperado conectando a MongoDB: {str(e)}")
            client = None
            db = None
            raise

def close_mongo_connection():
    """Cierra la conexión con MongoDB"""
    global client, db
    if client:
        client.close()
        client = None
        db = None
        print("🔌 Conexión a MongoDB cerrada.")

def get_database():
    """Obtiene la base de datos, estableciendo la conexión si es necesario"""
    global db
    if db is None or client is None: # Si el cliente es None, la conexión falló o se cerró
        connect_to_mongo()
    return db

def get_vagonetas_collection():
    """Obtiene la colección de vagonetas"""
    database = get_database()
    # Asegurarse de que la base de datos no sea None después de intentar conectar
    if database is None:
        raise Exception("No se pudo obtener la instancia de la base de datos. La conexión pudo haber fallado.")
    return database.vagonetas

# Opcional: Función para probar la conexión al iniciar el módulo si es necesario
# def test_db_connection():
#     try:
#         get_database()
#         print("Database connection test successful.")
#     except Exception as e:
#         print(f"Database connection test failed: {e}")

# if __name__ == "__main__":
#     # Esto es solo para probar la conexión directamente si ejecutas este archivo
#     # En una aplicación FastAPI, connect_to_mongo se llamaría en el startup event
#     try:
#         connect_to_mongo()
#         vagonetas_collection = get_vagonetas_collection()
#         print(f"Colección 'vagonetas' obtenida de la base de datos '{DB_NAME}'.")
#         # Ejemplo: contar documentos
#         # print(f"Número de documentos en vagonetas: {vagonetas_collection.count_documents({})}")
#     except Exception as e:
#         print(f"Error durante la prueba de conexión directa: {e}")
#     finally:
#         close_mongo_connection()
