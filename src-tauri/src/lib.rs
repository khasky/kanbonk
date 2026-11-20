// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

/// The app identifier was app.listva.local, and WebView2 keeps its profile (IndexedDB, localStorage)
/// in a folder named after the identifier. On the first start under the new identifier the old
/// profile is copied over; the web app then renames the data inside it. The old folder is kept.
#[cfg(windows)]
fn adopt_legacy_webview_profile() {
    use std::{fs, io, path::Path};

    fn copy_dir(from: &Path, to: &Path) -> io::Result<()> {
        fs::create_dir_all(to)?;
        for entry in fs::read_dir(from)? {
            let entry = entry?;
            let target = to.join(entry.file_name());
            if entry.file_type()?.is_dir() { copy_dir(&entry.path(), &target)? } else { fs::copy(entry.path(), &target).map(|_| ())? }
        }
        Ok(())
    }

    let Some(base) = std::env::var_os("LOCALAPPDATA").map(std::path::PathBuf::from) else { return };
    let legacy = base.join("app.listva.local");
    let current = base.join("com.khasky.kanbonk");
    if !legacy.is_dir() || current.exists() {
        return;
    }
    // Copy into a staging folder and rename it at the end, so an interrupted copy is retried on the next start.
    let staging = base.join("com.khasky.kanbonk.migrating");
    let _ = fs::remove_dir_all(&staging);
    if let Err(error) = copy_dir(&legacy, &staging).and_then(|_| fs::rename(&staging, &current)) {
        eprintln!("Could not copy the WebView profile from {}: {error}", legacy.display());
        let _ = fs::remove_dir_all(&staging);
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[cfg(windows)]
    adopt_legacy_webview_profile();
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![greet])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
