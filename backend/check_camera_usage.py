import subprocess
import re

def check_camera_processes():
    """Verifica qué procesos están usando la cámara"""
    print("🔍 Buscando procesos que puedan estar usando la cámara...")
    
    try:
        # Obtener lista de procesos que comúnmente usan cámara
        result = subprocess.run(['tasklist'], capture_output=True, text=True, shell=True)
        processes = result.stdout
        
        camera_apps = [
            'Teams.exe', 'zoom.exe', 'Skype.exe', 'chrome.exe', 'firefox.exe', 
            'msedge.exe', 'obs64.exe', 'OBS.exe', 'Discord.exe', 'WhatsApp.exe',
            'CameraService.exe', 'WindowsCamera.exe', 'YourPhone.exe', 'python.exe'
        ]
        
        found_processes = []
        for app in camera_apps:
            if app.lower() in processes.lower():
                found_processes.append(app)
        
        if found_processes:
            print("⚠️ Procesos que podrían estar usando la cámara:")
            for process in found_processes:
                print(f"   - {process}")
        else:
            print("✅ No se encontraron procesos comunes que usen cámara")
            
        return found_processes
        
    except Exception as e:
        print(f"❌ Error verificando procesos: {e}")
        return []

def check_camera_permissions():
    """Verifica configuración de privacidad de cámara en Windows"""
    print("\n🔒 Verificando permisos de cámara...")
    print("Para verificar permisos manualmente:")
    print("1. Ve a Configuración de Windows (Win + I)")
    print("2. Privacidad y seguridad > Cámara")
    print("3. Asegúrate de que 'Permitir acceso a la cámara' esté activado")
    print("4. Asegúrate de que 'Permitir que las aplicaciones de escritorio accedan a tu cámara' esté activado")

if __name__ == "__main__":
    processes = check_camera_processes()
    check_camera_permissions()
    
    if processes:
        print(f"\n💡 Sugerencia: Cierra estas aplicaciones y vuelve a intentar:")
        for process in processes:
            print(f"   - {process}")
    else:
        print("\n🤔 La cámara podría estar bloqueada a nivel de sistema o tener problemas de driver")
