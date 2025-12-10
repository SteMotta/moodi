use serialport;
use chrono::prelude::*;
// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn get_ports() -> Vec<String> {
    match serialport::available_ports() {
        Ok(ports) => {
            // Converte la lista di informazioni sulle porte in una lista di soli nomi
            ports.into_iter().map(|p| p.port_name).collect()
        }
        Err(e) => {
            // In caso di errore, stampa un messaggio nella console e restituisce una lista vuota
            eprintln!("Errore nel recuperare le porte seriali: {}", e);
            vec![]
        }
    }
}

#[tauri::command]
fn send_color(r: u8, g: u8, b: u8, port_name: String) {
    if port_name.is_empty() {
        eprintln!("Tentativo di invio senza una porta selezionata.");
        return;
    }

    let data_to_send = format!("{},{},{}\n", r, g, b);
    let baud_rate = 115_200;

    match serialport::new(&port_name, baud_rate).open() {
        Ok(mut port) => {
            // Corrisponde a: port.write(dataString, ...);
            match port.write(data_to_send.as_bytes()) {
                Ok(_) => {
                    // Corrisponde al console.log di successo
                    println!("Colore inviato a {}: {}", port_name, data_to_send.trim());
                }
                Err(e) => {
                    // Corrisponde al console.error di scrittura
                    eprintln!("Errore durante la scrittura sulla porta {}: {}", port_name, e);
                }
            }
            // In Rust, la porta viene chiusa automaticamente qui quando la variabile `port`
            // esce dallo scope, non è necessario chiamare `port.close()` esplicitamente.
        }
        Err(e) => {
            // Corrisponde al console.error di apertura
            eprintln!("Impossibile aprire la porta {}: {}", port_name, e);
        }
    }

}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![get_ports, send_color])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
