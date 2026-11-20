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

/// Automatic backups write, list and delete only `kanbonk-auto-*.zip` files directly inside the
/// folder the user configured, so these commands cannot touch other files.
mod backup_folder {
    use std::{fs, path::PathBuf};
    use tauri::{ipc::{InvokeBody, Request}, Manager};

    fn backup_file(dir: &str, name: &str) -> Result<PathBuf, String> {
        let valid = name.starts_with("kanbonk-auto-") && name.ends_with(".zip") && !name.contains(['/', '\\', ':']) && !name.contains("..");
        if !valid || dir.is_empty() { return Err(format!("Not a backup file: {name}")); }
        Ok(PathBuf::from(dir).join(name))
    }

    /// Header values are ASCII, so the JavaScript side percent-encodes the folder and file name.
    fn header(request: &Request, key: &str) -> Result<String, String> {
        let raw = request.headers().get(key).and_then(|value| value.to_str().ok()).ok_or(format!("Missing {key}"))?;
        let mut bytes = Vec::with_capacity(raw.len());
        let mut chars = raw.bytes();
        while let Some(byte) = chars.next() {
            if byte == b'%' {
                let hex = [chars.next().ok_or("Bad encoding")?, chars.next().ok_or("Bad encoding")?];
                bytes.push(u8::from_str_radix(std::str::from_utf8(&hex).map_err(|e| e.to_string())?, 16).map_err(|e| e.to_string())?);
            } else { bytes.push(byte) }
        }
        String::from_utf8(bytes).map_err(|e| e.to_string())
    }

    #[tauri::command]
    pub fn backup_default_dir(app: tauri::AppHandle) -> Result<String, String> {
        let documents = app.path().document_dir().map_err(|e| e.to_string())?;
        Ok(documents.join("Kanbonk Backups").to_string_lossy().into_owned())
    }

    #[tauri::command]
    pub fn backup_write(request: Request) -> Result<(), String> {
        let InvokeBody::Raw(data) = request.body() else { return Err("Expected file bytes".into()) };
        let dir = header(&request, "x-dir")?;
        let path = backup_file(&dir, &header(&request, "x-name")?)?;
        fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
        // Write next to the target and rename, so a crash never leaves a truncated ZIP under the real name.
        let partial = path.with_extension("zip.partial");
        fs::write(&partial, data).and_then(|_| fs::rename(&partial, &path)).map_err(|e| { let _ = fs::remove_file(&partial); e.to_string() })
    }

    #[tauri::command]
    pub fn backup_list(dir: String) -> Result<Vec<String>, String> {
        let Ok(entries) = fs::read_dir(&dir) else { return Ok(Vec::new()) };
        Ok(entries.filter_map(|entry| entry.ok()?.file_name().into_string().ok()).filter(|name| backup_file(&dir, name).is_ok()).collect())
    }

    #[tauri::command]
    pub fn backup_remove(dir: String, name: String) -> Result<(), String> {
        fs::remove_file(backup_file(&dir, &name)?).map_err(|e| e.to_string())
    }

    #[cfg(test)]
    mod tests {
        use super::*;

        #[test]
        fn lists_and_removes_only_backup_files() {
            let dir = std::env::temp_dir().join(format!("Резервные копии {}", std::process::id()));
            let dir_str = dir.to_string_lossy().into_owned();
            fs::create_dir_all(&dir).unwrap();
            for name in ["kanbonk-auto-1-1of1.zip", "kanbonk-auto-2-1of1.zip.partial", "notes.zip"] { fs::write(dir.join(name), b"x").unwrap(); }
            assert_eq!(backup_list(dir_str.clone()).unwrap(), vec!["kanbonk-auto-1-1of1.zip"]);
            assert!(backup_remove(dir_str.clone(), "notes.zip".into()).is_err());
            assert!(backup_remove(dir_str.clone(), "kanbonk-auto-../../x.zip".into()).is_err());
            assert!(backup_file(&dir_str, "kanbonk-auto-C:x.zip").is_err());
            backup_remove(dir_str.clone(), "kanbonk-auto-1-1of1.zip".into()).unwrap();
            assert!(backup_list(dir_str.clone()).unwrap().is_empty());
            assert!(dir.join("notes.zip").exists());
            fs::remove_dir_all(&dir).unwrap();
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[cfg(windows)]
    adopt_legacy_webview_profile();
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![greet, backup_folder::backup_default_dir, backup_folder::backup_write, backup_folder::backup_list, backup_folder::backup_remove])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
