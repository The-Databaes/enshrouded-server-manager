mod config;
mod error;
mod server;
mod state;
mod steamcmd;
mod util;

use tauri::Manager;

use crate::server::commands as server_commands;
use crate::state::AppState;
use crate::steamcmd::commands as steamcmd_commands;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_opener::init())
    .plugin(tauri_plugin_dialog::init())
    .setup(|app| {
      let data_dir = app.path().home_dir()?.join(state::DATA_DIR_NAME);
      app.manage(AppState::load(data_dir)?);
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      steamcmd_commands::steamcmd_status,
      steamcmd_commands::steamcmd_inspect,
      steamcmd_commands::steamcmd_detect,
      steamcmd_commands::steamcmd_adopt_existing,
      steamcmd_commands::steamcmd_install,
      steamcmd_commands::steamcmd_update,
      steamcmd_commands::steamcmd_cancel,
      steamcmd_commands::steamcmd_forget,
      server_commands::server_status,
      server_commands::server_inspect_folder,
      server_commands::server_install,
      server_commands::server_update,
      server_commands::server_verify,
      server_commands::server_check_update,
      server_commands::server_forget,
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
