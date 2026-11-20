#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use serde::Serialize;
use tauri::Manager;

const RELEASES: &str = "https://github.com/Kamaa7/Makhzan-/releases";
const LATEST: &str = "https://api.github.com/repos/Kamaa7/Makhzan-/releases/latest";

static SHOP: Mutex<()> = Mutex::new(());

struct ShopPaths {
    dir: PathBuf,
    db: PathBuf,
    backup: PathBuf,
    gen: PathBuf,
}

#[derive(Serialize)]
struct ShopSnapshot {
    bytes: Vec<u8>,
    generation: u64,
}

#[derive(Serialize)]
struct ReadyUpdate {
    version: String,
    url: String,
}

fn lock_shop() -> std::sync::MutexGuard<'static, ()> {
    SHOP.lock().unwrap_or_else(|poison| poison.into_inner())
}

fn shop_paths(app: &tauri::AppHandle) -> Result<ShopPaths, String> {
    let dir = app.path().app_data_dir().map_err(|err| err.to_string())?;
    fs::create_dir_all(&dir).map_err(|err| err.to_string())?;
    Ok(ShopPaths {
        db: dir.join("shop.db"),
        backup: dir.join("shop.db.bak"),
        gen: dir.join("shop.gen"),
        dir,
    })
}

fn read_generation(path: &Path) -> u64 {
    fs::read_to_string(path)
        .ok()
        .and_then(|text| text.trim().parse().ok())
        .unwrap_or(0)
}

fn replace_file(from: &Path, to: &Path) -> Result<(), String> {
    fs::copy(from, to).map_err(|err| err.to_string())?;
    let _ = fs::remove_file(from);
    Ok(())
}

fn write_bytes(path: &Path, bytes: &[u8]) -> Result<(), String> {
    let tmp = path.with_file_name(format!(
        "{}.tmp",
        path.file_name().and_then(|name| name.to_str()).unwrap_or("shop")
    ));
    fs::write(&tmp, bytes).map_err(|err| err.to_string())?;
    replace_file(&tmp, path)
}

fn write_generation(path: &Path, generation: u64) -> Result<(), String> {
    write_bytes(path, generation.to_string().as_bytes())
}

fn copy_backup(paths: &ShopPaths) {
    if paths.db.exists() {
        let _ = fs::copy(&paths.db, &paths.backup);
    }
}

#[tauri::command]
fn shop_folder(app: tauri::AppHandle) -> Result<String, String> {
    let _guard = lock_shop();
    let paths = shop_paths(&app)?;
    Ok(paths.dir.display().to_string())
}

#[tauri::command]
fn shop_read(app: tauri::AppHandle) -> Result<ShopSnapshot, String> {
    let _guard = lock_shop();
    let paths = shop_paths(&app)?;
    let bytes = if paths.db.exists() {
        fs::read(&paths.db).map_err(|err| err.to_string())?
    } else {
        Vec::new()
    };
    Ok(ShopSnapshot {
        generation: read_generation(&paths.gen),
        bytes,
    })
}

#[tauri::command]
fn shop_write(app: tauri::AppHandle, bytes: Vec<u8>, expected: u64) -> Result<u64, String> {
    let _guard = lock_shop();
    let paths = shop_paths(&app)?;
    let current = read_generation(&paths.gen);
    if current != expected {
        return Err("stale".into());
    }
    let next = expected.saturating_add(1);
    write_bytes(&paths.db, &bytes)?;
    write_generation(&paths.gen, next)?;
    copy_backup(&paths);
    Ok(next)
}

#[tauri::command]
fn shop_force_write(app: tauri::AppHandle, bytes: Vec<u8>) -> Result<u64, String> {
    let _guard = lock_shop();
    let paths = shop_paths(&app)?;
    let next = read_generation(&paths.gen).saturating_add(1);
    write_bytes(&paths.db, &bytes)?;
    write_generation(&paths.gen, next)?;
    copy_backup(&paths);
    Ok(next)
}

#[tauri::command]
fn shop_backup(app: tauri::AppHandle, expected: u64) -> Result<bool, String> {
    let _guard = lock_shop();
    let paths = shop_paths(&app)?;
    if read_generation(&paths.gen) != expected || !paths.db.exists() {
        return Ok(false);
    }
    fs::copy(&paths.db, &paths.backup).map_err(|err| err.to_string())?;
    Ok(true)
}

#[tauri::command]
fn save_shop_copy(bytes: Vec<u8>, filename: String) -> Result<bool, String> {
    let safe_name = filename
        .chars()
        .map(|ch| if ch.is_ascii_alphanumeric() || ch == '.' || ch == '-' || ch == '_' { ch } else { '-' })
        .collect::<String>();
    let name = if safe_name.is_empty() { "makhzan-backup.db".to_string() } else { safe_name };
    let Some(path) = rfd::FileDialog::new()
        .set_title("Save Makhzan backup")
        .set_file_name(&name)
        .add_filter("Makhzan shop", &["db"])
        .save_file()
    else {
        return Ok(false);
    };
    fs::write(path, bytes).map_err(|err| err.to_string())?;
    Ok(true)
}

fn parse_version(raw: &str) -> Option<(u64, u64, u64)> {
    let trimmed = raw.trim().trim_start_matches('v');
    let mut parts = trimmed.split('.');
    let major = parts.next()?.parse().ok()?;
    let minor = parts.next()?.parse().ok()?;
    let patch = parts.next()?.parse().ok()?;
    Some((major, minor, patch))
}

fn fetch_ready_update() -> Result<Option<ReadyUpdate>, String> {
    let response = ureq::get(LATEST)
        .timeout(std::time::Duration::from_secs(8))
        .set("User-Agent", "Makhzan")
        .set("Accept", "application/vnd.github+json")
        .call();
    let response = match response {
        Ok(body) => body,
        Err(ureq::Error::Status(404, _)) => return Ok(None),
        Err(err) => return Err(err.to_string()),
    };
    let body = response.into_string().map_err(|err| err.to_string())?;
    let payload: serde_json::Value = serde_json::from_str(&body).map_err(|err| err.to_string())?;
    let tag = payload.get("tag_name").and_then(|value| value.as_str()).unwrap_or("");
    let url = payload
        .get("html_url")
        .and_then(|value| value.as_str())
        .unwrap_or(RELEASES);
    if !url.starts_with(RELEASES) {
        return Ok(None);
    }
    let Some(latest) = parse_version(tag) else {
        return Ok(None);
    };
    let Some(current) = parse_version(env!("CARGO_PKG_VERSION")) else {
        return Ok(None);
    };
    if latest <= current {
        return Ok(None);
    }
    let version = tag.trim().trim_start_matches('v').to_string();
    Ok(Some(ReadyUpdate { version, url: url.to_string() }))
}

#[tauri::command]
fn ready_update() -> Option<ReadyUpdate> {
    match fetch_ready_update() {
        Ok(update) => update,
        Err(err) => {
            eprintln!("update check skipped: {err}");
            None
        }
    }
}

#[tauri::command]
fn open_release(url: String) -> Result<(), String> {
    if !url.starts_with(RELEASES) {
        return Err("Unexpected update link".into());
    }
    std::process::Command::new("cmd")
        .args(["/C", "start", "", &url])
        .spawn()
        .map_err(|err| err.to_string())?;
    Ok(())
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
        }))
        .invoke_handler(tauri::generate_handler![
            shop_folder,
            shop_read,
            shop_write,
            shop_force_write,
            shop_backup,
            save_shop_copy,
            ready_update,
            open_release
        ])
        .run(tauri::generate_context!())
        .expect("error while running Makhzan");
}
