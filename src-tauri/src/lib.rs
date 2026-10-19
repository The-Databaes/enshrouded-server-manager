mod config;
mod error;
mod pty;
mod server;
mod state;
mod steamcmd;
mod util;

use std::sync::Arc;
use std::time::Duration;

use tauri::{AppHandle, Emitter, Manager, RunEvent, State, WindowEvent};

use crate::error::Result;
use crate::server::commands as server_commands;
use crate::server::runtime::STOP_TIMEOUT;
use crate::state::AppState;
use crate::steamcmd::commands as steamcmd_commands;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_opener::init())
    .plugin(tauri_plugin_dialog::init())
    .setup(|app| {
      let data_dir = app.path().home_dir()?.join(state::DATA_DIR_NAME);
      app.manage(AppState::load(data_dir, Arc::new(app.handle().clone()))?);
      Ok(())
    })
    .on_window_event(|window, event| {
      // Closing the window would take the server down with it, unsaved, so
      // let the UI ask first (it then calls `app_quit`).
      if let WindowEvent::CloseRequested { api, .. } = event {
        if window.state::<AppState>().runtime.is_active() {
          api.prevent_close();
          let _ = window.emit(CLOSE_REQUESTED_EVENT, ());
        }
      }
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
      server_commands::server_runtime_status,
      server_commands::server_log,
      server_commands::server_player_history,
      server_commands::server_start,
      server_commands::server_stop,
      server_commands::server_kill,
      server_commands::server_restart,
      server_commands::server_kill_external,
      server_commands::server_settings_get,
      server_commands::server_settings_save,
      app_quit,
    ])
    .build(tauri::generate_context!())
    .expect("error while building tauri application")
    .run(|app, event| {
      // Last line of defence (e.g. the UI didn't get to ask): never leave
      // without giving the server its chance to save.
      if let RunEvent::Exit = event {
        let runtime = &app.state::<AppState>().runtime;
        tauri::async_runtime::block_on(runtime.shut_down(STOP_TIMEOUT));
      }
    });
}

/// Sent when the window is closed while the server is running.
const CLOSE_REQUESTED_EVENT: &str = "app://close-requested";

/// Quit the app. A running server is first stopped and given time to save,
/// or with `force`, closed immediately.
#[tauri::command]
async fn app_quit(app: AppHandle, state: State<'_, AppState>, force: bool) -> Result<()> {
  if force {
    state.runtime.kill()?;
    let _ = tokio::time::timeout(Duration::from_secs(10), state.runtime.wait_stopped()).await;
  } else {
    state.runtime.shut_down(STOP_TIMEOUT).await;
  }
  app.exit(0);
  Ok(())
}
