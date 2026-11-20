use std::io::{self, BufRead, BufReader, Read};
use std::path::Path;
use std::process::{Child, Command, Stdio};
use std::sync::{mpsc, Mutex};
use std::thread;
use std::time::{Duration, Instant};

use tauri::{AppHandle, Manager, RunEvent, WebviewUrl, WebviewWindowBuilder};

#[derive(Default)]
struct Backend(Mutex<Option<Child>>);

impl Backend {
    fn stop(&self) {
        if let Some(mut child) = self.0.lock().unwrap().take() {
            drop(child.stdin.take());
            let deadline = Instant::now() + Duration::from_secs(2);
            while Instant::now() < deadline {
                if matches!(child.try_wait(), Ok(Some(_))) {
                    return;
                }
                thread::sleep(Duration::from_millis(25));
            }
            let _ = child.kill();
            let _ = child.wait();
        }
    }
}

fn ready_port(line: &str) -> Option<u16> {
    let digits = line.strip_prefix("RUVOX_READY port=")?;
    if !digits.bytes().all(|b| b.is_ascii_digit()) {
        return None;
    }
    digits.parse::<u16>().ok().filter(|port| *port != 0)
}

fn command(app: &AppHandle) -> tauri::Result<Command> {
    if cfg!(debug_assertions) {
        let mut cmd = Command::new("uv");
        cmd.current_dir(Path::new(env!("CARGO_MANIFEST_DIR")).join("../backend"))
            .args(["run", "python", "-m", "app.sidecar"]);
        Ok(cmd)
    } else {
        Ok(Command::new(
            app.path().resource_dir()?.join("sidecar/ruvox-backend"),
        ))
    }
}

fn start_backend(app: &AppHandle) -> Result<mpsc::Receiver<u16>, Box<dyn std::error::Error>> {
    let mut child = command(app)?
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .spawn()?;
    let stdout = child.stdout.take().expect("piped stdout");
    app.state::<Backend>().0.lock().unwrap().replace(child);
    let (tx, rx) = mpsc::channel();
    thread::spawn(move || {
        let mut reader = BufReader::new(stdout);
        for line in reader.by_ref().lines().map_while(Result::ok) {
            if let Some(port) = ready_port(&line) {
                let _ = tx.send(port);
                break;
            }
        }
        drop(tx);
        let _ = io::copy(&mut reader, &mut io::sink());
    });
    Ok(rx)
}

/// The backend exits with this code when a setting (phone access) needs a restart.
const RESTART_EXIT_CODE: i32 = 75;

fn wait_for_port(app: &AppHandle) -> Result<u16, Box<dyn std::error::Error>> {
    let rx = start_backend(app)?;
    Ok(rx.recv_timeout(Duration::from_secs(20))?)
}

/// Respawns the backend when it asks for a restart and points the window at the new port.
fn watch_backend(app: AppHandle) {
    thread::spawn(move || loop {
        thread::sleep(Duration::from_millis(300));
        let status = {
            let state = app.state::<Backend>();
            let mut guard = state.0.lock().unwrap();
            let Some(child) = guard.as_mut() else {
                return; // stopped on purpose (the app is closing)
            };
            match child.try_wait() {
                Ok(Some(status)) => {
                    guard.take();
                    status
                }
                _ => continue,
            }
        };
        if status.code() != Some(RESTART_EXIT_CODE) {
            return;
        }
        match wait_for_port(&app) {
            Ok(port) => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window
                        .eval(format!("window.location.replace('http://127.0.0.1:{port}/')"));
                }
            }
            Err(error) => {
                eprintln!("Could not restart the backend: {error}");
                show_error(&app);
                return;
            }
        }
    });
}

fn show_error(app: &AppHandle) {
    app.state::<Backend>().stop();
    if let Some(window) = app.get_webview_window("startup") {
        if WebviewWindowBuilder::new(app, "error", WebviewUrl::App("error.html".into()))
            .title("Ruvox")
            .build()
            .is_ok()
        {
            let _ = window.close();
        }
    }
}

fn main() {
    tauri::Builder::default()
        .manage(Backend::default())
        .setup(|app| {
            WebviewWindowBuilder::new(app, "startup", WebviewUrl::App("index.html".into()))
                .title("Ruvox")
                .build()?;
            let handle = app.handle().clone();
            match start_backend(&handle) {
                Ok(rx) => {
                    thread::spawn(move || {
                        let result = rx.recv_timeout(Duration::from_secs(20));
                        if let Ok(port) = result {
                            let url = format!("http://127.0.0.1:{port}/").parse().unwrap();
                            match WebviewWindowBuilder::new(
                                &handle,
                                "main",
                                WebviewUrl::External(url),
                            )
                            .title("Ruvox")
                            .inner_size(960.0, 720.0)
                            .build()
                            {
                                Ok(_) => {
                                    if let Some(splash) = handle.get_webview_window("startup") {
                                        let _ = splash.close();
                                    }
                                    watch_backend(handle.clone());
                                    return;
                                }
                                Err(error) => eprintln!("Could not open Ruvox: {error}"),
                            }
                        }
                        show_error(&handle);
                    });
                }
                Err(error) => {
                    eprintln!("Could not start the backend: {error}");
                    show_error(&handle);
                }
            }
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("could not initialize Ruvox")
        .run(|app, event| {
            if matches!(event, RunEvent::Exit) {
                app.state::<Backend>().stop();
            }
        });
}

#[cfg(test)]
mod tests {
    use super::ready_port;

    #[test]
    fn parses_only_a_complete_readiness_line_with_a_valid_port() {
        assert_eq!(ready_port("RUVOX_READY port=8000"), Some(8000));
        for line in [
            "log message",
            "RUVOX_READY port=0",
            "RUVOX_READY port=65536",
            "RUVOX_READY port=80 extra",
            "RUVOX_READY port=+80",
        ] {
            assert_eq!(ready_port(line), None);
        }
    }
}
